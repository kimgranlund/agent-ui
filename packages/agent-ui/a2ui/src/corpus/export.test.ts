import { describe, it, expect } from 'vitest'
import { exportFineTune, exportCatalogExamples } from './export.ts'
import { validateA2ui } from './validate.ts'
import { demoCatalog } from '../fixtures.ts'
import type { CorpusRecord } from './record.ts'
import type { A2uiOutput } from '../protocol.ts'

const OUTPUT: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
  { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: 'hi' }] } },
]

type RecordOverrides = Partial<Omit<CorpusRecord, 'name' | 'meta'>> & { name: string; meta?: Partial<CorpusRecord['meta']> }

function makeRecord(overrides: RecordOverrides): CorpusRecord {
  const { meta: metaOverrides, ...rest } = overrides
  return {
    description: 'a description',
    promptText: 'a prompt',
    a2uiOutput: OUTPUT,
    ...rest,
    name: overrides.name,
    meta: {
      facet: 'exemplar',
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored', origin: 'test' },
      status: 'valid',
      ...metaOverrides,
    },
  }
}

const scope = { protocolVersion: 'v1.0' }

describe('exportFineTune (SPEC-R12)', () => {
  it('emits a {prompt, context, output} JSONL line per exemplar', () => {
    const rec = makeRecord({ name: 'r1', promptText: 'build a login form', catalog: 'agent-ui.json', role_description: 'a form assistant' })

    const lines = exportFineTune([rec], scope)

    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!)
    expect(parsed).toEqual({
      prompt: 'build a login form',
      context: { catalog: 'agent-ui.json', role_description: 'a form assistant' },
      output: OUTPUT,
    })
  })

  it('omits absent context fields rather than emitting them as null/undefined', () => {
    const rec = makeRecord({ name: 'r1' }) // no catalog/role_description/workflow_description

    const parsed = JSON.parse(exportFineTune([rec], scope)[0]!)

    expect(parsed.context).toEqual({})
    expect('catalog' in parsed.context).toBe(false)
    expect('role_description' in parsed.context).toBe(false)
    expect('workflow_description' in parsed.context).toBe(false)
  })

  it('excludes a planted eval-facet record — the leak-exclusion mechanism (SPEC-R12 AC1)', () => {
    const exemplar = makeRecord({ name: 'legit-exemplar', promptText: 'a legitimate exemplar prompt' })
    const plantedEval = makeRecord({
      name: 'planted-eval-gold',
      promptText: 'THIS EVAL PROMPT MUST NEVER LEAK',
      a2uiOutput: undefined,
      meta: { facet: 'eval', status: 'valid' },
    })

    const lines = exportFineTune([exemplar, plantedEval], scope)

    expect(lines).toHaveLength(1)
    for (const line of lines) {
      expect(line).not.toContain('planted-eval-gold')
      expect(line).not.toContain('THIS EVAL PROMPT MUST NEVER LEAK')
    }
  })

  it('excludes quarantined records — they appear in no export (LLD §2/§9)', () => {
    const valid = makeRecord({ name: 'a-valid', promptText: 'the valid prompt' })
    const quarantined = makeRecord({ name: 'z-quarantined', promptText: 'the quarantined prompt', meta: { status: 'quarantined' } })

    const lines = exportFineTune([valid, quarantined], scope)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('the valid prompt')
    expect(lines[0]).not.toContain('the quarantined prompt')
  })

  it('scopes strictly to the requested protocolVersion', () => {
    const inScope = makeRecord({ name: 'v1-record', promptText: 'the v1 prompt', meta: { protocolVersion: 'v1.0' } })
    const outOfScope = makeRecord({ name: 'v09-record', promptText: 'the v0.9 prompt', meta: { protocolVersion: 'v0.9.1' } })

    const lines = exportFineTune([inScope, outOfScope], scope)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('the v1 prompt')
    expect(lines[0]).not.toContain('the v0.9 prompt')
  })

  it('defensively skips an exemplar record missing a2uiOutput rather than emitting a malformed pair', () => {
    const broken = makeRecord({ name: 'no-output', a2uiOutput: undefined })

    expect(exportFineTune([broken], scope)).toEqual([])
  })

  it('orders output deterministically by ascending name, regardless of input order', () => {
    const b = makeRecord({ name: 'b-record', promptText: 'prompt-b' })
    const a = makeRecord({ name: 'a-record', promptText: 'prompt-a' })
    const c = makeRecord({ name: 'c-record', promptText: 'prompt-c' })

    const lines = exportFineTune([b, c, a], scope)

    expect(lines.map((l) => JSON.parse(l).prompt)).toEqual(['prompt-a', 'prompt-b', 'prompt-c'])
  })

  it('never throws on an empty input and yields a well-formed empty artifact', () => {
    expect(exportFineTune([], scope)).toEqual([])
  })
})

// A real upstream example file, entire content verbatim — host-fetched 2026-07-03 from
// google/A2UI@main, `agent_sdks/conformance/test_data/load_examples/basic/example1.json`. Grounds the
// "bare array of message objects, no wrapper" shape our own emitted `content` must match — NOT a claim
// that our validator accepts every historical upstream message kind (`beginRendering` predates this
// repo's supported envelope set, `protocol.ts` `MESSAGE_KINDS`).
const UPSTREAM_EXAMPLE_FIXTURE = '[{"beginRendering": {"surfaceId": "id"}}]'

/** The structural contract upstream's `load_examples()` file content satisfies (`schema/catalog.py:352-
 * 391`): a bare JSON array of message-shaped objects — no name/prompt wrapper, no `---BEGIN/---END`
 * markers, no `### Examples:` heading (the loader adds those at read time). */
function isBareMessageArrayShape(content: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return false
  }
  return Array.isArray(parsed) && parsed.every((m) => typeof m === 'object' && m !== null && !Array.isArray(m))
}

const catalogScope = { catalogId: 'agent-ui', protocolVersion: 'v1.0' }

// A demo-catalog-conformant output (Column -> Button, both defined in `../fixtures.ts`'s
// `demoCatalogDoc`) — used only where the test needs REAL tier-1 validity, not just structural shape.
const DEMO_OUTPUT: A2uiOutput = [
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
]

describe('exportCatalogExamples (SPEC-R10)', () => {
  it('emits one {name, content} file per eligible exemplar — the bare a2uiOutput array, no wrapper markers or heading', () => {
    const rec = makeRecord({ name: 'login-example' })

    const files = exportCatalogExamples([rec], catalogScope)

    expect(files).toHaveLength(1)
    expect(files[0]).toEqual({ name: 'login-example', content: JSON.stringify(OUTPUT) })
    expect(JSON.parse(files[0]!.content)).toEqual(OUTPUT)
    expect(files[0]!.content).not.toContain('---BEGIN')
    expect(files[0]!.content).not.toContain('### Examples:')
  })

  it("matches the real upstream example-file shape (host-fetched fixture, google/A2UI@main)", () => {
    // Ground the shape-checker against a REAL upstream fixture first — otherwise this is tautological.
    expect(isBareMessageArrayShape(UPSTREAM_EXAMPLE_FIXTURE)).toBe(true)

    const rec = makeRecord({ name: 'shape-example' })
    const [file] = exportCatalogExamples([rec], catalogScope)

    expect(isBareMessageArrayShape(file!.content)).toBe(true)
  })

  it('every entry pins the requested scope and its content is tier-1 valid (SPEC-R10 AC1)', () => {
    const rec = makeRecord({
      name: 'demo-example',
      a2uiOutput: DEMO_OUTPUT,
      meta: { catalogId: 'demo', protocolVersion: 'v1.0' },
    })

    const [file] = exportCatalogExamples([rec], { catalogId: 'demo', protocolVersion: 'v1.0' })
    const parsed = JSON.parse(file!.content) as A2uiOutput

    // pins the requested scope
    expect(parsed.every((m) => m.version === 'v1.0')).toBe(true)
    const createSurfaceMsg = parsed.find((m): m is Extract<A2uiOutput[number], { createSurface: unknown }> => 'createSurface' in m)
    expect(createSurfaceMsg?.createSurface.catalogId).toBe('demo')

    // tier-1 valid against the pinned catalog — the shared validator (LLD-C6), not a re-implementation
    expect(validateA2ui(parsed, demoCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('skips a record whose name is not filesystem-basename-safe', () => {
    const unsafe = makeRecord({ name: 'not/safe' })
    const alsoUnsafe = makeRecord({ name: 'bad name with spaces' })
    const safe = makeRecord({ name: 'a-safe-name' })

    const files = exportCatalogExamples([unsafe, alsoUnsafe, safe], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['a-safe-name'])
  })

  it('excludes an out-of-catalog-scope record', () => {
    const inScope = makeRecord({ name: 'in-scope', meta: { catalogId: 'agent-ui' } })
    const outOfScope = makeRecord({ name: 'out-of-scope', meta: { catalogId: 'other-catalog' } })

    const files = exportCatalogExamples([inScope, outOfScope], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['in-scope'])
  })

  it('excludes an out-of-protocolVersion-scope record', () => {
    const inScope = makeRecord({ name: 'in-scope', meta: { protocolVersion: 'v1.0' } })
    const outOfScope = makeRecord({ name: 'out-of-scope', meta: { protocolVersion: 'v0.9.1' } })

    const files = exportCatalogExamples([inScope, outOfScope], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['in-scope'])
  })

  it('excludes a planted eval-facet record — the leak-exclusion mechanism', () => {
    const exemplar = makeRecord({ name: 'legit-exemplar' })
    const plantedEval = makeRecord({ name: 'planted-eval-gold', a2uiOutput: undefined, meta: { facet: 'eval' } })

    const files = exportCatalogExamples([exemplar, plantedEval], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['legit-exemplar'])
  })

  it('excludes quarantined records — they appear in no export (LLD §2/§9)', () => {
    const valid = makeRecord({ name: 'a-valid' })
    const quarantined = makeRecord({ name: 'z-quarantined', meta: { status: 'quarantined' } })

    const files = exportCatalogExamples([valid, quarantined], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['a-valid'])
  })

  it('defensively skips an exemplar record missing a2uiOutput rather than emitting a malformed file', () => {
    const broken = makeRecord({ name: 'no-output', a2uiOutput: undefined })

    expect(exportCatalogExamples([broken], catalogScope)).toEqual([])
  })

  it('orders output deterministically by ascending name — matches upstream\'s own directory sort ("sort for determinism")', () => {
    const b = makeRecord({ name: 'b-example' })
    const a = makeRecord({ name: 'a-example' })
    const c = makeRecord({ name: 'c-example' })

    const files = exportCatalogExamples([b, c, a], catalogScope)

    expect(files.map((f) => f.name)).toEqual(['a-example', 'b-example', 'c-example'])
  })

  it('never throws on an empty input and yields a well-formed empty artifact', () => {
    expect(exportCatalogExamples([], catalogScope)).toEqual([])
  })
})
