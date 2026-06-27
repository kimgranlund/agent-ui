# agent-ui — agent handoff contract

> The standard block every team agent emits when it hands work back (to `orchestration-lead`, or to the host). Single source of truth; the agent files inline the field list so it is always in-prompt. Roles + loop: [`README.md`](./README.md). · 2026-06-27

## Before you hand back

**Drain your full inbox first.** Read every message still pending before you compose the block — a handoff written one message behind is already wrong the moment it ships. The failure modes are concrete: re-asking a question a later message already answered, re-editing an artifact a teammate has already committed, or retracting a finding a newer commit has fixed. Compose the block only once nothing is left unread.

## The block

Every handoff returns exactly these fields, in order. Keep each tight; omit nothing (write "(none)" when empty).

- **Summary** — what was done, in 1–3 sentences. The outcome, not the process.
- **Files changed** — each path touched (created / edited / deleted), one per line; "(none)" if none.
- **Tests/checks run** — the gates executed and their result, by command: `npm run check && npm test`, `harness_checks.py <type>`, `coverage_check.py`, `trace_check.py`. Name the command + pass/fail (or exit code).
- **Evidence** — the proof a reviewer can verify *without re-doing the work*: gate exit codes/output, `file:line` citations, coverage results.
- **Risks** — what could be wrong or fragile, assumptions made, blast radius. Honest, not reassuring.
- **Open questions** — unresolved decisions needing a human or another role; "(none)" if none.
- **Recommended next action** — the single best next step **and who owns it** (`planning-lead` / `execution-lead` / host). Feeds routing and the up-loop.

On **Tests/checks run**: a green gate is not a landed change. Read the gate output, *then* commit as a separate step — never chain a commit onto a test run with `&&`, or a regression rides in on a gate whose output was never read.

## Why this shape

- It makes a handoff **verifiable, not narrative** — *Evidence* + *Tests/checks run* are the inputs the generator/critic split grades against, so the next step checks the work instead of re-reading it.
- *Recommended next action* and *Open questions* are what `orchestration-lead` routes on; *Risks* feed the eval gate.
- `orchestration-lead` returns the **same block as a rollup** — aggregating each field across the team.

## Per-seat notes

- **planning-lead** — *Files changed* = docs authored (PRD/SPEC/LLD/ADR); *Tests/checks run* = `harness_checks.py`, `coverage_check.py`, `trace_check.py`.
- **execution-lead** — *Files changed* = code/scaffold; *Tests/checks run* = `npm run check && npm test` (+ any gate it ran).
- **orchestration-lead** — a rollup; *Recommended next action* = the dispatch/ratify decision.
