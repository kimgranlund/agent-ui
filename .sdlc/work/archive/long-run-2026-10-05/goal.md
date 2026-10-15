# Long-running goal, agent-ui, from 2026-10-05

## Goal
Close out epic #1817: every item below is merged-ready (green draft PR, verifier pass) or stopped with a recorded reason. Nothing is merged, deployed or ratified by this run.

## Authority
Allowed: worktree lanes off `origin/main`, roles through `run.sh`, `fanout.py` lanes, pushing item branches, DRAFT PRs, PR and issue comments, `.sdlc` records, reaping worktrees this run made.
Not allowed: merging, pushing `main`, deploying (merges auto-deploy ui.nonoun.io), ratifying an ADR, editing `~/.claude`, publishing to npm, AskUserQuestion (unattended: decisions go to the report and the item stops).

## Lane budget
- Hard cap 20 lanes. Start cap 5 lanes x `--maxWorkers=4`: that is the ruled ceiling (#1818, 20-core M1 Ultra). Raising it above 5 needs Kim to record an amendment; until then the effective cap is 5 and the rest queue.
- Before each dispatch: lanes = min(ready independent items, cap, floor((40 - load) / 6)). Load over 40 stops dispatch. Max 2 browser-shard lanes, max 2 full-suite lanes.
- A 429 or "session limit" from `run.sh` is not a failure and not a replan: pause all dispatch until the stated reset, then rerun the same role once. Never count it toward a bump or stop rule.
- Dependencies cap real parallelism near 6 to 8 lanes today. Do not invent splits to fill lanes.

## Waves (dependency order; fan out within a wave)
Wave 0, now, 1 lane each:
- W0a CI watch for #1820, #1821, #1822: fix red CI on the branch, rebase on `origin/main` after any merge, squash nothing. Stop on a red that is not ours.
- W0b Close T-0009 and #1816 as done by #1818. Reap merged worktrees (`gap-tool-timeout`, `rebase-retry2`, `wave-ceiling`, `wave-croupier`) with `ops:reap-worktrees`, dry run first.
- W0c No-barrels chain T-0012 / #1814: continue `.sdlc/work/no-barrels` steps 3 to 8 in `wave-nobarrels`, one step at a time. Serial by design, one lane.

Wave 1, design lanes, read-only, run in parallel with Wave 0 (architect L1 then planner, plan review, no builds):
- W1a T-0010 admin headless flows (#1815): design stops at fork 3 (runner) unless Kim recorded it in the ticket.
- W1b T-0011 A2UI test kit: architect then plan, ordered after W1a's runner decision; consumes T-0005's pin-file rule.
- W1c T-0008 dogfood selection guidance: architect, stops at its design question.
- W1d #1812 persona manifest, #1807 registry, #1808 asset embed: one architect lane each, plans only. They build only after W0c lands (they edit the same generated surface).

Wave 2, after W0c merges (Kim merges it): build W1 plans. Fan out one lane per ticket with disjoint files; `steps.py lane` picks solo for size S and M, chain otherwise. T-0010 and T-0011 builders share the Playwright seam: run them in separate lanes only if their step scopes are disjoint, else serial.

Blocked, not started: T-0004 (needs Kim's Haiku and Sonnet fixtures), then T-0007 (shares the baseline). If the fixtures appear at `croupier/__fixtures__/`, start T-0004 as one lane, then T-0007.

## Rules for every lane
- Lane first: `steps.py lane <task dir>`; record `Lane: <lane> because <reason>`.
- One PR per ticket, branch off `origin/main`, never main. A lane whose branch lacks a prerequisite merged since it started rebases before its next step.
- Escalation bounded: one rebuild and one bump per step; `plan defect` goes to one planner L3 replan; a second replan verdict, `inherited red`, or an unresolved scope question stops that item.
- Gates by exit code. `npm run check` plus the touched package's tests; the full suite only in its own lane. Prompt, catalog or baseline edits use the recapture flow in skill `a2ui-prompt-authoring`.
- Records: stale docs and skills are repaired in the same change (the ticket's scrub list); no em dashes.
- Reap what you start: worktrees, dev servers, browsers. Never kill another session's processes.

## Stop conditions
- Done: every wave item is a green draft PR or recorded stop, and `git worktree list` holds only live lanes.
- Pause (not stop): rate limit, load over 40.
- Hard stop, come to Kim: any ADR needing ratification, any design fork, scope widening, a second replan verdict, red main.

## Report
Write `.sdlc/long-run-2026-10-05/report.md` after each wave and at the end: one line per item (draft PR link, stopped with reason, or queued), a "Needs you" list (recommendation first), CI and gate exit codes, and anything surprising.
