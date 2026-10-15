# Overnight goal, agent-ui, 2026-10-05

## Goal
By morning, four independent items are each done on their own branch off `origin/main` with a draft PR, or stopped with a recorded reason. Nothing is merged, deployed, or left half-edited on `main`.

## Approved by Kim (2026-10-05)
Unattended run of the items below. Authorized: create item branches, run roles through `scripts/run.sh`, push item branches, open DRAFT PRs, comment on the item's own issue. Not authorized: merging anything, pushing to `main`, deploying (merges to `main` auto-deploy ui.nonoun.io), ratifying an ADR, editing `~/.claude`, publishing to npm.

## Start state (check first, do not assume)
- PRs #1799 (AGENTS.md router) and #1800 (catalog selection guidance, ADR-0232 accepted) may still be open. Run `gh pr list --state open`. If a PR is open, base each item on `origin/main` and rebase onto it before the PR if files overlap (#1800 touches the a2ui skills, `catalog/`, `agent/`, the spec, LLD and rubric).
- `.sdlc/` is untracked local state; never commit it.
- Read `AGENTS.md`, `CLAUDE.md`, and `.claude/docs/process.md` section 1 (docs-only gates) before editing.

## Items, in this order (each its own branch, worktree and draft PR)
1. **#1798 Stale plugin references (size S, docs and skills).** About 18 files under `.claude/skills` and `.claude/agents` name agents from plugins that #1791 disabled (`frontend:`, `teamwork:`, `docs:`, `design:`). Find with `git grep -lE 'teamwork:|frontend:|docs:(doc|scribe)|design:' -- .claude`. Repair each to name a seat that loads here (for example `a2ui-review-agent`, `component-build-agent`, the sdlc-lite roles) or say plainly when no reviewer seat exists. Do not edit `.claude/settings.json` and do not re-enable plugins: that is Kim's call, record it as a question in the report. Done when the grep is empty outside deliberate historical mentions, each of which is listed in the PR body, and `npm run check` and `doc_lint` are green.
2. **Nested AGENTS.md (docs).** Add `packages/agent-ui/a2ui/AGENTS.md` (byte-pinned prompt stack, the `prompt-equivalence` recapture flow, the catalog and selection-sidecar rules, trust boundary) and `packages/agent-ui/components/AGENTS.md` (layer order, descriptor-generated files, naming, sizing law). Each at most 40 lines, link-first, no restated ADR text; every cited path must exist. Add a `CLAUDE.md` containing `@AGENTS.md` beside each (the repo's convention). Leave the root `CLAUDE.md` alone. Done when `onboard.py check` is unaffected and `npm run check` is green.
3. **#1797 Runtime gaps, one PR per gap, smallest first.** Order: (a) dev-proxy abort propagation (`a2ui/tools/agent/dev-proxy-plugin.ts`, pass the request's abort signal into `produce` and `buildToolDispatch`), (b) a generic per-call timeout in `tool-dispatch.ts` that does not double-wrap the 10 s built-in and MCP timeouts, (c) a turn deadline and a stall guard on the Anthropic SSE read, (d) transport retry with bounded backoff for 429 and 5xx only, never for tool execution. Skip token accounting: it needs a design decision, so write it up as a `decide:` item. Each gap: planner L2 or higher, plan reviewer if any step is L4, tests that fail before and pass after (red-then-green, see skill `checks-that-bite`), and a PROPOSED ADR only if it changes a documented contract. Stop an item at the first design question and record it.
4. **Close out stale .sdlc task folders (local tidy, no PR).** For task folders under `.sdlc/` whose work has merged (`remove-ops`, `croupier-round-surface`, `agents-md`, `catalog-notfor-intents`, `ratify-adr-0232`, plus any others `gh pr list --state merged` confirms), add `status: done` front matter to the folder's `handoff.md` so rag-board stops showing them. Verify with `python3 ~/.claude/skills/rag-board/scripts/ragboard.py render --waiting "overnight"`. Never delete a run record.

## Rules for every item
- Route work through `/sdlc-lite:chain` or `/sdlc-lite:fix`; roles run through `scripts/run.sh`; never plan, build, or verify your own change.
- Escalation is bounded: one rebuild and one level bump per step, then stop that item. A `plan defect` goes to one planner L3 replan, never more. `inherited red` stops the item.
- A fork that opens a PR is a defect: only the conductor publishes.
- Gates by exit code. `npm run check` after every change; the touched package's tests; docs-only diffs gate on `doc_lint` plus `check`. Prompt, catalog or baseline changes use the deliberate recapture flow in skill `a2ui-prompt-authoring`.
- No em dashes anywhere. Dated or generated files are never hand-edited.
- Unattended: never call AskUserQuestion. Any decision, any ADR ratification, any scope widening goes in the report under "Needs you" and the item stops.
- Use a separate git worktree per item. Do not switch branches in a checkout while a role is reading it.
- Reap what you start: no leftover dev servers, browsers, or worktrees. Check with `git worktree list` at the end.

## Morning report
Write `.sdlc/overnight-2026-10-05/report.md` and print it as the final message:
- One line per item: done (draft PR link), stopped (reason, last gate output), or skipped.
- "Needs you": every decision, ratification, or scope question, one line each, recommendation first.
- Gate evidence: the exit codes of `npm run check` for each branch.
- Anything surprising: red CI, base drift, files touched outside the item.
