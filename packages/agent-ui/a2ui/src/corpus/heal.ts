// heal.ts — the ONE shared healer (corpus LLD-C7, ADR-0061).
//
// Text-first, per-line-capable: the SAME function serves corpus admission (a whole `A2uiOutput`,
// or the raw text an LLM emitted) AND the future streaming codec (one JSONL line at a time,
// `stream/codec.ts`, streaming LLD-C1 §2). Both callers bind this module — never a second
// implementation (ADR-0061 "Alternatives considered": two healers is the exact fork the streaming
// v0.2 reconciliation excised).
//
// The repair list is CLOSED and form-only (mirrors A2UI's own `parse_response` + `payload_fixer`):
//   (a) markdown-fence / surrounding-prose stripping to extract the JSON payload  → 'fence-strip'
//   (b) trailing-comma removal                                                    → 'trailing-comma'
//   (c) single-object → array envelope normalization                             → 'single-object-envelope'
//   (d) a missing per-message `version` filled from the caller's pin              → 'version-fill'
//   (e) an envelope-level `surfaceId` moved into the one surface op that lacks it  → 'surface-id-move'
// Structured (`A2uiOutput`) input skips the text arms (a)/(b); only (c)/(d)/(e) can still apply, so an
// already-array, already-versioned ADR-0055 seed heals to `changed:false`.
//
// Arm (e) is Kim's 2026-10-29 ruling (T-0588, round 20 cluster S), recorded here because the ADRs are
// frozen: it widens the ADR-0061 clause 1 list by this one arm. It is form: the message names exactly
// one id and one op, and the key sits one level too high. It never decides between two ids: an op that
// already carries `surfaceId` (equal, different or not a string) is left alone for tier-1.
//
// NOTHING SEMANTIC IS EVER REPAIRED. Unknown components, malformed pointers, missing/duplicate roots,
// wrong catalogs — none of these are form defects, so heal never touches them; they flow through
// unchanged to tier-1 (`validateA2ui`, `../renderer/validate.ts`) and reject there. Widening the closed
// list takes a recorded ruling (ADR-0061 clause 1, now frozen; arm (e) above), never an ad-hoc addition here (each new arm must argue it
// is form, not semantics).
//
// Zero-dep, platform-neutral (SPEC-N5): no imports beyond the local `protocol.ts` types.

import type { A2uiOutput } from '../protocol.ts'

/** The caller's protocol-version pin — enables repair (d); its absence simply disables that one arm. */
export interface HealPin {
  protocolVersion: string
}

/**
 * The ADR-0061 contract. `ok:true` always carries a `messages` array (even when `changed` is false —
 * the caller's next stage, tier-1, always runs against `messages`, never the raw `input`). `ok:false`
 * means the input could not be coerced into a JSON value at all; callers map this to their own failure
 * vocabulary (admission → `E_SCHEMA`, the streaming codec → `PARSE`) — the healer stays verdict-neutral.
 */
export type HealResult =
  | { ok: true; messages: A2uiOutput; changed: boolean; repairs: string[] }
  | { ok: false; reason: 'unparseable' }

/** Heal one payload — a raw string (admission's whole-output text, or one streamed JSONL line) or an
 * already-structured `A2uiOutput`. `pin`, when given, deterministically fills an ABSENT per-message
 * `version` (arm d); a *wrong* version is left untouched — it still rejects downstream via tier-1's
 * `VERSION_UNSUPPORTED` (admission's `E_PIN`). */
export function heal(input: string | A2uiOutput, pin?: HealPin): HealResult {
  const repairs = new Set<string>()
  let payload: unknown

  if (typeof input === 'string') {
    const fenced = stripFenceAndProse(input)
    if (fenced.changed) repairs.add('fence-strip')
    const uncommaed = removeTrailingCommas(fenced.text)
    if (uncommaed.changed) repairs.add('trailing-comma')
    try {
      payload = JSON.parse(uncommaed.text)
    } catch {
      return { ok: false, reason: 'unparseable' }
    }
  } else {
    payload = input
  }

  // Arm (c) — single-object → array. Applies to BOTH text-parsed and directly-structured input (a
  // caller may hand a lone message object even though it is typed `A2uiOutput`).
  let messages: unknown[]
  if (Array.isArray(payload)) {
    messages = payload
  } else if (isPlainObject(payload)) {
    messages = [payload]
    repairs.add('single-object-envelope')
  } else {
    return { ok: false, reason: 'unparseable' }
  }

  // Arm (d) — fill an ABSENT per-message `version` from the pin. Only the key's absence qualifies;
  // a present-but-wrong version is never corrected (that is tier-1's job, not the healer's).
  if (pin) {
    messages = messages.map((m) => {
      if (isPlainObject(m) && !('version' in m)) {
        repairs.add('version-fill')
        return { ...m, version: pin.protocolVersion }
      }
      return m
    })
  }

  // Arm (e): move an envelope-level `surfaceId` into the one surface op that lacks it (T-0588).
  messages = messages.map((m) => {
    const moved = moveStraySurfaceId(m)
    if (moved === m) return m
    repairs.add('surface-id-move')
    return moved
  })

  return { ok: true, messages: messages as A2uiOutput, changed: repairs.size > 0, repairs: [...repairs] }
}

// ── arm (e): stray envelope surfaceId ───────────────────────────────────────────────────────────

/** The ops whose body carries `surfaceId` (validate.ts `MESSAGE_KINDS` minus the envelope-level
 *  `actionResponse` and `callFunction`, ADR-0034). Local so heal keeps its no-import rule. */
const SURFACE_OPS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const

/**
 * `{version, <op>: {...}, surfaceId}` becomes `{version, <op>: {surfaceId, ...}}` when the envelope id is a
 * string, the message has exactly one other key besides `version`, that key is a surface op, its body is an
 * object and the body has no `surfaceId` key. Anything else comes back as the same object.
 */
function moveStraySurfaceId(m: unknown): unknown {
  if (!isPlainObject(m) || typeof m.surfaceId !== 'string') return m
  const { surfaceId, ...rest } = m
  const keys = Object.keys(rest).filter((k) => k !== 'version')
  if (keys.length !== 1) return m
  const op = keys[0]!
  const body = rest[op]
  if (!(SURFACE_OPS as readonly string[]).includes(op) || !isPlainObject(body) || 'surfaceId' in body) return m
  return { ...rest, [op]: { surfaceId, ...body } }
}

// ── arm (a): fence / prose stripping ────────────────────────────────────────────────────────────

/**
 * Extract the JSON payload from a markdown fence (```` ```json ... ``` ````) when present; otherwise
 * drop any leading/trailing prose by slicing from the first `[`/`{` to its matching closing char's
 * LAST occurrence. A pure-whitespace-only difference does not count as a repair (JSON.parse already
 * tolerates that) — `changed` is true only when a fence was found or non-whitespace prose was dropped.
 */
function stripFenceAndProse(raw: string): { text: string; changed: boolean } {
  const fenceMatch = raw.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```/)
  const source = fenceMatch ? fenceMatch[1] : raw
  const trimmed = source.trim()

  const first = trimmed.search(/[[{]/)
  if (first === -1) return { text: trimmed, changed: fenceMatch !== null }

  const closeChar = trimmed[first] === '[' ? ']' : '}'
  const last = trimmed.lastIndexOf(closeChar)
  const sliced = last > first ? trimmed.slice(first, last + 1) : trimmed

  const changed = fenceMatch !== null || sliced !== raw.trim()
  return { text: sliced, changed }
}

// ── arm (b): trailing-comma removal ─────────────────────────────────────────────────────────────

/**
 * Drop a comma that is followed (past only insignificant whitespace) by a closing `}`/`]`, tracking
 * JSON string state (with backslash-escape awareness) so a comma that merely APPEARS inside a string
 * value is never touched — the repair is form-only, never a launder of the payload's actual content.
 */
function removeTrailingCommas(text: string): { text: string; changed: boolean } {
  let out = ''
  let inString = false
  let escaped = false
  let changed = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }

    if (ch === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] === '}' || text[j] === ']') {
        changed = true
        continue // drop this comma
      }
    }

    out += ch
  }

  return { text: out, changed }
}

// — small helpers ————————————————————————————————————————————————————————————————

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
