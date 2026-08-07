// credentials.browser.test.ts — S1's real-engine proof (GH #490 / ADR-0176). Side-effect imports the REAL
// page module (the workbench.browser.test.ts / agent-admin-app.browser.test.ts precedent — its own file,
// its own document) and drives the two forms exactly as a user would: real typed input, real clicks. Vitest
// browser mode runs under Vite's DEV server, so `import.meta.env.DEV` is true here — the SAME interactive
// wiring branch (SPEC-R9 AC1) a `npm run dev` visitor gets, never a mock/stub substituted for the test.
//
// One shared page instance for the whole file (the module-level side-effect import runs once); every
// stateful test ends signed OUT (via the real sign-out button) so file order never becomes a hidden
// dependency, and every registration uses a UNIQUE email so tests never collide on account-exists.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import './credentials.ts'
import type { UITextFieldElement, UICheckboxElement, UIButtonElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM. This file awaits the transport's real (non-zero, default 400ms)
// SPEC-R7 latency across several sequential ops; see vitest.browser.config.ts's own class definition.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Poll a synchronous predicate until true (a real setTimeout-driven op resolving, never a fake timer —
 *  the transport's own real latency, SPEC-R7). */
async function until(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 20))
  }
}

function cards(): { register: HTMLElement; signIn: HTMLElement } {
  const [register, signIn] = [...document.querySelectorAll('.credentials-forms > ui-card')] as HTMLElement[]
  return { register: register!, signIn: signIn! }
}
function fieldOf(card: HTMLElement, name: string): UITextFieldElement {
  return card.querySelector(`ui-text-field[name="${name}"]`) as UITextFieldElement
}
function submitButtonOf(card: HTMLElement): UIButtonElement {
  return card.querySelector('ui-button') as UIButtonElement
}
function termsCheckbox(): UICheckboxElement {
  return cards().register.querySelector('ui-checkbox[name="terms"]') as UICheckboxElement
}
/** `userEvent.click` TOGGLES — a naive click-every-test leaves an earlier test's checked state to flip
 *  the WRONG way (reproduced: a successful registration resets the form via `provider.reset()`, but a
 *  FAILED one does not, so the box can already be checked going into the next test). Idempotent: only
 *  clicks when actually needed. */
async function ensureTermsChecked(): Promise<void> {
  const box = termsCheckbox()
  if (!box.checked) await userEvent.click(box)
}
function signedInCard(): HTMLElement {
  const signOut = [...document.querySelectorAll('ui-button')].find((b) => b.textContent === 'Sign out') as HTMLElement
  return signOut.closest('ui-card') as HTMLElement
}
/** The page-owned status caption for a card (`.credentials-status`) — the channel a PURE custom-validity
 *  message (no matching native constraint) actually reaches the user through. `ui-field`'s own inline
 *  `[data-part=error]` is driven by `formUserInvalid()`, which for `ui-text-field` reads ONLY the native
 *  `formValidity()` verdict (text-field.ts:244) — blind to a `setCustomValidity()`-only message (confirmed
 *  live: this file's earlier revision asserted the inline part and every one of these three cases timed
 *  out; see credentials.ts's own file banner for the full finding). */
function statusTextOf(card: HTMLElement): string {
  return (card.querySelector('.credentials-status') as HTMLElement | null)?.textContent ?? ''
}
async function typeInto(field: UITextFieldElement, text: string): Promise<void> {
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement
  editor.focus() // the workbench.browser.test.ts precedent — a direct .focus(), not userEvent.click
  await userEvent.clear(editor)
  if (text.length > 0) await userEvent.type(editor, text)
}
async function signOut(): Promise<void> {
  await userEvent.click(signedInCard().querySelector('ui-button') as HTMLElement)
  await until(() => Boolean(signedInCard().hidden))
}

let seq = 0
function uniqueEmail(): string {
  seq += 1
  return `s1-browser-${Date.now()}-${seq}@example.com`
}

describe('credentials.ts — the interactive DEV demo wires (SPEC-R9 AC1)', () => {
  beforeAll(async () => {
    await until(() => !submitButtonOf(cards().register).hasAttribute('disabled'), 10_000)
  })

  it('both submit buttons are enabled once the mock transport is wired (never left disabled)', () => {
    expect(submitButtonOf(cards().register).hasAttribute('disabled')).toBe(false)
    expect(submitButtonOf(cards().signIn).hasAttribute('disabled')).toBe(false)
  })
})

describe('registration (decomp a1, SPEC-R1)', () => {
  it('a pending state shows during submit, then a valid registration reaches the signed-in state with the right email/method', async () => {
    const { register } = cards()
    const email = uniqueEmail()
    await typeInto(fieldOf(register, 'email'), email)
    await typeInto(fieldOf(register, 'password'), 'hunter2!!')
    await typeInto(fieldOf(register, 'confirm'), 'hunter2!!')
    await ensureTermsChecked()

    const submit = submitButtonOf(register)
    await userEvent.click(submit)
    // SPEC-R7 AC1 — the pending state is observable: the button disables during the real latency window.
    expect(submit.hasAttribute('disabled'), 'the submit button must disable during the pending window').toBe(true)

    await until(() => !signedInCard().hidden)
    expect(signedInCard().textContent).toContain(email)
    expect(signedInCard().textContent).toContain('via password')
    await raf()
    expect(register.hidden).toBe(true)

    await signOut()
  })

  it('a confirm/password mismatch surfaces on the status caption, poisons confirm\'s own platform validity, and never reaches the transport', async () => {
    const { register } = cards()
    await typeInto(fieldOf(register, 'email'), uniqueEmail())
    await typeInto(fieldOf(register, 'password'), 'hunter2!!')
    await typeInto(fieldOf(register, 'confirm'), 'somethingElse!!')
    await ensureTermsChecked()
    await userEvent.click(submitButtonOf(register))
    await until(() => statusTextOf(register).length > 0)
    expect(statusTextOf(register)).toContain('do not match')
    // The submit-gating side effect: confirm's own PLATFORM validity is genuinely poisoned (SPEC §3's
    // malformed-input note — this is form-level, never reaching the transport at all).
    expect(fieldOf(register, 'confirm').validity.customError).toBe(true)
    expect(signedInCard().hidden, 'a mismatched confirm must never reach a signed-in state').toBe(true)
    // Clean up: fix the mismatch so a later interaction on this same field starts from a clear state.
    await typeInto(fieldOf(register, 'confirm'), 'hunter2!!')
    await until(() => !fieldOf(register, 'confirm').validity.customError)
  })

  it('SPEC-R1 AC2 — registering an email that already exists (the seeded demo account) rejects on the status caption', async () => {
    const { register } = cards()
    await typeInto(fieldOf(register, 'email'), 'demo@agent-ui.dev')
    await typeInto(fieldOf(register, 'password'), 'anything123!')
    await typeInto(fieldOf(register, 'confirm'), 'anything123!')
    await ensureTermsChecked()
    await userEvent.click(submitButtonOf(register))
    await until(() => statusTextOf(register).length > 0)
    expect(statusTextOf(register)).toContain('already exists')
    expect(fieldOf(register, 'email').validity.customError).toBe(true)
    expect(signedInCard().hidden).toBe(true)
  })
})

describe('email + password sign-in (decomp a2, SPEC-R1/R5)', () => {
  it('the seeded demo account signs in and reaches the signed-in state; sign-out clears it (SPEC-R5 AC3)', async () => {
    const { signIn } = cards()
    await typeInto(fieldOf(signIn, 'email'), 'demo@agent-ui.dev')
    await typeInto(fieldOf(signIn, 'password'), 'Passw0rd!')
    await userEvent.click(submitButtonOf(signIn))
    await until(() => !signedInCard().hidden)
    expect(signedInCard().textContent).toContain('demo@agent-ui.dev')
    await signOut()
    // After sign-out, both forms are visible again — getSession()'s null render (SPEC-R5 AC3).
    expect(cards().register.hidden).toBe(false)
    expect(cards().signIn.hidden).toBe(false)
  })

  it('SPEC-R1 AC4 — a wrong password rejects on the status caption, never distinguishing from an unknown email', async () => {
    const { signIn } = cards()
    await typeInto(fieldOf(signIn, 'email'), 'demo@agent-ui.dev')
    await typeInto(fieldOf(signIn, 'password'), 'not-the-real-password')
    await userEvent.click(submitButtonOf(signIn))
    await until(() => statusTextOf(signIn).length > 0)
    const wrongPasswordMessage = statusTextOf(signIn)
    expect(wrongPasswordMessage).toContain('Incorrect email or password')
    expect(fieldOf(signIn, 'password').validity.customError).toBe(true)
    expect(signedInCard().hidden).toBe(true)

    await typeInto(fieldOf(signIn, 'email'), 'nobody-at-all@example.com')
    await typeInto(fieldOf(signIn, 'password'), 'whatever123')
    await userEvent.click(submitButtonOf(signIn))
    await until(() => statusTextOf(signIn).length > 0)
    expect(statusTextOf(signIn)).toBe(wrongPasswordMessage) // same generic message, both branches
  })
})
