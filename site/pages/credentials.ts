// site/pages/credentials.ts — S1 (Registration + Email+Password Authentication), GH #490 / ADR-0176 cl.4's
// "Credentials baseline" slice. Lane C (ADR-0176 cl.1): pure pattern composition over ALREADY-SHIPPED FACE
// controls (ui-form-provider · ui-field · ui-text-field · ui-checkbox · ui-button · ui-card) — no new control,
// the same "labelled, validated form" spine the forms.ts guide narrates, matched exactly (page-supplies-the-
// rhythm, provider.submit()'s reportValidity gate).
//
// Two forms share one "am I signed in" state, driven by the identity-mock-transport seam
// (.claude/docs/spec/identity-mock-transport.spec.md v0.1, SPEC-R1/R5): register (sign-up) and
// signInWithPassword (sign-in) both set the transport's OWN current session as a side effect (SPEC-R5 AC2);
// getSession() renders the signed-in state, clearSession() signs out (SPEC-R5 AC3) — matching decomp a1/a2.
//
// ERROR RENDERING — a real-browser-gate finding, not the header's first-draft assumption. A closed-code
// rejection (account-exists / invalid-credentials) and the client-side confirm/password mismatch check
// both call `setCustomValidity(message)` on the offending field — correct and load-bearing for
// `provider.submit()`'s OWN gate (it reads the MERGED validity, `dom/form.ts`'s `#mergedValidity()`, so a
// custom-invalid field genuinely blocks a premature resubmit). But `ui-field`'s VISIBLE `[data-part=error]`
// text is driven by `formUserInvalid()` — for `ui-text-field` that is `trackUserInvalid`'s `interacted &&
// !this.formValidity().valid` (text-field.ts:244) — and `formValidity()` is the control's own NATIVE-only
// verdict (required/pattern/email-format/etc.); it has no access to the base's PRIVATE `#customValidity`
// signal, so a PURELY custom message (no matching native constraint) never flips that gate and never
// renders inline, even though the merged validity — and therefore submit-gating — is correct. Confirmed by
// running `npm run test:browser:site` for real (credentials.browser.test.ts): three tests failed exactly
// this way before this fix. The SAME gap sits under `@agent-ui/a2ui`'s own `checks` controller (ADR-0029,
// `renderer/checks.ts`) — a fleet-level finding outside this dispatch's site-local scope (no package
// source edits here); flagged in the S1 handback, not patched here. The fix at THIS layer: every message
// above ALSO renders through the page-owned `.credentials-status` caption (ARIA-live, already built for
// the pending/success narration) — the one channel proven to actually reach the user.
//
// The interactive wiring is DEV-ONLY (SPEC-R9): a dynamic `import('../lib/identity-mock-transport.ts')`
// behind `import.meta.env.DEV`, mirroring `site/pages/agent-admin.ts`'s `wireLiveOverlay` shape (dynamic
// import + page-owned wiring, `:92-109`) but gated on the BUILD-time DEV flag rather than a runtime
// key-probe — this seam holds no secret; its own risk is presentational (a credential-shaped demo form on
// the always-public production docs site), so the fence is "not in this bundle at all" (SPEC-R9 AC2's
// dist-grep), not "degrades gracefully" (ADR-0152's DIFFERENT posture for a secret-holding overlay). In a
// production build both cards render the SAME real fleet markup (a legitimate static specimen, SPEC-R9 AC2)
// but their submit buttons stay disabled — this is the SPEC's own "static, non-interactive" arm, not a bug.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './credentials.css'
import { heading } from '../lib/doc-page.ts'
import type {
  UIFormProviderElement,
  UITextFieldElement,
  UICheckboxElement,
  UIButtonElement,
  UICardElement,
} from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time, so this reference never survives into the
// built dist/ output (SPEC-R9 AC2) — the only RUNTIME touch of this module is the dynamic import() inside
// wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockTransport, IdentitySession } from '../lib/identity-mock-transport.ts'
import { errorCodeOf } from '../lib/identity-error-code.ts'

const { content } = mountPage({
  title: 'Registration & sign in',
  intro:
    'Two forms, one shared "am I signed in" state — sign up or sign in, both wired to a real, in-memory ' +
    'mock transport in a dev/preview build. No new control: ui-form-provider + ui-field-wrapped ' +
    'ui-text-field/ui-checkbox + ui-button, the same spine the Forms guide walks.',
})

content.append(
  pageLead(
    'The demo-only transport never touches a real backend (ADR-0176 cl.2) — the fixed demo account is ' +
      'demo@agent-ui.dev / Passw0rd!. Register a new email, or sign in with the demo account; sign out to ' +
      'come back here.',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// ── one small field-building helper — every text-field below is ui-field-wrapped, matching forms.ts ────────

function field(label: string, control: HTMLElement): { field: HTMLElement; control: HTMLElement } {
  const wrapper = document.createElement('ui-field')
  wrapper.setAttribute('label', label)
  wrapper.append(control)
  return { field: wrapper, control }
}

function textField(name: string, type: string): UITextFieldElement {
  const tf = document.createElement('ui-text-field') as UITextFieldElement
  tf.setAttribute('name', name)
  tf.setAttribute('type', type)
  tf.setAttribute('required', '')
  return tf
}

// ── the sign-up card (S1-a, decomp a1) ───────────────────────────────────────────────────────────────────

interface CredentialCard {
  readonly card: UICardElement
  readonly provider: UIFormProviderElement
  readonly submitButton: UIButtonElement
  readonly status: HTMLElement
}

function buildRegisterCard(): CredentialCard & { email: UITextFieldElement; password: UITextFieldElement; confirm: UITextFieldElement } {
  const card = document.createElement('ui-card') as UICardElement
  const provider = document.createElement('ui-form-provider') as UIFormProviderElement
  provider.className = 'credentials-form'

  const email = textField('email', 'email')
  const password = textField('password', 'password')
  const confirm = textField('confirm', 'password')
  const terms = document.createElement('ui-checkbox') as UICheckboxElement
  terms.setAttribute('name', 'terms')
  terms.setAttribute('required', '')
  terms.append(text('I agree to the Terms of Service'))

  provider.append(
    field('Email', email).field,
    field('Password', password).field,
    field('Confirm password', confirm).field,
    terms,
  )

  const submitButton = document.createElement('ui-button') as UIButtonElement
  submitButton.setAttribute('variant', 'solid')
  submitButton.textContent = 'Create account'
  submitButton.setAttribute('disabled', '')
  const actions = el('div', 'credentials-actions')
  actions.append(submitButton)

  const status = el('p', 'credentials-status')
  status.setAttribute('aria-live', 'polite')

  card.append(heading(3, 'Create an account'), provider, actions, status)
  return { card, provider, submitButton, status, email, password, confirm }
}

// ── the sign-in card (S1-b, decomp a2) ───────────────────────────────────────────────────────────────────

function buildSignInCard(): CredentialCard & { email: UITextFieldElement; password: UITextFieldElement } {
  const card = document.createElement('ui-card') as UICardElement
  const provider = document.createElement('ui-form-provider') as UIFormProviderElement
  provider.className = 'credentials-form'

  const email = textField('email', 'email')
  const password = textField('password', 'password')
  provider.append(field('Email', email).field, field('Password', password).field)

  const submitButton = document.createElement('ui-button') as UIButtonElement
  submitButton.setAttribute('variant', 'solid')
  submitButton.textContent = 'Sign in'
  submitButton.setAttribute('disabled', '')
  const actions = el('div', 'credentials-actions')
  actions.append(submitButton)

  const status = el('p', 'credentials-status')
  status.setAttribute('aria-live', 'polite')

  card.append(heading(3, 'Sign in'), provider, actions, status)
  return { card, provider, submitButton, status, email, password }
}

// ── the signed-in card (SPEC-R5: getSession renders it, clearSession signs out) ─────────────────────────────

function buildSignedInCard(): { card: UICardElement; who: HTMLElement; signOutButton: UIButtonElement } {
  const card = document.createElement('ui-card') as UICardElement
  const who = el('p')
  const signOutButton = document.createElement('ui-button') as UIButtonElement
  signOutButton.setAttribute('variant', 'ghost')
  signOutButton.textContent = 'Sign out'
  const actions = el('div', 'credentials-actions')
  actions.append(signOutButton)
  card.append(heading(3, 'Signed in'), who, actions)
  card.hidden = true
  return { card, who, signOutButton }
}

const registerCard = buildRegisterCard()
const signInCard = buildSignInCard()
const signedInCard = buildSignedInCard()

const forms = el('div', 'credentials-forms')
forms.append(registerCard.card, signInCard.card)

const wiringStatus = el('p', 'credentials-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'

content.append(forms, signedInCard.card, wiringStatus)

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────────

function showSignedIn(session: IdentitySession): void {
  registerCard.card.hidden = true
  signInCard.card.hidden = true
  signedInCard.card.hidden = false
  const emailStrong = el('strong')
  emailStrong.textContent = session.email
  signedInCard.who.replaceChildren(text('Signed in as '), emailStrong, text(` (via ${session.method}).`))
}

function showForms(): void {
  registerCard.card.hidden = false
  signInCard.card.hidden = false
  signedInCard.card.hidden = true
}

/** Reflects `transport.getSession()` into the page — the render this whole demo exists to prove (SPEC-R5). */
function refreshSessionUI(transport: IdentityMockTransport): void {
  const session = transport.getSession()
  if (session) showSignedIn(session)
  else showForms()
}

function setPending(target: CredentialCard, pending: boolean, pendingLabel: string, restLabel: string): void {
  target.submitButton.toggleAttribute('disabled', pending)
  target.submitButton.textContent = pending ? pendingLabel : restLabel
}

// ── DEV-only interactive wiring (SPEC-R9) ────────────────────────────────────────────────────────────────

function wireRegister(transport: IdentityMockTransport): void {
  const { provider, submitButton, status, email, password, confirm } = registerCard

  function passwordsMismatch(): boolean {
    return confirm.value !== '' && confirm.value !== password.value
  }
  // Live, as the user types — sets the CONTROL's native platform validity (so a mismatched confirm
  // genuinely blocks provider.submit()'s gate, `#mergedValidity()`), even though its message never
  // renders through ui-field's own inline part for a pure-custom mismatch (see the file banner).
  function validateConfirm(): void {
    confirm.setCustomValidity(passwordsMismatch() ? 'Passwords do not match.' : '')
  }
  password.addEventListener('input', validateConfirm)
  confirm.addEventListener('input', validateConfirm)

  submitButton.addEventListener('click', () => {
    void (async () => {
      email.setCustomValidity('')
      validateConfirm()
      if (!provider.submit()) {
        // The status caption is the channel that actually reaches the user for a pure-custom message
        // (the mismatch) — every OTHER submit()-gated reason (an empty required field) already renders
        // natively through ui-field, so this only fires for the one case that needs it.
        status.textContent = passwordsMismatch() ? 'Passwords do not match.' : ''
        return
      }
      status.textContent = ''
      setPending(registerCard, true, 'Creating account…', 'Create account')
      try {
        const { session } = await transport.register({ email: email.value, password: password.value })
        provider.reset()
        status.textContent = ''
        showSignedIn(session)
      } catch (err) {
        const code = errorCodeOf(err)
        if (code === 'account-exists') {
          const message = 'An account with this email already exists.'
          email.setCustomValidity(message) // gates a same-value resubmit; the caption is what the user sees
          email.reportValidity()
          status.textContent = message
        } else {
          status.textContent = 'Something went wrong — try again.'
        }
      } finally {
        setPending(registerCard, false, 'Creating account…', 'Create account')
      }
    })()
  })
}

function wireSignIn(transport: IdentityMockTransport): void {
  const { provider, submitButton, status, email, password } = signInCard

  submitButton.addEventListener('click', () => {
    void (async () => {
      password.setCustomValidity('')
      if (!provider.submit()) return
      status.textContent = ''
      setPending(signInCard, true, 'Signing in…', 'Sign in')
      try {
        const { session } = await transport.signInWithPassword({ email: email.value, password: password.value })
        provider.reset()
        status.textContent = ''
        showSignedIn(session)
      } catch (err) {
        const code = errorCodeOf(err)
        if (code === 'invalid-credentials') {
          // Never distinguish which field was wrong (SPEC-R1 AC4) — the message rides the password field's
          // native validity (gating a same-value resubmit) AND the status caption (what the user sees;
          // the field's own inline part never renders a pure-custom message, see the file banner).
          const message = 'Incorrect email or password.'
          password.setCustomValidity(message)
          password.reportValidity()
          status.textContent = message
        } else {
          status.textContent = 'Something went wrong — try again.'
        }
      } finally {
        setPending(signInCard, false, 'Signing in…', 'Sign in')
      }
    })()
  })
}

function wireSignOut(transport: IdentityMockTransport): void {
  signedInCard.signOutButton.addEventListener('click', () => {
    transport.clearSession()
    registerCard.status.textContent = ''
    signInCard.status.textContent = ''
    showForms()
  })
}

function wireIdentityDemo(): void {
  void (async () => {
    if (!import.meta.env.DEV) {
      wiringStatus.textContent = 'Static specimen — the shipped build makes no transport call (see the ' +
        'identity-mock-transport SPEC\'s DEV-only fence). Run `npm run dev` for the interactive demo.'
      return
    }
    try {
      const overlay = await import('../lib/identity-mock-transport.ts')
      const transport = overlay.createIdentityMockTransport()
      wireRegister(transport)
      wireSignIn(transport)
      wireSignOut(transport)
      registerCard.submitButton.removeAttribute('disabled')
      signInCard.submitButton.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'credentials-sources')
sources.append(
  text(
    'The transport contract: identity-mock-transport.spec.md (SPEC-R1 register/signInWithPassword, SPEC-R5 ' +
      'getSession/clearSession) — a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend.',
  ),
)
content.append(sources)
