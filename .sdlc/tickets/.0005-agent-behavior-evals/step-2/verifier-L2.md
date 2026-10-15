<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- Criterion 1 (`eval:agent-behavior` in `CLAUDE.md` and `AGENTS.md`): pass. I ran the loop and it printed no failures. The diff shows the new `## Commands` bullet right after the `test:browser` bullet and the new `## Gates` bullet.
- Criterion 2 (`selection.json` line in `packages/agent-ui/a2ui/AGENTS.md`): pass. The pipe exited 0. The diff shows the addition on the same line as the sidecar bullet, not a new bullet.
- Criterion 3 (nine skill and agent files): pass. The loop printed no `F3` or `FAIL` lines. I read the diff for each file. Every addition is a single pointer sentence in the requested spot. The `a2ui-review-agent.md` change is in the body's "Stay in the lane" bullet and the frontmatter is untouched.
- Criterion 4 (six doc files): pass. The loop printed no failures. The diff shows the D7 pointer line before `## Gate to promote`, the rubric header bumped v0.3 to v0.4, the spec header bumped v0.18 to v0.19 with a changelog entry, the "Eval coverage" line after SPEC-R4 AC2, the LLD §5 sentence plus header fold note, the §4 cross-reference, the corpus-genui README line, and the roadmap line after the B3 paragraph.
- (guard) D7 row byte-identical to `$SDLC_BASE_SHA`: pass. `test ... = ...` exited 0. The diff does not touch the `| D7 |` row, only adds a line after the table.
- (guard) no em dash in added lines or untracked files: pass. The predicate exited 0. It can go red: piping a string containing an em dash through the same `grep -q "$(printf '\342\200\224')"` matcher exits 0, so the negated form would fail on a real hit. The builder rewrote the rubric header's old em dash ("note ONLY — no") to a colon. That line was in the diff, so the guard required it.
- (guard) touched-file allowlist: pass. The predicate exited 0. `package.json` and `vitest.config.ts` appear in the diff, and both are on the allowlist (they are step 1 files).
- (guard) `npm run check`: pass. It exited 0. The log ends with the `selftest: all green` line and "scripted summary: 7 turn(s), 0 mismatch(es); pins ok".
- (guard) `npm test`: pass. It exited 0 with 627 test files passed, 1 skipped, and 12668 tests passed, 6 skipped. This matches the builder's claim.
- Builder claim on wiring checks: confirmed. `python3 scripts/claude_wiring_check.py` exited 0, and `python3 scripts/harness_wiring_check.py --reachability-only` reported 29/29 passed.
- I did not run the `doc_lint.py` step. It is not a criterion, and the handoff says it cannot go red.

I did not run a pre-build HEAD worktree for the two gates. Both are green on the built tree, so there was no red to attribute.

## Out of scope changes
None. `git status` shows only the allowlisted files plus `.sdlc/` and `packages/agent-ui/a2ui/tools/agent-eval/`. `package.json` and `vitest.config.ts` come from step 1 and are on the allowlist.

## For the next attempt
None
