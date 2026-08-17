// format.ts — the `DevtoolsCapture` format (ADR-0200 clause 7 / SPEC-R10; decomp n6).
//
// The TYPE landed early (S2): `replayTransport(capture)` (SPEC-R3) is typed against it, and the
// decomposition's own edge n3a→n6 says the vocabulary precedes the format that stores it. The
// behavior half lives here too — `parseCapture`/`serializeCapture` (typed parse errors naming the
// offending field, SPEC-R10 AC3); ONE format module owns serialization (ADR-0200 Consequences), so
// the harness page's export/import AND the agent-admin debug bundle's additive `captures/` family
// both ride these two functions, never a second writer of the shape. `parseCapture` landed ahead of
// the page slice by the decomposition's own n6→n4 edge (the page's export/import controls read+write
// the capture format — the format precedes its consumer).

import type { Session } from '@agent-ui/a2ui/agent'
import type { DevtoolsEvent } from '../timeline/events.ts'
import { DEVTOOLS_EVENT_KINDS } from '../timeline/events.ts'
import type { BackendId } from '../transports/backends.ts'
import { BACKEND_IDS } from '../transports/backends.ts'

/** The capture discriminator — pinned so a capture is self-identifying inside any bundle. */
export const DEVTOOLS_CAPTURE_KIND = 'agent-ui-devtools-capture' as const

/** The current capture format version. Bump ONLY when a consumer MUST know (the debug-bundle
 *  manifest's own bump rule, cited by ADR-0200 clause 7). */
export const DEVTOOLS_CAPTURE_VERSION = 1 as const

/**
 * A persisted, replayable session capture (SPEC-R10): the session turns plus the full `DevtoolsEvent`
 * timeline recorded around them. Round-trip law: replaying a capture through `replayTransport` yields
 * a byte-identical `line` sequence — anything nondeterministic in here is a format defect by
 * definition (`seq` ordering is the contract).
 */
export interface DevtoolsCapture {
  kind: typeof DEVTOOLS_CAPTURE_KIND
  version: typeof DEVTOOLS_CAPTURE_VERSION
  /** ISO-8601 creation instant — provenance only, never part of the replay contract. */
  createdAt: string
  /** Which backend produced the recorded turns (a descriptor row id, SPEC-R2). */
  backend: BackendId
  /** The browser-held turn history (ADR-0137's `Session`, byte-unchanged). */
  session: Session
  /** The recorded event timeline — `line` events carry the replayable wire, in `seq` order. */
  timeline: DevtoolsEvent[]
}

/** The typed parse failure (SPEC-R10 AC3): `field` names the offending member (`timeline[3].line`,
 *  `backend`, `(root)` for a non-JSON body) so a failing import is a one-look diagnosis. */
export class CaptureParseError extends Error {
  readonly field: string
  constructor(field: string, detail: string) {
    super(`invalid DevtoolsCapture: ${field} — ${detail}`)
    this.name = 'CaptureParseError'
    this.field = field
  }
}

/** Serialize one capture as its persisted text (pretty-printed — the debug bundle's own `prettyJson`
 *  reading posture, GH #889). Determinism note: byte-stability of the TEXT is construction-order's;
 *  the replay CONTRACT is the `seq`-ordered `line` sequence, never the serialization (ADR-0200
 *  Consequences' determinism law). */
export function serializeCapture(capture: DevtoolsCapture): string {
  return `${JSON.stringify(capture, null, 2)}\n`
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Per-kind required-field rows for timeline validation — one entry per DevtoolsEvent arm (SPEC-R7's
 *  closed vocabulary), each a `[field, predicate, expected]` triple checked against the event object. */
const EVENT_FIELD_RULES: Record<(typeof DEVTOOLS_EVENT_KINDS)[number], ReadonlyArray<[string, (v: unknown) => boolean, string]>> = {
  'turn-start': [
    ['input', isRecord, 'an object'],
    ['backend', (v) => typeof v === 'string', 'a string'],
  ],
  line: [['line', (v) => typeof v === 'string', 'a string']],
  meta: [['meta', isRecord, 'an object']],
  client: [['message', isRecord, 'an object']],
  render: [
    ['surfaceId', (v) => typeof v === 'string', 'a string'],
    ['ok', (v) => typeof v === 'boolean', 'a boolean'],
  ],
  'turn-end': [
    ['status', (v) => v === 'ok' || v === 'error' || v === 'halt', "'ok' | 'error' | 'halt'"],
    ['lines', (v) => typeof v === 'number', 'a number'],
    ['ms', (v) => typeof v === 'number', 'a number'],
  ],
  error: [['message', (v) => typeof v === 'string', 'a string']],
}

/**
 * Parse + validate one persisted capture (SPEC-R10 AC3): returns the typed `DevtoolsCapture` or throws
 * a `CaptureParseError` NAMING the offending field — malformed JSON, a wrong discriminator/version, a
 * non-member backend id, a session without turns, or any timeline event missing its arm's required
 * members. The inverse of `serializeCapture`; a parsed capture feeds `replayTransport` directly
 * (SPEC-R10 AC1's round-trip law).
 */
export function parseCapture(text: string): DevtoolsCapture {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new CaptureParseError('(root)', `not JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!isRecord(parsed)) throw new CaptureParseError('(root)', 'not an object')
  if (parsed.kind !== DEVTOOLS_CAPTURE_KIND) {
    throw new CaptureParseError('kind', `expected '${DEVTOOLS_CAPTURE_KIND}', got ${JSON.stringify(parsed.kind)}`)
  }
  if (parsed.version !== DEVTOOLS_CAPTURE_VERSION) {
    throw new CaptureParseError('version', `expected ${DEVTOOLS_CAPTURE_VERSION}, got ${JSON.stringify(parsed.version)}`)
  }
  if (typeof parsed.createdAt !== 'string') throw new CaptureParseError('createdAt', 'expected an ISO-8601 string')
  if (!(BACKEND_IDS as readonly unknown[]).includes(parsed.backend)) {
    throw new CaptureParseError('backend', `expected one of ${BACKEND_IDS.join(' | ')}, got ${JSON.stringify(parsed.backend)}`)
  }
  if (!isRecord(parsed.session)) throw new CaptureParseError('session', 'expected an object')
  if (!Array.isArray((parsed.session as { turns?: unknown }).turns)) {
    throw new CaptureParseError('session.turns', 'expected an array')
  }
  if (!Array.isArray(parsed.timeline)) throw new CaptureParseError('timeline', 'expected an array')
  for (const [i, event] of (parsed.timeline as unknown[]).entries()) {
    if (!isRecord(event)) throw new CaptureParseError(`timeline[${i}]`, 'expected an object')
    if (typeof event.seq !== 'number') throw new CaptureParseError(`timeline[${i}].seq`, 'expected a number')
    if (typeof event.at !== 'string') throw new CaptureParseError(`timeline[${i}].at`, 'expected a string')
    const kind = event.kind
    if (typeof kind !== 'string' || !(DEVTOOLS_EVENT_KINDS as readonly string[]).includes(kind)) {
      throw new CaptureParseError(`timeline[${i}].kind`, `expected one of ${DEVTOOLS_EVENT_KINDS.join(' | ')}, got ${JSON.stringify(kind)}`)
    }
    for (const [field, predicate, expected] of EVENT_FIELD_RULES[kind as (typeof DEVTOOLS_EVENT_KINDS)[number]]) {
      if (!predicate(event[field])) throw new CaptureParseError(`timeline[${i}].${field}`, `expected ${expected}`)
    }
  }
  return parsed as unknown as DevtoolsCapture
}
