// agent-admin-edge-to-edge.browser.test.ts — GH #1260 (Kim's 2026-08-18 ruling): the STANDING PIN for the
// edge-to-edge panel IA. The ticket was filed as "a light hairline on dark shell surfaces"; real-engine pixel
// forensics (the ticket's Findings) traced it to GH #686/#665's DESIGNED 12px gutters — `[data-part='canvas']`
// padding (a page-background strip on all four shell edges) + the pane-holder's row `gap` (a strip between
// every two regions) — `surface` showing through around `surface-low` cards. Kim ruled the gutters OUT: the
// three regions meet the shell's edges and each other flush; the seam between two painted regions is ONE
// hairline (agent-admin.css's flush-seam rule), never spacing.
//
// This file proves the rect adjacency the ruling names, in BOTH engines (this project's chromium + webkit
// instances), at the two viewports the ruling names (the fleet default 414×896 — ADR-0150 — where exactly the
// primary region paints, and 1280×800 where all three paint side by side), in BOTH color schemes (the strip
// was VISIBLE in dark; light is verified too — geometry does not depend on scheme, and the pin says so
// rather than assumes it): every painted region's edge that faces a shell edge lands ON that edge, and every
// two adjacent painted regions share their seam edge — |gap| ≤ 0.5px (sub-pixel rounding only). Its own file
// (not agent-admin.browser.test.ts): it drives `page.viewport()` — a real driver round trip that resizes the
// whole test document — which the geometry suite's fixed-width wrapper mounts deliberately never do.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { page } from 'vitest/browser'

import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css'
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '../super-shell/super-shell.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import '@agent-ui/icons/phosphor'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (`page.viewport()` driver round trips
// + rAF settles), so its duration stretches under concurrent host load. Class definition + why this is not
// a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

const frames = async (n = 3): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
}

const mounted: HTMLElement[] = []
afterEach(async () => {
  while (mounted.length) mounted.pop()?.remove()
  document.documentElement.style.colorScheme = ''
  await page.viewport(414, 896) // restore the fleet default (ADR-0150 cl.5)
})

/** Mounts `ui-agent-admin` filling the WHOLE viewport (the /agent-admin-app page's own shape — the app is
 *  the viewport), under one color scheme. `color-scheme` is set on the document root so `light-dark()`
 *  resolves for the whole tree the way the site's theme provider would set it. */
async function mountFullViewport(scheme: 'light' | 'dark'): Promise<UIAgentAdminElement> {
  document.documentElement.style.colorScheme = scheme
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;inset:0;display:flex;margin:0;padding:0'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  await frames()
  // Show ALL THREE and make chat primary — the broadest state: wide paints three, narrow paints chat solo.
  ;(el as unknown as { setPaneVisibilitySeam(s: readonly ('chat' | 'settings' | 'copilot')[], p: 'chat' | 'settings' | 'copilot'): void }).setPaneVisibilitySeam(
    ['chat', 'settings', 'copilot'],
    'chat',
  )
  await frames()
  return el
}

const PANES = ['chat-pane', 'settings-pane', 'copilot-pane'] as const

function paintedRegions(el: UIAgentAdminElement): HTMLElement[] {
  return PANES.map((p) => el.querySelector(`[data-part="${p}"]`) as HTMLElement).filter((r) => getComputedStyle(r).display !== 'none')
}

const near = (a: number, b: number): number => Math.abs(a - b)

for (const [vw, vh, expectPainted] of [
  [414, 896, 1],
  [1280, 800, 3],
] as const) {
  for (const scheme of ['dark', 'light'] as const) {
    describe(`ui-agent-admin edge-to-edge (GH #1260) — ${vw}×${vh}, ${scheme}`, () => {
      it(`every painted region meets the shell edges and its neighbours flush (|gap| ≤ 0.5px) — ${expectPainted} region(s) paint`, async () => {
        await page.viewport(vw, vh)
        const el = await mountFullViewport(scheme)
        await frames()

        const shell = el.querySelector('ui-super-shell') as HTMLElement
        const bar = shell.querySelector('[data-part="bar"][data-bar="header"]') as HTMLElement
        const canvas = shell.querySelector('[data-part="canvas"]') as HTMLElement
        const holder = el.querySelector('[data-part="pane-holder"]') as HTMLElement
        expect(shell.getBoundingClientRect().width, 'the shell fills the viewport width').toBeCloseTo(vw, 0)
        expect(getComputedStyle(document.documentElement).colorScheme, 'the requested scheme is in force').toContain(scheme)

        const shellBox = shell.getBoundingClientRect()
        const barBox = bar.getBoundingClientRect()
        const canvasBox = canvas.getBoundingClientRect()
        // The canvas (the region below the header bar) is itself flush to the shell: no page-bg frame.
        expect(near(canvasBox.left, shellBox.left), 'canvas left is the shell left').toBeLessThanOrEqual(0.5)
        expect(near(canvasBox.right, shellBox.right), 'canvas right is the shell right').toBeLessThanOrEqual(0.5)
        expect(near(canvasBox.bottom, shellBox.bottom), 'canvas bottom is the shell bottom').toBeLessThanOrEqual(0.5)
        expect(near(canvasBox.top, barBox.bottom), 'canvas top is the header bar bottom').toBeLessThanOrEqual(0.5)
        // The pane holder fills the canvas — the retired 12px padding left no strip.
        for (const side of ['left', 'right', 'top', 'bottom'] as const) {
          expect(near(holder.getBoundingClientRect()[side], canvasBox[side]), `holder ${side} is the canvas ${side} (no canvas padding)`).toBeLessThanOrEqual(0.5)
        }

        const regions = paintedRegions(el)
        expect(regions.length, `${expectPainted} region(s) paint at ${vw}px`).toBe(expectPainted)
        const boxes = regions.map((r) => r.getBoundingClientRect())
        for (const [i, box] of boxes.entries()) {
          const label = regions[i]!.getAttribute('data-part')
          expect(box.width, `${label} has a real box`).toBeGreaterThan(0)
          // card ↔ shell edge: block axis, every region.
          expect(near(box.top, canvasBox.top), `${label} top meets the shell's content top`).toBeLessThanOrEqual(0.5)
          expect(near(box.bottom, canvasBox.bottom), `${label} bottom meets the shell's bottom edge`).toBeLessThanOrEqual(0.5)
        }
        // card ↔ shell edge: inline axis, first and last painted.
        expect(near(boxes[0]!.left, canvasBox.left), 'the first painted region meets the shell start edge').toBeLessThanOrEqual(0.5)
        expect(near(boxes[boxes.length - 1]!.right, canvasBox.right), 'the last painted region meets the shell end edge').toBeLessThanOrEqual(0.5)
        // card ↔ card: every adjacent pair shares its seam edge.
        for (let i = 1; i < boxes.length; i++) {
          expect(near(boxes[i]!.left, boxes[i - 1]!.right), `${regions[i - 1]!.getAttribute('data-part')} ↔ ${regions[i]!.getAttribute('data-part')} seam is flush`).toBeLessThanOrEqual(0.5)
          // …and paints exactly ONE hairline (the trailing region's start border) — never a doubled 2px.
          expect(Number.parseFloat(getComputedStyle(regions[i]!).borderInlineStartWidth), 'one hairline seam, on the trailing region').toBe(1)
          expect(Number.parseFloat(getComputedStyle(regions[i - 1]!).borderInlineEndWidth), 'no second hairline on the leading region').toBe(0)
        }
        // Nothing painted at the shell's own outer edges: no card border along the viewport edge (that would
        // be the stray hairline the ticket was filed on, in a new guise) and no doubled header seam.
        expect(Number.parseFloat(getComputedStyle(regions[0]!).borderInlineStartWidth), 'no border along the shell start edge').toBe(0)
        expect(Number.parseFloat(getComputedStyle(regions[regions.length - 1]!).borderInlineEndWidth), 'no border along the shell end edge').toBe(0)
        for (const r of regions) {
          expect(Number.parseFloat(getComputedStyle(r).borderBlockStartWidth), `${r.getAttribute('data-part')}: no top border doubling the header seam`).toBe(0)
          expect(Number.parseFloat(getComputedStyle(r).borderBlockEndWidth), `${r.getAttribute('data-part')}: no bottom border along the shell edge`).toBe(0)
        }
      })
    })
  }
}
