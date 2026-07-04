// provider-dispatch.test.ts — LLD-C8 / SPEC-R11 AC4. The defensive dispatch (`providerFor`): an
// implemented provider yields a live adapter; an unimplemented (or un-wired) provider DEGRADES to a
// distinguishable signal rather than throwing — the proxy treats `{ ok: false }` exactly like the no-key
// path (backbone-only), never an unhandled crash. Deterministic, no network.

import { describe, it, expect } from 'vitest'
import { providerFor } from '../../tools/agent/providers/index.ts'

describe('providerFor defensive dispatch (LLD-C10 / SPEC-R11 AC4)', () => {
  it('returns a live adapter for the implemented provider (anthropic)', () => {
    const r = providerFor('anthropic', { apiKey: 'test-key-not-a-secret' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(typeof r.provider.stream).toBe('function')
  })

  it('DEGRADES (never throws) for an allowlisted-but-unimplemented provider', () => {
    expect(providerFor('openai', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
    expect(providerFor('gemini', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
  })

  it('DEGRADES (never throws) for an unknown / un-wired provider id', () => {
    // The dispatch table can't tell "never heard of it" from "known but un-wired" (the registry-level
    // resolvePair owns that distinction upstream); both degrade — the point is it never crashes.
    expect(providerFor('does-not-exist', { apiKey: 'x' })).toEqual({ ok: false, reason: 'unimplemented' })
  })
})
