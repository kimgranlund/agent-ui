// mini-skills.test.ts — ADR-0091 §2/§3: the registry's per-module token budget + `selectMiniSkills`'s
// degrade-to-empty/top-cap selection. Deterministic, no live model (mirrors retrieve.test.ts's shape).
// Lives under `src/live-agent/` (not `tools/agent/`) — the vitest `packages` project only globs
// `src/**/*.test.ts` (vitest.config.ts), the SAME reason produce-loop.test.ts/system-prompt-grammar.test.ts
// exercise their `tools/agent/*.ts` subjects from here rather than co-located.

import { describe, it, expect } from 'vitest'
import { MINI_SKILLS, PER_MODULE_TOKEN_BUDGET, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../agent/mini-skills.ts'
import type { MiniSkill } from '../agent/mini-skills.ts'

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
    expect(MINI_SKILLS).toHaveLength(9)
  })

  it('no registry body embeds A2UI JSONL (a pure-prose module needs only doc-review, ADR-0091 §4)', () => {
    for (const skill of MINI_SKILLS) {
      expect(skill.body).not.toMatch(/"version"\s*:\s*"v1\.0"/)
    }
  })

  // SPEC-R6 AC1 (`persona-catalog-composition.spec.md`, ADR-0172 cl.3) — every shipped module's
  // frontmatter carries the catalog whose vocabulary its body hardcodes.
  it('SPEC-R6 AC1 — every one of the nine shipped modules carries catalogId: \'agent-ui\'', () => {
    expect(MINI_SKILLS).toHaveLength(9)
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

  it('AC3 — an agent-ui turn is byte-identical to today (all nine modules eligible, ranked the same way)', () => {
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
})
