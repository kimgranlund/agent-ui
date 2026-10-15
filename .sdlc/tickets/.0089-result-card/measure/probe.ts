// probe.ts: T-0089 K6 re-measure, the T-0087 probe (.sdlc/tickets/.0087-widget-patterns-next/measure/probe.ts, itself the T-0065
// script) with its synthetic candidate rows removed: the ResultCard row and its sidecar entry are real now. Run
// from the repo root:
//   node --experimental-strip-types .sdlc/0089-result-card/measure/probe.ts > .sdlc/0089-result-card/measure/probe.out.txt
// Read-only: composes prompts in memory, writes nothing.
import { loadCatalogById } from '../../../../packages/agent-ui/a2ui/tools/catalog-files.ts'
import { buildSystemPromptSections } from '../../../../packages/agent-ui/a2ui/src/agent/system-prompt.ts'
import { renderSurfaceTool } from '../../../../packages/agent-ui/a2ui/src/agent/response-type.ts'

const ROOT = process.cwd()
const agentUi = loadCatalogById(ROOT, 'agent-ui')
const K6_BOUND = Math.round(42_209 * 1.1)

const k6 = (catalog: Parameters<typeof buildSystemPromptSections>[0]) => {
  const { text } = buildSystemPromptSections(catalog, [], undefined, [])
  return text.length + JSON.stringify(renderSurfaceTool([])).length
}

const base = k6(agentUi)
console.log(`K6 bound ${K6_BOUND} (42,209 * 1.1). Default agent-ui + tool: ${base} (${K6_BOUND - base} spare); ResultCard row present: ${'ResultCard' in agentUi.components}`)
