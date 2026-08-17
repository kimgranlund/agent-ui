// site/pages/motion-attrs.ts — pure derivation logic for motion.ts, split out so motion.test.ts (jsdom) can
// exercise it WITHOUT importing motion.ts itself (which calls mountPage() at module top-level — the dashboard-
// data.ts / agent-admin-presets.ts precedent: page-entry side effects stay out of the module a jsdom test loads).
//
// THE DRIFT GATE: `requireAttrs` is the same "throw if the marker/name is gone" discipline traits-doc.ts's
// extractInterface/extractSignature use — a `{name}.md` attribute renamed or removed under any of the four
// ADR-0183 opt-in surfaces throws HERE, at both page-load (motion.ts) and test time (motion.test.ts calls the
// SAME function against the SAME real descriptors), rather than silently rendering an empty/undefined row.
import type { ComponentDoc } from '../lib/frontmatter.ts'
import { findAttr } from '../lib/doc-page.ts'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'

/** The real `attributes[]` rows named `names`, read off `doc`'s own descriptor — never hand-typed. Throws
 *  (a real drift gate, not just a comment) if any name is missing: a rename/removal on the SOURCE `{name}.md`
 *  reddens this call, both in the page itself and in motion.test.ts's positive-control assertion. */
export function requireAttrs(doc: ComponentDoc, names: readonly string[], label: string): ParsedAttribute[] {
  return names.map((name) => {
    const attr = findAttr(doc.descriptor, name)
    if (!attr) throw new Error(`motion: expected attribute "${name}" on ${label} — renamed or removed from its {name}.md?`)
    return attr
  })
}

/** The four ADR-0183 opt-in surfaces this page tables, each keyed to the attribute NAME its own descriptor's
 *  `attributes[].name` actually carries (ADR-0183 cl.2/cl.3, the 2026-08-12 amendment, the 2026-08-16 named-
 *  morph amendment). Uniform across the four since GH #1079: every descriptor's `name:` field is the
 *  camelCase PROP name with an explicit `attribute:` override carrying the kebab-case DOM attribute —
 *  super-shell.md adopted the 3-of-4 majority grammar its siblings (drill.md/router-outlet.md/
 *  surface-host.md) already used. */
export const SURFACE_ATTR_NAMES = {
  'ui-super-shell': ['viewTransitions', 'viewTransitionNames'],
  'ui-surface-host': ['viewTransitions'],
  'ui-drill': ['viewTransitions'],
  'ui-router-outlet': ['viewTransitions'],
} as const
