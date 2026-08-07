// site/lib/identity-mock-transport.ts — X1: the identity-mock-transport seam
// (.claude/docs/spec/identity-mock-transport.spec.md v0.1, GH #490 / ADR-0176 cl.2). DEMO-ONLY
// (SPEC-N1): no real auth backend, no real crypto (SPEC-N2), no cross-reload persistence (SPEC-N3),
// never catalog/A2UI-reachable (SPEC-N4), never a package export (SPEC-N5 / SPEC-R10) — this file
// lives site-local, the same directory contract `admin-live-runner.ts` / `live-proxy-transport.ts`
// already establish for site-owned infrastructure a docs-site PAGE injects, never crossing a package
// boundary (SPEC-R10 AC1/AC2).
//
// SCOPE (S1 build): SPEC-R1 (register/signInWithPassword), SPEC-R5 (getSession/clearSession),
// SPEC-R6 (seed/determinism), SPEC-R7 (latency simulation), and the S1 slice of SPEC-R8's closed error
// vocabulary (`account-exists` / `invalid-credentials`).
// SCOPE (S2 build, per SPEC-R11's extension rule — widens THIS SAME file, never a second interface):
// SPEC-R2 (`requestOneTimeCode`/`verifyOneTimeCode` — the SAME method serves "request" AND "resend",
// SPEC-R2's own text) and SPEC-R3 (`requestMagicLink`/`confirmMagicLink`), plus their S2 slice of
// SPEC-R8's vocabulary (`code-invalid`/`code-expired`/`code-rate-limited`/`link-expired`/
// `link-invalid`). `verifyOneTimeCode`/`confirmMagicLink` consume `code`/`cooldownMs`/`expiresInMs`
// from `IdentityMockTransportOptions` for the first time — S1 shipped those fields unread, exactly so
// S2 never had to widen the OPTIONS contract (S1's own header note). SPEC-R4 (social) is S3's own
// future build.
//
// Two S2-local implementation choices the SPEC itself leaves open (mechanical fill-in over an
// already-ratified contract, not new design — see identity-mock-transport.test.ts's own comments at
// each site): (1) an UNRECOGNIZED `requestId` passed to `verifyOneTimeCode` reads as `code-invalid`
// (SPEC-R2 never names a distinct "unknown request" code for codes, unlike SPEC-R3's `link-invalid`
// for magic link — folding it into the existing `code-invalid` member matches SPEC-R1 AC4's own
// don't-leak-more-than-necessary shape rather than inventing a new vocabulary member); (2) a
// code/magic-link sign-in auto-provisions a `DemoAccount` (empty password) for a not-yet-seen email,
// the same account-lookup shape `register` already uses — codes/magic-link are demo-only PASSWORDLESS
// auth modes, so no SPEC-R1 pre-registration gate applies to them (SPEC-R2/R3's own ACs never name an
// "unknown account" rejection the way `signInWithPassword` does).
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

/** SPEC-R8's closed error vocabulary — the S1 slice (`account-exists`/`invalid-credentials`) plus S2's
 *  own APPEND (`code-*`/`link-*`, SPEC-R11's additive-only extension rule; never a redefinition of an
 *  existing member). S3 appends `social-denied` when it dispatches (SPEC-R4). */
export type IdentityMockErrorCode =
  | 'account-exists'
  | 'invalid-credentials'
  | 'code-invalid'
  | 'code-expired'
  | 'code-rate-limited'
  | 'link-expired'
  | 'link-invalid'

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

/** SPEC-R1/R2/R3/R5 — S1's + S2's slice of the full seam (SPEC §5's typed contract). S3 (SPEC-R4)
 *  widens this SAME interface with new methods when it dispatches (SPEC-R11) — never a second,
 *  parallel interface. */
export interface IdentityMockTransport {
  register(input: { email: string; password: string }): Promise<{ session: IdentitySession }>
  signInWithPassword(input: { email: string; password: string }): Promise<{ session: IdentitySession }>
  // Codes (S2, SPEC-R2) — requestOneTimeCode ALSO serves "resend" (decomp a5); no second method.
  requestOneTimeCode(input: { email: string }): Promise<{ requestId: string; expiresAt: number }>
  verifyOneTimeCode(input: { requestId: string; code: string }): Promise<{ session: IdentitySession }>
  // Magic Link (S2, SPEC-R3) — confirmMagicLink IS the demo's "user clicked the emailed link" stand-in.
  requestMagicLink(input: { email: string }): Promise<{ requestId: string; expiresAt: number }>
  confirmMagicLink(input: { requestId: string }): Promise<{ session: IdentitySession }>
  getSession(): IdentitySession | null
  clearSession(): void
}

const DEFAULT_ACCOUNTS: readonly DemoAccount[] = [{ email: 'demo@agent-ui.dev', password: 'Passw0rd!', accountId: 'demo-0001' }]
const DEFAULT_LATENCY_MS = 400
const DEFAULT_CODE = '424242'
const DEFAULT_COOLDOWN_MS = 30_000
const DEFAULT_EXPIRES_IN_MS = 300_000

/** SPEC-R7 — every op resolves only after `latencyMs` (0 legal for tests, AC2). A REAL `setTimeout`
 *  (not an injected clock): expiry/cooldown are read off `Date.now()` directly (below), so a test fakes
 *  them the ordinary `vi.useFakeTimers()` way (SPEC-R2 AC4's cooldown probe, identity-mock-transport.test.ts). */
function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))
}

/** One pending code/magic-link request (S2, SPEC-R2/R3): the email it was issued for + its own expiry.
 *  `code` is present only for a one-time-code request (magic link has no per-request secret to check —
 *  `confirmMagicLink` only needs a valid, unexpired `requestId`). */
interface PendingRequest {
  email: string
  expiresAt: number
  code?: string
}

/**
 * createIdentityMockTransport — SPEC-R6: a fresh, deterministic, in-memory fake per call. No shared
 * module-level state between instances (SPEC-N3 — no cross-reload/cross-instance persistence); every
 * account/session this instance adds lives in its own closure only.
 */
export function createIdentityMockTransport(options: IdentityMockTransportOptions = {}): IdentityMockTransport {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS
  const code = options.code ?? DEFAULT_CODE
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS
  const expiresInMs = options.expiresInMs ?? DEFAULT_EXPIRES_IN_MS
  // Deep-copy the seed so mutating THIS instance's accounts never reaches a sibling instance or the
  // caller's own options object (SPEC-R6 AC2's determinism proof depends on each instance starting from
  // an untouched seed).
  const accounts: DemoAccount[] = (options.accounts ?? DEFAULT_ACCOUNTS).map((account) => ({ ...account }))
  let nextAccountSeq = accounts.length + 1
  let session: IdentitySession | null = null

  // S2 (SPEC-R2/R3) — deterministic counters (SPEC-R6 AC2), one per request kind so a `requestId`
  // collision between a code request and a magic-link request can never happen even at the same count.
  let nextCodeRequestSeq = 1
  let nextLinkRequestSeq = 1
  const codeRequests = new Map<string, PendingRequest>()
  const linkRequests = new Map<string, PendingRequest>()
  // SPEC-R2 AC4 — the resend cooldown is keyed per email, independent of `codeRequests`' per-request
  // records (a NEW request while the OLD one is still live/unexpired is exactly the "resend" case).
  const lastCodeRequestAt = new Map<string, number>()

  function findAccount(email: string): DemoAccount | undefined {
    return accounts.find((account) => account.email === email)
  }

  /** S2's own account-provisioning choice (file banner, point 2): codes/magic-link are passwordless —
   *  reuse an existing account by email, or silently provision one (empty password, never reachable via
   *  `signInWithPassword` since no real password can equal `''` once typed) so `session.accountId` is
   *  always a real, stable id, the same shape `register`/`signInWithPassword` already produce. */
  function findOrCreateAccount(email: string): DemoAccount {
    const existing = findAccount(email)
    if (existing !== undefined) return existing
    const accountId = `acct-${String(nextAccountSeq).padStart(4, '0')}`
    nextAccountSeq += 1
    const created: DemoAccount = { email, password: '', accountId }
    accounts.push(created)
    return created
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

    // ── S2 — SPEC-R2: one-time code request / verify / resend ──────────────────────────────────────
    async requestOneTimeCode({ email }) {
      await delay(latencyMs)
      const now = Date.now()
      const lastAt = lastCodeRequestAt.get(email)
      if (lastAt !== undefined && now - lastAt < cooldownMs) {
        throw new IdentityMockError('code-rate-limited', 'You just requested a code — please wait before trying again.')
      }
      const requestId = `req-code-${String(nextCodeRequestSeq).padStart(4, '0')}`
      nextCodeRequestSeq += 1
      const expiresAt = now + expiresInMs
      codeRequests.set(requestId, { email, expiresAt, code })
      lastCodeRequestAt.set(email, now)
      return { requestId, expiresAt }
    },

    async verifyOneTimeCode({ requestId, code: submitted }) {
      await delay(latencyMs)
      const pending = codeRequests.get(requestId)
      // An unrecognized requestId reads as code-invalid (file banner, point 1) — SPEC-R2 names no
      // separate "unknown request" member the way SPEC-R3's link-invalid does for magic link.
      if (pending === undefined) {
        throw new IdentityMockError('code-invalid', 'That code is not valid. Request a new one.')
      }
      if (Date.now() > pending.expiresAt) {
        throw new IdentityMockError('code-expired', 'That code has expired. Request a new one.')
      }
      if (submitted !== pending.code) {
        throw new IdentityMockError('code-invalid', 'That code is not valid. Request a new one.')
      }
      codeRequests.delete(requestId) // one-shot: a redeemed code cannot be replayed
      const account = findOrCreateAccount(pending.email)
      const next: IdentitySession = { accountId: account.accountId, email: account.email, method: 'code' }
      session = next
      return { session: next }
    },

    // ── S2 — SPEC-R3: magic-link request / confirm simulation ──────────────────────────────────────
    async requestMagicLink({ email }) {
      await delay(latencyMs)
      const requestId = `req-link-${String(nextLinkRequestSeq).padStart(4, '0')}`
      nextLinkRequestSeq += 1
      const expiresAt = Date.now() + expiresInMs
      linkRequests.set(requestId, { email, expiresAt })
      return { requestId, expiresAt }
    },

    async confirmMagicLink({ requestId }) {
      await delay(latencyMs)
      const pending = linkRequests.get(requestId)
      if (pending === undefined) {
        throw new IdentityMockError('link-invalid', 'That link is not valid. Request a new one.')
      }
      if (Date.now() > pending.expiresAt) {
        throw new IdentityMockError('link-expired', 'That link has expired. Request a new one.')
      }
      linkRequests.delete(requestId) // one-shot: a confirmed link cannot be replayed
      const account = findOrCreateAccount(pending.email)
      const next: IdentitySession = { accountId: account.accountId, email: account.email, method: 'magic-link' }
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
