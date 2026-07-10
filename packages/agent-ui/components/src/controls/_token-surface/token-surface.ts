// token-surface.ts — the shared value-lane helper for the token-surface family (ui-swatch/ui-ramp/ui-ladder;
// LLD-C1, token-surfaces.lld.md §2; SPEC-R2/R7/R11; ADR-0118 cl.2). DOM-free, unit-testable in plain Vitest —
// no color math, no getComputedStyle (the browser is the ONE resolver, ADR-0118 cl.2/3). A single shared folder,
// not three divergent copies (the `_base`/`_surface` precedent): all three controls bind the SAME value-lane
// contract, unlike the chart family's per-control math (bar-math.ts/sparkline math stay co-located there).
//
// Owns three things:
//   1. `cleanEntries`/`tokenEntriesProp` — the hardened `{label,value}[]` codec (the bar-chart `cleanData`/
//      `barDataProp` construction, generalized: `from(null) = []`, malformed JSON → `[]`, never a throw).
//   2. `cssValue` — the value-NEUTRAL `--var` lane (SPEC-R2): a `--`-prefixed value routes through `var(<value>)`
//      before it ever reaches a CSS property, so a bare dashed-ident (invalid at computed-value time inside
//      `min(100%, …)`) never poisons ladder's `--_mag` or swatch/ramp's `background`.
//   3. `isRenderableLength` — the length ROUTER (SPEC-R11): NOT a drop gate — ladder uses it to decide whether a
//      tier's value drives a real bar or a `0px` zero-bar, the row + printed value surviving either way (the
//      unified no-silent-state rule, matching swatch's invalid-color-keeps-the-datum).

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One token-surface entry — a `ui-ramp` step or a `ui-ladder` tier (SPEC-R2 Definitions). */
export interface TokenEntry {
  label: string
  value: string
}

/**
 * Harden an arbitrary input into the rendered entry set (SPEC-R7/R11): a non-array input yields `[]`; each
 * entry survives only as a plain object with a `string` `label` AND a `string` `value` — drop, never coerce.
 * Order is preserved (positional semantics — a duplicate-label row: both entries render, the list is
 * positional, not keyed). The bar-chart `cleanData` construction, generalized to a string `value` (a color/
 * length lane, not a number).
 */
export function cleanEntries(input: unknown): TokenEntry[] {
  if (!Array.isArray(input)) return []
  const out: TokenEntry[] = []
  for (const entry of input) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as { label?: unknown }).label === 'string' &&
      typeof (entry as { value?: unknown }).value === 'string'
    ) {
      const e = entry as { label: string; value: string }
      out.push({ label: e.label, value: e.value })
    }
  }
  return out
}

/**
 * The safe `steps`/`tiers` codec (SPEC-R7/R11 row 1): `from(null)` (attribute absent/removed) → `[]`, NEVER
 * `null`; malformed attribute JSON is caught and also falls back to `[]` — no throw ever reaches
 * `attributeChangedCallback`. `dom/props.ts`'s generic `jsonType<T>()` is deliberately NOT used here — its bare
 * `JSON.parse` throws on malformed attributes and maps a removed attribute to `null`, both of which the
 * hardening rows forbid reaching the render path (the bar-chart `barDataProp` reasoning, restated for the
 * token-surface family's string-valued entries).
 */
const tokenEntriesType: PropType<TokenEntry[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanEntries(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

/** The `steps`/`tiers` prop config — a fresh `PropConfig` each call (default `[]`, never a SHARED mutable array). */
export function tokenEntriesProp(): PropConfig<TokenEntry[]> {
  return { type: tokenEntriesType, default: [] }
}

/**
 * The `--var` lane (SPEC-R2), value-NEUTRAL: a value beginning `--` routes through `var(<value>)`; any other
 * string (a literal color/length, or `''`) is returned VERBATIM. Pure string routing — no resolution, no
 * `getComputedStyle` (the browser resolves the returned expression wherever it lands; the readback is an
 * ADR-0118 cl.2 foreseen extension, out of v1). Used by BOTH swatch/ramp's `background` and ladder's `--_mag`
 * (LLD-C6) — the ONE transform, so a `--`-prefixed value never reaches a CSS property as a bare dashed-ident
 * (`min(100%, --ui-height-md)` is invalid at computed-value time; `min(100%, var(--ui-height-md))` is what we want).
 */
export function cssValue(value: string): string {
  return value.startsWith('--') ? `var(${value})` : value
}

// A conservative CSS-length unit regex — the jsdom fallback when `CSS.supports` is unavailable (older jsdom
// builds no `CSS.supports`). Matches a signed/unsigned number (incl. a bare `0`, unitless per the CSS spec)
// followed by one of the standard absolute/relative length units, OR a bare `0`.
const LENGTH_RE = /^[+-]?\d*\.?\d+(px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|q|%)$|^0$/i

/**
 * The length-router (SPEC-R11): true iff `value` is a resolvable CSS length — a `--var` counts (its own
 * resolution is the browser's job, so any `--`-prefixed name is treated as renderable; ladder still routes it
 * through `cssValue` before use). Uses `CSS.supports('inline-size', v)` when available (browser + modern
 * jsdom) for a real platform-truth answer; falls back to the conservative unit regex above so the plain jsdom
 * unit tests still bite when `CSS.supports` is absent. NOT a drop gate (SPEC-R11) — LLD-C6 uses this to ROUTE
 * a non-length value to a zero-length bar (`0px`) while KEEPING the row + its printed value, matching swatch's
 * invalid-color-keeps-the-datum (SPEC-R3) and ramp's invalid-color-keeps-the-cell (SPEC-R7).
 */
export function isRenderableLength(value: string): boolean {
  if (value.startsWith('--')) return true // a --var's resolution is the browser's job (cssValue routes it)
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('inline-size', value)
  }
  return LENGTH_RE.test(value.trim())
}
