// agent-admin-lazy.bundle.test.ts — ADR-0197 (GH #1092): the BUNDLE-level trip-wire proving the
// `@agent-ui/app` `.` barrel carries ZERO agent-admin-arm bytes, and that `<ui-agent-admin>` is still
// reachable behind the barrel's `loadAgentAdmin()` lazy chunk. The markdown-lazy.bundle.test.ts pattern
// verbatim (itself the dogfood-lazy.bundle.test.ts / GH #354 shape): a real Rolldown bundle measures the
// PROPERTY (no static path anywhere in the transitive graph lands the arm in the entry chunk) via
// `moduleIds`, with the negative control proving the check can fail.
import { describe, it, expect } from 'vitest'
import { rolldown } from 'rolldown'

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

const armModulesIn = (chunk: Chunk): string[] =>
  ARM_MODULES.filter((m) => chunk.moduleIds.some((id) => id.endsWith(m)))

describe('@agent-ui/app public barrel — the agent-admin arm is LAZY (ADR-0197, the markdown-lazy/GH #354 precedent)', () => {
  it(
    'no ENTRY chunk of the app barrel contains any agent-admin arm module',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const entries = chunks.filter((c) => c.isEntry)
      expect(entries.length, 'anti-vacuous: the bundle really produced an entry chunk').toBeGreaterThan(0)
      for (const entry of entries) {
        expect(armModulesIn(entry), 'the app entry chunk must carry ZERO agent-admin arm bytes').toEqual([])
      }
    },
    120_000,
  )

  it(
    'the arm is STILL reachable — agent-admin.ts lands in a non-entry (lazy) chunk, so loadAgentAdmin() has a module to resolve',
    async () => {
      const chunks = await chunksOf(APP_ENTRY)
      const lazy = chunks.filter((c) => !c.isEntry && c.moduleIds.some((id) => id.endsWith('controls/agent-admin/agent-admin.ts')))
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
      const entries = chunks.filter((c) => c.isEntry)
      expect(
        entries.some((c) => armModulesIn(c).length > 0),
        'a static import must be CAUGHT by the same moduleIds check',
      ).toBe(true)
    },
    120_000,
  )
})
