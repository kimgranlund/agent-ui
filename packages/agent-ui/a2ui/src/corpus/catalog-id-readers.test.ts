// T-0210: every catalog id reader on a two-domain id (`<base>--<d1>+<d2>`). Each reads the id through
// `catalog-id.ts` `splitCatalogId`, so it gets the base, the derived budget and both domains, never a first-`--`
// split that treats `design+games` as a persona or falls back silently. No domain ships yet, so a reader that
// resolves shipped domains answers with the base (guidance) or with nothing (a catalog), never a persona's.
import { describe, it, expect } from 'vitest'
import { splitCatalogId, isDerivedCatalogId } from '../catalog/catalog-id.ts'
import { selectedDomains } from '../catalog/layers.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { baseCatalogId } from './base-id.ts'
import { promptBudgetFor, PROMPT_CHAR_BUDGET_DERIVED, PROMPT_CHAR_BUDGET_BASE } from '../agent/prompt-budget.ts'
import { selectionGuidanceForId } from '../agent/selection-guidance.ts'
import { selectionProjectionFor } from '../registry/selection.ts'
import { agentLabel } from '../../tools/agent/trace-log.ts'
import { scenarioTags } from '../../tools/testkit/kit.ts'
import { nodeCatalogResolver } from '../../tools/testkit/load.node.ts'
import type { A2uiScenario } from '../../tools/testkit/scenario.ts'
import { replaySemanticChecks } from '../../../../../scripts/e2e-admin/probe/trace.ts'

declare const process: { cwd(): string }

const TWO = 'agent-ui--design+games'

describe('catalog id readers on a two-domain id (T-0210)', () => {
  it('splitCatalogId and isDerivedCatalogId keep the whole tail', () => {
    expect(splitCatalogId(TWO)).toEqual({ base: 'agent-ui', tail: 'design+games' })
    expect(splitCatalogId('agent-ui')).toEqual({ base: 'agent-ui', tail: undefined })
    expect(isDerivedCatalogId(TWO)).toBe(true)
    expect(isDerivedCatalogId('agent-ui')).toBe(false)
  })

  it('baseCatalogId reads the base', () => {
    expect(baseCatalogId(TWO)).toBe('agent-ui')
  })

  it('promptBudgetFor keys the derived budget', () => {
    expect(promptBudgetFor(TWO)).toBe(PROMPT_CHAR_BUDGET_DERIVED)
    expect(promptBudgetFor('agent-ui')).toBe(PROMPT_CHAR_BUDGET_BASE)
  })

  it('selectedDomains selects both domains', () => {
    expect([...selectedDomains(TWO)].sort()).toEqual(['design', 'games'])
  })

  it('selectionGuidanceForId and selectionProjectionFor read the base, never empty', () => {
    const base = selectionGuidanceForId('agent-ui')
    expect(Object.keys(base).length).toBeGreaterThan(0)
    expect(selectionGuidanceForId(TWO)).toEqual(base)
    const projected = selectionProjectionFor('agent-ui')
    expect(Object.keys(projected).length).toBeGreaterThan(0)
    expect(selectionProjectionFor(TWO)).toEqual(projected)
  })

  it('agentLabel reads the whole tail', () => {
    expect(agentLabel(undefined, TWO)).toBe('design+games')
    expect(agentLabel(undefined, 'agent-ui')).toBeUndefined()
  })

  it('scenarioTags tags a derived scenario', () => {
    const scenario = { catalogId: TWO, turns: [] } as unknown as A2uiScenario
    expect(scenarioTags(scenario)).toContain('persona')
  })

  it('nodeCatalogResolver never resolves an unshipped domain id to a persona or the base', () => {
    const resolve = nodeCatalogResolver(process.cwd())
    expect(resolve(TWO)).toBeUndefined()
    expect(resolve('agent-ui--croupier')?.catalogId).toBe('agent-ui--croupier') // anti-vacuous: a persona id resolves
  })

  it('replaySemanticChecks runs no persona checks for a domain id', () => {
    const asTwo = replaySemanticChecks({ ...defaultCatalog, catalogId: TWO })
    const asBase = replaySemanticChecks(defaultCatalog)
    expect(asTwo.length).toBe(asBase.length)
  })
})
