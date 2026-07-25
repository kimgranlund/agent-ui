// validate-effort.test.ts — a dedicated unit test for `validateEffort` (`tools/agent/chat-validation.ts`,
// shared by both HTTP transports), the pure fail-closed membership guard that keeps a crafted/malformed
// `effort` body field from ever reaching `deps.provider.stream` raw — the `validate-mode.test.ts` /
// `validate-genui-surface.test.ts` precedent, applied to this NEW boundary field (the produce()-route
// threading of the reasoning-effort dial `AgentProvider.stream` already supports).

import { describe, it, expect } from 'vitest'
import { validateEffort } from '../../tools/agent/dev-proxy-plugin.ts'

describe('validateEffort (the reasoning-effort dial — the boundary membership guard)', () => {
  it('accepts each of the four valid effort strings and returns it unchanged', () => {
    expect(validateEffort('low')).toBe('low')
    expect(validateEffort('medium')).toBe('medium')
    expect(validateEffort('high')).toBe('high')
    expect(validateEffort('xhigh')).toBe('xhigh')
  })

  it('rejects an unrecognized string, returning undefined (never throws, never a 400)', () => {
    expect(validateEffort('extreme')).toBeUndefined()
    expect(validateEffort('')).toBeUndefined()
  })

  it('rejects a non-string value, returning undefined', () => {
    expect(validateEffort(123)).toBeUndefined()
    expect(validateEffort(null)).toBeUndefined()
    expect(validateEffort({})).toBeUndefined()
  })

  it('rejects undefined itself, returning undefined', () => {
    expect(validateEffort(undefined)).toBeUndefined()
  })
})
