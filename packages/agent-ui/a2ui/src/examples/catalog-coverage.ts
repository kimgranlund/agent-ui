// catalog-coverage.ts — the ADR-0087/ADR-0093/ADR-0095 catalog-coverage wave (4 seeds).
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
// (3) DOCUMENT ROW TOOLBAR — a document row's action cluster: an `Icon` file glyph, a `Tooltip` revealing
//     last-edited metadata, a `Popover` with sharing tips, and an overflow `Menu`/`MenuItem` trio
//     (Rename/Duplicate/Delete) — the whole overlay family sharing the `open`/`toggle` two-way contract.
//     Covers: Icon, Tooltip, Popover, Menu, MenuItem.
// (4) STATS GRID DASHBOARD — a `Grid`-templated metric-tile dashboard (the `patternDashboardSeed` idiom,
//     swapping the wrapping Row for a track `Grid` with a `min` floor). Covers: Grid.

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
  description: 'A document row action cluster — an Icon glyph, a Tooltip, a sharing Popover, and an overflow Menu, sharing the overlay family open/toggle contract.',
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
          { id: 'doc_info', component: 'Row', gap: 'sm', align: 'center', children: ['icon_doc', 'doc_name'] },
          // 'calendar-blank' (NOT a literal document glyph — the vendored @agent-ui/icons pack is an
          // 11-name MVP set, ADR-0065/0066, with no file/document icon; this is the closest available
          // "page" shape). The original 'file-text' name is NOT a member of `ICON_NAMES`
          // (icons/src/types.ts) — an unknown name resolves through resolveIcon() to a non-throwing
          // EMPTY <svg data-icon-missing="file-text"> (icons/src/resolve.ts:10-14), so the card silently
          // rendered no glyph at all (a real, gallery-caught defect: 2026-07-07 visual audit). Flag to the
          // icons-package owner if a document/file glyph is wanted in a future vendor wave.
          { id: 'icon_doc', component: 'Icon', name: 'calendar-blank', label: 'Document' },
          // ADR-0106 — the document row's title cell is the reference use of `truncate`: a document name
          // must hold one line, ellipsis-clip under a narrow row, and stay reachable via the unconditional
          // `title` mirror (native hover reveal, zero dependency cost).
          // ADR-0109 — and the reference use of `emphasis`: a document NAME is exactly the "names, labels,
          // key values" idiom (cl.4), and the two booleans composing on one node is itself the teaching
          // (orthogonal axes — weight intent + overflow intent, independently settable).
          { id: 'doc_name', component: 'Text', variant: 'body', text: 'Q3 roadmap.pdf', truncate: true, emphasis: true },
          { id: 'doc_actions', component: 'Row', gap: 'sm', align: 'center', children: ['tip_wrap', 'pop_wrap', 'menu_overflow'] },

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

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const catalogCoverageSeeds: readonly ExampleSeed[] = [
  bookingReservationSeed,
  rentalFilterPanelSeed,
  documentRowToolbarSeed,
  statsGridDashboardSeed,
]
