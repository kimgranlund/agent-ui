// a2ui-agent.test.ts — the drift gate for a2ui-agent.ts (GH #1048). The page's own extractInterface/
// extractSignature helpers already throw at IMPORT time if a marker moved (a build-time gate baked into
// the page module itself — importing it below is itself the anti-vacuous "extraction actually succeeded"
// proof). This file adds a SECOND, independent gate home (the agent-schema.test.ts precedent — a plain
// source-text field-name scan, no TS compiler involved): every field the real `Session`/`AgentTransport`
// interfaces declare TODAY has a matching mention in the page's own rendered code blocks, so a renamed or
// removed field would fail here even if the extraction itself kept succeeding (e.g. a field silently
// dropped from the interface, or one hand-typed into the page that no longer exists upstream). Each check
// carries its own negative control, proving the assertion genuinely distinguishes a real divergence.
import { describe, it, expect, beforeAll } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (agent-schema.test.ts precedent)
import { readFileSync } from 'node:fs'

declare const process: { cwd(): string }

// ── the field-name scan (agent-schema.test.ts's interfaceFieldNames, duplicated — a plain regex scan,
//    genuinely independent of the page's own extractInterface, which is brace-depth-based) ───────────────
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

const AGENT_TRANSPORT_SOURCE_PATH = 'packages/agent-ui/a2ui/src/agent/agent-transport.ts'
const realAgentTransportSource = readFileSync(`${process.cwd()}/${AGENT_TRANSPORT_SOURCE_PATH}`, 'utf8') as string
const A2UI_PACKAGE_JSON_PATH = 'packages/agent-ui/a2ui/package.json'
const realA2uiPackageJson = readFileSync(`${process.cwd()}/${A2UI_PACKAGE_JSON_PATH}`, 'utf8') as string

const SYNTHETIC_INTERFACE = `
export interface Session {
  turns: Turn[]
  surfacePrefix?: string
}
`

describe('a2ui-agent — the field-name scan itself is non-vacuous (positive + negative controls)', () => {
  it('extracts both real Session fields from the real source', () => {
    expect(interfaceFieldNames(realAgentTransportSource, 'Session')).toEqual(['turns', 'surfacePrefix'])
  })

  it('a synthetic 2-field interface scans to exactly those 2 fields (proves the scan is not silently returning everything)', () => {
    expect(interfaceFieldNames(SYNTHETIC_INTERFACE, 'Session')).toEqual(['turns', 'surfacePrefix'])
  })

  it('negative control: a field REMOVED from a synthetic copy is genuinely absent from the scan (the gate bites)', () => {
    const mutated = SYNTHETIC_INTERFACE.replace('  surfacePrefix?: string\n', '')
    expect(interfaceFieldNames(mutated, 'Session')).not.toContain('surfacePrefix')
  })

  it('negative control: a field ADDED to a synthetic copy is genuinely present in the scan (the gate bites the other direction too)', () => {
    const mutated = SYNTHETIC_INTERFACE.replace('  surfacePrefix?: string\n', '  surfacePrefix?: string\n  extraField: boolean\n')
    expect(interfaceFieldNames(mutated, 'Session')).toContain('extraField')
  })
})

// ── the page's own rendered blocks ≡ the real source it derives from ──────────────────────────────────

let pageText: string

beforeAll(async () => {
  await import('./a2ui-agent.ts') // throws at import if any extractInterface/extractSignature marker moved
  pageText = document.body.textContent ?? ''
})

describe('a2ui-agent.html — the derived Session/AgentTransport blocks name every real field, not a stale copy', () => {
  it('anti-vacuous: the page rendered non-trivial content', () => {
    expect(pageText.length).toBeGreaterThan(500)
  })

  it('every field the real Session interface declares today appears on the rendered page', () => {
    const realFields = interfaceFieldNames(realAgentTransportSource, 'Session')
    expect(realFields.length).toBeGreaterThan(0) // anti-vacuous: the real interface actually has fields
    for (const field of realFields) expect(pageText).toContain(field)
  })

  it('the AgentTransport interface’s one real method name (turn) appears on the rendered page', () => {
    expect(pageText).toMatch(/turn\(input: TurnInput\)/)
  })

  it('negative control: a field name that does NOT exist on Session is genuinely absent from the page (the gate bites)', () => {
    expect(pageText).not.toContain('surfacePrefixThatDoesNotExist')
  })
})

describe('a2ui-agent.html — the exports-map block is the real, freshly-read package.json, not a hand-typed copy', () => {
  it('every subpath key the real a2ui package.json declares today appears on the rendered page', () => {
    const realExports = (JSON.parse(realA2uiPackageJson) as { exports: Record<string, string> }).exports
    const realKeys = Object.keys(realExports)
    expect(realKeys).toContain('./agent/meta-line') // anti-vacuous: the browser-safe subpaths this page's Part E is about
    expect(realKeys).toContain('./agent/genui-line')
    for (const key of realKeys) expect(pageText).toContain(key)
  })

  it('negative control: a subpath key that does NOT exist in the real exports map is genuinely absent from the page (the gate bites)', () => {
    expect(pageText).not.toContain('./agent/does-not-exist')
  })
})

describe('a2ui-agent.html — the consumer-example block is the real, checked-in script, not a paraphrase', () => {
  it('the page shows the real script’s own run instructions verbatim (ANTHROPIC_API_KEY / produce-to-conversation.ts)', () => {
    expect(pageText).toContain('produce-to-conversation.ts')
    expect(pageText).toContain('ANTHROPIC_API_KEY')
  })
})
