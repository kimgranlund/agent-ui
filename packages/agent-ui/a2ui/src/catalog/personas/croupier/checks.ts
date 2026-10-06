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
//
// A hand container is a component whose children are PlayingCards: static ids that resolve to
// PlayingCard, or a template whose `componentId` is a PlayingCard. It belongs to `<p>` when its id or its
// template path names `<p>` (and not the other participant). A value the check cannot resolve (a function
// call, a relative path outside a template, an unknown rank) makes that hand indeterminate, never a finding.

import type { A2uiComponent } from '../../../protocol.ts'
import { readPointer } from '../../semantic-check.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from '../../semantic-check.ts'

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

/** `dealer`/`player` when exactly one of them is named by `text` (case-insensitive), else `undefined`. */
function participantNamedBy(...texts: string[]): Participant | undefined {
  const joined = texts.join(' ').toLowerCase()
  const named = PARTICIPANTS.filter((p) => joined.includes(p))
  return named.length === 1 ? named[0] : undefined
}

function handContainers(view: SurfaceView): HandContainer[] {
  const out: HandContainer[] = []
  for (const comp of view.components.values()) {
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

function checkSurface(view: SurfaceView): SemanticFinding[] {
  const findings: SemanticFinding[] = []
  const containers = handContainers(view)
  for (const p of PARTICIPANTS) {
    const mine = containers.filter((c) => c.participant === p)
    const listed = listedHand(view, p)
    if (listed !== undefined) {
      for (const c of mine) {
        if (c.rendered === listed.length) continue
        findings.push({
          code: 'HAND_COUNT',
          path: `${view.surfaceId}:${c.id}`,
          message:
            `${c.id} renders ${c.rendered} card${c.rendered === 1 ? '' : 's'} but ${listed.path} lists ${listed.length}. ` +
            `Draw the hand from that list: give ${c.id} "children":{"path":"${listed.path}","componentId":<one PlayingCard>} ` +
            `so the cards shown are the cards listed.`,
        })
      }
    }
    // The total is judged only when exactly one container shows this participant's hand (two would make
    // "which hand does the total belong to" a guess, e.g. a split).
    if (mine.length !== 1) continue
    const cards = mine[0]!.cards
    if (cards === undefined) continue
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
  check: (input) => input.surfaces.flatMap(checkSurface),
}

export const croupierSemanticChecks: readonly SemanticCheck[] = [croupierHandConsistency]
