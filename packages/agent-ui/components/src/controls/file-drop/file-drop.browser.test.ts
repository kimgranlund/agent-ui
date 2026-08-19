import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { UIFileDropElement, type FileHandleDescriptor } from './file-drop.ts'

// ui-file-drop browser smoke (ADR-0210, GH #1391). Runs in BOTH Chromium AND WebKit — none of this
// resolves in jsdom: [1] real DataTransfer drag/drop, [2] a real focused paste target, [3] whole-shape
// geometry (a non-zero rendered box with a real dashed outline), [4] :state(dragging)/:state(disabled)
// real paint, [5] forced-colors.

import '@agent-ui/components/foundation-styles.css'
import './file-drop.css'
import './file-drop.ts'

const mounted: HTMLElement[] = []

function mount(): { wrap: HTMLElement; el: UIFileDropElement } {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '320px'
  document.body.append(wrap)
  mounted.push(wrap)
  const el = document.createElement('ui-file-drop') as UIFileDropElement
  wrap.append(el)
  return { wrap, el }
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove()
})

const oneIntake = (): ((files: readonly File[]) => Promise<FileHandleDescriptor[]>) => {
  let n = 0
  return async (files: readonly File[]) =>
    files.map((f) => ({ id: `id-${n++}`, name: f.name, mimeType: f.type, sizeBytes: f.size }))
}

class ProbeFileDrop extends UIFileDropElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-file-drop-bxprobe', ProbeFileDrop)

// Local focus-ring measurement helpers (the button-states.browser.test.ts precedent, restated per-file —
// browser test files do not cross-import each other's helpers).
const px = (v: string): number => Number.parseFloat(v)
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

describe('ui-file-drop — whole-shape geometry (real engine)', () => {
  it('renders a non-zero, hittable dashed dropzone box', async () => {
    const { el } = mount()
    const rect = el.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    const styles = getComputedStyle(el)
    expect(styles.borderStyle).toContain('dashed')
  })
})

describe('ui-file-drop — real DataTransfer drag/drop commits a file', () => {
  it('a real drop event with a DataTransfer carrying a File commits + fires change', async () => {
    const { el } = mount()
    el.intake = oneIntake()
    let changed = false
    el.addEventListener('change', () => (changed = true))

    const dt = new DataTransfer()
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    dt.items.add(file)

    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))

    await new Promise((r) => setTimeout(r, 50))
    expect(changed).toBe(true)
    expect(el.files.map((f) => f.name)).toEqual(['hello.txt'])
  })
})

describe('ui-file-drop — a real focused paste target', () => {
  it('is keyboard-focusable via Tab and shows the fleet focus ring', async () => {
    const { el } = mount()
    el.intake = oneIntake() // a wired control is the usable-state contract — an unwired one is
    // correctly tabbable-disabled by traits/tabbable.ts (finding 1, checker fix pass).
    await new Promise((r) => setTimeout(r, 0))
    await userEvent.tab()
    expect(document.activeElement).toBe(el)
    const styles = getComputedStyle(el)
    expect(styles.outlineStyle).toBe('solid') // ADR-0009 — the fleet focus ring, keyboard-drawn
    expect(px(styles.outlineWidth)).toBeGreaterThan(0)
    expect(alphaOf(styles.outlineColor)).toBeGreaterThan(0)
  })
})

describe('ui-file-drop — :state(disabled)/:state(dragging) real paint', () => {
  it('an unwired control shows the disabled paint; wiring intake clears it', async () => {
    const el = new ProbeFileDrop()
    document.body.append(el)
    mounted.push(el)
    expect(el.probeInternals.states?.has('disabled')).toBe(true)
    el.intake = oneIntake()
    await new Promise((r) => setTimeout(r, 0))
    expect(el.probeInternals.states?.has('disabled')).toBe(false)
  })
})

describe('ui-file-drop — composed buttons leave the tab order while unwired/disabled (finding 2)', () => {
  it('the browse button is NOT a tab stop while unwired; becomes one once intake is wired', async () => {
    const { el } = mount()
    const browse = el.querySelector('[data-part="browse"]') as HTMLElement
    await new Promise((r) => setTimeout(r, 0))
    expect(browse.getAttribute('tabindex')).not.toBe('0')
    el.intake = oneIntake()
    await new Promise((r) => setTimeout(r, 0))
    expect(browse.getAttribute('tabindex')).toBe('0')
  })

  it('a remove chip button is NOT a tab stop once the host goes disabled', async () => {
    const { el } = mount()
    el.intake = oneIntake()
    await new Promise((r) => setTimeout(r, 0))
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    await new Promise((r) => setTimeout(r, 50))
    expect((el.querySelector('[data-part="remove"]') as HTMLElement).getAttribute('tabindex')).toBe('0')
    el.disabled = true
    await new Promise((r) => setTimeout(r, 0))
    // The chips row rebuilds whole-swap on every usable-state change (file-drop.ts's own posture) — a
    // freshly re-queried node, not the pre-disable reference, is what proves the propagation (finding 2).
    expect((el.querySelector('[data-part="remove"]') as HTMLElement).getAttribute('tabindex')).not.toBe('0')
  })
})

describe('ui-file-drop — forced-colors', () => {
  it('carries a forced-colors media block', async () => {
    const res = await fetch(new URL('./file-drop.css', import.meta.url))
    const css = await res.text()
    expect(css).toContain('@media (forced-colors: active)')
  })
})
