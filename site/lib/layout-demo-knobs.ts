// site/lib/layout-demo-knobs.ts — the shared KNOB rig for the layout-primitive demos (row/column/list/grid-demo).
// A layout primitive emits no events (row.md/column.md/list.md/grid.md `events: []`) — its whole contract is
// "attribute in → layout out". So a rich demo proves that contract by flipping the REAL props live on the REAL
// mounted container and logging every flip in an `aria-live` `.event-log` (the tabs/modal event-log chrome,
// containers.css) — the reader sees the attribute change AND the layout respond in the same glance.
// Knobs are real `ui-button`s (dogfooded), the active value rendered `solid`, the rest `soft`.
import { el, uiButton } from './specimens.ts'

/** A knob log: the `.event-log` list plus its `record` writer (one numbered line per prop flip). */
export interface KnobLog {
  readonly list: HTMLUListElement
  readonly record: (line: string) => void
}

/** knobLog — the aria-live `.event-log` the knobs write to; one per demo page. */
export function knobLog(): KnobLog {
  const list = document.createElement('ul')
  list.className = 'event-log'
  list.setAttribute('aria-live', 'polite')
  let seq = 0
  const record = (line: string): void => {
    seq += 1
    const item = document.createElement('li')
    item.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
    list.append(item)
    list.scrollTop = list.scrollHeight
  }
  return { list, record }
}

/**
 * enumKnob — one button per enum value of `prop`; clicking sets the attribute on EVERY target (a demo may drive
 * several containers at once), re-marks the active button, and logs the flip. Returns the labelled knob row.
 */
export function enumKnob(
  targets: readonly HTMLElement[],
  prop: string,
  values: readonly string[],
  log: KnobLog,
): HTMLElement {
  const buttons = new Map<string, HTMLElement>()
  const mark = (): void => {
    const current = targets[0]?.getAttribute(prop) ?? ''
    for (const [value, button] of buttons) button.setAttribute('variant', value === current ? 'solid' : 'soft')
  }
  for (const value of values) {
    const button = uiButton(value, 'soft')
    button.setAttribute('size', 'sm')
    button.addEventListener('click', () => {
      for (const target of targets) target.setAttribute(prop, value)
      mark()
      log.record(`${prop} = ${JSON.stringify(value)}`)
    })
    buttons.set(value, button)
  }
  mark()
  return knobRow(prop, [...buttons.values()])
}

/**
 * booleanKnob — a single toggle button for a boolean-presence prop (`wrap`, `stretch`): present ⇒ on. Clicking
 * flips the attribute on every target, relabels the button, and logs the flip.
 */
export function booleanKnob(targets: readonly HTMLElement[], prop: string, log: KnobLog): HTMLElement {
  const button = uiButton(prop, 'soft')
  button.setAttribute('size', 'sm')
  const mark = (): void => {
    const on = targets[0]?.hasAttribute(prop) ?? false
    button.setAttribute('variant', on ? 'solid' : 'soft')
    button.textContent = `${prop}: ${on ? 'on' : 'off'}`
  }
  button.addEventListener('click', () => {
    const on = !(targets[0]?.hasAttribute(prop) ?? false)
    for (const target of targets) {
      if (on) target.setAttribute(prop, '')
      else target.removeAttribute(prop)
    }
    mark()
    log.record(`${prop} = ${String(on)}`)
  })
  mark()
  return knobRow(prop, [button])
}

/** knobRow — a labelled `ui-row` of knob buttons (the real primitive laying out its own controls). */
function knobRow(label: string, buttons: readonly HTMLElement[]): HTMLElement {
  const name = el('code', { class: 'demo-caption' }, [document.createTextNode(label)])
  return el('ui-row', { gap: 'xs', align: 'center', wrap: '' }, [name, ...buttons])
}
