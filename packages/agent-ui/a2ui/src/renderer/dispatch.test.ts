import { describe, it, expect, vi } from 'vitest'
import { dispatch } from './dispatch.ts'
import type { DispatchHandlers } from './dispatch.ts'
import type { A2uiServerMessage } from '../protocol.ts'

// A fresh recording handler set: each kind is a spy so a test can assert exactly one routed and read
// the (body, version) it was called with.
function spyHandlers(): DispatchHandlers {
  return {
    createSurface: vi.fn(),
    updateComponents: vi.fn(),
    updateDataModel: vi.fn(),
    deleteSurface: vi.fn(),
    actionResponse: vi.fn(),
  }
}

describe('dispatch — version-aware envelope routing (renderer LLD-C2, SPEC-R1/R13)', () => {
  it('routes createSurface to its handler with the body and version', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1', catalogId: 'demo' }
    const err = dispatch({ version: 'v1.0', createSurface: body }, h)

    expect(err).toBeUndefined()
    expect(h.createSurface).toHaveBeenCalledTimes(1)
    expect(h.createSurface).toHaveBeenCalledWith(body, 'v1.0')
    // no sibling handler fired
    expect(h.updateComponents).not.toHaveBeenCalled()
    expect(h.deleteSurface).not.toHaveBeenCalled()
  })

  it('routes updateComponents to its handler', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1', components: [{ id: 'root', component: 'Text' }] }
    const err = dispatch({ version: 'v1.0', updateComponents: body }, h)

    expect(err).toBeUndefined()
    expect(h.updateComponents).toHaveBeenCalledWith(body, 'v1.0')
  })

  it('routes updateDataModel to its handler', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1', path: '/user/name', value: 'Ada' }
    const err = dispatch({ version: 'v1.0', updateDataModel: body }, h)

    expect(err).toBeUndefined()
    expect(h.updateDataModel).toHaveBeenCalledWith(body, 'v1.0')
  })

  it('routes deleteSurface to its handler', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1' }
    const err = dispatch({ version: 'v1.0', deleteSurface: body }, h)

    expect(err).toBeUndefined()
    expect(h.deleteSurface).toHaveBeenCalledWith(body, 'v1.0')
  })

  it('routes actionResponse to its handler', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1', actionId: 'a1', value: { ok: true } }
    const err = dispatch({ version: 'v1.0', actionResponse: body }, h)

    expect(err).toBeUndefined()
    expect(h.actionResponse).toHaveBeenCalledWith(body, 'v1.0')
  })

  it('threads the message version through to the handler (v0.9.1 is in the pinned set)', () => {
    const h = spyHandlers()
    const body = { surfaceId: 's1', catalogId: 'demo' }
    const err = dispatch({ version: 'v0.9.1', createSurface: body }, h)

    expect(err).toBeUndefined()
    // version is passed so the host can apply v0.9.x semantics (theme→surfaceProperties, SPEC-R13 AC1).
    expect(h.createSurface).toHaveBeenCalledWith(body, 'v0.9.1')
  })

  it('rejects an unsupported version with VERSION_UNSUPPORTED and routes nothing (SPEC-R13 AC2)', () => {
    const h = spyHandlers()
    const err = dispatch({ version: 'v2.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }, h)

    expect(err).toEqual({ code: 'VERSION_UNSUPPORTED', message: expect.stringContaining('v2.0') })
    expect(h.createSurface).not.toHaveBeenCalled()
  })

  it('maps an unknown envelope key to SCHEMA and routes nothing (LLD-C2 default)', () => {
    const h = spyHandlers()
    // A parser-passthrough object whose key is none of the five kinds — not a real union member,
    // so cast to exercise the defensive default branch dispatch owns (LLD §9, unknown key → SCHEMA).
    const bad = { version: 'v1.0', frobnicate: { surfaceId: 's1' } } as unknown as A2uiServerMessage
    const err = dispatch(bad, h)

    expect(err).toEqual({ code: 'SCHEMA', message: expect.any(String) })
    expect(h.createSurface).not.toHaveBeenCalled()
    expect(h.updateComponents).not.toHaveBeenCalled()
    expect(h.updateDataModel).not.toHaveBeenCalled()
    expect(h.deleteSurface).not.toHaveBeenCalled()
    expect(h.actionResponse).not.toHaveBeenCalled()
  })

  it('checks the version before the envelope key: an unsupported version with no key → VERSION_UNSUPPORTED', () => {
    const h = spyHandlers()
    const bad = { version: 'nope' } as unknown as A2uiServerMessage
    const err = dispatch(bad, h)

    expect(err?.code).toBe('VERSION_UNSUPPORTED')
  })
})
