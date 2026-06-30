# LLD — UIIndicatorElement (the Indicator-class base: checkbox · switch · radio)

> Component LLD for the control suite (#49 Wave 0). Trace authority: the components use **plan.md / goals.md /
> the ADR log** (not a formal SPEC family — that is the A2UI layer's structure). This LLD traces to the ADRs +
> `goals.md §G6`. · proposed · 2026-06-30 · planning-lead
>
> **Composes on:** `UIFormElement` (ADR-0013, dom) · the `pressActivation` trait · the anatomy slot model
> (ADR-0006/0012) · the widget geometry `--ui-compact` + `--ui-widget-inset` (ADR-0041). · **Layer:**
> `controls/_base/` (a shared control-base sub-layer like `_surface/`) — imports dom + traits (inward-only ✓).
>
> **Trace note.** Component LLDs trace to the **ADR log + `goals.md` milestones** (the components' design
> authority); they do **not** use the A2UI `SPEC-R#` family (the components have none), so the A2UI LLD
> harness's `SPEC-R#` check is N/A here. `LLD-C#` IDs are per-doc-scoped (the A2UI-LLD convention).

## Intent

`UIIndicatorElement` is the shared base for the **Indicator** class — small-box, boolean/grouped FACE controls:
`ui-checkbox`, `ui-switch`, `ui-radio`. It folds the three things every Indicator shares (the boolean form
value, the checked-state machine + ARIA, the widget-box geometry + toggle) into one base so a leaf control is
*only* its glyph + grouping. Why a **base class**, not a trait: it changes the host's **value identity**
(a boolean `checked` is the form value) — a trait cannot.

## Components

- **LLD-C1 — the value.** `checked: boolean` (reflected prop, the form value). `formValue()` → `checked ?
  value : null` (the platform's checkbox semantics — unchecked submits nothing; `value` defaults `"on"`).
  `indeterminate: boolean` (property-only, NOT submitted) for tri-state checkbox. Traces ADR-0013 (the
  `formValue()` hook).
- **LLD-C2 — the state machine + ARIA.** A scope-owned effect publishes `:state(checked)` /
  `:state(indeterminate)` (custom states via `internals`) AND `internals.ariaChecked` (`"true"`/`"false"`/
  `"mixed"`) — ARIA over `ElementInternals`, never host attributes (FACE). The subclass declares the **role**
  (`checkbox` / `switch` / `radio`) via `internals.role`.
- **LLD-C3 — the toggle.** The base wires `host.use(pressActivation)` so click/Space toggles `checked`
  (Enter does NOT toggle a checkbox — platform parity). A disabled host is inert (the `tabbable`/disabled
  path, ADR-0010). The toggle emits `change` (+ `input` on the same tick) — the event allowlist.
- **LLD-C4 — the geometry.** The control `.css` sizes the box on `--ui-compact-{size}` (ADR-0041 widget ramp),
  `[size]`/`[scale]` re-table; a **thumbed** indicator (`ui-switch`) insets its knob `--ui-widget-inset` (2px)
  → `thumb = box − 2×2px`, a pill track (`radius = box/2`). The checkmark/dash (checkbox) is a mask glyph
  sized to the box. Density-invariant (§1.4).
- **LLD-C5 — grouping (radio only).** `ui-radio` participates in a **radio-group** (single-selection):
  `name`-scoped, roving-focus + exclusive `checked` (the `roving-focus` trait + the group's selection-commit).
  The base exposes a `grouped` hook the radio subclass wires; checkbox/switch are ungrouped.

## Subclass contract (what a leaf control provides)

```
class UICheckboxElement extends UIIndicatorElement {
  static role = 'checkbox'            // LLD-C2
  // glyph: a checkmark/indeterminate-dash mask in {name}.css; box on --ui-compact
}
class UISwitchElement extends UIIndicatorElement { static role = 'switch' /* thumb + 2px inset, LLD-C4 */ }
class UIRadioElement  extends UIIndicatorElement { static role = 'radio'  /* + group, LLD-C5 */ }
```
The base owns LLD-C1..C4; the subclass declares `role`, the glyph (`.css`), and (radio) the group wiring.

## Error / edge handling (L5)

- **Disabled + checked:** a disabled indicator holds its `checked` paint (no toggle); `formValue()` still
  reflects (a disabled control submits nothing — the platform gates it). Pointer-inert + removed from tab order.
- **indeterminate + checked:** `indeterminate` overrides the visual (`ariaChecked="mixed"`) but `checked`
  retains its boolean for the form; clicking an indeterminate checkbox clears `indeterminate` and toggles
  `checked` (platform parity).
- **Radio with no selection / all unchecked:** a group may start unselected; arrow-key into the group selects
  the first (roving). A `required` radio-group with no selection → `valueMissing` (the base's `formValidity()`).
- **Reconnect:** the checked-state effect re-applies on reconnect (the `#scope`/`#ac` zero-residue lifecycle);
  the toggle/roving listeners re-arm (AbortSignal). Connect→disconnect leaves zero subscribers/listeners (C10).
- **Reflected-attr round-trip:** `checked` reflects so `[checked]` styling + a JS-set value both submit keyed.

## New-ADR flags

- **NEW ADR — UIIndicatorElement (the Indicator base contract)**, proposed: the base + the `controls/_base/`
  layer placement + `formValue()` checkbox semantics + the role/checked-state contract. Extends ADR-0013
  (UIFormElement) + ADR-0041 (geometry). Kim/host gates on the green G6 gate.
- Relates: ADR-0010 (tabbable/disabled), ADR-0006/0012 (anatomy — an Indicator may carry an optional label slot).

## Acceptance (the G6 control bar, per leaf control)

jsdom: `checked`/`indeterminate` value + `formValue()` + the custom states + `ariaChecked` + the toggle +
(radio) group exclusivity. Browser smoke: the box renders `--ui-compact` per `[size]×[scale]`; the switch
thumb = `box − 4px` (the 2px inset); checked paint + forced-colors. C10: connect→disconnect zero-residue +
the gz marginal.
