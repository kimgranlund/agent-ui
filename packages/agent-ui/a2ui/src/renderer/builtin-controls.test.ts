// builtin-controls.test.ts: the built-in catalogs load their controls on demand (ADR-0233).
//
// The catalog factory modules import no control, so in this file (its own jsdom window) nothing defines a
// fleet tag until the renderer's `builtinControls` loader does. Every render scenario first asserts its
// tags are undefined, so a stray fleet import anywhere in the renderer's closure turns this file red.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import type { ControlLoader } from '@agent-ui/components/loader'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'
import type { A2uiServerMessage } from '../protocol.ts'
import { Registry } from '../catalog/registry.ts'
import { BUILTIN_CONTROL_RECORDS, builtinControls, withSubTags } from '../catalog/controls.ts'
import { CONTROLS } from '@agent-ui/components/registry'
import type { ControlRecord } from '@agent-ui/components/loader'
import { composeControlLoaders } from '../catalog/compose.ts'
import { factoriesOf } from '../catalog/variant.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { a2uiBasicFactories } from '../catalog/a2ui-basic/factories.ts'
import { SHIPPED_PERSONA_CATALOGS } from '../catalog/personas/index.ts'
import { croupierPersona } from '../catalog/personas/croupier/index.ts'
import { isControlTag } from './widget.ts'
import type { VariantDispatch, WidgetFactory } from '../catalog/types.ts'

declare const process: { cwd(): string }

const line = (message: A2uiServerMessage): string => JSON.stringify(message)

function host(): { r: RendererHost; mount: HTMLElement; errors: A2uiClientMessage[]; cleanup: () => void } {
  const errors: A2uiClientMessage[] = []
  const r = createRenderer()
  r.onClientMessage((m) => {
    if ('error' in m) errors.push(m)
  })
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, errors, cleanup: () => { r.dispose(); mount.remove() } }
}

afterEach(() => vi.restoreAllMocks())

describe('a fresh renderer registers the built-in catalogs with a control loader', () => {
  it('default, both a2ui-basic ids and every derived persona entry carry `controls`; personas with records get a composed loader', () => {
    const register = vi.spyOn(Registry.prototype, 'register')
    createRenderer().dispose()
    const byId = new Map<string, ControlLoader | undefined>()
    for (const [catalog, , , controls] of register.mock.calls) byId.set((catalog as { catalogId: string }).catalogId, controls)

    const builtins = [...byId.keys()].filter((id) => !id.includes('--'))
    expect(builtins).toContain('agent-ui')
    expect(builtins).toContain('a2ui-basic')
    expect(builtins.length).toBe(3) // agent-ui, a2ui-basic, and its canonical-URI alias
    for (const id of builtins) expect(byId.get(id), id).toBe(builtinControls)

    const derived = [...byId.keys()].filter((id) => id.includes('--'))
    expect(derived).toContain('agent-ui--croupier')
    expect(derived).toContain('a2ui-basic--croupier')
    for (const id of derived) {
      const controls = byId.get(id)
      expect(controls, id).toBeDefined()
      // A persona with no records inherits the base loader as is; croupier ships one, so it is composed.
      if (id.endsWith('--croupier')) expect(controls, id).not.toBe(builtinControls)
      else expect(controls, id).toBe(builtinControls)
    }
  })

  it('croupier declares its control record, and the composed loader routes ui-playing-card to it, never to the base', async () => {
    expect(croupierPersona.controls?.map((record) => record.tag)).toEqual(['ui-playing-card'])
    const seen: string[][] = []
    const base: ControlLoader = {
      missing: (tags) => {
        seen.push([...tags])
        return []
      },
      ensure: async (tags) => void seen.push([...tags]),
    }
    const composed = composeControlLoaders(base, croupierPersona.controls)!
    expect(composed.missing(['ui-playing-card', 'ui-text'])).toContain('ui-playing-card')
    await composed.ensure(['ui-playing-card', 'ui-text'])
    expect(seen.flat()).not.toContain('ui-playing-card')
    expect(seen.flat()).toContain('ui-text')
    expect(customElements.get('ui-playing-card')).toBeDefined() // the persona loader defined it
  })
})

describe('a default-catalog surface on a page that defined nothing', () => {
  it('defers, then renders once the loader has defined its tags', async () => {
    expect(customElements.get('ui-column')).toBeUndefined()
    expect(customElements.get('ui-text')).toBeUndefined()
    const { r, mount, errors, cleanup } = host()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }))
    r.ingest(line({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's',
        components: [
          { id: 'root', component: 'Column', children: ['t'] },
          { id: 't', component: 'Text', text: 'hello' },
        ] as never,
      },
    }))
    expect(mount.querySelector('ui-text')).toBeNull() // deferred: nothing created before its tag is defined

    await vi.waitFor(() => expect(mount.querySelector('ui-text')).not.toBeNull(), { timeout: 10_000 })
    const Text = customElements.get('ui-text')
    expect(Text).toBeDefined()
    expect(mount.querySelector('ui-text')).toBeInstanceOf(Text!)
    expect(mount.querySelector('ui-column')).toBeInstanceOf(customElements.get('ui-column')!)
    expect(mount.querySelector('ui-text')?.textContent).toContain('hello')
    expect(errors).toEqual([])
    cleanup()
  })

  it('defines the tags a factory mints inside its control (`uses`): a Button with an icon gets a real ui-icon', async () => {
    expect(customElements.get('ui-button')).toBeUndefined()
    expect(customElements.get('ui-icon')).toBeUndefined()
    const { r, mount, errors, cleanup } = host()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'b', catalogId: 'agent-ui' } }))
    r.ingest(line({
      version: 'v1.0',
      updateComponents: { surfaceId: 'b', components: [{ id: 'root', component: 'Button', label: 'Go', icon: 'check' }] as never },
    }))
    await vi.waitFor(() => expect(mount.querySelector('ui-button')).not.toBeNull(), { timeout: 10_000 })
    expect(customElements.get('ui-icon')).toBeDefined()
    const icon = mount.querySelector('ui-button > ui-icon')
    expect(icon).toBeInstanceOf(customElements.get('ui-icon')!)
    expect(errors).toEqual([])
    cleanup()
  })

  it('a non-custom factory tag (an a2ui-basic Image is an <img>) never reaches the loader', async () => {
    const { r, mount, errors, cleanup } = host()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'i', catalogId: 'a2ui-basic' } }))
    r.ingest(line({
      version: 'v1.0',
      updateComponents: { surfaceId: 'i', components: [{ id: 'root', component: 'Image', url: 'https://example.test/a.png' }] as never },
    }))
    expect(mount.querySelector('img')).not.toBeNull() // synchronous: nothing to define
    expect(mount.querySelector('a2ui-placeholder')).toBeNull()
    expect(errors).toEqual([])
    cleanup()
  })
})

// ── guards: every tag a shipped factory creates has a record the built-in loader serves ──────────

type Table = Record<string, WidgetFactory | VariantDispatch>

const tagsOf = (table: Table): string[] => Object.values(table).flatMap((slot) => factoriesOf(slot).flatMap((f) => [f.tag, ...(f.uses ?? [])]))

/** `createElement('ui-…')` literals in `source` (comments stripped) that no factory in `table` names in `tag` or `uses`. */
function unnamedMints(source: string, table: Table): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const named = new Set(tagsOf(table))
  const minted = [...code.matchAll(/createElement\(\s*['"](ui-[a-z][a-z0-9-]*)['"]/g)].map((m) => m[1]!)
  return [...new Set(minted.filter((tag) => !named.has(tag)))].sort()
}

const CATALOG = 'packages/agent-ui/a2ui/src/catalog'
const read = (path: string): string => readFileSync(posix.join(process.cwd(), path), 'utf8')
const MODULES: ReadonlyArray<readonly [string, Table]> = [
  [`${CATALOG}/default/factories.ts`, defaultFactories],
  [`${CATALOG}/a2ui-basic/factories.ts`, a2uiBasicFactories],
  ...SHIPPED_PERSONA_CATALOGS.map((p) => [`${CATALOG}/personas/${p.personaId}/factories.ts`, p.factories as Table] as const),
]

const personaRecords = new Set(SHIPPED_PERSONA_CATALOGS.flatMap((p) => (p.controls ?? []).map((r) => r.tag)))
const factoryControlTags = new Set(MODULES.flatMap(([, table]) => tagsOf(table)).filter(isControlTag))

/** Every custom-element tag a shipped factory names that neither `records` nor a persona's own records serve. */
const missingRecords = (records: Readonly<Record<string, ControlRecord>>): string[] =>
  [...factoryControlTags].filter((tag) => !Object.hasOwn(records, tag) && !personaRecords.has(tag)).sort()

/** The six sub-element tags the default catalog's Card, Tabs and Drill factories mint, with no record of their own. */
const SUB_ELEMENT_TAGS = ['ui-card-content', 'ui-card-footer', 'ui-card-header', 'ui-drill-panel', 'ui-tab', 'ui-tab-panel']

describe('guards: the built-in loader can define every control a shipped factory creates', () => {
  it('every custom-element tag a shipped factory names (tag or uses, every variant arm) has a record', () => {
    expect(factoryControlTags.size).toBeGreaterThan(50) // anti-vacuous
    expect(missingRecords(BUILTIN_CONTROL_RECORDS)).toEqual([])
  })

  it('the sub-element aliases come from the generated registry: each loads its family and the family defines it', async () => {
    for (const tag of SUB_ELEMENT_TAGS) {
      expect(factoryControlTags.has(tag), `${tag} should be a shipped factory tag`).toBe(true)
      expect(Object.hasOwn(CONTROLS, tag), `${tag} must have no record of its own in CONTROLS`).toBe(false)
      expect(BUILTIN_CONTROL_RECORDS[tag]?.tag).toBe(tag)
    }
    await builtinControls.ensure(SUB_ELEMENT_TAGS)
    for (const tag of SUB_ELEMENT_TAGS) expect(customElements.get(tag), tag).toBeDefined()
  })

  it('negative control: without the generated defines the six sub-element tags have no record and the guard reds', () => {
    expect(missingRecords(CONTROLS)).toEqual(SUB_ELEMENT_TAGS)
    const stripped = Object.fromEntries(Object.entries(CONTROLS).map(([tag, { defines: _defines, ...record }]) => [tag, record as ControlRecord]))
    expect(missingRecords(withSubTags(stripped))).toEqual(SUB_ELEMENT_TAGS)
    expect(missingRecords(withSubTags(CONTROLS))).toEqual([])
  })

  it('negative control: one sub-tag dropped from its family record reds only that tag', () => {
    const dropped = { ...CONTROLS, 'ui-tabs': { ...CONTROLS['ui-tabs']!, defines: ['ui-tab'] } }
    expect(missingRecords(withSubTags(dropped))).toEqual(['ui-tab-panel'])
  })

  it('every ui-* tag a factory module mints with createElement is named by one of its factories', () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(5) // default, a2ui-basic, three personas
    for (const [path, table] of MODULES) expect(unnamedMints(read(path), table), path).toEqual([])
  })

  it('negative control: a module minting ui-icon whose factory names only ui-button is flagged', () => {
    const table: Table = { Button: { tag: 'ui-button', create: () => document.createElement('div'), applyProp: () => {} } }
    const source = "const b = document.createElement('ui-button')\nconst i = document.createElement('ui-icon') // the icon\n"
    expect(unnamedMints(source, table)).toEqual(['ui-icon'])
    expect(unnamedMints(source, { Button: { ...table.Button!, uses: ['ui-icon'] } as WidgetFactory })).toEqual([])
  })

  it('negative control: isControlTag keeps custom-element names and drops div, img and selector tags', () => {
    expect(['ui-text', 'ui-card-header', 'x-ctl-probe-a'].every(isControlTag)).toBe(true)
    expect(['div', 'img', 'div[role=option]'].some(isControlTag)).toBe(false)
  })
})
