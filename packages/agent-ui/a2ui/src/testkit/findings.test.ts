// findings.test.ts: the kit's layers and code table (tools/testkit/findings.ts, T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { KIT_CODE_LAYER, LAYERS, kitFinding, validatorLayer, validatorFinding, isLayer } from '../../tools/testkit/findings.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

describe('findings', () => {
  it('LAYERS is exactly the seven names, in order', () => {
    expect(LAYERS).toEqual(['validator', 'heal', 'renderer', 'catalog', 'producer', 'integration', 'interop'])
  })

  it('every KIT_CODE_LAYER value is a LAYERS member', () => {
    const values = Object.values(KIT_CODE_LAYER)
    expect(values.length).toBeGreaterThan(0)
    for (const layer of values) expect(isLayer(layer), layer).toBe(true)
  })

  it('kitFinding takes the layer from the table, never the caller', () => {
    expect(kitFinding('BINDING_UNRESOLVED', { path: '/x' })).toEqual({ layer: 'renderer', code: 'BINDING_UNRESOLVED', path: '/x' })
    expect(kitFinding('MCP_TIMEOUT').layer).toBe('integration')
  })

  it('validatorLayer: agent-ui family is validator, the a2ui-basic family and the canonical URI are interop', () => {
    expect(validatorLayer('agent-ui')).toBe('validator')
    expect(validatorLayer('agent-ui--croupier')).toBe('validator')
    expect(validatorLayer('a2ui-basic')).toBe('interop')
    expect(validatorLayer('a2ui-basic--croupier')).toBe('interop')
    expect(validatorLayer('https://a2ui.org/specification/v0_9/basic_catalog.json')).toBe('interop')
    expect(validatorFinding('a2ui-basic', 'CATALOG', { path: 'root.label' })).toEqual({ layer: 'interop', code: 'CATALOG', path: 'root.label' })
  })
})
