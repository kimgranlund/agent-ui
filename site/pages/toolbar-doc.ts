// site/pages/toolbar-doc.ts — the ui-toolbar API doc page (ADR-0121; toolbar.lld.md LLD-C12). DERIVED from
// toolbar.md via the shared doc-page.ts renderer (the attribute table is the surfaceProps spread +
// orientation/align/justify/gap/overflow/label). One representative LIVE specimen mounts the real element,
// populated (not a lorem stub — the representative-specimen law); the both-postures interaction is the
// Toolbar demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadToolbarDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadToolbarDoc()

const { content } = mountPage({
  title: 'ui-toolbar — API',
  intro: 'A Pattern-class action bar — role=toolbar + arrow-key roving focus over the light-DOM children, ' +
    'with the floating/embedded posture expressed entirely through the elevation/brightness surface axis. ' +
    'Generated from toolbar.md (descriptor-derived tables). See the Toolbar demo for both postures + roving keyboard.',
})

// A representative live ui-toolbar: an embedded action bar (elevation=0, the ui-tabs doc-page precedent — a
// bare toolbar is transparent by default, so this specimen asks for its plane explicitly for visibility on
// the canvas surface) with three real ui-buttons.
const toolbar = el('ui-toolbar', { label: 'Document actions', elevation: '0' }, [
  uiButton('Bold', 'ghost'),
  uiButton('Italic', 'ghost'),
  uiButton('Share', 'ghost'),
])

composeDocPage(content, descriptor, body, exampleSection('Example', toolbar))
