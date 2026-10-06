import { describe, it, expect } from 'vitest'
import * as rootBarrel from '../index.ts'
// Read package.json + the CSS barrels as text (vite strips `.css?raw`; no `@types/node` devDep — same
// approach as the s6/s7 probes).
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
declare const process: { cwd(): string }

// The package's host-facing entries (ADR-0003 as amended by ADR-0233) exist and are wired into the exports:
//   • foundation-styles — the foundation sheet (foundation-styles.css → `./foundation-styles.css`)
//   • shared-styles     — the seams, once (shared-styles.css → `./shared-styles.css`)
//   • controls/{name}   — one JS entry and one sheet per control, plus the lazy registry (`./registry`)
//   • all / all.css     — the generated DEMO-ONLY whole-fleet entry and sheet
// Here we prove that wiring, the load-bearing CSS order, and the T4 folders/registry/exports drift gate.

const PKG = `${process.cwd()}/packages/agent-ui/components`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const read = (rel: string) => readFileSync(`${PKG}/${rel}`, 'utf8') as string
/** The `@import` specifiers of a package stylesheet, comments stripped, in source order. */
const cssImportsOf = (rel: string): string[] =>
  [...read(rel).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+'([^']+)'/g)].map((m) => m[1])

describe('CSS entries — wired into exports + the load-bearing order (s17, ADR-0233)', () => {
  it('`./all.css` (all.gen.css) aggregates each control stylesheet (button.css, text-field.css, text.css), sorted by path', () => {
    expect(pkg.exports['./all.css']).toBe('./src/all.gen.css')
    const imports = cssImportsOf('src/all.gen.css')
    const controlSheets = imports.slice(1)
    expect(controlSheets).toEqual([...controlSheets].sort()) // generated in plain path order, never addition order
    const buttonAt = imports.indexOf('./controls/button/button.css')
    const textFieldAt = imports.indexOf('./controls/text-field/text-field.css')
    const textAt = imports.indexOf('./controls/text/text.css')
    expect(buttonAt).toBeGreaterThan(0)
    expect(textFieldAt).toBeGreaterThan(buttonAt) // `text-field/` sorts before `text/` ('-' < '/')
    expect(textAt).toBeGreaterThan(textFieldAt)
  })

  it('`./shared-styles.css` imports the seams in order: container, container-box, chart-axis (ADR-0233)', () => {
    expect(pkg.exports['./shared-styles.css']).toBe('./src/shared-styles.css')
    const imports = [...read('src/shared-styles.css').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@import\s+'([^']+)'/g)].map((m) => m[1])
    // the surface paint seam first, then the box model over it, then the chart vocabulary: a container's `@scope`
    // block resolves the `--ui-container-*` tokens the seam declares (ADR-0015/0016), and card.css seeds
    // `--ui-container-bg` by later source over container.css, so the seams load once, before any control sheet.
    expect(imports).toEqual(['./controls/_surface/container.css', './controls/_surface/container-box.css', './controls/_chart/chart-axis.css'])
  })

  it('`all.gen.css` imports `./shared-styles.css` FIRST, before any control sheet, and no `_` seam directly (ADR-0233)', () => {
    const imports = cssImportsOf('src/all.gen.css')
    expect(imports[0]).toBe('./shared-styles.css')
    expect(imports.filter((i) => i.includes('/_'))).toEqual([])
    // and every G9 container element sheet that consumes the surface seam follows it.
    for (const name of ['row', 'column', 'list', 'grid', 'card', 'tabs', 'modal']) {
      expect(imports.indexOf(`./controls/${name}/${name}.css`), `missing container sheet: ${name}.css`).toBeGreaterThan(0)
    }
  })

  it('`./foundation-styles.css` aggregates @agent-ui/shared tokens FIRST, then dimensions', () => {
    expect(pkg.exports['./foundation-styles.css']).toBe('./src/foundation-styles.css')
    const css = read('src/foundation-styles.css')
    const tokensAt = css.indexOf("@import '@agent-ui/shared/tokens.css'")
    const dimsAt = css.indexOf("@import '@agent-ui/shared/dimensions.css'")
    expect(tokensAt).toBeGreaterThanOrEqual(0)
    expect(dimsAt).toBeGreaterThan(tokensAt) // tokens (colour) load before the dimensional ramp — ADR-0003
  })

  it('every export target resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })
})

// ── T4 (ADR-0080 cl.2, as amended by ADR-0233) — the three-way exports-map ↔ controls/ folders ↔ registry
// drift gate ──
// Per-control public entries (`./controls/{name}`) let a consumer reach ONE control through the package's
// public API (ADR-0080 clause 1). Three independent sources must agree on the SAME set of shipped control
// modules:
//   (a) the package.json exports map's `./controls/{name}` JS entries
//   (b) the actual folders under controls/ (excluding the shared `_base`/`_surface` bases — file-set.test.ts's
//       controlDirs exclusion, reused here)
//   (c) the generated lazy registry's (`registry.gen.ts`, `CONTROLS`) `load: () => import('./{folder}/{file}.ts')`
//       records
// A control in the registry without an exports-map entry (or vice versa), or a folder wired into neither, is
// the drift this gate catches (clause 2) — proven below with three synthetic (string/object-level fixtures,
// no real file mutated) negative controls, one per failure mode.

const registrySrc = read('src/controls/registry.gen.ts')
const CONTROLS_DIR = `${PKG}/src/controls`
const folderNames: string[] = readdirSync(CONTROLS_DIR).filter(
  (e: string) => !e.startsWith('_') && statSync(`${CONTROLS_DIR}/${e}`).isDirectory(),
)

/** Every REAL `load: () => import('./{folder}/{file}.ts')` record in the registry (line comments excluded),
 *  as a Set of folder/file.ts targets. */
const parseRegistryTargets = (src: string): Set<string> => {
  const out = new Set<string>()
  const re = /load: \(\) => import\('\.\/([^']+)'\)/
  for (const line of src.split('\n')) {
    if (line.trim().startsWith('//')) continue
    const m = re.exec(line)
    if (m) out.add(m[1])
  }
  return out
}

/** Every `./controls/{name}` JS exports-map entry, as a Map<name, folder/file.ts target> (prefix stripped).
 *  The generated `./controls/{name}.css` sheet keys (ADR-0233) are skipped: T4 stays three-way over JS keys. */
const CONTROLS_TARGET_PREFIX = './src/controls/'
const parseControlsExportsMap = (exportsMap: Record<string, string>): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [key, target] of Object.entries(exportsMap)) {
    if (!key.startsWith('./controls/') || key.endsWith('.css')) continue
    if (!target.startsWith(CONTROLS_TARGET_PREFIX)) continue // malformed target — the file-existence test flags this, not here
    out.set(key.slice('./controls/'.length), target.slice(CONTROLS_TARGET_PREFIX.length))
  }
  return out
}

type ThreeWayReport = {
  registryOnly: string[] // registry records with no matching exports-map entry
  exportsOnly: string[] // exports-map entries whose target has no matching registry record
  uncoveredFolders: string[] // controls/ folders with zero exports-map entry pointing into them
}

const threeWayCheck = (src: string, exportsMap: Record<string, string>, folders: string[]): ThreeWayReport => {
  const registryTargets = parseRegistryTargets(src)
  const mapTargets = new Set(parseControlsExportsMap(exportsMap).values())
  const coveredFolders = new Set([...mapTargets].map((t) => t.split('/')[0]))
  return {
    registryOnly: [...registryTargets].filter((t) => !mapTargets.has(t)),
    exportsOnly: [...mapTargets].filter((t) => !registryTargets.has(t)),
    uncoveredFolders: folders.filter((f) => !coveredFolders.has(f)),
  }
}

describe('exports map ↔ controls/ folders ↔ registry.gen.ts — the T4 three-way drift gate (ADR-0080, ADR-0233)', () => {
  it('finds a real, non-trivial set on every side (anti-vacuous)', () => {
    expect(folderNames.length).toBeGreaterThan(10)
    expect(parseRegistryTargets(registrySrc).size).toBeGreaterThan(10)
    expect(parseControlsExportsMap(pkg.exports).size).toBeGreaterThan(10)
  })

  it('is a clean bijection today — zero orphans on any side', () => {
    expect(threeWayCheck(registrySrc, pkg.exports, folderNames)).toEqual({
      registryOnly: [],
      exportsOnly: [],
      uncoveredFolders: [],
    })
  })

  it('pins the ADR-0080 radio-group special case: one folder (radio/), two exports-map entries', () => {
    const map = parseControlsExportsMap(pkg.exports)
    expect(map.get('radio')).toBe('radio/radio.ts')
    expect(map.get('radio-group')).toBe('radio/radio-group.ts')
  })

  it('a planted unpaired exports-map entry fails the bijection (negative control — exportsOnly)', () => {
    const planted = { ...pkg.exports, './controls/phantom': './src/controls/phantom/phantom.ts' }
    expect(threeWayCheck(registrySrc, planted, folderNames).exportsOnly).toEqual(['phantom/phantom.ts'])
  })

  it('a planted unpaired registry record fails the bijection (negative control — registryOnly)', () => {
    const planted = `${registrySrc}\n  'ui-phantom': { tag: 'ui-phantom', load: () => import('./phantom/phantom.ts'), uses: [] },\n`
    expect(threeWayCheck(planted, pkg.exports, folderNames).registryOnly).toEqual(['phantom/phantom.ts'])
  })

  it('a folder wired into neither side fails the bijection (negative control — uncoveredFolders)', () => {
    expect(threeWayCheck(registrySrc, pkg.exports, [...folderNames, 'phantom']).uncoveredFolders).toEqual(['phantom'])
  })
})

// ── LLD-C1 (genui-dogfood.lld.md, GH #316/ADR-0162) — the `./dogfood-frame` subpath's barrel-purity
// trip-wire, the ADR-0137 zero-bytes gate pattern applied here: opt-in only, so importing the root `.` barrel
// OR the demo-only whole-fleet `./all` entry (ADR-0233) must carry ZERO dogfood bytes — a real transitive
// import-graph trace (not just a one-line grep of the entry file, so a future re-export buried a few
// modules deep still trips this), plus the ADR-0137 IDENTITY leg's runtime symbol-absence check.

const DOGFOOD_MODULE_REL = 'src/controls/sandbox-frame/dogfood/dogfood-assets.ts'

/** Every `from '<spec>'` / bare `import '<spec>'` specifier in `src` (the gates.test.ts pattern). */
function dogfoodImportSpecifiers(src: string): string[] {
  const specs: string[] = []
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) specs.push(m[1]!)
  return specs
}

/** Transitively crawl the RELATIVE-import graph from `entryRel` (a path relative to `PKG`), returning
 *  every reached module's PKG-relative path. Mirrors tree-shake.test.ts's crawl, re-derived here (Node
 *  `readFileSync`, not `import.meta.glob`) so this file stays a plain Node-context test. */
function crawlDogfood(entryRel: string): Set<string> {
  const reached = new Set<string>()
  const queue: string[] = [entryRel]
  while (queue.length > 0) {
    const cur = queue.pop() as string
    if (reached.has(cur)) continue
    reached.add(cur)
    let src: string
    try {
      src = readFileSync(`${PKG}/${cur}`, 'utf8') as string
    } catch {
      continue // resolved outside the package (a sibling @agent-ui/* package, or missing extension) — unreachable here
    }
    const dir = cur.slice(0, cur.lastIndexOf('/'))
    for (const spec of dogfoodImportSpecifiers(src)) {
      if (!spec.startsWith('.')) continue // only relative specifiers stay inside this package
      const parts = dir.split('/')
      for (const seg of spec.split('/')) {
        if (seg === '.' || seg === '') continue
        else if (seg === '..') parts.pop()
        else parts.push(seg)
      }
      const target = parts.join('/')
      if (!reached.has(target)) queue.push(target)
    }
  }
  return reached
}

describe('./dogfood-frame subpath — opt-in only, zero bytes in the root barrel or `./all` (LLD-C1, ADR-0137 gate pattern)', () => {
  it('is wired into package.json exports and resolves to a real, non-empty generated module', () => {
    expect(pkg.exports['./dogfood-frame']).toBe(`./${DOGFOOD_MODULE_REL}`)
    expect(existsSync(`${PKG}/${DOGFOOD_MODULE_REL}`)).toBe(true)
    const generated = read(DOGFOOD_MODULE_REL)
    expect(generated).toContain('DOGFOOD_CSS')
    expect(generated).toContain('DOGFOOD_JS')
    expect(generated).toContain('DOGFOOD_TAGS')
  })

  it('the root `.` barrel (src/index.ts) never transitively reaches the dogfood module', () => {
    const reached = crawlDogfood('src/index.ts')
    expect(reached.has(DOGFOOD_MODULE_REL)).toBe(false)
  })

  it('the demo-only `./all` entry (src/all.gen.ts) never transitively reaches the dogfood module', () => {
    const reached = crawlDogfood('src/all.gen.ts')
    expect(reached.size).toBeGreaterThan(60) // the crawl walked the whole fleet, so the absence below is real
    expect(reached.has(DOGFOOD_MODULE_REL)).toBe(false)
  })

  it('a planted import (negative control) IS caught by the crawl — the trace itself is not vacuous', () => {
    // Write a REAL scratch fixture (a `dist-*`-prefixed, gitignored scratch dir — the fleet's own
    // scratch-file convention) that genuinely `export *`s the dogfood module, then run the SAME
    // `crawlDogfood` over it. Unlike merely `.add()`-ing the target onto an already-returned Set (which
    // would be true regardless of whether the crawler works at all), this re-invokes the crawler on an
    // input containing a REAL reaching edge — the assertion only passes if `crawlDogfood` actually
    // follows relative imports and finds the target, proving the `false` results above are a genuine
    // absence, not a crawler that can never find anything.
    const scratchDir = `${PKG}/dist-barrels-negative-control-scratch`
    const fixtureRel = 'dist-barrels-negative-control-scratch/negative-control.ts'
    rmSync(scratchDir, { recursive: true, force: true })
    mkdirSync(scratchDir, { recursive: true })
    writeFileSync(`${PKG}/${fixtureRel}`, `export * from '../${DOGFOOD_MODULE_REL}'\n`)
    try {
      const reached = crawlDogfood(fixtureRel)
      expect(reached.has(DOGFOOD_MODULE_REL)).toBe(true)
    } finally {
      rmSync(scratchDir, { recursive: true, force: true })
    }
  })

  it('the root barrel exposes no dogfood-only symbol at runtime (ADR-0137 IDENTITY leg)', () => {
    for (const sym of ['DOGFOOD_CSS', 'DOGFOOD_JS', 'DOGFOOD_TAGS']) {
      expect(rootBarrel, `the root \`.\` barrel must not expose dogfood symbol "${sym}"`).not.toHaveProperty(sym)
    }
  })
})
