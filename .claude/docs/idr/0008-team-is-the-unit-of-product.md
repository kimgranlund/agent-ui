# IDR-0008 — The unit of product grows from one agent to a team, declaration-first

> | | |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Author** | planning seat (doc-tier restructure; distilled from IDR-0001's platform-global core, per Kim's 2026-08-18 tier ruling) |
> | **Ratified by** | — pending (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — PLATFORM intent (WHY/WHAT at global project level); realized by PRDs/ADRs, never by this file |
> | **Supersedes / Superseded by** | Proposed to supersede [IDR-0001](./0001-agents-ship-with-declared-teams.md) (feature-scoped; its record/pane/builder detail relocates to PRD altitude — flip is Kim's) |
> | **Realized by** | [agent-admin-app PRD](../prd/agent-admin-app.prd.md) (teams feature) · [ADR-0203](../adr/0203-agentteam-declaration-first-record.md) + its ratified amendment · [ADR-0204](../adr/0204-team-meta-line-arm.md) · [req-agent-teams](../research/req-agent-teams.md) |

## Intent

The platform's unit of product is growing from **one agent** to **a team**: an orchestrating GM
agent plus a declared roster, and the one-shot creation of an entire team from a single builder
conversation. The research lane found no shipped product doing the one-shot-N-agents flow — this
is a stated differentiator, not catch-up.

## Decision

1. **Team as unit of product.** Product surfaces, the builder, and the store treat a team as a
   first-class thing a user makes and owns — not a power-user composition of loose agents.
2. **Declaration over runtime, as platform posture.** New capability enters as declared records
   on existing seams before any runtime engine is built (the brief's principle 5); a runtime
   orchestrator is a future intent turn gated on the declaration layer proving itself, never a
   quiet build choice.
3. **Feature detail lives downstream.** The record shape, prompt composition, builder arm, pane
   design, and A2A alignment are the owning PRD's and its ADRs' business.

## Falsifiers

- If declaration + prompt composition cannot make teams *behave* like teams in live runs — and a
  runtime becomes the only path to acceptable routing quality — the declaration-first posture
  itself returns here before any engine is built.

## Ratification question

Accept "team is the unit of product; declaration-first as platform posture" as platform intent,
superseding the feature-scoped IDR-0001 (whose detail now lives at PRD altitude)?
