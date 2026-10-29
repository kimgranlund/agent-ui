---
id: T-0560
title: "Fields on dim planes, dark active links and theme packs meet AA"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Text fields on the dimmest light planes, the dark active router link and the shipped theme packs meet WCAG AA text contrast.

## Intent
- Do: fix the field placeholder ink over the field fill on light planes n-175 and n-200 (4.50 and 4.22 today); fix ui-router-link active ink `primary-high` on dark n-800 (4.39 today); measure the theme packs' text roles in light and dark and fix any pair under 4.5:1 (3:1 for large text and non-text UI).
- Non-goals: new color roles beyond what a fix needs; the main palette's already-passing pairs.
- Done when: a tokens test pins each fixed pair at 4.5 or above and fails on base; before and after contrast numbers plus screenshots are in the run folder; the touched tests and `npm run check` exit 0.

## Context
From T-0557 (PR 2352) solo and verifier notes: with the field fill over n-175 the placeholder is 4.50, over n-200 it is 4.22 (page surface 5.09); router-link active ink `primary-high` (650/400) is 4.39 on dark n-800; theme packs were not measured. T-0557's probe shape: `.sdlc/runtime/tasks/0557-theme-aa-fixes/probe.mjs` in its lane; token math lives in `packages/agent-ui/shared/src/tokens/tokens.test.ts`.

## Constraints
No em dashes. No paid runs. Browser tests through scripts/gate_lock.py. Starts after PR 2352 merges.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
Scope of "text roles": the neutral on-surface, on-surface-variant and placeholder inks, the primary placeholder (link) and on-surface-variant inks, each as text on the seven elevation planes per scheme, the placeholder also on the idle field fill over each plane. `primary-high` is the fleet indicator and selected-row ink, not moved as a role (its legs stay pinned by T-0340's PRE_T0340_LEGS); its text-on-plane consumer in scope, the active ui-router-link, is gated as `router-link-active`. Residual `primary-high` plane numbers are reported as open items.
- (red) Every gated text pair in tokens.css and all ten theme packs clears 4.5:1 in light and dark: `node .sdlc/runtime/tasks/0560-contrast-leftovers/probe.mjs .` exits 0.
- The tokens, theme-pack, wrap-pack and router-link tests pass, including the new pins (placeholder on the field fill over every plane, each pack's text inks on every plane, the repointed text legs as a wrap-pack fixed point, the active router-link ink): `npx vitest run packages/agent-ui/shared/src/tokens packages/agent-ui/router/src/controls/router-link` exits 0.
- The text-field and router-link browser tests pass: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/text-field packages/agent-ui/router/src/controls/router-link` exits 0.
- The standing gate passes: `npm run check` exits 0.
- Before and after numbers (before.txt, after.txt) and screenshots with measured results (shots/before, shots/after) sit in the run folder: `ls .sdlc/runtime/tasks/0560-contrast-leftovers/before.txt .sdlc/runtime/tasks/0560-contrast-leftovers/after.txt .sdlc/runtime/tasks/0560-contrast-leftovers/shots/before .sdlc/runtime/tasks/0560-contrast-leftovers/shots/after` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: dbbf1fc94b60
- Changed: Field placeholders on dim light planes, the dark active router link and the theme pack placeholders meet AA
- Commits: none
- Check: 1 (red) probe clears 4.5:1 on every gated text pair in tokens.css and the ten packs: pass
- Check: 2 tokens, theme-pack, wrap-pack and router-link vitest: pass
- Check: 3 text-field and router-link browser tests: pass
- Check: 4 standing gate: pass
- Check: 5 before/after numbers and screenshots in the run folder: pass
- Follow-up: note: residual primary-high as text on planes stays under 4.5:1 dark... -> notes.md
