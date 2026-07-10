// site/pages/timeline-demo.ts — the ui-timeline interaction demo (ADR-0122). ui-timeline itself is STATIC
// (no imperative API — SPEC-R6 AC3) — the "live" story here is PAGE-level: appending a new AUTHORED
// ui-timeline-item child (the same shape any app would use to grow a durable chronology over time) proves
// the terminal-connector re-marking (data-last moves to the new last child) and DOM-order read-back. The
// control owns the mechanics (timeline.ts's MutationObserver); this page only stages + appends.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-timeline — demo',
  intro:
    'A durable order-tracking chronology, live. ui-timeline itself is static — its items are AUTHORED ' +
    'light-DOM children, read back in DOM order. The button below appends a new authored step (the shape ' +
    'a real app uses to grow a chronology over time) — watch the terminal connector move to the new last ' +
    'entry. The API table is on the ui-timeline API page.',
})

const timeline = el('ui-timeline', { label: 'Order status', size: 'md' }, [
  el('ui-timeline-item', { status: 'done', label: 'Order placed', timestamp: 'Apr 15, 2:30 PM' }, []),
  el('ui-timeline-item', { status: 'done', label: 'Processing', timestamp: 'Apr 16, 9:00 AM' }, []),
  el('ui-timeline-item', { status: 'active', label: 'Shipped', timestamp: 'Apr 17, 11:45 AM' }, []),
])

const STEPS = [
  { status: 'done', label: 'Out for delivery', timestamp: 'Apr 20, 8:00 AM' },
  { status: 'pending', label: 'Delivered', timestamp: 'Expected Apr 20' },
] as const
let stepIdx = 0

const addStep = uiButton('Append the next step', 'soft')
addStep.addEventListener('click', () => {
  if (stepIdx >= STEPS.length) return
  const step = STEPS[stepIdx]!
  stepIdx += 1
  timeline.append(el('ui-timeline-item', { status: step.status, label: step.label, timestamp: step.timestamp }, []))
  if (stepIdx >= STEPS.length) addStep.setAttribute('disabled', '')
})

content.append(exampleSection('Order-tracking chronology (append a step)', timeline, addStep))
