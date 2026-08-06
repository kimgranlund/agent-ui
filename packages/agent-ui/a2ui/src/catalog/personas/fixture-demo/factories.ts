// factories.ts — the `fixture-demo` persona's factory table (SPEC-R1). One bespoke, sanctioned
// non-`ui-*` primitive (`<div>`, the `a2ui-basic/factories.ts` Divider precedent) — a FIXTURE
// component, never real persona content (SPEC-N6).

import type { WidgetFactory } from '../../types.ts'

export const fixtureBannerFactory: WidgetFactory = {
  tag: 'div',
  create: () => document.createElement('div'),
  applyProp: (el, prop, value) => {
    if (prop === 'text') el.textContent = value == null ? '' : String(value)
  },
}

/** Every component the fixture's `catalog.json` declares MUST appear here (mirrors the registry's own
 *  FACTORY_MISSING coverage gate, applied at SPEC-R2's derive-then-register step to the COMBINED,
 *  derived factory table). */
export const fixtureDemoFactories: Record<string, WidgetFactory> = {
  FixtureBanner: fixtureBannerFactory,
}
