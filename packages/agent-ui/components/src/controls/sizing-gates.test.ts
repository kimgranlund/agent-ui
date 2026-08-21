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
// SLICE-3 ENFORCING (clause 5/7, the R5 flip): the DEBT allowlist below is now the EMPTY SET — every
// migration-wave row (Appendix §B's 15) has landed across slices 0–3, so the gate no longer REPORTS
// known debt, it ENFORCES: any width opinion outside the ratified clause 3(d)/4 tables — a NEW
// inline-posture host or an out-of-role floor — is a build defect from day one, full stop. (The DEBT
// table + its exact-match plumbing stay in the file, permanently empty, as the ratchet: a future ADR
// amendment is the only way a row re-enters it — see the naming/styling-gates sibling gates for the
// same "empty allowlist as a standing ratchet" shape.)

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

/** Clause 3(d) — the whole-shape floor role (Appendix §C's eleven, plus `stat`/`attachment` which
 *  joined on their slice-3 posture flip — the full ratified thirteen). Token-overridable, surviving
 *  the fill state, each SPEC- or defect-anchored. */
const WHOLE_SHAPE_FLOORS = new Set([
  'bar-chart', 'line-chart', 'pie-chart', 'ladder', 'table', 'progress', 'ramp',
  'slider', 'slider-multi', 'timeline', 'status-stream', 'stat', 'attachment',
  // ADR-0229 cl.6 — the two role-(d) rows this ADR names: `ui-column-chart` (wave 1) + `ui-gauge`
  // (wave 3, this build — both now real, shipped controls; the sizing-gates.test.ts own "extended only
  // by ADR, and only for a REAL control" discipline is satisfied for both rows).
  'column-chart', 'gauge',
])

// ── DEBT — the migration-wave allowlist (Appendix §B's 15 rows, slices 0–3). ENFORCING as of slice 3
//    (the R5 flip): the table is now the EMPTY SET — every row shrank out across the four slices
//    (0: ui-text-field · 1: textarea/select/combo-box/multi-select/conversation-composer +
//    form-popover trigger · 2: button/toggle/checkbox/radio/switch/pagination/calendar ·
//    3: stat/attachment). The exact-match test below still keeps it honest in BOTH directions — it
//    stays empty going forward; only a future ADR amendment may add a row back. ─────────────────────
const DEBT: Record<string, string[]> = {}

describe('sizing gates — Fill by Default (ADR-0223 cl.5, slice-3 ENFORCING — DEBT table EMPTY)', () => {
  const sheets = CONTROL_ROOTS.flatMap((root) => walkCss(root))

  it('the walk actually finds the fleet (anti-vacuous floor)', () => {
    expect(sheets.length).toBeGreaterThan(60)
  })

  it('every width opinion is in-role (R3(a)/(c)) or ratified (R4 / 3(d)) — ENFORCING, zero debt remains', () => {
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
    // ENFORCING — the migration wave is complete (ADR-0223 cl.7); every width opinion left standing is
    // a RATIFIED one (role 3(d) / R4), never a debt row.
    console.info(`[sizing-gates] ADR-0223 slice-3 ENFORCING — ${report.length} ratified width opinions:\n${report.join('\n')}`)

    // The gate BITES on anything outside the tables: a NEW inline host / out-of-role floor fails.
    expect(unexpected, 'width opinions outside ADR-0223’s ratified tables').toEqual([])

    // The DEBT table is exact in BOTH directions (permanently empty as of slice 3 — the ratchet:
    // any row a future amendment adds back must actually be found, or this fails too).
    const stale: string[] = []
    for (const [name, kinds] of Object.entries(DEBT)) {
      for (const kind of kinds) {
        if (!debtSeen[name]?.has(kind)) stale.push(`${name}: ${kind}`)
      }
    }
    expect(stale, 'DEBT rows no longer present in the fleet — shrink the table (ADR-0223 cl.7)').toEqual([])

    // Every non-role-(d) wave control must carry no violation at all — a regressed inline-posture flip
    // (or a resurrected default-state content floor) would surface in `unexpected` above, not here; this
    // is the same "must be entirely absent from the report" pin the slice-0 pilot introduced, generalized
    // to every wave control WITHOUT a surviving role-(d) floor (stat/attachment DO legitimately appear in
    // `report` — their whole-shape floor is ratified role (d), not a regression).
    const NO_SURVIVING_FLOOR = ['text-field', 'textarea', 'select', 'combo-box', 'multi-select', 'conversation-composer', 'button', 'toggle', 'checkbox', 'radio', 'switch', 'pagination', 'calendar']
    for (const name of NO_SURVIVING_FLOOR) {
      expect(report.some((r) => r.includes(` ${name}:`)), `${name} regressed — its ADR-0223 flip is law`).toBe(false)
    }
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
