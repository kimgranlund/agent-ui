// site/pages/choice-card-demo.ts — the ui-choice-card interaction demo (ADR-0220, GH #1368). Mounts REAL
// FACE cards where they belong — inside a ui-choice-group (a plan picker: roving, commit, and the
// group's own `select` event are the group's) — plus a standalone shape (a lone card outside a group
// carries no interactive behaviour of its own, the `ui-tab` precedent). A live event log proves the real
// interaction surface. The controls own every mechanic (choice-card.ts / choice-group.ts); this page
// only stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-choice-card — demo',
  intro: 'The rich option unit, live, inside a real ui-choice-group — a plan picker. Click a card, or focus the ' +
    'group and use Arrow keys / Enter / Space; the group commits the choice and emits `select`. The API table ' +
    'is on the ui-choice-card API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared event log ───────────────────────────────────────────────────────────────────────────────────
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

// ── the plan-picker group: three cards, "pro" selected by default ────────────────────────────────────────
type Plan = { readonly value: string; readonly label: string; readonly price: string; readonly blurb: string }
const PLANS: readonly Plan[] = [
  { value: 'free', label: 'Free', price: '$0', blurb: 'For trying things out' },
  { value: 'pro', label: 'Pro', price: '$12/mo', blurb: 'For a single team' },
  { value: 'team', label: 'Team', price: '$29/mo', blurb: 'For growing orgs' },
]

function planCard(p: Plan): HTMLElement {
  return el('ui-choice-card', { value: p.value }, [
    el('strong', {}, [text(`${p.label} — ${p.price}`)]),
    document.createElement('br'),
    el('span', { style: 'font-size:0.85em; opacity:0.75;' }, [text(p.blurb)]),
  ])
}

const group = el('ui-choice-group', { name: 'plan', value: 'pro', 'aria-label': 'Plan' }, PLANS.map(planCard))
group.addEventListener('select', (event) => record('group', 'select', `value=${JSON.stringify((event as CustomEvent<string>).detail)}`))

const groupNote = el('p', {}, [
  text('Click a card, or focus the group and Arrow-rove, then Enter or Space to commit. Exclusivity, roving, ' +
    'and the form value are the group’s; each card owns only its own content + selected paint.'),
])

// ── the standalone shape: a lone card outside a group has no interaction of its own ─────────────────────────
const lone = el('ui-choice-card', { value: 'solo' }, [text('A standalone card')])
const loneNote = el('p', {}, [
  text('Outside an owning ui-choice-group a card has no roving/commit behaviour of its own — the ' +
    '“meaningless without a coordinator” posture ui-tab documents outside ui-tabs.'),
])

// ── states ──────────────────────────────────────────────────────────────────────────────────────────────────
const specimenRow = (...figures: HTMLElement[]): HTMLElement =>
  el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--md-sys-space-lg); align-items:flex-start;' }, figures)

function stateCard(value: string, label: string, selected: boolean, disabled: boolean): HTMLElement {
  const attrs: Record<string, string> = { value }
  if (disabled) attrs['disabled'] = ''
  const c = el('ui-choice-card', attrs, [text(label)])
  if (selected) (c as unknown as { setSelected(v: boolean): void }).setSelected(true)
  return c
}

const states = specimenRow(
  captioned('idle', stateCard('idle', 'Idle', false, false)),
  captioned('selected', stateCard('selected-demo', 'Selected', true, false)),
  captioned('disabled', stateCard('disabled-demo', 'Disabled', false, true)),
)

content.append(
  exampleSection('Plan picker (inside ui-choice-group)', group, groupNote),
  exampleSection('Standalone card', lone, loneNote),
  exampleSection('States', states),
  exampleSection('select event log', log),
)
