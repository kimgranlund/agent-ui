# SPEC — `ui-toolbar`

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: TKT-0009 (`../tickets/tkt-0009-ui-toolbar.md`) under the ratified scope + contract directions of
> [ADR-0121](../adr/0121-ui-toolbar-pattern-control.md) (proposed; forks F1–F7 as recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern**, the same basis the
> `ui-theme-provider` SPEC recorded: this is a single scoped control whose problem statement and acceptance
> already live in TKT-0009 (a TICKET, carrying Summary/Acceptance/Links per its own type contract). Authoring
> a PRD here would restate that substrate under different frontmatter — the "restated substrate" failure
> `doc-authoring-standards` names. Known, deliberate gap: the SPEC↔PRD uplink harness check fails on this file
> by construction; recorded as a reviewed deviation, not a silent miss.
> Refined by: [`../lld/toolbar.lld.md`](../lld/toolbar.lld.md). Build plan:
> [`../decompositions/toolbar-ship.decomp.json`](../decompositions/toolbar-ship.decomp.json) (coverage-clean,
> plan mode).
> Altitude: owns **what the shipped element does and how it behaves at every boundary** (the prop contract,
> the roving-focus semantics, the posture-as-surface behavior, the catalog disposition, the site surfaces).
> Implementation (CSS mechanics, the exact focusable-item selector, page content) is the LLD's. Requirement
> IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the control ADR-0121 ratifies: `ui-toolbar`, a **Pattern**-class `UIContainerElement` that arranges
the consumer's own interactive controls into an action bar, gives them `role="toolbar"` + arrow-key roving
focus, and expresses the floating-vs-embedded posture through the existing `elevation`/`brightness` surface
axis (never a positioning machine, never the overlay family). It emits no events and owns no value — it is
arrangement + focus semantics, not a command bus.

## 2. Definitions

- **Item** — a focusable interactive descendant of the toolbar that participates in roving focus: a
  button-like control (`ui-button`, native `button`, `a[href]`, `[role="button"]`) or any element carrying an
  explicit `data-toolbar-item`, in DOM order, not `disabled`/`aria-disabled`. Item discovery is a **descendant**
  query, so items nested inside a `ui-row` grouping cluster still participate. The exact selector is the LLD's;
  the *contract* (which elements are items) is normative here.
- **Posture** — the visual mode a toolbar reads in: **floating** (a raised, shadowed plane, reached by
  `elevation ≥ 1`, positioned by its consumer) or **embedded** (flush/transparent, `elevation = 0`, a light-DOM
  child of a header/container). Posture is *entirely* a function of the surface axis + the consumer's placement;
  there is no `posture` prop.
- **Roving tabindex** — exactly one item carries `tabindex=0`; every other item `tabindex=-1`. The toolbar is
  therefore a single `Tab` stop; arrow keys move focus among items *within* it.
- **Ambient axis** — `scale`/`density`, inherited from an ancestor attribute or `ui-theme-provider`, never a
  toolbar prop. `[scale]` selects the size register; `[density]` multiplies the gap (rhythm) only.

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 Component contract

**SPEC-R1 — Base class, tag, tier.** The component MUST be `ui-toolbar`, a class `UIToolbarElement` extending
`UIContainerElement`, self-defining on import (`customElements.define`, idempotent guard), living at
`packages/agent-ui/components/src/controls/toolbar/`. It MUST classify `tier: pattern`
(`geometry.md`'s named Pattern-class example). *(ADR-0121 F1/F5)*
- **AC1** *Given* the module is imported, *then* `customElements.get('ui-toolbar')` resolves to a constructor
  that is a subclass of `UIContainerElement`, and the descriptor resolves `tier: pattern` (the tier leg,
  cross-verified by SPEC-R7 AC1 / SPEC-R10 AC1).
- **AC2** *Given* an instance, *then* it is NOT `instanceof UIFormElement` and carries no `formAssociated`
  behavior (`face.formAssociated: false`).

**SPEC-R2 — Props schema.** The component MUST declare exactly these reflected, attribute-synced props, each
`values[0]`-default-first where enumerated: `elevation`/`brightness` (the ADR-0015 `surfaceProps` spread,
enum `[0,1,2,3,-1,-2,-3]`, default `0`); `orientation: enum(['horizontal','vertical'], 'horizontal')`;
`align: enum(['start','center','end','stretch','baseline'], 'center')`;
`justify: enum(['start','center','end','between','around','evenly'], 'start')`;
`gap: enum(['none','xs','sm','md','lg','xl','2xl'], 'sm')`;
`overflow: enum(['wrap','scroll'], 'wrap')`; `label: string('')`. It MUST NOT declare a `size`, `density`,
`wrap`, `reflow`, or `posture` prop. *(ADR-0121 F1/F4/F5)*
- **AC1** *Given* a fresh instance, *then* every prop reads its default (`elevation`/`brightness`=`0`,
  `orientation`=`horizontal`, `align`=`center`, `justify`=`start`, `gap`=`sm`, `overflow`=`wrap`, `label`=`''`).
- **AC2** *Given* `el.orientation = 'vertical'`, *then* `el.getAttribute('orientation') === 'vertical'`, and
  the reverse (`setAttribute` → property) holds; same for every enumerated prop.
- **AC3** *Given* an out-of-vocabulary value set via `setAttribute` on any enum prop, *then* the property
  resolves to that prop's `values[0]` (fail-open to the default, never a crash).

**SPEC-R3 — `role="toolbar"` + the accessible name.** The component MUST set `role="toolbar"` via
`ElementInternals` (never a host `role` attribute), MUST set `internals.ariaOrientation="vertical"` when and
only when `orientation="vertical"` (horizontal is the toolbar default and is left unannounced), and MUST write
a non-empty `label` to `internals.ariaLabel` (clearing it when `label` is `''`). No `aria-*` fact may be
carried on a host attribute. *(ADR-0121 F3)*
- **AC1** *Given* an instance, *then* `el.internals.role === 'toolbar'` (read via internals; the host carries
  no `role` attribute) and no `aria-label`/`role`/`aria-orientation` attribute exists on the host element.
- **AC2** *Given* `orientation="vertical"`, *then* `internals.ariaOrientation === 'vertical'`; *given*
  `orientation="horizontal"`, *then* `internals.ariaOrientation` is null/empty.
- **AC3** *Given* `label="Text formatting"`, *then* `internals.ariaLabel === 'Text formatting'`; *given*
  `label` cleared to `''`, *then* `internals.ariaLabel` is null/empty.

**SPEC-R4 — Roving focus, decoupled from selection.** The component MUST wire the `roving-focus` trait
(`traits/roving-focus.ts`) over its items with: `orientation` mirroring the `orientation` prop, `loop: false`,
`typeAhead: false`, and `onMove` used for focus movement **only** — no selection state, no `select` event, no
`syncIndex` selection coupling. Exactly one item MUST carry `tabindex=0` and the rest `tabindex=-1` (one Tab
stop). Arrow keys along the orientation MUST move focus to the next/previous non-disabled item and STOP at the
ends (no wrap); Home/End MUST move to the first/last non-disabled item. Item discovery MUST be a live
descendant query in DOM order, tolerant of `ui-row` grouping nesting, excluding disabled items. The listeners
MUST install in `connected()` (riding the connection `AbortSignal`, zero residue, re-armed on reconnect).
*(ADR-0121 F3; TKT-0009 — reuse, don't reinvent)*
- **AC1** *Given* a toolbar with three enabled `ui-button` items, *then* exactly one has `tabindex=0` and the
  other two `tabindex=-1`; `Tab` from before the toolbar lands on the roving item and the next `Tab` leaves
  the toolbar entirely (one stop).
- **AC2** *Given* `orientation="horizontal"` and focus on item 0, *then* ArrowRight moves focus to item 1,
  ArrowLeft from item 0 does NOT wrap to the last (stops), and Home/End jump to first/last. *Given*
  `orientation="vertical"`, the same holds for ArrowDown/ArrowUp.
- **AC3** *Given* a disabled middle item, *then* ArrowRight skips it; *given* items grouped inside a `ui-row`
  child, *then* they still participate in the roving set (descendant discovery).
- **AC4** *Given* the toolbar is disconnected then reconnected, *then* roving focus is re-armed and no
  duplicate listeners fire; *given* a key event, *then* no `select`/`change`/`input` event is ever emitted
  (the negative control — a toolbar commits nothing).

**SPEC-R5 — No events, no value.** The component MUST emit no events of any kind and MUST NOT be
form-associated. *(ADR-0121 F6; TKT-0009 non-goal)*
- **AC1** *Given* any interaction (click, keyboard, prop change), *then* the toolbar dispatches no
  `change`/`input`/`select`/`open`/`close`/`toggle` (or any) event from the host (its item children emit their
  own events unchanged — those are not the toolbar's).

### 3.2 Layout, geometry & posture

**SPEC-R6 — Host-as-flex arrangement.** The component MUST lay out as a flex row/column (per `orientation`)
whose light-DOM children ARE the flex items; it MUST declare NO named slots. `align`→`align-items`,
`justify`→`justify-content` (with `between`/`around`/`evenly`→`space-*`), and `gap`→`gap: var(--ui-space-…)`
riding `[density]`. `overflow="wrap"`→`flex-wrap: wrap`; `overflow="scroll"`→a single line with
`overflow-inline: auto` (a scroll region the toolbar owns). *(ADR-0121 F2/F4/F5)*
- **AC1** *Given* `slots[]` in the descriptor, *then* it is empty; *given* the CSS, *then* it contains no
  `[slot=…]` selector (host-as-flex, the `ui-row` precedent).
- **AC2** *Given* `justify="between"`, *then* the computed `justify-content` is `space-between`; *given*
  `overflow="wrap"`, *then* `flex-wrap` is `wrap`; *given* `overflow="scroll"`, *then* `flex-wrap` is `nowrap`
  and the inline axis is a scroll container.

**SPEC-R7 — Pattern-class geometry.** The component MUST NOT own a control-height `size` prop; item height
comes from the items' own sizing. The toolbar's own geometry MUST be: padding + `gap` off the `--ui-space`
ladder, and a **min-block-size floor** tied to the control-height register (so an empty or short bar still
reads as a bar — the whole-shape law). `[scale]`/`[density]` MUST ride ambiently (inherited), never as toolbar
props. *(ADR-0121 F5; `geometry.md` Pattern class)*
- **AC1** *Given* `geometry.sizeClass`, *then* it is `pattern`; *given* the descriptor, *then* it declares no
  `size` attribute.
- **AC2** *Given* a bare toolbar with one small `ui-button`, *then* its rendered block-size is ≥ the
  min-block-size floor (the bar does not collapse to the button's height minus padding).
- **AC3** *Given* an ancestor `[density="spacious"]`, *then* the toolbar's `gap` widens relative to
  `[density="compact"]` (rhythm rides density); *given* `[scale]` changes, *then* the space/height register
  changes accordingly — with no toolbar prop involved.

**SPEC-R8 — Posture via the surface axis + z-scope (not a positioning machine).** The floating posture MUST be
reachable purely by `elevation ≥ 1` (a raised, shadowed plane via the ADR-0015 seam) with the toolbar
establishing a `[data-box]` isolation z-scope (ADR-0052) when it carries a raised plane; the embedded posture
is `elevation = 0` (transparent/flush). The component MUST NOT own `position`, anchoring, edge-placement, or
any overlay/dismissal behavior — placement and width are the layout's/consumer's job (the `min-inline-size`
precedent). *(ADR-0121 F1)*
- **AC1** *Given* `elevation="2"`, *then* the toolbar paints a raised surface (`--ui-container-bg` repointed
  per ADR-0015) and establishes an isolation scope; *given* `elevation="0"`, *then* it is transparent/flush
  with no surface plane.
- **AC2** *Given* a grep of `toolbar.ts`, *then* there is no `position`/anchor/`showPopover`/`ResizeObserver`
  machinery and no import of the overlay/dismissal traits — posture is surface-only.

**SPEC-R9 — Token surface & forced-colors.** The component MUST ship a single fleet-scoped stylesheet that
declares its `--ui-toolbar-*` roles (padding, gap, min-block-size, and the surface consumption via the shared
container seam) and carries a `@media (forced-colors: active)` block keeping the bar's boundary/surface legible
(the `ui-tabs` precedent). *(ADR-0121; `geometry.md`; family-coherence)*
- **AC1** *Given* `family-coherence.test.ts`, *then* the toolbar's token roles and CSS scope pass the fleet
  invariants (single `{name}.css`, `--ui-toolbar-*` chain present, forced-colors block present).
- *Note (non-normative):* a v1 toolbar paints no intent surface of its own; should a future version add one,
  the ADR-0057 non-color-signifier rule applies then. Kept out of the normative set here to avoid a vacuous MUST.

**SPEC-R10 — Descriptor.** The descriptor (`toolbar.md`) MUST declare `tag: ui-toolbar`, `tier: pattern`,
`extends: UIContainerElement`, `geometry.sizeClass: pattern`, `face.formAssociated: false`, `role: toolbar`
(via internals), `events: []`, `slots: []`, an `attributes[]` fence mirroring `static props` 1:1, and the
`keyboard` map (Arrow along orientation, Home/End, roving tabindex, no wrap, no type-ahead). *(ADR-0121)*
- **AC1** *Given* the descriptor↔props trip-wire test, *then* it passes with zero drift.
- **AC2** *Given* `compareDescriptorToSource`, *then* every CSS-styled slot/role and used custom-state is
  documented (there are no named slots; any `:state()` used is declared).

### 3.3 Catalog disposition

**SPEC-R11 — A2UI-emittable `Toolbar` catalog row.** `Toolbar` (the descriptor-derived PascalCase type) MUST
gain a default-catalog row (NOT an `EXCLUSION_ALLOWLIST` entry), mapping its attributes
(`orientation`/`align`/`justify`/`gap`/`overflow`/`elevation`/`brightness`/`label`) and a `children` list of
item components, the way `Row` is catalogued. The `document-row-toolbar` corpus seed (in
`catalog-coverage.ts`) MUST be upgraded to compose the real `Toolbar` type in place of its hand-composed `Row`
action cluster (the `doc_actions` child on the post-ADR-0112 seed). *(ADR-0121 F7; ADR-0087 gate)* **This is an a2ui-package build slice
(`a2ui-builder` seat); the SPEC fixes the disposition, the LLD carries it as a build deliverable.**
- **AC1** *Given* `toolbar.md` ships, *then* `Toolbar` enters `FLEET_TYPES` (ADR-0087) and the catalog
  coverage gate stays green because a real `Toolbar` catalog row exists (not an allowlist entry).
- **AC2** *Given* the upgraded corpus seed, *then* `document-row-toolbar` renders through the real `Toolbar`
  node and passes the a2ui validation + judge gates (the seed's action cluster is a single `Toolbar`, its
  buttons its item children).

### 3.4 Site surfaces

**SPEC-R12 — Required site pages, both postures.** The `tier: pattern` classification REQUIRES a `{doc, demo}`
page pair under `site-coverage.test.ts` (the `ui-tabs` parity set). `toolbar-doc.ts` MUST be the
descriptor-derived API page; `toolbar-demo.ts` MUST show **both postures** — an embedded header/action bar
AND a floating raised bar (`elevation ≥ 1`) — plus the roving-focus behavior. A representative
`<component-gallery>`/preview specimen MUST show the toolbar's real job (a populated action bar with realistic
buttons and quantity, not one lorem child). *(ADR-0121; TKT-0009 "the demo showing BOTH postures"; the
whole-shape + representative-specimen laws)*
- **AC1** *Given* `site-coverage.test.ts`, *then* the required-page-set check for `ui-toolbar` passes.
- **AC2** *Given* the demo page, *then* it renders at least one embedded and one floating (`elevation ≥ 1`)
  toolbar, each populated with multiple real controls.

## 4. Non-goals (explicit fences)

- **`ui-toolbar-group`** (a `role="group"` cluster sub-tag) — a fenced, purely additive v2 extension; v1
  groups visually with `ui-row` children or gap. *(ADR-0121 F2)*
- **The overflow-*menu* (spillover)** — v1 overflow is CSS-only `wrap`/`scroll`; the `menu` member is an
  additive v2 built on the real `ui-menu`, default-preserving. *(ADR-0121 F4)*
- **A `ui-divider` vertical separator** — an unbuilt Display-class primitive; v1 uses gap. The toolbar hosts a
  real `ui-divider` once it ships, additively, with no toolbar change.
- **Anchor/edge positioning, autohide/collapse, dismissal** — placement is the layout's job; the toolbar owns
  no `position` and no overlay machinery. *(ADR-0121 F1)*
- **Arrow-consuming child sub-widgets in the roving set** (a `ui-slider`, a text editor) — v1 roving targets
  button-like items only; such children are a named follow-up.
- **Command/state management** — the toolbar is not a command bus; items are the consumer's own controls
  emitting their own events. *(TKT-0009 non-goal)*

## 5. Examples

Illustrative specimens (normative for shape, not exhaustive) — the end-state a consumer or an agent-emitted
payload should reproduce.

**Embedded posture — a document-header action bar (`elevation=0`, flush).** Roving lands on one item;
`Tab` enters/leaves the whole bar as one stop.

```html
<ui-toolbar label="Document actions" justify="between">
  <ui-row gap="xs">
    <ui-button variant="ghost" aria-label="Bold"><svg slot="leading" data-role="icon">…</svg></ui-button>
    <ui-button variant="ghost" aria-label="Italic"><svg slot="leading" data-role="icon">…</svg></ui-button>
    <ui-button variant="ghost" aria-label="Underline"><svg slot="leading" data-role="icon">…</svg></ui-button>
  </ui-row>
  <ui-button variant="ghost">Share</ui-button>
</ui-toolbar>
<!-- host: internals.role=toolbar, internals.ariaLabel="Document actions", NO role/aria-* host attribute.
     Exactly one focusable item has tabindex=0; the rest tabindex=-1 (grouped items in the ui-row still rove).
     ArrowRight/Left move focus among all four buttons and STOP at the ends; Home/End jump to first/last. -->
```

**Floating posture — a raised formatting palette (`elevation=2`).** Same element; the only difference is the
surface plane + the consumer positioning it. No `posture` prop, no dismissal, no anchor machinery.

```html
<!-- the consumer/layout owns position (e.g. position:absolute over a selection); the toolbar owns only its
     raised surface + min-block-size floor -->
<ui-toolbar label="Format selection" elevation="2" gap="sm">
  <ui-button variant="ghost" aria-label="Bold">…</ui-button>
  <ui-button variant="ghost" aria-label="Link">…</ui-button>
  <ui-button variant="ghost" aria-label="Comment">…</ui-button>
</ui-toolbar>
```

**Vertical orientation.** `orientation="vertical"` sets `flex-direction: column`,
`internals.ariaOrientation="vertical"`, and ArrowUp/Down (not Left/Right) roving; pair with `overflow="scroll"`
rather than `wrap`.

## 6. Trace

| Requirement | ADR-0121 fork | Decomp node(s) |
|---|---|---|
| SPEC-R1 | F1/F5 | n3 |
| SPEC-R2 | F1/F4/F5 | n5, n6, n7, n8 |
| SPEC-R3 | F3 | n9 |
| SPEC-R4 | F3 | n10 |
| SPEC-R5 | F6 | n11 |
| SPEC-R6 | F2/F4/F5 | n12 |
| SPEC-R7 | F5 | n13 |
| SPEC-R8 | F1 | n14 |
| SPEC-R9 | — | n15 |
| SPEC-R10 | — | n16, n17 |
| SPEC-R11 | F7 | n19, n20 |
| SPEC-R12 | — | n22, n23 |
