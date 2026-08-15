# Bindings · actions · checks — the dynamic wiring

Data flow (model ↔ control), user intent (actions), and reactive validity (checks). Ground truth:
`packages/agent-ui/a2ui/src/protocol.ts` (`Binding`, `FunctionCall`, `A2uiAction`, message envelopes) and
`packages/agent-ui/a2ui/src/renderer/checks.ts` (the two accepted `checks` shapes). Real usage: the seed shelf
under `packages/agent-ui/a2ui/src/examples/`.

**Re-derive the cites here whenever `protocol.ts`, `renderer/checks.ts`, `catalog.json`, or the seed shelf
changes** — the CLI catches a stale payload, not a stale line number.

## The three message envelopes you compose
Server→client, each tagged `version: "v1.0"` (`protocol.ts:116-150`):
- **`createSurface`** — `{ surfaceId, catalogId, sendDataModel? }`. ALWAYS first. `sendDataModel:true` makes a
  triggered action carry the live data model back (`generative-form.ts:35-36`).
- **`updateComponents`** — `{ surfaceId, components: A2uiComponent[] }`. The adjacency list; may be split across
  many messages (out-of-order tolerant — `references/trees-and-lists.md`).
- **`updateDataModel`** — `{ surfaceId, path?, value }`. Seeds/updates the model bound paths read. Emit the
  initial model BEFORE or alongside the components that bind it (`patterns.ts:22-27`).

## Bindings — `Binding<T>` (`protocol.ts:76-93`)
A bindable prop's value is one of:
- a **literal** (`"Save"`, `true`, `50`);
- a **`{ path }`** — a JSON-Pointer (RFC 6901); ABSOLUTE `"/settings/plan"` from root, or RELATIVE (no leading
  `/`) inside a list item (`references/trees-and-lists.md`);
- a **`{ call, args? }`** `FunctionCall` — evaluated at render time (used in `checks`; see below).

Only props the catalog marks `"bindable": true` accept a Binding (`references/node-idioms.md`); others are literal-only.

### Two-way binding
A control with a `value: { prop, event }` block round-trips: when its mapped prop is bound to a `{path}`, user
edits write back to that path. The bindable prop is the control's OWN prop, not a generic `value` (ADR-0053):
TextField `value`/`change`, Checkbox·Switch `checked`/`change`, Select `value`/`select`, Tabs `selected`/`select`,
Modal `open`/`toggle` (`catalog.json` value blocks). An editable list is a template of two-way controls over
relative paths (`dynamic-lists.ts:109-110`).

## Actions — Button intent (`catalog.json:17-28`, `protocol.ts:166-176`)
`action: { action: string /* REQUIRED */, context?, wantResponse? }`, plus the client-only `submit` flag:
```json
{ "id": "btn_delete", "component": "Button", "variant": "solid", "label": "Delete workspace",
  "action": { "action": "confirm_delete", "wantResponse": true } }
```
- **`action`** — the intent NAME the client emits (`A2uiAction.name`). Destructive intent lives in the name +
  wording — there is no danger variant (`patterns.ts:1-8`).
- **`wantResponse: true`** — ask the server to reply (an `actionResponse` round-trips back).
- **`submit: true`** — a CLIENT-consumed FormProvider gate flag (ADR-0054). It never reaches the wire — the
  emitted `action` is byte-identical to a plain one (`generative-form.ts:140-141,148`). It only marks the button
  as the form's submit so the provider can block it while invalid.

## Checks — reactive validity (`renderer/checks.ts:1-20`)
A control's `checks` is an array of `FunctionCall`-shaped entries whose `call` names a catalog function
(`required`, `email`, `regex` — `catalog.json:186-201`). TWO wire shapes are accepted (Postel, `checks.ts:6-9`):
- **FLAT** (the TextField idiom): `{ call, args?, message }`
- **CONDITION-wrapped** (the Button idiom): `{ condition: { call, args }, message }`
```json
{ "id": "in_name", "component": "TextField", "name": "name", "required": true, "value": { "path": "/form/name" },
  "checks": [ { "call": "required", "args": { "value": { "path": "/form/name" } }, "message": "Name is required" } ] }
```
Semantics (`checks.ts:12-20`): a check returning falsy surfaces its `message`; on a TextField it sets
customValidity, on a Button it disables the button. `email('')` is VALID — an empty value is not a format error,
so pair `email` with `required` when the field is mandatory (`generative-form.ts:79-88`).

## FormProvider submit gating (ADR-0054)
Wrap the form's column in a `FormProvider`; give required controls `required:true`; flag the submit Button's
action `submit:true`. The provider aggregates descendant validity and blocks the submit-flagged action until the
whole form is valid. Loading the model with empty required fields is what makes a blocked-submit demo live
(`generative-form.ts:53-55,60`). Real end-to-end: `generative-form.ts`, `patterns.ts:36-54` (settings).

## A minimal well-formed payload (all three envelopes)
```json
[
  { "version": "v1.0", "createSurface": { "surfaceId": "s", "catalogId": "agent-ui", "sendDataModel": true } },
  { "version": "v1.0", "updateDataModel": { "surfaceId": "s", "value": { "form": { "name": "" } } } },
  { "version": "v1.0", "updateComponents": { "surfaceId": "s", "components": [
    { "id": "root", "component": "Card", "children": ["c"] },
    { "id": "c", "component": "CardContent", "children": ["f"] },
    { "id": "f", "component": "Field", "label": "Name", "child": "in" },
    { "id": "in", "component": "TextField", "name": "name", "required": true, "value": { "path": "/form/name" } }
  ] } }
]
```
Run it through the validate-payload CLI before trusting it (`SKILL.md` — the bounded loop).
