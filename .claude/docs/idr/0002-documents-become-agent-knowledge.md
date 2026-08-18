# IDR-0002 — Documents become agent knowledge, in the browser only

> | | |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Author** | product seat (fleet-bootstrap Phase 2) |
> | **Ratified by** | Kim — 2026-08-17, fleet-bootstrap Phase-3 hard gate (AskUserQuestion ratify round) (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — intent decision (WHY/WHAT); realized by ADRs/SPECs/issues, never by this file |
> | **Realized by** | [req-doc-ingestion](../research/req-doc-ingestion.md) R1–R7 · the pdf.js dependency ADR (future, blocks pdf only) · ADR-0193's IndexedDB tier · ADR-0132's entry machinery |

## Intent

A user building an agent can hand it their own documents and the agent *knows* them: attach
through the composer, text extracted **entirely client-side**, landing as a durable
`resource`-kind entry that composes into the live system prompt. Knowledge is a first-class
builder capability, not a server feature.

## Decision

1. **The trust boundary is product law.** No file byte ever leaves the browser; extracted text
   egresses only as prompt text on the already-ruled dev-proxy body (ADR-0073). No upload
   endpoint, ever, in this product's browser tier.
2. **Knowledge = the existing entry system.** One knowledge path (`resource` entries, ADR-0132),
   one persistence seam (ADR-0193, IndexedDB tier for large texts, bytes never stored) — no new
   store, no parallel knowledge subsystem.
3. **Context stuffing, not retrieval, at v1.** Whole-text under honest hard budgets with visible
   truncation; RAG/embeddings are a future intent turn, triggered when corpora outgrow the
   budget.
4. **The zero-dep law bends only by ruling.** docx is hand-rolled (zip reader + DOMParser);
   pdf.js is the one candidate second runtime-dep exception and requires its own Kim-ratified
   ADR before any bytes land (the ADR-0139 pattern, exactly).

## Falsifiers

- If whole-text stuffing measurably degrades agent quality inside the budgets (context rot at
  practical corpus sizes), clause 3 returns here — retrieval becomes an intent decision, not a
  quiet build choice.
- If client-side extraction proves untenable for the file types users actually bring (e.g.
  scanned PDFs dominate), the browser-only fence itself is re-examined here, not worked around.

## Ratification question

Accept "browser-only ingestion, one knowledge path, stuffing-not-retrieval at v1" as product
intent? (pdf.js remains separately ADR-gated regardless of this flip.)
