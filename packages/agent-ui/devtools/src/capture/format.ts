// format.ts — the `DevtoolsCapture` format (ADR-0200 clause 7 / SPEC-R10; decomp n6).
//
// The TYPE lands early (S2): `replayTransport(capture)` (SPEC-R3) is typed against it, and the
// decomposition's own edge n3a→n6 says the vocabulary precedes the format that stores it. The
// behavior half — `parseCapture`/`serializeCapture` (typed parse errors naming the offending field,
// SPEC-R10 AC3) and the agent-admin debug-bundle round-trip (the additive `files.captures` family) —
// is slice S6's and lands here, in this same module (one format module owns serialization, ADR-0200
// Consequences).

import type { Session } from '@agent-ui/a2ui/agent'
import type { DevtoolsEvent } from '../timeline/events.ts'
import type { BackendId } from '../transports/backends.ts'

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
