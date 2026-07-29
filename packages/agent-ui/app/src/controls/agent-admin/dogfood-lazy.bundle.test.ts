// dogfood-lazy.bundle.test.ts — GH #354 (Kim's 2026-07-29 ruling): the BUNDLE-level trip-wire proving
// `@agent-ui/app`'s public barrel carries ZERO dogfood-fixture bytes, and that the pair is still reachable
// behind a lazy chunk. This is the ADR-0137 zero-bytes gate pattern (components' own
// `barrels.test.ts` `./dogfood-frame` block) applied ONE package up the DAG, where #354's leak actually
// lived: components' barrels were clean the whole time — `app`'s barrel exports `ui-agent-admin`, which
// statically pulled the 450 675 B pair, so the public entry measured 153 969 B gz against a 75 776 B budget.
//
// Measured through the REAL bundler (Rolldown, the engine under Vite 8 — the same pipeline
// `scripts/measure-size.mjs` gates bytes with), not a source grep: a grep proves the current spelling of one
// import, a bundle proves the PROPERTY (no static path anywhere in the transitive graph puts the fixture in
// the entry chunk). Asserted on `moduleIds` rather than on chunk text, so the gate reads the module graph
// exactly instead of pattern-matching minified string literals.
//
// The negative control bundles a synthetic entry that DOES statically import the subpath alongside the app
// barrel, and asserts the fixture lands in the ENTRY chunk there — so a green result above is a genuine
// absence, never a check that can't fail.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
const DOGFOOD_SUBPATH = '@agent-ui/components/dogfood-frame'
const DOGFOOD_MODULE = 'sandbox-frame/dogfood/dogfood-assets.ts'
/** The committed fixture is 450 675 B on disk; anything holding it is unmistakably over 400 KB minified. */
const FIXTURE_FLOOR = 400_000

interface Chunk {
  isEntry: boolean
  code: string
  moduleIds: string[]
}

const chunksOf = async (input: string, plugins: unknown[] = []): Promise<Chunk[]> => {
  const bundle = await rolldown({ input, plugins: plugins as never, onLog() {} })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  return output
    .filter((c) => c.type === 'chunk')
    .map((c) => ({ isEntry: c.isEntry, code: c.code, moduleIds: c.moduleIds ?? [] }))
}

const holdsFixture = (chunk: Chunk): boolean => chunk.moduleIds.some((id) => id.endsWith(DOGFOOD_MODULE))

describe('@agent-ui/app public barrel — the dogfood fixture is LAZY (GH #354, ADR-0139 lazy-dependency precedent)', () => {
  it(
    'no ENTRY chunk of the app barrel contains the dogfood module — and the entry chunk is nowhere near fixture-sized',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const entries = chunks.filter((c) => c.isEntry)
      expect(entries.length, 'anti-vacuous: the bundle really produced an entry chunk').toBeGreaterThan(0)
      for (const entry of entries) {
        expect(holdsFixture(entry), 'the app entry chunk must carry ZERO dogfood-fixture bytes').toBe(false)
        expect(Buffer.byteLength(entry.code)).toBeLessThan(FIXTURE_FLOOR)
      }
    },
    120_000,
  )

  it(
    'the pair is STILL reachable — it lands in a non-entry (lazy) chunk, so dogfood-ON still has assets to mount',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const lazy = chunks.filter((c) => !c.isEntry && holdsFixture(c))
      expect(lazy.length, 'the dynamic import must still resolve the fixture — a deleted import would also pass leg 1').toBe(1)
      expect(Buffer.byteLength(lazy[0]!.code), 'the lazy chunk holds the real fixture, not a stub').toBeGreaterThan(FIXTURE_FLOOR)
    },
    120_000,
  )

  it(
    'negative control: a STATIC import of the same subpath DOES land the fixture in the entry chunk (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:dogfood-static-negative-control'
      const plugin = {
        name: 'dogfood-static-negative-control',
        resolveId(id: string) {
          if (id === 'virtual:dogfood-static-negative-control') return VIRTUAL
          return null
        },
        load(id: string) {
          if (id === VIRTUAL) {
            return `import ${JSON.stringify(APP_ENTRY)}\nimport { DOGFOOD_CSS } from '${DOGFOOD_SUBPATH}'\nexport default DOGFOOD_CSS.length\n`
          }
          return null
        },
      }
      const chunks = await chunksOf('virtual:dogfood-static-negative-control', [plugin])
      const entries = chunks.filter((c) => c.isEntry)
      expect(entries.some(holdsFixture), 'a static import must be CAUGHT by the same moduleIds check').toBe(true)
    },
    120_000,
  )
})
