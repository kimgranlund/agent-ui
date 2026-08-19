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
    expect(MINI_SKILLS).toHaveLength(14)
  })

  it('no registry body embeds A2UI JSONL (a pure-prose module needs only doc-review, ADR-0091 §4)', () => {
    for (const skill of MINI_SKILLS) {
      expect(skill.body).not.toMatch(/"version"\s*:\s*"v1\.0"/)
    }
  })

  // SPEC-R6 AC1 (`persona-catalog-composition.spec.md`, ADR-0172 cl.3) — every shipped module's
  // frontmatter carries the catalog whose vocabulary its body hardcodes.
  it('SPEC-R6 AC1 — every one of the fourteen shipped modules carries catalogId: \'agent-ui\'', () => {
    expect(MINI_SKILLS).toHaveLength(14)
    for (const skill of MINI_SKILLS) expect(skill.catalogId, skill.id).toBe('agent-ui')
  })
})

describe('selectMiniSkills — TF-IDF top-cap selection over the registry (ADR-0091 §2)', () => {
  it('a query matching a registry entry\'s triggers returns it', () => {
    const result = selectMiniSkills('build me a settings screen with toggles', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui')
    expect(result.map((m) => m.id)).toContain('settings-screen')
  })

  it('a terse card-game intent selects the TKT-0077 trio together (the shared `deal` trigger core)', () => {
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
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
// BEFORE ranking (mirrors `corpus/retrieve.ts:41,55`'s own `meta.catalogId` filter).
describe('selectMiniSkills — SPEC-R6 catalogId scoping', () => {
  it('AC2 — a non-agent-ui catalogId (a2ui-basic or a derived id) returns [] even for a strong-match intent', () => {
    expect(selectMiniSkills('build me a settings screen with toggles', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'a2ui-basic')).toEqual([])
    expect(selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui--fixture-demo')).toEqual([])
  })

  it('AC3 — an agent-ui turn is byte-identical to today (all ten modules eligible, ranked the same way)', () => {
    const filtered = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    // Every shipped module is already catalogId:'agent-ui' (AC1), so filtering has zero effect on the
    // scoring input — the SAME selection the un-scoped call produced before this clause existed.
    expect(filtered.sort()).toEqual(['card-layout', 'game-hud', 'game-table-chrome'])
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
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
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
    const ids = selectMiniSkills('deal me in', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, 'agent-ui').map((m) => m.id)
    expect(ids.sort()).toEqual(['card-layout', 'game-hud', 'game-table-chrome'])
  })

  it('is persona-conditional in its own first line — first turn only, only when the persona greets', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/first turn only, when your persona opens the session with a greeting/)
  })

  it('teaches the greet-card anatomy (starter Buttons carrying concrete intents in action.context)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/CardFooter with 2–4 Buttons/)
    expect(skill.body).toMatch(/action\.context naming a concrete starter intent/)
  })

  it('teaches the reserved exempt id class — greet-1 rides the ask field but is NOT an ask (ruling 2)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/reserved id "greet-1"/)
    expect(skill.body).toMatch(/NOT an ask: no commit button, no data model/)
    expect(skill.body).toMatch(/no ask-<n> id consumed, no answered-ask freeze/)
  })

  it('teaches the stale-affordance retirement (a task start retires the greet buttons same turn)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'greeting-card')!
    expect(skill.body).toMatch(/retire the greet buttons per the stale-affordance rule that same turn/)
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

  it('teaches the unbindable-Switch-label trap (the name rides the adjacent Text, not the switch)', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'crud-entry-list')!
    expect(skill.body).toMatch(/Switch's own `label` is NOT bindable/)
  })

  it('teaches the edit-Drawer + FormProvider shape and the Button-rows-in-Menu add-from-library idiom', () => {
    const skill = MINI_SKILLS.find((m) => m.id === 'crud-entry-list')!
    expect(skill.body).toMatch(/Drawer\(edge 'end', open bound\)/)
    expect(skill.body).toMatch(/a Menu whose rows are BUTTONS/)
    expect(skill.body).toMatch(/never bare MenuItem, which carries no `action` slot/)
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
