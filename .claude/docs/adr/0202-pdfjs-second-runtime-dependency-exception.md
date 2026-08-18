# ADR-0202 — pdf.js (`pdfjs-dist`) becomes agent-ui's SECOND ruled runtime-dependency exception: a lazy-loaded PDF-text extractor confined to one opt-in seam, gated on the ADR-0139 clause-8 discipline verbatim

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | planner seat, from [`req-doc-ingestion.md`](../research/req-doc-ingestion.md)
>   R3 (Lane 4 of the 2026-08-17 exploration campaign) — the req doc's own acceptance names this
>   record as its precondition: *"the ADR exists and is Kim-ratified before the `pdfjs-dist`
>   dependency appears in any package.json"* |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-18, via the [`ratify ADR-0202` utterance](https://github.com/kimgranlund/agent-ui/issues/1190#issuecomment-5323435121) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (not authored here): a new opt-in extraction module (home
>   TBD at build time — `@agent-ui/app` lib or a `doc-ingestion`-scoped seam; this record fixes the
>   PACKAGING law, not the final path) exporting one lazy `extractPdfText(file)` entry point ·
>   `scripts/measure-size.mjs` (a clause-8(c) size line-item for the lazy pdf.js chunk, baselined
>   against its own measured footprint, the ADR-0139 §8(c) precedent) · the per-package
>   `layering.test.ts` family (a confinement trip-wire: no static `pdfjs-dist` import outside the
>   one designated lazy-load module) · the identity-gate extension (`identity.test.ts`-style: every
>   default `@agent-ui/*` root barrel stays pdf.js-free and byte-identical for consumers who never
>   attach a `.pdf`) · `req-doc-ingestion.md`'s R1/R3 acceptance criteria (dated Finding on
>   ratification) |
> | **Supersedes / Superseded by** | **Extends [ADR-0139](./0139-codemirror-editor-first-runtime-dependency.md)**
>   (the first ruled runtime-dependency exception — this record adopts its clause-8 gate set
>   verbatim: identity byte-identity, confinement grep trip-wire, size line-item, lockfile hygiene;
>   the pillar-wording amendment this ADR requires is the SAME sentence ADR-0139 already amended,
>   widened from one named exception to two) · Relates [ADR-0107](./0107-chart-family-v1-scope.md)
>   (the "runtime dependency in costume" law — answered head-on again, exactly as ADR-0139 answered
>   it) · Relates [ADR-0066](./0066-phosphor-default-pack-buildtime-vendoring.md) (inert-data
>   vendoring — inapplicable here, same reasoning ADR-0139 gave) · Relates [ADR-0193](./0193-shared-storage-adapter-seam.md)
>   (the IndexedDB tier that stores the EXTRACTED TEXT this ADR's module produces — storage home is
>   this ADR's Non-goals, ruled instead by `req-doc-ingestion.md` R4) · Relates
>   [`req-doc-ingestion.md`](../research/req-doc-ingestion.md) (the owning requirements doc; R1–R3,
>   R7) |

## Context

`req-doc-ingestion.md` (Lane 4, 2026-08-17) specs a document-ingestion capability for
`ui-agent-admin`: a user attaches a file through the chat composer, its text is extracted entirely
client-side, and the text becomes a `resource`-kind entry composed into the live system prompt — no
file byte ever leaves the browser except as prompt text riding the already-ruled ADR-0073 dev-proxy
body. The v1 file-type set is `.md`/`.txt`/`.docx`/`.pdf` (R1). Three of the four types resolve
without any new dependency:

- **`.md`/`.txt`** — `File.text()`, native, zero cost (F1).
- **`.docx`** — a docx file IS a zip container around XML; the repo already hand-rolls a zip
  **writer** (`site/lib/zip-writer.ts`, GH #889), proving the container format is hand-rollable
  here; a **reader** adds the deflate-inflation half via the native `DecompressionStream('deflate-raw')`
  (Baseline: Chrome 103 / Firefox 113 / Safari 16.4) plus native `DOMParser` over `word/document.xml`
  — zero new dependency, real but bounded new work (F2).

**`.pdf` is the one type with no zero-dep answer, and the research lane's own finding states why
plainly:** *"a PDF text extractor is a runtime interpreter (fonts, encodings, content streams), not
'display-class'; hand-rolling fails ADR-0119's 'deliberately small' test in the opposite
direction"* (F3). A PDF is not a container format around a text format the way docx is — it is a
page-description language: content streams of low-level drawing operators, font programs (Type1,
TrueType, CFF, embedded or standard-14) with their own glyph-to-Unicode mappings (ToUnicode CMaps,
Differences arrays), optional compression filters (FlateDecode, LZW, ASCII85), and a cross-reference
table that can itself be corrupt or incremental. Recovering the TEXT a human would select and copy
requires decoding all of that faithfully — the same category of "interactive runtime, not static
display" that made CodeMirror the first exception (ADR-0139 cl.2), not the "small hand-rolled
renderer" category that kept `./highlight`/`ui-markdown` dependency-free (ADR-0119).

**The precedent wall, restated for this exception (ADR-0139's own method, applied to a second
capability).** ADR-0139 already established the repo's standing test for when a runtime dependency
is earned rather than declined:
- *Category*: is the capability display of static content (hand-rolled-small is real, ADR-0107/0119)
  or an interactive/interpretive runtime (hand-rolled-small is not real, ADR-0139)? PDF text
  extraction is the latter — decoding an arbitrary font's glyph IDs back to Unicode text is exactly
  the kind of unbounded-surface problem ADR-0139 cl.2(a) named.
- *Is the mass inert data* (ADR-0066's icon-pack license)? No — pdf.js is executable parsing code,
  not a compiled data table.
- *Is there a wire-protocol shortcut* (ADR-0069/0073's plain-fetch answer)? No — there is no network
  call to make instead; the capability IS the local parse.
- *Conclusion, by the same method ADR-0139 used*: the prior alternatives are exhausted for this
  capability exactly as they were for CodeMirror, and only Kim can rule the exception (ADR-0139
  cl.2(d), unchanged).

**The library, evaluated (`req-doc-ingestion.md` F3, in-lane research).** `pdfjs-dist` (Mozilla's
pdf.js, the same engine behind Firefox's built-in PDF viewer): Apache-2.0 licensed, ships a main
bundle plus a required worker file, current major v6.x, measured at repo-research time around
~262KB minified / ~73KB gzipped for the core, with the worker as a separate lazy chunk. It is the
canonical, most widely-deployed client-side PDF text-extraction engine — no meaningfully smaller
honest alternative exists that extracts real text (as opposed to rendering pages to canvas, a
different and heavier capability this ADR does not adopt).

## Decision

**We will adopt `pdfjs-dist` — declared, never vendored, Apache-2.0, confined to one opt-in
extraction seam, lazy-loaded per first `.pdf` attach — as the repo's SECOND third-party runtime
dependency, realizing the SAME clause-8 gate set ADR-0139 shipped for CodeMirror, verbatim.**
Realized in five clauses; SPEC/build own exact mechanism and file layout.

1. **The dependency, declared and bounded.** `pdfjs-dist` (Apache-2.0) declared in exactly ONE
   package's `package.json` — the package that owns the extraction seam (fixed at build time; a
   candidate is a new `doc-ingestion`-scoped module under `@agent-ui/app`'s lib tree, following
   `@agent-ui/code`'s `./editor` subpath shape if the extraction seam earns its own exported
   surface, or an app-internal module if it never needs to be a public control — this ADR does not
   pre-decide the home, only the confinement law). No other package in the repo may declare
   `pdfjs-dist` or any `pdfjs-dist`-adjacent package.
2. **Why THIS capability earns the exception ADR-0139 already proved the shape of.** Restated per
   clause 2(a)–(d) above: category (interpretive runtime, not display), inert-data test (fails —
   it's code), wire-shortcut test (fails — no protocol to speak instead), process (Kim's call
   alone, arriving as a proposed ADR naming its precedent exactly as ADR-0139's own acceptance
   demanded of itself). The zero-dependency pillar's operational content survives unchanged: no
   consumer pays for what it doesn't import, the exception is opt-in and lazy, only the absolute
   "zero dependencies anywhere" claim is amended a second time, in the open.
3. **Lazy-loaded per mount, never in the main graph.** The extraction module's top-level exports
   carry ZERO static `pdfjs-dist` imports; the library (and its worker) load via a dynamic
   `import()` fired only on the first `.pdf` file attach, following the ADR-0139 cl.5/cl.8(b)
   integration shape exactly: a load-timeout ceiling, a same-origin-bundled worker (no CDN — the
   ADR-0073 trust-boundary sentence: nothing about extraction may introduce a third-party network
   fetch), and an honest failure state (an unsupported/failed extraction surfaces as a visible chip
   reason per `req-doc-ingestion.md` R1's acceptance, never a silent drop).
4. **The identity + confinement + size gates, verbatim from ADR-0139 clause 8.** (a) *Identity*:
   every default `@agent-ui/*` root barrel stays `pdfjs-dist`-free and byte-identical for any
   consumer that never attaches a `.pdf` — extending the existing `identity.test.ts` discipline the
   same way ADR-0139 cl.8(a) did for CodeMirror. (b) *Confinement trip-wire*: a standing grep gate —
   no static `pdfjs-dist` import exists outside the one designated lazy-load module, mirroring
   ADR-0139 cl.8(b)'s single-module shape (the element/module's own graph stays pdf.js-free; the
   runtime arrives via dynamic `import()` only). (c) *Size*: `scripts/measure-size.mjs` gains a
   line-item — the lazy pdf.js chunk set as a measured, informational figure, baselined against
   pdf.js's own published/measured footprint (ADR-0139 cl.8(c)'s exact treatment of the CM chunk);
   pdf.js bytes never enter any main-graph budget. (d) *Dependency hygiene*: the lockfile pin lands
   with the build wave; `pdfjs-dist` version bumps are ordinary dependency PRs gated by
   `check`/`test`/`test:browser`, the same upstream-release-train consequence ADR-0139 named and
   accepted for CodeMirror.
5. **Text-only extraction; no rendering, no OCR.** The seam extracts the TEXT layer pdf.js exposes
   per page (`getTextContent`); it does not render pages to canvas (a materially larger capability
   this ADR does not adopt) and does not run OCR — an image-only PDF (no embedded text layer)
   yields an honest "no extractable text" state, never a silent empty result
   (`req-doc-ingestion.md` Non-goals, restated here as this ADR's own scope fence).

## Non-goals

- **PDF rendering / page-image display** — out of scope; this ADR adopts pdf.js's text-extraction
  surface only, not its canvas-rendering surface (a materially heavier capability with its own
  cost/benefit case, not asked for here).
- **OCR / scanned-image text recovery** — an image-only PDF yields an honest empty-text state; OCR
  is a wholly different (and much larger) dependency question, not folded into this exception.
- **Storage home for the extracted text** — ruled by `req-doc-ingestion.md` R4/R6 (the `resource`
  entry kind, the ADR-0193 IndexedDB tier for large texts); this ADR governs only the extraction
  DEPENDENCY, not where its output lives.
- **The composer/attach UX** — ruled by `req-doc-ingestion.md` R5; this ADR is silent on chip rows,
  drag/drop, or paste handling.
- **A second CodeMirror-style exported FACE control** — the extraction seam is a plain async
  function contract (`extractDocumentText`-shaped, per R2), not a custom element; there is no
  catalog/DoD surface this ADR must satisfy the way ADR-0139's `ui-code-editor` did.
- **Any change to the zero-dep pillar's OPERATIONAL meaning** — as ADR-0139 already established,
  only the absolute wording is amended a second time; the "no consumer pays for an import it never
  makes" guarantee is unchanged and re-verified by this ADR's own identity gate.

## Consequences

- **The pillar-wording amendment widens from one exception to two.** `CLAUDE.md` line 5's
  parenthetical (*"one ruled exception: the opt-in `@agent-ui/code/editor` surface adopts CodeMirror
  6…"*) is amended at build time to name pdf.js as the second ruled exception, in the same
  sentence's spirit — each future breach still costs its own ADR (ADR-0139 fork F4's reasoning,
  unchanged by having a second exception to point to).
- **A second upstream release train.** pdf.js/`pdfjs-dist` version bumps, security advisories, and
  breaking-change absorption become a second, bounded, gated recurring cost — the same honest price
  ADR-0139 named for CodeMirror, now paid twice, each time knowingly and for a capability with no
  hand-rolled substitute.
- **jsdom stays blind to the pdf.js path** — the lazy load, worker handoff, and real text extraction
  are browser-leg obligations (both engines); the deterministic CI story survives because the
  module's plain-function contract (return a rejected/empty-text promise on load failure) is the
  jsdom-testable surface, mirroring ADR-0139 cl.5's fallback-is-the-testable-contract shape.
- **`req-doc-ingestion.md` R1 unblocks.** Until this ADR ratifies, v1 ships with `.pdf` marked
  "coming soon" at the attach chip (R3's own stated fallback) — `.md`/`.txt`/`.docx` are unaffected
  and independently buildable.
- **Stale → re-verify at the build wave:** `CLAUDE.md`'s pillar sentence · `scripts/measure-size.mjs`
  §doc-ingestion line-items · the layering/confinement trip-wire matrix · `req-doc-ingestion.md`'s
  R1/R3 Findings.

## Acceptance

This is an **intake** ADR — realized in two stages, following ADR-0139's own two-stage acceptance
shape exactly:

- **Intake (this change):** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `docs-grammar.test.ts` link sweep) and is indexed in the README. **No code changes, no
  `package.json` edit, no new file under `packages/`.**
- **Build wave (separately dispatched, gated on Kim's ratification):** the extraction seam +
  `pdfjs-dist` land with the clause-4 gate set green (identity byte-identical, confinement grep,
  size line-item, lockfile); the clause-3 lazy-load path is browser-gated both engines; the
  `req-doc-ingestion.md` R1/R3 acceptance criteria are re-proven; `CLAUDE.md`'s amendment lands in
  the same change; `npm run check && npm test` green.

## Alternatives considered

- **Hand-roll a minimal PDF text extractor (parse content streams + standard-14 font encodings
  only, skip embedded-font edge cases).** Rejected: the Context's own grounding shows the "small
  subset" already requires content-stream operator parsing, compression-filter decoding, and CMap
  handling — the moment any real-world PDF uses an embedded font (the overwhelming majority do),
  the "minimal" extractor either produces garbled text or must grow toward pdf.js's own scope
  anyway. This is ADR-0119's "input-class explosion" lesson (already invoked once for CodeMirror)
  recurring for a second capability, not a new argument.
- **Vendor pdf.js at build time (the Phosphor/ADR-0066 model).** Rejected for the same reason
  ADR-0139 rejected vendoring CodeMirror: pdf.js is executable runtime code, not inert data;
  vendoring it would be "a runtime dependency in costume" (ADR-0107) with worse honesty (no
  upstream security patches, a frozen fork) than open, declared adoption.
- **Server-side extraction (upload the PDF, parse it off-device, return text).** Rejected outright:
  `req-doc-ingestion.md` R7 and the ADR-0073 trust boundary require extraction to stay 100%
  client-side; a server endpoint would be a new egress path for user documents, the opposite of
  this product's stated trust posture.
- **Defer `.pdf` indefinitely (ship `.md`/`.txt`/`.docx` only, no ADR needed).** Rejected as the
  DEFAULT but available as the interim state: `req-doc-ingestion.md` R3 already names "pdf marked
  coming" as the safe fallback while this ADR awaits ratification — this ADR exists so that
  fallback is temporary by design, not the permanent answer.
- **A different PDF library (e.g. a smaller community text-only fork).** Rejected: no meaningfully
  smaller, comparably licensed, comparably maintained alternative was found in the lane's research;
  pdf.js is the canonical engine (it ships inside Firefox itself) and the Apache-2.0 license is
  clean for this repo's use.
