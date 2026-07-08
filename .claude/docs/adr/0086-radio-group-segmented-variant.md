# ADR-0086 — `ui-radio-group[variant=segmented]`: the joined-button presentation for single-select

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-06 *(authored)* · 2026-07-06 *(revised — both-orientations + shared-moving-indicator redesign; Kim)* · 2026-07-06 *(ratified — Kim)* · 2026-07-06 *(amended — the state seam is written on the form-reset path too, not only `#commit`; a component-review reproduced an indicator desync after reset)*
>
> | Field | Value |
> |---|---|
> | **Status** | superseded |
> | **Date** | 2026-07-06 |
> | **Proposed by** | planner (the design seat) — the docs-preview de-doubling routes small closed enums to `ui-radio-group`; Kim wants those to render as a segmented control, stackable in both orientations, with a single shared highlight that animates between segments |
> | **Ratified by** | Kim (host) · 2026-07-06 — ratify & build; both-orientations + shared-animated-indicator redesign is Kim's own direction |
> | **Repairs** | `controls/radio/radio-group.css` — NEW segmented variant styling: the `--ui-radio-group-*` design tokens land in the `:where(ui-radio-group)` token block (`radio-group.css:15–19`, its stated reserve for "future density/gap props"), the grid + segment + `::before`-indicator rules land in the `@scope` block (`radio-group.css:23+`), and the forced-colors indicator inversion lands in the `@media (forced-colors: active)` sub-block (`radio-group.css:33–38` — the `:32` comment reserves *this* WHCM hook specifically, not the general variant surface). · `controls/radio/radio-group.ts` — NEW reflected `variant` + `orientation` props on `groupProps`; the resolved orientation passed to the existing `rovingFocus` call (`radio-group.ts:69–80`); the `--ui-radio-group-index` / `--ui-radio-group-count` state custom properties written on the commit path (`#commit`, `radio-group.ts:132–149`) + seeded in `connected()`. · `controls/radio/radio-group.md` — NEW `variant` + `orientation` `attributes[]` rows + a keyboard table split **per orientation** (a **drift correction**: the current table falsely claims ArrowLeft/Right navigate, which the shipped `orientation:'vertical'` roving does NOT do — `radio-group.md:66–73`) + **three now-stale prose spots the build falsifies:** the frontmatter `attributes[]`-mirror comment (`radio-group.md:4–6` — lists `groupProps` as `name`/`disabled`/`required` only; now gains `variant`/`orientation`), the `geometry.note` (`radio-group.md:81` — "the group provides no layout-opinionated CSS of its own", contradicted by the segmented grid), and the prose §Keyboard line (`radio-group.md:123` — "rovingFocus (vertical orientation, looping)", now per-orientation). All build-time, gated on this ADR; no source is touched in the ADR pass (the component-builder lands it). |
> | **Supersedes / Superseded by** | **Superseded by ADR-0095** — the T3 ruling (2026-07-07: the tag itself is the requirement) fired the reopen trigger ADR-0092 named for exactly this outcome; ADR-0095 has since shipped and been reviewed GO. Relates **ADR-0048/0058** (the `--md-sys-color-primary-selected` AA-safe selected-fill role this reuses for the moving indicator) · **ADR-0057** (the non-color-signifier rule the shared indicator satisfies by fill-presence) · **ADR-0009** (the fleet focus ring the segment reuses unchanged) · **ADR-0041/0042** (the widget/compact ramp the dot uses — *not* used in segmented mode) · **ADR-0036** (single-line control `line-height:1`) · **ADR-0038** (the `[scale]` row re-tabling that makes the segment ramp free) · **ADR-0081** (the `attributes[]`↔`static props` family-coherence trip-wire the descriptor rows satisfy). Consumes `geometry.md`'s **Pattern** size-class (`segmented-control` is a named example, `geometry.md:133` — "interactive rows take the control height") · `dimensions.css`'s `--ui-motion-fast` / `--ui-ease-standard` motion constants (`dimensions.css:81–82`) · the `--value-pct`-style **state custom-property seam** (`range-element.ts:111`, `slider-multi.ts:196–197` — a control writing reactive state to a host custom property for CSS to read; this is NOT the "no runtime style injection" the plan §2 bans, which is about injecting *stylesheets*). |

## Context

The docs-preview de-doubling routes small closed enums (`variant` / `size`, ≤ 5 members) to `ui-radio-group`,
which today renders as **radio-buttons-in-a-row** — a dot glyph plus a label per option (`radio.css`). Kim
wants those enums to render as a **segmented control**: the joined-button single-select toggle the old VARIANTS
chip-row imitated, **stackable both horizontally and vertically**, with **one shared highlight that animates
between segments**. A segmented control is, semantically, *exactly* a single-select radio-group — one choice at
a time, roving focus, selection-follows-focus, `role=radiogroup`/`role=radio`, a group value, a
`required→valueMissing` verdict. The only differences are **presentation** (adjacent joined buttons with one
moving filled indicator instead of dots-in-a-row) and the **orientation-driven roving axis**.

`ui-radio-group` already owns every behavior a segmented control needs (single-select exclusivity, the roving
cursor, the commit path, the group form value + validity — `radio-group.ts`). The group is layout-neutral for
its default variant by design; `radio-group.css` reserves its `:where(ui-radio-group)` token block for "future
density/gap props" (`radio-group.css:15–19`) and its `@scope` block for future surface rules (`radio-group.css:23+`).
So the right shape is a **presentation variant on the existing group**, not a new component — 100% of the
behavior is shared; only the CSS, two new declarative props, and the small `.ts` wiring they need differ.

Two discovered-reality facts shape the design rather than a pure CSS drop:

1. **The roving trait is orientation-specific** (`roving-focus.ts:148–149`: `isNextKey` is ArrowDown for
   `'vertical'`, ArrowRight for `'horizontal'`). The group hardcodes `orientation:'vertical'`
   (`radio-group.ts:71`), and **no `orientation` attribute exists** — `groupProps` is `{...UIFormElement.formProps}`
   only: `name` / `disabled` / `required` (`radio-group.ts:35–39`, mirrored in `radio-group.md:12–24`). A
   segmented control that can be a **horizontal row OR a vertical stack** needs the roving axis to *follow the
   orientation*, so the arrow keys are always ARIA-APG-correct. That makes `orientation` a first-class knob, not
   a fork to litigate. Separately, `radio-group.md`'s keyboard table already **lies** — it claims
   *"ArrowDown / ArrowRight → next"* and *"ArrowUp / ArrowLeft → previous"* (`radio-group.md:66–73`), but
   Left/Right do nothing under the shipped vertical roving. The table must be corrected regardless.

2. **A single shared moving highlight cannot be a per-segment background.** A background swapped from one
   `ui-radio` to the next is instant — it cannot *slide*. The only mechanism that gives the continuous animation
   Kim asked for is **one artifact** (the group's `::before` pseudo-element) positioned over the selected cell
   by `transform: translate…` and transitioned. Grid-track placement (`grid-column`/`grid-row`) does **not**
   animate; `transform` does — so the indicator translates rather than re-flowing. This is the same
   overflow/animation rigor the variant already owes the focus ring.

## Decision

We will add **`variant="segmented"`** to `ui-radio-group` — **a presentation variant plus the orientation and
selection wiring it needs** (not "presentation-only": it mints an `orientation` prop, drives the roving axis,
and writes two selection state custom properties from `.ts`). It restyles the group's `ui-radio` children as
joined segments with one shared animated highlight, in either orientation, while preserving every behavior the
group already owns. Eight clauses:

1. **The attributes — two reflected props on the GROUP.** `variant: 'default' | 'segmented'` (default
   `'default'`) and `orientation: 'horizontal' | 'vertical'` (default `'vertical'`), both `reflect:true`, both
   added to `groupProps` (`radio-group.ts`). The children carry **no** per-radio attribute: the group owns the
   presentation and restyles its radios through a **descendant compound selector** in `radio-group.css`, so a
   `ui-radio` stays ignorant of the group's variant (layer discipline preserved). `orientation` drives the
   roving axis for **both** variants and the grid main axis for the segmented variant; the default dot variant
   stays layout-neutral (the page author owns its layout, as today). The **variant-derived default** resolves
   once at `connected()`: the effective orientation is `hasAttribute('orientation') ? this.orientation :
   (this.variant === 'segmented' ? 'horizontal' : 'vertical')`, and that resolved value is reflected back to the
   host attribute so CSS (`[orientation]`) and the roving trait read **one** source. So `variant="segmented"`
   with no explicit orientation renders horizontal; a vertical segmented stack is `variant="segmented"
   orientation="vertical"`; the default dot group stays vertical.

2. **The propagation seam — group tokens + a group-authored compound selector, plus a state seam.** The
   segmented block **declares new `--ui-radio-group-*` design tokens** in `:where(ui-radio-group[variant='segmented'])`
   (0-specificity, sole declarer) and **consumes** them on the compound selector
   `ui-radio-group[variant='segmented'] ui-radio{…}`. The radio's own `--ui-radio-*` chain is **not** repointed;
   the compound rules set CSS *properties* directly, reading the group tokens. The consuming selectors are **not**
   `:where()`-wrapped, so their specificity `(0,1,2)` / `(0,1,3)` cleanly clears the radio's own `@scope :scope`
   / `:scope::before` rules `(0,1,0)` / `(0,1,1)` — deterministic, not `!important`. Separately, the **runtime
   selection state** rides two *state* custom properties written from `.ts` — `--ui-radio-group-index` (the
   selected index) and `--ui-radio-group-count` (the segment count) — set on the host style in `#commit`
   (`radio-group.ts:132–149`) and seeded in `connected()`. This is the established `--value-pct` seam
   (`range-element.ts:111`; `slider-multi.ts:196–197`), **not** stylesheet injection: the plan §2 ban is on a
   `.ts` injecting style *rules*, not on writing a reactive state variable a stylesheet reads.

3. **Grid layout — equal 1fr cells, orientation-driven main axis.** The group is `display:grid` with equal
   cells so every segment is the same size regardless of label length (a segmented control must look uniform).
   Horizontal: `grid-auto-flow:column; grid-auto-columns:1fr`. Vertical: the implicit row flow with
   `grid-auto-rows:1fr` (each row equal). **`grid-template-columns:repeat(var(--count),1fr)` is NOT usable** —
   `repeat()`'s count must be a literal integer, so a custom property cannot drive it; the auto-flow / auto-track
   path is the grounded mechanism. There is **no gap** between segments (they share borders, and the indicator's
   `100%/count` math assumes gapless equal cells — clause 4). Each `ui-radio` becomes a centered, full-cell
   button: the dot `::before` → `display:none`; the segment → `display:inline-flex; justify-content:center;
   align-items:center; position:relative` with `z-index:1` (so its text + focus ring paint **above** the moving
   indicator). One **outer rounded track** on the group (`border:1px solid var(--md-sys-color-neutral-outline)`,
   `border-radius:var(--ui-radius-base)`). **Shared borders collapse**: each segment carries a single
   `border-inline-start` (horizontal) / `border-block-start` (vertical) divider and the first segment
   (`:first-of-type`) suppresses it, so adjacent segments share one line, not two. **No `overflow:hidden` on the
   group** — it would clip the `:focus-visible` outline (clause 7); the rounded indicator + rounded track ends
   handle the corners instead.

4. **The shared moving indicator — one artifact that animates between segments.** The selected fill is **one
   shared artifact**: the group's **`::before` pseudo-element** (no injected DOM — the group stays light-DOM with
   `ui-radio` children). It is `position:absolute` within the group (`position:relative` on the group),
   `z-index:0` (behind the segment text/focus-ring), sized to **one cell**
   (`inline-size:calc(100% / var(--ui-radio-group-count))` horizontal; `block-size:calc(100% / …)` vertical), and
   **offset to the selected cell by `transform`**: `translateX(calc(var(--ui-radio-group-index) * 100%))`
   (horizontal) / `translateY(…)` (vertical). **The animatable path is `transform`, never grid-track placement**
   (`grid-column`/`grid-row` snap; the indicator translates). It carries the accent fill
   `background:var(--md-sys-color-primary-selected)` (the WCAG-AA-against-`-on-primary` role minted for the
   calendar, ADR-0048/0058) with `border-radius:calc(var(--ui-radius-base) - 1px)` (the inner radius; the ends
   align to the rounded track). When no radio is checked the indicator is **hidden**
   (`ui-radio-group[variant='segmented']:not(:has(ui-radio[checked]))::before{opacity:0}`) — it appears
   instantly on the first selection and only **slides between** subsequent selections. The selected segment's
   **ink** → `color:var(--md-sys-color-primary-on-primary)`; unselected ink →
   `var(--md-sys-color-neutral-on-surface-variant)`.

5. **Motion discipline.** The slide transitions **`transform`** over `var(--ui-motion-fast)`
   `var(--ui-ease-standard)` (the fleet motion constants, `dimensions.css:81–82` — **consumed, not hardcoded**),
   gated by `@media (prefers-reduced-motion: reduce){ …::before{ transition:none } }` so the indicator **jumps**
   under reduced motion (the fleet precedent, `radio.css:123–127`). **Fleet gap flagged (token-builder's seat,
   not fixed here):** the `dimensions.css:72–80` doctrine scopes `--ui-motion-fast` to "state-PAINT properties
   (background/colour/border) … NEVER geometry"; the indicator transitions `transform` (a *selection-state*
   position change — neither paint nor a `[scale]`/`[size]` sizing-ramp change). It is legitimate (compositor-
   friendly; not the sizing ramp), but the doctrine comment should be widened to name "state-driven transform (a
   moving selection indicator)" as an allowed category — a shared-token doctrine edit, so a token-builder concern.

6. **Geometry — the Pattern-class control-height ramp.** A segmented control is a `geometry.md` **Pattern**
   (`geometry.md:133` names `segmented-control` — "interactive rows take the control height"). Each segment reads
   the **Control-height** ramp, not the dot's compact/widget ramp (ADR-0041, unused in this mode):
   `block-size:var(--ui-radio-group-segment-height)` = `--ui-height-md`; `font-size` = `--ui-font-md`;
   `line-height:var(--ui-control-line-height)` (`=1`, the single-line Control law, ADR-0036); `padding-block:0`
   (block-size is the vertical lever); `padding-inline:calc(height/2)` (the **slotless-edge** inline pad,
   `geometry.md:82` — a bare-label control, no icon/caret). For the **vertical** stack the equal-height rows
   follow from every segment reading the same `--ui-height-md` (so the indicator's `100%/count` = one control
   height, consistent). **v1 ships the single `md` register**; an ancestor `[scale]` re-tables the row for free
   (ADR-0038). Per-`[size]` `sm`/`lg` is a **named follow-up** (mint a group `size` attribute at the first
   consumer), not a v1 obligation.

7. **Interaction states + the selected / disabled discipline.** Unselected segments are the **text-channel**
   (interaction-states.md): `background:transparent`, hover → `var(--md-sys-color-primary-container-low)`,
   active → `var(--md-sys-color-primary-container)` (declared as `--ui-radio-group-segment-bg-hover/-active`,
   consumed on `:hover`/`:active` — no `color-mix`). The **selected** segment's fill is the moving indicator
   behind it; its own background stays transparent and it does **not** wash on hover — a checked radio cannot
   toggle off, so the selected state holds (the fill is stable, not a hover affordance). Under
   `effectiveDisabled` the group **holds at idle**: the hover/active washes are **suppressed** (matching the
   radio's disabled pointer-inertness, `radio.css:129–134`, and the group's disabled change-swallow,
   `radio-group.ts:91–96`). **Under forced-colors** (`@media (forced-colors: active)`): the indicator `::before`
   → `forced-color-adjust:none; background:Highlight`; the selected segment ink → `HighlightText`; unselected ink
   + the frame/dividers → `ButtonText`. The **fill presence** (exactly one segment is backed) is the ADR-0057
   non-color signifier — the same "presence-of-paint" cue the checkbox tick, the radio dot, and the calendar
   selected-disc carry in that ADR's conformance table — alongside the already-exposed `aria-checked`. The
   indicator's `transform` still positions under forced-colors (transform survives forced-color adjustment), so
   the highlight still lands on the right segment; the selected segment is the **inverted** one, distinguishable
   by fill inversion, not hue.

8. **A11y + keyboard — preserved; the roving axis follows the orientation.** `role=radiogroup` / `role=radio`,
   `aria-checked`, the roving tabindex (exactly one segment `tabindex=0`), single-select exclusivity,
   selection-follows-focus, the group value + validity are **all unchanged** — the variant touches no commit
   path. The segment **focus ring is the radio's existing `:scope:focus-visible` fleet outline** (ADR-0009),
   reused as-is (no `overflow:hidden` clips it — clause 3). The **behavioral wiring**: the group passes the
   **resolved orientation** (clause 1) to its existing `rovingFocus` call — **resolved before that call** within `connected()`, since the trait
   captures `orientation` **once** as a static value (`roving-focus.ts:148` reads the closed-over param, not a
   callback like `items`/`syncIndex`), so resolving it afterward would silently keep the `'vertical'` axis. A
   **horizontal** segmented group
   navigates with **ArrowLeft/Right + Home/End** and a **vertical** one with **ArrowUp/Down + Home/End** — always
   ARIA-APG-correct. This **dissolves** the old arrow-axis fork: the roving axis is orientation-driven, never
   mismatched, so there is no navigation ambiguity to confirm. It **corrects** the drifted `radio-group.md`
   keyboard table **per orientation**. `variant` and `orientation` are **declarative structural attributes**
   (set at construction, like `size`): the orientation is bound once at `connected()`; a runtime flip is not a v1
   use case (the docs-preview sets them once). The `.ts` writes `--ui-radio-group-index` / `-count` on **every
   selection change, not only commits** (clauses 2, 4): `#commit` (click/keyboard) **and** `formReset()`, which
   recomputes the index from `defaultChecked` so the sliding indicator repositions to the restored selection. (An
   earlier draft scoped the seam to `#commit` only; a component-review reproduced an indicator desync after a
   native form reset — the reset path is a non-commit selection change the seam must also track. Amended.)

## Consequences

- **The docs-preview consumer (downstream, not this ADR's build):** small closed enums render as
  `<ui-radio-group variant="segmented">` (horizontal by default) — the first consumer. The joined-button toggle
  replaces the imitated VARIANTS chip-row with a real single-select radiogroup (value/validity/keyboard for
  free) and a highlight that animates between choices.
- **The orientation fork is dissolved, not deferred.** By minting a first-class `orientation` prop that drives
  the roving axis, the variant is APG-correct in **both** orientations with no fork to litigate. The cost: a
  second public prop on the group (`orientation`), and the group now owns the segmented layout (grid) while
  staying layout-neutral for the default variant. This is a deliberate, honest widening of the group's API.
- **`radio-group.md`'s keyboard table is repaired (drift → truth).** Today it claims ArrowLeft/Right navigate;
  the shipped vertical roving makes them inert. The repair splits the table **per orientation**: vertical =
  Up/Down + Home/End; horizontal = Left/Right + Home/End — the honest contract for each. The `attributes[]` block
  gains the `variant` **and** `orientation` rows (ADR-0081 trip-wire).
- **Not presentation-only — the `.ts` touch is real.** The variant mints `orientation`, resolves it at connect,
  passes it to `rovingFocus`, and writes `--ui-radio-group-index` / `-count` on the commit path. A skim must not
  drop the `.ts` slice: the build is one CSS block + two props + the orientation resolution + the two-line state
  seam. The commit path's *behavior* is unchanged; the state seam is additive.
- **One shared indicator, not per-segment paint.** A single moving `::before` gives the continuous slide (a
  per-segment background cannot animate) and halves the paint (one filled artifact, not one per segment). The
  cost: the indicator math depends on gapless equal cells + the `.ts` state seam, and a no-selection state must
  hide the indicator.
- **Selected-fill is accent, not neutral-raised.** The iOS-style neutral raised pill is deferred (Alternatives)
  — the accent fill reuses a shipped AA role and gives the strongest fill-presence signal with zero new color
  tokens.
- **jsdom cannot evaluate pseudo-class paint, `::before` geometry, `transform`, scheme-switching, or
  forced-colors** — the grid layout, the moving-indicator geometry + slide, the reduced-motion jump, the
  hover/active wash, the forced-colors inversion, and the selected-distinguishable-without-color proof are
  **browser-gate, both engines** (the fleet control-wave precedent; the "test the whole shape" lesson — assert
  the rendered bounding box is a real row/stack, not a collapsed sliver). jsdom covers the reflected `variant` /
  `orientation` attributes, the resolved-orientation reflection, `role`/`aria-checked`, the roving tabindex, the
  per-orientation arrow keys, the `--ui-radio-group-index`/`-count` custom-property writes, and single-select
  exclusivity.
- **Fleet gap raised (not fixed):** `--ui-motion-fast`'s doctrine comment (`dimensions.css:72–80`) did not
  name `transform` as an allowed transition target — since widened by a token-builder to bless the
  state-driven-transform exception (clause 5).
- **Stale → re-verify:** `controls/radio/{radio-group.ts,radio-group.css,radio-group.md}` · the docs-preview
  knob wiring (first consumer) · `dimensions.css` motion-doctrine comment (fleet gap) · this ADR's index row.

## Acceptance

- **Attributes (jsdom):** `variant` reflects (`'default'` default) and `orientation` reflects (`'vertical'`
  default); `[variant='segmented']` present after set; after `variant='segmented'` with no explicit orientation,
  the host reflects `orientation='horizontal'` at connect (the variant-derived default, resolved once);
  `attributes[]` in `radio-group.md` mirrors `static props` for both new props (ADR-0081 trip-wire green).
- **Grid + segment geometry (browser, both engines):** a rendered `md` segmented group is `display:grid` with
  **equal cells** and no inter-cell gap — a **real bounding box** (horizontal: a full-width row, segment
  inline-sizes equal ±1px; vertical: a stack, block-sizes equal), not a collapsed sliver. Each segment
  `blockSize == getComputedStyle(--ui-height-md)`; `padding-inline == blockSize / 2` (±ε); `padding-block == 0`;
  **line-height** verified by reading the `--ui-control-line-height` custom property (`== '1'`) **or** asserting
  computed `line-height == font-size × 1` px — **never** asserted `=== '1'` (`--ui-control-line-height` is
  unitless `1`, but `getComputedStyle().lineHeight` returns the used px value). The dot `::before` computes
  `display:none`. One outer `--ui-radius-base` track; adjacent segments share a single divider (no double
  border); the first segment suppresses its leading divider.
- **Shared moving indicator (browser, both engines):** the group `::before` paints **one** fill of
  `--md-sys-color-primary-selected` sized to one cell over the selected segment; its `transform` translate offset
  `== selectedIndex × cellSize` (translateX horizontal / translateY vertical), and `grid-column`/`grid-row` is
  **not** used to place it. Selecting a different segment changes the `transform` toward the new cell (the
  slide). The selected segment ink `== --md-sys-color-primary-on-primary`; unselected ink
  `== --md-sys-color-neutral-on-surface-variant`. With no radio checked, the indicator is hidden (opacity 0).
- **Motion (browser):** the `::before` `transition-property` includes `transform` over `--ui-motion-fast`; under
  `prefers-reduced-motion: reduce` the `::before` `transition` computes `none` (the indicator jumps).
- **Selected distinguishable without color (browser):** (a) **presence** — exactly one cell is backed by the
  indicator fill while the others are not (a paint-presence difference, not a hue swap); (b) **forced-colors
  emulation** — the indicator resolves to `Highlight`, the selected ink to `HighlightText`, visibly distinct from
  the unselected `ButtonText` on `ButtonFace`, the indicator still positions (transform applies), and the
  `:focus-visible` outline survives.
- **Interaction states (browser):** unselected hover → `--md-sys-color-primary-container-low`, active →
  `--md-sys-color-primary-container`; the **selected** segment does not wash on hover (it holds);
  `:focus-visible` outline present (not `none`) and forced-colors-safe; a **disabled** group holds at idle (no
  hover/active lift — the washes are suppressed under `effectiveDisabled`).
- **A11y / keyboard per orientation (jsdom + browser):** group `internals.role == 'radiogroup'`, each segment
  `role == 'radio'` with `aria-checked` exposed; exactly one segment `tabindex=0`; **horizontal** →
  ArrowRight/Left move focus + selection (selection-follows-focus), **vertical** → ArrowDown/Up, Home/End jump to
  ends; single-select exclusivity + the group form value/validity are unchanged (the existing `radio-group`
  suite stays green).
- **State seam (jsdom):** after a commit, the host style carries numeric `--ui-radio-group-index` (== the
  selected index) and `--ui-radio-group-count` (== the segment count), refreshed on every commit **and on form
  reset** — after `form.reset()` the `--ui-radio-group-index` == the default-checked index (so the indicator
  repositions to the restored selection, not the pre-reset one).
- `adr_check.py` exit 0; index row present; `coverage_check.py segmented.decomp.json` exit 0.

## Alternatives considered

- **A new `ui-segmented` component** — rejected: a segmented control *is* a single-select radio-group with
  joined-button presentation. A new element would duplicate the group's shipped single-select exclusivity,
  roving focus, selection-follows-focus, value model, and `required→valueMissing` validity — the exact machinery
  the group already owns — and then have to keep it in sync. The delta is presentational + two props, so a
  **variant reuses 100% of the behavior**; a new component forks it and invites drift.
- **Per-segment background paint (no shared indicator)** — rejected (this was the prior revision's design): a
  `background` on the checked `ui-radio` cannot *slide* — a background swap is instant, and cross-fading two
  segments' backgrounds does not read as one object moving. Only a **single shared `::before` translated via
  `transform`** gives the continuous animation Kim asked for; it also halves the paint (one filled artifact, not
  one per segment) and gives one clean home for the accent fill + forced-colors inversion.
- **Segmented-only orientation vs a group-wide `orientation` prop (the seam choice)** — chose the **group-wide**
  reflected `orientation`: the roving axis is a group-level concern the default variant also benefits from (a
  horizontal radio row), and a second variant-scoped knob would duplicate the axis concept. The **variant-derived
  default** is resolved-and-reflected once at connect (single source for both CSS and the roving trait), rejected
  the alternative of encoding "segmented ⇒ horizontal" separately in CSS *and* JS (two sources → drift). A hard
  single default (e.g. always `'vertical'`) was rejected because it would make `variant="segmented"` render a
  *vertical* segmented control by default, against Kim's "defaults horizontal."
- **A neutral raised "iOS" selected pill on a sunken track** — rejected for v1: it needs the container
  elevation/brightness surface model (ADR-0015) plus a track fill — more machinery than a variant warrants. The
  accent moving indicator reuses the shipped AA `--md-sys-color-primary-selected` role (zero new color tokens)
  and gives the strongest fill-presence non-color signal. Can return as a second segmented sub-style (an inset,
  raised thumb) if a consumer asks.
- **Reflect `variant` onto each `ui-radio` child (per-radio attribute)** — rejected: the group owns the variant;
  propagating via a descendant compound selector needs zero per-child state and keeps the radio ignorant of the
  group's presentation (layer discipline). A per-child reflected attribute duplicates state and risks
  per-segment mismatch in a control that must look uniform.
- **`overflow:hidden` on the group to clip the indicator to the rounded track** — rejected: it also clips the
  segments' `:focus-visible` outline (the fleet ring rides 2 px *outside* the box, ADR-0009), swallowing the
  keyboard indicator on inner segments. Rounding the indicator's own corners (`calc(--ui-radius-base - 1px)`) and
  the track ends clips the fill without touching the outline.
- **`grid-template-columns: repeat(var(--count), 1fr)` for the cells** — rejected as unusable: `repeat()`'s
  count must be a literal integer; a custom property cannot drive it. `grid-auto-flow:column; grid-auto-columns:1fr`
  (and the row equivalent) is the count-agnostic mechanism.
- **Per-`[size]` `sm`/`lg` ramp via a new group `size` attribute now** — rejected for v1 (deferred): the `md`
  register + `[scale]` re-tabling (ADR-0038) already covers the docs-preview consumer; a group `size` attribute
  widens the API ahead of any `sm`/`lg` segmented consumer. Named follow-up: mint it when one lands.
