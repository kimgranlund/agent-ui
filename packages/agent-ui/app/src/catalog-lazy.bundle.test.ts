// catalog-lazy.bundle.test.ts: ADR-0241 cl.9, the bundle-shape gate for lazy catalog bodies. A real Rolldown
// bundle of the `@agent-ui/app` `.` barrel proves no catalog body (the default `agent-ui` document, its factories
// and the built-in control registry since the ADR-0241 Amendment, a2ui-basic under both ids, the shipped persona
// packages and the compose step) is in the EAGER closure, and that each one sits in a non-eager chunk the
// renderer fetches by catalog id. The `pdf-identity.bundle.test.ts` and
// `agent-admin-lazy.bundle.test.ts` shape. It is also the `INEFFECTIVE_DYNAMIC_IMPORT` trip-wire: one static
// import of a body from an eager module silently undoes the split, and the negative control proves this
// check catches that.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'
import { urlSuffixStubPlugin } from './bundle-test-url-stub.ts'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
const CATALOG = `${ROOT}/packages/agent-ui/a2ui/src/catalog`
// The lazy bodies (ADR-0241 cl.2 and its Amendment): every module a host that renders no surface must not load.
const BODY_MODULES = [
  'default/body.ts',
  'default/index.ts',
  'default/catalog.json',
  'default/factories.ts',
  'controls.ts',
  'a2ui-basic/body.ts',
  'a2ui-basic/index.ts',
  'a2ui-basic/catalog.json',
  'a2ui-basic/factories.ts',
  'a2ui-basic/functions.ts',
  'compose.ts',
  'personas/index.ts',
  'personas/fixture-demo/index.ts',
  'personas/fixture-demo/factories.ts',
  'personas/fixture-demo/catalog.json',
  'personas/concierge/index.ts',
  'personas/concierge/factories.ts',
  'personas/concierge/catalog.json',
  'personas/croupier/index.ts',
  'personas/croupier/factories.ts',
  'personas/croupier/catalog.json',
].map((m) => `${CATALOG}/${m}`)

interface Chunk {
  eager: boolean
  moduleIds: string[]
}

// The eager closure is the entry chunks plus their transitive STATIC `imports` (the app size row's own
// accounting since ADR-0197); everything else is fetched only through a dynamic import.
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
  return chunks.map((c) => ({ eager: eager.has(c.fileName), moduleIds: c.moduleIds ?? [] }))
}

const bodiesIn = (chunk: Chunk): string[] => BODY_MODULES.filter((m) => chunk.moduleIds.includes(m))

describe('@agent-ui/app public barrel: catalog bodies are LAZY (ADR-0241 cl.9)', () => {
  it(
    'no eager chunk holds a body module, and every body module sits in a non-eager chunk',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const eager = chunks.filter((c) => c.eager)
      expect(eager.length, 'anti-vacuous: the bundle really produced an eager closure').toBeGreaterThan(0)
      expect(eager.flatMap(bodiesIn), 'the app EAGER closure must carry no lazy catalog body').toEqual([])
      const lazy = new Set(chunks.filter((c) => !c.eager).flatMap(bodiesIn))
      expect(BODY_MODULES.filter((m) => !lazy.has(m)), 'each body is bundled, in a chunk fetched by catalog id').toEqual([])
    },
    120_000,
  )

  it(
    'negative control: a STATIC import of a body from the eager graph lands it in the eager closure (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:catalog-body-static-negative-control'
      const plugin = {
        name: 'catalog-body-static-negative-control',
        resolveId(id: string) {
          return id === 'virtual:catalog-body-static-negative-control' ? VIRTUAL : null
        },
        load(id: string) {
          if (id !== VIRTUAL) return null
          return `import ${JSON.stringify(APP_ENTRY)}\nimport { a2uiBasicFactories } from ${JSON.stringify(`${CATALOG}/a2ui-basic/factories.ts`)}\nexport default a2uiBasicFactories\n`
        },
      }
      const chunks = await chunksOf('virtual:catalog-body-static-negative-control', [plugin])
      const eager = chunks.filter((c) => c.eager).flatMap(bodiesIn)
      expect(eager, 'a static import must be CAUGHT by the same moduleIds check').toContain(`${CATALOG}/a2ui-basic/factories.ts`)
    },
    120_000,
  )
})
