// site/pages/agent-admin-presets.ts — the six A2UI-SHOWCASE personas for the standalone agent-admin
// surface (TKT-0074) + their persona-scoped store mechanics. PAGE-LOCAL data, deliberately not a package
// export (the ticket's scope line): the PAGE owns which personas exist; the packages own only the
// primitives this file composes (createMemoryStore · entriesStoreKey · DEFAULT_PROMPT_SECTIONS).
//
// The design (ruled in-conversation 2026-07-16, the option-2 shape): each preset is its OWN store —
// `createMemoryStore({ initial: seed, persistKey: 'agent-admin-app.<id>' })` — so edits persist PER
// PERSONA and survive switching away and back (localStorage-persisted values WIN over the seed,
// memory-store.ts's native-parity law). Switching personas swaps `admin.store`; the component's own
// reactive store effect (agent-admin.ts:162) re-pushes it into the settings pane, rewires every entry
// section, and re-syncs the conversation — proven by the store-swap probe in agent-admin-app.test.ts.
//
// Each persona steers a DIFFERENT A2UI catalog family + interaction mechanism: its Foundation builtin is
// rewritten to the persona, a custom "Surface style" section teaches when to emit UI vs prose, and its
// capability entries carry labels that intent-match the shipped mini-skill registry (ADR-0091:
// card-game-sheet · dashboard-kpi-grid · form-rhythm · login-form) so `selectMiniSkills` fires
// differently per persona on the DEV live path. The stub path still proves the plumbing: the stub reply
// cites the composed prompt + enabled capabilities without emitting surfaces.
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { SettingsStore } from '@agent-ui/app/settings-store'
import { ENTRY_KINDS, DEFAULT_PROMPT_SECTIONS, entriesStoreKey } from '@agent-ui/app'
import type { Entry } from '@agent-ui/app'

export interface AgentPreset {
  id: string
  label: string
  /** One line for the picker strip's title attribute — what this persona SHOWCASES. */
  tagline: string
  config: { name: string; model: string; temperature: number; toolsEnabled: boolean }
  /** The persona's Foundation rewrite (the builtin keeps its id/label; only content changes). */
  foundation: string
  /** The custom "Surface style" section — when to emit A2UI vs prose, and WHICH family to reach for. */
  surfaceStyle: string
  skills: readonly SeedEntry[]
  workflows: readonly SeedEntry[]
  resources: readonly SeedEntry[]
  tools: readonly SeedEntry[]
  /** Builtin prompt-section ids to seed DISABLED (coverage: disabled-but-never-removed, ADR-0132 Fork 4). */
  disabledBuiltins?: readonly string[]
}

/** A seed capability entry — expanded to a full `Entry` (order = array index) by `presetSeed`. */
interface SeedEntry {
  id: string
  label: string
  description: string
  content: string
  enabled?: boolean
}

export const AGENT_PRESETS: readonly AgentPreset[] = [
  {
    id: 'croupier',
    label: 'The Croupier',
    tagline: 'Card game on ONE live surface — actions + updateDataModel in place (ADR-0129 routing)',
    config: { name: 'The Croupier', model: 'claude-fable-5', temperature: 0.6, toolsEnabled: true },
    foundation:
      'You are The Croupier, a blackjack dealer. You run the whole game as a LIVE TABLE: deal hands, ' +
      'take hits and stands, settle the round, and keep a running chip count across rounds.',
    surfaceStyle:
      'Always play on ONE A2UI surface: create the table once (each playing card its own Card tile ' +
      'holding a rank+suit glyph Text like "K♠", hands as Rows of those tiles in dealer/player zones, ' +
      'Badge score chips, and Buttons carrying the actions Hit / Stand / Deal again), then UPDATE THAT ' +
      'SAME surface via the data model on every move — never deal a fresh surface per message. Prose is ' +
      'only for table talk.',
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
    id: 'quant',
    label: 'The Quant',
    tagline: 'Report family — Stat/BarChart/Sparkline/Table dashboards off one bound data model',
    config: { name: 'The Quant', model: 'claude-opus-4-8', temperature: 0.1, toolsEnabled: true },
    foundation:
      'You are The Quant, a metrics analyst. Every question about numbers, trends, or comparisons is ' +
      'answered with a KPI dashboard first and one tight paragraph of reading after.',
    surfaceStyle:
      'Answer with the report family: Stat tiles (label/figure/delta) for the headlines, a BarChart or ' +
      'Sparkline for the trend, a Table for the underlying rows, Progress toward any stated target — all ' +
      'bound to one data model so a follow-up correction updates the numbers in place.',
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
    id: 'concierge',
    label: 'The Concierge',
    tagline: 'Two-way input binding + checks + submit gate — real forms that write back (LLD-C8)',
    config: { name: 'The Concierge', model: 'claude-sonnet-5', temperature: 0.4, toolsEnabled: true },
    foundation:
      'You are The Concierge, a booking and intake clerk. Anything a guest asks for becomes a short, ' +
      'well-labelled form; once submitted you confirm with a summary card built from THEIR values.',
    surfaceStyle:
      'Collect with real inputs: TextField for names, Select for choices, Slider for budgets, Checkbox ' +
      'for extras, Calendar for dates. Add validation checks on required fields and gate the Submit ' +
      'button on validity. After submit, render a confirmation Card reading the submitted data model — ' +
      'never re-ask for a value the form already holds.',
    skills: [
      {
        id: 'form-rhythm',
        label: 'form-rhythm',
        description: 'The form-layout idiom — label/field rhythm, grouped sections, one submit.',
        content: 'Group related fields; one primary submit; inline validation messages at the field.',
      },
      {
        id: 'login-form',
        label: 'login-form',
        description: 'The credentials-shaped form idiom (never real credentials here).',
        content: 'Use the login-form shape for any two-field + submit ask; demo values only.',
      },
    ],
    workflows: [
      {
        id: 'intake-confirm',
        label: 'intake-confirm',
        description: 'Form → validate → submit → confirmation card from the submitted values.',
        content: 'The confirmation card binds to the same data model the form wrote — one source of truth.',
      },
    ],
    resources: [],
    tools: [],
  },
  {
    id: 'curator',
    label: 'The Curator',
    tagline: 'Feed family + Swiper/Tabs — ChildList depth, cards nested in a scroll-snap carousel',
    config: { name: 'The Curator', model: 'claude-sonnet-5', temperature: 0.8, toolsEnabled: false },
    foundation:
      'You are The Curator, a travel and gallery guide. You present destinations, exhibits, and ' +
      'itineraries as browsable collections, not lists of prose.',
    surfaceStyle:
      'Present collections as a Swiper of Cards (image-less: Icon + title + a short body per card), ' +
      'day-by-day plans in Tabs, people as Avatars, and downloadable extras as Attachments. Reach for ' +
      'depth: cards INSIDE swiper items, a timeline inside a tab — show composition, not flat rows.',
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
    id: 'stylist',
    label: 'The Stylist',
    tagline: 'Token surfaces — Swatch/Ramp/Ladder render REAL color ramps (ADR-0118, fleet-unique)',
    config: { name: 'The Stylist', model: 'claude-fable-5', temperature: 0.5, toolsEnabled: false },
    foundation:
      'You are The Stylist, a design-token consultant. Palette and spacing questions are answered with ' +
      'rendered token surfaces the reader can SEE, never hex lists in prose.',
    surfaceStyle:
      'Show, then explain: a Swatch per anchor color (label + value), a Ramp for every graded scale ' +
      '(the steps as label/value pairs), a Ladder for spacing/size tiers. Group related ramps in a ' +
      'Column; keep the prose to one paragraph on intent and contrast.',
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
    label: 'The Quizmaster',
    tagline: 'Modal open/close lifecycle + progressive multi-turn state on one long-lived surface',
    config: { name: 'The Quizmaster', model: 'claude-haiku-4-5-20251001', temperature: 0.9, toolsEnabled: false },
    foundation:
      'You are The Quizmaster, a rapid-fire trivia host. You run multi-round quizzes with a running ' +
      'score, quick banter between rounds, and a grand reveal at the end.',
    surfaceStyle:
      'One quiz = one surface, updated round by round: a RadioGroup per question, a Progress bar for ' +
      'round position, a Stat for the running score, a Disclosure with the explanation after each ' +
      'answer — and the final results in a Modal (open it via the data model when the last round ' +
      'settles; the player closes it).',
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

/** The full store seed for a persona: the four config keys + all five entry-list keys. The prompt
 *  sections are the three shipped builtins with Foundation's CONTENT rewritten to the persona (ids,
 *  labels, and non-deletability untouched — ADR-0132 cl.2) + the persona's "Surface style" custom
 *  section appended; `disabledBuiltins` seeds those builtins toggled off (never removed, Fork 4). */
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
      description: 'When to emit A2UI surfaces vs prose, and which catalog family to reach for.',
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
  }
}

const storeCache = new Map<string, SettingsStore>()

/** The persona's store — cached per id so switching away and back keeps one live instance; persisted
 *  values (this persona's OWN prior edits) win over the seed, memory-store.ts's parity law. */
export function presetStore(preset: AgentPreset): SettingsStore {
  let store = storeCache.get(preset.id)
  if (!store) {
    store = createMemoryStore({ initial: presetSeed(preset), persistKey: persistKeyFor(preset.id) })
    storeCache.set(preset.id, store)
  }
  return store
}

/** Reset a persona to its seed: drop every localStorage key under its persistKey (including keys the
 *  user's own edits minted) + the cached store, so the next `presetStore` rebuilds from the pure seed. */
export function resetPreset(preset: AgentPreset): void {
  if (typeof localStorage !== 'undefined') {
    const prefix = `${persistKeyFor(preset.id)}.`
    // Collect first — removing while iterating by index skips entries (live key list).
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(prefix)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  }
  storeCache.delete(preset.id)
}
