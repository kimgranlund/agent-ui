# Rubric — A2UI Payload (validity · composition)

> The referential standard an A2UI payload is graded against. Implements
> [`../specs/specs/a2ui-expert-harness.spec.md`](../specs/specs/a2ui-expert-harness.spec.md) SPEC-R3;
> the dimension list is fixed by [`../specs/llds/a2ui-harness-wiring.lld.md`](../specs/llds/a2ui-harness-wiring.lld.md) §4.

The maker `a2ui-composer` is graded by this rubric; the critic `a2ui-reviewer` scores against it in an
independent context — the composer never self-grades (SPEC-R8). It rides the SPEC-R6 loop: the deterministic
gates run **first** (the `validate-payload` CLI), and this rubric's `[review]` dimensions are scored **only on a
gate-green payload** — a payload that does not validate cannot be judged on composition. Dimension IDs are `P#`;
each is typed **[gate]** (a fact the CLI decides — the anchor CITES that verdict, it never re-decides it,
`process.md` rule 1) or **[review]** (judgment grounded in the seed shelf + the default catalog). Scale 1–5;
1 = failure, 3 = adequate, 5 = excellent.

## Gate axis — deterministic validity (P1–P3)

**Evidence for every `[gate]` dimension is one probe:** the payload-scoped `validate-payload` CLI —

```
node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts <payload.json> --catalog agent-ui
# exit 0 → { ok: true, repairs: [...] }     (ADR-0061 heal applied first; repairs named)
# exit 1 → [{ code, path, message }]         (the shared validateA2ui verdicts, unforked — LLD §6)
```

The CLI is `heal` + `validateA2ui` + the default catalog (LLD §5/§6); `validateA2ui`'s reach is raw-string parse,
per-message schema, `SUPPORTED_VERSIONS`, the six envelopes, catalog conformance, id-graph, and pointer syntax.
These dimensions cite that one verdict — they do **not** cite the shard-scoped `corpus/corpus-data.test.ts` gate
(a different, corpus-record-level check) and they do **not** re-judge what the CLI decides.

| # | Dimension | Type | What it checks (evidence) | 1 → 3 → 5 |
|---|---|---|---|---|
| P1 | Schema & protocol validity | [gate] | The CLI parses the raw payload and validates every message against the per-message schema, `SUPPORTED_VERSIONS`, and the six-envelope shape (`createSurface` · `updateComponents` · `updateDataModel` · …) | 1: CLI exits 1 with a SCHEMA / version / envelope code — an unsupported `version`, a malformed `updateComponents` envelope, a non-string `surfaceId` · 3: no code in this class — every message is schema-valid at a supported version, but heal rescued a form defect first (`repairs` names `fence-strip` / `trailing-comma` / `single-object-envelope` / `version-fill`) · 5: CLI exits 0 with `repairs: []` — schema-clean exactly as authored, no ADR-0061 heal needed (the `canvas-button` two-line shape) |
| P2 | Catalog conformance | [gate] | `validateCatalogConformance` against the named catalog (`--catalog agent-ui` → `src/catalog/default/catalog.json`): every `component` is a catalog row, every property is declared, every value matches the declared `type` keyword, and a `{path}`/`{call}` binding sits only on a `bindable` prop. The catalog's `enum` is NOT checked here — the validator tests the `type` keyword only, so off-enum values are idiom, judged in P5 | 1: CLI exits 1 with a CATALOG code — an unknown component (`component: "Badge"`), an undeclared property (a `label` on a `Text`), a type mismatch (`elevation` a number, not the string `"1"`), or a `{path}` on a non-`bindable` prop · 3: no CATALOG code — every component is a declared row, every prop value matches its declared `type`, and every bind sits on a `bindable` prop · 5: + the payload is authored-clean end to end (`repairs: []`) — heal never repairs catalog defects (ADR-0061 is form-only), so a clean conformance verdict on a no-heal payload is fully hand-correct |
| P3 | Reference integrity | [gate] | `checkIdGraph` + pointer syntax: exactly one `root`, every string `child`/`children` reference resolves to a declared id (no dangling), the child graph is acyclic, and every `{path}` is syntactically valid (`isValidBindingPointer`, absolute or list-item-relative per ADR-0024). NOTE the CLI does NOT detect duplicate ids (a silent `byId` upsert) nor resolve a list template's `componentId` (object `children` is skipped) — both are judged in the review axis (P4, P6) | 1: CLI exits 1 with an IDGRAPH or POINTER code — `children: ["ghost"]` names no node, no root or two roots, a cycle, or a malformed `path` · 3: no IDGRAPH/POINTER code — one root, every string reference resolves, acyclic, pointer syntax valid · 5: + the payload is authored-clean end to end (`repairs: []`) — the complete id-graph and every pointer are correct as authored, with no heal-rescued form defect anywhere |

> **The `[gate]` excellence tier (score 5) shares one signal — `repairs: []`.** Heal's repair list is closed
> and form-only (ADR-0061, `corpus/heal.ts`: `fence-strip` · `trailing-comma` · `single-object-envelope` ·
> `version-fill`); it never repairs a semantic defect — an unknown component, a bad pointer, a missing or
> duplicate root all flow through unchanged and reject at the validator. So an empty `repairs` array is the
> CLI's one authored-clean signal: a payload that validates with `repairs: []` was hand-correct, not
> machine-rescued. A gate dimension scores 5 when its class is clean AND the payload needed no heal; it scores
> 3 when its class passes but heal ran (P1 rescued a form defect, or P2/P3 leaned on heal elsewhere).

## Review axis — composition quality (P4–P7)

**Evidence for every `[review]` dimension** is the 11-seed shelf (`packages/agent-ui/a2ui/src/examples/`) and the
default catalog (`src/catalog/default/catalog.json`, the ADR-0053 form-family rows). Cite the specific seed the
payload should read like. These are `[review]` because they need judgment the CLI does not make — notably whether a
`{path}` resolves against the data model is **not** gate-checked (that is corpus admission's shard-scoped
pointer-resolution stage), so binding correctness is judged here.

| # | Dimension | Type | What it checks (evidence) | 1 → 3 → 5 |
|---|---|---|---|---|
| P4 | Composition coherence | [review] | Structure: a flat adjacency-list `components[]` joined by id references, a single root, no duplicate ids, idiomatic container nesting and grouping | 1: multi-root, nested-JSON instead of adjacency list, orphaned subtrees, or a control used as a container's parent · 3: single root, flat adjacency list, no duplicate component id (the id-graph upserts silently — a dup is a lost node the CLI will not flag), `Card → CardContent → Column/Row` nesting (the `pattern-settings-form` spine); `Field` wraps exactly one `child`; `Select` holds `Option` children · 5: + the tree reads like a shelf seed — `gap` tokens (`md`/`sm`/`xs`) express hierarchy, a `Row` with `justify: "end"` carries the action bar (`pattern-confirmation-card`), and no redundant wrapper nodes remain |
| P5 | Catalog idiom fidelity | [review] | Node shapes are idiomatic against the default catalog + seed shelf: catalog-declared spellings, enum values the catalog names, values the seeds actually use — this axis owns the enum-range check the P2 gate does not make | 1: a shape that PASSES the gate but is off-idiom — `Button variant: "primary"` (the catalog leaves `variant` an un-enumed string, so the gate accepts it, but the seeds use `solid`/`soft`), `Text variant: "title"` (the catalog `enum` is not gate-checked, so an off-level heading passes the CLI yet names no real level h1–h5/caption/body), or the wrong catalog component for the job · 3: every node matches a catalog-row shape as the seeds use it — Button `variant` `solid`/`soft` + `action: { action, submit?, wantResponse? }`, `Card elevation: "1"`, TextField `type`/`currency`/`step`/`min`, and every enum-valued prop is in range · 5: + advanced idiom used where apt and correct: `checks: [{ call, args, message }]` validators (`generative-form`), `Field.description` helper text, `Tabs.selected` bound to client state (`pattern-wizard`) — indistinguishable from a shelf seed |
| P6 | Binding hygiene | [review] | Data binding: `{path}` binds on the right props, `${…}` DynamicString templates, positional list templates whose `componentId` resolves, two-way round-trips — against the seeded `updateDataModel` value | 1: a `{path}` names a path absent from the data model, a static value where a bind is intended (or the reverse), or a list template missing its `componentId` · 3: absolute binds (`{path: "/form/name"}`) resolve against the seeded model; `children: { path, componentId }` templates are positional (ADR-0024), their `componentId` names a declared node (the CLI's id-graph skips object `children`, so it does not resolve this), and their item nodes use RELATIVE item paths (`{path: "name"}`); `sendDataModel: true` set when an action round-trips the model · 5: + `${…}` templates compose labels from relative item paths (`"${value}${unit}"`, `pattern-dashboard-tiles`; `"${name} — ${role}"`, `list-people`), nested templates stay relative (`list-nested`: `items` → `/sections/{i}/items`), and interactive binds round-trip (`list-form` TextField `value: { path: "value" }`) — every bind's scope and direction is correct |
| P7 | Accessibility intent | [review] | Semantic labelling and intent carried structurally, never by color alone: every control named, headings real, destructive/submit intent explicit | 1: an unlabelled control (a bare `TextField` with no wrapping `Field`/`label`), heading text left as `body`, or destructive intent left to a tone the fleet does not provide · 3: every control is labelled — a `Field` wraps it with a `label` (the ADR-0051 accessible-name seam, `generative-form`) or the control carries its own `label` (`Switch`/`Checkbox`); headings use real heading `variant`s (`h4`/`h5`, ADR-0025) · 5: + intent is carried where the fleet has no tone for it — a destructive action reads from its action NAME + wording (`confirm_delete` + "Delete workspace", `pattern-confirmation-card`), required fields are flagged (`required: true` + `checks`), and submit is gated through `FormProvider` + `action.submit: true` (`generative-form`), not left implicit |

## Gate to promote

A payload is promotable when **both** hold:

- **Every `[gate]` dimension (P1, P2, P3) is a hard pass** — the `validate-payload` CLI exits 0 with no code in that
  dimension's class. A `[gate]` below 4 (the CLI exits 1) blocks promotion regardless of the review scores: a
  mechanically-decided failure is not negotiable (`process.md` rule 1).
- **Every dimension (P1–P7) scores ≥ 4.** No review strength offsets a gate failure, and no clean gate offsets a
  weak composition.

This is the SPEC-N4 maker bar: the composer's reference payload must score ≥ 4 on every dimension, produced within
the SPEC-R6 bound.

**Top failure to look for first:** a payload that *reads* as composed but fails a `[gate]` — an unknown component,
a dangling `children` id, or an off-enum `variant`. Run the CLI and score P1–P3 **before** the review axis; a
payload that does not validate cannot be graded on composition (the gates-first order of the loop, SPEC-R6).
