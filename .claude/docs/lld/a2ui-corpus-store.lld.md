# LLD — A2UI Corpus Store

> Status: proposed · v0.5 · 2026-07-03 (v0.1 2026-06-26) · Layer: LLD (implementation plan)
> Implements: [`../spec/a2ui-training-corpus.spec.md`](../spec/a2ui-training-corpus.spec.md) (SPEC-R1..R16, SPEC-N1..N6). Closes **PRD-D4** (storage substrate); PRD-D5 (MCP delivery) is now served through the streaming-pipeline LLD (see LLD-C13 note, §1).
> Altitude: this document adds the **how**. It does not re-derive corpus behavior — that is the SPEC's; it cites `SPEC-R*` for the what and specifies data structures, algorithms, files, failures, and build order.
> **v0.2 reconciliation (2026-07-03):** realized/unrealized state added (§0); LLD-C6 marked REALIZED; the healer (LLD-C7) is now **the ONE shared healer** for the whole system (the streaming LLD v0.2 re-pointed all healing here — the renderer deliberately does not heal) and its contract is ADR-0061; the phase-1 scope + tier-2 judge seam is ADR-0060; the pure-core/Node-shell split, the `"./corpus"` subpath, and the data home are ADR-0062; the dangling `a2ui-mcp.lld.md` reference repaired (LLD-C13 re-pointed to the streaming LLD-C6); the seed-import slice (ADR-0055's booked handshake) added as LLD-C14.
> **v0.2.1 (2026-07-03, same-day truth updates):** C2/C3/C7 flipped REALIZED (slices s1–s3 landed in the working tree); the SPEC-v0.3 `description` eval/target carve-out recorded in §3 (the s1 build surfaced the §5.1-schema-vs-R2-AC2 contradiction; SPEC repaired in R2 AC2's favor); the plan manifest is now `a2ui-corpus-store.decomp-v2.json` (n3 accept re-worded to the carve-out).
> **v0.3 (2026-07-03, ADR-0063 proposed — upstream verified, the carve-out reversed):** the host-fetched `dataset_schema.json` (google/A2UI@main) requires `description` UNCONDITIONALLY, defaults `target` to `description` (no missing-target failure mode), sets `additionalProperties:false` on items, and is a JSON-ARRAY dataset file. §3's rule reverses to unconditional `description`; **`E_NO_TARGET` retired** (§6/§8); the R1-AC1 projection + R16 array-form facts recorded (§3/§11); `record.ts`/`record.test.ts` carry a booked s1 follow-up edit (gated on ADR-0063 ratification); the plan manifest is now `a2ui-corpus-store.decomp-v3.json`.
> **v0.3.1 (2026-07-03, s4/s5/s8 truth-ups — builds team-lead-accepted, prose reconciled to the shipped shapes):** C1-core/C4/C9 flipped REALIZED; §9's retriever is `retrieve(records: readonly CorpusRecord[], query)` — pure over an ARRAY, composed as `retrieve(store.all({…}), query)`, no store-handle wrapper (ratified: matches the decomp's n3→n10-only edge + ADR-0062's pure-core spirit) — with a HARD eligibility invariant (only `facet:"exemplar"`, non-quarantined records are ever candidates, whatever the caller passes) and NO cross-call index cache (the v0.2 "cached per store instance" claim retired; N2 met by per-call measurement); §5's `DedupIndex` gains `addExact(name, hash)` (the symmetric write side the sketch omitted) + the named exports `DEFAULT_THETA_DUP`/`MINHASH_PERMS`/`SHINGLE_K` + fixed-seed permutation determinism.
> **v0.4 (2026-07-03, s6 landed + ADR-0064 proposed):** C5 flipped REALIZED (26/26, full pipeline, §8 = the test matrix, tier-1 parity by direct comparison). Three s6-surfaced repairs: (1) **ADR-0064 — a v1 record is SINGLE-SURFACE** (§3 rule + §4 fold precondition + §8 row; the shared validator judges per surface, `foldStream` folds globally — a multi-surface record would tier-1-pass then silently chimera; reject at `validateRecord` E_SCHEMA; the check joins the ADR-0063 s1 follow-up); (2) the **candidate-status rule** recorded in §6 (caller `meta.status` is never trusted — placeholder-default for the schema stage, then admission unconditionally recomputes valid/repaired); (3) `AdmitDeps` realized as `{ catalog: Catalog; store: CorpusStore; dedupIndex: DedupIndex; judge?: Judge }` (`admit.ts:52-62` — ADR-0060's snippet was abbreviated; realization note appended there). Plus §9/C10: the upstream catalog-examples shape VERIFIED (host fetch — a DIRECTORY of named `*.json` files, each ONE example as a bare JSON array of messages; basename = name; the loader sorts by filename and adds its own `---BEGIN/END` wrappers; cites `schema/manager.py:195-236` · `schema/catalog.py:352-391` · conformance `test_data/example1.json`) — `exportCatalogExamples` emits `Array<{name, content}>`, the fs materialization is the Node shell's. The plan manifest is now `a2ui-corpus-store.decomp-v4.json`.
> **v0.4.1 (2026-07-03, books correction + record.ts truth-up):** crossed messages — the ADR-0063 s1 follow-up had ALREADY landed (team-lead-verified 28/28) when the v0.4 pass wrote "the ADR-0064 check joins it"; the 0064 check was therefore dispatched as its OWN slice (s6 seat, file-disjoint from s7) and has ALSO landed in the tree (`record.ts:207-234` + the self-excluding grep-clean probe `record.test.ts:220-230`). Both record.ts follow-ups ran under recommendation-adoption; ADRs 0060–0064 all remain PROPOSED, held for Kim. `record.ts` now encodes the full SPEC-v0.5 contract.
> **v0.5 (2026-07-03, WAVE CLOSE — s1–s10 ALL LANDED; tree green: check · 2254 tests · size untouched 6542/7168 + 21680/22528):** C1-shell/C10/C14/C15 flipped REALIZED — the 11-record shard (`corpus/exemplar/v1_0/agent-ui.jsonl`, all `status:"valid"`, none needed healing) + `index.json` + the standing gate (`corpus-data.test.ts`, 14/14) + the `"./corpus"` subpath are live; idempotent re-import proven byte-identical (shasum across runs). s7 FOUND and the s6 seat FIXED a real pointer-resolution bug (a one-hop template scope map falsely E_POINTER'd 2 seeds) — the fix is a full-subtree `computeScopes()` DFS mirroring `renderer/tree.ts`+`list.ts` (`admit.ts:351`), so **corpus resolution scope semantics now equal the renderer's list threading BY CONSTRUCTION** (§6/§8). `AdmitResult.collidesWith` realized (SPEC §5.2's field — both E_DUP flavors report the first-admitted name; `import-seeds.ts` consumes it typed). §9's exporter signatures truth-ed to the ARRAY pattern (`export.ts:67/:111` — like C9); §12's barrel = `export *` over all NINE core modules incl. dedup (accepted call: `AdmitDeps` requires a caller-supplied index). ADR-0064 slice accepted (31/31). Follow-ups recorded in §12's wave-close block. The plan manifest is now `a2ui-corpus-store.decomp-v5.json`. **Independent review: GO**
> **v0.5.1 (2026-07-03, harness-intake touch — ADR-0068 proposed):** **LLD-C12 SPLITS.** Its JUDGE half
> activates with the harness wave via the verdict-adapter mechanism (harness LLD v0.2 §7 / ADR-0068:
> `src/corpus/judge.ts` pure adapter + `tools/corpus/rescore.ts` back-scoring + `import-seeds
> --verdicts`; the `a2ui-reviewer` critic authors verdicts against `.claude/docs/rubrics/a2ui-corpus.md`);
> its Inspect-AI SCORING/LIFT half (SPEC-R14/R15/R16) stays deferred WITH LLD-C8 (trigger: the first
> eval record — the harness ships none, ADR-0067 clause 6), and that wave must first host-verify the
> upstream `eval/a2ui_eval/scorers.py` + `dataset.py` interfaces (unverified C1 facts). §0/§1/§11 rows
> updated this change. (no blocker/major; every accept + ADR clause checked in code, incl. the pointer mirror read against `renderer/{tree,list,binding}.ts` and all 11 shard records parsed against their seeds; check + test re-run green 2254/2254) — its two LATENT minors (both safe-direction, no shard hits) + two gate-completeness notes are booked in §12 and caveated at §6.

---

## 0. Realized / unrealized (verified against the tree, 2026-07-03)

| Claim | State | Evidence |
|---|---|---|
| LLD-C6 validator-parity adapter | **REALIZED** | `src/corpus/validate.ts:7-8` re-exports `validateA2ui` + `ValidationVerdict` from `../renderer/validate.ts`; the parity probe `src/corpus/validate.test.ts:10` asserts `corpusValidate` **is** `rendererValidate` (same function object) + identical verdicts on shared payloads |
| The shared validator's reach (what tier-1 buys) | **REALIZED, wider than v0.1 said** | `renderer/validate.ts:47` — signature is `validateA2ui(msgOrOutput: unknown, catalog)`: accepts a raw string (PARSE on parse failure, `:67`), a single message, or a full stream; gates `version` against `SUPPORTED_VERSIONS` (`:109`, `protocol.ts:160` = `{'v1.0','v0.9.1'}`); knows **all six envelopes incl. `callFunction`** (`:42`, the ADR-0055 parity closure); binding pointers may be list-item-**relative** (`isValidBindingPointer`, `:254` — ADR-0024), only `updateDataModel.path` is absolute-only (`:236`) |
| Validator failure codes | **REALIZED as the unprefixed internal taxonomy** | `protocol.ts:16-24` (`PARSE·SCHEMA·CATALOG·CATALOG_UNKNOWN·IDGRAPH·POINTER·VERSION_UNSUPPORTED·FUNCTION`), `Failure` at `protocol.ts:185-188`. The corpus `E_*` codes are **admission-result** codes; §6 owns the mapping |
| `A2uiOutput` type | **REALIZED** | `protocol.ts:153` — `type A2uiOutput = A2uiServerMessage[]` (this LLD's §3 sketch predated it; import, don't redefine) |
| The authored-candidate source (seed shelf) | **REALIZED** (ADR-0055, accepted) | `src/examples/types.ts:19-34` (`ExampleSeed`: `name`/`description`/`promptText`/`surfaceId`/`protocolVersion:'v1.0'`/`catalogId:'agent-ui'`/`messages`), 11 seeds via `src/examples/index.ts:35-47`, exposed only by the `"./examples"` subpath (`package.json:6-9`). ADR-0055 clause 2 books **the seed-import script as this store wave's slice** (LLD-C14) |
| Healing ownership | **RE-POINTED HERE** | `a2ui-streaming-pipeline.lld.md` v0.2 (header + §2 + §8): the renderer has NO healer by design (its parser fault-isolates, runtime SPEC-N4); the ONE healer is **this LLD's C7**, shared by admission and the future streaming codec |
| LLD-C2 / C3 / C7 (slices s1–s3) | **REALIZED 2026-07-03** (working tree, uncommitted) | `src/corpus/{record,canonical,heal}.ts` + co-located tests. `record.ts` encodes the FULL SPEC-v0.5 contract: both follow-ups landed — ADR-0063 (description unconditional; `E_NO_TARGET` retired, grep-guarded by the self-excluding probe `record.test.ts:220-230`) and ADR-0064 (the single-surface walk, `record.ts:207-234`) |
| LLD-C1 core / C4 / C9 (slices s5/s4/s8) | **REALIZED 2026-07-03** (working tree, uncommitted; team-lead-accepted) | `src/corpus/{store,dedup,retrieve}.ts` + co-located tests; `retrieve.ts:59` = the array signature + hard eligibility invariant (§9), `dedup.ts:131` = `addExact` (§5) |
| LLD-C5 admission (slice s6) | **REALIZED 2026-07-03** (working tree, uncommitted; team-lead-verified) | `src/corpus/admit.ts` + `admit.test.ts` — the full §6 pipeline; §8 = its test matrix; tier-1 parity by direct comparison; `AdmitDeps` at `admit.ts:52-62`; pointer-RESOLUTION via the full-subtree `computeScopes()` DFS (`admit.ts:351` — the s7-found scope bug fixed); `collidesWith` at `admit.ts:75/:202` |
| LLD-C1 shell / C10 / C14 / C15 (slices s7/s9/s10) | **REALIZED 2026-07-03** (working tree, uncommitted; team-lead-verified) | `tools/corpus/{fs-store,import-seeds}.ts` · `corpus/exemplar/v1_0/agent-ui.jsonl` (11 records) + `index.json` · `src/corpus/{export.ts,corpus-data.test.ts,index.ts}` · `package.json` `"./corpus"` — root-barrel purity proven by a whole-tree grep |
| Deferred (designed, trigger-dispatched) | C8 (first eval record) · C11 (first pin bump) · C12 **split v0.5.1**: judge half → the harness wave (ADR-0068), scoring/lift half → with C8 | §10/§11 carry the designs; §13's deferred tail names the triggers |

## 1. Component map (traceability · state 2026-07-03)

Each component has a single responsibility and a SPEC home. No requirement is orphaned; no component lacks a requirement.

| ID | Component | Implements | File (under `packages/agent-ui/a2ui/`) | Scope | State |
|---|---|---|---|---|---|
| **LLD-C1** | Storage: pure store core + Node fs shell | SPEC-R1, R3, R9, N5 | `src/corpus/store.ts` (core) · `tools/corpus/fs-store.ts` (IO) · `corpus/` (data) | runtime core / Node shell (ADR-0062) | **REALIZED** (core s5 · shell + data s7, 2026-07-03) |
| **LLD-C2** | Record model + schema validator | SPEC-R1, R2 | `src/corpus/record.ts` | runtime | **REALIZED** (s1, 2026-07-03) |
| **LLD-C3** | Canonicalizer | SPEC-R6, N6 | `src/corpus/canonical.ts` | runtime | **REALIZED** (s2, 2026-07-03) |
| **LLD-C4** | Hasher + dedup index | SPEC-R7 | `src/corpus/dedup.ts` | runtime | **REALIZED** (s4, 2026-07-03) |
| **LLD-C5** | Admission pipeline | SPEC-R5–R9 | `src/corpus/admit.ts` | runtime | **REALIZED** (s6, 2026-07-03; tier-2 seam per ADR-0060) |
| **LLD-C6** | Validator-parity adapter | SPEC-R8, N1 | `src/corpus/validate.ts` → re-exports `../renderer/validate.ts` | runtime | **REALIZED** (§0) |
| **LLD-C7** | Healer — **the ONE shared healer** | SPEC-R8, R14 (+ streaming LLD-C1) | `src/corpus/heal.ts` | runtime | **REALIZED** (s3, 2026-07-03; contract = ADR-0061) |
| **LLD-C8** | Contamination split + crypto + leak gate | SPEC-R3, R4, N3 | `tools/corpus/contamination.ts` + `.gitattributes` | dev/CI | unbuilt · **deferred** (no eval records exist; admission fail-closes the eval facet, §6/ADR-0060) |
| **LLD-C9** | Retriever (TF-IDF, top-k) | SPEC-R11, N2 | `src/corpus/retrieve.ts` | runtime | **REALIZED** (s8, 2026-07-03) |
| **LLD-C10** | Exporters (catalog-examples, fine-tune) | SPEC-R10, R12 | `src/corpus/export.ts` | runtime | **REALIZED** (s9, 2026-07-03) |
| **LLD-C11** | Repair loop | SPEC-R13 | `tools/corpus/repair.ts` | dev/CI | unbuilt · deferred (single-pin v1.0 corpus; trigger = the first catalog/protocol bump) |
| **LLD-C12** | Scoring + lift harness (Inspect-AI interop) | SPEC-R14, R15, R16 | `tools/corpus/eval/` | dev/CI | **SPLIT v0.5.1 (ADR-0068):** the JUDGE half activates with the harness wave (`src/corpus/judge.ts` + `tools/corpus/rescore.ts` + `import-seeds --verdicts` — harness LLD v0.2 §7); the scoring/lift half stays unbuilt · deferred WITH C8 (trigger: the first eval record) |
| **LLD-C13** | ~~MCP serving surface~~ | — | — | — | **RE-POINTED**: owned by the streaming-pipeline LLD-C6 (`tools/pipeline/mcp-server.ts`), which consolidated the never-written `a2ui-mcp.lld.md`; the store contributes `retrieve`/`admit` as plain functions it wraps. The v0.1 `a2ui-mcp.lld.md` reference was dangling — repaired |
| **LLD-C14** | Seed-import script (the ADR-0055 handshake) | SPEC-R5, R9 | `tools/corpus/import-seeds.ts` | Node/dev | **REALIZED** (s7, 2026-07-03; idempotent, byte-identical re-runs) |
| **LLD-C15** | Standing corpus-data gate | SPEC-R1, R8 | `src/corpus/corpus-data.test.ts` | CI (vitest) | **REALIZED** (s7, 2026-07-03 — also delivers the "package-side corpus probe" NEXT item 4 booked) |

**Runtime vs tooling split (SPEC-N5, sharpened by ADR-0062).** `src/corpus/*` is the zero-dependency, **platform-neutral pure core**: no `fs`, no Node builtins — every module operates on in-memory records/text; hashing uses `globalThis.crypto.subtle` (available in browsers and Node ≥ 20). `tools/corpus/*` is the Node-side shell (shard file IO, the seed-import script; later contamination/repair/eval) — dev/CI-scoped, MAY use Node builtins, never enters any bundle. Tool scripts are plain `.ts` run via Node type-stripping (`node --experimental-strip-types` on the repo's Node 22; the tsconfig's `erasableSyntaxOnly` exists to guarantee strippability) — the builder verifies the flag against the local Node and escalates if the runner needs anything more.

## 2. Storage layer — LLD-C1

**Substrate (PRD-D4): flat JSONL in-repo**, one record per line, sharded by facet and protocol version. An in-memory index is built on load; no database until scale forces it (revisit at > 10⁵ records).

```
packages/agent-ui/a2ui/corpus/
  exemplar/
    v1_0/<catalogId>.jsonl        # public; one CorpusRecord (facet:"exemplar") per line
  eval/                           # LANDS WITH LLD-C8 — no eval shard exists before the contamination mechanism
    v1_0/<catalogId>.jsonl.enc
  index.json                      # derived: {canonicalHash → name}, {catalogId → names[]}, counts
```

Shard dirs use the version pin with `.`→`_` (`'v1.0'` → `v1_0`, `'v0.9.1'` → `v0_9_1`) — the pin strings are `protocol.ts:160`'s, the dir names are their file-safe spellings.

**Invariants.** (i) `name` is unique across both sub-corpora (join key). (ii) A file under `exemplar/` contains only `facet:"exemplar"` records; under `eval/`, only `facet:"eval"`. (iii) `index.json` is derived and regenerable from the JSONL; it is never the source of truth. (iv) **Only `tools/corpus/` writes the data dir** — the admission pipeline is the single mutation path, and it runs Node-side.

**The core is pure (ADR-0062):** it never touches the filesystem — the Node shell reads the shard files and hands their text in; writes go back through the shell.

```ts
// src/corpus/store.ts — pure core (zero-dep, platform-neutral)
interface ShardText { path: string; text: string }              // path = the repo-relative shard path
interface CorpusStore {
  get(name: string): CorpusRecord | undefined;
  all(filter?: { facet?: Facet; catalogId?: string; protocolVersion?: string }): CorpusRecord[];
  put(rec: CorpusRecord): void;                                  // in-memory admit-side append
  shardPath(rec: CorpusRecord): string;                          // facet + protocolVersion + catalogId → path
  serialize(): ShardText[];                                      // stable JSONL per shard + index.json
}
function createStore(shards?: ShardText[]): CorpusStore;         // parse JSONL → maps; rebuild index

// tools/corpus/fs-store.ts — Node shell
function loadStore(dataDir: string): CorpusStore;                // fs.readdir/readFile → createStore
function saveStore(dataDir: string, store: CorpusStore): void;   // serialize() → fs.writeFile
```

`all()` excludes `status:"quarantined"` (SPEC-R13's consumption rule) — retrieval and the exporters inherit the exclusion by construction.

## 3. Record model & validator — LLD-C2

`CorpusRecord` is the TS form of the SPEC §5.1 schema. Validation is a zero-dep hand-rolled checker (the repo bans heavyweight deps); it mirrors the draft-07 schema field-by-field. `A2uiOutput` is **imported from `protocol.ts:153`** (realized), not redefined.

```ts
import type { A2uiOutput } from '../protocol.ts'

type Facet = "exemplar" | "eval";
type Status = "valid" | "repaired" | "quarantined";

interface CorpusRecord {
  name: string; description: string; promptText: string;
  target?: string; catalog?: string; role_description?: string; workflow_description?: string;
  a2uiOutput?: A2uiOutput;                        // required iff facet==="exemplar" (SPEC-R2)
  meta: {
    facet: Facet; protocolVersion: string; catalogId: string; catalogVersion?: string;
    provenance: { source: "authored"|"distilled"|"mined"; origin: string };
    canonicalHash?: string; componentsUsed?: string[]; status: Status; qualityScore?: number;
  };
}

// returns [] when valid; otherwise the list of failures (admission code + JSON path)
function validateRecord(r: unknown): { code: AdmitCode; path: string }[];
```

**Invariant:** `validateRecord` is pure and total — never throws, returns structured failures (so admission can map them to error codes, §8).

**The `description` rule (SPEC v0.4 / ADR-0063 — upstream-verified):** `description` is required
UNCONDITIONALLY (upstream `dataset_schema.json` verbatim: `"required": ["name", "description",
"promptText"]`); a missing `description` is `E_SCHEMA` for every facet. `target` stays optional; an eval
record's effective judge target is `target ?? description` — a CONSUMER rule (the tier-2 judge / LLD-C12
scorer read the fallback; validation only type-checks `target` when present). **`E_NO_TARGET` is retired**
(unreachable by construction — no reserved arm; ADR-0063 is the tombstone). History: v0.3 briefly ruled an
eval/target carve-out off the schema's internal contradiction; the host fetch falsified it same-day.
The follow-up edit LANDED 2026-07-03 (team-lead-verified 28/28): the carve-out branch and the
`E_NO_TARGET` member are gone, and the retirement is grep-guarded in the suite itself
(`record.test.ts:220-230`, self-excluding).

**The interop projection (SPEC-R1 AC1, ADR-0063):** validating a record upstream means projecting onto the
7 upstream fields — drop `meta` AND (for exemplars) `a2uiOutput`, because upstream sets
`additionalProperties:false`. The exporters/interop surfaces own the projection; the stored record is
never mutated by it.

**The single-surface rule (SPEC-R2 AC3, ADR-0064):** an exemplar's `a2uiOutput` addresses **exactly one
surface** — every surface-bearing message carries the same `surfaceId`, at least one exists, and
surfaceless `callFunction` envelopes are excluded from the count. Enforced HERE (`validateRecord`,
`E_SCHEMA` at the offending message's path — the same message walk the pin check does), so the standing
corpus-data gate (LLD-C15) enforces it over stored records too. Landed as its OWN slice
(`record.ts:207-234` — the ADR-0063 follow-up had already landed separately; v0.4.1 books note).
Multi-surface streams stay wire/renderer-legal; this is corpus-only.

**Seed pre-alignment (ADR-0055).** An `ExampleSeed` maps onto a candidate as: `name`/`description`/`promptText` verbatim; `messages` → `a2uiOutput`; `protocolVersion`/`catalogId` → the `meta` pins; `meta.facet='exemplar'`, `meta.provenance={source:'authored', origin:'src/examples/<module>.ts'}`, `meta.status` set by admission. `surfaceId` is dropped (it lives inside every message). The mapping is LLD-C14's; the seed shape never imports corpus code.

**Provenance vocabulary stands as spec'd (SPEC-R5).** Seeds are `authored`; records distilled from real sessions are `distilled`; records scraped from existing artifacts are `mined`. A model-**synthesized** exemplar (the live-agent wave's plausible source) fits none of these — when the first one arrives, widen the enum by ADR then (the on-demand/reserved-arm discipline); do not stretch `mined` to cover it.

## 4. Canonicalizer — LLD-C3 (SPEC-R6, N6)

The A2UI `updateComponents` list is an **adjacency list**: declaration order is insignificant (refs are by ID) but **child order within a container is semantic** and MUST be preserved. Canonicalization therefore re-derives the tree and normalizes only the insignificant axes.

**Precondition (ADR-0064):** the input is a SINGLE-SURFACE output, guaranteed by the record-schema stage
that precedes canonicalization in the §6 pipeline — the global (non-surface-scoped) fold below is correct
under that precondition and ONLY under it (two surfaces both legally declare `root`; a global upsert
would silently last-write-wins them into a chimera the hash then legitimizes). Surface-scoped folding is
the named widening work IF multi-surface records are ever legalized (an s2-seat follow-up under a future
ADR), not speculative machinery now.

**Algorithm `canonicalize(out: A2uiOutput): Promise<{ form: CanonicalForm; hash: string; componentsUsed: string[] }>`** (async — the hash rides `crypto.subtle.digest`):
1. Fold the stream: apply `updateComponents` (upsert by id) into a component map and `updateDataModel` (in order) into ONE data-model object (whole-model when `path` is omitted/`""`/`"/"` — the ADR-0099 root alias, mirroring the renderer's `#onUpdateDataModel`; both this fold and `admit.ts`'s carry the alias); note the `createSurface` pins (`catalogId`).
2. Assert exactly one `root` (else surface to caller as `E_IDGRAPH` — admission handles, §8; in the §6 order tier-1 has already rejected this, so here it is a defensive guard).
3. DFS from `root`, visiting `child`/`children` in declared order; assign canonical IDs `c0=root, c1, c2…` in visit order; record `componentsUsed` (set of `component` type names).
4. Rewrite all ID references to canonical IDs: `child`, static `children: string[]`, **and a children-template's `componentId`** (`protocol.ts:101` `A2uiChildTemplate` — v1.0's dynamic-list form, which v0.1 predated; the template's target is reachable structure and joins the DFS). JSON-Pointer paths are **never** rewritten — pointers address the data model, not component IDs (the v0.1 step-4 clause claiming otherwise was wrong).
5. Emit `{ components: [DFS order, sorted property keys per component], dataModel: folded }` — children arrays keep element order; the data model is included because a binding-identical tree over different bundled data is a different exemplar (SPEC-R6 AC2's "differ in a bound path" spirit).
6. Serialize with a stable JSON writer (sorted keys, no insignificant whitespace); `hash = SHA-256(serialized)` via `crypto.subtle.digest` (zero-dep, cross-platform → satisfies N6).

**Edge cases:** disconnected components (declared but unreachable from `root`) are dropped from the canonical form and noted; a cycle aborts with `E_IDGRAPH`.

## 5. Hasher + dedup — LLD-C4 (SPEC-R7)

Two-stage: exact then near.
- **Exact:** `canonicalHash` equality against the store's hash index → `E_DUP`.
- **Near:** MinHash signature (128 permutations) over token shingles (k=3) of `promptText + " " + canonicalSerialized`; estimate Jaccard against admitted signatures; if `≥ θ_dup` → `E_DUP` reporting the colliding `name`. **Default `θ_dup = 0.9`, documented and configurable** (SPEC-R7 leaves the value tunable).

```ts
interface DedupIndex {
  addExact(name: string, hash: string): void;    // the exact() read side's write path (s4 completion — the v0.1 sketch omitted it)
  addSignature(name: string, sig: Uint32Array): void;
  exact(hash: string): string | null;            // colliding name or null
  near(sig: Uint32Array, theta: number): string | null;
}
```

Realized notes (s4, `dedup.ts`): `DEFAULT_THETA_DUP = 0.9` / `MINHASH_PERMS = 128` / `SHINGLE_K = 3` are
NAMED exports (never literals buried in admission code); callers pass `theta` to `near()` explicitly. The
MinHash permutation family derives from a FIXED-seed LCG at module load — same coefficients every run and
platform (determinism, no `Math.random`). The inclusive `≥ θ_dup` bound is proven at exactly 0.90.

**Edge:** an empty corpus → both checks return null (first record always admits). A signature tie at exactly `θ_dup` counts as a duplicate (inclusive bound, matches SPEC-R7 AC2 "≥"). A near-dup between two **distinct authored seeds** at import time is a θ_dup escalation (human ruling — the LLD-C14 script reports and halts on it), never a silent skip or merge.

## 6. Admission pipeline — LLD-C5 (SPEC-R5–R9)

Center-out orchestration; each stage is independently testable and short-circuits on first failure.

```
admit(candidate, deps: AdmitDeps) =        // AdmitDeps = { catalog: Catalog; store: CorpusStore; dedupIndex: DedupIndex; judge?: Judge } (admit.ts:52-62 — catalog REQUIRED, caller resolves by meta.catalogId; ADR-0060 realization note)
  heal           (LLD-C7)   → text→messages + structural normalization; ok:false ⇒ E_SCHEMA; changed ⇒ status:"repaired" (ADR-0061)
  schema/field   (LLD-C2)   → E_SCHEMA (unconditional name/description/promptText — ADR-0063; E_NO_TARGET retired; single-surface rule — ADR-0064)
  facet gate     (ADR-0060) → facet==="eval" ⇒ E_LEAK (fail-closed until LLD-C8 exists — SPEC-R4 has no at-rest protection to admit into)
  pin check      (LLD-C2)   → E_PIN     (SPEC-R9: meta pins present; every message's `version` === meta.protocolVersion; every createSurface.catalogId === meta.catalogId)
  tier-1 deterministic (LLD-C6 = shared `validateA2ui`): the §0 realized reach — PARSE/SCHEMA/VERSION_UNSUPPORTED/CATALOG/IDGRAPH/POINTER-syntax → mapped per the table below
  pointer-RESOLUTION (corpus-only, LLD-C5): exemplar bindings must resolve against the record's bundled data model → E_POINTER. Layered ON TOP of tier-1; NOT part of `validateA2ui` (the renderer streams → an unresolved path is a placeholder, renderer SPEC-R4 AC2). Parity (N1/R8-AC3) is over `validateA2ui`, which is unchanged. SCOPE SEMANTICS = THE RENDERER'S LIST THREADING BY CONSTRUCTION (v0.5): `computeScopes()` (`admit.ts:351`) DFS-walks from `root` propagating the CURRENT scope to every static descendant and minting a new one at each children-TEMPLATE (composed `{outer}/0/{path}` — index 0, the witness element; nested templates compose), mirroring `renderer/tree.ts` + `list.ts` — the s7 import falsely E_POINTER'd 2 seeds under the earlier one-hop map (only the template's immediate target got a scope; its descendants didn't), fixed with regressions both shapes + a no-widening control. TWO latent gaps in the mirror remain (review-found, safe-direction, no shard hits — booked in §12's wave-close follow-ups): the compose lacks `scopedPointer`'s absolute-path short-circuit (an absolute INNER template path mis-composes), and resolution scans `root`-disconnected components canonicalization drops.
  leak gate      (LLD-C8 mechanism, LLD-C4 MinHash) → E_LEAK (candidate exemplar vs the loaded eval prompts — an empty set today, the stage still runs)
  canonical+hash (LLD-C3)   → fills meta.canonicalHash, meta.componentsUsed
  dedup          (LLD-C4)   → E_DUP (both flavors carry AdmitResult.collidesWith = the first-admitted colliding name — SPEC §5.2's field, realized)
  tier-2 rubric  (deps.judge — INJECTED seam, ADR-0060) → E_QUALITY when present and below the gate; ABSENT judge ⇒ stage skipped, qualityScore stays unset (the marker)
  write          (LLD-C1)   → store.put() + index update
```

**The tier-1 → admission code mapping** (shared-validator `Failure.code`, `protocol.ts:16-24`, → SPEC §5.3 `E_*`):

| Validator code | Admission code | Note |
|---|---|---|
| `PARSE`, `SCHEMA` | `E_SCHEMA` | post-heal, so a true structural defect |
| `VERSION_UNSUPPORTED` | `E_PIN` | an unpinnable version is a pin defect |
| `CATALOG`, `CATALOG_UNKNOWN` | `E_CATALOG` | offending `component` reported |
| `IDGRAPH` | `E_IDGRAPH` | |
| `POINTER` | `E_POINTER` | syntax arm; the resolution arm is corpus-only (above) |

**State:** admitted records enter `status:"valid"`, or `status:"repaired"` when healing changed the output (ADR-0061 — the repair notes travel in the `AdmitResult`, not the record; the SPEC §5.1 schema is closed). The pipeline is the only writer of the corpus (single mutation path → the parity invariant SPEC-N1/R8-AC3 holds because tier-1 is the shared validator LLD-C6).

**The candidate-status rule (s6, `admit.ts:85-89` + `:152`):** a CANDIDATE's `meta.status` is **never
trusted** — `validateRecord` requires the field (stored records must carry it), so admission
placeholder-defaults it when absent purely so the schema stage can run, then **unconditionally recomputes
and overwrites** the final value (`valid`/`repaired`, from heal's `changed` flag) whatever the caller
supplied (ADR-0055's "`meta.status` set by admission", tested). One `validateRecord` thus serves both
candidate validation (status-lenient via the default) and stored-record validation (status-strict).

## 7. Validator-parity & healer — LLD-C6, LLD-C7

**LLD-C6 — REALIZED (§0).** `src/corpus/validate.ts:7-8` re-exports the single `renderer/validate.ts` implementation; the parity probe asserts identity of the function objects, so a fork is structurally impossible. What tier-1 actually buys (wider than v0.1 assumed): raw-string parse (PARSE), per-message schema, version gating against `SUPPORTED_VERSIONS`, all six envelopes including `callFunction`, catalog conformance, finalize-granularity id-graph (exactly-one-root/dangling/cycle), and pointer **syntax** — absolute or list-item-relative for component bindings (`isValidBindingPointer`), absolute-only for `updateDataModel.path`.

The shared validator checks pointer **syntax only**; it does **not** resolve pointers against the data model (that preserves renderer SPEC-R4 AC2 — an undefined path renders a placeholder, not an error). Corpus admission layers an *additional* pointer-**resolution** stage on top (LLD-C5, §6/§8): an exemplar bundles its complete data model, so resolution is checkable at admission — a strictness the streaming renderer cannot and must not apply. Parity (SPEC-N1 / corpus SPEC-R8 AC3) is asserted over `validateA2ui`, byte-identical for both callers; the corpus-only resolution stage sits outside it.

**LLD-C7 healer — the ONE shared healer (ADR-0061).** The streaming LLD v0.2 excised its fabricated "renderer heal.ts" citations and re-pointed all healing here: the renderer's parser fault-isolates and never heals; admission (this LLD) and the future streaming codec (`stream/codec.ts`, streaming LLD-C1) share this single implementation. The contract serves both callers:

```ts
type HealResult =
  | { ok: true; messages: A2uiOutput; changed: boolean; repairs: string[] }
  | { ok: false; reason: 'unparseable' };
function heal(input: string | A2uiOutput, pin?: { protocolVersion: string }): HealResult;
```

The repair list is **CLOSED and form-only** (mirrors A2UI's `parse_response` + `payload_fixer`): (1) markdown-fence/prose stripping to extract the JSON payload; (2) trailing-comma removal; (3) single-object→array envelope normalization; (4) a missing per-message `version` filled from the caller's pin (recorded — and E_PIN still guards a *wrong* one). Structured (`A2uiOutput`) input skips the text arms; only (3)/(4) apply. **Nothing semantic is ever healed** — unknown components, bad pointers, missing roots reject through tier-1; the healer must not launder invalidity into the corpus. **Callers:** admission maps `ok:false` → `E_SCHEMA` and `changed:true` → `status:"repaired"`; the codec maps `ok:false` → a `PARSE` error message and continues (one bad line ≠ stream abort). Per-line use is why the input is text-first.

## 8. Error & edge-case handling (the enumeration this LLD owns)

Every SPEC error code mapped to its raising stage, plus the non-obvious edges:

| Code / edge | Stage | Handling |
|---|---|---|
| `E_SCHEMA` | LLD-C2 / C7 | reject; return failing JSON paths; healer ran first so it is a true schema defect (incl. heal `ok:false`; incl. missing `description` on ANY facet — ADR-0063) |
| `E_SCHEMA` (multi-surface) | LLD-C2 | exemplar `a2uiOutput` addressing ≠1 surface (two surfaceIds, or none — `callFunction`-only) → reject at the record schema, BEFORE canonicalization can chimera the global fold (ADR-0064) |
| `E_PIN` | LLD-C2 / C6 | missing pin · a message `version` ≠ `meta.protocolVersion` · a `createSurface.catalogId` ≠ `meta.catalogId` · tier-1 `VERSION_UNSUPPORTED` → reject |
| `E_CATALOG` | LLD-C6 | component/property absent from pinned catalog → reject; report the offending `component` |
| `E_IDGRAPH` | LLD-C3/C6 | ≠1 `root` (missing or 2nd — the shared finalize-granularity rule), dangling `child`, or cycle → reject |
| `E_POINTER` (syntax) | LLD-C6 (shared `validateA2ui`) | malformed JSON-Pointer → reject; identical verdict in renderer + corpus (N1); list-item-relative forms are legal (ADR-0024) |
| `E_POINTER` (resolution) | LLD-C5 (corpus-only stage) | exemplar binding whose pointer does not resolve against the record's bundled data model → reject; layered ON TOP of `validateA2ui`, NOT part of it; relative-binding scope = the renderer's full-subtree list threading (`computeScopes()`, `admit.ts:351` — v0.5) |
| `E_DUP` | LLD-C4 | exact or near duplicate → reject with the colliding first-admitted `name` in `AdmitResult.collidesWith` (SPEC §5.2, realized) |
| `E_QUALITY` | LLD-C5 (injected judge) | below rubric gate → reject with failing dimensions; **stage skipped when no judge is injected** (ADR-0060 — `qualityScore` absent is the marker) |
| `E_LEAK` | LLD-C5/C8 | exemplar↔eval prompt collision → reject (admission) / fail CI (gate); **also the fail-closed refusal of any eval-facet candidate until LLD-C8 exists** (ADR-0060) |
| **empty corpus** | LLD-C4/C9 | dedup admits first record; `retrieve()` returns `[]` (SPEC-R11 AC2) |
| **disconnected components** | LLD-C3 | dropped from canonical form; logged, not fatal |
| **healer non-JSON** | LLD-C7 | `ok:false` → admission `E_SCHEMA` / codec `PARSE` |
| **seed near-dup at import** | LLD-C14 | report + halt for a human θ_dup ruling; never silent-skip |
| **catalog drift mid-corpus** | LLD-C11 | repair loop, §10 (deferred until the first pin bump) |
| **crypto key absent** | LLD-C8 | eval reads fail closed (no plaintext); admission of `eval` facet refuses (subsumed by the ADR-0060 fail-closed gate until C8 lands) |
| **MinHash false-positive** | LLD-C4 | exact-hash check runs first; near-dup reports the candidate for human override (does not silently merge) |

## 9. Retriever & exporters — LLD-C9, LLD-C10

**LLD-C9 retrieval (SPEC-R11, N2) — REALIZED (s8, `retrieve.ts:59`):** zero-dep **TF-IDF cosine** (resolves PRD-D1's retrieval-method open item to a TF-IDF baseline; an embedding backend is a later, tooling-scoped upgrade behind the same interface).
- **Pure over an ARRAY** (v0.3.1 — replaces the v0.2 store-handle sketch): `retrieve(records: readonly CorpusRecord[], query: {intent, k, catalogId, protocolVersion})` — callers compose `retrieve(store.all({…}), query)`; no store-handle wrapper (one call; a wrapper widens the surface for nothing, and the decomp's only build edge is record.ts→retrieve.ts). Vectorize intent, cosine vs the scoped records (`promptText` + `meta.componentsUsed` tokens), top-k descending; ties broken by ascending `name` (deterministic order); a zero-vocabulary-overlap query returns `[]` (a genuine no-match, not an arbitrary top-k of zero scores).
- **Hard eligibility invariant** (matches LLD-C10's explicit exemplar scoping; grounded in the SPEC's framing of retrieval as exemplar conditioning, §3 "Conditioning"/PRD-D1): only `facet:"exemplar"` AND `status ≠ "quarantined"` records are ever candidates, **regardless of what the caller passes** — defense-in-depth now that the input is a bare array (an eval or quarantined record in the input is silently ineligible, never an error).
- **No cross-call index cache** — the v0.2 "cached per store instance; invalidated on put" claim is retired with the store handle; the TF-IDF index is built per call over the scoped set. **N2 budget (≤200 ms p95 @10⁴):** met by measurement as-built; a memoization layer is a later optimization behind the same signature IF a caller profile demands it.

**LLD-C10 exporters — REALIZED (s9, `export.ts:67/:111`); both take the ARRAY pattern like C9 (v0.5 — not the store handle):**
- `exportCatalogExamples(records: readonly CorpusRecord[], {catalogId, protocolVersion}): CatalogExampleFile[]` (SPEC-R10): select `facet:"exemplar"` records for the scope and emit `{name, content}` pairs — the **VERIFIED upstream artifact shape** (host fetch, 2026-07-03): upstream consumes a **directory of named `*.json` files, one example per file**, each file a **bare JSON array of A2UI messages** (`content` = the record's `a2uiOutput` serialized VERBATIM); the file's basename IS the example name (a non-`BASENAME_SAFE` name is defensively skipped, `export.ts:54`); the loader sorts by filename and adds its own `---BEGIN/END EXAMPLE` wrappers (cites: `schema/manager.py:195-236` · `schema/catalog.py:352-391` · conformance `test_data/load_examples/basic/example1.json` — the fixture is committed verbatim in `export.test.ts`; the emit sort matches upstream's directory sort). The pure core emits the pairs; materializing them as files is the Node shell's job.
- `exportFineTune(records: readonly CorpusRecord[], {protocolVersion}): string[]` (SPEC-R12): yield `{prompt, context, output}` JSONL lines from exemplars only; a PLANTED eval record is excluded with the leak assertion firing (SPEC-R12 AC1's mechanism, proven while no real eval records exist).

Callers compose `…(store.all({…}), scope)` — the C9 pattern; `all()` already excludes quarantined records (§2), and both exporters re-filter facet/status defensively like the retriever.

## 10. Repair loop — LLD-C11 (SPEC-R13) — deferred

State machine per affected record on a `catalogId`/`protocolVersion` change:

```
valid ──revalidate(newTarget)──▶ passes? ──yes──▶ valid (re-pin)
                                   │
                                   no
                                   ▼
                              heal+revalidate ──passes──▶ repaired (re-pin, record diff)
                                   │
                                   no
                                   ▼
                              quarantined (excluded from consumption; reason recorded)
```

`repair()` returns `RepairReport { valid:n, repaired:n, quarantined:n, offenders:string[] }`. **Coherence assertion (SPEC-R13 AC1):** after the loop, count of records with old pin AND `status:"valid"` MUST be 0 — emitted as a CI metric (PRD-G6). Quarantined records stay in the JSONL (audit trail) but `all()`/`retrieve()`/exporters exclude `status:"quarantined"`. **Deferred:** the corpus is single-pin (v1.0) at birth; the loop lands with the first pin bump. The stages it composes (heal, tier-1, store) all ship this wave, so deferral adds no design debt.

## 11. Scoring, lift & contamination — LLD-C12, LLD-C8 — deferred

**LLD-C12 (SPEC-R14/R15/R16):** thin adapter over A2UI's Inspect-AI eval framework so we reuse its solvers/scorers rather than reinventing them. Tier-1 = `validateA2ui` (LLD-C6, identical to runtime → N1); tier-2 = LLM-as-judge against the record's **effective target `target ?? description`** (the upstream fallback semantic, ADR-0063 — a judge reading `target` raw would silently grade `undefined`; a named acceptance when this builds); the **lift runner** (SPEC-R15) compares `none`/`fewshot` (LLD-C10)/`retrieve` (LLD-C9) modes. Healing (LLD-C7) runs before tier-1 in all modes. **Upstream dataset form (verified, ADR-0063):** a `dataset_schema.json` file is one JSON **array** of samples, not JSONL — the decrypted eval slice must reach the harness as that array (at-rest form vs a one-line assembler is this wave's mechanism call), projected per §3 (no `meta`; eval records carry no `a2uiOutput`). **Split at v0.5.1 (ADR-0068):** the JUDGE half is realized by the harness wave — the `a2ui-reviewer` critic grades against `.claude/docs/rubrics/a2ui-corpus.md`, the deterministic verdict adapter (`src/corpus/judge.ts`) fills `deps.judge`, and `tools/corpus/rescore.ts` back-scores the phase-1 records (below bar ⇒ `quarantined`, R13 semantics). The SCORING/LIFT half (this paragraph's Inspect-AI adapter) stays deferred with LLD-C8 — it needs eval records, which need contamination; before that wave designs, the host must verify the upstream `eval/a2ui_eval/scorers.py` + `dataset.py` interfaces (unverified C1 facts — repo-absence ≠ spec-absence).

**LLD-C8 contamination (SPEC-R3, R4, N3):** mechanism = Transcrypt-style git clean/smudge on `corpus/eval/**.enc` (matches A2UI's own choice; key via CI secret); the leak gate reuses LLD-C4 MinHash as a pre-commit + CI check. **Deferred with the eval facet itself** — admission fail-closes eval candidates until this lands (§6, ADR-0060), so SPEC-N3's "public clone reveals 0 gold" holds vacuously and honestly.

## 12. File & integration plan

```
packages/agent-ui/a2ui/
  src/corpus/        record.ts canonical.ts dedup.ts heal.ts admit.ts store.ts retrieve.ts export.ts
                     validate.ts (realized) index.ts corpus-data.test.ts (+ co-located *.test.ts)
  corpus/            exemplar/v1_0/agent-ui.jsonl index.json      # data — written ONLY by tools/corpus
  tools/corpus/      fs-store.ts import-seeds.ts                  # Node shell (later: contamination.ts repair.ts eval/)
package.json         exports gains "./corpus": "./src/corpus/index.ts" (ADR-0062; root barrel untouched)
```

**Integration points:** `validate.ts` is owned by the renderer LLD and re-exported here (single validator, N1 — realized). `heal.ts` is imported by the future streaming codec (`stream/codec.ts`, streaming LLD-C1) — the one healer, §7. `export.ts`/`retrieve.ts` are consumed by the streaming pipeline's driver + MCP server (streaming LLD-C2/C6) and the harness loop (harness LLD-C6). The tier-2 judge seam is filled by the harness corpus-quality rubric when it lands (harness LLD-C3). `import-seeds.ts` consumes `@agent-ui/a2ui/examples` (the ADR-0055 shelf) and is the only sanctioned seeder. The `"./corpus"` subpath is the read surface for every out-of-package consumer; the root barrel (`src/index.ts:3-5`) does not re-export corpus (no corpus bytes in a renderer consumer's bundle — proven by a WHOLE-TREE grep at s10, stronger than the `./examples` precedent).

**The `"./corpus"` barrel (s10, realized):** `src/corpus/index.ts` = `export *` over all NINE core modules — record · canonical · heal · **dedup** · store · admit · retrieve · export · validate. Dedup's inclusion (`createDedupIndex`/`DedupIndex`) is a deliberate, accepted call: `AdmitDeps` requires a caller-supplied index, so any out-of-package admission driver needs the constructor. Nothing from `tools/corpus/` is re-exported (a subpath consumer never pulls `fs`).

**Wave-close follow-ups (2026-07-03 — recorded here for the host to lift into the frontier note at ship; the independent review returned GO, no blocker/major — these are its LATENT minors + notes plus the two build-surfaced items):**

*Latent correctness (both SAFE-DIRECTION — over-strict false-REJECTs, never under-strict; no shard record hits either, so future-record risks, not live defects):*
- **`computeScopes` lacks the absolute-path short-circuit** (`admit.ts`, the `${scope.arrayPath}/0/${comp.children.path}` compose): a NESTED dynamic list whose INNER template `path` is ABSOLUTE (`/`-led) mis-composes to `{outer}/0//abs` → false `E_POINTER`. The renderer's `scopedPointer` (`binding.ts:118`) short-circuits `if (path.startsWith('/')) return path`; the corpus mirror must too, or the §6 "renderer list threading BY CONSTRUCTION" equivalence has one gap. `list-nested`'s inner path is relative → no shard hit. Fix: one `startsWith('/')` guard before the compose (verified against binding.ts:117-118).
- **`findUnresolvedPointers` scans DISCONNECTED components** (`admit.ts`, `for (const comp of byId.values())`): an orphan (declared but `root`-unreachable — which `canonical.ts` drops from the canonical form + hash) carrying an unresolvable RELATIVE binding gets `E_POINTER`-rejected, though the renderer never mounts it and the identity ignores it. Fix: restrict resolution to `root`-reachable components (the set `computeScopes` already visits) — aligns the resolution surface with what canonicalization keeps.

*Gate-completeness notes (lower priority, no live defect):*
- **The purity-grep tests** (`index.test.ts:101/:137`) key on `from\s+['"]` and are BLIND to `import()` / side-effect imports — harmless today (verified zero under `src/corpus/`), but a future-violation blind spot; widen the pattern when a dynamic import first lands.
- **The standing shard gate** (`corpus-data.test.ts`) does NOT re-run admission's pointer-RESOLUTION stage — a hand-edited shard line could pass the gate yet fail `admit()`. Not live (all 11 committed records resolved at admission). Close it by adding the resolution check to the gate when the shard first gains a hand-edited or non-seed record.

*Build-surfaced (territory follow-ups):*
- **`catalog/default/index.ts`'s bare JSON import fails Node native ESM** (`ERR_IMPORT_ATTRIBUTE_MISSING`) — vitest/vite tolerate it; plain `node` (the tools runner) does not. The Node-shell workaround is documented in `import-seeds.ts`; the real fix is a `with { type: 'json' }` import attribute upstream — **components/catalog territory**, not this LLD's.
- **`scripts/measure-size.mjs` carries no `@agent-ui/a2ui` line-item** (only the components package's two barrels are budgeted). Acceptable today by construction — corpus code rides no consumer bundle (the subpath + root-barrel purity proof above) and the a2ui package is consumed in-repo only. The trigger for minting an a2ui budget line-item is **the first external consumer of `@agent-ui/a2ui`** (then per ADR-0040 §3's manual-`size` discipline).

## 13. Build sequence — **WAVE COMPLETE 2026-07-03** (the decomp manifest is `.claude/docs/decompositions/a2ui-corpus-store.decomp-v5.json`; v1–v4 are the earlier records)

This wave (s-numbers = the manifest's slice nodes; gates per slice: `npm run check` then `npm test`, run separately; no browser legs — nothing renders):

1. **s1 · LLD-C2 record + validator** — fixtures: valid/invalid records → `validateRecord` returns expected codes; facet conditional (exemplar⇒a2uiOutput); `description` unconditional (ADR-0063); single-surface (ADR-0064). *Landed, including BOTH follow-ups (ADR-0063 carve-out removal + `E_NO_TARGET` retirement · ADR-0064 single-surface walk — each its own slice; v0.4.1 books note).*
2. **s2 · LLD-C3 canonicalizer** — property tests: reorder/whitespace/ID-spelling invariance; structural + data-model difference detection (SPEC-R6 AC1/AC2); children-template `componentId` rewrite; cross-call hash stability (N6). *Landed.*
3. **s3 · LLD-C7 healer** — the ADR-0061 contract; fixtures of the closed repair list healed+recorded; a semantic defect NOT healed (negative control); `ok:false` on non-JSON. *Landed.*
4. **s4 · LLD-C4 dedup** — exact + near with inclusive `θ_dup`; first-record-admits edge. *Landed (+ `addExact`, §5).*
5. **s5 · LLD-C1 store core** — JSONL parse/serialize round-trip byte-stable; shard invariants; index regeneration; quarantine exclusion. *Landed.*
6. **s6 · LLD-C5 admission** — wire s1–s5 + LLD-C6 + pointer-resolution + the judge seam; the §8 table is the test matrix. *(checkpoint: every reachable code exercised; the parity assertion holds)* *Landed (26/26; candidate-status rule + `AdmitDeps` shape, §6; surfaced ADR-0064).*
7. **s7 · LLD-C14 + C1-shell + C15** — `tools/corpus/{fs-store,import-seeds}.ts` + the committed 11-seed shard + the standing `corpus-data.test.ts` gate; idempotent re-run admits 0 (all E_DUP). *Landed (11/11 admitted, all `valid`; gate 14/14; byte-identical re-runs by shasum; found the §6 pointer-scope bug the s6 seat fixed).*
8. **s8 · LLD-C9 retriever** — TF-IDF top-k; empty-scope `[]`; N2 latency @10⁴ synthetic. *Landed (array signature + hard eligibility invariant, §9).*
9. **s9 · LLD-C10 exporters** — catalog-examples artifact shape (SPEC-R10 AC1 + shape fixture); fine-tune JSONL + planted-eval exclusion (SPEC-R12 AC1 mechanism). *Landed (19/19; the verified upstream shape, §9).*
10. **s10 · `"./corpus"` subpath + barrel + integration gate** — exports map + `src/corpus/index.ts`; root-barrel purity proof; full `check` + `test` green. *Landed (7/7; whole-tree purity grep; §12 barrel note).*

Deferred tail (designed above, dispatched by their own triggers): **LLD-C8** contamination (trigger: the first eval record) → **LLD-C11** repair loop (trigger: the first pin bump) → **LLD-C12** (split v0.5.1: the judge half rides the harness wave, ADR-0068; the scoring/lift half's trigger moves WITH C8 to the first eval record) → MCP exposure (owned by streaming LLD-C6).

**Discovered-reality note (per `document-relationships.md`):** if s2 finds the canonical form cannot be made deterministic where `crypto.subtle` is unavailable, or s7 finds Node type-stripping cannot run the tool scripts, that pressures SPEC-N6/N5 or the tooling choice — fix the owning doc (or escalate the runner choice), do not patch this LLD silently.
