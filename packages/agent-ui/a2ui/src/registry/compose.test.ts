// compose.test.ts: the registry's composition and view logic over small SYNTHETIC sources, so each rule
// is proven independent of whatever the shipped tree holds today. The real-tree legs (parity against the
// factories, the fleet join, the sidecar and shipped-persona equality) live in `registry-wiring.test.ts`.

import { describe, it, expect } from 'vitest'
import { composeRegistry, registryViewFor, tagForType, typeForTag } from './compose.ts'
import type { CapabilityRow, RegistrySources } from './types.ts'

const guide = (intent: string, notFor: { type: string; why: string }[] = []) => ({ intents: [intent], notFor })

function sources(extra: Partial<RegistrySources> = {}): RegistrySources {
  return {
    catalogs: [
      { catalogId: 'agent-ui', components: { Button: {}, Text: {}, AudioPlayer: {}, Option: {} }, functions: { required: {} }, path: 'a/agent-ui.json' },
      { catalogId: 'a2ui-basic', components: { Button: {}, CheckBox: {} }, functions: {}, path: 'a/basic.json' },
    ],
    fragments: [
      { personaId: 'croupier', fragment: { components: { PlayingCard: {} }, functions: {} }, targetCatalogs: ['agent-ui', 'a2ui-basic'], path: 'p/croupier.json' },
      { personaId: 'solo', fragment: { components: { SoloThing: {} }, functions: {} }, targetCatalogs: ['agent-ui'], path: 'p/solo.json' },
    ],
    guidance: {
      base: { 'agent-ui': { Button: guide('press to submit', [{ type: 'Text', why: 'static copy' }]), Text: guide('show some copy') } },
      persona: { croupier: { PlayingCard: guide('show one playing card') } },
    },
    miniSkills: [
      { id: 'login-form', catalogId: 'agent-ui', path: 'm/login-form.md' },
      { id: 'table-felt', catalogId: 'agent-ui--croupier', path: 'm/table-felt.md' },
    ],
    ...extra,
  }
}

describe('the tag rule', () => {
  it('maps a type to its fleet tag and back, with the three named exceptions', () => {
    expect(tagForType('Button')).toBe('ui-button')
    expect(tagForType('TextField')).toBe('ui-text-field')
    expect(tagForType('RadioGroup')).toBe('ui-radio-group')
    expect(tagForType('AudioPlayer')).toBe('ui-audio')
    expect(tagForType('Option')).toBeNull()
    expect(tagForType('MenuItem')).toBeNull()
    expect(typeForTag('ui-button')).toBe('Button')
    expect(typeForTag('ui-text-field')).toBe('TextField')
    expect(typeForTag('ui-audio')).toBe('AudioPlayer')
    expect(typeForTag('div')).toBeNull()
  })

  it('round-trips every tag the rule can produce', () => {
    for (const tag of ['ui-button', 'ui-text-field', 'ui-radio-group', 'ui-otp-field', 'ui-slider-multi', 'ui-audio']) {
      expect(tagForType(typeForTag(tag)!)).toBe(tag)
    }
  })
})

describe('composeRegistry', () => {
  it('composes catalog, type, function, fragment and mini-skill rows, id-sorted, as plain JSON', () => {
    const reg = composeRegistry(sources())
    const ids = reg.base.map((r) => r.id)
    expect(ids).toEqual([...ids].sort())
    expect(ids).toContain('catalog:agent-ui')
    expect(ids).toContain('type:agent-ui/Button')
    expect(ids).toContain('function:agent-ui/required')
    expect(ids).toContain('mini-skill:login-form')
    expect(Object.keys(reg.personas)).toEqual(['croupier', 'solo'])
    expect(reg.personas.croupier![0]).toMatchObject({ id: 'fragment:croupier', kind: 'fragment', targetCatalogs: ['agent-ui', 'a2ui-basic'] })
    expect(JSON.parse(JSON.stringify(reg))).toEqual(reg) // no undefined, nothing JSON would drop
  })

  it('derives a tag by the rule for agent-ui only; a null-rule type and an upstream-vocabulary type carry none', () => {
    const reg = composeRegistry(sources())
    const type = (id: string): CapabilityRow | undefined => reg.base.find((r) => r.id === id)
    expect(type('type:agent-ui/AudioPlayer')?.tag).toBe('ui-audio')
    expect(type('type:agent-ui/Option')).toBeDefined()
    expect(type('type:agent-ui/Option')).not.toHaveProperty('tag')
    expect(type('type:a2ui-basic/CheckBox')).toBeDefined()
    expect(type('type:a2ui-basic/CheckBox')).not.toHaveProperty('tag') // upstream vocabulary: no derivable rule
  })

  it('a persona type carries a tag only when the rule tag is a fleet control in the sources (a composition carries none)', () => {
    const controls = [{ tag: 'ui-playing-card', tier: 'display', uses: [], path: 'c/card.md' }]
    const withControls = composeRegistry(sources({ controls }))
    const typeIn = (reg: ReturnType<typeof composeRegistry>, persona: string, name: string): CapabilityRow =>
      reg.personas[persona]!.find((r) => r.id === `type:${persona}/${name}`)!
    expect(typeIn(withControls, 'croupier', 'PlayingCard').tag).toBe('ui-playing-card')
    expect(typeIn(withControls, 'solo', 'SoloThing')).not.toHaveProperty('tag') // no ui-solo-thing control exists
    expect(typeIn(composeRegistry(sources()), 'croupier', 'PlayingCard')).not.toHaveProperty('tag') // runtime tier: no control facts
  })

  it('carries guidance onto the type and marks the eval consumer only where guidance exists', () => {
    const reg = composeRegistry(sources())
    const button = reg.base.find((r) => r.id === 'type:agent-ui/Button')!
    expect(button.intents).toEqual(['press to submit'])
    expect(button.notFor).toEqual([{ type: 'Text', why: 'static copy' }])
    expect(button.consumers).toContain('eval')
    expect(reg.base.find((r) => r.id === 'type:agent-ui/AudioPlayer')!.consumers).not.toContain('eval')
  })

  it('records the feed partition on default-catalog types only, with the recorded reason', () => {
    const reg = composeRegistry(sources({ feed: { catalogId: 'agent-ui', surface: ['Button'], excluded: [{ type: 'Text', reason: 'report content' }] } }))
    expect(reg.base.find((r) => r.id === 'type:agent-ui/Text')!.status).toEqual({ state: 'feed-excluded', reason: 'report content' })
    expect(reg.base.find((r) => r.id === 'type:agent-ui/Button')!.status).toEqual({ state: 'emittable' })
    expect(reg.base.find((r) => r.id === 'type:a2ui-basic/Button')!.status).toEqual({ state: 'emittable' })
  })

  it('composes a runtime-tier-only source set (no controls, packs, shards or exclusions) without throwing', () => {
    const reg = composeRegistry(sources())
    for (const kind of ['control', 'genui-pack', 'corpus-shard']) expect(reg.base.filter((r) => r.kind === kind)).toEqual([])
    expect(reg.base.filter((r) => r.kind === 'type').length).toBeGreaterThan(0) // anti-vacuous
  })

  it('decides each control: catalogued by a type or persona type, excluded with its reason, else uncatalogued', () => {
    const reg = composeRegistry(
      sources({
        controls: [
          { tag: 'ui-button', tier: 'control', uses: [], path: 'c/button.md' },
          { tag: 'ui-playing-card', tier: 'display', uses: [], path: 'c/card.md' },
          { tag: 'ui-toast-region', tier: 'pattern', uses: [], path: 'c/region.md' },
          { tag: 'ui-orphan', tier: 'control', uses: [], path: 'c/orphan.md' },
        ],
        exclusions: new Map([['ToastRegion', 'app chrome']]),
      }),
    )
    const control = (tag: string): CapabilityRow => reg.base.find((r) => r.id === `control:${tag}`)!
    expect(control('ui-button').status).toEqual({ state: 'catalogued' })
    expect(control('ui-button').catalogs).toEqual(['agent-ui']) // a2ui-basic types carry no derived tag
    expect(control('ui-playing-card').catalogs).toEqual(['croupier'])
    expect(control('ui-toast-region').status).toEqual({ state: 'excluded', reason: 'app chrome' })
    expect(control('ui-orphan').status).toEqual({ state: 'uncatalogued' }) // the state the coverage gate forbids
    expect(control('ui-button').consumers).toEqual(['prompt', 'renderer', 'site'])
    expect(control('ui-orphan').consumers).toEqual(['site'])
  })
})

describe('registryViewFor', () => {
  const reg = composeRegistry(sources())
  const names = (rows: readonly CapabilityRow[]): (string | undefined)[] => rows.map((r) => r.name)

  it('a derived view holds every base type plus the persona fragment type, with both guidance halves', () => {
    const view = registryViewFor(reg, 'agent-ui--croupier')
    expect(view.baseId).toBe('agent-ui')
    expect(view.personaId).toBe('croupier')
    expect(names(view.types)).toEqual(['AudioPlayer', 'Button', 'Option', 'Text', 'PlayingCard'])
    expect(view.types.find((r) => r.name === 'Button')!.intents).toEqual(['press to submit'])
    expect(view.types.find((r) => r.name === 'PlayingCard')!.intents).toEqual(['show one playing card'])
    expect(view.personaOnlyTypes).toEqual(['PlayingCard'])
    expect(names(view.functions)).toEqual(['required'])
  })

  it('an unknown persona half is the base view; an unknown base half is empty', () => {
    const base = registryViewFor(reg, 'agent-ui')
    const nobody = registryViewFor(reg, 'agent-ui--nobody')
    // the emittable surface equals the base view; retrieval stays keyed to the exact id (SPEC-R6), so it differs
    expect({ ...nobody, retrievable: [], catalogId: 'agent-ui' }).toEqual({ ...base, retrievable: [] })
    expect(nobody.retrievable).toEqual([])
    expect(base.personaId).toBeNull()
    expect(base.personaOnlyTypes).toEqual([])
    const unknown = registryViewFor(reg, 'nobody--croupier')
    expect(unknown.types).toEqual([])
    expect(unknown.baseId).toBe('')
    expect(base.types.length).toBeGreaterThan(0) // anti-vacuous: empty is not the default
  })

  it('the persona applies only to a base it targets (the unregistered pair falls back to the base view)', () => {
    expect(registryViewFor(reg, 'agent-ui--solo').personaId).toBe('solo')
    const basic = registryViewFor(reg, 'a2ui-basic--solo')
    expect(basic.personaId).toBeNull()
    expect(names(basic.types)).toEqual(['Button', 'CheckBox'])
  })

  it('splits on the FIRST separator only', () => {
    expect(registryViewFor(reg, 'agent-ui--croupier--extra').personaId).toBeNull() // persona "croupier--extra" is unknown
  })

  it("retrievable is the EXACT catalog id (the ruled SPEC-R6 filter): a derived id retrieves none of its base's skills", () => {
    expect(names(registryViewFor(reg, 'agent-ui').retrievable)).toEqual(['login-form'])
    expect(names(registryViewFor(reg, 'agent-ui--croupier').retrievable)).toEqual(['table-felt'])
    expect(registryViewFor(reg, 'agent-ui--solo').retrievable).toEqual([])
  })
})
