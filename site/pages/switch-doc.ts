// site/pages/switch-doc.ts — the ui-switch API doc page (T4). DERIVED from `switch.md`: the API table is built
// row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens iterate the parsed
// `size` enum + the real boolean attributes — so neither can drift from the descriptor the contract trip-wire
// enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are the SHARED
// lib/doc-page.ts; only the switch-specific specimens live here. The pill track + 2px-inset thumb paint in CSS.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSwitchDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadSwitchDoc()

const { content } = mountPage({
  title: 'ui-switch — API',
  intro: 'A FACE form-associated Indicator-class control: a pill track with a 2px-inset thumb (ADR-0041) that ' +
    'slides on checked. This page is generated from switch.md — the API table and the size specimens are derived ' +
    'from the same frontmatter the contract trip-wire validates, so they cannot drift; the States are hand-staged.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-switch> specimens. The Sizes row iterates the PARSED `size` enum; the States row
// stages off/on plus the disabled channel. The switch is boolean-only (no indeterminate, unlike checkbox).
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => toggle({ size: s, checked: '' }, `size = ${s}`))),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      toggle({}, 'Off'),
      toggle({ checked: '' }, 'On'),
      toggle({ disabled: '' }, 'Disabled (off)'),
      toggle({ checked: '', disabled: '' }, 'Disabled (on)'),
    ]),
  )
  return section
}

// toggle — a live specimen: a real <ui-switch> with the given attributes set; the label is the default-slot text
// (the accessible name). The pill track + sliding thumb are painted by switch.css.
function toggle(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-switch')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}
