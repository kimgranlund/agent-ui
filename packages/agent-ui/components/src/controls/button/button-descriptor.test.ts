import { describe, it, expect } from 'vitest'
import { UIButtonElement } from './button.ts'
import { splitFrontmatter, parseDescriptor } from '../../descriptor/component-descriptor.ts'
// Read button.md as text (vite strips `.md?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s8 — button.md descriptor (ADR-0004). MINIMAL structural probe: the YAML frontmatter fence
// parses, carries the ADR-0004 / plan §10 descriptor field set, and its `attributes[]` MATCHES the live
// `UIButtonElement.props` (variant/size/disabled — type/reflect/default). The full contract↔props
// trip-wire with a negative control (s10) is a LATER slice — not here.
// The fence READER lives in ../../descriptor/component-descriptor.ts (factored out at s9 so this probe, the
// s9 schema, and the s10 trip-wire share ONE parser — never a divergent copy).

const md = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/button/button.md`, 'utf8') as string

const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)
const byName = new Map(parsed.attributes.map((a) => [a.name, a] as const))

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
    for (const field of required) expect(parsed.topLevelKeys.has(field), `missing descriptor field: ${field}`).toBe(true)
  })

  it('tag is ui-button and face records a non-form-associated control', () => {
    expect(/^tag:\s*ui-button\s*$/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true) // extends UIElement, NOT UIFormElement
  })

  it('attributes[] mirrors the live UIButtonElement.props (same names — no drift, no omission)', () => {
    const fmNames = parsed.attributes.map((a) => a.name).sort()
    const liveNames = Object.keys(liveProps).sort()
    expect(fmNames).toEqual(liveNames) // exactly variant/size/disabled
  })

  it('each attribute records type/default/reflect matching the live prop config', () => {
    for (const [name, config] of Object.entries(liveProps)) {
      const attr = byName.get(name)
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
