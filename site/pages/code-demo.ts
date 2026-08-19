// site/pages/code-demo.ts — the ui-code demo (the ratified display-tier `demo`, GH #1279 batch): the REAL
// zero-machinery verbatim code leaf in the contexts it ships in — an agent's answer with INLINE code (a
// `<code>` phrase inside a ui-text paragraph — the inline register ui-code deliberately is not) beside BLOCK
// ui-code specimens across languages (shell/json/ts/css/python/html/markdown), each verbatim by default; the
// SAME blocks re-projected through the opt-in `@agent-ui/code/highlight` pack via the core `projectHighlight`
// seam (ADR-0113 escape hatch (a), made systematic by ADR-0119) — so verbatim-vs-highlighted is an honest,
// side-by-side comparison, never a mock; a whitespace-fidelity specimen; and the component's own horizontal
// overflow inside a narrow feed-bubble-width box. Pairs with the descriptor-derived API doc,
// site/pages/code-doc.ts. ui-code emits no events (display leaf) — there is no event log.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + .demo-figure/.demo-caption)
import '@agent-ui/code/highlight' // opt-in: self-registers the bundled seven-language highlighter (SPEC-C4 AC1)
import '@agent-ui/code/highlight.css' // the `[data-token]` tint sheet the projected spans read
import { projectHighlight } from '@agent-ui/code' // the core projection seam — the ONE way tokens reach a ui-code's light DOM
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-code — demo',
  intro:
    'Code as an agent actually shows it: an inline `<code>` phrase inside running text, block ui-code ' +
    'specimens across seven languages — verbatim by default, then the SAME blocks projected through the ' +
    'opt-in @agent-ui/code/highlight pack — a whitespace-fidelity check, and the component’s own horizontal ' +
    'scroll inside a feed-bubble-width box. The API table is on the ui-code API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const inline = (s: string): HTMLElement => el('code', {}, [text(s)])

/** codeBlock — a real <ui-code language>, verbatim (textContent) — the zero-machinery default. */
function codeBlock(language: string, code: string): HTMLElement {
  const block = el('ui-code', { language })
  block.textContent = code
  return block
}

/** highlighted — the SAME language + code, but projected: <span data-token> runs the highlight sheet tints. */
function highlighted(language: string, code: string): HTMLElement {
  const block = el('ui-code', { language })
  projectHighlight(block, code, language)
  return block
}

// ── the answer — inline code in prose, then a block; the shape a chat reply takes ────────────────────────
const answer = el('ui-column', { gap: 'sm', align: 'stretch' }, [
  el('ui-text', { variant: 'body', as: 'p' }, [
    text('To run the standing gate locally, use '), inline('npm run check'), text(' followed by '), inline('npm test'),
    text(' — judge both by exit code, never by grepping output. The '), inline('check'),
    text(' script fans out to four noEmit/test steps:'),
  ]),
  codeBlock('shell', 'npm run check && npm test\n# → tsc (packages) && check:site && check:tools && check:scripts'),
  el('ui-text', { variant: 'body', as: 'p' }, [
    text('If a browser shard goes red under host load, re-run just that file in isolation before concluding — '),
    inline('npx vitest run --project site site/pages/code-demo.browser.test.ts'), text('.'),
  ]),
])
applyDemoWidth(answer, 'min(100%, 44rem)')

const answerNote = el('p', {}, [
  text('The inline register is a plain '), inline('<code>'), text(' phrase inside a '), inline('ui-text'),
  text(' paragraph — ui-code is deliberately BLOCK-only (a Display-class box with its own scroll), so a phrase-level mention never becomes a box of its own.'),
])

// ── across languages — the SAME source, verbatim (left) and projected through the highlight pack (right) ──
const SAMPLES: readonly { lang: string; code: string }[] = [
  { lang: 'json', code: '{\n  "surfaceId": "booking",\n  "rows": [\n    { "label": "Room", "value": "Deluxe King" },\n    { "label": "Nights", "value": 3 }\n  ]\n}' },
  { lang: 'ts', code: "import { resource } from '@agent-ui/data'\n\nconst bookings = resource(() => api.list({ status: 'confirmed' }))\nexport const count = () => bookings.value?.length ?? 0 // derived" },
  { lang: 'css', code: 'ui-description-list {\n  --ui-description-list-label-min-inline-size: 8em; /* aligned values, no grid */\n}' },
  { lang: 'python', code: 'def receipt(rows: list[dict]) -> list[dict]:\n    """Drop valueless rows — humanization stays upstream."""\n    return [r for r in rows if r.get("value") not in (None, "")]' },
  { lang: 'html', code: '<ui-badge label="Passing" intent="success"></ui-badge>\n<ui-text variant="label" as="p">Filed under: display leaves</ui-text>' },
  { lang: 'markdown', code: '## Release notes\n\n- **Receipts** ship as `ui-description-list`\n- See the [patterns hub](./composition-patterns.html)' },
]

const grid = el('div', { class: 'demo-grid' })
grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(20rem, 1fr)); gap:1rem; margin-block:0.75rem;'
for (const { lang, code } of SAMPLES) {
  grid.append(
    captioned(`language="${lang}" — verbatim (the default)`, codeBlock(lang, code)),
    captioned(`language="${lang}" — projectHighlight() via ./highlight`, highlighted(lang, code)),
  )
}

const langNote = el('p', {}, [
  inline('language'), text(' is INERT metadata on ui-code itself (no highlighter dispatch, ADR-0113) — the left column is what a bare '),
  inline('<ui-code>'), text(' always renders. The right column is the SAME element after the core '), inline('projectHighlight(host, code, language)'),
  text(' seam filled it with '), inline('<span data-token>'), text(' runs from the opt-in pack (ADR-0119): the concatenated text still equals the source exactly, and a later plain '),
  inline('textContent'), text(' write clobbers the spans back to one text node — plain always wins.'),
])

// ── whitespace fidelity — tabs, trailing spaces, blank lines survive; the leading-newline nicety ─────────
const whitespace = codeBlock('', 'if (ok) {\n\treturn value   // tab-indented, three trailing spaces\n}\n\n// a blank line above is preserved verbatim')
const whitespaceNote = el('p', {}, [
  text('white-space: pre — every newline, tab, and trailing space is real text in the DOM (copy-paste fidelity is free). Author without a leading blank line inside the tag: unlike native '),
  inline('<pre>'), text(', ui-code renders a leading newline rather than stripping it.'),
])

// ── the component's own overflow — a long unbroken line inside a feed-bubble-width box ───────────────────
const overflow = codeBlock('shell',
  'curl -sS -X POST https://api.example.com/v1/bookings -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{"room":"deluxe-king","nights":3,"breakfast":true,"guest":{"name":"Priya Natarajan","email":"priya@example.com"}}\'')
applyDemoWidth(overflow, '22rem')
const overflowNote = el('p', {}, [
  text('A 22rem box (a feed bubble’s width): the line never wraps mid-token and never blows out its container — '),
  inline('overflow-x: auto'), text(' on the host itself (host-as-content, no inner wrapper). Where the engine has a focusable scroller, Tab reaches it and ArrowRight scrolls; ui-code mints no tabindex of its own.'),
])

content.append(
  exampleSection('Inline + block — an agent’s answer', answer, answerNote),
  exampleSection('Across languages — verbatim vs. projected', grid, langNote),
  exampleSection('Whitespace fidelity', whitespace, whitespaceNote),
  exampleSection('The component’s own overflow', overflow, overflowNote),
)
