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
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)]) // inline emphasis, built as DOM (no innerHTML)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the live tabs (real compound — three tabs + three panels, the first selected by default) ────────────────
// `ui-tabs` is transparent by default (ADR-0104) — this specimen asks for its plane explicitly, dogfooding the
// elevation/brightness intent lane rather than relying on the removed self-seeded surface.
const tabs = el('ui-tabs', { selected: 'overview', elevation: '0' }, [
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

const keyboard = el('p', {}, [
  text('The strip uses a '), strong('roving tabindex'),
  text(': Tab enters the whole strip as one stop. Within it, '), strong('ArrowLeft / ArrowRight'),
  text(' move selection + focus (wrapping), and '), strong('Home / End'),
  text(' jump to the first / last tab — selection follows focus (APG automatic activation). Only a user gesture emits '),
  code('select'), text('; a programmatic '), code('selected'), text(' write applies silently (binding hygiene).'),
])

content.append(
  exampleSection('Live tabs', tabs),
  exampleSection('Keyboard & roving focus', keyboard),
  exampleSection('select event log', log),
)
