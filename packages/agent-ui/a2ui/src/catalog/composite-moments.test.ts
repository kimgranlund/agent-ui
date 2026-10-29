// composite-moments.test.ts: T-0208's data-driven composite-moment checks: each row fires on its hand-built
// surface and stays quiet on the composite, the negative controls stay quiet, the catalog gate keeps each row
// where its types live, and every row's moment is one of its composite's selection intents.

import { describe, expect, it } from 'vitest'
import { COMPOSITE_MOMENTS, TOKEN_TYPES, askedCompositeMoment, proseColors, compositeAnswered, compositeMomentCheck, compositeMomentChecks, isSettledSignal } from './composite-moments.ts'
import type { CompositeMoment } from './composite-moments.ts'
import { gateChecksOnCatalog, runSemanticChecks, semanticSurfaceViews, sessionComponentTypes, sessionSurfaceViews } from './semantic-check.ts'
import type { SurfaceView } from './semantic-check.ts'
import type { A2uiComponent, A2uiOutput } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import { composeCatalog, loadCatalogFragment } from './compose.ts'
import { validateCatalogConformance } from './conformance.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'
import hospitalityFragmentRaw from './domains/hospitality/catalog.json'
import stylistFragmentRaw from './personas/stylist/catalog.json'
import defaultSelection from './default/selection.json'
import conciergeSelection from './domains/hospitality/selection.json'
import stylistSelection from './personas/stylist/selection.json'

const view = (components: A2uiComponent[], surfaceId = 's1'): SurfaceView => ({
  surfaceId,
  components: new Map(components.map((c) => [c.id, c])),
  dataModel: undefined,
})
const codes = (components: A2uiComponent[]): string[] => runSemanticChecks(compositeMomentChecks, { surfaces: [view(components)] }).findings.map((f) => f.code)

/** T-0550: round 17 :154 r2 (reach-shopkeeper-cart-amount-haiku-3, Haiku 5.5), the recorded components: an `order`
 *  ConfirmReceipt whose item quantity binds `/lamp/qty`, and no AmountPicker on shop-lamps-1. */
const R17_154_R2: A2uiComponent[] = [
  { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'order', 'tiles'] },
  { id: 'heading', component: 'Text', text: 'Lamps', variant: 'h4' },
  { id: 'order', component: 'ConfirmReceipt', title: 'Your order', data: { lamp: { qty: 2 } }, items: [{ label: 'Brass Arc Floor Lamp', quantity: { path: '/lamp/qty' }, amount: '$149' }], totalLabel: 'Total', totalPath: '/lamp/total', status: 'pending', confirmAction: { action: 'confirm_order' }, backAction: { action: 'back' } },
  { id: 'tiles', component: 'Row', gap: 'md', wrap: true, children: ['p_arc', 'p_ceramic', 'p_pendant', 'p_rattan'] },
  { id: 'p_arc', component: 'ProductCard', title: 'Brass Arc Floor Lamp', subtitle: 'Solid brass, 160 cm, in stock', price: '$149', badge: 'New', badgeIntent: 'info', actionLabel: 'Buy', action: { action: 'buy', context: { sku: 'lamp-brass-arc' } } },
  { id: 'p_ceramic', component: 'ProductCard', title: 'Speckled Ceramic Table Lamp', subtitle: 'Hand-glazed stoneware, 45 cm, in stock', price: '$68', priceOld: '$85', badge: 'Sale', badgeIntent: 'success', actionLabel: 'Buy', action: { action: 'buy', context: { sku: 'lamp-ceramic-speckle' } } },
  { id: 'p_pendant', component: 'ProductCard', title: 'Linen Drum Pendant', subtitle: 'Natural linen shade, 35 cm, in stock', price: '$92', actionLabel: 'Buy', action: { action: 'buy', context: { sku: 'lamp-linen-drum' } } },
  { id: 'p_rattan', component: 'ProductCard', title: 'Woven Rattan Lantern', subtitle: 'Hand-woven rattan, 30 cm', price: '$54', badge: 'Sold out', badgeIntent: 'danger', actionLabel: 'Sold out', disabled: true, action: { action: 'buy', context: { sku: 'lamp-rattan-lantern' } } },
]
/** T-0550: :154 r2 with the picker the repair asks for, its value bound to the receipt's quantity path. */
const R17_154_PICKED: A2uiComponent[] = [
  { ...R17_154_R2[0]!, children: ['heading', 'order', 'qty_arc', 'tiles'] },
  ...R17_154_R2.slice(1),
  { id: 'qty_arc', component: 'AmountPicker', label: 'Brass Arc Floor Lamp quantity', value: { path: '/lamp/qty' }, min: 1, step: 1 },
]

const HAND_BUILT: Record<string, A2uiComponent[]> = {
  BookingForm: [
    { id: 'root', component: 'Card', children: ['t', 'date', 'party', 'go'] },
    { id: 't', component: 'Text', text: 'Reserve a table' },
    { id: 'date', component: 'Calendar', label: 'Date' },
    { id: 'party', component: 'Slider', label: 'Guests' },
    { id: 'go', component: 'Button', label: 'Book' },
  ],
  BookingConfirmation: [
    { id: 'root', component: 'Card', children: ['t', 'when'] },
    { id: 't', component: 'Text', text: 'Your table is confirmed', variant: 'h4' },
    { id: 'when', component: 'Text', text: 'Friday at 8pm' },
  ],
  // T-0480: the round 15 :150 answer to a timed day plan, a party-size ask deck alone (read with DAY_PLAN, below).
  Itinerary: [
    { id: 'root', component: 'Column', children: ['party'] },
    { id: 'party', component: 'OptionDeck', heading: 'How many guests?', actionName: 'choose', options: [{ value: '2', title: '2 guests' }] },
  ],
  BoardGrid: [
    { id: 'root', component: 'Grid', children: ['c1', 'c2', 'c3'] },
    { id: 'c1', component: 'Button', label: 'A1' },
    { id: 'c2', component: 'Button', label: 'A2' },
    { id: 'c3', component: 'Button', label: 'A3' },
  ],
  GameHud: [
    { id: 'root', component: 'Column', children: ['score', 'board'] },
    { id: 'score', component: 'Text', text: 'Shots remaining: 12' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
  ],
  ResultCard: [
    { id: 'root', component: 'Column', children: ['hud', 'board', 'over'] },
    { id: 'hud', component: 'GameHud', title: 'Battleship', status: 'Done' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
    { id: 'over', component: 'Text', text: 'Game over, you won' },
  ],
  Timeline: [
    { id: 'root', component: 'Card', children: ['title', 'scenes'] },
    { id: 'title', component: 'Text', text: 'Quest log', variant: 'h4' },
    { id: 'scenes', component: 'Column', children: ['s1'] },
    { id: 's1', component: 'Text', text: 'Scene 1: the stair down' },
  ],
  ProductCard: [
    { id: 'root', component: 'Table', label: 'Spa treatments', columns: [{ key: 'treatment', label: 'Treatment' }, { key: 'price', label: 'Price' }], rows: [] },
  ],
  Swatch: [
    { id: 'root', component: 'Column', children: ['title', 'list'] },
    { id: 'title', component: 'Text', text: 'A calm blue palette', variant: 'h4' },
    { id: 'list', component: 'Text', text: 'Primary navy #1f3a5f, secondary steel blue #4a6f8a, accent sky #9cc3e0' },
  ],
  // T-0478: the round 15 :140 repair, an order Column of an AmountPicker line and a total Text.
  ConfirmReceipt: [
    { id: 'order', component: 'Column', children: ['title', 'line', 'total'] },
    { id: 'title', component: 'Text', text: 'Your order', variant: 'h5' },
    { id: 'line', component: 'AmountPicker', label: 'Brass Arc Floor Lamp ($189 each)', value: 2, name: 'qty_arc' },
    { id: 'total', component: 'Text', text: 'Total: $378' },
  ],
  // T-0550: the round 17 :154 repair, a ConfirmReceipt whose quantity no AmountPicker binds.
  AmountPicker: R17_154_R2,
  // T-0377: a wrap-only row; its hand-built shape is the composite inside a Card.
  ContrastPair: [
    { id: 'root', component: 'Card', children: ['pair'] },
    { id: 'pair', component: 'ContrastPair', label: 'Body on page', foreground: '#1f3a5f', background: '#ffffff' },
  ],
}

const COMPOSED: Record<string, A2uiComponent[]> = {
  BookingForm: [{ id: 'root', component: 'BookingForm', title: 'Reserve a table', fields: [] }],
  BookingConfirmation: [{ id: 'root', component: 'BookingConfirmation', title: 'Booking confirmed', rows: [] }],
  Itinerary: [{ id: 'root', component: 'Itinerary', title: 'Your Saturday', days: { path: '/trip/days' } }],
  BoardGrid: [{ id: 'root', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'mark' }],
  GameHud: [
    { id: 'root', component: 'Column', children: ['hud', 'board'] },
    { id: 'hud', component: 'GameHud', title: 'Battleship', status: 'Shots remaining: 12' },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
  ],
  ResultCard: [
    { id: 'root', component: 'Column', children: ['board', 'res'] },
    { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' },
    { id: 'res', component: 'ResultCard', outcome: 'win', title: 'You won', summary: 'Game over' },
  ],
  Timeline: [
    { id: 'root', component: 'Card', children: ['title', 'scenes'] },
    { id: 'title', component: 'Text', text: 'Quest log', variant: 'h4' },
    { id: 'scenes', component: 'Timeline', label: 'Scenes', children: ['s1'] },
    { id: 's1', component: 'TimelineItem', label: 'The stair down', status: 'active' },
  ],
  ProductCard: [
    { id: 'root', component: 'Grid', children: { path: '/treatments', componentId: 'tile' } },
    { id: 'tile', component: 'ProductCard', title: { path: 'name' }, price: { path: 'price' }, actionLabel: 'Book' },
  ],
  Swatch: [
    { id: 'root', component: 'Column', children: ['note', 'navy', 'blues'] },
    { id: 'note', component: 'Text', text: 'Navy #1f3a5f anchors the palette.' },
    { id: 'navy', component: 'Swatch', label: 'Primary navy', value: '#1f3a5f' },
    { id: 'blues', component: 'Ramp', label: 'Navy', steps: [{ label: '500', value: '#3d5f86' }] },
  ],
  ConfirmReceipt: [
    { id: 'order', component: 'Column', children: ['receipt', 'line'] },
    { id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', items: [{ label: 'Brass Arc Floor Lamp', quantity: { path: '/cart/qty' }, amount: { path: '/cart/amount' } }], totalPath: '/cart/total', status: 'pending' },
    { id: 'line', component: 'AmountPicker', label: 'Brass Arc Floor Lamp quantity', value: { path: '/cart/qty' } },
  ],
  AmountPicker: R17_154_PICKED,
  ContrastPair: [
    { id: 'root', component: 'Column', children: ['pair'] },
    { id: 'pair', component: 'ContrastPair', label: 'Body on page', foreground: '#1f3a5f', background: '#ffffff' },
  ],
}

/** T-0377: a row with `notInside` and no hand-built detector is wrap-only; its hand-built shape is the wrapped composite. */
const DETECTORS = ['words', 'inputs', 'readBack', 'inputCue', 'logOf', 'gridOf', 'tableColumn', 'pricedRows', 'boardless', 'has', 'planned', 'unpickedLines'] as const
const wrapOnly = (m: CompositeMoment): boolean => m.notInside !== undefined && DETECTORS.every((k) => m[k] === undefined)

const codeOf = (composite: string): string => {
  const row = COMPOSITE_MOMENTS.find((m) => m.composite === composite)!
  // T-0550: an unpicked receipt line is SURFACE_MISSING, as the ticket names it.
  if (row.unpickedLines !== undefined) return 'SURFACE_MISSING'
  return `${composite.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}_${wrapOnly(row) ? 'WRAPPED' : 'MISSING'}`
}

/** T-0480: the round 15 :150 say turn, a day plan of three timed stops. */
const DAY_PLAN = 'Plan my Saturday 21 November 2026: breakfast at 08:00, the half-day coastal boat tour at 10:00 and dinner at Vela at 20:00.'
/** T-0480: a `planned` row reads the guest's words, so its hand-built and composed surfaces are judged on that say turn. */
const SAID: Record<string, string> = { Itinerary: DAY_PLAN }
const saidCodes = (composite: string, components: A2uiComponent[]): string[] =>
  runSemanticChecks(compositeMomentChecks, { surfaces: [view(components)], intent: SAID[composite] }).findings.map((f) => f.code)

describe('composite moment checks (T-0208)', () => {
  for (const { composite } of COMPOSITE_MOMENTS) {
    it(`${composite}: the hand-built surface yields ${codeOf(composite)} alone and the composite surface yields none`, () => {
      expect(saidCodes(composite, HAND_BUILT[composite]!)).toEqual([codeOf(composite)])
      expect(saidCodes(composite, COMPOSED[composite]!)).toEqual([])
    })
  }

  it('the finding names the surface, the strays, the moment and the repair', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(HAND_BUILT['BoardGrid']!, 'board-1')] }).findings
    expect(f!.path).toBe('board-1:root')
    expect(f!.message).toContain('root (a Grid)')
    expect(f!.message).toContain('a board of cells to target or mark')
    expect(f!.message).toContain('Make it ONE BoardGrid')
  })

  it('T-0262: the BookingConfirmation repair asks for literal rows of {label, path} in the Card\'s place, not inside it', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(HAND_BUILT['BookingConfirmation']!, 'ask-2')] }).findings
    expect(f!.message).toContain('rows as a literal array of {label, path}')
    expect(f!.message).toContain('never bind rows itself')
    expect(f!.message).toContain('in place of the hand-built Card, never inside one')
    expect(f!.message).toContain('a root Card needs the surface re-created')
    expect(f!.message).not.toContain('rows bound to')
  })

  it('T-0262: the shape the repair asks for passes the concierge catalog, and a bound rows fails it', () => {
    const concierge = composeCatalog(loadCatalog(defaultCatalogRaw), loadCatalogFragment(hospitalityFragmentRaw), 'hospitality')
    const asked: A2uiComponent = { id: 'root', component: 'BookingConfirmation', title: 'Spa booking confirmed', data: { path: '/booking' }, rows: [{ label: 'Date', path: 'date' }] }
    expect(validateCatalogConformance(asked, concierge)).toEqual([])
    expect(validateCatalogConformance({ ...asked, rows: { path: '/booking/rows' } }, concierge)).toEqual([{ code: 'CATALOG', path: 'root.rows' }])
  })

  it('T-0262: the recorded Opus repair (a BookingConfirmation inside the old Card) yields BOOKING_CONFIRMATION_WRAPPED', () => {
    const recorded: A2uiComponent[] = [
      { id: 'root', component: 'Card', elevation: '1', children: ['body'] },
      { id: 'body', component: 'CardContent', children: ['confirmation'] },
      { id: 'confirmation', component: 'BookingConfirmation', title: 'Spa booking confirmed', data: { path: '/booking' }, rows: [] },
    ]
    expect(codes(recorded)).toEqual(['BOOKING_CONFIRMATION_WRAPPED'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(recorded, 'ask-2')] }).findings
    expect(f!.path).toBe('ask-2:root')
    expect(f!.message).toContain('wraps its BookingConfirmation in root (a Card)')
    expect(codes([{ id: 'root', component: 'Column', children: ['confirmation'] }, recorded[2]!])).toEqual([])
  })

  // T-0377: round 12 :3 (2026-10-19-r12-targeted, smoke-stylist-palette-haiku-1, Haiku 5.5), the recorded components.
  const R12_PALETTE: A2uiComponent[] = [
    { id: 'root', component: 'Card', elevation: '1', children: ['root_header', 'root_content'] },
    { id: 'root_header', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Calm blue palette for banking', variant: 'h4' },
    { id: 'root_content', component: 'CardContent', children: ['col'] },
    { id: 'col', component: 'Column', gap: 'md', children: ['roles_caption', 'roles_row', 'tonal_caption', 'tonal_ramp', 'pairs_caption', 'pairs_col'] },
    { id: 'roles_caption', component: 'Text', text: 'Anchor colors', variant: 'caption' },
    { id: 'roles_row', component: 'Row', gap: 'lg', wrap: true, children: ['sw_primary', 'sw_secondary', 'sw_accent', 'sw_surface'] },
    { id: 'sw_primary', component: 'Swatch', label: { path: '/primary/label' }, value: { path: '/primary/value' } },
    { id: 'sw_secondary', component: 'Swatch', label: { path: '/secondary/label' }, value: { path: '/secondary/value' } },
    { id: 'sw_accent', component: 'Swatch', label: { path: '/accent/label' }, value: { path: '/accent/value' } },
    { id: 'sw_surface', component: 'Swatch', label: { path: '/surface/label' }, value: { path: '/surface/value' } },
    { id: 'tonal_caption', component: 'Text', text: 'Primary tonal range', variant: 'caption' },
    { id: 'tonal_ramp', component: 'Ramp', label: 'Primary tonal range', steps: { path: '/tonal' } },
    { id: 'pairs_caption', component: 'Text', text: 'Text and button pairings', variant: 'caption' },
    { id: 'pairs_col', component: 'Column', gap: 'md', children: ['pair_1', 'pair_2', 'pair_3'] },
    { id: 'pair_1', component: 'ContrastPair', label: 'Primary text on surface', foreground: 'oklch(0.45 0.12 250)', background: 'oklch(0.99 0.005 250)', sample: 'Your balance' },
    { id: 'pair_2', component: 'ContrastPair', label: 'Button label', foreground: 'oklch(0.99 0.005 250)', background: 'oklch(0.45 0.12 250)', sample: 'Transfer money' },
    { id: 'pair_3', component: 'ContrastPair', label: 'Body text on tint', foreground: 'oklch(0.25 0.07 250)', background: 'oklch(0.96 0.015 250)', sample: '2 payments pending' },
  ]

  it('T-0377: the recorded r12 :3 palette (ContrastPairs in a root Card) yields CONTRAST_PAIR_WRAPPED, naming the Card', () => {
    expect(codes(R12_PALETTE)).toEqual(['CONTRAST_PAIR_WRAPPED'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(R12_PALETTE, 'banking-palette')] }).findings
    expect(f!.path).toBe('banking-palette:root')
    expect(f!.message).toContain('wraps its ContrastPair in root (a Card)')
    expect(f!.message).toContain('a root Card needs the surface re-created')
    expect(f!.message).toContain('in a root Column')
    expect(f!.message).toContain("the Card's title Text first")
    expect(f!.message).toContain('with its CardHeader and CardContent')
  })

  it('T-0377: a ContrastPair stamped by a template under a Card yields CONTRAST_PAIR_WRAPPED; under a root Column none', () => {
    const templated: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['col'] },
      { id: 'col', component: 'Column', children: { path: '/pairs', componentId: 'pair' } },
      { id: 'pair', component: 'ContrastPair', label: { path: 'label' }, foreground: { path: 'fg' }, background: { path: 'bg' } },
    ]
    expect(codes(templated)).toEqual(['CONTRAST_PAIR_WRAPPED'])
    expect(codes(templated.slice(1).map((c) => (c.id === 'col' ? { ...c, id: 'root' } : c)))).toEqual([])
  })

  it('T-0377 negative controls: the same palette rooted at its Column, and a Card of Swatches and a Ramp, yield none', () => {
    const unwrapped = R12_PALETTE.filter((c) => !['root', 'root_header', 'title', 'root_content'].includes(c.id)).map((c) => (c.id === 'col' ? { ...c, id: 'root' } : c))
    expect(unwrapped.some((c) => c.component === 'Card')).toBe(false)
    expect(codes(unwrapped)).toEqual([])
    const pairsPart = new Set(['pairs_caption', 'pairs_col', 'pair_1', 'pair_2', 'pair_3'])
    const noPairs = R12_PALETTE.filter((c) => !pairsPart.has(c.id)).map((c) => (c.id === 'col' ? { ...c, children: (c.children as string[]).filter((id) => !pairsPart.has(id)) } : c))
    expect(noPairs.map((c) => c.component)).toContain('Card')
    expect(codes(noPairs)).toEqual([])
  })

  it('the recorded Lexicographer guess field yields BOARD_GRID_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['title', 'guess_field', 'go'] },
        { id: 'title', component: 'Text', text: 'Six guesses. Five letters each.' },
        { id: 'guess_field', component: 'TextField', label: 'Your guess (five lowercase letters)', name: 'guess', value: { path: '/draft/guess' } },
        { id: 'go', component: 'Button', label: 'Submit guess' },
      ]),
    ).toEqual(['BOARD_GRID_MISSING'])
  })

  // T-0266: the recorded Sonnet read-back (long-concierge-booking, turn 1, ask-2) answers a fully specified spa
  // booking with a DescriptionList and a confirm Button; Kim's ruling makes that a pre-filled BookingForm.
  const READ_BACK: A2uiComponent[] = [
    { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
    { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
    { id: 'hd', component: 'CardHeader', children: ['hdt'] },
    { id: 'hdt', component: 'Text', text: 'Spa booking summary', variant: 'h4' },
    { id: 'ct', component: 'CardContent', children: ['receipt'] },
    {
      id: 'receipt',
      component: 'DescriptionList',
      rows: [
        { label: 'Treatment', value: 'Massage, 60 minutes' },
        { label: 'Date', value: 'Thursday 19 November 2026' },
        { label: 'Time', value: '15:00' },
        { label: 'Guests', value: '1' },
        { label: 'Name', value: 'Alex Moreau' },
      ],
    },
    { id: 'ft', component: 'CardFooter', children: ['confirm'] },
    { id: 'confirm', component: 'Button', label: 'Confirm booking', variant: 'solid', action: { action: 'confirm_booking' } },
  ]

  it('the recorded booking read-back yields BOOKING_FORM_MISSING alone, naming the list and the confirm Button', () => {
    expect(codes(READ_BACK)).toEqual(['BOOKING_FORM_MISSING'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(READ_BACK, 'ask-2')] }).findings
    expect(f!.path).toBe('ask-2:receipt')
    expect(f!.message).toContain('confirm (a Button)')
    expect(f!.message).toContain('pre-filled')
  })

  // T-0331: round 9 :84 (regress-concierge-facilities-then-tour-haiku-1, ask-1, forced round 3) ships this read-back:
  // a "Book now" Button whose action is `confirm_booking` with `submit`. The old label cue (`confirm`) let it through.
  const R9_84: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Book your boat tour', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['summary'] },
    {
      id: 'summary',
      component: 'DescriptionList',
      rows: [
        { label: 'Tour', value: 'Half-day coastal boat tour' },
        { label: 'Date', value: 'Saturday 21 November 2026' },
        { label: 'Guests', value: '2' },
        { label: 'Name', value: 'Alex Moreau' },
      ],
    },
    { id: 'footer', component: 'CardFooter', children: ['bookBtn'] },
    {
      id: 'bookBtn',
      component: 'Button',
      label: 'Book now',
      variant: 'solid',
      action: { action: 'confirm_booking', context: { booking: { path: '/booking' } }, submit: true },
    },
  ]
  const withButton = (base: A2uiComponent[], id: string, patch: Partial<A2uiComponent>): A2uiComponent[] =>
    base.map((c) => (c.id === id ? { ...c, ...patch } : c))

  it('the :84 round 3 read-back ("Book now", confirm_booking) yields BOOKING_FORM_MISSING', () => {
    expect(codes(R9_84)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('a submit Button or an action starting with confirm is the read-back confirm, whatever its label or style', () => {
    const action = (a: Record<string, unknown>) => withButton(R9_84, 'bookBtn', { label: 'Go', action: a })
    expect(codes(action({ action: 'confirm_boat_tour', submit: true }))).toEqual(['BOOKING_FORM_MISSING'])
    expect(codes(action({ action: 'send_it', submit: true }))).toEqual(['BOOKING_FORM_MISSING'])
    expect(codes(action({ action: 'confirm_boat_tour' }))).toEqual(['BOOKING_FORM_MISSING'])
    for (const name of ['confirm', 'confirmBooking', 'confirm-booking', 'Confirm_Booking']) {
      expect(codes(action({ action: name }))).toEqual(['BOOKING_FORM_MISSING'])
    }
    expect(codes(action({ action: 'book_boat_tour' }))).toEqual([])
  })

  it('reads a bound label and a child Text label (the label fallback)', () => {
    const noAction = { action: { action: 'go' } }
    const bound = withButton(R9_84, 'bookBtn', { label: { path: '/ui/cta' }, ...noAction })
    const dataModel = { ui: { cta: 'Confirm booking' } }
    expect(runSemanticChecks(compositeMomentChecks, { surfaces: [{ ...view(bound), dataModel }] }).findings.map((f) => f.code)).toEqual(['BOOKING_FORM_MISSING'])
    const child = [...withButton(R9_84, 'bookBtn', { label: undefined, child: 'cta', ...noAction }), { id: 'cta', component: 'Text', text: 'Confirm booking' }]
    expect(codes(child)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('the r5 ask-3 read-back (confirm_boat_tour, "Book now") yields BOOKING_FORM_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['head', 'body', 'foot'] },
        { id: 'head', component: 'CardHeader', children: ['title'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Half-day coastal boat tour' },
        { id: 'body', component: 'CardContent', children: ['list'] },
        {
          id: 'list',
          component: 'DescriptionList',
          rows: [
            { label: 'Tour', value: 'Half-day coastal boat tour' },
            { label: 'Name', value: 'Alex Moreau' },
            { label: 'Departure', value: 'To be confirmed by the front desk' },
          ],
        },
        { id: 'foot', component: 'CardFooter', child: 'btn' },
        { id: 'btn', component: 'Button', label: 'Book now', variant: 'solid', action: { action: 'confirm_boat_tour', submit: true, context: { booking: { path: '/booking' } } } },
      ]),
    ).toEqual(['BOOKING_FORM_MISSING'])
  })

  // The r8 routing-long-session-opus-1 `dining-info` card: an info list with an intent-starting CTA.
  const DINING_INFO: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Dining at the Grand Meridian', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list'] },
    {
      id: 'list',
      component: 'DescriptionList',
      rows: [
        { label: 'Vela', value: 'Fine-dining restaurant' },
        { label: 'The Quay Bar', value: 'Casual bar for drinks and lighter meals' },
      ],
    },
    { id: 'footer', component: 'CardFooter', children: ['reserve'] },
    { id: 'reserve', component: 'Button', label: 'Reserve a table', variant: 'solid', action: { action: 'start_intent', context: { intent: 'reserve_table' } } },
  ]

  it('negative control: the r8 dining-info card (a "Reserve a table" start_intent CTA, no submit) yields none', () => {
    expect(codes(DINING_INFO)).toEqual([])
  })

  it('negative control: "Book now" and "Reserve a table" CTAs with no submit yield none', () => {
    for (const label of ['Book now', 'Reserve a table', 'Reserve']) {
      expect(codes(withButton(DINING_INFO, 'reserve', { label }))).toEqual([])
      expect(codes(withButton(DINING_INFO, 'reserve', { label, action: { action: 'start_intent', context: { intent: 'book' } } }))).toEqual([])
    }
  })

  it('a read-back titled "Booking confirmation" with a confirm_booking submit still yields BOOKING_FORM_MISSING, alone', () => {
    // T-0333: the noun "confirmation" is no settled state, and a live read-back confirm is never settled.
    expect(codes(withButton(R9_84, 'title', { text: 'Booking confirmation' }))).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('negative control: a "Book now" info card whose action is book_listing yields none', () => {
    expect(codes(withButton(DINING_INFO, 'reserve', { label: 'Book now', action: { action: 'book_listing', context: { id: 'villa' } } }))).toEqual([])
  })

  it('negative control: a hand-built confirmation with a "Reserve another table" Button yields only BOOKING_CONFIRMATION_MISSING', () => {
    const settled: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['t', 'rows', 'again'] },
      { id: 't', component: 'Text', text: 'Your table is confirmed', variant: 'h4' },
      { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Restaurant', value: 'Vela' }, { label: 'Time', value: '19:30' }] },
      { id: 'again', component: 'Button', label: 'Reserve another table', action: { action: 'book_another_table' } },
    ]
    expect(codes(settled)).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('negative control: a booking-worded DescriptionList with no confirm Button yields none', () => {
    // An info CTA: it starts an intent and submits nothing, so it is no read-back confirm (T-0331: by action, not label).
    const info = READ_BACK.map((c) =>
      c.id === 'confirm' ? { ...c, label: 'Book a treatment', action: { action: 'start_intent', context: { intent: 'book_treatment' } } } : c,
    )
    expect(codes(info)).toEqual([])
    expect(codes(READ_BACK.filter((c) => c.id !== 'confirm'))).toEqual([])
  })

  it('negative control: a confirm Button and a DescriptionList beside one booking input yield none', () => {
    expect(codes([...READ_BACK, { id: 'note', component: 'TextField', label: 'Notes for the spa' }])).toEqual([])
  })

  it('negative control: a pre-filled BookingForm with a confirm child yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'BookingForm', title: 'Spa booking', fields: [{ kind: 'text', path: 'name', label: 'Name' }], value: { path: '/draft' }, child: 'go' },
        { id: 'go', component: 'Button', label: 'Confirm booking', action: { action: 'confirm_booking', submit: true } },
      ]),
    ).toEqual([])
  })

  // T-0198: a booking walked as one StepFlow holds Calendar and RadioGroup (BOOKING_INPUTS at min 2) in its scenes;
  // the StepFlow stands aside, while the same scenes in a plain Column still get the BookingForm repair.
  it('negative control: a booking StepFlow over a Calendar and a RadioGroup yields none', () => {
    const scenes: A2uiComponent[] = [
      { id: 'dates', component: 'Calendar', mode: 'range', valueStart: { path: '/draft/from' }, valueEnd: { path: '/draft/to' } },
      { id: 'room', component: 'RadioGroup', value: { path: '/draft/room' }, children: ['king', 'twin'] },
      { id: 'king', component: 'Radio', value: 'king', label: 'King room' },
      { id: 'twin', component: 'Radio', value: 'twin', label: 'Twin room' },
    ]
    const flow: A2uiComponent = {
      id: 'root', component: 'StepFlow', steps: ['Dates', 'Room'], step: { path: '/step' }, draft: { path: '/draft' },
      finishLabel: 'Book the room', finishAction: { action: 'book_room' }, children: ['dates', 'room'],
    }
    expect(codes([flow, ...scenes])).toEqual([])
    expect(codes([{ id: 'root', component: 'Column', children: ['t', 'dates', 'room'] }, { id: 't', component: 'Text', text: 'Book a room' }, ...scenes])).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('negative control: a croupier CardTable betting surface yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'CardTable', phase: 'betting', bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, betAction: 'deal', title: 'Blackjack' },
      ]),
    ).toEqual([])
  })

  it('negative control: a CardTable three-button grid betting strip yields no BOARD_GRID_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Column', children: ['table', 'bets'] },
        { id: 'table', component: 'CardTable', phase: 'betting', bet: { path: '/bet' }, bankroll: { path: '/bankroll' }, betAction: 'deal', title: 'Blackjack' },
        { id: 'bets', component: 'Grid', children: ['b1', 'b2', 'b3'] },
        { id: 'b1', component: 'Button', label: 'Bet 5' },
        { id: 'b2', component: 'Button', label: 'Bet 10' },
        { id: 'b3', component: 'Button', label: 'Bet 25' },
      ]),
    ).not.toContain('BOARD_GRID_MISSING')
  })

  it('negative control: a Mentalist number-guess TextField yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['t', 'guess', 'go'] },
        { id: 't', component: 'Text', text: 'I am thinking of a number from 1 to 100' },
        { id: 'guess', component: 'TextField', label: 'Your guess', name: 'guess', value: { path: '/guess' } },
        { id: 'go', component: 'Button', label: 'Guess' },
      ]),
    ).toEqual([])
  })

  it('negative control: a GameHud-word Text with no BoardGrid yields none', () => {
    expect(codes([{ id: 't', component: 'Text', text: 'Score: 3, attempts remaining: 2' }])).toEqual([])
  })

  // T-0358: the smoke round 2026-10-18-smoke (Haiku 5.5) hand-built the score strip of three board-less game personas
  // whose skills name ONE GameHud (guess-hud, deal-sheet, quest-log). Each is GAME_HUD_MISSING with no BoardGrid.
  const BOARDLESS: Record<string, A2uiComponent[]> = {
    mentalist: [
      { id: 'root', component: 'Card', children: ['hd', 'ct'] },
      { id: 'hd', component: 'CardHeader', children: ['title', 'spent_badge'] },
      { id: 'title', component: 'Text', text: 'Twenty Questions', variant: 'h4' },
      { id: 'spent_badge', component: 'Badge', label: { path: '/hud/spentLabel' } },
      { id: 'ct', component: 'CardContent', children: ['progress', 'conf'] },
      { id: 'progress', component: 'Progress', value: { path: '/hud/spent' }, max: 20, label: 'Questions spent' },
      { id: 'conf', component: 'Stat', label: 'Confidence', value: { path: '/hud/confidence' } },
    ],
    negotiator: [
      { id: 'root', component: 'Card', children: ['hd', 'sheet'] },
      { id: 'hd', component: 'CardHeader', children: ['title', 'badge'] },
      { id: 'title', component: 'Text', text: 'Deal sheet: Brass lantern', variant: 'h4' },
      { id: 'badge', component: 'Badge', label: 'Asking 240 silver' },
      { id: 'sheet', component: 'DescriptionList', rows: [{ label: 'Item', value: 'Brass lantern' }, { label: 'Asking price', value: '240 silver' }, { label: "Merchant's mood", value: 'Curious' }] },
    ],
    'dungeon-master': [
      { id: 'root', component: 'Card', children: ['strip'] },
      { id: 'strip', component: 'Row', children: ['hp', 'gold'] },
      { id: 'hp', component: 'Badge', label: 'HP 12/12' },
      { id: 'gold', component: 'Badge', label: 'Gold 0' },
    ],
  }

  for (const [persona, components] of Object.entries(BOARDLESS)) {
    it(`T-0358: the recorded ${persona} score strip with no BoardGrid yields GAME_HUD_MISSING, and with a GameHud none`, () => {
      expect(codes(components)).toEqual(['GAME_HUD_MISSING'])
      expect(codes([...components, { id: 'hud', component: 'GameHud', title: 'Game' }])).toEqual([])
    })
  }

  it('T-0358: the board-less finding names the hand-built stat components', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(BOARDLESS['dungeon-master']!, 'quest-log')] }).findings
    expect(f!.path).toBe('quest-log:hp')
    expect(f!.message).toContain('hp (a Badge), gold (a Badge)')
    expect(f!.message).toContain('Make it ONE GameHud with its title, status and stats (and progress when the game counts turns), beside the BoardGrid when the game has one')
  })

  // T-0358 review: a stat strip with no game words is no game. Each of these holds two game-stat items, so without the
  // row's game gate each would fire.
  it('T-0358 negative control: a KPI strip with an NPS score and a model confidence yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['nps', 'conf'] },
        { id: 'nps', component: 'Stat', label: 'NPS score', value: '62' },
        { id: 'conf', component: 'Stat', label: 'Model confidence', value: '0.91' },
      ]),
    ).toEqual([])
  })

  it('T-0358 negative control: a concierge Gold member card yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['title', 'tier', 'rows'] },
        { id: 'title', component: 'Text', text: 'Your membership', variant: 'h4' },
        { id: 'tier', component: 'Badge', label: 'Gold member' },
        { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Tier', value: 'Gold' }, { label: 'Member since', value: '2019' }] },
      ]),
    ).toEqual([])
  })

  it('T-0358 negative control: a listing with an asking price and a counter offer yields none', () => {
    expect(
      codes([
        { id: 'root', component: 'Card', children: ['title', 'ask', 'counter'] },
        { id: 'title', component: 'Text', text: '14 Harbour Road', variant: 'h4' },
        { id: 'ask', component: 'Stat', label: 'Asking price', value: '$640,000' },
        { id: 'counter', component: 'Stat', label: 'Counter offer', value: '$610,000' },
      ]),
    ).toEqual([])
  })

  it('T-0358 negative control: a CardTable with zone score Badges yields no GAME_HUD_MISSING', () => {
    expect(
      codes([
        { id: 'root', component: 'Column', children: ['table', 'round', 'you', 'dealer'] },
        { id: 'table', component: 'CardTable', phase: 'player-turn', title: 'Blackjack' },
        { id: 'round', component: 'Badge', label: 'Round 2' },
        { id: 'you', component: 'Badge', label: 'Your score 17' },
        { id: 'dealer', component: 'Badge', label: 'Dealer score 10' },
      ]),
    ).not.toContain('GAME_HUD_MISSING')
  })

  // T-0426: the GameHud row's CardTable `lacks` is what keeps that CardTable surface quiet; without it the surface fires.
  it('T-0426: the CardTable zone score Badges fire GAME_HUD_MISSING with CardTable out of lacks', () => {
    const table: A2uiComponent[] = [
      { id: 'root', component: 'Column', children: ['table', 'round', 'you', 'dealer'] },
      { id: 'table', component: 'CardTable', phase: 'player-turn', title: 'Blackjack' },
      { id: 'round', component: 'Badge', label: 'Round 2' },
      { id: 'you', component: 'Badge', label: 'Your score 17' },
      { id: 'dealer', component: 'Badge', label: 'Dealer score 10' },
    ]
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'GameHud')!
    const fires = (m: CompositeMoment): string[] => runSemanticChecks([compositeMomentCheck(m)], { surfaces: [view(table)] }).findings.map((f) => f.code)
    expect(fires(row)).toEqual([])
    expect(fires({ ...row, lacks: row.lacks.filter((t) => t !== 'CardTable') })).toEqual(['GAME_HUD_MISSING'])
  })

  it('T-0358 negative control: one game-stat Badge, a KPI strip and inventory Badges yield none', () => {
    expect(codes([{ id: 'gold', component: 'Badge', label: 'Gold 0' }])).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['a', 'b', 'c'] },
        { id: 'a', component: 'Stat', label: 'Revenue', value: '$12k' },
        { id: 'b', component: 'Stat', label: 'Conversion', value: '3.1%' },
        { id: 'c', component: 'Progress', label: 'Quota', value: 40, max: 100 },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'inv', component: 'Row', children: ['i1', 'i2'] },
        { id: 'i1', component: 'Badge', label: 'Torch' },
        { id: 'i2', component: 'Badge', label: 'Dagger' },
      ]),
    ).toEqual([])
  })

  // T-0365: the T-0362 re-record (round 2026-10-18-t0362-smoke, Haiku 5.5) hand-built two strips the T-0358 row missed:
  // the Mentalist's "Q1 of 20" counter Badge beside a "Questions spent" Progress, and the Dungeon Master's HP and Gold as
  // two Texts in a Row.
  const STRIPS_T0362: Record<string, A2uiComponent[]> = {
    mentalist: [
      { id: 'root', component: 'Card', children: ['hd', 'ct'] },
      { id: 'hd', component: 'CardHeader', children: ['title', 'count'] },
      { id: 'title', component: 'Text', text: 'Twenty Questions', variant: 'h4' },
      { id: 'count', component: 'Badge', label: 'Q1 of 20', intent: 'neutral' },
      { id: 'ct', component: 'CardContent', children: ['q_text', 'prog', 'conf'] },
      { id: 'q_text', component: 'Text', text: 'Is it a living thing?', variant: 'h5' },
      { id: 'prog', component: 'Progress', value: 1, max: 20, label: 'Questions spent' },
      { id: 'conf', component: 'Text', text: 'Confidence: low, the net is wide open.', variant: 'caption' },
    ],
    'dungeon-master': [
      { id: 'root', component: 'Card', children: ['hd', 'ct'] },
      { id: 'hd', component: 'CardHeader', children: ['title'] },
      { id: 'title', component: 'Text', text: 'Quest log', variant: 'h4' },
      { id: 'ct', component: 'CardContent', children: ['strip', 'invH', 'inv'] },
      { id: 'strip', component: 'Row', gap: 'md', children: ['hp', 'gold'] },
      { id: 'hp', component: 'Text', text: 'HP 12 / 12', variant: 'label', emphasis: true },
      { id: 'gold', component: 'Text', text: 'Gold 0', variant: 'label', emphasis: true },
      { id: 'invH', component: 'Text', text: 'Inventory (3 of 6)', variant: 'label' },
      { id: 'inv', component: 'Row', gap: 'sm', children: ['i1', 'i2'] },
      { id: 'i1', component: 'Badge', label: 'Dagger' },
      { id: 'i2', component: 'Badge', label: 'Torch' },
    ],
  }

  for (const [persona, components] of Object.entries(STRIPS_T0362)) {
    it(`T-0365: the recorded ${persona} strip from the T-0362 re-record yields GAME_HUD_MISSING, and with a GameHud none`, () => {
      expect(codes(components)).toEqual(['GAME_HUD_MISSING'])
      expect(codes([...components, { id: 'hud', component: 'GameHud', title: 'Game' }])).toEqual([])
    })
  }

  it('T-0365: the finding names the counter Badge, the Progress and the grouped Texts', () => {
    const find = (cs: A2uiComponent[]) => runSemanticChecks(compositeMomentChecks, { surfaces: [view(cs, 'quest-log')] }).findings[0]!.message
    expect(find(STRIPS_T0362['mentalist']!)).toContain('count (a Badge), prog (a Progress), conf (a Text)')
    expect(find(STRIPS_T0362['dungeon-master']!)).toContain('hp (a Text), gold (a Text)')
  })

  // T-0365 review: the sibling group, not a Row, admits a stat Text; each distinct stat a component names counts.
  const QUEST = { id: 'title', component: 'Text', text: 'Quest log', variant: 'h4' } as const
  const STRIP_SHAPES: Record<string, A2uiComponent[]> = {
    'a Badge and a Text side by side': [
      { id: 'root', component: 'Column', children: ['title', 'hp', 'gold'] },
      QUEST,
      { id: 'hp', component: 'Badge', label: 'HP 12/12' },
      { id: 'gold', component: 'Text', text: 'Gold 0' },
    ],
    'a stat Text in a single-child wrapper': [
      { id: 'root', component: 'Row', children: ['title', 'hpBox', 'goldBox'] },
      QUEST,
      { id: 'hpBox', component: 'Card', child: 'hp' },
      { id: 'hp', component: 'Text', text: 'HP 12 / 12' },
      { id: 'goldBox', component: 'Card', child: 'gold' },
      { id: 'gold', component: 'Text', text: 'Gold 0' },
    ],
    'one Text naming two stats': [
      { id: 'root', component: 'Column', children: ['title', 'strip'] },
      QUEST,
      { id: 'strip', component: 'Row', children: ['s'] },
      { id: 's', component: 'Text', text: 'HP 12/12, Gold 0' },
    ],
    'one Badge naming two stats': [
      { id: 'root', component: 'Column', children: ['title', 's'] },
      QUEST,
      { id: 's', component: 'Badge', label: 'HP 12/12, Gold 0' },
    ],
  }
  for (const [shape, components] of Object.entries(STRIP_SHAPES)) {
    it(`T-0365 review: ${shape} on a quest yields GAME_HUD_MISSING`, () => {
      expect(codes(components)).toEqual(['GAME_HUD_MISSING'])
    })
  }

  it('T-0365 review: the slash and spaced counters count; a bare "3 of 6" or "3/6" does not', () => {
    for (const label of ['Q1/20', 'Q 1 of 20', 'Round 2/5', 'Guess 3/6']) {
      expect(codes([{ id: 'root', component: 'Row', children: ['title', 'c', 'hp'] }, QUEST, { id: 'c', component: 'Badge', label }, { id: 'hp', component: 'Badge', label: 'HP 12/12' }])).toEqual(['GAME_HUD_MISSING'])
    }
    for (const label of ['Inventory 3 of 6', 'Slots 3/6']) {
      expect(codes([{ id: 'root', component: 'Row', children: ['title', 'c', 'hp'] }, QUEST, { id: 'c', component: 'Badge', label }, { id: 'hp', component: 'Badge', label: 'HP 12/12' }])).toEqual([])
    }
  })

  // T-0365 negative controls, each on a surface whose words name a game (or, for the counter gate, whose only game word
  // is the counter), so each reaches the widened strip and is kept quiet by one guard.
  it('T-0365 negative control: narration that mentions gold and HP is no stat strip', () => {
    expect(
      codes([
        { id: 'root', component: 'Column', children: ['title', 'a', 'b'] },
        QUEST,
        { id: 'a', component: 'Text', text: 'You pry 20 gold from the chest.' },
        { id: 'b', component: 'Text', text: 'A potion restores your HP.' },
      ]),
    ).toEqual([])
  })

  it('T-0365 negative control: stat Texts in two groups that each hold one stat yield none', () => {
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['title', 'a', 'b'] },
        { id: 'title', component: 'Text', text: 'Dungeon: The Undervault', variant: 'h4' },
        { id: 'a', component: 'Column', children: ['hp', 'lvl'] },
        { id: 'hp', component: 'Text', text: 'HP 12 / 12' },
        { id: 'lvl', component: 'Text', text: 'Level 3' },
        { id: 'b', component: 'Column', children: ['gold', 'note'] },
        { id: 'gold', component: 'Text', text: 'Gold 0' },
        { id: 'note', component: 'Text', text: 'Found in the chest' },
      ]),
    ).toEqual([])
  })

  it('T-0365 negative control: game-studio KPI, loyalty and receipt strips of Texts yield none', () => {
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'nps', 'conf'] },
        { id: 't', component: 'Text', text: 'Game studio KPIs', variant: 'h4' },
        { id: 'nps', component: 'Text', text: 'NPS score 62' },
        { id: 'conf', component: 'Text', text: 'Model confidence 0.91' },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'tier', 'help'] },
        { id: 't', component: 'Text', text: 'Game night rewards', variant: 'h4' },
        { id: 'tier', component: 'Text', text: 'Gold tier' },
        { id: 'help', component: 'Text', text: 'Questions? Ask at the counter' },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'item', 'paid'] },
        { id: 't', component: 'Text', text: 'Quest shop receipt', variant: 'h4' },
        { id: 'item', component: 'Text', text: 'Item 1 of 3' },
        { id: 'paid', component: 'Text', text: 'Gold: 40' },
      ]),
    ).toEqual([])
  })

  it('T-0365 negative control: a counter alone names no game (hiring, workout and survey strips)', () => {
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'round', 'conf'] },
        { id: 't', component: 'Text', text: 'Candidate: Jane Park', variant: 'h4' },
        { id: 'round', component: 'Badge', label: 'Round 2 of 4' },
        { id: 'conf', component: 'Text', text: 'Confidence: high' },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'round', 'score'] },
        { id: 't', component: 'Text', text: 'Interval session', variant: 'h4' },
        { id: 'round', component: 'Badge', label: 'Round 2 of 4' },
        { id: 'score', component: 'Stat', label: 'Score', value: '4.2' },
      ]),
    ).toEqual([])
    expect(
      codes([
        { id: 'root', component: 'Row', children: ['t', 'round', 'q'] },
        { id: 't', component: 'Text', text: 'Customer survey', variant: 'h4' },
        { id: 'round', component: 'Badge', label: 'Round 2 of 3' },
        { id: 'q', component: 'Progress', label: 'Questions answered', value: 4, max: 10 },
      ]),
    ).toEqual([])
  })

  // T-0364: the Mentalist, the Negotiator and the Dungeon Master end their game on ONE ResultCard (guess-hud, deal-sheet,
  // quest-log) with no board. A hand-built ending (an end signal beside the result words) on a surface whose words name a
  // game is RESULT_CARD_MISSING.
  const BOARDLESS_ENDS: Record<string, A2uiComponent[]> = {
    mentalist: [
      { id: 'root', component: 'Card', children: ['t', 'again'] },
      { id: 't', component: 'Text', text: 'You won! The answer was a cat.' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    negotiator: [
      { id: 'root', component: 'Card', children: ['title', 't', 'again'] },
      { id: 'title', component: 'Text', text: 'Deal sheet: Brass lantern', variant: 'h4' },
      { id: 't', component: 'Text', text: 'Deal struck at 180 silver. You won the lantern.' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    'dungeon-master': [
      { id: 'root', component: 'Card', children: ['title', 't', 'again'] },
      { id: 'title', component: 'Text', text: 'The Sunken Crypt', variant: 'h4' },
      { id: 't', component: 'Text', text: 'Game over: you lost, your quest ends at the crypt door.' },
      { id: 'again', component: 'Button', label: 'New adventure' },
    ],
    // T-0364 (item 6): the quizmaster's grand-reveal names ONE ResultCard for the end of a run, so a hand-built final score
    // beside the last QuestionCard is this moment; the QuestionCard does not stand the row aside.
    'quizmaster final round': [
      { id: 'root', component: 'Column', children: ['q', 'score', 'again'] },
      { id: 'q', component: 'QuestionCard', label: 'Round 10 of 10', question: 'Capital of Peru?', options: [], revealed: true },
      { id: 'score', component: 'Text', text: 'Quiz over. Final score 8 of 10: you won!' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
  }

  for (const [persona, components] of Object.entries(BOARDLESS_ENDS)) {
    it(`T-0364: a hand-built ${persona} ending with no BoardGrid yields RESULT_CARD_MISSING, and with a ResultCard none`, () => {
      expect(codes(components)).toEqual(['RESULT_CARD_MISSING'])
      expect(codes([...components, { id: 'res', component: 'ResultCard', outcome: 'win', title: 'You won' }])).toEqual([])
    })
  }

  it('T-0364: the board-less finding names the hand-built result components', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(BOARDLESS_ENDS['mentalist']!, 'ask-1')] }).findings
    expect(f!.path).toBe('ask-1:t')
    expect(f!.message).toContain('t (a Text), again (a Button)')
    expect(f!.message).toContain('Make it ONE ResultCard')
  })

  it('T-0364: on a BoardGrid surface a Toast still carries the ending, and the BoardGrid label is no result word', () => {
    const board = { id: 'board', component: 'BoardGrid', rows: 3, cols: 3, cells: { path: '/cells' }, actionName: 'fire' }
    expect(codes([{ id: 'root', component: 'Column', children: ['board', 'toast'] }, board, { id: 'toast', component: 'Toast', label: 'Game over, you won.' }])).toEqual(['RESULT_CARD_MISSING'])
    expect(codes([{ ...board, label: 'Game over? Fire to play again' }])).toEqual([])
  })

  // T-0364: result words where no game ends: mid-game progress, a surface whose words name no game, a round result
  // Toast and two croupier hands. Each holds ResultCard words, so with the row's board-less guards removed each fires;
  // the guard test below proves it.
  const NOT_GAME_ENDS: Record<string, A2uiComponent[]> = {
    'mid-game quest progress': [
      { id: 'root', component: 'Card', children: ['title', 't'] },
      { id: 'title', component: 'Text', text: 'The Sunken Crypt: a quest', variant: 'h4' },
      { id: 't', component: 'Text', text: 'You won 20 gold, but you lost 3 HP.' },
    ],
    'mid-game round Text': [
      { id: 'root', component: 'Card', children: ['title', 't'] },
      { id: 'title', component: 'Text', text: 'Color duel: a game of five rounds', variant: 'h4' },
      { id: 't', component: 'Text', text: 'Round 2: you win this round.' },
    ],
    'sales dashboard': [
      { id: 'root', component: 'Row', children: ['won', 'rate', 'note'] },
      { id: 'won', component: 'Stat', label: 'Deals closed', value: '12' },
      { id: 'rate', component: 'Stat', label: 'Win rate', value: '60%' },
      { id: 'note', component: 'Text', text: 'You won 12 of 20 deals this quarter. Play again next quarter?' },
    ],
    'order receipt': [
      { id: 'root', component: 'Card', children: ['title', 'rows', 'promo'] },
      { id: 'title', component: 'Text', text: 'Order #4821 received', variant: 'h4' },
      { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Total', value: '$42.10' }, { label: 'Pickup', value: '18:30' }] },
      { id: 'promo', component: 'Text', text: 'You won a free dessert with this order. Play again Friday!', variant: 'caption' },
    ],
    'booking confirmation': [
      { id: 'root', component: 'BookingConfirmation', title: 'Table for four confirmed', rows: [] },
      { id: 'promo', component: 'Text', text: 'You won our weekly raffle: dessert is on us. Play again next week.' },
    ],
    'concierge Gold level': [
      { id: 'root', component: 'Card', children: ['t', 'again'] },
      { id: 't', component: 'Text', text: 'Gold level: you won a free night.' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    'podcast player': [
      { id: 'root', component: 'Card', children: ['title', 't', 'again'] },
      { id: 'title', component: 'Text', text: 'Podcast player', variant: 'h4' },
      { id: 't', component: 'Text', text: 'Episode 42 finished. You won the listener poll!' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    'subscription notice': [{ id: 't', component: 'Text', text: 'Game over? Not yet: your subscription renews Friday, you win either way.' }],
    'round result Toast': [
      { id: 'root', component: 'Column', children: ['hud', 'toast'] },
      { id: 'hud', component: 'GameHud', title: 'Color duel', status: 'Round 2 of 5' },
      { id: 'toast', component: 'Toast', label: 'Game over for round 2: you win this round.' },
    ],
    'croupier hand': [
      { id: 'root', component: 'Column', children: ['table', 't', 'again'] },
      { id: 'table', component: 'CardTable', phase: 'settled', title: 'Blackjack' },
      { id: 't', component: 'Text', text: 'Game over: you win this hand, 20 against 18.' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    // The recorded Opus Texas Hold'em settle (round 2026-10-17-r10-targeted): PlayingCards with no CardTable.
    'poker hand dealt as PlayingCards': [
      { id: 'root', component: 'Column', children: ['title', 'hole', 'result', 'again'] },
      { id: 'title', component: 'Text', text: "Texas Hold'em, a game of two", variant: 'h4' },
      { id: 'hole', component: 'PlayingCard', rank: 'J', suit: 'spades' },
      { id: 'result', component: 'Text', text: 'You win with a pair of jacks. You win the 120 pot.' },
      { id: 'again', component: 'Button', label: 'Play again' },
    ],
    'quizmaster mid-run reveal': [
      { id: 'root', component: 'Column', children: ['q', 't'] },
      { id: 'q', component: 'QuestionCard', label: 'Round 3 of 10', question: 'Capital of Peru?', options: [], revealed: true },
      { id: 't', component: 'Text', text: 'Quiz round 3: you won this one, the answer was Lima.' },
    ],
  }

  for (const [name, components] of Object.entries(NOT_GAME_ENDS)) {
    it(`T-0364 negative control: a ${name} yields no RESULT_CARD_MISSING`, () => {
      expect(codes(components)).not.toContain('RESULT_CARD_MISSING')
    })
  }

  it('T-0364: each negative control fires with the board-less gate opened, so the guards bite', () => {
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'ResultCard')!
    expect(row.boardless?.end).toBeDefined()
    const loose: CompositeMoment = { ...row, boardless: { game: /./, end: /./ } }
    for (const [name, components] of Object.entries(NOT_GAME_ENDS)) {
      const found = runSemanticChecks([compositeMomentCheck(loose)], { surfaces: [view(components)] }).findings.map((f) => f.code)
      expect(found, name).toEqual(['RESULT_CARD_MISSING'])
    }
  })

  it('T-0364: a croupier type never answers a carried RESULT_CARD_MISSING (a round-2 decorative PlayingCard)', () => {
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'ResultCard')!
    const round2 = view([
      { id: 'root', component: 'Column', children: ['reveal', 'card'] },
      { id: 'reveal', component: 'Text', text: 'The word was SLAIN.' },
      { id: 'card', component: 'PlayingCard', rank: 'A', suit: 'spades' },
    ])
    expect(compositeAnswered(row, [round2])).toBe(false)
    expect(compositeAnswered(row, [view([{ id: 't', component: 'CardTable', phase: 'settled' }])])).toBe(false)
    expect(compositeAnswered(row, [view([{ id: 'r', component: 'ResultCard', outcome: 'lose', title: 'You conceded' }])])).toBe(true)
  })

  // T-0361: the recorded Dungeon Master quest log (smoke round 2026-10-18-smoke, `traces/2026-10-18.jsonl:23`), with its
  // HP and Gold Badges dropped so only the scene list is read: the scenes as a Column of numbered Texts under a "Scenes" label.
  const QUEST_LOG: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hd', 'ct', 'ft'] },
    { id: 'hd', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Quest log: The Undervault', variant: 'h4' },
    { id: 'ct', component: 'CardContent', children: ['scenes_lbl', 'scenes', 'inv_lbl', 'inv'] },
    { id: 'scenes_lbl', component: 'Text', text: 'Scenes', variant: 'label' },
    { id: 'scenes', component: 'Column', gap: 'xs', children: ['s1'] },
    { id: 's1', component: 'Text', text: "1. The stair down, at the Undervault's entrance.", variant: 'body' },
    { id: 'inv_lbl', component: 'Text', text: 'Inventory (2/6)', variant: 'label' },
    { id: 'inv', component: 'Row', gap: 'sm', children: ['i1', 'i2'] },
    { id: 'i1', component: 'Badge', label: 'Torch', intent: 'neutral' },
    { id: 'i2', component: 'Badge', label: 'Dagger', intent: 'neutral' },
    { id: 'ft', component: 'CardFooter', children: ['choice_row'] },
    { id: 'choice_row', component: 'Row', gap: 'sm', wrap: true, children: ['c1'] },
    { id: 'c1', component: 'Button', label: 'Descend the stair', action: { action: 'choose', context: { choice: 'descend' } } },
  ]
  const withScenes = (scenes: A2uiComponent[]): A2uiComponent[] => [...QUEST_LOG.filter((c) => c.id !== 'scenes' && c.id !== 's1'), ...scenes]

  it('T-0361: the recorded quest log yields TIMELINE_MISSING alone, naming the scene Column and asking for TimelineItems', () => {
    expect(codes(QUEST_LOG)).toEqual(['TIMELINE_MISSING'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(QUEST_LOG, 'quest-log')] }).findings
    expect(f!.path).toBe('quest-log:scenes')
    expect(f!.message).toContain('scenes (a Column)')
    expect(f!.message).toContain('events in time order')
    expect(f!.message).toContain('Make it ONE Timeline with its label and one TimelineItem per scene')
  })

  it('T-0361: with the HP and Gold Badges kept, the round yields GAME_HUD_MISSING and TIMELINE_MISSING', () => {
    const strip: A2uiComponent[] = [
      { id: 'hp', component: 'Badge', label: 'HP 12/12' },
      { id: 'gold', component: 'Badge', label: 'Gold 0' },
    ]
    expect(codes([...QUEST_LOG, ...strip])).toEqual(['GAME_HUD_MISSING', 'TIMELINE_MISSING'])
  })

  it('T-0361: plain entries, Rows of a number and a name, two headless "Scene N" entries and a template each fire; the repaired surface does not', () => {
    expect(codes(withScenes([
      { id: 'scenes', component: 'List', children: ['s1', 's2'] },
      { id: 's1', component: 'Text', text: 'The stair down' },
      { id: 's2', component: 'Text', text: 'The iron door' },
    ]))).toEqual(['TIMELINE_MISSING'])
    expect(codes(withScenes([
      { id: 'scenes', component: 'Column', children: ['r1', 'r2'] },
      { id: 'r1', component: 'Row', children: ['n1', 't1'] },
      { id: 'n1', component: 'Text', text: '1' },
      { id: 't1', component: 'Text', text: 'The stair down' },
      { id: 'r2', component: 'Row', children: ['n2', 't2'] },
      { id: 'n2', component: 'Text', text: '2' },
      { id: 't2', component: 'Text', text: 'The iron door' },
    ]))).toEqual(['TIMELINE_MISSING'])
    const headless = withScenes([
      { id: 'scenes', component: 'Column', children: ['s1', 's2'] },
      { id: 's1', component: 'Text', text: 'Scene 1: the stair down' },
      { id: 's2', component: 'Text', text: 'Scene 2: the iron door' },
    ]).filter((c) => c.id !== 'scenes_lbl')
    expect(codes(headless)).toEqual(['TIMELINE_MISSING'])
    expect(codes(withScenes([
      { id: 'scenes', component: 'Column', children: { path: '/scenes', componentId: 'scene' } },
      { id: 'scene', component: 'Text', text: { path: 'summary' } },
    ]))).toEqual(['TIMELINE_MISSING'])
    expect(codes(withScenes([
      { id: 'scenes', component: 'Timeline', label: 'Scenes', children: ['s1'] },
      { id: 's1', component: 'TimelineItem', label: 'The stair down', description: "The Undervault's entrance.", status: 'active' },
    ]))).toEqual([])
  })

  it('T-0361: a "Quest log" CardHeader or Card title heads a list with no label of its own', () => {
    const underHeader: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['hd', 'ct'] },
      { id: 'hd', component: 'CardHeader', children: ['title'] },
      { id: 'title', component: 'Text', text: 'Quest log', variant: 'h4' },
      { id: 'ct', component: 'CardContent', children: ['scenes'] },
      { id: 'scenes', component: 'Column', children: ['s1', 's2'] },
      { id: 's1', component: 'Text', text: '1. The stair down' },
      { id: 's2', component: 'Text', text: '2. The iron door' },
    ]
    expect(codes(underHeader)).toEqual(['TIMELINE_MISSING'])
    const titled: A2uiComponent[] = [
      { id: 'root', component: 'Card', title: 'Quest log: The Undervault', children: ['scenes'] },
      { id: 'scenes', component: 'Column', children: ['s1'] },
      { id: 's1', component: 'Text', text: '1. The stair down' },
    ]
    expect(codes(titled)).toEqual(['TIMELINE_MISSING'])
    // The nearest heading wins: an Inventory label inside the quest log card heads its own list.
    const inventory = underHeader.map((c) => (c.id === 'ct' ? { ...c, children: ['lbl', 'scenes'] } : c))
    expect(codes([...inventory, { id: 'lbl', component: 'Text', text: 'Inventory', variant: 'label' }])).toEqual([])
  })

  it('T-0361: one plain entry under a log heading, a "Scene 3" heading over narration, and a "Scene 3" heading over choices yield none', () => {
    expect(codes(withScenes([
      { id: 'scenes', component: 'Column', children: ['s1'] },
      { id: 's1', component: 'Text', text: 'The stair down' },
    ]))).toEqual([])
    const sceneCard = (body: A2uiComponent[], children: string[]): A2uiComponent[] => [
      { id: 'root', component: 'Card', children: ['title', 'body'] },
      { id: 'title', component: 'Text', text: 'The Undervault: a dungeon quest', variant: 'h4' },
      { id: 'body', component: 'Column', children },
      ...body,
    ]
    expect(codes(sceneCard([
      { id: 'h', component: 'Text', text: 'Scene 3: the flooded vault', variant: 'h5' },
      { id: 'n', component: 'Text', text: 'Water drips from the ceiling and the torch gutters.' },
    ], ['h', 'n']))).toEqual([])
    expect(codes(sceneCard([
      { id: 'h', component: 'Text', text: 'Scene 3', variant: 'label' },
      { id: 'choices', component: 'Column', children: ['o1', 'o2'] },
      { id: 'o1', component: 'Text', text: '1. Wade across' },
      { id: 'o2', component: 'Text', text: '2. Climb the ledge' },
    ], ['h', 'choices']))).toEqual([])
  })

  /** Realistic lists in time order, or quest lists that are no scene log: none is a quest log to send back. */
  const NOT_QUEST_LOGS: Record<string, A2uiComponent[]> = {
    'order history': [
      { id: 'root', component: 'Card', children: ['t', 'lbl', 'orders'] },
      { id: 't', component: 'Text', text: 'Your orders', variant: 'h4' },
      { id: 'lbl', component: 'Text', text: 'Order history', variant: 'label' },
      { id: 'orders', component: 'Column', children: ['o1', 'o2'] },
      { id: 'o1', component: 'Text', text: '1. Order #1042, shipped 12 Oct' },
      { id: 'o2', component: 'Text', text: '2. Order #1043, delivered 14 Oct' },
    ],
    changelog: [
      { id: 'root', component: 'Column', children: ['t', 'log'] },
      { id: 't', component: 'Text', text: 'Changelog', variant: 'h4' },
      { id: 'log', component: 'List', children: ['v1', 'v2'] },
      { id: 'v1', component: 'Text', text: 'v2.1: dark mode for the journal view' },
      { id: 'v2', component: 'Text', text: 'v2.0: new scenes editor' },
    ],
    'chat history': [
      { id: 'root', component: 'Card', children: ['lbl', 'msgs'] },
      { id: 'lbl', component: 'Text', text: 'Chat history', variant: 'label' },
      { id: 'msgs', component: 'Column', children: ['m1', 'm2'] },
      { id: 'm1', component: 'Text', text: 'Ana: see you at the scene shoot at 9' },
      { id: 'm2', component: 'Text', text: 'Ben: bring the journal' },
    ],
    'adventure itinerary': [
      { id: 'root', component: 'Card', children: ['t', 'lbl', 'days'] },
      { id: 't', component: 'Text', text: 'Your Iceland adventure', variant: 'h4' },
      { id: 'lbl', component: 'Text', text: 'Day by day', variant: 'label' },
      { id: 'days', component: 'Column', children: ['d1', 'd2'] },
      { id: 'd1', component: 'Text', text: '1. Reykjavik and the Golden Circle' },
      { id: 'd2', component: 'Text', text: '2. Glacier hike at Skaftafell' },
    ],
    'quest inventory list': withScenes([
      { id: 'scenes', component: 'List', children: ['s1', 's2'] },
      { id: 's1', component: 'Text', text: 'Rope, 30 feet' },
      { id: 's2', component: 'Text', text: 'Lantern' },
    ]).map((c) => (c.id === 'scenes_lbl' ? { ...c, text: 'Inventory' } : c)),
    'quiz question list': [
      { id: 'root', component: 'Card', children: ['t', 'lbl', 'qs'] },
      { id: 't', component: 'Text', text: 'Trivia night', variant: 'h4' },
      { id: 'lbl', component: 'Text', text: 'Questions', variant: 'label' },
      { id: 'qs', component: 'Column', children: ['q1'] },
      { id: 'q1', component: 'Text', text: '1. Which planet has the most moons?' },
    ],
    'quest scenes beside a Button': withScenes([
      { id: 'scenes', component: 'Column', children: ['s1', 'go'] },
      { id: 's1', component: 'Text', text: '1. The stair down' },
      { id: 'go', component: 'Button', label: 'Descend', action: { action: 'choose' } },
    ]),
  }

  for (const [name, components] of Object.entries(NOT_QUEST_LOGS)) {
    it(`T-0361 negative control: a ${name} yields no TIMELINE_MISSING`, () => {
      expect(codes(components)).not.toContain('TIMELINE_MISSING')
    })
  }

  it('T-0361: the game-worded negatives fire with the log heading opened, and the rest with the game gate opened too, so the guards bite', () => {
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'Timeline')!
    const anyHeading: CompositeMoment = { ...row, logOf: { ...row.logOf!, heading: /./ } }
    const fires = (m: CompositeMoment, components: A2uiComponent[]): string[] =>
      runSemanticChecks([compositeMomentCheck(m)], { surfaces: [view(components)] }).findings.map((f) => f.code)
    for (const name of ['quest inventory list', 'quiz question list']) expect(fires(anyHeading, NOT_QUEST_LOGS[name]!), name).toEqual(['TIMELINE_MISSING'])
    const anySurface: CompositeMoment = { ...anyHeading, boardless: { game: /./ } }
    // T-0409: adventure names no game, so the itinerary needs the game gate opened too.
    for (const name of ['order history', 'changelog', 'chat history', 'adventure itinerary']) expect(fires(anySurface, NOT_QUEST_LOGS[name]!), name).toEqual(['TIMELINE_MISSING'])
    expect(fires({ ...row, boardless: { game: /./ } }, NOT_QUEST_LOGS['changelog']!), 'changelog, heading kept').toEqual([])
  })

  // T-0409: hospitality and commerce turns run on the same catalog, and a word that names a game as a topic or a product
  // (an Iceland adventure, a loyalty game, a game show) is no game being played. Each was a misfire on the T-0364 tree.
  const NOT_GAMES: Record<string, { code: string; components: A2uiComponent[] }> = {
    'concierge travel journal': {
      code: 'TIMELINE_MISSING',
      components: [
        { id: 'root', component: 'Card', children: ['t', 'lbl', 'days'] },
        { id: 't', component: 'Text', text: 'Your Iceland adventure', variant: 'h4' },
        { id: 'lbl', component: 'Text', text: 'Travel journal', variant: 'label' },
        { id: 'days', component: 'Column', children: ['d1', 'd2'] },
        { id: 'd1', component: 'Text', text: 'Reykjavik and the Golden Circle' },
        { id: 'd2', component: 'Text', text: 'Glacier hike at Skaftafell' },
      ],
    },
    'receipt with a loyalty game': {
      code: 'RESULT_CARD_MISSING',
      components: [
        { id: 'root', component: 'Card', children: ['title', 'rows', 'promo'] },
        { id: 'title', component: 'Text', text: 'Order #881 confirmed', variant: 'h4' },
        { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Total', value: '$42.10' }] },
        { id: 'promo', component: 'Text', text: 'Thanks! Play again in our loyalty game next week.', variant: 'caption' },
      ],
    },
    'podcast card about a game show': {
      code: 'RESULT_CARD_MISSING',
      components: [
        { id: 'root', component: 'Card', children: ['title', 't', 'again'] },
        { id: 'title', component: 'Text', text: 'Podcast player', variant: 'h4' },
        { id: 't', component: 'Text', text: 'Episode 42: the game show that changed TV. You win nothing, but you learn a lot.' },
        { id: 'again', component: 'Button', label: 'Play again' },
      ],
    },
  }

  for (const [name, { code, components }] of Object.entries(NOT_GAMES)) {
    it(`T-0409 negative control: a ${name} yields no ${code}`, () => {
      expect(codes(components)).not.toContain(code)
    })
  }

  it('T-0409: each non-game negative fires with the board-less game gate opened, so the gate is what keeps it quiet', () => {
    for (const [name, { code, components }] of Object.entries(NOT_GAMES)) {
      const row = COMPOSITE_MOMENTS.find((m) => `${m.composite.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_MISSING` === code)!
      const open: CompositeMoment = { ...row, boardless: { ...row.boardless!, game: /./ } }
      expect(runSemanticChecks([compositeMomentCheck(open)], { surfaces: [view(components)] }).findings.map((f) => f.code), name).toEqual([code])
    }
  })

  it("T-0361 review: no row reads another composite's props, so a GameHud whose status says Game over is no hand-built result", () => {
    const hud: A2uiComponent[] = [{ id: 'root', component: 'GameHud', title: 'Quest: The Undervault', status: 'Game over', stats: [{ label: 'HP', value: 0 }] }]
    expect(codes(hud)).toEqual([])
    expect(codes([{ id: 'col', component: 'Column', children: ['root'] }, ...hud])).toEqual([])
  })

  it('T-0361 review: the Negotiator "Round 3, your turn" surface with Mood and Asking yields GAME_HUD_MISSING again', () => {
    expect(codes([
      { id: 'root', component: 'Card', children: ['t', 'mood', 'ask'] },
      { id: 't', component: 'Text', text: 'Round 3, your turn', variant: 'h4' },
      { id: 'mood', component: 'Badge', label: 'Mood: wary' },
      { id: 'ask', component: 'Badge', label: 'Asking $500' },
    ])).toEqual(['GAME_HUD_MISSING'])
  })

  it('T-0361 review: a mid-game "Start a new quest" side button is no ending; with no play control left it is one', () => {
    const midGame: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['t', 'won', 'open', 'restart'] },
      { id: 't', component: 'Text', text: 'The Undervault quest', variant: 'h4' },
      { id: 'won', component: 'Text', text: 'You won 20 gold from the urn.' },
      { id: 'open', component: 'Button', label: 'Open the chest', action: { action: 'choose' } },
      { id: 'restart', component: 'Button', label: 'Start a new quest', action: { action: 'new_quest' } },
    ]
    expect(codes(midGame)).not.toContain('RESULT_CARD_MISSING')
    expect(codes(midGame.filter((c) => c.id !== 'open').map((c) => (c.id === 'root' ? { ...c, children: ['t', 'won', 'restart'] } : c)))).toContain('RESULT_CARD_MISSING')
  })

  // T-0279: the recorded Haiku answer to "What spa services can I book during my stay?" (round 2026-10-15-r4-fixes,
  // long-concierge-spa-services-haiku-1, turn 1): a priced Table where Kim's ruling asks for one ProductCard each.
  const SPA_TABLE: A2uiComponent[] = [
    {
      id: 'root',
      component: 'Table',
      label: 'Grand Meridian spa treatments',
      columns: [
        { key: 'treatment', label: 'Treatment' },
        { key: 'duration', label: 'Duration' },
        { key: 'price', label: 'Price' },
      ],
      rows: [
        { treatment: 'Swedish massage', duration: '60 min', price: '€120' },
        { treatment: 'Deep-tissue massage', duration: '60 min', price: '€135' },
      ],
    },
  ]

  it('T-0279: the recorded spa services Table yields PRODUCT_CARD_MISSING alone, asking for a ProductCard per item', () => {
    expect(codes(SPA_TABLE)).toEqual(['PRODUCT_CARD_MISSING'])
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(SPA_TABLE, 'spa-menu')] }).findings
    expect(f!.path).toBe('spa-menu:root')
    expect(f!.message).toContain('root (a Table)')
    expect(f!.message).toContain('Make it ONE ProductCard per item')
  })

  it('T-0279: the same list in a Column beside an intro Text still fires; a ProductCard Grid beside it does not', () => {
    const inColumn: A2uiComponent[] = [
      { id: 'col', component: 'Column', children: ['intro', 'root'] },
      { id: 'intro', component: 'Text', text: 'Our spa is open daily.' },
      ...SPA_TABLE,
    ]
    expect(codes(inColumn)).toEqual(['PRODUCT_CARD_MISSING'])
    expect(codes([...inColumn, ...COMPOSED['ProductCard']!.map((c) => ({ ...c, id: `p-${c.id}` }))])).toEqual([])
  })

  it('negative control: a hours Table with no price column yields none', () => {
    expect(
      codes([{ id: 'root', component: 'Table', label: 'Spa and pool hours', columns: [{ key: 'facility', label: 'Facility' }, { key: 'hours', label: 'Hours' }], rows: [] }]),
    ).toEqual([])
  })

  it('negative control: a priced Table with no buy or book words yields none', () => {
    expect(
      codes([{ id: 'root', component: 'Table', label: 'Quarterly revenue', columns: [{ key: 'region', label: 'Region' }, { key: 'price', label: 'Average price' }], rows: [] }]),
    ).toEqual([])
  })

  it('negative control: a priced booking Table beside a BookingForm or a CardTable yields no PRODUCT_CARD_MISSING', () => {
    const form: A2uiComponent = { id: 'form', component: 'BookingForm', title: 'Book a treatment', fields: [] }
    expect(codes([...SPA_TABLE, form])).not.toContain('PRODUCT_CARD_MISSING')
    const table: A2uiComponent = { id: 'tbl', component: 'CardTable', phase: 'betting', title: 'Blackjack' }
    expect(codes([...SPA_TABLE, table])).not.toContain('PRODUCT_CARD_MISSING')
  })

  // T-0516: the ProductCard row's booking guards each bite on their own, like the ConfirmReceipt row's (T-0480).
  const PRODUCT_ROW = COMPOSITE_MOMENTS.find((m) => m.composite === 'ProductCard')!
  const BOOKING_GUARDS: Array<[string, A2uiComponent]> = [
    ['BookingForm', { id: 'form', component: 'BookingForm', title: 'Book a treatment', fields: [] }],
    ['BookingConfirmation', { id: 'done', component: 'BookingConfirmation', title: 'Treatment booked', rows: [] }],
  ]
  for (const [guard, comp] of BOOKING_GUARDS) {
    it(`T-0516: the ${guard} guard bites: the priced Table beside a ${guard} yields none, and with ${guard} out of lacks it fires`, () => {
      const comps = [...SPA_TABLE, comp]
      expect(compositeMomentCheck(PRODUCT_ROW).check({ surfaces: [view(comps)] })).toEqual([])
      const open = compositeMomentCheck({ ...PRODUCT_ROW, lacks: PRODUCT_ROW.lacks.filter((t) => t !== guard) })
      expect(open.check({ surfaces: [view(comps)] }).map((f) => f.code)).toEqual(['PRODUCT_CARD_MISSING'])
    })
  }

  it('the catalog gate keeps the booking and Itinerary rows only on agent-ui--hospitality, the games, ProductCard, ConfirmReceipt and AmountPicker rows on agent-ui, and none on a2ui-basic', () => {
    const base = loadCatalog(defaultCatalogRaw)
    const concierge = composeCatalog(base, loadCatalogFragment(hospitalityFragmentRaw), 'hospitality')
    const basic = loadCatalog(basicCatalogRaw)
    const ids = (catalog: { components: Readonly<Record<string, unknown>> }) => gateChecksOnCatalog(compositeMomentChecks, catalog).map((c) => c.id)
    const games = ['composite-moment-board-grid', 'composite-moment-game-hud', 'composite-moment-result-card', 'composite-moment-timeline', 'composite-moment-product-card', 'composite-moment-confirm-receipt', 'composite-moment-amount-picker', 'composite-moment-swatch']
    expect(ids(base)).toEqual(games)
    expect(concierge.catalogId).toBe('agent-ui--hospitality')
    expect(ids(concierge)).toEqual(['composite-moment-booking-form', 'composite-moment-booking-confirmation', 'composite-moment-itinerary', ...games])
    expect(ids(basic)).toEqual([])
  })

  it("every row's moment is one of its composite's selection intents", () => {
    const types = { ...defaultSelection.types, ...conciergeSelection.types, ...stylistSelection.types } as Record<string, { intents: string[] }>
    for (const m of COMPOSITE_MOMENTS) expect(types[m.composite]?.intents, m.composite).toContain(m.moment)
  })

  it('every check id and code follows the naming', () => {
    expect(compositeMomentChecks.map((c) => c.id)).toEqual([
      'composite-moment-booking-form',
      'composite-moment-booking-confirmation',
      'composite-moment-itinerary',
      'composite-moment-board-grid',
      'composite-moment-game-hud',
      'composite-moment-result-card',
      'composite-moment-timeline',
      'composite-moment-product-card',
      'composite-moment-confirm-receipt',
      'composite-moment-amount-picker',
      'composite-moment-swatch',
      'composite-moment-contrast-pair',
      'composite-prose-swatch',
    ])
    expect(COMPOSITE_MOMENTS.map((m) => codeOf(m.composite))).toEqual(['BOOKING_FORM_MISSING', 'BOOKING_CONFIRMATION_MISSING', 'ITINERARY_MISSING', 'BOARD_GRID_MISSING', 'GAME_HUD_MISSING', 'RESULT_CARD_MISSING', 'TIMELINE_MISSING', 'PRODUCT_CARD_MISSING', 'CONFIRM_RECEIPT_MISSING', 'SURFACE_MISSING', 'SWATCH_MISSING', 'CONTRAST_PAIR_WRAPPED'])
    for (const [i, m] of COMPOSITE_MOMENTS.entries()) expect(compositeMomentChecks[i]!.requires).toEqual([m.composite, ...(m.requires ?? [])])
  })
})

// T-0313 (Kim 2026-10-16, P1 as revised): a composite moment has one matcher. The row that detects a hand-built surface
// also carries the turn words that ask for it, which the Concierge SURFACE_MISSING check reads (it held its own regexes).
describe('the rows carry the ask cue of each Concierge composite moment (T-0313)', () => {
  const asked = () => COMPOSITE_MOMENTS.filter((m) => m.ask !== undefined).sort((a, b) => a.ask!.rank - b.ask!.rank)

  it('the ask cue rows, in precedence order, are the confirm, the services list and the booking', () => {
    expect(asked().map((m) => [m.ask!.moment, m.composite])).toEqual([
      ['confirm', 'BookingConfirmation'],
      ['services', 'ProductCard'],
      ['booking', 'BookingForm'],
    ])
  })

  it('T-0359: no palette words are an ask (the palette check reads the reply), so none shadows a Concierge moment', () => {
    expect(askedCompositeMoment('Make it 16:00 and use the brand colours for the table decor')).toBeUndefined()
    expect(askedCompositeMoment('Propose a calm blue palette for a banking app.')).toBeUndefined()
  })

  it.each([
    ['BookingConfirmation', 'Those details are right, please confirm the booking.'],
    ['BookingConfirmation', 'Confirm it, the details are right.'],
    ['ProductCard', 'What spa services can I book during my stay?'],
    ['BookingForm', "I'd like a table at Vela on Friday 20 November 2026 at 20:00 for two, name Alex Moreau."],
  ])('the %s ask cue matches "%s"', (composite, turn) => {
    expect(asked().find((m) => m.ask!.cue.test(turn))?.composite).toBe(composite)
  })
})


// T-0322 D (live round 8 :90, Haiku 5.5, regress-concierge-facilities-then-tour turn 4): "What services could I add for
// the rest of my stay?" shipped one Card holding a DescriptionList of priced treatments and passed, since the row's
// priced-Table cue (T-0279) reads Tables only. Turn 0 of the same run, the facility hours, is the negative control.
describe('a services ask answered with priced rows in another type (T-0322)', () => {
  const SERVICES_ASK = 'What services could I add for the rest of my stay?'
  const card = (title: string, rows: { label: string; value: string }[]): A2uiComponent[] => [
    { id: 'root', component: 'Card', children: ['header', 'content'] },
    { id: 'header', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: title, variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list'] },
    { id: 'list', component: 'DescriptionList', rows },
  ]
  const SPA_LIST = card('Spa treatments', [
    { label: 'Swedish massage', value: '60 min, €120' },
    { label: 'Deep-tissue massage', value: '60 min, €135' },
    { label: 'Hot-stone massage', value: '90 min, €170' },
    { label: 'Sea-salt and lemon body scrub', value: '45 min, €95' },
    { label: 'Hydrating facial', value: '50 min, €110' },
    { label: 'Couples massage', value: '60 min, €230 for two' },
  ])
  const HOURS_LIST = card('Pool, gym and spa hours', [
    { label: 'Pool (25m, heated)', value: '06:00 to 22:00' },
    { label: 'Gym', value: '06:00 to 22:00' },
    { label: 'Spa', value: '09:00 to 20:00. Book treatments at least a day ahead in season.' },
  ])
  const run = (components: A2uiComponent[], intent?: string) =>
    runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, 'spa-treatments')], ...(intent !== undefined ? { intent } : {}) }).findings

  it('the recorded priced DescriptionList on the services ask is PRODUCT_CARD_MISSING', () => {
    const findings = run(SPA_LIST, SERVICES_ASK)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['PRODUCT_CARD_MISSING', 'spa-treatments:list']])
    expect(findings[0]!.message).toContain('list (a DescriptionList)')
    expect(findings[0]!.message).toContain('Make it ONE ProductCard per item')
  })

  it('priced rows in a List fire on the services ask too', () => {
    const list: A2uiComponent[] = [
      { id: 'root', component: 'List', children: ['a', 'b'] },
      { id: 'a', component: 'Text', text: 'Swedish massage, 60 min, €120' },
      { id: 'b', component: 'Text', text: 'Hydrating facial, 50 min, €110' },
    ]
    expect(run(list, SERVICES_ASK).map((f) => [f.code, f.path])).toEqual([['PRODUCT_CARD_MISSING', 'spa-treatments:root']])
  })

  it('negative controls: the facility hours list, the priced list on another ask or with no ask, and a ProductCard Grid yield none', () => {
    expect(run(HOURS_LIST, 'What are the opening hours of the pool, gym and spa? Check the property-knowledge-base.')).toEqual([])
    expect(run(HOURS_LIST, SERVICES_ASK)).toEqual([])
    expect(run(SPA_LIST, 'Is late check-out possible?')).toEqual([])
    expect(run(SPA_LIST)).toEqual([])
    expect(run([...SPA_LIST, ...COMPOSED['ProductCard']!.map((c) => ({ ...c, id: `p-${c.id}` }))], SERVICES_ASK)).toEqual([])
  })
})

// T-0333 (live round 9 cluster G): BOOKING_CONFIRMATION_MISSING read every Text, so a caption that says "confirmed" or "booked"
// fired it (:491 Opus, :257 Sonnet). The row now reads settled words only from status signals: a Badge, a Card or CardHeader
// title, a heading Text (h1 to h5). The BookingForm row stands aside for a settled surface, and this row for a live read-back confirm.
describe('BOOKING_CONFIRMATION_MISSING reads settled-status signals, not captions (T-0333)', () => {
  const findings = (components: A2uiComponent[], intent?: string) =>
    runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, 'ask-1')], ...(intent !== undefined ? { intent } : {}) }).findings.map((f) => f.code)

  // Round 9 :491 (routing-long-session-opus-1, round 1): "Which restaurants and bars does the hotel have?"
  const R9_491: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Dining at the Grand Meridian', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['list', 'note'] },
    { id: 'list', component: 'DescriptionList', rows: [{ label: 'Vela', value: 'Fine-dining restaurant' }, { label: 'Quay Bar', value: 'Casual dining and drinks' }] },
    { id: 'note', component: 'Text', text: 'Opening hours can be confirmed with the front desk.', variant: 'caption' },
  ]
  // Round 9 :257 (regress-concierge-facilities-then-tour-sonnet-1, round 3): "What services could I add for the rest of my stay?"
  const R9_257: A2uiComponent[] = [
    { id: 'root', component: 'Card', elevation: '1', children: ['hdr', 'content'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Add to your stay', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['col'] },
    { id: 'col', component: 'Column', gap: 'md', children: ['tourList', 'note'] },
    { id: 'tourList', component: 'DescriptionList', rows: [{ label: 'Old Town walking tour', value: 'Daily at 10:00 from the lobby' }, { label: 'Harbor cruise', value: 'Daily at 17:00' }] },
    { id: 'note', component: 'Text', variant: 'caption', text: 'Spa treatments should be booked at least a day ahead in season.' },
  ]
  // Round 9 :85 (regress-concierge-facilities-then-tour-haiku-1, round 1): "Confirm it, the details are right." settled the
  // open read-back (still holding its "Book now" confirm_booking Button) with a "Booked" Badge in its footer.
  const R9_85: A2uiComponent[] = [
    { id: 'root', component: 'Card', children: ['hdr', 'content', 'footer'] },
    { id: 'hdr', component: 'CardHeader', children: ['title'] },
    { id: 'title', component: 'Text', text: 'Book your boat tour', variant: 'h4' },
    { id: 'content', component: 'CardContent', children: ['summary'] },
    { id: 'summary', component: 'DescriptionList', rows: [{ label: 'Tour', value: 'Half-day coastal boat tour' }, { label: 'Guests', value: '2' }] },
    { id: 'footer', component: 'CardFooter', children: ['settled'] },
    { id: 'settled', component: 'Badge', label: 'Booked', intent: 'success' },
    { id: 'bookBtn', component: 'Button', label: 'Book now', variant: 'solid', action: { action: 'confirm_booking', context: { booking: { path: '/booking' } }, submit: true } },
  ]

  it(':491 and :257 give no finding, with or without a turn', () => {
    expect(findings(R9_491)).toEqual([])
    expect(findings(R9_257)).toEqual([])
    expect(findings(R9_491, 'Which restaurants and bars does the hotel have?')).toEqual([])
    expect(findings(R9_257, 'What services could I add for the rest of my stay?')).toEqual([])
  })

  it(':85 (a "Booked" Badge beside the live "Book now" confirm_booking Button) yields exactly BOOKING_FORM_MISSING', () => {
    // A live read-back confirm is not settled: the BookingForm row fires and the confirmation row stands aside.
    expect(findings(R9_85, 'Confirm it, the details are right.')).toEqual(['BOOKING_FORM_MISSING'])
    expect(findings(R9_85)).toEqual(['BOOKING_FORM_MISSING'])
  })

  it('the same Badge with the Button gone is a settled hand-built confirmation: exactly BOOKING_CONFIRMATION_MISSING', () => {
    expect(findings(R9_85.filter((c) => c.id !== 'bookBtn'), 'Confirm it, the details are right.')).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('a "Book a massage" ask answered with a hand-built Booked card still fires', () => {
    const fake: A2uiComponent[] = [
      { id: 'root', component: 'Card', children: ['badge', 'rows'] },
      { id: 'badge', component: 'Badge', label: 'Booked', intent: 'success' },
      { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Treatment', value: 'Massage, 60 min' }, { label: 'Time', value: 'Thursday 15:00' }] },
    ]
    expect(findings(fake, 'Book a 60-minute massage on Thursday at 15:00')).toEqual(['BOOKING_CONFIRMATION_MISSING'])
    expect(findings(fake)).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('a dining list whose caption says "hours can be confirmed" on a "please confirm the table" turn gives nothing', () => {
    expect(findings(R9_491, 'Yes, please confirm the table.')).toEqual([])
  })

  it('a Card title or a heading Text reads as a settled signal; a caption or body Text does not', () => {
    const rows: A2uiComponent = { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Time', value: '19:30' }] }
    expect(findings([{ id: 'root', component: 'Card', title: 'Table confirmed', children: ['rows'] }, rows])).toEqual(['BOOKING_CONFIRMATION_MISSING'])
    for (const variant of ['caption', 'body']) {
      expect(findings([{ id: 'root', component: 'Column', children: ['t', 'rows'] }, { id: 't', component: 'Text', text: 'Table confirmed', variant }, rows])).toEqual([])
    }
  })

  it('"confirmation" is no settled word; "confirmed" in a heading is', () => {
    const rows: A2uiComponent = { id: 'rows', component: 'DescriptionList', rows: [{ label: 'Time', value: '19:30' }] }
    const col = (text: string): A2uiComponent[] => [{ id: 'root', component: 'Column', children: ['t', 'rows'] }, { id: 't', component: 'Text', text, variant: 'h4' }, rows]
    expect(findings(col('Booking confirmation'))).toEqual([])
    expect(findings(col('Table confirmed'))).toEqual(['BOOKING_CONFIRMATION_MISSING'])
  })

  it('the BookingForm row still fires on an unsettled read-back (no Badge)', () => {
    const unsettled = R9_85.filter((c) => c.id !== 'settled').map((c) => (c.id === 'footer' ? { ...c, children: ['bookBtn'] } : c))
    expect(findings(unsettled)).toEqual(['BOOKING_FORM_MISSING'])
  })
})

// T-0399: booking-flow and table-reservation settle in place with ONE ConfirmReceipt whose status is the literal "confirmed"
// (T-0385, T-0390). That receipt is a settled-status signal, and it is the confirmation itself, so neither booking row fires
// on it and it answers a carried BOOKING_CONFIRMATION_MISSING.
describe('a settled ConfirmReceipt is a settled signal and answers the confirmation (T-0399)', () => {
  const findings = (components: A2uiComponent[], intent?: string) =>
    runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, 'ask-1')], ...(intent !== undefined ? { intent } : {}) }).findings.map((f) => f.code)
  const receipt = (status: unknown): A2uiComponent[] => [
    { id: 'root', component: 'Column', children: ['receipt'] },
    { id: 'receipt', component: 'ConfirmReceipt', title: 'Booked', data: { path: '/draft' }, rows: [{ label: 'Date', path: 'date' }], status },
  ]

  it('isSettledSignal reads a literal "confirmed" ConfirmReceipt, never a bound or pending one', () => {
    expect(isSettledSignal(receipt('confirmed')[1]!)).toBe(true)
    expect(isSettledSignal(receipt('pending')[1]!)).toBe(false)
    expect(isSettledSignal(receipt({ path: '/draft/status' })[1]!)).toBe(false)
    expect(isSettledSignal({ id: 'b', component: 'Badge', label: 'Booked' })).toBe(true)
    expect(isSettledSignal({ id: 't', component: 'Text', text: 'Booked', variant: 'h4' })).toBe(true)
    expect(isSettledSignal({ id: 't', component: 'Text', text: 'Booked', variant: 'caption' })).toBe(false)
  })

  it('the settle-in-place receipt gives no finding, with or without the confirm turn', () => {
    for (const status of ['confirmed', 'pending', { path: '/draft/status' }]) {
      expect(findings(receipt(status))).toEqual([])
      expect(findings(receipt(status), 'Those details are right, please confirm the booking.')).toEqual([])
    }
  })

  it('a ConfirmReceipt answers a carried BOOKING_CONFIRMATION_MISSING', () => {
    const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'BookingConfirmation')!
    expect(compositeAnswered(row, [view(receipt('confirmed'))])).toBe(true)
  })
})

// T-0359 (smoke round 2026-10-18-smoke :9, Haiku 5.5): "Propose a calm blue palette for a banking app." shipped the
// palette in prose with no surface. Kim, 2026-10-18: judge the reply, not the ask. On the Stylist's catalog alone, a
// reply that sets out a palette in words (three or more distinct hex codes, or named colors by role or as list lines)
// on a turn that ships no token surface, in a session that never showed one, is SURFACE_MISSING.
describe('a palette set out in the reply with no token surface is SURFACE_MISSING on the Stylist (T-0359)', () => {
  const proseCheck = compositeMomentChecks.find((c) => c.id === 'composite-prose-swatch')!
  const base = loadCatalog(defaultCatalogRaw)
  const stylist = composeCatalog(base, loadCatalogFragment(stylistFragmentRaw), 'stylist')
  const concierge = composeCatalog(base, loadCatalogFragment(hospitalityFragmentRaw), 'hospitality')
  const RECORDED =
    "A calm blue palette for a banking app should feel steady and trustworthy, not loud. I've anchored it on a deep navy primary, a softer steel-blue secondary for supporting elements, and a muted sky accent for highlights. Body-text pairings clear 4.5:1 contrast. The steel-blue secondary falls short on white text, so keep it for charts, icons and non-text accents."
  const msgs = (sid: string, components: A2uiComponent[], create = true): A2uiOutput => [
    ...(create ? [{ version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui--stylist' } }] : []),
    { version: 'v1.0', updateComponents: { surfaceId: sid, components } },
  ] as A2uiOutput
  const PALETTE = msgs('palette-1', COMPOSED['Swatch']!)
  const PAIR = msgs('pair-1', [{ id: 'root', component: 'ContrastPair', foreground: '#1f3a5f', background: '#ffffff', label: 'Body' }])
  const prior = (out: A2uiOutput) => ({ turns: [{ role: 'assistant', content: out.map((m) => JSON.stringify(m)).join('\n') }] })
  const inputOf = (reply: string, out: A2uiOutput = [], session: A2uiOutput = []) => {
    const log = session.length === 0 ? { turns: [] } : prior(session)
    return { surfaces: out.length === 0 ? [] : semanticSurfaceViews(log, out), intent: 'Hi.', reply, open: sessionSurfaceViews(log), shownTypes: sessionComponentTypes(log) }
  }
  /** The SURFACE_MISSING findings every check gated onto `catalog` yields, as `produce()` runs them there. */
  const on = (catalog: { components: Readonly<Record<string, unknown>> }, ...args: Parameters<typeof inputOf>) =>
    runSemanticChecks(gateChecksOnCatalog(compositeMomentChecks, catalog), inputOf(...args)).findings.filter((f) => f.code === 'SURFACE_MISSING')
  const said = (...args: Parameters<typeof inputOf>) => on(stylist, ...args)

  it('the check rides the Stylist catalog alone: never agent-ui, the Concierge or a2ui-basic', () => {
    expect(proseCheck.requires).toEqual([...TOKEN_TYPES])
    expect(stylist.catalogId).toBe('agent-ui--stylist')
    expect(gateChecksOnCatalog([proseCheck], stylist)).toEqual([proseCheck])
    for (const c of [base, concierge, loadCatalog(basicCatalogRaw)]) expect(gateChecksOnCatalog([proseCheck], c)).toEqual([])
  })

  it('the recorded prose reply is SURFACE_MISSING, asking for Swatches, Ramps and ContrastPairs', () => {
    const [f, ...rest] = said(RECORDED)
    expect(rest).toEqual([])
    expect([f!.code, f!.path]).toEqual(['SURFACE_MISSING', 'reply:palette'])
    expect(f!.message).toContain('a palette of 4 colors in words') // navy, steel-blue, sky and white text
    expect(f!.message).toContain('createSurface holding one Swatch per anchor color with its label and value, one Ramp per color family, and one ContrastPair per text pairing')
  })

  // Replies, judged on a first turn with no token surface written, on the Stylist. The user's words never count.
  const REPLIES: readonly (readonly [string, boolean])[] = [
    [RECORDED, true],
    ['Here is the palette: #1f3a5f for headers, #4a6f8a for panels and #9cc3e0 for highlights.', true],
    ['Your palette: #1F3A5F, #4a6f8a and #9cc3e0. Navy on white passes AA.', true],
    ['Primary: navy, Accent: coral, Neutral: sand.', true],
    ['A warm set:\n- Terracotta for buttons\n- Cream for the page\n- Charcoal for body text', true],
    ['1. Sage for the header\n2. Ivory for cards\n3. Slate for text', true],
    ['Background - ivory; text - charcoal; accent - mustard.', true],
    // Quiet: one or two colors, palettes discussed with no list, a passing mention, an order number.
    ['Yes, all three pass AA on white.', false],
    ['White text on navy passes AA at 9.4:1.', false],
    ['Pair a navy primary with a coral accent.', false],
    ['Use #1f3a5f for headers and #4a6f8a for panels.', false],
    ['A limited palette keeps a painting coherent, and painters clean a palette with a rag.', false],
    ['A calm palette for a bank leans on blues and greens, with warm accents used sparingly.', false],
    ['Order #482913 shipped; see issue #969 and ticket #123.', false],
    ['Thanks! Glad the palette works.', false],
    // Verifier 6: every missed form, now pinned (criterion 2).
    ['- **Navy** for headers\n- **Coral** for buttons\n- **Sand** for the page', true],
    ['- **Primary:** Navy\n- **Secondary:** Steel blue\n- **Accent:** Sky', true],
    ['- Header: navy\n- Buttons: coral\n- Body: charcoal', true],
    ['- Primary colour: navy\n- Secondary colour: steel blue\n- Accent colour: sky', true],
    ['Primary navy, secondary steel blue, accent sky.', true],
    ['Primary colour: navy. Secondary colour: steel blue. Accent colour: sky.', true],
    ['Primary \u2014 navy\nSecondary \u2014 steel blue\nAccent \u2014 sky', true],
    ['The primary is navy, the secondary is steel blue and the accent is sky.', true],
    ['Use a success green, a warning amber and an error red for the status badges.', true],
    ['Three anchors:\n- #2a9d8f\n- #e76f51\n- #264653', true],
    // The conductor's decide notes, pinned one way.
    ['Go with navy for the header, sand for the background and coral for buttons.', true],
    ['Primary: periwinkle, Secondary: cornflower, Accent: sienna.', true],
    ['.btn { color: #333; border: 1px solid #ddd; background: #fff; }', false],
    ['```css\n:root { --primary: #1f3a5f; --accent: #9cc3e0; --neutral: #f4efe6; }\n```', false],
    ['Use white text on the primary, black text on the accent and a grey border around cards.', false],
    ['Navy, teal and coral all appear in your logo.', false],
    // Verifier 6 forms that already fired, kept.
    ['Background: cream. Text: charcoal. Accent: teal.', true],
    ['a warm terracotta primary, a soft cream background and a deep espresso text color', true],
    ['Anchors: #FFF, #333, #E63946 and #457B9D.', true],
    ['Here you go: #abcdef, #fedcba and #aabbcc.', true],
  ]
  it.each(REPLIES)('on the Stylist, the reply %j fires: %s; outside the Stylist, none', (reply, fires) => {
    expect(said(reply).map((f) => f.code)).toEqual(fires ? ['SURFACE_MISSING'] : [])
    expect(on(base, reply)).toEqual([])
    expect(on(concierge, reply)).toEqual([])
  })

  it('a reply listing a palette beside a Swatch, a Ramp or a ContrastPair alone is quiet; beside Text alone it fires', () => {
    expect(said(RECORDED, PALETTE)).toEqual([])
    expect(said(RECORDED, msgs('ramp-1', [{ id: 'root', component: 'Ramp', label: 'Blue', steps: [{ label: '500', value: '#3b6ea5' }] }]))).toEqual([])
    expect(said(RECORDED, PAIR)).toEqual([])
    expect(said(RECORDED, msgs('text-1', [{ id: 'root', component: 'Text', text: 'Calm blues' }])).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
  })

  it('a later turn is never judged: a token surface shown, closed or rebuilt, a ContrastPair-only one too', () => {
    expect(said(RECORDED, [], PALETTE)).toEqual([])
    expect(said(RECORDED, [], PAIR)).toEqual([])
    const closed = JSON.stringify({ version: 'v1.0', deleteSurface: { surfaceId: 'palette-1' } })
    const log = { turns: [prior(PALETTE).turns[0]!, { role: 'user', content: 'Close it.' }, { role: 'assistant', content: closed }] }
    expect(sessionSurfaceViews(log)).toEqual([])
    expect(proseCheck.check({ surfaces: [], intent: 'Again?', reply: RECORDED, open: [], shownTypes: sessionComponentTypes(log) })).toEqual([])
  })

  it('"Here\'s our palette... Does it pass AA?" fires only when the reply lists the colors', () => {
    expect(said('Your palette: #1f3a5f, #4a6f8a and #9cc3e0. All three pass AA as text on white.').map((f) => f.code)).toEqual(['SURFACE_MISSING'])
    expect(said('Yes: each of the three passes AA as text on white.')).toEqual([])
  })

  it('a client turn, or a round with no reply, passes', () => {
    expect(proseCheck.check({ surfaces: [], reply: RECORDED, action: { name: 'pick', surfaceId: 'palette-1', context: {}, dataModel: undefined } })).toEqual([])
    expect(proseCheck.check({ surfaces: [], intent: 'Propose a calm blue palette for a banking app.' })).toEqual([])
  })

  it('proseColors counts distinct colors set out as a palette', () => {
    expect(proseColors(RECORDED)).toBe(4)
    expect(proseColors('Order #482913 shipped; see issue #969 and ticket #123.')).toBe(0)
    expect(proseColors('#1f3a5f #1F3A5F #4a6f8a')).toBe(2)
    expect(proseColors('White text on navy.')).toBe(0) // a UI part of something else names no palette role
  })

  it('SWATCH_MISSING reads hex color values, never an order or issue number', () => {
    const text = (t: string) => codes([{ id: 'root', component: 'Text', text: t }])
    expect(text('Order #482913 is confirmed, see issue #969')).toEqual([])
    expect(text('Accent #9cc3e0')).toEqual(['SWATCH_MISSING'])
    expect(text('Neutral grey #333333 for body text')).toEqual(['SWATCH_MISSING'])
  })
})

describe('T-0478: an order or cart built by hand is CONFIRM_RECEIPT_MISSING', () => {
  const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'ConfirmReceipt')!
  const DEAL_SHEET: A2uiComponent[] = [
    { id: 'root', component: 'Column', children: ['hud', 'offer'] },
    { id: 'hud', component: 'GameHud', title: 'The brass lantern', status: 'Round 1' },
    { id: 'offer', component: 'AmountPicker', label: 'Your offer ($)', value: 20, name: 'offer' },
    // T-0480: an order word, since "total" alone no longer opens the gate; the GameHud guard holds the sheet.
    { id: 'note', component: 'Text', text: 'Asking price $40, your order total so far $0' },
  ]
  const ROOM_WALK: A2uiComponent[] = [
    { id: 'root', component: 'StepFlow', children: ['guests'] },
    { id: 'guests', component: 'AmountPicker', label: 'Guests', value: 2, name: 'qty_guests' },
    { id: 'sum', component: 'Text', text: 'Order total for two nights: $480' },
  ]

  it('the finding names the AmountPicker line and asks for the receipt beside it, with no Button', () => {
    const [f] = runSemanticChecks(compositeMomentChecks, { surfaces: [view(HAND_BUILT['ConfirmReceipt']!, 'storefront-1')] }).findings
    expect(f!.code).toBe('CONFIRM_RECEIPT_MISSING')
    expect(f!.path).toBe('storefront-1:line')
    expect(f!.message).toContain('Make it ONE ConfirmReceipt for the order, beside its AmountPicker lines')
    expect(f!.message).toContain('so add no Button')
  })

  it('a quantity read from the name or the bound path counts, and a cart or basket word opens the gate', () => {
    expect(codes([{ id: 'q', component: 'AmountPicker', label: 'Lamp', name: 'quantity' }, { id: 't', component: 'Text', text: 'Your cart' }])).toEqual(['CONFIRM_RECEIPT_MISSING'])
    expect(codes([{ id: 'q', component: 'AmountPicker', label: 'Lamp', value: { path: '/cart/arc/qty' } }, { id: 't', component: 'Text', text: 'Basket' }])).toEqual(['CONFIRM_RECEIPT_MISSING'])
  })

  it('negative controls: a negotiator deal sheet (GameHud), a room booking walk (StepFlow), an amount with no order word and a guest count yield none', () => {
    expect(codes(DEAL_SHEET)).toEqual([])
    expect(codes(ROOM_WALK)).toEqual([])
    expect(codes([{ id: 'tip', component: 'AmountPicker', label: 'Tip ($)', value: 5 }, { id: 't', component: 'Text', text: 'Thanks for dining with us' }])).toEqual([])
    expect(codes([{ id: 'party', component: 'AmountPicker', label: 'Guests', value: 2 }, { id: 't', component: 'Text', text: 'Your order of service' }])).toEqual([])
  })

  it('each lacks guard bites: with GameHud and StepFlow out of lacks the deal sheet and the room walk fire', () => {
    const open = compositeMomentCheck({ ...row, lacks: [] })
    for (const comps of [DEAL_SHEET, ROOM_WALK]) expect(open.check({ surfaces: [view(comps)] }).map((f) => f.code)).toEqual(['CONFIRM_RECEIPT_MISSING'])
  })

  // T-0480 (the T-0478 Fable review): "total" opened the gate, so a bill's tip AmountPicker beside its "Total" Text fired.
  it('negative control: a bill with a tip AmountPicker beside a "Total" Text yields none', () => {
    const BILL: A2uiComponent[] = [
      { id: 'root', component: 'Column', children: ['title', 'tip', 'total'] },
      { id: 'title', component: 'Text', text: 'Your bill', variant: 'h5' },
      { id: 'tip', component: 'AmountPicker', label: 'Tip ($)', value: 6, name: 'tip' },
      { id: 'total', component: 'Text', text: 'Total: $54.00' },
    ]
    expect(codes(BILL)).toEqual([])
  })

  // T-0480 (the T-0478 Fable review): the BookingForm and BookingConfirmation guards each bite on their own.
  const PRE_ORDER: A2uiComponent[] = [
    { id: 'root', component: 'Column', children: ['form', 'wine', 'note'] },
    { id: 'form', component: 'BookingForm', title: 'Reserve a table', fields: [] },
    { id: 'wine', component: 'AmountPicker', label: 'Bottles of house red ($40 each)', value: 1, name: 'qty_wine' },
    { id: 'note', component: 'Text', text: 'Add wine to your order' },
  ]
  const SETTLED_EXTRAS: A2uiComponent[] = [
    { id: 'root', component: 'Column', children: ['done', 'towels', 'note'] },
    { id: 'done', component: 'BookingConfirmation', title: 'Booking confirmed', rows: [] },
    { id: 'towels', component: 'AmountPicker', label: 'Extra towels (qty)', value: 2, name: 'qty_towels' },
    { id: 'note', component: 'Text', text: 'Add to your order' },
  ]
  for (const [guard, comps] of [['BookingForm', PRE_ORDER], ['BookingConfirmation', SETTLED_EXTRAS]] as const) {
    it(`the ${guard} guard bites: the surface yields none, and with ${guard} out of lacks it fires`, () => {
      expect(codes([...comps])).not.toContain('CONFIRM_RECEIPT_MISSING')
      expect(compositeMomentCheck(row).check({ surfaces: [view([...comps])] })).toEqual([])
      const open = compositeMomentCheck({ ...row, lacks: row.lacks.filter((t) => t !== guard) })
      expect(open.check({ surfaces: [view([...comps])] }).map((f) => f.code)).toEqual(['CONFIRM_RECEIPT_MISSING'])
    })
  }
})

describe('T-0550: an order ConfirmReceipt whose bound quantity no AmountPicker binds is SURFACE_MISSING', () => {
  const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'AmountPicker')!
  const run = (components: A2uiComponent[], surfaceId = 'shop-lamps-1') => runSemanticChecks(compositeMomentChecks, { surfaces: [view(components, surfaceId)] }).findings
  /** One cart line: a receipt titled `title` whose item quantity binds `qty`, beside a picker bound to `picked`, if any. */
  const cart = (qty: unknown, picked?: unknown, title = 'Your cart'): A2uiComponent[] => [
    { id: 'root', component: 'Column', children: picked === undefined ? ['receipt'] : ['receipt', 'qty'] },
    { id: 'receipt', component: 'ConfirmReceipt', title, items: [{ label: 'Linen Drum Pendant', quantity: qty, amount: '$92' }], totalPath: '/cart/total', status: 'pending' },
    ...(picked === undefined ? [] : [{ id: 'qty', component: 'AmountPicker', label: 'Quantity', value: picked }]),
  ]

  it('round 17 :154 r2 draws the finding on order, naming /lamp/qty and asking for ONE AmountPicker per line beside the receipt', () => {
    const findings = run(R17_154_R2)
    expect(findings.map((f) => [f.code, f.path])).toEqual([['SURFACE_MISSING', 'shop-lamps-1:order']])
    const [f] = findings
    expect(f!.message).toContain('order (a ConfirmReceipt)')
    expect(f!.message).toContain('/lamp/qty')
    expect(f!.message).toContain('Add ONE AmountPicker per such line, its value bound to that quantity path')
    expect(f!.message).toContain('beside the ConfirmReceipt')
  })

  it('negative control: round 17 :139, a ConfirmReceipt beside its AmountPicker, yields none', () => {
    // :139 (reach-shopkeeper-cart-amount-haiku-2), the recorded storefront-lamps update.
    const R17_139: A2uiComponent[] = [
      { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'tiles', 'qty_brass', 'receipt'] },
      { id: 'qty_brass', component: 'AmountPicker', label: 'Brass Arc Floor Lamp quantity', value: { path: '/cart/brassQty' }, min: 0, max: 10, step: 1, currency: 'USD' },
      { id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', data: { path: '/cart' }, rows: [{ label: 'Brass Arc Floor Lamp', path: '/cart/brassLine' }], totalLabel: 'Total', totalPath: '/cart/total', status: { path: '/cart/status' }, confirmAction: { action: 'confirm_order', context: { total: '$378' } }, backAction: { action: 'back_to_shop' } },
    ]
    expect(run(R17_139, 'storefront-lamps')).toEqual([])
  })

  it('negative control: the same receipt with an AmountPicker bound to /lamp/qty yields none, and one bound elsewhere still fires', () => {
    expect(run(R17_154_PICKED)).toEqual([])
    const elsewhere = R17_154_PICKED.map((c) => (c.id === 'qty_arc' ? { ...c, value: { path: '/lamp/count' } } : c))
    expect(run(elsewhere).map((f) => [f.code, f.path])).toEqual([['SURFACE_MISSING', 'shop-lamps-1:order']])
  })

  it('a cart or basket word opens the gate too, and a line with its picker is not named beside one without', () => {
    expect(run(cart({ path: '/cart/qty' })).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
    expect(run(cart({ path: '/cart/qty' }, undefined, 'Your basket')).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
    const two: A2uiComponent[] = [
      { id: 'root', component: 'Column', children: ['receipt', 'qty_a'] },
      { id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', items: [{ label: 'Lamp', quantity: { path: '/cart/a' }, amount: '$1' }, { label: 'Shade', quantity: { path: '/cart/b' }, amount: '$2' }], status: 'pending' },
      { id: 'qty_a', component: 'AmountPicker', label: 'Lamp quantity', value: { path: '/cart/a' } },
    ]
    const [f] = run(two)
    expect(f!.message).toContain('/cart/b')
    expect(f!.message).not.toContain('/cart/a')
  })

  it('negative controls: no order word, a literal quantity, bound items and a templated picker yield none', () => {
    expect(run(cart({ path: '/stay/nights' }, undefined, 'Your stay'))).toEqual([])
    expect(run(cart(2))).toEqual([])
    expect(run([{ id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', items: { path: '/cart/items' }, totalPath: '/cart/total', status: 'pending' }])).toEqual([])
    expect(run([...cart({ path: '/cart/items/0/qty' }), { id: 'lines', component: 'List', children: { path: '/cart/items', componentId: 'line' } }, { id: 'line', component: 'AmountPicker', label: 'Quantity', value: { path: 'qty' } }])).toEqual([])
  })

  it('a relative quantity path reads under the receipt data path', () => {
    const rel: A2uiComponent[] = [{ id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', data: { path: '/cart' }, items: [{ label: 'Lamp', quantity: { path: 'qty' }, amount: '$1' }], status: 'pending' }]
    expect(run(rel)[0]!.message).toContain('/cart/qty')
    expect(run([...rel, { id: 'q', component: 'AmountPicker', label: 'Quantity', value: { path: '/cart/qty' } }])).toEqual([])
  })

  // Each guard of the T-0478 row: a negotiator deal sheet, a room booking walk, a booking form and a settled booking.
  for (const guard of ['GameHud', 'StepFlow', 'BookingForm', 'BookingConfirmation']) {
    it(`the ${guard} guard bites: the cart beside a ${guard} yields none, and with ${guard} out of lacks it fires`, () => {
      const comps = [...cart({ path: '/cart/qty' }), { id: 'guard', component: guard }]
      expect(compositeMomentCheck(row).check({ surfaces: [view(comps)] })).toEqual([])
      const open = compositeMomentCheck({ ...row, lacks: row.lacks.filter((t) => t !== guard) })
      expect(open.check({ surfaces: [view(comps)] }).map((f) => f.code)).toEqual(['SURFACE_MISSING'])
    })
  }

  it("the row's AmountPicker words still open the T-0478 gate: a quantity line labelled with a cart word draws CONFIRM_RECEIPT_MISSING", () => {
    expect(codes([{ id: 'q', component: 'AmountPicker', label: 'Lamps in your cart', name: 'quantity' }])).toEqual(['CONFIRM_RECEIPT_MISSING'])
  })
})

describe('T-0480: a day plan of timed stops answered with no Itinerary is ITINERARY_MISSING', () => {
  const row = COMPOSITE_MOMENTS.find((m) => m.composite === 'Itinerary')!
  const check = compositeMomentCheck(row)
  const run = (intent: string | undefined, surfaces: SurfaceView[] = []) => check.check({ surfaces, intent }).map((f) => f.code)

  it('the round 15 :150 prose round and its ask-deck repair each draw the finding; the ask deck is named so a repair may retire it', () => {
    const [prose] = check.check({ surfaces: [], intent: DAY_PLAN })
    expect(prose).toMatchObject({ code: 'ITINERARY_MISSING', path: 'intent:itinerary' })
    expect(prose!.message).toContain('a plan of 3 timed stops, and this turn writes no Itinerary')
    expect(prose!.message).toContain('Make it ONE Itinerary on a surface of its own')
    expect(prose!.message).toContain('the turn declares no ask')
    const [deck] = check.check({ surfaces: [view(HAND_BUILT['Itinerary']!, 'ask-1')], intent: DAY_PLAN })
    expect(deck).toMatchObject({ code: 'ITINERARY_MISSING', path: 'ask-1:root' })
    expect(deck!.message).toContain('ask-1 holds no Itinerary')
  })

  it('clock and am/pm times count, each distinct time once', () => {
    expect(run('Plan my Sunday: brunch at 11am and the spa at 3 pm')).toEqual(['ITINERARY_MISSING'])
    expect(run('Put together an itinerary: 9:30 museum, 13:00 lunch')).toEqual(['ITINERARY_MISSING'])
    expect(run('Plan breakfast at 08:00 and a call at 08:00')).toEqual([])
  })

  it('negative controls: one timed stop, no plan word, prices, an action turn and a turn whose surface holds an Itinerary yield none', () => {
    expect(run('Plan dinner at Vela at 20:00.')).toEqual([])
    expect(run('Book a massage at 15:00 and a table at 20:00.')).toEqual([])
    expect(run('Plan a picnic: sandwiches $12.50 and juice $3.75')).toEqual([])
    expect(run(undefined)).toEqual([])
    expect(check.check({ surfaces: [], intent: DAY_PLAN, action: { name: 'choose', surfaceId: 'ask-1', context: {}, dataModel: undefined } })).toEqual([])
    expect(run(DAY_PLAN, [view(COMPOSED['Itinerary']!, 'plan-1')])).toEqual([])
  })

  // T-0484 (the T-0480 Fable verifier note): "schedule" as a booking verb is not a plan, however many clock times follow.
  it('a booking ask with two clock times yields none, while a schedule of the day still does', () => {
    expect(run('Schedule a massage at 15:00 and a taxi to the airport at 18:00.')).toEqual([])
    expect(run('Can you schedule the spa at 3pm and dinner at 8pm for us?')).toEqual([])
    expect(run('Schedule my day: breakfast at 8am and a hike at 10am')).toEqual(['ITINERARY_MISSING'])
    expect(run('Build me a schedule for Saturday: brunch at 11:00 and the spa at 15:00')).toEqual(['ITINERARY_MISSING'])
  })

  // T-0503: "schedule our <weekday>" is a plan for any weekday, not only Friday to Sunday.
  it('schedule my or our any weekday is a plan, while a timed booking stays none', () => {
    expect(run('Schedule our Tuesday: breakfast at 8am and a hike at 10am')).toEqual(['ITINERARY_MISSING'])
    expect(run('Please schedule my Monday: standup at 9:00 and lunch at 12:30')).toEqual(['ITINERARY_MISSING'])
    expect(run('Schedule a massage at 15:00 and a taxi to the airport on Tuesday at 18:00.')).toEqual([])
  })

  it('the plan cue bites: with a cue that matches nothing, the day plan yields none', () => {
    const open = compositeMomentCheck({ ...row, planned: { ...row.planned!, cue: /$^/ } })
    expect(open.check({ surfaces: [], intent: DAY_PLAN })).toEqual([])
  })
})
