---
id: T-0320
title: "Root-cause the render_surface messages strings that are one brace short (ours or the model's?)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
