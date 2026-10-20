<!-- sdlc-lite:managed:start v1 sha256:f69c54345ea8 -->
# Work records

This folder holds SDLC Lite records in topic folders: `tickets/` (ticket folders and `tickets/roadmap.md`), `work/` (task folders with no ticket), `notes/` (`notes/notes.md`), and `messages/`, beside `config` and `_templates/`. `tickets.py roadmap` (also run by `new` and `close`) generates this block: do not edit inside it; change a ticket's `handoff.md` front matter and rerun `roadmap`. `tickets/roadmap.md` lists every ticket in dependency order. Closed `.NNNN-*` folders are history: open one only when asked.

- Ticket folders: `tickets/`; the same procedures are in `tickets/AGENTS.md`.
- Mailbox: `messages/` is a git-ignored mailbox, not a record; follow `messages/AGENTS.md` to send, read, reply, ack, or expire a message with `<plugin-root>/scripts/messages.py`.
- `<plugin-root>` is the installed sdlc-lite plugin folder, the one holding `scripts/tickets.py`: `${CLAUDE_PLUGIN_ROOT}` in Claude Code; in Codex, the folder two levels above the `sdlc-lite` skill.

## Stages

- proposed: 0
- ready: 13
  - T-0193 OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card (0193-option-deck)
  - T-0195 Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state (0195-confirm-receipt)
  - T-0196 Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit (0196-amount-picker)
  - T-0197 BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d' (0197-bookingform-kinds)
  - T-0198 Step flow pattern: step n of m, Back and Next, shared /draft data (0198-step-flow)
  - T-0199 Itinerary and Option compare patterns for Travel, Curator, Concierge and Shopkeeper (0199-itinerary-compare)
  - T-0374 Visible geometry changes from the skill model: glyph, field label, tiers, density heights, curvature presets (0374-foundations-geometry-visible)
  - T-0377 A Stylist ContrastPair inside a root Card renders a card in a card (round 12 cluster L) (0377-r12-contrastpair-card-in-card)
  - T-0378 The lone-Button rule never reaches poker Deal again turns (round 12 cluster O) (0378-r12-lone-button-routing)
  - T-0379 A Croupier check reads the reply's pot and bankroll against the table and across hands (round 12 cluster K) (0379-r12-poker-chip-drift)
  - T-0380 A poker hand settled through the data model only offers no Deal again (round 12 cluster M) (0380-r12-poker-showdown-no-deal-again)
  - T-0381 PlayingCard size sm renders its index under the type floor (round 12 cluster N) (0381-r12-playing-card-sm-type-floor)
  - T-0382 Blackjack: A2UI update renders before the turn summary (0382-blackjack-summary-order)
- claimed: 0
- paused: 0
- blocked: 1
  - T-0353 ADR-0245 W7 cleanup after the first published release: drop the glyph alias, old-name bridge, [scale], [density] and the legacy opt-out (GH #1937) (0353-foundations-final-cleanup)
- done: 363
- dropped: 4

## Procedures

Folder layout:
- The top of `.sdlc` holds only `AGENTS.md`, `CLAUDE.md`, `config`, `layout.md`, `board.md`, `tickets/`, `work/`, `notes/`, `messages/`, `runtime/`, `supervisor/`, `evals/`, `proposals/`, `dogfood/`, and `_`- or `.`-prefixed entries; ticket folders go in `tickets/`, task folders in `work/`. A `top_level_allow:` line only keeps `tidy` from moving a name; `check` still reports it.
- Run records (role results, attempts, `runs.jsonl`, `skips.md`) go in the git-ignored records dir `.sdlc/runtime/tasks/<folder>/` (`<plugin-root>/scripts/order.py records-dir .sdlc/tickets/<folder>` prints it). Notes go to `.sdlc/notes/notes.md`, an answer to another agent goes by `messages.py send`, anything else into `work/archive/`.
- `python3 <plugin-root>/scripts/tickets.py --root .sdlc check` warns on any other top-level entry; `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy` lists its move into `work/archive/` and `python3 <plugin-root>/scripts/tickets.py --root .sdlc tidy --apply` makes it. Move nothing under `.sdlc` while a `*.running` marker exists: a role is using it.

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
2. Run `python3 <plugin-root>/scripts/tickets.py --root .sdlc claim <id>`; `--by <agent>` names the claimant and wins, else it takes `$SDLC_HOST`, else the host (`claude:<session8>`, `codex:<thread>`). In git it first reserves `refs/sdlc/claims/<id>`, so a claim from any worktree refuses naming the holder. It sets `status: claimed`, writes `claimed_by: <agent> <YYYY-MM-DD>` directly after `created:`, and runs `roadmap`. To take over a stale claim, add `--handover --reason "<why>"`.
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
