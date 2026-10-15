// probe.ts: T-0087 prompt-budget probe, the T-0065 K6 script (.sdlc/preset-widgets-design/measure/probe.ts)
// re-pointed at today's tree, with one synthetic default-catalog row per T-0087 candidate. Run from the repo root:
//   node --experimental-strip-types .sdlc/widget-patterns-next/measure/probe.ts > .sdlc/widget-patterns-next/measure/probe.out.txt
// Read-only: composes prompts in memory, writes nothing.
import { loadCatalogById } from '../../../packages/agent-ui/a2ui/tools/catalog-files.ts'
import { loadCatalog } from '../../../packages/agent-ui/a2ui/src/catalog/catalog.ts'
import { buildSystemPromptSections } from '../../../packages/agent-ui/a2ui/src/agent/system-prompt.ts'
import { renderSurfaceTool } from '../../../packages/agent-ui/a2ui/src/agent/response-type.ts'
import { renderSelectionClauseWith } from '../../../packages/agent-ui/a2ui/src/agent/selection-guidance.ts'
import { readFileSync } from 'node:fs'

const ROOT = process.cwd()
const agentUi = loadCatalogById(ROOT, 'agent-ui')
const rawDefault = JSON.parse(readFileSync(`${ROOT}/packages/agent-ui/a2ui/src/catalog/default/catalog.json`, 'utf8'))
const K6_BOUND = Math.round(42_209 * 1.1)

const k6 = (catalog: Parameters<typeof buildSystemPromptSections>[0]) => {
  const { text } = buildSystemPromptSections(catalog, [], undefined, [])
  return text.length + JSON.stringify(renderSurfaceTool([])).length
}

const s = (bindable = true) => ({ type: { type: 'string' }, bindable })
const e = (members: string[], bindable = true) => ({ type: { type: 'string', enum: members }, bindable })
const arr = (props: Record<string, unknown>, required: string[]) => ({ type: { type: 'array', items: { type: 'object', properties: props, required } }, bindable: true })
const INTENT = ['neutral', 'info', 'success', 'warning', 'danger']
const withMapsTo = (props: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { ...v, mapsTo: k }]))

type Cand = { name: string; props: Record<string, Record<string, unknown>>; children?: string; intents: string[]; notFor: { type: string; why: string }[] }
const CANDIDATES: Cand[] = [
  { name: 'ResultCard', props: withMapsTo({ outcome: e(['win', 'lose', 'draw', 'done']), title: s(), summary: s(), stats: arr({ label: { type: 'string' }, value: { type: 'string' }, delta: { type: 'string' }, intent: { type: 'string', enum: INTENT } }, ['label', 'value']) }), children: 'ChildList',
    intents: ['the settled outcome of a game, deal or booking with its next action'], notFor: [{ type: 'GameHud', why: 'the live score while play goes on' }, { type: 'Toast', why: 'a passing round result' }] },
  { name: 'ContrastPair', props: withMapsTo({ foreground: s(), background: s(), label: s(), sample: s() }),
    intents: ['a text color on a background with its contrast rating'], notFor: [{ type: 'Swatch', why: 'one color alone' }] },
  { name: 'AvailabilityPicker', props: withMapsTo({ label: s(), name: s(false), slots: arr({ value: { type: 'string' }, label: { type: 'string' }, status: { type: 'string', enum: ['open', 'limited', 'full'] }, note: { type: 'string' } }, ['value', 'label']), value: s() }),
    intents: ['pick one open slot or seating'], notFor: [{ type: 'RadioGroup', why: 'options that are all open' }, { type: 'Calendar', why: 'a date, not a slot' }] },
  { name: 'StatGroup', props: withMapsTo({ label: s(), stats: arr({ label: { type: 'string' }, value: { type: 'string' }, delta: { type: 'number' } }, ['label', 'value']) }),
    intents: ['a row of headline figures'], notFor: [{ type: 'Stat', why: 'one figure' }, { type: 'GameHud', why: 'a game strip' }] },
]

const base = k6(agentUi)
console.log(`K6 bound ${K6_BOUND} (42,209 * 1.1). Default agent-ui + tool today: ${base} (${K6_BOUND - base} spare)`)
console.log('\nSynthetic default-catalog row cost (inventory line + selection clause), chars:')
for (const c of CANDIDATES) {
  const doc = { ...rawDefault, components: { ...rawDefault.components, [c.name]: { properties: c.props, ...(c.children ? { children: c.children } : {}) } } }
  const row = k6(loadCatalog(doc)) - base
  const clause = renderSelectionClauseWith({ intents: c.intents, notFor: c.notFor }, (t) => t).length
  console.log(`  ${c.name.padEnd(18)} row ${String(row).padStart(4)} + clause ${String(clause).padStart(3)} = ${String(row + clause).padStart(4)} -> K6 ${base + row + clause}`)
}
// Exposing the control's existing `disabled` on the Radio wire row (radio.md:32): one bindable boolean.
const radioDoc = structuredClone(rawDefault)
radioDoc.components.Radio.properties.disabled = { type: { type: 'boolean' }, bindable: true, mapsTo: 'disabled' }
console.log(`\nRadio.disabled wire prop: +${k6(loadCatalog(radioDoc)) - base}`)
