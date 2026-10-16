---
id: T-0311
title: "Dev trace: content-addressed prompt store, stopReason and max_tokens per round, and the max_tokens tier floor (P3, P7)"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (P7 allowed, P3 as revised): the dev trace records what reached the model and why a round stopped. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Scope
1. A local, git-ignored content-addressed prompt store beside the dev trace: each round's composed prompt sections stored once by hash, the trace line carries the hashes (reverses `tools/agent/trace-log.ts:19`; keys and `.env` never stored).
2. `stopReason` and the request's `max_tokens` on every trace round (`TraceRound`).
3. The max_tokens tier floor: medium must not cap below unset for current-family models (`agent/providers/anthropic.ts:382-418, 524-531`); repair RTS-R9 and RTS-P3.

## Done when
- Tests for each part, red at the base; the trace and live-agent tests and `npm run check` exit 0; the fog bundle mapping can read the new fields.

## Lane bundle
- T-0309: infer flowEnd when a turn declares no ask and no surface (N1). Handoff `.sdlc/tickets/.0309-flowend-inference/handoff.md`.
- T-0310: force render_surface with thinking off on round 1 of Haiku click turns (R8). Handoff `.sdlc/tickets/.0310-haiku-round1-forced-tool/handoff.md`.
- T-0311: dev-trace prompt store, stopReason and max_tokens per round, max_tokens tier floor (P3, P7). This handoff.

verifier: L3

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-request-body.test.ts` exits 0: no effort tier caps `max_tokens` below the unset tier on any current-family model (medium 4096 on Sonnet 5.5, 5376 on Haiku 5.5); the legacy arm is unchanged.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-usage.test.ts` exits 0: each upstream request's `done` event carries `stopReason` and the body's `maxTokens`, on the text-only path and per request in the tool loop.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.ts` exits 0: each trace round records `requestId`, `runId`, `stopReason` and `maxTokens`; `routing.sections[].digest` and `rounds[].userDigest` resolve in `prompts/<digest>.txt`, written once per distinct text, redacted (no configured key value is stored), with the digest computed over the stored bytes; a live dev-proxy turn writes the store.
- (red) `npx vitest run --project scripts scripts/e2e-admin/probe/fog-round.test.mjs` exits 0: the fog bundle mapping reads one `model_request` per round with `maxTokens`, `outputTokens` and `stopReason` (the ingest leg runs where the context-fog-of-war skill is installed).
- (red) `python3 scripts/agent-traces-to-fog.py selftest` exits 0: a section digest names its prompt-store file.
- (red) `grep -q "REV 2026-10-16, T-0311" .claude/docs/spec/response-type-selection.spec.md` exits 0 (RTS-R9 and RTS-P3 repaired).
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` exits 0.
- `npm run check` exits 0.

## Conductor note for the verifier (2026-10-16)
Security: the prompt store writes composed prompt text to disk. Confirm `.agent-traces/` is git-ignored, that no key, token or .env value can be written (the solo reports redaction covers env names containing KEY, TOKEN, SECRET or PASSWORD plus key patterns, not every .env value; judge whether a value from .env can reach a prompt at all, and say so), and that the store is dev-only (never in the Worker or a shipped package).

## Outcome

2026-10-16 · lane: full L3 · verdict: closed by reason (Merged in the producer-loop rulings lane; verifier L3 pass) · verifier: verifier-L3 (fable) · base: 4c2e88ec35dd
- Changed: see commits
- Commits: none
- Check: 1 (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-request-...: pass
- Check: 2 (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-usage.te...: pass
- Check: 3 (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.t...: pass
- Check: 4 (red) `npx vitest run --project scripts scripts/e2e-admin/probe/fog-round.test.mjs` exits 0: pass
- Check: 5 (red) `python3 scripts/agent-traces-to-fog.py selftest` exits 0: pass
- Check: 6 (red) `grep -q "REV 2026-10-16, T-0311" .claude/docs/spec/response-type-selection.spec.md` exits 0: pass
- Check: 7 `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` exits 0: pass
- Check: 8 `npm run check` exits 0: pass
