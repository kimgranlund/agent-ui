// site/lib/sitemap.test.ts — the standing gate behind sitemap.json / adr-index.json / changelog-index.json
// (TKT-0018, site-command-search.spec.md SPEC-R5, LLD-C5). Mirrors llms.test.ts's G1/G2 shape:
//
//   G1 — all three generated files are byte-identical to a fresh generation from their sources. The test
//        imports the SAME generator functions the CLI writes with (scripts/generate-sitemap.mjs), so there is
//        no generator/gate drift pair; a descriptor/manifest/ADR-log/changelog edit without a regeneration
//        fails here. Regenerate: `node scripts/generate-sitemap.mjs`.
//   G2 — every real site page that is either a descriptor-derived `{name}-doc.html` OR listed in
//        site-manifest.json resolves to at least one sitemap.json entry (SPEC-R5 AC1(b)/AC2).
//
// Plus a small pure-helper unit suite (SPEC-R2/R4's own acceptance criteria): the description-fallback
// derivation, the tag->name/url derivation, slug determinism, and the ADR/changelog row counts.
import { describe, it, expect } from 'vitest'
import {
  generateSitemap,
  generateAdrIndex,
  generateChangelogIndex,
  deriveFallbackDescription,
  titleCaseFromTag,
  formatJson,
} from '../../scripts/generate-sitemap.mjs'
import { slug } from '../../scripts/slug.mjs'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (llms.test.ts precedent)
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (p: string): string => readFileSync(`${ROOT}/${p}`, 'utf8') as string

interface SitemapEntry {
  readonly name: string
  readonly tag?: string
  readonly url: string
  readonly description: string
  readonly level: 'L1' | 'L2' | 'L3'
  readonly section: string
  readonly index?: string
}

// ── G1 · byte-identity across all three generated files ────────────────────────────────────────────────────

describe('sitemap.json — byte-identical to a fresh generation (the committed index cannot drift)', () => {
  const committed = read('site/public/sitemap.json')
  const fresh = formatJson(generateSitemap(ROOT))

  it('anti-vacuous: the generation is real leveled output, not an empty or degenerate pass', () => {
    const parsed = JSON.parse(fresh) as { entries: SitemapEntry[] }
    // 56 L1 descriptors alone would already be >50 entries; the L2/L3-stub rows must be GENUINELY present
    // too (SPEC-R5(d)) — entries.length must exceed the descriptor count alone.
    const l1 = parsed.entries.filter((e) => e.level === 'L1')
    expect(l1.length, 'expected every components/src/controls descriptor as an L1 entry').toBeGreaterThan(50)
    expect(parsed.entries.length, 'expected L2/L3 rows on top of the L1 descriptor count').toBeGreaterThan(l1.length)
    for (const e of l1) expect(e.tag, `L1 entry "${e.name}" must carry a tag`).toMatch(/^ui-[a-z-]+$/)
    for (const e of parsed.entries.filter((e) => e.level !== 'L1')) {
      expect('tag' in e, `non-L1 entry "${e.name}" must not carry a tag key at all`).toBe(false)
    }
    // at least one real descriptor's derived-fallback description is markup-free (SPEC-R5(d)).
    const commandModal = l1.find((e) => e.tag === 'ui-command-modal')
    expect(commandModal, 'expected ui-command-modal as an L1 entry').toBeDefined()
    expect(commandModal!.description).not.toMatch(/[*`]/)
    expect(commandModal!.description.length).toBeGreaterThan(0)
  })

  it('the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-sitemap.mjs)', () => {
    expect(committed).toBe(fresh)
  })

  it('negative control: a sitemap edit is genuinely caught (the equality check bites)', () => {
    expect(committed + 'x').not.toBe(fresh)
  })

  it('the src-tree copy (site/sitemap.json, _page.ts\'s static-import target) is byte-identical to the public copy — Vite forbids importing anything under publicDir from JS, so this cannot be the SAME file; both must stay the SAME generation', () => {
    const srcCopy = read('site/sitemap.json')
    expect(srcCopy).toBe(committed)
  })
})

describe('adr-index.json — byte-identical to a fresh generation', () => {
  const committed = read('site/public/adr-index.json')
  const fresh = formatJson(generateAdrIndex(ROOT))

  it('anti-vacuous + AC2: entry count matches the README Index table row count; every url is a #adr-{number} anchor', () => {
    const parsed = JSON.parse(fresh) as SitemapEntry[]
    const readme = read('.claude/docs/adr/README.md')
    const tableRows = (readme.match(/^\| \[\d{4}\]/gm) ?? []).length
    expect(parsed.length).toBeGreaterThan(50)
    expect(parsed.length).toBe(tableRows)
    for (const e of parsed) expect(e.url).toMatch(/^\.\/adr-index\.html#adr-\d{4}$/)
  })

  it('the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-sitemap.mjs)', () => {
    expect(committed).toBe(fresh)
  })

  it('negative control: an ADR-index edit is genuinely caught', () => {
    expect(committed + 'x').not.toBe(fresh)
  })
})

describe('changelog-index.json — byte-identical to a fresh generation', () => {
  const committed = read('site/public/changelog-index.json')
  const fresh = formatJson(generateChangelogIndex(ROOT))

  it('anti-vacuous + AC3: entry count matches CHANGELOG.md\'s `## ` heading count; every url is a #{slug} anchor', () => {
    const parsed = JSON.parse(fresh) as SitemapEntry[]
    const changelog = read('CHANGELOG.md')
    const headingCount = (changelog.match(/^## /gm) ?? []).length
    expect(parsed.length).toBeGreaterThan(5)
    expect(parsed.length).toBe(headingCount)
    for (const e of parsed) expect(e.url).toMatch(/^\.\/changelog\.html#[a-z0-9-]+$/)
  })

  it('the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-sitemap.mjs)', () => {
    expect(committed).toBe(fresh)
  })

  it('negative control: a changelog-index edit is genuinely caught', () => {
    expect(committed + 'x').not.toBe(fresh)
  })
})

// ── G2 · page coverage — every doc/manifest page resolves to a sitemap entry ────────────────────────────────

/** The KNOWN, deliberately-unindexed page-type suffixes — permutation/states/demo pages are per-component
 *  tab content reached only through their owning `-doc.html` page, never surfaced as a standalone
 *  searchable/navigable entry. Everything else is real, top-level content and needs an entry. */
const EXCLUDED_SUFFIX = /-(demo|permutations|states)\.html$/

/** The `real site pages that need a sitemap entry`: any `{name}-doc.html` page, OR any OTHER page not
 *  matching `EXCLUDED_SUFFIX` (SPEC-R5 AC1(b)) — a genuinely new guide page (e.g. a fresh `{name}.html` +
 *  `{name}.ts` under site/pages/, no `site-manifest.json` row yet) must be REQUIRED here, not silently
 *  exempted for having no manifest row yet — that is precisely the gap that let `layout-overview.html`
 *  and a freshly-shipped `agent-admin.html` both go unindexed until this fix (neither is a `-doc.html`
 *  page, and `manifestHrefs.has(...)` can only ever confirm a page that's ALREADY registered — it can
 *  never catch one that never got registered in the first place). The prior version of this function
 *  used `manifestHrefs.has(...)` as an allow-list instead of this suffix-based deny-list; that is what
 *  let both gaps through undetected. */
function pagesRequiringEntry(allPages: readonly string[]): string[] {
  return allPages.filter((p) => !EXCLUDED_SUFFIX.test(p))
}

/** unindexedPages — the pages `pagesRequiringEntry` names that `sitemap.json` fails to cover, out of `pages`
 *  minus `allowlist`. Pure, so the negative control can drive it with synthetic inputs (the llms.test.ts
 *  `unindexedPages` precedent). */
function unindexedPages(pages: readonly string[], sitemapUrls: ReadonlySet<string>, allowlist: ReadonlySet<string>): string[] {
  return pages.filter((p) => !allowlist.has(p) && !sitemapUrls.has(`./${p}`))
}

describe('sitemap.json — every doc/manifest page resolves to an entry (minus the chrome allowlist)', () => {
  const ALLOWLIST = new Set<string>([
    'index.html',
    'agent-admin-app.html', // app chrome (the standalone ui-agent-admin surface) — the sitemap's content
    // entry for this composition is agent-admin.html, the docs guide (same reasoning as llms.test.ts)
  ])
  const manifestRows = JSON.parse(read('site/lib/site-manifest.json')) as { href: string }[]
  const manifestHrefs = new Set(manifestRows.map((r) => r.href))
  const allPages = (readdirSync(`${ROOT}/site`) as string[]).filter((f) => f.endsWith('.html')).sort()
  const sitemap = JSON.parse(read('site/public/sitemap.json')) as { entries: SitemapEntry[] }
  const sitemapUrls = new Set(sitemap.entries.map((e) => e.url.split('#')[0]))

  it('anti-vacuous: the page inventory, the manifest, and the sitemap are all real', () => {
    expect(allPages.length).toBeGreaterThan(50)
    expect(manifestRows.length).toBeGreaterThan(10)
    expect(sitemap.entries.length).toBeGreaterThan(50)
  })

  it('0 unindexed doc/manifest pages — a new component doc page or manifest row must land with a sitemap entry', () => {
    const required = pagesRequiringEntry(allPages)
    expect(required.length).toBeGreaterThan(50) // anti-vacuous: the filter genuinely selects a real subset
    expect(unindexedPages(required, sitemapUrls, ALLOWLIST)).toEqual([])
  })

  it('every manifest href resolves to a real site/pages/*.html file (SPEC-R3 AC1)', () => {
    for (const href of manifestHrefs) {
      const file = href.replace(/^\.\//, '')
      expect(allPages.includes(file), `site-manifest.json href "${href}" has no matching site/${file}`).toBe(true)
    }
  })

  it('negative control: a page missing from the sitemap is genuinely caught', () => {
    const fakeRequired = pagesRequiringEntry(['zz-fake-thing-doc.html'])
    expect(unindexedPages(fakeRequired, sitemapUrls, ALLOWLIST)).toEqual(['zz-fake-thing-doc.html'])
    expect(unindexedPages(fakeRequired, sitemapUrls, new Set(['zz-fake-thing-doc.html']))).toEqual([]) // allowlist honored
  })
})

// ── pure-helper unit suite ───────────────────────────────────────────────────────────────────────────────────

describe('deriveFallbackDescription — SPEC-R2 AC2/AC3', () => {
  it('a body with an early sentence boundary: non-empty, markup-free, no truncation suffix', () => {
    const body = '\n# ui-widget\n\n`ui-widget` is a **Pattern-class** thing. It does more after this.\n'
    const d = deriveFallbackDescription(body)
    expect(d).toBe('ui-widget is a Pattern-class thing.')
    expect(d).not.toMatch(/[*`_]/)
    expect(d.endsWith('…')).toBe(false)
  })

  it('a pathological body with no sentence boundary within 160 chars still truncates cleanly', () => {
    const body = `\n# x\n\n${'a'.repeat(300)}\n`
    const d = deriveFallbackDescription(body)
    expect(d.length).toBe(160)
    expect(d.endsWith('…')).toBe(true)
  })

  it('a description that already fits is not truncated or suffixed', () => {
    const body = '\n# x\n\nShort and sweet\n'
    expect(deriveFallbackDescription(body)).toBe('Short and sweet')
  })

  it('soft-wrapped prose (a single newline mid-sentence) is unwrapped, not cut at the wrap point', () => {
    const body = '\n# x\n\nThis sentence wraps across a\nsingle newline before its real period. Ignored after.\n'
    expect(deriveFallbackDescription(body)).toBe('This sentence wraps across a single newline before its real period.')
  })

  it('a changelog-shaped body opening straight into a bullet has its list marker stripped', () => {
    const body = '- **ui-settings**, NEW here. More text follows.\n'
    expect(deriveFallbackDescription(body)).toBe('ui-settings, NEW here.')
  })
})

describe('titleCaseFromTag', () => {
  it('derives Kim\'s own example format (SPEC-R1 AC2)', () => {
    expect(titleCaseFromTag('ui-swiper-paddles')).toBe('Swiper Paddles')
    expect(titleCaseFromTag('ui-button')).toBe('Button')
  })
})

describe('slug — determinism (the changelog-index id-producer / changelog.ts id-consumer must agree)', () => {
  it('lowercases, replaces non-alphanumerics with single dashes, trims edge dashes', () => {
    expect(slug('2026-07-11 (M4 Phase 3) — `ui-settings` ships')).toBe('2026-07-11-m4-phase-3-ui-settings-ships')
    expect(slug('  Leading/trailing punctuation!! ')).toBe('leading-trailing-punctuation')
  })
})
