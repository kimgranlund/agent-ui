Campaign: Every agent-ui size, margin, gutter, icon and glyph box and type role derives from one n (ADR-0245), migrated across all controls, containers, widgets, packages and the site in parallel file-disjoint lanes, then released in one cut.

Census: `node scripts/foundations-census.mjs` exits 0 and prints the files still reading hand-tabled geometry, the `glyph` prop, or the retired `[scale]` and `[density]` axes (about 33 stylesheets with px geometry literals, 196 files naming glyph and 122 touching scale or density at planning time; Wave 0 builds the exact script)
Dependency order: Kim ratifies ADR-0245 and approves the step 0 mockup first; Wave 0 lands on main before any Wave 1 lane starts; Wave 2 starts when every Wave 1 lane has a finished branch; Wave 3 starts when Wave 2 passes.
Lane cap: 12

Wave 0 (one lane, solo L3, lands first): the vendored `scale.mjs` generator writing `foundations.gen.css` beside `dimensions.css` as additive tokens, the new `ui-glyph` element with the closed 12 mark path table, the `symbol` prop with `glyph` kept as an alias, `scripts/foundations-codemod.mjs <dir>` (rewrites a directory's hand-tabled geometry reads, `glyph` call sites and `[scale]` uses to the derived tokens and `symbol`), `scripts/foundations-probe.mjs` (computed height, padding and radius per control), and a blocking gate `node scripts/foundations-census.mjs --gate` that fails on any file not on the allowlist and on any stale allowlist entry, wired into the existing `check:scripts` chain with no new CI job. The gate starts green through a day-one allowlist (`scripts/foundations-allowlist.json`) of every current violator, each with a justification string.
Wave 1 (10 lanes, file-disjoint, one writer per file, solo L2 agents): each lane runs the codemod on its directories, fixes what the codemod cannot, commits early (WIP commits), deletes only its own allowlist entries one per line, and pushes its branch. Lanes run the local gate only (`npm run check` plus the touched folders' tests); CI runs the rest.
Reference PR: the Wave 0 PR (the pattern every lane copies; its number is recorded in .sdlc/notes.md when it merges)

| lane | directory | units |
|---|---|---|
| a01 | packages/agent-ui/components/src/controls/{text-field,textarea,select,combo-box,multi-select,otp-field,field,suggestions,button,toggle,segmented-control,segment,pagination,toolbar,split,rating} | 16 |
| a02 | packages/agent-ui/components/src/controls/{checkbox,radio,switch,slider,slider-multi,progress,gauge,choice-card,choice-group,color-picker} | 10 |
| a03 | packages/agent-ui/components/src/controls/{badge,avatar,icon,stat,swatch,image,video,audio,attachment,file-drop,sparkline,text} | 12 |
| a04 | packages/agent-ui/components/src/controls/{menu,tabs,breadcrumb,tree,list,source-list,drill,ladder,swiper,calendar,table,description-list,timeline,timeline-item,status-stream,grid,row,column} | 18 |
| a05 | packages/agent-ui/components/src/controls/{card,modal,drawer,popover,tooltip,toast,form-popover,form-provider,command-modal,disclosure,sandbox-frame} | 11 |
| a06 | packages/agent-ui/components/src/controls/{product-card,board-grid,game-hud,playing-card,service-card,_chart,bar-chart,column-chart,line-chart,pie-chart} | 10 |
| a07 | packages/agent-ui/app | 1 |
| a08 | packages/agent-ui/a2ui | 1 |
| a09 | packages/agent-ui/code | 1 |
| a10 | site | 1 |

Wave 2 (bulk review, batched at the end, no per-lane verifier): two verifiers, one per bundle (a01 to a05 controls, a06 to a10 widgets, packages and site), on a different model family than the Sonnet builders, plus a probe sweep with before and after numbers per unit from `node scripts/foundations-probe.mjs` (dev server serving mode, computed height, padding and radius against `scale.mjs` resolve) and a screenshot of each family next to the step 0 mockup. A verifier fail is fixed once by the conductor or a re-run lane; nits never rebuild.
Wave 3 (bulk PRs, merged serially through the queue at ~/.claude/lane/queue-merge.sh): one branch per lane, 10 to 11 PRs (the ten lane PRs, then the cut PR that flips the root default to product/sm, retires `[scale]` and `[density]`, empties the allowlist and enforces the px-literal rule), one plain push each; the cut PR waits for Kim's sign-off on the docs site and agent-admin.

Stop rules: stop and write state to .sdlc/notes.md at $510 total (a backstop, because Kim said no limits: $60 Wave 0, $30 times 10 lanes, $120 for two verifiers, $30 for the cut), $30 per lane, a rate or weekly limit, or three 529s in a row.
Done when: `node scripts/foundations-census.mjs --gate` exits 0 on main with an empty allowlist

```
/goal
Scope:
1. Wave 0: the generator, `foundations.gen.css`, `ui-glyph` with the `symbol` alias, the codemod, the probe and the blocking census gate, landed on main.
2. Wave 1: ten file-disjoint solo lanes a01 to a10 from the partition above.
3. Wave 2: two batched verifiers and the probe sweep at the end.
4. Wave 3: 10 to 11 PRs merged serially through ~/.claude/lane/queue-merge.sh, the last being the cut.
Out of scope: ratifying ADR-0245, approving the mockup, any tag, publish or deploy. Start only after Kim has ratified ADR-0245 and approved the step 0 mockup.
Outcome: no file under packages/ or site/ reads a hand-tabled geometry value, the glyph prop, or the retired scale and density axes, and every control's computed height, padding and radius equals the value scale.mjs resolve gives. Why: one derived system replaces hand-tabled ramps, so a new control cannot drift and a density change is one attribute.
Measured by: `node scripts/foundations-census.mjs --gate` exits 0 on main with an empty allowlist; `node scripts/foundations-probe.mjs` reports zero mismatches against scale.mjs. before: 33 stylesheets with px geometry literals (20 control, 13 app), measured now by grep; target: 0 files in the census, 0 probe mismatches.
Rubric:
1. Gates | pass: the census gate and the probe both exit 0 on main and `npm run check` exits 0.
2. Merges | pass: CI is green on every merged PR and none merged on a stale base.
3. Look | pass: each family's screenshot at 400px and 1000px matches the approved step 0 mockup in the batched verifier's report.
4. Drift | pass: zero stale allowlist entries and zero controls whose computed geometry differs from the derived value.
Negative control: put one hand-tabled `padding: 13px` in a lane's stylesheet and confirm the census gate fails, then remove it; remove one allowlist entry for a still-violating file and confirm the gate fails.
How to work: run `steps.py lane` on each lane's ticket (L1 and L2 go solo; a planner replan happens at most once per lane, a second stops it). Wave 0 lands on main before any lane starts; each lane is a git worktree under .claude/worktrees with its own solo L2 agent, one writer per file, WIP commits early; lanes run `npm run check` plus the touched folders' tests only and CI runs the full suite; one conductor merges through the serial queue; there is no per-lane verifier, no plan review, no per-ticket filer, and a verifier nit never causes a rebuild; a verifier fail means fix and re-verify, never merge on a fail; stop and ask Kim before the cut PR.
Budget and stop rules: stop and write state to .sdlc/notes.md at $510 total (a backstop; Kim said no limits), $30 per lane, a rate or weekly limit, or three 529s in a row.
Authorization: only the following is authorized: you may create worktrees and branches, commit, push lane branches, open PRs, and merge them through the serial queue after CI is green. You may not ratify ADR-0245, approve the mockup, tag, publish, deploy, write to any external service, or merge the cut PR without Kim's sign-off.
Done when: `node scripts/foundations-census.mjs --gate` exits 0 on main with an empty allowlist, or you have stopped on the budget or a limit with the state written to .sdlc/notes.md.
```
