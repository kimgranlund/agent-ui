# LLD — A2UI Corpus Store

> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-training-corpus.spec.md`](../specs/a2ui-training-corpus.spec.md) (SPEC-R1..R16, SPEC-N1..N6). Closes **PRD-D4** (storage substrate) and **PRD-D5** (MCP delivery) for the corpus.
> Altitude: this document adds the **how**. It does not re-derive corpus behavior — that is the SPEC's; it cites `SPEC-R*` for the what and specifies data structures, algorithms, files, failures, and build order.

---

## 1. Component map (traceability)

Each component has a single responsibility and a SPEC home. No requirement is orphaned; no component lacks a requirement.

| ID | Component | Implements | File (under `packages/agent-ui/a2ui/`) | Scope |
|---|---|---|---|---|
| **LLD-C1** | Storage layer (JSONL + index) | SPEC-R1, R3, R9, N5 | `corpus/` (data) + `src/corpus/store.ts` | runtime |
| **LLD-C2** | Record model + schema validator | SPEC-R1, R2 | `src/corpus/record.ts` | runtime |
| **LLD-C3** | Canonicalizer | SPEC-R6, N6 | `src/corpus/canonical.ts` | runtime |
| **LLD-C4** | Hasher + dedup index | SPEC-R7 | `src/corpus/dedup.ts` | runtime |
| **LLD-C5** | Admission pipeline | SPEC-R5–R9 | `src/corpus/admit.ts` | runtime |
| **LLD-C6** | Validator-parity adapter | SPEC-R8, R14, N1 | `src/corpus/validate.ts` → re-exports `../renderer/validate.ts` | runtime |
| **LLD-C7** | Healer (parse/fix parity) | SPEC-R8, R14 | `src/corpus/heal.ts` | runtime |
| **LLD-C8** | Contamination split + crypto + leak gate | SPEC-R3, R4, N3 | `tools/corpus/contamination.ts` + `.gitattributes` | dev/CI |
| **LLD-C9** | Retriever (TF-IDF, top-k) | SPEC-R11, N2 | `src/corpus/retrieve.ts` | runtime |
| **LLD-C10** | Exporters (catalog-examples, fine-tune) | SPEC-R10, R12 | `src/corpus/export.ts` | runtime |
| **LLD-C11** | Repair loop | SPEC-R13 | `tools/corpus/repair.ts` | dev/CI |
| **LLD-C12** | Scoring + lift harness (Inspect-AI interop) | SPEC-R14, R15, R16 | `tools/corpus/eval/` | dev/CI |
| **LLD-C13** | MCP serving surface | SPEC-R11, N2 (+ PRD-G7) | `tools/corpus/mcp-server.ts` | dev/CI |

**Runtime vs tooling split (SPEC-N5).** The `src/corpus/*` modules are zero-dependency TS consumable by `@agent-ui/a2ui`. The `tools/corpus/*` modules (crypto, repair, eval/judge, MCP) are dev/CI-scoped and MAY use dependencies; they never enter the consumer bundle.

## 2. Storage layer — LLD-C1

**Substrate (PRD-D4): flat JSONL in-repo**, one record per line, sharded by facet and protocol version. An in-memory index is built on load; no database until scale forces it (revisit at > 10⁵ records).

```
packages/agent-ui/a2ui/corpus/
  exemplar/
    v0_9/<catalogId>.jsonl        # public; one CorpusRecord (facet:"exemplar") per line
    v1_0/<catalogId>.jsonl
  eval/
    v0_9/<catalogId>.jsonl.enc    # contamination-protected (LLD-C8); transparent-decrypt
    v1_0/<catalogId>.jsonl.enc
  index.json                      # derived: {canonicalHash → name}, {catalogId → names[]}, counts
```

**Invariants.** (i) `name` is unique across both sub-corpora (join key). (ii) A file under `exemplar/` contains only `facet:"exemplar"` records; under `eval/`, only `facet:"eval"`. (iii) `index.json` is derived and regenerable from the JSONL; it is never the source of truth.

```ts
interface Store {
  load(): void;                                  // parse all JSONL → in-memory maps; rebuild index
  get(name: string): CorpusRecord | undefined;
  put(rec: CorpusRecord): void;                  // append to the correct shard; update index
  shardPath(rec: CorpusRecord): string;          // facet + protocolVersion + catalogId → path
  all(filter?: { facet?: Facet; catalogId?: string; protocolVersion?: string }): CorpusRecord[];
}
```

## 3. Record model & validator — LLD-C2

`CorpusRecord` is the TS form of the SPEC §5.1 schema. Validation is a zero-dep hand-rolled checker (the repo bans heavyweight deps); it mirrors the draft-07 schema field-by-field.

```ts
type Facet = "exemplar" | "eval";
type Status = "valid" | "repaired" | "quarantined";
type A2uiOutput = A2uiMessage[];                 // ordered server→client envelope messages

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

// returns [] when valid; otherwise the list of failures (code + JSON path)
function validateRecord(r: unknown): { code: ErrorCode; path: string }[];
```

**Invariant:** `validateRecord` is pure and total — never throws, returns structured failures (so admission can map them to error codes, §8).

## 4. Canonicalizer — LLD-C3 (SPEC-R6, N6)

The A2UI `updateComponents` list is an **adjacency list**: declaration order is insignificant (refs are by ID) but **child order within a container is semantic** and MUST be preserved. Canonicalization therefore re-derives the tree and normalizes only the insignificant axes.

**Algorithm `canonicalize(out: A2uiOutput): { form: A2uiOutput; hash: string }`:**
1. Fold the stream into a component map `id → component` and a data-model object (apply `updateComponents`/`updateDataModel` in order).
2. Assert exactly one `root` (else surface to caller as `E_IDGRAPH` — admission handles, §8).
3. DFS from `root`, visiting `child`/`children` in declared order; assign canonical IDs `c0=root, c1, c2…` in visit order; record `componentsUsed` (set of `component` type names).
4. Rewrite all ID references (`child`, `children`, and any JSON-Pointer paths that target component IDs) to canonical IDs.
5. Emit components in DFS order; within each component, sort property keys lexicographically (children arrays keep their element order).
6. Serialize with a stable JSON writer (sorted keys, no insignificant whitespace); `hash = SHA-256(serialized)` via Web Crypto `subtle.digest` (zero-dep, cross-platform → satisfies N6).

**Edge cases:** disconnected components (declared but unreachable from `root`) are dropped from the canonical form and noted; a cycle aborts with `E_IDGRAPH`.

## 5. Hasher + dedup — LLD-C4 (SPEC-R7)

Two-stage: exact then near.
- **Exact:** `canonicalHash` equality against `index.json`'s hash set → `E_DUP`.
- **Near:** MinHash signature (128 permutations) over token shingles (k=3) of `promptText + " " + canonicalSerialized`; estimate Jaccard against admitted signatures; if `≥ θ_dup` → `E_DUP` reporting the colliding `name`. **Default `θ_dup = 0.9`, documented and configurable** (SPEC-R7 leaves the value tunable).

```ts
interface DedupIndex {
  addsignature(name: string, sig: Uint32Array): void;
  exact(hash: string): string | null;            // colliding name or null
  near(sig: Uint32Array, theta: number): string | null;
}
```

**Edge:** an empty corpus → both checks return null (first record always admits). A signature tie at exactly `θ_dup` counts as a duplicate (inclusive bound, matches SPEC-R7 AC2 "≥").

## 6. Admission pipeline — LLD-C5 (SPEC-R5–R9)

Center-out orchestration; each stage is independently testable and short-circuits on first failure.

```
admit(candidate) =
  heal           (LLD-C7)   → may rewrite a2uiOutput; record if changed (SPEC-R8)
  schema/field   (LLD-C2)   → E_SCHEMA | E_NO_TARGET
  pin check      (LLD-C2)   → E_PIN     (SPEC-R9: protocolVersion+catalogId present; output refs match pin)
  tier-1 deterministic (LLD-C6 = shared `validateA2ui`): catalog-conformance E_CATALOG · id-graph E_IDGRAPH (EXACTLY one root) · pointer-SYNTAX E_POINTER (RFC-6901)
  pointer-RESOLUTION (corpus-only, LLD-C5): exemplar bindings must resolve against the record's bundled data model → E_POINTER. Layered ON TOP of tier-1; NOT part of `validateA2ui` (the renderer streams → an unresolved path is a placeholder, renderer SPEC-R4 AC2). Parity (N1/R8-AC3) is over `validateA2ui`, which is unchanged.
  leak gate      (LLD-C8)   → E_LEAK    (candidate exemplar vs eval prompts, and vice-versa)
  canonical+hash (LLD-C3)   → fills meta.canonicalHash, meta.componentsUsed
  dedup          (LLD-C4)   → E_DUP
  tier-2 rubric  (judge)    → E_QUALITY (below corpus-quality gate; eval facet MAY skip if no output)
  write          (LLD-C1)   → put() + index update
```

**State:** admitted records enter `status:"valid"`. The pipeline is the only writer of the corpus (single mutation path → the parity invariant SPEC-N1/R8-AC3 holds because tier-1 is the shared validator LLD-C6).

## 7. Validator-parity & healer — LLD-C6, LLD-C7

**LLD-C6** does not re-implement validation: it re-exports the single `validate.ts` the renderer LLD (`a2ui-renderer.lld.md`) owns, so admission and runtime share one implementation (SPEC-N1). Its surface:

```ts
interface ValidationVerdict { valid: boolean; failures: { code: ErrorCode; path: string }[] }
function validateA2ui(out: A2uiOutput, catalog: Catalog): ValidationVerdict;
//   schema + catalog + id-graph (exactly one root, on the complete output) + pointer SYNTAX (RFC-6901)
```

The shared validator checks pointer **syntax only**; it does **not** resolve pointers against the data model (that preserves renderer SPEC-R4 AC2 — an undefined path renders a placeholder, not an error). Corpus admission layers an *additional* pointer-**resolution** stage on top (LLD-C5, §6/§8): an exemplar bundles its complete data model, so resolution is checkable at admission — a strictness the streaming renderer cannot and must not apply. Parity (SPEC-N1 / corpus SPEC-R8 AC3) is asserted over `validateA2ui`, byte-identical for both callers; the corpus-only resolution stage sits outside it.

**LLD-C7 healer** mirrors A2UI's `parse_response` + `payload_fixer`: strip markdown fences, extract the JSON payload, repair common defects (trailing commas, a missing `version` field, a single-object-not-array `updateComponents`). Returns `{ healed: A2uiOutput; changed: boolean }`. **Healing is applied before tier-1 in both admission and scoring** (SPEC-R8, R14) so formatting noise never masks intent. **Edge:** if healing cannot produce parseable JSON, return `changed:false` and let tier-1 fail with `E_SCHEMA`.

## 8. Error & edge-case handling (the enumeration this LLD owns)

Every SPEC error code mapped to its raising stage, plus the non-obvious edges:

| Code / edge | Stage | Handling |
|---|---|---|
| `E_SCHEMA` | LLD-C2 | reject; return failing JSON paths; healer ran first so it is a true schema defect |
| `E_NO_TARGET` | LLD-C2 | eval record with neither `target` nor `description` → reject |
| `E_PIN` | LLD-C2 | missing pin, or `a2uiOutput` references a `catalogId`/version ≠ `meta` pin → reject |
| `E_CATALOG` | LLD-C6 | component/property absent from pinned catalog → reject; report the offending `component` |
| `E_IDGRAPH` | LLD-C3/C6 | ≠1 `root` (missing or 2nd — matches the renderer shared id-graph rule), dangling `child`, or cycle → reject; cycle detection via DFS colouring |
| `E_POINTER` (syntax) | LLD-C6 (shared `validateA2ui`) | malformed JSON-Pointer (not RFC-6901) → reject; identical verdict in renderer + corpus (N1/N6) |
| `E_POINTER` (resolution) | LLD-C5 (corpus-only stage) | exemplar binding whose pointer does not resolve against the record's bundled data model → reject; layered ON TOP of `validateA2ui`, NOT part of it (renderer streams → undefined path is a placeholder, renderer SPEC-R4 AC2) |
| `E_DUP` | LLD-C4 | exact or near duplicate → reject with colliding `name` |
| `E_QUALITY` | LLD-C5 (judge) | below rubric gate → reject with failing dimensions |
| `E_LEAK` | LLD-C8 | exemplar↔eval prompt collision → reject (admission) / fail CI (gate) |
| **empty corpus** | LLD-C4/C9 | dedup admits first record; `retrieve()` returns `[]` (SPEC-R11 AC2) |
| **disconnected components** | LLD-C3 | dropped from canonical form; logged, not fatal |
| **healer non-JSON** | LLD-C7 | `changed:false` → tier-1 `E_SCHEMA` |
| **catalog drift mid-corpus** | LLD-C11 | repair loop, §10 |
| **crypto key absent** | LLD-C8 | eval reads fail closed (no plaintext); admission of `eval` facet refuses without key |
| **MinHash false-positive** | LLD-C4 | exact-hash check runs first; near-dup reports the candidate for human override (does not silently merge) |

## 9. Retriever & exporters — LLD-C9, LLD-C10

**LLD-C9 retrieval (SPEC-R11, N2):** zero-dep **TF-IDF cosine** (resolves PRD-D1's retrieval-method open item to a TF-IDF baseline; an embedding backend is a later, tooling-scoped upgrade behind the same interface).
- Index: term → idf; per-record sparse tf-idf vector over tokens of `promptText` + `meta.componentsUsed`, scoped by `catalogId`+`protocolVersion`.
- `retrieve({intent,k,catalogId,protocolVersion})`: vectorize intent, cosine vs the scoped set, return top-k descending. Built index is cached; rebuild on `put`. **N2 budget (≤200 ms p95 @10⁴):** linear scan over a scoped shard is sufficient at this size; no ANN needed yet.

**LLD-C10 exporters:**
- `exportCatalogExamples` (SPEC-R10): select `facet:"exemplar"` records for the scope, emit the A2UI named-example artifact shape that `generate_system_prompt(include_examples=True)` loads; **interop test** (SPEC-R10 AC2) feeds the artifact to an A2UI schema manager fixture.
- `exportFineTune` (SPEC-R12): stream `{prompt, context, output}` JSONL from exemplars only; assert 0 `eval` records (re-run leak gate over output).

## 10. Repair loop — LLD-C11 (SPEC-R13)

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

`repair()` returns `RepairReport { valid:n, repaired:n, quarantined:n, offenders:string[] }`. **Coherence assertion (SPEC-R13 AC1):** after the loop, count of records with old pin AND `status:"valid"` MUST be 0 — emitted as a CI metric (PRD-G6). Quarantined records stay in the JSONL (audit trail) but `all()`/`retrieve()`/exporters exclude `status:"quarantined"`.

## 11. Scoring, lift & contamination — LLD-C12, LLD-C8

**LLD-C12 (SPEC-R14/R15/R16):** thin adapter over A2UI's Inspect-AI eval framework so we reuse its solvers/scorers rather than reinventing them.
- Dataset: our `eval/` shards conform to `dataset_schema.json` (SPEC-R16) → loadable directly after decrypt.
- Solver: `A2uiSchemaManager`-parity prompt assembly + generation via the `@agent-ui/a2ui` agent path.
- Scorer: **tier-1** = `validateA2ui` (LLD-C6, identical to runtime → N1); **tier-2** = LLM-as-judge against `target` (provider-agnostic; Anthropic/Claude default).
- **Lift runner (SPEC-R15):** run the eval set in three modes — `none`, `fewshot` (LLD-C10 export), `retrieve` (LLD-C9) — holding model fixed; report valid-and-interactive rate per mode and the pairwise Δpp. Healing (LLD-C7) runs before tier-1 in all modes.

**LLD-C8 contamination (SPEC-R3, SPEC-R4, SPEC-N3):** mechanism = **Transcrypt-style git clean/smudge** on `corpus/eval/**.enc` (matches A2UI's own choice; password-string key via CI secret). The **leak gate** reuses LLD-C4 MinHash: for every eval prompt, near-match against all exemplar prompts; any pair `≥ θ_dup` → `E_LEAK`. Wired as a pre-commit + CI check (a script/hook per `process.md`, not agent judgment).

## 12. File & integration plan

```
packages/agent-ui/a2ui/
  src/corpus/        record.ts canonical.ts dedup.ts admit.ts validate.ts heal.ts retrieve.ts export.ts store.ts index.ts
  corpus/            exemplar/** eval/**.enc index.json        # data
  tools/corpus/      contamination.ts repair.ts mcp-server.ts  eval/{dataset.ts,scorers.ts,lift.ts}
  .gitattributes     corpus/eval/** filter=transcrypt
```

**Integration points:** `validate.ts` is owned by the renderer LLD and imported here (single validator, N1). `export.ts` output is consumed by the streaming-pipeline LLD's generation path. The MCP server (LLD-C13) wraps `retrieve`/`admit`/`score` per the MCP LLD (`a2ui-mcp.lld.md`); transport default is CLI-based (PRD-D5). The corpus-quality rubric (harness) is the tier-2 judge in admission.

## 13. Build sequence (dependency-ordered; each step independently verifiable)

1. **LLD-C2 record + validator** — fixtures: valid/invalid records → `validateRecord` returns expected codes. *(checkpoint: schema parity with SPEC §5.1)*
2. **LLD-C3 canonicalizer** — property tests: reorder/whitespace/ID-spelling invariance; structural difference detection (SPEC-R6 AC1/AC2). *(checkpoint: N6 cross-platform hash stability)*
3. **LLD-C6 validator-parity adapter** — depends on renderer `validate.ts`; if that does not yet exist, stub against the catalog schema and mark the integration TODO. *(checkpoint: N1 parity test harness exists)*
4. **LLD-C7 healer** — fixtures of common LLM defects → healed+valid. 
5. **LLD-C4 dedup** — exact + near with `θ_dup`; first-record-admits edge.
6. **LLD-C1 store** — JSONL round-trip; index regenerate.
7. **LLD-C5 admission** — wire 1–6; the error-table (§8) becomes the test matrix. *(checkpoint: every error code reachable)*
8. **LLD-C9 retriever** — TF-IDF top-k; N2 latency check @10⁴ synthetic.
9. **LLD-C10 exporters** — catalog-examples interop fixture (SPEC-R10 AC2); fine-tune leak assertion.
10. **LLD-C8 contamination** — transcrypt filter + leak gate as CI hook. *(checkpoint: public-clone reveals 0 gold, N3)*
11. **LLD-C11 repair** — version-bump simulation → 0 silently-stale (SPEC-R13 AC1).
12. **LLD-C12 scoring + lift** — Inspect-AI dataset load (SPEC-R16), then lift run produces the PRD-G5 Δpp. *(checkpoint: PRD-G5 metric emitted)*
13. **LLD-C13 MCP server** — expose retrieve/admit/score; per `a2ui-mcp.lld.md`.

**Discovered-reality note (per `document-relationships.md`):** if step 3 reveals the renderer's validator cannot be shared zero-dep (e.g. catalog schema needs a dep), that invalidates SPEC-N1/N5 → fix the SPEC (and possibly PRD Constraint C2), do not patch this LLD silently.
