// site/pages/tabs-demo.ts — the ui-tabs interaction demo (the ratified container `demo`). Mounts the REAL tabs
// compound and proves its interaction honestly: a live `select` event log (the one commit event, fired on a
// USER gesture, carrying { value, index }) shows selection round-tripping; the instructions cover the roving
// keyboard. The control owns all ARIA/roving/selection (tabs.ts) — this page only stages it and logs the event.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-tabs — demo',
  intro: 'The tabs compound, live. Click a tab or use the keyboard; the select event log proves the selection ' +
    'round-trips. The API table is on the ui-tabs API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the live tabs (real compound — three tabs + three panels, the first selected by default) ────────────────
const tabs = el('ui-tabs', { selected: 'overview' }, [
  el('ui-tab', { value: 'overview' }, [text('Overview')]),
  el('ui-tab', { value: 'pricing' }, [text('Pricing')]),
  el('ui-tab', { value: 'support' }, [text('Support')]),
  el('ui-tab-panel', {}, [text('Overview panel — the product at a glance.')]),
  el('ui-tab-panel', {}, [text('Pricing panel — plans and tiers.')]),
  el('ui-tab-panel', {}, [text('Support panel — docs and contact.')]),
])

// ── the select event log — the one commit event (USER gesture only; a programmatic `selected` write is silent) ─
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
tabs.addEventListener('select', (event) => {
  const detail = (event as CustomEvent<{ value: string; index: number }>).detail
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  select  value=${JSON.stringify(detail.value)}  index=${detail.index}`
  log.append(line)
  log.scrollTop = log.scrollHeight
})

const keyboard = document.createElement('p')
keyboard.innerHTML =
  'The strip uses a <strong>roving tabindex</strong>: Tab enters the whole strip as one stop. Within it, ' +
  '<strong>ArrowLeft / ArrowRight</strong> move selection + focus (wrapping), and <strong>Home / End</strong> ' +
  'jump to the first / last tab — selection follows focus (APG automatic activation). Only a user gesture emits ' +
  '<code>select</code>; a programmatic <code>selected</code> write applies silently (binding hygiene).'

content.append(
  exampleSection('Live tabs', tabs),
  exampleSection('Keyboard & roving focus', keyboard),
  exampleSection('select event log', log),
)
