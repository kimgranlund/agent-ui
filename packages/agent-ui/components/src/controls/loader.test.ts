// loader.test.ts: the control loader's contract over `x-ctl-probe-*` fixture records (ADR-0233). jsdom never
// fires `load` on a `<link>`, so these cases either use `css: 'host'` or need no sheet; link dedupe is proven
// in `loader.browser.test.ts`.

import { describe, it, expect, vi } from 'vitest'
import { ControlLoadError, createControlLoader } from './loader.ts'
import type { ControlRecord } from './control-record.ts'

/** A fixture record whose `load()` defines `tag` (once) and counts its calls. */
function probeRecord(tag: string, css?: string): ControlRecord & { calls: () => number } {
  let calls = 0
  return {
    tag,
    css,
    load: async () => {
      calls++
      if (customElements.get(tag) === undefined) customElements.define(tag, class extends HTMLElement {})
    },
    calls: () => calls,
  }
}

const headLinks = (): number => document.head.querySelectorAll('link').length

describe('createControlLoader (jsdom, fixture records)', () => {
  it('missing is synchronous and lists only the undefined tags, once each', () => {
    const tag = 'x-ctl-probe-sync'
    expect(customElements.get(tag)).toBeUndefined()
    customElements.define('x-ctl-probe-sync-defined', class extends HTMLElement {})
    const loader = createControlLoader({ [tag]: probeRecord(tag) })
    const result = loader.missing([tag, 'x-ctl-probe-sync-defined', tag])
    expect(Array.isArray(result)).toBe(true) // a value, not a promise
    expect(result).toEqual([tag])
  })

  it('an unknown missing tag rejects with ControlLoadError naming it, and loads nothing', async () => {
    const known = probeRecord('x-ctl-probe-known')
    const loader = createControlLoader({ 'x-ctl-probe-known': known }, { css: 'host' })
    const err = await loader.ensure(['x-ctl-probe-known', 'x-ctl-probe-nope']).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ControlLoadError)
    expect((err as ControlLoadError).tags).toEqual(['x-ctl-probe-nope'])
    expect((err as Error).message).toContain('x-ctl-probe-nope')
    expect(known.calls()).toBe(0)
    expect(customElements.get('x-ctl-probe-known')).toBeUndefined()
  })

  it("'host' mode defines the tag and leaves document.head alone", async () => {
    const tag = 'x-ctl-probe-host'
    expect(customElements.get(tag)).toBeUndefined()
    const record = probeRecord(tag, './host/host.css')
    const before = document.head.innerHTML
    await createControlLoader({ [tag]: record }, { css: 'host' }).ensure([tag])
    expect(customElements.get(tag)).toBeDefined()
    expect(record.calls()).toBe(1)
    expect(document.head.innerHTML).toBe(before)
  })

  it('nothing missing resolves at once, loads nothing and links nothing', async () => {
    const tag = 'x-ctl-probe-present'
    customElements.define(tag, class extends HTMLElement {})
    const record = probeRecord(tag, './present/present.css')
    const resolver = vi.fn(() => 'about:blank')
    const links = headLinks()
    await createControlLoader({ [tag]: record }, { css: resolver }).ensure([tag])
    expect(record.calls()).toBe(0)
    expect(resolver).not.toHaveBeenCalled()
    expect(headLinks()).toBe(links)
  })

  it('a load() rejection rejects with ControlLoadError naming the tag and carrying the cause', async () => {
    const tag = 'x-ctl-probe-throws'
    const boom = new Error('boom')
    const loader = createControlLoader({ [tag]: { tag, load: () => Promise.reject(boom) } }, { css: 'host' })
    const err = await loader.ensure([tag]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ControlLoadError)
    expect((err as ControlLoadError).tags).toEqual([tag])
    expect((err as Error).cause).toBe(boom)
  })

  it('a load() that resolves without defining its tag rejects with ControlLoadError', async () => {
    const tag = 'x-ctl-probe-silent'
    const loader = createControlLoader({ [tag]: { tag, load: async () => undefined } }, { css: 'host' })
    const err = await loader.ensure([tag]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ControlLoadError)
    expect((err as ControlLoadError).tags).toEqual([tag])
  })
})
