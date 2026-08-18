# IDR-0006 — Generative UI is the platform's conversation medium

> | | |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Author** | planning seat (doc-tier restructure; distilled from IDR-0003's platform-global core, per Kim's 2026-08-18 tier ruling) |
> | **Ratified by** | — pending (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — PLATFORM intent (WHY/WHAT at global project level); realized by PRDs/grammar law/ADRs, never by this file |
> | **Supersedes / Superseded by** | Proposed to supersede [IDR-0003](./0003-generative-ui-is-the-primary-medium.md) (feature-scoped; its conduct-law detail relocates to PRD altitude — flip is Kim's) |
> | **Realized by** | [agent-admin-app PRD](../prd/agent-admin-app.prd.md) (conversation experience) · [a2ui-expert-system PRD](../prd/a2ui-expert-system.prd.md) (grammar/corpus/catalog) · GH #1182 (gen-UI-first ask law) · [ADR-0196](../adr/0196-answered-state-law-questionnaire-settle-edit-amend.md) · [ADR-0198](../adr/0198-ask-flow-completion-flowend-meta-signal.md) |

## Intent

On this platform, an agent conversation **is** a generative-UI experience. Surfaces rendered from
the fleet's own components are the default way any agent — built by any user, on any surface —
asks, shows, and concludes; prose is the ruled exception. And because the medium is the product,
**conduct is codified, testable law** (grammar clauses, rulings, fixtures) — never per-persona
prompt craft that happens to behave.

## Decision

1. **Gen-UI-first, platform-wide.** Every producer path leans to A2UI surfaces for any input;
   prose asks are the exception class, ruled not improvised.
2. **Conduct is law, not craft.** Lifecycle honesty, flow bookends, settled receipts, and domain
   realism are grammar-level contracts with gates; a violation is a product bug filed from live
   pixels. The concrete clauses live at PRD/ADR altitude (the owning PRDs above), not here.

## Falsifiers

- If live evals show gen-UI-first asks measurably worsening task completion across ask classes —
  not one persona, the platform-wide default — this medium claim itself returns here.

## Ratification question

Accept "generative UI is the platform's conversation medium; conduct is codified law" as platform
intent, superseding the feature-scoped IDR-0003 (whose detail now lives at PRD altitude)?
