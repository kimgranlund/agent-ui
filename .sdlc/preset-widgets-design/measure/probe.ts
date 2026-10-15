// probe.ts: T-0065 prompt-budget probe (LLD response-type-selection section 4, the K6 script), extended
// with one synthetic catalog row per candidate widget. Run from the repo root:
//   node --experimental-strip-types .sdlc/preset-widgets-design/measure/probe.ts > .sdlc/preset-widgets-design/measure/probe.out.txt
// Read-only: composes prompts in memory, writes nothing.
import { loadCatalogById } from '../../../packages/agent-ui/a2ui/tools/catalog-files.ts'
import { loadCatalog } from '../../../packages/agent-ui/a2ui/src/catalog/catalog.ts'
import { buildSystemPromptSections } from '../../../packages/agent-ui/a2ui/src/agent/system-prompt.ts'
import { renderSurfaceTool } from '../../../packages/agent-ui/a2ui/src/agent/response-type.ts'
import { composeCatalog, loadCatalogFragment } from '../../../packages/agent-ui/a2ui/src/catalog/compose.ts'
import { renderSelectionClauseWith } from '../../../packages/agent-ui/a2ui/src/agent/selection-guidance.ts'
import { readFileSync } from 'node:fs'

const ROOT = process.cwd()
// The shipped fragments, read straight from their catalog.json (manifests.ts needs vite's json import; raw node does not have it).
const SHIPPED_PERSONA_CATALOG_MANIFESTS = ['fixture-demo', 'concierge', 'croupier'].map((personaId) => ({
  personaId,
  fragment: loadCatalogFragment(JSON.parse(readFileSync(`${ROOT}/packages/agent-ui/a2ui/src/catalog/personas/${personaId}/catalog.json`, 'utf8'))),
}))
const agentUi = loadCatalogById(ROOT, 'agent-ui')
const rawDefault = JSON.parse(readFileSync(`${ROOT}/packages/agent-ui/a2ui/src/catalog/default/catalog.json`, 'utf8'))
const K6_BOUND = Math.round(42_209 * 1.1) // PRD response-type-selection K6: +10% over the 42,209 baseline

const k6 = (catalog: Parameters<typeof buildSystemPromptSections>[0]) => {
  const { text, sections } = buildSystemPromptSections(catalog, [], undefined, [])
  const tool = JSON.stringify(renderSurfaceTool([])).length
  return { text: text.length, tool, k6: text.length + tool, sections: sections.map((s) => `${s.id}=${s.chars}`).join(' ') }
}

const s = (bindable = true) => ({ type: { type: 'string' }, bindable })
const n = (bindable = true) => ({ type: { type: 'number' }, bindable })
const b = (bindable = true) => ({ type: { type: 'boolean' }, bindable })
const e = (members: string[], bindable = true) => ({ type: { type: 'string', enum: members }, bindable })
const arr = (props: Record<string, unknown>, required: string[]) => ({ type: { type: 'array', items: { type: 'object', properties: props, required } }, bindable: true })
const obj = () => ({ type: { type: 'object' }, bindable: true })
const INTENT = ['neutral', 'info', 'success', 'warning', 'danger']
const withMapsTo = (props: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { ...v, mapsTo: k }]))

type Cand = { name: string; props: Record<string, Record<string, unknown>>; children?: string; intents: string[]; notFor: { type: string; why: string }[] }
const CANDIDATES: Cand[] = [
  { name: 'ProductCard', props: withMapsTo({ title: s(), subtitle: s(), image: s(), imageAlt: s(), price: s(), priceNote: s(), rating: n(), badge: s(), badgeIntent: e(INTENT), actionLabel: s(false) }), children: 'child',
    intents: ['one product, room or offer to buy or book'], notFor: [{ type: 'Card', why: 'content with no price or action' }, { type: 'ServiceCard', why: 'a thing to open, not buy' }] },
  { name: 'MediaGallery', props: withMapsTo({ items: arr({ src: { type: 'string' }, alt: { type: 'string' }, caption: { type: 'string' } }, ['src', 'alt']), layout: e(['grid', 'swiper'], false), aspect: e(['square', 'landscape', 'portrait'], false), caption: s() }),
    intents: ['a set of photos to browse'], notFor: [{ type: 'Image', why: 'one picture' }, { type: 'Grid', why: 'tiles that are not photos' }] },
  { name: 'GameHud', props: withMapsTo({ title: s(), status: s(), statusIntent: e(INTENT), stats: arr({ label: { type: 'string' }, value: { type: 'string' }, delta: { type: 'string' }, intent: { type: 'string', enum: INTENT } }, ['label', 'value']), progress: obj() }),
    intents: ['a game score and status strip'], notFor: [{ type: 'Stat', why: 'one metric outside a game' }, { type: 'Toolbar', why: 'actions, not readouts' }] },
  { name: 'BoardGrid', props: withMapsTo({ rows: n(false), cols: n(false), cells: arr({ row: { type: 'number' }, col: { type: 'number' }, mark: { type: 'string' }, disabled: { type: 'boolean' } }, ['row', 'col']), actionName: s(false), label: s() }),
    intents: ['a board of cells to target or mark'], notFor: [{ type: 'Grid', why: 'a layout of components' }, { type: 'Table', why: 'rows of data' }] },
  { name: 'Itinerary', props: withMapsTo({ title: s(), stops: arr({ time: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' }, status: { type: 'string', enum: ['done', 'active', 'pending'] } }, ['title']) }),
    intents: ['a day plan of stops in order'], notFor: [{ type: 'Timeline', why: 'events without a plan' }] },
  { name: 'AvailabilityPicker', props: withMapsTo({ label: s(), name: s(false), slots: arr({ value: { type: 'string' }, label: { type: 'string' }, available: { type: 'boolean' } }, ['value', 'label']), value: s() }),
    intents: ['pick one open slot or seating'], notFor: [{ type: 'RadioGroup', why: 'options that are all open' }, { type: 'Calendar', why: 'a date, not a slot' }] },
  { name: 'QuestionCard', props: withMapsTo({ question: s(), options: arr({ value: { type: 'string' }, label: { type: 'string' } }, ['value', 'label']), value: s(), name: s(false), revealed: b(), explanation: s(), progress: obj() }),
    intents: ['one quiz question with its choices'], notFor: [{ type: 'RadioGroup', why: 'a form choice, no reveal' }] },
  { name: 'CharacterSheet', props: withMapsTo({ name: s(), hp: obj(), gold: n(), inventory: arr({ name: { type: 'string' } }, ['name']), status: s() }),
    intents: ['a player status strip with inventory'], notFor: [{ type: 'GameHud', why: 'scores without an inventory' }] },
  { name: 'CardTable', props: withMapsTo({ title: s(), dealerHand: arr({ rank: { type: 'string' }, suit: { type: 'string' }, faceDown: { type: 'boolean' } }, ['rank', 'suit']), playerHand: arr({ rank: { type: 'string' }, suit: { type: 'string' }, faceDown: { type: 'boolean' } }, ['rank', 'suit']), dealerTotal: n(), playerTotal: n(), bankroll: n(), bet: n(), status: s(), statusIntent: e(INTENT) }), children: 'children',
    intents: ['a card table with both hands and the actions'], notFor: [{ type: 'PlayingCard', why: 'one card' }, { type: 'Card', why: 'a content surface' }] },
  { name: 'SwatchPalette', props: withMapsTo({ title: s(), tokens: arr({ name: { type: 'string' }, value: { type: 'string' }, kind: { type: 'string', enum: ['color', 'space', 'size'] } }, ['name', 'value']) }),
    intents: ['a group of named tokens rendered'], notFor: [{ type: 'Swatch', why: 'one color' }, { type: 'Ramp', why: 'one graded scale' }] },
  { name: 'ExhibitCard', props: withMapsTo({ symbol: s(), title: s(), body: s(), badge: s() }), children: 'child',
    intents: ['one image-free exhibit tile'], notFor: [{ type: 'Card', why: 'content with no exhibit shape' }] },
  { name: 'CommitmentLedger', props: withMapsTo({ item: s(), asking: n(), offer: n(), mood: n(), moodDelta: n(), history: arr({ round: { type: 'number' }, offer: { type: 'number' }, counter: { type: 'number' } }, ['round']), state: e(['open', 'accepted', 'walked']) }),
    intents: ['a haggling ledger of offers and mood'], notFor: [{ type: 'Table', why: 'rows without a deal state' }] },
]

const base = k6(agentUi)
console.log(`K6 bound ${K6_BOUND} (42,209 * 1.1). Default catalog agent-ui: text ${base.text} + tool ${base.tool} = ${base.k6}; sections ${base.sections}`)

// Derived baselines (the shipped fragments composed onto agent-ui), K6 shape.
for (const m of SHIPPED_PERSONA_CATALOG_MANIFESTS) {
  const d = composeCatalog(agentUi, m.fragment, m.personaId)
  const r = k6(d)
  console.log(`derived ${d.catalogId}: text ${r.text} + tool ${r.tool} = ${r.k6} (delta vs default ${r.k6 - base.k6}); ${r.sections}`)
}
// The one-line catalogId teaching every derived catalog pays once (ADR-0169 cl.4 clause 3).
const empty = composeCatalog(agentUi, { components: {}, functions: {} }, 'probe')
console.log(`derived-id teaching line alone (empty fragment agent-ui--probe): +${k6(empty).k6 - base.k6}`)

console.log('\nPer-widget row cost on the DEFAULT catalog (inventory line + proposed selection clause), chars:')
const rows: { name: string; row: number; clause: number; total: number }[] = []
for (const c of CANDIDATES) {
  const doc = { ...rawDefault, components: { ...rawDefault.components, [c.name]: { properties: c.props, ...(c.children ? { children: c.children } : {}) } } }
  const cat = loadCatalog(doc)
  const row = k6(cat).k6 - base.k6
  const clause = renderSelectionClauseWith({ intents: c.intents, notFor: c.notFor }, (t) => t).length
  rows.push({ name: c.name, row, clause, total: row + clause })
  console.log(`  ${c.name.padEnd(18)} row ${String(row).padStart(4)} + clause ${String(clause).padStart(3)} = ${String(row + clause).padStart(4)}`)
}
const sum = (ns: number[]) => ns.reduce((a, x) => a + x, 0)
const tier1 = rows.filter((r) => ['ProductCard', 'MediaGallery', 'GameHud', 'BoardGrid'].includes(r.name))
const tier2 = rows.filter((r) => ['Itinerary', 'AvailabilityPicker', 'QuestionCard', 'CharacterSheet'].includes(r.name))
const tier3 = rows.filter((r) => ['CardTable', 'SwatchPalette', 'ExhibitCard', 'CommitmentLedger'].includes(r.name))
console.log(`\nAll 12 on the default catalog: +${sum(rows.map((r) => r.total))} -> K6 ${base.k6 + sum(rows.map((r) => r.total))} (bound ${K6_BOUND})`)
console.log(`Tier 1 (4) on default: +${sum(tier1.map((r) => r.total))} -> K6 ${base.k6 + sum(tier1.map((r) => r.total))}`)
console.log(`Tier 1+2 (8) on default: +${sum([...tier1, ...tier2].map((r) => r.total))} -> K6 ${base.k6 + sum([...tier1, ...tier2].map((r) => r.total))}`)
console.log(`Tier 3 (4) as persona rows: +${sum(tier3.map((r) => r.total))} spread over their presets`)
// Fragment placement: the same rows composed as a fragment onto agent-ui (the cost a preset pays only when it selects it).
const frag = loadCatalogFragment({ components: Object.fromEntries(CANDIDATES.map((c) => [c.name, { properties: c.props, ...(c.children ? { children: c.children } : {}) }])), functions: {} })
const widgets = composeCatalog(agentUi, frag, 'widgets')
console.log(`\nOne shared fragment agent-ui--widgets with all 12 rows (no clauses): K6 ${k6(widgets).k6} (delta ${k6(widgets).k6 - base.k6}, of which ${k6(empty).k6 - base.k6} is the derived-id line)`)
// Croupier plus a CardTable row.
const croupier = SHIPPED_PERSONA_CATALOG_MANIFESTS.find((m) => m.personaId === 'croupier')!
const ct = CANDIDATES.find((c) => c.name === 'CardTable')!
const croupierPlus = composeCatalog(agentUi, { components: { ...croupier.fragment.components, CardTable: { properties: ct.props as never, children: 'children' as never } } as never, functions: {} }, 'croupier')
console.log(`agent-ui--croupier + CardTable row: K6 ${k6(croupierPlus).k6} (delta vs today's croupier ${k6(croupierPlus).k6 - k6(composeCatalog(agentUi, croupier.fragment, 'croupier')).k6})`)
