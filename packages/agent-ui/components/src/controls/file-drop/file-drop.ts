// file-drop.ts — UIFileDropElement, the fleet's file-INPUT affordance (ADR-0210, GH #1391 — the
// ADR-0112 cl.1 named fence opened). Host-mediated HANDLE model: bytes never ride the component's own
// public API — `files` carries host-minted `{id,name,mimeType,sizeBytes}` descriptors ONLY (ADR-0210
// cl.3/cl.4). This file builds the CONTROL ONLY — the A2UI catalog row/factory, the renderer's own host
// file-intake seam WIRING, and every prompt/spec artifact are OUT OF SCOPE here (ADR-0210's Repairs list
// names them as separate build items; GH #1391's other half).
//
// ── The intake extensibility point — a build-time decision, not an LLD ─────────────────────────────────
// ADR-0210 cl.4.2 directs the SHAPE ("a host file-intake seam the renderer exposes at construction …
// (files: File[], ctx) => Promise<FileHandleDescriptor[]> … the exact signature, registry home, and ctx
// contents are the LLD's") but no SPEC/LLD for `ui-file-drop` exists yet — cl.7 says the build gets its
// own SPEC/LLD leg, not authored in this pass. Absent that leg, this control exposes the minimal seam the
// ADR text itself pins: two plain (non-attribute, non-serializable — callbacks cannot ride HTML attributes)
// instance properties, `intake` and `isKnown`, both SIGNAL-backed so a host setting them at ANY point
// (construction-time or later — cl.4.2 says "at construction" but does not forbid a later attach) repaints
// reactively. `intake` unset ⇒ the control renders visibly disabled with a component-owned reason (cl.4.5:
// "never a silently dead dropzone"). `isKnown` unset ⇒ every externally-written descriptor renders as
// available (no registry to consult — the conservative default; cl.3's "unavailable chip" path only
// engages once a host actually wires a registry check). Both are PROVISIONAL: the eventual LLD owns the
// real signature/registry home/ctx shape and may widen or replace this seam — flagged in the build's
// handoff, not hidden here.
//
// ── The native `<input type="file">` picker trigger — a necessity, not a law violation ─────────────────
// CLAUDE.md's "no native form elements" law targets a control's OWN semantic surface (ui-checkbox does not
// delegate its checked-state semantics to a native `<input type=checkbox>`). Opening the platform's OS file
// picker has no ARIA-only substitute — the File System Access API is not cross-engine, and drag/drop +
// paste (below) need no native element at all, but the "Browse" gesture does. This control follows the
// EXACT shape GH #1211's composer prior art already ships (ADR-0210 cl.4.2's own citation): a real,
// accessible `<ui-button>` trigger over a HIDDEN, `aria-hidden`, un-tabbable native `<input type="file">`
// that exists purely as OS-picker plumbing — never part of the control's own accessible surface (no ARIA
// role/label of its own; internals.role/ARIA on the HOST is the control's real semantic surface, ADR-0013).
//
// Content model: a rendered content cell (host-as-content, the attachment.ts/table.ts idiom) — `files`/
// `label`/rejection state are all dynamic, so there is no static host-as-grid anatomy to declare. Anatomy,
// component-built only (no author-composed children; `slots: []`): a decorative upload icon, an
// instruction/status `hint` line, the `browse` trigger + its hidden `picker` input, and a `chips` row of
// committed-file cards (each a composed `<ui-attachment>` — ADR-0112 Amendment 1's verbatim prop reuse
// pays off here with zero mapping — plus a `remove` affordance). `tier: pattern` (geometry.md's Pattern
// class): the browse/remove buttons ride the Control-band height via their OWN `<ui-button>` geometry;
// the shell (gap/padding) rides the `--space-*` ramp, minted into this control's own `--ui-file-drop-*`
// chain (TKT-0066 item 5 — `@scope` never reads `--md-sys-space-*`/`--md-sys-shape-corner-base` directly).
//
// Value + events: ONE two-way mark, `value:{prop:'files',event:'change'}` (ADR-0210 cl.3) — `change` fires
// per COMMITTED mutation (a mint landing, a chip removed), never per progress tick. `accept`/`multiple`/
// `maxSizeBytes`/`maxFiles` are structural literals (the `Swiper` non-bindable-constraint precedent, ADR-0210
// cl.2) — component-side enforcement is UX (a visible rejection reason), never the security boundary (the
// host seam re-checks, cl.2/cl.4.4). No endpoint prop exists anywhere in this file, by construction
// (cl.4.3) — the control performs zero network I/O.
//
// Layer: controls/ → dom + traits + reactive (inward-only ✓: controls ← traits ← dom ← reactive).
// erasableSyntaxOnly ✓ (no enum/namespace/decorators). verbatimModuleSyntax ✓ (import type).

import { UIFormElement, prop, type FormValue, type PropConfig, type PropsSchema, type PropType, type ReactiveProps, type ValidityResult } from '../../dom/index.ts'
import { signal } from '../../reactive/index.ts'
import { tabbable } from '../../traits/tabbable.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import '../button/button.ts' // side-effect: defines <ui-button> — the browse/remove triggers
import '../icon/icon.ts' // side-effect: defines <ui-icon> — the decorative glyphs (attachment.ts idiom)
import '../attachment/attachment.ts' // side-effect: defines <ui-attachment> — the committed-file chip body (ADR-0210 Consequences: zero-mapping reuse)

// ── The wire shape — ADR-0210 cl.3, verbatim ────────────────────────────────────────────────────────────

/** A host-minted file handle: metadata + an opaque, unguessable, session/surface-scoped id. JSON-safe by
 *  construction — no `File`, no `Blob`, no bytes, ever (ADR-0210 cl.4.1). `name`/`mimeType`/`sizeBytes`
 *  are the `Attachment` prop names verbatim (ADR-0112 Amendment 1) — zero mapping to re-render a committed
 *  file via `<ui-attachment>`, here or in a later agent turn. */
export interface FileHandleDescriptor {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
}

/** The intake seam's call context (ADR-0210 cl.4.2) — PROVISIONAL, the LLD's to widen (file header note). */
export interface FileDropIntakeContext {
  /** Whether `multiple` is set on this control at the moment of the gesture. */
  multiple: boolean
}

/** One call per gesture, store-blind/kind-blind (GH #1211's own shape) — mints descriptors from raw
 *  platform `File`s. Unset ⇒ the control renders disabled with a component-owned reason (cl.4.5). */
export type FileDropIntake = (files: readonly File[], ctx: FileDropIntakeContext) => Promise<FileHandleDescriptor[]>

/** Read-direction registry check (ADR-0210 cl.3): does the host's registry still recognize this id? Unset
 *  ⇒ every externally-written descriptor renders as available (no registry to consult). */
export type FileDropIsKnown = (id: string) => boolean

// ── The `files` codec — a hardened array-of-descriptor codec (the multi-select.ts `valueType`/`cleanValue`
// precedent, one structural level deeper: objects, not strings). Never throws; never null/undefined. ─────

function isFileHandleDescriptor(v: unknown): v is FileHandleDescriptor {
  if (v === null || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' && o.id !== '' &&
    typeof o.name === 'string' &&
    typeof o.mimeType === 'string' &&
    typeof o.sizeBytes === 'number' && Number.isFinite(o.sizeBytes)
  )
}

/** Harden an arbitrary `files` input into a descriptor array — a malformed member is DROPPED, never
 *  coerced (the `cleanValue` precedent); a non-array input → `[]`. */
function cleanFiles(input: unknown): FileHandleDescriptor[] {
  if (!Array.isArray(input)) return []
  return input.filter(isFileHandleDescriptor)
}

const filesType: PropType<FileHandleDescriptor[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanFiles(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

/** NOT reflected — bindable committed-selection state, not an authored dimension (the multi-select.ts
 *  `valueProp` precedent). The attribute is still INBOUND-parsed, so a declarative
 *  `<ui-file-drop files='[...]'>` still seeds the initial value (e.g. re-presenting a prior turn's files). */
const filesProp: PropConfig<FileHandleDescriptor[]> = { type: filesType, default: [] }

// ── Props — ADR-0210 cl.2's table, verbatim (order here follows the fleet's own
// `...UIFormElement.formProps` spread-first convention, e.g. multi-select.ts; the CONTENT is ADR-0210's) ──

const props = {
  ...UIFormElement.formProps, // name / disabled / required — the TextField form-participation trio (cl.2)
  files: filesProp, // the value surface — bindable at the A2UI layer; read cl.3, write cl.3
  label: { ...prop.string(''), reflect: true }, // the accessible name / instruction line — never silent-empty (see FALLBACK_LABEL)
  accept: { ...prop.string(''), reflect: true }, // the native <input accept> grammar verbatim; '' ⇒ any. NOT bindable (structural literal, cl.2)
  multiple: { ...prop.boolean(false), reflect: true }, // default false — the native default, and the conservative one. NOT bindable
  // Named `maxSizeBytes`/`max-size-bytes`, never `size` (ADR-0112 Amendment 1 naming law — `size` is the
  // reserved widget-tier geometry enum; family-coherence.test.ts's fleet-wide invariant). NOT bindable.
  maxSizeBytes: { ...prop.number(null), attribute: 'max-size-bytes', reflect: true },
  // Meaningful only with `multiple`; absent (null) ⇒ host-policy cap only (cl.2). NOT bindable.
  maxFiles: { ...prop.number(null), attribute: 'max-files', reflect: true },
} satisfies PropsSchema

// The never-silent-empty instruction line (ADR-0210 cl.2's own parenthetical example).
const FALLBACK_LABEL = 'Drop files here, or browse'
// The component-owned reason shown when no intake seam is registered (cl.4.5 — "never a silently dead dropzone").
const UNWIRED_REASON = 'File attachment is not available here.'

/** The native `<input accept>` grammar (comma-separated MIME types / `.ext` patterns) — a small, hand-rolled
 *  matcher; zero new grammar (ADR-0210 cl.2 — "LLM-familiar"). */
function acceptsFile(accept: string, file: File): boolean {
  const patterns = accept.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '')
  if (patterns.length === 0) return true // absent ⇒ any (cl.2)
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return patterns.some((p) => {
    if (p.startsWith('.')) return name.endsWith(p)
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1))
    return type === p
  })
}

export interface UIFileDropElement extends ReactiveProps<typeof props> {}
export class UIFileDropElement extends UIFormElement {
  static props = props

  // ── The intake seam (file header note) — signal-backed so a host write at ANY time repaints reactively. ──
  #intake = signal<FileDropIntake | null>(null)
  get intake(): FileDropIntake | null {
    return this.#intake.value
  }
  set intake(fn: FileDropIntake | null) {
    this.#intake.value = fn
  }
  #isKnown = signal<FileDropIsKnown | null>(null)
  get isKnown(): FileDropIsKnown | null {
    return this.#isKnown.value
  }
  set isKnown(fn: FileDropIsKnown | null) {
    this.#isKnown.value = fn
  }

  // Native-parity reset baseline — seeded ONCE from the initial `files` attribute (the combo-box.ts /
  // multi-select.ts `#defaultValue`/`#defaultCaptured` precedent).
  #defaultFiles: FileHandleDescriptor[] = []
  #defaultCaptured = false

  // The user-invalid TIMING controller (ADR-0051) — created per connection, released on disconnect.
  #userInvalid: TrackUserInvalidController | null = null

  // A transient status override (a rejection reason, or an intake failure) — painted over the hint line
  // until the next successful commit / drag re-entry / focus. A private signal (the checkbox.ts
  // `#indeterminate` precedent) so the hint-paint effect below re-runs when it changes.
  #statusOverride = signal<string | null>(null)

  // Component-built anatomy — created ONCE (persists across a reconnect; only listeners/effects are
  // scope-owned and rebuilt per connect, the text-field.ts / table.ts idiom).
  #hint: HTMLElement | undefined
  #browseBtn: HTMLElement | undefined
  #pickerInput: HTMLInputElement | undefined
  #chipsHost: HTMLElement | undefined

  #isUsable(): boolean {
    return !this.effectiveDisabled() && this.intake !== null
  }

  // ── Form seams (UIFormElement hooks) ────────────────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    // A single JSON entry carrying the WHOLE committed descriptor array — metadata-only, bytes never ride
    // this either (cl.4.1). Empty selection ⇒ null, contributing no entry (native `<input type=file>` parity).
    return this.files.length > 0 ? JSON.stringify(this.files) : null
  }

  protected override formValidity(): ValidityResult {
    if (this.required && this.files.length === 0) {
      return { valid: false, flags: { valueMissing: true }, message: 'Please attach at least one file.' }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    this.files = this.#defaultFiles
    this.#userInvalid?.reset()
    this.#statusOverride.value = null
  }

  protected override disconnected(): void {
    this.#userInvalid?.release()
    this.#userInvalid = null
  }

  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  // ── Anatomy (built once) ─────────────────────────────────────────────────────────────────────────────

  #ensureAnatomy(): void {
    if (this.#hint) return

    const icon = document.createElement('ui-icon')
    icon.setAttribute('data-part', 'icon')
    icon.setAttribute('glyph', 'upload-simple')
    icon.setAttribute('aria-hidden', 'true') // decorative — the hint line carries the real text

    const hint = document.createElement('span')
    hint.setAttribute('data-part', 'hint')

    const browse = document.createElement('ui-button')
    browse.setAttribute('data-part', 'browse')
    browse.setAttribute('variant', 'soft')
    browse.setAttribute('size', 'sm')
    browse.textContent = 'Browse files'

    // The hidden native OS-picker trigger (file header note) — never part of the control's own
    // accessible surface: no role/label of its own, out of the tab order, aria-hidden.
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.setAttribute('data-part', 'picker')
    picker.hidden = true
    picker.tabIndex = -1
    picker.setAttribute('aria-hidden', 'true')

    const chips = document.createElement('div')
    chips.setAttribute('data-part', 'chips')

    this.append(icon, hint, browse, picker, chips)
    this.#hint = hint
    this.#browseBtn = browse
    this.#pickerInput = picker
    this.#chipsHost = chips
  }

  /** One committed-file chip: a composed `<ui-attachment>` (ADR-0210 Consequences' zero-mapping reuse) +
   *  a remove affordance. An id the host's registry no longer recognizes (`isKnown` returns false) renders
   *  INERT — rendered, never dropped (cl.3: "silently dropping data-model content makes the surface lie
   *  about its own state"). */
  #buildChip(file: FileHandleDescriptor, known: boolean): HTMLElement {
    const chip = document.createElement('div')
    chip.setAttribute('data-part', 'chip')
    if (!known) chip.setAttribute('data-unavailable', '')

    const attachment = document.createElement('ui-attachment')
    attachment.setAttribute('filename', file.name)
    attachment.setAttribute('mime-type', file.mimeType)
    attachment.setAttribute('size-bytes', String(file.sizeBytes))
    chip.append(attachment)

    if (!known) {
      const note = document.createElement('span')
      note.setAttribute('data-part', 'unavailable-note')
      note.textContent = 'Unavailable'
      chip.append(note)
    }

    const remove = document.createElement('ui-button')
    remove.setAttribute('data-part', 'remove')
    remove.setAttribute('variant', 'ghost')
    remove.setAttribute('size', 'sm')
    remove.setAttribute('icon-only', '')
    remove.setAttribute('aria-label', `Remove ${file.name}`)
    const removeIcon = document.createElement('ui-icon')
    removeIcon.setAttribute('slot', 'leading')
    removeIcon.setAttribute('glyph', 'x')
    remove.append(removeIcon)
    this.listen(remove, 'click', () => this.#removeFile(file.id))
    chip.append(remove)

    return chip
  }

  // ── Commit path — constraint checks (UX only, never the security boundary — cl.2/cl.4.4), then the
  // intake seam, then the value mutation + the ONE `change` event (cl.3). ─────────────────────────────

  async #commitFiles(rawFiles: readonly File[]): Promise<void> {
    if (!this.#isUsable() || rawFiles.length === 0) return
    const intake = this.intake
    if (!intake) return // defensive — #isUsable() already gates this

    const accept = this.accept
    const maxSize = this.maxSizeBytes
    const rejectedReasons: string[] = []
    let candidates = rawFiles.filter((f) => {
      if (accept !== '' && !acceptsFile(accept, f)) {
        rejectedReasons.push(`${f.name} (unsupported type)`)
        return false
      }
      if (maxSize !== null && f.size > maxSize) {
        rejectedReasons.push(`${f.name} (too large)`)
        return false
      }
      return true
    })

    if (!this.multiple) {
      candidates = candidates.slice(0, 1) // a non-multiple gesture always REPLACES (native parity, cl.2)
    } else if (this.maxFiles !== null) {
      const room = Math.max(0, this.maxFiles - this.files.length)
      if (candidates.length > room) {
        rejectedReasons.push(...candidates.slice(room).map((f) => `${f.name} (limit reached)`))
        candidates = candidates.slice(0, room)
      }
    }

    this.#statusOverride.value = rejectedReasons.length > 0 ? `Not added: ${rejectedReasons.join(', ')}` : null
    if (candidates.length === 0) return

    let minted: FileHandleDescriptor[]
    try {
      minted = await intake(candidates, { multiple: this.multiple })
    } catch {
      this.#statusOverride.value = 'File attachment failed. Try again.'
      return
    }
    if (minted.length === 0) return

    this.files = this.multiple ? [...this.files, ...minted] : minted
    this.emit('change') // per COMMITTED mutation only (cl.3) — never a progress tick
  }

  #removeFile(id: string): void {
    const next = this.files.filter((f) => f.id !== id)
    if (next.length === this.files.length) return
    this.files = next
    this.emit('change')
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────────────────────────────

  protected override connected(): void {
    if (!this.#defaultCaptured) {
      this.#defaultFiles = filesType.from(this.getAttribute('files'))
      this.#defaultCaptured = true
    }

    this.internals.role = 'group' // a labeled composite widget (ADR-0085's guarded fielded default reads this)
    this.#ensureAnatomy()

    tabbable(this, { disabled: () => !this.#isUsable() }) // a paste target needs real focusability (cl.1)

    // ADR-0051 — the user-invalid TIMING controller (GH #554: MERGED validity, not formValidity() alone).
    const invalidController = trackUserInvalid(this, { invalid: () => !this.mergedValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) {
        this.internals.states?.add('user-invalid')
        this.internals.ariaInvalid = 'true'
      } else {
        this.internals.states?.delete('user-invalid')
        this.internals.ariaInvalid = null
      }
    })

    // The effective-usable channel — own `disabled`/ancestor fieldset OR no intake seam registered
    // (cl.4.5: visibly disabled, never a silently dead dropzone). :state(disabled) is the fleet's own
    // registered vocabulary member (naming-gates.test.ts §6), reused here rather than minting a new one.
    this.effect(() => {
      const usable = this.#isUsable()
      if (usable) this.internals.states?.delete('disabled')
      else this.internals.states?.add('disabled')
      this.internals.ariaDisabled = usable ? null : 'true'
    })

    // ADR-0085 — the bare-usage accessible-name seam (the base's guarded `applyFieldLabelling` default
    // owns the FIELDED case exclusively, since `internals.role` is set above).
    this.effect(() => {
      if (this.fieldLabelling !== null) return
      this.internals.ariaLabel = this.label || FALLBACK_LABEL
    })

    // The hint line — instruction text, a transient rejection reason, or the unwired-host reason
    // (cl.4.5), in that precedence. Never silent-empty (cl.2).
    this.effect(() => {
      const hint = this.#hint!
      if (this.intake === null) {
        hint.textContent = UNWIRED_REASON
        return
      }
      const override = this.#statusOverride.value
      hint.textContent = override ?? (this.label || FALLBACK_LABEL)
    })

    // The hidden picker input mirrors the CURRENT accept/multiple constraints (a native-parity convenience
    // for the one gesture that routes through it — drag/drop and paste never touch this element at all).
    this.effect(() => {
      const picker = this.#pickerInput!
      if (this.accept !== '') picker.setAttribute('accept', this.accept)
      else picker.removeAttribute('accept')
      picker.multiple = this.multiple
    })

    // Committed-file chips — whole-swap per change (the attachment.ts / stat.ts posture; this list is
    // rarely more than a handful of rows). Re-resolves `isKnown` for every descriptor on every re-run, so
    // a host flipping registry recognition later re-paints correctly.
    this.effect(() => {
      const chipsHost = this.#chipsHost!
      const known = this.isKnown
      chipsHost.replaceChildren(...this.files.map((f) => this.#buildChip(f, known ? known(f.id) : true)))
    })

    // ── Gestures — dropzone (drag/drop), paste target, and the browse-button → hidden-input picker. ────

    this.listen(this, 'dragenter', (event) => {
      event.preventDefault()
      if (this.#isUsable()) this.internals.states?.add('dragging')
    })
    this.listen(this, 'dragover', (event) => {
      event.preventDefault() // required so `drop` fires at all (platform default is to reject)
    })
    this.listen(this, 'dragleave', (event) => {
      const related = (event as DragEvent).relatedTarget
      if (related instanceof Node && this.contains(related)) return // still inside — a child boundary crossing
      this.internals.states?.delete('dragging')
    })
    this.listen(this, 'drop', (event) => {
      event.preventDefault()
      this.internals.states?.delete('dragging')
      if (!this.#isUsable()) return
      const dt = (event as DragEvent).dataTransfer
      void this.#commitFiles(dt ? Array.from(dt.files) : [])
    })
    this.listen(this, 'paste', (event) => {
      if (!this.#isUsable()) return
      const cd = (event as ClipboardEvent).clipboardData
      const pasted = cd ? Array.from(cd.files) : []
      if (pasted.length === 0) return // plain text paste — leave it to the platform default
      event.preventDefault()
      void this.#commitFiles(pasted)
    })
    this.listen(this.#browseBtn!, 'click', () => {
      if (this.#isUsable()) this.#pickerInput!.click()
    })
    this.listen(this.#pickerInput!, 'change', () => {
      const picked = this.#pickerInput!.files ? Array.from(this.#pickerInput!.files) : []
      this.#pickerInput!.value = '' // native-parity: selecting the SAME file again still fires `change`
      void this.#commitFiles(picked)
    })

    // Motion gate (interaction-states standard) — the button.ts/toggle.ts precedent.
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }
}

if (!customElements.get('ui-file-drop')) customElements.define('ui-file-drop', UIFileDropElement)
