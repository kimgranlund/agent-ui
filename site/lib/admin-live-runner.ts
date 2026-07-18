// admin-live-runner.ts — ALM-C7 / TKT-0052 (ADR-0136): the DEV-ONLY live-turn runner for
// `ui-agent-admin`'s chat preview. It is the site-side implementation of the app-local `AdminAgentTurn`
// seam (agent-admin-schema.ts): one `AdminTurnRequest` in, the model's full reply string out. Browser →
// the ALREADY-MOUNTED dev proxy (`dev-proxy-plugin.ts`'s `/chat` branch, which holds the key SERVER-side
// and validates the {provider,model} pair against providers.json) → one JSON `{text}` back. This module is
// reached ONLY via the page's dev-only dynamic import (`import.meta.env.DEV`, agent-admin.ts's
// `wireLiveOverlay`), so `vite build` tree-shakes it out and no live-call path is ever baked into the
// static build (SPEC-N2 / ADR-0131 cl.4/7 held). Plain fetch; NO key lives here (the proxy holds it) — no
// `import.meta.env.VITE_*` reference at all. The `a2ui-live` → `live-proxy-transport.ts` precedent, adapted
// to agent-admin's prose-reply (not A2UI-JSONL) shape.

import type {
  AdminAgentTurn,
  AdminTurnRequest,
  AdminTurn,
  AdminAgentSurfaceTurn,
  AdminSurfaceTurnRequest,
  AdminSurfaceTurnEvent,
} from '@agent-ui/app/agent-admin-schema'
// The SURFACE-turn machinery (TKT-0076/ADR-0138) — transport-shaped imports the COMPONENT is fenced from
// (SPEC-N1): the a2ui Session reducer + meta-line peel live HERE, site-side, exactly like a2ui-chat's own
// agent-runtime shim usage. All zero-dep, browser-safe TS.
import type { Session, TurnInput } from '../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import type { A2uiClientMessage } from '@agent-ui/a2ui'
import { nextTurn, appendUserTurn, appendAssistantTurn, frameClientMessage } from '../../packages/agent-ui/a2ui/src/agent/session.ts'
import { readMetaLine } from '../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
import { readNdjsonLines } from './ndjson-lines.ts'
// The live-key probe is shared verbatim with a2ui-live's overlay (a boolean + count; never the key). Static
// import here is fine — this whole module already lives BEHIND the page's dev-only dynamic import, so it is
// tree-shaken out of the static build alongside the runner. Re-exported so the page reaches it through the
// ONE dynamically-imported module (ALM-C8).
export { probeLive } from './live-proxy-transport.ts'
export type { LiveStatus } from './live-proxy-transport.ts'

const ENDPOINT = '/__a2ui/agent/chat'
// A hung upstream must not busy-lock the composer forever (LLD Q5): abort the turn after 120s so the
// conversation's fail() path re-enables the composer. AbortSignal.timeout is a plain platform primitive.
const TIMEOUT_MS = 120_000

/** Build the injectable live-turn runner. Assigned to `admin.agentTurn` ONLY when a live key is present
 *  (ALM-C8), so an unavailable overlay simply never replaces the stub. */
export function createAdminAgentTurn(): AdminAgentTurn {
  return async (req: AdminTurnRequest): Promise<string> => {
    const messages: AdminTurn[] = [...req.history, { role: 'user', content: req.text }]
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system: req.system, model: req.model, messages, effort: req.effort }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      // Surface the proxy's own {error} string (unknown-model / no-key / an upstream fault) when present,
      // else the bare status line — the message the conversation's fail() path shows in its ⚠ bubble.
      let detail = `${res.status} ${res.statusText}`
      try {
        const body = (await res.json()) as { error?: unknown }
        if (typeof body.error === 'string' && body.error.length > 0) detail = body.error
      } catch {
        /* non-JSON body — keep the status line */
      }
      throw new Error(`Live agent proxy error (${detail}).`)
    }
    const body = (await res.json()) as { text?: unknown }
    // A malformed 200 body must never render as a silent empty "success" reply (the ticket's own
    // "never a silently-swallowed failure" acceptance criterion) — throw so it surfaces via fail().
    if (typeof body.text !== 'string') throw new Error('Live agent proxy error (malformed response body).')
    return body.text
  }
}

// ── the SURFACE-turn runner (TKT-0076/ADR-0138) ──────────────────────────────────────────────────────────

const PRODUCE_ENDPOINT = '/__a2ui/agent'
// Every SUPPORTED_MODELS id is a claude-* model, all served by the one implemented provider row in
// providers.json — the {provider, model} PAIR is still allowlist-validated server-side (SPEC-R12), so a
// wrong pairing degrades to a 400 here, never an unauthenticated call.
const PROVIDER = 'anthropic'

/** Build the injectable SURFACE-turn runner: one closure per call, owning ONE fresh a2ui `Session` — the
 *  page re-creates it per persona switch, so each persona's game/transcript starts clean. Streams typed
 *  events (the peeled ADR-0088 note + validated wire lines); appends the session turns only after a turn
 *  fully streams (a thrown turn leaves the transcript unchanged, matching a2ui-chat's failed-turn law). */
export function createAdminSurfaceTurn(): AdminAgentSurfaceTurn {
  let session: Session = { turns: [] }
  return async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    const input: TurnInput =
      req.turn.kind === 'intent'
        ? { kind: 'intent', text: req.turn.text, session }
        : nextTurn(session, req.turn.message as A2uiClientMessage)
    const res = await fetch(PRODUCE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input, provider: PROVIDER, model: req.model, personaSystem: req.personaSystem }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok || res.body === null) {
      throw new Error(`Live agent proxy error (${res.status} ${res.statusText}).`)
    }
    const turnLines: string[] = []
    for await (const line of readNdjsonLines(res.body)) {
      const meta = readMetaLine(line)
      if (meta) {
        // ADR-0146 F1 — a progress meta-line routes to the conversation's handle.progress (live narration);
        // it is never ingested as content (the SAME peel that already isolates note/trace, one arm added).
        if (meta.a2uiMeta.progress) yield { kind: 'progress', progress: meta.a2uiMeta.progress }
        if (typeof meta.a2uiMeta.note === 'string' && meta.a2uiMeta.note.length > 0) {
          yield { kind: 'note', note: meta.a2uiMeta.note }
        }
        continue // the meta-line is never ingested (ADR-0088 §1)
      }
      turnLines.push(line)
      yield { kind: 'line', line }
    }
    session = appendUserTurn(
      session,
      req.turn.kind === 'intent' ? req.turn.text : frameClientMessage(req.turn.message as A2uiClientMessage),
    )
    session = appendAssistantTurn(session, turnLines.join('\n'))
  }
}

