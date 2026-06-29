---
name: html-to-markdown
description: >
  Convert HTML content into markdown source — map semantic elements to markdown syntax
  (headings, strong/em, code/pre, links, lists, blockquotes), drop presentational markup,
  and escape text that would otherwise read as markdown. Use when bringing HTML content
  into a markdown corpus, transcribing a rendered page or fragment back to markdown source,
  or producing the markdown a renderer will consume: "convert this HTML to markdown", "turn
  this page into markdown source", "make markdown from this fragment".
---

# Harness — HTML → Markdown (transcription)

Take HTML (a fragment, a rendered page, a pasted block) and produce equivalent **markdown source**. This is the inverse of `markdown-to-markup`: there, markdown is the data and DOM the output; here, HTML structure is the input and markdown the output. The transform is **semantic and lossy by design** — it keeps meaning (a heading, a list, emphasis) and discards presentation (a `div`, a class, an inline style).

## Map semantics to syntax, drop presentation

Walk the element tree; map each **semantic** element to its markdown; **unwrap** purely presentational containers (keep their children, drop the wrapper):

| HTML | Markdown |
|---|---|
| `<h1>`…`<h6>` | `#` … `######` |
| `<strong>` / `<b>` | `**…**` |
| `<em>` / `<i>` | `_…_` |
| `<code>` (inline) | `` `…` `` |
| `<pre><code>` | fenced ```` ``` ```` block |
| `<a href>` | `[text](href)` |
| `<ul><li>` / `<ol><li>` | `- …` / `1. …` |
| `<blockquote>` | `> …` |
| `<p>` | blank-line-separated run |
| `<br>` | hard line break |
| `<div>` / `<span>` / class / style | **unwrapped** — children kept, wrapper dropped |

## Escape text that would read as markdown

Plain text copied verbatim is a bug: a literal `*`, `_`, `` ` ``, `#`, `[`, `]`, or a leading `- ` / `1.` in the *text* must be backslash-escaped so it does not become syntax on re-render. **Escape the text content, not the syntax you emit.** This is the single most-missed step and the difference between a faithful round-trip and corrupted output.

## Round-trip is the correctness test

Good output, fed back through a markdown renderer, yields markup **semantically equivalent** to the input (same headings, emphasis, links, list structure) — not byte-identical HTML (presentation was intentionally dropped). If a round-trip changes meaning, the conversion is wrong.

## Don't

- Don't keep `class`/`style`/`id`/wrapper `div`s — markdown has no slot for them; unwrap.
- Don't copy text unescaped — escape markdown-special characters in text nodes.
- Don't flatten structure — preserve list nesting and blockquote depth (indent / repeat the marker).

## References & tools

| Path | Use when |
|---|---|
| `references/foundations.md` | The semantic-vs-presentation model, lossy-by-design, round-trip equivalence |
| `references/best-practices.md` | The full element map, the escaping rules, nesting/whitespace, code & link handling |
| `references/rubric.md` | Scoring a conversion — fidelity, escaping, presentation-stripping, structure |
