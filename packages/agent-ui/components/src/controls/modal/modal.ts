// modal.ts — UIModalElement, the FACE modal dialog on the native `<dialog>` (goals.md §G9 / ADR-0017;
// decomp g9-containers slice s9). BEHAVIOUR + props + the control-owned `<dialog>` part + self-define ONLY;
// surface/backdrop live in modal.css (s9), the public contract in modal.md (s9).
//
// Native `<dialog>` showModal() supplies the four hard modal behaviours FREE, in the platform top layer:
// top-layer stacking (above any z-index/overflow/stacking context), a `::backdrop`, focus CONTAINMENT, and
// Escape-to-dismiss. ADR-0017 takes the platform element and adds only the gaps it leaves — focus RESTORE on
// close (cl.4) and the `open`↔platform sync (cl.2/3). A `<dialog>` is NOT a form widget (it submits nothing,
// carries no value, is not form-associated), so it honours the "no native form elements" rule under the
// ADR-0014 widgets-not-elements reading — `ui-modal` extends UIContainerElement (surface, NOT form-associated).
//
// The dialog is a control-owned light-DOM PART (`<dialog data-part="dialog">`), created ONCE (an idempotent
// guard) and NEVER re-rendered — `render()` stays the inherited VOID, because re-creating the dialog would drop
// the top-layer + focus state mid-session (ADR-0017 cl.1). Its three wires are scope-owned:
//   • model→platform — an effect on `open`: true → `dialog.showModal()`, false → `dialog.close()` (idempotent
//     guards; `showModal()` records the opener first so focus can be restored).
//   • platform→model — the dialog's `close` event: a USER/platform close (Escape, backdrop, an external
//     `.close()`) syncs `open=false` and emits the family `close` + `toggle` (the two-way bind, ADR-0019);
//     a close WE drove (the prop already went false) only restores focus — no redundant emit. `this.open` is
//     the discriminator (still true ⇒ the platform closed it), so no async flag is needed.
//   • dismissal gate — `dismissable` (default on); when off, the dialog's `cancel` event (Escape, the platform
//     light-dismiss request) is preventDefault-ed, and a backdrop click is ignored. Backdrop click is detected
//     rect-wise (a click whose target is the dialog box but lands OUTSIDE its content rect ⇒ the `::backdrop`).
//
// The HOST carries no role/aria-* attribute (the family `internals`-only ARIA discipline) — `aria-modal` is set
// by `showModal()`, and an author accessible name (`aria-label`/`aria-labelledby`) is FORWARDED onto the dialog
// PART (ADR-0017 cl.5), keeping the host attribute-clean. `controls → dom` is the allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

const props = {
  // The two surface axes (elevation/brightness) — SPREAD from the container base, not inherited (props.ts has
  // no static-props prototype merge; the ADR-0013 formProps precedent). They style the dialog PART's surface.
  ...UIContainerElement.surfaceProps,
  // `open` — whether the modal is shown. Reflected (the [open] attribute drives nothing in CSS — the dialog's
  // own [open] is the platform's — but reflecting keeps the host's declared state inspectable/serializable) and
  // BINDABLE: the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019).
  open: { ...prop.boolean(false), reflect: true },
  // `dismissable` (default ON) — gates user dismissal (Escape via the `cancel` event + backdrop click). Reflected
  // so a JS-set value still keys any author styling and stays inspectable.
  dismissable: { ...prop.boolean(true), reflect: true },
} satisfies PropsSchema

export interface UIModalElement extends ReactiveProps<typeof props> {}
export class UIModalElement extends UIContainerElement {
  static props = props

  // The control-owned dialog PART — a light-DOM child that persists across disconnect/reconnect, so it is
  // created ONCE (the idempotent guard in #ensureDialog) and never re-appended.
  #dialog: HTMLDialogElement | null = null

  // The element focused when the modal opened — restored on close (the one platform gap, ADR-0017 cl.4).
  #opener: HTMLElement | null = null

  protected connected(): void {
    const dialog = this.#ensureDialog()

    // ── platform→model — a USER/platform close syncs the prop + announces; a close WE drove only restores ──
    this.listen(dialog, 'close', () => {
      if (this.open) {
        // The platform closed it (Escape, backdrop, an external .close()) while the prop still reads open —
        // sync the state down and announce, so the agent learns the user dismissed it (the two-way bind).
        this.open = false // reflects (drops the attribute) + re-runs the effect → #closeDialog no-ops (already closed)
        this.emit('close')
        this.emit('toggle') // the value:{event:'toggle'} two-way signal (ADR-0019)
      }
      this.#restoreFocus() // restore on EVERY close (platform-driven or our own) — the platform omits this
    })

    // ── dismissal gate — Escape / the platform light-dismiss request fires `cancel`; block it when not dismissable ──
    this.listen(dialog, 'cancel', (event) => {
      if (!this.dismissable) event.preventDefault() // the dialog stays open; no `close` follows
    })

    // ── backdrop click — a click on the dialog box OUTSIDE its content rect is the `::backdrop`; dismiss if allowed ──
    this.listen(dialog, 'click', (event) => {
      if (!this.dismissable) return
      const e = event as MouseEvent
      if (e.target !== dialog) return // a click on content targets the child; the backdrop/box targets the dialog
      const r = dialog.getBoundingClientRect()
      const insideContent = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!insideContent) dialog.close() // a true backdrop click → close (routes through the `close` user branch)
    })

    // ── model→platform — `open` drives showModal()/close() (scope-owned; re-arms on reconnect) ──
    this.effect(() => {
      if (this.open) this.#openDialog(dialog)
      else this.#closeDialog(dialog)
    })
  }

  /** Open the dialog (idempotent) — record the opener FIRST (showModal moves focus in), then enter the top layer. */
  #openDialog(dialog: HTMLDialogElement): void {
    if (dialog.open) return // already shown — do not re-enter the top layer / re-trap
    this.#opener = document.activeElement as HTMLElement | null // the element to restore focus to on close
    dialog.showModal() // platform: top layer + ::backdrop + focus trap + Escape + aria-modal — all free
  }

  /** Close the dialog (idempotent). The `close` event fires with `open` already false ⇒ no redundant emit. */
  #closeDialog(dialog: HTMLDialogElement): void {
    if (!dialog.open) return
    dialog.close()
  }

  /** Restore focus to the recorded opener (ADR-0017 cl.4 — the platform traps but does not restore). */
  #restoreFocus(): void {
    const opener = this.#opener
    this.#opener = null
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus()
  }

  /**
   * Create the `<dialog data-part="dialog">` PART ONCE (idempotent across reconnect — it is a light-DOM child
   * that persists through disconnect). The modal's children are MOVED into the dialog at creation (they render
   * inside the top-layer surface, not beside it). An author accessible name (`aria-label`/`aria-labelledby`) is
   * FORWARDED off the host onto the dialog part (ADR-0017 cl.5) so the host stays role/aria-clean and the name
   * rides the semantic element. `render()` stays the inherited VOID — the dialog is never re-created.
   */
  #ensureDialog(): HTMLDialogElement {
    if (this.#dialog) return this.#dialog

    const dialog = document.createElement('dialog')
    dialog.setAttribute('data-part', 'dialog')

    // Forward the accessible name onto the dialog part, then strip it from the host (host carries no aria-*).
    const labelledby = this.getAttribute('aria-labelledby')
    if (labelledby !== null) {
      dialog.setAttribute('aria-labelledby', labelledby)
      this.removeAttribute('aria-labelledby')
    }
    const label = this.getAttribute('aria-label')
    if (label !== null) {
      dialog.setAttribute('aria-label', label)
      this.removeAttribute('aria-label')
    }

    // Move the author content into the dialog (the dialog is detached here, so firstChild is real content).
    while (this.firstChild) dialog.appendChild(this.firstChild)
    this.appendChild(dialog)

    this.#dialog = dialog
    return dialog
  }
}

if (!customElements.get('ui-modal')) customElements.define('ui-modal', UIModalElement)
