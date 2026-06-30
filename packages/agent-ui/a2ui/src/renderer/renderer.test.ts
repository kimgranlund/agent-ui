import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIButtonElement } from '@agent-ui/components/components'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'
import type { A2uiAction, A2uiActionMessage } from './action.ts'
import type { A2uiErrorMessage } from './renderer.ts'
import type { A2uiFunctionResponseMessage, A2uiServerMessage } from '../protocol.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { catalogFunctions } from '../catalog/functions.ts'

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
    expect(action.wantResponse).toBe(false) // …nor a wantResponse
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
})
