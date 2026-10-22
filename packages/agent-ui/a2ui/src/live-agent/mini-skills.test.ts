// mini-skills.test.ts — ADR-0091 §2/§3: the registry's per-module token budget + `selectMiniSkills`'s
// degrade-to-empty/top-cap selection. Deterministic, no live model (mirrors retrieve.test.ts's shape).
// Lives under `src/live-agent/` (not `tools/agent/`) — the vitest `packages` project only globs
// `src/**/*.test.ts` (vitest.config.ts), the SAME reason produce-loop.test.ts/system-prompt-grammar.test.ts
// exercise their `tools/agent/*.ts` subjects from here rather than co-located.

import { describe, it, expect } from 'vitest'
import { MINI_SKILLS, PER_MODULE_TOKEN_BUDGET, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../agent/mini-skills.ts'
import type { MiniSkill } from '../agent/mini-skills.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

// The same `chars / 4` estimate ADR-0091 itself uses to size GRAMMAR (~3857 chars ≈ ~964 tokens).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

describe('MINI_SKILLS registry — the per-module token budget (ADR-0091 §3)', () => {
  it('every registry entry has a unique, stable kebab id', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every registry entry\'s body is at or under the ~200-token indicative budget', () => {
    for (const skill of MINI_SKILLS) {
      const tokens = estimateTokens(skill.body)
      expect(tokens, `${skill.id} is ${tokens} tokens (budget ${PER_MODULE_TOKEN_BUDGET})`).toBeLessThanOrEqual(
        PER_MODULE_TOKEN_BUDGET,
      )
    }
  })

  it('seeds ADR-0090\'s five calibration examples as general-maturity idioms (Decision §1)', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toEqual(
      expect.arrayContaining(['card-game-sheet', 'settings-screen', 'dashboard-kpi-grid', 'login-form', 'master-detail-split']),
    )
  })

  it('seeds the ADR-0103 sixth module — `form-rhythm`, the Lane C form-provider teaching lane', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toContain('form-rhythm')
  })

  it('seeds the TKT-0077 game-UI trio — card-layout · game-table-chrome · game-hud', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['card-layout', 'game-table-chrome', 'game-hud']))
  })

  // GH #808 S4 (a2ui-container-vocabulary.spec.md SPEC-R8) — the tenth module, the taught tier for
  // R3's header + R4's row idiom + R5's container-type choice + R7's B1-B3 nesting rules.
  it('seeds the GH #808 S4 tenth module — `structured-container`', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toContain('structured-container')
  })

  // GH #1201 (req-a2ui-patterns R3, Kim ruling 2026-08-17) — the eleventh module: the persona-conditional
  // greet-card teaching lane (grammar stays greeting-silent except the one reserved greet-1 sentence).
  it('seeds the GH #1201 eleventh module — `greeting-card`', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toContain('greeting-card')
  })

  // GH #1355 (the 2026-08-18 preset-vs-catalog gap analysis) — three more modules, taking the registry
  // to fourteen: `crud-entry-list`, `table-toolbar-pagination`, `nested-record-editor`.
  it('seeds the GH #1355 twelfth-fourteenth modules — crud-entry-list · table-toolbar-pagination · nested-record-editor', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['crud-entry-list', 'table-toolbar-pagination', 'nested-record-editor']))
  })

  // T-0193: the OptionDeck starter-choice module, taking the registry to twenty-two.
  it('seeds the T-0193 twenty-second module — option-deck', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'option-deck')!
    expect(skill.catalogId).toBe('agent-ui')
    expect(skill.body).toMatch(/emit ONE OptionDeck/)
    expect(skill.body).toMatch(/2–8 entries/)
    expect(skill.body).toMatch(/Always set actionName/)
    expect(skill.body).toMatch(/never "random" \(reserved\)/)
    expect(skill.body).toMatch(/Not for a single confirm \(a Button\) or more than 8 options \(a Select\)/)
    for (const move of ['deal', 'check', 'call', 'bet', 'fold']) expect(skill.triggers.split(' '), move).not.toContain(move)
  })

  it('no registry body embeds A2UI JSONL (a pure-prose module needs only doc-review, ADR-0091 §4)', () => {
    for (const skill of MINI_SKILLS) {
      expect(skill.body).not.toMatch(/"version"\s*:\s*"v1\.0"/)
    }
  })

  // SPEC-R6 AC1 (`persona-catalog-composition.spec.md`, ADR-0172 cl.3) — every shipped module's
  // frontmatter carries the catalog whose vocabulary its body hardcodes.
  // GH #1377 (the commerce+hospitality genui-pack) — six more modules, taking the merged registry to
  // twenty (with the GH #1355 trio): `product-presentation` (flagship), `feature-collection`, `variant-picker`, `quantity`,
  // `media-grid`, `comparison-table`. The seventh idiom named at intake — feature-details (Drill+
  // DescriptionList) — is BLOCKED on PR #1364 minting the Drill/DrillPanel catalog rows and is not
  // taught here.
  it('seeds the GH #1377 fifteenth-twentieth modules — product-presentation · feature-collection · variant-picker · quantity · media-grid · comparison-table', () => {
    const ids = MINI_SKILLS.map((m) => m.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'product-presentation',
        'feature-collection',
        'variant-picker',
        'quantity',
        'media-grid',
        'comparison-table',
      ]),
    )
    expect(MINI_SKILLS).toHaveLength(24) // + option-deck (T-0193), + confirm-receipt (T-0195), + step-flow (T-0198)
  })

  it('SPEC-R6 AC1: every shipped module carries catalogId: \'agent-ui\' except the a2ui-basic dialect module', () => {
    expect(MINI_SKILLS).toHaveLength(24) // + option-deck (T-0193), + confirm-receipt (T-0195), + step-flow (T-0198)
    for (const skill of MINI_SKILLS) expect(skill.catalogId, skill.id).toBe(skill.id === 'basic-dialect' ? 'a2ui-basic' : 'agent-ui')
  })
})

describe('selectMiniSkills — TF-IDF top-cap selection over the registry (ADR-0091 §2)', () => {
  it('a query matching a registry entry\'s triggers returns it', () => {
    const result = selectMiniSkills('build me a settings screen with toggles', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('settings-screen')
  })

  it('a terse card-game intent selects the TKT-0077 trio together on a games catalog (the shared `deal` trigger core)', () => {
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)
    expect(ids.sort()).toEqual(['card-layout', 'game-hud', 'game-table-chrome'])
  })

  it('a query with no vocabulary overlap against the registry returns []', () => {
    expect(selectMiniSkills('zzz qqq xyz totally unrelated gibberish', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')).toEqual([])
  })

  it('a query matching multiple entries returns at most `cap`', () => {
    // "form" appears in login-form's triggers; broaden with terms shared across several entries too.
    const result = selectMiniSkills('a form with a save button and a submit action', MINI_SKILLS, 2, 'agent-ui')
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('never pads with a genuinely unrelated (zero-score) module to fill `cap`', () => {
    const registry: MiniSkill[] = [
      { id: 'a-match', triggers: 'login form password submit', body: 'x', catalogId: 'agent-ui' },
      { id: 'z-unrelated', triggers: 'completely different vocabulary entirely', body: 'y', catalogId: 'agent-ui' },
    ]
    const result = selectMiniSkills('login form password submit', registry, 5, 'agent-ui')
    expect(result.map((m) => m.id)).toEqual(['a-match']) // NOT padded with z-unrelated despite cap=5
  })

  it('degrades to [] when cap <= 0', () => {
    expect(selectMiniSkills('a settings screen', MINI_SKILLS, 0, 'agent-ui')).toEqual([])
    expect(selectMiniSkills('a settings screen', MINI_SKILLS, -1, 'agent-ui')).toEqual([])
  })

  it('degrades to [] over an empty registry', () => {
    expect(selectMiniSkills('anything at all', [], DEFAULT_MINI_SKILL_CAP, 'agent-ui')).toEqual([])
  })

  it('is deterministic across repeated calls over the same inputs', () => {
    const first = selectMiniSkills('a dashboard with kpi stats', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    const second = selectMiniSkills('a dashboard with kpi stats', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    expect(second).toEqual(first)
  })
})

// SPEC-R6 (`persona-catalog-composition.spec.md`, ADR-0172 cl.3) — the `catalogId` hard filter, applied
// BEFORE ranking (mirrors `corpus/retrieve.ts:47,63`'s own `meta.catalogId` filter).
describe('selectMiniSkills — SPEC-R6 catalogId scoping', () => {
  it('AC2: a catalogId outside agent-ui never receives an agent-ui module; a2ui-basic receives only basic-dialect', () => {
    expect(selectMiniSkills('build me a settings screen with toggles', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'a2ui-basic').map((m) => m.id)).toEqual(['basic-dialect'])
    expect(selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'a2ui-basic--croupier')).toEqual([])
  })

  it('ADR-0243 cl.3: a derived `<base>--<persona>` id selects the BASE mini-skills, plus the modules of its fragment\'s domain (T-0207)', () => {
    const base = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    expect(base.length).toBeGreaterThan(0)
    expect(selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--fixture-demo').map((m) => m.id)).toEqual(base)
    expect(base).not.toContain('game-table-chrome')
    expect(selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)).toContain('game-table-chrome')
  })

  it('T-0207: a plain agent-ui turn is never taught CardTable (game-table-chrome is scoped to the games domain)', () => {
    const filtered = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    expect(filtered).toContain('card-layout')
    expect(filtered).not.toContain('game-table-chrome')
  })

  it('the filter is a hard pre-rank scope, not a scoring signal — a mismatched entry never pads the result', () => {
    const registry: MiniSkill[] = [
      { id: 'in-scope', triggers: 'login form password submit', body: 'x', catalogId: 'agent-ui' },
      { id: 'out-of-scope', triggers: 'login form password submit', body: 'y', catalogId: 'a2ui-basic' },
    ]
    const result = selectMiniSkills('login form password submit', registry, 5, 'agent-ui')
    expect(result.map((m) => m.id)).toEqual(['in-scope'])
  })
})

describe('basic-dialect: the a2ui-basic teaching module (T-0077)', () => {
  it.each(['build a contact form with a send button', 'a booking flow with a date picker', 'show a list of results with an add button'])(
    'a2ui-basic turn %j selects the mini-skill, and an agent-ui turn never does',
    (intent) => {
      expect(selectMiniSkills(intent, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'a2ui-basic').map((m) => m.id)).toEqual(['basic-dialect'])
      expect(selectMiniSkills(intent, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)).not.toContain('basic-dialect')
    },
  )
  it('a derived a2ui-basic--<persona> turn inherits basic-dialect from its base (ADR-0243 cl.3)', () => {
    const intent = 'build a contact form with a send button'
    expect(selectMiniSkills(intent, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'a2ui-basic--croupier').map((m) => m.id)).toEqual(['basic-dialect'])
  })
  it('carries the three dialect rules the basic seeds used to hold in a header comment', () => {
    const body = MINI_SKILLS.find((m) => m.id === 'basic-dialect')!.body
    expect(body).toMatch(/child Text/)
    expect(body).toMatch(/event/)
    expect(body).toMatch(/string ARRAY/)
  })
})

describe('form-rhythm — the ADR-0103 Lane C form-provider teaching module', () => {
  it('fires on a form-shaped USER intent (checkout)', () => {
    const result = selectMiniSkills('build a checkout form with billing fields', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('form-rhythm')
  })

  it('fires on another form-shaped USER intent (survey)', () => {
    const result = selectMiniSkills('a short survey with a few input fields', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('form-rhythm')
  })

  it('does NOT fire on an unrelated intent sharing no idiom vocabulary', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('form-rhythm')
  })

  it('teaches the Column-gap wrap idiom — FormProvider stays layout-free (ADR-0103 §Decision cl.4)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'form-rhythm')!
    expect(skill.body).toMatch(/FormProvider declares zero layout/)
    expect(skill.body).toMatch(/Column gap='md'/)
    expect(skill.body).toMatch(/one Field per control/)
    expect(skill.body).toMatch(/submit Button\s+rides inside the FormProvider/)
  })

  // GH #902 (escalated from #888/#901's Findings) — a bare TextField.label is catalog-legal (declared
  // bindable) but renders NO visible text: ADR-0051's bare-usage contract routes it to the editor's
  // aria-label only. Visible labels come from wrapping the control in its own Field (the exemplar:
  // generative-form.ts's `f_name`(Field,label='Full name')+`in_name`(TextField) pair, ADR-0051 seam).
  it('GH #902 — fires on a label-specific USER intent (visible labels on form fields)', () => {
    const result = selectMiniSkills('a form where every field has a visible label', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('form-rhythm')
  })

  it('GH #902 — teaches the Field-wrap idiom for visible labels, never a bare control label prop', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'form-rhythm')!
    expect(skill.body).toMatch(/Visible labels come from Field, never from a bare control/)
    expect(skill.body).toMatch(/TextField\/Select\/ComboBox\/MultiSelect\/Slider never paint an on-screen label/)
    expect(skill.body).toMatch(/aria-only or absent, ADR-0051/)
    expect(skill.body).toMatch(/set label on the wrapping Field instead/)
  })

  it('GH #902 — the exempted pair still names Checkbox\\/Switch as already-visible (no Field required for label visibility)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'form-rhythm')!
    expect(skill.body).toMatch(/Checkbox\/Switch's own label IS already visible \(slotted text\)/)
  })
})

// GH #808 S4 (a2ui-container-vocabulary.spec.md SPEC-R8) — the structured-container taught tier:
// the header+row recipe (R3/R4), the section/plain-card/structured-container choice rule (R5), and
// B1-B3 nesting (R7). AC1: a summary/booking-intent probe selects the module. R8's own named risk
// ("Trigger overlap") requires a selection test against `card-layout`'s shared "card" vocabulary.
describe('structured-container — the SPEC-R8 taught tier (a2ui-container-vocabulary.spec.md)', () => {
  it('AC1 — a summary/booking-intent probe selects the module', () => {
    const result = selectMiniSkills(
      'a trip itinerary status panel with a booking confirmation',
      MINI_SKILLS,
      DEFAULT_MINI_SKILL_CAP,
      'agent-ui',
    )
    expect(result.map((m) => m.id)).toContain('structured-container')
  })

  // T-0313 (round 5 :106): its booking words framed this hand-built Card on the Haiku confirm turn, against the
  // BookingConfirmation check; a booking confirm is the BookingConfirmation's moment, so the triggers carry no booking words.
  it('T-0313: a booking confirm turn never selects it; a trip summary turn still does', () => {
    for (const turn of ['Those details are right, please confirm the booking.', 'Yes, confirm the reservation.', 'Show me the booking confirmation.']) {
      expect(selectMiniSkills(turn, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--hospitality').map((m) => m.id), turn).not.toContain('structured-container')
    }
    expect(selectMiniSkills('a summary card for the trip', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)).toContain('structured-container')
  })

  it('does NOT fire on a playing-card intent (card-layout\'s own vocabulary)', () => {
    const result = selectMiniSkills('deal me a card game hand', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('structured-container')
  })

  it('does NOT fire on an unrelated intent sharing no idiom vocabulary', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('structured-container')
  })

  // R8's named risk ("Trigger overlap") — both modules' triggers share the bare word "card" (the
  // collision named in the SPEC, disambiguated by each body's first line). Forcing cap=1 proves the
  // TF-IDF ranking resolves the shared term correctly in BOTH directions rather than merely
  // co-selecting both modules within a wider cap.
  it('trigger-overlap check — a booking/summary+"card" query resolves to structured-container over card-layout (cap=1)', () => {
    const result = selectMiniSkills('a summary card for the trip', MINI_SKILLS, 1, 'agent-ui')
    expect(result.map((m) => m.id)).toEqual(['structured-container'])
  })

  it('trigger-overlap check — a playing-card "deal" query resolves to card-layout over structured-container (cap=1)', () => {
    const result = selectMiniSkills('deal me a card game hand', MINI_SKILLS, 1, 'agent-ui')
    expect(result.map((m) => m.id)).toEqual(['card-layout'])
  })

  it('the trio (card-layout, game-hud, game-table-chrome) still selects together on a terse "deal" intent — structured-container never leaks in', () => {
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)
    expect(ids.sort()).toEqual(['card-layout', 'game-hud', 'game-table-chrome'])
  })

  it('the body disambiguates from a playing card in its first line (Lane C fallback readability)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/^A structured container \(not a playing card\)/)
  })

  it('teaches the R5 container-type choice rule (section · plain card · structured container)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/section = Column/)
    expect(skill.body).toMatch(/plain card = Card/)
    expect(skill.body).toMatch(/structured = Card.*CardHeader\(format:'structured'\)/)
  })

  it("teaches R3's header anatomy (leading Icon slot, trailing Badge slot bound for live status)", () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/Icon\(slot:'leading'\)/)
    expect(skill.body).toMatch(/Badge\(slot:'trailing', intent bound for live status\)/)
  })

  it("teaches R4's label/value row idiom", () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/Row\(justify:'between', align:'center'\)/)
    expect(skill.body).toMatch(/Badge\(intent:'neutral', label bound\)/)
  })

  // R7's B1-B3 nesting rules, taught verbatim in the module (SPEC-R7's own AC).
  it('teaches B1-B3 nesting rules verbatim', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/one card level per bubble, never Card-in-Card/) // B1
    expect(skill.body).toMatch(/CardContent takes rows\/sections only, no headered Card/) // B2
    expect(skill.body).toMatch(/CardHeader first, CardFooter last/) // B2
    expect(skill.body).toMatch(/page-scale containers stay out of bubbles/) // B3
  })

  // R4 §7 fork row — the ADR-0078 cl.5 amendment is still `proposed` (unratified) at build time, so
  // ADR-0078's label amendment RATIFIED 2026-08-13 (GH #808 / #827): the taught idiom now teaches the
  // real `label` role; the interim caption wall is gone (the SPEC §7 fork row's booked upgrade).
  it("R4 §7 fork — teaches `label` (ADR-0078's amendment ratified 2026-08-13), the caption wall retired", () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'structured-container')!
    expect(skill.body).toMatch(/Text\(variant:'label'\)/)
    expect(skill.body).not.toMatch(/Text\(variant:'caption'\)/)
    expect(skill.body).not.toMatch(/Wall: caption stands in/)
  })
})

// GH #1201 (req-a2ui-patterns R3, Kim rulings 2026-08-17) — the greeting-card module: the greet-card
// bookend's persona-conditional home is THIS mini-skill (ruling 1: grammar stays greeting-silent
// beyond the one reserved-vocabulary sentence); feed placement rides the ask mechanism under the
// reserved exempt id `greet-1` (ruling 2: never an ask-<n> id, never the answered-ask freeze).
describe('greeting-card — the GH #1201 persona-conditional greet-bookend module', () => {
  it('fires on a fresh-session greeting intent (hello / who are you)', () => {
    const result = selectMiniSkills('hello, who are you and what can you do?', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('greeting-card')
  })

  it('does NOT fire on a task-shaped intent sharing no greeting vocabulary', () => {
    const result = selectMiniSkills('build a checkout form with billing fields', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('greeting-card')
  })

  it('the "deal me in" trio selection is untouched — greeting-card never leaks into it', () => {
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)
    expect(ids.sort()).toEqual(['card-layout', 'game-hud', 'game-table-chrome'])
  })

  it('is persona-conditional in its own first line — first turn only, only when the persona greets', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/first turn only, when your persona opens the session with a greeting/)
  })

  it('teaches the greet-card anatomy (one OptionDeck whose options carry concrete starter intents)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    // T-0172 (Kim's ruling, 2026-10-14): never a Card around a Button. T-0193 (Kim, 2026-10-14): the card itself is
    // the choice, so the starters are one OptionDeck forwarding `start`, not a Row of Buttons.
    expect(skill.body).toMatch(/one OptionDeck \(heading a short prompt\) of 2–4 starter cards with actionName "start"/)
    expect(skill.body).toMatch(/each option's value naming a concrete starter intent/)
    expect(skill.body).toMatch(/never a Row of Buttons and never a Card around a Button/)
    expect(skill.body).not.toMatch(/CardFooter/)
  })

  it('teaches the reserved exempt id class — greet-1 rides the ask field but is NOT an ask (ruling 2)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/reserved id "greet-1"/)
    expect(skill.body).toMatch(/NOT an ask: no commit button, no data model/)
    expect(skill.body).toMatch(/no ask-<n> id consumed, no answered-ask freeze/)
  })

  it('teaches the stale-affordance retirement (a task start retires the greet cards same turn)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/retire the greet cards per the stale-affordance rule that same turn/)
  })

  // The composition proof for an opted-in persona: a greeting persona's first turn selects the module
  // and buildSystemPrompt composes its body into the mini-skill block, AFTER which the persona section
  // rides (ADR-0138 — persona governs voice, wire rules stay authoritative).
  it('composes into buildSystemPrompt for an opted-in persona (selection → mini-skill block + persona tail)', () => {
    const personaSystem = 'You are the concierge for Hotel Aurora. Open every fresh session with a short greeting.'
    const selected = selectMiniSkills('hello, who are you and what can you do?', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, selected, personaSystem)
    const greet = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(prompt).toContain(greet.body)
    expect(prompt).toContain(personaSystem)
  })

  it('a persona that does NOT greet composes a prompt with zero greeting-card bytes (opt-in, not default)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, [], 'You are a terse build assistant.')
    const greet = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(prompt).not.toContain(greet.body)
  })
})

// GH #1355 (the 2026-08-18 preset-vs-catalog gap analysis) — three modules teaching compositions the
// catalog can already express but no idiom named.
describe('crud-entry-list — the GH #1355 CRUD entry-list module', () => {
  it('fires on a manage-items intent', () => {
    const result = selectMiniSkills('let me manage my skills — enable, edit, or remove each one', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('crud-entry-list')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('crud-entry-list')
  })

  // The Field-wrap teaching is the REPAIRED shape from the seed's first judged pass (qualityScore 2,
  // failing D1 on P7): Switch.label is not bindable, and a merely-adjacent Text never programmatically
  // NAMES the switch — Field's bindable label is the catalog-available fix (the ADR-0051 seam).
  it('teaches the Field-wrap repair for the unbindable Switch.label (P7 — a sibling Text never names the switch)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'crud-entry-list')!
    expect(skill.body).toMatch(/Switch's own `label` is NOT bindable/)
    expect(skill.body).toMatch(/a sibling Text never NAMES the switch for assistive tech/)
    expect(skill.body).toMatch(/Field's bindable label does both jobs/)
  })

  it('teaches the edit-Drawer-beside-the-Card + FormProvider shape and the Button-rows-in-Menu add-from-library idiom', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'crud-entry-list')!
    expect(skill.body).toMatch(/Drawer\(edge 'end', open bound\) BESIDE the Card, never inside CardContent/)
    expect(skill.body).toMatch(/a Menu whose rows are BUTTONS/)
    expect(skill.body).toMatch(/never bare MenuItem, which has no `action` slot/)
  })
})

describe('table-toolbar-pagination — the GH #1355 Table/Toolbar/Pagination interplay module', () => {
  it('fires on a searchable/sortable table intent', () => {
    const result = selectMiniSkills('a searchable, sortable table of results with paging', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('table-toolbar-pagination')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('build a checkout form with billing fields', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('table-toolbar-pagination')
  })

  it('teaches the no-redundant-second-pager rule for a Table already windowing itself', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'table-toolbar-pagination')!
    expect(skill.body).toMatch(/never add a separate Pagination node bound to that same table's page/)
  })

  it('teaches Table owning search\\/sort\\/filter\\/page\\/pageSize as its own bindable props', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'table-toolbar-pagination')!
    expect(skill.body).toMatch(/Table owns `search`\/`sort`\/`filter`\/`page`\/`pageSize` as its OWN bindable props/)
  })
})

describe('nested-record-editor — the GH #1355 parent-record + member-sub-list module (the team-pane shape)', () => {
  it('fires on a team-roster intent', () => {
    const result = selectMiniSkills('manage my team — add or remove members and assign each a role', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('nested-record-editor')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('nested-record-editor')
  })

  it('distinguishes itself from master-detail-split and crud-entry-list in its own body', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'nested-record-editor')!
    expect(skill.body).toMatch(/Distinct from master-detail-split/)
    expect(skill.body).toMatch(/the flat CRUD entry-list/)
  })
})

// GH #1377 (the commerce+hospitality genui-pack) — six modules teaching product-presentation,
// feature-collection, variant-picker, quantity, media-grid, and comparison-table composed idioms.
describe('product-presentation — the GH #1377 flagship product/listing card module', () => {
  it('fires on a product-card-with-price intent', () => {
    const result = selectMiniSkills('show this as a product card with its price, a sale badge, and a rating', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('product-presentation')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('product-presentation')
  })

  // ADR-0243 (T-0072): the hand-built Card+Image+Stat+Badge composition is replaced by the ProductCard type.
  it('teaches ONE ProductCard (never the hand-built Card+Image+Stat+Badge parts) and the omit-what-you-lack exhibit rule', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'product-presentation')!
    expect(skill.body).toMatch(/is ONE ProductCard: title, subtitle, image/)
    expect(skill.body).toMatch(/Never rebuild it from Card, Image, Stat, Badge and Button/)
    expect(skill.body).toMatch(/no price and no action is an exhibit tile/)
    expect(skill.body, 'the old hand composition is gone').not.toMatch(/hero Image/)
  })
})

describe('feature-collection — the GH #1377 DescriptionList-vs-Table module', () => {
  it('fires on a compare-specs intent', () => {
    const result = selectMiniSkills('compare the specs and features of these three items in a table', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('feature-collection')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('deal me in for a hand of blackjack', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('feature-collection')
  })

  it('teaches the one-entity-DescriptionList vs many-entities-Table split, and routes comparison-table away', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'feature-collection')!
    expect(skill.body).toMatch(/ONE entity's own spec sheet .* is a DescriptionList/)
    expect(skill.body).toMatch(/Comparing the SAME facts across MULTIPLE entities is a Table/)
    expect(skill.body).toMatch(/See comparison-table for the higher-order/)
  })
})

describe('variant-picker — the GH #1377 SegmentedControl-vs-Select module', () => {
  it('fires on a pick-a-variant intent', () => {
    const result = selectMiniSkills('let me pick the size and color variant before buying', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('variant-picker')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('variant-picker')
  })

  it('teaches the ≤3-short-label SegmentedControl vs Select routing split', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'variant-picker')!
    expect(skill.body).toMatch(/≤3 members with short \(≤5-char\) labels in a single row → SegmentedControl/)
    expect(skill.body).toMatch(/More members, or labels too long for one row → Select/)
  })
})

describe('quantity: the AmountPicker module (GH #1377, T-0196)', () => {
  it('fires on a set-the-quantity intent', () => {
    const result = selectMiniSkills('how many units do I want to buy — let me set the quantity', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('quantity')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('quantity')
  })

  it('teaches ONE AmountPicker for a bounded amount, slider only on large ranges, and TextField type:number for a free-typed number', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'quantity')!
    expect(skill.body).toMatch(/A bounded quantity or amount is ONE AmountPicker/)
    expect(skill.body).toMatch(/`slider` only for a range over about 20 steps[^.]*never for a small count/)
    expect(skill.body).toMatch(/set `actionName`[^;]*add no sibling commit Button/)
    expect(skill.body).toMatch(/free-typed number with no bounds stays a Field-wrapped TextField `type:'number'`/)
    expect(skill.body).not.toMatch(/fleet gap|Stepper control/)
  })
})

describe('media-grid — the GH #1377 Grid-of-Image photo gallery module', () => {
  it('fires on a photo-gallery intent', () => {
    const result = selectMiniSkills('show a gallery of photos from the listing', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('media-grid')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('deal me in for a hand of blackjack', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('media-grid')
  })

  it('distinguishes itself from media-file-grid\'s Attachment-tile idiom in its own body', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'media-grid')!
    expect(skill.body).toMatch(/Distinct from media-file-grid's Attachment-tile idiom/)
  })
})

describe('comparison-table: the OptionCompare pick plus the GH #1377 facts-only Stat-tiles-plus-Table module (T-0393)', () => {
  it('fires on a compare-pricing-plans intent', () => {
    const result = selectMiniSkills('compare pricing plans side by side', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('comparison-table')
  })

  it('does NOT fire on an unrelated intent', () => {
    const result = selectMiniSkills('show me the weather forecast for tomorrow', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).not.toContain('comparison-table')
  })

  it('teaches ONE OptionCompare for a pick and Stat tiles above one Table for a facts-only comparison (T-0393)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'comparison-table')!
    expect(skill.body).toMatch(/a Grid of headline Stat tiles .* ABOVE one shared Table/)
    expect(skill.body).toMatch(/is ONE OptionCompare, never a Table with a Button per row/)
  })
})

// GH #1795 (Croupier on Haiku, Card-body padding half). The ADR-0056 region-less padding fallback does NOT
// fire for a Card with a region child PLUS loose siblings, by contract: card.css's `:not(:has(...))` leg,
// card.md "Mixed composition gets no fallback", and the negative control in card.browser.test.ts (the mixed
// card, "mixed composition wrongly got the fallback padding", expects padding 0). So a model that emits
// CardContent next to a bare Row renders an unpadded body, and ADR-0056 rules that documented, not repaired.
// The owning layer is the teaching: card-layout is the one game module that taught a hand Row with no home
// inside the table Card.
describe('card-layout: the GH #1795 Card-body padding teaching (ADR-0056 mixed composition)', () => {
  it('fires on the Croupier blackjack intent', () => {
    const result = selectMiniSkills('Deal a round of Blackjack.', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('card-layout')
  })

  it('teaches the hand Row rides INSIDE CardContent, never as a loose sibling beside a region (loose renders unpadded)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'card-layout')!
    expect(skill.body).toMatch(/inside CardContent/)
    expect(skill.body).toMatch(/never loose beside a region/)
    expect(skill.body).toMatch(/unpadded/)
  })

  it('stays within the per-module token budget with the added sentence (no trimming of the PlayingCard teaching)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'card-layout')!
    expect(estimateTokens(skill.body)).toBeLessThanOrEqual(PER_MODULE_TOKEN_BUDGET)
    expect(skill.body).toMatch(/PlayingCard \(rank\/suit enums, faceDown boolean\)/)
  })
})

// GH #1795 (T-0016, hand-consistency half). The live Croupier listed three dealer cards (6, 5, 3 = 14)
// while its own readout said "Dealer: 14, draws to 17": static card components and a free-text total
// can drift apart. The teaching now makes the hand DATA (one list per hand, drawn by one templated Row) and
// the total a value computed from that list, so the cards shown and the total stated share one source.
// The runtime backstop is the ADR-0238 croupier hand check (`catalog/personas/croupier/checks.ts`).
describe('card-layout + game-table-chrome: the data-driven hand and computed total (GH #1795, T-0016)', () => {
  const body = (id: string): string => MINI_SKILLS.find((m) => m.id === id)!.body

  it('card-layout teaches each hand as a data-model list drawn by one templated Row, never a static card per component', () => {
    expect(body('card-layout')).toMatch(/A hand is DATA: an array at \/dealerHand or \/playerHand/)
    expect(body('card-layout')).toMatch(/"children":\{"path":"\/dealerHand","componentId":"dealerCard"\}/)
    expect(body('card-layout')).toMatch(/never one static component per card/)
    expect(body('card-layout')).toMatch(/A draw appends to the array/)
  })

  it('card-layout teaches computing each total from the listed cards, with the blackjack values, at a bound path', () => {
    expect(body('card-layout')).toMatch(/Compute each total from the cards you list \(A = 1 or 11, J\/Q\/K = 10\)/)
    expect(body('card-layout')).toMatch(/write it at \/dealerTotal or \/playerTotal/)
  })

  it('game-table-chrome binds each zone total and keeps the readout to the total only', () => {
    expect(body('game-table-chrome')).toMatch(/bound to \/dealerTotal or \/playerTotal and stating the total only/)
  })

  it('both modules stay within the per-module token budget and still fire together on a blackjack deal', () => {
    for (const id of ['card-layout', 'game-table-chrome']) expect(estimateTokens(body(id)), id).toBeLessThanOrEqual(PER_MODULE_TOKEN_BUDGET)
    const ids = selectMiniSkills('Deal a round of Blackjack.', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['card-layout', 'game-table-chrome']))
  })
})

// T-0019 (defect 4): status badges and tags ride the CardHeader's own trailing slot (the header grid's
// `1fr auto` cell), not a Row under the title and not a line in CardContent. The wire shape is a Badge with
// `slot: "trailing"` as a direct CardHeader child (Badge's catalog `slot` prop, card.css's `:has()` anatomy).
describe('game-table-chrome + game-hud: status badges ride the CardHeader trailing slot (T-0019)', () => {
  const body = (id: string): string => MINI_SKILLS.find((m) => m.id === id)!.body

  it('game-table-chrome seats ONE Badge with slot "trailing" in the CardHeader and bans the Row wrapper and CardContent placement', () => {
    expect(body('game-table-chrome')).toMatch(/ONE status Badge \(bankroll, bet or round\) with slot "trailing", both direct children/)
    expect(body('game-table-chrome')).toMatch(/Never wrap them in a Row, never put status Badges in CardContent/)
    expect(body('game-table-chrome'), 'the old Row-of-Badges header is gone').not.toMatch(/CardHeader = Row/)
  })

  it('game-hud teaches ONE GameHud for a standalone status strip (ADR-0243, T-0072)', () => {
    expect(body('game-hud')).toMatch(/is ONE GameHud: title, status \+ statusIntent, stats \[\{label, value, delta, intent\}\]/)
    expect(body('game-hud')).toMatch(/progress \{value, max, label\}/)
  })

  it('game-hud puts the bankroll Badge and a zone-Card score Badge in the trailing slot', () => {
    expect(body('game-hud')).toMatch(/Bankroll\/chips = a Badge \(label bound to the data model\) with slot "trailing" in the table CardHeader/)
    expect(body('game-hud')).toMatch(/\(slot "trailing" when the zone is its own Card\)/)
  })
})

// T-0073 (ADR-0243): the Croupier fragment ships the CardTable composite, so both game modules teach it
// first, conditioned on the catalog having it: an `agent-ui` module also fires on a plain `agent-ui` turn,
// where CardTable is absent and the PlayingCard/Card frame teaching still applies.
describe('card-layout + game-table-chrome: the CardTable teaching (ADR-0243, T-0073)', () => {
  const body = (id: string): string => MINI_SKILLS.find((m) => m.id === id)!.body

  it('card-layout binds both CardTable hands to their data-model lists', () => {
    expect(body('card-layout')).toMatch(/If the catalog has CardTable, it draws both hands/)
    expect(body('card-layout')).toContain('"dealerHand":{"path":"/dealerHand"}')
    expect(body('card-layout')).toContain('"playerHand":{"path":"/playerHand"}')
  })

  it('game-table-chrome makes ONE CardTable the table, with the action Buttons as its children', () => {
    expect(body('game-table-chrome')).toMatch(/ONE CardTable is the table/)
    expect(body('game-table-chrome')).toMatch(/the action Buttons as its children/)
  })

  it('both modules fire on a Croupier blackjack turn (ADR-0243 cl.3, base-segment match)', () => {
    const ids = selectMiniSkills('Deal a round of Blackjack.', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier').map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['card-layout', 'game-table-chrome']))
  })
})

// T-0323 (round 8 cluster E, Kim's ruling): the CardTable is the blackjack family's table and poker keeps a Card.
// Haiku 5.5 read the unscoped "If the catalog has CardTable" on a five-card draw turn and opened a CardTable.
describe('card-layout + game-table-chrome: the CardTable is blackjack only, poker keeps a Card (T-0323)', () => {
  const body = (id: string): string => MINI_SKILLS.find((m) => m.id === id)!.body

  it('game-table-chrome scopes the CardTable to blackjack and seats poker on ONE Card', () => {
    expect(body('game-table-chrome')).toMatch(/^In blackjack, if the catalog has CardTable, ONE CardTable is the table:/)
    expect(body('game-table-chrome')).toMatch(/Otherwise, poker too, ONE Card is the table\./)
  })

  it('card-layout draws CardTable hands in blackjack only; every other hand is PlayingCard items', () => {
    expect(body('card-layout')).toMatch(/If the catalog has CardTable, it draws both hands in blackjack:/)
    expect(body('card-layout')).toMatch(/Otherwise each card is a PlayingCard/)
  })

  it('both re-cut modules stay within the per-module token budget', () => {
    for (const id of ['card-layout', 'game-table-chrome']) expect(estimateTokens(body(id)), id).toBeLessThanOrEqual(PER_MODULE_TOKEN_BUDGET)
  })
})

// T-0202 (catalog architecture CA-R4): a module that names a domain type declares the domain in its frontmatter and
// is selected only when the effective catalog holds it (T-0207: a persona catalog holds its fragment's domain). The
// scope is proven on a seeded module; game-table-chrome is the one shipped module retagged (T-0207).
describe('mini-skill domain scope (T-0202, CA-R4 AC2)', () => {
  const seeded: MiniSkill = { id: 'board-moment', triggers: 'board game grid cells move', body: 'Use BoardGrid.', catalogId: 'agent-ui', domain: 'games' }
  const plain: MiniSkill = { id: 'plain-grid', triggers: 'board game grid cells move', body: 'Use Grid.', catalogId: 'agent-ui' }
  const pick = (catalogId: string): string[] => selectMiniSkills('show the board game grid', [seeded, plain], 3, catalogId).map((m) => m.id)

  it('a plain base turn never selects the domain-scoped module', () => {
    expect(pick('agent-ui')).toEqual(['plain-grid'])
    expect(pick('agent-ui--stylist'), 'the stylist fragment selects design, not games').toEqual(['plain-grid'])
    expect(pick('agent-ui--design')).toEqual(['plain-grid'])
    expect(pick('agent-ui--croupier').sort(), 'T-0207: the croupier fragment selects games').toEqual(['board-moment', 'plain-grid'])
  })

  it('a turn whose effective catalog holds the domain selects it, alone or among others', () => {
    expect(pick('agent-ui--games').sort()).toEqual(['board-moment', 'plain-grid'])
    expect(pick('agent-ui--design+games').sort()).toEqual(['board-moment', 'plain-grid'])
    expect(pick('agent-ui--games+design'), 'a non-canonical id holds no domain').toEqual(['plain-grid'])
  })

  it('T-0207 retags game-table-chrome alone (it names CardTable), so only games turns select it', () => {
    expect(MINI_SKILLS.filter((m) => m.domain !== undefined).map((m) => [m.id, m.domain])).toEqual([['game-table-chrome', 'games']])
  })
})

// T-0209: ranking stability. `selectMiniSkills` is TF-IDF top 3 with an id tiebreak, so a new module with generic
// triggers can silently push an established idiom out of a turn's top 3 (IDF shifts too as the registry grows).
// These pins hold the ordered top 3 for a set of intents over the FULL live registry; a registry change that moves
// one reds here and is re-pinned only on purpose. The negative control plants a generic-trigger module into a copy
// and runs the same predicate.
describe('selectMiniSkills: ranking stability over the full registry (T-0209)', () => {
  const PINS: readonly (readonly [intent: string, top: readonly string[]])[] = [
    ['Build me a settings screen with toggles for notifications and account preferences', ['settings-screen', 'login-form']],
    ['Show a sales dashboard with KPI stats and a revenue chart', ['dashboard-kpi-grid']],
    ['A login form with email and password', ['login-form', 'form-rhythm']],
    ['An inbox with a list of messages and a detail pane', ['master-detail-split', 'feature-collection', 'crud-entry-list']],
    ['A data table with search, sort and pagination toolbar', ['table-toolbar-pagination', 'master-detail-split', 'feature-collection']],
    ['Compare three pricing plans side by side', ['comparison-table', 'feature-collection']],
    ['Show a photo gallery grid', ['media-grid', 'dashboard-kpi-grid', 'table-toolbar-pagination']],
    ['A card game with my hand and a discard pile', ['card-game-sheet', 'card-layout', 'structured-container']],
    ['Edit a team record and its members', ['nested-record-editor', 'crud-entry-list']],
  ]

  /** Each pin whose ordered top 3 over `registry` differs, as `intent: expected -> got`. */
  function rankingDefects(registry: readonly MiniSkill[]): string[] {
    return PINS.flatMap(([intent, top]) => {
      const got = selectMiniSkills(intent, registry, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
      return got.join(',') === top.join(',') ? [] : [`${intent}: ${top.join(',')} -> ${got.join(',')}`]
    })
  }

  it('every pinned intent keeps its ordered top 3', () => {
    expect(rankingDefects(MINI_SKILLS)).toEqual([])
  })

  it('NEGATIVE CONTROL: a seeded generic-trigger module displaces a pinned idiom and reds the predicate', () => {
    const generic: MiniSkill = {
      id: 'aa-generic-screen',
      triggers: 'screen form list grid card table dashboard settings detail edit record game show build',
      body: 'A generic screen.',
      catalogId: 'agent-ui',
    }
    // A frozen copy of the registry, so the control never depends on a later edit to a live entry object.
    const frozen: readonly MiniSkill[] = Object.freeze(MINI_SKILLS.map((m) => Object.freeze({ ...m })))
    expect(rankingDefects(frozen)).toEqual([])
    expect(rankingDefects([...frozen, generic]).length).toBeGreaterThan(0)
  })
})

// T-0375: a CardFooter with one action Button holds it directly (grammar.md:193), and only 2+ share a Row.
// card-game-sheet loaded on the r11 stud turns that rebuilt a separate actions Card, game-table-chrome on deal again.
describe('T-0375: a lone action Button carries no Row', () => {
  const body = (id: string): string => MINI_SKILLS.find((m) => m.id === id)!.body

  it('game-table-chrome seats a lone Button in the CardFooter with no Row', () => {
    expect(body('game-table-chrome')).toMatch(/CardFooter = one Button, no Row; 2\+ in one Row\./)
    expect(body('game-table-chrome')).not.toMatch(/Row of action Buttons/)
  })

  it('card-game-sheet rides the bar in the hands Card footer, a lone Button with no Row', () => {
    expect(body('card-game-sheet')).toMatch(
      /action bar = 2\+ action Buttons in one Row, a lone Button \(a settled Deal again\) with no Row; the bar rides the CardFooter of the Card that holds the hands, or with no such Card sits below them, never in a separate actions Card\./,
    )
    expect(body('card-game-sheet')).not.toMatch(/action bar = a Row of Buttons/)
  })

  it('the r11 stud turn composes the card-game-sheet clause into the default-mode prompt', () => {
    const selection = selectMiniSkills(
      'Check, or call if there is a bet. If the hand is already over, leave the table as it is.',
      MINI_SKILLS,
      DEFAULT_MINI_SKILL_CAP,
      'agent-ui--croupier',
    )
    expect(selection.map((m) => m.id)).toContain('card-game-sheet')
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, selection)
    expect(prompt).toContain('a lone Button (a settled Deal again) with no Row')
    expect(prompt).toContain('rides the CardFooter of the Card that holds the hands')
  })

  it('a deal again turn composes the game-table-chrome footer clause into the default-mode prompt', () => {
    const selection = selectMiniSkills('deal again', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--croupier')
    expect(selection.map((m) => m.id)).toContain('game-table-chrome')
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, selection)
    expect(prompt).toContain('CardFooter = one Button, no Row')
  })
})
