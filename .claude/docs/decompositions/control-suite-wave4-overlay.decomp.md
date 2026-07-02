# Decomp — Control suite Wave 4: Overlay family (ui-popover · ui-tooltip · ui-menu · ui-select · ui-combo-box)

> #49 Wave 4 (milestone **G7** — the heaviest wave; the shippable-family capstone). Composes the **Wave-0
> primitives** (built + committed): the `overlay` controller (Popover API + JS positioning, ADR-0043 /
> `overlay-controller.lld`) · `UIListboxElement` + `roving-focus` + `selection-commit` (`listbox-roving.lld`) ·
> the modal `<dialog>` boundary (ADR-0017, unchanged). **S1's + S4's green smokes RATIFY ADR-0043 → accepted.**
> File-disjoint per control dir. Bake the Wave-1 review lessons in upfront; overlays are **WebKit-sensitive** —
> every smoke is Chromium **AND** WebKit. · proposed · 2026-06-30 · planning-lead

## Geometry-by-part (each overlay control is a composite)

- **trigger** (select's button, combo-box's field) — **Control class** (`--ui-height`, the caret `= font`).
- **surface** (the popup panel) — **Container/surface** (`--ui-container-bg` + `--ui-radius-base` + `--ui-space`
  padding, like card/modal — NOT a control height or widget box).
- **rows** (listbox option / menuitem) — the **legacy item-pad** (ROV-C5 / §4.6/§5.1), NOT the `--ui-compact`
  widget box; a leading check/icon is a slot adornment.

## Slices (file-disjoint by exact path; build order low→high composition)

### S1 — `ui-popover`  (`controls/popover/`)  ⭐ proves the `overlay` controller (build FIRST)
- **Composition:** a `UIElement` host + `host.use(overlay, {popup, anchor, placement})` — the **bare overlay**
  (Popover API surface + JS positioning + light-dismiss + two-way `open`, ADR-0019). NOT form-associated. A
  disclosure trigger toggles it. `role` minimal; the panel is a surface.
- **Probes (jsdom):** `open` two-way + `toggle`/`close` events; the popover part created once (idempotent).
- **Browser smoke (Chromium+WebKit — ⭐ ADR-0043 overlay-half gate):** the panel renders in the **top layer**
  above an `overflow:hidden`/`transform` ancestor; **light-dismiss** (Escape + outside-click) closes + syncs
  `open`; **positioning** flips/shifts at the viewport edge (the JS controller); `@supports` anchor-positioning
  branch where available; forced-colors (`::backdrop` + surface). C10 `inspect()` zero-residue (the
  scroll/resize/toggle listeners released).

### S2 — `ui-tooltip`  (`controls/tooltip/`)
- **Composition:** `overlay` with `popover=manual` + **hover/focus triggers + a show-delay**; **no focus move**
  (a tooltip never takes focus); `role=tooltip`, `aria-describedby` the anchor (internals). Dismiss on
  blur/leave/Escape.
- **Smoke:** shows on hover AND keyboard-focus (not just hover — a11y); never steals focus; positioned; WebKit.

### S3 — `ui-menu`  (`controls/menu/`)
- **Composition:** `overlay` + `roving-focus` (role=menu, items `role=menuitem`) + **commit→action** (emits an
  action/`select`, **NON-value** — like `ui-tabs`, not form-associated). A trigger opens; Arrow roves; Enter/click
  commits + closes; type-ahead. Focus moves INTO the menu on open, restores to the trigger on close (OVL-C4).
- **Probes:** roving + type-ahead + commit→action + open/close; menuitem `disabled` skipped.
- **Smoke (WebKit):** the menu opens in the top layer, roves real focus, commits, closes; forced-colors.

### S4 — `ui-select`  (`controls/select/`)  ⭐ proves overlay + listbox together
- **Composition:** a **trigger** (Control-class button showing the selected option's label + a caret) +
  `host.use(overlay)` + a **`UIListboxElement` popup** (the options, roving + single/multi selection). **Form-
  associated** (`formValue()` = the listbox value; two-way `selected` + `open`, ADR-0019). Keyboard on the
  **closed** trigger (Arrow) opens AND moves (platform parity); commit on selection; close restores focus to the
  trigger.
- **Probes (jsdom):** `selected`/`open` two-way; `formValue()` + `valueMissing` (required, none); the trigger
  label reflects; keyboard open+navigate+commit.
- **Browser smoke (Chromium+WebKit — ⭐ the ADR-0043 select gate):** the listbox opens in the top layer,
  keyboard-navigates + commits + closes, the value round-trips; forced-colors; C10 zero-residue.

### S5 — `ui-combo-box`  (`controls/combo-box/`)  (heaviest — build last)
- **Composition:** a **text-field input** (contenteditable) + `host.use(overlay)` + a **`UIListboxElement`
  popup** + a **filter** (the input text filters the options). **Active-descendant** (OVL/ROV-C1 — focus STAYS on
  the input, `aria-activedescendant` marks the highlighted option; Arrow moves the active option without moving
  DOM focus). Form-associated (the committed value; free-text allowed vs select's fixed set). Type filters →
  Enter/click commits → the input shows the label.
- **Probes:** filter narrows the list; active-descendant moves without focus leaving the input; commit sets the
  value; free-text vs option; `open` on type.
- **Smoke (Chromium+WebKit):** type→filter→active-descendant→commit in the top layer; the input keeps focus;
  forced-colors; C10 zero-residue.

## Wave-1 review lessons — BAKED IN (every slice)
(1) contract↔props trip-wire with **biting NCs** (the descriptor's props/events/states — `selected`/`open`/`select`
— match `static props`; a `@ts-expect-error`; a descriptor-mismatch FAILS). (2) `inspect()` **C10 zero-residue**
— the overlay controller's scroll/resize/toggle + the roving/selection listeners ALL released on disconnect;
`release()` idempotent; the popup part created once. (3) **anti-vacuous** geometry (the surface/trigger/rows exact
px; the top-layer escape asserted, not assumed). (4) **forced-colors** + `forced-color-adjust:none` where a token
is load-bearing. (5) **cross-engine (Chromium + WebKit)** on EVERY overlay smoke — top-layer, Popover API, and
positioning are WebKit-sensitive; a Chromium-only pass is not a pass.

## Per-control DoD + fan-out

Full G6/G7 bar + **component-reviewer ≥4 both axes BEFORE commit**. **Build order:** S1 popover (proves overlay)
→ S2 tooltip / S3 menu (overlay + roving) → S4 select (overlay + listbox) → S5 combo-box (all). **Blocks on:**
Wave 0 (overlay/listbox/roving/selection — committed) + (combo-box) the shipped `ui-text-field`. **File-disjoint**
per control dir (parallel where build-order allows); barrels + `BASE_CLASSES` + gz re-base at the wave boundary.
**Maps to:** goals.md **§G7** — the **shippable first family** box (goals §G7): an end-to-end keyboard-only form
(button + text-field + checkbox + switch + select-in-a-field, under a form-provider) round-trips. S4's green smoke
+ S1's ratify **ADR-0043 → accepted**. **Phase-2 deferred:** date/time/file pickers (compose overlay + a
calendar) are NOT this wave.

## Decisions (RULED by the team-lead 2026-07-01)
- **`ui-select` = single-select in Wave 4** (ruled) — proves overlay + listbox + form-value (the ADR-0043 G7
  gate). **Multi is a fast-follow** (a `multiple` prop composing `selection-commit` mode=multi + checkbox rows +
  a chip summary) — additive after, NOT this wave.
- **`ui-combo-box` `strict` prop, default OFF (free-text)** (ruled) — free-text is the general combo-box;
  `strict=true` opts into constrained (the typed value must match an option) for the select-with-filter use.
  Default-off is the less-surprising, more-capable base.
