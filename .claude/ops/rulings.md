# Standing ops rulings (Kim, via host AskUserQuestion rounds)

## Seat-payload landing leg — RULED 2026-08-09: chore-lead lands all

Ops seats (decision-watcher, issue-sorter, repo-cleaner, chore-planner) RETURN their state
payloads and reports; **chore-lead's close-out always writes them to `.claude/ops/` before
reporting up**. Seats do not write ops state directly; the dispatching session verifies nothing —
the landing is chore-lead's own final leg, part of its done-condition.

- Every future chore-lead dispatch brief MUST carry this contract explicitly (the host's dispatch
  prompt is the enforcement point until the agent definition itself encodes it).
- The agent definitions live in the harness plugin (nonoun-plugins repo) — encoding this into
  `chore-lead.md`'s own body is a separate change in that repo, flagged, not done from here.
- Supersedes the per-firing ad-hoc judgment that produced three different landing paths
  (file write / inline / dispatcher-applied) in the 2026-08-08 firings, and retires the
  recurring "verify the landing" queue entries.

## Friendlies standing_rule — RULED 2026-08-08 (recorded in friendlies.json): hold-first-filing

Re-confirmed by Kim 2026-08-09. `friendlies.json` policy block is the canonical record.

## #613 fix path — RULED 2026-08-09: evidence-first

Tracker stays open; capture `gh pr merge`'s verbatim output at the next survivor before manual
cleanup. Best-fitting variable so far: branch checked out in a linked worktree at merge time
(#622) vs. not checked out anywhere (#618–#621, clean). Full evidence: #613's 2026-08-09 comment.

## ADR harvest confirm — RULED 2026-08-09: harvest all three

ADR-0173 → new reference file in `agent-ui-component-standards` · ADR-0174 → new skill (a2ui
producer meta-line/envelope architecture, narrow scope) · ADR-0175 → new reference file in
`agent-ui-component-design`. Dispatched 2026-08-09; adr-queue.json rows advance on landing.
