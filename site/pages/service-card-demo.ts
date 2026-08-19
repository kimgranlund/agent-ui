// site/pages/service-card-demo.ts — the ui-service-card interaction demo (ADR-0224, GH #1429). Mounts a real
// gateway-style service list (the intake's own reference habitat) — each card composes a `[slot="menu"]`
// overflow affordance (ui-button + ui-menu, app chrome the card never fabricates itself) — plus a live
// availability-toggle scenario that flips ONE card's `available` boolean at runtime and shows the four
// coordinated consequences (accent edge, status dot, title mute, action swap) repaint together from that ONE
// write. A live `action` event log proves the Open button's activation contract: it fires while available,
// and never while unavailable (a real disabled native <button> cannot dispatch click at all). The control owns
// every mechanic (service-card.ts); this page only stages, toggles, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import type { UIServiceCardElement } from '@agent-ui/components/components'
import { specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-service-card — demo',
  intro:
    'The availability-stated launch card, live, in a gateway-style service list. Toggle a service to see the ' +
    'accent edge, status dot, title, and trailing action repaint together from ONE `available` write; click ' +
    '"Open" to see the `action` event log. The API table is on the ui-service-card API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the shared event log — the ONE closed-set event this card emits (ADR-0153's seventh member) ───────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function record(source: string, kind: string, detail: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  →  ${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

/** overflowMenu — the consumer-composed `[slot="menu"]` affordance (ui-button + ui-menu, app chrome; the card
 *  never fabricates a menu it cannot populate, ADR-0224 cl.3). Stays live regardless of `available` — the
 *  service state is data, never a control disablement. */
function overflowMenu(cardName: string): HTMLElement {
  const trigger = uiButton('', 'ghost')
  trigger.toggleAttribute('icon-only', true)
  trigger.setAttribute('aria-label', `More actions for ${cardName}`)
  const dots = document.createElement('ui-icon')
  dots.setAttribute('slot', 'leading')
  dots.setAttribute('glyph', 'dots-three')
  trigger.append(dots)

  const menu = el('ui-menu', { slot: 'menu' }, [
    trigger, // first child = trigger (ui-menu's positional child-move, the menu-demo.ts precedent)
    el('div', { 'data-value': 'inspect' }, [text('Inspect')]),
    el('div', { 'data-value': 'configure' }, [text('Configure')]),
    el('div', { 'data-value': 'restart' }, [text('Restart')]),
  ])
  menu.addEventListener('select', (event) => {
    const detail = (event as CustomEvent<{ value: string; index: number }>).detail
    record(cardName, 'menu select', `value=${JSON.stringify(detail.value)}`)
  })
  return menu
}

/** serviceCard — a real <ui-service-card>, its `action` activation logged. */
function serviceCard(name: string, path: string, description: string, available: boolean): UIServiceCardElement {
  const attrs: Record<string, string> = { name, path, description }
  if (available) attrs['available'] = ''
  const c = el('ui-service-card', attrs, [overflowMenu(name)]) as UIServiceCardElement
  c.addEventListener('action', () => record(name, 'action', `${name} opened`))
  applyDemoWidth(c, '26rem') // block-level fill by default (ADR-0223/ADR-0224 cl.5) — a display width for the list read
  return c
}

// ── the gateway list — a believable Claude Code Gateway view (ADR-0224's own reference habitat) ───────────────
const claims = serviceCard('Claims Agent', '/claims-agent-service', 'Handles first-notice-of-loss intake and triage.', true)
claims.id = 'service-card-claims' // the page-level browser test's stable hook (service-card-demo.browser.test.ts)
const billing = serviceCard('Billing Agent', '/billing-agent-service', 'Reconciles invoices against the ledger.', true)
const notifications = serviceCard('Notifications Service', '/notifications-service', 'Fans out delivery events to subscribers.', false)
notifications.id = 'service-card-notifications' // the SAME stable hook — a reference already-unavailable specimen

const list = el('ui-column', { gap: 'sm' }, [claims, billing, notifications])

const listNote = el('p', {}, [
  text('Each card carries a real overflow menu ('), code('[slot="menu"]'), text(') that stays fully '),
  strong('live'), text(' regardless of availability — unavailable is a service state, never a control ' +
    'disablement, so you can still inspect or configure a down service.'),
])

// ── the availability-toggle scenario — ONE property write flips four coordinated consequences ─────────────────
const toggleTarget = serviceCard(
  'Search Index',
  '/search-index-service',
  'Serves full-text lookups over the document store.',
  true,
)
toggleTarget.id = 'service-card-toggle-target' // the page-level browser test's stable hook

const toggle = uiButton('Take Search Index offline', 'solid')
toggle.id = 'service-card-toggle-button'
function paintToggle(): void {
  const isAvailable = toggleTarget.available
  toggle.textContent = isAvailable ? 'Take Search Index offline' : 'Bring Search Index back online'
}
toggle.addEventListener('click', () => {
  const next = !toggleTarget.available
  toggleTarget.available = next // the property write — ADR-0224 cl.4: accent edge, dot, title mute, and the
  // Open⟷Unavailable action swap all repaint from this ONE assignment, no coordinated follow-up writes.
  paintToggle()
  record('Search Index', 'available ←', String(next))
})
paintToggle()

const toggleNote = el('p', {}, [
  text('Click the button to flip '), code('available'), text(' on the '), strong('Search Index'), text(' card. ' +
    'Watch the accent edge, status dot, title mute, and the trailing action swap ('), code('→ Open'),
  text(' ⟷ the disabled '), code('Unavailable'), text(' chip) all repaint together — from the ONE write, never ' +
    'four independent edits. The '), code('menu'), text(' slot and the host itself stay live throughout.'),
])

const toggleSection = el('ui-row', { gap: 'lg', align: 'start', wrap: '' }, [toggleTarget])

// ── states — the `inline` sizing opt-out + the empty path/description valueless-row law ────────────────────────
const inlineCard = serviceCard('Router', '/router-service', 'Routes requests to the right upstream.', true)
inlineCard.setAttribute('inline', '')

const minimalCard = el('ui-service-card', { name: 'Sandbox', available: '' }, [overflowMenu('Sandbox')]) as UIServiceCardElement
applyDemoWidth(minimalCard, '18rem')

const states = specimenRow([
  captioned('inline (shrink-to-fit)', inlineCard),
  captioned('empty path/description — no box (ADR-0201 valueless-row law)', minimalCard),
])

content.append(
  exampleSection('Live gateway list', list, listNote),
  exampleSection('Availability toggle — one write, four coordinated repaints', toggleSection, toggle, toggleNote),
  exampleSection('States', states),
  exampleSection('action / select event log', log),
)
