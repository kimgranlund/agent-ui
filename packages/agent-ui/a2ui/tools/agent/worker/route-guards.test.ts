// route-guards.test.ts — GH #112: direct, cheap coverage for the Worker's pure request predicates.
// route-guards.ts was split out of index.ts SPECIFICALLY to be safely importable here (its own header) —
// index.ts and process-shim.ts stay untested in this project (process-shim.ts's global `process.cwd()`
// override must never leak into a shared test process).
import { describe, it, expect } from 'vitest'
import { isSameOriginRequest, isMountedPath, isValidTurnInput } from './route-guards.ts'

const ALLOWED = 'https://ui.nonoun.io'

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://ui.nonoun.io/__a2ui/agent', { method: 'POST', headers })
}

describe('isSameOriginRequest — GH #101 CSRF guard', () => {
  it('accepts a matching Origin header', () => {
    expect(isSameOriginRequest(req({ origin: ALLOWED }), ALLOWED)).toBe(true)
  })

  it('rejects a mismatched Origin header, even if Referer would match', () => {
    expect(isSameOriginRequest(req({ origin: 'https://evil.example', referer: `${ALLOWED}/page` }), ALLOWED)).toBe(false)
  })

  it('falls back to Referer only when Origin is absent', () => {
    expect(isSameOriginRequest(req({ referer: `${ALLOWED}/some/page` }), ALLOWED)).toBe(true)
  })

  it('rejects a Referer that merely starts with the allowed origin as a substring (not path-bounded)', () => {
    expect(isSameOriginRequest(req({ referer: 'https://ui.nonoun.io.evil.example/' }), ALLOWED)).toBe(false)
  })

  it('rejects when NEITHER Origin nor Referer is present — a real browser fetch() always sends one', () => {
    expect(isSameOriginRequest(req(), ALLOWED)).toBe(false)
  })

  it('rejects a cross-origin Referer', () => {
    expect(isSameOriginRequest(req({ referer: 'https://evil.example/' }), ALLOWED)).toBe(false)
  })
})

describe('isMountedPath — GH #109 exact/segment-bounded prefix match', () => {
  const MOUNT = '/__a2ui/agent'

  it('matches the bare mount exactly', () => {
    expect(isMountedPath(MOUNT, MOUNT)).toBe(true)
  })

  it('matches a real sub-path', () => {
    expect(isMountedPath('/__a2ui/agent/status', MOUNT)).toBe(true)
    expect(isMountedPath('/__a2ui/agent/chat', MOUNT)).toBe(true)
  })

  it('does NOT match a same-prefix sibling with no path boundary (the regression this fixed)', () => {
    expect(isMountedPath('/__a2ui/agentXYZ', MOUNT)).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(isMountedPath('/other', MOUNT)).toBe(false)
  })
})

describe('isValidTurnInput — GH #103 pre-first-yield shape guard', () => {
  it('accepts a well-formed intent turn input', () => {
    expect(isValidTurnInput({ kind: 'intent', session: { turns: [] } })).toBe(true)
  })

  it('accepts a well-formed client turn input', () => {
    expect(isValidTurnInput({ kind: 'client', session: { turns: [{ some: 'turn' }] } })).toBe(true)
  })

  it('rejects null/non-object input', () => {
    expect(isValidTurnInput(null)).toBe(false)
    expect(isValidTurnInput('a string')).toBe(false)
    expect(isValidTurnInput(42)).toBe(false)
  })

  it('rejects an unknown kind', () => {
    expect(isValidTurnInput({ kind: 'bogus', session: { turns: [] } })).toBe(false)
  })

  it('rejects a missing/malformed session', () => {
    expect(isValidTurnInput({ kind: 'intent' })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', session: null })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', session: 'nope' })).toBe(false)
  })

  it('rejects a session whose turns is not an array', () => {
    expect(isValidTurnInput({ kind: 'intent', session: { turns: 'nope' } })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', session: {} })).toBe(false)
  })
})
