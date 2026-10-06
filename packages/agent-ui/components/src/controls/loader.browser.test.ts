// loader.browser.test.ts: the control loader in a real engine (ADR-0233). jsdom never fires `load` on a
// `<link>`, so sheet linking and its dedupe are proven here only.
//
// This file uses real fleet tags. That is sound because nothing defines the fleet on its page: its import
// closure is `./loader.ts` and `./registry.gen.ts` (never the renderer or
// `all.gen.ts`), and vitest browser mode runs each test file on its own page. The first assertion checks
// that `ui-table` is undefined, so a pre-defined fleet fails loudly instead of passing vacuously.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createControlLoader, ensureControls } from './loader.ts'
import { CONTROLS } from './registry.gen.ts'
import type { ControlRecord } from './control-record.ts'

const controlLinks = (): HTMLLinkElement[] => [...document.head.querySelectorAll<HTMLLinkElement>('link[data-ui-control]')]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('control loader (real engine)', () => {
  it('ensureControls defines ui-table and its imported controls, links table.css once, and a second call links nothing', async () => {
    expect(customElements.get('ui-table')).toBeUndefined()
    const uses = CONTROLS['ui-table']!.uses ?? []
    expect(uses.length).toBeGreaterThan(0)
    for (const tag of uses) expect(customElements.get(tag)).toBeUndefined()
    expect(controlLinks()).toHaveLength(0)
    const warn = vi.spyOn(console, 'warn')

    await ensureControls(['ui-table'])

    expect(customElements.get('ui-table')).toBeDefined()
    for (const tag of uses) expect(customElements.get(tag)).toBeDefined()
    const links = controlLinks()
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute('data-ui-control')).toBe('ui-table')
    expect(new URL(links[0]!.href).pathname).toMatch(/\/controls\/table\/table\.css$/)
    // The sheet really loaded as CSS (a failed or non-CSS response leaves no rules and warns).
    expect(links[0]!.sheet).not.toBeNull()
    expect(links[0]!.sheet!.cssRules.length).toBeGreaterThan(0)
    expect(warn).not.toHaveBeenCalled()

    await ensureControls(['ui-table', ...uses])
    expect(controlLinks()).toHaveLength(1)
  })

  it('a record whose sheet 404s warns naming the sheet and still resolves', async () => {
    const tag = 'x-ctl-probe-missing-sheet'
    expect(customElements.get(tag)).toBeUndefined()
    const record: ControlRecord = {
      tag,
      load: async () => customElements.define(tag, class extends HTMLElement {}),
      css: './no-such-control/no-such-control.css',
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await createControlLoader({ [tag]: record }).ensure([tag])

    expect(customElements.get(tag)).toBeDefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('no-such-control.css')
    expect(controlLinks().filter((l) => l.getAttribute('data-ui-control') === tag)).toHaveLength(1)
  })
})
