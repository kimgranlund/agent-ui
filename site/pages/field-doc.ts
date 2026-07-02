// site/pages/field-doc.ts — the ui-field API doc page (G7, ADR-0051 / LLD-C4). DERIVED from `field.md` via the
// shared doc-page.ts renderer (composeDocPage): the Attributes + Slots tables are read straight from the
// descriptor the contract trip-wire validates, and the prose body (the association model · the labelling seam +
// option-A bridge · the reactive error rendering · the F4 limitation) is rendered by the same shared path — so
// nothing on this page is a hand-copy that could drift from the descriptor. One LIVE specimen (a field wrapping a
// required text-field) sits between the tables and the prose; the blur→error round-trip is on the ui-field demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadFieldDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadFieldDoc()

const { content } = mountPage({
  title: 'ui-field — API',
  intro:
    'The visible label / description / error wrapper around ONE slotted form control — a structural, non ' +
    'form-associated container that hands its three parts to the control through the ADR-0051 labelling seam. ' +
    'Generated from field.md (descriptor-derived tables). See the ui-field demo for the live blur→error round-trip.',
})

// A representative composed field: label + description wrapping a required ui-text-field — the reference wire this
// wave, the only control that yet drives the visible error (the F4 limitation, documented below). Attributes are
// the author surface; applyDemoWidth gives the field a tidy display width and its slotted control stretches to it.
const field = el('ui-field', { label: 'Email', description: "We'll never share it" }, [
  el('ui-text-field', { type: 'email', name: 'email', required: '' }),
])
applyDemoWidth(field, '22rem')

composeDocPage(content, descriptor, body, exampleSection('Example', field))
