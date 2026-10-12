// factories.ts: the `croupier` persona's factory table (SPEC-R1, GH #497; ADR-0225 retarget, GH #1478;
// ADR-0243 CardTable). Two types: the leaf `PlayingCard` and the `CardTable` composite.
//
// `PlayingCard` closes the unconstrained rank/suit string the `card-layout` mini-skill used to teach as prose
// into a real, enum-constrained catalog row (a malformed card is a `CATALOG` validation failure, not a silent
// formatting defect). `rank`/`suit`/`faceDown`/`size` are four ordinary top-level bindable props, each resolved
// independently by the renderer's per-prop bind-effect (widget.ts). ADR-0225 retarget: the factory is a direct
// pass-through onto the fleet component `ui-playing-card`, which owns all rank/suit/faceDown derivation.
//
// `CardTable` (ADR-0243 "Persona composites") is a composite over `ui-card`, `ui-badge`, `ui-text` and
// `ui-playing-card`, the concierge `BookingForm` shape (a WeakMap of parts, an `applyProp` switch). The two
// hands are whole-array bindable props (`/dealerHand`, `/playerHand`); the factory reuses the i-th card for
// item i, so a draw appends one element and a hole card turned up flips the same element (ADR-0225 cl.6). The
// action Buttons are the producer's own children, appended by the renderer after the readout, and sized at the
// button's `lg` step by `largeActionButtons` (ADR-0243 Amendment 2). The hands deal at the card's `md` size.
// Styling is inline (`el.style`): the a2ui package ships no CSS file.
//
// `targetCatalogs` (both shipped bases): both factories build directly against `@agent-ui/components`, never
// through either base's own dialect, the same reasoning as `concierge/index.ts`.

import type { WidgetFactory } from '../../types.ts'
import { largeActionButtons } from '../action-row.ts'

export const playingCardFactory: WidgetFactory = {
  tag: 'ui-playing-card',
  create: () => document.createElement('ui-playing-card'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'rank':
        ;(el as unknown as { rank: string }).rank = value == null ? '' : String(value)
        break
      case 'suit':
        ;(el as unknown as { suit: string }).suit = value == null ? '' : String(value)
        break
      case 'faceDown':
        ;(el as unknown as { faceDown: boolean }).faceDown = Boolean(value)
        break
      case 'size':
        ;(el as unknown as { size: string }).size = value == null ? 'md' : String(value)
        break
    }
  },
}

// CardTable

type Participant = 'dealer' | 'player'

interface ZoneParts {
  total: HTMLElement
  felt: HTMLElement
}

interface CardTableParts {
  titleEl: HTMLElement
  statusEl: HTMLElement
  zones: Record<Participant, ZoneParts>
  readoutEl: HTMLElement
  readoutText: HTMLElement
  status: string
  bankroll: number | undefined
  bet: number | undefined
}

const cardTableParts = new WeakMap<HTMLElement, CardTableParts>()

type TextProps = { as: string; variant: string; size: string }

function text(variant: string, size: string, content = ''): HTMLElement {
  const el = document.createElement('ui-text')
  const t = el as unknown as TextProps
  t.as = 'none'
  t.variant = variant
  t.size = size
  el.textContent = content
  return el
}

function row(part: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-part', part)
  el.style.display = 'flex'
  el.style.justifyContent = 'space-between'
  el.style.alignItems = 'center'
  return el
}

/** One participant's zone: a label row (name, total) above the felt that holds the cards. */
function zone(participant: Participant, name: string): { el: HTMLElement; parts: ZoneParts } {
  const el = document.createElement('div')
  el.setAttribute('data-part', 'zone')
  el.setAttribute('data-zone', participant)
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = 'var(--md-sys-space-sm)'
  el.style.flex = '1 0 100%'
  const label = row('zone-label')
  const total = text('label', 'md')
  total.setAttribute('data-part', 'total')
  label.append(text('title', 'sm', name), total)
  const felt = document.createElement('div')
  felt.setAttribute('data-part', 'felt')
  const f = felt.style
  f.background = 'var(--md-sys-color-success-container-low)'
  f.padding = 'var(--md-sys-space-md)'
  f.gap = 'var(--md-sys-space-sm)'
  f.borderRadius = 'var(--md-sys-shape-corner-base, 12px)'
  f.display = 'flex'
  f.flexWrap = 'wrap'
  f.alignItems = 'center'
  f.minBlockSize = '96px'
  el.append(label, felt)
  return { el, parts: { total, felt } }
}

/** A list item's card: rank and suit as strings, face down only when `faceDown` is exactly true. */
function readCard(item: unknown): { rank: string; suit: string; faceDown: boolean } {
  const rec = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
  return { rank: String(rec['rank'] ?? ''), suit: String(rec['suit'] ?? ''), faceDown: rec['faceDown'] === true }
}

/** Reconcile the felt to `list`: reuse the i-th card for item i, append or remove only the difference. */
function renderHand(felt: HTMLElement, list: unknown): void {
  const items = Array.isArray(list) ? list : []
  const cards = [...felt.children] as HTMLElement[]
  for (let i = items.length; i < cards.length; i++) cards[i]!.remove()
  items.forEach((item, i) => {
    let el = cards[i]
    if (el === undefined) {
      el = document.createElement('ui-playing-card')
      ;(el as unknown as { size: string }).size = 'md'
      felt.appendChild(el)
    }
    const card = readCard(item)
    const c = el as unknown as { rank: string; suit: string; faceDown: boolean }
    c.rank = card.rank
    c.suit = card.suit
    c.faceDown = card.faceDown
  })
}

/** A number n reads `Total n`, a string reads as given, anything else is empty. */
function totalText(value: unknown): string {
  if (typeof value === 'number') return `Total ${value}`
  return typeof value === 'string' ? value : ''
}

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function renderReadout(parts: CardTableParts): void {
  const halves: string[] = []
  if (parts.bankroll !== undefined) halves.push(`Bankroll ${parts.bankroll.toLocaleString('en-US')}`)
  if (parts.bet !== undefined) halves.push(`Bet ${parts.bet.toLocaleString('en-US')}`)
  parts.readoutText.textContent = halves.join(' \u00b7 ')
  parts.readoutEl.style.display = halves.length === 0 ? 'none' : ''
}

export const cardTableFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-badge', 'ui-playing-card', 'ui-text'], // ADR-0233: the parts it mints
  create: () => {
    const el = document.createElement('ui-card')
    const s = el.style
    s.display = 'flex'
    s.flexWrap = 'wrap'
    s.alignItems = 'center'
    s.gap = 'var(--md-sys-space-md)'

    const head = row('head')
    head.style.flex = '1 0 100%'
    const titleEl = document.createElement('ui-text')
    const t = titleEl as unknown as TextProps
    t.as = 'h4'
    t.variant = 'title'
    t.size = 'md'
    titleEl.setAttribute('data-part', 'title')
    const statusEl = document.createElement('ui-badge')
    statusEl.setAttribute('data-part', 'status')
    statusEl.style.display = 'none'
    head.append(titleEl, statusEl)

    const dealer = zone('dealer', 'Dealer')
    const player = zone('player', 'You')

    const readoutEl = document.createElement('div')
    readoutEl.setAttribute('data-part', 'readout')
    readoutEl.style.flex = '1 1 auto'
    readoutEl.style.display = 'none'
    const readoutText = text('body', 'md')
    readoutEl.appendChild(readoutText)

    el.append(head, dealer.el, player.el, readoutEl)
    largeActionButtons(el)
    cardTableParts.set(el, {
      titleEl,
      statusEl,
      zones: { dealer: dealer.parts, player: player.parts },
      readoutEl,
      readoutText,
      status: '',
      bankroll: undefined,
      bet: undefined,
    })
    return el
  },
  applyProp: (el, prop, value) => {
    const parts = cardTableParts.get(el)
    if (parts === undefined) return
    switch (prop) {
      case 'title':
        parts.titleEl.textContent = value == null ? '' : String(value)
        break
      case 'status':
        parts.status = value == null ? '' : String(value)
        ;(parts.statusEl as unknown as { label: string }).label = parts.status
        parts.statusEl.style.display = parts.status === '' ? 'none' : ''
        break
      case 'statusIntent':
        ;(parts.statusEl as unknown as { intent: string }).intent = value == null ? 'neutral' : String(value)
        break
      case 'dealerHand':
        renderHand(parts.zones.dealer.felt, value)
        break
      case 'playerHand':
        renderHand(parts.zones.player.felt, value)
        break
      case 'dealerTotal':
        parts.zones.dealer.total.textContent = totalText(value)
        break
      case 'playerTotal':
        parts.zones.player.total.textContent = totalText(value)
        break
      case 'bankroll':
        parts.bankroll = finite(value)
        renderReadout(parts)
        break
      case 'bet':
        parts.bet = finite(value)
        renderReadout(parts)
        break
    }
  },
}

/** Every component the fragment's `catalog.json` declares MUST appear here (the FACTORY_MISSING
 *  precondition, mirroring `fixture-demo/factories.ts`). */
export const croupierFactories: Record<string, WidgetFactory> = {
  PlayingCard: playingCardFactory,
  CardTable: cardTableFactory,
}
