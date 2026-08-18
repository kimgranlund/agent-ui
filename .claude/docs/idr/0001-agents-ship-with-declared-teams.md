# IDR-0001 — Agents ship with declared teams

> | | |
> |---|---|
> | **Status** | superseded |
> | **Date** | 2026-08-17 |
> | **Author** | product seat (fleet-bootstrap Phase 2) |
> | **Ratified by** | Kim — 2026-08-17, fleet-bootstrap Phase-3 hard gate (AskUserQuestion ratify round) (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — intent decision (WHY/WHAT); realized by ADRs/SPECs/issues, never by this file |
> | **Realized by** | [req-agent-teams](../research/req-agent-teams.md) R1–R6 · campaign issues (GH #1189–#1215 range) · the R4 team-seed-grammar ADR (future) |

## Intent

The platform's unit of product grows from **one agent** to **a team**: a GM (orchestrator) agent
plus a declared roster of sub-agents, and the Builder interview can one-shot an entire team from
a single conversation. The research lane found no shipped product that does the one-shot-N-agents
flow — this is a stated differentiator, not catch-up.

## Decision

1. **Declaration-first.** A team is a *record* (`AgentTeam`: GM + members with role +
   routingDescription), persisted on the existing agent-admin store — not a runtime. v1 ships
   declaration + GM prompt composition + builder output + an admin pane, and explicitly NO
   runtime orchestrator, group conversation, or network A2A serving.
2. **Reuse, never parallel grammar.** Team declaration rides existing seams (store, entry
   grammar, `composeSystemPrompt`), per the ADR-0185 precedent — no new wires.
3. **A2A-aligned by construction.** A declared team is A2A's "direct configuration" discovery
   mode; members map to AgentCards via a pure derivation, pin v0.3.0 as shipped.

## Falsifiers (what would send this back up here)

- If GM-prompt-composition alone cannot make a declared team *behave* like a team in live runs
  (routing quality unusable without a runtime), the declaration-first fence — not just an ADR —
  is what needs revising.
- If the builder one-shot flow proves un-craftable at interview quality (R4's ADR fails
  repeatedly), the "team as the unit of product" claim weakens and returns here.

## Ratification question

Accept "declaration-first teams, runtime deferred" as product intent? (The v1 fence is already
in the approved req doc; this IDR makes it durable above the arc.)

## Amendment note (2026-08-18) — tier ruling: this IDR is proposed for supersession

Kim's 2026-08-18 doc-tier ruling, verbatim: *"IDR should not be made for features. Intent is at
the global app/project level. PRD docs should be created for apps (like agent-admin-app) and that
PRD would document the teams feature (along all the other agent features)."*

Accordingly: this IDR's feature-scoped intent (the `AgentTeam` record, GM prompt composition, the
one-shot builder, the Team pane, A2A alignment, and the v1 fence) now lives in the
[agent-admin-app PRD](../prd/agent-admin-app.prd.md) §3.4; its platform-global core ("the unit of
product grows from agent to team, declaration-first") is restated at platform altitude in
[IDR-0008](./0008-team-is-the-unit-of-product.md) (proposed). This IDR is **proposed for
supersession by IDR-0008** — the accepted body above is untouched (append-only), and the Status
flip is Kim's alone.
