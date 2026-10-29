---
id: T-0553
title: "Media sources accept only allowed schemes, and the dev proxy checks request origin"
type: bug             # feature | bug | chore | spike | idea
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
Default-catalog media sources accept only allowed URL schemes and origins, and the dev proxy's POST endpoints reject cross-origin requests.

## Intent
- Do: read `findings.md` in this ticket's artifacts dir (Medium section); add a media URL gate beside `controls/text/href.ts` and apply it to the media controls the catalog exposes; add an Origin (or equivalent) check on the dev-proxy POST branches in `a2ui/tools/agent/dev-proxy-plugin.ts`; tests for allowed and rejected cases.
- Done when: the new tests fail on base and pass after; existing media and dev-proxy tests pass; `npm run check` exits 0.

## Constraints
This repo is public. Commit messages, the PR title and body, this handoff and code comments describe the change as hardening only: no exploit, payload or proof-of-concept detail. The detailed findings are in this ticket's artifacts dir (`findings.md`, git-ignored) and stay there. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
Run from the lane checkout root.
- `npx vitest run packages/agent-ui/components/src/controls/text/media-src.test.ts packages/agent-ui/a2ui/src/live-agent/dev-proxy-origin.test.ts`: the new allowed and rejected cases pass (both files fail on base: the gate module and the proxy export do not exist there).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/components/src/controls/text packages/agent-ui/components/src/controls/image packages/agent-ui/components/src/controls/avatar packages/agent-ui/components/src/controls/video packages/agent-ui/components/src/controls/audio packages/agent-ui/components/src/controls/product-card`: existing media and dev-proxy tests pass.
- `npm run check`: the standing gate exits 0.
- Read check: each of the five media controls reads its source (and ui-video its poster) through `safeMediaSrc`; both dev-proxy POST branches sit behind `isCrossOriginDevRequest` before the body is read; no comment or test names an exploit shape.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: fcd4ce71bfda
- Changed: Media sources accept only allowed schemes with an opt-in origin list, and the dev proxy checks request origin
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/components/src/controls/text/media-src.test.ts packages/agent-u...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/components/src/controls/t...: pass
- Check: 3 `npm run check`: pass
- Check: 4 Read check: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/catalog.json: decide: the... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/text/media-src.ts:44... -> notes.md
