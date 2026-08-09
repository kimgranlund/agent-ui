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
  - name: agentTurn
    type: json             # a function (AdminAgentTurn: (req) => Promise<string>) — too structured to reflect, and functions cannot round-trip through JSON.stringify, safe only because `attribute: false` means the codec never actually runs (the store precedent)
    default: undefined     # undefined ⇒ the deterministic stub arm runs (ADR-0131); the DEV-only site page assigns a real live runner ONLY under import.meta.env.DEV (TKT-0052/ADR-0136), so the static build carries no live-call code
    reflect: false
  - name: agentSurfaceTurn
    type: json             # a function (AdminAgentSurfaceTurn: (req) => AsyncIterable<event>) — the agentTurn discipline verbatim (attribute:false, the codec never runs)
    default: undefined     # undefined ⇒ the prose arms run unchanged; SET (DEV-only, TKT-0076/ADR-0138) it takes PRECEDENCE — turns stream validated A2UI wire lines into ingestLine (REAL inline surfaces, ADR-0129) and surface action clicks run the next turn via onClientMessage
    reflect: false
  - name: libraries
    type: json             # a JS object (Record<kind, EntryLibraryPack[]>, entries.ts; GH #47/#48) — too structured to reflect (the schema/store precedent; attribute:false, the codec never runs)
    default: undefined     # undefined/empty ⇒ no add-from-library affordance renders anywhere (byte-identical sections); the section SHELL is still compose-time-once, but the MENU inside it is reactive (GH #143) — a post-connect reassignment (new object reference) rebuilds it per kind
    reflect: false
  - name: authoringStore
    type: json             # a second SettingsStore — the `store` shape verbatim (attribute:false, the codec never runs)
    default: undefined     # undefined ⇒ the guided-authoring flow is INACTIVE and this element is byte-identically what it was before the prop existed; SET (ADR-0178 cl.5) ⇒ the flow arms — a second conversation mounts, its turns compose from THIS store, and a patch they declare applies to `store` (the draft)
    reflect: false

properties:
  - name: schema
    description: The "Agent" section's flat `SettingsSchema` (name/temperature/toolsEnabled — the MODEL moved to the element's own Model grid, 2026-07-19 rev.2; the "Additional models" customModels add-field is REMOVED, GH #137/Kim's option A, 2026-07-20) rendered by the composed settings pane — instructions/capabilities are OUT of this schema entirely; they live in the generic entry-list primitive (entries.ts, ADR-0132). Undefined at author-set time lazily becomes `agent-admin-schema.ts`'s `defaultAgentConfigSchema` at first connect (a shared, read-only constant — safe across instances, unlike `store`). Reactive the same way `ui-settings`' own `schema` is.
  - name: store
    description: A `SettingsStore` adapter (store.ts) EVERY pane reads/writes through — the Agent config, all three built-in prompt sections, and all four capability kinds share ONE persisted store (ADR-0132 cl.5). Undefined at author-set time lazily becomes a real `createMemoryStore({ persistKey 'ui-agent-admin' })` at first connect (survives a reload). Every entry-list kind's own external-sync subscription is wired the same way `ui-settings`' generated fields wire theirs (TKT-0021 precedent), generalized to five keys (`#rewireAllSections`).
  - name: agentTurn
    description: An OPTIONAL injectable live-turn runner (`AdminAgentTurn` — `(req) => Promise<string>`, agent-admin-schema.ts) that, when set, replaces the deterministic stub with a real live model turn (TKT-0052/ADR-0136). Default `undefined` ⇒ the stub arm runs and the packaged component carries NO fetch/env/proxy code — the static docs build's "no external runtime dependency" guarantee (ADR-0131 cl.4/7) holds unchanged. The docs site page assigns a real runner ONLY under `import.meta.env.DEV` through the reused `dev-proxy-plugin.ts` trust boundary (ADR-0073), so a live call happens only in a local `vite dev` session with a configured provider key; a thrown/rejected runner degrades visibly via the conversation's `fail()` path, never a crash.
  - name: agentSurfaceTurn
    description: An OPTIONAL injectable SURFACE-turn runner (`AdminAgentSurfaceTurn` — `(req) => AsyncIterable<{kind:'line'}|{kind:'note'}>`, agent-admin-schema.ts; TKT-0076/ADR-0138). When set it takes precedence over `agentTurn` — each turn streams the a2ui producer's VALIDATED wire lines into `AgentTurnHandle.ingestLine` (real inline `ui-surface-host`s per surfaceId, ADR-0129) with the peeled ADR-0088 note rendered at finalize, and `onClientMessage` runs the next turn from a surface action click (the playable-game loop). The composed persona rides the producer's ADR-0138 persona seam. Same DEV-only injection + SPEC-N1 fence as `agentTurn`: the runner owns everything transport-shaped (the a2ui Session, the meta-line peel, provider pairing); the component never imports the fenced machinery.
  - name: libraries
    description: OPTIONAL entry-library packs keyed by entry kind (`Record<string, EntryLibraryPack[]>`, entries.ts; GH #47/#48) — each kind's packs render as that section's add-from-library menu, whose commits route through the SAME validated `onAdd` path as hand-authored entries (slug-dedup, order, enabled, deletable). Non-reflected pure type-carrier (the `schema`/`store` precedent). Reactive (GH #143, same identity-change law as `schema`/`store`) — a real reassignment (a new object reference) rebuilds each kind's add-from-library MENU in place via the `connected()` effect, letting a caller re-scope which packs a persona/preset sees without recreating the element; the section shell itself and its rendered entries are unaffected. Absent/empty ⇒ the affordance renders nowhere (byte-identical sections).

  - name: authoringStore
    description: OPTIONAL second `SettingsStore` (ADR-0178 cl.5, GH #633) arming the GUIDED-AUTHORING flow — the host-authored Builder persona's own config, from which the interview's turns compose. Set the flow arms: a second `ui-conversation` mounts beside the test one inside `chat-stack` and drives the next turn; cleared, that context tears down. `store` is NEVER reassigned by arming, clearing, or flipping between the two — GH #145's conversation reset fires on a real persona switch and on nothing else, so both transcripts survive a flip over ONE draft. A `personaPatch` the interview declares applies to `store` (the DRAFT), and only when BOTH conjuncts of the ruled consumption condition hold: the turn's driving store IS this one, AND the driving store's `surfaceAuthoring` gate reads ON at receipt. Every other turn — a test chat's, an ordinary persona's, even a gate-ON one's — logs `patchIgnored` and writes nothing.

events: []               # no DOM events of its own — the composed ui-settings/ui-conversation each emit their OWN events (unchanged, not re-emitted); this element adds no new event vocabulary

slots: []                 # content model is NOT author-composed — the split/panes/composed children are built entirely by this element's own connect-time logic, the ui-settings/ui-conversation precedent

parts:                     # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: settings-item
    description: One config-column section's FOLD, now spread across the Agent/Capabilities/Surface tabs (GH #574 — Kim's ruling, splitting the old single flat Settings tab; GH #225's Kim ruling, the GH #222 Context pattern applied back to the config column, is unchanged) — `<ui-disclosure data-part="settings-item" data-item="agent|model|surface|bankroll|prompt-section|skill|workflow|resource|tool|pattern-source">`, a chrome-free fold host whose summary IS the section heading (the shared heading register, chevron on the heading row) over the section's content card(s) as its body. ALL default OPEN (config is an editing surface — Context's newest-open logic is a log-reading choice, not a config one); built once, fold state lives in the live DOM, session-ephemeral. The Agent/kind folds carry their master switch ON the summary row via ui-disclosure's `slot="summary"` position slot (GH #226/ADR-0158 — a switch click never folds; the component owns the activation guard and the switch survives any fold rebuild). Replaces the old plain heading parts (agent-header/agent-heading/model-grid-heading/surface-options-heading/entry-section-header/-heading), all retired.
  - name: chat-stack
    description: ADR-0178 cl.5 — the content slot's stack (`<div data-part="chat-stack" data-slot="content">`), hosting the DUAL-CONTEXT chat: the try-it bar, the lazily-mounted authoring conversation, and the test conversation, in that DOM order. Both conversations stay MOUNTED for the element's whole life; a mode change flips `hidden` and nothing else, which is what lets both transcripts survive without any snapshot/restore machinery. With `authoringStore` unset the stack holds exactly one visible conversation — today's — and the bar renders nowhere.
  - name: try-it
    description: ADR-0178 cl.5 / LLD-C9 (S4-a, GH #646) — the visible authoring ⇄ test flip, `<div data-part="try-it">` atop the chat stack, hidden while `authoringStore` is unset. Hosts two `<ui-button data-part="try-it-authoring|try-it-test">`s ("Authoring"/"Try it"), `aria-pressed` reflecting `#mode`; each click calls the SAME private `#setMode` the S3 dual-context scaffold already drove from a test seam — no new mode machinery, only its first real caller. No new host event: the flip is entirely internal state (§5's frozen anatomy).
  - name: authoring-conversation
    description: ADR-0178 cl.5 — the guided-authoring interview's own `<ui-conversation data-part="authoring-conversation">`, created on the FIRST `authoringStore` assignment (an element that never enters the flow carries no second conversation at all). Same `receipt`/`sources` developer-surface opt-ins as the test conversation; its model picker writes the AUTHORING store, so the interviewer's model choice can never silently become the draft agent's.
  - name: agent-enabled
    description: The Agent ACTIVE master switch (vision rev.5, Kim's ruling — "is the agent active/available"), riding the Agent fold's heading row (GH #225). OFF sets `conversation.disabled` (composer busy-disabled, no turns run, both prose and surface arms guarded); everything stays editable, and the switch stays visible even with its fold collapsed (the way back never folds away). Backed by the `agentEnabled` store key (default ON — only an explicit stored `false` disables).
  - name: kind-enabled
    description: One capability kind's MASTER switch (vision rev.5), riding its kind fold's heading row (GH #225). OFF gates the WHOLE kind out of the composed live prompt, the stub's roster, and the surface arm's integrations — winning over per-entry toggles — and dims the section (`data-kind-disabled` on the section host; the switch itself sits outside the dimmed section, full-strength by construction). Backed by `${kind}sEnabled` store keys — the `tool` kind resolves to the PRE-EXISTING `toolsEnabled` key (the old Agent-card boolean field, retired from the schema in the same change; persisted values carry over).
  - name: entry-section
    description: One kind's whole section — `<div data-part="entry-section" data-kind="...">` — the ONE shape all seven instantiations share (ADR-0132 `n1`; genui-surface B2 added `pattern-source`, ADR-0170 added `catalog`). HEADLESS since GH #225 (its fold's summary labels it) — carries the entry list and (unless suppressed) the add-form. `[data-kind-disabled]` when the kind is gated off — by its own master switch, or for the `catalog` kind by the A2UI surface toggle (ADR-0170 cl.5).
  - name: entry-section (kind="catalog")
    description: The Catalogs LIBRARY section (ADR-0170) — the same primitive with three row exceptions, no new list/toggle/author code. (1) SINGLE-select, derived - every switch's checked state is `entry.id === sanitizeCatalog(store.get('a2uiCatalog'))`, so exactly one row is ON by construction and the stored per-entry `enabled` flags are never the selection truth (cl.2). Toggling a REGISTERED row ON writes the key; an UNREGISTERED row (a dedup-suffixed duplicate) is a VISIBLE no-op that snaps back; toggling the ACTIVE row OFF, or deleting it, writes the DEFAULT id - a persona always has a catalog (cl.3/cl.4). (2) NO master switch - the A2UI surface toggle is the gate, and the kind is excluded from the composed prompt (`catalogId` is wire, never prose - cl.5). (3) No authoring form and no per-entry editor (`customAdd`/`contentField` both false, cl.8) - rows are label + description + switch, and adds come from the "Registered catalogs" library pack alone, which maps LIVE from `A2UI_CATALOG_OPTIONS` (cl.7). The Default row is guaranteed at READ time (never a migration write), `builtin` and so undeletable.
  - name: model-grid
    description: The Model management card (2026-07-19 rev.2) — provider-grouped rows, one per roster model, each `[ model-row-label | model-include ui-switch | model-default ui-radio ]` — one logical radio system across the provider groups (rev.3). Checking a row writes `model`; a standalone-radio untoggle restores via re-render (a roster always has a default) and the default row's include switch locks on (`model`'s row is always offered). Re-rendered wholesale on `model`/`modelsIncluded` store changes.
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
    description: An entry's remove affordance — a `<ui-button data-part="entry-delete">`, present ONLY for a non-built-in (custom) entry (TKT-0048).
  - name: entry-description
    description: An entry's optional one-line description, when non-empty.
  - name: entry-notice
    description: GH #419 — a NON-BLOCKING per-entry notice (`<p data-part="entry-notice" role="status">`), directly under the entry header, above the content it is about. Used today by the modality lint (`prompt-lint.ts`): an ENABLED prompt section whose content names a modality that is switched OFF in Surface Options ("A2UI"/"GenUI", the wire vocabulary, or a compound catalog type name) shows one here, and it clears when the toggle re-enables or the text is reworded. Composition and turns are byte-identical whether it shows or not — this never gates anything. Absent on a clean entry.
  - name: entry-content
    description: An entry's `<ui-code-editor language="markdown" data-part="entry-content">` — the editable-first markdown source editor (ADR-0139, CodeMirror lazy-loaded), replacing the plain ui-textarea these blocks used before; the content is markdown by construction (composeSystemPrompt's `##`/`###` blocks).
  - name: entry-add-toggle
    description: A section's `<ui-button data-part="entry-add-toggle">` ("Add ...", with a leading `plus` icon adornment — TKT-0048), revealing/hiding the add-form.
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
  - name: surface-options
    description: The Surface Options card (vision rev.6 — the frame's node 34:1312), in the Surface tab (GH #574) — the agent's OUTPUT-MODALITY contract, three `surface-row`s (`data-surface="markdown|a2ui|genui"`), each `[ surface-toggle | surface-label | surface-spacer ]`. GH #541 — a modality with CHILDREN is wrapped in a `surface-group` (`data-surface="a2ui|genui"`) carrying the card chrome, its children in an indented `surface-detail` zone under the row: A2UI's catalog picker section, GenUI's dogfood sub-option. Markdown has no children, so it stays a bare row. Bankroll left this card in the same wave — it is its own fold now (`data-item="bankroll"`), riding the Agent tab since GH #574.
  - name: surface-group
    description: GH #541 — one modality plus its children as ONE card (`<div data-part="surface-group" data-surface="a2ui|genui">`): the `surface-row` on top (chrome-free inside the group — never a card-in-card), a `surface-detail` zone beneath it. The nesting is what says a catalog card or a sub-option BELONGS to the toggle above it; before this the three hierarchy levels rendered as one flat sibling stack, ranked only by reading order.
  - name: surface-detail
    description: GH #541 — a modality's indented detail zone (`<div data-part="surface-detail">`), inset past its row's own left edge with a leading rule. Holds A2UI's catalog `entry-section` (roster + "+ From library" add-row, so both read as A2UI's) and GenUI's `surface-detail-row`. Collapses to nothing when empty.
  - name: surface-detail-row
    description: GH #541 — a nested sub-option row inside a `surface-detail` (`data-detail="genui-dogfood"` today): the same `[ switch | label ]` grammar as a modality row, on the group's shared inner surface rather than a card of its own. Exists so a modality row carries exactly ONE toggle scope — GenUI's "Use agent-ui components" used to ride the modality's own row as a second switch.
  - name: bankroll-row
    description: GH #525/#541 — the Bankroll fold's one card (`<div data-part="bankroll-row">`): `[ bankroll-label | surface-spacer | bankroll-reset ]`, no toggle (there is no on/off here, only a stored figure to clear). Its own group since GH #541 — a persona's stored figure is not an output modality, and the shared `surface-row` chrome made it read as one; it rides the Agent tab since GH #574 (persona state lives with the persona). (The a2ui row's `surface-catalog` mirror retired in the same wave: with the picker nested under the row, the active catalog's own card carries that identical label one line below — the same string projected twice, adjacently.)
  - name: bankroll-reset
    description: GH #525 (design call 3, 2026-08-07) — the bankroll row's `<ui-button data-part="bankroll-reset">` ("Reset"), clearing the persisted `bankroll` store key (written `null`, the SAME JSON-round-trippable "cleared" shape `sanitizeBankroll` reads back as "no stored bankroll"). The whole FOLD is entirely `hidden` unless the active persona opted into the capability (`bankrollCapable`, preset-seeded) — never just dimmed, since a persona whose games track no `/bankroll` pointer has nothing here to configure.
  - name: context-system
    description: The Context: System render slot, a DIRECT child of its segment container (GH #222 dropped the old outer "Agent System" wrapper card — the segment strip already labels the context) — rebuilt wholesale on ANY store write (the compiled view reads nearly every key; writes are commit-time, never per-keystroke). Carries one context-item per subject.
  - name: context-item
    description: One Context: System section — `<ui-disclosure data-part="context-item" data-item="agent|skill|workflow|resource|tool|pattern-source|catalog">` rendered as the shared fold pattern (GH #222; the Settings tab's own settings-item folds joined it in GH #225): a CHROME-FREE fold host whose summary reads as a plain section heading (the shared heading register, chevron kept on the heading row) over exactly ONE card of content (the context-json body) — never a card-in-card. The `agent` item (open by default) carries the COMPILED config — name/model/temperature/effort/active + the EXACT `composeLiveSystemPrompt` output a turn would send; each kind item (closed by default — the frame's caret-right rows) carries `{ enabled, entries: [{label, enabled, description}] }`. Open/closed state survives rebuilds (`data-item`-keyed capture).
  - name: context-turns
    description: The Context: Dialog render slot, a DIRECT child of its segment container (GH #222 — the old outer "Dialog Turns" wrapper card is gone) — the per-turn payload log, NEWEST FIRST with zero-padded descending numbers (the frame's 04→01), bounded at 20 (the oldest fall off; numbering stays monotonic). Session-ephemeral — never persisted.
  - name: context-turn
    description: One logged turn — a context-item variant (`data-part="context-turn"`, the same GH #222 heading-row + one-card shape) whose JSON body is `{ arm: stub|live|surface, request, response }`; failures log too (`response.error`). The newest turn's fold defaults open.
  - name: context-json
    description: The mono pretty-printed JSON preview — since GH #222 the section's ONE card of content (the shared card chrome recipe on the code-surface plane) — its OWN scroll container (overflow-x + a 20rem block cap), so a long systemPrompt line can never widen the pane.

customStates: []          # no :state() hooks — no derived presentation state of this element's own (unlike ui-master-detail's data-view)

face:
  formAssociated: false    # NOT a FACE form control — a layout composition; the composed ui-settings' OWN generated fields are each their own FACE participant, unchanged

aria:
  role: none               # this element carries no ARIA of its own — the composed ui-split/ui-settings/ui-conversation/ui-switch/ui-code-editor each carry their own, inherited unchanged; the remaining native form controls (input/button) here carry native semantics
  roleSource: none

keyboard: []                # no bespoke keyboard handling of this element's own — the composed ui-split's separators, ui-settings' rail, ui-conversation's composer, every ui-switch, and every ui-code-editor each carry their OWN keyboard contract, inherited unchanged; the remaining native form controls are native (platform keyboard behavior)

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

A two-pane `ui-split` (vision rev.5, Kim's Figma frame 33:1693 — superseding ADR-0131 cl.2's
three-pane order): `[ chat canvas | {Agent ⇄ Capabilities ⇄ Surface ⇄ Context: System ⇄ Context: Dialog}
tabs ]`. GH #574 (Kim's ruling, 2026-08-07) split the old single flat Settings tab's ten folds — three
distinct ranks flattened into one scroll — into three tabs, each still a heading-row FOLD since GH #225
(`settings-item`, all open by default): **Agent** — who it is: Agent (`ui-settings`, the ACTIVE master
switch on the fold's heading row) + the Model grid + Bankroll (a persona's opt-in stored figure, hidden
entirely for one that never opted in). **Capabilities** — what it can do: the prompt sections (the old
prompts pane, merged in) + four capability kinds (Skills/Workflows/Resources/Tools, each kind's master
switch on ITS fold heading row). **Surface** — how it renders: the Surface Options card (rev.6 — the
output-modality contract: Markdown · A2UI + its nested catalog picker · GenUI, live since genui-surface
B2) + Pattern sources (the one remaining capability kind, riding this tab since it configures the GenUI
modality's rendering rather than a capability the agent has). The Context tabs are the read-only
introspection surface, split in two (GH #161, superseding the old single combined "Context" tab) and
carrying the SAME fold pattern (GH #222 — heading-row chevrons + one JSON card each, no outer wrapper
card): **Context: System** (the compiled agent-system JSON, incl. the `surface` block) and
**Context: Dialog** (the per-turn payload log). Below 640px the shell collapses to
{Chat, Agent, Capabilities, Surface, Context: System, Context: Dialog} tabs — a flat top-level strip, not
a nested sub-tab-set (TKT-0085's mechanism, two bands instead of three; every tab is one content unit
moved whole between its wide tab-panel and its narrow tab-panel, Context included).

## One primitive, seven instantiations (ADR-0132; genui-surface SPEC-R11 added pattern-source, ADR-0170 added catalog)

The prompts pane and four of the settings pane's sections are the SAME shape — a named, ordered,
toggleable entry in a typed list, with a shared custom-entry authoring form:

- **Prompts pane** — `kind: "prompt-section"`, seeded with three built-in sections (Foundation,
  Personality, Critical Items), each independently toggleable and editable. A composer concatenates the
  ENABLED sections, in order, into the one final system prompt. GH #419: an enabled section whose text
  NAMES a modality that Surface Options has switched off gets a non-blocking `entry-notice` warning on its
  own card (dialect belongs to the harness's grammar block, not to persona prose — ADR-0138's boundary,
  GH #412) — it clears on a re-enable or a reword, and gates nothing.
- **Agent/Capabilities tabs** — the unchanged "Agent" config (name/model/temperature/toolsEnabled, via the
  composed `ui-settings`, in the Agent tab) PLUS four capability kinds — Skills, Workflows, Resources,
  Tools, in the Capabilities tab — each an unseeded, purely custom-authorable instance of the same
  primitive.
- **Catalogs** (ADR-0170) — `kind: "catalog"`, the family's first SINGLE-select kind, and the first whose
  selection truth lives OUTSIDE the entries store: the roster records which registered catalogs are on
  this persona's shelf, while `a2uiCatalog` records the one selection every switch DERIVES from. See the
  `entry-section (kind="catalog")` part above for the three row exceptions it carries.

No kind gets its own bespoke list/toggle/author code — a future kind is a seed-data change, not a code
change (ADR-0132 Fork 2). The one per-kind knob is presentational: `EntryListOptions`'
`customAdd`/`contentField` (ADR-0170 cl.8), both default-true, so every other kind renders unchanged.

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

## The chat canvas: a stub by default, a real model call under a DEV-only opt-in (ADR-0131/ADR-0136)

By default `ui-agent-admin` has **no external runtime dependency** — the turn loop that answers each
message (`agent-admin-schema.ts`'s `runStubAgentTurn`) is a deterministic function that visibly cites the
composed prompt AND the enabled capabilities in its reply, proving the live-apply wiring works without a
real model integration. This is the ONLY path the static build carries, so the shipped docs site's
"no external dependency" guarantee (ADR-0131 cl.4/7) holds for every visitor.

Set the optional `agentTurn` property to swap that stub for a **real live model turn** (TKT-0052/ADR-0136):
the request is projected fresh from the current config every turn — the selected model, the composed
system prompt, and every enabled capability entry (skills/workflows/resources/tools, projected as prose;
the Tools kind gated by the `toolsEnabled` switch) — and replayed with the running multi-turn history. The
docs site wires this ONLY under `import.meta.env.DEV`, through the reused `dev-proxy-plugin.ts` trust
boundary (ADR-0073, the browser never holds a key), so a live call happens only in a local `vite dev`
session with a configured provider key; a network/provider failure degrades visibly via the conversation's
error path, never a crash. A switch of model or prompt mid-conversation applies to the NEXT turn only.

## Fail-closed everywhere

An all-disabled/empty prompt-section set falls back to `DEFAULT_SYSTEM_PROMPT_FALLBACK` (`entries.ts`) —
never an empty instruction reaching the stub reply. A custom entry with no name is rejected
(`validateNewEntry`) — never silently admitted. A built-in entry can be toggled off but never deleted
(ADR-0132 Fork 4). Every "Agent" field's validity is the composed `ui-settings`' own responsibility
(SPEC-R11), unchanged.
