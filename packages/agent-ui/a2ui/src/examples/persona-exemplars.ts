// persona-exemplars.ts: the seeds on the `allPersonaSeeds` shelf (T-0064), at least one per derived persona
// catalog the renderer records (`<base>--<persona>`, `catalog/records.ts`). Each seed is ONE surface whose
// `createSurface.catalogId` is its own derived id, and it uses only that derived catalog's types: the base's
// types plus the persona fragment's (`catalog/personas/<persona>/catalog.json`). Together they render every
// fragment type on every derived id, which the every-catalog coverage gate (`every-catalog-coverage.test.ts`)
// holds.
//
// An `a2ui-basic--*` seed writes its base types in the Basic dialect (`basic-exemplars.ts` module header): a
// Button carries its label as a `child` Text and its action as `{ event: { name, context } }`, and Row/Column
// take `justify`/`align`, never `gap`. The fragment types (FixtureBanner, BookingForm, BookingConfirmation,
// PlayingCard, CardTable, QuestionCard) read the same on either base. The stylist fragment (ContrastPair) targets
// `agent-ui` alone, so it has one seed.
//
// These are page and gate fixtures, never corpus candidates: no corpus shelf, shard or import-seeds table reads
// this module.

import type { PersonaExampleSeed } from './types.ts'

const BANNER_SID = 'fixture-banner'

/** The fixture-demo persona over agent-ui: a heading above the fragment's FixtureBanner. */
export const personaFixtureDemoSeed: PersonaExampleSeed = {
  name: 'persona-fixture-demo-banner',
  description:
    'The fixture-demo persona over the agent-ui base: a Column with an h3 Text heading and the fragment\'s ' +
    'FixtureBanner carrying a one-line notice, the smallest surface that proves a derived catalog composes.',
  promptText: 'Show a banner saying the fixture persona is active.',
  surfaceId: BANNER_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--fixture-demo',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BANNER_SID, catalogId: 'agent-ui--fixture-demo' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BANNER_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'sm', children: ['heading', 'banner'] },
          { id: 'heading', component: 'Text', variant: 'h3', text: 'Fixture persona' },
          { id: 'banner', component: 'FixtureBanner', text: 'The fixture persona catalog is active on this surface.' },
        ],
      },
    },
  ],
}

/** The fixture-demo persona over a2ui-basic: the same banner under a Basic heading. */
export const personaBasicFixtureDemoSeed: PersonaExampleSeed = {
  name: 'persona-basic-fixture-demo-banner',
  description:
    'The fixture-demo persona over the a2ui-basic base: a Basic Column with an h3 Text heading and the ' +
    'fragment\'s FixtureBanner, showing the same fragment composed independently over the other base.',
  promptText: 'Show a banner saying the fixture persona is active.',
  surfaceId: BANNER_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--fixture-demo',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BANNER_SID, catalogId: 'a2ui-basic--fixture-demo' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BANNER_SID,
        components: [
          { id: 'root', component: 'Column', justify: 'start', align: 'stretch', children: ['heading', 'banner'] },
          { id: 'heading', component: 'Text', variant: 'h3', text: 'Fixture persona' },
          { id: 'banner', component: 'FixtureBanner', text: 'The fixture persona catalog is active on this surface.' },
        ],
      },
    },
  ],
}

const BOOKING_SID = 'concierge-booking'

/** The room-type choices, shared by the form's select and the settled receipt's room-type row. */
const ROOM_OPTIONS = [
  { value: 'king', label: 'King room' },
  { value: 'twin', label: 'Twin room' },
  { value: 'suite', label: 'Junior suite' },
]

/** The booking form's field kinds (a dateSingle arrival and departure pair, a select, a checkbox), shared by both booking seeds. */
const BOOKING_FIELDS = [
  { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
  { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
  { kind: 'select', path: 'roomType', label: 'Room type', required: true, options: ROOM_OPTIONS },
  { kind: 'checkbox', path: 'breakfast', label: 'Add breakfast' },
]

/** Every detail the guest named, written once at `/booking`: the form opens pre-filled with it (T-0266), and the
 *  settled receipt (on a2ui-basic, the confirmation) shows it after the submit. */
const BOOKING_DATA = { checkIn: '2026-11-14', checkOut: '2026-11-17', roomType: 'king', breakfast: 'Yes' }

/** The settled receipt's rows (and the a2ui-basic confirmation's): keys in the same /booking object the form writes; the room type shows as its label. */
const BOOKING_ROWS = [
  { label: 'Arrival', path: 'checkIn' },
  { label: 'Departure', path: 'checkOut' },
  { label: 'Room type', path: 'roomType', options: ROOM_OPTIONS },
  { label: 'Breakfast', path: 'breakfast' },
]

const BOOKING_PROMPT = 'Book me a king room at the hotel, arriving 14 November 2026 and leaving 17 November, with breakfast.'
const CONFIRM_PROMPT = 'Those details are right, please confirm the booking.'

/** The a2ui-basic confirm turn's surface root (T-0289, T-0308): ONE BookingConfirmation with the form's values, no
 *  reference number. That catalog holds no ConfirmReceipt; agent-ui settles in place instead (T-0403). */
const BOOKING_CONFIRMATION = { id: 'root', component: 'BookingConfirmation', title: 'Booked', rows: BOOKING_ROWS, data: { path: '/booking' } }

/** The agent-ui confirm turn (grammar G2b, booking-flow, T-0403): the root wrapper's one child, the form until the
 *  guest confirms, settled in place into ONE ConfirmReceipt, "data" bound to the draft and "status" the literal
 *  "confirmed" (never bound, so it draws no Back or Confirm), with no reference number. It is the one update the
 *  request seed's surface takes (T-0404): its bare root Column resent with the new `receipt` id as its child, never
 *  `form` retyped (the renderer reconciles a retyped non-root id onto the old element). */
const BOOKING_SETTLED = [
  { id: 'root', component: 'Column', children: ['receipt'] },
  { id: 'receipt', component: 'ConfirmReceipt', title: 'Booked', rows: BOOKING_ROWS, data: { path: '/booking' }, status: 'confirmed' },
]

/** The concierge persona over agent-ui: the request turn, a BookingForm pre-filled with every detail the guest gave, the
 *  one child of a bare root Column wrapper so the confirm settles in place with one update (grammar G2b, T-0404). */
export const personaConciergeBookingSeed: PersonaExampleSeed = {
  name: 'persona-concierge-booking',
  description:
    'The concierge persona over the agent-ui base, on an ask that names every detail: one BookingForm titled ' +
    '"Book your stay" as the one child of a root Column wrapper, pre-filled from /booking with the dateSingle arrival and departure ' +
    '(drawn as two date fields), the king room on the room-type select and Yes on the breakfast choice. Its child ' +
    'Book now Button is a submit action whose context carries /booking, and the surface sends its data model. No ' +
    'confirmation renders before the guest submits; the confirm turns the wrapper\'s child into ONE ConfirmReceipt ' +
    '(persona-concierge-booking-confirmed).',
  promptText: BOOKING_PROMPT,
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'agent-ui--hospitality', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: BOOKING_DATA } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          { id: 'root', component: 'Column', children: ['form'] },
          { id: 'form', component: 'BookingForm', title: 'Book your stay', fields: BOOKING_FIELDS, value: { path: '/booking' }, child: 'submitBtn' },
          {
            id: 'submitBtn',
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

/** The concierge persona over a2ui-basic: the same pre-filled form, the submit Button in the Basic dialect. */
export const personaBasicConciergeBookingSeed: PersonaExampleSeed = {
  name: 'persona-basic-concierge-booking',
  description:
    'The concierge persona over the a2ui-basic base: the same pre-filled BookingForm as the surface root, ' +
    'bound to /booking, with the form\'s child a Basic Button whose label is a child Text and whose ' +
    'confirm_booking event carries the bound /booking object. No confirmation renders before the submit.',
  promptText: BOOKING_PROMPT,
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'a2ui-basic--hospitality', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: BOOKING_DATA } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          { id: 'root', component: 'BookingForm', title: 'Book your stay', fields: BOOKING_FIELDS, value: { path: '/booking' }, child: 'submitBtn' },
          { id: 'submitLabel', component: 'Text', text: 'Book now' },
          {
            id: 'submitBtn',
            component: 'Button',
            variant: 'primary',
            child: 'submitLabel',
            action: { event: { name: 'confirm_booking', context: { booking: { path: '/booking' } } } },
          },
        ],
      },
    },
  ],
}

/** The concierge persona over agent-ui: the confirm turn, the booking settled in place as one ConfirmReceipt (T-0403). */
export const personaConciergeBookingConfirmedSeed: PersonaExampleSeed = {
  name: 'persona-concierge-booking-confirmed',
  description:
    'The concierge persona over the agent-ui base, on the turn after the guest confirms: the booking settles in ' +
    'place, so the root Column wrapper\'s one child is ONE ConfirmReceipt titled "Booked", its data bound to the ' +
    'same /booking object the form wrote and its status the literal "confirmed", so it draws no Back or Confirm. ' +
    'Its rows show the arrival, departure, room type (as its label, King room) and breakfast, with no reference number.',
  promptText: CONFIRM_PROMPT,
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'agent-ui--hospitality' } },
    { version: 'v1.0', updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: BOOKING_DATA } },
    { version: 'v1.0', updateComponents: { surfaceId: BOOKING_SID, components: BOOKING_SETTLED } },
  ],
}

/** The concierge persona over a2ui-basic: the confirm turn as one BookingConfirmation, the type that catalog has. */
export const personaBasicConciergeBookingConfirmedSeed: PersonaExampleSeed = {
  name: 'persona-basic-concierge-booking-confirmed',
  description:
    'The concierge persona over the a2ui-basic base, on the turn after the guest confirms: ONE BookingConfirmation ' +
    'titled "Booked" as the surface root, showing the booking from /booking (this catalog holds no ConfirmReceipt).',
  promptText: CONFIRM_PROMPT,
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'a2ui-basic--hospitality' } },
    { version: 'v1.0', updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: BOOKING_DATA } },
    { version: 'v1.0', updateComponents: { surfaceId: BOOKING_SID, components: [BOOKING_CONFIRMATION] } },
  ],
}

const TRIP_SID = 'concierge-trip'

/** A two-day plan: day 1 done, day 2 under way with a weather aside (T-0199). */
const TRIP_DAYS = [
  {
    label: 'Fri 14 Nov, arrival',
    stops: [
      { time: '10:40', label: 'Land at LIS', detail: 'TP 1351, terminal 1', status: 'done' },
      { time: '12:30', label: 'Check in, Alfama Patio', status: 'done' },
    ],
  },
  {
    label: 'Sat 15 Nov, Belem',
    aside: '18°C, sun',
    stops: [
      { time: '10:00', label: 'Jeronimos Monastery', detail: 'Tickets on your phone', status: 'active' },
      { time: '12:30', label: 'Pasteis de Belem', status: 'pending' },
    ],
  },
]

const TRIP_PROMPT = 'Show me my Lisbon plan so far.'

/** The concierge persona over agent-ui: a day plan as one Itinerary, its days bound to /trip/days (T-0199). */
export const personaConciergeItinerarySeed: PersonaExampleSeed = {
  name: 'persona-concierge-itinerary',
  description:
    'The concierge persona over the agent-ui base: the surface root is ONE Itinerary titled "Lisbon plan" whose ' +
    'days read from /trip/days, day 1 done and day 2 under way with a weather aside.',
  promptText: TRIP_PROMPT,
  surfaceId: TRIP_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TRIP_SID, catalogId: 'agent-ui--hospitality' } },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIP_SID, path: '/trip/days', value: TRIP_DAYS } },
    {
      version: 'v1.0',
      updateComponents: { surfaceId: TRIP_SID, components: [{ id: 'root', component: 'Itinerary', title: 'Lisbon plan', days: { path: '/trip/days' } }] },
    },
  ],
}

/** The concierge persona over a2ui-basic: the same Itinerary (T-0199). */
export const personaBasicConciergeItinerarySeed: PersonaExampleSeed = {
  name: 'persona-basic-concierge-itinerary',
  description:
    'The concierge persona over the a2ui-basic base: the same Itinerary titled "Lisbon plan" as the surface root, ' +
    'its days read from /trip/days.',
  promptText: TRIP_PROMPT,
  surfaceId: TRIP_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TRIP_SID, catalogId: 'a2ui-basic--hospitality' } },
    { version: 'v1.0', updateDataModel: { surfaceId: TRIP_SID, path: '/trip/days', value: TRIP_DAYS } },
    {
      version: 'v1.0',
      updateComponents: { surfaceId: TRIP_SID, components: [{ id: 'root', component: 'Itinerary', title: 'Lisbon plan', days: { path: '/trip/days' } }] },
    },
  ],
}

const STAY_SID = 'concierge-stay'

/** The stay form's fields: a text name, a number guest count, and a date range as two dateSingle fields. */
const STAY_FIELDS = [
  { kind: 'text', path: 'guestName', label: 'Guest name', required: true },
  { kind: 'number', path: 'guests', label: 'Number of guests', required: true },
  { kind: 'dateSingle', path: 'checkIn', label: 'Arrival', required: true },
  { kind: 'dateSingle', path: 'checkOut', label: 'Departure', required: true },
]

/** The concierge persona over agent-ui: a BookingForm using the text and number kinds and a two-field date range, the
 *  one child of a bare root Column wrapper (T-0404). */
export const personaConciergeStaySeed: PersonaExampleSeed = {
  name: 'persona-concierge-stay-details',
  description:
    'The concierge persona over the agent-ui base, on an ask that names every detail: a BookingForm titled ' +
    '"Your stay" as the one child of a root Column wrapper, pre-filled from /stay with the text guest name, the number guest count and ' +
    'the date range as two dateSingle fields (arrival, departure), all required. Its child Reserve Button is a ' +
    'submit action whose context carries /stay, and the surface sends its data model. No confirmation renders ' +
    'before the guest submits.',
  promptText: 'Book a stay for two guests under the name Ada Lovelace, arriving 14 November 2026 and leaving 17 November.',
  surfaceId: STAY_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--hospitality',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: STAY_SID, catalogId: 'agent-ui--hospitality', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: STAY_SID,
        path: '/stay',
        value: { guestName: 'Ada Lovelace', guests: '2', checkIn: '2026-11-14', checkOut: '2026-11-17' },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: STAY_SID,
        components: [
          { id: 'root', component: 'Column', children: ['form'] },
          { id: 'form', component: 'BookingForm', title: 'Your stay', fields: STAY_FIELDS, value: { path: '/stay' }, child: 'submitBtn' },
          {
            id: 'submitBtn',
            component: 'Button',
            variant: 'solid',
            label: 'Reserve',
            action: { action: 'reserveStay', submit: true, context: { stay: { path: '/stay' } } },
          },
        ],
      },
    },
  ],
}

const TABLE_SID = 'holdem-table'

/** Both hold'em seeds show the flop of one hand: blinds of 20 each in a pot of 40, the player's chips at 980. */
const HOLDEM_PROMPT = 'Deal me a hand of Texas hold’em.'

/** The croupier persona over agent-ui: a hold'em hand in the Card frame, since CardTable is the blackjack table only
 *  (`game-table-chrome`: other games keep the Card frame with PlayingCard hands). */
export const personaCroupierHandSeed: PersonaExampleSeed = {
  name: 'persona-croupier-opening-hand',
  description:
    'The croupier persona over the agent-ui base: a Texas hold’em hand in ONE Card, its header the title and a ' +
    'trailing Badge bound to /chips, its content a zone per participant (the dealer\'s two hole cards as face-down ' +
    'PlayingCards, the flop of a king of spades, a 7 of diamonds and a 2 of clubs, and the player\'s king and queen ' +
    'of hearts for a pair of kings), and its footer a Row of Check, Bet and Fold Buttons.',
  promptText: HOLDEM_PROMPT,
  surfaceId: TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TABLE_SID, catalogId: 'agent-ui--croupier', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: TABLE_SID, value: { chips: 'Chips 980 · Pot 40' } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TABLE_SID,
        components: [
          { id: 'root', component: 'Card', children: ['tableHeader', 'tableContent', 'tableFooter'] },
          { id: 'tableHeader', component: 'CardHeader', children: ['title', 'chips'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Texas hold’em' },
          { id: 'chips', component: 'Badge', label: { path: '/chips' }, intent: 'neutral', slot: 'trailing' },
          {
            id: 'tableContent',
            component: 'CardContent',
            children: ['dealerLabel', 'dealerCards', 'boardLabel', 'boardCards', 'playerLabel', 'playerCards', 'handRank'],
          },
          { id: 'dealerLabel', component: 'Text', variant: 'h5', text: 'Dealer' },
          { id: 'dealerCards', component: 'Row', gap: 'md', justify: 'center', children: ['dealerCard1', 'dealerCard2'] },
          { id: 'dealerCard1', component: 'PlayingCard', rank: '9', suit: 'clubs', faceDown: true },
          { id: 'dealerCard2', component: 'PlayingCard', rank: '4', suit: 'diamonds', faceDown: true },
          { id: 'boardLabel', component: 'Text', variant: 'h5', text: 'Flop' },
          { id: 'boardCards', component: 'Row', gap: 'md', justify: 'center', children: ['boardCard1', 'boardCard2', 'boardCard3'] },
          { id: 'boardCard1', component: 'PlayingCard', rank: 'K', suit: 'spades' },
          { id: 'boardCard2', component: 'PlayingCard', rank: '7', suit: 'diamonds' },
          { id: 'boardCard3', component: 'PlayingCard', rank: '2', suit: 'clubs' },
          { id: 'playerLabel', component: 'Text', variant: 'h5', text: 'You' },
          { id: 'playerCards', component: 'Row', gap: 'md', justify: 'center', children: ['playerCard1', 'playerCard2'] },
          { id: 'playerCard1', component: 'PlayingCard', rank: 'K', suit: 'hearts' },
          { id: 'playerCard2', component: 'PlayingCard', rank: 'Q', suit: 'hearts' },
          { id: 'handRank', component: 'Text', variant: 'body', text: 'Pair of kings. Check or bet?' },
          { id: 'tableFooter', component: 'CardFooter', children: ['moves'] },
          { id: 'moves', component: 'Row', gap: 'sm', justify: 'center', children: ['checkBtn', 'betBtn', 'foldBtn'] },
          { id: 'checkBtn', component: 'Button', variant: 'soft', label: 'Check', action: { action: 'check' } },
          { id: 'betBtn', component: 'Button', variant: 'solid', label: 'Bet 20', action: { action: 'bet', context: { amount: 20 } } },
          { id: 'foldBtn', component: 'Button', variant: 'soft', label: 'Fold', action: { action: 'fold' } },
        ],
      },
    },
  ],
}

/** The croupier persona over a2ui-basic: the same hold'em hand in Basic rows, the moves as Basic event Buttons. */
export const personaBasicCroupierHandSeed: PersonaExampleSeed = {
  name: 'persona-basic-croupier-opening-hand',
  description:
    'The croupier persona over the a2ui-basic base: the same Texas hold’em hand in a Basic Column, a Row per ' +
    'participant (the dealer\'s two face-down hole cards, the flop, the player\'s king and queen of hearts), a ' +
    'line stating the hand and the chips, then a Row of Basic Buttons whose child Text labels read Check, Bet 20 ' +
    'and Fold and whose events name the move.',
  promptText: HOLDEM_PROMPT,
  surfaceId: TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TABLE_SID, catalogId: 'a2ui-basic--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TABLE_SID,
        components: [
          {
            id: 'root',
            component: 'Column',
            justify: 'start',
            align: 'stretch',
            children: ['title', 'dealerLabel', 'dealerCards', 'boardLabel', 'boardCards', 'playerLabel', 'playerCards', 'handRank', 'moves'],
          },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Texas hold’em' },
          { id: 'dealerLabel', component: 'Text', variant: 'h5', text: 'Dealer' },
          { id: 'dealerCards', component: 'Row', justify: 'center', align: 'center', children: ['dealerCard1', 'dealerCard2'] },
          { id: 'dealerCard1', component: 'PlayingCard', rank: '9', suit: 'clubs', faceDown: true },
          { id: 'dealerCard2', component: 'PlayingCard', rank: '4', suit: 'diamonds', faceDown: true },
          { id: 'boardLabel', component: 'Text', variant: 'h5', text: 'Flop' },
          { id: 'boardCards', component: 'Row', justify: 'center', align: 'center', children: ['boardCard1', 'boardCard2', 'boardCard3'] },
          { id: 'boardCard1', component: 'PlayingCard', rank: 'K', suit: 'spades' },
          { id: 'boardCard2', component: 'PlayingCard', rank: '7', suit: 'diamonds' },
          { id: 'boardCard3', component: 'PlayingCard', rank: '2', suit: 'clubs' },
          { id: 'playerLabel', component: 'Text', variant: 'h5', text: 'You' },
          { id: 'playerCards', component: 'Row', justify: 'center', align: 'center', children: ['playerCard1', 'playerCard2'] },
          { id: 'playerCard1', component: 'PlayingCard', rank: 'K', suit: 'hearts' },
          { id: 'playerCard2', component: 'PlayingCard', rank: 'Q', suit: 'hearts' },
          { id: 'handRank', component: 'Text', variant: 'body', text: 'Pair of kings. Chips 980, pot 40. Check or bet?' },
          { id: 'moves', component: 'Row', justify: 'center', align: 'center', children: ['checkBtn', 'betBtn', 'foldBtn'] },
          { id: 'checkLabel', component: 'Text', text: 'Check' },
          { id: 'checkBtn', component: 'Button', variant: 'default', child: 'checkLabel', action: { event: { name: 'check', context: {} } } },
          { id: 'betLabel', component: 'Text', text: 'Bet 20' },
          { id: 'betBtn', component: 'Button', variant: 'primary', child: 'betLabel', action: { event: { name: 'bet', context: { amount: 20 } } } },
          { id: 'foldLabel', component: 'Text', text: 'Fold' },
          { id: 'foldBtn', component: 'Button', variant: 'default', child: 'foldLabel', action: { event: { name: 'fold', context: {} } } },
        ],
      },
    },
  ],
}

const CARD_TABLE_SID = 'card-table'

/** The opening deal both CardTable seeds write: the dealer's hole card face down, the player on 17, and the bankroll
 *  950 because the 50 bet sits on the felt (`round-loop`: the deal takes the bet out of /bankroll). */
const CARD_TABLE_DATA = {
  phase: 'playing',
  dealerHand: [
    { rank: '9', suit: 'clubs' },
    { rank: '4', suit: 'diamonds', faceDown: true },
  ],
  playerHand: [
    { rank: 'K', suit: 'hearts' },
    { rank: '7', suit: 'spades' },
  ],
  dealerTotal: 'showing 9', // the up card only while the hole card is face down, as the approved table reads
  playerTotal: 17,
  bankroll: 950,
  bet: 50,
}

/** The CardTable node both seeds share: the phase and every table figure bound to its data-model path (ADR-0243). */
const CARD_TABLE_ROOT = {
  id: 'root',
  component: 'CardTable',
  title: 'Blackjack',
  status: 'Your turn',
  statusIntent: 'success',
  phase: { path: '/phase' },
  dealerHand: { path: '/dealerHand' },
  playerHand: { path: '/playerHand' },
  dealerTotal: { path: '/dealerTotal' },
  playerTotal: { path: '/playerTotal' },
  bankroll: { path: '/bankroll' },
  bet: { path: '/bet' },
  children: ['hitBtn', 'standBtn', 'doubleBtn'],
}

/** The croupier persona over agent-ui: the opening deal on the fragment's CardTable, the moves as children. */
export const personaCroupierCardTableSeed: PersonaExampleSeed = {
  name: 'persona-croupier-card-table',
  description:
    'The croupier persona over the agent-ui base: one CardTable titled Blackjack in its playing phase whose phase, ' +
    'hands, totals, bankroll and bet are bound to the data model (a 9 of clubs up and a face-down hole card for the ' +
    'dealer, a king of hearts and a 7 of spades for the player, total 17, the bankroll at 950 with the 50 bet on ' +
    'the felt), with Hit, Stand and Double Buttons as its children.',
  promptText: 'Deal me a hand of blackjack.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'agent-ui--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [
          CARD_TABLE_ROOT,
          { id: 'hitBtn', component: 'Button', variant: 'solid', label: 'Hit', action: { action: 'hit' } },
          { id: 'standBtn', component: 'Button', variant: 'soft', label: 'Stand', action: { action: 'stand' } },
          { id: 'doubleBtn', component: 'Button', variant: 'soft', label: 'Double', action: { action: 'double' } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_DATA } },
  ],
}

/** The croupier persona over a2ui-basic: the same CardTable, the moves as Basic event Buttons. */
export const personaBasicCroupierCardTableSeed: PersonaExampleSeed = {
  name: 'persona-basic-croupier-card-table',
  description:
    'The croupier persona over the a2ui-basic base: the same bound CardTable and opening deal in its playing ' +
    'phase, with Basic Buttons whose child Text labels read Hit, Stand and Double and whose events name the move.',
  promptText: 'Deal me a hand of blackjack.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'a2ui-basic--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [
          CARD_TABLE_ROOT,
          { id: 'hitLabel', component: 'Text', text: 'Hit' },
          { id: 'hitBtn', component: 'Button', variant: 'primary', child: 'hitLabel', action: { event: { name: 'hit', context: {} } } },
          { id: 'standLabel', component: 'Text', text: 'Stand' },
          { id: 'standBtn', component: 'Button', variant: 'default', child: 'standLabel', action: { event: { name: 'stand', context: {} } } },
          { id: 'doubleLabel', component: 'Text', text: 'Double' },
          { id: 'doubleBtn', component: 'Button', variant: 'default', child: 'doubleLabel', action: { event: { name: 'double', context: {} } } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_DATA } },
  ],
}

/** The hand lifecycle (ADR-0243 Amendment 3): every phase seed binds `phase` and the table figures to /phase and
 *  the same paths, so a round moves bet, deal, play, settle by data writes on one table. */
const CARD_TABLE_PHASE_BINDS = {
  phase: { path: '/phase' },
  dealerHand: { path: '/dealerHand' },
  playerHand: { path: '/playerHand' },
  bankroll: { path: '/bankroll' },
  bet: { path: '/bet' },
}

/** The betting step: empty hands, the last bet carried over, the bet two-way bound to /bet. T-0172: the table's own
 *  bet strip places the bet and fires `deal` (`betAction`), so the step has no Button child. */
const CARD_TABLE_BETTING_DATA = { phase: 'betting', dealerHand: [], playerHand: [], bankroll: 1000, bet: 50 }

const CARD_TABLE_BETTING_ROOT = {
  id: 'root',
  component: 'CardTable',
  title: 'Blackjack',
  status: 'Place your bet',
  statusIntent: 'info',
  ...CARD_TABLE_PHASE_BINDS,
  betAction: 'deal',
}

/** The croupier persona over agent-ui: the betting step on the CardTable, whose bet strip sends the bet as `deal`. */
export const personaCroupierCardTableBettingSeed: PersonaExampleSeed = {
  name: 'persona-croupier-card-table-betting',
  description:
    'The croupier persona over the agent-ui base: one CardTable titled Blackjack in its betting phase, empty felt for ' +
    'the dealer and the player, the bet strip (25, 50, 75, 100 and 250) with the bet two-way bound to /bet of a 1,000 ' +
    'bankroll, and betAction deal, so one press places the bet and starts the hand. No Button child.',
  promptText: 'Let me place a bet, then deal.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'agent-ui--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [CARD_TABLE_BETTING_ROOT],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_BETTING_DATA } },
  ],
}

/** The settled step: the hole card turned up, the dealer drew to 18, the player stood on 20 and won the 50 bet. */
const CARD_TABLE_SETTLED_DATA = {
  phase: 'settled',
  dealerHand: [
    { rank: '9', suit: 'clubs' },
    { rank: '4', suit: 'diamonds' },
    { rank: '5', suit: 'spades' },
  ],
  playerHand: [
    { rank: 'K', suit: 'hearts' },
    { rank: '7', suit: 'spades' },
    { rank: '3', suit: 'clubs' },
  ],
  dealerTotal: 18,
  playerTotal: 20,
  bankroll: 1050,
  bet: 50,
  result: 'You win, 20 against the dealer’s 18: +50',
}

const CARD_TABLE_SETTLED_ROOT = {
  id: 'root',
  component: 'CardTable',
  title: 'Blackjack',
  status: 'You win',
  statusIntent: 'success',
  ...CARD_TABLE_PHASE_BINDS,
  dealerTotal: { path: '/dealerTotal' },
  playerTotal: { path: '/playerTotal' },
  result: { path: '/result' },
  children: ['againBtn'],
}

/** The croupier persona over agent-ui: the settled step on the CardTable, the result line and a Deal again Button. */
export const personaCroupierCardTableSettledSeed: PersonaExampleSeed = {
  name: 'persona-croupier-card-table-settled',
  description:
    'The croupier persona over the agent-ui base: one CardTable titled Blackjack in its settled phase, both hands face ' +
    'up (the dealer drew to 18, the player stood on 20), the result line naming the winner and the +50 delta, the ' +
    'bankroll at 1,050, and one Deal again Button child that starts the next round.',
  promptText: 'Stand.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'agent-ui--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [
          CARD_TABLE_SETTLED_ROOT,
          { id: 'againBtn', component: 'Button', variant: 'solid', label: 'Deal again', action: { action: 'dealAgain', context: { newRound: true } } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_SETTLED_DATA } },
  ],
}

/** The croupier persona over a2ui-basic: the betting step, the same bet strip sending `deal`. */
export const personaBasicCroupierCardTableBettingSeed: PersonaExampleSeed = {
  name: 'persona-basic-croupier-card-table-betting',
  description:
    'The croupier persona over the a2ui-basic base: the same betting-phase CardTable, the bet bound to /bet, whose ' +
    'bet strip places the bet and sends deal with it. No Button child.',
  promptText: 'Let me place a bet, then deal.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'a2ui-basic--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [CARD_TABLE_BETTING_ROOT],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_BETTING_DATA } },
  ],
}

/** The croupier persona over a2ui-basic: the settled step, Deal again as a Basic event Button. */
export const personaBasicCroupierCardTableSettledSeed: PersonaExampleSeed = {
  name: 'persona-basic-croupier-card-table-settled',
  description:
    'The croupier persona over the a2ui-basic base: the same settled-phase CardTable with its result line, with a ' +
    'Basic Button whose child Text label reads Deal again and whose deal_again event starts the next round.',
  promptText: 'Stand.',
  surfaceId: CARD_TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CARD_TABLE_SID, catalogId: 'a2ui-basic--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CARD_TABLE_SID,
        components: [
          CARD_TABLE_SETTLED_ROOT,
          { id: 'againLabel', component: 'Text', text: 'Deal again' },
          { id: 'againBtn', component: 'Button', variant: 'primary', child: 'againLabel', action: { event: { name: 'deal_again', context: { newRound: true } } } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: CARD_TABLE_SID, value: CARD_TABLE_SETTLED_DATA } },
  ],
}

const GREET_SID = 'greet-1'

/** The Croupier's game picker: one card per enabled game-rules resource, each valued by that resource's id. */
export const CROUPIER_GAME_PICKER_DECK = {
  id: 'root',
  component: 'OptionDeck',
  heading: 'Pick your table',
  subheading: 'Every table starts you with 1,000 chips.',
  options: [
    { value: 'blackjack', title: 'Blackjack', description: 'Beat the dealer to 21 without going bust.', icon: 'star', tone: 'primary', index: 'A' },
    { value: 'spanish-21', title: 'Spanish 21', description: 'Blackjack with no tens and bonus 21s.', tone: 'primary', index: '21' },
    { value: 'pontoon', title: 'Pontoon', description: 'British blackjack: twist, stick or buy.', tone: 'primary', index: 'P' },
    { value: 'texas-holdem', title: 'Texas Hold\u2019em', description: 'Two hole cards, five on the board.', icon: 'heart', tone: 'accent', index: 'K' },
    { value: 'omaha', title: 'Omaha', description: 'Four hole cards: use exactly two.', tone: 'accent', index: 'Q' },
    { value: 'five-card-draw', title: 'Five-card draw', description: 'Discard, draw once, then show down.', tone: 'info', index: '5' },
    { value: 'seven-card-stud', title: 'Seven-card stud', description: 'Up cards and down cards, no board.', tone: 'info', index: '7' },
  ],
  allowRandom: true,
  actionName: 'pick_game',
}

/** The croupier persona over agent-ui: the opening greet's game picker (T-0193), one OptionDeck whose cards are the
 *  choices, never a Row of Buttons or a Card around each one. */
export const personaCroupierGamePickerSeed: PersonaExampleSeed = {
  name: 'persona-croupier-game-picker',
  description:
    'The croupier persona over the agent-ui base: the opening greet as one OptionDeck with actionName pick_game, one ' +
    'card per enabled game-rules resource (blackjack, spanish-21, pontoon, texas-holdem, omaha, five-card-draw, ' +
    'seven-card-stud) valued by its resource id, and allowRandom for the random pick, which sends random.',
  promptText: 'Hello',
  surfaceId: GREET_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: GREET_SID, catalogId: 'agent-ui--croupier' } },
    { version: 'v1.0', updateComponents: { surfaceId: GREET_SID, components: [CROUPIER_GAME_PICKER_DECK] } },
  ],
}

/** Every persona seed, in shelf order. */
const QUIZ_SID = 'quiz-round'

/** One quiz round's choices, the QuestionCard `options` shape. */
const QUIZ_OPTIONS = [
  { value: 'mercury', label: 'Mercury' },
  { value: 'venus', label: 'Venus' },
  { value: 'earth', label: 'Earth' },
  { value: 'mars', label: 'Mars' },
]

/** The QuestionCard both quizmaster seeds share: round 3 of 10, its pick bound to `/answer`, its reveal to
 *  `/revealed`, the correct option named by `answer` so the reveal can mark the right and wrong rows. A pick
 *  commits: it sends the card's `answer` action (T-0429), so the open round carries no children. */
const QUIZ_CARD = {
  id: 'card',
  component: 'QuestionCard',
  progress: { value: 3, max: 10 },
  meta: 'Science \u00b7 easy',
  question: 'Which planet is closest to the Sun?',
  options: QUIZ_OPTIONS,
  name: 'round3',
  value: { path: '/answer' },
  answer: 'mercury',
  revealed: { path: '/revealed' },
  explanation: 'Mercury orbits closest to the Sun, at about 58 million km.',
  actionName: 'answer',
}

/** The round's data: nothing picked, not yet revealed. */
const QUIZ_DATA = { answer: '', revealed: false }

/** The quizmaster persona over agent-ui: one QuestionCard round whose pick sends the answer. */
export const personaQuizmasterQuestionSeed: PersonaExampleSeed = {
  name: 'persona-quizmaster-question',
  description:
    'The quizmaster persona over the agent-ui base: a QuestionCard headed Question 3 of 10 with Science \u00b7 easy ' +
    'beside it, asking which planet is closest to the Sun, four lettered planet choices whose pick is bound to ' +
    '/answer, mercury named as the answer and the reveal bound to /revealed; picking a choice sends it as the ' +
    'QuestionCard answer action, with no Check answer Button.',
  promptText: 'Quiz me on the solar system, one question at a time.',
  surfaceId: QUIZ_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--quizmaster',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: QUIZ_SID, catalogId: 'agent-ui--quizmaster' } },
    { version: 'v1.0', updateDataModel: { surfaceId: QUIZ_SID, value: QUIZ_DATA } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: QUIZ_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
          QUIZ_CARD,
        ],
      },
    },
  ],
}

/** The quizmaster persona over a2ui-basic: the same round, its pick sending the answer on the Basic base. */
export const personaBasicQuizmasterQuestionSeed: PersonaExampleSeed = {
  name: 'persona-basic-quizmaster-question',
  description:
    'The quizmaster persona over the a2ui-basic base: the same QuestionCard round inside a Basic Column, its pick ' +
    'bound to /answer and its reveal to /revealed; picking a choice sends it as the QuestionCard answer ' +
    'action, with no Check answer Button.',
  promptText: 'Quiz me on the solar system, one question at a time.',
  surfaceId: QUIZ_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--quizmaster',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: QUIZ_SID, catalogId: 'a2ui-basic--quizmaster' } },
    { version: 'v1.0', updateDataModel: { surfaceId: QUIZ_SID, value: QUIZ_DATA } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: QUIZ_SID,
        components: [
          { id: 'root', component: 'Column', justify: 'start', align: 'stretch', children: ['card'] },
          QUIZ_CARD,
        ],
      },
    },
  ],
}

const PAIR_SID = 'palette-contrast'

/** The stylist persona over agent-ui: the approved mockup's pairs, one ContrastPair each, the caption bound. */
export const personaStylistContrastSeed: PersonaExampleSeed = {
  name: 'persona-stylist-contrast',
  description:
    'The stylist persona over the agent-ui base: a Column of four ContrastPairs, each painting its text color on ' +
    'its background with the computed ratio and three verdict pills: Heading on page (#0b3d2e on #e8f5ee, 10.88:1, ' +
    'all pass), Muted caption bound to /caption (#777777 on #ffffff, 4.47:1, AA body fails), Body on white (21.00:1) ' +
    'and a Translucent overlay whose half-transparent background leaves it Unrated, with no ratio and no pills.',
  promptText: 'Check the contrast of my palette pairings.',
  surfaceId: PAIR_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--stylist',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: PAIR_SID, catalogId: 'agent-ui--stylist' } },
    { version: 'v1.0', updateDataModel: { surfaceId: PAIR_SID, value: { caption: { ink: '#777777', paper: '#ffffff' } } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: PAIR_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'caption', 'body', 'overlay'] },
          { id: 'heading', component: 'ContrastPair', label: 'Heading on page', foreground: '#0b3d2e', background: '#e8f5ee' },
          {
            id: 'caption',
            component: 'ContrastPair',
            label: 'Muted caption',
            foreground: { path: '/caption/ink' },
            background: { path: '/caption/paper' },
          },
          { id: 'body', component: 'ContrastPair', label: 'Body on white', foreground: '#000000', background: '#ffffff' },
          { id: 'overlay', component: 'ContrastPair', label: 'Translucent overlay', foreground: '#ffffff99', background: '#14142880' },
        ],
      },
    },
  ],
}

/** Every persona seed, in shelf order. */
export const personaExemplarSeeds: readonly PersonaExampleSeed[] = [
  personaFixtureDemoSeed,
  personaBasicFixtureDemoSeed,
  personaConciergeBookingSeed,
  personaBasicConciergeBookingSeed,
  personaConciergeBookingConfirmedSeed,
  personaBasicConciergeBookingConfirmedSeed,
  personaConciergeStaySeed,
  personaConciergeItinerarySeed,
  personaBasicConciergeItinerarySeed,
  personaCroupierHandSeed,
  personaBasicCroupierHandSeed,
  personaCroupierCardTableSeed,
  personaBasicCroupierCardTableSeed,
  personaCroupierCardTableBettingSeed,
  personaCroupierCardTableSettledSeed,
  personaBasicCroupierCardTableBettingSeed,
  personaBasicCroupierCardTableSettledSeed,
  personaCroupierGamePickerSeed,
  personaQuizmasterQuestionSeed,
  personaBasicQuizmasterQuestionSeed,
  personaStylistContrastSeed,
]
