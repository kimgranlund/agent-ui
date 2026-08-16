import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fromEventSource } from './from-event-source.ts'
declare const process: { cwd(): string }

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSED = 2
  readyState = 1
  closeSpy = vi.fn()
  listeners = new Map<string, Set<EventListener>>()
  url: string
  init?: { withCredentials?: boolean }
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url
    this.init = init
  }
  addEventListener(name: string, cb: EventListener): void {
    let set = this.listeners.get(name)
    if (!set) {
      set = new Set()
      this.listeners.set(name, set)
    }
    set.add(cb)
  }
  removeEventListener(name: string, cb: EventListener): void {
    this.listeners.get(name)?.delete(cb)
  }
  close(): void {
    this.readyState = 2
    this.closeSpy()
  }
  emit(name: string, evt: MessageEvent): void {
    for (const cb of this.listeners.get(name) ?? []) cb(evt)
  }
}

describe('fromEventSource — SPEC-R13 (b)', () => {
  it('a fake EventSource yields typed events through the bridge', async () => {
    let fake!: FakeEventSource
    const EventSourceCtor = function (this: unknown, url: string, init?: { withCredentials?: boolean }) {
      fake = new FakeEventSource(url, init)
      return fake
    } as unknown as typeof EventSource
    ;(EventSourceCtor as unknown as { CLOSED: number }).CLOSED = 2

    const stream = fromEventSource('/sse', { EventSource: EventSourceCtor })
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    fake.emit('message', { data: 'hello' } as MessageEvent)
    const result = await pending
    expect((result.value as MessageEvent).data).toBe('hello')
  })

  it('return() calls es.close() exactly once', async () => {
    let fake!: FakeEventSource
    const EventSourceCtor = function (this: unknown, url: string, init?: { withCredentials?: boolean }) {
      fake = new FakeEventSource(url, init)
      return fake
    } as unknown as typeof EventSource
    ;(EventSourceCtor as unknown as { CLOSED: number }).CLOSED = 2

    const stream = fromEventSource('/sse', { EventSource: EventSourceCtor })
    const iterator = stream[Symbol.asyncIterator]()
    await iterator.return!()
    expect(fake.closeSpy).toHaveBeenCalledTimes(1)
  })

  it('the doc comment states the no-custom-headers auth constraint', () => {
    const path = `${process.cwd()}/packages/agent-ui/data/src/stream/from-event-source.ts`
    const src = readFileSync(path, 'utf8') as string
    expect(src.toLowerCase()).toMatch(/no custom headers/)
  })
})
