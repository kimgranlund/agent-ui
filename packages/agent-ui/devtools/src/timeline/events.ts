// events.ts — the `DevtoolsEvent` NDJSON timeline vocabulary (ADR-0200 clause 4 / SPEC-R7; decomp n3a).
//
// ONE vocabulary everywhere: the seam serializes it, the page renders it, the capture stores it — no
// second shape between page, seam, and capture (SPEC-R7's closing law). One JSON object per line;
// envelope `{seq, at, kind}`; `seq` contiguous from 0 per timeline.
//
// This module lands in two steps along the decomposition's own edges: the TYPE union first (S2 needs it —
// `DevtoolsCapture.timeline` is `DevtoolsEvent[]`, and `replayTransport(capture)` is typed against that),
// then `recordTurn` — the ONE producer of the shape — with slice S3 (n3a's accept row).
//
// Type-only imports below are ERASED (`verbatimModuleSyntax`): the Node-first `./agent` barrel
// contributes zero runtime bytes here — this module stays browser-safe with zero I/O at module scope.

import type { TurnInput } from '@agent-ui/a2ui/agent'
import type { A2uiClientMessage } from '@agent-ui/a2ui'
import type { GenuiActionMessage } from '@agent-ui/a2ui/agent/genui-line'
import type { A2uiMetaEnvelope } from '@agent-ui/a2ui/agent/meta-line'

/** The parsed payload of one `a2uiMeta` meta-line (ADR-0088's envelope, unwrapped) — what a `meta`
 *  event carries, routed distinctly from raw `line` events (SPEC-R7). */
export type DevtoolsMeta = A2uiMetaEnvelope['a2uiMeta']

/** A turn's terminal disposition (SPEC-R7): `ok` — the stream completed; `error` — the transport threw
 *  mid-turn (an `error` event precedes this); `halt` — the stream completed but its LAST meta-line
 *  carried a transport-composed terminal `a2uiMeta.error` (the GH #144 halt-and-report idiom: an
 *  already-200 stream reporting its own failure in-band). */
export type TurnEndStatus = 'ok' | 'error' | 'halt'

/** The closed event-kind vocabulary (SPEC-R7). */
export const DEVTOOLS_EVENT_KINDS = ['turn-start', 'line', 'meta', 'client', 'render', 'turn-end', 'error'] as const
export type DevtoolsEventKind = (typeof DEVTOOLS_EVENT_KINDS)[number]

/** The shared envelope: `seq` contiguous from 0 per timeline; `at` an ISO-8601 timestamp (injectable in
 *  `recordTurn` for deterministic tests — NEVER part of the replay contract, which is `seq`-ordered
 *  `line` payloads only, ADR-0200 Consequences' determinism law). */
export interface DevtoolsEventBase {
  seq: number
  at: string
}

/** The `DevtoolsEvent` union — the wire contract (SPEC-R7). `render` events are browser-truth ONLY
 *  (SPEC-R9): a real page posts them; a headless seam run carries NONE — absence, never fabrication. */
export type DevtoolsEvent =
  | (DevtoolsEventBase & { kind: 'turn-start'; input: TurnInput; backend: string })
  | (DevtoolsEventBase & { kind: 'line'; line: string })
  | (DevtoolsEventBase & { kind: 'meta'; meta: DevtoolsMeta })
  | (DevtoolsEventBase & { kind: 'client'; message: A2uiClientMessage | GenuiActionMessage })
  | (DevtoolsEventBase & { kind: 'render'; surfaceId: string; ok: boolean; error?: string })
  | (DevtoolsEventBase & { kind: 'turn-end'; status: TurnEndStatus; lines: number; ms: number })
  | (DevtoolsEventBase & { kind: 'error'; message: string })
