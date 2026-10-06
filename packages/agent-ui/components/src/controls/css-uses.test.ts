// css-uses.test.ts: the ADR-0233 gate for the CSS half of `uses`. Each fleet sheet `{folder}/{name}.css` opens
// with an import of every used control's sheet (written by `scripts/codemod-uses.mjs` through the SAME
// `control-graph.ts` functions this file imports), so a sheet is self-contained the way its entry module is.
// Four rules, each with a negative control below:
//   1. a sheet's real imports equal the sheets of its descriptor's `uses`, in sync with the codemod;
//   2. every import sits before the sheet's first rule;
//   3. an import never names a `_`-prefixed folder (a seam loads once, through `shared-styles.css`) or a path
//      that is not a fleet sheet;
//   4. no foreign `:where()`: every `:where(ui-T)` in `{folder}/*.css` has `T` equal to `{folder}` or starting
//      with `{folder}-`, so a sheet duplicated by several prologues never restyles another control and the
//      control-sheet order stays free (proved on both engines by `css-order.browser.test.ts`).
// Fix a rule-1 red with `node scripts/codemod-uses.mjs`, never by hand-editing a prologue.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { parseDescriptor, scalarSeq, splitFrontmatter } from '../descriptor/component-descriptor.ts'
import {
  cssImports,
  descriptorPath,
  fleetFromDescriptors,
  sheetPath,
  stripCssComments,
  usesPrologue,
  withCssPrologue,
  type ControlsReader,
  type FleetEntry,
} from '../descriptor/control-graph.ts'
declare const process: { cwd(): string }

const CONTROLS = `${process.cwd()}/packages/agent-ui/components/src/controls`
const read: ControlsReader = (p) => (existsSync(`${CONTROLS}/${p}`) ? (readFileSync(`${CONTROLS}/${p}`, 'utf8') as string) : undefined)

// Fleet discovery: the family-coherence shape (every `{folder}/{name}.md` outside `_` folders).
const FOLDERS: string[] = (readdirSync(CONTROLS) as string[]).filter((d) => !d.startsWith('_') && statSync(`${CONTROLS}/${d}`).isDirectory())
const mdPaths = FOLDERS.flatMap((d) => (readdirSync(`${CONTROLS}/${d}`) as string[]).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`))
const FLEET = fleetFromDescriptors(mdPaths, read)
const BY_TAG = new Map(FLEET.map((e) => [e.tag, e] as const))
const FLEET_SHEETS = new Set(FLEET.map(sheetPath))
/** Every stylesheet in a fleet folder (the rule-4 scope), controls-relative. */
const FOLDER_SHEETS = FOLDERS.flatMap((d) => (readdirSync(`${CONTROLS}/${d}`) as string[]).filter((f) => f.endsWith('.css')).map((f) => `${d}/${f}`))

const declaredUses = (entry: FleetEntry): string[] => scalarSeq(parseDescriptor(splitFrontmatter(read(descriptorPath(entry)) as string).fence), 'uses')

/** `spec` resolved against `entry`'s sheet, controls-relative; a path that leaves `src/controls/` starts `../`. */
function resolveSheet(entry: FleetEntry, spec: string): string {
  const resolved = new URL(spec, `file:///root/controls/${sheetPath(entry)}`).pathname
  return resolved.startsWith('/root/controls/') ? resolved.slice('/root/controls/'.length) : `..${resolved}`
}

/** Rule 1: the sheet's imports, resolved, against the sheets of `uses`. */
function importDrift(entry: FleetEntry, css: string, uses: readonly string[]): { phantom: string[]; missing: string[] } {
  const imported = cssImports(css).map((s) => resolveSheet(entry, s))
  const expected = uses.map((t) => {
    const used = BY_TAG.get(t)
    return used === undefined ? `<not a fleet tag: ${t}>` : sheetPath(used)
  })
  return { phantom: imported.filter((p) => !expected.includes(p)), missing: expected.filter((p) => !imported.includes(p)) }
}

/** Rule 2: the number of imports that do NOT sit in the leading run of import statements. */
function importsAfterFirstRule(css: string): number {
  const code = stripCssComments(css)
  const lead = /^\s*(?:@import\s[^;]*;\s*)*/.exec(code)?.[0] ?? ''
  return cssImports(css).length - cssImports(lead).length
}

/** Rule 3: every import naming a `_` folder or a path that is not a fleet sheet. */
function badImportTargets(entry: FleetEntry, css: string): string[] {
  return cssImports(css).filter((s) => {
    const target = resolveSheet(entry, s)
    return target.startsWith('_') || target.includes('/_') || !FLEET_SHEETS.has(target)
  })
}

/** Rule 4: the `ui-*` type selectors inside any `:where(…)` of a `{folder}/*.css` sheet that name another
 *  control (attribute brackets and quoted strings are stripped first, so `[data-x='ui-y']` never counts). */
function foreignWheres(folder: string, css: string): string[] {
  const code = stripCssComments(css)
  const out: string[] = []
  for (let i = code.indexOf(':where('); i !== -1; i = code.indexOf(':where(', i + 1)) {
    let depth = 0
    let j = i + ':where'.length
    for (; j < code.length; j++) {
      if (code[j] === '(') depth++
      else if (code[j] === ')' && --depth === 0) break
    }
    const body = code.slice(i + ':where('.length, j).replace(/\[[^\]]*\]/g, '').replace(/'[^']*'|"[^"]*"/g, '')
    for (const m of body.matchAll(/(?<![\w-])ui-[a-z][a-z0-9-]*/g)) {
      const t = m[0].slice('ui-'.length)
      if (t !== folder && !t.startsWith(`${folder}-`)) out.push(m[0])
    }
  }
  return out
}

describe('css-uses: anti-vacuous fleet coverage', () => {
  it('discovers the fleet, every fleet control has a sheet, and the prologues carry edges', () => {
    expect(FLEET.length).toBeGreaterThan(50)
    for (const e of FLEET) expect(read(sheetPath(e)), sheetPath(e)).not.toBeUndefined()
    const withUses = FLEET.filter((e) => declaredUses(e).length > 0)
    expect(withUses.length).toBeGreaterThan(0)
    const imports = FLEET.reduce((n, e) => n + cssImports(read(sheetPath(e)) as string).length, 0)
    expect(imports).toBe(withUses.reduce((n, e) => n + declaredUses(e).length, 0))
    expect(FOLDER_SHEETS.length).toBeGreaterThanOrEqual(FLEET.length)
  })
})

describe.each(FLEET.map((e) => [sheetPath(e), e] as const))('%s', (_sheet, entry: FleetEntry) => {
  const css = read(sheetPath(entry)) as string
  const uses = declaredUses(entry)

  it('rule 1: its imports equal the sheets of its uses, in sync with the codemod', () => {
    expect(importDrift(entry, css, uses)).toEqual({ phantom: [], missing: [] })
    expect(cssImports(css).length, 'one import per used control, no duplicates').toBe(uses.length)
    expect(withCssPrologue(css, usesPrologue(entry, uses, FLEET)), 'run node scripts/codemod-uses.mjs').toBe(css)
  })

  it('rule 2: every import sits before the first rule', () => {
    expect(importsAfterFirstRule(css)).toBe(0)
  })

  it('rule 3: no import names a `_` seam or a non-fleet path', () => {
    expect(badImportTargets(entry, css)).toEqual([])
  })
})

describe.each(FOLDER_SHEETS.map((p) => [p] as const))('%s', (path: string) => {
  it('rule 4: no foreign :where(ui-T)', () => {
    expect(foreignWheres(path.split('/')[0], read(path) as string)).toEqual([])
  })
})

describe('css-uses: negative controls (each rule bites)', () => {
  const table = BY_TAG.get('ui-table') as FleetEntry
  const tableCss = read(sheetPath(table)) as string
  const tableUses = declaredUses(table)

  it('anti-vacuous: the table sheet carries the pagination import the controls below remove', () => {
    expect(tableCss).toContain("@import '../pagination/pagination.css';")
    expect(importDrift(table, tableCss, tableUses)).toEqual({ phantom: [], missing: [] })
  })

  it('rule 1: a removed import is missing, a planted one is phantom, and the codemod sees both out of sync', () => {
    const removed = tableCss.replace("@import '../pagination/pagination.css';\n", '')
    expect(importDrift(table, removed, tableUses).missing).toEqual(['pagination/pagination.css'])
    expect(withCssPrologue(removed, usesPrologue(table, tableUses, FLEET))).not.toBe(removed)
    const planted = tableCss.replace("@import '../radio/radio.css';\n", "@import '../radio/radio.css';\n@import '../tooltip/tooltip.css';\n")
    expect(importDrift(table, planted, tableUses).phantom).toEqual(['tooltip/tooltip.css'])
    expect(withCssPrologue(planted, usesPrologue(table, tableUses, FLEET))).not.toBe(planted)
  })

  it('rule 1: an unmarked duplicate import run is caught by the count, and the codemod removes it', () => {
    const imports = "@import '../button/button.css';\n@import '../checkbox/checkbox.css';\n"
    const doubled = tableCss.replace(':where(ui-table) {', `${imports}\n:where(ui-table) {`)
    expect(importDrift(table, doubled, tableUses)).toEqual({ phantom: [], missing: [] })
    expect(cssImports(doubled).length).toBe(tableUses.length + 2)
    expect(withCssPrologue(doubled, usesPrologue(table, tableUses, FLEET))).toBe(tableCss)
  })

  it('rule 2: an import after the first rule is caught', () => {
    expect(importsAfterFirstRule(`${tableCss}\n@import '../button/button.css';\n`)).toBe(1)
  })

  it('rule 3: a `_` seam import and a non-fleet path are caught', () => {
    expect(badImportTargets(table, `@import '../_surface/container.css';\n${tableCss}`)).toEqual(['../_surface/container.css'])
    expect(badImportTargets(table, `@import '../../base-styles.css';\n${tableCss}`)).toEqual(['../../base-styles.css'])
  })

  it('rule 4: a foreign :where(ui-button) in the table sheet is caught; its own family and attribute values are not', () => {
    expect(foreignWheres('table', `${tableCss}\n:where(ui-button) { --x: 1; }\n`)).toEqual(['ui-button'])
    expect(foreignWheres('card', ":where(ui-card-header, ui-card-footer[data-x='ui-row']) { --x: 1; }")).toEqual([])
  })
})
