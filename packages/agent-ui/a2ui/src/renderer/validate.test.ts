import { describe, it, expect } from 'vitest'
import { validateA2ui, type ValidationVerdict } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'

const codes = (v: ValidationVerdict): string[] => v.failures.map((f) => f.code)

// A well-formed end-to-end stream: surface → tree (root + bound child) → data.
const validOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 's1',
      components: [
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: { path: '/user/name' }, variant: 'h1' },
      ],
    },
  },
  { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/user/name', value: 'Ada' } },
]

describe('validateA2ui (renderer LLD-C11, SPEC-R11)', () => {
  it('accepts a well-formed output stream → valid, no failures', () => {
    expect(validateA2ui(validOutput, demoCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('accepts a single message object (msgOrOutput)', () => {
    expect(validateA2ui(validOutput[0], demoCatalog).valid).toBe(true)
  })

  // — PARSE —
  it('PARSE: a raw unparseable string', () => {
    expect(validateA2ui('{ not json', demoCatalog)).toEqual({ valid: false, failures: [{ code: 'PARSE', path: '' }] })
  })

  // — SCHEMA —
  it('SCHEMA: a non-object/array primitive', () => {
    expect(codes(validateA2ui(42, demoCatalog))).toEqual(['SCHEMA'])
  })
  it('SCHEMA: a missing version', () => {
    expect(codes(validateA2ui([{ createSurface: { surfaceId: 's', catalogId: 'demo' } }], demoCatalog))).toEqual(['SCHEMA'])
  })
  it('SCHEMA: an unknown envelope key', () => {
    expect(codes(validateA2ui([{ version: 'v1.0', frobnicate: {} }], demoCatalog))).toEqual(['SCHEMA'])
  })
  it('SCHEMA: an ambiguous (two-envelope) message', () => {
    const m = { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'demo' }, deleteSurface: { surfaceId: 's' } }
    expect(codes(validateA2ui([m], demoCatalog))).toEqual(['SCHEMA'])
  })
  it('SCHEMA: a missing required field', () => {
    const v = validateA2ui([{ version: 'v1.0', createSurface: { surfaceId: 's' } }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'SCHEMA', path: '[0].createSurface.catalogId' }])
  })

  // — VERSION_UNSUPPORTED —
  it('VERSION_UNSUPPORTED: an unpinned version', () => {
    const v = validateA2ui([{ version: 'v2.0', createSurface: { surfaceId: 's', catalogId: 'demo' } }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'VERSION_UNSUPPORTED', path: '[0]' }])
  })
  it('accepts the pinned v0.9.1', () => {
    expect(validateA2ui([{ version: 'v0.9.1', deleteSurface: { surfaceId: 's' } }], demoCatalog).valid).toBe(true)
  })

  // — CATALOG (via conformance) —
  it('CATALOG: an unknown component type', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Doohickey' }] } }],
      demoCatalog,
    )
    expect(v.failures).toEqual([{ code: 'CATALOG', path: 'root' }])
  })
  it('CATALOG: an unknown property', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Button', bogus: 1 }] } }],
      demoCatalog,
    )
    expect(v.failures).toEqual([{ code: 'CATALOG', path: 'root.bogus' }])
  })

  // — IDGRAPH —
  it('accepts a single-root component set', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'hi' }] } }],
      demoCatalog,
    )
    expect(v).toEqual({ valid: true, failures: [] })
  })
  it('IDGRAPH: a complete component set with no root (missing-root, finalize judgment)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'a', component: 'Text', text: 'hi' }] } }],
      demoCatalog,
    )
    expect(v.valid).toBe(false)
    expect(v.failures).toContainEqual({ code: 'IDGRAPH', path: 's:root-missing' })
  })
  it('IDGRAPH: a second root', () => {
    const v = validateA2ui(
      [
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's',
            components: [
              { id: 'root', component: 'Column' },
              { id: 'root', component: 'Text' },
            ],
          },
        },
      ],
      demoCatalog,
    )
    expect(codes(v)).toContain('IDGRAPH')
    expect(v.failures.some((f) => f.path === 's:root')).toBe(true)
  })
  it('IDGRAPH: a dangling child reference', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Column', children: ['ghost'] }] } }],
      demoCatalog,
    )
    expect(v.failures).toContainEqual({ code: 'IDGRAPH', path: 'root->ghost' })
  })
  it('IDGRAPH: a cycle', () => {
    const v = validateA2ui(
      [
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's',
            components: [
              { id: 'root', component: 'Card', child: 'a' },
              { id: 'a', component: 'Card', child: 'root' },
            ],
          },
        },
      ],
      demoCatalog,
    )
    expect(v.failures).toContainEqual({ code: 'IDGRAPH', path: 's:cycle' })
  })

  // — POINTER —
  it('POINTER: a malformed ~ escape in a binding', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: { path: '/bad~2' } }] } }],
      demoCatalog,
    )
    expect(v.failures).toEqual([{ code: 'POINTER', path: 'root.text' }])
  })
  it('POINTER: a malformed updateDataModel path', () => {
    const v = validateA2ui([{ version: 'v1.0', updateDataModel: { surfaceId: 's', path: 'nope' } }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'POINTER', path: '[0].updateDataModel.path' }])
  })
  it('does NOT flag a well-formed but undefined path (R4 AC2 — runtime placeholder, not a POINTER error)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: { path: '/not/in/data' } }] } }],
      demoCatalog,
    )
    expect(v.valid).toBe(true)
  })
  // Discovered building the ADR-0055 examples gate: a bare relative (list-item-scoped) binding path —
  // `{path:'name'}` with NO leading digit — is what the shipped list pages actually use (binding.ts's
  // `scopedPointer`, ADR-0024); the prior rule ("relative paths begin with a digit") false-flagged them.
  it('accepts a bare relative (list-item-scoped) binding path — e.g. {path:"name"}, no leading digit', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: { path: 'name' } }] } }],
      demoCatalog,
    )
    expect(v).toEqual({ valid: true, failures: [] })
  })
  it('POINTER: a malformed ~ escape in a RELATIVE binding is still rejected', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: { path: 'bad~2' } }] } }],
      demoCatalog,
    )
    expect(v.failures).toEqual([{ code: 'POINTER', path: 'root.text' }])
  })
  it('a relative (non-"/"-led) updateDataModel.path is STILL rejected — no list scope applies to a data-model push', () => {
    const v = validateA2ui([{ version: 'v1.0', updateDataModel: { surfaceId: 's', path: 'name' } }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'POINTER', path: '[0].updateDataModel.path' }])
  })

  // — totality —
  it('is total: never throws on hostile input', () => {
    for (const x of [null, undefined, true, [], [null], [[]], { version: 'v1.0' }]) {
      expect(() => validateA2ui(x, demoCatalog)).not.toThrow()
    }
  })

  // — callFunction envelope (SPEC-R14 / ADR-0034; the MESSAGE_KINDS parity gap discovered + closed in
  // ADR-0055 §1.2 — dispatch.ts routed this envelope before the validator recognized it). Envelope-level:
  // `functionCallId` is a TOP-LEVEL sibling of `callFunction`, no `surfaceId` at all.
  it('accepts a spec-legal callFunction envelope (functionCallId + callFunction.call; no surfaceId)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', functionCallId: 'fc1', wantResponse: true, callFunction: { call: 'ping' } }],
      demoCatalog,
    )
    expect(v).toEqual({ valid: true, failures: [] })
  })
  it('accepts callFunction with args and without wantResponse (both optional)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', functionCallId: 'fc2', callFunction: { call: 'required', args: { value: '' } } }],
      demoCatalog,
    )
    expect(v).toEqual({ valid: true, failures: [] })
  })
  it('SCHEMA: callFunction missing the top-level functionCallId', () => {
    const v = validateA2ui([{ version: 'v1.0', callFunction: { call: 'ping' } }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'SCHEMA', path: '[0].functionCallId' }])
  })
  it('SCHEMA: callFunction.call missing/non-string', () => {
    const v = validateA2ui([{ version: 'v1.0', functionCallId: 'fc3', callFunction: {} }], demoCatalog)
    expect(v.failures).toEqual([{ code: 'SCHEMA', path: '[0].callFunction.call' }])
  })
})
