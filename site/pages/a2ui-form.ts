// a2ui-form.ts — the FLAGSHIP Generative Form page (A2UI form-family capstone). Where a2ui-canvas proves ONE
// Button round-trips and a2ui-list proves a data array becomes a subtree, this proves the headline of the whole
// form family: ONE A2UI v1.0 payload, fed through the REAL @agent-ui/a2ui renderer (createRenderer), becomes a
// complete, accessibly-labelled, VALIDATED form — and a valid submit round-trips the typed aggregate back out as
// a single `action` client→server message. Nothing here reaches into renderer internals; it drives the public
// host surface exactly as the server transport would, so the page IS the integration proof made visible.
//
// Data flow, left→right (the a2ui-canvas 3-region flow):
//   [1] PAYLOAD    the three server messages (createSurface · updateDataModel · updateComponents), shown as
//                  readable JSON DERIVED from the same objects fed to the renderer — so shown ≡ fed, drift is
//                  structurally impossible.
//   [2] FORM       the live rendered surface: Card > FormProvider > four Fields (name / email / currency budget /
//                  Select plan) + a Switch + a required Checkbox + a submit Button. Below it, a page-IDL panel:
//                  the submit outcome + the provider's OWN `change` aggregate (LLD-C7 FormSubmitDetail).
//   [3] MESSAGES   the client→server log: an INVALID submit emits NOTHING (the ADR-0054 gate refuses + the
//                  platform focuses the first invalid control); a VALID submit emits ONE `action` carrying the
//                  live typed aggregate in `dataModel` (booleans stay booleans — the two-way binds wrote it).
//
// What each piece binds to in REALITY (not a mock):
//   · The submit gate is the renderer's `#wireAction` branch: a Button whose `action` carries `submit:true`
//     resolves `el.closest(registry.submitGateSelector())` on click; the FormProvider's factory carries the
//     gate mark, so the derived selector matches `ui-form-provider`; `provider.submit()` is the sole arbiter
//     (false → no emit + first-invalid `reportValidity`; true → emit). See ADR-0054.
//   · The `checks` (ADR-0029) ride the TextFields: `{call:'required'|'email', args:{value:{path}}, message}` →
//     `setCustomValidity` → the ui-field inline error. At G7 ONLY text-field wires that inline-error leg
//     (LLD-C9); the required Checkbox / required Select surface validity through `reportValidity` FOCUS on
//     submit, not inline text — stated on the page where the checks are explained (honest to the backlog).
//   · The typed aggregate rides the DATA MODEL: `sendDataModel:true` on createSurface, inputs two-way-bind under
//     `/form/*`, and the valid submit's `action.dataModel` is the live model (action.ts). Deliberately NOT the
//     provider's native-FormData aggregate — that admits File/FormData and coerces booleans to `'on'`/absent
//     (shown side by side in region 2 so the distinction teaches itself).

import { mountFullBleedPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './a2ui-form.css' // page-local layout chrome only (the 3-region flow + the form panels + the log)
import { codeBlock } from '../lib/code-block.ts' // shared <pre><code> previews (textContent, no injection)
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, A2uiClientMessage, A2uiServerMessage } from '@agent-ui/a2ui'
import { UIFormProviderElement, type FormSubmitDetail } from '@agent-ui/components/components'

// FULL-BLEED: the page owns the whole `.app-page` region (no sticky page-header/footer); its own CSS lays out the
// three regions. The document <title> in a2ui-form.html names the page; each region carries its own heading+blurb.
const { content } = mountFullBleedPage()

// ── the payload: the three server messages fed as JSONL (renderer dispatch.ts envelope shape) ───────────────────
// Order is createSurface → updateDataModel → updateComponents so the seeded model is present as the components
// mount (the initial field values render immediately; budget shows 450, the notify switch reads on). Typed as
// A2uiServerMessage[] so this page type-checks against the real wire contract (protocol.ts). Every prop below is
// a DECLARED default-catalog row (catalog/default/catalog.json): Field/FormProvider/Checkbox/Switch/Select/Option
// + the TextField `type/currency/step/min` reach — a payload only a coordinated form catalog can render.
const SURFACE_ID = 'form'

const CREATE_SURFACE: A2uiServerMessage = {
  version: 'v1.0',
  // sendDataModel:true ⇒ a triggered action carries the live data model (SPEC-R8 AC2) — the typed aggregate.
  createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui', sendDataModel: true },
}

const UPDATE_DATA_MODEL: A2uiServerMessage = {
  version: 'v1.0',
  // The initial model the inputs two-way-bind against under `/form/*`. name/email/plan empty + terms:false ⇒ the
  // form loads INVALID (name/plan/terms are required) — which is exactly what makes the blocked-submit demo live.
  updateDataModel: {
    surfaceId: SURFACE_ID,
    value: { form: { name: '', email: '', budget: '450', plan: '', notify: true, terms: false } },
  },
}

const UPDATE_COMPONENTS: A2uiServerMessage = {
  version: 'v1.0',
  updateComponents: {
    surfaceId: SURFACE_ID,
    components: [
      { id: 'root', component: 'Card', children: ['form'] },
      { id: 'form', component: 'FormProvider', children: ['f_name', 'f_email', 'f_budget', 'f_plan', 'row_toggles', 'actions'] },

      // Field wraps ONE control; its `label` becomes the editor's accessible name (ADR-0051 seam). The `required`
      // check surfaces the message via the text-field inline-error leg (LLD-C9); `required:true` also drives the
      // native constraint the gate's reportValidity focuses.
      { id: 'f_name', component: 'Field', label: 'Full name', child: 'in_name' },
      {
        id: 'in_name', component: 'TextField', name: 'name', required: true, value: { path: '/form/name' },
        checks: [{ call: 'required', args: { value: { path: '/form/name' } }, message: 'Name is required' }],
      },

      // email: format-only (no `required`) — `email('')` is VALID (empty is not a format error; catalog/functions).
      // So an empty email does NOT block submit; a non-empty malformed one shows the inline message.
      { id: 'f_email', component: 'Field', label: 'Email', description: 'We reply within a day', child: 'in_email' },
      {
        id: 'in_email', component: 'TextField', name: 'email', type: 'email', value: { path: '/form/email' },
        checks: [{ call: 'email', args: { value: { path: '/form/email' } }, message: 'Enter a valid email' }],
      },

      // The Wave-5 TextField reach through the catalog, zero factory code (all 1:1 accessor props): an ISO-4217
      // currency field with a 50-step and a floor. Seeded 450 in the model.
      { id: 'f_budget', component: 'Field', label: 'Budget', child: 'in_budget' },
      { id: 'in_budget', component: 'TextField', name: 'budget', type: 'currency', currency: 'EUR', step: 50, min: '0', value: { path: '/form/budget' } },

      // Select ingests its `[role=option]` children at first connect — the initial payload works by construction
      // (the renderer assembles children before root-attach). `required` + empty ⇒ a submit blocker.
      { id: 'f_plan', component: 'Field', label: 'Plan', child: 'in_plan' },
      {
        id: 'in_plan', component: 'Select', name: 'plan', required: true, placeholder: 'Choose a plan…',
        value: { path: '/form/plan' }, children: ['opt_s', 'opt_m', 'opt_l'],
      },
      { id: 'opt_s', component: 'Option', value: 'starter', label: 'Starter' },
      { id: 'opt_m', component: 'Option', value: 'pro', label: 'Pro' },
      { id: 'opt_l', component: 'Option', value: 'scale', label: 'Scale' },

      // A wrapping Row of the two boolean controls. Both two-way-bind their `checked` (the bindable prop is named
      // by the CONTROL's own prop — Checkbox.checked / Switch.checked — the ADR-0053 naming law). terms is required.
      { id: 'row_toggles', component: 'Row', gap: 'lg', wrap: true, children: ['sw_notify', 'cb_terms'] },
      { id: 'sw_notify', component: 'Switch', name: 'notify', label: 'Email me updates', checked: { path: '/form/notify' } },
      { id: 'cb_terms', component: 'Checkbox', name: 'terms', label: 'I accept the terms', required: true, checked: { path: '/form/terms' } },

      // The submit-flagged action (ADR-0054): `submit:true` is a CLIENT-consumed flag `#wireAction` reads to gate
      // the click — it never leaves the client (the emitted `action` wire shape is byte-identical to a plain one).
      { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_submit'] },
      { id: 'btn_submit', component: 'Button', variant: 'solid', label: 'Submit', action: { action: 'submit_profile', submit: true } },
    ],
  },
}

const PAYLOAD: readonly A2uiServerMessage[] = [CREATE_SURFACE, UPDATE_DATA_MODEL, UPDATE_COMPONENTS]
// The literal JSONL the renderer ingests: one compact JSON object per line. Derived from the SAME objects the
// payload pane shows, and fed through the real parse path (`ingest`, not `ingestMessage`) — the transport's path.
const jsonl = (message: A2uiServerMessage): string => JSON.stringify(message)

// ── small light-DOM scaffold helpers (page chrome only — they never restyle a ui-* control) ─────────────────────
function region(step: string, title: string, blurb: string): { section: HTMLElement; body: HTMLElement } {
  const section = document.createElement('section')
  section.className = 'region'
  const heading = document.createElement('h2')
  const badge = document.createElement('span')
  badge.className = 'region-step'
  badge.textContent = step
  heading.append(badge, document.createTextNode(` ${title}`))
  const lead = document.createElement('p')
  lead.className = 'region-blurb'
  lead.textContent = blurb
  const body = document.createElement('div')
  body.className = 'region-body'
  section.append(heading, lead, body)
  return { section, body }
}

function arrow(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'flow-arrow'
  el.setAttribute('aria-hidden', 'true')
  el.textContent = '→'
  return el
}

// A page affordance dogfooding the real control (a ui-button with a native click listener). tabindex="0" makes it
// keyboard-activatable (the control sets none itself); the press-activation trait does the rest.
function controlButton(label: string, variant: 'solid' | 'soft' | 'ghost', onClick: () => void): HTMLElement {
  const el = document.createElement('ui-button')
  el.textContent = label
  el.setAttribute('variant', variant)
  el.setAttribute('tabindex', '0')
  el.addEventListener('click', onClick)
  return el
}

// ── [1] PAYLOAD region — the three messages, shown as readable JSON, labelled by envelope key ──────────────────
const payload = region('1', 'A2UI payload', 'The three server messages fed to the renderer. Every property is a declared default-catalog row — the checks (ADR-0029) ride the TextFields, and the Submit button’s action carries submit:true.')
for (const [i, message] of PAYLOAD.entries()) {
  const key = Object.keys(message).find((k) => k !== 'version') ?? '?'
  const figure = document.createElement('figure')
  figure.className = 'payload-line'
  const caption = document.createElement('figcaption')
  caption.textContent = `Line ${i + 1} — ${key}`
  figure.append(caption, codeBlock(JSON.stringify(message, null, 2), 'json')) // pretty for reading; fed compact via jsonl()
  payload.body.append(figure)
}

// ── [2] FORM region — the live rendered surface + a page-IDL panel (submit outcome + provider aggregate) ────────
const rendered = region('2', 'Rendered form', 'One payload → a coordinated, accessibly-labelled form. Each Field’s label IS its editor’s accessible name. The two TextField checks show inline (the wired error leg at G7); the required Select and Checkbox surface validity via focus on submit, not inline text.')
const surfaceEl = document.createElement('div')
surfaceEl.id = 'surface'
surfaceEl.className = 'surface'
rendered.body.append(surfaceEl)

// The page-IDL panel — CLIENT-SIDE, not the wire. The submit-outcome line + the provider's own `change` aggregate
// (LLD-C7 FormSubmitDetail). Clearly labelled so it never reads as a client→server message.
const idl = document.createElement('div')
idl.className = 'idl-panel'
const idlCaption = document.createElement('p')
idlCaption.className = 'idl-caption'
idlCaption.textContent = 'Client-side (page IDL) — not the wire'
const status = document.createElement('p')
status.className = 'form-status'
const aggregate = document.createElement('figure')
aggregate.className = 'aggregate'
aggregate.hidden = true
const aggregateCaption = document.createElement('figcaption')
aggregateCaption.textContent = 'provider.values() — the ui-form-provider’s own change event (native-form parity: a checked toggle submits “on”, an unchecked one is absent)'
aggregate.append(aggregateCaption)
idl.append(idlCaption, status, aggregate)
rendered.body.append(idl)

function setStatus(kind: 'idle' | 'blocked' | 'sent', text: string): void {
  status.dataset.kind = kind
  status.textContent = text
}
function renderAggregate(detail: FormSubmitDetail): void {
  aggregate.querySelector('pre')?.remove()
  aggregate.append(codeBlock(JSON.stringify(detail.values, null, 2), 'json'))
  aggregate.hidden = false
}
function clearAggregate(): void {
  aggregate.querySelector('pre')?.remove()
  aggregate.hidden = true
}

// ── [3] MESSAGES region — the client→server log: an invalid submit emits nothing, a valid one emits one action ──
const messages = region('3', 'Client → server messages', 'Submit while invalid: NO message — the gate refuses and the platform focuses the first invalid control. Fill Full name, choose a Plan, accept the terms, then submit: ONE action, carrying the live typed aggregate in dataModel (booleans stay booleans).')
const logList = document.createElement('ol')
logList.className = 'msg-log'
logList.setAttribute('aria-live', 'polite')
let seq = 0
// Discriminate the outbound arms (A2uiClientMessage = action | error | functionResponse) into a styled kind + a
// scannable head line; the full envelope still pretty-prints below (the source of truth). This form emits action
// (on a valid submit) and, in principle, error — no functionResponse path is exercised here.
function describe(message: A2uiClientMessage): { kind: string; label: string } {
  if ('action' in message) return { kind: 'action', label: `action ▸ server · ${message.action.name}` }
  if ('functionResponse' in message) return { kind: 'response', label: `functionResponse ▸ server · ${message.functionResponse.call}` }
  const e = message.error
  const id = 'functionCallId' in e ? e.functionCallId : e.surfaceId
  return { kind: 'error', label: `error ▸ server · ${e.code} (${id})` }
}
function appendLog(message: A2uiClientMessage): void {
  seq += 1
  const { kind, label } = describe(message)
  const item = document.createElement('li')
  item.dataset.kind = kind
  const head = document.createElement('div')
  head.className = 'msg-head'
  head.textContent = `#${String(seq).padStart(2, '0')}  ${label}`
  item.append(head, codeBlock(JSON.stringify(message, null, 2), 'json'))
  logList.append(item)
  logList.scrollTop = logList.scrollHeight
}
messages.body.append(logList)

// ── the demo lifecycle — feed the payload through a fresh renderer; repeatable via "Reset form" ────────────────
// run() tears down any prior renderer (leak-free, N3), clears the surface + log + page-IDL panel, then drives the
// public host surface end to end exactly as the transport would: subscribe → mount → ingest each line → finalize.
let host: RendererHost | undefined
function run(): void {
  host?.dispose()
  surfaceEl.replaceChildren()
  logList.replaceChildren()
  seq = 0
  clearAggregate()
  host = createRenderer()
  host.onClientMessage(appendLog)
  host.mount(surfaceEl)
  for (const message of PAYLOAD) host.ingest(jsonl(message))
  host.finalize(SURFACE_ID) // validate the COMPLETE set (ADR-0002); a valid root finalizes clean
  wireFormChrome()
}

// wireFormChrome — attach the page-IDL listeners to the freshly rendered form. Uses only the PUBLIC control API of
// ui-form-provider (its `change` event + `valid()`/`invalid()`), never renderer internals. The submit-click
// listener is attached AFTER the renderer's own gate listener (which is wired at widget-create time, inside the
// ingest above), so by the time it runs `provider.submit()` has already been called by the gate and `valid()`
// reflects the post-gate verdict — that ordering is what lets it report "sent" vs "blocked".
function wireFormChrome(): void {
  const found = surfaceEl.querySelector('ui-form-provider')
  const provider = found instanceof UIFormProviderElement ? found : undefined
  if (provider === undefined) {
    setStatus('idle', 'Form not mounted.')
    return
  }

  // The provider's OWN change event (FormSubmitDetail) fires only on a VALID submit. Disambiguate from a bubbled
  // member `change` (which carries detail:null) by target identity — the LLD-C7 contract.
  provider.addEventListener('change', (event) => {
    if (event.target !== provider) return
    renderAggregate((event as CustomEvent<FormSubmitDetail>).detail)
  })

  const submitBtn = surfaceEl.querySelector('ui-button')
  submitBtn?.addEventListener('click', () => {
    if (provider.valid()) {
      setStatus('sent', 'Submit accepted — one action emitted (see the log). The provider’s change aggregate is below.')
    } else {
      const n = provider.invalid().length
      setStatus('blocked', `Submit blocked — ${n} control${n === 1 ? '' : 's'} invalid. The platform focused the first; no client message was sent.`)
    }
  })

  // Initial state, DERIVED from reality (not hard-coded): how many controls block submit right now.
  const pending = provider.invalid().length
  setStatus('idle', pending === 0
    ? 'Ready — the form is valid.'
    : `Not submitted yet — ${pending} control${pending === 1 ? '' : 's'} need attention before this form can submit.`)
}

// Toolbar affordances (dogfooding ui-button): reset the form (fresh render + cleared log/panel), or clear the log.
const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
toolbar.append(
  controlButton('Reset form', 'solid', run),
  controlButton('Clear log', 'ghost', () => {
    logList.replaceChildren()
    seq = 0
  }),
)
payload.body.append(toolbar)

content.append(payload.section, arrow(), rendered.section, arrow(), messages.section)

run() // drive the flow on first paint so the form arrives already rendered
