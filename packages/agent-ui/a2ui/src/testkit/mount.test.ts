// mount.test.ts: the kit's deterministic mount (tools/testkit/mount.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { armOffline } from '../../tools/testkit/offline.ts'
import { createKitMount, RenderError } from '../../tools/testkit/mount.ts'

declare const process: { cwd(): string }

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const kitRaw = import.meta.glob('../../tools/testkit/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const legRaw = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const j = (v: unknown): string => JSON.stringify(v)
const create = (sid: string) => j({ version: 'v1.0', createSurface: { surfaceId: sid, catalogId: 'agent-ui' } })

describe('createKitMount', () => {
  it('a Button surface settles to a defined ui-button with no placeholder', async () => {
    const m = createKitMount()
    try {
      m.ingest([create('s'), j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Button', label: 'Go' }] } })])
      await m.settle()
      const root = m.surfaceRoot('s')!
      expect(root.localName).toBe('ui-button')
      expect(customElements.get('ui-button')).toBeDefined()
      expect(m.root.querySelector('a2ui-placeholder')).toBeNull()
      expect(m.clientMessages().filter((c) => 'error' in c)).toEqual([])
    } finally {
      m.dispose()
    }
  })

  it('dispose leaves document.body empty', () => {
    const m = createKitMount()
    m.ingest([create('s')])
    m.dispose()
    expect(document.body.children.length).toBe(0)
  })

  it('stuck-surface control: a createSurface with no components never attaches; settle rejects RENDER_ERROR before vitest times out', async () => {
    // Default options and no test timeout of its own: this passes only while the default settle timeout
    // stays below vitest's 5 s default.
    const m = createKitMount()
    try {
      m.ingest([create('stuck')])
      let caught: unknown
      try {
        await m.settle()
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(RenderError)
      expect((caught as RenderError).code).toBe('RENDER_ERROR')
      expect((caught as RenderError).detail).toContain('stuck')
    } finally {
      m.dispose()
    }
  })

  it('the action provider is deterministic: kit-action-<n> and the fixed clock', async () => {
    const m = createKitMount()
    try {
      m.ingest([create('s'), j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Button', label: 'Go', action: { action: 'go' } }] } })])
      await m.settle()
      m.surfaceRoot('s')!.click()
      expect(m.clientMessages()).toEqual([
        { version: 'v1.0', action: expect.objectContaining({ name: 'go', actionId: 'kit-action-1', timestamp: '2026-01-01T00:00:00.000Z', surfaceId: 's', sourceComponentId: 'root' }) },
      ])
    } finally {
      m.dispose()
    }
  })

  it('the seam: mount.ts is the only kit or leg file naming the control-definition seam', () => {
    const pattern = new RegExp([['@agent-ui', 'components'].join('/'), ['catalog', 'controls\\.ts'].join('/')].join('|'))
    // Vite's glob never returns the importer, so this file reads itself; its pattern is assembled at run time.
    const self = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/testkit/mount.test.ts`, 'utf8') as string
    const all: Record<string, string> = { ...kitRaw, ...legRaw, './mount.test.ts': self }
    const namers = Object.entries(all).filter(([, src]) => pattern.test(src)).map(([p]) => p)
    expect(namers).toEqual(['../../tools/testkit/mount.ts'])
    // Control: a planted import of the components package is caught by the same pattern.
    expect(pattern.test(`import { signal } from '${['@agent-ui', 'components'].join('/')}'`)).toBe(true)
  })
})
