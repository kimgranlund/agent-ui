# A2UI conformance suite

SPEC-R5 of [`a2ui-ecosystem-alignment.spec.md`](../../../../.claude/docs/spec/a2ui-ecosystem-alignment.spec.md)
(GH [#476](https://github.com/kimgranlund/agent-ui/issues/476)): **no A2UI spec-conformance suite
exists upstream** — verified against upstream issue
[a2ui-project/a2ui#2150](https://github.com/a2ui-project/a2ui/issues/2150). This directory packages
this repo's own validator fixtures as an **implementation-agnostic, payload-in / verdict-out
conformance suite**, runnable against ANY A2UI validator — this repo's included. It is offered as a
contribution lane to the upstream `a2ui-project/a2ui` repo (see #2150) and, either way, stands as a
differentiation claim: this repo ships a zero-dependency validator + a checkable conformance suite
where upstream today ships neither (the reference web renderer carries a hard Zod dependency,
[a2ui-project/a2ui#2160](https://github.com/a2ui-project/a2ui/issues/2160) — the counterexample this
suite's zero-dep format deliberately does not follow).

## Format — pure data, zero repo-internal imports

- **`manifest.json`** — suite metadata: which catalog document (plain JSON) each fixture validates
  against, the expected-verdict shape, and the failure-code vocabulary. Plain JSON, no imports.
- **`fixtures.jsonl`** — one fixture per line, each a JSON object:

  ```json
  {
    "name": "valid-button",
    "description": "...",
    "catalogId": "agent-ui",
    "payload": [ /* an A2UI message array — the exact wire shape a validator receives */ ],
    "expectedVerdict": { "valid": true, "failures": [] }
  }
  ```

  `payload` is either an A2UI message array or (for the one `parse-failure` fixture) a raw string —
  exactly what a real client hands a validator. `expectedVerdict` is `{ valid, failures: {code,
  path}[] }` — the shared `ValidationVerdict` shape
  (`packages/agent-ui/a2ui/src/renderer/validate.ts`). Both files are **pure JSON data — no
  TypeScript, no imports of any kind** — the AC1 requirement. Any A2UI validator in any language can
  consume them directly: read `manifest.json` for the catalog map, iterate `fixtures.jsonl`, run each
  `payload` through the validator under test, and diff the result against `expectedVerdict`.

  **`atFinalize` (optional boolean; `at_finalize` in the `suites/*.yaml` port).** A fixture MAY carry
  `"atFinalize": true`, asserting its payload is a **COMPLETE** set — nothing more is coming for it. It
  is a MODE input to the validator, not an expectation. Absent (19 of the 21 fixtures) means the
  ordinary streaming-tolerant mode, where a missing `root` or a dangling reference may still be filled
  in by a later message (runtime SPEC-R4). At finalize, a surface created with an empty component set
  additionally fails `IDGRAPH ${surfaceId}:root-missing`
  ([ADR-0187](../../../../.claude/docs/adr/0187-validator-finalize-signal.md), GH #829).

  A validator that does not implement a finalize mode can still run this suite: skip the one fixture
  carrying the flag (`abandoned-surface-at-finalize`) and every other fixture's expectation is
  unchanged. A validator that ignores the flag rather than skipping the fixture will mismatch on that
  one row only — the flag is emitted on exactly the rows that need it, never blanket, so its presence
  is the signal.

## Verdict-matching semantics

A fixture **PASSES** iff the validator-under-test's actual verdict has `valid === expectedVerdict.valid`
AND its `failures` match `expectedVerdict.failures` as a **set** of `(code, path)` pairs — order is not
significant (a different validator may walk a component tree in a different order than this repo's
own [ADR-0024](../../../../.claude/docs/adr/0024-a2ui-v1-positional-dynamic-list.md) positional
walk). A run of the whole suite is green iff **every** fixture passes.

## Coverage

21 fixtures: four known-good default-catalog payloads, one negative fixture per protocol/catalog
failure stage (`PARSE`, `SCHEMA` ×2 shapes, `VERSION_UNSUPPORTED`, `CATALOG`, `IDGRAPH` ×4 subtypes —
root-missing / second-root / dangling child / cycle, `CONTAINMENT`, `POINTER` ×2 — a component binding
and an `updateDataModel.path`), the ADR-0187 finalize-granularity PAIR (below), and the three pinned
upstream `a2ui.org` Basic Catalog examples
([ADR-0169](../../../../.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md) cl.1's
interop-anchored seed named by GH #476 — `interactive-button` / `simple-login-form` / `product-card`,
each translated ONLY at the envelope `version` field, `v0.9` → `v1.0`; every component-tree byte is
verbatim from the fetched upstream source).

`CONTAINMENT` ([`a2ui-container-vocabulary.spec.md`](../../../../.claude/docs/spec/a2ui-container-vocabulary.spec.md)
SPEC-R6): a `CardHeader`/`CardContent`/`CardFooter` node whose id-graph parent is not a `Card` — one
negative fixture (`containment-stray-region`) plus one mark-free known-good structured-container shape
(`valid-structured-card-mark-free`); and — landed with the S5 slice now that the `format` mark has
shipped — `valid-structured-container`, the fixture exercising the R1–R4 catalog marks
(`format`/`slot`/`label`): the structured header with slotted `Icon`/bound-status `Badge`, two
`label`/value rows, and a `CardFooter` action, sourced from the SPEC-R9 corpus exemplar.

**The finalize-granularity pair** ([ADR-0187](../../../../.claude/docs/adr/0187-validator-finalize-signal.md),
GH #829) — `abandoned-surface-at-finalize` and `abandoned-surface-mid-stream` carry the **same payload**
(a lone `createSurface`, no components ever) and differ ONLY by the `atFinalize` flag: flagged →
`IDGRAPH s-abandoned:root-missing`, unflagged → clean. That identity is the point, and it is asserted as
a test (`run.test.ts`): "a legitimate mid-stream prefix" and "an abandoned, permanently-empty surface"
are byte-identical wire shapes, so nothing except the caller's completeness assertion can separate them.
The unflagged twin is simultaneously the regression proof that streaming tolerance did not move.

## Running this repo's own validator against the suite

```
node --experimental-strip-types packages/agent-ui/a2ui/tools/conformance/run.ts
```

Exit 0 — every fixture's actual verdict, from this repo's `validateA2ui`
(`packages/agent-ui/a2ui/src/renderer/validate.ts`), matches its `expectedVerdict`. Exit 1 — prints
the mismatching fixtures (name, expected, actual) to stderr. This script is the repo-side leg only;
the format contract that makes the suite implementation-agnostic lives entirely in `manifest.json` +
`fixtures.jsonl`, not here.

## Upstream `suites/*.yaml` port (GH #616)

Upstream landed its own conformance convention — `agent_sdks/conformance/suites/*.yaml`
(a2ui-project/a2ui#2182, following the #2150 scoping thread) — after this pack already existed. GH
[#616](https://github.com/kimgranlund/agent-ui/issues/616) ports our fixtures into that SAME row
shape as a **sibling `suites/` directory**, so a contributor (or any tool already speaking upstream's
convention) can point straight at it.

`suites/validator.yaml` and `suites/catalog.yaml` are **generated, never hand-edited** —
`fixtures.jsonl` stays the one canonical source (this repo's own GH #406 silent-divergence class: two
hand-maintained enumerations of one truth). The generator + drift gate live in
`packages/agent-ui/a2ui/tools/conformance/`:

- **`generate-suites.ts`** — pure `buildSuites(fixtures)` function + a guarded CLI entry (the
  `run.ts` idiom already in this folder). Hand-rolled YAML string building — **no YAML library, zero
  new deps (SPEC-N5)**: every row's scalar/collection VALUE is emitted via `JSON.stringify`, which is
  valid YAML because a YAML 1.1/1.2 parser accepts JSON flow syntax as a value verbatim (a
  double-quoted YAML scalar is a strict superset of a JSON string literal). Only the row structure
  (`- `, `key:`, indentation, the blank line between rows) is hand-rolled.
  Regenerate: `node --experimental-strip-types packages/agent-ui/a2ui/tools/conformance/generate-suites.ts`
- **`suites-driftwire.test.ts`** — the byte-identity drift gate (the components package's
  `props-gen-driftwire.test.ts`/`generate-props.mjs` pairing, ported here): regenerates every
  `suites/*.yaml` file in-memory from the real `fixtures.jsonl` and diffs against the committed bytes.
  RED the moment a `suites/*.yaml` file is hand-edited, or a fixture falls out of sync with
  `SUITE_MEMBERSHIP` (every fixture claimed exactly once, none orphaned). Runs under `npm test`.

### Fixture → suite mapping

The split mirrors upstream's own validator/catalog file-granularity CONCERN boundary, not a
`catalogId` split: `validator.yaml` carries protocol-pipeline mechanics that hold regardless of which
catalog is targeted; `catalog.yaml` carries catalog-document/vocabulary-scoped concerns (the CATALOG
membership-allowlist code, the CONTAINMENT container-region rule — both hardcode default-catalog
component-type names, so neither holds "regardless of which catalog is targeted" — plus every
catalog-interop known-good payload).

| Suite | Fixtures | Failure codes covered |
| --- | --- | --- |
| `suites/validator.yaml` | `parse-failure` · `bad-envelope` · `missing-surfaceId` · `unsupported-version` · `bad-pointer-binding` · `bad-pointer-datamodel` · `missing-root` · `duplicate-root` · `dangling-child` · `cycle` · `abandoned-surface-at-finalize` · `abandoned-surface-mid-stream` | PARSE, SCHEMA ×2, VERSION_UNSUPPORTED, POINTER ×2, IDGRAPH ×4 + the ADR-0187 finalize pair |
| `suites/catalog.yaml` | `valid-button` · `valid-list` · `unknown-component` · `upstream-interactive-button` · `upstream-simple-login-form` · `upstream-product-card` · `containment-stray-region` · `valid-structured-card-mark-free` · `valid-structured-container` | CATALOG, CONTAINMENT, plus 6 known-good (3 default-catalog, 3 `a2ui.org` interop) |

### Row shape — field-by-field, against the fetched upstream examples

Fetched `validator.yaml` / `catalog.yaml` / `parser.yaml` from
`a2ui-project/a2ui@main:agent_sdks/conformance/suites/` (2026-08-13) to extract the real row shape
before writing the generator. Every row here carries: `name` · `description` · `catalog: {version,
catalogId, catalog_schema}` · `action` · `payload` · an expected-outcome field — the same top-level
keys upstream's own rows use.

**Three deliberate mismatches** (named, not forced-fit — see `UPSTREAM-PROPOSAL.md` for the same note
addressed to upstream maintainers):

1. **Outcome field** — upstream's `expect_error: {category, message}` (or a bare string) names a
   SINGLE first-raised exception; a row with no `expect_error` at all means success. This repo's
   validator returns a full `ValidationVerdict` — a SET of `{code, path}` failures, order-independent
   (ADR-0024) — never a single first-raised exception. Squeezing that into upstream's singular field
   would be lossy, so every row here carries `expect_verdict` instead: the shared `ValidationVerdict`
   shape verbatim, valid or not.
2. **No `catalog.yaml` action-vocabulary analog** — upstream's `catalog.yaml` suite exercises
   catalog-SCHEMA *transforms* (`prune` / `render` / `load` / `remove_strict_validation` /
   `verify_cuttable_keys`) — pruning disallowed components out of a schema, rendering a schema as LLM
   instructions, etc. This repo's validator has no such operation: it only checks whether a payload's
   components are members of a catalog's declared set, never transforms the catalog document. Every
   row in both of our suites uses `action: "validate"` — our `catalog.yaml` groups catalog-
   DOCUMENT-scoped **validate** cases, not a different action.
3. **`at_finalize`, an extra optional INPUT field** (ADR-0187, GH #829) — upstream rows carry no notion
   of stream completeness, because upstream validates one payload with no mode. This repo's validator
   has two granularities (streaming-tolerant vs. complete-set), and a fixture needs to say which one it
   is being judged under. Emitted ONLY on the row that opts in, so every other row stays byte-identical
   to the pre-ADR-0187 generation and an upstream-shaped consumer ignoring the key still matches them
   all. Snake_case to match the surrounding row convention (`expect_verdict`, `catalog_schema`).

Upstream submission formatting — Apache license headers, `test_data/` external-file schema refs,
etc. — is applied **at contribution time**, never carried in this repo's own generated copy (see
`UPSTREAM-PROPOSAL.md`).

## Contributing upstream

Every fixture here traces to this repo's own shared validator
(`packages/agent-ui/a2ui/src/renderer/validate.ts` + `src/catalog/conformance.ts`) and, for the
three interop fixtures, to the pinned `a2ui.org` machine schema fetched for ADR-0169. The draft issue
proposing this pack as a complementary sibling suite to `a2ui-project/a2ui#2150`/#2182 is
`UPSTREAM-PROPOSAL.md`, ready to paste into a new upstream issue — filed by a human, from their own
GitHub account, never by this repo's own tooling.
