// controls-gen-driftwire.test.ts: the ADR-0233 drift gate for the generated control registry, the demo-only
// `all` pair and the generator-owned `exports` keys. Regenerates in memory with the SAME `generate-controls.ts`
// functions `scripts/generate-controls.mjs` writes with, and requires the files on disk to match byte for byte
// (the props-gen-driftwire pairing). Fix a red here with `node scripts/generate-controls.mjs`, never by hand.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { CONTROLS } from '@agent-ui/components/registry'
import { fleetFromDescriptors, type ControlsReader, type FleetEntry } from '../descriptor/control-graph.ts'
import {
  GENERATED_FILES,
  controlsGenEntries,
  generateControls,
  isGeneratorOwnedKey,
  staleControlsArtifacts,
  withGeneratedExports,
  type ControlsGenEntry,
  type PackageReader,
} from '../descriptor/generate-controls.ts'
declare const process: { cwd(): string }

const PKG = `${process.cwd()}/packages/agent-ui/components`
const CONTROLS_DIR = `${PKG}/src/controls`
const readAt = (dir: string) => (p: string) => (existsSync(`${dir}/${p}`) ? (readFileSync(`${dir}/${p}`, 'utf8') as string) : undefined)
const readControls: ControlsReader = readAt(CONTROLS_DIR)
const readPackage: PackageReader = readAt(PKG)

// Fleet discovery: the family-coherence shape (every `{folder}/{name}.md` outside `_` folders).
const mdPaths: string[] = (readdirSync(CONTROLS_DIR) as string[])
  .filter((d) => !d.startsWith('_') && statSync(`${CONTROLS_DIR}/${d}`).isDirectory())
  .flatMap((d) => (readdirSync(`${CONTROLS_DIR}/${d}`) as string[]).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`))
const FLEET: FleetEntry[] = fleetFromDescriptors(mdPaths, readControls)
const ENTRIES: ControlsGenEntry[] = controlsGenEntries(FLEET, readControls)
const GENERATED = generateControls(ENTRIES)
const pkgExports = (JSON.parse(readPackage('package.json') as string) as { exports: Record<string, string> }).exports

describe('controls-gen-driftwire: anti-vacuous fleet coverage', () => {
  it('discovers the whole fleet (one entry per descriptor)', () => {
    expect(mdPaths.length).toBeGreaterThan(50)
    expect(FLEET).toHaveLength(mdPaths.length)
  })
})

describe('controls-gen-driftwire: the generated files match a fresh regeneration', () => {
  it.each([
    ['registry.gen.ts', GENERATED_FILES.registry, GENERATED.registry],
    ['all.gen.ts', GENERATED_FILES.allTs, GENERATED.allTs],
    ['all.gen.css', GENERATED_FILES.allCss, GENERATED.allCss],
  ])('%s is byte-identical (run node scripts/generate-controls.mjs)', (_name, path, text) => {
    expect(readPackage(path)).toBe(text)
  })

  it('the generator-owned exports keys equal the regenerated set, in the same order', () => {
    const owned = Object.fromEntries(Object.entries(pkgExports).filter(([k]) => isGeneratorOwnedKey(k)))
    expect(owned).toEqual(GENERATED.exports)
    expect(Object.keys(owned)).toEqual(Object.keys(GENERATED.exports))
  })

  it('nothing is stale: the same check `node scripts/generate-controls.mjs --check` runs', () => {
    expect(staleControlsArtifacts(readPackage, GENERATED)).toEqual([])
  })
})

describe('controls-gen-driftwire: CONTROLS through the package specifier', () => {
  it('@agent-ui/components/registry resolves and holds one record per descriptor', () => {
    expect(Object.keys(CONTROLS).sort()).toEqual(FLEET.map((e) => e.tag).sort())
    for (const e of ENTRIES) {
      const record = CONTROLS[e.tag]
      expect(record.tag).toBe(e.tag)
      expect(record.css).toBe(`./${e.folder}/${e.name}.css`)
      expect(record.uses).toEqual(e.uses)
    }
  })

  it('a record loads its control: load() self-defines the tag', async () => {
    await CONTROLS['ui-badge'].load()
    expect(customElements.get('ui-badge')).toBeDefined()
  })
})

describe('controls-gen-driftwire: negative controls (the drift check bites)', () => {
  // Each control plants ONE defect on an in-sync tree built in memory (the regenerated files and the on-disk
  // package.json with its generated keys merged), so a control reports only its own defect even while the
  // real tree is stale.
  const IN_SYNC: Record<string, string> = {
    [GENERATED_FILES.registry]: GENERATED.registry,
    [GENERATED_FILES.allTs]: GENERATED.allTs,
    [GENERATED_FILES.allCss]: GENERATED.allCss,
    'package.json': withGeneratedExports(readPackage('package.json') as string, GENERATED.exports),
  }
  const inSync: PackageReader = (p) => IN_SYNC[p] ?? readPackage(p)

  it('the in-memory tree is in sync (the baseline every control plants on)', () => {
    expect(staleControlsArtifacts(inSync, GENERATED)).toEqual([])
  })

  it('a hand edit to a generated file is caught', () => {
    const edited: PackageReader = (p) => (p === GENERATED_FILES.registry ? `${inSync(p)}// hand edit\n` : inSync(p))
    expect(staleControlsArtifacts(edited, GENERATED)).toEqual([GENERATED_FILES.registry])
  })

  it('a planted extra descriptor is caught in every artifact', () => {
    const plantedMd = '---\ntag: ui-phantom\nextends: UIElement\nuses: []\n---\n'
    const planted: ControlsReader = (p) => (p === 'phantom/phantom.md' ? plantedMd : readControls(p))
    const fleet = fleetFromDescriptors([...mdPaths, 'phantom/phantom.md'], planted)
    const regenerated = generateControls(controlsGenEntries(fleet, planted))
    expect(staleControlsArtifacts(inSync, regenerated)).toEqual([
      GENERATED_FILES.registry,
      GENERATED_FILES.allTs,
      GENERATED_FILES.allCss,
      'package.json',
    ])
  })

  it('a removed export key is caught', () => {
    const pkg = JSON.parse(inSync('package.json') as string) as { exports: Record<string, string> }
    delete pkg.exports['./controls/button.css']
    const removed: PackageReader = (p) => (p === 'package.json' ? `${JSON.stringify(pkg, null, 2)}\n` : inSync(p))
    expect(staleControlsArtifacts(removed, GENERATED)).toEqual(['package.json'])
  })
})
