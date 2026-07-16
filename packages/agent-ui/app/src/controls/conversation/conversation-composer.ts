// conversation-composer.ts — UIConversationComposerElement (TKT-0056 · TKT-0058 v2), the message-composition
// UI extracted out of `ui-conversation`. `tier: pattern` / `extends: UIElement` — since the v2 unroll
// (TKT-0058) the host is ITSELF the field: one ADR-0014 field frame whose content is the opt-in
// context-chip row (above), an OWN contenteditable multi-line editor (the ADR-0134 `ui-textarea` pattern,
// reused — no nested `ui-text-field` anymore), and the options row (Models/Effort `ui-menu` pickers +
// mic/send `ui-button`s, below). All parts are JS-created internal children (the `master-detail.ts` →
// `ui-split` precedent — never author-composed; `slots: []`).
//
// `ui-conversation` composes this ONCE (`document.createElement('ui-conversation-composer')`) and forwards
// `models`/`model`/`efforts`/`effort`/`contextItems` down as props, sets `busy` from its own turn-in-flight
// tracking, and listens for this element's five callback registrations (`onSubmit`/`onModelChange`/
// `onEffortChange`/`onContextDismiss`/`onMicClick`) — see conversation.ts (LLD CVC-C5) for the pinned
// forwarding mechanism.
//
// The editable surface (LLD CVC-C3′, TKT-0058): the ADR-0014 contenteditable pattern via its multi-line
// sibling `ui-textarea` (ADR-0134) — a stable `<div data-part="editor" contenteditable="plaintext-only"
// role="textbox" aria-multiline="true">`, created ONCE and never re-rendered; surface→model on `input`
// (IME-composition-guarded), model→surface under the CARET GUARD, `data-empty` + attr(data-placeholder)
// placeholder. Keyboard (CVC-C7) deliberately sits BETWEEN the two donors: Enter COMMITS (ui-text-field's
// law), Shift+Enter inserts a newline (ui-textarea's law) — the chat-composer third shape. Focus (CVC-C8):
// host.focus() forwards to the editor; clicking the component's own area (not a button/menu/chip) focuses
// the editor; the focus ring renders on the HOST frame (conversation-composer.css, :has(editor:focus)).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { UIButtonElement, UIMenuElement } from '@agent-ui/components/components'
import type { PickerOption, ContextItem } from './composer-options.ts'

// The editor's editable mode (ADR-0014 cl.1, the ui-textarea reuse).
const EDITABLE = 'plaintext-only'

const props = {
  // The live message text (TKT-0058) — property-only (`attribute: false`): this element is never
  // author-composed, so there is no markup value to seed (unlike ui-text-field/ui-textarea, whose value
  // ATTRIBUTE seeds a reset baseline). The live value rides this signal + the editor surface, never a host
  // attribute.
  value: { ...prop.string(), attribute: false as const },
  // Every one below defaults to undefined/empty, so a consumer that never sets them (the ORIGINAL
  // field+Send shape) gets exactly that — `ui-conversation` stays generic, it never names a model or
  // hardcodes "Effort"'s levels beyond the shared `EFFORT_LEVELS` constant a consumer may reuse.
  models: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  model: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  efforts: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  effort: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // `undefined`, not `[]` (the models/efforts precedent) — an array-literal default cannot round-trip
  // through the descriptor's `default:` token (ADR-0004); coalesced to `[]` at the one read site (`#syncContextChips`).
  contextItems: { ...prop.json<readonly ContextItem[] | undefined>(undefined), attribute: false as const },
  // Replaces `ui-conversation` reaching into `#field`/`#sendBtn`/`#micBtn`/the picker triggers directly to
  // set `.disabled`; this element owns disabling its OWN parts from ONE prop. Reflects — `[busy]` on the
  // host is the CSS hook for the whole-composer dim (the v1 form's `data-busy`, moved to the host).
  busy: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

// A STABLE empty reference for the `contextItems` default — `this.contextItems ?? []` at the read site
// would otherwise mint a FRESH array literal every effect re-run, defeating `#syncContextChips`'s own
// reference-equality guard (every unset-contextItems consumer would rebuild the chip row on every
// unrelated model/effort change, the exact bug the guard exists to prevent).
const EMPTY_CONTEXT_ITEMS: readonly ContextItem[] = []

export interface UIConversationComposerElement extends ReactiveProps<typeof props> {}
export class UIConversationComposerElement extends UIElement {
  static props = props

  #editor: HTMLElement | undefined
  #sendBtn: UIButtonElement | undefined
  #micBtn: UIButtonElement | undefined
  #contextChips: HTMLElement | undefined
  #optionsLeading: HTMLElement | undefined
  #modelsMenu: UIMenuElement | undefined
  #modelsTrigger: UIButtonElement | undefined
  #effortMenu: UIMenuElement | undefined
  #effortTrigger: UIButtonElement | undefined
  // The last option list each picker's items were built from — rebuilt only when the REFERENCE changes
  // (a consumer's own list is typically a stable module-level constant, e.g. SUPPORTED_MODELS; a
  // reference-equality guard avoids tearing down/rebuilding the panel on every unrelated reactive pass).
  #modelsBuiltFrom: readonly PickerOption[] | undefined
  #effortsBuiltFrom: readonly PickerOption[] | undefined
  #contextItemsBuiltFrom: readonly ContextItem[] | undefined
  // Whether THIS connection has armed the picker's own 'select' listener — reset false at the TOP of every
  // connect: the menu DOM (and `#modelsMenu`'s mere existence) persists across a reconnect, but
  // `this.listen(...)` rides the CURRENT connection's AbortSignal — a listener armed only inside the
  // "build the menu" branch (which runs at most once, EVER) silently never re-arms on reconnect.
  #modelsListenerArmed = false
  #effortListenerArmed = false
  // The IME-composition guard (ADR-0014 cl.1, the ui-textarea reuse) — surface→model syncs and the
  // model→surface caret-guard write are BOTH suppressed mid-composition; compositionend catches up.
  #composing = false

  #onSubmitCb: ((text: string) => void) | undefined
  #onModelChangeCb: ((id: string) => void) | undefined
  #onEffortChangeCb: ((id: string) => void) | undefined
  #onContextDismissCb: ((id: string) => void) | undefined
  #onMicClickCb: (() => void) | undefined

  protected connected(): void {
    this.#modelsListenerArmed = false
    this.#effortListenerArmed = false
    // The chip row's OWN dismiss listeners ride `this.listen(...)` too (per-chip, inside #syncContextChips)
    // — but that method only rebuilds (and re-arms) when the `contextItems` REFERENCE changes. Without this
    // reset, a reconnect with the SAME reference short-circuits the rebuild, leaving the prior connection's
    // now-dead chip DOM/listeners in place (code-reviewer MEDIUM finding — the picker flags above already
    // had this reconnect-safety; the chip guard didn't). Resetting forces one rebuild per connect.
    this.#contextItemsBuiltFrom = undefined

    if (this.#editor === undefined) {
      // The context-chip row (opt-in, `contextItems`) — the tags row ABOVE the text (TKT-0058), e.g.
      // "something was selected elsewhere and is attached to this turn's context". Built once, empty;
      // content is entirely effect-driven (below) — never rebuilt from scratch on every reactive pass.
      this.#contextChips = document.createElement('div')
      this.#contextChips.dataset.part = 'context-chips'
      this.#contextChips.toggleAttribute('hidden', true)

      // The editor (TKT-0058 / LLD CVC-C3′) — the ADR-0014 contenteditable pattern reused from
      // ui-textarea (ADR-0134): role/aria ride the PART, never the host; aria-label is the accessible
      // name (the v1 field's `label="Message"`, unchanged in effect).
      const editor = document.createElement('div')
      editor.setAttribute('data-part', 'editor')
      editor.setAttribute('contenteditable', EDITABLE)
      editor.setAttribute('role', 'textbox')
      editor.setAttribute('aria-multiline', 'true')
      editor.setAttribute('aria-label', 'Message')
      editor.setAttribute('data-placeholder', 'Ask anything..')
      editor.toggleAttribute('data-empty', true)
      this.#editor = editor

      // The options row — Models/Effort pickers (left, opt-in) + mic/send icon-only buttons (right, always
      // present). Each picker is its own <ui-menu>; built lazily (below) only once its option list is set,
      // so a consumer that never passes `models`/`efforts` never pays for an empty, useless picker.
      const optionsRow = document.createElement('div')
      optionsRow.dataset.part = 'options'
      this.#optionsLeading = document.createElement('div')
      this.#optionsLeading.dataset.part = 'options-leading'
      const optionsTrailing = document.createElement('div')
      optionsTrailing.dataset.part = 'options-trailing'

      this.#micBtn = document.createElement('ui-button') as UIButtonElement
      this.#micBtn.setAttribute('variant', 'ghost')
      this.#micBtn.setAttribute('icon-only', '')
      this.#micBtn.setAttribute('aria-label', 'Voice input')
      this.#micBtn.dataset.part = 'mic'
      // OPT-IN: hidden until a consumer actually registers `onMicClick` — an always-present dead button
      // is a real hazard for an existing consumer that clicks "the composer's first ui-button" expecting
      // Send (a2ui-chat.ts's own sendIntent helper hit this exact bug before the fix). `onMicClick`
      // reveals it directly when called post-connect; this handles the PRE-connect registration case.
      this.#micBtn.toggleAttribute('hidden', this.#onMicClickCb === undefined)
      const micIcon = document.createElement('ui-icon')
      micIcon.setAttribute('slot', 'leading')
      micIcon.setAttribute('data-role', 'icon')
      micIcon.setAttribute('glyph', 'microphone')
      this.#micBtn.append(micIcon)

      this.#sendBtn = document.createElement('ui-button') as UIButtonElement
      this.#sendBtn.setAttribute('variant', 'ghost') // neutral ghost, like mic — the CSS retints both off the primary family (Kim's ruling, TKT-0058 follow-up)
      this.#sendBtn.setAttribute('icon-only', '')
      this.#sendBtn.setAttribute('aria-label', 'Send')
      this.#sendBtn.dataset.part = 'send'
      const sendIcon = document.createElement('ui-icon')
      sendIcon.setAttribute('slot', 'leading')
      sendIcon.setAttribute('data-role', 'icon')
      sendIcon.setAttribute('glyph', 'arrow-up')
      this.#sendBtn.append(sendIcon)

      optionsTrailing.append(this.#micBtn, this.#sendBtn)
      optionsRow.append(this.#optionsLeading, optionsTrailing)

      // The HOST is the field frame and the column (TKT-0058) — the v1 nested `<form data-part="composer">`
      // is GONE: its only job (Enter-triggers-submit plumbing) is handled directly by the editor keydown
      // below, so the ADR-0017 native-<form> carve-out dependency disappears with it.
      this.append(this.#contextChips, editor, optionsRow)
    }

    const editor = this.#editor

    // ── surface → model (ADR-0014 cl.1, the ui-textarea reuse) — edits flow into `value`, IME-guarded ──
    this.listen(editor, 'input', (event) => {
      // Suppress the raw part-level event unconditionally (code-reviewer LOW): `input` is in the fleet's
      // closed six-event vocabulary, and this element's contract is `events: []` — an internal editor
      // `input` escaping the host would hand a future consumer part-targeted events the descriptor
      // denies exist. Unlike the ui-textarea donor there is NO host re-emit (deliberate — same contract).
      event.stopPropagation()
      if (this.#composing) return // never mid-composition — compositionend commits the final composed text
      this.value = editor.textContent ?? '' // model ← surface (the caret guard below then skips the echo write)
    })
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', () => {
      this.#composing = false
      this.value = editor.textContent ?? '' // catch the model up to the composed result (the suppressed inputs)
    })

    // ── model → surface (ADR-0014 cl.1: the CARET GUARD) + the placeholder presence flag ──
    this.effect(() => {
      const value = this.value // tracked — re-runs on every value change (typed OR programmatic/clear-on-send)
      if (this.#composing) return // never write mid-composition
      // CARET GUARD: rewrite the editor ONLY when the model diverges from the surface, so a keystroke (which
      // already updated textContent) never resets the caret; a programmatic write/clear DOES flow.
      if (editor.textContent !== value) editor.textContent = value
      editor.toggleAttribute('data-empty', value === '') // keys the CSS placeholder (not :empty — ADR-0014 cl.1)
    })

    // Reactive composer content — models/efforts/model/effort/contextItems can all change post-connect
    // (a consumer's own store-backed selection); this effect keeps the picker triggers/labels/chip row in
    // sync WITHOUT rebuilding the composer's persistent shell above. Re-arms every connect since
    // `connected()` re-runs on reconnect but this effect does not survive a disconnect on its own.
    this.effect(() => {
      this.#syncModelsPicker(this.models, this.model)
      this.#syncEffortsPicker(this.efforts, this.effort)
      this.#syncContextChips(this.contextItems ?? EMPTY_CONTEXT_ITEMS)
    })

    // `busy` drives disabling — a reflected prop `ui-conversation` sets from its own turn-in-flight
    // tracking (TKT-0034), replacing direct field/button manipulation from the outside.
    this.effect(() => {
      this.#applyBusy(this.busy)
    })

    // ── keyboard (LLD CVC-C7): Enter COMMITS, Shift+Enter inserts a newline — the chat-composer third
    // shape between ui-text-field (every Enter submits) and ui-textarea (Enter never submits). `isComposing`
    // guards the IME case: Enter finalizing a composition must never send. ──
    this.listen(editor, 'keydown', (e) => {
      const ke = e as KeyboardEvent
      // Both composition signals, belt-and-braces (code-reviewer INFO): `isComposing` is the
      // platform-truthful flag on the event itself; `#composing` is this element's own listener-tracked
      // state — for the confirming-Enter-before-compositionend case they agree, and carrying both costs
      // nothing while guarding either signal's engine quirks.
      if (ke.key === 'Enter' && !ke.shiftKey && !ke.isComposing && !this.#composing) {
        e.preventDefault()
        this.#send()
      }
    })
    this.listen(this.#sendBtn!, 'click', () => this.#send())
    this.listen(this.#micBtn!, 'click', () => this.#onMicClickCb?.())

    // ── click-to-focus (LLD CVC-C8): clicking the component's own area focuses the editor — but NOT a
    // click on a button/menu/chip ("not its tags, menus, buttons"), each of which owns its own focus. ──
    this.listen(this, 'click', (e) => {
      const target = e.target as Element | null
      if (target && target !== this && target.closest('ui-button, ui-menu, [data-part="context-chip"]')) return
      this.#editor?.focus()
    })

    // Motion gate (interaction-states standard, the ui-textarea reuse) — arm `ready` ONE frame past first
    // paint so the upgrade/first paint SNAPS and only subsequent state changes animate. `states`
    // optional-chained — jsdom has no CustomStateSet (the real motion is the browser smoke).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  /** Forward host focus to the editor PART (the ui-textarea precedent — native `.focus()` parity). */
  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  /** The reply affordance — a callback, NEVER a CustomEvent (SPEC-R5's closed six-event vocabulary has no
   *  submission kind, inherited by lineage from `ui-conversation`). Safe to call before OR after connect. */
  onSubmit(cb: (text: string) => void): void {
    this.#onSubmitCb = cb
  }

  /** Fires with a `models` entry's `id` when the Models picker commits a choice. The picker itself never
   *  writes `this.model` — the consumer owns that, then hands the new value back down through the `model`
   *  prop (props down, callbacks up). Safe to call before or after connect. */
  onModelChange(cb: (id: string) => void): void {
    this.#onModelChangeCb = cb
  }

  /** Fires with an `efforts` entry's `id` when the Effort picker commits a choice. See `onModelChange`. */
  onEffortChange(cb: (id: string) => void): void {
    this.#onEffortChangeCb = cb
  }

  /** Fires with a `contextItems` entry's `id` when its dismiss affordance is clicked — the consumer owns
   *  actually removing it from `contextItems` (props down, callbacks up, the `onModelChange` precedent). */
  onContextDismiss(cb: (id: string) => void): void {
    this.#onContextDismissCb = cb
  }

  /** Fires when the mic button is clicked. OPT-IN: the button stays hidden until this is actually called —
   *  reveals it immediately if already connected, or on the next connect otherwise (the `onSubmit`
   *  precedent — safe to call before or after connect). Deliberately inert beyond this callback — no
   *  speech-to-text mechanism of its own; a consumer that wants real voice input wires it here. */
  onMicClick(cb: () => void): void {
    this.#onMicClickCb = cb
    this.#micBtn?.toggleAttribute('hidden', false)
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────────────

  /** The in-flight guard (TKT-0034, promoted): `if (this.busy) return` is the FIRST check, synchronously,
   *  before reading or clearing the value — a stray Enter keydown racing the disabled-effect's own
   *  attribute write must retain the typed text, never silently drop it (this is why `busy` is a real
   *  guard here, not merely a styling hook the effect below also happens to apply). `value` is a plain
   *  synchronous signal read — only the EFFECTS that react to it are microtask-batched. */
  #send(): void {
    if (this.busy) return
    const text = this.value.trim()
    if (text === '') return
    this.value = '' // the caret-guard effect wipes the editor surface on the next flush
    this.#onSubmitCb?.(text)
  }

  /** The in-flight visual affordance (TKT-0034, promoted; TKT-0058 v2): the editor becomes non-editable
   *  (`contenteditable=false` + `aria-disabled` on the PART), send/mic/picker-trigger buttons disable
   *  (each control's OWN disabled styling/AX already dims + pointer-inerts them), and the HOST carries
   *  `ariaBusy`/`ariaDisabled` via `internals` (never host attributes — the fleet ARIA law; the reflected
   *  `[busy]` attribute is the CSS dim hook). */
  #applyBusy(busy: boolean): void {
    const editor = this.#editor!
    if (busy) {
      editor.setAttribute('contenteditable', 'false')
      editor.setAttribute('aria-disabled', 'true')
      this.internals.ariaBusy = 'true'
      this.internals.ariaDisabled = 'true'
    } else {
      editor.setAttribute('contenteditable', EDITABLE)
      editor.removeAttribute('aria-disabled')
      this.internals.ariaBusy = null
      this.internals.ariaDisabled = null
    }
    this.#sendBtn!.disabled = busy
    this.#micBtn!.disabled = busy
    if (this.#modelsTrigger) this.#modelsTrigger.disabled = busy
    if (this.#effortTrigger) this.#effortTrigger.disabled = busy
  }

  // ── the opt-in picker/chip sync (models/efforts/contextItems) ───────────────────────────────────────

  /** Build-or-update the Models picker from the CURRENT `models`/`model` prop pair. `undefined`/empty
   *  hides it (never destroys it — an already-built menu is cheap to keep around, and destroying an
   *  open overlay mid-interaction is its own hazard). */
  #syncModelsPicker(options: readonly PickerOption[] | undefined, selected: string | undefined): void {
    if (options === undefined || options.length === 0) {
      if (this.#modelsMenu) this.#modelsMenu.open = false // never leave a hidden host's popover open (top-layer orphan)
      this.#modelsMenu?.toggleAttribute('hidden', true)
      return
    }
    if (this.#modelsMenu === undefined) {
      const { menu, trigger } = this.#buildPicker('models', 'Models')
      this.#modelsMenu = menu
      this.#modelsTrigger = trigger
    }
    // Armed once per CONNECTION (`#modelsListenerArmed`, reset in connected()) — NOT once per menu build
    // (the menu DOM survives a reconnect; `this.listen` does not).
    if (!this.#modelsListenerArmed) {
      this.#modelsListenerArmed = true
      this.listen(this.#modelsMenu, 'select', (e) => {
        const id = (e as CustomEvent<{ value: string }>).detail.value
        this.#onModelChangeCb?.(id)
      })
    }
    this.#modelsMenu.toggleAttribute('hidden', false)
    if (this.#modelsBuiltFrom !== options) {
      this.#rebuildPickerItems(this.#modelsMenu, options, selected)
      this.#modelsBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#modelsMenu, selected)
    }
    this.#modelsTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Models'
    this.#appendCaret(this.#modelsTrigger!)
  }

  /** Build-or-update the Effort picker from the CURRENT `efforts`/`effort` prop pair. See `#syncModelsPicker`. */
  #syncEffortsPicker(options: readonly PickerOption[] | undefined, selected: string | undefined): void {
    if (options === undefined || options.length === 0) {
      if (this.#effortMenu) this.#effortMenu.open = false
      this.#effortMenu?.toggleAttribute('hidden', true)
      return
    }
    if (this.#effortMenu === undefined) {
      const { menu, trigger } = this.#buildPicker('effort', 'Effort')
      this.#effortMenu = menu
      this.#effortTrigger = trigger
    }
    if (!this.#effortListenerArmed) {
      this.#effortListenerArmed = true
      this.listen(this.#effortMenu, 'select', (e) => {
        const id = (e as CustomEvent<{ value: string }>).detail.value
        this.#onEffortChangeCb?.(id)
      })
    }
    this.#effortMenu.toggleAttribute('hidden', false)
    if (this.#effortsBuiltFrom !== options) {
      this.#rebuildPickerItems(this.#effortMenu, options, selected)
      this.#effortsBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#effortMenu, selected)
    }
    this.#effortTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Effort'
    this.#appendCaret(this.#effortTrigger!)
  }

  /** The one-time shell for either picker: a `<ui-menu>` whose trigger is a pill `<ui-button variant=soft>`
   *  (the Figma "Models"/"Effort" pill shape). Appended into the persistent `#optionsLeading` cell.
   *  `ui-menu`'s OWN `connected()`/`#ensureParts()` unconditionally overwrites its first child's
   *  `data-part` to the literal `"trigger"` the moment `menu` joins the connected tree (menu.ts) — so a
   *  caller-set `data-part` on the trigger never survives. `data-picker` (a distinct attribute ui-menu
   *  never touches) is set AFTER the append instead, as the stable selector for "which picker's trigger
   *  is this" (`[data-part="models-menu"] [data-part="trigger"]` also works, scoped by the host). */
  #buildPicker(part: string, fallbackLabel: string): { menu: UIMenuElement; trigger: UIButtonElement } {
    const trigger = document.createElement('ui-button') as UIButtonElement
    trigger.setAttribute('variant', 'soft')
    trigger.textContent = fallbackLabel
    const menu = document.createElement('ui-menu') as UIMenuElement
    menu.dataset.part = `${part}-menu`
    menu.append(trigger)
    this.#optionsLeading!.append(menu) // connects `menu` — its OWN connected() now runs, forcibly re-tagging `trigger`'s data-part
    trigger.setAttribute('data-picker', part)
    return { menu, trigger }
  }

  /** A trailing caret glyph on a picker trigger — re-appended on every label rewrite since `textContent =`
   *  above wipes any prior child (including a previously-appended caret). */
  #appendCaret(trigger: UIButtonElement): void {
    const caret = document.createElement('ui-icon')
    caret.setAttribute('slot', 'trailing')
    caret.setAttribute('data-role', 'caret')
    caret.setAttribute('glyph', 'caret-down')
    trigger.append(caret)
  }

  /** Replace a picker menu's item list wholesale (cheap for the small, static lists this control expects —
   *  a handful of models/effort levels, never a long scrollable catalog). Marks the current selection via
   *  `data-selected` (ui-menu's items are `role=menuitem` — action semantics, not `role=option` — so a
   *  visual marker, not `aria-selected`, is the correct signal here). */
  #rebuildPickerItems(menu: UIMenuElement, options: readonly PickerOption[], selected: string | undefined): void {
    const panel = menu.querySelector('[data-part="panel"]')
    if (!panel) return // pre-connect ui-menu — its own connected() hasn't run yet; the effect re-fires once it has
    panel.replaceChildren()
    // The roving-focus trait's own one-time settle pass only covers items present at ITS first population —
    // items added later (here) start all at tabindex=-1 with nothing focusable on Tab/open. Give the
    // selected item (or the first, if none selected yet) the roving base tabindex=0.
    const focusableId = selected ?? options[0]?.id
    for (const option of options) {
      const item = document.createElement('div')
      // ui-menu's OWN auto-role-assignment (menu.ts's #ensureParts) runs ONCE, over whatever children
      // exist at the menu's OWN first connect — the panel is still EMPTY at that moment (items are
      // populated here, later, reactively), so it never reaches these. Its click delegation + roving
      // focus both filter strictly by `[role="menuitem"]` (#itemsIn) — set explicitly, never inherited.
      item.setAttribute('role', 'menuitem')
      item.setAttribute('tabindex', option.id === focusableId ? '0' : '-1')
      item.dataset.value = option.id
      item.textContent = option.label
      item.toggleAttribute('data-selected', option.id === selected)
      panel.append(item)
    }
  }

  #markPickerSelection(menu: UIMenuElement, selected: string | undefined): void {
    const panel = menu.querySelector('[data-part="panel"]')
    if (!panel) return
    for (const item of panel.children) {
      const el = item as HTMLElement
      const isSelected = el.dataset.value === selected
      el.toggleAttribute('data-selected', isSelected)
      el.setAttribute('tabindex', isSelected ? '0' : '-1') // keep the roving base in sync with the selection
    }
  }

  /** Rebuild the context-chip row wholesale from `contextItems` (cheap — never more than a few). Each
   *  chip's dismiss button fires `onContextDismiss` with THAT item's own `id`; the consumer owns actually
   *  removing it (props down, callbacks up). */
  #syncContextChips(items: readonly ContextItem[]): void {
    if (this.#contextItemsBuiltFrom === items) return // unchanged reference — an unrelated prop change re-ran this effect
    this.#contextItemsBuiltFrom = items
    const row = this.#contextChips!
    row.replaceChildren()
    row.toggleAttribute('hidden', items.length === 0)
    for (const item of items) {
      const chip = document.createElement('span')
      chip.dataset.part = 'context-chip'
      const label = document.createElement('span')
      label.dataset.part = 'context-chip-label'
      label.textContent = item.label
      const dismiss = document.createElement('ui-button') as UIButtonElement
      dismiss.setAttribute('variant', 'ghost')
      dismiss.setAttribute('icon-only', '')
      dismiss.setAttribute('aria-label', `Remove ${item.label} from context`)
      dismiss.dataset.part = 'context-chip-dismiss'
      const icon = document.createElement('ui-icon')
      icon.setAttribute('slot', 'leading')
      icon.setAttribute('data-role', 'icon')
      icon.setAttribute('glyph', 'x')
      dismiss.append(icon)
      this.listen(dismiss, 'click', () => this.#onContextDismissCb?.(item.id))
      chip.append(label, dismiss)
      row.append(chip)
    }
  }
}

if (!customElements.get('ui-conversation-composer')) customElements.define('ui-conversation-composer', UIConversationComposerElement)
