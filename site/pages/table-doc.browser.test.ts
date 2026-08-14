import { describe, it, expect, afterEach } from 'vitest'
// table-doc.ts is a PAGE module (mounts itself as an import side effect, ADR-0003's foundation cascade) —
// importing it is unavoidable to reach the real `renderSpecimens()` it exports, never a hand-rebuilt copy
// of the specimens it renders (the drift this gate exists to catch would be invisible to a copy).
import { renderSpecimens } from './table-doc.ts'

// table-doc.browser.test.ts — GH #882: the ui-table docs Examples specimens must fill their host, per the
// control's own SPEC-R5 fill-the-host contract (table.css: `table { inline-size: 100% }`, "a narrow table
// fills the host — no orphaned gutter"). The reported defect was an artificial `max-inline-size:32rem`
// inline style on the specimen `<ui-table>` itself — a docs-example gap (no site-wide precedent, no
// documented rationale), not the control's own intrinsic sizing law. jsdom cannot discriminate a real
// resolved width from a capped one (0-width boxes), so this is a real-browser layout read.

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A realistic wide docs content column (the same "normal docs reading column" figure doc-page.browser.test.ts
 *  uses) — a too-narrow host would make "fills the host" indistinguishable from "capped at 32rem" (512px). */
function mount(node: HTMLElement): HTMLElement {
  const host = document.createElement('div')
  host.style.inlineSize = '900px'
  host.append(node)
  document.body.append(host)
  mounted.push(host)
  return host
}

describe('GH #882 — the ui-table docs Examples specimens fill their host (SPEC-R5), never an arbitrary cap', () => {
  it('every specimen <ui-table> resolves to (near) the full 900px host width — not the old 32rem (512px) cap', () => {
    const section = renderSpecimens()
    const host = mount(section)

    const tables = [...section.querySelectorAll('ui-table')] as HTMLElement[]
    expect(tables.length, 'anti-vacuous: the Examples section must render both specimens').toBe(2)

    const hostWidth = host.getBoundingClientRect().width
    for (const table of tables) {
      const width = table.getBoundingClientRect().width
      // A generous floor (not exact-equality): the specimen wrapper carries no side padding/margin of its
      // own (table-doc.ts's `wrap` only sets block margin), so a fill-the-host table should land within a
      // few px of the host's own width — nowhere near the old 512px cap on a 900px host.
      expect(width, `<ui-table> resolved ${width.toFixed(1)}px on a ${hostWidth.toFixed(1)}px host`).toBeGreaterThan(
        hostWidth - 4,
      )
    }
  })

  it('no specimen <ui-table> carries a hand-authored width-capping inline style', () => {
    const section = renderSpecimens()
    mount(section)
    for (const table of [...section.querySelectorAll('ui-table')] as HTMLElement[]) {
      expect(table.style.maxInlineSize, 'GH #882 — the arbitrary 32rem cap must not return').toBe('')
      expect(table.style.maxWidth, 'GH #882 — the arbitrary 32rem cap must not return (physical alias)').toBe('')
    }
  })
})
