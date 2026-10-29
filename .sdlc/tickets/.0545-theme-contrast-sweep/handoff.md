---
id: T-0545
title: "Theme sweep: every control in light, dark and high contrast, token-only colors and contrast ratios"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of theme defects: controls that use hard-coded colors instead of `--md-sys-color-*` or `--ui-*` tokens, text or focus rings below WCAG AA contrast in light, dark or high-contrast themes, and states that disappear in one theme.

## Intent
- Do: grep CSS and TS under `packages/agent-ui/components/src` and `packages/agent-ui/app/src` for hex, rgb() and named colors outside token definitions; screenshot each control family in light, dark and `forced-colors: active` (Chromium emulation) and measure contrast of text, placeholder, disabled, focus ring and selected states. Write `## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Findings

Method: (1) Static scan of every non-test `.css` and `.ts` under `packages/agent-ui/components/src` and `packages/agent-ui/app/src` with comments stripped, for hex, `rgb()`/`hsl()`/`oklch()`/`color()` and named colors; `white-space` and `#0000` mask stops removed by reading. TS has no color literals outside the color-picker's parser and the generated dogfood bundle. (2) Browser sweep: vite dev plus Playwright Chromium (headless, through `gate_lock.py`) over all 190 `site/*-demo.html` and `*-doc.html` pages in `colorScheme: light`, `dark`, and `forcedColors: active`: a viewport screenshot per page and mode (570 shots), WCAG 2 contrast for every visible text node inside a `ui-*` host and every `::before`/`::after` string (placeholders), with the background composited up the ancestor chain and colors resolved to sRGB through canvas; 4.5 for text, 3 for large text. (3) Focus: every distinct focusable per control on the 90 demo pages focused with keyboard modality (`:focus-visible` matched on all 146), ring color composited against the adjacent opaque background, 3:1. (4) State collapse: every selected/checked/pressed/current item compared against an unselected sibling on the painted properties (ink, background composited on Canvas, borders, outline, decoration, weight, pseudo-elements). Evidence: `.sdlc/runtime/tasks/0545-theme-contrast-sweep/{sweep,focus,states}/` (`sweep.json`, `text-fails.tsv`, `states.json`, `shots/`). Default theme only; the ten packs under `shared/src/tokens/themes/` are not swept.

Clean: no focus ring below 3:1 in either scheme (minimum 3.6 light, 3.85 dark, both `ui-button`); every focusable keeps an outline in forced colors (145 of 146; the 146th, the calendar day, draws its ring on `::before` and is visible in `focus/shots/calendar-demo.light.focus-2.png`). No body text in dark fails outside the items below. False positives removed on reading: the selected `ui-segment` and calendar day (ink measured against the ancestor, but the fill is the host's moving indicator or a `::before`); `ui-board-grid` intent corner (aria-hidden glyph, non-text, 4.30 clears 3:1); demo-page text with inline `opacity` (site page code, not a control: `site/pages/choice-card-demo.ts:45`, `radio-demo.ts:49`, `pie-chart-demo.ts:62`). Paths below are relative to `packages/agent-ui/`.

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

### Low

Proposed ticket: "Theme hygiene: drop dead literal fallbacks, a shadow token, and forced-colors polish"

1. Dead light-scheme literal fallbacks inside `var()`: `components/src/controls/calendar/calendar.css:92-116`, `:140`, `:362`, `:366`, `:380-381`, `:414`, `:430`, `:437`; `components/src/controls/color-picker/color-picker.css:45`, `:51-52`. The component tokens are always declared in the same file (calendar.css:72-84), so the `#fff`/`#0057d8`/`#767676` legs never paint, but they encode light values only. Fix: remove the fallbacks.
2. Toast shadow literal `components/src/controls/toast/toast.css:41` (`rgb(0 0 0 / 0.15)`); no elevation shadow token exists. Fix: an elevation shadow token shared with super-shell's overlay shadow.
3. Deliberate scheme-invariant literals, documented and tested: `components/src/controls/image/image.css:34` (caption scrim `oklch(0 0 0 / 65%)`), `components/src/controls/video/video.css:20` (letterbox `oklch(0 0 0)`). Fix: none needed; optionally alias to named media tokens.
4. The calendar's selected day keeps brand colors under WHCM (`calendar.css:362-367`, `forced-color-adjust: none`), ignoring the user's palette. Fix: Highlight/HighlightText in a forced-colors block.
5. A standalone `ui-segment[checked]` (no host) shows no checked state in any mode (`segment-doc` "Examples (standalone)", state probe identical in light, dark and forced) because the indicator belongs to `ui-segmented-control`. Fix: say so in `segment.md` or drop the checked example.
6. In forced colors, `ui-pie-chart` slices and legend dots all render CanvasText (`sweep/shots/pie-chart-demo.forced.png`); identity rests on order plus the printed percent, as designed. Fix: none, or vary the slice stroke dash.
7. `ui-audio` under Chromium forced-colors emulation loses the native bar's play, volume and menu glyphs (`sweep/shots/audio-demo.forced.png` vs `.light.png`); `audio.css:8-12` delegates WHCM to the UA. Unconfirmed on a real Windows host. Fix: check on Windows HC before acting.

## Acceptance criteria
- `## Findings` is grouped High / Medium / Low; every finding carries file:line, evidence and a one-line fix; each group names a proposed ticket.
- High findings are confirmed by a run (measured ratios or screenshots under `.sdlc/runtime/tasks/0545-theme-contrast-sweep/`) or a quoted line.
- `git status --short -- . ':!.sdlc'` prints nothing.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 28364f644b58
- Changed: Theme sweep: AA contrast and forced-colors findings across 190 pages with proposed tickets
- Commits: none
- Check: 1 `## Findings` grouped High / Medium / Low, every finding with file:line, evidence and a one-line ...: pass
- Check: 2 High findings confirmed by a run or quoted line: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: handoff Findings High #2 says the computed diff in forced colors is... -> notes.md
- Follow-up: note: the theme packs are unswept default theme only, as the report... -> notes.md
- Follow-up: note: No red criteria; redck.py deviations printed no process deviation. -> notes.md
