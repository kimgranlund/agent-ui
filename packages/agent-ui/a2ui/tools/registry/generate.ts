// generate.ts: the capability-registry CLI (GH #1807). Composes the registry from disk and writes the one
// committed projection, `site/capability-registry.json`, plus its `site/public/` twin (the sitemap two-copy
// vehicle: Vite hard-errors on a static JS import from publicDir, so the page imports the src-tree copy and
// the public copy serves `fetch`). No timestamp, sorted rows: two runs produce no diff.
//
//   npm run generate:registry          write both copies
//   npm run generate:registry -- --dry compose and print the counts, write nothing
//
// The drift gate (`generate.test.ts`) imports `projectionText` and compares it to the committed bytes, so
// the writer and the gate share one serializer and cannot drift on formatting alone. The `main()` call is
// guarded by the CLI-entry check, so importing this module never writes (the GH #112 tools rule).

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { composeRegistry } from '../../src/registry/compose.ts'
import type { CapabilityRegistry } from '../../src/registry/types.ts'
import { loadRegistrySources } from './load.ts'

/** The two committed copies, repo-root-relative. */
export const PROJECTION_PATHS = ['site/capability-registry.json', 'site/public/capability-registry.json'] as const

/** The command a stale projection's failure message names. */
export const REGENERATE_COMMAND = 'npm run generate:registry'

/** Compose the registry from the files under `root`. */
export function buildRegistry(root: string): CapabilityRegistry {
  return composeRegistry(loadRegistrySources(root))
}

/** The ONE serialization the writer and the drift gate share. */
export function formatProjection(registry: CapabilityRegistry): string {
  return `${JSON.stringify(registry, null, 2)}\n`
}

/** The projection's exact bytes for the files under `root`. */
export function projectionText(root: string): string {
  return formatProjection(buildRegistry(root))
}

function countBy(rows: readonly { readonly kind: string }[]): string {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1)
  return [...counts].map(([k, n]) => `${n} ${k}`).join(', ')
}

function main(): void {
  const root = process.cwd()
  const registry = buildRegistry(root)
  const personaRows = Object.values(registry.personas).flat()
  const summary = `base: ${countBy(registry.base)}; personas: ${Object.keys(registry.personas).length} (${personaRows.length} rows)`
  if (process.argv.includes('--dry')) {
    console.log(`registry (dry): ${summary}`)
    return
  }
  const text = formatProjection(registry)
  for (const rel of PROJECTION_PATHS) writeFileSync(join(root, rel), text)
  console.log(`registry: wrote ${PROJECTION_PATHS.length} copies; ${summary}`)
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('registry/generate.ts')) main()
