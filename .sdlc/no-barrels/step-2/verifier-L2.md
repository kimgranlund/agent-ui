<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- `grep -qF "'BAD_USES'" …/component-descriptor.ts`: pass. Evidence: exit 0.
- `npx vitest run …/control-graph.test.ts`: pass. Evidence: 14 passed.
- `npx vitest run …/uses-driftwire.test.ts`: pass. Evidence: 172 passed.
- `node scripts/codemod-uses.mjs --check`: pass. Evidence: "all 82 fleet descriptors in sync", exit 0.
- Every `controls/[a-z]*/*.md` has `^uses:`: pass. Evidence: loop exit 0.
- `scalarSeq` on table.md equals `ui-button,ui-checkbox,ui-pagination,ui-radio`: pass. Evidence: node one-liner exit 0.
- `grep -qxF 'uses: []' …/button/button.md`: pass. Evidence: exit 0.
- (guard) vitest over descriptor, family-coherence, descriptor-agreement, prompt-equivalence, chat-shell and site/lib: pass. Evidence: 53 files passed, 1929 tests passed and 5 skipped, exit 0.
- (guard) `npm run check`: pass. Evidence: exit 0, the check:scripts selftest printed "all green".
- (guard) scope span with `SDLC_BASE_SHA=afa231ae…`: pass. Evidence: pipeline exit 0, so no file falls outside the allow-list.
- The four records (`component-packaging.md`, component-build `SKILL.md`, `descriptor-generation.md`, components `AGENTS.md`) each contain `codemod-uses.mjs`: pass. Evidence: loop exit 0.

Bite checks. I ran these in a throwaway worktree seeded with the built files; it is removed.
- Unmutated: `--check` exited 0.
- Deleting `- ui-radio` from table.md: `--check` exited 1 naming table.md, and the drift gate failed 2 tests.
- A phantom `uses: - ui-card` in button.md: `--check` exited 1, and the drift gate failed 1 test.
- A real `import '../card/card.ts'` appended to button.ts: `--check` exited 1, and the drift gate failed 1 test.

Edge count: an independent `grep` of the `  - ui-` items across the descriptors counts 39 edges. `git diff --stat` on the descriptors shows 82 files and 121 insertions. Both match the handoff.

The builder's claim of 7 descriptors where `uses` goes after wrapped `extends:` comment lines is a reasonable fix for codemod idempotency. I accepted it: `--check` is idempotent at 82/82 in sync.

## Out of scope changes
None. Every changed file is covered by the cumulative allow-list, and the scope guard is green.

The one em dash in the added lines is in an ADR-0040 table row (`None — a budget RE-BASE…`). That ADR edit is outside this step's work, and it still matches the allow-list. The new `.ts`, `.mjs` and test files contain no em dashes.

## For the next attempt
None
