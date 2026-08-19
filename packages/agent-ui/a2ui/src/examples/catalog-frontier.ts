// catalog-frontier.ts — the four CATALOG-FRONTIER seeds (GH #729): the 2026-08-12 example sweep found 13
// of the default catalog's 59 components appearing in NO example anywhere (seed shelf ∪ committed corpus
// shard) — the catalog had outgrown its examples. These seeds close that gap and the new coverage gate in
// examples.test.ts keeps it closed: a future catalog row with no example reddens the suite.
//
// Covered here, and nowhere else at sweep time: CardHeader · CardFooter · Icon · Pagination (frontier 1)
// · Modal · FormPopover · MultiSelect (frontier 2) · Split · SplitPane · Timeline · TimelineItem
// (frontier 3) · Swiper · SwiperItem (frontier 4). Same idiom discipline as every sibling module: an
// agent-realistic promptText, fine-grained data-model seeding where state is client-bindable, every prop
// a DECLARED catalog row, and the shared validate+render-smoke gate proving each at check time.
//
// Frontier 11 (ADR-0205, GH #1207) — `LineChart`, the fleet's first axis-bearing chart, lands its catalog
// row IN THE SAME WAVE it ships (cl.8), so this seed closes its coverage gap the moment that row exists.

import type { ExampleSeed } from './types.ts'

const TRIP_ID = 'frontier-trip-card'
/** Frontier 1 — the card CHROME family (CardHeader/CardFooter) + Icon + Pagination: an itinerary card
 *  whose header carries an icon-led identity row, whose body renders every day through a real `List`
 *  ChildList template over `/trip/days` (the dynamic-lists `person_card` idiom — relative-path `${…}`
 *  interpolation per item, not static meta-copy), and whose footer pairs the pager with the one action.
 *  `page` two-way-binds AND is read back: a caption in the body interpolates the absolute path
 *  `${/trip/page}`, so paging genuinely changes rendered output instead of writing to a path nothing
 *  reads (the judged REJECT this repairs, GH #830 — corpus/verdicts/2026-08-13--s5-verdicts.json D1/D2).
 *  No per-page FILTERING: the default catalog's binding grammar has no computed-index/conditional-
 *  visibility primitive (only `@index` inside a list's own item scope, `renderer/functions.ts`), so the
 *  pager tracks review position over the full listed itinerary rather than swapping which day is shown —
 *  the honest capability, not the untrue "page by day" framing the REJECT verdict caught. */
export const tripCardSeed: ExampleSeed = {
  name: 'frontier-trip-card',
  description: 'An itinerary Card — CardHeader identity row with an Icon, CardContent listing every day via a List template plus a page-position caption bound to the pager, CardFooter with a live Pagination + confirm Button.',
  promptText: 'Show my 3-day Lisbon itinerary as a card listing every day, with a pager to track which day I’m reviewing and a confirm button.',
  surfaceId: TRIP_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TRIP_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: TRIP_ID,
        value: {
          trip: {
            page: 1,
            days: [
              { title: 'Day 1 — Alfama', plan: 'Castle at ten, tram 28 after lunch, fado at dusk.' },
              { title: 'Day 2 — Belém', plan: 'Monastery early, pastéis warm, river walk back.' },
              { title: 'Day 3 — Sintra', plan: 'Pena palace first, Quinta gardens, sunset at Cabo da Roca.' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TRIP_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['head', 'body', 'foot'] },
          { id: 'head', component: 'CardHeader', children: ['head_row'] },
          { id: 'head_row', component: 'Row', gap: 'sm', align: 'center', children: ['head_icon', 'head_title'] },
          { id: 'head_icon', component: 'Icon', name: 'map-pin', label: 'Trip' },
          { id: 'head_title', component: 'Text', variant: 'h4', text: 'Lisbon — 3 days' },
          { id: 'body', component: 'CardContent', children: ['day_list', 'day_position'] },
          // Real day content, bound: a List ChildList template instantiated once per `/trip/days`
          // element (renderer LLD-C6), each item's title/plan read via RELATIVE `${…}` paths — the
          // person_card/queue_tpl idiom (dynamic-lists.ts), never static placeholder text.
          { id: 'day_list', component: 'List', gap: 'sm', children: { path: '/trip/days', componentId: 'day_tpl' } },
          { id: 'day_tpl', component: 'Column', gap: 'xs', children: ['day_tpl_title', 'day_tpl_plan'] },
          { id: 'day_tpl_title', component: 'Text', variant: 'h5', text: '${title}' },
          { id: 'day_tpl_plan', component: 'Text', text: '${plan}' },
          // The pager readback: an ABSOLUTE `${/trip/page}` interpolation (ADR-0027 §3 — `/…` resolves
          // outside any item scope), so the Pagination's own two-way commit is genuinely read by the
          // render, not a write nothing observes.
          { id: 'day_position', component: 'Text', variant: 'caption', text: 'Reviewing day ${/trip/page} of 3' },
          { id: 'foot', component: 'CardFooter', children: ['foot_row'] },
          { id: 'foot_row', component: 'Row', gap: 'md', align: 'center', justify: 'between', children: ['pager', 'btn_confirm'] },
          { id: 'pager', component: 'Pagination', page: { path: '/trip/page' }, pages: 3, label: 'Itinerary day' },
          { id: 'btn_confirm', component: 'Button', variant: 'solid', label: 'Confirm this plan', action: { action: 'confirm_trip' } },
        ],
      },
    },
  ],
}

const INVITE_ID = 'frontier-invite'
/** Frontier 2 — the OVERLAY family (Modal/FormPopover) + MultiSelect: a members panel whose invite flow
 *  lives in a Modal (open riding the data model — client state, ADR-0053's bindable-open idiom) and whose
 *  quick filter is a FormPopover. The role picker is the MultiSelect's array-valued two-way bind. */
export const inviteModalSeed: ExampleSeed = {
  name: 'frontier-invite-modal',
  description: 'A members panel — an invite Modal (bindable open) holding a MultiSelect role picker, plus a FormPopover quick filter.',
  promptText: 'Let me invite a teammate: a dialog with their email and a multi-select of roles, plus a quick filter popover on the member list.',
  surfaceId: INVITE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: INVITE_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: INVITE_ID,
        value: { invite: { open: false, email: '', roles: ['editor'] }, filter: { open: false, query: '' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: INVITE_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['bar', 'members', 'invite_modal'] },
          { id: 'bar', component: 'Row', gap: 'md', align: 'center', justify: 'between', children: ['bar_title', 'bar_actions'] },
          { id: 'bar_title', component: 'Text', variant: 'h4', text: 'Members' },
          { id: 'bar_actions', component: 'Row', gap: 'sm', children: ['filter_pop', 'btn_open_invite'] },
          { id: 'filter_pop', component: 'FormPopover', label: 'Filter', placement: 'bottom-end', open: { path: '/filter/open' }, children: ['filter_field'] },
          { id: 'filter_field', component: 'Field', label: 'Name contains', child: 'filter_input' },
          { id: 'filter_input', component: 'TextField', name: 'query', value: { path: '/filter/query' } },
          { id: 'btn_open_invite', component: 'Button', variant: 'solid', label: 'Invite…', action: { action: 'open_invite' } },
          { id: 'members', component: 'List', children: { path: '/members', componentId: 'member_tpl' } },
          { id: 'member_tpl', component: 'Text', text: { path: '' } },
          { id: 'invite_modal', component: 'Modal', open: { path: '/invite/open' }, elevation: '2', children: ['modal_col'] },
          { id: 'modal_col', component: 'Column', gap: 'md', children: ['modal_title', 'f_email', 'f_roles', 'modal_actions'] },
          { id: 'modal_title', component: 'Text', variant: 'h4', text: 'Invite a teammate' },
          { id: 'f_email', component: 'Field', label: 'Email', child: 'in_email' },
          {
            id: 'in_email', component: 'TextField', name: 'email', value: { path: '/invite/email' },
            checks: [{ call: 'email', args: { value: { path: '/invite/email' } }, message: 'Enter a valid email address.' }],
          },
          { id: 'f_roles', component: 'Field', label: 'Roles', child: 'in_roles' },
          {
            id: 'in_roles', component: 'MultiSelect', name: 'roles', label: 'Roles', value: { path: '/invite/roles' },
            options: [
              { label: 'Viewer', value: 'viewer' },
              { label: 'Editor', value: 'editor' },
              { label: 'Admin', value: 'admin' },
            ],
          },
          { id: 'modal_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_cancel', 'btn_send'] },
          { id: 'btn_cancel', component: 'Button', variant: 'ghost', label: 'Cancel', action: { action: 'cancel_invite', wantResponse: false } },
          { id: 'btn_send', component: 'Button', variant: 'solid', label: 'Send invite', action: { action: 'send_invite' } },
        ],
      },
    },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: INVITE_ID, path: '/members', value: ['Ana Sousa — admin', 'Ben Okafor — editor', 'Chi Nguyen — viewer'] },
    },
  ],
}

const REVIEW_ID = 'frontier-review-split'
/** Frontier 3 — the ARRANGEMENT family (Split/SplitPane) + the timeline family (Timeline/TimelineItem):
 *  a review board whose left pane lists the queue and whose right pane narrates one item's history as a
 *  status timeline — the classic master/detail an agent reaches for once a task has stages. */
export const reviewSplitSeed: ExampleSeed = {
  name: 'frontier-review-split',
  description: 'A review board — a horizontal Split (queue SplitPane | detail SplitPane) whose detail narrates progress as a Timeline of status TimelineItems.',
  promptText: 'Show the release-review board: the queue on the left, and the selected item’s progress history on the right.',
  surfaceId: REVIEW_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: REVIEW_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: REVIEW_ID,
        value: { queue: ['Payments v2 rollout', 'Search reindex', 'Mobile onboarding'] },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: REVIEW_ID,
        components: [
          { id: 'root', component: 'Split', axis: 'horizontal', children: ['pane_queue', 'pane_detail'] },
          { id: 'pane_queue', component: 'SplitPane', initial: 35, min: '12rem', children: ['queue_col'] },
          { id: 'queue_col', component: 'Column', gap: 'sm', children: ['queue_title', 'queue_list'] },
          { id: 'queue_title', component: 'Text', variant: 'h5', text: 'Review queue' },
          { id: 'queue_list', component: 'List', children: { path: '/queue', componentId: 'queue_tpl' } },
          { id: 'queue_tpl', component: 'Text', text: { path: '' } },
          { id: 'pane_detail', component: 'SplitPane', children: ['detail_col'] },
          { id: 'detail_col', component: 'Column', gap: 'md', children: ['detail_title', 'history'] },
          { id: 'detail_title', component: 'Text', variant: 'h5', text: 'Payments v2 rollout — history' },
          { id: 'history', component: 'Timeline', label: 'Review history', children: ['t1', 't2', 't3', 't4'] },
          { id: 't1', component: 'TimelineItem', status: 'done', label: 'Spec approved', description: 'Sign-off from platform + risk.', timestamp: 'Mon' },
          { id: 't2', component: 'TimelineItem', status: 'done', label: 'Staging verified', description: 'All 42 checks green.', timestamp: 'Tue' },
          { id: 't3', component: 'TimelineItem', status: 'active', label: 'Canary at 5%', description: 'Error budget steady.', timestamp: 'now' },
          { id: 't4', component: 'TimelineItem', status: 'pending', label: 'Full rollout', description: 'Gated on canary holding 24h.' },
        ],
      },
    },
  ],
}

const TOUR_ID = 'frontier-onboarding-tour'
/** Frontier 4 — the SWIPER family: a paddled, paginated onboarding tour, one small card per slide, the
 *  active index riding the data model (bindable `active` — the agent can advance the tour itself). */
export const onboardingTourSeed: ExampleSeed = {
  name: 'frontier-onboarding-tour',
  description: 'A 3-slide onboarding tour — a paddled, paginated Swiper of SwiperItem cards, active index bound to the model.',
  promptText: 'Walk me through the workspace in a short swipeable tour I can page with arrows.',
  surfaceId: TOUR_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TOUR_ID, catalogId: 'agent-ui', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: TOUR_ID, value: { tour: { active: 0 } } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TOUR_ID,
        components: [
          { id: 'root', component: 'Swiper', pagination: true, paddles: true, align: 'start', active: { path: '/tour/active' }, children: ['s1', 's2', 's3'] },
          { id: 's1', component: 'SwiperItem', children: ['s1_card'] },
          { id: 's1_card', component: 'Card', elevation: '1', children: ['s1_content'] },
          { id: 's1_content', component: 'CardContent', children: ['s1_title', 's1_body'] },
          { id: 's1_title', component: 'Text', variant: 'h5', text: 'Your inbox' },
          { id: 's1_body', component: 'Text', text: 'Everything assigned to you lands here first.' },
          { id: 's2', component: 'SwiperItem', children: ['s2_card'] },
          { id: 's2_card', component: 'Card', elevation: '1', children: ['s2_content'] },
          { id: 's2_content', component: 'CardContent', children: ['s2_title', 's2_body'] },
          { id: 's2_title', component: 'Text', variant: 'h5', text: 'Boards' },
          { id: 's2_body', component: 'Text', text: 'Drag work between stages; the timeline updates itself.' },
          { id: 's3', component: 'SwiperItem', children: ['s3_card'] },
          { id: 's3_card', component: 'Card', elevation: '1', children: ['s3_content'] },
          { id: 's3_content', component: 'CardContent', children: ['s3_title', 's3_body'] },
          { id: 's3_title', component: 'Text', variant: 'h5', text: 'Ask the agent' },
          { id: 's3_body', component: 'Text', text: 'Describe what you need — it builds the view for you.' },
        ],
      },
    },
  ],
}

const ROUND_ID = 'frontier-round-outcome'
/** Frontier 5 — the TOAST family (GH #1184, Kim ruling 2026-08-17: ephemeral outcome announcements are
 *  Toasts, not Badges): a blackjack round's settled state on one persistent surface — hand totals as
 *  Stats, the round RESULT as a self-expiring Toast rendered inline where the payload places it (the
 *  catalogued half of the toast family; `ToastRegion`/`show()` stay app chrome), and the one next action
 *  as a Button. `label` is the adopted message text (connect-time, non-bindable by design); `duration`
 *  is explicit so the transient contract is visible in the payload. */
export const roundOutcomeToastSeed: ExampleSeed = {
  name: 'frontier-round-outcome',
  description: 'A settled blackjack round — hand totals as Stats, the ephemeral result announced by an inline Toast (label/urgent/duration), and one Next-round action Button.',
  promptText: 'The dealer drew to 19 against my 17 — settle the round and let me deal the next one.',
  surfaceId: ROUND_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ROUND_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ROUND_ID,
        value: { round: { player: 17, dealer: 19, chips: 240 } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ROUND_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['totals', 'outcome', 'controls'] },
          { id: 'totals', component: 'Row', gap: 'md', children: ['stat_you', 'stat_dealer', 'stat_chips'] },
          { id: 'stat_you', component: 'Stat', label: 'You', value: { path: '/round/player' } },
          { id: 'stat_dealer', component: 'Stat', label: 'Dealer', value: { path: '/round/dealer' } },
          { id: 'stat_chips', component: 'Stat', label: 'Chips', value: { path: '/round/chips' }, delta: -20 },
          { id: 'outcome', component: 'Toast', label: 'Dealer wins — 19 beats 17.', duration: 6000 },
          { id: 'controls', component: 'Row', gap: 'md', justify: 'end', children: ['btn_next'] },
          { id: 'btn_next', component: 'Button', variant: 'solid', label: 'Deal next round', action: { action: 'next_round' } },
        ],
      },
    },
  ],
}

const RECEIPT_ID = 'frontier-booking-receipt'
/** Frontier 6 — the DESCRIPTION-LIST receipt (ADR-0201, GH #1185: the key–value receipt primitive the
 *  GH #1174 grammar composition pattern was written to be superseded by): a confirm-step booking summary
 *  as ONE `DescriptionList` node — `rows` BOUND to the data model (an amend-answer turn updates the
 *  receipt in place, never re-emits the tree), values arriving HUMANIZED from the producer ("Included",
 *  never `true`; "Deluxe King", never `deluxe-king`) — plus the single commit Button the grammar's
 *  confirm-before-concluding law mandates. Contrast `receipt-order-summary` (a List of templated line
 *  items — an itemized COLLECTION); this is the flat label/value RECORD shape. */
export const bookingReceiptSeed: ExampleSeed = {
  name: 'frontier-booking-receipt',
  description: 'A confirm-step booking receipt — one DescriptionList with data-bound humanized rows (label secondary, value adjacent; a valueless field never renders) and the single Confirm-booking commit Button.',
  promptText: 'That all works for me — show me the booking summary so I can confirm it.',
  surfaceId: RECEIPT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: RECEIPT_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: RECEIPT_ID,
        value: {
          booking: {
            rows: [
              { label: 'Room', value: 'Deluxe King' },
              { label: 'Check-in', value: 'Fri, Aug 21' },
              { label: 'Nights', value: 3 },
              { label: 'Guests', value: 2 },
              { label: 'Breakfast', value: 'Included' },
              { label: 'Total', value: '$412.00' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: RECEIPT_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'receipt', 'controls'] },
          { id: 'heading', component: 'Text', variant: 'h4', text: 'Booking summary' },
          { id: 'receipt', component: 'DescriptionList', rows: { path: '/booking/rows' } },
          { id: 'controls', component: 'Row', gap: 'md', justify: 'end', children: ['btn_confirm'] },
          { id: 'btn_confirm', component: 'Button', variant: 'solid', label: 'Confirm booking', action: { action: 'confirm_booking' } },
        ],
      },
    },
  ],
}

const LISTING_ID = 'frontier-hero-listing'
/** Frontier 7 — the IMAGE content primitive (GH #1189 R1/R2, conventional component admission): a
 *  property-listing Card whose hero `Image` reserves its `aspect-ratio` box BEFORE any pixel loads —
 *  zero CLS, R1, proven end-to-end through the real catalog/renderer path (the shared-validator +
 *  render-smoke gate below, plus `usageHint="hero"` wiring the LCP-priority loading defaults,
 *  loading=eager/fetchpriority=high) — carrying a default-slotted `Text` caption pinned over its bottom
 *  scrim (R2). `src` is data-bound (an amend-answer turn can swap the photo in place); `alt` is a static
 *  literal (the producer-authored accessible name — image.md's "REQUIRED in spirit" contract, now
 *  admission-enforced by the catalog's `PropDef.required`, catalog.ts). Below the hero the card follows the
 *  card-anatomy clause (grammar.md, req-a2ui-patterns.md R1 — a2ui-payload.md P9, folded into the corpus
 *  rubric's D1 by GH #1262): `CardContent` carries the substance (the bound title ONLY) and `CardFooter`
 *  is THE action row (the one solid View-listing Button) — never a Button loose in content. The 1.1-era
 *  shape (title + Button side by side in a `CardContent` Row, no footer) read P9 = 2 and was re-admitted
 *  in this footer shape via `import-seeds --replace` (ADR-0068's judged quarantine exit). A single-fact
 *  card, so it omits `CardHeader` entirely rather than shipping an empty one — the hero Image is media,
 *  not identity, and rides its own placement per the clause's media carve-out. */
export const heroListingCardSeed: ExampleSeed = {
  name: 'frontier-image-hero-card',
  description: 'A property-listing Card with a hero Image (usageHint="hero", zero-CLS aspect box, R1) carrying a default-slotted caption over its bottom scrim (R2), a bound title in CardContent, and the single View-listing Button in CardFooter (card-anatomy law, R1/P9).',
  promptText: 'Show this listing as a card with a big photo up top, its title below, and a view button.',
  surfaceId: LISTING_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: LISTING_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: LISTING_ID,
        value: { listing: { photo: '/photos/harbor-view-loft.jpg', title: 'Harbor View Loft — $310/night' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: LISTING_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hero', 'body', 'foot'] },
          {
            id: 'hero', component: 'Image', src: { path: '/listing/photo' },
            alt: 'Harbor View Loft, exterior at sunset', aspect: '16/9', usageHint: 'hero',
            children: ['hero_caption'],
          },
          { id: 'hero_caption', component: 'Text', text: 'Harbor View Loft — exterior at sunset' },
          { id: 'body', component: 'CardContent', children: ['body_title'] },
          { id: 'body_title', component: 'Text', variant: 'h5', text: { path: '/listing/title' } },
          { id: 'foot', component: 'CardFooter', children: ['btn_view'] },
          { id: 'btn_view', component: 'Button', variant: 'solid', label: 'View listing', action: { action: 'view_listing' } },
        ],
      },
    },
  ],
}

const ASK_ID = 'ask-1'
/** Frontier 8 — the CARD-ANATOMY law (GH #1199, req-a2ui-patterns.md R1): the canonical three-slot ask
 *  card, header/content/footer each doing exactly one job — CardHeader carries ONLY the identity title
 *  (a label Text, never a control), CardContent carries the Field-wrapped RadioGroup choice, and
 *  CardFooter carries the ONE commit Button — never a Button loose in content alongside a populated
 *  footer, and never a control inside the header. This is the grammar.md card-anatomy clause's worked
 *  feed-ask sketch (R1), realized as a corpus exemplar so the law has a real, validated, renderable
 *  instance on the shelf, not only prose — with two repairs over the source doc's sketch (the GH #1262
 *  P7 reconciliation, Kim take-up 2026-08-18): the RadioGroup rides a Field wrap (a2ui-payload.md P7 —
 *  the catalog RadioGroup declares no label prop, and only the Field wrap wires a programmatic group
 *  name through the shipped ADR-0051 labelling seam; a CardHeader Text is adjacent, never associated),
 *  and the promptText is user-voiced (the judged wave's recorded D2 repair). */
export const cardAnatomyAskSeed: ExampleSeed = {
  name: 'frontier-card-anatomy-ask',
  description: 'A three-slot ask card demonstrating card-anatomy law (R1): CardHeader carries only the identity title, CardContent carries the Field-wrapped RadioGroup choice, CardFooter carries the single commit Button.',
  promptText: 'I need to pick a room type for my stay — Standard (€180) or the Deluxe King (€240).',
  surfaceId: ASK_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ASK_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ASK_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'label', text: 'Pick a room' },
          { id: 'ct', component: 'CardContent', children: ['f_room'] },
          { id: 'f_room', component: 'Field', label: 'Room type', child: 'rooms' },
          { id: 'rooms', component: 'RadioGroup', value: { path: '/room' }, children: ['r1', 'r2'] },
          { id: 'r1', component: 'Radio', value: 'standard', label: 'Standard · €180' },
          { id: 'r2', component: 'Radio', value: 'deluxe', label: 'Deluxe King · €240' },
          { id: 'ft', component: 'CardFooter', children: ['go'] },
          { id: 'go', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'pick_room' } },
        ],
      },
    },
    { version: 'v1.0', updateDataModel: { surfaceId: ASK_ID, value: { room: 'deluxe' } } },
  ],
}

const WIZARD_ID = 'ask-1'
/** Frontier 9 — the BACKABLE MULTI-STEP wizard (GH #1192, req-a2ui-patterns.md R2 / ADR-0198's 2026-08-18
 *  amendment B1), repaired to grammar.md's CardFooter clause (the GH #1262 rulings pass, #1320 — the
 *  seed's original loose-Row nav buttons contradicted it, flagged for this follow-up repair): ONE ask
 *  surface for the WHOLE flow (posture (i), grammar.md's backable-multi-step clause) — dates → room →
 *  confirm, Back always free because nothing is committed until the flow-final confirm. Root is delivered
 *  ONCE as the stable wrapper ("root", never resent); the Card itself is non-root ("card"), one level
 *  down, card-anatomy in force on every step: CardContent ("ct", stable — its own children list never
 *  changes) holds the growing "scene" subtree, and CardFooter ("ft") carries the per-step nav Buttons
 *  under its OWN id, resent alongside "scene" whenever the step's buttons change — never a nav Button
 *  loose in the scene. Every Next/Back turn resends ONLY "scene" + "ft" (never root/card/ct — the
 *  root-immutability rule). Every answer lives under the shared "/draft/*" data-model prefix, seeded once
 *  at scene 1 and never rewritten by a scene swap — so the bound Calendar/RadioGroup re-render the SAME
 *  still-present draft values when Back returns to an earlier scene: the worked round-trip below goes
 *  dates → room → BACK to dates (still showing the chosen range) → forward to room again (still showing
 *  the chosen room) → confirm. The confirm scene's receipt rides the CURRENT law's DescriptionList
 *  primitive (ADR-0201). Every mid-flow Next/Back turn here is a scene transition on this ONE still-open
 *  ask, never an answered ask (B1's carve-out) — "ask-1" is declared exactly once, on turn 1, and never
 *  re-declared. "rooms" (RadioGroup) is built WITHOUT its value binding, wired in a SEPARATE immediately-
 *  following resend (radioGroupFactory's documented mount-order limitation: a value bound in the SAME
 *  batch that also creates its Radio children races ahead of them and clears the selection instead of
 *  reading it back) — proven by the real-renderer round-trip test, `backable-wizard.test.ts`. Repaired
 *  again for the sole ground a fresh judge sustained on this seed (GH #1262 second pass, a2ui-payload.md
 *  P7): "cal" and "rooms" ship with NO accessible name of their own — the catalog declares no label prop
 *  on either — so each rides an ADR-0051 Field wrap, the only naming path: "f_dates" (label "Check-in —
 *  check-out", the booking-reservation precedent, catalog-coverage.ts) and "f_room" (label "Room type",
 *  the frontier-card-anatomy-ask precedent, above). Both wraps are scene-local, exactly like "cal"/
 *  "rooms" themselves — resent with "scene" on every occurrence of each control (turn 1's dates scene AND
 *  the BACK-to-dates resend; turn 2's room scene AND the forward-again resend) — never touching root/
 *  card/ct. */
export const backableWizardSeed: ExampleSeed = {
  name: 'backable-wizard',
  description: 'A 3-step backable wizard (dates → room → confirm) on ONE ask surface: draft answers under /draft/*, a stable root>Card>CardContent scene container swapped by updateComponents, per-step nav Buttons in their own CardFooter, Field-wrapped Calendar/RadioGroup controls (ADR-0051), and a BACK round-trip that leaves both prior answers untouched.',
  promptText: 'Let\'s book a stay — start with the dates, then I\'ll pick a room, and I can always go back to change something before I confirm.',
  surfaceId: WIZARD_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // turn 1 — create + scene 1 (dates): root delivered ONCE as the stable wrapper, one level above the
    // non-root Card ("card"); CardContent ("ct") and CardFooter ("ft") are the Card's two fixed children
    // (card-anatomy) — "ct" is stable (its own children list never changes), "ft" is resent alongside
    // "scene" whenever the step's buttons change. The whole draft is seeded up front (ADR-0126 whole-record
    // idiom) so every path a later scene binds already exists in the data model. The Calendar rides a
    // Field wrap ("f_dates") — its own catalog row declares no label prop, so the Field is the only
    // accessible-name path (ADR-0051, a2ui-payload.md P7).
    { version: 'v1.0', createSurface: { surfaceId: WIZARD_ID, catalogId: 'agent-ui', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: WIZARD_ID, value: { draft: { from: '', to: '', room: 'deluxe' } } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['ct', 'ft'] },
          { id: 'ct', component: 'CardContent', children: ['scene'] },
          { id: 'scene', component: 'Column', gap: 'md', children: ['f_dates'] },
          { id: 'f_dates', component: 'Field', label: 'Check-in — check-out', child: 'cal' },
          { id: 'cal', component: 'Calendar', mode: 'range', valueStart: { path: '/draft/from' }, valueEnd: { path: '/draft/to' } },
          { id: 'ft', component: 'CardFooter', children: ['next1'] },
          { id: 'next1', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'step', context: { to: 'room' } } },
        ],
      },
    },

    // the user picked a range and hit Continue — the committed range lands in the draft (a real client
    // round-trip writes this via the Calendar's own two-way bind; scripted here to prove the mechanic):
    { version: 'v1.0', updateDataModel: { surfaceId: WIZARD_ID, path: '/draft/from', value: '2026-08-21' } },
    { version: 'v1.0', updateDataModel: { surfaceId: WIZARD_ID, path: '/draft/to', value: '2026-08-24' } },

    // turn 2 — scene 2 (room): "scene" AND "ft" are resent TOGETHER (never root/card/ct); /draft/from,
    // /draft/to stay in the data model, untouched underneath. A ghost Back joins the solid Continue in the
    // CardFooter (the nav-row law, R2, satisfied via CardFooter per grammar.md's CardFooter clause). The
    // RadioGroup rides a Field wrap ("f_room") for the same P7 reason as "f_dates" above. "rooms"
    // mounts WITHOUT its "value" binding here, on purpose (radioGroupFactory's documented limitation:
    // RadioGroup.value applies at MOUNT time, before its just-declared Radio children exist in the light DOM
    // yet, so a value bound in the SAME batch that also creates those children silently clears the selection
    // instead of reading it back) — the binding is wired in a SEPARATE resend below, once "r1"/"r2" already
    // exist, so the reconcile-props path (not the fresh-mount path) applies it.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'scene', component: 'Column', gap: 'md', children: ['f_room'] },
          { id: 'f_room', component: 'Field', label: 'Room type', child: 'rooms' },
          { id: 'rooms', component: 'RadioGroup', children: ['r1', 'r2'] },
          { id: 'r1', component: 'Radio', value: 'standard', label: 'Standard · €180' },
          { id: 'r2', component: 'Radio', value: 'deluxe', label: 'Deluxe King · €240' },
          { id: 'ft', component: 'CardFooter', children: ['back2', 'next2'] },
          { id: 'back2', component: 'Button', variant: 'ghost', label: 'Back', action: { action: 'step', context: { to: 'dates' } } },
          { id: 'next2', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'step', context: { to: 'confirm' } } },
        ],
      },
    },
    // wire the value binding now that "r1"/"r2" are mounted: same children list (never touched, no
    // dispose/remount), only "rooms"'s own props differ from its previous record — a genuine prop
    // reconcile (RSR-C6), not a fresh mount, so the read finds its Radio children already present.
    { version: 'v1.0', updateComponents: { surfaceId: WIZARD_ID, components: [{ id: 'rooms', component: 'RadioGroup', value: { path: '/draft/room' }, children: ['r1', 'r2'] }] } },

    // BACK from room to dates: "scene" + "ft" swap to the dates shape again — IDENTICAL to turn 1's tree
    // (the SAME "f_dates" Field wrap). /draft/from and /draft/to are STILL "2026-08-21"/"2026-08-24" (this
    // update never touches them), so the re-bound Calendar shows the range already chosen — the round-trip
    // B1's carve-out exists for.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'scene', component: 'Column', gap: 'md', children: ['f_dates'] },
          { id: 'f_dates', component: 'Field', label: 'Check-in — check-out', child: 'cal' },
          { id: 'cal', component: 'Calendar', mode: 'range', valueStart: { path: '/draft/from' }, valueEnd: { path: '/draft/to' } },
          { id: 'ft', component: 'CardFooter', children: ['next1'] },
          { id: 'next1', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'step', context: { to: 'room' } } },
        ],
      },
    },

    // forward again to room — the SAME scene-2 tree (the SAME "f_room" Field wrap), built the SAME
    // two-step way (a fresh "rooms" mount here — the earlier one was disposed by the BACK swap — races its
    // Radio children again too); /draft/room is STILL "deluxe" (the value already committed before the
    // detour), the second half of the round-trip proof.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'scene', component: 'Column', gap: 'md', children: ['f_room'] },
          { id: 'f_room', component: 'Field', label: 'Room type', child: 'rooms' },
          { id: 'rooms', component: 'RadioGroup', children: ['r1', 'r2'] },
          { id: 'r1', component: 'Radio', value: 'standard', label: 'Standard · €180' },
          { id: 'r2', component: 'Radio', value: 'deluxe', label: 'Deluxe King · €240' },
          { id: 'ft', component: 'CardFooter', children: ['back2', 'next2'] },
          { id: 'back2', component: 'Button', variant: 'ghost', label: 'Back', action: { action: 'step', context: { to: 'dates' } } },
          { id: 'next2', component: 'Button', variant: 'solid', label: 'Continue', action: { action: 'step', context: { to: 'confirm' } } },
        ],
      },
    },
    { version: 'v1.0', updateComponents: { surfaceId: WIZARD_ID, components: [{ id: 'rooms', component: 'RadioGroup', value: { path: '/draft/room' }, children: ['r1', 'r2'] }] } },

    // the user confirmed the room and hit Continue — the receipt rows land in the draft (humanized,
    // adjacent label/value per the receipt clause):
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WIZARD_ID,
        path: '/draft/rows',
        value: [
          { label: 'Dates', value: '21–24 Aug · 3 nights' },
          { label: 'Room', value: 'Deluxe King · €240/night' },
        ],
      },
    },

    // turn 3 — confirm scene: the RECEIPT, current law's DescriptionList primitive (ADR-0201), plus the
    // flow-final commit Button in the CardFooter (grammar's confirm-before-concluding law). Still the SAME
    // ask surface — the flow-final confirm on THIS turn is what starts the answered-ask freeze (B1); every
    // turn before it was a scene transition, never an answered ask.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'scene', component: 'Column', gap: 'md', children: ['rcpt'] },
          { id: 'rcpt', component: 'DescriptionList', rows: { path: '/draft/rows' } },
          { id: 'ft', component: 'CardFooter', children: ['back3', 'commit'] },
          { id: 'back3', component: 'Button', variant: 'ghost', label: 'Back', action: { action: 'step', context: { to: 'room' } } },
          { id: 'commit', component: 'Button', variant: 'solid', label: 'Confirm booking', action: { action: 'commit' } },
        ],
      },
    },
  ],
}

const GREET_ID = 'greet-1'
/** Frontier 10 — the GREET CARD (GH #1201, req-a2ui-patterns R3): a persona's opening bookend. The
 *  first turn's note introduces the persona; alongside it, ONE compact starter card — CardContent's
 *  orientation Text plus a CardFooter of 2–4 Buttons whose `action.context` names a concrete starter
 *  intent. NOT an ask despite riding the meta-line `ask` field for feed placement: the reserved
 *  `greet-1` id class (grammar.md's reserved-vocabulary sentence + the `greeting-card` mini-skill) —
 *  no commit button, no data model (`sendDataModel` omitted), no `ask-<n>` id consumed, and the
 *  answered-ask freeze never applies (a greet is never an answered ask; its buttons are retired per
 *  the stale-affordance rule when the first real task starts). */
export const greetCardSeed: ExampleSeed = {
  name: 'frontier-greet-card',
  description: 'A persona\'s opening greet card — reserved greet-1 surface (not an ask: no commit button, no data model), an orientation Text and 2–4 starter-intent Buttons carrying concrete intents in action.context, retired when the first real task starts.',
  promptText: 'Hi — who are you and what can you do?',
  surfaceId: GREET_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: GREET_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: GREET_ID,
        components: [
          { id: 'root', component: 'Card', children: ['ct', 'ft'] },
          { id: 'ct', component: 'CardContent', children: ['t'] },
          { id: 't', component: 'Text', variant: 'body', text: 'What would you like to do?' },
          { id: 'ft', component: 'CardFooter', children: ['b1', 'b2', 'b3'] },
          { id: 'b1', component: 'Button', variant: 'solid', label: 'Book a room', action: { action: 'start', context: { intent: 'room' } } },
          { id: 'b2', component: 'Button', label: 'Reserve a table', action: { action: 'start', context: { intent: 'table' } } },
          { id: 'b3', component: 'Button', variant: 'ghost', label: 'Just a question', action: { action: 'start', context: { intent: 'faq' } } },
        ],
      },
    },
  ],
}

const LATENCY_ID = 'frontier-latency-line-chart'
/** Frontier 11 — the LINE-CHART family (ADR-0205, GH #1207): the fleet's first axis-bearing chart —
 *  a monitoring card whose body is ONE `LineChart` bound to a p50-latency series (the baseline + always-
 *  shown min/max labels ADR-0205 cl.1/cl.3 mandate), with a caption reading the current point count back
 *  from the SAME bound array via `@index`/length-style prose (kept as a static caption here — the default
 *  catalog's binding grammar has no array-length function, so the count is authored prose, not derived). */
export const latencyLineChartSeed: ExampleSeed = {
  name: 'frontier-latency-line-chart',
  description: 'A latency monitoring Card — a LineChart trend bound to the data model (baseline + always-shown min/max labels, ADR-0205), with a caption and one Refresh action.',
  promptText: 'Show p50 latency over the last few minutes as a line chart with the low and high called out.',
  surfaceId: LATENCY_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: LATENCY_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: LATENCY_ID,
        value: { latency: { trend: [42, 38, 55, 47, 61, 44, 39] } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: LATENCY_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['hd_title'] },
          { id: 'hd_title', component: 'Text', variant: 'h5', text: 'p50 latency (ms)' },
          { id: 'ct', component: 'CardContent', children: ['chart', 'caption'] },
          { id: 'chart', component: 'LineChart', values: { path: '/latency/trend' }, label: 'p50 latency, last 7 samples' },
          { id: 'caption', component: 'Text', variant: 'caption', text: 'Sampled every 30s.' },
          { id: 'ft', component: 'CardFooter', children: ['btn_refresh'] },
          { id: 'btn_refresh', component: 'Button', variant: 'ghost', label: 'Refresh', action: { action: 'refresh_latency' } },
        ],
      },
    },
  ],
}

const MEDIA_TOUR_ID = 'frontier-media-tour'
/** Frontier 12 — the MEDIA PLAYERS (GH #1209, the A2UI standard basic-catalog's Video/AudioPlayer realized
 *  as native players): a guided-tour card pairing a Video (reserved 16/9 box, poster, native controls — no
 *  custom chrome, the control's own fence) with an AudioPlayer welcome message — both label-carrying (the
 *  Image `alt` admission discipline applied to media: `label` is required at the catalog layer). */
export const mediaTourSeed: ExampleSeed = {
  name: 'frontier-media-tour',
  description: 'A guided-tour Card with a Video walkthrough (poster, reserved aspect box, native controls) and an AudioPlayer welcome message — the GH #1209 media pair, labels required.',
  promptText: 'Show the apartment tour video with the host welcome audio under it.',
  surfaceId: MEDIA_TOUR_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: MEDIA_TOUR_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: MEDIA_TOUR_ID,
        value: { tour: { video: '/media/alfama-tour.mp4', poster: '/media/alfama-tour-poster.jpg', welcome: '/media/welcome-maria.mp3' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: MEDIA_TOUR_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['head', 'body'] },
          { id: 'head', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'label', text: 'Alfama apartment — guided tour' },
          { id: 'body', component: 'CardContent', children: ['walkthrough', 'welcome_row'] },
          {
            id: 'walkthrough', component: 'Video', src: { path: '/tour/video' },
            poster: { path: '/tour/poster' }, aspect: '16/9', preload: 'metadata',
            label: 'Video walkthrough of the Alfama apartment',
          },
          { id: 'welcome_row', component: 'Row', gap: 'sm', align: 'center', children: ['welcome_text', 'welcome_audio'] },
          { id: 'welcome_text', component: 'Text', variant: 'body', text: 'A welcome message from your host, Maria:' },
          {
            id: 'welcome_audio', component: 'AudioPlayer', src: { path: '/tour/welcome' },
            preload: 'metadata', label: 'Welcome message from your host, Maria',
          },
        ],
      },
    },
  ],
}

export const catalogFrontierSeeds: readonly ExampleSeed[] = [tripCardSeed, inviteModalSeed, reviewSplitSeed, onboardingTourSeed, roundOutcomeToastSeed, bookingReceiptSeed, heroListingCardSeed, cardAnatomyAskSeed, backableWizardSeed, greetCardSeed, latencyLineChartSeed, mediaTourSeed]
