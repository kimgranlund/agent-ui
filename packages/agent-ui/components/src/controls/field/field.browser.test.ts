import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent, page } from 'vitest/browser'
import { UICheckboxElement } from '@agent-ui/components/components'
import type { UIFieldElement, UITextFieldElement } from '@agent-ui/components/components'

// s11 — the CROSS-ENGINE browser smoke for ui-field (decomp g7-field-form-provider slice s11,
// field-form-provider.lld.md §4). Where the jsdom field.test.ts pins the DECLARED wiring (aria-labelledby
// ids, error node hidden/textContent), this pins what only a REAL engine can answer: whether the labelling
// seam actually NAMES the wrapped control in the accessibility tree (the reason this slice exists — jsdom
// has no AX tree at all, no `:state()` CustomStateSet matching, no forced-colors media, no real layout);
// whether `:state(user-invalid)` is truly in lockstep with the field's visible error (the same-tracker-source
// claim, LLD-C1); forced-colors ink survival; and a realistic rendered box (test-the-whole-shape law). Runs
// in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
//
// The AX read-back uses TWO different verification tools, deliberately, not interchangeably: text-field's
// NAME path is a plain `aria-labelledby` CONTENT ATTRIBUTE (LLD-C2 §wire override) — `page.getByRole(role,
// { name })` (vitest-browser's own accessible-name query) resolves it correctly in both engines, so that
// leg rides it. checkbox's NAME path is the newer `ariaLabelledByElements` IDL ELEMENT-REFLECTION (the
// ADR-0051 GUARDED base-path default) — empirically, `page.getByRole` cannot see role/name at all for an
// ElementInternals-only-reflected relation on a custom element (verified directly: `page.getByRole
// ('checkbox').query()` returns `null` even with NO name filter, in both Chromium and WebKit, while
// `internals.role` and `internals.ariaLabelledByElements` both read back correctly) — a locator-tool gap,
// not a seam defect, so that leg reads the internals getter directly instead (the `tabs.browser.test.ts`
// `ariaControlsElements`/`ariaLabelledByElements` precedent), feature-detected so it cannot silently pass on
// an engine lacking the accessor. A missing/wrong element there IS still a real finding, never faked.
//
// Demo/doc page-loads (the LLD's folded-in s15 flag) are SKIPPED here: the one existing site-page browser
// pattern (site-nav.browser.test.ts) mounts the shared `_page.ts` shell, not an individual page module —
// there is no harness precedent for "import field-doc.ts/field-demo.ts and assert it doesn't throw" to
// extend without inventing new harness machinery; s13's e2e drives the live pages instead.
//
// A REAL FINDING this file surfaced, now FIXED (reported to team-lead; block [2] below was red in BOTH
// engines — [3]/[4] failed as a downstream consequence, at their own setup step): the original field.ts
// listened for input/change/blur/invalid/reset and deferred the render one `queueMicrotask` to dodge the
// s8-documented capture-order race. A framework-free minimal repro proved that defer insufficient for a
// REAL user-driven blur (only a scripted `target.blur()` keeps the whole capture chain synchronous ahead of
// a queued microtask — a genuine click-driven blur does not, in either engine) — i.e. correct for the s8
// jsdom probe's synthetic dispatch, not for a real gesture. The re-fix (design #3 in field.ts's own header)
// replaces all five listeners + the raw microtask with a single scope-owned reactive `effect` installed at
// association, reading the connect detail's `userInvalid()`/`validity()` closures directly — every real
// trigger is a plain signal write the kernel wakes it for, so there is no DOM dispatch order to depend on.
// Verified green in both engines below.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (field.css + text-field.css + checkbox.css all @import through the barrel, s12),
// then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// A realistic sized text-field. ui-text-field has no intrinsic width (the ADR-0021 20ch floor still applies
// without this), but an explicit author width is the common real case, and gives the whole-shape leg a fixed
// control width to contrast against the field's own stretched parts.
const SIZED = 'style="inline-size: 220px"'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(async () => {
  await userEvent.unhover(document.body) // drop any held hover so it cannot bleed into the next test
  while (mounted.length) mounted.pop()?.remove()
})

/** Alpha of a computed colour — 0 ⇒ the paint has VANISHED (a bare system keyword with no rgb() is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const partsOf = (field: Element): { label: HTMLElement; description: HTMLElement; error: HTMLElement } => ({
  label: field.querySelector('[data-part="label"]') as HTMLElement,
  description: field.querySelector('[data-part="description"]') as HTMLElement,
  error: field.querySelector('[data-part="error"]') as HTMLElement,
})

// Re-exposes the protected `internals` so the AX read-back below can read `ariaLabelledByElements` directly
// (the tabs.browser.test.ts precedent) — `page.getByRole` cannot see an ElementInternals-only reflection on
// a custom element at all (verified directly, see the header comment), so this is the correct tool here, not
// a workaround. A plain subclass changes no behaviour — checkbox's association with `ui-field` rides
// `instanceof UIFormElement`, which this still satisfies.
class ProbeCheckbox extends UICheckboxElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-checkbox-axprobe', ProbeCheckbox)

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] The AX read-back — the reason this slice exists (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-field — the AX read-back: the label names the wrapped control (both engines)', () => {
  it('a labelled field wrapping ui-text-field: the EDITOR carries the accessible name (the LLD-C2 override wire)', async () => {
    const wrap = mount(`<ui-field label="Email"><ui-text-field ${SIZED}></ui-text-field></ui-field>`)
    const field = wrap.querySelector('ui-field') as UIFieldElement
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    await field.updateComplete // the base's applyFieldLabelling effect + text-field's override settle here

    const named = page.getByRole('textbox', { name: 'Email', exact: true }).query()
    expect(named, `${server.browser}: no textbox named "Email" in the AX tree — the aria-labelledby wire did not land`).not.toBeNull()
    expect(named).toBe(editor)
  })

  it('a labelled field wrapping ui-checkbox: the guarded internals element-reflection default names it (ADR-0051 base path)', async () => {
    const wrap = mount(`<ui-field label="Agree to terms"><ui-checkbox-axprobe></ui-checkbox-axprobe></ui-field>`)
    const field = wrap.querySelector('ui-field') as UIFieldElement
    const checkbox = field.querySelector('ui-checkbox-axprobe') as ProbeCheckbox
    const label = partsOf(field).label
    await field.updateComplete

    // internals.role: the base's applyFieldLabelling guard (`this.internals.role == null` → no-op) requires
    // this to be set for the reflection branch to run at all.
    expect(checkbox.ii.role).toBe('checkbox')

    // feature-detected (the tabs.browser.test.ts precedent) — both target engines DO support the accessor;
    // a missing accessor here would mean the assertion below can never run, which is itself worth surfacing.
    expect('ariaLabelledByElements' in checkbox.ii, `${server.browser}: no ariaLabelledByElements accessor on internals`).toBe(true)
    const i = checkbox.ii as unknown as { ariaLabelledByElements?: readonly Element[] }
    expect(
      i.ariaLabelledByElements?.[0],
      `${server.browser}: the checkbox's ariaLabelledByElements did not point at the field's label part`,
    ).toBe(label)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] :state(user-invalid) ⟺ the visible error — the same tracker source (both engines, jsdom-blind)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-field — :state(user-invalid) ⟺ the visible error (both engines, jsdom cannot match :state())', () => {
  it("ONE plain blur on an untouched required text-field reveals the error, in lockstep with the control's own :state(user-invalid)", async () => {
    const wrap = mount(`<ui-field label="Name"><ui-text-field required ${SIZED}></ui-text-field></ui-field>`)
    const field = wrap.querySelector('ui-field') as UIFieldElement
    const control = field.querySelector('ui-text-field') as UITextFieldElement
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    const { error } = partsOf(field)
    await field.updateComplete

    // pre-interaction negative control (decomp s2's law, re-confirmed in a real engine) — no flash.
    expect(error.hidden, 'error visible before any interaction').toBe(true)
    expect(control.matches(':state(user-invalid)'), 'user-invalid armed before any interaction').toBe(false)

    await userEvent.click(editor)
    await userEvent.click(document.body) // ONE plain blur — the capture-order regression this slice pins
    await field.updateComplete

    const showing = !error.hidden
    expect(showing, `${server.browser}: the first blur did not reveal the field error`).toBe(true)
    // the same-tracker-source equivalence (LLD-C1's userInvalid() read ⟺ the control's REAL :state(user-invalid),
    // unreachable from jsdom — no CustomStateSet there).
    expect(control.matches(':state(user-invalid)')).toBe(showing)
    expect(field.matches(':state(user-invalid)'), "the field's own state mirrors the identical tracker source").toBe(showing)

    // recovery — fixing + re-committing clears both together.
    await userEvent.click(editor)
    await userEvent.keyboard('Ada')
    await userEvent.click(document.body)
    await field.updateComplete
    expect(error.hidden).toBe(true)
    expect(control.matches(':state(user-invalid)')).toBe(false)
    expect(field.matches(':state(user-invalid)')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Forced-colors survival (Chromium emulates via CDP; WebKit asserts the baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-field — forced-colors survival (Chromium emulates via CDP; WebKit asserts the baseline)', () => {
  it('label/description/error inks stay visible under forced-colors; the error stays distinguishable by PRESENCE', async () => {
    const wrap = mount(
      `<ui-field label="Name" description="As it appears on your card">
        <ui-text-field required ${SIZED}></ui-text-field>
      </ui-field>`,
    )
    const field = wrap.querySelector('ui-field') as UIFieldElement
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    const { label, description, error } = partsOf(field)
    await field.updateComplete

    // reveal the error via a real interaction so the presence check below is not vacuous.
    await userEvent.click(editor)
    await userEvent.click(document.body)
    await field.updateComplete
    expect(error.hidden, 'setup: the error did not show before the forced-colors leg').toBe(false)

    // baseline (BOTH engines, normal mode): all three inks are already opaque — anti-vacuous floor.
    expect(alphaOf(getComputedStyle(label).color), 'label ink invisible in normal mode').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(description).color), 'description ink invisible in normal mode').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(error).color), 'error ink invisible in normal mode').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the text-field-states.browser.test.ts documented
      // split) — confirm we are genuinely NOT in forced-colors so the Chromium proof below is not silently faked.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      // anti-vacuous: the engine REALLY entered forced-colors, so field.css's @media (forced-colors: active)
      // block is the one applying.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // the inks stay visible (CanvasText — real text, no forced-color-adjust:none) and the error stays
      // distinguishable by PRESENCE, not colour alone (field.css §2, WCAG 1.4.1).
      expect(alphaOf(getComputedStyle(label).color), 'label ink vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(description).color), 'description ink vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(error).color), 'error ink vanished under forced-colors').toBeGreaterThan(0)
      expect(error.hidden, 'the error visibility flipped under forced-colors alone').toBe(false)
      expect(getComputedStyle(error).display, 'the error lost its display:block under forced-colors').toBe('block')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset the emulation
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] The whole-shape assertion (test-the-whole-shape law)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-field — the whole-shape assertion (test-the-whole-shape law)', () => {
  it('a labelled field with a visible error renders a plausible stacked box: label above control above description above error; field ≥ control', async () => {
    const wrap = mount(
      `<div style="display:flex; flex-direction:column; inline-size: 320px">
        <ui-field label="Name" description="As it appears on your card">
          <ui-text-field required ${SIZED}></ui-text-field>
        </ui-field>
      </div>`,
    )
    const field = wrap.querySelector('ui-field') as UIFieldElement
    const control = field.querySelector('ui-text-field') as UITextFieldElement
    const editor = field.querySelector('[data-part="editor"]') as HTMLElement
    const { label, description, error } = partsOf(field)
    await field.updateComplete

    await userEvent.click(editor)
    await userEvent.click(document.body) // reveal the error — the "with a visible error" half of the shape
    await field.updateComplete
    expect(error.hidden, 'setup: the error did not show').toBe(false)

    const fieldBox = field.getBoundingClientRect()
    const controlBox = control.getBoundingClientRect()
    const labelBox = label.getBoundingClientRect()
    const descriptionBox = description.getBoundingClientRect()
    const errorBox = error.getBoundingClientRect()

    // anti-vacuous — no collapsed sliver anywhere in the stack (the checkbox-DOT regression this law guards).
    const boxes = [
      ['field', fieldBox],
      ['control', controlBox],
      ['label', labelBox],
      ['description', descriptionBox],
      ['error', errorBox],
    ] as const
    for (const [name, box] of boxes) {
      expect(box.width, `${name} box has no width`).toBeGreaterThan(0)
      expect(box.height, `${name} box has no height`).toBeGreaterThan(0)
    }

    // stacking order — field.ts's DOM placement (label prepended; description + error appended around the
    // slotted control) IS the reading order, no CSS `order` involved.
    expect(labelBox.top).toBeLessThan(controlBox.top)
    expect(controlBox.top).toBeLessThan(descriptionBox.top)
    expect(descriptionBox.top).toBeLessThan(errorBox.top)

    // the FIELD's box is not a collapsed wrapper around the control — it encloses the whole stack.
    expect(fieldBox.height).toBeGreaterThanOrEqual(controlBox.height)
    expect(fieldBox.width).toBeGreaterThanOrEqual(controlBox.width - 1) // sub-px rounding guard
  })
})
