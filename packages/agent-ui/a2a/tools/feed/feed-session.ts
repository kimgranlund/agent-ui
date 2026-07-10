// feed-session.ts — LLD-C7 (SPEC-R18 "the log IS the session", ADR-0116 fork F4): derives produce()'s
// `Session`/`TurnInput` from the client-held ordered A2A message log. Pure — the proxy stays stateless, no
// parallel session object is ever shipped (fork F4: one source of truth, not two that can drift).
//
// Pure and browser-safe (LLD §3 split note): type-only + runtime imports from `@agent-ui/a2a`'s own `src`
// (relative, same-package — the barrel is never self-imported) and from the a2ui bridge/session modules
// (the SAME ratified dev-graph edge the arena proxy already uses, `tools/feed/* -> a2ui tools`) — zero
// Node builtins, no I/O.
//
// Header handling: the array this module receives is the CLIENT'S liveLog verbatim (LLD-C11: "the
// client-held liveLog: string[] starts with the header"), the exact wire the proxy's POST body carries
// (LLD-C8) — so the leading `{"a2aFeed":…}` line is recognized and stripped here (mirroring
// `artifact-feed.ts`'s own header-parsing convention) rather than requiring every caller to pre-strip it.
import { validateA2a } from '../../src/protocol/validate.ts'
import type { A2aMessage } from '../../src/protocol/types.ts'
import type { Session, Turn, TurnInput } from '../../../a2ui/tools/agent/agent-transport.ts'
import { frameClientMessage } from '../../../a2ui/tools/agent/session.ts'
import { unwrapTurn } from '../../../a2ui/tools/pipeline/transports/a2a.ts'
import type { A2uiClientMessage } from '../../../a2ui/src/renderer/index.ts'

export type FeedSession =
  | { ok: true; session: Session; input: TurnInput; contextId: string | undefined }
  | { ok: false; status: 400; error: string }

/** Recognize + strip the synthesized `{"a2aFeed":…}` header line the live arm's log always starts with
 *  (LLD-C11 fork F6) — a plain message array (e.g. a test fixture slice with no header) passes through
 *  unchanged; never throws on a malformed/non-JSON first line, it simply isn't recognized as a header. */
function stripHeader(lines: readonly string[]): string[] {
  if (lines.length === 0) return []
  try {
    const parsed = JSON.parse(lines[0]!) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && 'a2aFeed' in parsed) {
      return lines.slice(1)
    }
  } catch {
    // not JSON — not a header, fall through and treat it as (an eventually-failing) message line
  }
  return [...lines]
}

/** One preceding message folded into a `Session.turns` entry (LLD-C7 rule 3): an agent message's
 *  unwrapped envelopes re-serialize one-per-line — exactly what `appendAssistantTurn` stores; a user
 *  message carrying a tagged client DataPart frames via `frameClientMessage` (the SAME framing
 *  `nextTurn`/nextTurn's caller applies on the a2ui-live page); a plain intent-only user message joins its
 *  TextParts. */
function turnFromMessage(msg: A2aMessage): Turn {
  const { envelopes, prose } = unwrapTurn(msg)
  if (msg.role === 'agent') {
    return { role: 'assistant', content: envelopes.map((e) => JSON.stringify(e)).join('\n') }
  }
  if (envelopes.length > 0) {
    return { role: 'user', content: frameClientMessage(envelopes[0] as A2uiClientMessage) }
  }
  return { role: 'user', content: prose.join('\n') }
}

/** The last user message becomes `TurnInput` (LLD-C7 rule 4): `{kind:'client', message}` when it carries
 *  a tagged client envelope (an interaction round-trip), `{kind:'intent', text}` for a typed prose turn. */
function turnInputFromLastUser(msg: A2aMessage, session: Session): TurnInput {
  const { envelopes, prose } = unwrapTurn(msg)
  if (envelopes.length > 0) {
    return { kind: 'client', message: envelopes[0] as A2uiClientMessage, session }
  }
  return { kind: 'intent', text: prose.join('\n'), session }
}

function fail(error: string): FeedSession {
  return { ok: false, status: 400, error }
}

/**
 * Derive the produce() session + this turn's input from the client-held A2A message log (LLD-C7).
 * Rules, in order (each a coded 400 on failure, never a throw):
 *  1. every message line validates clean (`validateA2a`, `expect:'message'`) at `opts.protocolVersion`;
 *  2. the LAST message MUST be `role:'user'` carrying `metadata.a2uiClientCapabilities` (HV-8) —
 *     server-verified, not merely by-construction (SPEC-R18 AC3's "no provider call occurs" arm);
 *  3. every PRECEDING message folds into `Session.turns`;
 *  4. the last user message becomes `TurnInput`.
 * Deterministic: the same `lines` input always yields a deep-equal result (no hidden clock/random state).
 */
export function sessionFromFeed(lines: readonly string[], opts: { protocolVersion: string }): FeedSession {
  const messageLines = stripHeader(lines)
  if (messageLines.length === 0) return fail('feed carries no A2A messages')

  const messages: A2aMessage[] = []
  for (const [i, line] of messageLines.entries()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (e) {
      return fail(`line ${i}: invalid JSON (${String(e)})`)
    }
    const failures = validateA2a(parsed, { protocolVersion: opts.protocolVersion, expect: 'message' })
    if (failures.length > 0) {
      return fail(`line ${i}: ${failures.map((f) => `${f.code} at ${f.path} — ${f.detail}`).join('; ')}`)
    }
    messages.push(parsed as A2aMessage)
  }

  const last = messages[messages.length - 1]!
  if (last.role !== 'user') return fail('the last message in the feed is not a user turn (HV-8 handshake)')
  const caps = last.metadata?.a2uiClientCapabilities as { 'v1.0'?: { supportedCatalogIds?: string[] } } | undefined
  if (caps?.['v1.0']?.supportedCatalogIds === undefined) {
    return fail('the last user message is missing metadata.a2uiClientCapabilities (HV-8)')
  }

  const session: Session = { turns: messages.slice(0, -1).map(turnFromMessage) }
  const input = turnInputFromLastUser(last, session)
  return { ok: true, session, input, contextId: last.contextId }
}
