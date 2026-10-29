---
id: T-0567
title: "primary-high meets AA as text in every theme pack"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`primary-high` meets WCAG AA (4.5:1) as text on its planes in the default theme and every theme pack, light and dark.

## Intent
- Do: fix the `primary-high` role's tone pick in the token source and the theme pack generator (`wrap-pack.ts --repoint`) so text on n-200 light and n-800 dark reaches 4.5; pin each pair in a tokens test that fails on base; before and after numbers plus screenshots.
- Non-goals: other roles; geometry.
- Done when: the new tests fail on base and pass after; the dogfood render lint and touched tests pass (browser runs through `scripts/gate_lock.py`); `npm run check` exits 0.

## Context
From T-0560 (PR 2360): `primary-high` as text is under 4.5 on dark n-800 in default 4.39, amethyst 4.36, indigo 4.45, meadow 4.39, ocean 4.30, orchid 4.23, ruby 4.19, and on light n-200 in ember 4.46, lagoon 4.45. Kim approved fixing it 2026-10-29. Prefer a tone change of the role over a palette or HCT source change; if only a source change reaches AA, report the numbers and stop for Kim.

## Constraints
No em dashes. No paid runs. Never hand-edit generated files.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
Scope: `primary-high` as text on the seven elevation planes per scheme, in tokens.css and all ten theme packs. The legs are derived by wrap-pack.ts `repointText` (walk from 650 light / 400 dark away from the planes to the first stop that clears 4.5:1), so tokens.css and every pack are a fixed point of the same rule.
- (red) `primary-high` and every other gated text ink clear 4.5:1 on every plane in tokens.css and all ten packs, light and dark: `node .sdlc/runtime/tasks/0567-primary-high-text-contrast/probe.mjs .` exits 0.
- The tokens, theme-pack, wrap-pack and router-link tests pass, including the new `primary-high` pins (tokens.css and each pack on every plane, the wrap-pack walk): `npx vitest run packages/agent-ui/shared/src/tokens packages/agent-ui/router/src/controls/router-link` exits 0.
- The new pins fail on base tokens (the base tokens.css and packs under the new tests), recorded in the run folder: `ls .sdlc/runtime/tasks/0567-primary-high-text-contrast/tests-red-on-base.txt` exits 0.
- The primary-high consumer browser tests and the dogfood render lint pass: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/button/button-states.browser.test.ts packages/agent-ui/app/src/controls/nav-rail site/lib/theme-provider-build.browser.test.ts site/lib/theme-pack-apply.browser.test.ts site/pages/dogfood-render.browser.test.ts` exits 0.
- The standing gate passes: `npm run check` exits 0.
- Before and after numbers and screenshots with measured results sit in the run folder: `ls .sdlc/runtime/tasks/0567-primary-high-text-contrast/before.txt .sdlc/runtime/tasks/0567-primary-high-text-contrast/after.txt .sdlc/runtime/tasks/0567-primary-high-text-contrast/shots/before .sdlc/runtime/tasks/0567-primary-high-text-contrast/shots/after` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 4b1be4538010
- Changed: primary-high meets AA as text in the default theme and every pack, light and dark
- Commits: none
- Check: 1 (red) primary-high and every gated ink clear 4.5:1 on every plane in tokens.css and ten packs: pass
- Check: 2 tokens, theme-pack, wrap-pack and router-link tests: pass
- Check: 3 new pins fail on base tokens: pass
- Check: 4 browser consumers and dogfood render lint: pass
- Check: 5 `npm run check`: pass
- Check: 6 before/after numbers and screenshots: pass
- Follow-up: note: tests-red-on-base.txt is builder-recorded; I confirmed base redness... -> notes.md
