// prompt-budget.ts: ADR-0234 (proposed): the declared whole-prompt character budget and its per-turn
// assessment. Characters are the unit because they are exact at composition time; tokens arrive from the
// provider after the fact (`TurnTrace.usage`). Over budget is REPORTED (`over: true` on the trace), never
// truncated: `produce()` drops nothing, and only an explicit `promptBudget: {mode: 'halt'}` turns an
// over-budget prompt into a pre-call `ProduceHalt`.
//
// Pure and platform-neutral on purpose: no `node:*`, no runtime import, so it runs in the Worker and in
// jsdom tests. (The `./agent` subpath is generated-assets based; the old node:fs allow-list is gone.) That is why it does not sit beside the
// Node-only `SELECTION_GUIDANCE_CHAR_BUDGET` (`selection-guidance.ts`).

import type { PromptBudgetReport, PromptSection } from './meta-line.ts'
import { isDerivedCatalogId } from '../catalog/catalog-id.ts'

/** The whole-system-prompt character budget for a BASE catalog (`agent-ui`, `a2ui-basic`). Value =
 *  `Math.ceil(measured * 1.1 / 1000) * 1000`, the measured value being the worst case of the matrix
 *  below, enforced by the budget leg of `live-agent/prompt-budget.test.ts`.
 *  MEASURED 2026-10-05: 126 563 chars (the `agent-ui` catalog, mode default); budget 140 000. Matrix:
 *  max over modes default, specific and blue-sky; the 3 judged exemplars of `corpus/exemplar/v1_0/agent-ui.jsonl` with the largest
 *  single-record prompt; the `DEFAULT_MINI_SKILL_CAP` (3) largest mini-skill bodies scoped to the base
 *  catalog; genui `{enabled: true, dogfood: true}` with a 16,384-char `sourceBody`; a 16,384-char
 *  `personaSystem`; `authoringSurface`, `builderMission` and `a2uiEnabled` all true.
 *  RE-MEASURED 2026-10-12 (T-0089, ADR-0244): the worst case is 140 735 chars (`agent-ui`, mode default), against
 *  139 883 before the `ResultCard` default row: +852 chars, the row and its clause on the catalog inventory line
 *  plus the ui-result-card dogfood row (+463), each with the reciprocal `GameHud` and `Toast` edges. The first raise
 *  of BASE: budget 141 100 (measured rounded up to the next 100, plus 300, the formula the sidecar budgets use).
 *  T-0207: the 16 KB persona above is the proxies' runaway cap, not a real preset. The site leg
 *  `site/pages/agent-admin-prompt-budget.test.ts` composes each shipped preset's real persona on its own catalog
 *  under the same matrix: MEASURED 2026-10-14, largest persona 4 516 chars (croupier), worst 130 097 chars
 *  (`agent-ui--croupier`, DERIVED headroom 11 903), worst base preset 126 792 (travel, BASE headroom 14 308). */
export const PROMPT_CHAR_BUDGET_BASE = 141_100

/** The budget for a DERIVED `<base>--<persona>` catalog (`compose.ts` `derivedCatalogId`): the same matrix
 *  over every `SHIPPED_PERSONA_CATALOGS` entry composed onto each of its target bases (mini-skills scoped
 *  to the target base), same rounding. Kept as its own constant so a persona fragment's inventory rows
 *  can widen it without moving BASE; at this measurement both round to the same value.
 *  MEASURED 2026-10-05: 127 103 chars (`agent-ui--concierge`, mode default); budget 140 000.
 *  RE-MEASURED 2026-10-12 (T-0072, ADR-0243): the worst case is 140 484 chars (`agent-ui--concierge`, mode default),
 *  against 138 971 at ff5271ad before the three default-catalog rows (ProductCard, BoardGrid, GameHud) joined every
 *  inventory: +1 513 chars. The 2026-10-05 figure above is stale. Budget 140 800 (measured rounded up to the next
 *  100, plus 300, the formula the sidecar budgets use). Later persona rows (CardTable, QuestionCard) re-measure and
 *  raise it themselves. BASE is untouched (139 749 against 140 000).
 *  RE-MEASURED 2026-10-12 (T-0083, ADR-0243 Amendment 2): the worst case is 140 801 chars (`agent-ui--croupier`, mode
 *  default; 140 647 before), +154 from the four ProductCard wire props (`priceOld`, `ratingCount`, `selected`,
 *  `disabled`), 77 on the catalog inventory line and 77 on the dogfood row. Budget 141 200 by the same formula.
 *  BASE is untouched (139 883 against 140 000).
 *  RE-MEASURED 2026-10-12 (T-0089, ADR-0244): the worst case is 141 653 chars (`agent-ui--croupier`, mode default;
 *  140 801 before), +852 from the `ResultCard` default row, the same rows BASE pays. Budget 142 000 by the same
 *  formula; BASE is re-measured above in the same change. */
export const PROMPT_CHAR_BUDGET_DERIVED = 142_000

/** The declared budget for `catalogId`: DERIVED for a `<base>--<persona>` id, else BASE. */
export function promptBudgetFor(catalogId: string): number {
  return isDerivedCatalogId(catalogId) ? PROMPT_CHAR_BUDGET_DERIVED : PROMPT_CHAR_BUDGET_BASE
}

/** Assess composed sections against `limit`. Never mutates `sections`; the report carries fresh copies. */
export function assessPromptBudget(sections: readonly PromptSection[], limit: number): PromptBudgetReport {
  let total = 0
  for (const s of sections) total += s.chars
  return { limit, total, sections: sections.map((s) => ({ id: s.id, chars: s.chars })), over: total > limit }
}
