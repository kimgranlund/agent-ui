// props-gen-driftwire.test.ts — the ADR-0173 cl.4b fleet drift gate. Imports the SAME `generatePropsModule`
// implementation `scripts/generate-props.mjs` writes with, regenerates each CONVERTED control's props module
// in-memory from its real `{name}.md`, and diffs against the committed `{name}.props.gen.ts` byte-for-byte —
// the site/lib/llms.test.ts G1 pattern (generator + gate share ONE implementation, so they cannot drift into
// two). CONVERTED is the migration-allowlist source of truth (cl.6) — it grows by one entry per control as
// each wave lands, and a control's own `compareDescriptorToProps` (s10) assertions in its
// `*-descriptor.test.ts` retire in the SAME COMMIT that adds it here (cl.4c/OF4): never a commit where both
// exist for a control, never one where neither does.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generatePropsModule } from './generate-props.ts'
declare const process: { cwd(): string }

const ROOT = process.cwd()
const CONTROLS = `${ROOT}/packages/agent-ui/components/src/controls`
const read = (p: string): string => readFileSync(p, 'utf8') as string

/** The converted-fleet allowlist (ADR-0173 cl.6) — grows wave-by-wave. */
const CONVERTED = ['button', 'table'] as const

describe('props-gen-driftwire — anti-vacuous fleet coverage', () => {
  it('CONVERTED is non-empty and every entry has a committed {name}.props.gen.ts file', () => {
    expect(CONVERTED.length).toBeGreaterThan(0)
    for (const name of CONVERTED) {
      expect(() => read(`${CONTROLS}/${name}/${name}.props.gen.ts`), name).not.toThrow()
    }
  })
})

describe.each(CONVERTED)('%s.props.gen.ts — byte-identical to a fresh generation (the committed props module cannot drift)', (name) => {
  const mdSource = read(`${CONTROLS}/${name}/${name}.md`)
  const committed = read(`${CONTROLS}/${name}/${name}.props.gen.ts`)
  const fresh = generatePropsModule(mdSource)

  it('the generator succeeds against the real committed descriptor (anti-vacuous: a broken descriptor cannot pass silently)', () => {
    expect(fresh.ok, fresh.ok ? '' : JSON.stringify(fresh.failures)).toBe(true)
  })

  it(`the committed file matches the generator byte-for-byte (regenerate: node scripts/generate-props.mjs ${name})`, () => {
    if (!fresh.ok) return // the prior assertion already failed this file non-vacuously
    expect(committed).toBe(fresh.code)
  })

  it('negative control: a hand-edit to the generated file is genuinely caught (the equality check bites)', () => {
    if (!fresh.ok) return
    expect(committed + '\n// hand-edited').not.toBe(fresh.code)
  })
})
