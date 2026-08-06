// site/pages/agent-admin-libraries.ts — the entry-library packs the agent-admin app offers per capability
// kind (GH #47 skills · GH #48 workflows). PAGE-LOCAL data, deliberately not a package export (the
// agent-admin-presets.ts scope law: the page owns which packs exist; the packages own only the generic
// library seam this file feeds — `EntryLibraryPack` + entry-list's add-from-library menu).
//
// Three of the packs derive LIVE from a registry rather than being authored here: #1 + the GenUI packs
// from the shipped `.md` registries (raw-globbed below), and "Registered catalogs" from the
// `A2UI_CATALOG_OPTIONS` import (ADR-0170 cl.7 — the bottom of ADMIN_LIBRARIES).
//
// Pack #1 derives LIVE from the shipped mini-skill registry: the SAME `prompts/mini-skills/*.md` files
// `@agent-ui/a2ui`'s `MINI_SKILLS` loads node-side are raw-globbed here by Vite (the registry's own
// loader is `node:fs`-based, ADR-0135 cl.11 — unimportable in the browser), so a registry edit flows into
// the pack with zero hand-copying. The frontmatter split below mirrors `prompts/frontmatter.ts` (not an
// exported subpath; the format is three trivial lines — id/triggers + body).
import { ENTRY_KINDS, A2UI_CATALOG_OPTIONS, type EntryLibraryPack, type NewEntryInput } from '@agent-ui/app'

// ── pack #1: the shipped A2UI composition idioms, derived from the registry's own .md files ─────────────

const MINI_SKILL_SOURCES = import.meta.glob('../../packages/agent-ui/a2ui/src/agent/prompts/mini-skills/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** The minimal single-line-`key: value` frontmatter split (mirrors prompts/frontmatter.ts, which is not
 *  on the a2ui exports map). Returns null for a file without the leading `---` fence — skipped, never
 *  thrown (a malformed registry file is the registry gate's problem, not this page's). */
function splitFrontmatter(source: string): { data: Record<string, string>; body: string } | null {
  // `\r?` throughout — a CRLF-normalized checkout must not silently drop registry files from the pack
  // (PR #58 review finding; no .gitattributes pins *.md to LF in this repo).
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  if (!match) return null
  const data: Record<string, string> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at > 0) data[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { data, body: match[2]!.trim() }
}

const registryEntries: NewEntryInput[] = Object.keys(MINI_SKILL_SOURCES)
  .sort()
  .flatMap((path) => {
    const parsed = splitFrontmatter(MINI_SKILL_SOURCES[path]!)
    if (!parsed?.data.id) return []
    return [{
      label: parsed.data.id,
      description: parsed.data.triggers ?? '',
      content: parsed.body,
    }]
  })

// ── pack #4 (genui-surface.spec.md SPEC-R9/R11, D4): the shipped GenUI pattern-source packs, derived
// LIVE from `@agent-ui/a2ui`'s `prompts/genui-packs/*.md` — the SAME Vite raw-glob technique pack #1 uses
// above (`GENUI_PACKS`'s own loader is `node:fs`-based, Node-only by SPEC-R9, unimportable in the
// browser). Each pack projects to ONE `EntryLibraryPack` carrying ONE ready-to-add entry whose `content`
// is the pack body verbatim — mirroring `@agent-ui/a2ui/agent`'s own `genuiPackLibrary` projection
// (SPEC-R11), reimplemented here rather than imported because that function's INPUT type
// (`GenuiPatternPack`) is Node-loaded data this browser-side glob produces independently, not a value
// this page could hand it without ALSO importing the Node-only registry module.
const GENUI_PACK_SOURCES = import.meta.glob('../../packages/agent-ui/a2ui/src/agent/prompts/genui-packs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const GENUI_PACK_LIBRARY: EntryLibraryPack[] = Object.keys(GENUI_PACK_SOURCES)
  .sort()
  .flatMap((path) => {
    const parsed = splitFrontmatter(GENUI_PACK_SOURCES[path]!)
    if (!parsed?.data.id || !parsed.data.label) return []
    const description = parsed.data.description ?? ''
    return [
      {
        id: parsed.data.id,
        label: parsed.data.label,
        description,
        entries: [{ label: parsed.data.label, description, content: parsed.body }],
      },
    ]
  })

// ── the authored packs (hospitality lands with GH #46's trio; games join with the roster wave) ──────────

export const HOSPITALITY_SKILLS: readonly NewEntryInput[] = [
  {
    label: 'hotel-booking-form',
    description: 'room, spa, amenity, restaurant, breakfast booking; reservation intake',
    content:
      'A booking ask becomes ONE Card: a short form (Calendar for dates — range for stays, single for slots; ' +
      'Select for room/table/treatment type; Slider for budget where price flexes; Checkbox for extras), ' +
      'required-field checks gating ONE Submit button, and after submit a confirmation Card bound to the ' +
      'SAME data-model values the form wrote — never re-ask a value the model already holds.',
  },
  {
    label: 'gallery-swiper',
    description: 'photos, gallery, rooms tour, venue, showcase',
    content:
      'Photo/tour asks render a Swiper (loop + pagination + paddles), one SwiperItem per exhibit: a Card ' +
      'with a title Text, a caption Text (body/sm), and a Badge for the standout fact (view, size, rating). ' +
      'No Image type exists in the catalog — the card IS the exhibit; lead with evocative text, never a broken src.',
  },
  {
    label: 'itinerary-timeline',
    description: 'itinerary, day plan, schedule, local trip, excursion',
    content:
      'Itineraries are a Timeline: one TimelineItem per stop (status: done/active/pending as the day ' +
      'progresses), title + one-line detail, times as Badge chips. Cap at ~6 stops per surface; offer a ' +
      'follow-up action Button ("Evening plan") instead of scrolling sprawl.',
  },
  {
    label: 'menu-card',
    description: 'restaurant menu, wine list, bar, dishes, courses, tasting',
    content:
      'Menus render as a Card per course/section: a title Text, a List of dishes (name + one-line ' +
      'description), price as a trailing Badge. Wine/pairing asks add a second column via Row. Dietary ' +
      'marks are text chips (gf/veg), never color-only.',
  },
  {
    label: 'facility-info-card',
    description: 'hours, directions, pool, gym, spa facilities, policy questions',
    content:
      'Facility/policy answers are ONE compact Card: the fact as a title Text, hours/location as labeled ' +
      'body rows, and at most two action Buttons (book, directions). Prose answers stay in chat; the card ' +
      'carries only the structured facts.',
  },
]

export const CORE_PLAYBOOKS: readonly NewEntryInput[] = [
  {
    label: 'intake-confirm',
    description: 'collect structured input then confirm from the submitted values',
    content:
      'Form → validate → submit → confirmation. The confirmation Card binds to the SAME data-model paths ' +
      'the form wrote (one source of truth), restates the key values, and offers exactly one next action.',
  },
  {
    label: 'round-loop',
    description: 'turn-based game or task rounds on one persistent surface',
    content:
      'One surface, updated in place: each user action drives ONE updateDataModel turn (never a fresh ' +
      'surface per round). Keep score/state in the data model; disable action Buttons that are invalid in ' +
      'the current state rather than removing them.',
  },
  {
    label: 'drilldown',
    description: 'overview first, detail on demand',
    content:
      'Lead with the aggregate view (Stat row / Table / chart). Every row or tile that HAS depth gets an ' +
      'action; the drill-in updates the SAME surface with a back action, never a second parallel surface.',
  },
]

export const HOSPITALITY_PLAYBOOKS: readonly NewEntryInput[] = [
  {
    label: 'booking-flow',
    description: 'hotel room / spa / amenity booking end to end',
    content:
      'Availability question → intake form (dates, party size, preferences) → validity-gated submit → ' +
      'confirmation card from the submitted values → offer ONE follow-up (add breakfast, spa slot, ' +
      'itinerary). Never collect payment details; hand off with a reference code instead.',
  },
  {
    label: 'table-reservation',
    description: 'restaurant table booking + menu enquiry in one thread',
    content:
      'Menu enquiry renders the menu-card idiom; a reservation ask switches to a compact form (date, time ' +
      'Select from service windows, covers). After confirm, the card restates table details AND echoes any ' +
      'dish interests the guest mentioned, as text.',
  },
  {
    label: 'trip-plan',
    description: 'multi-leg travel planning: compare, choose, summarize',
    content:
      'Legs render as comparison Cards in a Row (mode, duration, price Badge). The user picks via an ' +
      'action per card; chosen legs accumulate into an itinerary-timeline surface updated in place. End ' +
      'with a summary Card + total, bound to the accumulated data model.',
  },
]

// ── the Games packs (the games-roster wave) — board/HUD idioms the six game personas seed from ─────────

export const GAMES_SKILLS: readonly NewEntryInput[] = [
  {
    label: 'board-grid',
    description: 'battleship, minesweeper, grid targeting, cell board',
    content:
      'A game board is a Grid of cell Buttons (ghost variant), each with action:{action:"cell", context:' +
      '{row, col}} — the coordinates ride the action context, never the label. Keep boards ≤ 6×6 per ' +
      'surface; mark hits/misses by swapping the cell label to a glyph (✕ / ●) via the data model, and ' +
      'disable resolved cells rather than removing them.',
  },
  {
    label: 'guess-hud',
    description: 'twenty questions, guessing progress, confidence, question log',
    content:
      'A guessing game runs on one HUD surface: a Timeline of asked questions (status done/active), a ' +
      'Progress bar for questions used, a Stat for confidence (update its delta each round), and a ' +
      'SegmentedControl for the answer (Yes / No / Sort of). The final guess opens a Modal via the data ' +
      'model; the player closes it.',
  },
  {
    label: 'word-tiles',
    description: 'wordle, letter grid, word guess, spelling game',
    content:
      'Word guesses render as a Grid of Badge tiles — one row per guess, one Badge per letter, intent ' +
      'success (right spot) / warning (wrong spot) / neutral (absent). The input is ONE TextField with a ' +
      'regex check (^[a-z]{5}$) gating the Submit button. Show the used-letter state as a compact List, ' +
      'never a full keyboard.',
  },
  {
    label: 'color-duel',
    description: 'color guessing, oklch, swatch match, palette game',
    content:
      'A color round shows the target as a Swatch, takes the guess through a ColorPicker (oklch), and ' +
      'scores in coarse closeness BANDS (perfect / close / warm / cold — never numeric distance math). ' +
      'Show the reveal as a Ramp between target and guess, the running score as a Stat, rounds as ' +
      'Progress.',
  },
  {
    label: 'deal-sheet',
    description: 'haggling, offers, negotiation state, trade',
    content:
      'A negotiation runs on one deal-sheet surface: the item as a Card, asking price and current offer ' +
      'as Stats (mood carries a signed delta), a two-way Slider for the player’s offer with ONE Offer ' +
      'action Button, a price-history Sparkline, and Accept / Walk-away actions. A closed deal disables ' +
      'the offer controls — never remove them.',
  },
  {
    label: 'quest-log',
    description: 'adventure, dungeon, narrative quest, inventory, HP',
    content:
      'An adventure runs on one surface: a Timeline quest log (append one item per scene, cap ~8 and ' +
      'summarize older ones), a compact HUD Row of Stats (HP, Gold), an inventory List (≤6 items), and ' +
      '2-3 choice Buttons per scene. Lore goes in a Disclosure, never inline walls of text. Narration ' +
      'stays in chat; the surface carries STATE.',
  },
]

export const GAMES_PLAYBOOKS: readonly NewEntryInput[] = [
  {
    label: 'twenty-questions',
    description: 'the 20-questions interrogation loop',
    content:
      'Think of the answer FIRST and keep it fixed (state it honestly in the final reveal). Ask ONE ' +
      'question per turn in chat; the surface only tracks state (guess-hud idiom). Guess early when ' +
      'confidence is high; always reveal by question 20 via the Modal.',
  },
  {
    label: 'negotiation-loop',
    description: 'haggling, offers and counter-offers, deal state',
    content:
      'Run offers on one deal-sheet surface: the player moves a Slider, commits via an Offer action; ' +
      'respond in character in chat AND update the surface — mood Stat (signed delta), price-history ' +
      'Sparkline, deal-state Badge. Walking away and accepting are surface actions; a closed deal ' +
      'disables the offer controls.',
  },
  {
    label: 'battle-rounds',
    description: 'alternating-fire board game rounds',
    content:
      // GH #144: the opening turn is ONE board only (theirs — the one the player fires on); yours joins
      // the turn after the first shot lands. Keeps the heaviest turn of the game inside a small, reliable
      // self-correct budget instead of asking for 72 cells across two boards at once.
      'Two 6×6 board-grid surfaces, phased in: turn one is theirs (hidden) ONLY — the player fires by ' +
      'clicking a cell (the action context carries coordinates); resolve, mark the cell, then take YOUR ' +
      'shot and narrate it in chat. Add yours (revealed) as a second board from turn two onward. Track ' +
      'ships remaining as Stats; declare victory honestly the moment a fleet is sunk.',
  },
]

// ── the Game-rules pack — HOW each table game is played (deal, actions, settlement), as Resources ───────
// Rules are reference facts the dealer cites and plays by (the Quant's `metric-definitions` shape), not
// surface idioms — GAMES_SKILLS above stays about HOW a game RENDERS; this pack is about how it RUNS.
// The Croupier seeds every entry and picks AT RANDOM among the ENABLED ones when the player names no
// game — toggling a rules entry off takes that game off the table.

export const GAMES_RULES: readonly NewEntryInput[] = [
  {
    label: 'blackjack',
    description: 'blackjack, 21, hit, stand, double, split — the classic house game',
    content:
      'Two cards each; dealer shows one, hole card face-down. Values: pips as printed, faces 10, Ace 1 or ' +
      '11. Player acts first — hit, stand, double (one card, doubled stake), split pairs; over 21 busts ' +
      'immediately. Dealer then reveals and draws to 17, standing on all 17s. Blackjack (Ace + ten-card) ' +
      'pays 3:2, a win pays 1:1, equal totals push.',
  },
  {
    label: 'spanish-21',
    description: 'spanish 21, no-tens deck, bonus 21s, late surrender',
    content:
      'Blackjack on a 48-card Spanish deck — every 10-spot removed, faces stay. A player 21 ALWAYS wins, ' +
      'and player blackjack beats dealer blackjack. Bonus payouts for a five-plus-card 21 and for 6-7-8 or ' +
      '7-7-7; double-after-split and late surrender allowed. Deal and settle as blackjack otherwise.',
  },
  {
    label: 'pontoon',
    description: 'pontoon, twist, stick, buy, five-card trick — British blackjack',
    content:
      'British blackjack: BOTH dealer cards stay face-down and the dealer wins all ties. Twist = hit, ' +
      'stick = stand (only on 15 or better), buy = double the stake for a face-down card (repeatable). ' +
      'Pontoon (Ace + ten-card) pays 2:1; a five-card trick (five cards, 21 or under) beats everything ' +
      'but pontoon.',
  },
  {
    label: 'texas-holdem',
    description: "texas hold'em, hole cards, flop, turn, river, community cards",
    content:
      "Heads-up hold'em against the dealer: two hole cards each, then a shared flop (three cards), turn, " +
      'and river, with a betting round before each street — check, bet, call, raise, or fold, staked from ' +
      'the running chip count. Best five-card hand from the seven wins the pot, standard rankings (high ' +
      'card up to royal flush). Reveal both hands honestly at showdown.',
  },
  {
    label: 'omaha',
    description: "omaha hold'em, four hole cards, exactly two plus three, pot limit",
    content:
      "Hold'em variant: FOUR hole cards each, same streets and betting rounds. A hand must use exactly " +
      'two hole cards plus exactly three board cards — no more, no fewer. Traditionally pot-limit; ' +
      "otherwise settle as hold'em.",
  },
  {
    label: 'five-card-draw',
    description: 'five-card draw, discard and draw, classic poker',
    content:
      'Classic draw poker: five cards each, face-down, then a betting round; each side may discard up to ' +
      'three cards (four when keeping an Ace) and draw replacements; one final betting round, then ' +
      'showdown. Standard rankings; tied hands split the pot.',
  },
  {
    label: 'seven-card-stud',
    description: 'seven-card stud, up cards, no community board',
    content:
      'No shared board: two down cards and one up card each, betting, then three more up cards and a ' +
      'final down card, betting after every street. Up cards are dealt face-up on the table so the player ' +
      'can read them. Best five of the seven wins; standard rankings.',
  },
]

// ── the Integrations pack (GH #49/#402) — the `{id, label, description}` TRIO table (ADR-0168 cl.2) ─────
// The registry itself (tools/agent/integrations/registry.ts, fed by the self-registering manifest modules
// beside it) is the node-side shell (ADR-0137's law) — this page hardcodes the trio and a data-integrity
// test pins parity against the real registry (importable under vitest's node runtime), so a registry edit
// that forgets this pack goes red.
//
// LLD-C7 — three facts, three fields. `id` is the registry key AND the enablement wire vocabulary (it is
// what `agent-admin.ts` forwards and what `resolveIntegrations` intersects on); `label` is human display
// text, free to change without touching enablement; `description` is the menu-row tooltip. Before this
// slice the label WAS the id — one string tripling as three facts, and the wire only worked because
// `slugify(label)` happened to reproduce the registry id. The explicit `id` (NewEntryInput's optional
// field) is what keeps the minted store entry keyed to the registry now that the labels are human.
export const INTEGRATION_TOOLS: readonly NewEntryInput[] = [
  {
    id: 'weather',
    label: 'Weather (Open-Meteo)',
    description: 'Current conditions + short forecast for a named place. Keyless.',
    content: 'Use for any weather/forecast ask. Surface results as a compact facts Card or Stat row bound to the data model — never a prose dump.',
  },
  {
    id: 'wikipedia-search',
    label: 'Wikipedia search',
    description: 'Search Wikipedia and return the top results with one-line summaries. Keyless.',
    content: 'Use for factual/background lookups. Cite the article titles in the reply; surface comparisons as a List or Table.',
  },
  {
    id: 'currency',
    label: 'Currency rates (Frankfurter)',
    description: 'Convert an amount between currencies at the latest ECB reference rates. Keyless.',
    content: 'Use for price/FX asks. Show the converted figure prominently (Stat) with the rate + date as the caption.',
  },
]

/** GH #143 — per-preset library scoping. Every OTHER preset (The Quant, The Curator, The Stylist —
 *  dashboards/collections/tokens; none of them a hotel or a game) sees `undefined`: generic packs only,
 *  never a stray Hospitality or Games pack. Kept to exactly the two flavors the pack catalog actually
 *  has today — a THIRD flavor earns its own union member the day a third persona-flavored pack ships,
 *  never a bare string. */
export type PresetCategory = 'hospitality' | 'games'

/** GH #143 — which packs are PERSONA-FLAVORED (relevant to one preset category only) vs GENERIC
 *  (relevant to every preset regardless of category). The generic/flavored split is read off each pack's
 *  OWN description text, not invented for this ticket: `a2ui-idioms` IS "the exact idioms the producer
 *  matches at turn time" for ANY persona, `playbooks-core` self-labels "General task-navigation
 *  playbooks", and `integrations` are keyless utilities (weather/wikipedia/currency) with no persona
 *  affinity at all — none of the three names a persona type the way "Hospitality" and "Games" do. Kim's
 *  open design question (GH #143) is resolved here: yes, generic packs stay visible to every preset;
 *  only the flavored two pairs are gated. A pack id absent from this map is generic by construction —
 *  the safe default for any future pack that doesn't explicitly opt into a flavor. */
const FLAVORED_PACK_CATEGORY: Record<string, PresetCategory> = {
  hospitality: 'hospitality',
  'playbooks-hospitality': 'hospitality',
  games: 'games',
  'playbooks-games': 'games',
  'game-rules': 'games',
}

/** GH #143 — `ADMIN_LIBRARIES` filtered to the packs relevant to `category`: every GENERIC pack (not in
 *  `FLAVORED_PACK_CATEGORY`) passes through for every preset; a FLAVORED pack passes through only for its
 *  OWN category. `category` undefined (a preset with no persona-flavored home) drops every flavored pack,
 *  keeping generic packs only. Returns a FRESH object every call (never `ADMIN_LIBRARIES` itself) — the
 *  `ui-agent-admin.libraries` prop's identity-change law (agent-admin.ts) is what makes a reassignment on
 *  preset switch actually rebuild the add-from-library menu; handing back the same reference would be a
 *  silent no-op. */
export function librariesForCategory(category: PresetCategory | undefined): Record<string, EntryLibraryPack[]> {
  const filtered: Record<string, EntryLibraryPack[]> = {}
  for (const [kind, packs] of Object.entries(ADMIN_LIBRARIES)) {
    filtered[kind] = packs.filter((pack) => {
      const flavor = FLAVORED_PACK_CATEGORY[pack.id]
      return flavor === undefined || flavor === category
    })
  }
  return filtered
}

/** The packs the page hands `ui-agent-admin` (`admin.libraries`), keyed by entry kind. */
export const ADMIN_LIBRARIES: Record<string, EntryLibraryPack[]> = {
  [ENTRY_KINDS.skill]: [
    {
      id: 'a2ui-idioms',
      label: 'A2UI idioms',
      description: 'The shipped mini-skill registry — the exact idioms the producer matches at turn time.',
      entries: registryEntries,
    },
    {
      id: 'hospitality',
      label: 'Hospitality',
      description: 'Hotel, restaurant, and travel surface idioms (GH #46).',
      entries: HOSPITALITY_SKILLS,
    },
    {
      id: 'games',
      label: 'Games',
      description: 'Board, HUD, word, color, and quest idioms the game roster seeds from.',
      entries: GAMES_SKILLS,
    },
  ],
  [ENTRY_KINDS.workflow]: [
    {
      id: 'playbooks-core',
      label: 'Core playbooks',
      description: 'General task-navigation playbooks.',
      entries: CORE_PLAYBOOKS,
    },
    {
      id: 'playbooks-hospitality',
      label: 'Hospitality playbooks',
      description: 'Booking, reservation, and trip-planning playbooks (GH #46).',
      entries: HOSPITALITY_PLAYBOOKS,
    },
    {
      id: 'playbooks-games',
      label: 'Game playbooks',
      description: 'Turn-loop playbooks for the game roster.',
      entries: GAMES_PLAYBOOKS,
    },
  ],
  [ENTRY_KINDS.resource]: [
    {
      id: 'game-rules',
      label: 'Game rules',
      description: 'How each table game is played — deal, actions, settlement — the dealer cites and plays by.',
      entries: GAMES_RULES,
    },
  ],
  [ENTRY_KINDS.tool]: [
    {
      id: 'integrations',
      label: 'Integrations',
      description: 'Keyless live integrations executed by the dev proxy (GH #49) — enable + toolsEnabled to arm.',
      entries: INTEGRATION_TOOLS,
    },
  ],
  // genui-surface.spec.md SPEC-R9/R11 (B2) — the shipped GenUI pattern-source packs (data-viz layouts,
  // interactive widgets, animated explainers), live-derived from the registry's own .md files above.
  [ENTRY_KINDS.patternSource]: GENUI_PACK_LIBRARY,
  // ADR-0170 cl.7 — the "Registered catalogs" pack: mapped LIVE from the `A2UI_CATALOG_OPTIONS` IMPORT,
  // not a hand-copied trio table. The registry is browser-importable (unlike the node-fenced integrations
  // registry, whose pack above therefore needs a parity TEST), so this pack simply IS the registry —
  // a third registered catalog is ONE row in `agent-admin-schema.ts` and zero edits here.
  //
  // The trio law (ADR-0168 cl.2) rides `NewEntryInput.id`: `id` is the registry/wire key an added entry
  // stays keyed to (and the only thing `sanitizeCatalog` will ever match), `label` is free display text,
  // `description` is the menu-row copy. `content` is deliberately empty — a catalog entry keys an
  // external registry, it has no body (the section renders no content editor, ADR-0170 cl.8).
  //
  // GENERIC by construction: absent from FLAVORED_PACK_CATEGORY above, so every persona sees it —
  // catalogs have no persona affinity the way Hospitality/Games idioms do.
  [ENTRY_KINDS.catalog]: [
    {
      id: 'registered-catalogs',
      label: 'Registered catalogs',
      description: 'The catalogs this build registers — add one to a persona, then pick it in Catalogs.',
      entries: A2UI_CATALOG_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description ?? '',
        content: '',
      })),
    },
  ],
}
