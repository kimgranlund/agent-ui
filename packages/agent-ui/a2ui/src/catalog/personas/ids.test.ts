// ids.test.ts: `SHIPPED_PERSONA_IDS` (the import-free persona list) equals the shipped manifests, in order (T-0209).

import { describe, it, expect } from 'vitest'
import { SHIPPED_PERSONA_IDS } from './ids.ts'
import { SHIPPED_PERSONA_CATALOG_MANIFESTS } from './manifests.ts'

describe('SHIPPED_PERSONA_IDS', () => {
  it('equals the shipped manifests, in order', () => {
    expect(SHIPPED_PERSONA_IDS.length).toBeGreaterThan(0)
    expect([...SHIPPED_PERSONA_IDS]).toEqual(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId))
  })

  it('NEGATIVE CONTROL: a list that drops a shipped persona is not equal', () => {
    expect(SHIPPED_PERSONA_IDS.slice(1)).not.toEqual(SHIPPED_PERSONA_CATALOG_MANIFESTS.map((m) => m.personaId))
  })
})
