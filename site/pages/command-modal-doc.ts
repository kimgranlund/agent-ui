// site/pages/command-modal-doc.ts — the ui-command-modal API doc page (LLD-C17). DERIVED from
// `command-modal.md` via the shared doc-page.ts renderer (the descriptor-derived tables cannot drift). A
// minimal live specimen: a toggle button that opens a small palette. The rich interaction (grouped commands,
// icons + shortcuts, the empty state, both hotkey modes) is the Command palette demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadCommandModalDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadCommandModalDoc()

const { content } = mountPage({
  title: 'ui-command-modal — API',
  intro: 'The CMD-K command palette — a search combobox filtering a listbox, nested inside a ui-modal for the ' +
    'whole surface + dismissal contract. Generated from command-modal.md (descriptor-derived tables). See the ' +
    'Command palette demo for the full grouped-command flow.',
})

const text = (s: string): Text => document.createTextNode(s)

// A minimal live specimen — a toggle button opens a small palette with two commands.
const palette = el('ui-command-modal', { label: 'Command palette', placeholder: 'Type a command…' }, [
  el('div', { role: 'option', value: 'home' }, [text('Go Home')]),
  el('div', { role: 'option', value: 'settings' }, [text('Settings')]),
])
const trigger = uiButton('Open command palette', 'solid')
// The palette's own `open` is bindable two-way (the ui-modal shape) — the trigger sets it; a commit clears it
// itself (#commit sets open=false on select), so no readback wiring is needed here.
trigger.addEventListener('click', () => palette.setAttribute('open', ''))

composeDocPage(content, descriptor, body, exampleSection('Example', trigger, palette))
