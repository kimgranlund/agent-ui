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
    description: OPTIONAL second `SettingsStore` (ADR-0178 cl.5, GH #633) arming the GUIDED-AUTHORING flow — the host-authored Builder persona's own config, from which the interview's turns compose. Set the flow arms: the `copilot-pane` conversation drives the next turn from its own composer, origin-keyed (GH #662's Amendment re-keyed `#contextFor` from pane identity to the SUBMITTING COMPOSER's origin — untouched by GH #686's Amendment, LLD §16.2: "with subsets, multiple visible composers are the norm and origin-keying is what already makes that sound"); arming also lands Co-pilot visible AND primary (`ensure copilot ∈ shown + primary = 'copilot'`), and clearing tears the context down WITHOUT forcing navigation (the always-present empty log paints instead). `store` is NEVER reassigned by arming, clearing, or flipping between the two — GH #145's conversation reset fires on a real persona switch and on nothing else, so both transcripts survive a flip over ONE draft. A `personaPatch` the interview declares applies to `store` (the DRAFT), and only when BOTH conjuncts of the ruled consumption condition hold: the turn's driving store IS this one, AND the driving store's `surfaceAuthoring` gate reads ON at receipt. Every other turn — a test chat's, an ordinary persona's, even a gate-ON one's — logs `patchIgnored` and writes nothing.

events: []               # no DOM events of its own — the composed ui-settings/ui-conversation each emit their OWN events (unchanged, not re-emitted); this element adds no new event vocabulary

slots: []                 # content model is NOT author-composed — the split/panes/composed children are built entirely by this element's own connect-time logic, the ui-settings/ui-conversation precedent

parts:                     # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: settings-item
    description: One config-column section's FOLD, now spread across the Agent/Capabilities/Surface tabs (GH #574 — Kim's ruling, splitting the old single flat Settings tab; GH #225's Kim ruling, the GH #222 Context pattern applied back to the config column, is unchanged) — `<ui-disclosure data-part="settings-item" data-item="agent|model|surface|bankroll|prompt-section|skill|workflow|resource|tool|pattern-source">`, a chrome-free fold host whose summary IS the section heading (the shared heading register, chevron on the heading row) over the section's content card(s) as its body. ALL default OPEN (config is an editing surface — Context's newest-open logic is a log-reading choice, not a config one); built once, fold state lives in the live DOM, session-ephemeral. The Agent/kind folds carry their master switch ON the summary row via ui-disclosure's `slot="summary"` position slot (GH #226/ADR-0158 — a switch click never folds; the component owns the activation guard and the switch survives any fold rebuild). Replaces the old plain heading parts (agent-header/agent-heading/model-grid-heading/surface-options-heading/entry-section-header/-heading), all retired.
  - name: pane-holder
    description: GH #686's Amendment (admin-three-pane-ia.lld.md §16.1/§16.2, S7-b) — the content slot's holder (`<div data-part="pane-holder" data-slot="content">`), was `chat-stack`, then ADR-0179's fixed pair/triple `data-pane` box. It now holds THREE SIBLING regions in `PANE_ORDER` (chat · settings · copilot) — no pairing vehicle. `data-show` (the shown SET, space-joined, `PANE_ORDER`) and `data-primary` (the narrow truth, always a member of the set) are the ONLY state written here (`#applyPaneVisibility`); the sheet reads both against the holder's own inline-size (`container-type: inline-size`) — below `SHELL_COMPACT_BREAKPOINT` (52.5rem) exactly the `data-primary` region paints, at and above it every `data-show` member does. No region carries a `hidden` attribute, and no resize writes any state. `header` composes S7-c's own unified header bar (see `admin-header` below) — the retired pane nav's replacement, a different shape (selector/visibility/actions), never a restoration.
  - name: admin-header
    description: S7-c (admin-three-pane-ia.lld.md §16.1/§16.3) — `<div data-part="admin-header" data-slot="header">`, the `header` slot's one authored child (`#composeHeader`). Three zones in DOM order — `agent-select`, the pane-visibility pair (`pane-pills` wide / `pane-segments` narrow, one CSS band swap, never two copies of the truth), and `header-actions` — landmark role is the slot's own default (`banner`, super-shell.ts's `roleFor`; no `data-landmark` override, matching the anatomy's "no landmark override; the nav retired"). Paints at every band (unlike the retired nav, which used to hide itself wide at ≥54rem — this element reuses that SAME line to swap which of its two pane-visibility/actions renderings paints, never to hide the bar itself).
  - name: agent-select
    description: S7-c — `<ui-select data-part="agent-select">`, the roster picker `setAgentRoster`/`onAgentSelect` drive. Options are rebuilt wholesale on every `setAgentRoster` call (re-callable — a page re-pushes after a mint/import); the committed value is a silent programmatic write (`value =`, ADR-0019 — no `select` re-emission). The control's own internal `select`/`change` events stay contained (`stopPropagation`) — the closed seven-event set is untouched.
  - name: pane-pills
    description: S7-c — `<div data-part="pane-pills">` holding three `<ui-toggle data-pane="chat|settings|copilot">` (S7-a), the WIDE rendering of the shared shown-set/primary truth (§16.2): icon (identity glyph) + label + a state-icon (Eye/EyeSlash, mirroring membership). A press refuses via `ui-toggle`'s own cancelable-before-commit `toggle` event when it would empty the shown set (the min-one invariant); an accepted press funnels through the SAME `#setPanesShown` mutator the narrow segments and the guided-authoring arm already use. Hidden (CSS, `@container (inline-size < 54rem)`) in favor of `pane-segments` below that line.
  - name: pane-segments
    description: S7-c — `<ui-segmented-control data-part="pane-segments" aria-label="Visible pane">` holding three icon-only `<ui-segment aria-label="Chat|Settings|Co-pilot">`, the NARROW single-select rendering of the SAME truth. A commit sets primary AND ensures membership (`#setPanePrimary`, LLD §16.2's narrow-segment write semantics) — never a second copy of `#panesShown`/`#panePrimary`. Its own `change` event stays contained (`stopPropagation`). Hidden (CSS) at and above 54rem in favor of `pane-pills`.
  - name: header-actions
    description: S7-c — `<div data-part="header-actions">`, pinned to the header's inline end. Wide renders `new-agent-wide`/`import-action`/`export-action` as labeled `ui-button`s; narrow collapses to `new-agent-narrow` (an icon-only "+") plus `overflow-menu`'s icon-only trigger ("•••", Import/Export as menu items, addressed as `[data-part='overflow-menu'] [data-part='trigger']` — `ui-menu` itself owns that button's `data-part`, LLD §16.3) — the CSS band swap is unconditional; the PER-AFFORDANCE `[hidden]` layered on top is the unregistered-seam degrade (`onNewAgentRequest`/`onImportRequest`/`onExportRequest`, LLD §16.3), never a disable.
  - name: new-agent-wide
    description: S7-c — the wide `onNewAgentRequest` affordance, a labeled `<ui-button data-part="new-agent-wide">` with a leading `plus` icon. `[hidden]` while unregistered.
  - name: new-agent-narrow
    description: S7-c — the narrow `onNewAgentRequest` affordance, an icon-only `<ui-button data-part="new-agent-narrow" icon-only aria-label="New Agent">` ("+"). Shares registration state with `new-agent-wide` — ONE seam, two renderings.
  - name: import-action
    description: S7-c — the wide `onImportRequest` affordance, a labeled `<ui-button data-part="import-action">`. `[hidden]` while unregistered, independent of `export-action`'s own state.
  - name: export-action
    description: S7-c — the wide `onExportRequest` affordance, the `import-action` shape mirrored.
  - name: overflow-menu
    description: S7-c — the narrow `<ui-menu data-part="overflow-menu" placement="bottom-end">` holding Import/Export as plain menu items (LLD §16.6 OQ-B — Reset stays Settings-only, out of this menu). Its own trigger is icon-only (`dots-three`, `aria-label="More actions"`) and carries NO `data-part` of its own — `ui-menu`'s own connect-time `#ensureParts` stamps `data-part="trigger"` on its first child unconditionally, so this button is addressed scoped through the menu's own part (`[data-part='overflow-menu'] [data-part='trigger']`), never a second, losing attribute name. Each item independently `[hidden]`+`aria-disabled` per its own seam's registration, and the trigger itself hides only when BOTH are gone (an openable-but-empty menu is not a real affordance).
  - name: chat-pane
    description: LLD §16.1 — the Chat place's region: `#conversation`, the test `<ui-conversation data-part="chat-pane">`, byte-unchanged in substance from every earlier revision. A direct child of `pane-holder`, first in `PANE_ORDER`.
  - name: settings-pane
    description: GH #686's Amendment — the Settings place's region: a plain `<div data-part="settings-pane">` now (the `ui-master-detail-pane` wrapper role retired with the whole pairing vehicle) holding the `settings-nav` strip over the five section units, moved here WHOLE at compose time (a compose-time re-home, never a runtime reparent). Owns its own scroll directly (`overflow-y: auto`, the fleet's scrollbar-chrome-hidden convention) — no wrapping `ui-split-pane` exists to own it any more. A direct child of `pane-holder`, second in `PANE_ORDER`.
  - name: copilot-pane
    description: GH #686's Amendment / GH #666 — the Co-pilot place's region (renamed from Author, the vocabulary re-pins to `[Chat | Settings | Co-pilot]`): `#authoringConversation`, the interview's own `<ui-conversation data-part="copilot-pane">` — renamed from the retired `author-pane` wrapper, whose identity this element now carries directly (no wrapper exists any more). Present whether or not the flow is armed: unarmed its log is empty (GH #684 removed the headline + copy that used to occupy it) and its own composer is the flow's entry; arming FILLS the same element rather than swapping it for another. Keeps its OWN composer permanently — cl.4's per-pane composers: no composer ever re-routes, so a Chat-place submission structurally cannot drive the Builder, and a Co-pilot-place one structurally cannot drive the test context. Same `receipt`/`sources` developer-surface opt-ins as the test conversation; its model picker writes the AUTHORING store, so the interviewer's model choice can never silently become the draft agent's. GH #670 — that write is the ARMED half of one path: unarmed there is no store to write, so the same pick is held on the element and seeds the store the arm mints (Effort likewise, into the element's own dial). A direct child of `pane-holder`, third in `PANE_ORDER`.
  - name: settings-nav
    description: ADR-0179 OQ2 — the Settings place's internal sub-nav: a panel-less `<ui-tabs data-part="settings-nav" overflow="menu">` over the five section units, in GH #574's ranked order (Agent · Capabilities · Surface · Context: System · Context: Dialog). Each tab's `key` is its section's stable `data-role`, its TEXT the human `data-segment` label — identity and display copy are separate by construction, so a label edit can never desync which section a tab reveals. Flips are VISIBILITY-ONLY — the same node identities before and after, exactly the shell segment strip's own SPEC-R7c behavior, one level down, so a dirty field, an added entry, and every fold's open state survive a flip away and back. `overflow="menu"` (GH #586) is the not-enough-room strategy: five labels do not fit the detail pane's column at either band, and the menu keeps every section reachable through a real affordance rather than an affordance-less horizontal scroll. LLD-P6 (GH #656) rules the grouping final at these five.
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
  - name: reset-agent-row
    description: S7-d (LLD §16.4) — `<div data-part="reset-agent-row">`, a SIBLING of `model-grid` at the SAME `model` fold's content end (never a child of `model-grid` — that node is wholesale-`replaceChildren`d on every `model`/`modelsIncluded` store change, which would wipe a child on the next re-render). The `bankroll-row` shape verbatim — `[ reset-agent-label | surface-spacer | reset-agent-button ]`, incl. its NOUN-label/VERB-button pairing ("Agent configuration" | Reset Agent) — never the same verb phrase twice at two casings. GH #709 — this WHOLE ROW is `[hidden]` while `onResetRequest` is unregistered, never just its button: the row's label has no standalone value once the one action it names is gone, so a buttonless labeled card was the wrong degrade — reflected through the SAME `#applyActionAvailability` funnel the header's own five action affordances use.
  - name: reset-agent-button
    description: S7-d — the row's `<ui-button data-part="reset-agent-button">` ("Reset Agent"), driving the `onResetRequest` seam. Never hidden or disabled on its own (GH #709) — its ROW is what hides while unregistered.
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

THREE first-class PLACES (ADR-0179, GH #651, re-ruled by GH #686's Amendment — superseding vision rev.5's
two-pane `ui-split`, the GH #52/ADR-0154 shell arrangement that replaced it, and ADR-0179 cl.1's own
fixed-triple-dock reading): **Chat · Settings · Co-pilot** (renamed from Author). The header slot's
unified selector/visibility/actions bar (S7-c, LLD §16.1/§16.3) is the LIVE navigation vehicle — the
agent selector, the pane-visibility pills/segments, and New Agent/Import/Export all compose real
content today; the site's own former canvas-header (title/tagline, the roster switcher, the "…"
overflow) retired with it (S7-d).

- **Chat** is the pure test surface: the draft agent's own conversation.
- **Settings** groups the five section units — Agent · Capabilities · Surface · Context: System ·
  Context: Dialog — under one place with its own internal sub-nav (`settings-nav`).
- **Co-pilot** is the guided-authoring interview's own place (`authoringStore`, ADR-0178 cl.5). It is
  ALWAYS present, and it is always the interview's own conversation card — same treatment as Chat's
  (GH #666). Unarmed, that card's log is empty (GH #684 removed the "Describe the agent you want"
  headline + copy that used to occupy it), and the card's own composer is the flow's entry: the first
  message arms (through the `onGenerateRequest(cb)` registration seam) and becomes the interview's opening
  turn. The header's own New Agent button (`onNewAgentRequest`, S7-d) is the OTHER arming entry, for
  arming without typing anything — it invokes the SAME page-side mint path with no seed, since outside
  any specific card there is no pre-arm pick to carry. Generate is now the ONLY "new agent" verb (Kim's
  OQ-A ruling, LLD §16.6, GH #686 Findings 2026-08-11): the retired canvas-header's own two-choice
  "New agent → Generate/→ Blank" menu item is gone with the header it lived on, and the dedicated
  interview-less "New agent → Blank" front door (GH #637 S1) is RETIRED entirely, not just relocated —
  `mintBlankPersona`'s own mint logic stays in the codebase, still reused by Generate for its own seed.
  Armed, the transcript takes the log. Arming from anywhere lands Co-pilot visible AND primary.

**The visibility model (LLD §16.2) — a shown SET + a primary member, two band renderings.** GH #686's
Amendment retires `ui-master-detail` as the Author⇄Settings pairing vehicle entirely — the wireframe's
all-active geometry (three ~296px columns) doesn't fit the MD's own 40rem dock floor. The three places are
THREE SIBLING regions now, no pairing, arranged by CSS alone:

| holder width | what paints |
|---|---|
| below 52.5rem | exactly the PRIMARY region, alone |
| 52.5rem and up | every member of the SHOWN SET, as equal flex columns |

52.5rem is `SHELL_COMPACT_BREAKPOINT` (ADR-0150/0155) — the SAME named line the retired triple dock used,
re-derived for the new equal-thirds geometry (measured both engines: three ~272–385px columns depending
on mount width, each clearing the 20ch/160px engagement floor with real margin). A wide pill toggles shown-
set membership (turning off the last member is refused — min-one, a zero-pane surface is broken by
construction; turning off the primary repoints it to the first remaining member in reading order); a
narrow segment sets the primary and ensures its own membership. A resize writes NOTHING — crossing bands
projects/restores losslessly. No painted divider separates the top-level regions (a plain row gap now, not
a retracted split-ink token) — `ui-settings`' own nested rail|panel split still carries the no-divider law.

Which context drives the next turn is keyed by the SUBMITTING COMPOSER'S ORIGIN (GH #662's Amendment;
untouched by GH #686's — LLD §16.2: "with subsets, multiple visible composers are the norm and
origin-keying is what already makes that sound"): cl.4's per-pane composers mean the Chat place's
composer is permanently the test context and the Co-pilot place's is permanently the Builder — no composer
ever re-routes, at any band or shown-set state. The consumption fence itself is unchanged (it keys off
driving-store identity), and Chat structurally cannot reach the draft. The retired vocabulary: the try-it
bar, the `#mode` seam, the pane-nav `ui-tabs` strip, and the shell's six-entry narrow-tabs strip.

GH #574 (Kim's ruling, 2026-08-07) split the old single flat Settings tab's ten folds — three
distinct ranks flattened into one scroll — into three sections, each still a heading-row FOLD since GH #225
(`settings-item`, all open by default): **Agent** — who it is: Agent (`ui-settings`, the ACTIVE master
switch on the fold's heading row) + the Model grid + Bankroll (a persona's opt-in stored figure, hidden
entirely for one that never opted in). **Capabilities** — what it can do: the prompt sections (the old
prompts pane, merged in) + four capability kinds (Skills/Workflows/Resources/Tools, each kind's master
switch on ITS fold heading row). **Surface** — how it renders: the Surface Options card (rev.6 — the
output-modality contract: Markdown · A2UI + its nested catalog picker · GenUI, live since genui-surface
B2) + Pattern sources (the one remaining capability kind, riding this tab since it configures the GenUI
modality's rendering rather than a capability the agent has). The Context sections are the read-only
introspection surface, split in two (GH #161, superseding the old single combined "Context" tab) and
carrying the SAME fold pattern (GH #222 — heading-row chevrons + one JSON card each, no outer wrapper
card): **Context: System** (the compiled agent-system JSON, incl. the `surface` block) and
**Context: Dialog** (the per-turn payload log).

## Registration seams

`onGenerateRequest(callback)` — register the page's "start the guided flow" path (ADR-0179 OQ4). Two
affordances reach the SAME page-side mint path (`createGeneratedAgent`), by different seams: the card's
own first message (this element, `#startFromFirstMessage`) invokes this callback, carrying a seed; the
header's own New Agent button (`onNewAgentRequest`, S7-d — below) calls the page's own handler directly,
with no seed — from outside any specific card it has no pre-arm pick to carry. (GH #637 S1's separate
"New agent → Blank" interview-less mint front door, and the retired canvas-header's own "New agent →
Generate" roster-menu item these two seams once sat beside, are both RETIRED — Kim's OQ-A ruling, LLD
§16.6, GH #686 Findings 2026-08-11: Generate through the header's one New Agent button is now the only
"new agent" verb.) Registering `onGenerateRequest` is also what OPENS the card's own entry — the unarmed
card stops being `disabled` — so a static build with no mint path leaves the card unavailable (GH #684 —
no copy rides inside it any more). A callback, never a CustomEvent (SPEC-R5): the mint path is page-owned
and this component cannot import site code without inverting the layering DAG.

The callback receives a `GenerateSeed` (GH #670, Kim's 2026-08-10 ruling): the Model the user picked on the
unarmed card, for the page to SEED the store it is about to mint with (`builderStore(seed?.model)`). The pick
therefore wins by construction — the interview's first read of `model` is already the user's, so there is no
write-then-overwrite step to lose a race with — and an untouched picker sends nothing, leaving the minted
store's own default in charge. Only the card's own first-message entry carries a seed: the header's own New
Agent button, invoked from outside any specific card, has no pick to carry, so its own call sends no seed and
the minted store's own default stands. Optional at both ends: a page that ignores the argument behaves exactly as before.
Effort takes the same pre-arm-then-apply path but is not part of the seed — it has no store home by design (it
is a per-conversation dial on the element, never persisted).

### S7-c — the unified header bar's six seams (admin-three-pane-ia.lld.md §16.3, frozen shapes)

```ts
setAgentRoster(entries: readonly AgentRosterEntry[], activeId?: string): void
onAgentSelect(callback: (id: string) => void): void
onNewAgentRequest(callback: () => void): void
onImportRequest(callback: () => void): void
onExportRequest(callback: () => void): void
onResetRequest(callback: () => void): void
```

All six follow `onGenerateRequest`'s shipped semantics: a callback registration, never a CustomEvent
(SPEC-R5); last registration wins; safe before OR after connect (the GH #666 order rule — each setter's
own reflect call, mirrored by the header's build-time call, covers both orders). `setAgentRoster` is the
one DATA-in seam of the six (not a callback) — re-callable, so a page re-pushes the roster after a
mint/import; the same order-free law applies (a pre-connect call is held and applied once the header
exists).

**The degrade diverges deliberately from `onGenerateRequest`'s own precedent, stated rather than
inherited**: that seam DISABLES its card when unregistered — a disabled conversation still shows its own
copy. These five action seams (`onNewAgentRequest`/`onImportRequest`/`onExportRequest` — `onAgentSelect`
and `setAgentRoster` carry no availability state of their own) instead HIDE their affordance entirely —
the right degrade for a bare action button or menu item, which has no copy to show disabled. New Agent's
wide labeled button and its narrow icon-only "+" twin share ONE registration; Import/Export each degrade
independently (their own wide button AND their own narrow overflow-menu item); the narrow `•••` trigger
itself hides only when BOTH Import and Export are unregistered (an openable-but-empty menu is not a real
affordance either). `onResetRequest`'s own consumer (S7-d) is the Settings model-grid fold's own
`reset-agent-button` — outside the header entirely, HIDDEN by the same funnel while unregistered.

`onAgentSelect`'s callback fires from the header select's own commit; the select's internal `select`/
`change` events stay contained (`stopPropagation`) — the closed seven-event set (naming.md §4) is
untouched by this slice, same as every other composed child's events elsewhere in this element.

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

## Follow-the-change: a consumed patch navigates attention (ADR-0181, GH #695)

When a Builder-interview turn's `personaPatch` is CONSUMED (the fence + gate condition, ADR-0178 cl.2 —
never a hand edit, import, preset seed, or test-chat turn), the element reacts at commit time: the
settings pane is ensured visible (an ADDITIVE-ONLY write — the reaction may add `settings` to the shown
set but never removes a user-chosen member, never repoints primary, and never moves keyboard focus), the
owning settings section is selected, the owning `settings-item` fold is scrolled into the pane's viewport
and washed with a transient `data-attention` primary-token fade (reduced motion: a static outline). The
degrade ladder: with the user mid-interaction inside the settings pane there is no section yank; at
narrow bands (the pane does not paint) visibility is left byte-unchanged and the attention QUEUES, firing
once when the user next reveals the owning section themselves. Every consumed patch also appends a
receipt line to the turn's note — `Updated <section> › <fold>` per changed location (collapsed to
`Updated Agent` for the Agent fold's own degeneracy) — the narrow/suppressed path's one affordance. The
field→location map (`field-location.ts`) is derived from the canonical persona-key constants and
parity-gated total over `PERSONA_STATE_KEYS`; an unmapped key skips silently, never throws.

## Which bubble a surface action answers into (TKT-0079 + GH #802)

A surface turn started by an ACTION CLICK resumes the bubble that owns the clicked surface — the
interaction/game loop stays in one card (TKT-0079: "stay in the same card unless it has to become a new
card"), and even a fresh `surfaceId` in that resumed turn mounts into the same bubble. Answering a
**declared feed ask** is the one exception (ADR-0097 §1, Kim's 2026-08-13 ruling on GH #802): an answered
ask is never updated — it becomes conversation history and the next step declares a FRESH ask id — so its
reply opens a NEW dialog round (a fresh bubble carrying the next card, the answered card left untouched
above it). The discriminator is the ask DECLARATION the runner peels off the meta-line (`{kind:'ask'}`,
`AdminSurfaceTurnEvent`), recorded per rendered ask and read at turn start off the ANSWERED surface — never
the reply's own mid-stream declaration, which could only reach a fresh bubble by first mutating the card it
is supposed to leave alone. ADR-0129 cl.2 is untouched either way: a known `surfaceId` still routes to its
original host, and a fresh ask id is by definition not a known one.

## The chat canvas: a stub by default, a real model call under a DEV-only opt-in (ADR-0131/ADR-0136)

By default `ui-agent-admin` has **no external runtime dependency** — the turn loop that answers each
message (`agent-admin-schema.ts`'s `runStubAgentTurn`) is a deterministic function that visibly cites the
composed prompt AND the enabled capabilities in its reply, proving the live-apply wiring works without a
real model integration. This is the ONLY path the static build carries, so the shipped docs site's
"no external dependency" guarantee (ADR-0131 cl.4/7) holds for every visitor.

Set the optional `agentTurn` property to swap that stub for a **real live model turn** (TKT-0052/ADR-0136):
the request is projected fresh from the current config every turn — the selected model, the composed
system prompt, and every AMBIENT capability entry (skills/workflows/resources/tools, projected as prose;
the Tools kind gated by the `toolsEnabled` switch) — and replayed with the running multi-turn history.
"Ambient" is enabled AND in-context (GH #850): each of those four kinds' entries carries a per-entry
availability mode, and a **user-invocable** one contributes nothing to any turn's ambient bytes — not the
prompt, not the `integrations` wire, not the config snapshot — until the user invokes it from the
conversation (the reach path below). Its row stays visibly marked in the Settings place so the state is never a mystery. The
docs site wires this ONLY under `import.meta.env.DEV`, through the reused `dev-proxy-plugin.ts` trust
boundary (ADR-0073, the browser never holds a key), so a live call happens only in a local `vite dev`
session with a configured provider key; a network/provider failure degrades visibly via the conversation's
error path, never a crash. A switch of model or prompt mid-conversation applies to the NEXT turn only.

## The reach path: `@` mentions and `/` invocations (GH #849, SPEC-R8/R4)

The composer's two rosters come from this element, rebuilt from a FRESH store read whenever anything the
store holds changes: `@` offers the enabled **Resources**, `/` offers the enabled **Skills · Workflows ·
Tools**, both availability modes included — an in-context entry may appear in the menu *and* compose
ambiently; a user-invocable one appears ONLY here. A disabled entry, or any entry of a kind whose master
switch is off, is absent. Labels are read from the entries themselves per build, so a rename (GH #848)
shows on the next menu open with nothing else to wire; the reference the user commits carries the entry's
`id`, which is what everything downstream resolves by (GH #402).

At send, `ui-agent-admin` resolves each committed reference against a fresh store read, by id, fail-closed
(an entry deleted, disabled, or master-switched off between menu and send contributes nothing, and the turn
still sends):

- a **skill · workflow · resource** frames into the outgoing user turn's TEXT — one `### {label} ({kind})`
  block per entry under a single `## Referenced for this message` header, content verbatim, the typed text
  last. That framed text is what every arm sends and what history records, so a follow-up turn keeps the
  attachment without re-mentioning it (the cost is owned: the attachment rides the whole session's replay,
  with no size cap this arc). The conversation itself keeps showing the typed text plus its chips — the
  Context: Dialog log is where the wire truth is inspected.
- a **tool** unions its id into THAT turn's `integrations` (both live arms, deduped, ambient ids first).
  Nothing persists: the next turn's list is the ambient projection again.

The transport carries zero new vocabulary for any of it — the whole mechanism is host-side, which is why
`agent-transport.ts`, the dev proxy and the Worker were untouched by the feature.

## Fail-closed everywhere

An all-disabled/empty prompt-section set falls back to `DEFAULT_SYSTEM_PROMPT_FALLBACK` (`entries.ts`) —
never an empty instruction reaching the stub reply. A custom entry with no name is rejected
(`validateNewEntry`) — never silently admitted. A built-in entry can be toggled off but never deleted
(ADR-0132 Fork 4). Every "Agent" field's validity is the composed `ui-settings`' own responsibility
(SPEC-R11), unchanged.
