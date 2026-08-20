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
//
// (6) WALLET SUMMARY CARD (GH #1489) — a wallet/balance dashboard summary: a muted eyebrow Text
//     ("Total balance"), one bold headline metric (a Text `h1`, not a Stat — see the seed's own doc for
//     why), then a CardFooter Row of FOUR labeled icon actions (Add Money / Send / Cards / Transactions),
//     each a Column of a decorative Icon over a ghost-variant Button carrying the actual tap target +
//     visible label — at authoring time the closest catalog-real stand-in for an "icon-only Button"
//     (`Button` was a pure action leaf, no icon mechanism, the seed's own doc named the deviation);
//     ADR-0226 (GH #1504, shipped 2026-08-20) since added real `icon`/`iconOnly` wire props — see the
//     seed's own doc for the repair and `catalog-frontier.ts`'s `frontier-button-icon-actions` for the
//     new mechanism's own worked exemplar. Homed here (the dashboard/receipt family) rather than
//     commerce-hospitality.ts: a wallet balance
//     summary is a generic financial-dashboard widget, not a product/booking/hospitality listing — its
//     nearest sibling is THIS module's own receipt-order-summary card (a financial-summary card + a
//     data-bound headline value), not commerce-hospitality.ts's product/room/amenity/review domain.

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
// P9 card-anatomy repair (2026-08-18, GH #1262 back-score wave): `btn_retry` used to ride a `Row` inside
// `CardContent` with no `CardFooter` (the scattered-actions anti-pattern). No FormProvider is involved
// here, so the fix is the simple `frontier-card-anatomy-ask` reparent: `root` (Card) gains a `root_footer`
// (CardFooter) sibling of `root_content`, holding the unchanged `actions` Row.
// CardHeader-title convergence (2026-08-18, Kim's ruling): this record DOES carry an identity title (an
// icon-led h4, "Couldn't load ${/activity/resource}") — the cardheader-title-canon lane's own sweep list
// named this seed as "correctly headerless," which direct inspection here contradicts. Applied the ruling
// for consistency with `frontier-trip-card`'s icon-led CardHeader idiom (catalog-frontier.ts): the whole
// `icon_row` (Icon + title, one identity unit) reparents into a new `root_header` CardHeader, leaving
// `col` holding only the `body` substance — flagged in this lane's hand-back, not silently skipped.
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
          { id: 'root', component: 'Card', elevation: '1', children: ['root_header', 'root_content', 'root_footer'] },
          { id: 'root_header', component: 'CardHeader', children: ['icon_row'] },
          { id: 'icon_row', component: 'Row', gap: 'sm', align: 'center', children: ['icon', 'title'] },
          { id: 'icon', component: 'Icon', name: 'warning', label: 'Error' },
          // Absolute-path ${…} interpolation names WHAT failed to load — live, not a hand-baked string.
          { id: 'title', component: 'Text', variant: 'h4', text: "Couldn't load ${/activity/resource}" },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['body'] },
          { id: 'body', component: 'Text', variant: 'body', text: { path: '/activity/message' } },
          { id: 'root_footer', component: 'CardFooter', children: ['actions'] },
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

const WALLET_ID = 'wallet-summary-card'
/** GH #1489 — the wallet/balance "Summary Action Card": a muted eyebrow Text ("Total balance"), one bold
 *  headline metric, then a CardFooter Row of FOUR labeled icon actions (Add Money / Send / Cards /
 *  Transactions). Card-anatomy law observed (req-a2ui-patterns.md R1 / a2ui-payload.md P9): CardContent
 *  carries the substance (eyebrow + metric), CardFooter carries the one action row — never a Button loose
 *  in content. Every varying field is data-bound — `/wallet/balance` — never a literal standing in for
 *  what a real agent would template (the "dead data" defect class); the eyebrow and the four action labels
 *  are the pattern's own FIXED vocabulary (never data), the same standing this shelf's other seeds give a
 *  Card's own identity text (e.g. `features-list-card`'s literal "Amenities" title).
 *
 *  Stat vs. Text for the headline metric (the ticket's own question): `Stat` (catalog.json) is a
 *  label+value PAIR — every existing seed that reaches for it shows MULTIPLE tiles side by side
 *  (`commerce-product-card`'s price+rating Row, `comparison-pricing-table`'s plan-price Grid,
 *  `kpi-panel-lifecycle`'s Grid of two), each tile supplying its OWN label. A single hero number already
 *  has its label — the eyebrow Text above it — so a Stat here would duplicate that pairing (a redundant
 *  second "Balance" label baked into the Stat itself) rather than carry anything Stat's delta/percent/
 *  caption arms actually need. A plain `Text` (`variant:'h1'`, `emphasis:true`) reads as the single bold
 *  headline the reference image shows, with no redundant label — the more honest fit.
 *
 *  STALE CLAIM, repaired (ADR-0226, GH #1504, shipped 2026-08-20): this jsdoc used to say the
 *  "icon-only Button" the record asks for was NOT literally expressible in this catalog. That is no
 *  longer true — `Button` (catalog.json) now declares bindable `icon` (string, ICON_NAMES verbatim,
 *  factory-realized as one decorative leading `ui-icon`) and static `iconOnly` (the label routes to
 *  `aria-label` instead of visible text), validator-enforced by the new cross-prop `requires` check
 *  (`icon` requires `label`; `iconOnly` requires `icon`) — a REAL, sanctioned Button-with-icon
 *  mechanism, still no Icon-CHILD contract (ADR-0226's own rejected alternative). The `Column(Icon,
 *  Button)` composition below is consequently no longer "the catalog-real answer to a Button with no
 *  icon mechanism" (this seed's own prior phrase) — it is now an ORDINARY layout choice, still valid
 *  (`Column` declares children), simply no longer forced; re-seeding this card onto the new
 *  `icon`/`iconOnly` props is the build wave's own call (ADR-0226 Consequences), not done here. Left
 *  as-is below so this repair stays doc-only, per the "one Repairs-cell item, one change" discipline.
 *  (Before this record: `Button` declared no `children` key and no `icon` prop — it was a pure action
 *  leaf (`references/node-idioms.md`'s own "Button — action leaf" characterization), and no seed on this
 *  whole shelf paired an Icon INSIDE a Button. The validator's structural `RESERVED` set happened to skip
 *  `child`/`children` for ANY component, so a Button node could mechanically carry an Icon child without
 *  failing `validate-payload` — undocumented validator leniency, not a sanctioned composition; ADR-0226
 *  cl.4 closes that leniency catalog-wide in the SAME record that adds the real mechanism.) Composed
 *  instead as the closest catalog-real equivalent of the day: `Column(Icon, Button)` — a
 *  purely decorative `Icon` (glyph only, no `label` prop — an empty label IS the decorative contract,
 *  `icon.ts:29`; a non-empty label would double-announce the action to assistive tech alongside the
 *  Button's own name, the GH #1489 judge PASS-4/5 finding this rider repairs) sits above a `ghost`-variant
 *  `Button` whose OWN `label` carries the visible action word AND the sole accessible name, serving as
 *  both the tap target and the "label beneath" the record asks for (never a third, duplicate Text node
 *  repeating the same word).
 *
 *  GH #1483's second rider — `align:'center'` on the four quad Columns — is NOT applied: `ui-column`'s
 *  `align` prop is deliberately narrowed to `[stretch, start, end, baseline]` (`column.ts:34`, "narrowed:
 *  center removed (Kim); stretch-first = default + snap target"), and the catalog's own `Column.align`
 *  enum mirrors that narrowing — `align:'center'` fails `validate-payload` (`CATALOG` verdict, unknown
 *  enum member) exactly as a real producer's malformed output would. Left at the catalog default
 *  (`stretch`), which the fill-by-default sizing law (ADR-0223) already makes read as centered for these
 *  single-child-per-row Icon/Button pairs.
 *
 *  Icon coverage (verified against `packages/agent-ui/icons/src/types.ts`'s `ICON_NAMES` — REAL,
 *  already-registered glyphs only, never an invented name that would silently resolve to a blank
 *  `<svg data-icon-missing>`, `resolve.ts`):
 *    - "Add Money" → `plus` — a genuine direct fit, no substitution needed.
 *    - "Send" → `paper-plane-right` — a genuine direct fit (the fleet's one send/paper-plane glyph).
 *    - "Cards" → `credit-card` — a genuine direct fit, no substitution needed.
 *    - "Transactions" → `arrow-clockwise` — nearest-available; the pack has no receipt/transaction-list
 *      glyph, so the rotating-arrows "history/refresh" glyph stands in for "recent activity," named
 *      honestly here rather than claimed as a purpose-built match (the `features-list-card` precedent).
 *  Every action shares one action name (`wallet_action`) differentiated by `action.context.action` (the
 *  record's own "via per-Button `action.context`" instruction) — the `empty-error-retry-card` seed's
 *  `context:{resource:'activity'}` shape, one field wide, applied to four sibling instances of one verb. */
export const walletSummaryCardSeed: ExampleSeed = {
  name: 'wallet-summary-card',
  description:
    'A wallet/balance Summary Action Card — a muted eyebrow Text, one bold headline balance metric, then a CardFooter Row of four labeled icon actions (Add Money / Send / Cards / Transactions), each a decorative Icon over a ghost Button carrying the tap target + visible label.',
  promptText: 'Show my wallet: the total balance, and quick actions to add money, send money, view my cards, and see transactions.',
  surfaceId: WALLET_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: WALLET_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WALLET_ID,
        value: { wallet: { balance: '$942.83' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WALLET_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['content', 'footer'] },
          { id: 'content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'xs', children: ['eyebrow', 'metric'] },
          { id: 'eyebrow', component: 'Text', variant: 'kicker', text: 'Total balance' },
          { id: 'metric', component: 'Text', variant: 'h1', emphasis: true, text: { path: '/wallet/balance' } },
          { id: 'footer', component: 'CardFooter', children: ['actions_row'] },
          {
            id: 'actions_row', component: 'Row', justify: 'between', gap: 'md',
            children: ['action_add', 'action_send', 'action_cards', 'action_txns'],
          },
          { id: 'action_add', component: 'Column', gap: 'xs', children: ['icon_add', 'btn_add'] },
          { id: 'icon_add', component: 'Icon', name: 'plus' },
          {
            id: 'btn_add', component: 'Button', variant: 'ghost', label: 'Add Money',
            action: { action: 'wallet_action', context: { action: 'add_money' } },
          },
          { id: 'action_send', component: 'Column', gap: 'xs', children: ['icon_send', 'btn_send'] },
          { id: 'icon_send', component: 'Icon', name: 'paper-plane-right' },
          {
            id: 'btn_send', component: 'Button', variant: 'ghost', label: 'Send',
            action: { action: 'wallet_action', context: { action: 'send_money' } },
          },
          { id: 'action_cards', component: 'Column', gap: 'xs', children: ['icon_cards', 'btn_cards'] },
          { id: 'icon_cards', component: 'Icon', name: 'credit-card' },
          {
            id: 'btn_cards', component: 'Button', variant: 'ghost', label: 'Cards',
            action: { action: 'wallet_action', context: { action: 'view_cards' } },
          },
          { id: 'action_txns', component: 'Column', gap: 'xs', children: ['icon_txns', 'btn_txns'] },
          { id: 'icon_txns', component: 'Icon', name: 'arrow-clockwise' },
          {
            id: 'btn_txns', component: 'Button', variant: 'ghost', label: 'Transactions',
            action: { action: 'wallet_action', context: { action: 'view_transactions' } },
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
  walletSummaryCardSeed,
]
