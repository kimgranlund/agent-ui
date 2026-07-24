// site/pages/sandbox-frame-doc.ts — the ui-sandbox-frame API doc page (genui-surface.spec.md SPEC
// §3.2/§3.3, D9). DERIVED from its own `controls/sandbox-frame/sandbox-frame.md` descriptor via the
// shared doc-page.ts renderer (the theme-provider-doc.ts / form-provider-doc.ts precedent): an
// Attributes table (surfaceId/html/csp), the two rendered parts (frame/fallback), the `action` event,
// and the prose body (containment, CSP, the bridge, live theme, fail-closed). One LIVE specimen shows a
// small, harmless HTML document rendered inside the frame — see the ui-sandbox-frame demo page for the
// fail-closed / never-paint proof.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadDescriptorByTag } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'
import type { UISandboxFrameElement } from '@agent-ui/components/components'

const doc = loadDescriptorByTag('ui-sandbox-frame')
if (!doc) throw new Error('sandbox-frame-doc.ts: no ui-sandbox-frame descriptor found via loadDescriptorByTag')
const { descriptor, body } = doc

const { content } = mountPage({
  title: 'ui-sandbox-frame — API',
  intro:
    'The GenUI containment host (genui-surface.spec.md SPEC §3.2/§3.3) — a light-DOM control wrapping ONE ' +
    'sandboxed `<iframe>`, the SPEC-R4 meta-CSP, the SPEC-R6 token bridge, and the SPEC-R7/R8 closed ' +
    'postMessage bridge. Generated from its own descriptor. See the ui-sandbox-frame demo for a live, ' +
    'rendered specimen and the fail-closed/never-paint proof.',
})

const specimen = el('ui-sandbox-frame', {}) as UISandboxFrameElement
applyDemoWidth(specimen, '28rem')
specimen.html =
  '<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; margin: 0; padding: 1rem;">' +
  '<h1 style="margin: 0 0 0.5rem; font-size: 1rem;">Hello from the sandbox</h1>' +
  '<p style="margin: 0; color: #555;">This document runs inside an opaque-origin, script-only sandbox.</p>' +
  '</body></html>'

composeDocPage(content, descriptor, body, exampleSection('A rendered document', specimen))
