# SPEC — A2UI Training Corpus

> Status: proposed · v0.1 · 2026-06-26 · Layer: SPEC (execution contract)
> Refines: [`../a2ui-expert-system.prd.md`](../a2ui-expert-system.prd.md) — primarily **PRD-G5** (flagship) and **PRD-D1**; supports PRD-G4, PRD-G6, PRD-G7.
> Refined by: [`../llds/a2ui-corpus-store.lld.md`](../llds/a2ui-corpus-store.lld.md) (storage, dedup algorithm, MCP wiring) and the harness LLDs (gates).
> Altitude: this document owns the corpus **behavior + data/schema contract**. Storage substrate, indexing internals, and file layout are deferred to the LLD. Requirements reference PRD goal IDs; they do not restate them.

---

## 1. Purpose

Define the behavior and contracts of the **training corpus** that conditions A2UI generation and measures it. The corpus is the artifact that turns "an agent can emit A2UI" into "an agent reliably emits valid, idiomatic A2UI" (PRD-G5), and the substrate the deterministic gates (PRD-G4) and coherence loop (PRD-G6) act on.

The design is grounded in — and interoperable with — A2UI's own evaluation framework: the Inspect-AI-based `eval/` harness, its `dataset_schema.json` (fields `name` · `description` · `promptText` · `target` · `catalog` · `role_description` · `workflow_description`), hybrid scoring (`A2uiValidator` + LLM-as-a-judge), `parse_response`/`payload_fixer` healing, and runtime/eval validation parity. These are external A2UI facts (Constraint **C1**); this SPEC conforms to them rather than redefining them.

## 2. Key concept: two sub-corpora

The single most load-bearing decision in this SPEC. A2UI's eval framework encrypts its eval datasets at rest precisely because public "gold" answers get ingested by training crawlers and inflate scores (data contamination). The corpus therefore has **two facets that must never be conflated**:

| Sub-corpus | Purpose | Visibility | Carries |
|---|---|---|---|
| **Exemplar corpus** | *Condition* generation — few-shot, retrieval, fine-tune | Public / model-visible by design | prompt + **ground-truth A2UI output** |
| **Eval corpus** | *Measure* generation — held-out scoring | Held-out / contamination-protected | prompt + **judge `target`**, no model-visible gold in the open |

The no-leak invariant between them (SPEC-R3) is what keeps the measurement honest.

## 3. Definitions

- **Record** — one corpus entry (§5, SPEC-R1).
- **A2UI output** — an ordered A2UI server→client message stream (`createSurface`→`updateComponents`→`updateDataModel`…) that renders to a UI; the ground truth of an exemplar record.
- **Canonical form** — a normalized A2UI output (stable component ordering, normalized IDs, stripped insignificant whitespace) used for dedup and equality (SPEC-R6).
- **Admission** — the act of a candidate record passing the curation pipeline and entering a sub-corpus (SPEC-R8).
- **Conditioning** — supplying corpus exemplars to a generator via few-shot, retrieval, or fine-tune (SPEC-R10–R12).

---

## 4. Requirements

Normative language: **MUST** / **SHOULD** / **MAY** per RFC 2119. Each requirement carries a stable ID, a PRD trace, and acceptance criteria (AC). Gate-checkable AC are written so a test or script decides them.

### 4.1 Data model

**SPEC-R1 — Record schema is a superset of A2UI's dataset schema.** Every record MUST carry the A2UI `dataset_schema.json` fields (`name`, `description`, `promptText`, optional `target`/`catalog`/`role_description`/`workflow_description`) and the curation metadata in §6. The typed contract is normative (§5). *(→ PRD-G5, PRD-G6)*
- **AC1** *Given* any record in either sub-corpus, *when* validated against the corpus record schema (§5), *then* it conforms, and stripping the curation-metadata block yields an object that validates against A2UI's upstream `dataset_schema.json` for its pinned protocol version.
- **AC2** *Given* a record missing any of `name`/`description`/`promptText`, *when* admission runs, *then* it is rejected with error `E_SCHEMA`.

**SPEC-R2 — Exemplar records carry ground-truth A2UI output.** A record in the exemplar corpus MUST include a valid `a2uiOutput` (the message stream). A record in the eval corpus MUST include a `target` (judge criteria) and MUST NOT be required to carry `a2uiOutput`. *(→ PRD-G5, PRD-D1)*
- **AC1** *Given* an exemplar record, *when* admitted, *then* `a2uiOutput` is present and passes deterministic validation (SPEC-R8 tier 1).
- **AC2** *Given* an eval record with neither `target` nor `description`, *when* admitted, *then* it is rejected with `E_NO_TARGET` (A2UI defaults `target` to `description`; one of them MUST exist).

### 4.2 Sub-corpora & contamination protection

**SPEC-R3 — Two sub-corpora with a no-leak invariant.** The system MUST maintain the exemplar and eval sub-corpora as distinct sets. No eval-corpus `promptText` (or a near-duplicate of it, by the SPEC-R7 similarity measure) MAY appear in the exemplar corpus. *(→ PRD-G5)*
- **AC1** *Given* the two sub-corpora, *when* the leak gate runs, *then* it reports 0 eval prompts whose similarity to any exemplar prompt exceeds the dedup threshold (SPEC-R7); a nonzero count fails CI with `E_LEAK`.
- **AC2** *Given* a candidate exemplar whose prompt collides with an eval prompt, *when* admission runs, *then* it is rejected with `E_LEAK`.

**SPEC-R4 — Eval corpus is contamination-protected at rest.** The eval corpus MUST be stored such that its model-gradeable content is not exposed in plaintext to public crawlers (e.g. encryption-at-rest with transparent local decrypt for authorized contributors, or a private split). The chosen mechanism is an LLD decision; the *behavior* — "public clone does not reveal eval gold" — is normative here. *(→ PRD-G5)*
- **AC1** *Given* a public checkout without the decryption key, *when* eval records are read, *then* `target` (and any gold) is not recoverable in plaintext.
- **AC2** *Given* an authorized contributor with the key, *when* they read the eval corpus, *then* records decrypt transparently and validate against §5.

### 4.3 Curation pipeline

**SPEC-R5 — Provenance-tracked ingestion.** Records MUST be ingestible from at least three sources — *authored*, *distilled* (from real A2UI streams/sessions), and *mined* — and every record MUST record its `provenance` (source kind + origin reference). *(→ PRD-G5, PRD-G6)*
- **AC1** *Given* a record admitted from any source, *when* inspected, *then* `provenance.source` ∈ {`authored`,`distilled`,`mined`} and `provenance.origin` is non-empty.

**SPEC-R6 — Canonicalization precedes equality/dedup.** The system MUST reduce an `a2uiOutput` to a deterministic **canonical form** before hashing or comparison: stable child-ordering by the adjacency model, ID renaming to a canonical scheme (preserving the single `root`), and removal of insignificant formatting. *(→ PRD-G5)*
- **AC1** *Given* two A2UI outputs that differ only by component-array order, whitespace, or ID spelling, *when* canonicalized, *then* their canonical forms (and hashes) are byte-identical.
- **AC2** *Given* two outputs that differ in a bound `path`, a component type, or tree structure, *when* canonicalized, *then* their canonical forms differ.

**SPEC-R7 — Deduplication on admission.** A candidate MUST be rejected as a duplicate if its canonical hash matches an admitted record, or its prompt+output similarity to an admitted record exceeds a configured threshold `θ_dup` (default SHOULD be documented and tunable). *(→ PRD-G5)*
- **AC1** *Given* a candidate whose canonical hash equals an admitted record's, *when* admission runs, *then* it is rejected with `E_DUP`.
- **AC2** *Given* a candidate with similarity ≥ `θ_dup` to an admitted record, *when* admission runs, *then* it is rejected with `E_DUP` and the colliding record id is reported.

**SPEC-R8 — Two-tier admission quality gate.** A candidate is admitted only if it passes **both**: (tier 1, deterministic) the A2UI validation parity check — schema, catalog-conformance (every component/property exists in the pinned catalog), single-`root` + acyclic ID graph, and valid JSON-Pointer bindings; and (tier 2, judgment) the corpus-quality rubric ≥ its gate bar. Healing (`payload_fixer`-parity) MAY be applied before tier 1 and, if it changes the record, the healed form is what is admitted. *(→ PRD-G4, PRD-G5)*
- **AC1** *Given* a candidate that fails any tier-1 check, *when* admission runs, *then* it is rejected with the specific code (`E_SCHEMA`, `E_CATALOG`, `E_IDGRAPH`, or `E_POINTER`) and is not admitted.
- **AC2** *Given* a candidate that passes tier 1 but scores below the corpus-quality rubric gate, *when* admission runs, *then* it is rejected with `E_QUALITY` and the failing dimensions are reported.
- **AC3** *Given* the same candidate, *when* tier-1 validation runs in admission and at generation runtime, *then* both use the same validator and return the same verdict (runtime/eval parity).

**SPEC-R9 — Version pinning.** Every record MUST pin the A2UI `protocolVersion` and the `catalogId`(+version) it targets. *(→ PRD-G6)*
- **AC1** *Given* any admitted record, *when* inspected, *then* `protocolVersion` and `catalogId` are present and non-empty.
- **AC2** *Given* a record whose `a2uiOutput` references a catalog/version it does not pin, *when* admission runs, *then* it is rejected with `E_PIN`.

### 4.4 Consumption

**SPEC-R10 — Export as A2UI catalog examples (static few-shot).** The exemplar corpus MUST be exportable into the form A2UI's `A2uiSchemaManager.generate_system_prompt(include_examples=True)` consumes (named, version-scoped example templates bound to a catalog), filterable by `catalogId` and `protocolVersion`. *(→ PRD-G5, PRD-D1)*
- **AC1** *Given* a `catalogId` + `protocolVersion`, *when* export runs, *then* it emits a catalog-examples artifact whose entries all pin that catalog/version and pass tier-1 validation.
- **AC2** *Given* the exported artifact, *when* loaded by an A2UI schema manager, *then* it is accepted without modification (interop check).

**SPEC-R11 — Dynamic retrieval (top-k by intent).** The system MUST expose retrieval of the top-`k` exemplars most relevant to a query intent, returning records (prompt + `a2uiOutput`) ranked by a relevance score, scoped to a `catalogId`/`protocolVersion`. Retrieval SHOULD be exposable over MCP (self-hosted or CLI) for a generating agent. *(→ PRD-G5, PRD-D1, PRD-G7)*
- **AC1** *Given* a query intent and `k`, *when* retrieval runs, *then* it returns ≤ `k` records, each pinned to the requested catalog/version, ordered by descending relevance, in ≤ the NFR latency budget (SPEC-N2).
- **AC2** *Given* an empty exemplar corpus for the scope, *when* retrieval runs, *then* it returns an empty list (not an error).

**SPEC-R12 — Fine-tune export.** The exemplar corpus MUST be exportable as instruction/output pairs (prompt+context → `a2uiOutput`) in a documented serialization (e.g. JSONL), excluding any eval-corpus content. *(→ PRD-G5, PRD-D1)*
- **AC1** *Given* an export request, *when* it runs, *then* every emitted pair derives from the exemplar corpus only (0 eval records), and the leak gate (SPEC-R3) passes over the output.

### 4.5 Maintenance & coherence

**SPEC-R13 — Repair loop on catalog or protocol change.** When a pinned `catalogId`/version or `protocolVersion` changes, the system MUST re-validate every affected record against the new target and mark each `valid`, `repaired`, or `quarantined`; it MUST NOT leave a record silently stale. *(→ PRD-G5, PRD-G6)*
- **AC1** *Given* a catalog version bump, *when* the repair loop runs, *then* every affected record ends in state ∈ {`valid`,`repaired`,`quarantined`} and the count of records still pinned to the old version with status `valid` is 0.
- **AC2** *Given* a record that no longer validates and cannot be auto-repaired, *when* the loop runs, *then* it is `quarantined` (excluded from consumption) with the failing reason recorded.

### 4.6 Evaluation

**SPEC-R14 — Dual-tier scoring with healing.** Generated A2UI MUST be scored by (tier 1) deterministic validation (the SPEC-R8 parity check) and (tier 2) an LLM-as-a-judge against the record's `target`, with `parse_response`/`payload_fixer`-parity healing applied before scoring so grading targets intent, not formatting. *(→ PRD-G4, PRD-G5)*
- **AC1** *Given* a generated output and its eval record, *when* scoring runs, *then* it returns a tier-1 boolean (valid/invalid + codes) and a tier-2 judged score against `target`.
- **AC2** *Given* an output that is intent-correct but has a healable formatting defect, *when* scoring runs, *then* healing is applied first and tier-1 does not fail on the formatting alone.

**SPEC-R15 — Lift measurement.** The system MUST measure generation quality **with vs without** corpus conditioning over a fixed eval set, producing the PRD-G5 lift metric. *(→ PRD-G5)*
- **AC1** *Given* the eval set and a fixed model, *when* the lift run executes, *then* it reports valid-and-interactive rate for the no-corpus baseline and for each conditioning mode (few-shot/retrieval), and their difference in percentage points.

**SPEC-R16 — Eval-harness interoperability.** The eval corpus MUST be runnable by A2UI's upstream Inspect-AI eval harness without transformation beyond decryption — i.e. it conforms to `dataset_schema.json` for its pinned version. *(→ PRD-G5, PRD-G6)*
- **AC1** *Given* a decrypted eval-corpus slice for a version, *when* fed to the upstream harness, *then* it loads and runs with 0 schema errors.

---

## 5. Typed contracts

### 5.1 Corpus record (normative)

JSON Schema (draft-07, matching A2UI's `dataset_schema.json` dialect). The first block is the A2UI superset; `meta` is our curation block.

```jsonc
// CorpusRecord
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "description", "promptText", "meta"],
  "additionalProperties": false,
  "properties": {
    // ── A2UI dataset_schema.json superset (SPEC-R1) ──
    "name":                 { "type": "string" },          // unique id
    "description":          { "type": "string" },
    "promptText":           { "type": "string" },          // user input to the LLM
    "target":               { "type": "string" },          // judge criteria (eval facet; defaults to description)
    "catalog":              { "type": "string" },          // catalog file path / id
    "role_description":     { "type": "string" },          // generate_system_prompt() param
    "workflow_description": { "type": "string" },          // generate_system_prompt() param
    // ── exemplar facet (SPEC-R2) ──
    "a2uiOutput":           { "type": "array", "items": { "type": "object" } }, // ordered A2UI message stream (ground truth)
    // ── curation metadata (SPEC-R5/R6/R7/R9/R13) ──
    "meta": {
      "type": "object",
      "required": ["facet", "protocolVersion", "catalogId", "provenance", "status"],
      "additionalProperties": false,
      "properties": {
        "facet":           { "enum": ["exemplar", "eval"] },              // SPEC-R3
        "protocolVersion": { "type": "string" },                          // SPEC-R9, e.g. "v0.9" | "v1.0"
        "catalogId":       { "type": "string" },
        "catalogVersion":  { "type": "string" },
        "provenance":      {                                              // SPEC-R5
          "type": "object",
          "required": ["source", "origin"],
          "properties": {
            "source": { "enum": ["authored", "distilled", "mined"] },
            "origin": { "type": "string" }
          }
        },
        "canonicalHash":   { "type": "string" },                          // SPEC-R6/R7
        "componentsUsed":  { "type": "array", "items": { "type": "string" } },
        "status":          { "enum": ["valid", "repaired", "quarantined"] }, // SPEC-R13
        "qualityScore":    { "type": "number" }                           // SPEC-R8 tier 2
      }
    }
  },
  "allOf": [
    { "if": { "properties": { "meta": { "properties": { "facet": { "const": "exemplar" } } } } },
      "then": { "required": ["a2uiOutput"] } },                           // SPEC-R2
    { "if": { "properties": { "meta": { "properties": { "facet": { "const": "eval" } } } } },
      "then": { "anyOf": [ { "required": ["target"] }, { "required": ["description"] } ] } }
  ]
}
```

### 5.2 Operation surface (behavioral contract; signatures illustrative — internals are LLD)

```ts
type AdmitResult =
  | { ok: true;  record: CorpusRecord }
  | { ok: false; code: ErrorCode; detail: string; collidesWith?: string };

interface CorpusOps {
  admit(candidate: CorpusRecord): AdmitResult;                        // SPEC-R5..R9
  retrieve(q: { intent: string; k: number;
                catalogId: string; protocolVersion: string }): CorpusRecord[]; // SPEC-R11
  exportCatalogExamples(s: { catalogId: string; protocolVersion: string }): CatalogExamplesArtifact; // SPEC-R10
  exportFineTune(s: { protocolVersion: string }): JsonlStream;        // SPEC-R12
  repair(change: { catalogId?: string; protocolVersion?: string }): RepairReport; // SPEC-R13
  score(gen: A2uiOutput, against: CorpusRecord): { tier1: ValidationVerdict; tier2: JudgeScore }; // SPEC-R14
  leakCheck(): { leaks: number; offenders: string[] };               // SPEC-R3
}
```

### 5.3 Error codes (normative)

| Code | Meaning | Raised by |
|---|---|---|
| `E_SCHEMA` | Fails the corpus record schema / required A2UI fields | SPEC-R1, R8 |
| `E_NO_TARGET` | Eval record lacks both `target` and `description` | SPEC-R2 |
| `E_CATALOG` | References a component/property absent from the pinned catalog | SPEC-R8 |
| `E_IDGRAPH` | Not exactly one `root`, or dangling/cyclic child reference | SPEC-R8 |
| `E_POINTER` | Invalid JSON-Pointer data binding | SPEC-R8 |
| `E_DUP` | Canonical-hash or similarity duplicate | SPEC-R7 |
| `E_QUALITY` | Below corpus-quality rubric gate | SPEC-R8 |
| `E_PIN` | Missing/mismatched protocol or catalog version pin | SPEC-R9 |
| `E_LEAK` | Eval/exemplar contamination | SPEC-R3 |

---

## 6. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Validation parity | Tier-1 admission validation and runtime generation validation use one implementation; a parity test asserts identical verdicts on a shared fixture set (0 disagreements). *(→ PRD-G4)* |
| **SPEC-N2** | Retrieval latency | `retrieve()` returns within **≤ 200 ms** p95 for a corpus of ≤ 10⁴ exemplars on a developer machine. *(→ PRD-G5)* |
| **SPEC-N3** | Contamination safety | A public clone reveals **0** eval `target`/gold in plaintext; CI fails on any leak (`E_LEAK`). *(→ PRD-G5)* |
| **SPEC-N4** | Curation throughput | Admission of a single record (heal + tier-1 + dedup) completes in **≤ 1 s** p95 (excludes tier-2 rubric/judge). |
| **SPEC-N5** | Zero runtime deps | The corpus runtime consumed by `@agent-ui/a2ui` adds no third-party runtime dependency (Constraint **C2**); tooling-only deps (eval/judge) live in dev/CI scope. |
| **SPEC-N6** | Determinism | Canonicalization and hashing are deterministic across platforms (same input → same `canonicalHash`). *(→ SPEC-R6)* |

---

## 7. Open items (non-normative; tracked, not assumed)

- **PRD-D1 (consumption mode)** — this SPEC makes few-shot via catalog examples (SPEC-R10) the **baseline**, retrieval (SPEC-R11) the **scale path**, and fine-tune (SPEC-R12) an **export**; the LLD picks the default wiring and the retrieval relevance method (e.g. TF-IDF vs embedding). Closes PRD-D1.
- **Protocol-version target** — *Resolved 2026-06-26:* default target is **A2UI v1.0** (PRD Constraint C1). Records still pin a version (SPEC-R9), so a mixed v0.9/v1.0 corpus is legal and the repair loop (SPEC-R13) migrates across versions; only the *default* pin for new records is v1.0.
- **Contamination mechanism** — encryption-at-rest (Transcrypt-style) vs private split is an LLD choice (SPEC-R4 fixes the behavior, not the mechanism).

## 8. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R9, R13, R16 | PRD-G6 (coherence) + PRD-G5 |
| SPEC-R2, R5, R6, R7, R10, R11, R12, R15 | PRD-G5 (flagship) · PRD-D1 |
| SPEC-R3, R4 | PRD-G5 (honest measurement) |
| SPEC-R8, R14 | PRD-G4 (provable validity) + PRD-G5 |
| SPEC-R11 | PRD-G7 (MCP transport) |

_No requirement here is orphaned; coverage of PRD-G5/PRD-D1 is complete. PRD-G1/G2/G3 are covered by sibling SPECs (see [`../README.md`](../README.md))._
