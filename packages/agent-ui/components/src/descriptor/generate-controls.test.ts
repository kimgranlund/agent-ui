// generate-controls.test.ts: unit tests for the ADR-0233 control generator on fixtures (no fleet files read).
// The fleet-level drift gate is `controls/controls-gen-driftwire.test.ts`.

import { describe, it, expect } from 'vitest'
import {
  GENERATED_FILES,
  controlsGenEntries,
  generateControls,
  isGeneratorOwnedKey,
  mergeExports,
  staleControlsArtifacts,
  withGeneratedExports,
  type ControlsGenEntry,
} from './generate-controls.ts'
import type { ControlsReader, FleetEntry } from './control-graph.ts'

// Given out of order on purpose: the output must not depend on input order. `radio-group` shares the `radio/`
// folder (the ADR-0080 one-folder, two-entries case); `text-field` sorts before `text` by path ('-' < '/').
const ENTRIES: ControlsGenEntry[] = [
  { tag: 'ui-text', folder: 'text', name: 'text', uses: [] },
  { tag: 'ui-radio-group', folder: 'radio', name: 'radio-group', uses: ['ui-radio'] },
  { tag: 'ui-table', folder: 'table', name: 'table', uses: ['ui-radio', 'ui-button'] },
  { tag: 'ui-button', folder: 'button', name: 'button', uses: [] },
  { tag: 'ui-text-field', folder: 'text-field', name: 'text-field', uses: [] },
  { tag: 'ui-radio', folder: 'radio', name: 'radio', uses: [] },
]

const importsOf = (text: string, re: RegExp): string[] => [...text.matchAll(re)].map((m) => m[1])

describe('generateControls: the registry', () => {
  const { registry } = generateControls(ENTRIES)

  it('opens with a GENERATED header naming the CLI and ADR-0233', () => {
    const header = registry.split('\n')[0]
    expect(header).toContain('GENERATED')
    expect(header).toContain('scripts/generate-controls.mjs')
    expect(header).toContain('ADR-0233')
  })

  it('imports and re-exports the ControlRecord type and declares CONTROLS', () => {
    expect(registry).toContain("\nimport type { ControlRecord } from './control-record.ts'\n")
    expect(registry).toContain('\nexport type { ControlRecord }\n')
    expect(registry).toContain('\nexport const CONTROLS: Readonly<Record<string, ControlRecord>> = {\n')
  })

  it('a family entry that declares defines carries them sorted on its record; an entry with none writes no field', () => {
    const family: ControlsGenEntry = { tag: 'ui-card', folder: 'card', name: 'card', uses: [], defines: ['ui-card-header', 'ui-card-content'] }
    const text = generateControls([...ENTRIES, family]).registry
    expect(text).toContain(
      "  'ui-card': { tag: 'ui-card', load: () => import('./card/card.ts'), css: './card/card.css', uses: [], defines: ['ui-card-content', 'ui-card-header'] },",
    )
    const withDefines = (registry: string): string[] => registry.split('\n').filter((l) => l.startsWith("  'ui-") && l.includes(', defines: ['))
    expect(withDefines(text)).toHaveLength(1)
    expect(withDefines(generateControls(ENTRIES).registry)).toEqual([])
  })

  it('writes one record per entry, sorted by tag, with load, css and sorted uses', () => {
    const tags = importsOf(registry, /^ {2}'(ui-[a-z-]+)': \{/gm)
    expect(tags).toEqual(['ui-button', 'ui-radio', 'ui-radio-group', 'ui-table', 'ui-text', 'ui-text-field'])
    expect(registry).toContain(
      "  'ui-radio-group': { tag: 'ui-radio-group', load: () => import('./radio/radio-group.ts'), css: './radio/radio-group.css', uses: ['ui-radio'] },",
    )
    expect(registry).toContain("  'ui-table': { tag: 'ui-table', load: () => import('./table/table.ts'), css: './table/table.css', uses: ['ui-button', 'ui-radio'] },")
    expect(registry).toContain("uses: [] },")
  })
})

describe('generateControls: the demo-only all pair', () => {
  const { allTs, allCss } = generateControls(ENTRIES)

  it('all.gen.ts: header marks it demo-only, one bare import per entry sorted by path, exports nothing', () => {
    expect(allTs.split('\n')[0]).toContain('GENERATED')
    expect(allTs).toContain('DEMO-ONLY')
    expect(importsOf(allTs, /^import '([^']+)'$/gm)).toEqual([
      './controls/button/button.ts',
      './controls/radio/radio-group.ts',
      './controls/radio/radio.ts',
      './controls/table/table.ts',
      './controls/text-field/text-field.ts',
      './controls/text/text.ts',
    ])
    expect(allTs).not.toMatch(/^export /m)
  })

  it('all.gen.css: header, the seam sheet first, then one import per sheet sorted by path', () => {
    expect(allCss.startsWith('/* all.gen.css: GENERATED')).toBe(true)
    expect(allCss).toContain('DEMO-ONLY')
    expect(importsOf(allCss, /^@import '([^']+)';$/gm)).toEqual([
      './shared-styles.css',
      './controls/button/button.css',
      './controls/radio/radio-group.css',
      './controls/radio/radio.css',
      './controls/table/table.css',
      './controls/text-field/text-field.css',
      './controls/text/text.css',
    ])
  })
})

describe('generateControls: the generator-owned exports keys', () => {
  const { exports } = generateControls(ENTRIES)

  it('maps ./controls/{name} and ./controls/{name}.css per entry, plus ./registry, ./all and ./all.css', () => {
    expect(exports['./controls/radio-group']).toBe('./src/controls/radio/radio-group.ts')
    expect(exports['./controls/radio-group.css']).toBe('./src/controls/radio/radio-group.css')
    expect(exports['./registry']).toBe(`./${GENERATED_FILES.registry}`)
    expect(exports['./all']).toBe('./src/all.gen.ts')
    expect(exports['./all.css']).toBe('./src/all.gen.css')
    expect(Object.keys(exports)).toHaveLength(ENTRIES.length * 2 + 3)
  })

  it('keys come out in plain sorted order', () => {
    const keys = Object.keys(exports)
    expect(keys).toEqual([...keys].sort())
  })
})

describe('generateControls: determinism and failure', () => {
  it('the same entries in another order give byte-identical output', () => {
    expect(generateControls([...ENTRIES].reverse())).toEqual(generateControls(ENTRIES))
  })

  it('throws on a duplicate tag or a duplicate control name', () => {
    expect(() => generateControls([...ENTRIES, { tag: 'ui-button', folder: 'x', name: 'x', uses: [] }])).toThrow(/duplicate tag ui-button/)
    expect(() => generateControls([...ENTRIES, { tag: 'ui-other', folder: 'other', name: 'button', uses: [] }])).toThrow(/duplicate control name button/)
  })

  it('throws on a defines tag that is a fleet control or is declared by two entries', () => {
    const card: ControlsGenEntry = { tag: 'ui-card', folder: 'card', name: 'card', uses: [], defines: ['ui-card-header'] }
    expect(() => generateControls([...ENTRIES, { ...card, defines: ['ui-button'] }])).toThrow(/ui-card defines ui-button, which is a fleet control/)
    const twin: ControlsGenEntry = { tag: 'ui-deck', folder: 'deck', name: 'deck', uses: [], defines: ['ui-card-header'] }
    expect(() => generateControls([...ENTRIES, card, twin])).toThrow(/ui-card-header is defined by both ui-card and ui-deck/)
  })
})

describe('mergeExports and withGeneratedExports', () => {
  const generated = generateControls(ENTRIES).exports

  it('owns every ./controls/* key and the three fixed keys, nothing else', () => {
    expect(isGeneratorOwnedKey('./controls/x')).toBe(true)
    expect(isGeneratorOwnedKey('./controls/x.css')).toBe(true)
    for (const k of ['./registry', './all', './all.css']) expect(isGeneratorOwnedKey(k)).toBe(true)
    for (const k of ['.', './loader', './shared-styles.css', './traits/overlay', './allx']) expect(isGeneratorOwnedKey(k)).toBe(false)
  })

  it('drops a stale ./controls/* key, keeps hand-owned keys and their values, sorts the keys', () => {
    const current = { './traits/overlay': './src/traits/overlay.ts', '.': './src/index.ts', './controls/gone': './src/controls/gone/gone.ts' }
    const merged = mergeExports(current, generated)
    expect(merged['./controls/gone']).toBeUndefined()
    expect(merged['.']).toBe('./src/index.ts')
    expect(merged['./traits/overlay']).toBe('./src/traits/overlay.ts')
    expect(merged['./controls/button']).toBe('./src/controls/button/button.ts')
    expect(Object.keys(merged)).toEqual(Object.keys(merged).sort())
  })

  it('rewrites only exports, keeps every other field in place, two-space JSON plus a trailing newline', () => {
    const before = `${JSON.stringify({ name: 'p', sideEffects: ['./src/controls/**'], exports: { '.': './src/index.ts' }, private: true }, null, 2)}\n`
    const after = withGeneratedExports(before, generated)
    expect(after.endsWith('}\n')).toBe(true)
    const parsed = JSON.parse(after) as Record<string, unknown>
    expect(Object.keys(parsed)).toEqual(['name', 'sideEffects', 'exports', 'private'])
    expect(parsed['sideEffects']).toEqual(['./src/controls/**'])
    expect(after).toBe(`${JSON.stringify(parsed, null, 2)}\n`)
    expect(withGeneratedExports(after, generated)).toBe(after) // idempotent
  })
})

describe('controlsGenEntries: uses and defines read with the descriptor parser', () => {
  const fleet: FleetEntry[] = [
    { tag: 'ui-a', folder: 'a', name: 'a' },
    { tag: 'ui-b', folder: 'b', name: 'b' },
  ]
  const files: Record<string, string> = {
    'a/a.md': '---\ntag: ui-a\nextends: UIElement\nuses:\n  - ui-b\ndefines:\n  - ui-a-part\n---\n',
    'b/b.md': '---\ntag: ui-b\nextends: UIElement\nuses: []\n---\n',
  }
  const read: ControlsReader = (p) => files[p]

  it('returns each entry with its declared uses and defines (none when the block is absent)', () => {
    expect(controlsGenEntries(fleet, read)).toEqual([
      { tag: 'ui-a', folder: 'a', name: 'a', uses: ['ui-b'], defines: ['ui-a-part'] },
      { tag: 'ui-b', folder: 'b', name: 'b', uses: [], defines: [] },
    ])
  })

  it('throws naming a descriptor without a uses block', () => {
    const noUses: ControlsReader = (p) => (p === 'b/b.md' ? '---\ntag: ui-b\nextends: UIElement\n---\n' : read(p))
    expect(() => controlsGenEntries(fleet, noUses)).toThrow(/b\/b\.md declares no uses block/)
  })
})

describe('staleControlsArtifacts', () => {
  const generated = generateControls(ENTRIES)
  const pkg = withGeneratedExports(`${JSON.stringify({ name: 'p', exports: { '.': './src/index.ts' } }, null, 2)}\n`, generated.exports)
  const inSync: Record<string, string> = {
    [GENERATED_FILES.registry]: generated.registry,
    [GENERATED_FILES.allTs]: generated.allTs,
    [GENERATED_FILES.allCss]: generated.allCss,
    'package.json': pkg,
  }

  it('is empty when every artifact matches', () => {
    expect(staleControlsArtifacts((p) => inSync[p], generated)).toEqual([])
  })

  it('names a hand-edited file, a missing file and a package.json missing a generated key', () => {
    const files = { ...inSync }
    files[GENERATED_FILES.allCss] = `${generated.allCss}/* edit */\n`
    delete files[GENERATED_FILES.allTs]
    const pkgJson = JSON.parse(pkg) as { exports: Record<string, string> }
    delete pkgJson.exports['./controls/button.css']
    files['package.json'] = `${JSON.stringify(pkgJson, null, 2)}\n`
    expect(staleControlsArtifacts((p) => files[p], generated)).toEqual([GENERATED_FILES.allTs, GENERATED_FILES.allCss, 'package.json'])
  })
})
