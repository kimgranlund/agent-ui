# ADR-0088 — the live-agent conversational channel: a natural-language `note` beside (never inside) the A2UI stream, a grounded per-turn decision-trace, and `wantResponse`-routed click→turn

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored; ratified date set on accept)* |
> | **Proposed by** | planner (design seat — the two-way-conversation intake against the shipped live-agent demo) |
> | **Ratified by** | Kim — the 2026-07-08 design-records wave (landed `accepted` at first commit, `96a0778`, beside the individually-ratified ADR-0087); this cell back-filled from git evidence at the 2026-07-12 repo-alignment (manifest M2, Kim-ratified) |
> | **Repairs** | on ratification+build: `a2ui-live-agent.spec.md` SPEC-R8 (round-trip gains a note channel + per-action routing) · SPEC-R5/N4 (the note rides beside, not inside, the validated A2UI stream) · SPEC §5 typed contracts (the meta-line convention; the `AgentTransport.turn` type is UNCHANGED) · `a2ui-live-agent.lld.md` §4 (round-trip state machine), §5 / LLD-C3 (`produce()` peels + emits the meta-line), LLD-C5 (the reducer/routing), LLD-C9 (`a2ui-live.ts` note-render + routing) · `a2ui-runtime` derived-prompt grammar (ADR-0071 half) |
> | **Supersedes / Superseded by** | Extends **ADR-0070** (the runtime loop now also emits a note+trace OUTSIDE the validated stream — 0070's no-critic-round + validate-then-stream stand) · Extends **ADR-0072** (the session/round-trip gains a note channel + per-action routing) · Extends **ADR-0011** (the producer/page layer READS `wantResponse` for routing; 0011's canonical action shape + the renderer's RPC-correlation use are untouched) · *the reciprocal `Extended by ADR-0088` back-links land on ADR-0070/0072/0011 at ACCEPT time, not now — mirroring ADR-0011's own `Extended by ADR-0054` precedent* · **Extended by ADR-0097** (the meta envelope's `note`/`trace`/`wantResponse`-routing decision stands UNCHANGED; ADR-0097 adds an additive `ask` field to the SAME envelope for feed-embedded interactive asks) |

## Context

The shipped live-agent demo (SPEC-R8 / ADR-0072) is a *one-way* conversation dressed as two-way. Two
gaps, verified against the tree, share a single missing primitive:

**There is no natural-language channel anywhere in the turn model.** `Turn.content` is defined as *"for
`assistant` turns this is the A2UI JSONL the agent emitted"* (`agent-transport.ts:28-32`) — literally
nothing else. `produce()` accumulates the model's raw output and yields ONLY validated A2UI messages,
`for (const msg of output) yield JSON.stringify(msg)` (`produce.ts:136`); the dev proxy forwards each
verbatim, `res.write(line + '\n')` (`dev-proxy-plugin.ts:140-142`). The "Agent: …" line the chat shows
is **synthesized client-side** by `summarize()` — it lists message KINDS, `Emitted 3 A2UI message(s):
createSurface, …` (`a2ui-live.ts:187-193`), never a sentence the model produced. So Kim's *"how did you
reason to X vs Y"* has **nowhere to live**: no field, on the wire or in the session, carries prose.

**Clicks already trigger dialogs — indiscriminately.** `handleClientMessage` turns EVERY client message
into a full visible turn: `addMessage('user', …)` then `runTurn(nextTurn(session, message))`, with no
condition (`a2ui-live.ts:224-229`). Meanwhile the outbound action envelope already carries a
`wantResponse?: boolean` end-to-end — the agent authors it on a `Button.action` (ADR-0011), the renderer
reads it (`renderer.ts:348`) and stamps it onto the emitted `A2uiAction` (`action.ts:87-96`,
`protocol.ts:174`). The "should this click talk back" signal is **wired but unused for routing**.

Two constraints bound any fix:

- **A2UI wire purity (SPEC-N3 / ADR-0070 clause 3).** The runtime validator is the shared
  `heal`+`validateA2ui` (`produce.ts:129-137`), identical to the renderer's and the corpus admission's;
  and 0070 pins "the browser transport [stays] IDENTICAL between the recorded backbone and the live
  overlay." Prose smuggled into an `A2uiServerMessage` would either fail that validator or pollute the
  judged corpus. Prose must ride *beside* the A2UI stream, never inside it.
- **A grounded "why" cannot be confabulated.** Nothing today records WHY a turn chose its components:
  `retrieve()`'s matched exemplars, `heal()`'s corrections, and the validator's failures are all
  consumed inside `produce()` and discarded. The proxy is stateless (ADR-0072 clause 4), so nothing
  persists. An explain-turn asked today would have the model invent a retroactive justification.

A blocking discovery pins the routing half: **the committed backbone seed sets no `wantResponse`** —
`{ …, action: { action: 'submit' } }` (`canvas-button.ts:27`), as do most corpus action buttons. So any
routing rule that treats "`wantResponse` absent ⇒ silent" would kill the shipped demo's turn-2 and
regress every existing action button.

## Decision

**Give the live-agent turn a conversational channel, in three coupled parts riding ONE new wire
mechanism.** They are one decision because (b) rides (a)'s channel and (c) is the routing half of the
same *"which interactions are conversational"* question — bundled deliberately, as ADR-0070 bundled its
two coupled clauses; ratify all three knowingly.

### 1. The `note` channel — a distinguished leading meta-line on the SAME `AsyncIterable<string>` stream.

Each turn's model output is split into a short natural-language `note` (the agent's contemporaneous
rationale / reply) plus optional A2UI JSONL (only when the UI changes). The note is carried as a
**reserved meta-line emitted FIRST** on the existing transport stream — a JSON object with a reserved
wrapper key and NO `version` field, e.g. `{"a2uiMeta":{"note":"I used a Card because you asked for a
summary with one action."}}`. This is provably **not** an `A2uiServerMessage` (every server message
carries `version` + one of the fixed envelope keys — `dispatch.ts:36-43`), so:

- `AgentTransport.turn(input): AsyncIterable<string>` and every transport signature stay **byte-identical
  contracts** — zero blast radius on the interface (`agent-transport.ts:67-69`). The meta-line is a
  DEMO-TRANSPORT framing convention, not part of the A2UI protocol.
- `produce()` peels the leading meta-line off `raw` BEFORE per-line `heal`/`validateA2ui` (a note line
  would otherwise fail the healer and waste a self-correct round), then yields the meta-line first and
  the validated A2UI lines after (`produce.ts:94-141`). The note sits OUTSIDE the validate-then-stream
  gate (there is nothing to validate in prose); it is emitted only on the round that succeeds.
- The page (`a2ui-live.ts` `runTurn`) filters the meta-line before `host.ingest` and before
  `allLines`/the JSON tab: `if (meta) { note = meta.note; continue } else host.ingest(line)`
  (`a2ui-live.ts:200-214`). It then calls `addMessage('agent', note ?? summarize(turnLines))` —
  `summarize()` (`a2ui-live.ts:187-193`) demotes to the **fallback** when no note is present, so the
  recorded backbone (which emits no note) still renders exactly as today.
- The recorded transcript may carry an optional per-turn `note` string (`transcript.ts:13-16`), streamed
  as the same meta-line — keeping the two transports' stream shapes identical (SPEC-R5/N4).
- The note instruction lives in the **hand-authored grammar half** of the derived prompt (ADR-0071
  permits this; the catalog-derived half is untouched, so the drift gate is unaffected).

### 2. The decision-trace — a light, browser-held, per-turn record that grounds "why" answers.

The material for a grounded "why" exists only transiently inside `produce()`. Record a compact
`TurnTrace` per turn and carry it back on the SAME meta-line
(`{"a2uiMeta":{"note":"…","trace":{…}}}`):

```ts
interface TurnTrace {
  turnIndex: number
  query: { intent: string; k: number }      // what retrieve() was asked (produce.ts:59-61)
  exemplarIds: string[]                      // WHICH judged-shard records conditioned this turn (produce.ts:111)
  rounds: number                             // self-correct rounds taken (1 = first-try valid)
  healed: number                             // lines the shared healer corrected (produce.ts:101-105)
  failureCodes: string[]                     // validator failures fed back, if any (produce.ts:139)
  model: string                              // the authoritative model actually used (produce.ts:113)
}
```

- It lives **browser-side, parallel to `session.turns`** (a `traces: TurnTrace[]` alongside the
  `Session`), NOT inside `session.turns` (that array is the Messages-API payload the model consumes —
  polluting it changes what the model sees) and NOT on the A2UI wire. The stateless proxy (ADR-0072
  clause 4) holds nothing; the browser is the source of truth for the trace as it is for the session.
- **An explain-turn is a normal `intent` turn** — no new `TurnInput` kind; the session already carries
  full history (`agent-transport.ts:55-57`, `appendUserTurn`/`appendAssistantTurn`). Grounding is added
  by the page injecting a compact digest of the recent `TurnTrace`s (plus the retained prior `note`s —
  the model's own at-the-time rationale, which is not retroactive and so not a confabulation) as an
  additional context block for that turn, so the model cites REAL retrieved exemplars and real
  correction history rather than inventing a justification.

### 3. `wantResponse`-routed click→turn — the agent's per-action talk-back choice, back-compat by default.

`handleClientMessage` routes on the **`action` arm's** `wantResponse`:

- **`action.wantResponse === false`** (explicit opt-out) → **silent apply**: no chat entry, no
  `runTurn`, no LLM round-trip. The surface's own reactive data model (updated by the binding layer on
  input) is unaffected either way — silence means "the agent does not need to hear about this click."
- **`wantResponse === true` OR absent** → **today's path**: a full visible turn (`a2ui-live.ts:224-229`).
- **`functionResponse` and `error` arms always run a turn** — they are inherently agent-directed (the
  agent asked for the function result; an error needs cross-turn recovery, ADR-0072 clause 2).

The default is deliberately **opt-out, not opt-in**: absent `wantResponse` keeps the current behavior, so
the committed seed (`canvas-button.ts:27`) and every existing corpus action button (`dynamic-lists.ts`,
`patterns.ts`) still trigger turns and the shipped backbone demo is untouched. Which clicks talk back
becomes the AGENT's authoring decision (it already sets `wantResponse` per action, ADR-0011) — no
hardcoded client rule. The renderer's existing RPC-correlation use of `wantResponse` (register an
`actionResponse` slot — `action.ts:85-108`) is UNCHANGED; the routing is a producer/page-layer READ of
the same flag, and no `actionResponse` RPC is wired for actions in this demo, so the two readings do not
collide behaviorally.

## Open fork (Kim's call) — and the two build-time re-verify points it is *not*

This ADR feeds Kim's ruling, so the one decision that needs his judgment is stated here in one place.
Exactly **one** fork is his call; the two items an earlier draft framed as co-forks are
decided-with-a-caveat and settled by the builder empirically at build time — not open questions.

- **Fork (Kim's call) — routing default (Decision §3). RESOLVED (Kim, 2026-07-07: "opt-out").** Ship
  the **back-compat opt-out**: absent `wantResponse` keeps today's full-turn behavior and
  `action.wantResponse === false` opts a click out, so the committed seed (`canvas-button.ts:27`) +
  corpus + prompt need no re-seed. The alternative (not taken) was the **RPC-aligned opt-in** (absent
  ⇒ silent): cleaner semantics, but it breaks the shipped demo's turn-2 and forces re-seeding the
  transcript + corpus + prompt.
- **Build-time re-verify (NOT Kim's call) — trace richness.** Is the light objective `TurnTrace`
  (exemplar ids · rounds · healed · failure codes · model) enough for a grounded "why X vs Y", or must
  the prompt also teach the model to CITE it? Answered by running a real explain-turn against the built
  trace — an observation, not a ruling (see Consequences → *Stale → re-verify*).
- **Build-time re-verify (NOT Kim's call) — wire-shape upgrade timing.** The reserved meta-line is
  **decided** for v1 (no type changes); the typed transport frame is rejected as the v1 shape (see
  *Alternatives considered* / *Out of scope*). The only open thing is *when* to upgrade — triggered "if
  meta kinds proliferate", a future re-verify condition, not a choice to make now.

## Consequences

- **The conversation becomes genuinely two-way.** The chat shows what the model actually said, not a
  mechanical KIND list; the user can ask "why X vs Y" and get an answer grounded in real retrieval +
  correction history; and the agent chooses which clicks are conversational.
- **A2UI wire purity is preserved by construction.** The note/trace never reach `validateA2ui`, never
  enter `allLines`/the corpus, never touch SPEC-N3 parity — they are transport framing, filtered before
  ingest. Even a leaked meta-line is fault-isolated (no `version` ⇒ `VERSION_UNSUPPORTED`, returned not
  thrown — `dispatch.ts:76-78`).
- **`AgentTransport` consumers are undisturbed.** The interface type is unchanged; `recorded-transport`,
  `live-proxy-transport`, and `round-trip.test.ts` keep compiling. `round-trip.test.ts` drives the
  reducer directly, not through the page's routing (`round-trip.test.ts:34-46`), so the routing change
  cannot regress it; `produce-loop.test.ts` and `a2ui-live.browser.test.ts` (chrome/tabs only) are
  likewise untouched.
- **New behavior to enumerate in the LLD (honest costs):**
  - A **note-only turn** (a "why" answer with no UI change) yields the meta-line and ZERO A2UI lines —
    `produce()` must return cleanly, NOT halt-and-report (empty ≠ invalid), and the page's
    `if (turnLines.length === 0)` branch (`a2ui-live.ts:207`) must show the note, not "no further turns."
  - **In-band sniffing risk.** A leading-line convention is a mild fragility vs a typed frame; contained
    by the provably-disjoint discriminator + fault isolation, but it is a real cost of keeping the
    transport type unchanged.
  - The note is prose from a live model — **quality is not gate-covered** (consistent with ADR-0070:
    quality is authoring/curation-time; the runtime gate is deterministic-only). The recorded backbone's
    note, if authored, is committed and reviewable.
- **`wantResponse` now carries two layer-local meanings** (renderer: RPC-correlation slot; page: routing
  hint). Documented, non-colliding today, but a future renderer that wires `actionResponse` for actions
  must re-examine the overload.
- **Stale → re-verify on the build gate:** the meta-line discriminator (if a future A2UI version adds a
  versionless envelope, revisit) · the trace's content list (tune against a real explain-turn — is the
  objective trace enough, or must the model be taught to cite it?) · the routing default (if Kim later
  chooses the RPC-aligned opt-in default, the seed + corpus + prompt must be re-seeded — the one open
  fork; see *Open fork (Kim's call)* above).

## Acceptance

*(Predicates for the eventual build, if ratified — not run here; this is a design record.)*

- `produce()` with a stub provider emitting `{"a2uiMeta":{"note":"hi"}}` + valid A2UI JSONL yields the
  meta-line first then the validated lines, and a note-only stub (meta-line, no A2UI) returns cleanly
  without `ProduceHalt` — deterministic unit tests, `npm test` green, no live model.
- A read confirms the meta-line never passes `validateA2ui` and never enters the corpus path; the
  `AgentTransport.turn` signature is unchanged in the diff.
- The recorded backbone round-trip (`round-trip.test.ts`) stays green unmodified; a new page-level test
  proves `action.wantResponse === false` suppresses the turn while absent/`true` still turns.
- The derived-prompt drift gate stays green (the note instruction is in the grammar half, not the
  catalog-derived half).

## Alternatives considered

- **A typed transport frame** (`turn(): AsyncIterable<{kind:'note'|'a2ui'; …}>`) instead of a meta-line.
  Cleaner (no in-band sniffing), but it changes the SPEC-R1 typed contract and every transport
  signature + the LLD-C1 type — a wider normative surface than "minimize blast radius on existing
  consumers" wants. Recorded as the natural upgrade if meta kinds proliferate; rejected as the v1 shape.
- **Smuggle the note into an `A2uiServerMessage`** (e.g., a `Text` component or a new envelope key).
  Rejected: it would either fail the shared validator or pollute the judged corpus, violating SPEC-N3 /
  ADR-0070 clause 3 (wire purity + transport parity).
- **Rely on the model to justify retroactively** (no trace; ask "why" and let it answer from history).
  Rejected: the retrieval/heal/validate context that drove the choice is gone by explain-time (retrieve
  re-runs for the new query), so the answer would be confabulated — the exact gap this ADR closes.
- **Record the trace proxy-side.** Rejected: the proxy is stateless (ADR-0072 clause 4); a per-session
  server store contradicts the static-site demo shape. The browser holds it, as it holds the session.
- **Routing default = opt-in (`wantResponse:true` ⇒ turn; absent ⇒ silent).** Semantically aligned with
  the RPC reading, but it breaks the committed seed's turn-2 (`canvas-button.ts:27`) and regresses every
  existing action button, and forces re-seeding the transcript + corpus + prompt. Rejected as the
  default; surfaced to Kim as the one open fork (see *Open fork (Kim's call)* above — his call whether
  the cleaner semantics are worth the seed cost).

## Out of scope (this ADR)

- **Any UI for browsing/toggling the decision-trace** (a "why did you…" affordance, a trace inspector
  panel). The trace is recorded + citable; surfacing it to a power user is a follow-up.
- **A rubric for note/explanation quality** — runtime quality stays ungated (ADR-0070).
- **Multi-turn planning / agent-initiated questions back to the user** beyond the existing round-trip.
- **Any new LLM capability** beyond "also emit one leading sentence" — no tool use, no second model call.
- **Full A2A `contextId`/`taskId` on-wire conformance** (ADR-0072's deferred producer-layer concern).
- **The typed-frame transport migration** (the rejected alternative above) — deferred, not chosen.

## Build-sequencing note (indicative size, if ratified — a full decomposition is a follow-up)

Roughly, smallest→largest, files/tests touched:

1. **Meta-line envelope + guard** (new, tiny): a `readMetaLine`/`isMetaLine` pure helper + the reserved
   shape, in `tools/agent/` (near `session.ts`). New unit test.
2. **`produce()` peel+emit** (`produce.ts`): peel the leading meta-line before heal/validate; yield it
   first; handle the note-only (empty-A2UI) turn without halting. Extends `produce-loop.test.ts`.
3. **Prompt grammar** (`system-prompt.ts`, ADR-0071 grammar half): instruct the model to emit the note
   meta-line first. Drift gate unaffected (asserted).
4. **`TurnTrace` record + carry-back** (`produce.ts` assembles it; the meta-line carries it): new type,
   populated from data already in the loop. New unit assertions.
5. **Page: note render + trace hold + routing** (`a2ui-live.ts`, `check:site`): filter the meta-line in
   `runTurn`; `addMessage('agent', note ?? summarize(...))`; hold `traces[]`; inject the digest on an
   intent turn; route `handleClientMessage` on `wantResponse`. New page-level routing test.
6. **Recorded transcript optional note** (`transcript.ts`): add a note to turn-1/turn-2 so the backbone
   demo shows real prose; `round-trip.test.ts` stays green (extended to assert the note passes through).
7. **SPEC/LLD repairs** (SPEC-R8/R5/N4/§5, LLD §4/§5/C3/C5/C9) landed with the build, per this ADR's
   `Repairs:`.

The heaviest slice is (5) the page wiring; the protocol/loop changes (1–4) are additive and gate-covered
with stubs, no live model.
