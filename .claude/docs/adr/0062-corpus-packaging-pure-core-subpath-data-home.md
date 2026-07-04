# ADR-0062 — corpus packaging: a platform-neutral pure core behind a `"./corpus"` subpath; Node fs shell + scripts in `tools/corpus/`; JSONL data in-package at `corpus/`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the corpus-store intake, NEXT item 1) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | `a2ui-corpus-store.lld.md` LLD-C1 §1/§2/§12 (edited this change — the `Store.load()` fs-at-runtime implication removed) · `packages/agent-ui/a2ui/package.json` (gains `"./corpus"` at build time, gated on ratification) |
> | **Supersedes / Superseded by** | Relates ADR-0055 (the `"./examples"` subpath + bundle-hygiene precedent this follows) · corpus SPEC-N5 (the zero-dep constraint this realizes) |

## Context

Corpus LLD v0.1 placed all of `store/record/canonical/dedup/admit/heal/retrieve/export` in `src/corpus/`
as "runtime" scope, with `Store.load()` implicitly reading the filesystem — but `src/*` is the package's
importable, bundle-reachable surface, and the future streaming codec (a RUNTIME module, streaming LLD-C1)
must import the healer without dragging `fs`. Three packaging questions are live at once: where the JSONL
data lives (bundle-safety — ADR-0055's lesson that payload bytes must never ride a consumer bundle), how
out-of-package consumers (harness loop, streaming driver/MCP, site tooling) address the read surface, and
which pieces are Node-only versus platform-neutral. The root barrel (`src/index.ts`) currently re-exports
protocol + catalog + renderer only; nothing decides these three questions but a ratified choice.

## Decision

We will split the store along the runtime/IO seam and expose it deliberately:

1. **`src/corpus/*` is a platform-neutral pure core** — zero third-party deps (SPEC-N5) AND zero Node
   builtins. Every module operates on in-memory values: `createStore(shards?: ShardText[])` parses provided
   JSONL text and `serialize()`s it back; hashing rides `globalThis.crypto.subtle` (browsers + Node ≥ 20).
   The healer, validator adapter, canonicalizer, dedup, admission, retriever, and exporters are all
   importable from any runtime — the streaming codec gets `heal` with no fs in its graph.
2. **`tools/corpus/*` is the Node shell**: `fs-store.ts` (read/write the data dir → `createStore`/
   `serialize`) and `import-seeds.ts` (the ADR-0055 handshake), later contamination/repair/eval. Scripts
   are plain `.ts` run via Node type-stripping (the tsconfig's `erasableSyntaxOnly` guarantees
   strippability; Node 22 needs `--experimental-strip-types`). **Only `tools/corpus/` writes the data dir.**
3. **The data home is in-package: `packages/agent-ui/a2ui/corpus/`** (package root, sibling of `src/`) —
   exactly the v0.1 layout, now with the bundle-safety argument made explicit: only export-map entries
   enter an import graph, and the exports map lists `"."`, `"./examples"`, and (this ADR) `"./corpus"` —
   the data dir is not importable, is read exclusively via `fs` in tools/tests, and the package is private
   (never published).
4. **The read surface is a `"./corpus"` subpath export** → `./src/corpus/index.ts` (the pure core's
   barrel). The ROOT barrel does not re-export corpus — a renderer consumer bundles zero corpus bytes (the
   `"./examples"` precedent, ADR-0055 clause 3).

## Consequences

- **The streaming codec and harness inherit clean imports**: `@agent-ui/a2ui/corpus` (or package-internal
  relative imports) for logic; only Node-side tools touch files. The Node/browser boundary is a directory
  boundary, greppable and trip-wireable.
- **`Store` gains a serialization round-trip obligation** — `createStore(serialize()) ≡ identity` — which
  is also the byte-stability test the JSONL diff-hygiene needs (one record per line, stable key order).
- **Two ways to read the corpus** (subpath import of the core + shell-loaded data vs tools doing both)
  could confuse; the rule is one line: *the core computes, the shell does IO* — every tool composes the
  same core, so verdicts cannot fork.
- **`crypto.subtle` makes canonical hashing async** — `canonicalize` returns a Promise; admission is async
  end-to-end. Accepted: zero-dep + cross-platform determinism (SPEC-N6) outweighs a sync signature.
- **The type-stripping runner is an environmental bet** — if the local Node cannot run the tool scripts,
  the builder escalates the runner choice (the LLD §13 discovered-reality note); the pure core is unaffected
  either way (it is exercised by vitest, not by the runner).
- **Stale → re-verify on the build gate:** `package.json` exports · `src/corpus/index.ts` · the root-barrel
  purity proof · the vitest-alias caveat from ADR-0055 (a cross-package TEST importing
  `@agent-ui/a2ui/corpus` needs a more-specific alias row first; package-internal tests import relatively).

## Acceptance

- `import { heal, admit, createStore } from '@agent-ui/a2ui/corpus'` resolves; importing only
  `@agent-ui/a2ui` (root) tree-shakes to zero corpus bytes (grep/bundle proof, the ADR-0055 shape).
- No module under `src/corpus/` imports `node:*` or any third-party package (a greppable invariant;
  candidate trip-wire).
- `createStore(store.serialize())` round-trips byte-identically on the seed shard.
- `node --experimental-strip-types tools/corpus/import-seeds.ts` runs on the repo's Node and writes only
  under `corpus/`.

## Alternatives considered

- **fs-reading `Store.load()` in `src/corpus/` (v0.1 as written)** — rejected: puts `node:fs` on the
  importable runtime surface; the streaming codec could no longer share the healer without a bundler
  externalization hack, and "zero-dep" would quietly mean "Node-only".
- **A sibling data package / repo-root `corpus/` dir** — rejected: breaks package-owns-its-data cohesion,
  puts the standing `corpus-data.test.ts` gate outside the vitest include's natural home, and buys nothing
  — bundle-safety is already guaranteed by the exports map, not by distance from `src/`.
- **Re-export corpus from the root barrel (no subpath)** — rejected: admission/heal/retrieval code in every
  renderer consumer's bundle; the exact failure ADR-0055 built the subpath pattern to prevent.
- **Ship tools as compiled `.mjs`** — rejected: adds a build step the repo doesn't have for a dev script;
  `erasableSyntaxOnly` exists precisely so `.ts` runs stripped.
