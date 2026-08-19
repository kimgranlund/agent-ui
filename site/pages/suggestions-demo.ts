// site/pages/suggestions-demo.ts — the ui-suggestions interaction demo (the ratified pattern `demo`,
// ADR-0213/GH #1393). Mounts a REAL live set and proves the one-shot spent-set law honestly: a chip click
// commits its value into `selected` and fires exactly one `select`, and from that instant the WHOLE set
// renders spent (every chip disabled, the taken one still visible + marked) — the toggle event log proves
// it never fires a second time for the same set. A second, pre-spent specimen shows the rest state at a
// glance. The control owns the one-shot mechanics (suggestions.ts); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-suggestions — demo',
  intro:
    'A live 3-chip suggestion set. Tap any chip — the CLICK path — to commit its value into `selected` and ' +
    'fire `select`. From that instant the WHOLE set renders spent: every chip goes inert (a real native ' +
    "`disabled`), and the taken chip stays visible and marked. It never fires a second time for the same " +
    'set. The API table is on the ui-suggestions API page.',
})

// ── the shared select event log ──────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(detail: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  select  →  ${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const SET = [
  { label: 'Book the Deluxe King' },
  { label: 'See more photos', value: 'more-photos' },
  { label: 'Compare rooms', value: 'compare' },
]

const live = el('ui-suggestions', { suggestions: JSON.stringify(SET) })
live.addEventListener('select', (event) => logEvent(String((event as CustomEvent<string>).detail)))

const spent = el('ui-suggestions', { suggestions: JSON.stringify(SET), selected: 'compare' })

const note = document.createElement('p')
note.textContent =
  'Every chip is a real native <button> in the normal tab order — Enter/Space activation is the ' +
  'platform\'s own button activation, no component-defined key binding.'

content.append(
  exampleSection('Click a chip to commit it', live, note),
  exampleSection('select event log', log),
  exampleSection('At rest — already spent', spent),
)
