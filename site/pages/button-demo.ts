// site/pages/button-demo.ts — the ui-button interaction demo (the control-tier `demo`, pairing button-doc.html —
// the API page). Mounts the REAL control in two believable product situations — a document-actions toolbar
// (icon-only + adorned buttons across the three variants) and a form-actions row (Cancel/Save draft/Publish, with
// a disabled-while-pending Publish) — and proves the ONE event contract honestly: `click` fires for pointer AND
// Space/Enter keyboard activation (MouseEvent.detail=0 tells them apart), and a disabled button is fully inert
// (no line ever lands in the log). The control owns activation, ARIA, and geometry (button.ts/button.css) —
// this page only stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { resolveIcon, type IconName } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066)

const { content } = mountPage({
  title: 'ui-button — demo',
  intro:
    'The action control, live in two real situations: a document-actions toolbar and a form-actions row. ' +
    'Click a button, or Tab to it and press Space/Enter — the click event log records every activation and ' +
    'whether it came from the pointer or the keyboard; the disabled Publish never logs. The API table is on ' +
    'the ui-button API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared click event log — pointer vs keyboard told apart by MouseEvent.detail (0 = keyboard) ────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function wire(button: HTMLElement, name: string): HTMLElement {
  button.addEventListener('click', (event) => {
    const detail = (event as MouseEvent).detail
    const source = detail === 0 ? 'keyboard' : 'pointer'
    seq += 1
    const line = document.createElement('li')
    line.textContent = `#${String(seq).padStart(2, '0')}  click  ${name.padEnd(18)} source=${source}`
    log.append(line)
    log.scrollTop = log.scrollHeight
  })
  return button
}

/** icon — an authentic Phosphor glyph placed in a POSITION slot with the `icon` CONTENT role (ADR-0012). */
function icon(name: IconName, slot: 'leading' | 'trailing', role: 'icon' | 'caret' = 'icon'): SVGElement {
  const svg = resolveIcon(name)
  svg.setAttribute('slot', slot)
  svg.setAttribute('data-role', role)
  return svg
}

/** adorned — a ui-button with a leading icon + label (the [leading | label] structure). */
function adorned(label: string, glyph: IconName, variant: string): HTMLElement {
  const b = el('ui-button', { variant }, [icon(glyph, 'leading'), text(label)])
  return wire(b, label)
}

/** iconOnly — the fifth structure: no label, `icon-only`, the accessible name from aria-label. */
function iconOnly(label: string, glyph: IconName, variant: string): HTMLElement {
  const b = el('ui-button', { variant, 'icon-only': '', 'aria-label': label }, [icon(glyph, 'leading')])
  return wire(b, label)
}

// ── [1] a document-actions toolbar — the shape an editor header carries ─────────────────────────────────────
const toolbar = el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, [
  adorned('Share', 'share-network', 'solid'),
  adorned('Download', 'download-simple', 'soft'),
  wire(el('ui-button', { variant: 'soft' }, [text('More'), icon('caret-down', 'trailing', 'caret')]), 'More'),
  iconOnly('Star', 'star', 'ghost'),
  iconOnly('Attach', 'paperclip', 'ghost'),
  iconOnly('Dismiss', 'x', 'ghost'),
])
const toolbarNote = el('p', {}, [
  text('Three variants read as three levels of emphasis: '), strong('solid'), text(' for the one primary action, '),
  strong('soft'), text(' for secondary actions, '), strong('ghost'), text(' for the quiet icon-only utilities. ' +
    'Adornments are positional slots ('), code('slot="leading|trailing"'), text(') carrying a '), code('data-role'),
  text(' — a '), code('caret'), text(' stays at label-font scale, an '), code('icon'),
  text(' fills the icon cell. Icon-only buttons name themselves via '), code('aria-label'), text('.'),
])

// ── [2] a form-actions row — Cancel · Save draft · Publish, with the primary action pending/disabled ─────────
const publish = wire(el('ui-button', { variant: 'solid', disabled: '' }, [icon('paper-plane-right', 'leading'), text('Publish')]), 'Publish')
const saveDraft = wire(uiButton('Save draft', 'soft'), 'Save draft')
const cancel = wire(uiButton('Cancel', 'ghost'), 'Cancel')
const formActions = el('ui-row', { gap: 'sm', justify: 'end', align: 'center' }, [cancel, saveDraft, publish])
applyDemoWidth(formActions, '32rem')

const readiness = el('ui-switch', {}, [text('Draft has a title (unlocks Publish)')])
readiness.addEventListener('change', () => {
  const ready = readiness.hasAttribute('checked')
  if (ready) publish.removeAttribute('disabled')
  else publish.setAttribute('disabled', '')
})
const formNote = el('p', {}, [
  text('The primary action is '), code('disabled'), text(' until the form is ready — flip the switch to unlock it. ' +
    'While disabled it is fully inert: no pointer activation, no key handling, and it leaves the tab order (native '),
  code('<button disabled>'), text(' parity), so nothing from it ever reaches the log.'),
])

// ── [3] the axis specimens — size × variant, and the label-overflow ellipsis (ADR-0133) ────────────────────
const sizes = el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, [
  captioned('size="sm"', wire(el('ui-button', { size: 'sm' }, [text('Small')]), 'Small')),
  captioned('size="md" (default)', wire(el('ui-button', {}, [text('Medium')]), 'Medium')),
  captioned('size="lg"', wire(el('ui-button', { size: 'lg' }, [text('Large')]), 'Large')),
])
const overflowing = wire(el('ui-button', { variant: 'soft' }, [icon('folder', 'leading'), text('Archive the whole conversation thread')]), 'Archive…')
applyDemoWidth(overflowing, '14rem')
const overflow = captioned('a bounded 14rem button — the label truncates with an ellipsis', overflowing)

const keyboard = el('p', {}, [
  text('Keyboard: '), strong('Tab'), text(' reaches every enabled button; '), strong('Space'),
  text(' activates on keyup (keydown is swallowed so the page never scrolls), '), strong('Enter'),
  text(' activates on keydown. Both fire the same native-parity '), code('click'), text(' — the log shows '),
  code('source=keyboard'), text(' for them.'),
])

content.append(
  exampleSection('Document-actions toolbar', toolbar, toolbarNote),
  exampleSection('Form actions with a gated primary', readiness, formActions, formNote),
  exampleSection('click event log', log, keyboard),
  exampleSection('Sizes and label overflow', sizes, overflow),
)
