import { describe, it, expect } from 'vitest'
// Raw-text fs read — the same reverse-coupling fs-read pattern as app/src/layering.test.ts /
// components/src/descriptor/site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the SPEC-R1 package-boundary invariant @agent-ui/router rests on (LLD-C2). Two checks, one
// file:
//   (1) every import under router/src/** resolves ONLY to {@agent-ui/components, @agent-ui/shared} or a
//       local `./`/`../` path — router sits BELOW `@agent-ui/app` in the DAG (`shared ← components ←
//       {a2ui, router} ← app`) and never depends on its own package name (SPEC-R1 AC1).
//   (2) no source under components/src, a2ui/src, or shared/src imports @agent-ui/router — the catalog
//       fence is structural: a2ui has no route to navigation (SPEC-R1 AC2).
// Both grep import specifiers as text — a deliberately-bad specifier is inert, never executed, so a red
// result can't crash the run.
//
// Blind spot (documented, not pretended away — the same pre-existing gap as app/src/layering.test.ts and
// components/src/layering.test.ts): the regexes below match static `import ... from '...'` and bare
// `import '...'` forms only — a dynamic `import('@agent-ui/router')` would NOT be caught. No dynamic
// imports exist under router/src (or the three scanned inward packages) at v1 (LLD-C2's documented note:
// the outlet's lazy factories are CONSUMER code, not package imports).
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
const isAllowedRouterSpecifier = (spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/')

const isRouterSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/router' || spec.startsWith('@agent-ui/router/')

describe('import layering — router/src imports only down the DAG', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0) // holds even pre-C3: the barrel alone still counts
  })

  it('every router/src file imports only {components,shared} or a local path', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isAllowedRouterSpecifier(spec)) violations.push(`${path} -> "${spec}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a self-import of @agent-ui/router', () => {
    const src = `import { createRouter } from '@agent-ui/router'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedRouterSpecifier(s))
    expect(violations).toEqual(['@agent-ui/router'])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/app import (up the DAG)', () => {
    const src = `import { agentAppShell } from '@agent-ui/app'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedRouterSpecifier(s))
    expect(violations).toEqual(['@agent-ui/app'])
  })
})

describe('components/src, a2ui/src and shared/src never import @agent-ui/router (the catalog fence is structural)', () => {
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

  it('no file under components/src, a2ui/src or shared/src imports @agent-ui/router', () => {
    const violations: string[] = []
    for (const path of files) {
      const src = readFileSync(path, 'utf8') as string
      for (const spec of specifiersOf(src)) {
        if (isRouterSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/router import from an inward file', () => {
    const src = `import { createRouter } from '@agent-ui/router'\n`
    const violations = specifiersOf(src).filter(isRouterSpecifier)
    expect(violations).toEqual(['@agent-ui/router'])
  })
})
