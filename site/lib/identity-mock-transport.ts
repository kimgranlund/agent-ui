// site/lib/identity-mock-transport.ts — X1: the identity-mock-transport seam
// (.claude/docs/spec/identity-mock-transport.spec.md v0.1, GH #490 / ADR-0176 cl.2). DEMO-ONLY
// (SPEC-N1): no real auth backend, no real crypto (SPEC-N2), no cross-reload persistence (SPEC-N3),
// never catalog/A2UI-reachable (SPEC-N4), never a package export (SPEC-N5 / SPEC-R10) — this file
// lives site-local, the same directory contract `admin-live-runner.ts` / `live-proxy-transport.ts`
// already establish for site-owned infrastructure a docs-site PAGE injects, never crossing a package
// boundary (SPEC-R10 AC1/AC2).
//
// SCOPE (this S1 build): SPEC-R1 (register/signInWithPassword), SPEC-R5 (getSession/clearSession),
// SPEC-R6 (seed/determinism), SPEC-R7 (latency simulation), and the S1 slice of SPEC-R8's closed error
// vocabulary (`account-exists` / `invalid-credentials` only — the two codes SPEC-R1's own ACs name).
// SPEC-R2 (codes) / SPEC-R3 (magic link) / SPEC-R4 (social) are S2/S3's own future builds — per
// SPEC-R11's extension rule, they widen `IdentityMockTransport` (new methods) and
// `IdentityMockErrorCode` (new members) in THIS SAME file when those slices dispatch, never a second
// interface, never re-derived. The `code`/`cooldownMs`/`expiresInMs` options below are already part of
// `IdentityMockTransportOptions` per SPEC-R6's full shape — so S2 never has to widen the OPTIONS
// contract later — even though no S1 op reads them yet (SPEC route note: "S2... consumes SPEC-R2/R3
// WHEN IT DISPATCHES").
//
// Determinism (SPEC-R6 AC2): no Math.random()/crypto.getRandomValues anywhere below — every id is a
// plain incrementing counter, seeded fresh per instance (identity-mock-transport.test.ts's own
// source-grep probe gates this).

/** One seeded or registered account (SPEC-R6). Plain string comparison only — no hashing (SPEC-N2). */
export interface DemoAccount {
  email: string
  password: string
  accountId: string
}

/** A signed-in session (SPEC-R1 AC1 / SPEC-R5). `method` carries the FULL future union (the SPEC §5
 *  typed contract) even though S1 only ever produces `'password'` — S2/S3 produce the other members
 *  through this SAME session shape when their own ops land, so this type needs no widening then. */
export interface IdentitySession {
  accountId: string
  email: string
  method: 'password' | 'code' | 'magic-link' | 'social'
}

/** The S1 slice of SPEC-R8's closed error vocabulary. S2/S3 APPEND new members here (never redefine an
 *  existing one) when `requestOneTimeCode`/`verifyOneTimeCode`/`confirmMagicLink`/`completeSocialSignIn`
 *  land (SPEC-R11's additive-only extension rule). */
export type IdentityMockErrorCode = 'account-exists' | 'invalid-credentials'

/** SPEC-R8 — every rejection from this transport is an `IdentityMockError` carrying exactly one closed
 *  `code`, never a bare `Error` and never a string throw. */
export class IdentityMockError extends Error {
  readonly code: IdentityMockErrorCode
  constructor(code: IdentityMockErrorCode, message: string) {
    super(message)
    this.name = 'IdentityMockError'
    this.code = code
  }
}

/** SPEC-R6 — every default overridable via one options object at construction. */
export interface IdentityMockTransportOptions {
  /** Default: one pre-seeded demo account (`demo@agent-ui.dev` / `Passw0rd!`), reachable via
   *  `signInWithPassword` without a prior `register` call (SPEC-R6 AC1). */
  accounts?: DemoAccount[]
  /** Default: `'424242'` — the fixed predictable one-time code S2's `verifyOneTimeCode` reads (SPEC-R2);
   *  unread by any S1 op, carried here now so S2 never widens this options contract. */
  code?: string
  /** Default: `400` — `0` is a legal override for fast, deterministic test runs (SPEC-R7 AC2). */
  latencyMs?: number
  /** Default: `30_000` — the resend rate-limit window S2's `requestOneTimeCode` reads (SPEC-R2 AC4);
   *  unread by any S1 op. */
  cooldownMs?: number
  /** Default: `300_000` (5 min) — code/magic-link request expiry S2 reads (SPEC-R2/SPEC-R3); unread by
   *  any S1 op. */
  expiresInMs?: number
}

/** SPEC-R1/R5 — S1's slice of the full seam (SPEC §5's typed contract). S2 (SPEC-R2/R3) and S3
 *  (SPEC-R4) widen this SAME interface with new methods when they dispatch (SPEC-R11) — never a
 *  second, parallel interface. */
export interface IdentityMockTransport {
  register(input: { email: string; password: string }): Promise<{ session: IdentitySession }>
  signInWithPassword(input: { email: string; password: string }): Promise<{ session: IdentitySession }>
  getSession(): IdentitySession | null
  clearSession(): void
}

const DEFAULT_ACCOUNTS: readonly DemoAccount[] = [{ email: 'demo@agent-ui.dev', password: 'Passw0rd!', accountId: 'demo-0001' }]
const DEFAULT_LATENCY_MS = 400

/** SPEC-R7 — every op resolves only after `latencyMs` (0 legal for tests, AC2). A REAL `setTimeout`
 *  (not an injected clock): S1's ops have no expiry/cooldown to fake-advance — a fake clock is S2's own
 *  need (SPEC-R2 AC4's cooldown probe), not built here. */
function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * createIdentityMockTransport — SPEC-R6: a fresh, deterministic, in-memory fake per call. No shared
 * module-level state between instances (SPEC-N3 — no cross-reload/cross-instance persistence); every
 * account/session this instance adds lives in its own closure only.
 */
export function createIdentityMockTransport(options: IdentityMockTransportOptions = {}): IdentityMockTransport {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS
  // Deep-copy the seed so mutating THIS instance's accounts never reaches a sibling instance or the
  // caller's own options object (SPEC-R6 AC2's determinism proof depends on each instance starting from
  // an untouched seed).
  const accounts: DemoAccount[] = (options.accounts ?? DEFAULT_ACCOUNTS).map((account) => ({ ...account }))
  let nextAccountSeq = accounts.length + 1
  let session: IdentitySession | null = null

  function findAccount(email: string): DemoAccount | undefined {
    return accounts.find((account) => account.email === email)
  }

  return {
    async register({ email, password }) {
      await delay(latencyMs)
      if (findAccount(email) !== undefined) {
        throw new IdentityMockError('account-exists', `An account already exists for ${email}.`)
      }
      const accountId = `acct-${String(nextAccountSeq).padStart(4, '0')}`
      nextAccountSeq += 1
      accounts.push({ email, password, accountId })
      const next: IdentitySession = { accountId, email, method: 'password' }
      session = next
      return { session: next }
    },

    async signInWithPassword({ email, password }) {
      await delay(latencyMs)
      const account = findAccount(email)
      // SPEC-R1 AC4 — an unknown email and a wrong password are NEVER distinguished, in the code or the
      // message: one vocabulary member, one generic message, for both branches.
      if (account === undefined || account.password !== password) {
        throw new IdentityMockError('invalid-credentials', 'Incorrect email or password.')
      }
      const next: IdentitySession = { accountId: account.accountId, email: account.email, method: 'password' }
      session = next
      return { session: next }
    },

    getSession() {
      return session
    },

    clearSession() {
      session = null
    },
  }
}
