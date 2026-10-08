// a2ui-form.test.ts: jsdom page-level leg for the flagship generative form page (T-0040, ADR-0241). Drives the REAL
// page module (the a2a-tic-tac-toe.test.ts idiom: a side-effect import into a fresh #app). The page's `run()` feeds the
// form seed into a fresh renderer and then, synchronously, calls `wireFormChrome()`, which looks the rendered
// `ui-form-provider` up in the mount. On a COLD default catalog (the lazy record of ADR-0241, first renderer on the
// page) that lookup finds nothing and the page prints "Form not mounted."; the page's `import '../lib/warm-catalog.ts'`
// is what keeps the first renderer warm. This file is its own module graph (vitest isolates per file), so nothing
// else warms the catalog before the page does: dropping that import turns this test red, since the default is lazy
// (ADR-0241 Amendment 1; lib/warm-catalog.test.ts is the leg that bites on any tree).
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(async () => {
  // jsdom reality (the a2ui-live.ask-lifecycle.test.ts precedent): ElementInternals.setFormValue/setValidity are absent
  // and this page mounts REAL form-associated controls; stub once at the prototype before the page evaluates.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  await import('./a2ui-form.ts') // mounts on import and runs the demo once, exactly like every other /site page
})

describe('the generative form page: the first render is mounted and wired (not "Form not mounted.")', () => {
  it('the live surface holds the rendered ui-form-provider', () => {
    expect(document.querySelector('#surface ui-form-provider')).not.toBeNull()
  })

  it('the page-IDL status was derived from the mounted provider, not the not-mounted fallback', () => {
    const status = document.querySelector('.form-status') as HTMLElement
    expect(status.dataset.kind).toBe('idle')
    expect(status.textContent).not.toContain('Form not mounted')
    expect(status.textContent).toMatch(/^(Not submitted yet|Ready)/)
  })
})
