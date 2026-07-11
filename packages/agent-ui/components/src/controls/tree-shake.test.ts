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
  // No `\n` exclusion (G7 s12 fix): a multi-line destructured import (field.ts's ~8-name clause) previously
  // fell through this regex entirely (only `;`-bounded, single-line clauses matched), silently truncating the
  // crawl at that file. But dropping ONLY the `\n` exclusion re-opens a worse hole in this semicolon-free
  // codebase: a bare `export interface`/`export class` (no `from` clause of its own) would run the non-greedy
  // scan forward, unbounded, into a LATER unrelated `from '…'` sitting inside a comment (caught here on
  // text-field.ts: "switching away from 'password'"). Excluding `'`/`"` from the middle span (real import
  // clauses never contain a quote before their own `from`) closes that: any comment/string quote encountered
  // first aborts the match, so the scan cannot cross into unrelated later code.
  const fromRe = /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g
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

const TEXT_ENTRY = 'controls/text/text.ts'
const txt = crawl(TEXT_ENTRY)
const txtLayers = (prefix: string) => [...txt.reached].filter((p) => p.startsWith(prefix))

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

  it('drags ONLY {controls/text-field, controls/swatch, controls/_token-surface, dom, traits, reactive} — and NOT the sibling ui-button', () => {
    // ADR-0123 LLD-C9 — the type=color leg statically pulls TWO deliberate additions: ui-swatch (a tiny,
    // zero-dep Display-class leaf, so the trailing swatch-button preview renders immediately, before the
    // lazy picker has ever loaded — the ADR-0123 own reasoning) and its own `_token-surface/token-surface.ts`
    // value-lane dependency; the color CODEC (color-picker/color.ts, pure/zero-DOM) is ALSO statically
    // reached (the currency/date/time codec precedent) — but the color-picker CONTROL itself
    // (color-picker/color-picker.ts, the pad/canvas/codec machinery) stays out, via dynamic import() below.
    const ALLOWED = ['controls/text-field/', 'controls/swatch/', 'controls/_token-surface/', 'controls/color-picker/color.ts', 'dom/', 'traits/', 'reactive/']
    for (const p of tf.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in text-field graph: ${p}`).toBe(true)
    }
    // the sibling exclusion, the other direction: text-field's graph reaches no button module (no press-activation).
    expect(tfLayers('controls/button/')).toEqual([])
    expect(tf.reached.has('traits/press-activation.ts')).toBe(false)
    // Wave 5B tree-shake proof: the date picker uses a DYNAMIC import('../calendar/calendar.ts') on
    // first button-click — the static regex crawler cannot match `import()` expressions, so the
    // calendar module is invisible to the graph and `controls/calendar/` stays empty here.
    expect(tfLayers('controls/calendar/')).toEqual([])
    // ADR-0123 LLD-C9 — the SAME dynamic-import proof for the color-picker CONTROL: the swatch button's
    // FIRST activation lazily import()s color-picker.ts — the static crawl never reaches it, so ONLY
    // color.ts (the pure codec, statically imported for the codec wiring) shows up under this folder.
    expect(tfLayers('controls/color-picker/')).toEqual(['controls/color-picker/color.ts'])
  })

  it('does NOT drag the descriptor tooling, and pulls ONLY @agent-ui/icons as its non-relative import', () => {
    expect(tfLayers('descriptor/')).toEqual([])
    // Phosphor-icon sweep: text-field injects setIcon(...) glyphs (magnifier / x / eye / eye-slash /
    // calendar-blank / caret-up / caret-down) via the swappable icon adapter — the ONE deliberate
    // external edge, mirroring components → @agent-ui/shared (ADR-0065/0066; layering.test.ts already
    // allowlists both lower-tier siblings). It imports the root `@agent-ui/icons` barrel only (never the
    // `/phosphor` subpath), so it drags zero Phosphor bytes itself — just resolve/registry/types, the
    // same subpath-hygiene ui-icon's own graph relies on.
    expect([...tf.external]).toEqual(['@agent-ui/icons'])
  })
})

// ── ui-text (ADR-0025) — a Display-class leaf (extends UIElement directly; no form base, no surface base,
//    no traits). Its graph is {controls/text, dom, reactive} — like a layout primitive, but even tighter
//    (no UIContainerElement surface base). Importing ui-text drags only its own folder + the dom/reactive
//    kernel — zero trait, zero sibling control, zero descriptor tooling.

describe('ui-text tree-shake — Display-class leaf drags only itself + the dom/reactive kernel (ADR-0025)', () => {
  it('reached the entry with a real dep set (anti-vacuous)', () => {
    expect(txt.reached.has(TEXT_ENTRY)).toBe(true)
    expect(txt.reached.size).toBeGreaterThan(2) // text drags dom + reactive — not nothing
  })

  it('reaches its REAL deps: the dom layer (UIElement) and the reactive kernel', () => {
    expect(txt.reached.has('dom/index.ts')).toBe(true)
    expect(txtLayers('reactive/').length).toBeGreaterThan(0)
  })

  it('drags ONLY {controls/text, dom, reactive} — no trait, no sibling control, no surface base', () => {
    const ALLOWED = ['controls/text/', 'dom/', 'reactive/']
    for (const p of txt.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in text graph: ${p}`).toBe(true)
    }
    // no sibling controls — button, text-field, and the G9 family are not reachable from ui-text
    expect(txtLayers('controls/button/')).toEqual([])
    expect(txtLayers('controls/text-field/')).toEqual([])
    expect(new Set(txtLayers('controls/').map((p) => p.split('/')[1]))).toEqual(new Set(['text']))
    expect(txtLayers('traits/')).toEqual([]) // a Display leaf composes no trait
  })

  it('does NOT drag the descriptor tooling, and pulls ZERO non-relative imports', () => {
    expect(txtLayers('descriptor/')).toEqual([])
    expect([...txt.external]).toEqual([])
  })
})

// ── G9 container family (s12) — each container extends the dom UIContainerElement surface base (no trait), so
//    its graph is {controls/{family}, dom, reactive}. The headline tree-shake property: importing ONE container
//    drags only IT + UIContainerElement + dom/reactive, and NOT a sibling container family. A COMPOUND (ui-card)
//    additionally drags its OWN region sub-elements (the transitive self-define) — but still no sibling family.

const ROW_ENTRY = 'controls/row/row.ts'
const row = crawl(ROW_ENTRY)
const rowLayers = (prefix: string) => [...row.reached].filter((p) => p.startsWith(prefix))

const CARD_ENTRY = 'controls/card/card.ts'
const card = crawl(CARD_ENTRY)
const cardLayers = (prefix: string) => [...card.reached].filter((p) => p.startsWith(prefix))

describe('ui-row tree-shake — a layout primitive drags only itself + the surface base (s12)', () => {
  it('reached the entry with a real dep set, including the dom UIContainerElement surface base', () => {
    expect(row.reached.has(ROW_ENTRY)).toBe(true)
    expect(row.reached.has('dom/container.ts')).toBe(true) // the shared surface base it extends
    expect(rowLayers('reactive/').length).toBeGreaterThan(0)
  })

  it('drags ONLY {controls/row, dom, reactive} — no trait, no sibling container, no descriptor tooling', () => {
    const ALLOWED = ['controls/row/', 'dom/', 'reactive/']
    for (const p of row.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in row graph: ${p}`).toBe(true)
    }
    expect(rowLayers('traits/')).toEqual([]) // a pure layout primitive composes no trait
    expect(rowLayers('descriptor/')).toEqual([])
    // the sibling-family exclusion: row's graph reaches no OTHER container folder (column/list/grid/card/tabs/modal)
    expect(new Set(rowLayers('controls/').map((p) => p.split('/')[1]))).toEqual(new Set(['row']))
    expect([...row.external]).toEqual([]) // zero non-relative imports
  })
})

describe('ui-card tree-shake — a compound drags its OWN regions but no sibling family (s12)', () => {
  it('reaches its three region sub-elements (the transitive self-define) + the surface base', () => {
    expect(card.reached.has('controls/card/card-header.ts')).toBe(true)
    expect(card.reached.has('controls/card/card-content.ts')).toBe(true)
    expect(card.reached.has('controls/card/card-footer.ts')).toBe(true)
    expect(card.reached.has('dom/container.ts')).toBe(true)
  })

  it('drags ONLY {controls/card, dom, reactive, traits/scroll-fade} — its own regions, and NOT a sibling container family', () => {
    // REVISED 2026-07-04 (the gutter-exposure fix): ui-card-content now wires traits/scroll-fade.ts for its
    // `scroll-fade` opt-in (previously a pure-CSS hook, zero traits) — a real, deliberate graph addition, not
    // a leak. Pinned to the ONE trait file, not traits/ wholesale, so a future unrelated trait import here
    // would still be caught.
    const ALLOWED = ['controls/card/', 'dom/', 'reactive/', 'traits/scroll-fade.ts']
    for (const p of card.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in card graph: ${p}`).toBe(true)
    }
    // only the card family — no row/column/list/grid/tabs/modal sibling is pulled in.
    expect(new Set(cardLayers('controls/').map((p) => p.split('/')[1]))).toEqual(new Set(['card']))
    expect(cardLayers('traits/')).toEqual(['traits/scroll-fade.ts']) // anti-vacuous: exactly the one trait, not the whole layer
    expect(cardLayers('descriptor/')).toEqual([])
    expect([...card.external]).toEqual([])
  })
})

// ── ui-field / ui-form-provider (G7, s12) — the LLD-C1 tree-shake pin: field.ts imports dom ONLY (no
//    registry, no provider trait); form-provider.ts imports dom + traits/form-registry.ts. Neither imports
//    the other, so importing one control must not drag the other's graph.

const FIELD_ENTRY = 'controls/field/field.ts'
const field = crawl(FIELD_ENTRY)
const fieldLayers = (prefix: string) => [...field.reached].filter((p) => p.startsWith(prefix))

const FORM_PROVIDER_ENTRY = 'controls/form-provider/form-provider.ts'
const formProvider = crawl(FORM_PROVIDER_ENTRY)
const formProviderLayers = (prefix: string) => [...formProvider.reached].filter((p) => p.startsWith(prefix))

describe('ui-field tree-shake — dom only, no form-registry trait, no form-provider (G7 s12)', () => {
  it('reaches its real deps: dom + reactive, and composes NO trait', () => {
    expect(field.reached.has(FIELD_ENTRY)).toBe(true)
    expect(field.reached.has('dom/index.ts')).toBe(true)
    expect(fieldLayers('reactive/').length).toBeGreaterThan(0)
    expect(fieldLayers('traits/')).toEqual([]) // the field never invokes formRegistry — that's the provider's job
  })

  it('drags ONLY {controls/field, dom, reactive} — NOT ui-form-provider or its registry trait', () => {
    const ALLOWED = ['controls/field/', 'dom/', 'reactive/']
    for (const p of field.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in field graph: ${p}`).toBe(true)
    }
    expect(fieldLayers('controls/form-provider/')).toEqual([])
    expect(field.reached.has('traits/form-registry.ts')).toBe(false)
    expect([...field.external]).toEqual([])
  })
})

describe('ui-form-provider tree-shake — dom + form-registry trait, NOT ui-field (G7 s12)', () => {
  it('reaches its real deps: dom + reactive + the form-registry controller', () => {
    expect(formProvider.reached.has(FORM_PROVIDER_ENTRY)).toBe(true)
    expect(formProvider.reached.has('dom/index.ts')).toBe(true)
    expect(formProvider.reached.has('traits/form-registry.ts')).toBe(true)
    expect(formProviderLayers('reactive/').length).toBeGreaterThan(0)
  })

  it('drags ONLY {controls/form-provider, dom, traits/form-registry, reactive} — NOT ui-field', () => {
    const ALLOWED = ['controls/form-provider/', 'dom/', 'traits/', 'reactive/']
    for (const p of formProvider.reached) {
      expect(ALLOWED.some((a) => p.startsWith(a)), `unexpected module in form-provider graph: ${p}`).toBe(true)
    }
    expect(new Set(formProviderLayers('traits/'))).toEqual(new Set(['traits/form-registry.ts']))
    expect(formProviderLayers('controls/field/')).toEqual([])
    expect([...formProvider.external]).toEqual([])
  })
})
