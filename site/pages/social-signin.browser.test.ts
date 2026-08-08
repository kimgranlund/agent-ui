// social-signin.browser.test.ts — S3-a's real-engine proof (GH #490 / ADR-0176). Side-effect imports the
// REAL page module (credentials.browser.test.ts / magic-link.browser.test.ts precedent — its own file, its
// own document) and drives the flow exactly as a user would: real clicks, no typed input at all (decomp a8
// has no email/password field). Vitest browser mode runs under Vite's DEV server, so `import.meta.env.DEV`
// is true here — the SAME interactive wiring branch (SPEC-R9 AC1) a `npm run dev` visitor gets, never a
// mock/stub substituted for the test.
//
// One shared page instance for the whole file; every stateful test ends signed OUT (via the real sign-out
// button) so file order never becomes a hidden dependency. No "unique email" isolation needed here (unlike
// credentials/magic-link/otp-signin) — SPEC-R4's seam is `{provider}`-only, stateless across calls (no
// per-email cooldown/rate-limit the way codes has), so repeated google/github sign-ins across tests are
// expected to resolve the SAME deterministic demo account every time (identity-mock-transport.test.ts's own
// SPEC-R4 AC3 unit proof) — never a collision to dedup against.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import './social-signin.ts'
import type { UIButtonElement } from '@agent-ui/components/components'

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
 *  against automation-round-trip contention (GH #611 — the family-close debt from S3's review, PR #605):
 *  a MutationObserver records the `disabled` attribute the instant it flips, so a `userEvent` round trip
 *  that runs slow under load can never race past the operation's own completion and read an attribute that
 *  already cleared before a single post-click check ran — the click-then-immediately-read-once idiom this
 *  replaces, which flaked repeatedly under load across all four identity browser test files. */
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

function cards(): { providers: HTMLElement; callback: HTMLElement; signedIn: HTMLElement } {
  const [providers, callback, signedIn] = [...document.querySelectorAll('ui-card')] as HTMLElement[]
  return { providers: providers!, callback: callback!, signedIn: signedIn! }
}
function providerButtons(): UIButtonElement[] {
  return [...cards().providers.querySelectorAll('ui-button')] as UIButtonElement[]
}
function googleButton(): UIButtonElement {
  return providerButtons().find((b) => b.textContent?.includes('Google')) as UIButtonElement
}
function githubButton(): UIButtonElement {
  return providerButtons().find((b) => b.textContent?.includes('GitHub')) as UIButtonElement
}
function callbackButtons(): { complete: UIButtonElement; cancel: UIButtonElement } {
  const [complete, cancel] = [...cards().callback.querySelectorAll('ui-button')] as UIButtonElement[]
  return { complete: complete!, cancel: cancel! }
}
function signOutButton(): UIButtonElement {
  return cards().signedIn.querySelector('ui-button') as UIButtonElement
}
function statusTextOf(card: HTMLElement): string {
  return (card.querySelector('.social-signin-status') as HTMLElement | null)?.textContent ?? ''
}
async function signOut(): Promise<void> {
  await userEvent.click(signOutButton())
  await until(() => Boolean(cards().signedIn.hidden))
}

describe('social-signin.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await until(() => !googleButton().hasAttribute('disabled'), 10_000)
  })

  it('both provider buttons are enabled once the mock transport is wired (never left disabled)', () => {
    expect(googleButton().hasAttribute('disabled')).toBe(false)
    expect(githubButton().hasAttribute('disabled')).toBe(false)
  })
})

describe('the redirect + callback + complete round trip (decomp a8, SPEC-R4 AC1/AC3)', () => {
  it('a pending state shows during the redirect, the callback card names the chosen provider, and completing reaches signed-in', async () => {
    const button = googleButton()
    // SPEC-R7 AC1 — the pending state is observable: the button disables during the real latency window.
    await assertDisablesDuring(button, () => userEvent.click(button), 'the provider button must disable during the pending window')

    await until(() => !cards().callback.hidden)
    expect(cards().providers.hidden).toBe(true)
    expect(cards().callback.textContent).toContain('Google')

    const { complete } = callbackButtons()
    await userEvent.click(complete)
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toContain('via social')

    await signOut()
  })

  it('the SAME deterministic demo account is reached across separate sign-ins for the same provider (SPEC-R4 AC3 — no per-call randomness)', async () => {
    await userEvent.click(githubButton())
    await until(() => !cards().callback.hidden)
    await userEvent.click(callbackButtons().complete)
    await until(() => !cards().signedIn.hidden)
    const firstWho = cards().signedIn.textContent
    await signOut()

    await userEvent.click(githubButton())
    await until(() => !cards().callback.hidden)
    await userEvent.click(callbackButtons().complete)
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toBe(firstWho)

    await signOut()
  })
})

describe('cancel (decomp a8\'s unhappy path, SPEC-R4 AC4 — the "generic" demo-denial affordance)', () => {
  it('cancelling on the callback card rejects social-denied, surfaces on the status caption, and never reaches signed-in', async () => {
    await userEvent.click(googleButton())
    await until(() => !cards().callback.hidden)

    const { cancel } = callbackButtons()
    await userEvent.click(cancel)
    await until(() => statusTextOf(cards().callback).length > 0)
    expect(statusTextOf(cards().callback)).toBe('Sign-in was cancelled.')
    expect(cards().signedIn.hidden, 'a cancelled sign-in must never reach a signed-in state').toBe(true)
    expect(cards().callback.hidden, 'cancelling stays on the callback card for a retry').toBe(false)

    // Recovery — the callback card preserved which provider was started; completing still works.
    const { complete } = callbackButtons()
    await userEvent.click(complete)
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toContain('google@social.agent-ui.dev')

    await signOut()
  })
})
