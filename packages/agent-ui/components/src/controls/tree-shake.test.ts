import { describe, it, expect } from 'vitest'

// Phase-1 s17 — tree-shake proof (ADR-0003 / process.md §1 size+tree-shake gate). Statically crawl the
// transitive import graph of the gold control's entry (controls/button/button.ts) over the package source
// and assert it stays TIGHT: it reaches only its REAL deps — the dom + reactive layers and the
// press-activation trait — and drags NONE of the package's unrelated modules (the descriptor tooling,
// any sibling control), nor any other package (@agent-ui/a2ui), nor any third-party dependency. The
// runtime BUNDLE assertion is `npm run size` (the components barrel bundles within budget via Rolldown);
// this probe pins the import-graph SHAPE deterministically, no bundler.
//
// The "doesn't drag a sibling control" exclusion is now LIVE — ui-text-field is the second control (G6), so
// each control's graph is crawled separately and asserted to reach NEITHER the other control NOR the
// descriptor tooling. (No control imports another; the only shared modules are the dom + reactive layers and
// the traits each one composes.)

// '../**/*.ts' from src/controls/ → every production .ts in the package. import.meta.glob keys are relative
// to THIS file's directory (src/controls/), a mix of './button/...' and '../dom/...'; we normalise each to a
// src-root-relative path (e.g. 'controls/button/button.ts', 'dom/index.ts') so the crawl can resolve imports.
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
  const fromRe = /\b(?:import|export)\b[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

const sources = new Map<string, string>()
for (const [k, v] of Object.entries(raw)) sources.set(resolveRel(IMPORTER_DIR, k), v)

/** Crawl the transitive relative-import graph from one control entry; collect reached modules + external specs. */
const crawl = (entry: string): { reached: Set<string>; external: Set<string> } => {
  const reached = new Set<string>()
  const external = new Set<string>()
  const queue: string[] = [entry]
  while (queue.length) {
    const cur = queue.pop() as string
    if (reached.has(cur)) continue
    reached.add(cur)
    const src = sources.get(cur)
    if (src === undefined) continue // a relative spec that resolved outside the glob — treated as unreachable
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

const ENTRY = 'controls/button/button.ts'
const { reached, external } = crawl(ENTRY)
const layers = (prefix: string) => [...reached].filter((p) => p.startsWith(prefix))

const TF_ENTRY = 'controls/text-field/text-field.ts'
const tf = crawl(TF_ENTRY)
const tfLayers = (prefix: string) => [...tf.reached].filter((p) => p.startsWith(prefix))

describe('ui-button tree-shake — the entry graph is tight (s17)', () => {
  it('the glob found the package source and reached the entry (anti-vacuous)', () => {
    expect(sources.size).toBeGreaterThan(10)
    expect(reached.has(ENTRY)).toBe(true)
    expect(reached.size).toBeGreaterThan(3) // button drags a real, non-trivial dep set — not nothing
  })

  it('reaches its REAL deps: the dom + reactive layers and the press-activation trait', () => {
    expect(reached.has('dom/index.ts')).toBe(true)
    expect(reached.has('traits/press-activation.ts')).toBe(true)
    expect(layers('reactive/').length).toBeGreaterThan(0)
  })

  it('drags ONLY {controls/button, dom, traits, reactive} — and NOT the sibling ui-text-field', () => {
    const ALLOWED = ['controls/button/', 'dom/', 'traits/', 'reactive/']
    for (const p of reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in button graph: ${p}`).toBe(true)
    }
    // the sibling-control exclusion, now live with a second control: button's graph reaches no text-field module.
    expect(layers('controls/text-field/')).toEqual([])
    expect(new Set(layers('controls/').map((p) => p.split('/')[1]))).toEqual(new Set(['button']))
  })

  it('does NOT drag the descriptor tooling (a real same-package non-dep)', () => {
    expect(layers('descriptor/')).toEqual([])
  })

  it('pulls ZERO non-relative imports — no @agent-ui/a2ui, no @agent-ui/shared in JS, no third-party', () => {
    expect([...external]).toEqual([])
  })
})

// ── ui-text-field (the second control, G6 s12) — the same tightness, now with the sibling exclusion LIVE ──

describe('ui-text-field tree-shake — the entry graph is tight (s12)', () => {
  it('the glob reached the text-field entry with a real, non-trivial dep set (anti-vacuous)', () => {
    expect(tf.reached.has(TF_ENTRY)).toBe(true)
    expect(tf.reached.size).toBeGreaterThan(3) // text-field drags the form base + the trait + dom + reactive
  })

  it('reaches its REAL deps: the dom layer + the UIFormElement base + the trackUserInvalid trait + reactive', () => {
    expect(tf.reached.has('dom/index.ts')).toBe(true)
    expect(tf.reached.has('dom/form.ts')).toBe(true) // the UIFormElement form-associated base (s1)
    expect(tf.reached.has('traits/track-user-invalid.ts')).toBe(true) // the user-invalid timing controller (s2)
    expect(tfLayers('reactive/').length).toBeGreaterThan(0)
  })

  it('drags ONLY {controls/text-field, dom, traits, reactive} — and NOT the sibling ui-button', () => {
    const ALLOWED = ['controls/text-field/', 'dom/', 'traits/', 'reactive/']
    for (const p of tf.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in text-field graph: ${p}`).toBe(true)
    }
    // the sibling exclusion, the other direction: text-field's graph reaches no button module (no press-activation).
    expect(tfLayers('controls/button/')).toEqual([])
    expect(tf.reached.has('traits/press-activation.ts')).toBe(false)
  })

  it('does NOT drag the descriptor tooling, and pulls ZERO non-relative imports', () => {
    expect(tfLayers('descriptor/')).toEqual([])
    expect([...tf.external]).toEqual([])
  })
})
