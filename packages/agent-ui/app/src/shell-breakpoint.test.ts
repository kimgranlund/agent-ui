// shell-breakpoint.test.ts — LLD-C7 (GH #99, round 5): the mechanical half of the DRY fix. A CSS
// `@container` condition can't consume a custom property (shell-breakpoint.ts's own header comment), so
// each of the five shell-family sites keeps its own literal `40rem` — this gate asserts every one of
// them still equals SHELL_NARROW_BREAKPOINT, so a future edit to one site without updating the rest (or
// without updating this shared constant) reds immediately instead of silently drifting.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SHELL_NARROW_BREAKPOINT, SHELL_COMPACT_BREAKPOINT } from './shell-breakpoint.ts'

declare const process: { cwd(): string }

const ROOT = `${process.cwd()}/packages/agent-ui/app/src/controls`

// Every known `@container (inline-size < …)` narrow-collapse site in the shell family, as of round 5
// (GH #99). A new shell-family control that grows its own narrow threshold belongs in this list too —
// the ANTI-VACUOUS test below catches an accidentally-empty list, not a missing new entry, so growing the
// family is still a manual (documented) step, same as the SLOTS list in super-shell.ts itself.
const SITES = [
  `${ROOT}/app-shell/app-shell.css`,
  `${ROOT}/app-shell/app-shell-isolation.css`,
  `${ROOT}/master-detail/master-detail.css`,
  `${ROOT}/nav-rail/nav-rail.css`,
  `${ROOT}/super-shell/super-shell.css`,
] as const

describe('shell family — the narrow-collapse breakpoint stays consistent across every site (LLD-C7, GH #99)', () => {
  it('anti-vacuous: the site list is non-empty and every file actually exists', () => {
    expect(SITES.length).toBeGreaterThan(0)
    for (const path of SITES) expect(() => readFileSync(path, 'utf8'), path).not.toThrow()
  })

  // SPEC-R8/ADR-0155 — the band ladder is now TWO named lines: the narrow line (every site) and the
  // compact line (super-shell.css's second query only). Every `@container (inline-size < …)` literal in
  // the family must equal ONE of the two named constants — a literal that drifts from BOTH reds here.
  const NAMED_LINES = [SHELL_NARROW_BREAKPOINT, SHELL_COMPACT_BREAKPOINT]
  it(`every site's @container line matches a NAMED shell breakpoint (${NAMED_LINES.join(' or ')})`, () => {
    const containerRe = /@container[^{]*\(inline-size\s*<\s*([^)]+)\)/g
    for (const path of SITES) {
      const css = readFileSync(path, 'utf8') as string
      const matches = [...css.matchAll(containerRe)].map((m) => m[1].trim())
      expect(matches.length, `${path}: expected at least one @container narrow-collapse rule`).toBeGreaterThan(0)
      for (const value of matches) expect(NAMED_LINES, `${path}: literal ${value} drifts from both named lines`).toContain(value)
    }
  })

  it(`super-shell.css carries the compact line (${SHELL_COMPACT_BREAKPOINT}) — the second band, guarded by collapse-band='compact'`, () => {
    const containerRe = /@container[^{]*\(inline-size\s*<\s*([^)]+)\)/g
    const css = readFileSync(`${ROOT}/super-shell/super-shell.css`, 'utf8') as string
    const matches = [...css.matchAll(containerRe)].map((m) => m[1].trim())
    expect(matches, 'super-shell.css must query BOTH the narrow and the compact line').toContain(SHELL_NARROW_BREAKPOINT)
    expect(matches, 'super-shell.css must query BOTH the narrow and the compact line').toContain(SHELL_COMPACT_BREAKPOINT)
  })

  it('a drifted literal FAILS (negative control)', () => {
    const css = '@container (inline-size < 41rem) { :scope { display: none; } }'
    const matches = [...css.matchAll(/@container[^{]*\(inline-size\s*<\s*([^)]+)\)/g)].map((m) => m[1].trim())
    expect(matches).toEqual(['41rem'])
    expect(NAMED_LINES).not.toContain(matches[0])
  })
})
