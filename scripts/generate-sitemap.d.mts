/** Type surface for generate-sitemap.mjs — consumed by site/lib/sitemap.test.ts (the drift gate imports the
 *  SAME implementations the CLI runs, so the committed sitemap.json/adr-index.json/changelog-index.json and
 *  the generators cannot drift apart) and by site/lib/command-palette.ts's own SitemapEntry shape, mirrored
 *  here rather than imported (this file stays a pure type surface, no runtime import). Per the
 *  generate-llms-full.d.mts precedent. */
export interface SitemapEntry {
  name: string
  tag?: string
  url: string
  description: string
  level: 'L1' | 'L2' | 'L3'
  section: string
  index?: string
}

export interface Sitemap {
  entries: SitemapEntry[]
}

export function generateSitemap(repoRoot?: string): Sitemap
export function generateAdrIndex(repoRoot: string): SitemapEntry[]
export function generateChangelogIndex(repoRoot: string): SitemapEntry[]
export function deriveFallbackDescription(body: string): string
export function titleCaseFromTag(tag: string): string
export function formatJson(value: unknown): string
