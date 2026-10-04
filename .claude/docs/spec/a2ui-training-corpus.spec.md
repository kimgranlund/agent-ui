# SPEC — A2UI Training Corpus

> Status: proposed · v0.6 · 2026-10-04 (v0.1 2026-06-26) · Layer: SPEC (execution contract)
> **v0.2 (2026-07-03, corpus-store intake):** two phasing notes added — SPEC-R8 (the tier-2 judge is an injected seam, phase 1 runs tier-1-only; admission-time healing marks `status:"repaired"` — ADR-0060/0061, proposed) and SPEC-R4 (eval-facet admission fail-closes until the contamination mechanism exists — ADR-0060). No requirement's contract changed.
> **v0.3 (2026-07-03, s1-build discrepancy repair):** the §5.1 schema block contradicted SPEC-R2 AC2 — `description` sat in the top-level `required` array, and under strict draft-07 semantics (top-level `required` ANDs with every `allOf` branch) the eval `anyOf(target, description)` carve-out was unreachable, making R2 AC2's own fixture untriggerable. Repaired in R2 AC2's favor (the resolution the s1 build shipped, `src/corpus/record.ts`): `description` moved out of the top-level `required` into the facet conditionals; upstream-interop caveat logged in §7. **Reversed at v0.4.**
> **v0.4 (2026-07-03, ADR-0063 proposed — the §7 caveat fired):** the host fetched the authoritative upstream (`google/A2UI@main` `eval/datasets/dataset_schema.json`); verbatim: `"required": ["name", "description", "promptText"]` (unconditional `description`); `target` "If omitted, defaults to the value of `description`" (NO missing-target failure mode); items set `additionalProperties:false` (only the 7 upstream fields survive projection — `a2uiOutput` is not among them); the dataset file is one JSON **array**, not JSONL. Per Constraint C1 the v0.3 carve-out is **reversed**: `description` unconditionally required (§5.1/R1); `target` optional with the explicit fallback semantic (R2); **`E_NO_TARGET` retired** from §5.3 (unreachable by construction); R1 AC1's interop check is a PROJECTION onto the upstream field set; the array-form fact noted at R16. §7's open item is resolved.
> **v0.5 (2026-07-03, ADR-0064 proposed — the s6 multi-surface ruling):** a v1 corpus record is **single-surface** — SPEC-R2 gains the clause (exemplar `a2uiOutput` addresses exactly ONE surface; surfaceless `callFunction` excluded from the count) + AC3. Grounded in the s6 trace: the shared validator judges per surface but the canonicalizer folds globally, so a multi-surface record would pass tier-1 and silently chimera before hashing. Corpus-only; wire/renderer multi-surface stays legal; widening trigger named in the ADR.
> **v0.6 (2026-10-04, ADR-0231 accepted, GH #1739 the facet build slice):** the corpus gains two model-visible facets, `multi-turn` (one client `action` in, the follow-up stream out, beside the turn-1 stream it answers) and `repair` (a broken stream, the shared validator's recomputed verdict on it, the corrected stream). §2's facet table gains the two rows and the model-visible/held-out class; SPEC-R2 gains the facet-conditional branches (+ AC4/AC5); SPEC-R3's leak invariant reads over the model-visible class; SPEC-R11 gains the opt-in `facet` filter (default `exemplar`); SPEC-R9 gains AC3 (the never-healed `priorOutput`/`invalidInput` pin an absent `version`, `E_PIN`); §5.1 widens the `facet` enum, adds the four top-level fields and the two new `allOf` conditionals, and gives every facet conditional a `not.anyOf` excluding the other facets' branch fields; R1 AC1's projection drops the four new fields too. The exemplar and eval contracts are unchanged.
> Refines: [`../a2ui-expert-system.prd.md`](../prd/a2ui-expert-system.prd.md) — primarily **PRD-G5** (flagship) and **PRD-D1**; supports PRD-G4, PRD-G6, PRD-G7.
> Refined by: [`../lld/a2ui-corpus-store.lld.md`](../lld/a2ui-corpus-store.lld.md) (storage, dedup algorithm, MCP wiring) and the harness LLDs (gates).
> Altitude: this document owns the corpus **behavior + data/schema contract**. Storage substrate, indexing internals, and file layout are deferred to the LLD. Requirements reference PRD goal IDs; they do not restate them.

---

## 1. Purpose

Define the behavior and contracts of the **training corpus** that conditions A2UI generation and measures it. The corpus is the artifact that turns "an agent can emit A2UI" into "an agent reliably emits valid, idiomatic A2UI" (PRD-G5), and the substrate the deterministic gates (PRD-G4) and coherence loop (PRD-G6) act on.

The design is grounded in — and interoperable with — A2UI's own evaluation framework: the Inspect-AI-based `eval/` harness, its `dataset_schema.json` (fields `name` · `description` · `promptText` · `target` · `catalog` · `role_description` · `workflow_description`), hybrid scoring (`A2uiValidator` + LLM-as-a-judge), `parse_response`/`payload_fixer` healing, and runtime/eval validation parity. These are external A2UI facts (Constraint **C1**); this SPEC conforms to them rather than redefining them.

## 2. Key concept: two sub-corpora

The single most load-bearing decision in this SPEC. A2UI's eval framework encrypts its eval datasets at rest precisely because public "gold" answers get ingested by training crawlers and inflate scores (data contamination). The corpus therefore has **two classes of facet that must never be conflated**: the **model-visible** class (conditioning material) and the **held-out** class (measurement). ADR-0231 cl.1 added two model-visible facets beside the exemplar; every contamination rule below reads over the class, never over one facet name:

| Facet (`meta.facet`) | Class | Purpose | Visibility | Carries |
|---|---|---|---|---|
| **Exemplar** (`exemplar`) | model-visible | *Condition* generation: few-shot, retrieval, fine-tune | Public / model-visible by design | prompt + **ground-truth A2UI output** |
| **Multi-turn** (`multi-turn`, ADR-0231 cl.2) | model-visible | *Condition* the round-trip: a client `action` answered on the live surface | Public / model-visible by design | prompt + the turn-1 stream (`priorOutput`) + the one client `action` (`clientInput`) + the **follow-up stream** (`a2uiOutput`) |
| **Repair** (`repair`, ADR-0231 cl.3) | model-visible | *Condition* self-correction: a broken stream, the validator's verdict, the fix | Public / model-visible by design | prompt + the broken stream (`invalidInput`) + the shared validator's verdict on it (`validatorErrors`) + the **corrected stream** (`a2uiOutput`) |
| **Eval** (`eval`) | held-out | *Measure* generation: held-out scoring | Held-out / contamination-protected | prompt + **judge `target`**, no model-visible gold in the open |

The no-leak invariant between the two classes (SPEC-R3) is what keeps the measurement honest. *Name collision, recorded (ADR-0231):* `meta.facet: "repair"` (the record teaches a repair) and `meta.status: "repaired"` (admission healed the text, ADR-0061) are orthogonal axes that share a stem; a record may legally carry both.

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
- **AC1** *Given* any record of any facet, *when* validated against the corpus record schema (§5), *then* it conforms, and **projecting it onto the upstream field set** (dropping `meta`, `a2uiOutput`, and the ADR-0231 facet fields `priorOutput`, `clientInput`, `invalidInput`, `validatorErrors`, wherever present, since upstream sets `additionalProperties:false`) yields an object that validates against A2UI's upstream `dataset_schema.json` for its pinned protocol version; a projected record of any facet carries only the 7 upstream fields *(projection semantics: ADR-0063; the four facet fields: ADR-0231 §6)*.
- **AC2** *Given* a record missing any of `name`/`description`/`promptText`, *when* admission runs, *then* it is rejected with error `E_SCHEMA` (upstream requires all three unconditionally — verified, ADR-0063).

**SPEC-R2 — Exemplar records carry ground-truth A2UI output.** A record in the exemplar corpus MUST include a valid `a2uiOutput` (the message stream). A record in the eval corpus MAY include an explicit `target` (judge criteria); when absent, its effective target IS its `description` — the upstream fallback semantic (verified verbatim: "If omitted, defaults to the value of `description`", ADR-0063). The fallback is a **consumer rule**: every judge/scorer MUST read `target ?? description`, never `target` raw. An eval record MUST NOT be required to carry `a2uiOutput`. An exemplar's `a2uiOutput` MUST address **exactly one surface** (ADR-0064): every surface-bearing message (`createSurface`/`updateComponents`/`updateDataModel`/`deleteSurface`/`actionResponse`) carries the same `surfaceId`, and at least one such message exists; surfaceless `callFunction` envelopes are excluded from the count, not banned. *(→ PRD-G5, PRD-D1)*
*Facet-conditional branches (ADR-0231 cl.2/cl.3, v0.6).* A `multi-turn` record MUST carry `priorOutput` (turn 1, the stream that put the surface on screen, self-contained), `clientInput` (v1: exactly one `{ version, action }` envelope whose `action` carries the six required `A2uiAction` fields; any other client envelope kind is a named non-goal) and `a2uiOutput` (the follow-up, with at least one surface-bearing message). A `repair` record MUST carry `invalidInput` (the broken stream, as message objects, never text: text-level breakage is the healer's, ADR-0061), a non-empty `validatorErrors` (`{ code, path }` entries, `code` in the shared validator's `ErrorCode` union) and `a2uiOutput` (the corrected stream). A branch field on a facet that does not own it is a schema failure. The single-surface rule above applies to the union of every stream a record bundles (`priorOutput ⊕ clientInput ⊕ a2uiOutput`, `invalidInput ⊕ a2uiOutput`; the action's `surfaceId` counts as surface-bearing), and the SPEC-R9 pins cover every bundled stream. Each facet's dedup identity (SPEC-R6/R7) extends the canonical form with its facet member: a multi-turn record's is the fold of `priorOutput ⊕ a2uiOutput` plus the action minus its per-session nonces (`actionId`, `timestamp`); a repair record's is the corrected stream's plus the sorted `(code, path)` set. The exemplar and eval branches are unchanged.
- **AC1** *Given* an exemplar record, *when* admitted, *then* `a2uiOutput` is present and passes deterministic validation (SPEC-R8 tier 1).
- **AC2** *Given* an eval record without an explicit `target`, *when* admitted, *then* admission succeeds (no missing-target failure mode exists — `description` is unconditionally required by R1 and is the fallback); *when* scored (SPEC-R14), *then* the judge grades against `description`.
- **AC3** *Given* an exemplar whose `a2uiOutput` addresses two surfaces (each individually tier-1-green), or one addressing none (only `callFunction` envelopes), *when* admission runs, *then* it is rejected with `E_SCHEMA` at the record schema — before canonicalization (ADR-0064).
- **AC4** *Given* a `multi-turn` record, *when* admitted, *then* `priorOutput` passes tier 1 at finalize, `a2uiOutput` passes tier 1 seeded with the prior turn's graph (a `root` resend rejects `E_IDGRAPH` at `<surfaceId>:root`), and the action is grounded: its `sourceComponentId` resolves in the prior fold to a component declaring an action named `action.name`, else `E_IDGRAPH`. A missing branch field, a `clientInput` of length other than 1, or a non-`action` client envelope rejects `E_SCHEMA` (ADR-0231 cl.2).
- **AC5** *Given* a `repair` record, *when* admitted, *then* the shared validator's finalize-mode failures on `invalidInput`, compared as a `(code, path)` set, equal `validatorErrors` (else `E_SCHEMA` at `validatorErrors`), and `a2uiOutput` takes the full exemplar path (tier 1, pointer resolution, dedup, judge). An empty `validatorErrors`, or an entry whose `code` is outside `ErrorCode`, rejects `E_SCHEMA` (ADR-0231 cl.3).

### 4.2 Sub-corpora & contamination protection

**SPEC-R3 — Two sub-corpora with a no-leak invariant.** The system MUST maintain the exemplar and eval sub-corpora as distinct sets. No eval-corpus `promptText` (or a near-duplicate of it, by the SPEC-R7 similarity measure) MAY appear in the exemplar corpus. *(→ PRD-G5)*
*Model-visible class (ADR-0231 cl.1, v0.6).* In this requirement and its ACs, "the exemplar corpus" reads as the model-visible class (`exemplar`, `multi-turn`, `repair`) and "the eval corpus" as the held-out class (`eval`): a candidate of any model-visible facet whose `promptText` collides with an eval prompt rejects `E_LEAK`. The SPEC-R4 fail-closed gate still matches `facet === "eval"` exactly.
- **AC1** *Given* the two sub-corpora, *when* the leak gate runs, *then* it reports 0 eval prompts whose similarity to any exemplar prompt exceeds the dedup threshold (SPEC-R7); a nonzero count fails CI with `E_LEAK`.
- **AC2** *Given* a candidate exemplar whose prompt collides with an eval prompt, *when* admission runs, *then* it is rejected with `E_LEAK`.

**SPEC-R4 — Eval corpus is contamination-protected at rest.** The eval corpus MUST be stored such that its model-gradeable content is not exposed in plaintext to public crawlers (e.g. encryption-at-rest with transparent local decrypt for authorized contributors, or a private split). The chosen mechanism is an LLD decision; the *behavior* — "public clone does not reveal eval gold" — is normative here. *Fail-closed phasing (ADR-0060, proposed):* until the protection mechanism exists (corpus LLD-C8), admission REFUSES every `facet:"eval"` candidate (`E_LEAK`) — this requirement holds vacuously, never by exception. *(→ PRD-G5)*
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

**SPEC-R8 — Two-tier admission quality gate.** A candidate is admitted only if it passes **both**: (tier 1, deterministic) the A2UI validation parity check — schema, catalog-conformance (every component/property exists in the pinned catalog), single-`root` + acyclic ID graph, and valid JSON-Pointer bindings; and (tier 2, judgment) the corpus-quality rubric ≥ its gate bar. Healing (`payload_fixer`-parity) MAY be applied before tier 1 and, if it changes the record, the healed form is what is admitted — and the record is marked `status:"repaired"` (ADR-0061). *Phasing (ADR-0060, proposed):* tier 2 binds whenever a judge is wired into admission's injected seam; until the harness wave lands the corpus-quality rubric there is no judge — the stage is skipped and an absent `qualityScore` is the queryable marker of an unjudged record. *(→ PRD-G4, PRD-G5)*
- **AC1** *Given* a candidate that fails any tier-1 check, *when* admission runs, *then* it is rejected with the specific code (`E_SCHEMA`, `E_CATALOG`, `E_IDGRAPH`, or `E_POINTER`) and is not admitted.
- **AC2** *Given* a candidate that passes tier 1 but scores below the corpus-quality rubric gate, *when* admission runs, *then* it is rejected with `E_QUALITY` and the failing dimensions are reported.
- **AC3** *Given* the same candidate, *when* tier-1 validation runs in admission and at generation runtime, *then* both use the same validator and return the same verdict (runtime/eval parity) — **both judging at COMPLETE-SET granularity** (REV 2026-08-13 — see below).

> **REV 2026-08-13 (ADR-0187, GH #829) — admission judges at FINALIZE granularity. A granularity statement
> the parity claim always implied; one implementation, unchanged.** A `CorpusRecord.a2uiOutput` is a COMPLETE
> set by construction — the whole authored stream for one task, with nothing still arriving — and the
> renderer LLD §8's parity prose already said so. The shared validator now takes an optional caller
> assertion to that effect (a2ui-runtime SPEC-R11's REV of the same date), and admission passes it. Tier-1's
> enumerated checks (schema, catalog-conformance, single-`root` + acyclic id graph, pointer syntax) are
> unchanged; what changes is that the id-graph check is no longer waived for a surface a record DECLARES but
> never delivers components for. Such a record is now rejected `E_IDGRAPH` rather than admitted as an
> exemplar that teaches a model to ship a blank card (GH #802's defect, in training data).
>
> AC3's parity is preserved and sharpened: admission and the RUNTIME's per-round verdict (a2ui-live-agent
> SPEC-R5's REV of the same date) both judge complete sets, so they agree — which is the case this criterion
> was always about. It does NOT require agreement with a caller judging a mid-stream PREFIX; that caller is
> answering a different question and keeps the streaming-tolerant default (a2ui-message-lifecycle SPEC-R4
> AC1's REV of the same date).
>
> **Blast radius, measured not assumed:** the committed 29-record exemplar shard re-admits 29/29 through the
> real `admit()` pipeline, and the standing shard gate now re-checks tier-1 at admission's own granularity so
> the two cannot drift. One structural fact makes this narrow: ADR-0064's single-surface rule already rejects
> a multi-surface record before tier-1 runs, so the only reachable shape here is a single-surface record with
> no components at all.

**SPEC-R9 — Version pinning.** Every record MUST pin the A2UI `protocolVersion` and the `catalogId`(+version) it targets. *(→ PRD-G6)*
- **AC1** *Given* any admitted record, *when* inspected, *then* `protocolVersion` and `catalogId` are present and non-empty.
- **AC2** *Given* a record whose `a2uiOutput` references a catalog/version it does not pin, *when* admission runs, *then* it is rejected with `E_PIN`.
- **AC3** *Given* a `multi-turn` or `repair` record, *when* admission runs, *then* every message of the server streams admission never heals (`priorOutput`, `invalidInput`; ADR-0231 cl.4) carries a `version` equal to `protocolVersion`, and an absent, non-string or different one is rejected with `E_PIN` at `<stream>[i].version`. Filling an absent `version` is the healer's arm (d) (ADR-0061), so a repair pair built around that breakage is a named non-goal (ADR-0231 cl.3/cl.7). `a2uiOutput` is healed first, so AC2's mismatch rule is the whole check there.

### 4.4 Consumption

**SPEC-R10 — Export as A2UI catalog examples (static few-shot).** The exemplar corpus MUST be exportable into the form A2UI's `A2uiSchemaManager.generate_system_prompt(include_examples=True)` consumes (named, version-scoped example templates bound to a catalog), filterable by `catalogId` and `protocolVersion`. *(→ PRD-G5, PRD-D1)*
- **AC1** *Given* a `catalogId` + `protocolVersion`, *when* export runs, *then* it emits a catalog-examples artifact whose entries all pin that catalog/version and pass tier-1 validation.
- **AC2** *Given* the exported artifact, *when* loaded by an A2UI schema manager, *then* it is accepted without modification (interop check).

**SPEC-R11 — Dynamic retrieval (top-k by intent).** The system MUST expose retrieval of the top-`k` exemplars most relevant to a query intent, returning records (prompt + `a2uiOutput`) ranked by a relevance score, scoped to a `catalogId`/`protocolVersion`. Retrieval SHOULD be exposable over MCP (self-hosted or CLI) for a generating agent. *(→ PRD-G5, PRD-D1, PRD-G7)*
*Facet filter (ADR-0231 cl.4, v0.6).* Retrieval takes an optional `facet`, any model-visible facet, whose default is `exemplar`, so a caller that names none gets exactly the exemplar scope above. The SPEC-R10 and SPEC-R12 exports stay exemplar-only; a facet-specific export shape lands by amendment when a consumer names it.
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

**SPEC-R16 — Eval-harness interoperability.** The eval corpus MUST be runnable by A2UI's upstream Inspect-AI eval harness without transformation beyond decryption — i.e. it conforms to `dataset_schema.json` for its pinned version. *Verified upstream form (ADR-0063):* an upstream dataset file is one JSON **array** of samples (the schema's top level is `"type": "array"`), not JSONL — the decrypted slice MUST reach the harness in that array form; whether the at-rest `.enc` is the array itself or JSONL plus an assembler is the LLD-C8/C12 wave's mechanism call, and the projection of R1 AC1 (drop `meta`; eval records carry no `a2uiOutput`) applies. *(→ PRD-G5, PRD-G6)*
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
  // `description` is unconditionally required — the VERIFIED upstream rule (ADR-0063; the v0.3
  // eval/target carve-out was falsified by the fetched dataset_schema.json and is reversed).
  "required": ["name", "description", "promptText", "meta"],
  "additionalProperties": false,
  "properties": {
    // ── A2UI dataset_schema.json superset (SPEC-R1) ──
    "name":                 { "type": "string" },          // unique id
    "description":          { "type": "string" },
    "promptText":           { "type": "string" },          // user input to the LLM
    "target":               { "type": "string" },          // judge criteria; if omitted, defaults to `description` (upstream semantic, verified — a CONSUMER rule, R2)
    "catalog":              { "type": "string" },          // catalog file path / id
    "role_description":     { "type": "string" },          // generate_system_prompt() param
    "workflow_description": { "type": "string" },          // generate_system_prompt() param
    // ── model-visible facets (SPEC-R2): the record's output, one field for every consumer ──
    "a2uiOutput":           { "type": "array", "items": { "type": "object" } }, // ordered A2UI message stream (exemplar: ground truth; multi-turn: the follow-up; repair: the corrected stream)
    // ── multi-turn facet (SPEC-R2, ADR-0231 cl.2) ──
    "priorOutput":          { "type": "array", "items": { "type": "object" } }, // turn 1, the stream that put the surface on screen; never healed, so an absent version is E_PIN, not E_SCHEMA (SPEC-R9 AC3)
    "clientInput":          { "type": "array", "minItems": 1, "maxItems": 1,    // v1: exactly one client envelope, an action
                              "items": { "type": "object", "required": ["version", "action"] } },
    // ── repair facet (SPEC-R2, ADR-0231 cl.3) ──
    "invalidInput":         { "type": "array", "items": { "type": "object" } }, // the broken stream (message objects, never text); never healed, so an absent version is E_PIN, not E_SCHEMA (SPEC-R9 AC3)
    "validatorErrors":      { "type": "array", "minItems": 1,                    // the shared validator's verdict, recomputed at admission
                              "items": { "type": "object", "required": ["code", "path"],
                                         "properties": { "code": { "enum": ["PARSE", "SCHEMA", "CATALOG", "CATALOG_UNKNOWN", "IDGRAPH",
                                                                           "POINTER", "VERSION_UNSUPPORTED", "FUNCTION", "DEPTH_EXCEEDED", "CONTAINMENT"] },
                                                         "path": { "type": "string" } } } },
    // ── curation metadata (SPEC-R5/R6/R7/R9/R13) ──
    "meta": {
      "type": "object",
      "required": ["facet", "protocolVersion", "catalogId", "provenance", "status"],
      "additionalProperties": false,
      "properties": {
        "facet":           { "enum": ["exemplar", "eval", "multi-turn", "repair"] }, // SPEC-R3; model-visible: all but eval (ADR-0231 cl.1)
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
      "then": { "required": ["a2uiOutput"],                               // SPEC-R2
                "not": { "anyOf": [{ "required": ["priorOutput"] }, { "required": ["clientInput"] },
                                   { "required": ["invalidInput"] }, { "required": ["validatorErrors"] }] } } },
    { "if": { "properties": { "meta": { "properties": { "facet": { "const": "multi-turn" } } } } },
      "then": { "required": ["priorOutput", "clientInput", "a2uiOutput"], // SPEC-R2 AC4, ADR-0231 cl.2
                "not": { "anyOf": [{ "required": ["invalidInput"] }, { "required": ["validatorErrors"] }] } } },
    { "if": { "properties": { "meta": { "properties": { "facet": { "const": "repair" } } } } },
      "then": { "required": ["invalidInput", "validatorErrors", "a2uiOutput"], // SPEC-R2 AC5, ADR-0231 cl.3
                "not": { "anyOf": [{ "required": ["priorOutput"] }, { "required": ["clientInput"] }] } } },
    { "if": { "properties": { "meta": { "properties": { "facet": { "const": "eval" } } } } },
      "then": { "not": { "anyOf": [{ "required": ["priorOutput"] }, { "required": ["clientInput"] },
                                   { "required": ["invalidInput"] }, { "required": ["validatorErrors"] }] } } },
    // Each `not.anyOf` is the branch-field exclusion: a field owned by another facet rejects at that
    // field (`validateRecord`, E_SCHEMA at the key, the closed-schema behavior the exemplar and eval
    // branches had before the fields existed). The eval conditional carries only that exclusion:
    // `target` is optional with the description-fallback CONSUMER rule (R2, ADR-0063), so there is no
    // missing-target failure mode to encode.
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
                catalogId: string; protocolVersion: string;
                facet?: 'exemplar' | 'multi-turn' | 'repair' }): CorpusRecord[]; // SPEC-R11 (facet default exemplar, ADR-0231)
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
| **SPEC-N1** | Validation parity | Tier-1 admission validation and runtime generation validation use one implementation; a parity test asserts identical verdicts on a shared fixture set (0 disagreements). *(→ PRD-G4)* *(REV 2026-08-13, ADR-0187/GH #829: still ONE implementation. It now takes an optional caller assertion that a payload is COMPLETE, and BOTH parties to this parity — admission and the runtime's per-round verdict — pass it, since both judge complete sets. A caller judging a mid-stream prefix is answering a different question and is outside this parity claim. See SPEC-R8 AC3's REV of the same date; the harness `validate-payload` instrument opts in too, so the pre-check an author runs cannot disagree with the pipeline that follows it.)* |
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
- **Upstream `required` list for `description`** — *Resolved 2026-07-03 (ADR-0063):* the host fetched `google/A2UI@main` `eval/datasets/dataset_schema.json` — `description` IS unconditionally required upstream, `target` defaults to `description`, items are `additionalProperties:false`, and the dataset file is one JSON array. The predicted THEN-branch fired; the v0.3 carve-out was reversed at v0.4 and `E_NO_TARGET` retired.

## 8. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R9, R13, R16 | PRD-G6 (coherence) + PRD-G5 |
| SPEC-R2, R5, R6, R7, R10, R11, R12, R15 | PRD-G5 (flagship) · PRD-D1 |
| SPEC-R3, R4 | PRD-G5 (honest measurement) |
| SPEC-R8, R14 | PRD-G4 (provable validity) + PRD-G5 |
| SPEC-R11 | PRD-G7 (MCP transport) |

_No requirement here is orphaned; coverage of PRD-G5/PRD-D1 is complete. PRD-G1/G2/G3 are covered by sibling SPECs (the original charter table is [archived](../archive/a2ui-expert-system/README.md), frozen 2026-07-08)._
