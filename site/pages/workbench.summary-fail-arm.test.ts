// workbench.summary-fail-arm.test.ts — GH #810: the SaaS Data Workbench's "Agent summary" card
// (`applySummaryKey`, workbench.ts) replays a RECORDED fixture (`workbench-summary.ts`) through a REAL
// `ui-surface-host` with NO client-message wiring at all, pre-#810 — an action click there disabled the
// card via `ui-surface-host`'s own self-wired disable-on-action listener (surface-host.ts, GH #805/PR #809)
// with nothing anywhere to ever re-enable it. Kim's 2026-08-13 ruling (fail arm everywhere, no click-once
// carve-out): the minimal conforming wiring is an `onClientMessage` consumer that immediately re-enables —
// a replay panel's action goes nowhere (no turn runs for it), so the card should just stay live.
//
// The SHIPPED fixture (`workbench-summary.ts`) carries no action-bearing component today — this proves the
// WIRING `applySummaryKey` sets up on the real, already-mounted host, by calling that host's own PUBLIC
// `ingest()` seam directly (the surface-host.test.ts precedent: constructing controlled JSONL rather than
// editing the shipped recorded fixture, which would be a content change, not a wiring one).
import { describe, it, expect, beforeAll } from 'vitest'
import type { UISurfaceHostElement } from '@agent-ui/app'

beforeAll(async () => {
  // jsdom reality (the `a2ui-live.ask-lifecycle.test.ts`/`provider-switcher.test.ts` precedent):
  // `ElementInternals.setFormValue`/`setValidity` are ABSENT in jsdom, and this page mounts REAL
  // form-associated controls (the toolbar's `ui-text-field` search + `ui-select`-backed status facet) as a
  // side effect of import. Stub ONCE at the shared prototype — additive, a no-op if a future jsdom ships it.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  // jsdom has no `scrollIntoView` at all — workbench.ts's own module-scope `highlightPickedRow()` call
  // (its initial default-pick echo) invokes it unconditionally as a side effect of import. A no-op stub,
  // additive.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function (): void {}
  }
  await import('./workbench.ts') // side-effect mount, the workbench.browser.test.ts precedent
})

function summaryHost(): UISurfaceHostElement {
  return document.querySelector('.wb-summary-host') as UISurfaceHostElement
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

describe('workbench — GH #810: the agent-summary replay panel re-enables on its own action click (no turn ever runs for it)', () => {
  it('an action click disables synchronously (surface-host.ts self-wiring) then re-enables immediately (applySummaryKey\'s onClientMessage wiring)', async () => {
    await waitUntil(() => summaryHost() !== null)
    const host = summaryHost()
    // A fresh surface, ingested directly on the real mounted host (never editing the shipped fixture) — an
    // action-bearing Button, proving the WIRING regardless of what workbench-summary.ts happens to carry today.
    host.ingest('{"version":"v1.0","createSurface":{"surfaceId":"wb-fail-arm-probe","catalogId":"agent-ui"}}')
    host.ingest(
      '{"version":"v1.0","updateComponents":{"surfaceId":"wb-fail-arm-probe","components":[{"id":"root","component":"Button","variant":"solid","label":"Investigate","action":{"action":"investigate"}}]}}',
    )
    host.finalize()

    await waitUntil(() => host.querySelector('ui-button') !== null)
    const btn = host.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    expect(btn.disabled).toBe(false)

    btn.click()
    // surface-host.ts's own self-wired listener fires SYNCHRONOUSLY on click, before any external
    // onClientMessage callback runs — momentarily true is real, but by the time this assertion reads it the
    // wired re-enable callback (also synchronous, same listener Set) has already run too.
    expect(btn.disabled, 'GH #810: the replay panel wiring re-enables it — never a stranded disabled card').toBe(false)
  })
})
