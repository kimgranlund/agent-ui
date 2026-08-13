// a2ui-surface-toggle.test.ts — GH #418: agent-admin's A2UI Surface Option had ZERO effect on prompt
// composition — `buildSystemPrompt` had no parameter for it, so a GenUI-only turn (A2UI off, GenUI on)
// composed a prompt byte-identical to both-on: the full A2UI JSONL grammar + catalog inventory,
// unconditionally. The model duly emitted A2UI at a client that had A2UI off, and the client rendered it
// anyway while gating its actions inert (agent-admin.test.ts's own GH #418 describe covers that half).
//
// This file covers the OTHER half — the composition layer: `buildSystemPrompt`'s new, additive 7th
// parameter (`a2uiEnabled`). Deterministic, no live model.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { produce } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { validateA2uiEnabled } from '../../tools/agent/dev-proxy-plugin.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../agent/mini-skills.ts'

const intent: TurnInput = { kind: 'intent', text: 'make a card game', session: { turns: [] } }
// ADR-0091 §2 — produce() selects mini-skills for every call, mode/toggle-independent; "make a card
// game" matches card-game-sheet's own triggers, so the byte-equality comparisons below must include that
// SAME selection (the produce-loop.test.ts precedent) to stay an exact `Object.is` match.
const expectedMiniSkills = selectMiniSkills(intent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, defaultCatalog.catalogId)

function stubProvider(output: string): AgentProvider {
  return {
    async *stream() {
      yield output
    },
  }
}

describe('buildSystemPrompt — GH #418: a2uiEnabled degrades byte-identically when absent (Decision precedent)', () => {
  it('an ABSENT 7th argument reproduces the prompt byte-for-byte (every existing caller is unaffected)', () => {
    const withoutParam = buildSystemPrompt(defaultCatalog, [])
    const explicitUndefined = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined)
    expect(explicitUndefined).toBe(withoutParam)
  })

  it('a2uiEnabled:true composes byte-identically to a2uiEnabled absent', () => {
    const withoutParam = buildSystemPrompt(defaultCatalog, [])
    const explicitTrue = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, true)
    expect(explicitTrue).toBe(withoutParam)
  })
})

describe('buildSystemPrompt — GH #418: a2uiEnabled:false composes ZERO A2UI grammar/catalog teaching (Acceptance AC1)', () => {
  it('drops the GRAMMAR block, the catalog inventory, the functions inventory, and mini-skills', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, false)
    expect(prompt).not.toContain('A2UI (Agent2UI) protocol messages')
    expect(prompt).not.toContain('Output rules for the A2UI JSONL')
    expect(prompt).not.toContain('## Available components')
    expect(prompt).not.toContain('## Available functions')
    expect(prompt).not.toMatch(/createSurface|updateComponents|updateDataModel|deleteSurface/)
  })

  it('drops the few-shot A2UI JSONL examples even when exemplars are supplied', () => {
    const exemplar = {
      name: 'ex-1',
      description: 'a fixture exemplar',
      promptText: 'a login form',
      a2uiOutput: [{ version: 'v1.0' as const, createSurface: { surfaceId: 'login', catalogId: 'agent-ui' } }],
      meta: {
        facet: 'exemplar' as const,
        protocolVersion: 'v1.0',
        catalogId: 'agent-ui',
        provenance: { source: 'authored' as const, origin: 'test-fixture' },
        status: 'valid' as const,
      },
    }
    const withA2ui = buildSystemPrompt(defaultCatalog, [exemplar])
    const withoutA2ui = buildSystemPrompt(defaultCatalog, [exemplar], undefined, undefined, undefined, undefined, false)
    expect(withA2ui).toContain('## Examples (retrieved')
    expect(withoutA2ui).not.toContain('## Examples (retrieved')
    expect(withoutA2ui).not.toContain('a login form')
  })

  it('drops mini-skills (they name concrete A2UI catalog component types — catalog teaching too)', () => {
    const withA2ui = buildSystemPrompt(defaultCatalog, [], undefined, [
      { id: 'card-game-sheet', triggers: 'card game', body: 'Map: hand = Row(gap) of Cards', catalogId: 'agent-ui' },
    ])
    const withoutA2ui = buildSystemPrompt(defaultCatalog, [], undefined, [{ id: 'card-game-sheet', triggers: 'card game', body: 'Map: hand = Row(gap) of Cards', catalogId: 'agent-ui' }], undefined, undefined, false)
    expect(withA2ui).toContain('Map: hand = Row(gap) of Cards')
    expect(withoutA2ui).not.toContain('Map: hand = Row(gap) of Cards')
  })

  it('a2uiEnabled:false with genui absent/off composes an EMPTY prompt (mirrors buildSystemPrompt with nothing enabled)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, false)
    expect(prompt).toBe('')
  })

  it('mode has zero effect when a2uiEnabled is false (the A2UI disposition dial is meaningless without A2UI)', () => {
    const dflt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true }, false)
    const specific = buildSystemPrompt(defaultCatalog, [], 'specific', undefined, undefined, { enabled: true }, false)
    const blueSky = buildSystemPrompt(defaultCatalog, [], 'blue-sky', undefined, undefined, { enabled: true }, false)
    expect(specific).toBe(dflt)
    expect(blueSky).toBe(dflt)
  })
})

describe('buildSystemPrompt — GH #418: a2uiEnabled:false still composes a WORKING genui block', () => {
  it('composes the base GenUI teaching + a re-taught note-line convention + the forced exclusive framing', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true }, false)
    expect(prompt).toContain('## GenUI')
    expect(prompt).toContain('"genui":{"surfaceId"')
    // The note-line convention (normally taught by GRAMMAR, which composed zero bytes here) is re-taught.
    expect(prompt).toContain('a2uiMeta')
    expect(prompt).toContain('Note line (ALWAYS first)')
    // The exclusive override composes even though the caller never set genui.exclusive — most-restrictive-
    // wins: a2uiEnabled:false IS the "no A2UI renderer" consumer fact GenuiSurfaceConfig.exclusive names.
    expect(prompt).toContain("This turn's caller has NO A2UI catalog renderer at all")
  })

  it('never references "the A2UI JSONL below" or claims the model must never reply in HTML (both would be FALSE this turn)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true }, false)
    expect(prompt).not.toContain('A2UI JSONL below')
    expect(prompt).not.toContain('You do NOT reply in prose or HTML')
  })

  it('an explicit genui.exclusive:false is overridden — most-restrictive-wins when a2uiEnabled is false', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, exclusive: false }, false)
    expect(prompt).toContain("This turn's caller has NO A2UI catalog renderer at all")
  })

  // GH #425 — the dogfood segment (genui-dogfood-teaching.md) used to reference "the A2UI section above",
  // which composes to ZERO bytes here (a2uiEnabled:false drops the whole GRAMMAR/catalog pipeline above).
  // The fixed segment is self-contained: it composes, and never dangles a reference to an absent section.
  it('the dogfood segment composes self-sufficiently under a2ui-off — present, with no dangling "above" reference', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, dogfood: true }, false)
    expect(prompt).toContain('## Dogfood mode')
    expect(prompt).toContain('## agent-ui components available inside your GenUI document')
    expect(prompt).not.toContain('the A2UI section above')
  })

  it('composes zero genui bytes when genui itself is also off (both modalities off degrades to the empty prompt)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: false }, false)
    expect(prompt).toBe('')
  })

  it('the persona block still composes after genui, unaffected', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, 'Speak like a pirate.', { enabled: true }, false)
    expect(prompt).toContain('## Persona')
    expect(prompt).toContain('Speak like a pirate.')
    expect(prompt.indexOf('## GenUI')).toBeLessThan(prompt.indexOf('## Persona'))
  })
})

describe('produce() — GH #418: ProduceOptions.a2uiEnabled threads to buildSystemPrompt, never touches peel/heal/validate', () => {
  it('the composed system prompt the provider receives reflects a2uiEnabled:false', async () => {
    const systems: string[] = []
    const provider: AgentProvider = {
      async *stream(req) {
        systems.push(req.system)
        yield '{"a2uiMeta":{"note":"ok"}}'
      },
    }
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    for await (const _line of produce(intent, deps, { maxRounds: 1, a2uiEnabled: false, genuiSurface: { enabled: true } })) {
      void _line
    }
    expect(systems[0]).toBe(buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true }, false))
    expect(systems[0]).not.toContain('## Available components')
  })

  it('absent a2uiEnabled composes byte-identically to before this option existed', async () => {
    const systems: string[] = []
    const provider: AgentProvider = {
      async *stream(req) {
        systems.push(req.system)
        yield '{"a2uiMeta":{"note":"ok"}}'
      },
    }
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    for await (const _line of produce(intent, deps, { maxRounds: 1 })) {
      void _line
    }
    expect(systems[0]).toBe(buildSystemPrompt(defaultCatalog, [], undefined, expectedMiniSkills))
  })

  it('a2uiEnabled:false never changes produce() peel/heal/validate mechanics — a stray A2UI reply still runs the ordinary validate/self-correct path', async () => {
    // ADR-0187 / GH #829 (LLD §7) — this stub's reply used to be `note + a BARE createSurface, nothing
    // else`, which `produce()` now (correctly) judges an abandoned surface at finalize granularity: it
    // would self-correct three rounds and throw `ProduceHalt`. The stub gains the minimal `root` delivery
    // that makes it a VALID one-round reply. The test's SUBJECT — that `a2uiEnabled` steers only the
    // PROMPT, never the loop's peel/heal/validate mechanics — is unchanged, and is in fact better served
    // by a reply that completes: the compared line lists are now non-trivially equal.
    const raw =
      '{"a2uiMeta":{"note":"here"}}\n' +
      '{"version":"v1.0","createSurface":{"surfaceId":"s","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"s","components":[{"id":"root","component":"Text","text":"stray"}]}}'
    const runWith = async (a2uiEnabled: boolean): Promise<string[]> => {
      const deps: ProduceDeps = { provider: stubProvider(raw), retrieve: () => [], catalog: defaultCatalog }
      const lines: string[] = []
      for await (const line of produce(intent, deps, { maxRounds: 3, a2uiEnabled })) lines.push(line)
      return lines
    }
    // The peel/heal/validate result is identical either way — `a2uiEnabled` only steers the PROMPT, not
    // this loop's own mechanics (the exact posture GenuiSurfaceConfig.exclusive already holds).
    expect(await runWith(true)).toEqual(await runWith(false))
  })
})

describe('validateA2uiEnabled — GH #418: the SAME fail-closed trust-boundary posture as validateMode/validateGenuiSurface', () => {
  it('accepts true/false verbatim', () => {
    expect(validateA2uiEnabled(true)).toBe(true)
    expect(validateA2uiEnabled(false)).toBe(false)
  })

  it('a non-boolean value degrades to undefined — never a 400', () => {
    expect(validateA2uiEnabled('false')).toBeUndefined()
    expect(validateA2uiEnabled(0)).toBeUndefined()
    expect(validateA2uiEnabled(null)).toBeUndefined()
    expect(validateA2uiEnabled(undefined)).toBeUndefined()
  })
})
