// check-contracts.test.ts: T-0314 (P2 as revised, Kim 2026-10-16). Every shipped `SemanticCheck` carries a pass and a
// fail fixture, and each fixture is cross-run against every check that co-runs with its own on a catalog it rides: a
// fixture must fire only its own check (the fail fixture) or none (the pass fixture). That is the class of the T-0263
// fleet check on a word board and the T-0276 hold'em misfire, caught before a live round does. The co-run sets come
// from the hosts' own assembly (`semanticChecksDeps` over `buildCatalogMap`), never a hand list, so a new check with no
// fixture, or a new catalog that pairs two checks, reds here. A cross-fire on a turn that is plainly good is a defect:
// it is filed, never fixed in this file, and held in `KNOWN_CROSS_FIRES` with its reason (shrink-only).
// The repair-text vocabulary test reads each fail fixture's finding: the types it names exist in every catalog the
// check rides, the composite rows name only props their composite declares (FR case 3), no confirm repair asks for a
// reference (T-0289), and a message never poses as the user or the app (the repair turn's opening already says what it
// is, `repairOpening` in produce.ts; pinned by produce-semantic-checks.test.ts).
// The T-0290 fight (FEED_SCOPE against BOOKING_FORM_MISSING) is a produce() round failure, not a check, so it is out of
// this cross-run's reach; the loop property test (produce-loop-property.test.ts) covers the loop.

import { describe, expect, it } from 'vitest'
import { buildCatalogMap, semanticChecksDeps } from '../../tools/agent/chat-validation.ts'
import { loadCatalog } from '../catalog/catalog.ts'
import type { Catalog } from '../catalog/catalog.ts'
import defaultCatalogRaw from '../catalog/default/catalog.json'
import basicCatalogRaw from '../catalog/a2ui-basic/catalog.json'
import { COMPOSITE_MOMENTS, compositeMomentCheck } from '../catalog/composite-moments.ts'
import { gradeGuess } from '../catalog/hidden-state-checks.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from '../catalog/semantic-check.ts'
import type { SemanticAction, SemanticCheck, SemanticCheckInput, SemanticFinding } from '../catalog/semantic-check.ts'
import { CORRECTED_LINE, DEAL_TURN, EVIDENCE_LINE, toJsonl } from '../catalog/personas/croupier/hands.fixture.ts'
import { personaCroupierCardTableBettingSeed, personaCroupierCardTableSettledSeed } from '../examples/persona-exemplars.ts'
import { sessionSurfaceSeeds } from '../agent/surface-seeds.ts'
import type { Turn } from '../agent/agent-transport.ts'
import { validateA2ui } from '../renderer/validate.ts'
import type { A2uiComponent, A2uiOutput, A2uiServerMessage } from '../protocol.ts'

// ── the hosts' assembly: every shipped catalog and the checks each one runs ───────────────────────────────────

const CATALOGS: ReadonlyMap<string, Catalog> = buildCatalogMap(loadCatalog(defaultCatalogRaw), loadCatalog(basicCatalogRaw))
const checksOn = (catalog: Catalog): readonly SemanticCheck[] => semanticChecksDeps(catalog).semanticChecks ?? []

/** Every shipped check, by id (one object per id across catalogs). */
const SHIPPED = new Map<string, SemanticCheck>()
for (const catalog of CATALOGS.values()) for (const c of checksOn(catalog)) SHIPPED.set(c.id, c)

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────

interface Fixture {
  /** The catalog this turn is written for; one the check rides. Pass fixtures validate structurally on it. */
  readonly catalog: string
  /** Prior exchanges: what the user said and what the assistant shipped. */
  readonly session?: readonly { readonly say: string; readonly out: A2uiOutput }[]
  /** This round's payload; empty for a round answered in prose alone. */
  readonly output: A2uiOutput
  readonly action?: SemanticAction
  readonly intent?: string
  /** The open surface the say turn declares it changes. */
  readonly target?: string
}

interface Contract {
  readonly pass: Fixture
  readonly fail: Fixture
  /** The code the fail fixture's own check reports. */
  readonly code: string
}

const V = 'v1.0' as const
const create = (surfaceId: string, catalogId: string): A2uiServerMessage => ({ version: V, createSurface: { surfaceId, catalogId, sendDataModel: true } })
const comps = (surfaceId: string, components: Record<string, unknown>[]): A2uiServerMessage =>
  ({ version: V, updateComponents: { surfaceId, components } }) as A2uiServerMessage
const data = (surfaceId: string, value: unknown): A2uiServerMessage => ({ version: V, updateDataModel: { surfaceId, value } }) as A2uiServerMessage
const surface = (sid: string, catalogId: string, components: Record<string, unknown>[], model?: unknown): A2uiOutput => [
  create(sid, catalogId),
  comps(sid, components),
  ...(model === undefined ? [] : [data(sid, model)]),
]
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const UI = 'agent-ui'
const CONCIERGE = 'agent-ui--concierge'
const CROUPIER = 'agent-ui--croupier'

// Booking (Concierge).
const BOOKING = { date: '2026-10-20', time: '20:00', party: 4 }
const bookingForm = (path: (key: string) => string): A2uiOutput =>
  surface(
    'booking-1',
    CONCIERGE,
    [
      {
        id: 'root',
        component: 'BookingForm',
        title: 'A table at Vela',
        fields: [
          { kind: 'dateSingle', path: path('date'), label: 'Date', required: true },
          { kind: 'select', path: path('time'), label: 'Time', required: true, options: [{ value: '19:00', label: '7 pm' }, { value: '20:00', label: '8 pm' }] },
          { kind: 'number', path: path('party'), label: 'Party size', required: true },
        ],
        value: { path: '/booking' },
        child: 'book',
      },
      { id: 'book', component: 'Button', label: 'Book the table', action: { event: { name: 'book' } } },
    ],
    { booking: BOOKING },
  )
const confirmation = surface(
  'confirm-1',
  CONCIERGE,
  [
    {
      id: 'root',
      component: 'BookingConfirmation',
      title: 'Your table is booked',
      data: { path: '/booking' },
      rows: [
        { label: 'Date', path: 'date' },
        { label: 'Time', path: 'time' },
        { label: 'Party size', path: 'party' },
      ],
    },
  ],
  { booking: BOOKING },
)
const services = surface(
  'services-1',
  CONCIERGE,
  [
    { id: 'root', component: 'Grid', gap: 'md', children: { path: '/treatments', componentId: 'tile' } },
    { id: 'tile', component: 'ProductCard', title: { path: 'name' }, price: { path: 'price' }, priceNote: { path: 'duration' }, actionLabel: 'Book', action: { event: { name: 'book', context: { id: { path: 'id' } } } } },
  ],
  { treatments: [{ id: 'swedish-60', name: 'Swedish massage', price: '€95', duration: '60 min' }, { id: 'facial-45', name: 'Hydrating facial', price: '€80', duration: '45 min' }] },
)

// The word game (Lexicographer): a BoardGrid of graded rows, the regex-gated guess field, the word at /secret/word. The
// board carries the `pick_cell` actionName of the recorded Haiku 5.5 word board that drew FLEET_SECRET_MISSING (T-0263).
const WORD = 'slain'
const graded = (row: number, guess: string) => [...guess].map((mark, col) => ({ row, col, mark: mark.toUpperCase(), intent: gradeGuess(guess, WORD)[col] }))
const wordComponents = (extra: Record<string, unknown>[] = [], children: string[] = []): Record<string, unknown>[] => [
  { id: 'root', component: 'Column', gap: 'md', children: ['hud', 'grid', 'guess', ...children] },
  { id: 'hud', component: 'GameHud', title: 'Word game', status: { path: '/status' } },
  { id: 'grid', component: 'BoardGrid', rows: 6, cols: 5, label: 'Guesses', actionName: 'pick_cell', cells: { path: '/cells' } },
  { id: 'guess', component: 'TextField', label: 'Guess', name: 'guess', value: { path: '/draft' }, checks: [{ call: 'regex', args: { value: { path: '/draft' }, pattern: '^[a-z]{5}$' }, message: 'Five letters' }] },
  ...extra,
]
const wordBoard = (model: Record<string, unknown>, extra: Record<string, unknown>[] = [], children: string[] = []): A2uiOutput =>
  surface('word-1', UI, wordComponents(extra, children), model)
const WORD_OPEN = { secret: { word: WORD }, cells: [], status: 'Six guesses left', draft: '' }
const wordSession = [{ say: 'Let us play the word game.', out: wordBoard(WORD_OPEN) }]

// Battleship (Admiral): the board the player fires on, the player's own board, the GameHud, both fleets at /secret.
const FLEET = [{ row: 0, col: 0 }, { row: 0, col: 1 }]
const PLAYER_FLEET = [{ row: 5, col: 5 }, { row: 4, col: 5 }]
const fleetComponents = (hud: boolean, extra: Record<string, unknown>[] = [], children: string[] = []): Record<string, unknown>[] => [
  { id: 'root', component: 'Column', gap: 'md', children: [...(hud ? ['hud'] : []), 'sea', 'home', ...children] },
  ...(hud ? [{ id: 'hud', component: 'GameHud', title: 'Battleship', status: { path: '/status' }, stats: { path: '/stats' } }] : []),
  { id: 'sea', component: 'BoardGrid', rows: 6, cols: 6, label: 'Enemy waters', actionName: 'fire', cells: { path: '/cells' } },
  { id: 'home', component: 'BoardGrid', rows: 6, cols: 6, label: 'Your fleet', cells: { path: '/home' } },
  ...extra,
]
const FLEET_OPEN = { secret: { fleet: FLEET, playerFleet: PLAYER_FLEET }, cells: [], home: [], status: 'Your shot', stats: [{ label: 'Shots', value: 0 }] }
const fleetBoard = (hud: boolean, model: unknown = FLEET_OPEN, extra: Record<string, unknown>[] = [], children: string[] = []): A2uiOutput =>
  surface('waters-1', UI, fleetComponents(hud, extra, children), model)
const fleetSession = [{ say: 'Battleship, please.', out: fleetBoard(true) }]
const AFTER_SHOT = { ...FLEET_OPEN, cells: [{ row: 0, col: 1, mark: '●', disabled: true }], home: [{ row: 3, col: 3, mark: '✕' }], status: 'Hit at A2', stats: [{ label: 'Shots', value: 1 }] }
const resultCard = (outcome: string, summary: string): Record<string, unknown>[] => [
  { id: 'result', component: 'ResultCard', outcome, title: outcome === 'lose' ? 'You conceded' : 'Game over', summary, stats: [{ label: 'Shots', value: 1 }], children: ['again'] },
  { id: 'again', component: 'Button', label: 'Play again', action: { event: { name: 'play_again', context: { newGame: true } } } },
]

// Blackjack and poker (Croupier).
const DEAL_SESSION = [{ say: 'Deal round 3', out: DEAL_TURN }]
const line = (l: string): A2uiOutput => [JSON.parse(l) as A2uiServerMessage]
const TABLE_ROOT = { id: 'root', component: 'CardTable', title: 'Blackjack', phase: { path: '/phase' }, bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, dealerHand: { path: '/dealerHand' }, playerHand: { path: '/playerHand' }, betAction: 'deal' }
const BETTING = { bankroll: 1000, bet: 50, phase: 'betting', dealerHand: [], playerHand: [] }
const tableSession = [{ say: 'Blackjack, please.', out: surface('table-1', CROUPIER, [TABLE_ROOT], BETTING) }]
const deal: SemanticAction = { name: 'deal', surfaceId: 'table-1', context: { bet: 50 }, dataModel: BETTING }
const dealt = surface('table-1', CROUPIER, [{ ...TABLE_ROOT, children: ['hit', 'stand'] }, { id: 'hit', component: 'Button', label: 'Hit', action: { event: { name: 'hit' } } }, { id: 'stand', component: 'Button', label: 'Stand', action: { event: { name: 'stand' } } }], {
  bankroll: 950,
  bet: 50,
  phase: 'playing',
  dealerHand: [{ rank: '10', suit: 'spades' }, { rank: '6', suit: 'clubs', faceDown: true }],
  playerHand: [{ rank: '9', suit: 'hearts' }, { rank: '7', suit: 'clubs' }],
})
const betting = clone(personaCroupierCardTableBettingSeed.messages) as A2uiOutput
const settled = (result: string): A2uiOutput => {
  const out = clone(personaCroupierCardTableSettledSeed.messages) as A2uiOutput
  ;(out[2] as { updateDataModel: { value: Record<string, unknown> } }).updateDataModel.value['result'] = result
  return out
}
const omaha = (board: { rank: string; suit: string; faceDown?: boolean }[]): A2uiOutput =>
  surface(
    'poker-1',
    CROUPIER,
    [
      { id: 'root', component: 'Column', gap: 'md', children: ['title', 'board'] },
      { id: 'title', component: 'Text', variant: 'h4', text: 'Omaha, the flop' },
      { id: 'board', component: 'Row', gap: 'sm', children: { path: '/board', componentId: 'card' } },
      { id: 'card', component: 'PlayingCard', rank: { path: 'rank' }, suit: { path: 'suit' }, faceDown: { path: 'faceDown' } },
    ],
    { board },
  )

/** One pass and one fail fixture per shipped check id. */
const CONTRACTS: Record<string, Contract> = {
  'composite-moment-booking-form': {
    code: 'BOOKING_FORM_MISSING',
    pass: { catalog: CONCIERGE, output: bookingForm((k) => k) },
    fail: {
      catalog: CONCIERGE,
      output: surface('booking-1', CONCIERGE, [
        { id: 'root', component: 'Card', children: ['t', 'date', 'party', 'go'] },
        { id: 't', component: 'Text', text: 'Reserve a table' },
        { id: 'date', component: 'Calendar', label: 'Date' },
        { id: 'party', component: 'Slider', label: 'Guests' },
        { id: 'go', component: 'Button', label: 'Book', action: { event: { name: 'book' } } },
      ]),
    },
  },
  'composite-moment-booking-confirmation': {
    code: 'BOOKING_CONFIRMATION_MISSING',
    pass: { catalog: CONCIERGE, output: confirmation },
    fail: {
      catalog: CONCIERGE,
      output: surface('confirm-1', CONCIERGE, [
        { id: 'root', component: 'Card', children: ['t', 'when'] },
        { id: 't', component: 'Text', text: 'Your table is confirmed' },
        { id: 'when', component: 'Text', text: 'Friday at 8 pm, four guests' },
      ]),
    },
  },
  'composite-moment-board-grid': {
    code: 'BOARD_GRID_MISSING',
    // A tic-tac-toe board: the composite's plainest "board of cells to mark".
    pass: {
      catalog: UI,
      output: surface('ttt-1', UI, [{ id: 'root', component: 'BoardGrid', rows: 3, cols: 3, label: 'Tic-tac-toe', actionName: 'mark', cells: { path: '/cells' } }], { cells: [] }),
    },
    fail: {
      catalog: UI,
      output: surface('ttt-1', UI, [
        { id: 'root', component: 'Grid', children: ['c1', 'c2', 'c3'] },
        { id: 'c1', component: 'Button', label: 'A1', action: { event: { name: 'mark' } } },
        { id: 'c2', component: 'Button', label: 'A2', action: { event: { name: 'mark' } } },
        { id: 'c3', component: 'Button', label: 'A3', action: { event: { name: 'mark' } } },
      ]),
    },
  },
  'composite-moment-game-hud': {
    code: 'GAME_HUD_MISSING',
    pass: { catalog: UI, output: wordBoard(WORD_OPEN) },
    fail: {
      catalog: UI,
      output: surface(
        'word-1',
        UI,
        [{ id: 'score', component: 'Text', text: 'Six guesses remaining' }, ...wordComponents().filter((c) => c['id'] !== 'hud').map((c) => (c['id'] === 'root' ? { ...c, children: ['score', 'grid', 'guess'] } : c))],
        WORD_OPEN,
      ),
    },
  },
  'composite-moment-result-card': {
    code: 'RESULT_CARD_MISSING',
    pass: { catalog: UI, output: wordBoard({ ...WORD_OPEN, cells: graded(0, WORD), status: 'Solved' }, resultCard('win', 'The word was SLAIN, in one guess.'), ['result']) },
    fail: { catalog: UI, output: wordBoard({ ...WORD_OPEN, cells: graded(0, WORD), status: 'Solved' }, [{ id: 'over', component: 'Text', text: 'Game over: you won, the word was SLAIN.' }], ['over']) },
  },
  'composite-moment-product-card': {
    code: 'PRODUCT_CARD_MISSING',
    pass: { catalog: CONCIERGE, output: services },
    fail: {
      catalog: CONCIERGE,
      output: surface('services-1', CONCIERGE, [
        { id: 'root', component: 'Table', label: 'Spa treatments', columns: [{ key: 'treatment', label: 'Treatment' }, { key: 'price', label: 'Price' }], rows: [{ treatment: 'Swedish massage', price: '€95' }] },
      ]),
    },
  },
  'framed-choice': {
    code: 'FRAMED_CHOICE',
    pass: {
      catalog: UI,
      output: surface('hello-1', UI, [
        { id: 'root', component: 'Column', gap: 'md', children: ['hi', 'starters'] },
        { id: 'hi', component: 'Text', text: 'What shall we do?' },
        { id: 'starters', component: 'Row', gap: 'sm', wrap: true, children: ['quiz', 'story'] },
        { id: 'quiz', component: 'Button', variant: 'soft', label: 'Start a quiz', action: { event: { name: 'quiz' } } },
        { id: 'story', component: 'Button', variant: 'soft', label: 'Tell a story', action: { event: { name: 'story' } } },
      ]),
    },
    fail: {
      catalog: UI,
      output: surface('hello-1', UI, [
        { id: 'root', component: 'Row', gap: 'sm', children: ['c1', 'c2'] },
        { id: 'c1', component: 'Card', children: ['f1'] },
        { id: 'f1', component: 'CardFooter', children: ['quiz'] },
        { id: 'quiz', component: 'Button', label: 'Start a quiz', action: { event: { name: 'quiz' } } },
        { id: 'c2', component: 'Card', children: ['f2'] },
        { id: 'f2', component: 'CardFooter', children: ['story'] },
        { id: 'story', component: 'Button', label: 'Tell a story', action: { event: { name: 'story' } } },
      ]),
    },
  },
  'word-secret': {
    code: 'WORD_SECRET_MISSING',
    pass: { catalog: UI, output: wordBoard(WORD_OPEN) },
    fail: { catalog: UI, output: wordBoard({ cells: [], status: 'Six guesses left', draft: '' }) },
  },
  'fleet-secret': {
    code: 'FLEET_SECRET_MISSING',
    pass: { catalog: UI, output: fleetBoard(true) },
    fail: { catalog: UI, output: fleetBoard(true, { cells: [], home: [], status: 'Your shot', stats: [{ label: 'Shots', value: 0 }] }) },
  },
  'fleet-shot-applied': {
    code: 'ACTION_NOT_APPLIED',
    pass: { catalog: UI, session: fleetSession, intent: 'Fire at A2.', target: 'waters-1', output: [data('waters-1', AFTER_SHOT)] },
    fail: { catalog: UI, session: fleetSession, intent: 'Fire at A2.', target: 'waters-1', output: [] },
  },
  'word-move-applied': {
    code: 'ACTION_NOT_APPLIED',
    pass: { catalog: UI, session: wordSession, intent: 'My guess: crane', target: 'word-1', output: [data('word-1', { ...WORD_OPEN, cells: graded(0, 'crane'), status: 'Five guesses left' })] },
    fail: { catalog: UI, session: wordSession, intent: 'My guess: crane', target: 'word-1', output: [] },
  },
  'fleet-hud': {
    code: 'GAME_HUD_MISSING',
    pass: { catalog: UI, output: fleetBoard(true) },
    fail: { catalog: UI, output: fleetBoard(false) },
  },
  'fleet-concede': {
    code: 'RESULT_CARD_MISSING',
    pass: {
      catalog: UI,
      session: fleetSession,
      intent: 'I surrender. Reveal your fleet.',
      target: 'waters-1',
      output: fleetBoard(true, { ...FLEET_OPEN, cells: FLEET.map((c) => ({ ...c, mark: '■' })), status: 'You conceded' }, resultCard('lose', 'You conceded after one shot.'), ['result']).slice(1),
    },
    fail: {
      catalog: UI,
      session: fleetSession,
      intent: 'I surrender. Reveal your fleet.',
      target: 'waters-1',
      output: [data('waters-1', { ...FLEET_OPEN, cells: FLEET.map((c) => ({ ...c, mark: '■' })), status: 'You conceded' })],
    },
  },
  'concierge-surface-required': {
    code: 'SURFACE_MISSING',
    pass: { catalog: CONCIERGE, intent: 'What spa services can I book?', output: services },
    fail: { catalog: CONCIERGE, intent: 'What spa services can I book?', output: [] },
  },
  'concierge-booking-field-paths': {
    code: 'BOOKING_FIELD_PATH',
    pass: { catalog: CONCIERGE, output: bookingForm((k) => k) },
    fail: { catalog: CONCIERGE, output: bookingForm((k) => `booking.${k}`) },
  },
  'croupier-hand-consistency': {
    code: 'HAND_TOTAL',
    pass: { catalog: CROUPIER, session: DEAL_SESSION, intent: 'Double down', output: line(CORRECTED_LINE) },
    fail: { catalog: CROUPIER, session: DEAL_SESSION, intent: 'Double down', output: line(EVIDENCE_LINE) },
  },
  'croupier-bet-controls': {
    code: 'BET_CONTROL_DUPLICATE',
    pass: { catalog: CROUPIER, output: betting },
    fail: {
      catalog: CROUPIER,
      output: surface('table-1', CROUPIER, [{ ...TABLE_ROOT, children: ['stake'] }, { id: 'stake', component: 'Slider', label: 'Bet', min: 10, max: 500, step: 10, value: { path: '/bet' } }], BETTING),
    },
  },
  'croupier-action-applied': {
    code: 'ACTION_NOT_APPLIED',
    pass: { catalog: CROUPIER, session: tableSession, action: deal, output: dealt.slice(1) },
    fail: { catalog: CROUPIER, session: tableSession, action: deal, output: [] },
  },
  'croupier-deck': {
    code: 'CARD_DUPLICATE',
    pass: { catalog: CROUPIER, output: omaha([{ rank: 'A', suit: 'spades' }, { rank: '7', suit: 'hearts' }, { rank: '2', suit: 'clubs' }]) },
    fail: { catalog: CROUPIER, output: omaha([{ rank: '2', suit: 'clubs' }, { rank: '2', suit: 'clubs' }, { rank: '2', suit: 'clubs' }]) },
  },
  'croupier-rules': {
    code: 'RESULT_CONTRADICTS_CARDS',
    pass: { catalog: CROUPIER, output: settled('Your 20 beats the dealer’s 18: +50') },
    fail: { catalog: CROUPIER, output: settled('Dealer 18 beats your 20') },
  },
}

/**
 * Cross-fires on a pass fixture or a fail fixture that are known and filed, keyed `<fixture> <check>` where fixture is
 * `<check id>/<pass|fail>`. Shrink-only: an entry the run no longer sees reds the test.
 */
const KNOWN_CROSS_FIRES: Record<string, string> = {
  'composite-moment-board-grid/pass fleet-secret':
    'Defect (T-0314 report, D1): fleet-secret reads every clickable BoardGrid with no word cue as a Battleship board, ' +
    'so a tic-tac-toe board (or any "board with clickable cells") is sent back for a committed fleet.',
}

// ── the cross-run ───────────────────────────────────────────────────────────────────────────────────────────────

const turnsOf = (f: Fixture): Turn[] => (f.session ?? []).flatMap(({ say, out }): Turn[] => [
  { role: 'user', content: say },
  { role: 'assistant', content: toJsonl(out) },
])

/** The input `produce()` builds for this round (a payload round, or a no-payload round of a client or say turn). */
function inputOf(f: Fixture): SemanticCheckInput {
  const session = { turns: turnsOf(f) }
  if (f.action !== undefined) return { surfaces: f.output.length === 0 ? [] : semanticSurfaceViews(session, f.output), action: f.action }
  const open = f.intent !== undefined ? sessionSurfaceViews(session) : undefined
  const target = f.target !== undefined && open?.some((v) => v.surfaceId === f.target) ? f.target : undefined
  return {
    surfaces: f.output.length === 0 ? [] : semanticSurfaceViews(session, f.output),
    ...(f.intent !== undefined ? { intent: f.intent } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(open !== undefined ? { open } : {}),
  }
}

interface Violation {
  readonly key: string
  readonly catalogs: string[]
  readonly findings: SemanticFinding[]
}

/** Every co-run set a check id meets: the distinct check lists of the catalogs that run it, with those catalogs. */
function coRunSets(id: string, checksFor: (catalog: Catalog) => readonly SemanticCheck[]): { checks: readonly SemanticCheck[]; catalogs: string[] }[] {
  const sets = new Map<string, { checks: readonly SemanticCheck[]; catalogs: string[] }>()
  for (const [catalogId, catalog] of CATALOGS) {
    const checks = checksFor(catalog)
    if (!checks.some((c) => c.id === id)) continue
    const key = checks.map((c) => c.id).join(',')
    const set = sets.get(key) ?? { checks, catalogs: [] }
    set.catalogs.push(catalogId)
    sets.set(key, set)
  }
  return [...sets.values()]
}

/** Run each fixture through every check that co-runs with its own; return every fire by another check, and every
 *  own-check result that breaks the contract (a pass fixture that fires, a fail fixture that misses its code). */
function crossRun(contracts: Record<string, Contract>, checksFor: (catalog: Catalog) => readonly SemanticCheck[]): { own: string[]; cross: Violation[] } {
  const own: string[] = []
  const cross = new Map<string, Violation>()
  for (const [id, contract] of Object.entries(contracts)) {
    for (const kind of ['pass', 'fail'] as const) {
      const input = inputOf(contract[kind])
      for (const { checks, catalogs } of coRunSets(id, checksFor)) {
        for (const check of checks) {
          const findings = [...check.check(input)]
          if (check.id === id) {
            const codes = findings.map((f) => f.code)
            if (kind === 'pass' && codes.length > 0) own.push(`${id}/pass fires its own check: ${codes.join(', ')} (${catalogs[0]})`)
            if (kind === 'fail' && !codes.includes(contract.code)) own.push(`${id}/fail misses ${contract.code}: got [${codes.join(', ')}] (${catalogs[0]})`)
            continue
          }
          if (findings.length === 0) continue
          const key = `${id}/${kind} ${check.id}`
          const v = cross.get(key) ?? { key, catalogs: [], findings }
          v.catalogs.push(...catalogs)
          cross.set(key, v)
        }
      }
    }
  }
  return { own, cross: [...cross.values()] }
}

const describeCross = (v: Violation): string => `${v.key} on ${v.catalogs[0]}${v.catalogs.length > 1 ? ` (+${v.catalogs.length - 1})` : ''}: ${v.findings.map((f) => `${f.code} at ${f.path}`).join('; ')}`

describe('T-0314: every shipped semantic check has a pass and a fail fixture, cross-run against its co-running checks', () => {
  it('the fixture table covers exactly the checks the hosts ship', () => {
    expect(SHIPPED.size).toBeGreaterThanOrEqual(20) // anti-vacuity: the assembly really yields the checks
    expect(Object.keys(CONTRACTS).sort()).toEqual([...SHIPPED.keys()].sort())
  })

  it('each fixture is written for a catalog its check rides, and each pass fixture validates there', () => {
    for (const [id, contract] of Object.entries(CONTRACTS)) {
      for (const kind of ['pass', 'fail'] as const) {
        const f = contract[kind]
        const catalog = CATALOGS.get(f.catalog)
        expect(catalog, `${id}/${kind}`).toBeDefined()
        expect(checksOn(catalog!).map((c) => c.id), `${id}/${kind} on ${f.catalog}`).toContain(id)
      }
      const f = contract.pass
      if (f.output.length === 0) continue
      const verdict = validateA2ui(f.output, CATALOGS.get(f.catalog)!, sessionSurfaceSeeds({ turns: turnsOf(f) }), { atFinalize: true })
      expect(verdict.failures, `${id}/pass`).toEqual([])
    }
  })

  const run = crossRun(CONTRACTS, checksOn)

  it('each pass fixture passes its own check and each fail fixture fires its named code, on every catalog it rides', () => {
    expect(run.own).toEqual([])
  })

  it('no check fires on another check’s fixture outside the known, filed cross-fires', () => {
    const unexpected = run.cross.filter((v) => !(v.key in KNOWN_CROSS_FIRES)).map(describeCross)
    expect(unexpected).toEqual([])
  })

  it('every known cross-fire still fires (the allowlist only shrinks)', () => {
    const seen = new Set(run.cross.map((v) => v.key))
    expect(Object.keys(KNOWN_CROSS_FIRES).filter((k) => !seen.has(k))).toEqual([])
  })

  it('a mutated check makes the cross-run red: the ResultCard row with its BoardGrid guard removed fires on another check’s fixture', () => {
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'ResultCard')!
    const mutant = compositeMomentCheck({ ...row, has: undefined })
    const mutated = (catalog: Catalog) => checksOn(catalog).map((c) => (c.id === mutant.id ? mutant : c))
    const before = new Set(run.cross.map((v) => v.key))
    const added = crossRun(CONTRACTS, mutated).cross.filter((v) => !before.has(v.key))
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((v) => v.key.endsWith(` ${mutant.id}`))).toBe(true)
  })
})

// ── the repair-text vocabulary ──────────────────────────────────────────────────────────────────────────────────

const ALL_TYPES = new Set([...CATALOGS.values()].flatMap((c) => Object.keys(c.components)))

/** The catalog type names a message uses mid-sentence (a capitalized word opening a sentence is ordinary prose). */
function typesNamed(message: string): string[] {
  const out = new Set<string>()
  for (const m of message.matchAll(/\b[A-Z][A-Za-z]*\b/g)) {
    if (!ALL_TYPES.has(m[0])) continue
    const before = message.slice(0, m.index).trimEnd()
    if (before === '' || /[.!?:]$/.test(before)) continue
    out.add(m[0])
  }
  return [...out]
}

/** More fail inputs for the checks whose repair text varies with the ask, so every arm's wording is read. */
const PROBES: Record<string, readonly Fixture[]> = {
  'concierge-surface-required': [
    { catalog: CONCIERGE, intent: 'Book a 60-minute massage on Thursday at 15:00.', output: [] },
    { catalog: CONCIERGE, intent: 'Yes, confirm the table for four.', output: [] },
    { catalog: CONCIERGE, intent: 'When do the pool and gym close?', output: [] },
  ],
  'framed-choice': [
    {
      catalog: UI,
      output: surface('settle-1', UI, [
        { id: 'root', component: 'Column', children: ['done', 'actions'] },
        { id: 'done', component: 'Text', text: 'The round is settled.' },
        { id: 'actions', component: 'Card', children: ['foot'] },
        { id: 'foot', component: 'CardFooter', children: ['again'] },
        { id: 'again', component: 'Button', label: 'Deal again', action: { event: { name: 'deal' } } },
      ]),
    },
  ],
  'fleet-shot-applied': [{ catalog: UI, intent: "Let's play Battleship.", output: [] }],
  'word-move-applied': [
    { catalog: UI, session: wordSession, intent: 'I give up.', target: 'word-1', output: [] },
    { catalog: UI, session: wordSession, intent: 'I give up.', target: 'word-1', output: [data('word-1', { ...WORD_OPEN, status: 'The word was SLAIN' })] },
    { catalog: UI, session: wordSession, intent: 'Play again.', output: [] },
  ],
  'fleet-concede': [{ catalog: UI, session: fleetSession, intent: 'I concede.', target: 'waters-1', output: [] }],
}

/** The types a fixture's own surfaces hold: a repair that names one describes the surface, it asks for nothing. */
const typesHeld = (f: Fixture): Set<string> =>
  new Set(
    [...(f.session ?? []).map((s) => s.out), f.output]
      .flat()
      .flatMap((m) => ('updateComponents' in m ? m.updateComponents.components.map((c: A2uiComponent) => c.component) : [])),
  )

/** Each fail fixture's and probe's findings from its own check, with the types its input holds. */
const REPAIRS: { id: string; finding: SemanticFinding; held: Set<string> }[] = Object.entries(CONTRACTS).flatMap(([id, contract]) =>
  [contract.fail, ...(PROBES[id] ?? [])].flatMap((f) => SHIPPED.get(id)!.check(inputOf(f)).map((finding) => ({ id, finding, held: typesHeld(f) }))),
)

/**
 * Types a repair asks for on a catalog that lacks them, keyed `<check id> <code> <type>`: known and filed. Shrink-only.
 */
const D2 =
  'Defect (T-0314 report, D2): on a2ui-basic--concierge the services and facility asks are sent back for a ProductCard in a ' +
  'Grid, or a DescriptionList, none of which that catalog holds, so the model cannot comply.'
const D3 = 'Defect (T-0314 report, D3, low): the repair tells an a2ui-basic turn to drop a CardContent that catalog cannot hold.'
const KNOWN_VOCABULARY_GAPS: Record<string, string> = {
  'concierge-surface-required SURFACE_MISSING ProductCard': D2,
  'concierge-surface-required SURFACE_MISSING Grid': D2,
  'concierge-surface-required SURFACE_MISSING DescriptionList': D2,
  'framed-choice FRAMED_CHOICE CardContent': D3,
  'framed-choice LONE_BUTTON_FRAME CardContent': D3,
}

/** The props each composite row's repair and ask surface name, each a property of the composite (FR case 3). */
const ROW_PROPS: Record<string, readonly string[]> = {
  BookingForm: ['fields', 'value'],
  BookingConfirmation: ['title', 'data', 'rows', 'label', 'path'],
  BoardGrid: ['rows', 'cols', 'cells', 'actionName'],
  GameHud: ['title', 'status', 'stats'],
  ResultCard: ['outcome', 'title', 'summary', 'stats'],
  ProductCard: ['title', 'price', 'priceNote', 'action'],
}

/** A composite's declared props, with the item props of its array props (`rows[].label`). */
function propsOf(type: string): Set<string> {
  const def = [...CATALOGS.values()].map((c) => c.components[type]).find((d) => d !== undefined)
  const props = new Set<string>()
  for (const [name, prop] of Object.entries((def as { properties?: Record<string, { type?: { items?: { properties?: Record<string, unknown> } } }> } | undefined)?.properties ?? {})) {
    props.add(name)
    for (const item of Object.keys(prop.type?.items?.properties ?? {})) props.add(item)
  }
  return props
}

describe('T-0314: repair text names only what the catalog it rides can emit, framed as a check result', () => {
  it('every fail fixture and probe yields a finding to read', () => {
    expect(new Set(REPAIRS.map((r) => r.id)).size).toBe(Object.keys(CONTRACTS).length)
    for (const [id, probes] of Object.entries(PROBES)) for (const f of probes) expect(SHIPPED.get(id)!.check(inputOf(f)).length, `${id} on "${f.intent}"`).toBeGreaterThan(0)
  })

  // A type the input itself holds is exempt: the repair names it to describe the surface, not to ask for it.
  const gaps = new Map<string, string[]>()
  for (const { id, finding, held } of REPAIRS) {
    for (const { catalogs } of coRunSets(id, checksOn)) {
      for (const catalogId of catalogs) {
        for (const t of typesNamed(finding.message)) {
          if (held.has(t) || Object.hasOwn(CATALOGS.get(catalogId)!.components, t)) continue
          const key = `${id} ${finding.code} ${t}`
          gaps.set(key, [...(gaps.get(key) ?? []), catalogId])
        }
      }
    }
  }

  it('every type a repair asks for is a type of each catalog its check rides, outside the known, filed gaps', () => {
    const unexpected = [...gaps].filter(([key]) => !(key in KNOWN_VOCABULARY_GAPS)).map(([key, on]) => `${key} on ${[...new Set(on)].join(', ')}`)
    expect(unexpected).toEqual([])
  })

  it('every known vocabulary gap is still there (the allowlist only shrinks)', () => {
    expect(Object.keys(KNOWN_VOCABULARY_GAPS).filter((k) => !gaps.has(k))).toEqual([])
  })

  it('each composite row names only props its composite declares, and every camelCase word it uses is one', () => {
    for (const m of COMPOSITE_MOMENTS) {
      const props = propsOf(m.composite)
      const text = `${m.repair} ${m.ask?.surface ?? ''}`
      for (const p of ROW_PROPS[m.composite]!) {
        expect(props.has(p), `${m.composite}.${p}`).toBe(true)
        expect(text, `${m.composite} names ${p}`).toMatch(new RegExp(`\\b${p}\\b`))
      }
      for (const word of text.match(/\b[a-z]+[A-Z][A-Za-z]*\b/g) ?? []) expect(props.has(word), `${m.composite} repair names ${word}`).toBe(true)
    }
    expect(Object.keys(ROW_PROPS).sort()).toEqual(COMPOSITE_MOMENTS.map((m) => m.composite).sort())
  })

  it('no confirm repair asks for a reference the BookingConfirmation cannot hold (T-0289)', () => {
    expect(propsOf('BookingConfirmation').has('reference')).toBe(false)
    const confirm = COMPOSITE_MOMENTS.find((m) => m.composite === 'BookingConfirmation')!
    // A reference may be named only to rule it out ("add no reference number").
    const asks = (text: string): string[] => [...text.matchAll(/(\S+)\s+reference\b/gi)].map((m) => m[1]!.toLowerCase()).filter((w) => w !== 'no')
    expect(confirm.ask?.surface).toMatch(/\bno reference\b/) // anti-vacuity: the rule-out is really there
    expect(asks(`${confirm.repair} ${confirm.ask?.surface}`)).toEqual([])
    for (const { id, finding } of REPAIRS) expect(asks(finding.message), `${id} ${finding.code}`).toEqual([])
  })

  it('a finding is one model-facing repair, never a notice posing as the user or the app', () => {
    for (const { id, finding } of REPAIRS) {
      const where = `${id} ${finding.code}`
      expect(finding.code, where).toMatch(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/)
      expect(finding.path, where).toMatch(/^[^:\s]+:\S/)
      const unquoted = finding.message.replace(/"[^"]*"/g, '""')
      expect(unquoted, where).not.toMatch(/^\s*(?:INVALID|Check result|Corrected|System|SYSTEM|Error|Warning)\b/)
      expect(unquoted, where).not.toMatch(/\b(?:not a message from the user|automated checks|INVALID)\b/)
      expect(unquoted, where).not.toMatch(/\b(?:I|I'm|I've|my|me)\b/)
    }
  })
})
