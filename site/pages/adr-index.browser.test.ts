import { describe, it, expect } from 'vitest'
// Side-effect import: the page module globs the ADR log and builds the Decision Records index into document.body
// (mountPage appends to `#app ?? document.body`), self-importing the foundation cascade + ui-* controls (_page.ts).
import './adr-index.ts'

// adr-index.browser.test.ts — the field→search smoke for the dogfooded search box (ADR-0077 dogfooding wave).
// The ADR index search is now a `ui-text-field type=search` (was a native <input>), so this proves — in a real
// engine — that the migrated control's OWN input wire (editor → value → re-emitted `input`) still drives the
// page's live card filter + its empty-state status. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('adr-index — the dogfooded ui-text-field search filters the card list (both engines)', () => {
  it('typing a non-matching query hides every card and shows the empty-state status', async () => {
    await raf()
    const search = document.querySelector('.adr-search') as (HTMLElement & { value: string }) | null
    expect(search, 'no ADR search field found').not.toBeNull()
    expect(search!.tagName.toLowerCase(), 'the search should be the dogfooded ui-text-field').toBe('ui-text-field')
    // Load-bearing, not cosmetic: `ui-text-field.adr-search` is TAG-QUALIFIED (not a bare `.adr-search`) because
    // a bare class selector (0,1,0) loses to text-field.css's `@scope (ui-text-field) { :scope { display:
    // inline-grid } }`, whose EFFECTIVE specificity is (0,1,1) (`:scope` matching the @scope prelude's own
    // scoping-root element adds that root selector's specificity to `:scope`'s own pseudo-class specificity,
    // per the CSS Cascading and Scoping spec) — regardless of import order. Querying `.adr-search` BY CLASS (as
    // every other assertion in this file does) can't catch a reverted tag qualifier; only a computed-style
    // check can (the a2ui-live `.canvas-tabs` sibling footgun had a fully-invisible-surface symptom — this one
    // is subtler, an inline-level box instead of block, but the identical defect).
    expect(getComputedStyle(search!).display, 'the tag-qualified selector must win over @scope(ui-text-field){:scope{display:inline-grid}}').toBe('block')

    const cards = [...document.querySelectorAll<HTMLElement>('.adr-card')]
    expect(cards.length, 'expected ADR cards').toBeGreaterThan(0)
    expect(cards.filter((c) => !c.hidden).length, 'every card should be visible before filtering').toBe(cards.length)

    // Drive the field's REAL input wire: type into its editor PART → the field re-emits `input` on the host →
    // the page's search listener (lib/adr.ts matchesQuery, over number + title + body) runs. A nonsense query
    // matches nothing, so every card hides and the empty-state status row is promoted.
    const editor = search!.querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = 'zzz-no-such-adr-query'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await raf()

    expect(search!.value, 'the ui-text-field value did not track the typed text').toBe('zzz-no-such-adr-query')
    expect(cards.every((c) => c.hidden), 'a non-matching query should hide every card').toBe(true)
    const status = document.querySelector('.adr-status') as HTMLElement
    expect(status.classList.contains('adr-status--empty'), 'the empty-state status row should show').toBe(true)
  })
})
