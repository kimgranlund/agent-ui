// hidden-state-checks.test.ts: T-0230. The word game and Battleship commit their hidden answer in the surface data
// model (`/secret`), and every mark is judged against it. The recorded Haiku 5.5 Lexicographer game
// (scripts/e2e-admin/probe/replays/lexicographer-haiku-no-secret.json) committed no word at all, and its marks were
// made up; the check now fails every one of its surface turns.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { A2uiOutput, A2uiServerMessage } from '../protocol.ts'
import { fleetSecretCheck, gradeGuess, wordSecretCheck } from './hidden-state-checks.ts'
import { semanticSurfaceViews } from './semantic-check.ts'
import type { SemanticAction, SemanticTurnLog } from './semantic-check.ts'

type Turn = { role: string; content: string }

const wire = (lines: readonly string[]): A2uiOutput => lines.filter((l) => !l.includes('"a2uiMeta"')).map((l) => JSON.parse(l) as A2uiServerMessage)
const assistant = (out: A2uiOutput): Turn => ({ role: 'assistant', content: out.map((m) => JSON.stringify(m)).join('\n') })
const codes = (check: typeof wordSecretCheck, turns: Turn[], out: A2uiOutput, action?: SemanticAction): string[] =>
  check.check({ surfaces: semanticSurfaceViews({ turns } as SemanticTurnLog, out), ...(action ? { action } : {}) }).map((f) => `${f.code} ${f.path}`)

describe('T-0230: the recorded lexicographer-haiku-no-secret turns', () => {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../../scripts/e2e-admin/probe/replays/lexicographer-haiku-no-secret.json'), 'utf8')) as {
    steps: { say: string }[]
    turns: { lines: string[] }[]
  }

  it('fails the opening turn and both guess turns: no secret word is ever committed', () => {
    const session: Turn[] = []
    const perTurn: string[][] = []
    fixture.turns.forEach((turn, i) => {
      const out = wire(turn.lines)
      perTurn.push(codes(wordSecretCheck, session, out))
      session.push({ role: 'user', content: fixture.steps[i]!.say }, assistant(out))
    })
    expect(perTurn).toEqual([['WORD_SECRET_MISSING ask-1:/secret/word'], [], ['WORD_SECRET_MISSING ask-1:/secret/word'], ['WORD_SECRET_MISSING ask-1:/secret/word'], []])
  })

  it('passes the same opening turn once it commits the word', () => {
    const out = wire(fixture.turns[0]!.lines)
    const commit: A2uiOutput = [...out, { version: 'v1.0', updateDataModel: { surfaceId: 'ask-1', path: '/secret', value: { word: 'slain' } } } as A2uiServerMessage]
    expect(codes(wordSecretCheck, [], commit)).toEqual([])
  })
})

// A word-tiles surface: one BoardGrid bound to /cells and the regex-gated guess field.
const board = (sid: string): A2uiServerMessage[] => [
  { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui', sendDataModel: true } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: sid,
      components: [
        { id: 'root', component: 'Column', children: ['grid', 'guess'] },
        { id: 'grid', component: 'BoardGrid', rows: 6, cols: 5, label: 'Guesses', cells: { path: '/cells' } },
        { id: 'guess', component: 'TextField', label: 'Guess', value: { path: '/draft' }, checks: [{ call: 'regex', args: { value: { path: '/draft' }, pattern: '^[a-z]{5}$' }, message: 'Five letters' }] },
      ],
    },
  } as A2uiServerMessage,
]
const row = (r: number, guess: string, grades: string[]) => [...guess].map((mark, col) => ({ row: r, col, mark: mark.toUpperCase(), intent: grades[col] }))
const data = (sid: string, value: unknown): A2uiServerMessage => ({ version: 'v1.0', updateDataModel: { surfaceId: sid, value } }) as A2uiServerMessage
const S = 'success'
const W = 'warning'
const N = 'neutral'

describe('T-0230: word-secret', () => {
  it('grades duplicates the Wordle way: exact matches first, then one warning per unmatched copy', () => {
    expect(gradeGuess('llama', 'hello')).toEqual([W, W, N, N, N])
    expect(gradeGuess('brine', 'slain')).toEqual([N, N, W, W, N])
    expect(gradeGuess('slain', 'slain')).toEqual([S, S, S, S, S])
  })

  it('a correctly marked row against the committed word passes; a made-up one is WORD_MARK_WRONG', () => {
    const ok = [...board('w'), data('w', { secret: { word: 'slain' }, cells: row(0, 'brine', [N, N, W, W, N]) })]
    expect(codes(wordSecretCheck, [], ok)).toEqual([])
    // The recorded BRINE marks: R, N and E in the right spot.
    const madeUp = [...board('w'), data('w', { secret: { word: 'slain' }, cells: row(0, 'brine', [N, S, N, S, S]) })]
    expect(codes(wordSecretCheck, [], madeUp)).toEqual(['WORD_MARK_WRONG w:grid'])
  })

  it('a word changed mid-game is WORD_SECRET_CHANGED, even when it fits the marks (SWAIN for SLAIN)', () => {
    const start = [...board('w'), data('w', { secret: { word: 'slain' }, cells: row(0, 'ghost', [N, N, N, W, N]) })]
    const turns = [assistant(start)]
    const swapped: A2uiOutput = [data('w', { secret: { word: 'swain' }, cells: row(0, 'ghost', [N, N, N, W, N]) })]
    expect(codes(wordSecretCheck, turns, swapped)).toEqual(['WORD_SECRET_CHANGED w:/secret/word'])
    // A Play again click, or a reset board, starts a new game with a new word.
    expect(codes(wordSecretCheck, turns, swapped, { name: 'play_again', surfaceId: 'w', context: { newGame: true }, dataModel: undefined })).toEqual([])
    expect(codes(wordSecretCheck, turns, [data('w', { secret: { word: 'swain' }, cells: [] })])).toEqual([])
  })

  it('stays silent on a surface with no word-game signature', () => {
    const form: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 'f', catalogId: 'agent-ui' } } as A2uiServerMessage,
      { version: 'v1.0', updateComponents: { surfaceId: 'f', components: [{ id: 'root', component: 'TextField', label: 'Code', name: 'code', checks: [{ call: 'regex', args: { pattern: '^[a-z]{5}$' } }] }] } } as A2uiServerMessage,
    ]
    expect(codes(wordSecretCheck, [], form)).toEqual([])
  })
})

// A Battleship target board (clickable) bound to /cells, and the player's read-only board on its own surface.
const waters = (sid: string): A2uiServerMessage[] => [
  { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui', sendDataModel: true } },
  { version: 'v1.0', updateComponents: { surfaceId: sid, components: [{ id: 'root', component: 'BoardGrid', rows: 6, cols: 6, actionName: 'cell', cells: { path: '/cells' } }] } } as A2uiServerMessage,
]
const mine = (sid: string, cells: unknown[]): A2uiServerMessage[] => [
  { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui' } },
  { version: 'v1.0', updateComponents: { surfaceId: sid, components: [{ id: 'root', component: 'BoardGrid', rows: 6, cols: 6, cells }] } } as A2uiServerMessage,
]
const fleet = [{ row: 0, col: 0 }, { row: 0, col: 1 }]
const playerFleet = [{ row: 5, col: 5 }, { row: 4, col: 5 }]
const shot = (row: number, col: number, mark: string) => ({ row, col, mark, disabled: true })
const fire = (row: number, col: number): SemanticAction => ({ name: 'cell', surfaceId: 'sea', context: { row, col }, dataModel: undefined })

describe('T-0230: fleet-secret', () => {
  it('an opening board with no committed fleets is FLEET_SECRET_MISSING for each', () => {
    expect(codes(fleetSecretCheck, [], [...waters('sea'), data('sea', { cells: [] })])).toEqual([
      'FLEET_SECRET_MISSING sea:/secret/fleet',
      'FLEET_SECRET_MISSING sea:/secret/playerFleet',
    ])
    expect(codes(fleetSecretCheck, [], [...waters('sea'), data('sea', { secret: { fleet, playerFleet }, cells: [] })])).toEqual([])
  })

  it('a shot marked against the committed fleet passes; a made-up hit or miss is SHOT_RESULT_WRONG', () => {
    const start = [...waters('sea'), data('sea', { secret: { fleet, playerFleet }, cells: [] })]
    const turns = [assistant(start)]
    expect(codes(fleetSecretCheck, turns, [data('sea', { secret: { fleet, playerFleet }, cells: [shot(0, 0, '●'), shot(2, 2, '✕')] })], fire(2, 2))).toEqual([])
    expect(codes(fleetSecretCheck, turns, [data('sea', { secret: { fleet, playerFleet }, cells: [shot(0, 0, '✕')] })], fire(0, 0))).toEqual(['SHOT_RESULT_WRONG sea:root'])
    expect(codes(fleetSecretCheck, turns, [data('sea', { secret: { fleet, playerFleet }, cells: [shot(3, 3, '●')] })], fire(3, 3))).toEqual(['SHOT_RESULT_WRONG sea:root'])
  })

  it('return fire on the player board is judged against the committed player fleet', () => {
    const start = [...waters('sea'), data('sea', { secret: { fleet, playerFleet }, cells: [] })]
    const turn = [data('sea', { secret: { fleet, playerFleet }, cells: [shot(2, 2, '✕')] })]
    expect(codes(fleetSecretCheck, [assistant(start)], [...turn, ...mine('home', [shot(5, 5, '●')])], fire(2, 2))).toEqual([])
    expect(codes(fleetSecretCheck, [assistant(start)], [...turn, ...mine('home', [shot(1, 1, '●')])], fire(2, 2))).toEqual(['RETURN_FIRE_WRONG home:root'])
  })

  it('a fleet moved mid-game is FLEET_SECRET_CHANGED; a new game may place a new one', () => {
    const start = [...waters('sea'), data('sea', { secret: { fleet, playerFleet }, cells: [shot(2, 2, '✕')] })]
    const moved = [{ row: 2, col: 2 }, { row: 2, col: 3 }]
    const turn = [data('sea', { secret: { fleet: moved, playerFleet }, cells: [shot(2, 2, '✕'), shot(4, 4, '✕')] })]
    expect(codes(fleetSecretCheck, [assistant(start)], turn, fire(4, 4))).toEqual(['SHOT_RESULT_WRONG sea:root', 'FLEET_SECRET_CHANGED sea:/secret/fleet'])
    expect(codes(fleetSecretCheck, [assistant(start)], [data('sea', { secret: { fleet: moved, playerFleet }, cells: [] })])).toEqual([])
  })
})

// T-0263: both games ride base `agent-ui` and both draw a clickable BoardGrid. A Haiku 5.5 word board with a
// `pick_cell` actionName got FLEET_SECRET_MISSING (2026-10-15-r3-routing :110), and Haiku wrote a fleet into the word game.
describe('T-0263: each hidden-state check judges only its own game', () => {
  const wordBoard = (sid: string): A2uiServerMessage[] => [
    { version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: sid,
        components: [
          { id: 'root', component: 'Column', children: ['grid', 'guess'] },
          { id: 'grid', component: 'BoardGrid', rows: 6, cols: 5, actionName: 'pick_cell', cells: { path: '/board/cells' } },
          { id: 'guess', component: 'TextField', name: 'guess', value: { path: '/guess' }, checks: [{ call: 'regex', args: { value: { path: '/guess' }, pattern: '^[a-z]{5}$' }, message: 'Five letters' }] },
        ],
      },
    } as A2uiServerMessage,
  ]

  it('a word board with a clickable BoardGrid gets no fleet check, committed word or not', () => {
    expect(codes(fleetSecretCheck, [], [...wordBoard('ask-1'), data('ask-1', { secret: { word: 'stone' }, guess: '', board: { cells: [] } })])).toEqual([])
    expect(codes(fleetSecretCheck, [], [...wordBoard('ask-1'), data('ask-1', { guess: '', board: { cells: [] } })])).toEqual([])
    expect(codes(wordSecretCheck, [], [...wordBoard('ask-1'), data('ask-1', { guess: '', board: { cells: [] } })])).toEqual(['WORD_SECRET_MISSING ask-1:/secret/word'])
  })

  it('an Admiral board with a five-letter field gets no word check once its fleet is committed', () => {
    const admiral = [...wordBoard('sea'), data('sea', { secret: { fleet, playerFleet }, board: { cells: [] } })]
    expect(codes(wordSecretCheck, [], admiral)).toEqual([])
    expect(codes(fleetSecretCheck, [], admiral)).toEqual([])
  })

  it('negative control: a plain Battleship board with no word cue still gets FLEET_SECRET_MISSING', () => {
    expect(codes(fleetSecretCheck, [], [...waters('sea'), data('sea', { cells: [] })])).toHaveLength(2)
  })
})
