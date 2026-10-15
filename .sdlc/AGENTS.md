<!-- sdlc-lite:managed:start v1 sha256:d2f28357f67b -->
# Work records

This folder holds SDLC Lite tickets, task records, `roadmap.md`, `notes.md`, and `config`. `tickets.py roadmap` (also run by `new` and `close`) generates this block: do not edit inside it; change a ticket's `handoff.md` front matter and rerun `roadmap`. `roadmap.md` lists every ticket in dependency order. Closed `.NNNN-*` folders are history: open one only when asked.

- Ticket folders: next to this file.
- Mailbox: `messages/` is a git-ignored mailbox, not a record; follow `messages/AGENTS.md` to send, read, reply, ack, or expire a message with `<plugin-root>/scripts/messages.py`.
- `<plugin-root>` is the installed sdlc-lite plugin folder, the one holding `scripts/tickets.py`: `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in Codex, the folder two levels above the `sdlc-lite` skill.

## Stages

- proposed: 10
  - T-0187 split-pane demo stacks or scrolls at 400px instead of overflowing the column (split-pane-narrow-fit)
  - T-0188 line-chart projected dash: user-unit dash or a ruled screen-px exemption (line-chart-projected-dash)
  - T-0189 playing-card corner index: a type floor or a ruled pictorial exemption (playing-card-type-floor)
  - T-0190 site demos: inline type sizes and off-ramp spacing literals move to tokens (site-demo-inline-literals)
  - T-0193 OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card (option-deck)
  - T-0195 Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state (confirm-receipt)
  - T-0196 Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit (amount-picker)
  - T-0197 BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d' (bookingform-kinds)
  - T-0198 Step flow pattern: step n of m, Back and Next, shared /draft data (step-flow)
  - T-0199 Itinerary and Option compare patterns for Travel, Curator, Concierge and Shopkeeper (itinerary-compare)
- ready: 26
  - T-0160 Agent content as files: extract preset and pack seeds to .md manifests with a generated, drift-gated registry (agent-content-files)
  - T-0161 Agent content overlays: user edits as diffs over seeds, 3-way merge on seed update, one write path per kind (agent-content-overlays)
  - T-0162 Settings pane forms generated from each content kind's schema, with provenance, diff and reset (agent-content-schema-forms)
  - T-0163 One agent compiler for Test Chat, proxy, Worker and CLI, with a resolution trace and bundle digest in every turn trace (agent-content-compiler)
  - T-0168 Lint rules for the 2026-10 rulings: disabled recipe fleet-wide, 3:1 field outline, icon vs glyph, calendar cap, table pager, pill coverage, round-3 proposals (lint-rulings-coverage)
  - T-0169 Remove dead lint plumbing: adr_ratify, docs-grammar S8, census lane code, ADR wording in gates, [scale]/[density] bridge (lint-dead-plumbing)
  - T-0176 Agent eval framework 1: scenario format, replay in CI, runs.jsonl signal store, 15 persona smoke scenarios (eval-scenarios-store)
  - T-0177 Agent eval framework 2: report page (matrix heatmap, failure codes, digest trends, links to trace and screenshots) (eval-report)
  - T-0178 Agent eval framework 3: judged checks with a pinned judge model, rubrics per persona, seeded known-bad transcripts (eval-judged-checks)
  - T-0179 Agent eval framework 4: live matrix (personas x models x efforts x N) under a $5 cap, baselines, pass-rate floors, digest-affected selection (eval-matrix-baselines)
  - T-0203 Composer model controls: thinking off and show reasoning in the effort menu, web search and fetch toggles, server tools in requests, mid-conversation effort header (composer-model-controls)
  - T-0205 Context archaeology: how the a2ui producer builds context and routes (context-archaeology)
  - T-0209 One source per concept: layer membership, calibration bullets, persona list; mini-skill ranking stability test (context-single-source)
  - T-0214 Haiku 5.5 plays Croupier moves in prose without updating the table (croupier-haiku-state-in-prose), branch fix/lane-h-agent-behavior
  - T-0231 The Concierge cannot see the hours, policies and booking flow its own resources and playbooks hold (preset-knowledge-index-only), branch fix/lane-h-agent-behavior
  - T-0232 Croupier opens a blackjack-family game already dealt at a default stake, with no bet strip (croupier-opening-skips-bet), branch fix/lane-h-agent-behavior
  - T-0233 A playing-phase CardTable with no move Buttons passes the Croupier checks (croupier-playing-table-no-moves), branch fix/lane-h-agent-behavior
  - T-0234 Agents narrate surface ids and earlier-turn corrections in ordinary turns (narrated-surface-mechanics), branch fix/lane-h-agent-behavior
  - T-0240 Domain exemplars: CardTable, BookingForm and BoardGrid examples the producer can retrieve, plus a preset-to-domain mapping (domain-exemplars), branch feat/domain-exemplars-plumbing
  - T-0242 Move the ticket store to the sdlc-lite topics layout (.sdlc/tickets/, notes/, work/), committed (sdlc-topics-layout)
  - T-0246 Docs-page persona exemplar fixtures carry the same game and booking defects as the seeds (persona-exemplar-fixture-defects)
  - T-0247 validate-payload --catalog cannot load persona catalog ids (<base>--<persona>) (validate-payload-persona-ids)
  - T-0249 AGENTS.md is the single cross-harness source; CLAUDE.md is @AGENTS.md only (agents-md-single-source)
  - T-0250 Repo cleanup: reap merged worktrees, prune merged branches, delete ignored build dirs (repo-cleanup-oct)
  - T-0251 README, CONTRIBUTING, CHANGELOG pointer, package READMEs, plan, goals, roadmap, process refreshed (entry-plan-docs-refresh)
  - T-0252 Spec and LLD path scrub, app-shell superseded markers, skills and agents scrub, old tickets archived (specs-skills-scrub)
- claimed: 0
- paused: 0
- blocked: 1
  - T-0191 claude-review still fails in 0.5s with a working API key (not the credential) (claude-review-still-failing)
- done: 211
- dropped: 4

## Procedures

Folder layout:
- The top of `.sdlc` holds only ticket and task folders (a folder with a `handoff.md` or `plan-doc.md`), `AGENTS.md`, `CLAUDE.md`, `config`, `roadmap.md`, `board.md`, `notes.md`, `notes/`, `fleet.json`, `gate-ledger.jsonl`, `messages/`, `runtime/`, `supervisor/`, `evals/`, `proposals/`, `goals/`, `tickets/`, `work/`, `archive/`, and `_`- or `.`-prefixed entries. A `top_level_allow: <glob>, ...` line in `.sdlc/config` allows more.
- Run records (role results, attempts, `runs.jsonl`, `skips.md`) go in the git-ignored records dir `.sdlc/runtime/tasks/<folder>/` (`<plugin-root>/scripts/order.py records-dir .sdlc/<folder>` prints it). Notes go to `notes.md`, an answer to another agent goes by `messages.py send`, anything else into `archive/`.
- `python3 <plugin-root>/scripts/tickets.py --root .sdlc check` warns on any other top-level entry; `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy` lists its move into `archive/` and `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy --apply` makes it. Move nothing under `.sdlc` while a `*.running` marker exists: a role is using it.

Create a ticket:
1. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc new <feature|bug|chore|spike|idea> <slug> "<title>"`. Never pick an id by hand: `new` stamps the next id above every worktree's.
2. Fill in the body sections of the new `handoff.md`.

Ticket fields:
status: proposed | ready | claimed | paused | blocked | done | dropped
- `area:` is optional: the ticket's domain, one of the `areas:` names in `.sdlc/config`. It is never a lane or branch name.
- `paused_reason:` is the one-line reason a `status: paused` ticket waits; `status: claimed` needs `claimed_by:`.
- `branch:` and `worktree:` name the ticket's lane branch and its worktree (relative to the main checkout, under `.claude/worktrees/`); the lane opener writes both and its close removes both. `check` warns on a `worktree:` that is not a registered worktree on that branch.

Claim a ticket:
1. Open its `handoff.md`. A `claimed_by:` front matter line means another agent holds it: pick another ticket or ask the user.
2. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc claim <id> --by <agent>`, the agent one lowercase word (`claude`, `codex`, `astra`). It sets `status: claimed`, writes `claimed_by: <agent> <YYYY-MM-DD>` directly after `created:`, and runs `roadmap`. To take over a stale claim, add `--handover --reason "<why>"`.
3. Start the work through `run.sh`, which puts it in progress: `<plugin-root>/scripts/run.sh planner <level> .sdlc/<folder>/handoff.md`, or `/sdlc-lite:chain .sdlc/<folder>`. Progress shows on `/board`.
4. Release: `python3 <plugin-root>/scripts/tickets.py --root .sdlc release <id>`. Pause: set `status: paused` and add a one-line `paused_reason:`, then rerun `roadmap`.

Open a lane:
1. Claim the ticket first: `<plugin-root>/scripts/lanes.py open` refuses an unclaimed local ticket.
2. Run `python3 <plugin-root>/scripts/lanes.py open <name> --kind solo --ticket <id>`. It makes the worktree and branch under `.claude/worktrees/` and writes `branch: <lane branch>` and `worktree: <path>` after `claimed_by:`, so verified, unmerged work stays visible on the roadmap and in `lanes.py list --all`. A worktree made by hand: run `python3 <plugin-root>/scripts/tickets.py --root .sdlc branch <id> <branch> --worktree <path>`.
3. `lanes.py close <name>` removes the `branch:` and `worktree:` lines once the lane closes.

Close a ticket:
1. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --dry-run`. It checks the verifier verdict, lists each verifier `## Notes` line as `<i>. <tag>: <title>`, and ends with `expect <digest>`.
2. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --changed "<one line>"`. It appends `## Outcome` to the handoff. To file the one `decide:` follow-up worth a ticket, add `--ticket <i> --expect <digest>`. `note:` items and the other `decide:` items go to `notes.md`; `fix-now:` items are finished before the close. When it refuses because files cite the folder, add `--rewrite-refs` to rewrite them to the closed `.<folder>` path.
3. Only when a filer draft was asked for (`/file`): `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --filer`.
4. Work already done by another ticket: `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --reason "<why>"`.

Ticket lifecycle:
1. Pick and claim: `python3 <plugin-root>/scripts/tickets.py --root .sdlc claim <id> --by <agent>`.
2. Lane: `python3 <plugin-root>/scripts/steps.py lane .sdlc/<folder>` prints the lane.
3. Build: the solo agent, `/sdlc-lite:fix`, or `/sdlc-lite:chain .sdlc/<folder>`.
4. Verify: one independent verifier per ticket (`/sdlc-lite:verify`).
5. Land: `python3 <plugin-root>/scripts/fanout.py land <branch>` for a lane branch, else merge the branch.
6. Close: `python3 <plugin-root>/scripts/tickets.py --root .sdlc close <folder> --changed "<one line>"`, as in Close a ticket above.
<!-- sdlc-lite:managed:end -->

## Planned: the topics layout (T-0242)

Ticket folders sit directly under `.sdlc/<slug>/` today. T-0242 (ready, after T-0208, T-0239 and T-0241) moves every ticket to `.sdlc/tickets/<slug>/`, other task dirs to `.sdlc/work/`, and `notes.md` to `notes/notes.md`, with `tickets.py migrate-layout --rewrite-refs`. Until it lands, cite `.sdlc/<slug>/`; nothing moves by hand. `.sdlc/evals/` (live round archives, T-0241) holds no handoff, so it is not a task dir; T-0242's dry run confirms it stays.
