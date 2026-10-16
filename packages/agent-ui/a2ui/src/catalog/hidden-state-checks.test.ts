// hidden-state-checks.test.ts: T-0230. The word game and Battleship commit their hidden answer in the surface data
// model (`/secret`), and every mark is judged against it. The recorded Haiku 5.5 Lexicographer game
// (scripts/e2e-admin/probe/replays/lexicographer-haiku-no-secret.json) committed no word at all, and its marks were
// made up; the check now fails every one of its surface turns.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { A2uiOutput, A2uiServerMessage } from '../protocol.ts'
import { fleetConcedeCheck, fleetSecretCheck, fleetShotAppliedCheck, gradeGuess, HIDDEN_STATE_CHECKS, fleetHudCheck, wordMoveAppliedCheck, wordSecretCheck } from './hidden-state-checks.ts'
import { semanticSurfaceViews, sessionSurfaceViews } from './semantic-check.ts'
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

// T-0265 (the recorded Haiku 5.5 Admiral, round 3 opening-salvo t4 and row-sweep t2): "Fire at A2." was answered with
// a meta-line targeting enemy-waters and the shot resolved in prose, so the board kept its old marks.
describe('T-0265: fleet-shot-applied', () => {
  const session: SemanticTurnLog = { turns: [{ role: 'assistant', content: waters('enemy-waters').map((m) => JSON.stringify(m)).join('\n') }] }
  const said = (intent: string, out: A2uiOutput = [], target?: string) =>
    fleetShotAppliedCheck.check({ surfaces: semanticSurfaceViews(session, out), intent, ...(target !== undefined ? { target } : {}) })
  const marked: A2uiOutput = [data('enemy-waters', { cells: [shot(1, 0, '✕')] })]

  it('rides every catalog after the two secret checks', () => {
    expect(HIDDEN_STATE_CHECKS.map((c) => c.id).slice(0, 3)).toEqual(['word-secret', 'fleet-secret', 'fleet-shot-applied'])
  })

  it('the recorded prose-only "Fire at A2." targeting enemy-waters is ACTION_NOT_APPLIED', () => {
    const findings = said('Fire at A2.', [], 'enemy-waters')
    expect(findings.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'enemy-waters:A2']])
    expect(findings[0]!.message).toMatch(/updateDataModel for enemy-waters/)
    expect(said('b7', [], 'enemy-waters').map((f) => f.path)).toEqual(['enemy-waters:B7'])
    expect(said('Fire at A2.', mine('home', []), 'enemy-waters').map((f) => f.code)).toEqual(['ACTION_NOT_APPLIED']) // a read-only board is not the target
  })

  it('an update to the target, a new firing board, a turn with no shot, or a click passes', () => {
    expect(said('Fire at A2.', marked, 'enemy-waters')).toEqual([])
    expect(said('Fire at A2.', waters('sea-2'), 'enemy-waters')).toEqual([])
    expect(said('How many of your ships are still afloat?', [], 'enemy-waters')).toEqual([])
    expect(fleetShotAppliedCheck.check({ surfaces: [], action: fire(0, 1) })).toEqual([])
  })

  it('a Battleship game asked for with no surface is SURFACE_MISSING; a question or a drawn board passes', () => {
    expect(said('Battleship, please.').map((f) => [f.code, f.path])).toEqual([['SURFACE_MISSING', 'opening:battleship']])
    expect(said("Let's play Battleship.", waters('sea'))).toEqual([])
    expect(said('How do you play Battleship?')).toEqual([])
    expect(said('Fire at A2.')).toEqual([]) // no target: nothing open to judge
  })
})

// T-0280 (the recorded Haiku 5.5 Lexicographer, round 4 :86-:89): "My guess: audio." and "I give up." were answered with
// a meta-line targeting word-forge and the grades and answer in prose, so the board never moved and no ResultCard shipped.
describe('T-0280: word-move-applied', () => {
  const session: SemanticTurnLog = { turns: [assistant([...board('word-forge'), data('word-forge', { secret: { word: 'lodge' }, cells: [], draft: '' })])] }
  const said = (intent: string, out: A2uiOutput = [], target?: string) =>
    wordMoveAppliedCheck.check({ surfaces: semanticSurfaceViews(session, out), intent, ...(target !== undefined ? { target } : {}) })
  const graded: A2uiOutput = [{ version: 'v1.0', updateDataModel: { surfaceId: 'word-forge', path: '/cells', value: row(0, 'audio', [N, N, S, N, W]) } } as A2uiServerMessage]
  const result: A2uiOutput = [
    { version: 'v1.0', updateComponents: { surfaceId: 'word-forge', components: [{ id: 'root', component: 'ResultCard', outcome: 'loss', title: 'The word was LODGE' }] } } as A2uiServerMessage,
  ]

  it('rides every catalog after the Battleship checks', () => {
    expect(HIDDEN_STATE_CHECKS.map((c) => c.id).slice(0, 4)).toEqual(['word-secret', 'fleet-secret', 'fleet-shot-applied', 'word-move-applied'])
  })

  it('the recorded prose-only guesses and give-up targeting word-forge are ACTION_NOT_APPLIED', () => {
    const guess = said('My guess: audio.', [], 'word-forge')
    expect(guess.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'word-forge:audio']])
    expect(guess[0]!.message).toMatch(/updateDataModel for word-forge/)
    expect(said('My guess: stern.', [], 'word-forge').map((f) => f.path)).toEqual(['word-forge:stern'])
    const giveUp = said('I give up. What was the word?', [], 'word-forge')
    expect(giveUp.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'word-forge:give-up']])
    expect(giveUp[0]!.message).toMatch(/ResultCard/)
  })

  it('a give-up that updates the board with a hand-built Card and no ResultCard is RESULT_CARD_MISSING', () => {
    const card: A2uiOutput = [{ version: 'v1.0', updateComponents: { surfaceId: 'word-forge', components: [{ id: 'root', component: 'Card', children: [] }] } } as A2uiServerMessage]
    expect(said('I give up.', card, 'word-forge').map((f) => [f.code, f.path])).toEqual([['RESULT_CARD_MISSING', 'word-forge:give-up']])
  })

  it('an updating guess, a ResultCard give-up, a new board, a turn with no guess, no target, or a click passes', () => {
    expect(said('My guess: audio.', graded, 'word-forge')).toEqual([])
    expect(said('I give up.', result, 'word-forge')).toEqual([])
    expect(said('My guess: audio.', board('word-forge-2'), 'word-forge')).toEqual([])
    expect(said('How many guesses do I have left?', [], 'word-forge')).toEqual([])
    expect(said('Fire at A2.', [], 'word-forge')).toEqual([])
    expect(said('My guess: audio.')).toEqual([])
    expect(wordMoveAppliedCheck.check({ surfaces: [], action: fire(0, 1) })).toEqual([])
  })
})

// T-0291 (the recorded Haiku 5.5 Lexicographer, round 5 :94, :95, :72): "I give up." was answered in prose with a
// meta-line that declared no target, and "Play again." in prose with or without one; no check fired on either.
describe('T-0291: word-move-applied with no target, and a replay ask', () => {
  const session: SemanticTurnLog = { turns: [assistant([...board('word-forge'), data('word-forge', { secret: { word: 'lodge' }, cells: [], draft: '' })])] }
  const open = sessionSurfaceViews(session)
  const said = (intent: string, out: A2uiOutput = [], target?: string) =>
    wordMoveAppliedCheck.check({ surfaces: semanticSurfaceViews(session, out), intent, open, ...(target !== undefined ? { target } : {}) })
  const reset: A2uiOutput = [{ version: 'v1.0', updateDataModel: { surfaceId: 'word-forge', value: { secret: { word: 'crane' }, cells: [], draft: '' } } } as A2uiServerMessage]
  const result: A2uiOutput = [
    { version: 'v1.0', updateComponents: { surfaceId: 'word-forge', components: [{ id: 'root', component: 'ResultCard', outcome: 'loss', title: 'The word was LODGE' }] } } as A2uiServerMessage,
  ]

  it('a prose give-up that declares no target is ACTION_NOT_APPLIED at the open word game, framed as a check result', () => {
    const giveUp = said('I give up.')
    expect(giveUp.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'word-forge:give-up']])
    expect(giveUp[0]!.message).toMatch(/^The word-game check found/)
    expect(giveUp[0]!.message).toMatch(/ends the game, not an ask flow/)
  })

  it('a prose "Play again." is ACTION_NOT_APPLIED, with or without a target', () => {
    for (const target of [undefined, 'word-forge']) {
      const replay = said('Play again.', [], target)
      expect(replay.map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'word-forge:play-again']])
      expect(replay[0]!.message).toMatch(/new secret word at \/secret\/word, an empty board/)
    }
  })

  it('a ResultCard give-up, a reset or a new board on replay, a targetless guess, or no open word game passes', () => {
    expect(said('I give up.', result)).toEqual([])
    expect(said('Play again.', reset)).toEqual([])
    expect(said('Play again.', board('word-forge-2'))).toEqual([])
    expect(said('My guess: cat.')).toEqual([])
    expect(wordMoveAppliedCheck.check({ surfaces: [], intent: 'Play again.', open: [] })).toEqual([])
    expect(wordMoveAppliedCheck.check({ surfaces: [], intent: 'I give up.' })).toEqual([])
  })
})

// T-0284 (the recorded Haiku 5.5 Admiral, round 4 regress-admiral-row-sweep-haiku-1 t0): "Battleship, please." opened a
// Column with a Text title, the BoardGrid and a Text bound to /hud/status, and no GameHud; no check fired.
describe('T-0284: fleet-hud', () => {
  const fixture = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../../.sdlc/evals/rounds/2026-10-15-r4-fixes/runs/regress-admiral-row-sweep-haiku-1/fixture.json'), 'utf8'),
  ) as { turns: { lines: string[] }[] }
  const opening = wire(fixture.turns[0]!.lines)
  const hud = { id: 'hud', component: 'GameHud', title: 'Enemy waters', status: { path: '/hud/status' } }
  const withHud: A2uiOutput = opening.map((m) =>
    'updateComponents' in m
      ? ({ version: 'v1.0', updateComponents: { surfaceId: 'battleship-1', components: [{ id: 'root', component: 'Column', children: ['hud', 'sea'] }, hud, ...m.updateComponents.components.filter((c) => c.id === 'sea')] } } as A2uiServerMessage)
      : m,
  )

  it('rides every catalog after the word-move check', () => {
    expect(HIDDEN_STATE_CHECKS.map((c) => c.id).slice(0, 5)).toEqual(['word-secret', 'fleet-secret', 'fleet-shot-applied', 'word-move-applied', 'fleet-hud'])
  })

  it('the recorded opening with no GameHud is GAME_HUD_MISSING', () => {
    expect(codes(fleetHudCheck, [], opening)).toEqual(['GAME_HUD_MISSING battleship-1:sea'])
  })

  it('the same opening with a GameHud passes, as do a later turn, a word board and a read-only board', () => {
    expect(codes(fleetHudCheck, [], withHud)).toEqual([])
    expect(codes(fleetHudCheck, [assistant(opening)], [data('battleship-1', { sea: { cells: [shot(0, 0, '✕')] } })])).toEqual([])
    expect(codes(fleetHudCheck, [], [...board('word-forge'), data('word-forge', { secret: { word: 'lodge' }, cells: [] })])).toEqual([])
    expect(codes(fleetHudCheck, [], [...mine('home', []), data('home', { secret: { fleet, playerFleet } })])).toEqual([])
  })
})

// T-0296 (live round 6 :112, :298, :484): "I surrender. Reveal your fleet." targeting enemy-waters revealed the fleet on
// the board and shipped no ResultCard. Kim's ruling: a surrender ends like a normal game end.
describe('T-0296: fleet-concede', () => {
  const session: SemanticTurnLog = { turns: [assistant([...waters('enemy-waters'), data('enemy-waters', { secret: { fleet, playerFleet }, cells: [] })])] }
  const open = sessionSurfaceViews(session)
  const said = (intent: string, out: A2uiOutput = [], target?: string) =>
    fleetConcedeCheck.check({ surfaces: semanticSurfaceViews(session, out), intent, open, ...(target !== undefined ? { target } : {}) })
  const revealed: A2uiOutput = [{ version: 'v1.0', updateDataModel: { surfaceId: 'enemy-waters', path: '/cells', value: [shot(0, 0, '■'), shot(0, 1, '■')] } } as A2uiServerMessage]
  const result: A2uiOutput = [
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'enemy-waters',
        components: [
          { id: 'root', component: 'Column', children: ['board', 'result'] },
          { id: 'board', component: 'BoardGrid', rows: 6, cols: 6, cells: { path: '/cells' } },
          { id: 'result', component: 'ResultCard', outcome: 'lose', title: 'You surrendered' },
        ],
      },
    } as A2uiServerMessage,
  ]

  it('rides every catalog last', () => {
    expect(HIDDEN_STATE_CHECKS.map((c) => c.id)).toEqual(['word-secret', 'fleet-secret', 'fleet-shot-applied', 'word-move-applied', 'fleet-hud', 'fleet-concede'])
  })

  it('the recorded surrender that reveals the fleet on the board with no ResultCard is RESULT_CARD_MISSING', () => {
    const findings = said('I surrender. Reveal your fleet.', revealed, 'enemy-waters')
    expect(findings.map((f) => [f.code, f.path])).toEqual([['RESULT_CARD_MISSING', 'enemy-waters:concede']])
    expect(findings[0]!.message).toMatch(/keep the revealed board and add ONE ResultCard beside it/)
    expect(said('I concede.', revealed).map((f) => f.code)).toEqual(['RESULT_CARD_MISSING']) // no target: the open fleet game
  })

  it('a prose-only surrender is ACTION_NOT_APPLIED', () => {
    expect(said('I give up.', [], 'enemy-waters').map((f) => [f.code, f.path])).toEqual([['ACTION_NOT_APPLIED', 'enemy-waters:concede']])
  })

  it('a ResultCard surrender, a turn with no concession, a word game give-up or a click passes', () => {
    expect(said('I surrender. Reveal your fleet.', result, 'enemy-waters')).toEqual([])
    expect(said('Fire at A2.', revealed, 'enemy-waters')).toEqual([])
    const words: SemanticTurnLog = { turns: [assistant([...board('word-forge'), data('word-forge', { secret: { word: 'lodge' }, cells: [] })])] }
    expect(fleetConcedeCheck.check({ surfaces: semanticSurfaceViews(words, []), intent: 'I give up.', target: 'word-forge', open: sessionSurfaceViews(words) })).toEqual([])
    expect(fleetConcedeCheck.check({ surfaces: [], action: fire(0, 1) })).toEqual([])
  })

  it('the word-move check leaves a Battleship give-up to this check', () => {
    expect(wordMoveAppliedCheck.check({ surfaces: semanticSurfaceViews(session, revealed), intent: 'I give up.', target: 'enemy-waters', open })).toEqual([])
  })
})
