import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fromWebSocket } from './from-web-socket.ts'

class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 1
  bufferedAmount = 0
  listeners = new Map<string, Set<EventListener>>()
  sendSpy = vi.fn()
  closeSpy = vi.fn((_code?: number, _reason?: string) => {
    this.readyState = 3
  })
  url: string
  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
    queueMicrotask(() => this.emit('open', new Event('open') as unknown as MessageEvent))
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
  send(data: unknown): void {
    this.sendSpy(data)
  }
  close(code?: number, reason?: string): void {
    this.closeSpy(code, reason)
    this.emit('close', { code } as unknown as MessageEvent)
  }
  emit(name: string, evt: MessageEvent): void {
    for (const cb of [...(this.listeners.get(name) ?? [])]) cb(evt)
  }
}

describe('fromWebSocket — SPEC-R13 (c)', () => {
  beforeEach(() => {
    FakeSocket.instances = []
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('messages yield in order', async () => {
    const ws = fromWebSocket('/ws', { WebSocket: FakeSocket as unknown as typeof WebSocket })
    const iterator = ws[Symbol.asyncIterator]()
    const p1 = iterator.next()
    const fake = FakeSocket.instances[0]
    fake.emit('message', { data: 'a' } as MessageEvent)
    const r1 = await p1
    expect((r1.value as MessageEvent).data).toBe('a')

    const p2 = iterator.next()
    fake.emit('message', { data: 'b' } as MessageEvent)
    const r2 = await p2
    expect((r2.value as MessageEvent).data).toBe('b')
  })

  it("return() closes with code 1000 and does not reconnect", async () => {
    const ws = fromWebSocket('/ws', {
      WebSocket: FakeSocket as unknown as typeof WebSocket,
      reconnect: { maxAttempts: 3, baseMs: 10, capMs: 100 },
    })
    const iterator = ws[Symbol.asyncIterator]()
    await iterator.return!()
    const fake = FakeSocket.instances[0]
    expect(fake.closeSpy).toHaveBeenCalledWith(1000, undefined)
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeSocket.instances.length).toBe(1) // no reconnect after an explicit return()
  })

  it('heartbeat timeout with reconnect opted in constructs a second socket AND closes the dead first one (no leak, no double-reconnect)', async () => {
    const ws = fromWebSocket('/ws', {
      WebSocket: FakeSocket as unknown as typeof WebSocket,
      heartbeat: { intervalMs: 10, timeoutMs: 10, ping: { type: 'ping' } },
      reconnect: { maxAttempts: 3, baseMs: 5, capMs: 20 },
    })
    const iterator = ws[Symbol.asyncIterator]()
    await vi.advanceTimersByTimeAsync(0) // let the 'open' microtask fire, arming the heartbeat
    await vi.advanceTimersByTimeAsync(10) // heartbeat interval fires -> sends ping, arms deadline
    await vi.advanceTimersByTimeAsync(10) // deadline fires -> onDead() -> closes the dead socket, schedules reconnect
    const first = FakeSocket.instances[0]
    expect(first.closeSpy).toHaveBeenCalledTimes(1) // the dead socket is closed, not left dangling
    await vi.advanceTimersByTimeAsync(20) // reconnect delay elapses -> connect() again
    expect(FakeSocket.instances.length).toBe(2)
    await vi.advanceTimersByTimeAsync(0) // second socket opens

    // the first socket's late events are inert: a stray 'close'/'message' from it never re-enters
    // onDead() (which would schedule a THIRD socket within the <20ms back-off) or the stream
    first.emit('close', { code: 1006 } as unknown as MessageEvent)
    first.emit('message', { data: 'ghost' } as MessageEvent)
    const live = FakeSocket.instances[1]
    for (let i = 0; i < 5; i++) {
      live.emit('message', { data: `keepalive-${i}` } as MessageEvent) // resets the live socket's own heartbeat clock
      await vi.advanceTimersByTimeAsync(8) // 40ms total — past any ghost back-off (<20ms), never past a heartbeat
    }
    expect(FakeSocket.instances.length).toBe(2)

    // the live (second) socket delivered every one of those, in order; the ghost never got through
    const seen: string[] = []
    for (let i = 0; i < 5; i++) seen.push(((await iterator.next()).value as MessageEvent).data as string)
    expect(seen).toEqual(['keepalive-0', 'keepalive-1', 'keepalive-2', 'keepalive-3', 'keepalive-4'])
    ws.close() // stop the second socket's own heartbeat cycle so no timer leaks past this test
  })

  it('heartbeat timeout with NO reconnect opted in ends the stream with a DataError kind:network', async () => {
    const ws = fromWebSocket('/ws', {
      WebSocket: FakeSocket as unknown as typeof WebSocket,
      heartbeat: { intervalMs: 10, timeoutMs: 10, ping: { type: 'ping' } },
    })
    const iterator = ws[Symbol.asyncIterator]()
    const pending = iterator.next()
    pending.catch(() => {}) // silence the transient unhandled-rejection window before the assertion below attaches
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(20)
    await expect(pending).rejects.toMatchObject({ kind: 'network', retryable: true })
    expect(FakeSocket.instances.length).toBe(1)
    expect(FakeSocket.instances[0].closeSpy).toHaveBeenCalled() // the dead socket is released
  })

  it('close() ENDS the stream: a pending next() settles { done: true }, the socket closes with the given code, no reconnect', async () => {
    const ws = fromWebSocket('/ws', {
      WebSocket: FakeSocket as unknown as typeof WebSocket,
      reconnect: { maxAttempts: 3, baseMs: 5, capMs: 20 },
    })
    const iterator = ws[Symbol.asyncIterator]()
    await vi.advanceTimersByTimeAsync(0)
    const pending = iterator.next()
    ws.close(4000, 'bye')
    const result = await pending
    expect(result.done).toBe(true)
    expect(FakeSocket.instances[0].closeSpy).toHaveBeenCalledWith(4000, 'bye')
    expect(FakeSocket.instances[0].closeSpy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeSocket.instances.length).toBe(1) // no reconnect after an explicit close()
    // a fresh pull on a closed stream is done, not parked
    expect((await iterator.next()).done).toBe(true)
  })

  it('close() during a reconnect back-off wait cancels the reconnect (no zombie socket)', async () => {
    const ws = fromWebSocket('/ws', {
      WebSocket: FakeSocket as unknown as typeof WebSocket,
      heartbeat: { intervalMs: 10, timeoutMs: 10, ping: { type: 'ping' } },
      reconnect: { maxAttempts: 3, baseMs: 50, capMs: 50 },
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(20) // dead -> reconnect scheduled (delay in [0, 100))
    ws.close()
    await vi.advanceTimersByTimeAsync(500)
    expect(FakeSocket.instances.length).toBe(1)
  })
})
