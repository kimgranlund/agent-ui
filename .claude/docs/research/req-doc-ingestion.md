---
doc-type: research
status: approved
id: req-doc-ingestion
owner: Kim
date: 2026-08-17
---

# req-doc-ingestion — Document ingestion for the agent builder (upload → agent knowledge)

> Source: research campaign Lane 4 (`2026-08-17-exploration-campaign-plan.md`) · 2026-08-17 ·
> research lane output — PRD-shaped requirements draft; mobilization on Kim's approval.

## Goal

A user building an agent in `ui-agent-admin` can attach a document through the chat composer (or the
capabilities pane), have its TEXT extracted entirely in the browser, and have that text become durable
agent knowledge — a `resource`-kind entry that composes into the live system prompt under the existing
ADR-0132 entry machinery — without any file byte ever leaving the browser except as prompt text riding
the already-ruled dev-proxy body (ADR-0073 trust boundary intact).

## Findings digest (lane schema: capability · fileTypes · extractionTech · storageHome · uxPattern · trustBoundaryNotes · source)

| # | capability | fileTypes | extractionTech (dep? size? license?) | storageHome | uxPattern | trustBoundaryNotes | source (date) |
|---|---|---|---|---|---|---|---|
| F1 | plain-text ingest | `.md` `.txt` (+ `.json`, `.csv` as text) | `File.text()` — native, zero dep | resource entry store | drag/drop + picker + paste | none — text stays local | MDN File API (stable, 2026-08 read) |
| F2 | docx ingest | `.docx` | ZERO-DEP feasible: docx = zip; hand-rolled central-directory reader + native `DecompressionStream('deflate-raw')` (Baseline 2023: the 'deflate-raw' FORMAT is Chrome 103/FF 113/Safari 16.4 (the streams landed earlier, Chrome 80, but only for deflate/gzip)) + native `DOMParser` over `word/document.xml` (`w:t` runs, `w:p` → newline). Repo already hand-rolls the WRITER (`site/lib/zip-writer.ts`, GH #889) — proving the zip CONTAINER format is hand-rollable here; the reader adds genuinely new work (central-directory walk + deflate-raw inflation via native DecompressionStream — the writer is STORE-only and DecompressionStream-free). mammoth.js (~600KB) rejected. | resource entry store | same as F1 | none | etienned gist (docx-as-zip, canonical); MDN DecompressionStream (2026-08); repo `site/lib/zip-writer.ts` |
| F3 | pdf ingest | `.pdf` | pdf.js (`pdfjs-dist`) is the ONLY honest option — a PDF text extractor is a runtime interpreter (fonts, encodings, content streams), not "display-class"; hand-rolling fails ADR-0119's "deliberately small" test in the opposite direction. Apache-2.0; ~262KB min / ~73KB gz at v3, v6.x current, plus a worker file; must be dynamic-`import()`ed per use. Needs an ADR-shaped exception citing ADR-0139 verbatim: declared dep on an opt-in subpath, lazy-loaded per mount, every default barrel stays clean. | resource entry store | same as F1, with a "extracting…" busy state (async, worker) | pdf.js runs fully client-side; worker must be same-origin bundled (no CDN) | bundlephobia pdfjs-dist (2026-08); npm pdfjs-dist; mozilla/pdf.js #9087/#12900 |
| F4 | attachment UX | all | n/a | n/a | 2026 conventions: drag-into-composer + paste + a single attach affordance (never an icon farm); attached file renders as a dismissable CHIP above the field with name + size; send disabled only while extraction is in flight | n/a | uxpatterns.dev file-input & ai-chat; saasui.design upload patterns (2026); bricxlabs chat UI 2026 |
| F5 | knowledge → prompt (RAG-lite) | extracted text | context stuffing, NOT retrieval: for small agents with a handful of docs, whole-text-in-prompt beats building retrieval; "context rot" (Chroma, 2025) argues a hard per-agent budget, so cap + truncate rather than embed | composed via `composeSystemPrompt` (`entries.ts` — enabled `resource` entries already render as `### {label}` blocks) | truncation surfaced honestly in the chip/entry (never silent) | doc text becomes part of the system prompt → rides the SAME dev-proxy request body every prompt section already rides (ADR-0073); no new egress path | RAGFlow 2025 review; Chroma context-rot (2025); truestandard.ai long-context-vs-RAG (2026) |
| F6 | persistence | extracted text (can be 100s of KB) | n/a | `resource` entries persist through the persona's existing store; texts past the localStorage comfort zone (~5MB quota total, string-doubled) belong on the ADR-0193 **IndexedDB tier** (`createIndexedDbAdapter`), which the seam already ships; raw file BYTES are never stored (extract-then-discard) | n/a | stored text never syncs anywhere; export rides the existing persona-file/debug-bundle path (GH #889 precedent) | repo `shared/src/storage/` (ADR-0193); `agent-admin-debug-export.ts` |

## Requirements

**R1 — v1 file-type set: `.md`, `.txt`, `.docx`, `.pdf`** (plus any `text/*` treated as txt).
AC: each of the four round-trips file → extracted text → resource entry in a browser test; an
unsupported type is rejected at the chip with a visible reason, never a silent drop.

**R2 — extraction module, layered right.** A pure `extractDocumentText(file) → Promise<{text, meta}>`
seam with per-type extractors: txt/md via `File.text()`; docx via a hand-rolled zip reader
(`DecompressionStream` + `DOMParser`) — zero dep, extending the `site/lib/zip-writer.ts` container-format precedent (reader adds the deflate half); pdf behind a
LAZY dynamic import that loads pdf.js only on first `.pdf` attach.
AC: default barrels of every `@agent-ui/*` package remain pdf.js-free (`layering.test.ts`-style
trip-wire); docx extractor passes on a real fixture with zero new deps; extraction runs off the main
interaction path (async, busy state).

**R3 — dep ruling needed: YES, one ADR before any pdf.js bytes land.** An ADR-0139-shaped record: the
second ruled exception to the zero-dep pillar — declared (never vendored), Apache-2.0 stated, confined
to one opt-in subpath, lazy-loaded, size line-item added to `scripts/measure-size.mjs`, PLUS ADR-0139's two remaining clause-8 gates: the identity byte-identity gate (default barrels byte-identical with the feature unused) and the confinement grep trip-wire (no static pdfjs import outside the one designated lazy module). Until ratified,
v1 may ship with pdf marked "coming" (R1 minus pdf is still shippable).
AC: the ADR exists and is Kim-ratified before the `pdfjs-dist` dependency appears in any package.json.

**R4 — storage home: the `resource` entry kind, no new store.** An ingested doc becomes an
`Entry{kind:'resource', label:file name, content:extracted text}` in the existing entry store
(ADR-0132 cl.1: no new list/toggle/author code); persistence for large texts routes through the
ADR-0193 IndexedDB tier, never localStorage, and never stores raw file bytes.
AC: an ingested doc appears in the capabilities pane's Resources section, is toggleable/deletable like
any entry, survives reload, and composes into `composeLiveSystemPrompt` output only while enabled.

**R5 — composer UX to the shipped anatomy.** Attach via (a) drag-onto-composer, (b) paste, and (c) an
attach affordance in the options row (a `ui-button` sibling of mic/send). The attached doc renders in
the EXISTING context-chip row (`ContextItem` — above the field, dismissable; TKT-0056 anatomy holds:
the composer stays store-blind and generic, `ui-agent-admin` owns the ingest → entry projection via
callbacks, exactly the GH #849/#891 layering law).
AC: composer gains no store knowledge and no new event name (`events: []` holds); chip shows name +
size + extraction state; dismiss before send discards cleanly; with no doc attached the composer
renders byte-identically to today.

**R6 — size/token budget + truncation UX.** Hard caps: per-file raw input ≤ 10MB; per-doc extracted
text budget ~50k chars (~12k tokens) and a per-agent knowledge budget ~200k chars, both constants in
one module. Over-budget text is head-truncated-with-marker (`…[truncated: N of M chars]`) and the
entry/chip states it visibly — honest degradation, never silent (F5's context-rot grounding).
AC: budgets unit-tested at the boundary; the truncation marker reaches the composed prompt; the UI
shows a truncated state on the entry.

**R7 — trust boundary explicit (ADR-0073).** Extraction is 100% client-side; the extracted text leaves
the browser ONLY as part of the composed system prompt in the existing dev-proxy request body — no new
endpoint, no upload API, no third-party fetch (pdf.js worker bundled same-origin; CSP-compatible).
AC: a test asserts no network request carries file bytes; the ADR/spec states the boundary sentence.

## Non-goals (v1)

- No retrieval/embedding/RAG pipeline, chunk ranking, or vector store — whole-text stuffing under R6's
  budget is the v1 law; retrieval is a future ADR when corpora outgrow the budget.
- No OCR / scanned-PDF image extraction (pdf.js text layer only; an image-only PDF yields an honest
  "no extractable text" state).
- No `.doc` (pre-2007), `.pptx`, `.xlsx`, or image ingestion.
- No server-side parsing or upload endpoint of any kind.
- No per-message ephemeral attachments to the TEST chat that bypass the entry store (one knowledge
  path; a turn-scoped-only attachment mode is a later fork).

## Mobilization list (sized issues, minted on approval)

1. **ADR: pdf.js as the second ruled runtime-dep exception** (size:small, doc-only; blocks #5).
2. **Extraction core: `extractDocumentText` seam + txt/md extractors + budget/truncation module**
   (size:small; home: `@agent-ui/app` lib or `shared` — planner rules placement) (R2, R6).
3. **Zero-dep docx extractor: zip reader (`DecompressionStream`) + `DOMParser` text walk + fixtures**
   (size:big — the reader is real parsing work; due-process applies).
4. **Composer attach path: drop/paste/attach-button → context chip → callback to `ui-agent-admin` →
   resource entry** (size:big; touches TKT-0056/GH #891 layering — spec slice first).
5. **pdf.js lazy extractor behind the ratified ADR** (size:small once #1+#2 exist) (R1, R3).
6. **IndexedDB routing for large resource entries + reload/export proof** (size:small; rides ADR-0193) (R4).

## Rubric self-check (Lane-4 rubric)

- v1 file-type set justified — PASS (F1–F3; each type's cost stated, set matches builder need).
- Extraction tech vs zero-dep law, ADR-shaped exception plan where needed — PASS (docx ruled zero-dep
  with mechanism; pdf ruled dep-with-ADR, R3, citing ADR-0139 as precedent).
- Storage home named on the existing seam — PASS (R4: resource entries + ADR-0193 IndexedDB tier).
- Upload UX specified to the composer's anatomy — PASS (R5: chip row, options row, callbacks-up law).
- Privacy/trust boundary explicit — PASS (R7: client-side only, dev-proxy body the sole egress).

**Footer verdict: PASS** (all five rubric lines pass; open risk flagged: pdf.js worker bundling under
Rolldown-Vite needs a build-time spike inside issue #5).
