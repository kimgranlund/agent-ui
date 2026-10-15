<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `CLAUDE.md`: new `## Commands` bullet after `npm run test:browser`. It covers the keyless selftest in `check:scripts`, the `live --leg selection|persona` key-bearing manual run with exit 0, 1 or 2, the home dir and GH #1810.
- `AGENTS.md`: new `## Gates` bullet. The selftest rides `check:scripts`; the live leg needs a key, is manual and is never a gate.
- `packages/agent-ui/a2ui/AGENTS.md`: same-line extension of the `selection.json` sidecar bullet, naming `eval:agent-behavior` and `selectionGuidanceFor`.
- `.claude/docs/rubrics/a2ui-catalog.md`: D7 pointer line between the table and `## Gate to promote`. Header bumped from v0.3 to v0.4 with a note that no dimension or anchor moved. The `| D7 |` row is unchanged.
- `.claude/skills/a2ui-review-standards/SKILL.md`: routing line after the "middle rows above" paragraph.
- `.claude/skills/a2ui-review-standards/references/grading-standards.md`: routing sentence at the end of the Catalog-page card bullet.
- `.claude/skills/a2ui-catalog-rendering-review/SKILL.md`: sentence at the end of item 3 "Probe the gates".
- `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md`: sentence appended to the "`npm test` covers every jsdom gate above" paragraph.
- `.claude/skills/component-testing/references/test-craft.md`: new paragraph after the "A seventh, NON-vitest step" paragraph.
- `.claude/skills/a2ui-corpus-curation/SKILL.md`: sentence in `## Scope: this skill is the exemplar shard only`.
- `.claude/skills/a2ui-prompt-authoring/SKILL.md`: extended the "Catalog selection sidecars are byte-pinned surface too" bullet.
- `.claude/skills/a2ui-build/SKILL.md`: extended the `Selection guidance` bullet.
- `.claude/agents/a2ui-review-agent.md`: body "Stay in the lane" bullet extended; frontmatter untouched.
- `.claude/docs/spec/a2ui-live-agent.spec.md`: non-normative "Eval coverage" line after SPEC-R4 AC2. Status bumped from v0.18 to v0.19, plus a v0.19 changelog entry recording a docs-only pointer.
- `.claude/docs/lld/a2ui-live-agent.lld.md`: stub-seam sentence in the §5 "Provider-agnostic" paragraph, plus a fold note in the header.
- `.claude/docs/lld/genui-b3-judged-eval.lld.md`: cross-reference sentence in §4.
- `packages/agent-ui/a2ui/corpus-genui/README.md`: cross-reference paragraph after the key-boundary paragraph.
- `.claude/docs/roadmap.md`: shipped line after the GenUI B3 paragraph.

## Checks
- Criteria 1 to 4 (token present in every file, `selection.json` line check): exit 0.
- (guard) D7 row byte-identical to `$SDLC_BASE_SHA`: exit 0.
- (guard) no em dash in added diff lines or untracked files: exit 0. Also ran before editing as a step-1 baseline: 0 hits.
- (guard) touched-file allowlist: exit 0.
- `python3 scripts/claude_wiring_check.py`: exit 0, PASS, anchor sweep clean.
- `python3 scripts/harness_wiring_check.py --reachability-only`: 29/29 passed. `--rubric-modes`: 35/35 passed.
- `doc_lint.py` on the 5 touched `.claude/docs` files: each exit 0 with "not a functional document", as the handoff predicted.
- (guard) `npm run check`: exit 0. The agent-behavior selftest ran inside it: 7 scripted turns, 0 mismatches, pins ok.
- (guard) `npm test`: exit 0. 627 test files passed, 1 skipped; 12668 tests passed, 6 skipped.

## Notes
- Rubric header side effect: the v0.4 bump had to rewrite header line 3, and that line already held an em dash ("note ONLY — no"). Keeping it would trip the no-em-dash guard on the modified line, so it now reads "note ONLY: no". No other wording changed.
- In every other "extend the bullet/paragraph" edit, the addition went on a new continuation line or onto an existing line that holds no em dash. The one exception is `packages/agent-ui/a2ui/AGENTS.md`, which is same-line by design.
- No other file pins the rubric's v0.3 version.
- T-0006 (live-agent SPEC/LLD) and T-0009 (`test-craft.md`) had not landed in this tree, so no rebase was needed.
- No commit made.
