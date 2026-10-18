// composite-moments.ts: "use composite X for moment Y" as data-driven semantic checks (T-0208).
//
// Each row of `COMPOSITE_MOMENTS` names a registered composite, one of its `selection.json` intents (the moment),
// and a narrow structural detector for a surface that hand-builds that moment without it (CA-R9 lever 3). One
// generator turns every row into a `SemanticCheck` (ADR-0238) whose finding sends the model back to make the
// surface ONE composite. A row's `notInside` also sends back a composite wrapped in a card of its own (T-0262,
// `<COMPOSITE>_WRAPPED`). The check `requires` the composite (and any type it reads), so `gateChecksOnCatalog`
// keeps a row on exactly the catalogs that can emit it: the booking rows ride `<base>--concierge`, the games rows
// ride `agent-ui` until the games types move to a domain, the ProductCard row rides `agent-ui`, and `a2ui-basic`
// gets none.
//
// The link to the sidecar is a test, not an import (`composite-moments.test.ts`: every `moment` is one of its
// composite's intents): the module imports no JSON, so plain Node (`scripts/e2e-admin/probe/trace.ts`) and both
// server hosts can import it, and `selection-guidance.ts` keeps its closed `{intents, notFor}` row shape.
//
// T-0313 (Kim 2026-10-16, P1 as revised): a row is the one matcher for its moment. Its `ask` holds the turn words that
// ask for the moment and the surface that answers it; the Concierge SURFACE_MISSING check reads them through
// `askedCompositeMoment` instead of keeping its own regexes. The facility ask stays in that check: its answer, a Card
// holding a DescriptionList, is no composite.
//
// T-0322: a row's `pricedRows` reads the turn's words too: on a services ask (the row's `ask.cue`), priced rows in a
// DescriptionList or a List are the ProductCard moment, while the facility hours list (no price, no services ask)
// stays clean.
//
// T-0333: the BookingConfirmation row reads its settled words only from status signals (`settledSignals`), so a caption
// that says "confirmed" or "booked" is no hand-built confirmation (round 9 cluster G), and the BookingForm row stands aside
// for a surface that already holds one.
//
// T-0358: the GameHud row's `boardless.statStrip` reads a surface with no BoardGrid: on a surface whose words name a game
// (quest, HP, deal sheet), two or more game-stat items (HP, gold, mood, asking price, confidence, questions) in Badges,
// Stats, Progress labels or DescriptionList rows are a hand-built HUD (the Mentalist, the Negotiator and the Dungeon
// Master, smoke round 2026-10-18-smoke). The row needs only GameHud in the catalog, so a catalog with no BoardGrid runs it.
//
// T-0364: both rows read a surface with no BoardGrid through one `boardless` gate: its `game` words (GAME_WORDS, shared)
// must name a game. The same personas end their game on ONE ResultCard, so on such a surface an end-of-game signal
// (`end`: game over, final score, play again) beside the result words is RESULT_CARD_MISSING. A mid-game "you won 20
// gold", a sales dashboard, a receipt or a booking that says "you won" stays clean, a croupier hand settles on its own
// table, and a round result Toast is never read.
//
// T-0365: the T-0362 re-record (round 2026-10-18-t0362-smoke) hand-built two strips that row missed. A question, round,
// turn, guess or attempt `counter` ("Q1 of 20", "Q 1/20", "Round 2/5") is a game stat, while a bare "3 of 6" or "3/6"
// (an inventory count, an order line) is none, and a counter alone never names a game (a hiring "Round 2 of 4" beside a
// "Confidence: high"). A component counts each distinct stat it names ("HP 12/12, Gold 0" is two). A `groupTypes`
// component (Text) counts only when it opens on its stat ("Gold 0", "Confidence: low") and sits in a sibling group (the
// direct children of any parent, one single-child wrapper looked through) whose stat items reach `min` (the Dungeon
// Master's "HP 12 / 12" and "Gold 0" in a Row), so narration that mentions gold or HP and a lone HP Text stay clean.
//
// T-0361: the Timeline row reads a quest log built by hand: on a surface whose words name a game, a Column or List of
// parallel entries (Texts, or Rows of Texts: a number and a name) under its nearest heading. Under a log heading (scenes,
// a journal, a quest log: a label Text, the list's own label, or the title or CardHeader of the Card around it) one
// numbered or "Scene N" entry is enough and plain entries need two; with no log heading it takes two "Scene N" entries
// (the Dungeon Master, smoke round 2026-10-18-smoke). A single "Scene 3" heading over narration or over a list of choices
// is no log. The row has no `has`, so it runs only through the `boardless` gate; an order history, a changelog, a chat
// history or an itinerary names no game, and an inventory or objectives list has no log heading.
//
// T-0361 review: no row reads another composite's props as words (a GameHud status "Game over" is no hand-built result);
// the GameHud gate also takes round and turn (the Negotiator's "Round 3, your turn"), as T-0358 did, since its two-stat
// strip guards it; and "new quest", "new adventure" or "new game" end a game only on a surface with no live play control
// left (a mid-game "Start a new quest" side button beside the choices is no ending).

import type { A2uiComponent } from '../protocol.ts'
import { readPointer } from './semantic-check.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

export interface CompositeMoment {
  /** The composite type; also the first `requires` entry. */
  readonly composite: string
  /** One of the composite's `selection.json` intents. */
  readonly moment: string
  /** The clause after "Make it ONE <composite>". */
  readonly repair: string
  /** Extra types the check reads. */
  readonly requires?: readonly string[]
  /** Types whose presence skips the surface (the composite always does). */
  readonly lacks: readonly string[]
  /** The surface must hold one of these types (with none, the row runs through `boardless` only; T-0361). */
  readonly has?: readonly string[]
  /** T-0358, T-0364: with none of `has` present (or no `has` at all, T-0361), the row still runs on a surface whose words name a game (`game`, read with
   *  any `end` phrase taken out, so "game over" alone names none) unless it holds a `standAside` type, reading no words from
   *  `skipWordTypes`. Then either `statStrip`: at least `min` stat items (a component of `types`, a DescriptionList row,
   *  or T-0365 a `groupTypes` component opening on its stat in a sibling group that reaches `min`) whose words name game
   *  state (`cue`, or a `counter`, which is taken out of the game words), the hand-built score strip of a game with no board; or the row's `words` path,
   *  with an `end` signal on the surface, or a `restart` signal with no live play control left on it (T-0361 review).
   *  Every other gate of the row still applies. */
  readonly boardless?: {
    readonly game: RegExp
    readonly statStrip?: {
      readonly types: readonly string[]
      readonly groupTypes?: readonly string[]
      readonly cue: RegExp
      readonly counter?: RegExp
      readonly min: number
    }
    readonly end?: RegExp
    readonly restart?: RegExp
    readonly standAside?: readonly string[]
    readonly skipWordTypes?: readonly string[]
  }
  /** Over the surface words. */
  readonly words?: RegExp
  /** Read words only from components of these types. */
  readonly wordTypes?: readonly string[]
  /** At least `min` components of `types`. */
  readonly inputs?: { readonly types: readonly string[]; readonly min: number }
  /** Or, with none of `inputs.types` present, a read-back: a component of `types` beside a Button that submits it (T-0331:
   *  `action.submit`, or an action name matching `action`; else, as a fallback, a label matching `cue` unless the action
   *  is `start_intent`, an info CTA). */
  readonly readBack?: { readonly types: readonly string[]; readonly action: RegExp; readonly cue: RegExp }
  /** Types the surface must not hold. */
  readonly noInputs?: readonly string[]
  /** An input of `types` whose label, name or bound path matches `cue`, while the surface words match `words`. */
  readonly inputCue?: { readonly types: readonly string[]; readonly cue: RegExp; readonly words: RegExp }
  /** T-0361: a container of `types` whose entries (explicit Texts or Rows of Texts, or a Text template) all take one shape:
   *  the first of `shapes` they match (`shapes[0]` is the scene shape), or plain. Under its nearest heading matching
   *  `heading` it fires on a template, one shaped entry or two plain ones; with no such heading, on two `shapes[0]` entries. */
  readonly logOf?: { readonly types: readonly string[]; readonly heading: RegExp; readonly shapes: readonly RegExp[] }
  /** A Grid with at least `min` explicit children, all of type `child`. */
  readonly gridOf?: { readonly child: string; readonly min: number }
  /** T-0262: types the composite must not sit inside (it draws its own card); a wrapper yields `<COMPOSITE>_WRAPPED`. */
  readonly notInside?: readonly string[]
  /** T-0279: a Table with a column whose key or label matches `cue`, while the surface words match `words`. */
  readonly tableColumn?: { readonly cue: RegExp }
  /** T-0322: on a turn whose words match `ask.cue`, a component of `types` that lists a row matching `cue` (a priced
   *  DescriptionList row, a priced List item), while the surface words match `words`. */
  readonly pricedRows?: { readonly types: readonly string[]; readonly cue: RegExp }
  /** T-0333: read `words` only from settled-status signals (a Badge, a Card or CardHeader title, a heading Text h1 to h5),
   *  never caption or body Text, so a note that says "can be confirmed with the front desk" is no settled booking. */
  readonly settledSignals?: boolean
  /** T-0333: skip the surface when it holds a settled-status signal, unless a live read-back confirm is still on it (that is
   *  not settled), so the BookingConfirmation repair and this one never fire together. */
  readonly standsAsideForSettled?: boolean
  /** T-0333: skip the surface while a live read-back confirm is on it: the BookingForm row owns that shape. */
  readonly standsAsideForReadBack?: boolean
  /** T-0313: the turn words that ask for this moment (`cue`), its short name (the SURFACE_MISSING path), the surface that
   *  answers it, and its precedence when one turn's words ask for two moments (lowest first). */
  readonly ask?: { readonly moment: string; readonly cue: RegExp; readonly surface: string; readonly rank: number }
}

/** T-0333: the past-state words of a settled booking ("Booked" Badge, "Spa booking confirmed" title); the noun
 *  "confirmation" is no settled state ("Booking confirmation" heads a read-back that still asks to confirm). */
const SETTLED_WORDS = /\b(confirmed|booked|reserved)\b/i

const BOOKING_INPUTS = ['TextField', 'Calendar', 'Select', 'ComboBox', 'Slider', 'RadioGroup', 'ChoiceGroup'] as const

/** The guest confirms a booking already read back ("please confirm the booking"; T-0282: "Confirm it, the details are
 *  right.", "Yes, confirm the table for four."). */
const CONFIRM_ASK = /\bconfirm\s+it\b|\bconfirm\b[^.?!]*\b(booking|reservation|appointment|slot|table|tour)\b/i
/** The guest asks what can be booked ("What spa services can I book?"). */
const SERVICES_ASK = /\b(services|treatments|amenities|menu)\b/i
/** The guest asks to book ("Book a 60-minute massage on Thursday at 15:00"; T-0282: "I'd like a table at Vela"). */
const BOOK_ASK = /\b(book|reserve|reservation)\b|\b(i'?d|i would|we'?d|we would) like (a|an) (table|room|treatment|massage|tour|appointment)\b/i

/** T-0358, T-0364: the words that name a game on a surface with no board. Generic words (player, level, round, turn)
 *  name none: a podcast player or a Gold level is no game. */
export const GAME_WORDS = /\b(game|games|quest|hp|quiz|trivia|twenty questions|the answer was|the word was|deal sheet|adventure|dungeon)\b/i
/** T-0361 review: the GameHud gate also takes round and turn (T-0358's Negotiator, "Round 3, your turn"); its two-stat strip
 *  keeps a dashboard out. */
const HUD_GAME_WORDS = new RegExp(`\\b(round|rounds|turn|turns)\\b|${GAME_WORDS.source}`, 'i')

/** T-0361 review: the controls that keep a game live; a Button whose words only restart it is none. */
const PLAY_CONTROLS: readonly string[] = ['Button', ...BOOKING_INPUTS]

const BOOKING_READ_BACK: NonNullable<CompositeMoment['readBack']> = { types: ['DescriptionList'], action: /^confirm/i, cue: /\bconfirm\b/i }

export const COMPOSITE_MOMENTS: readonly CompositeMoment[] = [
  {
    composite: 'BookingForm',
    moment: 'collect booking details',
    repair:
      'with its fields list (date, time, choice and party size), its value bound to the details the guest already gave so they ' +
      'arrive pre-filled, and one submit action, and drop the hand-built inputs or read-back.',
    lacks: ['BookingConfirmation'],
    standsAsideForSettled: true,
    inputs: { types: BOOKING_INPUTS, min: 2 },
    // T-0266: a fully specified ask read back as a DescriptionList with a confirm Button is still this moment.
    // T-0331: the Button is keyed on its action (round 9 :84 "Book now" is `confirm_booking` with `submit`; r5 ask-3 is
    // `confirm_boat_tour`), so an info CTA ("Reserve a table" `start_intent`, "Book now" `book_listing`) stays clean.
    readBack: BOOKING_READ_BACK,
    words: /\b(book|booking|reserve|reservation|guest|guests|party)\b/i,
    ask: { moment: 'booking', cue: BOOK_ASK, rank: 2, surface: 'a BookingForm with its value bound to the details the guest already gave, so they arrive pre-filled' },
  },
  {
    composite: 'BookingConfirmation',
    moment: 'confirm a completed booking',
    repair:
      "in place of the hand-built Card, never inside one: resend the Card's id as the BookingConfirmation (a root Card needs the " +
      'surface re-created and its data model sent again), with its title, data bound to the booking object, and rows as a literal ' +
      'array of {label, path} where each path is a key of that object (never bind rows itself); drop the hand-built rows.',
    lacks: ['BookingForm'],
    notInside: ['Card'],
    noInputs: BOOKING_INPUTS,
    words: SETTLED_WORDS,
    settledSignals: true,
    standsAsideForReadBack: true,
    ask: {
      moment: 'confirm',
      cue: CONFIRM_ASK,
      rank: 0,
      surface:
        "a BookingConfirmation reading back the values on the open BookingForm (the guest's confirm in chat is their submission, so nothing waits on the form button; add no reference number)",
    },
  },
  {
    composite: 'BoardGrid',
    moment: 'a board of cells to target or mark',
    repair: 'with rows, cols and cells bound to the data model and one actionName, and drop the hand-built grid or guess field.',
    lacks: ['CardTable', 'PlayingCard'],
    gridOf: { child: 'Button', min: 3 },
    inputCue: { types: ['TextField'], cue: /guess/i, words: /\b(letter|letters|word|words)\b/i },
  },
  {
    composite: 'GameHud',
    moment: 'a game score and status strip',
    repair: 'with its title, status and stats (and progress when the game counts turns), beside the BoardGrid when the game has one, and drop the hand-built score text or stat badges.',
    // T-0358: a CardTable's zone score Badges are its own HUD (the game-hud mini-skill teaches them).
    lacks: ['CardTable'],
    has: ['BoardGrid'],
    // T-0358: the Mentalist, the Negotiator and the Dungeon Master play with no board (smoke round 2026-10-18-smoke).
    boardless: {
      game: HUD_GAME_WORDS,
      statStrip: {
        types: ['Badge', 'Stat', 'Progress'],
        // T-0365: the Dungeon Master's HP and Gold as two Texts in a Row.
        groupTypes: ['Text'],
        cue: /\b(hp|hit points|gold|lives|mood|asking|counter|confidence|questions|score|guesses|attempts|tries)\b/i,
        // T-0365: "Q1 of 20", "Q 1/20", "Round 2/5"; a bare "3 of 6" or "3/6" is none.
        counter: /\b(q|question|round|turn|guess|attempt|try)\s*\d+\s*(of|\/)\s*\d+\b/i,
        min: 2,
      },
    },
    wordTypes: ['Text', 'Badge', 'Stat'],
    words: /\b(guess|guesses|shot|shots|ship|ships|remaining|score|attempt|attempts|tries)\b/i,
  },
  {
    composite: 'ResultCard',
    moment: 'a settled game, deal or booking outcome and its next action',
    repair: 'with its outcome, title, summary and stats and the next action, and drop the hand-built result text.',
    lacks: [],
    has: ['BoardGrid'],
    // T-0364: the Mentalist, the Negotiator and the Dungeon Master end with no board. A bare "you won" is mid-game too
    // ("you won 20 gold"), so the surface also needs an end signal. A croupier hand (a CardTable, or PlayingCards dealt by
    // hand) settles on its own table and its skills name no ResultCard; a Toast is the passing round result the round-loop
    // workflow sanctions. Neither is in `lacks`, so neither answers a carried RESULT_CARD_MISSING.
    boardless: {
      game: GAME_WORDS,
      end: /\b(game over|final score|you (won|lost|win|lose) the (game|match|quiz)|play again|rematch|deal struck)\b/i,
      restart: /\b(new game|new adventure|new quest)\b/i,
      standAside: ['CardTable', 'PlayingCard'],
      skipWordTypes: ['Toast'],
    },
    words: /\b(game over|you win|you won|you lose|you lost|the word was|play again)\b/i,
  },
  {
    // T-0361: the quest-log skill keeps the scenes in a Timeline; Haiku 5.5 listed them as a Column of numbered Texts.
    composite: 'Timeline',
    moment: 'events in time order',
    repair: 'with its label and one TimelineItem per scene in the order played, and drop the hand-built scene list.',
    requires: ['TimelineItem'],
    lacks: [],
    boardless: { game: GAME_WORDS },
    logOf: { types: ['Column', 'List'], heading: /\b(scenes|quest log|adventure log|journal|chronicle)\b/i, shapes: [/^\s*scene\s+\d/i, /^\s*\d+[.):]?\s+\S/] },
  },
  {
    // T-0279 (Kim's ruling): a priced, bookable treatment or service list is one ProductCard each, never a Table.
    composite: 'ProductCard',
    moment: 'one product, room or offer to buy or book',
    repair:
      'per item, templated in a Grid over the list in the data model (title, price, the duration or unit as priceNote, and one ' +
      'action with the item id in its context), and drop the hand-built priced rows.',
    // Not `requires: ['Table']`: required types' props never count as words, and the Table's label carries them.
    lacks: ['BookingForm', 'BookingConfirmation', 'CardTable'],
    tableColumn: { cue: /\b(price|prices|cost|rate|fee)\b/i },
    // T-0322: a services ask answered with priced DescriptionList rows (round 8 :90) or a priced List is this moment too.
    pricedRows: { types: ['DescriptionList', 'List'], cue: /[€$£¥]\s?\d|\d\s?(?:€|eur|usd|gbp)\b/i },
    words: /\b(book|bookable|treatment|treatments|service|services|spa|massage|room|rooms|offer|offers)\b/i,
    ask: { moment: 'services', cue: SERVICES_ASK, rank: 1, surface: 'one ProductCard per service the guest can book, templated in a Grid, each with its price and book action' },
  },
]

const WORD_PROPS = ['text', 'label', 'title', 'status'] as const

/** A component's literal words: its text, label, title and status strings. */
const wordsOf = (c: A2uiComponent): string =>
  WORD_PROPS.map((k) => c[k])
    .filter((v): v is string => typeof v === 'string')
    .join(' ')

const boundPath = (v: unknown): string =>
  typeof v === 'object' && v !== null && typeof (v as { path?: unknown }).path === 'string' ? (v as { path: string }).path : ''

const upperSnake = (type: string): string => type.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
const kebab = (type: string): string => type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** T-0322: the row texts a DescriptionList (its literal or bound `rows`) or a List (its children's words) lists. */
function rowTexts(c: A2uiComponent, view: SurfaceView): string[] {
  if (c.component === 'DescriptionList') {
    const rows = bound(c['rows'], view)
    if (!Array.isArray(rows)) return []
    return rows.map((r) => (typeof r === 'object' && r !== null ? ['label', 'value'].map((k) => String((r as Record<string, unknown>)[k] ?? '')).join(' ') : ''))
  }
  return childIds(c).map((id) => {
    const child = view.components.get(id)
    return child === undefined ? '' : [wordsOf(child), ...childIds(child).map((g) => wordsOf(view.components.get(g) ?? { id: g, component: '' }))].join(' ')
  })
}

/** T-0333: a settled-status signal: a Badge, a Card or CardHeader title, or a heading Text (h1 to h5), never caption or body Text. */
const isSettledSignal = (c: A2uiComponent): boolean =>
  c.component === 'Badge' || c.component === 'Card' || c.component === 'CardHeader' || (c.component === 'Text' && /^h[1-5]$/.test(String(c['variant'] ?? '')))

/** A prop as written, or read from the data model when bound (`{path}`). */
function bound(v: unknown, view: SurfaceView): unknown {
  const path = boundPath(v)
  return path === '' ? v : path.startsWith('/') ? readPointer(view.dataModel, path) : undefined
}

const stringOf = (v: unknown, view: SurfaceView): string => {
  const b = bound(v, view)
  return typeof b === 'string' ? b : ''
}

/** A Button's words: its `label` (literal or bound), else the text of its `child` or `children`. */
function buttonWords(c: A2uiComponent, view: SurfaceView): string {
  const label = stringOf(c['label'], view)
  if (label !== '') return label
  return childIds(c)
    .map((id) => stringOf(view.components.get(id)?.['text'], view))
    .join(' ')
}

/** T-0331: whether a Button submits the read-back: its action submits or is named like a confirm, else a
 *  label fallback for an action that starts no intent. */
function submitsReadBack(c: A2uiComponent, view: SurfaceView, rb: NonNullable<CompositeMoment['readBack']>): boolean {
  const action = c['action']
  const a = typeof action === 'object' && action !== null ? (action as Record<string, unknown>) : {}
  const name = typeof a['action'] === 'string' ? a['action'] : ''
  if (a['submit'] === true || rb.action.test(name)) return true
  return name !== 'start_intent' && rb.cue.test(buttonWords(c, view))
}

type StatStrip = NonNullable<NonNullable<CompositeMoment['boardless']>['statStrip']>

/** T-0365: a strip's `cue` and `counter` as one global pattern. */
function statPattern(strip: StatStrip): RegExp {
  return new RegExp([strip.cue, strip.counter].filter((re) => re !== undefined).map((re) => re.source).join('|'), 'gi')
}

/** T-0358: the components holding at least `min` game-stat items (a `types` component's words, literal or bound, or a
 *  DescriptionList row; T-0365: each distinct stat a component names counts, and a `groupTypes` component counts when
 *  it opens on its stat inside a sibling group whose stat items reach `min`), or `[]`. */
function statStrays(strip: StatStrip, comps: readonly A2uiComponent[], view: SurfaceView): A2uiComponent[] {
  const stats = statPattern(strip)
  const opens = new RegExp(`^\\s*(?:${stats.source})\\s*(:|\\d|$)`, 'i')
  const words = (c: A2uiComponent): string => WORD_PROPS.map((k) => stringOf(c[k], view)).join(' ').trim()
  /** The distinct stats a component names (T-0365: "HP 12/12, Gold 0" is two). */
  const statsOf = (c: A2uiComponent): number => {
    const t = words(c)
    if (strip.groupTypes?.includes(c.component) === true && !opens.test(t)) return 0
    if (!strip.types.includes(c.component) && strip.groupTypes?.includes(c.component) !== true) return 0
    return new Set([...t.matchAll(stats)].map((m) => m[0].toLowerCase().replace(/\s+/g, ''))).size
  }
  // T-0365: the `groupTypes` components in a sibling group (a parent's direct children, one single-child wrapper looked
  // through) whose stat items reach `min`.
  const grouped = new Set<A2uiComponent>()
  if (strip.groupTypes !== undefined && strip.groupTypes.length > 0) {
    for (const parent of comps) {
      const members = childIds(parent)
        .map((id) => view.components.get(id))
        .map((k) => {
          const only = k === undefined ? [] : childIds(k)
          return only.length === 1 && statsOf(k!) === 0 ? view.components.get(only[0]!) : k
        })
        .filter((k): k is A2uiComponent => k !== undefined && statsOf(k) > 0)
      if (members.reduce((n, k) => n + statsOf(k), 0) < strip.min) continue
      for (const k of members) if (strip.groupTypes.includes(k.component)) grouped.add(k)
    }
  }
  let items = 0
  const found: A2uiComponent[] = []
  for (const c of comps) {
    const hits = strip.types.includes(c.component) || grouped.has(c)
      ? statsOf(c)
      : c.component === 'DescriptionList' ? rowTexts(c, view).filter((t) => new RegExp(stats.source, 'i').test(t)).length : 0
    if (hits === 0) continue
    items += hits
    found.push(c)
  }
  return items >= strip.min ? found : []
}

/** Each component's parent, by child id (`child` or explicit `children`). */
function parentsOf(view: SurfaceView): Map<string, A2uiComponent> {
  const parent = new Map<string, A2uiComponent>()
  for (const c of view.components.values()) for (const id of childIds(c)) parent.set(id, c)
  return parent
}

/** T-0361: the containers that list a log's parallel entries under its nearest heading, or `[]`. */
function logStrays(log: NonNullable<CompositeMoment['logOf']>, comps: readonly A2uiComponent[], view: SurfaceView): A2uiComponent[] {
  const parent = parentsOf(view)
  const get = (id: string): A2uiComponent | undefined => view.components.get(id)
  const textOf = (c: A2uiComponent | undefined): string => (c === undefined ? '' : ['label', 'title', 'text'].map((k) => stringOf(c[k], view)).join(' ').trim())
  /** An entry's words: a Text's, or a Row's Texts joined (a number and a name); undefined for any other shape. */
  const entryOf = (c: A2uiComponent | undefined): string | undefined => {
    if (c?.component === 'Text') return textOf(c)
    if (c?.component !== 'Row') return undefined
    const kids = childIds(c).map(get)
    return kids.length > 0 && kids.every((k) => k?.component === 'Text') ? kids.map(textOf).join(' ') : undefined
  }
  /** The nearest heading: a Text just before the component in its parent, its own label or title, else the same one level up,
   *  a Card's title or CardHeader words ending the climb. */
  const headingOf = (c: A2uiComponent): string => {
    const seen = new Set<string>()
    for (let at: A2uiComponent | undefined = c; at !== undefined && !seen.has(at.id); at = parent.get(at.id)) {
      seen.add(at.id)
      if (at.component === 'Card') {
        const header = childIds(at).map(get).find((k) => k?.component === 'CardHeader')
        return [textOf(at), ...(header === undefined ? [] : childIds(header).map((id) => textOf(get(id))))].join(' ')
      }
      const siblings = childIds(parent.get(at.id) ?? at)
      const before = get(siblings[siblings.indexOf(at.id) - 1] ?? '')
      if (before?.component === 'Text') return textOf(before)
      if (textOf(at) !== '') return textOf(at)
    }
    return ''
  }
  return comps.filter((c) => {
    if (!log.types.includes(c.component)) return false
    const headed = log.heading.test(headingOf(c))
    const template = typeof c.children === 'object' && c.children !== null && !Array.isArray(c.children) ? (c.children as { componentId?: unknown }).componentId : undefined
    if (typeof template === 'string') return headed && get(template)?.component === 'Text'
    const entries = childIds(c).map((id) => entryOf(get(id)))
    if (entries.length === 0 || entries.some((e) => e === undefined)) return false
    const shapes = new Set(entries.map((e) => log.shapes.findIndex((re) => re.test(e!))))
    if (shapes.size !== 1) return false
    const [shape] = shapes
    if (!headed) return shape === 0 && entries.length >= 2
    return shape === -1 ? entries.length >= 2 : true
  })
}

/** T-0361 review: every composite type of the rows, with the types each reads; none of their props count as words. */
const COMPOSITE_TYPES: ReadonlySet<string> = new Set(COMPOSITE_MOMENTS.flatMap((m) => [m.composite, ...(m.requires ?? []), ...(m.has ?? [])]))

/** T-0361 review: a row's `end` and `restart` phrases as one global pattern, built once per row, taken out of the game words. */
function endPhrases(m: CompositeMoment): RegExp | undefined {
  const phrases = [m.boardless?.end, m.boardless?.restart].filter((re): re is RegExp => re !== undefined)
  return phrases.length === 0 ? undefined : new RegExp(phrases.map((re) => re.source).join('|'), 'gi')
}

/** The components of `view` that hand-build `m`'s moment, or `[]` when the row does not fire. */
function strays(m: CompositeMoment, view: SurfaceView, intent: string | undefined, ending: RegExp | undefined): A2uiComponent[] {
  const comps = [...view.components.values()]
  const types = new Set(comps.map((c) => c.component))
  if ([m.composite, ...m.lacks].some((t) => types.has(t))) return []
  // T-0358, T-0364: with none of `has`, the row runs only through its `boardless` gate (T-0361: so does a row with no `has`).
  const boardless = m.has === undefined ? m.boardless : !m.has.some((t) => types.has(t)) ? m.boardless ?? null : undefined
  if (boardless === null) return []
  if (boardless?.standAside?.some((t) => types.has(t)) === true) return []
  if (m.noInputs !== undefined && m.noInputs.some((t) => types.has(t))) return []
  // No composite's own props count as words (T-0361 review: every row's, not only this one's).
  const worded = comps.filter(
    (c) =>
      !COMPOSITE_TYPES.has(c.component) &&
      (m.wordTypes === undefined || m.wordTypes.includes(c.component)) &&
      boardless?.skipWordTypes?.includes(c.component) !== true &&
      (m.settledSignals !== true || isSettledSignal(c)),
  )
  const liveReadBack = (): boolean =>
    comps.some((c) => BOOKING_READ_BACK.types.includes(c.component)) &&
    comps.some((c) => c.component === 'Button' && submitsReadBack(c, view, BOOKING_READ_BACK))
  if (m.standsAsideForReadBack === true && liveReadBack()) return []
  if (m.standsAsideForSettled === true && comps.some((c) => isSettledSignal(c) && SETTLED_WORDS.test(wordsOf(c))) && !liveReadBack()) return []
  const surfaceWords = worded.map(wordsOf).join(' ')

  const end = boardless?.end
  // T-0361 review: a restart phrase ends the game only once no live play control is left on the surface.
  const restart = boardless?.restart
  const ended = (words: string): boolean =>
    end?.test(words) === true ||
    (restart?.test(words) === true && !comps.some((c) => PLAY_CONTROLS.includes(c.component) && !(c.component === 'Button' && restart.test(buttonWords(c, view)))))
  if (boardless !== undefined) {
    const unended = ending === undefined ? surfaceWords : surfaceWords.replace(ending, ' ')
    // T-0365: a counter alone ("Round 2 of 4") names no game.
    const counter = boardless.statStrip?.counter
    const gameWords = counter === undefined ? unended : unended.replace(new RegExp(counter.source, 'gi'), ' ')
    if (!boardless.game.test(gameWords)) return []
    if (boardless.statStrip !== undefined) return statStrays(boardless.statStrip, comps, view)
    if (end !== undefined && !ended(surfaceWords)) return []
  }

  if (m.logOf !== undefined) return logStrays(m.logOf, comps, view)
  if (m.gridOf !== undefined || m.inputCue !== undefined) {
    const { gridOf, inputCue } = m
    const grids = gridOf === undefined ? [] : comps.filter((c) => {
      if (c.component !== 'Grid' || !Array.isArray(c.children) || c.children.length < gridOf.min) return false
      return c.children.every((id) => view.components.get(id)?.component === gridOf.child)
    })
    const cued =
      inputCue === undefined || !inputCue.words.test(surfaceWords)
        ? []
        : comps.filter((c) => inputCue.types.includes(c.component) && [c['label'], c['name'], boundPath(c['value'])].some((v) => typeof v === 'string' && inputCue.cue.test(v)))
    return [...grids, ...cued]
  }
  if (m.words !== undefined && !m.words.test(surfaceWords)) return []
  if (m.tableColumn !== undefined) {
    const { cue } = m.tableColumn
    const tables = comps.filter(
      (c) =>
        c.component === 'Table' &&
        Array.isArray(c['columns']) &&
        (c['columns'] as unknown[]).some((col) => typeof col === 'object' && col !== null && ['key', 'label'].some((k) => {
          const v = (col as Record<string, unknown>)[k]
          return typeof v === 'string' && cue.test(v)
        })),
    )
    const { pricedRows, ask } = m
    const asked = pricedRows !== undefined && ask !== undefined && intent !== undefined && ask.cue.test(intent)
    const priced = asked ? comps.filter((c) => pricedRows.types.includes(c.component) && rowTexts(c, view).some((t) => pricedRows.cue.test(t))) : []
    return [...tables, ...priced]
  }
  if (m.inputs !== undefined) {
    const inputs = comps.filter((c) => m.inputs!.types.includes(c.component))
    if (inputs.length >= m.inputs.min) return inputs
    if (m.readBack === undefined || inputs.length > 0) return []
    const rb = m.readBack
    const rows = comps.filter((c) => rb.types.includes(c.component))
    const confirms = comps.filter((c) => c.component === 'Button' && submitsReadBack(c, view, rb))
    return rows.length > 0 && confirms.length > 0 ? [...rows, ...confirms] : []
  }
  return m.words === undefined ? [] : worded.filter((c) => m.words!.test(wordsOf(c)) || (end !== undefined && ended(wordsOf(c))))
}

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** T-0262: the components of `view` of a `notInside` type whose subtree holds `m`'s composite, or `[]`. */
function wrappers(m: CompositeMoment, view: SurfaceView): A2uiComponent[] {
  if (m.notInside === undefined) return []
  const parent = parentsOf(view)
  const found = new Map<string, A2uiComponent>()
  for (const c of view.components.values()) {
    if (c.component !== m.composite) continue
    const seen = new Set<string>([c.id])
    for (let p = parent.get(c.id); p !== undefined && !seen.has(p.id); p = parent.get(p.id)) {
      seen.add(p.id)
      if (m.notInside.includes(p.component)) found.set(p.id, p)
    }
  }
  return [...found.values()]
}

/** The one generator: a row of `COMPOSITE_MOMENTS` as a semantic check. */
export function compositeMomentCheck(m: CompositeMoment): SemanticCheck {
  const code = `${upperSnake(m.composite)}_MISSING`
  const ending = endPhrases(m)
  return {
    id: `composite-moment-${kebab(m.composite)}`,
    requires: [m.composite, ...(m.requires ?? [])],
    check({ surfaces, intent }): readonly SemanticFinding[] {
      const findings: SemanticFinding[] = []
      for (const view of surfaces) {
        const wrapped = wrappers(m, view)
        if (wrapped.length > 0) {
          findings.push({
            code: `${upperSnake(m.composite)}_WRAPPED`,
            path: `${view.surfaceId}:${wrapped[0]!.id}`,
            message:
              `${view.surfaceId} wraps its ${m.composite} in ${wrapped.map((c) => `${c.id} (a ${c.component})`).join(', ')}, a card around a card. ` +
              `Make it ONE ${m.composite} ${m.repair}`,
          })
          continue
        }
        const found = strays(m, view, intent, ending)
        if (found.length === 0) continue
        findings.push({
          code,
          path: `${view.surfaceId}:${found[0]!.id}`,
          message:
            `${view.surfaceId} hand-builds ${m.moment} with ${found.map((c) => `${c.id} (a ${c.component})`).join(', ')}. ` +
            `Make it ONE ${m.composite} ${m.repair}`,
        })
      }
      return findings
    },
  }
}

export const compositeMomentChecks: readonly SemanticCheck[] = COMPOSITE_MOMENTS.map(compositeMomentCheck)

/** T-0313: the rows that carry an ask cue, in precedence order. */
const ASKED = COMPOSITE_MOMENTS.filter((m) => m.ask !== undefined).sort((a, b) => a.ask!.rank - b.ask!.rank)

/** T-0313: the composite moment a turn's words ask for, with the surface that answers it, or undefined. */
export function askedCompositeMoment(intent: string): { moment: string; surface: string } | undefined {
  const ask = ASKED.find((m) => m.ask!.cue.test(intent))?.ask
  return ask === undefined ? undefined : { moment: ask.moment, surface: ask.surface }
}

/** T-0299: the row a `<COMPOSITE>_MISSING` code names, or undefined for any other code. */
export function missingCompositeMoment(code: string): CompositeMoment | undefined {
  return COMPOSITE_MOMENTS.find((m) => `${upperSnake(m.composite)}_MISSING` === code)
}

/** T-0299: whether these surfaces answer `m`'s moment: one holds the composite or a type the row stands aside for. */
export function compositeAnswered(m: CompositeMoment, views: readonly SurfaceView[]): boolean {
  return views.some((view) => [...view.components.values()].some((c) => c.component === m.composite || m.lacks.includes(c.component)))
}
