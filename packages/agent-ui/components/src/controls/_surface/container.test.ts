import { describe, it, expect } from 'vitest'
// Raw-text fs read — same reverse-coupling fs-read pattern as the other
// css-structure probes (container-box.test.ts et al.); vitest/node resolves it at runtime.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// container.test.ts — the ADR-0100 CSS TRIP-WIRE (the Acceptance section's named "CSS tripwire" leg). jsdom
// cannot compute layout, so this is a static text scan (the column-css.test.ts guarded-selector pattern):
// asserts `container.css` declares NO `container-type` on the four layout primitives — the blanket
// establishment ADR-0100 cl.1 deleted must never silently return. Companion to container.browser.test.ts,
// which proves the whole-shape consequences (toolbar/tiles/reflow/grid-guard legs) in real engines.

const read = (p: string): string => readFileSync(`${process.cwd()}/${p}`, 'utf8') as string
const CSS = read('packages/agent-ui/components/src/controls/_surface/container.css')
// Strip comments so a rule name mentioned in prose (there is plenty, post-ADR-0100) is never mistaken for a
// live declaration — the same discipline container-box.test.ts uses.
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('container.css — ADR-0100 blanket establishment is GONE', () => {
  it('declares NO container-type anywhere in the sheet', () => {
    // The strongest form of the tripwire: container.css owns the surface seam only now — it has no business
    // ever declaring container-type again, on the four primitives or otherwise.
    expect(CODE).not.toMatch(/container-type/)
  })

  it('the four layout primitives are still the declared surface-bearing tags (surface untouched)', () => {
    // Anti-vacuous companion: prove the file wasn't simply emptied — the surface :where() selector listing
    // all eight surface-bearing tags (the four primitives + card/tabs/modal/toolbar, ADR-0121) must still be intact.
    expect(CODE).toMatch(/:where\(ui-row,\s*ui-column,\s*ui-list,\s*ui-grid,\s*ui-card,\s*ui-tabs,\s*ui-modal,\s*ui-toolbar\)/)
    expect(CODE).toMatch(/--ui-container-bg:\s*transparent/)
  })

  it('the deleted rule is not merely commented into a `normal` no-op (a real deletion, not disabled)', () => {
    // Guards against a "fix" that keeps the selector but sets `container-type: normal` (a functional no-op in
    // this sheet, since normal is the initial value) instead of a genuine removal — ADR-0100 cl.1 is a
    // DELETION, and a stray `normal` declaration would still fail the no-container-type assertion above, but
    // this pins the specific selector text is gone too (not just neutralized).
    expect(CODE).not.toMatch(/:where\(ui-row,\s*ui-column,\s*ui-list,\s*ui-grid\)\s*\{/)
  })
})
