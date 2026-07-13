---
doc-type: ticket
id: tkt-0036
status: doing
date: 2026-07-13
owner:
kind: bug
---
# TKT-0036 — the doc-page markdown body needs a real reading design (measure · chip density · hierarchy)

## Summary
Kim's report (2026-07-13, screenshot of a control doc page's prose body): "the body content styles
need to go through full system-decompose and some ui/designing reasoning." The sibling surface to
TKT-0033 (which redesigned the API tables): the markdown BODY under the tables —
`renderMarkdownBody` in `site/lib/doc-page.ts`, rendering each control's `{name}.md` descriptor body —
ships with no reading design. Grounded defects visible in the capture:
1. **No measure** — the rendered `<article>` has no `max-inline-size` (only `.page-description` /
   `.page-lead` carry one, 62/68ch); paragraphs run the full content width, far past a readable line
   length.
2. **Chip saturation** — the body is the descriptor's agent-facing spec-prose, where nearly every
   other token is backtick code; the global `code` chip rule (border + stepped surface + radius on
   EVERY span, `_page.css` ~L353) turns each line into a wall of boxed fragments — the chips visually
   outweigh the prose they punctuate.
3. **No hierarchy/rhythm** — headings, bold runs, bullets, long parenthetical ADR citations, and
   chip-chains all compete at similar visual weight; nothing guides a reading order.

## Acceptance
- A full system-decompose + UI/typography design pass (the explicit ask) runs BEFORE any CSS is
  written: decompose the intent (who reads this body and for what task), reason on both planes —
  the CONTENT plane (the `{name}.md` body is written as an agent-facing contract; how much of the
  "sad" is content-shape vs display?) and the DISPLAY plane (measure, leading/rhythm, chip
  treatment/density, heading scale, semantic blocks) — and produce named candidate directions with
  trade-offs, recorded on this ticket, forks to Kim (a user-facing docs-design taste call; nothing
  self-ratified).
- Constraint carried into the design: the derive-from-descriptor law holds — the body STAYS the
  descriptor's own markdown, one shared render path (no per-page hand-copy); a content-plane
  recommendation may propose conventions for HOW descriptor bodies are written, but display must
  degrade gracefully on the existing corpus as-is.
- The chosen design lands as ONE shared treatment (doc-page render + its stylesheet), theme-aware +
  AA on `--md-sys-*` roles, responsive, coherent with TKT-0033's Form-B tables on the same pages —
  the tables and the body must read as one designed page, not two systems.
- Typography decisions reason from the fleet's own type scale (`--md-sys-typescale-*`, ADR-0078) —
  no bespoke font sizing.

## Repro
Open any control doc page (e.g. `ui-text-field`) below the API tables. The prose runs full-width
(no measure), each backtick span renders as a bordered chip (dozens per paragraph), and
spec-register sentences ("the field border steps to … a `--md-sys-color-focus-ring` border-color
step would double with the ring …") render as undifferentiated dense body text.

## Expected vs actual
- **Expected:** doc-page prose that reads — a constrained measure, chips that punctuate rather than
  dominate, a heading/rhythm system that carries the eye, spec-detail visually subordinated to the
  main line.
- **Actual:** unmeasured full-width lines of chip-saturated spec-prose with flat hierarchy.

## Classification
Axis: **visual + structural (no reading design; display amplifies a content-register mismatch)** —
subjective in trigger, real in mechanics. Planes: `site/lib/doc-page.ts` (`renderMarkdownBody`) +
the site prose/chip styles (`_page.css` code-chip rule; a dedicated stylesheet is the likely home,
per TKT-0033's precedent) + (content plane, advisory) the descriptor-body authoring conventions.

## Severity
**minor** — truthful content, functioning pages; the cost is the fleet's primary reference surface
reading as an unstyled spec dump.

## Links
- `site/lib/doc-page.ts` (`renderMarkdownBody` ~L263+, `composeDocPage` L244-258) ·
  `site/pages/_page.css` (the global `code` chip rule ~L353; the 62/68ch measures that stop short of
  the article) · `site/lib/doc-page.css` (TKT-0033's new stylesheet — the sibling system this must
  cohere with) · TKT-0033 (the API-table redesign, Form B — same pages, one design) ·
  `--md-sys-typescale-*` / ADR-0078 (the type scale to reason from) · the `{name}.md` descriptor
  corpus (the content being rendered).

## Findings
