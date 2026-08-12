import { describe, it, expect } from 'vitest'

// Trip-wire (D2 ruling, GH #761): @agent-ui/shared is the DAG's BOTTOM (`shared ← components ← …`,
// CLAUDE.md §Conventions) — every non-test module under shared/src/** imports ONLY local `./`/`../`
// paths. Any bare-specifier import (another @agent-ui package, a node builtin, a dependency) is an
// upward or outward edge the layer must never grow. Same no-execution raw-text idiom as the other
// per-package layering gates (router/icons/components/app/code) — this file closed the gap where
// CLAUDE.md's "(Enforced by the per-package layering.test.ts trip-wires.)" over-claimed: shared, a2a,
// and a2ui had no gate until the 2026-08-11 audit named it (decision D2, ruled 2026-08-12).
const raw = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const specifiersOf = (src: string): string[] => {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

const isLocalSpecifier = (spec: string): boolean => spec.startsWith('.')

describe('import layering — shared/src is the DAG bottom (local imports only)', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([p]) => p === 'index.ts')).toBe(true)
  })

  it('every shared/src file imports only local paths — the bottom layer reaches nothing', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isLocalSpecifier(spec)) violations.push(`${path} -> "${spec}": shared imports nothing but itself`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/components import (up the DAG)', () => {
    // assembled, not literal — this package is inward-scanned raw (incl. tests) by sibling gates
    const componentsSpec = ['@agent-ui', 'components'].join('/')
    const src = `import { UIElement } from '${componentsSpec}'\n`
    expect(specifiersOf(src).filter((s) => !isLocalSpecifier(s))).toEqual([componentsSpec])
  })

  it('synthetic-violation: the matcher flags a bare dependency import (the zero-dep law)', () => {
    const src = `import { z } from 'zod'\n`
    expect(specifiersOf(src).filter((s) => !isLocalSpecifier(s))).toEqual(['zod'])
  })
})
