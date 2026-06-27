import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIButtonElement } from '@agent-ui/components/components'
import { createRenderer } from './renderer.ts'
import type { A2uiClientMessage, RendererHost } from './renderer.ts'
import type { A2uiActionMessage } from './action.ts'
import type { A2uiErrorMessage } from './renderer.ts'
import type { A2uiServerMessage } from '../protocol.ts'

// The A1 integration proof (renderer LLD-C13): a STREAMED, multi-message JSONL fixture is fed line by
// line into the host and must render into REAL `ui-*` controls under the mount — the nine wave-1 modules
// wired together. Deterministic id/clock providers are injected so the action round-trip asserts exact
// shapes (the scripts ban ambient `Date.now()`/`Math.random()` in logic; the host's default edge
// providers are swapped for fakes here).

const line = (message: A2uiServerMessage): string => JSON.stringify(message)
const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m
const isError = (m: A2uiClientMessage): m is A2uiErrorMessage => 'error' in m

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

    const catalogErrors = sent.filter(isError).filter((m) => m.error.code === 'CATALOG')
    expect(catalogErrors).toHaveLength(1)
    expect(catalogErrors[0]!.error).toMatchObject({ code: 'CATALOG', surfaceId: 's2', path: 'unknown' })

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

    const parseErrors = sent.filter(isError).filter((m) => m.error.code === 'PARSE')
    expect(parseErrors).toHaveLength(1) // exactly one — the blank line did not fault
    expect(mount.querySelector('ui-button')).toBeInstanceOf(UIButtonElement) // the later valid surface still rendered

    cleanup()
  })

  it('createSurface with an unregistered catalogId emits CATALOG_UNKNOWN and creates no surface (R2 AC3)', () => {
    const { r, mount, sent, cleanup } = harness()

    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 's4', catalogId: 'no-such-catalog' } }))
    r.ingest(line({ version: 'v1.0', updateComponents: { surfaceId: 's4', components: [{ id: 'root', component: 'Button' }] } }))

    expect(sent.filter(isError).map((m) => m.error.code)).toEqual(['CATALOG_UNKNOWN'])
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
    const idgraph = sent.filter(isError).filter((m) => m.error.code === 'IDGRAPH')
    expect(idgraph).toHaveLength(1)
    expect(idgraph[0]!.error.surfaceId).toBe('s5')

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
