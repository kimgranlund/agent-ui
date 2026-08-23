# Held items — kimgranlund/agent-ui

Denial/hold ledger for the issue-sorter watch/triage/trust contract
(`spec-ticketing-watch-triage.md`). Append-only. A denied item is never re-surfaced.

No items held as of 2026-08-04T08:30:01Z (first firing) — every item discovered this sweep was
authored by the evidence-seeded owner (`kimgranlund`), so nothing reached the trust-check hold.

## Kim's ruling/merge queue

- 2026-08-22T21:40Z · **#1583 — @agent-ui/app marginal budget +104 B gz** · ruling needed. Bisected by build-1583 to commit c6784a0c (Kim-directed hover→-dim/-high, ADR-0008 Am.2) — deliberate, not drift. ADR-0197 cl.5 bars upward re-basing except via ruled exception. Options: (a) bump APP_MARGINAL_BUDGET ceiling by ~104 B citing ADR-0008 Am.2; (b) other. Ticket left OPEN, claim released. Scratch clone /var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583 left on disk (rm denied to both seat and marshal) — reap manually.
- 2026-08-22T23:05Z · **Morning merge queue (mobilize-chores INTERACTIVE run, 4/4 dispatched):**
  - PR #1586 (#1580, ADR-0230 column-chart ladder goldens) — code-checker clear-to-merge; `claude-review` CI check is an Action infra error, not a verdict.
  - PR #1585 (#1581, ui-line-chart RTL chip) — fix-first → repaired (physical `left` anchor, RTL-pixel-identity test) → re-review clear-to-merge; carries a no-op held-items hunk identical to main.
  - PR #1587 (#1584, GenUI B3 judged-eval harness) — write-gate accepted @ b445f2f1; **blocked(AC18)**: the live judge-scored run needs ANTHROPIC_API_KEY — commands in the PR body / corpus-genui/README.md. Merge the harness, then run AC18 manually.
  - #1583 — ruling (above), no PR.

## Resolutions, 2026-08-23 (marshal refresh)

- #1583 ruling: RULED (a) — APP_MARGINAL_BUDGET bumped ~104 B citing ADR-0008 Am.2 (PR #1588, merged); issue closed.
- Morning merge queue: all three merged (#1585, #1586, #1587). AC18 then ran live (PR #1603, merged): m3 floor NOT MET; triage parked as #1605, now in build (build-1605).
- Still Kim's, open:
  - Reap scratch clone /var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583 manually (rm denied to seats and marshal).
  - Local branch `pr-1590` (dc6cd350): 1 unmerged commit, reap script refuses; decide keep or delete.
  - 5 pending ADR harvest candidates (adr-queue.json): mint-vs-compose bundle (0228+0229+0107), css-structural-laws bundle (0230+0008), placements for 0112 Am.3 and 0227 wave-2 — via /make-pack when you choose.
