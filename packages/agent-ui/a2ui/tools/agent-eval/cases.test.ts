// cases.test.ts: the selection-case bijection (GH #1810). The expected ids come from walking
// `src/catalog/` for `selection.json` and parsing the raw JSON on its own, never from the loader under
// test and never from a literal count.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { deriveSelectionCases, loadResponseTypeCases, parseResponseTypeCase, RESPONSE_TYPE_EXPECTS } from './cases.ts'

const CATALOG_DIR = join(process.cwd(), 'packages/agent-ui/a2ui/src/catalog')

function sidecars(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...sidecars(p))
    else if (e.name === 'selection.json') out.push(p)
  }
  return out
}

interface Sidecar {
  catalogId?: string
  personaId?: string
  types: Record<string, { intents: string[]; notFor: { type: string }[] }>
}

describe('deriveSelectionCases', () => {
  it('every notFor edge across the five sidecars yields exactly one case', () => {
    const files = sidecars(CATALOG_DIR)
    expect(files.length).toBeGreaterThan(0)
    const expected: string[] = []
    const prompts = new Map<string, string>()
    for (const file of files) {
      const doc = JSON.parse(readFileSync(file, 'utf8')) as Sidecar
      const source = doc.catalogId ?? doc.personaId
      expect(typeof source, file).toBe('string')
      for (const [a, entry] of Object.entries(doc.types)) {
        for (const edge of entry.notFor) {
          const id = `${source}:${a}->${edge.type}`
          expected.push(id)
          prompts.set(id, entry.intents[0]!)
        }
      }
    }
    expect(expected.length).toBeGreaterThan(0)

    const cases = deriveSelectionCases()
    const actual = cases.map((c) => c.id)
    expect(new Set(actual).size).toBe(actual.length)
    expect([...actual].sort()).toEqual([...expected].sort())
    for (const c of cases) {
      expect(c.id).toBe(`${c.source}:${c.expectType}->${c.forbidType}`)
      expect(c.prompt).toBe(prompts.get(c.id))
    }
  })
})

describe('response-type labelled set', () => {
  const fixtures = join(process.cwd(), 'packages/agent-ui/a2ui/tools/agent-eval/fixtures')
  const raw = (JSON.parse(readFileSync(join(fixtures, 'response-type-cases.json'), 'utf8')) as { cases: Record<string, unknown>[] }).cases

  it('holds at least 40 cases, every expect a literal, at least 4 with a session', () => {
    expect(raw.length).toBeGreaterThanOrEqual(40)
    for (const c of raw) expect(['text', 'surface', 'both'], String(c.id)).toContain(c.expect)
    expect(raw.filter((c) => c.session !== undefined).length).toBeGreaterThanOrEqual(4)
    expect(new Set(raw.map((c) => c.id)).size).toBe(raw.length)
  })

  it('the loader returns exactly the raw JSON', () => {
    expect(loadResponseTypeCases(fixtures)).toEqual(raw)
  })

  it('a bad expect throws naming the literals', () => {
    expect(() => parseResponseTypeCase({ id: 'x', catalogId: 'agent-ui', prompt: 'hi', expect: 'card' })).toThrow(RESPONSE_TYPE_EXPECTS.join(', '))
  })

  it('a session that is not one user then one assistant turn throws', () => {
    const turn = (role: string) => ({ role, content: 'c' })
    const base = { id: 'x', catalogId: 'agent-ui', prompt: 'hi', expect: 'text' }
    expect(() => parseResponseTypeCase({ ...base, session: { turns: [turn('user')] } })).toThrow('session')
    expect(() => parseResponseTypeCase({ ...base, session: { turns: [turn('assistant'), turn('user')] } })).toThrow('session')
    expect(parseResponseTypeCase({ ...base, session: { turns: [turn('user'), turn('assistant')] } }).session?.turns).toHaveLength(2)
  })
})
