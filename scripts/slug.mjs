// scripts/slug.mjs — the ONE deterministic kebab-case slug function shared by the sitemap generator (the
// id-PRODUCER: changelog-index.json's per-milestone `url`s) and site/pages/changelog.ts (the id-CONSUMER:
// each rendered `<section>`'s `id`). A single shared helper, imported directly by BOTH a Node CLI script and a
// Vite-transformed TS module (the `scripts/generate-llms-full.mjs` import in site/lib/llms.test.ts is the same
// cross-boundary-import precedent), so the two can never independently drift into different slugs for the
// same heading text.
export function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
