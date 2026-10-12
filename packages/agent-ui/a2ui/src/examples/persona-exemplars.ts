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
// PlayingCard, CardTable) read the same on either base.
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

/** The booking form's three field kinds (dateSingle, select, checkbox), shared by both booking seeds. */
const BOOKING_FIELDS = [
  { kind: 'dateSingle', path: 'checkIn', label: 'Check-in', required: true },
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
]

/** The confirmation's rows, read from the same `/booking` object the form writes. */
const BOOKING_ROWS = [
  { label: 'Check-in', path: 'checkIn' },
  { label: 'Room type', path: 'roomType' },
  { label: 'Breakfast', path: 'breakfast' },
]

/** The concierge persona over agent-ui: a BookingForm writing `/booking` and a BookingConfirmation reading it. */
export const personaConciergeBookingSeed: PersonaExampleSeed = {
  name: 'persona-concierge-booking',
  description:
    'The concierge persona over the agent-ui base: a BookingForm titled "Book your stay" with a required ' +
    'dateSingle check-in, a required room-type select and a breakfast checkbox, its aggregate bound to ' +
    '/booking and its child a submit Button; beside it a BookingConfirmation whose rows read check-in, room ' +
    'type and breakfast back from the same /booking object.',
  promptText: 'I want to book a room at the hotel: pick a check-in date, a room type and whether I want breakfast.',
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--concierge',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'agent-ui--concierge' } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: { checkIn: '2026-11-14', roomType: 'king', breakfast: true } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['form', 'summary'] },
          { id: 'form', component: 'BookingForm', title: 'Book your stay', fields: BOOKING_FIELDS, value: { path: '/booking' }, child: 'submitBtn' },
          { id: 'submitBtn', component: 'Button', variant: 'solid', label: 'Book now', action: { action: 'confirmBooking', submit: true } },
          { id: 'summary', component: 'BookingConfirmation', title: 'Your booking', rows: BOOKING_ROWS, data: { path: '/booking' } },
        ],
      },
    },
  ],
}

/** The concierge persona over a2ui-basic: the same pair, the submit Button in the Basic dialect. */
export const personaBasicConciergeBookingSeed: PersonaExampleSeed = {
  name: 'persona-basic-concierge-booking',
  description:
    'The concierge persona over the a2ui-basic base: the same BookingForm and BookingConfirmation pair bound ' +
    'to /booking inside a Basic Column, with the form\'s child a Basic Button whose label is a child Text and ' +
    'whose confirm_booking event carries the bound /booking object.',
  promptText: 'I want to book a room at the hotel: pick a check-in date, a room type and whether I want breakfast.',
  surfaceId: BOOKING_SID,
  protocolVersion: 'v1.0',
  catalogId: 'a2ui-basic--concierge',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_SID, catalogId: 'a2ui-basic--concierge' } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: BOOKING_SID, path: '/booking', value: { checkIn: '2026-11-14', roomType: 'twin', breakfast: false } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_SID,
        components: [
          { id: 'root', component: 'Column', justify: 'start', align: 'stretch', children: ['form', 'summary'] },
          { id: 'form', component: 'BookingForm', title: 'Book your stay', fields: BOOKING_FIELDS, value: { path: '/booking' }, child: 'submitBtn' },
          { id: 'submitLabel', component: 'Text', text: 'Book now' },
          {
            id: 'submitBtn',
            component: 'Button',
            variant: 'primary',
            child: 'submitLabel',
            action: { event: { name: 'confirm_booking', context: { booking: { path: '/booking' } } } },
          },
          { id: 'summary', component: 'BookingConfirmation', title: 'Your booking', rows: BOOKING_ROWS, data: { path: '/booking' } },
        ],
      },
    },
  ],
}

const STAY_SID = 'concierge-stay'

/** The stay form's fields: a text name, a number guest count, and a date range as two dateSingle fields. */
const STAY_FIELDS = [
  { kind: 'text', path: 'guestName', label: 'Guest name', required: true },
  { kind: 'number', path: 'guests', label: 'Number of guests', required: true },
  { kind: 'dateSingle', path: 'checkIn', label: 'Check-in', required: true },
  { kind: 'dateSingle', path: 'checkOut', label: 'Check-out', required: true },
]

const STAY_ROWS = [
  { label: 'Guest', path: 'guestName' },
  { label: 'Guests', path: 'guests' },
  { label: 'Check-in', path: 'checkIn' },
  { label: 'Check-out', path: 'checkOut' },
]

/** The concierge persona over agent-ui: a BookingForm using the text and number kinds and a two-field date range. */
export const personaConciergeStaySeed: PersonaExampleSeed = {
  name: 'persona-concierge-stay-details',
  description:
    'The concierge persona over the agent-ui base: a BookingForm titled "Your stay" with a required text guest ' +
    'name, a required number guest count and the date range as two required dateSingle fields (check-in, ' +
    'check-out), its aggregate bound to /stay and its child a submit Button; beside it a BookingConfirmation ' +
    'whose rows read the four values back from the same /stay object.',
  promptText: 'Book a stay for two guests: take the guest name, the number of guests, and the check-in and check-out dates.',
  surfaceId: STAY_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--concierge',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: STAY_SID, catalogId: 'agent-ui--concierge' } },
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
          { id: 'root', component: 'Column', gap: 'md', children: ['form', 'summary'] },
          { id: 'form', component: 'BookingForm', title: 'Your stay', fields: STAY_FIELDS, value: { path: '/stay' }, child: 'submitBtn' },
          { id: 'submitBtn', component: 'Button', variant: 'solid', label: 'Reserve', action: { action: 'reserveStay', submit: true } },
          { id: 'summary', component: 'BookingConfirmation', title: 'Stay summary', rows: STAY_ROWS, data: { path: '/stay' } },
        ],
      },
    },
  ],
}

const TABLE_SID = 'blackjack-table'

/** The croupier persona over agent-ui: an opening blackjack deal, the dealer's hole card face down. */
export const personaCroupierHandSeed: PersonaExampleSeed = {
  name: 'persona-croupier-opening-hand',
  description:
    'The croupier persona over the agent-ui base: a Card blackjack table whose content holds the dealer row ' +
    '(a 9 of clubs up, the hole card a face-down PlayingCard) and the player row (a king of hearts and a 7 of ' +
    'spades, total 17), and whose footer offers Hit and Stand Buttons.',
  promptText: 'Deal me a hand of blackjack.',
  surfaceId: TABLE_SID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui--croupier',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TABLE_SID, catalogId: 'agent-ui--croupier' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TABLE_SID,
        components: [
          { id: 'root', component: 'Card', children: ['tableHeader', 'tableContent', 'tableFooter'] },
          { id: 'tableHeader', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Blackjack' },
          { id: 'tableContent', component: 'CardContent', children: ['dealerLabel', 'dealerCards', 'playerLabel', 'playerCards', 'playerTotal'] },
          { id: 'dealerLabel', component: 'Text', variant: 'h5', text: 'Dealer shows 9' },
          { id: 'dealerCards', component: 'Row', gap: 'md', justify: 'center', children: ['dealerCard1', 'dealerCard2'] },
          { id: 'dealerCard1', component: 'PlayingCard', rank: '9', suit: 'clubs' },
          { id: 'dealerCard2', component: 'PlayingCard', rank: '4', suit: 'diamonds', faceDown: true },
          { id: 'playerLabel', component: 'Text', variant: 'h5', text: 'You' },
          { id: 'playerCards', component: 'Row', gap: 'md', justify: 'center', children: ['playerCard1', 'playerCard2'] },
          { id: 'playerCard1', component: 'PlayingCard', rank: 'K', suit: 'hearts' },
          { id: 'playerCard2', component: 'PlayingCard', rank: '7', suit: 'spades' },
          { id: 'playerTotal', component: 'Text', variant: 'body', text: 'Total: 17. Hit or stand?' },
          { id: 'tableFooter', component: 'CardFooter', children: ['moves'] },
          { id: 'moves', component: 'Row', gap: 'sm', justify: 'center', children: ['hitBtn', 'standBtn'] },
          { id: 'hitBtn', component: 'Button', variant: 'ghost', label: 'Hit', action: { action: 'hit' } },
          { id: 'standBtn', component: 'Button', variant: 'solid', label: 'Stand', action: { action: 'stand' } },
        ],
      },
    },
  ],
}

/** The croupier persona over a2ui-basic: the same deal in Basic rows, the moves as Basic event Buttons. */
export const personaBasicCroupierHandSeed: PersonaExampleSeed = {
  name: 'persona-basic-croupier-opening-hand',
  description:
    'The croupier persona over the a2ui-basic base: a Basic Column table with the dealer Row (a 9 of clubs ' +
    'up, a face-down hole card) and the player Row (a king of hearts and a 7 of spades, total 17), then a ' +
    'Row of Basic Buttons whose child Text labels read Hit and Stand and whose events name the move.',
  promptText: 'Deal me a hand of blackjack.',
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
            children: ['title', 'dealerLabel', 'dealerCards', 'playerLabel', 'playerCards', 'playerTotal', 'moves'],
          },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Blackjack' },
          { id: 'dealerLabel', component: 'Text', variant: 'h5', text: 'Dealer shows 9' },
          { id: 'dealerCards', component: 'Row', justify: 'center', align: 'center', children: ['dealerCard1', 'dealerCard2'] },
          { id: 'dealerCard1', component: 'PlayingCard', rank: '9', suit: 'clubs' },
          { id: 'dealerCard2', component: 'PlayingCard', rank: '4', suit: 'diamonds', faceDown: true },
          { id: 'playerLabel', component: 'Text', variant: 'h5', text: 'You' },
          { id: 'playerCards', component: 'Row', justify: 'center', align: 'center', children: ['playerCard1', 'playerCard2'] },
          { id: 'playerCard1', component: 'PlayingCard', rank: 'K', suit: 'hearts' },
          { id: 'playerCard2', component: 'PlayingCard', rank: '7', suit: 'spades' },
          { id: 'playerTotal', component: 'Text', variant: 'body', text: 'Total: 17. Hit or stand?' },
          { id: 'moves', component: 'Row', justify: 'center', align: 'center', children: ['hitBtn', 'standBtn'] },
          { id: 'hitLabel', component: 'Text', text: 'Hit' },
          { id: 'hitBtn', component: 'Button', variant: 'default', child: 'hitLabel', action: { event: { name: 'hit', context: {} } } },
          { id: 'standLabel', component: 'Text', text: 'Stand' },
          { id: 'standBtn', component: 'Button', variant: 'primary', child: 'standLabel', action: { event: { name: 'stand', context: {} } } },
        ],
      },
    },
  ],
}

const CARD_TABLE_SID = 'card-table'

/** The opening deal both CardTable seeds write: the dealer's hole card face down, the player on 17. */
const CARD_TABLE_DATA = {
  dealerHand: [
    { rank: '9', suit: 'clubs' },
    { rank: '4', suit: 'diamonds', faceDown: true },
  ],
  playerHand: [
    { rank: 'K', suit: 'hearts' },
    { rank: '7', suit: 'spades' },
  ],
  dealerTotal: 9,
  playerTotal: 17,
  bankroll: 1000,
  bet: 50,
}

/** The CardTable node both seeds share: every table figure bound to its data-model path (ADR-0243). */
const CARD_TABLE_ROOT = {
  id: 'root',
  component: 'CardTable',
  title: 'Blackjack',
  status: 'Your move',
  statusIntent: 'info',
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
    'The croupier persona over the agent-ui base: one CardTable titled Blackjack whose hands, totals, bankroll ' +
    'and bet are bound to the data model (a 9 of clubs up and a face-down hole card for the dealer, a king of ' +
    'hearts and a 7 of spades for the player, total 17), with Hit, Stand and Double Buttons as its children.',
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
    'The croupier persona over the a2ui-basic base: the same bound CardTable and opening deal, with Basic ' +
    'Buttons whose child Text labels read Hit, Stand and Double and whose events name the move.',
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

/** Every persona seed, in shelf order. */
export const personaExemplarSeeds: readonly PersonaExampleSeed[] = [
  personaFixtureDemoSeed,
  personaBasicFixtureDemoSeed,
  personaConciergeBookingSeed,
  personaBasicConciergeBookingSeed,
  personaConciergeStaySeed,
  personaCroupierHandSeed,
  personaBasicCroupierHandSeed,
  personaCroupierCardTableSeed,
  personaBasicCroupierCardTableSeed,
]
