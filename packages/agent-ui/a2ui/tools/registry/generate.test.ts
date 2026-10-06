// generate.test.ts: the drift gate behind `site/capability-registry.json` and its `site/public/` twin
// (GH #1807). Mirrors `sitemap.test.ts`: the committed bytes must equal a fresh generation through the SAME
// loader and serializer the CLI writes with, so there is no generator/gate drift pair. A descriptor,
// catalog, sidecar, mini-skill, pack or corpus edit without a regeneration fails here and names the command.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECTION_PATHS, REGENERATE_COMMAND, buildRegistry, formatProjection, projectionText } from './generate.ts'

const ROOT = process.cwd()
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8') as string

/** The copies whose bytes differ from `fresh` (a missing copy counts as stale). Shared by the real leg and the controls. */
function staleCopies(copies: Readonly<Record<string, string | undefined>>, fresh: string): string[] {
  return Object.entries(copies)
    .filter(([, text]) => text !== fresh)
    .map(([path]) => path)
}

function readCopies(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const rel of PROJECTION_PATHS) {
    try {
      out[rel] = read(rel)
    } catch {
      out[rel] = undefined
    }
  }
  return out
}

const FRESH = projectionText(ROOT)

describe('capability-registry projection: byte-identical to a fresh generation', () => {
  it('anti-vacuous: the generation is a real registry, not an empty or degenerate pass', () => {
    const registry = buildRegistry(ROOT)
    const count = (kind: string): number => registry.base.filter((r) => r.kind === kind).length
    expect(count('control')).toBeGreaterThan(70)
    expect(registry.base.filter((r) => r.kind === 'type' && r.scope === 'agent-ui').length).toBeGreaterThanOrEqual(80)
    expect(registry.base.filter((r) => r.kind === 'type' && r.scope === 'a2ui-basic').length).toBeGreaterThanOrEqual(14)
    expect(count('mini-skill')).toBeGreaterThan(0)
    expect(count('genui-pack')).toBeGreaterThan(0)
    expect(count('corpus-shard')).toBeGreaterThan(0)
    expect(Object.keys(registry.personas).length).toBeGreaterThanOrEqual(3)
  })

  it('every shipped control resolves to exactly one decided state (none uncatalogued)', () => {
    const registry = buildRegistry(ROOT)
    const uncatalogued = registry.base.filter((r) => r.kind === 'control' && r.status.state === 'uncatalogued').map((r) => r.tag)
    expect(uncatalogued).toEqual([])
  })

  it('is deterministic: two generations are the same bytes, with no timestamp key', () => {
    expect(projectionText(ROOT)).toBe(FRESH)
    expect(FRESH).not.toMatch(/"(?:generatedAt|timestamp|createdAt|updatedAt)"/)
  })

  it('both committed copies equal the fresh generation', () => {
    const stale = staleCopies(readCopies(), FRESH)
    expect(stale, `stale or missing: ${stale.join(', ')}. Regenerate with \`${REGENERATE_COMMAND}\``).toEqual([])
  })

  it('NEGATIVE: a stale copy, a missing copy and an edited descriptor line are all reported by the same predicate', () => {
    const good = Object.fromEntries(PROJECTION_PATHS.map((p) => [p, FRESH]))
    expect(staleCopies(good, FRESH)).toEqual([])
    // one byte of drift in one copy
    expect(staleCopies({ ...good, [PROJECTION_PATHS[1]]: `${FRESH} ` }, FRESH)).toEqual([PROJECTION_PATHS[1]])
    // a copy that was never written
    expect(staleCopies({ ...good, [PROJECTION_PATHS[0]]: undefined }, FRESH)).toEqual([PROJECTION_PATHS[0]])
    // a descriptor `description:` edit without a regeneration: plant it in the composed registry
    const registry = buildRegistry(ROOT)
    const edited = {
      ...registry,
      base: registry.base.map((r, i) => (i === registry.base.findIndex((x) => x.kind === 'control') ? { ...r, description: `${r.description ?? ''} edited` } : r)),
    }
    expect(staleCopies(good, formatProjection(edited))).toEqual([...PROJECTION_PATHS])
  })
})
