import { describe, it, expect } from 'vitest'
import { validateA2ui as rendererValidate } from '../renderer/validate.ts'
import { validateA2ui as corpusValidate } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'

const create = { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }
const del = { version: 'v1.0', deleteSurface: { surfaceId: 's1' } }
const root = (text: string) => ({
  version: 'v1.0',
  updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text }] },
})
const label = {
  version: 'v1.0',
  updateComponents: { surfaceId: 's1', components: [{ id: 'lbl', component: 'Text', text: 'x' }] },
}
const RECREATE_WITH_ROOT = [create, root('one'), create, root('two')]
const RECREATE_ROOTLESS = [create, root('one'), create, label]
const DELETE_THEN_CREATE = [create, root('one'), del, create, root('two')]

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
    // ADR-0064 re-create erratum (GH #1772): the shapes whose verdict the epoch reset changed.
    { label: 'a re-create that delivers a new root', payload: RECREATE_WITH_ROOT },
    { label: 'a rootless re-create', payload: RECREATE_ROOTLESS },
    { label: 'a delete-then-create', payload: DELETE_THEN_CREATE },
  ]

  for (const { label, payload } of payloads) {
    it(`yields the identical verdict regardless of caller — ${label}`, () => {
      expect(corpusValidate(payload, demoCatalog)).toEqual(rendererValidate(payload, demoCatalog))
    })
  }

  // The re-create verdicts themselves, asserted through the CORPUS entry point (a parity row above only
  // proves the two callers agree; these prove they agree on the ruled answer), in both finalize modes.
  describe('a re-create resets the id graph for the corpus caller too (ADR-0064 re-create erratum, GH #1772)', () => {
    const finalize = { atFinalize: true }

    it('a re-create that delivers a new root validates (it failed `s1:root` before the erratum)', () => {
      expect(corpusValidate(RECREATE_WITH_ROOT, demoCatalog)).toEqual({ valid: true, failures: [] })
      expect(corpusValidate(RECREATE_WITH_ROOT, demoCatalog, undefined, finalize)).toEqual({ valid: true, failures: [] })
    })

    it('a rootless re-create fails `s1:root-missing` in both modes (the first epoch\'s root no longer satisfies it)', () => {
      const expected = { valid: false, failures: [{ code: 'IDGRAPH', path: 's1:root-missing' }] }
      expect(corpusValidate(RECREATE_ROOTLESS, demoCatalog)).toEqual(expected)
      expect(corpusValidate(RECREATE_ROOTLESS, demoCatalog, undefined, finalize)).toEqual(expected)
    })

    it('a delete-then-create validates as it did before the erratum', () => {
      expect(corpusValidate(DELETE_THEN_CREATE, demoCatalog)).toEqual({ valid: true, failures: [] })
      expect(corpusValidate(DELETE_THEN_CREATE, demoCatalog, undefined, finalize)).toEqual({ valid: true, failures: [] })
    })

    it('both callers agree on every one of them, at both granularities', () => {
      for (const payload of [RECREATE_WITH_ROOT, RECREATE_ROOTLESS, DELETE_THEN_CREATE]) {
        for (const opts of [undefined, finalize]) {
          expect(corpusValidate(payload, demoCatalog, undefined, opts)).toEqual(
            rendererValidate(payload, demoCatalog, undefined, opts),
          )
        }
      }
    })
  })
})
