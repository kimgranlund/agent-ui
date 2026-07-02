// site/pages/form-provider-doc.ts — the ui-form-provider API doc page (G7, ADR-0050 / LLD-C7). DERIVED from
// `form-provider.md` via the shared doc-page.ts renderer: the provider takes no configuration (`attributes: []`),
// so composeDocPage renders NO Attributes table — its public surface is the Properties (controls · entries ·
// values · invalid · valid · submit · reset), the one `change` submit event, and the default slot, each read
// straight from the descriptor. The prose body carries the protocol (ui-form-connect plumbing · nearest-provider
// nesting · teardown-by-abort · native-<form> composition). One LIVE specimen shows the coordinated markup shape;
// the submit()/values() round-trip is on the ui-form-provider demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadFormProviderDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadFormProviderDoc()

const { content } = mountPage({
  title: 'ui-form-provider — API',
  intro:
    'The fleet’s first context/provider primitive — a pure coordination layer over its UIFormElement ' +
    'descendants. It takes no configuration; discovery, aggregation, submit, and reset are entirely behavioral, ' +
    'driven by the descendants it coordinates. Generated from form-provider.md. See the ui-form-provider demo ' +
    'for the live submit() + values() round-trip.',
})

// A representative coordinated subtree — the markup shape the descriptor documents (fielded controls that each
// register with the nearest provider at connect). Coordination is invisible, so this is a shape specimen; the
// demo page drives submit()/values()/valid() live.
const specimen = el('ui-form-provider', {}, [
  el('ui-field', { label: 'Name' }, [el('ui-text-field', { name: 'name', required: '' })]),
  el('ui-field', { label: 'Email' }, [el('ui-text-field', { name: 'email', type: 'email' })]),
])
applyDemoWidth(specimen, '24rem')

composeDocPage(content, descriptor, body, exampleSection('Coordinated subtree', specimen))
