# SPEC — Identity mock transport (the X1 seam, GH #490's identity & account flow family)

> Status: proposed · v0.1 · 2026-08-07 · Layer: SPEC (execution contract)
> Refines: [`../adr/0176-identity-account-flow-family-design-intake.md`](../adr/0176-identity-account-flow-family-design-intake.md)
> (the ratified architecture this document turns into a checkable contract — cl.2's demo-only
> security fence names a "documented, consumer-suppliable seam" whose *shape* it explicitly leaves
> to slice-level SPEC/LLD; this is that SPEC. ADR-0176's own OQ3, ruled by Kim on GH #490
> 2026-08-07 — **interactive demos on a shared in-memory mock transport** — is what promotes this
> leaf from advisory to a **hard S1 prerequisite**.)
> Relates: [`../decompositions/identity-flow.decomp.md`](../decompositions/identity-flow.decomp.md)
> (the X1 leaf this document fills, §1's cross-cutting-seam row and §5's dependency edge
> `X1 → S1`) ·
> [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) PRD-D2 (the host-chrome/
> trusted-frame-contains-untrusted-mount mechanism ADR-0176 cl.2/cl.3 both reason from — a
> credential-bearing form is host-authored chrome, never agent-emittable, and this transport is
> that chrome's own injected dependency, never a catalog-reachable seam) ·
> `packages/agent-ui/a2ui/src/agent/agent-transport.ts` (the `AgentTransport` shape this seam's
> async-function-per-action contract mirrors, per ADR-0176 cl.2's own citation — a different
> domain, same shape: one small interface a docs-site page injects, never a component import) ·
> `site/lib/admin-live-runner.ts` + `site/pages/agent-admin.ts:92-109` (`wireLiveOverlay`) — the
> injection-seam PRECEDENT this document's SPEC-R9 adapts (dynamic import, page-local wiring
> function, a stub/fallback state when the overlay isn't wired) — adapted, not reused verbatim,
> because that precedent gates on a runtime key-probe (ADR-0152) while this seam gates on
> `import.meta.env.DEV` (SPEC-R9's own argument for why the two fences differ).
> Route: this SPEC feeds every later identity slice's build directly, never re-derived per slice —
> S1 (Registration + Email+Password) consumes SPEC-R1/R5–R11 now; S2 (Codes + Magic Link) consumes
> SPEC-R2/R3 when it dispatches; S3 (Social Auth) consumes SPEC-R4; S5 (Account Management) consumes
> SPEC-R5's read/clear. Each later slice cites this SPEC's requirement IDs by reference in its own
> GH issue/LLD; none re-authors the transport contract (SPEC-R11's extension rule governs what a
> slice may ADD).
> Altitude: the transport's function-level contract + acceptance criteria only. The one home file
> this SPEC names (SPEC-R10) gets its exact interface shape ruled here (§5, mirroring how
> `a2ui-live-agent.spec.md` §5 types `AgentTransport` directly rather than deferring it) because the
> seam IS the whole deliverable — there is no further LLD for X1 itself; the internal state
> representation (a `Map` vs. class fields, exact function bodies) is S1's own build choice, not
> ruled here.

---

## 1 · Purpose

ADR-0176 cl.2 rules a hard fence — no real auth backend, no real credential handling, no real
network call to an identity provider, ever — and names a documented, consumer-suppliable seam each
flow composes over, leaving the concrete shape to a future SPEC. Kim's OQ3 ruling on GH #490
(2026-08-07) resolved the one open question that shape depended on: every slice's docs-site example
wires a REAL, interactive, in-memory fake transport (not a static specimen), because "static screens
can't prove cross-screen journeys — the family's entire point." That ruling also promotes this
document from an advisory doc S1 could trail to a **hard S1 build prerequisite** — S1 cannot wire
its interactive demo until this contract exists. This SPEC is that contract: one shared, seedable,
deterministic, DEMO-ONLY mock transport that every one of the five slices' docs-site pages injects,
authored once so no slice re-derives it.

Filed against [GH #490](https://github.com/kimgranlund/agent-ui/issues/490); executes the
decomposition's X1 leaf (`identity-flow.decomp.md` §1, §2, §5).

## 2 · Scope

**In scope:** the mock transport's operation surface (one async function per user-facing identity
action across S1/S2/S3/S5), its determinism/seed-data contract, its error vocabulary, its latency
simulation, its session-state read/clear contract, its home (which file, which layer), its
docs-site injection seam, and the rule governing how later slices extend it.

**Out of scope (routes elsewhere, not this document):**
- Any flow's visual/composed screen (the auth-card layout, the code-entry cell grid, the
  provider-button row) — each slice's own pattern (Lane C, plain GH issue) or LLD (S2-a's code-entry
  control, Lane A).
- The `*.flow.json`/layout cards GH #490's Acceptance criterion 1 requires — those grade
  independent of this transport's wiring (`identity-flow.decomp.md` §0, the doc-checker-verified
  ground-truth correction to ADR-0176's own OQ3 framing).
- Onboarding's (S4) transport needs — S4 consumes only this SPEC's SPEC-R5 (`getSession`) to know
  whether a demo session exists; it earns no new operation (the decomp's S4-a/S4-b split names no
  transport dependency beyond that read).
- Any `ui-*` component build, geometry, or a11y contract — this is a page-level TypeScript seam, not
  a FACE control.

## 3 · Requirements (SPEC-R)

**SPEC-R1 — Registration & credential sign-in (S1).**
The transport exposes `register` and `signInWithPassword`, each an async function taking
`{email, password}` and resolving `{session: IdentitySession}` on success. `register` rejects a
second registration under an email already present in the transport's own seed/session-lifetime
account store; `signInWithPassword` rejects an unknown email or a password mismatch. Neither
performs any real hashing/crypto (SPEC-N2) — comparison is a plain string equality against
in-memory seed/registered data (SPEC-R6).
- **AC1** *Given* a fresh transport instance, *when* `signInWithPassword` is called against the one
  pre-seeded demo account's exact credentials, *then* it resolves `{session}` with
  `session.method === 'password'`.
- **AC2** *Given* the same instance, *when* `register` is called with an email that already exists
  (seeded or previously registered this session), *then* it rejects with an `IdentityMockError` of
  `code: 'account-exists'`.
- **AC3** *Given* a fresh transport instance, *when* `register` succeeds for a new email, *then* an
  immediately following `signInWithPassword` call with the same credentials resolves — the account
  is usable within the SAME page lifetime without a reload (SPEC-R6).
- **AC4** *Given* any account, *when* `signInWithPassword` is called with a wrong password, *then*
  it rejects with `code: 'invalid-credentials'`, and the message never distinguishes "wrong
  password" from "unknown email" in its `code` (a single vocabulary member for both, matching the
  fleet's own don't-leak-account-existence convention) — a probe in the transport's own test file.

**SPEC-R2 — One-time code request / verify / resend (S2).**
The transport exposes `requestOneTimeCode({email}) → {requestId, expiresAt}` and
`verifyOneTimeCode({requestId, code}) → {session}`. The SAME `requestOneTimeCode` call serves both
"request" (decomp a3) and "resend" (a5) — there is no second method; the transport's own per-email
cooldown state (SPEC-R6) is what makes a too-soon second call rate-limited, not a distinct verb.
- **AC1** *Given* a fresh transport instance, *when* `requestOneTimeCode` is called for any email,
  *then* it resolves `{requestId, expiresAt}` where `expiresAt` is a future timestamp
  (`Date.now() + expiresInMs`, SPEC-R6's default) and `requestId` is a stable per-call token.
- **AC2** *Given* the seeded predictable code (SPEC-R6), *when* `verifyOneTimeCode` is called with
  that exact code against the matching `requestId`, *then* it resolves `{session}` with
  `session.method === 'code'`.
- **AC3** *Given* a valid `requestId`, *when* `verifyOneTimeCode` is called with any other code,
  *then* it rejects `code: 'code-invalid'`; *when* called after `expiresAt` has passed (simulated by
  an injected clock, SPEC-R7), *then* it rejects `code: 'code-expired'`.
- **AC4** *Given* one `requestOneTimeCode` call for an email, *when* `requestOneTimeCode` is called
  again for the SAME email before the cooldown window (SPEC-R6's `cooldownMs`) elapses, *then* it
  rejects `code: 'code-rate-limited'`; *when* called again AFTER the cooldown elapses, *then* it
  resolves normally with a NEW `requestId` — a fake-clock probe in the transport's own test file.

### SPEC-R2 · Amendment v1 (2026-08-08, S2-a2 build, GH #490) — an unknown `requestId` reads as `code-invalid`

Pure clarification, no behavior change, no new AC (SPEC-R11 AC1): AC3's "any other code" wording
covers an **unrecognized `requestId`** too, under the SAME `code-invalid` member — SPEC-R2 never
named a distinct "unknown request" code the way SPEC-R3's `link-invalid` does for magic link. The
shipped transport (`identity-mock-transport.ts`) already reads it this way (its own file banner's
"S2-local implementation choice" #1, landed with S2-b, PR #578); that PR's review recorded the
meaning-stretch as owed a SPEC-side amendment rather than a silent gap, closed here as S2-a2 (the
codes flow's own first UI consumer, SPEC-R11's anticipated trigger) exercises this exact path.

**SPEC-R3 — Magic-link request / confirm simulation (S2).**
The transport exposes `requestMagicLink({email}) → {requestId, expiresAt}` and
`confirmMagicLink({requestId}) → {session}`. There is no real email and no real link URL —
`confirmMagicLink` IS the demo's stand-in for "the user clicked the emailed link" (decomp a7); the
consuming docs-site page calls it directly from a "simulate clicking the link" affordance rather
than navigating any real URL.
- **AC1** *Given* a fresh transport instance, *when* `requestMagicLink` is called, *then* it
  resolves `{requestId, expiresAt}` — the "check your email" state (a7) the consuming page renders
  off this return value alone, no further transport call needed to show it.
- **AC2** *Given* a valid `requestId`, *when* `confirmMagicLink` is called before `expiresAt`,
  *then* it resolves `{session}` with `session.method === 'magic-link'`; *when* called after
  `expiresAt`, *then* it rejects `code: 'link-expired'`; *when* called with an unknown `requestId`,
  *then* it rejects `code: 'link-invalid'`.

**SPEC-R4 — Social sign-in redirect / callback simulation (S3).**
The transport exposes `startSocialSignIn({provider}) → {redirectHint}` and
`completeSocialSignIn({provider}) → {session}`, simulating the redirect+callback round trip with no
real provider, no `window.location` navigation, and no OAuth token exchange. `provider` is one of a
closed `SocialProvider` union (SPEC-R6).
- **AC1** *Given* a fresh transport instance, *when* `startSocialSignIn` is called for a supported
  provider, *then* it resolves `{redirectHint}` — an opaque string the consuming page may display
  (e.g. "redirecting to Google…"), never a real URL the page navigates to.
- **AC2** *Given* any `redirectHint` value `startSocialSignIn` can return, *then* it does not parse as
  an absolute URL — it never matches `^https?:\/\/` — and no code path anywhere in this seam or its
  consuming pages ever assigns a transport return value to `window.location`, an `<a href>`, or
  `window.open` (SPEC-N8) — a source-level probe over the transport's own implementation is the gate.
- **AC3** *Given* a started social sign-in, *when* `completeSocialSignIn` is called for the SAME
  provider, *then* it resolves `{session}` with `session.method === 'social'`.
- **AC4** *Given* a started social sign-in, *when* `completeSocialSignIn` is called with the
  `provider: 'generic'` demo-denial affordance (a page-level "simulate the user cancelling" control),
  *then* it rejects `code: 'social-denied'` — the one unhappy path this seam names for S3; further
  provider-specific error shapes are S3's own extension (SPEC-R11) if its build needs more.

**SPEC-R5 — Session state read / clear (S5, and every earlier slice's "am I signed in" check).**
The transport exposes synchronous `getSession(): IdentitySession | null` and `clearSession(): void`.
Every successful sign-in/registration op (SPEC-R1–R4) sets the transport's OWN current-session
state as a side effect — a consuming page never has to separately "log in" the session after a
successful op resolves.
- **AC1** *Given* a fresh transport instance, *then* `getSession()` returns `null`.
- **AC2** *Given* any successful sign-in/registration call (SPEC-R1–R4), *then* an immediately
  following `getSession()` call returns the SAME `IdentitySession` the op resolved.
- **AC3** *Given* an active session, *when* `clearSession()` is called, *then* `getSession()`
  subsequently returns `null` — the sign-out affordance S5's worked exemplar needs, and the state
  S4's onboarding-gate check reads.

**SPEC-R6 — Determinism & seed data.**
The transport is a pure, deterministic, in-memory fake: one pre-seeded demo account
(`demo@agent-ui.dev` / `Passw0rd!`) reachable via `signInWithPassword` without a prior `register`
call; a fixed predictable one-time code (`'424242'` by default); no real cryptography anywhere
(SPEC-N2); and no cross-reload persistence — every account/session/cooldown/request-id the demo
adds during a page's lifetime lives in that page's own closure state only, and a reload starts fresh
from the seed (SPEC-N3). Every numeric/string default is overridable via one options object at
construction, so a slice's own test suite can dial latency/cooldown/expiry to zero without touching
the contract.
- **AC1** *Given* `createIdentityMockTransport()` called with no arguments, *then* the resulting
  instance's `signInWithPassword({email:'demo@agent-ui.dev', password:'Passw0rd!'})` resolves
  without a prior `register` call.
- **AC2** *Given* two separate `createIdentityMockTransport()` instances constructed with the SAME
  options (including no options), *then* both produce byte-identical `requestId`/`expiresAt`
  sequences for the same call order — no `Math.random()`/`crypto.getRandomValues` anywhere in the
  default path (a source-level grep gate over this transport's own call sites, not a mirror of
  ADR-0069's convention — that gate greps BUILT `dist/` output for a known string's presence; this one
  greps SOURCE for an absent call site, a different check on a different artifact).
- **AC3** *Given* `createIdentityMockTransport({accounts, code, latencyMs, cooldownMs,
  expiresInMs})`, *then* every op's behavior reflects the overridden value — a construction-time
  options probe.

**SPEC-R7 — Latency simulation.**
Every op returns a `Promise` that resolves only after an injected delay (`latencyMs`, SPEC-R6's
default a small nonzero value, e.g. `400`), so a consuming page's pending/loading UI state actually
renders during a demo, matching the whole point of an INTERACTIVE (not static) demo per OQ3's
ruling. `latencyMs: 0` is a legal override for fast, deterministic test runs (a fake-clock or
`await Promise.resolve()`-driven probe never needs a real wall-clock wait).
- **AC1** *Given* a transport constructed with the default nonzero `latencyMs`, *when* any op is
  called, *then* the returned promise is still pending on the next microtask tick (a consuming
  page's pending state is observable) and resolves after the configured delay.
- **AC2** *Given* a transport constructed with `latencyMs: 0`, *when* any op is called, *then* the
  test suite may `await` it directly with no fake-timer advance required.

**SPEC-R8 — Error vocabulary (closed union, extension additive-only).**
Every rejection is an `IdentityMockError` (extends `Error`) carrying exactly one `code` from a
closed `IdentityMockErrorCode` union (§5). This SPEC ships the codes SPEC-R1–R4's own ACs name:
`account-exists · invalid-credentials · code-invalid · code-expired · code-rate-limited ·
link-expired · link-invalid · social-denied`. A later slice's own build MAY discover it needs one
more code (e.g. a specific S3 provider-error shape) — that lands as a NEW union member via
SPEC-R11's amendment rule, never a redefinition of an existing member's meaning.
- **AC1** *Given* any rejection from any op in §5's interface, *then* it is an `instanceof
  IdentityMockError` and its `.code` is a member of the union documented at that op's own
  requirement — never a bare `Error`, never a string throw.
- **AC2** *Given* the full set of codes this SPEC ships, *then* none overlaps in meaning across
  action families (e.g. `code-invalid` never fires from `confirmMagicLink`) — a per-op switch/case
  exhaustiveness check in the transport's own implementation, TypeScript-enforced via the
  discriminated `IdentityMockErrorCode` union.

Malformed input (an empty or syntactically invalid email/password) is form-level validation's job on
the consuming page, before any op is called — this transport mints no error code for it and never
sees it.

**SPEC-R9 — Docs-site injection seam (DEV-only).**
Each consuming docs-site page (S1-f, S2-f, S3-f, S5-e/f) wires the mock through a page-local
function shaped like `site/pages/agent-admin.ts`'s `wireLiveOverlay` (dynamic import + page-owned
wiring, `:92-109`) — but gated on `import.meta.env.DEV`, not a runtime probe, because this seam
protects a DIFFERENT thing than the admin overlay's own fence. The admin overlay gates on a runtime
key-probe because ITS risk is a real, secret-holding transport that must degrade gracefully when no
key is configured (ADR-0152 — and it therefore ships in production once available). This transport
holds no secret at all, so that risk doesn't apply; its own risk is presentational — an
interactive, credential-SHAPED demo form on the always-public production docs site could read as a
real sign-in surface. Gating on `import.meta.env.DEV` keeps the interactive mock confined to
dev/preview builds; each slice's own docs-site page shows its flow's static, non-interactive
composed screen in a production build instead (still satisfying GH #490's own "docs-site page +
representative example" Acceptance criterion — a static specimen is a legitimate example, an
interactive one is a strictly richer bonus this fence keeps out of the shipped bundle).
- **AC1** *Given* a dev/preview build (`import.meta.env.DEV === true`), *when* a consuming page
  mounts, *then* it dynamically imports `identity-mock-transport.ts`, constructs an instance, and
  wires the flow's interactive demo against it.
- **AC2** *Given* a production build (`import.meta.env.DEV === false`), *when* the SAME page's
  source is bundled, *then* the dynamic-import branch is dead-code-eliminated — `identity-mock-
  transport.ts`'s own distinguishing exported symbol name does not appear anywhere in the production
  `dist/` output (a `vite build` + grep probe). This is a NEW symbol-absence check, not a mirror of
  `a2ui-live-agent.spec.md` SPEC-N2's own `dist/`-grep convention — that gate greps for the ABSENCE of
  a KEY VALUE inside an overlay module its own text says DOES ship in production (SPEC-N2's v0.7
  changelog records the prior build-time DEV-only + tree-shake enforcement being REPLACED, not merely
  extended, by a runtime `/status` probe once ADR-0152 made that module reachable by every visitor).
  This seam's build-time-only proof stands on its own merits, not that precedent's: the risk here is
  presentational — an interactive, credential-shaped demo form reading as a real sign-in surface on
  the public docs site — never a secret, so eliminating the whole module from the bundle removes the
  risk entirely; there is no secret-holding "ships but stays safe" runtime posture to fall back to
  here, and none is needed.

**SPEC-R10 — Home: `site/lib/identity-mock-transport.ts`, not a package export.**
The transport lives at `site/lib/identity-mock-transport.ts` — site-local, never exported from any
`@agent-ui/*` package's public barrel (default or opt-in subpath). Argued from the same mechanism
ADR-0176 cl.2 already used to rule OUT a real backend, applied one layer further: shipping this fake
as an installable PACKAGE export (e.g. `@agent-ui/identity-mock-transport` or a subpath on an
existing package) would present exactly the "smells like real auth" surface cl.2 exists to prevent,
even though its internals are fully inert — a real consumer scanning package exports for an identity
transport should find NONE, not "one, but it's fake." `site/lib/` already hosts this exact shape of
module (`admin-live-runner.ts`, `live-proxy-transport.ts`, `ndjson-lines.ts` — site-owned
infrastructure a docs-site PAGE injects, never a package export) — this is a strictly simpler case
(no key, no dev-proxy, no network) that fits the established directory contract with no new
convention. Every consuming slice's docs-site page (S1-f/S2-f/S3-f/S5-e-f) is itself `site/pages/`
content — the transport only needs to be reachable from siblings in the same tree.
- **AC1** *Given* the shipped file, *then* it resolves at `site/lib/identity-mock-transport.ts` and
  no `packages/agent-ui/*/package.json` exports field references it — a grep sweep over every
  package's `package.json` `exports` map.
- **AC2** *Given* the fleet's own layering trip-wires (`layering.test.ts`, per package), *then* none
  of them needs a new exemption for this file — it never crosses a package boundary, so it never
  enters that gate's scope at all.

**SPEC-R11 — Extension rule: later slices extend, never re-author.**
S2, S3, and S5's own future builds are the FIRST real consumers of SPEC-R2/R3, SPEC-R4, and
SPEC-R5's fuller surface respectively; if any of them discovers this contract needs one more field,
one more error code, or one more config knob, that lands as a NEW `## Amendment vN` section appended
to THIS document — additive only, citing the consuming slice's GH sub-issue — never an edit to an
already-numbered SPEC-R's existing text (mirroring the doc-standards §2 append-only convention for
accepted docs, applied here to a proposed cross-slice seam specifically because it is shared: a
silent in-place edit to, say, SPEC-R2's `verifyOneTimeCode` signature would break S1's already-built
demo wiring without a trace). No slice re-derives the seam's shape from ADR-0176 cl.2 in its own
SPEC/LLD — each cites this document's requirement IDs by reference. This deliberately diverges from
`a2ui-live-agent.spec.md`'s top-of-header versioned-changelog convention: that document's amendments
land from one sequential authoring session at a time, so a single top-of-file block reads cleanly,
while this SPEC's amendments arrive from S2/S3/S5's independently-timed future builds, each touching
one specific requirement — anchoring each addition as a dated section under the SPEC-R it extends
keeps a contributing slice's diff scoped to the requirement it actually touched, rather than forcing
every contributor to also edit one shared top-of-file block.
- **AC1** *Given* this document's git history from v0.1 forward, *then* every subsequent change to
  an already-numbered SPEC-R's requirement text is either a pure clarification (no behavior change,
  no new AC) or lands inside a dated `## Amendment` section — never a silent rewrite of a shipped
  requirement's behavior.

## 4 · Non-goals (SPEC-N)

- **SPEC-N1 — No real auth backend, ever, in the default/shipped state.** Verbatim-in-spirit from
  ADR-0176 cl.2: no real credential handling, no real network call to an identity provider, no
  client SDK dependency, no hand-rolled production-grade crypto — this is a hard fence, not a
  phased "not yet." Reopening it is a future ADR's own forcing argument, not a drift this SPEC could
  authorize.
- **SPEC-N2 — No real cryptography.** No password hashing/salting, no real token signing/JWT
  minting, no secure-random code/id generation (SPEC-R6 AC2's determinism requirement is the
  positive form of this same non-goal) — plain string/timestamp comparison against in-memory seed
  data only.
- **SPEC-N3 — No cross-reload persistence.** The transport's account/session/cooldown state lives
  for the constructing page's own lifetime only; no `localStorage`/`indexedDB`/cookie write anywhere
  in this contract. A reload starts fresh from SPEC-R6's seed data — this is a scope-clarity
  non-goal (not itself part of ADR-0176 cl.2's security fence) so no slice's demo build silently
  assumes a persisted account list.
- **SPEC-N4 — No catalog/A2UI exposure.** Mirrors ADR-0176 cl.3: this transport is a host-page-only
  demo seam, never registered with any A2UI catalog, never reachable by a model-authored surface,
  and never imported from `@agent-ui/a2ui` or any of its catalogs.
- **SPEC-N5 — No package export.** SPEC-R10's own home ruling, restated as a non-goal for
  visibility: no `@agent-ui/*` package `exports` field ever points at this file — a structural
  reinforcement of SPEC-N1, not a separate fence.
- **SPEC-N6 — No UI/visual contract.** This document rules ONLY the transport's function-level
  surface (§3); the composed screen each slice renders around it (the auth-card layout, the
  code-entry cell grid, the provider-button row, the "check your email" copy) is that slice's own
  Lane-C pattern (plain GH issue) or Lane-A LLD (S2-a's code-entry control) — never ruled here.
- **SPEC-N7 — No Onboarding-specific operation.** S4 (Onboarding) consumes only SPEC-R5's
  `getSession()` to gate its first-run journey on an existing demo session; it earns no NEW
  transport operation — matching `identity-flow.decomp.md`'s own S4-a/S4-b split, neither of which
  names a transport dependency beyond that read.
  *(Clarifying note, 2026-08-08, S4 build, GH #614 — additive, non-normative: the shipped
  `site/pages/onboarding.ts` is its own standalone MPA entry with no real "arrived from
  Authentication" hop to demo against (SPEC-N3 — a fresh page load has no session), so its
  first-run gate is a one-click sign-in STAND-IN over the SAME SPEC-R1 `signInWithPassword` /
  SPEC-R6 seeded demo account every other slice already uses, plus `clearSession` on its own
  sign-out. Both are pre-existing operations, not S4-specific ones — the rule this non-goal
  states ("no NEW transport operation") still holds exactly; only this sentence's own "only
  `getSession()`" phrasing undersold the page's full (still non-new) surface.)*
- **SPEC-N8 — No operation's return value is ever a navigation target.** `redirectHint` (SPEC-R4 AC2)
  and every other string this seam returns are DISPLAY-only; no consuming page may assign any of them
  to `window.location`, an `<a href>`, `window.open`, or any other navigation sink. S3's own build
  (SPEC-R4's first real consumer) inherits this guardrail without re-deriving it — ADR-0176 cl.2 is
  the authority forbidding a real redirect anywhere in this fence.

## 5 · Typed contracts

```ts
// The seam (SPEC-R1–R5). Zero-dep, pure TS; DEMO-ONLY (SPEC-N1) — never a real transport, never
// exported from any @agent-ui/* package (SPEC-R10/SPEC-N5). site/lib/identity-mock-transport.ts.
interface IdentityMockTransport {
  // Registration + Email+Password (S1, SPEC-R1)
  register(input: { email: string; password: string }): Promise<{ session: IdentitySession }>;
  signInWithPassword(input: { email: string; password: string }): Promise<{ session: IdentitySession }>;

  // Codes (S2, SPEC-R2) — requestOneTimeCode ALSO serves "resend" (decomp a5); no second method.
  requestOneTimeCode(input: { email: string }): Promise<{ requestId: string; expiresAt: number }>;
  verifyOneTimeCode(input: { requestId: string; code: string }): Promise<{ session: IdentitySession }>;

  // Magic Link (S2, SPEC-R3) — confirmMagicLink IS the demo's "user clicked the emailed link" stand-in.
  requestMagicLink(input: { email: string }): Promise<{ requestId: string; expiresAt: number }>;
  confirmMagicLink(input: { requestId: string }): Promise<{ session: IdentitySession }>;

  // Social Auth (S3, SPEC-R4) — no real provider, no window navigation, no token exchange.
  startSocialSignIn(input: { provider: SocialProvider }): Promise<{ redirectHint: string }>;
  completeSocialSignIn(input: { provider: SocialProvider }): Promise<{ session: IdentitySession }>;

  // Session state (S5 + every earlier slice's "am I signed in" check, SPEC-R5) — synchronous reads.
  getSession(): IdentitySession | null;
  clearSession(): void;
}

type SocialProvider = 'google' | 'github' | 'generic';

interface IdentitySession {
  accountId: string;
  email: string;
  method: 'password' | 'code' | 'magic-link' | 'social';
}

// The closed error vocabulary (SPEC-R8) — extended ONLY via a dated ## Amendment section (SPEC-R11).
type IdentityMockErrorCode =
  | 'account-exists'        // register: email already registered this page lifetime
  | 'invalid-credentials'   // signInWithPassword: unknown email OR wrong password (never distinguished)
  | 'code-invalid'          // verifyOneTimeCode: wrong code for the given requestId
  | 'code-expired'          // verifyOneTimeCode: past expiresAt
  | 'code-rate-limited'     // requestOneTimeCode: called again before cooldownMs elapses for the email
  | 'link-expired'          // confirmMagicLink: past expiresAt
  | 'link-invalid'          // confirmMagicLink: unknown requestId
  | 'social-denied';        // completeSocialSignIn: the demo's "simulate cancel" affordance

declare class IdentityMockError extends Error {
  readonly code: IdentityMockErrorCode;
}

// Construction & determinism (SPEC-R6/R7) — every default overridable; NO Math.random()/crypto.* in
// the default path (SPEC-R6 AC2's determinism gate).
interface DemoAccount {
  email: string;
  password: string;
  accountId: string;
}
interface IdentityMockTransportOptions {
  accounts?: DemoAccount[];   // default: [{ email: 'demo@agent-ui.dev', password: 'Passw0rd!', accountId: 'demo-0001' }]
  code?: string;               // default: '424242' — the fixed predictable one-time code
  latencyMs?: number;          // default: 400 — 0 is a legal override for fast/deterministic tests
  cooldownMs?: number;         // default: 30_000 — the resend rate-limit window (SPEC-R2 AC4)
  expiresInMs?: number;        // default: 300_000 (5 min) — code/magic-link request expiry
}
declare function createIdentityMockTransport(
  options?: Partial<IdentityMockTransportOptions>,
): IdentityMockTransport;

// The docs-site injection seam (SPEC-R9) — page-local, DEV-only; mirrors agent-admin.ts's
// wireLiveOverlay shape (site/pages/agent-admin.ts:92-109), gated differently (see SPEC-R9's own
// argument for why: no secret held here, so no runtime key-probe — a build-time DEV branch instead).
// Illustrative shape only; each slice's own page authors its own wiring function against this seam.
declare function wireIdentityDemo(host: HTMLElement, transport: IdentityMockTransport): void;
```

## 6 · Traceability

| SPEC id | Serves (ADR-0176 clause / decomp leaf) | Consuming slice |
|---|---|---|
| SPEC-R1 | cl.2 (the seam) / decomp S1-a, S1-b | S1 |
| SPEC-R2 | cl.2 / decomp S2-a2, a3/a5 | S2 |
| SPEC-R3 | cl.2 / decomp S2-b, a6/a7 | S2 |
| SPEC-R4 | cl.2 / decomp S3-a, a8 | S3 |
| SPEC-R5 | cl.2 / decomp S5-a, a12/a13; also S4's session-gate read | S1 (read/clear wiring) → S4, S5 |
| SPEC-R6 | cl.2's "no real crypto/network" fence | all slices (shared config) |
| SPEC-R7 | OQ3's interactive-demo ruling | all slices |
| SPEC-R8 | cl.2 (unhappy paths) | S1 (baseline codes), S2/S3 (extension) |
| SPEC-R9 | cl.2 + PRD-D2 (never look like a live surface) | all slices' docs-site pages |
| SPEC-R10 | cl.2 (site-local fence, package-export smell) | all slices |
| SPEC-R11 | doc-standards §2's append-only convention, applied to a shared seam | S2/S3/S5 (future amendments) |

## 7 · Acceptance for this document

Ships `proposed`; flips to `accepted` only by a deliberate mark once the contract is judged stable
across at least one real consuming build (the doc-standards skill §2 rarity rule) — never
self-flipped by the authoring session. Document gates: `site/lib/docs-grammar.test.ts` (status
keyword + the relative-link sweep) exit 0 inside `npm run check`'s `check:site` step.
