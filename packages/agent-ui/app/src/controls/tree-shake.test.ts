import { describe, it, expect } from 'vitest'

// LLD-C8 (SPEC-R7 AC4) — tree-shake proof for `ui-app-shell`, mirroring
// @agent-ui/components/src/controls/tree-shake.test.ts's static-crawl idiom (same regex, same no-execution
// glob-and-follow approach — a deliberately-bad import is inert text here, never executed). Where that file
// proves each control stays inside its OWN package's layers, this one proves `ui-app-shell` stays inside its
// OWN folder and reaches only its declared cross-PACKAGE dependency (@agent-ui/components) — never
// @agent-ui/a2ui (declared-but-unexercised at M1, fork §7.4) or @agent-ui/shared directly, and never a
// third-party specifier.
//
// This crawl only proves the SOURCE-level shape on the app side of the boundary — it cannot see INTO
// @agent-ui/components' own graph (a bare specifier is an opaque leaf here, per the same convention the
// mirrored file uses for its external set). The complementary REALIZED-BYTES proof — that bundling this
// entry through Rolldown lands close to the components foundation figure (dom+reactive) and nowhere near
// the 23 KB all-controls family figure — is scripts/measure-size.mjs's `@agent-ui/app` line-item.

// '../**/*.ts' from src/controls/ → every production .ts in the package. import.meta.glob keys are relative
// to THIS file's directory (src/controls/), a mix of './app-shell/...' and '../index.ts'; normalise each to
// a src-root-relative path (e.g. 'controls/app-shell/app-shell.ts', 'index.ts') so the crawl can resolve
// relative imports the same way the mirrored file does.
const raw = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const IMPORTER_DIR = 'controls' // this test lives at src/controls/ ⇒ glob keys are relative to 'controls'

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
  // Same regex as the mirrored file (the G7 s12 fix): excluding `'`/`"` from the middle span so a bare
  // `export interface`/`export class` line can't run the non-greedy scan into an unrelated later `from '…'`.
  const fromRe = /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

const sources = new Map<string, string>()
for (const [k, v] of Object.entries(raw)) sources.set(resolveRel(IMPORTER_DIR, k), v)

/** Crawl the transitive relative-import graph from one entry; collect reached modules + external specs. */
const crawl = (entry: string): { reached: Set<string>; external: Set<string> } => {
  const reached = new Set<string>()
  const external = new Set<string>()
  const queue: string[] = [entry]
  while (queue.length) {
    const cur = queue.pop() as string
    if (reached.has(cur)) continue
    reached.add(cur)
    const src = sources.get(cur)
    if (src === undefined) continue // a relative spec resolving outside the .ts glob (e.g. a `?raw` CSS asset)
    for (const spec of specifiersOf(src)) {
      if (spec.startsWith('.')) {
        const target = resolveRel(dirOf(cur), spec)
        if (!reached.has(target)) queue.push(target)
      } else {
        external.add(spec) // any non-relative specifier (a sibling package or a third-party dep)
      }
    }
  }
  return { reached, external }
}

const ENTRY = 'controls/app-shell/app-shell.ts'
const { reached, external } = crawl(ENTRY)

describe('ui-app-shell tree-shake — the entry graph is tight (LLD-C8)', () => {
  it('the glob found the package source and reached the entry (anti-vacuous)', () => {
    expect(sources.size).toBeGreaterThan(0)
    expect(reached.has(ENTRY)).toBe(true)
  })

  it('reaches ONLY its own folder — no sibling control, no descriptor-style tooling', () => {
    const ALLOWED = ['controls/app-shell/']
    for (const p of reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in ui-app-shell graph: ${p}`).toBe(true)
    }
  })

  it('reaches exactly the declared cross-package surface: @agent-ui/components + its two style barrels', () => {
    // The two `?url` style-barrel imports are the isolation-mode fleet-CSS injection (LLD-C5 F1/F3) — a
    // real, deliberate cross-package edge, not a leak. `?raw`-imported LOCAL CSS (app-shell-isolation.css)
    // is a relative spec, already excluded from `external` by the crawl above.
    expect([...external].sort()).toEqual(
      [
        '@agent-ui/components',
        '@agent-ui/components/component-styles.css?url',
        '@agent-ui/components/foundation-styles.css?url',
      ].sort(),
    )
  })

  it('never reaches @agent-ui/a2ui (unexercised at M1) or @agent-ui/shared directly, or any third-party dep', () => {
    for (const spec of external) {
      expect(spec.startsWith('@agent-ui/a2ui'), `unexpected a2ui edge: ${spec}`).toBe(false)
      expect(spec.startsWith('@agent-ui/shared'), `unexpected direct-shared edge: ${spec}`).toBe(false)
      expect(spec.startsWith('@agent-ui/components'), `unexpected non-components external: ${spec}`).toBe(true)
    }
  })

  it('synthetic-violation: the external-set assertion actually flags an extra/unexpected specifier', () => {
    const violatingExternal = new Set([...external, '@agent-ui/a2ui'])
    expect([...violatingExternal].sort()).not.toEqual(
      [
        '@agent-ui/components',
        '@agent-ui/components/component-styles.css?url',
        '@agent-ui/components/foundation-styles.css?url',
      ].sort(),
    )
  })
})
