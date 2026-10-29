---
id: T-0558
title: "Secondary text leaves the neutral fill role, dark primary-high text meets AA, and the super-shell scrim uses the backdrop token"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The three Medium findings below are fixed: secondary text (nav-rail labels, calendar outside days) uses an ink role, not the neutral fill role, and meets 4.5:1; dark-mode primary-high text meets 4.5:1; the super-shell scrim and its shadow use the same backdrop token as ui-modal.

## Intent
- Do: change the CSS to use the right existing tokens and roles (add a role only if none fits, in the token source and its generator, never hand-editing generated files); measure each fixed pair's contrast in light, dark and forced colors in a real browser and report before and after numbers; screenshot before and after for each touched control.
- Non-goals: palette or HCT source changes; geometry.
- Done when: each fixed pair meets the stated ratio (numbers in the report); the touched controls' tests and the dogfood render lint pass (browser runs through `scripts/gate_lock.py`); `npm run check` exits 0.

## Context
From the T-0545 theme sweep (PR 2346). Kim approved these visual changes 2026-10-28:

### Medium

Proposed ticket: "Theme AA: secondary ink off the neutral fill role, dark primary-high near misses, and the super-shell scrim onto a token"

1. `--md-sys-color-neutral` used as secondary text ink.
   - Where: `app/src/controls/nav-rail/nav-rail.css:42` (`--ui-nav-rail-meta-ink`, read at :129 and :223), `components/src/controls/calendar/calendar.css:84` (`--ui-calendar-outside-ink`).
   - Evidence: nav-rail group labels and trailing tag column 4.11:1 light on every site page (the docs shell); calendar outside-month days 3.86:1 light (`calendar-demo` "27"). Dark passes.
   - Fix: `--md-sys-color-neutral-on-surface-variant` (or the placeholder role for the calendar's dimmed days).

2. `--md-sys-color-primary-high` ink just under AA in dark.
   - Where: `components/src/controls/toggle/toggle.css:86`, `components/src/controls/option-compare/option-compare.css:58`.
   - Evidence: toggle "Chat" 4.37:1 (an ancestor background-image was not composited; re-measure in the fix) and option-compare "Best" pill 4.41:1 in dark; light passes.
   - Fix: lighten the dark leg one ramp step for ink use, or read `--md-sys-color-primary-on-surface-variant` in dark.

3. Super-shell scrim and overlay shadow are literals outside the token system.
   - Where: `app/src/controls/super-shell/super-shell.css:618`, `:764`, `:870` (`background: rgb(0 0 0 / 0.32)`), `:52` (`--ui-super-shell-overlay-shadow: ... rgb(0 0 0 / 0.25)`).
   - Evidence: quoted lines; `ui-modal` routes the same role through `--md-sys-color-dialog-backdrop` (`components/src/controls/modal/modal.css:42`), so the shell's scrim cannot be themed and the three copies can drift.
   - Fix: one `--ui-super-shell-scrim` token pointing at a shared scrim role, used at all three sites.

## Constraints
Tokens and generated CSS only through their generators (AGENTS.md, Never hand-edit). Screenshots are the evidence for a look. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. Every fixed text pair measures at least 4.5:1 in light, dark and forced colors in Chromium: run `node .sdlc/runtime/tasks/0558-theme-secondary-ink/contrast.mjs "$PWD" .sdlc/runtime/tasks/0558-theme-secondary-ink/shots/verify` and read `contrast.json` (nav-rail kicker and tag, calendar outside day "27", pressed toggle "Chat"/"Settings" using `pixelRatio`, option-compare "Best" pill; the disabled pressed toggle is WCAG-exempt). The super-shell scrim row reads the backdrop role (`oklch(0 0 0 / 0.8)`).
2. The touched jsdom tests pass: `npx vitest run packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/toggle packages/agent-ui/components/src/controls/option-compare packages/agent-ui/app/src/controls/nav-rail packages/agent-ui/app/src/controls/super-shell`
3. The touched browser tests pass (through `gate_lock.py`): `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/toggle packages/agent-ui/components/src/controls/option-compare packages/agent-ui/app/src/controls/nav-rail packages/agent-ui/app/src/controls/super-shell`
4. The touched visual baselines match: `npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/toggle packages/agent-ui/components/src/controls/option-compare packages/agent-ui/app/src/controls/nav-rail packages/agent-ui/app/src/controls/super-shell`
5. The dogfood render lint passes: `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts`
6. `npm run check` exits 0.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: fcd4ce71bfda
- Changed: Secondary text in nav-rail, calendar, toggle and option-compare meets AA in light and dark, and the super-shell scrim matches ui-modal
- Commits: none
- Check: 1 Every fixed text pair at least 4.5:1 in light, dark, forced; scrim reads backdrop role: pass
- Check: 2 jsdom tests: pass
- Check: 3 browser tests (packages project, via gate_lock): pass
- Check: 4 visual baselines (visual project, via gate_lock): pass
- Check: 5 dogfood render lint (site project, via gate_lock): pass
- Check: 6 `npm run check` exits 0: pass
- Follow-up: decide: super-shell.css:55 the overlay scrim goes from 0.32 to 0.8 alpha to... -> notes.md
- Follow-up: note: .sdlc/AGENTS.md and .sdlc/tickets/roadmap.md modifications in the... -> notes.md
