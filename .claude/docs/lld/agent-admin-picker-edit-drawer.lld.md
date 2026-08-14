# LLD — agent-admin roster management: picker actions + the Edit Agents drawer (GH #845, page lane)

> Refines: GH #845's own acceptance criteria (the requirement source — this composition has no SPEC;
> §2's Traces column cites the ACs as AC1…AC7, numbered in §1b below). Composes on
> [ADR-0188](../adr/0188-ui-drawer-edge-docked-modal-container.md) (accepted — `ui-drawer` consumed UNMODIFIED,
> its intake §6 fence anticipated exactly this content: "roster lists, danger rows, reorder/duplicate
> affordances all page-owned") and extends `ui-agent-admin`'s S7-c seam family additively (the
> `onResetRequest`/GH #709 precedent — no ADR was needed then either). Build plan:
> [`../decompositions/agent-admin-picker-edit-drawer.decomp.json`](../decompositions/agent-admin-picker-edit-drawer.decomp.json)
> (plan mode). · proposed · 2026-08-13 · designer (design seat, GH #845)
>
> **ADR judgment (agent-ui-doc-standards §1c) — NO ADR, stated not skipped.** The §1c test is "a
> genuine contract fork a future reader must cite", not "we built something". Every piece here is
> additive inside an already-frozen idiom: `ui-drawer` is composed byte-unmodified; the two new
> registration seams follow the S7-c frozen shape verbatim (the same additive extension
> `onResetRequest` made without an ADR); `AgentRosterEntry` gains one OPTIONAL field the component
> reads only as a visibility gate (the interface's own "page-owned identity this component does not
> know the shape of" stance is unchanged); persistence (order array, delete sweep, rename, duplicate)
> is page-owned implementation detail; and the danger styling resolves WITHOUT a `ui-button` contract
> change — the §6 investigation confirms the `--ui-button-*` custom-property chain (declared at
> `:where(ui-button)` specificity 0,0,0 precisely so a consumer can repoint it) carries the whole
> requirement, so the one fork that WOULD have earned an ADR (a fourth `variant` enum member, a real
> primitive contract change touching `scripts/generate-props.mjs` + the drift gate) is not taken. The
> two reserved sentinel values (§4) are documented as part of the seam's own contract in
> `agent-admin.md` — the descriptor is their owning home.
>
> **Composes on:** the shipped `ui-drawer` (`controls/drawer/` — `open` reflected+bindable via
> `toggle`, `edge`, `persistent`; events `close`+`toggle` only) + `ui-agent-admin`'s S7-c unified
> header (`#composeHeader`/`#applyAgentRoster`/`#applyActionAvailability`, the frozen seam family) +
> `ui-select`'s documented dynamic-adoption seam (select.md Slots note: MutationObserver adoption,
> tail-only for late nodes, `role="group"` optgroup parity) + the page's own persistence layer
> (`agent-admin-presets.ts` / `agent-admin-persona-file.ts`) + the `notify()` toast idiom
> (`agent-admin-app.ts`). **No new package, no new primitive, no `ui-button`/`ui-menu`/`ui-select`/
> `ui-drawer` source change anywhere in this plan.**
>
> **Freeze discipline.** §3–§8 resolve every named fork; §2 is the fan-out contract. A builder who
> cannot satisfy a ruling here STOPS and escalates — a coordinated LLD repair, never a local deviation.

## 1 · Intent

Give the agent-admin roster a management story: the header picker gains a component-owned trailing
group (divider + **New Agent** + **Edit Agents** — the first a SECOND ENTRY POINT to the one existing
Generate mint flow, never a new flow; the second opening a page-owned `ui-drawer` listing the roster
for rename / reorder / duplicate / delete), and the ACTIVE custom agent gains a danger-styled Delete
in two existing homes (the header's `…` overflow menu and the Settings model-grid fold, beside
`reset-agent-row`). Presets (`AGENT_PRESETS`) can never be deleted or renamed — their rows carry no
such affordance, structurally (the `entry-delete`/TKT-0048 precedent: "present ONLY for a non-built-in
entry"). Deleting a custom agent removes its roster record AND every persisted
`agent-admin-app.<id>.*` key, and an active agent that vanishes falls back sanely.

### 1b · The acceptance criteria, numbered (AC1–AC6 verbatim off GH #845; AC7 WIDENED to name the
`test:browser` six-shard leg explicitly, per this repo's own component-touch law — the issue's own
text stops at `npm run check && npm test` → the §2 Traces column)

- **AC1** — picker bottom: divider + "New Agent" + "Edit Agents", in that order, always present.
- **AC2** — "New Agent" mints via the existing Generate flow; no new creation flow.
- **AC3** — "Edit Agents" opens a drawer listing all roster entries; custom rows have a delete
  affordance; preset rows have none (structurally absent — ruled in §7, matching the drawer intake's
  page-owned-content fence).
- **AC4** — delete removes the roster record AND cleans persisted store/localStorage keys (no
  orphaned `PERSIST_PREFIX` state); an active agent falling to a deleted id falls back sanely.
- **AC5** — custom agents show Delete in BOTH homes (overflow-menu item + config-surface danger
  button), danger intent per token roles; presets show neither.
- **AC6** — rename (custom only) · reorder (persisted, drives picker order) · duplicate (any agent →
  new editable custom copy, source never mutated).
- **AC7** — `npm run check && npm test` green by exit codes + `npm run test:browser` (six shards),
  since `ui-agent-admin`'s own contract is touched.

## 2 · Components (build slices)

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | `AgentRosterEntry` gains `deletable?: boolean` (optional; absent ⇒ protected) — the page-side meaning ("custom") stays page-owned | `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` | AC5 |
| LLD-C2 | the picker's trailing group — two sentinel constants + a `role="group" label="Manage"` block re-composed at the TAIL of `#applyAgentRoster`'s wipe-and-rebuild on EVERY call (§4); wipe widened to also remove the previous group | `agent-admin.ts` (`#applyAgentRoster`) | AC1 |
| LLD-C3 | sentinel interpretation INSIDE the select listener (`#composeHeader`) — restore `value = activeId` first, then invoke the matching seam; real ids forward to `#agentSelectCallback` unchanged | `agent-admin.ts` (`#composeHeader`) | AC1, AC2 |
| LLD-C4 | `onEditAgentsRequest(callback: () => void)` — new S7-c-family seam, shape byte-per-byte per §3 | `agent-admin.ts` | AC3 |
| LLD-C5 | `onDeleteAgentRequest(callback: (id: string) => void)` — new seam; the callback receives the ACTIVE entry's id at invoke time | `agent-admin.ts` | AC5 |
| LLD-C6 | overflow-menu third item (`data-value="delete-agent"`, label "Delete Agent") + the two-axis gate in `#applyActionAvailability` (§5); `setAgentRoster` now also calls `#applyActionAvailability()` | `agent-admin.ts` | AC5 |
| LLD-C7 | `delete-agent-row` on the config surface — `reset-agent-row`'s exact shape (`[label | spacer | button]`, WHOLE ROW hidden per GH #709), a further sibling in the same `settingsItem('model', …)` call, gated on the same two-axis rule | `agent-admin.ts` (`#compose`) | AC5 |
| LLD-C8 | danger intent styling — `--ui-agent-admin-danger-*` roles minted in the token block off `--md-sys-color-danger-*`, consumed by the `[data-part='delete-agent-button']` `--ui-button-*` repoint + the overflow item rule (§6) | `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` | AC5 |
| LLD-C9 | `agent-admin.md` descriptor — new Parts (`roster-actions`, `roster-action`, `delete-agent-row`, `delete-agent-label`, `delete-agent-button`, the overflow item noted on `overflow-menu`) + the two new seams and `deletable` + the reserved sentinel values in "## Registration seams" | `agent-admin.md` | AC1, AC3, AC5 |
| LLD-C10 | component test legs — jsdom (`agent-admin.test.ts`): tail-adoption regression (group last after a SECOND `setAgentRoster`), sentinel invoke + value restore + no `#agentSelectCallback` leak, structural omission when unregistered, two-axis gating both homes, id-carrying delete callback; browser (`agent-admin.browser.test.ts`): real-engine picker flow | `agent-admin.test.ts`, `agent-admin.browser.test.ts` | AC1, AC2, AC5, AC7 |
| LLD-C11 | roster order persistence — `ROSTER_ORDER_KEY`, `loadRosterOrder()`/`saveRosterOrder(ids)` (fail-closed), `personaRoster()` applies the order (§8a) | `site/pages/agent-admin-presets.ts` | AC6 |
| LLD-C12 | `deleteImportedPersona(persona): boolean` — imported-only guard; composes `resetPersona` + `IMPORTED_PERSONAS_KEY` array-filter + order-array cleanup (§8b) | `agent-admin-presets.ts` | AC4 |
| LLD-C13 | `renameImportedPersona(persona, label): boolean` — imported-only; rewrites the library record's `label` via the existing last-write-wins save (§8c) | `agent-admin-presets.ts` | AC6 |
| LLD-C14 | `duplicatePersonaFrom(source, store, taken): Persona` — `exportPersonaFile` snapshot → `mintIdentity` extended with a `'copy'` tag (§8d); saved through `saveImportedPersona` (stamps `imported: true` ⇒ deletable by construction) | `site/pages/agent-admin-persona-file.ts` | AC6 |
| LLD-C15 | the page composition — drawer mount + row verbs + `refreshRoster()` + the two new seam registrations + `deletable` in `pushRoster` + the active-deleted fallback + `notify()` feedback (§7) | `site/pages/agent-admin-app.ts` | AC2, AC3, AC4, AC6 |
| LLD-C16 | drawer content styling — row layout + the page-side danger repoint for row delete buttons, danger role tokens only | `site/pages/agent-admin-app.css` | AC3, AC5 |
| LLD-C17 | page test legs — presets suite (order/delete/rename), persona-file suite (duplicate), app jsdom suite (drawer wiring, fallback), app browser suite (end-to-end delete) | `agent-admin-presets.test.ts`, `agent-admin-persona-file.test.ts`, `agent-admin-app.test.ts`, `agent-admin-app.browser.test.ts` | AC3, AC4, AC6, AC7 |
| LLD-C18 | gates — `npm run check && npm test` + `npm run test:browser` (six sequential shards), judged by exit codes | — | AC7 |

## 3 · The two new seams (frozen signatures)

```ts
// agent-admin.ts — the S7-c family shape VERBATIM (callback registration, never a CustomEvent;
// last registration wins; safe before OR after connect via the setter's own reflect call):
onEditAgentsRequest(callback: () => void): void   // registers #editAgentsRequest; reflect: #applyAgentRoster() + #applyActionAvailability()
onDeleteAgentRequest(callback: (id: string) => void): void  // registers #deleteAgentRequest; reflect: #applyActionAvailability()
```

- `onEditAgentsRequest` carries no argument — the drawer is one page surface, not per-agent.
- `onDeleteAgentRequest` carries the ACTIVE entry's id, read from `#pendingRoster` at invoke time
  (`this.#pendingRoster?.activeId`). Reset passes nothing because "reset" can only mean the active
  agent; delete hands the id over so the page's ONE `deleteAgent(id)` handler is shared verbatim by
  all three delete affordances (overflow item, config row, drawer rows) — the drawer rows call it
  directly (page-owned content, no seam), the component's two homes reach it through this seam.
- `onNewAgentRequest` is NOT duplicated: the picker's "New Agent" item invokes the EXISTING seam —
  the same `createGeneratedAgent()` registration the header button already drives (AC2's "no new
  flow" holds by construction; GH #681/#686 ruled Generate the only front door).
- New Agent's degrade stays ONE registration driving now-three renderings (wide button, narrow `+`,
  picker item) — the descriptor's "one seam drives both renderings" sentence widens to three.

## 4 · The picker group — the tail-adoption fork, resolved (the trickiest wrinkle)

**Constraint (select.md Slots note, source-verified):** once earlier options have relocated into the
panel, a newly-adopted `[role=option]`/`[role=group]` child ALWAYS lands at the panel's tail; and
`#applyAgentRoster` wipes + rebuilds all `[role="option"]` descendants on every `setAgentRoster`. A
one-time static group would therefore end up ABOVE freshly re-adopted roster options after the first
re-push. **Ruling: option (a) from the intake — the group joins the wipe-and-rebuild.** Every
`#applyAgentRoster` run: (1) remove all `[role="option"]` descendants (the existing loop — it also
catches the group's nested items) plus the previous group shell
(`select.querySelector('[data-part="roster-actions"]')?.remove()`); (2) append the roster options in
entry order; (3) build a FRESH `<div role="group" label="Manage" data-part="roster-actions">` and
append it LAST — tail adoption then lands it at the bottom by the same mechanism that would otherwise
break it. No second idiom, no select change.

- **Divider vehicle — the `role="group"` optgroup, ruled over a separator.** `select.ts` adopts ONLY
  `option`/`group` roles (the `#adoptChild` gate) — a bare `role="separator"` node would never enter
  the panel without a `ui-select` change, which this ticket does not earn. The group's control-created
  `group-label` header ("Manage", non-interactive, non-focusable, aria-labelledby'd) IS the divider +
  label. An optional top hairline on `[data-part='roster-actions']` in agent-admin.css (own-chain
  token off `--md-sys-color-neutral-outline-variant`) sharpens it; cosmetic, builder's call.
- **Sentinel values (reserved, descriptor-documented):** `'agent-admin:new-agent'` and
  `'agent-admin:edit-agents'` as module constants. Non-colliding by construction against the page's
  id grammar (persona ids are `slug()`-minted `[a-z0-9-]` — a colon cannot survive the slug), and the
  descriptor names them reserved: a consumer must not use them as `AgentRosterEntry.id`s.
- **Interpretation INSIDE the component** (`#composeHeader`'s select listener): the items are
  component-owned structure, so the page never sees a fake id. Ordering is load-bearing — restore
  FIRST, invoke SECOND, so a callback that itself re-pushes the roster (New Agent mints →
  `applyPersona` → `pushRoster`) wins last:

```ts
agentSelect.addEventListener('select', (event) => {
  event.stopPropagation()
  const id = (event as CustomEvent<string>).detail
  if (id === AGENT_SELECT_NEW || id === AGENT_SELECT_EDIT) {
    agentSelect.value = this.#pendingRoster?.activeId ?? ''  // silent programmatic write (ADR-0019) — the trigger label reverts
    if (id === AGENT_SELECT_NEW) this.#newAgentRequest?.()
    else this.#editAgentsRequest?.()
    queueMicrotask(() => this.#applyAgentRoster())  // see the residue note below
    return  // never forwarded — #agentSelectCallback sees only real ids
  }
  this.#agentSelectCallback?.(id)
})
```

- **Ordering is safe at source, and one residue is owed.** `selectionCommit`'s `publish()` invokes
  the host's `onSelect` (which writes `this.value = key`, select.ts) BEFORE it emits `select` — so
  the listener's restore runs after the trait's own value write and wins, and the trigger label
  reverts through the label effect's reactive re-run. What the restore does NOT rewrite is the
  trait's internal committed key + the sentinel option's `aria-selected` reflection. The queued
  `#applyAgentRoster()` re-run above clears that wholesale — fresh nodes, the exact state a fresh
  roster push produces (the shipped baseline) — queued, not inline, so the wipe never yanks the
  clicked option out from under the still-dispatching commit path.

- **Degrade is structural omission, not `[hidden]` — a stated divergence with a mechanical reason.**
  The select's live `items()` accessor (select.ts's "Live option accessor", re-read by the
  roving/commit traits per event) does not filter `[hidden]` options,
  so a hidden sentinel would stay arrow-key-reachable (focus on a `display:none` node no-ops —
  a dead stop in the roving order). Since the group is re-composed on every `#applyAgentRoster` run
  anyway, the availability law becomes: compose each item only while its seam is registered; omit the
  whole group when neither is. Registration setters re-run `#applyAgentRoster()` so late
  registration composes the items (the before-OR-after-connect law holds). The overflow items keep
  their shipped `hidden`+`aria-disabled` idiom — theirs rides `ui-menu`, and it is shipped, probed
  behavior.
- **Closes the ticket's own open question** (GH #845 Scope/Open: "whether the picker's new items
  live inside the same `ui-menu` listbox semantics… needs the component-standards check — the
  event-name law (`action`) applies"): they do not — the picker is `ui-select`, not `ui-menu`, and
  the sentinel items ride the SAME `select` event every other option already emits (a role=option
  child, never a synthesized `action` event); nothing new joins the fixed event-name set.
- **"Always present" (AC1), read precisely:** the items are an always-composed structural part of
  `ui-agent-admin` for every consumer (never page content), present on every roster refresh — and
  `#applyAgentRoster`'s early-return guard LOOSENS from "no pending roster ⇒ do nothing" to "no
  pending roster ⇒ entries = []", so a registered consumer that never pushed a roster still shows
  the group. In the one shipped composition both seams are always registered, so the reported
  surface satisfies AC1 unconditionally; an unwired static build degrades by the same S7-c law every
  other action affordance already follows.

## 5 · The two-axis Delete gate (component side)

`#applyActionAvailability` gains one derived input — the ACTIVE entry:

```ts
const active = this.#pendingRoster?.entries.find((e) => e.id === this.#pendingRoster?.activeId)
const deleteHidden = this.#deleteAgentRequest === undefined || active?.deletable !== true
```

- The overflow `delete-agent` item and the WHOLE `delete-agent-row` both take `deleteHidden` (the
  row per GH #709 — never just its button; the item also mirrors `aria-disabled`, the import/export
  items' exact idiom). Presets (`deletable` absent) and unregistered-seam consumers converge on the
  same hidden state — AC5's "presets show neither" falls out of the axis, not a special case.
- `setAgentRoster` calls `#applyActionAvailability()` after `#applyAgentRoster()` — the deletable
  axis changes with every roster push/active switch, not only at seam registration. (`#compose`'s
  tail already calls both.)
- The overflow trigger's own hide rule widens: it hides only when Import AND Export AND Delete are
  all hidden.
- `delete-agent-row` composition (`#compose`, beside `resetAgentRow`): a fifth argument in the same
  `settingsItem('model', 'Model', modelGrid, resetAgentRow, deleteAgentRow)` call (variadic
  `...content`), NEVER inside `model-grid` (wholesale-`replaceChildren`d per re-render). Copy per the
  NOUN-label/VERB-button law: label **"This agent"**, button **"Delete Agent"**
  (`variant="soft"` + the §6 repoint). Button click → `this.#deleteAgentRequest?.(activeId)` with
  the id read at click time.

## 6 · Danger styling — confirmed: repoint, never a fourth variant

Verified in this repo: `button.md`'s `variant` enum is `[solid, soft, ghost]`; `button.props.gen.ts`
is GENERATED from it (ADR-0173), so a fourth member is a real primitive contract change (generator +
drift gate + per-variant CSS) — out of this ticket's blast radius, and unneeded. `button.css`
declares `--ui-button-{bg,bg-hover,bg-active,ink,border}` at `:where(ui-button)` (specificity 0,0,0)
and repoints them per `[variant]` — the documented consumer seam. The color law
(`tokens.md` §Consumption invariants; the raw-value ban is "consume `--md-sys-color-{family}-{role}`
roles" — values live only in tokens.css; the dimensional own-chain trip-wire is
`styling-gates.test.ts`, which sweeps app CSS too but bans only dimensional direct reads) and the
`entry-list.css` error-ink precedent (`--ui-entry-list-error-ink: var(--md-sys-color-danger-on-surface-variant, …)`)
give the shape:

```css
/* agent-admin.css [1] TOKEN BLOCK — the element's own danger roles (entry-list error-ink shape) */
:where(ui-agent-admin) {
  --ui-agent-admin-danger-bg: var(--md-sys-color-danger-container-low);
  --ui-agent-admin-danger-bg-hover: var(--md-sys-color-danger-container);
  --ui-agent-admin-danger-bg-active: var(--md-sys-color-danger-container-high);
  --ui-agent-admin-danger-ink: var(--md-sys-color-danger-high);
  --ui-agent-admin-danger-item-ink: var(--md-sys-color-danger-on-surface-variant);
}
/* [2] STYLES BLOCK — the soft-variant primary mapping, one family over (button.css [variant=soft]
   maps primary-container-low/-container/-container-high + primary-high; this mirrors it exactly) */
[data-part='delete-agent-button'] {
  --ui-button-bg: var(--ui-agent-admin-danger-bg);
  --ui-button-bg-hover: var(--ui-agent-admin-danger-bg-hover);
  --ui-button-bg-active: var(--ui-agent-admin-danger-bg-active);
  --ui-button-ink: var(--ui-agent-admin-danger-ink);
}
[data-part='overflow-menu'] [data-value='delete-agent'] {
  color: var(--ui-agent-admin-danger-item-ink);
}
```

- The menu item's hover surface: if `menu.css` exposes a per-item hover custom property, repoint it
  to `--ui-agent-admin-danger-bg`; if hover styling is a fixed generic rule, the danger INK alone
  carries the intent (the entry-list precedent is ink-only too). Builder verifies against `menu.css`
  and states which in the build notes — either way no `ui-menu` source change.
- ADR-0057 (intent never travels by color alone): the non-color signifier is the verb itself —
  "Delete Agent" / "Delete" labels, matching `entry-delete`'s wordmark precedent. No icon owed.
- The drawer rows' delete buttons are page content — the SAME repoint lives in `agent-admin-app.css`
  keyed on the page's own row classes, danger role tokens only (the raw-value ban binds there too).
- **This is the first danger-styled button/menu-item in the fleet** — deliberately shipped as a
  consumer-side repoint so no primitive contract moves. If a second consumer wants it later,
  promoting the mapping into a real `ui-button` variant is THAT wave's ADR, not this one's.

## 7 · The Edit Agents drawer (page-owned composition — `agent-admin-app.ts`)

One `<ui-drawer edge="end">` with `aria-label="Manage agents"` (forwarded to the dialog part by the
control), appended beside `toasts` at boot, content REBUILT on every open (`onEditAgentsRequest` →
rebuild + `drawer.open = true`) and after every mutation. The drawer is opaque to the control
(ADR-0188 intake §6); every row is page markup. `agentRosterDrawerSeed` (catalog-coverage.ts) is the
shape sketch only — a Button opening an end-docked Drawer over a row list; this composition is real
DOM, not A2UI.

- **Rows, in picker order** (the fresh ordered `personaRoster()` read):
  `[ up · down | label — or the inline rename field | spacer | duplicate | delete? ]` — all
  `ui-button`s (`ghost`, icon-only where iconed, real `aria-label`s naming the agent: "Move Fable up").
- **Reorder — up/down buttons, ruled over drag-and-drop:** keyboard-accessible with zero new
  primitives (no fleet DnD trait exists; inventing one is out of scope). A press swaps the two ids in
  the order array, `saveRosterOrder`, `refreshRoster()` (AC6's "drives picker order" is the
  `pushRoster` inside it). First row's up / last row's down: disabled. No toast — the row visibly moves.
- **Rename (custom rows only):** a pencil `ui-button` swaps the label for a `ui-text-field` seeded
  with the current label; Enter or the confirm button commits (`renameImportedPersona` → toast
  `Renamed "X" to "Y".`), Escape reverts. Page-side validation: trimmed non-empty + not colliding
  with another entry's label (reject → `notify(…, true)`, field stays). Preset rows render a plain
  label — no pencil, structurally.
- **Duplicate (every row):** `duplicatePersonaFrom(p, personaStore(p), [...personaRoster(), ...roster])`
  → `saveImportedPersona(dup)` → `refreshRoster()` → toast `Duplicated "X" as "Y".` Captures the
  CURRENT edited store state (the export snapshot, §8d), never the seed — and never mutates the
  source; a duplicated PRESET becomes an ordinary custom agent (deletable/renamable) because
  `saveImportedPersona` stamps `imported: true` unconditionally. Appends at the roster's end.
- **Delete (custom rows only, danger-styled):** `deleteAgent(p.id)` — the ONE page handler all three
  delete affordances share: `deleteImportedPersona` → if the deleted id was `active.id`, `applyPersona`
  on the fresh ordered `personaRoster()[0]` (never empty — presets are undeletable; in the default
  order that IS the first preset, AC4's own example) → `refreshRoster()` → toast `Deleted "X".`
  No confirm dialog in v1: delete is drawer-or-menu-deep (never one stray click), and the fleet has
  no confirm primitive to compose — named in §9, not silently skipped.
- **`refreshRoster()`** — the one page choke point after any mutation: splice-replace the in-memory
  `roster` array's contents from the fresh ordered `personaRoster()` (the array is a captured `const`
  — replace contents, not the binding), `pushRoster(active.id)`, and rebuild the drawer list if open.
- **Seam registrations** (beside the existing six): `admin.onEditAgentsRequest(openDrawer)` and
  `admin.onDeleteAgentRequest((id) => deleteAgent(id))`. `pushRoster` widens one line:
  `{ id: p.id, label: p.label, deletable: p.imported === true }`.

## 8 · Persistence mechanics (`agent-admin-presets.ts` / `agent-admin-persona-file.ts`)

**a · Reorder — a persisted explicit order array, ruled over widening the library record.** A
same-record order cannot order PRESETS relative to imported entries (presets never live in
`IMPORTED_PERSONAS_KEY`), and AC6 reorders the whole roster. So: `ROSTER_ORDER_KEY =
`${PERSIST_PREFIX}.rosterOrder`` holding `string[]` (ids, display order). `loadRosterOrder()`
fail-closed like `loadImportedPersonas` (corrupt/foreign ⇒ `[]`); `saveRosterOrder(ids)`.
`personaRoster()` ITSELF applies it (one choke point — every caller, this page or another, sees one
order): listed ids first in stored order (ids no longer present skipped), unlisted entries appended
in the natural order (presets first, then imports in import order — so a fresh mint/import lands at
the end and an absent/empty order array reproduces today's byte-exact order).

**b · Delete — composes `resetPersona`, plus the two records reset deliberately leaves.**
`deleteImportedPersona(persona): boolean` — guard `persona.imported !== true ⇒ false` (fail-closed;
the page never offers the affordance for presets, this is defense in depth). Then: (1)
`resetPersona(persona)` — the existing prefix sweep already removes every
`agent-admin-app.<id>.*` key INCLUDING the seedVersion marker (it lives inside the namespace by
design) and drops the `storeCache` entry; (2) rewrite `IMPORTED_PERSONAS_KEY` filtering the id (the
record `resetPersona`'s own contract deliberately does not touch — "back to shipped state", not
"gone"); (3) `saveRosterOrder(loadRosterOrder().filter(id => id !== persona.id))`. Not a from-scratch
sweep: `resetPersona` is the tested key-sweep and delete = reset + forget-the-records, stated as such.
`ACTIVE_PRESET_KEY` is NOT this function's concern — the page's fallback `applyPersona` rewrites it.

**c · Rename —** `renameImportedPersona(persona, label): boolean` — imported-only guard, then
`saveImportedPersona({ ...current, label })` where `current` is the live library record re-read via
`loadImportedPersonas()` (never the caller's possibly-stale object): last-write-wins on id, the
record's `seed` bytes untouched (edits live under the store keys, not the record). Survives reload
because the record IS what `personaRoster()` reads at boot; no store key is touched, so no
page-reload semantics anywhere.

**d · Duplicate —** in `agent-admin-persona-file.ts` (where the snapshot + mint machinery lives):
`duplicatePersonaFrom(source: Persona, store: SettingsStore, taken: readonly Persona[]): Persona` =
`exportPersonaFile(source, store)` (the CURRENT persisted state, exactly what an export would carry)
→ the `importedPersonaFrom` construction with `mintIdentity`'s tag union extended
`'imported' | 'new' | 'copy'` — id `${base}-copy[-n]`, label `${label} (copy[ n])` — the ONE existing
collision loop, not a second scheme. The caller persists via `saveImportedPersona` (stamps
`imported: true` ⇒ deletable/renamable by the same construction imports get).

## 9 · Failure/edge summary (cross-cutting)

- **Sentinel pick with no roster ever pushed** — `activeId` restore writes `''` (placeholder state),
  seams still fire; the loosened guard (§4) keeps the group composed.
- **Roster re-push while the drawer is open** — `refreshRoster()` rebuilds the drawer list; row nodes
  are stateless between rebuilds except an in-flight rename field, which a rebuild drops — acceptable
  (rename is a short gesture; a lost draft is re-typed, never corrupted).
- **Deleting a NON-active custom agent** — no `applyPersona`, active store untouched; only records +
  keys for the deleted id go.
- **Two tabs** — the library/order records are last-write-wins localStorage (the shipped import
  semantics); no new cross-tab protocol is introduced or owed here.
- **A future `AgentRosterEntry` consumer omitting `deletable`** — absent reads protected;
  fail-closed by the §5 axis.
- **No delete confirm step (v1)** — named, not hidden: the affordance is two levels deep in both
  homes and the drawer; if Kim wants an undo/confirm later it is a page-side addition (a toast with
  an undo action is the natural shape), no component change.
- **Order array naming a ghost id** (deleted elsewhere/corrupt) — skipped by the §8a filter; a ghost
  entry can never resurrect.

## 10 · Gates (the definition of done)

`npm run check && npm test` green BY EXIT CODES (CLAUDE.md's grep ban) — the component suites
(LLD-C10: the tail-adoption regression is the load-bearing probe — TWO `setAgentRoster` calls, then
assert the panel's LAST child is still the group; plus sentinel/no-leak, omission-when-unregistered,
two-axis gating, id-carrying callback) and the page suites (LLD-C17: order round-trip + ghost-id
filter, delete sweep proven by enumerating `localStorage` for the prefix AND the library/order
records, rename persistence, duplicate snapshot-equality + source-untouched + collision suffixes,
active-deleted fallback to `personaRoster()[0]`). `npm run test:browser` (six sequential shards,
never re-monolithed): the real-engine picker leg (open select → click "Edit Agents" → seam fires +
trigger label reverts to the active agent) and the end-to-end drawer delete leg (open drawer →
delete a custom agent → row gone + keys gone + active fallback applied). Descriptor drift: the
`agent-admin.md` Parts/seams additions land in the SAME slice as the code (LLD-C9), per the
descriptor-mirrors-source law.
