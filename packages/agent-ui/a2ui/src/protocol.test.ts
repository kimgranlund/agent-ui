import { describe, it, expect } from 'vitest'
import { toWireError } from './protocol.ts'
import type { A2uiError } from './protocol.ts'

// S1 unit-test for toWireError (ADR-0031 clause 2/3/4). ALL 8 internal codes → VALIDATION_FAILED +
// surfaceId this wave (flow-grounded resolution: our FUNCTION emits are render-time binding-evaluation
// failures, not server-initiated function-call rejections). Internal `path` is folded into `message`;
// the wire object carries NO `path` field. `A2uiWireError` still models both arms (INVALID_FUNCTION_CALL
// is forward-ready for #23) but `toWireError` only emits VALIDATION_FAILED this wave.

describe('toWireError — internal → v1.0 wire mapping (ADR-0031)', () => {
  // ── FUNCTION → VALIDATION_FAILED (the corrected flow-grounded mapping, ADR-0031 clause 2) ──────

  it('FUNCTION → VALIDATION_FAILED + surfaceId (render-time binding-eval failure, not a server-initiated call)', () => {
    // ADR-0031 corrected flow grounding: our FUNCTION emits (unknown/throwing catalog fns in bindings)
    // are message-validation failures — parallel to CATALOG, not the spec's INVALID_FUNCTION_CALL.
    // INVALID_FUNCTION_CALL requires a server-initiated function-call path the repo does not have (#23).
    const internal: A2uiError = {
      code: 'FUNCTION',
      surfaceId: 's1',
      path: 'root', // internal locus (node.id); folded into message, then dropped from wire
      message: 'unknown catalog function "boom"',
    }
    const wire = toWireError(internal)
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('s1')
    expect(wire.message).toContain('boom')
    expect(wire.message).toContain('root') // locus folded in: "(at root)"
    expect(wire).not.toHaveProperty('path') // v1.0 wire shape has NO path field
    expect(wire).not.toHaveProperty('functionCallId') // VALIDATION_FAILED excludes functionCallId (the XOR)
  })

  // ── VALIDATION_FAILED arm — all 8 codes (including FUNCTION) ─────────────────────────────────

  it('PARSE → VALIDATION_FAILED + surfaceId (empty string: PARSE has no surface context)', () => {
    // PARSE has no surfaceId (the line faults before any surface is known) → surfaceId: ''.
    const wire = toWireError({ code: 'PARSE', message: 'Unexpected token { at position 2' })
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('')
    expect(wire.message).toContain('Unexpected token')
    expect(wire).not.toHaveProperty('path')
    expect(wire).not.toHaveProperty('functionCallId') // VALIDATION_FAILED excludes functionCallId (the XOR)
  })

  it('SCHEMA → VALIDATION_FAILED + surfaceId + path folded into message', () => {
    const internal: A2uiError = { code: 'SCHEMA', surfaceId: 'sx', path: 'root/label', message: 'Expected string' }
    const wire = toWireError(internal)
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('sx')
    expect(wire.message).toBe('Expected string (at root/label)') // path folded in
    expect(wire).not.toHaveProperty('path')
    expect(wire).not.toHaveProperty('functionCallId')
  })

  it('CATALOG → VALIDATION_FAILED + surfaceId + path (node.id) folded into message', () => {
    const internal: A2uiError = {
      code: 'CATALOG',
      surfaceId: 's2',
      path: 'unknown-node', // node.id already set by widget.ts
      message: 'unknown component type "Doohickey" in catalog "agent-ui"',
    }
    const wire = toWireError(internal)
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('s2')
    expect(wire.message).toContain('Doohickey')
    expect(wire.message).toContain('unknown-node') // locus folded in: "(at unknown-node)"
    expect(wire).not.toHaveProperty('path')
  })

  it('CATALOG_UNKNOWN → VALIDATION_FAILED + surfaceId (forced mapping: no third bucket)', () => {
    const wire = toWireError({ code: 'CATALOG_UNKNOWN', surfaceId: 's4', message: 'unknown catalogId "no-such"' })
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('s4')
    expect(wire).not.toHaveProperty('functionCallId')
  })

  it('IDGRAPH → VALIDATION_FAILED + surfaceId + path folded into message', () => {
    const internal: A2uiError = {
      code: 'IDGRAPH',
      surfaceId: 's5',
      path: 'leaf', // the missing-root / dangling node
      message: 'id-graph violation: leaf',
    }
    const wire = toWireError(internal)
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('s5')
    expect(wire.message).toContain('leaf')
    expect(wire.message).toContain('at leaf') // path folded in
    expect(wire).not.toHaveProperty('path')
  })

  it('POINTER → VALIDATION_FAILED + surfaceId', () => {
    const wire = toWireError({ code: 'POINTER', surfaceId: 'sp', path: '/missing', message: 'bad pointer' })
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('sp')
    expect(wire.message).toContain('missing') // path "/missing" folded in
    expect(wire).not.toHaveProperty('functionCallId')
  })

  it('VERSION_UNSUPPORTED → VALIDATION_FAILED + surfaceId (forced mapping: no third bucket)', () => {
    const wire = toWireError({ code: 'VERSION_UNSUPPORTED', surfaceId: 'sv', message: 'unsupported version "v0.8"' })
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('sv')
    expect(wire).not.toHaveProperty('functionCallId')
  })

  // ── XOR invariant (structural guarantee of the discriminated union) ───────────────────────────

  it('every toWireError result carries ONLY surfaceId (no functionCallId) — all 8 codes this wave', () => {
    // ALL codes → VALIDATION_FAILED + surfaceId this wave. The INVALID_FUNCTION_CALL arm is modeled
    // by A2uiWireError (forward-ready for #23) but toWireError never produces it at runtime.
    const vf = toWireError({ code: 'SCHEMA', surfaceId: 's', message: 'm' })
    expect('surfaceId' in vf).toBe(true)
    expect('functionCallId' in vf).toBe(false)

    // FUNCTION also → VALIDATION_FAILED (the corrected mapping — render-time binding-eval, not a call)
    const fn = toWireError({ code: 'FUNCTION', surfaceId: 's', message: 'm' })
    expect(fn.code).toBe('VALIDATION_FAILED')
    expect('surfaceId' in fn).toBe(true)
    expect('functionCallId' in fn).toBe(false)
  })

  it('NO path field on the wire object — the path locus is dropped after folding into message', () => {
    // The anti-vacuous check: a path IS present on the internal error (so folding can be verified),
    // but the wire object must NOT carry it.
    const wireVF = toWireError({ code: 'IDGRAPH', surfaceId: 's', path: 'root', message: 'violation' })
    expect(wireVF).not.toHaveProperty('path')

    // FUNCTION with path: path folded into message, not on wire
    const wireFN = toWireError({ code: 'FUNCTION', surfaceId: 's', path: 'n', message: 'err' })
    expect(wireFN).not.toHaveProperty('path')
    expect(wireFN.message).toContain('at n') // locus IS in message
  })
})
