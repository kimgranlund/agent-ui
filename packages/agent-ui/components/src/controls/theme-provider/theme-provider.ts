// theme-provider.ts — UIThemeProviderElement, the fleet's second UIElement-based pure-coordination/carrier
// primitive (ADR-0117; SPEC theme-provider.spec.md; LLD theme-provider.lld.md LLD-C1/C2). BEHAVIOUR +
// self-define ONLY — geometry lives in theme-provider.css (LLD-C3), the public contract in
// theme-provider.md (LLD-C4).
//
// Promotes site/lib/theme-provider.ts's CONTRACT (not its file) to a shipped `@agent-ui/components`
// control, with one deliberate behavioral fix (SPEC-R3): `scheme` unset no longer collapses to light — it
// clears any inline override and lets `color-scheme` inherit (the page default, or an ancestor provider's,
// if nested). `scale`/`density`/`theme` are pure attribute carriers with zero JS-side effect (SPEC-R4/R5) —
// `dimensions.css`'s `[scale]`/`[density]` selectors and a future `[theme='<name>']` package layer read them
// directly; this class does nothing beyond reflecting them.
//
// `controls → dom` is the allowed import direction (this control needs no trait).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const SCHEMES = ['', 'light', 'dark'] as const
const SCALES = ['', 'ui-sm', 'ui-md', 'ui-lg', 'content-sm', 'content-md', 'content-lg'] as const // ADR-0032
const DENSITIES = ['', 'compact', 'comfortable', 'spacious'] as const

const props = {
  // The ONE prop with a JS-side effect (below) — SPEC-R3.
  scheme: { ...prop.enum(SCHEMES, ''), reflect: true },
  // Pure carriers — reflected, zero effect; dimensions.css [scale]/[density] key off the attribute (SPEC-R4).
  scale: { ...prop.enum(SCALES, ''), reflect: true },
  density: { ...prop.enum(DENSITIES, ''), reflect: true },
  // The reserved package seam (ADR-0079 cl.3 / SPEC-R5) — free string, inert until a future [theme=] layer ships.
  theme: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UIThemeProviderElement extends ReactiveProps<typeof props> {}
export class UIThemeProviderElement extends UIElement {
  static props = props

  protected connected(): void {
    // SPEC-R3 — '' clears any inline color-scheme (never coerces to 'light'), so an unset provider imposes
    // NO override and its subtree inherits the ambient color-scheme: the page's own, or an ANCESTOR
    // provider's if this one nests inside another (SPEC-R3 AC4). This is the load-bearing fix over the
    // site-local predecessor, which collapsed any non-'dark' value — including genuinely unset — to 'light'.
    this.effect(() => {
      this.style.colorScheme = this.scheme === '' ? '' : this.scheme
    })
  }
}

if (!customElements.get('ui-theme-provider')) customElements.define('ui-theme-provider', UIThemeProviderElement)
