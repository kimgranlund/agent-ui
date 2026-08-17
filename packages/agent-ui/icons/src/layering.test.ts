import { describe, it, expect } from 'vitest'

// Trip-wire: the two cross-package invariants the icon-adapter architecture rests on (LLD §6, ADR-0065/
// 0066, s-icons-tests accept). Every non-test `.ts` file under `packages/agent-ui/icons/src/**` is read as
// raw text (no execution) and its import specifiers are grepped — the same no-execution idiom as
// `@agent-ui/components/src/layering.test.ts`.
//
//   (1) Zero-runtime-Phosphor (ADR-0066): NO module OUTSIDE `src/phosphor/**` imports `@phosphor-icons/*`
//       or otherwise references "phosphor" in an import specifier — the pack files themselves legitimately
//       import the vendored data, but the core (types/registry/resolve/barrel) must not. Separately, the
//       ROOT BARREL (`index.ts`) must not reach phosphor at all — it is reachable ONLY via the
//       `@agent-ui/icons/phosphor` subpath (ADR-0055/0062 subpath-hygiene rule), so a plain
//       `@agent-ui/icons` import drags zero Phosphor bytes.
//   (2) icons ↛ components (ADR-0065's rejected-alternatives case): NO module under `icons/src/**` —
//       including the phosphor pack — imports `@agent-ui/components`. This is what keeps the
//       `components → icons` edge one-directional; a signal-backed registry or a `ui-icon` written
//       INSIDE this package would trip it.
const raw = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const files = Object.entries(raw)
  .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
  .filter(([k]) => !k.endsWith('.test.ts'))

const specifiersOf = (src: string): string[] => {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

// Shared predicates so the synthetic-violation tests below exercise the exact matcher the real
// gates run, not a re-implementation that could drift from it.
const isPhosphorSpecifier = (path: string, spec: string): boolean =>
  !path.startsWith('phosphor/') && spec.toLowerCase().includes('phosphor')

const isComponentsSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/')

describe('zero-runtime-Phosphor (ADR-0066) — the core does not pull the raw package', () => {
  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([p]) => p === 'index.ts')).toBe(true)
    expect(files.some(([p]) => p.startsWith('phosphor/'))).toBe(true)
  })

  it('no module OUTSIDE src/phosphor/** references "phosphor" in an import specifier', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (isPhosphorSpecifier(path, spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('the root barrel (index.ts) does not reach phosphor at all — subpath-only reachability', () => {
    const entry = files.find(([path]) => path === 'index.ts')
    expect(entry, 'index.ts not found by the glob').toBeDefined()
    const [, indexSrc] = entry as readonly [string, string]
    const specs = specifiersOf(indexSrc)
    expect(specs.some((s) => isPhosphorSpecifier('index.ts', s))).toBe(false)
  })

  it('synthetic-violation: the phosphor-specifier matcher actually flags a violating import', () => {
    const path = 'resolve.ts' // outside src/phosphor/** — a real gated location
    const src = `import { something } from '@phosphor-icons/core'\n`
    const violations = specifiersOf(src).filter((spec) => isPhosphorSpecifier(path, spec))
    expect(violations).toEqual(['@phosphor-icons/core'])
  })
})

describe('icons ↛ components (ADR-0065 rejected-alternatives invariant)', () => {
  it('no module under icons/src/** imports @agent-ui/components', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (isComponentsSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the components-import matcher actually flags a violating import', () => {
    const src = `import { UIButton } from '@agent-ui/components'\nimport type { X } from '@agent-ui/components/dom'\n`
    const violations = specifiersOf(src).filter(isComponentsSpecifier)
    expect(violations).toEqual(['@agent-ui/components', '@agent-ui/components/dom'])
  })
})

// ADR-0200 clause 1 — "every existing inward layering trip-wire extends its scan by one package name"
// (the ADR-0192 extension law applied to the devtools mint): icons is a zero-import leaf, and the
// devtools harness sits at the DAG top — icons reaching it would be the maximal upward import. This is
// icons' first PACKAGE-named inward gate beyond components (the two describes above gate phosphor and
// components only), so it carries its own real scan, not just a named negative control. The specifier
// is assembled at runtime for consistency with the sibling gates' inert-raw-text idiom.
const DEVTOOLS_SPECIFIER = ['@agent-ui', 'devtools'].join('/')
const isDevtoolsSpecifier = (spec: string): boolean =>
  spec === DEVTOOLS_SPECIFIER || spec.startsWith(`${DEVTOOLS_SPECIFIER}/`)

describe('icons ↛ devtools (ADR-0200 — nothing below the harness imports it)', () => {
  it('no module under icons/src/** imports @agent-ui/devtools', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (isDevtoolsSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the devtools-import matcher actually flags a violating import', () => {
    const src = `import { recordTurn } from '${DEVTOOLS_SPECIFIER}'\nimport type { X } from '${DEVTOOLS_SPECIFIER}/server'\n`
    const violations = specifiersOf(src).filter(isDevtoolsSpecifier)
    expect(violations).toEqual([DEVTOOLS_SPECIFIER, `${DEVTOOLS_SPECIFIER}/server`])
  })
})
