# Case study — the agent-select label never tracks the config panel's Name field

> Slice 2 of the data-model review (2026-08-20). The motivating symptom: Kim's screenshot shows
> the header select-menu still reading "New agent 48" while the Agent panel's Name field says
> "Wrench". Read-only investigation by a dedicated reader session.

**Bottom line: never wired.** The top-left select-menu and the "Agent" panel's Name field
read/write two completely separate data domains. No debounce or blur-delay explains it — even
after the Name field commits, nothing downstream ever tells the picker.

## 1. Where the select-menu's label comes from

`site/pages/agent-admin-app.ts:228-240` — `pushRoster(activeId)` builds roster entries straight
from `persona.label` and calls `admin.setAgentRoster(entries, activeId)`.

`persona.label` is set exactly once, at mint time, in `mintBlankPersona`
(`site/pages/agent-admin-persona-file.ts:323-338`) — the collision-suffixed "New agent 48" comes
from there. After that it changes ONLY through the roster drawer's dedicated rename affordance:
`beginRename` → `renameImportedPersona` (`agent-admin-app.ts:1035-1062`,
`agent-admin-presets.ts:986-996`). `pushRoster` fires on persona switch/mint/import/delete/
reorder/rename (`agent-admin-app.ts:254, 347, 546, 713, 1023`) — never on a generic field edit.

`renameImportedPersona`'s own doc comment states the separation
(`agent-admin-presets.ts:978-981`): a rename touches only the library record's `label`; "no
store key is written at all (edits live under the `agent-admin-app.<id>.*` keys, not in the
record)."

## 2. Where the Name field writes

Schema-driven, not roster: `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts:144-151`
(`key: 'name'`, label "Name", description "The agent's display name."). Rendered by the shared
settings machinery (`settings/schema.ts:92-111`, `textFieldFactory`), committed per-field via
`settings/generate.ts:97` (`COMMIT_EVENT.text = 'change'` — blur-with-change or Enter) into
`store.set('name', value)` at `generate.ts:162-163`. That store is
`admin.store = personaStore(persona)` (`agent-admin-app.ts:335`) — a per-persona memory store,
key `'name'`, a different namespace than `persona.label`.

The only reader of that `'name'` key is agent-admin's per-turn config snapshot builder —
`AgentConfigSnapshot.name` (`agent-admin.ts:3354`, `:4141`) — feeding turn-time prompt/team-card
consumers (`agent-team-prompt.ts`, `team-agent-card.ts`), not the roster picker.

`personaStore` exposes a `subscribe` seam (`agent-admin-presets.ts:801-808`), but its one wired
subscriber only bumps a `modifiedAt` localStorage marker. Nothing subscribes for
`key === 'name'` to call `pushRoster`/`renameImportedPersona`; `agent-admin-app.ts` has no
`onFieldChange`-style hook at all.

The blur/Enter commit is real but secondary: it would explain a one-tab-out delay for consumers
that read `store.get('name')` — it does not explain this bug, because the select-menu was never
a subscriber of that key at all.

## 3. Test coverage

`agent-admin-app.browser.test.ts` (lines ~49, 83, 144, 236, 406) covers the select reacting to
persona switch, mint, import, delete; drawer-rename covered via `renameImportedPersona`. No test
anywhere edits the Agent-panel Name field and asserts the select-menu label updates — a genuine
coverage gap, not a passing-but-browser-only test.

## 4. History

`pushRoster` traces to `79e4c155` (GH #845) and `a7079600` (GH #686/S7-d — the unified header
select), keyed on `persona.label` from day one. The schema Name field predates and postdates
this unchanged, always on the separate `'name'` store key. Never unified — a standing design gap
since the roster picker's introduction, not a regression.

## 5. Related issues

- **GH #1099** (closed) — "header select shows stale agent name after drawer rename": a
  DIFFERENT, already-fixed bug inside `ui-select`'s trigger-label `Object.is` cutoff
  (`select.ts` `#syncTriggerLabel()`). Irrelevant here: in this bug `setAgentRoster` is never
  called at all — the break is one layer up, at page wiring.
- No open/closed issue matches "config-panel Name field doesn't update the roster select."

## Characterization and the fork (product call — not ruled yet)

**Wired-but-disconnected-by-design.** Two legitimately different concepts share the word "name":

- **Roster identity** (`persona.label`) — organizational identity in the picker/drawer/
  notifications; edited only via the drawer's pencil rename.
- **Turn-time agent identity** (`store.get('name')` / `AgentConfigSnapshot.name`) — what the
  agent calls itself during generation, feeding prompts and A2A team-card mapping.

Candidate fixes:

1. **Unify** — subscribe to the active persona's store (`store.subscribe`,
   `agent-admin-presets.ts:801-808`) for `key === 'name'`, and on a real change drive the same
   `renameImportedPersona` + `pushRoster` path the drawer rename uses
   (`agent-admin-app.ts:1042-1062`).
2. **Keep distinct** — reword the schema field's label/description
   (`agent-admin-schema.ts:147-148`) to make clear it is the agent's self-referential
   generation-time name, not a roster rename; the drawer's pencil stays the one way to change
   what the picker shows.
