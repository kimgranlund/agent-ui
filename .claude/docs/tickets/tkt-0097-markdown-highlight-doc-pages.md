---
doc-type: ticket
id: tkt-0097
status: done
date: 2026-07-18
owner:
kind: feature
size: small
---
# TKT-0097 — `ui-markdown` and `@agent-ui/code/highlight` get real site-doc pages, closing the last `@agent-ui/code` nav gap

## Summary
Kim's ask (2026-07-18, direct: "close site-doc gaps"), following up on a status check that surfaced
the one honest loose end in `ui-code-editor`'s own landing: two sibling members of the same
`@agent-ui/code` family — `ui-markdown` (a real tagged element, tier `display`) and `./highlight`
(a swappable registry + 7 bundled tokenizers, no tagged element) — had zero site presence. Both
were named as pre-existing, out-of-scope gaps at the time `ui-code-editor` shipped and again when
its own nav misclassification was fixed (TKT-0090/TKT-0095).

## Acceptance
- `ui-markdown` gets a real, descriptor-derived API doc page (`markdown-doc.html`), following the
  established `code-editor-doc.ts` pattern.
- `@agent-ui/code/highlight` gets a real GUIDE page (`highlight-doc.html`, no tagged element — same
  posture as `router-doc.html`), demonstrating the real bundled tokenizers live and documenting the
  custom-highlighter API.
- Both pages carry real, working specimens — not lorem/placeholder content.
- `ui-markdown` is correctly classified L1/Components in the sitemap the moment its page exists
  (TKT-0095's `L1_TREES` fix should require zero further generator changes for this — verified,
  not assumed).
- Both pages wired into the site: `_page.ts`'s NAV (ungrouped site-level links, matching
  Code-Editor/Router's own posture), `site-manifest.json` (the L2 row for the ungrouped `highlight`
  guide), and `llms.txt`.

## Links
- [TKT-0090](tkt-0090-codemirror-editable-markdown-prompts.md) / [TKT-0095](tkt-0095-code-editor-doc-nav-misclassified-as-guide.md) —
  where this gap was first named and left out of scope both times.
- `packages/agent-ui/code/src/markdown/markdown.md` — the real descriptor this page derives from.
- `packages/agent-ui/code/src/highlight/index.ts` — the registry/dispatch this guide documents.
- `scripts/generate-sitemap.mjs`'s `L1_TREES` (TKT-0095) — the mechanism this ticket verifies rather
  than assumes.

## Scope/Open
None — both pages shipped in this pass, no design fork.

## Findings

**2026-07-18 — shipped.** Grounded against the real source before writing anything: read
`markdown.ts`/`parse.ts`/`render.ts` for the exact supported subset and the real elements each node
renders as (`ui-text` for headings/paragraphs/links/blockquotes, native `ol`/`ul`/`li`, `ui-code`
for fenced blocks, `ui-table` for GFM tables) — every specimen on `markdown-doc.html` exercises a
real, verified-supported construct, none invented. Read `highlight/index.ts`, `core/registry.ts`,
`core/token.ts` for the real registry API (`registerHighlighter`, the round-trip fail-closed
guarantee, the 6 real grammar files behind 8 language keys) before writing the guide's prose.

- **`markdown-doc.ts`** — descriptor-derived via `composeDocPage` (the established pattern), four
  hand-authored specimens (headings/emphasis/inline-code/links; lists; blockquote+GFM table; a
  fenced code block) — each a real markdown source string set through the `markdown` prop, never a
  static screenshot. Deliberately does NOT import `@agent-ui/code/highlight` (matching `code-doc.ts`'s
  own precedent of showing the dependency-free default; the Highlighting guide is where activation
  lives).
- **`highlight-doc.ts`** — imports the REAL `./highlight` pack (not a mock): six live `ui-code`
  specimens (ts/json/html/css/python/shell), a `ui-markdown` specimen showing a fenced block
  getting highlighted through the SAME registry with no separate wiring, the fidelity-floor
  guarantee explained, and the `registerHighlighter` custom-engine API with a real code sample.
- **Verified live, not assumed:** `ui-markdown`'s sitemap entry auto-promotes to
  `level: L1, section: Components` the moment `markdown-doc.html` exists on disk — zero changes to
  `generate-sitemap.mjs` needed, confirming TKT-0095's fix generalizes exactly as designed. A
  throwaway jsdom smoke test (written, run, confirmed both pages render real specimens with no
  runtime error, then deleted — not a permanent fixture, matching this repo's own no-scratch-files
  convention) caught nothing wrong on the first pass.
- **Two real mistakes caught and fixed during authoring** (both before any commit): a shadowed,
  wrong-signature local `el()` helper redefinition in the first `highlight-doc.ts` draft, and an
  import from the wrong module for `heading` (it lives in `doc-page.ts`, not `specimens.ts`) — both
  would have been real bugs; fixed by checking the actual exported signatures rather than
  half-remembering them from the `code-editor-doc.ts` precedent.
- **Gate:** `npm run check` clean; full jsdom sweep 353 files / 6471 tests green; the built-CSS
  fixture regenerated (57 asset chunks, up from 55 — one new chunk per page) and confirmed
  byte-identical to a fresh build; `llms.test.ts` 7/7 green with both new rows.
