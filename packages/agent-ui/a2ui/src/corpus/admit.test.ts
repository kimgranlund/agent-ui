import { describe, it, expect } from 'vitest'
import { admit } from './admit.ts'
import type { AdmitDeps } from './admit.ts'
import { createStore } from './store.ts'
import { createDedupIndex, minHashSignature } from './dedup.ts'
import { canonicalize } from './canonical.ts'
import { validateA2ui } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'
import type { A2uiOutput } from '../protocol.ts'

// admit.test.ts — the admission pipeline (corpus LLD-C5, SPEC-R5-R9, ADR-0060/0061/0063). The LLD §8
// error table is the test matrix: E_SCHEMA · E_PIN · E_CATALOG · E_IDGRAPH · E_POINTER (syntax AND
// resolution) · E_DUP · E_LEAK (eval-fail-closed AND the leak-gate collision) · E_QUALITY.

const DEFAULT_OUTPUT: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
  { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: 'Click me' }] } },
]

interface CandidateOverrides {
  name?: string
  description?: string
  promptText?: string
  a2uiOutput?: unknown
  meta?: Record<string, unknown>
}

function mkCandidate(overrides: CandidateOverrides = {}): unknown {
  return {
    name: overrides.name ?? 'sample',
    description: overrides.description ?? 'a sample record',
    promptText: overrides.promptText ?? 'build me a button',
    a2uiOutput: overrides.a2uiOutput ?? DEFAULT_OUTPUT,
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId: 'demo',
      provenance: { source: 'authored', origin: 'test-fixture' },
      ...overrides.meta,
    },
  }
}

/** An eval candidate never carries `a2uiOutput` — built separately so `mkCandidate`'s default output
 * (which `??` cannot be overridden to `undefined`) never leaks in. */
function mkEvalCandidate(overrides: CandidateOverrides = {}): unknown {
  return {
    name: overrides.name ?? 'eval-sample',
    description: overrides.description ?? 'an eval sample',
    promptText: overrides.promptText ?? 'what should the button say?',
    target: 'something encouraging',
    meta: {
      facet: 'eval',
      protocolVersion: 'v1.0',
      catalogId: 'demo',
      provenance: { source: 'authored', origin: 'test-fixture' },
      ...overrides.meta,
    },
  }
}

function mkDeps(): AdmitDeps {
  return { catalog: demoCatalog, store: createStore(), dedupIndex: createDedupIndex() }
}

describe('admit — the admission pipeline (LLD-C5)', () => {
  it('admits a well-formed candidate: status:"valid", canonicalHash + componentsUsed filled, no judge -> qualityScore absent', async () => {
    const deps = mkDeps()
    const result = await admit(mkCandidate(), deps)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.meta.status).toBe('valid')
    expect(result.record.meta.canonicalHash).toBeTypeOf('string')
    expect(result.record.meta.componentsUsed).toEqual(['Button'])
    expect(result.record.meta.qualityScore).toBeUndefined()
    expect(result.repairs).toEqual([])
    expect(deps.store.get('sample')).toEqual(result.record)
  })

  it('a non-object candidate rejects E_SCHEMA (totality guard — admit never throws)', async () => {
    const result = await admit('not an object', mkDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_SCHEMA')
  })

  describe('E_SCHEMA', () => {
    it('a missing required field rejects with the failing path (ADR-0063: description unconditional)', async () => {
      const candidate = mkCandidate() as Record<string, unknown>
      delete candidate.description
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_SCHEMA')
      expect(result.paths).toContain('description')
    })

    it('heal ok:false (non-JSON a2uiOutput text) rejects E_SCHEMA', async () => {
      const candidate = mkCandidate({ a2uiOutput: 'sorry, not a UI payload at all.' })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_SCHEMA')
      expect(result.message).toMatch(/heal/)
    })
  })

  it('a caller-supplied meta.status is ignored — admission is the sole authority (ADR-0055 seed-mapping note)', async () => {
    const result = await admit(mkCandidate({ meta: { status: 'quarantined' } }), mkDeps())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.meta.status).toBe('valid') // recomputed, not the caller's 'quarantined'
  })

  describe('heal integration (ADR-0061)', () => {
    it('heal changed:true -> status:"repaired", the repairs travel in the result', async () => {
      const fenced =
        '```json\n[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}},' +
        '{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[{"id":"root","component":"Button","label":"Click me"}]}}]\n```'
      const result = await admit(mkCandidate({ a2uiOutput: fenced }), mkDeps())
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.record.meta.status).toBe('repaired')
      expect(result.repairs).toContain('fence-strip')
    })
  })

  describe('E_PIN', () => {
    it('a message version disagreeing with meta.protocolVersion rejects (LLD-C2 pin-consistency check)', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v0.9.1', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: 'x' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_PIN')
    })

    it('an unsupported protocol version rejects E_PIN via tier-1 VERSION_UNSUPPORTED (LLD §6 mapping)', async () => {
      const candidate = mkCandidate({
        meta: { protocolVersion: 'v9.9' },
        a2uiOutput: [
          { version: 'v9.9', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v9.9', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: 'x' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_PIN')
    })
  })

  describe('E_LEAK — the ADR-0060 facet gate (eval fail-closed)', () => {
    it('an otherwise well-formed eval-facet candidate fails closed', async () => {
      const result = await admit(mkEvalCandidate(), mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_LEAK')
      expect(result.message).toMatch(/fail-closed/)
    })
  })

  describe('E_LEAK — the leak gate (LLD-C4 MinHash vs the held-out eval corpus)', () => {
    it('an exemplar candidate whose promptText collides with a held-out eval prompt rejects', async () => {
      const deps = mkDeps()
      // Simulate "if LLD-C8 existed": seed an eval record directly (bypassing admit(), which itself
      // can never admit one — this proves the SEPARATE, later leak-gate stage's own mechanism).
      deps.store.put({
        name: 'held-out-eval',
        description: 'x',
        promptText: 'build me a button', // identical to mkCandidate()'s default promptText
        meta: {
          facet: 'eval',
          protocolVersion: 'v1.0',
          catalogId: 'demo',
          provenance: { source: 'authored', origin: 'x' },
          status: 'valid',
        },
      })
      const result = await admit(mkCandidate(), deps)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_LEAK')
      expect(result.message).toContain('held-out-eval')
    })

    it('is vacuously satisfied when no eval records exist (the default state until LLD-C8 lands)', async () => {
      const result = await admit(mkCandidate(), mkDeps())
      expect(result.ok).toBe(true)
    })
  })

  describe('E_CATALOG (tier-1)', () => {
    it('an unknown component type rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'NotReal' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_CATALOG')
    })
  })

  describe('E_IDGRAPH (tier-1)', () => {
    it('a missing root rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'notroot', component: 'Button', label: 'x' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_IDGRAPH')
    })
  })

  describe('E_POINTER — syntax (tier-1, shared validateA2ui)', () => {
    it('a malformed JSON pointer (a bad ~ escape) rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: { path: '~bad' } }] },
          },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
    })
  })

  describe('E_POINTER — resolution (corpus-only, LLD §6/§7)', () => {
    it('an absolute binding that does not resolve against the bundled data model rejects (no updateDataModel at all)', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: { path: '/missing' } }] },
          },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
      expect(result.paths).toContain('root.label')
    })

    it('a relative binding with no enclosing list-item scope has nothing to resolve against — rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: { path: 'somename' } }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
    })

    it('a relative binding INSIDE a dynamic-list child template resolves through the witness element (index 0, ADR-0024) — positive control', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: { path: '/items', componentId: 'item-tpl' } },
                { id: 'item-tpl', component: 'Text', text: { path: 'name' } },
              ],
            },
          },
          { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/items', value: [{ name: 'Alice' }, { name: 'Bob' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(true)
    })

    it('a relative binding inside a template that does NOT resolve against the witness element rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: { path: '/items', componentId: 'item-tpl' } },
                { id: 'item-tpl', component: 'Text', text: { path: 'nonexistent' } },
              ],
            },
          },
          { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/items', value: [{ name: 'Alice' }, { name: 'Bob' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
      expect(result.paths).toContain('item-tpl.text')
    })

    it("a relative binding on a DESCENDANT of the template target (not the target itself) resolves through the outer witness element — regression (s7 import failures: list-nested's section_title, pattern-dashboard-tiles' tile_label)", async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: { path: '/sections', componentId: 'section-tpl' } },
                { id: 'section-tpl', component: 'Card', child: 'section-inner' }, // the template TARGET
                { id: 'section-inner', component: 'Column', children: ['section-title'] }, // a descendant
                { id: 'section-title', component: 'Text', text: { path: 'title' } }, // 2 levels below the target
              ],
            },
          },
          { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/sections', value: [{ title: 'Alpha' }, { title: 'Beta' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(true)
    })

    it("a NESTED template with its own RELATIVE array path composes scope through the outer item's witness element — regression", async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: { path: '/sections', componentId: 'section-tpl' } },
                // section-tpl's OWN children is ANOTHER template, whose path 'chips' is RELATIVE to the
                // outer section item (mirrors renderer/list.ts's scopedPointer(template.path, parentItemScope)).
                { id: 'section-tpl', component: 'Column', children: { path: 'chips', componentId: 'chip-tpl' } },
                { id: 'chip-tpl', component: 'Text', text: { path: 'label' } },
              ],
            },
          },
          {
            version: 'v1.0',
            updateDataModel: {
              surfaceId: 's1',
              path: '/sections',
              value: [{ chips: [{ label: 'A' }, { label: 'B' }] }, { chips: [{ label: 'C' }] }],
            },
          },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(true)
    })

    it('a NESTED template binding that does NOT resolve against its own witness element still rejects (no over-widening)', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: { path: '/sections', componentId: 'section-tpl' } },
                { id: 'section-tpl', component: 'Column', children: { path: 'chips', componentId: 'chip-tpl' } },
                { id: 'chip-tpl', component: 'Text', text: { path: 'nonexistent' } },
              ],
            },
          },
          {
            version: 'v1.0',
            updateDataModel: { surfaceId: 's1', path: '/sections', value: [{ chips: [{ label: 'A' }] }] },
          },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
      expect(result.paths).toContain('chip-tpl.text')
    })
  })

  describe('E_DUP (LLD-C4)', () => {
    it('an exact canonical-hash collision rejects with the colliding name', async () => {
      const deps = mkDeps()
      const first = await admit(mkCandidate({ name: 'first' }), deps)
      expect(first.ok).toBe(true)

      const second = await admit(mkCandidate({ name: 'second' }), deps) // byte-identical a2uiOutput content
      expect(second.ok).toBe(false)
      if (second.ok) return
      expect(second.code).toBe('E_DUP')
      expect(second.message).toContain('first')
      expect(second.collidesWith).toBe('first') // SPEC §5.2's structured field, not just the message
    })

    it('a near-duplicate (>= theta_dup) rejects with the colliding name', async () => {
      const deps = mkDeps()
      const candidate = mkCandidate({ name: 'near-target' }) as { promptText: string; a2uiOutput: A2uiOutput }
      // Deterministically engineer a near-dup: register a signature computed over the IDENTICAL
      // recipe text this candidate will produce (LLD §6: promptText + " " + canonicalSerialized),
      // under an existing name with a DIFFERENT canonicalHash — proves near() is wired without
      // needing to hand-craft realistically-similar-but-different content (dedup.test.ts already
      // proves the MinHash math itself).
      const canonical = await canonicalize(candidate.a2uiOutput)
      const sig = minHashSignature(`${candidate.promptText} ${canonical.serialized}`)
      deps.dedupIndex.addExact('existing', 'a-totally-different-hash')
      deps.dedupIndex.addSignature('existing', sig)

      const result = await admit(candidate, deps)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_DUP')
      expect(result.message).toContain('existing')
      expect(result.collidesWith).toBe('existing') // SPEC §5.2's structured field, not just the message
    })

    it('an empty corpus always admits the first record (LLD-C4 "empty corpus" edge)', async () => {
      const result = await admit(mkCandidate(), mkDeps())
      expect(result.ok).toBe(true)
    })

    it('collidesWith is absent on a non-dup rejection (e.g. E_CATALOG) — not just an artifact of the ok:false shape', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'NotReal' }] } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_CATALOG')
      expect(result.collidesWith).toBeUndefined()
    })
  })

  describe('E_QUALITY — the ADR-0060 injected judge seam', () => {
    it('no judge injected -> tier-2 is skipped, qualityScore stays absent (already covered by the first admit test, re-asserted here for the seam)', async () => {
      const deps = mkDeps()
      expect(deps.judge).toBeUndefined()
      const result = await admit(mkCandidate(), deps)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.record.meta.qualityScore).toBeUndefined()
    })

    it('a below-bar judge verdict rejects E_QUALITY with the failing dimensions', async () => {
      const deps = mkDeps()
      deps.judge = { score: async () => ({ qualityScore: 0.2, passed: false, failingDimensions: ['clarity', 'completeness'] }) }
      const result = await admit(mkCandidate(), deps)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_QUALITY')
      expect(result.failingDimensions).toEqual(['clarity', 'completeness'])
      expect(deps.store.get('sample')).toBeUndefined() // never written
    })

    it('an above-bar judge verdict admits with qualityScore recorded', async () => {
      const deps = mkDeps()
      deps.judge = { score: () => ({ qualityScore: 0.95, passed: true }) } // sync return also accepted
      const result = await admit(mkCandidate(), deps)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.record.meta.qualityScore).toBe(0.95)
    })
  })

  describe('tier-1 parity (SPEC-N1 / R8-AC3)', () => {
    it("admission's rejection code is the LLD-mapped form of validateA2ui's OWN verdict on the identical payload", async () => {
      const badOutput: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'NotReal' }] } },
      ]
      const directVerdict = validateA2ui(badOutput, demoCatalog)
      expect(directVerdict.valid).toBe(false)
      expect(directVerdict.failures[0]!.code).toBe('CATALOG')

      const result = await admit(mkCandidate({ a2uiOutput: badOutput }), mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_CATALOG') // the LLD §6 table's mapping of tier-1's own CATALOG verdict
    })

    it('a payload valid under validateA2ui also admits under admit() (both sides agree on the positive case)', async () => {
      const verdict = validateA2ui(DEFAULT_OUTPUT, demoCatalog)
      expect(verdict.valid).toBe(true)
      const result = await admit(mkCandidate(), mkDeps())
      expect(result.ok).toBe(true)
    })
  })
})
