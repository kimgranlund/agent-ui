import { describe, it, expect } from 'vitest'
// shell-spacing-gate.test.ts — AC19 (SPEC-R11c/AC19, .claude/docs/spec/shell-archetypes-m5.spec.md
// §10 · "AC19 (extends §6) — the spacing-drift gate"): a raw px/rem literal in a spacing- or
// box-dimension declaration, across the named shell-family sheet set, that numerically equals a
// shipped ladder rung (an R11a module multiple or a --md-sys-space-* value at density 1) IS drift,
// never coincidence — it silently forks that box off every future token retune (density, module).
// This deterministic, browser-free test (plain `npm test`, no browser needed — it reads CSS source
// as text) holds the count at the AC19 baseline. A future red here reads as law, not lint noise.
//
// GH #213 — the token-minting laundering hole. AC19(b) originally covered spacing-PROPERTY
// declarations only; a raw rung minted INTO a `--ui-*` token (`--ui-x: 0.75rem`) then consumed
// elsewhere would pass both this gate (it never inspected custom-property declarations) and the
// consumption-side styling gates (they check consumption spelling, not minting spelling). The
// predicate below now ALSO reaches `--ui-*` declarations, via a parens-aware top-level ARM split
// (topLevelArms/isMintedDimensionValue/mintedArmLiterals, below): a value enters scope when EVERY
// top-level arm is dimension-shaped (a bare literal, `0`, a `var(...)` reference, or a `calc(...)`
// expression) — a single bare literal or calc() is just the one-arm case. A composite value with a
// non-dimension arm (a box-shadow token's `rgb(...)` arm) stays out of scope BY CONSTRUCTION, not a
// carve-out: it is doing something other than compositing dimensions. Round 2 (this revision)
// widened round 1's single-arm-only shape gate after review found a live hole: a genuine two-value
// mint written with raw literals (`--ui-x: 0.5rem 0.75rem`) matched neither of round 1's whole-value
// regexes and passed unseen — the arm split catches it, scanning each dimension-shaped arm on its
// own (var() arms, fallback included, stay excluded — GH #213's fallback-exclusion rule held
// consistent in multi-value position). So `calc(var(--ui-super-shell-module) / 3)` passes (no
// literal arm), `calc(0.375rem * 2)` fails, and `0.5rem 0.75rem` now fails on BOTH arms.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()

// AC19(a) — the sheet set: every {name}.css under @agent-ui/app's controls/, plus every site sheet
// whose selectors lay out a shell element, its parts, or a component composing one (today all
// seven — GH #213 appends app-shell.css). Extending this set is a one-line reviewed append — the
// FOCUS_TIMING_FILES precedent (vitest.browser.config.ts, GH #56).
const SHELL_FAMILY_SHEETS = [
  // @agent-ui/app's controls/ — every sheet, unconditionally (the package composes shells throughout).
  'packages/agent-ui/app/src/controls/agent-admin/agent-admin.css',
  'packages/agent-ui/app/src/controls/app-shell/app-shell.css',
  'packages/agent-ui/app/src/controls/app-shell/app-shell-isolation.css',
  'packages/agent-ui/app/src/controls/chat-shell/chat-shell.css',
  'packages/agent-ui/app/src/controls/conversation/conversation.css',
  'packages/agent-ui/app/src/controls/conversation/conversation-composer.css',
  'packages/agent-ui/app/src/controls/master-detail/master-detail.css',
  'packages/agent-ui/app/src/controls/master-detail/master-detail-pane.css',
  'packages/agent-ui/app/src/controls/nav-rail/nav-rail.css',
  'packages/agent-ui/app/src/controls/settings/settings.css',
  'packages/agent-ui/app/src/controls/super-shell/super-shell.css',
  'packages/agent-ui/app/src/controls/surface-host/surface-host.css',
  'packages/agent-ui/app/src/controls/workspace-shell/workspace-shell.css',
  // the seven site sheets named in the clause.
  'site/pages/_page.css',
  'site/pages/a2ui-live.css',
  'site/pages/a2ui-chat.css',
  'site/pages/super-shell.css',
  'site/pages/chat-shell.css',
  'site/pages/agent-admin-app.css',
  'site/pages/app-shell.css',
]

// AC19(b) — the property families in scope: padding*/margin*, gap/row-gap/column-gap, the inset*
// family + top/right/bottom/left, and the logical/physical box-size properties incl. min-*/max-*.
// (GH #213 widens (b) further, to minted `--ui-*` custom properties — see isMintedDimensionValue
// below; that check is applied separately, inline in the violation loop, since its eligibility
// depends on the VALUE shape, not just the property name.)
const SPACING_PROPERTIES = new Set([
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-block-start', 'padding-block-end',
  'padding-inline', 'padding-inline-start', 'padding-inline-end',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-block-start', 'margin-block-end',
  'margin-inline', 'margin-inline-start', 'margin-inline-end',
  'gap', 'row-gap', 'column-gap',
  'inset', 'inset-block', 'inset-block-start', 'inset-block-end',
  'inset-inline', 'inset-inline-start', 'inset-inline-end',
  'top', 'right', 'bottom', 'left',
  'width', 'height', 'inline-size', 'block-size',
  'min-width', 'max-width', 'min-height', 'max-height',
  'min-inline-size', 'max-inline-size', 'min-block-size', 'max-block-size',
])

// The two ladders AC19(b) tests a literal against, both realized at their SHIPPED rungs only (16px
// root, density 1 — the only density any shipped app renders under).
const MODULE_PX = 18 // --ui-super-shell-module = 1.125rem (super-shell.css's token block, R11a)
const MODULE_MULTIPLES = [1 / 3, 2 / 3, 1, 3, 9, 14] // ×2 is deliberately absent — no shipped rung (R11c)
const SPACE_PX_DENSITY_1 = [4, 8, 12, 16, 24, 32] // --md-sys-space-* at density 1 (dimensions.css)
const LADDER_PX = [...new Set([...MODULE_MULTIPLES.map((m) => MODULE_PX * m), ...SPACE_PX_DENSITY_1])]

// AC19(c) — the allowlist: an explicit (file, declaration, reason) list. At landing, exactly ONE
// entry — R11c's resizer thickness. Growing it is a reviewed act, never a drive-by (R11c). GH #213
// appends a second entry (below) for the custom-property predicate's own one necessary exception.
interface AllowlistEntry {
  file: string
  selectorContains: string
  property: string
  literal: string
  reason: string
}
const ALLOWLIST: AllowlistEntry[] = [
  {
    file: 'packages/agent-ui/app/src/controls/super-shell/super-shell.css',
    selectorContains: "[data-part='pane-resizer']",
    property: 'inline-size',
    literal: '0.25rem',
    reason:
      "SPEC-R11c's one AC19 exception — the pane-resizer's hit-target thickness is a control " +
      'dimension that coincides with --md-sys-space-xs numerically, not semantically.',
  },
  {
    file: 'packages/agent-ui/app/src/controls/super-shell/super-shell.css',
    selectorContains: ':where(ui-super-shell)',
    property: '--ui-super-shell-module',
    literal: '1.125rem',
    reason:
      "GH #213 — R11a's own ROOT definition: the module IS the 18px origin of the entire ladder " +
      '("the head of super-shell.css\'s token block"), so there is no var() to chain it to — its ' +
      'own literal spelling is the one lawful exception, mirrored from this same allowlist\'s ' +
      'resizer-thickness precedent.',
  },
]

interface Declaration {
  file: string
  selector: string
  property: string
  value: string
  index: number
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

// @media/@container/@supports preludes can carry colon syntax that looks like a declaration
// (`@media (min-width: 40rem)`) — neutralize the prelude text (keep newlines, drop the rest) so it
// can never masquerade as a `property: value` pair below.
function stripAtRulePreludes(css: string): string {
  return css.replace(/@(?:media|container|supports)\b[^{]*\{/g, (m) => m.slice(0, -1).replace(/[^\n]/g, ' ') + '{')
}

function lineAt(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++
  return line
}

// A minimal brace-depth walker: yields every `property: value` declaration together with its
// innermost enclosing selector text, so the allowlist can match on real rule identity instead of a
// line number that drifts under an unrelated edit.
function declarationsOf(file: string, raw: string): { decls: Declaration[]; text: string } {
  const text = stripAtRulePreludes(stripComments(raw))
  const decls: Declaration[] = []
  const selectorStack: string[] = []
  let segStart = 0
  const tryPush = (segEnd: number) => {
    const seg = text.slice(segStart, segEnd)
    const m = /^(\s*)([a-zA-Z-]+)\s*:\s*([\s\S]*)$/.exec(seg)
    // report the line the PROPERTY NAME itself sits on, not segStart (the char right after the
    // previous declaration's terminator, which is usually still that previous line's newline).
    if (m) decls.push({ file, selector: selectorStack.at(-1) ?? '', property: m[2]!, value: m[3]!, index: segStart + m[1]!.length })
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      selectorStack.push(text.slice(segStart, i).trim())
      segStart = i + 1
    } else if (ch === '}') {
      tryPush(i)
      selectorStack.pop()
      segStart = i + 1
    } else if (ch === ';') {
      tryPush(i)
      segStart = i + 1
    }
  }
  return { decls, text }
}

const LITERAL_RE = /(-?\d*\.?\d+)(px|rem)\b/g

function literalsOf(value: string): { token: string; px: number }[] {
  const hits: { token: string; px: number }[] = []
  for (const m of value.matchAll(LITERAL_RE)) {
    const num = parseFloat(m[1]!)
    const unit = m[2]!
    hits.push({ token: m[0], px: unit === 'rem' ? num * 16 : num })
  }
  return hits
}

// GH #213 — is this custom property a candidate for the minting check at all?
const CUSTOM_PROPERTY_RE = /^--ui-/
function isCustomProperty(property: string): boolean {
  return CUSTOM_PROPERTY_RE.test(property)
}

// GH #213 (review round 2) — a parens-aware top-level arm splitter: splits a value on whitespace
// ONLY at paren-depth 0, so `calc(var(--x) * 2)` or `var(--y, 0.25rem)` each stay ONE arm (their
// internal spaces sit at depth > 0) while `var(--a) var(--b)` (a genuine two-value mint) splits into
// two. This is the SAME mechanism a real multi-value token uses (`--ui-agent-admin-card-pad:
// var(--md-sys-space-sm) var(--md-sys-space-md)`), so it is the right unit to classify.
function topLevelArms(value: string): string[] {
  const arms: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) {
      if (cur) arms.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) arms.push(cur)
  return arms
}

// GH #213 (review round 2) — the minted-value shape gate: EVERY top-level arm of the value must be
// dimension-shaped — a bare `<number><px|rem>` literal, a bare `0`, a `var(...)` reference (with or
// without a fallback), or a `calc(...)` expression. A single bare literal or calc() (round 1's shape)
// is simply the one-arm case of this same rule. Anything else in ANY arm — an `rgb(...)` arm inside
// a box-shadow token, a bare keyword — disqualifies the WHOLE declaration: it is doing something
// other than compositing dimensions, so it stays out of scope by construction, not by carve-out.
// This closes the round-1 hole the review's counterfactual found: `--ui-x: 0.5rem 0.75rem` (two
// rungs laundered in one multi-value declaration) matched NEITHER of round 1's whole-value regexes
// (a bare-literal OR bare-calc match requires the ENTIRE value to be one token), so it passed
// unseen. Under the arm split, both `0.5rem` and `0.75rem` are individually dimension-shaped arms,
// so the declaration enters scope and each arm is scanned on its own (see mintedArmLiterals).
const DIMENSION_ARM_RE = /^(?:-?\d*\.?\d+(?:px|rem)|0|var\(.*\)|calc\(.*\))$/i
function isMintedDimensionValue(value: string): boolean {
  const arms = topLevelArms(value)
  return arms.length > 0 && arms.every((arm) => DIMENSION_ARM_RE.test(arm))
}

// GH #213 (review round 2) — literal scanning for an in-scope minted custom property applies PER
// ARM, skipping any arm whose outer function is `var(...)` entirely (including its own fallback
// literal, if it has one) — the round-1 fallback-exclusion rule ("a fallback belongs to THAT
// token's declaration, not this one's") held consistent in multi-value position, not just the
// single-arm case. A bare-literal or calc() arm IS scanned (via the same `literalsOf` the spacing-
// property check already uses), so a calc() arm's own literal sub-terms are still caught arm-by-arm.
function mintedArmLiterals(value: string): { token: string; px: number }[] {
  return topLevelArms(value)
    .filter((arm) => !/^var\(/i.test(arm))
    .flatMap((arm) => literalsOf(arm))
}

function isAllowlisted(d: Declaration, literalToken: string): boolean {
  return ALLOWLIST.some(
    (a) =>
      a.file === d.file &&
      a.property === d.property &&
      a.literal === literalToken &&
      d.selector.includes(a.selectorContains),
  )
}

describe('AC19 — the shell-family spacing-literal drift gate (SPEC-R11c/AC19)', () => {
  it('every SHELL_FAMILY_SHEETS entry exists on disk (the sheet enumeration, verified live)', () => {
    const missing = SHELL_FAMILY_SHEETS.filter((rel) => {
      try {
        readFileSync(`${ROOT}/${rel}`, 'utf8')
        return false
      } catch {
        return true
      }
    })
    expect(missing, missing.join(', ')).toEqual([])
  })

  it('the allowlist carries exactly TWO entries after the GH #213 follow-up append (R11c — growing it further is a reviewed act, never a drive-by)', () => {
    expect(ALLOWLIST.length).toBe(2)
  })

  it('no raw px/rem literal in a spacing-/box-dimension declaration, OR in a minted --ui-* custom-property value, equals a shipped ladder rung, unless allowlisted', () => {
    const violations: string[] = []
    for (const rel of SHELL_FAMILY_SHEETS) {
      const raw = readFileSync(`${ROOT}/${rel}`, 'utf8')
      const { decls, text } = declarationsOf(rel, raw)
      for (const d of decls) {
        const isSpacingProp = SPACING_PROPERTIES.has(d.property)
        const isMintedCustomProp = isCustomProperty(d.property) && isMintedDimensionValue(d.value)
        if (!isSpacingProp && !isMintedCustomProp) continue
        // Spacing properties keep the ORIGINAL whole-value scan (unchanged by GH #213 round 2 — the
        // review scoped the arm split to custom-property mints only); a minted custom property
        // scans per-arm, skipping var() arms (mintedArmLiterals, above).
        const hits = isSpacingProp ? literalsOf(d.value) : mintedArmLiterals(d.value)
        for (const { token, px } of hits) {
          const rung = LADDER_PX.find((l) => Math.abs(px - l) < 0.01)
          if (rung === undefined) continue
          if (isAllowlisted(d, token)) continue
          const line = lineAt(text, d.index)
          violations.push(
            `${rel}:${line} — ${d.property}: ${d.value.trim()} (literal ${token} = ${px}px, matches the ` +
              `${rung}px ladder rung; SPEC-R11c/AC19: convert to its var(--md-sys-space-*) or module-chain spelling)`,
          )
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
