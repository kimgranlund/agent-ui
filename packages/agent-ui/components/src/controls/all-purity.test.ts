// all-purity.test.ts: the generated `all` entry (`src/all.gen.ts`, `./all`) and its sheet (`./all.css`) are
// DEMO-ONLY (ADR-0233). Package code never reaches them: an app that imports one control must never pay for
// the whole fleet. Two legs:
//   1. a crawl over relative imports (static, bare and dynamic) from the root barrel, every `./controls/*` JS
//      export target and the registry never reaches `all.gen.ts`;
//   2. no non-test `.ts` or `.css` file under any `packages/*/src` imports `@agent-ui/components/all` or
//      `@agent-ui/components/all.css` in statement form (`from '…'`, bare `import '…'`, `import('…')`, CSS
//      `@import '…'`), comments stripped first, so prose that names the subpath never trips it.
// Each leg has a negative control on an in-memory source.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relativeSpecifiers } from '../descriptor/control-graph.ts'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const PKG = `${ROOT}/packages/agent-ui/components`
const ALL_MODULE = 'src/all.gen.ts'
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }

/** Reads a file by its path relative to the components package root; `undefined` when it does not exist. */
type Reader = (pkgRel: string) => string | undefined
const readPkg: Reader = (p) => (existsSync(`${PKG}/${p}`) ? (readFileSync(`${PKG}/${p}`, 'utf8') as string) : undefined)

/** Resolve `spec` against the directory of the package-relative module `from`. */
function resolve(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1)
  for (const seg of spec.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

/** Every `.ts` module reached from `entries` through relative static, bare and dynamic imports. */
function crawl(entries: readonly string[], read: Reader): Set<string> {
  const reached = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const cur = queue.pop() as string
    if (reached.has(cur)) continue
    reached.add(cur)
    const src = read(cur)
    if (src === undefined) continue
    for (const spec of relativeSpecifiers(src)) {
      const target = resolve(cur, spec)
      if (target.endsWith('.ts') && !reached.has(target)) queue.push(target)
    }
  }
  return reached
}

const ENTRY_POINTS = [
  'src/index.ts',
  pkg.exports['./registry'].slice(2),
  ...Object.entries(pkg.exports)
    .filter(([key, target]) => key.startsWith('./controls/') && target.endsWith('.ts'))
    .map(([, target]) => target.slice(2)),
]

describe('all-purity leg 1: no package entry point reaches all.gen.ts', () => {
  it('finds the entry points and a real graph (anti-vacuous)', () => {
    expect(ENTRY_POINTS.length).toBeGreaterThan(60)
    const reached = crawl(ENTRY_POINTS, readPkg)
    expect(reached.has('src/dom/index.ts')).toBe(true)
    expect(reached.has('src/controls/button/button.ts')).toBe(true)
  })

  it('the root barrel, the registry and every ./controls/* JS target never reach all.gen.ts', () => {
    expect(crawl(ENTRY_POINTS, readPkg).has(ALL_MODULE)).toBe(false)
  })

  it('negative control: a planted static or dynamic import of all.gen.ts is reached', () => {
    for (const planted of ["import '../../all.gen.ts'\n", "export const all = () => import('../../all.gen.ts')\n"]) {
      const read: Reader = (p) => (p === 'src/controls/button/button.ts' ? `${readPkg(p)}\n${planted}` : readPkg(p))
      expect(crawl(ENTRY_POINTS, read).has(ALL_MODULE), planted).toBe(true)
    }
  })
})

// One string-aware pass: a quoted or template string is kept, a block or line comment is dropped. Applied to
// `.ts` sources; a `.css` source drops its block comments only.
const TS_COMMENTS = /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const stripTs = (src: string): string => src.replace(TS_COMMENTS, (_m, str: string | undefined) => str ?? '')
const stripCss = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '')

// `from '…'`, bare `import '…'`, `import('…')` and CSS `@import '…'` / `@import url('…')` of the `all` pair.
const ALL_IMPORT = /(?:\bfrom|\bimport)\s*(?:\(\s*|url\(\s*)?(['"])@agent-ui\/components\/all(?:\.css)?(?:\?[^'"]*)?\1/

/** True when `src` (a `.ts` or `.css` file's text) imports the demo-only `all` pair in statement form. */
const importsAll = (src: string, file: string): boolean => ALL_IMPORT.test(file.endsWith('.css') ? stripCss(src) : stripTs(src))

/** Every non-test `.ts` and `.css` file under `dir`, recursively. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir) as string[]) {
    const abs = `${dir}/${name}`
    if (statSync(abs).isDirectory()) {
      if (name !== 'node_modules') sourceFiles(abs, out)
    } else if ((name.endsWith('.ts') || name.endsWith('.css')) && !name.endsWith('.test.ts')) out.push(abs)
  }
  return out
}

const PACKAGE_SRC_DIRS = (readdirSync(`${ROOT}/packages/agent-ui`) as string[])
  .map((p) => `${ROOT}/packages/agent-ui/${p}/src`)
  .filter((d) => existsSync(d))

describe('all-purity leg 2: no package source imports @agent-ui/components/all or /all.css', () => {
  const files = PACKAGE_SRC_DIRS.flatMap((d) => sourceFiles(d))

  it('scans every package src tree (anti-vacuous)', () => {
    expect(PACKAGE_SRC_DIRS.length).toBeGreaterThanOrEqual(10)
    expect(files.length).toBeGreaterThan(500)
  })

  it('no non-test file imports the demo-only pair', () => {
    const offenders = files.filter((f) => importsAll(readFileSync(f, 'utf8') as string, f)).map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('negative control: each statement form in an in-memory source is flagged', () => {
    expect(importsAll("import '@agent-ui/components/all'\n", 'x.ts')).toBe(true)
    expect(importsAll("import { x } from \"@agent-ui/components/all\"\n", 'x.ts')).toBe(true)
    expect(importsAll("const m = await import('@agent-ui/components/all')\n", 'x.ts')).toBe(true)
    expect(importsAll("import '@agent-ui/components/all.css'\n", 'x.ts')).toBe(true)
    expect(importsAll("@import '@agent-ui/components/all.css';\n", 'x.css')).toBe(true)
    expect(importsAll("@import url('@agent-ui/components/all.css');\n", 'x.css')).toBe(true)
  })

  it('a comment or a prose mention is not an import', () => {
    expect(importsAll("// import '@agent-ui/components/all'\nexport const x = 1\n", 'x.ts')).toBe(false)
    expect(importsAll("/* from '@agent-ui/components/all' */\nexport const x = 1\n", 'x.ts')).toBe(false)
    expect(importsAll("/* @import '@agent-ui/components/all.css'; */\n", 'x.css')).toBe(false)
    expect(importsAll('export const doc = "link @agent-ui/components/all.css in a demo"\n', 'x.ts')).toBe(false)
    expect(importsAll("import '@agent-ui/components/allowed'\n", 'x.ts')).toBe(false)
  })
})
