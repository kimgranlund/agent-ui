// skill-pack-lazy.bundle.test.ts — ADR-0208 D6's bundle assertion (GH #1340/#1349 S2), the
// agent-admin-lazy.bundle.test.ts precedent (ADR-0197's Rolldown `moduleIds` trip-wire) applied to
// the skill-pack ingestion module: the app-side ingestion code adds ZERO eager weight to the
// `@agent-ui/app` barrel — imported packs live user-local only (the gitignored snapshot + the
// browser store), never as repo/bundle bytes, and `skill-pack-store.ts` is reachable ONLY through
// its own opt-in subpath (`@agent-ui/app/agent-admin-skill-packs`, the site page's import). The
// assertion is BUNDLE-level (a real Rolldown build measuring the eager closure), never a weaker
// runtime-only check, with the negative control proving the check can fail.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'
import { urlSuffixStubPlugin } from '../../bundle-test-url-stub.ts'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
const INGEST_MODULE = 'controls/agent-admin/skill-pack-store.ts'

interface Chunk {
  isEntry: boolean
  eager: boolean
  moduleIds: string[]
}

// The eager-closure derivation is the agent-admin-lazy precedent verbatim: entry chunks PLUS their
// transitive static `imports` (a shared chunk the entry imports statically is eager too — `isEntry`
// alone would pass vacuously if the module leaked into a static shared chunk).
const chunksOf = async (input: string, plugins: unknown[] = []): Promise<Chunk[]> => {
  const bundle = await rolldown({ input, plugins: [urlSuffixStubPlugin, ...plugins] as never, onLog() {} })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const chunks = output.filter((c) => c.type === 'chunk')
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  const eager = new Set(chunks.filter((c) => c.isEntry).map((c) => c.fileName))
  for (const name of eager) {
    for (const dep of byFile.get(name)?.imports ?? []) if (byFile.has(dep)) eager.add(dep)
  }
  return chunks.map((c) => ({ isEntry: c.isEntry, eager: eager.has(c.fileName), moduleIds: c.moduleIds ?? [] }))
}

const carriesIngest = (chunk: Chunk): boolean => chunk.moduleIds.some((id) => id.endsWith(INGEST_MODULE))

describe('@agent-ui/app barrel — the skill-pack ingestion module adds ZERO eager weight (ADR-0208 D6)', () => {
  it(
    'no chunk of the app barrel EAGER closure carries skill-pack-store.ts (nothing below the subpath imports it)',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const eager = chunks.filter((c) => c.eager)
      expect(eager.length, 'anti-vacuous: the bundle really produced an eager closure').toBeGreaterThan(0)
      for (const chunk of eager) {
        expect(carriesIngest(chunk), 'the app EAGER closure must carry ZERO skill-pack ingestion bytes').toBe(false)
      }
    },
    120_000,
  )

  it(
    'negative control: a STATIC import of the ./agent-admin-skill-packs subpath DOES land the module eagerly (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:skill-pack-static-negative-control'
      const plugin = {
        name: 'skill-pack-static-negative-control',
        resolveId(id: string) {
          if (id === 'virtual:skill-pack-static-negative-control') return VIRTUAL
          return null
        },
        load(id: string) {
          if (id === VIRTUAL) {
            return `import ${JSON.stringify(APP_ENTRY)}\nimport { loadSkillPacks } from '@agent-ui/app/agent-admin-skill-packs'\nexport default loadSkillPacks\n`
          }
          return null
        },
      }
      const chunks = await chunksOf('virtual:skill-pack-static-negative-control', [plugin])
      const eager = chunks.filter((c) => c.eager)
      expect(
        eager.some((c) => carriesIngest(c)),
        'a static import must be CAUGHT by the same moduleIds check',
      ).toBe(true)
    },
    120_000,
  )
})
