// site/pages/social-signin.ts — S3-a (Social Auth), GH #490 / ADR-0176 cl.4's "Social Auth" slice. Lane C
// composition (ADR-0176 cl.1): a provider-button row over ONE existing control (`ui-button`) — no new
// control, no `ui-form-provider` (there is no field to validate, decomp a8 has no email/password input at
// all). Mirrors magic-link.ts/otp-signin.ts's page shape (mountPage/pageLead, DEV-only wiring, the
// wireXxx(transport)/errorCodeOf/setPending idiom) — S3 is S1/S2's sibling, not a new invention.
//
// OQ2 (Kim's ruling on GH #490, 2026-08-07): GENERIC icons, not real provider brand marks — resolved here
// as NO icons at all (the most generic option, and it needs no `@agent-ui/icons` dependency or asset
// decision to revisit later): both buttons below are plain text labels ("Continue with Google" / "Continue
// with GitHub"), swappable to an icon later via the icons adapter seam with zero flow-code change, exactly
// the ruling's own reversibility note.
//
// THE REDIRECT+CALLBACK SIMULATION (decomp a8, identity-mock-transport.spec.md SPEC-R4) — no real provider,
// no `window.location` navigation, no OAuth token exchange (SPEC-N8), matching magic-link.ts's own
// "confirmMagicLink IS the click" stand-in shape one step further: `startSocialSignIn` IS the simulated
// redirect (its `redirectHint` is DISPLAY-only, shown on the callback card — never assigned to a navigation
// sink anywhere in this file), and the callback card's two actions ARE the simulated OAuth callback:
// "Complete sign-in" calls `completeSocialSignIn` for the SAME provider (SPEC-R4 AC3); "Cancel sign-in"
// calls it with the union's `provider: 'generic'` sentinel (SPEC-R4 AC4's own named "demo-denial
// affordance" — a page-level control simulating the user backing out mid-flow, regardless of which real
// provider was started; identity-mock-transport.ts's own file banner, S3 choice 2). The callback card
// preserves which provider was started across a cancellation, so "Complete sign-in" stays retryable without
// re-selecting a provider.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './social-signin.css'
import { heading } from '../lib/doc-page.ts'
import type { UIButtonElement, UICardElement } from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time (SPEC-R9 AC2) — the only RUNTIME touch of this
// module is the dynamic import() inside wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockErrorCode, IdentityMockTransport, IdentitySession, SocialProvider } from '../lib/identity-mock-transport.ts'

const { content } = mountPage({
  title: 'Social sign in',
  intro:
    'A provider-button row, a simulated redirect + callback round trip, and a signed-in state — wired to ' +
    'the SAME real, in-memory mock transport as the other identity guides, in a dev/preview build. No new ' +
    'control: plain ui-button, no form, no field to validate.',
})

content.append(
  pageLead(
    'The demo-only transport never touches a real backend (ADR-0176 cl.2) — there is no real provider and ' +
      'no real redirect; choose a provider below to see the simulated "you\'re back" callback, then complete ' +
      'or cancel the sign-in (identity-mock-transport.spec.md SPEC-R4).',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// ── the provider row (S3-a, decomp a8 — the redirect half) ──────────────────────────────────────────────

interface ProviderButton {
  readonly button: UIButtonElement
  readonly provider: SocialProvider
}

const providersCard = document.createElement('ui-card') as UICardElement
const providersActions = el('div', 'social-signin-actions')
const providerButtons: readonly ProviderButton[] = (
  [
    { provider: 'google', label: 'Continue with Google' },
    { provider: 'github', label: 'Continue with GitHub' },
  ] as const
).map(({ provider, label }) => {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'solid')
  button.textContent = label
  button.setAttribute('disabled', '')
  providersActions.append(button)
  return { button, provider }
})
const providersStatus = el('p', 'social-signin-status')
providersStatus.setAttribute('aria-live', 'polite')
providersCard.append(heading(3, 'Sign in with a provider'), providersActions, providersStatus)

// ── the callback card (S3-a, decomp a8 — the callback half) ─────────────────────────────────────────────

const callbackCard = document.createElement('ui-card') as UICardElement
const callbackWho = el('p')
const completeButton = document.createElement('ui-button') as UIButtonElement
completeButton.setAttribute('variant', 'solid')
completeButton.textContent = 'Complete sign-in'
const cancelButton = document.createElement('ui-button') as UIButtonElement
cancelButton.setAttribute('variant', 'ghost')
cancelButton.textContent = 'Cancel sign-in'
const callbackActions = el('div', 'social-signin-actions')
callbackActions.append(completeButton, cancelButton)
const callbackStatus = el('p', 'social-signin-status')
callbackStatus.setAttribute('aria-live', 'polite')
callbackCard.append(heading(3, "You're back"), callbackWho, callbackActions, callbackStatus)
callbackCard.hidden = true

// ── the signed-in card (SPEC-R5: getSession renders it, clearSession signs out) ────────────────────────

const signedInCard = document.createElement('ui-card') as UICardElement
const signedInWho = el('p')
const signOutButton = document.createElement('ui-button') as UIButtonElement
signOutButton.setAttribute('variant', 'ghost')
signOutButton.textContent = 'Sign out'
const signedInActions = el('div', 'social-signin-actions')
signedInActions.append(signOutButton)
signedInCard.append(heading(3, 'Signed in'), signedInWho, signedInActions)
signedInCard.hidden = true

content.append(providersCard, callbackCard, signedInCard)

const wiringStatus = el('p', 'social-signin-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'
content.append(wiringStatus)

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────────

type View = 'providers' | 'callback' | 'signed-in'

function showView(view: View): void {
  providersCard.hidden = view !== 'providers'
  callbackCard.hidden = view !== 'callback'
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
  else showView('providers')
}

function setPending(button: UIButtonElement, pending: boolean, pendingLabel: string, restLabel: string): void {
  button.toggleAttribute('disabled', pending)
  button.textContent = pending ? pendingLabel : restLabel
}

const PROVIDER_LABEL: Record<SocialProvider, string> = { google: 'Google', github: 'GitHub', generic: 'the demo provider' }

/** Read a rejection's `.code` WITHOUT importing the `IdentityMockError` class as a runtime value
 *  (credentials.ts/magic-link.ts/otp-signin.ts's own `errorCodeOf` precedent — this page only ever holds
 *  the transport's TYPES statically, SPEC-R9 AC2). */
function errorCodeOf(err: unknown): IdentityMockErrorCode | undefined {
  if (err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: IdentityMockErrorCode }).code
  }
  return undefined
}

// ── DEV-only interactive wiring (SPEC-R9) ────────────────────────────────────────────────────────────────

let currentProvider: SocialProvider | undefined

function wireSocialSignIn(transport: IdentityMockTransport): void {
  for (const { button, provider } of providerButtons) {
    button.addEventListener('click', () => {
      void (async () => {
        providersStatus.textContent = ''
        const restLabel = button.textContent ?? ''
        setPending(button, true, 'Redirecting…', restLabel)
        try {
          const { redirectHint } = await transport.startSocialSignIn({ provider })
          currentProvider = provider
          callbackWho.replaceChildren(
            text(`${redirectHint} You're back from `),
            (() => {
              const strong = el('strong')
              strong.textContent = PROVIDER_LABEL[provider]
              return strong
            })(),
            text('. Complete the sign-in, or cancel.'),
          )
          callbackStatus.textContent = ''
          showView('callback')
        } catch {
          providersStatus.textContent = 'Something went wrong — try again.'
        } finally {
          setPending(button, false, 'Redirecting…', restLabel)
        }
      })()
    })
  }

  completeButton.addEventListener('click', () => {
    void (async () => {
      if (currentProvider === undefined) return
      callbackStatus.textContent = ''
      setPending(completeButton, true, 'Completing…', 'Complete sign-in')
      try {
        const { session } = await transport.completeSocialSignIn({ provider: currentProvider })
        showSignedIn(session)
      } catch (err) {
        // Unreachable for a real provider (SPEC-R8 — social-denied fires only for the 'generic' sentinel,
        // never for 'google'/'github') — kept as the fleet's standard defensive catch-all.
        const code = errorCodeOf(err)
        callbackStatus.textContent =
          code === 'social-denied' ? 'Sign-in was cancelled.' : 'Something went wrong — try again.'
      } finally {
        setPending(completeButton, false, 'Completing…', 'Complete sign-in')
      }
    })()
  })

  cancelButton.addEventListener('click', () => {
    void (async () => {
      callbackStatus.textContent = ''
      setPending(cancelButton, true, 'Cancelling…', 'Cancel sign-in')
      try {
        // The demo-denial sentinel (SPEC-R4 AC4) — deliberately NOT `currentProvider`: cancelling always
        // passes the union's fixed 'generic' value, regardless of which real provider was started.
        await transport.completeSocialSignIn({ provider: 'generic' })
      } catch (err) {
        const code = errorCodeOf(err)
        callbackStatus.textContent =
          code === 'social-denied' ? 'Sign-in was cancelled.' : 'Something went wrong — try again.'
      } finally {
        setPending(cancelButton, false, 'Cancelling…', 'Cancel sign-in')
      }
    })()
  })

  signOutButton.addEventListener('click', () => {
    transport.clearSession()
    providersStatus.textContent = ''
    callbackStatus.textContent = ''
    currentProvider = undefined
    showView('providers')
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
      wireSocialSignIn(transport)
      for (const { button } of providerButtons) button.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'social-signin-sources')
sources.append(
  text(
    'The transport contract: identity-mock-transport.spec.md (SPEC-R4 startSocialSignIn/completeSocialSignIn) ' +
      '— a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend, never a real redirect (SPEC-N8).',
  ),
)
content.append(sources)
