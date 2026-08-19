// site/pages/file-drop-doc.ts — the ui-file-drop API doc page (ADR-0210, GH #1391). DERIVED from
// file-drop.md via the shared doc-page.ts renderer (the descriptor-derived tables cannot drift). One
// representative live ui-file-drop, wired with a stub `intake` (mints a fake id — this doc page runs with
// no real host storage) so the control renders in its normal, wired state rather than the unwired-disabled
// one. The full commit-path event log + form round-trip is on the Demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadFileDropDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadFileDropDoc()

const { content } = mountPage({
  title: 'ui-file-drop — API',
  intro: 'The fleet’s file-INPUT affordance — a dropzone + picker button + committed-file chips + a ' +
    'paste target. Host-mediated HANDLE model: bytes never ride the control’s own public API, only ' +
    'host-minted {id, name, mimeType, sizeBytes} descriptors (ADR-0210). Generated from file-drop.md ' +
    '(descriptor-derived tables). See the Demo page for the live commit-path event log + form round-trip.',
})

// A representative live ui-file-drop, wired with a stub intake seam (this doc page has no real host
// storage — see the file header note). Unwired (no intake) would render visibly disabled (cl.4.5); this
// specimen shows the NORMAL wired state instead.
const drop = el('ui-file-drop', { label: 'Drop your CSV here', accept: '.csv' }) as HTMLElement & {
  intake: (files: readonly File[]) => Promise<{ id: string; name: string; mimeType: string; sizeBytes: number }[]>
}
let seq = 0
drop.intake = async (files) => files.map((f) => ({ id: `doc-${seq++}`, name: f.name, mimeType: f.type, sizeBytes: f.size }))

composeDocPage(content, descriptor, body, exampleSection('Example', drop))
