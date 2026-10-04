import { describe, it, expect } from 'vitest'
import { admit, checkTier1, recordIdentity } from './admit.ts'
import type { AdmitDeps } from './admit.ts'
import { createStore } from './store.ts'
import { createDedupIndex, minHashSignature } from './dedup.ts'
import { canonicalize } from './canonical.ts'
import { validateA2ui } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'
import { loadCatalog } from '../catalog/catalog.ts'
import type { A2uiOutput, A2uiServerMessage } from '../protocol.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import type { CorpusRecord } from './record.ts'
import {
  multiTurnRecord,
  repairRecord,
  LOGIN_ACTION,
  LOGIN_FOLLOW_UP,
  LOGIN_PRIOR,
  DANGLING_CHILD_INPUT,
  DANGLING_CHILD_ERRORS,
  MISSING_TITLE_INPUT,
  MISSING_TITLE_ERRORS,
} from './facets.fixture.ts'

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

    // a2ui-container-vocabulary SPEC-R6 — CONTAINMENT joins the E_IDGRAPH family (mapTier1Code, the
    // DEPTH_EXCEEDED precedent): a graph-shape rejection over the assembled adjacency list, not a
    // single component's catalog conformance. `demoCatalog` declares no Card region types, so this
    // test builds its own minimal catalog carrying just enough vocabulary to exercise the rule.
    it('a Card region delivered outside a Card rejects as E_IDGRAPH', async () => {
      const containerCatalog = loadCatalog({
        catalogId: 'demo-containers',
        protocolVersion: 'v1.0',
        components: {
          Column: { properties: {}, children: 'children' },
          Card: { properties: {}, children: 'child' },
          CardHeader: { properties: {}, children: 'children' },
        },
      })
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo-containers' } },
          {
            version: 'v1.0',
            updateComponents: {
              surfaceId: 's1',
              components: [
                { id: 'root', component: 'Column', children: ['stray'] },
                { id: 'stray', component: 'CardHeader', children: [] },
              ],
            },
          },
        ],
        meta: { catalogId: 'demo-containers' },
      })
      const result = await admit(candidate, { catalog: containerCatalog, store: createStore(), dedupIndex: createDedupIndex() })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_IDGRAPH')
    })

    // ── ADR-0187 / GH #829 — admission judges at FINALIZE granularity (LLD §4's corpus ruling) ─────────
    //
    // A record's `a2uiOutput` IS a complete set by construction, so a surface it declares but never
    // delivers components for is a record that would teach a model to ship a blank card. Before ADR-0187
    // such a record admitted CLEAN.
    //
    // Reachability note (found building this block, worth stating): ADR-0064's SINGLE-SURFACE rule
    // (`validateRecord`, stage 2) already rejects a record whose envelopes address two different
    // surfaceIds — with `E_SCHEMA`, before tier-1 ever runs. So the runtime's headline shape (a working
    // card PLUS an abandoned second surface) is structurally unreachable at admission, and the ONE
    // reachable abandoned shape here is the single-surface record that delivers no components at all.
    // That is the mechanical reason the 29-record exemplar shard reds nothing (ADR-0187 §4's claim), and
    // it is what the probes below pin.
    it('ADR-0187: a createSurface-ONLY record rejects as E_IDGRAPH root-missing (admitted CLEAN before)', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_IDGRAPH')
      expect(result.paths ?? []).toContain('s1:root-missing')
    })

    it('ADR-0187: a record whose only content is a DATA write (surface never given components) rejects', async () => {
      const candidate = mkCandidate({
        a2uiOutput: [
          { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
          { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_IDGRAPH')
    })

    it('ADR-0187: admission stays in PARITY with the runtime on the same bytes (SPEC-N1/R8-AC3)', async () => {
      // The parity law with its granularity made explicit: admission's verdict equals the shared
      // validator's FINALIZE-mode verdict, because both judge a complete set. The DEFAULT-mode verdict on
      // the same bytes is clean — which is exactly why the granularity has to be stated, not assumed.
      const output = [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }]
      expect(validateA2ui(output, demoCatalog, undefined, { atFinalize: true }).valid).toBe(false)
      expect(validateA2ui(output, demoCatalog).valid).toBe(true) // default mode unmoved (ADR-0187 §1)
      const result = await admit(mkCandidate({ a2uiOutput: output }), mkDeps())
      expect(result.ok).toBe(false)
    })

    it('ADR-0187: the four-type open→…→close arc still ADMITS (the message-lifecycle exemplar shape)', async () => {
      // The shape message-lifecycle SPEC-R4 requires of an exemplar — all four kinds on ONE surfaceId,
      // ending in `deleteSurface`. It must keep admitting: the surface DID receive its root, so the
      // emptiness arm never applies (and the delete exclusion, LLD §3 mechanic 4, covers it twice over).
      const candidate = mkCandidate({
        a2uiOutput: [
          ...DEFAULT_OUTPUT,
          { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
          { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
        ],
      })
      const result = await admit(candidate, mkDeps())
      expect(result.ok).toBe(true)
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

    it('updateDataModel path:"/" folds as whole-model (ADR-0099 root alias) — admits identically to the omitted-path form', async () => {
      const treeFor = (): unknown[] => [
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
      ]
      const omitted = mkCandidate({
        a2uiOutput: [...treeFor(), { version: 'v1.0', updateDataModel: { surfaceId: 's1', value: { items: [{ name: 'Alice' }] } } }],
      })
      const slashRoot = mkCandidate({
        a2uiOutput: [...treeFor(), { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/', value: { items: [{ name: 'Alice' }] } } }],
      })

      const a = await admit(omitted, mkDeps())
      const b = await admit(slashRoot, mkDeps())
      expect(a.ok).toBe(true)
      expect(b.ok).toBe(true) // NOT nested under a spurious {"":...} key — the /items binding still resolves
    })
  })

  // ADR-0064 amendment A6 / GH #1750: resolution folds PER EPOCH, resetting at every `deleteSurface`
  // exactly as `canonical.ts#foldStream` does (A5) and the shared validator's epochs do (A2). A binding
  // resolves against its own epoch's data model only: the renderer freed the earlier store at the delete.
  describe('E_POINTER: resolution is per epoch (ADR-0064 amendment A6, GH #1750)', () => {
    const create = { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }
    const del = { version: 'v1.0', deleteSurface: { surfaceId: 's1' } }
    const boundRoot = { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: { path: '/x' } }] } }
    const writeX = { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 'Go' } }

    it("a second-epoch binding to a path only the FIRST epoch's data model defined rejects", async () => {
      const output = [create, boundRoot, writeX, del, create, boundRoot]
      // Tier-1 is clean (Acceptance 1 of the amendment), so the reject is stage 6's, not the validator's.
      expect(validateA2ui(output, demoCatalog, undefined, { atFinalize: true }).valid).toBe(true)
      const result = await admit(mkCandidate({ a2uiOutput: output }), mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
      expect(result.paths).toEqual(['root.label']) // epoch 1's own root.label resolves; only epoch 2's fails
    })

    it('the same path defined in its own epoch admits (positive control)', async () => {
      const result = await admit(mkCandidate({ a2uiOutput: [create, boundRoot, writeX, del, create, boundRoot, writeX] }), mkDeps())
      expect(result.ok).toBe(true)
    })

    it("a DATA-ONLY epoch's writes are invisible to the next epoch (the corpus LLD §4 rule): rejects until the epoch delivers its own", async () => {
      // `create, dm, delete` is an empty closed epoch to the validator (A3: no component deliveries), so
      // tier-1 passes; its store is freed at the delete, so nothing it wrote can satisfy a later binding.
      const dataOnlyFirst = [create, writeX, del, create, boundRoot]
      expect(validateA2ui(dataOnlyFirst, demoCatalog, undefined, { atFinalize: true }).valid).toBe(true)
      const leaked = await admit(mkCandidate({ a2uiOutput: dataOnlyFirst }), mkDeps())
      expect(leaked.ok).toBe(false)
      if (leaked.ok) return
      expect(leaked.code).toBe('E_POINTER')
      expect(leaked.paths).toEqual(['root.label'])

      const own = await admit(mkCandidate({ a2uiOutput: [create, writeX, del, create, boundRoot, writeX] }), mkDeps())
      expect(own.ok).toBe(true)
    })

    it('the same unbound path failing in two epochs is reported once', async () => {
      const output = [create, boundRoot, del, create, boundRoot] // neither epoch writes /x
      expect(validateA2ui(output, demoCatalog, undefined, { atFinalize: true }).valid).toBe(true)
      const result = await admit(mkCandidate({ a2uiOutput: output }), mkDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_POINTER')
      expect(result.paths).toEqual(['root.label'])
    })

    it('a one-epoch record with a trailing delete still resolves against its whole data model (no regression)', async () => {
      const result = await admit(mkCandidate({ a2uiOutput: [create, boundRoot, writeX, del] }), mkDeps())
      expect(result.ok).toBe(true)
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

    it('a judge that THROWS (createVerdictJudge\'s unjudged-candidate case, ADR-0068) rejects admit() itself — never silently swallowed, nothing written', async () => {
      const deps = mkDeps()
      deps.judge = {
        score: () => {
          throw new Error('no verdict for record "sample" — fail-closed')
        },
      }
      await expect(admit(mkCandidate(), deps)).rejects.toThrow('no verdict for record "sample"')
      expect(deps.store.get('sample')).toBeUndefined()
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

    it('ADR-0098: a non-member enum literal is rejected AT THE CORPUS GATE with the identical verdict (the "known-clean by construction" acceptance leg)', async () => {
      // The demo catalog carries no enum props, so this leg pins the seam on a local catalog declaring
      // one — the same loadCatalog + validateA2ui + admit() chain the real shelf rides (validate.ts re-exports
      // renderer/validate.ts, so validator-level enum enforcement reaches admission by construction).
      const enumCatalog = loadCatalog({
        catalogId: 'demo',
        protocolVersion: 'v1.0',
        components: {
          Calendar: {
            properties: {
              mode: { type: { type: 'string', enum: ['single', 'range'] }, mapsTo: 'mode' },
            },
          },
        },
      })
      const badOutput: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Calendar', mode: 'weekly' }] } },
      ]
      const directVerdict = validateA2ui(badOutput, enumCatalog)
      expect(directVerdict.valid).toBe(false)
      expect(directVerdict.failures[0]!.code).toBe('CATALOG')
      expect(directVerdict.failures[0]!.path).toBe('root.mode')

      const result = await admit(mkCandidate({ a2uiOutput: badOutput }), { ...mkDeps(), catalog: enumCatalog })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_CATALOG')
    })
  })
})

// ADR-0231: the multi-turn and repair facets through the pipeline (Acceptance items 2, 3, 4, 7). The
// fixtures run on the agent-ui catalog: the demo catalog's Button declares no action prop, so no demo
// component could ground a client action.

function mkFacetDeps(): AdmitDeps {
  return { catalog: defaultCatalog, store: createStore(), dedupIndex: createDedupIndex() }
}

/** Seed one held-out eval record directly (admit() never writes one), the leak gate's comparison set. */
function seedEval(deps: AdmitDeps, promptText: string): void {
  deps.store.put({
    name: 'held-out-eval',
    description: 'x',
    promptText,
    meta: { facet: 'eval', protocolVersion: 'v1.0', catalogId: 'agent-ui', provenance: { source: 'authored', origin: 'x' }, status: 'valid' },
  })
}

function withAction(overrides: Partial<(typeof LOGIN_ACTION)['action']>): CorpusRecord['clientInput'] {
  return [{ ...LOGIN_ACTION, action: { ...LOGIN_ACTION.action, ...overrides } }]
}

describe('admit: the multi-turn facet (ADR-0231 cl.2)', () => {
  it('admits a conforming record: hash, componentsUsed over the merged fold, status valid', async () => {
    const deps = mkFacetDeps()
    const result = await admit(multiTurnRecord(), deps)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.meta.status).toBe('valid')
    expect(result.record.meta.canonicalHash).toBe((await recordIdentity(multiTurnRecord())).hash)
    expect(result.record.meta.componentsUsed).toEqual(['Button', 'Column', 'Text'])
    expect(deps.store.get('mt-login-submit')).toEqual(result.record)
  })

  it('rejects a follow-up that resends `root` with E_IDGRAPH at `sid:root`, and admits it with the resend removed', async () => {
    const rootResend: A2uiOutput = [
      ...LOGIN_FOLLOW_UP,
      { version: 'v1.0', updateComponents: { surfaceId: 'login', components: [{ id: 'root', component: 'Column', children: ['status', 'submit', 'cancel'] }] } },
    ]
    const rejected = await admit(multiTurnRecord({ a2uiOutput: rootResend }), mkFacetDeps())
    expect(rejected.ok).toBe(false)
    if (rejected.ok) return
    expect(rejected.code).toBe('E_IDGRAPH')
    expect(rejected.paths).toEqual(['login:root'])

    const accepted = await admit(multiTurnRecord({ a2uiOutput: LOGIN_FOLLOW_UP }), mkFacetDeps())
    expect(accepted.ok).toBe(true)
  })

  it('rejects an action whose sourceComponentId is absent from the prior fold with E_IDGRAPH', async () => {
    const result = await admit(multiTurnRecord({ clientInput: withAction({ sourceComponentId: 'forgot-password' }) }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_IDGRAPH')
    expect(result.paths).toEqual(['clientInput[0].action.sourceComponentId'])
  })

  it('rejects an action name its source component does not declare with E_IDGRAPH', async () => {
    const result = await admit(multiTurnRecord({ clientInput: withAction({ name: 'login_cancel' }) }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_IDGRAPH')
    expect(result.paths).toEqual(['clientInput[0].action.name'])
  })

  it('rejects an action whose source component carries no action at all with E_IDGRAPH', async () => {
    const result = await admit(multiTurnRecord({ clientInput: withAction({ sourceComponentId: 'status' }) }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_IDGRAPH')
    expect(result.paths).toEqual(['clientInput[0].action.name'])
  })

  it('a prior turn that fails tier-1 rejects with its own code, the path prefixed `priorOutput`', async () => {
    const prior = LOGIN_PRIOR.map((msg) =>
      'updateComponents' in msg
        ? {
            ...msg,
            updateComponents: {
              ...msg.updateComponents,
              components: msg.updateComponents.components.map((c) => (c.id === 'root' ? { ...c, children: ['status', 'submit', 'cancel', 'ghost'] } : c)),
            },
          }
        : msg,
    )
    const result = await admit(multiTurnRecord({ priorOutput: prior }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_IDGRAPH')
    expect(result.paths).toEqual(['priorOutput:root->ghost'])
    expect(result.message).toMatch(/priorOutput/)
  })

  it('an update-only follow-up continues the prior epoch: it resolves against data either turn delivered (E_POINTER only when none did)', async () => {
    const rebind = (path: string): A2uiOutput => [
      { version: 'v1.0', updateComponents: { surfaceId: 'login', components: [{ id: 'status', component: 'Text', text: { path } }] } },
    ]
    const priorDatum = await admit(multiTurnRecord({ a2uiOutput: rebind('/status') }), mkFacetDeps())
    expect(priorDatum.ok).toBe(true)
    const undelivered = await admit(multiTurnRecord({ a2uiOutput: rebind('/session/user') }), mkFacetDeps())
    expect(undelivered.ok).toBe(false)
    if (undelivered.ok) return
    expect(undelivered.code).toBe('E_POINTER')
  })

  // ADR-0064 amendment A6 / GH #1750 composed with ADR-0231 cl.2: a follow-up that deletes and re-creates
  // its surface opens a new epoch (tier-1 validates it fresh, A4), and its bindings resolve against that
  // epoch alone, never the prior turn's freed store.
  it('a follow-up that deletes and re-creates the surface resolves against its OWN epoch', async () => {
    const rebuilt = (withData: boolean): A2uiOutput => [
      { version: 'v1.0', deleteSurface: { surfaceId: 'login' } },
      { version: 'v1.0', createSurface: { surfaceId: 'login', catalogId: 'agent-ui' } },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'login',
          components: [
            { id: 'root', component: 'Column', children: ['status'] },
            { id: 'status', component: 'Text', text: { path: '/status' } }, // the prior turn defined /status
          ],
        },
      },
      ...(withData ? [{ version: 'v1.0' as const, updateDataModel: { surfaceId: 'login', value: { status: 'Welcome' } } }] : []),
    ]
    // The new epoch's second `root` is a first delivery (A4: the seed never applies to a created epoch),
    // so tier-1 is clean and the reject below is stage 6's.
    expect(checkTier1(multiTurnRecord({ a2uiOutput: rebuilt(false) }), defaultCatalog)).toBeNull()

    const stale = await admit(multiTurnRecord({ a2uiOutput: rebuilt(false) }), mkFacetDeps())
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.code).toBe('E_POINTER')
    expect(stale.paths).toEqual(['status.text']) // the prior epoch's own status.text still resolves

    const own = await admit(multiTurnRecord({ a2uiOutput: rebuilt(true) }), mkFacetDeps())
    expect(own.ok).toBe(true)
  })

  it('two records differing only in actionId/timestamp collide E_DUP (exact hash)', async () => {
    const deps = mkFacetDeps()
    expect((await admit(multiTurnRecord(), deps)).ok).toBe(true)
    const nonceOnly = multiTurnRecord({ name: 'mt-login-submit-again', clientInput: withAction({ actionId: 'act-0002', timestamp: '2026-10-04T10:30:00.000Z' }) })
    expect((await recordIdentity(nonceOnly)).hash).toBe((await recordIdentity(multiTurnRecord())).hash)
    const result = await admit(nonceOnly, deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_DUP')
    expect(result.collidesWith).toBe('mt-login-submit')
  })

  it('two records differing in action.name do not collide', async () => {
    const deps = mkFacetDeps()
    expect((await admit(multiTurnRecord(), deps)).ok).toBe(true)
    const cancel = multiTurnRecord({ name: 'mt-login-cancel', clientInput: withAction({ name: 'login_cancel', sourceComponentId: 'cancel' }) })
    expect((await recordIdentity(cancel)).hash).not.toBe((await recordIdentity(multiTurnRecord())).hash)
    const result = await admit(cancel, deps)
    expect(result.ok).toBe(true)
  })

  it('a promptText near-matching a held-out eval prompt rejects E_LEAK', async () => {
    const deps = mkFacetDeps()
    seedEval(deps, multiTurnRecord().promptText)
    const result = await admit(multiTurnRecord(), deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_LEAK')
    expect(result.message).toContain('held-out-eval')
  })
})

// ADR-0064 erratum (2026-10-04, GH #1765): stage 6 also resets its resolution fold at a `createSurface`
// that follows a component-bearing epoch, with no `deleteSurface` between. The renderer replaces the
// surface and its store on a re-create (`renderer.ts#onCreateSurface`) and tier-1 refuses the prior seed
// to an epoch a `createSurface` opened (A4), so a binding sees only what its own epoch delivered. The
// canonical identity fold is NOT reset here (the hashes are frozen), so the two folds differ on this shape.
describe('admit: a re-create without a deleteSurface resets resolution (ADR-0064 erratum, GH #1765)', () => {
  const login = (...messages: A2uiServerMessage[]): A2uiOutput => messages
  const recreate: A2uiServerMessage = { version: 'v1.0', createSurface: { surfaceId: 'login', catalogId: 'agent-ui' } }
  const statusTree: A2uiServerMessage = {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'login',
      components: [
        { id: 'root', component: 'Column', children: ['status'] },
        { id: 'status', component: 'Text', text: { path: '/status' } }, // the prior turn defined /status
      ],
    },
  }
  const writeStatus: A2uiServerMessage = { version: 'v1.0', updateDataModel: { surfaceId: 'login', value: { status: 'Welcome' } } }

  it("the issue's reproduction: login prior, then [createSurface, root->status bound /status] with no write, rejects E_POINTER", async () => {
    const followUp = login(recreate, statusTree)
    // No `deleteSurface`: tier-1 is clean (A4 skips the seed for the epoch the createSurface opened, so the
    // `root` here is a first delivery), which makes the reject below stage 6's and not the validator's.
    expect(checkTier1(multiTurnRecord({ a2uiOutput: followUp }), defaultCatalog)).toBeNull()

    const stale = await admit(multiTurnRecord({ a2uiOutput: followUp }), mkFacetDeps())
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.code).toBe('E_POINTER')
    expect(stale.paths).toEqual(['status.text']) // the prior epoch's own status.text still resolves
  })

  it('the same follow-up with its own /status write admits, and the canonical identity still folds ONE epoch', async () => {
    const followUp = login(recreate, statusTree, writeStatus)
    expect(checkTier1(multiTurnRecord({ a2uiOutput: followUp }), defaultCatalog)).toBeNull()

    const own = await admit(multiTurnRecord({ a2uiOutput: followUp }), mkFacetDeps())
    expect(own.ok).toBe(true)
    // The hash fold is unchanged by this erratum: `createSurface` is still not a boundary there (A5), so the
    // record's identity is one merged epoch while its resolution above ran over two.
    expect((await recordIdentity(multiTurnRecord({ a2uiOutput: followUp }))).epochs).toHaveLength(1)
  })

  it('the update-only follow-up (no createSurface) still continues the prior epoch: the reset is the createSurface, nothing else', async () => {
    const rebind: A2uiOutput = [{ version: 'v1.0', updateComponents: { surfaceId: 'login', components: [{ id: 'status', component: 'Text', text: { path: '/status' } }] } }]
    expect((await admit(multiTurnRecord({ a2uiOutput: rebind }), mkFacetDeps())).ok).toBe(true)
  })

  // A single stream. The exemplar shape `create, root, dm, create, root` never reaches stage 6: the second
  // `root` is a resend (a `createSurface` inside an open epoch is not a boundary to the validator, A2), so
  // tier-1 rejects `s:root` first. A re-create that delivers no second `root` does reach stage 6, and gets
  // the same reset.
  describe('one stream (an exemplar record)', () => {
    const agentUiCandidate = (a2uiOutput: A2uiOutput): unknown => mkCandidate({ a2uiOutput, meta: { catalogId: 'agent-ui' } })
    const rootOnly: A2uiServerMessage = {
      version: 'v1.0',
      updateComponents: { surfaceId: 'login', components: [{ id: 'root', component: 'Column', children: ['status'] }] },
    }
    const statusOnly: A2uiServerMessage = {
      version: 'v1.0',
      updateComponents: { surfaceId: 'login', components: [{ id: 'status', component: 'Text', text: { path: '/status' } }] },
    }

    it('a re-create that resends `root` never reaches stage 6: tier-1 rejects the resend first (E_IDGRAPH login:root)', async () => {
      const output = login(recreate, statusTree, writeStatus, recreate, statusTree)
      expect(validateA2ui(output, defaultCatalog, undefined, { atFinalize: true }).failures).toEqual([{ code: 'IDGRAPH', path: 'login:root' }])
      const result = await admit(agentUiCandidate(output), mkFacetDeps())
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.code).toBe('E_IDGRAPH')
      expect(result.paths).toEqual(['login:root'])
    })

    it('a re-create with no second `root` reaches stage 6 and resets: a binding to data only the first epoch wrote rejects', async () => {
      const output = login(recreate, rootOnly, writeStatus, recreate, statusOnly)
      expect(validateA2ui(output, defaultCatalog, undefined, { atFinalize: true }).valid).toBe(true)
      const stale = await admit(agentUiCandidate(output), mkFacetDeps())
      expect(stale.ok).toBe(false)
      if (stale.ok) return
      expect(stale.code).toBe('E_POINTER')
      expect(stale.paths).toEqual(['status.text'])
    })

    it('the same stream with a write after the re-create admits (positive control)', async () => {
      const output = login(recreate, rootOnly, writeStatus, recreate, statusOnly, writeStatus)
      const own = await admit(agentUiCandidate(output), mkFacetDeps())
      expect(own.ok).toBe(true)
    })
  })
})

describe('admit: the repair facet (ADR-0231 cl.3)', () => {
  it('admits a pair whose validatorErrors equal the recomputed verdict', async () => {
    expect(validateA2ui(DANGLING_CHILD_INPUT, defaultCatalog, undefined, { atFinalize: true }).failures).toEqual(DANGLING_CHILD_ERRORS)
    const deps = mkFacetDeps()
    const result = await admit(repairRecord(), deps)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.meta.canonicalHash).toBe((await recordIdentity(repairRecord())).hash)
    expect(result.record.meta.componentsUsed).toEqual(['Column', 'Text'])
  })

  it('compares as a set of (code, path) pairs: a duplicated stored entry still matches', async () => {
    const result = await admit(repairRecord({ validatorErrors: [...DANGLING_CHILD_ERRORS, ...DANGLING_CHILD_ERRORS] }), mkFacetDeps())
    expect(result.ok).toBe(true)
  })

  it('rejects stored validatorErrors that differ from the recomputed set with E_SCHEMA at `validatorErrors`', async () => {
    const result = await admit(repairRecord({ validatorErrors: MISSING_TITLE_ERRORS }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_SCHEMA')
    expect(result.paths).toEqual(['validatorErrors'])
  })

  it('rejects a pair whose corrected stream fails tier-1 with that tier-1 code', async () => {
    const result = await admit(repairRecord({ a2uiOutput: DANGLING_CHILD_INPUT }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_IDGRAPH')
    expect(result.paths).toEqual(['root->subtitle'])
  })

  it('a pair built around a missing version (the healer arm (d), a cl.3/cl.7 non-goal) rejects E_PIN before recomputation', async () => {
    const invalidInput = DANGLING_CHILD_INPUT.map((msg, i) => {
      if (i !== 1) return msg
      const copy: Record<string, unknown> = { ...msg }
      delete copy.version
      return copy
    })
    // The stored errors are exactly what the validator reports for this input, so only the pin arm stands
    // between the pair and admission.
    const validatorErrors = validateA2ui(invalidInput as never, defaultCatalog, undefined, { atFinalize: true }).failures
    expect(validatorErrors.length).toBeGreaterThan(0)
    const result = await admit(repairRecord({ invalidInput: invalidInput as never, validatorErrors }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_PIN')
    expect(result.paths).toEqual(['invalidInput[1].version'])
  })

  it.each(['FUNCTION', 'CATALOG_UNKNOWN'] as const)('rejects validatorErrors carrying %s at recomputation (the set can never match)', async (code) => {
    const result = await admit(repairRecord({ validatorErrors: [...DANGLING_CHILD_ERRORS, { code, path: 'root' }] }), mkFacetDeps())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_SCHEMA')
    expect(result.paths).toEqual(['validatorErrors'])
  })

  it('identity: the same tree from a different breakage is a distinct pair, and the stored set is order-free', async () => {
    const other = repairRecord({ name: 'rp-missing-title', invalidInput: MISSING_TITLE_INPUT, validatorErrors: MISSING_TITLE_ERRORS })
    const a = await recordIdentity(repairRecord())
    const b = await recordIdentity(other)
    expect(b.hash).not.toBe(a.hash)
    const index = createDedupIndex()
    index.addExact('rp-dangling-child', a.hash)
    expect(index.exact(b.hash)).toBeNull()

    const both = [...DANGLING_CHILD_ERRORS, ...MISSING_TITLE_ERRORS]
    const forward = await recordIdentity(repairRecord({ validatorErrors: both }))
    const reversed = await recordIdentity(repairRecord({ validatorErrors: [...both].reverse() }))
    expect(reversed.hash).toBe(forward.hash)
  })

  it('two pairs differing only in their breakage (each prompt naming its own) both admit', async () => {
    const deps = mkFacetDeps()
    expect((await admit(repairRecord(), deps)).ok).toBe(true)
    const other = repairRecord({
      name: 'rp-missing-title',
      promptText: 'a welcome card whose title is missing above the subtitle',
      invalidInput: MISSING_TITLE_INPUT,
      validatorErrors: MISSING_TITLE_ERRORS,
    })
    const result = await admit(other, deps)
    expect(result.ok).toBe(true)
  })

  it('a promptText near-matching a held-out eval prompt rejects E_LEAK', async () => {
    const deps = mkFacetDeps()
    seedEval(deps, repairRecord().promptText)
    const result = await admit(repairRecord(), deps)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('E_LEAK')
  })
})

describe('recordIdentity: the exemplar identity is unchanged (ADR-0231 Acceptance 5)', () => {
  it('an exemplar hashes exactly as canonicalize(a2uiOutput) does', async () => {
    const exemplar = mkCandidate() as CorpusRecord
    const identity = await recordIdentity(exemplar)
    const direct = await canonicalize(DEFAULT_OUTPUT)
    expect(identity).toEqual(direct)
  })
})
