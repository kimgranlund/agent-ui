import { describe, it, expect } from 'vitest'
// docs-grammar.test.ts — the repo-alignment Phase-3 two-tier gate over the .claude/docs corpus + the
// hook wiring (campaign: .claude/docs/reports/repo-alignment-2026-07-12/; the judgment layer lives in
// .claude/skills/agent-ui-doc-standards/SKILL.md — this file owns ONLY the deterministic slice).
//
// STRUCTURAL tier — fails the run (the campaign's exit criteria, standing):
//   S1 RETIRED (ADR-0145, 2026-07-18) — the ticket YAML grammar check this label used to own. The
//      TICKET tier moved to GitHub Issues; `.claude/docs/tickets/` is now a frozen historical
//      archive nothing ever edits again, so there is nothing left to validate on every run. Left
//      as a named gap here (the KNOWN_GAPS allowlist pattern S8 already uses below) rather than
//      renumbering S2-S8 down by one — the label is a citation, not a position.
//   S2 SPEC/LLD/PRD header: the first blockquote region carries exactly one status keyword
//      ∈ {proposed,accepted,superseded} (dialect-agnostic — three header dialects are legal, §1 of the
//      standards skill; a MISSING keyword is the defect this catches).
//   S3 dangling-link sweep: every relative markdown link in every ACTIVE doc resolves on disk
//      (archive/ + reports/ excluded — historical records keep stale paths verbatim, by design).
//   S4 hook liveness, both directions: every command registered under hooks in settings(.local).json
//      points at an existing file, AND every file in .claude/hooks/ is registered somewhere — the
//      orphaned-guard class (adr-status-guard sat unregistered for weeks) can never silently recur.
//
//   S5 archive cites annotated: an active doc may link into archive/ ONLY on a line that says so
//      ("archived"/"archive") — history may be cited, never as live authority. (Manifest M10.)
//   S6 lowercase tkt-#### prose cites (paths/filenames exempt) — promoted from hygiene at M7.
//   S7 skill invocation-dial completeness — promoted from hygiene at M8 (backlog cleared Phase 3).
//   S8 ADR numbering contiguity against a KNOWN_GAPS allowlist ([108] — history, never renumbered);
//      a NEW gap fails (manifest M9).
//
// HYGIENE tier — REPORTED, never failing (promotion pending its backlog):
//   H1 LLD `Layer:` spelling uniformity + the three header dialects (unification is update-in-place
//   authoring — the Phase-6 follow-up queue owns it).
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const DOCS = `${ROOT}/.claude/docs`

const DOC_STATUS = /\b(proposed|accepted|superseded)\b/

function mdFiles(dir: string): string[] {
  return readdirSync(dir).filter((f: string) => f.endsWith('.md')).map((f: string) => `${dir}/${f}`)
}
function walkMd(dir: string, skip: (p: string) => boolean): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`
    if (skip(p)) continue
    if (statSync(p).isDirectory()) out.push(...walkMd(p, skip))
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}
function normalize(base: string, rel: string): string {
  const parts = base.split('/').slice(0, -1)
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue
    else if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

describe('STRUCTURAL — S2 SPEC/LLD/PRD status keyword present', () => {
  for (const dir of ['spec', 'lld', 'prd']) {
    for (const f of mdFiles(`${DOCS}/${dir}`)) {
      it(`${dir}/${f.split('/').pop()}: the header blockquote carries a status keyword`, () => {
        const head = readFileSync(f, 'utf8').split('\n').slice(0, 30)
        const quoted = head.filter((l: string) => l.startsWith('>')).join(' ')
        expect(DOC_STATUS.test(quoted), 'proposed|accepted|superseded in the header blockquote').toBe(true)
      })
    }
  }
})

describe('STRUCTURAL — S3 zero dangling relative links in active docs', () => {
  it('every ](../…) / ](./…) target in every active doc resolves', () => {
    const files = walkMd(DOCS, (p: string) => p.includes('/archive/') || p.includes('/reports/'))
    const LINK = /\]\((\.\.?\/[^)#\s]+)(#[^)\s]*)?\)/g
    const dangling: string[] = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(LINK)) {
        const target = normalize(f, m[1]!)
        if (!existsSync(target)) dangling.push(`${f.slice(ROOT.length + 1)} -> ${m[1]}`)
      }
    }
    expect(dangling, dangling.join('\n')).toEqual([])
    expect(files.length, 'the sweep saw a real corpus').toBeGreaterThan(100)
  })
})

describe('STRUCTURAL — S4 hook liveness, both directions', () => {
  const registered = new Set<string>()
  for (const settings of ['settings.json', 'settings.local.json']) {
    const p = `${ROOT}/.claude/${settings}`
    if (!existsSync(p)) continue
    const hooks = (JSON.parse(readFileSync(p, 'utf8')) as { hooks?: Record<string, { hooks: { command: string }[] }[]> }).hooks ?? {}
    for (const entries of Object.values(hooks))
      for (const entry of entries)
        for (const h of entry.hooks) {
          const m = /\.claude\/hooks\/([\w.-]+)/.exec(h.command)
          if (m) registered.add(m[1]!)
        }
  }
  it('every registered hook file exists on disk', () => {
    for (const name of registered) expect(existsSync(`${ROOT}/.claude/hooks/${name}`), name).toBe(true)
  })
  it('every file in .claude/hooks/ is registered (no orphaned guards)', () => {
    const onDisk = readdirSync(`${ROOT}/.claude/hooks`).filter((f: string) => !f.startsWith('.'))
    const orphans = onDisk.filter((f: string) => !registered.has(f))
    expect(orphans, `unregistered hook files: ${orphans.join(', ')}`).toEqual([])
  })
})

describe('STRUCTURAL — S5-S8 (promoted at Phase 5, manifest M7-M10)', () => {
  const activeDocs = () => walkMd(DOCS, (p: string) => p.includes('/archive/') || p.includes('/reports/'))
  it('S5: every archive/ cite in an active doc sits on a line that names it archived', () => {
    const bad: string[] = []
    for (const f of activeDocs())
      for (const line of readFileSync(f, 'utf8').split('\n'))
        if (line.includes('/archive/') && !/archiv/i.test(line))
          bad.push(`${f.slice(ROOT.length + 1)} :: ${line.slice(0, 80)}`)
    expect(bad, bad.join('\n')).toEqual([])
  })
  it('S6: no lowercase tkt-#### prose cites outside tickets/ (paths exempt; prose canon TKT-####)', () => {
    const bad: string[] = []
    for (const f of activeDocs()) {
      if (f.includes('/tickets/')) continue
      const hits = [...readFileSync(f, 'utf8').matchAll(/(?<![\w/.-])tkt-\d{4}/g)]
      if (hits.length) bad.push(`${f.slice(ROOT.length + 1)} ×${hits.length}`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
  it('S7: every repo skill declares BOTH invocation dials', () => {
    const missing: string[] = []
    for (const name of readdirSync(`${ROOT}/.claude/skills`)) {
      const p = `${ROOT}/.claude/skills/${name}/SKILL.md`
      if (!existsSync(p)) continue
      const s = readFileSync(p, 'utf8')
      if (!s.includes('disable-model-invocation') || !s.includes('user-invocable')) missing.push(name)
    }
    expect(missing, missing.join(', ')).toEqual([])
  })
  it('S8: ADR numbering contiguous modulo the KNOWN_GAPS allowlist', () => {
    // 108: history — a numbering-race casualty, never renumbered.
    // 151: reserved by PR #45's ADR-0151 (shell archetypes M5, unmerged on branch
    // adr-0150-shell-archetypes-intake) — this branch's own live-agent-Worker ADR claimed 0151 first
    // in-worktree and was renumbered to 0152 on discovering the collision, leaving this gap until #45 merges.
    const KNOWN_GAPS = new Set([108, 151])
    const nums = readdirSync(`${DOCS}/adr`).map((f: string) => /^(\d{4})-/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a: number, b: number) => a - b) as number[]
    const newGaps: number[] = []
    for (let n = nums[0]!; n <= nums[nums.length - 1]!; n++)
      if (!nums.includes(n) && !KNOWN_GAPS.has(n)) newGaps.push(n)
    expect(newGaps, `NEW ADR numbering gaps: ${newGaps.join(', ')}`).toEqual([])
  })
})

describe('HYGIENE — reported, non-failing (H1 pending the LLD-dialect unification)', () => {
  it('reports the LLD Layer-spelling split', () => {
    const spellings = new Map<string, number>()
    for (const f of mdFiles(`${DOCS}/lld`)) {
      const m = /Layer:\s*LLD\s*\(([^)]+)\)/.exec(readFileSync(f, 'utf8'))
      if (m) spellings.set(m[1]!, (spellings.get(m[1]!) ?? 0) + 1)
    }
    // eslint-disable-next-line no-console
    if (spellings.size > 1)
      console.warn(`[docs-grammar HYGIENE] H1 LLD Layer spellings split: ${[...spellings].map(([k, v]) => `"${k}"×${v}`).join(' · ')}`)
    expect(true).toBe(true)
  })
})
