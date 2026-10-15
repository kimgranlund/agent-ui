<!-- role=verifier level=L2 model=opus effort=high -->
## Verdict
fail

## Criteria
- Earlier findings fixed: pass. Evidence (each cited line read at HEAD 80bca937):
  - `.claude/agents/example-authoring-agent.md:5` now reads `(not empty/lorem; real job, realistic`, so the negation stops at the semicolon.
  - `.claude/skills/integration-standards/evals/audit-report.md`: the 18 placeholder cells on lines 11-15 and 17-20 are `| - |`.
  - `.claude/skills/layout-composition/SKILL.md:9` reads `generic layout THEORY:` followed by the gloss.
  - `.claude/agents/repo-orchestrator-agent.md:26` reads `no Write, no Edit; Bash is scoped to`.
  - The headings use a colon: `due-process/SKILL.md:15` `# due process: the size:big build loop` and `repo-orchestrator-agent.md:63` `## Reporting: the stopping predicate`.
- Done-when grep prints nothing: pass. Evidence: `grep -rl "—"` over the 10 skill dirs and 4 agent files printed nothing (exit 1). It can go red: at bfd1235c, `git grep -c "—"` shows due-process/SKILL.md:25, site-authoring/SKILL.md:29 and repo-orchestrator-agent.md:22.
- No em dash in added lines: pass. Evidence: `git diff bfd1235c HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` printed 0.
- Only the 30 scoped files changed: pass. Evidence: `git diff --name-only bfd1235c HEAD` filtered against the 14 scope paths printed nothing. The working tree was clean.
- Structural integrity: pass. Evidence: a pairwise script (scratchpad v2/pairs.py) compared all 477 changed lines between base and head.
  - Line counts are equal in every file.
  - Every change is limited to `[ ,:;.()-—]`.
  - The pipe count is unchanged on every table line, so no column count changed.
  - Hyphen counts changed only on audit-report.md:11-15 and 17-20, which are the intended `-` placeholders.
  - `yaml.safe_load` parsed the frontmatter of all 14 .md files with the same keys as before.
  - All 5 evals.json files pass `json.load`.
  - Fences: only `site-authoring/references/best-practices.md:134,144` changed. Both are the same string literal in an illustrative TS example, changed consistently. This is a finding only, as in the first run.
- Literal em dash required by code: pass. Evidence: I grepped the code that reads the scoped files (`scripts/harness_wiring_check.py`, `scripts/claude_wiring_check.py`, `site/lib/docs-grammar.test.ts` S7/S9, `site/pages/composition.ts`, `site/pages/testing-guide.ts`). None of it matches an em dash in those files. The only em dash pattern that touches them is `harness_wiring_check.py:254` `_clauses`, which splits on `[.\n;]|—|–|--`, so a semicolon still splits there. `scripts/adr_ratify.py` does not reference the scoped paths. `npx vitest run site/lib/docs-grammar.test.ts site/pages --maxWorkers=4` exited 0 (40 files, 512 tests).
- Wiring check no worse than bfd1235c: pass. Evidence: `python3 scripts/harness_wiring_check.py` exits 1 with `37/39` at HEAD and also exits 1 at bfd1235c (throwaway worktree). After `diff`, the two outputs are byte-identical. `python3 scripts/claude_wiring_check.py` exits 0 on both, with identical output.
- `npm run check` and `npm run check:scripts` exit 0: pass. Evidence: both exited 0 at HEAD.
- Descriptions keep their meaning (all 11 changed description values read, old vs new, via yaml): fail. The semicolon rule ends a NOT scope or turns a negated gloss into a separate item:
  - `.claude/agents/a2ui-build-agent.md:9` (clearest case). `NOT PAYLOAD composition — message stream/nodes an agent emits (...), ui-* controls/CSS (component-build-agent), kernel/base (dom/, reactive/), spec/LLD (planner).` became `NOT PAYLOAD composition; message stream/nodes ...`. The semicolon ends the NOT, so three NOT-for owners (ui-* controls/CSS, kernel/base, spec/LLD) now sit outside the negation in routing text.
    - Steelman: the owner parentheticals still hint at exclusion. But the handoff requires description meaning to stay exact, and grammatically the scope is cut.
  - `.claude/agents/component-build-agent.md:5`: `NOT design intake; forks, geometry rows, ADRs (component-design runs first)`. The gloss of the negated item is now a fragment with no negation.
  - `.claude/skills/due-process/SKILL.md:8`: `NOT ui-* component work itself; build or design intake (component-build/component-design); NOT which doc ...`. The gloss is now a separate item with no negation, sitting between two NOT items.
  - The other 8 description changes keep their meaning: example-authoring-agent, repo-orchestrator-agent, layout-composition, package-release, project-docs, project-facts, site-authoring and ui-composition. Several are stiff.
- Paired-dash to parentheses changes (all 12 lines where parentheses changed, read): fail. The builder paired any two dashes on one line, even when they were not a pair. Seven lines now have broken, unbalanced or cross-cell parentheses, and the meaning moved:
  - `integration-standards/evals/audit-report.md:21` (F1 row). `(but at audit time ... (ls verified); intent.md:51 is still ... . A gate recorded PASS ahead of its own runtime check) the exact stale-record class ...`. The finding's evidence is now an aside that crosses a sentence boundary, and `the exact stale-record class` has lost its referent.
  - `audit-report.md:22` (F2 row), Evidence cell. `matches none of its three fields (wikipedia-search.ts:13/:18/:15 is ...` is never closed.
  - `audit-report.md:22`, Fix cell. The quoted label the fix recommends changed from `"(illustrative — invented trio; ... which cl.2 permits)"` to `"(illustrative) invented trio; ... which cl.2 permits)"`. The parentheses are unbalanced and the recommended text itself is different.
  - `project-docs/SKILL.md:34` (table cell). `**GitHub Issues** (...) (labels carry `kind:` (...) ...; `docs/tickets/` (repo-root) does not exist) `tickets/` is FROZEN per ADR-0145`. The parentheses nest badly and the FROZEN clause is cut loose with no separator.
  - `project-facts/SKILL.md:31`: the parentheses pair across table cells. Column 1 is `**What's queued or in flight (LIVE work items**` and is never closed. Column 2 `(`gh issue list`; ADR-0145) labels: ... comments)` now closes early and ends in a stray `)`.
  - `site-authoring/SKILL.md:39`. `(the copy is the precondition for drift (`.claude/docs/process.md`'s drift disease). The four owners a site page derives from) descriptor · real renderer ...`. The parentheses are mismatched and the next sentence's subject is swallowed into the aside.
  - `site-authoring/evals/evals.json:3` `_note`. `(routing follow-up, GH #1466 (E6 coverage warn). Positives: adding/updating a docs-site (site/) page) landing, ...`. The aside crosses a sentence and splits "page" from its list.
  - `site-authoring/references/best-practices.md:113` (table). `(the real site surface (`adr-index.ts` already resolves that hash). A `TKT-####` id renders as plain code) there is no published ticket index to link to yet.` The TKT rule is now inside an aside and its reason is cut loose.
  - Correct pairs: audit-report.md:16, dispatch-placement.md:15, mcp-roster-law.md:69, best-practices.md:16 and foundations.md:39.
- Table hunks (26 non-paren table hunks read): pass. They change prose inside cells only and keep the meaning. Examples: project-docs:29,33,35,37; project-facts:27,32,35,41; site-authoring SKILL.md:74,75,157; best-practices.md:111,112,114; rubric.md:15,19; audit-report.md:11-15,17-20,23.
- Body prose (50 negation-scope candidates plus 40 random hunks across all 30 files, 21 evals.json hunks): pass with findings. Bold-label to colon, heading to colon, and the semicolons after a full clause keep the meaning.
  - Stiff but meaning intact: `audit-report.md:37` `**Steelman on F2**: rebuttal (...): does not survive:`; `package-release/SKILL.md:38` with two semicolons in a row; `repo-hygiene/SKILL.md:114` `fails; and NEVER`; `example-authoring/SKILL.md:21` `**The gallery**: `...`: composes`.
  - The evals.json prompt and note strings change only the dash and keep their intent.

## Out of scope changes
None

## For the next attempt
1. Fix the 7 mis-paired parenthesis lines. Restore each line from bfd1235c and treat each dash on its own; pair dashes only when they really bracket an aside, and never across a table cell or a sentence boundary:
   - `.claude/skills/integration-standards/evals/audit-report.md:21` (F1 row). Suggested: `...items below)": but at audit time ... (filled at P5 triage)". A gate recorded PASS ahead of its own runtime check: the exact stale-record class ...`.
   - `audit-report.md:22`, Evidence cell: `matches none of its three fields: wikipedia-search.ts:13/...`.
   - `audit-report.md:22`, Fix cell: `"(illustrative: invented trio; the shipped wikipedia-search manifest has id = tool.name, which cl.2 permits)"`.
   - `.claude/skills/project-docs/SKILL.md:34`: `(...): labels carry ...; `docs/tickets/` (repo-root) does not exist; `tickets/` is FROZEN per ADR-0145`.
   - `.claude/skills/project-facts/SKILL.md:31`: column 1 `**What's queued or in flight: LIVE work items**`; column 2 `(`gh issue list`; ADR-0145: labels: ...)`.
   - `.claude/skills/site-authoring/SKILL.md:39-40`: `drift: `.claude/docs/process.md`'s drift disease). The four owners a site page derives from (descriptor · real renderer · props enum · token roles) plus what ...`.
   - `.claude/skills/site-authoring/evals/evals.json:3`: `(routing follow-up, GH #1466: E6 coverage warn). Positives: adding/updating a docs-site (site/) page (landing, ..., recipe) or auditing ...`.
   - `.claude/skills/site-authoring/references/best-practices.md:113`: `(the real site surface; `adr-index.ts` already resolves that hash). A `TKT-####` id renders as plain code: there is no published ticket index ...`.
2. Fix the three description values so the negation keeps its scope. Use a colon or parentheses, not a semicolon:
   - `.claude/agents/a2ui-build-agent.md:9`: `NOT PAYLOAD composition (message stream/nodes an agent emits; a2ui-payload-authoring-agent owns that ...), ui-* controls/CSS ...`, or a colon followed by restructuring so the later items stay under NOT.
   - `.claude/agents/component-build-agent.md:5`: `NOT design intake (forks, geometry rows, ADRs; component-design runs first)`.
   - `.claude/skills/due-process/SKILL.md:8`: `NOT ui-* component work itself (build or design intake: component-build/component-design)`.
3. After the fixes, run a balanced-parenthesis check per changed line and per table cell against bfd1235c. Read every line whose `(` or `)` count changed by eye.
