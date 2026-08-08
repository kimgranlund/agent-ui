// onboarding.browser.test.ts — S4-a/S4-c's real-engine proof (GH #490 / ADR-0176 / GH #614). Side-effect
// imports the REAL page module (social-signin.browser.test.ts precedent — its own file, its own document)
// and drives the flow exactly as a user would: real clicks, real typed input, real progress-cell counting
// off the light DOM `ui-progress` paints (SPEC-R2/Amendment v1) rather than internals-only ARIA (probing
// internals needs a subclass hack `progress.test.ts` uses at the unit level — unavailable to a page-level
// consumer, so this file asserts the SAME real `[data-part="cell"][data-filled]` DOM the control paints).
//
// One shared page instance for the whole file; every stateful test ends signed OUT (via the real sign-out
// button) so file order never becomes a hidden dependency — the social-signin.browser.test.ts precedent.
// No "unique email" isolation needed (unlike credentials/magic-link/otp-signin): this page always signs in
// as the ONE fixed seeded demo account (SPEC-R6), so repeated sign-ins across tests are expected to resolve
// the SAME session every time.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import './onboarding.ts'
import type { UIButtonElement, UIProgressElement, UITextFieldElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM. This file awaits the transport's real (non-zero, default 400ms) SPEC-R7
// latency across several sequential ops; see vitest.browser.config.ts's own class definition.
vi.setConfig({ testTimeout: 30_000 })

/** Poll a synchronous predicate until true (a real setTimeout-driven op resolving, never a fake timer — the
 *  transport's own real latency, SPEC-R7). */
async function until(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** Deterministically prove an element disables during ITS OWN async pending window (SPEC-R7 AC1), hardened
 *  against automation-round-trip contention (GH #611 — the social-signin.browser.test.ts precedent): a
 *  MutationObserver records the `disabled` attribute the instant it flips, so a `userEvent` round trip that
 *  runs slow under load can never race past the operation's own completion and read an attribute that
 *  already cleared before a single post-click check ran. */
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

function cards(): { signedOut: HTMLElement; step: HTMLElement; done: HTMLElement } {
  const [signedOut, step, done] = [...document.querySelectorAll('ui-card')] as HTMLElement[]
  return { signedOut: signedOut!, step: step!, done: done! }
}
function signInButton(): UIButtonElement {
  return cards().signedOut.querySelector('ui-button') as UIButtonElement
}
/** Found by TEXT, not DOM position — the action row's order (back, skip, next) is itself a fact under
 *  test (the wizard-convention reorder below), so indexing by position here would make the helper blind
 *  to a regression in that very order. `next`'s label alternates "Next"/"Finish" on the last step. */
function stepButtons(): { back: UIButtonElement; next: UIButtonElement; skip: UIButtonElement } {
  const buttons = [...cards().step.querySelectorAll('.onboarding-actions ui-button')] as UIButtonElement[]
  const back = buttons.find((b) => b.textContent === 'Back')!
  const skip = buttons.find((b) => b.textContent === 'Skip')!
  const next = buttons.find((b) => b.textContent === 'Next' || b.textContent === 'Finish')!
  return { back, next, skip }
}
function stepProgress(): UIProgressElement {
  return cards().step.querySelector('ui-progress') as UIProgressElement
}
function filledCellCount(): number {
  return stepProgress().querySelectorAll('[data-part="cell"][data-filled]').length
}
function totalCellCount(): number {
  return stepProgress().querySelectorAll('[data-part="cell"]').length
}
function stepHeadingText(): string {
  return (cards().step.querySelector('h3') as HTMLElement | null)?.textContent ?? ''
}
function workspaceField(): UITextFieldElement {
  return cards().step.querySelector('ui-text-field') as UITextFieldElement
}
async function typeInto(field: UITextFieldElement, textValue: string): Promise<void> {
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement
  editor.focus() // the credentials.browser.test.ts precedent — a direct .focus(), not userEvent.click
  await userEvent.clear(editor)
  if (textValue.length > 0) await userEvent.type(editor, textValue)
}
function themeRadios(): HTMLElement[] {
  return [...cards().step.querySelectorAll('ui-radio')] as HTMLElement[]
}
function doneSummaryText(): string {
  return (cards().done.querySelector('p') as HTMLElement | null)?.textContent ?? ''
}
function signOutButton(): UIButtonElement {
  return cards().done.querySelector('ui-button') as UIButtonElement
}
async function signIn(): Promise<void> {
  await userEvent.click(signInButton())
  await until(() => !cards().step.hidden)
}
async function signOut(): Promise<void> {
  await userEvent.click(signOutButton())
  await until(() => !cards().signedOut.hidden)
}

describe('onboarding.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await until(() => !signInButton().hasAttribute('disabled'), 10_000)
  })

  it('the sign-in button is enabled once the mock transport is wired (never left disabled)', () => {
    expect(signInButton().hasAttribute('disabled')).toBe(false)
  })

  it('starts signed out (SPEC-N7 — a fresh page load has no session)', () => {
    expect(cards().signedOut.hidden).toBe(false)
    expect(cards().step.hidden).toBe(true)
    expect(cards().done.hidden).toBe(true)
  })
})

describe('sign-in gates the journey (SPEC-N7 — getSession() only, no new transport op)', () => {
  it('a pending state shows during sign-in, then the step shell opens on Welcome, step 1 of 3', async () => {
    const button = signInButton()
    await assertDisablesDuring(button, () => userEvent.click(button), 'the sign-in button must disable during the pending window')

    await until(() => !cards().step.hidden)
    expect(cards().signedOut.hidden).toBe(true)
    expect(stepHeadingText()).toBe('Welcome')
    expect(totalCellCount()).toBe(3) // segments="3" (SPEC-R1 Amendment v1)
    expect(filledCellCount()).toBe(1) // current="1" — "Step 1 of 3"
    // Wizard convention: regress-left, advance-at-the-trailing-edge — back, skip, then the primary next.
    const actionOrder = [...cards().step.querySelectorAll('.onboarding-actions ui-button')].map((b) => b.textContent)
    expect(actionOrder).toEqual(['Back', 'Skip', 'Next'])

    await signOut()
  })
})

describe('advance/retreat through steps (decomp a9) — the progress readout advances with them (decomp a10)', () => {
  it('Next carries the progress cells forward through all three steps; Back carries them back, preserving entered values', async () => {
    await signIn()
    expect(stepHeadingText()).toBe('Welcome')
    expect(stepButtons().back.hasAttribute('disabled')).toBe(true) // nothing to go back to on step 1

    await userEvent.click(stepButtons().next)
    await until(() => stepHeadingText() === 'Workspace name')
    expect(filledCellCount()).toBe(2)
    expect(stepButtons().back.hasAttribute('disabled')).toBe(false)
    await typeInto(workspaceField(), 'Acme, Inc.')

    await userEvent.click(stepButtons().next)
    await until(() => stepHeadingText() === 'Choose a theme')
    expect(filledCellCount()).toBe(3)
    expect(stepButtons().next.textContent).toBe('Finish') // relabelled on the last step
    expect(stepButtons().skip.hidden, 'Skip is redundant with Finish on the last step').toBe(true)
    await userEvent.click(themeRadios()[1]!) // Dark

    // Back twice returns to Welcome; the workspace value survives the round trip (light-DOM identity, no rebuild).
    await userEvent.click(stepButtons().back)
    await until(() => stepHeadingText() === 'Workspace name')
    expect(workspaceField().value).toBe('Acme, Inc.')
    await userEvent.click(stepButtons().back)
    await until(() => stepHeadingText() === 'Welcome')
    expect(filledCellCount()).toBe(1)

    // Forward again all the way to Finish reaches done, reflecting the preserved values.
    await userEvent.click(stepButtons().next)
    await until(() => stepHeadingText() === 'Workspace name')
    await userEvent.click(stepButtons().next)
    await until(() => stepHeadingText() === 'Choose a theme')
    await userEvent.click(stepButtons().next) // "Finish"
    await until(() => !cards().done.hidden)
    expect(doneSummaryText()).toContain('Acme, Inc.')
    expect(doneSummaryText()).toContain('Dark')

    await signOut()
  })
})

describe('skip (decomp a11) reaches the SAME done state from any step, no completion required', () => {
  it('skipping straight from Welcome reaches done with unset values', async () => {
    await signIn()
    expect(stepHeadingText()).toBe('Welcome')
    await userEvent.click(stepButtons().skip)
    await until(() => !cards().done.hidden)
    expect(doneSummaryText()).toContain('(not set)')

    await signOut()
  })

  it('skipping from a middle step reaches done reflecting whatever was entered so far', async () => {
    await signIn()
    await userEvent.click(stepButtons().next)
    await until(() => stepHeadingText() === 'Workspace name')
    await typeInto(workspaceField(), 'Mid-Skip Co')
    await userEvent.click(stepButtons().skip)
    await until(() => !cards().done.hidden)
    expect(doneSummaryText()).toContain('Mid-Skip Co')
    expect(doneSummaryText()).toContain('Theme: (not set)') // theme step never reached

    await signOut()
  })
})
