# A2UI protocol + JSONL producer: portable knowledge export

- Date: 2026-10-03
- Scope: A2UI protocol and catalog (wire, six envelopes, versioning, validation, conformance, multi-catalog, wire tolerances); JSONL streaming and producer (framing, validate-then-stream, structural resend, reveal order).
- Method: mined the 2026-10 scratchpad findings (claim-audit, code-history, decisions), then ADRs and code; every [verified] claim re-read against current code on 2026-10-03 and revised after an independent check; packs read at /plugins/agent-protocols/skills (refreshed 2026-08-23). Anything not re-read is [inferred]. Evidence cites symbols, not line numbers, except where a pack quote itself carries a line.
- Vocabulary note: the packs use the Candidate names (`callRendererFunction`, `rendererOnly`/`agentOnly`/`rendererOrAgent`); agent-ui's literal wire is `callFunction`, `functionResponse`, `clientOnly`/`remoteOnly`/`clientOrRemote`. Lessons below use the agent-ui literals; where a lesson turns on a name, the pack's name is given alongside.
- Overlap with the sibling export (`harness-corpus-export.md`) and the 2026-08-17 harvest (`../knowledge-harvest-2026-08-17/llm-pack-export.md`): each lesson lives in one file; cross-refs are listed at the end.
- Counts: 17 lessons. By pack: protocol 9, catalog 5, chat-agent 2, llm-streaming 1. By status: NEW 10, UPDATE-stale 4, ALREADY 3.

Shape per lesson: claim · evidence · date · confidence · target (pack/reference) · status.

## A. a2ui-protocol-facts

1. The wire is JSONL, one envelope per line, a `version` key plus exactly one message-kind key. Six server-to-client kinds: createSurface, updateComponents, updateDataModel, deleteSurface, actionResponse, callFunction (pack: callRendererFunction). · `MESSAGE_KINDS` in `renderer/validate.ts` (parity with `DISPATCHED_ENVELOPE_KEYS` in `dispatch.ts`) · 2026-10-03 · [verified] · message-lifecycle.md · ALREADY (names differ, see vocabulary note).

2. Internal error taxonomy now has 10 codes (DEPTH_EXCEEDED and CONTAINMENT were added); the wire contract stays two codes (`VALIDATION_FAILED` + `surfaceId`, `INVALID_FUNCTION_CALL` + `functionCallId`), mapped at the single `toWireError` boundary. · `protocol.ts` ErrorCode union, `toWireError` · 2026-10-03 · [verified] · errors-and-versioning.md · UPDATE-stale: "Internal `ErrorCode` (8 codes, `protocol.ts:16-24`)" and "All 8 internal codes → `VALIDATION_FAILED`". Source drift to know: a doc comment near `toWireError` in `protocol.ts` still says "9 codes"; trust the union.

3. Render depth is capped (`MAX_RENDER_DEPTH = 64`) and Card region rules are a validator check (CONTAINMENT); both are structural validate-time failures, not render-time surprises. · `protocol.ts` MAX_RENDER_DEPTH; `checkContainment` in `renderer/validate.ts` · 2026-10-03 · [verified] · errors-and-versioning.md · NEW.

4. `createSurface.surfaceProperties` is no longer a field of the wire type (`A2uiCreateSurface` has none; the renderer reads no such field); the drop is a ruling (GH #477, 2026-08-06). The pack row already notes upstream removed it, but its field list still shows `surfaceProperties?`, which misleads an implementer copying the type. Fix the field list; do not claim tolerant inbound handling, the cited code does not show it. · `A2uiCreateSurface` in `protocol.ts`; `renderer.ts` createSurface handling · 2026-08-06 · [verified] · message-lifecycle.md · UPDATE-stale: "`createSurface` | `{surfaceId, catalogId, surfaceProperties?, theme?, sendDataModel?}`".

5. One shared, pure, total validator (`validateA2ui`) serves the renderer, the producer's self-correct loop and corpus admission, so verdicts are identical. It takes an `atFinalize` option: a turn-end-only judgment (ADR-0187) that is OFF mid-stream. · `validateA2ui` header and `atFinalize` branches in `renderer/validate.ts`; ADR-0187 · 2026-09 · [verified] · message-lifecycle.md or new validation.md · NEW.

6. Session seeds: prior turns' components are merged into the validator's judged graph so an update that references an earlier-turn id passes, matching the renderer's cross-turn guard (ADR-0128). Without seeds a multi-turn producer sees false orphan errors. · `produce.ts` (`validateA2ui(output, catalog, sessionSeeds, {atFinalize:true})`); ADR-0128 · 2026-09 · [verified] · validation.md · NEW.

7. Id-graph checks (orphan, cycle, duplicate root) live in one function and run per message batch; root is declared once and scene swaps are done by new surfaces, there is no node-delete verb. · `checkIdGraph` in `renderer/validate.ts` · 2026-10-03 · [verified] · message-lifecycle.md · ALREADY (2026-08-19 UPDATE sections).

8. Structural resend: when a container record is resent whole, the renderer reconciles children by id (create/wire split, per-node scope); survivor reorder was deferred. A renderer that only upserts-by-id leaves stale children. · ADR-0128; `renderer/tree.ts` · 2026-08 · [verified] · message-lifecycle.md · NEW.

22. Wire tolerances are a registry, not ad-hoc branches: every accepted-but-non-spec shape (Postel-style leniencies, a narrowing, a harness-only allowance) must be a registered row with an owner, so tolerance never grows unrecorded. · `.claude/docs/references/wire-tolerances.md`; ADR-0169 cl.10 · 2026-08 · [verified] · errors-and-versioning.md · NEW.

## B. a2ui-catalog-facts

9. Enum membership is enforced: a literal not strictly `===` to a listed member fails CATALOG, checked before the `type` dispatch; object-valued enum members are out of scope. · enum branch of `matchesSchemaType` in `catalog/conformance.ts`; ADR-0098 · 2026-08 · [verified] · security-allowlist-and-conformance.md · ALREADY: the pack already marks its old "enum NOT enforced" bullet FALSIFIED by ADR-0098 (dated 2026-08-19). Line refresh only: the pack cites `conformance.ts:119-124`, now 151-156.

10. `PropDef.rejectFunctionCall` narrows an action prop: an object value with an own `functionCall` key fails CATALOG (client-side-execution Action arm). Only that one key, only when the PropDef opts in; no general object-shape descent. The `admit.ts` comment that FUNCTION is render-time-only is still true (this rejection emits CATALOG, not FUNCTION). · `rejectFunctionCall` branch in `catalog/conformance.ts`; ADR-0169 E7 row; GH #429 (closed 2026-08-05) · 2026-08 · [verified] · security-allowlist-and-conformance.md · NEW.

11. `PropDef.required` (key presence, GH #1189) and `PropDef.requires` (cross-prop presence, ADR-0226) are opt-in and report at the MISSING key's path; a `{path}` or `{call}` binding satisfies presence; values are never checked. · required/requires loops in `catalog/conformance.ts` · 2026-09 · [verified] · security-allowlist-and-conformance.md · NEW.

12. A default catalog ships five functions (`required`, `email`, `regex`, `ping`, `formatCurrency`), not three. · `catalog/default/catalog.json` functions block · 2026-10-03 · [verified] · functions-and-checks.md · UPDATE-stale: "default catalog ships three functions" (pack line 54, "exactly three").

13. Multi-catalog authority: the server-selected `catalogId` is authoritative and fail-closed (ADR-0169 cl.3/4); a producer must stamp it on createSurface rather than trust the model's literal (`stampCreateSurfaceCatalogId`, applied after heal and before validate), so a model that guesses another catalog cannot mis-stamp a surface; retrieval is catalog-scoped. The ADR-0170 picker is a single-select library entry kind and amends ADR-0169 cl.6. `catalogId` is a short local id with canonical-URI alias inbound (cl.13). · ADR-0169, ADR-0170; `stampCreateSurfaceCatalogId` in `produce.ts` · 2026-08 · [verified] · interop-patterns / multi-catalog reference · NEW (owner for the stamping lesson).

## C. a2ui-chat-agent-facts (producer)

14. Producer order per round: peel meta-line, peel genui lines, heal per line, stamp catalogId, validate, then stream only validated lines. Bounded rounds (ADR-0070 maxRounds); self-correct hints are static plus `expectedTypeNote`. · `produce.ts`; `corpus/heal.ts` · 2026-10-03 · [verified] · produce-loop.md · UPDATE-stale (and UPDATE-of 08-17 #1 validate-then-stream and #14 peel-before-validate): file cites `tools/agent/produce.ts`, the `messagesFor` directive "(`produce.ts:68-79`)", and omits peel/stamp/seeds/atFinalize. Path is now `packages/agent-ui/a2ui/src/agent/produce.ts`. Also: SUPPORTED_VERSIONS is `{'v1.0','v0.9.1'}`; the pack cites a line number that has drifted, cite by symbol.

18. Progress meta-lines are opt-in and output is byte-identical when absent; `progressDetail` modes (`stages`, `full`, `source`) are independent and capped; `interleaveProgress` races progress against validated lines. · progress kind in `meta-line.ts`; `produce.ts` · 2026-09 · [verified] · produce-loop.md · NEW.

## D. llm-streaming-facts

20. `revealOrder` is an opt-in, default-OFF top-down sibling hold (arrival order vs declared order); default stays greedy (each id reveals the instant its data lands, via `#pendingParents`). A hold that never lifts is a bounded regression, hence opt-in. · ADR-0194; `renderer.ts` revealOrder handling; `renderer/tree.ts` · 2026-08-16 · [verified] · streaming-render-reveal-and-anchors.md · NEW.

## Cross-refs (lesson owned by the sibling export)

- Produce-layer-only codes, NET_NOOP and FLOW_END_MISSING one-round corrections: `harness-corpus-export.md` H-L5.
- Meta-line arms, each validated as a whole and dropped alone (update of 08-17 #13): H-L8.
- Ask integrity, whole-degrade (update of 08-17 #17): H-L4.
- Stamping the catalogId at the producer: owned here (13); H-L6 points back.
- Enum membership and `rejectFunctionCall`: owned here (9, 10); H-L16 points back.

## Contradictions (priority)

1. Error code count: pack says 8, code has 10 (lesson 2).
2. createSurface field list shows `surfaceProperties?`; removed by GH #477 (lesson 4).
3. produce-loop.md describes a pre-2026-08 producer (old path, `messagesFor`, no peel/stamp/seeds/finalize), and the meta envelope `{note?, ask?, trace?}` is stale (lesson 14, H-L8). Also default catalog function count 3 vs 5 (lesson 12), and enum line citations (lesson 9).
4. Falsified ADR-0072 cl.5 (cross-turn cap, named session state machine): see `harness-corpus-export.md` H-L1; do not export it as fact.

## Excluded from this revision (dev-process or renderer-internal, not portable)

- Repo-skill line drift and the review-agent rename.
- Mini-skill registration, bad-provider-key /status fix, the corpus-genui B3 judged eval (agent-ui internal).
- Devtools package and SUPERSEDED-surface bookkeeping; the harness export owns what generalizes.
- Worktree, gating and ADR-ratification mechanics.
- Cut after the independent check: `mutate` draft-first authoring helper (agent-ui renderer sugar, previously misdescribed), healer-saturation trap (no cap found in `heal.ts`), the merged ask-integrity item (now H-L4).

Tally: 17 lessons · NEW 10 (3, 5, 6, 8, 10, 11, 13, 18, 20, 22) · UPDATE-stale 4 (2, 4, 12, 14) · ALREADY 3 (1, 7, 9).
