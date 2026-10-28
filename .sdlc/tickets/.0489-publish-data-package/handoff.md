---
id: T-0489
title: "The release publishes @agent-ui/data, so @agent-ui-kit/app installs (its data dependency 404s on npm)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The release publishes `@agent-ui/data` as `@agent-ui-kit/data` before `app`, so `npm install @agent-ui-kit/app` resolves every dependency.

## Context
Found by T-0487. `@agent-ui-kit/app@0.1.0` on npm depends on `@agent-ui-kit/data@^0.1.0`, and `npm view @agent-ui-kit/data` is E404. `scripts/publish/publish-packages.mjs:72` `PACKAGE_ORDER` is `['shared','icons','a2a','components','router','code','a2ui','app']`, without `data`. `packages/agent-ui/data/package.json` depends only on `@agent-ui/components`. `README.md:15-16` says `data` was never published. Kim ruled 2026-10-28: publish data too. Kim has not yet published 0.2.0; this lands before that.

## Constraints
Add `data` after `components` in the publish set and give it the same npm metadata the other packages get (keywords flavor, files, build output) as the script expects. Bump `data` to 0.2.0 with the others. Update README and CHANGELOG release lines and `.github/release-notes/v0.2.0.md` to say nine packages. Never publish, tag or push. No em dashes.

## Done when
- The publish script's dry run packs nine packages including `data`, and the packed `app` manifest names `@agent-ui-kit/data` at the version being published.
- `npm run check` plus the publish script's tests pass.

## Acceptance criteria
- `PACKAGE_ORDER` in `scripts/publish/publish-packages.mjs` lists `data` before `app` and after `components`.
- The script's dry-run or pack mode (whatever T-0460 used) exits 0 and its output names a `@agent-ui-kit/data` tarball at 0.2.0.
- `grep -n 'eight' README.md CHANGELOG.md .github/release-notes/v0.2.0.md` finds no release line still counting eight packages.
- `npm run check` exits 0, and the tests under `scripts/publish/` pass.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: eb742cd01a35
- Changed: The release publishes data before app, so the 0.2.0 set is nine packages and app installs
- Commits: none
- Check: 1 PACKAGE_ORDER lists data after components and before app: pass
- Check: 2 dry run exits 0 and names a @agent-ui-kit/data tarball at 0.2.0: pass
- Check: 3 no `eight` left in README.md, CHANGELOG.md, v0.2.0.md: pass
- Check: 4 `npm run check` exits 0 and scripts/publish tests pass: pass
- Follow-up: note: release.yml uses npm trusted publishing registered per package... -> notes.md
- Follow-up: note: "Bump data to 0.2.0" needs no edit: workspace manifests are private... -> notes.md
