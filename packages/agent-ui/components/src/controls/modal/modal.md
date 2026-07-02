---
# modal.md frontmatter — the attributes-as-API descriptor for ui-modal (ADR-0004 / ADR-0017). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror modal.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness — plus open/persistent) — the contract↔props trip-wire (modal-descriptor.test.ts) and
# the frontmatter schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; the native-dialog
# modal per ADR-0017; the bindable `open` two-way per ADR-0019.
tag: ui-modal
tier: pattern             # geometry size-class — geometry.md lists `dialog` under the Pattern band (the shell uses the --ui-space scale, NO control height)
extends: UIContainerElement  # the FACE surface base — NOT form-associated (no value/validity); reuses the inherited ElementInternals for nothing here (the dialog carries its own ARIA)
# marginal: ui-modal adds 330 B gz (1322 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:               # attributes-as-API — mirrors modal.ts `static props` (the surface axes first, then open/persistent)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]   # the scheme-INVERTING surface plane (ADR-0015 cl.1); 0 = the neutral base. `0` LEADS so an out-of-range attr snaps to neutral
    default: 0
    reflect: true         # reflects so the container.css [elevation=n] surface repoint applies to JS-set values (the value inherits to the dialog part)
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]   # the scheme-CONSISTENT tonal shift (ADR-0015 cl.1); 0 = no wash
    default: 0
    reflect: true         # reflects so the container.css [brightness=m] surface repoint applies to JS-set values
  - name: open
    type: boolean
    default: false
    reflect: true         # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019); drives showModal()/close()
  - name: persistent
    type: boolean
    default: false        # default OFF — Escape (the `cancel` event) + a backdrop click dismiss the modal; set `persistent` (presence) to BLOCK user dismissal (the agent owns the close)
    reflect: true         # reflects so the declared/JS-set value stays inspectable/serializable

properties:               # IDL beyond attributes-as-API — the reflected props read/write as element properties
  - name: open
    description: Whether the modal is shown (boolean). Setting it true calls the dialog's showModal() (top layer + ::backdrop + focus trap + Escape); false calls close(). Reflected + bindable (the two-way `open`, ADR-0019).
  - name: persistent
    description: Whether the modal BLOCKS user dismissal (boolean, default false). When present/true the dialog's cancel event (Escape) is preventDefault-ed and a backdrop click is ignored — the agent owns the close (set open=false). Absent ⇒ the user can dismiss it (Escape + backdrop click).

events:
  - name: close
    detail: 'null'
    description: Fired when the modal is dismissed by the USER/platform (Escape, a backdrop click, or an external dialog close) — NOT when the agent programmatically sets open=false. The state is synced (open=false) before it fires.
  - name: toggle
    detail: 'null'
    description: Fired alongside `close` on a user/platform dismissal — the value:{event:'toggle'} two-way signal the renderer binds to write `open` back into the data model (ADR-0019). Emitted only on a user-driven state change, not a programmatic one.

slots: []                 # no NAMED slots — the modal's children are MOVED into the dialog PART at connect and render inside it (see the prose); there is no host-as-grid slot grammar

parts:                    # the native <dialog> is a control-owned PART, not a user slot (ADR-0017 cl.1)
  - name: dialog
    description: The control-created light-DOM `<dialog data-part="dialog">` the modal renders into. Created ONCE (idempotent guard) and NEVER re-rendered (render() stays the inherited void — re-creating the dialog would drop the top-layer + focus state; ADR-0017 cl.1). It carries the dialog role natively; aria-modal is set by showModal(); an author aria-label/aria-labelledby is forwarded onto it. The host carries no role/aria-* attribute.

customStates: []          # none — the modal uses no :state() custom states (the open/closed visibility is the native dialog's [open]/top-layer, not a custom state)

face:
  formAssociated: false   # NOT a FACE form control — a <dialog> submits nothing, carries no value, is not form-associated (ADR-0017 — the ADR-0014 widgets-not-elements reading of "no native form elements")

aria:
  role: dialog            # the native <dialog> PART carries the dialog role implicitly; showModal() sets aria-modal — NOT set on the host (the host carries no role/aria-* attribute)
  roleSource: native <dialog> part
  labelSource: aria-label / aria-labelledby   # an author accessible name is FORWARDED off the host onto the dialog part (ADR-0017 cl.5); a labelling heading child is the common pattern
  modal: aria-modal is set by showModal() (the platform), never an author/host attribute

keyboard:
  - keys: Escape
    action: Dismisses the modal when NOT `persistent` (the platform `cancel`/`close` events → open=false + close/toggle + focus restore). When `persistent` the cancel is preventDefault-ed and Escape does nothing.
  - keys: Tab / Shift+Tab
    action: Focus is TRAPPED within the dialog by the platform's showModal() (the modal top layer is inert to the page behind it). Focus is RESTORED to the opener on close (the one platform gap the control owns — ADR-0017 cl.4).

geometry:
  sizeClass: pattern      # geometry.md Pattern band — the shell spaces off --ui-space × density; NO control height (--ui-height-* is never read)
  padding: var(--ui-modal-padding)   # the dialog shell pad = var(--ui-space-lg) (density-responsive layout spacing, NOT a control dimension)
  radius: var(--ui-modal-radius)     # = var(--ui-radius-base), the shared fleet radius (ADR-0015 cl.5)
  surface: var(--ui-container-bg) + var(--ui-container-tint)   # the elevation×brightness surface seam (ADR-0015), inherited from the host onto the dialog part

forcedColors: A `@media (forced-colors: active)` block keeps the dialog surface, frame, and ink visible as system colours (Canvas / CanvasText) and drops the tonal wash (a translucent overlay would defeat the forced Canvas base); the ::backdrop scrim is left to the scrim role / UA so the blocking layer still paints — ADR-0017.
---

# ui-modal

`ui-modal` is a **modal dialog** built on the native `<dialog>` element opened with `showModal()` (ADR-0017).
It extends `UIContainerElement` (the surface base) and is **not** form-associated — a `<dialog>` submits
nothing and carries no value, so it honours the "no native form elements" rule under the widgets-not-elements
reading (ADR-0014 / ADR-0017). The platform supplies the four hard modal behaviours **free**, in the top layer:
top-layer **stacking** (above any `z-index`/`overflow`/stacking context), a `::backdrop`, focus **containment**,
and **Escape-to-dismiss**. The control adds only the gaps the platform leaves — focus **restore** on close and
the `open`↔platform **sync**.

```html
<ui-modal open>
  <h2 id="title">Delete file?</h2>
  <p>This cannot be undone.</p>
  <ui-row>
    <ui-button variant="ghost">Cancel</ui-button>
    <ui-button variant="solid">Delete</ui-button>
  </ui-row>
</ui-modal>

<ui-modal persistent elevation="2"><!-- a blocking, non-dismissable modal --></ui-modal>
```

## The dialog part

The modal renders into a control-owned **`<dialog data-part="dialog">`** PART, created **once** (an idempotent
guard) and **never re-rendered** — `render()` stays the inherited void, because re-creating the dialog would
drop the top-layer and focus state mid-session (ADR-0017 cl.1). The modal's children are **moved into** the
dialog at connect and render inside it; there are no named slots. The host is `display: contents` — a logical
wrapper that generates no box, so only the dialog (in the top layer when shown) renders.

## Open / close

`open` is a reflected boolean driven by a scope-owned effect: setting it **true** calls `dialog.showModal()`
(top layer + `::backdrop` + focus trap + Escape, all from the platform); **false** calls `dialog.close()`. When
the **user** dismisses the modal (Escape, a backdrop click, or an external close), the dialog's `close` event
syncs `open = false` and emits the family **`close`** plus **`toggle`** — the two-way bind signal the renderer
writes back into the data model (`value: { prop: 'open', event: 'toggle' }`, ADR-0019). A close the agent drove
(the prop already went false) only restores focus — no redundant emit.

## Dismissal

`persistent` (default **off**) gates user dismissal. By default the user can dismiss a modal with Escape or a
backdrop click; set **`persistent`** (`<ui-modal persistent>`) and the dialog's `cancel` event (Escape / the
platform light-dismiss request) is `preventDefault`-ed and a backdrop click is ignored — the agent owns the close
(set `open = false`). A backdrop click is detected rect-wise: a click whose target is the dialog box but lands
**outside** its content rect is the `::backdrop`.

## Focus

`showModal()` **traps** focus inside the dialog and moves initial focus in (an `autofocus` child, else the
dialog). The platform does **not** restore focus to the invoking element on close, so the control records
`document.activeElement` at open and **restores** it on close — the one focus gap the platform leaves
(ADR-0017 cl.4).

## Accessibility

The `<dialog>` part carries the **dialog** role natively and `aria-modal` is set by `showModal()`. An author
accessible name (`aria-label` / `aria-labelledby`) is **forwarded** off the host onto the dialog part, so the
host stays free of `role`/`aria-*` (the family's `internals`-only ARIA discipline) and the name rides the
semantic element; a labelling heading child is the common pattern.

## Surface

The dialog plane reads the **elevation × brightness** surface seam (`--ui-container-bg` / `--ui-container-tint`,
ADR-0015): `elevation` selects the scheme-inverting plane, `brightness` a scheme-consistent tonal wash, both
defaulting to the neutral base. Unlike a layout primitive (transparent by default), a modal sets its **own**
default `--ui-container-bg` so the plane is opaque. The shell pads off `--ui-space` (density-responsive,
**not** a control height) and corners off the shared `--ui-radius-base`. A forced-colors block keeps the
surface, frame, and ink visible as system colours.
