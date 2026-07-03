# ADR-0061 — the ONE shared healer's contract: text-first `heal()` with a CLOSED form-only repair list; healed admission marks `status:"repaired"`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; `heal.ts` shipped to this exact contract [the closed, form-only repair list; the no-laundering negative control proven by composing heal→validate]; independently reviewed GO — the healer could not be made to launder invalidity under adversarial testing.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the corpus-store intake, NEXT item 1) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | `a2ui-corpus-store.lld.md` LLD-C7 §7 + LLD-C5 §6 (edited this change) · corpus SPEC-R8 healing clause + §5.1 `status` reading · `a2ui-streaming-pipeline.lld.md` LLD-C1 §2 (its `heal(trimmed)` sketch binds to this contract when built) |
> | **Supersedes / Superseded by** | Relates the streaming LLD v0.2 reconciliation (which ruled healing OUT of the renderer and INTO this one module) · ADR-0055 (structured seed candidates pass through unchanged) |

## Context

The streaming LLD's v0.2 reconciliation (2026-07-02) excised fabricated "renderer heal.ts" citations and
fixed the ownership: the renderer never heals (its parser fault-isolates a bad line, runtime SPEC-N4);
**the ONE healer is the corpus store's LLD-C7**, shared by admission (corpus SPEC-R8) and the future
streaming codec (streaming SPEC-R1 AC2). But the two designs disagreed on the interface: corpus LLD v0.1
had `heal(out: A2uiOutput) → { healed; changed }` (whole-output, structured), while the streaming codec
sketch calls `heal(trimmed)` per JSONL **line** and needs an ok/fail verdict to emit `PARSE` and continue.
One implementation cannot serve both without a reconciled contract. Separately, the coordinator's heal-scope
fork is live: an over-eager healer would launder invalid payloads into a corpus whose whole point is
provable validity (PRD-G4), and the SPEC leaves "healing MAY be applied" without a boundary. And when
healing does change a record, the closed SPEC §5.1 schema (`additionalProperties:false`) offers nowhere to
note it unless an existing field carries the fact.

## Decision

We will ship `src/corpus/heal.ts` as the single healer with a **text-first, per-line-capable contract**:

```ts
type HealResult =
  | { ok: true; messages: A2uiOutput; changed: boolean; repairs: string[] }
  | { ok: false; reason: 'unparseable' };
function heal(input: string | A2uiOutput, pin?: { protocolVersion: string }): HealResult;
```

1. **The repair list is CLOSED and form-only** (the `parse_response`/`payload_fixer` parity SPEC-R8 names):
   (a) markdown-fence/surrounding-prose stripping to extract the JSON payload; (b) trailing-comma removal;
   (c) single-object→array envelope normalization; (d) a missing per-message `version` filled from the
   caller's pin (deterministically derivable; a *wrong* version still rejects via E_PIN/tier-1). Structured
   `A2uiOutput` input skips the text arms — only (c)/(d) apply, so ADR-0055 seeds pass through
   `changed:false`. **Nothing semantic is ever repaired**: unknown components, malformed pointers, missing
   roots, wrong catalogs flow to tier-1 and reject — the healer must not launder invalidity.
2. **Both callers bind the same function**: admission (corpus LLD-C5) maps `ok:false → E_SCHEMA` and runs
   heal before tier-1; the streaming codec (streaming LLD-C1, when built) calls it per line and maps
   `ok:false → PARSE` + continue. Every repair applied is named in `repairs` (audit).
3. **A healed admission marks the record `status:"repaired"`** — the SPEC §5.1 `status` enum reads as "the
   stored form differs from its source by an automated repair", covering both admission-time healing and
   the SPEC-R13 repair loop; the `repairs` list travels in the `AdmitResult` (the record schema stays
   closed). An unhealed admission stays `status:"valid"`.

The owning docs are repaired in this change (corpus LLD §6/§7; the SPEC-R8 healing clause + §5.1 status
note); the streaming LLD's codec sketch already cites this module and needs no edit.

## Consequences

- **One implementation, two failure vocabularies** — the mapping lives in each caller (admission `E_SCHEMA`,
  codec `PARSE`), keeping the healer itself verdict-neutral and reusable.
- **`repaired` becomes a first-class admission outcome**, queryable (e.g. "how often do LLM outputs need
  form repair" — a free generation-quality metric). Cost: consumers must treat `valid` and `repaired` as
  equally consumable (both passed tier-1 post-heal); only `quarantined` is excluded — the store's `all()`
  encodes that rule once.
- **The closed list will feel too small** the first time a new common LLM defect appears (e.g. smart
  quotes). That is deliberate: widening the list is an append to THIS ADR's clause 1 (a foreseen amendment
  — each addition must argue it is form, not semantics), never an ad-hoc patch in the module.
- **The version-fill arm (d) requires a pin**, so codec callers that lack one simply never fill —
  `pin` is optional and its absence disables (d), nothing else.
- **Stale → re-verify:** corpus LLD §6/§7 · streaming LLD-C1 §2 when the codec builds · the s3 heal fixtures
  + the s6 admission matrix.

## Acceptance

- Each closed-list defect class heals: fenced payload, trailing comma, single-object envelope, missing
  version (with pin) — `ok:true, changed:true`, the repair named in `repairs`.
- A semantically invalid payload (unknown component, bad pointer, two roots) passes through heal
  **unchanged** and rejects at tier-1 with its own code (the no-laundering negative control).
- Non-JSON after fence-stripping → `ok:false`; admission maps it to `E_SCHEMA`.
- A structured ADR-0055 seed heals to `changed:false` and admits `status:"valid"`; a text candidate healed
  by any arm admits `status:"repaired"`.

## Alternatives considered

- **Two healers (admission whole-output + codec per-line)** — rejected: the exact fork the streaming v0.2
  reconciliation just excised; parity (SPEC-R8 AC "healing before tier-1 in admission AND scoring") only
  holds with one implementation.
- **An open-ended "best-effort JSON fixer"** — rejected: heals semantics by accident, launders invalidity
  into the corpus, and makes tier-1 verdicts depend on an unbounded repair surface; the corpus would no
  longer measure what models actually emit.
- **Record repairs in a new `meta.repairs` field** — rejected: breaks the closed SPEC §5.1 schema
  (`additionalProperties:false`) and its upstream `dataset_schema.json` superset alignment (SPEC-R1 AC1);
  the `AdmitResult` + import log carry the audit trail instead.
- **Keep `status:"valid"` for healed admissions** — rejected: hides that the stored form is not what the
  source emitted; `repaired` is the honest state and already in the enum.
