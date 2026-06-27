import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readdirSync, statSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s17 — the file-set gate (ADR-0003 consequences + process.md §1 naming/structure trip-wire). Every
// FACE-control folder under controls/ must hold the EXACT per-component set: `{name}.ts` (behaviour),
// `{name}.css` (the single-file stylesheet), `{name}.md` (the descriptor — ADR-0004) and ONE-OR-MORE
// co-located `*.test.ts`. Generalized over every folder so each future control is checked identically — the
// gold button is just folder #1. The components barrel (controls/index.ts) sits at the controls/ root, not
// inside a control folder, so it is not a control and is not scanned.

const CONTROLS = `${process.cwd()}/packages/agent-ui/components/src/controls`
const controlDirs: string[] = readdirSync(CONTROLS).filter((e: string) => statSync(`${CONTROLS}/${e}`).isDirectory())

describe('controls/ file-set gate (s17)', () => {
  it('finds at least one control folder to check (anti-vacuous)', () => {
    expect(controlDirs.length).toBeGreaterThan(0)
    expect(controlDirs).toContain('button')
  })

  for (const name of controlDirs) {
    it(`controls/${name}/ holds {${name}.ts, ${name}.css, ${name}.md} + ≥1 co-located *.test.ts`, () => {
      const files: string[] = readdirSync(`${CONTROLS}/${name}`)
      for (const ext of ['ts', 'css', 'md']) {
        expect(files, `controls/${name}/ missing ${name}.${ext}`).toContain(`${name}.${ext}`)
      }
      const tests = files.filter((f: string) => f.endsWith('.test.ts'))
      expect(tests.length, `controls/${name}/ has no co-located *.test.ts`).toBeGreaterThan(0)
    })
  }
})
