// index.test.ts — the corpus core barrel's wave-integration gate (corpus LLD §12 s10, ADR-0062).
//
// Three legs: (1) the barrel's named public surface resolves to real functions; (2) that surface is
// actually WIRED — a candidate flows record→heal→canonicalize→store→admit→retrieve→export using ONLY
// symbols imported from `./index.ts` (never a module's own file directly); (3) the root-barrel purity
// proof — no module under `src/` outside `src/corpus/` itself ever imports from `corpus/`, so a
// `@agent-ui/a2ui` (root) consumer's bundle is provably reachable-free of every corpus module (the
// `"./examples"` precedent, ADR-0055 clause 3 / ADR-0062 clause 4).
//
// Test-only use of `node:fs` (never ships — the `store.test.ts`/`corpus-data.test.ts` self-grep
// precedent; the pure core under `src/corpus/` stays node-free, SPEC-N5/ADR-0062).

import { describe, it, expect } from 'vitest'
import * as corpus from './index.ts'
import { demoCatalog } from '../fixtures.ts'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

declare const process: { cwd(): string }

const REPO_ROOT = process.cwd()
const PKG_DIR = `${REPO_ROOT}/packages/agent-ui/a2ui`
const SRC_DIR = `${PKG_DIR}/src`

describe('the corpus core barrel — public surface (LLD §12, ADR-0062)', () => {
  it('exposes the named pure-core surface as callable functions', () => {
    expect(corpus.validateRecord).toBeTypeOf('function')
    expect(corpus.canonicalize).toBeTypeOf('function')
    expect(corpus.heal).toBeTypeOf('function')
    expect(corpus.createStore).toBeTypeOf('function')
    expect(corpus.createDedupIndex).toBeTypeOf('function') // needed to construct AdmitDeps — no external caller can wire admit() without it
    expect(corpus.admit).toBeTypeOf('function')
    expect(corpus.retrieve).toBeTypeOf('function')
    expect(corpus.exportCatalogExamples).toBeTypeOf('function')
    expect(corpus.exportFineTune).toBeTypeOf('function')
    expect(corpus.validateA2ui).toBeTypeOf('function') // the re-exported shared validator (LLD-C6)
    expect(corpus.parseVerdictsFile).toBeTypeOf('function') // the ADR-0068 verdict adapter (LLD-C8)
    expect(corpus.createVerdictJudge).toBeTypeOf('function')
  })

  it('wires a candidate through record→heal→canonicalize→store→admit→retrieve→export using ONLY the barrel\'s exports', async () => {
    const candidate = {
      name: 'barrel-smoke',
      description: 'a barrel-wired smoke candidate',
      promptText: 'build me a button',
      a2uiOutput: [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Button', label: 'Click me' }] },
        },
      ],
      meta: {
        facet: 'exemplar',
        protocolVersion: 'v1.0',
        catalogId: 'demo',
        provenance: { source: 'authored', origin: 'index.test.ts' },
      },
    }

    const store = corpus.createStore()
    const dedupIndex = corpus.createDedupIndex()
    const result = await corpus.admit(candidate, { catalog: demoCatalog, store, dedupIndex })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.meta.status).toBe('valid')
    expect(store.get('barrel-smoke')).toEqual(result.record)

    const scope = { catalogId: 'demo', protocolVersion: 'v1.0' }
    const found = corpus.retrieve(store.all(scope), { intent: 'a button', k: 5, ...scope })
    expect(found.map((r) => r.name)).toContain('barrel-smoke')

    const files = corpus.exportCatalogExamples(store.all(), scope)
    expect(files.some((f) => f.name === 'barrel-smoke')).toBe(true)

    const jsonl = corpus.exportFineTune(store.all(), { protocolVersion: 'v1.0' })
    expect(jsonl.some((line) => JSON.parse(line).prompt === 'build me a button')).toBe(true)
  })
})

describe('package.json wiring — the "./corpus" subpath (ADR-0062)', () => {
  const pkg = JSON.parse(readFileSync(`${PKG_DIR}/package.json`, 'utf8') as string) as { exports: Record<string, string> }

  it('exports "./corpus" pointing at src/corpus/index.ts', () => {
    expect(pkg.exports['./corpus']).toBe('./src/corpus/index.ts')
  })

  it('every export target (".", "./examples", "./corpus") resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG_DIR}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })
})

describe('root-barrel purity — zero corpus bytes reachable from `@agent-ui/a2ui` (ADR-0062, the "./examples" precedent)', () => {
  it('the root barrel source (src/index.ts) never mentions corpus', () => {
    const source = readFileSync(`${SRC_DIR}/index.ts`, 'utf8') as string
    expect(source).not.toMatch(/corpus/i)
  })

  it('no module under src/ (outside src/corpus/ itself) imports anything from corpus — a grep proof over the whole tree', () => {
    const CORPUS_IMPORT_RE = /from\s+['"](?:[^'"]*\/corpus\/|@agent-ui\/a2ui\/corpus)/

    function walk(dir: string): string[] {
      const files: string[] = []
      for (const entry of readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (full === `${SRC_DIR}/corpus`) continue // corpus's own internal relative imports are legitimate
          files.push(...walk(full))
        } else if (entry.name.endsWith('.ts')) {
          files.push(full)
        }
      }
      return files
    }

    const offenders: string[] = []
    for (const file of walk(SRC_DIR)) {
      const text = readFileSync(file, 'utf8') as string
      if (CORPUS_IMPORT_RE.test(text)) offenders.push(file)
    }

    expect(offenders, `these non-corpus modules import from corpus: ${offenders.join(', ')}`).toEqual([])
  })
})

describe('src/corpus/* stays a platform-neutral pure core — no node:*/third-party imports (ADR-0062 acceptance)', () => {
  it('every non-test module under src/corpus/ imports only relative paths (never node:* or a bare package specifier)', () => {
    const CORPUS_DIR = `${SRC_DIR}/corpus`
    const IMPORT_SPEC_RE = /from\s+['"]([^'"]+)['"]/g

    const offenders: Array<{ file: string; spec: string }> = []
    for (const entry of readdirSync(CORPUS_DIR, { withFileTypes: true }) as Array<{ name: string; isFile(): boolean }>) {
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue
      const file = `${CORPUS_DIR}/${entry.name}`
      const text = readFileSync(file, 'utf8') as string
      for (const match of text.matchAll(IMPORT_SPEC_RE)) {
        const spec = match[1]
        if (!spec.startsWith('.')) offenders.push({ file: entry.name, spec })
      }
    }

    expect(offenders, JSON.stringify(offenders)).toEqual([])
  })
})
