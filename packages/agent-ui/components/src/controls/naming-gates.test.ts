import { describe, it, expect } from 'vitest'
import { whenFlushed } from '../reactive/index.ts'
import { splitFrontmatter, parseDescriptor } from '../descriptor/component-descriptor.ts'
// Read every source file as TEXT (never executed/type-checked) — the same fs-read approach as
// family-coherence.test.ts / docs-grammar.test.ts. No `@types/node` devDep; vitest/node resolves this at runtime.
import { readFileSync, readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// naming-gates.test.ts — TKT-0025 §11's four planned gate closures (references/naming.md), sited beside
// family-coherence.test.ts (the fleet's other standing cross-cutting naming/API gate) because gates 1-3 are the
// SAME shape as family-coherence's text-level invariants (a closed-vocabulary membership check + a synthetic
// negative control proving it bites), just widened from "one descriptor" to "every non-test source file in
// every package" (a repo-wide fs-walk, the docs-grammar.test.ts idiom, since naming.md's vocabularies are
// enforced at the SOURCE (emit-seam/internals.states/data-role), not the descriptor). Gate 4 is a live jsdom
// construction probe, scoped to THIS package's own control fleet only (see its own section for why).
//
//   1. Emit-seam event allowlist (§4)      — every `emit('x')` / `new CustomEvent(...)` event name ∈ the closed
//      six (change·input·select·open·close·toggle), or a named, cited exception.
//   2. Custom-state vocabulary (§6)        — every `internals.states` add/delete/toggle/replace/has(...) name
//      (+ every CSS `:state(...)`) ∈ the 10-member registry.
//   3. Data-role registry (§6)             — every `data-role`/`dataset.role` value ∈ the §6 registry.
//   4. Descriptor↔DOM parts truthfulness   — every REAL `[data-part]` a live-constructed control renders is
//      declared SOMEWHERE in the fleet's parts[] union (the color-picker L2 hole's closure).
//
// Migration policy (naming.md's own ruling, header note): fix-on-touch, gates strict for NEW names from day
// one. A genuinely NEW vocabulary member is a design decision — it lands in naming.md's registry AND here, in
// the SAME change (never a silent gate-only or doc-only edit); that comment sits at each registry constant below.

const ROOT = process.cwd()
const PACKAGES_ROOT = `${ROOT}/packages/agent-ui`
const read = (p: string): string => readFileSync(p, 'utf8') as string

// ── fs-walk over every package's src/ (all of components/app/router/code/icons/a2a/a2ui/shared) ───────────────
// Mirrors docs-grammar.test.ts's walkMd, generalized to any extension set; `*.test.ts`/`*.browser.test.ts` are
// the non-test cut the dispatch specifies (a control's OWN test fixtures/negative-control strings are not the
// fleet's real emitted/rendered surface).

function walk(dir: string, exts: readonly string[]): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const name of entries) {
    const p = `${dir}/${name}`
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p, exts))
    else if (exts.some((e) => name.endsWith(e)) && !name.endsWith('.test.ts') && !name.includes('.browser.test.'))
      out.push(p)
  }
  return out
}

const PKG_SRC_DIRS = readdirSync(PACKAGES_ROOT)
  .map((p) => `${PACKAGES_ROOT}/${p}/src`)
  .filter((p) => {
    try {
      return statSync(p).isDirectory()
    } catch {
      return false
    }
  })

const TS_FILES = PKG_SRC_DIRS.flatMap((d) => walk(d, ['.ts']))
const CSS_FILES = PKG_SRC_DIRS.flatMap((d) => walk(d, ['.css']))

/** Strip `/* … *‍/` block comments and `//` line comments (sparing `://`) — so a comment merely MENTIONING an
 *  example (`` `this.emit('change')` `` in a2ui/factories.ts prose) is never mistaken for a live call. Mirrors
 *  family-coherence's stripCssComments / site's own stripComments (component-preview-catalog.test.ts). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')
}

describe('naming gates — fs-walk discovery (anti-vacuous)', () => {
  it('found every package src/ dir and a non-trivial file set', () => {
    expect(PKG_SRC_DIRS.length).toBeGreaterThanOrEqual(8) // a2a·a2ui·app·code·components·icons·router·shared
    expect(TS_FILES.length).toBeGreaterThan(200)
    expect(CSS_FILES.length).toBeGreaterThan(20)
    expect(TS_FILES.some((f) => f.includes('/components/src/controls/button/button.ts'))).toBe(true)
    expect(TS_FILES.some((f) => f.endsWith('.test.ts'))).toBe(false) // the non-test cut actually excludes
  })
})

// ── Gate 1 — the emit-seam event allowlist (naming.md §4) ──────────────────────────────────────────────────────
// naming.md §4: `change · input · select · open · close · toggle` (+ native `click`, which never rides `emit()`
// — button's pure-activation carve-out calls the platform `host.click()`, proven fleet-wide by the ZERO literal
// `emit('click')` sites found below; `click` is therefore NOT added to this seam's allowlist).
//
// The ADR-0050 base↔provider/field PROTOCOL events (`ui-form-connect`/`ui-form-reset`, dom/form.ts) are a
// DELIBERATE, cited exception: form.ts's own header says so verbatim — "OUTSIDE the public component-event
// vocab" — and they are dispatched via raw `dispatchEvent(new CustomEvent(...))`, never `this.emit()` (emit's
// cancelable/public shape is for CONSUMER events only). Both are IDENTIFIER-fed (`FORM_CONNECT_EVENT`/
// `FORM_RESET_EVENT` constants), never literal strings, so this gate resolves an identifier argument against
// its OWN file's `const NAME = 'literal'` binding before checking it — a NEW identifier-fed emit/CustomEvent
// site must resolve to a known name or the gate fails, forcing a human to either use a vocabulary literal or
// extend PROTOCOL_EVENT_EXCEPTIONS with the SAME citation discipline.

const ALLOWED_EVENTS = new Set(['change', 'input', 'select', 'open', 'close', 'toggle'])

// naming.md §12 + dom/form.ts's own ADR-0050 citation — extend together (a new protocol event needs the same
// "outside the public vocab, cited" treatment in BOTH form.ts's header comment and here).
const PROTOCOL_EVENT_EXCEPTIONS = new Set(['ui-form-connect', 'ui-form-reset'])

// The ONE known identifier-fed `this.emit(...)` call in the whole fleet today (color-picker.ts's `#commit`):
// `emit(kind)` where `kind: 'input' | 'change'` (a closed 2-member literal union, both ∈ ALLOWED_EVENTS — read
// at color-picker.ts:478/486). A source-text scan cannot resolve a TYPED PARAMETER the way it resolves a
// module-level `const` literal (gate 1's CustomEvent identifier path, below) — this is a NAMED, verified
// exemption, not a blind allowance; a NEW identifier-fed `.emit(non-literal)` site anywhere else fails the gate
// until it is either rewritten to a literal or added here with the same manual verification.
// NAMED SCAN LIMITS (review MINOR, 2026-07-12): a template-literal event name (`emit(\`change\`)`) and an
// ALIASED emit (`const e = this.emit; e('x')`) both escape the `.emit(` regex — zero such sites exist in the
// fleet today (verified); either shape appearing would be a style violation first (names are grep-keys,
// naming.md §0.5), and the descriptor-level allowlist (family-coherence) remains the second net.
const EMIT_IDENTIFIER_EXCEPTIONS = new Set(['packages/agent-ui/components/src/controls/color-picker/color-picker.ts::kind'])

// dom/element.ts's `emit<D>(type: string, …)` is the base seam's OWN DEFINITION (`new CustomEvent<D>(type, …)`)
// — `type` is the seam's generic parameter, not a naming decision; every CALLER already passes a literal that
// the `.emit(` loop above checks directly. Excluding the definition site keeps the identifier-CustomEvent check
// scoped to actual call sites (dispatchEvent(new CustomEvent(...)) call sites like form.ts's protocol events).
const CUSTOM_EVENT_DEFINITION_FILES = new Set(['packages/agent-ui/components/src/dom/element.ts'])

interface EmitSeamViolation {
  file: string
  detail: string
}

/** Every emit-seam violation in one file's TEXT (comment-stripped): an out-of-vocabulary literal event name,
 *  OR an identifier argument that does not resolve to an allowed/excepted name. Exported as a pure function
 *  over source text so the negative controls below can drive it with synthetic fixtures. */
function emitSeamViolations(relPath: string, src: string): EmitSeamViolation[] {
  const code = stripComments(src)
  const out: EmitSeamViolation[] = []

  const resolveLocalConst = (ident: string): string | undefined =>
    new RegExp(`\\bconst\\s+${ident}\\s*=\\s*'([^']*)'`).exec(code)?.[1]

  // `this.emit(...)` / `host.emit(...)` — literal or identifier first argument.
  for (const m of code.matchAll(/\.emit\(\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w]*))/g)) {
    const literal = m[1] ?? m[2]
    if (literal !== undefined) {
      if (!ALLOWED_EVENTS.has(literal)) out.push({ file: relPath, detail: `emit('${literal}') outside {${[...ALLOWED_EVENTS].join(',')}}` })
    } else {
      const ident = m[3]!
      const key = `${relPath}::${ident}`
      if (!EMIT_IDENTIFIER_EXCEPTIONS.has(key)) {
        out.push({ file: relPath, detail: `emit(${ident}) — identifier-fed emit not in EMIT_IDENTIFIER_EXCEPTIONS (${key})` })
      }
    }
  }

  // `new CustomEvent(...)` — literal, or an identifier resolved against a same-file `const NAME = 'literal'`.
  const customEventSites = CUSTOM_EVENT_DEFINITION_FILES.has(relPath) ? [] : [...code.matchAll(/new\s+CustomEvent\s*(?:<[^>]*>)?\s*\(\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w]*))/g)]
  for (const m of customEventSites) {
    const literal = m[1] ?? m[2]
    if (literal !== undefined) {
      if (!ALLOWED_EVENTS.has(literal) && !PROTOCOL_EVENT_EXCEPTIONS.has(literal))
        out.push({ file: relPath, detail: `new CustomEvent('${literal}') outside {${[...ALLOWED_EVENTS].join(',')}} ∪ PROTOCOL_EVENT_EXCEPTIONS` })
    } else {
      const ident = m[3]!
      const resolved = resolveLocalConst(ident)
      if (resolved === undefined) {
        out.push({ file: relPath, detail: `new CustomEvent(${ident}) — unresolvable identifier (no local const ${ident} = '…')` })
      } else if (!ALLOWED_EVENTS.has(resolved) && !PROTOCOL_EVENT_EXCEPTIONS.has(resolved)) {
        out.push({ file: relPath, detail: `new CustomEvent(${ident} = '${resolved}') outside {${[...ALLOWED_EVENTS].join(',')}} ∪ PROTOCOL_EVENT_EXCEPTIONS` })
      }
    }
  }
  return out
}

describe('Gate 1 — the emit-seam event allowlist (naming.md §4, packages/**/src, non-test)', () => {
  const violations = TS_FILES.flatMap((f) => emitSeamViolations(f.slice(ROOT.length + 1), read(f)))

  it('found real emit-seam call sites to check (anti-vacuous)', () => {
    const combined = TS_FILES.map((f) => stripComments(read(f))).join('\n')
    expect(combined).toContain(".emit('change')")
    expect(combined).toContain("FORM_RESET_EVENT = 'ui-form-reset'")
  })

  it('every emit()/new CustomEvent() event name resolves to the closed six or a cited protocol exception', () => {
    expect(violations, violations.map((v) => `${v.file}: ${v.detail}`).join('\n')).toEqual([])
  })

  it('negative control: an out-of-vocabulary emit literal is caught', () => {
    expect(emitSeamViolations('zz.ts', "this.emit('ui-zzchange')")).toEqual([
      { file: 'zz.ts', detail: "emit('ui-zzchange') outside {change,input,select,open,close,toggle}" },
    ])
  })

  it('negative control: an unresolvable identifier-fed new CustomEvent(...) is caught', () => {
    expect(emitSeamViolations('zz.ts', 'this.dispatchEvent(new CustomEvent(SOME_UNKNOWN_CONST))')).toEqual([
      { file: 'zz.ts', detail: 'new CustomEvent(SOME_UNKNOWN_CONST) — unresolvable identifier (no local const SOME_UNKNOWN_CONST = \'…\')' },
    ])
  })

  it('negative control: a resolved identifier outside the vocabulary/exceptions is caught', () => {
    const src = "const ZZ_EVENT = 'ui-zz-thing'\nthis.dispatchEvent(new CustomEvent(ZZ_EVENT))"
    expect(emitSeamViolations('zz.ts', src)).toEqual([
      { file: 'zz.ts', detail: "new CustomEvent(ZZ_EVENT = 'ui-zz-thing') outside {change,input,select,open,close,toggle} ∪ PROTOCOL_EVENT_EXCEPTIONS" },
    ])
  })

  it('negative control: an identifier-fed emit() not in EMIT_IDENTIFIER_EXCEPTIONS is caught', () => {
    expect(emitSeamViolations('zz.ts', 'this.emit(kind)')).toEqual([
      { file: 'zz.ts', detail: 'emit(kind) — identifier-fed emit not in EMIT_IDENTIFIER_EXCEPTIONS (zz.ts::kind)' },
    ])
  })

  it('negative control: a comment MENTIONING an example call is not a live site (no false positive)', () => {
    expect(emitSeamViolations('zz.ts', "// `this.emit('ui-zz-bogus')` in #commit()")).toEqual([])
  })

  it('negative control: the resolved protocol exceptions themselves pass clean', () => {
    const src = [
      "export const FORM_CONNECT_EVENT = 'ui-form-connect'",
      "export const FORM_RESET_EVENT = 'ui-form-reset'",
      'this.dispatchEvent(new CustomEvent(FORM_CONNECT_EVENT, { bubbles: true }))',
      'this.dispatchEvent(new CustomEvent(FORM_RESET_EVENT, { bubbles: true }))',
    ].join('\n')
    expect(emitSeamViolations('zz.ts', src)).toEqual([])
  })
})

// ── Gate 2 — the custom-state vocabulary (naming.md §6) ─────────────────────────────────────────────────────────
// The 10-member registry. A NEW state name is a design decision — it lands in naming.md §6 AND this set in the
// SAME change (this comment is the "extend together" contract the dispatch specifies).

const ALLOWED_STATES = new Set([
  'ready', 'user-invalid', 'checked', 'dragging', 'revealed', 'disabled', 'collapsed', 'truncated', 'selected', 'indeterminate',
])

/** Every custom-state NAME used in one file's TEXT (comment-stripped) — `states?.add/delete/toggle/replace/has(
 *  'x')` (bare `states` OR `this.internals.states`, both forms live in the fleet) union `:state(x)` CSS
 *  selectors. No leading-dot requirement on `states` (checkbox.ts aliases `const states = this.internals.states`
 *  then calls the bare local `states?.add(...)` — a `\.states` regex misses that real call). */
function usedStates(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const m of code.matchAll(/\bstates\??\.(?:add|delete|toggle|replace|has)\(\s*['"]([^'"]+)['"]/g)) out.push(m[1]!)
  return out
}
function usedStatesCss(css: string): string[] {
  const out: string[] = []
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/:state\(\s*([A-Za-z][\w-]*)\s*\)/g)) out.push(m[1]!)
  return out
}

describe('Gate 2 — the custom-state vocabulary (naming.md §6, packages/**/src, non-test)', () => {
  const tsHits = TS_FILES.flatMap((f) => usedStates(read(f)).map((name) => ({ file: f.slice(ROOT.length + 1), name })))
  const cssHits = CSS_FILES.flatMap((f) => usedStatesCss(read(f)).map((name) => ({ file: f.slice(ROOT.length + 1), name })))
  const allHits = [...tsHits, ...cssHits]

  it('found real internals.states usage across the fleet (anti-vacuous)', () => {
    expect(new Set(allHits.map((h) => h.name)).size).toBeGreaterThanOrEqual(8)
    expect(allHits.some((h) => h.name === 'ready')).toBe(true)
  })

  it('every used custom-state name ∈ the §6 registry', () => {
    const bad = allHits.filter((h) => !ALLOWED_STATES.has(h.name))
    expect(bad, bad.map((h) => `${h.file}: state "${h.name}"`).join('\n')).toEqual([])
  })

  it('negative control: an out-of-vocabulary state name is caught', () => {
    expect(usedStates("this.internals.states?.add('zzghost')")).toEqual(['zzghost'])
    expect(ALLOWED_STATES.has('zzghost')).toBe(false)
  })

  it('negative control: the bare-local-variable alias form is found (checkbox.ts precedent — no leading dot)', () => {
    expect(usedStates("const states = this.internals.states\nstates?.add('checked')")).toEqual(['checked'])
  })

  it('negative control: a CSS :state() selector is found; a comment mention is not (no false positive)', () => {
    expect(usedStatesCss(':where(ui-widget:state(zzstate)) { color: red; }')).toEqual(['zzstate'])
    expect(usedStatesCss('/* :state(zzcommented) is documented here only */')).toEqual([])
  })

  it('negative control: a comment MENTIONING an example .add() call is not a live site (no false positive)', () => {
    expect(usedStates("// `internals.states?.add('zzbogus')`, optional-chained, behind rAF")).toEqual([])
  })
})

// ── Gate 3 — the data-role registry (naming.md §6) ───────────────────────────────────────────────────────────
// The §6 LIVE vocabulary (control-emitted roles) + `empty`, the one named AUTHOR hook actually found in source
// (command-modal.ts's `[slot=empty],[data-role=empty]` override). naming.md §6 also names "command-modal" as a
// second author hook, but no `data-role="command-modal"` site exists anywhere in the fleet (verified by this
// gate's own scan, below) — it is NOT added here; if a future control genuinely needs it, the scan will name the
// real site and this registry extends WITH it, not ahead of it.

const ALLOWED_ROLES = new Set([
  'icon', 'caret', 'marker', 'detail', 'text', 'list', 'label', 'numeric', 'currency', 'stepper', 'magnifier',
  'description', 'timestamp', 'shortcut', 'reveal', 'group-label', 'calendar', 'swatch', 'trailing', 'clear',
  'before-sentinel', 'empty',
  // 'tag' — ADR-0130 cl.7 (nav-rail-family): anatomy.md's RESERVED tag role realized, ui-nav-rail-item's
  // trailing name|tag row (app/src/controls/nav-rail/nav-rail.css `[data-role='tag']`). Extended here in
  // the SAME change as naming.md §6 (this gate's own "extend together" contract, header comment above).
  'tag',
  // ui-conversation's per-turn bubble speaker kind (@agent-ui/app, app-surfaces-m2.spec.md SPEC-R4) —
  // added in the SAME change as naming.md §6's registry line (the fix-on-touch rule).
  'user', 'agent', 'system',
  // ui-agent-admin's composed panes (@agent-ui/app, TKT-0039/ADR-0131 → vision rev.5): 'canvas' (chat) +
  // 'tabs' (the {Settings, Context} ui-tabs pane — the old 'prompts'/'settings'/'tabs-medium' pane trio
  // dissolved into it), the SAME "which pane is this" role category master-detail's own 'list'/'detail'
  // already cover. 'settings-content'/'context-content' are the two reparent-able content units that
  // migrate between a split-layout tab panel and a narrow tab panel (the TKT-0085 'agent-content'
  // wrapper discipline, renamed + doubled). Added in the SAME change as naming.md §6's registry line.
  'canvas', 'tabs', 'settings-content', 'context-content',
  // ui-timeline-item's recursive nesting slot (ADR-0143 F1, TKT-0091) — a genuine nested `<ui-timeline>`
  // adopted alongside 'detail' into the shared disclosure. Added in the SAME change as naming.md §6's
  // registry line.
  'nested',
])

/** Every `data-role` value used in one file's TEXT (comment-stripped): `data-role="x"` / `data-role='x'` /
 *  `data-role=x` (TS attribute-selector prose + CSS attr selectors, quoting optional) ∪ `dataset.role = 'x'`
 *  ∪ `setAttribute('data-role', 'x')` — the fleet's DOMINANT write form (12 sites), added at the review's
 *  MAJOR: a literal styled by anything other than an attribute selector previously escaped this scan. */
function usedRoles(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const m of code.matchAll(/data-role\s*=\s*['"]?([A-Za-z][\w-]*)['"]?/g)) out.push(m[1]!)
  for (const m of code.matchAll(/dataset\.role\s*=\s*['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of code.matchAll(/setAttribute\(\s*['"]data-role['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]\s*\)/g)) out.push(m[1]!)
  return out
}

/** DYNAMIC `setAttribute('data-role', <identifier>)` OR `<expr>.dataset.role = <identifier>` sites — a
 *  value a TEXT scan cannot resolve. Gate-1 parity (the review's MAJOR): fail CLOSED unless the site is
 *  allowlisted below, pinned per `file::identifier` with the identifier's VERIFIED closed union cited — a
 *  future dynamic write anywhere else yields a different key and fails.
 *  TKT-0032: the `dataset.role = <ident>` form (an identifier RHS, not a quoted string literal — those stay
 *  governed by `usedRoles`'s literal matcher above, unchanged) previously matched NEITHER matcher and slipped
 *  through vacuously; this second alternative closes that gap the same fail-closed way the `setAttribute`
 *  form already works. An RHS starting with `'`/`"` never matches `[A-Za-z_$]`, so the two matchers stay
 *  partitioned — no double-count, no overlap with `usedRoles`. */
function dynamicRoleSites(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const m of code.matchAll(/setAttribute\(\s*['"]data-role['"]\s*,\s*([A-Za-z_$][\w$.]*)\s*\)/g)) out.push(m[1]!)
  for (const m of code.matchAll(/dataset\.role\s*=\s*([A-Za-z_$][\w$.]*)/g)) out.push(m[1]!)
  return out
}

const ROLE_IDENTIFIER_EXCEPTIONS = new Set([
  // timeline-item.ts:131 — `role` iterates CONTENT_ROLES = ['label','description','timestamp','trailing']
  // (timeline-item.ts:60, `as const`): every member ∈ ALLOWED_ROLES. Verified 2026-07-12 (review MAJOR fix).
  'packages/agent-ui/components/src/controls/timeline-item/timeline-item.ts::role',
  // text-field.ts:796/819 — `role` is LeadingRole = 'magnifier'|'currency' (text-field.ts:94) and
  // AffordanceRole = 'clear'|'reveal'|'calendar'|'swatch' (text-field.ts:96): every member ∈ ALLOWED_ROLES.
  // Verified 2026-07-12 (review MAJOR fix). One key covers both sites — same file, same identifier.
  'packages/agent-ui/components/src/controls/text-field/text-field.ts::role',
  // conversation.ts's #makeBubble(role: Role) — Role = 'user'|'agent'|'system' (conversation.ts, this
  // file's own top-level type alias): every member ∈ ALLOWED_ROLES (added in the SAME change above).
  'packages/agent-ui/app/src/controls/conversation/conversation.ts::role',
])

describe('Gate 3 — the data-role registry (naming.md §6, packages/**/src, non-test)', () => {
  const tsHits = TS_FILES.flatMap((f) => usedRoles(read(f)).map((name) => ({ file: f.slice(ROOT.length + 1), name })))
  const cssHits = CSS_FILES.flatMap((f) => usedRoles(read(f).replace(/\/\*[\s\S]*?\*\//g, ' ')).map((name) => ({ file: f.slice(ROOT.length + 1), name })))
  const allHits = [...tsHits, ...cssHits]

  it('found real data-role usage across the fleet (anti-vacuous)', () => {
    expect(new Set(allHits.map((h) => h.name)).size).toBeGreaterThanOrEqual(10)
    expect(allHits.some((h) => h.name === 'icon')).toBe(true)
  })

  it('every used data-role value ∈ the §6 registry', () => {
    const bad = allHits.filter((h) => !ALLOWED_ROLES.has(h.name))
    expect(bad, bad.map((h) => `${h.file}: data-role "${h.name}"`).join('\n')).toEqual([])
  })

  it('no live site uses "command-modal" as a data-role value (naming.md §6\'s 2nd author-hook citation is NOT in the registry above, by design)', () => {
    expect(allHits.some((h) => h.name === 'command-modal')).toBe(false)
  })

  it('negative control: an out-of-registry data-role value is caught', () => {
    expect(usedRoles("this.querySelector('[data-role=\"zzbogus\"]')")).toEqual(['zzbogus'])
    expect(ALLOWED_ROLES.has('zzbogus')).toBe(false)
  })

  it('every setAttribute(\'data-role\', <literal>) value ∈ the §6 registry (the dominant write form)', () => {
    // Covered by the widened usedRoles scan — this leg pins the write form explicitly with its own NC below.
    const writes = TS_FILES.flatMap((f) =>
      [...stripComments(read(f)).matchAll(/setAttribute\(\s*['"]data-role['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]\s*\)/g)]
        .map((m) => ({ file: f.slice(ROOT.length + 1), name: m[1]! })))
    expect(writes.length, 'anti-vacuous: the fleet genuinely writes data-role via setAttribute').toBeGreaterThanOrEqual(5)
    const bad = writes.filter((h) => !ALLOWED_ROLES.has(h.name))
    expect(bad, bad.map((h) => `${h.file}: setAttribute data-role "${h.name}"`).join('\n')).toEqual([])
  })

  it('every DYNAMIC setAttribute(\'data-role\', identifier) site is allowlisted with a verified union (fail-closed, gate-1 parity)', () => {
    const unlisted = TS_FILES.flatMap((f) =>
      dynamicRoleSites(read(f)).map((ident) => `${f.slice(ROOT.length + 1)}::${ident}`))
      .filter((key) => !ROLE_IDENTIFIER_EXCEPTIONS.has(key))
    expect(unlisted, `unallowlisted dynamic data-role write(s): ${unlisted.join(', ')}`).toEqual([])
  })

  it('negative control: a setAttribute-written bogus literal AND an unallowlisted dynamic write are both caught', () => {
    expect(usedRoles("el.setAttribute('data-role', 'zzbogus')")).toEqual(['zzbogus'])
    expect(dynamicRoleSites("el.setAttribute('data-role', someVar)")).toEqual(['someVar'])
    expect(ROLE_IDENTIFIER_EXCEPTIONS.has('some/other/file.ts::someVar')).toBe(false)
  })

  it('negative control (TKT-0032): an unregistered `dataset.role = ident` dynamic write is caught, the same as the setAttribute form', () => {
    expect(dynamicRoleSites('bubble.dataset.role = someUnregisteredIdent')).toEqual(['someUnregisteredIdent'])
    expect(ROLE_IDENTIFIER_EXCEPTIONS.has('some/other/file.ts::someUnregisteredIdent')).toBe(false)
  })

  it('negative control (TKT-0032): the literal `dataset.role = \'x\'` form is untouched — governed by usedRoles only, never double-counted by dynamicRoleSites', () => {
    expect(usedRoles("bubble.dataset.role = 'agent'")).toEqual(['agent'])
    expect(dynamicRoleSites("bubble.dataset.role = 'agent'")).toEqual([])
  })

  it('negative control: a CSS attribute selector is found; a comment mention is not (no false positive)', () => {
    expect(usedRoles(":where(ui-widget) [data-role='zzcss'] { color: red; }")).toEqual(['zzcss'])
    expect(usedRoles('/* [data-role="zzcommented"] documented here only */')).toEqual([])
  })
})

// ── Gate 4 — descriptor↔DOM parts[] truthfulness (the color-picker L2 hole) ──────────────────────────────────
// SCOPE CUT: this gate constructs REAL elements, so — unlike gates 1-3's pure text scan — it can only reach
// controls THIS package can import. `@agent-ui/components` sits BELOW `@agent-ui/app` in the package DAG
// (components ← app), so app's own 3 parts-bearing descriptors (ui-app-shell-region, ui-master-detail,
// ui-settings) are out of reach from here — the SAME scope cut site-coverage.test.ts's FAMILY_ROOTS already
// takes for its page-coverage gate (components/controls only, not app). Not a silent gap: named here, and an
// app-package-local mirror of this gate is the natural follow-up if that coverage is wanted (TKT-0025 Findings).
//
// jsdom-constructible controls only (per the dispatch): every one of the fleet's 30 parts-bearing controls DOES
// construct + connect cleanly in jsdom today, given two harness fixes (both proven necessary empirically, not
// guessed):
//   • jsdom has no ElementInternals.setFormValue/setValidity (the calendar.test.ts stubFormAssoc precedent
//     stubs it per-instance via a Probe subclass) — a fleet-wide gate can't subclass every control, so the
//     PROTOTYPE is patched once instead, same effect.
//   • ui-menu/ui-popover/ui-tooltip THROW at connect without a leading trigger/anchor child (their own
//     #ensureParts guard) — REQUIRES_TRIGGER seeds the menu.test.ts DEFAULT_MARKUP shape (`<button>`) so
//     construction proceeds normally; this is a real contentModel precondition, not a jsdom gap, so seeding it
//     is the right fix (not an exemption).
// EXCLUSION_ALLOWLIST stays empty today — a future control that genuinely cannot construct in jsdom (a real
// engine-only dependency, not a missing seed) is named here with its reason, mirroring the pattern's own name.

const EXCLUSION_ALLOWLIST = new Map<string, string>([
  // 'ui-example': 'reason a real engine dependency makes jsdom construction impossible',
])
const REQUIRES_TRIGGER = new Set(['ui-menu', 'ui-popover', 'ui-tooltip'])

if (typeof ElementInternals !== 'undefined' && typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>)['setFormValue'] = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>)['setValidity'] = function (): void {}
}

const CONTROLS = `${ROOT}/packages/agent-ui/components/src/controls`
interface PartsControl { folder: string; name: string; tag: string; declaredParts: string[] }

function partsControls(): PartsControl[] {
  const out: PartsControl[] = []
  const folders = readdirSync(CONTROLS).filter((e) => !e.startsWith('_') && statSync(`${CONTROLS}/${e}`).isDirectory())
  for (const folder of folders) {
    for (const f of readdirSync(`${CONTROLS}/${folder}`)) {
      if (!f.endsWith('.md')) continue
      const { fence } = splitFrontmatter(read(`${CONTROLS}/${folder}/${f}`))
      const parsed = parseDescriptor(fence)
      const tag = parsed.scalars.get('tag')
      const declaredParts = (parsed.sequences.get('parts') ?? [])
        .map((item) => item.get('name'))
        .filter((n): n is string => typeof n === 'string' && n !== '')
      if (tag !== undefined && declaredParts.length > 0) out.push({ folder, name: f.slice(0, -3), tag, declaredParts })
    }
  }
  return out
}

const PARTS_CONTROLS = partsControls()
const FLEET_ALLOWED_PARTS = new Set(PARTS_CONTROLS.flatMap((c) => c.declaredParts))

const renderedPartsOf = (host: Element): Set<string> => {
  const out = new Set<string>()
  for (const node of host.querySelectorAll('[data-part]')) out.add(node.getAttribute('data-part')!)
  return out
}

/** The gate's own predicate, factored out so the negative controls can drive it without a real construction. */
function partsViolations(rendered: ReadonlySet<string>, allowed: ReadonlySet<string>): string[] {
  return [...rendered].filter((r) => !allowed.has(r))
}

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('Gate 4 — descriptor↔DOM parts[] truthfulness (components package fleet, jsdom-constructible)', () => {
  it('found the parts-bearing fleet (anti-vacuous)', () => {
    expect(PARTS_CONTROLS.length).toBeGreaterThanOrEqual(25)
    expect(PARTS_CONTROLS.map((c) => c.tag)).toContain('ui-color-picker') // the L2 hole's own control
    expect(FLEET_ALLOWED_PARTS.has('dialog')).toBe(true) // ui-modal's part, legitimately consumed by nested composition (command-modal)
  })

  for (const c of PARTS_CONTROLS) {
    if (EXCLUSION_ALLOWLIST.has(c.tag)) {
      it.skip(`${c.tag} — SKIPPED (${EXCLUSION_ALLOWLIST.get(c.tag)})`, () => {})
      continue
    }
    it(`${c.tag}: every real [data-part] it renders is declared SOMEWHERE in the fleet's parts[] union`, async () => {
      const el = document.createElement(c.tag)
      if (REQUIRES_TRIGGER.has(c.tag)) el.append(document.createElement('button'))
      document.body.append(el)
      await whenFlushed()
      await raf()
      const rendered = renderedPartsOf(el)
      const bad = partsViolations(rendered, FLEET_ALLOWED_PARTS)
      // Report-only direction (per the dispatch): a declared part legitimately absent from a bare, unopened,
      // no-author-content construction (a lazy overlay panel, an empty chart with no series, …) is not a defect.
      const missing = c.declaredParts.filter((d) => !rendered.has(d))
      if (missing.length > 0) console.warn(`[naming-gates] ${c.tag}: declared-but-not-rendered (bare construction): ${missing.join(', ')}`)
      expect(bad, `${c.tag} rendered undeclared [data-part]: ${bad.join(', ')}`).toEqual([])
      el.remove()
    })
  }

  it('negative control: a rendered part with no governing descriptor anywhere is caught', () => {
    const host = document.createElement('div')
    host.innerHTML = '<span data-part="zzghost"></span>'
    expect(partsViolations(renderedPartsOf(host), FLEET_ALLOWED_PARTS)).toEqual(['zzghost'])
  })

  it('negative control: a real, fleet-declared part (even one owned by a DIFFERENT control) is not flagged — composition (color-picker composing ui-text-field/ui-swatch; command-modal composing ui-modal) is legitimate, per naming.md §6\'s cross-control part-name reuse rule', () => {
    const host = document.createElement('div')
    host.innerHTML = '<div data-part="dialog"></div>' // ui-modal's own part, not this synthetic host's
    expect(partsViolations(renderedPartsOf(host), FLEET_ALLOWED_PARTS)).toEqual([])
  })
})
