// llms.test.ts — the two standing gates behind site/public/llms.txt + llms-full.txt (the agent-facing
// docs index and its fetch-readable corpus). Both files are DERIVED views and this is what keeps them
// honest (the llms-txt-forge review's issue 3: a hand-maintained index over a moving corpus drifts —
// it had already drifted once, omitting a2ui-gallery.html, before this gate existed):
//
//   G1 — llms-full.txt is byte-identical to a fresh generation from its sources. The test imports the
//        SAME `generateLlmsFull` implementation the CLI writes with (scripts/generate-llms-full.mjs),
//        so there is no generator/gate drift pair; a descriptor edit without a regeneration fails here.
//        Regenerate: `node scripts/generate-llms-full.mjs`.
//   G2 — every site MPA page (site/*.html) is linked from llms.txt, minus the explicit chrome allowlist.
//        A new page landing without an index entry fails here (the exact defect the review caught).
import { describe, it, expect } from 'vitest'
import { generateLlmsFull } from '../../scripts/generate-llms-full.mjs'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (tokens-doc.test.ts precedent)
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (p: string): string => readFileSync(`${ROOT}/${p}`, 'utf8') as string

// ── G1 · llms-full.txt drift gate ──────────────────────────────────────────────────────────────────────

describe('llms-full.txt — byte-identical to a fresh generation (the committed corpus cannot drift)', () => {
  const committed = read('site/public/llms-full.txt')
  const fresh = generateLlmsFull(ROOT)

  it('anti-vacuous: the generation is a real corpus, not an empty pass', () => {
    expect(fresh.length).toBeGreaterThan(50_000) // 41 descriptors + the changelog — far above any degenerate output
    expect(fresh).toContain('# ui-button') // a known fleet member's prose heading
    expect(fresh).toContain('<!-- source: CHANGELOG.md -->')
    const sources = fresh.match(/^<!-- source: /gm) ?? []
    expect(sources.length, 'expected every component descriptor + the changelog as source blocks').toBeGreaterThanOrEqual(40)
  })

  it('the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-llms-full.mjs)', () => {
    expect(committed).toBe(fresh)
  })

  it('negative control: a corpus edit is genuinely caught (the equality check bites)', () => {
    expect(committed + 'x').not.toBe(fresh)
  })
})

// ── G2 · llms.txt coverage gate ────────────────────────────────────────────────────────────────────────

/** Pages deliberately NOT indexed: chrome, not content. Adding here is a curation decision with a reason. */
const UNINDEXED = new Set([
  'index.html', // the landing page — site chrome; llms.txt IS its agent-facing equivalent
  'agent-admin-app.html', // the STANDALONE ui-agent-admin surface — app chrome, zero prose; the indexed
  // content page for this composition is agent-admin.html (the guide), which llms.txt already links
])

/** The pages `llmsTxt` fails to link, out of `pages` minus the allowlist — pure, so the negative control
 *  can drive it with synthetic inputs (the site-coverage `missingPages` precedent). */
function unindexedPages(pages: readonly string[], llmsTxt: string, allowlist: ReadonlySet<string>): string[] {
  return pages.filter((p) => !allowlist.has(p) && !llmsTxt.includes(`(./${p})`))
}

describe('llms.txt — every site page is indexed (minus the explicit chrome allowlist)', () => {
  const llms = read('site/public/llms.txt')
  const pages = (readdirSync(`${ROOT}/site`) as string[]).filter((f) => f.endsWith('.html')).sort()

  it('anti-vacuous: the page inventory and the index are both real', () => {
    expect(pages.length).toBeGreaterThan(50)
    expect(llms.startsWith('# agent-ui')).toBe(true)
    expect(llms).toContain('> ') // the blockquote summary
  })

  it('0 unindexed pages — a new page must land with an llms.txt entry (or a reasoned allowlist row)', () => {
    expect(unindexedPages(pages, llms, UNINDEXED)).toEqual([])
  })

  it('every ./…html link in llms.txt resolves to a real page (no dead links)', () => {
    const links = [...llms.matchAll(/\(\.\/([a-z0-9-]+\.html)\)/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(50) // anti-vacuous — the regex genuinely extracts the index
    const pageSet = new Set(pages)
    expect(links.filter((l) => !pageSet.has(l))).toEqual([])
  })

  it('negative control: a page missing from the index is genuinely caught', () => {
    expect(unindexedPages(['zz-fake-page.html'], llms, UNINDEXED)).toEqual(['zz-fake-page.html'])
    expect(unindexedPages(['zz-fake-page.html'], llms, new Set(['zz-fake-page.html']))).toEqual([]) // allowlist honored
  })
})
