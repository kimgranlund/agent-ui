import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from '../descriptor/component-descriptor.ts'
import type { ParsedDescriptor } from '../descriptor/component-descriptor.ts'
// Read every fence/source as TEXT (vite strips `.md?raw`/`.css?raw`; no `@types/node` devDep — same approach
// as the s6/s7/s8 probes + file-set.test.ts/barrels.test.ts).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
declare const process: { cwd(): string }

// family-coherence.test.ts — G8 T6, the standing cross-family gate (ADR-0081). Every OTHER test in this tree
// checks ONE control against its OWN contract; this file is the one place that checks the WHOLE FLEET against
// EACH OTHER + the shared vocabulary, so control #27 cannot mint a `size` enum of `small/large`, an event named
// `ui-change`, or a stylesheet that reaches into another control's tokens without a red test the day it lands.
//
// Three invariant groups (ADR-0081 Decision cl.1), nine invariants (A1·A2·A2b·A3·A4·B·C1·C2·C3), each asserted
// over the LIVE fleet AND proven to bite via a synthetic-violation NEGATIVE CONTROL (a string-level fixture
// built in this file — never a real control edit):
//   A. API      — events ⊆ the family vocabulary (A1, with the ADR-0081 Amendment 2 pure-activation `click`
//                 carve-out); a `size` enum ≡ [sm,md,lg] (A2); a CSS `[size` selector always pairs with a
//                 declared `size` attribute — the inverse of A2 (A2b); `extends` ∈ the sanctioned base ladder
//                 (A3); the descriptor exists and tag↔class↔folder naming is aligned (A4).
//   B. Tokens   — a `{name}.css` `:where(ui-{name})` block declares only its own `--ui-{name}-*` (∪ the shared
//                 allowlist); every consumed custom property is likewise its own ∪ shared — no cross-control reach.
//   C. Lifecycle — every descriptor is exported from `controls/index.ts` AND imported by `component-styles.css`;
//                 every control with an `open` attribute declares the two-way `toggle`+`close` pair (ADR-0019).
// This is a TEXT-level gate (ADR-0081's own scope cut) — the browser smokes remain the rendering truth.

const ROOT = process.cwd()
const COMPONENTS = `${ROOT}/packages/agent-ui/components`
const CONTROLS = `${COMPONENTS}/src/controls`
const SHARED = `${ROOT}/packages/agent-ui/shared/src/tokens`
const read = (path: string): string => readFileSync(path, 'utf8') as string

// ── fleet discovery ──────────────────────────────────────────────────────────────────────────────────────
// A "control" is identified by its `{name}.md` descriptor (ADR-0004), NOT its folder — `radio/` holds TWO
// (radio.md + radio-group.md); every other folder holds exactly one. Leading-underscore folders (`_surface/`,
// `_base/`) are shared assets, not controls (the file-set.test.ts precedent) — excluded here too.

interface FleetControl {
  folder: string
  name: string
  mdPath: string
  tsPath: string
  cssPath: string
}

const folders: string[] = readdirSync(CONTROLS).filter(
  (e: string) => !e.startsWith('_') && statSync(`${CONTROLS}/${e}`).isDirectory(),
)

const FLEET: FleetControl[] = folders.flatMap((folder: string) => {
  const files: string[] = readdirSync(`${CONTROLS}/${folder}`)
  return files
    .filter((f: string) => f.endsWith('.md'))
    .map((mdFile: string) => {
      const name = mdFile.slice(0, -3)
      return {
        folder,
        name,
        mdPath: `${CONTROLS}/${folder}/${mdFile}`,
        tsPath: `${CONTROLS}/${folder}/${name}.ts`,
        cssPath: `${CONTROLS}/${folder}/${name}.css`,
      }
    })
})

const FLEET_NAMES = new Set(FLEET.map((c) => c.name))
const FLEET_PAIRS = new Set(FLEET.map((c) => `${c.folder}/${c.name}`))

// Parse every descriptor ONCE (reused across every invariant group below).
const DESCRIPTORS = new Map<string, ParsedDescriptor>(
  FLEET.map((c) => {
    const { fence } = splitFrontmatter(read(c.mdPath))
    return [c.name, parseDescriptor(fence)]
  }),
)

/** Every `name:` value inside a sequence field (events[]/attributes[]/slots[] all share this shape). */
function fieldNames(d: ParsedDescriptor, field: string): string[] {
  const out: string[] = []
  for (const item of d.sequences.get(field) ?? []) {
    const n = item.get('name')
    if (typeof n === 'string') out.push(n)
  }
  return out
}

describe('family-coherence — fleet discovery (T6, ADR-0081)', () => {
  it('finds the whole live fleet, including the one folder holding TWO descriptors (anti-vacuous)', () => {
    expect(FLEET.length).toBeGreaterThan(20)
    expect(FLEET_NAMES.has('button')).toBe(true)
    expect(FLEET_NAMES.has('radio')).toBe(true)
    expect(FLEET_NAMES.has('radio-group')).toBe(true) // radio/ holds radio.md AND radio-group.md
  })
})

// ── A1. API — events ⊆ the family vocabulary (plan §9 / ADR-0081 cl.1, Amendment 2 pure-activation carve-out) ──
// Amendment 2 (Kim-ratified): `click` is allowed OUTSIDE the six-name vocabulary for a control that is (a) NOT
// form-associated (`extends: UIElement`) AND (b) declares ONLY `click` in its events[] — native-parity
// activation with no synthetic event of its own (`pressActivation` calls the platform `host.click()`). A
// control mixing `click` with any other event, or any form-associated control, does NOT qualify — `click`
// stays out-of-vocabulary for those (button.md is the one live control that qualifies today).

const ALLOWED_EVENTS = new Set(['change', 'input', 'select', 'open', 'close', 'toggle'])

const isPureActivation = (d: ParsedDescriptor): boolean =>
  d.scalars.get('extends') === 'UIElement' &&
  fieldNames(d, 'events').every((n) => n === 'click')

const outOfVocabEvents = (d: ParsedDescriptor): string[] =>
  fieldNames(d, 'events').filter((n) => !(ALLOWED_EVENTS.has(n) || (n === 'click' && isPureActivation(d))))

describe('API — events vocabulary (plan §9, ADR-0081 Amendment 2)', () => {
  for (const c of FLEET) {
    it(`${c.name}.md events ⊆ {change,input,select,open,close,toggle} (∪ click iff pure-activation)`, () => {
      const bad = outOfVocabEvents(DESCRIPTORS.get(c.name)!)
      expect(bad, `${c.name}.md declares out-of-vocabulary event(s): ${bad.join(', ')}`).toEqual([])
    })
  }

  it('negative control: a synthetic out-of-vocabulary event name is caught', () => {
    const fence = [
      'tag: ui-widget',
      'events:',
      '  - name: change',
      "    detail: 'null'",
      '  - name: ui-change', // the planted defect — a `ui-`-prefixed compound, exactly what plan §9 bans
      "    detail: 'null'",
    ].join('\n')
    expect(outOfVocabEvents(parseDescriptor(fence))).toEqual(['ui-change'])
  })

  it('negative control: `click` mixed with another event does NOT qualify as pure-activation (still flagged)', () => {
    const fence = [
      'tag: ui-widget',
      'extends: UIElement',
      'events:',
      '  - name: click',
      "    detail: 'null'",
      '  - name: change',
      "    detail: 'null'",
    ].join('\n')
    expect(outOfVocabEvents(parseDescriptor(fence))).toEqual(['click'])
  })

  it('negative control: a form-associated control declaring `click` never qualifies (still flagged)', () => {
    const fence = [
      'tag: ui-widget',
      'extends: UIFormElement',
      'events:',
      '  - name: click',
      "    detail: 'null'",
    ].join('\n')
    expect(outOfVocabEvents(parseDescriptor(fence))).toEqual(['click'])
  })

  it('anti-vacuous: the real button.md (UIElement, events ≡ [click]) passes as pure-activation', () => {
    expect(outOfVocabEvents(DESCRIPTORS.get('button')!)).toEqual([])
  })
})

// ── A2. API — a `size` attribute's enum ≡ [sm, md, lg] ──────────────────────────────────────────────────────

const SIZE_ENUM = ['sm', 'md', 'lg']
const sizeEnumDefect = (d: ParsedDescriptor): string | null => {
  const size = d.attributes.find((a) => a.name === 'size')
  if (size === undefined) return null // no `size` attribute on this control — nothing to check
  const values = size.values ?? []
  const same = values.length === SIZE_ENUM.length && SIZE_ENUM.every((v) => values.includes(v))
  return same ? null : `size values [${values.join(', ')}] != [${SIZE_ENUM.join(', ')}]`
}

describe('API — a `size` attribute is always exactly [sm, md, lg]', () => {
  const sized = FLEET.filter((c) => DESCRIPTORS.get(c.name)!.attributes.some((a) => a.name === 'size'))

  it('finds the sized controls to check (anti-vacuous)', () => {
    expect(sized.length).toBeGreaterThan(0)
    expect(sized.map((c) => c.name)).toContain('button')
  })

  for (const c of sized) {
    it(`${c.name}.md's size enum ≡ [sm, md, lg]`, () => {
      expect(sizeEnumDefect(DESCRIPTORS.get(c.name)!)).toBeNull()
    })
  }

  it('negative control: a `size` enum of [small, large] is caught', () => {
    const fence = [
      'attributes:',
      '  - name: size',
      '    type: enum',
      '    values: [small, large]',
      '    default: small',
      '    reflect: true',
    ].join('\n')
    expect(sizeEnumDefect(parseDescriptor(fence))).not.toBeNull()
  })

  it('negative control: a `size` attribute is not flagged when absent (no false positive)', () => {
    expect(sizeEnumDefect(parseDescriptor('tag: ui-widget'))).toBeNull()
  })
})

// ── A2b. API — the INVERSE of A2: a CSS `[size` selector always pairs with a declared `size` attribute ───────
// A2 only checks controls that DECLARE `size` — it cannot see a control whose CSS repoints geometry via
// `[size='sm'/'lg']` attribute selectors while the descriptor (and therefore `static props`) never declares
// the axis at all. That is exactly how ui-select's T7 drift hid (ADR-0081 doc-tail): select.css shipped the
// `[size]` ramp with no size prop/attribute to drive it — dead CSS, no API. This is the missing half.

// Strip `/* … */` comments first — several controls deliberately DOCUMENT their absence of a [size] axis
// in prose ("no [size] ramp"), which would otherwise false-positive this selector-only check.
const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')
const hasSizeSelector = (css: string): boolean => /\[size\b/.test(stripCssComments(css))
const declaresSize = (d: ParsedDescriptor): boolean => d.attributes.some((a) => a.name === 'size')

describe('API — a CSS `[size` selector is never present without a declared `size` attribute (inverse of A2)', () => {
  const cssSized = FLEET.filter((c) => hasSizeSelector(read(c.cssPath)))

  it('finds the CSS-sized controls to check (anti-vacuous)', () => {
    expect(cssSized.length).toBeGreaterThan(0)
    expect(cssSized.map((c) => c.name)).toContain('select')
  })

  for (const c of cssSized) {
    it(`${c.name}.css's [size] selector is backed by a declared size attribute in ${c.name}.md`, () => {
      expect(declaresSize(DESCRIPTORS.get(c.name)!), `${c.name}.css uses [size=...] but ${c.name}.md declares no size attribute`).toBe(true)
    })
  }

  it('negative control: CSS [size] with no declared size attribute is caught', () => {
    const css = `:where(ui-widget[size='sm']) { --ui-widget-height: 2rem; }`
    expect(hasSizeSelector(css)).toBe(true)
    expect(declaresSize(parseDescriptor('tag: ui-widget\nattributes: []'))).toBe(false) // the defect this invariant must catch
  })

  it('negative control: a control with no [size] selector at all is correctly excluded (no false positive)', () => {
    expect(hasSizeSelector(':where(ui-widget) { --ui-widget-bg: red; }')).toBe(false)
  })

  it("negative control: a CSS comment merely MENTIONING [size] in prose is not a selector (no false positive) — " +
    'the exact shape form-provider.css/icon.css/field.css/tabs.css use to document a DELIBERATE absence', () => {
    const css = '/* a pure coordination element: nothing rides [size]/[tone] to repoint (no ramp here) */'
    expect(hasSizeSelector(css)).toBe(false)
  })
})

// ── A3. API — extends ∈ the sanctioned base ladder (ADR-0042) ───────────────────────────────────────────────
// Mirrors component-descriptor.ts's (unexported) BASE_CLASSES — restated here so this gate asserts the ADR-0042
// ladder independently rather than reaching into that module's private schema internals.

const BASE_LADDER = new Set(['UIElement', 'UIFormElement', 'UIContainerElement', 'UIIndicatorElement', 'UIRangeElement', 'UIListboxElement'])
const extendsDefect = (d: ParsedDescriptor): string | null => {
  const ext = d.scalars.get('extends')
  if (ext === undefined) return 'missing extends'
  return BASE_LADDER.has(ext) ? null : `extends "${ext}" is outside the sanctioned base ladder`
}

describe('API — extends ∈ the sanctioned base ladder (ADR-0042)', () => {
  for (const c of FLEET) {
    it(`${c.name}.md extends a sanctioned base`, () => {
      expect(extendsDefect(DESCRIPTORS.get(c.name)!)).toBeNull()
    })
  }

  it('negative control: extends outside the ladder is caught', () => {
    expect(extendsDefect(parseDescriptor('tag: ui-widget\nextends: HTMLElement'))).not.toBeNull()
  })
})

// ── A4. API — descriptor present + tag↔class↔folder naming aligned (ADR-0004) ───────────────────────────────

/** `radio-group` → `RadioGroup` (kebab → Pascal, for the `UI{Pascal}Element` class-name check). */
const pascal = (kebab: string): string => kebab.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')

interface NamingCheck {
  tag?: string
  name: string
  folder: string
  ts: string
}

/** All naming defects for one control: tag ≡ ui-{name}; the .ts declares `class UI{Pascal}Element`; the
 *  control's name is either the folder itself or `{folder}-{suffix}` (the one exception radio/ proves — a
 *  folder MAY hold more than one descriptor, per plan §9's "one folder per component" being a default, not an
 *  absolute — but a held descriptor's name must still visibly belong to that folder's family). */
function namingDefects(c: NamingCheck): string[] {
  const defects: string[] = []
  if (c.tag !== `ui-${c.name}`) defects.push(`tag "${c.tag ?? ''}" != ui-${c.name}`)
  const wantClass = `UI${pascal(c.name)}Element`
  if (!new RegExp(`class\\s+${wantClass}\\b`).test(c.ts)) defects.push(`no "class ${wantClass}" found in source`)
  const folderAligned = c.name === c.folder || c.name.startsWith(`${c.folder}-`)
  if (!folderAligned) defects.push(`name "${c.name}" does not belong to folder "${c.folder}"`)
  return defects
}

describe('API — descriptor present + tag↔class↔folder naming aligned (ADR-0004)', () => {
  for (const c of FLEET) {
    it(`${c.folder}/${c.name} — .ts/.css exist + tag↔class↔folder align`, () => {
      expect(existsSync(c.tsPath), `missing ${c.name}.ts`).toBe(true)
      expect(existsSync(c.cssPath), `missing ${c.name}.css`).toBe(true)
      const defects = namingDefects({ tag: DESCRIPTORS.get(c.name)!.scalars.get('tag'), name: c.name, folder: c.folder, ts: read(c.tsPath) })
      expect(defects, defects.join('; ')).toEqual([])
    })
  }

  it('negative control: a tag that does not match its descriptor name is caught', () => {
    expect(namingDefects({ tag: 'ui-widgit', name: 'widget', folder: 'widget', ts: 'export class UIWidgetElement extends UIElement {}' }))
      .toContainEqual(expect.stringContaining('tag "ui-widgit"'))
  })

  it('negative control: a .ts with no matching class declaration is caught', () => {
    expect(namingDefects({ tag: 'ui-widget', name: 'widget', folder: 'widget', ts: 'export class UIThingElement extends UIElement {}' }))
      .toContainEqual(expect.stringContaining('no "class UIWidgetElement"'))
  })

  it('negative control: a descriptor whose name does not belong to its folder is caught', () => {
    expect(namingDefects({ tag: 'ui-widget', name: 'widget', folder: 'gadget', ts: 'export class UIWidgetElement extends UIElement {}' }))
      .toContainEqual(expect.stringContaining('does not belong to folder'))
  })
})

// ── B. Tokens — own ∪ shared allowlist, no cross-control reach ──────────────────────────────────────────────
// The shared allowlist is READ, not hand-copied: every `--ui-*` custom property that appears (declared OR
// consumed) in `@agent-ui/shared/tokens.css`/`dimensions.css` or the `_surface/*.css` cross-family seam — plus
// the whole `--md-sys-color-*`/`--md-sys-typescale-*` namespaces by prefix. Self-updating: the allowlist grows
// the moment the shared surface legitimately does (ADR-0081's accepted maintenance cost), never by hand-editing
// a list here. A custom property outside the governed `--ui-*`/`--md-sys-*` namespace entirely (e.g. the
// per-instance `--value-pct{,-lo,-hi}` the slider/slider-multi JS geometry seam sets as an inline style,
// traits/value-drag.ts) is simply not this invariant's concern — it is not part of the `{name}.md` token
// vocabulary at all.

const sharedSurfaceFiles: string[] = readdirSync(`${CONTROLS}/_surface`).filter((f: string) => f.endsWith('.css'))
const SHARED_SOURCES = [
  read(`${SHARED}/tokens.css`),
  read(`${SHARED}/dimensions.css`),
  ...sharedSurfaceFiles.map((f: string) => read(`${CONTROLS}/_surface/${f}`)),
]
const SHARED_UI_TOKENS = new Set<string>()
for (const text of SHARED_SOURCES) for (const m of text.matchAll(/--ui-[\w-]+/g)) SHARED_UI_TOKENS.add(m[0])

/** Is `token` legal for a control named `name` to declare/consume? Own `--ui-{name}-*` ∪ the shared allowlist;
 *  anything outside the `--ui-*`/`--md-sys-*` namespace entirely is out of scope (not this invariant's concern). */
function tokenAllowed(name: string, token: string): boolean {
  if (!/^--(ui|md-sys)-/.test(token)) return true
  if (token.startsWith(`--ui-${name}-`)) return true
  if (token.startsWith('--md-sys-color-') || token.startsWith('--md-sys-typescale-')) return true
  return SHARED_UI_TOKENS.has(token)
}

/** Custom properties DECLARED inside a bare `:where(ui-{name}...)` block (the TOKEN block, ADR-0003) — a
 *  negative lookahead keeps `name` from matching a longer sibling tag (`text` must not match `text-field`). */
function declaredProps(css: string, name: string): Set<string> {
  const out = new Set<string>()
  const re = new RegExp(`:where\\(ui-${name}(?![\\w-])[^)]*\\)\\s*\\{([^}]*)\\}`, 'g')
  for (const block of css.matchAll(re)) {
    for (const d of block[1].matchAll(/(?:^|;)\s*(--[\w-]+)\s*:/gm)) out.add(d[1])
  }
  return out
}

/** Every custom property CONSUMED anywhere in the file (`var(--x…)` — both blocks, since the token block itself
 *  legitimately reads shared ramp/colour tokens to build its own chain). */
function consumedProps(css: string): Set<string> {
  const out = new Set<string>()
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) out.add(m[1])
  return out
}

describe('Tokens — a `{name}.css` TOKEN block declares only its own ∪ the shared allowlist', () => {
  for (const c of FLEET) {
    it(`${c.name}.css declares no other control's private token`, () => {
      const bad = [...declaredProps(read(c.cssPath), c.name)].filter((t) => !tokenAllowed(c.name, t))
      expect(bad, `${c.name}.css declares out-of-family token(s): ${bad.join(', ')}`).toEqual([])
    })
  }

  it('negative control: a synthetic control declaring another control\'s private token is caught', () => {
    const css = `
      :where(ui-widget) {
        --ui-widget-bg: red;
        --ui-button-bg: blue; /* the planted defect — cross-control reach into ui-button's own token */
      }
    `
    const bad = [...declaredProps(css, 'widget')].filter((t) => !tokenAllowed('widget', t))
    expect(bad).toEqual(['--ui-button-bg'])
  })
})

describe('Tokens — consumed custom properties ∈ own ∪ the shared allowlist (no cross-control reach)', () => {
  for (const c of FLEET) {
    it(`${c.name}.css consumes no other control's private token`, () => {
      const bad = [...consumedProps(read(c.cssPath))].filter((t) => !tokenAllowed(c.name, t))
      expect(bad, `${c.name}.css reaches into out-of-family token(s): ${bad.join(', ')}`).toEqual([])
    })
  }

  it("negative control: a synthetic control consuming another control's private token is caught", () => {
    const css = `@scope (ui-widget) { :scope { background: var(--ui-button-bg); } }`
    const bad = [...consumedProps(css)].filter((t) => !tokenAllowed('widget', t))
    expect(bad).toEqual(['--ui-button-bg'])
  })

  it('negative control: an out-of-namespace property (e.g. a JS-set inline style hook) is NOT flagged', () => {
    const css = `@scope (ui-widget) { :scope { left: calc(var(--value-pct, 0) * 1%); } }`
    const bad = [...consumedProps(css)].filter((t) => !tokenAllowed('widget', t))
    expect(bad).toEqual([])
  })
})

// ── C1. Lifecycle — controls/index.ts registration bijection ────────────────────────────────────────────────

/** The `{folder}/{name}` pairs a `controls/index.ts`-shaped module TEXT exports (`export * from './f/n.ts'`). */
function exportedPairs(indexTs: string): Set<string> {
  const out = new Set<string>()
  for (const m of indexTs.matchAll(/export \* from '\.\/([\w-]+)\/([\w-]+)\.ts'/g)) out.add(`${m[1]}/${m[2]}`)
  return out
}

const INDEX_TS = read(`${CONTROLS}/index.ts`)

describe('Lifecycle — every descriptor is exported from controls/index.ts (and vice versa)', () => {
  it('the fleet ≡ the index.ts export set (0 missing, 0 phantom)', () => {
    const exported = exportedPairs(INDEX_TS)
    const missing = [...FLEET_PAIRS].filter((p) => !exported.has(p)).sort()
    const phantom = [...exported].filter((p) => !FLEET_PAIRS.has(p)).sort()
    expect(missing, 'descriptor(s) with no index.ts export').toEqual([])
    expect(phantom, 'index.ts export(s) with no matching descriptor').toEqual([])
  })

  it('negative control: a planted phantom export line fails the bijection', () => {
    const exported = exportedPairs(`${INDEX_TS}\nexport * from './phantom/phantom.ts'\n`)
    const phantom = [...exported].filter((p) => !FLEET_PAIRS.has(p))
    expect(phantom).toEqual(['phantom/phantom'])
  })

  it('negative control: a removed export line fails the bijection (missing)', () => {
    const withoutButton = INDEX_TS.replace("export * from './button/button.ts'\n", '')
    const exported = exportedPairs(withoutButton)
    const missing = [...FLEET_PAIRS].filter((p) => !exported.has(p))
    expect(missing).toEqual(['button/button'])
  })
})

// ── C2. Lifecycle — component-styles.css registration bijection ─────────────────────────────────────────────

/** The `{folder}/{name}` pairs a `component-styles.css`-shaped stylesheet TEXT imports. `_`-prefixed folders
 *  (`_surface/container.css`) are the shared cross-family seam, NOT a control — excluded, mirroring fleet discovery. */
function importedPairs(cssBarrel: string): Set<string> {
  const out = new Set<string>()
  for (const m of cssBarrel.matchAll(/@import '\.\/controls\/([\w-]+)\/([\w-]+)\.css'/g)) {
    if (m[1].startsWith('_')) continue
    out.add(`${m[1]}/${m[2]}`)
  }
  return out
}

const CSS_BARREL = read(`${COMPONENTS}/src/component-styles.css`)

describe('Lifecycle — every descriptor is imported by component-styles.css (and vice versa)', () => {
  it('the fleet ≡ the component-styles.css import set (0 missing, 0 phantom)', () => {
    const imported = importedPairs(CSS_BARREL)
    const missing = [...FLEET_PAIRS].filter((p) => !imported.has(p)).sort()
    const phantom = [...imported].filter((p) => !FLEET_PAIRS.has(p)).sort()
    expect(missing, 'descriptor(s) with no component-styles.css import').toEqual([])
    expect(phantom, 'component-styles.css import(s) with no matching descriptor').toEqual([])
  })

  it('negative control: a planted phantom @import fails the bijection', () => {
    const imported = importedPairs(`${CSS_BARREL}\n@import './controls/phantom/phantom.css';\n`)
    const phantom = [...imported].filter((p) => !FLEET_PAIRS.has(p))
    expect(phantom).toEqual(['phantom/phantom'])
  })

  it('negative control: a removed @import fails the bijection (missing)', () => {
    const withoutButton = CSS_BARREL.replace("@import './controls/button/button.css';\n", '')
    const imported = importedPairs(withoutButton)
    const missing = [...FLEET_PAIRS].filter((p) => !imported.has(p))
    expect(missing).toEqual(['button/button'])
  })

  it('the shared `_surface/*.css` seam imports are excluded from the bijection (not a control)', () => {
    expect(importedPairs(CSS_BARREL).has('_surface/container')).toBe(false)
  })
})

// ── C3. Lifecycle — every LIGHT-DISMISS `open` attribute declares the two-way toggle+close pair
//        (ADR-0019). The rule is architectural, not syntactic: ADR-0019's toggle+close pairing exists
//        because a light-dismiss overlay (built on the shared overlay controller, ADR-0043 — Escape,
//        outside-click, focus-restore) has a genuine "something else closed me" case `close` announces
//        distinctly from a user-driven `toggle`. A control with `open` but NO light-dismiss concept —
//        content-fold patterns like `ui-disclosure` (SPEC-R14/R15, ADR-0101: every actual transition,
//        user or model-driven, is just a `toggle` — there is nothing external that can dismiss a fold)
//        — correctly has no `close` to pair. The KNOWN_NON_OVERLAY_OPEN allowlist below is that
//        documented exception set, not a loophole: a NEW open-bearing control lands in neither list
//        (still fails, per the "no silent pass" test below) until a human names which bucket it's in.

const hasOpenAttr = (d: ParsedDescriptor): boolean => d.attributes.some((a) => a.name === 'open')

/** Controls with `open` but NO light-dismiss concept (never built on the ADR-0043 overlay controller) —
 *  the accepted architectural exception to the toggle+close pairing law. Each entry names its own
 *  design record; adding to this list is a design decision, not a test tweak. */
const KNOWN_NON_OVERLAY_OPEN = new Set(['disclosure']) // ADR-0101 cl. (SPEC-R14/R15) — toggle-only, no dismissal

describe("Lifecycle — an `open` attribute always pairs with BOTH toggle and close, UNLESS the control is a documented non-overlay exception (ADR-0019)", () => {
  const openBearing = FLEET.filter((c) => hasOpenAttr(DESCRIPTORS.get(c.name)!))
  const overlays = openBearing.filter((c) => !KNOWN_NON_OVERLAY_OPEN.has(c.name))

  it('finds the open-bearing controls to check, split into overlay vs the documented exception (anti-vacuous)', () => {
    expect(openBearing.length).toBeGreaterThan(0)
    expect(openBearing.map((c) => c.name).sort()).toEqual(
      ['combo-box', 'disclosure', 'menu', 'modal', 'popover', 'select', 'tooltip'].filter((n) =>
        openBearing.some((c) => c.name === n),
      ),
    )
    expect(overlays.map((c) => c.name).sort()).toEqual(['combo-box', 'menu', 'modal', 'popover', 'select', 'tooltip'])
  })

  for (const c of overlays) {
    it(`${c.name}.md's open attribute is paired with toggle + close (light-dismiss overlay)`, () => {
      const events = new Set(fieldNames(DESCRIPTORS.get(c.name)!, 'events'))
      expect(events.has('toggle'), `${c.name}.md has open but no toggle event`).toBe(true)
      expect(events.has('close'), `${c.name}.md has open but no close event`).toBe(true)
    })
  }

  for (const c of openBearing.filter((x) => KNOWN_NON_OVERLAY_OPEN.has(x.name))) {
    it(`${c.name}.md's open attribute is paired with toggle ONLY (documented non-overlay exception, no close)`, () => {
      const events = new Set(fieldNames(DESCRIPTORS.get(c.name)!, 'events'))
      expect(events.has('toggle'), `${c.name}.md has open but no toggle event`).toBe(true)
      expect(events.has('close'), `${c.name}.md is a documented non-overlay exception — it must NOT gain a close event without updating KNOWN_NON_OVERLAY_OPEN's rationale`).toBe(false)
    })
  }

  it('negative control: an `open` attribute with only `toggle` (missing `close`) is caught for an OVERLAY control', () => {
    const fence = [
      'attributes:',
      '  - name: open',
      '    type: boolean',
      '    default: false',
      '    reflect: true',
      'events:',
      '  - name: toggle',
      "    detail: 'null'",
    ].join('\n')
    const parsed = parseDescriptor(fence)
    expect(hasOpenAttr(parsed)).toBe(true) // anti-vacuous — the fixture genuinely has the open attribute
    const events = new Set(fieldNames(parsed, 'events'))
    expect(events.has('toggle')).toBe(true)
    expect(events.has('close')).toBe(false) // the defect this invariant must catch for any NON-exception control
  })

  it('negative control: a control with NO `open` attribute is correctly excluded (no false positive)', () => {
    expect(hasOpenAttr(parseDescriptor('tag: ui-widget\nattributes: []'))).toBe(false)
  })

  it('negative control: KNOWN_NON_OVERLAY_OPEN cannot silently absorb a real overlay regression — removing disclosure from the allowlist must fail its own toggle-only assertion, not just vanish', () => {
    // Proves the exception list is load-bearing (not a permanent bypass): if disclosure's descriptor
    // ever GAINS a close event without updating this list, the loop above still runs (disclosure stays
    // IN the allowlist) and its "must NOT have close" assertion fails — the fixture below simulates that
    // regressed shape directly, since we cannot mutate the real descriptor from this test.
    const regressed = parseDescriptor(
      ['attributes:', '  - name: open', '    type: boolean', '    default: false', '    reflect: true',
       'events:', '  - name: toggle', "    detail: 'null'", '  - name: close', "    detail: 'null'"].join('\n'),
    )
    const events = new Set(fieldNames(regressed, 'events'))
    expect(events.has('close'), 'a regressed non-overlay descriptor gaining close must be catchable').toBe(true)
  })
})
