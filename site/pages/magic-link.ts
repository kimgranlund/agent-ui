// site/pages/magic-link.ts — S2-b (Magic Link Authentication), GH #490 / ADR-0176 cl.4's "Codes + Magic
// Link" slice. Lane C (ADR-0176 cl.1): pure pattern composition over ALREADY-SHIPPED FACE controls
// (ui-form-provider · ui-field · ui-text-field · ui-button · ui-card) — no new control. Mirrors
// credentials.ts's page shape (mountPage/pageLead, DEV-only wiring, the same status-caption channel) —
// S2 is S1's sibling, not a new invention (identity-flow.decomp.md §0/§7).
//
// S2-a (the code-entry control — Codes/OTP sign-in, decomp a3/a4/a5, ADR-0176's ONE Lane-A control) is
// NOT built here. Per identity-flow.decomp.md §1/§7, the code-entry field earns a full LLD (cell focus
// graph, paste-split algorithm, a11y) before its own build — that LLD does not yet exist anywhere in
// this repo (verified: no `.claude/docs/lld/*code-entry*`/`*otp*` file). Authoring a NEW component's
// interaction-behavior LLD is design work, not a build-seat decomposition of an already-approved
// contract — so it is flagged in this build's handback as an OPEN item for the planner, not improvised
// here. S2-a2 (the OTP flow composition) wires S2-a per the decomp's own S2-a→S2-a2 dependency edge, so
// it is blocked the same way. This file ships ONLY S2-b (Magic Link), which has no such dependency
// (identity-flow.decomp.md §5: "S2-b (Magic Link) has no such internal dependency and stays
// parallel-safe with both").
//
// The transport's SPEC-R2 (codes) methods ARE built (site/lib/identity-mock-transport.ts, unit-tested)
// even though no UI consumes them yet — SPEC-R11 names S2 as their first consumer "when it dispatches",
// and the transport layer carries no design ambiguity the blocked control does; it is ready for S2-a2's
// own future build to consume directly.
//
// GH #554 (merged, PR #569) — checked against THIS flow specifically (S1's own workaround is untouched,
// separate scope): requestMagicLink never rejects (SPEC-R3 AC1 names no error path for it), so its email
// field's only validity is NATIVE (required/email-format) — already rendering correctly through
// ui-field, no custom-validity gap to work around. confirmMagicLink's two rejections (link-expired/
// link-invalid, SPEC-R3 AC2) attach to NO form field at all — "I clicked the link" is a stateless
// affordance click, not a form resubmit gate — so there is nothing to `setCustomValidity()` and nothing
// GH #554's fix changes here; the message renders straight through the page-owned `.magic-link-status`
// caption, no field-poisoning dance needed. The dispatch's WATCH ITEM (a programmatic submit against a
// never-focused custom-invalid control) also does not arise: the one real field (email) is always
// user-typed before its real submit click, and no other control here ever calls setCustomValidity() at
// all.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './magic-link.css'
import { heading } from '../lib/doc-page.ts'
import type { UIFormProviderElement, UITextFieldElement, UIButtonElement, UICardElement } from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time (SPEC-R9 AC2) — the only RUNTIME touch of
// this module is the dynamic import() inside wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockErrorCode, IdentityMockTransport, IdentitySession } from '../lib/identity-mock-transport.ts'

const { content } = mountPage({
  title: 'Magic link sign in',
  intro:
    'One form, a "check your email" confirmation, and a signed-in state — wired to the SAME real, ' +
    'in-memory mock transport as the credential forms, in a dev/preview build. No new control: ' +
    'ui-form-provider + ui-field-wrapped ui-text-field + ui-button, the same spine the Forms guide walks.',
})

content.append(
  pageLead(
    'The demo-only transport never touches a real backend (ADR-0176 cl.2) — there is no real email and ' +
      'no real link URL; "confirm" below IS the demo\'s stand-in for the user clicking the emailed link ' +
      '(identity-mock-transport.spec.md SPEC-R3).',
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

// ── the request card (S2-b, decomp a6) ───────────────────────────────────────────────────────────────

const requestCard = document.createElement('ui-card') as UICardElement
const requestProvider = document.createElement('ui-form-provider') as UIFormProviderElement
requestProvider.className = 'magic-link-form'
const emailField = document.createElement('ui-text-field') as UITextFieldElement
emailField.setAttribute('name', 'email')
emailField.setAttribute('type', 'email')
emailField.setAttribute('required', '')
requestProvider.append(field('Email', emailField))
const requestSubmit = document.createElement('ui-button') as UIButtonElement
requestSubmit.setAttribute('variant', 'solid')
requestSubmit.textContent = 'Send magic link'
requestSubmit.setAttribute('disabled', '')
const requestActions = el('div', 'magic-link-actions')
requestActions.append(requestSubmit)
const requestStatus = el('p', 'magic-link-status')
requestStatus.setAttribute('aria-live', 'polite')
requestCard.append(heading(3, 'Sign in with a magic link'), requestProvider, requestActions, requestStatus)

// ── the "check your email" card (S2-b, decomp a7) ────────────────────────────────────────────────────

const checkEmailCard = document.createElement('ui-card') as UICardElement
const checkEmailWho = el('p')
const confirmButton = document.createElement('ui-button') as UIButtonElement
confirmButton.setAttribute('variant', 'solid')
confirmButton.textContent = 'I clicked the magic link'
const resendButton = document.createElement('ui-button') as UIButtonElement
resendButton.setAttribute('variant', 'ghost')
resendButton.textContent = 'Resend link'
const checkEmailActions = el('div', 'magic-link-actions')
checkEmailActions.append(confirmButton, resendButton)
const checkEmailStatus = el('p', 'magic-link-status')
checkEmailStatus.setAttribute('aria-live', 'polite')
checkEmailCard.append(heading(3, 'Check your email'), checkEmailWho, checkEmailActions, checkEmailStatus)
checkEmailCard.hidden = true

// ── the signed-in card (SPEC-R5: getSession renders it, clearSession signs out) ─────────────────────

const signedInCard = document.createElement('ui-card') as UICardElement
const signedInWho = el('p')
const signOutButton = document.createElement('ui-button') as UIButtonElement
signOutButton.setAttribute('variant', 'ghost')
signOutButton.textContent = 'Sign out'
const signedInActions = el('div', 'magic-link-actions')
signedInActions.append(signOutButton)
signedInCard.append(heading(3, 'Signed in'), signedInWho, signedInActions)
signedInCard.hidden = true

content.append(requestCard, checkEmailCard, signedInCard)

const wiringStatus = el('p', 'magic-link-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'
content.append(wiringStatus)

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────

type View = 'request' | 'check-email' | 'signed-in'

function showView(view: View): void {
  requestCard.hidden = view !== 'request'
  checkEmailCard.hidden = view !== 'check-email'
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

/** Read a rejection's `.code` WITHOUT importing the `IdentityMockError` class as a runtime value
 *  (credentials.ts's own `errorCodeOf` precedent — this page only ever holds the transport's TYPES
 *  statically, SPEC-R9 AC2). */
function errorCodeOf(err: unknown): IdentityMockErrorCode | undefined {
  if (err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: IdentityMockErrorCode }).code
  }
  return undefined
}

// ── DEV-only interactive wiring (SPEC-R9) ────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_S = 10 // page-level UX cooldown only — the transport itself rate-limits NOTHING
// for magic-link resend (unlike SPEC-R2's cooldownMs for codes); ADR-0176 cl.1 names this exact shape
// ("a disabled ui-button driving a plain interval-updated resend countdown — page-level setInterval/
// signal state, not a new control capability").
let resendTimer: ReturnType<typeof setInterval> | undefined
function startResendCooldown(): void {
  let remaining = RESEND_COOLDOWN_S
  resendButton.setAttribute('disabled', '')
  resendButton.textContent = `Resend link (${remaining}s)`
  clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      clearInterval(resendTimer)
      resendButton.removeAttribute('disabled')
      resendButton.textContent = 'Resend link'
      return
    }
    resendButton.textContent = `Resend link (${remaining}s)`
  }, 1000)
}

function wireMagicLink(transport: IdentityMockTransport): void {
  let currentRequestId: string | undefined
  let currentEmail = ''

  async function sendRequest(): Promise<void> {
    const { requestId } = await transport.requestMagicLink({ email: currentEmail })
    currentRequestId = requestId
  }

  requestSubmit.addEventListener('click', () => {
    void (async () => {
      if (!requestProvider.submit()) return
      currentEmail = emailField.value
      requestStatus.textContent = ''
      setPending(requestSubmit, true, 'Sending…', 'Send magic link')
      try {
        await sendRequest()
        requestProvider.reset()
        const emailStrong = el('strong')
        emailStrong.textContent = currentEmail
        checkEmailWho.replaceChildren(text('A magic link was sent to '), emailStrong, text('.'))
        checkEmailStatus.textContent = ''
        showView('check-email')
        // No cooldown on the FIRST send — the cooldown exists to throttle REPEATED resend clicks
        // (below), not to gate the request the user just made.
      } catch {
        requestStatus.textContent = 'Something went wrong — try again.'
      } finally {
        setPending(requestSubmit, false, 'Sending…', 'Send magic link')
      }
    })()
  })

  confirmButton.addEventListener('click', () => {
    void (async () => {
      if (currentRequestId === undefined) return
      checkEmailStatus.textContent = ''
      setPending(confirmButton, true, 'Confirming…', 'I clicked the magic link')
      try {
        const { session } = await transport.confirmMagicLink({ requestId: currentRequestId })
        showSignedIn(session)
      } catch (err) {
        // Neither rejection (link-expired/link-invalid) attaches to a form field — this is a stateless
        // affordance click, never a resubmit-gated form — so the ONLY channel is the status caption
        // (see this file's own banner: no setCustomValidity needed, GH #554 doesn't apply here).
        const code = errorCodeOf(err)
        checkEmailStatus.textContent =
          code === 'link-expired'
            ? 'That link has expired. Send a new one.'
            : code === 'link-invalid'
              ? 'That link is no longer valid. Send a new one.'
              : 'Something went wrong — try again.'
      } finally {
        setPending(confirmButton, false, 'Confirming…', 'I clicked the magic link')
      }
    })()
  })

  resendButton.addEventListener('click', () => {
    void (async () => {
      checkEmailStatus.textContent = ''
      try {
        await sendRequest()
        checkEmailStatus.textContent = 'A new link was sent.'
        startResendCooldown()
      } catch {
        checkEmailStatus.textContent = 'Something went wrong — try again.'
      }
    })()
  })

  signOutButton.addEventListener('click', () => {
    transport.clearSession()
    requestStatus.textContent = ''
    checkEmailStatus.textContent = ''
    clearInterval(resendTimer)
    resendButton.removeAttribute('disabled')
    resendButton.textContent = 'Resend link'
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
      const transport = overlay.createIdentityMockTransport()
      wireMagicLink(transport)
      requestSubmit.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'magic-link-sources')
sources.append(
  text(
    'The transport contract: identity-mock-transport.spec.md (SPEC-R3 requestMagicLink/confirmMagicLink) ' +
      '— a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend.',
  ),
)
content.append(sources)
