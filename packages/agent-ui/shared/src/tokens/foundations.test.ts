import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CFG, check } from './scale.mjs'
import { OUT_REL, ROOT_DEFAULT, renderFoundationsCss } from '../../../../../scripts/generate-foundations.mjs'

// ADR-0245 clause 1 and 10c: the config gate, the generated-file drift gate and the dark-launch scope.
// The 36-cell computed leg (tokens equal resolve() in both engines) is foundations.browser.test.ts.
declare const process: { cwd(): string }

const ROOT = process.cwd()
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, 'utf8') as string
const sha = (rel: string): string => createHash('sha256').update(readFileSync(`${ROOT}/${rel}`)).digest('hex')
const committed = read(OUT_REL)

/** Every top-level selector list in a flat sheet (the generated sheet has no at-rules or nesting). */
const selectorsOf = (css: string): string[] =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((chunk) => chunk.split('{')[0]?.trim() ?? '')
    .filter(Boolean)
    .flatMap((list) => list.split(/,(?![^(]*\))/).map((s) => s.trim()))

describe('foundations: the vendored config and its contract (ADR-0245 clause 1)', () => {
  it('scale.mjs is a byte copy of the ADR derivation copy (the skill reference implementation)', () => {
    expect(sha('packages/agent-ui/shared/src/tokens/scale.mjs')).toBe(
      sha('.claude/docs/references/foundations-derivation/scale.mjs'),
    )
  })

  it('check() returns no failure (M1 to M10)', () => {
    expect(check()).toEqual([])
  })

  it('the generator refuses to emit when check() fails (a widget step that no longer grows trips M2)', () => {
    const saved = [...CFG.tiers.widget] as [number, number, number, number]
    CFG.tiers.widget[2] = 0
    try {
      expect(check().some((f) => f.startsWith('M2'))).toBe(true)
      expect(() => renderFoundationsCss()).toThrow(/check\(\) failed/)
    } finally {
      CFG.tiers.widget = saved
    }
    expect(check()).toEqual([])
  })
})

describe('foundations: generated-file drift and the dark-launch scope (ADR-0245 clause 10a)', () => {
  it('foundations.gen.css is byte-identical to the generator output (run node scripts/generate-foundations.mjs)', () => {
    expect(committed).toBe(renderFoundationsCss())
  })

  it('until the cut, ROOT_DEFAULT is false and every selector sits on or inside a [data-tier] region', () => {
    expect(ROOT_DEFAULT).toBe(false)
    const selectors = selectorsOf(committed)
    expect(selectors.length).toBeGreaterThan(10)
    expect(selectors.filter((s) => !s.startsWith('[data-tier'))).toEqual([])
    expect(committed.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/:root/)
  })

  it('the scope predicate bites: the cut form declares :root and unscoped axes', () => {
    const cut = selectorsOf(renderFoundationsCss({ rootDefault: true }))
    expect(cut).toContain(':root')
    expect(cut.filter((s) => !s.startsWith('[data-tier'))).toContain("[data-scale='sm']")
  })

  it('declares every ADR-0245 clause 1 output name', () => {
    const names = [
      'n', 'c', 'height', 'inset', 'radius', 'icon-box', 'glyph-box', 'glyph-stroke', 'corner-shape',
      ...['display', 'heading', 'subhead', 'section-kicker', 'title', 'body', 'control', 'field-label', 'group-kicker'].map((r) => `type-${r}`),
      ...['group', 'widget', 'card', 'layout'].flatMap((l) => ['margin', 'gutter', 'radius'].map((q) => `${l}-${q}`)),
    ]
    for (const name of names) expect(committed, `--md-sys-${name}`).toMatch(new RegExp(`\\n  --md-sys-${name}: `))
  })
})
