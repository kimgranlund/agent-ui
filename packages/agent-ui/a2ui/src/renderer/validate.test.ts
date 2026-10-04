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

// ── ADR-0187 / GH #829 — the finalize signal (`opts.atFinalize`) ───────────────────────────────────

describe('validateA2ui — ADR-0187 atFinalize: the abandoned-createSurface judgment (GH #829/#802)', () => {
  // GH #829 Findings 1's headless repro, verbatim in shape: a complete working card (`s1`) beside a
  // second surface created and never given ANY updateComponents (`s2`) — the exact wire shape behind
  // #802's "empty second ui-surface-host beside a working card" screenshots.
  const repro = [
    { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
    {
      version: 'v1.0',
      updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: 'hi' }] },
    },
    { version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'demo' } },
  ]

  it('DEFAULT mode: the #829 repro still validates CLEAN — the ratified prefix laws are untouched', () => {
    // The regression contract (ADR-0187 §1): absent the flag, byte-identical to the pre-ADR validator.
    expect(validateA2ui(repro, demoCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('atFinalize: the #829 repro fails with EXACTLY `IDGRAPH s2:root-missing` — the existing code reused', () => {
    // LLD §5: no new failure code. The abandoned surface IS the missing-root class judged at finalize
    // granularity — so the renderer's IDGRAPH-only filter, the §9 wire mapping and `A2uiWireError` all
    // stay unmodified (zero wire widening).
    expect(validateA2ui(repro, demoCatalog, undefined, { atFinalize: true })).toEqual({
      valid: false,
      failures: [{ code: 'IDGRAPH', path: 's2:root-missing' }],
    })
  })

  it('atFinalize: a COMPLETE payload is unaffected — the working card alone stays valid either way', () => {
    const complete = repro.slice(0, 2)
    expect(validateA2ui(complete, demoCatalog, undefined, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    expect(validateA2ui(complete, demoCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('atFinalize:false and an empty bag are byte-identical to omitting the bag entirely', () => {
    expect(validateA2ui(repro, demoCatalog, undefined, { atFinalize: false })).toEqual(validateA2ui(repro, demoCatalog))
    expect(validateA2ui(repro, demoCatalog, undefined, {})).toEqual(validateA2ui(repro, demoCatalog))
  })

  it('registration is behavior-neutral ALONE: a bare createSurface is now VISITED, still exempt by default', () => {
    // The half the reverted mechanical fix got right (ADR-0187 §2). `createSurface` now calls
    // `surfaceOf`, so the id-graph loop VISITS the sid — the empty-set early return is what keeps the
    // default verdict clean, not invisibility. Proven by the pair: one payload, two modes, two verdicts.
    const bare = [{ version: 'v1.0', createSurface: { surfaceId: 'only', catalogId: 'demo' } }]
    expect(validateA2ui(bare, demoCatalog)).toEqual({ valid: true, failures: [] })
    expect(validateA2ui(bare, demoCatalog, undefined, { atFinalize: true })).toEqual({
      valid: false,
      failures: [{ code: 'IDGRAPH', path: 'only:root-missing' }],
    })
  })

  it('a surfaceId-less createSurface is never double-flagged — no IDGRAPH rides along', () => {
    // ADR-0187 §2's gate: registration requires `surfaceId` to be a string, so a line already flagged
    // SCHEMA for its missing id cannot also collect a root-missing (no id exists to name it against).
    const noSid = [{ version: 'v1.0', createSurface: { catalogId: 'demo' } }]
    expect(codes(validateA2ui(noSid, demoCatalog, undefined, { atFinalize: true }))).toEqual(['SCHEMA'])
    // A VALID surfaceId with a missing catalogId keeps its own SCHEMA failure AND gains the finalize
    // judgment — the surface genuinely was created empty; the two failures state different facts.
    const noCatalog = [{ version: 'v1.0', createSurface: { surfaceId: 'sx' } }]
    expect(validateA2ui(noCatalog, demoCatalog, undefined, { atFinalize: true }).failures).toEqual([
      { code: 'SCHEMA', path: '[0].createSurface.catalogId' },
      { code: 'IDGRAPH', path: 'sx:root-missing' },
    ])
  })

  it('an UNSUPPORTED-version createSurface never registers — the version gate returns first', () => {
    const badVersion = [{ version: 'v0.0.1', createSurface: { surfaceId: 'sv', catalogId: 'demo' } }]
    expect(codes(validateA2ui(badVersion, demoCatalog, undefined, { atFinalize: true }))).toEqual([
      'VERSION_UNSUPPORTED',
    ])
  })

  // — the ONE new edge (LLD §3 mechanic 4) —
  it('same-payload create-then-DELETE is excluded: nothing mounted is nothing abandoned', () => {
    const createThenDelete = [
      { version: 'v1.0', createSurface: { surfaceId: 'gone', catalogId: 'demo' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 'gone' } },
    ]
    expect(validateA2ui(createThenDelete, demoCatalog, undefined, { atFinalize: true })).toEqual({
      valid: true,
      failures: [],
    })
    // The exclusion is SCOPED to the deleted sid — an abandoned sibling in the same payload still fails.
    const oneDeletedOneAbandoned = [
      ...createThenDelete,
      { version: 'v1.0', createSurface: { surfaceId: 'stray', catalogId: 'demo' } },
    ]
    expect(validateA2ui(oneDeletedOneAbandoned, demoCatalog, undefined, { atFinalize: true }).failures).toEqual([
      { code: 'IDGRAPH', path: 'stray:root-missing' },
    ])
  })

  it('the delete exclusion is finalize-ONLY — a delete never softens a default-mode verdict', () => {
    // A dangling-ref payload followed by a delete of the same surface still fails in BOTH modes: the
    // delete closes a NON-empty epoch, which is judged in full (ADR-0064 amendment A3; LLD §3 mechanic 4,
    // formerly `deletedHere`).
    const danglingThenDelete = [
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 'd1', components: [{ id: 'root', component: 'Column', children: ['ghost'] }] },
      },
      { version: 'v1.0', deleteSurface: { surfaceId: 'd1' } },
    ]
    const expected = { valid: false, failures: [{ code: 'IDGRAPH', path: 'root->ghost' }] }
    expect(validateA2ui(danglingThenDelete, demoCatalog)).toEqual(expected)
    expect(validateA2ui(danglingThenDelete, demoCatalog, undefined, { atFinalize: true })).toEqual(expected)
  })

  // — TKT-0081 seed composition: no new carve-out (ADR-0187 §5 / LLD §3 mechanic 2) —
  describe('composition with the TKT-0081 sessionSeed — no carve-out needed', () => {
    const seed = new Map([
      ['known', { components: [{ id: 'root', component: 'Text', text: 'prior' }], rootDelivered: true }],
    ])

    it('a session-known surface this payload TOUCHED merges its prior graph — never judged empty', () => {
      const touch = [
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 'known', components: [{ id: 'extra', component: 'Text', text: 'x' }] },
        },
      ]
      expect(validateA2ui(touch, demoCatalog, seed, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    })

    it('an UNTOUCHED seeded surface never enters the judged set — a data-only round stays clean', () => {
      const dataOnly = [{ version: 'v1.0', updateDataModel: { surfaceId: 'known', path: '/a', value: 1 } }]
      expect(validateA2ui(dataOnly, demoCatalog, seed, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    })

    it('a RE-CREATED-then-abandoned seeded surface is judged standalone — exactly the defect', () => {
      // `createdHere` makes the seed inapplicable (GH #307 F2), so a prior turn's root does NOT rescue
      // an empty re-create. This composition is what the ADR's "no new carve-out" ruling turns on.
      const recreateEmpty = [{ version: 'v1.0', createSurface: { surfaceId: 'known', catalogId: 'demo' } }]
      expect(validateA2ui(recreateEmpty, demoCatalog, seed, { atFinalize: true }).failures).toEqual([
        { code: 'IDGRAPH', path: 'known:root-missing' },
      ])
      // …and stays clean in default mode, seed or no seed.
      expect(validateA2ui(recreateEmpty, demoCatalog, seed)).toEqual({ valid: true, failures: [] })
    })

    it('a re-create that DOES deliver root in the same payload is valid at finalize', () => {
      const recreateFull = [
        { version: 'v1.0', createSurface: { surfaceId: 'known', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 'known', components: [{ id: 'root', component: 'Text', text: 'fresh' }] },
        },
      ]
      expect(validateA2ui(recreateFull, demoCatalog, seed, { atFinalize: true })).toEqual({ valid: true, failures: [] })
    })
  })
})

// ── ADR-0064 amendment (2026-10-03, A2 to A4) / GH #1740: surface epochs ─────────────────────────────
//
// The renderer frees a surface's whole graph at `deleteSurface`, so a later `root` for the same id is a
// first delivery, not a resend. The validator mirrors it: an epoch opens at `createSurface` (or the first
// `updateComponents` to a never-deleted surface) and closes at `deleteSurface`; each epoch is judged on
// its own graph. After a delete only `createSurface` reopens the id (the amendment's 2026-10-04 erratum:
// the renderer drops a delivery to a deleted surface). The numbered legs are the amendment's §Acceptance
// items; each runs in BOTH modes where the item says so.
describe('validateA2ui: ADR-0064 amendment surface epochs (delete frees the id graph, GH #1740)', () => {
  const create = (sid = 's', catalogId = 'demo') => ({ version: 'v1.0', createSurface: { surfaceId: sid, catalogId } })
  const del = (sid = 's') => ({ version: 'v1.0', deleteSurface: { surfaceId: sid } })
  const comps = (components: Record<string, unknown>[], sid = 's') => ({
    version: 'v1.0',
    updateComponents: { surfaceId: sid, components },
  })
  const rootText = (text = 'hi') => comps([{ id: 'root', component: 'Text', text }])
  const both = (payload: unknown[]) => ({
    default: validateA2ui(payload, demoCatalog),
    finalize: validateA2ui(payload, demoCatalog, undefined, { atFinalize: true }),
  })
  const CLEAN = { valid: true, failures: [] }

  it('Acceptance 1: create, root, delete, create, root VALIDATES in both modes (the second root is a first delivery)', () => {
    const v = both([create(), rootText('one'), del(), create(), rootText('two')])
    expect(v.default).toEqual(CLEAN)
    expect(v.finalize).toEqual(CLEAN)
  })

  it('negative control: the SAME stream without the delete fails `s:root` (the delete is what legalizes it)', () => {
    const v = both([create(), rootText('one'), create(), rootText('two')])
    expect(v.default.failures).toEqual([{ code: 'IDGRAPH', path: 's:root' }])
    expect(v.finalize.failures).toEqual([{ code: 'IDGRAPH', path: 's:root' }])
  })

  it('Acceptance 2: without the second root it fails EXACTLY `IDGRAPH s:root-missing` at finalize, passes in default mode (A3)', () => {
    const v = both([create(), rootText(), del(), create()])
    expect(v.finalize).toEqual({ valid: false, failures: [{ code: 'IDGRAPH', path: 's:root-missing' }] })
    expect(v.default).toEqual(CLEAN)
  })

  it('Acceptance 3: create, delete (nothing after) still passes at finalize, the empty closed epoch A3 keeps exempt', () => {
    const v = both([create(), del()])
    expect(v.finalize).toEqual(CLEAN)
    expect(v.default).toEqual(CLEAN)
  })

  it('Acceptance 3b: create, root, delete (nothing after) passes at finalize, a non-empty closed epoch judged clean', () => {
    const v = both([create(), rootText(), del()])
    expect(v.finalize).toEqual(CLEAN)
    expect(v.default).toEqual(CLEAN)
  })

  it('3b counterpart: a NON-empty closed epoch is judged in full, so a rootless one fails `s:root-missing` in BOTH modes', () => {
    const v = both([create(), comps([{ id: 'lbl', component: 'Text', text: 'x' }]), del()])
    expect(v.default.failures).toEqual([{ code: 'IDGRAPH', path: 's:root-missing' }])
    expect(v.finalize.failures).toEqual([{ code: 'IDGRAPH', path: 's:root-missing' }])
  })

  it('Acceptance 4: root twice with no intervening deleteSurface still fails `IDGRAPH s:root` (the resend rule is untouched)', () => {
    const v = both([create(), rootText('one'), rootText('two')])
    expect(v.default.failures).toEqual([{ code: 'IDGRAPH', path: 's:root' }])
    expect(v.finalize.failures).toEqual([{ code: 'IDGRAPH', path: 's:root' }])
  })

  it('Acceptance 5: a dangling child in epoch 1 followed by deleteSurface fails `IDGRAPH root->ghost`, even with a clean epoch 2', () => {
    const v = both([create(), comps([{ id: 'root', component: 'Column', children: ['ghost'] }]), del(), create(), rootText()])
    const expected = { valid: false, failures: [{ code: 'IDGRAPH', path: 'root->ghost' }] }
    expect(v.default).toEqual(expected)
    expect(v.finalize).toEqual(expected)
  })

  it('epoch 2 does NOT see epoch 1: a reference to an id only epoch 1 delivered dangles (the graph was freed)', () => {
    const payload = [
      create(),
      comps([
        { id: 'root', component: 'Column', children: ['old'] },
        { id: 'old', component: 'Text', text: 'gone after the delete' },
      ]),
      del(),
      create(),
      comps([{ id: 'root', component: 'Column', children: ['old'] }]),
    ]
    const v = both(payload)
    expect(v.default.failures).toEqual([{ code: 'IDGRAPH', path: 'root->old' }])
    expect(v.finalize.failures).toEqual([{ code: 'IDGRAPH', path: 'root->old' }])
  })

  it('failures from two epochs report in stream order with the SAME path shapes a single epoch uses', () => {
    const payload = [
      create(),
      comps([{ id: 'lbl', component: 'Text', text: 'no root here' }]),
      del(),
      create(),
      comps([{ id: 'root', component: 'Column', children: ['ghost'] }]),
    ]
    expect(validateA2ui(payload, demoCatalog).failures).toEqual([
      { code: 'IDGRAPH', path: 's:root-missing' },
      { code: 'IDGRAPH', path: 'root->ghost' },
    ])
  })

  it('erratum: a delivery after a delete with NO new createSurface fails `s:update-after-delete` (the renderer drops it)', () => {
    // `renderer.ts#onUpdateComponents` no-ops for a deleted surface, so this root never mounts. Only a
    // `createSurface` reopens a deleted sid; the dropped delivery joins no graph, so nothing else fires.
    const v = both([create(), rootText('one'), del(), rootText('two')])
    const expected = { valid: false, failures: [{ code: 'IDGRAPH', path: 's:update-after-delete' }] }
    expect(v.default).toEqual(expected)
    expect(v.finalize).toEqual(expected)
  })

  it('erratum: an updateDataModel to a deleted surface fails the same way; a never-deleted one is untouched', () => {
    const data = (sid = 's') => ({ version: 'v1.0', updateDataModel: { surfaceId: sid, value: { a: 1 } } })
    expect(validateA2ui([create(), rootText(), del(), data()], demoCatalog).failures).toEqual([
      { code: 'IDGRAPH', path: 's:update-after-delete' },
    ])
    // Negative controls: the same data write BEFORE the delete, or after a re-create, is clean.
    expect(validateA2ui([create(), rootText(), data(), del()], demoCatalog)).toEqual(CLEAN)
    expect(validateA2ui([create(), rootText(), del(), create(), data(), rootText()], demoCatalog)).toEqual(CLEAN)
  })

  it('erratum: the rejection reports at the dropped message, once per message, and the re-create clears it', () => {
    const payload = [
      create(),
      rootText('one'),
      del(),
      comps([{ id: 'root', component: 'Column', children: ['ghost'] }]), // dropped: its dangling ref is never judged
      rootText('two'), // dropped too
      create(),
      rootText('three'), // a first delivery to the re-created surface
    ]
    expect(validateA2ui(payload, demoCatalog, undefined, { atFinalize: true }).failures).toEqual([
      { code: 'IDGRAPH', path: 's:update-after-delete' },
      { code: 'IDGRAPH', path: 's:update-after-delete' },
    ])
  })

  it('erratum: a never-created, never-deleted surface keeps the implicit open (non-delete verdicts unchanged)', () => {
    expect(validateA2ui([rootText()], demoCatalog, undefined, { atFinalize: true })).toEqual(CLEAN)
    // A delete of a DIFFERENT surface does not touch it.
    expect(validateA2ui([del('other'), rootText()], demoCatalog, undefined, { atFinalize: true })).toEqual(CLEAN)
  })

  it('order now matters (A3): delete then create with nothing after is an empty OPEN epoch, so it fails at finalize', () => {
    // The former order-insensitive same-payload delete set passed this; the open epoch is what the
    // renderer would be showing, an empty surface, so it is the abandoned-surface defect.
    const v = both([del(), create()])
    expect(v.finalize).toEqual({ valid: false, failures: [{ code: 'IDGRAPH', path: 's:root-missing' }] })
    expect(v.default).toEqual(CLEAN)
  })

  it('the multi-turn follow-up shape (delete, create, root) validates in both modes', () => {
    const v = both([del(), create(), rootText()])
    expect(v.default).toEqual(CLEAN)
    expect(v.finalize).toEqual(CLEAN)
  })

  it('a leading delete never moves a surface in the report order (it registers nothing)', () => {
    // `a` is deleted first but only re-OPENED (by its createSurface) after `b`, so `b`'s failure still
    // reports first.
    const payload = [
      del('a'),
      comps([{ id: 'lbl', component: 'Text', text: 'x' }], 'b'),
      create('a'),
      comps([{ id: 'lbl', component: 'Text', text: 'y' }], 'a'),
    ]
    expect(validateA2ui(payload, demoCatalog).failures).toEqual([
      { code: 'IDGRAPH', path: 'b:root-missing' },
      { code: 'IDGRAPH', path: 'a:root-missing' },
    ])
  })

  it('a surfaceId-less deleteSurface is SCHEMA only and closes nothing (the resend after it still fails)', () => {
    const payload = [create(), rootText('one'), { version: 'v1.0', deleteSurface: {} }, rootText('two')]
    expect(validateA2ui(payload, demoCatalog).failures).toEqual([
      { code: 'SCHEMA', path: '[2].deleteSurface.surfaceId' },
      { code: 'IDGRAPH', path: 's:root' },
    ])
  })

  it("containment is per epoch: epoch 1's stray region still fails though epoch 2 re-roots it under a Card", () => {
    const payload = [
      create('s', 'agent-ui'),
      comps([
        { id: 'root', component: 'Column', children: ['hdr'] },
        { id: 'hdr', component: 'CardHeader', children: [] },
      ]),
      del(),
      create('s', 'agent-ui'),
      comps([
        { id: 'root', component: 'Card', elevation: '1', children: ['hdr'] },
        { id: 'hdr', component: 'CardHeader', children: [] },
      ]),
    ]
    // One merged graph would last-write-win `root` to the Card (hiding the defect) and count two roots.
    expect(validateA2ui(payload, defaultCatalog).failures).toEqual([{ code: 'CONTAINMENT', path: 'hdr' }])
  })

  describe('the TKT-0081 seed under epochs (A4)', () => {
    const seed = new Map([['s', { components: [{ id: 'root', component: 'Text', text: 'prior' }], rootDelivered: true }]])

    it('a delete frees the seeded graph: delete, create, root validates (the new root is a first delivery)', () => {
      expect(validateA2ui([del(), create(), rootText('fresh')], demoCatalog, seed, { atFinalize: true })).toEqual(CLEAN)
    })

    it('erratum: delete, root with NO create fails `s:update-after-delete`, seed or not (the renderer drops it)', () => {
      for (const s of [seed, undefined]) {
        expect(validateA2ui([del(), rootText('fresh')], demoCatalog, s, { atFinalize: true }).failures).toEqual([
          { code: 'IDGRAPH', path: 's:update-after-delete' },
        ])
      }
    })

    it('negative control: the same root WITHOUT the delete is the seeded resend, `s:root`', () => {
      expect(validateA2ui([rootText('fresh')], demoCatalog, seed, { atFinalize: true }).failures).toEqual([
        { code: 'IDGRAPH', path: 's:root' },
      ])
    })

    it('the seed continues the first epoch only: update, delete, create, root validates (epoch 1 seeded, epoch 2 fresh)', () => {
      const payload = [comps([{ id: 'extra', component: 'Text', text: 'x' }]), del(), create(), rootText('fresh')]
      expect(validateA2ui(payload, demoCatalog, seed, { atFinalize: true })).toEqual(CLEAN)
      // Without the seed, epoch 1 (a lone `extra`, no root) is judged standalone and fails.
      expect(validateA2ui(payload, demoCatalog, undefined, { atFinalize: true }).failures).toEqual([
        { code: 'IDGRAPH', path: 's:root-missing' },
      ])
    })
  })
})
