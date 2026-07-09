---
# toast-region.md frontmatter — the attributes-as-API descriptor for ui-toast-region (ADR-0004 /
# feed-family.lld.md LLD-C8 / ADR-0112 cl.5/cl.6). The machine-checkable public surface lives HERE
# (frontmatter); the prose below the fence is the /site doc. `attributes: []` is the deliberate,
# verified-parseable empty sequence (the ui-form-provider precedent) — toast-region.ts declares
# `static props = {} satisfies PropsSchema`, the EMPTY schema; the contract↔props trip-wire
# (toast-region-descriptor.test.ts) targets the empty bijection. Field set per .claude/docs/plan.md §10
# / ADR-0004. NOT catalogued — ADR-0112 cl.6's second reasoned EXCLUSION_ALLOWLIST entry.
tag: ui-toast-region
tier: layout             # geometry size-class — inset/gap only, no surface paint of its own (LLD-C8)
extends: UIElement       # NOT form-associated — a pure layout/coordination host, no value
# marginal: measured at the LLD-C11 shared-file integration slice (npm run size, ADR-0040 §3) — not measured in this folder-local wave

attributes: []            # a coordination/layout element takes no configuration in v1 — placement is tokens (a `placement` prop is the named foreseen extension, LLD-C8)

properties:                # the public IDL — with no attributes, this is the entire public surface beyond the popover platform attribute
  - name: show
    description: 'Method — show(options: ToastOptions | string): UIToastElement. A bare string shorthand normalizes to { message }. Creates a ui-toast, assigns urgent/duration/action from options, sets its message text BEFORE appending it (announcement-correct), re-asserts top-layer order (so a toast arriving while a LATER modal is open still paints above it), appends it, and returns the created element. Throws if called while the region is disconnected (a dev error, never a silent queue).'

events: []                 # the region itself emits nothing of the family vocabulary — each contained ui-toast carries its own select/close events

slots:
  - name: default
    optional: true
    description: Zero or more ui-toast children, stacked in append order (oldest→newest, top→bottom). Composed either declaratively (author-authored markup) or imperatively via show() (the sanctioned entry point).

parts: []                  # the host IS the popover — no control-created child parts

customStates: []           # no :state() hooks — visibility rides the platform :popover-open pseudo-class, not a custom state

face:
  formAssociated: false    # NOT a FACE form control — a pure layout/coordination host, no value

aria:
  role: none                # pure layout coordination — no accessible surface, no role, no aria-* attribute on the host
  roleSource: none
  labelSource: none

keyboard: []                # no keyboard model of its own — each contained ui-toast owns its own affordances' tab order

geometry:
  sizeClass: layout
  inset: var(--ui-toast-region-inset)      # = var(--ui-space-lg) — the fixed block-end/inline-end inset once popover-open
  gap: var(--ui-toast-region-gap)          # = var(--ui-space-sm) — the inter-toast stacking gap
  note: ui-toast-region declares NO surface/radius/colour token chain (LLD-C8 — a pure layout element has no colour voice of its own, the ui-form-provider precedent) — each contained ui-toast supplies its own surface. No [size]/[scale] axis.

forcedColors: No forced-colors rule needed — the region paints nothing of its own (transparent background, pointer-events:none over the empty area); each contained ui-toast carries its own independent WHCM treatment.
---

# ui-toast-region

`ui-toast-region` is the **top-layer host** `ui-toast` instances stack inside — the fleet's first
transient notification surface (ADR-0112, feed-family.lld.md LLD-C8). It extends `UIElement`, takes
**no configuration** in v1 (`attributes: []`), and is **not** form-associated. Like its sibling
`ui-toast`, it is **deliberately not catalogued** (ADR-0112 cl.6) — see `toast.md`'s "App-surface
consumption story."

```html
<ui-toast-region></ui-toast-region>
<script type="module">
  const region = document.querySelector('ui-toast-region')
  region.show('File uploaded.')
  region.show({ message: 'Upload failed.', urgent: true, action: 'Retry' })
</script>
```

## Ownership

**v1 ownership is consumer-mounted.** A page (or an app embedding `agent-app-shell`) declares
`<ui-toast-region>` where it wants announcement scope and holds the reference it calls `show()` on.
There is **no static singleton anywhere** in this component — `UIToastRegionElement.show` does not
exist as a class-level API, only as an instance method (ADR-0082's per-instance isolation: two
independent regions never contend over hidden global state). The `@agent-ui/app` package composing a
default region into its own chrome is that package's own future decision, by reference — not decided
here.

## Top layer

At connect, the host sets its own `popover="manual"` attribute (a platform attribute, never ARIA) if
one is not already present — the region **is** its own Popover-API top-layer element, not a wrapper
around a separate panel part. A `MutationObserver` watches its own `childList`: whenever it holds one
or more `ui-toast` children it calls `showPopover()`; whenever it holds none it calls `hidePopover()`.
Manual popovers take no light-dismiss (no Escape/outside-click auto-close) and allow multiple concurrent
open popovers on the page — exactly the toast region's semantics.

## `show()`

`show(options: ToastOptions | string): UIToastElement` is the sanctioned entry point. A bare string is
shorthand for `{ message: theString }`. The sequence is announcement-correct and top-layer-correct by
construction:

1. Create a `<ui-toast>` element (not yet connected).
2. Assign `urgent`/`duration`/`action` from `options` (each only if provided — unset options fall back
   to `ui-toast`'s own prop defaults).
3. Set the toast's `textContent` to `options.message` — **before** it is appended, so the content is
   present the instant the live region becomes visible.
4. Re-assert top-layer order: if the region is already open, it calls `hidePopover()` then
   `showPopover()` back-to-back (synchronous, same frame) so a toast arriving while a **later** modal
   opened is still guaranteed to paint above it.
5. Append the toast (triggering the `MutationObserver`, which opens the region if it was not already
   open) and return it.

Calling `show()` on a **disconnected** region throws — a development error, never a silently-dropped or
queued toast.

## Stacking

Normal-flow flex column inside the popover, zero JS positioning: append order is oldest→newest,
top→bottom, with the newest toast nearest the fixed block-end inset edge. Logical CSS properties
(`inset-block-end`/`inset-inline-end`) mean RTL mirrors for free.

## Accessibility

The region itself carries no role and no accessible surface — it is pure layout coordination. Each
contained `ui-toast` is independently responsible for its own `role="status"`/`role="alert"`
announcement (see `toast.md`); the region never takes focus, and the empty region area is
`pointer-events: none` so it never intercepts clicks on the page beneath it.
