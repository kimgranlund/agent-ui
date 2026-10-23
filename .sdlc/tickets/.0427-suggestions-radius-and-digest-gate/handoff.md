---
id: T-0427
title: "Suggestions chips honor data-radius and the Worker bundle digest header has a test"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Suggestions chips take their radius from the data-radius cascade like other pill controls, and the Worker's bundle digest header is pinned by a test.

## Context
From the 2026-10-23 notes triage (verified still true against main):
- notes.md:566: decide: `packages/agent-ui/components/src/controls/suggestions/suggestions.css:38` hard-codes the chip radius at h/2, so `ui-suggestions` chips ignore `data-radius`; `pill-radius` is now a lower bound and passes them (builder flagged it too).
- notes.md:288: decide: the Worker's `x-agent-bundle-digest` header (`worker/index.ts:227-229`, `:396-399`) has no behavioral or structural test; the Worker is not importable under vitest, and a node/vite-runner import of it also fails on the Wrangler-only raw imports. Parity rests on the shared `bundleFromWire`/`bundleDigest` plus the code read above. A structural gate like `chat-route.test.ts:232` would pin it.

## Constraints
Default look at regular radius unchanged; trust boundary unchanged (ADR-0073).

## Done when
npm run check plus the touched folders' tests pass; no em dashes in added lines.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 00837f149b62
- Changed: Suggestions chips honor data-radius and the Worker bundle digest header has a test
- Commits: none
- Check: 1 npm run check plus the touched folders' tests pass; no em dashes in added lines: pass
- Follow-up: note: packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts:274 the... -> notes.md
