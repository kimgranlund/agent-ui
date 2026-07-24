// token-bridge.ts — genui-surface.spec.md SPEC-R6: the host's active `--md-sys-*` custom-property
// VALUES + `color-scheme`, read off a real element's computed style. The property NAMES are recovered
// at RUNTIME from the page's own already-loaded stylesheets (the `document.styleSheets` CSSOM) — NEVER
// bundled at build time. An earlier draft imported `@agent-ui/shared/tokens.css`/`dimensions.css` as
// `?raw` TEXT to regex the names out; that genuinely bloated the JS bundle (raw stylesheet source is far
// larger than just the property names, and — unlike a real `<link>`/`@import`, which the browser caches
// and parses once — it is non-tree-shakeable dead weight duplicated into every consumer's bundle:
// measured +23 KB gz on the self-defining family barrel, blowing well past its budget). Walking the
// REAL CSSOM at runtime costs zero extra bytes and reflects whatever is ACTUALLY declared on the page
// (the true "active" set SPEC-R6 means), not a static guess frozen at build time.
//
// A `CSSStyleRule`'s OWN `style` declaration enumerates exactly the properties THAT RULE literally
// declares (unlike `getComputedStyle`, which resolves cascaded/inherited values across every rule) — the
// reliable, cross-engine-safe way to discover custom-property NAMES; `getComputedStyle` is used
// separately, below, only to resolve each name's current VALUE.

/** Every `--md-sys-*` custom-property NAME declared in any accessible, same-origin stylesheet currently
 *  loaded on the page. A cross-origin stylesheet's CSSOM throws on `.cssRules` access — skipped, never
 *  thrown (jsdom, or a page with no stylesheets at all, yields an empty set, never throws). */
export function collectDeclaredTokenNames(): Set<string> {
  const names = new Set<string>()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    collectFromRuleList(rules, names)
  }
  return names
}

function collectFromRuleList(rules: CSSRuleList, names: Set<string>): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const style = rule.style
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i)
        if (name.startsWith('--md-sys-')) names.add(name)
      }
    } else if ('cssRules' in rule) {
      collectFromRuleList((rule as CSSGroupingRule).cssRules, names)
    }
  }
}

/** Read every currently-declared `--md-sys-*` token's CURRENT resolved value off `host`'s computed style
 *  (SPEC-R6's "active values") — never throws, degrading to `{}` when no stylesheet is reachable. */
export function readTokenMap(host: Element): Record<string, string> {
  const computed = getComputedStyle(host)
  const map: Record<string, string> = {}
  for (const name of collectDeclaredTokenNames()) {
    const value = computed.getPropertyValue(name).trim()
    if (value !== '') map[name] = value
  }
  return map
}
