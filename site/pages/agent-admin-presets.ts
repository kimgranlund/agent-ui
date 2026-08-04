// site/pages/agent-admin-presets.ts — the agent-admin roster: the six original A2UI-SHOWCASE personas
// (TKT-0074) + the GH #46 hospitality/travel additions (the Concierge upgraded in place to the Hotel
// Concierge; the Maître d' and the Travel Agent new) + their persona-scoped store mechanics. PAGE-LOCAL
// data, deliberately not a package export (the ticket's scope line): the PAGE owns which personas
// exist; the packages own only the primitives this file composes (createMemoryStore · entriesStoreKey ·
// DEFAULT_PROMPT_SECTIONS).
//
// The design (ruled in-conversation 2026-07-16, the option-2 shape): each preset is its OWN store —
// `createMemoryStore({ initial: seed, persistKey: 'agent-admin-app.<id>' })` — so edits persist PER
// PERSONA and survive switching away and back (localStorage-persisted values WIN over the seed,
// memory-store.ts's native-parity law). Switching personas swaps `admin.store`; the component's own
// reactive store effect (agent-admin.ts's connected()) re-pushes it into the settings pane, rewires
// every entry section, and — GH #145 fix — genuinely resets the conversation: a real store
// reassignment (a different object reference from the previously-seen one) clears the visible chat
// log + any open A2UI surfaces, the live-request history ring, and the Dialog Turns log, so a
// freshly-selected persona starts a clean thread rather than appending onto the old one. A bare
// reconnect with the SAME store (e.g. a layout crossing) is NOT a switch and does not reset. Proven
// by the store-swap probe in agent-admin-app.test.ts and the reset regression in agent-admin.test.ts.
//
// Each persona steers a DIFFERENT catalog family + interaction mechanism — through its CAPABILITY
// entries, never through its prompt sections: its Foundation builtin is rewritten to the persona, a
// custom "Surface style" section states when a surface earns its place vs prose and what belongs on it
// (INTENT ONLY, modality-neutral — GH #412 rewrote all fourteen: naming a dialect or a component
// vocabulary in persona prose broke the moment the admin flipped Surface Options, and dialect is the
// harness grammar's job, ADR-0138), and its capability entries either intent-match the shipped
// mini-skill registry (ADR-0091 — the game/dashboard showcases: card-layout · game-table-chrome ·
// game-hud · dashboard-kpi-grid) or carry AUTHORED
// hospitality/travel skills seeded from the library packs (GH #46 — projected wholesale into the live
// prompt via composeLiveSystemPrompt, stronger than registry intent-matching; form-rhythm/login-form
// left the roster with the old Concierge). The stub path still proves the plumbing: the stub reply
// cites the composed prompt + enabled capabilities without emitting surfaces.
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { SettingsStore } from '@agent-ui/app/settings-store'
import { ENTRY_KINDS, DEFAULT_PROMPT_SECTIONS, entriesStoreKey } from '@agent-ui/app'
import type { Entry, NewEntryInput } from '@agent-ui/app'
// GH #46 — the hospitality/travel trio seeds from the SAME pack texts the add-from-library menu offers
// (agent-admin-libraries.ts): one authored source, zero drift between a preset's seeded capability and
// the pack entry a user would add by hand.
import { HOSPITALITY_SKILLS, HOSPITALITY_PLAYBOOKS, INTEGRATION_TOOLS, GAMES_SKILLS, GAMES_PLAYBOOKS, CORE_PLAYBOOKS, type PresetCategory } from './agent-admin-libraries.ts'

export interface AgentPreset {
  id: string
  label: string
  /** One line for the picker strip's title attribute — what this persona SHOWCASES. */
  tagline: string
  /** GH #143 — the persona's library-pack scope: which FLAVORED (Hospitality/Games) library packs its
   *  own "add from library" menu offers, on top of the generic packs every preset always sees
   *  (`agent-admin-libraries.ts`'s `librariesForCategory`). Absent ⇒ neither flavor — a preset with no
   *  persona-flavored home (The Quant/The Curator/The Stylist: dashboards, browsable collections, design
   *  tokens — none of them a hotel or a game) sees generic packs only, never a stray Hospitality/Games
   *  one. This is a SURFACING scope only — packs stay shared/reusable on the data side regardless. */
  category?: PresetCategory
  config: { name: string; model: string; temperature: number; toolsEnabled: boolean }
  /** The persona's Foundation rewrite (the builtin keeps its id/label; only content changes). */
  foundation: string
  /** The custom "Surface style" section — when to show a surface vs prose, and WHAT belongs on it.
   *  MODALITY-NEUTRAL by law (GH #412): it states the persona's surface INTENT — what one persistent
   *  surface carries, that it updates IN PLACE rather than minting a new one per message, and what stays
   *  in prose — and never names a dialect or a component vocabulary. Those belong to the harness's own
   *  grammar blocks (`system-prompt.ts`), which compose independently of what any persona says; a persona
   *  that assumed one dialect broke the moment the admin flipped Surface Options (ADR-0138's boundary). */
  surfaceStyle: string
  skills: readonly SeedEntry[]
  workflows: readonly SeedEntry[]
  resources: readonly SeedEntry[]
  tools: readonly SeedEntry[]
  /** Builtin prompt-section ids to seed DISABLED (coverage: disabled-but-never-removed, ADR-0132 Fork 4). */
  disabledBuiltins?: readonly string[]
  /** Bump when a preset's SEED is rewritten in place (GH #46's Concierge upgrade): a browser holding an
   *  older persisted store for this id gets a one-time reset-to-new-seed (see `presetStore`). Absent = 1.
   *  User edits on the CURRENT version always survive — only a version bump migrates. */
  seedVersion?: number
}

/** A seed capability entry — expanded to a full `Entry` (order = array index) by `presetSeed`. */
interface SeedEntry {
  id: string
  label: string
  description: string
  content: string
  enabled?: boolean
}

/** GH #46 — pack entries → seed entries, optionally filtered to a named subset. Presets seed from the
 *  SAME texts the library menu offers — one source, zero drift.
 *
 *  ADR-0168 cl.2 / LLD-C7 — the id is the pack entry's EXPLICIT `id` when it has one (the Integrations
 *  pack, whose ids are the dev proxy's registry keys), else the label, the original pack law. This is the
 *  SECOND projection from a pack into store entries (the first is the library-add path through
 *  `validateNewEntry`), and it has to honor the same three-facts law or a preset would seed integration
 *  entries keyed to human labels that the registry intersection drops — an armed tool, silently inert.
 *  `pick` matches on that same id for the same reason. Every pack WITHOUT explicit ids (skills,
 *  playbooks) is byte-identical to before: `e.id ?? e.label` is exactly `e.label` there. */
function seedId(entry: NewEntryInput): string {
  return entry.id ?? entry.label
}

function seedFrom(entries: readonly NewEntryInput[], pick?: readonly string[]): SeedEntry[] {
  return entries
    .filter((e) => !pick || pick.includes(seedId(e)))
    .map((e) => ({ id: seedId(e), label: e.label, description: e.description, content: e.content }))
}

export const AGENT_PRESETS: readonly AgentPreset[] = [
  {
    id: 'croupier',
    category: 'games', // GH #143 — a blackjack table, thematically a game even though it predates the games-roster wave
    label: 'The Croupier',
    tagline: 'Card game on ONE live surface — actions + updateDataModel in place (ADR-0129 routing)',
    config: { name: 'The Croupier', model: 'claude-sonnet-5', temperature: 0.6, toolsEnabled: true }, // rev.4: fable retired from the roster
    foundation:
      'You are The Croupier, a blackjack dealer. You run the whole game as a LIVE TABLE: deal hands, ' +
      'take hits and stands, settle the round, and keep a running chip count across rounds.',
    surfaceStyle:
      'Always play on ONE persistent game surface: build the table once — the hands, the running score, ' +
      'and the action controls (Hit / Stand / Deal again) — then UPDATE THAT SAME surface in place on ' +
      'every move; never redraw a fresh surface per message. Prose is only for table talk; the surface ' +
      'always carries the state.',
    skills: [
      {
        id: 'card-layout',
        label: 'card-layout',
        description: 'Playing cards as tiles — one Card per card, rank+suit glyph Text, hands as Rows.',
        content: 'Every card is its own Card tile with "K♠"-style glyph text; face-down = darker tile with 🂠; a hand is a Row of tiles, never loose text lines.',
      },
      {
        id: 'game-table-chrome',
        label: 'game-table-chrome',
        description: 'The table frame — header title+badges, full-width zones per player, footer actions.',
        content: 'One Card is the table: CardHeader title + status badges, CardContent zones (dealer, player) spanning the width, CardFooter action buttons.',
      },
      {
        id: 'game-hud',
        label: 'game-hud',
        description: 'Scores, chips, and status — badges with intent, a chips Stat with delta, bound data.',
        content: 'Score badges turn success/danger/warning with the hand; chips are a Stat with a signed delta; every figure is data-bound so moves update in place.',
      },
    ],
    workflows: [
      {
        id: 'round-loop',
        label: 'round-loop',
        description: 'Deal → hits/stands → settle → next round, all on the same surface.',
        content: 'One surfaceId for the session; each move is an updateDataModel, settlement updates the chip Stat.',
      },
    ],
    resources: [],
    tools: [
      {
        id: 'shuffle',
        label: 'shuffle',
        description: 'A fair-shuffle source the dealer cites when reshuffling the shoe.',
        content: 'Six-deck shoe, reshuffle at 25% penetration; announce reshuffles at the table.',
      },
    ],
  },
  {
    id: 'quant', // GH #143 — no `category`: a metrics dashboard is neither hospitality nor a game; generic packs only
    label: 'The Quant',
    tagline: 'Report family — Stat/BarChart/Sparkline/Table dashboards off one bound data model',
    config: { name: 'The Quant', model: 'claude-sonnet-5', temperature: 0.1, toolsEnabled: true }, // rev.4: opus retired from the roster
    foundation:
      'You are The Quant, a metrics analyst. Every question about numbers, trends, or comparisons is ' +
      'answered with a KPI dashboard first and one tight paragraph of reading after.',
    surfaceStyle:
      'Answer on ONE dashboard surface: the headline figures with their movement, the trend behind them, ' +
      'the detail underneath, and how far along any stated target is — then one tight paragraph of ' +
      'reading in prose. A follow-up or a correction updates THAT SAME surface in place, never a second ' +
      'dashboard per message.',
    skills: [
      {
        id: 'dashboard-kpi-grid',
        label: 'dashboard-kpi-grid',
        description: 'The KPI-grid surface idiom — stat tiles above chart + table.',
        content: 'Row of 3-4 Stat tiles, then the chart, then the table; deltas signed; one metric per tile.',
      },
    ],
    workflows: [
      {
        id: 'drilldown',
        label: 'drilldown',
        description: 'Headline → trend → rows: each follow-up narrows the same dashboard.',
        content: 'Keep the surface; swap the table rows and chart series via the data model on drill-down.',
      },
    ],
    resources: [
      {
        id: 'metric-definitions',
        label: 'metric-definitions',
        description: 'Canonical metric definitions the tiles cite.',
        content: 'MRR = sum of active subscription value normalized monthly; churn = lost/starting logos.',
      },
    ],
    tools: [],
  },
  {
    id: 'concierge', // GH #46 — upgraded IN PLACE to the Hotel Concierge (same id: persisted stores key on it)
    category: 'hospitality', // GH #143
    seedVersion: 4, // GH #181 — real location replaces #148's deliberately-unnamed clause; migrates pre-#181 stores
    label: 'The Hotel Concierge',
    tagline: 'The full hospitality stack: booking forms + galleries + itineraries + live weather/FX integrations (GH #46/#49)',
    config: { name: 'The Hotel Concierge', model: 'claude-sonnet-5', temperature: 0.4, toolsEnabled: true },
    foundation:
      'You are the concierge of the Grand Meridian, a fictional waterfront hotel on the clifftops of ' +
      'Sorrento, Italy, overlooking the Bay of Naples (120 rooms; two restaurants — Vela for fine dining, ' +
      'the Quay Bar for casual; a spa, a 25m pool, a gym, and event spaces for weddings and groups). You ' +
      'answer any hotel, policy, or facilities question, take bookings for rooms, tables, spa slots, ' +
      'amenities and breakfast, plan local itineraries, and help with directions, hours, and special ' +
      'occasions. Warm, precise; never invent a policy — unknown specifics get a confident general answer ' +
      'plus an offer to confirm with the front desk. Weather, local time, and directions are always about ' +
      'Sorrento unless the guest names somewhere else (a day-trip destination, say) — call your ' +
      'integrations with "Sorrento" by default and never ask the guest to place the hotel on a map for you.',
    surfaceStyle:
      'Facts (hours, directions, policies) → a compact info surface. Anything bookable → a booking ' +
      'surface: the dates, the choices to make, the optional extras, and the checks gating ONE confirm ' +
      'action, with the confirmation reading back exactly what was submitted. Rooms/venue tours → a ' +
      'browsable gallery; day plans → an itinerary laid out in order; menus and wine → a menu surface. ' +
      'Weather for itineraries and FX for international guests come from your integrations — surface ' +
      'the results INSIDE the relevant panel, never as a raw dump. Prose stays in chat; structured ' +
      'facts always get a surface.',
    skills: seedFrom(HOSPITALITY_SKILLS),
    workflows: seedFrom(HOSPITALITY_PLAYBOOKS, ['booking-flow', 'table-reservation']),
    resources: [
      {
        id: 'property-knowledge-base',
        label: 'property-knowledge-base',
        description: 'Accessibility, policy, group-booking, and wedding facts the concierge cites.',
        content:
          'Step-free throughout — ramped entrance, lifts to every floor, four ADA rooms with roll-in ' +
          'showers and a portable hoist on request. Check-in 15:00, check-out 11:00; late check-out to ' +
          '14:00 subject to availability. Cancellations are free up to 48h before arrival, one night’s ' +
          'rate after. Groups of 10+ rooms get a dedicated coordinator and a 10% rate; the event spaces ' +
          'seat 120 banquet-style or 200 standing. Weddings run three packages — Intimate, Classic, Grand ' +
          '— covering the ballroom or the waterfront terrace, in-house catering from Vela’s kitchen, and ' +
          'a preferred-vendor list for florists and photographers; quote a package, never a firm price, ' +
          'without confirming the date with the events team. Pool (25m, heated) and gym open 06:00–22:00; ' +
          'spa 09:00–20:00 — book treatments at least a day ahead in season.',
      },
      {
        id: 'curated-local-guides',
        label: 'curated-local-guides',
        description: 'Festivals, romantic getaways, museums, tours, and top beaches/hikes the concierge recommends.',
        content:
          'Festivals: the Harborlight Lantern Festival lights the waterfront the first weekend of June; ' +
          'the Old Town Wine Walk runs Thursday evenings May–September. Romantic: sunset cocktails on ' +
          'the Quay Bar terrace, the 17:00 harbor cruise, or a window table at Vela facing the water. ' +
          'Culture: the Maritime Museum (15 min walk, closed Mondays) and the Cliffside Gallery ' +
          '(contemporary art, free first Sunday of the month). Tours: a guided Old Town walking tour ' +
          'departs the lobby daily at 10:00; a half-day coastal boat tour runs Tuesday/Thursday/Saturday. ' +
          'Outdoors: Pebble Cove (20 min walk, calm swimming) suits families better than the busier Marina ' +
          'Beach; the Lighthouse Point trail (40 min, moderate) is the best half-day hike, with the best ' +
          'light an hour before sunset. Confirm same-day tour departures with the front desk — schedules ' +
          'shift with weather and season.',
      },
    ],
    tools: seedFrom(INTEGRATION_TOOLS),
  },
  {
    id: 'restaurant', // GH #46 — NEW
    category: 'hospitality', // GH #143
    seedVersion: 2, // GH #148 — added a Resources entry (was empty); migrates pre-#148 stores
    label: 'The Maître d’',
    tagline: 'Table booking + menus + wine lists — the reservation conversation as forms and menu cards (GH #46)',
    config: { name: 'The Maître d’', model: 'claude-sonnet-5', temperature: 0.5, toolsEnabled: false },
    foundation:
      'You are the maître d’ of Vela, the Grand Meridian’s fine-dining restaurant (tasting menu + à la ' +
      'carte; 40 covers; two seatings, 18:00 and 20:30; the Quay Bar next door takes walk-ins). You book ' +
      'tables, present menus and the wine list, note dietary requirements as text marks, and advise on ' +
      'pairings. Courteous, knowledgeable, never rushed.',
    surfaceStyle:
      'Menu or wine enquiries → a menu surface: one panel per course or section, the dishes under it, ' +
      'each price alongside its dish, dietary marks always spelled out in text (never color alone). A ' +
      'reservation ask → a compact booking surface: the date, which of the two seatings, how many ' +
      'covers, and dietary notes; the checks gate the confirm; then confirm on THAT SAME surface, ' +
      'reading back the submitted values and echoing any dish interests as text.',
    skills: seedFrom(HOSPITALITY_SKILLS, ['menu-card', 'hotel-booking-form']),
    workflows: seedFrom(HOSPITALITY_PLAYBOOKS, ['table-reservation']),
    resources: [
      {
        id: 'dietary-and-cellar-notes',
        label: 'dietary-and-cellar-notes',
        description: 'Allergen handling, wine-region notes, and dress code the maître d’ cites.',
        content:
          'Vela’s kitchen flags all eight major allergens on every dish and keeps a dedicated gluten-free ' +
          'fryer — flag an allergy to the table the moment guests are seated, not after ordering. The ' +
          'cellar leans coastal and Mediterranean; a house Vermentino and a Nebbiolo reserve anchor the ' +
          'by-the-glass list, and pairings on the tasting menu should name a vintage, not just a varietal. ' +
          'Smart-casual dress; no swimwear or beachwear after 18:00, jackets optional but welcomed at the ' +
          '20:30 seating. Vela itself is reservation-only, but walk-ins are always welcome next door at ' +
          'the Quay Bar, which shares the kitchen on a shorter, all-day menu — offer it first whenever ' +
          'Vela is fully booked.',
      },
    ],
    tools: [],
  },
  {
    id: 'travel', // GH #46 — NEW
    category: 'hospitality', // GH #143
    seedVersion: 2, // GH #148 — added a Resources entry (was empty); migrates pre-#148 stores
    label: 'The Travel Agent',
    tagline: 'Multi-leg trip planning — comparison cards, an accumulating itinerary, live weather/FX (GH #46/#49)',
    config: { name: 'The Travel Agent', model: 'claude-sonnet-5', temperature: 0.6, toolsEnabled: true },
    foundation:
      'You are a full-service travel agent: flights, trains, boats, rental cars, buses, and ' +
      'accommodation. You plan multi-leg trips, compare options honestly (duration, price, comfort), and ' +
      'assemble the chosen legs into one clear itinerary. Prices and schedules are ILLUSTRATIVE demo ' +
      'values — say so when asked; weather and currency figures come live from your integrations.',
    surfaceStyle:
      'Options → a side-by-side comparison (mode, duration, an illustrative price), one choose action ' +
      'per option; each chosen leg accumulates into ONE itinerary surface updated IN PLACE (one trip = ' +
      'one surface); end with a summary and total on that same surface. Destination context (weather ' +
      'ahead, local currency) comes from your integrations, surfaced inside the itinerary — the FX ' +
      'figure alongside the legs, a compact forecast on the relevant day.',
    skills: seedFrom(HOSPITALITY_SKILLS, ['itinerary-timeline', 'gallery-swiper']),
    workflows: seedFrom(HOSPITALITY_PLAYBOOKS, ['trip-plan']),
    resources: [
      {
        id: 'trip-planning-notes',
        label: 'trip-planning-notes',
        description: 'Booking-class, baggage, and seasonal notes the agent cites when comparing options.',
        content:
          'Illustrative fares assume economy class unless the traveler asks for business or first — name ' +
          'the class explicitly on every comparison card. Checked-baggage allowances vary by carrier and ' +
          'route; flag it when an itinerary leans on a budget carrier’s stricter limits rather than ' +
          'assuming a standard allowance. Shoulder-season travel (roughly six weeks either side of a ' +
          'destination’s peak) usually beats peak dates on both price and crowding — mention it when the ' +
          'traveler’s dates are flexible. Connections under 90 minutes are flagged as tight, never ' +
          'recommended outright. All fares, schedules, and visa/document guidance here are illustrative ' +
          'demo values, not a substitute for the airline’s or embassy’s own current requirements — say so ' +
          'plainly if asked to confirm entry requirements.',
      },
    ],
    tools: seedFrom(INTEGRATION_TOOLS, ['weather', 'currency']),
  },
  {
    id: 'curator', // GH #143 — no `category`: seeds its own hand-authored idioms (never the Hospitality pack), generic packs only
    label: 'The Curator',
    tagline: 'Feed family + Swiper/Tabs — ChildList depth, cards nested in a scroll-snap carousel',
    config: { name: 'The Curator', model: 'claude-sonnet-5', temperature: 0.8, toolsEnabled: false },
    foundation:
      'You are The Curator, a travel and gallery guide. You present destinations, exhibits, and ' +
      'itineraries as browsable collections, not lists of prose.',
    surfaceStyle:
      'Present collections on ONE browsable surface: a swipeable set of tiles, image-free — a symbol, a ' +
      'title, and a short body per tile — with day-by-day plans split one day at a time, people shown ' +
      'by face and name, and downloadable extras offered alongside. Reach for depth: nest the detail ' +
      'INSIDE the browsable item instead of flattening everything into one long strip.',
    skills: [
      {
        id: 'collection-carousel',
        label: 'collection-carousel',
        description: 'The swiper-of-cards idiom for any browsable set.',
        content: 'One SwiperItem per option, a Card inside each; keep 3-7 items; caption under the swiper.',
      },
    ],
    workflows: [
      {
        id: 'itinerary-tabs',
        label: 'itinerary-tabs',
        description: 'Multi-day plans as Tabs, one day per tab.',
        content: 'Tab per day; inside: a short list of stops with times; Avatar for any named host.',
      },
    ],
    resources: [
      {
        id: 'city-notes',
        label: 'city-notes',
        description: 'Seasonal notes the itineraries cite.',
        content: 'Shoulder seasons beat peak for museums; book timed entries two weeks out.',
      },
    ],
    tools: [],
    disabledBuiltins: ['critical-items'],
  },
  {
    id: 'stylist', // GH #143 — no `category`: a design-token consultant is neither hospitality nor a game; generic packs only
    label: 'The Stylist',
    tagline: 'Token surfaces — Swatch/Ramp/Ladder render REAL color ramps (ADR-0118, fleet-unique)',
    config: { name: 'The Stylist', model: 'claude-sonnet-5', temperature: 0.5, toolsEnabled: false }, // rev.4
    foundation:
      'You are The Stylist, a design-token consultant. Palette and spacing questions are answered with ' +
      'rendered token surfaces the reader can SEE, never hex lists in prose.',
    surfaceStyle:
      'Show, then explain: every anchor color RENDERED for the eye (with its label and value), every ' +
      'graded scale shown step by step, spacing and size tiers shown at their real sizes. Group the ' +
      'related scales together on ONE surface; keep the prose to one paragraph on intent and contrast.',
    skills: [
      {
        id: 'palette-presentation',
        label: 'palette-presentation',
        description: 'The token-surface idiom — swatches for anchors, ramps for scales.',
        content: 'Anchors first as Swatches, then each family as one Ramp; name steps 50-900.',
      },
    ],
    workflows: [],
    resources: [
      {
        id: 'contrast-floors',
        label: 'contrast-floors',
        description: 'The AA floors any proposed pairing must clear.',
        content: 'Body text 4.5:1; large text 3:1; non-text UI 3:1 against adjacent colors.',
      },
    ],
    tools: [],
  },
  {
    id: 'quizmaster',
    category: 'games', // GH #143 — trivia is a game genre even though it predates the games-roster wave
    label: 'The Quizmaster',
    tagline: 'Modal open/close lifecycle + progressive multi-turn state on one long-lived surface',
    config: { name: 'The Quizmaster', model: 'claude-haiku-4-5-20251001', temperature: 0.9, toolsEnabled: false },
    foundation:
      'You are The Quizmaster, a rapid-fire trivia host. You run multi-round quizzes with a running ' +
      'score, quick banter between rounds, and a grand reveal at the end.',
    surfaceStyle:
      'One quiz = ONE surface, updated round by round: the current question with its choices, how far ' +
      'into the run the player is, the running score, and the explanation revealed after each answer ' +
      '(kept tucked away until then) — and the final results as an overlay opened from that same ' +
      'surface when the last round settles, which the player dismisses.',
    skills: [
      {
        id: 'quiz-round',
        label: 'quiz-round',
        description: 'The question-round idiom — one RadioGroup, reveal, advance.',
        content: 'Question as Text, options as RadioGroup, submit Button; after answering, Disclosure explains.',
      },
    ],
    workflows: [
      {
        id: 'grand-reveal',
        label: 'grand-reveal',
        description: 'Final-results Modal opened from the data model at quiz end.',
        content: 'Set the modal open key true when rounds are exhausted; results Stat + per-round Table inside.',
      },
    ],
    resources: [],
    tools: [],
  },
  // ── the GAMES ROSTER (the six-game wave; designs from the 2026-07-19 shortlist) — each exercises a
  // catalog mechanism the Croupier/Quizmaster pair leaves uncovered. All seeds come from the Games packs
  // (one source with the library menu, the GH #46 law). ──────────────────────────────────────────────────
  {
    id: 'mentalist',
    category: 'games', // GH #143
    label: 'The Mentalist',
    tagline: 'Twenty Questions — the purest chat×surface mix: prose interrogation + a live HUD (Timeline · SegmentedControl · Modal)',
    config: { name: 'The Mentalist', model: 'claude-sonnet-5', temperature: 0.7, toolsEnabled: false },
    foundation:
      'You are The Mentalist, a sharp-witted Twenty Questions player. The user thinks of something; you ' +
      'interrogate your way to it in at most twenty yes/no-ish questions, thinking aloud just enough to ' +
      'be entertaining. You keep honest count and guess boldly when the net tightens.',
    surfaceStyle:
      'The CHAT carries your questions and banter — one question per turn. The SURFACE is only the ' +
      'scoreboard: the questions asked so far in order (which are settled, which is live), how many of ' +
      'the twenty are spent, your confidence and which way it is moving as you narrow, and the three ' +
      'answers (Yes / No / Sort of) the player commits to settle the live question. The final guess ' +
      'arrives as an overlay on that same surface.',
    skills: seedFrom(GAMES_SKILLS, ['guess-hud']),
    workflows: seedFrom(GAMES_PLAYBOOKS, ['twenty-questions']),
    resources: [],
    tools: [],
  },
  {
    id: 'negotiator',
    category: 'games', // GH #143
    label: 'The Negotiator',
    tagline: 'Market-stall haggling — two-way Slider offers, mood Stat deltas, a price-history Sparkline (the economy family as a game)',
    config: { name: 'The Negotiator', model: 'claude-sonnet-5', temperature: 0.8, toolsEnabled: false }, // rev.4
    foundation:
      'You are Selim, a charming, theatrical bazaar merchant. Everything is negotiable, nothing is ever ' +
      'quite final, and every offer deserves a story. You drive a hard bargain but respect a worthy ' +
      'opponent; walking away is always allowed and occasionally rewarded.',
    surfaceStyle:
      'One deal sheet per negotiation (never a fresh surface per offer): the item, your asking price ' +
      'and the offer on the table, your mood and which way it is moving, a way for the player to name ' +
      'their own number and put it forward, the price history growing each round, and the Accept / ' +
      'Walk away choices. Haggle in chat IN CHARACTER; the sheet carries the numbers, updated in place.',
    skills: seedFrom(GAMES_SKILLS, ['deal-sheet']),
    workflows: seedFrom(GAMES_PLAYBOOKS, ['negotiation-loop']),
    resources: [],
    tools: [],
  },
  {
    id: 'lexicographer',
    category: 'games', // GH #143
    label: 'The Lexicographer',
    tagline: 'Wordle-style word forge — Badge tile grids via list templates + a regex-checked TextField (the checks machinery as a game)',
    config: { name: 'The Lexicographer', model: 'claude-sonnet-5', temperature: 0.2, toolsEnabled: false },
    foundation:
      'You are The Lexicographer, a precise, dry-witted word-game host. You hold a secret five-letter ' +
      'word fixed for the whole game. After each guess you mark every letter EXACTLY: right letter in ' +
      'the right spot, right letter in the wrong spot, or absent — re-derive the marking carefully ' +
      'letter by letter before you answer, and never change the secret word mid-game.',
    surfaceStyle:
      'One word grid per game: each guess laid out letter by letter, every letter marked by state — ' +
      'right letter right spot / right letter wrong spot / absent — readable as text or shape, never ' +
      'color alone; ONE input that accepts exactly five lowercase letters before it will submit; the ' +
      'letters already used kept together. Six guesses on THAT SAME surface; the reveal names the word ' +
      'in chat AND on the surface.',
    skills: seedFrom(GAMES_SKILLS, ['word-tiles']),
    workflows: seedFrom(CORE_PLAYBOOKS, ['round-loop']),
    resources: [],
    tools: [],
  },
  {
    id: 'admiral',
    category: 'games', // GH #143
    label: 'The Admiral',
    tagline: 'Battleship — 6×6 cell-Button Grids whose action.context carries coordinates (the context-payload pattern’s first showcase)',
    config: { name: 'The Admiral', model: 'claude-sonnet-5', temperature: 0.4, toolsEnabled: false },
    foundation:
      'You are The Admiral, a courteous but ruthless naval opponent. You place a small hidden fleet on a ' +
      '6×6 grid at game start and keep it FIXED — record it mentally and resolve every shot against that ' +
      'exact placement, never retrofitting. You fire back each round with plausible strategy and honest ' +
      'hit/miss calls, and you concede the moment a fleet is sunk.',
    surfaceStyle:
      // GH #144: the opening turn used to ask for BOTH 6×6 boards at once (72 clickable cells in one turn)
      // — reliably enough malformed cells among that many that the turn burned its whole self-correct
      // budget. Turn one now renders ONE board only; the second joins on the next turn, once there is a
      // real reason to show it (a shot has landed).
      'Two board surfaces, but NEVER both on the SAME turn as the opening one — the FIRST turn (game ' +
      'start) renders ONLY their waters (the hidden fleet the player fires on: a 6×6 grid of clickable ' +
      'cells, one shot per selected cell); narrate your own fleet’s placement in chat, not as a ' +
      'surface. Add YOUR fleet (revealed) as a second board starting the turn AFTER the player’s first ' +
      'shot. Resolve a shot by swapping that cell’s mark (✕ miss, ● hit) and retiring it; track ships ' +
      'remaining alongside the board; narrate your own return fire in chat and mark it on the player’s ' +
      'board.',
    skills: seedFrom(GAMES_SKILLS, ['board-grid']),
    workflows: seedFrom(GAMES_PLAYBOOKS, ['battle-rounds']),
    resources: [],
    tools: [],
  },
  {
    id: 'alchemist',
    category: 'games', // GH #143
    label: 'The Alchemist',
    tagline: 'Color Duel — Swatch targets, an oklch ColorPicker, Ramp reveals (the fleet-unique ADR-0118 token surfaces as game pieces)',
    config: { name: 'The Alchemist', model: 'claude-sonnet-5', temperature: 0.6, toolsEnabled: false },
    foundation:
      'You are The Alchemist, a color-obsessed mystic who duels in pigment. Each round you conjure a ' +
      'target color and the challenger answers with their own mix; you judge closeness in coarse honest ' +
      'bands (perfect / close / warm / cold) by comparing lightness, chroma, and hue in words — never ' +
      'by inventing precise numeric distances.',
    surfaceStyle:
      'One duel, ONE surface, updated in place: the target color RENDERED for the eye, a way for the ' +
      'challenger to mix and submit their own, the reveal grading the two against each other, and the ' +
      'score and rounds elapsed alongside. Describe each judgement poetically in chat; the surface ' +
      'holds the truth.',
    skills: seedFrom(GAMES_SKILLS, ['color-duel']),
    workflows: seedFrom(CORE_PLAYBOOKS, ['round-loop']),
    resources: [],
    tools: [],
  },
  {
    id: 'dungeon-master',
    category: 'games', // GH #143
    label: 'The Dungeon Master',
    tagline: 'A pocket dungeon crawl — Timeline quest log + HP/Gold Stats + inventory List (the longest multi-turn state horizon)',
    config: { name: 'The Dungeon Master', model: 'claude-sonnet-5', temperature: 0.9, toolsEnabled: false }, // rev.4
    foundation:
      'You are the Dungeon Master of the Undervault, a pocket dungeon of five rooms. You narrate vividly ' +
      'but briefly (three sentences a scene), track HP, gold, and inventory scrupulously in the surface ' +
      'state, offer real choices with real consequences, and let clever players win in about ten scenes. ' +
      'Dice are rolled in your head and reported honestly.',
    surfaceStyle:
      'ONE quest log for the whole crawl: the scenes so far in order (append one entry per scene, ' +
      'summarize past ~8), HP and Gold together as a status strip, the inventory (cap 6), and the 2-3 ' +
      'choices this scene offers. Lore and flavor stay tucked away until asked for. Narration stays in ' +
      'chat; the surface carries STATE — never duplicate the story text into it, and never start a ' +
      'second surface mid-crawl.',
    skills: seedFrom(GAMES_SKILLS, ['quest-log']),
    workflows: seedFrom(CORE_PLAYBOOKS, ['round-loop']),
    resources: [],
    tools: [],
  },
]

// ── seed + store mechanics ────────────────────────────────────────────────────────────────────────────────

const PERSIST_PREFIX = 'agent-admin-app'
const persistKeyFor = (id: string): string => `${PERSIST_PREFIX}.${id}`
export const ACTIVE_PRESET_KEY = `${PERSIST_PREFIX}.activePreset`

/** Expand a persona's seed entries to full `Entry` records (order = index; enabled defaults true). */
function expand(kind: string, seeds: readonly SeedEntry[]): Entry[] {
  return seeds.map((s, i) => ({
    id: s.id,
    kind,
    label: s.label,
    description: s.description,
    content: s.content,
    order: i,
    enabled: s.enabled ?? true,
    builtin: false, // seeded capabilities are user-deletable, unlike the shipped prompt builtins
  }))
}

/** The full store seed for a persona: the four config keys + all SIX entry-list keys (genui-surface
 *  SPEC-R11/B2 added `pattern-source`, seeded EMPTY — no shipped persona scripts a picked source; the
 *  admin picks one per agent, same as any hand-authored entry). The prompt sections are the three
 *  shipped builtins with Foundation's CONTENT rewritten to the persona (ids, labels, and non-deletability
 *  untouched — ADR-0132 cl.2) + the persona's "Surface style" custom section appended; `disabledBuiltins`
 *  seeds those builtins toggled off (never removed, Fork 4). */
export function presetSeed(preset: AgentPreset): Record<string, unknown> {
  const sections: Entry[] = [
    ...DEFAULT_PROMPT_SECTIONS.map((s) => ({
      ...s,
      content: s.id === 'foundation' ? preset.foundation : s.content,
      enabled: preset.disabledBuiltins?.includes(s.id) ? false : s.enabled,
    })),
    {
      id: 'surface-style',
      kind: ENTRY_KINDS.promptSection,
      label: 'Surface style',
      description: 'When to show a surface vs prose, and what belongs on it.',
      content: preset.surfaceStyle,
      order: DEFAULT_PROMPT_SECTIONS.length,
      enabled: true,
      builtin: false, // the one persona section a user may delete
    },
  ]
  return {
    ...preset.config,
    [entriesStoreKey(ENTRY_KINDS.promptSection)]: sections,
    [entriesStoreKey(ENTRY_KINDS.skill)]: expand(ENTRY_KINDS.skill, preset.skills),
    [entriesStoreKey(ENTRY_KINDS.workflow)]: expand(ENTRY_KINDS.workflow, preset.workflows),
    [entriesStoreKey(ENTRY_KINDS.resource)]: expand(ENTRY_KINDS.resource, preset.resources),
    [entriesStoreKey(ENTRY_KINDS.tool)]: expand(ENTRY_KINDS.tool, preset.tools),
    // genui-surface.spec.md SPEC-R11/B2 — no shipped persona scripts a picked pattern source (D3's
    // single-pick is an admin choice, not a persona-authored default); seeded empty like a fresh store.
    [entriesStoreKey(ENTRY_KINDS.patternSource)]: [],
  }
}

// ── the PERSONA roster (GH #406) ──────────────────────────────────────────────────────────────────────
// A `Persona` is what the PAGE switches between: an id + roster metadata + the store SEED. A shipped
// preset becomes one via `personaFromPreset` (its seed = `presetSeed`); an IMPORTED persona (the
// persona-library pattern — agent-admin-persona-file.ts) carries the imported store state as its seed
// directly. That is the whole reason this indirection exists: an imported persona's state is a full
// store snapshot (edited builtins, admin-authored sections, master switches), which the `AgentPreset`
// shape — foundation + surfaceStyle + four seed lists — cannot express without losing bytes, and losing
// bytes is exactly what "identical live behaviour" forbids. Everything below (the store cache, the
// seedVersion migration, reset) keys on the persona id, so both kinds share one mechanism.

export interface Persona {
  id: string
  label: string
  tagline: string
  category?: PresetCategory
  /** The store's `initial` values — a preset's computed seed, or an imported file's state verbatim. */
  seed: Readonly<Record<string, unknown>>
  /** Only a shipped preset declares one (an imported persona's seed is never rewritten in place). */
  seedVersion?: number
  /** True for a persona minted by an import — a library entry, not a shipped preset. */
  imported?: boolean
}

/** A shipped preset as a roster persona. */
export function personaFromPreset(preset: AgentPreset): Persona {
  return {
    id: preset.id,
    label: preset.label,
    tagline: preset.tagline,
    ...(preset.category === undefined ? {} : { category: preset.category }),
    seed: presetSeed(preset),
    ...(preset.seedVersion === undefined ? {} : { seedVersion: preset.seedVersion }),
  }
}

const storeCache = new Map<string, SettingsStore>()

/** The persisted seed-version marker key (GH #46 / PR #60 review). Persisted-wins-over-seed is the
 *  store law — correct for USER edits, but it also makes an in-place PRESET UPGRADE (the Concierge →
 *  Hotel Concierge rewrite) invisible to anyone whose browser carries the old persona's persisted
 *  store. A preset that declares a bumped `seedVersion` performs an EXPLICIT one-time migration: the
 *  stale persisted store (old seed AND any edits made on top of it) is dropped and the new seed
 *  applies — the same semantic as the user's own "Reset persona", triggered by the upgrade instead.
 *
 *  It sits INSIDE the persona store's own namespace, which `resetPersona`'s prefix sweep relies on (the
 *  marker is dropped with the store and rewritten immediately below). Since GH #409 that also means the
 *  store rehydrates a `seedVersion` key of its own — inert by construction: nothing reads that store key,
 *  and the persona file's key set is enumerated (`PERSONA_STATE_KEYS`), so it never reaches an export. */
const seedVersionKey = (id: string): string => `${persistKeyFor(id)}.seedVersion`

/** The persona's store — cached per id so switching away and back keeps one live instance; persisted
 *  values (this persona's OWN prior edits) win over the seed, memory-store.ts's parity law. */
export function personaStore(persona: Persona): SettingsStore {
  let store = storeCache.get(persona.id)
  if (!store) {
    const wanted = persona.seedVersion ?? 1
    if (typeof localStorage !== 'undefined') {
      const persisted = Number(localStorage.getItem(seedVersionKey(persona.id)) ?? '1')
      if (persisted < wanted) resetPersona(persona) // the one-time migration — drops the stale persisted store
      localStorage.setItem(seedVersionKey(persona.id), String(wanted))
    }
    store = createMemoryStore({ initial: persona.seed, persistKey: persistKeyFor(persona.id) })
    storeCache.set(persona.id, store)
  }
  return store
}

/** Reset a persona to its seed: drop every localStorage key under its persistKey (including keys the
 *  user's own edits minted) + the cached store, so the next `personaStore` rebuilds from the pure seed.
 *  For an IMPORTED persona the seed IS the imported file's state — reset returns it to exactly what was
 *  imported, the same "back to how it shipped" semantic a preset gets. */
export function resetPersona(persona: Persona): void {
  if (typeof localStorage !== 'undefined') {
    const prefix = `${persistKeyFor(persona.id)}.`
    // Collect first — removing while iterating by index skips entries (live key list).
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(prefix)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  }
  storeCache.delete(persona.id)
}

export function presetStore(preset: AgentPreset): SettingsStore {
  return personaStore(personaFromPreset(preset))
}

export function resetPreset(preset: AgentPreset): void {
  resetPersona(personaFromPreset(preset))
}

// ── the imported-persona library (GH #406) ────────────────────────────────────────────────────────────
// Imported personas are ROSTER data, so they persist as one localStorage record (metadata + seed), NOT
// as a store: their store is minted from that seed by `personaStore` exactly like a preset's, which is
// what makes an imported persona survive a reload — the roster record restores WHAT the persona is, and
// its own `agent-admin-app.<id>.*` keys restore the edits made since.
//
// The rehydration law, stated exactly (memory-store.ts): a persisted value wins over the seed for every
// key the NAMESPACE holds — construction scans `agent-admin-app.<id>.*` wholesale, so a key first written
// AFTER the import (say a master switch the source persona had never touched) rehydrates exactly like a
// seeded one. GH #409 fixed that: the loop used to iterate the SEED's own keys, which made the seed a
// hidden allowlist — Surface Options and the capability master switches (no preset seed carries them, and
// neither does an export taken before they were ever touched) persisted on write and vanished on reload.

export const IMPORTED_PERSONAS_KEY = `${PERSIST_PREFIX}.importedPersonas`

/** The persisted imported personas, fail-closed: a corrupt/foreign record reads as an EMPTY library
 *  (never a throw at page boot — a broken record must not take the whole admin page down with it). */
export function loadImportedPersonas(): Persona[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(IMPORTED_PERSONAS_KEY)
  if (raw === null) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is Persona =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Persona).id === 'string' &&
        typeof (p as Persona).label === 'string' &&
        typeof (p as Persona).seed === 'object' &&
        (p as Persona).seed !== null,
    )
  } catch {
    return []
  }
}

/** Append one imported persona to the persisted library (last-write-wins on a same-id record — ids are
 *  minted collision-safe against the live roster, so this is a defensive dedupe, not a merge policy). */
export function saveImportedPersona(persona: Persona): void {
  if (typeof localStorage === 'undefined') return
  const next = [...loadImportedPersonas().filter((p) => p.id !== persona.id), { ...persona, imported: true }]
  localStorage.setItem(IMPORTED_PERSONAS_KEY, JSON.stringify(next))
}

/** The full roster the page offers: the shipped presets first, then the imported library in import
 *  order. Read FRESH (never cached) — the page rebuilds nothing else when an import lands. */
export function personaRoster(): Persona[] {
  return [...AGENT_PRESETS.map(personaFromPreset), ...loadImportedPersonas()]
}
