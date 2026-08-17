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
