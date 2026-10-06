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

/** The whole-system-prompt character budget for a BASE catalog (`agent-ui`, `a2ui-basic`). Value =
 *  `Math.ceil(measured * 1.1 / 1000) * 1000`, the measured value being the worst case of the matrix
 *  below, enforced by the budget leg of `live-agent/prompt-budget.test.ts`.
 *  MEASURED 2026-10-05: 126 563 chars (the `agent-ui` catalog, mode default); budget 140 000. Matrix:
 *  max over modes default, specific and blue-sky; the 3 judged exemplars of `corpus/exemplar/v1_0/agent-ui.jsonl` with the largest
 *  single-record prompt; the `DEFAULT_MINI_SKILL_CAP` (3) largest mini-skill bodies scoped to the base
 *  catalog; genui `{enabled: true, dogfood: true}` with a 16,384-char `sourceBody`; a 16,384-char
 *  `personaSystem`; `authoringSurface`, `builderMission` and `a2uiEnabled` all true. */
export const PROMPT_CHAR_BUDGET_BASE = 140_000

/** The budget for a DERIVED `<base>--<persona>` catalog (`compose.ts` `derivedCatalogId`): the same matrix
 *  over every `SHIPPED_PERSONA_CATALOGS` entry composed onto each of its target bases (mini-skills scoped
 *  to the target base), same rounding. Kept as its own constant so a persona fragment's inventory rows
 *  can widen it without moving BASE; at this measurement both round to the same value.
 *  MEASURED 2026-10-05: 127 103 chars (`agent-ui--concierge`, mode default); budget 140 000. */
export const PROMPT_CHAR_BUDGET_DERIVED = 140_000

/** The declared budget for `catalogId`: DERIVED for a `<base>--<persona>` id, else BASE. */
export function promptBudgetFor(catalogId: string): number {
  return catalogId.includes('--') ? PROMPT_CHAR_BUDGET_DERIVED : PROMPT_CHAR_BUDGET_BASE
}

/** Assess composed sections against `limit`. Never mutates `sections`; the report carries fresh copies. */
export function assessPromptBudget(sections: readonly PromptSection[], limit: number): PromptBudgetReport {
  let total = 0
  for (const s of sections) total += s.chars
  return { limit, total, sections: sections.map((s) => ({ id: s.id, chars: s.chars })), over: total > limit }
}
