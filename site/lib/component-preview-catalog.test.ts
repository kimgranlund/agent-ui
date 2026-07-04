import { describe, it, expect } from 'vitest'
import { defaultCatalog } from '@agent-ui/a2ui'
// node:fs is untyped here (no @types/node devDep) — the same reverse-coupling fs-read pattern the site drift
// gates use (descriptor/site-coverage.test.ts), resolved by vitest/node at runtime.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// component-preview-catalog.test.ts — the drift gate for the <component-preview> element's TWO hand-authored maps
// (site/lib/component-preview.ts, its sibling here). The element's knobs + variant chips + the catalog page's
// component list are all DERIVED from the shipped default catalog, so they cannot drift; but two small maps are
// hand-keyed by catalog COMPONENT NAME and are exactly where the hand-authored half can fall behind the catalog:
//   • A2UI_INITIAL   — per-component seed props (so a bare specimen renders legibly)
//   • SAMPLE_TREES   — per-container sample children (so a container renders WITH content)
// Rename or drop a catalog component and its map key becomes an orphan that silently seeds/nests nothing. This
// gate reads those keys straight from the site source (fs + regex, the site-coverage idiom) and asserts each is a
// real catalog component name — so an orphaned key FAILS the build rather than degrading a preview in silence.
// Runs under the `site` vitest project; the catalog is imported from the package's public surface (`@agent-ui/a2ui`).

const ROOT = process.cwd()
const PREVIEW_SRC = `${ROOT}/site/lib/component-preview.ts`
const read = (p: string): string => readFileSync(p, 'utf8') as string

/** Strip block + `//` line comments (sparing `://`) so a component name mentioned in a comment is not a live key. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')

/**
 * The top-level (2-space-indent) Capitalised keys of a `const <name> ... = { … }` object literal in `src`,
 * scoped to that block (up to the column-0 `\n}`), comment-stripped first — so a commented-out entry does not
 * count. Mirrors site-coverage.test.ts's `sampleKeys` extractor.
 */
function objectKeys(src: string, constName: string): Set<string> {
  const code = stripComments(src)
  const start = code.indexOf(`const ${constName}`)
  const keys = new Set<string>()
  if (start < 0) return keys
  const block = code.slice(start, code.indexOf('\n}', start))
  for (const m of block.matchAll(/\n\s{2}([A-Z][A-Za-z0-9]*):/g)) keys.add(m[1])
  return keys
}

/** The map keys that are NOT real catalog component names — the drift a renamed/removed component introduces. */
const orphans = (keys: Iterable<string>, catalogNames: ReadonlySet<string>): string[] =>
  [...keys].filter((k) => !catalogNames.has(k))

const CATALOG_NAMES = new Set(Object.keys(defaultCatalog.components))
const SRC = read(PREVIEW_SRC)
const INITIAL_KEYS = objectKeys(SRC, 'A2UI_INITIAL')
const SAMPLE_KEYS = objectKeys(SRC, 'SAMPLE_TREES')

describe('component-preview seed/sample maps — anti-vacuous (the extractor found real keys)', () => {
  it('the catalog is enumerable and the maps parsed non-empty', () => {
    expect(CATALOG_NAMES.size).toBeGreaterThanOrEqual(10)
    expect(INITIAL_KEYS.has('Button')).toBe(true) // a known seed
    expect(SAMPLE_KEYS.has('Card')).toBe(true) // a known container sample
    expect(INITIAL_KEYS.size).toBeGreaterThanOrEqual(5)
    expect(SAMPLE_KEYS.size).toBeGreaterThanOrEqual(5)
  })
})

describe('component-preview seed/sample maps — every key is a real catalog component (no orphan)', () => {
  it('A2UI_INITIAL keys ⊆ catalog components', () => {
    expect(orphans(INITIAL_KEYS, CATALOG_NAMES)).toEqual([])
  })
  it('SAMPLE_TREES keys ⊆ catalog components', () => {
    expect(orphans(SAMPLE_KEYS, CATALOG_NAMES)).toEqual([])
  })
})

describe('component-preview seed/sample maps — the orphan check BITES (synthetic negative controls)', () => {
  it('flags a key that is not a catalog component (the check is not vacuously true)', () => {
    expect(orphans(['Button', 'ZzRenamed'], CATALOG_NAMES)).toEqual(['ZzRenamed'])
  })
  it('a key present in the catalog is NOT flagged', () => {
    expect(orphans(['Card'], CATALOG_NAMES)).toEqual([])
  })
})
