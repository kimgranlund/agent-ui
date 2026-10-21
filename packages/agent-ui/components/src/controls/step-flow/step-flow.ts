// step-flow.ts: UIStepFlowElement, the client-side wizard over a producer's scenes (T-0198, Direction B approved by
// Kim 2026-10-21). Behaviour, props, internals ARIA and the control-built parts only; every visual rule lives in
// step-flow.css.
//
// A pattern-tier display primitive: not form-associated, the host takes no focus. The host is `role="group"`
// named by the current scene's label, set through ElementInternals.
//
// Each direct element child is one scene, kept where the a2ui renderer put it (it reconciles ChildList children in
// the host, so relocating one would break resend positioning). The control shows the current scene and marks the
// rest `hidden` and `inert`, so their values and validity survive Back. Its own `header` part is the host's first
// child and its `actions` part the last. The renderer appends a new scene at the end (`#reconcileChildren` inserts
// before a null anchor), so the childList observer moves the control's own `actions` back to the end, skipping the
// move when it is already last (its own mutation re-enters the observer). It never moves a producer child, and the
// part is never a renderer anchor (the renderer anchors on its own survivors only).
//
// Back and Next are the control's own native buttons and run with no agent turn. Next checks the current scene's
// form fields and, on a failure, reports the first and stays (the ui-form-provider `submit()` law, scoped to the
// scene); it is never disabled. An accepted move writes `step`, emits `change`, then moves focus to the label.
// With `finishAction` set, the last scene shows a finish button, gated the same way, that emits `action` with the
// bound `draft` folded into the context. With it null, the last scene commits itself: the actions part carries
// `data-self-commit` (a `data-` attribute on a part, the otp-field and split precedent, not an internals state) and
// Back steps down to md, so it shares the commit Button's row (Kim 2026-10-21).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { signal } from '../../reactive/index.ts'
import { createGlyph } from '../glyph/glyph.ts'
// Generated from step-flow.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs step-flow`.
import { props } from './step-flow.props.gen.ts'

interface ActionDetail {
  action: string
  context: Record<string, unknown> | undefined
}

/** A scene field the Next gate reads: a FACE member or a native control taking part in constraint validation. */
interface Validatable {
  willValidate?: boolean
  checkValidity?: () => boolean
  reportValidity?: () => boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function cleanAction(value: unknown): ActionDetail | null {
  if (!isRecord(value) || typeof value.action !== 'string' || value.action === '') return null
  return { action: value.action, context: isRecord(value.context) ? value.context : undefined }
}

/** The current scene, 1-based, clamped to the scene count; 0 when there is no scene. Read-side only. */
function clampStep(step: unknown, count: number): number {
  if (count === 0) return 0
  const n = typeof step === 'number' && Number.isFinite(step) ? Math.round(step) : 1
  return Math.min(Math.max(n, 1), count)
}

const part = <T extends HTMLElement = HTMLElement>(tag: string, name: string): T => {
  const node = document.createElement(tag) as T
  node.dataset.part = name
  return node
}

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text
}

/** Put `node` in `parent` when `present`, before the first of `later` already attached; remove it otherwise. */
const place = (parent: Element, node: Element, present: boolean, later: readonly Element[] = []): void => {
  if (!present) {
    if (node.parentNode === parent) node.remove()
    return
  }
  if (node.parentNode === parent) return
  parent.insertBefore(node, later.find((n) => n.parentNode === parent) ?? null)
}

let positionIds = 0

export interface UIStepFlowElement extends ReactiveProps<typeof props> {}
export class UIStepFlowElement extends UIElement {
  static props = props

  /** The scenes in DOM order: every direct element child but the control's own parts. */
  #scenes = signal<readonly HTMLElement[]>([])
  #observer: MutationObserver | null = null
  #header: HTMLElement | undefined
  #position!: HTMLElement
  #label!: HTMLElement
  #bar!: HTMLElement
  #actions!: HTMLElement
  #back!: HTMLButtonElement
  #next!: HTMLButtonElement
  #finish!: HTMLButtonElement

  protected override connected(): void {
    this.internals.role = 'group'
    this.#ensureParts()
    this.#syncChildren()
    // Scenes appended before connect, or while disconnected, are read now; every later change through the observer.
    this.#observer = new MutationObserver(() => this.#syncChildren())
    this.#observer.observe(this, { childList: true })

    // Re-armed every connect: `this.listen` rides the current connection's AbortSignal; the buttons are reused.
    this.listen(this.#back, 'click', () => this.#onBack())
    this.listen(this.#next, 'click', () => this.#onNext())
    this.listen(this.#finish, 'click', () => this.#onFinish())

    this.effect(() => this.#renderHeader())
    this.effect(() => this.#renderScenes())
    this.effect(() => this.#renderActions())
  }

  protected override disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  #syncChildren(): void {
    const header = this.#header!
    if (this.firstChild !== header) this.insertBefore(header, this.firstChild)
    if (this.lastChild !== this.#actions) this.append(this.#actions)
    const scenes = Array.from(this.children).filter(
      (c): c is HTMLElement => c !== header && c !== this.#actions && c instanceof HTMLElement,
    )
    const prev = this.#scenes.value
    if (scenes.length !== prev.length || scenes.some((s, i) => s !== prev[i])) this.#scenes.value = scenes
  }

  #current(): number {
    return clampStep(this.step, this.#scenes.value.length)
  }

  #labelFor(n: number): string {
    const label = Array.isArray(this.steps) ? this.steps[n - 1] : undefined
    return typeof label === 'string' && label.trim() !== '' ? label : `Step ${n}`
  }

  /** The Next and finish gate: the first scene field failing constraint validation is reported and the move refused. */
  #sceneValid(n: number): boolean {
    const scene = this.#scenes.value[n - 1]
    if (scene === undefined) return true
    for (const node of [scene, ...Array.from(scene.querySelectorAll('*'))]) {
      const field = node as Validatable
      if (field.willValidate !== true || typeof field.checkValidity !== 'function') continue
      if (!field.checkValidity()) {
        field.reportValidity?.()
        return false
      }
    }
    return true
  }

  #moveTo(n: number): void {
    this.step = n // commit before emit: a change listener reading el.step sees the move
    // Effects run deferred, so the header is painted now: focus must land on the new label and position, never
    // the scene just left (the confirm-receipt `#onConfirm` mark precedent). The effect re-runs later as a no-op.
    this.#renderHeader()
    this.emit('change', n)
    this.#label.focus()
  }

  #onBack(): void {
    const n = this.#current()
    if (n > 1) this.#moveTo(n - 1)
  }

  #onNext(): void {
    const n = this.#current()
    if (n < 1 || n >= this.#scenes.value.length || !this.#sceneValid(n)) return
    this.#moveTo(n + 1)
  }

  #onFinish(): void {
    const action = cleanAction(this.finishAction)
    const n = this.#current()
    if (action === null || n < 1 || n !== this.#scenes.value.length || !this.#sceneValid(n)) return
    const draft = isRecord(this.draft) ? this.draft : {}
    this.emit('action', { action: action.action, context: { ...action.context, draft } })
  }

  #ensureParts(): void {
    if (this.#header) return // parts persist across reconnects; built once ever
    this.#header = part('div', 'header')
    this.#position = part('span', 'position')
    this.#position.id = `ui-step-flow-position-${++positionIds}`
    this.#label = part('span', 'label')
    this.#label.tabIndex = -1 // programmatically focusable only: Back and Next move focus here, Tab never stops on it
    this.#label.setAttribute('aria-describedby', this.#position.id) // focus reads the name, then "Step n of m"
    this.#bar = part('div', 'bar')
    this.#bar.setAttribute('aria-hidden', 'true')
    this.#header.append(this.#position, this.#label, this.#bar)

    this.#actions = part('div', 'actions')
    this.#back = part<HTMLButtonElement>('button', 'back')
    this.#back.type = 'button'
    this.#back.dataset.size = 'lg' // the part's own step: 28px on an A2UI canvas (ADR-0245 Amendment 2)
    const caretLeft = createGlyph('caret-left')
    caretLeft.dataset.part = 'glyph'
    this.#back.append(caretLeft, 'Back')
    this.#next = part<HTMLButtonElement>('button', 'next')
    this.#next.type = 'button'
    this.#next.dataset.size = 'lg'
    const caretRight = createGlyph('caret-right')
    caretRight.dataset.part = 'glyph'
    this.#next.append('Next', caretRight)
    this.#finish = part<HTMLButtonElement>('button', 'finish')
    this.#finish.type = 'button'
    this.#finish.dataset.size = 'lg'
  }

  #renderHeader(): void {
    const count = this.#scenes.value.length
    const n = this.#current()
    const label = n === 0 ? '' : this.#labelFor(n)
    this.internals.ariaLabel = label === '' ? null : label
    this.#header!.hidden = count === 0
    setText(this.#position, count === 0 ? '' : `Step ${n} of ${count}`)
    setText(this.#label, label)
    while (this.#bar.children.length < count) this.#bar.append(part('span', 'segment'))
    while (this.#bar.children.length > count) this.#bar.lastElementChild!.remove()
    Array.from(this.#bar.children).forEach((segment, i) => {
      const state = i + 1 < n ? 'done' : i + 1 === n ? 'current' : 'upcoming'
      if ((segment as HTMLElement).dataset.state !== state) (segment as HTMLElement).dataset.state = state
    })
  }

  #renderScenes(): void {
    const n = this.#current()
    this.#scenes.value.forEach((scene, i) => {
      const active = i + 1 === n
      scene.toggleAttribute('hidden', !active)
      scene.toggleAttribute('inert', !active)
    })
  }

  #renderActions(): void {
    const count = this.#scenes.value.length
    const n = this.#current()
    const finish = cleanAction(this.finishAction) !== null
    const last = count > 0 && n === count
    const selfCommit = last && !finish
    this.#actions.hidden = count === 0
    this.#actions.toggleAttribute('data-self-commit', selfCommit)
    // On the self-commit scene Back matches the scene's own md commit Button, so the shared row holds one height.
    this.#back.dataset.size = selfCommit ? 'md' : 'lg'
    setText(this.#finish, typeof this.finishLabel === 'string' && this.finishLabel !== '' ? this.finishLabel : 'Continue')
    place(this.#actions, this.#back, n > 1, [this.#next, this.#finish])
    place(this.#actions, this.#next, n >= 1 && n < count, [this.#finish])
    place(this.#actions, this.#finish, last && finish)
  }
}

if (!customElements.get('ui-step-flow')) customElements.define('ui-step-flow', UIStepFlowElement)
