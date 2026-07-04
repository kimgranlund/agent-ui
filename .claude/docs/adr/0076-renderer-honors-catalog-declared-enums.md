# ADR-0076 — the renderer honors catalog-declared `enum`s at widget resolution: a literal the enum forbids is never applied

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | a2ui-builder territory (root-causing Kim's "remove align=center" — the mechanism choice is the build session's, implementing Kim's intent) |
> | **Ratified by** | Kim (2026-07-04) |
> | **Repairs** | `src/renderer/widget.ts` (LLD-C7 widget resolver — `enumOf` + `applies` gate on both the static-literal and bound-value `applyProp` paths; `entry.catalog` captured for the PropDef) · `src/renderer/widget.test.ts` (2 new tests: stub non-member drop + real-default-catalog end-to-end) |
> | **Supersedes / Superseded by** | Realizes the enforcement half of [ADR-0075](./0075-ui-column-canvas-root-stretch-no-center.md) (the `Column.align` narrowing). Relates ADR-0016/0030 (the enums it now honors). Does not reverse any prior decision — it makes the catalog's declared enums LOAD-BEARING at render, where they were previously advisory. |

## Context

Nothing enforced catalog **enum membership**, so an agent-emitted value the enum forbids reached the DOM:

- **The wire validator checks a prop's type/shape, not enum membership.** `validateA2ui` accepts `align="center"` on a `Column` and `gap="2rem"` — both are strings of the right shape. (This is why they rendered at all.)
- **The catalog factory applies props via the property SETTER.** `columnFactory` (and the container/form family) route through `accessorFactory` → `setProp` → `el[prop] = value`. Traced in the kernel (`dom/props.ts:243`): the property setter stores the value **verbatim** into the signal — only the ATTRIBUTE path (`coerceAttribute`, `props.ts:272`) runs the prop's enum codec. So `el.align = 'center'` reflects straight out to `align="center"`, bypassing the component's own enum snap.

Net: [ADR-0075](./0075-ui-column-canvas-root-stretch-no-center.md)'s `Column.align` narrowing (dropping `center`) was **inert** — the agent's `align="center"` still lingered in the DOM. The value was already visually inert too (the control's CSS repoints only on declared members), but a stray attribute in the rendered output is a faithfulness defect: the DOM disagrees with the catalog, the single source of truth for what a prop may be.

## Decision

The **widget resolver** (renderer LLD-C7, `widget.ts` — the catalog↔element boundary, where the `CatalogEntry.catalog` PropDefs are in scope) consults each prop's declared `enum` and **skips applying a LITERAL value the enum does not list**. `enumOf(componentDef, prop)` returns the closed string enum or `undefined`; `applies(members, value)` is `members === undefined || members.includes(value)`. The gate wraps `applyProp` on BOTH paths — the static-literal branch and the resolved-value inside the scope-owned bound-prop effect (a `{path}` resolving to a non-member is skipped too, re-checked each tick).

Unconstrained props (no PropDef, a boolean/number schema, or a string schema with no `enum`) and members always apply; a stub catalog without a `.catalog` is defensively treated as unconstrained.

## Consequences

- **[ADR-0075](./0075-ui-column-canvas-root-stretch-no-center.md) becomes effective:** `center` ∉ the narrowed `Column.align` enum ⇒ the resolver never applies it ⇒ the live `ui-column` carries no `align="center"` and renders at its `stretch` default.
- **General cleanup, no visual change:** any non-member literal is dropped (e.g. `gap="2rem"` → the column's default gap). This is visually identical to before — such values were already CSS-inert; only the stray DOM attribute is gone.
- **The gate is SELECTIVE, not blanket:** `justify="center"` still applies (`center` IS a `Column.justify` member); an unconstrained prop is untouched. The catalog stays the sole authority.
- **No self-correct churn, corpus untouched:** this does NOT fail validation, so the live-agent loop does not burn rounds on it, and valid corpus/example payloads are unaffected. (The alternative — validator-level enum enforcement + self-correct — is deferred; see below.)
- **Every catalog enum is now honored at render** — not just `Column.align`. A future catalog that narrows any enum gets DOM-faithful rendering for free.

## Acceptance

- `src/renderer` + `src/catalog` suites green (385); 2 new `widget.test.ts` tests: a stub catalog (non-member `align` dropped, unconstrained `gap` kept, member `align` applied) and the **real default catalog** (`Column align="center"` → no `align` attribute; `justify="center"` → applied).
- Full jsdom suite green (2369); `vite build` + `dist/` leak-check clean.
- The 26-test regression from an initial non-defensive `entry.catalog.components` (stub registries carry no `.catalog`) was closed with optional chaining — proving the change is safe under the slice's stub harness.

## Alternatives considered

- **Enforce enum membership in the VALIDATOR → self-correct.** Rejected for now: broader blast radius (would newly REJECT any payload using a non-enum value, including whatever the corpus/agent currently emits), and it fails the payload → self-correct churn or a "could not compose" halt. The render-skip is lower-risk and visually identical (invalid values were already inert). A future ADR may promote enforcement into the validator once the corpus is known-clean.
- **Make the property setter coerce enum values.** Rejected: a broad kernel change to `dom/props.ts` affecting every component's every prop, to fix a catalog-boundary concern; high blast radius for a narrow need.
- **Bespoke per-component factory hardcoding allowed values.** Rejected: duplicates the catalog enum in the factory — two sources of truth. The renderer already has the catalog; enforce there.
