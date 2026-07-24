import { describe, it, expect, vi, afterEach } from 'vitest'
import { UISurfaceHostElement } from './surface-host.ts'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/components' // self-registers ui-button/ui-column for the streamed fixture below
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
} from '@agent-ui/components/descriptor'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
// same reverse-coupling fs-read idiom as app-shell.test.ts / layering.test.ts.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// LLD-C3 jsdom probes for ui-surface-host — the mount/stream seam (SPEC-R2/R3/R11). Covers: (1) pre-
// connect no-op behaviour + the single dev warning, (2) a real ingest→finalize render + applyRootStretch,
// (3) idempotent connect (no duplicate host/subtree across a reconnect), (4) dispose (idempotent), (5)
// onClientMessage delivery, (6) the label→ARIA effect, and (7) the descriptor's structural + contract↔
// props + contract↔source trip-wires. What jsdom CANNOT resolve — the actual painted checkered/forced-
// colors geometry — is surface-host.browser.test.ts's job.

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})
function mount<T extends Element>(el: T): T {
  document.body.append(el)
  mounted.push(el)
  return el
}

const line = (obj: unknown): string => JSON.stringify(obj)

describe('ui-surface-host — pre-connect calls are a documented no-op (LLD-C1)', () => {
  it('ingest/finalize/dispose/onClientMessage before connect never throw, and warn ONCE total (not per-call)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-surface-host') as UISurfaceHostElement
    expect(() => el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))).not.toThrow()
    expect(() => el.finalize()).not.toThrow()
    expect(() => el.dispose()).not.toThrow()
    expect(() => el.onClientMessage(() => {})).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/before connect/i)
    warn.mockRestore()
  })

  it('a call AFTER connect never warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-x', catalogId: 'agent-ui' } }))
    el.finalize()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('ui-surface-host — connect builds the artboard ONCE (idempotent across a reconnect)', () => {
  it('builds exactly one [data-part="stage"] > [data-part="surface"] pair at first connect', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    const stages = el.querySelectorAll('[data-part="stage"]')
    expect(stages).toHaveLength(1)
    expect(stages[0].querySelectorAll('[data-part="surface"]')).toHaveLength(1)
  })

  it('a reconnect (disconnect then re-append) rebuilds a single, FRESH stage/surface pair — never a duplicate, never a dead husk', () => {
    const el = document.createElement('ui-surface-host') as UISurfaceHostElement
    mount(el)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-r', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's-r', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    el.finalize()
    expect(el.querySelectorAll('[data-part="stage"]')).toHaveLength(1)

    el.remove() // disconnect — disposes the RendererHost (leak-safety) + drops the torn-down subtree
    expect(el.querySelectorAll('[data-part="stage"]'), 'disconnect left stale DOM behind').toHaveLength(0)

    mount(el) // reconnect — connected()'s build-guard rebuilds a FRESH, empty artboard
    expect(el.querySelectorAll('[data-part="stage"]'), 'a reconnect minted a duplicate stage').toHaveLength(1)
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    expect(surface.childElementCount, 'the prior render survived disconnect — it should not, a fresh instance').toBe(0)

    // the rebuilt artboard genuinely WORKS — not a permanently-dead husk.
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-r2', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's-r2', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    expect(surface.querySelector('ui-column'), 'the reconnected instance never rendered again').not.toBeNull()
  })
})

describe('ui-surface-host — disconnect disposes the RendererHost (leak-safety net)', () => {
  it('disconnect tears down the mounted DOM even when the consumer never called dispose() itself', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-leak', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's-leak', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    expect(surface.childElementCount).toBeGreaterThan(0)
    el.remove() // disconnect — NOT dispose(); the leak-safety net must fire regardless
    expect(el.querySelectorAll('[data-part="surface"]')).toHaveLength(0) // the whole subtree was dropped
  })

  it('a subsequent explicit dispose() after disconnect is a safe no-op (never throws)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.remove()
    expect(() => el.dispose()).not.toThrow() // #host is undefined again post-disconnect — the pre-connect guard path
    warn.mockRestore()
  })
})

describe('ui-surface-host — a real A2UI stream renders inside the surface + applyRootStretch (SPEC-R2 AC1)', () => {
  it('ingest → finalize renders a Column root inside [data-part="surface"] and stretches it', async () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['btn'] },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-column')
    expect(root.hasAttribute('stretch')).toBe(false) // not yet stretched — finalize() has not run

    el.finalize()
    expect(root.hasAttribute('stretch')).toBe(true) // applyRootStretch, unchanged from canvas-surface.ts

    await whenFlushed()
    const btn = surface.querySelector('ui-button')
    expect(btn).not.toBeNull()
    expect(btn!.textContent).toBe('Go')
  })
})

describe('ui-surface-host — onClientMessage delivers a stubbed client message (SPEC-R2 AC3)', () => {
  it('a click on a mounted control fires the registered callback with the resolved action', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's2',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Click', action: { action: 'submit' } }],
        },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement
    btn.click()
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ action: { surfaceId: 's2', name: 'submit' } })
  })
})

describe('ui-surface-host — dispose (idempotent, SPEC-R2 AC2)', () => {
  it('tears down the RendererHost — the mounted DOM is removed; a second call is a no-op, never throws', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    expect(surface.childElementCount).toBeGreaterThan(0)
    el.dispose()
    expect(surface.childElementCount).toBe(0)
    expect(() => el.dispose()).not.toThrow()
  })
})

describe('ui-surface-host — label → ARIA via internals only (never a host attribute)', () => {
  it('an empty (default) label carries no role/aria-label', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    expect(el.label).toBe('')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('a non-empty label sets internals.role="region" + internals.ariaLabel, reactively', async () => {
    const el = document.createElement('ui-surface-host') as UISurfaceHostElement
    el.label = 'Rendered agent surface' // property-wins, set BEFORE connect (ADR-0005)
    mount(el)
    expect(el.getAttribute('role')).toBeNull() // internals-only — never a host attribute
    el.label = ''
    await el.updateComplete
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
})

describe('ui-surface-host — deep-import guard (SPEC-R2 AC4)', () => {
  it('imports only createRenderer/RendererHost/ClientMessageListener/A2uiClientMessage from the @agent-ui/a2ui public barrel — never packages/agent-ui/a2ui/tools/**', () => {
    const src = readFileSync(
      `${process.cwd()}/packages/agent-ui/app/src/controls/surface-host/surface-host.ts`,
      'utf8',
    ) as string
    // Scan only real `import ... from '...'` LINES (never prose/comments — this file's own header
    // banner names the forbidden path in ENGLISH, which would otherwise false-positive this check).
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l))
    for (const l of importLines) {
      expect(l).not.toMatch(/agent-ui\/a2ui\/tools/)
      expect(l).not.toMatch(/packages\/agent-ui\/a2ui\/src/)
    }
    const a2uiImports = importLines.filter((l) => /from ['"]@agent-ui\/a2ui['"]/.test(l))
    expect(a2uiImports.length).toBeGreaterThan(0) // anti-vacuous: it genuinely imports the public barrel
  })
})

// ── descriptor — ADR-0004 (structural + contract↔props + contract↔source) ──────────────────────────────

const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/surface-host`
const ts = readFileSync(`${DIR}/surface-host.ts`, 'utf8') as string
const css = readFileSync(`${DIR}/surface-host.css`, 'utf8') as string

describe('surface-host.md descriptor', () => {
  const md = readFileSync(`${DIR}/surface-host.md`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['label', 'wrap', 'bare']

  it('has a leading frontmatter fence and a /site prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-surface-host')
  })

  it('carries the ADR-0004 descriptor field set and is schema-valid', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    expect(/^tag:\s*ui-surface-host\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('attributes[] is a faithful bijection with finalize(UISurfaceHostElement).props', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(compareDescriptorToProps(parsed.attributes, UISurfaceHostElement.props)).toEqual([])
  })

  it('a drifted attribute FAILS (negative control)', () => {
    const flipDefault: ParsedAttribute[] = parsed.attributes.map((a) => ({ ...a, default: 'x' }))
    expect(compareDescriptorToProps(flipDefault, UISurfaceHostElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_DEFAULT', path: 'attributes.label.default' }),
    )
  })

  it('customStates/slots agree with the source (no undeclared CSS-styled slot, no unused state)', () => {
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })
})
