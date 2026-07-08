// mini-skills.test.ts — ADR-0091 §2/§3: the registry's per-module token budget + `selectMiniSkills`'s
// degrade-to-empty/top-cap selection. Deterministic, no live model (mirrors retrieve.test.ts's shape).
// Lives under `src/live-agent/` (not `tools/agent/`) — the vitest `packages` project only globs
// `src/**/*.test.ts` (vitest.config.ts), the SAME reason produce-loop.test.ts/system-prompt-grammar.test.ts
// exercise their `tools/agent/*.ts` subjects from here rather than co-located.

import { describe, it, expect } from 'vitest'
import { MINI_SKILLS, PER_MODULE_TOKEN_BUDGET, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../../tools/agent/mini-skills.ts'
import type { MiniSkill } from '../../tools/agent/mini-skills.ts'

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
    expect(MINI_SKILLS).toHaveLength(5)
  })

  it('no registry body embeds A2UI JSONL (a pure-prose module needs only doc-review, ADR-0091 §4)', () => {
    for (const skill of MINI_SKILLS) {
      expect(skill.body).not.toMatch(/"version"\s*:\s*"v1\.0"/)
    }
  })
})

describe('selectMiniSkills — TF-IDF top-cap selection over the registry (ADR-0091 §2)', () => {
  it('a query matching a registry entry\'s triggers returns it', () => {
    const result = selectMiniSkills('build me a settings screen with toggles', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)
    expect(result.map((m) => m.id)).toContain('settings-screen')
  })

  it('a query with no vocabulary overlap against the registry returns []', () => {
    expect(selectMiniSkills('zzz qqq xyz totally unrelated gibberish', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)).toEqual([])
  })

  it('a query matching multiple entries returns at most `cap`', () => {
    // "form" appears in login-form's triggers; broaden with terms shared across several entries too.
    const result = selectMiniSkills('a form with a save button and a submit action', MINI_SKILLS, 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('never pads with a genuinely unrelated (zero-score) module to fill `cap`', () => {
    const registry: MiniSkill[] = [
      { id: 'a-match', triggers: 'login form password submit', body: 'x' },
      { id: 'z-unrelated', triggers: 'completely different vocabulary entirely', body: 'y' },
    ]
    const result = selectMiniSkills('login form password submit', registry, 5)
    expect(result.map((m) => m.id)).toEqual(['a-match']) // NOT padded with z-unrelated despite cap=5
  })

  it('degrades to [] when cap <= 0', () => {
    expect(selectMiniSkills('a settings screen', MINI_SKILLS, 0)).toEqual([])
    expect(selectMiniSkills('a settings screen', MINI_SKILLS, -1)).toEqual([])
  })

  it('degrades to [] over an empty registry', () => {
    expect(selectMiniSkills('anything at all', [], DEFAULT_MINI_SKILL_CAP)).toEqual([])
  })

  it('is deterministic across repeated calls over the same inputs', () => {
    const first = selectMiniSkills('a dashboard with kpi stats', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP).map((m) => m.id)
    const second = selectMiniSkills('a dashboard with kpi stats', MINI_SKILLS, DEFAULT_MINI_SKILL_CAP).map((m) => m.id)
    expect(second).toEqual(first)
  })
})
