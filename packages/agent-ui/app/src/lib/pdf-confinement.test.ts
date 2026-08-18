import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

declare const process: { cwd(): string }

// pdf-confinement.test.ts (ADR-0202 cl.4b, the ADR-0139 cl.8b shape reused verbatim for the pdf.js
// exception) — the confinement trip-wire. Two invariants, one file:
//   (1) NO static `pdfjs-dist` import exists ANYWHERE under `@agent-ui/app`'s src OUTSIDE the ONE
//       designated module, `lib/pdf-worker.ts`.
//   (2) `pdf-worker.ts` itself is reached ONLY via a dynamic `import()` — no OTHER file in the package
//       statically imports it (the lazy-chunk-boundary law: `pdf-extractor.ts`, the FACE-free wrapper,
//       carries ZERO static pdfjs-dist imports and reaches the worker module only via
//       `import('./pdf-worker.ts')`).
// A dynamic `import('pdfjs-dist...')` is deliberately NOT matched — the gate is about STATIC module-graph
// edges (what a bundler pulls eagerly), not the lazy chunk boundary pdf-extractor.ts relies on.

const SRC = `${process.cwd()}/packages/agent-ui/app/src`
const DESIGNATED = 'lib/pdf-worker.ts'

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

/** Static `pdfjs-dist` module-graph edges — every form that pulls the dependency eagerly into a bundle:
 *  `import … from '…'`, a value/type RE-EXPORT `export … from '…'` (a re-export would ALSO drag pdfjs-dist
 *  transitively and evade this gate — the confinement.test.ts precedent's own M4 finding, reused), the
 *  bare side-effect `import '…'`, AND their MULTI-LINE forms. The `from`-clause body uses `[^'";]*?`
 *  (allows newlines, but STOPS at a quote or `;`). A dynamic `import('…')` has a `(` before the quote and
 *  no `from`, so nothing here matches it — exactly the STATIC-only intent. `?url`-suffixed specifiers
 *  (Vite's asset-URL convention, e.g. `'pdfjs-dist/build/pdf.worker.min.mjs?url'`) match too — they are a
 *  real static module-graph edge (an emitted asset reference), just a cheap one; still confined to the ONE
 *  designated module. */
function staticPdfjsSpecifiers(src: string): string[] {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"](pdfjs-dist(?:\/[^'"]+)?)['"]/g
  const bareRe = /\bimport\s+['"](pdfjs-dist(?:\/[^'"]+)?)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

const files = walk(SRC)
  .map((abs) => [abs.slice(SRC.length + 1), abs] as const)
  .filter(([rel]) => !rel.endsWith('.test.ts'))

describe('pdfjs-dist confinement (ADR-0202 cl.4b, the ADR-0139 cl.8b shape)', () => {
  it('anti-vacuous: the walk finds app/src files AND the designated module exists', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(([rel]) => rel === DESIGNATED)).toBe(true)
  })

  it('the designated module DOES statically import pdfjs-dist (the confinement is not vacuous)', () => {
    const worker = files.find(([rel]) => rel === DESIGNATED)!
    const specs = staticPdfjsSpecifiers(readFileSync(worker[1], 'utf8') as string)
    expect(specs.length).toBeGreaterThan(0)
    expect(specs).toContain('pdfjs-dist')
    expect(specs.some((s) => s.startsWith('pdfjs-dist/build/pdf.worker'))).toBe(true)
  })

  it('NO static pdfjs-dist import exists anywhere else in app/src', () => {
    const violations: string[] = []
    for (const [rel, abs] of files) {
      if (rel === DESIGNATED) continue
      const specs = staticPdfjsSpecifiers(readFileSync(abs, 'utf8') as string)
      for (const spec of specs) violations.push(`${rel} -> "${spec}"`)
    }
    expect(violations).toEqual([])
  })

  it('pdf-extractor.ts (the FACE-free wrapper) carries ZERO static pdfjs-dist imports — it reaches the worker via dynamic import only', () => {
    const wrapper = files.find(([rel]) => rel === 'lib/pdf-extractor.ts')!
    const src = readFileSync(wrapper[1], 'utf8') as string
    expect(staticPdfjsSpecifiers(src)).toEqual([])
    expect(src).toMatch(/import\(\s*['"]\.\/pdf-worker\.ts['"]\s*\)/)
  })

  it('pdf-worker.ts is statically imported by NOTHING in app/src — reachable only via the dynamic import (the lazy chunk boundary holds)', () => {
    // STATIC forms only (from-clause / bare side-effect import) — the dynamic `import('./pdf-worker.ts')`
    // in pdf-extractor.ts is the EXPECTED, legitimate reachability path, not a violation of this check.
    const importers: string[] = []
    for (const [rel, abs] of files) {
      const src = readFileSync(abs, 'utf8') as string
      if (/\b(?:import|export)\b[^'";]*?\bfrom\s*['"]\.\/pdf-worker\.ts['"]/.test(src)) importers.push(rel)
    }
    expect(importers).toEqual([])
  })

  it('negative control: the matcher flags a planted static pdfjs-dist import (both import forms, incl. ?url)', () => {
    expect(staticPdfjsSpecifiers(`import { getDocument } from 'pdfjs-dist'\n`)).toEqual(['pdfjs-dist'])
    expect(staticPdfjsSpecifiers(`import 'pdfjs-dist/build/pdf.worker.min.mjs'\n`)).toEqual([
      'pdfjs-dist/build/pdf.worker.min.mjs',
    ])
    expect(staticPdfjsSpecifiers(`import url from 'pdfjs-dist/build/pdf.worker.min.mjs?url'\n`)).toEqual([
      'pdfjs-dist/build/pdf.worker.min.mjs?url',
    ])
  })

  it('negative control: the matcher flags a value/type RE-EXPORT and a MULTI-LINE import', () => {
    expect(staticPdfjsSpecifiers(`export { getDocument } from 'pdfjs-dist'\n`)).toEqual(['pdfjs-dist'])
    expect(staticPdfjsSpecifiers(`export type { PDFDocumentProxy } from 'pdfjs-dist'\n`)).toEqual(['pdfjs-dist'])
    const multiline = `import {\n  getDocument,\n  GlobalWorkerOptions,\n} from 'pdfjs-dist'\n`
    expect(staticPdfjsSpecifiers(multiline)).toEqual(['pdfjs-dist'])
  })

  it('negative control: the matcher does NOT flag a dynamic import, nor span two separate statements', () => {
    expect(staticPdfjsSpecifiers(`const m = await import('pdfjs-dist')\n`)).toEqual([])
    expect(staticPdfjsSpecifiers(`import './local.ts'\nconst x = 1\n`)).toEqual([])
  })
})
