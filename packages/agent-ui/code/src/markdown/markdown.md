---
# markdown.md frontmatter — the attributes-as-API descriptor for ui-markdown (ADR-0004; LLD-C9,
# code-prose.lld.md §10). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror markdown.ts `static props` (markdown) —
# the contract↔props trip-wire (markdown-descriptor.test.ts) targets this fence. Run INSIDE @agent-ui/code
# via the shared parser imported from `@agent-ui/components/descriptor` (SPEC-C9/C10 — no components-side
# allowlist entry is owed; the package-bound-gate interpretation).
tag: ui-markdown
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; SPEC-C6)
extends: UIElement     # a non-interactive, non-form-associated block-flow CONTAINER, defined in the ./markdown pack (ADR-0119 fork F4)
# marginal: measured at the build wave (`npm run size`, manual discipline, ADR-0080/SPEC-C9) — the
# `@agent-ui/code/markdown` size-line-item, a separate serial slice from this fence.

attributes:            # attributes-as-API — mirrors markdown.ts `static props` (markdown)
  - name: markdown
    type: string
    default: ''
    reflect: false     # a document string is not an attribute-sane value (the ui-table columns/rows precedent)
    # The bindable SOURCE document (the `Text.text` clobber-lane shape) — a prop, not host-as-content, since
    # the source is generated. On change, the subset is parsed and the children REPLACED with real fleet DOM
    # (never `innerHTML`) — SPEC-C6/C7.

properties: []         # no manual accessors beyond the one reactive prop above

events: []             # display-only — emits nothing (not interactive, SPEC-C6)

slots: []              # content is the `markdown` PROP, not host-as-content — no author-authored slot

parts: []              # no interior nodes exposed — the rendered children ARE the content (ui-text/ui-code/ui-table/native ul-ol-li/em/strong/code)

customStates: []        # no interaction state and no motion gate — a display container has neither

face:
  formAssociated: false  # a display container — extends UIElement, no value/validity participation

aria:
  role: none              # transparent container — internals.role is set to '' (no explicit role), letting each rendered child (ui-text/ui-code/ui-table/native list) carry its own real semantics
  roleSource: internals    # `this.internals.role = ''` — a CONSTANT, set once in connected()
  labelSource: none        # no accessible name of its own — the children (headings, paragraphs, etc.) are what AT reads

keyboard: []            # no component-defined key bindings — any interactivity belongs to the RENDERED children (e.g. a ui-text as="a" link), not this container

geometry:
  sizeClass: display     # Display band — NO control frame/height (geometry.md)
  blockSize: content      # block-size is content-driven — the rendered block sequence's own flow
  gap: var(--ui-markdown-gap)  # the vertical rhythm between top-level blocks (density-responsive --md-sys-space-md referent)

forcedColors: No component-owned surface fill exists to force away — ui-markdown is a transparent flow container; each rendered child (ui-code/ui-table/ui-text) carries its own forced-colors handling independently.
---

# ui-markdown

`ui-markdown` is the **Display**-class, flagship element of the code+prose family (ADR-0119, M1) — it
renders the agent-common markdown subset into **real fleet DOM**, sanitized by the *absence* of a raw-HTML
lane. It is **not** interactive and **not** form-associated: no events, no keyboard contract of its own.

```html
<ui-markdown></ui-markdown>
<script type="module">
  import '@agent-ui/code/markdown'
  document.querySelector('ui-markdown').markdown = '# Report\n\nA **bold** claim with `code`.'
</script>
```

## Content model — a bindable `markdown` prop, never host-as-content

The source document is a single bindable string prop (the `Text.text` clobber-lane shape, the `ui-table`
columns/rows precedent) — **not** the element's light-DOM children. On every `markdown` change the subset
is parsed and the children are **replaced wholesale** with real fleet DOM: `document.createElement` +
property/attribute sets only — **never** `innerHTML` (SPEC-C7 AC2).

## The construct → element map (SPEC-C6)

| Construct | Renders as |
|---|---|
| Heading `#`…`######` | `ui-text as="h1"…"h6"` |
| Paragraph | `ui-text as="p"` |
| Unordered / ordered list (nested) | native `<ul>` / `<ol>` with `<li>` children — nesting nests natively |
| Blockquote | `ui-text as="blockquote"` |
| Fenced code | `ui-code` with the fence's info-string forwarded to `language`; highlights **iff** `@agent-ui/code/highlight` is also imported (SPEC-C8) — otherwise verbatim, the identity path |
| Inline emphasis / strong / code | native `<em>` / `<strong>` / `<code>` |
| Link `[text](url)` | `ui-text as="a" href="url"` — ui-text's fail-closed scheme gate denies `javascript:`/etc.; the parser applies no scheme logic of its own (one gate, not two) |
| GFM table | `ui-table` with `columns`/`rows`; cells are plain text at v1 |

## Sanitization — by the absence of a lane, not a filter

The parser's AST has **no** HTML/raw node kind at all — a `<script>` line, an `onerror` attribute, a
`javascript:` href in the *text* all render as inert **text**. The one dangerous edge — a real markdown
`[text](url)` link — routes through `ui-text`'s existing fail-closed scheme gate; `ui-markdown` owns no
second `safeHref` implementation (SPEC-C7).

## Composing with `./highlight`

`ui-markdown` reaches syntax highlighting **only through the core registry** — it never imports
`./highlight` itself, so `./markdown` alone drags zero tokenizer bytes (the tree-shake gate, SPEC-C1
AC3/SPEC-C8). Importing `@agent-ui/code/highlight` anywhere in the app is enough to light up every fenced
block this element renders.

## Accessibility

The host carries **no explicit role** (`internals.role = ''`, a transparent container) — assistive
technology walks straight through to the rendered children, each of which carries its own real semantics
(a stamped `<h2>`, a native `<ul>`/`<li>`, `ui-table`'s real `<table>`, etc.).

## Sizing

Display-class (`geometry.md`): no control height, no `[size]`/`[scale]` attribute, no `[density]` legs of
its own beyond the `--ui-markdown-gap` block-rhythm referent (the `--md-sys-space-md` density-responsive
token). Every rendered child owns its own overflow (a wide table scrolls inside `ui-table`, a wide fenced
block inside `ui-code` — ADR-0102).
