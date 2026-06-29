---
name: converting-markdown-to-markup
description: >
  Render markdown source into safe rendered markup (DOM), or extend a markdown→markup
  renderer — the inline grammar (code, bold, italic, link) and block grammar (paragraph,
  list, heading, fenced code), parsed to elements via textContent, never innerHTML. Use
  when rendering docs/prose markdown onto the page, adding an inline or block form to the
  renderer, or fixing markdown that shows as literal characters: "render this markdown",
  "the backticks/stars show up literally", "add bold/links/italics to the doc renderer".
---

# Harness — Markdown → Markup (rendering)

Turn markdown **source** into safe rendered **markup** (DOM elements). The repo's renderer is `site/lib/doc-page.ts` (`renderMarkdownBody` for blocks + `appendInline` for inline spans), hand-rolled and **zero-dependency**. Two constraints define the work: the body is untrusted **data** (so never `innerHTML`), and any form the parser does not handle renders as **literal characters** — the exact failure the docs fixes kept hitting one form at a time.

## The one safety rule — `textContent`, never `innerHTML`

Every text run is placed with `textContent` or a Text node; an element (`<code>`, `<strong>`) is `createElement`'d and its text set with `textContent`. The *markup* comes from the parser's structure, never from the source string. `innerHTML` on markdown body is an injection hole — markdown is data, and data must not be able to mint elements.

## Inline grammar — `appendInline`, earliest-span-wins, recurse

One left-to-right pass over a text run; the earliest-starting span wins; the remainder after it recurses:

- `` `code` `` → a `<code>` element, text **verbatim** — no markup parsed inside (so `**x**` inside backticks stays literal).
- `**bold**` → `<strong>`, inner text **re-parsed** (so inline `` `code` `` inside **bold** still renders).
- `_italic_` → `<em>` (re-parsed); `[text](url)` → `<a>` with `href` via `setAttribute` (validate the scheme — no `javascript:`).
- An **unpaired** marker (`` ` ``, `*`, `_`, `[`) stays **literal** — graceful, never throws.

The pattern for adding a form: a matcher for its delimiters, slotted into the earliest-match selection, producing a `createElement` + `textContent` (or a recursive `appendInline` for a container span). See `references/best-practices.md`.

## Block grammar — `renderMarkdownBody`, line-oriented

Blank-line-separated runs → `<p>`; `- ` lines → `<ul>`/`<li>` (each item's text through `appendInline`); `#`…`######` → `<h1>`…`<h6>` (heading text through `appendInline`); a fenced ```` ``` ```` run → a `<pre><code>` block, a **plain panel** (the inline-code chip treatment is reset inside a block). Each block delegates its inline content to `appendInline` — never re-implement inline parsing per block.

## Don't

- Don't reach for `innerHTML`, `dangerouslySetInnerHTML`, or a markdown library — hand-roll the small grammar (the zero-dep ethos; `references/foundations.md`).
- Don't fix one inline form per change — when you touch the inline parser, **cover the inline class**; one-form-at-a-time is what produced the code→bold→… churn.

## References & tools

| Path | Use when |
|---|---|
| `references/foundations.md` | The data-not-markup model, the inline/block split, why zero-dep |
| `references/best-practices.md` | The `appendInline` pattern, per-form mappings, escaping, the safety do/don'ts |
| `references/rubric.md` | Scoring a markdown→markup change — safety, completeness, graceful degradation |
