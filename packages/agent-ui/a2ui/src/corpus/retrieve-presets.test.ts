// T-0238 ranking pin: the top 3 exemplars the shipped agent-ui shard yields for each shipped preset on one
// representative user turn. The effective catalog id is the preset's `localPatterns` persona (`agent-ui--<id>`) or the
// base; `site/pages/agent-admin-presets.ts` owns that table and sits above this package, so it is restated here.
// Round 2 traces showed zero-score padding (agent-roster-drawer, agent-task-status) on Croupier and Admiral turns and
// no hospitality composite on Concierge turns; this pin holds the fix. A shard change that moves a pin is a deliberate
// re-pin, read against the turn it names. T-0197: the concierge and restaurant compose the hospitality domain
// (`agent-ui--hospitality`). T-0240 re-pinned after admitting the domain seeds (a croupier, concierge,
// lexicographer and admiral turn now each rank its own composite first) and three frontier seeds. T-0253 re-pinned
// croupier and quizmaster after the games family rule: another game's board no longer ranks on a card table's turn.
// T-0268 adds the Lexicographer's opening turns, which reach the word board through its prompt's "word game".
// T-0273 adds croupier "Hit" turns: another game's board is out of scope on a card table's turn.
// T-0274 pinned the Lexicographer give-up turns: the game-over exemplar (a ResultCard revealing the word) ranks first.
// T-0318: a pin holds only the ranks a reader can defend for its turn and compares that prefix; the ranks after it are
// known poor (zero-signal padding off the turn's domain) and are named in a comment on the row, never pinned as correct.
// T-0315: each pin passes the preset's hidden-state keys; the Mentalist row moved to the T-0315 describe (no board frames).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { retrieve, committedSecretKeys, secretKeysNamedIn } from './retrieve.ts'
import type { CorpusRecord } from './record.ts'
import { CATALOG_LAYER_MAP } from '../catalog/layers.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { splitCatalogId } from '../catalog/catalog-id.ts'

declare const process: { cwd(): string }

// T-0240: the shard family the live retrievers load (`tools/corpus/exemplar-shards.ts`): `agent-ui.jsonl` plus every
// persona shard `agent-ui--<persona>.jsonl`, so a croupier or concierge turn can surface its own composite.
const SHARD_DIR = `${process.cwd()}/packages/agent-ui/a2ui/corpus/exemplar/v1_0`
const shard = (readdirSync(SHARD_DIR) as string[])
  .filter((f) => f === 'agent-ui.jsonl' || (f.startsWith('agent-ui--') && f.endsWith('.jsonl')))
  .sort()
  .flatMap((f) => (readFileSync(`${SHARD_DIR}/${f}`, 'utf8') as string).split('\n'))
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as CorpusRecord)

/** The effective catalog's types: the default catalog's plus the persona fragment's or (T-0197) each domain's rows. */
function typesOf(catalogId: string): string[] {
  const { tail } = splitCatalogId(catalogId)
  const homes = tail === undefined ? [] : [`personas/${tail}`, ...tail.split('+').map((d) => `domains/${d}`)]
  return [...Object.keys(defaultCatalog.components), ...Object.entries(CATALOG_LAYER_MAP).filter(([, r]) => homes.includes(r.home)).map(([t]) => t)]
}

// T-0315: the `/secret/<key>` names each shipped preset's foundation declares, read from the persona rows of the
// generated agent-content registry (`site/agent-content/registry.gen.ts`, T-0160; a persona's foundation is its body
// up to the first `## ` heading). The package sits below the site, so the rows are parsed, not imported, through the
// same `secretKeysNamedIn` `produce()` applies. A preset absent from the table declares none.
const REGISTRY_SRC = readFileSync(`${process.cwd()}/site/agent-content/registry.gen.ts`, 'utf8') as string
const HIDDEN_STATE: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  REGISTRY_SRC.split('\n')
    .filter((l) => l.startsWith('  {"kind":"persona"'))
    .map((l) => JSON.parse(l.trim().replace(/,$/, '')) as { id: string; body: string })
    .map(({ id, body }) => [id, secretKeysNamedIn(body.split(/^## /m)[0]!)]),
)
const hiddenStateOf = (preset: string): readonly string[] => HIDDEN_STATE[preset] ?? []

const PINS: readonly (readonly [preset: string, catalogId: string, turn: string, top: readonly string[]])[] = [
  ['croupier', 'agent-ui--croupier', 'Deal again', ['domain-croupier-card-table-round', 'frontier-round-outcome']],
  ['concierge', 'agent-ui--hospitality', 'Book me a spa treatment for tomorrow afternoon', ['domain-concierge-booking-request', 'frontier-service-gateway', 'invite-decline-then-focus-block']],
  ['quizmaster', 'agent-ui--quizmaster', 'Next question please', ['trivia-round-resume', 'frontier-round-outcome', 'card-layouts']],
  ['stylist', 'agent-ui--stylist', 'Check the contrast of my brand palette', ['brand-palette', 'booking-reservation', 'ops-report']],
  // Known poor (T-0318): rank 3 is frontier-product-card-rooms, a room-booking card on a KPI turn.
  ['quant', 'agent-ui', 'Show me the KPI dashboard for last quarter', ['card-layouts', 'frontier-column-chart-revenue']],
  // Known poor (T-0197): the hospitality domain's own records rank first by the T-0238 rule (a ServiceCard gateway, the
  // booking request) on a menu turn, since no menu exemplar is in the domain; pinned so a domain shard change re-pins.
  ['restaurant', 'agent-ui--hospitality', 'What is on the menu tonight', ['frontier-service-gateway', 'domain-concierge-booking-request', 'travel-itinerary']],
  ['travel', 'agent-ui', 'Plan a three day trip itinerary to Lisbon', ['frontier-trip-card', 'structured-container-trip-summary', 'comparison-pricing-table']],
  // Known poor (T-0318): rank 3 is frontier-product-card-rooms, off the collection domain.
  ['curator', 'agent-ui', 'Show me the highlights of the collection', ['customer-review-card', 'slideshow-gallery']],
  ['shopkeeper', 'agent-ui', 'Show me the product options', ['frontier-choice-group-rooms', 'frontier-column-chart-revenue', 'frontier-product-card-rooms']],
  // Known poor (T-0318): ranks 2 and 3 are plan-and-execute-plan and the expense-claim receipt, neither an offer surface.
  ['negotiator', 'agent-ui', 'I offer 200 for it', ['frontier-suggestions-chips']],
  ['lexicographer', 'agent-ui', 'My guess is CRANE', ['domain-lexicographer-word-board', 'frontier-button-icon-actions', 'frontier-pane-switcher']],
  // Known poor (T-0318): rank 2 is the expense-claim receipt, matched on the bare "I" of its prompt.
  ['lexicographer', 'agent-ui', 'I give up.', ['domain-lexicographer-game-over']],
  ['lexicographer', 'agent-ui', 'Show me the word.', ['domain-lexicographer-game-over', 'domain-lexicographer-word-board', 'frontier-product-card-rooms']],
  ['admiral', 'agent-ui', 'Fire at B3', ['domain-admiral-battleship-board', 'frontier-product-card-rooms', 'restaurant-menu']],
  ['alchemist', 'agent-ui', 'Mix the two elements', ['media-file-grid', 'list-nested', 'pattern-settings-form']],
  // Known poor (T-0335): rank 3 is plan-and-execute-plan, off the quest domain (it was the then hotel wizard); pinned so a
  // shard change that moves it is a deliberate re-pin.
  ['dungeon-master', 'agent-ui', 'I open the door and look around', ['frontier-game-hud-quest', 'frontier-service-gateway', 'plan-and-execute-plan']],
]

describe('retrieve: the shipped-preset ranking pin (T-0238)', () => {
  it.each(PINS)('%s (%s) on "%s"', (preset, catalogId, turn, top) => {
    const got = retrieve(shard, { intent: turn, k: 3, catalogId, protocolVersion: 'v1.0', componentTypes: typesOf(catalogId), hiddenState: hiddenStateOf(preset) })
    expect(got.slice(0, top.length).map((r) => r.name)).toEqual(top)
  })
})

// T-0318: the rulings forbid a booking read-back before the confirm (T-0266: the BookingForm pre-filled; T-0289: the
// confirm settles as a BookingConfirmation), so a confirm turn must not retrieve the receipt exemplar. Before T-0318 the
// first phrasing ranked the then hotel read-back third on the Concierge and first on the base catalog.
describe('retrieve: a booking confirm turn does not surface the receipt exemplar (T-0318)', () => {
  const turns = ['Yes that works, show me the summary so I can confirm', 'Those details are right, please confirm the booking.']
  it.each(['agent-ui--hospitality', 'agent-ui'].flatMap((c) => turns.map((t) => [c, t] as const)))('%s on "%s"', (catalogId, turn) => {
    const got = retrieve(shard, { intent: turn, k: 5, catalogId, protocolVersion: 'v1.0', componentTypes: typesOf(catalogId) })
    expect(got.map((r) => r.name)).not.toContain('frontier-booking-receipt')
  })
})

// T-0335: the same rulings, for the two records that read a booking back before its confirm. Before T-0335
// confirmation-view (a dinner reservation summary with Confirm) ranked first on the base catalog and third on the
// Concierge for the summary turns, and backable-wizard (a hotel stay wizard ending in "Confirm booking") ranked first
// on the base catalog and third on the Concierge for the book-it turns.
describe('retrieve: a booking confirm turn does not surface a read-back exemplar (T-0335)', () => {
  const turns = [
    'Yes that works, show me the summary so I can confirm',
    'Those details are right, please confirm the booking.',
    'Everything looks right, show me the final summary of my reservation so I can confirm it.',
    'Book the room for those dates, I want to confirm the stay.',
    'Go ahead and book it',
  ]
  it.each(['agent-ui--hospitality', 'agent-ui'].flatMap((c) => turns.map((t) => [c, t] as const)))('%s on "%s"', (catalogId, turn) => {
    const got = retrieve(shard, { intent: turn, k: 5, catalogId, protocolVersion: 'v1.0', componentTypes: typesOf(catalogId) })
    expect(got.map((r) => r.name).filter((n) => n === 'confirmation-view' || n === 'backable-wizard')).toEqual([])
  })
})

// T-0253: within the games domain a preset's own composite family leads; the T-0240 verifier found croupier's
// "Deal again" ranking two boards behind the CardTable and quizmaster getting the same two boards first.
describe('retrieve: a games preset ranks its own composite family first (T-0253)', () => {
  const top3 = (catalogId: string, turn: string): CorpusRecord[] =>
    retrieve(shard, { intent: turn, k: 3, catalogId, protocolVersion: 'v1.0', componentTypes: typesOf(catalogId) })
  const uses = (r: CorpusRecord, type: string): boolean => (r.meta.componentsUsed ?? []).includes(type)

  it('croupier: the CardTable leads and no BoardGrid is in the top 3', () => {
    const got = top3('agent-ui--croupier', 'Deal again')
    expect(uses(got[0]!, 'CardTable')).toBe(true)
    expect(got.filter((r) => uses(r, 'BoardGrid')).map((r) => r.name)).toEqual([])
  })

  // T-0273: "hit" is Battleship vocabulary too; another game's board is out of scope on a card table's turn.
  it.each(['Hit me again.', 'Hit.', 'Hit me until I bust.'])('croupier "%s": the CardTable leads and no BoardGrid is in the top 3', (turn) => {
    const got = top3('agent-ui--croupier', turn)
    expect(got[0]!.name).toBe('domain-croupier-card-table-round')
    expect(got.filter((r) => uses(r, 'BoardGrid')).map((r) => r.name)).toEqual([])
  })

  it.each([
    ['lexicographer', 'My guess is CRANE', 'domain-lexicographer-word-board'],
    ['admiral', 'Fire at B3', 'domain-admiral-battleship-board'],
  ])('%s keeps its own board first', (_preset, turn, board) => {
    expect(top3('agent-ui', turn)[0]!.name).toBe(board)
  })

  // T-0268: the Lexicographer has no domain, so its opening turn finds the word board on vocabulary alone; the
  // record's prompt names the word game so a start-of-game turn shares a term with it.
  it.each(['Start a new word game.', 'New word game, please.'])('lexicographer opening "%s" holds the word board in the top 3', (turn) => {
    expect(top3('agent-ui', turn).map((r) => r.name)).toContain('domain-lexicographer-word-board')
  })

  it('quizmaster: the top 3 is not two boards', () => {
    expect(top3('agent-ui--quizmaster', 'Next question please').filter((r) => uses(r, 'BoardGrid')).length).toBeLessThan(2)
  })
})

// T-0315: the Admiral and the Lexicographer share the base catalog and both games' types, so before T-0315 retrieval
// split them on the turn text alone: "New game of Battleship." ranked the word board first on the Admiral's opening.
// A turn now frames only records whose committed `/secret` keys its persona declares.
describe('retrieve: a game turn never frames another game\'s board (T-0315)', () => {
  const WORD = ['domain-lexicographer-word-board', 'domain-lexicographer-game-over']
  const FLEET = ['domain-admiral-battleship-board']
  const top3 = (preset: string, turn: string): string[] =>
    retrieve(shard, { intent: turn, k: 3, catalogId: 'agent-ui', protocolVersion: 'v1.0', componentTypes: typesOf('agent-ui'), hiddenState: hiddenStateOf(preset) }).map((r) => r.name)

  it.each(['New game', 'New game.', 'Start a new game.', 'Start a new game of Battleship.', 'New game of Battleship.', 'I surrender.', 'Play again'])(
    'admiral "%s" frames no word-game record',
    (turn) => {
      expect(top3('admiral', turn).filter((n) => WORD.includes(n))).toEqual([])
    },
  )

  it('admiral "New game of Battleship." still frames its own board', () => {
    expect(top3('admiral', 'New game of Battleship.')).toContain('domain-admiral-battleship-board')
  })

  it.each(['My guess is CRANE', 'I give up.', 'Show me the word.', 'Start a new word game.', 'New word game, please.', 'New game', 'Play again', 'Fire at B3'])(
    'lexicographer "%s" frames no Battleship record',
    (turn) => {
      expect(top3('lexicographer', turn).filter((n) => FLEET.includes(n))).toEqual([])
    },
  )

  it.each(['Start a new word game.', 'New word game, please.'])('lexicographer opening "%s" still frames the word board', (turn) => {
    expect(top3('lexicographer', turn)).toContain('domain-lexicographer-word-board')
  })

  it('the preset table is read from the real foundations', () => {
    expect(HIDDEN_STATE['lexicographer']).toEqual(['word'])
    expect(HIDDEN_STATE['admiral']).toEqual(['fleet', 'playerFleet'])
    expect(HIDDEN_STATE['mentalist']).toEqual([])
    expect(PINS.every(([preset]) => Object.hasOwn(HIDDEN_STATE, preset))).toBe(true)
  })

  // Known poor (T-0318): the Mentalist's top 3 for "Read my mind" is zero-signal padding for a Twenty Questions HUD
  // (wallet-summary-card, frontier-button-icon-actions, structured-container-trip-summary), so no rank is pinned. T-0315
  // holds only that no record committing hidden state frames: the Mentalist keeps none.
  it('mentalist "Read my mind" frames no record that commits hidden state', () => {
    const got = retrieve(shard, { intent: 'Read my mind', k: 3, catalogId: 'agent-ui', protocolVersion: 'v1.0', componentTypes: typesOf('agent-ui'), hiddenState: hiddenStateOf('mentalist') })
    expect(got.length).toBeGreaterThan(0)
    expect(got.filter((r) => committedSecretKeys(r).length > 0).map((r) => r.name)).toEqual([])
  })
})
