// agent-admin-gc.browser.test.ts: removed CodeMirror editors leave nothing reachable after garbage collection
// (T-0575). ui-code-editor's `disconnected()` destroys its view and removes the `[data-part="cm"]` mount, so the
// handlers CodeMirror put on its own contentDOM and scrollDOM (about 100 per ui-agent-admin mount, T-0562) stay
// registered on nodes that are detached and outside the host. They are harmless only if nothing holds those
// nodes. This file mounts and removes ui-agent-admin five times, forces a full collection through CDP after
// each removal and requires every host, every `.cm-editor` and every listener on a detached CodeMirror node to
// be gone. Chromium only: WebKit has no CDP in this driver stack.
//
// The counting wrapper holds targets and handlers through WeakRefs only, so it cannot keep anything alive
// itself (the leak gate's `leak-instrument.ts` holds both strongly and so cannot answer this question).

import { describe, it, expect, vi } from 'vitest'
import { server, cdp } from 'vitest/browser'

// Each round waits for the lazy editors to settle (about two seconds) before the removal.
vi.setConfig({ testTimeout: 90_000 })

type Entry = { target: WeakRef<EventTarget>; fn: WeakRef<object>; type: string; capture: boolean; removed: boolean }
const entries: Entry[] = []
const proto = EventTarget.prototype
const nativeAdd = proto.addEventListener
const nativeRemove = proto.removeEventListener
const captureOf = (o: unknown): boolean =>
  typeof o === 'boolean' ? o : !!(o as { capture?: boolean } | undefined)?.capture
proto.addEventListener = function (this: EventTarget, type: string, fn: unknown, opts?: unknown) {
  nativeAdd.call(this, type, fn as EventListener, opts as AddEventListenerOptions)
  if ((fn && typeof fn === 'object') || typeof fn === 'function') {
    entries.push({ target: new WeakRef(this), fn: new WeakRef(fn as object), type, capture: captureOf(opts), removed: false })
  }
} as typeof proto.addEventListener
proto.removeEventListener = function (this: EventTarget, type: string, fn: unknown, opts?: unknown) {
  nativeRemove.call(this, type, fn as EventListener, opts as EventListenerOptions)
  const capture = captureOf(opts)
  for (const e of entries) {
    if (!e.removed && e.type === type && e.capture === capture && e.target.deref() === this && e.fn.deref() === fn) e.removed = true
  }
} as typeof proto.removeEventListener

/** Live listeners on detached nodes: all of them, and the ones inside a CodeMirror editor. */
const detached = (): { all: number; cm: number } => {
  let all = 0
  let cm = 0
  for (const e of entries) {
    if (e.removed) continue
    const t = e.target.deref()
    if (!(t instanceof Node) || t.isConnected) continue
    all++
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.cm-editor')) cm++
  }
  return { all, cm }
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Wait until the three lazy editors have mounted and no listener has been added for 1.5 s (CodeMirror's
 *  one-second scroll re-walk included, the leak gate's settle arm). */
const settle = async (el: HTMLElement): Promise<void> => {
  const start = performance.now()
  let last = -1
  let stillSince = performance.now()
  while (performance.now() - stillSince < 1_500 || el.querySelectorAll('.cm-editor').length < 3) {
    if (performance.now() - start > 15_000) throw new Error(`never settled (${el.querySelectorAll('.cm-editor').length} editors)`)
    await wait(50)
    if (entries.length !== last) {
      last = entries.length
      stillSince = performance.now()
    }
  }
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}
/** A forced full collection. Each wait ends the job, so a WeakRef read before it no longer pins its target. */
const gc = async (): Promise<void> => {
  const session = cdp() as unknown as CdpSession
  for (let i = 0; i < 3; i++) {
    await session.send('HeapProfiler.collectGarbage')
    await wait(20)
  }
}

type Round = { cmBefore: number; allBefore: number; cmAfter: number; allAfter: number; hosts: number; editors: number }

/** Mount one ui-agent-admin, let its editors settle, remove it and return WeakRefs to it and its editors. The
 *  strong references die with this frame unless `keep` takes the editors. */
const mountAndRemove = async (keep?: Element[]): Promise<{ host: WeakRef<Element>; editors: WeakRef<Element>[] }> => {
  const el = document.createElement('ui-agent-admin')
  document.body.append(el)
  await settle(el)
  const editors = [...el.querySelectorAll('.cm-editor')].map((cm) => new WeakRef(cm))
  if (keep) keep.push(...el.querySelectorAll('.cm-editor'))
  el.remove()
  return { host: new WeakRef(el), editors }
}

describe('T-0575: removed ui-agent-admin CodeMirror editors are collected', () => {
  it.skipIf(server.browser !== 'chromium')('five mount rounds leave no host, editor or detached CodeMirror listener after GC', async () => {
    await import('./agent-admin.ts')
    await gc()
    const rounds: Round[] = []
    for (let i = 0; i < 5; i++) {
      const { host, editors } = await mountAndRemove()
      await wait(50)
      const before = detached()
      await gc()
      const after = detached()
      rounds.push({
        cmBefore: before.cm,
        allBefore: before.all,
        cmAfter: after.cm,
        allAfter: after.all,
        hosts: host.deref() ? 1 : 0,
        editors: editors.filter((r) => r.deref()).length,
      })
    }
    const rows = JSON.stringify(rounds)
    // anti-vacuous: each round really left CodeMirror listeners on detached nodes before the collection
    expect(rounds.every((r) => r.cmBefore > 0), rows).toBe(true)
    expect(rounds.map((r) => r.hosts + r.editors), rows).toEqual([0, 0, 0, 0, 0])
    expect(rounds.map((r) => r.cmAfter), rows).toEqual([0, 0, 0, 0, 0])
    expect(rounds.map((r) => r.allAfter), rows).toEqual([0, 0, 0, 0, 0])
  })

  // The removed `[data-part="cm"]` mount is no longer under the host, so the holder that would leak is one that
  // reaches the editor DOM itself (a view, a closure, a node list): the control holds the three `.cm-editor`s.
  it.skipIf(server.browser !== 'chromium')('negative control: editors still referenced keep their listeners through GC', async () => {
    await import('./agent-admin.ts')
    const keep: Element[] = []
    const { editors } = await mountAndRemove(keep)
    await gc()
    expect(editors.filter((r) => r.deref()).length, 'the three held editors survive').toBe(3)
    expect(detached().cm, 'their CodeMirror listeners are still counted').toBeGreaterThan(0)
    keep.length = 0
    await gc()
    expect(editors.filter((r) => r.deref()).length, 'released, the editors are collected').toBe(0)
    expect(detached().cm, 'released, no CodeMirror listener remains').toBe(0)
  })
})
