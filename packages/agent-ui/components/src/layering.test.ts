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

// `(?<![`'"])` (a real import/export keyword is never itself the CONTENT of a string/template literal —
// only a data value like `codecRaw.get('import')` or generated-text like `` `import { x } from '${spec}'` ``
// puts the word "import" directly after an opening quote/backtick) and `(?!\s*:)` (an object-literal
// property KEY named `import`/`export`, e.g. `{ import: './x.ts' }`, is never a module statement either)
// both close real false-positive classes ADR-0173's descriptor/generator work surfaced —
// component-descriptor.ts's `CodecRef` reads a genuine `'import'`-keyed Map entry, and generate-props.ts
// builds import-statement TEXT as generated output. Neither guard weakens real detection: a genuine
// `import … from '…'`/`import '…'` statement is never itself inside a string/template literal and never
// has `:` immediately after the keyword.
const specifiersOf = (src: string): string[] => {
  const out: string[] = []
  const fromRe = /(?<![`'"])\b(?:import|export)\b(?!\s*:)[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /(?<![`'"])\bimport\b(?!\s*:)\s*['"]([^'"]+)['"]/g
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

  // ADR-0200 clause 1 — "every existing inward layering trip-wire extends its scan by one package name"
  // (the ADR-0192 extension law applied to the devtools mint): the allowlist in the gate above admits
  // ONLY @agent-ui/shared, @agent-ui/icons and local paths, so @agent-ui/devtools (the harness at the
  // DAG top) is excluded by construction — this named negative control makes the fence explicit and
  // exercises the same allowlist shape the real gate runs. Assembled at runtime (never a literal
  // devtools string) — devtools/src/layering.test.ts's own inward-scan reads components/src as raw text
  // INCLUDING test files.
  it('synthetic-violation: an @agent-ui/devtools specifier is neither local nor an allowed lower-tier sibling (ADR-0200)', () => {
    const devtoolsSpecifier = ['@agent-ui', 'devtools'].join('/')
    const specs = specifiersOf(`import { recordTurn } from '${devtoolsSpecifier}'\n`)
    expect(specs).toEqual([devtoolsSpecifier])
    const allowed = specs.filter(
      (spec) =>
        spec.startsWith('.') ||
        spec === '@agent-ui/shared' || spec.startsWith('@agent-ui/shared/') ||
        spec === '@agent-ui/icons' || spec.startsWith('@agent-ui/icons/'),
    )
    expect(allowed).toEqual([])
  })

  it('specifiersOf still finds every real import/export shape, and no longer misfires on a string-literal VALUE or an object-literal KEY that happens to spell "import"/"export" (ADR-0173 false-positive classes)', () => {
    expect(specifiersOf(`import { x } from './y.ts'`)).toEqual(['./y.ts']) // real named import
    expect(specifiersOf(`export { x } from './y.ts'`)).toEqual(['./y.ts']) // real re-export
    expect(specifiersOf(`import './y.ts'`)).toEqual(['./y.ts']) // real side-effect import
    // a Map read keyed by the literal string 'import' (component-descriptor.ts's real CodecRef shape)
    expect(specifiersOf(`const v = m.get('import')`)).toEqual([])
    // an object-literal property KEY named `import` (the codec: { import, name } grammar shape)
    expect(specifiersOf(`const c = { import: './x.ts', name: 'y' }`)).toEqual([])
    // generated-text TEMPLATE LITERAL content that spells out an import statement as a STRING VALUE
    // (generate-props.ts building `{name}.props.gen.ts` source text, not a real import of its own)
    expect(specifiersOf("const line = `import { x } from '${spec}'`")).toEqual([])
  })
})
