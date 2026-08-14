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
import { HOSPITALITY_SKILLS, HOSPITALITY_PLAYBOOKS, INTEGRATION_TOOLS, GAMES_SKILLS, GAMES_PLAYBOOKS, GAMES_RULES, CORE_PLAYBOOKS, type PresetCategory } from './agent-admin-libraries.ts'
// GH #497 — the concierge/croupier content personas seed their OWN local pattern set selection (the
// `SHIPPED_PERSONA_CATALOGS` `personaId`, SPEC-R5) the same way every other persona-scoped config key
// seeds: through `presetSeed`'s returned record, keyed by the schema's own storage key.
// GH #525 — the persistent-bankroll capability opt-in seeds the SAME way (design call 2, 2026-08-07: a
// games-category capability, presets opt in).
import { A2UI_LOCAL_PATTERNS_KEY, BANKROLL_CAPABLE_KEY } from '@agent-ui/app/agent-admin-schema'
// ADR-0178 cl.3/cl.4 (GH #633) — the Builder persona's own gate seeds + the CANONICAL key vocabulary its
// generated prompt section is composed from (never a hand-listed copy — see `vocabularySection`).
import { SURFACE_A2UI_KEY, SURFACE_AUTHORING_KEY, modelRoster } from '@agent-ui/app/agent-admin-schema'
import { PATCHABLE_VALUE_SHAPES, PERSONA_ENTRY_LIST_KEYS, PERSONA_VALUE_KEYS } from '@agent-ui/app/agent-admin-persona-patch'

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
  /** GH #497 — this persona's `SHIPPED_PERSONA_CATALOGS` `personaId` (`concierge`/`croupier`), seeded as
   *  its `A2UI_LOCAL_PATTERNS_KEY` selection. Absent (every OTHER preset) ⇒ no local set seeded — the
   *  SAME fail-closed default `A2UI_CATALOG_KEY` already has (no preset seeds that either, `presetSeed`'s
   *  own comment). Not validated against `SHIPPED_PERSONA_CATALOGS` here — `sanitizeLocalPatterns`
   *  (agent-admin-schema.ts) is the one fail-closed read gate; a typo here would just read as "none". */
  localPatterns?: string
  /** GH #525 (design call 2, 2026-08-07) — opts this persona into the persistent-bankroll capability:
   *  its games keep a running score at the FIXED data-model path `/bankroll`, so the app may mirror that
   *  pointer into the persona store after every surface turn and state the stored figure back at turn
   *  start. Absent (every OTHER preset) ⇒ `BANKROLL_CAPABLE_KEY` is never seeded — the SAME "key omitted
   *  entirely" default `localPatterns` above already has; a persona whose games track something ELSE
   *  (the Quizmaster's round score, say) must never have its turns scanned for a pointer it never writes. */
  bankroll?: boolean
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
    category: 'games', // GH #143 — a card table, thematically a game even though it predates the games-roster wave
    seedVersion: 5, // GH #525 — the persistent-bankroll capability opt-in + the surfaceStyle amendment stating cross-session resume; migrates pre-#525 stores
    label: 'The Croupier',
    tagline: 'Card games — Blackjack, Poker, and their variants — on ONE live surface (ADR-0129 routing)',
    config: { name: 'The Croupier', model: 'claude-sonnet-5', temperature: 0.6, toolsEnabled: true }, // rev.4: fable retired from the roster
    localPatterns: 'croupier', // GH #497 — PlayingCard closes the glyph-formatting idiom structurally
    bankroll: true, // GH #525 — opts into the persistent cross-session bankroll capability, croupier enabled first
    foundation:
      'You are The Croupier, a card-table dealer. You deal whatever game the table calls for — Blackjack ' +
      'and its variants, Hold’em, draw and stud Poker — as a LIVE TABLE: deal hands, take the player’s ' +
      'actions, settle each round, and keep a running chip count across rounds. When the player names a ' +
      'game, deal that game; when they do not, pick one AT RANDOM from your enabled game-rules resources, ' +
      'announce the pick, and recap its table rules in one breath before the first deal. Play strictly by ' +
      'the chosen game’s rules resource.',
    surfaceStyle:
      'Always play on ONE persistent game surface: build the table once — the hands, the running score, ' +
      'and the current game’s action controls (Hit / Stand for blackjack, Check / Bet / Fold for poker, ' +
      'Deal again between rounds) — then UPDATE THAT SAME surface in place on ' +
      'every move; never redraw a fresh surface per message. Prose is only for table talk; the surface ' +
      'always carries the state. Every round ends with an explicit result line — the winner, the ' +
      'winning hand spelled out, and the chip delta — never a bare status badge; zero the pot ONLY in ' +
      'the SAME update that states the result. That running chip count is your bankroll: ONE figure on ' +
      'the surface, always visible, updated by every settlement, and carried across a game switch — a ' +
      'new game never resets it to a fresh stake. If you are told a current bankroll at the start of ' +
      'this conversation, seed that SAME figure as your very first surface state — the running count ' +
      'carries across a whole session exactly like it carries across a game switch.',
    skills: [
      {
        // GH #497 — the glyph-formatting/face-down half retired: `PlayingCard` (the croupier local
        // pattern set, seeded via `localPatterns` above) now closes that idiom structurally (rank/suit
        // enums, a `faceDown` boolean) rather than by prose — mirrors the SAME trim in the byte-pinned
        // `card-layout.md` mini-skill (`a2ui-prompt-author`'s recapture flow). The hand-arrangement half
        // stays prose (§1's table: a pure `Row` arrangement, no new schema surface).
        id: 'card-layout',
        label: 'card-layout',
        description: 'Playing cards arranged as a hand — a Row of tiles, never loose text lines.',
        content: 'A hand is a Row of tiles, never loose text lines.',
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
    // Every GAMES_RULES entry seeds enabled — the random pick draws from the ENABLED rules resources,
    // so toggling one off takes that game off the table (unfiltered: a future rules addition joins the
    // rotation automatically, the GH #497 scoping precedent).
    resources: seedFrom(GAMES_RULES),
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
    seedVersion: 5, // GH #497 — added the `concierge` local pattern set (BookingForm/BookingConfirmation); migrates pre-#497 stores
    label: 'The Hotel Concierge',
    tagline: 'The full hospitality stack: booking forms + galleries + itineraries + live weather/FX integrations (GH #46/#49)',
    config: { name: 'The Hotel Concierge', model: 'claude-sonnet-5', temperature: 0.4, toolsEnabled: true },
    // GH #497 — BookingForm/BookingConfirmation close the booking-flow idiom structurally: the concierge's
    // own seed drops the now-redundant HAND-AUTHORED 'hotel-booking-form' skill + 'booking-flow' playbook
    // below (never edits the shared library entries themselves — `restaurant` still picks
    // 'hotel-booking-form' by hand, out of this note's scope) so a fresh concierge session teaches the
    // idiom exactly ONCE, structurally, never a stale duplicate alongside it.
    localPatterns: 'concierge',
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
    // 'hotel-booking-form' EXCLUDED (not a `pick` list — the OTHER five entries stay unfiltered so a
    // future HOSPITALITY_SKILLS addition is picked up automatically, GH #497's own scoping).
    skills: seedFrom(HOSPITALITY_SKILLS).filter((s) => s.id !== 'hotel-booking-form'),
    workflows: seedFrom(HOSPITALITY_PLAYBOOKS, ['table-reservation']), // 'booking-flow' dropped — see localPatterns comment above
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

/** The full store seed for a persona: the four config keys + EVERY entry-list key (genui-surface
 *  SPEC-R11/B2 added `pattern-source` and ADR-0170 added `catalog`, both seeded EMPTY — no shipped persona
 *  scripts a picked source or curates a catalog shelf; the admin picks per agent, same as any
 *  hand-authored entry). The prompt sections are the three
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
    // GH #497 — absent ⇒ key omitted entirely (not seeded `undefined`), matching every other
    // never-seeded persona-scoped key's byte-identical "absent" shape.
    ...(preset.localPatterns === undefined ? {} : { [A2UI_LOCAL_PATTERNS_KEY]: preset.localPatterns }),
    // GH #525 — the SAME "absent ⇒ key omitted entirely" shape: only a preset that opts in seeds the
    // capability flag at all; every other persona's store never carries `BANKROLL_CAPABLE_KEY`, so
    // `isBankrollCapable`'s fail-closed read answers "not capable" exactly as if this key never existed.
    ...(preset.bankroll === true ? { [BANKROLL_CAPABLE_KEY]: true } : {}),
    [entriesStoreKey(ENTRY_KINDS.promptSection)]: sections,
    [entriesStoreKey(ENTRY_KINDS.skill)]: expand(ENTRY_KINDS.skill, preset.skills),
    [entriesStoreKey(ENTRY_KINDS.workflow)]: expand(ENTRY_KINDS.workflow, preset.workflows),
    [entriesStoreKey(ENTRY_KINDS.resource)]: expand(ENTRY_KINDS.resource, preset.resources),
    [entriesStoreKey(ENTRY_KINDS.tool)]: expand(ENTRY_KINDS.tool, preset.tools),
    // genui-surface.spec.md SPEC-R11/B2 — no shipped persona scripts a picked pattern source (D3's
    // single-pick is an admin choice, not a persona-authored default); seeded empty like a fresh store.
    [entriesStoreKey(ENTRY_KINDS.patternSource)]: [],
    // ADR-0170 cl.1/cl.4 — the catalog ROSTER, seeded empty on the SAME rationale: no shipped persona
    // curates a catalog shelf, and the Default row is guaranteed at READ time (`readCatalogEntries`), so
    // an empty seed and an absent key render identically. The persona's SELECTION is `A2UI_CATALOG_KEY`,
    // which no preset seeds either — every persona starts on the default catalog, fail-closed.
    [entriesStoreKey(ENTRY_KINDS.catalog)]: [],
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

// ── GH #845 — roster management: an explicit display order, delete, rename (LLD-C11/C12/C13) ──────────
// The page-owned half of the Edit Agents drawer. Everything here is plain functions over localStorage +
// the existing library record — the component knows none of it (it receives `AgentRosterEntry[]`, and the
// only new field it reads, `deletable`, is a visibility gate whose MEANING is decided right here).

/**
 * LLD-C11/§8a — the persisted display order: `string[]` of persona ids, the roster's own reading order.
 *
 * An explicit ORDER ARRAY, ruled over widening the library record: a per-record field cannot order shipped
 * PRESETS relative to imported entries (presets never live in `IMPORTED_PERSONAS_KEY` at all), and AC6
 * reorders the whole roster, presets included.
 */
export const ROSTER_ORDER_KEY = `${PERSIST_PREFIX}.rosterOrder`

/** Fail-closed exactly like `loadImportedPersonas` — a corrupt/foreign record reads as NO order (which
 *  degrades to today's byte-exact natural order), never a throw at page boot. */
export function loadRosterOrder(): string[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(ROSTER_ORDER_KEY)
  if (raw === null) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function saveRosterOrder(ids: readonly string[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ROSTER_ORDER_KEY, JSON.stringify([...ids]))
}

/**
 * The full roster the page offers: the shipped presets first, then the imported library in import order —
 * then GH #845's stored order applied ON TOP, here and only here.
 *
 * `personaRoster()` itself is the ONE choke point (LLD §8a): every caller — this page or another — sees
 * one order, so a reorder can never be half-applied. Listed ids first, in stored order (an id no longer
 * present is SKIPPED, so a ghost left by a delete elsewhere can never resurrect); everything unlisted is
 * appended in the natural order above, so a fresh mint/import lands at the END and an absent/empty/corrupt
 * order record reproduces today's order byte for byte.
 *
 * Read FRESH (never cached) — the page rebuilds nothing else when an import lands.
 */
export function personaRoster(): Persona[] {
  const natural = [...AGENT_PRESETS.map(personaFromPreset), ...loadImportedPersonas()]
  const order = loadRosterOrder()
  if (order.length === 0) return natural
  const byId = new Map(natural.map((p) => [p.id, p]))
  const listed: Persona[] = []
  for (const id of order) {
    const persona = byId.get(id)
    if (persona === undefined) continue // a ghost id — skipped, never resurrected
    byId.delete(id) // and never listed twice, however corrupt the record
    listed.push(persona)
  }
  return [...listed, ...natural.filter((p) => byId.has(p.id))]
}

/**
 * LLD-C12/§8b — delete a custom persona: its roster record AND every persisted key it ever wrote.
 *
 * IMPORTED-ONLY, fail-closed (`false` on a shipped preset, removing nothing): the page never offers the
 * affordance for a preset and the component hides it structurally, so this guard is defense in depth —
 * three independent layers, none of which is the only one.
 *
 * Composes `resetPersona` rather than re-implementing its sweep: delete = reset + forget the records.
 * `resetPersona` is the TESTED key-sweep (every `agent-admin-app.<id>.*` key including the seedVersion
 * marker, which lives inside the namespace by design, plus the cached store instance); what it
 * deliberately does NOT touch is the two RECORDS that say the persona exists at all — its contract is
 * "back to shipped state", not "gone" — so this function removes those two on top: the library entry and
 * the order-array mention. `ACTIVE_PRESET_KEY` is NOT this function's concern: the page's own fallback
 * `applyPersona` rewrites it, and a persistence function has no business deciding who becomes active.
 */
export function deleteImportedPersona(persona: Persona): boolean {
  if (persona.imported !== true) return false
  resetPersona(persona)
  if (typeof localStorage === 'undefined') return true
  localStorage.setItem(IMPORTED_PERSONAS_KEY, JSON.stringify(loadImportedPersonas().filter((p) => p.id !== persona.id)))
  saveRosterOrder(loadRosterOrder().filter((id) => id !== persona.id))
  return true
}

/**
 * LLD-C13/§8c — rename a custom persona durably.
 *
 * Imported-only (same fail-closed guard). The LIVE record is re-read through `loadImportedPersonas()`
 * rather than trusting the caller's possibly-stale object, then written back through the existing
 * last-write-wins `saveImportedPersona` — so a rename can never resurrect a stale `seed` a concurrent
 * edit had already moved on from. The record's `seed` BYTES are untouched: a persona's edits live under
 * its store keys, not in this record, so nothing about the agent itself changes and no reload semantics
 * appear anywhere. It survives a reload because this record IS what `personaRoster()` reads at boot.
 */
export function renameImportedPersona(persona: Persona, label: string): boolean {
  if (persona.imported !== true) return false
  const trimmed = label.trim()
  if (trimmed.length === 0) return false
  const current = loadImportedPersonas().find((p) => p.id === persona.id)
  if (current === undefined) return false
  saveImportedPersona({ ...current, label: trimmed })
  return true
}

// ── the Builder (ADR-0178 cl.4 / LLD-C7, GH #633) ─────────────────────────────────────────────────────
// The host-authored interviewer behind "New agent → Generate": it asks the user what they want, and
// declares what it learns as `personaPatch` meta-line arms that the admin applies to the DRAFT through
// ADR-0178 cl.2's three-filter gate.
//
// DELIBERATELY NOT IN `AGENT_PRESETS`/`personaRoster()` (OF4's recommendation, adopted as the default):
// hidden-until-invoked. The roster is a SHOWCASE of personas a user picks between; the Builder is
// machinery the flow arms for them. Reversing this is one array-membership line if it ever earns a row.
//
// Its store is a FRESH `createMemoryStore` per flow entry with NO `persistKey`: nothing user-editable
// reaches the Builder (no pane binds it — the panes all bind the DRAFT), so persisting it could only
// accumulate drift against host-authored config, never preserve a user's work.

/** The interview craft — CONFIG, like every other persona's prompt content. What it must NOT carry is
 *  the `personaPatch` WIRE MECHANICS: those compose from S2's byte-pinned `authoring-teaching.md` under
 *  the authoring gate (ADR-0178 cl.1 rule 5). The boundary holds because garbled VOCABULARY degrades to
 *  dropped keys (filter 1, fail-closed, recoverable in the next turn), whereas garbled MECHANICS would
 *  be unrecoverable — which is exactly why mechanics stay host-owned and byte-pinned, and only
 *  vocabulary may be config. */
const BUILDER_PRESET: AgentPreset = {
  id: 'builder',
  label: 'Builder',
  tagline: 'Interviews you about the agent you want, and fills in the draft as you talk',
  // A SONNET-class id (picked at build against the shipped roster, per LLD §15): interview quality is
  // the whole product here — a cheaper tier asks blunter questions and mis-reads what the user meant,
  // and the flow is a handful of turns per agent, so the cost difference is negligible.
  config: { name: 'Builder', model: 'claude-sonnet-5', temperature: 0.5, toolsEnabled: false },
  foundation:
    'You are the Builder. You interview someone about an AI agent they want to create, and you fill in ' +
    'their draft agent as the conversation goes — they watch it take shape while you talk. ' +
    'Ask about ONE thing at a time and wait for the answer; a wall of questions gets a wall of ' +
    'half-answers. Ask before assuming: if the user has not told you the agent’s temperament, its name, ' +
    'or how it should present its output, ask — never invent a preference and record it as theirs. ' +
    'Work from what a complete agent needs: a name, a purpose, a temperament, the capabilities it ' +
    'should have (skills, workflows, resources, tools), and how it should render its replies. ' +
    'Send only what THIS turn actually established — never re-send the whole draft, and never re-send ' +
    'a value the user has not changed. If the user edits the draft by hand while you talk, that edit ' +
    'wins: you are told the draft’s current state at the start of every turn, so read it and carry on ' +
    'from there rather than overwriting them. When the draft looks complete, say so plainly and offer ' +
    'to try it out rather than continuing to ask.',
  surfaceStyle:
    'Stay in prose for the interview itself — the draft’s own settings panes are already showing the ' +
    'user what you have filled in, so restating it on a surface would say the same thing twice. Reach ' +
    'for a surface only when a choice is genuinely easier to make by picking than by typing: offering a ' +
    'short set of temperament or capability options, for instance. Keep any such surface to the one ' +
    'decision at hand and let the panes carry the state.',
  skills: [],
  workflows: [],
  resources: [],
  tools: [],
}

/** The GENERATED key-vocabulary section (LLD §2's fork row) — composed at mint time from
 *  `persona-patch.ts`'s canonical exports, never hand-listed. SPEC-R29 makes the producer
 *  persona-key-agnostic, so this vocabulary can only reach the model from the host side; generating it
 *  from the SAME module the apply gate enumerates is what keeps the two from drifting. */
function vocabularySection(): Entry {
  const roster = modelRoster()
    .map((m) => m.id)
    .join(', ')
  const values = PERSONA_VALUE_KEYS.map((key) => `- \`${key}\` — ${(PATCHABLE_VALUE_SHAPES[key] ?? '').replace('{roster}', roster)}`).join('\n')
  const entries = PERSONA_ENTRY_LIST_KEYS.map((key) => `- \`${key}\``).join('\n')
  // ADR-0178's ratified amendment (GH #696) — WHICH sections are replaceable, and what each is for, is
  // VOCABULARY (the mechanics of how a replacement is expressed stay in the byte-pinned teaching, cl.1
  // rule 5). Generated from `DEFAULT_PROMPT_SECTIONS` itself: a hand-listed trio would teach an id the
  // apply gate no longer recognizes the moment the seed changed, which is the exact drift this whole
  // section is generated to avoid.
  const builtinSections = DEFAULT_PROMPT_SECTIONS.map((s) => `- \`${s.id}\` — **${s.label}**: ${s.description}`).join('\n')
  const promptSectionKey = entriesStoreKey(ENTRY_KINDS.promptSection)
  // The worked example names the LEADING seeded section, read off the seed — never a literal id, and never a
  // literal fallback id either: an empty string here would REDDEN the drift gate, which is what a broken seed
  // should do rather than quietly teaching a plausible-looking id the gate would drop.
  const lead = DEFAULT_PROMPT_SECTIONS[0]
  return {
    id: 'patchable-keys',
    kind: ENTRY_KINDS.promptSection,
    label: 'Draft keys you may set',
    description: 'The draft agent’s own configuration keys, generated from the host’s apply gate.',
    content:
      'These are the ONLY keys of the draft agent you may set. Anything else is dropped silently, so ' +
      'sending it just wastes the turn.\n\n' +
      `## Single values\n\n${values}\n\n` +
      `## Lists you may APPEND to\n\n${entries}\n\n` +
      'Each list member is an object with a `label` (required) and optional `description`/`content`.\n\n' +
      `## Built-in sections you may REPLACE\n\n${builtinSections}\n\n` +
      'The draft starts with these sections already holding generic placeholder text nobody wrote. ' +
      'Fill them in — that is what makes the agent’s own identity lead its prompt instead of sitting ' +
      'underneath boilerplate. Send the section’s `id` and the new `content` on the ' +
      `\`${promptSectionKey}\` list, and it replaces that section’s text in place. For example, writing the ` +
      `agent’s own role into its ${lead?.label ?? ''} section:\n\n` +
      `    {"entries":{"${promptSectionKey}":[{"id":"${lead?.id ?? ''}","content":"You are Casey, a restaurant ` +
      'concierge for the guests of one hotel. You find them a table, book it, and tell them plainly when ' +
      'you cannot."}]}}\n\n' +
      'Everything else about lists is unchanged: appending is the only other thing you can do to one, and ' +
      'you can never remove anything or empty a built-in section. A user’s own authored entries are safe ' +
      'from you by construction; the placeholder scaffolding the draft ships with is yours to fill in.',
    order: 99, // last — the reference material reads after the craft
    enabled: true,
    builtin: false,
  }
}

/** The Builder as a `Persona` — same shape the roster uses, just never IN the roster. */
export function builderPersona(): Persona {
  const seed = presetSeed(BUILDER_PRESET)
  const sections = [...(seed[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]), vocabularySection()]
  return {
    id: 'builder',
    label: BUILDER_PRESET.label,
    tagline: BUILDER_PRESET.tagline,
    seed: {
      ...seed,
      [entriesStoreKey(ENTRY_KINDS.promptSection)]: sections,
      // The point of the whole persona: its own turns are taught the personaPatch arm (SPEC-R30).
      [SURFACE_AUTHORING_KEY]: true,
      // ADR-0097's shipped machinery is how an interview question becomes something clickable — the
      // ask arm rides an ordinary A2UI surface through `ingestLine`, so zero new question mechanics.
      [SURFACE_A2UI_KEY]: true,
    },
  }
}

/** A FRESH store per flow entry — no `persistKey`, no cache (see this section's header for why).
 *
 *  GH #670 — `model` is the Author card's PRE-ARM pick, folded into the seed rather than written after the
 *  fact: the interview's own config read then finds the user's choice already committed, so the pick wins by
 *  construction and there is no overwrite step to lose a race with. Absent ⇒ the Builder preset's own
 *  Sonnet-class id stands (LLD §15: interview quality is the product). */
export function builderStore(model?: string): SettingsStore {
  const seed = builderPersona().seed
  return createMemoryStore({ initial: model === undefined ? seed : { ...seed, model } })
}
