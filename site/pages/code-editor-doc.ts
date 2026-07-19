// site/pages/code-editor-doc.ts — the ui-code-editor API doc page (ADR-0139, ADR-0147). DERIVED from `editor.md` via
// the shared doc-page.ts renderer (composeDocPage threads the attribute/properties/events/parts tables
// through for free). The element lives OUTSIDE components/src (@agent-ui/code/editor — an opt-in subpath
// carrying agent-ui's first genuine third-party runtime dependency, CodeMirror 6, lazy-loaded) — the SAME
// ungrouped-site-level-link posture @agent-ui/router's own doc page uses; site-toc/site-coverage/site-canon
// (all components/src-scoped) never expect a per-component page set for it. Only the live specimens are
// hand-authored here.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import '@agent-ui/code/editor' // self-defining <ui-code-editor> (the CodeMirror runtime stays lazy — ADR-0139)
import '@agent-ui/code/editor.css'
import { loadCodeEditorDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading, renderChangelogTable, specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth } from '../lib/specimens.ts'

const { descriptor, body } = loadCodeEditorDoc()

const { content } = mountPage({
  title: 'ui-code-editor — API',
  intro:
    'agent-ui\'s first control to adopt a genuine third-party runtime dependency — CodeMirror 6, confined to ' +
    'this opt-in @agent-ui/code/editor subpath and lazy-loaded. Editable-first: a plain contenteditable ' +
    'surface renders immediately with zero CodeMirror loaded, which then progressively enhances the surface ' +
    'for language="markdown" — it never becomes read-only on load failure or timeout. The editor counterpart ' +
    'of the display-only ui-code, and a drop-in swap for ui-textarea (byte-identical change/input timing). ' +
    'An opt-in mode="richtext" (ADR-0147) turns on an Obsidian-style live preview — CodeMirror decorations over ' +
    'the SAME document, reveal-near-cursor — with a built-in toggle that appears once the capability is live.',
})

composeDocPage(content, descriptor, body, renderExamples())

const changelog = renderChangelogTable([
  { date: '2026-07-17', type: 'Decision', id: 'ADR-0139', summary: 'Shipped ui-code-editor: agent-ui\'s first deliberate breach of its own zero-dependency pillar, adopting CodeMirror 6 behind a lazy-loaded opt-in subpath.' },
  { date: '2026-07-18', type: 'Decision', id: 'ADR-0147', summary: 'Shipped a richtext live-preview mode (mode="richtext") — CodeMirror decorations over the SAME document, reveal-near-cursor, a built-in mode toggle; zero new dependencies, markdown stays the only model.' },
])
if (changelog) content.append(changelog)

// ── live specimens ────────────────────────────────────────────────────────────────────────────────────────

function renderExamples(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  section.append(
    heading(3, 'Markdown highlighting'),
    specimenRow([
      codeEditor({
        label: 'language = markdown',
        language: 'markdown',
        value: '## Heading\n\nSome *markdown* content, syntax-highlighted once CodeMirror enhances the surface.',
        rows: '6',
      }),
    ]),
  )

  section.append(
    heading(3, 'Richtext live preview (ADR-0147)'),
    specimenRow([
      codeEditor({
        label: 'mode = richtext',
        language: 'markdown',
        mode: 'richtext',
        value: '## Live preview\n\nHeadings, **bold**, _emphasis_, `inline code`, links, bullets, and blockquotes ' +
          'render styled — the built-in toggle (top-right corner) flips back to raw source.\n\n' +
          '- an item\n- another item\n\n> a quoted line\n\n[agent-ui](https://github.com/) on GitHub.',
        rows: '10',
      }),
    ]),
  )

  section.append(
    heading(3, 'States'),
    specimenRow([
      codeEditor({ label: 'Empty', placeholder: 'Write something…' }),
      codeEditor({ label: 'Rows = 6', rows: '6', value: 'A taller minimum — rows sets a MIN height, not a fixed one.' }),
      codeEditor({ label: 'Required', required: true }),
      codeEditor({ label: 'Read only', value: 'Select me, but you cannot edit', readonly: true }),
      codeEditor({ label: 'Disabled', value: 'Inert', disabled: true }),
    ]),
  )

  return section
}

interface CodeEditorSpec {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly language?: string
  readonly mode?: string
  readonly rows?: string
  readonly required?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
}

function codeEditor(spec: CodeEditorSpec): HTMLElement {
  const el = document.createElement('ui-code-editor')
  el.setAttribute('label', spec.label)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.language) el.setAttribute('language', spec.language)
  if (spec.mode) el.setAttribute('mode', spec.mode)
  if (spec.rows) el.setAttribute('rows', spec.rows)
  if (spec.required) el.setAttribute('required', '')
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  applyDemoWidth(el, '20rem')
  return el
}
