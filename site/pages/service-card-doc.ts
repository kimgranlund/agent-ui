// site/pages/service-card-doc.ts — the ui-service-card API doc page (tier=pattern ⇒ {doc, demo}, ADR-0224 /
// GH #1429). DERIVED from `service-card.md` via the shared doc-page.ts renderer: the attribute table (name,
// path, description, available, actionLabel, inline), the events[] table (action), the slots[] table (menu),
// and the parts[] table (body/heading/status/status-text/title/path/description/action) are read straight
// from the parse — so none can drift from the descriptor the contract trip-wire enforces (ADR-0004). Two
// representative live specimens (available + unavailable) show the availability-law paint; the interactive
// action-toggle + event log live on the ui-service-card demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadServiceCardDoc } from '../lib/frontmatter.ts'
import { composeDocPage, specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadServiceCardDoc()

const { content } = mountPage({
  title: 'ui-service-card — API',
  intro:
    'The availability-stated service/agent launch card (ADR-0224, GH #1429) — ONE bindable `available` ' +
    'boolean drives the status-tinted accent edge, the status dot, the title mute, and the trailing ' +
    'Open ⟷ Unavailable action swap together, by construction. Generated from service-card.md: the ' +
    'attribute/events/slots/parts tables are descriptor-derived. See the ui-service-card demo for the live ' +
    'availability toggle + an `action` event log.',
})

const available = el('ui-service-card', {
  name: 'Claims Agent',
  path: '/claims-agent-service',
  description: 'Handles first-notice-of-loss intake and triage.',
  available: '',
}, [])

const unavailable = el('ui-service-card', {
  name: 'Billing Agent',
  path: '/billing-agent-service',
  description: 'Reconciles invoices against the ledger.',
}, [])

// Block-level fill by default (ADR-0223/ADR-0224 cl.5, no intrinsic width) — applyDemoWidth gives each
// specimen a display width so the two cards read side by side rather than each collapsing to zero.
applyDemoWidth(available, '20rem')
applyDemoWidth(unavailable, '20rem')

composeDocPage(content, descriptor, body, exampleSection('Example', specimenRow([available, unavailable])))
