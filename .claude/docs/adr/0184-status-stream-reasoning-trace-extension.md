# ADR-0184 — agent-reasoning trace (GH #737): EXTEND `ui-status-stream`, never port — nano-ui's `agent-reasoning` maps ~80% onto shipped machinery; the genuine delta lands as three additive opt-ins (note entries · `setPlan` · consumer-supplied receipt summary) in the control's own established fork pattern

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-12 |
> | **Proposed by** | host session (GH [#737](https://github.com/kimgranlund/agent-ui/issues/737)'s design intake — the issue's own Acceptance demands this port-vs-extend ruling before any build) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-12, via the [`ratify ADR-0184` utterance](https://github.com/kimgranlund/agent-ui/pull/744#issuecomment-5262036773) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: shipped WITH this ADR in the same PR — `status-stream.{ts,css,md}` + `timeline-item.{css,md}` + tests + the doc-page specimen. No other record is invalidated: ADR-0146/0153/0159's fork history is what this decision continues, not amends. |
> | **Supersedes / Superseded by** | **Relates** [ADR-0146](./0146-live-turn-lifecycle-progress-channel.md) (F5 grouping = the iteration vehicle; F8 header), [ADR-0153](./0153-status-stream-elapsed-timer-retry-action-planned-glyph.md) (Fork 1 ticking — the elapsed machinery the port would have duplicated), [ADR-0159](./0159-status-stream-receipt-pattern.md) (oneline/receipt — the collapse machinery ditto) · **Resolves** GH #737's design half (the build ships alongside). |

## Context

GH #737 asks for nano-ui's `agent-reasoning` surface in agent-ui (seed: "why can we not more or less
copy" it): a collapsible reasoning trace with a metric header, a PLAN block, interleaved prose
narration, and mono step rows with durations. The issue's own Acceptance makes the intake ruling —
new ported component vs growing `ui-status-stream` — the load-bearing decision, explicitly overriding
the seed's literal "copy".

Read side-by-side at intake (2026-08-12): nano-ui `agent-reasoning.js` (503 lines, plain JS) vs
`ui-status-stream` (951 lines, strict TS). nano-ui's component IS this repo's status-stream species —
it composes `timeline-n size="sm"` rows exactly as this control composes `ui-timeline-item`, and its
collapsible summary row, ticking elapsed + live per-step durations, step statuses with
spinner/check/warning, auto-collapse-after-finish, iteration blocks with sub-timelines, outcome
disclosures, and `finish()`/`fail()` all map 1:1 onto shipped, reviewed machinery (F5 grouping, F6
escalation, F8 header, Fork 1 ticking, wave-B reveals, oneline/receipt, the completion invariant).

## Decision

1. **EXTEND, never port.** No `ui-agent-reasoning` component exists or will. A port would duplicate
   (then diverge) ~80% of a hardened control and put two components on one catalog territory. The
   three genuine deltas land on `ui-status-stream` as additive opt-ins — every existing consumer
   renders byte-identically until it opts in, the same guarantee every prior fork made.
2. **Note entries (nano-ui's "thought"): `StatusEntry.note?: boolean`.** A creation-time flag (the
   `parent` set-once precedent — `update` never flips it): the entry renders as a markerless prose
   narration row. Mechanism: the host stamps `data-note` on the item, and `timeline-item.css` owns the
   styling in its own family file (no dot, no ring, no connector, muted prose ink) — the exact
   `data-last` precedent: the attribute is the host's stamp, the rendering is the item family's own
   contract, and no cross-family CSS reach exists. The note's prose rides the EXISTING `text` field
   (already defined as streamed chain-of-thought text — narration is precisely that), so keyed
   `update(key, { text })` growth, tail-follow, and the role=log announcement discipline all work
   unchanged. A note's neutral `''` status contributes nothing to escalation and is never truncated
   by settle — it is prose, not a step — and note entries are EXCLUDED from the receipt's
   "N steps" count (a narration line is not a step; a keyed side-set tracks them).
3. **Plan block: `setPlan(items: readonly string[])`.** A host-built `[data-part="plan"]` block — a
   code-owned "Plan" kicker (`[data-part="plan-label"]`, the `SOURCE_SUMMARY_LABEL` chrome-discipline
   precedent) over an `<ol data-part="plan-list">` — pinned after the header (when present) and
   before every entry. Idempotent replace: repeated calls mutate the existing `<li>` texts in place
   (the role=log same-node discipline), growing/shrinking the tail; an empty array removes the block.
   Collapsed mode hides it exactly as it hides the entry list. NOT an entry: it has no key, no
   status, and no position in the chronology — nano-ui's own `setPlan` shape.
4. **Consumer-supplied receipt metrics: `finalize({ summary? })` / `fail({ summary? })`.** An
   optional, additive options bag on both settle verbs (bare calls unchanged): a non-empty `summary`
   replaces the computed "N steps · total" receipt meta verbatim — nano-ui's
   `finish('2 iterations · 94/100 · 7s')` shape, e.g. "31 components · 94/100 · 5.4s". Never parsed,
   never recomputed (the F2 closed-vocabulary discipline: model text renders byte-for-byte or not at
   all). The label cell, status glyph, and forced-`error` fail posture are untouched.
5. **Iterations ship NOTHING new.** A group parent (F5) labeled "Attempt 1" with its escalated status
   (F6) and a `description` already IS the iteration header with a sub-timeline; nano-ui's iteration
   summary maps onto the parent entry's own fields. Named here so the gap is ruled closed, not
   overlooked.
6. **Catalog posture unchanged.** `ui-status-stream` stays a consumer-owned imperative streaming host
   (EXCLUSION_ALLOWLIST) — these opt-ins are imperative-API growth, invisible to A2UI by the same
   construction as before.

## Consequences

- Every non-opted-in consumer renders byte-identically: no `note` ⇒ no `data-note` anywhere; no
  `setPlan` call ⇒ no plan DOM; bare `finalize()`/`fail()` ⇒ the computed receipt exactly as shipped.
  All three pinned by tests (the fork pattern's standing negative controls).
- The components family barrel grows by the three opt-ins' real weight — measured at ship time and
  reported against the 54 KB checkpoint, which main ALREADY exceeds (55346 vs 55296 B gz at this
  ADR's writing, the merged #735/#736 wave); the re-base is its own Kim ruling, owed on main
  independently of this build.
- nano-ui's auto-collapse-after-finish is deliberately NOT copied: `receipt` already collapses at
  settle (ADR-0159), and a second, delayed auto-collapse timer would be a redundant mechanism.
