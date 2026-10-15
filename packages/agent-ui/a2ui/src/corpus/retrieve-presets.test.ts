// T-0238 ranking pin: the top 3 exemplars the shipped agent-ui shard yields for each shipped preset on one
// representative user turn. The effective catalog id is the preset's `localPatterns` persona (`agent-ui--<id>`) or the
// base; `site/pages/agent-admin-presets.ts` owns that table and sits above this package, so it is restated here.
// Round 2 traces showed zero-score padding (agent-roster-drawer, agent-task-status) on Croupier and Admiral turns and
// no hospitality composite on Concierge turns; this pin holds the fix. A shard change that moves a pin is a deliberate
// re-pin, read against the turn it names. T-0240 re-pinned after admitting the domain seeds (a croupier, concierge,
// lexicographer and admiral turn now each rank its own composite first) and three frontier seeds. T-0253 re-pinned
// croupier and quizmaster after the games family rule: another game's board no longer ranks on a card table's turn.
// T-0268 adds the Lexicographer's opening turns, which reach the word board through its prompt's "word game".
// T-0273 adds croupier "Hit" turns: another game's board is out of scope on a card table's turn.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { retrieve } from './retrieve.ts'
import type { CorpusRecord } from './record.ts'
import { CATALOG_LAYER_MAP } from '../catalog/layers.ts'
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

/** The effective catalog's types: the default catalog's rows plus the persona fragment's. */
function typesOf(catalogId: string): string[] {
  const { tail } = splitCatalogId(catalogId)
  const home = tail === undefined ? undefined : `personas/${tail}`
  return Object.entries(CATALOG_LAYER_MAP).filter(([, r]) => r.home === 'default' || r.home === home).map(([t]) => t)
}

const PINS: readonly (readonly [preset: string, catalogId: string, turn: string, top: readonly string[]])[] = [
  ['croupier', 'agent-ui--croupier', 'Deal again', ['domain-croupier-card-table-round', 'frontier-round-outcome']],
  ['concierge', 'agent-ui--concierge', 'Book me a spa treatment for tomorrow afternoon', ['domain-concierge-booking-request', 'frontier-service-gateway', 'invite-decline-then-focus-block']],
  ['quizmaster', 'agent-ui--quizmaster', 'Next question please', ['trivia-round-resume', 'frontier-round-outcome', 'card-layouts']],
  ['stylist', 'agent-ui--stylist', 'Check the contrast of my brand palette', ['brand-palette', 'booking-reservation', 'ops-report']],
  ['quant', 'agent-ui', 'Show me the KPI dashboard for last quarter', ['card-layouts', 'frontier-booking-receipt', 'frontier-column-chart-revenue']],
  ['restaurant', 'agent-ui', 'What is on the menu tonight', ['travel-itinerary', 'frontier-review-split', 'frontier-result-card-win']],
  ['travel', 'agent-ui', 'Plan a three day trip itinerary to Lisbon', ['frontier-trip-card', 'structured-container-trip-summary', 'comparison-pricing-table']],
  ['curator', 'agent-ui', 'Show me the highlights of the collection', ['customer-review-card', 'slideshow-gallery', 'five-day-weather']],
  ['shopkeeper', 'agent-ui', 'Show me the product options', ['frontier-choice-group-rooms', 'frontier-column-chart-revenue', 'frontier-product-card-rooms']],
  ['mentalist', 'agent-ui', 'Read my mind', ['domain-lexicographer-word-board', 'wallet-summary-card', 'frontier-button-icon-actions']],
  ['negotiator', 'agent-ui', 'I offer 200 for it', ['frontier-suggestions-chips', 'frontier-booking-receipt', 'plan-and-execute-plan']],
  ['lexicographer', 'agent-ui', 'My guess is CRANE', ['domain-lexicographer-word-board', 'frontier-button-icon-actions', 'frontier-pane-switcher']],
  ['admiral', 'agent-ui', 'Fire at B3', ['domain-admiral-battleship-board', 'frontier-product-card-rooms', 'restaurant-menu']],
  ['alchemist', 'agent-ui', 'Mix the two elements', ['media-file-grid', 'list-nested', 'pattern-settings-form']],
  ['dungeon-master', 'agent-ui', 'I open the door and look around', ['frontier-game-hud-quest', 'frontier-service-gateway', 'backable-wizard']],
]

describe('retrieve: the shipped-preset ranking pin (T-0238)', () => {
  it.each(PINS)('%s (%s) on "%s"', (_preset, catalogId, turn, top) => {
    const got = retrieve(shard, { intent: turn, k: 3, catalogId, protocolVersion: 'v1.0', componentTypes: typesOf(catalogId) })
    expect(got.map((r) => r.name)).toEqual(top)
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
