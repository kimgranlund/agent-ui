// records table: eager manifest + memoized ensure (prototype of catalog/records.ts + catalog/loader.ts)
const DEFAULT_FN = {"required":{"callableFrom":"clientOnly","args":{"value":{"type":["string","null"]}},"returns":{"type":"object"}},"email":{"callableFrom":"clientOnly","args":{"value":{"type":"string"}},"returns":{"type":"object"}},"regex":{"callableFrom":"clientOnly","args":{"value":{"type":"string"},"pattern":{"type":"string"}},"returns":{"type":"object"}},"ping":{"callableFrom":"clientOrRemote","args":{},"returns":{"type":"boolean"}},"formatCurrency":{"callableFrom":"clientOnly","args":{"value":{"type":"number"},"currency":{"type":"string"}},"returns":{"type":"string"}}}
const BASIC_FN = {"formatString":{"callableFrom":"clientOnly","args":{"value":{"type":"string"}},"returns":{"type":"string"}},"required":{"callableFrom":"clientOnly","args":{"value":{}},"returns":{"type":"boolean"}},"regex":{"callableFrom":"clientOnly","args":{"value":{"type":"string"},"pattern":{"type":"string"}},"returns":{"type":"boolean"}},"length":{"callableFrom":"clientOnly","args":{"value":{"type":"string"},"min":{"type":"number"},"max":{"type":"number"}},"returns":{"type":"boolean"}},"numeric":{"callableFrom":"clientOnly","args":{"value":{},"min":{"type":"number"},"max":{"type":"number"}},"returns":{"type":"boolean"}},"email":{"callableFrom":"clientOnly","args":{"value":{"type":"string"}},"returns":{"type":"boolean"}},"formatNumber":{"callableFrom":"clientOnly","args":{"value":{"type":"number"},"decimals":{"type":"number"},"grouping":{"type":"boolean"}},"returns":{"type":"string"}},"formatCurrency":{"callableFrom":"clientOnly","args":{"value":{"type":"number"},"currency":{"type":"string"},"decimals":{"type":"number"},"grouping":{"type":"boolean"}},"returns":{"type":"string"}},"formatDate":{"callableFrom":"clientOnly","args":{"value":{"type":"string"},"format":{"type":"string"}},"returns":{"type":"string"}},"pluralize":{"callableFrom":"clientOnly","args":{"value":{"type":"number"},"other":{"type":"string"},"zero":{"type":"string"},"one":{"type":"string"},"two":{"type":"string"},"few":{"type":"string"},"many":{"type":"string"}},"returns":{"type":"string"}},"and":{"callableFrom":"clientOnly","args":{"values":{"type":"array","items":{"type":"boolean"}}},"returns":{"type":"boolean"}},"or":{"callableFrom":"clientOnly","args":{"values":{"type":"array","items":{"type":"boolean"}}},"returns":{"type":"boolean"}},"not":{"callableFrom":"clientOnly","args":{"value":{"type":"boolean"}},"returns":{"type":"boolean"}}}
const PERSONAS = ['fixture-demo', 'concierge', 'croupier']
const TARGETS = ['agent-ui', 'a2ui-basic']
const loaded = new Map()
const known = new Map()
const rec = (id, fn, load) => known.set(id, { id, fn, load })
rec('agent-ui', DEFAULT_FN, () => import('/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-spike/.sdlc/size-budget-split-design/measure/proto/default-body.ts'))
rec('a2ui-basic', BASIC_FN, () => import('/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-spike/.sdlc/size-budget-split-design/measure/proto/basic-body.ts'))
rec('https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json', BASIC_FN, () => import('/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-spike/.sdlc/size-budget-split-design/measure/proto/basic-body.ts').then((m) => ({ ...m, catalog: m.canonical })))
for (const p of PERSONAS) for (const t of TARGETS) rec(t + '--' + p, {}, null)
export const knownCatalogIds = () => [...known.keys()]
export const submitGateTags = ['ui-form-provider']
export const manifestFunctions = (id) => known.get(id)?.fn
export function ensureCatalog(registry, id) {
  let p = loaded.get(id)
  if (p) return p
  const r = known.get(id)
  if (!r) return Promise.reject(new Error('unknown catalog ' + id))
  p = r.load
    ? r.load().then((b) => registry.register(b.catalog, b.factories, b.functions, b.controls))
    : Promise.all(TARGETS.map((t) => ensureCatalog(registry, t)))
        .then(() => import('/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-spike/.sdlc/size-budget-split-design/measure/proto/persona-body.ts'))
        .then((m) => m.composePersonaCatalogs(registry, m.SHIPPED_PERSONA_CATALOGS))
  loaded.set(id, p)
  return p
}
