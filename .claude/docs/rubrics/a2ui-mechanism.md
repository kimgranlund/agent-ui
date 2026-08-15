# Rubric — a2ui-mechanism (a compose-time mechanism function)

> Status: proposed · v0.1 · 2026-08-06 · Layer: rubric (the referential standard `a2ui-review-agent` grades a
> compose-time mechanism function against).
> Charter: GH #493 (PR #492's escalation — three of five M-D artifacts fit `a2ui-catalog.md` only by
> analogy) · extends [`../spec/a2ui-expert-harness.spec.md`](../spec/a2ui-expert-harness.spec.md)
> SPEC-R3's rubric set (its v0.4 amendment). Sibling of [`a2ui-catalog.md`](./a2ui-catalog.md) — split,
> not widened, because a mechanism function shares none of a catalog row's evidence (no `catalog.json`
> PropDef, no `WidgetFactory` mapping); see that rubric's "Scope & siblings" note for the routing.
> Spec IDs: unqualified `SPEC-R#`/`SPEC-N#`/`AC#`/`OF#` cites refer to
> [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) (the
> specimen's owning contract) — several estate specs mint their own `SPEC-R2`, so the qualification is
> load-bearing.

The standard a **compose-time mechanism function** is authored against and graded by. The artifact is ONE
exported mechanism — a function (or the tight function cluster realizing one mechanism) in
`@agent-ui/a2ui` that *assembles, derives, or selects* an A2UI artifact at compose/derive time, distinct
from a catalog row's static mapping. **The reference specimen the anchors cite is `catalog/compose.ts`**
(`composeCatalog` · `composePersonaCatalogs` · `loadCatalogFragment` · `derivedCatalogIdsFor`, PR #492) —
the `compose.ts`-class shape any future mechanism (a selection seam, a derivation helper) is graded like.

Dimensions are typed **[gate]** (a named probe decides it — the anchor cites the realized test run, it
never re-judges the verdict; `process.md` rule 1) or **[review]** (judgment grounded in `file:line` + the
committed probe results). M2 is **[review], definitional**: its deterministic FLOOR (the layering
trip-wire + the downstream-gate biting test, both cited from `npm test`) is a `[gate]`-style fact, but
its core question — the shipped seam was CALLED, not re-implemented — is settled by reading the
mechanism's source, which no realized script decides; it hard-gates promotion exactly as a `[gate]`
would. Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent.

## Dimensions

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors cite the realized probe / the shipped specimen) |
|---|---|---|---|---|
| M1 | Contract tests & negative controls | [gate] | The mechanism's co-located `*.test.ts` (run via `npm test`) covers the happy path, the identity/empty case, AND every declared diagnostic code — each tripped by a planted input at the guard it claims to prove (anti-vacuous: the negative control must reach the guard, not fail earlier for another reason) | 1: a declared diagnostic code no test trips, or a "negative" that never reaches its guard (vacuous — green for the wrong reason) · 3: the suite is green with the identity case (`components: {}` composes to a content-equal copy) plus one planted trip per code (`CATALOG_COMPOSE_COLLISION`, `CATALOG_COMPOSE_UNKNOWN_TARGET`) at the right site · 5: + every guard is proven on EVERY call path that reaches it (`assertLegalTarget` tripped via both `composePersonaCatalogs` AND `derivedCatalogIdsFor`), including the registered-but-illegitimate input as its own control (the `a2ui-basic` canonical-URI alias throws `UNKNOWN_TARGET` despite resolving in the registry) |
| M2 | Seam reuse, never a fork | [review], definitional | The mechanism reaches the SHIPPED validation/registration seams instead of re-implementing or forking them — settled by READING the mechanism's imports/call sites; the deterministic floor it cites (never re-judges): the package's `layering.test.ts` trip-wire green, and the downstream-gate biting test green where one exists | 1: a re-implemented validator or a second registration path — downstream gates (`CATALOG_FACTORY_MISSING`, `loadCatalog` re-validation) no longer apply to the mechanism's output · 3: the shipped seams are called, not copied (`loadCatalogFragment` reuses `validateComponent`/`validateFunctions`; `composePersonaCatalogs` calls `registry.register`, never a fork of it — persona-catalog-composition.spec.md SPEC-N4), each call site cited at `file:line`, and `layering.test.ts` is green · 5: + a test shows the downstream gate BITING the mechanism's own output (a derived catalog with a factory gap trips `CATALOG_FACTORY_MISSING` at register — the reuse proven, not asserted) |
| M3 | Fail-loud policy fidelity | [review] | Every ruled policy the mechanism carries (collision handling, unknown/illegitimate inputs, defaults) is implemented AS ITS DECISION RECORD STATES — reject-loud with a typed diagnostic code from a closed `as const` set, synchronously at construction, never a silent skip/override — and the code's doc comments cite the ruling (SPEC-R#/ADR clause/OF#) that decided each policy | 1: a silent skip or override where the ruling says reject-loud, an untyped `throw`, or an implemented policy that contradicts its cited clause (a fabricated citation is a drift tell — verify it) · 3: each policy matches its cited clause (`compose.ts`: OF1 reject-loud collision · persona-catalog-composition.spec.md SPEC-R2 AC6 unknown target incl. the alias · the single `targetsFor` default), thrown as a typed error mirroring the family's error shape (`CatalogComposeError` ≙ `RegistryError`) · 5: + the edge interactions are ruled, not improvised — each stated with the clause that decided it (a collision on one base never blocks a different base's pairing, SPEC-R2 AC3; the empty fragment is AC1's identity case) |
| M4 | Purity & single-sourcing | [review] | The compose/derive step is a pure derivation — inputs untouched, a NEW document returned, the throw lands before any partial result escapes — and every constant or enumeration the mechanism shares with a projection/consumer is single-sourced so the two cannot drift | 1: a partial merge escapes on failure, the mechanism mutates its base input, or a default/legal-set two call sites each hardcode · 3: pure in/out (`composeCatalog` spreads, never mutates `base`; collision throws before return), and shared facts read through ONE site (`targetsFor` · `LEGAL_TARGET_CATALOGS` · `derivedCatalogId`) · 5: + any registry-free static projection (`derivedCatalogIdsFor`-class) provably enumerates the same pairings as the live step — same helper on both paths, or a test pinning the equality |

## Gate to promote (the mechanism is admissible / shippable)

- **M1 ([gate]) ≥ 4 — hard.** An untripped diagnostic code or a vacuous negative blocks admission
  regardless of the other scores.
- **M2 ([review], definitional) ≥ 4 — hard.** A forked seam blocks admission the same way; its
  deterministic floor (layering green + the biting test green) is cited, the called-not-copied read is
  the judgment on top.
- **Every remaining [review] dimension (M3, M4) ≥ 4.**
- **No compensation across dimensions** — a 5 elsewhere cannot offset a sub-4 dimension.

The `a2ui-review-agent` critic scores against this rubric in a fresh context (generator ≠ critic,
a2ui-expert-harness.spec.md SPEC-R8); the co-located test suite via `npm test` (exit code, never grep)
is the deterministic half.

**Top failure to look for first:** a forked or re-implemented seam (M2 = 1 — the mechanism's output
silently escapes the gates every other artifact passes through, so nothing downstream can be trusted),
then a vacuous negative control (M1 — a guard that has never actually been watched to bite).
