import { describe, it, expect, vi } from 'vitest'
import { createSurface } from './surface.ts'
import { ActionDispatcher } from './action.ts'
import type { A2uiAction, A2uiActionMessage } from './action.ts'
import type { A2uiComponent } from '../protocol.ts'

const node: A2uiComponent = { id: 'submit-btn', component: 'Button' }

/** A dispatcher wired to deterministic id/clock providers + a capturing emit sink, for assertions. */
function harness(opts: { sendDataModel?: boolean } = {}) {
  const sent: A2uiActionMessage[] = []
  let n = 0
  const warn = vi.fn<(message: string) => void>()
  const dispatcher = new ActionDispatcher({
    newId: () => `act-${++n}`,
    now: () => '2026-06-27T00:00:00.000Z',
    emitClient: (message) => void sent.push(message),
    warn,
  })
  const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0', sendDataModel: opts.sendDataModel })
  const last = (): A2uiAction => sent[sent.length - 1]!.action
  return { dispatcher, surface, sent, last, warn }
}

describe('emitAction — message shape (renderer LLD-C9, SPEC-R8)', () => {
  it('builds the action client-message with actionId, name, sourceComponentId, context, and wantResponse', () => {
    const { dispatcher, surface, sent, last } = harness()

    dispatcher.emitAction(node, surface, { name: 'submit', context: { email: 'ada@x.io' }, wantResponse: true })

    expect(sent).toHaveLength(1)
    expect(sent[0]!.version).toBe('v1.0') // version off the surface envelope
    expect(last()).toEqual({
      surfaceId: 's1',
      actionId: 'act-1', // from the injected id provider
      name: 'submit',
      sourceComponentId: 'submit-btn', // node.id
      timestamp: '2026-06-27T00:00:00.000Z', // from the injected clock
      context: { email: 'ada@x.io' },
      wantResponse: true,
    })
  })

  it('uses a fresh injected id per emission (client-generated, unique)', () => {
    const { dispatcher, surface, sent } = harness()
    dispatcher.emitAction(node, surface, { name: 'a' })
    dispatcher.emitAction(node, surface, { name: 'b' })
    expect(sent.map((m) => m.action.actionId)).toEqual(['act-1', 'act-2'])
  })

  it('defaults context to {}; leaves wantResponse ABSENT (never coerced to false) — returns undefined when no reply is expected', () => {
    const { dispatcher, surface, last } = harness()
    const result = dispatcher.emitAction(node, surface, { name: 'noop' })
    expect(result).toBeUndefined()
    expect(last().context).toEqual({})
    // ADR-0088 §3: an un-set `wantResponse` must stay ABSENT on the wire, not become an explicit `false` —
    // the page-layer routing decision distinguishes "never asked" (absent) from "explicitly opted out"
    // (`false`), and both would otherwise look identical to a `wantResponse`-routing reader.
    expect('wantResponse' in last()).toBe(false)
    expect(dispatcher.pendingCount).toBe(0) // no reply expected ⇒ no correlation slot
  })

  it('an EXPLICIT wantResponse:false is preserved on the wire, distinct from absent (ADR-0088 §3)', () => {
    const { dispatcher, surface, last } = harness()
    dispatcher.emitAction(node, surface, { name: 'noop', wantResponse: false })
    expect(last().wantResponse).toBe(false)
    expect(dispatcher.pendingCount).toBe(0) // still no correlation slot — unchanged ADR-0034 gate
  })

  it('omits dataModel unless the surface set sendDataModel', () => {
    const { dispatcher, surface, last } = harness()
    surface.data.value = { form: { email: 'ada@x.io' } }
    dispatcher.emitAction(node, surface, { name: 'submit' })
    expect('dataModel' in last()).toBe(false)
  })

  it('includes the full data model when sendDataModel is set (SPEC-R8 AC2)', () => {
    const { dispatcher, surface, last } = harness({ sendDataModel: true })
    surface.data.value = { form: { email: 'ada@x.io' } }
    dispatcher.emitAction(node, surface, { name: 'submit' })
    expect(last().dataModel).toEqual({ form: { email: 'ada@x.io' } })
  })
})

describe('actionResponse — correlation round-trip (SPEC-R8 AC1)', () => {
  it('returns a promise on wantResponse and resolves it with the response value', async () => {
    const { dispatcher, surface } = harness()
    const result = dispatcher.emitAction(node, surface, { name: 'submit', wantResponse: true })
    expect(result).toBeInstanceOf(Promise)
    expect(dispatcher.pendingCount).toBe(1)

    const handled = dispatcher.actionResponse({ surfaceId: 's1', actionId: 'act-1', value: { ok: true } })
    expect(handled).toBe(true)
    await expect(result).resolves.toEqual({ ok: true })
    expect(dispatcher.pendingCount).toBe(0) // slot deleted after correlation
  })

  it('rejects the awaiting caller when the response carries an error', async () => {
    const { dispatcher, surface } = harness()
    const result = dispatcher.emitAction(node, surface, { name: 'submit', wantResponse: true })

    const err = { code: 'FUNCTION', message: 'boom' } as const
    const handled = dispatcher.actionResponse({ surfaceId: 's1', actionId: 'act-1', error: err })
    expect(handled).toBe(true)
    await expect(result).rejects.toBe(err)
    expect(dispatcher.pendingCount).toBe(0)
  })

  it('correlates by actionId across concurrent pending actions', async () => {
    const { dispatcher, surface } = harness()
    const a = dispatcher.emitAction(node, surface, { name: 'a', wantResponse: true })
    const b = dispatcher.emitAction(node, surface, { name: 'b', wantResponse: true })
    expect(dispatcher.pendingCount).toBe(2)

    dispatcher.actionResponse({ surfaceId: 's1', actionId: 'act-2', value: 'B' })
    await expect(b).resolves.toBe('B')
    expect(dispatcher.pendingCount).toBe(1) // act-1 still pending

    dispatcher.actionResponse({ surfaceId: 's1', actionId: 'act-1', value: 'A' })
    await expect(a).resolves.toBe('A')
    expect(dispatcher.pendingCount).toBe(0)
  })
})

describe('actionResponse — unknown actionId (§9 edge)', () => {
  it('drops an unknown actionId with a warning and does not throw', () => {
    const { dispatcher, warn } = harness()
    const handled = dispatcher.actionResponse({ surfaceId: 's1', actionId: 'ghost', value: 1 })
    expect(handled).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('ghost')
  })

  it('a wantResponse:false action leaves no slot, so its response is dropped', () => {
    const { dispatcher, surface, warn } = harness()
    dispatcher.emitAction(node, surface, { name: 'noop' }) // wantResponse omitted ⇒ no slot
    const handled = dispatcher.actionResponse({ surfaceId: 's1', actionId: 'act-1', value: 1 })
    expect(handled).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
