// site/pages/otp-signin.ts — S2-a2 (One-time code sign-in composition), GH #490 / ADR-0176 cl.4's "Codes +
// Magic Link" slice — the OTP half, the LAST S2 leaf (identity-flow.decomp.md §5's `S2-a → S2-a2` edge).
// Lane C composition (ADR-0176 cl.1) wiring the ONE Lane-A control (`ui-otp-field`, code-entry-control.
// lld.md, GH #490 S2-a, PR #596) to identity-mock-transport's SPEC-R2 (shipped with full unit coverage in
// PR #578 — this page is its first UI consumer, exactly as SPEC-R11 anticipated): request a code (decomp
// a3) -> enter + auto-verify (decomp a4) -> resend (decomp a5) -> signed-in -> sign-out. Mirrors
// magic-link.ts's page shape (mountPage/pageLead, DEV gating, the wireXxx(transport)/errorCodeOf idiom) —
// S2-a2 is S2-b's sibling half, not a new invention.
//
// AUTO-SUBMIT, NOT a submit button (otp-field.md / code-entry-control.lld.md §2 Events + §8, RULED):
// `ui-otp-field`'s own `change` event fires ONLY on a real USER-DRIVEN completion (a digit/paste that fills
// the last cell) — NEVER on a programmatic value/length write (the LLD's own frozen §8 ruling: "completion
// commits are USER-TRANSITION-ONLY") — so this composition's verify trigger IS that `change` event
// directly. There is no "Verify" button anywhere on the code-entry card; `wireOtpFlow`'s own `change`
// listener additionally guards on `value.length === CODE_LENGTH` so the control's OTHER `change` moment
// (blur-with-change against a still-partial value, the LLD's own dual-commit-moment Events row) can never
// misfire a verify call against an incomplete code.
//
// THE #554 FIXED VALIDITY PATH, used STRAIGHT — unlike credentials.ts/magic-link.ts's own page-owned status-
// caption workaround (those pages predate/sidestep the fix). `ui-otp-field` (built AFTER GH #554 landed
// fleet-wide, dom/form.ts's protected `mergedValidity()`) already wires `trackUserInvalid` off the corrected
// merge (code-entry-control.lld.md's own Form-participation row: "the GH #554-corrected pattern"), so a
// `setCustomValidity()` rejection on the field genuinely renders through `ui-field`'s inline
// `[data-part=error]` the moment `interacted` is true — no page-owned status-caption duplicate needed.
// `code-invalid` and `code-expired` (SPEC-R2 AC3) are the two rejections wired this way. `code-rate-limited`
// (SPEC-R2 AC4 — reachable only from a RESEND click here; the very first request can never collide with a
// prior one) is not a field concern (it isn't "your code is wrong", it's "wait") — it, and any unexpected
// rejection, ride the code-entry card's own `.otp-signin-status` caption instead, the same fallback channel
// magic-link.ts's own resend path already uses.
//
// THE DISPATCH WATCH ITEM (GH #554's own residual note, its fix-issue comment: "programmatic submit vs the
// blur/change-armed `interacted` gate — file only if S2's flow drives submit programmatically"): checked,
// does NOT arise here, by construction, not by workaround. `interacted` flips true on the host's own FIRST
// `blur`/`change` (traits/track-user-invalid.ts, a listener installed on the otp-field host inside its OWN
// `connected()`). This composition's verify trigger *is* that SAME otp-field's completion `change` event,
// dispatched on that SAME host — and the tracker's listener is registered earlier (inside the control's own
// connect) than this page's `change` listener (attached once, after the element already exists in the
// mounted DOM). So by the time this page's handler even runs — let alone by the time the async
// `verifyOneTimeCode()` call later settles — `interacted` is ALREADY true: the one event that can ever
// trigger a verify call is the identical event that arms the gate. There is no code path here where verify
// can run against a never-interacted field. Proven, not just reasoned: otp-signin.browser.test.ts's
// rejection test asserts the inline `ui-field` error renders on the VERY FIRST rejection, off the completing
// keystroke alone — no extra blur anywhere in that test.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './otp-signin.css'
import { heading } from '../lib/doc-page.ts'
import type {
  UIFormProviderElement,
  UITextFieldElement,
  UIOtpFieldElement,
  UIButtonElement,
  UICardElement,
} from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time (SPEC-R9 AC2) — the only RUNTIME touch of this
// module is the dynamic import() inside wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockErrorCode, IdentityMockTransport, IdentitySession } from '../lib/identity-mock-transport.ts'
import { errorCodeOf } from '../lib/identity-error-code.ts'

const CODE_LENGTH = 6

const { content } = mountPage({
  title: 'One-time code sign in',
  intro:
    'A request form, a segmented code entry field, and a signed-in state — wired to the SAME real, ' +
    'in-memory mock transport as the credential/magic-link forms, in a dev/preview build. The one new ' +
    'control: ui-otp-field (GH #490 S2-a), field-wrapped like every other entry control on this site — no ' +
    'submit button, the code auto-verifies the instant its 6th digit lands.',
})

content.append(
  pageLead(
    'The demo-only transport never touches a real backend (ADR-0176 cl.2) — the fixed demo code is ' +
      '424242. Request a code for any email, type it (or paste it), and the field submits itself on ' +
      'completion.',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrapper = document.createElement('ui-field')
  wrapper.setAttribute('label', label)
  wrapper.append(control)
  return wrapper
}

// ── the request card (decomp a3) ─────────────────────────────────────────────────────────────────────────

const requestCard = document.createElement('ui-card') as UICardElement
const requestProvider = document.createElement('ui-form-provider') as UIFormProviderElement
requestProvider.className = 'otp-signin-form'
const emailField = document.createElement('ui-text-field') as UITextFieldElement
emailField.setAttribute('name', 'email')
emailField.setAttribute('type', 'email')
emailField.setAttribute('required', '')
requestProvider.append(field('Email', emailField))
const requestSubmit = document.createElement('ui-button') as UIButtonElement
requestSubmit.setAttribute('variant', 'solid')
requestSubmit.textContent = 'Send code'
requestSubmit.setAttribute('disabled', '')
const requestActions = el('div', 'otp-signin-actions')
requestActions.append(requestSubmit)
const requestStatus = el('p', 'otp-signin-status')
requestStatus.setAttribute('aria-live', 'polite')
requestCard.append(heading(3, 'Sign in with a one-time code'), requestProvider, requestActions, requestStatus)

// ── the code-entry card (decomp a4/a5) ───────────────────────────────────────────────────────────────────

const codeCard = document.createElement('ui-card') as UICardElement
const codeIntro = el('p')
const codeProvider = document.createElement('ui-form-provider') as UIFormProviderElement
codeProvider.className = 'otp-signin-form'
const codeField = document.createElement('ui-otp-field') as UIOtpFieldElement
codeField.setAttribute('name', 'code')
codeField.setAttribute('length', String(CODE_LENGTH))
codeField.setAttribute('required', '')
codeProvider.append(field('One-time code', codeField))
const resendButton = document.createElement('ui-button') as UIButtonElement
resendButton.setAttribute('variant', 'ghost')
resendButton.textContent = 'Resend code'
const codeActions = el('div', 'otp-signin-actions')
codeActions.append(resendButton)
const codeStatus = el('p', 'otp-signin-status')
codeStatus.setAttribute('aria-live', 'polite')
codeCard.append(heading(3, 'Enter the code'), codeIntro, codeProvider, codeActions, codeStatus)
codeCard.hidden = true

// ── the signed-in card (SPEC-R5: getSession renders it, clearSession signs out) ────────────────────────────

const signedInCard = document.createElement('ui-card') as UICardElement
const signedInWho = el('p')
const signOutButton = document.createElement('ui-button') as UIButtonElement
signOutButton.setAttribute('variant', 'ghost')
signOutButton.textContent = 'Sign out'
const signedInActions = el('div', 'otp-signin-actions')
signedInActions.append(signOutButton)
signedInCard.append(heading(3, 'Signed in'), signedInWho, signedInActions)
signedInCard.hidden = true

content.append(requestCard, codeCard, signedInCard)

const wiringStatus = el('p', 'otp-signin-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'
content.append(wiringStatus)

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────────

type View = 'request' | 'code-entry' | 'signed-in'

function showView(view: View): void {
  requestCard.hidden = view !== 'request'
  codeCard.hidden = view !== 'code-entry'
  signedInCard.hidden = view !== 'signed-in'
}

function showSignedIn(session: IdentitySession): void {
  const emailStrong = el('strong')
  emailStrong.textContent = session.email
  signedInWho.replaceChildren(text('Signed in as '), emailStrong, text(` (via ${session.method}).`))
  showView('signed-in')
}

/** Reflects `transport.getSession()` into the page — the render this whole demo exists to prove (SPEC-R5). */
function refreshSessionUI(transport: IdentityMockTransport): void {
  const session = transport.getSession()
  if (session) showSignedIn(session)
  else showView('request')
}

function setPending(button: UIButtonElement, pending: boolean, pendingLabel: string, restLabel: string): void {
  button.toggleAttribute('disabled', pending)
  button.textContent = pending ? pendingLabel : restLabel
}

// ── the resend cooldown (SPEC-R2 AC4 — a REAL server-enforced per-email cooldown, unlike magic-link.ts's
// own page-only UX countdown: SPEC-R3 never rate-limits requestMagicLink at all). Mirrored here at the SAME
// default (`cooldownMs`, identity-mock-transport.ts) so the resend button's disabled window matches what the
// transport actually enforces, starting from the FIRST request too (the real cooldown runs from ANY prior
// call, not only a resend) ───────────────────────────────────────────────────────────────────────────────

// A `let`, not a `const` — a test overriding the transport's OWN `cooldownMs` (the expiry test's identical
// short-override idiom) must also shrink THIS so the displayed countdown reflects what that transport
// instance actually enforces; the identity transport exposes no "cooldown ends at" value to derive it from
// (only `expiresAt`, the CODE's own expiry — a different deadline). Production code never calls the setter
// below, so every real visitor always sees the true default.
let resendCooldownSeconds = 30
let resendCooldownRemaining = 0
let resendTimer: ReturnType<typeof setInterval> | undefined

/** Test-only seam (pairs with `__setTransportForTest` — override BOTH together when injecting a
 *  short-`cooldownMs` transport, or the displayed countdown will not match what it enforces). Never called
 *  by any production path. */
export function __setResendCooldownSecondsForTest(next: number): void {
  resendCooldownSeconds = next
}

function startResendCooldown(): void {
  resendCooldownRemaining = resendCooldownSeconds
  resendButton.setAttribute('disabled', '')
  resendButton.textContent = `Resend code (${resendCooldownRemaining}s)`
  clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendCooldownRemaining -= 1
    if (resendCooldownRemaining <= 0) {
      clearInterval(resendTimer)
      resendCooldownRemaining = 0
      resendButton.removeAttribute('disabled')
      resendButton.textContent = 'Resend code'
      return
    }
    resendButton.textContent = `Resend code (${resendCooldownRemaining}s)`
  }, 1000)
}

function stopResendCooldown(): void {
  clearInterval(resendTimer)
  resendCooldownRemaining = 0
  resendButton.removeAttribute('disabled')
  resendButton.textContent = 'Resend code'
}

// ── DEV-only interactive wiring (SPEC-R9) ───────────────────────────────────────────────────────────────

// A module-level MUTABLE binding (the `a2ui-chat.ts`/`a2ui-live.ts` `__setTransportForTest` precedent,
// adapted — not reused verbatim, a different transport shape entirely, same mechanism): every click/change
// handler below reads `transport` through `requireTransport()` at call time, so `__setTransportForTest` can
// swap the backing instance AFTER `wireOtpFlow()` has already attached its listeners, with zero re-wiring.
// Needed because SPEC-R2's real `expiresInMs` default (5 minutes) makes a genuine expiry unreachable inside
// a real-engine browser test's own timeout budget without an override (SPEC-R6's own "so a slice's own test
// suite can dial ... expiry to zero without touching the contract") — every OTHER test in this file drives
// the REAL DEV-wired, zero-options transport (SPEC-R7's real-timing discipline), matching S1/S2-b precedent.
let transport: IdentityMockTransport | undefined

function requireTransport(): IdentityMockTransport {
  if (transport === undefined) throw new Error('otp-signin: identity transport not wired yet')
  return transport
}

/** Test-only injection seam — never called by any production path (the `__setTransportForTest` precedent's
 *  own contract). */
export function __setTransportForTest(next: IdentityMockTransport): void {
  transport = next
}

let currentEmail = ''
let currentRequestId: string | undefined

function wireOtpFlow(): void {
  requestSubmit.addEventListener('click', () => {
    void (async () => {
      if (!requestProvider.submit()) return
      currentEmail = emailField.value
      requestStatus.textContent = ''
      setPending(requestSubmit, true, 'Sending…', 'Send code')
      try {
        const { requestId } = await requireTransport().requestOneTimeCode({ email: currentEmail })
        currentRequestId = requestId
        requestProvider.reset()
        const emailStrong = el('strong')
        emailStrong.textContent = currentEmail
        codeIntro.replaceChildren(text('We sent a code to '), emailStrong, text('.'))
        codeStatus.textContent = ''
        showView('code-entry')
        startResendCooldown() // the real per-email cooldown starts from THIS call too (SPEC-R2 AC4)
      } catch (err) {
        // REACHABLE (MINOR-1, code-checker finding on 407a240): sign-out never clears the transport's own
        // per-email `lastCodeRequestAt` (identity-mock-transport.ts) — a fast sign-out → re-request cycle
        // for the SAME email inside the 30s cooldown window hits `code-rate-limited` HERE too, even though
        // the page's own countdown display was zeroed at sign-out (`stopResendCooldown()`). Unlike
        // magic-link.ts's own initial-request catch (genuinely unreachable there — SPEC-R3 AC1 names NO
        // error path for `requestMagicLink` at all), `requestOneTimeCode` always carries this one rejection
        // (SPEC-R2 AC4); the prior comment here claimed the SAME "unreachable" shape by copying that idiom
        // without re-deriving it for THIS method's own contract — the premise didn't survive the copy.
        // Mirrors the resend handler's own wait-message below (the SAME rejection code, reached from a
        // different UI path).
        const code = errorCodeOf(err)
        requestStatus.textContent =
          code === 'code-rate-limited'
            ? 'You just requested a code — wait a few seconds and try again.'
            : 'Something went wrong — try again.'
      } finally {
        setPending(requestSubmit, false, 'Sending…', 'Send code')
      }
    })()
  })

  // The completion-change → verify trigger (this file's own header banner + the dispatch watch item).
  codeField.addEventListener('change', () => {
    void (async () => {
      // Guards out ui-otp-field's OTHER `change` moment (blur-with-change against a still-partial value,
      // code-entry-control.lld.md §2 Events) — only a genuinely COMPLETE code ever reaches the transport.
      if (codeField.value.length !== CODE_LENGTH) return
      if (currentRequestId === undefined) return // defensive — unreachable once code-entry is showing
      codeField.setCustomValidity('') // clear any stale rejection before re-checking (credentials.ts's own idiom)
      codeStatus.textContent = 'Verifying…'
      codeField.setAttribute('disabled', '')
      resendButton.setAttribute('disabled', '')

      let session: IdentitySession | undefined
      let rejectionCode: IdentityMockErrorCode | undefined
      try {
        const result = await requireTransport().verifyOneTimeCode({ requestId: currentRequestId, code: codeField.value })
        session = result.session
      } catch (err) {
        rejectionCode = errorCodeOf(err)
      }

      // Re-enable BEFORE any reportValidity() call below — a disabled control cannot take focus.
      codeField.removeAttribute('disabled')
      if (resendCooldownRemaining <= 0) resendButton.removeAttribute('disabled')

      if (session) {
        codeProvider.reset()
        codeStatus.textContent = ''
        showSignedIn(session)
        return
      }

      codeStatus.textContent = ''
      if (rejectionCode === 'code-invalid') {
        const message = 'That code is not valid. Try again.'
        codeField.setCustomValidity(message) // renders through ui-field's inline error (the #554 fixed path)
        codeField.reportValidity()
      } else if (rejectionCode === 'code-expired') {
        const message = 'That code has expired. Request a new one.'
        codeField.setCustomValidity(message)
        codeField.reportValidity()
      } else {
        // code-rate-limited cannot fire from THIS call (verifyOneTimeCode never rejects with it, SPEC-R8) —
        // kept as the fleet's standard defensive catch-all for a genuinely unexpected rejection.
        codeStatus.textContent = 'Something went wrong — try again.'
      }
    })()
  })

  resendButton.addEventListener('click', () => {
    void (async () => {
      if (currentEmail === '') return
      codeStatus.textContent = ''
      setPending(resendButton, true, 'Resending…', 'Resend code')
      try {
        const { requestId } = await requireTransport().requestOneTimeCode({ email: currentEmail })
        currentRequestId = requestId
        // A fresh start for the new code: provider.reset() clears the field's value AND its `interacted`
        // timing (UIFormElement's formResetCallback → otp-field's own formReset(), which also resets the
        // trackUserInvalid controller) — so no stale error/valueMissing flash appears from the OLD attempt.
        codeProvider.reset()
        codeField.setCustomValidity('')
        codeStatus.textContent = 'A new code was sent.'
        startResendCooldown() // takes over the disabled state with its own countdown label immediately —
        // no separate restore call here (magic-link.ts's own resend precedent).
      } catch (err) {
        const code = errorCodeOf(err)
        codeStatus.textContent =
          code === 'code-rate-limited'
            ? 'You just requested a code — wait a few seconds and try again.'
            : 'Something went wrong — try again.'
        setPending(resendButton, false, 'Resending…', 'Resend code')
      }
    })()
  })

  signOutButton.addEventListener('click', () => {
    requireTransport().clearSession()
    requestStatus.textContent = ''
    codeStatus.textContent = ''
    currentEmail = ''
    currentRequestId = undefined
    stopResendCooldown()
    showView('request')
  })
}

function wireIdentityDemo(): void {
  void (async () => {
    if (!import.meta.env.DEV) {
      wiringStatus.textContent =
        'Static specimen — the shipped build makes no transport call (see the identity-mock-transport ' +
        "SPEC's DEV-only fence). Run `npm run dev` for the interactive demo."
      return
    }
    try {
      const overlay = await import('../lib/identity-mock-transport.ts')
      transport = overlay.createIdentityMockTransport()
      wireOtpFlow()
      requestSubmit.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'otp-signin-sources')
sources.append(
  text(
    'The transport contract: identity-mock-transport.spec.md (SPEC-R2 requestOneTimeCode/verifyOneTimeCode) ' +
      '— a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend. The control: code-entry-control.' +
      'lld.md (ui-otp-field, GH #490 S2-a).',
  ),
)
content.append(sources)
