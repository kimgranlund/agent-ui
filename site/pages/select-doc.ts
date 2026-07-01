// site/pages/select-doc.ts — the ui-select API doc page (Wave 4 S4). DERIVED from `select.md` via the shared
// doc-page.ts renderer (the descriptor-derived tables cannot drift). One representative LIVE select mounts the
// real form control (a trigger over a top-layer [role=listbox]); the value round-trip in a <form> + the
// select/toggle log is on the Select demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadSelectDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadSelectDoc()

const { content } = mountPage({
  title: 'ui-select — API',
  intro: 'The single-select form control — a trigger opening a top-layer listbox; the selected option key submits ' +
    'under name. Generated from select.md (descriptor-derived tables). See the Select demo for the live form-value ' +
    'round-trip + select/toggle log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-select: the [role=option] children (each with a value key) are moved into the
// control-created listbox at first connect. Pre-selected value="pro".
const select = el('ui-select', { name: 'tier', value: 'pro' }, [
  el('div', { role: 'option', value: 'free' }, [text('Free')]),
  el('div', { role: 'option', value: 'pro' }, [text('Pro')]),
  el('div', { role: 'option', value: 'enterprise' }, [text('Enterprise')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', select))
