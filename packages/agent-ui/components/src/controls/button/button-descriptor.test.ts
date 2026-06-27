import { describe, it, expect } from 'vitest'
import { UIButtonElement } from './button.ts'
// Read button.md as text (vite strips `.md?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s8 — button.md descriptor (ADR-0004). MINIMAL structural probe: the YAML frontmatter fence
// parses, carries the ADR-0004 / plan §10 descriptor field set, and its `attributes[]` MATCHES the live
// `UIButtonElement.props` (variant/size/disabled — type/reflect/default). The full contract↔props
// trip-wire with a negative control (s10) and the frontmatter schema (s9) are LATER slices — not here.
// Zero-dep library: no YAML parser is installed, so this reads the fence with a small, fence-scoped
// reader (top-level keys + the attributes sequence), enough for "parses + matches static props".

const md = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/button/button.md`, 'utf8') as string

/** Strip a YAML inline comment (` #…`, whitespace-led) and trim — used only on the scalar fields we read. */
const scalar = (s: string): string => s.replace(/\s+#.*$/, '').trim()

/** Extract the leading `---`…`---` frontmatter fence + the prose body after it. */
function splitFrontmatter(src: string): { fence: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src)
  if (!m) throw new Error('button.md has no leading --- frontmatter fence')
  return { fence: m[1], body: m[2] }
}

/** Top-level (column-0) keys in the fence, ignoring comment/blank lines. */
function topLevelKeys(fence: string): Set<string> {
  const keys = new Set<string>()
  for (const line of fence.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue
    const m = /^([A-Za-z][\w]*):/.exec(line)
    if (m) keys.add(m[1])
  }
  return keys
}

interface FmAttr {
  type?: string
  values?: string[]
  default?: string
  reflect?: boolean
}

/** Parse the `attributes:` sequence (a list of `- name:` mappings) into name → fields. Fence-scoped. */
function parseAttributes(fence: string): Map<string, FmAttr> {
  const lines = fence.split('\n')
  const start = lines.findIndex((l) => /^attributes:/.test(l))
  if (start === -1) throw new Error('button.md frontmatter has no attributes block')
  // block = until the next column-0 key, ignoring comment lines
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) {
      end = i
      break
    }
  }
  const block = lines.slice(start + 1, end)
  const attrs = new Map<string, FmAttr>()
  let current: FmAttr | null = null
  for (const line of block) {
    const nameM = /^\s*-\s*name:\s*(.+)$/.exec(line)
    if (nameM) {
      current = {}
      attrs.set(scalar(nameM[1]), current)
      continue
    }
    if (!current) continue
    const fieldM = /^\s+([A-Za-z]\w*):\s*(.*)$/.exec(line)
    if (!fieldM) continue
    const [, key, rawVal] = fieldM
    const val = scalar(rawVal)
    if (key === 'type') current.type = val
    else if (key === 'default') current.default = val
    else if (key === 'reflect') current.reflect = val === 'true'
    else if (key === 'values') current.values = val.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim())
  }
  return attrs
}

const { fence, body } = splitFrontmatter(md)

// The live contract surface, read off the class (NOT hardcoded) so this probe tracks button.ts.
type LiveConfig = { type: { from(a: string | null): unknown }; default: unknown; reflect?: boolean }
const liveProps = (UIButtonElement as unknown as { props: Record<string, LiveConfig> }).props

describe('button.md descriptor — frontmatter parses + matches static props (s8)', () => {
  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-button') // the /site doc prose, not the contract
  })

  it('carries the ADR-0004 / plan §10 descriptor field set as top-level keys', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    const keys = topLevelKeys(fence)
    for (const field of required) expect(keys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-button and face records a non-form-associated control', () => {
    expect(/^tag:\s*ui-button\s*$/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // extends UIElement, NOT UIFormElement
  })

  it('attributes[] mirrors the live UIButtonElement.props (same names — no drift, no omission)', () => {
    const fmNames = [...parseAttributes(fence).keys()].sort()
    const liveNames = Object.keys(liveProps).sort()
    expect(fmNames).toEqual(liveNames) // exactly variant/size/disabled
  })

  it('each attribute records type/default/reflect matching the live prop config', () => {
    const attrs = parseAttributes(fence)
    for (const [name, config] of Object.entries(liveProps)) {
      const attr = attrs.get(name)
      expect(attr, `descriptor is missing attribute ${name}`).toBeDefined()
      if (!attr) continue
      // default — the frontmatter token equals the live default serialized to text
      expect(attr.default).toBe(String(config.default))
      // reflect — the frontmatter boolean equals the live reflect flag
      expect(attr.reflect ?? false).toBe(config.reflect ?? false)
      // type — declared and behaviourally consistent with the live codec
      expect(attr.type, `attribute ${name} has no type`).toBeTruthy()
      if (attr.type === 'enum') {
        expect(attr.values, `enum ${name} has no values`).toBeTruthy()
        for (const v of attr.values ?? []) expect(config.type.from(v)).toBe(v) // each member round-trips
        expect(config.type.from('__not-a-member__')).toBe((attr.values ?? [])[0]) // snaps to the first member
      } else if (attr.type === 'boolean') {
        expect(config.type.from('')).toBe(true) // presence semantics
        expect(config.type.from(null)).toBe(false)
      }
    }
  })
})
