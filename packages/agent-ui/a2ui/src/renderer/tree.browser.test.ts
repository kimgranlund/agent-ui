// tree.browser.test.ts — structural-resend reconciliation, the ONE cross-engine leg (RSR-C6, ADR-0128 /
// renderer-structural-resend.lld.md §11 "Focus survival"). jsdom is a documented blind spot for focus/
// identity-sensitive assertions (this repo's own prior findings, `test-the-whole-shape`/`css-comment`
// precedents) — a real Chromium + WebKit engine is where `document.activeElement` is actually true.
//
// Drives the FULL renderer host (`createRenderer`), not a hand-rolled `TreeDeps` stub, so the real
// default-catalog factory + real DOM focus semantics are proven end-to-end: a live `<ui-button>` (the
// `tabbable` trait sets `tabindex=0` on the host itself, per button.ts — a natively focusable light-DOM
// element, no shadow-root focus delegation to route around).

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/components' // self-defines ui-* controls (the real default-catalog factories)
import { createRenderer } from './renderer.ts'

describe('structural-resend reconciliation — focus survival across engines (RSR-C6, SPEC-R2 AC1)', () => {
  it("a sibling-only resend (adding an unrelated new node to the container) leaves a focused survivor's focus untouched", () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['group'] },
          { id: 'group', component: 'Row', children: ['btn'] },
          { id: 'btn', component: 'Button', label: 'Focus me' },
        ],
      },
    })

    const btn = mount.querySelector('ui-button') as HTMLElement
    btn.focus()
    expect(document.activeElement).toBe(btn)

    // Resend `group` WHOLE, adding an unrelated new sibling — `btn`'s element identity + focus must survive
    // the children reconcile (SPEC-R1) even though `group`'s own record changed too.
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'group', component: 'Row', children: ['btn', 'status'] },
          { id: 'status', component: 'Text', text: 'added' },
        ],
      },
    })

    expect(mount.querySelector('ui-button')).toBe(btn) // the SAME element — never re-minted
    expect(document.activeElement).toBe(btn) // focus survived the reconcile
    expect(mount.textContent).toContain('added') // the new sibling really rendered, not merely routed

    r.dispose()
    mount.remove()
  })

  it('a prop-ONLY resend on the focused element itself (no children change) preserves both identity and focus', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const r = createRenderer()
    r.mount(mount)

    r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
    // `root` is never reconciled (SPEC-R4) — `btn` is wrapped under a stable, never-resent `root` so this
    // leg resends the FOCUSED node's own record directly, genuinely exercising `#reconcileProps`.
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['btn'] },
          { id: 'btn', component: 'Button', label: 'Go' },
        ],
      },
    })

    const btn = mount.querySelector('ui-button') as HTMLElement
    btn.focus()
    expect(document.activeElement).toBe(btn)

    r.ingestMessage({
      version: 'v1.0',
      updateComponents: { surfaceId: 's1', components: [{ id: 'btn', component: 'Button', label: 'Go!' }] },
    })

    expect(mount.querySelector('ui-button')).toBe(btn) // the SAME element — never re-minted
    expect(document.activeElement).toBe(btn) // focus survived the prop-only reconcile
    expect(btn.textContent).toBe('Go!') // the label really updated (SPEC-R2 AC1)

    r.dispose()
    mount.remove()
  })
})
