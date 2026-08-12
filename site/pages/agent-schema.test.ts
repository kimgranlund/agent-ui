// agent-schema.test.ts — the drift gate for agent-schema.ts (GH #781). This page has no `{name}.md`
// descriptor to derive an API table from (it documents a data shape, not one tagged component's
// contract), so its structurable claims are proven three different ways, each with its own gate home:
//
//   1. The CONFIG table (§1, agentConfigSchema()) — DOM-shown rows ≡ a fresh, independent call into the
//      real function (the persona-library-pattern.ts "DOM-shown ≡ freshly-derived" precedent). Plus a
//      structural regression guard for the page's own prose claim: no `model` field ever reappears in
//      this schema (ADR-0131 cl.1 rev.2 — model lives in the roster, not the schema).
//   2. The Model roster table (§2, modelRoster()) — same DOM-shown ≡ fresh-call proof, plus a structural
//      guard for GH #137's claim: the roster carries no admin-editable/free-text member (every id is one
//      of the SAME fixed ids on every call — modelRoster() returns no more, no fewer).
//   3. The AgentConfigSnapshot table (§3) — TWO compile-time gates already exist on the page itself
//      (AGENT_CONFIG_SNAPSHOT_SAMPLE and AGENT_CONFIG_SNAPSHOT_DOCS are both typed exactly against the
//      interface — `npm run check` fails the moment the interface's field set changes there). This file
//      adds a THIRD, independent, source-text scan (the component-descriptor-sourcewire.test.ts
//      precedent: extract the real interface's field names straight out of agent-admin-schema.ts's own
//      source text) — a `vitest`-run, hand-inspectable gate that doesn't rely on TypeScript at all, so a
//      reviewer can watch it fail on a real synthetic drift without touching the shipped interface.
//
// DOM reads happen inside `beforeAll`, never at describe-body top level (a2ui-chat.test.ts precedent) —
// describe callbacks run during vitest's synchronous COLLECTION phase, before any hook runs.
import { describe, it, expect, beforeAll } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (sitemap.test.ts precedent)
import { readFileSync } from 'node:fs'
import {
  agentConfigSchema,
  modelRoster,
  DEFAULT_MODEL_ID,
  runStubAgentTurn,
  type AgentConfigSnapshot,
} from '@agent-ui/app/agent-admin-schema'

declare const process: { cwd(): string }

// ── §3's independent source-text scan (the sourcewire precedent, generalized from states/slots to a
//    plain interface's field names) ──────────────────────────────────────────────────────────────────────

/** Extract the top-level field names of one `interface <name> { ... }` block from real TS source text —
 *  a plain, single-purpose regex scan (no TS compiler involved), so this test can watch it distinguish a
 *  real interface from a mutated one without ever needing a red compile. Strips `/** ... *\/` block
 *  comments first (a doc comment can itself contain a colon-terminated word that would otherwise
 *  false-positive as a field). */
function interfaceFieldNames(source: string, interfaceName: string): string[] {
  const start = source.indexOf(`interface ${interfaceName} {`)
  if (start === -1) return []
  const braceStart = source.indexOf('{', start)
  let depth = 0
  let end = braceStart
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = source.slice(braceStart + 1, end).replace(/\/\*[\s\S]*?\*\//g, '')
  const fields: string[] = []
  const fieldLine = /^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\??:/gm
  let m: RegExpExecArray | null
  while ((m = fieldLine.exec(body)) !== null) fields.push(m[1]!)
  return fields
}

const SOURCE_PATH = 'packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts'
const realSource = readFileSync(`${process.cwd()}/${SOURCE_PATH}`, 'utf8') as string

const SYNTHETIC_INTERFACE = `
export interface AgentConfigSnapshot {
  name: string
  model: string
  temperature: number
}
`

describe('agent-schema — the field-name scan itself is non-vacuous (positive + negative controls)', () => {
  it('extracts all nine real AgentConfigSnapshot fields from the real source, in declaration order', () => {
    expect(interfaceFieldNames(realSource, 'AgentConfigSnapshot')).toEqual([
      'name',
      'model',
      'temperature',
      'toolsEnabled',
      'systemPrompt',
      'skills',
      'workflows',
      'resources',
      'tools',
    ])
  })

  it('a synthetic 3-field interface scans to exactly those 3 fields (proves the scan is not silently returning everything)', () => {
    expect(interfaceFieldNames(SYNTHETIC_INTERFACE, 'AgentConfigSnapshot')).toEqual(['name', 'model', 'temperature'])
  })

  it('negative control: a field REMOVED from a synthetic copy is genuinely absent from the scan (the gate bites)', () => {
    const mutated = SYNTHETIC_INTERFACE.replace('  model: string\n', '')
    expect(interfaceFieldNames(mutated, 'AgentConfigSnapshot')).not.toContain('model')
  })

  it('negative control: a field ADDED to a synthetic copy is genuinely present in the scan (the gate bites the other direction too)', () => {
    const mutated = SYNTHETIC_INTERFACE.replace('  temperature: number\n', '  temperature: number\n  extraField: boolean\n')
    expect(interfaceFieldNames(mutated, 'AgentConfigSnapshot')).toContain('extraField')
  })
})

describe('agent-schema — the page’s AgentConfigSnapshot table names EXACTLY the real interface’s fields', () => {
  it('every field the real source declares has a matching row key on the page (would fail if the interface gained a field with no doc row)', () => {
    const realFields = interfaceFieldNames(realSource, 'AgentConfigSnapshot')
    // The page's own AGENT_CONFIG_SNAPSHOT_DOCS keys are already compile-time pinned to `keyof
    // AgentConfigSnapshot` (Record<keyof AgentConfigSnapshot, string>) — this independently re-derives
    // the SAME key set from source text and cross-checks the rendered table, a second gate home.
    const rows = [...document.querySelectorAll('#agent-schema-snapshot-table tbody tr')]
    const shownKeys = rows.map((row) => row.querySelector('td')?.textContent)
    expect(shownKeys.sort()).toEqual([...realFields].sort())
  })
})

// ── §1/§2 DOM-shown ≡ freshly-derived (the persona-library-pattern.ts precedent) ────────────────────────

let configRows: Element[]
let modelRows: Element[]
let stubOutputShown: string

beforeAll(async () => {
  await import('./agent-schema.ts')
  configRows = [...document.querySelectorAll('#agent-schema-config-table tbody tr')]
  modelRows = [...document.querySelectorAll('#agent-schema-model-table tbody tr')]
  stubOutputShown = document.getElementById('agent-schema-stub-output')?.textContent ?? ''
})

describe('agent-schema.html — §1 the config table is genuinely derived from agentConfigSchema(), not a stale literal', () => {
  it('anti-vacuous: the page rendered at least one field row', () => {
    expect(configRows.length).toBeGreaterThan(0)
  })

  it('every shown row (key + type + default) matches a fresh, independent call into the real schema builder', () => {
    const fresh = agentConfigSchema()
    const freshFields = fresh.sections.flatMap((s) => s.fields)
    const shown = configRows.map((row) => {
      const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
      return { key: cells[1], type: cells[2], default: cells[4] }
    })
    const freshShaped = freshFields.map((f) => ({
      key: f.key,
      type: f.type,
      default: JSON.stringify(f.default),
    }))
    expect(shown).toEqual(freshShaped)
  })

  it('structural regression guard: no "model" field exists in this schema (ADR-0131 cl.1 rev.2 — model lives in the roster, §2)', () => {
    const fresh = agentConfigSchema()
    const keys = fresh.sections.flatMap((s) => s.fields.map((f) => f.key))
    expect(keys).not.toContain('model')
  })

  it('negative control: the row-equality check genuinely distinguishes a real divergence (the gate bites)', () => {
    const fresh = agentConfigSchema()
    const freshFields = fresh.sections.flatMap((s) => s.fields)
    const diverged = freshFields.map((f) => ({ key: f.key, type: f.type, default: JSON.stringify('DIVERGED') }))
    const shown = configRows.map((row) => {
      const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
      return { key: cells[1], type: cells[2], default: cells[4] }
    })
    expect(shown).not.toEqual(diverged)
  })
})

describe('agent-schema.html — §2 the model table is genuinely derived from modelRoster(), not a stale literal', () => {
  it('anti-vacuous: the page rendered at least one model row', () => {
    expect(modelRows.length).toBeGreaterThan(0)
  })

  it('every shown row matches a fresh, independent call into modelRoster()', () => {
    const fresh = modelRoster()
    const shown = modelRows.map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent))
    const freshShaped = fresh.map((m) => [m.id, m.label, m.provider, String(m.includedByDefault), m.id === DEFAULT_MODEL_ID ? 'yes' : ''])
    expect(shown).toEqual(freshShaped)
  })

  it('structural regression guard: no free-text/admin-added member survives across two independent calls (GH #137 — the roster is closed)', () => {
    const first = modelRoster().map((m) => m.id)
    const second = modelRoster().map((m) => m.id)
    expect(first).toEqual(second)
  })

  it('negative control: the row-equality check genuinely distinguishes a real divergence (the gate bites)', () => {
    const fresh = modelRoster()
    const diverged = fresh.map((m) => [m.id, 'SOMEONE ELSE', m.provider, String(m.includedByDefault), ''])
    const shown = modelRows.map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent))
    expect(shown).not.toEqual(diverged)
  })
})

describe('agent-schema.html — §3 the shown stub output is the real runStubAgentTurn return, not paraphrased prose', () => {
  it('anti-vacuous: the page rendered a non-empty stub block', () => {
    expect(stubOutputShown.length).toBeGreaterThan(20)
  })

  it('a fresh, independent call with the SAME sample config produces the SAME text the page shows', () => {
    const sample: AgentConfigSnapshot = {
      name: 'Ada',
      model: DEFAULT_MODEL_ID,
      temperature: 0.7,
      toolsEnabled: true,
      systemPrompt: 'You are a careful, concise research assistant.',
      skills: ['Summarizing'],
      workflows: ['Weekly report'],
      resources: ['Style guide'],
      tools: ['Web search'],
    }
    expect(runStubAgentTurn('What can you help me with?', sample)).toBe(stubOutputShown)
  })

  it('negative control: a DIFFERENT config produces DIFFERENT stub text than the page shows (the gate bites)', () => {
    const diverged: AgentConfigSnapshot = {
      name: 'Someone Else',
      model: DEFAULT_MODEL_ID,
      temperature: 0.1,
      toolsEnabled: false,
      systemPrompt: 'x',
      skills: [],
      workflows: [],
      resources: [],
      tools: [],
    }
    expect(runStubAgentTurn('What can you help me with?', diverged)).not.toBe(stubOutputShown)
  })
})
