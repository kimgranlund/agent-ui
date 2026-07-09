// site/lib/token-parse.ts — pure, DOM-free parsing over the two foundation token sheets
// (@agent-ui/shared/src/tokens/{tokens,dimensions}.css). No side effects, no `document` — so the SAME functions
// back both the tokens.html reference page (which additionally reads live getComputedStyle for the rendered
// swatch) AND the standing drift test (tokens-doc.test.ts), which asserts the parse shape without a browser.
// This is the "derive, don't hand-type" discipline for a page with no descriptor to parse: the foundation CSS
// text itself is the canonical source, so a token rename/add/remove here flows to the page with zero edits.

/** One `--md-sys-color-{family}-{role}` SEMANTIC role (excludes the numbered/alpha PRIMITIVE scale steps). */
export interface ColorRole {
  readonly family: string
  readonly role: string
  readonly varName: string
  /** The raw declared value (a `light-dark(var(...), var(...))` expression, or a bare value for `focus-ring`). */
  readonly value: string
}

/** One tier of a dimensional ramp (`--{prefix}-{tier}: {value}`), e.g. `{ tier: 'md', value: '28px' }`. */
export interface DimensionTier {
  readonly tier: string
  readonly value: string
}

/**
 * firstTopLevelBlock — the declaration text inside the FIRST `{selector} { … }` block in `css`, matching the
 * exact convention `site/pages/adr-index.ts`'s sibling gates use (`site-toc.test.ts`'s `constBlock`): find the
 * selector's opening brace, then its closing `\n}` at column 0. Every block this module reads (tokens.css's one
 * `:root`, dimensions.css's `:root` and `*`) is flat custom-property declarations with no nested braces (calc()
 * uses parens), so this simple delimiter is exact — it deliberately stops BEFORE any later `[scale="…"]` /
 * `@media` block, so a ramp's [scale] override tiers are never mixed into the base table.
 */
export function firstTopLevelBlock(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)
  if (at < 0) return ''
  const open = css.indexOf('{', at)
  const close = css.indexOf('\n}', open)
  return close < 0 ? css.slice(open + 1) : css.slice(open + 1, close)
}

// A primitive/alpha scale step's suffix is ALL digits and hyphens (100, 125, 500-050, 950-140, …); a semantic
// role's suffix always contains a letter (on-surface, container-low, outline-variant, track-hover, …). This is
// the exact, structural distinction tokens.css's own comments draw ("flat mode-independent primitives" vs
// "semantic roles") — so the filter needs no hand-maintained exclude-list that could drift from a future family.
const NUMERIC_SUFFIX = /^[\d-]+$/

/**
 * parseColorRoles — every `--md-sys-color-{family}-{role}` SEMANTIC role declared in tokens.css's one `:root`
 * block (the numbered/alpha primitives that feed them are deliberately excluded — they are the palette's raw
 * material, not a published role a consumer should reach for). `--md-sys-color-focus-ring` (a bare utility
 * token, not itself part of a family's role ladder) parses as `{ family: 'focus', role: 'ring' }` — still an
 * accurate family/role split of its own literal name, so it needs no special case.
 */
export function parseColorRoles(tokensCss: string): ColorRole[] {
  const block = firstTopLevelBlock(tokensCss, ':root')
  const roles: ColorRole[] = []
  const re = /--md-sys-color-([a-z]+)-([a-z0-9-]+):\s*([^;]+);/g
  for (const m of block.matchAll(re)) {
    const [, family, role, value] = m
    if (NUMERIC_SUFFIX.test(role)) continue // a primitive/alpha scale step, not a semantic role
    roles.push({ family, role, varName: `--md-sys-color-${family}-${role}`, value: value.trim() })
  }
  return roles
}

/**
 * parseDimensionRamp — every `--{prefix}-{tier}` declared in dimensions.css's BASE ramp: the `:root` block
 * (height/font/icon/compact — the default, ui-md-equivalent literals) concatenated with the `*` block
 * (gap/space — the density-derived ledger). Deliberately stops before any `[scale="…"]` override block, so the
 * table this renders is the single default row, not six duplicated tiers — the `[scale]` STEPPING itself is
 * `sizing.html`'s live demo, not this reference table's job.
 */
export function parseDimensionRamp(dimensionsCss: string, prefix: string): DimensionTier[] {
  const combined = firstTopLevelBlock(dimensionsCss, ':root') + '\n' + firstTopLevelBlock(dimensionsCss, '*')
  const tiers: DimensionTier[] = []
  const seen = new Set<string>()
  const re = new RegExp(String.raw`--${prefix}-([a-z0-9]+):\s*([^;]+);`, 'g')
  for (const m of combined.matchAll(re)) {
    const [, tier, value] = m
    if (seen.has(tier)) continue // the `*` block's calc() forms never re-declare a `:root` tier, but guard anyway
    seen.add(tier)
    tiers.push({ tier, value: value.trim() })
  }
  return tiers
}

/** Every distinct `family` present in `roles`, insertion-order — the section grouping tokens.html renders by. */
export function familiesOf(roles: readonly ColorRole[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of roles) {
    if (!seen.has(r.family)) {
      seen.add(r.family)
      out.push(r.family)
    }
  }
  return out
}
