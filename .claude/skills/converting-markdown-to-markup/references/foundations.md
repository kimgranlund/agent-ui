# Foundations — rendering markdown to markup

The mental models every rendering decision leans on. The grammar is CommonMark's inline + leaf-block set (https://spec.commonmark.org); this repo implements the small subset the docs corpus uses, hand-rolled.

## 1. Markdown body is DATA, not markup

The source string is content a human (or an agent) wrote; it is **not trusted to contain markup**. The renderer's job is to *interpret* a tiny grammar and emit the corresponding elements — it must never let the source *become* markup directly. That is the whole reason `textContent` (a Text node, inert) is used and `innerHTML` (parses HTML) is forbidden. Get this backwards and a doc string like `<img onerror=…>` executes. The structure of the output comes from the parser; the source only ever supplies *text* and *delimiter positions*.

## 2. Unhandled form → literal characters (the silent failure)

A renderer that writes prose via `textContent` with no parser shows every delimiter **literally**: backticks, `**`, `_`, `[` ]( ) all appear as typed. This is not a crash — it is a *silent* fidelity gap, found only by eye. It is why markdown rendering is best extended by **covering the inline class** in one pass rather than reacting to each delimiter that someone notices rendered raw. The cost of a missing form is paid by the reader, quietly.

## 3. Inline vs block — two grammars, one delegation

- **Block grammar** is line-oriented: blank lines separate paragraphs; a leading `- ` opens a list item; `#` opens a heading; a ```` ``` ```` fence opens a code block. Blocks are the document's skeleton.
- **Inline grammar** runs *within* a block's text: code spans, emphasis, strong, links. 

The load-bearing rule: a block **delegates** its text to the single inline pass (`appendInline`) — it never re-implements inline parsing. One inline parser, many block callers. A list item, a paragraph, and a heading all get the same inline treatment for free, and a new inline form lights up everywhere at once.

## 4. Earliest-span-wins recursion

Inline parsing is a left-to-right scan: find the earliest opening delimiter with a valid close, emit the literal run before it, emit the parsed span, then **recurse on the remainder**. This gives correct nesting and ordering without a parser generator. Two sub-rules carry weight: a **code** span is verbatim (no inner parse — its content is literal), while an **emphasis/strong/link** span **re-parses** its inner text (so nesting like bold-wrapping-code works). An **unpaired** delimiter is not a span — it is literal text.

## 5. Zero-dependency is a constraint, not an accident

The repo ships no markdown library. A hand-rolled grammar of the forms actually used is small, auditable, and has no supply-chain or bundle cost — and it keeps the `textContent`-safety property *visible in the code* rather than trusting a dependency's escaping. The trade is that the grammar is a subset: add forms deliberately as the corpus needs them, each as a small matcher, rather than pulling a full CommonMark engine for two delimiters.

## 6. Markup carries a treatment, not just a tag

Rendering is not done at the right element — the element must read correctly. An inline `<code>` is a *chip* (mono, a stepped surface, a hairline, a small radius, all token-driven), while a fenced block is a *plain panel* — so the inline-chip treatment is explicitly **reset** inside a block. Styling rides the role/token layer (so scheme + forced-colors safety come for free), never a hardcoded colour. The tag is the semantics; the treatment is how the reader parses it at a glance.
