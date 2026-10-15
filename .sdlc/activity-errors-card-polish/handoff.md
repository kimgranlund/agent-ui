---
id: T-0019
title: "Activity strip shows failure reasons and keeps a retry marker; card padding; Croupier badges in header trailing slot"
type: bug
status: done
size: M
priority: P2
depends: []
router: .sdlc/AGENTS.md
created: 2026-10-06
---

## Goal
Three user-reported defects from the agent-admin Test Chat with The Croupier (screenshots, 2026-10-06). Worktree `.claude/worktrees/wave-polish`, branch `fix/activity-errors-card-polish`.

## Intent
- Do 1, errors hidden: in `site/lib/a2ui-activity.ts` (and the `ui-conversation` step rendering in `packages/agent-ui/app/src/controls/conversation/`), a failed validation round must show WHY while it is live (the failure codes, not only "Round 1 failed, retrying"), and after the turn succeeds the strip must keep a persistent, visible retry marker (e.g. a warning-toned "N retries" in the header and the repaired step staying expanded-able with its codes), not collapse to a plain green check. Keep the neutral ActivityStep model general purpose (ADR-0159 amendment); no Croupier specifics.
- Do 2, header overlap: when expanded mid-run, the step list overlaps and clips the "Agent activity" header row. Fix the layout (overflow or sticky or stacking) with a browser-test guard.
- Do 3, padding: the Blackjack card (Card, CardHeader, CardContent, CardFooter in a2ui chat output) shows content flush to the card edges and the activity text has no inset. Find the root cause (a missing sub-tag style, the ADR-0233 per-control entry/shared-styles loading, or the Croupier fragment) and fix it where it belongs; do not paper over it per persona.
- Do 4, badges: the Croupier teaching (fragment, `selection.json` sidecar, prompt) must put status badges and tags (the Bankroll badge) in the CardHeader trailing slot, not full-width under the title. Update the sidecar, recapture the byte-pinned baseline deliberately (skill `a2ui-prompt-authoring`), `node scripts/generate-agent-assets.mjs`, the manifest digest writer, and `npm run generate:registry` as needed.
- Non-goals: capturing or showing model reasoning text (a separate plan); no ADR changes beyond recording the amendment note if the strip contract changes.
- Done when: each defect has a red-then-green test (jsdom or browser as fits), `npm run check` and full `npm test` exit 0, `npm run test:browser` for any browser test you add or touch exits 0, no em dashes, stale records repaired in the same change.

## Context
Strip code: `site/lib/a2ui-activity.ts` (`settleValidate`, `repairSummary`, retry branch). Recorded Haiku fixtures in `packages/agent-ui/a2ui/src/catalog/personas/croupier/__fixtures__/`. Never hand-edit generated files. Judge gates by exit code.

## Constraints
Imports point inward only. No publish; commit locally in the worktree.

## Acceptance criteria
1. After a turn with a repaired round, the rendered strip header shows a visible retry marker and the failure codes are reachable without opening raw output.
2. A live failed round shows its failure codes.
3. Expanded strip: header row is not overlapped by the step list (browser test).
4. Card sub-parts render with padding in the chat surface (test) and the root cause is stated in the final report.
5. Croupier teaching places badges in the CardHeader trailing slot; baseline recaptured; gates green.

## Closed

2026-10-06: Merged to main in #1839
