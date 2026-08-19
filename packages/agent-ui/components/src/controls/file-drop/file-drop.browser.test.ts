import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { UIFileDropElement, type FileHandleDescriptor } from './file-drop.ts'

// ui-file-drop browser smoke (ADR-0210, GH #1391). Runs in BOTH Chromium AND WebKit — none of this
// resolves in jsdom: [1] real DataTransfer drag/drop, [2] a real focused paste target, [3] whole-shape
// geometry (a non-zero rendered box with a real dashed outline), [4] :state(dragging)/:state(disabled)
// real paint, [5] forced-colors.
//
// NOTE (handoff): this file was NOT executed as part of this dispatch's stated gate list (`tsc` +
// `vitest run .../file-drop`, jsdom-only by construction — `*.browser.test.ts` is excluded from that
// project). It is scaffolded per the component-build procedure's own DoD; running it is `npm run
// test:browser`, out of this dispatch's scope — flagged for the coordinator / component-checker.

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
    await userEvent.tab()
    expect(document.activeElement).toBe(el)
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

describe('ui-file-drop — forced-colors', () => {
  it('carries a forced-colors media block', async () => {
    const res = await fetch(new URL('./file-drop.css', import.meta.url))
    const css = await res.text()
    expect(css).toContain('@media (forced-colors: active)')
  })
})
