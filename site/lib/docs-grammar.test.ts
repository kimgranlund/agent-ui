import { describe, it, expect } from 'vitest'
// docs-grammar.test.ts — the repo-alignment Phase-3 two-tier gate over the .claude/docs corpus + the
// hook wiring (campaign: .claude/docs/reports/repo-alignment-2026-07-12/; the judgment layer lives in
// .claude/skills/agent-ui-doc-standards/SKILL.md — this file owns ONLY the deterministic slice).
//
// STRUCTURAL tier — fails the run (the campaign's exit criteria, standing):
//   S1 ticket YAML: parseable frontmatter, status ∈ {open,doing,done,wontfix}, kind ∈ {bug,feature},
//      a feature ticket carries `size`.
//   S2 SPEC/LLD/PRD header: the first blockquote region carries exactly one status keyword
//      ∈ {proposed,accepted,superseded} (dialect-agnostic — three header dialects are legal, §1 of the
//      standards skill; a MISSING keyword is the defect this catches).
//   S3 dangling-link sweep: every relative markdown link in every ACTIVE doc resolves on disk
//      (archive/ + reports/ excluded — historical records keep stale paths verbatim, by design).
//   S4 hook liveness, both directions: every command registered under hooks in settings(.local).json
//      points at an existing file, AND every file in .claude/hooks/ is registered somewhere — the
//      orphaned-guard class (adr-status-guard sat unregistered for weeks) can never silently recur.
//
// HYGIENE tier — REPORTED, never failing (promoted to structural once the backlog clears):
//   H1 LLD `Layer:` spelling uniformity · H2 lowercase tkt-#### cites in prose (prose cites are
//   uppercase TKT-####) · H3 ADR numbering gaps (0108 is a known one) · H4 skill invocation-dial
//   completeness (forge's postwrite lint enforces on-write; this reports drift at rest).
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const DOCS = `${ROOT}/.claude/docs`

const TICKET_STATUS = new Set(['open', 'doing', 'done', 'wontfix'])
const TICKET_KIND = new Set(['bug', 'feature'])
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

describe('STRUCTURAL — S1 ticket YAML grammar', () => {
  const tickets = mdFiles(`${DOCS}/tickets`)
  it('found a non-trivial ticket set', () => {
    expect(tickets.length).toBeGreaterThan(10)
  })
  for (const f of mdFiles(`${DOCS}/tickets`)) {
    it(`${f.split('/').pop()}: frontmatter parses, enums legal, feature carries size`, () => {
      const text = readFileSync(f, 'utf8')
      const fm = /^---\n([\s\S]*?)\n---/.exec(text)
      expect(fm, 'YAML frontmatter block present').toBeTruthy()
      const get = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm![1]!)?.[1]?.trim()
      expect(get('doc-type')).toBe('ticket')
      expect(TICKET_STATUS.has(get('status') ?? ''), `status "${get('status')}" ∈ the enum`).toBe(true)
      const kind = get('kind') ?? ''
      expect(TICKET_KIND.has(kind), `kind "${kind}" ∈ the enum`).toBe(true)
      if (kind === 'feature') expect(get('size'), 'a feature ticket carries size').toBeTruthy()
    })
  }
})

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

describe('HYGIENE — reported, non-failing (promote once the backlog clears)', () => {
  it('reports the standing hygiene counts', () => {
    const report: string[] = []
    // H1 — LLD Layer spellings
    const spellings = new Map<string, number>()
    for (const f of mdFiles(`${DOCS}/lld`)) {
      const m = /Layer:\s*LLD\s*\(([^)]+)\)/.exec(readFileSync(f, 'utf8'))
      if (m) spellings.set(m[1]!, (spellings.get(m[1]!) ?? 0) + 1)
    }
    if (spellings.size > 1)
      report.push(`H1 LLD Layer spellings split: ${[...spellings].map(([k, v]) => `"${k}"×${v}`).join(' · ')}`)
    // H2 — lowercase tkt-#### cites outside filenames/YAML
    let lowercase = 0
    for (const f of walkMd(DOCS, (p: string) => p.includes('/archive/') || p.includes('/reports/') || p.includes('/tickets/')))
      lowercase += [...readFileSync(f, 'utf8').matchAll(/(?<![\w/-])tkt-\d{4}/g)].length
    if (lowercase) report.push(`H2 lowercase tkt-#### prose cites outside tickets/: ${lowercase} (prose canon is TKT-####)`)
    // H3 — ADR numbering gaps
    const nums = readdirSync(`${DOCS}/adr`).map((f: string) => /^(\d{4})-/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a: number, b: number) => a - b) as number[]
    const gaps: number[] = []
    for (let n = nums[0]!; n <= nums[nums.length - 1]!; n++) if (!nums.includes(n)) gaps.push(n)
    if (gaps.length) report.push(`H3 ADR numbering gaps: ${gaps.join(', ')}`)
    // H4 — skill invocation-dial completeness
    const missing: string[] = []
    for (const name of readdirSync(`${ROOT}/.claude/skills`)) {
      const p = `${ROOT}/.claude/skills/${name}/SKILL.md`
      if (!existsSync(p)) continue
      const t = readFileSync(p, 'utf8')
      if (!t.includes('disable-model-invocation') || !t.includes('user-invocable')) missing.push(name)
    }
    if (missing.length) report.push(`H4 skills missing an invocation dial: ${missing.join(', ')}`)
    // eslint-disable-next-line no-console
    if (report.length) console.warn(`[docs-grammar HYGIENE]\n  ${report.join('\n  ')}`)
    expect(true).toBe(true) // hygiene never fails the run — it reports
  })
})
