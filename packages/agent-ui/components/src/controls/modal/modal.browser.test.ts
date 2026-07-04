import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIModalElement } from './modal.ts'

// G9 s9 (browser leg) — the CROSS-ENGINE platform-truth smoke for ui-modal (decomp g9-containers node s9).
// This is where the native <dialog> behaviour is PROVEN — none of it resolves in jsdom (which ships a bare
// HTMLDialogElement): the TOP LAYER (above any z-index), the focus TRAP (the page behind goes inert), Escape
// dismissal, the focus RESTORE the control owns, the open round-trip, and the ::backdrop paint + forced-colors
// survival. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
// Sibling to text-field-states.browser.test.ts — same harness, same engine-split (drive what both engines
// allow; reach the Chromium-only forced-colors leg via cdp() and assert a WebKit baseline there).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST, then
// the shared container surface seam, then the modal sheet, then the self-defining module. Imported DIRECTLY
// (relative), not via the component-styles barrel — the s12 barrel wiring of container.css + modal.css lands
// after this slice, so the test is self-contained.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css' // the box-model layer — provides the [data-region] region padding
import './modal.css'
import './modal.ts'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; modal: UIModalElement; dialog: HTMLDialogElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const modal = wrap.querySelector('ui-modal') as UIModalElement
  const dialog = modal.querySelector('[data-part="dialog"]') as HTMLDialogElement
  return { wrap, modal, dialog }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()
    const dlg = m?.querySelector('dialog') as HTMLDialogElement | null
    if (dlg?.open) dlg.close() // drop any open top-layer dialog before the next test
    m?.remove()
  }
})

const px = (v: string): number => Number.parseFloat(v)

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

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] open round-trip — showModal()/close() in a real engine (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — open round-trip via the native <dialog> (both engines)', () => {
  it('open=true shows the dialog (it is open + rendered); open=false closes it', async () => {
    const { modal, dialog } = mount('<ui-modal><p>Body</p></ui-modal>')
    expect(dialog.open, 'a fresh modal is not open').toBe(false)

    modal.open = true
    await modal.updateComplete
    expect(dialog.open, 'showModal() did not open the dialog').toBe(true)
    expect(dialog.getBoundingClientRect().width, 'the open dialog did not render a box').toBeGreaterThan(0)

    modal.open = false
    await modal.updateComplete
    expect(dialog.open, 'close() did not close the dialog').toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] TOP LAYER — the modal renders above a high z-index sibling (the reason to use native <dialog>)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — the platform top layer beats z-index (both engines)', () => {
  it('the open dialog paints ABOVE a fixed, max z-index sibling', async () => {
    const { modal, dialog } = mount(
      '<div style="position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,0)"></div>' +
        '<ui-modal><p>On top</p></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete

    // hit-test the viewport centre — the dialog is centred there. The top layer outranks the z-index sibling,
    // so elementFromPoint returns the dialog (or a child), NOT the red overlay (anti-vacuous: a light-DOM
    // overlay would lose to z-index here, which is exactly the failure native <dialog> avoids).
    const cx = Math.round(window.innerWidth / 2)
    const cy = Math.round(window.innerHeight / 2)
    const hit = document.elementFromPoint(cx, cy)
    expect(hit, 'nothing was hit at the viewport centre').not.toBeNull()
    expect(
      dialog === hit || dialog.contains(hit),
      `${server.browser}: the dialog did not render in the top layer (a z-index sibling occluded it)`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] focus TRAP — the page behind the modal goes inert (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — focus is trapped inside the open dialog (both engines)', () => {
  it('initial focus moves into the dialog and a button OUTSIDE cannot steal it', async () => {
    const { wrap, modal, dialog } = mount(
      '<button id="outside">outside</button><ui-modal><button id="inside">inside</button></ui-modal>',
    )
    const outside = wrap.querySelector('#outside') as HTMLButtonElement
    modal.open = true
    await modal.updateComplete

    // showModal() moved initial focus INTO the dialog (the inside button / the dialog).
    expect(dialog.contains(document.activeElement), `${server.browser}: focus did not move into the dialog`).toBe(true)

    // the page behind is inert — focusing the outside button is a no-op (focus stays trapped in the dialog).
    outside.focus()
    expect(
      dialog.contains(document.activeElement),
      `${server.browser}: an outside button stole focus from the open modal (not trapped)`,
    ).toBe(true)
    expect(document.activeElement).not.toBe(outside)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Escape — dismisses + syncs open=false + emits close + RESTORES focus to the EXACT opener
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — Escape dismissal + focus restore (both engines)', () => {
  it('Escape closes the modal, syncs open=false + emits close, and restores focus to the opener (NC: not body)', async () => {
    const { wrap, modal, dialog } = mount(
      '<button id="opener">open</button><ui-modal><button>inside</button></ui-modal>',
    )
    const opener = wrap.querySelector('#opener') as HTMLButtonElement

    opener.focus() // the opener is the active element when the modal opens → the focus-restore target
    expect(document.activeElement).toBe(opener)

    let closes = 0
    modal.addEventListener('close', () => closes++)
    modal.open = true
    await modal.updateComplete
    expect(dialog.open).toBe(true)
    expect(dialog.contains(document.activeElement), 'focus did not enter the dialog').toBe(true)

    await userEvent.keyboard('{Escape}')
    await modal.updateComplete
    expect(dialog.open, `${server.browser}: Escape did not close the dialog`).toBe(false)
    expect(modal.open, 'the open prop did not sync to false on Escape').toBe(false)
    expect(closes, 'the close event did not fire on Escape').toBe(1)
    // the NEGATIVE control: focus returns to the EXACT opener element (the platform omits this — the control owns it)
    expect(document.activeElement, `${server.browser}: focus was not restored to the exact opener`).toBe(opener)
  })

  it('persistent: Escape does NOT close the modal (the cancel is blocked)', async () => {
    // `persistent` is a presence-boolean defaulting false — when set, the modal is non-dismissable. Unlike the old
    // `dismissable`, it CAN be expressed by attribute presence (`<ui-modal persistent>`): presence ⇒ true is exactly
    // the declarative override the inversion fixes (ADR-0020). Here we set the property, equivalent to that attribute.
    const { modal, dialog } = mount('<ui-modal><button>inside</button></ui-modal>')
    modal.persistent = true
    modal.open = true
    await modal.updateComplete
    expect(dialog.open).toBe(true)

    await userEvent.keyboard('{Escape}')
    await modal.updateComplete
    expect(dialog.open, `${server.browser}: Escape closed a persistent modal`).toBe(true)
    expect(modal.open).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] [density] — shell padding shifts (--ui-space-lg); frame (border + radius) HOLDS (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — [box-model] the dialog is a padding-less box; region padding + frame are density-invariant (both engines)', () => {
  it('the dialog shell has NO padding (box-model); a content region carries the FIXED 12/4 padding; the frame HOLDS', async () => {
    // Box-model rollout (container-box.css): the dialog is a [data-box] with ZERO shell padding — a content
    // region inside carries the FIXED region padding (inline 0.75rem=12px · block 0.25rem=4px, rem-based → NOT
    // --ui-space × --ui-density, so density-INVARIANT). The frame (border 1px · radius) is invariant too.
    const { modal, dialog } = mount('<ui-modal><div data-region="content"><p>Body</p></div></ui-modal>')
    modal.open = true
    await modal.updateComplete
    const content = dialog.querySelector('[data-region="content"]') as HTMLElement

    // the dialog shell holds no padding — the region provides the inset
    expect(px(getComputedStyle(dialog).paddingTop), 'the dialog shell has padding (box-model expects 0)').toBe(0)

    // the content region's FIXED 12/4 region padding
    const padInlineBase = px(getComputedStyle(content).paddingLeft)
    const padBlockBase = px(getComputedStyle(content).paddingTop)
    const borderBase = px(getComputedStyle(dialog).borderTopWidth)
    const radiusBase = px(getComputedStyle(dialog).borderTopLeftRadius)
    expect(padInlineBase, 'content inline padding is not ~12px').toBeCloseTo(12, 0)
    expect(padBlockBase, 'content block padding is not ~4px').toBeCloseTo(4, 0)
    expect(borderBase, 'border is 0 (frame invariant is vacuous)').toBeGreaterThan(0)
    expect(radiusBase, 'radius is 0 (frame invariant is vacuous)').toBeGreaterThan(0)

    // density-INVARIANT: compact + spacious leave the region padding + frame unchanged (rem, not --ui-space)
    for (const d of ['compact', 'spacious']) {
      modal.setAttribute('density', d)
      expect(px(getComputedStyle(content).paddingLeft), `inline padding changed at ${d}`).toBeCloseTo(padInlineBase, 1)
      expect(px(getComputedStyle(content).paddingTop), `block padding changed at ${d}`).toBeCloseTo(padBlockBase, 1)
      expect(px(getComputedStyle(dialog).borderTopWidth), `border width changed at ${d}`).toBe(borderBase)
      expect(px(getComputedStyle(dialog).borderTopLeftRadius), `radius changed at ${d}`).toBe(radiusBase)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] ::backdrop — paints a scrim AND survives forced-colors (Chromium via CDP; WebKit asserts the baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — the ::backdrop scrim (Chromium emulates forced-colors via CDP; WebKit asserts the baseline)', () => {
  it('the ::backdrop paints in normal mode and the dialog surface survives forced-colors', async () => {
    const { modal, dialog } = mount('<ui-modal><p>Body</p></ui-modal>')
    modal.open = true
    await modal.updateComplete

    // baseline (BOTH engines, normal mode): the ::backdrop paints a visible scrim + the dialog surface is opaque
    // — so the forced-colors assertions below cannot be vacuous.
    expect(
      alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor),
      `${server.browser}: the ::backdrop did not paint a scrim`,
    ).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(dialog).backgroundColor), 'the dialog surface is not opaque').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split) — assert we are genuinely NOT in
      // forced-colors (so the Chromium proof is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true) // the engine REALLY entered forced-colors

      // the dialog surface + frame + ink survive as system colours (the forced-colors block repaints them); the
      // wash drops (background-image: none) so it cannot defeat the forced Canvas base.
      expect(
        alphaOf(getComputedStyle(dialog).backgroundColor),
        'the dialog surface vanished under forced-colors',
      ).toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(dialog).borderTopColor),
        'the dialog frame vanished under forced-colors',
      ).toBeGreaterThan(0)
      // the ::backdrop still paints — the blocking layer must not vanish (the modal stays distinguishable).
      expect(
        alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor),
        'the ::backdrop vanished under forced-colors',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
