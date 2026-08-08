// site/pages/account-settings.ts — S5-a (Account Management), GH #615 / ADR-0176 cl.4's FIFTH and last
// slice. Lane C, NO new control, no extraction (ADR-0176 cl.1): `ui-settings` (@agent-ui/app) has been the
// fleet's general schema-driven settings surface since M4 — the whole S5 scope is the WORKED EXEMPLAR that
// was missing, a GENERIC account-settings `SettingsSchema` instance (nothing agent-admin-specific about it)
// driven through a real `SettingsStore`, gated on a real session. Hosts decomp a12 (view account settings/
// preferences) + a13 (edit and save a preference), identity-flow.decomp.md §3.
//
// THE TRANSPORT SURFACE IS SMALL ON PURPOSE. Everything about viewing/editing/saving a preference is PURE
// CLIENT-SIDE `ui-settings` + `SettingsStore` state — not one transport call (SPEC-N7's own reasoning for S4,
// which applies verbatim here: the seam earns no new op). This page touches identity-mock-transport in
// exactly three places, all pre-existing operations, no SPEC-R11 amendment needed:
//   · SPEC-R5 `getSession()`  — the "am I signed in" gate, read on wire and after every state change
//   · SPEC-R5 `clearSession()` — the sign-out affordance
//   · SPEC-R1 `signInWithPassword()` — the demo-account button, see the REACHABILITY fork below
//
// FORK — WHY THERE IS A SIGN-IN BUTTON ON AN ACCOUNT-SETTINGS PAGE (a real judgment call, recorded here
// rather than made silently). The gate S5 needs is "must be signed in", and the decomp's S4→S5 edge lets a
// later slice presume an earlier slice's sign-in state. But that presumption cannot survive a page load:
// SPEC-N3 gives the mock transport NO cross-reload persistence and every identity page constructs its OWN
// `createIdentityMockTransport()` closure, so a visitor arriving from credentials.html lands here with a
// guaranteed-null session. A gate that only points at ./credentials.html would therefore be the ONLY state
// this page can ever render — a dead exemplar. So the signed-out card carries both: the pointer to
// ./credentials.html (where the real credential-form pattern is taught — S5 does not re-teach it) AND one
// button that signs in as SPEC-R6's pre-seeded demo account (`demo@agent-ui.dev`/`Passw0rd!`, AC1). One
// button, no second credential form — the smallest affordance that makes a12/a13 reachable.
//
// FORK — THE STORE IS IN-MEMORY, NOT `persistKey`-BACKED (unlike settings.ts's own control guide, which
// demonstrates the localStorage round-trip deliberately). These preferences belong to a SESSION that dies
// with the page by construction (SPEC-N3); outliving it in localStorage would say something false about
// where account preferences live. The save is still genuinely observable — the "Saved preferences" readout
// below reads back through `store.get()` on every `store.subscribe` notification, so a13's commit is
// rendered, not merely asserted.
//
// FORK — THE SESSION'S OWN FIELDS ARE NOT SCHEMA FIELDS. `IdentitySession` (`accountId`/`email`/`method`)
// is read-only demo state, and `SettingsFieldType` has no read-only member (settings.md's type table:
// text/number/date/boolean/select/slider, every one of them editable + store-committing). Rendering the
// email as a `text` field would therefore advertise an edit this seam cannot perform. The session renders
// in the page's own identity card instead, and the schema stays purely a set of editable PREFERENCES —
// which is also what keeps it generic (no session shape leaks into it).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/master-detail-pane.css' // the panes ui-settings composes
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/settings.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import './account-settings.css' // page-local rhythm LAST — layout only, never a control's internals (ADR-0102)
import { heading } from '../lib/doc-page.ts'
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { UISettingsElement } from '@agent-ui/app/settings'
import type { SettingsSchema } from '@agent-ui/app/settings-schema'
import type { UIButtonElement, UICardElement } from '@agent-ui/components/components'
// TYPE-ONLY (verbatimModuleSyntax): erased at compile time (SPEC-R9 AC2) — the only RUNTIME touch of that
// module is the dynamic import() inside wireIdentityDemo's DEV-gated branch below.
import type { IdentityMockTransport, IdentitySession } from '../lib/identity-mock-transport.ts'
import { errorCodeOf } from '../lib/identity-error-code.ts'

/** SPEC-R6's pre-seeded demo account (AC1: reachable via `signInWithPassword` with no prior `register`). */
const DEMO_EMAIL = 'demo@agent-ui.dev'
const DEMO_PASSWORD = 'Passw0rd!'

const { content } = mountPage({
  title: 'Account settings',
  intro:
    'The account-management surface of the identity family: a generic account SettingsSchema rendered by ' +
    'the shipped ui-settings — a sections rail + panel whose every field is generated onto the fleet’s own ' +
    'form spine — behind a real "must be signed in" gate. No new control: S5 adds a worked exemplar, not a ' +
    'component (ADR-0176 cl.1).',
})

content.append(
  pageLead(
    'Viewing and editing a preference is pure client-side state — the schema plus a SettingsStore, not a ' +
      'single network call. The only thing the identity transport is asked for here is "is anyone signed ' +
      'in?" (getSession) and "sign them out" (clearSession).',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// ── the schema (S5-a): GENERIC account settings, no product/app specifics ────────────────────────────────
// Three sections so the rail is real (a single-section schema renders detail-only by design — settings.md's
// `data-single-section` row), and three of the six v1 field types so the type→control mapping is visible:
// text → ui-text-field, select → ui-select, boolean → ui-switch.

const ACCOUNT_SETTINGS_SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'profile',
      label: 'Profile',
      description: 'How this account appears to other people.',
      fields: [
        {
          key: 'displayName',
          type: 'text',
          label: 'Display name',
          description: 'Shown next to anything you post.',
          default: 'New member',
          validation: { required: true },
        },
        {
          key: 'language',
          type: 'select',
          label: 'Language',
          default: 'en',
          options: [
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
            { value: 'fr', label: 'Français' },
          ],
        },
      ],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'What this account is allowed to email you about.',
      fields: [
        {
          key: 'productUpdates',
          type: 'boolean',
          label: 'Product updates',
          description: 'Occasional release notes.',
          default: false,
        },
        {
          key: 'securityAlerts',
          type: 'boolean',
          label: 'Security alerts',
          description: 'A sign-in from a device this account has not used before.',
          default: true,
        },
        {
          key: 'digest',
          type: 'select',
          label: 'Activity digest',
          default: 'weekly',
          options: [
            { value: 'never', label: 'Never' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
          ],
        },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      description: 'Stored as a preference only — this demo themes nothing off it.',
      fields: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          default: 'system',
          options: [
            { value: 'system', label: 'Match my system' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
        },
        { key: 'reduceMotion', type: 'boolean', label: 'Reduce motion', default: false },
      ],
    },
  ],
}

/** The demo's persistence (settings.md's `SettingsStore` seam). In-memory by ruling — see this file's own
 *  store fork above. Module-level, so it OUTLIVES a sign-out/sign-in cycle within one page lifetime: a
 *  preference saved before signing out is still there after signing back in. */
const store = createMemoryStore()

// ── the signed-out gate (SPEC-R5: getSession() === null) ─────────────────────────────────────────────────

const signedOutCard = document.createElement('ui-card') as UICardElement
signedOutCard.className = 'account-settings-gate'
const signedOutLead = el('p')
signedOutLead.append(
  text('Account settings belong to an account, so this surface stays closed until '),
  text('getSession() returns one. The credential, magic-link, one-time-code and social pages each reach a '),
  text('signed-in state — but the mock transport keeps no state across a page load (its spec forbids it), '),
  text('so a session started on another page never arrives here. Sign in on this page instead:'),
)
const demoSignInButton = document.createElement('ui-button') as UIButtonElement
demoSignInButton.setAttribute('variant', 'solid')
demoSignInButton.textContent = 'Sign in as the demo account'
demoSignInButton.setAttribute('disabled', '')
const credentialsLink = document.createElement('a')
credentialsLink.href = './credentials.html'
credentialsLink.textContent = 'Or use the full sign-in form'
const signedOutActions = el('div', 'account-settings-actions')
signedOutActions.append(demoSignInButton, credentialsLink)
const signedOutStatus = el('p', 'account-settings-status')
signedOutStatus.setAttribute('aria-live', 'polite')
signedOutCard.append(heading(3, 'Sign in to manage this account'), signedOutLead, signedOutActions, signedOutStatus)
signedOutCard.hidden = true

// ── the account identity card: the session, read-only (see the session-fields fork above) ────────────────

const identityCard = document.createElement('ui-card') as UICardElement
identityCard.className = 'account-settings-identity'
const identityWho = el('p')
const signOutButton = document.createElement('ui-button') as UIButtonElement
signOutButton.setAttribute('variant', 'ghost')
signOutButton.textContent = 'Sign out'
const identityActions = el('div', 'account-settings-actions')
identityActions.append(signOutButton)
identityCard.append(heading(3, 'Account'), identityWho, identityActions)
identityCard.hidden = true

// ── the settings surface (decomp a12) + the saved-values readout (decomp a13) ────────────────────────────

const settingsSection = el('section', 'account-settings-section')
const settingsElement = document.createElement('ui-settings') as UISettingsElement
settingsElement.className = 'account-settings-surface'
settingsElement.schema = ACCOUNT_SETTINGS_SCHEMA
settingsElement.store = store
const settingsFrame = el('div', 'account-settings-frame')
settingsFrame.append(settingsElement)
const settingsCaption = el(
  'p',
  'account-settings-caption',
)
settingsCaption.textContent =
  'Pick a section in the rail, change a field, and the surface commits it through store.set on that ' +
  'control’s own change event — per field, immediately, never batched. Drag the frame narrower than 40rem ' +
  'to see the composed ui-master-detail drill-in take over.'
const savedList = el('dl', 'account-settings-saved')
const savedCaption = el('p', 'account-settings-caption')
savedCaption.textContent =
  'Saved preferences — read back out of the SettingsStore (store.get), not out of the controls. A row ' +
  'marked “Saved” is one the store actually holds; the rest are still their schema default.'
settingsSection.append(
  heading(3, 'Preferences'),
  settingsCaption,
  settingsFrame,
  heading(4, 'Saved preferences'),
  savedCaption,
  savedList,
)
settingsSection.hidden = true

content.append(signedOutCard, identityCard, settingsSection)

const wiringStatus = el('p', 'account-settings-wiring-status')
wiringStatus.setAttribute('aria-live', 'polite')
wiringStatus.textContent = 'Loading the interactive demo…'
content.append(wiringStatus)

// ── the readout (decomp a13's visible half) ──────────────────────────────────────────────────────────────

/** Print a stored value the way the store holds it — the canonical value, not a prettified label; a
 *  boolean is the one exception (`On`/`Off` reads as a switch state, `true`/`false` reads as a bug). */
function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (value === undefined || value === '') return '—'
  return String(value)
}

/** Re-render every field's CURRENT value using generate.ts's OWN read expression (`store.get(key) ??
 *  field.default`, settings.md's persistence section) — so this readout can never disagree with what the
 *  generated controls were seeded from. A row the store genuinely holds is marked `data-saved` AND carries a
 *  real "Saved" text marker: `data-saved` only drives a colour/weight shift in the CSS, and colour is never
 *  allowed to be the sole channel for a state a reader has to perceive — the marker is the text channel of
 *  the same signal, so it is announced (no aria-hidden, no clip) rather than merely seen. */
function renderSavedValues(): void {
  const rows: HTMLElement[] = []
  for (const section of ACCOUNT_SETTINGS_SCHEMA.sections) {
    for (const field of section.fields) {
      const stored = store.get(field.key)
      const row = el('div', 'account-settings-saved-row')
      row.dataset.key = field.key
      const term = el('dt')
      term.textContent = field.label
      const value = el('dd')
      // The value lives in its OWN span, not as the `dd`'s bare text: the marker is a sibling inside the same
      // `dd`, so a reader (and a test) can address the value alone instead of parsing it out of "OnSaved".
      const valueText = el('span', 'account-settings-saved-value')
      valueText.textContent = formatValue(stored ?? field.default)
      value.append(valueText)
      if (stored !== undefined) {
        row.dataset.saved = ''
        const marker = el('span', 'account-settings-saved-marker')
        marker.textContent = 'Saved'
        value.append(marker)
      }
      row.append(term, value)
      rows.push(row)
    }
  }
  savedList.replaceChildren(...rows)
}

store.subscribe?.(() => renderSavedValues())
renderSavedValues()

// ── shared UI-state helpers ──────────────────────────────────────────────────────────────────────────────

function showSignedOut(): void {
  signedOutCard.hidden = false
  identityCard.hidden = true
  settingsSection.hidden = true
}

function showSignedIn(session: IdentitySession): void {
  const emailStrong = el('strong')
  emailStrong.textContent = session.email
  identityWho.replaceChildren(text('Signed in as '), emailStrong, text(` (via ${session.method}).`))
  signedOutCard.hidden = true
  identityCard.hidden = false
  settingsSection.hidden = false
}

/** The SHIPPED (non-DEV) build's posture: no transport exists, so there is no session to gate on and the
 *  gate card would be the only thing this page could ever render. Show the exemplar itself instead — the
 *  schema + store are pure client-side state (this file's own banner), so a static specimen is a fully
 *  honest one; only the session gate is missing, and `wiringStatus` says exactly that. */
function showStaticSpecimen(): void {
  signedOutCard.hidden = true
  identityCard.hidden = true
  settingsSection.hidden = false
}

/** Reflects `transport.getSession()` into the page — the one read this whole gate is built on (SPEC-R5). */
function refreshSessionUI(active: IdentityMockTransport): void {
  const session = active.getSession()
  if (session) showSignedIn(session)
  else showSignedOut()
}

function setPending(button: UIButtonElement, pending: boolean, pendingLabel: string, restLabel: string): void {
  button.toggleAttribute('disabled', pending)
  button.textContent = pending ? pendingLabel : restLabel
}

// ── DEV-only interactive wiring (SPEC-R9) ────────────────────────────────────────────────────────────────

// A module-level MUTABLE binding (the otp-signin.ts/social-signin.ts `__setTransportForTest` precedent):
// every handler below reads `transport` through `requireTransport()` at CALL time, so a test can swap the
// backing instance after `wireAccountSettings()` has already attached its listeners, with zero re-wiring.
let transport: IdentityMockTransport | undefined

function requireTransport(): IdentityMockTransport {
  if (transport === undefined) throw new Error('account-settings: identity transport not wired yet')
  return transport
}

/** Test-only injection seam — never called by any production path (the `__setTransportForTest` contract). */
export function __setTransportForTest(next: IdentityMockTransport): void {
  transport = next
}

function wireAccountSettings(): void {
  demoSignInButton.addEventListener('click', () => {
    void (async () => {
      signedOutStatus.textContent = ''
      setPending(demoSignInButton, true, 'Signing in…', 'Sign in as the demo account')
      try {
        await requireTransport().signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
        refreshSessionUI(requireTransport())
      } catch (err) {
        // A real catch, not a formality: the DEFAULT DEV-wired transport always carries the seeded demo
        // account (SPEC-R6 AC1), but `createIdentityMockTransport({accounts})` can legally replace the seed
        // (AC3) and `__setTransportForTest` can inject exactly such an instance — so this arm is reachable
        // by construction, and says which of the two things went wrong.
        signedOutStatus.textContent =
          errorCodeOf(err) === 'invalid-credentials'
            ? 'This transport has no demo account seeded — sign in from the credentials page instead.'
            : 'Something went wrong — try again.'
      } finally {
        setPending(demoSignInButton, false, 'Signing in…', 'Sign in as the demo account')
      }
    })()
  })

  signOutButton.addEventListener('click', () => {
    requireTransport().clearSession() // SPEC-R5 AC3
    signedOutStatus.textContent = ''
    // The STORE is deliberately untouched: signing out ends a session, it does not erase the preferences
    // that account saved. Signing back in re-shows them, still saved — the readout proves it.
    refreshSessionUI(requireTransport())
  })
}

function wireIdentityDemo(): void {
  void (async () => {
    if (!import.meta.env.DEV) {
      showStaticSpecimen()
      wiringStatus.textContent =
        'Static specimen — the shipped build makes no transport call (see the identity-mock-transport ' +
        "SPEC's DEV-only fence), so the signed-in gate is not wired here; the schema-driven surface above " +
        'is the real thing. Run `npm run dev` for the gated, interactive demo.'
      return
    }
    try {
      const overlay = await import('../lib/identity-mock-transport.ts')
      transport = overlay.createIdentityMockTransport()
      wireAccountSettings()
      demoSignInButton.removeAttribute('disabled')
      refreshSessionUI(transport)
      wiringStatus.textContent = 'Interactive demo — wired to the in-memory identity-mock-transport (dev/preview only).'
    } catch {
      showStaticSpecimen()
      wiringStatus.textContent = 'Static specimen — the interactive demo failed to load.'
    }
  })()
}

wireIdentityDemo()

const sources = el('p', 'account-settings-sources')
sources.append(
  text(
    'The surface: ui-settings (settings.md, @agent-ui/app) — schema-driven, unchanged by this slice. The ' +
      'session gate: identity-mock-transport.spec.md SPEC-R5 (getSession/clearSession) plus SPEC-R1 for the ' +
      'demo-account button — a demo-only, in-memory fake (ADR-0176 cl.2), never a real backend. The pattern ' +
      'row: agent-ui-composition-patterns (“An account-settings surface behind a sign-in gate”).',
  ),
)
content.append(sources)
