// layers.ts: the catalog layer map (T-0202, catalog architecture SPEC CA-R1). Every emittable type of the default
// catalog and of every shipped fragment belongs to exactly one layer, decided by the CA-R1 test run top to bottom:
//   1. domain: its props or meaning carry one field's vocabulary, so an agent outside that field never picks it;
//   2. agentic: it stands for a moment between agent and user and no prop names a field;
//   3. core: everything else, every form control and every chart included.
// Only the agentic and domain rows are listed (T-0209): core membership is derived, never hand-listed here, as every
// type the default catalog's `catalog.json` declares that has no row. A NEW default type still forces a decision:
// `layers.test.ts` pins the default catalog's type set, so it reds until the type gets a row here or joins that
// snapshot as core. Each row names the catalog that declares the type today (`home`). A domain-layer row homed in `default`
// is a type the SPEC moves out in W2 (§5.3); the row and the move change together. `layers.test.ts` holds the map
// equal to the catalogs: a fragment or domain type with no row, a listed core row, a row whose home does not declare
// its type, or a layer its home cannot hold reds the gate. Content is SPEC §5's classification (AC2). Pure data plus
// the selected-domain read (T-0207), whose one import is the import-free id grammar.

import { catalogIdDomains, splitCatalogId } from './catalog-id.ts'

/** The three layers (CA-R1). The agentic layer lives inside the `agent-ui` base (D1). */
export type CatalogLayer = 'core' | 'agentic' | 'domain'

/** One type's layer, its domain when the layer is `domain`, and the catalog folder that declares it today. */
export interface LayerRow {
  readonly layer: CatalogLayer
  /** The domain id (CA-R8) for a `domain` row; absent for an agentic one. */
  readonly domain?: string
  /** `default`, `domains/<domain>` or `personas/<persona>`: the folder whose `catalog.json` declares the type. */
  readonly home: string
}

const agentic: LayerRow = { layer: 'agentic', home: 'default' }
const domain = (id: string, home: string): LayerRow => ({ layer: 'domain', domain: id, home })

/** Type name to its layer row, for the agentic and domain layers: SPEC §5.2 to §5.4 (§5.1 core is derived). */
export const CATALOG_LAYER_MAP: Readonly<Record<string, LayerRow>> = Object.freeze({
  // §5.2 agentic
  SourceList: agentic,
  Suggestions: agentic,
  ResultCard: agentic,
  // T-0193: a pick of one of a few things to start (the greet's starter cards, Surprise me hands the pick to the
  // agent); no prop names a field, so it is the Suggestions class, not core.
  OptionDeck: agentic,
  ConfirmReceipt: agentic,
  // T-0198: a client-side wizard over scene children building one draft; no prop names a domain, so agentic.
  StepFlow: agentic,
  // §5.3 domain types still homed in the default catalog (W2 moves each to its domain)
  BoardGrid: domain('games', 'default'),
  GameHud: domain('games', 'default'),
  ProductCard: domain('commerce', 'default'),
  ServiceCard: domain('hospitality', 'default'),
  Ramp: domain('design', 'default'),
  Ladder: domain('design', 'default'),
  // T-0197: the hospitality domain, the first fragment merged into its domain
  BookingForm: domain('hospitality', 'domains/hospitality'),
  BookingConfirmation: domain('hospitality', 'domains/hospitality'),
  Itinerary: domain('hospitality', 'domains/hospitality'), // T-0199
  // §5.4 persona fragment types (W1 merges each fragment into its domain)
  PlayingCard: domain('games', 'personas/croupier'),
  CardTable: domain('games', 'personas/croupier'),
  QuestionCard: domain('games', 'personas/quizmaster'),
  ContrastPair: domain('design', 'personas/stylist'),
})

/** Fragments outside the map: `fixture-demo` is the composition mechanism's test fixture, never a shipped pattern
 *  (persona SPEC-N6), so its type belongs to no layer. */
export const LAYER_MAP_EXEMPT_HOMES: readonly string[] = ['personas/fixture-demo']

/** T-0207 (CA-R4): the domains an effective catalog id selects: its `+` tail (`catalogIdDomains`), plus the domain of
 *  every row a `<base>--<persona>` fragment homes (`agent-ui--croupier` selects `games`). A base id selects none. */
export function selectedDomains(catalogId: string): readonly string[] {
  const { tail } = splitCatalogId(catalogId)
  if (tail === undefined) return []
  const home = `personas/${tail}`
  const fromPersona = Object.values(CATALOG_LAYER_MAP).flatMap((r) => (r.home === home && r.domain !== undefined ? [r.domain] : []))
  return [...new Set([...catalogIdDomains(catalogId), ...fromPersona])]
}

/** T-0207: a domain-layer type whose domain `selected` lacks. Its selection guidance (its clause, and every edge
 *  naming it) leaves the inventory. Rows still homed in `default` are exempt until W2 moves each to its domain and
 *  presets declare their domains first (SPEC §5.3), so no turn's prompt moves before then. */
export function isUnselectedDomainType(type: string, selected: readonly string[]): boolean {
  const row = Object.hasOwn(CATALOG_LAYER_MAP, type) ? CATALOG_LAYER_MAP[type]! : undefined
  return row !== undefined && row.layer === 'domain' && row.home !== 'default' && !selected.includes(row.domain!)
}
