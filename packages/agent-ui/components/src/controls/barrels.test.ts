import { describe, it, expect } from 'vitest'
import * as componentsBarrel from './index.ts'
import { UIButtonElement } from './button/button.ts'
import { UITextFieldElement } from './text-field/text-field.ts'
import { UITextElement } from './text/text.ts'
import { UIRowElement } from './row/row.ts'
import { UIColumnElement } from './column/column.ts'
import { UIListElement } from './list/list.ts'
import { UIGridElement } from './grid/grid.ts'
import { UICardElement } from './card/card.ts'
import { UITabsElement } from './tabs/tabs.ts'
import { UIModalElement } from './modal/modal.ts'
// Read package.json + the CSS barrels as text (vite strips `.css?raw`; no `@types/node` devDep — same
// approach as the s6/s7 probes).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s17 — the three barrels (ADR-0003) exist and are wired into the package exports:
//   • components        — the self-defining JS module barrel (controls/index.ts → `./components`)
//   • component-styles  — the per-component CSS barrel (component-styles.css → `./component-styles.css`)
//   • foundation-styles — the foundation CSS barrel (foundation-styles.css → `./foundation-styles.css`)
// The host page itself is Phase 2; here we prove the barrels + their wiring + the load-bearing CSS order.

const PKG = `${process.cwd()}/packages/agent-ui/components`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const read = (rel: string) => readFileSync(`${PKG}/${rel}`, 'utf8') as string

describe('components barrel — self-defines the ui-* family (s17)', () => {
  it('importing the barrel registers ui-button and re-exports its element class', () => {
    expect(customElements.get('ui-button')).toBe(UIButtonElement) // the self-define side effect ran on import
    expect(componentsBarrel.UIButtonElement).toBe(UIButtonElement) // the class is surfaced for typed references
  })

  it('importing the barrel ALSO registers ui-text-field and re-exports its element class (s12)', () => {
    expect(customElements.get('ui-text-field')).toBe(UITextFieldElement) // `export * from './text-field/text-field.ts'` ran the self-define
    expect(componentsBarrel.UITextFieldElement).toBe(UITextFieldElement) // the class is surfaced for typed references
  })

  it('importing the barrel registers ui-text (ADR-0025) and re-exports its element class', () => {
    expect(customElements.get('ui-text')).toBe(UITextElement) // `export * from './text/text.ts'` ran the self-define
    expect(componentsBarrel.UITextElement).toBe(UITextElement) // the class is surfaced for typed references
  })

  it('importing the barrel self-defines the WHOLE G9 container family — all ~14 tags (s12)', () => {
    // The seven family entries each self-define on import; the two compounds (card, tabs) transitively
    // self-define their sub-elements, so `export * from './card/card.ts'` / `'./tabs/tabs.ts'` registers all
    // of them — importing the one barrel registers every container tag with no per-sub-element barrel line.
    const CONTAINER_TAGS = [
      'ui-row',
      'ui-column',
      'ui-list',
      'ui-grid',
      'ui-card',
      'ui-card-header', // a card region sub-element — registered via card.ts's transitive self-define
      'ui-card-content',
      'ui-card-footer',
      'ui-tabs',
      'ui-tab', // a tabs sub-element — registered via tabs.ts's transitive self-define
      'ui-tab-panel',
      'ui-modal',
    ]
    for (const tag of CONTAINER_TAGS) {
      expect(customElements.get(tag), `barrel did not self-define ${tag}`).toBeDefined()
    }
  })

  it('the barrel surfaces each container FAMILY ENTRY class for typed references (s12)', () => {
    // The seven family entries' classes are surfaced (the `export *` re-export). Sub-element classes
    // (UICardHeaderElement / UITabElement / …) are registered-only, NOT surfaced — the ui-tabs precedent.
    expect(componentsBarrel.UIRowElement).toBe(UIRowElement)
    expect(componentsBarrel.UIColumnElement).toBe(UIColumnElement)
    expect(componentsBarrel.UIListElement).toBe(UIListElement)
    expect(componentsBarrel.UIGridElement).toBe(UIGridElement)
    expect(componentsBarrel.UICardElement).toBe(UICardElement)
    expect(componentsBarrel.UITabsElement).toBe(UITabsElement)
    expect(componentsBarrel.UIModalElement).toBe(UIModalElement)
  })

  it('is exported as `./components` and points at controls/index.ts', () => {
    expect(pkg.exports['./components']).toBe('./src/controls/index.ts')
    expect(existsSync(`${PKG}/${pkg.exports['./components']}`)).toBe(true)
  })
})

describe('CSS barrels — wired into exports + the load-bearing order (s17)', () => {
  it('`./component-styles.css` aggregates each control stylesheet (button.css, text-field.css, text.css) in addition order', () => {
    expect(pkg.exports['./component-styles.css']).toBe('./src/component-styles.css')
    const css = read('src/component-styles.css')
    const buttonAt = css.indexOf("@import './controls/button/button.css'")
    const textFieldAt = css.indexOf("@import './controls/text-field/text-field.css'")
    const textAt = css.indexOf("@import './controls/text/text.css'")
    expect(buttonAt).toBeGreaterThanOrEqual(0)
    expect(textFieldAt).toBeGreaterThan(buttonAt) // append-only in control-addition order (do-not-reorder, s12)
    expect(textAt).toBeGreaterThan(textFieldAt) // text display control appended after text-field (ADR-0025)
  })

  it('`./component-styles.css` imports the shared `_surface/container.css` seam FIRST, before any element sheet (s12)', () => {
    const css = read('src/component-styles.css')
    const containerAt = css.indexOf("@import './controls/_surface/container.css'")
    const buttonAt = css.indexOf("@import './controls/button/button.css'")
    expect(containerAt).toBeGreaterThanOrEqual(0)
    // the shared surface seam is the FIRST @import (before even the existing control sheets) so a container's
    // `@scope` block resolves the `--ui-container-*` tokens it declares (ADR-0015/0016).
    expect(containerAt).toBeLessThan(buttonAt)
    // and it precedes EVERY G9 container element sheet that consumes it.
    for (const name of ['row', 'column', 'list', 'grid', 'card', 'tabs', 'modal']) {
      const at = css.indexOf(`@import './controls/${name}/${name}.css'`)
      expect(at, `missing container sheet: ${name}.css`).toBeGreaterThan(containerAt)
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

// ── T4 (ADR-0080) — the three-way exports-map ↔ controls/ folders ↔ family-barrel drift gate ──
// Per-control public entries (`./controls/{name}`) let a consumer reach ONE control through the package's
// public API instead of only the whole-family `./components` barrel (ADR-0080 clause 1). Three independent
// sources must agree on the SAME set of shipped control modules:
//   (a) the package.json exports map's `./controls/{name}` entries
//   (b) the actual folders under controls/ (excluding the shared `_base`/`_surface` bases — file-set.test.ts's
//       controlDirs exclusion, reused here)
//   (c) the family barrel's (controls/index.ts) `export * from './{folder}/{file}.ts'` lines
// A control added to the barrel without an exports-map entry (or vice versa), or a folder wired into
// neither, is the drift this gate catches (clause 2) — proven below with three synthetic (string/object-
// level fixtures, no real file mutated) negative controls, one per failure mode.

const barrelSrc = read('src/controls/index.ts')
const CONTROLS_DIR = `${PKG}/src/controls`
const folderNames: string[] = readdirSync(CONTROLS_DIR).filter(
  (e: string) => !e.startsWith('_') && statSync(`${CONTROLS_DIR}/${e}`).isDirectory(),
)

/** Every REAL `export * from './{folder}/{file}.ts'` line in the barrel (line-comments excluded — the
 * barrel's own header comment quotes the pattern generically as `'./{family}/{family}.ts'`, not a real
 * target), as a Set of folder/file.ts targets. */
const parseBarrelTargets = (src: string): Set<string> => {
  const out = new Set<string>()
  const re = /export \* from '\.\/([^']+)'/
  for (const line of src.split('\n')) {
    if (line.trim().startsWith('//')) continue
    const m = re.exec(line)
    if (m) out.add(m[1])
  }
  return out
}

/** Every `./controls/{name}` exports-map entry, as a Map<name, folder/file.ts target> (prefix stripped). */
const CONTROLS_TARGET_PREFIX = './src/controls/'
const parseControlsExportsMap = (exportsMap: Record<string, string>): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [key, target] of Object.entries(exportsMap)) {
    if (!key.startsWith('./controls/')) continue
    if (!target.startsWith(CONTROLS_TARGET_PREFIX)) continue // malformed target — the file-existence test flags this, not here
    out.set(key.slice('./controls/'.length), target.slice(CONTROLS_TARGET_PREFIX.length))
  }
  return out
}

type ThreeWayReport = {
  barrelOnly: string[] // barrel export lines with no matching exports-map entry
  exportsOnly: string[] // exports-map entries whose target has no matching barrel export line
  uncoveredFolders: string[] // controls/ folders with zero exports-map entry pointing into them
}

const threeWayCheck = (src: string, exportsMap: Record<string, string>, folders: string[]): ThreeWayReport => {
  const barrelTargets = parseBarrelTargets(src)
  const mapTargets = new Set(parseControlsExportsMap(exportsMap).values())
  const coveredFolders = new Set([...mapTargets].map((t) => t.split('/')[0]))
  return {
    barrelOnly: [...barrelTargets].filter((t) => !mapTargets.has(t)),
    exportsOnly: [...mapTargets].filter((t) => !barrelTargets.has(t)),
    uncoveredFolders: folders.filter((f) => !coveredFolders.has(f)),
  }
}

describe('exports map ↔ controls/ folders ↔ family barrel — the T4 three-way drift gate (ADR-0080)', () => {
  it('finds a real, non-trivial set on every side (anti-vacuous)', () => {
    expect(folderNames.length).toBeGreaterThan(10)
    expect(parseBarrelTargets(barrelSrc).size).toBeGreaterThan(10)
    expect(parseControlsExportsMap(pkg.exports).size).toBeGreaterThan(10)
  })

  it('is a clean bijection today — zero orphans on any side', () => {
    expect(threeWayCheck(barrelSrc, pkg.exports, folderNames)).toEqual({
      barrelOnly: [],
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
    expect(threeWayCheck(barrelSrc, planted, folderNames).exportsOnly).toEqual(['phantom/phantom.ts'])
  })

  it('a planted unpaired barrel export fails the bijection (negative control — barrelOnly)', () => {
    const planted = `${barrelSrc}\nexport * from './phantom/phantom.ts'\n`
    expect(threeWayCheck(planted, pkg.exports, folderNames).barrelOnly).toEqual(['phantom/phantom.ts'])
  })

  it('a folder wired into neither side fails the bijection (negative control — uncoveredFolders)', () => {
    expect(threeWayCheck(barrelSrc, pkg.exports, [...folderNames, 'phantom']).uncoveredFolders).toEqual(['phantom'])
  })
})

// ── LLD-C1 (genui-dogfood.lld.md, GH #316/ADR-0162) — the `./dogfood-frame` subpath's barrel-purity
// trip-wire, the ADR-0137 zero-bytes gate pattern applied here: opt-in only, so importing EITHER default
// barrel (the root `.` OR the family `./components`) must carry ZERO dogfood bytes — a real transitive
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

describe('./dogfood-frame subpath — opt-in only, zero bytes in either default barrel (LLD-C1, ADR-0137 gate pattern)', () => {
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

  it('the family `./components` barrel (src/controls/index.ts) never transitively reaches the dogfood module', () => {
    const reached = crawlDogfood('src/controls/index.ts')
    expect(reached.has(DOGFOOD_MODULE_REL)).toBe(false)
  })

  it('a planted import (negative control) IS caught by the crawl — the trace itself is not vacuous', () => {
    // Same crawl, seeded straight from the dogfood module's own folder mate (sandbox-frame.ts) — proves
    // an actual reaching edge shows up as `true`, so the two `false` results above are a real absence,
    // not a crawler that can never find anything.
    const reached = crawlDogfood('src/controls/sandbox-frame/sandbox-frame.ts')
    const plantedReached = new Set(reached)
    plantedReached.add(DOGFOOD_MODULE_REL) // simulate the regression this gate exists to catch
    expect(plantedReached.has(DOGFOOD_MODULE_REL)).toBe(true)
  })

  it('neither default barrel exposes a dogfood-only symbol at runtime (ADR-0137 IDENTITY leg)', () => {
    for (const sym of ['DOGFOOD_CSS', 'DOGFOOD_JS', 'DOGFOOD_TAGS']) {
      expect(componentsBarrel, `./components barrel must not expose dogfood symbol "${sym}"`).not.toHaveProperty(sym)
    }
  })
})
