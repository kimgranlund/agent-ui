// providers-config.test.ts — LLD-C8 / SPEC-R11 AC2, SPEC-R12 AC1, SPEC-N2. The committed registry's
// standing gate: it parses, satisfies its own invariants, carries NO secret, and its PAIR-allowlist
// (`resolvePair` — the proxy's trust boundary) routes/rejects the way the spec demands. This test lives
// in the vitest+tsc include and imports the Node-scoped `tools/agent/` modules, transitively typechecking
// them (LLD §2 discovery table). Reads `providers.json` via readFileSync (the corpus-data.test.ts
// precedent — Node's ESM loader rejects an attribute-less JSON import under --experimental-strip-types).

import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
import { validateProvidersConfig, resolvePair } from '../../tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../tools/agent/providers-config.ts'

declare const process: { cwd(): string }

const CONFIG_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/agent/providers.json`

function loadConfig(): ProvidersConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8') as string) as ProvidersConfig
}

describe('providers.json registry (LLD-C11 / SPEC-R11 AC2)', () => {
  it('parses and satisfies its internal invariants', () => {
    const cfg = loadConfig()
    expect(() => validateProvidersConfig(cfg)).not.toThrow()
    // Enumerates all three providers now (ADR-0073): Anthropic implemented, OpenAI/Gemini the next slices.
    expect(Object.keys(cfg.providers).sort()).toEqual(['anthropic', 'gemini', 'openai'])
    expect(cfg.providers.anthropic!.implemented).toBe(true)
    expect(cfg.providers.openai!.implemented).toBe(false)
    expect(cfg.providers.gemini!.implemented).toBe(false)
    // defaultProvider is implemented, defaultModel ∈ its models (validateProvidersConfig enforces both).
    expect(cfg.defaultProvider).toBe('anthropic')
  })

  it('carries NO secret value — every credential is an env-var NAME, not a key (SPEC-N2)', () => {
    const text = readFileSync(CONFIG_PATH, 'utf8') as string
    const cfg = loadConfig()
    for (const id of Object.keys(cfg.providers)) {
      // envKey is a NAME (the *_API_KEY convention), never a literal secret.
      expect(cfg.providers[id]!.envKey).toMatch(/^[A-Z0-9_]+_API_KEY$/)
    }
    // Defense in depth: no key-shaped literal anywhere in the committed file text.
    expect(text).not.toMatch(/sk-[A-Za-z0-9]{16,}/) // OpenAI / Anthropic secret-key prefix
    expect(text).not.toMatch(/AIza[A-Za-z0-9]{16,}/) // Google API-key prefix
  })

  it('resolvePair is the PAIR-allowlist trust boundary (SPEC-R12)', () => {
    const cfg = loadConfig()
    // A known + implemented + in-catalog pair resolves to its env-var NAME (never a value).
    expect(resolvePair(cfg, 'anthropic', 'claude-sonnet-5')).toEqual({
      ok: true,
      entry: cfg.providers.anthropic!,
      envKey: 'ANTHROPIC_API_KEY',
    })
    // The three rejection causes are each distinguishable (so the proxy degrade + switcher disable differ).
    expect(resolvePair(cfg, 'openai', 'gpt-4.1')).toEqual({ ok: false, reason: 'unimplemented' })
    expect(resolvePair(cfg, 'bogus', 'x')).toEqual({ ok: false, reason: 'unknown-provider' })
    expect(resolvePair(cfg, 'anthropic', 'not-a-model')).toEqual({ ok: false, reason: 'unknown-model' })
  })
})
