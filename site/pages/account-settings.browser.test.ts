// account-settings.browser.test.ts — S5-a's real-engine proof (GH #615 / ADR-0176). Side-effect imports the
// REAL page module (the credentials/magic-link/otp-signin/social-signin precedent — its own file, its own
// document) and drives the flow exactly as a user would: real clicks on real controls. Vitest browser mode
// runs under Vite's DEV server, so `import.meta.env.DEV` is true here — the SAME interactive wiring branch
// (SPEC-R9 AC1) a `npm run dev` visitor gets, never a mock/stub substituted for the test.
//
// ORDER IS DELIBERATE HERE, unlike the four sign-in files (each of which ends every stateful test signed
// OUT so file order can never become a hidden dependency). This page's `SettingsStore` is module-level and
// deliberately OUTLIVES the session — that outliving IS decomp a13's fourth truth (account-settings.flow.
// json's `saved` exit), so the last describe walks sign-out → sign-in and asserts the saved value is still
// there. The suite therefore reads top-to-bottom as one journey: closed gate → view (a12) → save (a13) →
// survive a session cycle.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { userEvent, page } from 'vitest/browser'
import './account-settings.ts'
import type { UIButtonElement } from '@agent-ui/components/components'

// A DESKTOP viewport for the whole file, not the fleet's 414×896 default (vitest.browser.config.ts). Not a
// convenience: the surface's frame is a `container-type: inline-size` query container, and at 414px it
// resolves BELOW the composed ui-master-detail's own 40rem drill-in threshold — which hides the sections
// RAIL behind a drill-in (settings.browser.test.ts's own narrow leg proves that posture). The rail clicks
// below are a12's real interaction, so this file drives the width where a rail exists to click. The narrow
// drill-in itself is ui-master-detail's contract, already proven in its own suite — not re-tested here.
const DESKTOP = { width: 1440, height: 900 }

// GH #347 — REAL-TIMING HEADROOM. This file awaits the transport's real (non-zero, default 400ms) SPEC-R7
// latency across several sequential sign-in/sign-out ops; see vitest.browser.config.ts's own class definition.
vi.setConfig({ testTimeout: 30_000 })

/** Poll a synchronous predicate until true (a real setTimeout-driven op resolving, never a fake timer —
 *  the transport's own real latency, SPEC-R7). */
async function until(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** Deterministically prove an element disables during ITS OWN async pending window (SPEC-R7 AC1), hardened
 *  against automation-round-trip contention (GH #611 — the family-close debt from S3's review, PR #605):
 *  a MutationObserver records the `disabled` attribute the instant it flips, so a `userEvent` round trip
 *  that runs slow under load can never race past the operation's own completion and read an attribute that
 *  already cleared before a single post-click check ran. Byte-identical to the four sign-in pages' copy —
 *  the shared idiom this family standardised on, not a re-hand-rolled workaround. */
async function assertDisablesDuring(el: Element, act: () => Promise<void>, message: string): Promise<void> {
  let sawDisabled = el.hasAttribute('disabled')
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if ((record.target as Element).hasAttribute('disabled')) sawDisabled = true
    }
  })
  observer.observe(el, { attributes: true, attributeFilter: ['disabled'] })
  await act()
  for (const record of observer.takeRecords()) {
    if ((record.target as Element).hasAttribute('disabled')) sawDisabled = true
  }
  observer.disconnect()
  expect(sawDisabled, message).toBe(true)
}

// ── the page's own anatomy ───────────────────────────────────────────────────────────────────────────────

function cards(): { signedOut: HTMLElement; identity: HTMLElement } {
  return {
    signedOut: document.querySelector('.account-settings-gate') as HTMLElement,
    identity: document.querySelector('.account-settings-identity') as HTMLElement,
  }
}
function settingsSection(): HTMLElement {
  return document.querySelector('.account-settings-section') as HTMLElement
}
function settingsElement(): HTMLElement {
  return document.querySelector('ui-settings') as HTMLElement
}
function railItems(): HTMLElement[] {
  return [...settingsElement().querySelectorAll('ui-nav-rail-item')] as HTMLElement[]
}
function railItem(sectionId: string): HTMLElement {
  return railItems().find((item) => item.dataset.sectionId === sectionId)!
}
/** A rail item's real activator BUTTON — the node a user actually clicks, and the only one with a BOX.
 *  `ui-nav-rail-item` is `display: contents` by construction (the shipped settings.browser.test.ts states
 *  it in those words: "never itself a focusable node"), so it has no border box at ANY width — measuring it
 *  reads 0 even on a fully-painted split-posture rail, and a real (hit-tested) `userEvent.click` has no
 *  target to land on. The created `[data-part="activator"]` is both measurable and clickable (383.5×28 in
 *  the DESKTOP posture below); the shipped suite's own precedent uses a SYNTHETIC `item.click()`, which
 *  needs neither — this file drives real gestures, so it addresses the activator directly. */
function railActivator(sectionId: string): HTMLElement {
  return railItem(sectionId).querySelector('[data-part="activator"]') as HTMLElement
}
function panel(): HTMLElement {
  return settingsElement().querySelector('[data-part="panel"]') as HTMLElement
}
function savedRow(key: string): HTMLElement {
  return document.querySelector(`.account-settings-saved-row[data-key="${key}"]`) as HTMLElement
}
function savedValueOf(key: string): string {
  return savedRow(key).querySelector('dd')?.textContent ?? ''
}
function demoSignInButton(): UIButtonElement {
  return cards().signedOut.querySelector('ui-button') as UIButtonElement
}
function signOutButton(): UIButtonElement {
  return cards().identity.querySelector('ui-button') as UIButtonElement
}

async function signIn(): Promise<void> {
  await userEvent.click(demoSignInButton())
  await until(() => !settingsSection().hidden)
}
async function signOut(): Promise<void> {
  await userEvent.click(signOutButton())
  await until(() => Boolean(settingsSection().hidden))
}

describe('account-settings.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height)
    await until(() => !demoSignInButton().hasAttribute('disabled'), 10_000)
  })

  it('the demo sign-in button is enabled once the mock transport is wired (never left disabled)', () => {
    expect(demoSignInButton().hasAttribute('disabled')).toBe(false)
  })

  it('the gate is CLOSED before sign-in: the whole settings surface is unrendered, not just read-only (flow card: the signed-out abandon exit)', () => {
    expect(cards().signedOut.hidden).toBe(false)
    expect(cards().identity.hidden).toBe(true)
    expect(settingsSection().hidden).toBe(true)
    // The gate points somewhere real — the credential-form pattern S5 deliberately does not re-teach.
    expect(cards().signedOut.querySelector('a[href="./credentials.html"]')).not.toBeNull()
  })
})

describe('viewing account settings behind the session gate (decomp a12, SPEC-R5)', () => {
  it('signing in reveals the account card + the schema-driven surface: every section on the rail, the active section on the fleet form spine, every field at its schema default', async () => {
    const button = demoSignInButton()
    // SPEC-R7 AC1 — the pending state is observable: the button disables during the real latency window.
    await assertDisablesDuring(button, () => signIn(), 'the sign-in button must disable during the pending window')

    // The session, read back through SPEC-R5's getSession and rendered on the account card.
    expect(cards().signedOut.hidden).toBe(true)
    expect(cards().identity.hidden).toBe(false)
    expect(cards().identity.textContent).toContain('demo@agent-ui.dev')
    expect(cards().identity.textContent).toContain('via password')

    // a12 — the WHOLE rendered shape, not a per-part probe: three rail sections, in schema order.
    expect(railItems().map((item) => item.dataset.sectionId)).toEqual(['profile', 'notifications', 'appearance'])
    expect(railItems().map((item) => item.textContent)).toEqual(['Profile', 'Notifications', 'Appearance'])

    // …the FIRST section resolves active and generates onto the fleet form spine (ui-form-provider >
    // ui-field > the type-mapped control), with the other sections' controls genuinely absent.
    const provider = panel().querySelector('ui-form-provider') as HTMLElement
    expect(provider, 'the active section generates one ui-form-provider').not.toBeNull()
    expect(provider.querySelectorAll('ui-field')).toHaveLength(2)
    expect(provider.querySelectorAll('ui-text-field')).toHaveLength(1) // displayName: text
    expect(provider.querySelectorAll('ui-select')).toHaveLength(1) // language: select
    expect(provider.querySelector('ui-switch'), 'another section’s controls must not be mounted').toBeNull()
    expect(panel().getBoundingClientRect().width, 'the panel actually paints').toBeGreaterThan(0)

    // …and the readout shows all seven fields at their schema DEFAULT — nothing saved yet.
    expect(document.querySelectorAll('.account-settings-saved-row')).toHaveLength(7)
    expect(savedValueOf('displayName')).toBe('New member')
    expect(savedValueOf('productUpdates')).toBe('Off')
    expect(savedValueOf('securityAlerts')).toBe('On')
    expect(savedValueOf('digest')).toBe('weekly')
    expect(document.querySelectorAll('.account-settings-saved-row[data-saved]')).toHaveLength(0)
  })

  it('a real rail click switches the panel to another section (the composed ui-master-detail, unchanged by this slice)', async () => {
    // Fail LOUDLY rather than as a mystery click timeout if the frame ever resolves narrow (see this
    // file's DESKTOP note) — a hidden rail is a layout surprise, not a component regression. Measured on
    // the ACTIVATOR, not the `display: contents` item that holds it (see railActivator's own note).
    expect(railActivator('profile').getBoundingClientRect().width, 'the sections rail must paint at this width').toBeGreaterThan(0)
    await userEvent.click(railActivator('notifications'))
    await until(() => panel().querySelectorAll('ui-switch').length > 0)
    expect(panel().querySelectorAll('ui-switch')).toHaveLength(2) // productUpdates + securityAlerts
    expect(panel().querySelectorAll('ui-select')).toHaveLength(1) // digest
    expect(panel().querySelectorAll('ui-text-field')).toHaveLength(0) // profile's field DETACHED
  })
})

describe('editing and saving a preference (decomp a13)', () => {
  it('a real switch click commits through store.set — the readout reads the NEW value back OUT of the store and marks the row saved', async () => {
    // The Notifications panel is showing (previous test). Drive the real control, not its model.
    const productUpdates = panel().querySelectorAll('ui-switch')[0] as HTMLElement & { checked: boolean }
    expect(productUpdates.checked, 'starts at the schema default').toBe(false)

    await userEvent.click(productUpdates)
    await until(() => savedRow('productUpdates').hasAttribute('data-saved'))

    expect(productUpdates.checked).toBe(true)
    // The load-bearing assertion: this readout renders `store.get(key)`, so a green row is the STORE
    // holding the value — not merely the control remembering its own click.
    expect(savedValueOf('productUpdates')).toBe('On')
    expect(document.querySelectorAll('.account-settings-saved-row[data-saved]')).toHaveLength(1)
    // …and nothing else moved: the other six rows are still their schema default.
    expect(savedValueOf('securityAlerts')).toBe('On')
    expect(savedRow('securityAlerts').hasAttribute('data-saved')).toBe(false)
    expect(savedValueOf('displayName')).toBe('New member')
  })

  it('the saved preference outlives the SESSION: sign out (the gate closes again) → sign back in → still saved', async () => {
    await signOut()
    // The abandon exit, reached from a signed-in state this time.
    expect(cards().signedOut.hidden).toBe(false)
    expect(cards().identity.hidden).toBe(true)
    expect(settingsSection().hidden).toBe(true)

    await signIn()
    expect(cards().identity.textContent).toContain('demo@agent-ui.dev')
    // The STORE outlived the session: this readout is a `store.get` read, so a still-marked row means the
    // store genuinely kept the value across `clearSession()` — which is the page's deliberate posture
    // (signing out ends a session; it does not erase what that account saved).
    expect(savedValueOf('productUpdates')).toBe('On')
    expect(savedRow('productUpdates').hasAttribute('data-saved')).toBe(true)
    // The surface itself is never torn down across the cycle (schema/store are never reassigned, so
    // ui-settings never rebuilds — settings.md's own reconnect rule), so the generated control still shows
    // the edited state. Asserted as CONTINUITY, deliberately NOT as a re-seed-from-store proof: no
    // user-reachable path on this page regenerates the tree, so claiming one would be a lie about the
    // mechanism. The store-side truth is the readout above.
    await userEvent.click(railActivator('notifications'))
    await until(() => panel().querySelectorAll('ui-switch').length > 0)
    expect((panel().querySelectorAll('ui-switch')[0] as HTMLElement & { checked: boolean }).checked).toBe(true)

    await signOut()
  })
})
