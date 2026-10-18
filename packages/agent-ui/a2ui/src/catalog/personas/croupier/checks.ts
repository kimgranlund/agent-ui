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
//   never a natural; a dealer hand it cannot resolve is never judged for a hole card. T-0276: a surface whose
//   words name another game (hold'em, Omaha, stud) and no blackjack-family game is never judged for a natural.
//   T-0334: the CardTable's title or status, else a heading Text (literal or bound), picks the game rules (`gameRules`):
//   pontoon pays a natural or a five-card trick 2:1, the banker wins every tie, a buy adds the original stake, and a
//   natural forbids Twist, Stick and Buy.
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
import type { SemanticAction, SemanticCheck, SemanticCheckInput, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

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

/** T-0334: the rules that differ across the blackjack family, resolved once per view from the table's own game. */
interface GameRules {
  game: 'blackjack' | 'pontoon'
  /** What a natural returns per unit of stake, the stake included (3:2 is 2.5, pontoon's 2:1 is 3). */
  naturalMultiplier: number
  /** The natural as the repair names it, and its payout odds. */
  naturalLabel: string
  payLabel: string
  /** Pontoon's banker takes every tie, a natural against a natural included. */
  bankerWinsTies: boolean
  tieLabel: string
  /** Pontoon's five-card trick (five cards at 21 or under) pays 2:1 and beats everything but a banker pontoon. */
  fiveCardTrick: boolean
  /** Pontoon's buy: a face-down card for an added stake equal to the original stake. */
  buy: boolean
  /** What a natural forbids: the game's move words (a buy is matched separately), and the Buttons the repair names. */
  moveWords: ReadonlySet<string>
  moveLabels: string
}

const BLACKJACK_RULES: GameRules = {
  game: 'blackjack',
  naturalMultiplier: 2.5,
  naturalLabel: 'a natural blackjack',
  payLabel: '3:2',
  bankerWinsTies: false,
  tieLabel: 'a push',
  fiveCardTrick: false,
  buy: false,
  moveWords: new Set(['hit', 'stand', 'double']),
  moveLabels: 'Hit, Stand or Double',
}
const PONTOON_RULES: GameRules = {
  game: 'pontoon',
  naturalMultiplier: 3,
  naturalLabel: 'a pontoon',
  payLabel: '2:1',
  bankerWinsTies: true,
  tieLabel: 'the dealer wins the tie',
  fiveCardTrick: true,
  buy: true,
  moveWords: new Set(['hit', 'stand', 'double', 'twist', 'stick']),
  moveLabels: 'Twist, Stick or Buy',
}

/** The game comes from the table itself: its `title` or `status`, then a heading Text on the surface, literal or
 *  bound, and the first family game a source names wins ("Pontoon (British blackjack)" is pontoon, "Blackjack
 *  (they call it pontoon in the UK)" is blackjack). Any other mention (a picker listing several games, body
 *  text) never decides it, and a surface that names none is blackjack. */
function gameRules(view: SurfaceView): GameRules {
  const comps = [...view.components.values()]
  const sources = [
    ...comps.filter((c) => c.component === 'CardTable').flatMap((c) => [c['title'], c['status']]),
    ...comps.filter((c) => c.component === 'Text' && /^h[1-5]$/.test(String(c['variant']))).map((c) => c['text']),
  ]
  for (const source of sources) {
    const value = resolveProp(source, view.dataModel, undefined)
    const names = typeof value === 'string' ? [...value.matchAll(new RegExp(BLACKJACK_GAMES.source, 'gi'))].map((m) => m[1]!.toLowerCase()) : []
    const named = names.find((n) => n !== '21') // a bare 21 names the family, not a variant
    if (named !== undefined) return named === 'pontoon' ? PONTOON_RULES : BLACKJACK_RULES
  }
  return BLACKJACK_RULES
}

/** A control that buys a card: buy, buy_card, "Buy", "Buy a card". "Buy chips" and "Buy in" are not moves. */
function isBuyCard(text: string): boolean {
  const words = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter((w) => w !== '' && w !== 'btn' && w !== 'button')
  return words[0] === 'buy' && (words.length === 1 || ['buy card', 'buy a card'].includes(words.join(' ')))
}

/** The move word a Button carries in its id or its label (`hitBtn`, `stand-button`, "Double down"), or
 *  `undefined`; a card-buying control is "buy" where the game has one. Tokens split on case changes and
 *  non-letters, so "Standings" and "Deal again" do not match. */
function moveWord(comp: A2uiComponent, dataModel: unknown, rules: GameRules): string | undefined {
  const label = resolveProp(comp['label'], dataModel, undefined)
  for (const text of [comp.id, typeof label === 'string' ? label : '']) {
    const tokens = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/)
    const word = tokens.find((t) => rules.moveWords.has(t))
    if (word !== undefined) return word
    if (rules.buy && isBuyCard(text)) return 'buy'
  }
  return undefined
}

/** NATURAL_ACTIONS: the player's two-card 21 ends the round, so no move button and no face-down dealer card. */
function naturalFinding(view: SurfaceView, hand: HandContainer, dealer: readonly HandContainer[]): SemanticFinding | undefined {
  if (hand.cards === undefined || !isNatural(hand.cards)) return undefined
  const rules = gameRules(view)
  const moves: { id: string; word: string }[] = []
  for (const comp of view.components.values()) {
    if (comp.component !== 'Button') continue
    const word = moveWord(comp, view.dataModel, rules)
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
      `The player's cards in ${hand.id} (${describeCards(hand.cards)}) are ${rules.naturalLabel}, which ends the round on the deal, but the surface ${faults.join(' and ')}. ` +
      `Settle the round in this same turn: turn the dealer's hole card face up, state the result (the player wins ${rules.payLabel} unless the dealer also has ${rules.naturalLabel}, then ${rules.tieLabel}) with the chip delta and the updated bankroll, ` +
      `and leave only the Deal again Button in the actions row, with no ${rules.moveLabels}.`,
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
    // T-0276: a natural is a blackjack-family rule; a hold'em, Omaha or stud table holding A K is a hand in progress.
    if (p === 'player' && !namesOtherGame([...view.components.values()])) {
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
 *  controls (the Sonnet 5 trace of 2026-10-14 added a Slider on `/bet` beside the table).
 *  T-0323 (Kim's ruling, round 8 :61): the strip is blackjack's, so a surface that names another game skips the
 *  strip rules; a poker table in betting with dealt cards is past betting (DEALT_IN_BETTING). Known gap: a poker
 *  table whose words name no game is still judged as blackjack. */
function betControls(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  const finding = (id: string, message: string): void => void findings.push({ code: 'BET_CONTROL_DUPLICATE', path: `${view.surfaceId}:${id}`, message })
  const comps = [...view.components.values()]
  const otherGame = namesOtherGame(comps)
  for (const table of comps) {
    if (table.component !== 'CardTable') continue
    const bet = bindingPath(table['bet'])
    const phaseBetting = phaseOf(table, view.dataModel) === 'betting'
    if (otherGame && phaseBetting) {
      const dealt = PARTICIPANTS.filter((p) => (handList(table, p, view.dataModel)?.length ?? 0) > 0)
      if (dealt.length > 0) findings.push(dealtInBetting(view, table, dealt))
    }
    const betting = phaseBetting && !otherGame
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

/** T-0323: a poker table in phase betting whose hand lists hold cards; betting hides them. The repair moves the
 *  table forward to phase playing and keeps its move Buttons, or asks for them when it has none (:65 round 1). */
function dealtInBetting(view: SurfaceView, table: A2uiComponent, dealt: readonly Participant[]): SemanticFinding {
  const kids = Array.isArray(table['children']) ? (table['children'] as unknown[]) : []
  const moves = [...view.components.values()].filter((c) => c.component === 'Button' && kids.includes(c.id)).map((c) => c.id)
  const keep = moves.length === 0 ? 'give it the moves the hand has now as Button children (Check, Bet and Fold)' : `keep ${listed(moves)} as its moves`
  return {
    code: 'DEALT_IN_BETTING',
    path: `${view.surfaceId}:${table.id}`,
    message:
      `${table.id} holds dealt cards in ${dealt.map((p) => `/${p}Hand`).join(' and ')}, so this poker hand is past the betting phase, ` +
      `and phase "betting" hides the cards. Set phase "playing" and ${keep}` +
      `${typeof table['betAction'] === 'string' ? '; drop "betAction", the blackjack stake strip' : ''}.`,
  }
}

/** `a`, `a and b`, `a, b and c`. */
const listed = (items: readonly string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

const BET_WORDS = /\b(bet|bets|stake|wager|buy ?in)\b/i
const BLACKJACK_GAMES = /\b(blackjack|black jack|twenty[- ]one|spanish 21|pontoon|21)\b/i
/** Hold'em in any spelling ("hold'em", "hold’em", "holdem", "hold-em", "hold em"); shared by every game pattern. */
const HOLDEM_WORDS = "hold[- ]?['’]?em"
const HOLDEM = new RegExp(`\\b(${HOLDEM_WORDS})\\b`, 'i')
const OTHER_GAMES = new RegExp(`\\b(poker|stud|${HOLDEM_WORDS}|omaha|razz|five[- ]card draw|draw poker|baccarat|roulette|craps)\\b`, 'i')
/** A game other than hold'em that a hold'em mention can sit beside (a picker, or stud prose that says "not hold'em"). */
const NOT_HOLDEM_GAMES = /\b(stud|omaha|razz|five[- ]card draw|draw poker|triple draw|badugi|lowball|deuce[- ]to[- ]seven|2[- ]7( triple)? draw|baccarat|roulette|craps)\b/i
/** Words that name hold'em as the game and no other (a picker or stud prose that mentions hold'em does not). */
const namesHoldemAlone = (words: string): boolean => HOLDEM.test(words) && !NOT_HOLDEM_GAMES.test(words) && !BLACKJACK_GAMES.test(words)
const textOf = (v: unknown): string => (typeof v === 'string' ? v : bindingPath(v) ?? '')

/** A surface's literal words: its text, label, title and status props. */
const literalWords = (comps: Iterable<A2uiComponent>): string =>
  [...comps].flatMap((c) => ['text', 'label', 'title', 'status'].map((k) => c[k]).filter((v): v is string => typeof v === 'string')).join(' ')

/** T-0212: a surface whose words name a game other than blackjack and no blackjack-family game (the recorded
 *  "Seven-card stud · Place your bet"; T-0276: "Texas hold'em, heads-up", which NATURAL_ACTIONS skips). */
function namesOtherGame(comps: readonly A2uiComponent[]): boolean {
  const words = literalWords(comps)
  return OTHER_GAMES.test(words) && !BLACKJACK_GAMES.test(words)
}
const actionName = (c: A2uiComponent): string => {
  const a = c['action'] as { action?: unknown; event?: { name?: unknown } } | undefined
  return typeof a?.action === 'string' ? a.action : typeof a?.event?.name === 'string' ? a.event.name : ''
}

/** A press that deals: a Button labelled "Deal ..." or whose action is deal, deal_<anything> (deal_hand,
 *  deal_blackjack), place_bet or bet. One predicate for both bet-step arms. */
const isDealPress = (c: A2uiComponent): boolean =>
  c.component === 'Button' && (/^deal\b/i.test(textOf(c['label'])) || /^(deal(_[a-z]+)*|place_?bet|bet)$/i.test(actionName(c)))

/** T-0172 (the live Haiku 5.5 probe, 2026-10-14): a blackjack bet step built WITHOUT a CardTable (a Card with a
 *  "Bet amount" Slider and a Deal Button) never reaches the table's bet strip, so the check above has nothing to
 *  judge. A surface with no CardTable that holds a bet input (a Slider or TextField whose label, name or bound
 *  path says bet, stake or wager) or a Deal Button, and no dealt card yet, is sent back to be one CardTable in its betting phase. A
 *  false positive costs one repair round and ships tallied at the bound (ADR-0238), never a halt. T-0212: a surface
 *  that names another game (the recorded seven-card stud opening, sent back twice) keeps its Card; one that names
 *  no game at all is still judged as blackjack. T-0357 (round 10 :81, Haiku 5.5): a hold'em opening that asks for
 *  the stake instead of dealing gets POKER_DEAL_MISSING (`holdemStakeAsk`); hold'em deals at once on its Card (T-0323).
 *  T-0368 (round 11 :222 round 2): a PlayingCard reached only as a template over an empty hand is not a dealt card
 *  (`undealtCards`), so such a Card is judged by both arms when it reads as a fresh opening (`freshOpening`), and a
 *  surface that names no game is judged as hold'em when the user's words ask to play hold'em (`holdemAsked`), and keeps
 *  its Card when they ask to play another game that is not blackjack (`otherAsked`). */
const isBetInput = (c: A2uiComponent): boolean =>
  BET_INPUTS.has(c.component) && [c['label'], c['name'], c['value']].some((v) => BET_WORDS.test(textOf(v).replace(/[/_-]/g, ' ')))

/** T-0368: what the bet step reads across the turn, computed once per check. */
interface BetStepTurn {
  /** Each surface's undealt PlayingCards (`undealtCards`). */
  undealt: ReadonlyMap<SurfaceView, ReadonlySet<string>>
  /** A surface this turn touches shows a CardTable or a dealt PlayingCard. */
  dealtSomewhere: boolean
  /** The user's words ask to play hold'em and no other game (`asksToPlay`, `namesHoldemAlone`). */
  holdemAsked: boolean
  /** The user's words ask to play a game other than blackjack, so a surface that names no game keeps its Card (T-0212). */
  otherAsked: boolean
}

function betStepTurn(surfaces: readonly SurfaceView[], intent: string | undefined): BetStepTurn {
  const undealt = new Map(surfaces.map((view) => [view, undealtCards(view)] as const))
  const dealtSomewhere = surfaces.some((view) =>
    reachable(view).some((c) => c.component === 'CardTable' || (c.component === 'PlayingCard' && !undealt.get(view)!.has(c.id))),
  )
  const asked = intent !== undefined && asksToPlay(intent)
  return {
    undealt,
    dealtSomewhere,
    holdemAsked: asked && namesHoldemAlone(intent),
    otherAsked: asked && OTHER_GAMES.test(intent) && !BLACKJACK_GAMES.test(intent),
  }
}

function betStepWithoutTable(view: SurfaceView, turn: BetStepTurn): SemanticFinding[] {
  const comps = [...view.components.values()]
  if (comps.some((c) => c.component === 'CardTable')) return []
  // A dealt hand (a PlayingCard that is not a template over an empty hand) is past the bet step: an older table
  // shape is judged by the hand check alone.
  const undealt = turn.undealt.get(view)!
  if (comps.some((c) => c.component === 'PlayingCard' && !undealt.has(c.id))) return []
  const shown = reachable(view)
  const emptyHands = comps.some((c) => c.component === 'PlayingCard')
  if (emptyHands && !freshOpening(view, shown)) return []
  if (namesOtherGame(comps)) return holdemStakeAsk(view, shown, literalWords(shown), emptyHands, turn.dealtSomewhere)
  const words = literalWords(comps)
  const unnamed = !OTHER_GAMES.test(words) && !BLACKJACK_GAMES.test(words)
  if (unnamed && turn.holdemAsked) return holdemStakeAsk(view, shown, "hold'em", emptyHands, turn.dealtSomewhere)
  if (unnamed && turn.otherAsked) return []
  const strays = comps.filter((c) => isBetInput(c) || isDealPress(c))
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

/** T-0357: the hold'em arm of the bet step. It fires only when hold'em is the game being opened (`gameWords`: the
 *  on-screen words name hold'em and no other game, so a picker or stud prose that mentions hold'em is not judged;
 *  T-0368: or the user asked to play hold'em on a surface that names no game), the surface holds a bet input, nothing
 *  on a surface this turn touches shows a dealt card, and the surface offers no new-round forward and does not read
 *  settled (a settled hand's next-stake Slider beside its Deal again). A Deal Button alone may be a settled hand's Deal
 *  again, so it fires only beside empty hands (T-0368: PlayingCard templates over empty lists on a `freshOpening`),
 *  and there even a new-round Deal is the opening. Stud and draw post an ante before the deal and are not judged (the
 *  recorded stud opening keeps its Card). */
function holdemStakeAsk(view: SurfaceView, shown: readonly A2uiComponent[], gameWords: string, emptyHands: boolean, dealtSomewhere: boolean): SemanticFinding[] {
  if (!namesHoldemAlone(gameWords) || dealtSomewhere) return []
  if ((!emptyHands && shown.some(offersNextRound)) || readPointer(view.dataModel, '/phase') === 'settled') return []
  const inputs = shown.filter(isBetInput)
  const deals = shown.filter(isDealPress)
  if (inputs.length === 0 && !(emptyHands && deals.length > 0)) return []
  const strays = listed([...inputs, ...deals].map((c) => `${c.id} (a ${c.component})`))
  return [
    {
      code: 'POKER_DEAL_MISSING',
      path: `${view.surfaceId}:${(inputs[0] ?? deals[0])!.id}`,
      message:
        (inputs.length > 0
          ? `${view.surfaceId} asks for a hold'em stake with ${strays}, and no hand is dealt. `
          : `${view.surfaceId} opens hold'em with empty hands and only ${strays} to deal them, so no hand is dealt. `) +
        `Hold'em deals the hands at once: make the surface one Card with the dealt PlayingCard hands, the bankroll and ` +
        `the hand's moves as Buttons (Check, Bet and Fold), ` +
        (inputs.length > 0 ? 'so drop those controls.' : 'dealt in this answer, not behind a Deal press.'),
    },
  ]
}

/** T-0368: the PlayingCards a surface deals no card from: each one reached on screen (`reachable`) only as a template
 *  whose absolute path reads an empty list. A missing or unresolvable path stays indeterminate (dealt), as everywhere
 *  in this file. The hand reader (`handContainers`) cannot answer this: it knows only dealer and player containers,
 *  and a hold'em board's community cards are neither. */
function undealtCards(view: SurfaceView): Set<string> {
  const empty = new Set<string>()
  const used = new Set<string>()
  for (const c of reachable(view)) {
    const kids = c['children']
    if (Array.isArray(kids)) for (const k of kids) if (typeof k === 'string') used.add(k)
    if (isRecord(kids) && typeof kids['componentId'] === 'string') {
      const path = kids['path']
      const list = typeof path === 'string' && path.startsWith('/') ? readPointer(view.dataModel, path) : undefined
      ;(Array.isArray(list) && list.length === 0 ? empty : used).add(kids['componentId'])
    }
    if (typeof c['child'] === 'string') used.add(c['child'])
  }
  return new Set([...empty].filter((id) => !used.has(id)))
}

/** T-0368: a hand over: the phase, a result word, a fold or the showdown. */
const SETTLED_WORDS = /\b(settled|fold(s|ed)?|showdown|hand over|game over|wins?|won|lose[sd]?|lost|beats?|split|ties?|tied|push|chop)\b/i

/** T-0368: empty hands read as a fresh opening only when nothing says a hand is over (the data model's `/phase`,
 *  `/status` or `/result`, or a text, title, status or result prop on screen, literal or bound; a Button's label is a
 *  move, never a signal) and no earlier turn dealt a card on this surface (its prior data model lists none). A hand
 *  cleared after a fold or a showdown, beside its Deal again, is not an opening. */
function freshOpening(view: SurfaceView, shown: readonly A2uiComponent[]): boolean {
  if (deckCards(view.priorDataModel, '', []).length > 0) return false
  const said = (v: unknown): boolean => typeof v === 'string' && SETTLED_WORDS.test(v)
  if (['/phase', '/status', '/result'].some((p) => said(readPointer(view.dataModel, p)))) return false
  return !shown.some((c) => c.component !== 'Button' && ['text', 'title', 'status', 'result'].some((k) => said(stringProp(view, c, k))))
}

/** T-0233: the player's move words across the blackjack family (pontoon twists, sticks and buys). Wider than
 *  `MOVE_WORDS`, which names only what a natural forbids. */
const PLAYER_MOVES: ReadonlySet<string> = new Set(['hit', 'stand', 'double', 'split', 'surrender', 'twist', 'stick'])

/** A Button offers a move when its id, label or action name carries a player move word (T-0286: or one of `moves`),
 *  or, in a game with a buy (`buy`), when it buys a card (T-0334). */
function offersMove(comp: A2uiComponent, dataModel: unknown, moves: ReadonlySet<string> = PLAYER_MOVES, buy = false): boolean {
  const label = resolveProp(comp['label'], dataModel, undefined)
  return [comp.id, typeof label === 'string' ? label : '', actionName(comp)].some(
    (text) => text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).some((t) => moves.has(t)) || (buy && isBuyCard(text)),
  )
}

/** T-0233 (the recorded Haiku 5.5 repair round, 2026-10-15.jsonl:2): a bet answer resent its CardTable in phase
 *  playing with `children: []`, and the turn shipped with no Hit or Stand. A table in the playing phase whose player
 *  hand is dealt, not a natural and not bust, needs at least one move Button on the surface (in the table or beside
 *  it). A hand the check cannot resolve is never judged. */
function movesMissing(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  const comps = [...view.components.values()]
  if (comps.some((c) => c.component === 'Button' && offersMove(c, view.dataModel, PLAYER_MOVES, gameRules(view).buy))) return []
  if (namesOtherGame(comps)) return [] // T-0323: the move words are blackjack's
  for (const table of comps) {
    if (table.component !== 'CardTable' || phaseOf(table, view.dataModel) !== 'playing') continue
    const cards = handList(table, 'player', view.dataModel)?.map(itemCard)
    if (cards === undefined || cards.length === 0 || !cards.every((c): c is Card => c !== undefined)) continue
    if (isNatural(cards) || bestTotal(cards) > 21) continue
    findings.push({
      code: 'MOVES_MISSING',
      path: `${view.surfaceId}:${table.id}`,
      message:
        `${table.id} is in the playing phase with the player on ${describeCards(cards)}, and the surface offers no move. ` +
        `Give the table its move Buttons as children: Hit and Stand (and Double on the first two cards; Twist, Stick and Buy in pontoon).`,
    })
  }
  return findings
}

/** T-0350: a press opens the next round when its context says `newRound: true` or its name is a new round; the one
 *  predicate the forward a settled table offers and the next turn's checks of that press share. */
const isNewRound = (name: string, context: unknown): boolean =>
  (typeof context === 'object' && context !== null && (context as { newRound?: unknown }).newRound === true) || NEW_ROUND_ACTION.test(name)

/** A Button whose press is a new round (`isNewRound`), in either action form. */
function offersNextRound(comp: A2uiComponent): boolean {
  if (comp.component !== 'Button') return false
  const a = comp['action'] as { context?: unknown; event?: { context?: unknown } } | undefined
  return isNewRound(actionName(comp), a?.context ?? a?.event?.context)
}

/** The components a surface shows: those reachable from `root` through `children` (a list, or a template's
 *  `componentId`) and `child`. An orphan in the merged map is not on screen. */
function reachable(view: SurfaceView): A2uiComponent[] {
  const seen = new Set<string>()
  const out: A2uiComponent[] = []
  const queue = ['root']
  while (queue.length > 0) {
    const id = queue.shift()!
    const comp = view.components.get(id)
    if (seen.has(id) || comp === undefined) continue
    seen.add(id)
    out.push(comp)
    const kids = comp['children']
    if (Array.isArray(kids)) queue.push(...kids.filter((k): k is string => typeof k === 'string'))
    else if (isRecord(kids) && typeof kids['componentId'] === 'string') queue.push(kids['componentId'])
    if (typeof comp['child'] === 'string') queue.push(comp['child'])
  }
  return out
}

/** T-0350 (round 10 :101): round 1 settled a pontoon on table-2 with its Deal again Button, the checks rejected it,
 *  and the repair sent only `updateDataModel`, so the bare CardTable (no bet strip once settled) shipped with no way
 *  to the next round. A table this turn settles (it reads settled now, and the surface or the table is new this turn
 *  or read another phase before, literal or bound) needs a forward: a new-round Button reachable on a surface this
 *  turn touches, or another touched blackjack-family surface whose CardTable has opened the next round (its phase
 *  resolves to betting or playing, as a Deal again answer that closes table-1 and opens table-2 does). */
function dealAgainMissing(surfaces: readonly SurfaceView[], round: number | undefined): SemanticFinding[] {
  if (surfaces.some((view) => reachable(view).some(offersNextRound))) return []
  const opened = (view: SurfaceView): boolean =>
    !namesOtherGame([...view.components.values()]) &&
    reachable(view).some((c) => c.component === 'CardTable' && ['betting', 'playing'].includes(stringProp(view, c, 'phase')))
  const findings: SemanticFinding[] = []
  for (const view of surfaces) {
    if (namesOtherGame([...view.components.values()]) || surfaces.some((other) => other !== view && opened(other))) continue
    for (const table of reachable(view)) {
      if (table.component !== 'CardTable' || phaseOf(table, view.dataModel) !== 'settled') continue
      const before = view.priorComponents?.get(table.id)
      if (before !== undefined && phaseOf(before, view.priorDataModel) === 'settled') continue
      findings.push({
        code: 'DEAL_AGAIN_MISSING',
        path: `${view.surfaceId}:${table.id}`,
        message:
          `${view.surfaceId}'s ${table.id} is settled, and the surface holds no Deal again Button, so the player has no way to the next round. ` +
          `${round !== undefined && round > 0 ? 'Components sent only in an answer the checks rejected never reached the player. ' : ''}` +
          `Send updateComponents for ${view.surfaceId} in this answer: the CardTable with one Deal again Button child whose action carries "context":{"newRound":true}, ` +
          `with the settled updateDataModel (phase "settled" and the bankroll) beside it.`,
      })
    }
  }
  return findings
}

/** T-0172: one bet, one set of bet controls (the CardTable's own strip); T-0233: a playing table offers the moves.
 *  T-0350: a table this turn settles offers Deal again. T-0357: a hold'em opening deals instead of asking the stake. */
export const croupierBetControls: SemanticCheck = {
  id: 'croupier-bet-controls',
  requires: ['CardTable'],
  check: (input) => {
    const turn = betStepTurn(input.surfaces, input.intent)
    return [
      ...input.surfaces.flatMap((view) => [...betControls(view), ...betStepWithoutTable(view, turn), ...movesMissing(view)]),
      ...dealAgainMissing(input.surfaces, input.round),
    ]
  },
}

const DEAL_ACTION = /^(deal|place_?bet|bet|deal_blackjack)$/i
const MOVE_ACTION = /^(hit|stand|double|double_?down)$/i
const PONTOON_MOVE_ACTION = /^(twist|stick|buy(_?card)?)$/i // T-0334: on a pontoon table these settle a round too
const NEW_ROUND_ACTION = /^(deal_?again|new_?round|next_?round)$/i
const finiteNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** A CardTable hand prop's list: a literal list, or the list an absolute `{path}` reads (`undefined` otherwise). */
function handList(table: A2uiComponent, p: Participant, dataModel: unknown): unknown[] | undefined {
  const v = table[`${p}Hand`]
  const list = Array.isArray(v) ? v : bindingPath(v)?.startsWith('/') === true ? readPointer(dataModel, bindingPath(v)!) : undefined
  return Array.isArray(list) ? list : undefined
}

/** T-0211 (Kim's ruling, T-0172): Deal again opens the next round in the betting phase, so the player picks the
 *  stake on the table's own strip. Every CardTable the answer touches must be in betting with empty hands, on the
 *  bankroll the round settled at (the click-time data model). The recorded Haiku 5.5 answer opened table-2 dealt,
 *  at the old 100 stake. A fresh surface or the clicked one reset in place both pass; an answer with no CardTable
 *  (a poker hand on a Card) is never judged, and an answer with no surface at all is ACTION_NOT_APPLIED. */
function newRoundFindings(surfaces: readonly SurfaceView[], action: SemanticAction): SemanticFinding[] {
  const touched = surfaces.flatMap((view) => [...view.components.values()].filter((c) => c.component === 'CardTable').map((table) => ({ view, table })))
  // A table on a new surface is the next round, and the clicked one beside it is history (a closing touch).
  const fresh = touched.filter(({ view }) => view.surfaceId !== action.surfaceId)
  const tables = fresh.length > 0 ? fresh : touched
  // A new round on a surface with no CardTable is another game's (a poker hand on a Card): not judged here.
  if (surfaces.length > 0 && tables.length === 0) return []
  if (tables.length === 0)
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${action.surfaceId}:${action.name}`,
        message:
          `The player pressed ${action.name} to start the next round, and this turn opens no table. ` +
          `Create the next round's surface: for blackjack, one CardTable in phase "betting" with empty /dealerHand and /playerHand, the settled bankroll and "betAction":"deal"; ` +
          `for poker, one Card with the dealt PlayingCard hands, the settled bankroll and the hand's moves as Buttons.`,
      },
    ]
  const settledBankroll = finiteNumber((action.dataModel as Record<string, unknown> | undefined)?.['bankroll'])
  const findings: SemanticFinding[] = []
  for (const { view, table } of tables) {
    const dealt = PARTICIPANTS.filter((p) => (handList(table, p, view.dataModel)?.length ?? 0) > 0)
    const phase = phaseOf(table, view.dataModel)
    // T-0323: a poker hand opens dealt, so another game's table is judged by the bet controls check alone.
    if ((phase !== 'betting' || dealt.length > 0) && !namesOtherGame([...view.components.values()]))
      findings.push({
        code: 'NEW_ROUND_NOT_BETTING',
        path: `${view.surfaceId}:${table.id}`,
        message:
          `The player pressed ${action.name} for a new round, but ${view.surfaceId}'s ${table.id} opens ${phase === 'betting' ? 'in betting' : `in phase "${phase}"`}` +
          `${dealt.length > 0 ? ` with cards already in ${dealt.map((p) => `/${p}Hand`).join(' and ')}` : ''}. ` +
          `A new round starts in phase "betting" with empty /dealerHand and /playerHand and "betAction":"deal": the player picks the stake on the table's bet strip, never the old bet.`,
      })
    const path = bindingPath(table['bankroll'])
    const opened = path === undefined ? finiteNumber(table['bankroll']) : finiteNumber(readPointer(view.dataModel, path))
    // T-0371: a poker hand opens with its blinds out of the bankroll, judged by POKER_CHIPS_MISMATCH instead.
    if (settledBankroll !== undefined && opened !== undefined && opened !== settledBankroll && !isPokerTable(view))
      findings.push({
        code: 'BANKROLL_MISMATCH',
        path: `${view.surfaceId}:${path ?? table.id}`,
        message: `The round settled with a bankroll of ${settledBankroll}, and the next table opens on ${opened}. Carry the settled bankroll over: write ${settledBankroll}.`,
      })
  }
  return findings
}

/** T-0172 (the live probe on f6f94f7f): a table action must move the table, and a deal must take the bet out of
 *  the bankroll. Haiku 5.5 answered a 50 press with prose ("dealt you 9 and 7 for 16") and no update, so the
 *  table stayed in betting; Sonnet 5.5 dealt and wrote a bankroll of 500 from 1,000 after a 50 bet. */
function actionApplied(surfaces: readonly SurfaceView[], action: SemanticAction): SemanticFinding[] {
  if (isNewRound(action.name, action.context)) return newRoundFindings(surfaces, action)
  const deal = DEAL_ACTION.test(action.name)
  const view = surfaces.find((v) => v.surfaceId === action.surfaceId)
  const pontoonMove = view !== undefined && gameRules(view).game === 'pontoon' && PONTOON_MOVE_ACTION.test(action.name)
  if (!deal && !MOVE_ACTION.test(action.name) && !pontoonMove) return []
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
  const rules = gameRules(view)
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
      // T-0324: a deal settles only on a natural; otherwise the payout repair would endorse a round that never ended.
      const early = deal ? settledWithoutNatural(view, table) : undefined
      if (early !== undefined) {
        findings.push(early)
        continue
      }
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
          `Settlement later pays the bet back with the winnings (2x the bet for a win, ${rules.naturalMultiplier}x for a natural, ` +
          `${rules.bankerWinsTies ? 'nothing for a tie, which the dealer wins' : '1x for a push'}).`,
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

/** What a settled round pays back on a stake already taken out at the deal: 2x on a win, the game's natural
 *  multiplier on a natural (2.5x, or 3x in pontoon), the stake on a push (a loss in pontoon, where the banker
 *  wins every tie), nothing on a loss, with the result in words for the repair sentence. A pontoon five-card
 *  trick pays like a natural and beats everything but a banker pontoon; the banker's beats all but a pontoon. */
function payout(player: readonly Card[], dealer: readonly Card[], stake: number, rules: GameRules): { amount: number; result: string } {
  const p = bestTotal(player)
  const d = bestTotal(dealer)
  const trick = (cards: readonly Card[], total: number): boolean => rules.fiveCardTrick && cards.length >= 5 && total <= 21
  if (p > 21) return { amount: 0, result: `a bust (${p})` }
  if (isNatural(player) && !isNatural(dealer)) return { amount: stake * rules.naturalMultiplier, result: `${rules.naturalLabel} (${rules.payLabel})` }
  if (isNatural(dealer) && !isNatural(player)) return { amount: 0, result: 'a loss to the dealer\'s natural' }
  if (trick(player, p)) return { amount: stake * rules.naturalMultiplier, result: `a five-card trick (${rules.payLabel})` }
  if (trick(dealer, d)) return { amount: 0, result: `a loss to the dealer's five-card trick (${d})` }
  if (d > 21) return { amount: stake * 2, result: `a win (the dealer bust on ${d})` }
  if (p > d) return { amount: stake * 2, result: `a win (${p} over ${d})` }
  if (p === d) return rules.bankerWinsTies ? { amount: 0, result: `a loss (${rules.tieLabel} at ${p})` } : { amount: stake, result: `a push (${p})` }
  return { amount: 0, result: `a loss (${p} under ${d})` }
}

/** T-0324 (live round 8 :9, Haiku 5.5): the 25 deal dealt A and 9 against 7 and a hole K, called it "Natural
 *  blackjack!" and settled with only Deal again, and BANKROLL_MISMATCH then priced the false settle as a win. A deal
 *  settles the round only when the player or the dealer holds a two-card 21; any other settled deal is
 *  SETTLED_WITHOUT_NATURAL. Hands the check cannot resolve, and a table that names another game (T-0276), are never
 *  judged. */
function settledWithoutNatural(view: SurfaceView, table: A2uiComponent): SemanticFinding | undefined {
  if (namesOtherGame([...view.components.values()])) return undefined
  const player = cardsAt(view.dataModel, bindingPath(table['playerHand']))
  const dealer = cardsAt(view.dataModel, bindingPath(table['dealerHand']))
  if (player === undefined || dealer === undefined || player.length !== 2 || isNatural(player) || isNatural(dealer)) return undefined
  return {
    code: 'SETTLED_WITHOUT_NATURAL',
    path: `${view.surfaceId}:${table.id}`,
    message:
      `The deal settles ${table.id}, but the player's ${describeCards(player)} (${bestTotal(player)}) is not a natural and neither is the dealer's hand: only a two-card 21 (an ace and a ten-value card) settles on the deal. ` +
      `Write phase "playing" with Hit and Stand Buttons, keep the dealer's hole card face down, leave the bankroll at the bet taken out, and state the totals without a result.`,
  }
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
  const rules = gameRules(view)
  // The stake leaves the bankroll at the deal; a double adds one more, and a pontoon buy adds one equal to the
  // original stake, which is the click-time bet less the buys already made (each left a face-down player card).
  const priorBuys = (handList(table, 'player', clickTime)?.filter((c) => isRecord(c) && c['faceDown'] === true).length ?? 0)
  const added = deal ? 0 : /^double/i.test(action.name) ? bet : rules.buy && BUY_ACTION.test(action.name) ? bet / (1 + priorBuys) : 0
  const stake = deal ? bet : bet + added
  const takenNow = deal ? bet : added
  const { amount, result } = payout(player, dealer, stake, rules)
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

/** T-0232 (the recorded Sonnet 5.5 opening, 2026-10-15.jsonl:104): "Let's play blackjack." opened table-1 dealt at
 *  a 50 stake the model picked, with no bet strip. On a say turn, a CardTable on a surface no earlier turn wrote is
 *  the game's first table, and it opens in betting with empty hands unless the user's own words name a stake ("Deal
 *  me in for 100"; a game name such as "21" is not one). A surface that names another game keeps its own opening. */
function openingFindings(surfaces: readonly SurfaceView[], intent: string): SemanticFinding[] {
  if (/\d/.test(intent.replace(new RegExp(BLACKJACK_GAMES.source, 'gi'), ' '))) return []
  const findings: SemanticFinding[] = []
  for (const view of surfaces) {
    if (view.priorDataModel !== undefined) continue // the session already holds this table: not an opening
    const comps = [...view.components.values()]
    if (namesOtherGame(comps)) continue
    for (const table of comps) {
      if (table.component !== 'CardTable') continue
      const dealt = PARTICIPANTS.filter((p) => (handList(table, p, view.dataModel)?.length ?? 0) > 0)
      const phase = phaseOf(table, view.dataModel)
      if (phase === 'betting' && dealt.length === 0) continue
      findings.push({
        code: 'NEW_ROUND_NOT_BETTING',
        path: `${view.surfaceId}:${table.id}`,
        message:
          `The player asked for a game and named no stake, but ${view.surfaceId}'s ${table.id} opens in phase "${phase}"` +
          `${dealt.length > 0 ? ` with cards already in ${dealt.map((p) => `/${p}Hand`).join(' and ')}` : ''}. ` +
          `A game opens in phase "betting" with empty /dealerHand and /playerHand and "betAction":"deal": the player picks the first stake on the table's bet strip, never one you choose.`,
      })
    }
  }
  return findings
}

/** T-0214: the table move a player types ("Bet 50.", "Hit me", "Discard two and draw"), as a lower-case word. */
const TYPED_MOVE = /\b(deal|bet|raise|call|check|fold|hit|stand|double|split|surrender|twist|stick|buy|draw|discard)\b/i

/** T-0214 (the recorded Haiku 5.5 five-card draw, 2026-10-15.jsonl:48): "Bet 50." was answered with a meta-line
 *  targeting table-1 and the showdown in prose, and table-1 kept its Check and Bet. A say turn that names a table
 *  move and declares an open table its target must update that table, or open a new one (the next round).
 *  T-0286 (the recorded Haiku 5.5 Omaha river, round 4 :55): "Check, or call if there is a bet." was answered with
 *  the showdown in prose, no target and no surface. A say turn with no target that sends nothing, and is not a
 *  question, is judged against the latest open table offering a move it names; a settled table offering only
 *  Deal again is never one. */
function typedMoveFindings(surfaces: readonly SurfaceView[], intent: string, target: string | undefined, open: readonly SurfaceView[]): SemanticFinding[] {
  const words = [...intent.matchAll(new RegExp(TYPED_MOVE.source, 'gi'))].map((m) => m[1]!.toLowerCase())
  if (words.length === 0) return []
  let table = target
  if (table === undefined) {
    if (surfaces.length > 0 || /\?\s*$/.test(intent.trim())) return []
    table = open.filter((v) => [...v.components.values()].some((c) => c.component === 'Button' && offersMove(c, v.dataModel, new Set(words)))).at(-1)?.surfaceId
    if (table === undefined) return []
  }
  if (surfaces.some((v) => v.surfaceId === table || (v.priorDataModel === undefined && [...v.components.values()].some((c) => c.component === 'CardTable')))) return []
  return [
    {
      code: 'ACTION_NOT_APPLIED',
      path: `${table}:${words[0]}`,
      message:
        `The player typed "${intent.trim()}" at ${table}, and this turn sends it no update, so the table still shows the old state. ` +
        `Call render_surface with an updateDataModel for ${table}: the new cards, totals, phase, result and bankroll, and the moves the player has now, not only prose.`,
    },
  ]
}

/** T-0265: the words of a say turn that starts a card game ("Let's play Texas hold'em.", "Deal me in"). */
const PLAY_WORDS = /\b(play|deal|start|let'?s|another (game|round|hand))\b/i
/** A say turn that asks to play, not a question about the game (T-0265; T-0368 routes hold'em by it too). */
const asksToPlay = (intent: string): boolean => !/\?\s*$/.test(intent.trim()) && PLAY_WORDS.test(intent)

/** T-0265 (the recorded Haiku 5.5 openings, round 3 texas-holdem and five-card-draw turn 0): "Let's play Texas
 *  hold'em." was dealt in prose ("Your hole cards are A♥ K♦") with no table. A say turn that asks to play a card game,
 *  not a question about one, and declares no target must open a surface; an answer with none is SURFACE_MISSING. */
function openingMissing(surfaces: readonly SurfaceView[], intent: string, target: string | undefined): SemanticFinding[] {
  if (surfaces.length > 0 || target !== undefined || !asksToPlay(intent)) return []
  const game = BLACKJACK_GAMES.exec(intent)?.[1] ?? POKER_GAMES.exec(intent)?.[1]
  if (game === undefined) return []
  return [
    {
      code: 'SURFACE_MISSING',
      path: `opening:${game.toLowerCase()}`,
      message:
        `The player asked to play ${game} and this turn opens no table, so the game exists only in prose. ` +
        `Call render_surface with a createSurface for the game's table (${
          BLACKJACK_GAMES.test(game)
            ? 'one CardTable in phase "betting"'
            : 'one Card with the dealt PlayingCard hands and its Check, Bet and Fold Buttons, never a CardTable'
        }), not only prose.`,
    },
  ]
}

/** T-0172: a table action moves the table, and a deal takes the bet out of the bankroll; T-0211: Deal again opens
 *  the next round in betting; T-0232: a say turn's first table opens in betting too; T-0214: a typed move at an
 *  open table updates it, and T-0286 one typed with no target updates the open table offering it; T-0265: a game
 *  asked for opens a surface. */
export const croupierActionApplied: SemanticCheck = {
  id: 'croupier-action-applied',
  requires: ['CardTable'],
  check: (input) => {
    if (input.action !== undefined) return actionApplied(input.surfaces, input.action)
    if (input.intent === undefined) return []
    return [
      ...openingFindings(input.surfaces, input.intent),
      ...openingMissing(input.surfaces, input.intent, input.target),
      ...typedMoveFindings(input.surfaces, input.intent, input.target, input.open ?? []),
    ]
  },
}

const POKER_GAMES = new RegExp(`\\b(poker|stud|${HOLDEM_WORDS}|omaha|razz|five[- ]card draw|draw poker)\\b`, 'i')
/** A surface whose literal words name a poker game: the gate of the poker-only checks. */
const isPokerView = (view: SurfaceView): boolean => POKER_GAMES.test(literalWords(view.components.values()))
const DRAW_GAMES = /\b(five[- ]card draw|draw poker|triple draw|badugi)\b/i

interface DeckCard {
  /** The card's pointer in the data model, e.g. `/dealerHand/2`. */
  path: string
  rank: string
  suit: string
  faceDown: boolean
}

const cardName = (c: { rank: string; suit: string }): string => `${c.rank} of ${c.suit}`

/** Every card the data model lists: each item of an array whose items all carry a string rank and suit. */
function deckCards(node: unknown, pointer: string, out: DeckCard[], depth = 0): DeckCard[] {
  if (depth > 6) return out
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every((c) => isRecord(c) && typeof c['rank'] === 'string' && typeof c['suit'] === 'string'))
      node.forEach((c: Record<string, unknown>, i) => out.push({ path: `${pointer}/${i}`, rank: c['rank'] as string, suit: c['suit'] as string, faceDown: c['faceDown'] === true }))
    return out
  }
  if (isRecord(node)) for (const [k, v] of Object.entries(node)) deckCards(v, `${pointer}/${k}`, out, depth + 1)
  return out
}

/** CARD_DUPLICATE: a poker deal is one deck, so a rank and suit appear once (Sonnet 5.5 Omaha dealt four face-down
 *  2 of clubs as placeholders). Judged only on a surface that names a poker game; a blackjack shoe holds several decks. */
function duplicateCards(view: SurfaceView): SemanticFinding[] {
  if (!isPokerView(view)) return []
  const seen = new Map<string, DeckCard[]>()
  for (const c of deckCards(view.dataModel, '', [])) {
    const key = cardName(c)
    seen.set(key, [...(seen.get(key) ?? []), c])
  }
  return [...seen.entries()]
    .filter(([, cards]) => cards.length > 1)
    .map(([name, cards]) => ({
      code: 'CARD_DUPLICATE',
      path: `${view.surfaceId}:${cards[0]!.path.replace(/\/\d+$/, '')}`,
      message:
        `${view.surfaceId} deals the ${name} ${cards.length} times (${cards.map((c) => c.path).join(', ')}), but a poker deal is one deck. ` +
        `Deal real, distinct cards, the face-down ones too: a face-down card is the committed card the showdown turns up, never a placeholder.`,
    }))
}

/** HOLE_CARD_CHANGED: on an action turn, a card that was face down on the clicked surface (the click-time data model)
 *  keeps its rank and suit, face down or turned up (Haiku 5.5 Omaha swapped its hole cards mid-hand and settled on
 *  the swap). A draw game's redraw and a new round replace cards, so neither is judged. */
function changedHoleCards(view: SurfaceView, action: SemanticAction): SemanticFinding[] {
  if (view.surfaceId !== action.surfaceId || isNewRound(action.name, action.context)) return []
  if (DRAW_GAMES.test(literalWords(view.components.values()))) return []
  const findings: SemanticFinding[] = []
  for (const before of deckCards(action.dataModel, '', [])) {
    if (!before.faceDown) continue
    const now = readPointer(view.dataModel, before.path)
    if (!isRecord(now) || typeof now['rank'] !== 'string' || typeof now['suit'] !== 'string') continue
    const after = { rank: now['rank'], suit: now['suit'] }
    if (after.rank === before.rank && after.suit === before.suit) continue
    findings.push({
      code: 'HOLE_CARD_CHANGED',
      path: `${view.surfaceId}:${before.path}`,
      message:
        `The card at ${before.path} was dealt face down as the ${cardName(before)} and now reads the ${cardName(after)}. ` +
        `A face-down card is committed at the deal: keep it as the ${cardName(before)}, and turn it up as that same card at the showdown.`,
    })
  }
  return findings
}

/** T-0218: the cards on the table are one committed deck. */
export const croupierDeck: SemanticCheck = {
  id: 'croupier-deck',
  requires: ['PlayingCard'],
  check: (input) =>
    input.surfaces.flatMap((view) => [...duplicateCards(view), ...(input.action === undefined ? [] : changedHoleCards(view, input.action))]),
}

const LOSER = String.raw`(?:your|my|the dealer['’]s|the player['’]s|dealer['’]s|player['’]s|the dealer|the player|dealer|player)?\s*(?:soft|hard)?\s*(\d+)`
const WINNER = String.raw`(\d+)(?:\s*\([^)]*\))?`
/** A result line's comparisons: "18 beats your soft 20", "wins with 19 (10, 5, 4) over the dealer's 18", "16 loses to 18". */
const CLAIMS: readonly { re: RegExp; winnerFirst: boolean }[] = [
  { re: new RegExp(String.raw`${WINNER}\s+beats\s+${LOSER}`, 'gi'), winnerFirst: true },
  { re: new RegExp(String.raw`wins with\s+${WINNER}\s+over\s+${LOSER}`, 'gi'), winnerFirst: true },
  { re: new RegExp(String.raw`${WINNER}\s+loses to\s+${LOSER}`, 'gi'), winnerFirst: false },
]

/** RESULT_CONTRADICTS_CARDS: a CardTable's `result` or `status` line may not claim a lower total beats a higher one or
 *  a bust (over 21) wins, and a surrender ends the hand with no comparison at all (Haiku 5.5 Spanish 21: "You
 *  surrender. Dealer 18 beats your soft 20."). */
function resultClaims(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  for (const table of view.components.values()) {
    if (table.component !== 'CardTable') continue
    for (const prop of ['result', 'status'] as const) {
      const text = resolveProp(table[prop], view.dataModel, undefined)
      if (typeof text !== 'string') continue
      const faults: string[] = []
      let compared = false
      for (const { re, winnerFirst } of CLAIMS) {
        for (const m of text.matchAll(re)) {
          compared = true
          const [a, b] = [Number(m[1]), Number(m[2])]
          const [winner, loser] = winnerFirst ? [a, b] : [b, a]
          if (winner > 21) faults.push(`a bust (${winner}) never wins`)
          else if (loser <= 21 && winner <= loser) faults.push(`${winner} does not beat ${loser}`)
        }
      }
      if (compared && /\bsurrender/i.test(text)) faults.push('a surrender ends the hand with no comparison of totals')
      if (faults.length === 0) continue
      findings.push({
        code: 'RESULT_CONTRADICTS_CARDS',
        path: `${view.surfaceId}:${table.id}.${prop}`,
        message:
          `${table.id}'s ${prop} reads "${text}", but ${faults.join(', and ')}. ` +
          `State the result the cards give: the higher total at 21 or under wins, a bust loses, and a surrender reads "You surrender: half your bet back" with the new bankroll.`,
      })
    }
  }
  return findings
}

const BUY_ACTION = /^buy(_?card)?$/i

/** BUY_CARD_FACE_UP: in Pontoon a bought card is dealt face down (a twist is face up), so a buy press on the clicked
 *  table appends only face-down player cards (Sonnet 5.5 bought a card face up). */
function boughtFaceUp(view: SurfaceView, action: SemanticAction): SemanticFinding[] {
  if (view.surfaceId !== action.surfaceId || !BUY_ACTION.test(action.name)) return []
  if (!gameRules(view).buy) return []
  const findings: SemanticFinding[] = []
  for (const table of view.components.values()) {
    if (table.component !== 'CardTable') continue
    const before = handList(table, 'player', action.dataModel)?.length
    const now = handList(table, 'player', view.dataModel)
    if (before === undefined || now === undefined) continue
    const where = bindingPath(table['playerHand'])
    now.forEach((card, i) => {
      if (i < before || (isRecord(card) && card['faceDown'] === true)) return
      findings.push({
        code: 'BUY_CARD_FACE_UP',
        path: `${view.surfaceId}:${where === undefined ? table.id : `${where}/${i}`}`,
        message: `The player bought a card, and ${where ?? table.id} deals it face up. In Pontoon a bought card is dealt face down ("faceDown":true); only a twist is dealt face up.`,
      })
    })
  }
  return findings
}

const SHOWDOWN = /(?<![\w-])showdown(?![\w-])/i
const OPPONENT_PATH = /opponent|dealer|house|villain|rival/i
const RESULT_WORDS = /\b(wins?|won|lose[sd]?|lost|beats?|split|ties?|tied|push|chop)\b/i

/** A component's string prop, literal or bound. */
const stringProp = (view: SurfaceView, c: A2uiComponent, key: string): string => {
  const v = resolveProp(c[key], view.dataModel, undefined)
  return typeof v === 'string' ? v : ''
}

/** SHOWDOWN_UNSETTLED (T-0346; round 10 :108, Haiku 5.5 Omaha): a poker table at the showdown settles in the turn it
 *  reaches it. The showdown is a Badge label, or a CardTable phase or status (literal or bound), reading the word
 *  "showdown" ("Pre-showdown" is a street before). The table is unsettled when the opponent's hand is missing, empty or
 *  all face down in the data model, or no text on the surface states a result. A settled showdown gives none, whatever
 *  its Buttons say. */
function showdownUnsettled(view: SurfaceView): SemanticFinding[] {
  if (!isPokerView(view)) return []
  const comps = [...view.components.values()]
  const at = comps.find((c) =>
    c.component === 'Badge' ? SHOWDOWN.test(stringProp(view, c, 'label')) : c.component === 'CardTable' && (SHOWDOWN.test(stringProp(view, c, 'phase')) || SHOWDOWN.test(stringProp(view, c, 'status'))),
  )
  if (at === undefined) return []
  const opponent = deckCards(view.dataModel, '', []).filter((c) => OPPONENT_PATH.test(c.path))
  const hidden = opponent.length === 0 || opponent.every((c) => c.faceDown)
  const stated = comps.some((c) => ['text', 'label', 'title', 'status', 'result'].some((k) => RESULT_WORDS.test(stringProp(view, c, k))))
  if (!hidden && stated) return []
  return [
    {
      code: 'SHOWDOWN_UNSETTLED',
      path: `${view.surfaceId}:${at.id}`,
      message:
        `${view.surfaceId} is at the showdown but ${hidden ? "the opponent's hand is still hidden" : 'no result is stated'}. Reveal the opponent's hand in this turn: put its cards face up in the data model, ` +
        `state who wins and the new bankroll, and offer Deal again.`,
    },
  ]
}

const CHIPS_IN = /^(bet|raise|call)/i
const POKER_MOVES: ReadonlySet<string> = new Set(['check', 'call', 'raise', 'fold'])
const STUD_GAMES = /\b(stud|razz)\b/i
/** A pointer that names the player's own blind, ante or post (`/playerBlind`, `/blinds/player`, `/heroAnte`). */
const PLAYER_POST_PATH = /(player|hero|you).*(blind|ante|post)|(blind|ante|post).*(player|hero|you)/i
const PLAYER_POST_TEXT = /\byou(?:'ve| have)? posted\b|\byour (?:big |small )?(?:blind|ante)\b|\byou(?:'re| are) (?:the )?(?:big|small) blind\b/i
const NOT_OPPONENT_LIST = /player|hero|you|board|community|flop|turn|river/i
const SETTLED_STATE = /\b(settled|showdown)\b/i

/** A chip count: a finite number, or a numeric string ("990", "$60", "1,060"). */
function chipNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const m = typeof v === 'string' ? /^\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*$/.exec(v) : null
  return m === null ? undefined : Number(m[1]!.replaceAll(',', ''))
}

/** Where a poker surface keeps its bankroll and pot: the CardTable's bound `bankroll`, and its bound `pot` (or a `bet`
 *  bound to a pot path), else `/bankroll` and `/pot`. */
function chipPaths(view: SurfaceView): { bankroll: string; pot: string } {
  const table = [...view.components.values()].find((c) => c.component === 'CardTable')
  const absolute = (p: string | undefined): string | undefined => (p?.startsWith('/') === true ? p : undefined)
  const bet = absolute(bindingPath(table?.['bet']))
  return {
    bankroll: absolute(bindingPath(table?.['bankroll'])) ?? '/bankroll',
    pot: absolute(bindingPath(table?.['pot'])) ?? (bet !== undefined && /pot/i.test(bet) ? bet : '/pot'),
  }
}

/** A poker table, not just the word: the surface names a poker game and shows PlayingCards, offers a poker move
 *  (check, call, raise or fold), or keeps a pot. A blackjack table whose words happen to say poker is none. */
function isPokerTable(view: SurfaceView): boolean {
  if (!isPokerView(view)) return false
  const comps = [...view.components.values()]
  if (comps.some((c) => c.component === 'PlayingCard' || (c.component === 'Button' && offersMove(c, view.dataModel, POKER_MOVES)))) return true
  const pot = chipPaths(view).pot
  return pot !== '/pot' || chipNumber(readPointer(view.dataModel, pot)) !== undefined
}

/** The turn settles the hand: a ResultCard or a text naming a result, a `/phase` or `/status` reading settled or
 *  showdown. A settle may hold a final call or an all-in run-out, which a turn-local prior cannot price. */
function settlesHand(view: SurfaceView): boolean {
  const comps = [...view.components.values()]
  if (comps.some((c) => c.component === 'ResultCard' || ['text', 'label', 'title', 'status', 'result'].some((k) => RESULT_WORDS.test(stringProp(view, c, k))))) return true
  return ['/phase', '/status'].some((p) => { const v = readPointer(view.dataModel, p); return typeof v === 'string' && SETTLED_STATE.test(v) })
}

/** The player posted into a new hand's pot: a data-model pointer or surface words naming the player's blind or ante,
 *  or a heads-up blind game (one opponent hand, not stud), where both sides post every hand. */
function playerPosted(view: SurfaceView): boolean {
  const posts = (node: unknown, pointer: string, depth: number): boolean =>
    isRecord(node) && depth < 4
      ? Object.entries(node).some(([k, v]) => {
          const at = `${pointer}/${k}`
          return (PLAYER_POST_PATH.test(at) && (chipNumber(v) ?? 0) > 0) || posts(v, at, depth + 1)
        })
      : false
  if (posts(view.dataModel, '', 0)) return true
  const words = literalWords(view.components.values())
  if (PLAYER_POST_TEXT.test(words)) return true
  if (STUD_GAMES.test(words)) return false
  const opponents = new Set(deckCards(view.dataModel, '', []).map((c) => c.path.replace(/\/\d+$/, '')).filter((list) => !NOT_OPPONENT_LIST.test(list)))
  return opponents.size === 1
}

/** The chips the player's move puts in when the turn says so exactly: a pressed bet or call's `amount`, a raise's
 *  increment (`raiseBy`, `by` or `increment`; a raise `amount` is a raise-to), or the one number of a typed bet or call. */
function certainChips(move: string, action: SemanticAction | undefined, intent: string | undefined): number | undefined {
  if (action !== undefined) {
    const ctx = action.context
    if (/^raise/i.test(move)) return chipNumber(ctx['raiseBy']) ?? chipNumber(ctx['by']) ?? chipNumber(ctx['increment'])
    return chipNumber(ctx['amount'])
  }
  const numbers = (intent ?? '').match(/\d[\d,]*/g)
  return /^(bet|call)/i.test(move) && numbers?.length === 1 ? chipNumber(numbers[0]) : undefined
}

/** POKER_CHIPS_MISMATCH (T-0371; round 11 :139 to :146, Haiku 5.5 Omaha): a poker table's chips move between the
 *  bankroll and the pot, never out of thin air. Read through the table's bankroll and pot bindings (`chipPaths`)
 *  against the surface's prior data model (the click-time one on an action turn), on the player's move: the press,
 *  or the one move word a typed turn holds (a turn with two moves or a condition, "Check, or call if there is a bet.",
 *  is never judged). A bet, raise or call that grows the pot takes the player's chips out of the bankroll (:141 bet
 *  the pot, 20 to 60, and left 990); a fold never raises the bankroll; a new hand the player posted into opens below
 *  the bankroll the last hand settled at (:144 and :146 posted 10 and opened on 960). A turn that settles the hand is
 *  not judged for its move: one turn may hold a final call or a run-out, and a turn-local prior cannot tell. */
function pokerChips(view: SurfaceView, input: SemanticCheckInput): SemanticFinding[] {
  if (!isPokerTable(view)) return []
  const paths = chipPaths(view)
  const chips = (model: unknown) => ({ bankroll: chipNumber(readPointer(model, paths.bankroll)), pot: chipNumber(readPointer(model, paths.pot)) })
  const { bankroll, pot } = chips(view.dataModel)
  if (bankroll === undefined || pot === undefined) return []
  const { action } = input
  const finding = (message: string): SemanticFinding[] => [{ code: 'POKER_CHIPS_MISMATCH', path: `${view.surfaceId}:${paths.bankroll}`, message }]
  if (action !== undefined && isNewRound(action.name, action.context)) {
    // The pressed table reset in place, or a new surface that replaces it; a surface with no dealt hand is a recap.
    if (view.surfaceId !== action.surfaceId && view.priorDataModel !== undefined) return []
    if (!deckCards(view.dataModel, '', []).some((c) => /player|hero|you/i.test(c.path))) return []
    const settled = chips(action.dataModel).bankroll
    if (settled === undefined || settled <= 0 || pot <= 0 || bankroll < settled || !playerPosted(view)) return []
    return finding(
      `The last hand settled with a bankroll of ${settled}, and ${view.surfaceId} opens with ${pot} in the pot but the bankroll at ${bankroll}. ` +
        `The blind or ante the player posts leaves the bankroll as it enters the pot: write ${settled} less what the player posted.`,
    )
  }
  let move = action?.name
  if (action === undefined) {
    const words = [...(input.intent ?? '').matchAll(new RegExp(TYPED_MOVE.source, 'gi'))]
    if (words.length !== 1 || /\b(if|or)\b/i.test(input.intent ?? '')) return []
    move = words[0]![1]
  }
  const prior = chips(view.priorDataModel ?? (action?.surfaceId === view.surfaceId ? action.dataModel : undefined))
  if (move === undefined || prior.bankroll === undefined || prior.pot === undefined) return []
  if (/^fold/i.test(move) && bankroll > prior.bankroll)
    return finding(
      `The player folds, and the bankroll rises from ${prior.bankroll} to ${bankroll}. A fold wins nothing: the chips already in the pot stay there, so write ${prior.bankroll}.`,
    )
  if (!CHIPS_IN.test(move) || pot <= prior.pot || bankroll !== prior.bankroll || settlesHand(view)) return []
  const put = certainChips(move, action, input.intent)
  return finding(
    `The player's ${move.toLowerCase()} grows the pot from ${prior.pot} to ${pot}, and the bankroll still reads ${bankroll}. The chips the player puts in leave the bankroll: ` +
      `${put === undefined ? "lower it by the player's own chips this turn, never the opponent's" : `write ${prior.bankroll - put}`}, and keep the pot and the bankroll in step on every street.`,
  )
}

/** T-0219: what the Croupier states agrees with the cards and the game's rules; T-0371: a poker table's chips agree. */
export const croupierRules: SemanticCheck = {
  id: 'croupier-rules',
  requires: ['CardTable'],
  check: (input) =>
    input.surfaces.flatMap((view) => [
      ...resultClaims(view),
      ...showdownUnsettled(view),
      ...pokerChips(view, input),
      ...(input.action === undefined ? [] : boughtFaceUp(view, input.action)),
    ]),
}

export const croupierSemanticChecks: readonly SemanticCheck[] = [croupierHandConsistency, croupierBetControls, croupierActionApplied, croupierDeck, croupierRules]
