// gates.test.ts — the ADR-0137 clause-8 standing gates that keep the `@agent-ui/a2ui/agent` opt-in honest
// (the ADR-0119 clause-8 pattern, applied to the producer toolkit). Five legs:
//
//  1. IDENTITY — importing the ROOT `@agent-ui/a2ui` barrel alone carries ZERO producer bytes: the root
//     barrel neither re-exports `./agent` nor exposes any producer symbol (a renderer-only consumer never
//     pulls in the prompt/loop/provider code — the `./examples`/`./corpus` precedent, ADR-0055/0062).
//  2. SDK-FREE / ZERO-DEP — no module under `src/agent/` imports a third-party package (plain `fetch`, no
//     `@anthropic-ai/sdk`, no vendored dependency in costume — ADR-0069/0073/0107, SPEC-R3 AC1). Every
//     import specifier is a relative path or a `node:*` builtin.
//  3. NODE-FENCE — `node:*` imports under `src/agent/` appear ONLY in the two clause-4 prompt-loading
//     modules (`system-prompt.ts`/`mini-skills.ts`); `vite` and `node:http` (the dev-proxy fence that
//     stays behind in `tools/agent/`) never appear anywhere under `src/agent/`.
//  4. PROMPT BYTE-IDENTITY — carried by the pre-existing `prompt-equivalence.test.ts` (ADR-0135 equivalence
//     gate) + `prompt-drift.test.ts`, which now exercise the MOVED `src/agent/system-prompt.ts` and its
//     `src/agent/prompts/*.md` at their new home; both stay green across the move (no assertion duplicated
//     here — those two files ARE this leg).
//  5. COMPOSITION CONTAINMENT (closes the review-flagged gap: `src/agent/` composing `src/corpus/`
//     internals meant `src/corpus/index.test.ts`'s own root-purity walk had to skip `src/agent/` — leg 1
//     only regex-checks `src/index.ts` directly, so nothing previously proved a THIRD module couldn't
//     bridge root → src/agent → corpus transitively). No non-test module under `src/` OTHER than
//     `src/agent/` itself may import from `src/agent/` — the only legal reacher is the package's own
//     `"./agent"` export surface, never an in-package back-door.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import * as rootBarrel from '@agent-ui/a2ui'

declare const process: { cwd(): string }
const AGENT_DIR = `${process.cwd()}/packages/agent-ui/a2ui/src/agent`

/** Every non-test `.ts` module under `src/agent/` (recursive), returned as repo-relative-ish paths. */
function agentModules(dir: string = AGENT_DIR, rel = 'src/agent'): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const abs = `${dir}/${name.name}`
    const childRel = `${rel}/${name.name}`
    if (name.isDirectory()) out.push(...agentModules(abs, childRel))
    else if (name.name.endsWith('.ts') && !name.name.endsWith('.test.ts')) out.push({ rel: childRel, abs })
  }
  return out
}

/** Extract every `from '<specifier>'` and `import '<specifier>'` module specifier from a source file. */
function importSpecifiers(src: string): string[] {
  const specs: string[] = []
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) specs.push(m[1]!)
  return specs
}

const MODULES = agentModules()
const SRC_ROOT = `${process.cwd()}/packages/agent-ui/a2ui/src`

/** Every non-test `.ts` module under `src/`, EXCLUDING `src/agent/` itself, recursively. */
function nonAgentSrcModules(dir: string = SRC_ROOT, rel = 'src'): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (dir === SRC_ROOT && name.name === 'agent') continue // the pack itself — not a "reacher"
    const abs = `${dir}/${name.name}`
    const childRel = `${rel}/${name.name}`
    if (name.isDirectory()) out.push(...nonAgentSrcModules(abs, childRel))
    else if (name.name.endsWith('.ts') && !name.name.endsWith('.test.ts')) out.push({ rel: childRel, abs })
  }
  return out
}

describe('ADR-0137 clause 8 — the ./agent subpath gates', () => {
  it('IDENTITY: the root @agent-ui/a2ui barrel re-exports nothing from src/agent/', () => {
    const rootIndex = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/index.ts`, 'utf8') as string
    // A source grep — the root barrel must not reach into the producer pack (the `./examples`/`./corpus`
    // discipline: consumer-bundle hygiene, ADR-0055 clause 3).
    expect(rootIndex).not.toMatch(/from\s+['"][^'"]*agent[^'"]*['"]/)
  })

  it('IDENTITY: the root barrel exposes NO producer-only symbol at runtime', () => {
    // If a future edit accidentally re-exported the pack from the root, these would appear on the renderer
    // consumer's surface. They must live ONLY on `@agent-ui/a2ui/agent`.
    for (const sym of ['produce', 'buildSystemPrompt', 'createRecordedTransport', 'selectMiniSkills', 'anthropicProvider']) {
      expect(rootBarrel, `root barrel must not expose producer symbol "${sym}"`).not.toHaveProperty(sym)
    }
  })

  it('SDK-FREE / ZERO-DEP: no module under src/agent/ imports a third-party package', () => {
    for (const { rel, abs } of MODULES) {
      for (const spec of importSpecifiers(readFileSync(abs, 'utf8') as string)) {
        const isRelative = spec.startsWith('./') || spec.startsWith('../')
        const isNodeBuiltin = spec.startsWith('node:')
        expect(
          isRelative || isNodeBuiltin,
          `${rel} imports "${spec}" — the ./agent pack is zero third-party-dep (relative or node:* only, ADR-0107)`,
        ).toBe(true)
        expect(spec, `${rel} must never import an LLM SDK (SPEC-R3 AC1)`).not.toContain('@anthropic-ai/sdk')
      }
    }
  })

  it('NODE-FENCE: node:* imports appear ONLY in the two prompt-loading modules; never vite/node:http', () => {
    const NODE_ALLOWED = new Set(['src/agent/system-prompt.ts', 'src/agent/mini-skills.ts'])
    for (const { rel, abs } of MODULES) {
      const specs = importSpecifiers(readFileSync(abs, 'utf8') as string)
      const nodeImports = specs.filter((s) => s.startsWith('node:'))
      if (nodeImports.length > 0) {
        expect(NODE_ALLOWED.has(rel), `${rel} imports ${nodeImports.join(', ')} — only the clause-4 prompt loaders may (ADR-0137 clause 4)`).toBe(true)
      }
      // The dev-proxy fence: `vite` + `node:http` stay in tools/agent/, NEVER in the exported graph.
      expect(specs, `${rel} must not import 'vite' (the dev-proxy fence, ADR-0137 clause 8)`).not.toContain('vite')
      expect(specs, `${rel} must not import 'node:http' (the dev-proxy fence, ADR-0137 clause 8)`).not.toContain('node:http')
    }
  })

  it('COMPOSITION CONTAINMENT: no src/ module outside src/agent/ imports from src/agent/', () => {
    for (const { rel, abs } of nonAgentSrcModules()) {
      for (const spec of importSpecifiers(readFileSync(abs, 'utf8') as string)) {
        if (!spec.startsWith('.')) continue // only relative specifiers can reach across src/ directories
        const resolved = new URL(spec, `file://${abs}`).pathname
        expect(
          resolved.includes('/src/agent/'),
          `${rel} imports "${spec}" — no module outside src/agent/ may reach into it; the "./agent" package export is the only legal door`,
        ).toBe(false)
      }
    }
  })
})
