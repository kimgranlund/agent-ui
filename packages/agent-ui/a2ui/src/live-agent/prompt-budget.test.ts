// prompt-budget.test.ts: ADR-0234 (proposed). The whole-prompt character budget and the section report
// `produce()` attaches to `TurnTrace.prompt`. Three legs: the pure helpers (`assessPromptBudget`,
// `promptBudgetFor`); the section-sum leg (`buildSystemPromptSections` reproduces `buildSystemPrompt`
// byte for byte and its sections add up to the text); and the budget leg, which holds the measured
// ceilings over the worst-case fixture matrix named in `prompt-budget.ts`, with a negative control.
// Deterministic, no model.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildSystemPromptSections } from '../agent/system-prompt.ts'
import type { PromptSection, PromptSectionId } from '../agent/meta-line.ts'
import {
  assessPromptBudget,
  promptBudgetFor,
  PROMPT_CHAR_BUDGET_BASE,
  PROMPT_CHAR_BUDGET_DERIVED,
} from '../agent/prompt-budget.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { DERIVED_CATALOGS, MODES, PERSONA_SYSTEM_CAP, worstArgs, worstExemplarsFor } from '../../tools/agent/prompt-budget-matrix.ts'
import type { BudgetArgs as Args } from '../../tools/agent/prompt-budget-matrix.ts'

const SECTION_ORDER: readonly PromptSectionId[] = [
  'grammar',
  'components',
  'functions',
  'few-shot',
  'mini-skills',
  'genui',
  'authoring',
  'mission',
  'response-preference',
  'persona',
]
const CAP_PERSONA = 'p'.repeat(PERSONA_SYSTEM_CAP)

const baseMatrix: { label: string; args: Args }[] = [defaultCatalog, a2uiBasicCatalog].flatMap((c) =>
  MODES.map((mode) => ({ label: `${c.catalogId} ${mode}`, args: worstArgs(c, c.catalogId, mode, CAP_PERSONA) })),
)
const derivedMatrix: { label: string; args: Args }[] = DERIVED_CATALOGS.flatMap(({ catalog, baseId }) =>
  MODES.map((mode) => ({ label: `${catalog.catalogId} ${mode}`, args: worstArgs(catalog, baseId, mode, CAP_PERSONA) })),
)

/** The pinned baseline shapes (`prompt-equivalence.baseline.json`) plus single-gate variations. */
const baselineShapes: { label: string; args: Args }[] = [
  { label: 'absent mode', args: [defaultCatalog, []] },
  { label: 'default', args: [defaultCatalog, [], 'default'] },
  { label: 'specific', args: [defaultCatalog, [], 'specific'] },
  { label: 'blue-sky', args: [defaultCatalog, [], 'blue-sky'] },
  { label: 'a2ui-basic', args: [a2uiBasicCatalog, []] },
  { label: 'a2ui off, genui dogfood', args: [defaultCatalog, [], undefined, undefined, undefined, { enabled: true, dogfood: true }, false] },
  { label: 'a2ui off, nothing else', args: [defaultCatalog, [], undefined, undefined, undefined, undefined, false] },
  { label: 'persona only', args: [defaultCatalog, [], undefined, undefined, 'a persona'] },
  { label: 'prefers text', args: [defaultCatalog, [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'text'] },
  { label: 'prefers surface, a2ui off', args: [defaultCatalog, [], undefined, undefined, undefined, undefined, false, undefined, undefined, 'surface'] },
]

describe('assessPromptBudget (ADR-0234)', () => {
  const sections: PromptSection[] = [
    { id: 'grammar', chars: 60 },
    { id: 'persona', chars: 40 },
  ]

  it('reports over: true when the total exceeds the limit, and never mutates or aliases its input', () => {
    const snapshot = JSON.parse(JSON.stringify(sections)) as PromptSection[]
    const report = assessPromptBudget(sections, 99)
    expect(report).toEqual({ limit: 99, total: 100, sections: snapshot, over: true })
    expect(sections).toEqual(snapshot)
    expect(report.sections).not.toBe(sections)
    report.sections.forEach((s, i) => expect(s).not.toBe(sections[i]))
  })

  it('a total equal to the limit is not over', () => {
    expect(assessPromptBudget(sections, 100).over).toBe(false)
  })
})

describe('promptBudgetFor (ADR-0234)', () => {
  it('maps base ids to BASE and derived <base>--<persona> ids to DERIVED, with DERIVED >= BASE', () => {
    expect(promptBudgetFor('agent-ui')).toBe(PROMPT_CHAR_BUDGET_BASE)
    expect(promptBudgetFor('a2ui-basic')).toBe(PROMPT_CHAR_BUDGET_BASE)
    expect(promptBudgetFor('agent-ui--croupier')).toBe(PROMPT_CHAR_BUDGET_DERIVED)
    expect(PROMPT_CHAR_BUDGET_BASE).toBeGreaterThan(0)
    expect(PROMPT_CHAR_BUDGET_DERIVED).toBeGreaterThanOrEqual(PROMPT_CHAR_BUDGET_BASE)
  })
})

describe('buildSystemPromptSections section-sum leg (ADR-0234)', () => {
  for (const { label, args } of [...baselineShapes, ...baseMatrix, ...derivedMatrix]) {
    it(`${label}: text is byte-identical and the sections sum to it, unique and in order`, () => {
      const { text, sections } = buildSystemPromptSections(...args)
      expect(text).toBe(buildSystemPrompt(...args))
      expect(buildSystemPromptSections(...args).text).toBe(buildSystemPrompt(...args))
      expect(sections.reduce((n, s) => n + s.chars, 0)).toBe(text.length)
      const ids = sections.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      const positions = ids.map((id) => SECTION_ORDER.indexOf(id))
      expect(positions.every((p) => p >= 0)).toBe(true)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
      for (const s of sections) expect(s.chars, `${s.id} is empty`).toBeGreaterThan(0)
    })
  }

  it('the worst-case matrix composes every one of the ten sections', () => {
    const { sections } = buildSystemPromptSections(...baseMatrix[0]!.args)
    expect(sections.map((s) => s.id)).toEqual(SECTION_ORDER)
  })
})

describe('prompt budget leg over the worst-case matrix (ADR-0234)', () => {
  it('every base-catalog worst case stays within PROMPT_CHAR_BUDGET_BASE', () => {
    for (const { label, args } of baseMatrix) {
      const { sections } = buildSystemPromptSections(...args)
      const report = assessPromptBudget(sections, promptBudgetFor(args[0].catalogId))
      expect(report.limit).toBe(PROMPT_CHAR_BUDGET_BASE)
      expect(report.over, `${label}: ${report.total} > ${report.limit}`).toBe(false)
    }
  })

  it('every shipped persona composed onto each target base stays within PROMPT_CHAR_BUDGET_DERIVED', () => {
    expect(derivedMatrix.length).toBeGreaterThan(0)
    for (const { label, args } of derivedMatrix) {
      const { sections } = buildSystemPromptSections(...args)
      const report = assessPromptBudget(sections, promptBudgetFor(args[0].catalogId))
      expect(report.limit).toBe(PROMPT_CHAR_BUDGET_DERIVED)
      expect(report.over, `${label}: ${report.total} > ${report.limit}`).toBe(false)
    }
  })

  it('T-0254: a derived catalog\'s worst case draws on its persona shard; an oversized persona record reds the gate', () => {
    const { catalog, baseId } = DERIVED_CATALOGS[0]!
    const base = worstExemplarsFor(baseId)[0]!
    const planted = { ...base, promptText: 'x'.repeat(30_000) }
    const budget = promptBudgetFor(catalog.catalogId)
    const over = (shards: Record<string, (typeof planted)[]>) => {
      const args = worstArgs(catalog, baseId, 'default', CAP_PERSONA, worstExemplarsFor(catalog.catalogId, shards))
      return assessPromptBudget(buildSystemPromptSections(...args).sections, budget)
    }
    expect(over({}).over).toBe(false)
    expect(over({ [catalog.catalogId]: [planted] }).over).toBe(true)
    // another persona's shard never reaches this catalog's turn
    expect(over({ 'agent-ui--nobody': [planted] }).over).toBe(false)
  })

  it('negative control: the same worst-case prompt at limit 1 reports over: true', () => {
    const { sections } = buildSystemPromptSections(...baseMatrix[0]!.args)
    expect(assessPromptBudget(sections, 1).over).toBe(true)
  })
})
