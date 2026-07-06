import { describe, it, expect } from 'vitest'
// node:fs is untyped here (no @types/node devDep) — the same reverse-coupling fs-read pattern as
// components/src/descriptor/site-coverage.test.ts / site/lib/adr.test.ts.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the apex-of-the-DAG invariant @agent-ui/app rests on (SPEC-R1, LLD-C2). Two checks, one
// file:
//   (1) every import under app/src/** resolves ONLY to {@agent-ui/components, @agent-ui/a2ui,
//       @agent-ui/shared} or a local `./`/`../` path — app may depend DOWN the DAG (it sits at the top,
//       nothing is above it) and never on itself via its own package name.
//   (2) no source under components/src or a2ui/src — the two inward packages app sits above — imports
//       @agent-ui/app; the apex is never imported back by anything it depends on (SPEC-R1 AC2).
// (1) reuses the no-execution raw-text glob idiom from components/src/layering.test.ts; (2) reuses the
// fs-walk idiom from descriptor/site-coverage.test.ts. Both grep import specifiers as text — a
// deliberately-bad specifier is inert, never executed, so a red result can't crash the run.
//
// Blind spot (documented, not pretended away): the regexes below match static `import ... from '...'`
// and bare `import '...'` forms only — a dynamic `import('@agent-ui/app')` would NOT be caught. Same
// pre-existing gap as components/src/layering.test.ts. No dynamic imports exist under app/src (or the
// two scanned inward packages) today.
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
const isAllowedAppSpecifier = (spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/a2ui' || spec.startsWith('@agent-ui/a2ui/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/')

const isAppSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/app' || spec.startsWith('@agent-ui/app/')

describe('import layering — app/src imports only down the DAG', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0) // holds even pre-C3: the barrel alone still counts
  })

  it('every app/src file imports only {components,a2ui,shared} or a local path', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isAllowedAppSpecifier(spec)) violations.push(`${path} -> "${spec}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a self-import of @agent-ui/app', () => {
    const src = `import { badge } from '@agent-ui/app'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedAppSpecifier(s))
    expect(violations).toEqual(['@agent-ui/app'])
  })
})

describe('components/src and a2ui/src never import @agent-ui/app (apex stays un-imported)', () => {
  const ROOT = process.cwd()
  const SCAN_ROOTS = [`${ROOT}/packages/agent-ui/components/src`, `${ROOT}/packages/agent-ui/a2ui/src`]

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

  it('anti-vacuous: the walk finds files under both scanned inward packages', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(SCAN_ROOTS.every((root) => files.some((f) => f.startsWith(`${root}/`)))).toBe(true)
  })

  it('no file under components/src or a2ui/src imports @agent-ui/app', () => {
    const violations: string[] = []
    for (const path of files) {
      const src = readFileSync(path, 'utf8') as string
      for (const spec of specifiersOf(src)) {
        if (isAppSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/app import from an inward file', () => {
    const src = `import { badge } from '@agent-ui/app'\n`
    const violations = specifiersOf(src).filter(isAppSpecifier)
    expect(violations).toEqual(['@agent-ui/app'])
  })
})
