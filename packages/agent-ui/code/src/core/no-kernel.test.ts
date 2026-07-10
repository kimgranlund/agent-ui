import { describe, it, expect } from 'vitest'

// no-kernel gate (LLD-C4, SPEC-C2 AC3): core/*.ts is a plain object holder — no reactivity, no `document`
// (except project.ts's seam, which touches DOM but never signals). This is a STRICTER check than
// layering.test.ts's package-wide "components or shared or local" allowance: `core/` specifically must
// import NEITHER the components kernel/signals runtime NOR a DOM-signal API — never invert the
// `components -> code` arrow (the ADR-0065 cl.4(b) reason). A static text scan, not an execution trace — a
// deliberately-bad specifier in the synthetic string below is inert, never executed.

const raw = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const specifiersOf = (src: string): string[] => {
  const out: string[] = []
  const fromRe = /\b(?:import|export)\b[^\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  const bareRe = /\bimport\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(src))) out.push(m[1])
  while ((m = bareRe.exec(src))) out.push(m[1])
  return out
}

/** A kernel/signal import — anything reaching into `@agent-ui/components` (the reactive/dom runtime) or
 *  naming a bare `signal`/`computed`/`effect` binding from a non-local specifier. */
const isKernelSpecifier = (spec: string): boolean =>
  spec === '@agent-ui/components' || spec.startsWith('@agent-ui/components/')

describe('no-kernel gate — core/*.ts imports neither the components kernel nor a DOM-signal runtime (LLD-C4, SPEC-C2 AC3)', () => {
  const files = Object.entries(raw)
    .map(([k, v]) => [k.replace(/^\.\//, ''), v] as const)
    .filter(([k]) => !k.endsWith('.test.ts'))

  it('anti-vacuous: the glob finds the core module files', () => {
    expect(files.length).toBeGreaterThanOrEqual(3) // token.ts, registry.ts, project.ts
  })

  it('no core/*.ts file imports @agent-ui/components (the kernel)', () => {
    const violations: string[] = []
    for (const [path, src] of files) {
      for (const spec of specifiersOf(src)) {
        if (isKernelSpecifier(spec)) violations.push(`${path} -> "${spec}"`)
      }
    }
    expect(violations).toEqual([])
  })

  it('synthetic-violation (negative control): a planted `import { signal } from \'@agent-ui/components\'` goes RED', () => {
    const planted = `import { signal } from '@agent-ui/components'\nexport const x = signal(1)\n`
    const violations = specifiersOf(planted).filter(isKernelSpecifier)
    expect(violations).toEqual(['@agent-ui/components'])
  })

  it('registry.ts holds no reactive-kernel identifiers (signal/computed/effect) in its source text', () => {
    const registrySrc = raw['./registry.ts']
    expect(registrySrc).toBeDefined()
    expect(registrySrc).not.toMatch(/\bsignal\s*\(/)
    expect(registrySrc).not.toMatch(/\bcomputed\s*\(/)
    expect(registrySrc).not.toMatch(/\bcreateEffect\s*\(/)
  })
})
