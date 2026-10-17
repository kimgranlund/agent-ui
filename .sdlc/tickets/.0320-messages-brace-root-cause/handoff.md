---
id: T-0320
title: "Root-cause the render_surface messages strings that are one brace short (ours or the model's?)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Find out whether the malformed `messages` strings are produced by the model or by our own stream assembly or tool-input handling, and fix it if it is ours (Kim 2026-10-16).

## Context
Round 8 cluster A, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): 14 of 17 strings across rounds 7 and 8 are exactly one `}` short at an updateDataModel value; one lost its `{"id":` opener. The uniformity is suspicious for model output. PARSE is now the costliest repair code (/bin/zsh.88). T-0304 (pinpoint repair, no harness repair) stays Kim's ruling for genuinely malformed model output.

## Scope
1. Trace the path from the Anthropic stream (`input_json_delta` partial_json accumulation, content_block_stop) through `providers/anthropic.ts` and the tool-input decode to `stringifiedMessages`; read the raw SSE chunks recorded in the round 7 and 8 traces or fixtures if they exist; reproduce with a recorded stream.
2. Verdict with evidence: ours (fix it, red-first test from the recorded stream) or the model's (document where the brace is missing in the raw delta, and leave T-0304's repair as the answer).

## Done when
- The verdict and its evidence are in the handoff; if ours, a test built from a recorded stream is red at the base and green after; the live-agent tests and `npm run check` exit 0.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/anthropic-terminal-tool.test.ts -t T-0320` exits 0: the recorded round 8 :305 `render_surface` input, re-streamed as `input_json_delta` fragments and cut into network chunks that split UTF-8 characters, reaches the executor byte-identical, its `messages` string still one `}` short.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0.
- `npm run check` exits 0.
- The `## Verdict` section below names the side (ours or the model's) with the evidence.

## Verdict
The model's. Our stream assembly and tool-input decode pass the string through unchanged; T-0304 (pinpoint note, no harness repair) stays the answer.

Evidence:
- Raw SSE deltas are not recorded anywhere (`git grep partial_json` finds only the adapter and tests). The trace records the `render_surface` input the executor received (`tools/agent/trace-log.ts:557`, wrapping `executeTool`), which is `JSON.parse` of the accumulated `inputJson` (`providers/anthropic.ts:862`), with `coerceObjectFields` touching only `type: object` fields (`messages` is an array field, so a string passes untouched). So the recorded string is exactly what `produce()` saw.
- The path is a plain concatenation: `inputJson += delta.partial_json` per block index (`anthropic.ts:300`), on whole SSE frames only (`stream()` buffers to the last blank line, `TextDecoder` with `stream: true`). A lost or split delta would drop a token-sized run anywhere, and would break the outer tool-input JSON as readily as the inner string. Every one of the 26 broken string rounds in rounds 7 and 8 has a well-formed outer object (it reached the executor and was traced with `reply`, `target` and `messages`).
- The same model sent byte-identical broken strings in separate API requests: r7 :16 rounds 2 and 3 (Haiku, 1046 chars, the same break at char 476) and r8 :252 rounds 1 and 2 (Sonnet, 1490 chars, break at 591). Our code cannot drop the same byte at the same place in two independent streams; a model repeating its own output can.
- Where it breaks: 20 of the 26 rounds close a message one `}` short at a bracket run (`"}}` or `]}}` before `,{"version"`, or `}]}` before the final `]`), always where a message's nested objects close (15 `updateDataModel` messages, 5 `updateComponents` messages whose last component ends in an action `context` or a bound prop); r8 :178 (both rounds) lost the `{"id":` opener of `guessBtn`; r7 :20 and r8 :120, :172, :355 break at other bracket runs (one too many, or a `]` where `}` belongs). All sit at multi-brace token boundaries, the model's counting error, not a byte loss.
- Reproduced through our path: the T-0320 test in `anthropic-terminal-tool.test.ts` re-streams the recorded r8 :305 input (Sonnet, `regress-admiral-row-sweep`) as fragments of 1 to 7 characters, cut into 13-byte network chunks that split the 3-byte `✕` and `■`, and the executor receives it byte-identical, still one `}` short at the end of message 3.

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Merged in the round 8 producer lane; verifier pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
