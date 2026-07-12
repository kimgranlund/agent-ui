// command-palette.browser.test.ts — the cross-engine truth for site/lib/command-palette.ts (TKT-0018,
// site-command-search.lld.md §8's "open->type->select" leg). Real engines are where the control's own
// combobox/listbox keyboard model, @scope CSS, and the real regex-vs-substring filter behavior are actually
// true — jsdom cannot prove any of that. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts's `site`
// project).
//
// DELIBERATELY does not let a real `location.href` MPA assignment run to completion: doing so would navigate
// this test's own browsing context away mid-suite (a real cross-document load, not a `history.pushState`), an
// unrecoverable action for an automated run. Instead this file captures the `select` event's own `detail.value`
// directly — the SAME value command-palette.ts's one-line handler passes straight into `location.href = …` — a
// literal equality proof of the navigation TARGET, short of watching a real page unload/reload complete.
// command-palette.test.ts (jsdom) covers the actual `location.href` mutation itself, where jsdom's inert
// Location object makes that safe to observe (via `vi.stubGlobal('location', …)`, since jsdom's real Location
// can neither navigate nor be spied on in place).
//
// ONE test, ONE mount: command-palette.ts's "one palette per page" guard is real per-page-load module state,
// and this file drives every scenario as sequential STEPS against that single mounted instance instead of
// remounting per assertion — sidestepping any question of whether `vi.resetModules()` yields a genuinely fresh
// module instance under the real-browser runner the way it does under jsdom (command-palette.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css' // foundation tokens + dimensional ramp (FIRST — geometry source)
import '@agent-ui/components/component-styles.css' // per-control CSS, so the mounted palette has real geometry
import '@agent-ui/components/components' // registers ui-command-modal (+ nested ui-modal) for real
import { mountCommandPalette } from './command-palette.ts'

interface SitemapEntry {
  name: string
  tag?: string
  url: string
  description: string
  level: 'L1' | 'L2' | 'L3'
  section: string
  index?: string
}

const ENTRIES: SitemapEntry[] = [
  { name: 'Button', tag: 'ui-button', url: './button-doc.html', description: 'A pressable control.', level: 'L1', section: 'Components' },
  { name: 'Swiper', tag: 'ui-swiper', url: './swiper-doc.html', description: 'The scroll-snap carousel coordinator.', level: 'L1', section: 'Components' },
  { name: 'Swiper Item', tag: 'ui-swiper-item', url: './swiper-item-doc.html', description: 'One slide.', level: 'L1', section: 'Components' },
  { name: 'Swiper Paddles', tag: 'ui-swiper-paddles', url: './swiper-paddles-doc.html', description: 'Prev/next anchors.', level: 'L1', section: 'Components' },
  { name: 'Theming', url: './theming.html', description: 'One theming subtree.', level: 'L2', section: 'Guides' },
]
const SITEMAP = { entries: ENTRIES }

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

// `vi.stubGlobal('fetch', …)` MUST be scoped per-test with a matching `afterEach` unstub — a bare module-level
// stub left in place bled into vitest-browser's OWN orchestrator protocol (which itself runs over `fetch`) and
// cascaded failures across unrelated test files sharing the same worker/session (measured: 17 unrelated files
// failed with "Unknown event: response:response:…" once this was left unstubbed). Stubbing inside the test and
// unstubbing in `afterEach` keeps the interception scoped to this file's own single test.
function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === './sitemap.json') return new Response(JSON.stringify(SITEMAP), { status: 200 })
      return new Response('[]', { status: 200 }) // the two L3 stubs resolve to an empty corpus — irrelevant here
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelectorAll('ui-command-modal').forEach((el) => el.remove())
})

// command-palette.ts's OWN select listener (registered at mount time, inside createPalette) fires before any
// listener this test adds afterward — event listeners run in registration order — so there is no way to
// intercept and stop the real `location.href = …` assignment from a listener added on the SAME target
// afterward. Left unguarded, it navigates this test's own iframe away for real (measured: "Cannot connect to
// the iframe …"). Two workarounds tried and REJECTED, both measured:
//   - a `beforeunload` `preventDefault()` does NOT block it — that confirmation gate is specifically for
//     USER-initiated navigation, and Playwright's `userEvent.keyboard` dispatches trusted OS-level key events
//     the browser counts as a user gesture, so the pending navigation proceeds regardless.
//   - `vi.stubGlobal('location', …)` (jsdom's own safe technique, command-palette.test.ts) throws
//     "Cannot redefine property: location" / "unconfigurable property" in REAL Chromium/WebKit — unlike
//     jsdom, real engines mark `window.location` `[Unforgeable]` per the HTML spec, so it cannot be swapped.
// The actual fix: `select` bubbles+composes (element.ts's `emit` — `{ bubbles: true, composed: true }`), so a
// CAPTURING listener on `document` fires during the capture phase, BEFORE the palette's own at-target listener
// — `stopImmediatePropagation()` there blocks the real handler from ever running, while still handing this
// test the event's own `detail.value` (the SAME value command-palette.ts's internal handler would have passed
// straight into `location.href = …`).

describe('command-palette — real open -> type -> select (both engines)', () => {
  it('mod+k opens; groups render L1 above L2; a valid regex narrows and Enter selects; an invalid pattern falls back to substring without crashing', async () => {
    stubFetch()
    await mountCommandPalette()
    await raf()
    const palette = document.querySelector('ui-command-modal') as HTMLElement & { open: boolean }
    expect(palette, 'expected the palette to mount from the stubbed sitemap.json').not.toBeNull()
    expect(palette.open).toBe(false)

    // Step 1 — a real keydown chord (the control's own shipped hotkey listener, ADR-0125 F2), not a synthetic open.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }))
    await raf()
    expect(palette.open).toBe(true)

    // Step 2 — groups render L1 (Components) above L2 (Guides); no L3 entries in this fixture, so no Records group.
    const labels = [...palette.querySelectorAll('[data-role=group-label]')].map((h) => h.textContent)
    expect(labels).toEqual(['Components', 'Guides'])

    // Step 3 — SPEC-R7 AC1's own illustrative example: an ANCHORED regex (`^ui-swiper`) narrows to exactly the
    // swiper family (3 entries), excluding `ui-button`. This requires the rendered label ITSELF to start with
    // the tag (buildOption's own doc comment: an anchor can never reach into data-keywords, since the control's
    // haystack is `labelText + ' ' + data-keywords` — labelText always first).
    const search = palette.querySelector('[data-part="search"]') as HTMLElement
    expect(search, 'expected the control-created combobox search field').not.toBeNull()
    search.focus()
    await userEvent.type(search, '^ui-swiper')
    await raf()

    const visibleOf = (): HTMLElement[] =>
      [...palette.querySelectorAll('[role=option]')].filter((o): o is HTMLElement => o instanceof HTMLElement && o.style.display !== 'none' && !o.hidden)
    const swiperFamily = visibleOf()
    expect(swiperFamily.map((o) => o.getAttribute('value')).sort(), 'an anchored ^ui-swiper should narrow to exactly the swiper family, not ui-button').toEqual(
      ['./swiper-doc.html', './swiper-item-doc.html', './swiper-paddles-doc.html'].sort(),
    )

    // Narrow further to exactly one option for the ArrowDown+Enter+select leg below.
    await userEvent.clear(search)
    await userEvent.type(search, 'ui-swiper-paddles')
    await raf()
    let visible = visibleOf()
    expect(visible.length, 'narrowing further should leave exactly the one matching option').toBe(1)
    expect(visible[0].getAttribute('value')).toBe('./swiper-paddles-doc.html')

    // Step 4 — a filter keystroke resets the active option to none (command-modal.ts #filter -> #setActive(-1));
    // ArrowDown moves it onto the sole visible option, then Enter emits `select` for it. A capturing listener
    // on `document` intercepts + stops the event BEFORE command-palette.ts's own at-target handler can run its
    // real `location.href = …` line (see the file-level comment above for why this is the safe technique).
    let selected: { value: string } | null = null
    document.addEventListener(
      'select',
      (e) => {
        selected = (e as CustomEvent<{ value: string }>).detail
        e.stopImmediatePropagation()
      },
      { capture: true },
    )
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await raf()
    expect(selected, 'Enter on the active (sole visible) option should emit select').not.toBeNull()
    expect(selected!.value, 'the select detail carries the entry\'s real navigation target — the exact value command-palette.ts\'s own handler passes into location.href').toBe('./swiper-paddles-doc.html')
    // The control's own #commit closes unconditionally (this.open = false right after emit) — independent of
    // any consumer listener, so this holds true even with the select propagation stopped above.
    expect(palette.open, 'a selection-driven close').toBe(false)

    // Step 5 — reopen and drive an INVALID regex pattern: an unbalanced group throws SyntaxError from
    // `new RegExp(...)`; the control must catch it and fall back to a literal substring test for this exact
    // keystroke, never throwing and never blanking the list irrecoverably.
    palette.open = true
    await raf()
    const search2 = palette.querySelector('[data-part="search"]') as HTMLElement
    search2.focus()
    await userEvent.clear(search2)
    await userEvent.type(search2, 'ui-swiper(')
    await raf()

    expect(palette.open, 'an invalid pattern must never crash/close the palette').toBe(true)
    visible = visibleOf()
    // No entry contains the literal substring "ui-swiper(" — the fallback correctly matches nothing, but the
    // control neither throws nor tears down its own list.
    expect(visible.length).toBe(0)
    expect(palette.querySelector('[role=listbox]'), 'the list itself must still exist, not be torn down').not.toBeNull()
  })
})
