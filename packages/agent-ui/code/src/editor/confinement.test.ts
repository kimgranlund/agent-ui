import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

declare const process: { cwd(): string }

// confinement.test.ts (ADR-0139 cl.8b, widened by ADR-0147 cl.7, widened again for the markdown formatting
// commands, 2026-07-19) — the CodeMirror confinement trip-wire. Three invariants, one file:
//   (1) NO static `@codemirror/*` / `@lezer/*` import exists ANYWHERE under code/src OUTSIDE editor/.
//   (2) INSIDE editor/, ONLY the lazy TRIO {cm-editor.ts, cm-richtext.ts, cm-commands.ts} may statically
//       import them; every OTHER editor/ module (the FACE wrapper editor.ts, the barrel index.ts, the
//       tests' non-test peers) carries ZERO static CM imports — the runtime arrives via a dynamic import()
//       ONLY (the gen-ui-kit single-module shape: code.class.js is CM-free; code-editor.js carries CM).
//       This is what keeps CM out of any main bundle.
//   (3) cm-richtext.ts (the richtext decoration engine, ADR-0147) AND cm-commands.ts (the formatting
//       commands) are each statically imported ONLY by cm-editor.ts — the lazy chunk BOUNDARY is the
//       load-bearing fact, the trio sits entirely inside it; nothing outside cm-editor.ts may reach either.
// A dynamic `import('@codemirror/...')` is deliberately NOT matched — the gate is about STATIC module-graph
// edges (the thing a bundler pulls eagerly), not the lazy chunk boundary editor.ts relies on.

const SRC = `${process.cwd()}/packages/agent-ui/code/src`
// the lazy TRIO ADR-0147 cl.7 (widened 2026-07-19) permits static CM imports in — all three land in the ONE
// lazy chunk editor.ts's dynamic import('./cm-editor.ts') splits off.
const DESIGNATED = ['editor/cm-editor.ts', 'editor/cm-richtext.ts', 'editor/cm-commands.ts'] as const

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...walk(full))
    else if (e.isFile() && e.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/** Static `@codemirror/*` / `@lezer/*` module-graph edges — every form that pulls CM eagerly into a bundle:
 *  `import … from '…'`, the value/type RE-EXPORT `export … from '…'` (reviewer M4 — a re-export would ALSO
 *  drag CM transitively and evade the identity gate, which only reads barrel source), the bare side-effect
 *  `import '…'`, AND their MULTI-LINE forms (the `{ … }` list spanning newlines — M4). The `from`-clause body
 *  uses `[^'";]*?` (allows newlines, but STOPS at a quote or `;`, so it never spans two statements). A dynamic
 *  `import('…')` has a `(` before the quote and no `from`, so nothing here matches it — exactly the
 *  STATIC-only intent (dynamic is the permitted lazy seam). */
function staticCmSpecifiers(src: string): string[] {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"](@(?:codemirror|lezer)\/[^'"]+)['"]/g
  const bareRe = /\bimport\s+['"](@(?:codemirror|lezer)\/[^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

const files = walk(SRC)
  .map((abs) => [abs.slice(SRC.length + 1), abs] as const)
  .filter(([rel]) => !rel.endsWith('.test.ts'))

describe('CodeMirror confinement (ADR-0139 cl.8b, widened by ADR-0147 cl.7)', () => {
  it('anti-vacuous: the walk finds code/src files AND both designated modules exist', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const designated of DESIGNATED) expect(files.some(([rel]) => rel === designated)).toBe(true)
  })

  it('ALL THREE designated modules DO statically import CodeMirror (the confinement is not vacuous)', () => {
    const cmEditor = files.find(([rel]) => rel === 'editor/cm-editor.ts')!
    const cmEditorSpecs = staticCmSpecifiers(readFileSync(cmEditor[1], 'utf8') as string)
    expect(cmEditorSpecs.length).toBeGreaterThan(0)
    expect(cmEditorSpecs).toContain('@codemirror/state')

    const cmRichtext = files.find(([rel]) => rel === 'editor/cm-richtext.ts')!
    const cmRichtextSpecs = staticCmSpecifiers(readFileSync(cmRichtext[1], 'utf8') as string)
    expect(cmRichtextSpecs.length).toBeGreaterThan(0)

    const cmCommands = files.find(([rel]) => rel === 'editor/cm-commands.ts')!
    const cmCommandsSpecs = staticCmSpecifiers(readFileSync(cmCommands[1], 'utf8') as string)
    expect(cmCommandsSpecs.length).toBeGreaterThan(0)
  })

  it('NO static @codemirror/@lezer import exists outside editor/, and inside editor/ only the lazy trio has one', () => {
    const violations: string[] = []
    for (const [rel, abs] of files) {
      if ((DESIGNATED as readonly string[]).includes(rel)) continue
      const specs = staticCmSpecifiers(readFileSync(abs, 'utf8') as string)
      for (const spec of specs) violations.push(`${rel} -> "${spec}"`)
    }
    expect(violations).toEqual([])
  })

  it('editor.ts (the FACE wrapper) carries ZERO static CM imports — CM arrives via dynamic import only', () => {
    const wrapper = files.find(([rel]) => rel === 'editor/editor.ts')!
    const src = readFileSync(wrapper[1], 'utf8') as string
    expect(staticCmSpecifiers(src)).toEqual([])
    // …and it DOES reach cm-editor.ts through a dynamic import (the lazy seam is present, not dropped).
    expect(src).toMatch(/import\(\s*['"]\.\/cm-editor\.ts['"]\s*\)/)
  })

  it('cm-richtext.ts is statically imported ONLY by cm-editor.ts — the lazy chunk boundary holds (ADR-0147 cl.7)', () => {
    // A source-text probe over code/src (mirroring the existing shape): every OTHER file must carry no
    // static import (OR re-export — the (?:import|export) alternation, the same evasion the sibling
    // staticCmSpecifiers matcher guards against, NIT) specifier naming './cm-richtext.ts' (relative form,
    // the only form a same-directory import can take here).
    const importers: string[] = []
    for (const [rel, abs] of files) {
      const src = readFileSync(abs, 'utf8') as string
      if (
        /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]\.\/cm-richtext\.ts['"]/.test(src) ||
        /\bimport\s*\(\s*['"]\.\/cm-richtext\.ts['"]\s*\)/.test(src)
      ) {
        importers.push(rel)
      }
    }
    expect(importers).toEqual(['editor/cm-editor.ts'])
  })

  it('cm-commands.ts is statically imported ONLY by cm-editor.ts — the same lazy chunk boundary (2026-07-19)', () => {
    const importers: string[] = []
    for (const [rel, abs] of files) {
      const src = readFileSync(abs, 'utf8') as string
      if (
        /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]\.\/cm-commands\.ts['"]/.test(src) ||
        /\bimport\s*\(\s*['"]\.\/cm-commands\.ts['"]\s*\)/.test(src)
      ) {
        importers.push(rel)
      }
    }
    expect(importers).toEqual(['editor/cm-editor.ts'])
  })

  it('negative control: the matcher flags a planted static @codemirror import (both import forms)', () => {
    expect(staticCmSpecifiers(`import { EditorView } from '@codemirror/view'\n`)).toEqual(['@codemirror/view'])
    expect(staticCmSpecifiers(`import '@codemirror/state'\n`)).toEqual(['@codemirror/state'])
  })

  it('negative control: the matcher flags a value/type RE-EXPORT and a MULTI-LINE import (reviewer M4 gaps)', () => {
    // A re-export drags CM transitively AND evades the identity gate (which only reads barrel source text).
    expect(staticCmSpecifiers(`export { EditorView } from '@codemirror/view'\n`)).toEqual(['@codemirror/view'])
    expect(staticCmSpecifiers(`export type { Extension } from '@codemirror/state'\n`)).toEqual(['@codemirror/state'])
    expect(staticCmSpecifiers(`export { tags } from '@lezer/highlight'\n`)).toEqual(['@lezer/highlight'])
    // A multi-line import list (the `{ … }` spanning newlines) must not slip past the newline boundary.
    const multiline = `import {\n  EditorState,\n  Compartment,\n} from '@codemirror/state'\n`
    expect(staticCmSpecifiers(multiline)).toEqual(['@codemirror/state'])
  })

  it('negative control: the matcher does NOT flag a dynamic import, nor span two separate statements', () => {
    expect(staticCmSpecifiers(`const m = await import('@codemirror/lang-markdown')\n`)).toEqual([])
    // a bare local import then a CM import: the `from` body stops at the first quote, so the first line's
    // specifier is NOT swallowed into the second's match (proves the `[^'";]` statement boundary holds).
    expect(staticCmSpecifiers(`import './local.ts'\nconst x = 1\n`)).toEqual([])
  })
})
