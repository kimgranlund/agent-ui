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
// button's `lg` step by `actionRowButtons` (ADR-0243 Amendment 2; 32px on the A2UI canvas register, ADR-0245 Amendment 2).
// The hands deal at the card's `md` size.
// Styling is inline (`el.style`): the a2ui package ships no CSS file. The spacing is the ADR-0046 box model
// (`boxRegionCard`, ADR-0046 Amendment 7): the head, each zone and the readout row sit one region apart, the
// region-to-region distance of a stock card (block padding, box inset, block padding), and a zone's label and
// felt, and the readout and the Buttons, keep the 8px region gap.
//
// The hand lifecycle (ADR-0243 Amendment 3, T-0088): `phase` is `betting`, `playing` (the default, so a payload
// without it renders as before) or `settled`. `betting` empties the felt and shows the bet strip (Kim's ruling,
// T-0172): one `lg` button per amount of the fixed set Kim ruled, 25 / 50 / 75 / 100 / 250 (no wire prop, so a
// model cannot supply its own amounts), an amount above the bankroll disabled. A press places that bet and starts the hand in one step: it writes the bet (a bubbling `change` the
// input binding reads through `a2uiCardTableBet`), then fires the host's own `action` event with
// `{action: betAction, context: {bet}}`, which the renderer forwards as the A2UI action (`betAction` is the
// catalog's `actionEvent: 'action'` prop, the BoardGrid precedent). The table owns the whole bet phase, so a
// producer adds no Slider, field or Deal Button for it (the `croupier-bet-controls` check). Leaving `betting`
// hides the strip. `settled` shows the `result` line above the readout.
//
// `targetCatalogs` (both shipped bases): both factories build directly against `@agent-ui/components`, never
// through either base's own dialect, the same reasoning as `concierge/index.ts`.

import type { WidgetFactory } from '../../types.ts'
import { actionRowButtons } from '../action-row.ts'
import { BOX, boxRegionCard } from '../box-region.ts'

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

type Phase = 'betting' | 'playing' | 'settled'

const PHASES: readonly Phase[] = ['betting', 'playing', 'settled']
/** Kim's ruling (T-0172): the bet strip's amounts, fixed. */
const BET_AMOUNTS: readonly number[] = [25, 50, 75, 100, 250]

interface ZoneParts {
  total: HTMLElement
  felt: HTMLElement
}

// Structural duck-types over the minted controls' public props (the fleet's generic-cast convention).
interface ButtonLike extends HTMLElement {
  variant: string
  size: string
  disabled: boolean
  inline: boolean
}

interface CardTableParts {
  titleEl: HTMLElement
  statusEl: HTMLElement
  zones: Record<Participant, ZoneParts>
  resultEl: HTMLElement
  resultText: HTMLElement
  betEl: HTMLElement
  readoutEl: HTMLElement
  readoutText: HTMLElement
  status: string
  statusIntent: string
  bankroll: number | undefined
  bet: number | undefined
  phase: Phase
  /** The action name a bet press fires (`betAction`); none set, a press only writes the bet. */
  betAction: string
  result: string
  /** A bet press: place `amount` and start the hand. */
  onBet: (amount: number) => void
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
  el.style.gap = BOX.gap
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

/** A full-width flex row of the card's own parts (the result line, the bet row). */
function band(part: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-part', part)
  const s = el.style
  s.display = 'none'
  s.flex = '1 0 100%'
  s.flexWrap = 'wrap'
  s.alignItems = 'center'
  s.gap = BOX.gap
  return el
}

function button(variant: string, label: string): ButtonLike {
  const el = document.createElement('ui-button') as ButtonLike
  el.variant = variant
  el.size = 'lg' // minted before `actionRowButtons` observes, so sized here (ADR-0243 Amendment 2)
  el.inline = true // hug its label in the bet row (ADR-0223's one opt-out), never fill it
  el.textContent = label
  return el
}

/** Build the bet strip: one button per fixed amount. */
function renderBets(parts: CardTableParts): void {
  parts.betEl.replaceChildren(
    ...BET_AMOUNTS.map((amount) => {
      const bet = button('soft', amount.toLocaleString('en-US'))
      bet.setAttribute('data-part', 'bet-option')
      bet.setAttribute('data-amount', String(amount))
      bet.addEventListener('click', () => {
        if (!bet.disabled) parts.onBet(amount)
      })
      return bet
    }),
  )
  paintBets(parts)
}

/** An amount above the bankroll cannot be bet (every amount is open while the bankroll is unknown). */
function paintBets(parts: CardTableParts): void {
  for (const option of parts.betEl.children) {
    const amount = Number((option as HTMLElement).getAttribute('data-amount'))
    ;(option as ButtonLike).disabled = parts.bankroll !== undefined && amount > parts.bankroll
  }
}

/** Betting empties the felt (cards and totals hidden, the data untouched) and folds the two empty zones away, so
 *  the table reads as its bet strip (T-0172: the tall empty felt was a defect); the other phases show them. */
function paintZones(parts: CardTableParts): void {
  const hide = parts.phase === 'betting' ? 'none' : ''
  for (const z of Object.values(parts.zones)) {
    if (z.felt.parentElement !== null) z.felt.parentElement.style.display = hide
    z.total.style.display = hide
    for (const card of z.felt.children) (card as HTMLElement).style.display = hide
  }
}

/** The result line: `settled` only, tinted by `statusIntent` (the words carry the result, never the tint alone). */
function paintResult(parts: CardTableParts): void {
  parts.resultText.textContent = parts.result
  const intent = ['info', 'success', 'warning', 'danger'].includes(parts.statusIntent) ? parts.statusIntent : 'neutral'
  parts.resultEl.style.background = `var(--md-sys-color-${intent}-container-low)`
  parts.resultEl.style.display = parts.phase === 'settled' && parts.result !== '' ? 'flex' : 'none'
}

function paintPhase(parts: CardTableParts): void {
  parts.betEl.style.display = parts.phase === 'betting' ? 'flex' : 'none'
  paintZones(parts)
  paintResult(parts)
}

export const cardTableFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-badge', 'ui-button', 'ui-playing-card', 'ui-text'], // ADR-0233: the parts it mints
  create: () => {
    const el = document.createElement('ui-card')
    const s = el.style
    s.display = 'flex'
    s.flexWrap = 'wrap'
    s.alignItems = 'center'
    boxRegionCard(el)
    s.rowGap = `calc(${BOX.inset} + 2 * ${BOX.padBlock})` // region to region: 6 + 6 + 6
    s.columnGap = BOX.gap

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

    // The settled result line (hidden until `settled` with a `result`).
    const resultEl = band('result')
    const r = resultEl.style
    r.boxSizing = 'border-box' // padded inside its 100% flex basis, never past the card's ink edge
    r.padding = 'var(--md-sys-space-sm) var(--md-sys-space-md)'
    r.borderRadius = 'calc(var(--md-sys-shape-corner-base, 12px) - 2px)'
    const resultText = text('title', 'sm')
    ;(resultText as unknown as { emphasis: boolean }).emphasis = true
    resultEl.appendChild(resultText)

    // The bet strip (hidden until `betting`): one button per amount.
    const betEl = band('bet')

    const readoutEl = document.createElement('div')
    readoutEl.setAttribute('data-part', 'readout')
    // T-0142: the Buttons wrap as one group, never one at a time. Below a 26rem card the readout takes the whole
    // line (basis (26rem - 100%) * 999 is huge), so the Buttons share the next one; above it the basis goes
    // negative, clamps to 0 and the readout grows beside them (the flex "albatross", no container query inline).
    readoutEl.style.flex = '1 1 calc((26rem - 100%) * 999)'
    readoutEl.style.display = 'none'
    const readoutText = text('body', 'md')
    readoutEl.appendChild(readoutText)

    el.append(head, dealer.el, player.el, resultEl, betEl, readoutEl)
    actionRowButtons(el)
    const parts: CardTableParts = {
      titleEl,
      statusEl,
      zones: { dealer: dealer.parts, player: player.parts },
      resultEl,
      resultText,
      betEl,
      readoutEl,
      readoutText,
      status: '',
      statusIntent: 'neutral',
      bankroll: undefined,
      bet: undefined,
      phase: 'playing',
      betAction: '',
      result: '',
      onBet: () => {},
    }
    cardTableParts.set(el, parts)

    // A bet press writes the bet (the `change` the input binding reads), then fires the host's own `action`
    // event, which the renderer forwards only when it is dispatched ON the host (never from the button).
    parts.onBet = (amount) => {
      parts.bet = amount
      renderReadout(parts)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      if (parts.betAction !== '') el.dispatchEvent(new CustomEvent('action', { detail: { action: parts.betAction, context: { bet: amount } } }))
    }
    renderBets(parts)
    // The live bet for `installInputBinding` (LLD-C8), read on the root's bubbling `change`.
    Object.defineProperty(el, 'a2uiCardTableBet', {
      configurable: true,
      get: () => parts.bet ?? null,
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
        parts.statusIntent = value == null ? 'neutral' : String(value)
        ;(parts.statusEl as unknown as { intent: string }).intent = parts.statusIntent
        paintResult(parts)
        break
      case 'dealerHand':
        renderHand(parts.zones.dealer.felt, value)
        paintZones(parts)
        break
      case 'playerHand':
        renderHand(parts.zones.player.felt, value)
        paintZones(parts)
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
        paintBets(parts)
        break
      case 'bet':
        parts.bet = finite(value)
        renderReadout(parts)
        break
      case 'phase':
        parts.phase = PHASES.find((p) => p === value) ?? 'playing'
        paintPhase(parts)
        break
      case 'betAction':
        parts.betAction = value == null ? '' : String(value)
        break
      case 'result':
        parts.result = value == null ? '' : String(value)
        paintResult(parts)
        break
    }
  },
  value: { prop: 'bet', event: 'change', readProp: 'a2uiCardTableBet' },
}

/** Every component the fragment's `catalog.json` declares MUST appear here (the FACTORY_MISSING
 *  precondition, mirroring `fixture-demo/factories.ts`). */
export const croupierFactories: Record<string, WidgetFactory> = {
  PlayingCard: playingCardFactory,
  CardTable: cardTableFactory,
}
