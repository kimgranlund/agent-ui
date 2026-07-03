# ADR-0060 — corpus store phase 1: the tier-2 judge is an injected seam (tier-1-only admission until the harness wave); the eval facet fail-closes until contamination lands

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; the full corpus-store wave [s1–s10] shipped and independently reviewed GO [zero blocker/major]; the injected-judge seam and fail-closed eval facet realized in `admit.ts` exactly as decided; gates check · jsdom 2311 · size 6542/7168 + 22193/22528.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the corpus-store intake, NEXT item 1) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | corpus SPEC-R8 (tier-2 phasing note) · corpus SPEC-R4/N3 (fail-closed reading) · `a2ui-corpus-store.lld.md` LLD-C5 §6 + LLD-C8/C12 deferral rows (edited this change) |
> | **Supersedes / Superseded by** | Relates ADR-0031/0051/0058 (the reserved-arm / on-demand-activation precedent) · ADR-0055 (the seeds this phase admits) |

## Context

The corpus SPEC's admission gate (SPEC-R8) requires a candidate to pass **both** tier 1 (deterministic
validation) and tier 2 (the corpus-quality rubric ≥ its bar). Two of its collaborators do not exist and are
owned by OTHER waves: the **corpus-quality rubric + judge** belong to the expert harness
(`a2ui-expert-harness.spec.md` SPEC-R3; harness LLD-C3 — NEXT item 3, unrealized), and the **contamination
mechanism** for the eval facet (corpus LLD-C8, Transcrypt-style encryption + leak CI) is deferred until the
first eval record exists. Meanwhile the store cannot wait: the seed shelf (ADR-0055, accepted) booked the
seed-import as THIS wave's slice, the streaming codec needs the store's healer, and the harness itself needs
the store's retrieval/export surfaces — building admission after the harness would invert the real
dependency order. Building tier-2 admission now would mean this wave authoring the rubric that grades its
own output (generator = critic, against harness SPEC-R8) or blocking on an unbuilt wave.

## Decision

We will ship the admission pipeline (corpus LLD-C5) in a **phase-1 configuration with two explicit seams**:

1. **The tier-2 judge is dependency-injected** — `admit(candidate, deps: { judge?: Judge })`. When a judge
   is present, tier 2 runs exactly as SPEC-R8 states (`E_QUALITY` below the bar, `meta.qualityScore`
   recorded). When ABSENT — the state of the world until the harness wave lands the corpus-quality rubric —
   the stage is **skipped**, the record admits on tier 1 alone, and the absent `qualityScore` is the honest,
   queryable marker of an unjudged record. The harness wave activates the seam and MAY back-score existing
   records through the same path (the repair/rescore machinery, not a second write path).
2. **The eval facet fail-closes**: `admit` rejects any `facet:"eval"` candidate with `E_LEAK` (detail: the
   contamination mechanism is unbuilt) until corpus LLD-C8 exists. SPEC-R4/N3's "a public clone reveals no
   gold" therefore holds vacuously and honestly — no eval record can enter unprotected storage.

The owning docs are repaired in this change: the corpus LLD §6 pipeline shows both seams; SPEC-R8 gains the
phasing note (tier 2 binds whenever a judge is wired; phase 1 has none); SPEC-R4's behavior is unchanged —
fail-closed is its strictest reading.

## Consequences

- **Phase-1 records are tier-1-clean but unjudged.** Every seed-imported record carries no `qualityScore`;
  consumers that need judged material (the lift runner, fine-tune curation at scale) can filter on the
  marker. The debt is explicit and machine-visible, not hidden.
- **SPEC-R8 AC2 is not falsifiable until the harness wave** — the `E_QUALITY` arm ships as code with an
  injected fake judge in its test matrix (the seam is proven), but no real rubric gates production
  admission yet. Accepted: the alternative was a this-wave rubric no separate seat could yet grade against.
- **No eval corpus exists in phase 1**, so the leak gate runs over an empty eval set (the mechanism ships
  and is tested with planted fixtures; the CI hook waits for LLD-C8). The harness's eval material (NEXT
  item 3) begins as exemplar-plane exports plus its own held-out authoring — see the corpus LLD §11
  handshake.
- **Activation triggers are named**: the judge seam activates on the harness corpus-quality rubric landing;
  the eval facet opens when LLD-C8 lands. Both follow the fleet's reserved-arm discipline (ADR-0031/0051/
  0058 precedent: ship the seam, activate on the first real consumer).
- **Stale → re-verify on activation:** LLD-C5 §6 (judge stage) · the seed shard's unjudged records ·
  harness LLD-C3/C6 wiring.
- *Realization note (2026-07-03, s6 landed — team-lead-accepted):* the shipped seam is
  `admit(candidate, deps: AdmitDeps)` with `AdmitDeps = { catalog: Catalog; store: CorpusStore;
  dedupIndex: DedupIndex; judge?: Judge }` (`admit.ts:52-62`). The Decision's `{ judge?: Judge }` snippet
  was an abbreviation of the seam under decision, not an exclusive signature — tier-1 categorically needs
  the pinned catalog (no defensible default; the caller resolves by `meta.catalogId`), and the store/dedup
  index are the stateful collaborators §6 already names. The judge seam's semantics are exactly as decided.

## Acceptance

- `admit` with an injected fake judge: a below-bar candidate rejects `E_QUALITY` with failing dimensions;
  an above-bar candidate admits with `qualityScore` set.
- `admit` with no judge: the same candidate admits with `qualityScore` absent; nothing else in the verdict
  differs.
- `admit` of any `facet:"eval"` candidate rejects `E_LEAK` with the unbuilt-mechanism detail.
- The corpus SPEC-R8/R4 phasing notes and the LLD §6 pipeline read identically to the shipped behavior.

## Alternatives considered

- **Block the store on the harness wave (build the rubric first)** — rejected: inverts the true dependency
  order (the harness loop consumes the store's retrieve/export/heal surfaces), and the rubric would be
  authored and consumed by the same wave with no independent critic yet.
- **This wave authors a provisional corpus-quality rubric** — rejected: harness SPEC-R3/R7 owns rubric
  authoring (via `rubric-author`, graded, calibrated); a side-door rubric here would fork that contract and
  still lack a separate grading seat.
- **Treat `authored` provenance as satisfying tier 2** (human-reviewed ⇒ quality-passed) — rejected:
  conflates provenance with quality, writes a fake `qualityScore` no judge produced, and silently weakens
  SPEC-R8 instead of visibly phasing it.
- **Admit eval records unencrypted "temporarily"** — rejected outright: violates SPEC-R4/N3 the moment the
  file is committed; contamination cannot be un-published later.
