// site/pages/onboarding.ts — S4-a/S4-c (Onboarding step shell), GH #490 / ADR-0176 cl.4's "Onboarding"
// slice. Lane C composition (ADR-0176 cl.1): next/back/skip navigation over plain `ui-button` + page-level
// signal-driven panel switching — "the same shape any multi-view page already uses; no new interactive
// control required" — plus the just-shipped `ui-progress` `segments` prop (SPEC-R1 Amendment v1,
// feed-family.spec.md, GH #614) for a literal discrete "Step N of M" readout. Mirrors social-signin.ts's
// page shape most closely (no form, no `ui-form-provider` — decomp a9/a10/a11 has no field to validate),
// widened one level: a per-STEP content swap inside the step-shell card, on top of the same cross-CARD
// `showView` hidden-toggle every identity page already uses.
//
// SPEC-N7 (identity-mock-transport.spec.md) — onboarding earns NO new transport operation. It consumes
// only SPEC-R5's `getSession()` to gate its first-run journey on an existing demo session. This is its own
// MPA entry (its own fresh `createIdentityMockTransport()` instance per SPEC-N3's no-cross-reload-
// persistence rule), so a fresh page load always starts signed OUT — there is no real "arrived here from
// Authentication" hop to demo against. "Simulate a completed sign-in" below calls `signInWithPassword`
// against the SPEC-R6 seeded demo account (demo@agent-ui.dev / Passw0rd!) — the cleanest Lane-C stand-in
// for decomp §5's S3→S4 edge ("a first-run journey presumes a completed sign-in"), never a second
// credential form.
//
// ONBOARDING CONTENT (decomp a9/a10/a11) — three illustrative first-run steps, deliberately NOT a real
// product feature (ADR-0176 cl.3's deferred-not-foreclosed posture for real Onboarding content): Welcome
// (no input) -> Workspace name (a plain `ui-text-field`, no validation gate, no persistence) -> Choose a
// theme (a plain `ui-radio-group` over three options, NOT wired to the site's own real theme — an
// illustrative specimen only). `ui-progress[current][segments="3"]` reads "Step N of M" across all three
// (SPEC-R1 Amendment v1). Skip (any step) and Finish (the third step) both reach the SAME 'done' state —
// completing the last step is a different PATH there, never a different outcome (decomp a11).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './onboarding.css'
import { heading } from '../lib/doc-page.ts'
import type {
  UIButtonElement,
  UICardElement,
  UIProgressElement,
  UIRadioGroupElement,
  UITextFieldElement,
} from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time (SPEC-R9 AC2) — the only RUNTIME touch of this
// module is the dynamic import() inside wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockTransport, IdentitySession } from '../lib/identity-mock-transport.ts'
import { errorCodeOf } from '../lib/identity-error-code.ts'

const { content } = mountPage({
  title: 'Onboarding',
  intro:
    'A next/back/skip step shell gated on an existing demo session, with a discrete "step N of M" progress ' +
    'readout — wired to the SAME real, in-memory mock transport as the other identity guides, in a dev/preview ' +
    'build. No new control: plain ui-button + ui-progress[segments], no form.',
})

content.append(
  pageLead(
    'The demo-only transport never touches a real backend (ADR-0176 cl.2) — onboarding earns no new transport ' +
      "operation, it only gates on an existing session (identity-mock-transport.spec.md SPEC-N7). Sign in below, " +
      'then step through Welcome / Workspace name / Choose a theme, or skip straight to done.',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// The ONLY credentials this page ever sends — the SPEC-R6 seeded demo account.
const DEMO_EMAIL = 'demo@agent-ui.dev'
const DEMO_PASSWORD = 'Passw0rd!'

// ── the signed-out gate (SPEC-N7 — getSession() gates the whole journey) ────────────────────────────────

const signedOutCard = document.createElement('ui-card') as UICardElement
const signInButton = document.createElement('ui-button') as UIButtonElement
signInButton.setAttribute('variant', 'solid')
signInButton.textContent = 'Simulate a completed sign-in'
signInButton.setAttribute('disabled', '')
const signedOutActions = el('div', 'onboarding-actions')
signedOutActions.append(signInButton)
const signedOutStatus = el('p', 'onboarding-status')
signedOutStatus.setAttribute('aria-live', 'polite')
const signedOutBlurb = el('p')
signedOutBlurb.textContent =
  'A first-run journey presumes a completed sign-in (decomp §5 — S4 depends on Authentication). This button ' +
  'stands in for that: it signs in as the seeded demo account, no real provider involved.'
signedOutCard.append(heading(3, 'Sign in to start onboarding'), signedOutBlurb, signedOutActions, signedOutStatus)

// ── the step shell (S4-a, decomp a9/a10/a11) ────────────────────────────────────────────────────────────

type StepId = 'welcome' | 'workspace' | 'theme'
const STEPS: readonly StepId[] = ['welcome', 'workspace', 'theme']

const stepCard = document.createElement('ui-card') as UICardElement
stepCard.hidden = true
const stepProgress = document.createElement('ui-progress') as UIProgressElement
stepProgress.setAttribute('segments', String(STEPS.length)) // SPEC-R1 Amendment v1 — discrete "Step N of M"
stepProgress.setAttribute('label', 'Onboarding progress')
const stepHeadingId = 'onboarding-step-heading'
const stepHeading = heading(3, 'Welcome')
stepHeading.id = stepHeadingId
const stepBody = el('div', 'onboarding-step-body')
const backButton = document.createElement('ui-button') as UIButtonElement
backButton.setAttribute('variant', 'ghost')
backButton.textContent = 'Back'
const nextButton = document.createElement('ui-button') as UIButtonElement
nextButton.setAttribute('variant', 'solid')
nextButton.textContent = 'Next'
const skipButton = document.createElement('ui-button') as UIButtonElement
skipButton.setAttribute('variant', 'ghost')
skipButton.textContent = 'Skip'
const stepActions = el('div', 'onboarding-actions')
// Wizard convention: regress-left, advance-at-the-trailing-edge — back, then skip, then the primary next/finish.
stepActions.append(backButton, skipButton, nextButton)
stepCard.append(stepProgress, stepHeading, stepBody, stepActions)

// Step content — built ONCE, never rebuilt (a plain ui-text-field + a plain ui-radio-group; illustrative
// only, no persistence, deliberately NOT wired to the site's own real theme provider — ADR-0176 cl.3's
// deferred-not-foreclosed posture for real Onboarding content).
const workspaceField = document.createElement('ui-text-field') as UITextFieldElement
workspaceField.setAttribute('label', 'Workspace name')
workspaceField.setAttribute('placeholder', 'Acme, Inc.')

const THEME_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]
const THEME_OPTION_LABEL: Record<string, string> = Object.fromEntries(THEME_OPTIONS.map((o) => [o.value, o.label]))
const themeGroup = document.createElement('ui-radio-group') as UIRadioGroupElement
themeGroup.setAttribute('name', 'onboarding-theme')
themeGroup.setAttribute('aria-labelledby', stepHeadingId) // group-level label — the shared step heading (in sync
// with its own textContent whenever this group is actually visible, since renderStep() sets both together)
for (const { value, label } of THEME_OPTIONS) {
  const radio = document.createElement('ui-radio')
  radio.setAttribute('value', value)
  radio.textContent = label
  themeGroup.append(radio)
}

let stepIndex = 0

/** Paint the current step: progress readout, heading, body content, and the back/next/skip affordances
 *  (back disabled on the first step — nothing to go back TO; "Next" relabels "Finish" on the last step,
 *  at which point Skip is redundant with it — same target, same `finishOnboarding()` call — so Skip hides
 *  rather than standing beside a button that already does the identical thing). */
function renderStep(): void {
  const id = STEPS[stepIndex]!
  stepProgress.setAttribute('current', String(stepIndex + 1))
  backButton.toggleAttribute('disabled', stepIndex === 0)
  const isLastStep = stepIndex === STEPS.length - 1
  nextButton.textContent = isLastStep ? 'Finish' : 'Next'
  skipButton.hidden = isLastStep
  stepBody.replaceChildren()
  if (id === 'welcome') {
    stepHeading.textContent = 'Welcome'
    const p = el('p')
    p.textContent = "Let's get your workspace set up — three quick steps, or skip straight to the end."
    stepBody.append(p)
  } else if (id === 'workspace') {
    stepHeading.textContent = 'Workspace name'
    stepBody.append(workspaceField)
  } else {
    stepHeading.textContent = 'Choose a theme'
    stepBody.append(themeGroup)
  }
}

// ── the done state ───────────────────────────────────────────────────────────────────────────────────────

const doneCard = document.createElement('ui-card') as UICardElement
doneCard.hidden = true
const doneWorkspace = el('strong')
const doneTheme = el('strong')
const doneSummary = el('p')
doneSummary.append(text('Workspace: '), doneWorkspace, text(' · Theme: '), doneTheme)
const signOutButton = document.createElement('ui-button') as UIButtonElement
signOutButton.setAttribute('variant', 'ghost')
signOutButton.textContent = 'Sign out'
const doneActions = el('div', 'onboarding-actions')
doneActions.append(signOutButton)
doneCard.append(heading(3, "You're all set"), doneSummary, doneActions)

content.append(signedOutCard, stepCard, doneCard)

const wiringStatus = el('p', 'onboarding-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'
content.append(wiringStatus)

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────────

type View = 'signed-out' | 'step' | 'done'

function showView(view: View): void {
  signedOutCard.hidden = view !== 'signed-out'
  stepCard.hidden = view !== 'step'
  doneCard.hidden = view !== 'done'
}

function goToStep(index: number): void {
  stepIndex = index
  renderStep()
  showView('step')
}

/** Skip (any step) and Finish (the last step) both land here — decomp a11: skipping is a different PATH to
 *  the same 'done' state, never a different outcome. Reads the entered workspace name / chosen theme (both
 *  purely client-side — no transport call, SPEC-N7) so the done card proves the step values actually
 *  carried through, even though neither is persisted anywhere. */
function finishOnboarding(): void {
  doneWorkspace.textContent = workspaceField.value || '(not set)'
  const chosenTheme = themeGroup.value
  doneTheme.textContent = (chosenTheme && THEME_OPTION_LABEL[chosenTheme]) || '(not set)'
  showView('done')
}

backButton.addEventListener('click', () => {
  if (stepIndex > 0) goToStep(stepIndex - 1)
})
nextButton.addEventListener('click', () => {
  if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1)
  else finishOnboarding()
})
skipButton.addEventListener('click', () => {
  finishOnboarding()
})

/** Reflects `transport.getSession()` into the page (SPEC-R5) — always signed-out on THIS page's own fresh
 *  load (SPEC-N3: no cross-reload persistence, a fresh MPA entry means a fresh transport instance), but
 *  written the same session-driven way every other identity page renders itself. */
function refreshSessionUI(transport: IdentityMockTransport): void {
  const session: IdentitySession | null = transport.getSession()
  if (session) goToStep(0)
  else showView('signed-out')
}

function setPending(button: UIButtonElement, pending: boolean, pendingLabel: string, restLabel: string): void {
  button.toggleAttribute('disabled', pending)
  button.textContent = pending ? pendingLabel : restLabel
}

// ── DEV-only interactive wiring (SPEC-R9) ────────────────────────────────────────────────────────────────

function wireOnboarding(transport: IdentityMockTransport): void {
  signInButton.addEventListener('click', () => {
    void (async () => {
      signedOutStatus.textContent = ''
      const restLabel = 'Simulate a completed sign-in'
      setPending(signInButton, true, 'Signing in…', restLabel)
      try {
        await transport.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
        goToStep(0)
      } catch (err) {
        // Unreachable in practice — this button only ever sends the known-good seeded credentials — kept
        // as the fleet's standard defensive catch-all (the social-signin.ts precedent for its own
        // unreachable branch).
        const code = errorCodeOf(err)
        signedOutStatus.textContent = code === 'invalid-credentials' ? 'Could not sign in — try again.' : 'Something went wrong — try again.'
      } finally {
        setPending(signInButton, false, 'Signing in…', restLabel)
      }
    })()
  })

  signOutButton.addEventListener('click', () => {
    transport.clearSession()
    // Reset the illustrative step content so the NEXT onboarding attempt starts clean — the step DOM nodes
    // are built once and never rebuilt (renderStep() only swaps which one is appended), so without this a
    // value entered on a PRIOR attempt would silently survive into a fresh sign-in.
    workspaceField.value = ''
    themeGroup.value = null
    signedOutStatus.textContent = ''
    showView('signed-out')
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
      wireOnboarding(transport)
      signInButton.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'onboarding-sources')
sources.append(
  text(
    'The transport contract: identity-mock-transport.spec.md (SPEC-N7 — onboarding earns no new operation, it ' +
      'only gates on SPEC-R5 getSession()) — a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend. ' +
      'The progress readout: feed-family.spec.md SPEC-R1 Amendment v1 (ui-progress segments, GH #614).',
  ),
)
content.append(sources)
