# ADR-0089 — clarify-before-acting and catalog-boundary negotiation: teaching the live agent to ASK (a note-only turn) instead of guess, and to be honest about the wall the catalog is

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored; ratified date set on accept)* |
> | **Proposed by** | planner (design seat — the "next level of conversational UX" intake following ADR-0088) |
> | **Ratified by** | Kim — the 2026-07-08 design-records wave (landed `accepted` at first commit, `96a0778`, beside the individually-ratified ADR-0087); this cell back-filled from git evidence at the 2026-07-12 repo-alignment (manifest M2, Kim-ratified) |
> | **Repairs** | on ratification+build: `a2ui-live-agent.spec.md` SPEC-R6 (the derived prompt's hand-authored GRAMMAR half gains two behaviors — clarify-when-underdetermined and boundary-aware negotiated approximation; the catalog-DERIVED half + its drift gate are untouched) · SPEC-R8 (a note-only clarifying/boundary turn is a recognized round-trip shape — extends ADR-0088's note-only turn) · `a2ui-runtime`/ADR-0071 GRAMMAR block (`system-prompt.ts:14-35`) · `a2ui-live-agent.lld.md` LLD-C4 (the grammar additions), LLD-C9 (`a2ui-live.ts` renders a note-only ask as a normal agent message — no new wire field) |
> | **Supersedes / Superseded by** | Extends **ADR-0088** — adds the clarify/boundary *behaviors* on the note-only turn 0088's channel already carries; 0088's note/trace/`wantResponse`-routing decision stands **unchanged**. This lifts 0088's OWN `Out of scope` item ("*agent-initiated questions back to the user*") INTO scope, built on 0088's mechanism, adding no new wire surface. · Extends **ADR-0071** — the hand-authored GRAMMAR half gains two behaviors; the catalog-derived inventory + `prompt-drift.test.ts` are untouched. · *the reciprocal `Extended by ADR-0089` back-links land on ADR-0088/0071 at ACCEPT time, mirroring ADR-0088's own deferral of reciprocal links.* · **Extended by ADR-0097** (the clarify/negotiate ASK gains a structured, feed-embedded surface form; the note-only prose ask remains the shape's own degrade path — 0089's decision stands) |

## Context

ADR-0088 (`proposed`, 2026-07-07) built a two-way prose channel — a reserved leading meta-line
carrying a natural-language `note` beside the validated A2UI stream — and, in the SAME decision,
designed the **note-only turn**: a turn that yields the meta-line and ZERO A2UI lines, which
`produce()` must "return cleanly, NOT halt-and-report (empty ≠ invalid)" (ADR-0088 Consequences +
build-slice 2). It then explicitly placed **"agent-initiated questions back to the user beyond the
existing round-trip"** in its `Out of scope`. So the channel to *ask the user something* exists by
construction, but the decision to USE it that way was deliberately deferred — which is exactly the
gap Kim's next ask names.

Two shipped constraints make that gap concrete, and both are prompt-level, not wire-level:

- **The agent is hard-forbidden to speak, and hard-forbidden to leave the catalog — with no third
  option at the boundary.** The hand-authored GRAMMAR half of the derived prompt opens "You do NOT
  reply in prose or HTML — you emit a stream of JSON messages" (`system-prompt.ts:15-16`) and closes
  "Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a
  prop" (`system-prompt.ts:34`). The model is *told the exact boundary* — the full component/props
  inventory is derived into the prompt (`system-prompt.ts:37-46`, `71-72`) — but it is told only what
  it may NOT do. Faced with an underdetermined turn ("make it better", "add more stuff" — no
  referent) or a request needing a type the catalog lacks ("build me a data table" — there is no
  `DataTable`), the agent today has exactly two behaviors: **guess** and emit a possibly-wrong
  surface, or, if it cannot compose a valid one, **halt** with "could not compose a valid surface"
  (`produce.ts:141`, surfaced at `a2ui-live.ts:217-218`). It cannot **ask**. Kim's ask is precisely
  the missing third behavior.
- **"Improvise beyond the catalog" is mechanically impossible in the live path — a hard security
  boundary, not a soft preference.** The catalog IS the render-time security allowlist (SPEC-R9): an
  uncatalogued type is a `CATALOG` conformance failure (`conformance.ts:18-19`), so
  `validateA2ui(output, catalog)` is never `valid` (`produce.ts:134-135`), the failure is fed back
  for self-correction (`:139`), and at the round bound `produce()` throws `ProduceHalt` (`:141`).
  Under validate-then-stream, **an uncatalogued type never reaches the browser at all** — it does not
  even render as a placeholder. (The renderer's placeholder path, `widget.ts:110-120`, is reachable
  only by a payload that bypassed produce's validate — a hand-authored transcript or a direct
  `host.ingest` — never the live model.) So "go beyond the catalog and improvise" **cannot** mean
  "emit a new type": that is not merely a security weakening, it is a dead end that renders nothing.
  Whatever "improvise" safely means, it must live *inside* the allowlist.

Kim's intent, decomposed, is TWO capabilities sharing one mechanism: **(1) clarify-before-acting** —
ask a qualifying question instead of guessing when the turn is too vague to act on well; **(2)
catalog-boundary awareness + negotiated escalation** — know the wall, and when a request would need
something beyond it, say so and ask the user whether to approximate within the catalog. Both are "the
agent says something to the user instead of/before emitting UI" — i.e. a note-only turn on the
channel ADR-0088 already built.

## Decision

**Teach the live agent to ASK — as a note-only turn on ADR-0088's channel — in two situations, via
the hand-authored GRAMMAR half of the derived prompt (ADR-0071); add NO new wire, transport, or
protocol surface.** These are ONE decision because they are the same mechanism (a note-only turn: a
`note` meta-line, zero A2UI lines — ADR-0088's already-designed shape) answering the same question
("when should the agent talk to the user rather than build?"), bundled as ADR-0088 bundled its three
coupled parts; ratify both knowingly.

### 1. Clarify-before-acting — a note-only qualifying question when a turn is underdetermined.

The GRAMMAR gains an instruction: when the user's intent is too vague or general to act on well —
specifically **under-determined in a way that guessing would likely waste the turn** (no actionable
referent: "make it better", "add more stuff", "fix it") — emit a note-only turn asking ONE qualifying
question, and emit no A2UI. When the intent *is* actionable with a sensible default ("build me a
form", "a login screen", "a product card") the agent still just builds — Kim's own line: "'build me a
form' is arguably fine, but 'make it better' or 'add more stuff' is not." The exact threshold is prompt
wording, tuned at build (see *re-verify* below), not a wire concern.

- This rides ADR-0088's note-only turn unchanged: `produce()` peels the meta-line, finds zero A2UI
  lines, and returns cleanly (ADR-0088 build-slice 2); the page shows `note` where the empty-payload
  branch (`a2ui-live.ts:207`) would otherwise say "no further turns" (ADR-0088 already repairs that
  branch). **No new produce/transport code beyond what ADR-0088 already commits.**
- The user's answer is a **normal `intent` turn**. The session already carries full history
  (`agent-transport.ts` turn array; ADR-0088 §2), so the model sees its own prior question and the
  answer together and proceeds. This is a **single clarification round**, not a dialog tree — a
  multi-turn planning mechanism stays out of scope (as in ADR-0088).

### 2. Catalog-boundary awareness + negotiated approximation — know the wall, disclose it, ask.

The GRAMMAR gains a boundary behavior. The model already knows the wall (its inventory is the
catalog, `system-prompt.ts:71-72`). When a request would need a type or capability the catalog lacks,
the agent does NOT silently emit a wrong-but-valid best fit and does NOT attempt an uncatalogued type
(which cannot render — see Context). Instead:

- **It names the limit and asks permission to approximate** — a note-only turn: "I don't have a real
  data table in my catalog. I can approximate one with a Grid of Rows and Text — want me to?" This is
  Kim's "ask the user if it is ok to augment and go beyond the catalog." On the user's "yes" (a
  normal intent turn), it **approximates WITHIN the catalog**: composing catalogued primitives
  (`Grid`/`Row`/`Column`/`Text`, etc.) into the shape the missing type would have provided, and
  discloses that it is an approximation in the accompanying `note`.
- **This is the only safe meaning of "improvise", and it needs no protocol change** — it is a
  reasoning + honesty capability, entirely inside the security allowlist. The GRAMMAR already forbids
  inventing types (`system-prompt.ts:34`); ADR-0089 adds what to DO instead: approximate-and-disclose,
  after asking.

### What this decision is NOT — the "improvise" trap, closed

"Improvise beyond the catalog" has exactly one safe realization (approximate within it, above). The
tempting alternatives are closed on their merits:

- **Widen the security allowlist at runtime** so the agent can render a genuinely new type — a hard
  **NO**. This is a security decision, not a UX one (widening an allowlist is never a conversational
  affordance), and it is *mechanically self-defeating* regardless: an uncatalogued type fails the
  shared validator and never streams (Context). Listed in *Out of scope*, not left ambiguous.
- **Propose ADDING a catalog type as a follow-up** (route to the `a2ui-catalog-design` /
  `a2ui-builder` territory — a human-in-the-loop catalog extension). The agent MAY legitimately *say*
  this in a note ("I could request a real Table be added to my catalog — that's a change a human
  makes offline"), and that costs nothing (it is prose on the note channel). But its **fulfillment is
  out-of-band** — a human adds the row, re-runs the coverage/drift gates (ADR-0087). It is NOT a
  runtime capability and this ADR does not build one; it is a sanctioned *thing the agent may honestly
  offer*, nothing more.

## Open fork (Kim's call) — and the re-verify points it is *not*

Exactly **one** fork needs Kim's judgment; the rest are prompt-tuning settled empirically at build.

- **Fork (Kim's call) — demonstrate in the recorded backbone, or live-only?** Both behaviors are
  inherently **live-model judgments** (only a real model can weigh "is this vague?" or "does this
  exceed my catalog?"). The deterministic recorded backbone (the default transport, and what the
  *built static site* shows with no API key — `a2ui-live.ts:154`) cannot decide to clarify. So v1 is
  naturally live-only. The alternative is to **seed a scripted clarify + boundary-ask turn into the
  recorded transcript** (as ADR-0088 slice 6 seeds a note), so the offline/static demo *showcases*
  the capability. The tension is genuine and values-based, not empirical: **demo completeness** (most
  viewers see the static build, keyless) vs. **backbone honesty** (the transcript records real turns;
  a canned "clarification" fakes a judgment the recording never made). *Recommendation: live-only for
  v1* — keep the backbone an honest record; revisit seeding if Kim wants the static demo to advertise
  it. Kim's call because it is taste, with a real build-scope consequence (whether the slice touches
  `transcript.ts` + `round-trip.test.ts`).
- **Build-time re-verify (NOT Kim's call) — the vagueness threshold wording.** Where exactly "act on
  a sensible default" ends and "ask a qualifying question" begins is GRAMMAR prose, tuned against real
  turns (does "build me a dashboard" build or clarify?). An observation, not a ruling — Kim already
  specified the disposition qualitatively ("build me a form" = act; "make it better" = clarify); the
  residual is wording.
- **Build-time re-verify (NOT Kim's call) — does a note-only ask need distinguishing chat styling?**
  A note-only turn is already page-distinguishable from a build turn (zero A2UI lines —
  `turnLines.length === 0`, `a2ui-live.ts:207`). Distinguishing a *question* from a *statement* within
  note-only turns would need a small additive `noteKind` field on the meta-line's `a2uiMeta` object
  (still versionless, still provably not an `A2uiServerMessage`, still filtered before ingest). v1
  ships **without** it — a plain agent message (`addMessage('agent', note)`, `a2ui-live.ts:71-81`) is
  honest and sufficient; add `noteKind` only if the plain rendering tests poorly. A refinement, not a
  fork.

## Consequences

- **The conversation gains its missing third move.** The agent can now ask instead of only guess-or-
  halt; and at the catalog wall it is honest ("here's my best approximation with what I have") rather
  than silently shipping a wrong-but-valid surface or dead-ending. This is the "next level" Kim named.
- **Zero new wire/transport/protocol surface.** Both behaviors are note-only turns on ADR-0088's
  channel + two GRAMMAR sentences. `AgentTransport.turn`, `produce()`'s peel/emit, the reducer, and
  the meta-line shape are all exactly as ADR-0088 leaves them. This ADR's entire build cost is prompt
  text + (at most) a page affordance — **it is the cheapest possible realization of Kim's ask**, and
  that cheapness is a direct consequence of ADR-0088 having built the channel first.
- **Hard dependency on ADR-0088.** ADR-0089 CANNOT ship before ADR-0088: it needs the note channel
  (to carry prose at all — the current GRAMMAR forbids prose, `system-prompt.ts:15`) and the note-only
  turn handling (empty ≠ invalid). If ADR-0088 is not ratified/built, this ADR has no mechanism to
  ride. Sequence 0088 → 0089.
- **The drift gate is unaffected.** The clarify + boundary instructions live in the hand-authored
  GRAMMAR half; `prompt-drift.test.ts` asserts only the catalog-DERIVED inventory
  (`system-prompt.ts:37-46`), which is untouched (ADR-0071 permits the grammar half to carry
  non-derived instruction — the same seam ADR-0088's note instruction uses).
- **Honest costs / new behavior to enumerate in the LLD:**
  - **Quality is not gate-covered.** Whether the agent clarifies at the *right* times, asks a *good*
    question, and approximates *well* is live-model prose — ungated at runtime, consistent with
    ADR-0070 (quality is authoring/curation-time; the runtime gate is deterministic-only). A too-eager
    agent (clarifies when it should just build) is a prompt-tuning regression, caught by observation,
    not a test.
  - **The approximation can mislead.** A `Grid`-of-`Text` "table" is not a real table (no sort, no
    column semantics). The disclosure note is the mitigation, but a user may over-trust the
    approximation — a real cost of offering it. The honesty note is load-bearing, not decoration.
  - **A latent "yes" ambiguity.** The user's answer to a clarify/boundary question is a plain intent
    turn with no marker that it *is* an answer; the model relies on session history to connect them
    (ADR-0088 §2). Robust in the common case; a user who ignores the question and asks something else
    entirely simply gets that new thing — acceptable, but note it is not a state machine enforcing the
    answer.
- **Stale → re-verify on the build gate:** the vagueness threshold (tune against real turns) · whether
  `noteKind` styling is needed (try plain first) · the backbone-seed fork (if Kim later chooses to
  seed, `transcript.ts` + `round-trip.test.ts` gain a scripted example).

## Acceptance

*(Predicates for the eventual build, if ratified — not run here; this is a design record. All assume
ADR-0088 is built.)*

- With a stub provider that returns a note-only clarify turn for an underdetermined prompt, the loop
  yields the meta-line and zero A2UI lines and `produce()` returns cleanly (no `ProduceHalt`); the
  page shows the note as an agent message — deterministic unit + page test, `npm run check && npm
  test` green, no live model.
- A read confirms the diff touches only the GRAMMAR string (`system-prompt.ts`) and, at most, the
  page's note-render (`a2ui-live.ts`) — **no** change to `AgentTransport.turn`, the meta-line shape,
  `produce()`'s validate/stream, or the reducer.
- `prompt-drift.test.ts` stays green (the additions are in the grammar half, not the catalog-derived
  inventory).
- A read confirms no path renders or admits an uncatalogued type (the security allowlist is untouched;
  "improvise" is approximate-within-catalog only).

## Alternatives considered

- **Amend ADR-0088 in place** (append a `## Amendment`) rather than a new ADR. Rejected by the log's
  own amendment-vs-supersession test (`README.md` §"Amendment vs supersession"): an amendment lands "an
  extension the decision **already anticipated**." ADR-0088 anticipated agent-initiated questions only
  to place them explicitly in `Out of scope` — the opposite of a booked follow-through. ADR-0088's
  Decision *stands* and this is a *separate, new* decision built on it → the log's **Extension** case
  (new ADR, two-way `Extends`/`Extended by` link), exactly as ADR-0012 extends ADR-0006.
- **A new wire field to carry the clarify/boundary intent** (a `kind`/`noteKind` on the meta-line, or a
  new `TurnInput` arm for "this is an answer"). Rejected as the v1 shape: the note-only turn already
  carries a question, session history already connects the answer, and a page can already tell a
  note-only turn from a build turn. Adding wire surface for what prose + existing structure convey is
  the over-engineering ADR-0088 itself rejected (the typed-frame alternative). `noteKind` is recorded
  as the natural refinement IF plain styling tests poorly — not built now.
- **Let the agent silently emit a best-fit at the catalog boundary** (today's implicit behavior). It
  is what the shipped grammar produces; rejected as the whole point — Kim's ask is that the agent be
  *aware of its limitations* and *say so*, not paper over them with a plausible wrong surface.
- **Widen the security allowlist at runtime so "improvise" can render a new type.** Rejected on two
  independent grounds: it is a security decision misfiled as UX (an allowlist is not a conversational
  knob), and it is mechanically self-defeating — an uncatalogued type fails the shared validator and
  never streams (`conformance.ts:18-19`, `produce.ts:134-141`). See *Out of scope*.

## Out of scope (this ADR)

- **Any widening of the render-time security allowlist (SPEC-R9).** A firm NO, not an open question:
  "improvise beyond the catalog" is realized as approximate-*within*-catalog + honest disclosure, never
  as rendering an uncatalogued type. Changing what the catalog admits is a catalog-design decision
  (`a2ui-catalog-design`/ADR-0087 territory) with its own coverage + drift gates, not a UX record.
- **Runtime catalog extension.** The agent may *offer* to propose a new catalog type as a human-in-
  the-loop follow-up (prose only); actually adding a type is an offline human change, not built here.
- **Multi-turn clarification dialogs / planning.** A single clarification round on the existing round-
  trip only — no dialog tree, no agent-held plan state (as ADR-0088's out-of-scope).
- **A rubric for clarify/approximation quality** — runtime quality stays ungated (ADR-0070).
- **Any new LLM capability** beyond "sometimes emit a note-only turn asking a question" — no tool use,
  no second model call, no fine-tuning (prompt engineering only).
- **New wire/transport/protocol surface** — none; a `noteKind` discriminator is a deferred refinement,
  not part of this decision.

## Build-sequencing note (indicative size, if ratified — a full decomposition is a follow-up)

**Depends on ADR-0088 being built first** (the note channel + note-only turn). Given that, ADR-0089 is
small — roughly, smallest→largest:

1. **GRAMMAR additions** (`system-prompt.ts`, ADR-0071 grammar half): two behaviors — clarify-when-
   underdetermined (emit a note-only qualifying question), and boundary-aware negotiated approximation
   (name the limit, ask, approximate-within-catalog + disclose on yes). `prompt-drift.test.ts`
   unaffected (asserted). This is the bulk of the change.
- 2. **Page note-render for a note-only ask** (`a2ui-live.ts`, `check:site`): none beyond ADR-0088 if a
   plain agent message suffices; a `noteKind`-driven chat style is the deferred refinement (fork/re-verify).
- 3. **(Fork-dependent) recorded-transcript scripted example** (`transcript.ts` + `round-trip.test.ts`):
   ONLY if Kim chooses backbone-demo-seeding over live-only. Adds a canned clarify/boundary turn so the
   static build showcases the capability.
- 4. **SPEC/LLD repairs** (SPEC-R6/R8, LLD-C4/C9) landed with the build, per this ADR's `Repairs:`.

The heaviest slice is (1) the prompt text; everything else is either already done by ADR-0088 or
fork-gated. This is deliberately the *cheapest* next conversational-UX step — the expensive part
(the channel) was paid by ADR-0088.
