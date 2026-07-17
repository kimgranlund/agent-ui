import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, page } from 'vitest/browser'

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
// (which self-defines <component-preview>/<ui-theme-provider> in turn).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/icons/phosphor'
import './lib/component-gallery.ts'
import { galleryMembers } from './lib/component-gallery.ts'
import { whenFlushed } from '@agent-ui/components'
import type { UISelectElement } from '@agent-ui/components/components'

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
 *  descendant query finds it — no shadow root to pierce). Scoped to `.canvas-surface`: the preview's knob
 *  column now dogfoods ui-* controls (ui-select/ui-checkbox/ui-text-field), so a bare tag query would match a
 *  same-tag KNOB (e.g. the ui-select card's own `size` knob) ahead of the specimen. */
const liveFor = (card: HTMLElement, tag: string): HTMLElement | null =>
  card.querySelector(`.canvas-surface ${tag}`) as HTMLElement | null

/** The one toolbar `ui-select` labelled `label` (scheme/scale/density/theme) — see themeSelect() in
 *  component-gallery.ts. Dogfooded off the fleet's own control (Kim's directive), not a native `<select>`. */
function selectFor(gallery: HTMLElement, label: string): UISelectElement {
  const wrap = [...gallery.querySelectorAll<HTMLElement>('.gallery-select')].find((s) => s.textContent?.startsWith(label))
  return wrap?.querySelector('ui-select') as UISelectElement
}

/** The REAL commit path, not a synthetic model write: open the panel (ADR-0019 two-way `open`, the same
 *  idiom the overlay-class test below uses), click the matching `[role=option]` — selectionCommit's own
 *  delegated host click-listener (select.ts) drives `value` + emits `select` + auto-closes the panel. */
async function chooseOption(select: UISelectElement, value: string): Promise<void> {
  select.setAttribute('open', '')
  await raf()
  const option = select.querySelector(`[role="option"][value="${value}"]`) as HTMLElement
  option.click()
  await whenFlushed() // the ui-theme-provider effect's re-run is microtask-batched (scheduler.ts) — settle it
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

describe('<component-gallery> — the ONE <ui-theme-provider> drives every specimen (both engines)', () => {
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

    // Density rides the RHYTHM only (--md-sys-density), never the frame — a bare (icon-less) button's own height/
    // padding is density-INVARIANT by design (button-geometry.browser.test.ts's law), so the specimen's --ui-
    // density CUSTOM PROPERTY itself (dimensions.css's [density] table: comfortable=1, spacious=1.5) is the
    // real, generic proof every specimen inherits, regardless of which of its own rendered properties consume it.
    const densityValue = (): string => getComputedStyle(live).getPropertyValue('--md-sys-density').trim()
    expect(densityValue()).toBe('1') // the default (comfortable)

    await chooseOption(selectFor(gallery, 'Density'), 'spacious')
    expect(densityValue(), '[density=spacious] did not repoint --md-sys-density').toBe('1.5')

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
    const optionValues = [...select.querySelectorAll('[role="option"]')].map((o) => o.getAttribute('value'))
    expect(optionValues).toEqual(['default'])
    const provider = gallery.querySelector('ui-theme-provider') as HTMLElement
    expect(provider.getAttribute('theme')).toBe('default')
  })
})

// ── the toolbar's axis selects are properly named (ADR-0085, both engines) ────────────────────────────────
// Was a documented GAP (the host `aria-label` stopgap was inert — the trigger named itself from its
// selected-value content alone); now a positive regression gate. `page.getByRole` is vitest-browser's own
// accessible-name query (select.browser.test.ts's own ADR-0085 precedent) — it resolves the REAL computed
// name in both engines, which jsdom cannot do at all (gallery.test.ts only pins the declared `label` wire).

describe('<component-gallery> — the toolbar axis selects compute a real accessible name (ADR-0085)', () => {
  it('each axis select\'s trigger is named "<axis> <value>", live on first paint', async () => {
    const gallery = await mountGallery()
    const expectations: ReadonlyArray<[string, string]> = [
      ['Scheme', 'Scheme light'],
      ['Scale', 'Scale ui-md'],
      ['Density', 'Density comfortable'],
      ['Theme', 'Theme default'],
    ]
    for (const [axis, name] of expectations) {
      const select = selectFor(gallery, axis)
      expect(select, `no ui-select found for the "${axis}" axis`).not.toBeNull()
      const named = page.getByRole('button', { name, exact: true }).query()
      expect(named, `${server.browser}: no button named "${name}" — the "${axis}" axis select's aria-labelledby did not land`).not.toBeNull()
    }
  })

  it('the accessible name recomputes live when the selection changes (Scheme: light → dark)', async () => {
    const gallery = await mountGallery()
    const scheme = selectFor(gallery, 'Scheme')

    expect(page.getByRole('button', { name: 'Scheme light', exact: true }).query()).not.toBeNull()

    await chooseOption(scheme, 'dark')
    expect(
      page.getByRole('button', { name: 'Scheme dark', exact: true }).query(),
      `${server.browser}: the accessible name did not recompute after choosing "dark"`,
    ).not.toBeNull()
    expect(page.getByRole('button', { name: 'Scheme light', exact: true }).query()).toBeNull() // the stale name is gone

    await chooseOption(scheme, 'light') // back to the default, courtesy reset
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

// ── the scheme-boundary ink re-root (the light-card-in-dark-root bug, both engines) ─────────────────────────
// Regression for the reported "white text on a light card" defect. A <ui-theme-provider scheme=light> nested in a
// DARK root re-roots `color-scheme`, but that alone does NOT re-resolve a scheme-dependent INHERITED `color`:
// `light-dark()` only re-resolves where a property CONTAINING it is declared. A bare-`textContent` specimen (the
// a2ui Card's `ui-card-header`, and the ui-row/list/grid items) declares no `color`, so WITHOUT the boundary
// re-root it inherits the ink computed ONCE at the dark root (WHITE) → invisible on the now-light card surface.
// component-gallery.css re-declares `color` on `ui-theme-provider` to fix it. A plain `color-scheme:dark` on the root
// forces the dark-root case in BOTH engines (color-scheme is inherited; light-dark resolves against the local one).

describe('<component-gallery> — the ui-theme-provider re-roots inherited ink at the scheme boundary (both engines)', () => {
  it('a light provider under a dark root gives its bare-text specimens DARK ink, not the root\'s frozen white', async () => {
    // Reproduce the site's real root: a DARK color-scheme + a scheme-dependent body ink (_page.css sets body
    // `color: --md-sys-color-neutral-on-surface`, WHITE under the dark root — the frozen value the bug inherits).
    const rootEl = document.documentElement
    const priorScheme = rootEl.style.colorScheme
    const priorBodyColor = document.body.style.color
    try {
      rootEl.style.colorScheme = 'dark'
      document.body.style.color = 'var(--md-sys-color-neutral-on-surface)'
      const gallery = await mountGallery() // default scheme = LIGHT — the provider forces light under the dark root
      const provider = gallery.querySelector('ui-theme-provider') as HTMLElement
      expect(provider.getAttribute('scheme')).toBe('light') // anti-vacuous: genuinely the light-in-dark case

      const bodyInk = getComputedStyle(document.body).color // frozen WHITE (light-dark → dark branch at the root)
      const providerInk = getComputedStyle(provider).color // re-rooted DARK (light branch at the provider) — the fix
      // The boundary MOVED the inherited ink off the root's frozen white; without the re-root these would MATCH
      // (the provider would inherit body white) and the light-in-dark card would render white-on-light.
      expect(
        colorsMatch(providerInk, bodyInk),
        'the provider did NOT re-root the inherited ink — a light-in-dark card would show white text',
      ).toBe(false)

      // The reported symptom: the a2ui Card's bare-`textContent` header inherits the boundary-re-rooted ink.
      const cardEl = liveFor(cardFor(gallery, 'ui-card')!, 'ui-card') as HTMLElement
      expect(cardEl, 'no live ui-card specimen rendered').not.toBeNull()
      const heading = cardEl.querySelector('ui-card-header') as HTMLElement
      expect(heading?.textContent, 'the ui-card header is not the expected bare-text specimen').toContain('Account')
      const headingInk = getComputedStyle(heading).color
      expect(
        colorsMatch(headingInk, providerInk),
        'the card heading did not inherit the boundary-re-rooted ink',
      ).toBe(true)

      // …and that ink is genuinely DARK (readable on the light card), not merely "different from white".
      const [r, g, b] = normalizeColor(headingInk)
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      expect(luminance, 'the card heading ink is not dark — it would be unreadable on the light surface').toBeLessThan(0.4)
    } finally {
      rootEl.style.colorScheme = priorScheme
      document.body.style.color = priorBodyColor
    }
  })
})
