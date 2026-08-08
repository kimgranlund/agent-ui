// magic-link.browser.test.ts — S2-b's real-engine proof (GH #490 / ADR-0176). Side-effect imports the
// REAL page module (credentials.browser.test.ts's own precedent — its own file, its own document) and
// drives the flow exactly as a user would: real typed input, real clicks. Vitest browser mode runs
// under Vite's DEV server, so `import.meta.env.DEV` is true here — the SAME interactive wiring branch
// (SPEC-R9 AC1) a `npm run dev` visitor gets, never a mock/stub substituted for the test.
//
// One shared page instance for the whole file; every stateful test ends signed OUT (via the real
// sign-out button) so file order never becomes a hidden dependency, and every request uses a UNIQUE
// email so tests never collide on transport state.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import './magic-link.ts'
import type { UITextFieldElement, UIButtonElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM. This file awaits the transport's real (non-zero, default 400ms)
// SPEC-R7 latency across several sequential ops; see vitest.browser.config.ts's own class definition.
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

function cards(): { request: HTMLElement; checkEmail: HTMLElement; signedIn: HTMLElement } {
  const [request, checkEmail, signedIn] = [...document.querySelectorAll('ui-card')] as HTMLElement[]
  return { request: request!, checkEmail: checkEmail!, signedIn: signedIn! }
}
function emailField(): UITextFieldElement {
  return cards().request.querySelector('ui-text-field[name="email"]') as UITextFieldElement
}
function requestSubmitButton(): UIButtonElement {
  return cards().request.querySelector('ui-button') as UIButtonElement
}
function checkEmailButtons(): { confirm: UIButtonElement; resend: UIButtonElement } {
  const [confirm, resend] = [...cards().checkEmail.querySelectorAll('ui-button')] as UIButtonElement[]
  return { confirm: confirm!, resend: resend! }
}
function signOutButton(): UIButtonElement {
  return cards().signedIn.querySelector('ui-button') as UIButtonElement
}
function statusTextOf(card: HTMLElement): string {
  return (card.querySelector('.magic-link-status') as HTMLElement | null)?.textContent ?? ''
}
async function typeInto(field: UITextFieldElement, text: string): Promise<void> {
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement
  editor.focus() // the workbench.browser.test.ts / credentials.browser.test.ts precedent
  await userEvent.clear(editor)
  if (text.length > 0) await userEvent.type(editor, text)
}
async function signOut(): Promise<void> {
  await userEvent.click(signOutButton())
  await until(() => Boolean(cards().signedIn.hidden))
}

let seq = 0
function uniqueEmail(): string {
  seq += 1
  return `s2-magic-link-${Date.now()}-${seq}@example.com`
}

describe('magic-link.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await until(() => !requestSubmitButton().hasAttribute('disabled'), 10_000)
  })

  it('the request submit button is enabled once the mock transport is wired (never left disabled)', () => {
    expect(requestSubmitButton().hasAttribute('disabled')).toBe(false)
  })
})

describe('magic link request + confirm (decomp a6/a7, SPEC-R3)', () => {
  it('a pending state shows during the request, then the "check your email" state renders, then confirming reaches signed-in', async () => {
    const email = uniqueEmail()
    await typeInto(emailField(), email)

    const submit = requestSubmitButton()
    // SPEC-R7 AC1 — the pending state is observable: the button disables during the real latency window.
    await assertDisablesDuring(submit, () => userEvent.click(submit), 'the submit button must disable during the pending window')

    await until(() => !cards().checkEmail.hidden)
    expect(cards().checkEmail.textContent).toContain(email)
    expect(cards().request.hidden).toBe(true)

    const { confirm } = checkEmailButtons()
    await userEvent.click(confirm)
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toContain(email)
    expect(cards().signedIn.textContent).toContain('via magic-link')

    await signOut()
  })

  it('resend issues a new, still-usable link and starts the page-level cooldown (decomp a5-shaped affordance, ADR-0176 cl.1)', async () => {
    const email = uniqueEmail()
    await typeInto(emailField(), email)
    await userEvent.click(requestSubmitButton())
    await until(() => !cards().checkEmail.hidden)

    const { resend } = checkEmailButtons()
    await userEvent.click(resend)
    await until(() => statusTextOf(cards().checkEmail).length > 0)
    expect(statusTextOf(cards().checkEmail)).toContain('A new link was sent')
    // The page-level cooldown (never transport-enforced for magic link, unlike SPEC-R2's codes cooldown —
    // see this file's own banner): the button disables and shows a live countdown immediately after resend.
    expect(checkEmailButtons().resend.hasAttribute('disabled')).toBe(true)
    expect(checkEmailButtons().resend.textContent).toContain('Resend link (')

    // The resent link is genuinely usable — confirming still reaches signed-in.
    const { confirm } = checkEmailButtons()
    await userEvent.click(confirm)
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toContain(email)

    await signOut()
  })
})

// link-expired / link-invalid (SPEC-R3 AC2's unhappy paths) are proven at the unit level
// (identity-mock-transport.test.ts) rather than interactively here: link-expired needs a real 5-minute
// wait (or an option override this page's own DEV wiring never exposes) and link-invalid's one honest
// real-UI trigger (re-confirming an already-consumed, now-hidden confirm button) is a synthetic reach-in
// or a click-timing race, neither a genuine user action — the SAME "no real wall-clock wait" testing
// discipline SPEC-R7's own unit probe already establishes for this transport.
