import { describe, it, expect } from 'vitest'
// Raw-text fs read — the same reverse-coupling fs-read pattern as router/src/layering.test.ts /
// components/src/descriptor/site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the SPEC-C1 package-boundary invariant @agent-ui/code rests on (LLD-C2). Two checks, one
// file — mirrors router/src/layering.test.ts exactly, re-typed for `code`:
//   (1) every import under code/src/** resolves ONLY to {@agent-ui/components, @agent-ui/shared} or a
//       local `./`/`../` path — code sits as a SIBLING branch off components (`shared ← components ←
//       {a2ui, router, code} ← app`) and never depends on its own package name (SPEC-C1 AC1).
//   (2) no source under components/src, a2ui/src, or shared/src imports @agent-ui/code — the catalog
//       fence is structural: a2ui has no route to markdown (SPEC-C1 AC2).
// Both grep import specifiers as text — a deliberately-bad specifier is inert, never executed, so a red
// result can't crash the run.
//
// Blind spot (documented, not pretended away — the same pre-existing gap router/src/layering.test.ts
// documents): the regexes below match static `import ... from '...'` and bare `import '...'` forms only —
// a dynamic `import('@agent-ui/code')` would NOT be caught. No dynamic import exists under code/src (or
// the three scanned inward packages) at M1.
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

// Shared predicates so the synthetic-violation tests exercise the exact matcher the real gates run.
// `@codemirror/*` / `@lezer/*` are the ADR-0139 runtime deps (code's first genuine third-party runtime
// dependency, the ruled zero-dep exception). They are ADMITTED to the code-package DAG here; WHERE they may
// appear is the separate, tighter job of editor/confinement.test.ts (only editor/cm-editor.ts, reached via a
// dynamic import) — layering answers "may code/src depend on this at all", confinement answers "which file".
const isAllowedCodeSpecifier = (spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/') ||
  spec.startsWith('@codemirror/') || spec.startsWith('@lezer/')

const isCodeSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/code' || spec.startsWith('@agent-ui/code/')

describe('import layering — code/src imports only down the DAG', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('every code/src file imports only {components,shared} or a local path', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isAllowedCodeSpecifier(spec)) violations.push(`${path} -> "${spec}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a self-import of @agent-ui/code', () => {
    const src = `import { tokenize } from '@agent-ui/code'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedCodeSpecifier(s))
    expect(violations).toEqual(['@agent-ui/code'])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/a2ui import (up/sideways the DAG)', () => {
    const src = `import { renderSurface } from '@agent-ui/a2ui'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedCodeSpecifier(s))
    expect(violations).toEqual(['@agent-ui/a2ui'])
  })
})

describe('components/src, a2ui/src and shared/src never import @agent-ui/code (the catalog fence is structural)', () => {
  const ROOT = process.cwd()
  const SCAN_ROOTS = [
    `${ROOT}/packages/agent-ui/components/src`,
    `${ROOT}/packages/agent-ui/a2ui/src`,
    `${ROOT}/packages/agent-ui/shared/src`,
  ]

  type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }
  /** Recursively list every .ts file under `dir` (absolute paths); a missing dir yields []. */
  function walk(dir: string): string[] {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
    } catch {
      return []
    }
    const out: string[] = []
    for (const e of entries) {
      const full = `${dir}/${e.name}`
      if (e.isDirectory()) out.push(...walk(full))
      else if (e.isFile() && e.name.endsWith('.ts')) out.push(full)
    }
    return out
  }

  const files = SCAN_ROOTS.flatMap((root) => walk(root))

  it('anti-vacuous: the walk finds files under all three scanned inward packages', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(SCAN_ROOTS.every((root) => files.some((f) => f.startsWith(`${root}/`)))).toBe(true)
  })

  it('no file under components/src, a2ui/src or shared/src imports @agent-ui/code', () => {
    const violations: string[] = []
    for (const path of files) {
      const src = readFileSync(path, 'utf8') as string
      for (const spec of specifiersOf(src)) {
        if (isCodeSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/code import from an inward file', () => {
    const src = `import { tokenize } from '@agent-ui/code'\n`
    const violations = specifiersOf(src).filter(isCodeSpecifier)
    expect(violations).toEqual(['@agent-ui/code'])
  })
})
