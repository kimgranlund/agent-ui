import { describe, it, expect } from 'vitest'

// Trip-wire (D2 ruling, GH #761): @agent-ui/a2ui sits at `shared ← components ← a2ui ← app` with
// `router` AND `code` as CATALOG-INVISIBLE siblings (CLAUDE.md §Conventions, ADR-0115/ADR-0119) —
// every non-test module under a2ui/src/** imports ONLY {@agent-ui/components, @agent-ui/shared}
// (root or subpath) or a local `./`/`../` path. The structural fences this makes un-regressable:
// a2ui never imports `router` or `code` (catalog invisibility), never `app` (upward), never `a2a`
// (the A2UI-over-A2A bridge composes in TESTS/tools, not shipped src), never its own package name —
// with ONE named exception (GH #1584): `@agent-ui/a2ui/agent/*`, the declared `package.json` exports
// subpath gates.test.ts's own COMPOSITION CONTAINMENT check already legalizes as "the only legal door"
// for a non-agent/ module to reach `src/agent/` (e.g. `corpus-genui/record.ts` reusing
// `genui-line.ts`'s wire gate rather than a second copy). This is that same door, not a new one — it
// widens nothing gates.test.ts hasn't already sanctioned.
// Same no-execution raw-text idiom as the sibling gates; this file closed one of the three gaps the
// 2026-08-11 audit named in CLAUDE.md's enforcement claim (decision D2, ruled 2026-08-12).
//
// Blind spot (documented, same as router's gate): static import/export specifiers only — a dynamic
// `import('@agent-ui/router')` would not be caught; no dynamic cross-package imports exist under
// a2ui/src at this writing (the prompt .md loads ride ?raw glob, not imports).
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

// src/agent/** is the NODE-FIRST producer toolkit (ADR-0137 — "portable core in src/agent/"; the
// root `.` barrel carries zero producer bytes, CLAUDE.md §Layout): node builtins are lawful THERE
// and nowhere else in this package (the renderer/validator/catalog stay browser-clean).
const isAllowedA2uiSpecifier = (path: string, spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/') ||
  spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/') ||
  spec.startsWith('@agent-ui/a2ui/agent/') ||
  (path.startsWith('agent/') && spec.startsWith('node:'))

// The synthetic-violation specifiers are ASSEMBLED at runtime — this file lives INSIDE a package the
// sibling gates (router/code/app) inward-scan as raw text WITH test files, so a literal
// '@agent-ui/router' here would trip THEIR gates (found live on first run). join('/') keeps the raw
// text inert while the assembled string exercises the exact matcher.
const spec = (pkg: string): string => ['@agent-ui', pkg].join('/')

describe('import layering — a2ui/src imports only {components, shared} or local paths', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts') && !k.endsWith('.browser.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([p]) => p === 'index.ts')).toBe(true)
  })

  it('every a2ui/src file imports only {components, shared} or a local path', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (!isAllowedA2uiSpecifier(path, spec)) violations.push(`${path} -> "${spec}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags @agent-ui/router (catalog invisibility, ADR-0115)', () => {
    const src = `import { createRouter } from '${spec('router')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual([spec('router')])
  })

  it('synthetic-violation: the matcher flags @agent-ui/code (catalog invisibility, ADR-0119)', () => {
    const src = `import { registerHighlighter } from '${spec('code')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual([spec('code')])
  })

  // ADR-0192 clause 1 — "every existing inward layering trip-wire extends its scan by one package
  // name": the allowlist above already excludes @agent-ui/data by construction (unlisted); this named
  // negative control makes the fence explicit (a2ui never reaches a data-access primitive by import —
  // agent-driven data access is a trust surface wanting its own record, ADR-0192 Context).
  it('synthetic-violation: the matcher flags @agent-ui/data (catalog invisibility, ADR-0192)', () => {
    const src = `import { resource } from '${spec('data')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual([spec('data')])
  })

  // ADR-0200 clause 1 — the same "every existing inward layering trip-wire extends its scan by one
  // package name" law ADR-0192 set: devtools sits ABOVE a2ui (`a2ui ← devtools`), so a2ui reaching it
  // would be an upward import that drags a dev harness into the catalog package.
  it('synthetic-violation: the matcher flags @agent-ui/devtools (the harness sits ABOVE the catalog, ADR-0200)', () => {
    const src = `import { recordTurn } from '${spec('devtools')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual([spec('devtools')])
  })

  it('synthetic-violation: the matcher flags @agent-ui/app (up the DAG) and @agent-ui/a2a (the bridge stays out of shipped src)', () => {
    const src = `import { x } from '${spec('app')}'\nimport { y } from '${spec('a2a')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual([spec('app'), spec('a2a')])
  })

  it('synthetic-violation: node builtins are lawful ONLY under agent/ (ADR-0137) — a renderer file reaching node:fs trips', () => {
    const src = `import { readFileSync } from 'node:fs'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('renderer/renderer.ts', s))).toEqual(['node:fs'])
    expect(specifiersOf(src).filter((s) => !isAllowedA2uiSpecifier('agent/system-prompt.ts', s))).toEqual([])
  })

  it('the self-package door is narrow: `@agent-ui/a2ui/agent/*` is legal, any other self-package subpath is still flagged (GH #1584)', () => {
    const legal = `import { readGenuiLine } from '${spec('a2ui')}/agent/genui-line'\n`
    expect(specifiersOf(legal).filter((s) => !isAllowedA2uiSpecifier('corpus-genui/record.ts', s))).toEqual([])
    const illegal = `import { x } from '${spec('a2ui')}'\nimport { y } from '${spec('a2ui')}/renderer'\n`
    expect(specifiersOf(illegal).filter((s) => !isAllowedA2uiSpecifier('corpus-genui/record.ts', s))).toEqual([spec('a2ui'), `${spec('a2ui')}/renderer`])
  })
})
