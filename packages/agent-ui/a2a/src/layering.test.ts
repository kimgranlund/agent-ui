import { describe, it, expect } from 'vitest'

// Trip-wire (D2 ruling, GH #761): @agent-ui/a2a is a ZERO-DEP LEAF (`icons`/`a2a` import nothing —
// CLAUDE.md §Conventions; the package is wire types + validation pinned to A2A spec v0.3.0, the
// tic-tac-toe arena, and corpus shards). Every non-test module under a2a/src/** imports ONLY local
// `./`/`../` paths — no other @agent-ui package (importing a2ui here would close a cycle with the
// A2UI-over-A2A bridge), no node builtins in shipped source (the arena's node-side harness lives in
// tools/tests, deliberately outside this glob), no dependencies. Same no-execution raw-text idiom as
// the other per-package layering gates; this file closed one of the three gaps the 2026-08-11 audit
// named in CLAUDE.md's enforcement claim (decision D2, ruled 2026-08-12).
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

describe('import layering — a2a/src is a zero-dep leaf (local imports only)', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts') && !k.endsWith('.browser.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([p]) => p === 'index.ts')).toBe(true)
  })

  it('every a2a/src file imports only local paths — the leaf reaches nothing', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isLocalSpecifier(spec)) violations.push(`${path} -> "${spec}": a2a imports nothing (zero-dep leaf)`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/a2ui import (the bridge-cycle direction)', () => {
    // assembled, not literal — inert to any raw-text inward scan of this package
    const a2uiSpec = ['@agent-ui', 'a2ui'].join('/')
    const src = `import { createRenderer } from '${a2uiSpec}'\n`
    expect(specifiersOf(src).filter((s) => !isLocalSpecifier(s))).toEqual([a2uiSpec])
  })

  it('synthetic-violation: the matcher flags a node builtin in shipped source', () => {
    const src = `import { readFileSync } from 'node:fs'\n`
    expect(specifiersOf(src).filter((s) => !isLocalSpecifier(s))).toEqual(['node:fs'])
  })
})
