// composition-pack-b.ts — GH #1206's COMPOSITION SEEDS PACK B (req-a2ui-library R4, next-tier): the four
// dispositioned **composition** patterns — weather · menu · itinerary · wizard — each a pattern seed over
// EXISTING catalog types, never a new component (the disposition table's whole point,
// .claude/docs/research/req-a2ui-library.md), following composition-pack-a.ts's shape exactly: an
// agent-realistic promptText, live data-model binding for everything that varies per instance (the
// "dead data" defect class — updateDataModel carries `value:`, varying content rides `{path}`/`${…}`),
// realistic content (the demand-evidence law — no lorem), the grammar.md card-anatomy clause wherever a
// Card appears (header = identity only · content = substance · footer = the actions), and the shared
// validate+render-smoke gate (examples.test.ts) proving each at check time.
//
// (1) 5-DAY WEATHER — Card > CardHeader identity + CardContent Row of 5 Column{day · condition · hi/lo}
//     (Subframe/Tubik weather-widget surveys: day+icon+hi/lo is THE convention). ⚠ GLYPH-AUDIT RESULT
//     (the issue's S sub-task): the icon pack's canonical vocabulary (`@agent-ui/icons` `ICON_NAMES`,
//     types.ts) ships ZERO weather glyphs — no sun/moon/cloud/cloud-rain/cloud-snow/cloud-lightning/
//     cloud-fog/wind/snowflake/drop/umbrella/thermometer — and an unknown name resolves to a blank
//     `<svg data-icon-missing>` (resolve.ts), i.e. dead pixels, not a fallback. So the disposition row's
//     Icon slot was realized as a condition TEXT label in v1. GH #1258 landed the weather-glyph wave
//     (sun · cloud · cloud-sun · cloud-rain · snowflake · lightning · wind · cloud-fog) and this seed
//     took its own documented swap: `cond_*` is now an Icon whose `name` binds a per-day
//     `/forecast/<day>/icon` glyph path and whose `label` binds the SAME condition text path v1
//     displayed — the word is kept as
//     the accessible name, never dropped. The hero variant (full-bleed condition Image behind today's
//     temp) stays a follow-up per the row's own note.
// (2) RESTAURANT/DRINKS MENU — a Column of sections: Text heading + List > Row{Column{name, desc} ·
//     price}, price right-aligned via the Row's justify (NO dot leaders in v1, the disposition row's
//     call), the long tail section behind a Disclosure. Prices arrive HUMANIZED from the producer
//     ('€9.50', never 9.5 — the confirmation-view receipt precedent).
// (3) ITINERARY — Timeline > TimelineItem events + a typed-Badge detail Card for the up-next event.
//     Catalog reality vs. the disposition sketch: `TimelineItem` is a LEAF row (no ChildList — its
//     catalog entry carries only status/label/description/timestamp/icon), so "Badge type · Card detail
//     INSIDE the item" is not expressible; the event TYPE rides the item's own typed fields, and the
//     active event's detail Card (with its typed Badge) sits beside the Timeline instead.
// (4) WIZARD (Ladder/Progress PRESENTATION) — Column > Progress step meter + step body (RadioGroup) +
//     Row{Back·Next}, state via a dataModel path per step (`/wizard/*`). DISTINCT from the
//     `backable-wizard` seed (catalog-frontier.ts, GH #1192/PR #1239): that seed is the FLOW-PROTOCOL
//     exemplar — one ask surface across turns, root-immutability, the scene-resend + draft-persistence
//     mechanics of going Back. THIS seed is the single-turn PRESENTATION composition — the visual
//     anatomy of one wizard step (meter + body + nav row) a producer emits as a snapshot; it never
//     exercises the multi-turn scene-swap protocol.

import type { ExampleSeed } from './types.ts'

const WEATHER_ID = 'five-day-weather'
/** Composition 1 — the 5-DAY WEATHER pattern: a Card whose header carries only the place+range identity
 *  and whose content is one Row of five day Columns, each stacking day label · condition · hi/lo (the
 *  survey convention). Every per-day value is BOUND — a morning re-forecast turn updates a day's
 *  condition and temps in place without resending the tree; day labels are static (the week's shape
 *  doesn't change mid-conversation). Condition is an Icon since GH #1258 (glyph `name` bound to
 *  `/forecast/<day>/icon`, accessible `label` bound to the same `/forecast/<day>/cond` text v1
 *  displayed). */
export const fiveDayWeatherSeed: ExampleSeed = {
  name: 'five-day-weather',
  description:
    'A 5-day weather card — CardHeader identity, CardContent Row of five day Columns each stacking day · bound condition Icon (glyph name + accessible condition label both bound) · bound hi/lo.',
  promptText: "What's the weather in Lisbon looking like for the rest of the week?",
  surfaceId: WEATHER_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: WEATHER_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WEATHER_ID,
        value: {
          forecast: {
            mon: { cond: 'Sunny', icon: 'sun', temps: '31° / 19°' },
            tue: { cond: 'Sunny', icon: 'sun', temps: '32° / 20°' },
            wed: { cond: 'Cloudy', icon: 'cloud', temps: '28° / 19°' },
            thu: { cond: 'Showers', icon: 'cloud-rain', temps: '24° / 17°' },
            fri: { cond: 'Partly sunny', icon: 'cloud-sun', temps: '27° / 18°' },
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WEATHER_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['hd', 'ct'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h5', text: 'Lisbon — Mon to Fri' },
          { id: 'ct', component: 'CardContent', children: ['days'] },
          { id: 'days', component: 'Row', gap: 'md', justify: 'between', align: 'start', children: ['d_mon', 'd_tue', 'd_wed', 'd_thu', 'd_fri'] },
          { id: 'd_mon', component: 'Column', gap: 'xs', align: 'start', children: ['day_mon', 'cond_mon', 'temps_mon'] },
          { id: 'day_mon', component: 'Text', variant: 'label', text: 'Mon' },
          { id: 'cond_mon', component: 'Icon', name: { path: '/forecast/mon/icon' }, label: { path: '/forecast/mon/cond' } },
          { id: 'temps_mon', component: 'Text', text: { path: '/forecast/mon/temps' } },
          { id: 'd_tue', component: 'Column', gap: 'xs', align: 'start', children: ['day_tue', 'cond_tue', 'temps_tue'] },
          { id: 'day_tue', component: 'Text', variant: 'label', text: 'Tue' },
          { id: 'cond_tue', component: 'Icon', name: { path: '/forecast/tue/icon' }, label: { path: '/forecast/tue/cond' } },
          { id: 'temps_tue', component: 'Text', text: { path: '/forecast/tue/temps' } },
          { id: 'd_wed', component: 'Column', gap: 'xs', align: 'start', children: ['day_wed', 'cond_wed', 'temps_wed'] },
          { id: 'day_wed', component: 'Text', variant: 'label', text: 'Wed' },
          { id: 'cond_wed', component: 'Icon', name: { path: '/forecast/wed/icon' }, label: { path: '/forecast/wed/cond' } },
          { id: 'temps_wed', component: 'Text', text: { path: '/forecast/wed/temps' } },
          { id: 'd_thu', component: 'Column', gap: 'xs', align: 'start', children: ['day_thu', 'cond_thu', 'temps_thu'] },
          { id: 'day_thu', component: 'Text', variant: 'label', text: 'Thu' },
          { id: 'cond_thu', component: 'Icon', name: { path: '/forecast/thu/icon' }, label: { path: '/forecast/thu/cond' } },
          { id: 'temps_thu', component: 'Text', text: { path: '/forecast/thu/temps' } },
          { id: 'd_fri', component: 'Column', gap: 'xs', align: 'start', children: ['day_fri', 'cond_fri', 'temps_fri'] },
          { id: 'day_fri', component: 'Text', variant: 'label', text: 'Fri' },
          { id: 'cond_fri', component: 'Icon', name: { path: '/forecast/fri/icon' }, label: { path: '/forecast/fri/cond' } },
          { id: 'temps_fri', component: 'Text', text: { path: '/forecast/fri/temps' } },
        ],
      },
    },
  ],
}

const MENU_ID = 'restaurant-menu'
/** Composition 2 — the RESTAURANT/DRINKS MENU pattern: a Column of category sections, each a Text
 *  heading over a List whose rows are Row{Column{name, desc} · price} with the price RIGHT-ALIGNED by
 *  the Row's own `justify: 'between'` (no dot leaders in v1 — the disposition row's typography call);
 *  the long drinks tail sits behind a Disclosure so the surface stays scannable. Sections are TEMPLATED
 *  over the data model with relative per-item binds (the person_card idiom, dynamic-lists.ts) — the
 *  agent regenerates a section by rewriting one array, never the tree. Prices arrive humanized from the
 *  producer ('€9.50'). */
export const restaurantMenuSeed: ExampleSeed = {
  name: 'restaurant-menu',
  description:
    'A sectioned restaurant menu — Text section headings over Lists templated on the model, each row a Row{Column{name, caption desc} · right-aligned humanized price}; the drinks section behind a Disclosure.',
  promptText: "We're seated at Taberna do Largo — show me the menu so we can order some small plates and wine.",
  surfaceId: MENU_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: MENU_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: MENU_ID,
        value: {
          menu: {
            petiscos: [
              { name: 'Peixinhos da horta', desc: 'Green-bean fritters, lemon aioli', price: '€6.50' },
              { name: 'Amêijoas à Bulhão Pato', desc: 'Clams, garlic, coriander, white wine', price: '€12.00' },
              { name: 'Pica-pau de novilho', desc: 'Seared beef bites, pickles, mustard jus', price: '€10.50' },
              { name: 'Queijo de Azeitão', desc: 'Sheep-milk cheese, quince marmalade', price: '€8.00' },
            ],
            wines: [
              { name: 'Vinho verde — Aphros Loureiro', desc: 'Crisp, saline, low alcohol', price: '€5.50' },
              { name: 'Douro tinto — Quinta do Crasto', desc: 'Dark fruit, firm tannin', price: '€7.00' },
              { name: 'Moscatel de Setúbal', desc: 'Dessert pour, orange peel and honey', price: '€6.00' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: MENU_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'lg', children: ['heading', 'sec_petiscos', 'sec_wines'] },
          { id: 'heading', component: 'Text', variant: 'h4', text: 'Taberna do Largo' },
          // section 1 — petiscos: heading + templated list, always open.
          { id: 'sec_petiscos', component: 'Column', gap: 'sm', children: ['petiscos_hd', 'petiscos_list'] },
          { id: 'petiscos_hd', component: 'Text', variant: 'h5', text: 'Petiscos' },
          { id: 'petiscos_list', component: 'List', gap: 'sm', children: { path: '/menu/petiscos', componentId: 'dish_tpl' } },
          { id: 'dish_tpl', component: 'Row', gap: 'md', justify: 'between', align: 'baseline', children: ['dish_col', 'dish_price'] },
          { id: 'dish_col', component: 'Column', gap: 'none', children: ['dish_name', 'dish_desc'] },
          { id: 'dish_name', component: 'Text', text: '${name}' },
          { id: 'dish_desc', component: 'Text', variant: 'caption', text: '${desc}' },
          { id: 'dish_price', component: 'Text', text: '${price}' },
          // section 2 — wines by the glass: the long-menu tail behind a Disclosure (open here so the
          // render smoke exercises the rows; a producer folds it shut on a crowded surface).
          { id: 'sec_wines', component: 'Disclosure', summary: 'Wines by the glass', open: true, children: ['wines_list'] },
          { id: 'wines_list', component: 'List', gap: 'sm', children: { path: '/menu/wines', componentId: 'wine_tpl' } },
          { id: 'wine_tpl', component: 'Row', gap: 'md', justify: 'between', align: 'baseline', children: ['wine_col', 'wine_price'] },
          { id: 'wine_col', component: 'Column', gap: 'none', children: ['wine_name', 'wine_desc'] },
          { id: 'wine_name', component: 'Text', text: '${name}' },
          { id: 'wine_desc', component: 'Text', variant: 'caption', text: '${desc}' },
          { id: 'wine_price', component: 'Text', text: '${price}' },
        ],
      },
    },
  ],
}

const ITINERARY_ID = 'travel-itinerary'
/** Composition 3 — the ITINERARY pattern: the day's events on a Timeline spine (status carries
 *  past/current/future — done · active · pending, the travel-timeline convention), with the ACTIVE
 *  event's detail broken out beside it as a Card whose header Row pairs the typed Badge with the title.
 *  Catalog-reality deviation from the disposition sketch, stated loudly: `TimelineItem` is a LEAF (no
 *  ChildList in its catalog entry), so type-Badge-plus-detail-Card cannot nest INSIDE an item — the
 *  event type rides each item's own label/description/timestamp fields, and one detail Card (typed
 *  Badge · substance · footer action) accompanies the timeline for the event that matters now. The
 *  detail card's fields are BOUND so the agent retargets it to the next event without resending the
 *  spine. */
export const travelItinerarySeed: ExampleSeed = {
  name: 'travel-itinerary',
  description:
    'A day itinerary — a Timeline of done/active/pending events (flight · check-in · dinner · fado) plus a bound detail Card for the active event, its header Row pairing a typed intent Badge with the title.',
  promptText: "Walk me through today's Lisbon itinerary — what's done, what's next, and the details for what's coming up.",
  surfaceId: ITINERARY_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: ITINERARY_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: ITINERARY_ID,
        value: {
          upNext: {
            type: 'Hotel',
            title: 'Check in — Memmo Alfama',
            detail: 'Rooftop check-in desk; the room is ready from 15:00. Luggage drop available now.',
            when: 'Today 15:00 · Travessa das Merceeiras 27',
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: ITINERARY_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['heading', 'spine', 'detail'] },
          { id: 'heading', component: 'Text', variant: 'h4', text: 'Saturday in Lisbon' },
          { id: 'spine', component: 'Timeline', label: 'Saturday itinerary', children: ['ev_flight', 'ev_hotel', 'ev_dinner', 'ev_fado'] },
          { id: 'ev_flight', component: 'TimelineItem', status: 'done', label: 'Flight TP 1367 — arrived LIS', description: 'Landed on time, bags collected.', timestamp: '11:40' },
          { id: 'ev_hotel', component: 'TimelineItem', status: 'active', label: 'Check in — Memmo Alfama', description: 'Room ready from 15:00.', timestamp: '15:00' },
          { id: 'ev_dinner', component: 'TimelineItem', status: 'pending', label: 'Dinner — Cervejaria Ramiro', description: 'Table for 4, upstairs.', timestamp: '20:30' },
          { id: 'ev_fado', component: 'TimelineItem', status: 'pending', label: 'Fado at Tasca do Chico', description: 'No reservation — arrive early.', timestamp: '22:30' },
          // the active event's detail card — typed Badge in the header Row, bound substance, one action.
          { id: 'detail', component: 'Card', elevation: '1', children: ['det_hd', 'det_ct', 'det_ft'] },
          { id: 'det_hd', component: 'CardHeader', children: ['det_id_row'] },
          { id: 'det_id_row', component: 'Row', gap: 'sm', align: 'center', children: ['det_badge', 'det_title'] },
          { id: 'det_badge', component: 'Badge', intent: 'info', label: { path: '/upNext/type' } },
          { id: 'det_title', component: 'Text', variant: 'h5', text: { path: '/upNext/title' } },
          { id: 'det_ct', component: 'CardContent', children: ['det_body', 'det_when'] },
          { id: 'det_body', component: 'Text', text: { path: '/upNext/detail' } },
          { id: 'det_when', component: 'Text', variant: 'caption', text: { path: '/upNext/when' } },
          { id: 'det_ft', component: 'CardFooter', children: ['det_actions'] },
          { id: 'det_actions', component: 'Row', gap: 'sm', justify: 'end', children: ['det_directions'] },
          { id: 'det_directions', component: 'Button', variant: 'soft', label: 'Get directions', action: { action: 'directions', context: { to: 'Memmo Alfama' }, wantResponse: false } },
        ],
      },
    },
  ],
}

const WIZARD_B_ID = 'wizard-step-progress'
/** Composition 4 — the WIZARD PRESENTATION pattern (Ladder/Progress + step body + nav row): the visual
 *  anatomy of ONE wizard step as a producer emits it — a Progress meter pinning "step N of M" (value
 *  bound so advancing is a one-path data write), the step's title, its selection body (RadioGroup, value
 *  on the step's OWN dataModel path — `/wizard/plan` here; each step binds a distinct path, the
 *  disposition row's state-per-step law), and the Row{ghost Back · solid Next} nav pair.
 *  ⚠ DISTINCT from `backable-wizard` (catalog-frontier.ts, GH #1192): that seed is the FLOW-PROTOCOL
 *  exemplar — the multi-turn scene-resend mechanics of one ask surface (root-immutability, /draft/*
 *  persistence across Back). This seed is the single-turn PRESENTATION composition — what one step LOOKS
 *  like (meter + body + nav) — and deliberately never exercises the scene-swap protocol; a producer
 *  building a real flow combines THIS anatomy with THAT protocol. */
export const wizardStepProgressSeed: ExampleSeed = {
  name: 'wizard-step-progress',
  description:
    'One wizard step, presentation anatomy — a bound Progress "step 2 of 3" meter, step title, a RadioGroup body on its own /wizard/plan path, and the ghost-Back + solid-Next nav Row (the flow protocol itself lives in backable-wizard).',
  promptText: "I'm partway through setting up the workspace — show me the plan-selection step with where I am in the flow.",
  surfaceId: WIZARD_B_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: WIZARD_B_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WIZARD_B_ID,
        value: {
          wizard: { step: 2, steps: 3, plan: 'team' },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_B_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['meter', 'step_title', 'plans', 'nav'] },
          { id: 'meter', component: 'Progress', label: 'Setup — step 2 of 3', value: { path: '/wizard/step' }, max: { path: '/wizard/steps' } },
          { id: 'step_title', component: 'Text', variant: 'h4', text: 'Choose your plan' },
          { id: 'plans', component: 'RadioGroup', value: { path: '/wizard/plan' }, orientation: 'vertical', children: ['plan_solo', 'plan_team', 'plan_business'] },
          { id: 'plan_solo', component: 'Radio', value: 'solo', label: 'Solo — €9/month, 1 seat' },
          { id: 'plan_team', component: 'Radio', value: 'team', label: 'Team — €29/month, up to 10 seats' },
          { id: 'plan_business', component: 'Radio', value: 'business', label: 'Business — €79/month, unlimited seats + SSO' },
          { id: 'nav', component: 'Row', gap: 'sm', justify: 'end', children: ['btn_back', 'btn_next'] },
          { id: 'btn_back', component: 'Button', variant: 'ghost', label: 'Back', action: { action: 'wizard_step', context: { to: 1 }, wantResponse: false } },
          { id: 'btn_next', component: 'Button', variant: 'solid', label: 'Next', action: { action: 'wizard_step', context: { to: 3 } } },
        ],
      },
    },
  ],
}

/** The pack's family array — `allSeeds`' composition surface (never a hand-counted literal). */
export const compositionPackBSeeds: readonly ExampleSeed[] = [
  fiveDayWeatherSeed,
  restaurantMenuSeed,
  travelItinerarySeed,
  wizardStepProgressSeed,
]
