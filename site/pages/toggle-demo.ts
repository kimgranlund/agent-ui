// site/pages/toggle-demo.ts — the ui-toggle interaction demo (the control-tier `demo`, pairing toggle-doc.html —
// the API page). Mounts the REAL pressed-state pill in two believable product situations: the workspace-panes
// header row the control was minted for (Chat · Settings · Co-pilot pills with an Eye/EyeSlash state icon, under
// the consumer's MIN-ONE rule — turning off the last shown pane is REFUSED via `toggle`'s cancelable-before-commit
// contract) and a text-formatting cluster (independent Bold/Italic/Underline pills). The pressed-state log proves
// the contract: `toggle` fires BEFORE `pressed` commits, so the log records the pre-press value, the post-tick
// value, and whether the consumer refused. The control owns activation/ARIA-pressed/paint (toggle.ts) — this page
// only stages, applies the min-one policy, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { resolveIcon, type IconName } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066)
import type { UIToggleElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-toggle — demo',
  intro:
    'The pressed-state pill, live in the header row it was minted for: three workspace panes you show and hide, ' +
    'under a min-one rule — the last shown pane refuses to hide. Press a pill (click, or Tab + Space/Enter); the ' +
    'pressed-state log records the toggle event and the pressed value it settled to. The API table is on the ' +
    'ui-toggle API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared pressed-state log — `toggle` fires BEFORE `pressed` commits, so we read before + after ─────────
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

function iconIn(slot: 'icon' | 'state-icon', name: IconName): SVGElement {
  const svg = resolveIcon(name)
  svg.setAttribute('slot', slot)
  return svg
}

/** pill — a real ui-toggle: identity icon + label (+ optional state icon), wired to the log. */
function pill(label: string, glyph: IconName, opts: { pressed?: boolean; stateIcon?: boolean } = {}): UIToggleElement {
  const children: Node[] = [iconIn('icon', glyph), text(label)]
  if (opts.stateIcon) children.push(iconIn('state-icon', opts.pressed ? 'eye' : 'eye-slash'))
  const attrs: Record<string, string> = {}
  if (opts.pressed) attrs.pressed = ''
  const t = el('ui-toggle', attrs, children) as UIToggleElement
  t.addEventListener('toggle', (event) => {
    const before = t.hasAttribute('pressed')
    // `pressed` commits right after this listener returns (same tick, unless refused) — read it a microtask later.
    queueMicrotask(() => {
      const after = t.hasAttribute('pressed')
      const verdict = event.defaultPrevented ? 'REFUSED (min-one)' : after === before ? 'no-op' : 'committed'
      logLine(`toggle  ${label.padEnd(10)} pressed ${String(before)} → ${String(after)}   ${verdict}`)
    })
  })
  return t
}

// ── [1] the workspace-panes header row — the S7-b min-one consumer rule, applied here by the PAGE ─────────────
const chat = pill('Chat', 'chats-circle', { pressed: true, stateIcon: true })
const settings = pill('Settings', 'gear-six', { pressed: true, stateIcon: true })
const copilot = pill('Co-pilot', 'robot', { pressed: false, stateIcon: true })
const panes = [chat, settings, copilot]

for (const pane of panes) {
  // Refuse a press that would hide the LAST shown pane: cancel `toggle` before `pressed` commits (no flicker).
  pane.addEventListener('toggle', (event) => {
    const shown = panes.filter((p) => p.hasAttribute('pressed'))
    if (pane.hasAttribute('pressed') && shown.length === 1) event.preventDefault()
  })
  // Keep the orthogonal state icon (Eye / EyeSlash) in step with the committed value.
  const observer = new MutationObserver(() => {
    const stateIcon = pane.querySelector('[slot="state-icon"]')
    if (stateIcon) stateIcon.replaceWith(iconIn('state-icon', pane.hasAttribute('pressed') ? 'eye' : 'eye-slash'))
  })
  observer.observe(pane, { attributes: true, attributeFilter: ['pressed'] })
}
const paneRow = el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, panes)

const paneNote = el('p', {}, [
  text('Each pill mirrors '), code('aria-pressed'), text(' through ElementInternals; the trailing '),
  code('slot="state-icon"'), text(' Eye/EyeSlash is an orthogonal state glyph the page keeps in step. The '),
  strong('min-one rule'), text(' is the consumer’s, not the control’s: a '), code('toggle'),
  text(' listener calls '), code('preventDefault()'), text(' when the press would hide the last shown pane, and '),
  code('pressed'), text(' is left untouched — a true no-op, never a flip-then-revert. Try hiding all three.'),
])

// ── [2] a text-formatting cluster — independent pills, no policy ────────────────────────────────────────────
const bold = pill('Bold', 'pencil-simple')
const italic = pill('Italic', 'sparkle')
const underline = pill('Underline', 'list')
const format = el('ui-row', { gap: 'xs', align: 'center' }, [bold, italic, underline])
const preview = el('p', { style: 'margin:0.75rem 0 0; font-size:1.05rem;' }, [text('The quick brown fox jumps over the lazy dog.')])
const restyle = (): void => {
  preview.style.fontWeight = bold.hasAttribute('pressed') ? '700' : '400'
  preview.style.fontStyle = italic.hasAttribute('pressed') ? 'italic' : 'normal'
  preview.style.textDecoration = underline.hasAttribute('pressed') ? 'underline' : 'none'
}
for (const t of [bold, italic, underline]) t.addEventListener('toggle', () => queueMicrotask(restyle))

// ── [3] model-driven writes — a programmatic `pressed` write is silent (no toggle, never refusable) ─────────
const showAll = uiButton('Show all panes (model-driven)', 'soft')
showAll.addEventListener('click', () => {
  for (const pane of panes) pane.setAttribute('pressed', '')
  logLine('model    all panes   pressed → true      (programmatic write: NO toggle event)')
})
const modelNote = el('p', {}, [
  text('Setting '), code('pressed'), text(' directly (property or reflected attribute) is not a user press: no '),
  code('toggle'), text(' fires and nothing can refuse it — the commit-semantics law every fleet event follows.'),
])

// ── [4] the axis specimens — size × pressed/disabled ────────────────────────────────────────────────────────
const axes = el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, [
  captioned('size="sm"', el('ui-toggle', { size: 'sm' }, [iconIn('icon', 'bell'), text('Alerts')])),
  captioned('size="md" pressed', el('ui-toggle', { pressed: '' }, [iconIn('icon', 'bell'), text('Alerts')])),
  captioned('size="lg"', el('ui-toggle', { size: 'lg' }, [iconIn('icon', 'bell'), text('Alerts')])),
  captioned('disabled', el('ui-toggle', { disabled: '' }, [iconIn('icon', 'bell'), text('Alerts')])),
  captioned('disabled pressed', el('ui-toggle', { disabled: '', pressed: '' }, [iconIn('icon', 'bell'), text('Alerts')])),
])

content.append(
  exampleSection('Workspace panes — show/hide under a min-one rule', paneRow, paneNote),
  exampleSection('Text formatting — independent pills', format, preview),
  exampleSection('Model-driven write', showAll, modelNote),
  exampleSection('toggle / pressed event log', log),
  exampleSection('Sizes and states', axes),
)
