import { describe, it, expect } from 'vitest'
// Read every source file as TEXT (never executed) — the sizing-gates.test.ts / styling-gates.test.ts
// fs-read idiom. No `@types/node` devDep; vitest/node resolves this at runtime.
import { readFileSync, readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// state-grammar-gates.test.ts — ADR-0227 clause 2's persistence rule ("Persistence rides
// `StorageAdapter` — never a raw `localStorage` touch-point"), the fleet state-grammar ratchet gate
// (GH #1544), sited beside the seam it enforces and in the sizing-gates.test.ts shape: a raw-text
// fs-read of every SOURCE file (packages + site + scripts + .claude/ops), comments and string
// literals blanked, then ONE closed rule — no `localStorage.…`/`localStorage[…]`/`indexedDB` touch
// outside (i) this directory (the sanctioned tiers), (ii) test files (they seed/assert storage
// deliberately), and (iii) the ALLOWLIST below.
//
// ENFORCING from day one, DEBT table EMPTY (the GH #1544 drain landed in this same change: the five
// site bypasses the data-model review inventoried — theme-loader, provider-mode-selection, _page nav
// flag, gen-ui-live dogfood toggle, agent-admin-presets (already retired by ADR-0227 wave 1) — all
// ride the localStorage tier now). The DEBT table + its exact-match plumbing stay in the file,
// permanently empty, as the ratchet: a new raw touch anywhere is a build defect from day one; a
// future entry requires a ruled decision, and draining it requires removing the row in the same
// change (the table is exact in BOTH directions, so a stale row also reds the gate).

const ROOT = process.cwd()
const SCAN_ROOTS = ['packages/agent-ui', 'site', 'scripts', '.claude/ops']
/** The sanctioned implementations — the StorageAdapter contract + its localStorage/IndexedDB tiers
 *  (ADR-0193). The ONE place raw `localStorage`/`indexedDB` may live. */
const SANCTIONED_DIR = 'packages/agent-ui/shared/src/storage/'
const EXTENSIONS = ['.ts', '.mts', '.js', '.mjs']

/** Ruled standing exceptions (path → the ruling + the EXACT touch count it was ruled for). NOT debt
 *  — each row names why it stays; a row whose file no longer contains a raw touch is STALE and reds
 *  the gate (remove it), and so does a file that quietly ACCUMULATES touches beyond what was ruled
 *  (`count` pins it — an allowlisted file is not a blank check for more raw touches). */
const ALLOWLIST: Record<string, { ruling: string; count: number }> = {
  // GH #1544 ruling: an ops proof harness clearing a live page's whole origin state between M-B proof
  // runs — not app code persisting through a seam; allowlisted, never migrated.
  '.claude/ops/mb-live-proof/mb-live-proof.harness.ts': { ruling: 'ops proof harness — resets live-page storage between runs', count: 1 },
  // ADR-0227 wave 1 (PR #1543): the EXPLICIT LEGACY MIGRATION READ stated in that PR — one tolerant
  // raw read keeps every existing user's active-persona selection; the next write re-persists through
  // the adapter and the branch goes quiet. Remove this row when the legacy branch retires.
  'packages/agent-ui/app/src/controls/agent-admin/persona-roster-source.ts': { ruling: 'ADR-0227 wave-1 legacy migration read (self-quieting)', count: 1 },
}

/** The migration-wave debt table — EMPTY from day one (the GH #1544 drain shipped with the gate).
 *  The ratchet only tightens: a row re-enters only under a ruled decision, and must then actually be
 *  found (the exact-match test below fails on a stale row too). */
const DEBT: Record<string, string[]> = {}

const read = (p: string): string => readFileSync(p, 'utf8') as string

const isSourceFile = (name: string): boolean =>
  EXTENSIONS.some((ext) => name.endsWith(ext)) && !name.includes('.test.') && !name.endsWith('.d.ts')

/** Walk a tree collecting source files; dot-directories (`.fixture-scratch`, `.git`, …) and
 *  build/dependency output are never scanned. */
function walkSources(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const out: string[] = []
  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'coverage') continue
    const p = `${dir}/${name}`
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walkSources(p))
    else if (isSourceFile(name)) out.push(p)
  }
  return out
}

/**
 * Blank everything that is not live code — line/block comments, string literals, and template
 * literals (whole, interpolations included) — preserving newlines so reported line numbers stay
 * true. A single left-to-right state scan, not a regex, so an apostrophe inside a comment or a
 * `//` inside a string never derails it (doc pages carry `localStorage.…` in code-sample STRINGS;
 * banners carry it in comments — neither is a touch).
 *
 * Two KNOWN, deliberately unhandled shapes (documented rather than chased — code-review finding,
 * GH #1544): (1) a `${…}` template INTERPOLATION is blanked along with its literal, so
 * `` `${localStorage.getItem('k')}` `` would pass uncaught — no live file does this today (the
 * gate is green); (2) a regex LITERAL containing a quote char (`` /['"]/ ``) is not modeled as its
 * own state, so the scanner would misread it as entering a string and blank real code that
 * follows — again, no live file trips it. Both are false-NEGATIVE risks (the ratchet could miss a
 * bypass hidden this way), the opposite of a false-positive; harden the state machine if either
 * shape is ever actually authored.
 */
function blankNonCode(src: string): string {
  const out = src.split('')
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let state: State = 'code'
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    const next = src[i + 1]
    if (state === 'code') {
      if (ch === '/' && next === '/') state = 'line'
      else if (ch === '/' && next === '*') state = 'block'
      else if (ch === "'") state = 'single'
      else if (ch === '"') state = 'double'
      else if (ch === '`') state = 'template'
      if (state !== 'code' && ch !== '\n') out[i] = ' '
      continue
    }
    // inside a non-code region — blank it (newlines survive for line numbering)
    if (ch !== '\n') out[i] = ' '
    if (state === 'line' && next === '\n') state = 'code'
    else if (state === 'block' && ch === '*' && next === '/') {
      out[i + 1] = ' '
      i += 1
      state = 'code'
    } else if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) {
      // closing quote — unless escaped
      if (src[i - 1] !== '\\' || src[i - 2] === '\\') state = 'code'
    } else if ((state === 'single' || state === 'double') && ch === '\n') {
      state = 'code' // an unterminated single-line string never swallows the rest of the file
    }
  }
  return out.join('')
}

const RAW_LOCAL_STORAGE = /\blocalStorage\s*[.[]/g
const RAW_INDEXED_DB = /\bindexedDB\b/g

type Violation = { line: number; match: string }

/** Scan one file's TEXT for raw storage touches (comments/strings already discounted). */
function scanSource(src: string): Violation[] {
  const code = blankNonCode(src)
  const out: Violation[] = []
  for (const re of [RAW_LOCAL_STORAGE, RAW_INDEXED_DB]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      const line = code.slice(0, m.index).split('\n').length
      out.push({ line, match: m[0].trim() })
    }
  }
  return out.sort((a, b) => a.line - b.line)
}

describe('state-grammar gates — persistence rides StorageAdapter (ADR-0227 cl.2, ENFORCING — DEBT table EMPTY)', () => {
  const files = SCAN_ROOTS.flatMap((root) => walkSources(`${ROOT}/${root}`))
  const relOf = (abs: string): string => abs.slice(ROOT.length + 1)

  it('the walk actually finds the estate (anti-vacuous floor)', () => {
    expect(files.length).toBeGreaterThan(300)
    // and the sanctioned tiers + every allowlisted file genuinely exist on disk (a moved/renamed
    // sanctioned dir would otherwise silently un-sanction nothing and this gate would lie)
    expect(files.some((f) => relOf(f).startsWith(SANCTIONED_DIR)), 'the sanctioned storage tiers exist and are walked').toBe(true)
    for (const allowed of Object.keys(ALLOWLIST)) expect(statSync(`${ROOT}/${allowed}`).isFile(), allowed).toBe(true)
  })

  it('no raw localStorage/indexedDB touch outside the sanctioned tiers, tests, and the allowlist — ENFORCING, zero debt', () => {
    const unexpected: string[] = []
    const allowSeen = new Set<string>()
    const debtSeen: Record<string, Set<string>> = {}
    const report: string[] = []
    for (const file of files) {
      const rel = relOf(file)
      if (rel.startsWith(SANCTIONED_DIR)) continue // the sanctioned implementations themselves
      const hits = scanSource(read(file))
      if (hits.length === 0) continue
      if (rel in ALLOWLIST) {
        allowSeen.add(rel)
        const { ruling, count } = ALLOWLIST[rel]!
        report.push(`  [allowlist] ${rel} — ${ruling} (${hits.length} touch${hits.length === 1 ? '' : 'es'}, ruled for ${count})`)
        // An allowlisted file is ruled for an EXACT touch count, not a blank check — a NEW raw touch
        // accumulating in an already-allowlisted file reds the gate exactly like an unlisted one.
        if (hits.length !== count) {
          unexpected.push(
            `${rel} — allowlisted for exactly ${count} touch${count === 1 ? '' : 'es'} (${ruling}) but the file now has ${hits.length}; a new raw touch needs its own ruling, not a wider allowance`,
          )
        }
        continue
      }
      for (const hit of hits) {
        if (DEBT[rel]?.includes(String(hit.line))) {
          ;(debtSeen[rel] ??= new Set()).add(String(hit.line))
          report.push(`  [DEBT → drain] ${rel}:${hit.line} (${hit.match})`)
          continue
        }
        unexpected.push(`${rel}:${hit.line} — raw \`${hit.match}\` outside the StorageAdapter seam (ADR-0227 cl.2; persist through @agent-ui/shared's storage tiers)`)
      }
    }
    console.info(`[state-grammar-gates] ADR-0227 cl.2 ENFORCING — ${report.length} ruled standing entries:\n${report.join('\n')}`)

    // The gate BITES on anything outside the tables: a new raw touch anywhere fails.
    expect(unexpected, 'raw storage touches outside the sanctioned seam (GH #1544 ratchet)').toEqual([])

    // The ALLOWLIST is exact in BOTH directions: a row whose file no longer touches raw storage is
    // stale — remove it (the ratchet only tightens).
    const staleAllow = Object.keys(ALLOWLIST).filter((p) => !allowSeen.has(p))
    expect(staleAllow, 'stale ALLOWLIST rows — the file no longer touches raw storage; remove the row').toEqual([])

    // The DEBT table likewise (permanently empty as of GH #1544 — any row a future ruling adds back
    // must actually be found, or this fails too).
    const staleDebt: string[] = []
    for (const [rel, lines] of Object.entries(DEBT)) {
      for (const line of lines) {
        if (!debtSeen[rel]?.has(line)) staleDebt.push(`${rel}:${line}`)
      }
    }
    expect(staleDebt, 'DEBT rows no longer present — shrink the table (the ratchet only tightens)').toEqual([])
  })

  it('the ADR-0227 wave-1 retirements stay retired — agent-admin-presets/agent-admin-app carry zero raw touches', () => {
    // GH #1544's own verification clause: PR #1543 retired the hand-rolled SettingsStore duplicate and
    // the ACTIVE_PRESET_KEY write; neither may quietly return (they'd red the main gate above too —
    // this pin just names them, so a regression reports as exactly what it is).
    for (const rel of ['site/pages/agent-admin-presets.ts', 'site/pages/agent-admin-app.ts']) {
      expect(scanSource(read(`${ROOT}/${rel}`)), `${rel} regressed — ADR-0227 wave 1 retired its raw storage`).toEqual([])
    }
  })

  it('negative control: the scan bites on a planted bypass and stays quiet on comments/strings', () => {
    const planted = `
// a COMMENT saying localStorage.getItem must NOT count
const doc = 'a STRING saying localStorage.setItem("k", v) must NOT count'
const tpl = \`and a TEMPLATE with indexedDB.open() must NOT count\`
const v = localStorage.getItem('the-planted-bypass') // ← the gate must catch THIS
localStorage['setItem']('evasion', 'bracket access counts too')
const db = indexedDB.open('raw-idb-counts')
const guard = typeof localStorage !== 'undefined' // a bare guard (no touch) must NOT count
`
    const hits = scanSource(planted)
    expect(hits.map((h) => h.line)).toEqual([5, 6, 7])
    // and a clean file scans clean (the sanctioned consumers' shape):
    expect(scanSource(`const adapter = createLocalStorageAdapter({ namespace: 'agent-ui' })\nconst x = adapter.getSync('theme')\n`)).toEqual([])
  })
})
