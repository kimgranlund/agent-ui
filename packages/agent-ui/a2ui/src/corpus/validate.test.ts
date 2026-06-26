import { describe, it, expect } from 'vitest'
import { validateA2ui as rendererValidate } from '../renderer/validate.ts'
import { validateA2ui as corpusValidate } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'

// SPEC-N6 / corpus SPEC-N1 — validator parity: corpus admission and the renderer share ONE
// implementation and therefore return identical verdicts on any payload.
describe('validator parity (SPEC-N6)', () => {
  it('the corpus tier-1 validator IS the renderer validator (single implementation)', () => {
    expect(corpusValidate).toBe(rendererValidate)
  })

  const payloads: Array<{ label: string; payload: unknown }> = [
    {
      label: 'a valid stream',
      payload: [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [
              { id: 'root', component: 'Column', children: ['b1'] },
              { id: 'b1', component: 'Button', label: { path: '/cta' } },
            ],
          },
        },
      ],
    },
    {
      label: 'an unknown component type',
      payload: [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Nope' }] } }],
    },
    { label: 'a parse failure', payload: '{ broken' },
    { label: 'a version failure', payload: [{ version: 'v9', createSurface: { surfaceId: 's', catalogId: 'demo' } }] },
  ]

  for (const { label, payload } of payloads) {
    it(`yields the identical verdict regardless of caller — ${label}`, () => {
      expect(corpusValidate(payload, demoCatalog)).toEqual(rendererValidate(payload, demoCatalog))
    })
  }
})
