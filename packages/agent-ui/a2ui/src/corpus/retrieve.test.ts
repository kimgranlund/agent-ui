import { describe, it, expect } from 'vitest'
import { retrieve } from './retrieve.ts'
import type { RetrieveQuery } from './retrieve.ts'
import type { CorpusRecord } from './record.ts'

// — fixtures ——————————————————————————————————————————————————————————————

function exemplar(opts: {
  name: string
  promptText: string
  componentsUsed?: string[]
  catalogId?: string
  protocolVersion?: string
  status?: CorpusRecord['meta']['status']
}): CorpusRecord {
  const catalogId = opts.catalogId ?? 'agent-ui'
  const protocolVersion = opts.protocolVersion ?? 'v1.0'
  return {
    name: opts.name,
    description: `exemplar: ${opts.name}`,
    promptText: opts.promptText,
    a2uiOutput: [{ version: protocolVersion, createSurface: { surfaceId: 's1', catalogId } }],
    meta: {
      facet: 'exemplar',
      protocolVersion,
      catalogId,
      provenance: { source: 'authored', origin: 'src/examples/fixture.ts' },
      status: opts.status ?? 'valid',
      componentsUsed: opts.componentsUsed,
    },
  }
}

function evalRecord(opts: { name: string; promptText: string; catalogId?: string; protocolVersion?: string }): CorpusRecord {
  return {
    name: opts.name,
    description: `eval: ${opts.name}`,
    promptText: opts.promptText,
    target: 'some target',
    meta: {
      facet: 'eval',
      protocolVersion: opts.protocolVersion ?? 'v1.0',
      catalogId: opts.catalogId ?? 'agent-ui',
      provenance: { source: 'authored', origin: 'src/examples/fixture-eval.ts' },
      status: 'valid',
    },
  }
}

function query(overrides: Partial<RetrieveQuery> & { intent: string }): RetrieveQuery {
  return { k: 5, catalogId: 'agent-ui', protocolVersion: 'v1.0', ...overrides }
}

// — happy path (LLD §13 s8) ——————————————————————————————————————————————

describe('retrieve — TF-IDF top-k ranking (SPEC-R11 AC1)', () => {
  it('ranks the unambiguous best textual match first, within the requested scope', () => {
    const loginForm = exemplar({
      name: 'ex-login-form',
      promptText: 'build a login form with a username and password field',
      componentsUsed: ['TextField', 'Button'],
    })
    const dashboard = exemplar({
      name: 'ex-dashboard',
      promptText: 'render an analytics dashboard with charts and a sidebar',
      componentsUsed: ['Card', 'Chart'],
    })
    const settings = exemplar({
      name: 'ex-settings',
      promptText: 'a settings page with toggles and a save button',
      componentsUsed: ['Switch', 'Button'],
    })

    const result = retrieve([dashboard, loginForm, settings], query({ intent: 'a login form with username and password' }))

    expect(result[0].name).toBe('ex-login-form')
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('truncates to k, keeping the top-scoring records', () => {
    const strong = exemplar({ name: 'ex-strong', promptText: 'login form username password submit' })
    const medium = exemplar({ name: 'ex-medium', promptText: 'login page with a submit button' })
    const weak = exemplar({ name: 'ex-weak', promptText: 'a completely unrelated calendar widget' })

    const result = retrieve([strong, medium, weak], query({ intent: 'login form username password', k: 2 }))

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.name)).toEqual(['ex-strong', 'ex-medium'])
  })

  it('never returns more than k even when every candidate matches', () => {
    const recs = [1, 2, 3, 4].map((i) => exemplar({ name: `ex-${i}`, promptText: 'a login form' }))
    const result = retrieve(recs, query({ intent: 'a login form', k: 2 }))
    expect(result).toHaveLength(2)
  })
})

describe('retrieve — scoping to catalogId/protocolVersion', () => {
  it('excludes a perfect textual match from a different catalogId', () => {
    const inScope = exemplar({ name: 'ex-in-scope', promptText: 'a login form' })
    const outOfScope = exemplar({ name: 'ex-out-of-scope', promptText: 'a login form', catalogId: 'other-catalog' })

    const result = retrieve([inScope, outOfScope], query({ intent: 'a login form' }))

    expect(result.map((r) => r.name)).toEqual(['ex-in-scope'])
  })

  it('excludes a perfect textual match from a different protocolVersion', () => {
    const inScope = exemplar({ name: 'ex-in-scope', promptText: 'a login form' })
    const outOfScope = exemplar({ name: 'ex-out-of-scope', promptText: 'a login form', protocolVersion: 'v0.9.1' })

    const result = retrieve([inScope, outOfScope], query({ intent: 'a login form' }))

    expect(result.map((r) => r.name)).toEqual(['ex-in-scope'])
  })
})

// — leak prevention (escalated exclusion — see retrieve.ts header) ————————————

describe('retrieve — quarantined and eval-facet records never leak', () => {
  it('excludes a quarantined record even when it is the best textual match', () => {
    const quarantined = exemplar({ name: 'ex-quarantined', promptText: 'a login form', status: 'quarantined' })
    const other = exemplar({ name: 'ex-other', promptText: 'a completely unrelated topic' })

    const result = retrieve([quarantined, other], query({ intent: 'a login form' }))

    expect(result.map((r) => r.name)).not.toContain('ex-quarantined')
  })

  it('excludes an eval-facet record even when it is the best textual match', () => {
    const evalLeak = evalRecord({ name: 'eval-login-form', promptText: 'a login form' })
    const other = exemplar({ name: 'ex-other', promptText: 'a completely unrelated topic' })

    const result = retrieve([evalLeak, other], query({ intent: 'a login form' }))

    expect(result.map((r) => r.name)).not.toContain('eval-login-form')
  })
})

// — edge cases (SPEC-R11 AC2 + degenerate-cosine handling) ————————————————

describe('retrieve — empty and degenerate inputs never throw', () => {
  it('an empty corpus returns []', () => {
    expect(retrieve([], query({ intent: 'anything' }))).toEqual([])
  })

  it('an empty scope (no record matches catalogId/protocolVersion) returns []', () => {
    const rec = exemplar({ name: 'ex-1', promptText: 'a login form', catalogId: 'other-catalog' })
    expect(retrieve([rec], query({ intent: 'a login form' }))).toEqual([])
  })

  it('a query with zero vocabulary overlap against the scope returns [] (no genuine match, not an arbitrary top-k)', () => {
    const rec = exemplar({ name: 'ex-1', promptText: 'alpha beta gamma' })
    expect(retrieve([rec], query({ intent: 'zzz qqq xyz' }))).toEqual([])
  })

  it('k <= 0 returns [] without throwing', () => {
    const rec = exemplar({ name: 'ex-1', promptText: 'a login form' })
    expect(() => retrieve([rec], query({ intent: 'a login form', k: 0 }))).not.toThrow()
    expect(retrieve([rec], query({ intent: 'a login form', k: 0 }))).toEqual([])
    expect(retrieve([rec], query({ intent: 'a login form', k: -3 }))).toEqual([])
  })
})

// — determinism (documented tie-break) ————————————————————————————————————

describe('retrieve — deterministic ordering with a documented tie-break', () => {
  it('breaks an exact score tie by ascending name', () => {
    const b = exemplar({ name: 'ex-b', promptText: 'a login form with a submit button' })
    const a = exemplar({ name: 'ex-a', promptText: 'a login form with a submit button' })

    const result = retrieve([b, a], query({ intent: 'a login form with a submit button', k: 2 }))

    expect(result.map((r) => r.name)).toEqual(['ex-a', 'ex-b'])
  })

  it('produces byte-identical results across repeated calls over the same inputs', () => {
    const recs = [
      exemplar({ name: 'ex-a', promptText: 'a login form with a submit button' }),
      exemplar({ name: 'ex-b', promptText: 'a login form with a submit button' }),
      exemplar({ name: 'ex-c', promptText: 'a dashboard with charts' }),
    ]
    const q = query({ intent: 'a login form with a submit button' })

    const first = retrieve(recs, q).map((r) => r.name)
    const second = retrieve(recs, q).map((r) => r.name)

    expect(second).toEqual(first)
  })
})

// — latency (SPEC-N2: ≤200ms p95 @ 10⁴ records) ——————————————————————————

describe('retrieve — SPEC-N2 latency budget', () => {
  it('scans 10⁴ synthetic records well within an order-of-magnitude-generous CI bound', () => {
    const vocabulary = [
      'login', 'form', 'dashboard', 'chart', 'settings', 'toggle', 'button', 'submit',
      'sidebar', 'card', 'field', 'password', 'username', 'analytics', 'calendar', 'widget',
      'table', 'row', 'column', 'modal', 'menu', 'select', 'checkbox', 'radio', 'slider', 'tab',
    ]
    const componentsPool = ['TextField', 'Button', 'Card', 'Chart', 'Switch', 'Modal', 'Menu']

    const records: CorpusRecord[] = []
    for (let i = 0; i < 10_000; i++) {
      const words: string[] = []
      for (let j = 0; j < 8; j++) words.push(vocabulary[(i * 7 + j * 13) % vocabulary.length])
      records.push(
        exemplar({
          name: `ex-synth-${i}`,
          promptText: words.join(' '),
          componentsUsed: [componentsPool[i % componentsPool.length]],
        }),
      )
    }

    const start = performance.now()
    const result = retrieve(records, query({ intent: 'login form username password submit', k: 10 }))
    const duration = performance.now() - start

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(10)
    // SPEC-N2's actual budget is 200ms p95 @ 10^4 records; this asserts the ORDER OF MAGNITUDE (5x
    // slack) so a slow CI runner doesn't flake while still catching a real algorithmic regression.
    expect(duration).toBeLessThan(1000)
  })
})

// ADR-0231 cl.4: the opt-in facet filter

// The pre-ADR-0231 implementation's output for every call shape above, captured before the `facet`
// field existed (ADR-0231 acceptance 5). Each entry rebuilds the same fixtures and calls `retrieve()`
// with NO `facet`, so the default (`exemplar`) must reproduce these names exactly, in order.
const PRE_CHANGE_CAPTURE: ReadonlyArray<{ shape: string; call: () => CorpusRecord[]; names: readonly string[] }> = [
  {
    shape: 'ranks-best-first',
    call: () =>
      retrieve(
        [
          exemplar({ name: 'ex-dashboard', promptText: 'render an analytics dashboard with charts and a sidebar', componentsUsed: ['Card', 'Chart'] }),
          exemplar({ name: 'ex-login-form', promptText: 'build a login form with a username and password field', componentsUsed: ['TextField', 'Button'] }),
          exemplar({ name: 'ex-settings', promptText: 'a settings page with toggles and a save button', componentsUsed: ['Switch', 'Button'] }),
        ],
        query({ intent: 'a login form with username and password' }),
      ),
    names: ['ex-login-form', 'ex-settings', 'ex-dashboard'],
  },
  {
    shape: 'truncates-to-k',
    call: () =>
      retrieve(
        [
          exemplar({ name: 'ex-strong', promptText: 'login form username password submit' }),
          exemplar({ name: 'ex-medium', promptText: 'login page with a submit button' }),
          exemplar({ name: 'ex-weak', promptText: 'a completely unrelated calendar widget' }),
        ],
        query({ intent: 'login form username password', k: 2 }),
      ),
    names: ['ex-strong', 'ex-medium'],
  },
  {
    shape: 'never-more-than-k',
    call: () => retrieve([1, 2, 3, 4].map((i) => exemplar({ name: `ex-${i}`, promptText: 'a login form' })), query({ intent: 'a login form', k: 2 })),
    names: ['ex-1', 'ex-2'],
  },
  {
    shape: 'scope-catalog',
    call: () =>
      retrieve(
        [exemplar({ name: 'ex-in-scope', promptText: 'a login form' }), exemplar({ name: 'ex-out-of-scope', promptText: 'a login form', catalogId: 'other-catalog' })],
        query({ intent: 'a login form' }),
      ),
    names: ['ex-in-scope'],
  },
  {
    shape: 'scope-version',
    call: () =>
      retrieve(
        [exemplar({ name: 'ex-in-scope', promptText: 'a login form' }), exemplar({ name: 'ex-out-of-scope', promptText: 'a login form', protocolVersion: 'v0.9.1' })],
        query({ intent: 'a login form' }),
      ),
    names: ['ex-in-scope'],
  },
  {
    shape: 'quarantined',
    call: () =>
      retrieve(
        [exemplar({ name: 'ex-quarantined', promptText: 'a login form', status: 'quarantined' }), exemplar({ name: 'ex-other', promptText: 'a completely unrelated topic' })],
        query({ intent: 'a login form' }),
      ),
    names: ['ex-other'],
  },
  {
    shape: 'eval-leak',
    call: () =>
      retrieve(
        [evalRecord({ name: 'eval-login-form', promptText: 'a login form' }), exemplar({ name: 'ex-other', promptText: 'a completely unrelated topic' })],
        query({ intent: 'a login form' }),
      ),
    names: ['ex-other'],
  },
  { shape: 'empty-corpus', call: () => retrieve([], query({ intent: 'anything' })), names: [] },
  {
    shape: 'empty-scope',
    call: () => retrieve([exemplar({ name: 'ex-1', promptText: 'a login form', catalogId: 'other-catalog' })], query({ intent: 'a login form' })),
    names: [],
  },
  {
    shape: 'zero-overlap',
    call: () => retrieve([exemplar({ name: 'ex-1', promptText: 'alpha beta gamma' })], query({ intent: 'zzz qqq xyz' })),
    names: [],
  },
  {
    shape: 'k-zero',
    call: () => retrieve([exemplar({ name: 'ex-1', promptText: 'a login form' })], query({ intent: 'a login form', k: 0 })),
    names: [],
  },
  {
    shape: 'k-negative',
    call: () => retrieve([exemplar({ name: 'ex-1', promptText: 'a login form' })], query({ intent: 'a login form', k: -3 })),
    names: [],
  },
  {
    shape: 'tie-break',
    call: () =>
      retrieve(
        [exemplar({ name: 'ex-b', promptText: 'a login form with a submit button' }), exemplar({ name: 'ex-a', promptText: 'a login form with a submit button' })],
        query({ intent: 'a login form with a submit button', k: 2 }),
      ),
    names: ['ex-a', 'ex-b'],
  },
  {
    shape: 'repeat-calls',
    call: () =>
      retrieve(
        [
          exemplar({ name: 'ex-a', promptText: 'a login form with a submit button' }),
          exemplar({ name: 'ex-b', promptText: 'a login form with a submit button' }),
          exemplar({ name: 'ex-c', promptText: 'a dashboard with charts' }),
        ],
        query({ intent: 'a login form with a submit button' }),
      ),
    names: ['ex-a', 'ex-b', 'ex-c'],
  },
  {
    shape: 'synthetic-10k',
    call: () => {
      const vocabulary = [
        'login', 'form', 'dashboard', 'chart', 'settings', 'toggle', 'button', 'submit',
        'sidebar', 'card', 'field', 'password', 'username', 'analytics', 'calendar', 'widget',
        'table', 'row', 'column', 'modal', 'menu', 'select', 'checkbox', 'radio', 'slider', 'tab',
      ]
      const componentsPool = ['TextField', 'Button', 'Card', 'Chart', 'Switch', 'Modal', 'Menu']
      const records: CorpusRecord[] = []
      for (let i = 0; i < 10_000; i++) {
        const words: string[] = []
        for (let j = 0; j < 8; j++) words.push(vocabulary[(i * 7 + j * 13) % vocabulary.length])
        records.push(exemplar({ name: `ex-synth-${i}`, promptText: words.join(' '), componentsUsed: [componentsPool[i % componentsPool.length]] }))
      }
      return retrieve(records, query({ intent: 'login form username password submit', k: 10 }))
    },
    names: [
      'ex-synth-1', 'ex-synth-1002', 'ex-synth-1067', 'ex-synth-1080', 'ex-synth-1093',
      'ex-synth-1158', 'ex-synth-1171', 'ex-synth-1184', 'ex-synth-1249', 'ex-synth-1262',
    ],
  },
]

/** A record of a non-exemplar model-visible facet, otherwise shaped like `exemplar()`. */
function ofFacet(facet: 'multi-turn' | 'repair', name: string, promptText: string): CorpusRecord {
  const base = exemplar({ name, promptText })
  return { ...base, meta: { ...base.meta, facet } }
}

describe('retrieve: the ADR-0231 opt-in facet filter (default exemplar)', () => {
  it.each(PRE_CHANGE_CAPTURE.map((c) => [c.shape, c] as const))(
    'with no facet argument, the %s call shape deep-equals the pre-change capture',
    (_shape, c) => {
      expect(c.call().map((r) => r.name)).toEqual(c.names)
    },
  )

  it('the default scope excludes multi-turn and repair records even when they are the best textual match', () => {
    const recs = [
      ofFacet('multi-turn', 'mt-login', 'a login form'),
      ofFacet('repair', 'rp-login', 'a login form'),
      exemplar({ name: 'ex-login', promptText: 'a login form page' }),
    ]
    expect(retrieve(recs, query({ intent: 'a login form' })).map((r) => r.name)).toEqual(['ex-login'])
  })

  it('facet: "multi-turn" and facet: "repair" each draw from that facet only', () => {
    const recs = [
      ofFacet('multi-turn', 'mt-login', 'a login form'),
      ofFacet('repair', 'rp-login', 'a login form'),
      exemplar({ name: 'ex-login', promptText: 'a login form' }),
      evalRecord({ name: 'eval-login', promptText: 'a login form' }),
    ]
    expect(retrieve(recs, query({ intent: 'a login form', facet: 'multi-turn' })).map((r) => r.name)).toEqual(['mt-login'])
    expect(retrieve(recs, query({ intent: 'a login form', facet: 'repair' })).map((r) => r.name)).toEqual(['rp-login'])
    expect(retrieve(recs, query({ intent: 'a login form', facet: 'exemplar' })).map((r) => r.name)).toEqual(['ex-login'])
  })

  it('a quarantined record of the named facet stays excluded', () => {
    const quarantined = ofFacet('repair', 'rp-q', 'a login form')
    const recs = [{ ...quarantined, meta: { ...quarantined.meta, status: 'quarantined' as const } }]
    expect(retrieve(recs, query({ intent: 'a login form', facet: 'repair' }))).toEqual([])
  })
})
