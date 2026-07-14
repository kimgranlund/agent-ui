---
# agent-admin.md frontmatter — the attributes-as-API descriptor for ui-agent-admin (ADR-0004; TKT-0039,
# ADR-0131/ADR-0132). The `attributes[]` block MUST mirror agent-admin.ts `agentAdminProps` — the
# contract↔props trip-wire (agent-admin.test.ts) targets this fence.
tag: ui-agent-admin
tier: layout            # geometry size-class (Container/layout band — a composition over ui-split/ui-settings/ui-conversation, the master-detail.md/settings.md precedent; no control height of its own)
extends: UIElement      # a plain structural base — composes ui-split/ui-settings/ui-conversation rather than extending any of them (ADR-0131)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), after this build

attributes:              # attributes-as-API — mirrors agent-admin.ts `agentAdminProps`
  - name: schema
    type: json            # a JS object (SettingsSchema, the "Agent" section only) — too structured to reflect (the ui-settings `schema` precedent)
    default: undefined    # undefined at the PROP level, matching ui-settings' own convention — lazily assigned the real defaultAgentConfigSchema (agent-admin-schema.ts) at first connect, never a throw pre-connect
    reflect: false
  - name: store
    type: json             # a JS object (SettingsStore: get/set/subscribe?/save?) — functions cannot round-trip through JSON.stringify, safe only because `attribute: false` means the codec never actually runs
    default: undefined     # undefined ⇒ lazily assigned a real, localStorage-backed store (persistKey 'ui-agent-admin') at first connect, seeded for BOTH the flat Agent config AND every entry-list kind (ADR-0131 cl.3 / ADR-0132's extension of it)
    reflect: false

properties:
  - name: schema
    description: The "Agent" section's flat `SettingsSchema` (name/model/temperature/toolsEnabled) rendered by the composed settings pane — instructions/capabilities are OUT of this schema entirely; they live in the generic entry-list primitive (entries.ts, ADR-0132). Undefined at author-set time lazily becomes `agent-admin-schema.ts`'s `defaultAgentConfigSchema` at first connect (a shared, read-only constant — safe across instances, unlike `store`). Reactive the same way `ui-settings`' own `schema` is.
  - name: store
    description: A `SettingsStore` adapter (store.ts) EVERY pane reads/writes through — the Agent config, all three built-in prompt sections, and all four capability kinds share ONE persisted store (ADR-0132 cl.5). Undefined at author-set time lazily becomes a real `createMemoryStore({ persistKey 'ui-agent-admin' })` at first connect (survives a reload). Every entry-list kind's own external-sync subscription is wired the same way `ui-settings`' generated fields wire theirs (TKT-0021 precedent), generalized to five keys (`#rewireAllSections`).

events: []               # no DOM events of its own — the composed ui-settings/ui-conversation each emit their OWN events (unchanged, not re-emitted); this element adds no new event vocabulary

slots: []                 # content model is NOT author-composed — the split/panes/composed children are built entirely by this element's own connect-time logic, the ui-settings/ui-conversation precedent

parts:                     # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: agent-heading
    description: The settings pane's `<h3 data-part="agent-heading">` ("Agent"), preceding the composed `ui-settings` instance.
  - name: entry-section
    description: One kind's whole section — `<div data-part="entry-section" data-kind="...">` — the ONE shape all five instantiations share (ADR-0132 `n1`). Carries a heading, the entry list, and the add-form.
  - name: entry-section-heading
    description: A section's `<h3 data-part="entry-section-heading">` (e.g. "Skills", "Instructions").
  - name: entry-list
    description: A section's `<div data-part="entry-list">` — the entries themselves, in order.
  - name: entry
    description: One entry row — `<div data-part="entry" data-entry-id="...">`, `[data-builtin]` present when non-deletable (ADR-0132 Fork 4).
  - name: entry-header
    description: An entry's label + toggle + (if not built-in) delete affordance row.
  - name: entry-label
    description: An entry's display name.
  - name: entry-toggle
    description: An entry's `<ui-switch data-part="entry-toggle">` — enable/disable without deleting (ADR-0132 Fork 4).
  - name: entry-delete
    description: An entry's remove affordance — present ONLY for a non-built-in (custom) entry.
  - name: entry-description
    description: An entry's optional one-line description, when non-empty.
  - name: entry-content
    description: An entry's `<ui-textarea data-part="entry-content">` — the fleet's FACE multi-line primitive (ADR-0134), closing the TKT-0041 native-`<textarea>` deviation this composition inherited from ADR-0132.
  - name: entry-add-toggle
    description: A section's "+ Add ..." button, revealing/hiding the add-form.
  - name: entry-add-form
    description: A section's custom-entry authoring form — hidden by default.
  - name: entry-add-label
    description: The add-form's required name field.
  - name: entry-add-description
    description: The add-form's optional description field.
  - name: entry-add-content
    description: The add-form's content field.
  - name: entry-add-submit
    description: The add-form's submit button.
  - name: entry-add-error
    description: The add-form's fail-closed validation message (ADR-0132 cl.4) — hidden until a rejected submission names why.

customStates: []          # no :state() hooks — no derived presentation state of this element's own (unlike ui-master-detail's data-view)

face:
  formAssociated: false    # NOT a FACE form control — a layout composition; the composed ui-settings' OWN generated fields are each their own FACE participant, unchanged

aria:
  role: none               # this element carries no ARIA of its own — the composed ui-split/ui-settings/ui-conversation/ui-switch/ui-textarea each carry their own, inherited unchanged; the remaining native form controls (input/button) here carry native semantics
  roleSource: none

keyboard: []                # no bespoke keyboard handling of this element's own — the composed ui-split's separators, ui-settings' rail, ui-conversation's composer, every ui-switch, and every ui-textarea each carry their OWN keyboard contract, inherited unchanged; the remaining native form controls are native (platform keyboard behavior)

geometry:
  sizeClass: layout          # Container/layout — NO control height
  blockSize: consumer-supplied   # fills its containing box — give it a definite block-size in the surrounding layout (the ui-conversation precedent; flex:1 1 auto on the host is the CONSUMER's job, the master-detail.md precedent)
  paddingBlock: 0             # no padding of its own — the composed split/panes own any inset (the prompts/settings panes' own 0.75rem pad is scoped to those panes, not the host)

forcedColors: Every bordered surface (entry rows, the add-form, buttons) uses a real 1px border — legible under forced-colors:active for free; the explicit focus rings fall back to `Highlight`. The composed ui-split/ui-settings/ui-conversation/ui-switch each carry their own forced-colors handling, inherited unchanged.
---

# ui-agent-admin

`ui-agent-admin` is the **Agent Admin UI** (`@agent-ui/app`, TKT-0039, ADR-0131/ADR-0132) — a
live-editable agent config + instructions with a working chat preview, composing the shipped `ui-split`
(M4), `ui-settings` (M4), and `ui-conversation` (M2) primitives, PLUS a generic ordered-entry-list
primitive (`entries.ts`/`entry-list.ts`, ADR-0132). No new primitive family beyond that one, no new
protocol dependency.

```html
<ui-agent-admin></ui-agent-admin>
```

A three-pane `ui-split` (ADR-0131 cl.2's ruled order): `[ chat canvas | prompts pane | settings pane ]`.

## One primitive, five instantiations (ADR-0132)

The prompts pane and four of the settings pane's sections are the SAME shape — a named, ordered,
toggleable entry in a typed list, with a shared custom-entry authoring form:

- **Prompts pane** — `kind: "prompt-section"`, seeded with three built-in sections (Foundation,
  Personality, Critical Items), each independently toggleable and editable. A composer concatenates the
  ENABLED sections, in order, into the one final system prompt.
- **Settings pane** — the unchanged "Agent" config (name/model/temperature/toolsEnabled, via the composed
  `ui-settings`) PLUS four capability kinds — Skills, Workflows, Resources, Tools — each an unseeded,
  purely custom-authorable instance of the same primitive.

No kind gets its own bespoke list/toggle/author code — a future kind is a seed-data change, not a code
change (ADR-0132 Fork 2).

## One shared store, five slices

Every pane reads/writes through the SAME `SettingsStore` instance — one persisted config, five slices of
it. Supply your own store (e.g. a remote-backed adapter) via the `store` property, or let the element
default to a real, `localStorage`-backed `createMemoryStore` (survives a reload, ADR-0131 cl.3, extended
to every entry-list kind by ADR-0132).

## Live-apply is a fresh read, not a push

Editing any setting, section, or capability commits to the shared store immediately. The chat canvas's
stub turn loop reads the store's CURRENT entries at the moment each turn begins — composing the enabled
prompt sections and gathering each capability kind's enabled labels — a store read trivially reflects
whatever was most recently written, so no separate propagation channel exists because none is needed.

## The chat canvas is a stub, not a live model call (ADR-0131)

`ui-agent-admin` has no external runtime dependency — the turn loop that answers each message
(`agent-admin-schema.ts`'s `runStubAgentTurn`) is a deterministic function that visibly cites the composed
prompt AND the enabled capabilities in its reply, proving the live-apply wiring works without a real model
integration. A real model call is a separate, future, explicitly-scoped addition.

## Fail-closed everywhere

An all-disabled/empty prompt-section set falls back to `DEFAULT_SYSTEM_PROMPT_FALLBACK` (`entries.ts`) —
never an empty instruction reaching the stub reply. A custom entry with no name is rejected
(`validateNewEntry`) — never silently admitted. A built-in entry can be toggled off but never deleted
(ADR-0132 Fork 4). Every "Agent" field's validity is the composed `ui-settings`' own responsibility
(SPEC-R11), unchanged.
