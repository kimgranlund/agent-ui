// validate-mode.test.ts — LLD-C6 / ADR-0090 §4: a dedicated unit test for `validateMode`
// (`tools/agent/dev-proxy-plugin.ts`), the pure membership check that guards `mode` at the proxy's
// security-adjacent input-validation boundary (Consequences) before it ever reaches
// `produce()`/`buildSystemPrompt`. Previously proven only by trace + the `build-key-safety.test.ts`
// backstop (a source-scan gate, not a behavior test) — this file exercises the function directly. This
// test lives in the vitest+tsc include (`src/live-agent/`, the `providers-config.test.ts` precedent) and
// imports the Node-scoped `tools/agent/` module by relative path, transitively typechecking it.

import { describe, it, expect } from 'vitest'
import { validateMode } from '../../tools/agent/dev-proxy-plugin.ts'

describe('validateMode (LLD-C6 / ADR-0090 §4 — the mode membership guard)', () => {
  it('accepts a valid mode string and returns it unchanged', () => {
    expect(validateMode('specific')).toBe('specific')
  })

  it('rejects an unrecognized string, returning undefined (never throws, never a 400)', () => {
    expect(validateMode('nonsense')).toBeUndefined()
  })

  it('rejects a non-string value, returning undefined', () => {
    expect(validateMode(123)).toBeUndefined()
    expect(validateMode(null)).toBeUndefined()
    expect(validateMode({})).toBeUndefined()
  })

  it('rejects undefined itself, returning undefined', () => {
    expect(validateMode(undefined)).toBeUndefined()
  })
})
