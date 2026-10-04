# Decomp — A2UI form-family catalog rows + Generative Form + Patterns pages

> NEXT.md open item 4 (the G7-unblocked integration wave). Manifest (coverage-checked `--strict`, exit 0):
> `a2ui-form-catalog-examples.decomp.json`. Decision records: **ADR-0053** (form-family rows + naming law) ·
> **ADR-0054** (submit-gated action seam) — both **PROPOSED**, forks below await Kim's ruling. Zero-dep
> (catalog SPEC-N4/N5) holds throughout; every demo payload MUST validate v1.0-clean (the shared validator is
> the gate — an invalid demo payload is a contradiction). · proposed · 2026-07-02 · planner (design seat)

## 0 · What this wave is

Three coupled deliverables: **(a)** the default-catalog rows that make a coordinated form emittable by an
agent payload (Field · FormProvider · Checkbox · Switch · Select · Option, + the TextField reach widening);
**(b)** the flagship **Generative Form** example page — ONE payload → a complete validated form → the typed
aggregate round-trips as a client message; **(c)** the **A2UI Patterns** page — five [payload | live surface]
pattern demos in the proven a2ui-list multi-demo format.

**Discovered dependency (surface it, don't hide it):** deliverable (b) requires Checkbox/Switch/Select rows
that do not exist today — the dispatch named only Field/FormProvider, but the form payload cannot render
without the other three. They are in scope for (a); SPEC §5.2 already planned them (as `Checkbox`, `Switch`,
`ChoicePicker`).

## 1 · Catalog-row design (deliverable a)

### 1.1 The naming law (ADR-0053 fork F2 — recommend, don't settle)

The `value:{prop,event}` seam (input.ts) requires the A2UI prop name and the DOM commit prop to be the SAME
name ("`value.prop` names BOTH sides of the round-trip by contract"). `ui-checkbox` has BOTH a `value` prop
(the submitted string, `'on'`) and a `checked` prop (the bindable boolean) — so a Basic-catalog-aligned
`value: boolean` row is a live trap: `el['value']` would commit `'on'`, not the boolean.

**Law (recommended):** a bindable catalog prop is named by the CONTROL's own prop (the shipped precedent:
`Tabs.selected`, `Modal.open`) — so `Checkbox.checked`, `Switch.checked`, `Select.value`. The alternative
(widen the seam to `value:{prop, domProp?, event}`) buys Basic-name alignment at the cost of a renderer
seam change; rejected in ADR-0053 (alternatives).

### 1.2 The rows (normative sketch — catalog.json + §5.2 both follow this)

| Type | Widget | Properties (bindable ⭐) | `value` mark | Children |
|---|---|---|---|---|
| `Field` | `ui-field` | `label` ⭐ string · `description` ⭐ string (both 1:1 accessor props) | — | **`child`** (the ONE wrapped control; the renderer/validator already support single-`child`) |
| `FormProvider` | `ui-form-provider` | **none** — the row mirrors the attribute-less control faithfully | — | `ChildList` |
| `Checkbox` | `ui-checkbox` | `checked` ⭐ boolean · `label` string→textContent (bespoke) · `disabled` ⭐ · `required` · `name` | `{prop:'checked', event:'change'}` | — |
| `Switch` | `ui-switch` | `checked` ⭐ boolean · `label` string→textContent (bespoke) · `disabled` ⭐ · `name` | `{prop:'checked', event:'change'}` | — |
| `Select` | `ui-select` | `value` ⭐ string · `placeholder` string · `disabled` ⭐ · `required` · `name` | `{prop:'value', event:'select'}` | `ChildList` (Option) |
| `Option` | `[role=option]` primitive `<div>` | `value` string → attribute · `label` ⭐ string → textContent | — | — |

Factory shapes: `Field`/`FormProvider`/`Select` ride `accessorFactory` (1:1 reflecting props);
`Checkbox`/`Switch` need a bespoke factory for `label`→textContent (the `buttonFactory` precedent — a
non-identity `mapsTo` must NOT route through `accessorFactory`, factories.ts INVARIANT); `Option` is a
sanctioned primitive (the pre-ui-text `Text` precedent, SPEC-R3 AC1) — `create()` = `div[role=option]`,
`value`→attribute, `label`→textContent.

**Deliberate exclusions (record in §5.2, not silence — SPEC-N2):**
- `Select.open` is NOT declared: the component-level `value` mark can carry only ONE two-way pair, and a
  one-way `open` would silently drift on platform light-dismiss (the data model would lie). Tabs/Modal keep
  theirs because `selected`/`open` IS their primary bindable.
- Option groups (`role=group` optgroup parity), `RadioGroup`, `Slider`, `Calendar`, `ComboBox` rows —
  deferred to a later wave; `datetime-local`/`month` stay out of the TextField enum (unshipped STRETCH).
- **Known limitation to document:** ui-select ingests `[role=option]` children at FIRST connect. The
  renderer assembles children before root-attach (upgrade happens at attach), so the initial payload works
  by construction — but a LATER `updateComponents` adding Options to an already-connected Select will not
  reach the panel. Not a blocker (documented, matches the Tab/TabPanel class of limitation).

### 1.3 TextField reach assessment (today vs the shipped 12-type control)

Catalog today: `value ⭐ · label ⭐ · placeholder ⭐ · size · readonly · disabled ⭐ · required ⭐ · name` +
`value:{prop:'value',event:'change'}`. Missing vs the shipped control: **`type` (12-value enum) · `currency`
· `unit` · `step` · `min` · `max`**.

**Recommendation (fork F4, taste-light): expose all six now, in one stroke.** Every one is a 1:1 reflecting
accessor prop — `accessorFactory` already applies them with ZERO factory code; the cost is only PropDefs in
catalog.json. Staging "text types now, numeric later" buys nothing (same mechanism) and leaves silent dead
capability. Notes: the conformance validator checks primitive types only (an out-of-enum `type` string
passes validation and the control falls back to its default — record as known-tolerant, matching
`matchesPrimitive`'s do-not-over-reject stance); `type=date` lazily imports the calendar inside the control
— no catalog/renderer involvement, tree-shake unaffected.

## 2 · The submit seam (ADR-0054 — fork F1, the load-bearing design decision)

**Problem:** `ui-form-provider` takes no attributes; its whole surface is IDL (`submit()`/`reset()`/views) +
the `change` submit event. Nothing in the catalog contract can *trigger* `submit()` — actions wire
click→emitAction on the action-carrying node itself, and when this wave was planned context was emitted
verbatim (no `collectContext` resolution shipped), so the aggregate must ride the data model, not the action
context. (Built since: `collectContext` resolves action context at click time, 2026-10-04, GH #1748,
PR #1755. The aggregate still rides the data model per ADR-0054 cl.4, because `FormValue` is not
JSON-wire-safe.)

**Recommended design (S1 — the submit-flagged action + a generic gate mark):**
1. **ADR-0011 amendment:** the action object gains an optional, client-consumed `submit: true` key —
   `action: { action: 'submit_profile', submit: true }`. The WIRE shape of the emitted `action` message is
   UNCHANGED (the flag never leaves the client); the open PropDef schema + Postel reader already tolerate it.
2. **Catalog contract:** `WidgetFactory` gains optional `submitGate: true` (FormProvider's factory sets it).
   The registry derives a gate SELECTOR from the registered factories' tags — the renderer stays generic
   (no `ui-form-provider` literal in renderer.ts), and a project catalog can mark its own gate (two-tier).
   A `submitGate` factory's control MUST expose `submit(): boolean` (structural contract, SPEC §5.1).
3. **Renderer (#wireAction):** on click of a submit-flagged action, resolve `el.closest(gateSelector)`;
   gate found and `gate.submit()` returns false → NO action emitted (the provider already ran
   first-invalid `reportValidity` — native focus + announce); returns true → emit as today. No gate
   ancestor → emit normally (graceful, un-nested Buttons keep working).
4. **The typed aggregate rides the DATA MODEL** — inputs two-way-bind under `/form/*`, `createSurface`
   sets `sendDataModel: true`, and the valid submit's `action` message carries the live typed aggregate.
   The provider's own `change` (FormSubmitDetail) still fires — page chrome MAY display it, but the wire
   proof is the action's `dataModel`. (Deliberately NOT merged into `context`: `FormValue` admits
   `File`/`FormData` — not JSON-wire-safe — and the data model is the protocol-native aggregate.)

**FormProvider's catalog row therefore has NO properties** — the no-attribute coordination element maps to
a no-property row; its catalog meaning is (children + the gate mark). Honest and faithful.

Alternatives (recorded in ADR-0054): FormProvider-as-action-source (an `action` prop + a factory
`actionEvent:'change'` mark) still needs a trigger for `submit()` — strictly more machinery; implicit
gating of EVERY Button inside a provider — breaks non-submit buttons (Cancel) and changes shipped payload
semantics; no row at all (Button `checks` auto-disable as the only gate) — loses first-invalid
reportValidity UX and the aggregate surface, and leaves G7's headline primitive catalog-invisible.

## 3 · Generative Form page (deliverable b) — payload sketch

`site/a2ui-form.html` + `site/pages/a2ui-form.{ts,css}`. Format: the a2ui-canvas 3-region flow (payload →
live surface → client-message log), `mountFullBleedPage`, shown≡fed derivation, re-run + clear affordances.

```jsonc
// createSurface: { surfaceId:'form', catalogId:'agent-ui', sendDataModel: true }
// updateDataModel: { value: { form: { name:'', email:'', budget:'450', plan:'', notify:true, terms:false } } }
[
  { "id":"root", "component":"Card", "children":["form"] },
  { "id":"form", "component":"FormProvider", "children":["f_name","f_email","f_budget","f_plan","row_toggles","actions"] },
  { "id":"f_name", "component":"Field", "label":"Full name", "child":"in_name" },
  { "id":"in_name", "component":"TextField", "name":"name", "required":true,
    "value":{"path":"/form/name"},
    "checks":[{ "call":"required", "args":{"value":{"path":"/form/name"}}, "message":"Name is required" }] },
  { "id":"f_email", "component":"Field", "label":"Email", "description":"We reply within a day", "child":"in_email" },
  { "id":"in_email", "component":"TextField", "name":"email", "type":"email",
    "value":{"path":"/form/email"},
    "checks":[{ "call":"email", "args":{"value":{"path":"/form/email"}}, "message":"Enter a valid email" }] },
  { "id":"f_budget", "component":"Field", "label":"Budget", "child":"in_budget" },
  { "id":"in_budget", "component":"TextField", "name":"budget", "type":"currency", "currency":"EUR",
    "step":50, "min":"0", "value":{"path":"/form/budget"} },      // the Wave-5 reach, live in the catalog
  { "id":"f_plan", "component":"Field", "label":"Plan", "child":"in_plan" },
  { "id":"in_plan", "component":"Select", "name":"plan", "required":true, "placeholder":"Choose a plan…",
    "value":{"path":"/form/plan"}, "children":["opt_s","opt_m","opt_l"] },
  { "id":"opt_s", "component":"Option", "value":"starter",  "label":"Starter" },
  { "id":"opt_m", "component":"Option", "value":"pro",      "label":"Pro" },
  { "id":"opt_l", "component":"Option", "value":"scale",    "label":"Scale" },
  { "id":"row_toggles", "component":"Row", "gap":"lg", "wrap":true, "children":["sw_notify","cb_terms"] },
  { "id":"sw_notify", "component":"Switch",   "name":"notify", "label":"Email me updates", "checked":{"path":"/form/notify"} },
  { "id":"cb_terms",  "component":"Checkbox", "name":"terms",  "label":"I accept the terms", "required":true, "checked":{"path":"/form/terms"} },
  { "id":"actions", "component":"Row", "gap":"md", "justify":"end", "children":["btn_submit"] },
  { "id":"btn_submit", "component":"Button", "variant":"solid", "label":"Submit",
    "action":{ "action":"submit_profile", "submit":true } }
]
```

What the page proves, live: (1) ONE payload → a coordinated, accessibly-labelled form (the ADR-0051 seam:
the Field label IS the editor's accessible name); (2) `checks` → `setCustomValidity` → the **ui-field
inline error** (text-field is the wired error leg at G7 — the page puts checks on the TextFields, honest to
LLD-C9); (3) invalid submit → NO client message + first-invalid focus (the ADR-0054 gate); (4) valid submit
→ ONE `action` carrying the typed aggregate in `dataModel` (booleans stay booleans — the two-way binds wrote
the model). Page chrome MAY additionally render `provider.values()` from the provider's own `change` event
(dogfooding LLD-C7's FormSubmitDetail) — labelled as page IDL, not wire.

**Honest limitation on the page:** a checks-failing Checkbox/Select shows no Field error text (LLD-C9: only
text-field wires `formUserInvalid` at G7) — their validity surfaces through `reportValidity` on submit. The
blurb states this; it is the components backlog, not a page defect.

## 4 · Patterns page (deliverable c) — selection + sketches

`site/a2ui-patterns.html` + `site/pages/a2ui-patterns.{ts,css}`. Format: the a2ui-list `demoSection`
[payload | surface] grid, one `createRenderer` per demo, shown≡fed.

Selected **5** (fork F5 — Kim may swap; ranked by catalog expressibility × teaching value):

| # | Pattern | Needs (a)? | Catalog types | Proves / teaches |
|---|---|---|---|---|
| P1 | **Settings form** | YES | Card(+regions) · FormProvider · Field · Switch ×n · Select · Button(submit) | the coordinated-form idiom as an agent emits it in the wild; toggles two-way into `/settings/*`; submit gate |
| P2 | **Confirmation card (destructive action)** | no — today | Card · Text · Row · Button ×2 (`confirm_delete` vs `cancel`, `wantResponse:true` on confirm) | action NAMES as the contract; two buttons = two intents; `wantResponse` correlation (the reply is the server's) |
| P3 | **Wizard / stepper** | YES (fields) | Tabs(+Tab/TabPanel, bindable `selected`) · Field/TextField per step · a final submit | `selected` two-way = client state the agent can READ (`/wizard/step` rides the dataModel on submit); staged disclosure without server round-trips |
| P4 | **Dashboard tile row** | no — today | Row/Column · Card per metric · Text with `${…}` (e.g. `"${label}: ${value}${unit}"`) · list template over `/metrics` | display-only surfaces are cheap: one data array + one template card; interpolation composes labels |
| P5 | **Schedule picker card** | YES (TextField reach) | Card · Field ×2 · TextField `type=date` + `type=time` · Select (timezone) · Button(submit) | the Wave-5 date/time reach through the catalog; ISO canonical values in the model vs localized display |

Marked stretch (present to Kim, not in the default 5): **P6 master-detail with a simulated agent loop** —
selection cannot be pure-client (v1.0 pointers admit no computed index, so `/items/${/selected}/…` is
inexpressible); the honest version round-trips an `action` and the PAGE plays the agent (onClientMessage →
`ingest` an `updateComponents` for the detail card). It is the only pattern that teaches the server half of
the loop — but it introduces a new "simulated agent" page mechanic; include only if Kim wants the loop
lesson this wave. Chat-card and add/edit-list overlap P6's lesson / a2ui-list demo 3 — dropped.

Per-demo discipline: every payload finalizes 0-error through the real host; each blurb ends with "what this
proves" + "what an agent author should copy". No danger/destructive Button tone exists in the fleet
(`solid|soft|ghost`) — P2 uses variant contrast + wording, and the gap is noted for the components backlog,
not improvised.

## 5 · Build sequence (waves ↔ manifest nodes; seats; file-disjoint)

**Wave 0 — ratification (Kim).** Forks F1 (submit seam), F2 (naming law), F4 (TextField reach), F5 (pattern
set ± P6). ADR-0053/0054 flip to accepted only on the ruling (n1). Nothing dispatches before this.

**Wave 1 — `a2ui-builder` (one seat; single-package, shared types make it serial): catalog + renderer.**
n2a catalog.json rows → n2b factories (+ tests) → n2c WidgetFactory/registry gate mark → n3 renderer
#wireAction submit branch (+ zero-drift probes) → n4 SPEC §5.1/§5.2 repair. One dispatch, slice order as
listed (each edge in the manifest is a real data dependency). Gate per slice: jsdom suite + check.

**Wave 2 — `docs-writer` ×2 (file-disjoint, parallel): the pages.**
Seat A: n5 `a2ui-form.{html,ts,css}`. Seat B: n6 `a2ui-patterns.{html,ts,css}`. Both read-only on the
packages; payload sketches above are the spec. Vite MPA auto-discovers the new .html (no config edit).

**Wave 3 — integration (one seat, serial): TOC + gate.**
n7 `_page.ts` NAV + `main.ts` CARD_GROUPS (the ONLY shared-file edits — deferred to one serial slice) →
n8 `npm run check && npm test` at the integration commit. The A2UI NAV group is label-less, so the
site-toc component-group gate is unaffected; verify it green anyway.

## 6 · Open items / risks

- **No machine gate exists for demo-payload validity** (vitest includes `packages/*/src` only; the pages'
  errors surface visibly in their message logs — the shipped canvas/list precedent). Optional hardening,
  NOT this wave: widen the vitest include or move demo payloads behind a package-side corpus probe.
- **`context` path resolution is built** (2026-10-04, GH #1748, PR #1755): LLD-C9 `collectContext`
  resolves each context entry at click time, against the list item scope inside a template. When this
  decomp was written it was unshipped and context was emitted verbatim, so the pages kept `{path}` objects
  out of `context`. The aggregate still rides `sendDataModel` (ADR-0054 cl.4). No longer a flag for the
  corpus/streaming intakes.
- **Basic-catalog name verification:** the F2 recommendation cites A2UI Basic's `CheckBox.value` from
  design memory — if Basic alignment weighs in the ruling, the host should fetch the v1.0 Basic catalog
  and verify verbatim (repo-absence ≠ spec-absence).
