# T-0122 re-pin list: the test files the control rule turned red

Status (2026-10-13): re-pinned in T-0122 itself on Kim's rulings, no lane fan-out. Every file below is green; the law checks were re-derived as the rulings say, the select and combo-box panels now sit c outside their trigger so the alignment equalities hold, the agent-admin strip reads Settings, System and Dialog, and the 14 goldens were re-minted one file at a time after an eye review.

Source: the unit suite and the six browser shards, each run once on `feat/control-rule-adoption` at `f82fcd1c` (rebased onto main `38ccc1d3`, T-0121 and T-0127 included). 54 failing tests in 26 files. Chromium and WebKit each count once under *engines*; the visual shard runs one engine. Grouped by the census lane partition (`laneOf` in `scripts/foundations-census.mjs`) so each group can run as its own file-disjoint lane. `unlaned` is outside the partition.

Cause: ADR-0245 Amendment 4, the skill's control rule. Box margin n, gutter c, label inset n - c on the text slot, so the text edge is 2n - c (8 / 10 / 12 at the root sm / md / lg) where it was 2n on a button, toggle and segment, n on a field and 0 on a tab. A lane re-pins with scale.mjs `resolve()` at the test's own register, never a literal:

| what the test pins | was | now | `resolve()` |
|---|---|---|---|
| button host `padding-inline` beside a label | 2n | n, and the label part carries the rest | `r.control.margin`; the label's `padding-inline` is `r.labelMargin` |
| button, text-field, select `column-gap` | n | c | `r.control.gutter` |
| icon to text (measured between the boxes) | n | n | `r.control.gutter + r.labelMargin` |
| toggle and segment `padding-inline` beside the label | 2n | 2n - c | `r.control.margin + r.labelMargin` |
| text-field, textarea, select trigger host padding | n | n, and the editor or label part adds n - c | `r.control.margin`, `r.labelMargin` |
| combo-box editor `padding-inline` | n | 2n - c | `r.control.margin + r.labelMargin` |
| select, combo-box option row `padding-inline` | n - c | 2n - c | `r.control.margin + r.labelMargin` |
| multi-select row: tick cell edge · trailing edge | n - c · n - c | n · 2n - c | `r.control.margin` · `+ r.labelMargin` |
| menu row `padding-inline` · check box edge · box to text | n + c · n + c · c | 2n - c · n · n | as above |
| tab `padding-inline` · strip gap | 0 · n + 2c | 2n - c · c | `r.control.margin + r.labelMargin` · `r.c` |
| badge height · host padding · gap · radius | 2n · 2c · n · n/2 | 2n + 2c · c (label part adds c) · c · ceil(n/2) | `r.parts.badge` · `r.chip.margin` · `r.chip.gutter` · `r.chip.radius` |
| checkbox radius | n/2 | ceil(n/2) | `r.parts.checkboxRadius` |

The legacy legs (`data-foundations="legacy"`) did not move: none of them is on this list.

Columns: *pinned* is the value the test asserts and *measured* is what renders now (the vitest message reads "expected <measured> to be <pinned>"); *suite* is the shard.

Kinds. A *value pin* takes the derived value. A *text pin* matches the stylesheet text, which is written differently now: rewrite the pattern to the new rule. A *golden* is re-minted after eye review. A *law check* is an inequality or a ruling the new geometry no longer meets: look before changing the test.

Green and not on this list: `controls/control-rule.browser.test.ts` (the per-control proof of the rule, both engines), `shared/src/tokens/foundations.test.ts` and `foundations.browser.test.ts`, the probe (`--strict`) and the census gate.

## Needs a look first (the law checks)

| file | what fails | why |
|---|---|---|
| `button/button-geometry.browser.test.ts`, `button/button-geometry.test.ts` | "still asymmetric": the leading pad differs from the label-edge pad | both host pads are n now; the label edge is n plus the label's own inset n - c, so the asymmetry moved off the host |
| `text-field/text-field-css.test.ts` | no `min-inline-size` on the base `:scope` | the host carries the 4n floor in the R3(a) form `var(--ui-text-field-height)`, which `sizing-gates.test.ts` allows and this ADR-0223 cl.3(b) pin forbids; keep the floor or drop it is a ruling |
| `tabs/tabs-css.test.ts`, `tabs/tabs.browser.test.ts` (4 of its tests) | zero `padding-inline` on a tab, the `xs + md` strip gap, and "strip-gap grows with n" | Amendment 4 supersedes GH #536: a tab carries 2n - c and the tabs touch with c, and c is 2 at both scales the growth test compares |
| `combo-box/combo-box.browser.test.ts` (2), `select/select.browser.test.ts` | panel inset plus option pad equals the trigger's text offset | a row is a control with its own margin and inset, so its text sits c inside the trigger's text (Amendment 4 item 4); lining them up again means offsetting the panel by -c |
| `menu/menu.browser.test.ts` | the check glyph inset tracks `--ui-menu-item-pad-inline` | the check box is pinned at the row margin n (`--ui-menu-item-edge`), and the pad token is the text edge 2n - c |
| `app/src/controls/super-shell/super-shell-resize-tabs.browser.test.ts` | the whole-label row fits the 252px pane | Settings, Context: System and Context: Dialog now need 259px (each tab gained 2(2n - c), the gap lost n + c), so the pane strip scrolls by 6px; labels stay whole. A product decision for the shell lane (a smaller strip size, or a wider pane) |

## Counts

| lane | files | failing tests |
|---|---|---|
| a01 | 17 | 35 |
| a02 | 1 | 2 |
| a03 | 2 | 5 |
| a04 | 4 | 8 |
| a06 | 1 | 3 |
| a07 | 1 | 1 |

## a01 entry and action

### `packages/agent-ui/components/src/controls/button/button-css.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ructure + token hygiene (s7) geometry per the LAW: block-size off the ramp, padding-block 0, slotless inline-pad = h/2 | unit | 1 | /padding-inline:\s*calc\(var\(--…/\s*2\) | the stylesheet text | text pin: the rule is written differently now; rewrite the pattern |
| … single-adornment structures SPREAD to opposite edges: leading-only OVERRIDES to end, trailing-only OVERRIDES to start | unit | 1 | a rule the test looks up by its old selector | not found | text pin: the rule is written differently now; rewrite the pattern |

### `packages/agent-ui/components/src/controls/button/button-foundations.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-button foundations (ADR-0245 lane a01) inside product / sm at size sm reads the derived geometry | components | 2 | 10 | 5 | value pin: take the resolve() value |
| ui-button foundations (ADR-0245 lane a01) inside product / sm at size md reads the derived geometry | components | 2 | 12 | 6 | value pin: take the resolve() value |
| ui-button foundations (ADR-0245 lane a01) inside product / sm at size lg reads the derived geometry | components | 2 | 14 | 7 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button-geometry.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …s13) a region data-scale moves the icon↔label gap with n (the [density] axis retired into it) — the icon+label variant | components | 2 | [ 6, 8, 10 ] | [ 2, 2, 3 ] | value pin: take the resolve() value |
| …e (s13) a region data-scale moves the bare-label FRAME too: block-size 4n and the 2n label pads (one n, ADR-0245 cl.3) | components | 2 | 12 | 6 | value pin: take the resolve() value |
| …RD — the pre-existing [leading \| label]-with-real-text structure is UNCHANGED: still asymmetric, still wider than tall | components | 2 |  | the real-label leading pad must stay the ½(h−icon) slot edge: expected… | law check: the host pads are symmetric now (n and n) and the asymmetry lives in the label inset; needs a look, not a plain re-pin |

### `packages/agent-ui/components/src/controls/button/button-geometry.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …TATIC geometry trip-wires (s11) per-edge ASYMMETRY by design: leading slot edge = ½(h−icon), trailing label edge = h/2 | unit | 1 | /padding-inline-end:\s*calc\(var…/\s*2\) | the stylesheet text | law check: the same premise in the stylesheet text; the label edge is the box margin n now |

### `packages/agent-ui/components/src/controls/button/button-label-overflow.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …abel FITS a fitting label renders the SAME frame the pre-wrapper law specified: h=24, h/2=12 pads, no clipping engaged | components | 2 | 12 | 6 | value pin: take the resolve() value |
| …+ label variant: geometry is unaffected by the wrapper — same [leading \| label] law as button-geometry.browser.test.ts | components | 2 | 12 | 6 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/button/button.visual.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …isual regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-button hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/combo-box/combo-box-foundations.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-combo-box foundations (ADR-0245 lane a01) inside product / sm at size sm reads the derived geometry | components | 2 | 5 | 8 | value pin: take the resolve() value |
| ui-combo-box foundations (ADR-0245 lane a01) inside product / sm at size md reads the derived geometry | components | 2 | 6 | 10 | value pin: take the resolve() value |
| ui-combo-box foundations (ADR-0245 lane a01) inside product / sm at size lg reads the derived geometry | components | 2 | 7 | 12 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/combo-box/combo-box.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …hole-shape DoD law) panel inset + option inline-pad sum to the editor inline pad — the alignment law, browser-measured | components | 2 | 10 | 12 | law check: the alignment law is superseded (Amendment 4): a row is a control and its text sits c inside the editor's text |
| … DoD law) editor computed padding-inline == n (ADR-0245 cl.3 frame class: inline padding n = h/4 at the root register) | components | 2 | 6 | 10 | value pin: take the resolve() value |
| …et (from the panel edge) equals the editor's text inline offset (from the editor edge) — alignment law holds under h/2 | components | 2 | 10 | 12 | law check: the alignment law is superseded (Amendment 4): a row is a control and its text sits c inside the editor's text |

### `packages/agent-ui/components/src/controls/combo-box/combo-box.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …23 slice-1 postures: fill default / [inline] hug) FILL (default): a bare ui-combo-box stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …sion (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the ui-combo-box hugs at its content floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/multi-select/multi-select.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …metry-tokens) ms-geometry-tokens: option padding is DERIVED off the lever (the legacy item-pad formula, not a literal) | unit | 1 | /--ui-multi-select-option-inline…/ 4\)\) | the stylesheet text | text pin: the rule is written differently now; rewrite the pattern |

### `packages/agent-ui/components/src/controls/multi-select/multi-select.visual.browser.test.ts` (5 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …l regression (LLD §10: unselected / selected / disabled checkmark paint) unselected: no checkmark paints on any option | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …unselected / selected / disabled checkmark paint) selected: the checkmark paints on the tinted, selected option row(s) | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …§10: unselected / selected / disabled checkmark paint) disabled: the whole listbox mutes to the disabled neutral roles | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …23 slice-1 postures: fill default / [inline] hug) FILL (default): a bare multi-select stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ression (ADR-0223 slice-1 postures: fill default / [inline] hug) [inline] hug: the multi-select hugs at the 12ch floor | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/pagination/pagination.visual.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …3 slice-2 postures: fill default / [inline] hug) FILL (default): a bare ui-pagination stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …l regression (ADR-0223 slice-2 postures: fill default / [inline] hug) [inline] hug: the ui-pagination hugs its content | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/segmented-control/segmented-control.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …eometry (both engines) segment geometry: block-size = --md-sys-height-md, padding-inline = height/2, padding-block = 0 | components | 2 | 12 | 10 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/select/select.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …margin) + option inline-pad sum to n (the frame inline padding, h/4) at sm/md/lg — the alignment law, browser-measured | components | 2 | 5 | 10 | law check: the alignment law is superseded (Amendment 4): a row is a control and its text sits c inside the trigger's text |

### `packages/agent-ui/components/src/controls/text-field/text-field-css.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …forced-colors host-as-grid: a presence-driven :has() grid + the density-bearing column-gap; the editor is order-placed | unit | 1 | no match of /:scope\s*\{[^}]*min-inline-size/ | the stylesheet text | law check: the base :scope now carries the 4n floor in the R3(a) form, and the test bans any min-inline-size there (ADR-0223 cl.3(b)); needs a ruling |

### `packages/agent-ui/components/src/controls/text-field/text-field-geometry.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| … both engines) a region data-scale moves the adornment↔editor column-gap AND the bare frame together (one n, ADR-0245) | components | 2 | 6 | 2 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/toggle/toggle-foundations.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| ui-toggle foundations (ADR-0245 lane a01) inside product / sm at size sm reads the derived geometry | components | 2 | 10 | 8 | value pin: take the resolve() value |
| ui-toggle foundations (ADR-0245 lane a01) inside product / sm at size md reads the derived geometry | components | 2 | 12 | 10 | value pin: take the resolve() value |
| ui-toggle foundations (ADR-0245 lane a01) inside product / sm at size lg reads the derived geometry | components | 2 | 14 | 12 | value pin: take the resolve() value |

## a02 indicators

### `packages/agent-ui/components/src/controls/checkbox/checkbox.browser.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …box geometry inside an opt-in data-tier region (ADR-0245) product / sm / sm: box 2n, radius n/2, check 2n - 2c inset c | components | 2 | 2.5 | 3 | value pin: take the resolve() value |
| …box geometry inside an opt-in data-tier region (ADR-0245) product / sm / lg: box 2n, radius n/2, check 2n - 2c inset c | components | 2 | 3.5 | 4 | value pin: take the resolve() value |

## a03 atoms

### `packages/agent-ui/components/src/controls/badge/badge-foundations.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …badge geometry (ADR-0245 cl.3) inside a region: height 2n, padding 2c, radius n/2, field-label type, glyph box 2n - 2c | components | 2 | 12 | 16 | value pin: take the resolve() value |

### `packages/agent-ui/components/src/controls/badge/badge.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …are labeled badge in an unstyled flex row paints a non-collapsed box == the derived 2n box (14px at the root register) | components | 2 | 12 | 16 | value pin: take the resolve() value |
| …2 (SPEC-R13 AC1, ADR-0041) padding-inline == 2c (the derived pad, ADR-0245 cl.3); the BOX stays fixed at every density | components | 2 | 4 | 2 | value pin: take the resolve() value |
| …R13 AC1, ADR-0041) an ancestor data-scale moves the box and the pad together: height 2n, pad 2c (ADR-0245 cl.3, one n) | components | 2 | 12 | 16 | value pin: take the resolve() value |
| …t pad law, NOT h/2 (SPEC-R13 AC1, ADR-0041) no [size] attribute repoints the box (SPEC-R13 AC3: v1 ships no size axis) | components | 2 | 12 | 16 | value pin: take the resolve() value |

## a04 navigation and data display

### `packages/agent-ui/components/src/controls/menu/menu.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ngines, GH #55) WHOLE-SHAPE: the checked row paints a real, non-transparent checkmark glyph; the unchecked rows do not | components | 2 | 10 | 6 | law check: the check box sits at the row margin n (--ui-menu-item-edge), no longer at --ui-menu-item-pad-inline (2n - c) |

### `packages/agent-ui/components/src/controls/table/table.visual.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …selection/sort anatomy) selectable=multi + sortable headers: ui-checkbox cells and ui-button headers, one row selected | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

### `packages/agent-ui/components/src/controls/tabs/tabs-css.test.ts` (2 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …ing (s8) declares the --ui-tabs-* chain — control-height tab rows + the --md-sys-space shell + the ink/indicator roles | unit | 1 | /--ui-tabs-strip-gap:\s*calc\(var\(--m…/ | the stylesheet text | text pin: the strip gap reads c with the #536 calc as its legacy fallback; rewrite the pattern |
| …my (s8) a tab is a CONTROL-height interactive row; selection keys off :state(selected) (aria-selected is on internals) | unit | 1 | no match of /padding-inline/ | the stylesheet text | law check: GH #536's zero tab padding is superseded by Amendment 4; a tab carries 2n - c |

### `packages/agent-ui/components/src/controls/tabs/tabs.browser.test.ts` (4 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …variant (both engines) a region data-scale moves strip-gap, panel-pad and the 4n tab height together (one n, ADR-0245) | components | 2 | greater than 2 | 2 | law check: the strip gap is c now, and c is 2 at both scales the test compares, so it no longer grows with n |
| … the tablist column-gap/gap is 11px (space-xs c 2px + space-md group margin 9px); a rendered tab is padding-inline:0px | components | 2 | 10 | 2 | law check: GH #536 superseded; the gap is c and a tab carries 2n - c |
| …ation attribute) ui-tabs has no aria-orientation, no shell flex/row, and the #542/#543 horizontal probes are untouched | components | 2 | 10 | 2 | law check: GH #536 superseded; the horizontal strip gap is c |
| …tion is set; divider + indicator ride the inline-end edge; labels start-align; zero padding-inline holds; 11px row gap | components | 2 | '0px' | '10px' | law check: GH #536 superseded; a vertical tab carries 2n - c too |

## a06 preset widgets and charts

### `packages/agent-ui/components/src/controls/product-card/product-card.visual.browser.test.ts` (3 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …duct-card: visual regression (ADR-0243 modes, ADR-0223 sizing postures) exhibit tile: icon header, no price, no action | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ion (ADR-0243 modes, ADR-0223 sizing postures) FILL (default): a bare ui-product-card stretches to its block container | visual | 1 | the committed golden | differs | golden: re-mint after eye review |
| …ual regression (ADR-0243 modes, ADR-0223 sizing postures) [inline] hug: the ui-product-card hugs its own content width | visual | 1 | the committed golden | differs | golden: re-mint after eye review |

## a07 app (packages/agent-ui/app)

### `packages/agent-ui/app/src/controls/super-shell/super-shell-resize-tabs.browser.test.ts` (1 failing tests)

| test | suite | engines | pinned | measured | kind |
|---|---|---|---|---|---|
| …(36n) the strip is a real ui-tabs: labels never clip mid-word, the tablist scrolls, tablist semantics ride the control | app | 2 | less than or equal to 253 | 259 | law check: the three-tab row needs 259px in the 252px pane, so the strip scrolls by 6px; decide the pane strip's size before changing the test |

