import { describe, it, expect } from 'vitest'
import { validateA2ui, type ValidationVerdict } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

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

  // — DEPTH_EXCEEDED (a2ui-runtime SPEC-R15, GH #473) —
  it('accepts a chain exactly AT the 64-level cap', () => {
    const components = Array.from({ length: 64 }, (_, i) => ({
      id: i === 0 ? 'root' : `n${i}`,
      component: 'Card',
      ...(i < 63 ? { child: `n${i + 1}` } : {}),
    }))
    const v = validateA2ui([{ version: 'v1.0', updateComponents: { surfaceId: 's', components } }], demoCatalog)
    expect(v).toEqual({ valid: true, failures: [] })
  })

  it('DEPTH_EXCEEDED: a chain one level past the 64-level cap — rejected at admission (never silently truncated)', () => {
    const components = Array.from({ length: 65 }, (_, i) => ({
      id: i === 0 ? 'root' : `n${i}`,
      component: 'Card',
      ...(i < 64 ? { child: `n${i + 1}` } : {}),
    }))
    const v = validateA2ui([{ version: 'v1.0', updateComponents: { surfaceId: 's', components } }], demoCatalog)
    expect(v.valid).toBe(false)
    expect(v.failures).toContainEqual({ code: 'DEPTH_EXCEEDED', path: 's:depth' })
  })

  it('DEPTH_EXCEEDED: a WAY over-cap chain (1000 levels) does not crash — proves the guard is iterative', () => {
    const components = Array.from({ length: 1000 }, (_, i) => ({
      id: i === 0 ? 'root' : `n${i}`,
      component: 'Card',
      ...(i < 999 ? { child: `n${i + 1}` } : {}),
    }))
    let v: ValidationVerdict | undefined
    expect(() => {
      v = validateA2ui([{ version: 'v1.0', updateComponents: { surfaceId: 's', components } }], demoCatalog)
    }).not.toThrow()
    expect(v!.failures).toContainEqual({ code: 'DEPTH_EXCEEDED', path: 's:depth' })
  })

  // — CONTAINMENT (a2ui-container-vocabulary SPEC-R6) — uses defaultCatalog (demoCatalog declares no
  // CardHeader/CardContent/CardFooter): a region is only meaningful as a direct child of a Card.
  it('CONTAINMENT: a CardHeader delivered as a direct child of a Column (not a Card)', () => {
    const v = validateA2ui(
      [
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's',
            components: [
              { id: 'root', component: 'Column', children: ['stray-header'] },
              { id: 'stray-header', component: 'CardHeader', children: ['title'] },
              { id: 'title', component: 'Text', variant: 'body', text: 'not really a header' },
            ],
          },
        },
      ],
      defaultCatalog,
    )
    expect(v.failures).toContainEqual({ code: 'CONTAINMENT', path: 'stray-header' })
  })
  it('CONTAINMENT: a CardContent delivered as the surface root (no parent at all)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'CardContent' }] } }],
      defaultCatalog,
    )
    expect(v.failures).toContainEqual({ code: 'CONTAINMENT', path: 'root' })
  })
  it('CONTAINMENT: CardHeader/CardContent/CardFooter each a DIRECT child of Card — accepted', () => {
    const v = validateA2ui(
      [
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's',
            components: [
              { id: 'root', component: 'Card', elevation: '1', children: ['hdr', 'body', 'ftr'] },
              { id: 'hdr', component: 'CardHeader', children: [] },
              { id: 'body', component: 'CardContent', children: [] },
              { id: 'ftr', component: 'CardFooter', children: [] },
            ],
          },
        },
      ],
      defaultCatalog,
    )
    expect(codes(v)).not.toContain('CONTAINMENT')
  })
  it('CONTAINMENT: a stray CardFooter nested two levels down (Card > Column > CardFooter) still fails — only a DIRECT child of Card qualifies', () => {
    const v = validateA2ui(
      [
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's',
            components: [
              { id: 'root', component: 'Card', children: ['col'] },
              { id: 'col', component: 'Column', children: ['ftr'] },
              { id: 'ftr', component: 'CardFooter', children: [] },
            ],
          },
        },
      ],
      defaultCatalog,
    )
    expect(v.failures).toContainEqual({ code: 'CONTAINMENT', path: 'ftr' })
  })
  it('does NOT flag a plain Card with no region children at all (ADR-0056 humane default)', () => {
    const v = validateA2ui(
      [{ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Card', children: [] }] } }],
      defaultCatalog,
    )
    expect(codes(v)).not.toContain('CONTAINMENT')
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

// TKT-0081 — the optional cross-turn `sessionSeed`: judge THIS payload against the MERGED graph the
// renderer will actually hold. The pair of concerns: (1) an update-only follow-up (no `root`, refs into
// the prior turn's components) must VALIDATE seeded — standalone it fails root-missing + dangling, the
// exact contradiction that forced live producers to resend full trees; (2) a `root` re-delivery for a
// seeded surface must FAIL as `sid:root` (the renderer's own ADR-0128 verdict), pre-wire.
describe('validateA2ui — the TKT-0081 sessionSeed (cross-turn merged-graph judgment)', () => {
  const seed = new Map([
    [
      's1',
      {
        components: [
          { id: 'root', component: 'Column', children: ['group'] },
          { id: 'group', component: 'Column', children: ['msg'] },
          { id: 'msg', component: 'Text', text: 'hello' },
        ],
        rootDelivered: true,
      },
    ],
  ])
  const updateOnly = [
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'group', component: 'Column', children: ['msg', 'status'] },
          { id: 'status', component: 'Text', text: 'ready' },
        ],
      },
    },
  ]

  it('an update-only follow-up VALIDATES seeded (refs resolve in the merged graph; root already held)', () => {
    expect(validateA2ui(updateOnly, demoCatalog, seed)).toEqual({ valid: true, failures: [] })
  })

  it('negative control — the SAME payload unseeded fails root-missing (the pre-seed standalone judgment)', () => {
    const v = validateA2ui(updateOnly, demoCatalog)
    expect(v.valid).toBe(false)
    expect(v.failures.some((f) => f.code === 'IDGRAPH' && f.path === 's1:root-missing')).toBe(true)
  })

  it('re-delivering "root" for a seeded surface fails as the renderer\'s own `sid:root` verdict', () => {
    const resend = [
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Column', children: ['group'] }] },
      },
    ]
    const v = validateA2ui(resend, demoCatalog, seed)
    expect(v.valid).toBe(false)
    expect(v.failures).toEqual([{ code: 'IDGRAPH', path: 's1:root' }])
  })

  it('a payload that RE-CREATES the surface starts fresh — its root delivery is legal despite the seed', () => {
    const recreate = [
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: 'fresh' }] },
      },
    ]
    expect(validateA2ui(recreate, demoCatalog, seed)).toEqual({ valid: true, failures: [] })
  })

  it('an UNSEEDED surface in the same call keeps the standalone judgment (seed never leaks across ids)', () => {
    const other = [
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's2', components: [{ id: 'lbl', component: 'Text', text: 'x' }] },
      },
    ]
    const v = validateA2ui(other, demoCatalog, seed)
    expect(v.valid).toBe(false)
    expect(v.failures.some((f) => f.code === 'IDGRAPH' && f.path === 's2:root-missing')).toBe(true)
  })
})
