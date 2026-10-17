// composition-pack-a.ts — GH #1205's COMPOSITION SEEDS PACK A (req-a2ui-library R4, now-tier): the four
// dispositioned **composition** patterns — slideshow · confirmation · trend-list · card-layouts — each a
// pattern seed over EXISTING catalog types, never a new component (the disposition table's whole point,
// .claude/docs/research/req-a2ui-library.md). Same idiom discipline as every sibling module: an
// agent-realistic promptText, live data-model binding for everything that varies per instance (the
// "dead data" defect class — updateDataModel carries `value:`, varying content rides `{path}`/`${…}`),
// realistic content (the demand-evidence law — no lorem), the grammar.md card-anatomy clause wherever a
// Card appears (header = identity only · content = substance · footer = the actions), and the shared
// validate+render-smoke gate (examples.test.ts) proving each at check time.
//
// (1) SLIDESHOW/GALLERY — Swiper > SwiperItem > Image, caption Text default-slotted over the Image's
//     bottom scrim (the disposition row's full-bleed slide: image fills the SwiperItem; the scrim
//     treatment is the Image control's own R2 contract, the frontier-image-hero-card idiom).
// (2) CONFIRMATION VIEW, a settled record since T-0335: Card > CardHeader identity and status Badge +
//     CardContent record of a settled change (the ADR-0201 DescriptionList primitive, rows bound and
//     humanized) + CardFooter follow-up Button pair with record-bound context, no commit. A COMPOSITION
//     pattern, distinct from the frontier-booking-receipt primitive exemplar (#1185): this is the whole
//     three-slot confirmation CARD, not the bare receipt node.
// (3) TREND LIST — List > Row{Text label · Sparkline · Stat delta}, templated over the data model with
//     RELATIVE per-item binds (the person_card idiom, dynamic-lists.ts); delta sign carries the
//     direction (ui-stat intent color, Domo/ClearPoint KPI convention).
// (4) CARD LAYOUTS — cards whose bodies are list/columns/grid arrangements, side by side on one track
//     Grid: already fully expressible with Card children (the disposition row's finding), shown once so
//     the producer has the idiomatic reference for each arrangement.

import type { ExampleSeed } from './types.ts'

const SLIDESHOW_ID = 'slideshow-gallery'
/** Composition 1 — the SLIDESHOW/GALLERY pattern: a paddled, paginated Swiper whose every slide is a
 *  full-bleed Image (fit "cover", one shared aspect so the deck holds a stable box — zero CLS per
 *  slide), each carrying its caption Text default-slotted over the Image's own bottom gradient scrim
 *  (the disposition row's Smashing-Magazine text-over-image treatment, the control's R2 contract —
 *  never a caption Row bolted under the photo). `src` values are data-bound so an amend turn can swap
 *  a photo in place; every `alt` is a static producer-authored literal (image.md's admission-enforced
 *  accessible-name contract). The active index rides the model (the onboarding-tour bindable-active
 *  idiom) so the agent can jump the deck to the slide it is talking about. */
export const slideshowGallerySeed: ExampleSeed = {
  name: 'slideshow-gallery',
  description:
    'A photo slideshow — a paddled, paginated Swiper of full-bleed SwiperItem Images (fit cover, stable aspect), each with a caption Text over the bottom scrim, active index bound to the model.',
  promptText: 'Show me the photos of the Alfama apartment as a slideshow I can page through, with captions.',
  surfaceId: SLIDESHOW_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SLIDESHOW_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SLIDESHOW_ID,
        value: {
          gallery: {
            active: 0,
            photos: {
              living: '/photos/alfama-apartment/living-room.jpg',
              terrace: '/photos/alfama-apartment/terrace.jpg',
              bedroom: '/photos/alfama-apartment/bedroom.jpg',
            },
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SLIDESHOW_ID,
        components: [
          {
            id: 'root', component: 'Swiper', pagination: true, paddles: true, align: 'start',
            active: { path: '/gallery/active' }, children: ['slide_living', 'slide_terrace', 'slide_bedroom'],
          },
          { id: 'slide_living', component: 'SwiperItem', children: ['img_living'] },
          {
            id: 'img_living', component: 'Image', src: { path: '/gallery/photos/living' },
            alt: 'Living room with arched windows over the rooftops', fit: 'cover', aspect: '16/9',
            children: ['cap_living'],
          },
          { id: 'cap_living', component: 'Text', text: 'Living room — morning light over the Alfama rooftops' },
          { id: 'slide_terrace', component: 'SwiperItem', children: ['img_terrace'] },
          {
            id: 'img_terrace', component: 'Image', src: { path: '/gallery/photos/terrace' },
            alt: 'Tiled terrace with two chairs facing the river', fit: 'cover', aspect: '16/9',
            children: ['cap_terrace'],
          },
          { id: 'cap_terrace', component: 'Text', text: 'Private terrace — Tagus view, evening sun' },
          { id: 'slide_bedroom', component: 'SwiperItem', children: ['img_bedroom'] },
          {
            id: 'img_bedroom', component: 'Image', src: { path: '/gallery/photos/bedroom' },
            alt: 'Bedroom with a queen bed and azulejo headboard wall', fit: 'cover', aspect: '16/9',
            children: ['cap_bedroom'],
          },
          { id: 'cap_bedroom', component: 'Text', text: 'Bedroom — azulejo wall, sleeps two' },
        ],
      },
    },
  ],
}

const CONFIRM_ID = 'confirmation-view'
/** Composition 2: the SETTLED RECORD card a producer emits once a change has gone through (Card > CardHeader
 *  + CardContent record + CardFooter follow-ups), grammar.md's card-anatomy law applied end to end. The
 *  CardHeader carries the identity title with a settled-status Badge beside it (the settle shape grammar.md
 *  gives a confirmed receipt, and the T-0318 `frontier-booking-receipt` precedent). CardContent carries the
 *  substance: the ADR-0201 DescriptionList, rows BOUND so a later correction updates the record in place,
 *  values arriving HUMANIZED from the producer. CardFooter carries follow-up actions only, a ghost secondary
 *  beside one soft primary, neither a commit; each names the record it acts on through a bound action
 *  context (`/plan/id`, `/plan/invoiceId`). T-0335 (2026-10-17): re-admitted through the judged `--replace`
 *  exit as a settled plan change; it used to read a dinner reservation back before a Confirm button, which
 *  the rulings rule out (T-0266: a booking with every detail is a pre-filled BookingForm; T-0289: the
 *  confirm settles as a BookingConfirmation). Contrast `frontier-booking-receipt` (#1185, T-0318): that seed
 *  exercises the DescriptionList PRIMITIVE bare, with no buttons; this one is the whole card with its
 *  footer. */
export const confirmationViewSeed: ExampleSeed = {
  name: 'confirmation-view',
  description:
    'A settled plan-change record card: CardHeader title with an Active status Badge, CardContent DescriptionList with bound humanized rows, CardFooter Row of a ghost and a soft follow-up Button whose action context is bound to the plan record, no commit (card-anatomy law end to end).',
  promptText: 'We just switched the team to the Business plan. Which billing changes take effect now?',
  surfaceId: CONFIRM_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CONFIRM_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CONFIRM_ID,
        value: {
          plan: {
            id: 'sub_business_2041',
            invoiceId: 'INV-2026-1017',
            rows: [
              { label: 'Plan', value: 'Business, billed yearly' },
              { label: 'Seats', value: '12 of 15 in use' },
              { label: 'Effective', value: 'Today, Oct 17' },
              { label: 'Charged today', value: '$184.00 prorated to Mar 1, on the card ending 4242' },
              { label: 'Next renewal', value: 'Mar 1, 2027 at $2,160.00 a year' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CONFIRM_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['head'] },
          { id: 'head', component: 'Row', gap: 'sm', align: 'center', children: ['title', 'status'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Plan updated' },
          { id: 'status', component: 'Badge', label: 'Active', intent: 'success' },
          { id: 'ct', component: 'CardContent', children: ['record'] },
          { id: 'record', component: 'DescriptionList', rows: { path: '/plan/rows' } },
          { id: 'ft', component: 'CardFooter', children: ['actions'] },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_invoice', 'btn_seats'] },
          { id: 'btn_invoice', component: 'Button', variant: 'ghost', label: 'View invoice', action: { action: 'view_invoice', context: { invoice: { path: '/plan/invoiceId' } } } },
          { id: 'btn_seats', component: 'Button', variant: 'soft', label: 'Add seats', action: { action: 'add_seats', context: { plan: { path: '/plan/id' } } } },
        ],
      },
    },
  ],
}

const TREND_ID = 'trend-list'
/** Composition 3 — the TREND LIST pattern (up/down metrics): a List templated over the data model, each
 *  row a Row{Text label · Sparkline · Stat delta} with RELATIVE per-item binds (the person_card idiom).
 *  The Sparkline carries the metric's recent series; the Stat carries the current value with its signed
 *  `delta` — the sign IS the direction, rendered in ui-stat's intent color (green-up/red-down,
 *  Domo/ClearPoint KPI convention; a lower-is-better metric like error rate simply reports its real
 *  signed change — the presentation-inversion nuance stays a component concern, not a payload one). */
export const trendListSeed: ExampleSeed = {
  name: 'trend-list',
  description:
    'A trend list of up/down metrics — a List templated over the model, each Row pairing a Text label with a Sparkline of the recent series and a Stat carrying the current value + signed delta.',
  promptText: 'How are the launch metrics trending this week? Show each one with its recent curve and the change.',
  surfaceId: TREND_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TREND_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: TREND_ID,
        value: {
          metrics: [
            { label: 'Daily signups', spark: [118, 132, 141, 128, 156, 171, 189], value: 189, delta: 18 },
            { label: 'Activation rate', spark: [34, 35, 37, 36, 38, 41, 42], value: '42%', delta: 1 },
            { label: 'Median session', spark: [6.1, 6.4, 6.2, 6.8, 7.0, 7.3, 7.4], value: '7.4 min', delta: 0.1 },
            { label: 'Checkout errors', spark: [21, 19, 24, 17, 14, 12, 9], value: 9, delta: -3 },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TREND_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'trend_list'] },
          { id: 'heading', component: 'Text', variant: 'h4', text: 'Launch metrics — last 7 days' },
          { id: 'trend_list', component: 'List', gap: 'sm', children: { path: '/metrics', componentId: 'metric_tpl' } },
          { id: 'metric_tpl', component: 'Row', gap: 'md', align: 'center', justify: 'between', children: ['tpl_label', 'tpl_spark', 'tpl_stat'] },
          { id: 'tpl_label', component: 'Text', text: '${label}' },
          { id: 'tpl_spark', component: 'Sparkline', values: { path: 'spark' }, label: { path: 'label' }, variant: 'line' },
          { id: 'tpl_stat', component: 'Stat', value: { path: 'value' }, delta: { path: 'delta' } },
        ],
      },
    },
  ],
}

const LAYOUTS_ID = 'card-layouts'
/** Composition 4 — the CARD-LAYOUTS pattern: cards whose BODIES are list/columns/grid arrangements —
 *  the disposition row's "already fully expressible" finding, shown once so the producer has the
 *  idiomatic reference for each. Three cards on one track Grid, each obeying the card-anatomy law
 *  (CardHeader identity only; the arrangement lives in CardContent): a LIST body (today's standup
 *  queue, templated), a COLUMNS body (a Row of two labeled Columns — on-call rotation now/next), and a
 *  GRID body (a track Grid of Stat tiles — the sprint scoreboard). */
export const cardLayoutsSeed: ExampleSeed = {
  name: 'card-layouts',
  description:
    'Three cards on a track Grid, each body a different arrangement — a templated List, a two-Column Row, and a Grid of Stat tiles — CardHeader carrying identity only (card-anatomy law).',
  promptText: 'Give me the team dashboard: today’s standup queue, who’s on call now and next, and the sprint numbers.',
  surfaceId: LAYOUTS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: LAYOUTS_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: LAYOUTS_ID,
        value: {
          standup: ['Ana — payments rollout status', 'Ben — search reindex blocker', 'Chi — onboarding A/B results'],
          oncall: { now: 'Deniz Aksoy', nowUntil: 'until Fri 09:00', next: 'Ana Sousa', nextFrom: 'from Fri 09:00' },
          sprint: { done: 23, inReview: 5, blocked: 2, daysLeft: 4 },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: LAYOUTS_ID,
        components: [
          { id: 'root', component: 'Grid', gap: 'md', min: '16rem', children: ['card_list', 'card_columns', 'card_grid'] },
          // Card 1 — a LIST body: the standup queue, templated over the model.
          { id: 'card_list', component: 'Card', elevation: '1', children: ['list_hd', 'list_ct'] },
          { id: 'list_hd', component: 'CardHeader', children: ['list_title'] },
          { id: 'list_title', component: 'Text', variant: 'h5', text: 'Standup queue' },
          { id: 'list_ct', component: 'CardContent', children: ['standup_list'] },
          { id: 'standup_list', component: 'List', gap: 'xs', children: { path: '/standup', componentId: 'standup_tpl' } },
          { id: 'standup_tpl', component: 'Text', text: { path: '' } },
          // Card 2 — a COLUMNS body: a Row of two labeled Columns (now / next).
          { id: 'card_columns', component: 'Card', elevation: '1', children: ['cols_hd', 'cols_ct'] },
          { id: 'cols_hd', component: 'CardHeader', children: ['cols_title'] },
          { id: 'cols_title', component: 'Text', variant: 'h5', text: 'On call' },
          { id: 'cols_ct', component: 'CardContent', children: ['cols_row'] },
          { id: 'cols_row', component: 'Row', gap: 'lg', children: ['col_now', 'col_next'] },
          { id: 'col_now', component: 'Column', gap: 'xs', children: ['now_label', 'now_name', 'now_until'] },
          { id: 'now_label', component: 'Text', variant: 'label', text: 'Now' },
          { id: 'now_name', component: 'Text', text: { path: '/oncall/now' } },
          { id: 'now_until', component: 'Text', variant: 'caption', text: { path: '/oncall/nowUntil' } },
          { id: 'col_next', component: 'Column', gap: 'xs', children: ['next_label', 'next_name', 'next_from'] },
          { id: 'next_label', component: 'Text', variant: 'label', text: 'Next' },
          { id: 'next_name', component: 'Text', text: { path: '/oncall/next' } },
          { id: 'next_from', component: 'Text', variant: 'caption', text: { path: '/oncall/nextFrom' } },
          // Card 3 — a GRID body: a track Grid of Stat tiles (the sprint scoreboard).
          { id: 'card_grid', component: 'Card', elevation: '1', children: ['grid_hd', 'grid_ct'] },
          { id: 'grid_hd', component: 'CardHeader', children: ['grid_title'] },
          { id: 'grid_title', component: 'Text', variant: 'h5', text: 'Sprint 34' },
          { id: 'grid_ct', component: 'CardContent', children: ['stats_grid'] },
          { id: 'stats_grid', component: 'Grid', gap: 'sm', min: '6rem', children: ['st_done', 'st_review', 'st_blocked', 'st_days'] },
          { id: 'st_done', component: 'Stat', label: 'Done', value: { path: '/sprint/done' } },
          { id: 'st_review', component: 'Stat', label: 'In review', value: { path: '/sprint/inReview' } },
          { id: 'st_blocked', component: 'Stat', label: 'Blocked', value: { path: '/sprint/blocked' } },
          { id: 'st_days', component: 'Stat', label: 'Days left', value: { path: '/sprint/daysLeft' } },
        ],
      },
    },
  ],
}

/** The pack's family array — `allSeeds`' composition surface (never a hand-counted literal). */
export const compositionPackASeeds: readonly ExampleSeed[] = [
  slideshowGallerySeed,
  confirmationViewSeed,
  trendListSeed,
  cardLayoutsSeed,
]
