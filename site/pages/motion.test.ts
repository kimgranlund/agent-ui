// site/pages/motion.test.ts — the standing drift gate for motion.html's per-surface attribute tables.
// Reads the SAME four real descriptors motion.ts renders from (via ?raw, which resolves real content under
// Vitest's SSR transform — tokens-doc.test.ts's own note: only `.css?raw` stubs empty, `.md?raw` does not) and
// calls the SAME `requireAttrs` the page calls, so a renamed/removed ADR-0183 attribute on any of the four
// surfaces reddens THIS test, not just the page a human happens to load.
import { describe, expect, it } from 'vitest'
import { parseDoc, loadDrillDoc, loadSurfaceHostDoc, loadRouterOutletDoc } from '../lib/frontmatter.ts'
import { requireAttrs, SURFACE_ATTR_NAMES } from './motion-attrs.ts'
import shellMd from '../../packages/agent-ui/app/src/controls/super-shell/super-shell.md?raw'

const shellDoc = parseDoc(shellMd)
const drillDoc = loadDrillDoc()
const surfaceHostDoc = loadSurfaceHostDoc()
const routerOutletDoc = loadRouterOutletDoc()

describe('motion.html source — the four ADR-0183 opt-in surfaces resolve real attributes', () => {
  it('ui-super-shell carries both viewTransitions AND viewTransitionNames (cl.3, GH #958)', () => {
    const attrs = requireAttrs(shellDoc, SURFACE_ATTR_NAMES['ui-super-shell'], 'ui-super-shell')
    expect(attrs.map((a) => a.name)).toEqual(['view-transitions', 'view-transition-names'])
    expect(attrs.every((a) => a.default === 'false')).toBe(true) // the family's default-off law, structurally
  })

  it('ui-surface-host carries viewTransitions (the 2026-08-12 amendment)', () => {
    const attrs = requireAttrs(surfaceHostDoc, SURFACE_ATTR_NAMES['ui-surface-host'], 'ui-surface-host')
    expect(attrs[0]?.name).toBe('viewTransitions')
    expect(attrs[0]?.default).toBe('false')
  })

  it('ui-drill carries viewTransitions', () => {
    const attrs = requireAttrs(drillDoc, SURFACE_ATTR_NAMES['ui-drill'], 'ui-drill')
    expect(attrs[0]?.name).toBe('viewTransitions')
    expect(attrs[0]?.default).toBe('false')
  })

  it('ui-router-outlet carries viewTransitions (GH #740)', () => {
    const attrs = requireAttrs(routerOutletDoc, SURFACE_ATTR_NAMES['ui-router-outlet'], 'ui-router-outlet')
    expect(attrs[0]?.name).toBe('viewTransitions')
    expect(attrs[0]?.default).toBe('false')
  })

  // The negative control (the charter's "a gate you cannot watch fail has not earned its place"): a name that
  // is NOT on the real descriptor throws, exactly the way a genuine rename/removal on the source `{name}.md`
  // would — proving requireAttrs' throw path actually bites rather than silently returning undefined.
  it('requireAttrs THROWS for a name absent from the real descriptor (negative control)', () => {
    expect(() => requireAttrs(drillDoc, ['viewTransitionsTypo'], 'ui-drill')).toThrow(/viewTransitionsTypo/)
  })

  it('every opt-in default is false — the family byte-identical-when-off law, asserted across all four surfaces', () => {
    const allAttrs = [
      ...requireAttrs(shellDoc, SURFACE_ATTR_NAMES['ui-super-shell'], 'ui-super-shell'),
      ...requireAttrs(surfaceHostDoc, SURFACE_ATTR_NAMES['ui-surface-host'], 'ui-surface-host'),
      ...requireAttrs(drillDoc, SURFACE_ATTR_NAMES['ui-drill'], 'ui-drill'),
      ...requireAttrs(routerOutletDoc, SURFACE_ATTR_NAMES['ui-router-outlet'], 'ui-router-outlet'),
    ]
    expect(allAttrs.every((a) => a.default === 'false')).toBe(true)
  })
})
