# LLD — `ui-form-popover`

> Refines: `form-popover.spec.md` (SPEC-R1…R11) under GH #294's F1–F4 rulings and
> `form-popover.intake.md` (no ADR — every mechanism already ratified). Build plan:
> `form-popover.decomp.md`. · proposed · 2026-07-27 · design-294-control-intake
>
> **Composes on:** `UIElement` + props/signals (`dom/`), the overlay controller trait
> (`traits/overlay.ts`, ADR-0043/0045), the child-move pattern (ADR-0017), `[data-box]`
> (ADR-0046/0052), `@agent-ui/icons` `setIcon`. **Nearest shipped siblings:** `ui-popover`
> (`controls/popover/popover.ts` — the open/close/effect wiring is copied mechanics) and
> `ui-select` (`controls/select/select.ts` — the trigger anatomy + `[size]` geometry are copied
> mechanics). Deliberately does NOT nest `<ui-popover>` (nested child-move footgun, the patterns
> table's recorded constraint) and does NOT use `rovingFocus` (SPEC-R5).
>
> **Freeze discipline.** §2's interface is the fan-out contract. Every named API below was
> verified against shipped source at draft time (file:line cited). A builder who cannot satisfy it
> STOPS and escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

One new control folder, `controls/form-popover/`, whose element is ~popover.ts-sized: the same
overlay wiring plus a select-style trigger (label span + caret) and a `[data-box]` panel. The
work splits ≈ 40% element, 30% CSS/geometry, 30% descriptor + catalog + site.

## 2 · Frozen interface (LLD-C1…C7)

### LLD-C1 — Element skeleton (`form-popover.ts`)

```ts
// Verified imports (popover.ts:36-38 · combo-box.ts:36-40 · icons/src/resolve.ts:36):
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIElement } from '../../dom/index.ts'
import { overlay, type OverlayHandle, type OverlayPlacement } from '../../traits/overlay.ts'
import { setIcon } from '@agent-ui/icons'

const PLACEMENTS = [ /* mirror popover.ts:42-51 — the eight OverlayPlacement literals */
] as const satisfies readonly OverlayPlacement[]

const props = {
  open:      { ...prop.boolean(false), reflect: true },              // SPEC-R2; bindable (ADR-0019)
  placement: { ...prop.enum(PLACEMENTS, 'bottom-start'), reflect: true },
  label:     { ...prop.string(), reflect: true },                    // fleet label-reflects law (TKT-0069)
  size:      { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
} satisfies PropsSchema

export interface UIFormPopoverElement extends ReactiveProps<typeof props> {}
export class UIFormPopoverElement extends UIElement {
  static props = props
  // #panel: HTMLElement | null — parts-once guard (popover.ts:78 shape)
  // protected _overlayHandle: OverlayHandle | null — probe access (popover.ts:85 shape)
}
if (!customElements.get('ui-form-popover')) customElements.define('ui-form-popover', UIFormPopoverElement)
```

### LLD-C2 — Part creation (`#ensureParts()`, once, idempotent — SPEC-R1)

Follows `select.ts #ensureParts` for the trigger and `popover.ts:140-185` for the panel + child
move, with ONE ordering difference from popover: the trigger is CONTROL-CREATED and prepended, so
ALL author children (there is no author trigger) move into the panel.

- Trigger: `<button data-part="trigger" type="button">` containing
  `<span data-part="label">` (visible text; a scope-owned effect writes `this.label` into it) and
  `<span data-part="caret" aria-hidden="true">` filled via `setIcon(caretSpan, 'caret-down')`
  (select's caret, select.ts:468-471).
- Panel: `<div data-part="panel" tabindex="-1">` with stable id `ui-form-popover-panel-${++n}`
  (module counter, popover.ts:66-68 shape); set `data-box` (ADR-0046 — SPEC-R8); the overlay
  controller owns `popover="auto"` (single-ownership, ADR-0017 — do NOT set it here,
  popover.ts:158-159).
- Move every author child into the panel (popover.ts:169-175 loop, starting from
  `this.firstChild` since no author trigger exists), then prepend trigger, append panel.
- Trigger `aria-controls = panel.id` set once here; `aria-expanded` is effect-owned (LLD-C3).
- Reconnect path: parts persist; re-resolve trigger via `[data-part="trigger"]` query
  (popover.ts:141-146 shape).

### LLD-C3 — `connected()` wiring (SPEC-R3)

Byte-for-byte the popover mechanics (popover.ts:87-132), with `focusOnOpen: true`:

1. `const handle = overlay(this, { popup: panel, anchor: trigger, placement: this.placement, auto: true, focusOnOpen: true })`
2. `this.listen(trigger, 'click', () => { this.open = !this.open })` — flip the PROP, never
   `handle.toggle()` (ADR-0101 erratum, popover.ts:103-111).
3. `this.listen(this, 'close', () => { this.open = false })` — overlay→model sync.
4. `this.effect(() => { … })` — model→overlay: `open ? handle.open() : handle.close()` +
   `trigger.setAttribute('aria-expanded', String(open))`.
5. A second scope-owned effect writes `this.label` into `[data-part=label]`'s textContent
   (select's placeholder/label-effect shape).

No other listeners: child `change`/`input`/`select` bubble untouched (SPEC-R4); no keydown
handling beyond the native button (SPEC-R5).

### LLD-C4 — CSS (`form-popover.css`, one file, `@scope`)

- Trigger: Control-class geometry — `[size]` attribute-selector repoint of
  `--ui-form-popover-{height,font,icon,gap}` from the (scale×size) lookup rows, the select.css
  mechanism; `[label | caret]` grid `1fr auto`; caret cell centered by padding = ½(icon−glyph)
  (§4.1 caret law, select.css caret block); standard four interaction states + `[density]` per
  `interaction-states.md` (no deviation).
- Panel: Container/surface — bg/border/radius on `--md-sys-color-*` surface/outline roles;
  `[data-box]` provides inner spacing + `isolation: isolate` (ADR-0046/0052 — comes free);
  `min-inline-size: var(--ui-form-popover-panel-min-inline-size)` (floor ≈ the trigger + a text
  field's 20ch floor; exact value builder-tuned against the demo) and
  `max-inline-size: var(--ui-form-popover-panel-max-inline-size)`.
- Token set (all control-owned, ADR-0140): `--ui-form-popover-{height,font,icon,gap,radius,
  panel-min-inline-size,panel-max-inline-size}`. No new `--md-sys-*` role.

### LLD-C5 — Descriptor (`form-popover.md`)

`tag: ui-form-popover` · `tier: pattern` · `extends: UIElement`. `attributes[]` mirrors §LLD-C1's
four props exactly (the contract↔props trip-wire targets this fence). `events:` = `toggle` +
`close` with the ADR-0101 wording (copy popover.md's two entries). `slots:` = one default
"panel content" slot (general form content, F1). `parts:` = trigger/label/caret/panel.
`aria:` = role none · labelSource = the visible `label` text on the trigger · no haspopup
(SPEC-R6). `customStates:` none. `face:` formAssociated false.

### LLD-C6 — Catalog (`@agent-ui/a2ui`)

- Factory: `export const formPopoverFactory: WidgetFactory = accessorFactory('ui-form-popover', { prop: 'open', event: 'toggle' })`
  — the exact `popoverFactory` shape (factories.ts:404).
- One `FormPopover` row in `catalog.json`: `open` = `bindable: true` + row-level
  `value:{prop:'open',event:'toggle'}`; `label` = `bindable: true` (ONE-WAY data-model binding, no
  value event — the Icon.label precedent; the conformance validator rejects a `{path}` binding on a
  non-bindable prop, conformance.ts:65, so bindability here is what makes the agent-side
  summary-state binding legal); `placement`/`size` = non-bindable literals; `children` = plain
  ChildList → panel content (no trigger child — SPEC-R9's density win; document the contrast with
  `Popover` in the row description).
- Register `FormPopover: formPopoverFactory` in the factories registry map (factories.ts:~808 —
  `index.ts` is load-only, "factory-free by contract", NO edit there) + conformance/admission tests
  (the Wave-A row precedent, factories.ts:357-408). No `EXCLUSION_ALLOWLIST` touch.

### LLD-C7 — Site

- `form-popover-doc.html` + demo page per `site-authoring`; preview specimen + knobs in
  `site/lib/component-preview.ts` (example-authoring-agent's file — the specimen is the reference
  content: summary trigger, 6-item check group, radio group, text field; knobs: one per prop).
- The first-leg recipe page (built by the recipe slice) gains a cross-link: "packaged as
  `ui-form-popover`"; the control's doc page links back to the recipe for the long form.

## 3 · Risks

- The overlay controller captures `placement` per connection (documented popover limitation) —
  restate in the descriptor, don't fix here.
- Focus-timing browser probes are the flake class GH #56 quarantines: if the new
  `form-popover.browser.test.ts` focus/restore probes flake under concurrency, the append goes to
  `FOCUS_TIMING_FILES` in `vitest.browser.config.ts` — never a new shard.
- `label` prop with `''` default renders an empty trigger — the descriptor documents that a
  non-empty `label` is effectively required for an accessible name (validator/lint stays silent;
  consumer contract).
