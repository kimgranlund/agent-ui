# Dogfood lint: the four layers that keep the library's own rules true

> Derived from T-0136 (Kim, 2026-10-13: "we need some kind of linter strategy that ensures dogfooding standards
> are adhered to"). The rules derive from ADR-0245 (one n), its Amendments 3 to 5 (pill radius, control rule,
> pill fields and chips), T-0130 (the 400px column) and T-0135 (a date is a real input). On any conflict the
> source rule (the ADR clause, or the ticket and reference-doc rule it cites) wins and the lint rule is wrong.

Every dogfood catch that can be measured becomes a gate, not a reminder. The four layers run from the source
up to a human look; each layer catches what the one before cannot see.

| Layer | Reads | Catches | Gate | Allowlist |
|---|---|---|---|---|
| 1 Render lint | `getComputedStyle` of every docs demo page, every browsable A2UI catalog widget and every persona seed that renders a persona widget (BookingForm, BookingConfirmation, CardTable, QuestionCard, ContrastPair; T-0144), at 400 and 1000px, light and dark, Chromium and WebKit | radius by role, square icon buttons, the type floor, the 400px column, nested cards, the height ramp, the text edge, hugging badges, option indicators, inline links, adornment gaps, disabled contrast, avatar and badge contrast, button identity, split action groups, prose gaps, glyph gaps, clipped demo cards, the 3:1 field boundary, the icon box, the calendar cap, the table pager and scroll cue, chart rings, legends, series, chips and empty or diverging marks, placeholder dots, picker em dashes, demo captions, figures, overlines, avatar clusters, supporting lines, board letters and the unframed board edge | `site/pages/dogfood-render.browser.test.ts` (the `site` shard of `npm run test:browser`) | `scripts/dogfood-render-allowlist.json` |
| 2 Composition lint | the A2UI factories, the A2UI example payloads, the agent-admin presets and the site demos, as text | a composition the library has a control for: a calendar standing in for a date field, a grid of buttons standing in for a board, a lone framed button, stars as text, inline literal geometry; and in control sources, a caret drawn as an icon | `node scripts/dogfood-compose.mjs selftest` and `--gate` (both in `check:scripts`) | `scripts/dogfood-compose-allowlist.json` |
| 3 Foundations census | every stylesheet and source file under `packages/` and `site/` | a hand-tabled ramp read, a px geometry literal, the retired `glyph` prop and `[scale]` / `[density]` axes | `node scripts/foundations-census.mjs --gate` (in `check:scripts`) | `scripts/foundations-allowlist.json` |
| 4 Review | a screenshot of the real widget beside its approved mockup | what no rule measures yet: balance, hierarchy, a wrong control for the job | a `ui-designer` review (or Kim's look check) | none; a finding becomes a rule or a ticket |

Layer 1 and `npm run test:eval-catalog` are local and merge-queue gates, not CI: `.github/workflows/ci.yml` runs
`npm run check` and `npm test` and never `test:browser`, so a lane runs the render lint itself before it lands. Layers
2 and 3 ride `check:scripts`, which CI runs.

## The rules table

`scripts/dogfood-rules.json` holds both lint layers: `render` (layer 1) and `compose` (layer 2). Each render rule
names its source rule (in the `source` field), its selector, what it measures and the expected value; every geometry value is computed
from `resolve(tier, scale, size, density)` in `scripts/lib/foundations-model.mjs` (T-0374, T-0506) at the element's
register (the nearest `data-tier`, `data-scale`, `data-size` or `size`, and `data-density` on the element or an
ancestor; at the root the shared `ROOT_REGISTER` of `scripts/lib/foundations-rules.mjs`, the generator's root inputs,
product at scale md since Amendment 8; widget at scale md on an A2UI surface, which the renderer stamps). A sweep leg
asserts the rendered `:root` inputs equal `ROOT_REGISTER`, so a root change edits one line and regenerates. The contrast rules expect a fixed
ratio or a comparison with the same control enabled, and `glyph-gap` reads the glyph's own cascade n.

| Render rule | Expected |
|---|---|
| `register` | the element's cascade n (its `--md-sys-height` / 4) equals the register's n |
| `pill-radius` | a single-line control or chip has radius at least the control amount x h/2 (h/4 under the balanced default, h/2 under `data-radius='pill'`, T-0374 step 6), the segmented control's track outline (its `::after`) included (T-0144), the suggestion and file-drop chips too (T-0168); a square entry cell is exempt (see `entry-cell-radius`); `ui-multi-select` has no trigger (its descriptor), so its panel is `panel-radius`'s |
| `icon-square` | a `ui-button` with an icon and no text is as wide as it is tall |
| `type-floor` | no visible text under `CFG.floor` (9px); a glyph is not text (Amendment 6), so glyphs are exempt and checked by `glyph-box` |
| `column` | at 400px nothing ends past the content column unless an overflow-x frame inside it holds it |
| `nested-card` | no `ui-card` inside a `ui-card` |
| `control-height` | a single-line control is `resolve().h` (4n) tall |
| `text-edge` | host padding plus the text slot's padding is 2n - c |
| `card-radius` | a `ui-card` takes `resolve().card.radius` |
| `panel-radius` | a visible listbox panel is concentric: the row's control radius plus c |
| `badge-hug` | a `ui-badge` is no wider than its max-content width (T-0140) |
| `option-indicator` | every `ui-multi-select` option paints its indicator, selected or not (T-0140) |
| `inline-text` | a `ui-text` link or span inside running text is `display: inline` (T-0140) |
| `adornment-gap` | adjacent trailing adornments of a `ui-text-field` sit at least c apart (T-0140) |
| `entry-cell-radius` | a square entry cell (`ui-otp-field` cell) is a round square at the surface radius `resolve().radius` (A x n), not a pill (Amendment 6) |
| `glyph-box` | a glyph (`ui-glyph`'s mark, the board-grid intent mark, the HUD and result-card stat marks) is exactly its glyph box n + 6, centred in its square 3n slot (Amendment 6; T-0374 retired the T-0143 8px floor, which n + 6 never reaches) |
| `dash-scale` | no svg shape is non-scaling-stroke with a dasharray other than none (the browser reads such a pattern in screen px; T-0141) |
| `link-ink` | an `a[href]` inside a `ui-*` host is never the browser's default link colour (T-0141) |
| `disabled-ink` | a disabled `ui-button`, `ui-toggle` or entry field part (text-field and textarea editor, OTP cell, select trigger, combo-box editor; T-0168) has ink contrast against its fill below the same control's with `disabled` lifted (T-0144) |
| `disabled-ghost` | a disabled ghost `ui-button` paints no background (T-0144) |
| `disabled-edge` | a disabled switch track, checkbox box, radio ring or entry field frame (T-0168) keeps at least 1.3:1 against its surface, fill or border (T-0144) |
| `disabled-toggle-fill` | a disabled unpressed `ui-toggle` paints the enabled unpressed fill (T-0144) |
| `button-text-ink` | a `ui-text` inside a `ui-button` takes the button's colour (T-0144) |
| `avatar-disc` | an initials or icon `ui-avatar` disc is at least 1.3:1 against the surface behind it (T-0144) |
| `badge-overlay` | a `ui-badge` positioned over an image has an opaque fill and ink at least 4.5:1 (T-0144) |
| `button-identity` | every visible `ui-button` paints an icon or a label wider than 0 (T-0144) |
| `action-group` | the buttons of a flex row that also holds other content share one line, or none shares a line with that content (T-0144) |
| `prose-gap` | a `p` under a box (a specimen, a card, a button) sits at least n below it (T-0144) |
| `glyph-gap` | a game-hud or result-card stat glyph, and a product-card rating's stars (T-0168), sit at least the cascade n from the label after them (T-0144) |
| `scroll-clip` | at 400px no `ui-card` runs past a demo's overflow-x frame (a `ui-*` control's own scroller is exempt) (T-0144) |
| `field-outline` | a resting entry field (not disabled, focused, user-invalid or the active OTP cell) has an edge at least `boundaryMin` (3:1) against the surface behind it (T-0168) |
| `slider-disabled` | a disabled slider's fill keeps 1.3:1 against its rail, and its thumb is no taller than enabled (T-0168) |
| `switch-off-edge` | an enabled unchecked switch's track edge is at least 3:1 against its surface and its off fill quieter than the on fill (T-0168) |
| `icon-box` | a `ui-icon` inside a control or a `[data-tier]` region is `resolve().icon` (2n); in prose (no region, its nearest `ui-*` host a `layout` container) it is 1em (T-0168) |
| `calendar-cap` | a calendar's grid is at most `tracks` x `trackFactor` x the 4n cell plus its gaps, and its panel starts on the host's start edge (T-0168) |
| `table-pager` | a pager a control composes sits in no overflow-x frame inside that control (T-0168) |
| `table-scroll-cue` | a `ui-table` whose columns overflow paints its edge-fade mask (T-0168) |
| `ring-parity` | sibling ring stats on one line draw one diameter (T-0168) |
| `legend-gap` | a gauge legend beside its rings starts 0 to 2n past the outer ring (T-0168) |
| `series-separation` | chart series 1 and 2 inks are at least `seriesMin` (1.5:1) apart (T-0168) |
| `chip-opaque` | a column or line chart chip that paints a fill (a border-only chip has none) paints it opaque, with ink at least `inkMin` (4.5:1) (T-0168) |
| `chart-empty-mark` | a bar chart, column chart or gauge with no data still paints a frame or track (T-0168) |
| `diverging-zero` | a bar chart track marked diverging draws its zero rule (T-0168) |
| `placeholder-dots` | no placeholder ends in exactly two periods (T-0168) |
| `picker-dash` | no option, menu item, tab, radio, segment, choice card, button, toggle or select trigger label carries an em dash; `ui-tab`, `ui-radio`, `ui-segment` and `ui-choice-card` set their role through `ElementInternals`, so they match by tag (T-0168) |
| `caption-in-specimen` | a `.demo-caption` never sits inside a `ui-*` specimen (T-0168) |
| `figure-parity` | sibling `.demo-figure`s on one line share their top edge within `edgeTol` (1px) (T-0168) |
| `overline-gap` | an overline sits closer to the block after it than to the one before (T-0168) |
| `avatar-cluster` | an avatar overlapping its neighbour covers at most 1 / `widthDivisor` (a quarter) of it and wears a ring (T-0168) |
| `supporting-ink` | a `.demo-supporting` line has lower ink contrast than the text block before it (T-0168) |
| `board-letter` | a board letter's cap height is at least 1 / `cellDivisor` (a third) of its cell (T-0168) |
| `unframed-inset` | a `ui-board-grid` that paints no frame starts its first cell within `edgeTol` (1px) of its own start edge (T-0168) |

The contrast rules (`disabled-*`, `avatar-disc`, `badge-overlay`) read `site/lib/dogfood-contrast.ts`: each painted
layer (a computed background colour, a flat gradient layer, a border, an ink) resolves to sRGB channels, flattens
source-over down to an opaque colour, and the pair gives the WCAG 2.x ratio. A real image in the stack has no single
colour, so a rule that meets one skips the element, except `badge-overlay`, whose fill must be opaque on its own.
The field-boundary 3:1 role landed with T-0143 (ADR-0245 Amendment 7): `--md-sys-color-neutral-field-outline` holds at
least 3:1 on every plane, gated by `tokens.test.ts` and `field-outline.browser.test.ts`; since T-0168 the `field-outline`
render rule also holds every resting field on every swept page to it, so a local override that fades the edge reds too.
The standalone-icon floor is ruled out: an icon inside a `[data-tier]` region stays 2n (Amendment 7, item 3), so no
0.875-of-font-size rule exists; `icon-box` checks the two homes (2n inside, 1em in prose) and `glyph-box` carries the
only floor (8px). A start or end edge is read on the side the element's direction names, so RTL is checked too. A
pseudo-element with content none or normal paints nothing, whatever its other styles say. A rule's threshold or factor lives on its row as a named number (`boundaryMin`, `seriesMin`,
`inkMin`, `edgeTol`, `widthDivisor`, `cellDivisor`, `tracks`, `trackFactor`) or comes from `resolve()`, never a literal repeated in the check.

| Compose rule | Use | Not |
|---|---|---|
| `date-field` | `ui-text-field type=date` | a `ui-calendar` in a `ui-popover` or beside a calendar-icon `ui-button` (a Calendar in a Popover in a payload) |
| `board-grid` | `ui-board-grid` (BoardGrid) | a `ui-grid` of cell `ui-button`s (a Grid whose children are all Buttons) |
| `lone-button-frame` | one Row of plain Buttons, a ChoicePicker or a SegmentedControl | a Card whose only content is one Button (T-0172) |
| `caret-glyph` | a `ui-glyph` caret | `setIcon(host, 'caret-*')` or a `ui-icon` named `caret-*` in a control source (its own `scan` roots, T-0168) |
| `star-run` | `ui-rating` readonly (A2UI: a ProductCard rating) | a run of two or more U+2605 or U+2606 characters (T-0168) |
| `inline-geometry` | the derived tokens, a control's `size`, a container's `data-*` register | an inline style setting padding, margin, gap, radius, height or font-size to a literal length |

A compose rule reads the composition set (factories, payloads, presets, demos) unless its row names its own `scan`
roots; `caret-glyph` reads only the control sources, and no composition rule reads them.

## The round-3 proposals (T-0168)

The T-0138 and T-0142 to T-0150 lanes proposed rules in `.sdlc/notes/notes.md`; T-0168 built the mechanical ones.
Two already existed: the demo card clipped at 400px is `scroll-clip` and prose after a box is `prose-gap` (T-0144).
Not built, with the reason:

- Sibling figure widths: T-0150 sizes each figure from its specimen, so a size row's figures differ in width by
  design; `figure-parity` checks the shared top edge only.
- An unframed control's edge, fleet-wide: no measure tells a control's deliberate inner inset (a ghost button's text
  edge, a checkbox's label gap) from a stray one, so `unframed-inset` covers the reviewed case, `ui-board-grid`.
- `prose-gap` widened to any block under a specimen (T-0150): a block sibling of a specimen is most often the next
  specimen, whose gap is the layout's, not a note's; it stays a review item.

## The allowlists

Each allowlist is a flat JSON object, one `"<key>": "<why>"` entry per line in sorted order, so a lane deletes only
its own lines. A render key is `demo/<page>#<rule>`, `widget/<Type>#<rule>` or `persona/<seed>#<rule>`, with `@chromium` or `@webkit` when it
holds in one engine only; a compose key is `<path>#<rule>`. Both gates fail on a finding with no entry, on an
entry that no longer finds anything (stale: the fix landed, delete the line), and on an entry whose reason names
no owner: a `T-NNNN` ticket, an `ADR-NNNN` or a ruling (T-0170, `hasOwner` in `scripts/lib/foundations-rules.mjs`).
An allowlist holds only real debt with an owner. Two ways out of it that are not debt (T-0170):

- A permanent render specimen carries `data-dogfood-ok="<rule>"` and a non-empty `data-dogfood-reason` on the
  element; the nested-card rule honours it (the card demo's nested-card radius specimen).
- A compose rule's `exempt` list in `scripts/dogfood-rules.json` takes a file whose literal geometry is legitimately
  literal (a specimen frame, the sandbox document) out of that rule, `{ path, reason }`, the reason owned like an
  entry; an exemption that finds nothing is stale.

Day one (T-0136) listed 9 render findings and 53 compose findings, every compose one a site demo's inline geometry.
T-0170 fixed two render findings (ui-code border-box, the avatar plane), scoped glyph-gap off a badge mark (two
findings), marked the specimen, moved four to owner tickets, migrated 22 demos to
the `--md-sys-space-*` steps, exempted 6 and left 22 compose entries owned by T-0190.
T-0190 cleared those 22 entries, leaving the compose allowlist empty: type sizes moved to `--md-sys-type-*` roles,
spacing to `--md-sys-space-*` steps, card-like radii to
`--md-sys-card-radius`, icon sizes to `--md-sys-icon-box`, and icon-demo's ambient ramp to type roles. Five paths
took a named exemption: the specimen frame heights in attachment, split, split-pane and swiper-item (split-pane's
heights moved out of a template hole into literals the lint reads), and pie-chart's em readout, which scales with
the donut's em box.

## How to add a rule

1. Add the row to `scripts/dogfood-rules.json` under `render` or `compose`, citing in its `source`
   field the rule it enforces: the ticket and the reference-doc rule (`geometry.md`, this file), or an existing
   ADR clause. ADRs are frozen (T-0164); the field (renamed from `adr` in T-0169) takes free text.
2. Write its check: a function in `CHECKS` of `site/pages/dogfood-render.browser.test.ts`, or a branch of
   `findingsIn` in `scripts/dogfood-compose.mjs`.
3. Write its negative control: a `PLANTS` entry (a planted violation and a clean twin) in the render test, or
   selftest cases in the compose script. Both suites fail when a rule has no control.
4. Run the gate; list each current violator in the allowlist with a reason, or fix it. Report the count.

## How a review finding becomes a rule

A layer 4 finding (a `ui-designer` review or a look check) names what is wrong on a screenshot. If it can be
measured, it gets a rule: the measurement goes in `render` (a computed style) or `compose` (a source pattern),
the finding's screenshot becomes the negative control's plant, and the review ticket links the rule id. If it
cannot be measured yet, it stays a review item and the ticket says why.
