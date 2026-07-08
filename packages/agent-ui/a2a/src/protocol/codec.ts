// codec.ts — byte-fidelity codec (LLD-C2, SPEC-R3 AC1). `decodeA2a` composes the shared validator (a
// decode that skips judgment would fork SPEC-R6/N4); `encodeA2a` is a compact, key-order-preserving
// stringify with no transform. Byte-fidelity holds because fixtures are committed in encode-canonical
// form (LLD §7) — `encodeA2a(decodeA2a(raw)) === raw` over every committed fixture.
import { validateA2a, type A2aFailure, type ValidateA2aOptions } from './validate.ts'

export type DecodeResult<T> = { ok: true; value: T; failures: [] } | { ok: false; value: undefined; failures: A2aFailure[] }

/** Guarded `JSON.parse` + shared validation. NEVER throws — parse failure becomes A2A_SCHEMA at `/`. */
export function decodeA2a<T = unknown>(text: string, opts: ValidateA2aOptions): DecodeResult<T> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      ok: false,
      value: undefined,
      failures: [{ code: 'A2A_SCHEMA', path: '/', detail: `parse error: ${String(e)}`, parse: true }],
    }
  }
  const failures = validateA2a(parsed, opts)
  if (failures.length > 0) return { ok: false, value: undefined, failures }
  return { ok: true, value: parsed as T, failures: [] }
}

/** Compact, key-order-preserving stringify — no transform. */
export function encodeA2a(value: unknown): string {
  return JSON.stringify(value)
}
