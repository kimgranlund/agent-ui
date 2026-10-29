---
id: T-0552
title: "The A2UI renderer applies only catalog-declared props to rendered elements"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The A2UI renderer sets on a rendered element only the props its catalog entry declares (plus the documented common props), and ignores any other key in a component's payload.

## Intent
- Do: read `findings.md` in this ticket's artifacts dir (High section) for the exact code path; make the renderer's prop application allow-list the catalog-declared props for the component type, across initial render and updates; keep every currently declared prop working; add regression tests (jsdom and a real-browser test) that an undeclared key leaves the element untouched.
- Non-goals: media URL handling (T-0553).
- Done when: the new tests fail on base and pass after; the a2ui renderer, catalog and test-kit suites (`npm run test:a2ui-kit` and its browser leg through `scripts/gate_lock.py`) pass; `npm run check` exits 0.

## Constraints
This repo is public. Commit messages, the PR title and body, this handoff and code comments describe the change as hardening only: no exploit, payload or proof-of-concept detail. The detailed findings are in this ticket's artifacts dir (`findings.md`, git-ignored) and stay there. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)
- Lane: solo L2 with an L3 verifier because security-sensitive (Kim 2026-10-28)

## Acceptance criteria
verifier: L3
Run from the lane checkout root. Each new test file fails on base fcd4ce71b (widget.ts reverted) and passes after.
- `npx vitest run packages/agent-ui/a2ui/src/renderer/declared-props.test.ts`: undeclared keys stay off the element on the static, bound and resend paths (jsdom).
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/renderer/declared-props.browser.test.ts`: the same in Chromium and WebKit.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=4 --nice -- npx vitest run --project packages packages/agent-ui/a2ui`: every a2ui jsdom suite (renderer, catalog, testkit) stays green.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npm run test:a2ui-kit`: the test kit passes.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npm run test:a2ui-kit:browser`: the kit browser leg passes.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.40.0/scripts/gate_lock.py run --need compute_units=2 --nice -- npm run check`: the standing gate exits 0.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: fcd4ce71bfda
- Changed: The A2UI renderer applies only catalog-declared props to rendered elements
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/renderer/declared-props.test.ts`: pass
- Check: 2 `gate_lock.py run --need compute_units=2 --nice -- npx vitest run --config vitest.browser.config....: pass
- Check: 3 `gate_lock.py run --need compute_units=4 --nice -- npx vitest run --project packages packages/age...: pass
- Check: 4 `gate_lock.py run --need compute_units=2 --nice -- npm run test:a2ui-kit`: pass
- Check: 5 `gate_lock.py run --need compute_units=2 --nice -- npm run test:a2ui-kit:browser`: pass
- Check: 6 `gate_lock.py run --need compute_units=2 --nice -- npm run check`: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/renderer/widget.ts:169-174: note: a... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/renderer/renderer.test.ts:436: fix-now... -> notes.md
