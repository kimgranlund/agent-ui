# ADR-0206 — `target` becomes the meta-line envelope's SIXTH additive model-authored arm (GH #1259): the model names, on the leading meta-line, the `surfaceId` it is about to mutate this turn — the ONE truthful early signal under validate-then-stream — retiring the #1134/PR #1138 sole-open-surface `working` heuristic in favor of it

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planner seat, from Kim's ruling on GH [#1259](https://github.com/kimgranlund/agent-ui/issues/1259)
>   (2026-08-18) — option (c) of the issue's own four-way fork |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build (not authored here): `packages/agent-ui/a2ui/src/agent/prompts/`
>   (one grammar clause teaching the arm — a turn that is about to mutate a known surface names its
>   `surfaceId` on the leading meta-line; a turn creating a fresh surface, or emitting no A2UI at all,
>   omits the arm) · `packages/agent-ui/a2ui/src/agent/meta-line.ts` (`A2uiMetaEnvelope` gains
>   `target?: { surfaceId: string }`, `readMetaLine` widens with the whole-arm shallow guard — the ONE
>   reader, never a second parse path) · `packages/agent-ui/a2ui/src/agent/produce.ts` (`formatMetaLine`
>   widens with the arm; the peel call site gains the `target` destructure, the `team`-arm precedent
>   exactly) · `packages/agent-ui/app/src/controls/conversation/conversation.ts` `beginAgentTurn`
>   (~L793–816) — the GH #1134/PR #1138 sole-open-surface heuristic is RETIRED and replaced: when the
>   leading meta-line carries `target.surfaceId` naming a currently-open registry entry, set `working`
>   on THAT host at turn start and register its id in `touchedIds` (the SAME `intoSurface` code shape,
>   cl.2); when `target` is absent, no early breathe — the pre-#1134 late-but-never-wrong fallback (the
>   line-burst `working` set stays exactly as it is today, unchanged) · the `a2ui-live-agent` SPEC's
>   reserved-field table (a sixth row) · GH #1259's own dated Finding + close-out |
> | **Supersedes / Superseded by** | **Extends** [ADR-0088](./0088-a2ui-live-conversational-channel.md)
>   (the `a2uiMeta` envelope gains a sixth additive field; nothing existing is touched) ·
>   **Extends** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) / [ADR-0174](./0174-planner-stage-pilot-sequential-opt-in-loop.md) /
>   [ADR-0178](./0178-agent-authoring-conversational-persona-hydration.md) / [ADR-0198](./0198-ask-flow-completion-flowend-meta-signal.md) /
>   [ADR-0204](./0204-team-meta-line-arm.md) (the `ask → plan → personaPatch → flowEnd → team → target`
>   arm lineage — `target` is the sixth, whole-arm-validated + gate-blind-peeled the same way every
>   predecessor is) · **Relates** [ADR-0199](./0199-working-state-live-surface-mutation.md) (the
>   `working`/`:state(working)` fleet state this arm feeds — the semantic stays exactly what ADR-0199
>   ratified; only the TRIGGER for setting it early changes) · **Supersedes the GH #1134/PR #1138
>   heuristic** (`conversation.ts`'s sole-open-surface guess at `beginAgentTurn` — replaced, not kept
>   alongside, per clause 4) · **Relates** GH [#1259](https://github.com/kimgranlund/agent-ui/issues/1259)
>   (the filed bug this ADR resolves the design fork of) · **Relates** GH #802 (the ask-answer
>   `disabledSurfaceId` exclusion — untouched by this ADR, clause 4) |

## Context

[ADR-0199](./0199-working-state-live-surface-mutation.md) shipped the fleet's `working`/
`:state(working)` state: a card mid-mutation breathes; a card the current turn does not touch stays
inert (ADR-0199's own "honesty rule" — the visual twin of the ADR-0191/0196 correctness guards). The
mechanism that decides WHICH host to set `working` on at turn start is `beginAgentTurn`
(`packages/agent-ui/app/src/controls/conversation/conversation.ts` ~L793–816). Under a real live
transport, `produce()` is **validate-then-stream**: the model's reply is fully validated before any
content line is yielded, so every `routeLine` call for a real turn lands in one synchronous burst
microseconds before `finalize()`. The ONE thing that arrives BEFORE that burst is the leading
meta-line itself — `note`/`ask`/`plan`/`personaPatch`/`flowEnd`/`team` are all already proven to ride
it precisely because it is the earliest truthful signal available (ADR-0088 §1's whole design
rationale). Before GH #1134, `working` was set only at the first routed line — on the real timing,
that gave the card a ~0ms breathe window on exactly the turns Kim was watching for it (GH #1104's own
motivating report).

**GH #1134/PR #1138's heuristic, and its now-demonstrated wrong-guess branch.** GH #1134 (ruled
2026-08-17, merged in PR #1138) closed that ~0ms gap with an OPTIMISTIC GUESS: when a typed turn
carries no `intoSurface` (not resuming a known target) and no `disabledSurfaceId` (not an ask-answer
turn, GH #802's exclusion), and EXACTLY ONE surface is open in the registry, set `working` on that
sole surface at turn start — "the typed intent is near-certainly about it." The ruling explicitly
excluded multi-surface chats (2+ open ⇒ no heuristic, breathe stays line-burst-only) as the accepted
wrong-guess risk, but did not weigh the SINGLE-surface wrong guess: a user with exactly one open card
who asks something entirely unrelated ("got any room pics?" while a weather card is the sole open
surface). GH #1259's live repro (Kim's screenshot, Image #57) proves this branch fires in the common
case — a one-card chat is the ordinary state, not an edge case — and the card breathes for the WHOLE
turn even though the reply never touches it (text-only, or targets a fresh surface). Under
validate-then-stream, no in-turn correction is possible once a guess is made: the guess is right or
wrong for the entire turn, because the true target is not knowable until the same late burst the
heuristic was invented to get ahead of.

**The four-way fork, and Kim's ruling.** GH #1259's Classification named four options: (a) revert
#1134 (typed turns breathe only from the line burst — the pre-#1134 gap returns for genuinely-targeted
turns); (b) keep #1134, accept the false positive; (c) get an EARLY target signal from the producer — a
pre-validation "targets surface X / new surface / text-only" hint on the wire, ADR-worthy; (d) a
narrower heuristic (content-reference matching, or a time-window near the card's mint). **Kim ruled
(c), 2026-08-18**: a meta-line `target` arm — the model names, on the leading meta-line, the
`surfaceId` it is about to mutate this turn (or omits the arm) — because the meta-line is, structurally,
the ONE line that arrives before the content burst; it is exactly the seam ADR-0088 built for this
class of early, model-known routing fact, and every one of its five prior arms (ask/plan/personaPatch/
flowEnd/team) already proves the pattern. (d) is implicitly rejected by the ruling: a heuristic, however
narrower, is still a GUESS about a fact the model already knows and could simply state; only (c) makes
the signal TRUTHFUL rather than merely less-often-wrong.

## Decision

**We will add `target?: { surfaceId: string }` as the meta-line envelope's sixth additive
MODEL-authored field, whole-arm-validated and gate-blind-peeled the same way every predecessor arm is,
and retire the GH #1134/PR #1138 sole-open-surface heuristic in favor of it — `ui-conversation` sets
`working` from the STATED target when present, and falls back to the late-but-never-wrong line-burst
set when absent.** Realized in five clauses.

1. **The wire shape.** `{"a2uiMeta":{"note":"...","target":{"surfaceId":"ask-1"}}}` — a single-field
   object, deliberately not a bare string, matching the `ask`/`plan.steps[]` object-wrapping precedent
   (room to widen additively later, e.g. a future `"reason"` field, without a breaking shape change).
   `surfaceId` names an EXISTING surface the turn is about to mutate — never a fresh surface about to
   be created (clause 3 names the omission rule for that case) — echoing exactly the semantic
   `opts.intoSurface` already carries host-side for the action-click resume case (`conversation.ts`'s
   own TKT-0079 code path), just now MODEL-STATED instead of caller-supplied.
2. **Whole-arm shallow validation, the `plan`/`personaPatch`/`team` posture exactly.** `target` is
   shallow-validated the same per-field-independent way every arm is (a malformed `target` drops only
   `target`, never the whole envelope — every sibling field on the same line still parses normally),
   and the arm itself validates as a whole: a non-object arm, or a missing/non-string `surfaceId`,
   drops the ENTIRE arm — never a `target` with a garbage id passed through hopefully. This is the
   identical law `team`'s own whole-arm guard applies (ADR-0204 clause 2), for the identical reason: a
   malformed routing fact is worse than no routing fact, because a wrong-but-present target would
   otherwise breathe the WRONG card with full apparent authority.
3. **The model OMITS the arm on a fresh-surface or no-A2UI turn — never emits a placeholder.** A turn
   that creates a new surface (no existing `surfaceId` to name yet) or emits no A2UI at all (a
   text-only reply) carries no `target` field. This is taught as the arm's own usage rule (clause 4's
   grammar clause), not inferred by the reader — the reader has no way to distinguish "the model
   forgot" from "there is genuinely nothing to name," so the CONSUMER SIDE (clause 4) must already
   treat absence as a neutral no-signal state regardless of which is true; teaching the model not to
   fabricate a target keeps the signal meaningful when it IS present.
4. **The consumer: `ui-conversation`'s `beginAgentTurn` retires the #1134 heuristic and reads `target`
   instead.** The sole-open-surface guess (the `else if (opts?.disabledSurfaceId === undefined)` branch
   counting open registry entries) is REPLACED — not kept as a fallback alongside the arm — by: when
   the leading meta-line's `target.surfaceId` names an entry in the open-surface registry, set
   `working` on that host at turn start and register its id in `touchedIds`, the exact code shape
   already proven for `opts.intoSurface` (cl.2 of the existing implementation — this arm gives typed
   turns the SAME early-certainty case resumed turns already have). When `target` is absent — the
   arm-omission case (clause 3) OR a model that has not yet adopted the arm — **no early breathe**:
   `working` is set only at the first routed line, the pre-#1134 timing, late but never wrong. The
   `intoSurface`-driven path (action-click resume) and the `disabledSurfaceId`-excluded path
   (ask-answer, GH #802) are BOTH untouched by this ADR — `target` only fills the gap #1134 was
   patching (a typed turn with no caller-supplied target hint).
5. **Gate-blind pass-through in `produce()`, the `plan`/`personaPatch`/`team` terms exactly.**
   `produce.ts` peels `target` on the SAME terms as its five siblings — no integrity check, no
   re-validation, no verification that the named surface actually exists or is actually mutated later
   in the same turn — passed through unchanged in both the peel path and `formatMetaLine`'s writer.
   `produce()` performs no semantic check on a stated target's truthfulness; that is exactly why
   clause 2's whole-arm structural validation (not a content check) is the only guard this layer owns,
   matching every prior arm's posture.

## Non-goals

- **No verification that a stated target is later actually mutated in the same turn.** The arm is a
  ROUTING HINT, not a contract enforced by the wire layer or by `produce()` — a model that states a
  target and then (incorrectly) mutates a different surface, or emits no A2UI at all, degrades to the
  SAME failure class ADR-0199's own honesty guard already accepts: a wrongly-breathing card for one
  turn, no crash, no halt (Consequences, below).
- **No change to `opts.intoSurface`'s existing semantics or code path** (the action-click resume case,
  TKT-0079) — `target` is a NEW source for the same `working`-at-turn-start decision, not a
  replacement for the caller-supplied hint that already exists for a different turn class.
- **No change to the GH #802 `disabledSurfaceId` exclusion** — an ask-answer turn still sets nothing at
  start; its answered card is not being mutated, regardless of whether the model also emits `target`
  on that turn (a model SHOULD NOT emit `target` on an ask-answer turn per clause 3's spirit, but the
  consumer's existing `disabledSurfaceId`-first branching in `beginAgentTurn` means it is moot either
  way — the ask-answer branch is checked before the target-read branch would apply).
- **No new event name, no new validator surface on the A2UI protocol wire.** Exactly like every prior
  arm, `target` rides the meta-line framing convention only — provably NOT an `A2uiServerMessage` (no
  `version` key), peeled before the validator, never entering the corpus path (SPEC-N3 wire purity,
  restated for the sixth time).
- **No target-mismatch error surface, no user-visible warning.** A target naming an unknown or closed
  surface is silently DROPPED at the consumer (clause 4's registry-membership check is itself the
  guard — a stale/wrong id simply never matches an open entry, so no `working` is set and the turn
  degrades to the late-but-never-wrong fallback) — never a halt, never a console error users would see,
  matching the fleet's standing degrade-gracefully law for every meta-line arm.

## Consequences

- **The meta-line's reserved MODEL-authored vocabulary grows to six**
  (`ask · plan · personaPatch · flowEnd · team · target`) — named here so the next envelope audit finds
  a cited decision for all six.
- **The GH #1134 heuristic's wrong-guess risk retires for the class GH #1259 reported** (a typed,
  unrelated question in a one-card chat) — replaced by a truthful signal when the model states one, and
  by the honest pre-#1134 gap (no early breathe, correct-by-omission) when it does not. The multi-
  surface wrong-guess risk #1134 already excluded was never present for `target`-bearing turns in the
  first place (the model names the RIGHT surface regardless of how many are open) — `target` is
  strictly better across every surface-count case, not merely a lateral swap.
- **A model that never adopts the arm sees no regression and no improvement**: every typed turn without
  `target` behaves exactly as it did before GH #1134 shipped (late, correct, no early breathe) — the
  safe degrade floor this repo's meta-line arms are built to guarantee.
- **The byte-pinned prompt texts change** (the grammar clause teaching the arm) — the prompt-pin
  discipline (`prompt-equivalence.baseline.json` re-capture) applies at the build wave, the same
  ADR-0137 obligation every prior grammar-touching arm has carried.
- **Verification is pixel-truth on the real agent-admin/a2ui-live test chat** (the ADR-0199/#1104
  pattern, and GH #1259's own live-repro discipline): the closing acceptance re-runs GH #1259's exact
  repro (a weather card open, an unrelated typed question) and confirms the card stays inert.
- **Stale → re-verify at the build wave:** `conversation.ts`'s `beginAgentTurn` comment block (the
  #1134 rationale comment is removed/replaced, not left stale beside dead code) · the `a2ui-live-agent`
  SPEC's reserved-field table · GH #1259's Finding + close-out.

## Acceptance

This is an **intake** ADR — realized in two stages, the ADR-0198/0204 shape:

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `docs-grammar.test.ts` link sweep) and is indexed in the README. **No code changes, no grammar edit,
  no `meta-line.ts`/`produce.ts`/`conversation.ts` edit.**
- **Build wave (separately dispatched, gated on Kim's ratification):** the grammar clause (clause 3) ·
  the `meta-line.ts` guard + `produce.ts` pass-through (clauses 1, 2, 5) · the `conversation.ts`
  heuristic retirement + `target`-read wiring (clause 4) all land with `npm run check && npm test`
  green, the prompt-pin baseline re-captured, and GH #1259's live repro re-run to confirm the card
  stays inert on an unrelated typed turn.

## Alternatives considered

- **(a) Revert GH #1134 outright, breathe only from the line burst.** Rejected as the sole answer:
  this reopens the ~0ms-breathe gap on genuinely-targeted typed turns (the exact GH #1104 complaint
  #1134 was built to close) — it trades one honest gap for a different honest gap rather than closing
  both. This ADR's clause 4 fallback IS (a), but only as the safe-degrade floor when no `target` arm is
  present, not as the whole answer.
- **(b) Keep GH #1134, accept the false positive.** Rejected: GH #1259 demonstrates the false positive
  is common-case, not edge-case (a one-card chat is the ordinary state), and ADR-0199's own honesty
  rule is the standing law this heuristic violates in exactly the case Kim caught live.
- **(d) A narrower heuristic** (content-reference matching between the user's text and the card's
  title/content, or a time-window near the card's mint). Rejected: still a guess about a fact the model
  already possesses — narrower reduces the wrong-guess RATE but never reaches zero, and content-matching
  heuristics are themselves fragile (a user can reference a card's topic while asking something the
  reply will NOT touch it for, or vice versa) — Kim's ruling explicitly chose the truthful-signal option
  over any refinement of the guess.
- **A bare-string `target` field (`"target": "ask-1"`) instead of an object.** Rejected: every sibling
  arm that could conceivably grow a second field (`ask`, `plan.steps[]`) ships object-wrapped from v1
  for exactly this reason — widening a bare string to an object later is a breaking wire-shape change,
  while widening an object with a second optional field is free; the one-field cost today buys the same
  additive-widening door every other arm already has.
- **A closed enum (`target: "existing" | "fresh" | "none"`) instead of naming the surface id.**
  Rejected: a coarse three-state signal would tell `beginAgentTurn` THAT a mutation is coming without
  saying WHICH host to breathe in a multi-surface chat — exactly the case #1134 excluded and this ADR
  now covers correctly BECAUSE the id is named, not merely a category.
- **Verify the stated target against the eventual mutated surface, and warn or log on mismatch.**
  Rejected (Non-goals): adds a new failure-reporting surface for a presentation-only ambience signal;
  every other arm's gate-blind posture already accepts this class of soft drift (a stale `note`, an
  unexecuted `plan` step) without a verification layer, and `target` earns no exception.
