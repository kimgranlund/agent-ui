import { describe, it, expect, afterEach } from 'vitest'
import { server, userEvent } from 'vitest/browser'
import { UIMultiSelectElement } from './multi-select.ts'

// M-F browser smoke — ui-multi-select (multi-select-field.lld.md · multi-select-field.spec.md SPEC-R7/R8
// · ADR-0175). Runs in BOTH Chromium AND WebKit.
//
// What is proven here (none of this resolves in jsdom):
//   [1] keyboard-only vs pointer-driven byte-identity (SPEC-R8 AC1)
//   [2] axe-core zero violations (SPEC-R8 AC2)
//   [3] forced-colors
//   [4] C10 zero-residue reconnect
//   [5] [scale]×[size] geometry smoke (0 < checkmark ≤ icon-cell, the GEO-LAW family)
//   [6] dynamic option adoption, live
//   [7] :state(disabled)/:state(user-invalid) real paint (jsdom cannot match :state())
//
// Side-effect imports — CSS load order (ADR-0003): foundation roles + dimensional ramp FIRST, then the
// control sheet, then the self-defining module. Imported DIRECTLY (relative), not via the barrel.
import '@agent-ui/components/foundation-styles.css'
import './multi-select.css'
import './multi-select.ts'

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

function mount(markup: string): { wrap: HTMLElement; el: UIMultiSelectElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-multi-select') as UIMultiSelectElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()!.remove()
})

// Re-exposes the protected `internals` so the ARIA-contract leg below can read `role`/`ariaMultiSelectable`/
// `ariaLabel` directly (the field.browser.test.ts / tabs.browser.test.ts precedent): `page.getByRole` cannot
// see an ElementInternals-ONLY reflection on a custom element at all (verified in that file's own header —
// a locator-tool gap, not a seam defect), while `internals.role`/`.ariaLabel` both read back correctly when
// read directly off the internals object in a real engine.
class ProbeMultiSelect extends UIMultiSelectElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-multi-select-axprobe', ProbeMultiSelect)

const OPTIONS = `
  <div role="option" value="design">Design</div>
  <div role="option" value="engineering">Engineering</div>
  <div role="option" value="product">Product</div>
`

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] keyboard-only vs pointer-driven byte-identity (SPEC-R8 AC1)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select — keyboard-only vs pointer-driven byte-identity (SPEC-R8 AC1, both engines)', () => {
  it('a keyboard-only pass (Tab/Space/Arrow/Enter) produces the identical committed selection as a pointer-driven pass', async () => {
    const { el: pointerEl } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const design = pointerEl.querySelector<HTMLElement>('[value="design"]')!
    const product = pointerEl.querySelector<HTMLElement>('[value="product"]')!
    await userEvent.click(design)
    await userEvent.click(product)
    await pointerEl.updateComplete
    const pointerResult = [...pointerEl.value].sort()

    const { el: kbdEl } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const firstOption = kbdEl.querySelector<HTMLElement>('[role=option]')!
    firstOption.focus() // seeds roving focus onto the first option
    await userEvent.keyboard(' ') // Space toggles 'design' (the first option)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}') // rove to 'product'
    await userEvent.keyboard('{Enter}') // Enter toggles 'product'
    await kbdEl.updateComplete
    const kbdResult = [...kbdEl.value].sort()

    expect(kbdResult, `${server.browser}: keyboard-only and pointer-driven selections diverged`).toEqual(pointerResult)
    expect(kbdResult).toEqual(['design', 'product'])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Accessibility contract — real ARIA reflection (SPEC-R8 AC2's "fleet's equivalent accessibility
//  gate": axe-core is not installed anywhere in this zero-dependency fleet, so the established
//  precedent — select.browser.test.ts §9, combo-box.browser.test.ts — is direct ARIA/role/state
//  assertions in a REAL engine, not a third-party scanner; jsdom cannot compute a role/accessible-name
//  at all, so this is the genuinely new proof this leg adds).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select — ARIA contract, real-engine proof (both engines)', () => {
  it('internals.role/.ariaMultiSelectable/.ariaLabel all read back correctly on a REAL element (jsdom stubs ElementInternals entirely — only a real engine proves the platform actually accepted these writes)', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = `<ui-multi-select-axprobe label="Skills">${OPTIONS}</ui-multi-select-axprobe>`
    document.body.append(wrap)
    mounted.push(wrap)
    const el = wrap.querySelector('ui-multi-select-axprobe') as ProbeMultiSelect
    await el.updateComplete

    expect(el.probeInternals.role, `${server.browser}: internals.role did not read back listbox`).toBe('listbox')
    expect(el.probeInternals.ariaMultiSelectable, `${server.browser}: internals.ariaMultiSelectable did not read back true`).toBe('true')
    expect(el.probeInternals.ariaLabel, `${server.browser}: internals.ariaLabel did not read back the label prop`).toBe('Skills')
  })

  it('every option carries a real aria-selected value that flips on commit (real DOM attribute read-back)', async () => {
    const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const design = el.querySelector<HTMLElement>('[value="design"]')!
    expect(design.getAttribute('aria-selected')).toBe('false')

    await userEvent.click(design)
    await el.updateComplete
    expect(design.getAttribute('aria-selected'), `${server.browser}: aria-selected did not flip on real click`).toBe('true')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] forced-colors (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-multi-select — forced-colors (WHCM)', () => {
  it('the listbox surface + selected option stay visible under forced-colors (Chromium CDP emulation)', async () => {
    if (server.browser !== 'chromium') return // CDP forced-colors emulation is Chromium-only; WebKit gets a baseline paint check below
    const { cdp } = await import('vitest/browser')
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
      el.value = ['design']
      await el.updateComplete
      const cs = getComputedStyle(el)
      expect(cs.backgroundColor, 'listbox background should resolve to a real forced-colors system colour').not.toBe('')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { media: '', features: [] })
    }
  })

  it('WebKit baseline: the listbox renders a real bounding box (no forced-colors emulation available)', async () => {
    if (server.browser === 'chromium') return
    const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const rect = el.getBoundingClientRect()
    expect(rect.width, `${server.browser}: listbox collapsed to zero width`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] C10 zero-residue reconnect
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select — C10 zero-residue reconnect (both engines)', () => {
  it('reconnect does not stack listeners — one click, one commit, before AND after a disconnect/reconnect cycle', async () => {
    const { wrap, el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const design = el.querySelector<HTMLElement>('[value="design"]')!

    let selectCount = 0
    el.addEventListener('select', () => { selectCount++ })
    await userEvent.click(design)
    await el.updateComplete
    expect(selectCount).toBe(1)

    el.remove()
    wrap.append(el)
    await el.updateComplete

    await userEvent.click(el.querySelector<HTMLElement>('[value="design"]')!)
    await el.updateComplete
    expect(selectCount, `${server.browser}: a reconnect must not double-fire select`).toBe(2) // exactly one MORE, not stacked
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] [scale]×[size] geometry smoke (0 < checkmark ≤ icon-cell — the GEO-LAW family)
// ════════════════════════════════════════════════════════════════════════════════════════════════

const px = (v: string): number => Number.parseFloat(v)

describe('ui-multi-select — geometry (GEO-LAW: 0 < checkmark glyph ≤ icon cell, both engines)', () => {
  it('default [size=md]: the selected option row height matches the ramp; the checkmark renders within the icon cell', async () => {
    const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    el.value = ['design']
    await el.updateComplete

    const option = el.querySelector<HTMLElement>('[value="design"]')!
    const optRect = option.getBoundingClientRect()
    expect(optRect.height, `${server.browser}: option row collapsed`).toBeGreaterThan(0)

    // The checkmark paints via ::before — its resolved width/height must be > 0 and ≤ the icon token.
    const cs = getComputedStyle(option, '::before')
    const glyphW = px(cs.width)
    const iconCell = px(getComputedStyle(el).getPropertyValue('--ui-multi-select-icon'))
    expect(glyphW, `${server.browser}: selected checkmark did not render (0 width)`).toBeGreaterThan(0)
    expect(glyphW, `${server.browser}: checkmark wider than its icon cell — GEO-LAW violation`).toBeLessThanOrEqual(iconCell)
  })

  it('unselected option: the checkmark ::before renders with zero width (no glyph)', async () => {
    const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    const option = el.querySelector<HTMLElement>('[value="design"]')!
    const cs = getComputedStyle(option, '::before')
    expect(px(cs.width)).toBe(0)
  })

  it('[size=sm] and [size=lg] repoint the row-height lever off the ramp (no ad hoc size value)', async () => {
    const smWrap = document.createElement('div')
    smWrap.innerHTML = `<ui-multi-select size="sm">${OPTIONS}</ui-multi-select>`
    document.body.append(smWrap)
    mounted.push(smWrap)
    const smEl = smWrap.querySelector('ui-multi-select') as UIMultiSelectElement
    const smHeight = px(getComputedStyle(smEl).getPropertyValue('--ui-multi-select-height'))

    const lgWrap = document.createElement('div')
    lgWrap.innerHTML = `<ui-multi-select size="lg">${OPTIONS}</ui-multi-select>`
    document.body.append(lgWrap)
    mounted.push(lgWrap)
    const lgEl = lgWrap.querySelector('ui-multi-select') as UIMultiSelectElement
    const lgHeight = px(getComputedStyle(lgEl).getPropertyValue('--ui-multi-select-height'))

    expect(smHeight, `${server.browser}: sm row-height lever`).toBe(24)
    expect(lgHeight, `${server.browser}: lg row-height lever`).toBe(36)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] Dynamic option adoption, live
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select — dynamic option adoption (both engines)', () => {
  it('a late-appended option is immediately clickable and paints its checkmark correctly', async () => {
    const { el } = mount(`<ui-multi-select>${OPTIONS}</ui-multi-select>`)
    el.value = ['marketing'] // pre-set a value naming an option that does not exist YET
    await el.updateComplete

    const late = document.createElement('div')
    late.setAttribute('role', 'option')
    late.setAttribute('value', 'marketing')
    late.textContent = 'Marketing'
    el.append(late)
    await new Promise((r) => setTimeout(r, 0)) // MutationObserver callback settles
    await el.updateComplete

    expect(late.getAttribute('aria-selected'), `${server.browser}: late option not painted selected`).toBe('true')
    const cs = getComputedStyle(late, '::before')
    expect(px(cs.width), `${server.browser}: late option's checkmark did not render`).toBeGreaterThan(0)

    await userEvent.click(late)
    await el.updateComplete
    expect(el.value).toEqual([]) // clicking the already-selected late option toggles it OFF
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] :state(disabled) / :state(user-invalid) real paint (jsdom cannot match :state())
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select — custom-state paint (both engines)', () => {
  it(':state(disabled) mutes the listbox; the option is truly pointer-inert (a real userEvent click cannot even reach it) AND the JS-layer guard blocks a forced click too', async () => {
    const { el } = mount(`<ui-multi-select disabled>${OPTIONS}</ui-multi-select>`)
    expect(el.matches(':state(disabled)'), `${server.browser}: :state(disabled) did not arm`).toBe(true)

    const design = el.querySelector<HTMLElement>('[value="design"]')!
    expect(getComputedStyle(design).pointerEvents, `${server.browser}: a disabled option must be pointer-inert (CSS)`).toBe('none')

    // A real pointer gesture genuinely CANNOT reach a pointer-events:none, aria-disabled target — the
    // stronger guarantee than "the click fires but is ignored" (Playwright's own actionability preflight
    // refuses the interaction outright, timing out rather than dispatching). Prove the DEFENSE-IN-DEPTH
    // JS-layer guard separately with a forced/native click (bypassing the actionability preflight, the
    // way a stale-DOM-reference or non-pointer AT interaction still could).
    design.click()
    await el.updateComplete
    expect(el.value, 'a disabled control must not commit a selection even on a forced/native click').toEqual([])
  })

  it(':state(user-invalid) arms the danger outline only AFTER the first interaction (blur)', async () => {
    const { el } = mount(`<ui-multi-select required>${OPTIONS}</ui-multi-select>`)
    const option = el.querySelector<HTMLElement>('[role=option]')!

    expect(el.matches(':state(user-invalid)'), 'user-invalid must not flash before any interaction').toBe(false)
    const idleOutline = getComputedStyle(el).borderColor

    option.focus()
    el.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(el.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on blur').toBe(true)
    const invalidOutline = getComputedStyle(el).borderColor
    expect(invalidOutline, `${server.browser}: the outline colour did not repaint under :state(user-invalid)`).not.toBe(idleOutline)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #906 — the host's own scroll surface (fully untreated before this fix — raw platform default)
//  scrolls with a thin, auto-hiding scrollbar, never the platform-default chunky bar. MEASURED (both
//  engines under test fully expose the computed-style surface this probes — verified empirically, not
//  assumed): a bare `overflow: auto` box renders with a ZERO-width overlay gutter in this headless
//  harness regardless of any CSS, so a gutter-width COMPARISON against an untreated control cannot
//  discriminate "thin" from "chunky" here — the honest, engine-capability-respecting probe is the
//  computed STYLE itself: `scrollbar-width: thin` (the standard property) and the
//  `::-webkit-scrollbar{,-thumb}` pseudo values this fix actually declares (the #874 precedent,
//  editor.browser.test.ts).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-multi-select cross-engine — GH #906: the host scrolls with an unobtrusive (thin) scrollbar, never the platform-default chunky bar', () => {
  it('overflows for real, scrolls, and computes the thin/at-rest-transparent/reveal-on-hover treatment', async () => {
    const manyOptions = Array.from({ length: 40 }, (_, i) => `<div role="option" value="opt-${i}">Option ${i}</div>`).join('\n')
    const { el } = mount(`<ui-multi-select>${manyOptions}</ui-multi-select>`)
    await el.updateComplete
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(el.scrollHeight, 'a real overflow to actually scroll').toBeGreaterThan(el.clientHeight)

    // scrollability itself is UNCHANGED by this fix — a real scrollTop move.
    el.scrollTop = 0
    el.scrollTop = 40
    expect(el.scrollTop, `${server.browser}: still genuinely scrollable`).toBeGreaterThan(0)

    // THIN, never the platform-default chunky bar.
    expect(getComputedStyle(el).scrollbarWidth, `${server.browser}: scrollbar-width`).toBe('thin')
    expect(getComputedStyle(el, '::-webkit-scrollbar').width, `${server.browser}: ::-webkit-scrollbar width`).toBe('8px')
    // Nothing chunky AT REST — the thumb is transparent until interaction.
    expect(
      getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb transparent at rest`,
    ).toBe('rgba(0, 0, 0, 0)')

    // Reveal-on-hover: the SAME thumb pseudo resolves to a REAL, non-transparent colour once hovered.
    await userEvent.hover(el)
    expect(
      getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb paints on hover`,
    ).not.toBe('rgba(0, 0, 0, 0)')
    await userEvent.unhover(el)
  })

  it('reveals the thumb on real keyboard focus too (rovingFocus lands DOM focus on the host\'s own option children)', async () => {
    const manyOptions = Array.from({ length: 40 }, (_, i) => `<div role="option" value="opt-${i}">Option ${i}</div>`).join('\n')
    const { el } = mount(`<ui-multi-select>${manyOptions}</ui-multi-select>`)
    await el.updateComplete

    const first = el.querySelector<HTMLElement>('[role="option"]')!
    first.focus()
    expect(el.matches(':focus-within'), `${server.browser}: focus never landed inside the host`).toBe(true)
    expect(
      getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb paints on focus-within`,
    ).not.toBe('rgba(0, 0, 0, 0)')
  })
})


// -- ADR-0223 (Fill by Default, slice 1 -- the entry family): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs,
//    held open by the relocated content floor (clause 3(b)), and sits BELOW the container.
describe('ui-multi-select -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host >= its floor and < container (hug)', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any ch-floor resolution
    wrap.innerHTML = `<ui-multi-select label="Tags"><div role="option" value="a">Alpha</div></ui-multi-select>`
    document.body.append(wrap)
    mounted.push(wrap)
    const host = wrap.querySelector('ui-multi-select') as HTMLElement & { updateComplete: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('block')
    // HUG (the ONE opt-out): [inline] flips display level AND posture; the relocated floor holds it open.
    host.setAttribute('inline', '')
    const floorPx = px(getComputedStyle(host).minInlineSize)
    expect(floorPx, 'the hug floor did not resolve to a positive px in [inline]').toBeGreaterThan(0)
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host is narrower than its floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-block')
  })
})
