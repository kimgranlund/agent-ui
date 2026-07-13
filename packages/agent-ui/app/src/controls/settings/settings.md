---
# settings.md frontmatter — the attributes-as-API descriptor for ui-settings (ADR-0004;
# app-surfaces-m4.lld.md LLD-C12). The `attributes[]` block MUST mirror settings.ts `settingsProps` — the
# contract↔props trip-wire (settings.test.ts) targets this fence.
tag: ui-settings
tier: layout            # geometry size-class (Container/layout band — a composition over ui-master-detail, the master-detail.md precedent; no control height of its own)
extends: UIElement      # a plain structural base — composes ui-master-detail rather than extending it (LLD-C12, LLD F8)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9/C16)

attributes:              # attributes-as-API — mirrors settings.ts `settingsProps`
  - name: schema
    type: json            # a JS object (SettingsSchema), not an attribute — too structured to reflect (the ui-split `sizes` precedent)
    default: undefined    # undefined ⇒ no schema yet: the rail/panel render empty, never throw (SPEC-R10)
    reflect: false         # NEVER reflected — `attribute: false` in source, a JS property only
  - name: store
    type: json             # a JS object (SettingsStore: get/set/subscribe?/save?) — functions cannot round-trip through JSON.stringify, safe only because `attribute: false` means the codec never actually runs
    default: undefined     # undefined ⇒ no store: fields render from `field.default`, never throw (SPEC-R12 AC2)
    reflect: false
  - name: section
    type: string
    default: ''
    reflect: true          # reflects so a JS-set value applies identically to an author-set attribute (the ui-master-detail `selected` precedent); '' ⇒ no section resolved yet

properties:
  - name: schema
    description: The typed, versioned `SettingsSchema` (`{ version: 1, sections: [...] }`, schema.ts) driving the generated panels. Reactive — a reassignment (e.g. an async-loaded schema landing after mount) rebuilds the rail + every section's form from scratch; a bare reconnect with the SAME schema object skips the rebuild (preserving live field values) but still re-arms every per-connection reactive seam a disconnect tore down — the rail's `select` listener AND every generated field's validation, re-shows the current section. Absent ⇒ an empty rail/panel, never a throw.
  - name: store
    description: An optional `SettingsStore` adapter (store.ts — `get`/`set`/optional `subscribe`/`save`) the surface reads initial values from and writes changes back to, per-field-on-change. A supplied `subscribe` is WIRED (TKT-0021) — an external `set(key, value)` (another tab, a remote push) reflects into the matching field's control, with no echo back into `store.set` (an Object.is cutoff against the control's own current value). Reactive the same way as `schema` (a reassignment rebuilds; a reconnect with the same object skips the rebuild but still re-arms per-connection wiring, subscribe included). Absent ⇒ every field renders from its own schema `default` and changes are never persisted (SPEC-R12 AC2).
  - name: section
    description: The active section id. A reactive effect derives which generated panel shows + the rail's active marker from it, and emits `select`/`change` on every change AFTER the first (the initial/resolved-default state at connect does not fire — the `ui-master-detail` `selected` precedent).

events:
  - name: select
    detail: 'string'
    description: Fired after `section` changes to a new value (post-connect only — the initial/resolved-default state at connect does not fire). Detail is the new `section` id.
  - name: change
    detail: 'string'
    description: Fired alongside `select`, same timing, same detail (the `ui-master-detail` select/change-pair convention).

slots: []                 # no authored children at all — the rail + every section's form are GENERATED from `schema` (unlike ui-master-detail, which docks AUTHORED panes)

parts:                     # NOT shadow-DOM ::part() (light-DOM only) — documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: panel
    description: A control-rendered `<div data-part="panel">` — the mount point the active section's generated `ui-form-provider` is attached into (detached, never destroyed, when the section changes).

customStates: []          # no :state() hooks — the active rail item rides the composed ui-nav-rail-item's own `selected` reflected attribute, not a custom state of ui-settings' own (the ui-master-detail `data-view` precedent)

face:
  formAssociated: false    # NOT a FACE form control — a layout composition; the GENERATED per-field controls are each their own FACE participant

aria:
  role: none               # this element carries no ARIA of its own — the rail is a composed ui-nav-rail collapse="drill-in" (its own role/AX contract, ADR-0130), and every generated field rides its own control's ARIA (inherited, unchanged)
  roleSource: none

keyboard: []                # no bespoke keyboard handling of this element's own — the composed ui-nav-rail-item's activator is a real <a>/<button> (Enter/Space activate natively); the composed ui-master-detail's own drill-in/back-affordance keyboard contract is inherited unchanged; each generated field's keyboard contract is its own control's

geometry:
  sizeClass: layout          # Container/layout — NO control height
  blockSize: auto             # fills its flex parent (flex:1 1 auto on the host is the CONSUMER's job — the master-detail.md precedent)
  paddingBlock: 0             # no padding of its own — the rail/panel own their own inset
  narrowThreshold: inherited  # the drill-in threshold is entirely the composed ui-master-detail's own (40rem) — this element declares none of its own

forcedColors: The active rail item's marker is entirely the composed ui-nav-rail-item's own (SPEC-R4, nav-rail.css) — a real `border-inline-start` that survives forced-colors, inherited unchanged; ui-settings contributes no forced-colors rule of its own.
---

# ui-settings

`ui-settings` is the **app-tier settings surface** (`@agent-ui/app`) — a sections rail + per-section panel,
composing the shipped `ui-master-detail` for the rail|panel drill-in, with every panel **generated from a
typed schema** over the fleet's own form spine (`ui-form-provider`/`ui-field`).

```html
<ui-settings id="app-settings"></ui-settings>
<script type="module">
  import { createMemoryStore } from '@agent-ui/app/settings-memory-store'

  const el = document.getElementById('app-settings')
  el.schema = {
    version: 1,
    sections: [
      {
        id: 'general', label: 'General', fields: [
          { key: 'displayName', type: 'text', label: 'Display name', default: '' },
          { key: 'darkMode', type: 'boolean', label: 'Dark mode', default: false },
        ],
      },
    ],
  }
  el.store = createMemoryStore({ persistKey: 'demo-settings' })
</script>
```

## Composition — a generated tree over `ui-master-detail`

Unlike `ui-master-detail` (which docks *authored* panes), `ui-settings` takes **no light-DOM children at
all**: at connect it composes one `ui-master-detail` (a rail `ui-master-detail-pane` + a panel
`ui-master-detail-pane`) whose rail is a composed `ui-nav-rail collapse="drill-in"` (ADR-0130, nav-rail
Phase 2 — the shared sections-rail primitive), and **generates** the rail's `ui-nav-rail-item`s + every
section's form from `schema` (`schema.ts`/`generate.ts`) — the rail|panel drill-in behaviour and the
composed `ui-master-detail`'s own keyboard contract are inherited unchanged. `schema`/`store` are reactive:
setting them after mount (an async-loaded schema, a swapped store) rebuilds the rail + every section's form;
a relocation reconnect with the SAME schema/store objects never rebuilds (live field VALUES survive an
isolated-shell relocation untouched) but still re-arms every per-connection reactive seam a disconnect tore
down — the rail's `select` listener AND every generated field's validation, and re-shows the current
section.

## Schema-driven fields

Each `SettingsField.type` maps to a fleet control: `text`/`number`/`date` → `ui-text-field` (+ its own
`type`), `boolean` → `ui-switch`, `select` → `ui-select`, `slider` → `ui-slider`. Every field renders inside
a `ui-field` (label/description from the schema) inside one `ui-form-provider` per section — validation
(`Field.validation`) wires onto the generated control's **own** validity, so errors render through its
existing `user-invalid` timing, never a second observation path (ADR-0051).

## Persistence — the `SettingsStore` seam

`store` is optional (`store.ts`'s `SettingsStore` interface: `get`/`set`/optional `subscribe`/`save`). A
field reads `store.get(key) ?? field.default` at generation time and commits `store.set(key, value)` on the
mapped control's OWN documented commit event (per-field-on-change, immediately per field, never batched) —
`change` for every v1 type except `select`, which commits on its own `select` event (`ui-select` never
emits `change` — a per-type table, not a universal `change` listener, TKT-0021). No store supplied ⇒ every
field still renders from its schema `default`, and changes are simply not persisted. `memory-store.ts`
ships a reference adapter for demos/tests — `ui-settings` itself never imports a concrete store, only the
interface.

**External sync (TKT-0021 — realizes the M4 LLD §8 Fork F7 optional-`subscribe` arm).** A supplied
`store.subscribe` is wired: an external `store.set(key, value)` — another tab, a remote push — reflects
into the matching field's control via the registry's `setValue`. No echo loop: the suppression is the
kernel's Object.is precedent (reactive/index.ts), not a flag — a notification whose value already equals
the control's own `getValue()` is a silent no-op, which is also how the store's own re-notification of a
commit the field just made resolves to nothing. The two `ui-text-field` codec types (`number`/`date`)
reflect the raw value visibly, but their internal display↔canonical codec only resyncs on a real blur — a
pre-existing `ui-text-field` limitation (schema.test.ts documents it), not something this seam changes. A
store without `subscribe` behaves byte-identically to before (no external-change reactivity, as already
documented above). The subscription is re-armed across a relocation reconnect the same way validation is.

## Accessibility

The rail is a composed `ui-nav-rail collapse="drill-in"` (`aria-label="Settings sections"`) of
`ui-nav-rail-item`s; every item is empty-`href` ⇒ button-shaped, so its activator carries `role="tab"` +
`aria-selected` (an in-page selection commit — the deliberate ADR-0130 cl.4 correction away from the older
`aria-current="page"` page-nav verb this surface used before the migration). `role: none` on `ui-settings`
itself is unchanged — it carries no ARIA of its own. The composed `ui-master-detail`'s drill-in +
its "back" affordance keep their own contract unchanged. Every generated field's ARIA rides its own
control — this element adds none of its own.
