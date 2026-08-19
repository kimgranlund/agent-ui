import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIFileDropElement, type FileHandleDescriptor } from './file-drop.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom probes — ui-file-drop (ADR-0210, GH #1391 — the CONTROL-MINT half). jsdom reality: `dataTransfer`/
// `clipboardData` are not real DataTransfer/DataTransferItemList implementations here — synthetic events
// carry a plain `{ files }` shape attached directly (the same "jsdom lacks X, stub it" posture the
// checkbox.test.ts/multi-select.test.ts precedent takes for ElementInternals.setFormValue/setValidity).
// The REAL whole-shape geometry + real DataTransfer drag/drop + axe-core proofs live in
// file-drop.browser.test.ts (Chromium + WebKit).
//
// Named probes: fd-upgrade · fd-define-guard · fd-files-default · fd-unwired-disabled · fd-intake-commit ·
// fd-picker-commit · fd-drop-commit · fd-paste-commit · fd-multiple-replace · fd-multiple-append ·
// fd-accept-reject · fd-max-size-reject · fd-max-files-reject · fd-remove-change · fd-required-empty ·
// fd-form-value · fd-form-reset · fd-label-bare · fd-label-fielded · fd-unavailable-chip ·
// fd-descriptor-schema · fd-descriptor-bijection · fd-descriptor-negative · fd-geometry-tokens

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

class ProbeFileDrop extends UIFileDropElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity.call(this)
  }
  formResetProbe(): void {
    ;(this as unknown as { formReset(): void }).formReset.call(this)
  }
}
customElements.define('ui-file-drop-probe', ProbeFileDrop)

function makeFileDrop(): { el: ProbeFileDrop } {
  const el = new ProbeFileDrop()
  stubFormAssoc(el.probeInternals)
  document.body.append(el)
  return { el }
}

const oneIntake = (): ((files: readonly File[]) => Promise<FileHandleDescriptor[]>) => {
  let n = 0
  return async (files: readonly File[]) =>
    files.map((f) => ({ id: `id-${n++}`, name: f.name, mimeType: f.type, sizeBytes: f.size }))
}

const file = (name: string, type = 'text/plain', bytes = 10): File => new File([new Uint8Array(bytes)], name, { type })

/** Dispatch a synthetic gesture event carrying a jsdom-safe `{ files }` payload under the real property
 *  name (`dataTransfer`/`clipboardData`) — jsdom has no real DataTransfer/DataTransferItemList. */
function fireWithFiles(el: Element, type: string, prop: 'dataTransfer' | 'clipboardData', files: File[]): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, prop, { value: { files }, configurable: true })
  el.dispatchEvent(event)
}

describe('ui-file-drop — upgrade + definition (fd-upgrade · fd-define-guard)', () => {
  it('fd-upgrade: constructs, connects, and installs typed accessors with declared defaults', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    expect(el.files).toEqual([])
    expect(el.label).toBe('')
    expect(el.accept).toBe('')
    expect(el.multiple).toBe(false)
    expect(el.maxSizeBytes).toBeNull()
    expect(el.maxFiles).toBeNull()
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
    expect(el.intake).toBeNull()
    expect(el.isKnown).toBeNull()
    el.remove()
  })

  it('fd-define-guard: a second customElements.define for the SAME tag throws (idempotent self-define guard proven by construction)', () => {
    expect(customElements.get('ui-file-drop')).toBe(UIFileDropElement)
  })
})

describe('ui-file-drop — the unwired-host state (fd-unwired-disabled, ADR-0210 cl.4.5)', () => {
  it('fd-unwired-disabled: no `intake` ⇒ :state(disabled) + ariaDisabled + a component-owned hint reason', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
    // CustomStateSet is absent in jsdom (capability-gated, the checkbox.test.ts precedent) — the real
    // :state() paint is a browser-leg proof (file-drop.browser.test.ts).
    if (el.probeInternals.states) expect(el.probeInternals.states.has('disabled')).toBe(true)
    expect(el.probeInternals.ariaDisabled).toBe('true')
    const hint = el.querySelector('[data-part="hint"]')!
    expect(hint.textContent).toBe('File attachment is not available here.')
    el.remove()
  })

  it('fd-unwired-disabled: registering `intake` clears the disabled state reactively (no reconnect needed)', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    el.intake = oneIntake()
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('disabled')).toBe(false)
    expect(el.probeInternals.ariaDisabled).toBeNull()
    const hint = el.querySelector('[data-part="hint"]')!
    expect(hint.textContent).toBe('Drop files here, or browse')
    el.remove()
  })
})

describe('ui-file-drop — the commit path (fd-intake-commit · fd-picker-commit · fd-drop-commit · fd-paste-commit)', () => {
  it('fd-intake-commit: a drop mints descriptors via `intake` and lands them in `files` + fires `change`', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    fireWithFiles(el, 'drop', 'dataTransfer', [file('a.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files).toEqual([{ id: 'id-0', name: 'a.txt', mimeType: 'text/plain', sizeBytes: 10 }])
    expect(changeCount).toBe(1)
    el.remove()
  })

  it('fd-picker-commit: the hidden picker input `change` commits exactly like a drop, and resets its own value', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    const picker = el.querySelector<HTMLInputElement>('[data-part="picker"]')!
    Object.defineProperty(picker, 'files', { value: [file('b.txt')], configurable: true })
    picker.dispatchEvent(new Event('change', { bubbles: true }))
    await whenFlushed()
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['b.txt'])
    expect(picker.value).toBe('')
    el.remove()
  })

  it('fd-picker-hidden: the hidden picker input is out of the accessible/tab surface by construction (finding 6)', () => {
    const { el } = makeFileDrop()
    const picker = el.querySelector<HTMLInputElement>('[data-part="picker"]')!
    expect(picker.hidden).toBe(true)
    expect(picker.tabIndex).toBe(-1)
    expect(picker.getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })

  it('fd-drop-commit: dragenter/dragleave toggle :state(dragging); drop clears it', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    el.dispatchEvent(new Event('dragenter', { bubbles: true, cancelable: true }))
    if (el.probeInternals.states) expect(el.probeInternals.states.has('dragging')).toBe(true)
    fireWithFiles(el, 'drop', 'dataTransfer', [file('c.txt')])
    await whenFlushed()
    if (el.probeInternals.states) expect(el.probeInternals.states.has('dragging')).toBe(false)
    el.remove()
  })

  it('fd-paste-commit: a paste carrying files commits; a plain-text paste (no files) is left alone', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'paste', 'clipboardData', [file('d.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['d.txt'])

    const textPaste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(textPaste, 'clipboardData', { value: { files: [] }, configurable: true })
    const prevented = !el.dispatchEvent(textPaste)
    expect(prevented).toBe(false) // never preventDefault()'d — the platform default (plain text paste) stays live
    el.remove()
  })

  it('fd-unwired: a gesture on an UNWIRED control (no intake) commits nothing', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('never.txt')])
    await whenFlushed()
    expect(el.files).toEqual([])
    el.remove()
  })

  it('fd-intake-undefined-return: an intake resolving to undefined lands the visible error path, never an unhandled rejection (finding 3)', async () => {
    const { el } = makeFileDrop()
    el.intake = (async () => undefined) as unknown as (files: readonly File[]) => Promise<FileHandleDescriptor[]>
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('a.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files).toEqual([]) // never crashed on `minted.length`, never landed raw
    const hint = el.querySelector('[data-part="hint"]')!
    expect(hint.textContent).toBe('File attachment failed. Try again.')
    el.remove()
  })

  it('fd-intake-malformed-members: a malformed member in the intake return is DROPPED through `cleanFiles()`, valid ones kept (finding 3)', async () => {
    const { el } = makeFileDrop()
    el.multiple = true
    el.intake = (async (files: readonly File[]) =>
      [
        { id: 'ok-1', name: files[0]!.name, mimeType: 'text/plain', sizeBytes: 10 },
        { id: '', name: 'bad', mimeType: 'text/plain', sizeBytes: 1 }, // empty id — fails isFileHandleDescriptor
        { name: 'no-id', mimeType: 'text/plain', sizeBytes: 1 }, // missing id entirely
      ]) as unknown as (files: readonly File[]) => Promise<FileHandleDescriptor[]>
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('a.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files).toEqual([{ id: 'ok-1', name: 'a.txt', mimeType: 'text/plain', sizeBytes: 10 }])
    el.remove()
  })
})

describe('ui-file-drop — multiple / replace vs append (fd-multiple-replace · fd-multiple-append)', () => {
  it('fd-multiple-replace: multiple=false REPLACES the current file on every gesture (native <input> parity)', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('one.txt')])
    await whenFlushed()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('two.txt'), file('three.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['two.txt']) // replaced, and only the FIRST of the new batch
    el.remove()
  })

  it('fd-multiple-append: multiple=true APPENDS across gestures', async () => {
    const { el } = makeFileDrop()
    el.multiple = true
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('one.txt')])
    await whenFlushed()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('two.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['one.txt', 'two.txt'])
    el.remove()
  })
})

describe('ui-file-drop — constraint rejection is UX-only, with a visible reason (fd-accept-reject · fd-max-size-reject · fd-max-files-reject)', () => {
  it('fd-accept-reject: a non-conforming MIME type is rejected with a visible hint reason, never committed', async () => {
    const { el } = makeFileDrop()
    el.accept = 'image/*'
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('doc.txt', 'text/plain')])
    await whenFlushed()
    expect(el.files).toEqual([])
    const hint = el.querySelector('[data-part="hint"]')!
    expect(hint.textContent).toContain('doc.txt')
    el.remove()
  })

  it('fd-max-size-reject: an over-cap file is rejected, never committed', async () => {
    const { el } = makeFileDrop()
    el.maxSizeBytes = 5
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('big.txt', 'text/plain', 100)])
    await whenFlushed()
    expect(el.files).toEqual([])
    el.remove()
  })

  it('fd-max-files-reject: multiple=true respects maxFiles, truncating the overflow', async () => {
    const { el } = makeFileDrop()
    el.multiple = true
    el.maxFiles = 1
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('a.txt'), file('b.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['a.txt'])
    el.remove()
  })
})

describe('ui-file-drop — remove (fd-remove-change)', () => {
  it('fd-remove-change: clicking a chip\'s remove button drops it from `files` and fires `change`', async () => {
    const { el } = makeFileDrop()
    el.multiple = true
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('keep.txt'), file('drop.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.length).toBe(2)

    let changeCount = 0
    el.addEventListener('change', () => changeCount++)
    const removeBtn = el.querySelectorAll('[data-part="remove"]')[1] as HTMLElement
    removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await whenFlushed()
    expect(el.files.map((f) => f.name)).toEqual(['keep.txt'])
    expect(changeCount).toBe(1)
    el.remove()
  })
})

describe('ui-file-drop — form participation (fd-required-empty · fd-form-value · fd-form-reset)', () => {
  it('fd-required-empty: required + zero files → valueMissing', () => {
    const { el } = makeFileDrop()
    el.required = true
    expect(el.formValidityProbe()).toEqual({
      valid: false,
      flags: { valueMissing: true },
      message: 'Please attach at least one file.',
    })
    el.remove()
  })

  it('fd-form-value: formValue() is a single JSON entry, or null when empty', async () => {
    const { el } = makeFileDrop()
    el.intake = oneIntake()
    await whenFlushed()
    expect(el.formValueProbe()).toBeNull()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('x.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.formValueProbe()).toBe(JSON.stringify(el.files))
    el.remove()
  })

  it('fd-form-reset: restores `files` to the initial attribute value', async () => {
    const seed: FileHandleDescriptor[] = [{ id: 'seed', name: 's.txt', mimeType: 'text/plain', sizeBytes: 1 }]
    const el = new ProbeFileDrop()
    el.setAttribute('files', JSON.stringify(seed))
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    el.multiple = true // append, not replace, so the reset-restores-the-baseline assertion is meaningful
    el.intake = oneIntake()
    await whenFlushed()
    fireWithFiles(el, 'drop', 'dataTransfer', [file('extra.txt')])
    await whenFlushed()
    await whenFlushed()
    expect(el.files.length).toBe(2)
    el.formResetProbe()
    expect(el.files).toEqual(seed)
    el.remove()
  })
})

describe('ui-file-drop — labelling (fd-label-bare · fd-label-fielded)', () => {
  it('fd-label-bare: bare usage sets internals.ariaLabel from `label`, falling back when unset', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBe('Drop files here, or browse')
    el.label = 'Attach your resume'
    await whenFlushed()
    expect(el.probeInternals.ariaLabel).toBe('Attach your resume')
    el.remove()
  })

  it('fd-label-fielded: inside a labelled context the base guarded default owns naming (role is set, so no bare-mode write races it)', async () => {
    const { el } = makeFileDrop()
    await whenFlushed()
    // internals.role is set at connect — the base's guarded applyFieldLabelling default is reachable;
    // this control's own bare-mode effect only writes ariaLabel while fieldLabelling stays null (the
    // multi-select.ts split-ownership discipline this control's header cites).
    expect(el.probeInternals.role).toBe('group')
    el.remove()
  })
})

describe('ui-file-drop — read-direction unavailable chip (fd-unavailable-chip, ADR-0210 cl.3)', () => {
  it('fd-unavailable-chip: an id `isKnown` rejects renders inert, never dropped', async () => {
    const seed: FileHandleDescriptor[] = [{ id: 'ghost', name: 'g.txt', mimeType: 'text/plain', sizeBytes: 1 }]
    const el = new ProbeFileDrop()
    el.setAttribute('files', JSON.stringify(seed))
    stubFormAssoc(el.probeInternals)
    document.body.append(el)
    el.isKnown = () => false
    await whenFlushed()
    expect(el.files).toEqual(seed) // rendered, never dropped
    const chip = el.querySelector('[data-part="chip"]')!
    expect(chip.hasAttribute('data-unavailable')).toBe(true)
    expect(chip.querySelector('[data-part="unavailable-note"]')?.textContent).toBe('Unavailable')
    el.remove()
  })
})

// ── Descriptor trip-wire ─────────────────────────────────────────────────────────────────────────────

const FILE_DROP_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/file-drop`
const md = readFileSync(`${FILE_DROP_DIR}/file-drop.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['name', 'disabled', 'required', 'files', 'label', 'accept', 'multiple', 'maxSizeBytes', 'maxFiles']

describe('file-drop.md descriptor — frontmatter parses + schema-valid (fd-descriptor-schema)', () => {
  it('fd-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-file-drop')
  })

  it('fd-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
  })

  it('fd-descriptor-schema: tag=ui-file-drop, tier=pattern, extends=UIFormElement, formAssociated=true', () => {
    expect(/^tag:\s*ui-file-drop\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('fd-descriptor-schema: records the bindable `files` (json, NOT reflected) + the change event', () => {
    const files = parsed.attributes.find((a) => a.name === 'files')
    expect(files?.type).toBe('json')
    expect(files?.reflect).toBe(false)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('change')
    expect(events).toEqual(['change']) // the ONE mark ADR-0210 cl.3 specifies — no extra events
  })

  it('fd-descriptor-schema: no `size` attribute (ADR-0210 cl.2\'s table has none)', () => {
    expect(parsed.attributes.some((a) => a.name === 'size')).toBe(false)
  })

  it('fd-descriptor-schema: validates with zero structural failures', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    expect(failures).toEqual([])
  })
})

describe('file-drop.md descriptor — contract↔props trip-wire (fd-descriptor-bijection · fd-descriptor-negative)', () => {
  it('fd-descriptor-bijection: attributes[] is a faithful bijection with UIFileDropElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UIFileDropElement.props)).toEqual([])
  })

  it('fd-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'label' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UIFileDropElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.label.reflect' }),
    )
  })

  it('fd-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropAccept: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'accept')
    expect(compareDescriptorToProps(dropAccept, UIFileDropElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.accept' }),
    )
  })

  it('fd-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UIFileDropElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})

// ── Geometry / token trip-wire ───────────────────────────────────────────────────────────────────────

const fileDropCss = readFileSync(`${FILE_DROP_DIR}/file-drop.css`, 'utf8') as string

describe('file-drop.css — geometry/token trip-wire (fd-geometry-tokens)', () => {
  it('fd-geometry-tokens: shell geometry is minted own-chain off the space/font/icon/shape constants (no ad hoc literals)', () => {
    expect(fileDropCss).toMatch(/--ui-file-drop-padding:\s*var\(--md-sys-space-lg\)/)
    expect(fileDropCss).toMatch(/--ui-file-drop-gap:\s*var\(--md-sys-space-md\)/)
    expect(fileDropCss).toMatch(/--ui-file-drop-radius:\s*var\(--md-sys-shape-corner-base\)/)
    expect(fileDropCss).toMatch(/--ui-file-drop-font:\s*var\(--md-sys-font-md\)/)
  })

  it('fd-geometry-tokens: no [size] selector (this control declares no size attribute)', () => {
    // Strip /* ... */ comments first — the file's own header prose mentions "[size]" (documenting its
    // deliberate absence), which is not a real CSS selector (the family-coherence.test.ts precedent).
    const withoutComments = fileDropCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(/\[size\b/)
  })

  it('fd-geometry-tokens: tokens declared in the :where() token block, consumed only in @scope', () => {
    const tokenBlock = fileDropCss.slice(0, fileDropCss.indexOf('@scope (ui-file-drop) {'))
    const scopeBlock = fileDropCss.slice(fileDropCss.indexOf('@scope (ui-file-drop) {'))
    expect(tokenBlock).toMatch(/:where\(ui-file-drop\)\s*\{/)
    expect(scopeBlock).toMatch(/@scope \(ui-file-drop\)\s*\{/)
    // TKT-0066 item 5 — @scope never reads a dimensional :root constant directly.
    expect(scopeBlock).not.toMatch(/var\(--md-sys-space-/)
    expect(scopeBlock).not.toMatch(/var\(--md-sys-font-/)
    expect(scopeBlock).not.toMatch(/var\(--md-sys-shape-corner-base/)
    expect(scopeBlock).not.toMatch(/var\(--ui-space-/)
    expect(scopeBlock).not.toMatch(/var\(--ui-font-/)
    expect(scopeBlock).not.toMatch(/var\(--ui-radius-base/)
  })
})
