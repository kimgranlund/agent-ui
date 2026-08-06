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
  isGenuiActionMessage,
  ownsSurfaceId,
  prefixSurfaceId,
  enforceSurfacePrefix,
} from '../agent/session.ts'
import type {
  A2uiActionMessage,
  A2uiFunctionResponseMessage,
  A2uiErrorMessage,
  A2uiOutput,
  A2uiServerMessage,
} from '../protocol.ts'
import type { GenuiActionMessage } from '../agent/genui-line.ts'
import type { Session } from '../agent/agent-transport.ts'

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

})

// genui-surface.spec.md SPEC-R8 AC2 — the genuiAction sibling arm. Reproduces the exact crash an
// independent review caught live: a `{genuiAction:{...}}` message previously fell through
// `frameClientMessage`'s three A2uiClientMessage-only arms into `const e = message.error;
// 'functionCallId' in e`, throwing `TypeError: Cannot use 'in' operator to search for 'functionCallId'
// in undefined` — hit on EVERY real genui action click, both client-side (admin-live-runner.ts) and
// server-side (dev-proxy-plugin.ts / worker/index.ts, via produce()'s queryOf).
describe('session reducer — the genuiAction sibling arm (genui-surface SPEC-R8 AC2)', () => {
  const genuiActionMsg: GenuiActionMessage = { genuiAction: { surfaceId: 'q3-revenue', name: 'rate', payload: { stars: 5 } } }
  const genuiActionNoPayload: GenuiActionMessage = { genuiAction: { surfaceId: 'widget', name: 'ping' } }

  it('isGenuiActionMessage narrows correctly both ways', () => {
    expect(isGenuiActionMessage(genuiActionMsg)).toBe(true)
    expect(isGenuiActionMessage(actionMsg)).toBe(false)
    expect(isGenuiActionMessage(fnRespMsg)).toBe(false)
    expect(isGenuiActionMessage(errMsg)).toBe(false)
  })

  it('frameClientMessage NEVER throws on a genuiAction message (the reproduced crash, fixed)', () => {
    expect(() => frameClientMessage(genuiActionMsg)).not.toThrow()
    expect(() => frameClientMessage(genuiActionNoPayload)).not.toThrow()
  })

  it('SPEC-R8 AC2 — the framed text carries surfaceId/name/payload VERBATIM', () => {
    const framed = frameClientMessage(genuiActionMsg)
    expect(framed).toContain('q3-revenue')
    expect(framed).toContain('rate')
    expect(framed).toContain(JSON.stringify({ stars: 5 }))
  })

  it('a genuiAction with no payload frames cleanly (no "undefined" leaking into the text)', () => {
    const framed = frameClientMessage(genuiActionNoPayload)
    expect(framed).toContain('widget')
    expect(framed).toContain('ping')
    expect(framed).not.toContain('undefined')
  })

  it('frames DISTINCTLY from the three real A2uiClientMessage arms', () => {
    const all = [genuiActionMsg, actionMsg, fnRespMsg, errMsg].map((m) => frameClientMessage(m))
    expect(new Set(all).size).toBe(4)
  })

  it('nextTurn packages a genuiAction TurnInput without throwing', () => {
    const session = { turns: [] }
    expect(() => nextTurn(session, genuiActionMsg)).not.toThrow()
    const input = nextTurn(session, genuiActionMsg)
    expect(input.kind).toBe('client')
    if (input.kind === 'client') expect(input.message).toBe(genuiActionMsg)
  })
})

describe('session reducer (LLD-C5 / SPEC-R8) — turn-history helpers', () => {
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

describe('orchestrator surface-ID prefixing (ecosystem SPEC-R4, GH #475)', () => {
  describe('ownsSurfaceId / prefixSurfaceId — pure, deterministic', () => {
    it('no prefix ⇒ every id is "owned" (today\'s unprefixed default)', () => {
      expect(ownsSurfaceId(undefined, 'main')).toBe(true)
      expect(ownsSurfaceId('', 'main')).toBe(true)
    })

    it('an id under the namespace is owned; a foreign id is not', () => {
      expect(ownsSurfaceId('box2', 'box2:main')).toBe(true)
      expect(ownsSurfaceId('box2', 'box2')).toBe(true) // the bare prefix itself also counts as owned
      expect(ownsSurfaceId('box2', 'box1:main')).toBe(false)
      expect(ownsSurfaceId('box2', 'main')).toBe(false) // unprefixed id, under a prefixed session — foreign
    })

    it('prefixSurfaceId namespaces an unprefixed id; a no-op prefix leaves it unchanged', () => {
      expect(prefixSurfaceId('box2', 'main')).toBe('box2:main')
      expect(prefixSurfaceId(undefined, 'main')).toBe('main')
      expect(prefixSurfaceId('', 'main')).toBe('main')
    })

    it('idempotent — an already-prefixed id is not double-prefixed', () => {
      expect(prefixSurfaceId('box2', 'box2:main')).toBe('box2:main')
      expect(prefixSurfaceId('box2', prefixSurfaceId('box2', 'main'))).toBe('box2:main')
    })

    // Negative control: a DIFFERENT prefix does NOT treat an id already namespaced under another
    // producer as "already prefixed" — it stacks (still disjoint, never silently swallowed).
    it('negative control: a foreign-prefixed id gets the OWN prefix stacked on top, not silently accepted', () => {
      expect(prefixSurfaceId('box2', 'box1:main')).toBe('box2:box1:main')
    })
  })

  describe('enforceSurfacePrefix — SPEC-R4 AC1: disjoint by construction, cross-prefix rejected', () => {
    const sessionA: Session = { turns: [], surfacePrefix: 'boxA' }
    const sessionB: Session = { turns: [], surfacePrefix: 'boxB' }
    const noPrefixSession: Session = { turns: [] }

    it('absent surfacePrefix ⇒ byte-identical passthrough (the mode/genuiSurface precedent)', () => {
      const output: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } },
        { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [] } },
      ]
      const result = enforceSurfacePrefix(noPrefixSession, output)
      expect(result).toEqual({ output, rejected: [] })
      expect(result.output).toBe(output) // same array reference — a true no-op, not a rebuilt-identical copy
    })

    it('createSurface ids are REWRITTEN onto the namespace — disjoint by construction (AC1)', () => {
      const outA = enforceSurfacePrefix(sessionA, [
        { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } },
      ])
      const outB = enforceSurfacePrefix(sessionB, [
        { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } },
      ])
      const idA = (outA.output[0] as { createSurface: { surfaceId: string } }).createSurface.surfaceId
      const idB = (outB.output[0] as { createSurface: { surfaceId: string } }).createSurface.surfaceId
      expect(idA).toBe('boxA:main')
      expect(idB).toBe('boxB:main')
      expect(idA).not.toBe(idB) // two producers, the SAME model-authored id, disjoint on the wire
      expect(outA.rejected).toEqual([])
      expect(outB.rejected).toEqual([])
    })

    it('an update/delete/actionResponse targeting THIS session\'s own (already-prefixed) surface is KEPT', () => {
      const output: A2uiOutput = [
        { version: 'v1.0', updateComponents: { surfaceId: 'boxA:main', components: [] } },
        { version: 'v1.0', updateDataModel: { surfaceId: 'boxA:main', path: '/x', value: 1 } },
        { version: 'v1.0', deleteSurface: { surfaceId: 'boxA:main' } },
        { version: 'v1.0', actionResponse: { surfaceId: 'boxA:main', actionId: 'a1', value: true } },
      ]
      const result = enforceSurfacePrefix(sessionA, output)
      expect(result.output).toEqual(output)
      expect(result.rejected).toEqual([])
    })

    it('a cross-prefix update/delete/actionResponse is REJECTED — dropped, not forwarded (AC1)', () => {
      const foreign: A2uiOutput = [
        { version: 'v1.0', updateComponents: { surfaceId: 'boxB:main', components: [] } },
        { version: 'v1.0', updateDataModel: { surfaceId: 'boxB:main', path: '/x', value: 1 } },
        { version: 'v1.0', deleteSurface: { surfaceId: 'boxB:main' } },
        { version: 'v1.0', actionResponse: { surfaceId: 'boxB:main', actionId: 'a1', value: true } },
      ]
      const result = enforceSurfacePrefix(sessionA, foreign)
      expect(result.output).toEqual([])
      expect(result.rejected).toEqual(foreign) // every one dropped, none silently let through
    })

    it('a MIXED batch keeps only the own-namespace messages, rejects the rest, preserving relative order', () => {
      const own: A2uiServerMessage = { version: 'v1.0', updateComponents: { surfaceId: 'boxA:main', components: [] } }
      const foreign: A2uiServerMessage = { version: 'v1.0', updateComponents: { surfaceId: 'boxB:main', components: [] } }
      const result = enforceSurfacePrefix(sessionA, [own, foreign, own])
      expect(result.output).toEqual([own, own])
      expect(result.rejected).toEqual([foreign])
    })

    it('a callFunction envelope (no surfaceId, SPEC-R14) always passes through, prefix or not', () => {
      const callFn: A2uiOutput = [{ version: 'v1.0', functionCallId: 'fc1', callFunction: { call: 'ping' } }]
      expect(enforceSurfacePrefix(sessionA, callFn)).toEqual({ output: callFn, rejected: [] })
      expect(enforceSurfacePrefix(noPrefixSession, callFn)).toEqual({ output: callFn, rejected: [] })
    })

    it('two sessions with distinct prefixes emitting createSurface + updates end up FULLY disjoint (AC1, end to end)', () => {
      const roundA: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } },
        { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Text' }] } },
      ]
      const roundB: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: 'agent-ui' } },
        { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Text' }] } },
      ]
      const resultA = enforceSurfacePrefix(sessionA, roundA)
      const resultB = enforceSurfacePrefix(sessionB, roundB)
      const surfaceIdOf = (m: A2uiOutput[number]): string =>
        'createSurface' in m ? m.createSurface.surfaceId : 'updateComponents' in m ? m.updateComponents.surfaceId : ''
      const idsA = resultA.output.map(surfaceIdOf)
      const idsB = resultB.output.map(surfaceIdOf)
      // create + populate reference the SAME logical surface within a round — one distinct id per
      // producer (paired correctly, not four), and the two producers' ids never collide despite the
      // model authoring the IDENTICAL bare id ("main") in both rounds.
      expect(new Set(idsA).size).toBe(1)
      expect(new Set(idsB).size).toBe(1)
      expect(idsA[0]).toBe('boxA:main')
      expect(idsB[0]).toBe('boxB:main')
      expect(idsA[0]).not.toBe(idsB[0])
      expect(resultA.rejected).toEqual([])
      expect(resultB.rejected).toEqual([])
    })
  })
})
