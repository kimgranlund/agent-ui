import { describe, it, expect } from 'vitest'
// Raw-text fs read — the same reverse-coupling fs-read pattern as
// components/src/descriptor/site-coverage.test.ts / site/lib/adr.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the apex-of-the-DAG invariant @agent-ui/app rests on (SPEC-R1, LLD-C2). Two checks, one
// file:
//   (1) every import under app/src/** resolves ONLY to {@agent-ui/components, @agent-ui/a2ui,
//       @agent-ui/shared, @agent-ui/code, @agent-ui/data} or a local `./`/`../` path — app may depend DOWN
//       the DAG (it sits at the top, nothing is above it) and never on itself via its own package name. The
//       @agent-ui/code edge is ADR-0139's opened `app ← code` edge (ui-agent-admin's entry editors use
//       @agent-ui/code/editor); the @agent-ui/data edge is ADR-0227 clause 4's activation of the edge
//       ADR-0192 clause 1 reserved (agent-roster-source.ts, the package's first real consumer);
//       app still never imports @agent-ui/router (the M4 named NC below stays intact).
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
// `pdfjs-dist` (bare, and its `?url`-suffixed worker-asset subpath) is the ADR-0202 runtime dep — app's
// OWN first genuine third-party runtime dependency, the SECOND ruled zero-dep exception (ADR-0139's own
// `@codemirror/`/`@lezer/` allowance in code/src/layering.test.ts is the precedent this mirrors). It is
// ADMITTED to the app-package DAG here; WHERE it may appear is the separate, tighter job of
// pdf-confinement.test.ts (only lib/pdf-worker.ts, reached via a dynamic import) — layering answers "may
// app/src depend on this at all", confinement answers "which file".
const isAllowedAppSpecifier = (spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/a2ui' || spec.startsWith('@agent-ui/a2ui/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/') ||
  spec === '@agent-ui/code' || spec.startsWith('@agent-ui/code/') || // ADR-0139 — the app ← code editor edge
  spec === '@agent-ui/data' || spec.startsWith('@agent-ui/data/') || // ADR-0227 cl.4 — the app ← data edge ADR-0192 cl.1 reserved, activated by the persona-roster adoption (GH #1542)
  spec === 'pdfjs-dist' || spec.startsWith('pdfjs-dist/') // ADR-0202 — app's own runtime-dep exception

const isAppSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/app' || spec.startsWith('@agent-ui/app/')

describe('import layering — app/src imports only down the DAG', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0) // holds even pre-C3: the barrel alone still counts
  })

  it('every app/src file imports only {components,a2ui,shared,code,data} or a local path', () => {
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

  // M4 (app-surfaces-m4.lld.md LLD-C16, SPEC-R13 AC2) — a NAMED negative control, not a new gate: the
  // allowlist above already excludes @agent-ui/router by construction (it admits only
  // components/a2ui/shared/local), so a `@agent-ui/router` import already fails the bijection test right
  // above this one. This test exists ONLY to make that edge EXPLICIT for a future reader (the master-detail/
  // settings surfaces deliberately never import it, ADR-0115) — a router-specific synthetic-violation, the
  // SAME shape as the self-import check above, naming the actual forbidden package instead of a generic one.
  it('synthetic-violation: the matcher flags a @agent-ui/router import from app/src (the M4 named NC — app never imports router)', () => {
    const src = `import { createRouter } from '@agent-ui/router'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedAppSpecifier(s))
    expect(violations).toEqual(['@agent-ui/router'])
  })

  // ADR-0227 clause 4 (GH #1542) — the edge ADR-0192 clause 1 reserved as "`app` MAY, later" is now
  // ACTIVE: the persona roster (agent-roster-source.ts) is @agent-ui/data's first real consumer, so
  // the old ADR-0192 named NC (which asserted this exact specifier was flagged) flips to a POSITIVE
  // control — the allowlist admits it by name, and the package.json dependency row matches.
  it('positive control: @agent-ui/data is an ADMITTED app/src import (ADR-0227 cl.4 — the activated ADR-0192 cl.1 edge)', () => {
    const src = `import { resource } from '@agent-ui/data'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedAppSpecifier(s))
    expect(violations).toEqual([])
  })

  it('and the real consumer exists: agent-roster-source.ts imports @agent-ui/data (the edge is used, not just opened)', () => {
    const src = raw['./controls/agent-admin/agent-roster-source.ts']
    expect(src, 'the ADR-0227 wave-1 source module is in the scanned tree').toBeTruthy()
    expect(specifiersOf(src!).some((s) => s === '@agent-ui/data' || s.startsWith('@agent-ui/data/'))).toBe(true)
  })

  // ADR-0200 clause 1 — app and devtools are PEER top-tier consumers (`shared ← components ← a2ui ←
  // {app, devtools}`); neither imports the other, ever: a debug harness in app's graph would tax every
  // production app consumer with dev tooling (the ADR's rejected fold-into-app alternative). Assembled
  // at runtime (never a literal devtools string) — devtools/src/layering.test.ts's own inward-scan reads
  // app/src as raw text INCLUDING test files (the a2ui `spec()` helper's documented trap).
  it('synthetic-violation: the matcher flags an @agent-ui/devtools import from app/src (peer tiers never import each other, ADR-0200)', () => {
    const devtoolsSpecifier = ['@agent-ui', 'devtools'].join('/')
    const src = `import { recordTurn } from '${devtoolsSpecifier}'\n`
    const violations = specifiersOf(src).filter((s) => !isAllowedAppSpecifier(s))
    expect(violations).toEqual([devtoolsSpecifier])
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
