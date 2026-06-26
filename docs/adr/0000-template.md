# ADR-NNNN — <short decision title>

> Source: agent-ui ADR template. Copy to `NNNN-<short-kebab-title>.md`, fill the fields, set a real date. Log + lifecycle: [`README.md`](./README.md). · template
>
> | Field | Value |
> |---|---|
> | **Status** | proposed → accepted → superseded/deprecated *(start: proposed)* |
> | **Date** | YYYY-MM-DD *(set on author; add ratified date on accept)* |
> | **Proposed by** | <role/agent — usually the escalation source> |
> | **Ratified by** | <orchestration-lead, on accept> |
> | **Repairs** | `PRD-G#` / `SPEC-R#` / `LLD-C#` *(the owning-doc IDs this change edits — reference-by-ID)* |
> | **Supersedes / Superseded by** | `ADR-NNNN` *(if applicable)* |

## Context

The forces in play and the **discovered reality** that triggered this. What constraint did execution hit, or what global pattern needs to change? State it so the decision reads as inevitable given the context — facts, not opinion. Link the escalation or the failing gate.

## Decision

The change, stated in one or two sentences in active voice ("We will…"). Name the **owning document** being repaired and what it now says (by ID — do not restate the fact in full; the owning doc holds it).

## Consequences

What follows — the trade-offs accepted, what propagates downward, which dependents must regenerate (`stale → re-verify`), and any new constraint this imposes. Include the negative consequences honestly.

## Alternatives considered

Each option weighed and **why it was rejected** — the rejected paths are the most valuable part of the record. One bullet per alternative.

- **<alternative>** — rejected because …
