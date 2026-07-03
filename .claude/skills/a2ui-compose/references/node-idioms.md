# Node idioms — one card per default-catalog type

The idiomatic node shape for each component the default `agent-ui` catalog declares. Ground truth,
never restate from memory:

- **Props / `mapsTo` / `value` blocks / children-kind** — `packages/agent-ui/a2ui/src/catalog/default/catalog.json`.
- **Wire node shape** (`A2uiComponent`, `Binding`, `A2uiChildTemplate`) — `packages/agent-ui/a2ui/src/protocol.ts`.
- **Real usage** — the 11-seed shelf under `packages/agent-ui/a2ui/src/examples/`.

**Re-derive these cards and their line cites whenever `catalog.json`, `protocol.ts`, or the seed shelf
changes** — the validate-payload CLI catches stale content at compose time, not a stale cite.

A node is one flat adjacency-list entry: `{ id, component, …props, child? | children? }` (`protocol.ts:106-114`).
Only props the catalog marks `"bindable": true` accept a `{path}`/`{call}` `Binding`; all others take a
literal. A prop with a `value: { prop, event }` block is a two-way surface — see `references/bindings-actions-checks.md`.

---

## Text — display leaf
`catalog.json:5-10`. Props: `text` (bindable → `textContent`), `variant` ∈ `h1 h2 h3 h4 h5 caption body`.
`text` takes a literal, a `{path}`, or a `${…}` interpolation template (`references/trees-and-lists.md`).
```json
{ "id": "title", "component": "Text", "variant": "h4", "text": "Workspace settings" }
{ "id": "tile_label", "component": "Text", "variant": "caption", "text": { "path": "label" } }
```
Real: `examples/patterns.ts:38` (literal), `examples/dynamic-lists.ts:33` (`{path}`), `patterns.ts:186` (`${…}`).

## Button — action leaf
`catalog.json:12-30`. Props: `label` (bindable → `textContent`), `variant`, `disabled` (bindable),
`action` (object: `action` REQUIRED, optional `context`, `wantResponse`). The fleet has NO danger tone —
a destructive intent is carried by the action NAME + wording, not a red variant (`patterns.ts:1-8, 84-86`).
`action.submit` is a client-only FormProvider gate flag (ADR-0054), not a catalog prop —
see `references/bindings-actions-checks.md`.
```json
{ "id": "btn_save", "component": "Button", "variant": "solid", "label": "Save settings",
  "action": { "action": "save_settings", "submit": true } }
```
Real: `examples/canvas-button.ts:27`, `examples/generative-form.ts:148`, `examples/patterns.ts:85-86`.

## TextField — text/number/date/time input
`catalog.json:32-50`. `value: { prop:"value", event:"change" }` (two-way). Bindable: `value`, `label`,
`placeholder`, `disabled`, `required`. Plain: `size` (`sm md lg`), `readonly`, `name`, `type`, `currency`,
`unit`, `step`, `min`, `max`. `type` ∈ `text email url tel password search number currency unit percent date time`.
A `checks` array (reactive validity, `{call,args,message}`) is a protocol feature, not a catalog row —
`references/bindings-actions-checks.md`.
```json
{ "id": "in_budget", "component": "TextField", "name": "budget", "type": "currency",
  "currency": "EUR", "step": 50, "min": "0", "value": { "path": "/form/budget" } }
```
Real: `examples/generative-form.ts:72-73` (value + `checks`), `:102` (currency/step/min),
`examples/patterns.ts:221,223` (`type:"date"` / `type:"time"`, ISO-canonical model values).

## Field — labelled single-child wrapper
`catalog.json:52-58`. `children: "child"` — ONE child by the `child` key (not `children`). Props `label`,
`description` (both bindable). The `label` becomes the wrapped editor's accessible name (ADR-0051 seam) —
wrap every labelled control in a Field rather than setting a control-level label.
```json
{ "id": "f_email", "component": "Field", "label": "Email", "description": "We reply within a day", "child": "in_email" }
```
Real: `examples/generative-form.ts:70,85`, `examples/patterns.ts:39`.

## FormProvider — validity + submit gate
`catalog.json:60-63`. `children: "ChildList"`, no props. Wrap a form's column; it aggregates descendant
control validity and blocks any `submit:true` action until the aggregate is valid (ADR-0054). Pair
`required` controls + a submit button beneath ONE provider.
Real: `examples/patterns.ts:36` (`FormProvider > Column`), `examples/generative-form.ts:49`.

## Checkbox / Switch — boolean controls
`catalog.json:65-84`. Both `value: { prop:"checked", event:"change" }`. Bindable `checked`, `disabled`;
`label` maps to `textContent`; `name`; Checkbox also `required`. The bindable prop is the control's OWN
prop name (`checked`) — the ADR-0053 naming law, not a generic `value`.
```json
{ "id": "cb_terms", "component": "Checkbox", "name": "terms", "label": "I accept the terms",
  "required": true, "checked": { "path": "/form/terms" } }
```
Real: `examples/generative-form.ts:134-135`, `examples/patterns.ts:42-44`.

## Select / Option
`catalog.json:86-103`. Select: `value: { prop:"value", event:"select" }`, `children:"ChildList"` of Option;
bindable `value`, `disabled`, `required`; plain `placeholder`, `name`. Option: `value` (plain), `label`
(bindable → `textContent`). CRITICAL ordering: a Select and its Options MUST arrive in the SAME
`updateComponents` message — `ui-select` moves `[role=option]` children into its panel only at first connect
(ADR-0053 limitation, `generative-form.ts:11-13`); Options added to an already-connected Select never appear.
```json
{ "id": "in_plan", "component": "Select", "name": "plan", "required": true,
  "placeholder": "Choose a plan…", "value": { "path": "/form/plan" }, "children": ["opt_s","opt_m","opt_l"] }
{ "id": "opt_s", "component": "Option", "value": "starter", "label": "Starter" }
```
Real: `examples/generative-form.ts:115-121`, `examples/patterns.ts:46-52`.

## Row / Column — flex layout containers
`catalog.json:105-127`. `children:"ChildList"`. Props: `elevation`/`brightness` (`"-3"`…`"3"` strings),
`align` (`start center end stretch baseline`), `justify` (`start center end between around evenly`),
`gap` (`none xs sm md lg xl 2xl`), `wrap` (boolean). Row = inline axis, Column = block axis. A wrapping Row
is the idiomatic tile grid; `justify:"end"` a Row of trailing actions.
```json
{ "id": "actions", "component": "Row", "gap": "md", "justify": "end", "children": ["btn_cancel","btn_delete"] }
```
Real: `examples/patterns.ts:37,53,84`, `examples/dynamic-lists.ts:32` (`wrap:true` tile row).

## Card family — Card · CardHeader · CardContent · CardFooter
`catalog.json:129-152`. All `children:"ChildList"`. Card: `elevation`/`brightness`. CardContent also
`scrollable` (boolean). Idiom: `Card > CardContent > (Column of content)`, header/footer optional; put a
trailing action Row inside CardContent or CardFooter.
```json
{ "id": "root", "component": "Card", "elevation": "1", "children": ["root_content"] }
{ "id": "root_content", "component": "CardContent", "children": ["col"] }
```
Real: `examples/patterns.ts:34-35`, every pattern/list card root.

## Tabs / Tab / TabPanel
`catalog.json:154-172`. Tabs: `value: { prop:"selected", event:"select" }`, `selected` bindable (`string|number`),
`children:"ChildList"`. Tabs' children is a FLAT list of every Tab THEN every TabPanel, matched by position
(`tab0 tab1 tab2 panel0 panel1 panel2`). Binding `selected` to a data path makes tab state client data that
rides the model — the wizard idiom (a staged form driven by `selected`).
```json
{ "id": "tabs", "component": "Tabs", "selected": { "path": "/wizard/step" },
  "children": ["tab0","tab1","tab2","panel0","panel1","panel2"] }
```
Real: `examples/patterns.ts:119-134` (wizard).

## Modal
`catalog.json:174-183`. `value: { prop:"open", event:"toggle" }`, `open` bindable, `persistent` (boolean),
`elevation`/`brightness`, `children:"ChildList"`. Bind `open` to a data path to drive visibility from the model.

---

## Catalog functions (for `checks` and `callFunction`)
`catalog.json:186-207`. The catalog's `functions` registry — the names a `checks` `{call}` or a server
`callFunction` may invoke: `required` (`clientOnly`), `email` (`clientOnly`), `regex` (`clientOnly`, arg
`pattern`), `ping` (`clientOrRemote`). Used by TextField `checks` (`generative-form.ts:73,88`) and the
canvas page's protocol probes (`canvas-button.ts:6-8`). A `{call}` naming an unregistered function is an
`E_*`/validation failure — the validate-payload CLI catches it.
