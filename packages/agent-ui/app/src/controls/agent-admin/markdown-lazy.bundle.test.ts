// markdown-lazy.bundle.test.ts — GH #468 (the app-diet hunt): the BUNDLE-level trip-wire proving
// `@agent-ui/app`'s public barrel carries ZERO `@agent-ui/code/markdown` bytes, and that `<ui-markdown>` is
// still reachable behind a lazy chunk. Mirrors dogfood-lazy.bundle.test.ts's own pattern (GH #354) one
// module over: same reasoning (a real Rolldown bundle measures the PROPERTY — no static path anywhere in
// the transitive graph puts the module in the entry chunk — where a source grep would only prove the
// current spelling of one import), same `moduleIds`-based assertion (reads the module graph exactly instead
// of pattern-matching minified string literals), same negative control (a synthetic entry that DOES
// statically import the subpath alongside the app barrel lands it in the entry chunk there, so a green
// result above is a genuine absence, never a check that can't fail).
//
// Measured through the REAL bundler (Rolldown, the engine under Vite 8 — the same pipeline
// `scripts/measure-size.mjs` gates bytes with): before this split, agent-admin.ts's static
// `import '@agent-ui/code/markdown'` cost the app barrel's marginal ~5.4 KB gz (measured 82866 → 77472 B gz,
// GH #468) — real weight paid by every consumer of the barrel whether or not Markdown mode was ever
// switched on, since `agent-admin.ts` (`ui-agent-admin`) is itself a direct barrel export.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
const MARKDOWN_SUBPATH = '@agent-ui/code/markdown'
const MARKDOWN_MODULE = 'code/src/markdown/markdown.ts'

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

const holdsMarkdown = (chunk: Chunk): boolean => chunk.moduleIds.some((id) => id.endsWith(MARKDOWN_MODULE))

describe('@agent-ui/app public barrel — @agent-ui/code/markdown is LAZY (GH #468, the dogfood-lazy/ADR-0139 precedent)', () => {
  it(
    'no ENTRY chunk of the app barrel contains the markdown module',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const entries = chunks.filter((c) => c.isEntry)
      expect(entries.length, 'anti-vacuous: the bundle really produced an entry chunk').toBeGreaterThan(0)
      for (const entry of entries) {
        expect(holdsMarkdown(entry), 'the app entry chunk must carry ZERO @agent-ui/code/markdown bytes').toBe(false)
      }
    },
    120_000,
  )

  it(
    'the module is STILL reachable — it lands in a non-entry (lazy) chunk, so Markdown-ON still has a renderer to mount',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const lazy = chunks.filter((c) => !c.isEntry && holdsMarkdown(c))
      expect(lazy.length, 'the dynamic import must still resolve the module — a deleted import would also pass leg 1').toBe(1)
    },
    120_000,
  )

  it(
    'negative control: a STATIC import of the same subpath DOES land the module in the entry chunk (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:markdown-static-negative-control'
      const plugin = {
        name: 'markdown-static-negative-control',
        resolveId(id: string) {
          if (id === 'virtual:markdown-static-negative-control') return VIRTUAL
          return null
        },
        load(id: string) {
          if (id === VIRTUAL) {
            return `import ${JSON.stringify(APP_ENTRY)}\nimport { UIMarkdownElement } from '${MARKDOWN_SUBPATH}'\nexport default UIMarkdownElement\n`
          }
          return null
        },
      }
      const chunks = await chunksOf('virtual:markdown-static-negative-control', [plugin])
      const entries = chunks.filter((c) => c.isEntry)
      expect(entries.some(holdsMarkdown), 'a static import must be CAUGHT by the same moduleIds check').toBe(true)
    },
    120_000,
  )
})
