// site/pages/swiper-label-demo.ts — the ui-swiper-label demo (tier=display; pairs with swiper-label-doc.ts,
// the API page). Mounts the REAL anchor inside REAL ui-swipers in a believable product situation — a storefront
// home with two named carousels ("New arrivals", "Back in stock") and one deliberately UNLABELLED carousel, so
// the accessible-name contract is visible side by side: with an anchor the owning swiper assigns the label an
// `id` and points its region `aria-labelledby` at it; without one the region falls back to "Carousel". A
// MODEL-DRIVEN rename edits the anchor's light-DOM text in place (the anchor IS the name — no re-render, no
// own ARIA), and a name probe reads the live wiring back. ui-swiper-label emits nothing of its own; the swiper's
// `select` events are logged to show the anchor never interferes with the carousel it names.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, demoBox, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-swiper-label — demo',
  intro:
    'A storefront home with named carousels, live: two ui-swipers whose ui-swiper-label anchors become their ' +
    'accessible names, one unlabelled swiper falling back to "Carousel", and a model-driven rename that edits ' +
    'the anchor\'s text in place — the anchor IS the name. Drag a track or click a paddle; the select log shows ' +
    'the label never interferes with the carousel it names. The API table is on the ui-swiper-label API page.',
})

// ── the select event log (the OWNING swiper's event, not the label's — the label emits nothing) ─────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logSelect(name: string, detail: unknown): void {
  seq += 1
  const d = detail as { value: string; index: number }
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  select  →  carousel="${name}"  index=${String(d.index)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

function shelf(labelText: string | null, items: readonly string[]): { swiper: HTMLElement; label: HTMLElement | null } {
  const label = labelText === null ? null : el('ui-swiper-label', {}, [document.createTextNode(labelText)])
  const swiper = el('ui-swiper', { paddles: '', pagination: '' }, [
    ...(label ? [label] : []),
    ...items.map((name) => el('ui-swiper-item', { key: name }, [demoBox(name)])),
  ])
  swiper.addEventListener('select', (e) => logSelect(label?.textContent ?? 'Carousel (fallback)', (e as CustomEvent).detail))
  return { swiper, label }
}

const arrivals = shelf('New arrivals', ['Linen shirt', 'Canvas tote', 'Wool beanie', 'Trail runner', 'Rain shell'])
const restock = shelf('Back in stock', ['Enamel mug', 'Field notebook', 'Merino socks', 'Desk lamp'])
const unlabelled = shelf(null, ['Gift card €25', 'Gift card €50', 'Gift card €100'])

// ── the name probe — reads the LIVE wiring back (the label's assigned id + the region's fallback) ───────────
const probe = el('p', { 'aria-live': 'polite', style: 'font-family: var(--ui-font-mono, ui-monospace, monospace); font-size: 0.85em; white-space: pre-wrap;' })
function readNames(): void {
  const rows = [arrivals, restock, unlabelled].map(({ label }, i) =>
    label
      ? `swiper #${String(i + 1)}: <ui-swiper-label id="${label.id || '(unassigned)'}"> "${label.textContent ?? ''}"  → region aria-labelledby → this anchor`
      : `swiper #${String(i + 1)}: no anchor  → region aria-label="Carousel" (fallback)`,
  )
  probe.textContent = rows.join('\n')
}

// ── model-driven rename — edit the anchor's text in place ──────────────────────────────────────────────────
const NAMES = ['New arrivals', 'New this week', 'Just dropped'] as const
let nameIndex = 0
const renameButton = uiButton('Rename the first carousel', 'solid')
renameButton.addEventListener('click', () => {
  nameIndex = (nameIndex + 1) % NAMES.length
  arrivals.label!.textContent = NAMES[nameIndex]!
  requestAnimationFrame(readNames)
})
const renameNote = el('p', {}, [
  document.createTextNode('The anchor\'s light-DOM text IS the carousel\'s accessible name — the swiper points its region '),
  el('code', {}, [document.createTextNode('aria-labelledby')]),
  document.createTextNode(' at the anchor (assigning it an '),
  el('code', {}, [document.createTextNode('id')]),
  document.createTextNode(' if it has none), so a text edit renames the carousel with no re-render and no ARIA of the anchor\'s own — the referenced element is read live by AT. Absent an anchor, the region is named "Carousel".'),
])

requestAnimationFrame(readNames)

content.append(
  exampleSection('Named carousels', el('div', { style: 'display:grid; gap:1.5rem;' }, [arrivals.swiper, restock.swiper])),
  exampleSection('Unlabelled — the "Carousel" fallback', unlabelled.swiper),
  exampleSection('Model-driven rename + name probe', renameButton, probe, renameNote),
  exampleSection('select event log (the owning swiper\'s)', log),
)
