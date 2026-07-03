import { describe, it, expect } from 'vitest'

// Trip-wire: the layer-dependency direction inside @agent-ui/components. Every production .ts under
// src/ is read as raw text (no execution) and its imports are checked against the layering law —
//   reactive(0) ← dom(1) ← traits(2) ← controls(3) ← barrel(4)
// A file may import only from its own or a LOWER layer; the only non-relative imports allowed are the
// sibling packages @agent-ui/shared (tokens/styles/utils) and @agent-ui/icons (the icon adapter,
// ADR-0065/0066 — components → icons, inward, mirroring components → shared). Vacuously green until
// the layers have code; it bites from the first file that imports upward or pulls a third-party
// dependency, or a future sibling that isn't a deliberate ADR-reviewed allowlist addition.
const raw = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const LAYERS: ReadonlyArray<readonly [string, number]> = [
  ['reactive/', 0],
  ['dom/', 1],
  ['traits/', 2],
  ['controls/', 3],
]
const layerOf = (path: string): number => {
  for (const [prefix, n] of LAYERS) if (path.startsWith(prefix)) return n
  return 4 // root barrel / tokens
}

const dirOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const resolveRel = (fromDir: string, spec: string): string => {
  const parts = fromDir ? fromDir.split('/') : []
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue
    else if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

const specifiersOf = (src: string): string[] => {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

describe('import layering', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('every src file imports only its own or a lower layer; no third-party deps', () => {
    expect(files.length).toBeGreaterThan(0) // anti-vacuous: the glob must actually find the package's files
    const violations: string[] = []
    for (const [path, src] of files) {
      const lf = layerOf(path)
      for (const spec of specifiersOf(src)) {
        if (spec.startsWith('.')) {
          const li = layerOf(resolveRel(dirOf(path), spec))
          if (li > lf) violations.push(`${path} (L${lf}) -> ${spec} (L${li}): upward import`)
        } else if (
          spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/') ||
          spec === '@agent-ui/icons' || spec.startsWith('@agent-ui/icons/')
        ) {
          // allowed: the two lower-tier sibling packages
        } else {
          violations.push(`${path} -> "${spec}": external import (only @agent-ui/shared/@agent-ui/icons + zero third-party deps)`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
