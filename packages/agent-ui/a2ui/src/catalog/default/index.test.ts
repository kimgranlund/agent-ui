import { describe, it, expect } from 'vitest'
import { defaultCatalog } from './index.ts'
import { validateCatalogConformance } from '../conformance.ts'
import type { A2uiComponent } from '../../protocol.ts'

describe('default catalog (catalog LLD-C4, SPEC-R3/R8/N2)', () => {
  it('loads + exposes the typed Catalog', () => {
    expect(defaultCatalog.catalogId).toBe('agent-ui')
    expect(defaultCatalog.protocolVersion).toBe('v1.0')
  })

  it('declares Button reflecting the ui-button prop surface (variant; triggers action)', () => {
    const button = defaultCatalog.components.Button
    expect(button).toBeDefined()
    expect(button.name).toBe('Button') // name defaults to the declaring key
    expect(button.properties.variant?.mapsTo).toBe('variant')
    expect(button.properties.label?.mapsTo).toBe('textContent')
    expect(button.properties.action).toBeDefined() // the trigger the renderer dispatches
  })

  it('declares no type without a shipped control (SPEC-N2: no silent dead types)', () => {
    // Only `ui-button` has shipped (G5); the catalog declares exactly Button until more controls land.
    expect(Object.keys(defaultCatalog.components)).toEqual(['Button'])
  })

  it('a Button payload using declared props yields 0 CATALOG errors (SPEC-R3 AC2)', () => {
    const node: A2uiComponent = {
      id: 'b1',
      component: 'Button',
      label: 'Submit',
      variant: 'solid',
      disabled: false,
      action: { action: 'submit' },
    }
    expect(validateCatalogConformance(node, defaultCatalog)).toEqual([])
  })

  it('rejects a property absent from the catalog (security allowlist, SPEC-R9)', () => {
    const node: A2uiComponent = { id: 'b2', component: 'Button', bogus: 'x' }
    expect(validateCatalogConformance(node, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'b2.bogus' })
  })
})
