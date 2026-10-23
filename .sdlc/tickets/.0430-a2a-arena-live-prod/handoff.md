---
id: T-0430
title: "The A2A tic-tac-toe arena plays live matches on ui.nonoun.io"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
On https://ui.nonoun.io/a2a-tic-tac-toe a visitor presses Play and watches a real A2A match between two model seats stream move by move into the existing replay UI, isolation verdict and inspector, served by the production Worker, not only the dev proxy.

## Intent
- Do: move the arena match runner behind the dev-only `/__a2a/arena` seam (site/pages/a2a-tic-tac-toe.ts part 3, LLD-C5, SPEC-R17) onto the production Worker (packages/agent-ui/a2ui/tools/agent/worker/index.ts, wrangler.jsonc) as a streaming endpoint, with a per-visitor rate limit and a per-match token/move cap; un-gate the page's live control from `import.meta.env.DEV` so it appears whenever the Worker reports live is available; keep the recorded default, the done-on-isComplete rule and the discard-on-cancel rule.
- Non-goals: new seat models or prompts; changing the referee or isolation checks.
- Done when: a keyless test drives the Worker endpoint with a scripted seat pair and the page completes a streamed match through the same loadTranscript path; the rate limit and cap are tested; npm run check plus the touched folders' tests pass; one manual live match on the deployed site is Kim's call (spend).

## Context
Kim 2026-10-23: "can we show the A2A real time game play?" and chose live matches on prod (model spend per match, behind a rate limit and cap). Today the live path is tree-shaken out of the static build (SPEC-N2); live chat already runs through the same Worker with its key (ADR-0073 trust boundary at /__a2ui/agent).
Decomposition: decompose/report.md (in the run records folder).
New tools-only import edge: `a2ui/tools/agent/worker` -> `a2a/tools/arena` (the Worker route imports the shared core `live-match.ts`). Neither layering gate polices it (a2ui/src/layering.test.ts scans tools only for planted.ts; a2a/src/layering.test.ts globs src only); the reverse edge `a2a/tools` -> `a2ui/tools` already existed.
Deploy steps outside the repo (Kim): `wrangler deploy` (it creates the `ARENA_RATE_LIMITER` binding, namespace_id 4300; confirm that id is unused in the account); extend the ADR-0152 zone Rate Limiting Rule from `/__a2ui/agent` to `/__a2a/arena`; set an Anthropic workspace spend limit on the Worker's key (the only bound on total spend across visitors); then one manual live match on https://ui.nonoun.io/a2a-tic-tac-toe and a second press within 60 s, which should answer the one-a-minute message (429).

## Constraints
Keys never reach the browser or devtools (ADR-0073); the new endpoint sits on the Worker beside /__a2ui/agent. Isolation stays provable: each seat's context is still server-assembled and the canary and wire audit still run on the live transcript. No live spend in tests. ADRs are frozen: decisions go in this ticket.

## Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2a/src/arena-agent/live-match.test.ts` exits 0: the arena seat allowlist (claude-opus-5-5 is a 400), key and workspaceId resolution, the per-seat call and reply caps ending in a provider-error forfeit, maxTokens on every call, header first, lines that validate and check isolation clean, and abort or deadline writing no game end.
- `npx vitest run --project packages packages/agent-ui/a2a/src/arena-agent/model-seat.test.ts` exits 0, including the maxTokens leg.
- `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/arena-route.test.ts` exits 0: gate order (403 before the limiter, 429 before the body read, 503 with no limiter), a full streamed match that validates and checks isolation clean, cancel reaching the in-flight provider call, and a shared leaky provider failing the isolation gate.
- `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/worker-bundle.test.ts` exits 0, including the bundled `/__a2a/arena` leg with no limiter bound.
- `npx vitest run --project site site/pages/a2a-tic-tac-toe.live.test.ts site/pages/a2a-tic-tac-toe.test.ts` exits 0, including the Worker-route-backed page leg and the DEV-gate trip-wire.
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/a2a-tic-tac-toe.browser.test.ts` exits 0.
- `test -f packages/agent-ui/a2a/tools/arena/dev-proxy-plugin.ts && ! grep -q 'resolvePair' packages/agent-ui/a2a/tools/arena/dev-proxy-plugin.ts` exits 0.
- `grep -q ARENA_RATE_LIMITER wrangler.jsonc` exits 0.
- `test "$(grep -c 'T-0430' .claude/docs/spec/a2a-foundations.spec.md)" -ge 3` exits 0.
- `npm run check` exits 0.

## Debate
- Architect ask (2026-10-23): design the production live arena end to end: Worker endpoint shape and streaming, how the dev proxy's runner and seats move or are shared, the rate limit and cap (where state lives on Cloudflare), the page's live probe and control without import.meta.env.DEV, what SPEC-N2 and SPEC-R17 text must change, tests, and risks (abuse, cost, isolation).
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21
- Plan-reviewer ask (2026-10-23): challenge architect-L1.md: is the shared live-match core plus Worker and dev adapters sound, do the allowlist, rate limiter (fail closed) and per-match caps really bound cost and abuse, does isolation stay provable on the live path, are the page un-gating and SPEC/LLD amendments right, and are the keyless tests sufficient; replay what you can and report pass, replan or blocked.
- Plan review 2026-10-23: pass (plan-reviewer-L1.md); builder follows its notes-fixes (n7 trip-wire form, n8c fetch stub, n4a limiter-first /status, n9 doc re-sync list, n3 criterion).

## Outcome

2026-10-23 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: b1646add4286
- Changed: The A2A arena plays live matches on ui.nonoun.io through the Worker, Sonnet and Haiku only, one match per visitor per minute, capped per match
- Commits: none
- Check: 1 `npx vitest run --project packages packages/agent-ui/a2a/src/arena-agent/live-match.test.ts` exits 0: pass
- Check: 2 `npx vitest run --project packages packages/agent-ui/a2a/src/arena-agent/model-seat.test.ts` exit...: pass
- Check: 3 `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/arena-route.test.ts` ex...: pass
- Check: 4 `npx vitest run --project tools packages/agent-ui/a2ui/tools/agent/worker/worker-bundle.test.ts` ...: pass
- Check: 5 `npx vitest run --project site site/pages/a2a-tic-tac-toe.live.test.ts site/pages/a2a-tic-tac-toe...: pass
- Check: 6 `npx vitest run --config vitest.browser.config.ts --project site site/pages/a2a-tic-tac-toe.brows...: pass
- Check: 7 `test -f packages/agent-ui/a2a/tools/arena/dev-proxy-plugin.ts && ! grep -q 'resolvePair' package...: pass
- Check: 8 `grep -q ARENA_RATE_LIMITER wrangler.jsonc` exits 0: pass
- Check: 9 `test "$(grep -c 'T-0430' .claude/docs/spec/a2a-foundations.spec.md)" -ge 3` exits 0: pass
- Check: 10 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl:11 decide... -> T-0434
- Follow-up: decide: packages/agent-ui/a2ui/tools/agent/worker/arena-route.ts:108... -> notes.md
