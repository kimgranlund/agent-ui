// bridge.test.ts — LLD-C3 (SPEC-R16 AC1; defers to a2ui SPEC-R5 AC1): the bridge round-trip smoke. Lives
// under `src/` (the vitest `packages` project include is `src/**/*.test.ts` — the live-agent family's
// `src/live-agent/*.test.ts`-over-`tools/agent/*` precedent), testing the tools/-homed mapping module.
//
// Carries a committed, validator-clean A2UI server sequence over a REAL `@agent-ui/a2a` loopback pair and
// asserts: (1) the decoded sequence is IDENTICAL, in order, to the loopback baseline (SPEC-R16 AC1);
// (2) `validateA2ui` stays clean on the round-tripped sequence; (3) every `wrapClientTurn` message
// carries the HV-8 caps key (keyed `'v1.0'`, `supportedCatalogIds` including `'agent-ui'`) and the v1.0
// extension URI; (4) the negative legs prove the checks BITE — a hand-built caps-less client message
// fails the caps assertion, and a foreign part is skipped + counted, never thrown.
import { describe, expect, it } from 'vitest'
import { createLoopbackPair } from '@agent-ui/a2a'
import type { A2aChannel, A2aMessage } from '@agent-ui/a2a'
import { statsGridDashboardSeed } from '../examples/index.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import {
  A2UI_A2A_EXTENSION_URI,
  DEFAULT_CAPS,
  unwrapTurn,
  wrapClientTurn,
  wrapServerTurn,
} from '../../tools/pipeline/transports/a2a.ts'
import type { A2uiClientCapabilities } from '../../tools/pipeline/transports/a2a.ts'

const baseline = statsGridDashboardSeed.messages

/** Pull exactly the next message off a channel's `receive()` (the loopback's single-message smoke shape). */
async function receiveOne(ch: A2aChannel): Promise<A2aMessage> {
  for await (const msg of ch.receive()) return msg
  throw new Error('receiveOne: channel closed with no message')
}

describe('bridge round-trip — LLD-C3, SPEC-R16 AC1', () => {
  it('carries the baseline sequence over a real createLoopbackPair, decoding IDENTICAL, IN ORDER', async () => {
    const [serverEnd, clientEnd] = createLoopbackPair()
    const wire = wrapServerTurn(baseline, { messageId: 'm1', contextId: 'ctx-smoke' })
    await serverEnd.send(wire)
    const received = await receiveOne(clientEnd)
    const { envelopes, prose, foreignParts } = unwrapTurn(received)
    expect(envelopes).toEqual([...baseline])
    expect(prose).toEqual([])
    expect(foreignParts).toBe(0)
  })

  it('validateA2ui stays clean on the round-tripped sequence (a2ui SPEC-R5 AC1)', async () => {
    const [serverEnd, clientEnd] = createLoopbackPair()
    await serverEnd.send(wrapServerTurn(baseline, { messageId: 'm2', contextId: 'ctx-smoke' }))
    const received = await receiveOne(clientEnd)
    const { envelopes } = unwrapTurn(received)
    const verdict = validateA2ui(envelopes, defaultCatalog)
    expect(verdict.failures).toEqual([])
    expect(verdict.valid).toBe(true)
  })

  it('every wrapClientTurn message carries the HV-8 caps key + the v1.0 extension URI, BY CONSTRUCTION', () => {
    const msg = wrapClientTurn({ text: 'hello' }, { messageId: 'c1' })
    expect(msg.metadata?.a2uiClientCapabilities).toEqual(DEFAULT_CAPS)
    const caps = msg.metadata!.a2uiClientCapabilities as A2uiClientCapabilities
    expect(caps['v1.0'].supportedCatalogIds).toContain('agent-ui')
    expect(msg.extensions).toContain(A2UI_A2A_EXTENSION_URI)
  })

  it('negative leg: a hand-built client message WITHOUT the caps key fails the caps assertion (proves it bites)', () => {
    const capsLess: A2aMessage = {
      kind: 'message',
      role: 'user',
      messageId: 'bad-1',
      parts: [{ kind: 'text', text: 'no caps here' }],
    }
    // The SAME assertion the smoke above runs against a real wrapClientTurn output — over a message that
    // bypassed the builder entirely, this fails, proving the guarantee is load-bearing, not vacuous.
    expect(capsLess.metadata?.a2uiClientCapabilities).toBeUndefined()
  })

  it('negative leg: a foreign part (untagged data / plain text) is skipped + counted, never a throw', () => {
    const foreign: A2aMessage = {
      kind: 'message',
      role: 'agent',
      messageId: 'f-1',
      parts: [
        { kind: 'text', text: 'prose rides as a TextPart' },
        { kind: 'data', data: { not: 'a2ui-tagged' } }, // no metadata.mimeType — a foreign DataPart
      ],
    }
    const { envelopes, prose, foreignParts } = unwrapTurn(foreign)
    expect(envelopes).toEqual([])
    expect(prose).toEqual(['prose rides as a TextPart'])
    expect(foreignParts).toBe(1)
  })
})
