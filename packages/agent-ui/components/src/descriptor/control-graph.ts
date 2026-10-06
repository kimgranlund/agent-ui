// control-graph.ts: the control-to-control import graph behind each descriptor's `uses:` field (ADR-0233).
//
// A fleet control's `uses` lists the OTHER fleet controls its entry module reaches through relative imports.
// One pure implementation serves every caller: the `scripts/codemod-uses.mjs` CLI that writes the field, the
// `controls/uses-driftwire.test.ts` gate that holds it equal to the real graph, and later generators. No
// `node:*` import here: a caller passes a reader, so the CLI and the gates share one crawl (the ADR-0173
// precedent of `scripts/generate-props.mjs` importing `generate-props.ts`).

import { parseDescriptor, splitFrontmatter } from './component-descriptor.ts'

/** One fleet control: the `controls/{folder}/{name}.md` descriptor whose folder is not `_`-prefixed (the
 *  family-coherence discovery shape). Entry module `{folder}/{name}.ts`, sheet `{folder}/{name}.css`. */
export interface FleetEntry {
  readonly tag: string
  readonly folder: string
  readonly name: string
}

/** Reads a file by its path relative to `src/controls/`; `undefined` when it does not exist. */
export type ControlsReader = (controlsRelPath: string) => string | undefined

/** The entry module path of a fleet control, relative to `src/controls/`. */
export const entryModule = (entry: FleetEntry): string => `${entry.folder}/${entry.name}.ts`

/** The descriptor path of a fleet control, relative to `src/controls/`. */
export const descriptorPath = (entry: FleetEntry): string => `${entry.folder}/${entry.name}.md`

/**
 * Build the fleet from a listing of controls-relative descriptor paths (`{folder}/{name}.md`). Paths in a
 * `_`-prefixed folder, or not exactly one folder deep, are skipped; the tag comes from the descriptor's
 * `tag:` scalar. Throws when a fleet descriptor cannot be read or carries no tag, since a crawl over a
 * partial fleet would silently drop edges. Sorted by tag.
 */
export function fleetFromDescriptors(mdPaths: readonly string[], read: ControlsReader): FleetEntry[] {
  const fleet: FleetEntry[] = []
  for (const p of mdPaths) {
    const m = /^([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\.md$/.exec(p)
    if (!m) continue
    const source = read(p)
    if (source === undefined) throw new Error(`control-graph: cannot read descriptor ${p}`)
    const tag = parseDescriptor(splitFrontmatter(source).fence).scalars.get('tag')
    if (tag === undefined || tag === '') throw new Error(`control-graph: descriptor ${p} has no tag`)
    fleet.push({ tag, folder: m[1], name: m[2] })
  }
  return fleet.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
}

// A type-only statement that names a module: `import type X`, `import type { … }` (any number of lines),
// `import type * as N`, `export type { … }` and `export type *`, each followed by its module clause. A type
// ALIAS declaration (`export type X = …`) never matches, because the clause after `type` must be a name,
// brace group or star immediately followed by the from-clause.
const TYPE_ONLY_STATEMENT =
  /^[ \t]*(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|[A-Za-z_$][\w$]*)\s*from\s*(?:'[^'\n]*'|"[^"\n]*")/gm

// A relative module specifier after a from-clause, a bare side-effect import, or a dynamic import call.
const RELATIVE_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*(?:'(\.[^'\n]*)'|"(\.[^"\n]*)")/g

/**
 * Every relative specifier a module source names through a from-clause, a bare side-effect import or a
 * dynamic import call, in source order, with type-only import and export statements stripped first (a type
 * import moves no bytes and defines nothing, so it is not a `uses` edge). The `scripts/measure-size.mjs`
 * shape, widened so a type import spanning several lines is stripped too.
 */
export function relativeSpecifiers(source: string): string[] {
  const code = source.replace(TYPE_ONLY_STATEMENT, '')
  const out: string[] = []
  for (const m of code.matchAll(RELATIVE_SPECIFIER)) out.push(m[1] ?? m[2])
  return out
}

/** Resolve `spec` against the directory of the controls-relative module `from`. Returns `undefined` when the
 *  result leaves `src/controls/` (a dom, traits or reactive module is never a control). */
function resolveInControls(from: string, spec: string): string | undefined {
  const parts = from.split('/').slice(0, -1)
  for (const seg of spec.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
    } else parts.push(seg)
  }
  return parts.join('/')
}

/**
 * The tags of the other fleet controls `entry` uses: walk relative specifiers from its entry module, through
 * every non-entry module under `src/controls/` (helpers, `_`-folder seams, same-folder siblings that are not
 * entries), stopping at and recording each OTHER fleet entry module reached. Only `.ts` modules are walked;
 * a stylesheet or asset specifier is not a module edge. Sorted, without duplicates, never the entry's own tag.
 */
export function deriveUses(entry: FleetEntry, fleet: readonly FleetEntry[], read: ControlsReader): string[] {
  const tagByModule = new Map(fleet.map((e) => [entryModule(e), e.tag] as const))
  const start = entryModule(entry)
  const uses = new Set<string>()
  const visited = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift() as string
    const source = read(current)
    if (source === undefined) continue
    for (const spec of relativeSpecifiers(source)) {
      const target = resolveInControls(current, spec)
      if (target === undefined || !target.endsWith('.ts') || visited.has(target)) continue
      visited.add(target)
      const tag = tagByModule.get(target)
      if (tag !== undefined) uses.add(tag)
      else queue.push(target)
    }
  }
  uses.delete(entry.tag)
  return [...uses].sort()
}

// ── The CSS half: each fleet sheet's `@import` prologue mirrors its `uses` ──────────────────────────────────
//
// A control sheet is self-contained the way its entry module is: `{folder}/{name}.css` opens with one import
// per used control's sheet, so linking `table/table.css` brings the button, checkbox, pagination and radio
// sheets along. The cross-family seams (`_surface/`, `_chart/`) are never imported from a control sheet: they
// load once, through `shared-styles.css`, because a browser applies every duplicate import separately and a
// second seam copy would land after `card.css` and reset its `--ui-container-bg` seed (ADR-0233).

/** The sheet path of a fleet control, relative to `src/controls/`. */
export const sheetPath = (entry: FleetEntry): string => `${entry.folder}/${entry.name}.css`

/** The marker comment that opens a sheet's prologue, naming the descriptor it is synced from. */
export const usesPrologueMarker = (entry: FleetEntry): string =>
  `/* uses: synced from ${entry.name}.md by scripts/codemod-uses.mjs */`

/** `css` with every block comment removed. */
export const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The specifier `from`'s sheet imports `to`'s sheet with: `./{name}.css` in the same folder, else
 *  `../{folder}/{name}.css`. Relative only, so the sheet stays CDN-safe. */
export const sheetSpecifier = (from: FleetEntry, to: FleetEntry): string =>
  from.folder === to.folder ? `./${to.name}.css` : `../${to.folder}/${to.name}.css`

/**
 * The prologue lines for `entry`'s sheet given its `uses` tags: the marker comment, then one import per used
 * tag sorted by tag. An empty `uses` has no prologue (`[]`). Throws on a tag outside the fleet.
 */
export function usesPrologue(entry: FleetEntry, uses: readonly string[], fleet: readonly FleetEntry[]): string[] {
  if (uses.length === 0) return []
  const byTag = new Map(fleet.map((e) => [e.tag, e] as const))
  const imports = [...uses].sort().map((tag) => {
    const to = byTag.get(tag)
    if (to === undefined) throw new Error(`control-graph: ${entry.tag} uses ${tag}, which is not a fleet control`)
    // Quoted apart from the at-rule, so an import-statement scanner (`layering.test.ts`) never reads it as one.
    const quoted = `'${sheetSpecifier(entry, to)}'`
    return `@import ${quoted};`
  })
  return [usesPrologueMarker(entry), ...imports]
}

/** Every real import specifier a stylesheet names (comments stripped first), in source order. Handles the
 *  quoted forms and `url(…)`. */
export function cssImports(css: string): string[] {
  const out: string[] = []
  const re = /@import\s+(?:url\(\s*)?(?:'([^']*)'|"([^"]*)"|([^\s'")]+))/g
  for (const m of stripCssComments(css).matchAll(re)) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

// An existing prologue: the marker comment, the import lines directly under it, and the one blank line the
// writer leaves after them.
const PROLOGUE_BLOCK = /\/\* uses: synced from [^*\n]* by scripts\/codemod-uses\.mjs \*\/\n(?:@import [^\n]*;\n)*\n?/

/** The index of the first character of `css` that is neither whitespace nor inside a block comment. */
function firstTokenIndex(css: string): number {
  let i = 0
  for (;;) {
    while (i < css.length && /\s/.test(css[i])) i++
    if (!css.startsWith('/*', i)) return i
    const end = css.indexOf('*/', i + 2)
    if (end === -1) return css.length
    i = end + 2
  }
}

/**
 * `css` with its prologue set to `prologue` (from `usesPrologue`): any existing prologue block is removed, as
 * is a run of import lines left at the first non-comment token without their marker (a control sheet owns no
 * import outside its prologue), and a non-empty prologue is inserted before the sheet's first non-comment
 * token, followed by one blank line. The header comment stays first. Idempotent: applying the same prologue
 * twice changes nothing.
 */
export function withCssPrologue(css: string, prologue: readonly string[]): string {
  const unmarked = css.replace(PROLOGUE_BLOCK, '')
  const lead = firstTokenIndex(unmarked)
  const stripped = unmarked.slice(0, lead) + unmarked.slice(lead).replace(/^(?:@import [^\n]*;\n)+\n?/, '')
  if (prologue.length === 0) return stripped
  const at = firstTokenIndex(stripped)
  return `${stripped.slice(0, at)}${prologue.join('\n')}\n\n${stripped.slice(at)}`
}
