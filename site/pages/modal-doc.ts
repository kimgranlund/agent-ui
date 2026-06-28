// site/pages/modal-doc.ts — the ui-modal API doc page (T4). DERIVED from `modal.md` via the shared doc-page.ts
// renderer (the attribute table is surfaceProps + open/dismissable). One representative LIVE specimen mounts the
// real native-<dialog> modal behind a trigger button. The rich interaction (open/close + focus restore + the
// close/toggle log) is the Modal demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadModalDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadModalDoc()

const { content } = mountPage({
  title: 'ui-modal — API',
  intro: 'A modal dialog on the native <dialog> element (showModal): top-layer stacking, a backdrop, a focus ' +
    'trap, and Escape-to-dismiss from the platform. Generated from modal.md (descriptor-derived table). See the ' +
    'Modal demo for open/close + focus restore.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-modal behind a trigger. The modal is dismissable by default (Escape / backdrop click);
// the trigger opens it by setting the bindable `open` prop, exactly as an agent's two-way bind would.
const dialog = el('ui-modal', { 'aria-label': 'Example dialog' }, [
  el('h2', {}, [text('Example dialog')]),
  el('p', {}, [text('Press Escape or click the backdrop to dismiss — both are platform behaviours.')]),
  el('ui-row', { gap: 'sm', justify: 'end' }, [uiButton('Close', 'soft')]),
])
const trigger = uiButton('Open dialog', 'solid')
trigger.addEventListener('click', () => dialog.setAttribute('open', ''))
dialog.querySelector('ui-button')?.addEventListener('click', () => dialog.removeAttribute('open'))

composeDocPage(content, descriptor, body, exampleSection('Example', trigger, dialog))
