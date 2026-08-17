import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
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

// jsdom reality (the conversation.test.ts precedent) — no native ElementInternals.setFormValue/
// setValidity; GH #805's fixtures mount REAL form-associated ui-checkbox/ui-text-field controls (to prove
// the disable walk is duck-typed, not button-only), which need this stub to connect at all under jsdom.
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

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
  it('ingest/finalize/dispose/onClientMessage/setInteractiveDisabled before connect never throw, and warn ONCE total (not per-call)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('ui-surface-host') as UISurfaceHostElement
    expect(() => el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))).not.toThrow()
    expect(() => el.finalize()).not.toThrow()
    expect(() => el.dispose()).not.toThrow()
    expect(() => el.onClientMessage(() => {})).not.toThrow()
    expect(() => el.setInteractiveDisabled(false)).not.toThrow() // GH #805
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
    // GH #1124 — ADR-0160's full-width law holds MID-STREAM: the root stretch applies at ingest, the
    // moment the root exists, no longer only at finalize() (the old finalize-only timing left the first
    // streaming paint centered at fit-content).
    expect(root.hasAttribute('stretch')).toBe(true)

    el.finalize()
    expect(root.hasAttribute('stretch')).toBe(true) // applyRootStretch — finalize re-asserts, idempotent

    await whenFlushed()
    const btn = surface.querySelector('ui-button')
    expect(btn).not.toBeNull()
    expect(btn!.textContent).toBe('Go')
  })

  // GH #892 — the root-fill treatment generalized off ui-column specifically to ANY UIContainerElement
  // root: a Row (a layout primitive with no `stretch` prop of its own) gets an imperative
  // `align-self: stretch` instead of the ui-column-only attribute; the geometry proof is the browser leg
  // (surface-host.browser.test.ts) — jsdom cannot resolve computed flex geometry — this pins the JS-level
  // contract cheaply.
  it('a Row root (no `stretch` prop of its own) gets `align-self: stretch` at finalize()', async () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's2',
          components: [
            { id: 'root', component: 'Row', children: ['btn'] },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-row')
    expect(root.style.alignSelf).toBe('stretch') // GH #1124 — applied at ingest, mid-stream, not finalize-only

    el.finalize()
    expect(root.style.alignSelf).toBe('stretch')
    expect(root.hasAttribute('stretch')).toBe(false) // the ui-column-only attribute never applies to a Row
  })

  // GH #892's named exception — an intrinsic control (extends UIElement directly, not UIContainerElement)
  // as the WHOLE root is untouched by either branch: it keeps its own natural width, never force-stretched.
  it('a Button root (an intrinsic control, not a layout primitive) is untouched — no stretch attribute, no align-self', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go' }] },
      }),
    )
    const surface = el.querySelector('[data-part="surface"]') as HTMLElement
    const root = surface.firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-button')

    el.finalize()
    expect(root.hasAttribute('stretch')).toBe(false)
    expect(root.style.alignSelf).toBe('')
  })
})

// ── GH #1163 — exactly ONE container owner: `data-root-card` mirrors the root's shape ─────────────────
//
// #1150/#1161 gave the [bare] chat mount structural card chrome; a payload whose ROOT is itself a Card
// then nested two bordered/padded containers. surface-host.ts mirrors the root's shape into
// `data-root-card` at the SAME ingest point as the root stretch (per-ingest AND per-finalize), so the
// CSS suppression re-evaluates whenever an updateComponents changes the root's shape. The painted proof
// (no double chrome, radius kept) is the browser leg; this pins the attribute contract in jsdom.

describe('ui-surface-host — GH #1163: data-root-card tracks the rendered root shape', () => {
  const CREATE = line({ version: 'v1.0', createSurface: { surfaceId: 'cc1', catalogId: 'agent-ui' } })
  const CARD_ROOT = line({
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'cc1',
      components: [
        { id: 'root', component: 'Card', children: ['c_content'] },
        { id: 'c_content', component: 'CardContent', children: ['c_text'] },
        { id: 'c_text', component: 'Text', variant: 'body', text: 'Place your bet' },
      ],
    },
  })
  const COLUMN_ROOT = line({
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'cc1',
      components: [
        { id: 'root', component: 'Column', children: ['c_text2'] },
        { id: 'c_text2', component: 'Text', variant: 'body', text: 'Bare again' },
      ],
    },
  })

  it('a Card root sets data-root-card at ingest (mid-stream, not finalize-only)', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    expect(el.hasAttribute('data-root-card')).toBe(false)
    el.ingest(CREATE)
    el.ingest(CARD_ROOT)
    const root = (el.querySelector('[data-part="surface"]') as HTMLElement).firstElementChild as HTMLElement
    expect(root.tagName.toLowerCase()).toBe('ui-card')
    expect(el.hasAttribute('data-root-card')).toBe(true) // same ingest point as the root stretch
    el.finalize()
    expect(el.hasAttribute('data-root-card')).toBe(true) // finalize re-asserts, idempotent
  })

  it('re-evaluates across updates: a re-createSurface that changes the root shape Column → Card sets the attribute, Card → Column clears it (the root id itself is never reconciled in place, SPEC-R4 — a root shape change arrives via re-createSurface)', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE)
    el.ingest(COLUMN_ROOT)
    expect(el.hasAttribute('data-root-card')).toBe(false) // bare root — the #1161 chrome case, no suppression
    el.ingest(CREATE) // re-createSurface with a live id replaces the surface (renderer.ts)
    el.ingest(CARD_ROOT)
    expect(el.hasAttribute('data-root-card')).toBe(true)
    el.ingest(CREATE)
    el.ingest(COLUMN_ROOT)
    el.finalize()
    expect(el.hasAttribute('data-root-card')).toBe(false)
  })

  it('disconnect clears the state — a rebuilt artboard has no root shape yet', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE)
    el.ingest(CARD_ROOT)
    expect(el.hasAttribute('data-root-card')).toBe(true)
    el.remove()
    expect(el.hasAttribute('data-root-card')).toBe(false)
  })
})

// ── ADR-0187 / GH #829 clause 6 — the terminal-empty presentational brace ──────────────────────────────
//
// The validator is the sole JUDGE (SPEC-N6). This state is a read of the host's OWN facts — finalize
// happened + the mount point holds no element — so it also covers producers the server-side opt-in
// cannot reach (recorded transcripts, the A2A bridge, any third-party stream). The CSS half swaps the
// anticipatory ":empty" placeholder for a terminal message; jsdom cannot resolve `content`, so these
// assertions target the STATE the stylesheet keys off, which is the real contract boundary.

describe('ui-surface-host — ADR-0187: terminal-empty state at finalize (GH #829/#802)', () => {
  const CREATE_ONLY = line({ version: 'v1.0', createSurface: { surfaceId: 'abandoned', catalogId: 'agent-ui' } })

  it('finalize on a rootless host flips data-empty-final; the host stays MOUNTED and addressable', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE_ONLY)
    // Pre-finalize the placeholder is still ANTICIPATORY — content may yet arrive (runtime SPEC-R4).
    expect(el.dataset.emptyFinal).toBeUndefined()

    el.finalize()
    expect(el.dataset.emptyFinal).toBe('')
    // Unmount-at-finalize was REJECTED (ADR-0187 §Alternatives): a later turn legitimately routes to this
    // same surfaceId through routeLine's known branch (SPEC-R7), so the host must survive.
    expect(el.isConnected).toBe(true)
    expect(el.querySelectorAll('[data-part="surface"]')).toHaveLength(1)
  })

  it('a host that DID render a root never flips the state (no false positive on the working card)', async () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'ok', catalogId: 'agent-ui' } }))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'ok', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    el.finalize()
    await whenFlushed()
    expect(el.dataset.emptyFinal).toBeUndefined()
  })

  it('a LATER ingest clears the state, and the next finalize re-derives it from the real contents', async () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE_ONLY)
    el.finalize()
    expect(el.dataset.emptyFinal).toBe('')

    // The model came back with real content — "the stream is not over" is a property of a line arriving.
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'abandoned', components: [{ id: 'root', component: 'Column', children: [] }] },
      }),
    )
    expect(el.dataset.emptyFinal, 'ingest must retire the terminal verdict on entry').toBeUndefined()

    el.finalize()
    await whenFlushed()
    expect(el.dataset.emptyFinal, 'a surface that now HAS a root must not re-flag').toBeUndefined()
  })

  it('a later ingest that still delivers no components RE-FLAGS at the next finalize', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE_ONLY)
    el.finalize()
    el.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'abandoned', path: '/x', value: 1 } }))
    expect(el.dataset.emptyFinal).toBeUndefined() // cleared on entry, unconditionally
    el.finalize()
    expect(el.dataset.emptyFinal, 'still nothing mounted ⇒ still terminal-empty').toBe('')
  })

  it('a reconnect starts clean — a rebuilt artboard has not finalized anything yet', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE_ONLY)
    el.finalize()
    expect(el.dataset.emptyFinal).toBe('')

    const parent = el.parentElement!
    el.remove()
    expect(el.dataset.emptyFinal, 'disconnect must drop the state with the artboard').toBeUndefined()
    parent.appendChild(el)
    expect(el.dataset.emptyFinal).toBeUndefined()
  })

  it('the state is presentation ONLY — it emits no client message of its own (single-owner, SPEC-N6)', () => {
    // The wire error for this surface comes from the RENDERER's own opted-in finalize (ADR-0187 C3),
    // through the ordinary onClientMessage path. This element must never add a second verdict.
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    const seen: unknown[] = []
    el.onClientMessage((m) => seen.push(m))
    el.ingest(CREATE_ONLY)
    el.finalize()

    expect(el.dataset.emptyFinal).toBe('')
    // Exactly ONE message — the renderer's IDGRAPH verdict — and nothing minted by this element.
    expect(seen).toHaveLength(1)
    expect(JSON.stringify(seen[0])).toContain('abandoned:root-missing')
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

// GH #805 — answered cards disable their inputs. The self-wired mechanism (disable-on-action, re-enable-
// on-ingest) plus the one caller-driven arm this element exposes (`setInteractiveDisabled`, for a failed/
// aborted turn — driven from ui-conversation, proven end to end there).
describe('ui-surface-host — GH #805: answered cards disable their inputs', () => {
  const CREATE = (id: string): string => line({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })

  it('an action click disables EVERY interactive descendant — the fleet\'s whole disabled-bearing set, duck-typed', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('d1'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'd1',
          components: [
            { id: 'root', component: 'Column', children: ['tf', 'cb', 'btn'] },
            { id: 'tf', component: 'TextField', name: 'budget', label: 'Budget' },
            { id: 'cb', component: 'Checkbox', name: 'terms', label: 'I accept' },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    const tf = el.querySelector('ui-text-field') as HTMLElement & { disabled: boolean }
    const cb = el.querySelector('ui-checkbox') as HTMLElement & { disabled: boolean }
    expect(btn.disabled).toBe(false)
    expect(tf.disabled).toBe(false)
    expect(cb.disabled).toBe(false)

    btn.click()
    expect(btn.disabled, 'the clicked control itself').toBe(true)
    expect(tf.disabled, 'a sibling text field').toBe(true)
    expect(cb.disabled, 'a sibling checkbox').toBe(true)
  })

  it('GH #805 repair — a wantResponse:false action (ADR-0088 §3) never disables ANYTHING — a fire-and-forget click has no turn that would ever re-enable it', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))
    el.ingest(CREATE('wr1'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'wr1',
          components: [{ id: 'root', component: 'Button', variant: 'ghost', label: 'Cancel', action: { action: 'cancel', wantResponse: false } }],
        },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    btn.click()
    expect(received).toHaveLength(1) // the client message still fires — only the disable is skipped
    expect(btn.disabled, 'wantResponse:false runs no turn — disabling it would strand it forever').toBe(false)
  })

  it('GH #805 repair — the sweep never claims an element ALREADY disabled for a payload/checks reason, and re-enable never reverts it', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('sw1'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sw1',
          components: [
            { id: 'root', component: 'Column', children: ['cb', 'btn'] },
            // A payload-DECLARED disabled literal (default catalog's own bindable `disabled` row,
            // catalog/default/factories.ts) — never the sweep's to own.
            { id: 'cb', component: 'Checkbox', name: 'terms', label: 'I accept', disabled: true },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    const cb = el.querySelector('ui-checkbox') as HTMLElement & { disabled: boolean }
    expect(cb.disabled, 'the payload-declared literal, unaffected by anything yet').toBe(true)

    btn.click()
    expect(btn.disabled, 'the sweep genuinely claims this one (false→true)').toBe(true)
    expect(cb.disabled, 'already disabled — the sweep leaves it alone, never claims it').toBe(true)

    // The FAIL arm: re-enable only reverts what the sweep itself claimed.
    el.setInteractiveDisabled(false)
    expect(btn.disabled, 'reverted — the sweep DID claim this one').toBe(false)
    expect(cb.disabled, 'a payload-declared disabled control survives disable→fail-re-enable untouched').toBe(true)
  })

  it('GH #805 repair — the sweep-scoped re-enable also holds through ingest()\'s own re-render arm, for a component the resend never touches', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('sw2'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sw2',
          components: [
            { id: 'root', component: 'Column', children: ['cb', 'btn'] },
            { id: 'cb', component: 'Checkbox', name: 'terms', label: 'I accept', disabled: true },
            { id: 'btn', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    const cb = el.querySelector('ui-checkbox') as HTMLElement & { disabled: boolean }
    btn.click()
    expect(btn.disabled).toBe(true)
    expect(cb.disabled).toBe(true)

    // A resend that only touches the Button (a valid, update-only cross-turn payload, GH #63's own
    // precedent) — `cb` is untouched by the rewire; the ingest-entry re-enable sweep must not be the
    // thing that makes it live again through the back door.
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'sw2', components: [{ id: 'btn', component: 'Button', variant: 'solid', label: 'Go again', action: { action: 'go' } }] },
      }),
    )
    expect(btn.disabled, 're-enabled by the update, as ever').toBe(false)
    expect(cb.disabled, "a payload-declared disabled control survives disable→update-re-enable when the resend never touches it").toBe(true)
  })

  it('a SECOND action message never re-queues past the first — the disabled control itself makes it inert (unit-level: disabling twice is idempotent)', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m))
    el.ingest(CREATE('d2'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'd2', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }] },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    btn.click()
    expect(received).toHaveLength(1)
    expect(btn.disabled).toBe(true)
    // jsdom applies no CSS (pointer-events:none is a real-engine-only guarantee — surface-host.browser.
    // test.ts proves the real hit-testing block); this only proves re-disabling an already-disabled
    // control is a harmless no-op, never a crash/double-toggle.
    expect(() => el.setInteractiveDisabled(true)).not.toThrow()
    expect(btn.disabled).toBe(true)
  })

  it('ingest() re-enables unconditionally on entry — a new line for THIS surface comes back live (TKT-0079)', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('d3'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'd3', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }] },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    btn.click()
    expect(btn.disabled).toBe(true)

    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'd3', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go again', action: { action: 'go' } }] },
      }),
    )
    expect(btn.disabled, 're-enabled the moment a new line arrived, before finalize()').toBe(false)
  })

  it('an ask-declared surface that never receives another line stays disabled — setInteractiveDisabled(false) is the ONE way back', () => {
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('d4'))
    el.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'd4', components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }] },
      }),
    )
    const btn = el.querySelector('ui-button') as HTMLElement & { disabled: boolean }
    btn.click()
    expect(btn.disabled).toBe(true)
    el.finalize() // finalize() alone (no new line) never re-enables — matches the "stays disabled as history" law
    expect(btn.disabled).toBe(true)

    el.setInteractiveDisabled(false) // the failed/aborted-turn arm, driven by the app (conversation.ts's fail())
    expect(btn.disabled).toBe(false)
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
  const ATTR_NAMES = ['label', 'wrap', 'bare', 'viewTransitions', 'working'] // 'working': ADR-0199 / GH #1104

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

// ── the viewTransitions opt-in (GH #742/ADR-0183 Amendment) — the re-render grain, jsdom half ─────────
// jsdom ships no startViewTransition, which IS the sync-fallback environment; the transition path is
// proven by stubbing the seam (the router-outlet test's exact pattern). The real-engine proof is
// surface-host.browser.test.ts's.

describe('ui-surface-host — viewTransitions wraps RE-RENDERS only (GH #742/ADR-0183 Amendment)', () => {
  const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown }
  afterEach(() => {
    delete doc.startViewTransition
  })

  const CREATE = (id: string): string => line({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: 'agent-ui' } })
  const ROOT = (id: string, label: string): string =>
    line({
      version: 'v1.0',
      updateComponents: {
        surfaceId: id,
        components: [
          { id: 'root', component: 'Column', children: ['t1'] },
          { id: 't1', component: 'Text', text: label },
        ],
      },
    })

  it('default off: a full stream + a post-settle re-render never touch the API even when present', () => {
    let transitions = 0
    doc.startViewTransition = () => {
      transitions++
    }
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.ingest(CREATE('vt-a'))
    el.ingest(ROOT('vt-a', 'first'))
    el.finalize()
    el.ingest(ROOT('vt-a', 'second')) // a re-render — still unwrapped without the opt-in
    el.finalize()
    expect(transitions).toBe(0)
    expect(el.textContent).toContain('second')
  })

  it('opted in: FIRST-PAINT streaming stays synchronous — no API touch before the first finalize()', () => {
    let transitions = 0
    doc.startViewTransition = () => {
      transitions++
    }
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.viewTransitions = true
    el.ingest(CREATE('vt-b'))
    el.ingest(ROOT('vt-b', 'painted'))
    expect(transitions, 'progressive first paint never transitions').toBe(0)
    expect(el.textContent, 'and it painted synchronously').toContain('painted')
    el.finalize() // the FIRST finalize runs sync too (nothing queued before it, by construction)
    expect(transitions).toBe(0)
  })

  it('opted in + settled: a re-render line AND its finalize both route THROUGH the transition, in FIFO order', () => {
    const queued: Array<() => void> = []
    doc.startViewTransition = (cb: () => void) => {
      queued.push(cb)
    }
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.viewTransitions = true
    el.ingest(CREATE('vt-c'))
    el.ingest(ROOT('vt-c', 'first'))
    el.finalize() // settles — sync (asserted above)
    el.ingest(ROOT('vt-c', 'second'))
    el.finalize()
    expect(queued, 'the re-render line + its finalize both queued').toHaveLength(2)
    expect(el.textContent, 'nothing applied yet — the platform owns when').toContain('first')
    for (const cb of queued) cb() // the platform runs the update callbacks in order
    expect(el.textContent).toContain('second')
  })

  it('a disconnect between queue and run is survived — the staleness re-check inside the mutate', () => {
    const queued: Array<() => void> = []
    doc.startViewTransition = (cb: () => void) => {
      queued.push(cb)
    }
    const el = mount(document.createElement('ui-surface-host') as UISurfaceHostElement)
    el.viewTransitions = true
    el.ingest(CREATE('vt-d'))
    el.finalize()
    el.ingest(ROOT('vt-d', 'late'))
    el.remove() // nulls #host/#surface + resets the settled flag
    expect(() => {
      for (const cb of queued) cb()
    }, 'the queued mutate no-ops on a dead host, never throws').not.toThrow()
  })

  it('disconnect resets the settled flag — a rebuilt artboard streams its first paint unwrapped again', () => {
    let transitions = 0
    doc.startViewTransition = () => {
      transitions++
    }
    const el = document.createElement('ui-surface-host') as UISurfaceHostElement
    el.viewTransitions = true
    mount(el)
    el.ingest(CREATE('vt-e'))
    el.finalize() // settled
    el.remove()
    mount(el) // fresh artboard (the reconnect-rebuild contract above)
    el.ingest(CREATE('vt-e2'))
    el.ingest(ROOT('vt-e2', 'fresh paint'))
    expect(transitions, 'the rebuilt host is un-settled — first paint stays sync').toBe(0)
    expect(el.textContent).toContain('fresh paint')
  })
})

// ── ADR-0199 / GH #1104 — the working/live-mutation state ────────────────────────────────────────

describe('ui-surface-host — `working` prop → :state(working) mirror (ADR-0199)', () => {
  // The protected-internals probe subclass (the split.test.ts/drill.test.ts idiom) — jsdom may lack
  // CustomStateSet, so the states assertion is capability-gated (`?.`); the NON-VACUOUS floor below is
  // the reflected attribute (always assertable under jsdom), and the real :state() selector proof is
  // surface-host-working.browser.test.ts's (the jsdom-vacuity lesson).
  class ProbeSurfaceHost extends UISurfaceHostElement {
    get probeInternals(): ElementInternals {
      return this.internals
    }
  }
  if (!customElements.get('zz-probe-surface-host')) customElements.define('zz-probe-surface-host', ProbeSurfaceHost)

  it('`working` defaults to false and reflects to the attribute', async () => {
    const el = mount(document.createElement('zz-probe-surface-host') as ProbeSurfaceHost)
    expect(el.working).toBe(false)
    expect(el.hasAttribute('working')).toBe(false)
    el.working = true
    await whenFlushed()
    expect(el.hasAttribute('working'), 'non-vacuous floor: the reflected attribute').toBe(true)
    el.working = false
    await whenFlushed()
    expect(el.hasAttribute('working')).toBe(false)
  })

  it('mirrors the prop into internals.states (capability-gated; browser leg carries the real-engine proof)', async () => {
    const el = mount(document.createElement('zz-probe-surface-host') as ProbeSurfaceHost)
    el.working = true
    await whenFlushed()
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('working')).toBe(true)
    }
    el.working = false
    await whenFlushed()
    if (el.probeInternals.states) {
      expect(el.probeInternals.states.has('working')).toBe(false)
    }
  })
})

describe('surface-host.css — the :state(working) breathing block (ADR-0199 pin-tests)', () => {
  it('routes ALL five fleet constants + the easing through the --ui-surface-host-working-* chain (TKT-0066)', () => {
    expect(css).toMatch(/--ui-surface-host-working-duration:\s*var\(--ui-working-duration\)/)
    expect(css).toMatch(/--ui-surface-host-working-opacity-min:\s*var\(--ui-working-opacity-min\)/)
    expect(css).toMatch(/--ui-surface-host-working-opacity-max:\s*var\(--ui-working-opacity-max\)/)
    expect(css).toMatch(/--ui-surface-host-working-blur:\s*var\(--ui-working-blur\)/)
    expect(css).toMatch(/--ui-surface-host-working-color:\s*var\(--ui-working-color\)/)
    expect(css).toMatch(/--ui-surface-host-working-easing:\s*var\(--md-sys-motion-easing-standard\)/)
    // GH 1104 refinement — the overlay's rounded-card radius rides the fleet shape chain, never a bare literal.
    expect(css).toMatch(/--ui-surface-host-working-radius:\s*var\(--md-sys-shape-corner-base, 12px\)/)
  })

  it("the working rule is a ::before overlay (never ::after — ADR-0187 owns the surface ::after channel) with :not() precedence guards", () => {
    const m = /:scope:state\(working\):not\(:state\(disabled\)\):not\(:state\(pending\)\)\s*\[data-part='surface'\]::before\s*\{([^}]*)\}/.exec(css)
    expect(m, 'no guarded :state(working) ::before rule found').not.toBeNull()
    const rule = m?.[1] ?? ''
    expect(rule).toMatch(/box-shadow:\s*inset 0 0 var\(--ui-surface-host-working-blur\) var\(--ui-surface-host-working-color\)/)
    expect(rule).toMatch(/pointer-events:\s*none/)
    expect(rule).toMatch(/animation:\s*ui-surface-host-breathe/)
    expect(rule).toMatch(/infinite alternate/)
    // GH 1104 refinement — the overlay follows the ROUNDED card geometry via its own token
    // (`inherit` resolved to 0 on the radius-less surface part — the square-sheen defect).
    expect(rule).toMatch(/border-radius:\s*var\(--ui-surface-host-working-radius\)/)
    expect(rule).not.toMatch(/border-radius:\s*inherit/)
  })

  it('the breathe keyframes animate OPACITY ONLY between the two rungs (compositor-only — no geometry, no `all`, never box-shadow itself)', () => {
    const m = /@keyframes ui-surface-host-breathe\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(m, 'no ui-surface-host-breathe keyframes found').not.toBeNull()
    const body = m?.[1] ?? ''
    expect(body).toMatch(/opacity:\s*var\(--ui-surface-host-working-opacity-min\)/)
    expect(body).toMatch(/opacity:\s*var\(--ui-surface-host-working-opacity-max\)/)
    // opacity is the ONLY animated property — the §4[a]/ADR-0095 compositor-only shape.
    const properties = [...body.matchAll(/^\s*([a-z-]+):/gm)].map((p) => p[1])
    expect(properties.length, 'anti-vacuous: keyframes declare properties').toBeGreaterThan(0)
    expect(properties.every((p) => p === 'opacity'), `non-opacity property in keyframes: ${properties.join(', ')}`).toBe(true)
  })

  it('reduced motion ⇒ STATIC, never nothing: animation off, overlay held at the MAX rung (ADR-0199 cl.3)', () => {
    const media = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n  \}/.exec(css)
    expect(media, 'no prefers-reduced-motion block found').not.toBeNull()
    const block = media?.[1] ?? ''
    expect(block).toMatch(/:scope:state\(working\)/)
    expect(block).toMatch(/animation:\s*none/)
    expect(block).toMatch(/opacity:\s*var\(--ui-surface-host-working-opacity-max\)/)
    expect(block).not.toMatch(/display:\s*none/)
  })
})
