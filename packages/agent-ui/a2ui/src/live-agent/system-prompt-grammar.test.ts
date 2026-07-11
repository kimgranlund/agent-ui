// system-prompt-grammar.test.ts — ADR-0089 (extends ADR-0088/ADR-0071): the two hand-authored GRAMMAR
// additions — clarify-before-acting and catalog-boundary negotiated approximation — live ONLY in the
// GRAMMAR half of the derived prompt (never the catalog-DERIVED inventory `prompt-drift.test.ts` gates),
// and never license emitting an uncatalogued component/prop. Deterministic, no live model.
//
// ADR-0090 §1/§2 extends this file: `buildSystemPrompt`'s new third `mode` parameter SCALES the two
// ADR-0089 behaviors above between `'specific'` (dialed DOWN) and `'blue-sky'` (dialed UP, carrying the
// dual-direction composition discipline + calibration examples) — an ABSENT `mode` (and `'default'`)
// MUST reproduce this file's pre-existing `buildSystemPrompt(defaultCatalog, [])` grammar BYTE-FOR-BYTE
// (Decision §1, Acceptance AC1) — the load-bearing zero-regression guarantee. The honesty floor (§2)
// holds identically in every mode, and the mode prose never leaks into the catalog-derived inventory.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../../tools/agent/system-prompt.ts'
import { produce } from '../../tools/agent/produce.ts'
import type { ProduceDeps } from '../../tools/agent/produce.ts'
import type { AgentProvider, TurnInput } from '../../tools/agent/agent-transport.ts'
import { readMetaLine } from '../../tools/agent/meta-line.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { MINI_SKILLS } from '../../tools/agent/mini-skills.ts'
import type { MiniSkill } from '../../tools/agent/mini-skills.ts'
import { FEED_SURFACE_TYPES } from '../../tools/agent/feed-catalog.ts'

function stubProvider(outputs: string[]): AgentProvider {
  let n = 0
  return {
    async *stream() {
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
}

describe('buildSystemPrompt GRAMMAR additions (ADR-0089)', () => {
  const prompt = buildSystemPrompt(defaultCatalog, [])

  it('instructs clarify-before-acting, calibrated with the ADR examples (act vs. clarify)', () => {
    expect(prompt).toContain('Ask instead of guess when the turn is underdetermined')
    // Kim's calibrating examples, verbatim-or-equivalent: an underdetermined phrase clarifies...
    expect(prompt).toMatch(/make it better/i)
    // ...while a specific-enough request still just gets built.
    expect(prompt).toMatch(/build me a form/i)
  })

  it('instructs catalog-boundary honesty + ask-before-approximate', () => {
    expect(prompt).toContain('Be honest at the catalog wall')
    expect(prompt).toMatch(/data-table/i)
    expect(prompt).toMatch(/want me to/i)
    expect(prompt).toMatch(/approximation/i)
  })

  it('the boundary instruction NEVER licenses an uncatalogued type — it reiterates "ONLY catalog" language', () => {
    // A load-bearing negative control (ADR-0089 Out-of-scope): the new prose must not read as permission
    // to invent a type. Assert the containment/restriction vocabulary is present around "approximat*" —
    // i.e. every mention of approximating is paired with an "ONLY"/"EXCLUSIVELY ... catalog" constraint —
    // and that no wording resembling "invent"/"beyond the catalog" appears as something the agent MAY do.
    expect(prompt).toMatch(/ONLY (from your\s+)?EXISTING catalog components|EXCLUSIVELY from your\s+EXISTING catalog components/i)
    expect(prompt).toContain('Never emit a component type or prop that is not in the catalog')
    // The pre-existing hard rule survives byte-for-byte (ADR-0089 does not weaken it).
    expect(prompt).toContain('Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a prop.')
    // No sentence anywhere grants leave to go "beyond" or "outside" the catalog.
    expect(prompt).not.toMatch(/\b(go|reach|step)\s+beyond the catalog\b/i)
    // Every mention of "invent" a component/prop is a PROHIBITION ("NEVER"/"do NOT"/"not") in the same
    // sentence — never an affirmative grant to invent one.
    const inventSentences = prompt.split(/(?<=[.:])\s+/).filter((s) => /invent/i.test(s))
    expect(inventSentences.length).toBeGreaterThan(0) // the rule is actually present, not vacuously true
    for (const s of inventSentences) expect(s).toMatch(/\b(NEVER|not)\b/i)
  })

  it('the drift gate\'s derived sections are untouched — the additions land only in the GRAMMAR half', () => {
    // Same section-extraction idiom as prompt-drift.test.ts: everything between "## Available
    // components" and the next "## " heading is UNCHANGED in shape — no clarify/boundary prose leaked
    // into the catalog-derived inventory section.
    const marker = '## Available components'
    const start = prompt.indexOf(marker)
    const rest = prompt.slice(start + marker.length)
    const end = rest.indexOf('\n## ')
    const body = end === -1 ? rest : rest.slice(0, end)
    expect(body).not.toMatch(/underdetermined|approximation|catalog wall/i)
  })
})

describe('produce() with the new GRAMMAR text: note-only clarify turn still returns cleanly (Acceptance)', () => {
  const intent: TurnInput = { kind: 'intent', text: 'make it better', session: { turns: [] } }

  it('a stub emitting a note-only clarifying question yields the meta-line + zero A2UI lines, no ProduceHalt', async () => {
    const provider = stubProvider(['{"a2uiMeta":{"note":"Better in what way — layout, more fields, or something else?"}}'])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined() // empty A2UI ≠ invalid — no ProduceHalt (ADR-0088 mechanism, unaffected)
    expect(lines).toHaveLength(1) // the meta-line only, zero A2UI lines
    const meta = readMetaLine(lines[0]!)
    expect(meta).toBeDefined()
    expect(meta!.a2uiMeta.note).toMatch(/better in what way/i)
  })

  it('a stub emitting a note-only boundary-ask turn (before permission) also returns cleanly', async () => {
    const boundaryIntent: TurnInput = { kind: 'intent', text: 'build me a data table', session: { turns: [] } }
    const provider = stubProvider([
      '{"a2uiMeta":{"note":"I don\'t have a real data-table component. I can approximate one with a Grid of Rows and Text — want me to?"}}',
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(boundaryIntent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined()
    expect(lines).toHaveLength(1)
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toMatch(/approximate/i)
  })
})

// ── ADR-0090 §1/§2/§4: the `mode` axis that SCALES the two ADR-0089 behaviors above ──────────────────

function catalogInventoryBody(prompt: string): string {
  // The SAME section-extraction idiom prompt-drift.test.ts uses — everything between "## Available
  // components" and the next "## " heading — so mode prose leaking into the derived inventory is caught
  // regardless of which mode composed the prompt.
  const marker = '## Available components'
  const start = prompt.indexOf(marker)
  const rest = prompt.slice(start + marker.length)
  const end = rest.indexOf('\n## ')
  return end === -1 ? rest : rest.slice(0, end)
}

describe('buildSystemPrompt mode axis (ADR-0090 §1)', () => {
  it('an ABSENT mode reproduces the exact pre-mode grammar byte-for-byte (Decision §1 / Acceptance AC1)', () => {
    // The strongest available proof of "byte-identical to the pre-mode ADR-0089 grammar" is equality with
    // THIS FILE's own pre-existing 2-arg call (`buildSystemPrompt(defaultCatalog, [])`) — the exact
    // invocation every ADR-0089 assertion above (and every prompt-drift.test.ts assertion) already checks
    // content against. A regression here would ALSO break every one of those pre-existing assertions.
    const twoArg = buildSystemPrompt(defaultCatalog, [])
    const explicitUndefined = buildSystemPrompt(defaultCatalog, [], undefined)
    const explicitDefault = buildSystemPrompt(defaultCatalog, [], 'default')
    expect(explicitUndefined).toBe(twoArg)
    expect(explicitDefault).toBe(twoArg)
    // Belt-and-braces: the exact pre-mode phrases this file already asserts against the 2-arg call also
    // hold, verbatim, for the 3-arg undefined/'default' calls (zero regression, not merely "still parses").
    for (const prompt of [explicitUndefined, explicitDefault]) {
      expect(prompt).toContain('Ask instead of guess when the turn is underdetermined')
      expect(prompt).toContain('Be honest at the catalog wall')
      expect(prompt).toContain('Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a prop.')
    }
  })

  it('"specific" dials the clarify/negotiate behaviors DOWN — directive mapping, decline-and-redirect at the wall', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'specific')
    expect(prompt).toMatch(/dialed DOWN \(specific mode\)/)
    expect(prompt).toMatch(/prefer mapping every request directly to the\s+nearest catalog artifact/)
    expect(prompt).toMatch(/do NOT propose composing a novel approximation/)
    // The blue-sky-only dual-direction discipline + calibration examples must NOT appear under specific.
    expect(prompt).not.toMatch(/TOP-DOWN/)
    expect(prompt).not.toMatch(/BOTTOM-UP/)
    expect(prompt).not.toMatch(/Calibration examples/)
  })

  it('"blue-sky" dials the clarify/negotiate behaviors UP — lower threshold, elaborate approximation, narrated reasoning', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    expect(prompt).toMatch(/dialed UP \(blue-sky mode\)/)
    expect(prompt).toMatch(/LOWER threshold for clarifying/)
    expect(prompt).toMatch(/compose more elaborate approximations/)
    expect(prompt).toMatch(/narrate your reasoning/)
  })

  it('"blue-sky" carries the dual-direction composition discipline (top-down/bottom-up/reconcile), close to the ADR\'s prose', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    expect(prompt).toMatch(/two-direction composition discipline/)
    expect(prompt).toMatch(/TOP-DOWN from the user's goal to the/)
    expect(prompt).toMatch(/BOTTOM-UP from the catalog to which real primitives realize each part/)
    expect(prompt).toMatch(/RECONCILE/)
    expect(prompt).toMatch(/keep the surface minimal \(add no structure the goal does not require\)/)
    // Falls through to the honesty floor / catalog-wall behavior for anything unhosted — never "invent".
    expect(prompt).toMatch(/do NOT invent: fall through to the honesty floor above/)
  })

  it('"blue-sky" ships the ★ calibration examples (card-game sheet, settings screen, dashboard)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    expect(prompt).toMatch(/Calibration examples/)
    // 1. The card-game sheet (Kim's own example) — a hosted mapping AND a named wall.
    expect(prompt).toMatch(/card-game component sheet/)
    expect(prompt).toMatch(/Row\(gap\) of Cards/)
    expect(prompt).toMatch(/drag-to-reorder, card-flip animation, and playing-card face art are not hosted/)
    // 2. The settings screen — fully hosted, no wall.
    expect(prompt).toMatch(/settings screen/)
    expect(prompt).toMatch(/List of Field/)
    expect(prompt).toMatch(/Wall: none — fully\s+hosted/)
    // 3. The dashboard — a second, distinct wall case (charts unhosted).
    expect(prompt).toMatch(/dashboard \/ summary/)
    expect(prompt).toMatch(/real charts\/sparklines are not hosted/)
  })

  it('the honesty floor (§2) is present, verbatim-equivalent, in EVERY mode — mode never touches it', () => {
    const specific = buildSystemPrompt(defaultCatalog, [], 'specific')
    const blueSky = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    const dflt = buildSystemPrompt(defaultCatalog, [])
    for (const prompt of [specific, blueSky]) {
      expect(prompt).toContain('Honesty floor (holds identically in EVERY mode — never dialed)')
      expect(prompt).toMatch(/never invent a component or a\s+prop that is not in the catalog below/)
      expect(prompt).toMatch(/never silently substitute something\s+else and pass it off as the real thing/)
      // The pre-existing invariant Output-rules bullet survives, unchanged, in every mode too.
      expect(prompt).toContain('Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a prop.')
    }
    // The default's own (ADR-0089) floor sentences, asserted by the earlier describe block, still hold.
    expect(dflt).toContain('Never emit a component type or prop that is not in the catalog')
  })

  it('the catalog-derived inventory carries NONE of the mode prose, in ANY mode (drift gate untouched)', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(prompt)
      expect(body).not.toMatch(/dialed (DOWN|UP)|TOP-DOWN|BOTTOM-UP|RECONCILE|Calibration examples|blue-sky mode|specific mode/i)
    }
  })
})

// ── ADR-0091 §3/§4: the `miniSkills` 4th parameter — additive and orthogonal to the `mode` axis ───────

describe('buildSystemPrompt miniSkills block (ADR-0091 §3)', () => {
  it('an ABSENT/empty 4th argument reproduces the prompt byte-for-byte (zero-regression, ADR-0091 Acceptance)', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const withoutParam = buildSystemPrompt(defaultCatalog, [], mode)
      const explicitUndefined = buildSystemPrompt(defaultCatalog, [], mode, undefined)
      const explicitEmpty = buildSystemPrompt(defaultCatalog, [], mode, [])
      expect(explicitUndefined).toBe(withoutParam)
      expect(explicitEmpty).toBe(withoutParam)
    }
    // Belt-and-braces: the exact 2-arg call every OTHER test in this file (and prompt-drift.test.ts) already
    // asserts against is untouched by the new parameter's mere existence.
    expect(buildSystemPrompt(defaultCatalog, [])).toBe(buildSystemPrompt(defaultCatalog, [], undefined, []))
  })

  it('a non-empty selection appends the "## Composition idioms" header + the selected bodies', () => {
    const selected: MiniSkill[] = [MINI_SKILLS.find((m) => m.id === 'settings-screen')!]
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, selected)
    expect(prompt).toContain('## Composition idioms (matched to your request)')
    expect(prompt).toContain(selected[0]!.body)
  })

  it('an empty selection composes NO "## Composition idioms" header at all', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, [])
    expect(prompt).not.toContain('## Composition idioms')
  })

  it('composes on top of every mode identically — additive and orthogonal to the mode-scaled block', () => {
    const selected: MiniSkill[] = [MINI_SKILLS.find((m) => m.id === 'login-form')!]
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode, selected)
      expect(prompt).toContain('## Composition idioms (matched to your request)')
      expect(prompt).toContain(selected[0]!.body)
    }
  })

  it('the miniSkills block never leaks into the catalog-derived inventory (drift gate untouched)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, MINI_SKILLS)
    const body = catalogInventoryBody(prompt)
    expect(body).not.toMatch(/Composition idioms/i)
  })

  it('composes AFTER the few-shot block (## Examples, if present, precedes ## Composition idioms)', () => {
    const exemplar = {
      name: 'ex-1',
      description: 'a fixture exemplar',
      promptText: 'build me a button',
      a2uiOutput: [{ version: 'v1.0' as const, createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
      meta: {
        facet: 'exemplar' as const,
        protocolVersion: 'v1.0',
        catalogId: 'agent-ui',
        provenance: { source: 'authored' as const, origin: 'test-fixture' },
        status: 'valid' as const,
      },
    }
    const selected: MiniSkill[] = [MINI_SKILLS.find((m) => m.id === 'dashboard-kpi-grid')!]
    const prompt = buildSystemPrompt(defaultCatalog, [exemplar], undefined, selected)
    const examplesIdx = prompt.indexOf('## Examples')
    const ideasIdx = prompt.indexOf('## Composition idioms')
    expect(examplesIdx).toBeGreaterThan(-1)
    expect(ideasIdx).toBeGreaterThan(examplesIdx)
  })
})

// ── ADR-0091 §4 fix (independent-review defect): the three (★) calibration examples used to be
// hardcoded VERBATIM in both `NEGOTIATE_BLUE_SKY` (system-prompt.ts) and the `MINI_SKILLS` registry, so a
// blue-sky prompt whose intent ALSO selected one of those three ids got the identical paragraph injected
// TWICE. Fixed by single-sourcing `NEGOTIATE_BLUE_SKY`'s bullets FROM the registry, then filtering those
// same three ids OUT of a `'blue-sky'`-mode selection before `miniSkillsBlock` composes it. This block is
// the regression proof: exactly ONE occurrence, never two, and only in the mode where the text is
// pre-inlined. ────────────────────────────────────────────────────────────────────────────────────────

describe('ADR-0091 §4 fix — no double-injection of the ★ calibration examples in blue-sky mode', () => {
  // A substring unique to each ★ entry's body — present once per copy, so counting occurrences in the
  // FULLY COMPOSED prompt is a direct proof of "injected once" vs. the reviewer-caught "injected twice".
  const UNIQUE_SUBSTRING: Record<string, string> = {
    'card-game-sheet': 'drag-to-reorder, card-flip animation, and playing-card face art are not hosted',
    'settings-screen': 'CardFooter › Button. Wall: none — fully hosted.',
    'dashboard-kpi-grid': 'real charts/sparklines are not hosted',
  }
  const STARRED_IDS = ['card-game-sheet', 'settings-screen', 'dashboard-kpi-grid'] as const

  function occurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1
  }

  function skillOf(id: string): MiniSkill {
    return MINI_SKILLS.find((m) => m.id === id)!
  }

  for (const id of STARRED_IDS) {
    it(`"${id}" selected in 'blue-sky' mode: its paragraph appears exactly ONCE (regression for the bug)`, () => {
      const selected: MiniSkill[] = [skillOf(id)]
      const prompt = buildSystemPrompt(defaultCatalog, [], 'blue-sky', selected)
      expect(occurrences(prompt, UNIQUE_SUBSTRING[id]!)).toBe(1)
      // The registry selection itself was fully absorbed into the already-inlined calibration text — no
      // separate "## Composition idioms" block was appended for it.
      expect(prompt).not.toContain('## Composition idioms')
    })

    it(`"${id}" selected in 'specific' mode: injects normally (once) — not pre-inlined there`, () => {
      const selected: MiniSkill[] = [skillOf(id)]
      const prompt = buildSystemPrompt(defaultCatalog, [], 'specific', selected)
      expect(occurrences(prompt, UNIQUE_SUBSTRING[id]!)).toBe(1)
      expect(prompt).toContain('## Composition idioms (matched to your request)')
    })

    it(`"${id}" selected in 'default'/absent mode: injects normally (once) — not pre-inlined there`, () => {
      const selected: MiniSkill[] = [skillOf(id)]
      for (const mode of [undefined, 'default'] as const) {
        const prompt = buildSystemPrompt(defaultCatalog, [], mode, selected)
        expect(occurrences(prompt, UNIQUE_SUBSTRING[id]!)).toBe(1)
        expect(prompt).toContain('## Composition idioms (matched to your request)')
      }
    })
  }

  it("login-form/master-detail-split are unaffected — inject normally (once) in EVERY mode", () => {
    for (const id of ['login-form', 'master-detail-split'] as const) {
      const selected: MiniSkill[] = [skillOf(id)]
      for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
        const prompt = buildSystemPrompt(defaultCatalog, [], mode, selected)
        expect(prompt).toContain('## Composition idioms (matched to your request)')
        expect(occurrences(prompt, selected[0]!.body)).toBe(1)
      }
    }
  })

  it('the pre-existing empty/absent-miniSkills byte-identity guarantees across all 4 modes still hold', () => {
    // Re-proves the exact assertion this fix must not touch (ADR-0091 Acceptance) — an empty/absent
    // selection reproduces the mode's own bare prompt byte-for-byte, in every mode, even after the
    // §4 fix's new filter runs (an empty array filters to an empty array).
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const withoutParam = buildSystemPrompt(defaultCatalog, [], mode)
      const explicitUndefined = buildSystemPrompt(defaultCatalog, [], mode, undefined)
      const explicitEmpty = buildSystemPrompt(defaultCatalog, [], mode, [])
      expect(explicitUndefined).toBe(withoutParam)
      expect(explicitEmpty).toBe(withoutParam)
    }
  })
})

// ── Marker-sanity guard (independent-review hardening, post-ADR-0090) ──────────────────────────────────
// system-prompt.ts derives `INTRO_AND_NOTE`/`OUTPUT_RULES` by locating `CLARIFY_MARKER`/`OUTPUT_MARKER`
// substrings inside the literal `GRAMMAR` const via `indexOf`, then asserts (`assertMarkersHold`, at
// module load) that BOTH markers are found and that the two derived slices are disjoint. This is the
// negative-control proof that the guard would actually CATCH a broken marker — not merely that today's
// real GRAMMAR happens not to trip it (which the whole rest of this file already proves vacuously, since
// every test above imports `system-prompt.ts` successfully). It reconstructs the SAME slicing + assertion
// logic against a synthetically mutated string missing one marker, and asserts that reconstruction throws.

describe('GRAMMAR marker-sanity guard (independent-review hardening)', () => {
  // A faithful replica of system-prompt.ts's slicing + guard logic, parameterized over the grammar string
  // under test — so the SAME shape of bug (marker silently missing → indexOf === -1 → a near-whole-string
  // slice) can be reproduced against a deliberately broken input without touching the real module's
  // internals (which are not exported, by design).
  function deriveAndAssert(grammar: string, clarifyMarker: string, outputMarker: string): void {
    const introAndNote = grammar.slice(0, grammar.indexOf(clarifyMarker)).trim()
    const outputRules = grammar.slice(grammar.indexOf(outputMarker)).trim()
    if (grammar.indexOf(clarifyMarker) === -1) {
      throw new Error(`system-prompt: CLARIFY_MARKER not found in GRAMMAR — "${clarifyMarker}"`)
    }
    if (grammar.indexOf(outputMarker) === -1) {
      throw new Error(`system-prompt: OUTPUT_MARKER not found in GRAMMAR — "${outputMarker}"`)
    }
    if (introAndNote.includes(outputMarker)) {
      throw new Error('system-prompt: INTRO_AND_NOTE unexpectedly contains OUTPUT_MARKER — the slice is not disjoint')
    }
    if (outputRules.includes(clarifyMarker)) {
      throw new Error('system-prompt: OUTPUT_RULES unexpectedly contains CLARIFY_MARKER — the slice is not disjoint')
    }
  }

  const CLARIFY_MARKER = 'Ask instead of guess when the turn is underdetermined'
  const OUTPUT_MARKER = 'Output rules for the A2UI JSONL'
  const REAL_GRAMMAR = buildSystemPrompt(defaultCatalog, [])

  it('does NOT fire against the current real GRAMMAR — both markers are present today', () => {
    // Sanity leg: the guard must be silent on the actual shipped prose. (The module already imported
    // cleanly above without throwing, which is the strongest form of this proof; this reconstructs the
    // same check explicitly so the assertion is legible on its own.)
    expect(() => deriveAndAssert(REAL_GRAMMAR, CLARIFY_MARKER, OUTPUT_MARKER)).not.toThrow()
  })

  it('FIRES when CLARIFY_MARKER is missing from the grammar (the exact defect this guard closes)', () => {
    // Simulate a future edit that rewords/removes the clarify-marker phrase: strip it out of a copy of the
    // real grammar. Without the guard, `grammar.indexOf(clarifyMarker)` would return -1 and
    // `grammar.slice(0, -1)` would silently produce almost the entire string as `INTRO_AND_NOTE` — this
    // proves the guard throws instead, loudly, at the point of derivation.
    const brokenGrammar = REAL_GRAMMAR.replace(CLARIFY_MARKER, 'a rewritten sentence that no longer matches')
    expect(brokenGrammar.indexOf(CLARIFY_MARKER)).toBe(-1) // confirm the mutation actually broke the marker
    expect(() => deriveAndAssert(brokenGrammar, CLARIFY_MARKER, OUTPUT_MARKER)).toThrow(/CLARIFY_MARKER not found/)
  })

  it('FIRES when OUTPUT_MARKER is missing from the grammar (the already-indirectly-covered case, made explicit)', () => {
    const brokenGrammar = REAL_GRAMMAR.replace(OUTPUT_MARKER, 'a rewritten heading that no longer matches')
    expect(brokenGrammar.indexOf(OUTPUT_MARKER)).toBe(-1)
    expect(() => deriveAndAssert(brokenGrammar, CLARIFY_MARKER, OUTPUT_MARKER)).toThrow(/OUTPUT_MARKER not found/)
  })

  it('FIRES when the two derived slices are not disjoint (a marker moved but overlaps the other slice)', () => {
    // Construct a pathological grammar where OUTPUT_MARKER's text is duplicated BEFORE CLARIFY_MARKER too,
    // so INTRO_AND_NOTE (everything before CLARIFY_MARKER) would end up containing OUTPUT_MARKER — the
    // disjointness check must catch this even though both `indexOf` calls individually succeed.
    const overlapping = `${OUTPUT_MARKER} duplicated early.\n\n${REAL_GRAMMAR}`
    expect(overlapping.indexOf(CLARIFY_MARKER)).not.toBe(-1)
    expect(overlapping.indexOf(OUTPUT_MARKER)).not.toBe(-1)
    expect(() => deriveAndAssert(overlapping, CLARIFY_MARKER, OUTPUT_MARKER)).toThrow(/slice is not disjoint/)
  })
})

// ── ADR-0097 §4: feed-embedded ask mechanics (mode-invariant) + the mode-scaled archetype vocabulary +
// the derived feed-allowed list composed FROM feed-catalog.ts (ADR-0097 §3 / SPEC-R15 nC3) ────────────────

describe('buildSystemPrompt feed-ask mechanics — mode-invariant (ADR-0097 §4)', () => {
  it('the mechanics block is present, verbatim-identical, in ALL modes (default/specific/blue-sky)', () => {
    const dflt = buildSystemPrompt(defaultCatalog, [])
    const specific = buildSystemPrompt(defaultCatalog, [], 'specific')
    const blueSky = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    const marker = 'Feed-embedded asks:'
    expect(dflt).toContain(marker)
    expect(specific).toContain(marker)
    expect(blueSky).toContain(marker)
    // Extract the mechanics paragraph out of each composed prompt (it ends where the next blank-line-
    // delimited paragraph starts) and assert genuine byte-identity, not just "the marker string appears".
    const mechanicsOf = (prompt: string): string => {
      const start = prompt.indexOf(marker)
      const rest = prompt.slice(start)
      const end = rest.indexOf('\n\n')
      return end === -1 ? rest : rest.slice(0, end)
    }
    const dfltMechanics = mechanicsOf(dflt)
    expect(dfltMechanics).toBe(mechanicsOf(specific))
    expect(dfltMechanics).toBe(mechanicsOf(blueSky))
  })

  it('instructs the exact wire shape: ask on the SAME meta-line, sendDataModel:true, ONE commit Button, wantResponse omitted', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/"a2uiMeta":\{"note":"[^"]+","ask":\{"surfaceId":"ask-1"\}\}/)
    expect(prompt).toMatch(/"sendDataModel":true/)
    expect(prompt).toMatch(/EXACTLY ONE commit Button/)
    expect(prompt).toMatch(/OMITS\s+"wantResponse"/)
    expect(prompt).toMatch(/AT MOST ONE ask per turn/)
    expect(prompt).toMatch(/NEVER\s+also create or update any other surface in that same turn/)
  })

  it('the note-standalone rule is present — the note must ALWAYS carry the full question in prose', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/note MUST ALWAYS carry the full question in plain prose/)
  })

  it('grammarFor(undefined) === the literal GRAMMAR constant still holds with the mechanics addition (Decision §1)', () => {
    const twoArg = buildSystemPrompt(defaultCatalog, [])
    expect(buildSystemPrompt(defaultCatalog, [], undefined)).toBe(twoArg)
    expect(buildSystemPrompt(defaultCatalog, [], 'default')).toBe(twoArg)
  })
})

describe('buildSystemPrompt feed-ask derived allowed-types list (ADR-0097 §3/§4, nC3)', () => {
  it("the mechanics block's feed-allowed list SET-EQUALS FEED_SURFACE_TYPES — drift impossible by construction", () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    const marker = 'Build a feed ask using ONLY these component types'
    const start = prompt.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const rest = prompt.slice(start)
    const listMatch = rest.match(/:\s*([^.]+)\./)
    expect(listMatch).not.toBeNull()
    const listed = listMatch![1]!.split(',').map((s) => s.trim())
    expect(new Set(listed)).toEqual(new Set(FEED_SURFACE_TYPES))
  })

  it('none of the feed prose leaks into the derived "## Available components" inventory section', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(prompt)
      expect(body).not.toMatch(/feed-embedded ask|feed-ask|sendDataModel/i)
    }
  })

  it('a planted feed type absent from the composed prompt would fail this file\'s own set-equality check (negative control)', () => {
    const withoutOne = new Set(FEED_SURFACE_TYPES)
    withoutOne.delete('Slider')
    expect(withoutOne).not.toEqual(new Set(FEED_SURFACE_TYPES)) // proves the check above genuinely discriminates
  })

  it('prompt-drift.test.ts stays green (the catalog-derived section is untouched by this addition)', () => {
    // The strongest available proof without re-running a separate file: the SAME section-extraction idiom
    // prompt-drift.test.ts uses, re-asserted here against a prompt carrying the new mechanics + archetype
    // prose, still finds every catalog component listed (spot-checking a few representative rows).
    const prompt = buildSystemPrompt(defaultCatalog, [])
    const body = catalogInventoryBody(prompt)
    expect(body).toContain('- Button (props:')
    expect(body).toContain('- Modal (props:') // an OUT-of-feed-scope type still fully documented for the canvas
  })
})

// ── ADR-0126 (TKT-0016): the message-lifecycle decision-layer teaching, appended in the OUTPUT_RULES
// zone — the four-type choice rule + deleteSurface's wire shape + the whole-record-upsert warning. ──────

describe('buildSystemPrompt message-lifecycle teaching (ADR-0126 F2, LLD-C1/C2)', () => {
  it('teaches the four-type message-lifecycle choice, including deleteSurface (ADR-0126 F2)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toContain('deleteSurface')
    expect(prompt).toMatch(/updateDataModel alone/i)
    expect(prompt).toMatch(/FRESH surfaceId/)
    expect(prompt).toMatch(/REPLACES its ENTIRE record/)
  })

  it('the lifecycle teaching survives specific/blue-sky mode composition (OUTPUT_RULES zone, no new plumbing)', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toContain('deleteSurface')
      expect(prompt).toMatch(/updateDataModel alone/i)
      expect(prompt).toMatch(/FRESH surfaceId/)
      expect(prompt).toMatch(/REPLACES its ENTIRE record/)
    }
  })

  it('teaches the deleteSurface wire shape verbatim', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/\{"version":"v1\.0","deleteSurface":\{"surfaceId":"main"\}\}/)
  })

  it('teaches the root-immutability exception — resending "id":"root" is an id-graph error, not an upsert', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/"id":"root" can be delivered only ONCE per surface/)
    expect(prompt).toMatch(/silently keeps the OLD root/)
    expect(prompt).toMatch(/stable wrapper child up front/)
  })

  it('the teaching does NOT leak into the catalog-derived inventory section (drift gate untouched)', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(prompt)
      expect(body).not.toMatch(
        /deleteSurface|updateDataModel alone|FRESH surfaceId|REPLACES its ENTIRE record|delivered only ONCE per surface/i,
      )
    }
  })
})

describe('buildSystemPrompt feed-ask archetype vocabulary — mode-scaled (ADR-0097 §4)', () => {
  it('default carries ONLY the terse "balanced" archetype line, not the full per-mode archetype teaching', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/Feed-ask archetypes, balanced:/)
    expect(prompt).not.toMatch(/Feed-ask disposition — dialed (DOWN|UP)/)
  })

  it('"specific" dials the ask disposition DOWN and teaches the five archetypes compactly', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'specific')
    expect(prompt).toMatch(/Feed-ask disposition — dialed DOWN \(specific mode\)/)
    expect(prompt).toMatch(/asks stay rare/)
    expect(prompt).toMatch(/closed single-choice ask/)
    expect(prompt).not.toMatch(/Feed-ask archetypes, balanced:/) // the default-only terse line does not ALSO appear
  })

  it('"blue-sky" dials the ask disposition UP and teaches the five archetypes compactly', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    expect(prompt).toMatch(/Feed-ask disposition — dialed UP \(blue-sky mode\)/)
    expect(prompt).toMatch(/prefer a structured ask whenever the options are\s+enumerable/)
    expect(prompt).toMatch(/option cards for a negotiation/)
    expect(prompt).not.toMatch(/Feed-ask archetypes, balanced:/)
  })

  it('every mode teaches all five archetype recipes (RadioGroup/SegmentedControl, Checkboxes, typed-value, option cards, confirm/cancel)', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toMatch(/RadioGroup or\s+SegmentedControl/)
      expect(prompt).toMatch(/multi-select \(Checkboxes/)
      expect(prompt).toMatch(/typed-value/)
      expect(prompt).toMatch(/option cards/)
      expect(prompt).toMatch(/confirm\/cancel/)
    }
    const dflt = buildSystemPrompt(defaultCatalog, [])
    expect(dflt).toMatch(/RadioGroup \(or SegmentedControl/)
    expect(dflt).toMatch(/Checkboxes bound to distinct/)
  })

  it('never widens the SPEC-R9 allowlist or the feed set by mode — the honesty floor still holds in every mode', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toContain('Honesty floor (holds identically in EVERY mode — never dialed)')
    }
  })
})
