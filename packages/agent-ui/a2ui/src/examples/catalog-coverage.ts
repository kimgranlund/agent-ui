// catalog-coverage.ts — the ADR-0087/ADR-0093/ADR-0095 catalog-coverage wave (4 seeds), PLUS the
// report/content/feed teaching-wave exemplars (report-family.lld.md LLD-C15, content-family.lld.md
// LLD-C15, feed-family.lld.md LLD-C15 — ADR-0111/0113/0112).
//
// Closes a measured a2ui-catalog rubric gap (D6, the example leg): none of the ADR-0087 whole-fleet
// catalog wave's 14 rows (Icon, Menu, MenuItem, Popover, Tooltip, RadioGroup, Radio, SegmentedControl,
// Segment, Slider, SliderMulti, Calendar, ComboBox, List, Grid) appeared in any seed on this shelf, and
// the ADR-0093 Calendar `mode="range"` surface (`valueStart`/`valueEnd`) had zero exemplar coverage
// anywhere — a self-correct-convergence risk (the model can never see `mode`'s legal members
// `["single","range"]` in any context surface). Four REALISTIC compositions, not 15 single-component
// demo stubs — each is a scenario an agent would actually emit, built the way the rest of the shelf is:
//
// (1) BOOKING RESERVATION — a Card/FormProvider room-booking flow: a required guest-name TextField, a
//     `Calendar mode="range"` check-in/check-out picker (`valueStart`/`valueEnd`, the ADR-0093 surface),
//     a `SegmentedControl`/`Segment` room-type picker, and a `Slider` nightly-budget control, gated by one
//     FormProvider (guest name + room type start empty — a live blocked-submit demo, the generative-form
//     idiom). Covers: Calendar (range), SegmentedControl, Segment, Slider.
// (2) RENTAL FILTER PANEL — a live (non-FormProvider) search panel: a `ComboBox` city picker sharing the
//     `Option` primitive with Select, a `RadioGroup`/`Radio` property-type picker, a `SliderMulti`
//     price-range control, and a `List` of result cards templated over `/results`. Covers: ComboBox,
//     RadioGroup, Radio, SliderMulti, List.
// (3) DOCUMENT ROW TOOLBAR — a document row's action cluster: a `Tooltip` revealing last-edited metadata,
//     a `Popover` with sharing tips, and an overflow `Menu`/`MenuItem` trio (Rename/Duplicate/Delete) —
//     the whole overlay family sharing the `open`/`toggle` two-way contract. Covers: Tooltip, Popover,
//     Menu, MenuItem. **Icon no longer appears here** (feed-family.lld.md LLD-C15, M2): its hand-composed
//     Row[Icon,Text] file card upgraded to a real `Attachment`, per SPEC-R22's "never a hand-built
//     Icon+Text card" guidance — Icon now has zero exemplar coverage on this shelf, a knowingly-traded
//     regression against this module's own D6 rubric goal, accepted because the SPEC-R22 AC is explicit
//     and Icon's own descriptor/jsdom/browser suites remain the coverage of record for the control itself.
// (4) STATS GRID DASHBOARD — a `Grid`-templated metric-tile dashboard (the `patternDashboardSeed` idiom,
//     swapping the wrapping Row for a track `Grid` with a `min` floor). Covers: Grid.
//
// (5) REPORT CARD DASHBOARD — chart-family.lld.md LLD-C12 (SPEC-R14 AC1, ADR-0107), upgraded in place by
//     report-family.lld.md LLD-C15 (M2, ADR-0111 cl.6): a `stats-grid-dashboard` SIBLING, not a
//     Grid-of-tiles but one composed report — a `Stat` (the guidance re-base retired the hand-composed
//     caption-Text + h3-Text tile) sits beside a `Sparkline` trend, then a `BarChart` breaks the total
//     down by region — the seed itself teaches the catalog SPEC §5.2 Notes guidance (`Stat` for a latest
//     value · `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `Table` when
//     exact values must be scanned row-by-row). `trend`/`regions` are `{path}`-bound (the live-data idiom
//     the array-typed chart props exist to demonstrate); `title`/`latest` are ALSO `{path}`-bound scalars
//     (Text.text is bindable too, catalog.json) — every data-model field this seed declares is reachable
//     through a binding, none of it hand-baked into the component tree. Covers: Sparkline, BarChart, Stat.
//
// (6) OPS REPORT — report-family.lld.md LLD-C15 (M2, SPEC-R20 AC2): ONE seed exercising all three
//     report-family types together — two `Stat`s (uptime with a `delta`, deployment count), a pass/fail
//     `Badge` pair, and a `Table` of the failing checks (a number column exercising Intl + alignment).
//     Covers: Stat, Badge, Table.
//
// (7) DEPLOYMENT REPORT — content-family.lld.md LLD-C15 (M2, SPEC-R23 AC1), the report-card-dashboard
//     SIBLING: a prose summary, a verbatim `Code` command, a `Text.href` source link, and a
//     `Disclosure`-folded full log — the seed itself teaches "fold the detail, never the answer."
//     Covers: Code, Disclosure, Text.href.
//
// (8) AGENT TASK STATUS — feed-family.lld.md LLD-C15 (M2, SPEC-R22): identity + how-far + what-it-
//     produced in one card — an `Avatar` beside the agent name, a `Progress` bar for the task fraction,
//     and an `Attachment` for the artifact it has produced so far. Covers: Avatar, Progress, Attachment.
//
// (9) BRAND PALETTE — token-surfaces.lld.md LLD-C15 (M2, ADR-0118 fork F4): the token-surface family's
//     own teaching exemplar — three named color roles as individual `Swatch` cells (SPEC-R17's "roles
//     stay swatch tables" ruling: a semantic role set is not an ordered progression, so each role is its
//     own scalar-bound Swatch, never a Ramp), a `Ramp` of the primary tonal range (the genuinely ordered
//     series a Ramp exists for), and a `Ladder` of corner radii (labeled dimensional tiers, their real
//     length rendered literally). `primary`/`secondary`/`accent` are `{path}`-bound scalar objects
//     (Swatch.value/label read the SAME idiom Stat.value/Text.text already demonstrate); `tonal`/`radii`
//     are `{path}`-bound arrays (the Sparkline.values/BarChart.data array-prop precedent) — every data
//     field this seed declares is reachable through a binding, none hand-baked into the component tree.
//     Covers: Swatch, Ramp, Ladder.

import type { ExampleSeed } from './types.ts'

const BOOKING_ID = 'booking-reservation'
export const bookingReservationSeed: ExampleSeed = {
  name: 'booking-reservation',
  description: 'A room-booking card — guest name, a date-range Calendar, a room-type SegmentedControl, and a budget Slider, gated by a FormProvider.',
  promptText: 'Show a room booking form: guest name, a check-in/check-out date range, a room type picker, and a nightly budget slider, with a Reserve button.',
  surfaceId: BOOKING_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BOOKING_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: BOOKING_ID,
        value: { booking: { guest: '', checkIn: '2026-08-14', checkOut: '2026-08-17', roomType: '', budget: 180 } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BOOKING_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'FormProvider', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_guest', 'f_dates', 'f_room', 'f_budget', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Reserve a room' },
          { id: 'f_guest', component: 'Field', label: 'Guest name', child: 'in_guest' },
          {
            id: 'in_guest', component: 'TextField', name: 'guest', required: true, value: { path: '/booking/guest' },
            checks: [{ call: 'required', args: { value: { path: '/booking/guest' } }, message: 'Guest name is required' }],
          },
          { id: 'f_dates', component: 'Field', label: 'Check-in — check-out', child: 'cal_dates' },
          // mode:"range" (ADR-0093) — valueStart/valueEnd are ONE-WAY binds (agent-fed; factories.ts:411-413
          // rules them bindable one-way only — the row's single two-way slot stays `value`, inert in range
          // mode). Honest limit: a user-picked range does NOT write back to /booking/checkIn|checkOut, so
          // sendDataModel submits the seeded dates; live range write-back awaits a second two-way slot.
          {
            id: 'cal_dates', component: 'Calendar', mode: 'range', name: 'dates', min: '2026-07-07',
            valueStart: { path: '/booking/checkIn' }, valueEnd: { path: '/booking/checkOut' },
          },
          { id: 'f_room', component: 'Field', label: 'Room type', child: 'room_seg' },
          {
            id: 'room_seg', component: 'SegmentedControl', name: 'roomType', required: true,
            value: { path: '/booking/roomType' }, children: ['seg_std', 'seg_dlx', 'seg_ste'],
          },
          { id: 'seg_std', component: 'Segment', value: 'standard', label: 'Standard' },
          { id: 'seg_dlx', component: 'Segment', value: 'deluxe', label: 'Deluxe' },
          { id: 'seg_ste', component: 'Segment', value: 'suite', label: 'Suite' },
          { id: 'f_budget', component: 'Field', label: 'Nightly budget (€)', child: 'sl_budget' },
          { id: 'sl_budget', component: 'Slider', name: 'budget', min: 80, max: 400, step: 10, value: { path: '/booking/budget' } },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_reserve'] },
          { id: 'btn_reserve', component: 'Button', variant: 'solid', label: 'Reserve room', action: { action: 'reserve_room', submit: true } },
        ],
      },
    },
  ],
}

const FILTER_ID = 'rental-filter-panel'
export const rentalFilterPanelSeed: ExampleSeed = {
  name: 'rental-filter-panel',
  description: 'A live rental search panel — a city ComboBox, a property-type RadioGroup, a price SliderMulti, and a List of result cards.',
  promptText: 'Show a rental search filter panel: a city search box, a property type picker, a price range slider, and a list of matching results.',
  surfaceId: FILTER_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: FILTER_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: FILTER_ID,
        value: {
          filters: { city: '', type: 'apartment', priceLo: 900, priceHi: 2200 },
          results: [
            { city: 'Helsinki', type: 'Apartment', price: '1200', beds: '2' },
            { city: 'Stockholm', type: 'House', price: '2100', beds: '3' },
            { city: 'Berlin', type: 'Studio', price: '850', beds: '1' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: FILTER_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'lg', children: ['title', 'filters_row', 'results_list'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Find a rental' },
          { id: 'filters_row', component: 'Row', gap: 'lg', wrap: true, children: ['f_city', 'f_type', 'f_price'] },
          { id: 'f_city', component: 'Field', label: 'City', child: 'cb_city' },
          // ComboBox reuses the Option primitive (the Select precedent) — ship them together, same
          // first-connect discipline as Select/Option (node-idioms.md).
          {
            id: 'cb_city', component: 'ComboBox', name: 'city', placeholder: 'Search a city…',
            value: { path: '/filters/city' }, children: ['opt_hel', 'opt_sto', 'opt_ber'],
          },
          { id: 'opt_hel', component: 'Option', value: 'Helsinki', label: 'Helsinki' },
          { id: 'opt_sto', component: 'Option', value: 'Stockholm', label: 'Stockholm' },
          { id: 'opt_ber', component: 'Option', value: 'Berlin', label: 'Berlin' },
          { id: 'f_type', component: 'Field', label: 'Property type', child: 'rg_type' },
          {
            id: 'rg_type', component: 'RadioGroup', name: 'type', orientation: 'horizontal',
            value: { path: '/filters/type' }, children: ['r_apt', 'r_house', 'r_studio'],
          },
          { id: 'r_apt', component: 'Radio', value: 'apartment', label: 'Apartment' },
          { id: 'r_house', component: 'Radio', value: 'house', label: 'House' },
          { id: 'r_studio', component: 'Radio', value: 'studio', label: 'Studio' },
          { id: 'f_price', component: 'Field', label: 'Price range (€ / month)', child: 'sm_price' },
          {
            id: 'sm_price', component: 'SliderMulti', name: 'price', min: 500, max: 3000, step: 50,
            valueLo: { path: '/filters/priceLo' }, valueHi: { path: '/filters/priceHi' },
          },
          { id: 'results_list', component: 'List', gap: 'sm', children: { path: '/results', componentId: 'result_card' } },
          { id: 'result_card', component: 'Card', elevation: '1', children: ['result_content'] },
          { id: 'result_content', component: 'CardContent', children: ['result_col'] },
          { id: 'result_col', component: 'Column', gap: 'xs', children: ['result_title', 'result_meta'] },
          { id: 'result_title', component: 'Text', variant: 'h5', text: '${city} — ${type}' },
          { id: 'result_meta', component: 'Text', variant: 'caption', text: '€${price}/mo · ${beds} bed' },
        ],
      },
    },
  ],
}

const TOOLBAR_ID = 'document-row-toolbar'
export const documentRowToolbarSeed: ExampleSeed = {
  name: 'document-row-toolbar',
  description: 'A document row action cluster — an Attachment file card, a Tooltip, a sharing Popover, and an overflow Menu, sharing the overlay family open/toggle contract.',
  promptText: 'Show a document row with its name, an info tooltip, a share popover, and an overflow menu with rename, duplicate, and delete.',
  surfaceId: TOOLBAR_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: TOOLBAR_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: TOOLBAR_ID, value: { ui: { tipOpen: false, popOpen: false, menuOpen: false } } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: TOOLBAR_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['toolbar'] },
          { id: 'toolbar', component: 'Row', justify: 'between', align: 'center', gap: 'md', children: ['doc_info', 'doc_actions'] },
          // feed-family.lld.md LLD-C15 (M2, SPEC-R22): the hand-composed Row[Icon,Text] file card upgrades
          // to the real `Attachment` type — its glyph derives from `mimeType` via `fileCategory`, a total
          // function that always resolves a real glyph (feed-family.spec.md SPEC-R9), so the vendored-pack
          // "closest available icon" defect this block used to document (the 2026-07-07 visual audit) is
          // now structurally unreachable rather than merely worked around.
          { id: 'doc_info', component: 'Attachment', name: 'Q3 roadmap.pdf', mimeType: 'application/pdf', sizeBytes: 428000 },
          // toolbar.lld.md LLD-C11 (ADR-0121 F7): the action cluster upgrades from a hand-composed
          // `Row[Icon,Text]`-style wrapper to the real `Toolbar` type — the SAME "hand-built shape → real
          // type" upgrade this seed's own `doc_info` comment records for Attachment. `label` names the
          // bar for assistive tech (the toolbar's own accessible name, ADR-0121 §3); the three overlay
          // triggers below become real roving-focus items (ITEM_SELECTOR matches `ui-button`).
          { id: 'doc_actions', component: 'Toolbar', label: 'Document actions', gap: 'sm', align: 'center', children: ['tip_wrap', 'pop_wrap', 'menu_overflow'] },

          // Tooltip: FIRST child is the anchor, remaining children move into the tooltip panel
          // (factories.ts:315-319).
          {
            id: 'tip_wrap', component: 'Tooltip', placement: 'top-start', delay: 300,
            open: { path: '/ui/tipOpen' }, children: ['btn_info', 'tip_text'],
          },
          { id: 'btn_info', component: 'Button', variant: 'ghost', label: 'Info' },
          { id: 'tip_text', component: 'Text', variant: 'caption', text: 'Last edited 2 hours ago by Ada Lovelace' },

          // Popover: FIRST child is the disclosure trigger, remaining children move into its panel
          // (factories.ts:308-313).
          {
            id: 'pop_wrap', component: 'Popover', placement: 'bottom-start',
            open: { path: '/ui/popOpen' }, children: ['btn_share', 'pop_col'],
          },
          { id: 'btn_share', component: 'Button', variant: 'ghost', label: 'Share' },
          { id: 'pop_col', component: 'Column', gap: 'xs', children: ['pop_title', 'pop_body'] },
          { id: 'pop_title', component: 'Text', variant: 'h5', text: 'Sharing tips' },
          { id: 'pop_body', component: 'Text', variant: 'caption', text: 'Share links expire after 7 days.' },

          // Menu: FIRST child is the trigger, remaining children are MenuItem rows moved into the panel
          // (factories.ts:272-276) — trigger + items ship together, the Select/Option ordering discipline.
          {
            id: 'menu_overflow', component: 'Menu', placement: 'bottom-end',
            open: { path: '/ui/menuOpen' }, children: ['btn_overflow', 'mi_rename', 'mi_duplicate', 'mi_delete'],
          },
          { id: 'btn_overflow', component: 'Button', variant: 'ghost', label: 'More actions' },
          { id: 'mi_rename', component: 'MenuItem', value: 'rename', label: 'Rename' },
          { id: 'mi_duplicate', component: 'MenuItem', value: 'duplicate', label: 'Duplicate' },
          { id: 'mi_delete', component: 'MenuItem', value: 'delete', label: 'Delete' },
        ],
      },
    },
  ],
}

const STATS_GRID_ID = 'stats-grid-dashboard'
export const statsGridDashboardSeed: ExampleSeed = {
  name: 'stats-grid-dashboard',
  description: 'A metric-tile dashboard laid out on a track Grid (the patternDashboardSeed idiom, swapping the wrapping Row for a Grid with a min track floor).',
  promptText: 'Show a dashboard grid of four metric tiles: sessions, conversion rate, average order value, and refunds.',
  surfaceId: STATS_GRID_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: STATS_GRID_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: STATS_GRID_ID,
        value: {
          stats: [
            { label: 'Sessions', value: '4,820', unit: '' },
            { label: 'Conversion', value: '3.2', unit: '%' },
            { label: 'Avg. order', value: '54', unit: '€' },
            { label: 'Refunds', value: '12', unit: '' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: STATS_GRID_ID,
        components: [
          { id: 'root', component: 'Grid', gap: 'md', min: '12rem', children: { path: '/stats', componentId: 'stat_tile' } },
          { id: 'stat_tile', component: 'Card', elevation: '1', children: ['stat_content'] },
          { id: 'stat_content', component: 'CardContent', children: ['stat_col'] },
          { id: 'stat_col', component: 'Column', gap: 'xs', children: ['stat_label', 'stat_value'] },
          { id: 'stat_label', component: 'Text', variant: 'caption', text: { path: 'label' } },
          { id: 'stat_value', component: 'Text', variant: 'h3', text: '${value}${unit}' },
        ],
      },
    },
  ],
}

const REPORT_CARD_ID = 'report-card-dashboard'
export const reportCardDashboardSeed: ExampleSeed = {
  name: 'report-card-dashboard',
  description: 'A revenue report card — a latest-value tile, a Sparkline trend, and a BarChart regional breakdown, all bound to the data model (chart-family.lld.md LLD-C12).',
  promptText: 'Show a revenue report card: the latest total, a trend sparkline, and a bar chart breaking revenue down by region.',
  surfaceId: REPORT_CARD_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: REPORT_CARD_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: REPORT_CARD_ID,
        value: {
          title: 'Q3 revenue report',
          latest: '€54,200',
          trend: [42000, 48000, 45000, 53000, 50000, 58000],
          regions: [
            { label: 'EMEA', value: 21400 },
            { label: 'APAC', value: 15800 },
            { label: 'Americas', value: 12300 },
            { label: 'Other', value: 4700 },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: REPORT_CARD_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'revenue_row', 'regions_caption', 'bars'] },
          { id: 'title', component: 'Text', variant: 'h3', text: { path: '/title' } },
          { id: 'revenue_row', component: 'Row', gap: 'lg', align: 'center', children: ['stat', 'spark'] },
          // The stat: the latest-value idiom, now the real catalog type (report-family.lld.md LLD-C15 —
          // the guidance re-base retires the hand-composed caption-Text + h3-Text tile it replaces).
          { id: 'stat', component: 'Stat', label: 'Revenue', value: { path: '/latest' }, caption: 'Total across all regions' },
          // The sparkline: the SHAPE of the series over time (catalog SPEC §5.2 Notes guidance) — bound to
          // the same data the tile summarizes, so the reader sees "what it is" and "how it got there."
          { id: 'spark', component: 'Sparkline', values: { path: '/trend' }, label: 'Revenue trend' },
          { id: 'regions_caption', component: 'Text', variant: 'caption', text: 'By region' },
          // The bar chart: comparing MAGNITUDES across a small discrete set (catalog SPEC §5.2 Notes
          // guidance) — the same total's breakdown, the composition's third and final answer.
          { id: 'bars', component: 'BarChart', data: { path: '/regions' }, label: 'Revenue by region' },
        ],
      },
    },
  ],
}

const OPS_REPORT_ID = 'ops-report'
export const opsReportSeed: ExampleSeed = {
  name: 'ops-report',
  description: 'An ops report — uptime and deployment Stats, a pass/fail Badge pair, and a Table of the failing checks (report-family.lld.md LLD-C15).',
  promptText: 'Show an ops report: uptime and deployment stats, pass/fail check badges, and a table of the checks that are failing.',
  surfaceId: OPS_REPORT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: OPS_REPORT_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: OPS_REPORT_ID,
        value: {
          uptime: '99.95%',
          uptimeDelta: 0.12,
          deployments: 8,
          checks: [
            { name: 'api-gateway', env: 'prod', latency: 812 },
            { name: 'auth-service', env: 'prod', latency: 640 },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: OPS_REPORT_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'stats_row', 'badges_row', 'checks_table'] },
          { id: 'title', component: 'Text', variant: 'h3', text: 'Ops report — last 24h' },
          { id: 'stats_row', component: 'Row', gap: 'lg', children: ['stat_uptime', 'stat_deployments'] },
          // Stat #1: a latest value WITH a delta (catalog SPEC §5.2 Notes guidance — Stat for a latest value).
          {
            id: 'stat_uptime', component: 'Stat', label: 'Uptime',
            value: { path: '/uptime' }, delta: { path: '/uptimeDelta' }, caption: 'vs last week',
          },
          // Stat #2: a latest value with no delta — the row demonstrates delta is optional, not paired.
          { id: 'stat_deployments', component: 'Stat', label: 'Deployments', value: { path: '/deployments' } },
          { id: 'badges_row', component: 'Row', gap: 'sm', children: ['badge_failing', 'badge_passing'] },
          { id: 'badge_failing', component: 'Badge', label: '2 failing', intent: 'danger' },
          { id: 'badge_passing', component: 'Badge', label: '11 passing', intent: 'success' },
          // The table: exact values scanned row-by-row (catalog SPEC §5.2 Notes guidance) — the two checks
          // the badge above counts as failing, `latency` a number column exercising Intl + alignment.
          {
            id: 'checks_table', component: 'Table', label: 'Failing checks',
            columns: [
              { key: 'name', label: 'Check', type: 'string' },
              { key: 'env', label: 'Environment', type: 'string' },
              { key: 'latency', label: 'Latency (ms)', type: 'number' },
            ],
            rows: { path: '/checks' },
          },
        ],
      },
    },
  ],
}

const DEPLOYMENT_REPORT_ID = 'deployment-report'
export const deploymentReportSeed: ExampleSeed = {
  name: 'deployment-report',
  description: 'A deployment report — a prose summary, a verbatim Code command, a Text.href source link, and a Disclosure-folded full log (content-family.lld.md LLD-C15).',
  promptText: 'Show a deployment report: what happened, the command that ran, a link to the runbook, and the full log folded behind a disclosure.',
  surfaceId: DEPLOYMENT_REPORT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: DEPLOYMENT_REPORT_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: DEPLOYMENT_REPORT_ID,
        value: {
          command: 'kubectl rollout restart deployment/api-gateway',
          logOpen: false,
          fullLog: 'Waiting for rollout to finish: 1 old replicas pending termination...\ndeployment "api-gateway" successfully rolled out',
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: DEPLOYMENT_REPORT_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'summary', 'cmd_code', 'source_link', 'log_disclosure'] },
          { id: 'title', component: 'Text', variant: 'h3', text: 'Deployment: api-gateway restart' },
          // Text: prose (catalog SPEC §5.2 Notes guidance — Text for prose).
          { id: 'summary', component: 'Text', variant: 'body', text: 'The rolling restart completed successfully across all 3 replicas with zero downtime.' },
          // Code: verbatim/preformatted output, never emphasis (catalog SPEC §5.2 Notes guidance).
          { id: 'cmd_code', component: 'Code', code: { path: '/command' }, language: 'sh' },
          // A link: sources and references, never bare navigation-as-action (catalog SPEC §5.2 Notes
          // guidance) — an https source citation, not a Button-shaped action.
          { id: 'source_link', component: 'Text', href: 'https://docs.example.com/runbooks/deploy-api-gateway', text: 'Source: deployment runbook' },
          // Disclosure: progressive detail, never the primary answer (catalog SPEC §5.2 Notes guidance) —
          // "fold the detail, never the answer": the summary above already answers "what happened"; the
          // full log is optional depth, folded behind a Disclosure > Code, the long-code idiom.
          {
            id: 'log_disclosure', component: 'Disclosure', summary: 'Full log',
            open: { path: '/logOpen' }, children: ['log_code'],
          },
          { id: 'log_code', component: 'Code', code: { path: '/fullLog' }, language: 'text' },
        ],
      },
    },
  ],
}

const AGENT_TASK_STATUS_ID = 'agent-task-status'
export const agentTaskStatusSeed: ExampleSeed = {
  name: 'agent-task-status',
  description: 'An agent task status card — who is working on it (Avatar), how far along (Progress), and what it has produced so far (Attachment) (feed-family.lld.md LLD-C15).',
  promptText: 'Show an agent task status card: who is working on it, how far along, and the artifact it has produced so far.',
  surfaceId: AGENT_TASK_STATUS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: AGENT_TASK_STATUS_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: AGENT_TASK_STATUS_ID,
        value: {
          agent: { name: 'Ada' },
          task: { title: 'Refactoring auth middleware', pct: 62 },
          artifact: { name: 'auth-middleware.patch', mimeType: 'text/x-diff', sizeBytes: 8420 },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: AGENT_TASK_STATUS_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['header_row', 'task_progress', 'artifact'] },
          { id: 'header_row', component: 'Row', gap: 'sm', align: 'center', children: ['avatar', 'task_title'] },
          // Avatar: who acted — beside a name, decorative (catalog SPEC §5.2 Notes guidance).
          { id: 'avatar', component: 'Avatar', name: { path: '/agent/name' } },
          { id: 'task_title', component: 'Text', variant: 'h4', text: { path: '/task/title' } },
          // Progress: how far along — a real fraction, so determinate (catalog SPEC §5.2 Notes guidance;
          // the TaskState pairing: "working" with a reported fraction, not indeterminate).
          { id: 'task_progress', component: 'Progress', value: { path: '/task/pct' }, label: 'Task progress' },
          // Attachment: what was produced — never a hand-built Icon+Text card (catalog SPEC §5.2 Notes
          // guidance, the document-row-toolbar upgrade's same rule).
          {
            id: 'artifact', component: 'Attachment',
            name: { path: '/artifact/name' }, mimeType: { path: '/artifact/mimeType' }, sizeBytes: { path: '/artifact/sizeBytes' },
          },
        ],
      },
    },
  ],
}

const BRAND_PALETTE_ID = 'brand-palette'
export const brandPaletteSeed: ExampleSeed = {
  name: 'brand-palette',
  description: 'A brand palette card — three named color-role Swatches, a primary tonal Ramp, and a corner-radii Ladder (token-surfaces.lld.md LLD-C15).',
  promptText: 'Show our brand palette: the primary, secondary, and accent colors, the primary tonal range, and our corner radii.',
  surfaceId: BRAND_PALETTE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: BRAND_PALETTE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: BRAND_PALETTE_ID,
        value: {
          title: 'Acme brand palette',
          primary: { label: 'Primary', value: 'oklch(0.55 0.15 250)' },
          secondary: { label: 'Secondary', value: 'oklch(0.65 0.12 200)' },
          accent: { label: 'Accent', value: 'oklch(0.7 0.18 30)' },
          tonal: [
            { label: '100', value: 'oklch(0.95 0.02 250)' },
            { label: '300', value: 'oklch(0.8 0.08 250)' },
            { label: '500', value: 'oklch(0.55 0.15 250)' },
            { label: '700', value: 'oklch(0.4 0.12 250)' },
            { label: '900', value: 'oklch(0.2 0.06 250)' },
          ],
          radii: [
            { label: 'sm', value: '4px' },
            { label: 'md', value: '8px' },
            { label: 'lg', value: '16px' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: BRAND_PALETTE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'roles_row', 'tonal_caption', 'tonal_ramp', 'radii_caption', 'radii_ladder'] },
          { id: 'title', component: 'Text', variant: 'h3', text: { path: '/title' } },
          // Three named color ROLES — individual scalar-bound Swatches, never a Ramp (SPEC-R17's "roles
          // stay swatch tables" ruling — a semantic role set is not an ordered progression).
          { id: 'roles_row', component: 'Row', gap: 'lg', wrap: true, children: ['sw_primary', 'sw_secondary', 'sw_accent'] },
          { id: 'sw_primary', component: 'Swatch', value: { path: '/primary/value' }, label: { path: '/primary/label' } },
          { id: 'sw_secondary', component: 'Swatch', value: { path: '/secondary/value' }, label: { path: '/secondary/label' } },
          { id: 'sw_accent', component: 'Swatch', value: { path: '/accent/value' }, label: { path: '/accent/label' } },
          { id: 'tonal_caption', component: 'Text', variant: 'caption', text: 'Primary tonal range' },
          // The ramp: the genuinely ORDERED series a Ramp exists for (catalog SPEC §5.2 Notes guidance —
          // Swatch/Ramp for color identity/relationships).
          { id: 'tonal_ramp', component: 'Ramp', steps: { path: '/tonal' }, label: 'Primary tonal range' },
          { id: 'radii_caption', component: 'Text', variant: 'caption', text: 'Corner radii' },
          // The ladder: labeled dimensional tiers at their real length (catalog SPEC §5.2 Notes guidance —
          // Ladder for dimensional rhythm).
          { id: 'radii_ladder', component: 'Ladder', tiers: { path: '/radii' }, label: 'Corner radii' },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const catalogCoverageSeeds: readonly ExampleSeed[] = [
  bookingReservationSeed,
  rentalFilterPanelSeed,
  documentRowToolbarSeed,
  statsGridDashboardSeed,
  reportCardDashboardSeed,
  opsReportSeed,
  deploymentReportSeed,
  agentTaskStatusSeed,
  brandPaletteSeed,
]
