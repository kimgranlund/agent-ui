---
# drawer.md frontmatter — the attributes-as-API descriptor for ui-drawer (ADR-0004 / ADR-0188). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror drawer.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness — plus open/persistent/edge) — the contract↔props trip-wire (drawer-descriptor.test.ts)
# and the frontmatter schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; the
# native-dialog drawer per ADR-0017 (re-applied) / ADR-0188; the bindable `open` two-way per ADR-0019.
tag: ui-drawer
tier: container          # geometry size-class — container-class sizing via [data-box]; NO control height (geometry.md)
extends: UIContainerElement  # the FACE surface base — NOT form-associated (no value/validity); a <dialog> submits nothing
# marginal: measured by `npm run size`'s components-barrel delta (manual by Kim's ruling) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:               # attributes-as-API — mirrors drawer.ts `static props` (the surface axes first, then open/persistent/edge)
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
    default: false        # default OFF — Escape (the `cancel` event) + a backdrop click dismiss the drawer; set `persistent` (presence) to BLOCK user dismissal (the agent owns the close). Modal's ADR-0020 shape verbatim
    reflect: true         # reflects so the declared/JS-set value stays inspectable/serializable
  - name: edge
    type: enum
    values: [end, start, bottom]   # LOGICAL inline names (`start`/`end`, super-shell LLD-C4); `bottom` stays PHYSICAL — the block axis never bidi-mirrors. `top` is deliberately absent (ADR-0188 cl.8 — additive enum growth later, no fork now)
    default: end           # the options-side case, #845's own
    reflect: true          # reflects so drawer.css's [edge] docking selectors apply

properties:               # IDL beyond attributes-as-API — the reflected props read/write as element properties
  - name: open
    description: Whether the drawer is shown (boolean). Setting it true calls the dialog's showModal() (top layer + ::backdrop + focus trap + Escape); false calls close(). Reflected + bindable (the two-way `open`, ADR-0019).
  - name: persistent
    description: Whether the drawer BLOCKS user dismissal (boolean, default false). When present/true the dialog's cancel event (Escape) is preventDefault-ed and a backdrop click is ignored — the agent owns the close (set open=false). Absent ⇒ the user can dismiss it (Escape + backdrop click). Modal's ADR-0020 shape verbatim.
  - name: edge
    description: Which viewport edge the drawer docks to — 'end' (default, logical inline-end) | 'start' (logical inline-start) | 'bottom' (physical). Inline edges are full viewport height at the inline-size token width; the bottom edge is content-height capped at the max-block-size token.

events:
  - name: close
    detail: 'null'
    description: Fired when the drawer is dismissed by the USER/platform (Escape, a backdrop click, or an external dialog close) — NOT when the agent programmatically sets open=false. The state is synced (open=false) before it fires.
  - name: toggle
    detail: 'null'
    description: Fired alongside `close` on a user/platform dismissal — the value:{event:'toggle'} two-way signal the renderer binds to write `open` back into the data model (ADR-0019). Emitted only on a user-driven state change, not a programmatic one.

slots: []                 # no NAMED slots — the drawer's children are MOVED into the dialog PART at connect and render inside it (the modal precedent); there is no host-as-grid slot grammar

parts:                    # the native <dialog> is a control-owned PART, not a user slot (ADR-0017 cl.1, re-applied ADR-0188)
  - name: dialog
    description: The control-created light-DOM `<dialog data-part="dialog">` the drawer renders into. Created ONCE (idempotent guard) and NEVER re-rendered (render() stays the inherited void). It carries the dialog role natively; aria-modal is set by showModal(); an author aria-label/aria-labelledby is forwarded onto it. The host carries no role/aria-* attribute. Docks to the viewport edge named by `edge`.

customStates: []          # none — the drawer uses no :state() custom states (the open/closed visibility is the native dialog's [open]/top-layer, not a custom state)

face:
  formAssociated: false   # NOT a FACE form control — a <dialog> submits nothing, carries no value, is not form-associated (the ADR-0014 widgets-not-elements reading, ADR-0017/ADR-0188)

aria:
  role: dialog            # the native <dialog> PART carries the dialog role implicitly; showModal() sets aria-modal — NOT set on the host (the host carries no role/aria-* attribute)
  roleSource: native <dialog> part
  labelSource: aria-label / aria-labelledby   # an author accessible name is FORWARDED off the host onto the dialog part (ADR-0017 cl.5); a labelling heading child is the common pattern
  modal: aria-modal is set by showModal() (the platform), never an author/host attribute

keyboard:
  - keys: Escape
    action: Dismisses the drawer when NOT `persistent` (the platform `cancel`/`close` events → open=false + close/toggle + focus restore). When `persistent` the cancel is preventDefault-ed and Escape does nothing.
  - keys: Tab / Shift+Tab
    action: Focus is TRAPPED within the dialog by the platform's showModal() (the drawer top layer is inert to the page behind it). Native Tab order — NO roving focus/type-ahead inside (an embedded ui-text-field types freely, the form-popover SPEC-R5 lesson). Focus is RESTORED to the opener on close (the one platform gap the control owns — ADR-0017 cl.4).

geometry:
  sizeClass: container   # container-class sizing via [data-box]; NO control height (--md-sys-height-* is never read)
  padding: var(--ui-drawer-padding)   # region padding via [data-box] (the region model, not a control dimension)
  radius: var(--ui-drawer-radius)     # = var(--md-sys-shape-corner-base), zeroed on the DOCKED edge only, the fleet base on the exposed corners
  surface: var(--ui-container-bg) + var(--ui-container-tint)   # the elevation×brightness surface seam (ADR-0015), inherited from the host onto the dialog part
  scrollbarSeam: --ui-drawer-scrollbar-width   # GH #913 — declared `thin` in the token block (the #874/#911 fleet idiom, modal.css precedent verbatim): transparent-at-rest, reveals --ui-drawer-scrollbar-thumb{,-hover} on hover or while the dialog part itself is :focus-within (focus is TRAPPED inside by showModal()); the scroll-fade edge affordance stays a complementary treatment; a consumer repoints to `none`/`auto`
  regionRhythm: --ui-drawer-pad-inline / --ui-drawer-pad-block / --ui-drawer-gap   # GH #918 — the drawer's OWN spacing rhythm, repointing the shared [data-box] region defaults (container-box.css's --ui-box-pad-inline/-pad-block/-gap) on the dialog part; a `<header>`/`[data-region='header']`, `[data-region='content']`/`main`, and `<footer>`/`[data-region='footer']` author region get it for free — no new slot grammar, structural light-DOM children (drawer.md's own example)
  regionBorder: --ui-drawer-region-border   # GH #918 — the header/footer hairline colour; SCROLL-CONDITIONAL — painted only while the dialog's own `data-fade-top`/`data-fade-bottom` (scrollFade, always wired) shows real content scrolled behind that region, never a static border on an unscrolled drawer

forcedColors: A `@media (forced-colors: active)` block keeps the dialog surface, frame, and ink visible as system colours (Canvas / CanvasText) and drops the tonal wash (a translucent overlay would defeat the forced Canvas base); the ::backdrop scrim is left to the scrim role / UA so the blocking layer still paints — the modal precedent verbatim (ADR-0017/ADR-0188).
---

# ui-drawer

`ui-drawer` is an **edge-docked modal container** built on the native `<dialog>` element opened with
`showModal()` (ADR-0188, re-applying the ADR-0017 `<dialog>` machinery `ui-modal` established rather than
nesting or extending it — `ui-modal`'s dialog machinery is `#`-private, the ADR-0125 re-derivation precedent).
It extends `UIContainerElement` (the surface base) and is **not** form-associated — a `<dialog>` submits
nothing and carries no value (ADR-0014 / ADR-0017). The platform supplies the four hard modal behaviours
**free**, in the top layer: top-layer **stacking**, a `::backdrop`, focus **containment**, and
**Escape-to-dismiss**. The control adds only the gaps the platform leaves — focus **restore** on close and the
`open`↔platform **sync** — plus the edge-docked geometry and slide motion.

```html
<ui-drawer open aria-label="Edit agents">
  <header><h2 style="margin:0">Manage agents</h2></header>
  <div data-region="content"><!-- a long, list-shaped roster --></div>
  <footer><ui-button variant="soft">Close</ui-button></footer>
</ui-drawer>

<ui-drawer edge="bottom" persistent><!-- a bottom sheet the agent owns the close of --></ui-drawer>
```

## Content layout (header / content / footer)

The dialog part is already a `[data-box]` (container-box.css, ADR-0046), so an author composing a
**`<header>`**/**`[data-region='header']`**, a **`[data-region='content']`**/`main`, and a
**`<footer>`**/**`[data-region='footer']`** as PLAIN structural children (no named slots, no shadow DOM — the
fleet's light-DOM-by-default law) gets the shared region model for free: `header`/`footer` are
**`position: sticky`** within the dialog's own scroll viewport (the dialog IS the single scrollport — its
`overflow: auto`, GH #913's thin-scrollbar idiom), so they stay pinned while the content between them scrolls.
The drawer repoints the region model's generic spacing to its **own** rhythm —
`--ui-drawer-pad-inline`/`--ui-drawer-pad-block` (header/footer/content padding) and `--ui-drawer-gap` (the gap
between a content region's own stacked children).

The header/footer hairline is **scroll-conditional**, not a static rule: it paints only once the dialog's own
`data-fade-top`/`data-fade-bottom` flags (`scrollFade`, wired unconditionally below) show that real content has
scrolled BEHIND that region — an unscrolled drawer renders a clean header/footer with no border at all. This
reuses the SAME flags the edge-fade affordance already maintains (pure CSS, no second scroll listener) —
`--ui-drawer-region-border` supplies the colour (defaults to the shared `--ui-drawer-outline` role).

## Boundary: the overlay/docking vocabulary is a four-cell map

**`ui-modal`** = centered modal `<dialog>` · **`ui-drawer`** = EDGE-DOCKED modal `<dialog>` · the
popover/menu/select/tooltip family = anchored NON-modal top-layer (ADR-0043) · a super-shell side/pane =
docked NON-overlay layout. `ui-drawer` is **always** top-layer + scrim + focus-contained — **a persistent,
non-scrimmed side panel is never a drawer**; that shape routes to the shell family (ADR-0188 cl.2).

## The dialog part

The drawer renders into a control-owned **`<dialog data-part="dialog">`** PART, created **once** (an
idempotent guard) and **never re-rendered** — `render()` stays the inherited VOID, exactly as `ui-modal`'s does
(ADR-0017 cl.1). The drawer's children are **moved into** the dialog at connect and render inside it; there
are no named slots. The host is `display: contents` — a logical wrapper that generates no box, so only the
dialog (in the top layer when shown) renders.

## Docking (`edge`)

`edge` (`'end' | 'start' | 'bottom'`, default `'end'`, reflected) selects which viewport edge the drawer docks
to. `'end'`/`'start'` are LOGICAL inline names (super-shell LLD-C4) — full viewport height at
`--ui-drawer-inline-size` (default `min(92vw, 26rem)`), docking via `inset-inline-*` so LTR/RTL both resolve to
the correct physical side with no `:dir()` selector needed. `'bottom'` stays **physical** — the block axis
never bidi-mirrors — content-height capped at `--ui-drawer-max-block-size` (default `85svh`). The radius zeroes
on the docked edge only; the exposed corners keep the fleet base radius. `'top'` is deliberately absent
(ADR-0188 cl.8 — additive enum growth later, no fork now).

## Open / close

`open` is a reflected boolean driven by a scope-owned effect: setting it **true** calls `dialog.showModal()`
(top layer + `::backdrop` + focus trap + Escape, all from the platform); **false** calls `dialog.close()`. When
the **user** dismisses the drawer (Escape, a backdrop click, or an external close), the dialog's `close` event
syncs `open = false` and emits the family **`close`** plus **`toggle`** — the two-way bind signal the renderer
writes back into the data model (`value: { prop: 'open', event: 'toggle' }`, ADR-0019). A close the agent drove
(the prop already went false) only restores focus — no redundant emit.

## Dismissal

`persistent` (default **off**, modal's ADR-0020 shape verbatim) gates user dismissal. By default the user can
dismiss a drawer with Escape or a backdrop click; set **`persistent`** and the dialog's `cancel` event
(Escape) is `preventDefault`-ed and a backdrop click is ignored — the agent owns the close (set `open = false`).
A backdrop click is detected rect-wise: a click whose target is the dialog box but lands **outside** its
content rect is the `::backdrop`.

## Focus

`showModal()` **traps** focus inside the dialog and moves initial focus in. The platform does **not** restore
focus to the invoking element on close, so the control records `document.activeElement` at open and
**restores** it on close (ADR-0017 cl.4). Focus order inside is **native Tab** — there is no roving focus or
type-ahead, so an embedded `ui-text-field` (an inline-rename affordance, for example) types freely (the
form-popover SPEC-R5 lesson).

## Accessibility

The `<dialog>` part carries the **dialog** role natively and `aria-modal` is set by `showModal()`. An author
accessible name (`aria-label` / `aria-labelledby`) is **forwarded** off the host onto the dialog part, so the
host stays free of `role`/`aria-*`; a labelling heading child is the common pattern.

## Surface

The dialog plane reads the **elevation × brightness** surface seam (`--ui-container-bg` / `--ui-container-tint`,
ADR-0015), defaulting to the neutral base. Container-class sizing (`[data-box]` region padding, no control
height). A forced-colors block keeps the surface, frame, and ink visible as system colours.

## Motion

An edge-keyed inset transition over the **existing** `--md-sys-motion-duration-fast` /
`--md-sys-motion-easing-standard` constants (zero new motion tokens): entry via `@starting-style`, exit via
`transition-behavior: allow-discrete` on `display`/`overlay` where supported (degrading to instant-hide —
progressive enhancement). `prefers-reduced-motion: reduce` suppresses the transition entirely.
