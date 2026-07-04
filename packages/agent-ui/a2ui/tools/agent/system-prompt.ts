// system-prompt.ts — LLD-C4 / SPEC-R6, ADR-0071: the catalog-DERIVED, drift-gated machine system prompt.
//
// Three parts (LLD §5): a fixed GRAMMAR (how to emit A2UI JSONL — the DRY source would be the
// `a2ui-compose` skill references; that skill is authoring-time docs, so a tight faithful grammar is
// inlined and the load-bearing derived part is the inventory) + the catalog INVENTORY derived at RUN
// TIME from the passed `Catalog` (the sole component authority — never a hand-listed set) + a few-shot
// block from the retrieved exemplars. A standing drift test (`prompt-drift.test.ts`) asserts the derived
// inventory equals the catalog's, so a catalog row added without regeneration FAILS (PRD-G6 coherence).
// Pure; the caller loads the catalog (Node: readFileSync + loadCatalog).

import type { Catalog } from '../../src/catalog/catalog.ts'
import type { CorpusRecord } from '../../src/corpus/record.ts'

const GRAMMAR = `You are an agent that builds user interfaces by emitting A2UI (Agent2UI) protocol messages.
You do NOT reply in prose or HTML — you emit a stream of JSON messages, ONE per line (JSONL), that the
client renders into live controls and streams back the user's interactions.

Output rules:
- Emit ONLY JSONL: exactly one JSON object per line. No markdown, no commentary, no code fences.
- Every message MUST carry "version": "v1.0".
- First, create a surface:
  {"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}
- Then send the component tree:
  {"version":"v1.0","updateComponents":{"surfaceId":"main","components":[ ... ]}}
  - Components are a FLAT ADJACENCY LIST. Exactly ONE root component MUST have "id":"root".
  - Each component: {"id":"<unique>","component":"<TypeFromCatalog>", <props...>,
    "children":["childId", ...]  (a container's ordered child ids)  OR  "child":"childId"}.
  - A dynamic list uses "children":{"path":"/items","componentId":"tmpl"} to repeat a template per array element.
- Supply or update data:
  {"version":"v1.0","updateDataModel":{"surfaceId":"main","path":"/some/path","value": <json>}}
  - Bind any prop to data by giving it {"path":"/some/path"} instead of a literal.
- Make a control report back to you by giving it an "action", e.g. a Button:
  {"id":"go","component":"Button","label":"Submit","action":{"action":"submit"}}
- Use ONLY the component types and props listed in the catalog below. NEVER invent a component or a prop.
- Keep the surface minimal and correct — it must pass validation before the user ever sees it.`

function catalogInventory(catalog: Catalog): string {
  const lines: string[] = []
  for (const id of Object.keys(catalog.components)) {
    const def = catalog.components[id]!
    const props = Object.keys(def.properties)
    const child = def.children ? ` · children model: ${def.children}` : ''
    lines.push(`- ${id} (props: ${props.length > 0 ? props.join(', ') : 'none'}${child})`)
  }
  return lines.join('\n')
}

function functionsInventory(catalog: Catalog): string {
  const ids = Object.keys(catalog.functions)
  if (ids.length === 0) return '(none)'
  return ids.map((fn) => `- ${fn} (${catalog.functions[fn]!.callableFrom})`).join('\n')
}

function fewShot(exemplars: readonly CorpusRecord[]): string {
  if (exemplars.length === 0) return ''
  const blocks = exemplars.map((ex) => {
    const jsonl = (ex.a2uiOutput ?? []).map((m) => JSON.stringify(m)).join('\n')
    return `PROMPT: ${ex.promptText}\nA2UI:\n${jsonl}`
  })
  return `\n\n## Examples (retrieved — imitate their shape, not their content)\n\n${blocks.join('\n\n---\n\n')}`
}

/**
 * Compose the machine system prompt (SPEC-R6): grammar + the catalog-derived component/function inventory
 * + the few-shot block. The inventory is derived from `catalog` at call time — `buildSystemPrompt` can
 * never advertise a component the catalog lacks (drift-gated by `prompt-drift.test.ts`).
 */
export function buildSystemPrompt(catalog: Catalog, exemplars: readonly CorpusRecord[]): string {
  return (
    GRAMMAR +
    `\n\n## Available components (catalog "${catalog.catalogId}", protocol ${catalog.protocolVersion})\n\n` +
    catalogInventory(catalog) +
    `\n\n## Available functions\n\n` +
    functionsInventory(catalog) +
    fewShot(exemplars)
  )
}
