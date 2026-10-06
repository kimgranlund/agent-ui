// control-graph.test.ts: unit gate for the ADR-0233 `uses` crawl, on in-memory fixtures only (no fleet
// file is read here; controls/uses-driftwire.test.ts holds the real fleet to it). Each fixture tree is a map
// of controls-relative paths to module source, read through the same reader seam the CLI and the drift gate
// pass in.

import { describe, it, expect } from 'vitest'
import { deriveUses, fleetFromDescriptors, relativeSpecifiers, type FleetEntry } from './control-graph.ts'

const Q = "'" // module text below is assembled so no line of this file reads as a real import statement
const from = (spec: string): string => `from ${Q}${spec}${Q}`
const reader = (tree: Record<string, string>) => (p: string): string | undefined => tree[p]

describe('relativeSpecifiers', () => {
  it('finds static, bare and dynamic relative specifiers in source order', () => {
    const src = [
      `import { a } ${from('./a.ts')}`,
      `export { b } ${from('../b/b.ts')}`,
      `import ${Q}./side.ts${Q}`,
      `const lazy = () => import(${Q}./lazy.ts${Q})`,
      'import { c } from "./double.ts"',
    ].join('\n')
    expect(relativeSpecifiers(src)).toEqual(['./a.ts', '../b/b.ts', './side.ts', './lazy.ts', './double.ts'])
  })

  it('ignores package specifiers', () => {
    expect(relativeSpecifiers(`import { x } ${from('@agent-ui/shared')}\nimport ${Q}@agent-ui/icons${Q}`)).toEqual([])
  })

  it('strips single-line and multi-line type-only imports and exports', () => {
    const src = [
      `import type { One } ${from('./one.ts')}`,
      'import type {',
      '  Two,',
      '  Three,',
      `} ${from('./two.ts')}`,
      `import type * as Ns ${from('./ns.ts')}`,
      `import type Def ${from('./def.ts')}`,
      `export type { Four } ${from('./four.ts')}`,
      `export type * ${from('./star.ts')}`,
      `import { real } ${from('./real.ts')}`,
    ].join('\n')
    expect(relativeSpecifiers(src)).toEqual(['./real.ts'])
  })

  it('a type alias declaration is not a type import, so the value import after it survives', () => {
    const src = ['export type Shape = {', '  a: string', '}', `import { v } ${from('./value.ts')}`].join('\n')
    expect(relativeSpecifiers(src)).toEqual(['./value.ts'])
  })

  it('negative control: a value import is kept (the stripper does not eat every import)', () => {
    expect(relativeSpecifiers(`import { type T, v } ${from('./mixed.ts')}`)).toEqual(['./mixed.ts'])
  })
})

describe('fleetFromDescriptors', () => {
  it('reads tags, skips _ folders and non-descriptor paths, sorts by tag', () => {
    const tree = {
      'beta/beta.md': '---\ntag: ui-beta\n---\n',
      'alpha/alpha.md': '---\ntag: ui-alpha\n---\n',
      '_base/base.md': '---\ntag: ui-base\n---\n',
    }
    expect(fleetFromDescriptors(['beta/beta.md', 'alpha/alpha.md', '_base/base.md', 'README.md'], reader(tree))).toEqual([
      { tag: 'ui-alpha', folder: 'alpha', name: 'alpha' },
      { tag: 'ui-beta', folder: 'beta', name: 'beta' },
    ])
  })

  it('throws on a fleet descriptor with no tag', () => {
    expect(() => fleetFromDescriptors(['x/x.md'], reader({ 'x/x.md': '---\ntier: display\n---\n' }))).toThrow(/no tag/)
  })
})

describe('deriveUses', () => {
  const fleet: FleetEntry[] = [
    { tag: 'ui-a', folder: 'a', name: 'a' },
    { tag: 'ui-b', folder: 'b', name: 'b' },
    { tag: 'ui-c', folder: 'c', name: 'c' },
    { tag: 'ui-group', folder: 'c', name: 'group' },
    { tag: 'ui-lone', folder: 'lone', name: 'lone' },
  ]
  const entry = (tag: string): FleetEntry => fleet.find((e) => e.tag === tag) as FleetEntry

  it('records a direct static edge and stops at the reached entry (its own edges are not inherited)', () => {
    const tree = {
      'a/a.ts': `import ${Q}../b/b.ts${Q}`,
      'b/b.ts': `import ${Q}../c/c.ts${Q}`,
      'c/c.ts': '',
    }
    expect(deriveUses(entry('ui-a'), fleet, reader(tree))).toEqual(['ui-b'])
  })

  it('walks through helper modules, including a _ seam folder, to the entries behind them', () => {
    const tree = {
      'a/a.ts': `import { h } ${from('./a-helper.ts')}`,
      'a/a-helper.ts': `import { s } ${from('../_seam/seam.ts')}`,
      '_seam/seam.ts': `export const s = () => import(${Q}../c/c.ts${Q})`,
      'c/c.ts': '',
    }
    expect(deriveUses(entry('ui-a'), fleet, reader(tree))).toEqual(['ui-c'])
  })

  it('records a same-folder entry (the radio-group uses radio shape)', () => {
    const tree = { 'c/group.ts': `import ${Q}./c.ts${Q}`, 'c/c.ts': '' }
    expect(deriveUses(entry('ui-group'), fleet, reader(tree))).toEqual(['ui-c'])
  })

  it('terminates on a cycle and records both directions (the text-field and color-picker shape)', () => {
    const tree = {
      'a/a.ts': `import ${Q}../b/b.ts${Q}\nimport ${Q}./loop.ts${Q}`,
      'a/loop.ts': `import ${Q}./loop2.ts${Q}`,
      'a/loop2.ts': `import ${Q}./loop.ts${Q}\nimport ${Q}./a.ts${Q}`,
      'b/b.ts': `import ${Q}../a/a.ts${Q}`,
    }
    expect(deriveUses(entry('ui-a'), fleet, reader(tree))).toEqual(['ui-b'])
    expect(deriveUses(entry('ui-b'), fleet, reader(tree))).toEqual(['ui-a'])
  })

  it('a type-only import, a stylesheet and a module outside controls/ are not edges', () => {
    const tree = {
      'a/a.ts': [
        `import type { B } ${from('../b/b.ts')}`,
        `import ${Q}./a.css${Q}`,
        `import { UIElement } ${from('../../dom/element.ts')}`,
      ].join('\n'),
      'b/b.ts': '',
    }
    expect(deriveUses(entry('ui-a'), fleet, reader(tree))).toEqual([])
  })

  it('returns sorted tags without duplicates', () => {
    const tree = {
      'a/a.ts': `import ${Q}../c/c.ts${Q}\nimport ${Q}../b/b.ts${Q}\nimport ${Q}./h.ts${Q}`,
      'a/h.ts': `import ${Q}../c/c.ts${Q}`,
      'b/b.ts': '',
      'c/c.ts': '',
    }
    expect(deriveUses(entry('ui-a'), fleet, reader(tree))).toEqual(['ui-b', 'ui-c'])
  })

  it('a control that imports no other entry uses nothing', () => {
    expect(deriveUses(entry('ui-lone'), fleet, reader({ 'lone/lone.ts': `import ${Q}./lone-model.ts${Q}`, 'lone/lone-model.ts': '' }))).toEqual([])
  })
})
