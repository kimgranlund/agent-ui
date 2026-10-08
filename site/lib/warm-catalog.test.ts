import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (agent-schema.test.ts precedent)
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// warm-catalog.test.ts: the drift gate for the warm-up convention (T-0040, ADR-0241). The default `agent-ui`
// catalog is a lazy record, so the first renderer built on a page registers it asynchronously; a page whose own code
// reads the mount right after `ingest` / `finalize` inside a synchronous function is only correct on a warm renderer.
// Such a page imports `lib/warm-catalog.ts` (a top-level await of the body) as an entry-level side effect. This gate
// pins the two halves of that convention against source text: (a) every entry on the list imports the helper and the
// helper really awaits the default body, (b) no shared lib imports it (a top-level await propagates to every
// importer, so a lib pulled in by many pages would put the lazy chunk on all their critical paths).
//
// What bites where: this static gate bites on any tree, including today's eager default. The behavioral legs
// (a2ui-form.test.ts and a2ui-stream.test.ts, whose cold-page failure is "Form not mounted." and a wrong first-paint
// readout) only bite once the default is lazy, so they ride the same convention from the rendered side.

const ROOT = process.cwd()
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, 'utf8') as string

/** Strip block + `//` line comments (sparing `://`) so a mention in a comment is not a live import. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')

/** A real top-level side-effect import of the helper, from a page (`../lib/`) or a sibling lib (`./`). */
const importsWarmCatalog = (src: string): boolean => /^import\s+['"](?:\.\.\/lib|\.)\/warm-catalog\.ts['"]/m.test(stripComments(src))

/** The page entries that read their mount synchronously after ingest/finalize (the T-0040 audit, design 3.4). */
const WARM_ENTRIES = [
  'site/pages/a2ui-gallery.ts', // buildSeedCard: data-rendered from childElementCount
  'site/pages/a2ui-catalog.ts', // the only <component-preview mode="a2ui"> host (#buildA2ui reads the root)
  'site/pages/a2a-artifact-feed.ts', // hostArtifact: applyRootStretch after finalize
  'site/pages/a2ui-form.ts', // run -> wireFormChrome queries the rendered ui-form-provider
  'site/pages/a2ui-stream.ts', // advance: the first-paint readout
  'site/pages/a2ui-live.ts', // refreshHtml reads the canvas surface
  'site/pages/devtools-harness.ts', // emitVerdict reads the canvas children
]

describe('warm-catalog: the entries that read their mount synchronously import the helper', () => {
  for (const entry of WARM_ENTRIES) {
    it(`${entry} imports lib/warm-catalog.ts`, () => {
      expect(importsWarmCatalog(read(entry)), `${entry} must import '../lib/warm-catalog.ts'`).toBe(true)
    })
  }

  it('the check BITES: a source without the import, and one that only mentions it in a comment, both fail', () => {
    expect(importsWarmCatalog(`import { mountPage } from './_page.ts'\nmountPage({})\n`)).toBe(false)
    expect(importsWarmCatalog(`// import '../lib/warm-catalog.ts'\nconst x = 1\n`)).toBe(false)
    expect(importsWarmCatalog(`import '../lib/warm-catalog.ts' // warm\n`)).toBe(true)
  })
})

describe('warm-catalog: the helper awaits the default catalog body, and no shared lib imports it', () => {
  it('the helper awaits createRenderer().preload("agent-ui") at top level', () => {
    const code = stripComments(read('site/lib/warm-catalog.ts'))
    expect(code).toMatch(/^await\s+createRenderer\(\)\s*\.preload\(\s*['"]agent-ui['"]\s*\)/m)
  })

  it('no site/lib module (test files aside) imports the helper: a top-level await must stay at the page entry', () => {
    const libs = (readdirSync(`${ROOT}/site/lib`) as string[]).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts') && name !== 'warm-catalog.ts',
    )
    expect(libs.length, 'found real site/lib modules (anti-vacuous)').toBeGreaterThan(20)
    expect(libs.filter((name) => importsWarmCatalog(read(`site/lib/${name}`)))).toEqual([])
  })
})
