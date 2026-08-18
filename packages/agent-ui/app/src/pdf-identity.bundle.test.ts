// pdf-identity.bundle.test.ts — ADR-0202 cl.4a, the identity gate proper: a REAL Rolldown bundle of the
// `@agent-ui/app` `.` barrel proves `pdfjs-dist` bytes never reach the EAGER closure — the
// `agent-admin-lazy.bundle.test.ts` (ADR-0197) / `markdown-lazy.bundle.test.ts` shape, one dependency
// later. Byte-identical for a consumer who never attaches a `.pdf`: this is the OUTPUT-level proof;
// `pdf-confinement.test.ts` is the source-text trip-wire that the ONE designated module
// (`lib/pdf-worker.ts`) is the sole static entry point.
import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`

interface Chunk {
  isEntry: boolean
  eager: boolean
  code: string
  moduleIds: string[]
}

// A bare `rolldown()` call has no Vite asset pipeline, so it can't load pdf-worker.ts's own
// `pdfjs-dist/build/pdf.worker.min.mjs?url` specifier — the SAME gap `scripts/measure-size.mjs`'s
// `appCssQuerySuffixPlugin` closes for the size gate; this is that plugin's one-rule subset (bare
// specifiers only — this test never touches a relative or `@agent-ui/*` `?url`/`?raw` import).
const urlSuffixStubPlugin = {
  name: 'pdf-url-suffix-stub',
  resolveId(source: string) {
    if (!source.endsWith('?url')) return null
    const bare = source.slice(0, -'?url'.length)
    return { id: `${fileURLToPath(import.meta.resolve(bare))}?url`, moduleSideEffects: false }
  },
  load(id: string) {
    if (!id.endsWith('?url')) return null
    return `export default ${JSON.stringify(`/${id.slice(0, -'?url'.length).split('/').pop()}`)}`
  },
}

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
  return chunks.map((c) => ({ isEntry: c.isEntry, eager: eager.has(c.fileName), code: c.code, moduleIds: c.moduleIds ?? [] }))
}

const touchesPdfjs = (chunk: Chunk): boolean =>
  chunk.moduleIds.some((id) => id.includes('pdfjs-dist')) || chunk.code.includes('pdfjs-dist')

describe('@agent-ui/app public barrel — pdfjs-dist is LAZY and never reaches the eager closure (ADR-0202 cl.4a)', () => {
  it(
    'no ENTRY (eager) chunk of the app barrel contains any pdfjs-dist module or reference',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const eager = chunks.filter((c) => c.eager)
      expect(eager.length, 'anti-vacuous: the bundle really produced an eager closure').toBeGreaterThan(0)
      for (const chunk of eager) {
        expect(touchesPdfjs(chunk), 'the app EAGER closure must carry ZERO pdfjs-dist bytes').toBe(false)
      }
    },
    120_000,
  )

  it(
    'negative control: a STATIC import reaching pdf-worker.ts DOES land pdfjs-dist in the entry chunk (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:pdf-worker-static-negative-control'
      const plugin = {
        name: 'pdf-worker-static-negative-control',
        resolveId(id: string) {
          if (id === 'virtual:pdf-worker-static-negative-control') return VIRTUAL
          return null
        },
        load(id: string) {
          if (id === VIRTUAL) {
            return `import ${JSON.stringify(APP_ENTRY)}\nimport { extractPdfText } from ${JSON.stringify(`${ROOT}/packages/agent-ui/app/src/lib/pdf-worker.ts`)}\nexport default extractPdfText\n`
          }
          return null
        },
      }
      const chunks = await chunksOf('virtual:pdf-worker-static-negative-control', [plugin])
      const eager = chunks.filter((c) => c.eager)
      expect(eager.some(touchesPdfjs), 'a static import must be CAUGHT by the same moduleIds/code check').toBe(true)
    },
    120_000,
  )
})
