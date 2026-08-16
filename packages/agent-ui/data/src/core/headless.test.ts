import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// The headless invariant (SPEC §2 Definitions; SPEC-R3 AC6): core/*.ts source (outside
// comments/strings) never references window/document — a STATIC scan, comments/strings stripped
// first (this file's own header prose discusses the tokens by name; only real code counts).
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
}

const DOM_GLOBAL_RE = /\b(window|document)\b/

describe('the headless invariant — core/*.ts references zero DOM globals (SPEC-R3 AC6)', () => {
  const dir = `${process.cwd()}/packages/agent-ui/data/src/core`
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('anti-vacuous: the walk finds the core module files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('resource.ts')
    expect(files).toContain('cache.ts')
  })

  it('no core/*.ts source (outside comments/strings) references window/document', () => {
    const violations: string[] = []
    for (const f of files) {
      const src = readFileSync(`${dir}/${f}`, 'utf8') as string
      if (DOM_GLOBAL_RE.test(stripCommentsAndStrings(src))) violations.push(f)
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
