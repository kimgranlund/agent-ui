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

export const catalogFrontierSeeds: readonly ExampleSeed[] = [tripCardSeed, inviteModalSeed, reviewSplitSeed, onboardingTourSeed]
