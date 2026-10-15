const root = process.argv[2]
const { loadCatalogById } = await import(root + '/packages/agent-ui/a2ui/tools/catalog-files.ts')
const { buildSystemPromptSections } = await import(root + '/packages/agent-ui/a2ui/src/agent/system-prompt.ts')
const { renderSurfaceTool } = await import(root + '/packages/agent-ui/a2ui/src/agent/response-type.ts')
const cat = loadCatalogById(root, 'agent-ui')
const r = buildSystemPromptSections(cat, [], undefined, [])
const tool = JSON.stringify(renderSurfaceTool([])).length
console.log('prompt', r.text.length, 'tool', tool, 'K6', r.text.length + tool)
