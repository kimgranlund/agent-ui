# ADR-0072 — the multi-turn session: a client message (action | functionResponse | error) becomes the next turn's user input; a stateless proxy; surface continuity via the existing host

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | planner (design seat — the live-agent intake, NEXT item 3) |
> | **Ratified by** | orchestration-coordinator + Kim ("proceed", 2026-07-04) — green gates: coverage --strict · adr_check 5/5 · harness spec/lld 3/3; all 3 independent doc-reviews GO |
> | **Repairs** | `a2ui-live-agent.spec.md` (the round-trip requirement + session contract) · `a2ui-live-agent.lld.md` §4 (the round-trip state machine + the session reducer) |
> | **Supersedes / Superseded by** | Relates ADR-0069 (the `AgentTransport` seam the turns flow through) · ADR-0031/0011/0034 (the client→server envelopes — `action` / `error` / `functionResponse` — that become the next turn's input) |

## Context

"The agent continues" is the rung's payoff: the human interacts with a rendered surface, a client
message returns, and the agent produces the next surface. The renderer host already emits those client
messages — `onClientMessage` yields an `action` (a triggered Button, with `dataModel` when
`sendDataModel`), a `functionResponse` (a server-initiated `callFunction` result), or an `error`
(ADR-0031). What is undesigned is how that output becomes the model's NEXT input, where session state
lives, and how the next surface relates to the current one.

The renderer already supports surface evolution: a re-`createSurface` with a live id replaces it, and
`updateComponents`/`updateDataModel` to an existing surface patch it in place. So "the agent continues"
can either replace the screen or update it — the host handles both; the session model just has to feed
the loop.

Upstream A2A DOES define the continuity shape — **host-verified (2026-07-04):** an A2A `Message`
carries `messageId` / `contextId` (the conversational-session group) / `taskId` (the ongoing task);
`TASK_STATE_INPUT_REQUIRED` is the non-terminal interrupt ("the agent requires additional user
input"); the client resumes by sending a normal `SendMessage` whose `Message` echoes the same
`taskId` + `contextId` — there is NO separate resumption envelope. So this ADR's session model has a
CONFORMANCE TARGET to cite, not invent; the design keeps the turn-framing in the demo's producer layer
so full A2A id-conformance is a future concern that never touches the renderer.

## Decision

**A session is the standard Messages-API turn array; a client message is framed as the next user turn;
the proxy is stateless; the surface continues via the existing host.**

1. **Session = ordered turns.** A `Session` is a list of turns: `user` = the intent (turn 1) or a
   framed client message (later turns); `assistant` = the emitted A2UI stream (the JSONL the agent
   produced). This IS the message array the model consumes — no bespoke session object.

2. **A client message becomes a framed user turn (the reducer).** A pure reducer maps
   `(session, clientMessage) → the next Turn's user content`:
   - **`action`** → "the user triggered action `<name>`" + its `context` + the `dataModel` when the
     action carried it (`sendDataModel` / `wantResponse`).
   - **`functionResponse`** → the awaited value for the `callFunction` the agent issued (the RPC
     round-trip, ADR-0034).
   - **`error`** → the validation failure, fed back so the agent can self-correct on the NEXT turn
     (distinct from the intra-turn deterministic loop of ADR-0070 — this is cross-turn recovery).
   The reducer is pure + zero-dep, so it is unit-gate-covered and reusable by the page.

3. **Turn N+1 continues the surface via the host.** The next payload targets the SAME `surfaceId`
   (`updateComponents` / `updateDataModel` patch — the agent evolves the screen in place) or a new
   surface — both already handled by `createRenderer()`; the session model adds no renderer change.

4. **The proxy is stateless per request.** The browser holds the turn history and sends it (or the
   framed delta) with each turn; the proxy reconstructs the Messages-API call from what the client
   sends and holds only the key + the corpus. No server session store — the right shape for a
   static-site demo.

5. **A demo-level max-turns cap guards runaway.** Each generation is itself bounded (ADR-0070's
   `maxRounds`); the session adds a max-turns ceiling so an agent that keeps emitting can't spin the
   demo indefinitely. The state machine is explicit:
   `idle → generating(turn N) → streaming → awaiting-interaction → (client message → reducer) →
   generating(turn N+1) → …`, halting at the cap.

## Consequences

- **The round-trip is provable deterministically.** The recorded transcript's turn-2 is exactly what
  the reducer produces from turn-1's client message; the backbone gate (ADR-0069) drives that path
  with no model, asserting the framing and the surface update.
- **The renderer is untouched.** Session/turn logic is producer-layer (tools/site); the host's public
  surface (`ingest`/`mount`/`onClientMessage`/`finalize`/`dispose`) already suffices.
- **Cross-turn error recovery composes with intra-turn validation** — a runtime error surfaces as a
  client `error`, which the reducer feeds back as the next turn, distinct from the deterministic
  self-correct loop within a single generation (ADR-0070).
- **A2A continuity is the cited conformance target (host-verified).** A2A's `contextId`/`taskId` +
  `TASK_STATE_INPUT_REQUIRED` (resume via a normal `SendMessage` echoing `taskId`+`contextId`) is the
  shape the producer-layer session conforms toward; the demo's browser-held turn array is compatible,
  and full id-conformance is a future producer-layer concern that never touches the renderer.
- **Stale → re-verify on the build gate:** the reducer's client-message framing (as the A2UI client
  envelopes evolve — ADR-0031/0011/0034) · the max-turns cap (a live-run tuning knob) · the A2A
  id-conformance mapping if/when the producer layer adopts `contextId`/`taskId` on the wire.

## Acceptance

- The reducer (pure, zero-dep) frames each client-message arm distinctly; a unit test proves an
  `action`, a `functionResponse`, and an `error` each produce a distinct next-turn user content;
  `npm test` green.
- The backbone round-trip gate drives the committed transcript through `createRenderer()` + the
  reducer: turn-1 renders, a simulated interaction emits the expected client message, the reducer
  frames it, and turn-2 ingests + updates the surface — deterministic, no key/network.
- A read confirms the proxy holds no per-session server state (the browser sends the turn history).

## Alternatives considered

- **A stateful proxy with a server session store.** Rejected: needless server state for a static-site
  demo; a stateless proxy that reconstructs from the client-held history is simpler and matches the
  no-server constraint.
- **A bespoke on-wire session envelope invented by the demo.** Rejected: A2A is now host-verified to
  define the continuity shape (`contextId`/`taskId`/`TASK_STATE_INPUT_REQUIRED`), so the demo conforms
  toward it rather than inventing one; full id-conformance is deferred to the producer layer, never
  touching the renderer.
- **Only single-turn (no round-trip).** Rejected: it drops the rung's entire payoff — "the agent
  continues"; a rendered surface that can't feed the agent back is a screenshot, not a live agent.
