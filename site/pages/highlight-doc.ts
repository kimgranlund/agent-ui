// site/pages/highlight-doc.ts — the @agent-ui/code/highlight GUIDE page (ADR-0119, LLD-C4/C7). No tagged
// element exists here (this pack is a swappable registry + 7 bundled tokenizers, not a component) — the
// SAME ungrouped-site-level-link posture @agent-ui/router's own doc page uses; site-toc/site-coverage/
// site-canon (all components/src-scoped) never expect a per-component page set for it. This page is
// importing the REAL pack (not a mock) — every highlighted specimen below is the genuine bundled
// tokenizer output, not a hand-colored fixture.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003) — already registers <ui-code>
import '@agent-ui/code/highlight' // self-registers the bundled highlighter into the default singleton (SPEC-C4 AC1)
import '@agent-ui/code/highlight.css'
import '@agent-ui/code/markdown'
import '@agent-ui/code/markdown.css'
import { heading } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'

const { content } = mountPage({
  title: '@agent-ui/code/highlight',
  intro:
    'A swappable, pack-independent syntax-highlighter registry (the core, `.` barrel) plus seven ' +
    "bundled tokenizers (this ./highlight subpath) — zero third-party dependencies, hand-rolled, self-" +
    'registering on import. Every ui-code element on the page (and every fenced block inside ui-markdown) ' +
    'reads from the SAME one-slot registry, so importing this pack once turns highlighting on fleet-wide.',
})

// ── activation — the one import that does the whole job ──────────────────────────────────────────────────
content.append(
  exampleSection(
    'Activation',
    codeBlock("import '@agent-ui/code/highlight'", 'ts'),
    el('p', {}, [
      document.createTextNode(
        'Self-registers on import — no setup call, no registry reference needed for the common case. ' +
          'Every ui-code element (and every fenced code block ui-markdown renders) picks up the active ' +
          'highlighter automatically, since both read through the same core registry.',
      ),
    ]),
  ),
)

// ── the seven bundled tokenizers, live ────────────────────────────────────────────────────────────────────
content.append(heading(2, 'The seven bundled tokenizers'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Dispatch is by language string, case-insensitive; an unrecognized language falls back to plain ' +
        'text — never an error (SPEC-C4 AC3). ts and js share one grammar; markdown and md share another.',
    ),
  ]),
)

const SAMPLES: ReadonlyArray<{ readonly lang: string; readonly code: string }> = [
  { lang: 'ts', code: "const greet = (name: string): string => `Hello, ${name}!`\n// a comment" },
  { lang: 'json', code: '{\n  "ok": true,\n  "count": 3\n}' },
  { lang: 'html', code: '<ui-button variant="solid">Send</ui-button>' },
  { lang: 'css', code: ':where(ui-button) {\n  --ui-button-radius: 0.5rem;\n}' },
  { lang: 'python', code: 'def greet(name: str) -> str:\n    return f"Hello, {name}!"  # a comment' },
  { lang: 'shell', code: 'npm run check && npm test' },
]

const grid = el('div')
grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(18rem,1fr)); gap:1rem; margin-block:1rem;'
for (const { lang, code } of SAMPLES) {
  const label = el('p', {}, [document.createTextNode(lang)])
  label.style.cssText = 'font-family:var(--md-sys-typeface-mono); font-size:0.8rem; margin:0 0 0.35rem;'
  const sample = document.createElement('ui-code')
  sample.setAttribute('language', lang)
  sample.textContent = code
  const cell = el('div', {}, [label, sample])
  grid.append(cell)
}
content.append(grid)

// ── the round-trip / fail-closed guarantee ────────────────────────────────────────────────────────────────
content.append(heading(2, 'The fidelity floor'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Every registered highlighter is checked against a round-trip invariant before its output is ' +
        'trusted: concatenating every emitted token’s text must reproduce the input EXACTLY. A ' +
        'highlighter that throws, or whose tokens do not round-trip, is silently downgraded to plain, ' +
        'verbatim text — the displayed code is never corrupted or dropped, only its coloring is lost.',
    ),
  ]),
)

// ── it composes with ui-markdown too ──────────────────────────────────────────────────────────────────────
content.append(heading(2, 'Composes with ui-markdown'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'A fenced code block inside ui-markdown renders as a real ui-code element internally — the same ' +
        'registry lights it up, no separate wiring needed.',
    ),
  ]),
)
const md = document.createElement('ui-markdown')
;(md as HTMLElement & { markdown: string }).markdown = '```ts\nconst REVENUE = { EMEA: 42, Americas: 58, APAC: 31 }\n```'
content.append(md)

// ── swapping in a custom engine ────────────────────────────────────────────────────────────────────────────
content.append(heading(2, 'Bringing your own highlighter'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'The core registry is engine-agnostic — the bundled tokenizers are one Highlighter implementation, ' +
        'not the only one. registerHighlighter(fn) replaces the active engine (last-registration-wins, no ' +
        'chain); a consumer wanting Shiki, Prism, or anything else registers it the same way, generally ' +
        'AFTER importing ./highlight if they want to override the bundled default.',
    ),
  ]),
  codeBlock(
    [
      "import { registerHighlighter } from '@agent-ui/code'",
      '',
      'registerHighlighter((code, language) => {',
      '  // return a Token[] that round-trips `code` exactly',
      '})',
    ].join('\n'),
    'ts',
  ),
)
