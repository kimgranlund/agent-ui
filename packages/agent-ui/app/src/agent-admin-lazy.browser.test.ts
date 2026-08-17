// agent-admin-lazy.browser.test.ts — ADR-0197 cl.4b (GH #1092): the BROWSER leg of the runtime-parity
// pair. jsdom proves the accessor's mechanics against a mock; this file proves the REAL module through a
// real engine's real dynamic import: `loadAgentAdmin()` resolves the arm, defines `<ui-agent-admin>`, and
// a mount through the accessor is the SAME surface a static `@agent-ui/app/agent-admin` subpath mount
// produces — one class identity, one registry entry (no two-definitions stub, the ADR's rejected
// alternative). CSS wiring follows agent-admin.browser.test.ts (the foundation, the family barrel, every
// composed sibling, then the element's own sheet).
import { describe, it, expect, afterEach } from 'vitest'

import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import './controls/master-detail/master-detail.css'
import './controls/master-detail/master-detail-pane.css'
import './controls/nav-rail/nav-rail.css'
import './controls/settings/settings.css'
import './controls/conversation/conversation.css'
import './controls/conversation/conversation-dialog.css'
import './controls/conversation/conversation-composer.css'
import './controls/surface-host/surface-host.css'
import './controls/super-shell/super-shell.css'
import './controls/agent-admin/agent-admin.css'
import '@agent-ui/icons/phosphor'

// Type-only — erased under verbatimModuleSyntax, so this line costs the entry graph nothing and the
// static/lazy identity check below still compiles against the real class shape.
import type { UIAgentAdminElement } from './controls/agent-admin/agent-admin.ts'
import { loadAgentAdmin } from './index.ts'
import { createMemoryStore } from './controls/settings/memory-store.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear() // the agent-admin.browser.test.ts precedent — the default store persists per page
})

describe('loadAgentAdmin() — real-engine parity (ADR-0197 cl.4b browser leg)', () => {
  it('defines <ui-agent-admin> and a lazy mount IS the static-subpath surface (one class identity)', async () => {
    const mod = await loadAgentAdmin()
    // The accessor resolves the SAME module the ./agent-admin subpath serves — one registry entry.
    const statically = (await import('./controls/agent-admin/agent-admin.ts')).UIAgentAdminElement
    expect(mod.UIAgentAdminElement).toBe(statically)
    expect(customElements.get('ui-agent-admin')).toBe(mod.UIAgentAdminElement)

    const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
    admin.store = createMemoryStore()
    document.body.appendChild(admin)
    mounted.push(admin)
    expect(admin).toBeInstanceOf(mod.UIAgentAdminElement)
    // The surface really composed — the super-shell host it renders through is in the tree.
    await customElements.whenDefined('ui-super-shell')
    expect(admin.querySelector('ui-super-shell'), 'the mounted surface rendered its shell').not.toBeNull()
  })

  it('memoizes across calls in a real engine — the same resolved module object', async () => {
    const [a, b] = await Promise.all([loadAgentAdmin(), loadAgentAdmin()])
    expect(a).toBe(b)
  })
})
