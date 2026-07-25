// validate-genui-surface.test.ts — genui-surface.spec.md SPEC-R10/R11: a dedicated unit test for
// `validateGenuiSurface` (`tools/agent/chat-validation.ts`, shared by both HTTP transports), the pure
// fail-closed shape guard that keeps a crafted/malformed `genui` body field from ever reaching
// `buildSystemPrompt` raw — the `validate-mode.test.ts` precedent, applied to this NEW boundary field.

import { describe, it, expect } from 'vitest'
import { validateGenuiSurface } from '../../tools/agent/dev-proxy-plugin.ts'

describe('validateGenuiSurface (genui-surface SPEC-R10/R11 — the boundary shape guard)', () => {
  it('accepts a well-formed {enabled:true, sourceBody} and returns it unchanged', () => {
    expect(validateGenuiSurface({ enabled: true, sourceBody: 'exemplar body' })).toEqual({ enabled: true, sourceBody: 'exemplar body' })
  })

  it('accepts {enabled:true} with no sourceBody', () => {
    expect(validateGenuiSurface({ enabled: true })).toEqual({ enabled: true })
  })

  it('accepts {enabled:false} — the degradation law', () => {
    expect(validateGenuiSurface({ enabled: false })).toEqual({ enabled: false })
  })

  it('rejects a missing/non-boolean enabled, returning undefined (never throws, never a 400)', () => {
    expect(validateGenuiSurface({})).toBeUndefined()
    expect(validateGenuiSurface({ enabled: 'true' })).toBeUndefined()
    expect(validateGenuiSurface({ enabled: 1 })).toBeUndefined()
  })

  it('drops a non-string sourceBody but keeps enabled (a per-field degrade, never the whole object)', () => {
    expect(validateGenuiSurface({ enabled: true, sourceBody: 42 })).toEqual({ enabled: true })
  })

  it('drops an over-cap sourceBody (16 KB) but keeps enabled', () => {
    const overCap = 'x'.repeat(16_384 + 1)
    expect(validateGenuiSurface({ enabled: true, sourceBody: overCap })).toEqual({ enabled: true })
  })

  it('accepts a sourceBody of exactly the 16 KB cap', () => {
    const atCap = 'x'.repeat(16_384)
    expect(validateGenuiSurface({ enabled: true, sourceBody: atCap })).toEqual({ enabled: true, sourceBody: atCap })
  })

  it('rejects non-object/array/null values, returning undefined', () => {
    expect(validateGenuiSurface(undefined)).toBeUndefined()
    expect(validateGenuiSurface(null)).toBeUndefined()
    expect(validateGenuiSurface('nope')).toBeUndefined()
    expect(validateGenuiSurface(123)).toBeUndefined()
    expect(validateGenuiSurface([])).toBeUndefined()
  })
})
