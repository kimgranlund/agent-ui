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
// without it renders as before) or `settled`. `betting` empties the felt and shows the bet row: chip buttons
// (`chips`, default 10/25/50/100) that add to the bet and stop at the bankroll, a `ui-text-field type=number`
// stepper (min 1, max the bankroll, step 5) and a Clear button, all at the button's `lg` step. `bet` is two-way
// (the QuestionCard shape): a chip, Clear or a stepper commit sends a bubbling `change` the input binding reads
// through `a2uiCardTableBet`. The first producer Button (Deal) is disabled by the factory while the bet is
// outside 1 to bankroll: the default base has no range check a Button `checks` entry could name. `settled`
// shows the `result` line above the readout.
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
const DEFAULT_CHIPS: readonly number[] = [10, 25, 50, 100]

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

interface StakeFieldLike extends HTMLElement {
  type: string
  size: string
  label: string
  placeholder: string
  value: string
  min: string
  max: string
  step: number
}

interface CardTableParts {
  titleEl: HTMLElement
  statusEl: HTMLElement
  zones: Record<Participant, ZoneParts>
  resultEl: HTMLElement
  resultText: HTMLElement
  betEl: HTMLElement
  chipsEl: HTMLElement
  stakeEl: StakeFieldLike
  readoutEl: HTMLElement
  readoutText: HTMLElement
  status: string
  statusIntent: string
  bankroll: number | undefined
  bet: number | undefined
  phase: Phase
  chips: readonly number[]
  result: string
  /** The producer Button the bet gate disabled, and its own `disabled` before, restored when the gate lifts. */
  gated: { button: ButtonLike; prev: boolean } | null
  /** A chip press: add `amount` to the bet. */
  onChip: (amount: number) => void
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

/** Rebuild the chip buttons from `parts.chips`: one `+n` soft button per chip. */
function renderChips(parts: CardTableParts): void {
  parts.chipsEl.replaceChildren(
    ...parts.chips.map((amount) => {
      const chip = button('soft', `+${amount.toLocaleString('en-US')}`)
      chip.setAttribute('data-part', 'chip')
      chip.setAttribute('data-amount', String(amount))
      chip.addEventListener('click', () => {
        if (!chip.disabled) parts.onChip(amount)
      })
      return chip
    }),
  )
  paintBet(parts)
}

/** A bet clamped to 0 to the bankroll (no cap while the bankroll is unknown). */
function clampBet(parts: CardTableParts, n: number): number {
  const capped = parts.bankroll === undefined ? n : Math.min(n, parts.bankroll)
  return Math.max(0, capped)
}

/** Deal takes a bet of at least 1 and at most the bankroll. */
const betInRange = (parts: CardTableParts): boolean =>
  parts.bet !== undefined && parts.bet >= 1 && (parts.bankroll === undefined || parts.bet <= parts.bankroll)

/** The stepper's value, max and the chips' disabled state follow the bet and the bankroll. */
function paintBet(parts: CardTableParts): void {
  const stake = parts.stakeEl
  stake.max = parts.bankroll === undefined ? '' : String(parts.bankroll)
  const shown = parts.bet === undefined || parts.bet === 0 ? '' : String(parts.bet)
  if (stake.value !== shown) stake.value = shown
  const full = parts.bankroll !== undefined && (parts.bet ?? 0) >= parts.bankroll
  for (const chip of parts.chipsEl.children) (chip as ButtonLike).disabled = full
}

/** In `betting`, disable the first producer Button (Deal) while the bet is out of range; restore it otherwise. */
function gateDeal(el: HTMLElement, parts: CardTableParts): void {
  const first = el.querySelector<ButtonLike>(':scope > ui-button')
  const shut = parts.phase === 'betting' && first !== null && !betInRange(parts)
  const g = parts.gated
  if (g !== null && (g.button !== first || !shut)) {
    g.button.disabled = g.prev
    parts.gated = null
  }
  if (shut && parts.gated === null) {
    parts.gated = { button: first!, prev: first!.disabled }
    first!.disabled = true
  }
}

/** Betting empties the felt (cards and totals hidden, the data untouched); the other phases show them. */
function paintZones(parts: CardTableParts): void {
  const hide = parts.phase === 'betting' ? 'none' : ''
  for (const z of Object.values(parts.zones)) {
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

function paintPhase(el: HTMLElement, parts: CardTableParts): void {
  parts.betEl.style.display = parts.phase === 'betting' ? 'flex' : 'none'
  paintZones(parts)
  paintResult(parts)
  gateDeal(el, parts)
}

export const cardTableFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-badge', 'ui-button', 'ui-playing-card', 'ui-text', 'ui-text-field'], // ADR-0233: the parts it mints
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

    // The bet row (hidden until `betting`): the chips, the exact-amount stepper, Clear.
    const betEl = band('bet')
    const chipsEl = document.createElement('div')
    chipsEl.setAttribute('data-part', 'chips')
    chipsEl.style.display = 'flex'
    chipsEl.style.flexWrap = 'wrap'
    chipsEl.style.gap = BOX.gap
    chipsEl.style.flex = '1 0 100%' // the chips own the first line; the stepper and Clear share the second
    const stakeEl = document.createElement('ui-text-field') as StakeFieldLike
    stakeEl.setAttribute('data-part', 'stake')
    stakeEl.type = 'number'
    stakeEl.size = 'lg'
    stakeEl.label = 'Bet'
    stakeEl.placeholder = 'Bet'
    stakeEl.min = '1'
    stakeEl.step = 5
    stakeEl.style.flex = '1 1 8rem'
    const clearEl = button('ghost', 'Clear')
    clearEl.setAttribute('data-part', 'clear')
    betEl.append(chipsEl, stakeEl, clearEl)

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
      chipsEl,
      stakeEl,
      readoutEl,
      readoutText,
      status: '',
      statusIntent: 'neutral',
      bankroll: undefined,
      bet: undefined,
      phase: 'playing',
      chips: DEFAULT_CHIPS,
      result: '',
      gated: null,
      onChip: () => {},
    }
    cardTableParts.set(el, parts)

    /** Take a new bet from the table's own controls; `notify` sends the bubbling `change` the input binding reads. */
    const setBet = (n: number, notify: boolean): void => {
      parts.bet = clampBet(parts, n)
      renderReadout(parts)
      paintBet(parts)
      gateDeal(el, parts)
      if (notify) el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    parts.onChip = (amount) => setBet((parts.bet ?? 0) + amount, true)
    renderChips(parts)
    clearEl.addEventListener('click', () => setBet(0, true))
    // The stepper's own `change` (a commit or a step) bubbles to the root on its own; this listener runs first.
    stakeEl.addEventListener('change', () => {
      const n = Number(stakeEl.value)
      setBet(stakeEl.value.trim() === '' || !Number.isFinite(n) ? 0 : n, false)
    })
    // The live bet for `installInputBinding` (LLD-C8), read on the root's bubbling `change`.
    Object.defineProperty(el, 'a2uiCardTableBet', {
      configurable: true,
      get: () => parts.bet ?? null,
    })
    // The producer's Buttons land after `create()`: re-gate Deal whenever the root's children change.
    new MutationObserver(() => gateDeal(el, parts)).observe(el, { childList: true })
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
        paintBet(parts)
        gateDeal(el, parts)
        break
      case 'bet':
        parts.bet = finite(value)
        renderReadout(parts)
        paintBet(parts)
        gateDeal(el, parts)
        break
      case 'phase':
        parts.phase = PHASES.find((p) => p === value) ?? 'playing'
        paintPhase(el, parts)
        break
      case 'chips': {
        const list = Array.isArray(value) ? value.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0) : []
        parts.chips = list.length > 0 ? list : DEFAULT_CHIPS
        renderChips(parts)
        break
      }
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
