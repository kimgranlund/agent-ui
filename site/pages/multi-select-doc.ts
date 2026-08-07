// site/pages/multi-select-doc.ts — the ui-multi-select API doc page (M-F, multi-select-field.lld.md ·
// ADR-0175). DERIVED from `multi-select.md` via the shared doc-page.ts renderer (the descriptor-derived
// tables cannot drift). One representative LIVE multi-select mounts the real always-visible listbox — no
// trigger, no overlay. The form-value round-trip + select event log is on the Demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadMultiSelectDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadMultiSelectDoc()

const { content } = mountPage({
  title: 'ui-multi-select — API',
  intro: 'The multi-select form field — an always-visible listbox, no trigger/overlay; every selected value ' +
    'submits under name as its own FormData entry, and the same selection is the one bindable value: string[] ' +
    'array. Generated from multi-select.md (descriptor-derived tables). See the Demo page for the live ' +
    'form-value round-trip + select event log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-multi-select: the [role=option] children (each with a value key) stay DIRECT
// children — no control-created panel to move into, unlike ui-select. Two pre-selected values.
const multiSelect = el('ui-multi-select', { name: 'skills', value: '["js","css"]', label: 'Skills' }, [
  el('div', { role: 'option', value: 'js' }, [text('JavaScript')]),
  el('div', { role: 'option', value: 'css' }, [text('CSS')]),
  el('div', { role: 'option', value: 'html' }, [text('HTML')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', multiSelect))
