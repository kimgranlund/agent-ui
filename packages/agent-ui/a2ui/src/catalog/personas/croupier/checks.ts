// checks.ts: the `croupier` persona's semantic checks (ADR-0238; GH #1795). DOM-less and
// node-free: `manifest.ts` declares these, and both server hosts import that manifest.
//
// One check, `croupier-hand-consistency`, for the two participants a blackjack table names, `dealer` and
// `player`, on every surface the round touches (merged over prior turns, `semanticSurfaceViews`):
//
// - HAND_TOTAL: every number a total readout states must be a total of the cards that hand shows. Ranks:
//   A = 1 or 11 (one ace may count 11 while the hand stays at or under 21), J/Q/K = 10, the rest face value.
//   A face-down card may be counted or not ("Dealer shows 9" and the full hand both pass). A readout is the
//   data-model value at `/<p>Total` (or `/<p>/total`), or a component whose id is `<p>Total` (`-`/`_`
//   allowed, any case) reading its `text`, `label` or `value`. Every integer in a readout counts, which is
//   what the teaching asks for ("stating the total only"): "Dealer: 14, draws to 17" next to 6, 5, 3 fails on
//   the 17. Narration elsewhere (a result line) is never parsed.
// - HAND_COUNT: when the data model lists a hand (`/<p>Hand` or `/<p>/hand`, or any array of rank-bearing
//   cards under a path that names `<p>`, e.g. `/game/dealer/cards`), the hand container must render
//   exactly that many cards (recorded Haiku turn 2: a third dealer card in the data, no component). A Row templated over the list matches by construction; a static Row or
//   a template over a missing path does not.
// - NATURAL_ACTIONS (T-0020): a player hand of exactly two cards totalling 21 (an ace and a ten-value card)
//   is a natural, and a natural ends the round on the deal. The surface must then carry no Hit, Stand or
//   Double Button (matched by label or id, any case) and no face-down dealer card (the hole card is
//   revealed for settlement). One finding names both faults. A player hand the check cannot resolve is
//   never a natural; a dealer hand it cannot resolve is never judged for a hole card.
//
// - HAND_BINDING (ADR-0243): a CardTable's `dealerHand`/`playerHand` must be a `{path}` binding to
//   `/dealerHand` (resp. `/playerHand`), so a draw is a list append. A literal list or another pointer fails.
//
// A hand container is a component whose children are PlayingCards: static ids that resolve to
// PlayingCard, or a template whose `componentId` is a PlayingCard. It belongs to `<p>` when its id or its
// template path names `<p>` (and not the other participant). A CardTable is two hand containers, one per
// `<p>Hand` prop (the participant comes from the prop name): an absolute `{path}` renders the list it reads, a
// literal list renders its items, and its `<p>Total` props are that participant's readouts. A value the check
// cannot resolve (a function call, a relative path outside a template, an unknown rank) makes that hand
// indeterminate, never a finding.

import type { A2uiComponent } from '../../../protocol.ts'
import { readPointer } from '../../semantic-check.ts'
import type { SemanticAction, SemanticCheck, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

const PARTICIPANTS = ['dealer', 'player'] as const
type Participant = (typeof PARTICIPANTS)[number]

const RANK_VALUE: Readonly<Record<string, number>> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10,
}

interface Card {
  rank: string
  faceDown: boolean
}

interface HandContainer {
  id: string
  participant: Participant
  /** The cards the container renders, or `undefined` when any of them is unresolvable. */
  cards: Card[] | undefined
  /** How many cards it renders (a template over a non-array renders none). */
  rendered: number
  /** A CardTable hand prop: the pointer it binds, or `undefined` for a literal list. */
  table?: { path: string | undefined }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A prop's value: a literal, or a `{path}` read off the data model (relative only inside a template
 *  item, `scope` being that item's absolute pointer). A function call or an out-of-scope relative path is
 *  `undefined` (unknown), never a guess. */
function resolveProp(v: unknown, dataModel: unknown, scope: string | undefined): unknown {
  if (!isRecord(v)) return v
  if (typeof v['path'] === 'string') {
    const p = v['path']
    if (p.startsWith('/')) return readPointer(dataModel, p)
    return scope === undefined ? undefined : readPointer(dataModel, p === '' ? scope : `${scope}/${p}`)
  }
  return undefined
}

function cardOf(comp: A2uiComponent, dataModel: unknown, scope: string | undefined): Card | undefined {
  const rank = resolveProp(comp['rank'], dataModel, scope)
  if (typeof rank !== 'string' || RANK_VALUE[rank] === undefined) return undefined
  return { rank, faceDown: resolveProp(comp['faceDown'], dataModel, scope) === true }
}

/** A data-model list item's card (a CardTable hand): its own `rank` and `faceDown`, or `undefined`. */
function itemCard(item: unknown): Card | undefined {
  if (!isRecord(item)) return undefined
  const rank = item['rank']
  if (typeof rank !== 'string' || RANK_VALUE[rank] === undefined) return undefined
  return { rank, faceDown: item['faceDown'] === true }
}

/** A CardTable's hand for `p`: a literal list, or an absolute `{path}` read off the data model. A relative
 *  path, a function call or an absent prop is indeterminate (`undefined`). */
function tableHand(comp: A2uiComponent, p: Participant, dataModel: unknown): HandContainer | undefined {
  const v = comp[`${p}Hand`]
  let list: unknown[]
  let path: string | undefined
  if (Array.isArray(v)) list = v
  else if (isRecord(v) && typeof v['path'] === 'string' && v['path'].startsWith('/')) {
    path = v['path']
    const read = readPointer(dataModel, path)
    list = Array.isArray(read) ? read : []
  } else return undefined
  const cards = list.map(itemCard)
  return {
    id: comp.id,
    participant: p,
    cards: cards.every((c) => c !== undefined) ? (cards as Card[]) : undefined,
    rendered: list.length,
    table: { path },
  }
}

/** `dealer`/`player` when exactly one of them is named by `text` (case-insensitive), else `undefined`. */
function participantNamedBy(...texts: string[]): Participant | undefined {
  const joined = texts.join(' ').toLowerCase()
  const named = PARTICIPANTS.filter((p) => joined.includes(p))
  return named.length === 1 ? named[0] : undefined
}

function handContainers(view: SurfaceView): HandContainer[] {
  const out: HandContainer[] = []
  for (const comp of view.components.values()) {
    if (comp.component === 'CardTable') {
      for (const p of PARTICIPANTS) {
        const hand = tableHand(comp, p, view.dataModel)
        if (hand !== undefined) out.push(hand)
      }
      continue
    }
    const children = comp.children
    if (Array.isArray(children)) {
      const cardComps = children.map((id) => view.components.get(id)).filter((c): c is A2uiComponent => c?.component === 'PlayingCard')
      if (cardComps.length === 0) continue
      const participant = participantNamedBy(comp.id)
      if (participant === undefined) continue
      const cards = cardComps.map((c) => cardOf(c, view.dataModel, undefined))
      out.push({ id: comp.id, participant, cards: cards.every((c) => c !== undefined) ? (cards as Card[]) : undefined, rendered: cardComps.length })
    } else if (isRecord(children) && typeof children.path === 'string' && typeof children.componentId === 'string') {
      const template = view.components.get(children.componentId)
      if (template?.component !== 'PlayingCard') continue
      const participant = participantNamedBy(comp.id, children.path)
      if (participant === undefined) continue
      if (!children.path.startsWith('/')) continue // a template nested in another template: out of reach
      const items = readPointer(view.dataModel, children.path)
      const list = Array.isArray(items) ? items : []
      const cards = list.map((_, i) => cardOf(template, view.dataModel, `${children.path}/${i}`))
      out.push({ id: comp.id, participant, cards: cards.every((c) => c !== undefined) ? (cards as Card[]) : undefined, rendered: list.length })
    }
  }
  return out
}

/** Every total a hand may honestly state: hard and (one ace as 11, at most 21) soft, over the face-up
 *  cards and, when a card is face down, over the whole hand too. */
function acceptedTotals(cards: readonly Card[]): Set<number> {
  const out = new Set<number>()
  const add = (set: readonly Card[]): void => {
    const hard = set.reduce((sum, c) => sum + RANK_VALUE[c.rank]!, 0)
    out.add(hard)
    if (set.some((c) => c.rank === 'A') && hard + 10 <= 21) out.add(hard + 10)
  }
  add(cards.filter((c) => !c.faceDown))
  if (cards.some((c) => c.faceDown)) add(cards)
  return out
}

function describeTotals(cards: readonly Card[]): string {
  const faceUp = acceptedTotals(cards.filter((c) => !c.faceDown))
  const up = [...faceUp].sort((a, b) => a - b).join(' or ')
  if (!cards.some((c) => c.faceDown)) return up
  const all = [...acceptedTotals(cards)].filter((n) => !faceUp.has(n)).sort((a, b) => a - b).join(' or ')
  return all === '' ? up : `${up} face up (${all} with the face-down card)`
}

function describeCards(cards: readonly Card[]): string {
  return cards.length === 0 ? 'none' : cards.map((c) => (c.faceDown ? `${c.rank} face down` : c.rank)).join(', ')
}

/** Integers a readout states. A string's `${/pointer}` interpolations are resolved first. */
function statedNumbers(value: unknown, dataModel: unknown): number[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : []
  if (typeof value !== 'string') return []
  const text = value.replace(/\$\{([^}]*)\}/g, (_, expr: string) => {
    const resolved = expr.trim().startsWith('/') ? readPointer(dataModel, expr.trim()) : undefined
    return typeof resolved === 'number' || typeof resolved === 'string' ? String(resolved) : ''
  })
  return (text.match(/\d+/g) ?? []).map(Number)
}

const READOUT_PROPS = ['text', 'label', 'value'] as const

interface Readout {
  /** `<componentId>` or a data-model pointer. */
  where: string
  /** How the finding names it to the model. */
  label: string
  numbers: number[]
}

function readouts(view: SurfaceView, p: Participant): Readout[] {
  const out: Readout[] = []
  const totalPaths = [`/${p}Total`, `/${p}/total`]
  for (const path of totalPaths) {
    const v = readPointer(view.dataModel, path)
    if (v !== undefined) out.push({ where: path, label: `the data-model total at ${path} (${JSON.stringify(v)})`, numbers: statedNumbers(v, view.dataModel) })
  }
  const idPattern = new RegExp(`^${p}[-_]?total$`, 'i')
  for (const comp of view.components.values()) {
    if (comp.component === 'CardTable') {
      const raw = comp[`${p}Total`]
      if (raw === undefined) continue
      if (isRecord(raw) && typeof raw['path'] === 'string' && totalPaths.includes(raw['path'])) continue
      const value = resolveProp(raw, view.dataModel, undefined)
      const where = `${comp.id}.${p}Total`
      out.push({ where, label: `${where} ("${typeof value === 'string' ? value : JSON.stringify(value)}")`, numbers: statedNumbers(value, view.dataModel) })
      continue
    }
    if (!idPattern.test(comp.id)) continue
    const prop = READOUT_PROPS.find((k) => comp[k] !== undefined)
    if (prop === undefined) continue
    const raw = comp[prop]
    // A readout bound to a judged total path is the same figure: judged once, at the path.
    if (isRecord(raw) && typeof raw['path'] === 'string' && totalPaths.includes(raw['path'])) continue
    const value = resolveProp(raw, view.dataModel, undefined)
    out.push({ where: comp.id, label: `${comp.id} ("${typeof value === 'string' ? value : JSON.stringify(value)}")`, numbers: statedNumbers(value, view.dataModel) })
  }
  return out
}

/** Arrays of rank-bearing records anywhere in the data model, keyed by pointer: how a model that nests
 *  the table under its own root (`/game/dealer/cards`, recorded Haiku turn) still lists a hand. */
function cardLists(node: unknown, pointer: string, out: Map<string, number>, depth = 0): void {
  if (depth > 6) return
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every((c) => isRecord(c) && typeof c['rank'] === 'string')) out.set(pointer, node.length)
    return
  }
  if (!isRecord(node)) return
  for (const [k, v] of Object.entries(node)) cardLists(v, `${pointer}/${k}`, out, depth + 1)
}

function listedHand(view: SurfaceView, p: Participant): { path: string; length: number } | undefined {
  for (const path of [`/${p}Hand`, `/${p}/hand`]) {
    const v = readPointer(view.dataModel, path)
    if (Array.isArray(v)) return { path, length: v.length }
  }
  const found = new Map<string, number>()
  cardLists(view.dataModel, '', found)
  for (const [path, length] of found) if (participantNamedBy(path) === p) return { path, length }
  return undefined
}

/** A two-card 21: one ace and one ten-value card (10, J, Q, K). */
function isNatural(cards: readonly Card[]): boolean {
  if (cards.length !== 2) return false
  const aces = cards.filter((c) => c.rank === 'A').length
  const tens = cards.filter((c) => RANK_VALUE[c.rank] === 10).length
  return aces === 1 && tens === 1
}

const MOVE_WORDS: ReadonlySet<string> = new Set(['hit', 'stand', 'double'])

/** The move word a Button carries in its id or its label (`hitBtn`, `stand-button`, "Double down"), or
 *  `undefined`. Tokens split on case changes and non-letters, so "Standings" and "Deal again" do not match. */
function moveWord(comp: A2uiComponent, dataModel: unknown): string | undefined {
  const label = resolveProp(comp['label'], dataModel, undefined)
  for (const text of [comp.id, typeof label === 'string' ? label : '']) {
    const tokens = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/)
    const word = tokens.find((t) => MOVE_WORDS.has(t))
    if (word !== undefined) return word
  }
  return undefined
}

/** NATURAL_ACTIONS: the player's two-card 21 ends the round, so no move button and no face-down dealer card. */
function naturalFinding(view: SurfaceView, hand: HandContainer, dealer: readonly HandContainer[]): SemanticFinding | undefined {
  if (hand.cards === undefined || !isNatural(hand.cards)) return undefined
  const moves: { id: string; word: string }[] = []
  for (const comp of view.components.values()) {
    if (comp.component !== 'Button') continue
    const word = moveWord(comp, view.dataModel)
    if (word !== undefined) moves.push({ id: comp.id, word })
  }
  const hole = dealer.find((d) => d.cards?.some((c) => c.faceDown) === true)
  if (moves.length === 0 && hole === undefined) return undefined
  const faults: string[] = []
  if (moves.length > 0) faults.push(`still has ${moves.map((m) => `${m.id} (${m.word})`).join(', ')}`)
  if (hole !== undefined) faults.push(`still shows a face-down card in ${hole.id}`)
  return {
    code: 'NATURAL_ACTIONS',
    path: `${view.surfaceId}:${moves[0]?.id ?? hole!.id}`,
    message:
      `The player's cards in ${hand.id} (${describeCards(hand.cards)}) are a natural blackjack, which ends the round on the deal, but the surface ${faults.join(' and ')}. ` +
      `Settle the round in this same turn: turn the dealer's hole card face up, state the result (the player wins 3:2 unless the dealer also has 21, then a push) with the chip delta and the updated bankroll, ` +
      `and leave only the Deal again Button in the actions row, with no Hit, Stand or Double.`,
  }
}

function checkSurface(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  const containers = handContainers(view)
  for (const p of PARTICIPANTS) {
    const mine = containers.filter((c) => c.participant === p)
    for (const c of mine) {
      if (c.table === undefined || c.table.path === `/${p}Hand`) continue
      const bound = c.table.path === undefined ? 'a literal list' : `{"path":"${c.table.path}"}`
      findings.push({
        code: 'HAND_BINDING',
        path: `${view.surfaceId}:${c.id}`,
        message:
          `${c.id} gives ${p}Hand ${bound}. Write the ${p}'s cards at /${p}Hand in the data model and bind ` +
          `"${p}Hand":{"path":"/${p}Hand"} so a draw appends to the list.`,
      })
    }
    const listed = listedHand(view, p)
    if (listed !== undefined) {
      for (const c of mine) {
        if (c.rendered === listed.length) continue
        const fix =
          c.table === undefined
            ? `give ${c.id} "children":{"path":"${listed.path}","componentId":<one PlayingCard>}`
            : `bind ${c.id}'s "${p}Hand":{"path":"${listed.path}"}`
        findings.push({
          code: 'HAND_COUNT',
          path: `${view.surfaceId}:${c.id}`,
          message:
            `${c.id} renders ${c.rendered} card${c.rendered === 1 ? '' : 's'} but ${listed.path} lists ${listed.length}. ` +
            `Draw the hand from that list: ${fix} so the cards shown are the cards listed.`,
        })
      }
    }
    // The total is judged only when exactly one container shows this participant's hand (two would make
    // "which hand does the total belong to" a guess, e.g. a split).
    if (mine.length !== 1) continue
    const cards = mine[0]!.cards
    if (cards === undefined) continue
    if (p === 'player') {
      const natural = naturalFinding(view, mine[0]!, containers.filter((c) => c.participant === 'dealer'))
      if (natural !== undefined) findings.push(natural)
    }
    const accepted = acceptedTotals(cards)
    for (const r of readouts(view, p)) {
      const wrong = [...new Set(r.numbers.filter((n) => !accepted.has(n)))]
      if (wrong.length === 0) continue
      findings.push({
        code: 'HAND_TOTAL',
        path: `${view.surfaceId}:${r.where}`,
        message:
          `${r.label} states ${wrong.join(' and ')}, but the ${p}'s cards in ${mine[0]!.id} (${describeCards(cards)}) total ${describeTotals(cards)}. ` +
          `Compute the total from the cards you list and state only that figure; if the ${p} must draw, deal the card into the hand first.`,
      })
    }
  }
  return findings
}

/** GH #1795: the cards a hand shows, the list it is drawn from, and the total it states must agree. */
export const croupierHandConsistency: SemanticCheck = {
  id: 'croupier-hand-consistency',
  requires: ['CardTable', 'PlayingCard'],
  check: (input) => input.surfaces.flatMap(checkSurface),
}

const bindingPath = (v: unknown): string | undefined =>
  typeof v === 'object' && v !== null && typeof (v as { path?: unknown }).path === 'string' ? (v as { path: string }).path : undefined

/** A CardTable's phase: the literal, or the bound value in the data model; absent or unknown is `playing`,
 *  as the factory reads it. */
function phaseOf(table: A2uiComponent, dataModel: unknown): string {
  const raw = table['phase']
  const path = bindingPath(raw)
  const value = path === undefined ? raw : readPointer(dataModel, path)
  return value === 'betting' || value === 'settled' ? value : 'playing'
}

const BET_INPUTS = new Set(['Slider', 'TextField'])

/** T-0172 (Kim's ruling): a CardTable owns the whole bet phase. In `betting` its strip of bet buttons places the
 *  bet and fires `betAction`, so the table needs `betAction`, carries no Button child, and the surface holds no
 *  Slider or TextField for the bet. In any phase, a second control bound to the table's bet path doubles its
 *  controls (the Sonnet 5 trace of 2026-10-14 added a Slider on `/bet` beside the table). */
function betControls(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  const finding = (id: string, message: string): void => void findings.push({ code: 'BET_CONTROL_DUPLICATE', path: `${view.surfaceId}:${id}`, message })
  for (const table of view.components.values()) {
    if (table.component !== 'CardTable') continue
    const bet = bindingPath(table['bet'])
    const betting = phaseOf(table, view.dataModel) === 'betting'
    if (betting && typeof table['betAction'] !== 'string')
      finding(table.id, `${table.id} is in the betting phase with no "betAction". Set "betAction":"deal" so a press on its bet strip places the bet and deals.`)
    const kids = Array.isArray(table['children']) ? (table['children'] as unknown[]) : []
    for (const other of view.components.values()) {
      if (other.id === table.id) continue
      const sameBet = bet !== undefined && bindingPath(other['value']) === bet
      const strayInput = betting && BET_INPUTS.has(other.component)
      const strayButton = betting && other.component === 'Button' && kids.includes(other.id)
      if (!sameBet && !strayInput && !strayButton) continue
      finding(
        other.id,
        `${other.id} (a ${other.component}) duplicates ${table.id}'s own bet controls: in the betting phase its strip of ` +
          `bet buttons places the bet and deals. Remove ${other.id} and its id from every children list.`,
      )
    }
  }
  return findings
}

const BET_WORDS = /\b(bet|bets|stake|wager)\b/i
const textOf = (v: unknown): string => (typeof v === 'string' ? v : bindingPath(v) ?? '')
const actionName = (c: A2uiComponent): string => {
  const a = c['action'] as { action?: unknown; event?: { name?: unknown } } | undefined
  return typeof a?.action === 'string' ? a.action : typeof a?.event?.name === 'string' ? a.event.name : ''
}

/** T-0172 (the live Haiku 5.5 probe, 2026-10-14): a blackjack bet step built WITHOUT a CardTable (a Card with a
 *  "Bet amount" Slider and a Deal Button) never reaches the table's bet strip, so the check above has nothing to
 *  judge. A surface with no CardTable that holds a bet input (a Slider or TextField whose label, name or bound
 *  path says bet, stake or wager) or a Deal Button, and no dealt card yet, is sent back to be one CardTable in its betting phase. A
 *  false positive costs one repair round and ships tallied at the bound (ADR-0238), never a halt. */
function betStepWithoutTable(view: SurfaceView): SemanticFinding[] {
  const comps = [...view.components.values()]
  // A dealt hand (any PlayingCard) is past the bet step: an older table shape is judged by the hand check alone.
  if (comps.some((c) => c.component === 'CardTable' || c.component === 'PlayingCard')) return []
  const strays = comps.filter((c) => {
    if (BET_INPUTS.has(c.component)) return [c['label'], c['name'], c['value']].some((v) => BET_WORDS.test(textOf(v).replace(/[/_-]/g, ' ')))
    if (c.component === 'Button') return /^deal\b/i.test(textOf(c['label'])) || /^(deal|place_?bet|bet)$/i.test(actionName(c))
    return false
  })
  if (strays.length === 0) return []
  return [
    {
      code: 'BET_TABLE_MISSING',
      path: `${view.surfaceId}:${strays[0]!.id}`,
      message:
        `${view.surfaceId} takes a blackjack bet with ${strays.map((c) => `${c.id} (a ${c.component})`).join(', ')} and no CardTable. ` +
        `Make the surface ONE CardTable, phase "betting", bet and bankroll bound, "betAction":"deal": its own bet strip ` +
        `places the bet and deals, so drop those controls. (A game other than blackjack keeps its Card.)`,
    },
  ]
}

/** T-0172: one bet, one set of bet controls (the CardTable's own strip). */
export const croupierBetControls: SemanticCheck = {
  id: 'croupier-bet-controls',
  requires: ['CardTable'],
  check: (input) => input.surfaces.flatMap((view) => [...betControls(view), ...betStepWithoutTable(view)]),
}

const DEAL_ACTION = /^(deal|place_?bet|bet|deal_blackjack)$/i
const MOVE_ACTION = /^(hit|stand|double|double_?down)$/i
const finiteNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** T-0172 (the live probe on f6f94f7f): a table action must move the table, and a deal must take the bet out of
 *  the bankroll. Haiku 5.5 answered a 50 press with prose ("dealt you 9 and 7 for 16") and no update, so the
 *  table stayed in betting; Sonnet 5.5 dealt and wrote a bankroll of 500 from 1,000 after a 50 bet. */
function actionApplied(surfaces: readonly SurfaceView[], action: SemanticAction): SemanticFinding[] {
  const deal = DEAL_ACTION.test(action.name)
  if (!deal && !MOVE_ACTION.test(action.name)) return []
  const view = surfaces.find((v) => v.surfaceId === action.surfaceId)
  // A move answered on a NEW table (the next round) hands the flow on; the clicked one is history.
  const handedOn = surfaces.some((v) => v.surfaceId !== action.surfaceId && [...v.components.values()].some((c) => c.component === 'CardTable'))
  if (view === undefined) {
    if (handedOn) return []
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${action.surfaceId}:${action.name}`,
        message:
          `The player pressed ${action.name} on ${action.surfaceId}, and this turn sends it no update, so the table still shows the old state. ` +
          `Call render_surface with an updateDataModel for ${action.surfaceId}: the new cards, totals, phase and bankroll, not only prose.`,
      },
    ]
  }
  const findings: SemanticFinding[] = []
  for (const table of view.components.values()) {
    if (table.component !== 'CardTable') continue
    if (deal && phaseOf(table, view.dataModel) === 'betting')
      findings.push({
        code: 'ACTION_NOT_APPLIED',
        path: `${view.surfaceId}:${table.id}`,
        message: `The player bet with ${action.name}, but ${table.id} is still in the betting phase. Write the dealt hands and phase "playing" to ${view.surfaceId}'s data model.`,
      })
    const bet = finiteNumber(action.context['bet'])
    // T-0216: the table owns the debit; its press sends the bankroll less the bet, the figure the deal writes.
    const owned = finiteNumber(action.context['bankrollAfterBet'])
    const before = bet !== undefined && owned !== undefined ? owned + bet : finiteNumber((action.dataModel as Record<string, unknown> | undefined)?.['bankroll'])
    const path = bindingPath(table['bankroll'])
    const after = path === undefined ? finiteNumber(table['bankroll']) : finiteNumber(readPointer(view.dataModel, path))
    // A round that settles on this action is judged by the payout, never by the plain deal arithmetic.
    if (phaseOf(table, view.dataModel) === 'settled') {
      const settled = settleFinding(view, table, action, deal)
      if (settled !== undefined) findings.push(settled)
      continue
    }
    if (deal && bet !== undefined && before !== undefined && after !== undefined && after !== before - bet)
      findings.push({
        code: 'BANKROLL_MISMATCH',
        path: `${view.surfaceId}:${path ?? table.id}`,
        message:
          `The bankroll reads ${after} after a bet of ${bet} from ${before}. The deal takes the bet out of the bankroll: write ${before - bet}. ` +
          `Settlement later pays the bet back with the winnings (2x the bet for a win, 2.5x for a natural, 1x for a push).`,
      })
  }
  return findings
}

/** A settled hand's best total (an ace counts 11 while that stays at 21 or under), every card counted. */
function bestTotal(cards: readonly Card[]): number {
  const hard = cards.reduce((sum, c) => sum + RANK_VALUE[c.rank]!, 0)
  return cards.some((c) => c.rank === 'A') && hard + 10 <= 21 ? hard + 10 : hard
}

/** A list of cards read off the data model at `path`, or undefined when any item is not a card. */
function cardsAt(dataModel: unknown, path: string | undefined): Card[] | undefined {
  const list = path === undefined ? undefined : readPointer(dataModel, path)
  if (!Array.isArray(list)) return undefined
  const cards = list.map(itemCard)
  return cards.every((c): c is Card => c !== undefined) ? cards : undefined
}

/** What a settled round pays back on a stake already taken out at the deal: 2x on a win, 2.5x on a natural,
 *  the stake on a push, nothing on a loss, with the result in words for the repair sentence. */
function payout(player: readonly Card[], dealer: readonly Card[], stake: number): { amount: number; result: string } {
  const p = bestTotal(player)
  const d = bestTotal(dealer)
  if (p > 21) return { amount: 0, result: `a bust (${p})` }
  if (isNatural(player) && !isNatural(dealer)) return { amount: stake * 2.5, result: 'a natural' }
  if (isNatural(dealer) && !isNatural(player)) return { amount: 0, result: 'a loss to the dealer\'s natural' }
  if (d > 21) return { amount: stake * 2, result: `a win (the dealer bust on ${d})` }
  if (p > d) return { amount: stake * 2, result: `a win (${p} over ${d})` }
  if (p === d) return { amount: stake, result: `a push (${p})` }
  return { amount: 0, result: `a loss (${p} under ${d})` }
}

/** T-0172 (the live probe on afc073a3): a round that settles on this action must pay out from the click-time
 *  bankroll: on a deal (a natural), the bet comes out and the payout goes back in one step; on a hit, stand or
 *  double, the stake (doubled on a double, the extra stake taken out) pays back by the result the hands show. */
function settleFinding(view: SurfaceView, table: A2uiComponent, action: SemanticAction, deal: boolean): SemanticFinding | undefined {
  if (phaseOf(table, view.dataModel) !== 'settled') return undefined
  const clickTime = action.dataModel as Record<string, unknown> | undefined
  if (clickTime?.['phase'] === 'settled') return undefined // already settled before this action
  const bet = deal ? finiteNumber(action.context['bet']) : finiteNumber(clickTime?.['bet'])
  const owned = deal ? finiteNumber(action.context['bankrollAfterBet']) : undefined // T-0216: the table's own debit
  const before = bet !== undefined && owned !== undefined ? owned + bet : finiteNumber(clickTime?.['bankroll'])
  const bankrollPath = bindingPath(table['bankroll'])
  const after = bankrollPath === undefined ? finiteNumber(table['bankroll']) : finiteNumber(readPointer(view.dataModel, bankrollPath))
  const player = cardsAt(view.dataModel, bindingPath(table['playerHand']))
  const dealer = cardsAt(view.dataModel, bindingPath(table['dealerHand']))
  if (before === undefined || after === undefined || player === undefined || dealer === undefined || bet === undefined || bet <= 0) return undefined
  const doubled = /^double/i.test(action.name)
  const stake = doubled ? bet * 2 : bet
  const takenNow = deal ? bet : doubled ? bet : 0 // the stake leaves the bankroll at the deal; a double adds one more
  const { amount, result } = payout(player, dealer, stake)
  const expected = before - takenNow + amount
  if (after === expected) return undefined
  return {
    code: 'BANKROLL_MISMATCH',
    path: `${view.surfaceId}:${bankrollPath ?? table.id}`,
    message:
      `The round settles as ${result} on a stake of ${stake}, so the bankroll goes from ${before} to ${expected}` +
      `${takenNow > 0 ? ` (${takenNow} taken out now, ${amount} paid back)` : ` (${amount} paid back)`}, but it reads ${after}. Write ${expected}.`,
  }
}

/** T-0172: a table action moves the table, and a deal takes the bet out of the bankroll. */
export const croupierActionApplied: SemanticCheck = {
  id: 'croupier-action-applied',
  requires: ['CardTable'],
  check: (input) => (input.action === undefined ? [] : actionApplied(input.surfaces, input.action)),
}

export const croupierSemanticChecks: readonly SemanticCheck[] = [croupierHandConsistency, croupierBetControls, croupierActionApplied]
