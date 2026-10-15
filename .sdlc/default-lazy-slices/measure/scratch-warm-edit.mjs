// Applies the PRESCRIBED test edit to a scratch clone: in each of the 15 mechanical files, after the last import, a top-level
// `await __warm().preload('agent-ui')` (top-level so it also covers a renderer built at module or describe scope, before any
// beforeAll runs). Usage: node scratch-warm-edit.mjs <clone-dir>
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FILES = [
  'packages/agent-ui/a2ui/src/examples/backable-wizard.test.ts',
  'packages/agent-ui/a2ui/src/examples/examples.test.ts',
  'packages/agent-ui/a2ui/src/live-agent/round-trip.test.ts',
  'packages/agent-ui/a2ui/src/live-agent/structural-transcript.test.ts',
  'packages/agent-ui/a2ui/src/renderer/bound-text.test.ts',
  'packages/agent-ui/a2ui/src/renderer/card-header-slot.test.ts',
  'packages/agent-ui/a2ui/src/renderer/checkbox-group-layout.test.ts',
  'packages/agent-ui/a2ui/src/renderer/renderer-persona-catalogs.test.ts',
  'packages/agent-ui/a2ui/src/renderer/renderer.test.ts',
  'packages/agent-ui/a2ui/src/catalog/default/index.test.ts',
  'site/lib/component-preview-catalog.test.ts',
  'site/pages/a2ui-live.ask-lifecycle.test.ts',
  'site/pages/devtools-harness.test.ts',
  'packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts',
  'packages/agent-ui/app/src/controls/conversation/conversation.test.ts',
]
const clone = resolve(process.argv[2] ?? '')
for (const rel of FILES) {
  const path = `${clone}/${rel}`
  const lines = readFileSync(path, 'utf8').split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) if (/^(import\s.*(from\s+)?['"].*['"];?|\}\s*from\s+['"].*['"];?)\s*$/.test(lines[i])) last = i
  if (last < 0) throw new Error(`no import found in ${rel}`)
  lines.splice(last + 1, 0, `import { createRenderer as __warm } from '@agent-ui/a2ui'`, `await __warm().preload('agent-ui')`)
  writeFileSync(path, lines.join('\n'))
}
console.log(`warm-up inserted in ${FILES.length} files under ${clone}`)
