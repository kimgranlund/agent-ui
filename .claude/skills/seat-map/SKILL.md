---
name: seat-map
description: >-
  Wiring-only: preloaded by the repo-orchestrator-agent seat as its seat-ownership map and
  standing dispatch laws. Not user-invocable, not a routing target.
user-invocable: false
disable-model-invocation: false
---

# agent-ui seat map & dispatch laws

## Seat map — route by ownership

| Artifact class | Maker seat | Critic seat |
|---|---|---|
| ui-* control source / CSS / geometry | `component-build-agent` | `frontend:component-checker` (NON-optional before a control-wave commit) |
| `@agent-ui/a2ui` package / renderer / catalog code | `a2ui-build-agent` | `a2ui-review-agent` |
| A2UI payload composition (message streams) | `a2ui-payload-authoring-agent` | `a2ui-review-agent` |
| Docs-site pages / shell / non-preview prose | `teamwork:docs-writer` | `teamwork:code-checker` |
| Preview specimens + knobs in `site/lib/component-preview.ts` | `example-authoring-agent` | host judges representativeness |
| Color / dimension tokens | `design:token-builder` | `frontend:component-checker` (consuming control) |
| PRD / SPEC / LLD / ADR authoring | `teamwork:planner` | `docs:doc-checker` |
| Non-UI code diffs / slices | `teamwork:builder` | `teamwork:code-checker` |
| Broad searches / codebase questions | `Explore` (read-only, conclusions not dumps) | — |
| Measured experiment loops (regressions, tuning, stress) | `docs:experiment-runner` | host verifies the report |
| A2UI corpus record admission/judging (ADR-0068) | `a2ui-corpus-curation` (skill, host-run or briefed) | `a2ui-review-agent` (the VerdictsFile judge — never the seed's own author) |
| One confirmed work-item build (feature/task/bug, by issue id) | `teamwork:build-leader` | per-artifact critic above |
| Raw report/idea intake → durable records | `docs:intake-leader` | — (intake only, structurally cannot dispatch builds) |
| A SKILL.md's contract/shape | maker of the change | `harness:skill-checker` |
| An agents/*.md definition | maker of the change | `harness:agent-checker` |
| A hook (registration + script) | maker of the change | `harness:hook-checker` |
| Prompt-carrying wording (a brief, a description, a CLAUDE.md line) | maker of the change | `harness:wording-checker` |
| Skill/agent/team wiring + frontmatter composition | maker of the change | `teamwork:wiring-checker` |
| One screen/shell/page layout | maker of the change | `frontend:layout-checker` |
| A cross-screen user flow (*.flow.json, journeys) | maker of the change | `frontend:flow-checker` |

`example-authoring-agent` and `docs-writer` share `component-preview.ts` by concern — never dispatch both
onto that file concurrently.

## Dispatch laws — copy the directive, point at the law

Subagents inherit the repo CLAUDE.md, so briefs copy the *directive*, not the law's full text:

- **Foreground gates.** Every build brief MANDATES running `npm run check && npm test` (plus the
  browser gate when the slice touches rendering) in the seat's own foreground context, judged by
  EXIT CODES cited in the report — a seat never ends a turn waiting on a backgrounded gate run
  (4/9 batch workers stalled exactly there, 2026-08-18); backgrounded gate runs are forbidden.
- **Batch gate topology.** When N workers run concurrently on one host, each brief carries
  REDUCED targeted gates — `npm run check` + the slice's own tests + the specific shared-file
  gates it touches — and the DESK runs the ONE full suite on merged main; that single desk run
  caught the one real red all nine reduced gates missed (2026-08-18).
- **Worktree trap — SYMLINK, don't install (Kim ruling 2026-08-20, the load-108 incident).** A
  worktree without its own `node_modules` resolves `@agent-ui/*` through the MAIN checkout and
  lies to import-resolving gates; but per-lane `npm install` was the load-108 root cause (seven
  lanes × install churn, Spotlight indexing every byte). The brief now mandates, in order: (1)
  `git diff --quiet origin/main -- package-lock.json` — lockfile unchanged ⇒ (2) the
  PER-ENTRY symlink recipe below (amended 2026-08-19, the ADR-0224 S2 phantom-TS2345 finding: a
  whole-root `ln -s <root>/node_modules` splits TypeScript type identity, because the root's
  `node_modules/@agent-ui/*` workspace links point back into MAIN's packages/ — workspace imports
  then typecheck against main's sources while relative imports use the worktree's, and `npm run
  check` goes red on a clean tree); lockfile CHANGED ⇒ `npm ci --prefer-offline` (the one case an
  install is earned); then (3) `readlink node_modules/@agent-ui/shared` MUST print a path inside
  THIS worktree, never the main checkout. **A scratch-clone dispatch (the `Agent`-tool isolation
  rung, no `EnterWorktree` reach) runs `node scripts/bootstrap-scratch-clone.mjs <clone-dir>
  [--root <path>]` (GH #1695) instead of the by-hand recipe below** — it mechanizes exactly this
  recipe and performs step (3)'s verify itself, exiting non-zero on failure; a live worktree
  session still applies the recipe by hand (no clone-dir argument shape fits there). The recipe,
  for the worktree case or to understand what the script automates:
  ```
  mkdir node_modules && for d in <root>/node_modules/* <root>/node_modules/.[!.]*; do ln -s "$d" node_modules/; done
  rm node_modules/@agent-ui && mkdir node_modules/@agent-ui
  for p in packages/agent-ui/*; do ln -s "$PWD/$p" "node_modules/@agent-ui/$(basename "$p")"; done
  ```
  The second glob term links DOTFILE entries too — a bare `*` silently skips `.bin`/`.package-lock.json`
  and the lane dies with `spawn node_modules/.bin/vite ENOENT` (marshal finding, live on the 0223-S3
  lane, 2026-08-19). Third-party deps share main's store (zero churn); @agent-ui/* resolves to the worktree's own
  sources (type identity intact). A red `check` in a worktree whose readlink points at MAIN is
  ENVIRONMENT, not regression — the desk re-gates on merged main before trusting either verdict.
  Never a bare `npm install` in a worktree.
- **Host-shell worktree pin (marshal finding, 2026-08-23).** A HOST session whose shell cd's into
  a seat's `.claude/worktrees/` entry gets pinned there by the isolation guard: subsequent git
  commands that redirect to the shared checkout are refused, so the host can neither reap that
  worktree nor fast-forward the primary's `main`. Recovery: the OWNING seat reaps its own worktree
  and branch from the primary checkout (one SendMessage), never a cd-and-hope from the pinned
  shell; once the worktree is gone the pin is moot and the host shell re-anchors on the primary.
  Prevention: the host never cd's into a seat worktree — reads go through absolute paths.
- **Concurrency ceiling (Kim ruling 2026-08-20).** At most **3 gate-running lanes** concurrent
  on this host (10 cores: `(cores − 2) / 3`, rounded down — each lane's vitest + a checker's
  Chromium shard is ~3 cores of real load); builders beyond the ceiling QUEUE, they don't fan
  out. Every worktree gate command carries `--maxWorkers=4` (3 lanes × 4 = 12 ≈ cores, never
  N×cores). A desk that sees 1-min load > 40 stops dispatching and reaps finished worktrees
  FIRST — `flaky-gates` owns the red-under-load verdict, this law owns not getting there.
- **Stacked PRs: retarget children BEFORE deleting the base (GH #1494, 2 kills 2026-08-20).**
  Merging a stack-bottom PR with `--delete-branch` makes GitHub auto-CLOSE every child PR based
  on that branch, and a closed-by-base-deletion PR refuses `gh pr reopen`. Landing a stack:
  merge the bottom WITHOUT `--delete-branch`, `gh pr edit <child> --base main` (or the next
  base), THEN delete the branch. Recovery when hit: rebase the child's head
  `--onto origin/main <old-base-tip>`, push a fresh branch, re-land as a new PR (the #1472/#1473
  precedent).
- **Reap on lane-return, not campaign-end.** A lane's worktree is removed the moment its branch
  is merged (or abandoned) — `git worktree remove` + the branch delete — never parked until the
  campaign closes; every parked worktree is a full tree Spotlight/Time Machine keep re-scanning.
  Run it after EVERY merge: `node scripts/reap-worktrees.mjs --execute && node scripts/
  reap-branches.mjs --execute` (worktree removal first, branch deletion second — the worktree
  gate's own Rule 3 equivalent, "never touch a locked worktree," is what makes this safe to run
  unattended; GH #1440).
- **Maker ≠ critic, serialized.** The building seat never grades its own slice; never send an
  author a revision directive while its reviewer is mid-read — freeze → review → consolidate →
  one revision pass.
- **Brief by name.** Every dispatch names its seat and bounds its task; no open work-queues to
  self-claim from.
- **Work items → GitHub Issues.** New items file via `gh issue create` (ADR-0145), never new
  ticket files.
- **Due process for size:big (GH #969).** Any dispatch brief for a `size:big` issue/PR cites the
  `due-process` skill by name before design work starts — the four-phase Understand/Research →
  Plan → Execute → Evaluate loop, each phase with its own checkable exit artifact.
  `size:small` is unaffected.
- **Marshal never rides a fix-inline fork (2026-08-28).** A fork (`context: fork` skill, e.g.
  docs:file-bug) invoked from a marshal-held session inherits the marshal's identity, so its
  fix-inline branch is the marshal building inline — barred by the 2026-08-27 marshal carve-out.
  From this seat, intake dispatches are record-only; the fix is a separate build dispatch.
  Upstream guard: claude-plugins#961 / PR claude-plugins#969 (docs 1.21.15) — distinct from this
  repo's own GH #969 cited above.
