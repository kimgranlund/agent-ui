// events.ts — the `DevtoolsEvent` NDJSON timeline vocabulary (ADR-0200 clause 4 / SPEC-R7; decomp n3a).
//
// ONE vocabulary everywhere: the seam serializes it, the page renders it, the capture stores it — no
// second shape between page, seam, and capture (SPEC-R7's closing law). One JSON object per line;
// envelope `{seq, at, kind}`; `seq` contiguous from 0 per timeline.
//
// `recordTurn(transport, input)` below is the ONE producer of the shape (SPEC-R7): it wraps ANY
// `AgentTransport` turn into a sequenced event timeline — `a2uiMeta` lines routed to `meta` (parsed,
// via the a2ui guard itself — never a second parser), everything else to `line` verbatim.
//
// The `AgentTransport`/`TurnInput` imports are type-only and ERASED (`verbatimModuleSyntax`): the
// Node-first `./agent` barrel contributes zero runtime bytes here. The one VALUE import, `readMetaLine`,
// rides the declared browser-safe `./agent/meta-line` subpath — this module stays browser-safe with
// zero I/O at module scope.

import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import type { A2uiClientMessage } from '@agent-ui/a2ui'
import type { GenuiActionMessage } from '@agent-ui/a2ui/agent/genui-line'
import { readMetaLine } from '@agent-ui/a2ui/agent/meta-line'
import type { A2uiMetaEnvelope } from '@agent-ui/a2ui/agent/meta-line'

/** The parsed payload of one `a2uiMeta` meta-line (ADR-0088's envelope, unwrapped) — what a `meta`
 *  event carries, routed distinctly from raw `line` events (SPEC-R7). */
export type DevtoolsMeta = A2uiMetaEnvelope['a2uiMeta']

/** A turn's terminal disposition (SPEC-R7): `ok` — the stream completed; `error` — the transport threw
 *  mid-turn (an `error` event precedes this); `halt` — the stream completed but a meta-line carried a
 *  transport-composed terminal `a2uiMeta.error` (the recorder latches on ANY meta error line, wherever
 *  it lands in the stream — the GH #144 halt-and-report idiom: an already-200 stream reporting its own
 *  failure in-band). */
export type TurnEndStatus = 'ok' | 'error' | 'halt'

/** The closed event-kind vocabulary (SPEC-R7). */
export const DEVTOOLS_EVENT_KINDS = ['turn-start', 'line', 'meta', 'client', 'render', 'turn-end', 'error'] as const
export type DevtoolsEventKind = (typeof DEVTOOLS_EVENT_KINDS)[number]

/** Both spellings Claude Code has used for the subagent-invoking tool: `Task` (the pre-v2.1.63 name,
 *  still emitted in `system:init`'s tools list and `permission_denials[].tool_name`) and `Agent` (the
 *  v2.1.63 rename, emitted in `tool_use` blocks — code.claude.com/docs/en/agent-sdk/subagents, fetched
 *  2026-08-29). GH #1701: no call site in this package currently classifies on either name — this
 *  package's `DevtoolsEvent` vocabulary above carries no tool-name field at all — but any future
 *  subagent-tool classification (here or in `@agent-ui/app`) must go through this one constant/guard
 *  rather than a fresh literal, so a second SDK rename never needs a second sweep. */
export const SUBAGENT_TOOL_NAMES = ['Task', 'Agent'] as const
export type SubagentToolName = (typeof SUBAGENT_TOOL_NAMES)[number]

/** `true` when `name` is either spelling Claude Code has used for the subagent-invoking tool. The
 *  single guard any future classification call site (here or in `@agent-ui/app`) must route through
 *  instead of a fresh `=== 'Task'`/`=== 'Agent'` literal (GH #1701). */
export function isSubagentToolName(name: string): name is SubagentToolName {
  return (SUBAGENT_TOOL_NAMES as readonly string[]).includes(name)
}

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

/** Serialize one event as its NDJSON wire line (one JSON object per line, SPEC-R7). The inverse is a
 *  plain `JSON.parse` — every event `recordTurn` produces round-trips structurally equal (AC1), which
 *  is why `meta` payloads are compacted below (JSON has no `undefined`). */
export function serializeDevtoolsEvent(event: DevtoolsEvent): string {
  return JSON.stringify(event)
}

/** Drop `undefined`-valued members from a parsed meta payload: `readMetaLine` returns every optional
 *  field explicitly (`ask: undefined` etc.), which JSON serialization would silently strip — compacting
 *  HERE keeps the in-memory event and its wire form structurally identical (SPEC-R7 AC1). */
function compactMeta(meta: DevtoolsMeta): DevtoolsMeta {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined) out[key] = value
  }
  return out as DevtoolsMeta
}

export interface RecordTurnOptions {
  /** The backend id carried on `turn-start` (a descriptor row id — the seam/page always name one). */
  backend?: string
  /** Injected timestamp source for the `at` envelope field (deterministic tests); default ISO now. */
  now?: () => string
  /** Injected millisecond clock for `turn-end.ms` (deterministic tests); default `Date.now`. */
  clock?: () => number
}

/**
 * The ONE producer of the `DevtoolsEvent` shape (SPEC-R7): wrap one `AgentTransport` turn into a
 * sequenced, typed event timeline. `seq` contiguous from 0; `turn-start` first and `turn-end` last,
 * exactly once each. Every yielded transport line is routed exactly once: an `a2uiMeta` line lands as
 * a parsed `meta` event (via a2ui's own `readMetaLine` guard) and is ABSENT from `line` events; every
 * other line lands verbatim as `line`. A transport throw yields `error` then `turn-end{status:'error'}`
 * (the GH #144 report-in-band discipline — the stream ends visibly, never silently). A stream that
 * completes but whose meta carried a terminal `a2uiMeta.error` ends `turn-end{status:'halt'}` (the
 * produce-halt idiom); otherwise `status:'ok'`.
 *
 * `render`/`client` events are NOT produced here: render verdicts are browser truth a real page posts
 * (SPEC-R9 — a headless run carries none, absence never fabrication), and client messages are the
 * page's own injections.
 */
export async function* recordTurn(
  transport: AgentTransport,
  input: TurnInput,
  opts?: RecordTurnOptions,
): AsyncIterable<DevtoolsEvent> {
  const now = opts?.now ?? (() => new Date().toISOString())
  const clock = opts?.clock ?? (() => Date.now())
  const backend = opts?.backend ?? 'unknown'
  let seq = 0
  let lines = 0
  let sawMetaError = false
  const started = clock()

  yield { seq: seq++, at: now(), kind: 'turn-start', input, backend }
  try {
    for await (const line of transport.turn(input)) {
      const meta = readMetaLine(line)
      if (meta !== undefined) {
        if (meta.a2uiMeta.error !== undefined) sawMetaError = true
        yield { seq: seq++, at: now(), kind: 'meta', meta: compactMeta(meta.a2uiMeta) }
      } else {
        lines += 1
        yield { seq: seq++, at: now(), kind: 'line', line }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    yield { seq: seq++, at: now(), kind: 'error', message }
    yield { seq: seq++, at: now(), kind: 'turn-end', status: 'error', lines, ms: clock() - started }
    return
  }
  yield { seq: seq++, at: now(), kind: 'turn-end', status: sawMetaError ? 'halt' : 'ok', lines, ms: clock() - started }
}
