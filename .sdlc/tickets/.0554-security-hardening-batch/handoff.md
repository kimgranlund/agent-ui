---
id: T-0554
title: "Hardening batch: payload regex cap, frame bridge source check, harness proxy URL, worker limiter, icon pack note"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The five Low hardening items in this ticket's artifacts dir `findings.md` are fixed or documented with a reason.

## Intent
- Do: work through the Low section of `findings.md`: cap payload regex input, add a source check to the frame bridge, build the harness proxy URL from a trusted value, add a worker agent rate limit in code, and document the icon-pack trust boundary; a test per code change where practical.
- Done when: each item is fixed with a test or documented with a reason; `npm run check` and the touched tests exit 0.

## Constraints
This repo is public. Commit messages, the PR title and body, this handoff and code comments describe the change as hardening only: no exploit, payload or proof-of-concept detail. The detailed findings are in this ticket's artifacts dir (`findings.md`, git-ignored) and stay there. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
Run from the lane checkout root.
- `npm run check`: the standing gate is green.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/regex-guard.test.ts packages/agent-ui/a2ui/src/catalog/functions.test.ts packages/agent-ui/a2ui/src/catalog/a2ui-basic packages/agent-ui/a2ui/src/layering.test.ts`: both catalog `regex` dialects run through one bounded evaluation (pattern and value caps, a structural refusal).
- `npx vitest run packages/agent-ui/components/src/controls/sandbox-frame`: the frame bootstrap applies host context only from `window.parent`; the regenerated dogfood asset is fresh.
- `npx vitest run packages/agent-ui/devtools/src/server`: the harness default live target comes from the server socket address, not a request header.
- `npx vitest run packages/agent-ui/a2ui/tools/agent/worker`: `/__a2ui/agent` takes a turn from `AGENT_RATE_LIMITER` (bound in `wrangler.jsonc`) and fails closed without it.
- `npx vitest run packages/agent-ui/icons`: the icons suite stays green beside the documented trust boundary (`resolve.ts`, `types.ts`, `README.md`).

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: fcd4ce71bfda
- Changed: Hardening batch: payload regex caps, frame bridge source check, harness proxy URL, worker rate limiter, icon pack trust note
- Commits: none
- Check: 1 `npm run check`: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/catalog/regex-guard.test.ts packages/agent-ui/a2ui/src...: pass
- Check: 3 `npx vitest run packages/agent-ui/components/src/controls/sandbox-frame`: pass
- Check: 4 `npx vitest run packages/agent-ui/devtools/src/server`: pass
- Check: 5 `npx vitest run packages/agent-ui/a2ui/tools/agent/worker`: pass
- Check: 6 `npx vitest run packages/agent-ui/icons`: pass
- Follow-up: fix-now: packages/agent-ui/a2ui/src/catalog/regex-guard.ts:6 says the two... -> notes.md
- Follow-up: decide: sequential unbounded quantifiers aaaab and overlapping alternation... -> notes.md
- Follow-up: note: /__a2ui/agent now fails closed without AGENT_RATE_LIMITER... -> notes.md
