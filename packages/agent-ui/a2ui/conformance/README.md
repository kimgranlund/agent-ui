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

## Contributing upstream

Every fixture here traces to this repo's own shared validator
(`packages/agent-ui/a2ui/src/renderer/validate.ts` + `src/catalog/conformance.ts`) and, for the
three interop fixtures, to the pinned `a2ui.org` machine schema fetched for ADR-0169. A contributor
porting this suite to `a2ui-project/a2ui#2150` needs only `manifest.json` + `fixtures.jsonl` + the two
referenced `catalog.json` documents — no other file in this repo.
