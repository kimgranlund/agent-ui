# Held items — kimgranlund/agent-ui

Denial/hold ledger for the issue-sorter watch/triage/trust contract
(`spec-ticketing-watch-triage.md`). Append-only. A denied item is never re-surfaced.

No items held as of 2026-08-04T08:30:01Z (first firing) — every item discovered this sweep was
authored by the evidence-seeded owner (`kimgranlund`), so nothing reached the trust-check hold.

## Kim's ruling/merge queue

- 2026-08-22T21:40Z · **#1583 — @agent-ui/app marginal budget +104 B gz** · ruling needed. Bisected by build-1583 to commit c6784a0c (Kim-directed hover→-dim/-high, ADR-0008 Am.2) — deliberate, not drift. ADR-0197 cl.5 bars upward re-basing except via ruled exception. Options: (a) bump APP_MARGINAL_BUDGET ceiling by ~104 B citing ADR-0008 Am.2; (b) other. Ticket left OPEN, claim released. Scratch clone /var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583 left on disk (rm denied to both seat and marshal) — reap manually.
