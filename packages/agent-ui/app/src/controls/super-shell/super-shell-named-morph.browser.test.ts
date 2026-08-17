// super-shell-named-morph.browser.test.ts — GH #1005 (ADR-0183 amendment cl.5, GH #958): the real-engine
// probe the amendment's own "browser UNMEASURED" line called for. `super-shell.test.ts`'s jsdom suite
// already pins the token/pairing/gating truth table against a STUBBED `document.startViewTransition`;
// that stub can prove the RIGHT calls happen, never that the PLATFORM accepts them. This file is the one
// thing only a real engine can settle: when the opt-in `viewTransitionNames` path shares ONE
// `view-transition-name` across a pane's segments (dom/view-transition.ts's pairing law) and a segment
// swap runs, does `document.startViewTransition`'s own `ready` promise actually resolve — specifically,
// never with the platform's `InvalidStateError` a duplicate PAINTED name would throw?
//
// BANNER (this file's measured result, not an assumption — read at CI time via `server.browser` +
// feature-detect, exactly router.browser.test.ts's/surface-host.browser.test.ts's established split):
// Chromium ships `document.startViewTransition` (ADR-0183 intake: Chromium 111+) — the suite below runs
// the genuine transition-path assertion there. An engine that reports the API ABSENT (WebKit's Level 1
// support is version-gated, Safari 18+ per the same intake — this harness's bundled WebKit build may
// predate or postdate that line) instead asserts the graceful NO-TRANSITION fallback: `withViewTransition`
// commits `mutate` synchronously, and `#applySegments`' naming gate (`viewTransitionAvailable()`) means no
// `view-transition-name` is ever written on that path either — both halves of the ADR-0183 family's
// byte-identical-when-unavailable law, proven on whichever branch the running engine actually takes.
import { describe, it, expect, afterEach } from 'vitest'
import { server } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

/** A wide-mode (SPEC-R4, >640px), opted-in-both shell with one segmented pane — the named-morph
 *  convention's proving surface (ADR-0183 amendment cl.3, `#applySegments`). */
function mountSegmented(): { el: UISuperShellElement; pane: HTMLElement } {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = '900px'
  el.style.blockSize = '400px'
  el.viewTransitions = true
  el.viewTransitionNames = true
  const content = document.createElement('div')
  content.setAttribute('data-slot', 'content')
  content.textContent = 'canvas'
  const settings = document.createElement('div')
  settings.setAttribute('data-slot', 'options-pane')
  settings.setAttribute('data-segment', 'Settings')
  settings.textContent = 'settings body'
  const context = document.createElement('div')
  context.setAttribute('data-slot', 'options-pane')
  context.setAttribute('data-segment', 'Context')
  context.textContent = 'context body'
  el.append(content, settings, context)
  document.body.append(el)
  mounted.push(el)
  return { el, pane: settings.parentElement as HTMLElement }
}

/** Groups, by `view-transition-name`, every descendant of `root` that carries a NON-EMPTY name AND is
 *  actually PAINTED (`display` not `none`) right now — the platform's own pairing-law invariant
 *  (dom/view-transition.ts's header comment): a single flat snapshot may hold one name on AT MOST ONE
 *  painted element, or the whole transition throws `InvalidStateError`. A caller asserts every group's
 *  length is exactly 1 to prove the invariant held at that instant. */
function paintedNameGroups(root: ParentNode): Map<string, HTMLElement[]> {
  const groups = new Map<string, HTMLElement[]>()
  for (const el of root.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
    const name = el.style.viewTransitionName
    if (!name || getComputedStyle(el).display === 'none') continue
    const list = groups.get(name) ?? []
    list.push(el)
    groups.set(name, list)
  }
  return groups
}

type StartViewTransitionFn = (cb?: () => void | Promise<void>) => { ready: Promise<unknown> }

describe(`ui-super-shell — named-morph real-engine probe (GH #1005, ADR-0183 amendment): ${server.browser}`, () => {
  const doc = document as unknown as { startViewTransition?: StartViewTransitionFn }
  const hasApi = typeof doc.startViewTransition === 'function'

  it(
    `${server.browser} ${hasApi ? 'HAS' : 'LACKS'} document.startViewTransition — the measured fact this file's ` +
      `banner + the ADR-0183 amendment's dated appendix cite`,
    () => {
      // No assertion beyond the type: this test exists to name the per-engine measured fact in the
      // report (grep the reporter output for this title), the same "banner as data" shape
      // router.browser.test.ts's own describe title already uses.
      expect(typeof hasApi).toBe('boolean')
    },
  )

  it(
    `${server.browser}: an opted-in named-morph segment swap resolves the REAL startViewTransition ready ` +
      `promise with no InvalidStateError${hasApi ? '' : ' — API absent here, asserts the graceful sync fallback instead (this file banner)'}`,
    async () => {
      const { el, pane } = mountSegmented()
      await el.updateComplete

      const segments = [...pane.querySelectorAll<HTMLElement>(':scope > [data-segment]')]
      expect(segments.length).toBe(2)
      const strip = pane.querySelector('[data-part="pane-tabs"]') as HTMLElement
      const tabs = [...strip.querySelectorAll<HTMLElement>('[data-part="pane-tab"]')]
      expect(tabs.length).toBe(2)

      if (!hasApi) {
        // The graceful no-transition fallback: `withViewTransition`'s `!viewTransitionAvailable()` branch
        // commits `mutate` synchronously (the SAME branch a reduced-motion environment takes —
        // router.browser.test.ts's established proof), and `#applySegments`' naming gate shares the exact
        // same `viewTransitionAvailable()` check — so no `view-transition-name` is ever written either.
        for (const seg of segments) expect(seg.style.viewTransitionName, 'no API ⇒ no name is ever set').toBe('')
        tabs[1]!.click()
        // synchronous commit — no polling needed, which IS the fallback's whole contract
        expect(segments[0]!.hasAttribute('data-active'), 'sync fallback: the flip already committed').toBe(false)
        expect(segments[1]!.hasAttribute('data-active')).toBe(true)
        return
      }

      // API present: the pairing law's ONE shared name is live before the swap even runs.
      expect(segments[0]!.style.viewTransitionName).toMatch(/^ui-vt-super-shell-segment-/)
      expect(segments[0]!.style.viewTransitionName, 'the pairing law: one shared name per pane box').toBe(
        segments[1]!.style.viewTransitionName,
      )
      // Pre-swap: exactly ONE painted element per name (segment 0 is data-active; segment 1 is display:none).
      for (const [name, els] of paintedNameGroups(pane)) expect(els.length, `pre-swap duplicate paint of "${name}"`).toBe(1)

      // Intercept the REAL document.startViewTransition to capture the platform's own ViewTransition —
      // `withViewTransition` deliberately discards its return (dom/view-transition.ts's own doc comment:
      // no fleet consumer needs finished/ready today), so this is the one seam a probe can reach it from.
      const realStart = doc.startViewTransition!.bind(document)
      let captured: { ready: Promise<unknown> } | undefined
      doc.startViewTransition = (cb) => {
        const vt = realStart(cb)
        captured = vt
        return vt
      }

      tabs[1]!.click()
      // The transition path commits `mutate` ASYNCHRONOUSLY (dom/view-transition.ts's own header caveat:
      // the platform snapshots first) — poll briefly, the same shape router.browser.test.ts's own
      // opted-in navigation leg uses.
      for (let i = 0; i < 40 && !segments[1]!.hasAttribute('data-active'); i++) await new Promise((r) => requestAnimationFrame(r))
      doc.startViewTransition = realStart

      expect(captured, 'document.startViewTransition was never called').toBeDefined()
      let readyError: unknown
      try {
        await captured!.ready
      } catch (err) {
        readyError = err
      }
      const isInvalidState = readyError instanceof DOMException && readyError.name === 'InvalidStateError'
      expect(isInvalidState, `ready rejected with InvalidStateError — a duplicate painted name in one snapshot: ${String(readyError)}`).toBe(
        false,
      )
      expect(readyError, `ready promise rejected: ${String(readyError)}`).toBeUndefined()

      expect(segments[0]!.hasAttribute('data-active'), 'the swap actually landed').toBe(false)
      expect(segments[1]!.hasAttribute('data-active')).toBe(true)

      // Post-swap: still the pairing law (same shared name), and STILL exactly one painted element per
      // name — the real invariant a duplicate-name InvalidStateError would have violated.
      expect(segments[1]!.style.viewTransitionName).toBe(segments[0]!.style.viewTransitionName)
      for (const [name, els] of paintedNameGroups(pane)) expect(els.length, `post-swap duplicate paint of "${name}"`).toBe(1)
    },
  )
})
