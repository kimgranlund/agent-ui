# a2ui catalog rendering review — Attachment — 2026-08-18 — probes: manual — theme: dark + light

| card | tier | A1 A2 A4 B1 B2 C1 C2 | A3 B3 B4 C3 | verdict |
|---|---|---|---|---|
| Attachment | WIDGET | ✓ ✓ ✓ ✓ ✓ ✓ ✓ | **1** 3 **1** 3 | **HOLD** |

**Short answer:** 🟢 the left props panel is fine — 🔴 the right surface is not. The card renders a bare `File` chip that demonstrates none of the component's three rendering props.

## Blind-identify log
- Attachment: *"a rounded outlined pill with a document glyph reading 'File' — some kind of file chip / attachment affordance"* — **hit on type, miss on job**. Nothing on the canvas says this control shows a filename, a size, or a mime-derived category.

## Findings (severity-ordered)

- **Attachment · A3 (seed sufficiency) · quadrant L-only · owner `example-authoring-agent`** — anchor **1** ("a demonstrable prop is blank and R shows nothing for it"). `A2UI_INITIAL` (`site/lib/component-preview.ts:223-257`) has **no `Attachment` entry at all**; all four knobs read empty (probed). `demonstrable ∖ seeded = {name, mimeType, sizeBytes}` — the gate is ✗. Evidence: L column, all four fields blank in both themes.
- **Attachment · B4 (representative specimen) · quadrant L-only · owner `example-authoring-agent`** — anchor **1** ("unreadable/meaningless — an empty chip"). With `filename` empty and `mimeType` empty, `attachment.ts` falls back to `categoryLabel('generic')` = **"File"** and omits the meta cell entirely (`sizeBytes` null ⇒ no size row, by contract). The canvas is a two-node chip: generic glyph + the word "File". Fix is one line, mirroring the corpus's own idiom at `packages/agent-ui/a2ui/src/examples/catalog-coverage.ts:226` (`name: 'Q3 roadmap.pdf', mimeType: 'application/pdf', sizeBytes: 428000`):
  ```ts
  Attachment: { name: 'Q3 roadmap.pdf', mimeType: 'application/pdf', sizeBytes: '428000' },
  ```
  I probed exactly this by hand — the canvas renders `Q3 roadmap.pdf` + `284.9 KB` with the PDF glyph, and `mimeType` alone flips the fallback title to `PDF document`. All three reflect correctly; only the seed is missing.
- **Attachment · A4-at-5 / dead knob · quadrant R-only · owner `a2ui-build-agent`** — the `href` knob is **visually inert**: setting it changes `el.href` (so B2's gate passes) but leaves the canvas DOM byte-identical (probed: `domChanged: false`). This is correct-by-design today — the `<a>` rendering leg is deferred to LLD-C6 (`attachment.ts` header note, `attachment.md`'s `href` block) — but the card offers the reader an editable control with no observable effect and no note saying why. Either mark it a labelled `skip` with the deferral note, or leave it and accept A4 ≠ 5.
- **`site/pages/attachment-doc.ts:58` · out-of-scope bug found while grading B3 · owner `example-authoring-agent`** — the doc page's `card()` sets `el.setAttribute('name', spec.name)`, but the control's attribute is **`filename`** (`name` is the reserved form name — TKT-0069/ADR-0112). Probed live: **every one of the 10 specimens on `attachment-doc.html` has `filename: ""`** and renders the category-label fallback — "Image", "Audio", "PDF document" — never `sunset.png`, `standup.mp3`, `report.pdf`. The page's own "Degenerate cases" section demos *exactly that fallback* as the failure mode, so the correct and degenerate rows are currently indistinguishable. The `name` key is the **A2UI wire** name; only the catalog factory maps it (`attachmentFactory`, `factories.ts:792`). One-word fix: `setAttribute('filename', …)`.

## What passed
- **A1/A2/A4** — four knobs (`name`, `mimeType`, `sizeBytes`, `href`), set-equal to `catalog.json` `components.Attachment.properties` and in declared order; kinds right (`sizeBytes` → `ui-text-field[type=number]` with stepper, coerced to a real number in `#rootProps()`); no doubling.
- **B1** — canvas root is `ui-attachment` via the real renderer, zero pageerrors, zero console errors.
- **B2** — all four `mapsTo` targets change on knob edit (`name`→`filename`, `mimeType`, `sizeBytes`, `href`); three of four also re-render.
- **C1/C2** — round-trip clean: set → revert restores byte-identical canvas HTML for every knob; whole-card snapshot equal before/after the full pass. (C1 passes *vacuously* — there are no seeds to be visible; it is carried entirely by A3.)
- **B3 = 3** — host box 186×30, no overflow or clipping, renders identically in dark and light; matches what the control renders natively at the same (blank) state.
- **C3 = 3** — title, kind label, L, R and the uses line read coherently; all three U links (`document-row-toolbar`, `agent-task-status`, `media-file-grid`) return 200 and their anchors resolve on `a2ui-gallery.html`.

## Coverage
captured 1 / expected 1 · empty-canvas: none · screenshots: `/tmp/a2ui-attachment/{dark,light}/WIDGET/Attachment.png` · page header reads "(60 shown)"

Both blocking findings are one-quadrant, one-owner, and single-line — handing them to `example-authoring-agent` clears A3 and B4 together. Want me to dispatch that?
