import { describe, it, expect } from 'vitest'
// Raw-text fs read — the same reverse-coupling fs-read pattern as data/src/layering.test.ts /
// app/src/layering.test.ts (the ADR-0192 mint precedent, applied to the ADR-0200 mint).
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// Trip-wire: the SPEC-R1 package-boundary invariant @agent-ui/devtools rests on (ADR-0200 cl.1/cl.2).
// Five checks:
//   (1) every import under devtools/src/** resolves ONLY to {@agent-ui/a2ui, @agent-ui/a2a} or a local
//       `./`/`../` path — with `node:*`/`vite` lawful under `src/server/**` ONLY (the a2ui `src/agent/`
//       node-fence precedent; the `./server` seam is a Node/Vite dev-only plugin, SPEC-R6).
//   (2) no source under a2ui/src, a2a/src, components/src, shared/src, router/src, code/src, data/src,
//       app/src imports @agent-ui/devtools — nothing below the harness reaches it (SPEC-R1 AC1; the
//       nothing-imports-upward law made mechanical).
//   (3) the `.` barrel's MODULE GRAPH (a transitive walk over local specifiers, not just index.ts's own
//       lines) reaches no `server/`/`playwright/` module (SPEC-R1 AC2's reachability half).
//   (4) grep gates (SPEC-R1 AC2): no `produce(` call text in shipped source, no import specifier
//       containing `tools/agent` (the ADR-0137 site-shell boundary — the proxy coupling is HTTP-only,
//       SPEC-R4 AC3), no a2ui provider-adapter specifier (`/providers/`).
//   (5) no VALUE import from any playwright specifier (SPEC-R11 AC1 — types-only, never a runtime dep).
// All grep import specifiers as text — a deliberately-bad specifier is inert, never executed.
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

const isAllowedDevtoolsSpecifier = (path: string, spec: string): boolean =>
  spec.startsWith('.') ||
  spec === '@agent-ui/a2ui' || spec.startsWith('@agent-ui/a2ui/') ||
  spec === '@agent-ui/a2a' || spec.startsWith('@agent-ui/a2a/') ||
  (path.startsWith('server/') && (spec.startsWith('node:') || spec === 'vite'))

const isDevtoolsSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/devtools' || spec.startsWith('@agent-ui/devtools/')

// Assembled, not literal (the a2ui/shared gate idiom) — synthetic-violation specifiers stay inert to
// any raw-text scan of this package.
const spec = (pkg: string): string => ['@agent-ui', pkg].join('/')

describe('import layering — devtools/src imports only {a2ui, a2a} or local paths (node/vite fenced to server/)', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts') && !k.endsWith('.browser.test.ts'))

  it('anti-vacuous: the glob actually finds the package source files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([p]) => p === 'index.ts')).toBe(true)
  })

  it('every devtools/src file imports only {a2ui, a2a} or a local path (node:/vite under server/ only)', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const s of specifiersOf(src)) {
        if (!isAllowedDevtoolsSpecifier(path, s)) violations.push(`${path} -> "${s}": disallowed import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a self-import of @agent-ui/devtools', () => {
    const src = `import { recordTurn } from '${spec('devtools')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedDevtoolsSpecifier('timeline/events.ts', s))).toEqual([spec('devtools')])
  })

  it('synthetic-violation: the matcher flags @agent-ui/components AND @agent-ui/shared (NOT declared deps — they arrive transitively through a2ui, ADR-0200 cl.1)', () => {
    const src = `import { UIElement } from '${spec('components')}'\nimport { tokens } from '${spec('shared')}'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedDevtoolsSpecifier('transports/replay.ts', s))).toEqual([spec('components'), spec('shared')])
  })

  it('synthetic-violation: node builtins/vite are lawful ONLY under server/ — a core file reaching node:fs or vite trips', () => {
    const src = `import { readFileSync } from 'node:fs'\nimport { loadEnv } from 'vite'\n`
    expect(specifiersOf(src).filter((s) => !isAllowedDevtoolsSpecifier('transports/proxy.ts', s))).toEqual(['node:fs', 'vite'])
    expect(specifiersOf(src).filter((s) => !isAllowedDevtoolsSpecifier('server/harness-plugin.ts', s))).toEqual([])
  })
})

describe('the `.` barrel reaches no server/ or playwright/ module (SPEC-R1 AC2 — transitive walk)', () => {
  // Resolve a local specifier against the importing file's directory ('' = package src root).
  const resolveLocal = (fromDir: string, s: string): string => {
    const parts = (fromDir === '' ? [] : fromDir.split('/')).concat(s.split('/'))
    const out: string[] = []
    for (const p of parts) {
      if (p === '.' || p === '') continue
      else if (p === '..') out.pop()
      else out.push(p)
    }
    return out.join('/')
  }

  const moduleGraphOf = (entry: string): Set<string> => {
    const seen = new Set<string>()
    const queue = [entry]
    while (queue.length > 0) {
      const path = queue.pop() as string
      if (seen.has(path)) continue
      seen.add(path)
      const src = raw[`./${path}`]
      if (src === undefined) continue
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
      for (const s of specifiersOf(src)) {
        if (s.startsWith('.')) queue.push(resolveLocal(dir, s))
      }
    }
    return seen
  }

  it('walking index.ts transitively never lands under server/ or playwright/', () => {
    const reached = [...moduleGraphOf('index.ts')]
    const violations = reached.filter((p) => p.startsWith('server/') || p.startsWith('playwright/'))
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the walk DOES flag a planted barrel import of the server subpath', () => {
    // Exercise the same resolver+filter over a fabricated graph edge, proving the check can go red.
    const planted = resolveLocal('', './server/index.ts')
    expect([planted].filter((p) => p.startsWith('server/') || p.startsWith('playwright/'))).toEqual([planted])
  })
})

describe('grep gates (SPEC-R1 AC2 / SPEC-R4 AC3 / SPEC-R11 AC1)', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts') && !k.endsWith('.browser.test.ts'))

  // Comments are stripped first: documentation SAYING "no produce() here" must not trip the gate that
  // enforces it — only real call/import text in executable source does.
  const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('no `produce(` call text in shipped source (comments stripped) — the produce loop never enters this package', () => {
    const violations = files.filter(([, src]) => /\bproduce\(/.test(stripComments(src))).map(([p]) => p)
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the produce matcher flags real call text and ignores comment text', () => {
    expect(/\bproduce\(/.test(stripComments(`const out = produce(input, deps)`))).toBe(true)
    expect(/\bproduce\(/.test(stripComments(`// never call produce( here`))).toBe(false)
  })

  it('no import specifier containing tools/agent (the ADR-0137 site-shell boundary) or an a2ui provider adapter', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const s of specifiersOf(src)) {
        if (s.includes(['tools', 'agent'].join('/'))) violations.push(`${path} -> "${s}": site-shell import`)
        if (s.includes('/providers/')) violations.push(`${path} -> "${s}": provider-adapter import`)
      }
    }
    expect(violations).toEqual([])
  })

  it('no VALUE import from any playwright specifier (types-only, SPEC-R11 AC1)', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      // A type-only import is `import type … from`; anything else naming playwright is a value import.
      const valueImportRe = /\bimport\s+(?!type\b)[^\n;]*?\bfrom\s*['"]([^'"]*playwright[^'"]*)['"]/g
      let m: RegExpExecArray | null
      while ((m = valueImportRe.exec(src))) violations.push(`${path} -> "${m[1]}"`)
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the playwright matcher flags a value import and passes a type-only one', () => {
    const valueImportRe = /\bimport\s+(?!type\b)[^\n;]*?\bfrom\s*['"]([^'"]*playwright[^'"]*)['"]/
    expect(valueImportRe.test(`import { chromium } from 'playwright'\n`)).toBe(true)
    expect(valueImportRe.test(`import type { Page } from 'playwright'\n`)).toBe(false)
  })
})

describe('a2ui/src, a2a/src, components/src, shared/src, router/src, code/src, data/src and app/src never import @agent-ui/devtools (nothing below the harness reaches it — ADR-0200 cl.1)', () => {
  const ROOT = process.cwd()
  const SCAN_ROOTS = [
    `${ROOT}/packages/agent-ui/a2ui/src`,
    `${ROOT}/packages/agent-ui/a2a/src`,
    `${ROOT}/packages/agent-ui/components/src`,
    `${ROOT}/packages/agent-ui/shared/src`,
    `${ROOT}/packages/agent-ui/router/src`,
    `${ROOT}/packages/agent-ui/code/src`,
    `${ROOT}/packages/agent-ui/data/src`,
    `${ROOT}/packages/agent-ui/app/src`,
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

  it('anti-vacuous: the walk finds files under all eight scanned inward packages', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(SCAN_ROOTS.every((root) => files.some((f) => f.startsWith(`${root}/`)))).toBe(true)
  })

  it('no file under any scanned inward package imports @agent-ui/devtools', () => {
    const violations: string[] = []
    for (const path of files) {
      const src = readFileSync(path, 'utf8') as string
      for (const s of specifiersOf(src)) {
        if (isDevtoolsSpecifier(s)) violations.push(`${path} -> "${s}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags an @agent-ui/devtools import from an inward file (unique-token negative control)', () => {
    const src = `import { recordTurnNegativeControlToken } from '${spec('devtools')}'\n`
    expect(specifiersOf(src).filter(isDevtoolsSpecifier)).toEqual([spec('devtools')])
  })
})
