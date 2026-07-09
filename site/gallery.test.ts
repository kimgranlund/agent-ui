import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, watch, whenFlushed } from '@agent-ui/components'
import type { UITextFieldElement } from '@agent-ui/components/components'
import { galleryMembers, node, ComponentGallery } from './lib/component-gallery.ts'
import { parseDoc } from './lib/frontmatter.ts'
// Raw-text fs read — the same reverse-coupling fs-read pattern the site drift
// gates use (packages/agent-ui/components/src/descriptor/site-toc.test.ts).
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom reality (established precedent: checkbox.test.ts / indicator-element.test.ts / form.test.ts): the
// ElementInternals form-association surface (setFormValue/setValidity) is ABSENT in jsdom. Those suites stub
// it per-instance (a probe subclass re-exposing `internals`); the gallery connects EVERY fleet member at
// once — including every FACE form control — so the SAME stub is patched once, at the PROTOTYPE, before any
// specimen connects. Additive only (guarded — a no-op if a future jsdom ships the real method).
if (typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
}

// jsdom reality (the overlay.test.ts / toast-region.test.ts precedent): the native Popover API
// (showPopover/hidePopover, `:popover-open`) is absent in jsdom 29. Every other overlay-consuming fleet
// member (tooltip/popover/menu/select/combo-box) stays CLOSED on a bare specimen, so the gallery never
// exercised this gap before — ui-toast-region (ADR-0112) is the first member that opens its own popover
// unconditionally the instant it has ≥1 child, which its own component-preview.ts sample children (feed
// family, LLD-C11) now seed for every connected specimen. Same additive, guarded, prototype-level stub as
// the setFormValue one above — a no-op if a future jsdom ships the real method.
if (typeof (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover !== 'function') {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  proto.showPopover = function (): void {}
  proto.hidePopover = function (): void {}
}

// gallery.test.ts — the jsdom gates for <component-gallery> (LLD-C6, component-gallery.lld.md §8 item 3).
// Companion to gallery.browser.test.ts (the cross-engine whole-shape + theme-axis smoke). Covers: the derived
// member list ≡ the fleet (+ a negative control), filter = order-preserving subsequence, card identity
// survives a filter toggle, the readout tracks without a whole-gallery rebuild, E2's ctx-less mount probe, the
// E4 empty state, and E8 zero-residue disconnect.

const ROOT = process.cwd()
const CONTROLS_DIR = `${ROOT}/packages/agent-ui/components/src/controls`
const read = (p: string): string => readFileSync(p, 'utf8') as string

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Recursively list every file under `dir` (absolute paths); a missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

/** The `ui-*` tags among the shipped `{name}.md` descriptors — an INDEPENDENT fs walk (not galleryMembers'
 *  own import.meta.glob), so this is a real second source, not a tautology. */
function expectedTags(): string[] {
  const tags: string[] = []
  for (const file of walk(CONTROLS_DIR)) {
    if (!file.endsWith('.md')) continue
    let doc
    try {
      doc = parseDoc(read(file))
    } catch {
      continue // a .md with no frontmatter fence is not a descriptor
    }
    const tag = doc.descriptor.scalars.get('tag')
    if (typeof tag === 'string' && tag.startsWith('ui-')) tags.push(tag)
  }
  return tags.sort()
}

describe('galleryMembers — derived from the descriptor glob, never hand-listed', () => {
  it('found real descriptors (anti-vacuous — a broken scan cannot pass silently)', () => {
    expect(expectedTags().length).toBeGreaterThanOrEqual(20)
  })

  it('equals the ALL_DESCRIPTORS ui-*-tag set exactly, alphabetical', () => {
    expect(galleryMembers().map((m) => m.tag)).toEqual(expectedTags())
  })

  it('the equality check BITES: a planted phantom tag fails (negative control)', () => {
    const withPhantom = [...expectedTags(), 'ui-zzfake'].sort()
    expect(galleryMembers().map((m) => m.tag)).not.toEqual(withPhantom)
  })

  it('every member carries a tier and a hasOpen flag derived from its own attributes', () => {
    const button = galleryMembers().find((m) => m.tag === 'ui-button')
    expect(button?.tier).toBe('control')
    expect(button?.hasOpen).toBe(false)
    const modal = galleryMembers().find((m) => m.tag === 'ui-modal')
    expect(modal?.hasOpen).toBe(true) // modal.md declares an `open` attribute (§6 E3)
  })
})

describe('mount(watch(...)) WITHOUT a RenderContext — the ctx-less negative probe (§6 E2)', () => {
  it('leaves the hole empty: no ctx ⇒ the effect never installs ⇒ nothing commits', () => {
    const div = document.createElement('div')
    const dispose = mount(watch(() => 'hello'), div)
    expect(div.textContent).toBe('')
    dispose()
  })
})

describe('node() — hosting a real Element in a child hole', () => {
  it('inserts the element and removes it on dispose', () => {
    const container = document.createElement('div')
    const el = document.createElement('span')
    el.textContent = 'a real element'
    const dispose = mount(node(el), container)
    expect(container.contains(el)).toBe(true)
    dispose()
    expect(container.contains(el)).toBe(false)
  })
})

describe('<component-gallery> — the reactive filter/theme/grid loop', () => {
  let gallery: ComponentGallery

  beforeEach(() => {
    gallery = document.createElement('component-gallery') as ComponentGallery
    document.body.append(gallery)
  })

  afterEach(() => {
    gallery.remove()
  })

  const filterInput = (): UITextFieldElement => gallery.querySelector('.gallery-filter') as UITextFieldElement
  const readout = (): HTMLElement => gallery.querySelector('.gallery-readout') as HTMLElement
  const cardTags = (): string[] => [...gallery.querySelectorAll('.gallery-card')].map((c) => (c as HTMLElement).dataset.tag ?? '')

  // A signal write's dependent re-run is MICROTASK-BATCHED (scheduler.ts), not synchronous — only an effect's
  // very FIRST (eager) run happens inline. So a filter edit must settle through `whenFlushed()` before its
  // effect is read back; `UIElement.updateComplete` (the SAME promise) is the public name for this. The
  // filter is now ui-text-field (type=search), dogfooded in place of a native `<input>` (Kim's directive) —
  // typing into its CONTROL-OWNED editor part (text-field.test.ts's own idiom) is what's real here: the
  // editor's `input` re-emits on the host (text-field.ts:189), which the gallery's OWN listener reads back.
  async function typeFilter(query: string): Promise<void> {
    const editor = filterInput().querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = query
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    await whenFlushed()
  }

  it('renders every fleet member unfiltered, alphabetical', () => {
    expect(cardTags()).toEqual(galleryMembers().map((m) => m.tag))
    expect(readout().textContent).toBe(`${galleryMembers().length} of ${galleryMembers().length}`)
  })

  it('filter = an order-preserving SUBSEQUENCE of the fleet (derived, not hand-picked)', async () => {
    const q = 'a' // a common letter — a real, non-trivial multi-match subsequence (asserted anti-vacuous below)
    const expected = galleryMembers().filter((m) => m.tag.includes(q)).map((m) => m.tag)
    expect(expected.length).toBeGreaterThan(1) // anti-vacuous: a real multi-item subset…
    expect(expected.length).toBeLessThan(galleryMembers().length) // …that is a REAL subset, not everything
    await typeFilter(q)
    expect(cardTags()).toEqual(expected)
    expect(readout().textContent).toBe(`${expected.length} of ${galleryMembers().length}`)
  })

  it('card node identity survives a filter toggle — enter/exit only, the SAME element object returns', async () => {
    const allTags = galleryMembers().map((m) => m.tag)
    const survivor = allTags[0]
    const other = allTags.find((t) => t !== survivor)! // a real, distinct tag — the exit-inducing filter below
    const before = gallery.querySelector(`.gallery-card[data-tag="${survivor}"]`)
    expect(before).not.toBeNull()

    await typeFilter(other) // exit — a real NON-EMPTY filtered subset that excludes the survivor (the steady
    // repeat reconcile, not the E4 empty-state teardown — repeat keeps reconciling the SAME directive instance)
    expect(cardTags().length).toBeGreaterThan(0)
    expect(gallery.querySelector(`.gallery-card[data-tag="${survivor}"]`)).toBeNull()

    await typeFilter('') // re-enter — clear the filter back to the full list
    const after = gallery.querySelector(`.gallery-card[data-tag="${survivor}"]`)
    expect(after).not.toBeNull()
    expect(after).toBe(before) // the SAME element object, not a rebuilt one
  })

  it('the readout tracks a filter change WITHOUT rebuilding the surrounding gallery (no host render effect)', async () => {
    const toolbarBefore = gallery.querySelector('.gallery-toolbar')
    const filterBefore = filterInput()
    const readoutBefore = readout()

    await typeFilter('button')

    expect(readout().textContent).toBe(`${galleryMembers().filter((m) => m.tag.includes('button')).length} of ${galleryMembers().length}`)
    // Only the readout's TEXT changed — the toolbar/filter-input/readout ELEMENTS kept their identity, proving
    // no whole-gallery rebuild occurred (a host render effect re-run would have replaced this subtree).
    expect(gallery.querySelector('.gallery-toolbar')).toBe(toolbarBefore)
    expect(filterInput()).toBe(filterBefore)
    expect(readout()).toBe(readoutBefore)
  })

  it('an empty filter result shows the styled empty-state row, and the readout still reads "0 of N" (§6 E4)', async () => {
    await typeFilter('zzznotarealcomponent')
    expect(cardTags()).toEqual([])
    const empty = gallery.querySelector('.gallery-empty')
    expect(empty).not.toBeNull()
    expect(empty?.getAttribute('role')).toBe('status')
    expect(readout().textContent).toBe(`0 of ${galleryMembers().length}`)
  })

  it('the theme select renders exactly one option ("default") and the attribute lands on the provider (wired seam)', () => {
    const themeLabel = [...gallery.querySelectorAll('.gallery-select')].find((s) => s.textContent?.startsWith('Theme'))
    const select = themeLabel?.querySelector('ui-select') as HTMLElement
    const optionValues = [...select.querySelectorAll('[role="option"]')].map((o) => o.getAttribute('value'))
    expect(optionValues).toEqual(['default'])
    const provider = gallery.querySelector('theme-provider') as HTMLElement
    expect(provider.getAttribute('theme')).toBe('default')
  })

  // jsdom cannot compute an accessible name at all (select.browser.test.ts's own ADR-0085 section header) —
  // this pins the DECLARED wiring only (the `label` attribute reaching each axis select); the REAL
  // accessible-name computation is proven in gallery.browser.test.ts via page.getByRole (both engines).
  it('each axis select carries its own `label` attribute (ADR-0085 — the trigger-naming seam wire)', () => {
    const axes = [
      ['Scheme', 'Scheme'],
      ['Scale', 'Scale'],
      ['Density', 'Density'],
      ['Theme', 'Theme'],
    ] as const
    for (const [prefix, expected] of axes) {
      const wrap = [...gallery.querySelectorAll('.gallery-select')].find((s) => s.textContent?.startsWith(prefix))
      const select = wrap?.querySelector('ui-select') as HTMLElement
      expect(select, `no ui-select found for the "${prefix}" axis`).not.toBeNull()
      expect(select.getAttribute('label'), `"${prefix}" axis select`).toBe(expected)
      expect(select.hasAttribute('aria-label'), `"${prefix}" axis select should not carry the old inert aria-label stopgap`).toBe(false)
    }
  })

  it('disconnect disposes the reactive wiring — zero residue (§6 E8)', async () => {
    const readoutEl = readout()
    const input = filterInput()
    expect(readoutEl.textContent).toBe(`${galleryMembers().length} of ${galleryMembers().length}`) // live pre-disconnect

    gallery.remove() // disconnect: `disconnected()` disposes the stored mount()s — each disposer CLEARS its
    // committed content + removes its anchor (template.ts's mount() contract), so the hole empties immediately.
    expect(readoutEl.textContent).toBe('') // the teardown itself cleared it — the first, mechanical half of E8

    input.value = 'button' // a write on the now-detached input…
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await whenFlushed() // …give the scheduler a real chance to run

    expect(readoutEl.textContent).toBe('') // STILL empty — nothing re-commits it, proving the watch effect is
    // truly dead (unsubscribed from #visible), not merely torn down once and coincidentally quiet
  })
})
