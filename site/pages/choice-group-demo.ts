// site/pages/choice-group-demo.ts — the ui-choice-group interaction demo (ADR-0220, GH #1368). Mounts
// a REAL group over three rich ui-choice-card options and proves the interaction honestly: a live event
// log shows the committed selection round-tripping on a USER gesture (click, Enter, Space, or Arrow
// roving) — never on the initial paint. The group owns all roving/commit/value (choice-group.ts); this
// page only stages it and logs. A second, `multiple` group demonstrates the toggle mode.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el } from '../lib/specimens.ts'
import { heading } from '../lib/doc-page.ts'

const { content } = mountPage({
  title: 'ui-choice-group — demo',
  intro: 'The rich-card selection container, live. Click a card, or focus the group and use Arrow keys / Enter / ' +
    'Space; the event log proves the committed choice round-trips on a real user gesture. The API table is on ' +
    'the ui-choice-group API page.',
})

const text = (s: string): Text => document.createTextNode(s)

function roomCard(value: string, title: string, price: string, rating: string): HTMLElement {
  return el('ui-choice-card', { value }, [
    el('strong', {}, [text(title)]),
    document.createElement('br'),
    text(`${price} · ${rating}`),
  ])
}

function eventLog(): { log: HTMLUListElement; record: (kind: string, value: unknown) => void } {
  const log = document.createElement('ul')
  log.className = 'event-log'
  log.setAttribute('aria-live', 'polite')
  let seq = 0
  const record = (kind: string, value: unknown): void => {
    seq += 1
    const line = document.createElement('li')
    line.textContent = `#${String(seq).padStart(2, '0')}  ${kind}  value=${JSON.stringify(value)}`
    log.append(line)
    log.scrollTop = log.scrollHeight
  }
  return { log, record }
}

// ── single-select group (a room picker — exactly one committed choice) ───────────────────────────────

const singleSection = document.createElement('section')
singleSection.append(heading(2, 'Single-select — pick one room'))

const singleGroup = el('ui-choice-group', { name: 'room', required: '' }, [
  roomCard('standard', 'Standard', '$120/night', '★4.2'),
  roomCard('deluxe', 'Deluxe', '$185/night', '★4.8'),
  roomCard('suite', 'Suite', '$310/night', '★4.9'),
])

const singleLog = eventLog()
singleGroup.addEventListener('select', (event) => singleLog.record('select', (event as CustomEvent<string>).detail))

singleSection.append(
  singleGroup,
  el('p', {}, [text('Exactly one card is selected. Click, or focus the group and use Arrow/Home/End to rove, then Enter or Space to commit.')]),
  singleLog.log,
)

// ── multi-select group (amenities — toggle any number) ────────────────────────────────────────────────

const multiSection = document.createElement('section')
multiSection.append(heading(2, 'Multi-select — toggle any amenities'))

const multiGroup = el('ui-choice-group', { name: 'amenities', multiple: '', values: '["wifi"]' }, [
  el('ui-choice-card', { value: 'wifi' }, [text('Wi-Fi')]),
  el('ui-choice-card', { value: 'parking' }, [text('Parking')]),
  el('ui-choice-card', { value: 'breakfast' }, [text('Breakfast')]),
])

const multiLog = eventLog()
multiGroup.addEventListener('select', (event) => multiLog.record('select', [...(event as CustomEvent<ReadonlySet<string>>).detail]))

multiSection.append(
  multiGroup,
  el('p', {}, [text('Every commit path toggles the targeted card (no modifier keys, ever) — click, Enter, or Space.')]),
  multiLog.log,
)

content.append(singleSection, multiSection)
