// generate.test.ts: the drift gate behind `site/capability-registry.json` and its `site/public/` twin
// (GH #1807). Mirrors `sitemap.test.ts`: the committed bytes must equal a fresh generation through the SAME
// loader and serializer the CLI writes with, so there is no generator/gate drift pair. A descriptor,
// catalog, sidecar, mini-skill, pack or corpus edit without a regeneration fails here and names the command.
// The same command also writes `src/registry/selection-projection.gen.ts` (T-0025): the browser-safe copy of
// the selection sidecars, gated by the last describe below with the same stale-copy predicate.

import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PROJECTION_PATHS,
  REGENERATE_COMMAND,
  SELECTION_PROJECTION_HEADER,
  SELECTION_PROJECTION_PATH,
  buildRegistry,
  formatProjection,
  formatSelectionProjection,
  projectionText,
  selectionProjectionModule,
} from './generate.ts'
import { loadRegistrySources } from './load.ts'

const ROOT = process.cwd()

/** The copies whose bytes differ from `fresh` (a missing copy counts as stale). Shared by the real leg and the controls. */
function staleCopies(copies: Readonly<Record<string, string | undefined>>, fresh: string): string[] {
  return Object.entries(copies)
    .filter(([, text]) => text !== fresh)
    .map(([path]) => path)
}

/** `paths` read under `root`; a file that cannot be read is `undefined`, which `staleCopies` counts as stale. */
function readCopies(paths: readonly string[] = PROJECTION_PATHS, root: string = ROOT): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const rel of paths) {
    try {
      out[rel] = readFileSync(join(root, rel), 'utf8') as string
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

describe('selection projection module: byte-identical to a fresh generation', () => {
  const FRESH_MODULE = selectionProjectionModule(ROOT)

  it('anti-vacuous: the generation is a real module carrying the GENERATED header and real sidecar data', () => {
    expect(FRESH_MODULE.split('\n')[0]).toBe(SELECTION_PROJECTION_HEADER)
    expect(FRESH_MODULE).toContain('export const SELECTION_PROJECTION: SelectionProjection = {')
    expect(FRESH_MODULE).toContain('"agent-ui": {')
    expect(FRESH_MODULE).toContain('"croupier": {')
    expect(FRESH_MODULE).toContain('"PlayingCard": {"intents"')
    expect(FRESH_MODULE.length).toBeGreaterThan(10_000)
  })

  it('is deterministic, and writes no timestamp', () => {
    expect(selectionProjectionModule(ROOT)).toBe(FRESH_MODULE)
    expect(FRESH_MODULE).not.toMatch(/generatedAt|timestamp|createdAt|updatedAt/)
  })

  /** The real leg's whole path under `root`: read the module (an unreadable one is `undefined`, so stale) and compare. */
  const staleModule = (root: string): string[] => staleCopies(readCopies([SELECTION_PROJECTION_PATH], root), FRESH_MODULE)
  const message = (stale: readonly string[]): string => `stale or missing: ${stale.join(', ')}. Regenerate with \`${REGENERATE_COMMAND}\``

  it('the committed module equals the fresh generation', () => {
    const stale = staleModule(ROOT)
    expect(stale, message(stale)).toEqual([])
  })

  it('NEGATIVE: one edited sidecar `why`, one dropped type and a missing module are each reported by the same predicate', () => {
    const sources = loadRegistrySources(ROOT)
    const good = { [SELECTION_PROJECTION_PATH]: FRESH_MODULE }
    expect(staleCopies(good, FRESH_MODULE)).toEqual([])

    // a sidecar `why` edit without a regeneration: plant it in the loaded guidance
    const button = sources.guidance.base['agent-ui']!.Button!
    const editedWhy = {
      ...sources.guidance,
      base: {
        ...sources.guidance.base,
        'agent-ui': { ...sources.guidance.base['agent-ui']!, Button: { ...button, notFor: [{ ...button.notFor[0]!, why: `${button.notFor[0]!.why} edited` }] } },
      },
    }
    expect(staleCopies(good, formatSelectionProjection(editedWhy))).toEqual([SELECTION_PROJECTION_PATH])

    // a new sidecar type with no regeneration
    const { Button: _dropped, ...withoutButton } = sources.guidance.base['agent-ui']!
    const droppedType = { ...sources.guidance, base: { ...sources.guidance.base, 'agent-ui': withoutButton } }
    expect(staleCopies(good, formatSelectionProjection(droppedType))).toEqual([SELECTION_PROJECTION_PATH])

    // a module that was never written: the REAL read path, run against a root that has no such file, reports it
    // (rather than throwing ENOENT before the comparison) and the failure message names the regenerate command
    const emptyRoot = mkdtempSync(join(tmpdir(), 'selection-projection-missing-'))
    try {
      const stale = staleModule(emptyRoot)
      expect(stale).toEqual([SELECTION_PROJECTION_PATH])
      expect(message(stale)).toContain(SELECTION_PROJECTION_PATH)
      expect(message(stale)).toContain('npm run generate:registry')
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true })
    }
  })

  it('the emitted text is invisible to the raw-text scanners: no single quote, no column-0 call, only the import type and the export at column 0', () => {
    const lines = FRESH_MODULE.split('\n')
    const body = lines.filter((l) => /^\s/.test(l))
    expect(body.some((l) => l.includes("'"))).toBe(false)
    expect(lines.filter((l) => l !== '' && !/^\s/.test(l) && !l.startsWith('// ') && !l.startsWith('import type ') && !l.startsWith('export const ') && l !== '}')).toEqual([])
    expect(/^(void |await )?[A-Za-z_$][\w$.]*\(/m.test(FRESH_MODULE)).toBe(false)
  })
})
