# IDR-0005 — agent-ui is an agent-product platform

> | | |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Author** | planning seat (doc-tier restructure, Kim's 2026-08-18 tier ruling) |
> | **Ratified by** | — pending (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — PLATFORM intent (WHY/WHAT at global project level, per the 2026-08-18 tier ruling); realized by PRDs/ADRs/SPECs/issues, never by this file |
> | **Supersedes / Superseded by** | — (the root of the platform IDR set; no feature IDR maps onto it alone) |
> | **Realized by** | [product-brief](../product-brief.md) §1 (the identity sentence, ratified 2026-08-17) · [agent-admin-app PRD](../prd/agent-admin-app.prd.md) · the A2UI/A2A/producer layers ([a2ui-expert-system PRD](../prd/a2ui-expert-system.prd.md)) |

## Intent

**agent-ui is an agent-product platform: users build agents in the browser, and those agents
converse primarily through generative UI rendered from the fleet's own components.** The
zero-dependency component library — the original north star, delivered complete — is the
foundation tier of that product, not the product itself.

This is the ratified identity sentence from the product brief (Kim, 2026-08-17), lifted here as
the root intent record of the platform IDR set: work that grows the agent-product loop outranks
work that only grows the component catalog.

## Decision

1. **The platform is the product; the library is its foundation tier.** Scope dials, roadmap
   synthesis, and intake priority read against the agent-product identity first.
2. **Central Intent lives in the product brief; platform intents live here.** The brief is the
   standing WHY/WHAT record; the `idr/` tier holds only platform-global intent decisions
   (identity, medium, trust boundary, unit of product) — never feature-scoped intent, which
   belongs to the owning app/family PRD (the 2026-08-18 tier ruling).

## Falsifiers

- If sustained real usage is overwhelmingly library-only consumption (the `ui-*` fleet imported
  with no agent layer attached), the identity claim — not the library — is what returns here.

## Ratification question

Accept "agent-product platform, library as foundation tier" as the root platform intent, and this
file as the identity's citable IDR home? (The sentence itself is already ratified in the brief;
this flip makes it a first-class member of the restructured intent tier.)

**And name the canonical citation target** (doc-checker finding, 2026-08-18): the identity
sentence now lives in both [product-brief §1](../product-brief.md) and this file. Recommended:
**this IDR is canonical** — future docs cite IDR-0005; the brief's §1 remains its narrative home
and cites this record once ratified. Alternative: the brief stays canonical and this IDR is the
pointer. Kim picks; citations follow the pick.
