// wrap-pack.ts — ADR-0141's theme-pack wrap tool (TKT-0087). Wraps ONE Ultimate Tokens color export
// (a real `exportCSS`/`exportOKLCH` artifact, `export.colorPrefix: 'md-sys-color'`) into a
// `[theme='<name>']` pack at `src/tokens/themes/<name>.css` — the ONE mechanical step between "a UT
// export sitting on disk" and "a theme this repo's provider can select". Never imports UT's engine
// (ADR-0118's generator-owns-math fence, ADR-0141 cl.3) — it consumes an export ARTIFACT, validated by
// SHAPE, not re-derived.
//
// Run via Node type-stripping from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/shared/tools/themes/wrap-pack.ts <name> <export.css>
//
// Validates the input is UT's export grammar (a single `:root { … }` block, `--md-sys-color-*` custom
// properties only, `color-scheme: light dark;` present — the same scheme-completeness marker the
// default carries) and fails LOUDLY on drift (a malformed/foreign file never silently becomes a
// "pack"). No family-name adaptation table: a config's palette names (e.g. this repo's own "accent"
// slot) are UT's OWN `name` field, passed straight through — verified 2026-07-17 against the real
// `ultimate-tokens-modal-jazz-the-cool-blue-session-config.json` config (TKT-0087 Findings): there is
// no generic UT-role → agent-ui-name rename to encode here.
//
// Idempotent: re-running with the same (name, export) pair overwrites the pack with byte-identical
// content — never a second, drifted copy.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

declare const process: { argv: string[]; cwd(): string; exit(code: number): never }

// Paths resolve from `process.cwd()` (the repo root this script is documented to run from), NOT
// `import.meta.url` — the mini-skills.ts precedent this repo already learned the hard way: a bundler
// relocating this file breaks a source-relative resolution silently, cwd never does.
const THEMES_DIR = `${process.cwd()}/packages/agent-ui/shared/src/tokens/themes`

const NAME_RE = /^[a-z][a-z0-9-]*$/

/** Extract the declaration body of a UT export's single top-level `:root { … }` block, validating the
 *  shape as it goes. Throws with a specific, actionable message on the first thing that doesn't match
 *  a real UT export — never a silent partial wrap. */
export function extractRootBody(css: string): string {
  const at = css.indexOf(':root')
  if (at === -1) throw new Error('wrap-pack: input has no `:root` block — not a UT color export')
  const open = css.indexOf('{', at)
  if (open === -1) throw new Error('wrap-pack: `:root` has no opening brace')
  const close = css.lastIndexOf('}')
  if (close === -1 || close < open) throw new Error('wrap-pack: `:root` block has no closing brace')
  const body = css.slice(open + 1, close).trim()

  if (!/color-scheme:\s*light dark\s*;/.test(body)) {
    throw new Error('wrap-pack: input has no `color-scheme: light dark;` — not scheme-complete')
  }
  const props = [...body.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1] as string)
  if (props.length === 0) throw new Error('wrap-pack: input declares zero custom properties')
  const foreign = props.filter((p) => p !== 'color-scheme' && !p.startsWith('md-sys-color-'))
  if (foreign.length > 0) {
    throw new Error(`wrap-pack: input declares non-\`--md-sys-color-*\` propert${foreign.length === 1 ? 'y' : 'ies'}: ${foreign.slice(0, 5).join(', ')}`)
  }
  return body
}

/** Wrap a UT export's `:root` body under `[theme='<name>']`, 2-space re-indented to match this repo's
 *  CSS convention (ADR-0003 — the same indent every hand-authored token block already uses). */
export function wrapPack(name: string, exportCss: string): string {
  if (!NAME_RE.test(name)) throw new Error(`wrap-pack: "${name}" is not a legal theme name (kebab, lowercase, [a-z0-9-]+)`)
  const body = extractRootBody(exportCss)
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `  ${l}`)
  return (
    `/* ${name}.css — a THEME PACK (ADR-0141/TKT-0087): an Ultimate Tokens color export wrapped under\n` +
    ` * \`[theme='${name}']\`, re-declaring the --md-sys-color-* system-tier surface for any subtree an\n` +
    ` * ancestor \`ui-theme-provider[theme='${name}']\` themes. Generated — do not hand-edit; regenerate via\n` +
    ` * \`wrap-pack.ts\` from a fresh UT export. Parity: the 16 hand-authored roles the default (tokens.css)\n` +
    ` * carries beyond a stock UT export (focus-ring · neutral-tint-* · neutral-track{,-hover} ·\n` +
    ` * primary-selected · the raw 050/950 alpha triples — TKT-0087 Findings) are DELIBERATELY absent here;\n` +
    ` * an element inside this themed subtree inherits those roles from :root's default via ordinary CSS\n` +
    ` * custom-property cascade — no fallback mechanism needed. */\n\n` +
    `[theme='${name}'] {\n${lines.join('\n')}\n}\n`
  )
}

function main(): void {
  const [, , name, exportPath] = process.argv
  if (!name || !exportPath) {
    console.error('usage: wrap-pack.ts <name> <export.css>')
    process.exit(1)
  }
  const resolved = resolve(exportPath)
  if (!existsSync(resolved)) {
    console.error(`wrap-pack: no such file: ${resolved}`)
    process.exit(1)
  }
  const exportCss = readFileSync(resolved, 'utf8')
  const pack = wrapPack(name, exportCss)
  const outPath = `${THEMES_DIR}/${name}.css`
  writeFileSync(outPath, pack)
  console.log(`wrap-pack: wrote ${outPath} (${pack.length} bytes)`)
}

// Only run as a CLI, not when imported (extractRootBody/wrapPack are unit-tested directly).
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()
