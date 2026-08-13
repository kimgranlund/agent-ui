// fs-shim.ts — Cloudflare Worker replacement for `node:fs`, wired in via wrangler.jsonc's `alias` field
// (a real, documented Wrangler feature for exactly this: polyfilling a Node API a Worker's bundle imports
// but the Workers runtime can't provide — https://developers.cloudflare.com/workers/wrangler/configuration/#module-aliasing).
//
// Backs the two Node-only `readFileSync`/`readdirSync` call sites in `system-prompt.ts` and
// `mini-skills.ts` — both files ship UNMODIFIED in the Worker bundle (they're ADR-cited and
// drift-gated by `prompt-drift.test.ts`; this shim exists so neither needs to change, ever). Content
// comes from `fs-shim-content.ts`'s static imports, bundled at Worker-build time — Workers has no real
// filesystem, so this is never a live read.

import { FILES, DIRS } from './fs-shim-content.ts'

export function readFileSync(path: string, _encoding?: string): string {
  const content = FILES[path]
  if (content === undefined) throw new Error(`fs-shim: no bundled content for "${path}" — add it to fs-shim-content.ts`)
  return content
}

export function readdirSync(path: string): string[] {
  const entries = DIRS[path]
  if (entries === undefined) throw new Error(`fs-shim: no bundled directory listing for "${path}" — add it to fs-shim-content.ts`)
  return entries
}

// GH #811 — `dogfood-inventory.ts` (bundled since the M-C dogfood wave) also imports `statSync`, whose
// one call site is `statSync(dirPath).isDirectory()`. Membership in the bundled maps IS the file-vs-
// directory fact here: a DIRS key is a directory, a FILES key is a file, anything else is the same
// fail-fast add-it-to-content error the two readers above throw (never a silent ENOENT-shaped guess —
// a path the bundle doesn't know is a bundling gap, not a runtime condition).
export function statSync(path: string): { isDirectory(): boolean } {
  if (DIRS[path] !== undefined) return { isDirectory: () => true }
  if (FILES[path] !== undefined) return { isDirectory: () => false }
  throw new Error(`fs-shim: no bundled entry for "${path}" — add it to fs-shim-content.ts`)
}
