// T-0476: the persona seed a live probe run answers from, for the fixture it leaves behind. Its own module so a test
// can load it without the browser-run machinery in run.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ProbeFixture } from './model.ts'

/** T-0476: the persona seed `agent` (a preset id) runs from, read off its agent manifest (`seedVersion` and `seedDigest`,
 *  drift-gated against the tree by `agent-manifest.test.ts`). `undefined` when no manifest names that preset or it
 *  carries no seed. */
export function personaSeedRecord(agent: string, root: string): ProbeFixture['seed'] {
  const dir = path.join(root, 'site', 'lib', 'agent-manifest')
  if (!existsSync(dir)) return undefined
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.manifest.json'))) {
    const m = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as { preset?: unknown; seedVersion?: unknown; seedDigest?: unknown }
    if (m.preset === agent && typeof m.seedVersion === 'number' && typeof m.seedDigest === 'string') return { version: m.seedVersion, digest: m.seedDigest }
  }
  return undefined
}
