# Foundations — converting HTML to markdown

The models behind a faithful transcription. The targets are the HTML living standard's element semantics (https://html.spec.whatwg.org) and CommonMark's syntax (https://spec.commonmark.org); the mapping between them is the skill.

## 1. HTML is structure + presentation; markdown is semantic-minimal

HTML expresses both *what a thing is* (`<h1>`, `<ul>`, `<em>`) and *how it looks* (`<div class>`, `style`, nesting wrappers). Markdown expresses only a small set of *meanings* — heading, list, emphasis, code, link, quote — and has **no vocabulary for presentation**. So the conversion is a projection: it keeps the meanings that have a markdown form and discards the rest. A `<div class="callout">` is not a markdown concept; its *children* are.

## 2. Lossy by design — and that is correct

Because markdown has no slot for class, style, or arbitrary wrappers, dropping them is not data loss to mourn — it is the point. The goal is **semantic** equivalence, not pixel equivalence. A conversion that tries to preserve presentation (smuggling HTML through, keeping `style` attributes) produces markdown that is neither clean source nor faithful, and defeats the reason to convert at all. Decide what is *meaning* and keep that; everything else unwraps.

## 3. Round-trip equivalence is the oracle

The test of a conversion is not "does it look like the input" but: **feed the markdown back through a renderer — is the result semantically the same?** Same heading levels, same emphasis spans, same link targets, same list structure. This oracle is what tells you an escape was missed (a literal `*` became emphasis on the way back) or a structure was flattened (a nested list lost a level). Pairs naturally with the `markdown-to-markup` skill: that renderer is the round-trip's second half.

## 4. Escaping is the silent-corruption guard

The most common defect is copying a text node verbatim. If the *content* contains a markdown-significant character — `*`, `_`, `` ` ``, `#`, `[`, `]`, `(`, `)`, a leading `-`/`1.`/`>` — re-rendering will misread it as syntax. The fix is to backslash-escape those characters **in the text**, while emitting the *intended* syntax unescaped. The distinction — escape the data, not the markup you generate — is what keeps a sentence like "use the \* operator" from turning into emphasis.

## 5. Block vs inline, and nesting

The walk distinguishes **block** elements (headings, paragraphs, lists, blockquotes, pre) — which start on their own line and carry blank-line or indent separation — from **inline** elements (strong, em, code, a) that flow within a block's text. Nesting must be preserved structurally: a list inside a list **indents**; a blockquote inside a blockquote **repeats** the `>`; a `<pre>`'s content is **verbatim** (never escaped, never inline-parsed). Flattening nesting is a meaning change, not a formatting nicety.

## 6. Unwrap, don't delete

A presentational wrapper (`div`, `span`, a semantically-empty element) is **unwrapped** — removed while its children are kept and processed in place — not deleted with its contents. The failure mode at both extremes: keeping the wrapper (smuggling HTML into the markdown) or deleting its subtree (losing real content). The right move is structural transparency: the wrapper vanishes, its meaning-bearing children survive.
