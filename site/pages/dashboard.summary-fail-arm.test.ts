// dashboard.summary-fail-arm.test.ts — GH #810: the Support Dashboard's "Agent summary" card
// (`applySummaryKey`, dashboard.ts) — the workbench.summary-fail-arm.test.ts precedent, verbatim, for its
// sibling replay panel (dashboard-summary.ts's own recorded fixture, three keys instead of two). Same
// pre-#810 gap: a `ui-surface-host` with NO client-message wiring at all means an action click disables via
// the self-wired listener (surface-host.ts, GH #805/PR #809) with nothing to ever re-enable it. Kim's
// 2026-08-13 ruling (fail arm everywhere, no click-once carve-out) — the wiring proven here directly against
// the real, already-mounted host (never editing the shipped fixture content).
import { describe, it, expect, beforeAll } from 'vitest'
import type { UISurfaceHostElement } from '@agent-ui/app'

beforeAll(async () => {
  // jsdom reality (the `a2ui-live.ask-lifecycle.test.ts`/`workbench.summary-fail-arm.test.ts` precedent):
  // `ElementInternals.setFormValue`/`setValidity` are ABSENT in jsdom, and this page mounts a REAL
  // form-associated `ui-segmented-control`/`ui-segment` priority filter as a side effect of import. Stub
  // ONCE at the shared prototype — additive, a no-op if a future jsdom ships it.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  await import('./dashboard.ts') // side-effect mount, the dashboard.browser.test.ts precedent
})

function summaryHost(): UISurfaceHostElement {
  return document.querySelector('.dc-summary-host') as UISurfaceHostElement
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

describe('dashboard — GH #810: the agent-summary replay panel re-enables on its own action click (no turn ever runs for it)', () => {
  it('an action click disables synchronously (surface-host.ts self-wiring) then re-enables immediately (applySummaryKey\'s onClientMessage wiring)', async () => {
    await waitUntil(() => summaryHost() !== null)
    const host = summaryHost()
    host.ingest('{"version":"v1.0","createSurface":{"surfaceId":"dc-fail-arm-probe","catalogId":"agent-ui"}}')
    host.ingest(
      '{"version":"v1.0","updateComponents":{"surfaceId":"dc-fail-arm-probe","components":[{"id":"root","component":"Button","variant":"solid","label":"Investigate","action":{"action":"investigate"}}]}}',
    )
    host.finalize()

    await waitUntil(() => host.querySelector('ui-button') !== null)
    const btn = host.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    expect(btn.disabled).toBe(false)

    btn.click()
    expect(btn.disabled, 'GH #810: the replay panel wiring re-enables it — never a stranded disabled card').toBe(false)
  })
})
