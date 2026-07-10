// site/pages/timeline-doc.ts — the ui-timeline API doc page (ADR-0122, timeline-family.lld.md). DERIVED
// from timeline.md via the shared doc-page.ts renderer: the attribute table (size/label), the events[]
// table (empty — a static display-first host), and the slots[] table (items) are read straight from the
// parse. One representative specimen: an order-tracking chronology with a real collapsible detail.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTimelineDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadTimelineDoc()

const { content } = mountPage({
  title: 'ui-timeline — API',
  intro:
    'The timeline family’s durable host (ADR-0122) — a static, authored-children chronology. Extends ' +
    'UIContainerElement, is NOT form-associated, and hosts ui-timeline-item children the consumer authors ' +
    'directly, read back in DOM order. Generated from timeline.md. See the ui-timeline demo for a live ' +
    'order-tracking specimen.',
})

const orderTracking = el('ui-timeline', { label: 'Order status', size: 'md' }, [
  el('ui-timeline-item', { status: 'done', label: 'Order placed', timestamp: 'Apr 15, 2:30 PM' }, []),
  el('ui-timeline-item', { status: 'done', label: 'Processing', timestamp: 'Apr 16, 9:00 AM' }, []),
  el('ui-timeline-item', { status: 'active', label: 'Shipped', timestamp: 'Apr 17, 11:45 AM' }, [
    el('span', { 'data-role': 'detail' }, [document.createTextNode('Carrier: UPS · Tracking 1Z999AA10123456784')]),
  ]),
  el('ui-timeline-item', { status: 'pending', label: 'Delivered', timestamp: 'Expected Apr 20' }, []),
])

composeDocPage(content, descriptor, body, exampleSection('Order-tracking chronology', orderTracking))
