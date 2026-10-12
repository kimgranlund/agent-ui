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
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { produce } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { MINI_SKILLS } from '../agent/mini-skills.ts'
import type { MiniSkill } from '../agent/mini-skills.ts'
import { FEED_SURFACE_TYPES } from '../agent/feed-catalog.ts'

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

  it('teaches the ADR-0198 amendment flow-completion protocol: terminal taxonomy, confirm-before-conclusion, courtesy close', () => {
    // A1 — every terminal path is named an ending (completion · escalation/early stop · abandonment).
    expect(prompt).toMatch(/EVERY ending of a multi-step ask flow gets a closing turn/)
    expect(prompt).toMatch(/Escalation \/ early stop/)
    expect(prompt).toMatch(/escalation prose turn IS the closing turn/)
    expect(prompt).toMatch(/Abandonment/)
    // A2 — the confirm stage is an ordinary ask; flowEnd strictly AFTER the user's confirm.
    expect(prompt).toMatch(/Confirm before concluding/)
    expect(prompt).toMatch(/"flowEnd" comes strictly AFTER the user's confirm/)
    // A3 — the five-part courtesy close.
    expect(prompt).toMatch(/courtesy close/)
    expect(prompt).toMatch(/what the user made happen/)
    expect(prompt).toMatch(/further questions, or session complete/)
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

// ── GH #1192, req-a2ui-patterns.md R2 / ADR-0198's 2026-08-18 amendment (B1/B2): the backable-multi-step
// carve-out on the answered-ask freeze, its worked mechanics in the surface-reuse rule, and the closing
// turn's one settle-update carve-out. Mode-invariant — all three land in the byte-pinned GRAMMAR constant. ──

describe('buildSystemPrompt backable multi-step wizard mechanics (ADR-0198 amendment B1/B2, req-a2ui-patterns.md R2)', () => {
  const prompt = buildSystemPrompt(defaultCatalog, [])

  it('B1 — the answered-ask freeze is scoped to FLOW END, not every mid-flow commit', () => {
    expect(prompt).toMatch(/This freeze begins at FLOW END, not at every mid-flow commit/)
    expect(prompt).toMatch(/a backable multi-step flow's Next\/Back turns\s+are scene transitions on the SAME still-open ask, not answered asks/)
    expect(prompt).toMatch(/starts only once the flow-final confirm is committed/)
  })

  it('B1 — the surface-reuse rule teaches the worked backable-wizard shape: one ask, root-once, /draft/* staging', () => {
    expect(prompt).toMatch(/Backable multi-step, worked:/)
    expect(prompt).toMatch(/keeps this reuse to ONE ask for the WHOLE\s+flow \(posture \(i\)\)/)
    expect(prompt).toMatch(/never\s+re-declare it per step/)
    expect(prompt).toMatch(/a "scene" container\)/)
    expect(prompt).toMatch(/"\/draft\/\*"\s+data-model prefix/)
    expect(prompt).toMatch(/nothing is committed anywhere\s+until the flow-final confirm/)
    expect(prompt).toMatch(/scene transitions on the one still-open ask, not answered asks/)
  })

  it('B2 — the closing turn may carry exactly ONE settle updateComponents (strip buttons + settled badge)', () => {
    expect(prompt).toMatch(/The closing turn's ONE exception to "no UI change"/)
    expect(prompt).toMatch(/MAY carry exactly one updateComponents against that SAME\s+confirmed receipt/)
    expect(prompt).toMatch(/strip its Back\/Confirm buttons and add a settled-status Badge/)
    expect(prompt).toMatch(/never on the escalation path/)
    expect(prompt).toMatch(/It fires at most once per flow; deleteSurface is\s+still never used on a confirmed receipt/)
  })

  it('B2 never widens "closing turn emits NO A2UI at all" into a blanket exception — it stays confined to the one settle update', () => {
    // the closing-turn mandate paragraph still states the base law; B2's carve-out is a SEPARATE,
    // narrowly-scoped sentence immediately after it, never a rewrite of the base rule itself.
    expect(prompt).toMatch(/declaring NO new ask and\s*\nemitting NO A2UI at all/)
    expect(prompt).toMatch(/never a fresh surface, never any other card/)
  })

  it('none of the B1/B2 prose leaks into the derived "## Available components" inventory section', () => {
    const marker = '## Available components'
    const start = prompt.indexOf(marker)
    const rest = prompt.slice(start + marker.length)
    const end = rest.indexOf('\n## ')
    const body = end === -1 ? rest : rest.slice(0, end)
    expect(body).not.toMatch(/backable|scene transitions|settle update|draft\/\*/i)
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
    expect(prompt).toMatch(/NEVER\s+also create any other surface in that same turn/)
    expect(prompt).toMatch(/at most\s+the one retire-update the surface-reuse rule below requires/)
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

// ── ADR-0174 cl.2/cl.6, SPEC-R20/SPEC-R6 AC6: the plan-arm mechanics teaching (mode-invariant) ───────────

describe('buildSystemPrompt plan-arm mechanics — mode-invariant (SPEC-R6 AC6 / ADR-0174 cl.2/cl.6)', () => {
  it('the mechanics block is present, byte-identical, in undefined/default/specific/blue-sky', () => {
    const dflt = buildSystemPrompt(defaultCatalog, [])
    const explicitUndefined = buildSystemPrompt(defaultCatalog, [], undefined)
    const explicitDefault = buildSystemPrompt(defaultCatalog, [], 'default')
    const specific = buildSystemPrompt(defaultCatalog, [], 'specific')
    const blueSky = buildSystemPrompt(defaultCatalog, [], 'blue-sky')
    const marker = 'Plan declarations:'
    for (const prompt of [dflt, explicitUndefined, explicitDefault, specific, blueSky]) expect(prompt).toContain(marker)

    // Extract the mechanics paragraph out of each composed prompt (blank-line-delimited, the SAME idiom
    // the feed-ask mechanics test above uses) and assert genuine byte-identity, not just marker presence.
    const mechanicsOf = (prompt: string): string => {
      const start = prompt.indexOf(marker)
      const rest = prompt.slice(start)
      const end = rest.indexOf('\n\n')
      return end === -1 ? rest : rest.slice(0, end)
    }
    const dfltMechanics = mechanicsOf(dflt)
    expect(dfltMechanics).toBe(mechanicsOf(explicitUndefined))
    expect(dfltMechanics).toBe(mechanicsOf(explicitDefault))
    expect(dfltMechanics).toBe(mechanicsOf(specific))
    expect(dfltMechanics).toBe(mechanicsOf(blueSky))
  })

  it("teaches the plan field's exact shape and its leading-meta-line placement", () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/SAME leading meta-line as your note/)
    expect(prompt).toMatch(/"plan":\{"steps":\[\{"id":"<step-id>",\s*"description":"<what this step does>"\}/)
    expect(prompt).toMatch(/"a2uiMeta":\{"note":"[^"]+","plan":\{"steps":\[\{"id":"step-1"/)
  })

  it('grammarFor(undefined) === the literal GRAMMAR constant still holds with the plan-arm addition (Decision §1)', () => {
    const twoArg = buildSystemPrompt(defaultCatalog, [])
    expect(buildSystemPrompt(defaultCatalog, [], undefined)).toBe(twoArg)
    expect(buildSystemPrompt(defaultCatalog, [], 'default')).toBe(twoArg)
  })

  it('none of the plan-arm prose leaks into the derived "## Available components" inventory section', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(prompt)
      expect(body).not.toMatch(/Plan declarations|"plan":\{"steps"/i)
    }
  })

  // ── v0.11 widening (ADR-0174 cl.4/cl.6, SPEC-R21): the SAME block additionally teaches the SYNTHESIS
  // turn's mechanics — procedural mechanics about what synthesis MEANS, never persona voice. Joins the
  // IDENTICAL "Plan declarations:" paragraph the plan-arm shape above lives in (the "SAME block" SPEC-R6
  // AC6 requires), so the mode-invariant byte-identity assertion above ALREADY covers this addition too
  // (its `mechanicsOf` extraction runs to the next blank line, which now includes the synthesis sentence).

  it('teaches the synthesis-turn procedural mechanics: compose from prior session context, never re-plan', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toContain('Synthesis turns:')
    expect(prompt).toMatch(/compose or finalize the\s+surface set from what the conversation already shows/)
    expect(prompt).toMatch(/do not restate the plan or lay out a new one/)
  })

  it('the synthesis-turn teaching is present, byte-identical, in every mode (mode-invariant, ADR-0174 cl.6)', () => {
    const marker = 'Synthesis turns:'
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toContain(marker)
    }
    const synthesisOf = (prompt: string): string => {
      const start = prompt.indexOf('Synthesis turns:')
      const rest = prompt.slice(start)
      const end = rest.indexOf('\n\n')
      return end === -1 ? rest : rest.slice(0, end)
    }
    const dflt = synthesisOf(buildSystemPrompt(defaultCatalog, []))
    expect(dflt).toBe(synthesisOf(buildSystemPrompt(defaultCatalog, [], 'specific')))
    expect(dflt).toBe(synthesisOf(buildSystemPrompt(defaultCatalog, [], 'blue-sky')))
  })

  it('none of the synthesis-turn prose leaks into the derived "## Available components" inventory section', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(prompt)
      expect(body).not.toMatch(/Synthesis turns/i)
    }
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
    expect(dflt).toMatch(/wrap Checkboxes \(bound to distinct data-model paths\) in a Column/)
  })

  // GH #1125 — the checkbox multi-select archetype used to say "Checkboxes ... plus a commit Button"
  // with no grouping container, unlike the RadioGroup archetype (RadioGroup IS itself a block-level
  // group). A model following ONLY the old prose had no instruction to block-wrap several Checkbox
  // siblings, so they (and the trailing Button) rendered as one inline-wrapped row ("row soup").
  // Every mode must now teach: wrap the Checkboxes in a Column, and place the commit Button as a
  // sibling AFTER that Column — never Row, never folded inside it.
  it('GH #1125 — every mode teaches the checkbox multi-select archetype as Column-wrapped, Button-after', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toMatch(/Checkboxes on\s+distinct data-model paths, wrapped in a\s*\n?\s*Column/)
      expect(prompt).toMatch(/commit Button its own sibling\s+placed AFTER the Column, never inline and\s+never inside it/)
    }
    const dflt = buildSystemPrompt(defaultCatalog, [])
    expect(dflt).toMatch(/wrap Checkboxes \(bound to distinct data-model paths\) in a Column/)
    expect(dflt).toMatch(/commit Button its own\s+sibling placed AFTER the Column, never inside it/)
  })

  // GH #1152 — GH #1141 landed `layout`/`label` on the DEFAULT catalog's Slider row, but the producer
  // prompts never taught when to use them: a model following ONLY the old typed-value prose ("Slider ...
  // for a bounded numeric") had no instruction to name the value or pick a layout that keeps it visible,
  // so a model-emitted bet-amount slider (the blackjack bet card) rendered bare — a rail with no label and
  // no at-rest readout. Every mode must now teach: a value-bearing Slider/SliderMulti question gets a
  // "label" naming the value (a short noun, e.g. "Bet amount") and "layout":"standard" so the value stays
  // visible at rest — "standard" over "inline" because a narrow feed-ask card can squeeze "inline"'s
  // single-row rail column down to near nothing (the same single-row-in-a-narrow-card risk the GH #1125
  // Checkbox rule above already guards against), whereas "standard" reserves the rail its own full-width
  // row regardless of container width.
  it('GH #1152 — every mode teaches the value-bearing Slider archetype as label+layout:"standard"', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toMatch(/Slider\/SliderMulti for a\s+bounded numeric with a "label" naming the value \(e\.g\. "Bet amount"\)\s+and "layout":"standard" so the value\s+stays visible at rest/)
    }
    const dflt = buildSystemPrompt(defaultCatalog, [])
    expect(dflt).toMatch(/Slider\/SliderMulti for a bounded numeric — give it a "label" naming the value in a\s+short noun \(e\.g\. "Bet amount", the blackjack bet card\) and "layout":"standard"/)
  })

  it('never widens the SPEC-R9 allowlist or the feed set by mode — the honesty floor still holds in every mode', () => {
    for (const mode of ['specific', 'blue-sky'] as const) {
      const prompt = buildSystemPrompt(defaultCatalog, [], mode)
      expect(prompt).toContain('Honesty floor (holds identically in EVERY mode — never dialed)')
    }
  })
})

// ── ADR-0178 cl.1/cl.3, SPEC-R30 AC2: the personaPatch teaching — GATED, host-owned, mode-invariant ──────
// Unlike the ask/plan mechanics above, this teaching is NOT inlined in the byte-pinned GRAMMAR constant:
// SPEC-R30 requires it compose only under the persona's own authoring gate, as a `genuiBlock`-shaped
// conditional segment, so every non-authoring caller's prompt stays byte-identical to before it existed.

describe('buildSystemPrompt personaPatch teaching — the authoring gate (SPEC-R30 AC2 / ADR-0178 cl.1/cl.3)', () => {
  const MARKER = 'Authoring an agent'
  const MODES = [undefined, 'default', 'specific', 'blue-sky'] as const

  it('gate ABSENT and gate FALSE both compose ZERO teaching bytes — byte-identical in every mode', () => {
    for (const mode of MODES) {
      const absent = buildSystemPrompt(defaultCatalog, [], mode)
      const off = buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, undefined, undefined, false)
      expect(absent).not.toContain(MARKER)
      expect(off).not.toContain(MARKER)
      expect(off).toBe(absent) // the degradation law: byte-identical to before this capability existed
    }
  })

  it('only an explicit boolean true composes the segment — the inverse-default posture, at the composition site too', () => {
    const on = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    const off = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, false)
    expect(on).toContain(MARKER)
    expect(off).not.toContain(MARKER)
    expect(on.length).toBeGreaterThan(off.length)
  })

  it('with the gate ON the segment is present and byte-identical in all four modes (wire mechanics are never mode-scaled)', () => {
    const segmentOf = (prompt: string): string => prompt.slice(prompt.indexOf(MARKER))
    const composed = MODES.map((mode) => buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, undefined, undefined, true))
    for (const prompt of composed) expect(prompt).toContain(MARKER)
    const first = segmentOf(composed[0]!)
    for (const prompt of composed.slice(1)) expect(segmentOf(prompt)).toBe(first)
  })

  it("teaches the personaPatch field's shape, its leading-meta-line placement, and both members", () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    expect(prompt).toMatch(/SAME leading meta-line as your note/)
    expect(prompt).toMatch(/"personaPatch":\{"values":\{/)
    expect(prompt).toMatch(/"personaPatch":\{"entries":\{/)
    expect(prompt).toMatch(/"a2uiMeta":\{"note":"[^"]+","personaPatch":\{"values":\{/)
  })

  // GH #804 — the EXEMPLAR is the shape the model copies. The worked skill example used to carry
  // label + description and NO "content", so every Builder-Interview-minted skill arrived with an empty
  // body: display-only in the pane, wire-inert at turn time, while the prose two paragraphs above warned
  // against exactly that. Both halves of the fix are pinned here — the example's own `content` body, and
  // the kind-general statement of the content-is-the-substance law — because prose alone did not hold.
  it('the worked SKILL example carries a real "content" body, and the substance law is stated KIND-GENERALLY (GH #804)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    const skillExample = prompt.split('\n').find((line) => line.includes('"entries:skill":'))
    expect(skillExample, 'the worked skill exemplar line must exist in the composed teaching').toBeDefined()
    // All three fields, each doing its distinct job — a label, a one-line summary, and a real behavior body
    // (length-floored so a token placeholder like "content":"…" cannot pass as substance).
    expect(skillExample).toMatch(/"label":"[^"]+"/)
    expect(skillExample).toMatch(/"description":"[^"]+"/)
    expect(skillExample).toMatch(/"content":"[^"]{120,}"/)
    // The exemplar stays copy-able verbatim: valid JSON, with the entry's content non-empty.
    const parsed = JSON.parse(skillExample!.trim()) as {
      a2uiMeta: { personaPatch: { entries: Record<string, Array<{ label: string; description?: string; content?: string }>> } }
    }
    const entry = parsed.a2uiMeta.personaPatch.entries['entries:skill']![0]!
    expect(entry.content?.trim().length ?? 0).toBeGreaterThan(0)
    // …and the law is taught for EVERY kind, not just prompt-sections (the generalization the bug needed).
    expect(prompt).toMatch(/KIND-GENERAL/)
    expect(prompt).toMatch(/EVERY list kind puts what it actually\n?\s*instructs in "content"/)
  })

  it('teaches the SPEC-R29 merge law the host actually applies — incremental, no restatement, no deletion', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    expect(prompt).toMatch(/INCREMENTAL/)
    expect(prompt).toMatch(/only what THIS turn established/)
    expect(prompt).toMatch(/ADDED to their list rather than replacing it/)
    expect(prompt).toMatch(/no way to delete anything with a patch/)
  })

  // ADR-0178's ratified amendment (GH #696, 2026-08-13) — the gate gained a scoped UPDATE verb, so the
  // teaching that pairs with it lands HERE, in the byte-pinned host-owned half: the generic MECHANICS of how
  // a replacement is expressed. WHICH ids are replaceable is the generated vocabulary section's job
  // (cl.1 rule 5's teaching split), which is why the assertions below are shape assertions, not id ones.
  it('teaches the UPDATE mechanics the gate now admits — in place, content-required, non-patchable fields named', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    expect(prompt).toMatch(/carrying the "id" of an existing BUILT-IN section/)
    expect(prompt).toMatch(/REPLACES that section's text in place instead of appending/)
    expect(prompt).toMatch(/keeping its name, its position, and\n?\s*its on\/off state/)
    // the no-deletion law, restated for the ONE shape that could have become a deletion
    expect(prompt).toMatch(/a replacement whose "content" is blank is refused/)
    // and the append protection the amendment deliberately did NOT widen
    expect(prompt).toMatch(/names an\n?\s*entry the person authored themselves, adds a new entry/)
  })

  it('the update teaching stays PERSONA-KEY-AGNOSTIC — no builtin id, no key name, reaches it (cl.1 rule 5)', () => {
    // The teaching is host-owned and byte-pinned; the ids and their purposes are GENERATED persona config
    // (`vocabularySection`). Naming a builtin id here would be a second, hand-maintained enumeration of the
    // seed — the exact drift class the generated section exists to prevent.
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    const updateParagraph = prompt.split('\n\n').find((p) => p.includes('BUILT-IN section'))
    expect(updateParagraph, 'the update-mechanics paragraph must exist').toBeDefined()
    for (const forbidden of ['foundation', 'personality', 'critical-items', 'Foundation', 'Personality', 'Critical Items', 'entries:prompt-section']) {
      expect(updateParagraph, `the mechanics must not name "${forbidden}" — that is the vocabulary's job`).not.toContain(forbidden)
    }
  })

  it('none of the teaching leaks into the catalog-derived inventory section', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, true)
    expect(catalogInventoryBody(prompt)).not.toContain('personaPatch')
  })

  it('the segment is orthogonal to the other composition axes — turning it on adds exactly its own bytes', () => {
    // The same delta regardless of `mode` or `a2uiEnabled`: it is neither grammar text nor catalog text.
    const delta = (mode: (typeof MODES)[number], a2uiEnabled: boolean): number => {
      const off = buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, undefined, a2uiEnabled, false)
      const on = buildSystemPrompt(defaultCatalog, [], mode, undefined, undefined, undefined, a2uiEnabled, true)
      return on.length - off.length
    }
    const baseline = delta(undefined, true)
    expect(baseline).toBeGreaterThan(0)
    for (const mode of MODES) {
      expect(delta(mode, true)).toBe(baseline)
      expect(delta(mode, false)).toBe(baseline)
    }
  })
})

// ── GH #1201, req-a2ui-patterns.md R3 (Kim ruling 2, 2026-08-17): the reserved greet-1 id class — the
// greet card's ONE grammar sentence. The greet-card TEACHING itself lives in the `greeting-card`
// mini-skill (ruling 1: grammar stays greeting-silent beyond this reserved-vocabulary sentence). ──

describe('buildSystemPrompt reserved greet-1 id class (GH #1201, req-a2ui-patterns.md R3)', () => {
  const prompt = buildSystemPrompt(defaultCatalog, [])

  it('names the reserved id class riding the ask field without being an ask', () => {
    expect(prompt).toMatch(/One reserved id class rides this same "ask" field without being an ask/)
    expect(prompt).toMatch(/\{"ask":\{"surfaceId":"greet-1"\}\}/)
    expect(prompt).toMatch(/starter-intent Buttons only, no commit button, no data model/)
  })

  it('exempts greet-1 from the ask-<n> counter AND the answered-ask freeze, reasoned as never-an-answered-ask (composes with B1 without widening it)', () => {
    expect(prompt).toMatch(/because a greet is never an answered ask/)
    expect(prompt).toMatch(/it consumes no "ask-<n>" id and the answered-ask freeze\s*\nbelow never applies to it/)
    // B1's own flow-end scoping is untouched — the greet exemption is a separate sentence, not a rewrite.
    expect(prompt).toMatch(/This freeze begins at FLOW END, not at every mid-flow commit/)
  })

  it('retires the greet buttons per the stale-affordance rule when a real task starts', () => {
    expect(prompt).toMatch(/retired per the\s*\nstale-affordance rule when a real task starts/)
  })

  it('the sentence stays greeting-silent beyond the reserved vocabulary — no greet-card anatomy teaching in GRAMMAR (that is the mini-skill\'s)', () => {
    expect(prompt).not.toMatch(/CardFooter with 2–4 Buttons/) // the mini-skill body's anatomy line
    expect(prompt).not.toMatch(/one greet per session/) // the mini-skill body's wall
  })

  it('none of the greet prose leaks into the derived "## Available components" inventory section', () => {
    const marker = '## Available components'
    const start = prompt.indexOf(marker)
    const rest = prompt.slice(start + marker.length)
    const end = rest.indexOf('\n## ')
    const body = end === -1 ? rest : rest.slice(0, end)
    expect(body).not.toMatch(/greet-1|greet card/i)
  })
})

// ── GH #1259 / ADR-0206 cl.3: the target-arm teaching (mode-invariant, the plan-arm pin pattern) ─────────

describe('buildSystemPrompt target-arm mechanics — mode-invariant (GH #1259 / ADR-0206 cl.3)', () => {
  it('the mechanics block is present, byte-identical, in undefined/default/specific/blue-sky', () => {
    const marker = 'Target declarations:'
    const mechanicsOf = (prompt: string): string => {
      const start = prompt.indexOf(marker)
      expect(start).toBeGreaterThan(-1)
      const rest = prompt.slice(start)
      const end = rest.indexOf('\n\n')
      return end === -1 ? rest : rest.slice(0, end)
    }
    const dflt = mechanicsOf(buildSystemPrompt(defaultCatalog, []))
    for (const mode of ['default', 'specific', 'blue-sky'] as const) {
      expect(mechanicsOf(buildSystemPrompt(defaultCatalog, [], mode))).toBe(dflt)
    }
  })

  it("teaches the target field's exact shape and its leading-meta-line placement", () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/"target":\{"surfaceId":"<that surface's id>"\}/)
    expect(prompt).toMatch(/"a2uiMeta":\{"note":"[^"]+","target":\{"surfaceId":"weather-1"\}\}/)
  })

  it('teaches the omission rule: fresh-surface and no-A2UI turns carry NO target — never a placeholder', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toMatch(/OMIT the\s+"target" field entirely/)
    expect(prompt).toMatch(/never invent a placeholder or guess/)
  })

  it('none of the target-arm prose leaks into the derived "## Available components" inventory section', () => {
    for (const mode of [undefined, 'default', 'specific', 'blue-sky'] as const) {
      const composed = buildSystemPrompt(defaultCatalog, [], mode)
      const body = catalogInventoryBody(composed)
      expect(body).not.toMatch(/Target declarations|"target":\{"surfaceId"/i)
    }
  })
})
