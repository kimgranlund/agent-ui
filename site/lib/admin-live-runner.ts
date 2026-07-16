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

import type { AdminAgentTurn, AdminTurnRequest, AdminTurn } from '@agent-ui/app/agent-admin-schema'
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
