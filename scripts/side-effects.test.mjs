// side-effects.test.mjs: the `sideEffects` package.json field is honest (ADR-0233). A bundler trusts the
// field: a module that matches no declared pattern is dropped when nothing uses its exports, so an
// undeclared top-level effect (a `customElements.define`, a call, a bare import) silently vanishes from a
// consumer's build. Three legs:
//   (a) every workspace package declares `sideEffects`, and honestly: each non-test `src/**/*.ts` with a
//       column-0 top-level call, a `customElements.define(` call or a bare `import '…'`, and each
//       `src/**/*.css`, matches a declared pattern (`false` means none may exist). Comments are stripped
//       first in one string-aware pass, so a comment that quotes `customElements.define(` or a glob string
//       holding `/*` never decides the result. A negative-control fixture package bites the scan;
//   (b) the components package declares exactly its ruled array;
//   (c) a Rolldown bundle of one per-control import keeps the control's `.define(`, and the same bundle with
//       `treeshake.moduleSideEffects: false` drops it, so the probe itself bites.

import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES_DIR = join(REPO_ROOT, 'packages/agent-ui')

// One string-aware pass: the first alternative matches a '…', "…" or template literal and keeps it; the
// others drop a block comment and a line comment.
const COMMENTS = /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const stripComments = (src) => src.replace(COMMENTS, (_m, str) => str ?? '')

const TOP_LEVEL_CALL = /^(void |await )?[A-Za-z_$][\w$.]*\(/m
const DEFINE_CALL = /customElements\.define\(/
const BARE_IMPORT = /(?:^|[;\s])import\s*['"]/m

/** True when a `.ts` source carries a top-level effect a bundler must keep. */
const hasTopLevelEffect = (src) => {
  const code = stripComments(src)
  return TOP_LEVEL_CALL.test(code) || DEFINE_CALL.test(code) || BARE_IMPORT.test(code)
}

/** A package.json `sideEffects` glob as a RegExp over a `./`-prefixed package-relative path: `**` spans
 *  directories (`**\/` may match none), `*` stays within one segment, and a pattern with no `/` matches the
 *  basename anywhere (the webpack rule). */
function globToRegExp(pattern) {
  let p = pattern.startsWith('./') ? pattern.slice(2) : pattern
  if (!p.includes('/')) p = `**/${p}`
  let re = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^\\./${re}$`)
}

/** Every file under `dir`, recursively, as absolute paths. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs, out)
    else out.push(abs)
  }
  return out
}

/**
 * The `./`-prefixed package-relative paths of every effectful source in `pkgDir` that its `sideEffects`
 * field does not declare: a `.ts` with a top-level effect, or any `.css`. Test files are skipped.
 */
function undeclaredEffects(pkgDir) {
  const declared = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).sideEffects
  const patterns = Array.isArray(declared) ? declared.map(globToRegExp) : []
  const out = []
  for (const abs of walk(join(pkgDir, 'src'))) {
    const rel = `./${relative(pkgDir, abs).split('\\').join('/')}`
    const effectful = rel.endsWith('.css') || (rel.endsWith('.ts') && !rel.endsWith('.test.ts') && hasTopLevelEffect(readFileSync(abs, 'utf8')))
    if (!effectful) continue
    if (declared === true || patterns.some((re) => re.test(rel))) continue
    out.push(rel)
  }
  return out.sort()
}

const workspacePackages = readdirSync(PACKAGES_DIR)
  .map((name) => join(PACKAGES_DIR, name))
  .filter((dir) => existsSync(join(dir, 'package.json')))

describe('(a) sideEffects declared everywhere, and honest', () => {
  it('finds the ten workspace packages (anti-vacuous)', () => {
    expect(workspacePackages.length).toBeGreaterThanOrEqual(10)
    expect(workspacePackages.map((d) => relative(PACKAGES_DIR, d))).toContain('components')
  })

  it.each(workspacePackages.map((d) => [relative(PACKAGES_DIR, d), d]))('%s: declares the sideEffects field', (_name, dir) => {
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))).toHaveProperty('sideEffects')
  })

  it.each(workspacePackages.map((d) => [relative(PACKAGES_DIR, d), d]))('%s: every effectful source matches a declared pattern', (_name, dir) => {
    expect(undeclaredEffects(dir)).toEqual([])
  })

  it('the components scan finds effectful sources to judge (the controls), so the green is not vacuous', () => {
    const dir = join(PACKAGES_DIR, 'components')
    const effectfulTs = walk(join(dir, 'src')).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && hasTopLevelEffect(readFileSync(f, 'utf8')),
    )
    expect(effectfulTs.length).toBeGreaterThan(60)
  })

  describe('negative control: a fixture package in a temp directory', () => {
    let root
    const write = (rel, text) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), text)
    }

    it('flags a real top-level define outside every pattern and passes one that sits only in comments', () => {
      root = mkdtempSync(join(tmpdir(), 'side-effects-fixture-'))
      try {
        write('package.json', JSON.stringify({ name: 'fixture', sideEffects: ['./src/defined/**'] }))
        write('src/defined/ok.ts', "customElements.define('x-ok', class extends HTMLElement {})\n")
        write('src/rogue.ts', "export class XRogue extends HTMLElement {}\ncustomElements.define('x-rogue', XRogue)\n")
        write(
          'src/quiet.ts',
          [
            "export const GLOB = './src/**/*.css'",
            "// customElements.define('x-quiet', XQuiet)",
            "/* import './quiet.css'",
            " * customElements.define('x-quiet', XQuiet) */",
            'export const n = 1',
            '',
          ].join('\n'),
        )
        expect(undeclaredEffects(root)).toEqual(['./src/rogue.ts'])
        // `false` declares no effectful module at all, so the in-pattern define is flagged too.
        write('package.json', JSON.stringify({ name: 'fixture', sideEffects: false }))
        expect(undeclaredEffects(root)).toEqual(['./src/defined/ok.ts', './src/rogue.ts'])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  })

  it('the glob semantics: ** spans segments (or none), * stays in one, a bare pattern matches any basename', () => {
    expect(globToRegExp('./src/**/*.css').test('./src/all.gen.css')).toBe(true)
    expect(globToRegExp('./src/**/*.css').test('./src/controls/button/button.css')).toBe(true)
    expect(globToRegExp('./src/controls/**').test('./src/controls/button/button.ts')).toBe(true)
    expect(globToRegExp('./src/controls/**').test('./src/dom/element.ts')).toBe(false)
    expect(globToRegExp('./src/all.gen.ts').test('./src/all.gen.ts')).toBe(true)
    expect(globToRegExp('./src/all.gen.ts').test('./src/allxgen.ts')).toBe(false)
    expect(globToRegExp('./src/*.ts').test('./src/dom/element.ts')).toBe(false)
    expect(globToRegExp('*.css').test('./src/a/b.css')).toBe(true)
  })
})

describe('(b) the components declaration', () => {
  it('declares the ruled array', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGES_DIR, 'components/package.json'), 'utf8'))
    expect(pkg.sideEffects).toEqual(['./src/controls/**', './src/all.gen.ts', './src/**/*.css'])
  })
})

describe('(c) a per-control import keeps its define; the probe bites', () => {
  /** Bundle `import '<spec>'` from a virtual entry resolved at the repo root; return the emitted code. */
  const bundleOf = async (spec, treeshake) => {
    const ENTRY = 'virtual:side-effects-entry'
    const plugin = {
      name: 'side-effects-virtual-entry',
      resolveId(id) {
        if (id === ENTRY) return join(REPO_ROOT, '__side-effects-entry__.js')
      },
      load(id) {
        if (id === join(REPO_ROOT, '__side-effects-entry__.js')) return `import ${JSON.stringify(spec)}\n`
      },
    }
    const bundle = await rolldown({ input: ENTRY, cwd: REPO_ROOT, plugins: [plugin], ...(treeshake ? { treeshake } : {}) })
    const { output } = await bundle.generate({ format: 'esm' })
    await bundle.close()
    return output.filter((c) => c.type === 'chunk').map((c) => c.code).join('')
  }

  it("import '@agent-ui/components/controls/button' keeps ui-button's define", async () => {
    const code = await bundleOf('@agent-ui/components/controls/button')
    expect(code).toContain('.define(')
    expect(code).toContain('ui-button')
  }, 60_000)

  it('the same bundle with treeshake.moduleSideEffects: false drops it', async () => {
    const code = await bundleOf('@agent-ui/components/controls/button', { moduleSideEffects: false })
    expect(code).not.toContain('.define(')
  }, 60_000)
})
