---
doc-type: ticket
id: tkt-0046
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0046 — audit the interactive control fleet for drift from the ADR-0008/0009/0010 state-styling standard

## Summary
Fleet-wide audit request: verify that every interactive `ui-*` control's border/background/text-color
styling stays internally consistent across its idle/hover/active/focus/disabled states, and consistent
*with the other controls* — not a single reported instance, a request to check the whole fleet against
itself. The repo already has a ratified, checkable standard for exactly this
(`.claude/docs/references/interaction-states.md`, distilling ADR-0008/ADR-0009/ADR-0010), but it was
written against `ui-button` as the "first consumer" (2026-06-27) and has not been swept against every
control that shipped since. This ticket is that sweep.

The canonical standard, so the audit has a concrete checklist rather than a vibe:
- **hover/active** repaint `background` to a dedicated per-state role-ladder step
  (`--ui-{cmp}-bg-hover`/`-bg-active`, sourced from `--md-sys-color-{f}-dim`/`-hover`/`-high`/`-active`
  etc.) — **never** a component-authored `color-mix()` (ADR-0008's explicit anti-pattern, "the
  escalation: do not synthesize a shade").
- **focus** is the *one shared* `:focus-visible` ring — `--md-sys-color-focus-ring` +
  `--ui-focus-ring-width`/`-offset`, identical on every control, never a per-control opinion (ADR-0009).
- **disabled** is inert three ways (not focusable / not activatable / announced) via the `tabbable` trait
  + a control-level `ariaDisabled` effect (ADR-0010), with the visual hold falling out structurally
  (`pointer-events: none` on the disabled host means `:hover`/`:active` can never match — no separate
  disabled-lift styling should be needed).
- **motion**: only `background-color`/`color`/`border-color` (+ `box-shadow`/`opacity`/caret `transform`
  if used) transition, gated behind a post-first-paint `:state(ready)`, honoring
  `prefers-reduced-motion`.
- Border-color and text-color (ink) are not mandated to vary per-state by the standard — most controls
  keep ink/border constant across hover/active and only step `background`. Where a control DOES vary
  border-color or ink per state, it should follow the same dedicated-token-role discipline as the bg
  ladder (no ad hoc `color-mix`, no literal color values), and the audit should flag any place border/ink
  IS varied inconsistently between controls that look like they should behave the same way (e.g. two
  outlined-variant controls where one repaints border-color on hover and the other doesn't, with no
  documented reason).

## Acceptance
- A per-control findings table for every genuinely interactive `ui-*` control (buttons/toggles/inputs/
  menus/tabs/etc. — excludes pure Display/Container primitives with no interaction states: `ui-text`,
  `ui-avatar`, `ui-stat`, `ui-sparkline`, `ui-bar-chart`, `ui-table`, `ui-card` unless it has an
  interactive variant, `ui-timeline-item`, `ui-column`/`ui-row`/`ui-grid`/`ui-list`, `ui-field`,
  `ui-form-provider`, `ui-theme-provider`, `ui-icon`) covering: (a) does hover/active use the
  `--ui-{cmp}-bg-hover`/`-bg-active` role-ladder pattern, or a `color-mix`/literal-value deviation; (b)
  does focus use the shared `--md-sys-color-focus-ring` recipe verbatim, or a per-control ring; (c) does
  disabled follow the `tabbable`+`ariaDisabled` contract (or the `UIFormElement` platform-`disabled`
  variant it's documented to differ by); (d) does border-color/ink vary per state, and if so, via a
  dedicated token role or an ad hoc value.
- Every real deviation found is evidence-grounded: a `file:line` citation, not "control X looks off" —
  matching this repo's own precedent (TKT-0042's ADR-0106-citing evidence bar).
- Per this repo's established "per-control evidence, not a blanket fix" discipline (ADR-0106's own
  Alternatives — the same reasoning that governed TKT-0042's badge/tabs deferral), this audit ticket
  itself does **not** attempt to fix every finding in one patch. It closes by either (a) fixing findings
  that are trivial/mechanical and low-risk directly (e.g. a literal hex value that should read a token
  that already exists), with a dated Findings entry per fix, or (b) filing separate, scoped follow-up
  tickets for anything that needs its own design judgment or touches a control's shipped contract —
  named and linked from this ticket's Findings, not left as a vague "should audit later" note.
- `npm run check && npm test` stay green for anything actually changed as part of this ticket.

## Repro
No fixed repro — this is a fleet-wide consistency sweep, not a single reproducible instance. The
checklist above is the audit's working "repro": for each interactive control, render idle → hover →
active → focus-visible → disabled and compare the CSS mechanism used against
`interaction-states.md`'s recipe.

## Expected vs actual
- **Expected:** every interactive control's border/background/text-color state styling follows the same
  ratified mechanism (dedicated `--ui-{cmp}-bg-hover/-active` role-ladder tokens, the one shared focus
  ring, the `tabbable`/`ariaDisabled` disabled contract) — so two controls with the same variant channel
  (e.g. two "filled" controls) look and behave identically across states, and no control invents its own
  color-mix or literal-value shortcut.
- **Actual:** unknown until the sweep runs — `interaction-states.md` was written against `ui-button` alone
  and has not been checked against the rest of the fleet built since 2026-06-27. This ticket exists to
  find out, not because a specific violation is already confirmed.

## Classification
Axis: **structural/consistency** (cross-cutting adherence to a ratified-but-unswept standard, not one
component's isolated bug) — plane: every interactive control under
`packages/agent-ui/components/src/controls/*` against
`.claude/docs/references/interaction-states.md` (ADR-0008/ADR-0009/ADR-0010).

## Severity
**cosmetic** — no functional break presumed; this is an internal-consistency/visual-polish sweep. Would
be re-classified upward only if the audit surfaces a real accessibility regression (e.g. a control
missing the focus ring or the disabled AX contract entirely, which would be a real a11y defect, not
cosmetic).

## Links
- `.claude/docs/references/interaction-states.md` (the canonical checklist this audit runs against)
- `.claude/docs/adr/0008-interaction-state-styling-standard.md` (hover/active role-ladder standard)
- `.claude/docs/adr/0009-focus-ring-token-standard.md` (shared focus ring)
- `.claude/docs/adr/0010-tabbable-trait-aria-disabled.md` (disabled inert contract)
- `packages/agent-ui/components/src/controls/button/button.css` (the standard's first, reference
  consumer — the pattern every other control should match)

## Findings

### 2026-07-14 — full fleet sweep + one mechanical fix

Swept every control under `packages/agent-ui/components/src/controls/` against
`interaction-states.md`. Scope determined by opening each control's `.css`/`.ts` for real
`:hover`/`:active`/`:focus-visible`/`[disabled]` selectors; controls whose only interactive
surface is a composed `ui-button`/`ui-slider`/`ui-text-field` (already fleet-compliant by
construction) or a native/author-provided element are marked "composed" below rather than
re-audited part-by-part.

**Findings table** — control × the five checklist checks (bg-ladder · focus-ring · disabled
contract · border/ink · motion):

| control | hover/active bg | focus ring | disabled | border/ink | motion | verdict |
|---|---|---|---|---|---|---|
| `ui-button` (button.css) | dedicated `-bg-hover/-active` role-ladder tokens (ADR-0008 amendment roles) | exact shared recipe | token-repoint, `pointer-events:none` structural hold | n/a (bg only) | `:state(ready)`-gated, reduced-motion zeroed | **PASS — the reference control** |
| `ui-checkbox` (checkbox.css) | **no `:hover` rule at all** — `::before`'s bg/border never change on hover | exact shared recipe | token-repoint, structural hold | n/a | unconditional transition (see ADR-0042 note below) | **DEVIATION — missing hover, routed → TKT-0047 item 1** |
| `ui-switch` (switch.css) | `--ui-switch-track-hover` dedicated token, real role (ADR-0059) | exact shared recipe | token-repoint, structural hold | n/a | unconditional transition | checked, no action (motion — see ADR-0042 note) |
| `ui-radio` (radio.css) | `:hover::before{border-color:var(--ui-radio-ink)}` — dedicated token | exact shared recipe on host | **`opacity:0.5`**, comment admits "v1, no danger repoint needed" | border-color varies via dedicated token — fine | unconditional transition | **DEVIATION — opacity disabled, routed → TKT-0047 item 2** |
| `ui-slider` (slider.css) | no `:hover` (rail/thumb static until drag) | exact shared recipe | token-repoint (rail/fill/thumb/ring all repointed), structural hold | thumb ring varies via dedicated token | unconditional transition | checked, no action — Range class, no hover affordance is the established shape (matches slider-multi) |
| `ui-slider-multi` (slider-multi.css) | no `:hover` | exact shared recipe (component-local token tunnel) | token-repoint, structural hold | thumb border via dedicated token | unconditional transition, own file comment cites "the Indicator/Range family pattern" | checked, no action |
| `ui-checkbox`/`ui-switch`/`ui-radio`/`ui-slider`/`ui-slider-multi` motion | — | — | — | — | **none arm `:state(ready)`** (button does) | checked, no action — **ADR-0042 cl.2 explicitly rules** the Indicator/Range family motion pattern is "unconditional CSS transitions + reduced-motion... the base does NOT arm `:state(ready)` — a ready gate is dead in an indicator, unlike ui-button." Citation verified against the ADR text. Not a bug. |
| `ui-tabs`/`ui-tab` (tabs.css) | ink-only hover via dedicated `--ui-tabs-ink-hover` (no bg fill to step — text-channel row) | exact shared recipe (deliberately inset offset — adjacent-siblings-with-no-margin reason, documented) | n/a (no disabled tab in v1) | ink varies via dedicated token | `:state(ready)`-gated, reduced-motion zeroed | PASS |
| `ui-menu` (menu.css) | `--ui-menu-item-bg-hover`, dedicated token, real role — file comment records a 2026-07-07 fix that REMOVED a `color-mix`/tint-alpha wash in favor of this | exact shared recipe (outset, fixed 2026-07-07 from an inset treatment) | ink-repoint + `pointer-events:none` | ink varies via dedicated token | none declared (no `:state(ready)`, no `transition` on item hover) | PASS on tokens; motion note only — items snap instantly, consistent with menu having no button-style press affordance |
| `ui-select` (select.css) | trigger: border-only ladder (`-border-hover`), Control-class entry-field pattern, matches text-field; options: dedicated `-bg-hover`/`-bg-selected`/`-bg-focus` tokens | exact shared recipe (trigger + options) | full token-repoint block (`border`/`bg`/`ink` → muted roles) | border varies via dedicated token | `:state(ready)`-gated on trigger, reduced-motion zeroed | PASS |
| `ui-combo-box` (combo-box.css) | editor: border-only ladder, matches select/text-field; options: `[data-active]`/`[aria-selected]` dedicated tokens (no literal `:hover`, by design — active-descendant pattern unifies pointer+keyboard highlight into one attribute, unlike select's roving-focus dual state) | **FIXED THIS PASS**: was literal `outline: 2px solid …; outline-offset: 2px` instead of `var(--ui-focus-ring-width)`/`var(--ui-focus-ring-offset)` — combo-box.css:187-188 | **`opacity:0.5`, no comment, and no `:where(ui-combo-box[disabled])` token block at all** (unlike sibling `select.css:151-156`) | border varies via dedicated token | no `:state(ready)` on editor (not checked further — not this pass's focus) | **MECHANICAL FIX APPLIED** (focus-ring tokens) + **DEVIATION routed → TKT-0047 item 2** (disabled opacity) |
| `ui-text-field` (text-field.css) | border-only ladder, full state set (idle/hover/focus/invalid/invalid-hover), every step a dedicated token | exact shared recipe, drawn on host via `:focus-within` (documented ADR-0014 dev#1 divergence from `:focus-visible` — a text field must show the ring on ANY focus including mouse click, not keyboard-only) | full token-repoint block | border varies via dedicated token | `:state(ready)`-gated, reduced-motion zeroed | PASS — this is the pattern combo-box/textarea both correctly mirror |
| `ui-textarea` (textarea.css) | border-only ladder, matches text-field exactly | exact shared recipe, `:focus-within` (same documented ADR-0014 dev#1 rationale) | full token-repoint block | border varies via dedicated token | `:state(ready)`-gated, reduced-motion zeroed | PASS |
| `ui-calendar` (calendar.css) | nav buttons + gridcells: dedicated hover tokens | exact shared recipe (nav buttons + gridcells) | **`opacity:0.5`**, but WITH a documented rationale in the file: "opacity applies to the whole stacking context (button + both pseudo layers together)... no separate pseudo overrides needed" | non-color signifiers for range/selected per ADR-0057/ADR-0093 | not checked in depth (out of this pass's focus — no red flags surfaced) | checked, no action — documented multi-layer rationale |
| `ui-color-picker` (color-picker.css) | composes `ui-slider` (channels) + `ui-text-field` (readout) — both already fleet-compliant; own parts are the 2D pad + eyedropper button | pad: exact recipe but **inset offset using `--ui-focus-ring-width` as the inset multiplier** (not `--ui-focus-ring-offset`), commented "inset — the pad already has its own border"; eyedropper: exact recipe | **`opacity:0.5`**, documented: "muted (the effectiveDisabled channel forwards disabled onto the composed channel sliders + readout independently)" | n/a | not checked in depth | checked, no action — documented rationale, same class as calendar |
| `ui-disclosure` (disclosure.css) | **no `:hover` rule on the summary row at all** | exact shared recipe | n/a (no disabled prop) | n/a | no transition declared (chevron rotation deliberately un-transitioned per ADR-0113/SPEC-R18 — documented, unrelated to this finding) | **DEVIATION — missing hover, routed → TKT-0047 item 3** |
| `ui-segment` / `ui-segmented-control` (segment.css/segmented-control.css) | dedicated `-bg-hover`/`-bg-active` tokens on unselected segments, real roles, disabled correctly suppresses both washes to `transparent` | exact shared recipe | structural — `[disabled]` rule blanks the hover/active bg back to transparent (no separate `disabled` token block needed, since the unselected segment carries no idle fill to mute) | ink varies via dedicated token (selected vs unselected) | indicator `transform` transitions (`:state(ready)` not used — Pattern-class, no first-paint flash risk since the indicator starts hidden via `opacity:0` until a selection exists); hover/active bg has **no transition** declared (instant, unlike button) | checked, no action — the untransitioned hover/active wash is a minor/cosmetic motion gap, judged not worth its own ticket line (no visible flash risk since bg starts at a stable value either way) |
| `ui-badge` (badge.css) | n/a | n/a | n/a | n/a | n/a | **excluded per ticket scope** — SPEC-R11 non-interactive, file's own header states "No interaction states at all" |
| `ui-field` (field.css) | n/a | n/a | n/a (repoints label/description ink off the SLOTTED control's `[disabled]`, not its own) | n/a | unconditional transition on the error part, documented as deliberate (INDICATOR-pattern, no first-paint risk since the error can't show at first paint) | **excluded per ticket scope** — Container/layout primitive |
| `ui-text` (text.css) | n/a for the primitive itself; its opt-in `a[href]` hyperlink leg has `:hover`/`:focus-visible` | the `a[href]` leg uses the exact shared recipe | n/a | link ink via dedicated `--ui-text-link-ink` token | n/a | **excluded per ticket scope** (Display primitive) — noted only because its hyperlink capability happens to be a clean textbook example of the recipe |
| `ui-card` / `ui-card-content` (card.css) | n/a — no interactive/clickable card variant exists (verified: no click/interactive wiring in card.ts) | scroll-mode `ui-card-content` is a real keyboard tab stop (hidden-scrollbar accessibility fix) — ring drawn on the PARENT card via `:has(> ui-card-content:focus-visible)`, exact shared recipe, documented rationale (avoids the child's own `overflow:auto` clipping a ring drawn on it) | n/a | n/a | n/a | checked, no action — PASS on the one real interactive surface |
| `ui-toolbar` (toolbar.css) | composed — items are real `ui-button`/`button`/`a[href]`/`[role=button]`; toolbar itself only manages roving tabindex, paints nothing | composed | composed | composed | composed | checked, no action — composed |
| `ui-tooltip` (tooltip.css) | n/a — the anchor is author-provided content (e.g. a real `<button>`); tooltip itself is a non-interactive content bubble | n/a | n/a | n/a | n/a | checked, no action — no component-owned interactive chrome |
| `ui-popover` (popover.css) | n/a — trigger is the author's first child element, popover styles only the panel surface | n/a | n/a | n/a | n/a | checked, no action — no component-owned interactive chrome |
| `ui-toast`/`ui-toast-region` (toast.css) | composed — action/close buttons are real `document.createElement('ui-button')` instances (toast.ts:173,190) | composed | composed | composed | composed | checked, no action — composed |
| `ui-modal` (modal.css) | n/a | n/a | n/a | n/a | n/a | checked, no action — **ui-modal has no built-in close-button chrome at all**; dismissal is native `<dialog>` Escape/backdrop or agent-driven `open=false`; any visible close affordance is author-authored content (e.g. a slotted `ui-button`), already covered elsewhere |
| `ui-command-modal` (command-modal.css) | option rows: `[data-active]` dedicated token (active-descendant pattern, like combo-box) | exact shared recipe (not shown in table detail, verified present) | **`opacity:0.5` on `[aria-disabled='true']`, no comment** | n/a | not checked in depth | **DEVIATION — undocumented opacity disabled, routed → TKT-0047 item 2** |
| `ui-swiper` family (swiper.css, swiper-paddles.css, swiper-pagination.css) | paddles: composed `ui-button` (swiper-paddles.ts:46,57); track/pagination dots: own `:focus-visible` only, no hover (drag/tap surface, no discrete hover target) | exact shared recipe on track + dots | n/a (coordinator toggles composed `ui-button`s' own `disabled`) | n/a | pagination dot transition is `:state(ready)`-gated (swiper.css's own comment: "reused here rather than inventing a new one") | checked, no action |
| `ui-split`/`ui-split-pane` (split.css) | n/a — resize is pointer-drag, not hover-driven | `[data-separator]:focus-visible` present, exact recipe | not checked in depth | n/a | file's own header states NO transitions anywhere are deliberate (a resize must track the pointer 1:1, "never a CSS transition" — documented, unrelated to this ticket) | checked, no action |
| `ui-attachment`, `ui-progress`, `ui-status-stream` | n/a | n/a | n/a | n/a | n/a | **out of scope** — each file's own header states "Non-interactive, non-form-associated leaf" |

**Mechanical fix applied this pass** (`npm run check && npm test` green; the two pre-existing
failures in `site/lib/sitemap.test.ts` / `site/lib/theme-provider-build-fixture.test.ts` are
unrelated to this change — reproduced on a clean stash before this edit, from concurrent
in-session work on other tickets):

- `combo-box.css:187-188` — the editor's `:focus` ring used literal `2px`/`2px` instead of
  `var(--ui-focus-ring-width)`/`var(--ui-focus-ring-offset)`. Same visual result today (the tokens
  currently resolve to `2px`), but hardcoded rather than reading the shared fleet tokens like
  every other control — a straight copy of the recipe already used by `select.css`,
  `text-field.css`, `checkbox.css`, etc., zero design judgment. Fixed to read the tokens.

**Findings needing design judgment** — filed as
[TKT-0047](tkt-0047-interaction-state-design-gaps-from-fleet-audit.md)
(`.claude/docs/tickets/tkt-0047-interaction-state-design-gaps-from-fleet-audit.md`):

1. `ui-checkbox` has no `:hover` state at all, unlike sibling Indicator controls `ui-switch`/
   `ui-radio` (checkbox.css).
2. Three controls disable via bare `opacity:0.5` with no documented rationale, diverging from the
   fleet's dominant token-repoint disabled discipline: `radio.css:191` (comment admits "v1"
   debt), `combo-box.css:202` (no disabled token block exists at all), `command-modal.css:140`
   (no comment). NOTE: `calendar.css` and `color-picker.css` also use opacity for disabled but
   **both carry a documented multi-layer-stacking-context rationale** — judged intentional,
   excluded from the follow-up ticket.
3. `ui-disclosure`'s summary row has no hover feedback, unlike sibling Pattern-class rows
   `ui-tabs`/`ui-menu` (disclosure.css).

All three are cosmetic-severity consistency gaps, not accessibility regressions — every affected
control still has a compliant focus ring and a functionally inert disabled state.
