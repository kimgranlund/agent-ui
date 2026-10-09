// prompt-budget.test.ts: ADR-0234 (proposed). The whole-prompt character budget and the section report
// `produce()` attaches to `TurnTrace.prompt`. Three legs: the pure helpers (`assessPromptBudget`,
// `promptBudgetFor`); the section-sum leg (`buildSystemPromptSections` reproduces `buildSystemPrompt`
// byte for byte and its sections add up to the text); and the budget leg, which holds the measured
// ceilings over the worst-case fixture matrix named in `prompt-budget.ts`, with a negative control.
// Deterministic, no model.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSystemPrompt, buildSystemPromptSections } from '../agent/system-prompt.ts'
import type { PromptSection, PromptSectionId } from '../agent/meta-line.ts'
import {
  assessPromptBudget,
  promptBudgetFor,
  PROMPT_CHAR_BUDGET_BASE,
  PROMPT_CHAR_BUDGET_DERIVED,
} from '../agent/prompt-budget.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP } from '../agent/mini-skills.ts'
import type { GenUiMode } from '../agent/gen-ui-mode.ts'
import type { Catalog } from '../catalog/catalog.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { a2uiBasicCatalog } from '../catalog/a2ui-basic/index.ts'
import { composeCatalog } from '../catalog/compose.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'

// Typed off the builder's own parameter, never `CorpusRecord` by name: `src/corpus/*` is import-barred
// outside itself (ADR-0062), the `produce-loop.test.ts` precedent.
type Exemplar = Parameters<typeof buildSystemPrompt>[1][number]

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
const MODES: readonly GenUiMode[] = ['default', 'specific', 'blue-sky']
/** The runaway-guard caps the two proxies apply (`tools/agent/chat-validation.ts`, `dev-proxy-plugin.ts`). */
const SOURCE_BODY_CAP = 16_384
const PERSONA_SYSTEM_CAP = 16_384

const exemplarFile = `${process.cwd()}/packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`
const allExemplars: Exemplar[] = readFileSync(exemplarFile, 'utf8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as Exemplar)
/** The k=3 records with the largest single-record prompt (the worst-case retrieval). */
const worstExemplars: Exemplar[] = [...allExemplars]
  .map((ex) => ({ ex, len: buildSystemPrompt(defaultCatalog, [ex]).length }))
  .sort((a, b) => b.len - a.len)
  .slice(0, 3)
  .map((e) => e.ex)

/** The `DEFAULT_MINI_SKILL_CAP` largest mini-skill bodies scoped to `baseCatalogId`. */
const worstMiniSkills = (baseCatalogId: string) =>
  MINI_SKILLS.filter((m) => m.catalogId === baseCatalogId)
    .sort((a, b) => b.body.length - a.body.length)
    .slice(0, DEFAULT_MINI_SKILL_CAP)

type Args = Parameters<typeof buildSystemPrompt>

/** The worst-case argument tuple for one catalog and mode. */
function worstArgs(catalog: Catalog, baseCatalogId: string, mode: GenUiMode): Args {
  return [
    catalog,
    worstExemplars,
    mode,
    worstMiniSkills(baseCatalogId),
    'p'.repeat(PERSONA_SYSTEM_CAP),
    { enabled: true, dogfood: true, sourceBody: 's'.repeat(SOURCE_BODY_CAP) },
    true,
    true,
    true,
    'surface',
  ]
}

const BASES: Record<string, Catalog> = { 'agent-ui': defaultCatalog, 'a2ui-basic': a2uiBasicCatalog }

const baseMatrix: { label: string; args: Args }[] = [defaultCatalog, a2uiBasicCatalog].flatMap((c) =>
  MODES.map((mode) => ({ label: `${c.catalogId} ${mode}`, args: worstArgs(c, c.catalogId, mode) })),
)
const derivedMatrix: { label: string; args: Args }[] = SHIPPED_PERSONA_CATALOGS.flatMap((p) =>
  (p.targetCatalogs !== undefined && p.targetCatalogs.length > 0 ? p.targetCatalogs : ['agent-ui']).flatMap((baseId) => {
    const derived = composeCatalog(BASES[baseId]!, p.fragment, p.personaId)
    return MODES.map((mode) => ({ label: `${derived.catalogId} ${mode}`, args: worstArgs(derived, baseId, mode) }))
  }),
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

  it('negative control: the same worst-case prompt at limit 1 reports over: true', () => {
    const { sections } = buildSystemPromptSections(...baseMatrix[0]!.args)
    expect(assessPromptBudget(sections, 1).over).toBe(true)
  })
})
