import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { whenFlushed, UIFormElement, prop } from '@agent-ui/components'
import type { FormValue, ValidityResult, PropsSchema, ReactiveProps } from '@agent-ui/components'
import { UIButtonElement, UISelectElement } from '@agent-ui/components/components'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'
import type { A2uiAction, A2uiActionMessage } from './action.ts'
import type { A2uiErrorMessage } from './renderer.ts'
import type { A2uiFunctionResponseMessage, A2uiServerMessage } from '../protocol.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { catalogFunctions } from '../catalog/functions.ts'
import type { WidgetFactory } from '../catalog/types.ts'

// The A1 integration proof (renderer LLD-C13): a STREAMED, multi-message JSONL fixture is fed line by
// line into the host and must render into REAL `ui-*` controls under the mount — the nine wave-1 modules
// wired together. Deterministic id/clock providers are injected so the action round-trip asserts exact
// shapes (the scripts ban ambient `Date.now()`/`Math.random()` in logic; the host's default edge
// providers are swapped for fakes here).

const line = (message: A2uiServerMessage): string => JSON.stringify(message)
const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m
const isError = (m: A2uiClientMessage): m is A2uiErrorMessage => 'error' in m
const isFunctionResponse = (m: A2uiClientMessage): m is A2uiFunctionResponseMessage => 'functionResponse' in m

/** A host wired to a capturing client-message sink + a real mount in the document. */
function harness(): { r: RendererHost; mount: HTMLElement; sent: A2uiClientMessage[]; cleanup: () => void } {
  const sent: A2uiClientMessage[] = []
  let n = 0
  const r = createRenderer({ newId: () => `act-${++n}`, now: () => '2026-06-27T00:00:00.000Z' })
  r.onClientMessage((m) => void sent.push(m))
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  r.mount(mount)
  return { r, mount, sent, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('renderer host — streamed render of the default catalog (renderer LLD-C13, the A1 proof)', () => {
  it('streams createSurface + updateComponents into a real ui-button and round-trips a click action', async () => {
    const { r, mount, sent, cleanup } = harness()

    // Two lines, fed separately (the streamed shape the wave-4 canvas produces).
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Button', variant: 'soft', label: 'Click me', action: { action: 'submit' } }],
        },
      }),
    )

    // A REAL, upgraded control rendered into the mount — not an inert HTMLUnknownElement.
    const btn = mount.querySelector('ui-button')
    expect(btn).toBeInstanceOf(UIButtonElement)
    expect(mount.firstElementChild).toBe(btn) // the root is attached under the mount

    await whenFlushed() // let any reflect/render effects settle
    expect((btn as UIButtonElement).variant).toBe('soft') // static prop applied
    expect(btn!.textContent).toBe('Click me') // label → textContent
    expect(btn!.hasAttribute('action')).toBe(false) // the action object was NOT stringified onto the DOM

    expect(sent.filter(isError)).toEqual([]) // 0 errors at all — and so 0 CATALOG

    // Round-trip: a click emits exactly one action client-message with the resolved fields.
    ;(btn as HTMLElement).click()
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.version).toBe('v1.0')
    expect(actions[0]!.action).toMatchObject({
      surfaceId: 's1',
      actionId: 'act-1', // from the injected id provider
      name: 'submit', // from the action prop
      sourceComponentId: 'root', // node.id
      timestamp: '2026-06-27T00:00:00.000Z', // from the injected clock
    })

    // The COMPLETE, valid set finalizes clean — no false-positive IDGRAPH (ADR-0002).
    r.finalize()
    expect(sent.filter(isError)).toEqual([])

    cleanup()
  })

  it('an unknown component type yields a placeholder + one CATALOG error while siblings still render (SPEC-R9 AC2)', () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's2',
          components: [
            { id: 'root', component: 'Button', label: 'Parent', children: ['known', 'unknown'] },
            { id: 'known', component: 'Button', label: 'Known' },
            { id: 'unknown', component: 'Doohickey', label: 'Nope' },
          ],
        },
      }),
    )

    // Both Button nodes resolved to real controls; the unknown type is a non-fatal placeholder.
    expect(mount.querySelectorAll('ui-button')).toHaveLength(2)
    const placeholder = mount.querySelector('a2ui-placeholder')
    expect(placeholder).not.toBeNull()
    expect(placeholder!.getAttribute('data-component')).toBe('Doohickey')

    // ADR-0031: CATALOG (internal) maps to VALIDATION_FAILED on the wire; path folded into message.
    const catalogErrors = sent.filter(isError).filter((m) => m.error.code === 'VALIDATION_FAILED')
    expect(catalogErrors).toHaveLength(1)
    expect(catalogErrors[0]!.error).toMatchObject({ code: 'VALIDATION_FAILED', surfaceId: 's2' })
    expect(catalogErrors[0]!.error.message).toContain('unknown') // node.id 'unknown' folded into message
    expect(catalogErrors[0]!.error).not.toHaveProperty('path') // v1.0 wire shape: no path field

    cleanup()
  })
})

describe('renderer host — stream faults + lifecycle (renderer LLD §9, SPEC-N3/N4)', () => {
  it('a malformed line emits error{PARSE} and the stream continues (N4)', () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest('{ not json')
    r.ingest('   ') // blank line is skipped — no spurious PARSE
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's3', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's3', components: [{ id: 'root', component: 'Button', label: 'OK' }] } }))

    // ADR-0031: PARSE (internal) maps to VALIDATION_FAILED on the wire. Exactly one — blank line skipped.
    const parseErrors = sent.filter(isError).filter((m) => m.error.code === 'VALIDATION_FAILED')
    expect(parseErrors).toHaveLength(1)
    expect(parseErrors[0]!.error).not.toHaveProperty('path') // no path on the wire (PARSE has no locus)
    expect(mount.querySelector('ui-button')).toBeInstanceOf(UIButtonElement) // the later valid surface still rendered

    cleanup()
  })

  it('createSurface with an unregistered catalogId emits CATALOG_UNKNOWN and creates no surface (R2 AC3)', () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's4', catalogId: 'no-such-catalog' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's4', components: [{ id: 'root', component: 'Button' }] } }))

    // ADR-0031: CATALOG_UNKNOWN (internal) maps to VALIDATION_FAILED on the wire.
    expect(sent.filter(isError).map((m) => m.error.code)).toEqual(['VALIDATION_FAILED'])
    expect(mount.querySelector('ui-button')).toBeNull() // no surface ⇒ nothing rendered

    cleanup()
  })

  it('finalize catches a missing root on the complete set — and it was NOT falsely raised in-stream (ADR-0002)', () => {
    const { r, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's5', catalogId: 'agent-ui' } }))
    // A rootless component set is a legal transient mid-stream — no IDGRAPH yet.
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's5', components: [{ id: 'leaf', component: 'Button', label: 'x' }] } }))
    expect(sent.filter(isError)).toEqual([]) // per-message validation would have false-positived here

    r.finalize() // now judge the COMPLETE set
    // ADR-0031: IDGRAPH (internal) maps to VALIDATION_FAILED on the wire + surfaceId; no path field.
    const idgraph = sent.filter(isError).filter((m) => m.error.code === 'VALIDATION_FAILED')
    expect(idgraph).toHaveLength(1)
    expect(idgraph[0]!.error).toMatchObject({ code: 'VALIDATION_FAILED', surfaceId: 's5' })
    expect(idgraph[0]!.error.message).toContain('s5:root-missing') // path locus folded into message
    expect(idgraph[0]!.error).not.toHaveProperty('path')

    cleanup()
  })

  it('ADR-0031: FUNCTION (checks unknown fn) → VALIDATION_FAILED on the wire + surfaceId (corrected mapping)', async () => {
    // The FUNCTION wire-emit proof (corrected flow grounding, ADR-0031 clause 2): a Button node with a
    // `checks` entry calling an unknown catalog function causes the checks controller to emit a FUNCTION
    // INTERNAL error. toWireError maps ALL 8 codes → VALIDATION_FAILED + surfaceId this wave — our
    // FUNCTION emits are render-time binding-eval failures (unknown/throwing fn in a binding), not
    // server-initiated calls. Button is used (not TextField) because UIFormElement.setFormValue is
    // not in jsdom; Button has `disabled` as the checks controller's auto-disable target (ADR-0029 §7).
    const { r, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's7', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's7',
          components: [
            {
              id: 'root',
              component: 'Button',
              label: 'Go',
              // `checks` with an unknown catalog function → evaluate emits FUNCTION (internal) →
              // toWireError → VALIDATION_FAILED + surfaceId on the wire (ADR-0031 corrected mapping)
              checks: [{ call: 'no-such-function', message: 'invalid' }],
            },
          ],
        },
      }),
    )
    await whenFlushed() // let the checks effect run and emit the FUNCTION error

    const fnErrors = sent.filter(isError).filter((m) => m.error.code === 'VALIDATION_FAILED')
    expect(fnErrors.length).toBeGreaterThan(0) // at least one VALIDATION_FAILED emitted
    const wire = fnErrors[0]!.error
    expect(wire.code).toBe('VALIDATION_FAILED')
    expect((wire as { surfaceId?: string }).surfaceId).toBe('s7') // surfaceId always available
    expect(wire).not.toHaveProperty('path') // v1.0 wire shape: no path field
    expect(wire).not.toHaveProperty('functionCallId') // VALIDATION_FAILED excludes functionCallId (XOR)
    expect(wire.message).toContain('no-such-function') // message carries the detail

    cleanup()
  })

  it('deleteSurface detaches the root and disposes the surface; later messages for it are a no-op', () => {
    const { r, mount, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's6', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's6', components: [{ id: 'root', component: 'Button', label: 'bye' }] } }))
    expect(mount.querySelector('ui-button')).toBeInstanceOf(UIButtonElement)

    r.ingest(line({ version: 'v1.0', deleteSurface: { surfaceId: 's6' } }))
    expect(mount.querySelector('ui-button')).toBeNull() // root detached

    // A late updateComponents for the deleted surface renders nothing (no throw).
    expect(() =>
      r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's6', components: [{ id: 'root', component: 'Button' }] } })),
    ).not.toThrow()
    expect(mount.querySelector('ui-button')).toBeNull()

    cleanup()
  })
})

// ADR-0011 pins the canonical inbound action-prop shape `{ action, context?, wantResponse? }` (the
// `readActionSpec` consumer), keeping the lenient `name`-synonym + bare-string fallbacks as documented
// Postel's-law tolerance. These exercise that contract end-to-end: a Button's `action` prop → the
// emitted client action — asserting the canonical path surfaces `context`/`wantResponse` and that the
// fallbacks still resolve a name.
describe('renderer host — action-prop reading (ADR-0011 canonical {action,context?,wantResponse?})', () => {
  /** Render one Button with the given `action` prop, click it, and return the single emitted action body. */
  function emitFor(action: unknown): A2uiAction {
    const { r, mount, sent, cleanup } = harness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sa', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'sa', components: [{ id: 'root', component: 'Button', label: 'Go', action }] },
      }),
    )
    ;(mount.querySelector('ui-button') as HTMLElement).click()
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    cleanup()
    return actions[0]!.action
  }

  it('reads the CANONICAL shape — `action` is the name, with `context` + `wantResponse` surfaced', () => {
    const action = emitFor({ action: 'submit', context: { topic: 'orders' }, wantResponse: true })
    expect(action.name).toBe('submit') // canonical `action` key → action name
    expect(action.context).toEqual({ topic: 'orders' }) // context surfaced off the canonical object
    expect(action.wantResponse).toBe(true) // wantResponse surfaced off the canonical object
  })

  it('canonical `action` wins over the `name` synonym when both are present', () => {
    const action = emitFor({ action: 'submit', name: 'cancel' })
    expect(action.name).toBe('submit')
  })

  it('keeps the lenient `name`-synonym fallback (Postel)', () => {
    const action = emitFor({ name: 'cancel', context: { from: 'name-shape' } })
    expect(action.name).toBe('cancel') // `name` accepted as the tolerated synonym
    expect(action.context).toEqual({ from: 'name-shape' })
  })

  it('keeps the lenient bare-string fallback (Postel)', () => {
    const action = emitFor('refresh')
    expect(action.name).toBe('refresh') // a bare string is taken as the action name
    expect(action.context).toEqual({}) // …carrying no context
    // ADR-0088 §3: no `wantResponse` was authored, so it must stay ABSENT on the wire — never coerced to
    // an explicit `false` (which the page's wantResponse-routing would read as an opt-out).
    expect('wantResponse' in action).toBe(false)
  })

  it('an explicit `wantResponse:false` on the canonical shape is preserved, distinct from absent (ADR-0088 §3)', () => {
    const action = emitFor({ action: 'submit', wantResponse: false })
    expect(action.wantResponse).toBe(false)
  })
})

// Per-item action-listener leak (ADR-0024 amendment 3). Each list item's Button registers its click→action
// listener on a per-item AbortController (list.ts `appendInstance` → renderer.ts `#wireAction`). When the
// item is removed (`removeLast` aborts that ac), the listener is torn down immediately so no click on the
// detached element ever reaches `ActionDispatcher`. Two proofs: (1) basic — shrink by 1, click trailing
// button → 0 actions; (2) churn ×3 — accumulate ALL removed buttons across 3 grow/shrink cycles, click
// every collected button → 0 actions total (ensures no accumulation with repeated churn).
describe('renderer host — per-item action-listener no-leak proof (ADR-0024 amendment 3, SPEC-N3)', () => {
  // A Column root whose `children` is a v1.0 positional list template over `/rows`. Each item is a
  // Button with `action:{action:'go'}` — the default catalog wires a click→action listener per item.
  const listComponents = [
    { id: 'root', component: 'Column', children: { path: '/rows', componentId: 'rowTpl' } },
    { id: 'rowTpl', component: 'Button', label: 'Row', action: { action: 'go' } },
  ] as const

  it('clicking a removed Button list item emits no action — per-item ac aborted on removal (SPEC-N3)', async () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sl', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 'sl', components: [...listComponents] } }))

    // Populate 3 rows — the reconcile effect fires on the next flush.
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sl', path: '/rows', value: [{}, {}, {}] } }))
    await whenFlushed()

    const btns = [...mount.querySelectorAll('ui-button')] as HTMLElement[]
    expect(btns).toHaveLength(3)
    const btn2 = btns[2]! // the trailing instance (index 2)

    // NON-VACUOUS: btn2 is live before removal — click WOULD emit an action without removal.
    btn2.click()
    expect(sent.filter(isAction)).toHaveLength(1)
    sent.length = 0 // reset; from here we assert 0 actions on the detached button

    // Shrink to 2 — btn2's per-item ac is aborted, its click listener removed.
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sl', path: '/rows', value: [{}, {}] } }))
    await whenFlushed()
    expect(btn2.isConnected).toBe(false) // btn2 is detached

    // A click on the detached btn2 is now inert — no action emitted (SPEC-N3 item-granular).
    btn2.click()
    expect(sent.filter(isAction)).toHaveLength(0)

    cleanup()
  })

  it('churn x3: clicking ALL removed buttons across 3 grow/shrink cycles emits no action', async () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'slc', catalogId: 'agent-ui' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 'slc', components: [...listComponents] } }))

    const removed: HTMLElement[] = []

    for (let cycle = 0; cycle < 3; cycle++) {
      // Grow to 3 rows
      r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'slc', path: '/rows', value: [{}, {}, {}] } }))
      await whenFlushed()
      const btns = [...mount.querySelectorAll('ui-button')] as HTMLElement[]
      expect(btns).toHaveLength(3)

      // Shrink to 0 — all 3 instances removed, their per-item acs aborted.
      r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'slc', path: '/rows', value: [] } }))
      await whenFlushed()
      expect(mount.querySelectorAll('ui-button')).toHaveLength(0)

      removed.push(...btns) // accumulate all removed buttons from this cycle
    }

    // Click every button collected across all 3 cycles — none should emit an action.
    expect(removed).toHaveLength(9) // 3 cycles × 3 buttons
    for (const btn of removed) btn.click()
    expect(sent.filter(isAction)).toHaveLength(0)

    cleanup()
  })
})

// The binding wiring proof (renderer LLD-C5, the B2 integration): a unit test on binding.ts can show the
// resolver memoizes per-path computeds, but only this can show the LIVE host wires `resolveBinding →
// resolve` AND routes `updateDataModel` through `binding.setPointer` end-to-end — a `{path}`-bound prop
// reflecting the data model and re-applying when that path is written. (Per-path waking GRANULARITY is
// binding.test.ts's job; here we prove the host actually drives the bound prop through the binding module.)
describe('renderer host — bound prop end-to-end (renderer LLD-C5, the B2 wiring proof)', () => {
  it('a {path}-bound label resolves off the data model and updates on updateDataModel', async () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sb', catalogId: 'agent-ui' } }))
    // `label` is a `{path}` binding (catalog Button.label is bindable, mapsTo textContent), not a literal.
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: { surfaceId: 'sb', components: [{ id: 'root', component: 'Button', label: { path: '/greeting' } }] },
      }),
    )

    const btn = mount.querySelector('ui-button')
    expect(btn).toBeInstanceOf(UIButtonElement)

    // Data arrives AFTER mount: the bound-prop effect (which started on a placeholder undefined path,
    // SPEC-R4 AC2) wakes through the host's setPointer write and the resolve read.
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sb', path: '/greeting', value: 'Hello' } }))
    await whenFlushed()
    expect(btn!.textContent).toBe('Hello') // resolveBinding → resolve → the bound path's value

    // A second write to the same path re-applies the prop — the live per-path computed updates.
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sb', path: '/greeting', value: 'Goodbye' } }))
    await whenFlushed()
    expect(btn!.textContent).toBe('Goodbye')

    expect(sent.filter(isError)).toEqual([]) // no PARSE/CATALOG/IDGRAPH along the way

    cleanup()
  })
})

// ── SPEC-R14 / ADR-0034 (+ amendment): callFunction RPC round-trip (LLD-C14) ─────────────────────────
//
// The server-initiated function-call surface: an inbound `callFunction` envelope → `handleCallFunction`
// in call-function.ts → emits `functionResponse` (success) or `error{INVALID_FUNCTION_CALL}` (reject).
// MESSAGE-LEVEL (no DOM, no signals) — jsdom suffices. AC1-AC7 from ADR-0034 + the amendment.
//
// Fixture function: `getScreenResolution` — declared ONLY in the fixture catalog (not in agent-ui),
// so no cross-catalog `clientOnly` collision occurs on the happy path (most-restrictive-wins does
// not fire when only one catalog declares the function). Impl added to `catalogFunctions` in
// beforeAll/afterAll (the `thrower` pattern from functions.test.ts — scoped, no state leak).
describe('renderer host — callFunction RPC (SPEC-R14 / ADR-0034 + amendment / LLD-C14)', () => {
  // Fixture function return value — simple, deterministic.
  const SCREEN_RES = { width: 1920, height: 1080 }

  beforeAll(() => {
    // Add the fixture impl to the shared catalogFunctions table. Removed in afterAll.
    // Key is non-colliding with any default catalog function (required/email/regex).
    ;(catalogFunctions as Record<string, unknown>)['getScreenResolution'] = () => SCREEN_RES
  })
  afterAll(() => {
    delete (catalogFunctions as Record<string, unknown>)['getScreenResolution']
  })

  // Fixture catalog A: declares getScreenResolution as clientOrRemote (the server-invocable fixture).
  // Non-colliding: this name is not in agent-ui, so most-restrictive-wins has no clientOnly to trigger.
  const FIXTURE_CALLABLE = {
    catalogId: 'fixture-callable',
    protocolVersion: 'v1.0',
    components: { Text: { properties: { text: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' } } } },
    functions: { getScreenResolution: { callableFrom: 'clientOrRemote', args: {}, returns: { type: 'object' } } },
  }

  // Fixture catalog B: declares the same function as clientOnly (for AC7 hard-floor test).
  const FIXTURE_GUARDED = {
    catalogId: 'fixture-guarded',
    protocolVersion: 'v1.0',
    components: { Text: { properties: { text: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' } } } },
    functions: { getScreenResolution: { callableFrom: 'clientOnly', args: {}, returns: { type: 'object' } } },
  }

  /** Harness + the callable fixture catalog registered. */
  function rpcHarness() {
    const h = harness()
    h.r.register(FIXTURE_CALLABLE, { Text: defaultFactories.Text })
    return h
  }

  it('AC1 — happy path: non-colliding clientOrRemote function + wantResponse:true → functionResponse{functionCallId,call,value}', () => {
    const { r, sent, cleanup } = rpcHarness()

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc1',
      wantResponse: true,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)

    const responses = sent.filter(isFunctionResponse)
    expect(responses).toHaveLength(1)
    expect(responses[0]!.functionResponse).toMatchObject({
      functionCallId: 'fc1', // verbatim copy (SPEC-R14 fact 2)
      call: 'getScreenResolution',
      value: SCREEN_RES,
    })
    expect(sent.filter(isError)).toEqual([]) // no error on success

    cleanup()
  })

  it('AC2 — reject clientOnly: default catalog\'s required is clientOnly → INVALID_FUNCTION_CALL, no invoke, surfaceId ABSENT', () => {
    // Default catalog only (no fixture). required is clientOnly → most-restrictive-wins → reject.
    const { r, sent, cleanup } = harness()

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc2',
      wantResponse: true,
      callFunction: { call: 'required', args: { value: '' } },
    } as unknown as A2uiServerMessage)

    const errors = sent.filter(isError)
    expect(errors).toHaveLength(1)
    const wire = errors[0]!.error
    expect(wire.code).toBe('INVALID_FUNCTION_CALL')
    expect(wire).toHaveProperty('functionCallId', 'fc2')
    expect(wire).not.toHaveProperty('surfaceId') // surfaceId EXCLUDED (ADR-0034 clause 1 / ADR-0031)
    expect(wire.message).toContain('clientOnly')
    expect(sent.filter(isFunctionResponse)).toEqual([]) // no functionResponse on reject

    cleanup()
  })

  it('AC3 — reject unregistered: unknown function name → INVALID_FUNCTION_CALL; @index (system fn) also rejects', () => {
    const { r, sent, cleanup } = harness()

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc3',
      wantResponse: true,
      callFunction: { call: 'no-such-function' },
    } as unknown as A2uiServerMessage)

    const e1 = sent.filter(isError)
    expect(e1).toHaveLength(1)
    expect(e1[0]!.error.code).toBe('INVALID_FUNCTION_CALL')
    expect(e1[0]!.error).toHaveProperty('functionCallId', 'fc3')

    // @index is a SYSTEM binding-helper — not a catalog function → unregistered → rejected
    const { r: r2, sent: sent2, cleanup: cleanup2 } = harness()
    r2.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc3b',
      wantResponse: true,
      callFunction: { call: '@index' },
    } as unknown as A2uiServerMessage)
    const e2 = sent2.filter(isError)
    expect(e2).toHaveLength(1)
    expect(e2[0]!.error.code).toBe('INVALID_FUNCTION_CALL')

    cleanup(); cleanup2()
  })

  it('AC4 — wantResponse:false/absent → no functionResponse (fire-and-forget); functionCallId copied verbatim on reject', () => {
    const { r, sent, cleanup } = rpcHarness()

    // wantResponse:false → fire-and-forget (ADR-0034 fork 4)
    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc4',
      wantResponse: false,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)
    expect(sent.filter(isFunctionResponse)).toHaveLength(0)
    expect(sent.filter(isError)).toHaveLength(0)

    // wantResponse absent → also fire-and-forget
    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc4b',
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)
    expect(sent.filter(isFunctionResponse)).toHaveLength(0)

    // functionCallId verbatim on a reject
    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc4-reject',
      callFunction: { call: 'no-such' },
    } as unknown as A2uiServerMessage)
    expect(sent.filter(isError)[0]!.error).toHaveProperty('functionCallId', 'fc4-reject')

    cleanup()
  })

  it('AC5 — two surfaces distinct: clientOnly required/email/regex still evaluate in checks/bindings (ADR-0026/0029 no regression)', async () => {
    // `callableFrom` is read ONLY by call-function.ts (the server-invoke path). The binding-eval
    // path (functions.ts + checks.ts, ADR-0026/0029) ignores it — `required`/`email`/`regex` remain
    // usable in `checks` even though they are `clientOnly` for server invocation (ADR-0034 fact 6).
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sc5', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sc5',
          components: [{
            id: 'root',
            component: 'Button',
            label: 'Go',
            checks: [{ call: 'required', args: { value: { path: '/val' } }, message: 'Required' }],
          }],
        },
      }),
    )
    await whenFlushed()

    const btn = mount.querySelector('ui-button') as UIButtonElement
    expect(btn).toBeInstanceOf(UIButtonElement)
    expect(btn.disabled).toBe(true) // required({ value: undefined }) → invalid

    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sc5', path: '/val', value: 'Ada' } }))
    await whenFlushed()
    expect(btn.disabled).toBe(false) // required({ value: 'Ada' }) → valid

    // Binding-eval path never emits INVALID_FUNCTION_CALL (ADR-0031 maps all 8 internal codes
    // through toWireError → VALIDATION_FAILED; INVALID_FUNCTION_CALL is the server-invoke path only)
    expect(sent.filter(isError).filter(e => e.error.code === 'INVALID_FUNCTION_CALL')).toHaveLength(0)

    cleanup()
  })

  it('AC6 — throwing impl → INVALID_FUNCTION_CALL + functionCallId, renderer intact (ADR-0034 fork 5 / SPEC-N4)', () => {
    const { r, sent, cleanup } = rpcHarness()

    // Spy on the fixture impl to throw once (fork 5: spec-silent; INVALID_FUNCTION_CALL is the
    // nearest conformant code — carries functionCallId, non-fatal, ADR-0034 fork 5).
    const spy = vi.spyOn(catalogFunctions, 'getScreenResolution' as keyof typeof catalogFunctions).mockImplementationOnce(() => {
      throw new Error('unexpected server-side error')
    })

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc6',
      wantResponse: true,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)
    spy.mockRestore()

    const errors = sent.filter(isError)
    expect(errors).toHaveLength(1)
    const wire = errors[0]!.error
    expect(wire.code).toBe('INVALID_FUNCTION_CALL')
    expect(wire).toHaveProperty('functionCallId', 'fc6')
    expect(wire.message).toContain('unexpected server-side error')

    // Non-fatal: renderer intact — subsequent call still works
    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc6-ok',
      wantResponse: true,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)
    expect(sent.filter(isFunctionResponse)).toHaveLength(1)

    cleanup()
  })

  it('AC7 — hard-floor positive control: clientOnly in ANY active catalog → reject, impl NOT invoked, ORDER-INDEPENDENT (ADR-0034 amendment)', () => {
    // Two catalogs: CALLABLE (clientOrRemote) + GUARDED (clientOnly) for the same function name.
    // most-restrictive-wins: clientOnly is a hard floor — INVALID_FUNCTION_CALL regardless of
    // registration order. A permissive sibling does NOT loosen the guard.
    const spyImpl = vi.spyOn(catalogFunctions, 'getScreenResolution' as keyof typeof catalogFunctions)

    // Order 1: CALLABLE first, GUARDED second
    const { r: r1, sent: s1, cleanup: c1 } = harness()
    r1.register(FIXTURE_CALLABLE, { Text: defaultFactories.Text })
    r1.register(FIXTURE_GUARDED, { Text: defaultFactories.Text })
    r1.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc7a',
      wantResponse: true,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)

    expect(s1.filter(isError)).toHaveLength(1)
    expect(s1.filter(isError)[0]!.error.code).toBe('INVALID_FUNCTION_CALL')
    expect(s1.filter(isFunctionResponse)).toHaveLength(0) // no functionResponse on reject

    // Order 2: GUARDED first, CALLABLE second — same verdict (order-independence)
    const { r: r2, sent: s2, cleanup: c2 } = harness()
    r2.register(FIXTURE_GUARDED, { Text: defaultFactories.Text })
    r2.register(FIXTURE_CALLABLE, { Text: defaultFactories.Text })
    r2.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc7b',
      wantResponse: true,
      callFunction: { call: 'getScreenResolution', args: {} },
    } as unknown as A2uiServerMessage)

    expect(s2.filter(isError)).toHaveLength(1)
    expect(s2.filter(isError)[0]!.error.code).toBe('INVALID_FUNCTION_CALL')
    expect(s2.filter(isFunctionResponse)).toHaveLength(0)

    // The impl was NEVER invoked (rejected before invoke in both orders)
    expect(spyImpl).not.toHaveBeenCalled()
    spyImpl.mockRestore()

    c1(); c2()
  })

  // ── ping: default catalog integration (ADR-0034, no fixture needed) ───────────────────────────
  // `ping` is declared `callableFrom:clientOrRemote` in the agent-ui default catalog and has an
  // impl in `catalogFunctions`. These tests use `harness()` (default catalog only — no fixture).

  it('ping — happy path: default catalog clientOrRemote + wantResponse:true → functionResponse{value:true}', () => {
    // `harness()` registers the default catalog (which now includes ping:clientOrRemote). No fixture
    // catalog needed — ping is a real default-catalog fn.
    const { r, sent, cleanup } = harness()

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc-ping-1',
      wantResponse: true,
      callFunction: { call: 'ping' },
    } as unknown as A2uiServerMessage)

    const responses = sent.filter(isFunctionResponse)
    expect(responses).toHaveLength(1)
    expect(responses[0]!.functionResponse).toMatchObject({
      functionCallId: 'fc-ping-1',
      call: 'ping',
      value: true, // ping() → true, always
    })
    expect(sent.filter(isError)).toEqual([])

    cleanup()
  })

  it('ping — clientOnly regression: required still rejected from server (most-restrictive-wins, default catalog)', () => {
    // `required` remains clientOnly in the default catalog (unchanged). Confirms that adding `ping`
    // (clientOrRemote) does not affect the most-restrictive-wins gate for other functions.
    const { r, sent, cleanup } = harness()

    r.ingestMessage({
      version: 'v1.0',
      functionCallId: 'fc-ping-2',
      wantResponse: true,
      callFunction: { call: 'required', args: { value: 'x' } },
    } as unknown as A2uiServerMessage)

    const errors = sent.filter(isError)
    expect(errors).toHaveLength(1)
    const wire = errors[0]!.error
    expect(wire.code).toBe('INVALID_FUNCTION_CALL')
    expect(wire).toHaveProperty('functionCallId', 'fc-ping-2')
    expect(wire).not.toHaveProperty('surfaceId') // no surfaceId on server-invoke path (ADR-0034 clause 1)
    expect(wire.message).toContain('clientOnly')
    expect(sent.filter(isFunctionResponse)).toHaveLength(0)

    cleanup()
  })
})

// ── ADR-0054: the submit-gated action (#wireAction, FormProvider is the shipped gate) ────────────────
//
// A REAL `ui-form-provider` (`UIElement` — jsdom-safe, form-provider.test.ts precedent) gates a
// `submit:true` Button's click. Its member is a throwaway `UIFormElement` leaf (the
// form-provider.test.ts `MemberEl` precedent): jsdom lacks `ElementInternals.setFormValue`/
// `setValidity` (verified at the base, checkbox.test.ts/form-provider.test.ts) — stubbed in the
// factory's `create()`, BEFORE the renderer ever connects it (the renderer builds the whole subtree
// offline, then attaches it to the mount in one shot, so `create()` always runs ahead of
// `connectedCallback` here). A fixture catalog (Provider/Member/Button) keeps this decoupled from the
// default catalog's real form controls — the same jsdom gap input.test.ts/checks.test.ts route around
// with a synthetic stub.

const gateProbeMemberProps = { ...UIFormElement.formProps, value: prop.string() } satisfies PropsSchema

/** Re-exposes `internals` so the factory's `create()` can stub the jsdom-absent form-association surface. */
interface GateProbeMember extends ReactiveProps<typeof gateProbeMemberProps> {}
class GateProbeMember extends UIFormElement {
  static props = gateProbeMemberProps
  get internalsProbe(): ElementInternals {
    return this.internals
  }
  protected formValue(): FormValue {
    return this.value
  }
  protected formValidity(): ValidityResult {
    return this.required && this.value === ''
      ? { valid: false, flags: { valueMissing: true }, message: 'Required' }
      : { valid: true }
  }
}
if (!customElements.get('ui-gate-probe-member')) customElements.define('ui-gate-probe-member', GateProbeMember)

const GATE_FIXTURE_CATALOG = {
  catalogId: 'gate-fixture',
  protocolVersion: 'v1.0',
  components: {
    Provider: { properties: {}, children: 'ChildList' },
    Member: {
      properties: {
        value: { type: { type: 'string' }, bindable: true, mapsTo: 'value' },
        required: { type: { type: 'boolean' }, mapsTo: 'required' },
      },
      value: { prop: 'value', event: 'change' },
    },
    Button: {
      properties: {
        label: { type: { type: 'string' }, mapsTo: 'textContent' },
        action: { type: { type: 'object' }, mapsTo: 'action' },
      },
    },
  },
  functions: {},
}

const gateFactories: Record<string, WidgetFactory> = {
  // The REAL ui-form-provider — UIElement-based, so it needs no jsdom stubbing itself (only ITS
  // MEMBERS do). `submitGate: true` is the ADR-0054 mark under test.
  Provider: {
    tag: 'ui-form-provider',
    create: () => document.createElement('ui-form-provider'),
    applyProp: () => {},
    submitGate: true,
  },
  Member: {
    tag: 'ui-gate-probe-member',
    create: () => {
      const el = new GateProbeMember()
      const i = el.internalsProbe as unknown as Record<string, unknown> // jsdom stub — see header
      if (typeof i['setFormValue'] !== 'function') {
        i['setFormValue'] = () => {}
        i['setValidity'] = () => {}
      }
      return el
    },
    applyProp: (el, p, value) => void ((el as unknown as Record<string, unknown>)[p] = value),
    value: { prop: 'value', event: 'change' },
  },
  Button: defaultFactories.Button, // reuse the real ui-button factory — safe (UIElement, not form-associated)
}

/** A harness with the gate fixture catalog registered, on top of the default `harness()`. */
function gateHarness() {
  const h = harness()
  h.r.register(GATE_FIXTURE_CATALOG, gateFactories)
  return h
}

describe('renderer host — the ADR-0054 submit-gated action (#wireAction, FormProvider is the shipped gate)', () => {
  it('invalid submit: NO action emitted; reportValidity() called on the FIRST invalid member (registration order)', () => {
    const { r, mount, sent, cleanup } = gateHarness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sg1', catalogId: 'gate-fixture' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sg1',
          components: [
            { id: 'root', component: 'Provider', children: ['m1', 'm2', 'm3', 'btn'] },
            { id: 'm1', component: 'Member', value: 'ok' }, // valid (not required)
            { id: 'm2', component: 'Member', required: true, value: '' }, // first invalid — registered 2nd
            { id: 'm3', component: 'Member', required: true, value: '' }, // also invalid — registered 3rd
            { id: 'btn', component: 'Button', label: 'Submit', action: { action: 'submit_profile', submit: true } },
          ],
        },
      }),
    )

    const [m1, m2, m3] = [...mount.querySelectorAll('ui-gate-probe-member')] as GateProbeMember[]
    const report1 = vi.spyOn(m1!, 'reportValidity').mockReturnValue(true)
    const report2 = vi.spyOn(m2!, 'reportValidity').mockReturnValue(true)
    const report3 = vi.spyOn(m3!, 'reportValidity').mockReturnValue(true)

    ;(mount.querySelector('ui-button') as HTMLElement).click()

    expect(sent.filter(isAction)).toHaveLength(0) // invalid — no action emitted
    expect(report1).not.toHaveBeenCalled() // m1 is valid — never consulted
    expect(report2).toHaveBeenCalledTimes(1) // the FIRST invalid member, registration order
    expect(report3).not.toHaveBeenCalled() // not the SECOND invalid member

    cleanup()
  })

  it('valid submit: exactly ONE action emitted, carrying the data model when sendDataModel is set', async () => {
    const { r, mount, sent, cleanup } = gateHarness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sg2', catalogId: 'gate-fixture', sendDataModel: true } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sg2',
          components: [
            { id: 'root', component: 'Provider', children: ['m1', 'btn'] },
            { id: 'm1', component: 'Member', value: { path: '/form/m1' } },
            { id: 'btn', component: 'Button', label: 'Submit', action: { action: 'submit_profile', submit: true } },
          ],
        },
      }),
    )
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sg2', path: '/form/m1', value: 'hello' } }))
    await whenFlushed()

    ;(mount.querySelector('ui-button') as HTMLElement).click()

    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.action.name).toBe('submit_profile')
    expect(actions[0]!.action.dataModel).toEqual({ form: { m1: 'hello' } })

    cleanup()
  })

  it('submit:true with NO gate ancestor emits normally (graceful fallthrough, an un-nested Button)', () => {
    const { r, mount, sent, cleanup } = gateHarness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sg3', catalogId: 'gate-fixture' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sg3',
          components: [{ id: 'root', component: 'Button', label: 'Go', action: { action: 'go', submit: true } }],
        },
      }),
    )

    ;(mount.querySelector('ui-button') as HTMLElement).click()
    expect(sent.filter(isAction)).toHaveLength(1)

    cleanup()
  })

  it('an UNFLAGGED action inside an INVALID provider still fires unconditionally (opt-in gating only — a Cancel button)', () => {
    const { r, mount, sent, cleanup } = gateHarness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sg4', catalogId: 'gate-fixture' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sg4',
          components: [
            { id: 'root', component: 'Provider', children: ['m1', 'btn'] },
            { id: 'm1', component: 'Member', required: true, value: '' }, // invalid
            { id: 'btn', component: 'Button', label: 'Cancel', action: { action: 'cancel' } }, // NOT submit-flagged
          ],
        },
      }),
    )

    const m1 = mount.querySelector('ui-gate-probe-member') as GateProbeMember
    const report = vi.spyOn(m1, 'reportValidity').mockReturnValue(true)

    ;(mount.querySelector('ui-button') as HTMLElement).click()
    expect(sent.filter(isAction)).toHaveLength(1) // fires unconditionally — gating is opt-in per Button
    expect(report).not.toHaveBeenCalled() // no gate check ran at all — #wireAction never reads `submit`

    cleanup()
  })

  it('zero-drift: an unflagged action inside a VALID provider is byte-for-byte the pre-ADR-0054 shape', () => {
    const { r, mount, sent, cleanup } = gateHarness()
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sg5', catalogId: 'gate-fixture' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sg5',
          components: [
            { id: 'root', component: 'Provider', children: ['m1', 'btn'] },
            { id: 'm1', component: 'Member', value: 'ok' },
            { id: 'btn', component: 'Button', label: 'Go', action: { action: 'go' } },
          ],
        },
      }),
    )

    ;(mount.querySelector('ui-button') as HTMLElement).click()
    const actions = sent.filter(isAction)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.action).toMatchObject({ name: 'go', sourceComponentId: 'btn' })
    expect('submit' in actions[0]!.action).toBe(false) // the client-consumed flag never reaches the wire

    cleanup()
  })
})

// Live-agent investigation (a2ui-live "empty hand" report, 2026-07-07): a card-game turn from a real
// Anthropic model reproduced a templated Row rendering with ZERO instances on an otherwise-live surface.
// Captured verbatim from the dev-proxy transcript: the model emitted
// `updateDataModel{path:"/", value:{...,hand:[5 items]}}` — the protocol's own documented default for an
// omitted `path` (upstream v1.0 §updateDataModel / v0.9, character-verified by live fetch: "If `path` is
// omitted (or is `/`), the entire data model for the surface is replaced"). Root-caused to a RENDERER
// defect (ADR-0099): we read `"/"` per strict RFC-6901 — the child key named `""` — so `setPointer`
// (LLD-C5) nested the payload under a spurious `{"":...}` key and every binding, including the `/hand`
// list template, silently resolved `undefined` (a legal render-time placeholder, SPEC-R4 AC2 — hence no
// error). Fixed by treating `"/"` as the root alias at the `#onUpdateDataModel` whole-model branch (and
// mirrored at the corpus's two fold sites, `canonical.ts`/`admit.ts`, for renderer/corpus parity). These
// two tests now pin the POST-fix contract: `path:"/"` and omitted-`path` are equivalent whole-model
// writes — the SAME payload renders identically either way. Omit-path stays the taught corpus idiom
// (`tools/agent/system-prompt.ts` OUTPUT_RULES GRAMMAR — fewest tokens, version-proof); `"/"` is simply no
// longer a silent trap for a spec-conformant producer.
describe('renderer host — updateDataModel path:"/" vs. path-omitted (live-agent "empty hand" root cause)', () => {
  it('path:"/" is the protocol root alias — whole-model replace, the /hand list template resolves both items (ADR-0099)', async () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'card-game', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'card-game',
          path: '/', // <-- the model's actual emission, captured verbatim off the dev-proxy transcript
          value: { hand: [{ id: 'c1', label: 'A♠' }, { id: 'c2', label: 'K♥' }] },
        },
      }),
    )
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'card-game',
          components: [
            { id: 'root', component: 'Row', gap: 'md', children: { path: '/hand', componentId: 'card' } },
            { id: 'card', component: 'Text', text: { path: 'label' } },
          ],
        },
      }),
    )
    await whenFlushed()

    const cards = mount.querySelectorAll('ui-row > *')
    expect(cards).toHaveLength(2) // whole-model replace — no more silent nesting
    expect([...cards].map((el) => el.textContent)).toEqual(['A♠', 'K♥']) // byte-equivalent to the omitted-path control below
    expect(sent).toHaveLength(0) // still no error/diagnostic emitted — this was never a wire-error case

    cleanup()
  })

  it('control: the IDENTICAL payload with `path` omitted (the corpus idiom) renders both items — the list/binding machinery is sound', async () => {
    const { r, mount, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'card-game', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'card-game',
          // `path` omitted — SPEC-R5 AC2's whole-model-replace form, the one every corpus exemplar uses.
          value: { hand: [{ id: 'c1', label: 'A♠' }, { id: 'c2', label: 'K♥' }] },
        },
      }),
    )
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'card-game',
          components: [
            { id: 'root', component: 'Row', gap: 'md', children: { path: '/hand', componentId: 'card' } },
            { id: 'card', component: 'Text', text: { path: 'label' } },
          ],
        },
      }),
    )
    await whenFlushed()

    const cards = mount.querySelectorAll('ui-row > *')
    expect(cards).toHaveLength(2)
    expect([...cards].map((el) => el.textContent)).toEqual(['A♠', 'K♥']) // the byte-equivalence target above

    cleanup()
  })
})

// ── TKT-0026 × TKT-0024 synergy: a late catalog Option adopts into ui-select's panel ──────────────
//
// TKT-0024's structural-resend reconciliation (ADR-0128, `tree.ts#reconcileChildren`) already gets a
// newly-referenced child id onto the DOM correctly (mounted fresh, inserted at its position). Before
// TKT-0026, that was where it stopped for a Select's Option children: the new `<div role=option>`
// landed as a raw light-DOM child of `<ui-select>` itself — never adopted into the control's internal
// listbox panel — so it was reachable in the DOM but invisible and unselectable (TKT-0026's own repro,
// now realized through the FULL renderer path instead of a hand-authored `select.append(...)`).

describe('renderer host — TKT-0026: a structural resend that adds an Option renders it INTO the select panel', () => {
  // jsdom reality (the catalog/default/index.test.ts precedent): `ElementInternals.setFormValue`/
  // `setValidity` are absent in jsdom — `ui-select` (form-associated) calls both unconditionally in its
  // own `connectedCallback`, which throws. The real `selectFactory` builds the element via a plain
  // `document.createElement` (no per-instance stub hook), so the stub is applied ONCE at the shared
  // `ElementInternals.prototype`, scoped to this describe's `beforeAll`/`afterAll` (saved + restored).
  let savedSetFormValue: unknown
  let savedSetValidity: unknown
  beforeAll(() => {
    savedSetFormValue = ElementInternals.prototype.setFormValue
    savedSetValidity = ElementInternals.prototype.setValidity
    if (typeof ElementInternals.prototype.setFormValue !== 'function') {
      ElementInternals.prototype.setFormValue = function (): void {}
    }
    if (typeof ElementInternals.prototype.setValidity !== 'function') {
      ElementInternals.prototype.setValidity = function (): void {}
    }
  })
  afterAll(() => {
    ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
    ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
  })

  it('a late Option id (resent onto root.children) is adopted into the panel and becomes selectable', async () => {
    const { r, mount, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-select', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's-select',
          components: [
            // `root` is a stable, never-resent wrapper (SurfaceTree#reconcileNode never reconciles
            // `id:'root'` itself, SPEC-R4) one level above the mutable Select — the a2ui-compose
            // "never resend root" precedent (node-idioms.md).
            { id: 'root', component: 'Column', children: ['sel'] },
            { id: 'sel', component: 'Select', name: 'fruit', children: ['opt_a', 'opt_b'] },
            { id: 'opt_a', component: 'Option', value: 'apple', label: 'Apple' },
            { id: 'opt_b', component: 'Option', value: 'banana', label: 'Banana' },
          ],
        },
      }),
    )
    await whenFlushed()

    const select = mount.querySelector('ui-select') as UISelectElement
    expect(select).toBeInstanceOf(UISelectElement)
    expect(select.querySelectorAll('[role=option]')).toHaveLength(2) // ship-together: both adopt at first connect

    // A structural resend of `sel` referencing a THIRD, previously-undelivered Option id — the exact
    // TKT-0024 reconciliation path (`#reconcileChildren` mounts `opt_c` fresh via the ordinary
    // `#mountNode`, then `el.insertBefore(node, anchor)` — `anchor` is `null` here since `opt_c` is
    // last in the new order, so this degrades to a plain append onto the SELECT host).
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's-select',
          components: [
            { id: 'sel', component: 'Select', name: 'fruit', children: ['opt_a', 'opt_b', 'opt_c'] },
            { id: 'opt_c', component: 'Option', value: 'cherry', label: 'Cherry' },
          ],
        },
      }),
    )
    await whenFlushed()
    await Promise.resolve() // ui-select's own #optionObserver adoption (TKT-0026) is microtask-deferred
    await Promise.resolve()

    // TKT-0026: the late Option is not just reachable in the DOM (TKT-0024's own proof) — it is
    // ADOPTED into the control's listbox panel, exactly like the ship-together pair above.
    expect(select.querySelectorAll('[role=option]')).toHaveLength(3)
    const late = select.querySelector<HTMLElement>('[value="cherry"]')!
    expect(late.closest('[data-part="listbox"]')).not.toBeNull()
    expect(late.parentElement?.getAttribute('data-part')).toBe('listbox')

    // …and it is genuinely SELECTABLE (roving/selectionCommit re-read the live DOM — select.ts's own
    // "dynamic option sets" contract) — the value round-trips through the control's own commit path.
    late.click()
    await whenFlushed()
    expect(select.value).toBe('cherry')

    cleanup()
  })

  // TKT-0026 review (component-reviewer NO-GO on scope) found this LATENT: the "fully general — tail
  // is the only reachable position" claim above was true ONLY for direct-DOM/author mutations, because
  // the RENDERER's own `#reconcileChildren` (tree.ts) resolved a SURVIVOR's anchor as its bare widget
  // node with no `parentNode === el` check (RSR-C5) — for ANY child-relocating control (the ADR-0017
  // family: select/combo-box/menu/popover/tooltip/modal/command-modal/disclosure), a survivor's true
  // parent by resend time is the control's internal panel, not the host `el` `#reconcileChildren`
  // inserts into. A MID-POSITION resend (a new id inserted BETWEEN two already-delivered survivors)
  // threw an uncaught `NotFoundError` out of `ingest()`. TKT-0031 (tree.ts's own wave) fixes this: a
  // relocated survivor (`parentNode !== el`) is now SKIPPED as an anchor candidate — `anchor` falls
  // through to the next still-genuine-child-of-`el` survivor, or `null` (a safe, always-valid
  // `insertBefore` target) — so the insert no longer crashes. This test, formerly the pinned
  // `.toThrow()` boundary, is REWRITTEN (TKT-0031) to assert the insert now SUCCEEDS.
  it('TKT-0031 (fixed): a MID-POSITION resend inserted between two survivors succeeds — the new Option adopts into the select panel', async () => {
    const { r, mount, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-select-mid', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's-select-mid',
          components: [
            { id: 'root', component: 'Column', children: ['sel'] },
            { id: 'sel', component: 'Select', name: 'fruit', children: ['opt_a', 'opt_b'] },
            { id: 'opt_a', component: 'Option', value: 'apple', label: 'Apple' },
            { id: 'opt_b', component: 'Option', value: 'banana', label: 'Banana' },
          ],
        },
      }),
    )
    await whenFlushed()
    const select = mount.querySelector('ui-select') as UISelectElement
    expect(select.querySelectorAll('[role=option]')).toHaveLength(2) // ship-together: both adopt at first connect

    // opt_c is NEW, inserted BETWEEN the two already-delivered survivors opt_a/opt_b — the anchor for
    // opt_c would resolve to opt_a's or opt_b's widget, both of which by now live inside the select's
    // own listbox panel (adopted at first connect), not as a child of the select host
    // `#reconcileChildren` inserts into. TKT-0031: both are skipped as anchor candidates (relocated),
    // so this no longer throws.
    expect(() => {
      r.ingest(
        line({
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's-select-mid',
            components: [
              { id: 'sel', component: 'Select', name: 'fruit', children: ['opt_a', 'opt_c', 'opt_b'] },
              { id: 'opt_c', component: 'Option', value: 'cherry', label: 'Cherry' },
            ],
          },
        }),
      )
    }).not.toThrow()

    await whenFlushed()
    await Promise.resolve() // select's own #optionObserver adoption is microtask-deferred (TKT-0026)
    await Promise.resolve()

    // opt_c mounted as a fresh light-DOM child of `sel` (tail — anchor fell through to `null`, both
    // survivors having been skipped as relocated) and select's own `#optionObserver` adopts it into the
    // panel on the next microtask, exactly like TKT-0026's own late-arrival proof above.
    expect(select.querySelectorAll('[role=option]')).toHaveLength(3)
    const late = select.querySelector<HTMLElement>('[value="cherry"]')!
    expect(late.closest('[data-part="listbox"]')).not.toBeNull()

    // Position fidelity: TKT-0031 fixes the THROW, not SPEC-R5 reorder (ADR-0128, deferred, per
    // ADR-0128's reorder-stays-a-non-goal ruling) — a relocating control owns its OWN internal order
    // once children are adopted (select.ts's `#syncOptions` doc: a newly-adopted node always lands at
    // the listbox's CURRENT TAIL, regardless of where the wire referenced it). So the realized panel
    // order is [apple, banana, cherry], not the wire's requested [apple, cherry, banana] — a documented
    // divergence inside the control's own ownership, not a defect.
    expect([...select.querySelectorAll('[role=option]')].map((o) => o.getAttribute('value'))).toEqual([
      'apple',
      'banana',
      'cherry',
    ])

    // …and genuinely selectable, same as TKT-0026's own proof.
    late.click()
    await whenFlushed()
    expect(select.value).toBe('cherry')

    cleanup()
  })
})

// ── TKT-0031: mid-position resend against a SECOND child-relocating family member (proves the fix
// isn't select-shaped) ───────────────────────────────────────────────────────────────────────────────
//
// `ui-menu` (ADR-0017 family) moves all non-trigger light children into its internal panel ONCE, at
// first connect (menu.ts `#ensureParts`) — it has no ongoing adoption observer the way select does.
// A mid-position resend inserting a new MenuItem between two already-relocated survivors exercises the
// SAME anchor-resolution path as select's Option case above, with a different (simpler) relocation
// shape: the new item mounts fresh and is appended as a light-DOM sibling of the panel (reachable, not
// re-adopted into the panel — menu has no observer to do that), proving the throw is gone regardless
// of whether the specific control re-adopts late-arriving children.
describe('renderer host — TKT-0031: mid-position resend against a second child-relocating family member (Menu)', () => {
  it('a MenuItem resend inserted between two already-relocated survivors succeeds (no NotFoundError)', async () => {
    const { r, mount, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's-menu-mid', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's-menu-mid',
          components: [
            { id: 'root', component: 'Column', children: ['menu'] },
            { id: 'menu', component: 'Menu', open: false, children: ['menu_trigger', 'item_a', 'item_b'] },
            { id: 'menu_trigger', component: 'Button', label: 'Open menu' },
            { id: 'item_a', component: 'MenuItem', value: 'a', label: 'Option A' },
            { id: 'item_b', component: 'MenuItem', value: 'b', label: 'Option B' },
          ],
        },
      }),
    )
    await whenFlushed()

    const menu = mount.querySelector('ui-menu')!
    expect(menu.querySelectorAll('[role=menuitem]')).toHaveLength(2) // both moved into the panel at first connect

    // item_c is NEW, inserted BETWEEN the two already-relocated survivors item_a/item_b — the anchor for
    // item_c would resolve to one of their widgets, both now children of the menu's internal panel, not
    // of `menu` itself. Pre-TKT-0031 this threw; post-fix it does not.
    expect(() => {
      r.ingest(
        line({
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's-menu-mid',
            components: [
              { id: 'menu', component: 'Menu', open: false, children: ['menu_trigger', 'item_a', 'item_c', 'item_b'] },
              { id: 'item_c', component: 'MenuItem', value: 'c', label: 'Option C' },
            ],
          },
        }),
      )
    }).not.toThrow()

    await whenFlushed()

    // item_c is mounted and reachable (menu has no re-adoption observer, so it lands as a light-DOM
    // sibling of the panel rather than moving inside it — still a correct, leak-free, non-throwing
    // mount, which is all TKT-0031 claims for a family member without select's adoption mechanism).
    expect(menu.querySelectorAll('[role=menuitem]')).toHaveLength(3)
    const items = [...menu.querySelectorAll('[role=menuitem]')]
    expect(items.map((i) => i.getAttribute('data-value'))).toContain('c')

    cleanup()
  })
})
