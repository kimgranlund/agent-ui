// composite-moments.ts: "use composite X for moment Y" as data-driven semantic checks (T-0208).
//
// Each row of `COMPOSITE_MOMENTS` names a registered composite, one of its `selection.json` intents (the moment),
// and a narrow structural detector for a surface that hand-builds that moment without it (CA-R9 lever 3). One
// generator turns every row into a `SemanticCheck` (ADR-0238) whose finding sends the model back to make the
// surface ONE composite. A row's `notInside` also sends back a composite wrapped in a card of its own (T-0262,
// `<COMPOSITE>_WRAPPED`). The check `requires` the composite (and any type it reads), so `gateChecksOnCatalog`
// keeps a row on exactly the catalogs that can emit it: the booking and Itinerary rows ride `<base>--hospitality`, the games rows
// ride `agent-ui` until the games types move to a domain, the ProductCard, ConfirmReceipt, AmountPicker and Swatch rows ride `agent-ui`, the
// ContrastPair row (T-0377) rides `agent-ui--stylist`, the CardTable row (T-0586) rides the croupier's catalogs, and
// `a2ui-basic` gets none.
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
// for a surface that already holds one. T-0399: a ConfirmReceipt with the literal status "confirmed" is a settled signal
// too, and the confirmation row lacks ConfirmReceipt, so the T-0385 settle in place fires neither row.
// T-0401: the confirm ask's surface is that settle in place; the hospitality twin on a catalog with no ConfirmReceipt
// keeps the T-0289 read-back.
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
// T-0409: hospitality and commerce turns share the catalog, so GAME_WORDS holds only words a game being played uses
// (quest, HP, the word was). game, games and adventure name a topic or a product as often ("Your Iceland adventure", a
// loyalty game, a game show, board games on a shelf) and open no gate; no recorded game surface needed them.
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
//
// T-0359 (smoke round 2026-10-18-smoke :9, Haiku 5.5): "Propose a calm blue palette for a banking app." was answered in
// prose with no surface: a navy primary, a steel-blue secondary and a sky accent, in words. The Swatch row's `prose`
// turns that into a second check (`compositeProseCheck`), judged on the reply, never the ask (Kim, 2026-10-18): on the
// Stylist's catalog alone (it requires ContrastPair, the Stylist's type), on a turn of a session that has never shown a
// token surface (Swatch, Ramp or ContrastPair), a reply that lists a palette in its prose (three or more distinct hex
// codes, or three or more named colors set out by role or as list lines) while the turn ships no token surface is
// SURFACE_MISSING.
//
// T-0478 (round 15 cluster P4): the ConfirmReceipt row reads an order or cart built by hand: an AmountPicker quantity line
// (its label, name or bound path names a quantity, "each" or a price) on a surface whose words name an order, a cart or a
// total, with no ConfirmReceipt on it, the shape a shopkeeper add turn shipped after its CHANGE_CLAIMED repair.
// T-0480: "total" no longer opens that gate (a bill's tip AmountPicker beside a "Total" Text is no order).
// T-0550 (round 17 cluster P5): the AmountPicker row reads the inverse shape: on a surface whose words name an order, a
// cart or a basket (the receipt's own title and total label counted), a ConfirmReceipt item whose `quantity` binds a path
// no AmountPicker on the surface binds is SURFACE_MISSING, asking for one AmountPicker per such line. A Haiku add turn's
// CHANGE_CLAIMED repair shipped that receipt while its reply said "Adjust the quantity below". The row stands aside for
// the T-0478 row's guards, and an AmountPicker stays an input whose label counts as words for the other rows.
// T-0582 (round 19 clusters P5b and P4b): on a surface with no AmountPicker, a reply that offers to change the quantity
// lets a pending receipt's numeric `rows` line or literal item quantity fire the AmountPicker row too; and the T-0478
// row's order, cart or basket gate also reads the turn's reply, since a hand-built order Card may name it only there.
//
// T-0480 (round 15 cluster Y): the Itinerary row reads the guest's words, not a surface: a say turn that plans a day of
// two or more timed stops ("Plan my Saturday: breakfast at 08:00 ... dinner at 20:00") while no surface of the turn holds
// an Itinerary is ITINERARY_MISSING, judged on a prose round too, since the recorded answer (a party-size ask deck) left
// no hand-built plan on any surface to find.
//
// T-0586 (round 20 cluster G): the CardTable row reads a game pick, not a surface: a `pick_game` press (or one whose value
// names a blackjack-family game) whose reply invites a bet or a deal, while no surface of the turn holds a CardTable or a
// PlayingCard, is SURFACE_MISSING, asking for the table on a fresh surface. A poker pick is dealt on its Card and is never
// judged.
//
// T-0590 (round 21 clusters P4c, P5c and Q): the ConfirmReceipt row's quantity cue also reads an AmountPicker's
// `actionName` and `currency` (a "Brass Desk Lamp" picker with `set_quantity` and "$" on an order Card); the AmountPicker
// row's literal and rows quantities also fire when the user asked for a quantity ("Add two of the first one"), with no
// reply offer; and the ProductCard row reads a browse of hand-made priced Cards (a price in its words and a Button) on a
// product ask ("What lamps do you have?") or a services ask.

import type { A2uiComponent } from '../protocol.ts'
import { readPointer } from './semantic-check.ts'
import type { SemanticAction, SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

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
  /** An input of `types` whose label, name or bound path matches `cue`, while the surface words match `words` (T-0582: with
   *  `reply`, the turn's reply words open the gate too; T-0590: `props` names more string props the cue reads). */
  readonly inputCue?: { readonly types: readonly string[]; readonly cue: RegExp; readonly words: RegExp; readonly reply?: boolean; readonly props?: readonly string[] }
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
  /** T-0590: on a turn whose words match one of `asks`, at least `min` sibling Cards (none holding another Card) whose words
   *  carry a price (`cue`) and whose subtree holds a Button: a browse of hand-made product cards. Read before the row's `words`. */
  readonly pricedCards?: { readonly asks: readonly RegExp[]; readonly cue: RegExp; readonly min: number }
  /** T-0333: read `words` only from settled-status signals (a Badge, a Card or CardHeader title, a heading Text h1 to h5,
   *  T-0399: a literal "confirmed" ConfirmReceipt), never caption or body Text, so a note that says "can be confirmed with the front desk" is no settled booking. */
  readonly settledSignals?: boolean
  /** T-0333: skip the surface when it holds a settled-status signal, unless a live read-back confirm is still on it (that is
   *  not settled), so the BookingConfirmation repair and this one never fire together. */
  readonly standsAsideForSettled?: boolean
  /** T-0333: skip the surface while a live read-back confirm is on it: the BookingForm row owns that shape. */
  readonly standsAsideForReadBack?: boolean
  /** T-0313: the turn words that ask for this moment (`cue`), its short name (the SURFACE_MISSING path), the surface that
   *  answers it, and its precedence when one turn's words ask for two moments (lowest first). */
  readonly ask?: {
    readonly moment: string
    readonly cue: RegExp
    readonly surface: string
    readonly rank: number
  }
  /** T-0480: on a say turn whose words plan (`cue`) at least `min` distinct timed stops (`stop`, a global pattern), a turn
   *  none of whose surfaces holds the composite (or a `lacks` type) is `<COMPOSITE>_MISSING`, with or without a surface. */
  readonly planned?: { readonly cue: RegExp; readonly stop: RegExp; readonly min: number }
  /** T-0359: the moment written out in the reply prose instead of shown: `listed` reads the reply, `types` answer it (a
   *  catalog must hold them all for the check to ride it), and `surface` is what the repair asks for. */
  readonly prose?: { readonly moment: string; readonly types: readonly string[]; readonly listed: (reply: string) => number; readonly surface: string }
  /** T-0550: a component of `of` whose literal `items` bind a `quantity` path (a relative one read under its bound `data`)
   *  that no `composite` on the surface binds as its `value`, while the surface words, with the `of` component's own title
   *  and total label, match `words`. One SURFACE_MISSING per surface names every such path; the composite's presence alone
   *  never answers it, and a templated `composite` (a relative `value`) stands the surface aside. T-0582: on a surface with
   *  no `composite` at all whose turn's reply matches `offer`, a pending `of` with no bound quantity still fires on a `rows`
   *  line whose path holds a number, named by path, or else on a literal item quantity, named by item label. T-0590: so it
   *  does on a turn whose user words match `asked`, a quantity asked for ("Add two"), with no reply offer. */
  readonly unpickedLines?: { readonly of: string; readonly words: RegExp; readonly offer?: RegExp; readonly asked?: RegExp }
  /** T-0586: on an action turn whose action name matches `action` or whose context value names a `game`, where the game
   *  picked (the value, or the reply when the value names no game, as "random" does) names a `game` and no `other` game,
   *  a reply matching `invite` while no surface of the turn holds the composite (or a `lacks` type) is SURFACE_MISSING. */
  readonly picked?: { readonly action: RegExp; readonly game: RegExp; readonly other: RegExp; readonly invite: RegExp }
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
/** T-0582: a reply that offers to change a quantity in one sentence ("You can change the quantity below", "Adjust the
 *  quantity below", "the quantity can be updated"). */
const QUANTITY_OFFER =
  /\b(change|adjust|update|edit|set|pick|increase|decrease)\b[^.!?]{0,40}\b(quantity|quantities|qty|how many)\b|\b(quantity|quantities|qty)\b[^.!?]{0,30}\b(changed|adjusted|updated|edited)\b/i
/** T-0590: the user asks for a quantity of two or more ("Add two of the first one", "I'll take 3"); "one" is a pronoun as
 *  often ("Add the first one") and a price ("$189") is no count. */
const QUANTITY_ASK =
  /\b(add|order|buy|get|take|want|need|like|make it|make that)\s+(?:(?:a|another)\s+)?(?:(?<![$€£¥])\b\d+\b(?![.,]\d)|two|three|four|five|six|seven|eight|nine|ten|a couple|a pair|a dozen|dozen)\b/i
/** T-0590: the user asks what the shop has ("What lamps do you have?", "Do you sell rugs?", "Show me your vases"). */
const PRODUCT_ASK =
  /\b(what|which)\b[^.?!]{0,40}\b(do|does|can)\s+(you|they|the\s+(shop|store))\s+(have|sell|carry|stock|offer)\b|\b(do|does)\s+(you|the\s+(shop|store))\s+(have|sell|carry|stock)\b|\b(show|see)\s+(me\s+)?(your|some|all|any)\b|\b(browse|in stock|for sale)\b/i
/** T-0322: a price in words ("€120", "$189", "95 EUR"). */
const PRICE = /[€$£¥]\s?\d|\d\s?(?:€|eur|usd|gbp)\b/i

/** T-0358, T-0364: the words that name a game on a surface with no board. Generic words (player, level, round, turn)
 *  name none: a podcast player or a Gold level is no game. T-0409: nor do game, games and adventure (a travel adventure,
 *  a game show, board games for sale). */
export const GAME_WORDS = /\b(quest|hp|quiz|trivia|twenty questions|the answer was|the word was|deal sheet|dungeon)\b/i
/** T-0361 review: the GameHud gate also takes round and turn (T-0358's Negotiator, "Round 3, your turn"); its two-stat strip
 *  keeps a dashboard out. */
const HUD_GAME_WORDS = new RegExp(`\\b(round|rounds|turn|turns)\\b|${GAME_WORDS.source}`, 'i')

/** T-0361 review: the controls that keep a game live; a Button whose words only restart it is none. */
const PLAY_CONTROLS: readonly string[] = ['Button', ...BOOKING_INPUTS]

const BOOKING_READ_BACK: NonNullable<CompositeMoment['readBack']> = { types: ['DescriptionList'], action: /^confirm/i, cue: /\bconfirm\b/i }

/** T-0359: the token types that show a palette to the eye, a Swatch per anchor and a Ramp per graded family. */
export const PALETTE_TYPES = ['Swatch', 'Ramp'] as const
/** T-0359 (Kim, 2026-10-18): the token surface types that answer a palette, ContrastPair included. ContrastPair is the
 *  Stylist's own type, so a check that requires all three rides the Stylist's catalog alone. */
export const TOKEN_TYPES = [...PALETTE_TYPES, 'ContrastPair'] as const
/** T-0359: hex color values written out as words: a hex code with a letter, or an all-digit one beside a color word, so an
 *  order or issue number ("Order #482913") is none. */
const HEX_WORDS =
  /#(?=[0-9a-f]{0,5}[a-f])[0-9a-f]{3}(?:[0-9a-f]{3})?\b|\b(colou?rs?|palette|primary|secondary|accent|gr[ae]y|neutral)\b[^.]*#[0-9a-f]{6}\b|#[0-9a-f]{6}\b[^.]*\b(colou?rs?|palette|gr[ae]y|neutral)\b/i

export const COMPOSITE_MOMENTS: readonly CompositeMoment[] = [
  {
    composite: 'BookingForm',
    moment: 'collect booking details',
    repair:
      'with its fields list (date, time, choice and party size), its value bound to the details the guest already gave so they ' +
      'arrive pre-filled, and one submit action, and drop the hand-built inputs or read-back.',
    // T-0198: a StepFlow walks the booking inputs scene by scene (its last scene may be the BookingForm), so it stands aside.
    lacks: ['BookingConfirmation', 'ConfirmReceipt', 'StepFlow'],
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
    // T-0399: a ConfirmReceipt is the confirmation itself (booking-flow and table-reservation settle with one, T-0385).
    lacks: ['BookingForm', 'ConfirmReceipt'],
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
        'ONE ConfirmReceipt, "data" bound to the draft the form\'s value is bound to and "status" the literal "confirmed" (never ' +
        "bound: nothing writes it; the guest's confirm in chat is their submission, so nothing waits on the form button; add no " +
        'reference number)',
    },
  },
  {
    // T-0480 (round 15 cluster Y, reach-concierge-day-itinerary-haiku-3): "Plan my Saturday 21 November 2026: breakfast at
    // 08:00, the half-day coastal boat tour at 10:00 and dinner at Vela at 20:00." was answered with the plan in prose and
    // then a party-size ask deck alone, so the plan never reached a surface.
    composite: 'Itinerary',
    moment: 'a trip or day plan as days of timed stops',
    repair:
      'on a surface of its own (a fresh id, never an "ask-<n>" one) with its title and days bound to the plan in the data ' +
      'model: one day per date with its label and stops, one stop per timed item in the order given, with its time, its label ' +
      'and status "pending" while it is still to be confirmed. The guest asked for the plan, so it is this turn\'s one surface ' +
      'and the turn declares no ask: what a booking still needs (the party size) waits until the guest books.',
    lacks: [],
    planned: {
      // T-0484: "schedule" is a plan as a noun ("a schedule for Saturday") or of a span ("schedule my day"); as a booking verb
      // ("schedule a massage at 15:00", "schedule the spa at 3pm") it asks for bookings, which the booking rows answer.
      cue: /\b(plan|planning|itinerary)\b|\b(a|an|my|our|the|daily)\s+schedule\b|\bschedule\s+(my|our)\s+(day|days|trip|weekend|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      stop: /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)\b/gi,
      min: 2,
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
    // T-0586 (round 20 cluster G, pick-croupier-game-deck-haiku-2 and -3): the `pick_game` press for blackjack was answered
    // by relabelling and disabling the OptionDeck, or by a Column of two Texts, while the reply said "Place your bet to
    // deal", and no table opened. Hold'em, stud and draw are dealt on a Card of PlayingCards (T-0323), never a CardTable,
    // so a pick of one of them is not judged, and a PlayingCard hand stands the turn aside.
    composite: 'CardTable',
    moment: 'a blackjack table: bet, hands, actions, result',
    repair: 'on a fresh surface (table-1, table-2 and on) in phase "betting", bet and bankroll bound, "betAction":"deal".',
    lacks: ['PlayingCard'],
    picked: {
      action: /^pick_game$/,
      game: /\b(blackjack|black[- ]jack|twenty[- ]one|spanish[- ]21|pontoon)\b/i,
      other: /\b(poker|stud|hold[- ]?['’]?em|omaha|razz|draw|baccarat|roulette|craps)\b/i,
      invite: /\b(bet|bets|betting|wager|stake|deal|deals|dealt|dealing)\b/i,
    },
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
      'action with the item id in its context), and drop the hand-built priced rows or cards.',
    // Not `requires: ['Table']`: required types' props never count as words, and the Table's label carries them.
    lacks: ['BookingForm', 'BookingConfirmation', 'ConfirmReceipt', 'CardTable'],
    tableColumn: { cue: /\b(price|prices|cost|rate|fee)\b/i },
    // T-0322: a services ask answered with priced DescriptionList rows (round 8 :90) or a priced List is this moment too.
    pricedRows: { types: ['DescriptionList', 'List'], cue: PRICE },
    // T-0590 (round 21 cluster Q, :42): "What lamps do you have?" answered with four Cards, each a name, a price Text and a Button.
    pricedCards: { asks: [SERVICES_ASK, PRODUCT_ASK], cue: PRICE, min: 2 },
    words: /\b(book|bookable|treatment|treatments|service|services|spa|massage|room|rooms|offer|offers)\b/i,
    ask: { moment: 'services', cue: SERVICES_ASK, rank: 1, surface: 'one ProductCard per service the guest can book, templated in a Grid, each with its price and book action' },
  },
  {
    // T-0478 (round 15 cluster P4, reach-shopkeeper-cart-amount-haiku-2): an add to the order answered with an order
    // Column of AmountPicker lines and a total Text, no ConfirmReceipt. The cart is read back as ONE ConfirmReceipt beside
    // its AmountPicker quantity lines (the shopkeeper's cart-summary); a negotiator deal sheet (GameHud) and a room booking
    // walk (StepFlow) carry AmountPickers of their own and stand aside.
    composite: 'ConfirmReceipt',
    moment: 'a booking or order read back to confirm, then its receipt',
    repair:
      'for the order, beside its AmountPicker lines: its title, items as {label, quantity, amount} with each quantity bound to ' +
      'the path its AmountPicker binds, totalLabel and totalPath, status "pending", and confirmAction and backAction (it draws ' +
      'its own Confirm and Back, so add no Button); keep each AmountPicker, and drop the hand-built order title and total.',
    lacks: ['BookingForm', 'BookingConfirmation', 'StepFlow', 'GameHud'],
    // T-0480: no "total": a bill's tip AmountPicker beside a "Total" Text is no order.
    // T-0582 (round 19 cluster P4b): the reply's words open the gate too ("Your order summary is below the shelf").
    // T-0590 (round 21 cluster P4c, :80): the cue reads the picker's actionName ("set_quantity") and currency ("$") too.
    inputCue: { types: ['AmountPicker'], cue: /qty|quantity|\beach\b|\$/i, words: /\b(order|cart|basket)\b/i, reply: true, props: ['actionName', 'currency'] },
  },
  {
    // T-0550 (round 17 cluster P5, reach-shopkeeper-cart-amount-haiku-3): the inverse of the row above. A CHANGE_CLAIMED
    // repair resent shop-lamps-1 with an `order` ConfirmReceipt whose item quantity binds `/lamp/qty` and no AmountPicker
    // writing it, while the reply said "Adjust the quantity below". The shopkeeper's cart-summary asks for one AmountPicker
    // per cart line bound to its quantity; the same guards stand aside.
    composite: 'AmountPicker',
    moment: 'pick a quantity or amount with plus and minus',
    repair:
      'per such line, its value bound to that quantity path (min 1, step 1, no slider, no actionName: the receipt\'s Confirm ' +
      'commits), beside the ConfirmReceipt; keep the ConfirmReceipt and its items as they are.',
    requires: ['ConfirmReceipt'],
    lacks: ['BookingForm', 'BookingConfirmation', 'StepFlow', 'GameHud'],
    // T-0582 (round 19 cluster P5b): a literal or rows quantity counts while the reply offers to change it ("You can change
    // the quantity below", "Adjust the quantity below").
    // T-0590 (round 21 cluster P5c, :124): or while the user asked for a quantity ("Add two of the first one").
    unpickedLines: { of: 'ConfirmReceipt', words: /\b(order|cart|basket)\b/i, offer: QUANTITY_OFFER, asked: QUANTITY_ASK },
  },
  {
    // T-0359: a palette is shown, never listed: hex values written in Text are the hand-built moment, and (on the Stylist)
    // a palette listed in the reply prose with no token surface is sent back by the row's prose check.
    composite: 'Swatch',
    moment: 'show one color value',
    repair: 'per anchor color with its label and value, and one Ramp per color family, and drop the hex values written as text.',
    requires: PALETTE_TYPES.slice(1),
    lacks: [...PALETTE_TYPES.slice(1), 'ColorPicker'],
    wordTypes: ['Text'],
    words: HEX_WORDS,
    prose: {
      moment: 'palette',
      types: TOKEN_TYPES,
      listed: proseColors,
      surface: 'one Swatch per anchor color with its label and value, one Ramp per color family, and one ContrastPair per text pairing',
    },
  },
  {
    // T-0377 (round 12 :3, :96, :197, Haiku 5.5): a palette rooted a Card > CardContent > Column holding its ContrastPairs.
    // A ContrastPair draws its own card (the approved mockup, ADR-0244), so the render lint failed nested-card. The row has
    // no hand-built detector: it only sends back a ContrastPair wrapped in a Card (CONTRAST_PAIR_WRAPPED).
    composite: 'ContrastPair',
    moment: 'a text color on a background with its contrast rating',
    repair:
      'per text pairing with its foreground, background and label, never inside a Card: drop the Card around them with its ' +
      'CardHeader and CardContent (a root Card needs the surface re-created and its data model sent again), and hold the ' +
      "Card's title Text first, then each Swatch, Ramp and ContrastPair, in a root Column.",
    lacks: [],
    notInside: ['Card'],
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

/** T-0333: a settled-status signal: a Badge, a Card or CardHeader title, or a heading Text (h1 to h5), never caption or body Text.
 *  T-0399: also a ConfirmReceipt whose status is the literal "confirmed" (the T-0385 settle in place), never a bound or pending one. */
export const isSettledSignal = (c: A2uiComponent): boolean =>
  c.component === 'Badge' ||
  c.component === 'Card' ||
  c.component === 'CardHeader' ||
  (c.component === 'Text' && /^h[1-5]$/.test(String(c['variant'] ?? ''))) ||
  (c.component === 'ConfirmReceipt' && c['status'] === 'confirmed')

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

/** T-0361 review: every composite type of the rows, with the types each reads; none of their props count as words.
 *  T-0550: an `unpickedLines` row's composite (AmountPicker) is an input, so its label still counts (T-0478 reads it). */
const COMPOSITE_TYPES: ReadonlySet<string> = new Set(
  COMPOSITE_MOMENTS.flatMap((m) => [...(m.unpickedLines === undefined ? [m.composite] : []), ...(m.requires ?? []), ...(m.has ?? [])]),
)

/** T-0361 review: a row's `end` and `restart` phrases as one global pattern, built once per row, taken out of the game words. */
function endPhrases(m: CompositeMoment): RegExp | undefined {
  const phrases = [m.boardless?.end, m.boardless?.restart].filter((re): re is RegExp => re !== undefined)
  return phrases.length === 0 ? undefined : new RegExp(phrases.map((re) => re.source).join('|'), 'gi')
}

/** The components of `view` that hand-build `m`'s moment, or `[]` when the row does not fire. */
function strays(m: CompositeMoment, view: SurfaceView, intent: string | undefined, ending: RegExp | undefined, reply: string | undefined): A2uiComponent[] {
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
      inputCue === undefined || !(inputCue.words.test(surfaceWords) || (inputCue.reply === true && reply !== undefined && inputCue.words.test(reply)))
        ? []
        : comps.filter(
            (c) =>
              inputCue.types.includes(c.component) &&
              [c['label'], c['name'], boundPath(c['value']), ...(inputCue.props ?? []).map((k) => c[k])].some((v) => typeof v === 'string' && inputCue.cue.test(v)),
          )
    return [...grids, ...cued]
  }
  const cards = m.pricedCards !== undefined && intent !== undefined && m.pricedCards.asks.some((re) => re.test(intent)) ? pricedCards(m.pricedCards, comps, view) : []
  if (cards.length > 0) return cards
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

/** T-0590: the Cards (none holding another Card) whose words, literal or bound, carry a price and whose subtree holds a
 *  Button, in each parent holding at least `min` of them (a browse lists its cards side by side; an order Card beside one
 *  product card is none), or `[]`. */
function pricedCards(spec: NonNullable<CompositeMoment['pricedCards']>, comps: readonly A2uiComponent[], view: SurfaceView): A2uiComponent[] {
  const subtree = (c: A2uiComponent): A2uiComponent[] => {
    const out: A2uiComponent[] = []
    const seen = new Set<string>([c.id])
    const walk = (at: A2uiComponent): void => {
      for (const id of childIds(at)) {
        const k = view.components.get(id)
        if (k === undefined || seen.has(id)) continue
        seen.add(id)
        out.push(k)
        walk(k)
      }
    }
    walk(c)
    return out
  }
  const parent = parentsOf(view)
  const byParent = new Map<string, A2uiComponent[]>()
  for (const c of comps) {
    if (c.component !== 'Card') continue
    const inner = subtree(c)
    if (inner.some((k) => k.component === 'Card') || !inner.some((k) => k.component === 'Button')) continue
    if (![c, ...inner].some((k) => WORD_PROPS.some((p) => spec.cue.test(stringOf(k[p], view))))) continue
    const at = parent.get(c.id)?.id ?? ''
    byParent.set(at, [...(byParent.get(at) ?? []), c])
  }
  return [...byParent.values()].filter((cards) => cards.length >= spec.min).flat()
}

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** T-0377: the component a template ChildList stamps (`{path, componentId}`), or undefined. */
const templateChild = (c: A2uiComponent): string | undefined => {
  const kids = c.children as unknown
  return typeof kids === 'object' && kids !== null && !Array.isArray(kids) && typeof (kids as { componentId?: unknown }).componentId === 'string'
    ? (kids as { componentId: string }).componentId
    : undefined
}

/** T-0262: the components of `view` of a `notInside` type whose subtree holds `m`'s composite, or `[]`. T-0377: a
 *  template's stamped component counts as its child, since each stamped copy renders inside the container. */
function wrappers(m: CompositeMoment, view: SurfaceView): A2uiComponent[] {
  if (m.notInside === undefined) return []
  const parent = parentsOf(view)
  for (const c of view.components.values()) {
    const stamped = templateChild(c)
    if (stamped !== undefined && !parent.has(stamped)) parent.set(stamped, c)
  }
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

/** T-0550: the quantity paths a `of` component's literal items bind that no `m.composite` binds, with that component, or
 *  undefined when the row does not fire on `view`. T-0582: or, behind `offer`, its numeric `rows` paths, else the labels of
 *  its literal item quantities (`fixed`). */
function unpickedLines(
  m: CompositeMoment,
  view: SurfaceView,
  reply: string | undefined,
  intent: string | undefined,
): { at: A2uiComponent; paths: string[]; fixed: string[]; asked: boolean } | undefined {
  const lines = m.unpickedLines!
  const comps = [...view.components.values()]
  if (comps.some((c) => m.lacks.includes(c.component))) return undefined
  const picked = comps.filter((c) => c.component === m.composite).map((c) => boundPath(c['value']))
  // A templated picker binds each line relative to its item, which no absolute quantity path can be matched to.
  if (picked.some((p) => p !== '' && !p.startsWith('/'))) return undefined
  const words = comps.filter((c) => !COMPOSITE_TYPES.has(c.component)).map(wordsOf).join(' ')
  // T-0582: a reply offering a quantity change on a surface with no picker at all.
  const offered = lines.offer !== undefined && reply !== undefined && lines.offer.test(reply) && picked.length === 0
  // T-0590: or the user asked for a quantity, with no picker at all.
  const asked = !offered && lines.asked !== undefined && intent !== undefined && lines.asked.test(intent) && picked.length === 0
  const records = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []
  for (const c of comps) {
    if (c.component !== lines.of) continue
    if (!lines.words.test([words, stringOf(c['title'], view), stringOf(c['totalLabel'], view)].join(' '))) continue
    const data = boundPath(c['data'])
    const under = (p: string): string => (p.startsWith('/') || data === '' ? p : `${data.replace(/\/$/, '')}/${p}`)
    const items = records(c['items'])
    const paths = items
      .map((item) => boundPath(item['quantity']))
      .filter((p) => p !== '')
      .map(under)
      .filter((p, i, all) => !picked.includes(p) && all.indexOf(p) === i)
    if (paths.length > 0) return { at: c, paths, fixed: [], asked: false }
    const status = c['status']
    if (!(offered || asked) || (status !== undefined && status !== 'pending')) continue
    // A rows line counts when its path holds a number, read from the data model or the receipt's literal `data`.
    const own = data === '' ? c['data'] : undefined
    const count = (v: unknown): boolean => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && /^\d+$/.test(v.trim()))
    const rows = records(c['rows'])
      .map((r) => (typeof r['path'] === 'string' ? under(r['path']) : ''))
      .filter((p, i, all) => p !== '' && all.indexOf(p) === i && count(readPointer(view.dataModel, p) ?? readPointer(own, p)))
    if (rows.length > 0) return { at: c, paths: rows, fixed: [], asked }
    const fixed = items.filter((item) => count(item['quantity'])).map((item) => (typeof item['label'] === 'string' ? item['label'] : 'a line'))
    if (fixed.length > 0) return { at: c, paths: [], fixed, asked }
  }
  return undefined
}

/** T-0480: the distinct timed stops a say turn's words plan for `m` (its `planned` row), or 0 below its `min`. */
function plannedStops(m: CompositeMoment, intent: string | undefined): number {
  const planned = m.planned
  if (planned === undefined || intent === undefined || !planned.cue.test(intent)) return 0
  const stops = new Set([...intent.matchAll(planned.stop)].map((s) => s[0].toLowerCase().replace(/\s+/g, '')))
  return stops.size >= planned.min ? stops.size : 0
}

/** T-0586: the game an action turn picks for `m` (its `picked` row) with no surface of the turn answering it, or undefined. */
function pickedGame(m: CompositeMoment, surfaces: readonly SurfaceView[], action: SemanticAction | undefined, reply: string | undefined): string | undefined {
  const picked = m.picked
  if (picked === undefined || action === undefined || reply === undefined || !picked.invite.test(reply)) return undefined
  const value = typeof action.context['value'] === 'string' ? action.context['value'] : ''
  const valueNames = picked.game.test(value) || picked.other.test(value)
  if (!picked.action.test(action.name) && !picked.game.test(value)) return undefined
  const game = valueNames ? value : reply
  if (!picked.game.test(game) || picked.other.test(game)) return undefined
  return compositeAnswered(m, surfaces) ? undefined : valueNames ? value : picked.game.exec(game)![1]!
}

/** The one generator: a row of `COMPOSITE_MOMENTS` as a semantic check. */
export function compositeMomentCheck(m: CompositeMoment): SemanticCheck {
  const code = `${upperSnake(m.composite)}_MISSING`
  const ending = endPhrases(m)
  return {
    id: `composite-moment-${kebab(m.composite)}`,
    requires: [m.composite, ...(m.requires ?? [])],
    check({ surfaces, intent, action, reply }): readonly SemanticFinding[] {
      const findings: SemanticFinding[] = []
      const stops = action === undefined ? plannedStops(m, intent) : 0
      if (stops > 0 && !compositeAnswered(m, surfaces)) {
        // A surface built in the plan's place is named, so a repair round may retire it (T-0328) for the composite.
        const first = surfaces[0]
        const ids = surfaces.map((v) => v.surfaceId)
        findings.push({
          code,
          path: first === undefined ? `intent:${kebab(m.composite)}` : `${first.surfaceId}:${first.components.has('root') ? 'root' : [...first.components.keys()][0] ?? 'root'}`,
          message:
            `The guest asked "${intent!.trim()}", a plan of ${stops} timed stops, and ` +
            `${ids.length === 0 ? 'this turn writes' : `${ids.join(', ')} ${ids.length === 1 ? 'holds' : 'hold'}`} no ${m.composite}, so the plan never reaches a surface. ` +
            `Make it ONE ${m.composite} ${m.repair}`,
        })
      }
      const game = pickedGame(m, surfaces, action, reply)
      if (game !== undefined) {
        const first = surfaces[0]
        const ids = surfaces.map((v) => v.surfaceId)
        findings.push({
          code: 'SURFACE_MISSING',
          path: first === undefined ? `action:${action!.name}` : `${first.surfaceId}:${first.components.has('root') ? 'root' : [...first.components.keys()][0] ?? 'root'}`,
          message:
            `The player picked ${game} on ${action!.surfaceId} and the reply asks for a bet or a deal, but ` +
            `${ids.length === 0 ? 'this turn writes' : `${ids.join(', ')} ${ids.length === 1 ? 'holds' : 'hold'}`} no ${m.composite}, so there is no table to play at. ` +
            `Open ONE ${m.composite} ${m.repair}`,
        })
      }
      for (const view of surfaces) {
        if (m.unpickedLines !== undefined) {
          const unpicked = unpickedLines(m, view, reply, intent)
          if (unpicked === undefined) continue
          const { at, paths, fixed, asked } = unpicked
          if (fixed.length > 0) {
            const single = fixed.length === 1
            findings.push({
              code: 'SURFACE_MISSING',
              path: `${view.surfaceId}:${at.id}`,
              message:
                `${view.surfaceId} reads back ${at.id} (a ${at.component}) with a fixed ${single ? 'quantity' : 'quantities'} for ${fixed.join(', ')} ` +
                (asked
                ? `after the user asked for a quantity, and no ${m.composite} on the surface can change ${single ? 'it' : 'them'}. `
                : `while the reply offers to change ${single ? 'it' : 'them'}, and no ${m.composite} on the surface can. `) +
                `Bind each such item's quantity to a data path, and add ONE ${m.composite} per line, its value bound to that path ` +
                `(min 1, step 1, no slider, no actionName: the receipt's Confirm commits), beside the ${at.component}.`,
            })
            continue
          }
          const one = paths.length === 1
          findings.push({
            code: 'SURFACE_MISSING',
            path: `${view.surfaceId}:${at.id}`,
            message:
              `${view.surfaceId} reads back ${at.id} (a ${at.component}) with ${one ? 'a quantity' : 'quantities'} bound to ${paths.join(', ')}, ` +
              `which no ${m.composite} on the surface binds, so the line ${one ? 'quantity' : 'quantities'} cannot be changed. ` +
              `Add ONE ${m.composite} ${m.repair}`,
          })
          continue
        }
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
        const found = strays(m, view, intent, ending, reply)
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

/** T-0359: hex codes, each a distinct color. */
const HEX_CODE = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi
/** T-0359: the color names a prose palette sets out ("navy", "steel-blue", "periwinkle"), a closed list. */
const COLOR_NAME =
  '(navy|blue|sky|teal|turquoise|cyan|aqua|green|sage|olive|mint|emerald|forest|lime|jade|seafoam|celadon|pistachio|moss|fern|petrol|red|crimson|scarlet|maroon|burgundy|carmine|cerise|vermilion|raspberry|mulberry|coral|salmon|pink|rose|blush|magenta|fuchsia|orchid|purple|violet|lavender|lilac|plum|mauve|heather|thistle|wisteria|aubergine|orange|amber|peach|apricot|tangerine|rust|terracotta|sienna|umber|sepia|copper|bronze|yellow|gold|mustard|lemon|citron|canary|marigold|saffron|ochre|chartreuse|cream|ivory|beige|sand|tan|taupe|khaki|linen|oatmeal|parchment|eggshell|alabaster|champagne|pearl|brown|chocolate|espresso|clay|white|black|charcoal|slate|graphite|gunmetal|pewter|onyx|ink|midnight|gray|grey|silver|stone|snow|bone|indigo|cobalt|azure|cerulean|sapphire|denim|cornflower|periwinkle|ultramarine)'
/** T-0359: the roles a palette gives its colors, and the UI parts among them ("white text", "a grey border"). */
const PALETTE_ROLE = '(primary|secondary|tertiary|accent|neutral|base|highlight|brand|cta|success|warning|error|danger|info)'
const UI_PART = '(text|border|background|surface|link)'
const ROLE = `(${PALETTE_ROLE.slice(1, -1)}|${UI_PART.slice(1, -1)})`
/** T-0359: up to two describing words before a color ("deep", "steel"), never a function word. */
const FILLER = '(?:(?!(?:and|or|but|a|an|the|on|of|for|with|to|in|around|is|are)\\b)[a-z]+[ -]){0,2}?'
const MARK = '[*_]*'
/** The pinned forms (criterion 2), each counting the colors it names:
 *  - role first, by colon, equals sign, en or em dash, hyphen or "is": "Primary: navy", "Accent - coral", "**Primary:** navy", "Primary colour: navy",
 *    "The primary is navy", "primary=teal", or a bare space ("Primary navy", "a success green, a warning amber");
 *  - role after: "a deep navy primary", "a muted sky accent"; a UI part only when it names no part of something else
 *    ("a soft cream background" counts, "white text on the primary" and "a grey border around cards" do not);
 *  - a for-phrase role: "navy for the header, sand for the background and coral for buttons";
 *  - a list line ("- Navy for headers", "1) Midnight for the header", "- **Navy** for headers", "- Header: navy",
 *    "- Primary colour: navy");
 *  - hex codes: three or more distinct, an all-digit code ("#333") only on a list line or beside two lettered codes; a
 *    CSS rule or a fenced code block counts nothing. */
const ROLE_FIRST = new RegExp(
  `\\b${ROLE}s?(?:\\s+(?:colou?r|tone|hue|shade)s?)?${MARK}\\s*(?:[:=\\u2013\\u2014-]|\\bis\\b)?${MARK}\\s*${FILLER}\\b${COLOR_NAME}\\b`,
  'gi',
)
const ROLE_AFTER = new RegExp(`\\b${COLOR_NAME}\\s+${PALETTE_ROLE}\\b`, 'gi')
const PART_AFTER = new RegExp(`\\b${COLOR_NAME}\\s+${UI_PART}\\b(?!\\s+(?:on|around|of|for|in|with|behind|under|over|across|inside)\\b)`, 'gi')
const FOR_ROLE = new RegExp(`\\b${COLOR_NAME}\\s+(?:for|as)\\s+(?:(?:the|your|our|all)\\s+)?[a-z]+`, 'gi')
const LIST_LINE = new RegExp(
  `^\\s*(?:[-*\\u2022]|\\d+[.)])\\s+${MARK}(?:[a-z]+(?:\\s+colou?r)?${MARK}\\s*:${MARK}\\s*)?${MARK}${FILLER}\\b${COLOR_NAME}\\b`,
  'gim',
)
const LIST_HEX = /^\s*(?:[-*•]|\d+[.)])\s+.*?(#(?:[0-9a-f]{6}|[0-9a-f]{3}))\b/gim
/** T-0359: code a reply quotes (a fenced block, a CSS rule's braces) never sets out a palette. */
const CODE = /```[\s\S]*?(```|$)|\{[^{}]*\}/g

/** T-0359: how many distinct colors a reply sets out as a palette in the pinned forms above: its distinct hex codes when
 *  three or more, else its distinct named colors. A passing mention ("white text on navy") sets out none. */
export function proseColors(reply: string): number {
  const text = reply.replace(CODE, ' ')
  const codes = [...text.matchAll(HEX_CODE)].map((m) => m[0].toLowerCase())
  const lettered = new Set(codes.filter((h) => /[a-f]/.test(h)))
  const listed = new Set([...text.matchAll(LIST_HEX)].map((m) => m[1]!.toLowerCase()))
  const hex = new Set(codes.filter((h) => lettered.has(h) || listed.has(h) || lettered.size >= 2))
  if (hex.size >= 3) return hex.size
  const named = new Set<string>()
  const add = (re: RegExp, group: number) => {
    for (const m of text.matchAll(re)) named.add(m[group]!.toLowerCase())
  }
  add(ROLE_FIRST, 2)
  add(ROLE_AFTER, 1)
  add(PART_AFTER, 1)
  add(FOR_ROLE, 1)
  add(LIST_LINE, 1)
  return Math.max(hex.size, named.size)
}

/** T-0359: a row's `prose` as a check, judged on the reply (Kim, 2026-10-18): on a turn of a session whose prior assistant
 *  turns never wrote one of `types` (a closed or rebuilt surface still counts as shown), a reply that sets out three or
 *  more colors in prose while the turn writes none of `types` is SURFACE_MISSING. The user's words never count. The check
 *  `requires` every one of `types`, so the palette check rides the Stylist's catalog alone. */
export function compositeProseCheck(m: CompositeMoment): SemanticCheck {
  const prose = m.prose!
  const holds = (v: SurfaceView): boolean => [...v.components.values()].some((c) => prose.types.includes(c.component))
  return {
    id: `composite-prose-${kebab(m.composite)}`,
    requires: [...new Set([m.composite, ...(m.requires ?? []), ...prose.types])],
    check({ surfaces, action, reply, open, shownTypes }): readonly SemanticFinding[] {
      if (action !== undefined || reply === undefined) return []
      if (prose.types.some((t) => shownTypes?.has(t) === true) || open?.some(holds) === true || surfaces.some(holds)) return []
      const n = prose.listed(reply)
      if (n < 3) return []
      return [
        {
          code: 'SURFACE_MISSING',
          path: `reply:${prose.moment}`,
          message:
            `This turn's reply sets out a ${prose.moment} of ${n} colors in words and writes no ${prose.types.join(', ')}, so the reader never sees them. ` +
            `Call render_surface with a createSurface holding ${prose.surface}, and keep the reply to one short paragraph on intent and contrast.`,
        },
      ]
    },
  }
}

/** Every row's check, then (T-0359) the prose check of each row with a `prose`. */
export const compositeMomentChecks: readonly SemanticCheck[] = [
  ...COMPOSITE_MOMENTS.map(compositeMomentCheck),
  ...COMPOSITE_MOMENTS.filter((m) => m.prose !== undefined).map(compositeProseCheck),
]

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
