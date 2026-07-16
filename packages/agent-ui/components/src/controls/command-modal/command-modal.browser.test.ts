import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UICommandModalElement } from './command-modal.ts'

// command-modal.browser.test.ts — LLD-C15 cross-engine browser suite (command-modal.lld.md; command-modal.spec.md
// SPEC-R3, R5, R6, R9, R11, R14). jsdom-green ≠ done (the combo-box/date-time precedent) — the active-descendant
// focus-stays-in-input proof and the opened-dialog whole-shape are browser-only (jsdom is also blind to the
// <dialog> top-layer). Runs in BOTH Chromium and WebKit.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + the dimensional ramp FIRST,
// then the shared container surface seam + box-model, then the NESTED ui-modal's own sheet + module (so it
// self-defines before command-modal.ts's `document.createElement('ui-modal')` runs), then command-modal's own
// sheet + module. Imported DIRECTLY (relative), not via the component-styles barrel.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css'
import '../modal/modal.css'
import '../modal/modal.ts'
import './command-modal.css'
import './command-modal.ts'

// ── mount/cleanup ────────────────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

function mount(markup: string): { wrap: HTMLElement; el: UICommandModalElement } {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-command-modal') as UICommandModalElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()!
    const dialogs = m.querySelectorAll<HTMLDialogElement>('[data-part="dialog"]')
    for (const d of dialogs) if (d.open) d.close()
    m.remove()
  }
})

const px = (v: string): number => Number.parseFloat(v)
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// A realistic, grouped palette specimen (the whole-shape law) — two groups, real command items, a shortcut.
const PALETTE_MARKUP = `
  <ui-command-modal label="Command palette" placeholder="Type a command…">
    <div role="group" aria-labelledby="cmd-nav">
      <div id="cmd-nav" data-role="group-label">Navigation</div>
      <div role="option" value="home">Go Home<span data-role="shortcut" aria-hidden="true">⌘H</span></div>
      <div role="option" value="settings">Settings<span data-role="shortcut" aria-hidden="true">⌘,</span></div>
    </div>
    <div role="group" aria-labelledby="cmd-actions">
      <div id="cmd-actions" data-role="group-label">Actions</div>
      <div role="option" value="logout" data-keywords="sign out exit">Log out</div>
    </div>
  </ui-command-modal>
`

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] whole-shape — the palette opens as a real centered dialog with a populated, grouped, scrollable list
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-command-modal — whole-shape opened dialog (both engines)', () => {
  it('open=true renders the nested dialog in the top layer, with the search field + a populated grouped list', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const dialog = el.querySelector<HTMLDialogElement>('[data-part="dialog"]')!

    expect(dialog.open, 'closed by default').toBe(false)
    el.open = true
    await el.updateComplete
    expect(dialog.open, `${server.browser}: open did not open the nested modal`).toBe(true)

    const rect = dialog.getBoundingClientRect()
    expect(rect.width, `${server.browser}: the dialog collapsed to zero width`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: the dialog collapsed to zero height`).toBeGreaterThan(0)

    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    const list = el.querySelector<HTMLElement>('[data-part="list"]')!
    expect(list.querySelectorAll('[role=group]')).toHaveLength(2)
    expect(list.querySelectorAll('[role=option]')).toHaveLength(3)
    const searchRect = search.getBoundingClientRect()
    expect(searchRect.width, `${server.browser}: search field collapsed`).toBeGreaterThan(0)
    expect(searchRect.height, `${server.browser}: search field collapsed`).toBeGreaterThan(0)
  })

  it('focus lands in the search field on open', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    el.open = true
    await el.updateComplete
    await new Promise((r) => requestAnimationFrame(() => r(undefined))) // the effect's requestAnimationFrame(() => search.focus())
    expect(document.activeElement, `${server.browser}: focus did not land in the search field on open`).toBe(search)
  })

  it('the list is a bounded scroll viewport (max-block-size) when populated with many options', async () => {
    const manyOptions = Array.from({ length: 40 }, (_, i) => `<div role="option" value="opt${i}">Command number ${i}</div>`).join('')
    const { el } = mount(`<ui-command-modal label="Palette">${manyOptions}</ui-command-modal>`)
    el.open = true
    await el.updateComplete
    const list = el.querySelector<HTMLElement>('[data-part="list"]')!
    expect(list.scrollHeight, `${server.browser}: the list did not genuinely overflow its bound`).toBeGreaterThan(list.clientHeight)
  })

  // TKT-0047 — the disabled option's `opacity: 0.5` was replaced with a token-repoint (the fleet's
  // dominant disabled mechanism, matching select.css's fully-repointed [disabled] precedent).
  it('a disabled option repaints ink to the muted role, fully opaque (no opacity dimming)', async () => {
    const { el } = mount(`
      <ui-command-modal label="Palette">
        <div role="option" value="enabled">Enabled</div>
        <div role="option" value="disabled" aria-disabled="true">Disabled</div>
      </ui-command-modal>
    `)
    el.open = true
    await el.updateComplete
    const enabled = el.querySelector<HTMLElement>('[role=option][value=enabled]')!
    const disabled = el.querySelector<HTMLElement>('[role=option][value=disabled]')!
    expect(getComputedStyle(disabled).opacity, 'opacity dimming should be gone — the token repoint carries it now').toBe('1')
    expect(getComputedStyle(disabled).color, 'the disabled ink must still repaint to the muted token').not.toBe(
      getComputedStyle(enabled).color,
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] real typeahead-filter + keyboard flow — focus STAYS in the search field throughout
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-command-modal — real typeahead-filter + keyboard flow, focus stays in the search field (both engines)', () => {
  it('typing filters the list; the result-count live region updates; focus never leaves the search field', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    const status = el.querySelector<HTMLElement>('[data-part="status"]')!
    el.open = true
    await el.updateComplete

    search.focus()
    expect(document.activeElement).toBe(search)
    expect(status.textContent, `${server.browser}: initial result count wrong`).toBe('3 results')

    await userEvent.type(search, 'log')
    await el.updateComplete

    const opts = [...el.querySelectorAll<HTMLElement>('[role=option]')]
    const visible = opts.filter((o) => !o.hidden)
    expect(visible, `${server.browser}: typing "log" should leave only Log out visible`).toHaveLength(1)
    expect(visible[0]!.textContent).toContain('Log out')
    expect(status.textContent, `${server.browser}: result count did not update on filter`).toBe('1 result')
    expect(document.activeElement, `${server.browser}: focus left the search field while typing`).toBe(search)
  })

  it('ArrowDown/ArrowUp move aria-activedescendant + [data-active] WITHOUT moving DOM focus off the search field', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    el.open = true
    await el.updateComplete
    search.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement, `${server.browser}: focus moved off the search field on ArrowDown`).toBe(search)
    expect(search.getAttribute('aria-activedescendant'), `${server.browser}: no aria-activedescendant after ArrowDown`).toBeTruthy()

    const activeId = search.getAttribute('aria-activedescendant')
    const activeOpt = document.getElementById(activeId!)
    expect(activeOpt?.hasAttribute('data-active'), `${server.browser}: the active option lacks [data-active]`).toBe(true)

    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement, `${server.browser}: focus moved off the search field during repeated Arrow nav`).toBe(search)
  })

  it('Enter on the active option emits select {value,label,group} and closes the palette', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    const dialog = el.querySelector<HTMLDialogElement>('[data-part="dialog"]')!
    el.open = true
    await el.updateComplete
    search.focus()

    let detail: { value: string; label: string; group: string } | undefined
    el.addEventListener('select', (e) => { detail = (e as CustomEvent).detail })

    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(detail, `${server.browser}: no select detail fired`).toEqual({ value: 'home', label: 'Go Home', group: 'Navigation' })
    expect(dialog.open, `${server.browser}: the palette did not close on select`).toBe(false)
  })

  it('clicking an enabled option commits it', async () => {
    const { el } = mount(PALETTE_MARKUP)
    el.open = true
    await el.updateComplete
    let selectedValue = ''
    el.addEventListener('select', (e) => { selectedValue = (e as CustomEvent<{ value: string }>).detail.value })
    const logout = el.querySelector<HTMLElement>('[value="logout"]')!
    await userEvent.click(logout)
    expect(selectedValue, `${server.browser}: click-commit did not fire select`).toBe('logout')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Escape — single dismissal path via the nested modal (SPEC-R9)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-command-modal — Escape is the modal\'s single path (both engines)', () => {
  it('Escape closes the palette via the nested modal, regardless of an active filter (no clear-first stage)', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    const dialog = el.querySelector<HTMLDialogElement>('[data-part="dialog"]')!
    el.open = true
    await el.updateComplete
    search.focus()
    await userEvent.type(search, 'log') // an active filter — Escape must still close in ONE step, not clear-first

    let closes = 0
    el.addEventListener('close', () => closes++)

    await userEvent.keyboard('{Escape}')
    await el.updateComplete

    expect(dialog.open, `${server.browser}: Escape did not close the nested modal`).toBe(false)
    expect(el.open, 'the open prop should sync to false').toBe(false)
    expect(closes, 'exactly one close should fire').toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] forced-colors — the search field frame + active-option highlight survive WHCM (Chromium via CDP)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-command-modal — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  it('the search field frame + active-option highlight are visible in normal mode AND survive forced-colors', async () => {
    const { el } = mount(PALETTE_MARKUP)
    const search = el.querySelector<HTMLElement>('[data-part="search"]')!
    el.open = true
    await el.updateComplete
    search.focus()
    await userEvent.keyboard('{ArrowDown}')

    const activeId = search.getAttribute('aria-activedescendant')!
    const activeOpt = document.getElementById(activeId)!

    expect(
      px(getComputedStyle(search).borderBottomWidth),
      `${server.browser}: search field has no visible border in normal mode`,
    ).toBeGreaterThan(0)
    expect(
      alphaOf(getComputedStyle(activeOpt).backgroundColor),
      `${server.browser}: the active option has no background in normal mode`,
    ).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(
        px(getComputedStyle(search).borderBottomWidth),
        'search field frame vanished under forced-colors',
      ).toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(activeOpt).backgroundColor),
        'active-option highlight vanished under forced-colors',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] TKT-0019 — the two-line option shape: a clamped, single-line description, never a third line
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-command-modal — TKT-0019: the two-line option shape (both engines)', () => {
  it('a long [data-role=description] clamps to ONE line with an ellipsis; the option never wraps to a third line', async () => {
    const LONG =
      'This is a deliberately very long description that will not fit on one line at the palette’s realistic narrow width, so it must clamp with an ellipsis instead of wrapping onto a second or third line.'
    const { el } = mount(`
      <ui-command-modal label="Command palette">
        <div role="option" value="plain">No description</div>
        <div role="option" value="home">Go Home<div data-role="description">${LONG}</div></div>
      </ui-command-modal>
    `)
    el.open = true
    await el.updateComplete
    const plainOption = el.querySelector<HTMLElement>('[value=plain]')!
    const option = el.querySelector<HTMLElement>('[value=home]')!
    const description = el.querySelector<HTMLElement>('[data-role=description]')!

    // genuinely too long to fit — otherwise the truncation assertion below would be vacuous.
    expect(
      description.scrollWidth,
      `${server.browser}: the description fixture is not actually wider than its box — the clamp assertion would be vacuous`,
    ).toBeGreaterThan(description.clientWidth)

    // clamped to exactly one line — no vertical overflow (it did NOT wrap onto a second physical line of its own).
    expect(
      description.scrollHeight,
      `${server.browser}: the description wrapped instead of clamping to one line`,
    ).toBeLessThanOrEqual(description.clientHeight + 1)

    // the whole option renders as exactly TWO lines, never three: taller than a title-only (one-line) option by
    // roughly one description line's worth (+ the item's own row-gap between the two lines), not by a full
    // SECOND description line's worth of extra growth (which a wrapped/unclamped description would cost).
    const oneLineHeight = plainOption.getBoundingClientRect().height
    const twoLineHeight = option.getBoundingClientRect().height
    const descLineHeight = description.getBoundingClientRect().height
    expect(twoLineHeight, `${server.browser}: the option with a description is not taller than the one-line option`).toBeGreaterThan(oneLineHeight)
    expect(
      twoLineHeight,
      `${server.browser}: the option grew a third line (taller than one title line + ~two description lines' headroom)`,
    ).toBeLessThan(oneLineHeight + descLineHeight * 2)
  })
})

describe('ui-command-modal — TKT-0017: the fixed frame (both engines)', () => {
  it('the search field and the panel frame do NOT move as filtering changes the result count', async () => {
    const { el } = mount(PALETTE_MARKUP)
    el.open = true
    await el.updateComplete
    const dialog = el.querySelector('[data-part="dialog"]') as HTMLElement
    const search = el.querySelector('[data-part="search"]') as HTMLElement
    const before = { d: dialog.getBoundingClientRect(), s: search.getBoundingClientRect() }

    // Filter down to (nearly) nothing — the pre-fix centered shrink-fit frame moved BOTH edges here.
    search.focus()
    await userEvent.keyboard('zzzz-no-match')
    await el.updateComplete
    const after = { d: dialog.getBoundingClientRect(), s: search.getBoundingClientRect() }

    // Fixed width + top anchor: the panel's left/right/top and the search rect are identical (±1px).
    expect(Math.abs(after.d.left - before.d.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.d.width - before.d.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.d.top - before.d.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.s.top - before.s.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.s.left - before.s.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.s.width - before.s.width)).toBeLessThanOrEqual(1)

    // The top anchor is genuinely near the viewport top (15svh), not vertical centering — anti-vacuous:
    // a centered panel of this height would sit materially lower.
    expect(before.d.top).toBeLessThan(window.innerHeight * 0.3)
  })

  it('a BARE ui-modal keeps the classic centered shrink-fit (the frame dials default to identity)', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<ui-modal><p data-role="content">Plain modal body</p></ui-modal>'
    document.body.append(wrap)
    mounted.push(wrap)
    const modal = wrap.querySelector('ui-modal') as HTMLElement & { open: boolean; updateComplete: Promise<void> }
    modal.open = true
    await modal.updateComplete
    const dialog = wrap.querySelector('[data-part="dialog"]') as HTMLElement
    const r = dialog.getBoundingClientRect()
    // Centered (top layer margin:auto both axes): the block-start gap ≈ the block-end gap (±2px).
    const gapTop = r.top
    const gapBottom = window.innerHeight - r.bottom
    expect(Math.abs(gapTop - gapBottom)).toBeLessThanOrEqual(2)
    // Shrink-fit: narrower than the 32rem cap for this short content.
    expect(r.width).toBeLessThan(32 * 16)
  })
})
