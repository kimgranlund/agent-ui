// agent-admin-lazy-failure.test.ts — ADR-0197 cl.4b (GH #1092): the FAILURE leg of the barrel's lazy
// agent-admin seam, on the markdown-lazy-failure.test.ts shape. A static import cannot fail; a dynamic
// one can (a stale hashed chunk after a deploy, an offline reload). Two claims:
//   1. REJECTION surfaces as a normally-catchable error — the caller's own `catch` sees it; no unhandled
//      rejection escapes the accessor (the memo's `.catch` re-throws INTO the awaited promise).
//   2. RETRY — the failure is not memoized (`loadAgentAdmin`'s catch clears the memo), so the NEXT call
//      loads for real; a memoized rejection would poison the accessor for the page's whole lifetime.
// Both legs run in ONE file, in this order, on purpose: the memo is module-scoped and cleared only by a
// FAILED load, so leg 1 hands leg 2 a fresh slate (the dogfood/markdown-lazy-failure precedent verbatim).
import { describe, it, expect, vi } from 'vitest'

const arm = vi.hoisted(() => ({ loads: 0, mode: 'throw' as 'throw' | 'resolve' }))

class FakeAgentAdminElement extends HTMLElement {}

vi.mock('./controls/agent-admin/agent-admin.ts', async () => {
  arm.loads += 1
  if (arm.mode === 'throw') throw new Error('simulated agent-admin chunk load failure')
  if (!customElements.get('ui-agent-admin')) customElements.define('ui-agent-admin', FakeAgentAdminElement)
  return { UIAgentAdminElement: FakeAgentAdminElement }
})

import { loadAgentAdmin } from './index.ts'

describe('loadAgentAdmin() — rejection + retry (ADR-0197 cl.3, the markdown-lazy-failure precedent)', () => {
  it('a failed load rejects into the CALLER (caught error, never an unhandled rejection)', async () => {
    // vitest wraps a throwing mock factory in its own "error when mocking a module" error — the exact
    // message is the harness's, not ours; the CONTRACT under test is only that the rejection lands in the
    // caller's catch (never an unhandled rejection escaping the memo).
    await expect(loadAgentAdmin()).rejects.toThrow()
    expect(arm.loads).toBe(1)
  })

  it('the failure is NOT memoized — the next call retries and resolves', async () => {
    arm.mode = 'resolve'
    const mod = await loadAgentAdmin()
    expect(arm.loads, 'a second REAL load happened — the rejected promise was dropped from the memo').toBe(2)
    expect(customElements.get('ui-agent-admin')).toBe(mod.UIAgentAdminElement)
    // And the resolved load IS memoized from here on.
    expect(await loadAgentAdmin()).toBe(mod)
    expect(arm.loads).toBe(2)
  })
})
