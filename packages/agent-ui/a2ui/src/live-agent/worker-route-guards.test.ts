// worker-route-guards.test.ts — GH #112: the Worker's route-guard predicates (route-guards.ts) are pure
// and side-effect-free by design specifically so they're safe to test here, in the shared jsdom process.
// The rest of worker/index.ts is NOT safe to import into this process — its first import,
// process-shim.ts, globally overrides `process.cwd()` (correct inside the real Workers isolate; it would
// silently corrupt every other test in this run if imported here, since `process` is a real Node global,
// not something vitest's per-file module isolation resets). Full route-dispatch/integration coverage
// needs a real Workers runtime (`@cloudflare/vitest-pool-workers`, a separate pool/config) — not set up
// yet; this file covers what's safely testable today, and the live-agent proxy is additionally verified
// against the real deployed Worker on every change (see PR #81's test plan).

import { describe, it, expect } from 'vitest'
import { isSameOriginRequest, isMountedPath, isValidTurnInput } from '../../tools/agent/worker/route-guards.ts'

const ORIGIN = 'https://ui.nonoun.io'

describe('isSameOriginRequest (GH #101 — the CSRF guard)', () => {
  it('allows a request whose Origin header matches exactly', () => {
    const req = new Request('https://ui.nonoun.io/__a2ui/agent', { headers: { origin: ORIGIN } })
    expect(isSameOriginRequest(req, ORIGIN)).toBe(true)
  })

  it('rejects a request whose Origin header is a different origin (the drive-by CSRF case)', () => {
    const req = new Request('https://ui.nonoun.io/__a2ui/agent', { headers: { origin: 'https://evil.example.com' } })
    expect(isSameOriginRequest(req, ORIGIN)).toBe(false)
  })

  it('falls back to Referer when Origin is absent, matching the exact origin or a path under it', () => {
    const req1 = new Request('https://ui.nonoun.io/__a2ui/agent', { headers: { referer: `${ORIGIN}/a2ui-live.html` } })
    expect(isSameOriginRequest(req1, ORIGIN)).toBe(true)
    const req2 = new Request('https://ui.nonoun.io/__a2ui/agent', { headers: { referer: 'https://evil.example.com/' } })
    expect(isSameOriginRequest(req2, ORIGIN)).toBe(false)
  })

  it('rejects a request with neither header — a real browser fetch() always sends at least one', () => {
    const req = new Request('https://ui.nonoun.io/__a2ui/agent')
    expect(isSameOriginRequest(req, ORIGIN)).toBe(false)
  })

  it('a Referer that merely STARTS WITH the allowed origin as a substring (not path-bounded) is rejected', () => {
    // e.g. https://ui.nonoun.io.evil.example.com/ must NOT pass — guards against a naive `.startsWith(origin)`
    const req = new Request('https://ui.nonoun.io/__a2ui/agent', {
      headers: { referer: 'https://ui.nonoun.io.evil.example.com/' },
    })
    expect(isSameOriginRequest(req, ORIGIN)).toBe(false)
  })
})

describe('isMountedPath (GH #109 — the mount boundary)', () => {
  const MOUNT = '/__a2ui/agent'

  it('matches the exact mount', () => {
    expect(isMountedPath(MOUNT, MOUNT)).toBe(true)
  })

  it('matches a subpath under the mount', () => {
    expect(isMountedPath('/__a2ui/agent/status', MOUNT)).toBe(true)
    expect(isMountedPath('/__a2ui/agent/chat', MOUNT)).toBe(true)
  })

  it('does NOT match a path merely prefixed by the mount string with no boundary', () => {
    expect(isMountedPath('/__a2ui/agentXYZ', MOUNT)).toBe(false)
    expect(isMountedPath('/__a2ui/agent-docs', MOUNT)).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(isMountedPath('/index.html', MOUNT)).toBe(false)
  })
})

describe('isValidTurnInput (GH #103 — closes the silent-empty-200 gap)', () => {
  it('accepts a well-formed intent turn', () => {
    expect(isValidTurnInput({ kind: 'intent', text: 'hello', session: { turns: [] } })).toBe(true)
  })

  it('accepts a well-formed client-message turn', () => {
    expect(isValidTurnInput({ kind: 'client', message: {}, session: { turns: [{ role: 'user', content: 'hi' }] } })).toBe(true)
  })

  it('rejects null, undefined, and non-object input', () => {
    expect(isValidTurnInput(null)).toBe(false)
    expect(isValidTurnInput(undefined)).toBe(false)
    expect(isValidTurnInput('not an object')).toBe(false)
    expect(isValidTurnInput(42)).toBe(false)
  })

  it('rejects a missing or invalid kind', () => {
    expect(isValidTurnInput({ session: { turns: [] } })).toBe(false)
    expect(isValidTurnInput({ kind: 'bogus', session: { turns: [] } })).toBe(false)
  })

  it('rejects a missing or malformed session', () => {
    expect(isValidTurnInput({ kind: 'intent', text: 'hi' })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', text: 'hi', session: null })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', text: 'hi', session: 'not an object' })).toBe(false)
  })

  it('rejects a session whose turns is not an array', () => {
    expect(isValidTurnInput({ kind: 'intent', text: 'hi', session: { turns: 'not an array' } })).toBe(false)
    expect(isValidTurnInput({ kind: 'intent', text: 'hi', session: {} })).toBe(false)
  })

  it('rejects an empty body — the exact GH #103 repro (a valid provider/model pair, malformed input)', () => {
    expect(isValidTurnInput({})).toBe(false)
  })
})
