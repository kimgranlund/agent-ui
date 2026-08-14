// site/pages/drawer-doc.ts — the ui-drawer API doc page (ADR-0188). DERIVED from `drawer.md` via the shared
// doc-page.ts renderer (the attribute table is surfaceProps + open/persistent/edge). One representative LIVE
// specimen mounts the real edge-docked drawer behind a trigger button. The rich interaction (all three edges,
// persistent, focus restore, close/toggle log) is the Drawer demo. The four-cell overlay/docking Boundary
// section is NOT hand-authored here — it renders straight from drawer.md's own prose body (composeDocPage's
// renderMarkdownBody), so the doc page can never drift from the descriptor's own boundary sentence.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadDrawerDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadDrawerDoc()

const { content } = mountPage({
  title: 'ui-drawer — API',
  intro: 'An edge-docked modal container on the native <dialog> element opened with showModal() (ADR-0188): ' +
    'the same top-layer stacking, backdrop, focus trap, and Escape-to-dismiss ui-modal gets from the platform, ' +
    'docked to a viewport edge instead of centred. Generated from drawer.md (descriptor-derived table). See the ' +
    'Drawer demo for all three edges + focus restore.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-drawer behind a trigger, docked to the default edge ('end'). Dismissable by default
// (Escape / backdrop click); the trigger opens it by setting the bindable `open` prop, exactly as an agent's
// two-way bind would.
const drawer = el('ui-drawer', { 'aria-label': 'Example drawer' }, [
  el('header', {}, [el('h2', { style: 'margin:0' }, [text('Example drawer')])]),
  el('div', { 'data-region': 'content' }, [
    el('p', { style: 'margin:0' }, [text('Press Escape or click the backdrop to dismiss — both are platform behaviours.')]),
  ]),
  el('footer', { style: 'justify-content:flex-end' }, [uiButton('Close', 'soft')]),
])
const trigger = uiButton('Open drawer', 'solid')
trigger.addEventListener('click', () => drawer.setAttribute('open', ''))
drawer.querySelector('ui-button')?.addEventListener('click', () => drawer.removeAttribute('open'))

composeDocPage(content, descriptor, body, exampleSection('Example', trigger, drawer))
