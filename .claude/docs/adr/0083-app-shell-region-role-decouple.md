# ADR-0083 — decouple the app-shell region's column from its ARIA landmark

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-06 |
> | **Proposed by** | planner — the M1 a2ui-live dogfood (LLD-C9) surfaced the coupling; a refinement of the ratified generic region model |
> | **Ratified by** | Kim — 2026-07-06 |
> | **Repairs** | SPEC-R3 (+ §4 typed contracts) (`spec/agent-app-shell.spec.md`) · LLD-C3 (`lld/agent-app-shell.lld.md`) — now NORMATIVE (ratified 2026-07-06) |
> | **Supersedes / Superseded by** | Refines (does not reverse) the ratified generic region model (LLD §4/§7.1, Kim 2026-07-05). Relates ADR-0082 (same M1 app-shell family). No ADR superseded. |

## Context

The ratified generic region model (Kim, 2026-07-05, recorded in LLD §4/§7.1 — there is no standalone region ADR; this ADR gives that decision its first ADR home while refining it) gives `ui-app-shell-region` one prop: `region: 'banner'|'navigation'|'main'|'complementary'|'contentinfo'`. That single value drives **two** independent concerns at once: the **grid column/area** placement (`[region=navigation] { grid-area: nav }`) **and** the **ARIA landmark role** (`REGION_ROLE[region]`, e.g. `navigation → role="navigation"`).

The M1 a2ui-live dogfood (LLD-C9) hit the coupling: the chat composer belongs in the **left column** (`region="navigation"` — the layout slot), but `navigation` is the **wrong landmark** for a chat input area — `complementary` (or `form`) reads correctly for assistive tech. With the values fused, the author cannot pick the column and the landmark independently: choosing the left column forces a `navigation` landmark. This is a real accessibility defect (a mislabelled landmark), not a cosmetic one.

## Decision

We will **decouple the column from the landmark**, additively and back-compatibly:
- `region` continues to drive the **grid column/area** (unchanged) and continues to supply the **default** landmark via `REGION_ROLE[region]`.
- A new **optional** `landmark` prop (reflected literal-union over the ARIA landmark set — `banner | navigation | main | complementary | contentinfo | region | form | search`) **overrides the ARIA role only**, independent of the column. Absent ⇒ the role defaults to `REGION_ROLE[region]` (existing behaviour, back-compat). Present ⇒ the element sets that landmark via `ElementInternals` (never a host attribute).
- Resolution is `internals.role = landmark || REGION_ROLE[region]` — the `||` (NOT `??`) is load-bearing: the prop is `prop.enum([…, ''], '')`, so the unset value is the empty string `''`, and `'' ?? x` returns `''` (nullish-coalescing misses `''`) whereas `'' || x` correctly falls through to the default. An out-of-set `landmark` coerces to `values[0] = ''` (the reflected-enum precedent — never throws), which likewise falls through under `||`.

a2ui-live's composer then authors `<ui-app-shell-region region="navigation" landmark="complementary">` — left column, correct landmark. SPEC-R3 (+ §4) gains the override; LLD-C3's `REGION_ROLE` becomes a default-resolver.

## Consequences

- **Additive + back-compatible** — every existing `region` usage keeps its current landmark; nothing changes unless `landmark` is set. No migration.
- **Author responsibility preserved** — exactly one `main` landmark per document remains the author's responsibility (as it already is for the region model); `landmark="main"` on a second region is an author error the platform surfaces (duplicate main), not something the generic element can prevent. Documented.
- **Small surface growth** — one optional prop + one descriptor entry on `ui-app-shell-region`; the family-coherence/contract↔props gates cover it. Marginal.
- **The generic model is vindicated, not reversed** — the decouple is only clean *because* the region is a generic `[region]` element; five named `ui-app-shell-{region}` sub-elements would have baked the landmark into the tag name, making this override impossible without new tags. The honest generic-vs-named framing (LLD §7.1) stands; this is evidence for the ratified choice.

## Alternatives considered

- **Rename `region` values to pure layout names** (`start`/`end`/`main`/`top`/`bottom`) and always require an explicit `landmark` — rejected: a bigger, breaking change that loses the readable landmark-named defaults and forces every author to specify a landmark; the coupling is fixed more cheaply by an optional override.
- **A `role` attribute instead of `landmark`** — rejected: `role` as a host attribute collides with the platform ARIA attribute and violates the fleet's ARIA-via-`internals`-only rule; `landmark` is unambiguous and sets `internals.role`.
- **Leave it coupled; document "pick the column, accept its landmark"** — rejected: it ships a knowingly-mislabelled landmark (the a2ui-live composer), a real a11y defect, to save one optional prop.
