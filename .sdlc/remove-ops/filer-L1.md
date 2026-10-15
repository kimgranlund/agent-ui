<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Remove legacy .claude/ops directory and repair its dependents

## PR body
### Summary
Deletes the whole legacy `.claude/ops/` directory (108 tracked files, no archive; git history keeps the content). Every live script, test, skill and doc that pointed into it is repaired in the same change.

### Changes
- `.claude/ops/`: removed with `git rm -r`. The leftover empty untracked `scratch` dir was removed in a second attempt.
- `scripts/reap-worktrees.mjs`: removed the fleet-seat rule (d), which read `.claude/ops/fleet.json` (GH #1680). Gone with it: `liveFleetSeatNames()`, the `KEEP(fleet-seat)` branch, the selftest fixture and its three asserts, and the now-unused `readFileSync` and `basename` imports. The header now reads "ALL THREE of (a)-(c) hold".
- `packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts`: dropped `.claude/ops` from `SCAN_ROOTS` and the header comment, and removed the mb-live-proof ALLOWLIST row.
- Comment-only path repairs, keeping the attribution in words: `scripts/reap-branches.mjs`, `a2ui/src/agent/produce.ts`, `a2ui/src/live-agent/produce-loop.test.ts`, `process.md`, `goals.md` (4 places), both PRDs, the `saas-data-utilities` decomposition (`grounding` string only), and `adr-log-mechanics.md` (2 places).
- `product-brief.md`: the markdown link to `../ops/rulings.md` became plain text, because the docs-grammar S3 dangling-link test would otherwise go red.
- Left untouched on purpose: accepted ADRs and dated reports under `.claude/docs/reports/` (historical), `.claude/overhaul-wave1-plan.json`, `site/.fixture-scratch/**`, and `.sdlc/`.

### Verification
Verifier L1 passed on the second attempt. The first attempt failed only because of the empty leftover directory, which is now fixed.
- `test ! -e .claude/ops`: pass.
- `git grep "\.claude/ops"` over the scoped live paths: no hits.
- `grep -qi fleet scripts/reap-worktrees.mjs`: no match.
- `node scripts/reap-worktrees.mjs selftest`: exit 0, 0 fail.
- vitest on `state-grammar-gates`, `docs-grammar` and `produce-loop`: 3 files, 258 tests passed.
- `json.tool` on the decomposition JSON: valid.
- `doc_lint` on the six touched docs: pass.
- Scope-diff guard (only listed files changed) and no untracked files outside `.sdlc`: pass.
- `npm run check`: exit 0.

### Risk
Several rulings from `.claude/ops/` have no other home in `.claude/docs/` (see Follow-ups). They remain in git history.

## Changelog entry
Removed the legacy `.claude/ops/` directory and the fleet-seat protection rule in `scripts/reap-worktrees.mjs`. Stale references in scripts, tests, skills and live docs were repaired.

## Follow-ups
- decide: Rulings from `.claude/ops/` with no other home in `.claude/docs/` (builder notes, `git grep` only, ADR-harvest landing unchecked) need a keep-or-drop call: agent seat tiers (agent `fable+medium`, reviewer `sonnet+high`, planner `fable+medium`, product `sonnet+xhigh`, reviewer `deny-edit-write`), ADR-0008 swiper dim "revert it", ADR-0173/0174/0175 harvest targets, #1583 APP_MARGINAL_BUDGET ruling, hold-first-filing, and the #613 branch-reap practice rules.
- note: With the fleet-seat rule gone, `reap-worktrees --execute` can now reap standing `agent-ui-planner` and `agent-ui-reviewer` worktrees if they exist and are clean.
- note: `handoff-2026-10-04.md` listed an open `validate_cross_harness.py` item for Kim to decide. It is no longer in the repo and sits only in git history.
