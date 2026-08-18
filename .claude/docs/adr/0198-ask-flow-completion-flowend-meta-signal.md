# ADR-0198 — ask-flow COMPLETION is wire-visible (GH #1101): a fourth additive meta-line field `flowEnd` marks the closing turn after a flow-final confirm, the producer toolkit teaches the closing prose turn as default behavior, and a SHARED page-chrome affordance module (done · start-over) is consumed by BOTH surfaces — a2ui-live and the agent-admin test chat (the #1065 shared-seam lift)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | dispatched design lane for GH [#1101](https://github.com/kimgranlund/agent-ui/issues/1101) (size:big due-process, Understand+Plan leg) — the issue's own Scope/Open explicitly forks "protocol-visible signal vs prompt+chrome convention" and routes it to a design decision |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-17, via the [`ratify ADR-0198` utterance](https://github.com/kimgranlund/agent-ui/issues/1101#issuecomment-5317476936) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (not authored here): `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` (the mode-invariant "Flow completion" paragraph — byte-pinned prompt, pin tests move with it) · `packages/agent-ui/a2ui/src/agent/meta-line.ts` (`flowEnd` arm, the `ask`/`plan`/`personaPatch` precedent EXACTLY) · the meta-line's owning SPEC rows (`a2ui-live-agent.spec.md` — the reserved-field table gains one row) · `site/lib/` gains the shared flow-chrome module + both page consumers (`site/pages/a2ui-live.ts`, the agent-admin conversation path) |
> | **Supersedes / Superseded by** | **Relates** ADR-0196 (settle/edit-amend — per-CARD settling; this ADR is the adjacent per-FLOW gap its own scope line names) · **Relates** ADR-0088/0097/0174/0178 (the meta-line envelope + its three prior additive MODEL-authored fields — `ask`, `plan`, `personaPatch`; `flowEnd` is the fourth arm of the same precedent) · **Relates** ADR-0187 (atFinalize — the sibling lesson that "is this final?" is a fact only the party holding it can assert; there the call-site, here the MODEL) · **Relates** ADR-0153 (seven-member event vocabulary, deliberately NOT extended) · **Relates** GH #1065 (locus note: settle UX lives in page chrome; agent-admin is the SECOND surface — cl.5 executes the shared-seam lift that note deferred) · **Resolves** GH #1101's design fork |

## Context

Kim's live report (GH #1101, 2026-08-17): in the agent-admin test chat, a multi-step A2UI intake
flow ends in a dead end — after the flow-final Confirm the agent renders the summary card and then
NOTHING: no closing prose turn, no end-of-flow affordance. ADR-0196 solved the adjacent per-CARD
problem (an answered card settles, Edit re-opens) and explicitly did NOT cover flow completion.

The producer toolkit (`packages/agent-ui/a2ui/src/agent/`, ADR-0137) already teaches ask mechanics
mode-invariantly in `prompts/grammar.md` (fresh `ask-<n>` ids, at-most-one-ask-per-turn, acknowledge
the answer and proceed) — but says nothing about what the turn AFTER the last confirm looks like, so
models legitimately stop at "acknowledge and proceed" with nowhere to proceed to.

The issue's open fork: does "the flow is complete" need a wire-visible signal, or can it stay a
prompt+chrome convention? Two prior decisions bound the answer:

- **ADR-0187's lesson**: "a legitimate mid-flow turn" and "the final turn" can be byte-identical;
  the missing fact (*is more coming?*) lives only with the party that holds it. For a stream that
  was the call-site; for a conversation flow it is the MODEL — chrome inference ("no ask in this
  turn following a confirm") cannot distinguish "flow done" from "agent pausing", "agent asking in
  prose", or "agent mid-plan". A heuristic trigger would misfire in both directions, and the
  affordance's acceptance criterion (deterministically present after the flow-final confirm) would
  be unfalsifiable.
- **The meta-line precedent** (ADR-0088 → 0097 `ask` → 0174 `plan` → 0178 `personaPatch`): the
  envelope is the established home for exactly this kind of MODEL-authored routing fact. It is a
  demo-transport FRAMING convention, provably NOT an `A2uiServerMessage` (no `version` key), peeled
  before the validator — so a new field widens ZERO A2UI protocol wire, touches no validator law,
  and never enters the corpus path (SPEC-N3 wire purity).

**Fork decided: wire-visible, on the META-LINE — not on the A2UI protocol payload, and not
prompt-only.** Prompt-only fails because the surface half then has no reliable trigger (the exact
class of bug being fixed is the model under-doing the right thing); an A2UI-payload marker fails
because completion is a CONVERSATION fact, not a surface fact, and would widen the actual protocol
for a framing concern. The meta-line is the seam built for this.

## Decision

1. **A fourth additive MODEL-authored meta-line field: `flowEnd: true`.** The closing turn of an
   ask-flow carries it on the SAME leading meta-line as `note`:
   `{"a2uiMeta":{"note":"You're all set — we'll see you today at 2pm.","flowEnd":true}}`.
   Shallow-validated per the `ask`/`plan`/`personaPatch` arm precedent EXACTLY: anything other than
   literal `true` yields the envelope WITHOUT `flowEnd` (only itself dropped, never the envelope).
   A boolean, not an object, deliberately — v1 carries no payload (no outcome enum, no handoff
   target); if a future consumer earns structure, the field widens additively to `true | {...}`.
2. **The closing turn is the DEFAULT producer behavior, taught mode-invariantly.** `grammar.md`
   gains one "Flow completion" paragraph in the ask-mechanics section: after the user commits the
   flow-final confirm, the next turn MUST be a closing prose turn — a `note` that wraps up in plain
   language (what was accomplished + what happens next), carries `flowEnd: true`, declares NO new
   ask, and emits NO A2UI at all (the "should instead send NO A2UI" rule already in the grammar).
   This lands in grammar.md (mode-invariant mechanics), NOT in a mini-skill — mini-skills are
   optional, capped, relevance-ranked catalog idioms (ADR-0091); completion must be unconditional
   default behavior, which is exactly the issue's acceptance line ("not a per-scenario prompt
   hack"). The mode-scaled `ask-archetypes-*.md` files are untouched.
3. **The end-of-flow affordance lives in PAGE CHROME, not on the summary card.** Completion is a
   conversation-level state: the final turn may carry no card at all (cl.2 mandates it carries
   none), and ADR-0196's settled cards must stay durable Edit anchors — overloading the summary
   card with flow-level controls would couple two different lifecycles. On `flowEnd`, the page
   appends an end-of-flow chrome row after the closing note bubble.
4. **The v1 affordance set is `done` + `start-over` — handoff is a non-goal.** `Done` acknowledges
   and dismisses the chrome row (the conversation stays readable, the composer stays live for a new
   topic — nothing is destroyed). `Start over` routes to the page's EXISTING reset path (a2ui-live's
   Reset/`disposeAll`; agent-admin's conversation clear) — no second reset implementation. Both are
   plain fleet buttons within the seven-member event vocabulary (ADR-0153) — no new event name.
   Handoff is excluded because neither surface has a handoff target today; it returns when a real
   consumer exists (revisit trigger: a surface with somewhere to hand off to).
5. **The shared seam is named NOW: one `site/lib` flow-chrome module, consumed by BOTH surfaces.**
   GH #1065's locus note ruled per-surface once and flagged the second surface as the lift moment.
   This is the second surface. The module follows `ask-registry.ts`'s own pattern: it owns the
   LIFECYCLE and LOGIC (detect `flowEnd` on the peeled envelope, build the done/start-over row,
   wire the callbacks, dismiss-on-done) and owns NO page-specific markup — each page supplies its
   own mount point and CSS. Per-surface duplication is rejected: two hand-rolled completion rows
   would immediately diverge, the exact drift the #1065 note deferred rather than blessed.
6. **Nothing ships wired to this ADR in the same PR.** Docs-only proposal; the grammar paragraph,
   the meta-line arm, and the chrome slices are follow-ups per the decomposition
   (`../decompositions/ask-flow-completion.decomp.md`), gated on ratification.

## Non-goals

- **Any A2UI protocol (v0.9 wire) change** — `flowEnd` rides the meta-line framing envelope only;
  the validator, renderer dispatch, corpus path, and conformance suite are untouched by
  construction.
- **A handoff affordance** — excluded from v1 (cl.4); revisit trigger recorded there.
- **A new event name** — the seven-member vocabulary (ADR-0153) stays closed.
- **Card-level completion UI** — the summary card stays ADR-0196's territory (settle/Edit); this
  ADR adds nothing to any card template.
- **Auto-reset or session teardown on `flowEnd`** — completion is presentational + affordance only;
  the session, transcript, and settled cards all persist (the transcript stays truthful — the
  ask-registry law).
- **Heuristic completion inference in chrome** — rejected as a mechanism (Context); chrome only
  ever acts on the explicit field.

## Consequences

- The meta-line reserved vocabulary grows to four MODEL-authored fields
  (`ask · plan · personaPatch · flowEnd`) — named here so the next envelope audit finds a cited
  decision. Each remains independently shallow-validated; a malformed `flowEnd` can never break the
  conversational channel.
- The byte-pinned prompt texts change (grammar.md); the prompt pin tests move in the same slice —
  the ADR-0137 discipline.
- A model that FAILS to emit `flowEnd` degrades gracefully: the closing prose still ships (or, at
  worst, today's behavior persists for that turn) and no chrome misfires — strictly better than
  heuristics, whose failure mode is a wrong affordance on a live turn.
- `site/lib` gains one shared module with two page consumers — the first executed lift of the #1065
  locus question; future conversation surfaces (a2ui-chat, gen-ui-live) can adopt it without a new
  decision.
- Verification is pixel-truth on the real agent-admin test chat (the #1081 pattern), per the
  issue's own acceptance.

## Alternatives considered

- **Prompt+chrome convention only (no wire field)** — rejected: leaves the affordance with no
  deterministic trigger; chrome inference cannot distinguish "done" from "pausing"/"asking in
  prose" (the ADR-0187 indistinguishability lesson, transposed); the acceptance criterion becomes
  untestable.
- **A marker inside the A2UI payload** (a data-model flag, a component, or an envelope extension) —
  rejected: widens the actual protocol for a framing concern; completion is a conversation fact,
  not a surface fact; would drag the validator/corpus/conformance surface into a UX convention.
- **`ask.final: true` on the LAST ask's declaration** — rejected: the model would have to know a
  confirm is flow-final BEFORE seeing the answer, and the closing turn (where the wrap-up prose
  lives) is the turn AFTER that answer — the signal belongs on the turn it describes.
- **A structured `flowEnd: {summary, next}` object in v1** — rejected: no consumer for the
  structure exists; a bare boolean is additively widenable later (cl.1) and cheaper to teach.
- **Affordance on the summary card** — rejected (cl.3): couples flow lifecycle to card lifecycle,
  breaks when the closing turn carries no card, and crowds ADR-0196's Edit anchor.
- **Per-surface (duplicated) chrome, deferring the #1065 lift again** — rejected (cl.5): the lift
  trigger the locus note recorded ("the second surface") has fired; a third copy would be drift by
  choice.
- **done-only affordance set** — rejected: the intake dead-end's live repro wants "run it again"
  within reach, and start-over reuses an existing reset path at near-zero cost; anything MORE than
  these two (handoff) has no consumer yet.

## Amendment (2026-08-17, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/issues/1101#issuecomment-5318396675), verified 2026-08-17) — `flowEnd` on ALL flow-terminal paths, a pre-conclusion CONFIRMATION stage where the USER takes the final action, and the courtesy-close protocol (GH [#1101](https://github.com/kimgranlund/agent-ui/issues/1101), Kim's live pixel-run #2 UX ruling)

> Append-only, and **proposed**: the Status cell above reads `accepted` for the accepted record as a
> whole and stays byte-untouched — agents never flip status; THIS amendment awaits Kim's own
> `ratify ADR-0198 amendment` utterance on GH #1101, executed by `scripts/adr_ratify.py`'s amendment
> mode. Every accepted section above — cl.1–cl.6, Non-goals, Consequences, Alternatives — is unedited.
> GH #1101 is the durable design record (the ruling lives in its 2026-08-17 pixel-run-#2 Findings
> comment); the build that lands these rules is its follow-on dispatch (**Repairs**, below).

**Why the accepted Decision needs amending, precisely.** The accepted record designed the closing turn
around ONE terminal shape — "after the user commits the flow-final confirm" (cl.2) — and Kim's live
pixel run #2 hit the path that shape never named: the intake took the urgent-triage branch, the agent
correctly stopped intake with an escalation prose turn ("call 911 or go to the nearest ER… a clinician
will reach out"), and then NOTHING — no `flowEnd`, no done/start-over row. An escalation IS a flow end;
the accepted grammar paragraph simply never said so, so the model legitimately treated the closing-turn
duty as happy-path-only. The same run produced Kim's broader UX ruling: the flow's CONCLUSION itself
was mis-shaped — the agent took the conclusive action, where gen-ui UX wants the USER to take it, off a
final proposed-outcome artifact; and the close after that confirmation should follow a courtesy
protocol, not a bare acknowledgment. The meta-signal (cl.1) stands whole; what grows is the PROTOCOL
around it.

### Amended decision

- **A1 — `flowEnd: true` fires on ALL flow-terminal paths, not only the happy completion.** cl.2's
  trigger ("after the user commits the flow-final confirm") is widened to a terminal TAXONOMY, named
  in `grammar.md`'s Flow completion paragraph so models recognize every ending as an ending:
  - **Completion** — the happy path: the flow-final confirm committed, the closing turn follows
    (the accepted cl.2 shape, unchanged).
  - **Escalation / early stop** — the flow terminates BEFORE its normal end because the right outcome
    is a handoff out of the flow (the urgent-triage ending: "go to the ER, a clinician will reach
    out"). The escalation prose turn IS the closing turn: it carries `flowEnd: true`, declares no new
    ask, emits no A2UI — the accepted closing-turn mechanics, applied to this ending. This is the
    observed gap, repaired.
  - **Abandonment, where detectable** — the user explicitly walks away ("never mind", "cancel this",
    "let's stop here"): the acknowledging turn carries `flowEnd: true`. Only MODEL-visible
    abandonment qualifies — a silently closed tab is not a turn and no signal is possible; chrome
    still never infers (the accepted Non-goals' heuristic ban stands).

  The field itself is untouched — same bare boolean, same shallow validation, same meta-line arm
  (cl.1); this amendment changes only WHEN the grammar tells the model to emit it.
- **A2 — the pre-conclusion CONFIRMATION stage: the USER takes the final action.** Before any
  conclusive action (submitting the intake, booking the slot, dispatching the escalation record), the
  agent presents a final PROPOSED-OUTCOME artifact — the gen-ui summary card IS this artifact (the
  existing Intake-summary card gains the confirm role; no new component, no new card template — the
  accepted Non-goals' card-level-completion fence stands) — and the USER takes the final action:
  confirm, or keep going (amend an answer, add detail). Mechanically this is an ORDINARY ask — a
  confirm ask declared on the meta-line like any other, settling under ADR-0196's settle law once
  answered (the settled summary card stays the durable Edit anchor) — NOT a new meta-line field, NOT
  a new event name. **Ordering law: `flowEnd` comes AFTER the user's confirm, never before** — the
  proposed-outcome turn carries the ask and NEVER carries `flowEnd`; the closing turn follows the
  user's commit. cl.2's "flow-final confirm" is hereby made STRUCTURAL: every flow with a conclusive
  action HAS a flow-final confirm, because the confirmation stage is mandatory before concluding. On
  the escalation path the stage applies where a conclusive action exists to confirm (e.g. "send this
  to the triage team?"); a pure safety directive with nothing to dispatch concludes directly per A1.
- **A3 — the courtesy-close protocol: what the closing turn SAYS.** The accepted cl.2 shaped the
  closing turn's mechanics (prose `note` + `flowEnd: true`, no ask, no A2UI) but left its content at
  "what was accomplished + what happens next". Kim's ruling shapes it into the five-part courtesy
  close, taught as prompt guidance in `grammar.md`'s Flow completion paragraph (mode-invariant
  mechanics, NOT a mini-skill — the accepted cl.2 placement law stands): the closing turn states
  **(a)** what we did together, **(b)** what the user made happen (their confirm was the act),
  **(c)** confirmation it was sent/received, **(d)** appreciation, and **(e)** the offer — further
  questions, or session complete. Prose guidance only — no structure on the wire, no new fields; a
  model that writes four of the five parts still closes the flow (the signal, not the prose, is
  load-bearing). The done/start-over chrome renders after THIS turn, exactly as the accepted cl.3
  already provides.

### Non-goals (amendment)

- **No new meta-line fields.** The confirm stage is an ordinary ask; the courtesy close is prose; the
  reserved vocabulary stays at four (`ask · plan · personaPatch · flowEnd`).
- **No wire changes** — no A2UI protocol touch, no validator/corpus/conformance movement, no new
  event name; every accepted Non-goal stands.
- **No structured outcome taxonomy on `flowEnd`.** The terminal taxonomy is GRAMMAR guidance, not
  wire structure; the boolean stays bare (cl.1's additive-widening door stays open, unexercised).
- **No chrome divergence per terminal path** — one done/start-over row for every ending; the shared
  module (cl.5) needs no per-path variants.

**Repairs** (booked for the ratification-triggered BUILD, not authored here):
- `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` — the Flow completion paragraph is REWRITTEN:
  the terminal taxonomy (A1), the mandatory pre-conclusion confirmation stage + the
  `flowEnd`-after-confirm ordering law (A2), and the five-part courtesy close (A3); byte-pinned
  prompt, so `prompt-equivalence.baseline.json` is re-captured in the same slice (the ADR-0137
  discipline, via the armed `recapture-baseline.test.ts` writer).
- `site/lib/flow-chrome.ts` — unchanged or minor: it already acts only on the explicit field with a
  one-row invariant, which covers every terminal path by construction; at most a comment/doc touch.
- The escalation-path fix verified end-to-end: the urgent-triage ending (the observed gap) emits
  `flowEnd` and the chrome row renders — a targeted deterministic test where feasible, plus the live
  run below.
- A live pixel-truth re-run on the real agent-admin test chat (the #1081 pattern) as the CLOSING
  acceptance: one happy-path flow through proposed-outcome → user confirm → courtesy close → chrome
  row, and one urgent-triage flow ending in escalation + chrome row, on Kim's live surface.

## Amendment (2026-08-18, **ratified** — kimgranlund, [utterance](https://github.com/kimgranlund/agent-ui/issues/1101#issuecomment-5323434193), verified 2026-08-18) — mid-flow backable-wizard commits are scene transitions, not answered asks; the closing turn's exactly-ONE settle `updateComponents` carve-out (`req-a2ui-patterns.md` R2/R4, Kim's rulings 2026-08-17)

> Append-only, and **proposed**: the Status cell above reads `accepted` for the accepted record as a
> whole and stays byte-untouched, and the 2026-08-17 amendment above (flowEnd on all terminal paths,
> the pre-conclusion confirmation stage, the courtesy-close protocol) is itself **ratified** and
> stays byte-untouched — agents never flip status. THIS amendment awaits Kim's own
> `ratify ADR-0198 amendment` utterance, executed by `scripts/adr_ratify.py`'s amendment mode.
> Source, each carve-out separately (their provenance differs): **B2** (the closing-turn settle
> carve-out) ← `req-a2ui-patterns.md` R4's recorded Kim ruling — an explicit override of the lane's
> own client-side-only recommendation, in that doc's "Kim rulings" section. **B1** (the mid-flow
> scene-transition carve-out) ← `req-a2ui-patterns.md` R2's review-corrected conflicts analysis
> (the doc-checker review forced R2's initial "no conflicts" claim to be reframed as a required law
> amendment) plus Kim's separate approval of GH #1192 ("backable-wizard answered-ask carve-out
> grammar amendment") as the mint-all-round work item that realizes it — R2 itself carries no ruling
> bullet in that doc's "Kim rulings" section. (R3's greet-home/greet-feed-placement forks are also
> ruled there but touch no ADR-0198 clause — they are realized instead via the mini-skill + the
> exempt ask-id class, no wire change to this ADR's territory.)

**Why the accepted record needs amending, precisely.** `req-a2ui-patterns.md` designed two new
grammar-level patterns that COMPOSE with ADR-0198's shipped completion law rather than replacing
it, and the lane's own review caught that both patterns silently contradict clauses of the accepted
record as written, each requiring a named carve-out:

- **R2 (backable multi-step).** The shipped answered-ask law (`grammar.md`, restated in this ADR's
  Context) forbids updating, deleting, or rebuilding a surface once the user has answered its ask —
  "declare a NEW ask with a FRESH `ask-<n>` id" for the next step. But the shipped surface-reuse
  paragraph (GH #1164, cited in this ADR's own Relates) already requires a continuing flow to REUSE
  its surface scene-to-scene, and a backable wizard's Next/Back is exactly that continuation: the
  producer's response to a Next/Back click updates the SAME surface the user just acted on. The two
  shipped clauses collide head-on for this one pattern, and neither side is optional (the fresh-id
  reading breaks surface-reuse; the reuse reading breaks the answered-ask freeze). R2's finding:
  mid-flow Next/Back is not an "answered ask" in the freeze's sense at all — it is a scene
  transition inside one still-open ask, and only the flow-final confirm closes it.
- **R4 (conclude bookend / settled receipt).** This ADR's own A3 (the courtesy-close protocol)
  states the closing turn "emits no A2UI" — a clause this amendment's own accepted text repeats
  three times (cl.2, cl.3, A2). Kim's ruling on R4's three-way fork requires the confirmed receipt
  to visibly settle (buttons retired, a settled badge added) in the SAME turn as the courtesy close,
  overriding the lane's own client-side-only recommendation. That is one `updateComponents` on the
  closing turn — a direct, deliberate exception to the "emits no A2UI" sentence, named here so the
  next envelope/closing-turn audit finds a cited decision rather than a silent contradiction.

Both carve-outs are bundled into ONE amendment per Kim's explicit ruling (`req-a2ui-patterns.md`,
"Kim rulings" section): *"the mobilization's grammar-amendment item must bundle this carve-out with
the R2 mid-flow carve-out so ADR-0198 is amended once, not twice."*

### Amended decision

- **B1 — mid-flow backable-wizard commits are scene transitions, not answered asks.** The
  answered-ask freeze (declare-a-new-ask-with-a-fresh-id) applies ONLY at flow end — the moment the
  flow-final confirm is committed. Every Next/Back turn before that point is a scene transition on
  the SAME still-open ask: the producer's `updateComponents` response swaps the scene container's
  children (a stable child id under the root-once wrapper), the ask keeps its ONE `ask-<n>` id for
  the whole wizard (posture (i), `req-a2ui-patterns.md` R2's recommendation), and the shared draft
  state lives under a `/draft/*` data-model prefix that survives every scene swap untouched — Back
  is free because nothing has been committed anywhere yet. Once the flow-final confirm lands, the
  ask IS answered in the accepted sense and this ADR's existing law (A2's ordering law, ADR-0196's
  settle law) governs from that point exactly as accepted.
- **B2 — the closing turn's ONE exception to "emits no A2UI": the settle `updateComponents`.**
  Immediately before (in the SAME producer turn as) the courtesy-close note + `flowEnd: true`, the
  closing turn MAY carry exactly one `updateComponents` against the confirmed receipt's surface:
  strip its Back/Confirm buttons and add a settled-status Badge (e.g. "Booked · #AB123"). This is
  the one bundled carve-out to A3's "closing turn emits no A2UI" and to cl.2/cl.3's identical
  framing — every other accepted constraint on the closing turn stands unchanged (no new ask, prose
  `note`, `flowEnd: true`, the done/start-over chrome rendering after this turn exactly as cl.3
  already provides). The settle update targets ONLY the already-confirmed receipt surface — never a
  fresh surface, never any other card — and fires at most once per flow, on the escalation path
  never (a pure safety-directive close has no receipt to settle, per the amendment above's A1).
  `deleteSurface` is still never used on a confirmed receipt (the accepted Consequences' durability
  guarantee stands): B2 is a strip-and-badge `updateComponents`, not a removal.

### Non-goals (amendment)

- **No new meta-line fields, no wire vocabulary growth** — B1/B2 are grammar-level clarifications
  of when the existing `ask`/`flowEnd` mechanics apply, not new fields; the reserved meta-line
  vocabulary stays at four (`ask · plan · personaPatch · flowEnd`).
- **No change to the fresh-id rule's substance at true flow end** — B1 narrows WHEN the freeze
  starts, it does not loosen what happens once it does; a genuinely new ask after the flow (a
  follow-up task) still gets a fresh `ask-<n>` id exactly as before.
- **No second settle turn, no producer turn between confirm and close** — the settle update rides
  the closing turn itself (B2); `req-a2ui-patterns.md` R4's fork (ii), an extra standalone settle
  turn, is explicitly the path NOT taken (it has no user message to answer and would itself violate
  the immediately-next-turn mandate).
- **No greet-card wire change lands here** — R3's ask-id-exempt-class mechanism (Kim's ruling)
  realizes the greet pattern entirely within the existing `ask` meta-line field and is tracked by
  its own mobilization item; it touches no clause of this ADR.

**Repairs** (booked for the ratification-triggered BUILD, not authored here):
- `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` — the surface-reuse paragraph and the
  answered-ask-law paragraph both gain the B1 scoping sentence (freeze begins at flow-final
  confirm, not before); the Flow completion paragraph (already rewritten by the 2026-08-17
  amendment) gains the B2 settle-carve-out sentence; byte-pinned prompt, so
  `prompt-equivalence.baseline.json` is re-captured in the same slice.
- A `backable-wizard` corpus seed (`req-a2ui-patterns.md` R2's mobilization item 2) replaying the
  3-step dates→room→confirm sketch, validating that Back preserves `/draft/*` values across scene
  swaps on ONE surface with ONE ask id.
- The settled-receipt clause + settle-turn build (`req-a2ui-patterns.md` R4's mobilization item 5):
  the closing-turn settle `updateComponents` implemented against the confirmed receipt surface,
  composing with — never duplicating — ADR-0196's client-side answered-card treatment for
  non-flow-final asks.
- A live pixel-truth re-run on the real agent-admin test chat (the #1081 pattern): one backable
  3-step flow where the user goes Back at the confirm step, amends an earlier answer, and returns
  forward with values preserved (B1), immediately followed by a closing turn whose receipt visibly
  settles in the same turn as the courtesy close (B2).
