import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { createRouter } from './router.ts'
declare const process: { cwd(): string }

// The no-DOM gate (SPEC-R2 AC1/AC2, LLD-C5): a STATIC scan asserting core/*.ts source (outside
// comments/strings) never references window/document/location/history, plus a FUNCTIONAL leg
// constructing/navigating a router with those globals deleted. Comments/strings are stripped first —
// this file's own header prose, and types.ts's, both discuss the four tokens BY NAME; only real code
// references would be a defect.
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
}

const DOM_GLOBAL_RE = /\b(window|document|location|history)\b/

describe('the no-DOM gate — core/*.ts references zero DOM globals (SPEC-R2 AC2, LLD-C5)', () => {
  const dir = `${process.cwd()}/packages/agent-ui/router/src/core`
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('anti-vacuous: the walk finds the core module files', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('router.ts')
    expect(files).toContain('history.ts')
  })

  it('no core/*.ts source (outside comments/strings) references window/document/location/history', () => {
    const violations: string[] = []
    for (const f of files) {
      const src = readFileSync(`${dir}/${f}`, 'utf8') as string
      if (DOM_GLOBAL_RE.test(stripCommentsAndStrings(src))) violations.push(f)
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation: the matcher flags a planted `document` reference (comments/strings excluded first)', () => {
    const src = "// this comment says document and history, both inert\nexport const x = document.title\n"
    expect(DOM_GLOBAL_RE.test(stripCommentsAndStrings(src))).toBe(true) // the CODE reference still bites
    const commentOnly = '// only document and history and location and window appear, in prose\n'
    expect(DOM_GLOBAL_RE.test(stripCommentsAndStrings(commentOnly))).toBe(false) // pure prose never bites
  })
})

describe('the functional no-DOM leg — construct/navigate/back/forward/read all pass with DOM globals absent (SPEC-R2 AC1)', () => {
  it('operates with window/document/location/history deleted from globalThis', () => {
    const g = globalThis as Record<string, unknown>
    const saved = { window: g.window, document: g.document, location: g.location, history: g.history }
    delete g.window
    delete g.document
    delete g.location
    delete g.history
    try {
      // The factory closes over `document` but is never INVOKED by construct/navigate/back/forward — no
      // DOM touch occurs on this path (the outlet is the only consumer that ever calls a factory).
      const router = createRouter([{ path: '/a', component: () => (document as unknown as { createElement(t: string): unknown }).createElement('div') as never }], {
        initial: '/a',
      })
      expect(router.route.value?.path).toBe('/a')
      router.navigate('/a')
      router.back()
      router.forward()
      router.dispose()
    } finally {
      Object.assign(g, saved)
    }
  })
})
