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

## Verdict-matching semantics

A fixture **PASSES** iff the validator-under-test's actual verdict has `valid === expectedVerdict.valid`
AND its `failures` match `expectedVerdict.failures` as a **set** of `(code, path)` pairs — order is not
significant (a different validator may walk a component tree in a different order than this repo's
own [ADR-0024](../../../../.claude/docs/adr/0024-a2ui-v1-positional-dynamic-list.md) positional
walk). A run of the whole suite is green iff **every** fixture passes.

## Coverage

16 fixtures: two known-good default-catalog payloads, one negative fixture per protocol/catalog
failure stage (`PARSE`, `SCHEMA` ×2 shapes, `VERSION_UNSUPPORTED`, `CATALOG`, `IDGRAPH` ×4 subtypes —
root-missing / second-root / dangling child / cycle, `POINTER` ×2 — a component binding and an
`updateDataModel.path`), and the three pinned upstream `a2ui.org` Basic Catalog examples
([ADR-0169](../../../../.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md) cl.1's
interop-anchored seed named by GH #476 — `interactive-button` / `simple-login-form` / `product-card`,
each translated ONLY at the envelope `version` field, `v0.9` → `v1.0`; every component-tree byte is
verbatim from the fetched upstream source).

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
catalog is targeted; `catalog.yaml` carries catalog-document-scoped concerns (the CATALOG
membership-allowlist code, plus every catalog-interop known-good payload).

| Suite | Fixtures | Failure codes covered |
| --- | --- | --- |
| `suites/validator.yaml` | `parse-failure` · `bad-envelope` · `missing-surfaceId` · `unsupported-version` · `bad-pointer-binding` · `bad-pointer-datamodel` · `missing-root` · `duplicate-root` · `dangling-child` · `cycle` | PARSE, SCHEMA ×2, VERSION_UNSUPPORTED, POINTER ×2, IDGRAPH ×4 |
| `suites/catalog.yaml` | `valid-button` · `valid-list` · `unknown-component` · `upstream-interactive-button` · `upstream-simple-login-form` · `upstream-product-card` | CATALOG, plus 5 known-good (2 default-catalog, 3 `a2ui.org` interop) |

### Row shape — field-by-field, against the fetched upstream examples

Fetched `validator.yaml` / `catalog.yaml` / `parser.yaml` from
`a2ui-project/a2ui@main:agent_sdks/conformance/suites/` (2026-08-13) to extract the real row shape
before writing the generator. Every row here carries: `name` · `description` · `catalog: {version,
catalogId, catalog_schema}` · `action` · `payload` · an expected-outcome field — the same top-level
keys upstream's own rows use.

**Two deliberate mismatches** (named, not forced-fit — see `UPSTREAM-PROPOSAL.md` for the same note
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
