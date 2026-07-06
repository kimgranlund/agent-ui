import { describe, it, expect } from 'vitest'
// Side-effect import: the page module builds the whole A2UI Catalog page into document.body (mountPage appends
// to `#app ?? document.body`) and self-imports the foundation cascade + self-defining ui-* controls (_page.ts).
import './a2ui-catalog.ts'

// a2ui-catalog.browser.test.ts — the field→filter smoke for the dogfooded search box (ADR-0077 dogfooding wave).
// The catalog page's filter is now a `ui-text-field type=search` (was a native <input>), so this proves — in a
// real engine — that the migrated control's OWN input wire (editor → value → re-emitted `input`) still drives
// the page's live section filter. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('a2ui-catalog — the dogfooded ui-text-field filter narrows the section list (both engines)', () => {
  it('typing a component name into the ui-text-field type=search hides the non-matching sections', async () => {
    await raf()
    const filter = document.querySelector('.catalog-filter-input') as (HTMLElement & { value: string }) | null
    expect(filter, 'no catalog filter found').not.toBeNull()
    expect(filter!.tagName.toLowerCase(), 'the filter should be the dogfooded ui-text-field').toBe('ui-text-field')

    const sections = [...document.querySelectorAll<HTMLElement>('.catalog-item')]
    expect(sections.length, 'expected multiple catalog sections').toBeGreaterThan(1)
    const visibleBefore = sections.filter((s) => !s.hidden).length

    // Drive the field's REAL input wire: type into its editor PART → the field stops the raw editor input and
    // re-emits ONE `input` on the host → the page's filter listener reads `filter.value` and hides non-matches.
    const name = sections[0].querySelector('.catalog-item-title')!.textContent!.toLowerCase()
    const editor = filter!.querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = name
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()

    const visibleAfter = sections.filter((s) => !s.hidden).length
    expect(filter!.value, 'the ui-text-field value did not track the typed text').toBe(name)
    expect(visibleAfter, 'the filter did not narrow the section list').toBeLessThan(visibleBefore)
    expect(visibleAfter, 'the matching section should remain visible').toBeGreaterThan(0)
    expect(sections[0].hidden, 'the typed-name section should stay visible').toBe(false)
  })
})
