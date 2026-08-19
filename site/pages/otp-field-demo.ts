// site/pages/otp-field-demo.ts — the ui-otp-field interaction demo (the control-tier `demo`, pairing
// otp-field-doc.html — the API page). Mounts the REAL one-time-code control (code-entry-control.lld.md, GH #490
// S2-a) in the one believable product situation it exists for — the second step of a sign-in: "we sent a code to
// k…@example" — with a PAGE-LOCAL fake verifier (the expected code is printed on the page; nothing leaves the
// browser, no network, no secret), a resend cooldown that mints a fresh code, and a live event log proving the
// contract: `input` after every value-mutating transition (digit · backspace · one per paste), `change` on the
// completion commit (the instant value.length reaches length) or blur-with-change. The verifier hangs off the
// completion `change` — the moment the sixth digit lands, the code is checked, no Verify button needed (the
// button stays for keyboard/AT parity). The control owns the editor/cell/echo anatomy, the no-gaps invariant,
// and validity (otp-field.ts) — this page only stages, verifies, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UIOtpFieldElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-otp-field — demo',
  intro:
    'The one-time-code entry control, live in a sign-in verification step. Type the six digits shown (or paste ' +
    'them, or type a wrong code) — the moment the sixth digit lands the field commits a change and the page-local ' +
    'verifier checks it; Resend mints a fresh code after a short cooldown. The event log records every input ' +
    'and change. Nothing leaves the browser. The API table is on the ui-otp-field API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared input/change event log ───────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

// ── the page-local fake verifier — deterministic, visible, browser-only (no secret, no network) ──────────────
const LENGTH = 6
let expected = '482913'
let attempts = 0
const codeOut = code(expected)
const mintCode = (): void => {
  let next = ''
  for (let i = 0; i < LENGTH; i += 1) next += String(Math.floor(Math.random() * 10))
  expected = next
  codeOut.textContent = expected
}

// ── the REAL control — length=6, required, named for the (page-local) form value ─────────────────────────────
const otp = el('ui-otp-field', { label: 'Verification code', name: 'code', length: String(LENGTH), required: '' }) as UIOtpFieldElement
otp.addEventListener('input', () => logLine(`input   value=${JSON.stringify(otp.value)}  (${otp.value.length}/${LENGTH})`))
otp.addEventListener('change', () => {
  logLine(`change  value=${JSON.stringify(otp.value)}  ${otp.value.length === LENGTH ? 'completion commit' : 'blur-with-change'}`)
  if (otp.value.length === LENGTH) verify()
})

const status = el('p', { role: 'status', style: 'margin:0.75rem 0 0; min-block-size:1.5em;' }, [text('Waiting for the code…')])
const setStatus = (msg: string, tone: 'neutral' | 'ok' | 'bad'): void => {
  status.textContent = msg
  status.style.color = tone === 'ok' ? 'var(--md-sys-color-success)' : tone === 'bad' ? 'var(--md-sys-color-danger)' : ''
}

function verify(): void {
  if (otp.value.length < LENGTH) {
    otp.reportValidity() // required + partial → the control's own validity paint
    setStatus(`Enter all ${LENGTH} digits.`, 'bad')
    logLine('verify  blocked — incomplete')
    return
  }
  attempts += 1
  if (otp.value === expected) {
    setStatus(`Verified on attempt ${attempts} — signing you in.`, 'ok')
    otp.setAttribute('disabled', '') // the step is done: freeze the field (a real flow navigates on)
    logLine(`verify  OK (attempt ${attempts})`)
  } else {
    setStatus(`That code didn’t match (attempt ${attempts}). Try again or resend.`, 'bad')
    otp.value = '' // a programmatic clear — no input/change fires; the reporter re-types
    otp.focus()
    logLine(`verify  MISMATCH (attempt ${attempts}) — field cleared programmatically (NO input/change)`)
  }
}

// ── actions — Verify (keyboard/AT parity for the auto-verify) + Resend with a cooldown ─────────────────────
const verifyButton = uiButton('Verify', 'solid')
verifyButton.addEventListener('click', verify)

const RESEND_SECONDS = 5
let cooldown = 0
const resend = uiButton('Resend code', 'ghost')
const tick = (): void => {
  if (cooldown > 0) {
    resend.textContent = `Resend in ${cooldown}s`
    cooldown -= 1
    setTimeout(tick, 1000)
  } else {
    resend.textContent = 'Resend code'
    resend.removeAttribute('disabled')
  }
}
resend.addEventListener('click', () => {
  mintCode()
  attempts = 0
  otp.removeAttribute('disabled')
  otp.value = ''
  otp.focus()
  setStatus('A new code was sent — enter it above.', 'neutral')
  logLine(`resend  new code minted → ${expected} (field cleared programmatically: NO input/change)`)
  cooldown = RESEND_SECONDS
  resend.setAttribute('disabled', '')
  tick()
})

const step = el('ui-column', { gap: 'sm' }, [
  el('p', { style: 'margin:0;' }, [
    text('We sent a 6-digit code to '), strong('k…@example.com'), text('. For this demo the code is '), codeOut,
    text(' — it lives only on this page.'),
  ]),
  otp,
  status,
  el('ui-row', { gap: 'sm', align: 'center' }, [verifyButton, resend]),
])
step.style.maxInlineSize = '28rem'

const contractNote = el('p', {}, [
  text('One focusable editable surface stretched over '), code('length'), text(' presentational cells: digits '),
  strong('auto-advance'), text(', Backspace walks back, ArrowLeft/Right traverse, and a paste splits across cells ' +
    '(one '), code('input'), text(' per paste, not per digit). The '), strong('completion commit'),
  text(' fires '), code('change'), text(' the instant the last digit lands — that is what triggers the verifier ' +
    'here. A wrong code is cleared '), strong('programmatically'), text(', which fires nothing (user commits only).'),
])

// ── the axis specimens — length × size × state ──────────────────────────────────────────────────────────────
const axes = el('ui-row', { gap: 'md', align: 'end', wrap: '' }, [
  captioned('length="4" size="sm"', el('ui-otp-field', { length: '4', size: 'sm', label: 'PIN' })),
  captioned('length="6" (default)', el('ui-otp-field', { label: 'Code' })),
  captioned('length="8" size="lg"', el('ui-otp-field', { length: '8', size: 'lg', label: 'Recovery code' })),
  captioned('disabled, partial', el('ui-otp-field', { disabled: '', value: '48', label: 'Locked' })),
])

content.append(
  exampleSection('Sign-in verification step', step, contractNote),
  exampleSection('input / change event log', log),
  exampleSection('Lengths, sizes and states', axes),
)
