# T-0242 rehearsal clone diff summary (base 2262bde2, clone /private/tmp/claude-501/scratch/t0242)

 1584 files changed, 1512 insertions(+), 1440 deletions(-)

## Renames by destination
   1 .sdlc/notes
1198 .sdlc/tickets
 305 .sdlc/work

## Non-rename changes outside .sdlc/tickets and .sdlc/work
M	.claude/docs/adr/0241-lazy-catalog-bodies-behind-an-eager-manifest.md
M	.claude/docs/adr/0244-next-preset-widgets-result-card-contrast-pair.md
M	.claude/docs/adr/0245-foundations-derive-from-one-n.md
M	.claude/docs/lld/response-type-selection.lld.md
M	.claude/docs/prd/response-type-selection.prd.md
M	.claude/skills/project-facts/SKILL.md
M	.sdlc/AGENTS.md
A	.sdlc/config
D	.sdlc/dogfood-data-charts-nav/handoff.md
D	.sdlc/dogfood-entry-atoms/handoff.md
D	.sdlc/dogfood-lint-rules-2/handoff.md
D	.sdlc/dogfood-review-2/part-a/handoff.md
D	.sdlc/dogfood-review-2/part-b/handoff.md
D	.sdlc/dogfood-review-2/part-c/handoff.md
M	.sdlc/evals/rounds/2026-10-15-t0208-probe/live-commands.sh
M	.sdlc/evals/rounds/2026-10-15-t0208-probe/report.md
D	.sdlc/foundations-repin-a01/handoff.md
D	.sdlc/foundations-repin-a02/handoff.md
D	.sdlc/foundations-repin-a03/handoff.md
D	.sdlc/foundations-repin-a04/handoff.md
D	.sdlc/foundations-repin-a05/handoff.md
D	.sdlc/foundations-repin-a06/handoff.md
D	.sdlc/foundations-repin-a07/handoff.md
D	.sdlc/foundations-repin-a08/handoff.md
D	.sdlc/foundations-repin-a10/handoff.md
D	.sdlc/harness-gaps/scout-L1-2.md
A	.sdlc/notes/AGENTS.md
A	.sdlc/notes/CLAUDE.md
D	.sdlc/renderer-lazy-spike/verifier-L2.md
D	.sdlc/repin-md-a01/handoff.md
D	.sdlc/repin-md-a02-a04/handoff.md
D	.sdlc/repin-md-a05-a10/handoff.md
D	.sdlc/repin-md-app-unlaned/handoff.md
D	.sdlc/repin-v2-containers-widgets/handoff.md
D	.sdlc/repin-v2-entry-action/handoff.md
D	.sdlc/repin-v2-indicators-atoms-nav/handoff.md
D	.sdlc/repo-cleanup-oct/copied-records.txt
D	.sdlc/roadmap.md
D	.sdlc/skills-em-dash-1/T-0050-solo.dispatch.json
D	.sdlc/skills-em-dash-2/T-0051-solo.dispatch.json
D	.sdlc/skills-em-dash-3/T-0052-solo.dispatch.json
D	.sdlc/ui-board-grid/refusals.jsonl
M	AGENTS.md
M	docs/AGENTS.md
M	docs/layout.md
M	packages/agent-ui/a2ui/src/catalog/personas/croupier/hands.fixture.ts

## Files modified with a rename
     304

## File count under .sdlc
base 1689, after 1696; added: .sdlc/config, .sdlc/notes/{AGENTS,CLAUDE}.md, .sdlc/tickets/{AGENTS,CLAUDE}.md, .sdlc/work/{AGENTS,CLAUDE}.md (router files)
The D lines above are renames git did not pair (small files whose path refs were rewritten); each exists at its new path.

## Hand fixes rehearsed
- docs/layout.md: Frozen paths list line held prose after the glob; onboard.py setup refused (exit 1) until it was one glob per line.
- .sdlc/AGENTS.md: the Planned T-0242 section rewritten as the landed layout.
- .claude/skills/project-facts/SKILL.md: decision row cites .sdlc/tickets/<NNNN-slug>/handoff.md.
- tickets.py new probe: wrote .sdlc/tickets/0256-probe-topics/handoff.md (discarded).
