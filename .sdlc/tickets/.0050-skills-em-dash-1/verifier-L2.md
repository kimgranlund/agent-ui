<!-- role=verifier level=L2 model=opus effort=high -->
## Verdict
fail

## Criteria
- Done-when grep over the nine folders prints nothing: pass. Evidence: `grep -rl "—" .claude/skills/a2ui-build ... .claude/skills/app-composition` printed nothing, rc=1, in the tree under test at b296de03.
- No em dash added: pass. Evidence: `git diff bfd1235c HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` prints 0. The diff removes 924 em dashes. A char-level word diff (`--word-diff=porcelain --word-diff-regex=.`) shows only `- —` (922), `-—` (2, both at a line start), `+,` (816) and `+:` (108). No hyphen was added anywhere, so no range or minus was touched, and no en dash or ASCII hyphen changed.
- Scope, 44 files only under the nine skill folders: pass. Evidence: `git diff --name-only bfd1235c HEAD` lists 44 files, and filtering out the nine scoped prefixes leaves nothing. `git status --short` in the tree is clean.
- Frontmatter descriptions keep their meaning exactly (handoff Do: "keep their meaning exact and re-read each edited description"): fail. Evidence: a yaml.safe_load comparison of old and new `description:` values. Four descriptions are unchanged (catalog-rendering-review, corpus-curation, multi-catalog, review-standards). a2ui-payload-authoring is fine: the appositive reads correctly with a comma. Four drifted:
  - `.claude/skills/app-composition/SKILL.md`: `(a2ui-payload-authoring — this skill only wires the seam)` became `(a2ui-payload-authoring, this skill only wires the seam)`. Inside a NOT fence, "this skill" now reads as a gloss on a2ui-payload-authoring, so the sentence can say the wrong skill only wires the seam.
  - `.claude/skills/admin-library-kinds/SKILL.md`: `for a new kind — agent-admin's entry-kind / library-pack architecture (ADR-0132→...)` became `for a new kind, agent-admin's ...`. The skill's subject now reads as an appositive renaming "a new kind", or as one more trigger. Also `NOT for integrations — tool registry, manifests, server keys` became a flat four-item list. The routing effect of that second change is the same, but it is no longer the same sentence.
  - `.claude/skills/a2ui-build/SKILL.md`: `The build METHOD for @agent-ui/a2ui package units — the canonical sources..., the ground rules, ...` became `units, the canonical sources...`. A definition of the METHOD is now a five-item list with METHOD as its first item. A colon keeps the meaning.
  - `.claude/skills/a2ui-prompt-authoring/SKILL.md`: `PROMPT STACK — grammar.md, the mode files, ... prompts/ — without breaking` became a flat list. "the rest of the byte-pinned surface" still implies membership, so this one is minor.
  The trigger phrases are intact in all of them.
- Tables intact: fail. Evidence: in 31 rows, a table cell that held a lone em dash (the empty or n/a marker) now holds a lone comma. The rule turned ` — ` into `, ` and ate the cell's leading space, which gives `|, |`. `grep -rnE '\|,\s*\||\|\s*,\s*\|'` over the nine folders finds:
  - `.claude/skills/a2ui-catalog-rendering-review/evals/audit-report.md` lines 8, 9, 11, 12, 14, 15, 20, 55, 56, 57, 58, 59, 60, 61, 62 (severity column, and the trailing column on some rows, e.g. `| R2 | PASS |, | ... clean. |, |`)
  - `.claude/skills/a2ui-multi-catalog/evals/audit-report.md` lines 15, 16, 17, 18, 21, 22, 23
  - `.claude/skills/admin-library-kinds/evals/audit-report.md` lines 9, 10, 12, 13, 15, 16, 17
  - `.claude/skills/a2ui-payload-authoring/references/meta-line-vocabulary.md:24`: `|, | (envelope minted) | 0088 |`, the arm-number column of a live reference table
  The same grep at bfd1235c finds 0. The pipe counts per line are unchanged, so the tables still render, but the cell values are now a stray comma. Elsewhere, pipe and backtick counts match on every changed line.
- Code fences and quoted examples: fail. Evidence: 9 changed lines sit inside fences (a line-by-line fence-state scan):
  - `a2ui-catalog-rendering-review/SKILL.md`:100, 105, 107 (output-contract template): the `<scope>, <date>, probes:` header now uses commas as field separators. Readable, but it changes the report format the skill prescribes.
  - `a2ui-payload-authoring/references/node-idioms.md`:198, 201 (`// WRONG, ...`, `// RIGHT, ...`): comments only, harmless.
  - Payload data strings that quote real seeds, which now diverge from the seed they cite:
    - `composition-patterns.md:44` `'Living room, morning light ...'` vs `packages/agent-ui/a2ui/src/examples/composition-pack-a.ts:77` `'Living room — morning light ...'`
    - `composition-patterns.md:207` `'Check in, Memmo Alfama'` vs `composition-pack-b.ts:225`
    - `node-idioms.md:259` `'Dealer wins, 19 beats 17.'` vs `catalog-frontier.ts:310`
    - `trees-and-lists.md:71` `"${name}, ${role}"` vs `dynamic-lists.ts:73`
  No test reads these docs: `git grep` for the file names finds only code comments and `harness_wiring_check.py`, which checks SKILL.md wiring, not bodies. So nothing goes red.
- JSON parses and is semantically equal except for dash strings: pass. Evidence: a script parsed old and new for all 8 changed .json files and walked them recursively. Structural diffs are 0 in every file, and every differing value is a string whose old form contained `—`; no non-dash difference was found. The eval prompts keep their meaning (e.g. "the validator rejects this message, fix the renderer"). `routing-corpus.json` and `evals.json` under a2ui-corpus-curation changed the same prompts consistently.
- SKILL.md frontmatter parses: pass. Evidence: yaml.safe_load on all 9 changed SKILL.md frontmatters succeeds with keys intact (name, description, user-invocable, disable-model-invocation, argument-hint where present).
- Wiring check no worse than bfd1235c: pass. Evidence: `python3 scripts/harness_wiring_check.py` reports `37/39 wiring checks passed` and exit 1 at both b296de03 and bfd1235c (throwaway worktree). The same two FAIL lines appear in both runs (`a2ui-payload-authoring-agent.md` D1, and `a2ui-review-agent.md` D1/D7/D9).
- `npm run check` exit 0: pass. Evidence: after `node scripts/bootstrap-scratch-clone.mjs . --root ...` (exit 0), the first `npm run check` passed tsc, check:site and check:tools, then failed in check:scripts at `reap-scratch-clones` selftest: `FAIL discovery: passing the same root twice does not duplicate candidates (815 vs 816)`. That test counts live scratch clones under /var/folders, and another agent created one between the two scans; this docs-only diff touches no script. A rerun of `npm run check:scripts` exited 0, and a second full `npm run check` exited 0. The builder's site/tsconfig tsc error was the missing node_modules: `tsc -p site/tsconfig.json` passes once the tree is bootstrapped, so main does not fail.

## Out of scope changes
None. All 44 changed files are under the nine scoped skill folders.

## For the next attempt
1. Fix the 31 lone-comma table cells listed above. Restore an explicit empty or n/a marker for each (`n/a`, an empty cell, or an ASCII `-` used on purpose as a placeholder); a stray `,` is not acceptable. Files: the three `evals/audit-report.md` files and `a2ui-payload-authoring/references/meta-line-vocabulary.md:24`.
2. Re-read and repair four descriptions so their meaning is exact:
   - `a2ui-build/SKILL.md`: "package units: the canonical sources ...".
   - `a2ui-prompt-authoring/SKILL.md`: "PROMPT STACK (grammar.md, ..., under packages/agent-ui/a2ui/src/agent/prompts/), without breaking ...".
   - `admin-library-kinds/SKILL.md`: a colon or period before "agent-admin's entry-kind / library-pack architecture", and "NOT for integrations (tool registry, manifests, server keys): integration-standards", or an equivalent.
   - `app-composition/SKILL.md`: "(a2ui-payload-authoring; this skill only wires the seam)".
3. Recommended, not blocking alone: where a dash introduced an explanation, a colon reads better than the comma splices the scripted rule produced. In the body, `a2ui-corpus-curation/SKILL.md` "stages, codes, and order, the authority ..." now reads as a four-item list.
4. For the lead: the done-when grep forces the four fenced payload strings that quote seeds verbatim to drift from their seed sources. The seeds are outside scope and keep their em dashes. Accept the drift, or extend a later ticket to the seeds.
