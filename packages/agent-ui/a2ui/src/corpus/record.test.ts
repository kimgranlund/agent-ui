import { describe, it, expect } from 'vitest'
import { validateRecord } from './record.ts'
import type { CorpusRecord } from './record.ts'
import {
  multiTurnRecord,
  repairRecord,
  LOGIN_ACTION,
  LOGIN_PRIOR,
  DANGLING_CHILD_ERRORS,
  DANGLING_CHILD_INPUT,
  DANGLING_CHILD_FIXED,
} from './facets.fixture.ts'
// Test-only use of `node:fs` for the ADR-0063 grep-clean proof below (never ships — same pattern as
// `store.test.ts`'s own source-text trip-wire).
import { readFileSync, readdirSync } from 'node:fs'

declare const process: { cwd(): string }

// — fixtures ——————————————————————————————————————————————————————————————

const validExemplar: CorpusRecord = {
  name: 'ex-login-form',
  description: 'a simple login form',
  promptText: 'build me a login form',
  a2uiOutput: [
    { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Column' }] },
    },
  ],
  meta: {
    facet: 'exemplar',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    provenance: { source: 'authored', origin: 'src/examples/login.ts' },
    status: 'valid',
  },
}

const validEval: CorpusRecord = {
  name: 'eval-login-form',
  description: 'judges whether the output renders a login form',
  promptText: 'build me a login form',
  target: 'renders a form with username/password fields and a submit button',
  meta: {
    facet: 'eval',
    protocolVersion: 'v1.0',
    catalogId: 'agent-ui',
    provenance: { source: 'authored', origin: 'src/examples/login-eval.ts' },
    status: 'valid',
  },
}

// deep-clone + drop a top-level key
function omit(rec: CorpusRecord, key: keyof CorpusRecord): unknown {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(rec))
  delete copy[key as string]
  return copy
}

// deep-clone + drop a `meta` key
function omitMeta(rec: CorpusRecord, key: keyof CorpusRecord['meta']): unknown {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(rec))
  const meta = copy.meta as Record<string, unknown>
  delete meta[key as string]
  return copy
}

// deep-clone + merge shallow overrides at the top level
function withOverrides(rec: CorpusRecord, overrides: Record<string, unknown>): unknown {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(rec))
  return { ...copy, ...overrides }
}

describe('validateRecord — the happy path (LLD §13 s1)', () => {
  it('a valid exemplar record returns []', () => {
    expect(validateRecord(validExemplar)).toEqual([])
  })

  it('a valid eval record returns []', () => {
    expect(validateRecord(validEval)).toEqual([])
  })
})

describe('validateRecord — required top-level fields (SPEC-R1 AC2)', () => {
  for (const key of ['name', 'description', 'promptText'] as const) {
    it(`missing ${key} → E_SCHEMA at the failing path`, () => {
      const result = validateRecord(omit(validExemplar, key))
      expect(result).toContainEqual({ code: 'E_SCHEMA', path: key })
    })
  }
})

describe('validateRecord — facet conditionals', () => {
  it('exemplar without a2uiOutput → E_SCHEMA at "a2uiOutput" (SPEC-R2 AC1)', () => {
    const result = validateRecord(omit(validExemplar, 'a2uiOutput'))
    expect(result).toContainEqual({ code: 'E_SCHEMA', path: 'a2uiOutput' })
  })

  // ADR-0063 (upstream-verified, SPEC v0.4): `description` is unconditionally required — upstream's
  // `dataset_schema.json` requires it outright and defines no missing-target failure mode; `target`
  // defaults to `description` for the judge (a consumer rule, not a validation rule). The v0.3
  // eval/target carve-out is reversed; `E_NO_TARGET` is retired (no such code exists anymore).
  it('eval with description but no target is valid (the upstream target-defaults-to-description positive control, SPEC-R2 AC2)', () => {
    const descriptionOnly = omit(validEval, 'target')
    expect(validateRecord(descriptionOnly)).toEqual([])
  })

  it('eval with target but no description FAILS E_SCHEMA at "description" (the inverted v0.3-carve-out control)', () => {
    const targetOnly = omit(validEval, 'description')
    const result = validateRecord(targetOnly)
    expect(result).toContainEqual({ code: 'E_SCHEMA', path: 'description' })
  })
})

describe('validateRecord — pin checks (SPEC-R9)', () => {
  it('missing meta.protocolVersion → E_PIN', () => {
    const result = validateRecord(omitMeta(validExemplar, 'protocolVersion'))
    expect(result).toContainEqual({ code: 'E_PIN', path: 'meta.protocolVersion' })
  })

  it('missing meta.catalogId → E_PIN', () => {
    const result = validateRecord(omitMeta(validExemplar, 'catalogId'))
    expect(result).toContainEqual({ code: 'E_PIN', path: 'meta.catalogId' })
  })

  it('a bundled message whose version disagrees with meta.protocolVersion → E_PIN', () => {
    const mismatched: CorpusRecord = {
      ...validExemplar,
      a2uiOutput: [{ version: 'v0.9.1', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
    }
    const result = validateRecord(mismatched)
    expect(result).toContainEqual({ code: 'E_PIN', path: 'a2uiOutput[0].version' })
  })

  it('a bundled createSurface.catalogId that disagrees with meta.catalogId → E_PIN', () => {
    const mismatched: CorpusRecord = {
      ...validExemplar,
      a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'other-catalog' } }],
    }
    const result = validateRecord(mismatched)
    expect(result).toContainEqual({ code: 'E_PIN', path: 'a2uiOutput[0].createSurface.catalogId' })
  })
})

describe('validateRecord — single-surface rule (SPEC-R2 AC3, ADR-0064)', () => {
  it("a two-surface a2uiOutput rejects E_SCHEMA at the second surface's message path", () => {
    const multiSurface: CorpusRecord = {
      ...validExemplar,
      a2uiOutput: [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
        { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Column' }] } },
        { version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } },
      ],
    }
    const result = validateRecord(multiSurface)
    expect(result).toContainEqual({ code: 'E_SCHEMA', path: 'a2uiOutput[2]' })
  })

  it('an a2uiOutput addressing no surface (callFunction-only) rejects E_SCHEMA (closes the vacuous-tier-1 hole)', () => {
    const callFunctionOnly: CorpusRecord = {
      ...validExemplar,
      a2uiOutput: [{ version: 'v1.0', functionCallId: 'fc1', callFunction: { call: 'doSomething' } }],
    }
    const result = validateRecord(callFunctionOnly)
    expect(result).toContainEqual({ code: 'E_SCHEMA', path: 'a2uiOutput' })
  })

  it('one surface plus surfaceless callFunction envelopes passes the rule', () => {
    const mixed: CorpusRecord = {
      ...validExemplar,
      a2uiOutput: [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } },
        { version: 'v1.0', functionCallId: 'fc1', callFunction: { call: 'doSomething' } },
        { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Column' }] } },
      ],
    }
    expect(validateRecord(mixed)).toEqual([])
  })
})

describe('validateRecord — closed schema (additionalProperties: false, §5.1)', () => {
  it('an unknown top-level key → E_SCHEMA at that key', () => {
    const result = validateRecord(withOverrides(validExemplar, { bogus: 'nope' }))
    expect(result).toContainEqual({ code: 'E_SCHEMA', path: 'bogus' })
  })

  it('an unknown meta key → E_SCHEMA at "meta.<key>"', () => {
    const copy = JSON.parse(JSON.stringify(validExemplar))
    copy.meta.bogus = 'nope'
    expect(validateRecord(copy)).toContainEqual({ code: 'E_SCHEMA', path: 'meta.bogus' })
  })
})

describe('validateRecord — never throws (totality)', () => {
  const hostile: Array<{ label: string; input: unknown }> = [
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
    { label: 'a number', input: 42 },
    { label: 'a bare string', input: 'not a record' },
    { label: 'an empty array', input: [] },
    { label: 'an array of junk', input: [1, 2, 'three', null] },
    { label: 'an empty object', input: {} },
    { label: 'a boolean', input: true },
    { label: 'NaN', input: NaN },
    { label: 'a function', input: () => {} },
    { label: 'a Map', input: new Map([['a', 1]]) },
    {
      label: 'a deeply wrong-typed near-shape',
      input: { name: 42, description: null, promptText: [], meta: { facet: {}, provenance: null, status: 7 } },
    },
  ]

  for (const { label, input } of hostile) {
    it(`does not throw on ${label}`, () => {
      expect(() => validateRecord(input)).not.toThrow()
      expect(Array.isArray(validateRecord(input))).toBe(true)
    })
  }

  it('a non-object payload (array/null/etc.) yields a single root E_SCHEMA', () => {
    expect(validateRecord(null)).toEqual([{ code: 'E_SCHEMA', path: '' }])
    expect(validateRecord([])).toEqual([{ code: 'E_SCHEMA', path: '' }])
  })
})

describe('validateRecord — E_NO_TARGET is retired (ADR-0063)', () => {
  it('is grep-clean: the string "E_NO_TARGET" appears nowhere under src/corpus/', () => {
    // Excludes THIS file: it names "E_NO_TARGET" deliberately, as the retirement's own historical
    // citation (this describe block's title, the ADR-0063 comment above) — that prose is the record
    // of the removal, not a live reference to the removed code.
    const dir = `${process.cwd()}/packages/agent-ui/a2ui/src/corpus`
    const files = (readdirSync(dir) as string[]).filter((f) => f.endsWith('.ts') && f !== 'record.test.ts')
    expect(files.length).toBeGreaterThan(0) // sanity: the scan actually found files, not an empty dir
    for (const file of files) {
      const text = readFileSync(`${dir}/${file}`, 'utf8') as string
      expect(text.includes('E_NO_TARGET'), `${file} still mentions E_NO_TARGET`).toBe(false)
    }
  })
})

// ADR-0231 cl.2/cl.3: the multi-turn and repair facets' record shape (Acceptance item 1).

/** A fixture record with top-level fields dropped (the facet branch's required-field probes). */
function without(record: CorpusRecord, ...keys: (keyof CorpusRecord)[]): unknown {
  const copy: Record<string, unknown> = { ...record }
  for (const key of keys) delete copy[key]
  return copy
}

describe('validateRecord: the multi-turn facet (ADR-0231 cl.2)', () => {
  it('accepts a conforming multi-turn record', () => {
    expect(validateRecord(multiTurnRecord())).toEqual([])
  })

  it('rejects a record missing priorOutput at `priorOutput`', () => {
    expect(validateRecord(without(multiTurnRecord(), 'priorOutput'))).toContainEqual({ code: 'E_SCHEMA', path: 'priorOutput' })
  })

  it('rejects a record missing clientInput at `clientInput`', () => {
    expect(validateRecord(without(multiTurnRecord(), 'clientInput'))).toEqual([{ code: 'E_SCHEMA', path: 'clientInput' }])
  })

  it('rejects a clientInput of length 2 at `clientInput`', () => {
    expect(validateRecord(multiTurnRecord({ clientInput: [LOGIN_ACTION, LOGIN_ACTION] }))).toEqual([
      { code: 'E_SCHEMA', path: 'clientInput' },
    ])
  })

  it('rejects an empty clientInput at `clientInput`', () => {
    expect(validateRecord(multiTurnRecord({ clientInput: [] }))).toEqual([{ code: 'E_SCHEMA', path: 'clientInput' }])
  })

  it('rejects a clientInput[0] that is not an action envelope at `clientInput[0]`', () => {
    const notAction = { version: 'v1.0', error: { code: 'VALIDATION_FAILED', surfaceId: 'login', path: '/x', message: 'no' } }
    expect(validateRecord(multiTurnRecord({ clientInput: [notAction] as never }))).toEqual([{ code: 'E_SCHEMA', path: 'clientInput[0]' }])
  })

  it('rejects a missing a2uiOutput (the follow-up) at `a2uiOutput`', () => {
    expect(validateRecord(without(multiTurnRecord(), 'a2uiOutput'))).toContainEqual({ code: 'E_SCHEMA', path: 'a2uiOutput' })
  })

  it('rejects an action missing a required string field at that field', () => {
    const { sourceComponentId: _drop, ...rest } = LOGIN_ACTION.action
    void _drop
    expect(validateRecord(multiTurnRecord({ clientInput: [{ version: 'v1.0', action: rest }] as never }))).toEqual([
      { code: 'E_SCHEMA', path: 'clientInput[0].action.sourceComponentId' },
    ])
  })

  it('rejects an unknown action key and a non-boolean wantResponse at their paths', () => {
    const action = { ...LOGIN_ACTION.action, extra: 1, wantResponse: 'yes' }
    expect(validateRecord(multiTurnRecord({ clientInput: [{ version: 'v1.0', action }] as never }))).toEqual([
      { code: 'E_SCHEMA', path: 'clientInput[0].action.extra' },
      { code: 'E_SCHEMA', path: 'clientInput[0].action.wantResponse' },
    ])
  })

  it('pins every stream: a prior-turn version drift is E_PIN at its priorOutput path', () => {
    const prior = LOGIN_PRIOR.map((msg, i) => (i === 2 ? { ...msg, version: 'v0.9' } : msg))
    expect(validateRecord(multiTurnRecord({ priorOutput: prior as never }))).toEqual([{ code: 'E_PIN', path: 'priorOutput[2].version' }])
  })

  it('stays single-surface across both turns and the action: an action on another surface is E_SCHEMA', () => {
    const action = { ...LOGIN_ACTION, action: { ...LOGIN_ACTION.action, surfaceId: 'other' } }
    expect(validateRecord(multiTurnRecord({ clientInput: [action] }))).toEqual([{ code: 'E_SCHEMA', path: 'clientInput[0]' }])
  })

  it('a branch field on the wrong facet is an unknown top-level key (E_SCHEMA at the key)', () => {
    const exemplarWithPrior = { ...validExemplar, priorOutput: LOGIN_PRIOR }
    expect(validateRecord(exemplarWithPrior)).toEqual([{ code: 'E_SCHEMA', path: 'priorOutput' }])
    const multiTurnWithRepairField = { ...multiTurnRecord(), validatorErrors: DANGLING_CHILD_ERRORS }
    expect(validateRecord(multiTurnWithRepairField)).toEqual([{ code: 'E_SCHEMA', path: 'validatorErrors' }])
  })
})

describe('validateRecord: the repair facet (ADR-0231 cl.3)', () => {
  it('accepts a conforming repair record', () => {
    expect(validateRecord(repairRecord())).toEqual([])
  })

  it('rejects an empty validatorErrors at `validatorErrors`', () => {
    expect(validateRecord(repairRecord({ validatorErrors: [] }))).toEqual([{ code: 'E_SCHEMA', path: 'validatorErrors' }])
  })

  it('rejects a validatorErrors entry whose code is outside ErrorCode at `validatorErrors[i].code`', () => {
    const errors = [...DANGLING_CHILD_ERRORS, { code: 'NOT_A_CODE', path: 'root' }]
    expect(validateRecord(repairRecord({ validatorErrors: errors as never }))).toEqual([
      { code: 'E_SCHEMA', path: 'validatorErrors[1].code' },
    ])
  })

  it('accepts FUNCTION and CATALOG_UNKNOWN as shapes (membership only; recomputation rejects them at admit)', () => {
    expect(validateRecord(repairRecord({ validatorErrors: [{ code: 'FUNCTION', path: '[0]' }] }))).toEqual([])
    expect(validateRecord(repairRecord({ validatorErrors: [{ code: 'CATALOG_UNKNOWN', path: '[0]' }] }))).toEqual([])
  })

  it('rejects a non-string path and an extra entry key at their paths', () => {
    const errors = [{ code: 'IDGRAPH', path: 7, hint: 'x' }]
    expect(validateRecord(repairRecord({ validatorErrors: errors as never }))).toEqual([
      { code: 'E_SCHEMA', path: 'validatorErrors[0].hint' },
      { code: 'E_SCHEMA', path: 'validatorErrors[0].path' },
    ])
  })

  it('rejects a missing invalidInput and a missing a2uiOutput at their keys', () => {
    expect(validateRecord(without(repairRecord(), 'invalidInput'))).toEqual([{ code: 'E_SCHEMA', path: 'invalidInput' }])
    expect(validateRecord(without(repairRecord(), 'a2uiOutput'))).toContainEqual({ code: 'E_SCHEMA', path: 'a2uiOutput' })
  })
})

// ADR-0231 cl.3/cl.7 + ADR-0061 arm (d): filling an absent per-message `version` is the healer's job, and
// only `a2uiOutput` is healed (cl.4). In the never-healed server streams an absent or non-string `version`
// is E_PIN at its message, so no repair pair (and no prior turn) can be built around that breakage.
describe('validateRecord: the unhealed streams pin an absent version (ADR-0231 cl.3/cl.7)', () => {
  const dropVersion = (stream: readonly object[], at: number): object[] =>
    stream.map((msg, i) => {
      if (i !== at) return msg
      const copy: Record<string, unknown> = { ...msg }
      delete copy.version
      return copy
    })

  it('an invalidInput message with no version is E_PIN at `invalidInput[i].version`', () => {
    const invalidInput = dropVersion(DANGLING_CHILD_INPUT, 1)
    expect(validateRecord(repairRecord({ invalidInput: invalidInput as never }))).toEqual([
      { code: 'E_PIN', path: 'invalidInput[1].version' },
    ])
  })

  it('an invalidInput message whose version is not a string is E_PIN at the same path', () => {
    const invalidInput = DANGLING_CHILD_INPUT.map((msg, i) => (i === 0 ? { ...msg, version: 1 } : msg))
    expect(validateRecord(repairRecord({ invalidInput: invalidInput as never }))).toEqual([
      { code: 'E_PIN', path: 'invalidInput[0].version' },
    ])
  })

  it('a priorOutput message with no version is E_PIN at `priorOutput[i].version`', () => {
    const priorOutput = dropVersion(LOGIN_PRIOR, 2)
    expect(validateRecord(multiTurnRecord({ priorOutput: priorOutput as never }))).toEqual([
      { code: 'E_PIN', path: 'priorOutput[2].version' },
    ])
  })

  it('negative control: the healed a2uiOutput keeps the mismatch-only arm (stage 1 fills an absent version)', () => {
    const a2uiOutput = dropVersion(DANGLING_CHILD_FIXED, 0)
    expect(validateRecord(repairRecord({ a2uiOutput: a2uiOutput as never }))).toEqual([])
    expect(validateRecord({ ...validExemplar, a2uiOutput: dropVersion(validExemplar.a2uiOutput!, 0) as never })).toEqual([])
  })
})
