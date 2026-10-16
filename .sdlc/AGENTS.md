<!-- sdlc-lite:managed:start v1 sha256:fbfa72435e7d -->
# Work records

This folder holds SDLC Lite records in topic folders: `tickets/` (ticket folders and `tickets/roadmap.md`), `work/` (task folders with no ticket), `notes/` (`notes/notes.md`), and `messages/`, beside `config` and `_templates/`. `tickets.py roadmap` (also run by `new` and `close`) generates this block: do not edit inside it; change a ticket's `handoff.md` front matter and rerun `roadmap`. `tickets/roadmap.md` lists every ticket in dependency order. Closed `.NNNN-*` folders are history: open one only when asked.

- Ticket folders: `tickets/`; the same procedures are in `tickets/AGENTS.md`.
- Mailbox: `messages/` is a git-ignored mailbox, not a record; follow `messages/AGENTS.md` to send, read, reply, ack, or expire a message with `<plugin-root>/scripts/messages.py`.
- `<plugin-root>` is the installed sdlc-lite plugin folder, the one holding `scripts/tickets.py`: `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in Codex, the folder two levels above the `sdlc-lite` skill.

## Stages

- proposed: 11
  - T-0187 split-pane demo stacks or scrolls at 400px instead of overflowing the column (0187-split-pane-narrow-fit)
  - T-0188 line-chart projected dash: user-unit dash or a ruled screen-px exemption (0188-line-chart-projected-dash)
  - T-0189 playing-card corner index: a type floor or a ruled pictorial exemption (0189-playing-card-type-floor)
  - T-0190 site demos: inline type sizes and off-ramp spacing literals move to tokens (0190-site-demo-inline-literals)
  - T-0193 OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card (0193-option-deck)
  - T-0195 Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state (0195-confirm-receipt)
  - T-0196 Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit (0196-amount-picker)
  - T-0197 BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d' (0197-bookingform-kinds)
  - T-0198 Step flow pattern: step n of m, Back and Next, shared /draft data (0198-step-flow)
  - T-0199 Itinerary and Option compare patterns for Travel, Curator, Concierge and Shopkeeper (0199-itinerary-compare)
  - T-0315 Admiral and Lexicographer share the agent-ui catalog: 'New game' ranks the word board first on the Admiral's opening (0315-shared-catalog-cross-game-retrieval)
- ready: 20
  - T-0160 Agent content as files: extract preset and pack seeds to .md manifests with a generated, drift-gated registry (0160-agent-content-files)
  - T-0161 Agent content overlays: user edits as diffs over seeds, 3-way merge on seed update, one write path per kind (0161-agent-content-overlays)
  - T-0162 Settings pane forms generated from each content kind's schema, with provenance, diff and reset (0162-agent-content-schema-forms)
  - T-0163 One agent compiler for Test Chat, proxy, Worker and CLI, with a resolution trace and bundle digest in every turn trace (0163-agent-content-compiler)
  - T-0168 Lint rules for the 2026-10 rulings: disabled recipe fleet-wide, 3:1 field outline, icon vs glyph, calendar cap, table pager, pill coverage, round-3 proposals (0168-lint-rulings-coverage)
  - T-0169 Remove dead lint plumbing: adr_ratify, docs-grammar S8, census lane code, ADR wording in gates, [scale]/[density] bridge (0169-lint-dead-plumbing)
  - T-0176 Agent eval framework 1: scenario format, replay in CI, runs.jsonl signal store, 15 persona smoke scenarios (0176-eval-scenarios-store)
  - T-0177 Agent eval framework 2: report page (matrix heatmap, failure codes, digest trends, links to trace and screenshots) (0177-eval-report)
  - T-0178 Agent eval framework 3: judged checks with a pinned judge model, rubrics per persona, seeded known-bad transcripts (0178-eval-judged-checks)
  - T-0179 Agent eval framework 4: live matrix (personas x models x efforts x N) under a $5 cap, baselines, pass-rate floors, digest-affected selection (0179-eval-matrix-baselines)
  - T-0203 Composer model controls: thinking off and show reasoning in the effort menu, web search and fetch toggles, server tools in requests, mid-conversation effort header (0203-composer-model-controls)
  - T-0205 Context archaeology: how the a2ui producer builds context and routes (0205-context-archaeology)
  - T-0209 One source per concept: layer membership, calibration bullets, persona list; mini-skill ranking stability test (0209-context-single-source)
  - T-0246 Docs-page persona exemplar fixtures carry the same game and booking defects as the seeds (0246-persona-exemplar-fixture-defects)
  - T-0247 validate-payload --catalog cannot load persona catalog ids (<base>--<persona>) (0247-validate-payload-persona-ids)
  - T-0307 Sweep docs-site pages, descriptors, exemplar fixtures and selection sidecars for guidance left stale by rounds 3 to 7 (0307-stale-surface-sweep)
  - T-0309 Infer flowEnd when a turn declares no ask and no surface instead of a FLOW_END_MISSING repair round (Kim's N1 ruling) (0309-flowend-inference)
  - T-0310 R8 experiment: force render_surface with thinking off on round 1 of Haiku click turns (0310-haiku-round1-forced-tool)
  - T-0311 Dev trace: content-addressed prompt store, stopReason and max_tokens per round, and the max_tokens tier floor (P3, P7) (0311-trace-prompt-store)
  - T-0314 Check contracts: pass and fail fixtures cross-run across all checks, a repair-text vocabulary test, and a repair-loop property test (P2) (0314-check-contract-tests)
- claimed: 0
- paused: 0
- blocked: 0
- done: 280
- dropped: 4

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

## Topics layout (T-0242, 2026-10-15)

Tickets live in `.sdlc/tickets/<NNNN-slug>/` (`.NNNN-<slug>/` once closed and archived), other task dirs in `.sdlc/work/`, notes in `.sdlc/notes/notes.md`, and the generated roadmap in `.sdlc/tickets/roadmap.md` (`ticket_root: tickets`, `layout: topics` in `.sdlc/config`). `.sdlc/evals/` (live round archives, T-0241) holds no handoff and stays at the top. Cite a ticket by its `.sdlc/tickets/` path.
