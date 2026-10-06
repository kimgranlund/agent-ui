#!/usr/bin/env node
// codemod-uses.mjs: writes each fleet descriptor's `uses:` block (ADR-0233) from the real import graph, and the
// matching `@import` prologue of each fleet sheet, via the SAME `control-graph.ts` functions the gates
// (packages/agent-ui/components/src/controls/uses-driftwire.test.ts and css-uses.test.ts) import, so the CLI and
// the gates cannot drift into two implementations (the generate-props.mjs / generate-props.ts pairing, reused).
//
// The fleet is every `controls/{folder}/{name}.md` whose folder is not `_`-prefixed. The block goes on the
// line directly after the descriptor's `extends:` line (a required field every fleet descriptor carries; when
// its trailing comment wraps onto indented comment lines, after the last of those), tags sorted, `uses: []` when the control uses no other fleet control. An existing `uses:` block is
// replaced, wherever it sits in the frontmatter.
//
// The CSS half: a sheet `{folder}/{name}.css` whose `uses` is non-empty opens, before its first non-comment
// token, with one marker comment (`uses: synced from {name}.md by scripts/codemod-uses.mjs`) and then one
// import per used control's sheet, sorted by tag (`./{name}.css` for a same-folder control, else
// `../{folder}/{name}.css`). An empty `uses` means no prologue; an existing prologue is replaced or removed.
//
// Usage:
//   node scripts/codemod-uses.mjs           rewrite every out-of-sync fleet descriptor and sheet
//   node scripts/codemod-uses.mjs --check   write nothing; exit 1 naming each out-of-sync descriptor or sheet

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  deriveUses,
  descriptorPath,
  fleetFromDescriptors,
  sheetPath,
  usesPrologue,
  withCssPrologue,
} from '../packages/agent-ui/components/src/descriptor/control-graph.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const CONTROLS_DIR = join(repoRoot, 'packages/agent-ui/components/src/controls')
const CONTROLS_REL = 'packages/agent-ui/components/src/controls'

const read = (rel) => {
  const abs = join(CONTROLS_DIR, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined
}

/** Every controls-relative `{folder}/{name}.md` outside `_` folders. */
function descriptorPaths() {
  const out = []
  for (const dir of readdirSync(CONTROLS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue
    for (const f of readdirSync(join(CONTROLS_DIR, dir.name))) if (f.endsWith('.md')) out.push(`${dir.name}/${f}`)
  }
  return out.sort()
}

/** The `uses` block lines for a sorted tag list. */
const usesBlock = (tags) => (tags.length === 0 ? ['uses: []'] : ['uses:', ...tags.map((t) => `  - ${t}`)])

/** Return `source` with its frontmatter `uses` block set to `tags`, or throw naming what is missing. */
function withUses(source, tags, rel) {
  const lines = source.split('\n')
  if (lines[0] !== '---') throw new Error(`${rel}: no leading --- frontmatter fence`)
  const close = lines.indexOf('---', 1)
  if (close === -1) throw new Error(`${rel}: frontmatter fence never closes`)
  const fence = lines.slice(1, close)
  // Drop an existing top-level `uses:` line and its indented `- ` items.
  const kept = []
  for (let i = 0; i < fence.length; i++) {
    if (/^uses:/.test(fence[i])) {
      while (i + 1 < fence.length && /^\s+-/.test(fence[i + 1])) i++
      continue
    }
    kept.push(fence[i])
  }
  let at = kept.findIndex((l) => /^extends:/.test(l))
  if (at === -1) throw new Error(`${rel}: no top-level extends: line to anchor uses after`)
  // An extends comment that wraps onto indented comment lines stays whole: uses goes after the last of them.
  while (at + 1 < kept.length && /^\s+#/.test(kept[at + 1])) at++
  kept.splice(at + 1, 0, ...usesBlock(tags))
  return [lines[0], ...kept, ...lines.slice(close)].join('\n')
}

function main() {
  const check = process.argv.includes('--check')
  const fleet = fleetFromDescriptors(descriptorPaths(), read)
  const outOfSync = []
  let failed = false
  for (const entry of fleet) {
    const rel = descriptorPath(entry)
    const source = read(rel)
    const sheet = sheetPath(entry)
    const css = read(sheet)
    const writes = []
    try {
      const uses = deriveUses(entry, fleet, read)
      writes.push([rel, source, withUses(source, uses, rel)])
      // A control with no sheet has nothing to prologue; the css-uses gate flags a used control's missing sheet.
      if (css !== undefined) writes.push([sheet, css, withCssPrologue(css, usesPrologue(entry, uses, fleet))])
    } catch (err) {
      console.error(`codemod-uses: ${err.message}`)
      failed = true
      continue
    }
    for (const [path, before, next] of writes) {
      if (next === before) continue
      outOfSync.push(path)
      if (!check) writeFileSync(join(CONTROLS_DIR, path), next)
    }
  }
  if (check) {
    for (const rel of outOfSync) console.error(`codemod-uses: ${CONTROLS_REL}/${rel} is out of sync; run node scripts/codemod-uses.mjs`)
    if (outOfSync.length > 0) failed = true
    else if (!failed) console.log(`codemod-uses: all ${fleet.length} fleet descriptors and their sheets in sync`)
  } else {
    console.log(`codemod-uses: rewrote ${outOfSync.length} out-of-sync files across ${fleet.length} fleet controls`)
  }
  if (failed) process.exitCode = 1
}

main()
