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
    description: OPTIONAL second `SettingsStore` (ADR-0178 cl.5, GH #633) arming the GUIDED-AUTHORING flow — the host-authored Builder persona's own config, from which the interview's turns compose. Set the flow arms: a second `ui-conversation` mounts inside the Author place and drives the next turn while that place is active (ADR-0179 re-keyed the selector from the retired `#mode` seam to the ACTIVE PLACE — a one-token change with everything below it untouched); arming also NAVIGATES to Author, and clearing tears the context down WITHOUT forcing navigation (the always-present empty state paints instead). `store` is NEVER reassigned by arming, clearing, or flipping between the two — GH #145's conversation reset fires on a real persona switch and on nothing else, so both transcripts survive a flip over ONE draft. A `personaPatch` the interview declares applies to `store` (the DRAFT), and only when BOTH conjuncts of the ruled consumption condition hold: the turn's driving store IS this one, AND the driving store's `surfaceAuthoring` gate reads ON at receipt. Every other turn — a test chat's, an ordinary persona's, even a gate-ON one's — logs `patchIgnored` and writes nothing.

events: []               # no DOM events of its own — the composed ui-settings/ui-conversation each emit their OWN events (unchanged, not re-emitted); this element adds no new event vocabulary

slots: []                 # content model is NOT author-composed — the split/panes/composed children are built entirely by this element's own connect-time logic, the ui-settings/ui-conversation precedent

parts:                     # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: settings-item
    description: One config-column section's FOLD, now spread across the Agent/Capabilities/Surface tabs (GH #574 — Kim's ruling, splitting the old single flat Settings tab; GH #225's Kim ruling, the GH #222 Context pattern applied back to the config column, is unchanged) — `<ui-disclosure data-part="settings-item" data-item="agent|model|surface|bankroll|prompt-section|skill|workflow|resource|tool|pattern-source">`, a chrome-free fold host whose summary IS the section heading (the shared heading register, chevron on the heading row) over the section's content card(s) as its body. ALL default OPEN (config is an editing surface — Context's newest-open logic is a log-reading choice, not a config one); built once, fold state lives in the live DOM, session-ephemeral. The Agent/kind folds carry their master switch ON the summary row via ui-disclosure's `slot="summary"` position slot (GH #226/ADR-0158 — a switch click never folds; the component owns the activation guard and the switch survives any fold rebuild). Replaces the old plain heading parts (agent-header/agent-heading/model-grid-heading/surface-options-heading/entry-section-header/-heading), all retired.
  - name: pane-nav-bar
    description: ADR-0179 cl.1 (admin-three-pane-ia.lld.md §3, GH #651) — the THREE-PLACE navigation bar, authored into the composed chat-shell's `header` slot as `<div data-part="pane-nav-bar" data-slot="header" data-landmark="navigation">`. The `data-landmark` override retargets the header slot's default `banner` role onto `navigation` through super-shell's own shipped seam (ADR-0083's role-decoupled-from-placement precedent). The admin composing a header at all is what re-joins the header-BEARING arm of chat-shell.css's GH #650 inset split.
  - name: pane-nav
    description: ADR-0179 cl.1 — the ONE navigation vehicle, at every band: a panel-less `<ui-tabs data-part="pane-nav">` hosting three `<ui-tab data-part="pane-nav-chat|pane-nav-author|pane-nav-settings" key="chat|author|settings">`s — Chat · Author · Settings. Composed the GH #221 way (a bare `ui-tabs`, `ui-tab` children carrying `key`, no `ui-tab-panel`s: the PLACES it selects are this element's own visibility targets, `link()`ed for aria-controls), which is the retired try-it strip's composition method re-anchored one level up. `selected` reflects the active place, written programmatically on a non-user flip (no `select` echo, ADR-0019); the control's ONE user-commit `select` is `stopPropagation`'d, so the element's event vocabulary stays closed and no new host event is minted. It replaces BOTH the try-it bar (the authoring ⇄ test flip is a place change now) and the shell's six-entry narrow-tabs strip.
  - name: pane-holder
    description: ADR-0179 cl.1 — the content slot's holder (`<div data-part="pane-holder" data-slot="content">`), was `chat-stack`. It holds the PLACES, not one place's two conversations: the test conversation (the Chat place) and the master-detail pairing (the Author and Settings places). Both conversations stay MOUNTED for the element's whole life; a place change writes the active place here as `data-pane` and nothing else, which is what lets both transcripts survive without any snapshot/restore machinery. GH #662 — this box is also the CONTAINER the band rules query (`container-type: inline-size`): the sheet reads `data-pane` against the holder's own width to decide what paints, so no region carries a `hidden` attribute and no resize writes any state.
  - name: pane-pair
    description: ADR-0179 cl.3 — the Author⇄Settings PAIRING: a composed `<ui-master-detail data-part="pane-pair">` whose `list` pane is the Author region and whose `detail` pane is the Settings region. ONE region, ARRANGED — never a second mount: at or above master-detail's own 40rem own-container line the two dock as a resizable `ui-split` (the live-hydration adjacency — hand-edit the draft beside the interview), and below it the element drills into one region at a time, which is what gives Settings a full-surface narrow home. The consumer-written `selected` carries that drill-in (`''` for Author, `'settings'` for Settings); the MD's own `select`/`change` are contained at its host. Its control-rendered back affordance is suppressed in admin CSS — the pane nav is the one nav vocabulary.
  - name: author-pane
    description: ADR-0179 / GH #666 — the Author place's region (`<ui-master-detail-pane pane="list" data-part="author-pane">`), holding exactly ONE child at every point of the flow: the interview's `authoring-conversation` card. Its node identity survives master-detail's compose-time relocation (whole pane elements move, never their grandchildren), so the conversation always mounts into the arranged region.
  - name: author-empty
    description: ADR-0179 OQ4 / GH #666 — the Author card's EMPTY-LOG state, seated inside `authoring-conversation`'s own `[data-part="log"]` (`ui-conversation.setEmptyState`) whenever `authoringStore` is unset and dropped the moment the flow arms. Kim's 2026-08-10 pixel ruling ("the center pane should be a CHAT, just like Test chat") is why it lives THERE and not beside the card: the unarmed Author column is the interview's own conversation — same border, same kicker, same bottom-pinned composer — with this headline + copy occupying the log until the first turn. COMPOSER-FIRST (his earlier same-day ruling) still holds and is now literal: the composer the user types into is the CARD's, and its first message arms the flow through the page's `onGenerateRequest(cb)` callback before landing as the interview's opening turn, so the description is never swallowed. GH #681 (Kim's later 2026-08-10 ruling) removed the SECONDARY `<ui-button data-part="author-empty-action">` ("New agent → Generate") that used to ride inside this state: it duplicated the roster (...) menu's identically-labelled item down to the outcome (both ultimately called the page's `createGeneratedAgent`), so creating a new agent stays a roster-menu action and this state is headline + copy only. The whole card is still `disabled` with NO callback registered — a static build with no mint path shows the copy alone, and the composer's own busy guard refuses a send before reading the text. That `disabled` read is computed at build time from the registration (not only pushed by it), so registering BEFORE the element connects — what the real page does — opens the entry just as a post-connect registration does. GH #670 — the unarmed card also carries the interview's Model and Effort pickers, from the same roster and levels the armed card shows, so the first-touch surface offers a real choice instead of only defaults; the pick is held locally until the arm SEEDS the newly-minted interviewer with it (see `onGenerateRequest` under Registration seams) — a pick made on this card and then armed via the roster menu instead of typing is NOT seeded (the roster menu, invoked from outside any specific card, has no pick to carry).
  - name: settings-pane
    description: ADR-0179 — the Settings place's region (`<ui-master-detail-pane pane="detail" data-part="settings-pane">`): the `settings-nav` strip over the five section units, which moved here WHOLE at compose time from the retired `options-pane` slot (a compose-time re-home, never a runtime reparent).
  - name: settings-nav
    description: ADR-0179 OQ2 — the Settings place's internal sub-nav: a second panel-less `<ui-tabs data-part="settings-nav" overflow="menu">` over the five section units, in GH #574's ranked order (Agent · Capabilities · Surface · Context: System · Context: Dialog). Each tab's `key` is its section's stable `data-role`, its TEXT the human `data-segment` label — identity and display copy are separate by construction, so a label edit can never desync which section a tab reveals. Flips are VISIBILITY-ONLY — the same node identities before and after, exactly the shell segment strip's own SPEC-R7c behavior, one level down, so a dirty field, an added entry, and every fold's open state survive a flip away and back. `overflow="menu"` (GH #586) is the not-enough-room strategy: five labels do not fit the detail pane's column at either band, and the menu keeps every section reachable through a real affordance rather than an affordance-less horizontal scroll. LLD-P6 (GH #656) rules the grouping final at these five.
  - name: authoring-conversation
    description: ADR-0178 cl.5 — the guided-authoring interview's own `<ui-conversation data-part="authoring-conversation">`, mounted inside `author-pane` (ADR-0179) at compose time and present whether or not the flow is armed (GH #666 retired the lazy mount: unarmed, this card IS the Author column, carrying `author-empty` in its log — arming FILLS the same element rather than swapping it for another). It keeps its OWN composer permanently — cl.4's per-pane composers: no composer ever re-routes, so a Chat-place submission structurally cannot drive the Builder, and an Author-place one structurally cannot drive the test context. Same `receipt`/`sources` developer-surface opt-ins as the test conversation; its model picker writes the AUTHORING store, so the interviewer's model choice can never silently become the draft agent's. GH #670 — that write is the ARMED half of one path: unarmed there is no store to write, so the same pick is held on the element and seeds the store the arm mints (Effort likewise, into the element's own dial). Either way a choice made on this card configures the INTERVIEWER, never the draft.
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

THREE first-class PLACES (ADR-0179, GH #651 — superseding vision rev.5's two-pane `ui-split` and the
GH #52/ADR-0154 shell arrangement that replaced it): **Chat · Author · Settings**, voiced by ONE
navigation vehicle at every band — a panel-less `ui-tabs` in the composed chat-shell's header slot
(`pane-nav`).

- **Chat** is the pure test surface: the draft agent's own conversation. Below the triple line it renders
  SOLO — no settings rail beside it (places are disjoint in that band; the tune-while-testing adjacency
  is the AUTHOR pairing below).
- **Author** is the guided-authoring interview's own place (`authoringStore`, ADR-0178 cl.5). It is
  ALWAYS present, and it is always the interview's own conversation card — same treatment as Chat's
  (GH #666). Unarmed, that card's log carries the "Describe the agent you want" copy, and the card's own
  composer is the flow's entry: the first message arms (through the `onGenerateRequest(cb)` registration
  seam) and becomes the interview's opening turn. The roster (...) menu's own "New agent → Generate" item
  is the OTHER arming entry, for arming without typing anything (GH #681 removed the in-card duplicate of
  that item). Armed, the copy leaves and the transcript takes the log. Arming from anywhere lands the user
  here.
- **Settings** groups the five section units — Agent · Capabilities · Surface · Context: System ·
  Context: Dialog — under one place with its own internal sub-nav (`settings-nav`).

Author and Settings are two panes of ONE composed `ui-master-detail` (`pane-pair`), which is what makes
the pairing an ARRANGEMENT rather than a duplication: at or above its 40rem own-container line the two
regions dock side by side, resizable, so a patch the interview declares hydrates the settings region
live while the turn streams; below that line it drills into one region at a time, giving Settings a
full-surface narrow home. The five section units are the SAME DOM nodes at every band and in every
arrangement.

**The band ladder (GH #662, ADR-0179 cl.1's proposed Amendment).** Which places paint is a reading of
`pane-holder`'s own inline-size, never a JS decision:

| holder width | what paints |
|---|---|
| below 40rem | the named place, with the pair itself drilled into one region |
| 40rem – 52.5rem | the named place: Chat solo, or the Author⇄Settings pair docked |
| 52.5rem and up | the TRIPLE DOCK — `[chat \| author \| settings]` all three side by side |

52.5rem is `SHELL_COMPACT_BREAKPOINT` (ADR-0150/0155), not a new number, and it is where it is by
constraint: the master-detail needs 40rem of its own or it drills in, leaving Chat the remainder, and
52.5rem is the first named line where that remainder still clears the 20ch engagement floor (measured
both engines at the line: chat 200px, author 320px, settings 320px, floor 160px). The pane nav persists
at every band; above the line it names a place rather than gating one. No painted divider separates
docked regions — the split separator's resting ink is retracted while every resize mechanic survives.

Which context drives the next turn is keyed by the SUBMITTING COMPOSER'S ORIGIN (GH #662; it was the
active place at S1-b, and the mode flag before that): cl.4's per-pane composers mean the Chat place's
composer is permanently the test context and the Author place's is permanently the Builder — no composer
ever re-routes, at any band. Origin rather than place is what keeps that true in the triple dock, where
both composers are on screen at once; the consumption fence itself is unchanged (it keys off
driving-store identity), and Chat structurally cannot reach the draft. The retired vocabulary: the try-it bar, the `#mode`
seam, and the shell's six-entry narrow-tabs strip.

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

`onGenerateRequest(callback)` — register the page's "start the guided flow" path (ADR-0179 OQ4). The
same callback is invoked from TWO places: the card's own first message (this element,
`#startFromFirstMessage`) and the roster (...) menu's "New agent → Generate" item (page-side,
`site/pages/agent-admin-app.ts`; GH #681 removed the in-card duplicate of that item). Registering is also
what OPENS the card's own entry — the unarmed card stops being `disabled` — so a static build with no mint
path paints the copy alone. A callback, never a CustomEvent (SPEC-R5): the mint path is page-owned
(`createGeneratedAgent` — a roster mint plus a `builderStore()` arm) and this component cannot import site
code without inverting the layering DAG.

The callback receives a `GenerateSeed` (GH #670, Kim's 2026-08-10 ruling): the Model the user picked on the
unarmed card, for the page to SEED the store it is about to mint with (`builderStore(seed?.model)`). The pick
therefore wins by construction — the interview's first read of `model` is already the user's, so there is no
write-then-overwrite step to lose a race with — and an untouched picker sends nothing, leaving the minted
store's own default in charge. Only the card's own first-message entry carries a seed: the roster menu, invoked
from outside any specific card, has no pick to carry, so its own call sends no seed and the minted store's own
default stands (GH #681). Optional at both ends: a page that ignores the argument behaves exactly as before.
Effort takes the same pre-arm-then-apply path but is not part of the seed — it has no store home by design (it
is a per-conversation dial on the element, never persisted).

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
