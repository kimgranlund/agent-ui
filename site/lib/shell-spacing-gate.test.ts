import { describe, it, expect } from 'vitest'
// shell-spacing-gate.test.ts — AC19 (SPEC-R11c/AC19, .claude/docs/spec/shell-archetypes-m5.spec.md
// §10 · "AC19 (extends §6) — the spacing-drift gate"): a raw px/rem literal in a spacing- or
// box-dimension declaration, across the named shell-family sheet set, that numerically equals a
// shipped ladder rung IS drift, never coincidence, it silently forks that box off every future
// retune of n. T-0121 (ADR-0245 cl.6) repointed the ladder: it was the shell's fixed 18px module
// multiples plus --md-sys-space-* at density 1, and is now the derived LEVELS at the root register
// (c, the control, group, widget, card and page margins and gutters, the control height 4n) plus the
// shell's own multiples (bar 8n, floors 24n, pane 36n), all computed from scale.mjs.
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
// consistent in multi-value position). So `calc(var(--md-sys-layout-margin) * 6)` passes (no
// literal arm), `calc(0.4375rem * 2)` fails, and `0.4375rem 0.875rem` fails on BOTH arms.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
import { CFG } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import type { Step, Tier } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'
import { ROOT_REGISTER, STEP, rootResolve } from '../../scripts/lib/foundations-rules.mjs'
declare const process: { cwd(): string }

const ROOT = process.cwd()

// AC19(a) — the sheet set: every {name}.css under @agent-ui/app's controls/, plus every site sheet
// whose selectors lay out a shell element, its parts, or a component composing one (today six — GH #213
// appended the app-shell teaching page's sheet, retired with that page by ADR-0156's migration campaign,
// GH #243). Extending this set is a one-line reviewed append — the FOCUS_TIMING_FILES precedent
// (vitest.browser.config.ts, GH #56).
const SHELL_FAMILY_SHEETS = [
  // @agent-ui/app's controls/ — every sheet, unconditionally (the package composes shells throughout).
  'packages/agent-ui/app/src/controls/agent-admin/agent-admin.css',
  'packages/agent-ui/app/src/controls/chat-shell/chat-shell.css',
  'packages/agent-ui/app/src/controls/conversation/conversation.css',
  'packages/agent-ui/app/src/controls/conversation/conversation-composer.css',
  'packages/agent-ui/app/src/controls/entry-list/entry-list.css',
  'packages/agent-ui/app/src/controls/master-detail/master-detail.css',
  'packages/agent-ui/app/src/controls/master-detail/master-detail-pane.css',
  'packages/agent-ui/app/src/controls/nav-rail/nav-rail.css',
  'packages/agent-ui/app/src/controls/settings/settings.css',
  'packages/agent-ui/app/src/controls/super-shell/super-shell.css',
  'packages/agent-ui/app/src/controls/surface-host/surface-host.css',
  'packages/agent-ui/app/src/controls/workspace-shell/workspace-shell.css',
  // the six site sheets named in the clause.
  'site/pages/_page.css',
  'site/pages/a2ui-live.css',
  'site/pages/a2ui-chat.css',
  'site/pages/super-shell.css',
  'site/pages/chat-shell.css',
  'site/pages/agent-admin-app.css',
  // GH #461 / M-A MA-3 (SPEC-R14 · PRD-D7 ratified) — the workbench sheet lays content into
  // ui-workspace-shell (a shell-composing site sheet, the agent-admin-app.css precedent), so it joins
  // the set as its own reviewed one-line append, per this gate's own extension law above.
  'site/pages/workbench.css',
  // GH #499 (M-F, the fleet's second SaaS composition) — the dashboard sheet lays content into
  // ui-workspace-shell exactly the same way workbench.css does, so it joins the set on the SAME
  // reasoning, its own reviewed one-line append.
  'site/pages/dashboard.css',
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

// The ladder AC19(b) tests a literal against: the derived levels realized at the ROOT REGISTER, the
// one every shipped shell renders under unless a region re-registers (16px root font for the rem
// literals). The register is the shared ROOT_REGISTER (scripts/lib/foundations-rules.mjs, the generator's
// ROOT_INPUTS), never restated here, so the ladder moves with the next anchor change; the leg below proves
// foundations.gen.css's own `:root` rule declares that same register.
function generatedRoot(): { tier: Tier | undefined; scale: Step | undefined; rule: string } {
  const css = readFileSync(`${ROOT}/packages/agent-ui/shared/src/tokens/foundations.gen.css`, 'utf8') as string
  const rule = /^:root \{([^}]*)\}/m.exec(css)?.[1] ?? ''
  const num = (name: string): number => Number(new RegExp(`--md-sys-${name}:\\s*(-?[\\d.]+)`).exec(rule)?.[1])
  const row = [num('tier-n0'), num('tier-a'), num('tier-k'), num('tier-g')]
  const tier = (Object.keys(CFG.tiers) as Tier[]).find((t) => CFG.tiers[t].every((v, i) => v === row[i]))
  const scale = (Object.keys(STEP) as Step[]).find((s) => STEP[s] === num('scale-s'))
  return { tier, scale, rule: rule.trim() }
}
const REGISTER = rootResolve()
const LEVEL_PX = [
  REGISTER.c, REGISTER.h,
  ...[REGISTER.control, REGISTER.group, REGISTER.widget, REGISTER.card, REGISTER.page].flatMap((l) => [l.margin, l.gutter]),
]
// super-shell.css's token block, in resolve()'s own terms (the CSS names the page level `layout`): bars and
// rails a control row plus two widget margins (8n), the floors six page margins (24n). The pane width (42n) is
// a content measure in n, not a level, so it is no rung.
const SHELL_PX = [REGISTER.h + 2 * REGISTER.widget.margin, 6 * REGISTER.page.margin]
const LADDER_PX = [...new Set([...LEVEL_PX, ...SHELL_PX])]

// AC19(c), the allowlist: an explicit (file, declaration, reason) list. Growing it is a reviewed act,
// never a drive-by (R11c). T-0121 dropped its two module-era entries: the shell module's own root literal
// (`--ui-super-shell-module: 1.125rem`, a declaration that no longer exists) and the pane-resizer's 4px ink
// (`0.25rem`), which equalled the old --md-sys-space-xs rung and equals no derived level. T-0167 dropped the
// narration strip's 9rem content cap: it equalled the shell floor (24n) only at n 6, and the root is n 8 since
// Amendment 8. It is empty now; an entry must still fire (the stale-entry leg below), so none outlives its collision.
interface AllowlistEntry {
  file: string
  selectorContains: string
  property: string
  literal: string
  reason: string
}
const ALLOWLIST: AllowlistEntry[] = []

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

// T-0121: the fallback of a foundations token is not a mint. `var(--md-sys-c, 2px)` is ADR-0245
// cl.10a's dark-launch form: the token carries the value, and the literal after the comma is the
// pre-cut value kept for a `[data-foundations='legacy']` region (cl.10e), where the token is unset.
// It belongs to that token, not to this declaration (the GH #213 fallback rule, applied to the
// foundations' own namespace wherever the var() sits, a calc() arm included). Blanked, never removed,
// so every offset holds. A fallback of any OTHER var() is still scanned.
function withoutFoundationFallbacks(value: string): string {
  let out = value
  for (let i = out.indexOf('var(--md-sys-'); i !== -1; i = out.indexOf('var(--md-sys-', i + 1)) {
    let depth = 0
    let comma = -1
    let end = -1
    for (let j = i + 3; j < out.length; j++) {
      if (out[j] === '(') depth++
      else if (out[j] === ')' && --depth === 0) { end = j; break }
      else if (out[j] === ',' && depth === 1 && comma === -1) comma = j
    }
    if (end === -1) break
    if (comma !== -1) out = out.slice(0, comma) + ' '.repeat(end - comma) + out.slice(end)
  }
  return out
}

function literalsOf(raw: string): { token: string; px: number }[] {
  const value = withoutFoundationFallbacks(raw)
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

// An allowlist entry is stale when no declaration it names still carries its literal at a ladder rung.
function staleEntries(entries: AllowlistEntry[]): string[] {
  return entries
    .filter((a) => {
      const { decls } = declarationsOf(a.file, readFileSync(`${ROOT}/${a.file}`, 'utf8'))
      return !decls.some(
        (d) =>
          d.property === a.property &&
          d.selector.includes(a.selectorContains) &&
          literalsOf(d.value).some((h) => h.token === a.literal && LADDER_PX.some((l) => Math.abs(h.px - l) < 0.01)),
      )
    })
    .map((a) => `${a.file} ${a.property}: ${a.literal}`)
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

  it('the allowlist is empty (R11c, growing it is a reviewed act, never a drive-by)', () => {
    expect(ALLOWLIST.length).toBe(0)
  })

  it('every allowlist entry still fires: its declaration exists and its literal equals a rung at the root register (no stale entry)', () => {
    expect(staleEntries(ALLOWLIST), 'an allowlist entry that no longer collides: delete it').toEqual([])
    // negative control: the dropped 9rem narration cap (144px, no rung at n 8) reads as stale
    const narration = { file: 'packages/agent-ui/app/src/controls/conversation/conversation.css', selectorContains: "[data-part='narration']", property: '--ui-status-stream-max-block-size', literal: '9rem', reason: 'control' }
    expect(staleEntries([narration]), 'the stale-entry check bites').toHaveLength(1)
  })

  it('foundations.gen.css declares the shared ROOT_REGISTER on :root (the ladder reads the register the sheet renders)', () => {
    const got = generatedRoot()
    expect([got.tier, got.scale], `the :root rule (${got.rule})`).toEqual([ROOT_REGISTER.tier, ROOT_REGISTER.scale])
  })

  it('the ladder is the derived levels at the root register, read from scale.mjs (anti-vacuous)', () => {
    // n at the root register comes off foundations.gen.css's own :root rule; every level is a multiple of it.
    const n = REGISTER.n
    expect(n, 'the root register resolves to an n on the ladder').toBeGreaterThanOrEqual(CFG.ladder[0])
    for (const px of [REGISTER.c, n, n + REGISTER.c, 2 * n, 3 * n, 4 * n, 8 * n, 24 * n]) {
      expect(LADDER_PX, `${px}px is a rung`).toContain(px)
    }
    // the pane width is a content measure (42n), not a level: neither it nor the retired 36n pane is a rung
    expect(LADDER_PX).not.toContain(42 * n)
    expect(LADDER_PX).not.toContain(36 * n)
    // the retired 18px module is no rung of its own any more (it survives only where it equals a level)
    if (18 % n !== 0) expect(LADDER_PX).not.toContain(18)
  })

  it('a rung-equal literal FAILS and a foundations fallback passes (negative controls)', () => {
    const rem = (px: number): string => `${px / 16}rem`
    const margin = REGISTER.widget.margin
    const hits = (value: string): number[] => literalsOf(value).map((h) => h.px).filter((px) => LADDER_PX.some((l) => Math.abs(px - l) < 0.01))
    expect(hits(`calc(${rem(margin)} * 2)`), 'a raw level literal in a calc arm is drift').toEqual([margin])
    expect(hits(`${REGISTER.control.margin}px ${rem(REGISTER.page.margin)}`), 'both arms of a two-value mint').toEqual([REGISTER.control.margin, REGISTER.page.margin])
    expect(hits(`calc(var(--ui-x) - var(--md-sys-c, ${REGISTER.c}px))`), "a foundations token's own fallback is not a mint").toEqual([])
    expect(hits(`var(--ui-x, ${rem(margin)})`), 'a fallback of any other var() is still scanned').toEqual([margin])
    expect(hits('calc(var(--md-sys-layout-margin) * 6)'), 'a level token with a unitless multiplier has no literal').toEqual([])
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
              `${rung}px ladder rung; SPEC-R11c/AC19: spell it from the derived level tokens, var(--md-sys-<level>-margin) or -gutter, or a multiple of var(--md-sys-n))`,
          )
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
