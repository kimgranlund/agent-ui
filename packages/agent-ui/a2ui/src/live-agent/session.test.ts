// session.test.ts — LLD-C8 / SPEC-R8 AC1: the reducer frames each client-message arm into a DISTINCT
// next-turn user content, and the turn-history helpers are pure appends. Deterministic, no model.
//
// ADR-0088 §3 adds `shouldRunTurn` — the routing predicate the page (`a2ui-live.ts`) calls BEFORE
// `nextTurn`, deciding whether a client message warrants a full conversational turn at all.

import { describe, it, expect } from 'vitest'
import {
  frameClientMessage,
  nextTurn,
  appendAssistantTurn,
  appendUserTurn,
  shouldRunTurn,
} from '../../tools/agent/session.ts'
import type {
  A2uiActionMessage,
  A2uiFunctionResponseMessage,
  A2uiErrorMessage,
} from '../protocol.ts'

const actionMsg: A2uiActionMessage = {
  version: 'v1.0',
  action: {
    surfaceId: 'canvas',
    actionId: 'a1',
    name: 'submit',
    sourceComponentId: 'root',
    timestamp: '2026-07-04T00:00:00Z',
    context: { email: 'a@b.c' },
  },
}
const fnRespMsg: A2uiFunctionResponseMessage = {
  version: 'v1.0',
  functionResponse: { functionCallId: 'fc1', call: 'ping', value: true },
}
const errMsg: A2uiErrorMessage = {
  version: 'v1.0',
  error: { code: 'VALIDATION_FAILED', surfaceId: 'canvas', message: 'missing root' },
}

describe('session reducer (LLD-C5 / SPEC-R8)', () => {
  it('frames each client-message arm into a DISTINCT next-turn user content (AC1)', () => {
    const a = frameClientMessage(actionMsg)
    const r = frameClientMessage(fnRespMsg)
    const e = frameClientMessage(errMsg)
    expect(new Set([a, r, e]).size).toBe(3) // all three distinct
    expect(a).toContain('submit') // the action name
    expect(a).toContain('a@b.c') // the carried context
    expect(r).toContain('ping') // the function name
    expect(r).toContain('true') // the awaited value
    expect(e).toContain('VALIDATION_FAILED') // the failure fed back for cross-turn recovery
  })

  it('nextTurn packages a client TurnInput carrying the session + raw message', () => {
    const session = { turns: [] }
    const input = nextTurn(session, actionMsg)
    expect(input.kind).toBe('client')
    if (input.kind === 'client') {
      expect(input.message).toBe(actionMsg)
      expect(input.session).toBe(session)
    }
  })

  it('turn-history helpers are pure appends (the browser holds the session — SPEC-R8 statelessness)', () => {
    const s0 = { turns: [] }
    const s1 = appendUserTurn(s0, 'hello')
    const s2 = appendAssistantTurn(s1, '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}')
    expect(s0.turns).toHaveLength(0) // immutable — no mutation of the input
    expect(s2.turns).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}' },
    ])
  })
})

describe('shouldRunTurn (ADR-0088 §3 — the page-routing predicate)', () => {
  const action = (wantResponse?: boolean): A2uiActionMessage => ({
    version: 'v1.0',
    action: {
      surfaceId: 'canvas',
      actionId: 'a1',
      name: 'submit',
      sourceComponentId: 'root',
      timestamp: '2026-07-07T00:00:00Z',
      context: {},
      ...(wantResponse === undefined ? {} : { wantResponse }),
    },
  })

  it('an EXPLICIT action.wantResponse === false suppresses the turn (the opt-out)', () => {
    expect(shouldRunTurn(action(false))).toBe(false)
  })

  it('an ABSENT wantResponse still turns — the back-compat default (the committed seed sets none)', () => {
    expect(shouldRunTurn(action(undefined))).toBe(true)
  })

  it('an EXPLICIT wantResponse:true still turns — the agent opting IN is unaffected', () => {
    expect(shouldRunTurn(action(true))).toBe(true)
  })

  it('functionResponse and error arms ALWAYS turn — they carry no wantResponse and are agent-directed', () => {
    expect(shouldRunTurn(fnRespMsg)).toBe(true)
    expect(shouldRunTurn(errMsg)).toBe(true)
  })

  // Negative control: proves the predicate genuinely INSPECTS the flag rather than always answering `true` —
  // without it, every assertion above suppressing nothing would pass vacuously.
  it('negative control: the SAME action shape with wantResponse:true is NOT suppressed — the false-case above bites', () => {
    expect(shouldRunTurn(action(false))).not.toBe(shouldRunTurn(action(true)))
  })
})
