---
id: T-0557
title: "Placeholders and links meet AA contrast, and ui-pagination marks the current page in forced colors"
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
The three High findings below are fixed: placeholder text in every text-entry control uses `--md-sys-color-neutral-placeholder` and meets 4.5:1 in light and dark, link text uses a role that meets 4.5:1 in light and dark, and ui-pagination's current page is distinguishable under `forced-colors: active`.

## Intent
- Do: change the CSS to use the right existing tokens and roles (add a role only if none fits, in the token source and its generator, never hand-editing generated files); measure each fixed pair's contrast in light, dark and forced colors in a real browser and report before and after numbers; screenshot before and after for each touched control.
- Non-goals: palette or HCT source changes; geometry.
- Done when: each fixed pair meets the stated ratio (numbers in the report); the touched controls' tests and the dogfood render lint pass (browser runs through `scripts/gate_lock.py`); `npm run check` exits 0.

## Context
From the T-0545 theme sweep (PR 2346). Kim approved these visual changes 2026-10-28:

### High

Proposed ticket: "Theme AA: placeholders onto the placeholder role, link ink onto an AA link role, and a forced-colors current-page mark for ui-pagination"

1. Placeholder ink fails AA in both schemes across the text-entry family.
   - Where: `components/src/controls/text-field/text-field.css:92`, `components/src/controls/textarea/textarea.css:66`, `components/src/controls/combo-box/combo-box.css:104`, `components/src/controls/select/select.css:65` (`--ui-select-ink`, the placeholder state), `app/src/controls/conversation/conversation-composer.css:50`, `code/src/editor/editor.css:43`; each reads `var(--md-sys-color-neutral)` (neutral-550 light, 450 dark, `shared/src/tokens/tokens.css:43`).
   - Evidence: measured 3.49:1 light and 4.18:1 dark on the idle field fill (text-field "e.g. ada" on `field-demo`, combo-box "Type or pick a fruit", select "Choose a plan", textarea, code-editor), 3.71:1 light at `size="sm"`. The fleet already defines `--md-sys-color-neutral-placeholder` (neutral-650 light, 350 dark, `tokens.css:61`) and no control reads it.
   - Fix: point each `--ui-*-placeholder` (and the empty-idle `--ui-*-ink` aliases at text-field.css:80, textarea.css:57, combo-box.css:93, select.css:65, editor.css:34, conversation-composer.css:39) at `--md-sys-color-neutral-placeholder`, and add a placeholder pair to the tokens.test.ts AA block.

2. `ui-pagination`'s current page disappears in forced colors.
   - Where: `components/src/controls/pagination/pagination.ts:143` marks the current stop only by `variant='soft'` (vs `ghost`); `components/src/controls/button/button.css:362` gives every variant the same ButtonText border under WHCM; `pagination.css` has no `forced-colors` block.
   - Evidence: `states/shots/pagination-demo.forced.s1.png` and `focus/shots/pagination.forced.png`: stops 4, 5 and 6 render identically. Computed diff between `[aria-current='page']` and a sibling stop under `forcedColors: active` is only `background-color rgba(255,255,255,0.1)` vs `rgba(255,255,255,0)` over a white Canvas. Same collapse on `pagination-doc` and `table-demo` (5 instances).
   - Fix: a `@media (forced-colors: active)` rule in `pagination.css` giving `[aria-current='page']` a Highlight fill with HighlightText ink (or a 2px border plus `text-decoration: underline`).

3. Link ink `--md-sys-color-primary` fails AA as text in light.
   - Where: `components/src/controls/text/text.css:251` (`--ui-text-link-ink`), `components/src/controls/source-list/source-list.css:34`, `router/src/controls/router-link/router-link.css:20`, `components/src/controls/service-card/service-card.css:62` (path).
   - Evidence: primary-550 light measured 3.85:1 on the page surface (markdown-doc link, router-doc "About", source-list-doc "Q3 Market Report") and 3.60:1 for the service-card path on its card fill; the service-card path is also 4.41:1 in dark. The tokens.test.ts surface-AA block (`shared/src/tokens/tokens.test.ts:138-160`) gates only the neutral on-surface and on-surface-variant inks, so no gate covers primary or neutral-550 as text.
   - Fix: a link ink role whose light leg is a darker primary step that clears 4.5:1 on every surface plane (gated in tokens.test.ts), and route the four tokens to it.

## Constraints
Tokens and generated CSS only through their generators (AGENTS.md, Never hand-edit). Screenshots are the evidence for a look. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. Placeholder and link inks clear 4.5:1 on every elevation plane in both schemes, the placeholder also on the idle field fill, and the replaced anchors fail (the negative control): `npx vitest run packages/agent-ui/shared/src/tokens/tokens.test.ts -t "T-0557"` exits 0.
2. The six text-entry controls read `--md-sys-color-neutral-placeholder` for the placeholder and empty-idle ink, the four link sites read `--md-sys-color-primary-placeholder`, and pagination.css carries a forced-colors current-page rule (Highlight fill, HighlightText ink, `forced-color-adjust: none`): `npx vitest run packages/agent-ui/components/src/controls/pagination/pagination-css.test.ts packages/agent-ui/components/src/controls/text/text-css.test.ts packages/agent-ui/components/src/controls/text-field/text-field-css.test.ts packages/agent-ui/components/src/controls/textarea/textarea-geometry.test.ts` exits 0.
3. The dogfood render lint passes: `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0.
4. The standing gate passes: `npm run check` exits 0.
5. Real-browser before and after numbers and screenshots (light, dark, forced) sit in `.sdlc/runtime/tasks/0557-theme-aa-fixes/{before,after}/` (summary.tsv, probe.json, shots/); every after placeholder and link row is at least 4.5, and `after/shots/pagination-demo.forced.png` shows the current page filled while `before/` shows it identical to its siblings.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: fcd4ce71bfda
- Changed: Placeholders and links meet AA in light and dark, and pagination marks the current page in forced colors
- Commits: none
- Check: 1 Placeholder and link inks clear 4.5:1 on every plane, negative control: pass
- Check: 2 Six text-entry controls and four link sites read the new roles, pagination forced-colors rule pre...: pass
- Check: 3 Dogfood render lint: pass
- Check: 4 `npm run check`: pass
- Check: 5 Real-browser before and after numbers and screenshots: pass
- Follow-up: note: the solo report's open item stands: a field on the dimmest light... -> notes.md
