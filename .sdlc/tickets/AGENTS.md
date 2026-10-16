<!-- sdlc-lite:managed:start v1 sha256:a1f623f1d7a1 -->
# Tickets

One folder per ticket: `<slug>/` or `NNNN-<slug>/` while open, `.NNNN-<slug>/` once closed. Stage counts and the open tickets are in `../AGENTS.md`. `tickets.py roadmap` generates this block: do not edit inside it.

- `<plugin-root>` is the installed sdlc-lite plugin folder, the one holding `scripts/tickets.py`: `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in Codex, the folder two levels above the `sdlc-lite` skill.

## Procedures

Folder layout:
- The top of `.sdlc` holds only ticket and task folders (a folder with a `handoff.md` or `plan-doc.md`), `AGENTS.md`, `CLAUDE.md`, `config`, `roadmap.md`, `board.md`, `notes.md`, `notes/`, `fleet.json`, `gate-ledger.jsonl`, `messages/`, `runtime/`, `supervisor/`, `evals/`, `proposals/`, `goals/`, `tickets/`, `work/`, `archive/`, and `_`- or `.`-prefixed entries. A `top_level_allow: <glob>, ...` line in `.sdlc/config` allows more.
- Run records (role results, attempts, `runs.jsonl`, `skips.md`) go in the git-ignored records dir `.sdlc/runtime/tasks/<folder>/` (`<plugin-root>/scripts/order.py records-dir .sdlc/tickets/<folder>` prints it). Notes go to `.sdlc/notes/notes.md`, an answer to another agent goes by `messages.py send`, anything else into `archive/`.
- `python3 <plugin-root>/scripts/tickets.py --root .sdlc check` warns on any other top-level entry; `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy` lists its move into `archive/` and `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy --apply` makes it. Move nothing under `.sdlc` while a `*.running` marker exists: a role is using it.

Create a ticket:
1. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc new <feature|bug|chore|spike|idea> <slug> "<title>"`. Never pick an id by hand: `new` stamps the next id above every worktree's.
2. Fill in the body sections of the new `handoff.md`.

Ticket fields:
status: proposed | ready | claimed | paused | blocked | done | dropped
- `area:` is optional: the ticket's domain, one of the `areas:` names in `.sdlc/config`. It is never a lane or branch name.
- `paused_reason:` is the one-line reason a `status: paused` ticket waits; `status: claimed` needs `claimed_by:`.
- `branch:` and `worktree:` name the ticket's lane branch and its worktree (relative to the main checkout, under the worktree root `../<repo>.worktrees/`, `wtroot.py root`); the lane opener writes both and its close removes both. `check` warns on a `worktree:` that is not a registered worktree on that branch.

Claim a ticket:
1. Open its `handoff.md`. A `claimed_by:` front matter line means another agent holds it: pick another ticket or ask the user.
2. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc claim <id> --by <agent>`, the agent one lowercase word (`claude`, `codex`, `astra`). It sets `status: claimed`, writes `claimed_by: <agent> <YYYY-MM-DD>` directly after `created:`, and runs `roadmap`. To take over a stale claim, add `--handover --reason "<why>"`.
3. Start the work through `run.sh`, which puts it in progress: `<plugin-root>/scripts/run.sh planner <level> .sdlc/tickets/<folder>/handoff.md`, or `/sdlc-lite:chain .sdlc/tickets/<folder>`. Progress shows on `/board`.
4. Release: `python3 <plugin-root>/scripts/tickets.py --root .sdlc release <id>`. Pause: set `status: paused` and add a one-line `paused_reason:`, then rerun `roadmap`.

Open a lane:
1. Claim the ticket first: `<plugin-root>/scripts/lanes.py open` refuses an unclaimed local ticket.
2. Run `python3 <plugin-root>/scripts/lanes.py open <name> --kind solo --ticket <id>`. It makes the worktree and branch under the worktree root (`../<repo>.worktrees/`) and writes `branch: <lane branch>` and `worktree: <path>` after `claimed_by:`, so verified, unmerged work stays visible on the roadmap and in `lanes.py list --all`. A worktree made by hand: run `python3 <plugin-root>/scripts/tickets.py --root .sdlc branch <id> <branch> --worktree <path>`.
3. `lanes.py close <name>` removes the `branch:` and `worktree:` lines once the lane closes.

Close a ticket:
1. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --dry-run`. It checks the verifier verdict, lists each verifier `## Notes` line as `<i>. <tag>: <title>`, and ends with `expect <digest>`.
2. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --changed "<one line>"`. It appends `## Outcome` to the handoff. To file the one `decide:` follow-up worth a ticket, add `--ticket <i> --expect <digest>`. `note:` items and the other `decide:` items go to `.sdlc/notes/notes.md`; `fix-now:` items are finished before the close. When it refuses because files cite the folder, add `--rewrite-refs` to rewrite them to the closed `.<folder>` path.
3. Only when a filer draft was asked for (`/file`): `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --filer`.
4. Work already done by another ticket: `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --reason "<why>"`.

Ticket lifecycle:
1. Pick and claim: `python3 <plugin-root>/scripts/tickets.py --root .sdlc claim <id> --by <agent>`.
2. Lane: `python3 <plugin-root>/scripts/steps.py lane .sdlc/tickets/<folder>` prints the lane.
3. Build: the solo agent, `/sdlc-lite:fix`, or `/sdlc-lite:chain .sdlc/tickets/<folder>`.
4. Verify: one independent verifier per ticket (`/sdlc-lite:verify`).
5. Land: `python3 <plugin-root>/scripts/fanout.py land <branch>` for a lane branch, else merge the branch.
6. Close: `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --changed "<one line>"`, as in Close a ticket above.
<!-- sdlc-lite:managed:end -->
