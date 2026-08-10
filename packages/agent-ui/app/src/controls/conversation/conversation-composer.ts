// conversation-composer.ts — UIConversationComposerElement (TKT-0056 · TKT-0058 v2), the message-composition
// UI extracted out of `ui-conversation`. `tier: pattern` / `extends: UIElement` — since the v2 unroll
// (TKT-0058) the host is ITSELF the field: one ADR-0014 field frame whose content is the opt-in
// context-chip row (above), an OWN contenteditable multi-line editor (the ADR-0134 `ui-textarea` pattern,
// reused — no nested `ui-text-field` anymore), and the options row (Provider/Models/Effort/Mode `ui-menu`
// pickers + mic/send `ui-button`s, below). All parts are JS-created internal children (the
// `master-detail.ts` → `ui-split` precedent — never author-composed; `slots: []`).
//
// GH #257 — the Provider/Mode pickers join Models/Effort, built the exact same menu+trigger way. Provider
// narrows the SAME Models picker to an internally-derived view of the selected provider's own model list
// (a model belongs to exactly one provider — never a standalone fourth axis); Mode is a plain flat
// PickerOption[]/id pair mirroring Models/Effort exactly (this element never imports the a2ui-owned
// `GenUiMode` type itself — a consumer builds its own `modes` list, the `efforts`/`EFFORT_LEVELS` precedent).
//
// `ui-conversation` composes this ONCE (`document.createElement('ui-conversation-composer')`) and forwards
// `models`/`model`/`efforts`/`effort`/`providers`/`provider`/`modes`/`mode`/`contextItems` down as props,
// sets `busy` from its own turn-in-flight tracking, and listens for this element's seven callback
// registrations (`onSubmit`/`onModelChange`/`onEffortChange`/`onProviderChange`/`onModeChange`/
// `onContextDismiss`/`onMicClick`) — see conversation.ts (LLD CVC-C5) for the pinned forwarding mechanism.
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
import type { PickerOption, ProviderOption, ContextItem } from './composer-options.ts'

// The editor's editable mode (ADR-0014 cl.1, the ui-textarea reuse).
const EDITABLE = 'plaintext-only'

const props = {
  // The live message text (TKT-0058) — property-only (`attribute: false`): this element is never
  // author-composed, so there is no markup value to seed (unlike ui-text-field/ui-textarea, whose value
  // ATTRIBUTE seeds a reset baseline). The live value rides this signal + the editor surface, never a host
  // attribute.
  value: { ...prop.string(), attribute: false as const },
  // The editor's ghost text (GH #672) — default UNCHANGED from the prior hard-coded literal ("Ask
  // anything.."), so a consumer that never sets this is byte-identical to before. `attribute: false` —
  // this element is never author-composed (the `value` precedent, above): a consumer that wants a
  // different placeholder (e.g. agent-admin's Author empty-state) sets the PROPERTY, never markup.
  placeholder: { ...prop.string('Ask anything..'), attribute: false as const },
  // Every one below defaults to undefined/empty, so a consumer that never sets them (the ORIGINAL
  // field+Send shape) gets exactly that — `ui-conversation` stays generic, it never names a model or
  // hardcodes "Effort"'s levels beyond the shared `EFFORT_LEVELS` constant a consumer may reuse.
  models: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  model: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  efforts: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  effort: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // GH #257 — the Provider axis: each entry carries its OWN model list + defaultModel (composer-
  // options.ts's `ProviderOption`). Selecting a provider narrows the SAME Models picker built from
  // `models` above to an INTERNALLY-DERIVED view (`#effectiveModels()`) — never a separate/fourth picker
  // — since a model belongs to exactly one provider. `undefined` (default) ⇒ no Provider picker; the
  // plain `models`/`model` pair keeps working standalone exactly as before (byte-identical default-off).
  providers: { ...prop.json<readonly ProviderOption[] | undefined>(undefined), attribute: false as const },
  provider: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // GH #257 — the Gen-UI Mode axis: a plain flat `PickerOption[]`/selected-id pair, following the exact
  // `models`/`model` shape (no narrowing semantics of its own) — this element never imports `GenUiMode`
  // itself (that type stays a2ui-owned); a consumer builds its own `modes` list (e.g. from
  // `GEN_UI_MODES`/`gen-ui-mode.ts`) exactly like it already builds `efforts` from `EFFORT_LEVELS`.
  modes: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  mode: { ...prop.json<string | undefined>(undefined), attribute: false as const },
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
  // GH #257 — the Provider/Mode pickers, built the SAME way as Models/Effort above.
  #providersMenu: UIMenuElement | undefined
  #providersTrigger: UIButtonElement | undefined
  #modesMenu: UIMenuElement | undefined
  #modesTrigger: UIButtonElement | undefined
  // The last option list each picker's items were built from — rebuilt only when the REFERENCE changes
  // (a consumer's own list is typically a stable module-level constant, e.g. SUPPORTED_MODELS; a
  // reference-equality guard avoids tearing down/rebuilding the panel on every unrelated reactive pass).
  #modelsBuiltFrom: readonly PickerOption[] | undefined
  #effortsBuiltFrom: readonly PickerOption[] | undefined
  #providersBuiltFrom: readonly ProviderOption[] | undefined
  #modesBuiltFrom: readonly PickerOption[] | undefined
  #contextItemsBuiltFrom: readonly ContextItem[] | undefined
  // Whether THIS connection has armed the picker's own 'select' listener — reset false at the TOP of every
  // connect: the menu DOM (and `#modelsMenu`'s mere existence) persists across a reconnect, but
  // `this.listen(...)` rides the CURRENT connection's AbortSignal — a listener armed only inside the
  // "build the menu" branch (which runs at most once, EVER) silently never re-arms on reconnect.
  #modelsListenerArmed = false
  #effortListenerArmed = false
  #providersListenerArmed = false
  #modesListenerArmed = false
  // The IME-composition guard (ADR-0014 cl.1, the ui-textarea reuse) — surface→model syncs and the
  // model→surface caret-guard write are BOTH suppressed mid-composition; compositionend catches up.
  #composing = false

  #onSubmitCb: ((text: string) => void) | undefined
  #onModelChangeCb: ((id: string) => void) | undefined
  #onEffortChangeCb: ((id: string) => void) | undefined
  #onProviderChangeCb: ((id: string) => void) | undefined
  #onModeChangeCb: ((id: string) => void) | undefined
  #onContextDismissCb: ((id: string) => void) | undefined
  #onMicClickCb: (() => void) | undefined

  protected connected(): void {
    this.#modelsListenerArmed = false
    this.#effortListenerArmed = false
    this.#providersListenerArmed = false
    this.#modesListenerArmed = false
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

    // ── editor attribute mirror — the placeholder text (GH #672, the ui-textarea `placeholder` precedent) ──
    this.effect(() => {
      editor.setAttribute('data-placeholder', this.placeholder) // the CSS placeholder reads attr(data-placeholder)
    })

    // Reactive composer content — models/efforts/model/effort/contextItems can all change post-connect
    // (a consumer's own store-backed selection); this effect keeps the picker triggers/labels/chip row in
    // sync WITHOUT rebuilding the composer's persistent shell above. Re-arms every connect since
    // `connected()` re-runs on reconnect but this effect does not survive a disconnect on its own.
    this.effect(() => {
      // GH #257 — Provider renders FIRST (it narrows Models, so it reads as "pick the source, then the
      // item"), then Models (fed the internally-derived narrowed view when `providers` is set), then
      // Effort, then Mode — the visible options-row order.
      this.#syncProvidersPicker(this.providers, this.provider)
      this.#syncModelsPicker(this.#effectiveModels(), this.model)
      this.#syncEffortsPicker(this.efforts, this.effort)
      this.#syncModesPicker(this.modes, this.mode)
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

  /** Fires with a `providers` entry's `id` when the Provider picker commits a choice. See `onModelChange`
   *  (props down, callbacks up — this element never writes `this.provider` itself). A provider switch that
   *  ALSO resets the current model (because it no longer belongs to the new provider) fires `onModelChange`
   *  alongside this one, in the same commit — see `#syncProvidersPicker`. */
  onProviderChange(cb: (id: string) => void): void {
    this.#onProviderChangeCb = cb
  }

  /** Fires with a `modes` entry's `id` when the Mode picker commits a choice. See `onModelChange`. */
  onModeChange(cb: (id: string) => void): void {
    this.#onModeChangeCb = cb
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
    if (this.#providersTrigger) this.#providersTrigger.disabled = busy
    if (this.#modesTrigger) this.#modesTrigger.disabled = busy
  }

  /** GH #257 — the Models picker's CURRENT effective option list: when `providers` is set AND non-empty, an
   *  INTERNALLY-DERIVED view (the selected provider's OWN `models`) narrows it; otherwise the plain `models`
   *  prop (unchanged, byte-identical for any consumer that never sets `providers`). `providers: []` is
   *  treated the SAME as `undefined` (code-reviewer L1) — `#syncProvidersPicker` already hides the Provider
   *  picker for an empty list, so this must not ALSO silently hide an author-set `models` list underneath
   *  it (a bare `.find()` on `[]` returns `undefined`, which would). Never written back into the `models`
   *  prop itself — `models` stays exactly what its own consumer set it to. */
  #effectiveModels(): readonly PickerOption[] | undefined {
    if (this.providers === undefined || this.providers.length === 0) return this.models
    return this.providers.find((p) => p.id === this.provider)?.models
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
    // GH #670 — pinned only on a build that really happened (see `#rebuildPickerItems`), so a bail leaves the
    // guard open for the next pass instead of freezing an empty panel forever. Same rule in all four pickers.
    if (this.#modelsBuiltFrom !== options) {
      if (this.#rebuildPickerItems(this.#modelsMenu, options, selected)) this.#modelsBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#modelsMenu, selected)
    }
    this.#modelsTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Models'
    // GH #665 (Kim's ruling) — the leading glyph the composer's own narrow-host compact mode collapses
    // to (conversation-composer.css's `21rem` container query): `list` is the closest fit the fleet's
    // curated Phosphor subset (icons.gen.ts, ADR-0066) ships today for "choose from a set" — there is no
    // dedicated model/cpu glyph in that set. Re-appended every rewrite, matching `#appendCaret`'s own
    // documented reason (`trigger.textContent =` above wipes every prior child, this one included).
    this.#appendLeadingIcon(this.#modelsTrigger!, 'list')
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
      if (this.#rebuildPickerItems(this.#effortMenu, options, selected)) this.#effortsBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#effortMenu, selected)
    }
    this.#effortTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Effort'
    // GH #665 — see `#syncModelsPicker`'s identical comment. `fast-forward` (intensity/push-harder) is the
    // closest fit the curated set ships for a reasoning-effort dial; there is no dedicated gauge glyph.
    this.#appendLeadingIcon(this.#effortTrigger!, 'fast-forward')
    this.#appendCaret(this.#effortTrigger!)
  }

  /** Build-or-update the Provider picker from the CURRENT `providers`/`provider` prop pair — the SAME
   *  shape as `#syncModelsPicker`/`#syncEffortsPicker`, plus one extra step on commit: a model belongs to
   *  exactly one provider, so switching providers resets `model` to the NEW provider's own `defaultModel`
   *  whenever the CURRENT `model` doesn't belong to its list (mirrors `provider-switcher.ts`'s own
   *  provider-`select` handler exactly). This element never writes `provider`/`model` itself (props down,
   *  callbacks up) — it fires `onModelChange` alongside `onProviderChange` in the SAME commit, so a
   *  consumer that wires both ends up with a consistent {provider, model} pair after either call. */
  #syncProvidersPicker(options: readonly ProviderOption[] | undefined, selected: string | undefined): void {
    if (options === undefined || options.length === 0) {
      if (this.#providersMenu) this.#providersMenu.open = false
      this.#providersMenu?.toggleAttribute('hidden', true)
      return
    }
    if (this.#providersMenu === undefined) {
      const { menu, trigger } = this.#buildPicker('providers', 'Provider')
      this.#providersMenu = menu
      this.#providersTrigger = trigger
    }
    if (!this.#providersListenerArmed) {
      this.#providersListenerArmed = true
      this.listen(this.#providersMenu, 'select', (e) => {
        const id = (e as CustomEvent<{ value: string }>).detail.value
        const next = this.providers?.find((p) => p.id === id)
        if (next && !next.models.some((m) => m.id === this.model)) {
          this.#onModelChangeCb?.(next.defaultModel) // the reset — fired BEFORE onProviderChange so a
          // consumer wiring both in sequence lands on a consistent {provider, model} pair either way.
        }
        this.#onProviderChangeCb?.(id)
      })
    }
    this.#providersMenu.toggleAttribute('hidden', false)
    if (this.#providersBuiltFrom !== options) {
      if (this.#rebuildPickerItems(this.#providersMenu, options, selected)) this.#providersBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#providersMenu, selected)
    }
    this.#providersTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Provider'
    this.#appendCaret(this.#providersTrigger!)
  }

  /** Build-or-update the Mode picker from the CURRENT `modes`/`mode` prop pair — a plain flat picker with
   *  no narrowing of its own (the GenUiMode axis, GH #257). See `#syncEffortsPicker`. */
  #syncModesPicker(options: readonly PickerOption[] | undefined, selected: string | undefined): void {
    if (options === undefined || options.length === 0) {
      if (this.#modesMenu) this.#modesMenu.open = false
      this.#modesMenu?.toggleAttribute('hidden', true)
      return
    }
    if (this.#modesMenu === undefined) {
      const { menu, trigger } = this.#buildPicker('mode', 'Mode')
      this.#modesMenu = menu
      this.#modesTrigger = trigger
    }
    if (!this.#modesListenerArmed) {
      this.#modesListenerArmed = true
      this.listen(this.#modesMenu, 'select', (e) => {
        const id = (e as CustomEvent<{ value: string }>).detail.value
        this.#onModeChangeCb?.(id)
      })
    }
    this.#modesMenu.toggleAttribute('hidden', false)
    if (this.#modesBuiltFrom !== options) {
      if (this.#rebuildPickerItems(this.#modesMenu, options, selected)) this.#modesBuiltFrom = options
    } else {
      this.#markPickerSelection(this.#modesMenu, selected)
    }
    this.#modesTrigger!.textContent = options.find((o) => o.id === selected)?.label ?? 'Mode'
    this.#appendCaret(this.#modesTrigger!)
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

  /** GH #665 (Kim's ruling) — a leading glyph on the Models/Effort picker triggers ONLY (`#syncModelsPicker`/
   *  `#syncEffortsPicker` are the two callers): the icon the composer's own narrow-host compact mode
   *  (conversation-composer.css's `21rem` container query) collapses TO once the label vanishes, so a
   *  compacted trigger still says WHICH picker it is rather than reading as a bare caret. Re-appended every
   *  label rewrite for the SAME reason `#appendCaret` below re-appends its own caret — `trigger.textContent
   *  =` wipes every prior child, this one included; button.ts's own heal pass then re-wraps whatever stray
   *  text node the rewrite left as the fresh `[data-part='label']`, and both adornments land back in their
   *  slots regardless of re-append order (button.css's `:has()` grid keys off SLOT presence, not source
   *  order). */
  #appendLeadingIcon(trigger: UIButtonElement, glyph: string): void {
    const icon = document.createElement('ui-icon')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('glyph', glyph)
    trigger.prepend(icon)
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
   *  visual marker, not `aria-selected`, is the correct signal here).
   *
   *  Answers whether it actually BUILT, so a caller only pins its `#…BuiltFrom` guard to a list it really
   *  rendered (GH #670). Returning void made the pre-connect bail below PERMANENT for any option list whose
   *  REFERENCE never changes: the caller pinned the guard anyway, and no later pass ever tried again. That
   *  is why the Effort picker (`EFFORT_LEVELS`, a module constant) could sit as a real, clickable trigger
   *  over an empty panel while Models — a fresh `roster.filter(...)` array every render — quietly rebuilt
   *  itself out of the same hole on the next pass.
   *
   *  Measured on the agent-admin Author card (GH #670, 2026-08-10): the composer's FIRST sync pass runs from
   *  a `connectedCallback` whose own `isConnected` is already `false` — the GH #302 reentrancy shape, here
   *  produced by `ui-master-detail`'s compose-time pane relocation — so the `ui-menu` this pass appends
   *  never gets its panel, and both pickers bail together. Only a COMPOSED relocation produces that pass,
   *  which is why this law's regression proof lives at that level (agent-admin-authoring.test.ts's GH #670
   *  block picks a real Effort option out of the Author card's own menu) rather than in this control's own
   *  suite, where a plain mount always has its panel by the first pass. */
  #rebuildPickerItems(menu: UIMenuElement, options: readonly PickerOption[], selected: string | undefined): boolean {
    const panel = menu.querySelector('[data-part="panel"]')
    if (!panel) return false // pre-connect ui-menu — its own connected() hasn't run yet; the effect re-fires once it has
    panel.replaceChildren()
    // The roving-focus trait's own one-time settle pass only covers items present at ITS first population —
    // items added later (here) start all at tabindex=-1 with nothing focusable on Tab/open. Give the
    // selected item (or the first ENABLED one, if none selected yet) the roving base tabindex=0 — never a
    // disabled option (GH #257's "coming soon" precedent).
    const focusableId = selected ?? options.find((o) => !o.disabled)?.id ?? options[0]?.id
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
      // GH #257 — a non-committable option (the "coming soon" provider precedent): ui-menu's own
      // click/keydown delegation already skips an `aria-disabled="true"` item (menu.ts), so this is the
      // ONLY wiring a disabled entry needs here.
      if (option.disabled) item.setAttribute('aria-disabled', 'true')
      panel.append(item)
    }
    return true
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
