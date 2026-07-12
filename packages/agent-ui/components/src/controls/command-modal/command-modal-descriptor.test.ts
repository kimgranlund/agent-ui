import { describe, it, expect } from 'vitest'
import { UICommandModalElement } from './command-modal.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// command-modal-descriptor.test.ts — LLD-C13 (command-modal.lld.md / SPEC-R12). Two layers, both targeting the
// fence: (a) STRUCTURAL — the frontmatter parses and is schema-valid; (b) CONTRACT↔PROPS — the descriptor's
// `attributes[]` is a faithful bijection with the live UICommandModalElement.props, via the fleet-wide
// compareDescriptorToProps trip-wire (the modal.md / combo-box.md precedent).

const DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/command-modal`
const md = readFileSync(`${DIR}/command-modal.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['open', 'label', 'placeholder', 'hotkey', 'filter']

describe('command-modal.md descriptor — frontmatter parses + schema-valid', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-command-modal')
  })

  it('carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('tag=ui-command-modal, tier=pattern, extends=UIElement, NOT form-associated', () => {
    expect(/^tag:\s*ui-command-modal\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('records the bindable `open` (reflected boolean) + the select/close/toggle events (no `dismiss`)', () => {
    const open = parsed.attributes.find((a) => a.name === 'open')
    expect(open?.type).toBe('boolean')
    expect(open?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('select')
    expect(events).toContain('close')
    expect(events).toContain('toggle')
    expect(events).not.toContain('dismiss')
  })

  it('label/placeholder/hotkey are NOT reflected string props defaulting to \'\'', () => {
    for (const name of ['label', 'placeholder', 'hotkey']) {
      const attr = parsed.attributes.find((a) => a.name === name)
      expect(attr?.type, `${name} type`).toBe('string')
      expect(attr?.default, `${name} default`).toBe('')
      expect(attr?.reflect, `${name} reflect`).toBe(false)
    }
  })

  it('declares the search/list/status/empty parts + the empty slot', () => {
    const parts = (parsed.sequences.get('parts') ?? []).map((i) => i.get('name'))
    expect(parts).toEqual(expect.arrayContaining(['search', 'list', 'status', 'empty']))
    const slots = (parsed.sequences.get('slots') ?? []).map((i) => i.get('name'))
    expect(slots).toContain('empty')
  })

  it('validates with zero structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })
})

describe('command-modal.md descriptor — contract↔props trip-wire', () => {
  it('attributes[] is a faithful bijection with UICommandModalElement.props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UICommandModalElement.props)).toEqual([])
  })

  it('negative control: a drifted reflect on `open` FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'open' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UICommandModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.open.reflect' }),
    )
  })

  it('negative control: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropHotkey: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'hotkey')
    expect(compareDescriptorToProps(dropHotkey, UICommandModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.hotkey' }),
    )
  })

  it('negative control: an extra attribute FAILS the trip-wire', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'persistent', type: 'boolean', default: 'false', reflect: true },
    ]
    expect(compareDescriptorToProps(addBogus, UICommandModalElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.persistent' }),
    )
  })
})

// ── negative controls — SPEC §4 non-goals (grep-checkable on the built module) ───────────────────────────────

describe('command-modal.ts — negative controls (no router import, no persistent/value/recents/results/size prop)', () => {
  const src = readFileSync(`${DIR}/command-modal.ts`, 'utf8') as string
  // Comment-stripped view — the LLD's own interface notes legitimately DISCUSS showModal/cancel/Escape in prose
  // (documenting what the nested ui-modal owns instead); only a live CODE occurrence is the real negative control
  // (the site-canon.test.ts precedent for "comments are not code").
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')

  it('imports no @agent-ui/router (ADR-0115) and no command/action registry', () => {
    expect(src).not.toContain('@agent-ui/router')
  })

  it('creates no dialog of its own — no createElement(\'dialog\'), no showModal call, no cancel-event handler', () => {
    expect(code).not.toMatch(/createElement\(\s*['"]dialog['"]\s*\)/)
    expect(code).not.toContain('showModal(')
    expect(code).not.toMatch(/'cancel'/)
  })

  it('binds no Escape branch (SPEC-R9)', () => {
    expect(code).not.toMatch(/key === 'Escape'/)
  })

  it('declares no persistent/value/recents/results/size prop (SPEC-R2 AC3)', () => {
    const propsBlock = src.slice(src.indexOf('const props = {'), src.indexOf('} satisfies PropsSchema'))
    for (const bad of ['persistent:', 'value:', 'recents:', 'results:', 'size:']) {
      expect(propsBlock, `props block should not declare "${bad}"`).not.toContain(bad)
    }
  })
})
