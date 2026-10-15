## Task goal
Remove the whole legacy `.claude/ops/` directory (108 tracked files) and repair every record it invalidates in the same change.

## Step 1: Remove .claude/ops and repair its live dependents (gates green)
level: L2
### Do
Depends on: none. This is the only step, so it is also the gates green step.

1. Before deleting anything, read `.claude/ops/rulings.md`, `plan.md`, `held-items.md`, `handoff-2026-10-04.md` and `fleet.json`. For each decision or ruling in them, `git grep` `.claude/docs/` for a second home. In the builder result's Notes, add a `Decisions without another home` list. Name each source file there, and under it either `none` or each orphaned decision (one line each, with its date and a short quote). Do not add those decisions to other docs. This is a report only (handoff Context).
2. Run `git rm -r -q .claude/ops`. That removes all 108 tracked files. Do not archive them; git history keeps the content.
3. `scripts/reap-worktrees.mjs`: remove the fleet-seat rule completely:
   - header rule `(d)`, and change "ALL THREE hold" so it matches the remaining rules (a) to (c);
   - `liveFleetSeatNames()` and its doc comment;
   - `const fleetSeats` in `classify()`, and the `KEEP(fleet-seat)` branch;
   - the selftest `keep-fleet-seat` fixture: the branch, the `agent-ui-fixture-seat` worktree, the comment block, and the `.claude/ops/fleet.json` write;
   - the three `KEEP(fleet-seat)` / `agent-ui-fixture-seat` asserts.

   Drop any `node:fs` import that becomes unused. Every other disposition and the exit contract stay as they are. The fixture has to go, not just its asserts: with the rule gone, that worktree (0 commits ahead) would classify as REAP and be removed.
4. `packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts`:
   - remove `'.claude/ops'` from `SCAN_ROOTS`, and from the header comment on line 10;
   - remove the `.claude/ops/mb-live-proof/mb-live-proof.harness.ts` ALLOWLIST row and its comment.

   The anti-vacuous floor (`statSync` of every ALLOWLIST key, line 152) and the stale-row check both go red once the file is gone. I proved this at plan time in a scratch worktree.
5. Comment-only repairs. Each one drops the `.claude/ops/...` path and keeps the attribution in words, for example "Kim's 2026-08-16 ruling (retired ops ledger, in git history)" or "GH #404 live observation (box2-quizmaster capture, in git history)". No `.claude/ops` string may remain in these files:
   - `scripts/reap-branches.mjs:21`;
   - `packages/agent-ui/a2ui/src/agent/produce.ts:381`;
   - `packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts:524`;
   - `.claude/docs/process.md:86`;
   - `.claude/docs/goals.md` lines 635, 672, 690, 757;
   - `.claude/docs/product-brief.md:148`. Its markdown link `](../ops/rulings.md)` must become plain text with no link, because `site/lib/docs-grammar.test.ts` S3 (dangling relative links) reds on it otherwise. Proven at plan time;
   - `.claude/docs/prd/agent-admin-app.prd.md:49`;
   - `.claude/docs/prd/saas-data-utilities.prd.md:3`;
   - `.claude/docs/decompositions/saas-data-utilities.decomp.json:8`. Edit the `grounding` string only, and keep the file valid JSON;
   - `.claude/skills/doc-standards/references/adr-log-mechanics.md` lines 100 and 135.
6. Leave these untouched on purpose:
   - Accepted ADRs (0007, 0040, 0067, 0069, 0072, 0192, 0193) and `.claude/docs/reports/**`. They are historical. S3 only checks markdown links, and these cite ops paths only in code spans, so no gate fails.
   - `.claude/overhaul-wave1-plan.json`. It is a dated (2026-08-15) rename record that nothing references, and it already lists other paths that no longer exist.
   - `.claude/skills/seat-map/SKILL.md:130`. It names a foreign repo's `fleet.json`, not a path in this repo.
   - `.claude/skills/repo-hygiene/SKILL.md:106`. It names `adr-queue.json` generically, with no path.
   - `site/.fixture-scratch/**`. These are tracked build output that a fixture rebuild regenerates.
   - `.sdlc/`.
7. Run every criterion below, and fix any red this change causes.
### Acceptance criteria
- `test ! -e .claude/ops`
- `! git grep -n "\.claude/ops" -- scripts packages .claude/skills/doc-standards .claude/docs/process.md .claude/docs/goals.md .claude/docs/product-brief.md .claude/docs/prd .claude/docs/decompositions`
- `! grep -qi fleet scripts/reap-worktrees.mjs`
- (guard) `node scripts/reap-worktrees.mjs selftest`
- (guard) `npx vitest run packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts site/lib/docs-grammar.test.ts packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts`
- (guard) `python3 -m json.tool .claude/docs/decompositions/saas-data-utilities.decomp.json >/dev/null`
- (guard) `DL=$(ls -d ~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py | sort -V | tail -1); for f in .claude/docs/process.md .claude/docs/goals.md .claude/docs/product-brief.md .claude/docs/prd/agent-admin-app.prd.md .claude/docs/prd/saas-data-utilities.prd.md .claude/skills/doc-standards/references/adr-log-mechanics.md; do python3 "$DL" "$f" >/dev/null || exit 1; done`
- (guard) `test -z "$(git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc' ':(exclude).claude/ops' | grep -vxF -e scripts/reap-worktrees.mjs -e scripts/reap-branches.mjs -e packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts -e packages/agent-ui/a2ui/src/agent/produce.ts -e packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts -e .claude/docs/process.md -e .claude/docs/goals.md -e .claude/docs/product-brief.md -e .claude/docs/prd/agent-admin-app.prd.md -e .claude/docs/prd/saas-data-utilities.prd.md -e .claude/docs/decompositions/saas-data-utilities.decomp.json -e .claude/skills/doc-standards/references/adr-log-mechanics.md)"`
- (guard) `test -z "$(git ls-files --others --exclude-standard -- . ':(exclude).sdlc')"`
- The builder result's Notes contain a `Decisions without another home` list that names each of `rulings.md`, `plan.md`, `held-items.md`, `handoff-2026-10-04.md` and `fleet.json`, each followed by `none` or by the orphaned decisions (verifier reads the builder file).
- (guard) `npm run check`

## Previous attempt
Verifier L1 failed criterion 1: `test ! -e .claude/ops` exited 1 because an empty untracked directory `.claude/ops/scratch` remained after `git rm -r`. Remove it with `rmdir .claude/ops/scratch .claude/ops` (empty dirs only; no tracked files are involved), then rerun `test ! -e .claude/ops`. Everything else passed; keep it unchanged.
