// offline-wiring.test.ts: the kit is keyless and offline by construction (T-0011, ADR-0073).
//
//  1. The tripwire: after `armOffline()`, every fetch in jsdom rejects with `KIT_NETWORK`, same-origin
//     included (jsdom is not a real page), and disarm restores `fetch` and every deleted key var.
//  2. Raw-source scans over every `.ts` file under `a2ui/tools/testkit/` and `a2ui/src/testkit/`,
//     recursively, this file and offline.ts included:
//       - every test file calls `armOffline()`;
//       - no file names the Anthropic adapter factory or imports the `./agent` barrel (which re-exports it);
//       - no file matches the key rule (an identifier ending in the key suffix, a letter first).
//     Each rule has a planted-violation negative control. Planted names are assembled at run time (the
//     `spec()` join idiom in `layering.test.ts`) so this file passes its own scan.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { armOffline, offlineEnvironment } from '../../tools/testkit/offline.ts'

declare const process: { cwd(): string }

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const kitRaw = import.meta.glob('../../tools/testkit/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const legRaw = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
// Vite's glob never returns the importing file, so this file reads itself.
const SELF = './offline-wiring.test.ts'
const selfRaw = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts`, 'utf8') as string
const ALL: [string, string][] = [...Object.entries(kitRaw), ...Object.entries(legRaw), [SELF, selfRaw]]

const ADAPTER = ['anthropic', 'Provider'].join('')
const BARREL = ['@agent-ui', 'a2ui', 'agent'].join('/')
const KEY_RULE = /\b[A-Z][A-Z0-9_]*_API_KEY\b/

function specifiersOf(src: string): string[] {
  const out: string[] = []
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1]!)
  return out
}

const callsArm = (src: string): boolean => /\barmOffline\(\)/.test(src)
const namesAdapter = (src: string): boolean => src.includes(ADAPTER)
const importsBarrel = (src: string): boolean => specifiersOf(src).some((s) => s === BARREL || /(^|\/)agent\/index\.ts$/.test(s))
const namesKey = (src: string): boolean => KEY_RULE.test(src)

describe('the tripwire', () => {
  it('jsdom is detected as jsdom, not a real page', () => {
    expect(offlineEnvironment()).toBe('jsdom')
  })

  it('a fetch after armOffline rejects with KIT_NETWORK, an off-origin and a same-origin URL alike', async () => {
    await expect(fetch('https://api.example.com/v1/messages')).rejects.toThrow(/^KIT_NETWORK/)
    await expect(fetch(`${location.origin}/__a2ui/agent`)).rejects.toThrow(/^KIT_NETWORK/)
    await expect(fetch(new URL('http://127.0.0.1:9/'))).rejects.toThrow(/^KIT_NETWORK/)
  })

  it('disarm restores fetch and a deleted key var', () => {
    const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
    const name = ['KIT_PROBE', 'API_KEY'].join('_')
    env[name] = 'probe-value'
    const before = globalThis.fetch
    const off = armOffline()
    expect(env[name]).toBeUndefined()
    expect(globalThis.fetch).not.toBe(before)
    off()
    expect(env[name]).toBe('probe-value')
    expect(globalThis.fetch).toBe(before)
    delete env[name]
  })
})

describe('raw-source scans over the kit and its legs', () => {
  it('anti-vacuous: both trees are scanned, this file and offline.ts included', () => {
    const names = ALL.map(([p]) => p)
    expect(names).toContain(SELF)
    expect(names).toContain('./judge.test.ts')
    expect(names).toContain('../../tools/testkit/offline.ts')
    expect(names.some((p) => p.startsWith('../../tools/testkit/') && p.endsWith('.ts'))).toBe(true)
  })

  it('every test file under both trees calls armOffline()', () => {
    const tests = ALL.filter(([p]) => p.endsWith('.test.ts'))
    expect(tests.length).toBeGreaterThan(0)
    expect(tests.filter(([, src]) => !callsArm(src)).map(([p]) => p)).toEqual([])
  })

  it('no file names the adapter factory or imports the ./agent barrel', () => {
    expect(ALL.filter(([, src]) => namesAdapter(src) || importsBarrel(src)).map(([p]) => p)).toEqual([])
  })

  it('no file matches the key rule', () => {
    expect(ALL.filter(([, src]) => namesKey(src)).map(([p]) => p)).toEqual([])
  })
})

describe('negative controls: each planted violation reds its predicate', () => {
  it('a test file without the call', () => {
    expect(callsArm(`import { it } from 'vitest'\nit('x', () => {})\n`)).toBe(false)
    expect(callsArm(`import { armOffline } from './offline.ts'\n`)).toBe(false)
  })

  it('the adapter factory named', () => {
    expect(namesAdapter(`const p = ${ADAPTER}({})\n`)).toBe(true)
  })

  it('the barrel imported by package name and by relative path', () => {
    expect(importsBarrel(`import { produce } from '${BARREL}'\n`)).toBe(true)
    expect(importsBarrel(`import { produce } from '${['..', 'agent', 'index.ts'].join('/')}'\n`)).toBe(true)
    expect(importsBarrel(`import { readMetaLine } from '${BARREL}/meta-line'\n`)).toBe(false)
  })

  it('a key name trips the key rule; the suffix-only form offline.ts uses does not', () => {
    expect(namesKey(`const k = env.${['ANTHROPIC', 'API_KEY'].join('_')}\n`)).toBe(true)
    expect(namesKey(`if (name.endsWith('_API${'_KEY'}')) delete env[name]\n`)).toBe(false)
    expect(namesKey(kitRaw['../../tools/testkit/offline.ts']!)).toBe(false)
  })
})
