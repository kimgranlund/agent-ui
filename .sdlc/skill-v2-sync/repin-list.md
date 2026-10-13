# T-0120 re-pin list: the test files the skill v2 constants turned red

Source: the unit suite and the six browser shards on `feat/skill-v2-sync` at `3f53cef8` (rebased onto main `f4305eb2`, T-0119 included); the commits after it change no stylesheet and no failing test. 157 failing tests in 69 files. Chromium and WebKit each count once under *engines*; the visual shard runs one engine. Grouped by the census lane partition (`laneOf` in `scripts/foundations-census.mjs`) so each group can run as its own file-disjoint lane. `result-card` rides a06 as it did in T-0107; `unlaned` is outside the partition.

Cause: the root moved one n down (product / sm is n 5 / 6 / 7, heights 20 / 24 / 28, was 24 / 28 / 32), so every literal v1 pixel is stale. The A2UI canvas (widget / md) reads the same 20 / 24 / 28. A lane re-pins with scale.mjs `resolve()` at the root register unless the test sets a region. `resolve()` keys were renamed by the skill (`control.margin`, `control.radius`, `page`, `type.groupLabel`, `type.sectionLabel`, `parts.*`); every existing read is already rewritten.

Columns: *pinned* is the value the test asserts and *measured* is what renders now (the vitest message reads "expected <measured> to be <pinned>"); *suite* is the shard.

Kinds. A *value pin* takes the derived value. A *golden* is re-minted after eye review. A *law check* is an inequality the smaller root no longer meets: look before changing the test. *Red on main too* fails on main `f4305eb2` as well and is not from this ticket.

The same red files were rerun on main: all green there except the four focus-timing tests marked below.

## Needs a look first (the law checks)

| file | what fails | why |
|---|---|---|
| `button/button-geometry.browser.test.ts`, `button/button-states.browser.test.ts` | control font < icon box | at the root md the control type n + 6 = 12 equals the icon box 2n = 12 (at sm 11 against 10); the law held only from n 7 up |
| `toolbar/toolbar.browser.test.ts` | min-block-size floor | the test floor is 28, the bar is 24 (4n at n 6) |
| `tabs/tabs.browser.test.ts` | vertical overflow trigger | the strip no longer overflows at the test's fixed box, so the trigger has no size |
| `_surface/container.browser.test.ts` | three tile cards at least 128 wide | the tiles measure 125.375 with the smaller type and padding |
| `site/pages/gen-ui-live-narrow.browser.test.ts` | the pre-scroll sliver under 60px | the smaller layout shows 90.9px of the canvas before the scroll |
| `site/pages/highlight-doc.browser.test.ts` | the gap above a heading greater than a literal 24 | `--md-sys-space-2xl` is now exactly 24 (4m at n 6) |

## Counts

| lane | files | failing tests |
|---|---|---|
| a01 | 20 | 38 |
| a02 | 8 | 21 |
| a03 | 6 | 14 |
| a04 | 3 | 6 |
| a05 | 5 | 30 |
| a06 | 9 | 21 |
| a07 | 7 | 12 |
| a08 | 2 | 4 |
| a09 | 1 | 1 |
| a10 | 6 | 8 |
| unlaned | 2 | 2 |

## a01 entry and action

### `packages/agent-ui/components/src/controls/button/button-geometry.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … [caret\|label\|icon]: the inline-pads are SYMMETRIC ½(h−icon) (role-AGNOSTIC), and the LEADING caret glyph = font < icon | components | 2 | 12 | 12 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

### `packages/agent-ui/components/src/controls/button/button-geometry.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ATIC geometry trip-wires (s11) 0 < glyph ≤ box: the content-icon ramp is positive and fits the height box at every size | unit | 1 | { sm: 12, md: 14, lg: 16 } | { sm: 10, md: 12, lg: 14 } | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button-label-overflow.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …label FITS a fitting label renders the SAME frame the pre-wrapper law specified: h=28, h/2=14 pads, no clipping engaged | components | 2 | 28 | 24 | value pin: take the resolve() value |
| … + label variant: geometry is unaffected by the wrapper — same [leading \| label] law as button-geometry.browser.test.ts | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button-states.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …icon (ADR-0012 §6, both engines) caret(content) ≈ font < icon(content) ≈ box-icon ≤ box; the caret centers at ½(h−font) | components | 2 | 12 | 12 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

### `packages/agent-ui/components/src/controls/button/button.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …button browser-truth harness (s12) mounts ui-button and a real engine resolves the --ui-button-* frame to a computed px | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …R-0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-button stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …visual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-button hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/combo-box/combo-box.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …223 slice-1 postures: fill default / [inline] hug) FILL (default): a bare ui-combo-box stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ssion (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the ui-combo-box hugs at its content floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/multi-select/multi-select.visual.browser.test.ts` (5 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …al regression (LLD §10: unselected / selected / disabled checkmark paint) unselected: no checkmark paints on any option | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … unselected / selected / disabled checkmark paint) selected: the checkmark paints on the tinted, selected option row(s) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … §10: unselected / selected / disabled checkmark paint) disabled: the whole listbox mutes to the disabled neutral roles | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …223 slice-1 postures: fill default / [inline] hug) FILL (default): a bare multi-select stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …gression (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the multi-select hugs at the 12ch floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/otp-field/otp-field.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …block = height off the row, gap = font/2) default [size=md]: cell inline-size equals block-size equals the height token | focus-timing | 2 | NaN | 24 | red on main too (not from T-0120): red on main too (not from T-0120): custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| …isplaces the cell row (GH #1487) the frame block-size stays pinned to the ramp height even while the message is visible | focus-timing | 2 | NaN | 24 | red on main too (not from T-0120): red on main too (not from T-0120): custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |

### `packages/agent-ui/components/src/controls/otp-field/otp-field.visual.browser.test.ts` (5 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …sion (LLD §12.4: empty / active / complete / disabled / user-invalid) empty: six idle cells, no active ring (unfocused) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …plete / disabled / user-invalid) partially filled, focused: filled cells + the active-cell ring on the first empty cell | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …-field — visual regression (LLD §12.4: empty / active / complete / disabled / user-invalid) complete: every cell filled | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …LD §12.4: empty / active / complete / disabled / user-invalid) disabled: every cell mutes to the disabled neutral roles | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … active / complete / disabled / user-invalid) user-invalid: the danger border paints on every cell after the first blur | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/pagination/pagination.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …23 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-pagination stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …al regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-pagination hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/segmented-control/segmented-control.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …geometry (both engines) segment geometry: block-size = --md-sys-height-md, padding-inline = height/2, padding-block = 0 | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/select/select.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …R-0223 slice-1 postures: fill default / [inline] hug) FILL (default): a bare ui-select stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …gression (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the ui-select hugs at its content floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/text-field/text-field-geometry.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …9) 0 < glyph ≤ box: the §1-SET icon ramp is positive and fits the height box at every size (the ADR-0245 root register) | unit | 1 | { sm: 12, md: 14, lg: 16 } | { sm: 10, md: 12, lg: 14 } | value pin: take the resolve() value |
| … reads the shared §1-SET --md-sys-icon-* table (not a local calc); height is an explicit literal (not × --md-sys-scale) | unit | 1 | [ 24, 28, 32 ] | [ 20, 24, 28 ] | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/text-field/text-field.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … (ADR-0223 slice-0 postures: fill default / [inline] hug) FILL (default): a bare field stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …n (ADR-0223 slice-0 postures: fill default / [inline] hug) [inline] hug: the field hugs at the ~20ch typing-width floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/textarea/textarea.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-textarea cross-engine geometry smoke — the multi-line law (both engines) [size] sm→md→lg CHANGES the editor font px | focus-timing | 2 | 13 | 11 | red on main too (not from T-0120): red on main too (not from T-0120): value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/textarea/textarea.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …0223 slice-1 postures: fill default / [inline] hug) FILL (default): a bare ui-textarea stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ession (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the ui-textarea hugs at its content floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/toggle/toggle.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ed) the WHOLE rendered box: adding icon/state-icon slots widens the frame beyond the bare label (never a collapsed dot) | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/toggle/toggle.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …R-0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-toggle stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …visual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-toggle hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/toolbar/toolbar.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …-R7, both engines) the min-block-size floor holds even with small content — the bar reads as a bar, not a collapsed dot | focus-timing | 2 | 28 | 24 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

## a02 indicators

### `packages/agent-ui/components/src/controls/checkbox/checkbox.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …heckbox browser smoke (S1 AC1–AC4) AC1 default: ::before box = 14×14 px (--md-sys-compact-md, the derived compact ramp) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| ui-checkbox browser smoke (S1 AC1–AC4) AC1 [size=sm] → 12px box; [size=lg] → 16px box (the compact ramp) | components | 2 | 12 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/checkbox/checkbox.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-checkbox stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …sual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-checkbox hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/radio/radio.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … box geometry (exact px, ADR-0041) radio-box-md: ::before circle = 14px (--md-sys-compact-md, the derived compact ramp) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …e — box geometry (exact px, ADR-0041) radio-box-sm: [size=sm] → 12px circle; [size=lg] → 16px circle (the compact ramp) | components | 2 | 12 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/radio/radio.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …DR-0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-radio stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … visual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-radio hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/slider-multi/slider-multi.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …moke (S2 AC1–AC4 + C10) AC1 default [size=md]: thumbs are (--md-sys-compact-md − 4px) = 10px (the derived compact ramp) | components | 2 | 10 | 8 | value pin: take the resolve() value |
| ui-slider-multi browser smoke (S2 AC1–AC4 + C10) AC1 [size=sm]: thumbs are (--md-sys-compact-sm − 4px) = 8px | components | 2 | 8 | 6 | value pin: take the resolve() value |
| ui-slider-multi browser smoke (S2 AC1–AC4 + C10) AC1 [size=lg]: thumbs are (--md-sys-compact-lg − 4px) = 12px | components | 2 | 12 | 10 | value pin: take the resolve() value |
| …moke (S2 AC1–AC4 + C10) AC1 rail-row track height equals --md-sys-compact-md (the interactive area = the box, GH #1141) | components | 2 | 14 | 12 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/slider/slider.browser.test.ts` (6 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …9 fill/rail bar the outer diameter of the ringed thumb is UNCHANGED — box − 4px still holds (border-box, ADR-0041 cl.3) | components | 2 | 10 | 8 | value pin: take the resolve() value |
| …-size exact px per [size]×[scale]) AC1 default: .rail block-size = 14px (--md-sys-compact-md, the derived compact ramp) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …k-size exact px per [size]×[scale]) AC1 [size=sm] → .rail block-size = 12px; [size=lg] → 16px (the compact widget ramp) | components | 2 | 12 | 10 | value pin: take the resolve() value |
| …thumb = box − 4px, the ADR-0042 Range-half ratification) AC2 default (size=md): thumb ::after width = 10px (14px − 4px) | components | 2 | 10 | 8 | value pin: take the resolve() value |
| … browser smoke (AC2 — thumb = box − 4px, the ADR-0042 Range-half ratification) AC2 [size=sm] → thumb = 8px (12px − 4px) | components | 2 | 8 | 6 | value pin: take the resolve() value |
| …browser smoke (AC2 — thumb = box − 4px, the ADR-0042 Range-half ratification) AC2 [size=lg] → thumb = 12px (16px − 4px) | components | 2 | 12 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/switch/switch.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …etry (ADR-0041) ADR-0041: track box = --md-sys-compact-{size} per [size] (the widget ramp, NOT the control height ramp) | components | 2 | 12 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/switch/switch.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …R-0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-switch stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …visual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-switch hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

## a03 atoms

### `packages/agent-ui/components/src/controls/attachment/attachment.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …23 slice-3 postures: fill default / [inline] hug) FILL (default): a bare ui-attachment stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … (ADR-0223 slice-3 postures: fill default / [inline] hug) [inline] hug: the ui-attachment hugs at the whole-shape floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/avatar/avatar.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …r, ADR-0038) default (size=md, no ancestor [scale]) → 28×28 box (--md-sys-height-md at ui-md scale — a button's height) | components | 2 | 28 | 24 | value pin: take the resolve() value |
| …DR-0038) [size=sm] → 24px box; [size=lg] → 32px box (the control-height ladder, 4n at the root register since ADR-0245) | components | 2 | 24 | 20 | value pin: take the resolve() value |
| …the button ladder, ADR-0038) data-scale md × size md → 36px (4n at product / md, ADR-0245 cl.3, the old ui-lg register) | components | 2 | 36 | 32 | value pin: take the resolve() value |
| …038) ui-avatar and ui-button share the same height row: the avatar box equals the derived control height (4n, ADR-0245) | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/sparkline/sparkline-foundations.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …5: the mark stroke max(1.5px, c/2)) inside a region the line stroke is the glyph stroke (c = 4 at content / lg, so 2px) | components | 2 | 2 | 1.5 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/stat/stat.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ADR-0223 slice-3 postures: fill default / [inline] hug) FILL (default): a bare ui-stat stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ession (ADR-0223 slice-3 postures: fill default / [inline] hug) [inline] hug: the ui-stat hugs at the whole-shape floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/text/text.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …olves to real px (ADR-0078) body/md (the bare default) resolves to 14px — the fully-M3-canonical size (ADR-0078 knob ①) | components | 2 | 14 | 13 | value pin: take the resolve() value |
| …m the region n (ADR-0245 cl.7) the scaled font-size differs from the unscaled baseline (anti-vacuous: the ramp is live) | components | 2 | 18.375 | 19 | value pin: take the resolve() value |
| … below the 52.5rem line (ADR-0150) bare size='lg' (the body-large row via :not([variant])) computes 15px below the line | components | 2 | 15 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/text/text.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … ADR-0110 pixel harness) host leg: an unstamped truncated ui-text in a 12rem box shows a clipped single line + ellipsis | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| … ADR-0110 pixel harness) stamped leg: a truncated ui-text stamped as="h4" in a 12rem box shows the SAME clipped gestalt | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

## a04 navigation and data display

### `packages/agent-ui/components/src/controls/calendar/calendar.visual.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …-0105 gestalt via the ADR-0110 pixel harness) (a) floor: a shrink-wrapped calendar panel matches the committed baseline | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …l harness) (b) wide: a 600px-stretched range-mode panel (fluid tracks + two-layer cells) matches the committed baseline | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …0223 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-calendar stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …lice-2 postures: fill default / [inline] hug) [inline] hug: the ui-calendar shrink-wraps (the pre-wave compact posture) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/table/table.visual.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … selection/sort anatomy) selectable=multi + sortable headers: ui-checkbox cells and ui-button headers, one row selected | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/tabs/tabs.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … the fit axis flips to BLOCK-size under vertical; the trigger sits at the strip column's block-end, a tab-height square | components | 2 | 0 | 0 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

## a05 containers

### `packages/agent-ui/components/src/controls/card/card.browser.test.ts` (8 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ngines) a nested card under the DEFAULT (unreseeded) root reads the same derived 3n as its parent, never a knife-edge 0 | components | 2 | 21 | 18 | value pin: take the resolve() value |
| … REVISED 2026-07-04: regions are INSET — uniform 7px gutters (derived n), frame↔region AND region↔region, never doubled | components | 2 | 7 | 6 | value pin: take the resolve() value |
| …es) NESTED card-content padding stays FLAT (14/7, derived) at every depth — no stepping law at all (REVISED 2026-07-04) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …(s7, both engines) a BARE card (no region children) renders region-equivalent padding + rhythm (ADR-0056, anti-vacuous) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …ke (s7, both engines) the STREAMING flip: a late-arriving ui-card-header drops the fallback + becomes a real region box | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …> card nesting (no region wrapper, outer card bare) reads its own 3n in both engines (ADR-0245 cl.6, ADR-0056 re-proof) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …ush to the frame + inherits the card OUTER radius on its leading corners; content below keeps its normal region padding | components | 2 | 7 | 6 | value pin: take the resolve() value |
| …GH #1204, both engines) non-hero cards render BYTE-IDENTICAL — negative control, no regression from the R3 CSS addition | components | 2 | 7 | 6 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/card/containers-foundations.browser.test.ts` (16 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …e; today outside inside the root register (md n 7): radius 21, region margin 7, region padding 14 / 7, region radius 14 | components | 2 | 21 | 18 | value pin: take the resolve() value |
| …dius 3n) inside; today outside a data-size region moves the whole chain: sm n 6 reads radius 18, lg n 8 reads radius 24 | components | 2 | 18 | 15 | value pin: take the resolve() value |
| modal and drawer: card level modal dialog radius is 21 inside, 12 outside | components | 2 | 21 | 18 | value pin: take the resolve() value |
| modal and drawer: card level modal regions get margin n + pad 2n inside (7 + 14) and 6 + 12 outside | components | 2 | 7 | 6 | value pin: take the resolve() value |
| modal and drawer: card level drawer dialog exposed-corner radius is 21 inside, 12 outside | components | 2 | 21 | 18 | value pin: take the resolve() value |
| …r, tooltip, toast: widget and group levels popover panel: widget level, radius and padding 14 inside; 12 and 12 outside | components | 2 | 14 | 12 | value pin: take the resolve() value |
| popover, tooltip, toast: widget and group levels tooltip panel: group level (n + c = 9) inside; 12 and 8 outside | components | 2 | 9 | 8 | value pin: take the resolve() value |
| …ast: widget and group levels toast: widget level, radius 14, padding 14 inline and 7 block inside; 12, 12 and 8 outside | components | 2 | 14 | 12 | value pin: take the resolve() value |
| …radius n, 2n slot, 2n - 2c glyph form-popover size=sm inside: height 24, radius 6, label edge 6, caret slot 12, glyph 8 | components | 2 | 24 | 20 | value pin: take the resolve() value |
| … inset, radius n, 2n slot, 2n - 2c glyph disclosure size=sm inside: summary height 24, edge 6, chevron slot 12, glyph 8 | components | 2 | 24 | 20 | value pin: take the resolve() value |
| …adius n, 2n slot, 2n - 2c glyph form-popover size=md inside: height 28, radius 7, label edge 7, caret slot 14, glyph 10 | components | 2 | 28 | 24 | value pin: take the resolve() value |
| …inset, radius n, 2n slot, 2n - 2c glyph disclosure size=md inside: summary height 28, edge 7, chevron slot 14, glyph 10 | components | 2 | 28 | 24 | value pin: take the resolve() value |
| …adius n, 2n slot, 2n - 2c glyph form-popover size=lg inside: height 32, radius 8, label edge 8, caret slot 16, glyph 12 | components | 2 | 32 | 28 | value pin: take the resolve() value |
| …inset, radius n, 2n slot, 2n - 2c glyph disclosure size=lg inside: summary height 32, edge 8, chevron slot 16, glyph 12 | components | 2 | 32 | 28 | value pin: take the resolve() value |
| …rm-popover panel is widget level inside (radius 14), today outside (12); trigger today outside (28, radius 12, edge 14) | components | 2 | 14 | 12 | value pin: take the resolve() value |
| command-modal: card level shell, 4n search row search row is 28 tall with edge 7 inside; 28 and 14 outside | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/disclosure/disclosure.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ole-shape, SPEC-R19 AC2) a bare instance in an unstyled flex row paints a non-collapsed summary row at the md ramp step | components | 2 | 28 | 24 | value pin: take the resolve() value |
| …e-shape, SPEC-R19 AC2) the chevron is sized = font (never the icon ramp) and rotates 90deg under [open] — no transition | components | 2 | 13 | 12 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/form-popover/form-popover.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … slice-1 postures: fill default / [inline] hug) FILL (default): a bare ui-form-popover stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …on (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the ui-form-popover hugs at its content floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/modal/modal.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …EVISED 2026-07-04: header/content/footer are now INSET — uniform 7px gutters (derived n), never doubled between regions | components | 2 | 7 | 6 | value pin: take the resolve() value |
| …REVISED 2026-07-04: the sticky header keeps its own 7px inset margin once scrolled (derived n) (margin survives sticky) | components | 2 | 7 | 6 | value pin: take the resolve() value |

## a06 preset widgets and charts

### `packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … with room paints the derived 42px cell; a narrow one gives way to the 34px floor and no further (ADR-0243 Amendment 2) | components | 2 | 42 | 36 | value pin: take the resolve() value |
| …: ADR-0245 derived foundations, dark launch reads today's value outside a data-tier region and the derived value inside | components | 2 | 42 | 36 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/column-chart/column-chart.visual.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …regression (ADR-0230 container-query chrome-degradation ladder) wide (>=28em): full chrome, no fine-density chip hidden | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …on (ADR-0230 container-query chrome-degradation ladder) medium (16em-28em): fine-density tier hidden, endpoints survive | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ression (ADR-0230 container-query chrome-degradation ladder) narrow (<16em): bare marks — only the columns mark remains | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …: ADR-0245 derived foundations, dark launch reads today's value outside a data-tier region and the derived value inside | components | 2 | 7 | 6 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/product-card/product-card.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …roduct-card: rendered geometry the action sits at the derived 28px height, the 13px control font (ADR-0243 Amendment 2) | components | 2 | 28 | 24 | value pin: take the resolve() value |
| …: ADR-0245 derived foundations, dark launch reads today's value outside a data-tier region and the derived value inside | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/product-card/product-card.visual.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …roduct-card: visual regression (ADR-0243 modes, ADR-0223 sizing postures) offer: image, badge, rating, price and action | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …oduct-card: visual regression (ADR-0243 modes, ADR-0223 sizing postures) exhibit tile: icon header, no price, no action | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …sion (ADR-0243 modes, ADR-0223 sizing postures) FILL (default): a bare ui-product-card stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …sual regression (ADR-0243 modes, ADR-0223 sizing postures) [inline] hug: the ui-product-card hugs its own content width | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/result-card/result-card.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ard: the producer buttons at the lg step every direct ui-button child carries size lg and renders the derived 32px tall | components | 2 | 32 | 28 | value pin: take the resolve() value |
| …: ADR-0245 derived foundations, dark launch reads today's value outside a data-tier region and the derived value inside | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/result-card/result-card.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …e empty-box law, the 360px minimum) the four outcomes and the empty-box card, two columns at 968px (the mockup section) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …(ADR-0244 outcomes, the empty-box law, the 360px minimum) win at the 360px frame minimum: stats wrap, buttons keep 36px | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/service-card/service-card.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …: ADR-0245 derived foundations, dark launch reads today's value outside a data-tier region and the derived value inside | components | 2 | 28 | 24 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/service-card/service-card.visual.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …on (ADR-0224 availability postures + ADR-0223 sizing postures) available: the accent edge/dot/title read success-tinted | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ability postures + ADR-0223 sizing postures) unavailable: the accent edge/dot/title mute + the chip reads "Unavailable" | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ailability postures + ADR-0223 sizing postures) FILL (default): a bare ui-service-card stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ADR-0224 availability postures + ADR-0223 sizing postures) [inline] hug: the ui-service-card hugs its own content width | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

## a07 app (packages/agent-ui/app)

### `packages/agent-ui/app/src/controls/agent-admin/agent-admin-chat-surface.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …0019) chromium: a streamed Card in the Test Chat paints its regions inset and seats the trailing Badge on the title row | app | 1 | 14px | 12px | value pin: take the resolve() value |
| …T-0019) webkit: a streamed Card in the Test Chat paints its regions inset and seats the trailing Badge on the title row | app | 1 | - | see: @[native code] | layout consequence: look before re-pinning |

### `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …nt-admin.css entry-add-content (rows=8, the drawer figure) renders a real computed min-height matching the rows formula | app | 2 | 156 | 154 | value pin: take the resolve() value |
| …s entry-content's rendered min-height (proves the mechanism; catches a future competing CSS rule that WINS the cascade) | app | 2 | 228 | 226 | value pin: take the resolve() value |
| …nt render the SAME computed padding despite agent-admin.css declaring two different literal values for them (both dead) | app | 2 | 6 | 5 | value pin: take the resolve() value |

### `packages/agent-ui/app/src/controls/conversation/conversation-composer.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …DR-0223 slice-1 postures: fill default / [inline] hug) FILL (default): a bare composer stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the composer hugs at the ~20ch typing-width floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/app/src/controls/entry-list/entry-list.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … §Acceptance) a non-drawered kind's entry-content (rows=4) renders a real computed min-height matching the rows formula | app | 2 | 84 | 82 | value pin: take the resolve() value |

### `packages/agent-ui/app/src/controls/nav-rail/nav-rail-geometry.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-nav-rail geometry across the data-tier dark launch reads the derived tokens inside product/md | app | 2 | 36 | 32 | value pin: take the resolve() value |

### `packages/agent-ui/app/src/controls/nav-rail/nav-rail.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …le (both engines) font-size/font-weight/letter-spacing resolve to the kicker-small register, uppercased at the consumer | app | 2 | 10 | 9 | value pin: take the resolve() value |

### `packages/agent-ui/app/src/controls/nav-rail/nav-rail.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …H #368, ADR-0110 harness) (a) card: the open panel is a content-sized, four-side-bordered card offset below its trigger | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …68, ADR-0110 harness) (b) clipper: the same card opened inside a 44px overflow:hidden ancestor escapes it (SPEC-R5 AC3) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

## a08 a2ui (packages/agent-ui/a2ui)

### `packages/agent-ui/a2ui/src/catalog/personas/box-region.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …egion (18px) between the felt and the Deal row; chips, stepper and Clear at 32px (lg on the canvas register), 8px apart | rest | 2 | 32 | 28 | value pin: take the resolve() value |

### `packages/agent-ui/a2ui/src/catalog/personas/concierge/concierge.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …y card (T-0085) every field shows its visible label, no month grid renders inline, ink sits 22px in and Reserve is 28px | rest | 2 | 22 | 19 | value pin: take the resolve() value |
| … summary card (T-0085) arrival and departure fields share a row in the 480px column and stack in the 336px phone column | rest | 2 | 14 | 12 | value pin: take the resolve() value |
| … with no nested card, side by side at 480px and stacked at 336px, inputs at md and buttons at sm (ADR-0245 Amendment 2) | rest | 2 | 14 | 12 | value pin: take the resolve() value |

## a09 code (packages/agent-ui/code)

### `packages/agent-ui/code/src/editor/editor.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …l.3, dark launch, both engines) outside any region: today's geometry holds (font * 0.5 / 0.75 padding, the 24px toggle) | focus-timing | 2 | 6 | 5 | red on main too (not from T-0120): red on main too (not from T-0120): value pin: take the resolve() value |

## a10 site (site/)

### `site/gallery.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …men (both engines) a scale change resizes a specimen, a tier change re-sizes it again, and BOTH revert to their default | site | 2 | 28 | 24 | value pin: take the resolve() value |

### `site/pages/_page.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …l artifact (AC17, the GH #170 sign-off input) narrow, nav CLOSED — the nav pane is hidden behind the header menu toggle | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …, the GH #170 sign-off input) narrow, nav OVERLAY-OPEN — the full vertical rail restored as an overlay, X glyph + scrim | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `site/pages/a2ui-live.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| a2ui-live chrome re-host (ADR-0156) — wide resting shape the ui-super-shell composition renders the re-baselined rects | site | 2 | 21 | 18 | value pin: take the resolve() value |
| …x): the fixed sidebar holds the chat pane stays pinned at its fixed 26rem width — it does not shrink with content width | site | 2 | 21 | 18 | value pin: take the resolve() value |

### `site/pages/command-modal-demo.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …on and derived inside inside data-tier="product" data-scale="md" the same row measures 4n tall at n 9 (36px, 15px type) | site | 2 | 36px | 32px | value pin: take the resolve() value |

### `site/pages/gen-ui-live-narrow.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …er a real turn renders a surface, the render pane genuinely scrolls into view instead of vanishing behind an outer clip | site | 2 | 60 | 90.90625 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

### `site/pages/highlight-doc.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …H #1264) heading -> paragraph rhythm rides the doc-body scale (2xl above a heading, lg under a paragraph, 72ch measure) | site | 2 | 24 | 24 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

## unlaned outside the census partition

### `packages/agent-ui/components/src/controls/_surface/container.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …rn-dashboard-tiles shape) three tile cards in a ~600px established wrap row render content-sized, disjoint, single line | components | 2 | 128 | 125.375 | law check: an inequality the smaller root no longer meets; needs a look, not a plain re-pin |

### `packages/agent-ui/components/src/controls/glyph/glyph.visual.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-glyph: visual regression the twelve marks at product / sm, sizes sm, md and lg | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

