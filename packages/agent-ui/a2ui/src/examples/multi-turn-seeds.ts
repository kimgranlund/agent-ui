// multi-turn-seeds.ts: the first two `multi-turn` corpus seeds (ADR-0231 cl.2, GH #1741, Kim's GH #1730
// ruling). Each seed is one conversation step on ONE live surface: turn 1 (`priorMessages`) puts a UI on
// screen, the user takes one action on it (`action`, the exact envelope the renderer's `emitAction` sends),
// and the follow-up (`messages`) updates that same surface in place. Neither follow-up resends `root` and
// neither deletes the surface: a delete-then-recreate follow-up waits for the id-graph reset slice
// (ADR-0231 cl.2 ordering bullet, GH #1750).
//
// The two ruled shapes:
// 1. A form submit. The submit Button carries `submit:true` (the FormProvider gate, ADR-0054) and the
//    surface sets `sendDataModel:true`, so the action carries the filled-in model back. The follow-up
//    echoes the submitted values through the status line's binding, and the submit Button's `disabled`
//    binding flips with the same data write; the one structural change is the new "Add to calendar"
//    action the confirmed state earns in the footer row.
// 2. A list item select. The order rows are a `{path, componentId}` template; each row Button's action
//    context binds the item-relative `id`, so the emitted context carries the clicked order's id (the
//    item-scope resolution, GH #1748). The follow-up delivers the selected order's data and swaps the
//    detail column's placeholder for the detail rows plus a "Track package" action.
//
// Corpus seeds only (never `allSeeds`, never a site page): imported by `tools/corpus/import-seeds.ts`
// into `corpus/multi-turn/v1_0/agent-ui.jsonl`.

import type { MultiTurnSeed } from './types.ts'

const RSVP_ID = 'rsvp'

export const rsvpFormSubmitSeed: MultiTurnSeed = {
  name: 'mt-rsvp-form-submit',
  description:
    'Answer an RSVP form submit on the live card: one updateDataModel write at /status echoes the submitted ' +
    'name and party size in the bound status line and flips the bound disabled flag on the Send RSVP button, ' +
    'and one updateComponents resends only the footer action row to add an Add to calendar button. No root ' +
    'resend, no field touched.',
  promptText:
    'I just filled in my name, two guests and a vegetarian note on the offsite dinner RSVP card and pressed ' +
    'Send RSVP. Confirm it on the card and let me add the dinner to my calendar.',
  surfaceId: RSVP_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  priorMessages: [
    { version: 'v1.0', createSurface: { surfaceId: RSVP_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: RSVP_ID,
        value: {
          rsvp: { name: '', guests: '1', diet: '' },
          status: { text: 'Seats are held until Friday.', sent: false },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: RSVP_ID,
        components: [
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', children: ['card_header', 'card_content', 'card_footer'] },
          { id: 'card_header', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Team offsite dinner, 14 November' },
          { id: 'card_content', component: 'CardContent', children: ['fields'] },
          { id: 'fields', component: 'Column', gap: 'md', children: ['f_name', 'f_guests', 'f_diet', 'status_line'] },
          { id: 'f_name', component: 'Field', label: 'Your name', child: 'in_name' },
          {
            id: 'in_name', component: 'TextField', name: 'name', required: true, value: { path: '/rsvp/name' },
            checks: [{ call: 'required', args: { value: { path: '/rsvp/name' } }, message: 'Name is required' }],
          },
          { id: 'f_guests', component: 'Field', label: 'Guests, including you', child: 'in_guests' },
          { id: 'in_guests', component: 'TextField', name: 'guests', type: 'number', min: '1', max: '4', step: 1, value: { path: '/rsvp/guests' } },
          { id: 'f_diet', component: 'Field', label: 'Dietary needs', child: 'in_diet' },
          { id: 'in_diet', component: 'Textarea', name: 'diet', rows: 2, value: { path: '/rsvp/diet' } },
          { id: 'status_line', component: 'Text', variant: 'caption', text: { path: '/status/text' } },
          { id: 'card_footer', component: 'CardFooter', children: ['actions'] },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_rsvp'] },
          {
            id: 'btn_rsvp', component: 'Button', variant: 'solid', label: 'Send RSVP', disabled: { path: '/status/sent' },
            action: { action: 'submit_rsvp', submit: true },
          },
        ],
      },
    },
  ],
  action: {
    version: 'v1.0',
    action: {
      surfaceId: RSVP_ID,
      actionId: 'act-7f3a91',
      name: 'submit_rsvp',
      sourceComponentId: 'btn_rsvp',
      timestamp: '2026-10-04T16:12:08.000Z',
      context: {},
      dataModel: {
        rsvp: { name: 'Priya Natarajan', guests: '2', diet: 'One vegetarian' },
        status: { text: 'Seats are held until Friday.', sent: false },
      },
    },
  },
  messages: [
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: RSVP_ID,
        path: '/status',
        value: { text: 'RSVP received for Priya Natarajan, party of 2, one vegetarian meal noted.', sent: true },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: RSVP_ID,
        components: [
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_calendar', 'btn_rsvp'] },
          { id: 'btn_calendar', component: 'Button', variant: 'soft', label: 'Add to calendar', action: { action: 'add_to_calendar', context: { event: 'offsite-dinner-1114' } } },
        ],
      },
    },
  ],
}

const ORDERS_ID = 'orders'

export const orderListSelectSeed: MultiTurnSeed = {
  name: 'mt-order-list-select',
  description:
    'Answer a list item select on a live order list: the clicked row of a {path, componentId} template ' +
    'sends its item-scoped orderId, and the follow-up writes that order to /selected with updateDataModel, ' +
    'then resends only the detail column so its placeholder gives way to a title, a DescriptionList of the ' +
    'order fields and an action row with a Track package button. The list and root stay untouched.',
  promptText:
    'On my recent orders list I clicked order A-1042, the noise-cancelling headphones. Show me its status, ' +
    'delivery date and where it is shipping, next to the list.',
  surfaceId: ORDERS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  priorMessages: [
    { version: 'v1.0', createSurface: { surfaceId: ORDERS_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ORDERS_ID,
        value: {
          orders: [
            { id: 'A-1042', item: 'Noise-cancelling headphones', placed: '28 Sep' },
            { id: 'A-1039', item: 'USB-C dock', placed: '21 Sep' },
            { id: 'A-1031', item: 'Desk lamp', placed: '9 Sep' },
          ],
          detail: { hint: 'Select an order to see its delivery details.' },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ORDERS_ID,
        components: [
          { id: 'root', component: 'Row', gap: 'lg', align: 'start', children: ['list_col', 'detail_col'] },
          { id: 'list_col', component: 'Column', gap: 'sm', children: ['list_title', 'order_list'] },
          { id: 'list_title', component: 'Text', variant: 'h4', text: 'Recent orders' },
          { id: 'order_list', component: 'List', gap: 'xs', children: { path: '/orders', componentId: 'order_row' } },
          {
            id: 'order_row', component: 'Button', variant: 'ghost', label: '${id}: ${item}, placed ${placed}',
            action: { action: 'select_order', context: { orderId: { path: 'id' } } },
          },
          { id: 'detail_col', component: 'Column', gap: 'sm', children: ['detail_hint'] },
          { id: 'detail_hint', component: 'Text', variant: 'caption', text: { path: '/detail/hint' } },
        ],
      },
    },
  ],
  action: {
    version: 'v1.0',
    action: {
      surfaceId: ORDERS_ID,
      actionId: 'act-2c84d0',
      name: 'select_order',
      sourceComponentId: 'order_row',
      timestamp: '2026-10-04T16:20:41.000Z',
      context: { orderId: 'A-1042' },
    },
  },
  messages: [
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ORDERS_ID,
        path: '/selected',
        value: {
          title: 'A-1042, Noise-cancelling headphones',
          rows: [
            { label: 'Status', value: 'Shipped' },
            { label: 'Estimated delivery', value: 'Tue 7 Oct' },
            { label: 'Carrier', value: 'DHL Express' },
            { label: 'Ship to', value: 'Keizersgracht 221, Amsterdam' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ORDERS_ID,
        components: [
          { id: 'detail_col', component: 'Column', gap: 'sm', children: ['detail_title', 'detail_rows', 'detail_actions'] },
          { id: 'detail_title', component: 'Text', variant: 'h5', text: { path: '/selected/title' } },
          { id: 'detail_rows', component: 'DescriptionList', rows: { path: '/selected/rows' } },
          { id: 'detail_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_track'] },
          { id: 'btn_track', component: 'Button', variant: 'soft', label: 'Track package', action: { action: 'track_order', context: { orderId: 'A-1042' } } },
        ],
      },
    },
  ],
}

/** Every seed this module defines, the family-array precedent (`index.ts` composes `allMultiTurnSeeds`
 *  from it, never a hand-counted literal). */
export const multiTurnSeeds: readonly MultiTurnSeed[] = [rsvpFormSubmitSeed, orderListSelectSeed]
