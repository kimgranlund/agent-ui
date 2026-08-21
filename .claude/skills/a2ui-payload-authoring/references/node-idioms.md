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
`catalog.json:15-37`. Props: `label` (bindable → `textContent`), `variant`, `disabled` (bindable),
`icon` (bindable → the leading glyph; ADR-0226), `iconOnly` (boolean; ADR-0226),
`action` (object: `action` REQUIRED, optional `context`, `wantResponse`). The fleet has NO danger tone —
a destructive intent is carried by the action NAME + wording, not a red variant (`patterns.ts:1-8, 84-86`).
`action.submit` is a client-only FormProvider gate flag (ADR-0054), not a catalog prop —
see `references/bindings-actions-checks.md`.
```json
{ "id": "btn_save", "component": "Button", "variant": "solid", "label": "Save settings",
  "action": { "action": "save_settings", "submit": true } }
```
Real: `examples/canvas-button.ts:27`, `examples/generative-form.ts:148`, `examples/patterns.ts:85-86`.

**Icons (ADR-0226, 2026-08-20):** `icon` names a glyph from `@agent-ui/icons`' ICON_NAMES — the same
open-string vocabulary `Icon.name` takes, NOT a catalog-pinned enum (an unknown name renders the
fallback glyph, never a validation error). Two forms, both validator-enforced by `requires:`
cross-prop checks (a violation is a CATALOG failure at finalize):
- **icon + label** — `icon` REQUIRES `label`; the glyph leads, the label stays visible text.
- **icon-only** — `iconOnly: true` REQUIRES `icon`; the `label` is still REQUIRED and routes to
  `aria-label` instead of visible text (the label IS the accessible name — never omit it).
```json
{ "id": "btn_dl", "component": "Button", "variant": "soft", "icon": "download-simple",
  "label": "Download", "action": { "action": "download_report" } }
{ "id": "btn_x", "component": "Button", "variant": "ghost", "icon": "x", "iconOnly": true,
  "label": "Dismiss", "action": { "action": "dismiss_notice" } }
```
Real: `examples/catalog-frontier.ts:1260-1300` (`frontier-button-icon-actions`, both forms in one tree).
**Retired workaround** — the old `Column(Icon, ghost Button)` pairing (an Icon leaf visually glued to
a bare Button) is dead: use `icon`/`iconOnly` instead. Nesting an `Icon` CHILD inside `Button` was
never a contract and now FAILS validation outright — ADR-0226 closed the `child`/`children`
structural leniency catalog-wide, so a child key on any non-children-model component is a CATALOG
failure, not a silent ignore.

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

## Toggle — pressed-state pill BUTTON, not form-associated
GH #1352 catalog row (ADR-0179 GH #686 Amendment S7-a). Bindable `pressed`, `disabled`, `label` (→
`textContent`, bespoke); `size` (`sm`\|`md`\|`lg`, structural only). **No `value` mark** — `pressed` is
bindable ONE-WAY (data→control) only; there is no commit-back event to bind on (`ui-toggle`'s own
`toggle` fires BEFORE the press commits, by design — see the `toggleFactory` doc comment,
`catalog/default/factories.ts`). Render it already in the state you want; don't expect a user press to
flow back into the data model yet.
```json
{ "id": "chat_toggle", "component": "Toggle", "label": "Chat", "pressed": { "path": "/panes/chatActive" } }
```
Real: `examples/catalog-frontier.ts` (`paneSwitcherSeed`).

## Select / Option
`catalog.json:86-103`. Select: `value: { prop:"value", event:"select" }`, `children:"ChildList"` of Option;
bindable `value`, `disabled`, `required`; plain `placeholder`, `name`. Option: `value` (plain), `label`
(bindable → `textContent`). Ordering: `ui-select` adopts `[role=option]` children into its panel at first
connect AND on every later light-DOM mutation (TKT-0026, 2026-07-12 — a late-arriving Option now DOES
reach the panel and becomes selectable, superseding ADR-0053's ship-together limitation, BUT ONLY when
the new id is APPENDED after every already-delivered Option). A resend that INSERTS a new Option id
BETWEEN two already-delivered ones no longer throws either (TKT-0031, fixed — the renderer's generic
`tree.ts#reconcileChildren` now skips a survivor whose real parent is no longer the Select host, for the
whole ADR-0017 child-relocating family, not just Select), but it is still NOT position-faithful: the
new Option lands at the listbox's CURRENT TAIL (select.ts's own adoption-ordering doc), not at its
wire-requested mid-list position (SPEC-R5 reorder stays a deliberate non-goal, ADR-0128). Shipping a
Select and its Options in the SAME `updateComponents` message is still the natural, simplest shape for
EXACT panel order — prefer it when order matters; a mid-list splice is now safe to send, just not
position-faithful.
```json
{ "id": "in_plan", "component": "Select", "name": "plan", "required": true,
  "placeholder": "Choose a plan…", "value": { "path": "/form/plan" }, "children": ["opt_s","opt_m","opt_l"] }
{ "id": "opt_s", "component": "Option", "value": "starter", "label": "Starter" }
```
Real: `examples/generative-form.ts:115-121`, `examples/patterns.ts:46-52`.

## RadioGroup > visual containers > Radio — depth-scoped discovery (ADR-0212)
`catalog.json:280-298`. RadioGroup: `value:{prop:"value",event:"change"}`, bindable `value`/`disabled`,
plain `name`/`required`/`orientation`, `children:"ChildList"`. Radio: `value` (plain), `label` (bindable
→ `textContent`), `checked` (bindable). **Rule**: a `Radio` no longer has to sit as a DIRECT child of its
`RadioGroup` to join the group's roving/exclusivity/value/validity machinery — the group discovers every
`Radio` DESCENDANT whose NEAREST `RadioGroup` ancestor is itself, at any nesting depth
([ADR-0212](../../../docs/adr/0212-radio-group-nearest-group-descendant-discovery.md)). Wrap each Radio in
a visual container — a `Card`/`Column`/`Row` row carrying a label plus other controls beside it (the
model-grid shape: one card per option, each with its own descriptive `Text`/`Badge` and an unrelated
`Switch`, only the `Radio` inside every card sharing one logical selection) — and the group still commits
a single cross-container value. Before ADR-0212 this shape was **silently broken**, not merely
unsupported: nesting a Radio under a container inside the group let it check itself while the group's own
`value` stayed unset and a second nested Radio could end up checked too — never compose this shape against
an OLDER build.
**Boundary**: an inner nested `RadioGroup` is an ownership boundary — its own `Radio` descendants belong
to IT, never to the outer group (do not nest RadioGroups expecting one shared selection; that is two
independent selections by design). The group's own INTERIOR FLEX LAYOUT still applies only to its DIRECT
children (ADR-0103, unchanged) — a visual container is the layout unit the group's `gap`/`orientation`
positions, while staying transparent to the Radio discovery above; the Radio itself does not need to be a
direct child for either layout or selection to work correctly at the container level.
```json
{ "id": "rg_models", "component": "RadioGroup", "name": "default_model", "value": { "path": "/settings/defaultModel" },
  "children": ["row_gpt", "row_claude"] }
{ "id": "row_gpt", "component": "Card", "children": ["row_gpt_content"] }
{ "id": "row_gpt_content", "component": "Row", "align": "center", "justify": "between", "gap": "md",
  "children": ["gpt_label", "gpt_include", "r_gpt"] }
{ "id": "gpt_label", "component": "Text", "text": "GPT-5" }
{ "id": "gpt_include", "component": "Switch", "checked": { "path": "/settings/providers/gpt/enabled" } }
{ "id": "r_gpt", "component": "Radio", "value": "gpt-5", "label": "Default" }
```
Real: no wire seed emits this shape yet (a fleet gap, honestly named — routed to the
a2ui-prompt-authoring backlog, the PR #1362 family); the mechanism itself is proven live by
`packages/agent-ui/components/src/controls/radio/radio-group.test.ts` (the nearest-group-scoped
discovery + inner-group-boundary jsdom legs) and `radio-group.browser.test.ts`'s "ADR-0212 —
nearest-group-scoped discovery" section (exactly-one-tabindex roving + a late-appended nested Radio,
both engines).

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

**CardFooter's multi-action rule (GH #1475 — the live defect this closes).** `CardFooter`'s own
side-by-side layout is `[slot="trailing"]`-driven (`card.css`'s presence-derived host-as-grid); a
slotless footer is ONE `1fr` column, so bare children stack full-width one above the other instead of
sitting in a row. ONE action -> the `Button` is `CardFooter`'s own direct child (no wrapper needed).
TWO OR MORE actions (a confirm/decline pair, a game's Check/Bet/Fold move set, anything) -> wrap them in
a `Row` (with a `gap`) INSIDE `CardFooter`, side-by-side by construction — never bare Button siblings,
they stack:
```json
// WRONG — b1/b2/b3 are bare CardFooter children; they stack full-width, they don't sit in a row
{ "id": "ft", "component": "CardFooter", "children": ["b1", "b2", "b3"] }

// RIGHT — one Row inside CardFooter carries the whole action set, side-by-side
{ "id": "ft", "component": "CardFooter", "children": ["actions"] }
{ "id": "actions", "component": "Row", "gap": "md", "justify": "end", "children": ["b1", "b2", "b3"] }
```
Real: `examples/patterns.ts:76-78` (`card_footer` -> `actions` Row -> `btn_save`), `examples/patterns.ts:108-112`
(the confirm/decline pair, same shape); `examples/catalog-frontier.ts`'s `frontier-greet-card` seed carried
the WRONG bare shape until GH #1475 caught it live and it was upgraded to match.

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

## Drill / DrillPanel — N-level drill-down, one panel visible at a time
GH #1353 catalog row (ADR-0195, GH #954). Drill: `path` bindable (`string[]`, the FULL chain from the root
panel's key through the current leaf), `children:"ChildList"` of `DrillPanel`. **No `value` mark** — `path`
is bindable ONE-WAY (data→control) only; neither controlled nor uncontrolled mode ever writes the resolved
position back onto the `path` accessor, so there is nothing a commit-back could safely read (see the
`drillFactory` doc comment, `catalog/default/factories.ts`, for the full empirical finding). Advance the
position by re-emitting `updateDataModel` against the bound path on your NEXT turn — do not expect a client
click inside an emitted Drill to write anything back into the data model except via the control's own Back
button (which needs no binding at all). DrillPanel: `key`/`parent` are structural identity (NOT bindable —
set once, like `MenuItem.value`); `heading` is bindable display text (like `MenuItem.label`).
**Drill-forward triggers are not catalog-reachable** — the fleet control's own `data-role="drill-trigger"`
authoring convention has no wire equivalent this pass, so compose a Drill by setting `path` to the level you
want shown; you cannot emit a clickable row that drills the user forward on its own.
```json
{ "id": "d1", "component": "Drill", "path": { "path": "/settings/path" },
  "children": ["p_root", "p_appearance"] },
{ "id": "p_root", "component": "DrillPanel", "key": "root", "parent": "", "heading": "Settings", "children": ["p_r1"] },
{ "id": "p_r1", "component": "Text", "text": "Appearance" },
{ "id": "p_appearance", "component": "DrillPanel", "key": "appearance", "parent": "root", "heading": "Appearance", "children": ["p_a1"] },
{ "id": "p_a1", "component": "Text", "text": "Theme, density, and accent color." }
```
Real: `examples/catalog-frontier.ts` (`frontier-drill-settings`).
## Toast — transient status message
`catalog.json:218-223`. Props: `label` (mapsTo `textContent`, NOT bindable — a Toast is a one-shot message,
never re-targeted in place), `urgent` (boolean), `duration` (number, ms). No `children` — it is a LEAF.
**The region is host-owned**: `ToastRegion`/`ToastStack` is NOT a catalog type (GH #1355; ADR-0112 cl.6) —
the payload emits a bare `Toast` node into the tree and the host page's chrome positions/stacks/dismisses
it; never invent a region component.

**Emission decision — Toast vs. a status Card/Badge/Stat.** Reach for Toast for a ONE-SHOT, fire-and-forget
outcome nobody needs to find again once it fades — a round result, a save confirmation, a background
action's completion. Reach for a Card/Badge/Stat readout instead when the state must persist, be
re-referenced, or drive further binding — anything the user might scroll back to, or that another node
reads off the same data-model path.
```json
{ "id": "outcome", "component": "Toast", "label": "Dealer wins — 19 beats 17.", "duration": 6000 }
```
Real: `examples/catalog-frontier.ts:269` (`round-outcome-toast` seed).

## Tooltip — anchored disclosure panel
`catalog.json:259-266`. `value: { prop:"open", event:"toggle" }`, `open` bindable, `placement` enum, `delay`
(ms before an unforced hover-show). `children:"ChildList"` — the FIRST child is the ANCHOR (stays in flow,
the trigger); every remaining child relocates into the tooltip's own panel at connect (ship anchor + panel
content together, the same first-child convention Popover/Menu share — never resend after the anchor).

**Plain caption vs. a structured explainer card (GH #1355, the "what does this control do" admin-help
shape).** A one-line hint is `children: [anchor, captionText]` — a single `Text` variant `caption`. Once the
content needs a heading + summary + body + reference facts, structure the panel as a `Column` of a title
`Text` (variant `label` or `h5`) + a one-line summary `Text` (variant `caption`) + one or more body `Text`
paragraphs + an optional `DescriptionList` (`rows: {label,value}[]`) for term→detail facts — never cram
multi-paragraph prose into one `Text` node.
```json
{ "id": "tip", "component": "Tooltip", "placement": "top-start", "delay": 300,
  "open": { "path": "/ui/tipOpen" }, "children": ["btn_info", "tip_col"] }
{ "id": "tip_col", "component": "Column", "gap": "xs", "children": ["tip_title", "tip_summary", "tip_facts"] }
{ "id": "tip_title", "component": "Text", "variant": "label", "text": "Surface Options" }
{ "id": "tip_summary", "component": "Text", "variant": "caption", "text": "Which output modalities this agent may use" }
{ "id": "tip_facts", "component": "DescriptionList", "rows": [{ "label": "Applies", "value": "from the next turn" }] }
```
Real: `examples/catalog-coverage.ts:258` (`document-row-toolbar` seed's `tip_wrap`, the plain-caption shape);
the structured variant mirrors `app/src/controls/agent-admin/admin-help.ts`'s DOM card (title/summary/body/facts).

## Product-presentation card — Card + Image + Stat + Badge (GH #1377)
A commerce/hospitality catalog-grid tile: hero `Image` as `Card`'s own child (media, NOT identity — it
never nests inside `CardHeader`), `CardHeader` carrying the identity row (title `Text` + a status `Badge`,
`slot:"trailing"`), `CardContent` carrying a `Row` of `Stat` tiles (the quantified metrics — price,
rating), `CardFooter` carrying the ONE commit `Button` (card-anatomy law, req-a2ui-patterns.md R1).
**A slotted Badge MUST be CardHeader's own DIRECT child** — `format:"structured"` — never nested inside
a `Row` a level down: the header's `[slot="trailing"]` placement is a direct-child CSS grid
(`card.css`'s `:has(> [slot='trailing'])`), so a `Row`-wrapped Badge one level deeper renders inert (the
`commerce-product-card` seed's own first-pass defect, caught by the ADR-0068 judge and repaired at
source — `structured-container.ts:41-45`'s `CardHeader(format:'structured') > [Icon(slot leading),
Text, Badge(slot trailing)]` shape is the one to copy).
**Routing — the metric-AND-flag test**: reach for this idiom ONLY when the tile ALSO carries a quantified
metric (price/rating/stock) AND a status flag (Sale/New/Popular). A photo+title+one-button listing with
NEITHER wants the plainer `Card > Image > CardContent > CardFooter` shape instead — no `Stat`, no
`Badge` — the `frontier-image-hero-card` seed's shape (`catalog-frontier.ts:346-378`); adding an empty
Stat/Badge row to a single-fact card is over-decoration, not fidelity. Badge `intent` stays `neutral`/
`info` for a promo flag — the fleet has no danger tone (Button card, above).
```json
{ "id": "root", "component": "Card", "elevation": "1", "children": ["hero", "head", "content", "foot"] }
{ "id": "hero", "component": "Image", "src": { "path": "/listing/photo" }, "alt": "…", "aspect": "16/9", "usageHint": "hero" }
{ "id": "head", "component": "CardHeader", "format": "structured", "children": ["head_title", "head_badge"] }
{ "id": "head_badge", "component": "Badge", "label": { "path": "/listing/badge" }, "intent": "info", "slot": "trailing" }
{ "id": "content", "component": "CardContent", "children": ["stats_row"] }
{ "id": "stats_row", "component": "Row", "gap": "lg", "children": ["stat_price", "stat_rating"] }
{ "id": "stat_price", "component": "Stat", "label": "Price", "value": { "path": "/listing/price" } }
```
Real: `examples/commerce-hospitality.ts:66-75` (`commerce-product-card`, the flagship judged corpus seed).

## Feature-collection — DescriptionList vs Table (GH #1377)
Presenting a set of named facts. ONE entity's own spec sheet (material, dimensions, warranty) is a
`DescriptionList` — `rows` bound to `{label,value}[]`, no per-column alignment needed. Comparing the
SAME facts across MULTIPLE entities, scanned exact-value by row, is a `Table` — `columns`+`rows` both
bound (the catalog SPEC §5.2 Notes guidance the `comparison-pricing-table` seed already proves,
`high-frequency-patterns.ts:66-75`). **Boundary**: never use `DescriptionList` to compare many items (it
has no columns to align facts across); never use a one-row `Table` for a single item's own facts (a
`DescriptionList` teaches the same content with less chrome). This card is the bare single-purpose
primitive choice; see "Comparison-table" below for the higher-order Stat-tiles-plus-Table composition —
that idiom is deliberately MORE than a bare fact list.
```json
{ "id": "specs", "component": "DescriptionList", "rows": { "path": "/product/specs" } }
```
Real: `examples/catalog-frontier.ts:320` (`frontier-booking-receipt`, DescriptionList),
`examples/high-frequency-patterns.ts:67-75` (`comparison-pricing-table`, Table).

## Variant-picker — SegmentedControl vs Select (GH #1377)
Picking one option from a closed set (size, color, plan tier). `catalog.json` — SegmentedControl:
`value:{prop:"value",event:"change"}`, `children:"ChildList"` of `Segment` (`value` plain, `label`
bindable → `textContent`). ≤3 members with SHORT (≤5-char) labels that fit one row → `SegmentedControl`,
Field-wrapped, always-visible, no open/close state — `booking-reservation`'s room-type picker proves it
(`catalog-coverage.ts:135-141`; the site's own `fitsSegmented()` knob-selection rule names the identical
≤3/≤5-char threshold, `component-preview.ts`). More members, or labels too long for one row → `Select` +
`Option` (node-idioms.md's own Select card, above) — ship Select and its Options in ONE message for exact
panel order. **Boundary**: never SegmentedControl a >3-member or long-label set (it wraps or truncates);
never Select a 2-3-member always-visible choice (it hides options behind a closed dropdown for no reason).
```json
{ "id": "f_size", "component": "Field", "label": "Size", "child": "seg_size" }
{ "id": "seg_size", "component": "SegmentedControl", "name": "size", "value": { "path": "/product/size" }, "children": ["seg_s", "seg_m", "seg_l"] }
{ "id": "seg_s", "component": "Segment", "value": "s", "label": "S" }
```
Real: `examples/catalog-coverage.ts:135-141` (`booking-reservation`), `examples/commerce-hospitality.ts:125-132` (`product-options-quantity`).

## Quantity — number TextField (no stepper minted) (GH #1377)
A numeric quantity input. Until/unless a dedicated Stepper control is minted (a fleet gap — this idiom's
job is to recipe the CURRENT catalog, not to fill that gap), the shape is a Field-wrapped `TextField`:
`type:"number"`, `min` (string), `step` (number, `mapsTo:"step"`), `value` bound to the quantity path.
`Field`'s `label` names it — never a bare unlabeled TextField (the Field card's own ADR-0051 rule, above).
Pair with a `FormProvider` only when the quantity BLOCKS a submit (e.g. must be ≥1 to add-to-cart); a
display-only or always-valid quantity needs no provider. **Boundary**: do not reach for a Select/
SegmentedControl of numbers as a stand-in stepper — `TextField type:"number"` is the catalog's only
numeric-entry primitive today; that absence is a named, deferred fleet gap, not silently worked around.
```json
{ "id": "f_qty", "component": "Field", "label": "Quantity", "child": "qty_field" }
{ "id": "qty_field", "component": "TextField", "name": "qty", "type": "number", "min": "1", "step": 1, "value": { "path": "/product/qty" } }
```
Real: `examples/commerce-hospitality.ts:133-137` (`product-options-quantity`).

## Media-grid — Grid of Image tiles, a photo gallery (GH #1377)
A photo/image gallery — every tile is genuinely an image meant to be viewed, not a file. `Grid` (`gap`,
`min` sizing the track) whose `children` is a `{path,componentId}` template over the photo list; each
tile is a bare `Image` (`usageHint:"thumb"`, `fit:"cover"`, one shared `aspect`, `alt` bound per item —
the Image card's own required-alt rule, above). **Boundary vs `media-file-grid`** (`high-frequency-
patterns.ts:236-274`): that idiom templates `Attachment` tiles for HETEROGENEOUS files (images+PDF+video)
needing type-aware chrome (name/size/icon) — reach for it when content isn't guaranteed to be a viewable
photo. Reach for THIS idiom when every item IS a photo to browse (a listing's photo set); burying a real
photo behind `Attachment`'s file-icon chrome loses the photo. For a one-at-a-time PAGED sequence instead
of a grid, use the `Swiper`/`SwiperItem` slideshow idiom (`composition-pack-a.ts`'s `slideshow-gallery`
seed), not `Grid`.
```json
{ "id": "root", "component": "Grid", "gap": "md", "min": "10rem", "children": { "path": "/listing/photos", "componentId": "photo_tile" } }
{ "id": "photo_tile", "component": "Image", "src": { "path": "url" }, "alt": { "path": "caption" }, "aspect": "1/1", "usageHint": "thumb", "fit": "cover" }
```
Real: `examples/commerce-hospitality.ts:185-188` (`listing-photo-grid`); contrast `examples/high-frequency-patterns.ts:265-269` (`media-file-grid`, Attachment tiles).

## Comparison-table — Stat tiles above a shared Table (GH #1377)
Side-by-side plan/product comparison: a `Grid` of headline `Stat` tiles (one `Card` per option, `label`+
`value` — price or the option's own quantified pitch) ABOVE one shared `Table` whose `columns` are the
options and whose `rows` are features, cell values the exact per-option answer — this is `comparison-
pricing-table`'s own proven shape (`high-frequency-patterns.ts:54-75`), named here as its own idiom. This
is Stat-tiles-PLUS-Table together as ONE composed card — never "feature-collection"'s bare single-purpose
Table above (that card has no headline metrics row), and never "product-presentation"'s per-item
Card+Image+Badge tile (comparison strips the photo/Badge chrome entirely; it is about scanning facts
across options, not browsing one item). Keep the Stat row and the Table under one `Card`/`CardContent` so
they read as one comparison, not two unrelated blocks.
```json
{ "id": "plans_grid", "component": "Grid", "gap": "md", "min": "10rem", "children": { "path": "/plans", "componentId": "plan_tile" } }
{ "id": "plan_stat", "component": "Stat", "label": { "path": "name" }, "value": { "path": "price" } }
{ "id": "features_table", "component": "Table", "columns": [{ "key": "feature", "label": "Feature" }], "rows": { "path": "/features" } }
```
Real: `examples/high-frequency-patterns.ts:54-75` (`comparison-pricing-table`).

---

## Catalog functions (for `checks` and `callFunction`)
`catalog.json:186-207`. The catalog's `functions` registry — the names a `checks` `{call}` or a server
`callFunction` may invoke: `required` (`clientOnly`), `email` (`clientOnly`), `regex` (`clientOnly`, arg
`pattern`), `ping` (`clientOrRemote`). Used by TextField `checks` (`generative-form.ts:73,88`) and the
canvas page's protocol probes (`canvas-button.ts:6-8`). A `{call}` naming an unregistered function is an
`E_*`/validation failure — the validate-payload CLI catches it.
