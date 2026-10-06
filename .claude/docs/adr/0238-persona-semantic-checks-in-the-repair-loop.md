# ADR-0238 — A persona may declare semantic checks that produce() runs after structural validation, feeding the existing repair round

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-06 |
> | **Proposed by** | the sdlc-lite solo run `croupier-hand-consistency` (T-0016), from the GH [#1795](https://github.com/kimgranlund/agent-ui/issues/1795) live evidence `evidence-dealer-17` |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-06, ratified by Kim in the sdlc-lite session (AskUserQuestion) |
> | **Repairs** | [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) Definitions (`Semantic check`), SPEC-R4 (one paragraph and AC3), the typed contract (`ProduceDeps.semanticChecks`, the check types) · [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) SPEC-R1 (the manifest may declare checks) · [`../lld/a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) LLD-C15 (new), §2, §5 and §6 · [`../references/agent-model.md`](../references/agent-model.md) §3 (the `semantic check` glossary entry) · skills: `.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield.md` (step 7), `.claude/skills/a2ui-multi-catalog/SKILL.md` (pattern 5), `.claude/skills/a2ui-prompt-authoring/SKILL.md` (Triage) · `packages/agent-ui/a2ui/AGENTS.md` (`## Wire and validator spine`) · code: `packages/agent-ui/a2ui/src/catalog/semantic-check.ts` (new), `src/catalog/compose.ts` (`PersonaCatalogManifest.semanticChecks`, `semanticChecksForCatalog`), `src/catalog/personas/croupier/checks.ts` (new), `src/catalog/personas/croupier/manifest.ts`, `src/agent/produce.ts`, `tools/agent/chat-validation.ts` (`semanticChecksDeps`), `tools/agent/dev-proxy-plugin.ts`, `tools/agent/worker/index.ts` |
> | **Supersedes / Superseded by** | none · relates [ADR-0070](./0070-a2ui-live-runtime-loop-scope.md) (the deterministic gate stays the whole runtime verifier: a semantic check is a deterministic, declared function, never a model-graded round) · relates [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the FEED_SCOPE gate is the precedent for a produce-layer check after the shared validator) · relates [ADR-0172](./0172-persona-catalog-composition-intake.md) (the persona fragment and its server-safe manifest are where a persona declares checks) · relates [ADR-0187](./0187-validator-finalize-signal.md) (the round's payload is the turn's complete payload, which is what makes a whole-hand judgment sound) |

## Context

GH #1795's live Croupier, running on Haiku, rendered a blackjack round whose dealer zone listed three
cards, 6, 5 and 3, under a readout that said "Dealer: 14, draws to 17", and a result line that said
"You win: 19 beats 17". No fourth card existed and nothing was orphaned. The renderer was faithful to the
payload, and the shared validator accepted it: every component was a catalog type with legal props, and
every id resolved against the session's earlier turn. The payload was structurally valid and
self-contradicting.

The validator cannot catch this, by design. It judges structure (wire shape, catalog membership, the id
graph, finalize completeness), never what a payload means in a domain. The prompt can teach the shape
that makes the contradiction impossible (a hand as a data-model list drawn by one templated Row, the
total computed from that list), and this run does teach it (`card-layout`, `game-table-chrome`), but
teaching is advice: a smaller model still emits static cards and a free-text total. The only
self-correct path `produce()` has today is the validator's failures, so a contradiction the validator
cannot see always ships.

Two produce-layer checks already run after the validator: FEED_SCOPE (ADR-0097, an exact set-membership
partition, a violation retries and halts on exhaustion) and NET_NOOP (GH #1142, one correction round, then
ship with a tally). Each is hard-coded in `produce.ts`. Nothing lets a persona that knows its domain add a
check of its own.

## Decision

1. **The hook.** A persona MAY declare `semanticChecks: readonly SemanticCheck[]` on its server-safe
   `PersonaCatalogManifest`. A `SemanticCheck` is `{id, check(input) => SemanticFinding[]}`: pure,
   synchronous, DOM-less and node-free (both server hosts import the manifest). Its input is one
   `SurfaceView` per surface the round's payload creates or updates: the component graph and the data
   model merged over the session's prior assistant turns, the renderer's own replay (create resets,
   delete drops, components upsert by id, data writes at a pointer). A surface the round does not touch
   is never judged, since the model cannot repair history. A finding is `{code, path, message}`: an upper
   snake case code, a `<surfaceId>:<where>` path, and one model-facing sentence naming the contradiction
   and the repair. The contract lives in `src/catalog/semantic-check.ts`, beside `compose.ts`, because no
   module outside `src/agent/` may import from it (ADR-0137).
2. **Resolution.** Both hosts resolve the checks for the catalog `selectCatalog` CHOSE, never the raw
   client id (`semanticChecksForCatalog`, through the shared `semanticChecksDeps`), and pass them as
   `ProduceDeps.semanticChecks`. A derived `<base>--<persona>` id resolves to that persona's checks; a base
   id, an unknown id, or a persona that declares none resolves to none, and the deps object is then
   byte-identical to before this hook.
3. **Placement and bound.** `produce()` runs the checks on a round whose payload has passed the shared
   validator and the FEED_SCOPE gate, before NET_NOOP and ask integrity. A finding is a self-correct round,
   fed back through the existing feedback turn with its sentence appended (`CODE at path: message`) and one
   shared hint; rounds are spent while any remain, bounded by `maxRounds`. On the LAST round a finding
   never halts: the structurally valid payload ships and the trace tallies `SEMANTIC_UNCORRECTED`. A check
   that throws is skipped (fail-open) and tallied `SEMANTIC_CHECK_ERROR`. Codes ride
   `TurnTrace.failureCodes` like every produce-layer code and never join the protocol's `ErrorCode` union.
   No new wire format: the finding sentence reaches only the model.
4. **Default off.** No declared checks means `produce()` builds no view and calls no check: the stream,
   the provider requests and the trace are byte-identical, held by `produce-semantic-checks.test.ts`.
5. **The first check.** The Croupier declares `croupier-hand-consistency` (`checks.ts`) for the `dealer`
   and `player` hands: `HAND_TOTAL` (every number a total readout states, the data-model value at
   `/<p>Total` or a component with id `<p>Total`, is a blackjack total of the cards the hand shows: A as 1
   or 11, J/Q/K as 10, a face-down card counted or not) and `HAND_COUNT` (a hand listed at `/<p>Hand`
   renders exactly that many cards). Narration such as a result line is never parsed.

## Consequences

- The GH #1795 evidence is repaired before it paints: in the keyless scripted test the evidence fails
  `HAND_TOTAL at table-3:dealerTotal`, the model sees "states 17, but the dealer's cards in dealerCards
  (6, 5, 3) total 14", and the corrected round streams with `trace.rounds === 2`.
- A turn that trips a check costs one more provider request per round spent, the same price any
  validator failure already pays. The tally makes a hot check observable on the trace (SPEC-N4), and the
  agent-behavior eval reads `rounds` and `failureCodes` already.
- A domain check is a heuristic. The Croupier's readout rule ("every integer counts") will flag a readout
  that mixes a total with another figure ("Total: 19 (bet 50)"). The teaching asks for the total only,
  and the ship-and-tally bound means a false positive costs rounds and a tally, never a turn.
- The surface the user sees after an uncorrected finding is the same contradiction as before this ADR,
  now counted. The hook narrows the gap; it does not prove semantic validity.
- Checks run in the server process on every turn of that persona; they are synchronous and walk one
  merged view per touched surface, so the cost is linear in the touched surfaces' component count.
- The `agent-behavior` eval's `observeTurn` builds its own `ProduceDeps` and does not wire checks yet, so
  its persona leg still measures the unchecked loop.

## Alternatives considered

- **Halt on exhaustion, the FEED_SCOPE posture**: rejected because FEED_SCOPE is an exact partition with
  no judgment in it, while a domain check is a heuristic. A halting heuristic turns every false positive
  into a stalled game that no retry fixes until the prompt changes. A future exact check that needs a halt
  would earn a per-check field, not this default.
- **Extend `validateA2ui`**: rejected because the shared validator is the one structural judgment the
  renderer, corpus admission and `produce()` share (SPEC-N3, no fork). Domain meaning is per persona and
  belongs to the persona, not to every caller of the validator.
- **Teaching only**: rejected as the whole answer: the evidence came from a model that had the teaching
  that hands should be templated and still emitted static cards. Teaching lowers the rate; the check
  catches what is left. This ADR ships both.
- **Declare checks in a separate registry, not on the manifest**: rejected because the manifest is
  already the persona's server-safe declaration that both hosts read, and a second list would be a second
  place to forget. The `a2ui` package's `sideEffects` allowlist lets the pure check module tree-shake out
  of a renderer-only bundle.
- **A meta-line or wire field carrying findings to the client**: rejected because a finding is repair
  feedback for the model, and a client has nothing to do with it. The trace's existing `failureCodes`
  already reports what happened.
- **Run checks on every surface in the session**: rejected because a finished round is history the model
  cannot change, so a finding there would burn every remaining round for nothing.
