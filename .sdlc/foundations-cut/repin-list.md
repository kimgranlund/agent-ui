# T-0107 re-pin list: the component browser files the cut turned red

Source: `npm run test:browser:packages:components` on `feat/foundations-cut` at `c852d3fb`: 197 failing results from 99 tests in 33 files (Chromium and WebKit each count once). Grouped by the census lane partition (`LANES` in `scripts/foundations-census.mjs`) so each group can run as its own file-disjoint lane. A lane re-pins with scale.mjs `resolve()` at the root register (product / sm) unless the test sets a region.

Columns: *pinned* is the old value the test asserts and *measured* is what the cut renders now (the vitest message reads "expected <measured> to be <pinned>"); *engines* is how many of Chromium and WebKit fail the test.

Kinds. A *value pin* takes the derived value. An *outside leg* keeps today's value under `data-foundations="legacy"`, as the lane foundations tests already do. A *custom property read* parses the raw text of a bridge or derived token, which is now an unregistered `calc()` and reads as NaN, so it needs a probe-box read first. A *layout consequence* needs a look before re-pinning.

| lane | files | failing tests |
|---|---|---|
| a01 | 11 | 29 |
| a02 | 6 | 20 |
| a03 | 5 | 17 |
| a04 | 3 | 10 |
| a05 | 3 | 14 |
| a06 | 5 | 9 |

## a01 entry and action (text-field, select, combo-box, multi-select, suggestions, button, toggle, segmented-control, rating)

### `packages/agent-ui/components/src/controls/button/button-geometry.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| rs smoke (s13) > [size] sm→md→lg CHANGES the frame height + font px - on BOTH the bare and icon+label variants | 2 | 36 | 32 | value pin: take the resolve() value |
| abel\|icon]: the inline-pads are SYMMETRIC ½(h−icon) (role-AGNOSTIC), and the LEADING caret glyph = font < icon | 2 | 13 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button-label-overflow.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| variant: geometry is unaffected by the wrapper - same [leading \| label] law as button-geometry.browser.test.ts | 2 | 5 | 7 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button-states.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| 012 §6, both engines) > caret(content) ≈ font < icon(content) ≈ box-icon ≤ box; the caret centers at ½(h−font) | 2 | 13 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/combo-box/combo-box.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ape DoD law) > editor computed padding-inline == --ui-combo-box-height / 2 (the fleet h/2 value-edge standard) | 2 | 14 | 7 | value pin: take the resolve() value |
| collapsed caret rect is vertically centered on the placeholder line (within 2px) and glyph-sized, not box-tall | 2 | 1 | NaN | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |

### `packages/agent-ui/components/src/controls/multi-select/multi-select.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| default [size=md]: the selected option row height matches the ramp; the checkmark renders within the icon cell | 2 | NaN | 10 | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| cell, both engines) > [size=sm] and [size=lg] repoint the row-height lever off the ramp (no ad hoc size value) | 2 | 24 | NaN | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |

### `packages/agent-ui/components/src/controls/rating/rating.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| moke - widget-box geometry (ADR-0041) > default: each star svg = 16×16 px (--md-sys-compact-md at ui-md scale) | 2 | 16 | 14 | value pin: take the resolve() value |
| owser smoke - widget-box geometry (ADR-0041) > [size=sm] → 14px star; [size=lg] → 18px star (the compact ramp) | 2 | 14 | 12 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/segmented-control/segmented-control.browser.test.ts` (4 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| O explicit orientation): display:grid, equal-width cells, one outer rounded track, ZERO inter-segment dividers | 2 | 137.328125 | 139.328125 | value pin: take the resolve() value |
| k + segment geometry (both engines) > vertical: a real stack - equal-height cells, ZERO inter-segment dividers | 2 | 30 | 32 | value pin: take the resolve() value |
| es) > horizontal: indicator sizes to one cell, translateX == selectedIndex × cellWidth, and slides on reselect | 2 | 135.328125 | 137.328 | value pin: take the resolve() value |
| ing indicator (both engines) > vertical: indicator sizes to one cell, translateY == selectedIndex × cellHeight | 1 | 56 | 59.9688 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/select/select.browser.test.ts` (4 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| i-vacuous (B4, both engines) > [size=sm] → trigger height = 24px; [size=md] = 28px; [size=lg] = 36px (§1-ramp) | 2 | 36 | 32 | value pin: take the resolve() value |
| gines) > panel inset (margin) + option inline-pad sum to h/2 at sm/md/lg - the alignment law, browser-measured | 2 | 12 | 6 | value pin: take the resolve() value |
| oth engines) > option row rendered height == trigger height at sm/md/lg - the row-height law, browser-measured | 2 | 36 | 32 | value pin: take the resolve() value |
| ines) > option font-size resolves to --ui-select-font at each size (options were size-blind on font - bug fix) | 2 | 16 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/suggestions/suggestions.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| populated set paints a non-collapsed host; each chip block-size == the compact-realm box (--md-sys-compact-lg) | 2 | 18 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts` (9 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ) > [size] sm→md→lg CHANGES the frame height + the editor font px - on BOTH the bare and leading-icon variants | 2 | 36 | 32 | value pin: take the resolve() value |
| smoke (s11, both engines) > BARE: the value edge == h/2 on BOTH inline sides (the slotless value-edge formula) | 2 | 14 | 7 | value pin: take the resolve() value |
| engines) > LEADING-ICON: the trailing value edge == h/2 and the leading slot edge == ½(h−icon); 0 < icon ≤ box | 2 | 14 | 7 | value pin: take the resolve() value |
| th engines) > search type: magnifier + clear-button font-size == --ui-text-field-font across [size] - EXACT px | 2 | 13 | 12 | value pin: take the resolve() value |
| (s11 Wave-3, both engines) > number type: step-up / step-down font-size == --ui-text-field-font at each [size] | 2 | 13 | 12 | value pin: take the resolve() value |
| currency type: leading symbol font-size == --ui-text-field-font at each [size] (§4.6 inline affordance = font) | 2 | 13 | 12 | value pin: take the resolve() value |
| ngines) > unit/percent suffix font-size == --ui-text-field-font at each [size] (§4.6 inline affordance = font) | 2 | 13 | 12 | value pin: take the resolve() value |
| sphor-icon sweep: injected <svg> glyphs (magnifier / clear / steppers) paint at a real, non-collapsed 1em size | 2 | 13 | 14 | value pin: take the resolve() value |
| time codec (s11 Wave-5B, both engines) > GESTALT: type=time field is wider than tall in a flex row (not a dot) | 2 | 28 | 16 | layout consequence of the smaller boxes: confirm it is not a regression, then re-pin |

### `packages/agent-ui/components/src/controls/toggle/toggle.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| gine geometry (s13-shaped) > [size] sm→md→lg CHANGES the frame height + font px - bare and icon+label variants | 2 | [ 24, 28, 36 ] | [ 24, 28, 32 ] | value pin: take the resolve() value |

## a02 indicators (checkbox, radio, switch, slider, slider-multi, choice-card)

### `packages/agent-ui/components/src/controls/checkbox/checkbox.browser.test.ts` (3 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| heckbox browser smoke (S1 AC1–AC4) > AC1 default: ::before box = 16×16 px (--md-sys-compact-md at ui-md scale) | 2 | 16 | 14 | value pin: take the resolve() value |
| ui-checkbox browser smoke (S1 AC1–AC4) > AC1 [size=sm] → 14px box; [size=lg] → 18px box (the compact ramp) | 2 | 14 | 12 | value pin: take the resolve() value |
|  AC1–AC4) > outside any region the marks keep today's shape: radius box/5, check 60% x 55% inset 20%, dash 2px | 2 | 3.2 | 3.5 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/choice-card/choice-card.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
|  and tick geometry > outside any region the badge is 1.25rem, the tick 0.75rem x 0.65rem, centred on the badge | 2 | [ 20, 20 ] | [ 14, 14 ] | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/radio/radio.browser.test.ts` (3 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| metry (exact px, ADR-0041) > radio-box-md: ::before circle = 16px (--md-sys-compact-md at default ui-md scale) | 2 | 16 | 14 | value pin: take the resolve() value |
| metry (exact px, ADR-0041) > radio-box-sm: [size=sm] → 14px circle; [size=lg] → 18px circle (the compact ramp) | 2 | 14 | 12 | value pin: take the resolve() value |
| moke - box geometry (exact px, ADR-0041) > outside any region the dot keeps today's 56% of the box (22% inset) | 2 | 8.96 | 6 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/slider-multi/slider-multi.browser.test.ts` (4 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| AC4 + C10) > AC1 default [size=md]: thumbs are (--md-sys-compact-md − 4px) × 2 = 12px (at default ui-md scale) | 2 | 12 | 10 | value pin: take the resolve() value |
| i-slider-multi browser smoke (S2 AC1–AC4 + C10) > AC1 [size=sm]: thumbs are (--md-sys-compact-sm − 4px) = 10px | 2 | 10 | 8 | value pin: take the resolve() value |
| i-slider-multi browser smoke (S2 AC1–AC4 + C10) > AC1 [size=lg]: thumbs are (--md-sys-compact-lg − 4px) = 14px | 2 | 14 | 12 | value pin: take the resolve() value |
| 1–AC4 + C10) > AC1 rail-row track height equals --md-sys-compact-md (the interactive area = the box, GH #1141) | 2 | 16 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/slider/slider.browser.test.ts` (7 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
|  bar > the outer diameter of the ringed thumb is UNCHANGED - box − 4px still holds (border-box, ADR-0041 cl.3) | 2 | 12 | 10 | value pin: take the resolve() value |
| act px per [size]×[scale]) > AC1 default: .rail block-size = 16px (--md-sys-compact-md at default ui-md scale) | 2 | 16 | 14 | value pin: take the resolve() value |
| t px per [size]×[scale]) > AC1 [size=sm] → .rail block-size = 14px; [size=lg] → 18px (the compact widget ramp) | 2 | 14 | 12 | value pin: take the resolve() value |
|  the ADR-0042 Range-half ratification) > AC2 default (ui-md, size=md): thumb ::after width = 12px (16px − 4px) | 2 | 12 | 10 | value pin: take the resolve() value |
| ke (AC2 - thumb = box − 4px, the ADR-0042 Range-half ratification) > AC2 [size=sm] → thumb = 10px (14px − 4px) | 2 | 10 | 8 | value pin: take the resolve() value |
| ke (AC2 - thumb = box − 4px, the ADR-0042 Range-half ratification) > AC2 [size=lg] → thumb = 14px (18px − 4px) | 2 | 14 | 12 | value pin: take the resolve() value |
| ui-slider geometry inside an opt-in data-tier region (ADR-0245) > outside any region the rail is 3px | 2 | 3 | 4 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/switch/switch.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| 041) > ADR-0041: track box = --md-sys-compact-{size} per [size] (the widget ramp, NOT the control height ramp) | 2 | 14 | 12 | value pin: take the resolve() value |
|  thumb geometry (ADR-0041) > track inline-size ≈ 1.8× the box; the pill is wider than tall (density-invariant) | 2 | 25.2 | 24 | value pin: take the resolve() value |

## a03 atoms (badge, avatar, icon, glyph, text)

### `packages/agent-ui/components/src/controls/avatar/avatar.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ment 3 - the button ladder, ADR-0038) > [size=sm] → 24px box; [size=lg] → 36px box (the control-height ladder) | 2 | 36 | 32 | value pin: take the resolve() value |
| adder, ADR-0038) > ui-avatar and ui-button share the same height row: the avatar box equals --md-sys-height-md | 2 | NaN | 28 | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |

### `packages/agent-ui/components/src/controls/badge/badge.browser.test.ts` (5 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
|  a bare labeled badge in an unstyled flex row paints a non-collapsed box == --md-sys-compact-lg (18px default) | 2 | 18 | 14 | value pin: take the resolve() value |
| > an EMPTY label still floors at min-inline-size == the box (a filled dot/pill, never a sliver - SPEC-R13 AC2) | 2 | 17.5 | 14 | value pin: take the resolve() value |
| C1, test-the-whole-shape) > border-radius resolves to box/2 (the pill - the compact realm's "count pill" case) | 2 | 7 | 3.5 | value pin: take the resolve() value |
| DR-0041) > padding-inline == 2px + box·0.375·density (density=1 default); the BOX stays fixed at every density | 2 | 7.25 | 4 | value pin: take the resolve() value |
| NOT h/2 (SPEC-R13 AC1, ADR-0041) > no [size] attribute repoints the box (SPEC-R13 AC3 - v1 ships no size axis) | 2 | 18 | 16 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/glyph/glyph.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| h geometry outside any region (the dark launch) > the slot is 1em and the inset 0.125em, so the mark is 0.75em | 2 | { w: 16, h: 16 } | { w: 14, h: 14 } | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/icon/icon-geometry.browser.test.ts` (4 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| -engine > an ui-icon in a [data-role="icon"] cell fills it: rendered svg box == --ui-button-icon (NO CSS edit) | 2 | 0 | NaN | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| -icon in a [data-role="caret"] cell insets to font-rhythm: rendered svg box == --ui-button-glyph (NO CSS edit) | 2 | 0 | NaN | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| > anti-vacuous: the SAME icon asset renders at two genuinely DIFFERENT sizes purely from ambient cell geometry | 2 | NaN | 14 | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| collapsed > a resolved and an unresolvable glyph render the EXACT SAME host box size (same --md-sys-icon-size) | 2 | 16 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/text/text.browser.test.ts` (5 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
|  to real px (ADR-0078) > display/sm → 36px · title/lg → 22px · body/md → 14px (the ADR-named computed samples) | 2 | 36 | 27 | value pin: take the resolve() value |
|  px (ADR-0078) > the 9 variants at size=md produce distinct computed font-sizes (the matrix is genuinely live) | 2 | 6 | 8 | value pin: take the resolve() value |
| eal px (ADR-0078) > a bare <ui-text size='lg'> (no [variant]) hits the body/large row - the absent-variant law | 2 | 16 | 15 | value pin: take the resolve() value |
|  below the 52.5rem line (ADR-0150) > body/md (the bare default) computes 13px below the line - was 14 at/above | 2 | 13 | 14 | value pin: take the resolve() value |
| em line (ADR-0150) > a non-body role does NOT shift: headline/md stays 28px (the override is body-column-only) | 2 | 28 | 24 | value pin: take the resolve() value |

## a04 navigation and data display (tabs, calendar, timeline-item)

### `packages/agent-ui/components/src/controls/calendar/calendar.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ment 2, both engines) > the nav header is INSET (margin + sticky offset = the 6px box inset, not full-bleed/0) | 2 | '6px' | '7px' | value pin: take the resolve() value |
| 046 Amendment 2, both engines) > the day grid carries the same 6px direct-child inset margin as the nav header | 2 | '6px' | '7px' | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/tabs/tabs.browser.test.ts` (7 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ible panel (both engines) > ArrowRight roves focus to the next tab and shows its panel; ArrowLeft/Home/End too | 2 | 36 | 28 | value pin: take the resolve() value |
| sity 1 the tablist column-gap/gap is 16px (space-xs 4px + space-md 12px); a rendered tab is padding-inline:0px | 2 | 16 | 11 | value pin: take the resolve() value |
| H #221, both engines) > at 252px the strip overflows and SCROLLS; every tab still holds its whole nowrap label | 2 | 253 | 252 | layout consequence of the smaller boxes: confirm it is not a regression, then re-pin |
| tribute) ui-tabs has no aria-orientation, no shell flex/row, and the #542/#543 horizontal probes are untouched | 2 | 16 | 11 | value pin: take the resolve() value |
| set; divider + indicator ride the inline-end edge; labels start-align; zero padding-inline holds; 16px row gap | 2 | 16 | 11 | value pin: take the resolve() value |
| Σ(visible widths)+gaps ≤ (available − reserve); adding the next tab overflows it - the fit is tight, not slack | 2 | NaN | 211 | custom property read: the test parses an unregistered calc() token as text (NaN); read it through a probe box, then re-pin |
| axis flips to BLOCK-size under vertical; the trigger sits at the strip column's block-end, a tab-height square | 2 | 0 | 0 | layout consequence of the smaller boxes: confirm it is not a regression, then re-pin |

### `packages/agent-ui/components/src/controls/timeline-item/timeline-item.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| ] sm→md→lg resolves the EXACT frozen integers at the default [scale] (marker-box/dot/connector/gutter/row-gap) | 2 | 14 | 12 | value pin: take the resolve() value |

## a05 containers (card, modal, disclosure)

### `packages/agent-ui/components/src/controls/card/card.browser.test.ts` (9 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| a NESTED card radius DECREMENTS one level - measured px == max(--md-sys-space-xs, parent − padding) (ADR-0018) | 2 | 18 | 21 | value pin: take the resolve() value |
| th engines) > a nested card under the DEFAULT (unreseeded) root radius keeps a small floor, not a knife-edge 0 | 2 | 12 | 21 | value pin: take the resolve() value |
| el] REVISED 2026-07-04: regions are INSET - uniform 6px gutters, frame↔region AND region↔region, never doubled | 2 | 6 | 7 | value pin: take the resolve() value |
| ) > NESTED card-content padding stays FLAT (12/6) at every depth - no stepping law at all (REVISED 2026-07-04) | 2 | 12 | 14 | value pin: take the resolve() value |
| ngines) > a BARE card (no region children) renders region-equivalent padding + rhythm (ADR-0056, anti-vacuous) | 2 | 12 | 14 | value pin: take the resolve() value |
| h engines) > the STREAMING flip: a late-arriving ui-card-header drops the fallback + becomes a real region box | 2 | 12 | 14 | value pin: take the resolve() value |
| ard > card nesting (no region wrapper, outer card bare) stays the pre-existing manual case - ADR-0056 re-proof | 2 | 12 | 14 | value pin: take the resolve() value |
| e frame + inherits the card OUTER radius on its leading corners; content below keeps its normal region padding | 2 | 6 | 7 | value pin: take the resolve() value |
| oth engines) > non-hero cards render BYTE-IDENTICAL - negative control, no regression from the R3 CSS addition | 2 | 6 | 7 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/disclosure/disclosure.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| SPEC-R19 AC2) > a bare instance in an unstyled flex row paints a non-collapsed summary row at the md ramp step | 2 | 14 | 13 | value pin: take the resolve() value |
| EC-R19 AC2) > the chevron is sized = font (never the icon ramp) and rotates 90deg under [open] - no transition | 2 | 13 | 14 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/modal/modal.browser.test.ts` (3 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
|  the dialog shell has NO padding (box-model); a content region carries the FIXED 12/6 padding; the frame HOLDS | 2 | 12 | 14 | value pin: take the resolve() value |
| > REVISED 2026-07-04: header/content/footer are now INSET - uniform 6px gutters, never doubled between regions | 2 | 6 | 7 | value pin: take the resolve() value |
|  > REVISED 2026-07-04: the sticky header keeps its own 6px inset margin once scrolled (margin survives sticky) | 2 | 6 | 7 | value pin: take the resolve() value |

## a06 preset widgets (board-grid, game-hud, product-card, result-card, service-card)

### `packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts` (3 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| om paints the 46px mockup cell; a narrow one gives way to the 34px floor and no further (ADR-0243 Amendment 2) | 2 | 46 | 42 | value pin: take the resolve() value |
| -0046 box model (Amendment 7) > the frame is the 6px box inset; the cell gap stays the tight 4px data-grid gap | 2 | 4 | 2 | value pin: take the resolve() value |
| derived foundations, dark launch > reads today's value outside a data-tier region and the derived value inside | 2 | 46 | 42 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| derived foundations, dark launch > reads today's value outside a data-tier region and the derived value inside | 2 | 19 | 7 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/product-card/product-card.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| red geometry > the action sits at the control ramp lg step: 36px tall, the 16px lg font (ADR-0243 Amendment 2) | 2 | 36 | 28 | value pin: take the resolve() value |
| derived foundations, dark launch > reads today's value outside a data-tier region and the derived value inside | 2 | 36 | 28 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/result-card/result-card.browser.test.ts` (2 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| card: the producer buttons at the lg step > every direct ui-button child carries size lg and renders 36px tall | 2 | 36 | 32 | value pin: take the resolve() value |
| derived foundations, dark launch > reads today's value outside a data-tier region and the derived value inside | 2 | 999 | 28 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |

### `packages/agent-ui/components/src/controls/service-card/service-card.browser.test.ts` (1 failing tests)

| test | engines | pinned | measured | kind |
|---|---|---|---|---|
| derived foundations, dark launch > reads today's value outside a data-tier region and the derived value inside | 2 | 24 | 28 | outside leg: wrap in data-foundations="legacy" (cl.10e) and keep the old value |
