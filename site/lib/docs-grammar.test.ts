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
//      (archive/ + reports/ excluded — historical records keep stale paths verbatim, by design;
//      fenced blocks + inline code spans excluded too, GH #321 — a link inside code is
//      documentation OF a link, not a live cite).
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
//   S9 skill exemplar paths resolve: every backticked REPO-RELATIVE path in a skill table row's
//      last cell (the "Owner · exemplar" column) exists on disk. Minted 2026-07-30 for the M-A PRD
//      (PRD-G5) after review found that PRD citing S3 as this gate — S3 cannot fire here twice over:
//      it walks .claude/docs only (skills live in .claude/skills), and it matches ](…) markdown link
//      syntax, while exemplars are BACKTICKED bare paths that stripCode blanks by construction
//      (GH #321). "Repo-relative" is the deliberate scope: several skills cite package-relative
//      shorthand (`controls/select/`, resolved against that skill's own stated package root) which
//      was never claiming to be repo-relative — the filter below excludes it rather than reding a
//      convention this gate did not come to change.
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

const LINK = /\]\((\.\.?\/[^)#\s]+)(#[^)\s]*)?\)/g

// GH #321: a relative link inside a fenced block or an inline code span is documentation OF a link
// (a quoted ADR-README index row, a sample snippet) — resolving it against the QUOTING file's own
// directory reddened S3 twice and taught two slices to rewrite the quoted path instead. Blank out
// code, keeping line structure, before the link sweep runs. An UNCLOSED fence swallows the rest of
// the file (its links stop being checked) — that is a markdown defect in its own right, and erring
// toward silence beats erring toward a false red on illustrative text.
function stripCode(text: string): string {
  const out: string[] = []
  let fence: string | null = null
  for (const line of text.split('\n')) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence !== null) {
      if (open && line.trim().startsWith(fence)) fence = null
      out.push('')
      continue
    }
    if (open) {
      fence = open[1]!
      out.push('')
      continue
    }
    // shortest run-delimited inline span: an N-backtick opener closes on the next N-backtick run
    out.push(line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, ''))
  }
  return out.join('\n')
}
function relativeLinks(text: string): string[] {
  return [...stripCode(text).matchAll(LINK)].map((m) => m[1]!)
}

// S9 — the skill-table exemplar extractor. A skill's routing tables end in an "Owner · exemplar"
// column whose exemplars are BACKTICKED bare paths (not markdown links — which is precisely why S3
// never saw them). Only repo-relative paths are swept: a token must start with a real top-level
// repo directory, so package-relative shorthand (`controls/select/`) is skipped rather than reded.
// Elided (`…`), glob (`*`), brace-expansion (`{a,b}`) and package-specifier (`@scope/pkg`) tokens
// name a CLASS of files, not one file, and are likewise out of scope for an existsSync gate.
const REPO_ROOTS = ['packages/', 'site/', 'scripts/', 'tools/', '.claude/', '.github/']
function skillExemplarPaths(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|') || !line.endsWith('|')) continue
    const cells = line.slice(1, -1).split('|').map((c: string) => c.trim())
    if (cells.length < 3) continue // no Owner·exemplar column to read
    const last = cells[cells.length - 1]!
    if (/^[-: ]*$/.test(last)) continue // the header separator row
    for (const m of last.matchAll(/`([^`]+)`/g)) {
      const tok = m[1]!
      if (!REPO_ROOTS.some((r) => tok.startsWith(r))) continue
      if (/[…*{} ]/.test(tok)) continue
      out.push(tok)
    }
  }
  return out
}

describe('STRUCTURAL — S3 zero dangling relative links in active docs', () => {
  it('every ](../…) / ](./…) target in every active doc resolves', () => {
    const files = walkMd(DOCS, (p: string) => p.includes('/archive/') || p.includes('/reports/'))
    const dangling: string[] = []
    for (const f of files) {
      for (const rel of relativeLinks(readFileSync(f, 'utf8'))) {
        const target = normalize(f, rel)
        if (!existsSync(target)) dangling.push(`${f.slice(ROOT.length + 1)} -> ${rel}`)
      }
    }
    expect(dangling, dangling.join('\n')).toEqual([])
    expect(files.length, 'the sweep saw a real corpus').toBeGreaterThan(100)
  })

  // Negative controls — the sweep must still bite on real prose links (GH #321's fix must not
  // hollow the gate out), and must stay quiet on quoted/illustrative ones.
  it('still catches a genuinely dangling link in prose', () => {
    expect(relativeLinks('See [x](./nope-does-not-exist.md) for detail.')).toEqual(['./nope-does-not-exist.md'])
    expect(relativeLinks('`ui-table` ships — see [the ADR](../adr/0163-x.md).')).toEqual(['../adr/0163-x.md'])
    expect(relativeLinks('Prose [a](./a.md)\n```\nfenced [b](./b.md)\n```\nmore [c](./c.md)')).toEqual(['./a.md', './c.md'])
  })
  it('skips links inside fenced blocks and inline code spans', () => {
    expect(relativeLinks('Row draft: `| [0162](./0162-x.md) | … |`')).toEqual([])
    expect(relativeLinks('```md\n| [0162](./0162-x.md) |\n```')).toEqual([])
    expect(relativeLinks('~~~\n[a](./a.md)\n~~~')).toEqual([])
    expect(relativeLinks('  ```\n  [a](./a.md)\n  ```')).toEqual([])
    expect(relativeLinks('``a ` b [x](./x.md)``')).toEqual([])
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

describe('STRUCTURAL — S5-S9 (S5-S8 promoted at Phase 5, manifest M7-M10; S9 minted 2026-07-30)', () => {
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
    // 155: reserved by PR #183's ADR-0155 (shell responsive band ladder, in-flight 2026-07-20) —
    // ADR-0156 (app-shell deprecation) skipped it to avoid the merge collision, leaving this gap until #183 merges.
    // 173: reserved by the concurrent docs-483-descriptor-inversion branch's ADR-0173 (in-flight
    // 2026-08-06, a parallel docs lane not present in this worktree) — this branch's ADR-0174 is
    // pinned by the dispatching orchestrator to avoid colliding with it, leaving this gap until
    // that branch merges.
    // 183: reserved by PR #743's ADR-0183 (View Transitions family, GH #740, in-flight 2026-08-12) —
    // this branch's ADR-0184 (GH #737) numbered past it to avoid the merge collision, leaving this
    // gap until #743 merges.
    const KNOWN_GAPS = new Set([108, 151, 155, 173, 183])
    const nums = readdirSync(`${DOCS}/adr`).map((f: string) => /^(\d{4})-/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a: number, b: number) => a - b) as number[]
    const newGaps: number[] = []
    for (let n = nums[0]!; n <= nums[nums.length - 1]!; n++)
      if (!nums.includes(n) && !KNOWN_GAPS.has(n)) newGaps.push(n)
    expect(newGaps, `NEW ADR numbering gaps: ${newGaps.join(', ')}`).toEqual([])
  })

  it('S9: every repo-relative exemplar path cited in a skill table resolves', () => {
    const dangling: string[] = []
    let checked = 0
    for (const name of readdirSync(`${ROOT}/.claude/skills`)) {
      const p = `${ROOT}/.claude/skills/${name}/SKILL.md`
      if (!existsSync(p)) continue
      for (const rel of skillExemplarPaths(readFileSync(p, 'utf8'))) {
        checked++
        if (!existsSync(`${ROOT}/${rel}`)) dangling.push(`${name}: ${rel}`)
      }
    }
    expect(dangling, dangling.join('\n')).toEqual([])
    expect(checked, 'the sweep saw a real corpus of cited exemplars').toBeGreaterThan(15)
  })

  // Negative controls — the extractor must BITE on a real exemplar row and stay quiet on the
  // shorthands the corpus legitimately uses (a gate that matches nothing passes forever).
  it('S9 extractor: catches a real exemplar path, skips the non-repo-relative shorthands', () => {
    expect(skillExemplarPaths('| a | b | ADR-0050 · `site/pages/forms.ts` (one live form) |')).toEqual(['site/pages/forms.ts'])
    expect(skillExemplarPaths('| a | b | ADR-0115 · `packages/agent-ui/router/` |')).toEqual(['packages/agent-ui/router/'])
    // package-relative shorthand · elided · glob · brace-expansion · package specifier · separator row
    expect(skillExemplarPaths('| a | b | `controls/select/` and `…/controls/menu/` |')).toEqual([])
    expect(skillExemplarPaths('| a | b | `site/pages/*.css` |')).toEqual([])
    expect(skillExemplarPaths('| a | b | `packages/agent-ui/x/{a,b}.test.ts` |')).toEqual([])
    expect(skillExemplarPaths('| a | b | `@agent-ui/shared` tokens.css |')).toEqual([])
    expect(skillExemplarPaths('|---|---|---|')).toEqual([])
    // two-column tables carry no Owner·exemplar column — nothing to sweep
    expect(skillExemplarPaths('| a | `site/pages/forms.ts` |')).toEqual([])
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
