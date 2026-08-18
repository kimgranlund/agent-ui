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
import { urlSuffixStubPlugin } from '../../bundle-test-url-stub.ts'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
const DOGFOOD_SUBPATH = '@agent-ui/components/dogfood-frame'
const DOGFOOD_MODULE = 'sandbox-frame/dogfood/dogfood-assets.ts'
/** The committed fixture is 450 675 B of incompressible string data on disk, so the LAZY chunk that really
 *  holds it clears this floor on its own (measured 520 371 B minified) while a stub never would. */
const FIXTURE_FLOOR = 400_000
/**
 * The separate "this entry chunk cannot be holding the fixture" ceiling, in minified bytes: an entry chunk
 * with the fixture inside would measure the app's own ~400 KB PLUS the fixture (~850 KB).
 *
 * SPLIT OUT of `FIXTURE_FLOOR` (GH #891 S6, 2026-08-14). One constant was serving two OPPOSITE roles — a
 * lower bound on the lazy chunk and an upper bound on the entry chunk — so the entry side had silently
 * become an accidental, unowned SIZE BUDGET pinned ~4 KB above the real entry size: measured at that slice,
 * the entry chunk was 396 252 B before and 400 534 B after (+4 282 B, module count unchanged at 178 — no new
 * dependency, just more code in modules already in the graph), which reddened this leg while the property it
 * guards was never at risk. The EXACT gate is `holdsFixture` (the `moduleIds` membership test asserted
 * alongside it, and the leg the negative control exercises); this size assertion is only its belt, and must
 * be crossable ONLY by a genuine leak, never by a feature. Real byte BUDGETS live in
 * `scripts/measure-size.mjs`, which owns per-package ceilings and re-bases them deliberately.
 */
const ENTRY_LEAK_CEILING = 600_000

interface Chunk {
  isEntry: boolean
  code: string
  moduleIds: string[]
}

// GH #1215/ADR-0202 — bundling the app barrel now traverses into the agent-admin arm's own
// document-ingest.ts -> pdf-extractor.ts -> pdf-worker.ts chain, which carries a Vite `?url` specifier
// (`urlSuffixStubPlugin`, shared with the sibling agent-admin-lazy/markdown-lazy/pdf-identity bundle
// tests) — a bare `rolldown()` call has no Vite asset pipeline to resolve it on its own.
const chunksOf = async (input: string, plugins: unknown[] = []): Promise<Chunk[]> => {
  const bundle = await rolldown({ input, plugins: [urlSuffixStubPlugin, ...plugins] as never, onLog() {} })
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
        expect(Buffer.byteLength(entry.code)).toBeLessThan(ENTRY_LEAK_CEILING)
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
