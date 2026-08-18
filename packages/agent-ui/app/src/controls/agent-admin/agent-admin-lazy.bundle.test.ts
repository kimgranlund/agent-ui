// agent-admin-lazy.bundle.test.ts — ADR-0197 (GH #1092): the BUNDLE-level trip-wire proving the
// `@agent-ui/app` `.` barrel carries ZERO agent-admin-arm bytes, and that `<ui-agent-admin>` is still
// reachable behind the barrel's `loadAgentAdmin()` lazy chunk. The markdown-lazy.bundle.test.ts pattern
// verbatim (itself the dogfood-lazy.bundle.test.ts / GH #354 shape): a real Rolldown bundle measures the
// PROPERTY (no static path anywhere in the transitive graph lands the arm in the entry chunk) via
// `moduleIds`, with the negative control proving the check can fail.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'
import { urlSuffixStubPlugin } from '../../bundle-test-url-stub.ts'

const ROOT = process.cwd()
const APP_ENTRY = `${ROOT}/packages/agent-ui/app/src/index.ts`
// The arm's four heaviest / contract-named modules (ADR-0197 cl.4a's enumeration).
const ARM_MODULES = [
  'controls/agent-admin/agent-admin.ts',
  'controls/agent-admin/entries.ts',
  'controls/agent-admin/agent-admin-schema.ts',
  'controls/agent-admin/prompt-lint.ts',
] as const

interface Chunk {
  isEntry: boolean
  eager: boolean
  code: string
  moduleIds: string[]
}

// ONE strengthening over the markdown-lazy precedent, forced by this split's own mechanics: the barrel's
// `loadAgentAdmin()` makes Rolldown code-split, so the shells can land in a SHARED chunk the entry imports
// STATICALLY — `isEntry: false` yet still loaded eagerly with the barrel. The gated property is therefore
// "absent from the EAGER closure" (entry chunks + their transitive static `imports`), not merely "absent
// from `isEntry` chunks" — the latter would pass vacuously if the arm ever leaked into a static shared
// chunk (the same closure `scripts/measure-size.mjs`'s app row gates bytes with since ADR-0197).
// GH #1215/ADR-0202 — bundling the app barrel now traverses into the agent-admin arm's own
// document-ingest.ts -> pdf-extractor.ts -> pdf-worker.ts chain, which carries a Vite `?url` specifier
// (`urlSuffixStubPlugin`, shared with the sibling dogfood-lazy/markdown-lazy/pdf-identity bundle tests) —
// a bare `rolldown()` call has no Vite asset pipeline to resolve it on its own.
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

const armModulesIn = (chunk: Chunk): string[] =>
  ARM_MODULES.filter((m) => chunk.moduleIds.some((id) => id.endsWith(m)))

describe('@agent-ui/app public barrel — the agent-admin arm is LAZY (ADR-0197, the markdown-lazy/GH #354 precedent)', () => {
  it(
    'no ENTRY chunk of the app barrel contains any agent-admin arm module',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const eager = chunks.filter((c) => c.eager)
      expect(eager.length, 'anti-vacuous: the bundle really produced an eager closure').toBeGreaterThan(0)
      for (const chunk of eager) {
        expect(armModulesIn(chunk), 'the app EAGER closure must carry ZERO agent-admin arm bytes').toEqual([])
      }
    },
    120_000,
  )

  it(
    'the arm is STILL reachable — agent-admin.ts lands in a non-entry (lazy) chunk, so loadAgentAdmin() has a module to resolve',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const lazy = chunks.filter((c) => !c.eager && c.moduleIds.some((id) => id.endsWith('controls/agent-admin/agent-admin.ts')))
      expect(lazy.length, 'the dynamic import must still resolve the module — a deleted import would also pass leg 1').toBe(1)
    },
    120_000,
  )

  it(
    'negative control: a STATIC import of the ./agent-admin subpath DOES land the arm in the entry chunk (the gate bites)',
    async () => {
      const VIRTUAL = '\0virtual:agent-admin-static-negative-control'
      const plugin = {
        name: 'agent-admin-static-negative-control',
        resolveId(id: string) {
          if (id === 'virtual:agent-admin-static-negative-control') return VIRTUAL
          return null
        },
        load(id: string) {
          if (id === VIRTUAL) {
            return `import ${JSON.stringify(APP_ENTRY)}\nimport { UIAgentAdminElement } from '@agent-ui/app/agent-admin'\nexport default UIAgentAdminElement\n`
          }
          return null
        },
      }
      const chunks = await chunksOf('virtual:agent-admin-static-negative-control', [plugin])
      const entries = chunks.filter((c) => c.eager)
      expect(
        entries.some((c) => armModulesIn(c).length > 0),
        'a static import must be CAUGHT by the same moduleIds check',
      ).toBe(true)
    },
    120_000,
  )
})
