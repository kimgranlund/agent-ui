import { describe, it, expect } from 'vitest'
// Raw-text fs read — the same reverse-coupling fs-read pattern as router/src/layering.test.ts /
// app/src/layering.test.ts / components/src/descriptor/site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the SPEC-R1 package-boundary invariant @agent-ui/data rests on (ADR-0192 cl.1). Three checks:
//   (1) every import under data/src/** resolves ONLY to {@agent-ui/components, @agent-ui/shared} or a
//       local `./`/`../` path (SPEC-R1 AC1).
//   (2) no source under components/src, a2ui/src, shared/src, router/src, code/src imports @agent-ui/data
//       — the catalog fence is structural (SPEC-R1 AC2).
//   (3) the `.` barrel (index.ts) never imports `./gateway` or `./stream` — the tree-shake precondition
//       AC3's `measure-size.mjs` probe measures in bytes; this is the cheap static half.
// Both grep import specifiers as text — a deliberately-bad specifier is inert, never executed, so a red
// result can't crash the run.
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

const isAllowedDataSpecifier = (spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/')

const isDataSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/data' || spec.startsWith('@agent-ui/data/')

describe('import layering — data/src imports only down the DAG', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('every data/src file imports only {components,shared} or a local path', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isAllowedDataSpecifier(spec)) violations.push(`${path} -> "${spec}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a self-import of @agent-ui/data', () => {
    const src = `import { resource } from '@agent-ui/data'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedDataSpecifier(s))
    expect(violations).toEqual(['@agent-ui/data'])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/app import (up the DAG)', () => {
    const src = `import { agentAppShell } from '@agent-ui/app'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedDataSpecifier(s))
    expect(violations).toEqual(['@agent-ui/app'])
  })

  // ADR-0200 clause 1 — the same "every existing inward layering trip-wire extends its scan by one
  // package name" law this file already applies to app: the devtools harness sits at the DAG top
  // (`a2ui ← devtools`, `a2a ← devtools`); data reaching it would be an upward import. Assembled at
  // runtime — devtools/src/layering.test.ts's own inward-scan reads data/src raw INCLUDING test files.
  it('synthetic-violation: the matcher flags an @agent-ui/devtools import (the harness sits at the DAG top, ADR-0200)', () => {
    const devtoolsSpecifier = ['@agent-ui', 'devtools'].join('/')
    const src = `import { recordTurn } from '${devtoolsSpecifier}'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedDataSpecifier(s))
    expect(violations).toEqual([devtoolsSpecifier])
  })
})

describe('the `.` barrel never imports ./gateway or ./stream (SPEC-R1 AC3 static half)', () => {
  it('index.ts carries no gateway/stream specifier', () => {
    const src = raw['./index.ts']
    expect(src).toBeTruthy()
    const specs = specifiersOf(src)
    const violations = specs.filter((s) => s.includes('/gateway') || s.includes('/stream'))
    expect(violations).toEqual([])
  })
})

describe('components/src, a2ui/src, shared/src, router/src and code/src never import @agent-ui/data (the catalog fence is structural)', () => {
  const ROOT = process.cwd()
  const SCAN_ROOTS = [
    `${ROOT}/packages/agent-ui/components/src`,
    `${ROOT}/packages/agent-ui/a2ui/src`,
    `${ROOT}/packages/agent-ui/shared/src`,
    `${ROOT}/packages/agent-ui/router/src`,
    `${ROOT}/packages/agent-ui/code/src`,
  ]

  type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }
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

  it('anti-vacuous: the walk finds files under all five scanned inward packages', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(SCAN_ROOTS.every((root) => files.some((f) => f.startsWith(`${root}/`)))).toBe(true)
  })

  it('no file under components/src, a2ui/src, shared/src, router/src or code/src imports @agent-ui/data', () => {
    const violations: string[] = []
    for (const path of files) {
      const src = readFileSync(path, 'utf8') as string
      for (const spec of specifiersOf(src)) {
        if (isDataSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/data import from an inward file', () => {
    const src = `import { resource } from '@agent-ui/data'\n`
    const violations = specifiersOf(src).filter(isDataSpecifier)
    expect(violations).toEqual(['@agent-ui/data'])
  })
})
