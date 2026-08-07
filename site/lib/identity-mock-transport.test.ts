// identity-mock-transport.test.ts — X1's own unit suite (identity-mock-transport.spec.md v0.1, S1
// scope: SPEC-R1/R5/R6/R7/R8/R10). Every AC named below is the SPEC's own numbering, so a reviewer can
// cross-check this file against the SPEC directly.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdentityMockTransport, IdentityMockError } from './identity-mock-transport.ts'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (build-key-safety.test.ts precedent)
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (p: string): string => readFileSync(`${ROOT}/${p}`, 'utf8') as string

// Strip comments before grepping so a doc-comment that DISCUSSES the forbidden calls (this file's own
// header does, deliberately) is never mistaken for a real call site (build-key-safety.test.ts precedent).
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const SEEDED = { email: 'demo@agent-ui.dev', password: 'Passw0rd!' }

afterEach(() => {
  vi.useRealTimers()
})

// ── SPEC-R1 — register / signInWithPassword ─────────────────────────────────────────────────────────

describe('SPEC-R1 — register / signInWithPassword', () => {
  it('AC1: signInWithPassword against the seeded demo account resolves session.method === "password"', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const { session } = await transport.signInWithPassword(SEEDED)
    expect(session.method).toBe('password')
    expect(session.email).toBe(SEEDED.email)
  })

  it('AC2: register with an already-seeded email rejects account-exists', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    await expect(transport.register(SEEDED)).rejects.toMatchObject({ code: 'account-exists' })
  })

  it('AC2: register with an email already registered THIS session also rejects account-exists', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const fresh = { email: 'new-user@example.com', password: 'hunter2!!' }
    await transport.register(fresh)
    await expect(transport.register(fresh)).rejects.toMatchObject({ code: 'account-exists' })
  })

  it('AC3: a freshly registered account is immediately usable via signInWithPassword — same page lifetime, no reload', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const fresh = { email: 'new-user@example.com', password: 'hunter2!!' }
    await transport.register(fresh)
    const { session } = await transport.signInWithPassword(fresh)
    expect(session.email).toBe(fresh.email)
  })

  it('AC4: a wrong password rejects invalid-credentials', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    await expect(transport.signInWithPassword({ email: SEEDED.email, password: 'wrong' })).rejects.toMatchObject({
      code: 'invalid-credentials',
    })
  })

  it('AC4: an unknown email ALSO rejects invalid-credentials — the same code, never distinguished from a wrong password', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const unknown = transport.signInWithPassword({ email: 'nobody@example.com', password: 'whatever' })
    const wrongPassword = transport.signInWithPassword({ email: SEEDED.email, password: 'wrong' })
    const [a, b] = await Promise.allSettled([unknown, wrongPassword])
    expect(a.status).toBe('rejected')
    expect(b.status).toBe('rejected')
    const codeOf = (r: PromiseSettledResult<unknown>): unknown => (r as PromiseRejectedResult).reason
    expect((codeOf(a) as IdentityMockError).code).toBe('invalid-credentials')
    expect((codeOf(b) as IdentityMockError).code).toBe('invalid-credentials')
    // Negative control: the messages never leak which branch fired either — same generic text both times.
    expect((codeOf(a) as IdentityMockError).message).toBe((codeOf(b) as IdentityMockError).message)
  })

  it('every rejection is a real IdentityMockError instance (SPEC-R8 AC1) — never a bare Error, never a string throw', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    try {
      await transport.signInWithPassword({ email: 'nobody@example.com', password: 'x' })
      expect.unreachable('expected a rejection')
    } catch (err) {
      expect(err).toBeInstanceOf(IdentityMockError)
      expect(err).toBeInstanceOf(Error)
    }
  })
})

// ── SPEC-R5 — session state read / clear ────────────────────────────────────────────────────────────

describe('SPEC-R5 — getSession / clearSession', () => {
  it('AC1: a fresh transport instance starts with no session', () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    expect(transport.getSession()).toBeNull()
  })

  it('AC2: a successful signInWithPassword sets the transport\'s own current session as a side effect', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const { session } = await transport.signInWithPassword(SEEDED)
    expect(transport.getSession()).toEqual(session)
  })

  it('AC2: a successful register ALSO sets the current session (no separate log-in step needed)', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    const fresh = { email: 'new-user@example.com', password: 'hunter2!!' }
    const { session } = await transport.register(fresh)
    expect(transport.getSession()).toEqual(session)
  })

  it('AC3: clearSession signs out — getSession subsequently returns null', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    await transport.signInWithPassword(SEEDED)
    expect(transport.getSession()).not.toBeNull()
    transport.clearSession()
    expect(transport.getSession()).toBeNull()
  })
})

// ── SPEC-R6 — determinism & seed data ───────────────────────────────────────────────────────────────

describe('SPEC-R6 — determinism & seed data', () => {
  it('AC1: createIdentityMockTransport() with no arguments reaches the seeded demo account with no prior register', async () => {
    const transport = createIdentityMockTransport()
    await expect(transport.signInWithPassword(SEEDED)).resolves.toBeDefined()
  })

  it('AC2: two fresh instances with the SAME options produce byte-identical accountId sequences for the same call order (no Math.random/crypto anywhere)', async () => {
    const callOrder = async (transport: ReturnType<typeof createIdentityMockTransport>): Promise<string[]> => {
      const ids: string[] = []
      for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
        const { session } = await transport.register({ email, password: 'pw' })
        ids.push(session.accountId)
      }
      return ids
    }
    const first = await callOrder(createIdentityMockTransport({ latencyMs: 0 }))
    const second = await callOrder(createIdentityMockTransport({ latencyMs: 0 }))
    expect(first).toEqual(second)
    expect(first).toEqual(['acct-0002', 'acct-0003', 'acct-0004']) // after the one seeded account
  })

  it('AC2 (source-grep): no Math.random() or crypto.getRandomValues() call site anywhere in this transport\'s own source', () => {
    const source = stripComments(read('site/lib/identity-mock-transport.ts'))
    expect(source).not.toMatch(/Math\.random\(/)
    expect(source).not.toMatch(/crypto\.getRandomValues\(/)
  })

  it('AC3: an overridden `accounts` option reflects in signInWithPassword/getSession behavior', async () => {
    const custom = createIdentityMockTransport({
      accounts: [{ email: 'owner@example.com', password: 'letmein', accountId: 'owner-1' }],
      latencyMs: 0,
    })
    await expect(custom.signInWithPassword(SEEDED)).rejects.toMatchObject({ code: 'invalid-credentials' })
    const { session } = await custom.signInWithPassword({ email: 'owner@example.com', password: 'letmein' })
    expect(session.accountId).toBe('owner-1')
  })

  it('no cross-instance state: registering on one instance never reaches a sibling instance (SPEC-N3, no shared/global state)', async () => {
    const first = createIdentityMockTransport({ latencyMs: 0 })
    const second = createIdentityMockTransport({ latencyMs: 0 })
    await first.register({ email: 'only-on-first@example.com', password: 'pw' })
    await expect(second.signInWithPassword({ email: 'only-on-first@example.com', password: 'pw' })).rejects.toMatchObject({
      code: 'invalid-credentials',
    })
  })
})

// ── SPEC-R7 — latency simulation ────────────────────────────────────────────────────────────────────

describe('SPEC-R7 — latency simulation', () => {
  it('AC1: the default nonzero latency leaves the op pending past the next microtask tick, then resolves after the delay', async () => {
    vi.useFakeTimers()
    const transport = createIdentityMockTransport() // default latencyMs (400)
    let resolved = false
    const op = transport.signInWithPassword(SEEDED).then((r) => {
      resolved = true
      return r
    })
    await vi.advanceTimersByTimeAsync(0) // flush pending microtasks only — no real/fake wall-clock time yet
    expect(resolved, 'the op must still be pending immediately after the call — no synchronous resolve').toBe(false)
    await vi.advanceTimersByTimeAsync(400)
    await op
    expect(resolved).toBe(true)
  })

  it('AC2: latencyMs:0 can be awaited directly with no fake-timer advance required', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    await expect(transport.signInWithPassword(SEEDED)).resolves.toBeDefined()
  })
})

// ── SPEC-R8 — closed error vocabulary ───────────────────────────────────────────────────────────────

describe('SPEC-R8 — closed error vocabulary (S1 slice)', () => {
  it('account-exists never fires from signInWithPassword; invalid-credentials never fires from register (no cross-op meaning overlap)', async () => {
    const transport = createIdentityMockTransport({ latencyMs: 0 })
    await expect(transport.signInWithPassword({ email: 'nobody@example.com', password: 'x' })).rejects.toMatchObject({
      code: 'invalid-credentials',
    })
    await expect(transport.register(SEEDED)).rejects.toMatchObject({ code: 'account-exists' })
  })
})

// ── SPEC-R10 — home: site-local, never a package export ────────────────────────────────────────────

describe('SPEC-R10 — home (site-local, no package export)', () => {
  it('AC1: the file resolves at site/lib/identity-mock-transport.ts', () => {
    expect(() => read('site/lib/identity-mock-transport.ts')).not.toThrow()
  })

  it('AC1: no packages/agent-ui/*/package.json exports map references it', () => {
    const packagesDir = `${ROOT}/packages/agent-ui`
    const packages = (readdirSync(packagesDir) as string[]).filter((name) => name !== '.DS_Store')
    expect(packages.length).toBeGreaterThan(0) // anti-vacuous
    for (const pkg of packages) {
      const pkgJsonPath = `packages/agent-ui/${pkg}/package.json`
      let text: string
      try {
        text = read(pkgJsonPath)
      } catch {
        continue // not every entry under packages/agent-ui is itself a package (defense; all are today)
      }
      expect(text, `${pkgJsonPath} must never reference identity-mock-transport`).not.toContain('identity-mock-transport')
    }
  })
})
