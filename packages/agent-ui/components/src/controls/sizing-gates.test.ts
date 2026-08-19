import { describe, it, expect } from 'vitest'
// Read every stylesheet as TEXT (never parsed by a CSS engine) — the styling-gates.test.ts /
// naming-gates.test.ts fs-read idiom. No `@types/node` devDep; vitest/node resolves this at runtime.
import { readFileSync, readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// sizing-gates.test.ts — ADR-0223 clause 5 (Fill by Default), the fleet component-sizing lint gate,
// sited beside styling-gates.test.ts / naming-gates.test.ts and in their exact shape: a raw-text
// fs-read of every CONTROL stylesheet (components + app), comments blanked, the FIRST `:scope` block
// of each `@scope` body extracted brace-matched, then TWO closed rules:
//   (i)  no inline-level `display` value on a non-exempt host (R1 — fill by default);
//   (ii) no host `min-inline-size` / `min-width` other than `0` (the R3(c) unclamp), the squareness
//        form `var(--ui-{name}-height)` (R3(a)), or a ratified allowlist entry — the clause 3(d)
//        whole-shape-floor table + the clause 4 exemption table, mirrored as consts below with this
//        comment pointing at the ADR (`.claude/docs/adr/0223-fill-by-default-fleet-sizing-contract.md`).
//
// SLICE-0 REPORT MODE (clause 5/7): the DEBT allowlist below additionally carries today's full
// Appendix §B/§C state (minus the slice-0 pilot, ui-text-field, already flipped), so the gate is
// GREEN while enumerating the migration debt — every §B/§C row it finds is REPORTED (console), never
// failed. The gate BITES on anything NOT in the tables (a NEW inline-posture host or out-of-role
// floor is a build defect from day one), and the DEBT table shrinks monotonically as slices 1–3 land
// (a fixed row left in DEBT is caught by the exact-match test below). It flips ENFORCING in slice 3
// (DEBT → the empty set; the R4/3(d) tables remain).

const ROOT = process.cwd()
const CONTROL_ROOTS = [
  `${ROOT}/packages/agent-ui/components/src/controls`,
  `${ROOT}/packages/agent-ui/app/src/controls`,
]
const read = (p: string): string => readFileSync(p, 'utf8') as string

function walkCss(dir: string): string[] {
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
    if (st.isDirectory()) out.push(...walkCss(p))
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}

/** Blank out comments (preserving newlines so reported line numbers stay true). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/** Every `@scope … { … }` body in the sheet, brace-matched. */
function scopeBodies(css: string): { start: number; body: string }[] {
  const out: { start: number; body: string }[] = []
  const re = /@scope[^{]*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    while (depth > 0 && i < css.length) {
      const ch = css[i]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      i += 1
    }
    out.push({ start: m.index, body: css.slice(m.index, i) })
  }
  return out
}

/** The FIRST bare `:scope { … }` block of an @scope body — the HOST's own declarations (parts,
 *  panels, and state legs like `:scope[inline]` / `:scope:hover` are NOT the default host posture). */
function firstScopeBlock(body: string): { offset: number; block: string } | null {
  const re = /(^|[\n{}])\s*:scope\s*\{/g
  const m = re.exec(body)
  if (m === null) return null
  let depth = 1
  let i = m.index + m[0].length
  while (depth > 0 && i < body.length) {
    const ch = body[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    i += 1
  }
  return { offset: m.index + m[0].length, block: body.slice(m.index + m[0].length, i - 1) }
}

const INLINE_DISPLAY = /display:\s*(inline(?:-block|-flex|-grid|-table)?)\s*[;}]/
const MIN_WIDTH = /min-(?:inline-size|width):\s*([^;}]+)[;}]/g
const SQUARENESS = /^var\(--ui-[a-z0-9-]+-height\)$/ // R3(a) — survives all states

type Violation = { name: string; kind: 'inline-display' | 'min-width'; detail: string }

/** Scan one sheet; `name` = the stylesheet basename sans `.css` (the host identity the tables key on). */
function scanSheet(name: string, css: string): Violation[] {
  const s = stripComments(css)
  const out: Violation[] = []
  for (const { body } of scopeBodies(s)) {
    const first = firstScopeBlock(body)
    if (first === null) continue
    const disp = INLINE_DISPLAY.exec(first.block)
    if (disp !== null) out.push({ name, kind: 'inline-display', detail: disp[1] })
    let m: RegExpExecArray | null
    MIN_WIDTH.lastIndex = 0
    while ((m = MIN_WIDTH.exec(first.block)) !== null) {
      const value = m[1].trim()
      if (value === '0' || SQUARENESS.test(value)) continue // R3(c) unclamp / R3(a) squareness — always legal
      out.push({ name, kind: 'min-width', detail: value })
    }
  }
  return out
}

// ── The ratified tables (ADR-0223 clauses 3(d) + 4 — closed lists, extended only by ADR) ────────────

/** Clause 4 — R4 exemptions: hosts whose inline-level posture or floor IS their ratified nature. */
const R4_EXEMPT_INLINE = new Set([
  'badge', 'icon', 'avatar', 'swatch', 'sparkline', 'swiper-label', // text-flow / display atoms
  'otp-field', 'segment', // interaction-geometry leaves (clause 4)
])
/** Clause 4 — R4 floor exemptions on the HOST's own first block (floating-surface / interaction floors). */
const R4_EXEMPT_FLOOR = new Set([
  'split-pane', // resizable-pane drag floor (§E ruling: interaction-geometry exempt)
  'badge', // `var(--ui-badge-box)` empty-label box floor — clause 3(a)'s "same role on a display atom" (badge.css:89)
])

/** Clause 3(d) — the whole-shape floor role (Appendix §C's eleven; stat/attachment join on their
 *  slice-3 posture flip). Token-overridable, surviving the fill state, each SPEC- or defect-anchored. */
const WHOLE_SHAPE_FLOORS = new Set([
  'bar-chart', 'line-chart', 'pie-chart', 'ladder', 'table', 'progress', 'ramp',
  'slider', 'slider-multi', 'timeline', 'status-stream',
])

// ── SLICE-0 REPORT-MODE DEBT — today's Appendix §B state, minus the ui-text-field pilot. Every row
//    here is a KNOWN violation awaiting its wave slice (1–3); the exact-match test keeps this table
//    honest in BOTH directions (a new offender fails; a fixed-but-still-listed row fails too). ─────────
const DEBT: Record<string, string[]> = {
  // slice 1 — the entry family
  textarea: ['min-width'],
  select: ['inline-display', 'min-width'],
  'combo-box': ['inline-display', 'min-width'],
  'multi-select': ['inline-display', 'min-width'],
  'conversation-composer': ['min-width'],
  // form-popover's 10ch TRIGGER floor (§E, slice 1) is on a PART, not the host's first :scope block —
  // outside this gate's host-only scan by construction; its slice-1 ruling rides the entry family.
  // slice 2 — action/selection
  button: ['inline-display'],
  toggle: ['inline-display'],
  checkbox: ['inline-display'],
  radio: ['inline-display'],
  switch: ['inline-display'],
  pagination: ['inline-display'],
  calendar: ['inline-display'],
  // slice 3 — display composites
  stat: ['inline-display', 'min-width'],
  attachment: ['inline-display', 'min-width'],
}

describe('sizing gates — Fill by Default (ADR-0223 cl.5, slice-0 REPORT MODE)', () => {
  const sheets = CONTROL_ROOTS.flatMap((root) => walkCss(root))

  it('the walk actually finds the fleet (anti-vacuous floor)', () => {
    expect(sheets.length).toBeGreaterThan(60)
  })

  it('every width opinion is in-role (R3(a)/(c)), ratified (R4 / 3(d)), or enumerated slice-1..3 debt — and the debt is REPORTED', () => {
    const unexpected: string[] = []
    const debtSeen: Record<string, Set<string>> = {}
    const report: string[] = []
    for (const sheet of sheets) {
      const name = (sheet.split('/').pop() as string).replace(/\.css$/, '')
      for (const v of scanSheet(name, read(sheet))) {
        if (v.kind === 'inline-display' && R4_EXEMPT_INLINE.has(v.name)) continue
        if (v.kind === 'min-width' && (WHOLE_SHAPE_FLOORS.has(v.name) || R4_EXEMPT_FLOOR.has(v.name))) {
          report.push(`  [role 3(d)/R4] ${v.name}: ${v.detail}`)
          continue
        }
        if (DEBT[v.name]?.includes(v.kind)) {
          ;(debtSeen[v.name] ??= new Set()).add(v.kind)
          report.push(`  [DEBT → wave] ${v.name}: ${v.kind} (${v.detail})`)
          continue
        }
        unexpected.push(`${v.name}: ${v.kind} (${v.detail})`)
      }
    }
    // REPORT MODE — enumerate the migration debt (ADR-0223 cl.7); green while the wave lands.
    console.info(`[sizing-gates] ADR-0223 report mode — ${report.length} ratified/enumerated width opinions:\n${report.join('\n')}`)

    // The gate BITES on anything outside the tables: a NEW inline host / out-of-role floor fails today.
    expect(unexpected, 'width opinions outside ADR-0223’s ratified tables + enumerated debt').toEqual([])

    // The DEBT table is exact in BOTH directions — a fixed row must LEAVE the table (monotonic shrink).
    const stale: string[] = []
    for (const [name, kinds] of Object.entries(DEBT)) {
      for (const kind of kinds) {
        if (!debtSeen[name]?.has(kind)) stale.push(`${name}: ${kind}`)
      }
    }
    expect(stale, 'DEBT rows no longer present in the fleet — shrink the table (ADR-0223 cl.7)').toEqual([])

    // The slice-0 pilot is DONE: ui-text-field must carry no violation at all.
    expect(report.some((r) => / text-field:/.test(r)), 'ui-text-field regressed — the slice-0 pilot flip is law').toBe(false)
  })

  it('negative control: the scan bites on a synthetic offender', () => {
    const synthetic = `
:where(ui-fake) {
  --ui-fake-min: 20ch;
}
@scope (ui-fake) {
  :scope {
    display: inline-grid; /* a comment saying display: block must NOT rescue it */
    min-inline-size: var(--ui-fake-min);
    min-width: 0; /* the legal unclamp — must NOT count */
  }
  :scope[inline] {
    display: inline-grid; /* a STATE leg — not the default host posture; must NOT count */
    min-inline-size: 20ch;
  }
  :scope > [data-part='panel'] {
    min-inline-size: 12rem; /* a PART — the gate scans hosts only; must NOT count */
  }
}`
    const hits = scanSheet('fake', synthetic)
    expect(hits).toHaveLength(2)
    expect(hits[0]).toEqual({ name: 'fake', kind: 'inline-display', detail: 'inline-grid' })
    expect(hits[1]).toEqual({ name: 'fake', kind: 'min-width', detail: 'var(--ui-fake-min)' })
    // and the squareness form is recognized as R3(a)-legal:
    const square = scanSheet('fake2', `@scope (ui-fake2) { :scope { min-inline-size: var(--ui-fake2-height); } }`)
    expect(square).toEqual([])
  })
})
