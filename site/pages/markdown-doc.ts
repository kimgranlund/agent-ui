// site/pages/markdown-doc.ts — the ui-markdown API doc page (ADR-0119 fork F4; LLD-C9, code-prose.lld.md
// §10). DERIVED from `markdown.md` via the shared doc-page.ts renderer. The element lives OUTSIDE
// components/src (@agent-ui/code/markdown — a zero-dep, hand-rolled subset renderer, never a vendored
// markdown library) — TKT-0095's L1_TREES fix means this page's mere existence on disk is what promotes
// `ui-markdown` from invisible to a real L1 Components nav entry, no generator change needed. Specimens are
// hand-authored source strings (a doc page has no bound consumer to derive real content from), each
// showing a real subset the hand-rolled parser supports — sanitization-by-construction (no raw-HTML node
// kind exists in the parser's AST) means every specimen below is genuinely safe input, not a curated one.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import '@agent-ui/code/markdown' // self-defining <ui-markdown>
import '@agent-ui/code/markdown.css'
import { loadMarkdownDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadMarkdownDoc()

const { content } = mountPage({
  title: 'ui-markdown — API',
  intro:
    'A Display-class, zero-dependency renderer for a small, hand-rolled markdown subset (ADR-0119 fork ' +
    'F4) — never a vendored markdown library. Parses into an AST of KNOWN node kinds only (no raw-HTML ' +
    'node kind exists at all, so sanitization is by construction, not a filter pass) and replaces its own ' +
    'children with real fleet DOM: ui-text (headings, paragraphs, links, blockquotes), native ol/ul/li, ' +
    'ui-code (fenced blocks), and ui-table (GFM tables) — never innerHTML. Syntax highlighting inside a ' +
    "fenced code block is a separate, opt-in concern — see the Highlighting guide.",
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const prose = markdown(
    '# Getting started\n\n' +
      'A **bold** claim, an *emphasized* aside, and some `inline code` — all inline runs share one ' +
      'left-to-right scan, no recursive regex.\n\n' +
      'A [link](https://example.com) renders as `ui-text[as="a"]`; a raw `<script>` tag in the source is ' +
      'just literal text — the block pass never opens an HTML lane.',
  )

  const list = markdown(
    '## Supported block types\n\n' +
      '- ATX headings (`#` through `######`)\n' +
      '- Ordered and unordered lists, with indent-depth nesting\n' +
      '- Blockquotes (`>`)\n' +
      '- GFM tables\n' +
      '- Fenced code blocks\n',
  )

  const quoteAndTable = markdown(
    '> A blockquote renders as `ui-text[as="blockquote"]` — a real fleet element, not a native `<blockquote>`.\n\n' +
      '| Pack | Zero-dep | Notes |\n' +
      '| --- | --- | --- |\n' +
      '| `./markdown` | yes | this element — a hand-rolled subset renderer |\n' +
      '| `./highlight` | yes | seven bundled tokenizers, opt-in registration |\n' +
      '| `./editor` | **no** | the one ruled exception — CodeMirror 6, lazy-loaded (ADR-0139) |\n',
  )

  const code = markdown(
    '## A fenced block\n\n' +
      '```ts\n' +
      "const greet = (name: string): string => `Hello, ${name}!`\n" +
      '```\n\n' +
      'Renders as a real `ui-code` element — plain by default; see the Highlighting guide to turn on ' +
      'real syntax coloring.',
  )

  section.append(
    labelled('Headings, emphasis, inline code, links', prose),
    labelled('Lists', list),
    labelled('Blockquote + a GFM table', quoteAndTable),
    labelled('A fenced code block', code),
  )
  return section
}

function markdown(source: string): HTMLElement {
  const el = document.createElement('ui-markdown')
  ;(el as HTMLElement & { markdown: string }).markdown = source
  return el
}

function labelled(title: string, node: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.5rem; max-inline-size:42rem;'
  wrap.append(heading(3, title), node)
  return wrap
}
