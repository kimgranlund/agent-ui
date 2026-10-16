---
id: T-0306
title: "Agent-admin Settings pane: redundant section select, a lone-field card, and a filled overflow trigger"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Agent tab of agent-admin's Settings pane looks like the rest of the pane (Kim 2026-10-16, design-mode screenshot of the Croupier).

## Findings
1. `ui-settings`' compact `section-select` (`packages/agent-ui/app/src/controls/settings/settings.css:79-82`, `settings.ts:231`) shows an "Agent" dropdown above the Name field although the host's Agent/Capabilities/Surface tabs and the Agent heading already navigate; it is also inset by the panel padding (not aligned with the card) and butts against the Name card with no gap.
2. The Name field sits alone in a rounded card while the Model card frames rows; frame it like the Model card (nested-card and concentric radius rules, `.claude/docs/references/geometry.md`, `dogfood-lint.md`).
3. The tabs "More tabs" overflow trigger (`packages/agent-ui/components/src/controls/tabs/tabs.ts:330`, styled in tabs.css) is a filled circle; it should be ghost: transparent idle, the low container wash only on hover and press, same square pill geometry (Kim).

## Done when
- A screenshot of the real pane at 400 and 1000px, light and dark, next to Kim's screenshot shows the three fixes (evidence cache, not the repo).
- Tests that pin each change (the section select hidden when the host navigates, or aligned with a gap; the overflow trigger's idle background transparent); red at the base.
- The settings and tabs tests, the dogfood render lint for the touched widgets, and `npm run check` exit 0.

## Acceptance criteria
verifier: L3

Kim ruling (2026-10-16) on the section select: "just show the options by default". Every settings section renders in the page in its own fold (Agent in the Agent fold, the T-0185 Model section in the Model fold), and no section select renders in the pane. Reading of finding 2: each settings unit is its own card in its fold; the generated panel inside carries no card of its own.

tests: packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts, packages/agent-ui/components/src/controls/tabs/tabs.browser.test.ts, packages/agent-ui/components/src/controls/tabs/tabs-css.test.ts

- (red) `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts -t T-0306` exits 0: `ui-settings` carries the entry-card chrome and its panel none; in the compact band no section select renders, the Model fields (max tokens) are visible inside the Model fold, and the Agent fold holds only the Agent section.
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/tabs/tabs.browser.test.ts -t T-0306` exits 0 (red at a1b93141, recorded pre-edit in the first pass): the overflow trigger's idle background is transparent, its hover background is the neutral container-low role, and it stays a round square.
- `npx vitest run packages/agent-ui/components/src/controls/tabs/tabs-css.test.ts -t T-0306` exits 0 (red at a1b93141, recorded pre-edit in the first pass): the resting token is transparent and one rule washes hover and press.
- `npx vitest run packages/agent-ui/app/src/controls/settings packages/agent-ui/app/src/controls/agent-admin packages/agent-ui/components/src/controls/tabs` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/settings packages/agent-ui/app/src/controls/agent-admin packages/agent-ui/components/src/controls/tabs` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0.
- `npm run check` exits 0.
- Screenshots of the real Settings pane at 400 and 1000px, light and dark, before and after, sit beside Kim's screenshot in `/private/tmp/claude-501/scratch/t0306-shots/` (not the repo).

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Merged; every section shown, ghost overflow; verifier L3 pass) · verifier: verifier-L3 (fable) · base: a1b9314153a0
- Changed: see commits
- Commits: none
- Check: 1 (red) `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/...: pass
- Check: 2 `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components...: pass
- Check: 3 `npx vitest run packages/agent-ui/components/src/controls/tabs/tabs-css.test.ts -t T-0306` exits 0: pass
- Check: 4 `npx vitest run packages/agent-ui/app/src/controls/settings packages/agent-ui/app/src/controls/ag...: pass
- Check: 5 `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/co...: pass
- Check: 6 `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browse...: pass
- Check: 7 `npm run check` exits 0: pass
- Check: 8 Screenshots at 400 and 1000px, light and dark, before and after, beside Kim's screenshot in `/pri...: pass
