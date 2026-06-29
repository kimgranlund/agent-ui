# Rubric — HTML→markdown conversion quality (rubric-html-to-md)

Score a conversion (a one-off transcription or a converter). Dimensions × 1–5 anchors × a gate. Authored in the `authoring-rubrics` shape; the oracle is round-trip semantic equivalence.

| Dim | Name | [gate] |
|---|---|---|
| **H1** | Semantic fidelity | gate |
| **H2** | Escaping correctness | gate |
| **H3** | Presentation stripping | |
| **H4** | Structure & nesting | |
| **H5** | Whitespace & separation | |

## H1 — Semantic fidelity [gate]

Round-tripped, the markdown renders to the same *meaning* as the HTML input.

- **1** — meanings lost or changed: a heading became plain text, a link dropped its href, emphasis vanished.
- **3** — every mapped semantic (headings, strong/em, code, links, lists, quotes) survives the round-trip.
- **5** — + edge constructs handled (image alt, ordered-list numbering, link without href → text) and any unmappable construct is flagged, not silently dropped.

## H2 — Escaping correctness [gate]

Text that would read as markdown is escaped; emitted syntax is not.

- **1** — text copied verbatim; a literal `*`/`_`/leading `-` re-parses as syntax on round-trip.
- **3** — markdown-special characters in text nodes are escaped; code/pre content is left verbatim (not escaped).
- **5** — + line-start cases handled (a leading `#`/`-`/`1.`/`>` in text is escaped) and proven by a round-trip that preserves the literal.

## H3 — Presentation stripping

- **1** — `class`/`style`/wrapper `div`s smuggled through (raw HTML in the output for presentation).
- **3** — presentational wrappers unwrapped (children kept); no class/style survives.
- **5** — + raw HTML appears only for a construct with no markdown form, never for styling, and that choice is noted.

## H4 — Structure & nesting

- **1** — nested lists/quotes flattened; list ordering lost.
- **3** — list and blockquote nesting preserved (indent / repeated marker); ordered vs unordered correct.
- **5** — + deep/mixed nesting (list-in-quote, quote-in-list) round-trips faithfully.

## H5 — Whitespace & separation

- **1** — HTML whitespace copied literally (stray indents open phantom code blocks); blocks run together.
- **3** — inter-element whitespace collapsed; one blank line between blocks; `<pre>` whitespace preserved.
- **5** — + no accidental code-block indents; trailing/leading per-block whitespace trimmed.

## Gate rule

**H1 and H2 must both be ≥ 3.** A conversion that loses meaning or corrupts text via missed escapes fails regardless of the rest — fidelity and escaping are the round-trip's load-bearing pair. H3–H5 below 3 are findings to fix.
