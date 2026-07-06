// site/lib/theme-provider.ts — <theme-provider>: the ONE theming subtree a page wraps its live specimens in
// (ADR-0079 cl.3, component-gallery.lld.md LLD-C4). A plain, passive custom element (no UIElement/kernel
// involvement — it owns no reactive state of its own; <component-gallery> drives its attributes via a scope-
// owned effect). Carries:
//   • scheme  ('light' | 'dark') — mapped to this element's own `color-scheme`, which every `light-dark()`
//     token (tokens.css:2) resolves against per-subtree via inheritance.
//   • scale / density / theme — pure attribute carriers: the token system's `[scale]`/`[density]` selectors
//     (dimensions.css) key off them in CSS alone, no JS; `theme` is the RESERVED package seam
//     (`theme="<name>"`) — G8 ships ONLY the `default` package (the multi-theme swapping system is
//     explicitly next-tier scope, ADR-0079 cl.3 / decomp F2b). An unregistered `theme` name degrades
//     silently to the default look (§6 E10) — no CSS layer matches it, so nothing breaks. Its own `display`
//     (block, so it lays out as a normal wrapper) is set by the consumer's CSS (component-gallery.css) —
//     this file stays presentation-free, matching component-preview.ts's plain-HTMLElement precedent.

export class ThemeProvider extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['scheme']
  }

  attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
    if (name === 'scheme') this.style.colorScheme = next === 'dark' ? 'dark' : 'light'
  }
}

if (!customElements.get('theme-provider')) customElements.define('theme-provider', ThemeProvider)
