import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// The headless invariant (SPEC §2 Definitions; SPEC-R3 AC6; SPEC-R14 b — "gated for core/** and
// gateway/**"): core/*.ts AND gateway/*.ts source (outside comments/strings) never references
// window/document — a STATIC scan, comments/strings stripped first (this file's own header prose
// discusses the tokens by name; only real code counts).
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
}

const DOM_GLOBAL_RE = /\b(window|document)\b/

describe('the headless invariant — core/*.ts and gateway/*.ts reference zero DOM globals (SPEC-R3 AC6, SPEC-R14 b)', () => {
  const root = `${process.cwd()}/packages/agent-ui/data/src`
  const dirs = [`${root}/core`, `${root}/gateway`]
  const filesByDir = dirs.map((dir) => ({
    dir,
    files: readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')),
  }))

  it('anti-vacuous: the walk finds the core AND gateway module files', () => {
    const core = filesByDir.find((d) => d.dir.endsWith('/core'))!
    const gateway = filesByDir.find((d) => d.dir.endsWith('/gateway'))!
    expect(core.files.length).toBeGreaterThan(0)
    expect(core.files).toContain('resource.ts')
    expect(core.files).toContain('cache.ts')
    expect(gateway.files.length).toBeGreaterThan(0)
    expect(gateway.files).toContain('client.ts')
  })

  it('no core/*.ts or gateway/*.ts source (outside comments/strings) references window/document', () => {
    const violations: string[] = []
    for (const { dir, files } of filesByDir) {
      for (const f of files) {
        const src = readFileSync(`${dir}/${f}`, 'utf8') as string
        if (DOM_GLOBAL_RE.test(stripCommentsAndStrings(src))) violations.push(`${dir}/${f}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a planted `window` reference (comments/strings excluded first)', () => {
    const src = '// this comment says window, inert\nexport const x = window.location\n'
    expect(DOM_GLOBAL_RE.test(stripCommentsAndStrings(src))).toBe(true) // the CODE reference still bites
    const commentOnly = '// only window and document appear, in prose\n'
    expect(DOM_GLOBAL_RE.test(stripCommentsAndStrings(commentOnly))).toBe(false) // pure prose never bites
  })
})
