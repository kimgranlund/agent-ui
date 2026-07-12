/** Type surface for slug.mjs — the ONE deterministic kebab-case slug shared by scripts/generate-sitemap.mjs
 *  (the id-producer) and site/pages/changelog.ts (the id-consumer), per the generate-llms-full.d.mts precedent. */
export function slug(text: string): string
