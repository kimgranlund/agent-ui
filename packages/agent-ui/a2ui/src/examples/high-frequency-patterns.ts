// high-frequency-patterns.ts — GH #972's owner-approved gap map (2026-08-15 audit): five high-frequency
// chat-feed patterns the 29-record corpus lacked judged exemplars for. Each seed binds LIVE data-model
// paths for its varying content (never static text standing in for what a real agent would template) —
// the "dead data" defect class named at intake (2026-08-13 board-zero run): `updateDataModel` carries
// `value:`, and every element that differs per instance is a `{path}`/`${…}` binding, not a literal.
//
// (1) COMPARISON/PRICING TABLE — a Grid of plan-price `Stat` tiles (the Grid-of-tile templating idiom,
//     applied to plans instead of metrics) above a feature-by-feature `Table`, both templated
//     over the data model. Covers: the comparison-table shape (Grid-of-Stat + Table combined in one card).
// (2) RECEIPT/ORDER-SUMMARY CARD — a `List` of line items templated over `/order/items`, then a
//     subtotal/tax/total breakdown — the receipt idiom no prior seed exercises.
// (3) ERROR-STATE CARD WITH RETRY — a warning `Icon`, a data-bound failure message, and a Retry `Button`.
// (4) NOTIFICATION/STATUS-CHIP STACK — status `Badge`s templated over `/notifications`, a TRANSIENT list
//     distinct from `agentTaskStatusSeed`'s persistent single-card panel (catalog-coverage.ts).
// (5) MULTI-FILE/IMAGE MEDIA GRID — `Attachment` cards templated over `/files` on a track `Grid` (the
//     same Grid-of-tile templating idiom again, applied to files instead of metrics or plans).

import type { ExampleSeed } from './types.ts'

const COMPARE_ID = 'comparison-pricing'
export const comparisonPricingSeed: ExampleSeed = {
  name: 'comparison-pricing-table',
  description:
    'A plan comparison card — a Grid of plan-price Stat tiles above a feature-by-feature Table, both templated over the data model.',
  promptText: 'Show a pricing comparison: our three plans with their price, and a table comparing what each plan includes.',
  surfaceId: COMPARE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: COMPARE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: COMPARE_ID,
        value: {
          plans: [
            { name: 'Starter', price: '$12/mo' },
            { name: 'Growth', price: '$39/mo' },
            { name: 'Scale', price: '$129/mo' },
          ],
          features: [
            { feature: 'Seats included', starter: '3', growth: '10', scale: 'Unlimited' },
            { feature: 'API requests / mo', starter: '10,000', growth: '100,000', scale: '1,000,000' },
            { feature: 'Priority support', starter: '—', growth: '✓', scale: '✓' },
            { feature: 'Single sign-on', starter: '—', growth: '—', scale: '✓' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: COMPARE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'plans_grid', 'features_table'] },
          { id: 'title', component: 'Text', variant: 'h3', text: 'Compare plans' },
          // The plans: a track Grid of price Stat tiles (the Grid-of-tile templating idiom).
          { id: 'plans_grid', component: 'Grid', gap: 'md', min: '10rem', children: { path: '/plans', componentId: 'plan_tile' } },
          { id: 'plan_tile', component: 'Card', elevation: '0', children: ['plan_content'] },
          { id: 'plan_content', component: 'CardContent', children: ['plan_stat'] },
          { id: 'plan_stat', component: 'Stat', label: { path: 'name' }, value: { path: 'price' } },
          // The features: exact per-plan values scanned row-by-row (catalog SPEC §5.2 Notes guidance —
          // Table when exact values must be compared), rows bound live to the data model.
          {
            id: 'features_table', component: 'Table', label: 'Feature comparison',
            columns: [
              { key: 'feature', label: 'Feature', type: 'string' },
              { key: 'starter', label: 'Starter', type: 'string' },
              { key: 'growth', label: 'Growth', type: 'string' },
              { key: 'scale', label: 'Scale', type: 'string' },
            ],
            rows: { path: '/features' },
          },
        ],
      },
    },
  ],
}

const RECEIPT_ID = 'receipt-order-summary'
export const receiptOrderSummarySeed: ExampleSeed = {
  name: 'receipt-order-summary',
  description: 'An order-summary receipt card — a List of line items templated over the data model, then a subtotal/tax/total breakdown.',
  promptText: 'Show a receipt for my order: the line items with quantities and prices, then the subtotal, tax, and total.',
  surfaceId: RECEIPT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: RECEIPT_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: RECEIPT_ID,
        value: {
          order: {
            number: '1042',
            items: [
              { name: 'Wireless mouse', qty: 2, amount: '$58.00' },
              { name: 'USB-C hub', qty: 1, amount: '$34.00' },
              { name: 'Laptop sleeve', qty: 1, amount: '$22.00' },
            ],
            subtotal: '$114.00',
            tax: '$9.12',
            total: '$123.12',
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: RECEIPT_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'items_list', 'totals'] },
          // Absolute-path ${…} interpolation (a2ui-runtime SPEC-R10/AC2) — composed at the root, not
          // inside a list-template scope, the same mechanism dashboard tiles use relative to an item.
          { id: 'title', component: 'Text', variant: 'h4', text: 'Order #${/order/number}' },
          { id: 'items_list', component: 'List', gap: 'sm', children: { path: '/order/items', componentId: 'item_row' } },
          { id: 'item_row', component: 'Row', justify: 'between', children: ['item_desc', 'item_amount'] },
          { id: 'item_desc', component: 'Text', variant: 'body', text: '${qty} × ${name}' },
          { id: 'item_amount', component: 'Text', variant: 'body', text: { path: 'amount' } },
          { id: 'totals', component: 'Column', gap: 'xs', children: ['subtotal_row', 'tax_row', 'total_row'] },
          { id: 'subtotal_row', component: 'Row', justify: 'between', children: ['subtotal_label', 'subtotal_value'] },
          { id: 'subtotal_label', component: 'Text', variant: 'caption', text: 'Subtotal' },
          { id: 'subtotal_value', component: 'Text', variant: 'caption', text: { path: '/order/subtotal' } },
          { id: 'tax_row', component: 'Row', justify: 'between', children: ['tax_label', 'tax_value'] },
          { id: 'tax_label', component: 'Text', variant: 'caption', text: 'Tax' },
          { id: 'tax_value', component: 'Text', variant: 'caption', text: { path: '/order/tax' } },
          { id: 'total_row', component: 'Row', justify: 'between', children: ['total_label', 'total_value'] },
          { id: 'total_label', component: 'Text', variant: 'label', emphasis: true, text: 'Total' },
          { id: 'total_value', component: 'Text', variant: 'label', emphasis: true, text: { path: '/order/total' } },
        ],
      },
    },
  ],
}

const ERROR_ID = 'empty-error-retry'
export const emptyErrorRetryCardSeed: ExampleSeed = {
  name: 'empty-error-retry-card',
  description: 'An error-state card — a warning Icon, a data-bound failure message, and a Retry Button.',
  promptText: 'The activity feed failed to load — show an error state with a retry button.',
  surfaceId: ERROR_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ERROR_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ERROR_ID,
        value: {
          activity: {
            resource: 'recent activity',
            message: "We couldn't reach the server. Check your connection and try again.",
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ERROR_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['icon_row', 'body', 'actions'] },
          { id: 'icon_row', component: 'Row', gap: 'sm', align: 'center', children: ['icon', 'title'] },
          { id: 'icon', component: 'Icon', name: 'warning', label: 'Error' },
          // Absolute-path ${…} interpolation names WHAT failed to load — live, not a hand-baked string.
          { id: 'title', component: 'Text', variant: 'h4', text: "Couldn't load ${/activity/resource}" },
          { id: 'body', component: 'Text', variant: 'body', text: { path: '/activity/message' } },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_retry'] },
          {
            id: 'btn_retry', component: 'Button', variant: 'solid', label: 'Retry',
            action: { action: 'retry_load', context: { resource: 'activity' } },
          },
        ],
      },
    },
  ],
}

const NOTIF_ID = 'notification-status-stack'
export const notificationStatusStackSeed: ExampleSeed = {
  name: 'notification-status-stack',
  description: 'A transient notification stack — status Badges templated over the data model.',
  promptText: 'Show my recent notifications: an upload that finished, a sync that failed, and new messages waiting.',
  surfaceId: NOTIF_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: NOTIF_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: NOTIF_ID,
        value: {
          notifications: [
            { intent: 'success', label: 'Upload complete' },
            { intent: 'danger', label: 'Sync failed — retry needed' },
            { intent: 'info', label: '3 new messages' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: NOTIF_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'sm', children: { path: '/notifications', componentId: 'notif_badge' } },
          { id: 'notif_badge', component: 'Badge', intent: { path: 'intent' }, label: { path: 'label' } },
        ],
      },
    },
  ],
}

const MEDIA_ID = 'media-file-grid'
export const mediaFileGridSeed: ExampleSeed = {
  name: 'media-file-grid',
  description: 'A multi-file/image media grid — Attachment cards templated over the data model on a track Grid.',
  promptText: 'Show the files attached to this task: two images, a PDF, and a video clip.',
  surfaceId: MEDIA_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: MEDIA_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: MEDIA_ID,
        value: {
          files: [
            { name: 'diagram.png', mimeType: 'image/png', sizeBytes: 245000 },
            { name: 'site-photo.jpg', mimeType: 'image/jpeg', sizeBytes: 1820000 },
            { name: 'spec-notes.pdf', mimeType: 'application/pdf', sizeBytes: 98000 },
            { name: 'walkthrough.mp4', mimeType: 'video/mp4', sizeBytes: 5400000 },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: MEDIA_ID,
        components: [
          { id: 'root', component: 'Grid', gap: 'md', min: '10rem', children: { path: '/files', componentId: 'file_tile' } },
          {
            id: 'file_tile', component: 'Attachment',
            name: { path: 'name' }, mimeType: { path: 'mimeType' }, sizeBytes: { path: 'sizeBytes' },
          },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const highFrequencyPatternSeeds: readonly ExampleSeed[] = [
  comparisonPricingSeed,
  receiptOrderSummarySeed,
  emptyErrorRetryCardSeed,
  notificationStatusStackSeed,
  mediaFileGridSeed,
]
