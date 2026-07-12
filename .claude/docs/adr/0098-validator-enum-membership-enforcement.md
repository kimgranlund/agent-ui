# ADR-0098 — validator-level catalog enum-membership enforcement: a non-member literal fails `validateA2ui` and enters the self-correct loop

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored; ratified date set on accept)* |
> | **Proposed by** | planner (design seat — the fleet-wide validation gap confirmed twice by independent reviewers this session; the promotion ADR-0076's Alternatives reserved) |
> | **Ratified by** | Kim — the 2026-07-08 design-records wave (landed `accepted` at first commit, `96a0778`, beside the individually-ratified ADR-0087); this cell back-filled from git evidence at the 2026-07-12 repo-alignment (manifest M2, Kim-ratified) |
> | **Repairs** | on ratification+build: `a2ui-catalog.spec.md` **SPEC-R7** ("every `component` type and property exists and is typed-correct" → "… and is typed-correct, **including membership in a declared `enum` for a literal value**") · `a2ui-catalog.lld.md` **LLD-C6** §6 (the conformance sketch + the failure-table row "type mismatch" → "type **or enum-membership** mismatch") · `src/catalog/conformance.ts` (`matchesSchemaType` — the one-clause addition) + `src/catalog/conformance.test.ts` (membership legs) · `src/live-agent/produce-loop.test.ts` (one self-correct leg: non-member → `CATALOG` fed back → corrected round) · `src/renderer/widget.test.ts` (comment repair only: its non-member fixtures now assert the SECOND line of defense) |
> | **Supersedes / Superseded by** | **Extends ADR-0076** — realizes the promotion its Alternatives explicitly reserved ("a future ADR may promote enforcement into the validator once the corpus is known-clean"); the precondition is now measured true (Context). 0076's render-time gate is NOT superseded — it stays the sole enum authority for **resolved bindings** (which the static validator can never see) and the defense-in-depth for payloads that bypass validation. Relates ADR-0093 (`Calendar.mode` — the instance that raised the stakes) · ADR-0031 (wire error vocab — deliberately untouched) · ADR-0061 (heal = form repair, not semantic rewriting) · ADR-0071 (the derived prompt this record names a follow-up against). *Reciprocal `Extended by ADR-0098` back-link lands on 0076 at ACCEPT time, per the 0088/0089/0090 precedent.* |

## Context

`matchesSchemaType` (`src/catalog/conformance.ts:55-82`, LLD-C6) validates a payload prop against only the
JSON-Schema `type` keyword — the `enum` member list is never read ("enum" appears nowhere in the file). The
default catalog declares **36 enum-typed props across 16 of its 34 components** (`orientation`, `placement`,
`gap`, `variant`, the ADR-0096 `reflow`, `Calendar.mode`, …), so every one of them accepts ANY string at
validation time. The bad value only degrades at render: ADR-0076's resolver gate drops it, and the component's
`enumType` codec snaps an unknown attribute to `values[0]` (`components/src/dom/props.ts:61-70`).

Three facts make this promotion due now, where ADR-0076 correctly deferred it:

1. **The stakes changed class.** `Calendar.mode` (ADR-0093) forks a form control's whole value contract —
   `single` (one `value`) vs `range` (`valueStart`/`valueEnd` pair, two FormData entries). A live model
   emitting `"mode": "weekly"` passes `validateA2ui` clean and silently renders a `single`-mode calendar:
   the form surface differs from what the model believes it composed, with zero feedback. Every prior enum
   was cosmetic under degradation; this one is not.
2. **ADR-0076's stated precondition is now measured true.** A programmatic sweep of everything shipped —
   the corpus exemplar shard (`corpus/exemplar/v1_0/agent-ui.jsonl`, 11 records), all 11 example seeds
   (`src/examples`), and the committed recorded transcript (2 turns) — walked 226 component nodes and
   checked 123 enum-prop literals: **0 violations**. An audit of the 14 validator-path test suites found
   22 enum-literal fixture occurrences, all members. Enforcement rejects nothing that ships today.
3. **Enforcement is productive, not merely strict.** The live loop (`produce.ts:223-232`, SPEC-R4/R6)
   already feeds `validateA2ui`'s structured failures back to the model within the same turn — the ONE
   catalog-disagreement class that never enters that loop is enum violations. Promotion converts silent
   degradation into a self-correcting round-trip; nothing invalid is ever painted (validate-then-stream,
   SPEC-R5).

Authority for exact-match semantics: SPEC-R1 pins a catalog as a JSON-Schema document, and JSON Schema
Validation §6.1.2 defines `enum` as value equality — case-sensitive, no coercion. The component-side codec
agrees: `enumType.from` is an exact `values.includes(attr)` with no normalization.

## Decision

We will enforce the JSON-Schema `enum` keyword in the shared conformance validator. One clause in
`matchesSchemaType` (before the `type` dispatch): a schema object carrying an `enum` array rejects any value
not **strictly equal (`===`, case-sensitive, no coercion)** to a member. Primitive-member equality is the
exact §6.1.2 semantic for the string enums the whole fleet declares; deep-equality object members stay
outside the validator's declared "minimal JSON-Schema" subset (no catalog uses them).

- **Failure shape: the existing plumbing, unchanged.** A violation emits the same `{ code: 'CATALOG',
  path: '<id>.<prop>' }` the unknown-prop and type-mismatch arms already emit. No new `ErrorCode`
  (ADR-0031 wire mapping untouched), no `Failure`-shape change, no `TurnTrace` change — `failureCodes`
  carries `CATALOG` exactly as it does today.
- **Scope: static literals only.** `{path}`/`{call}` bindings keep short-circuiting in `matchesType`
  (ADR-0026) — a resolved binding value remains ADR-0076's render-gate charter, re-checked each tick.
  Measured: **0 of the 36 shipped enum props are `bindable`**, so the shipped catalog's entire enum surface
  is statically gated; a project catalog declaring a bindable enum falls to the render gate.
- **Reach: one implementation, three callers (SPEC-N3 parity).** The live loop self-corrects
  (`CATALOG at cal-1.mode` fed back, the model's own invalid attempt in context); corpus admission now
  rejects a non-member exemplar at the gate — the "corpus known-clean" precondition becomes true **by
  construction**, not by sweep; the renderer withholds a non-conformant payload (placeholder + `CATALOG`)
  instead of silently rendering the `values[0]` snap.

## Consequences

- **The model's mental state and the rendered truth re-converge.** An enum violation becomes a same-turn
  correction instead of a silent default — the whole payoff of SPEC-R4/R6.
- **Severity promotion — the honest cost.** Previously one non-member prop degraded that one prop at
  render; now it fails the payload's validation, and validate-then-stream withholds the WHOLE payload until
  corrected. A self-correct round costs a model round-trip (latency + tokens); a model that cannot correct
  within `maxRounds` halts with "could not compose" where the user previously saw a slightly-wrong surface.
  We accept fail-loud + feedback over a silently-forked form contract.
- **Feedback is code+path only — and enum recovery is HARDER than the sibling type-mismatch class, not
  equivalent.** The fed-back summary reads `CATALOG at cal-1.mode` — no members list — and the ADR-0071
  derived inventory lists prop NAMES only (`system-prompt.ts:217`). A type-mismatch is recoverable unaided
  (the model can re-type its own value); an enum violation needs the LEGAL MEMBER SET, which the feedback
  withholds. For well-exemplified enums (gap/variant/orientation — present throughout the corpus) the model
  recovers from exemplar familiarity; but for an enum whose members appear in NO context surface the model
  sees — `Calendar.mode`'s `["single","range"]` today appears in zero corpus records, zero seeds, and not in
  the inventory — a violation can only be corrected by guessing, and a run of plausible-but-wrong guesses
  ("day", "month", "week") burns `maxRounds` into a `ProduceHalt`. Accepted even so: a visible, bounded
  "could not compose" halt still beats an invisibly forked form contract. **Named follow-up (deliberately
  not this decision, but URGENT for un-exemplified enums):** enrich the derived inventory with enum members,
  updating ADR-0071's drift gate in the same change — trigger on the FIRST observed violation of any enum
  with no exemplar coverage (Calendar.mode is the known instance), not on accumulated non-convergence.
- **Third-party strictness.** A project embedder feeding `validateA2ui` payloads that relied on the silent
  snap gets new rejections. Everything WE ship is measured clean (Context §2).
- **ADR-0076 stands, re-scoped.** Its gate becomes the second line of defense for literals and the ONLY line
  for bound values; `widget.test.ts`'s non-member fixtures stay green and load-bearing (resolver path — the
  validator is not in that call chain), with a comment noting the layering.

## Acceptance

- `conformance.test.ts`: non-member literal → `CATALOG` at `<id>.<prop>`; member → clean; case-mismatch
  (`'Single'` vs `single`) → `CATALOG`; a `{path}` binding on a bindable enum prop (stub catalog) → accepted
  unchanged; a boolean/enum-less schema → unchanged.
- `produce-loop.test.ts`: a stub provider emitting `Calendar mode:"weekly"` then a corrected round →
  round 2 streams; `TurnTrace.failureCodes` carries `CATALOG`.
- N3 parity: corpus admission rejects a non-member exemplar with the identical verdict; the shipped
  11-record shard still admits (0 violations measured pre-change).
- `npm run check && npm test` green; the site playground's recorded backbone renders unchanged (transcript
  swept clean).

## Alternatives considered

- **Keep render-only gating (the ADR-0076 status quo)** — rejected: `Calendar.mode` moved the degradation
  class from cosmetic to form-contract fork, and 0076's own deferral precondition (corpus known-clean) is now
  measured true. The loop exists precisely to make this strictness productive.
- **A distinct error code (`ENUM`)** — rejected: `CATALOG` already means "the payload disagrees with the
  catalog's component/prop contract"; a new code forks ADR-0031's wire mapping and every consumer switch for
  zero routing need — the path already pinpoints the prop.
- **Heal-side auto-snap (rewrite non-members to `values[0]` before validation)** — rejected: heal is FORM
  repair (ADR-0061), not semantic rewriting; silently rewriting the model's chosen value recreates the
  divergence one layer earlier and would poison corpus canonical hashes.
- **`Failure.detail` carrying the members list** — rejected for now: a `Failure`-shape change ripples the
  wire mapping and every consumer; existing code+path density already converges the sibling classes. Revisit
  only if observed enum violations fail to converge within the round budget — the cheaper lever is the
  prompt-inventory follow-up (Consequences).
- **Adopt a full JSON-Schema validator** — rejected: SPEC-N4 (zero runtime deps); the minimal subset plus
  `enum` covers the catalog's actual vocabulary.
