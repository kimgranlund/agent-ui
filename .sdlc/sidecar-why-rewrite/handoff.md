---
id: T-0007
title: "Rewrite the ten weakest selection.json why strings and recapture the baseline (GH #1815 item 3)"
type: chore           # feature | bug | chore | spike | idea
status: done
size: S
priority: P3
depends: []
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Rewrite the ten weakest reciprocal `why` strings in `packages/agent-ui/a2ui/src/catalog/default/selection.json` (ADR-0232, rubric D7: a `why` names the discriminating axis, never restates a mini-skill sentence) and recapture the byte-pinned baseline. Tracks GH #1815 item 3 (first part).

## Intent
- Do: the ten rewrites below (suggestions, check each against the catalog SPEC section 5.2 `.claude/docs/spec/a2ui-catalog.spec.md` and the `choosing.ts` groups before applying), measure the clause total against `SELECTION_GUIDANCE_CHAR_BUDGET = 8_600` (`selection-guidance.ts:239`) before lengthening anything, recapture the baseline, review that the diff touches only the changed clauses.
- Non-goals: new edges, new types, any other prompt text.
- Done when: gates green and the baseline diff touches only those clauses.

## Context
`why` renders as `not for: Row (why)`; caps 90 chars, no parentheses, em dashes or the clause separator; reciprocity is enforced by `catalog/selection-guidance.test.ts`. Weak ones (current to suggested): Toolbar to Row "a general arrangement" -> "children laid out with no command semantics"; ServiceCard to Card "general grouped content" -> "any content, not a launchable entry"; Card to Column "plain stacking" -> "children stacked with no surface or border"; Toast to Modal "something needing a decision" -> "a blocking dialog the user must answer"; Timeline to List "items with no time order" -> "a feed ranked by relevance, not time"; Avatar to Image "a picture as content" -> "a photo shown as content, not an identity mark"; Table to List "items without columns" -> "a flat run of items, one value each"; Menu to Popover "free content" -> "arbitrary panel content, not a command list"; Tooltip to Popover "interactive content" -> "a click-opened panel holding controls"; Modal to Popover "light content by an anchor" -> "a non-blocking panel at its trigger". Runner-ups: Badge to Text "a sentence"; Column to Row "side by side" (near-verbatim from `greeting-card.md`; the only n-gram overlap found). Any `why` edit moves all four composed prompts in `src/live-agent/prompt-equivalence.baseline.json`.

## Constraints
Recapture only through `RECAPTURE_BASELINE=1 npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts` (skill `a2ui-prompt-authoring`), then review the diff; no em dashes; ADR-0232 stays as ruled (an append-only note at most).

## Scrub and upsert list
`.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md` follow-up bullets (about lines 89, 94, 120: update when this lands); `.claude/docs/rubrics/a2ui-catalog.md` D7 (version note only if the wording rules change); `.claude/skills/a2ui-prompt-authoring/SKILL.md` (about line 56) only if the recapture flow text changes.

## Dependencies and conflicts
Never concurrent with T-0003 (budget and trace) or any ticket touching the composed prompt or `prompt-equivalence.baseline.json`: the baseline conflicts. Land before or after, serialized. No other conflicts.

## Size and lane
S, `solo`, serialized with T-0003.

## Acceptance outline
Ten rewrites within 90 chars with no parentheses; `selection-guidance.test.ts` green; recapture diff touches only the changed clauses; `prompt-drift` budget leg green; `npm run check` and a2ui package tests exit 0.

## Closed

2026-10-06: Already landed on main in #1830 (7d3ac733); rebuild produced an empty diff
