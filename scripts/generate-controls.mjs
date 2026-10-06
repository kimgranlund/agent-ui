#!/usr/bin/env node
// generate-controls.mjs: writes the components control registry, the demo-only `all` pair and the
// generator-owned `exports` keys (ADR-0233) via the SAME `generate-controls.ts` functions the drift gate
// (packages/agent-ui/components/src/controls/controls-gen-driftwire.test.ts) imports, so the CLI and the gate
// cannot drift into two implementations (the generate-props.mjs / generate-props.ts pairing, reused).
//
// The fleet is every `controls/{folder}/{name}.md` whose folder is not `_`-prefixed (the codemod-uses.mjs
// discovery); each control's `uses` is read from its descriptor with the descriptor parser, so run
// `node scripts/codemod-uses.mjs` first when an import changed.
//
// Writes, under packages/agent-ui/components:
//   src/controls/registry.gen.ts   CONTROLS: one lazy record per tag
//   src/all.gen.ts                 DEMO-ONLY: every control entry module
//   src/all.gen.css                DEMO-ONLY: the seam sheet, then every control sheet
//   package.json                   `exports`: stale `./controls/*` keys dropped, `./controls/{name}`,
//                                  `./controls/{name}.css`, `./registry`, `./all` and `./all.css` set, every
//                                  hand-owned key and every other field kept, keys in plain sorted order
//
// Usage:
//   node scripts/generate-controls.mjs           rewrite every stale artifact
//   node scripts/generate-controls.mjs --check   write nothing; exit 1 naming each stale artifact

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { fleetFromDescriptors } from '../packages/agent-ui/components/src/descriptor/control-graph.ts'
import {
  GENERATED_FILES,
  controlsGenEntries,
  generateControls,
  staleControlsArtifacts,
  withGeneratedExports,
} from '../packages/agent-ui/components/src/descriptor/generate-controls.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const PKG_REL = 'packages/agent-ui/components'
const PKG_DIR = join(repoRoot, PKG_REL)
const CONTROLS_DIR = join(PKG_DIR, 'src/controls')

const readAt = (dir) => (rel) => {
  const abs = join(dir, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined
}
const readControls = readAt(CONTROLS_DIR)
const readPackage = readAt(PKG_DIR)

/** Every controls-relative `{folder}/{name}.md` outside `_` folders. */
function descriptorPaths() {
  const out = []
  for (const dir of readdirSync(CONTROLS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue
    for (const f of readdirSync(join(CONTROLS_DIR, dir.name))) if (f.endsWith('.md')) out.push(`${dir.name}/${f}`)
  }
  return out.sort()
}

function main() {
  const check = process.argv.includes('--check')
  let generated
  try {
    const fleet = fleetFromDescriptors(descriptorPaths(), readControls)
    generated = generateControls(controlsGenEntries(fleet, readControls))
  } catch (err) {
    console.error(`generate-controls: ${err.message}`)
    process.exitCode = 1
    return
  }
  const stale = staleControlsArtifacts(readPackage, generated)
  const fleetSize = Object.keys(generated.exports).filter((k) => k.startsWith('./controls/') && !k.endsWith('.css')).length
  if (check) {
    for (const rel of stale) console.error(`generate-controls: ${PKG_REL}/${rel} is stale; run node scripts/generate-controls.mjs`)
    if (stale.length > 0) process.exitCode = 1
    else console.log(`generate-controls: registry, all pair and exports in sync for ${fleetSize} fleet controls`)
    return
  }
  const texts = {
    [GENERATED_FILES.registry]: generated.registry,
    [GENERATED_FILES.allTs]: generated.allTs,
    [GENERATED_FILES.allCss]: generated.allCss,
  }
  for (const rel of stale) {
    const next = rel === 'package.json' ? withGeneratedExports(readPackage(rel), generated.exports) : texts[rel]
    writeFileSync(join(PKG_DIR, rel), next)
  }
  console.log(`generate-controls: rewrote ${stale.length} stale artifacts for ${fleetSize} fleet controls${stale.length ? `: ${stale.join(', ')}` : ''}`)
}

main()
