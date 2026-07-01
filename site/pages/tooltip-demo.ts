// site/pages/tooltip-demo.ts — the ui-tooltip interaction demo (the ratified pattern `demo`). Mounts the REAL
// overlay-controller tooltip and proves its behaviour honestly: hover OR keyboard-focus the anchor to reveal the
// top-layer panel; a mouse show waits the show-delay while keyboard focus shows immediately, and the tooltip
// NEVER steals focus. The live close/toggle log shows the user-driven dismiss (mouseleave / focusout / Escape).
// The control owns the delay + focus discipline (tooltip.ts + the overlay controller); this page only stages +
// logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-tooltip — demo',
  intro: 'The non-modal tooltip, live. Hover the anchor (a show-delay applies) or Tab to it (shown immediately — ' +
    'keyboard users cannot hover); it never takes focus. Dismiss via mouseleave, focusout, or Escape. The event ' +
    'log shows the user-driven close / toggle. The API table is on the ui-tooltip API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the shared close/toggle event log ────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(label: string, name: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${label.padEnd(16)}${name}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// tooltipDemo — a real ui-tooltip: first child = anchor (positional child-move), the rest is the tooltip content.
// close/toggle fire on a user-driven dismiss (mouseleave/focusout/Escape), not on a programmatic close.
function tooltipDemo(label: string, attrs: Record<string, string>, body: string): HTMLElement {
  const tip = el('ui-tooltip', attrs, [uiButton(label, 'soft'), text(body)])
  tip.addEventListener('close', () => logEvent(label, 'close'))
  tip.addEventListener('toggle', () => logEvent(label, 'toggle'))
  return tip
}

const defaultTip = tooltipDemo('Save', {}, 'Save your changes (Ctrl+S)')
const fastTip = tooltipDemo('Delete', { placement: 'top-start', delay: '150' }, 'Delete this item permanently')

const row = el('ui-row', { gap: 'lg' }, [defaultTip, fastTip])

const behaviourNote = el('p', {}, [
  text('The first tooltip uses the default '), code('delay'), text(' (600 ms on hover); the second sets '),
  code('delay="150"'), text(' and '), code('placement="top-start"'), text('. '), strong('Keyboard focus'),
  text(' (Tab to the button) shows the tooltip immediately — no delay — and the tooltip '), strong('never'),
  text(' moves focus ('), code('focusOnOpen: false'), text('), so you stay on the anchor throughout.'),
])

content.append(
  exampleSection('Live tooltips (hover or Tab to reveal)', row),
  exampleSection('Delay & focus behaviour', behaviourNote),
  exampleSection('close / toggle event log', log),
)
