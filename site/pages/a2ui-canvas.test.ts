// a2ui-canvas.test.ts: jsdom cold-load leg for the a2ui-canvas page (T-0064). The page builds its renderers, mounts, ingests
// and finalizes, but reads nothing from the mount synchronously afterwards, so it needs no warm-catalog import: on a
// COLD default catalog (the lazy record of ADR-0241) every surface still converges once the body registers. This file
// is its own module graph (vitest isolates per file, the a2ui-form.test.ts rationale), so nothing warms the catalog
// before the page does. It proves the page converges cold, not how fast. Listed in lib/warm-catalog.test.ts
// COLD_SAFE_ENTRIES.
import { describe, it, expect, beforeAll, vi } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (agent-schema.test.ts precedent)
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

beforeAll(async () => {
  // jsdom reality: ElementInternals.setFormValue/setValidity are absent and the page mounts REAL form-associated
  // controls; stub once at the prototype before the page evaluates.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  await import('./a2ui-canvas.ts')
})

describe('the a2ui-canvas page on a cold default catalog', () => {
  it('renders every surface on a cold catalog, with no warm-catalog import in its module graph', async () => {
    const src = readFileSync(`${process.cwd()}/site/pages/a2ui-canvas.ts`, 'utf8') as string
    expect(src).not.toMatch(/^import\s+['"]\.\.\/lib\/warm-catalog\.ts['"]/m)
    await vi.waitFor(
      () => {
        const surfaces = [...document.querySelectorAll<HTMLElement>('.surface')]
        expect(surfaces.length, 'the page built its demo surfaces (anti-vacuous)').toBeGreaterThan(0)
        for (const surface of surfaces) expect(surface.childElementCount).toBeGreaterThan(0)
      },
      { timeout: 5000, interval: 20 },
    )
    const heads = [...document.querySelectorAll('.msg-head')].map((el) => el.textContent ?? '')
    expect(heads.filter((text) => text.includes('error ▸'))).toEqual([])
  })
})
