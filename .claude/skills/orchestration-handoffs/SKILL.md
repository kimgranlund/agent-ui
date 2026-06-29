---
name: orchestration-handoffs
description: >
  Compose or review the standard handoff block a team agent returns when it hands work
  back to orchestration-lead or the host — Summary · Files changed · Tests/checks run ·
  Evidence · Risks · Open questions · Recommended next action. Use whenever a subagent
  finishes a unit of work and must report, when a coordinator rolls several reports into
  one, or when judging whether a handoff is verifiable and routable: "how do I hand this
  back", "report my results", "write the handback", "is this handoff complete".
---

# Harness — Agent Handoff Contract

The single block every team agent emits when it hands work back (to `orchestration-lead`, or to the host). One **verifiable, routable** shape, so the next step *checks* the work instead of re-reading it. The fields are inlined in each agent's prompt as a backstop; this skill is the authority on how to fill them.

## Before you hand back

**Drain your full inbox first.** Read every still-pending message before you compose — a handoff written one message behind is already wrong the moment it ships: it re-asks a question a later message already answered, re-edits an artifact a teammate already committed, or retracts a finding a newer commit already fixed. Compose only once nothing is left unread.

## The block — exactly these fields, in order

Keep each tight; omit nothing — write `(none)` when a field is empty.

- **Summary** — what was done, in 1–3 sentences. The outcome, not the process.
- **Files changed** — each path touched (created / edited / deleted), one per line.
- **Tests/checks run** — the gates run and their result, *by command*: `npm run check && npm test`, `harness_checks.py <type>`, `coverage_check.py`, `trace_check.py`. Name the command + pass/fail (or exit code) — never a bare "tests pass".
- **Evidence** — the proof a reviewer can verify *without re-doing the work*: gate output / exit codes, `file:line` citations, coverage results.
- **Risks** — what could be wrong or fragile, the assumptions made, the blast radius. Honest, not reassuring.
- **Open questions** — unresolved decisions needing a human or another role.
- **Recommended next action** — the single best next step **and who owns it** (`planning-lead` / `execution-lead` / host).

## Gate ≠ commit

A green gate is **not** a landed change. Read the gate output, *then* commit as a separate step — never chain a commit onto a test run with `&&`, or a regression rides in on a gate whose output was never read. (`orchestration-lead`/host commits; a maker hands back gated state, it does not self-land.)

## References & tools

| Path | Use when |
|---|---|
| `references/foundations.md` | Why the shape is verifiable-not-narrative; the up-loop + generator/critic split it feeds |
| `references/best-practices.md` | Per-field how-to + the per-seat notes (planning / execution / orchestration / steward / tokens) |
| `references/rubric.md` | Scoring a handoff block — completeness, verifiability, honesty, routing-readiness |
