# IDR-0007 — Agents know their user's documents, and the browser is the trust boundary

> | | |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Author** | planning seat (doc-tier restructure; distilled from IDR-0002's platform-global core, per Kim's 2026-08-18 tier ruling) |
> | **Ratified by** | — pending (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — PLATFORM intent (WHY/WHAT at global project level); realized by PRDs/ADRs, never by this file |
> | **Supersedes / Superseded by** | Proposed to supersede [IDR-0002](./0002-documents-become-agent-knowledge.md) (feature-scoped; its ingestion detail relocates to PRD altitude — flip is Kim's) |
> | **Realized by** | [agent-admin-app PRD](../prd/agent-admin-app.prd.md) (knowledge feature) · [ADR-0073](../adr/0073-a2ui-live-model-provider-seam.md) (the trust boundary) · [ADR-0202](../adr/0202-pdfjs-second-runtime-dependency-exception.md) · [ADR-0193](../adr/0193-shared-storage-adapter-seam.md) · [req-doc-ingestion](../research/req-doc-ingestion.md) |

## Intent

Knowledge is a first-class capability of the platform: a user building an agent hands it their
own documents and the agent *knows* them. And the platform's trust boundary is **product law,
not an implementation detail**: user content is processed entirely client-side — no file byte
ever leaves the browser; text egresses only as prompt text over the already-ruled dev-proxy seam
(ADR-0073). There is no upload endpoint in this product's browser tier, ever.

## Decision

1. **Knowledge is a platform capability, browser-only.** Any agent a user builds can be made
   knowledgeable from that user's own documents without a server-side ingestion tier.
2. **The trust boundary is non-negotiable platform law.** Every knowledge, capability, or media
   feature designs inside it; a feature that needs bytes to leave the browser is an intent-level
   escalation to this record, never a build-time workaround.
3. **Feature detail lives downstream.** File types, extraction seams, storage tiers, budgets, and
   retrieval strategy are the owning PRD's and its ADRs' business, at whatever granularity fits.

## Falsifiers

- If client-side processing proves untenable for the content users actually bring (at platform
  scale, not one file type), the browser-only law itself is re-examined here — not worked around.

## Ratification question

Accept "knowledge is a platform capability; the browser is the trust boundary, as product law" as
platform intent, superseding the feature-scoped IDR-0002 (whose detail now lives at PRD altitude)?
