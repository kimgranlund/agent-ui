# Trees & lists — adjacency-list construction and `ChildList` templating

How component nodes wire into a tree, and how one template node renders a whole array. Ground truth:
`packages/agent-ui/a2ui/src/protocol.ts` (`A2uiComponent`, `A2uiChildTemplate`) and the four dynamic-list
seeds in `packages/agent-ui/a2ui/src/examples/dynamic-lists.ts`.

**Re-derive the cites here whenever `protocol.ts` or the seed shelf changes** — the CLI catches stale
payloads, not stale line numbers.

## The adjacency list, not a nested tree
A surface's components are a FLAT array of `{ id, component, …props }` (`protocol.ts:106-114`). Parents name
children by their `id` STRING — the tree is an adjacency list, never physically nested JSON. Convention: the
root node's `id` is `root`. Order in the array is irrelevant; wire purely by id.

**Out-of-order tolerance.** A parent may reference child ids that are not in the array yet, or that stream in
a LATER `updateComponents` message (runtime SPEC-R4). Each unresolved ref mounts as a position-preserving
pending anchor until its node lands — this is what makes a streamed surface grow field-by-field
(`examples/generative-form.ts:6-9,39-41`). You may therefore emit the root subtree first and fill it in.

## `child` vs `children`
- **`child`** (single, string) — ONLY `Field` (`children:"child"` in `catalog.json:57`). One wrapped control:
  `{ "id":"f_x", "component":"Field", "label":"…", "child":"in_x" }`.
- **`children`** (ChildList) — every container (Row, Column, Card*, FormProvider, Select, Tabs, Modal). Either a
  STATIC id list `["a","b","c"]` or a dynamic-list TEMPLATE object (below).

## Static children
```json
{ "id": "col", "component": "Column", "gap": "md", "children": ["title","f_workspace","actions"] }
```
Real: `examples/patterns.ts:37`.

## Dynamic-list template — one node renders an array
A container whose `children` is `{ path, componentId }` (`A2uiChildTemplate`, `protocol.ts:95-104`)
instantiates the `componentId` node once per element of the array at `path`, POSITIONALLY — one instance per
index, v1.0 has NO per-item key (ADR-0024). The template node and its whole subtree are ordinary nodes in the
SAME components array; only the container's `children` differs.
```json
{ "id": "root", "component": "Column", "gap": "md", "children": { "path": "/people", "componentId": "person_card" } }
{ "id": "person_card", "component": "Card", "elevation": "1", "children": ["person_content"] }
```
Real: `examples/dynamic-lists.ts:68-69` (list-people).

### Relative vs absolute paths inside a template
Inside the instantiated subtree (`protocol.ts:97-99`):
- a **relative** binding (no leading `/`) resolves against the current item: `{ "path": "name" }` → `/people/{i}/name`;
- an **absolute** binding (leading `/`) resolves against the model root.

A leaf display list binds a relative item field directly:
```json
{ "id": "root", "component": "Row", "wrap": true, "children": { "path": "/tags", "componentId": "tag_chip" } }
{ "id": "tag_chip", "component": "Text", "variant": "body", "text": { "path": "name" } }
```
Real: `examples/dynamic-lists.ts:32-33` (list-display).

### Nested lists
A template item can hold its OWN template, keyed on a relative path — the inner list resolves under the outer
item (`/sections/{i}/items`):
```json
{ "id": "items_row", "component": "Row", "wrap": true, "children": { "path": "items", "componentId": "item_chip" } }
```
Real: `examples/dynamic-lists.ts:145,151` (list-nested).

### Interactive lists round-trip
A template whose control binds a relative `value` path sends edits back into the model per item — an editable
list is just a template over TextFields (`examples/dynamic-lists.ts:109-110`, list-form).

## `${…}` DynamicString interpolation
Compose ONE string prop from one or more paths inline with `${…}` (ADR-0027) — distinct from a single
`{path}` bind. Use it to build a label from multiple item fields; relative paths inside a template item apply.
```json
{ "id": "person_name", "component": "Text", "variant": "h5", "text": "${name} — ${role}" }
{ "id": "tile_value", "component": "Text", "variant": "h3", "text": "${value}${unit}" }
```
Real: `examples/dynamic-lists.ts:73-74` (people), `examples/patterns.ts:186-187` (dashboard tiles).

## Choosing between them
- Fixed, known children → static id list.
- One shape repeated over a data array → a template (`{path, componentId}`).
- A label built from several fields → `${…}` interpolation on a Text/Button `text`/`label`.
- A single value that changes → a `{path}` bind on a bindable prop.
