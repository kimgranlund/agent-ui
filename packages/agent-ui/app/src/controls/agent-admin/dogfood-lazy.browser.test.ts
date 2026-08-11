// dogfood-lazy.browser.test.ts — GH #354, the REAL-ENGINE leg of the lazy dogfood pair.
//
// jsdom cannot prove the one thing that actually changed for a consumer: the browser config carries NO
// resolve aliases (it resolves through the packages' real `exports` maps, unlike vitest.config.ts's alias
// table), and a dynamic `import('@agent-ui/components/dogfood-frame')` is a network-fetched CHUNK here, not
// a synchronous module-graph edge. So this file drives the ON path in a real engine and asserts the pair
// actually arrived AND actually landed inside the composed srcdoc — the ADR-0139 cl.8 precedent for proving
// a lazy dependency really loads where it must (jsdom is blind to the CM path for the same reason).
//
// Scope is deliberately narrow — the frame's own containment/network/theme probes are
// sandbox-frame.browser.test.ts's job (components shard), and the toggle/store/request wiring is
// agent-admin.test.ts's. This adds the two facts only a real engine can supply.
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css' // ADR-0180 (GH #688) — the adopted-or-created log's own scroll/layout CSS, promoted off conversation.css
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '@agent-ui/components/controls/tabs'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import type { AdminSurfaceTurnEvent, AdminSurfaceTurnRequest } from './agent-admin-schema.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time twice over: a mid-test dynamic
// `import()` of the dogfood chunk (network-fetched here, see the banner) and an rAF poll loop
// (`waitUntil` below) for the composed srcdoc to land — both set by the browser's own scheduling, which
// stretches under concurrent host load. MEASURED evidence for this append (2026-07-30, GH #369/370/371
// gate run): the ON-path test failed with exactly `Test timed out in 15000ms` on WEBKIT inside a full
// `test:browser:packages:app` shard (22.7s, with the tell-tale `Failed to take a screenshot` timeout
// alongside it), then passed 4/4 both engines solo at 9.63s — the class signature, not a defect.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

const waitUntil = async (label: string, predicate: () => boolean, ms = 10_000): Promise<void> => {
  const deadline = performance.now() + ms
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  }
  throw new Error(`waitUntil timed out: ${label}`)
}

interface Frame extends HTMLElement {
  assets: { css?: string; js?: string }
  html: string
}

/** Mount the admin with the dogfood modality + sub-toggle on (or off) and a scripted genui turn. */
async function mountAndRun(dogfood: boolean): Promise<{ el: UIAgentAdminElement; requests: AdminSurfaceTurnRequest[] }> {
  const requests: AdminSurfaceTurnRequest[] = []
  const script = async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    requests.push(req)
    yield { kind: 'genui', surfaceId: 'dogfood-browser-1', html: '<ui-button variant="solid">Save</ui-button>' }
    yield { kind: 'note', note: 'frame up' }
  }
  const wrapper = document.createElement('div')
  wrapper.style.width = '1200px'
  wrapper.style.height = '600px'
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.style.flex = '1 1 auto'
  el.agentSurfaceTurn = script
  wrapper.append(el)
  document.body.append(wrapper)
  mounted.push(wrapper)
  await el.updateComplete
  // The modality + sub-toggle ride the element's own store (the live-apply law reads them per turn).
  el.store!.set('surfaceGenui', true)
  el.store!.set('surfaceGenuiDogfood', dogfood)

  const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
  editor.textContent = 'make a form'
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  ;(el.querySelector('ui-conversation-composer [data-part="send"]') as HTMLElement).click()
  await waitUntil('the genui frame mounted', () => el.querySelector('ui-sandbox-frame') !== null)
  return { el, requests }
}

describe('ui-agent-admin — the lazy dogfood pair in a REAL engine (GH #354)', () => {
  it('dogfood ON: the dynamically-imported pair arrives through the package exports map and lands in the srcdoc', async () => {
    const { el, requests } = await mountAndRun(true)
    expect(requests[0]!.genui?.dogfood, 'the turn really ran in dogfood mode').toBe(true)

    const frame = el.querySelector('ui-sandbox-frame') as Frame
    await waitUntil('the lazy chunk resolved and assets were applied', () => (frame.assets.css?.length ?? 0) > 0)
    // The REAL committed fixture, fetched as a lazy chunk — not a stub, not an alias-resolved shim.
    expect(frame.assets.css!.length, 'the real dogfood CSS arrived').toBeGreaterThan(10_000)
    expect(frame.assets.js!.length, 'the real dogfood JS arrived').toBeGreaterThan(10_000)

    // …and the composed document actually carries it (the frame builds srcdoc from `assets`, SPEC-R12).
    const iframe = frame.querySelector('iframe') as HTMLIFrameElement
    const srcdoc = iframe.getAttribute('srcdoc') ?? ''
    expect(srcdoc.length, 'the built srcdoc carries the asset payload').toBeGreaterThan(400_000)
    expect(srcdoc.includes(frame.assets.js!.slice(0, 60)), 'the injected script text is the pair itself').toBe(true)

    // Whole-shape (the fleet's own law): the frame is a real, laid-out box, not a zero-size husk.
    const box = frame.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('dogfood OFF: the frame still mounts, with no assets and a small srcdoc (the import is never reached)', async () => {
    const { el, requests } = await mountAndRun(false)
    expect(requests[0]!.genui?.dogfood).toBe(false)
    const frame = el.querySelector('ui-sandbox-frame') as Frame
    expect(frame.assets.css).toBeUndefined()
    expect(frame.assets.js).toBeUndefined()
    const iframe = frame.querySelector('iframe') as HTMLIFrameElement
    // The asset-less document is NOT empty — it always carries the CSP meta, the token bridge's token map
    // and the bootstrap script (measured 98 522 B, both engines, 2026-07-29). The bound below is anchored on
    // the FIXTURE instead: the committed pair is 450 675 B on disk, so any leak of it into an OFF frame
    // cannot fit under 200 KB. (The ON case measures > 400 KB in the leg above — the two are unmistakable.)
    expect((iframe.getAttribute('srcdoc') ?? '').length, 'no asset payload in the asset-less document').toBeLessThan(200_000)
    const box = frame.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})
