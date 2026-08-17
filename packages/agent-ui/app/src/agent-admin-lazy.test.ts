// agent-admin-lazy.test.ts — ADR-0197 cl.4b (GH #1092): the RUNTIME half of the barrel's lazy
// agent-admin seam, jsdom leg. The bundle half (controls/agent-admin/agent-admin-lazy.bundle.test.ts)
// proves the arm is absent from the `.` entry chunk; this file proves `loadAgentAdmin()`'s mechanics on
// the markdown-lazy.test.ts pattern: the module is mocked per-file (the mock counts REAL loads and
// self-defines the tag, mirroring the real module's self-registering side effect), because the memo is
// module-scoped and jsdom's customElements registry is global per test file.
//
// Two claims, neither assertable by reading the code:
//   1. loadAgentAdmin() DEFINES the tag — importing the arm's module is the fleet self-define idiom, so
//      after the first resolved call `customElements.get('ui-agent-admin')` is the module's own class.
//   2. MEMOIZATION — two calls produce ONE module load and the SAME resolved module (one fetch per page).
import { describe, it, expect, vi } from 'vitest'

const arm = vi.hoisted(() => ({ loads: 0 }))

class FakeAgentAdminElement extends HTMLElement {}

vi.mock('./controls/agent-admin/agent-admin.ts', async () => {
  arm.loads += 1
  if (!customElements.get('ui-agent-admin')) customElements.define('ui-agent-admin', FakeAgentAdminElement)
  return { UIAgentAdminElement: FakeAgentAdminElement }
})

import { loadAgentAdmin } from './index.ts'

describe('loadAgentAdmin() — the ADR-0197 cl.3 lazy accessor (jsdom leg)', () => {
  it('resolves the arm module and defines <ui-agent-admin> (self-define idiom)', async () => {
    expect(arm.loads, 'the import must be LAZY — merely importing the barrel loads nothing').toBe(0)
    const mod = await loadAgentAdmin()
    expect(arm.loads).toBe(1)
    expect(customElements.get('ui-agent-admin'), 'importing the module defines the tag').toBe(mod.UIAgentAdminElement)
  })

  it('memoizes: a second call is the SAME load — one fetch per page', async () => {
    const [a, b] = await Promise.all([loadAgentAdmin(), loadAgentAdmin()])
    expect(arm.loads, 'still exactly one module load').toBe(1)
    expect(a, 'both calls resolve the same module object').toBe(b)
  })
})
