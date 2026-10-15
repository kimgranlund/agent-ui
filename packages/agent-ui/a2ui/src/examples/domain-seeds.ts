// domain-seeds.ts: four domain-composite seeds authored for corpus review (T-0245), one per game or hospitality
// preset the producer must retrieve an exemplar for (T-0240): a Croupier CardTable round, a Concierge BookingForm,
// a Lexicographer word BoardGrid and an Admiral battleship BoardGrid. Each replaces a candidate the T-0240 review
// scored 2 (`frontier-board-grid-guesses`, `persona-croupier-card-table`, `persona-concierge-booking`) or fills a
// gap (no battleship seed existed), fixing the cited defects:
// - the round binds `/phase` and shows the bankroll after the 50 bet left it (950, not 1000);
// - the booking opens the surface with `sendDataModel` and its submit action carries `/booking`, and no
//   confirmation renders before the guest submits;
// - the word board commits its answer at `/secret/word` (T-0230), marks every row against it, and carries its
//   status on one GameHud rather than a caption Text;
// - the sea marks hits ● and misses ✕ against fleets committed at `/secret/fleet` and `/secret/playerFleet`.
//
// T-0274 adds a fifth, the Lexicographer game-over turn (a give-up reveals the word on a ResultCard over the settled
// board), because the only ResultCard exemplar on the shard was a blackjack win and a give-up turn retrieved none.
//
// T-0240 shelves them as corpus candidates: the base seeds on `allSeeds`, the two persona seeds on
// `allPersonaCorpusSeeds`, admitted against the composed `<base>--<persona>` catalog into that persona's shard.
// `domain-seeds.test.ts` holds each to its catalog and to the semantic checks its preset runs live.

import type { ExampleSeed, PersonaShardCatalogId, SeedCatalogId } from './types.ts'

const ROUND_SID = 'blackjack-round'

/** The Croupier mid-round: a 50 bet placed from a 1,000 stack, the hole card face down, the player on 17. */
export const domainCroupierRoundSeed: ExampleSeed<'agent-ui--croupier'> = {
  name: 'domain-croupier-card-table-round',
  description:
    'The croupier persona over the agent-ui base: one CardTable in its playing phase, every figure bound to the ' +
    'data model (phase, status, both hands, both totals, bankroll and bet), so the round moves by data writes on one ' +
    'table. The dealer shows a 9 of clubs over a face-down hole card, the player holds a king of hearts and a 7 ' +
    'of spades for 17, and the bankroll reads 950 because the 50 bet sits on the felt. Hit, Stand and Double ' +
    'Buttons are the table\'s children, and the surface sends its data model with each move.',
  promptText: 'Bet 50 and deal me a hand of blackjack.',
  surfaceId: ROUND_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ROUND_SID, catalogId: 'agent-ui--croupier', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ROUND_SID,
        value: {
          phase: 'playing',
          dealerHand: [
            { rank: '9', suit: 'clubs' },
            { rank: '4', suit: 'diamonds', faceDown: true },
          ],
          playerHand: [
            { rank: 'K', suit: 'hearts' },
            { rank: '7', suit: 'spades' },
          ],
          status: 'Your move',
          dealerTotal: 'showing 9',
          playerTotal: 17,
          bankroll: 950,
          bet: 50,
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ROUND_SID,
        components: [
          {
            id: 'root',
            component: 'CardTable',
            title: 'Blackjack',
            status: { path: '/status' },
            statusIntent: 'info',
            phase: { path: '/phase' },
            dealerHand: { path: '/dealerHand' },
            playerHand: { path: '/playerHand' },
            dealerTotal: { path: '/dealerTotal' },
            playerTotal: { path: '/playerTotal' },
            bankroll: { path: '/bankroll' },
            bet: { path: '/bet' },
            children: ['hitBtn', 'standBtn', 'doubleBtn'],
          },
          { id: 'hitBtn', component: 'Button', variant: 'soft', label: 'Hit', action: { action: 'hit' } },
          { id: 'standBtn', component: 'Button', variant: 'solid', label: 'Stand', action: { action: 'stand' } },
          { id: 'doubleBtn', component: 'Button', variant: 'soft', label: 'Double', action: { action: 'double' } },
        ],
      },
    },
  ],
}

const BOOKING_SID = 'stay-booking'

/** The Concierge's request turn: the guest's choices start empty and travel back on submit. */
export const domainConciergeBookingSeed: ExampleSeed<'agent-ui--concierge'> = {
  name: 'domain-concierge-booking-request',
  description:
    'The concierge persona over the agent-ui base: one BookingForm titled "Book your stay" as the surface root, ' +
    'its aggregate two-way bound to /booking: required arrival and departure dateSingle fields, a required ' +
    'room-type select (king, twin or junior suite) and a breakfast Yes / No choice, all starting unanswered. ' +
    'Its child Book now Button is a submit action, so the form holds it until every required field is filled, and ' +
    'its context carries /booking; the surface also sends its data model, so the guest\'s choices reach the ' +
    'agent. No confirmation renders on the request turn: the read-back belongs to the turn after the submit.',
  promptText: 'I\'d like to book a room at the hotel. Let me pick my dates, the room type and whether I want breakfast.',
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--concierge',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'agent-ui--concierge', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: { checkIn: '', checkOut: '', roomType: '', breakfast: '' } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          {
            id: 'root',
            component: 'BookingForm',
            title: 'Book your stay',
            fields: [
              { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
              { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
              {
                kind: 'select',
                path: 'roomType',
                label: 'Room type',
                required: true,
                options: [
                  { value: 'king', label: 'King room' },
                  { value: 'twin', label: 'Twin room' },
                  { value: 'suite', label: 'Junior suite' },
                ],
              },
              { kind: 'checkbox', path: 'breakfast', label: 'Add breakfast' },
            ],
            value: { path: '/booking' },
            child: 'bookBtn',
          },
          {
            id: 'bookBtn',
            component: 'Button',
            variant: 'solid',
            label: 'Book now',
            action: { action: 'confirm_booking', submit: true, context: { booking: { path: '/booking' } } },
          },
        ],
      },
    },
  ],
}

const WORD_SID = 'word-forge'

/** The secret word and the two guesses so far, graded the Wordle way against it (`gradeGuess`). */
const WORD_CELLS = [
  { row: 0, col: 0, mark: 'C', intent: 'neutral' },
  { row: 0, col: 1, mark: 'R', intent: 'warning' },
  { row: 0, col: 2, mark: 'A', intent: 'success' },
  { row: 0, col: 3, mark: 'N', intent: 'neutral' },
  { row: 0, col: 4, mark: 'E', intent: 'warning' },
  { row: 1, col: 0, mark: 'T', intent: 'warning' },
  { row: 1, col: 1, mark: 'E', intent: 'success' },
  { row: 1, col: 2, mark: 'A', intent: 'success' },
  { row: 1, col: 3, mark: 'R', intent: 'success' },
  { row: 1, col: 4, mark: 'S', intent: 'neutral' },
]

/** Each letter guessed so far, at its best state across the board. */
const USED_LETTERS = [
  { label: 'A right spot', intent: 'success' },
  { label: 'E right spot', intent: 'success' },
  { label: 'R right spot', intent: 'success' },
  { label: 'T wrong spot', intent: 'warning' },
  { label: 'C absent', intent: 'neutral' },
  { label: 'N absent', intent: 'neutral' },
  { label: 'S absent', intent: 'neutral' },
]

/** The Lexicographer two guesses in: one board, one HUD, the used letters, one gated input. */
export const domainLexicographerWordSeed: ExampleSeed = {
  name: 'domain-lexicographer-word-board',
  description:
    'A five-letter word game two guesses in, on one surface: a GameHud (status in play, guesses left, progress ' +
    '2 of 6 guesses used), a 6 by 5 read-only BoardGrid whose bound cells mark CRANE and TEARS letter by letter ' +
    '(success right spot, warning wrong spot, neutral absent, each with the control\'s corner glyph), a compact ' +
    'List of used-letter Badges, and a FormProvider holding one TextField gated by a ^[a-z]{5}$ regex check and ' +
    'a Guess submit Button whose context carries the guess. The answer is committed once at /secret/word, bound ' +
    'to nothing on screen, so every row is graded against one fixed word.',
  promptText: 'My word game guesses so far: CRANE and TEARS. Mark them and let me enter my next guess.',
  surfaceId: WORD_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: WORD_SID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WORD_SID,
        value: {
          secret: { word: 'heart' },
          hud: {
            title: 'Word forge',
            status: 'In play',
            stats: [
              { label: 'Guesses left', value: 4 },
              { label: 'Letters placed', value: '3 of 5' },
            ],
            progress: { value: 2, max: 6, label: 'Guesses used' },
          },
          board: { cells: WORD_CELLS },
          used: USED_LETTERS,
          guess: '',
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WORD_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['hud', 'board', 'usedLetters', 'guessForm'] },
          {
            id: 'hud',
            component: 'GameHud',
            title: { path: '/hud/title' },
            status: { path: '/hud/status' },
            statusIntent: 'info',
            stats: { path: '/hud/stats' },
            progress: { path: '/hud/progress' },
          },
          { id: 'board', component: 'BoardGrid', rows: 6, cols: 5, label: 'Word guesses', cells: { path: '/board/cells' } },
          { id: 'usedLetters', component: 'List', gap: 'xs', wrap: true, children: { path: '/used', componentId: 'usedLetter' } },
          { id: 'usedLetter', component: 'Badge', label: { path: 'label' }, intent: { path: 'intent' } },
          { id: 'guessForm', component: 'FormProvider', children: ['guessRow'] },
          { id: 'guessRow', component: 'Row', gap: 'sm', align: 'end', children: ['guessField', 'guessBtn'] },
          { id: 'guessField', component: 'Field', label: 'Next guess', child: 'guessInput' },
          {
            id: 'guessInput',
            component: 'TextField',
            name: 'guess',
            placeholder: 'five lowercase letters',
            required: true,
            value: { path: '/guess' },
            checks: [{ call: 'regex', args: { value: { path: '/guess' }, pattern: '^[a-z]{5}$' }, message: 'Enter exactly five lowercase letters' }],
          },
          {
            id: 'guessBtn',
            component: 'Button',
            variant: 'solid',
            label: 'Guess',
            action: { action: 'submit_guess', submit: true, context: { guess: { path: '/guess' } } },
          },
        ],
      },
    },
  ],
}

const OVER_SID = 'word-forge-over'

/** The Lexicographer after the player gives up two guesses in: the word revealed on one ResultCard over the settled
 *  board, the same rows still graded against the committed word, and one New game action (T-0274). */
export const domainLexicographerGameOverSeed: ExampleSeed = {
  name: 'domain-lexicographer-game-over',
  description:
    'A five-letter word game the player gave up on two guesses in, on one surface: a ResultCard with the lose ' +
    'outcome, the title Word forge, a summary that reveals the word (HEART) and guesses-used and letters-placed ' +
    'stat tiles bound to the data model, holding a New game Button whose action starts a fresh word. Below ' +
    'it the 6 by 5 read-only BoardGrid stays settled, its bound cells still marking CRANE and TEARS letter by ' +
    'letter against the answer committed at /secret/word (success right spot, warning wrong spot, neutral ' +
    'absent), and no guess input remains.',
  promptText: 'I give up. What was the word?',
  surfaceId: OVER_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: OVER_SID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: OVER_SID,
        value: {
          secret: { word: 'heart' },
          result: {
            title: 'Word forge',
            summary: 'You gave up after 2 of 6 guesses. The word was HEART.',
            stats: [
              { label: 'Guesses used', value: '2 of 6' },
              { label: 'Letters placed', value: '3 of 5', intent: 'warning' },
            ],
          },
          board: { cells: WORD_CELLS },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: OVER_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['result', 'board'] },
          {
            id: 'result',
            component: 'ResultCard',
            outcome: 'lose',
            title: { path: '/result/title' },
            summary: { path: '/result/summary' },
            stats: { path: '/result/stats' },
            children: ['newGameBtn'],
          },
          { id: 'newGameBtn', component: 'Button', variant: 'solid', label: 'New game', action: { action: 'new_game', context: { newGame: true } } },
          { id: 'board', component: 'BoardGrid', rows: 6, cols: 5, label: 'Word guesses', cells: { path: '/board/cells' } },
        ],
      },
    },
  ],
}

const SEA_SID = 'enemy-waters'

/** Rows are lettered A to F from the top and columns numbered 1 to 6 from the left, so B3 is row 1, column 2. */
const SEA_CELLS = [
  { row: 0, col: 0, mark: '✕', intent: 'neutral', disabled: true }, // A1 miss
  { row: 3, col: 3, mark: '✕', intent: 'neutral', disabled: true }, // D4 miss
  { row: 1, col: 1, mark: '●', intent: 'danger', disabled: true }, // B2 hit
  { row: 1, col: 2, mark: '●', intent: 'danger', disabled: true }, // B3 hit, this turn's shot
]

/** The player's own waters: their ships shown (■ info) and the Admiral's four return shots, each answered against
 *  /secret/playerFleet: A5 hit, C3 miss, B5 hit (this turn's), E5 miss. */
const HOME_CELLS = [
  { row: 0, col: 4, mark: '●', intent: 'danger' }, // A5 hit
  { row: 1, col: 4, mark: '●', intent: 'danger' }, // B5 hit, this turn's return shot
  { row: 2, col: 4, mark: '■', intent: 'info' },
  { row: 3, col: 0, mark: '■', intent: 'info' },
  { row: 3, col: 1, mark: '■', intent: 'info' },
  { row: 5, col: 3, mark: '■', intent: 'info' },
  { row: 5, col: 4, mark: '■', intent: 'info' },
  { row: 2, col: 2, mark: '✕', intent: 'neutral' }, // C3 miss
  { row: 4, col: 4, mark: '✕', intent: 'neutral' }, // E5 miss
]

/** The Admiral's three ships (B2 to B4, D6 to E6, F1 to F2) and the player's (A5 to C5, D1 to D2, F4 to F5),
 *  committed once at game start. */
const FLEETS = {
  fleet: [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    { row: 3, col: 5 }, { row: 4, col: 5 },
    { row: 5, col: 0 }, { row: 5, col: 1 },
  ],
  playerFleet: [
    { row: 0, col: 4 }, { row: 1, col: 4 }, { row: 2, col: 4 },
    { row: 3, col: 0 }, { row: 3, col: 1 },
    { row: 5, col: 3 }, { row: 5, col: 4 },
  ],
}

/** The Admiral after the player's fourth shot and his fourth return shot: one HUD, the sea the player fires on,
 *  the player's own waters read-only beside it, the fleets committed out of sight. */
export const domainAdmiralBattleshipSeed: ExampleSeed = {
  name: 'domain-admiral-battleship-board',
  description:
    'A Battleship turn with both boards: the enemy sea the player fires on is a 6 by 6 BoardGrid with actionName ' +
    'cell, so a click sends {row, col} in the action context (rows lettered A to F, columns 1 to 6, so B3 is row ' +
    '1, column 2). Its bound cells mark the shot at B3 a hit (● danger) beside the earlier hit at B2 and misses ' +
    'at A1 and D4 (✕ neutral), each resolved cell disabled. Beside it the player\'s own waters are a read-only ' +
    'BoardGrid (no actionName) showing their ships (■) and the Admiral\'s four return shots, hits at A5 and B5 ' +
    'and misses at C3 and E5. One GameHud carries both fleets\' ships remaining, shots fired and hits. Both ' +
    'fleets are committed once at /secret/fleet and /secret/playerFleet, bound to nothing on screen, so every ' +
    'shot and every return shot resolves against one fixed placement.',
  promptText: 'Battleship: I missed at A1 and D4 and hit at B2. Now fire at B3, then take your shot.',
  surfaceId: SEA_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SEA_SID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SEA_SID,
        value: {
          secret: FLEETS,
          hud: {
            title: 'Enemy waters',
            status: 'Hit at B3',
            stats: [
              { label: 'Enemy ships left', value: '3 of 3' },
              { label: 'Your ships left', value: '3 of 3' },
              { label: 'Shots fired', value: 4, delta: 1 },
              { label: 'Hits', value: 2, delta: 1, intent: 'success' },
            ],
          },
          sea: { cells: SEA_CELLS },
          home: { cells: HOME_CELLS },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SEA_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['hud', 'sea', 'home'] },
          {
            id: 'hud',
            component: 'GameHud',
            title: { path: '/hud/title' },
            status: { path: '/hud/status' },
            statusIntent: 'success',
            stats: { path: '/hud/stats' },
          },
          { id: 'sea', component: 'BoardGrid', rows: 6, cols: 6, label: 'Enemy waters', actionName: 'cell', cells: { path: '/sea/cells' } },
          { id: 'home', component: 'BoardGrid', rows: 6, cols: 6, label: 'Your waters', cells: { path: '/home/cells' } },
        ],
      },
    },
  ],
}

/** The three domain seeds over the base catalog, the `allSeeds` family. */
export const domainBaseSeeds: readonly ExampleSeed[] = [domainLexicographerWordSeed, domainLexicographerGameOverSeed, domainAdmiralBattleshipSeed]

/** The two domain seeds over a persona catalog, the `allPersonaCorpusSeeds` family. */
export const domainPersonaSeeds: readonly ExampleSeed<PersonaShardCatalogId>[] = [domainCroupierRoundSeed, domainConciergeBookingSeed]

/** The five domain seeds, in review order. */
export const domainSeeds: readonly ExampleSeed<SeedCatalogId>[] = [
  domainCroupierRoundSeed,
  domainConciergeBookingSeed,
  domainLexicographerWordSeed,
  domainLexicographerGameOverSeed,
  domainAdmiralBattleshipSeed,
]
