import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// gallery.browser.test.ts — the CROSS-ENGINE smoke for <component-gallery> (LLD-C6, component-gallery.lld.md §8
// item 4). Where gallery.test.ts (jsdom) proves the reactive MECHANICS, this proves the RENDERED shape a real
// engine resolves: a card can pass every jsdom assertion and still collapse to 0×0 (the ui-slider-dot precedent,
// "test the whole shape") — that is only provable here, along with the theme axes genuinely repainting and
// forced-colors survival. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts's two playwright instances);
// the forced-colors leg is Chromium-only (CDP `Emulation.setEmulatedMedia`, the button-geometry.browser.test.ts
// precedent) — WebKit exposes no such emulation and is asserted as a genuine (non-forced-colors) baseline.
//
// Side-effect imports — the load-bearing CSS cascade (ADR-0003): foundation roles + dimensional ramp FIRST, the
// per-control sheet, the icon pack (controls render caret/clear/nav glyphs through it), then the gallery itself
// (which self-defines <component-preview>/<theme-provider> in turn).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/icons/phosphor'
import './lib/component-gallery.ts'
import { galleryMembers } from './lib/component-gallery.ts'
import { whenFlushed } from '@agent-ui/components'

// A custom element's connectedCallback builds synchronously, but the reactive grid loop + each specimen's own
// first render settle across a frame — double-rAF before asserting (component-preview.browser.test.ts precedent).
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let root: HTMLElement | undefined
async function mountGallery(): Promise<HTMLElement> {
  root = document.createElement('component-gallery')
  document.body.append(root)
  await raf()
  return root
}
afterEach(() => {
  root?.remove()
  root = undefined
})

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const MEMBERS = galleryMembers()
const NON_OVERLAY = MEMBERS.filter((m) => !m.hasOpen)
const OVERLAY = MEMBERS.filter((m) => m.hasOpen)

const cardFor = (gallery: HTMLElement, tag: string): HTMLElement | null =>
  gallery.querySelector(`.gallery-card[data-tag="${tag}"]`) as HTMLElement | null

/** The live ui-* specimen `<component-preview mode="component">` renders for one card (light DOM, so a plain
 *  descendant-tag query finds it — no shadow root to pierce). */
const liveFor = (card: HTMLElement, tag: string): HTMLElement | null => card.querySelector(tag) as HTMLElement | null

/** The one toolbar `<select>` labelled `label` (scheme/scale/density/theme) — see themeSelect() in component-gallery.ts. */
function selectFor(gallery: HTMLElement, label: string): HTMLSelectElement {
  const wrap = [...gallery.querySelectorAll<HTMLElement>('.gallery-select')].find((s) => s.textContent?.startsWith(label))
  return wrap?.querySelector('select') as HTMLSelectElement
}

async function chooseOption(select: HTMLSelectElement, value: string): Promise<void> {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await whenFlushed() // the theme-provider effect's re-run is microtask-batched (scheduler.ts) — settle it
  await raf() // …then let the engine actually paint the resulting style before reading computed values
}

/** Alpha channel of a computed colour — 0 ⇒ the ink has VANISHED, > 0 ⇒ it is still painted (button-geometry precedent). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1 // a bare system-colour keyword (no rgb() wrapper) is opaque/visible
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Normalize ANY valid CSS colour string to canonical 8-bit rgba() via a 1×1 canvas — engines serialize the
 *  SAME resolved colour differently (WebKit's computed style reports oklch() as oklab(), Chromium keeps
 *  oklch()); the canvas 2D context's colour parser canonicalizes both to the same sRGB buffer, so a
 *  cross-engine / cross-read STRING comparison stays meaningful instead of tripping on notation alone. */
function normalizeColor(color: string): [number, number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b, a]
}

/** Two colours are the SAME rendered colour within a small (±2 per channel) rounding tolerance — the oklch→
 *  sRGB conversion can shift by a unit or two between reads (an engine rounding artefact, not a real repaint);
 *  a real light↔dark flip differs by tens of units, so this tolerance never masks a genuine change. */
function colorsMatch(a: string, b: string): boolean {
  const ca = normalizeColor(a)
  const cb = normalizeColor(b)
  return ca.every((v, i) => Math.abs(v - cb[i]) <= 2)
}

// ── the whole-shape law ─────────────────────────────────────────────────────────────────────────────────────

describe('<component-gallery> — the whole-shape law (both engines)', () => {
  it('every non-overlay member renders its specimen with a non-zero bounding box (derived per member, not sampled)', async () => {
    expect(NON_OVERLAY.length).toBeGreaterThan(0) // anti-vacuous — a real, sizeable member set
    const gallery = await mountGallery()
    for (const m of NON_OVERLAY) {
      const card = cardFor(gallery, m.tag)
      expect(card, `no card rendered for ${m.tag}`).not.toBeNull()
      const preview = card!.querySelector('component-preview') as HTMLElement | null
      expect(preview, `${m.tag}: no <component-preview> in its card`).not.toBeNull()
      const rect = (preview as HTMLElement).getBoundingClientRect()
      expect(rect.width, `${m.tag} specimen collapsed to ~0 width`).toBeGreaterThan(0)
      expect(rect.height, `${m.tag} specimen collapsed to ~0 height`).toBeGreaterThan(0)
    }
  })
})

// ── overlay-class specimens (§6 E3) ─────────────────────────────────────────────────────────────────────────
// hasOpen members (modal/popover/tooltip/menu/select/combo-box) render CLOSED by default — their own honest
// contract. The panel/dialog surface is either a native <dialog> (modal) or a Popover-API [popover] element
// (the rest) — a generic `dialog, [popover]` query finds it regardless of each control's own `data-part` name
// (dialog / listbox / panel), so this stays derived from the shared overlay mechanism, not per-tag special-cased.

describe('<component-gallery> — overlay-class specimens open then paint (§6 E3)', () => {
  it('every hasOpen member: opened via its `open` attribute, the panel/dialog surface paints', async () => {
    expect(OVERLAY.length).toBeGreaterThan(0) // anti-vacuous
    const gallery = await mountGallery()
    for (const m of OVERLAY) {
      const card = cardFor(gallery, m.tag)
      const live = liveFor(card!, m.tag)
      expect(live, `no live ${m.tag} rendered`).not.toBeNull()

      live!.setAttribute('open', '')
      await raf()

      const panel = live!.querySelector('dialog, [popover]') as HTMLElement | null
      expect(panel, `${m.tag}: no dialog/[popover] surface found after opening`).not.toBeNull()
      const rect = (panel as HTMLElement).getBoundingClientRect()
      expect(rect.width * rect.height, `${m.tag} panel painted with a zero-area box`).toBeGreaterThan(0)

      live!.removeAttribute('open') // courtesy close — each member is independent, not asserted
      await raf()
    }
  })
})

// ── the ONE theme provider — scale/density/scheme (anti-vacuous both directions) ───────────────────────────

describe('<component-gallery> — the ONE <theme-provider> drives every specimen (both engines)', () => {
  it('scale change resizes a specimen, density change re-spaces it, and BOTH revert to their default', async () => {
    const gallery = await mountGallery()
    const card = cardFor(gallery, 'ui-button')
    const live = liveFor(card!, 'ui-button') as HTMLElement
    expect(live, 'no live ui-button rendered').not.toBeNull()

    const heightMd = Number.parseFloat(getComputedStyle(live).blockSize)
    expect(heightMd).toBeGreaterThan(0)

    await chooseOption(selectFor(gallery, 'Scale'), 'ui-lg')
    const heightLg = Number.parseFloat(getComputedStyle(live).blockSize)
    expect(heightLg, '[scale=ui-lg] did not change the specimen height').not.toBeCloseTo(heightMd, 0)

    await chooseOption(selectFor(gallery, 'Scale'), 'ui-md') // back to the default
    expect(Number.parseFloat(getComputedStyle(live).blockSize)).toBeCloseTo(heightMd, 0)

    // Density rides the RHYTHM only (--ui-density), never the frame — a bare (icon-less) button's own height/
    // padding is density-INVARIANT by design (button-geometry.browser.test.ts's law), so the specimen's --ui-
    // density CUSTOM PROPERTY itself (dimensions.css's [density] table: comfortable=1, spacious=1.5) is the
    // real, generic proof every specimen inherits, regardless of which of its own rendered properties consume it.
    const densityValue = (): string => getComputedStyle(live).getPropertyValue('--ui-density').trim()
    expect(densityValue()).toBe('1') // the default (comfortable)

    await chooseOption(selectFor(gallery, 'Density'), 'spacious')
    expect(densityValue(), '[density=spacious] did not repoint --ui-density').toBe('1.5')

    await chooseOption(selectFor(gallery, 'Density'), 'comfortable') // back to the default
    expect(densityValue()).toBe('1')
  })

  it('scheme flips a specimen\'s used colour, and reverts to the light default (anti-vacuous both ways)', async () => {
    const gallery = await mountGallery()
    const card = cardFor(gallery, 'ui-button')
    // The card's OWN component-preview chrome (`.preview`, a NEUTRAL --md-sys-color-neutral-surface-low
    // background) is the reliable scheme-sensitive target — a solid button's own fill is a stable BRAND
    // accent that barely shifts between schemes by design (verified: its lightness moves <1%), so it would
    // falsely read as scheme-invariant. The neutral surface role is what genuinely inverts light↔dark.
    const surface = card!.querySelector('.preview') as HTMLElement

    const bgLight = getComputedStyle(surface).backgroundColor
    expect(alphaOf(bgLight)).toBeGreaterThan(0) // visible to start with

    await chooseOption(selectFor(gallery, 'Scheme'), 'dark')
    const bgDark = getComputedStyle(surface).backgroundColor
    expect(colorsMatch(bgDark, bgLight), 'dark scheme did not change the specimen\'s used surface colour').toBe(false)

    await chooseOption(selectFor(gallery, 'Scheme'), 'light') // back to the default
    expect(colorsMatch(getComputedStyle(surface).backgroundColor, bgLight)).toBe(true)
  })

  it('the theme select renders exactly one option ("default") and the attribute lands on the provider subtree', async () => {
    const gallery = await mountGallery()
    const select = selectFor(gallery, 'Theme')
    expect([...select.options].map((o) => o.value)).toEqual(['default'])
    const provider = gallery.querySelector('theme-provider') as HTMLElement
    expect(provider.getAttribute('theme')).toBe('default')
  })
})

// ── forced-colors (§6 E7, Chromium) ─────────────────────────────────────────────────────────────────────────

describe('<component-gallery> — forced-colors keeps chrome + a specimen sample visible (E7)', () => {
  it('gallery chrome and a sample specimen keep visible ink under forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const gallery = await mountGallery()
    const filterInput = gallery.querySelector('.gallery-filter') as HTMLElement
    const card = cardFor(gallery, 'ui-button')
    const live = liveFor(card!, 'ui-button') as HTMLElement

    const baseChromeInk = alphaOf(getComputedStyle(filterInput).color)
    const baseSpecimenInk = alphaOf(getComputedStyle(live).color)
    expect(baseChromeInk, 'gallery chrome ink should be visible in normal mode').toBeGreaterThan(0)
    expect(baseSpecimenInk, 'specimen ink should be visible in normal mode').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP/forced-colors emulation — the documented cross-engine split (tabs precedent).
      // Assert the engine is genuinely NOT in forced-colors (not silently faking the Chromium proof) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true) // anti-vacuous: really emulating
      expect(alphaOf(getComputedStyle(filterInput).color), 'gallery chrome ink vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(live).color), 'specimen ink vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset the emulation
    }
  })
})
