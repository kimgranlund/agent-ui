// otp-signin.browser.test.ts — S2-a2's real-engine proof (GH #490 / ADR-0176). Side-effect imports the REAL
// page module (credentials.browser.test.ts / magic-link.browser.test.ts precedent — its own file, its own
// document) and drives the flow exactly as a user would: real typed input, real clicks. Vitest browser mode
// runs under Vite's DEV server, so `import.meta.env.DEV` is true here — the SAME interactive wiring branch
// (SPEC-R9 AC1) a `npm run dev` visitor gets, never a mock/stub substituted for the test.
//
// One shared page instance for the whole file; every stateful test ends signed OUT (via the real sign-out
// button) or otherwise clean so file order never becomes a hidden dependency; every request uses a UNIQUE
// email so tests never collide on transport state (the S2-b idiom); `codeField.value` is explicitly reset
// before every typed code (the OTP field's own value persists across separate request cycles — nothing in
// the page ever clears it between them by design, §"Enter the code"'s own retry-in-place UX) so a PRIOR
// test's leftover digits/validity state can never bleed into the next.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import './otp-signin.ts'
import { __setTransportForTest, __setResendCooldownSecondsForTest } from './otp-signin.ts'
import { createIdentityMockTransport } from '../lib/identity-mock-transport.ts'
import type { UITextFieldElement, UIOtpFieldElement, UIButtonElement } from '@agent-ui/components/components'

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

function cards(): { request: HTMLElement; codeEntry: HTMLElement; signedIn: HTMLElement } {
  const [request, codeEntry, signedIn] = [...document.querySelectorAll('ui-card')] as HTMLElement[]
  return { request: request!, codeEntry: codeEntry!, signedIn: signedIn! }
}
function emailField(): UITextFieldElement {
  return cards().request.querySelector('ui-text-field[name="email"]') as UITextFieldElement
}
function requestSubmitButton(): UIButtonElement {
  return cards().request.querySelector('ui-button') as UIButtonElement
}
function codeField(): UIOtpFieldElement {
  return cards().codeEntry.querySelector('ui-otp-field') as UIOtpFieldElement
}
function codeFieldEditor(): HTMLElement {
  return codeField().querySelector('[data-part="editor"]') as HTMLElement
}
function codeFieldErrorPart(): HTMLElement {
  return (codeField().closest('ui-field') as HTMLElement).querySelector('[data-part="error"]') as HTMLElement
}
function resendButton(): UIButtonElement {
  return cards().codeEntry.querySelector('ui-button') as UIButtonElement
}
function signOutButton(): UIButtonElement {
  return cards().signedIn.querySelector('ui-button') as UIButtonElement
}
function statusTextOf(card: HTMLElement): string {
  return (card.querySelector('.otp-signin-status') as HTMLElement | null)?.textContent ?? ''
}
async function typeEmail(text: string): Promise<void> {
  const editor = emailField().querySelector('[data-part="editor"]') as HTMLElement
  editor.focus()
  await userEvent.clear(editor)
  if (text.length > 0) await userEvent.type(editor, text)
}
/** Types a code into the OTP field via real keystrokes (the control's OWN otp-field.browser.test.ts idiom:
 *  click-to-focus + `userEvent.keyboard`, not `.type`/`.clear` — a contenteditable numeric editor, not a
 *  native input). Resets the field's `value` FIRST (an external write — no `input`/`change`/echo, native
 *  parity) so a previous test's leftover digits can never contaminate this one. */
async function typeCode(code: string): Promise<void> {
  const field = codeField()
  field.value = ''
  const editor = codeFieldEditor()
  await userEvent.click(editor)
  await userEvent.keyboard(code)
}
async function signOut(): Promise<void> {
  await userEvent.click(signOutButton())
  await until(() => Boolean(cards().signedIn.hidden))
}

let seq = 0
function uniqueEmail(): string {
  seq += 1
  return `s2a2-otp-signin-${Date.now()}-${seq}@example.com`
}

/** Requests a fresh code and lands on the code-entry card. Returns the email used — a unique one unless
 *  `emailOverride` is given (the MINOR-1 sign-out → fast-re-request leg deliberately reuses one, below). */
async function requestCode(emailOverride?: string): Promise<string> {
  const email = emailOverride ?? uniqueEmail()
  await typeEmail(email)
  await userEvent.click(requestSubmitButton())
  await until(() => !cards().codeEntry.hidden)
  return email
}

describe('otp-signin.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await until(() => !requestSubmitButton().hasAttribute('disabled'), 10_000)
  })

  it('the request submit button is enabled once the mock transport is wired (never left disabled)', () => {
    expect(requestSubmitButton().hasAttribute('disabled')).toBe(false)
  })
})

describe('request → code entry → verify → signed-in (decomp a3/a4, SPEC-R2 AC1/AC2)', () => {
  it('a pending state shows during the request, code-entry renders the email, and the FIXED demo code (424242) auto-verifies with no submit button anywhere', async () => {
    const email = uniqueEmail()
    await typeEmail(email)

    const submit = requestSubmitButton()
    // SPEC-R7 AC1 — the pending state is observable: the button disables during the real latency window.
    await assertDisablesDuring(submit, () => userEvent.click(submit), 'the submit button must disable during the pending window')

    await until(() => !cards().codeEntry.hidden)
    expect(cards().codeEntry.textContent).toContain(email)
    expect(cards().request.hidden).toBe(true)
    // No submit button on the code-entry card — only the resend affordance (otp-field.md §2 Events: "no
    // auto-submit … acting on it is the composer's call" — this composition's call is the `change` trigger).
    // Already mid-cooldown (the countdown starts from THIS request too) — hence "Resend code (Ns)", not the
    // bare rest-state label.
    const codeEntryButtons = [...cards().codeEntry.querySelectorAll('ui-button')].map((b) => b.textContent)
    expect(codeEntryButtons).toHaveLength(1)
    expect(codeEntryButtons[0]).toContain('Resend code')

    await typeCode('424242')
    await until(() => !cards().signedIn.hidden)
    expect(cards().signedIn.textContent).toContain(email)
    expect(cards().signedIn.textContent).toContain('via code')

    await signOut()
  })
})

describe('the completion-change → verify trigger (this build\'s own watch-item leg, code-entry-control.lld.md §8)', () => {
  it('typing the 6th digit alone — no click anywhere — disables the field synchronously (the auto-submit firing) and reaches signed-in', async () => {
    await requestCode()

    const field = codeField()
    field.value = ''
    const editor = codeFieldEditor()
    await userEvent.click(editor)
    await userEvent.keyboard('424242') // the LAST keystroke completes the code — no button touched, ever

    // The verify handler's FIRST synchronous act (before its own `await`) is disabling the field — observing
    // it true here (with zero click on any button) is the concrete proof the `change` event alone drove it.
    expect(field.hasAttribute('disabled'), 'the completing keystroke must synchronously arm the verify pending state').toBe(true)

    await until(() => !cards().signedIn.hidden)
    await signOut()
  })
})

describe('rejection (SPEC-R2 AC3, wired through the #554 fixed validity path — decomp watch item)', () => {
  it('a wrong code renders through ui-field\'s inline error IMMEDIATELY off the completing keystroke alone — proving the interacted gate is already armed, no extra blur needed', async () => {
    await requestCode()

    const field = codeField()
    const errorPart = codeFieldErrorPart()
    expect(errorPart.hidden, 'error visible before any interaction').toBe(true)
    expect(field.matches(':state(user-invalid)'), 'user-invalid armed before any interaction').toBe(false)

    await typeCode('111111') // 6 digits, but not the fixed demo code — verifyOneTimeCode rejects code-invalid

    // No blur, no click elsewhere, no reportValidity-triggering action beyond the type itself — if the watch
    // item (a programmatic-submit-vs-never-interacted-field gap) applied here, this would time out.
    await until(() => !errorPart.hidden)
    expect(errorPart.textContent).toBe('That code is not valid. Try again.')
    expect(field.matches(':state(user-invalid)')).toBe(true)
    expect(cards().signedIn.hidden, 'a rejected code must never reach a signed-in state').toBe(true)

    // Recovery — fixing + re-committing clears both together (field.browser.test.ts's own recovery shape).
    await typeCode('424242')
    await until(() => !cards().signedIn.hidden)
    await signOut()
  })
})

describe('resend (decomp a5, SPEC-R2 AC4 — a REAL per-email cooldown, not a page-only UX pick)', () => {
  afterAll(() => {
    // Restore ordinary DEV defaults (both halves of the pair — see the page's own __setResendCooldownSecondsForTest banner).
    __setTransportForTest(createIdentityMockTransport())
    __setResendCooldownSecondsForTest(30)
  })

  it('cooldown starts immediately from the initial request (disabled + a live countdown, no resend click needed to arm it) and — once past cooldown — a real resend issues a new, still-usable code', async () => {
    // A short-cooldown transport + its matching displayed-countdown override (SPEC-R6's own "dial …
    // cooldown … to zero/small without touching the contract", extended to this page's mirrored UI constant
    // — real 30s cannot fit a browser test's timeout budget).
    __setTransportForTest(createIdentityMockTransport({ cooldownMs: 100 }))
    __setResendCooldownSecondsForTest(1)

    await requestCode()

    const resend = resendButton()
    // The cooldown starts from the FIRST request already (this page's own header banner) — resend is
    // disabled with a countdown well before any resend click, and a click while disabled is a genuine no-op
    // (real browsers never fire `click` on a disabled element).
    expect(resend.hasAttribute('disabled'), 'the resend cooldown must start from the initial request').toBe(true)
    expect(resend.disabled).toBe(true)
    expect(resend.textContent).toContain('Resend code (')

    await until(() => !resend.hasAttribute('disabled'), 3000) // real wall-clock wait past the short override
    expect(resend.textContent).toBe('Resend code')

    await userEvent.click(resend)
    await until(() => statusTextOf(cards().codeEntry).length > 0)
    expect(statusTextOf(cards().codeEntry)).toContain('A new code was sent')
    // startResendCooldown() takes over the disabled state again immediately (magic-link.ts's own precedent).
    expect(resend.hasAttribute('disabled')).toBe(true)

    // The resent code is genuinely usable — the fixed demo code still verifies against the NEW requestId.
    await typeCode('424242')
    await until(() => !cards().signedIn.hidden)
    await signOut()
  })
})

describe('sign-out does not clear the per-email cooldown (MINOR-1, code-checker finding on 407a240)', () => {
  it('a fast sign-out → re-request for the SAME email hits the real transport cooldown, surfaced on the request card (not the generic fallback)', async () => {
    // Deliberately the SAME email both times — the whole point is the transport's per-email
    // `lastCodeRequestAt` outliving a sign-out (identity-mock-transport.ts has no session-scoped reset).
    const email = uniqueEmail()
    await requestCode(email)
    await typeCode('424242')
    await until(() => !cards().signedIn.hidden)
    await signOut()

    // Immediately re-request for the SAME email — well inside the real (default 30s) cooldown window.
    await typeEmail(email)
    await userEvent.click(requestSubmitButton())
    await until(() => statusTextOf(cards().request).length > 0)
    expect(statusTextOf(cards().request)).toContain('wait a few seconds')
    expect(cards().codeEntry.hidden, 'a rate-limited re-request must never reach code-entry').toBe(true)
  })
})

describe('code expiry (SPEC-R2 AC3 — real wall-clock time via a test-only short-expiry transport, SPEC-R6\'s own "dial … to zero/small without touching the contract")', () => {
  afterAll(() => {
    // Restore the ordinary DEV-defaults transport so no LATER test file addition could ever inherit this
    // short expiry silently (belt-and-suspenders; this describe block is the file's last by construction).
    __setTransportForTest(createIdentityMockTransport())
  })

  it('a code submitted after its (short-overridden) expiresAt has passed rejects code-expired, rendered through the inline field error — real time, no fake clock (SPEC-R7)', async () => {
    __setTransportForTest(createIdentityMockTransport({ expiresInMs: 50, latencyMs: 0 }))

    await requestCode()
    await new Promise((r) => setTimeout(r, 150)) // real wall-clock wait past the 50ms override — no vi.useFakeTimers()

    const errorPart = codeFieldErrorPart()
    await typeCode('424242') // the fixed demo code — right value, but the request has genuinely expired
    await until(() => !errorPart.hidden)
    expect(errorPart.textContent).toBe('That code has expired. Request a new one.')
    expect(cards().signedIn.hidden).toBe(true)
  })
})
