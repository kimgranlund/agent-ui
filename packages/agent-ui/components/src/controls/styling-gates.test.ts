import { describe, it, expect } from 'vitest'
// Read every stylesheet as TEXT (never parsed by a CSS engine) — the naming-gates.test.ts /
// docs-grammar.test.ts fs-read idiom. No `@types/node` devDep; vitest/node resolves this at runtime.
import { readFileSync, readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// styling-gates.test.ts — the TKT-0066 item 5 ruling's standing trip-wire (Kim-ruled 2026-07-15;
// tokens.md §Consumption invariants owns the law): a component's `@scope` STYLES block never reads a
// dimensional `:root` constant (`--md-sys-font-*` · `--md-sys-space-*` · `--md-sys-shape-corner-base`) directly — it
// mints a role-named `--ui-{cmp}-*` token in its `:where()` TOKEN block and consumes that, exactly as
// color roles route. Declarations INSIDE a `:where()` token block (the minting itself) are the
// sanctioned shape and are out of scope here by construction: the gate scans only `@scope { ... }`
// bodies. The sanctioned DIRECT-read list stays the fleet constants (ring/motion/control-line-height),
// none of which match the three banned prefixes — so this gate needs no allowlist.
//
// Sited beside naming-gates.test.ts (the fleet's other repo-wide text-level gate) because it is the
// same shape: a closed rule swept over every package's real stylesheets + a synthetic negative
// control proving the scan bites. The fleet was swept clean at the ruling (9 files / 22 reads routed);
// a NEW direct read is a build defect from day one.

const ROOT = process.cwd()
const PACKAGES_ROOT = `${ROOT}/packages/agent-ui`
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

/** Blank out comments (preserving newlines so reported line numbers stay true) — a `var(--md-sys-space-…)`
 *  QUOTED in a rationale comment is documentation, not a read (the css-comment pitfall class). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/** Every `@scope … { … }` body in the sheet, brace-matched (an @scope block nests rules). */
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

const BANNED_READ = /var\((--md-sys-(?:font|space)[a-z0-9-]*|--md-sys-shape-corner-base)/g

/** All banned dimensional-constant reads inside a sheet's @scope bodies, as `line: token` strings. */
function bannedReads(css: string): string[] {
  const s = stripComments(css)
  const hits: string[] = []
  for (const { start, body } of scopeBodies(s)) {
    let m: RegExpExecArray | null
    BANNED_READ.lastIndex = 0
    while ((m = BANNED_READ.exec(body)) !== null) {
      const line = s.slice(0, start + m.index).split('\n').length
      hits.push(`:${line} ${m[1]}`)
    }
  }
  return hits
}

describe('styling gates — dimensional constants route through the own chain (TKT-0066 item 5)', () => {
  const sheets = readdirSync(PACKAGES_ROOT)
    .map((pkg) => `${PACKAGES_ROOT}/${pkg}/src`)
    .flatMap((src) => walkCss(src))

  it('the walk actually finds the fleet (anti-vacuous floor)', () => {
    expect(sheets.length).toBeGreaterThan(60) // 69 components + shared/site-adjacent sheets at gate birth
  })

  it('no @scope body reads --md-sys-font-* / --md-sys-space-* / --md-sys-shape-corner-base directly', () => {
    const offenders: string[] = []
    for (const sheet of sheets) {
      for (const hit of bannedReads(read(sheet))) {
        offenders.push(`${sheet.slice(ROOT.length + 1)}${hit}`)
      }
    }
    // A hit here is a NEW direct read post-ruling: mint a role-named --ui-{cmp}-* token in the
    // :where() block (family leaves mint in the family tunnel, ADR-0124) and consume that instead.
    expect(offenders).toEqual([])
  })

  it('negative control: the scan bites on a synthetic offender', () => {
    const synthetic = `
:where(ui-fake) {
  --ui-fake-pad: var(--md-sys-space-sm); /* minting — sanctioned, outside @scope */
}
@scope (ui-fake) {
  :scope {
    padding: var(--md-sys-space-sm); /* comment mentions var(--md-sys-font-md) — must NOT count */
    border-radius: var(--md-sys-shape-corner-base);
    gap: var(--ui-fake-pad);
  }
}`
    const hits = bannedReads(synthetic)
    expect(hits).toHaveLength(2)
    expect(hits[0]).toContain('--md-sys-space-sm')
    expect(hits[1]).toContain('--md-sys-shape-corner-base')
  })
})
