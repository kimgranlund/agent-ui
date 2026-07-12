// command-palette.test.ts — jsdom coverage for site/lib/command-palette.ts (TKT-0018, site-command-search.lld.md
// LLD-C6…C10): the render/grouping/merge logic, and the `select` -> `location.href` wiring itself. `fetch` is
// stubbed (the feed-live-transport.test.ts precedent — no real network); jsdom is deliberately the engine for
// the `location.href` assertion specifically because jsdom's Location mutation is inert (no real page load), so
// the actual navigation LINE is exercised safely here — a live cross-engine browser session cannot safely let
// a real MPA `location.href` assignment run to completion without tearing down that test's own browsing
// context, so command-palette.browser.test.ts instead captures the `select` event's `detail.value` directly
// (an equivalent proof, short of watching a real cross-document navigation complete — named there).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/components' // registers ui-command-modal (+ its nested ui-modal) for real
import type { mountCommandPalette as MountCommandPalette } from './command-palette.ts'

// ── the native-dialog stub (jsdom lacks the whole modal surface) — copied verbatim from command-modal.test.ts's
// own stub (packages/agent-ui/components/src/controls/command-modal/command-modal.test.ts): the SPEC-R10 AC3
// leg below actually opens the real nested ui-modal (`current.open = true`), which calls the native
// `dialog.showModal()` jsdom does not implement.
const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (typeof proto.showModal === 'function') return // a real engine — leave the platform alone
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement): boolean {
      return dialogOpen.get(this) ?? false
    },
    set(this: HTMLDialogElement, v: boolean): void {
      dialogOpen.set(this, Boolean(v))
    },
  })
  proto.showModal = function (this: HTMLDialogElement): void {
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    if (!(dialogOpen.get(this) ?? false)) return
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
})

/** Mirror a platform-initiated close of the NESTED modal's dialog (Escape/backdrop/external) — the SAME helper
 *  shape as command-modal.test.ts's `simulatePlatformClose`, so command-palette.ts's own `close` listener fires
 *  through the REAL relay (command-modal.ts's `modal 'close' -> this.open=false; this.emit('close')`), not a
 *  hand-fabricated event on the outer element that would bypass that relay entirely. */
function simulatePlatformClose(dialog: HTMLDialogElement): void {
  ;(dialog as unknown as { open: boolean }).open = false
  dialog.dispatchEvent(new Event('close'))
}

interface SitemapEntry {
  name: string
  tag?: string
  url: string
  description: string
  level: 'L1' | 'L2' | 'L3'
  section: string
  index?: string
}

const L1: SitemapEntry = { name: 'Button', tag: 'ui-button', url: './button-doc.html', description: 'A pressable control.', level: 'L1', section: 'Components' }
const L2: SitemapEntry = { name: 'Theming', url: './theming.html', description: 'One theming subtree.', level: 'L2', section: 'Guides' }
const L3_STUB: SitemapEntry = { name: 'Decision Records', url: './adr-index.html', description: 'Every ADR.', level: 'L3', section: 'Records', index: './adr-index.json' }
const L3_STUB_2: SitemapEntry = { name: 'Changelog', url: './changelog.html', description: 'Milestones.', level: 'L3', section: 'Records', index: './changelog-index.json' }
const SITEMAP = { entries: [L1, L2, L3_STUB] }
const SITEMAP_TWO_STUBS = { entries: [L1, L2, L3_STUB, L3_STUB_2] }
const ADR_RECORDS: SitemapEntry[] = [{ name: 'ADR-0001', url: './adr-index.html#adr-0001', description: 'The first decision.', level: 'L3', section: 'Records' }]
const CHANGELOG_RECORDS: SitemapEntry[] = [{ name: 'v1', url: './changelog.html#v1', description: 'The first milestone.', level: 'L3', section: 'Records' }]

function stubFetch(routes: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url in routes) return new Response(JSON.stringify(routes[url]), { status: 200 })
      return new Response('not found', { status: 404 })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelectorAll('ui-command-modal').forEach((el) => el.remove())
})

/**
 * freshMount — command-palette.ts holds "one palette per page" as MODULE-level state (`current`/`liveEntries`,
 * by design: it is genuinely per-page-load state, not per-call). Vitest shares one module instance across every
 * `it()` in a file, so a second test's `mountCommandPalette()` would otherwise silently no-op against the FIRST
 * test's mount. `vi.resetModules()` + a fresh dynamic import gives each test its OWN module instance (its own
 * `current`/`liveEntries` closures), so tests stay independent without adding a test-only reset export to the
 * production module.
 */
async function freshMount(): Promise<typeof MountCommandPalette> {
  vi.resetModules()
  const mod = await import('./command-palette.ts')
  return mod.mountCommandPalette
}

describe('mountCommandPalette — render + grouping', () => {
  it('renders one [role=group] per non-empty level, in L1->L2->L3 order, each option carrying value + data-keywords', async () => {
    stubFetch({ './sitemap.json': SITEMAP })
    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    const palette = document.querySelector('ui-command-modal')!
    const groups = [...palette.querySelectorAll('[role=group]')]
    expect(groups.length).toBe(3)
    const labels = groups.map((g) => g.querySelector('[data-role=group-label]')?.textContent)
    expect(labels).toEqual(['Components', 'Guides', 'Records'])

    // The tag leads (not the display name) — load-bearing for SPEC-R7 AC1's anchored-regex example; see
    // buildOption's own doc comment for why data-keywords alone cannot make `^ui-…` match. TKT-0019 — the
    // title (labelText-visible, a plain text node) and the description (a separate [data-role=description]
    // line, excluded from labelText) are asserted SEPARATELY now, not as one flattened textContent string.
    const buttonOption = palette.querySelector('[role=option][value="./button-doc.html"]')!
    expect(buttonOption.childNodes[0]?.textContent).toBe('ui-button (Button)')
    expect(buttonOption.querySelector('[data-role=description]')?.textContent).toBe('A pressable control.')
    expect((buttonOption as HTMLElement).dataset.keywords).toBe('ui-button A pressable control.')

    const guideOption = palette.querySelector('[role=option][value="./theming.html"]')!
    expect(guideOption.childNodes[0]?.textContent).toBe('Theming') // no tag => no "(tag)" segment
    expect(guideOption.querySelector('[data-role=description]')?.textContent).toBe('One theming subtree.')
  })

  it('mounts the hotkey + regex filter + accessible label on the created instance', async () => {
    stubFetch({ './sitemap.json': SITEMAP })
    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    const palette = document.querySelector('ui-command-modal')!
    expect(palette.getAttribute('hotkey')).toBe('mod+k')
    expect(palette.getAttribute('filter')).toBe('regex')
    expect(palette.getAttribute('label')).toBe('Search agent-ui')
  })

  it('one palette per page: a second call while one is already mounted is a no-op', async () => {
    stubFetch({ './sitemap.json': SITEMAP })
    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    await mountCommandPalette()
    expect(document.querySelectorAll('ui-command-modal').length).toBe(1)
  })
})

describe('mountCommandPalette — select navigates via location.href (SPEC-R9 AC1)', () => {
  it('choosing an option sets location.href to that entry\'s url; no @agent-ui/router import exists in this module', async () => {
    // jsdom's real `Location` deliberately refuses cross-document navigation (logs "Not implemented:
    // navigation to another Document" and leaves `location.href` unchanged) AND its `href` accessor is
    // non-configurable (cannot be `vi.spyOn`-wrapped in place) — the same reason command-palette.browser.test.ts
    // cannot let a REAL engine's navigation run to completion either (it would tear down that test's own
    // browsing context). `vi.stubGlobal('location', …)` sidesteps both: it replaces WHAT `globalThis.location`
    // POINTS TO for this test only (the same tool this file already uses for `fetch`), so the module's bare
    // `location.href = …` assignment lands on a plain, fully-inspectable mock object instead.
    stubFetch({ './sitemap.json': SITEMAP })
    vi.stubGlobal('location', { href: 'http://localhost:3000/' })
    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    const palette = document.querySelector('ui-command-modal')!
    palette.dispatchEvent(new CustomEvent('select', { detail: { value: './button-doc.html', label: 'Button', group: 'Components' } }))
    expect(location.href).toBe('./button-doc.html')
  })
})

describe('mountCommandPalette — L3 lazy merge (SPEC-R10)', () => {
  it('resolving while CLOSED replaces the element with the merged option set', async () => {
    stubFetch({ './sitemap.json': SITEMAP, './adr-index.json': ADR_RECORDS })
    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    // Let the background L3 fetch's microtask chain settle.
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    const palettes = document.querySelectorAll('ui-command-modal')
    expect(palettes.length).toBe(1) // swapped in place, not duplicated
    const merged = palettes[0].querySelector('[role=option][value="./adr-index.html#adr-0001"]')
    expect(merged, 'the resolved ADR record should be a real rendered option').not.toBeNull()
    const stubStillThere = palettes[0].querySelector('[role=option][value="./adr-index.html"]')
    expect(stubStillThere, 'the loader-stub entry should be REPLACED, not left alongside the real records').toBeNull()
  })

  it('resolving while OPEN defers the swap to the next close; BOTH corpora resolving while open re-entrantly merge without clobbering each other (SPEC-R10 AC3)', async () => {
    // Manually-resolvable promises for the two L3 index fetches — gives this test exact control over WHEN each
    // one settles relative to `current.open`, so "both resolve while open" is a guaranteed ordering, not a race.
    let resolveAdr!: (records: SitemapEntry[]) => void
    let resolveChangelog!: (records: SitemapEntry[]) => void
    const adrRecords = new Promise<SitemapEntry[]>((r) => { resolveAdr = r })
    const changelogRecords = new Promise<SitemapEntry[]>((r) => { resolveChangelog = r })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === './sitemap.json') return new Response(JSON.stringify(SITEMAP_TWO_STUBS), { status: 200 })
        if (url === './adr-index.json') return { json: async () => adrRecords } as Response
        if (url === './changelog-index.json') return { json: async () => changelogRecords } as Response
        return new Response('not found', { status: 404 })
      }),
    )

    const mountCommandPalette = await freshMount()
    await mountCommandPalette()
    const palette = document.querySelector('ui-command-modal') as HTMLElement & { open: boolean }
    palette.open = true // OPEN before either L3 fetch resolves — the REAL nested ui-modal actually shows
    await whenFlushed()
    const dialog = palette.querySelector('[data-part="dialog"]') as HTMLDialogElement
    expect(dialog, 'expected the nested ui-modal to have created its dialog part').not.toBeNull()
    expect(dialog.open, 'the real nested dialog should be open').toBe(true)

    // Resolve BOTH corpora while the palette is open.
    resolveAdr(ADR_RECORDS)
    resolveChangelog(CHANGELOG_RECORDS)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    // No swap yet — the SAME instance, still carrying both stubs, no merged record present.
    expect(document.querySelectorAll('ui-command-modal').length).toBe(1)
    expect(document.querySelector('ui-command-modal')).toBe(palette)
    expect(palette.querySelector('[role=option][value="./adr-index.html#adr-0001"]'), 'no premature ADR merge while open').toBeNull()
    expect(palette.querySelector('[role=option][value="./changelog.html#v1"]'), 'no premature changelog merge while open').toBeNull()
    expect(palette.querySelector('[role=option][value="./adr-index.html"]'), 'the ADR stub should still be present pre-close').not.toBeNull()
    expect(palette.querySelector('[role=option][value="./changelog.html"]'), 'the changelog stub should still be present pre-close').not.toBeNull()

    // Close via a REAL platform dismissal (the nested dialog's own 'close' event) — command-modal.ts's own
    // relay sets `this.open = false` and re-emits `close` on the OUTER element, which is what
    // command-palette.ts's `applyMerge` listens for. Both deferred merges fire now, each re-deriving against
    // whatever the other already landed (applyMerge's own re-entrancy).
    simulatePlatformClose(dialog)
    expect(palette.open, 'the platform dismissal should sync open back to false').toBe(false)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const final = document.querySelector('ui-command-modal')!
    expect(final.querySelector('[role=option][value="./adr-index.html#adr-0001"]'), 'the ADR record should now be merged in').not.toBeNull()
    expect(final.querySelector('[role=option][value="./changelog.html#v1"]'), 'the changelog record should ALSO be merged in — neither corpus clobbered the other').not.toBeNull()
    expect(final.querySelector('[role=option][value="./adr-index.html"]'), 'the ADR stub should be replaced, not left alongside the real record').toBeNull()
    expect(final.querySelector('[role=option][value="./changelog.html"]'), 'the changelog stub should be replaced too').toBeNull()
  })
})
