// site/pages/getting-started.ts — the consuming-agent-ui guide: what the workspace ships, the load-bearing CSS
// cascade every page (including this one) already demonstrates, and a minimal runnable example. The per-control
// subpath list is DERIVED — read at build time from @agent-ui/components' real package.json `exports` map
// (Vite `?raw` + JSON.parse, the frontmatter.ts convention) — never hand-typed, so a new/renamed control's
// export flows here with zero edits. The package-map prose is hand-authored (cited to CLAUDE.md's Layout
// section by ID — the T6 soft-staleness rule, docs-author's method §5): there is no single machine-readable
// "what is this package for" source to parse.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './getting-started.css'
import { heading, codeCell, tableHead, tableRow, textCell } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import componentsPkgRaw from '../../packages/agent-ui/components/package.json?raw'

const { content } = mountPage({
  title: 'Getting started',
  intro:
    'How to consume agent-ui in your own app: the workspace packages, the one load-bearing CSS import order, ' +
    'and a minimal runnable example — the same shape every page on this site is itself built from.',
})

content.append(
  pageLead(
    'agent-ui is zero-dependency, light-DOM by default, and wires ARIA through ElementInternals rather than ' +
      'native form elements — a ui-text-field is a real, form-associated custom element, not an <input> ' +
      'wrapper. Two sentences, and the rest of this page is how that shows up in your own code.',
  ),
)

// ── the workspace packages (hand-authored — cited to CLAUDE.md's Layout section, soft staleness) ──────────────
content.append(heading(2, 'The workspace packages'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'agent-ui is an npm-workspaces monorepo; every package lives under packages/agent-ui/*. The map below ' +
        'follows the repo’s own CLAUDE.md “Layout” section — the canonical description, cited rather than ' +
        're-derived (a package’s purpose has no single machine-readable source to parse).',
    ),
  ]),
)

interface PackageRow {
  readonly name: string
  readonly summary: string
}
const PACKAGES: readonly PackageRow[] = [
  { name: '@agent-ui/components', summary: 'The whole framework: the signals kernel (reactive/), the UIElement/UIFormElement base classes + template engine (dom/), traits, and every shipped ui-* FACE control (controls/). Depends on nothing else in the workspace.' },
  { name: '@agent-ui/shared', summary: 'Cross-cutting tokens and utility types — the colour role system (tokens.css) and the dimensional/runtime ramp (dimensions.css) every control reads.' },
  { name: '@agent-ui/icons', summary: 'The swappable icon-pack adapter (registry · resolver · declarative <ui-icon> consumer) — Phosphor vendored as the default pack, zero runtime dependency.' },
  { name: '@agent-ui/a2ui', summary: 'The A2UI (Generative UI) layer — a zero-dep renderer for Google’s A2UI protocol over the default catalog. Depends on @agent-ui/components.' },
  { name: '@agent-ui/a2a', summary: 'The A2A (Agent2Agent) protocol layer — wire types, validation, and the tic-tac-toe isolation-proof arena. Zero dependencies.' },
  { name: '@agent-ui/app', summary: 'App-surface compositions — ui-app-shell, the application frame. Depends on components + a2ui + shared.' },
  { name: '@agent-ui/router', summary: 'A memory-first SPA router with opt-in URL reflection — createRouter/connectUrl + ui-router-outlet/ui-router-link. Depends only on components + shared; never imported by a2ui or app.' },
]
{
  const table = document.createElement('table')
  table.append(tableHead('Package', 'What it’s for'))
  const tbody = document.createElement('tbody')
  for (const p of PACKAGES) tbody.append(tableRow(codeCell(p.name), textCell(p.summary)))
  table.append(tbody)
  content.append(table)
}
content.append(
  el('p', { class: 'gs-note' }, [
    document.createTextNode(
      'None of these are published to npm yet — first publish is tracked as a deliberate deferral in the ' +
        'repo’s CHANGELOG. Until then, consuming agent-ui means depending on the workspace packages directly, ' +
        'exactly as this docs site itself does. The import shape below is the shape that carries over unchanged ' +
        'once publishing lands.',
    ),
  ]),
)

// ── the load-bearing CSS cascade (ADR-0003) — the real lines every page on this site opens with ───────────────
content.append(heading(2, 'The CSS import order (load-bearing — ADR-0003)'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Foundation tokens must load before per-control CSS, which must load before the controls self-define — ' +
        'reversing the order leaves a control reading undeclared custom properties. Every page on this site ' +
        'opens with exactly this sequence (verbatim from site/pages/_page.ts, the shared shell every page ' +
        'imports first):',
    ),
  ]),
)
content.append(
  codeBlock(
    [
      "import '@agent-ui/components/foundation-styles.css' // [1] tokens.css -> dimensions.css (FIRST)",
      "import '@agent-ui/components/base-styles.css'      // [1b] OPT-IN document basics: body typeface (--md-sys-typeface-sans),",
      '                                                     //      leading, ink/surface, font smoothing — for a page',
      "                                                     //      WITHOUT its own shell/body rule (this site's shell",
      '                                                     //      sets its own, so the docs pages skip it)',
      "import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation",
      "import '@agent-ui/components/components'           // [3] self-defining ui-* controls (registers every tag)",
      "import '@agent-ui/icons/phosphor'                   // [3b] the default icon pack — activates the affordances",
      '                                                     //      controls render through @agent-ui/icons',
    ].join('\n'),
    'ts',
  ),
)

// ── a minimal runnable example — a real, live ui-button on THIS page ────────────────────────────────────────
content.append(heading(2, 'A minimal example'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Once the cascade above has run once (application-wide, not per component), using a control is plain DOM: ' +
        'create the element, set its attributes-as-API, listen for its events. The button below is real — this ' +
        'page mounted it the same way.',
    ),
  ]),
)
content.append(
  codeBlock(
    [
      "const button = document.createElement('ui-button')",
      "button.setAttribute('variant', 'solid')",
      "button.textContent = 'Get started'",
      "button.addEventListener('click', () => console.log('clicked'))",
      'document.body.append(button)',
    ].join('\n'),
    'ts',
  ),
)
{
  const live = document.createElement('ui-button')
  live.setAttribute('variant', 'solid')
  live.textContent = 'Get started'
  let clicks = 0
  const status = document.createElement('p')
  status.className = 'gs-click-status'
  status.textContent = 'clicks: 0'
  live.addEventListener('click', () => {
    clicks += 1
    status.textContent = `clicks: ${clicks}`
  })
  content.append(exampleSection('Live', live, status))
}

// ── per-control subpath imports for tree-shaking — DERIVED from the real exports map ───────────────────────────
content.append(heading(2, 'Per-control imports (tree-shaking)'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'The barrel import above (@agent-ui/components/components) registers every control. A production build ' +
        'that only uses a handful of controls can import each by its own subpath instead — read below straight ' +
        'from @agent-ui/components’ real package.json exports map, so a control renamed or added there updates ' +
        'this list with no edit here.',
    ),
  ]),
)

interface PackageJsonShape {
  readonly exports: Record<string, string>
}
const pkg = JSON.parse(componentsPkgRaw) as PackageJsonShape
const controlSubpaths = Object.keys(pkg.exports)
  .filter((k) => k.startsWith('./controls/'))
  .sort()
if (controlSubpaths.length === 0) {
  throw new Error('getting-started.ts: 0 "./controls/*" exports found in @agent-ui/components/package.json')
}
content.append(
  el('p', { class: 'gs-note' }, [document.createTextNode(`${controlSubpaths.length} controls ship their own subpath today:`)]),
)
content.append(
  codeBlock(
    controlSubpaths.map((subpath) => `import '@agent-ui/components${subpath.slice(1)}' // registers ${subpath.replace('./controls/', 'ui-')}`).join('\n'),
    'ts',
  ),
)
