#!/usr/bin/env node
// generate-props.mjs — the ADR-0173 props-layer generator CLI. Regenerates each named (or, with no args,
// every ALREADY-CONVERTED) control's `{name}.props.gen.ts` sibling from its `{name}.md` descriptor, via the
// SAME `generatePropsModule` implementation the drift gate
// (packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts) imports — so the CLI and the
// gate cannot drift into two implementations (the generate-llms-full.mjs/site/lib/llms.test.ts pairing,
// reused). A control is "already converted" when its own folder already carries a committed
// `{name}.props.gen.ts` — the filesystem itself is the migration-allowlist source of truth (ADR-0173 cl.6);
// no separate list to keep in sync.
//
// Usage:
//   node scripts/generate-props.mjs                — regenerate every already-converted control
//   node scripts/generate-props.mjs button table    — regenerate (or newly generate) exactly these controls
//
// Fails loudly (non-zero exit, every GenerationFailure printed) rather than writing a partial/wrong artifact
// (ADR-0173 cl.4's failure model) — a red run never leaves a stale-but-plausible file behind: on failure for
// a name, that name's file is simply not written this run.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { generatePropsModule } from '../packages/agent-ui/components/src/descriptor/generate-props.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const CONTROLS_DIR = join(repoRoot, 'packages/agent-ui/components/src/controls')

/** Every control folder that already carries a committed `{name}.props.gen.ts` — the migration-allowlist
 *  source of truth (ADR-0173 cl.6): no separate list to keep in sync as the fleet drains wave-by-wave. */
function alreadyConverted() {
  const names = []
  for (const entry of readdirSync(CONTROLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    if (existsSync(join(CONTROLS_DIR, entry.name, `${entry.name}.props.gen.ts`))) names.push(entry.name)
  }
  return names
}

/** Regenerate one control's `{name}.props.gen.ts` from its `{name}.md`. Returns true on success. */
function regenerate(name) {
  const dir = join(CONTROLS_DIR, name)
  const mdPath = join(dir, `${name}.md`)
  if (!existsSync(mdPath)) {
    console.error(`generate-props: ${name} — no ${name}.md descriptor found at ${mdPath}`)
    return false
  }
  const mdSource = readFileSync(mdPath, 'utf8')
  const result = generatePropsModule(mdSource)
  if (!result.ok) {
    console.error(`generate-props: ${name} — ${result.failures.length} generation failure(s):`)
    for (const f of result.failures) console.error(`  [${f.code}] ${f.path}: ${f.message}`)
    return false
  }
  const outPath = join(dir, `${name}.props.gen.ts`)
  writeFileSync(outPath, result.code)
  console.log(`generate-props: wrote ${result.code.length} bytes to controls/${name}/${name}.props.gen.ts`)
  return true
}

function main() {
  const targets = process.argv.slice(2)
  const names = targets.length > 0 ? targets : alreadyConverted()
  if (names.length === 0) {
    console.error('generate-props: no already-converted controls found and no names given on the command line — nothing to do')
    process.exitCode = 1
    return
  }
  let allOk = true
  for (const name of names) {
    if (!regenerate(name)) allOk = false
  }
  if (!allOk) process.exitCode = 1
}

main()
