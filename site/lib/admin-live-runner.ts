// admin-live-runner.ts — ALM-C7 / TKT-0052 (ADR-0136): the live-turn runner for `ui-agent-admin`'s chat
// preview, probed at runtime in EVERY environment as of ADR-0152 (which REVERSES ADR-0131 cl.4/7's
// dev-only ruling for this page pair — see ADR-0152 for the full rationale). It is the site-side
// implementation of the app-local `AdminAgentTurn` seam (agent-admin-schema.ts): one `AdminTurnRequest` in,
// the model's full reply string out. Browser → the mounted proxy: in dev, `dev-proxy-plugin.ts`'s `/chat`
// branch (holds the key SERVER-side, validates the {provider,model} pair against providers.json); in
// production, the Cloudflare Worker port of the same proxy (`tools/agent/worker/index.ts`) at the same
// mount → one JSON `{text}` back. This module SHIPS in the production build (both `agent-admin.ts` and
// `agent-admin-app.ts` reach it via a runtime `/status` probe, not a dev-only import guard). Plain fetch;
// NO key lives here (the proxy holds it) — no `import.meta.env.VITE_*` reference at all. The `a2ui-live` →
// `live-proxy-transport.ts` precedent, adapted to agent-admin's prose-reply (not A2UI-JSONL) shape.

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
// genui-surface.spec.md SPEC-R1 — the SAME canonical reader `produce()` peels lines with (never a
// page-local re-implementation); zero-dep/pure, browser-safe (SPEC-N1).
import { readGenuiLine } from '../../packages/agent-ui/a2ui/src/agent/genui-line.ts'
// genui-surface.spec.md SPEC-R8 — the sibling "client message" shape a genui bridge action bubbles as
// (never an A2uiClientMessage); frameClientMessage/nextTurn accept the union of both.
import type { GenuiActionMessage } from '../../packages/agent-ui/a2ui/src/agent/genui-line.ts'
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
      // ADR-0168 cl.5 (GH #402) — `integrations` rides the SAME unconditional-key shape `effort` already
      // proves: JSON.stringify DROPS an `undefined` value, so a request carrying no enablement leaves this
      // body byte-identical to the pre-amendment one (SPEC-R19's absent-field requirement) with no
      // conditional spread. The host route intersects the labels with its own registry; nothing here knows
      // which ones are real.
      body: JSON.stringify({ system: req.system, model: req.model, messages, effort: req.effort, integrations: req.integrations }),
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

// ── GH #567 S6 (LLD-C6/SPEC-R28, Kim's F1 ruling) — the admin GET, read LIVE ────────────────────────────

/** The dev proxy's served trio shape (SPEC-R28) — `{id, label, description}`, nothing else. */
export interface LiveIntegrationTrio {
  id: string
  label: string
  description: string
}

/** Ask the dev proxy for its discovered registry trios (`mcp:*` entries included, post-boot-gate).
 *  DEV ONLY — the page's own call site gates on `import.meta.env.DEV` (agent-admin-app.ts): the GET
 *  route exists only under `vite dev` (`dev-proxy-plugin.ts`'s `apply: 'serve'`); production keeps the
 *  hand-authored `INTEGRATION_TOOLS` pack untouched (`worker/index.ts` stays frozen, no GET twin —
 *  ADR-0177 §0/Non-goals — a stated temporary asymmetry, the SAME one the Worker-rollout deferral
 *  already accepts for discovery itself). Any failure (no proxy, network fault, malformed body)
 *  degrades to `undefined` — the mirror of `probeLive`'s own not-available degrade above — so the
 *  caller's existing static pack is never replaced with a broken or partial one. */
export async function fetchLiveIntegrations(): Promise<LiveIntegrationTrio[] | undefined> {
  try {
    const res = await fetch(`${PRODUCE_ENDPOINT}/integrations`)
    if (!res.ok) return undefined
    const body = (await res.json()) as { integrations?: unknown }
    if (!Array.isArray(body.integrations)) return undefined
    const isTrio = (v: unknown): v is LiveIntegrationTrio =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as LiveIntegrationTrio).id === 'string' &&
      typeof (v as LiveIntegrationTrio).label === 'string' &&
      typeof (v as LiveIntegrationTrio).description === 'string'
    return body.integrations.every(isTrio) ? (body.integrations as LiveIntegrationTrio[]) : undefined
  } catch {
    return undefined
  }
}

// ── GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the additive `services` array, read LIVE ─────────────────────

/** ADR-0189 cl.3 (GH #877) — one real per-tool trio, the SAME `{id, label, description}` shape
 *  `LiveIntegrationTrio` carries, nested under a `LiveServiceRow`'s `tools` array. */
export interface LiveServiceTool {
  id: string
  label: string
  description: string
}

/** The dev proxy's served SERVICE-row shape (SPEC-R4) — one row per live MCP server, `id` a
 *  `mcp:<server-id>:*` service ref (never a registry key), `description` the boot-count aggregate
 *  (unchanged — a compact summary fact), and (ADR-0189 cl.3, GH #877) `tools` — one real per-tool
 *  trio per member manifest, additive, never replacing `description`. */
export interface LiveServiceRow {
  id: string
  label: string
  description: string
  tools: LiveServiceTool[]
}

/** SPEC-R4/R5 (LLD-C6) — ask the dev proxy for its live MCP SERVICE rows (`body.services`, the S2 array
 *  beside `integrations`). The SAME degrade-to-`undefined` law `fetchLiveIntegrations` above takes, and for
 *  the SAME reasons: no proxy / a network fault / a non-array / a malformed row all degrade to `undefined`,
 *  so the caller's MCP-services pack is ABSENT rather than stale or partial (SPEC-R5 — no static service
 *  roster exists to fall back to). A pre-S2 proxy answers a body with NO `services` key at all —
 *  `Array.isArray(undefined)` is `false`, so that too degrades to `undefined` (old proxy + new page is
 *  safe). Deliberately a SECOND GET of the same route rather than a shared body with `fetchLiveIntegrations`
 *  (LLD §6.3): coupling the two functions' degrade paths buys nothing on a dev-only, one-page-load probe.
 *  ADR-0189 cl.3 (GH #877) — a row missing `tools` (a pre-ADR-0189 proxy) degrades the WHOLE array to
 *  `undefined`, the same all-or-nothing shape law `isRow` already applies to the trio fields — never a
 *  partially-typed row half-consumed downstream. */
export async function fetchLiveServices(): Promise<LiveServiceRow[] | undefined> {
  try {
    const res = await fetch(`${PRODUCE_ENDPOINT}/integrations`)
    if (!res.ok) return undefined
    const body = (await res.json()) as { services?: unknown }
    if (!Array.isArray(body.services)) return undefined
    const isTool = (v: unknown): v is LiveServiceTool =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as LiveServiceTool).id === 'string' &&
      typeof (v as LiveServiceTool).label === 'string' &&
      typeof (v as LiveServiceTool).description === 'string'
    const isRow = (v: unknown): v is LiveServiceRow =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as LiveServiceRow).id === 'string' &&
      typeof (v as LiveServiceRow).label === 'string' &&
      typeof (v as LiveServiceRow).description === 'string' &&
      Array.isArray((v as LiveServiceRow).tools) &&
      (v as LiveServiceRow).tools.every(isTool)
    return body.services.every(isRow) ? (body.services as LiveServiceRow[]) : undefined
  } catch {
    return undefined
  }
}

/** Build the injectable SURFACE-turn runner: one closure per call, owning ONE fresh a2ui `Session` — the
 *  page re-creates it per persona switch, so each persona's game/transcript starts clean. Streams typed
 *  events (the peeled ADR-0088 note + validated wire lines); appends the session turns only after a turn
 *  fully streams (a thrown turn leaves the transcript unchanged, matching a2ui-chat's failed-turn law). */
export function createAdminSurfaceTurn(): AdminAgentSurfaceTurn {
  // ADR-0178 cl.5 — ONE `Session` PER CONTEXT, not one per closure. The guided-authoring flow runs two
  // conversations over a single draft persona (the Builder interview and the draft's own test chat), and
  // they are different agents' transcripts: a shared session would replay the interview to the draft as
  // its own memory, so the draft would "remember" being designed. Keyed by `req.session ?? 'test'`, which
  // makes every pre-authoring caller land on the same single 'test' history it always had.
  // Per-persona re-arming (the page re-creates this closure on a persona switch) still resets both.
  const sessions = new Map<string, Session>()
  return async function* (req: AdminSurfaceTurnRequest): AsyncIterable<AdminSurfaceTurnEvent> {
    const sessionKey = req.session ?? 'test'
    const session: Session = sessions.get(sessionKey) ?? { turns: [] }
    const input: TurnInput =
      req.turn.kind === 'intent'
        ? { kind: 'intent', text: req.turn.text, session }
        : nextTurn(session, req.turn.message as A2uiClientMessage | GenuiActionMessage)
    const res = await fetch(PRODUCE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // GH #240/ADR-0159 wave B — `progressDetail:'source'`: the admin developer surface's standing opt-in
      // to the per-step raw-source attachment (`TurnProgress.source` on validating/retry progress events).
      // Membership-validated server-side (dev proxy + worker: only the literal 'source' is honored; 'full'
      // stays server-owned); every other consumer (a2ui-chat/a2ui-live) never sends it — their streams stay
      // source-free, the fail-closed default.
      body: JSON.stringify({
        input,
        provider: PROVIDER,
        model: req.model,
        personaSystem: req.personaSystem,
        integrations: req.integrations,
        progressDetail: 'source',
        // GH #270's additive precedent (`live-proxy-transport.ts`'s `sel.effort`) — absent ⇒ the POST
        // body carries no `effort` key at all (byte-identical to before this field existed); `produce()`'s
        // own `validateEffort` degrades an absent/malformed value to `undefined` either way.
        ...(req.effort !== undefined ? { effort: req.effort } : {}),
        // genui-surface.spec.md SPEC-R10/R11 — a FRESH per-turn read (the component's own live-apply
        // law); the dev proxy / worker thread this straight into `ProduceOptions.genuiSurface` (server-
        // side, Node-first — the pack registry itself never crosses the wire, only the ALREADY-RESOLVED
        // picked source's body does, per `pickedPatternSource`'s own projection).
        genui: req.genui,
        // ADR-0169 cl.5 — the Surface Options catalog picker's sanitized selection, forwarded onto the
        // produce POST body (the `effort` absent-⇒-omit-key precedent above): absent ⇒ the body carries
        // no `catalogId` key at all, and the server degrades to the default catalog either way.
        ...(req.catalogId !== undefined ? { catalogId: req.catalogId } : {}),
        // GH #418 — the A2UI Surface Option's OWN fresh per-turn read; the dev proxy / worker thread this
        // straight into `ProduceOptions.a2uiEnabled`. Absent ⇒ the POST body carries no `a2ui` key at all
        // (byte-identical to before this field existed, the `effort`-absent precedent above); both
        // transports' `validateA2uiEnabled` degrades an absent/malformed value to `undefined` either way.
        ...(req.a2uiEnabled !== undefined ? { a2ui: req.a2uiEnabled } : {}),
        // ADR-0178 cl.3 / SPEC-R30 — the persona-authoring gate's own fresh per-turn read; both
        // transports validate it fail-closed (`validateAuthoringSurface`) and thread it into
        // `ProduceOptions.authoringSurface`. Absent ⇒ the POST body carries no `authoring` key at all
        // (the `effort`/`a2ui` absent-⇒-omit precedent), so a non-authoring turn's body is byte-identical
        // to one built before this field existed.
        ...(req.authoring !== undefined ? { authoring: req.authoring } : {}),
        // ADR-0182 cl.1 — `builderMission` is DERIVED here, never carried on `AdminSurfaceTurnRequest`
        // itself: its true source is structural turn-origin (is THIS turn the Builder's own dedicated
        // interview?), which `session === 'authoring'` already answers exactly (the SAME field this
        // runner already reads at `sessionKey` above, per-context — never a persona-editable flag).
        // Sent unconditionally (never the absent-⇒-omit shape the OTHER gates use above) because it is
        // never undefined here — every request either IS the Builder's own turn or is not.
        builderMission: sessionKey === 'authoring',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok || res.body === null) {
      throw new Error(`Live agent proxy error (${res.status} ${res.statusText}).`)
    }
    const turnLines: string[] = []
    try {
      for await (const line of readNdjsonLines(res.body)) {
        const meta = readMetaLine(line)
        if (meta) {
          // GH #144: a transport-composed terminal `error` meta-line (`formatErrorLine`, worker/index.ts /
          // dev-proxy-plugin.ts) means `produce()` halted or faulted AFTER headers already committed 200 —
          // the ONLY way that failure crosses the wire. Throw here so it routes into the SAME visible
          // fail() path a non-2xx response already uses (`#runSurfaceTurn`'s catch → `handle.fail(...)`),
          // instead of this generator completing normally with an empty `turnLines` — which used to render
          // as a silent, empty "success" (the reported "HTTP 200, `lines: []`, nothing shown").
          if (typeof meta.a2uiMeta.error === 'string' && meta.a2uiMeta.error.length > 0) {
            throw new Error(`Live agent turn failed (${meta.a2uiMeta.error}).`)
          }
          // ADR-0146 F1 — a progress meta-line routes to the conversation's handle.progress (live narration);
          // it is never ingested as content (the SAME peel that already isolates note/trace, one arm added).
          if (meta.a2uiMeta.progress) yield { kind: 'progress', progress: meta.a2uiMeta.progress }
          if (typeof meta.a2uiMeta.note === 'string' && meta.a2uiMeta.note.length > 0) {
            yield { kind: 'note', note: meta.a2uiMeta.note }
          }
          // GH #802 (ADR-0097 §1) — a declared feed ASK peels into its own typed event, beside note/
          // progress. The ROUTING FACT only ("that surfaceId is an ask"), never a payload: the ask's own
          // surface rides the ordinary validated `line` stream below, completely unchanged (ADR-0097 §1's
          // own division). Peeled here for the SAME reason `personaPatch`/`plan` are — this runner peels,
          // the component decides what it means (its ask-aware dialog-round routing, agent-admin.ts).
          // `produce()` has already DROPPED any ask whose integrity failed (`askIntegrityHolds`: no
          // matching createSurface this turn, or a session-colliding id), so an `ask` that reaches this
          // line names a surface this very turn creates.
          if (meta.a2uiMeta.ask) yield { kind: 'ask', ask: meta.a2uiMeta.ask }
          // ADR-0178 cl.2 / SPEC-R29 — a declared persona patch peels into its own typed event, beside
          // note/progress. GATE-BLIND on purpose: the runner does not read the authoring gate, does not
          // know which store drives this turn, and never decides consumption. A second enforcement point
          // here could only drift from the component's own (which is conjunctive — the store-identity
          // fence AND a fresh gate read), and the shipped division of labour is that the runner peels
          // and the component consumes.
          if (meta.a2uiMeta.personaPatch) yield { kind: 'patch', patch: meta.a2uiMeta.personaPatch }
          // ADR-0182 cl.4 / SPEC-R20 — a declared plan (the ALREADY-SHIPPED arm, reused verbatim) peels
          // into its own typed event, the SAME `personaPatch` peel precedent immediately above: no
          // integrity check, no gate read here — this runner peels, the component decides whether/how
          // to render it.
          if (meta.a2uiMeta.plan) yield { kind: 'plan', plan: meta.a2uiMeta.plan }
          // ADR-0198 cl.1 (GH #1101) — the model's explicit flow-completion declaration peels into its
          // own typed event, the SAME peel-here-consume-there division as `patch`/`plan`: the PAGE's
          // wrapper consumes it (the shared flow-chrome affordance is page chrome, ADR-0198 cl.3) and
          // filters it before the component ever sees it. `readMetaLine` already enforced literal-true.
          if (meta.a2uiMeta.flowEnd === true) yield { kind: 'flowEnd' }
          continue // the meta-line is never ingested (ADR-0088 §1)
        }
        // genui-surface.spec.md SPEC-R1 — a genui line is neither an A2uiServerMessage nor a meta-line
        // (disjointness proof); the SAME structural reader `produce()` used server-side to peel/validate
        // it, run again here as defense-in-depth (SPEC-R1's "reader never throws" — a line that somehow
        // reached this far malformed is simply not a genui line, and falls through to the `line`/`ingestLine`
        // arm below, where the A2UI healer/validator will reject it exactly as any other malformed content).
        const genui = readGenuiLine(line)
        if (genui) {
          yield { kind: 'genui', surfaceId: genui.genui.surfaceId, html: genui.genui.html }
          continue // a genui line is never ingested as A2UI content (mirrors the meta-line peel above)
        }
        turnLines.push(line)
        yield { kind: 'line', line }
      }
    } catch (err) {
      // GH #144: the OTHER silent-looking failure mode reported — the client's own `TIMEOUT_MS` firing
      // mid-stream aborts the fetch, and reading `res.body` then rejects with a low-level stream error
      // (Chromium: "BodyStreamBuffer was aborted") that names no cause a person can act on. `AbortSignal.
      // timeout()` surfaces as either `'TimeoutError'` (its own DOMException `reason`, current spec) or
      // `'AbortError'` (older/observed behavior reading an in-flight body) depending on engine — both name
      // the SAME cause here (this runner's only abort source is `AbortSignal.timeout(TIMEOUT_MS)` above,
      // never a user-triggered cancel), so both rethrow with the actual, actionable explanation; every
      // other error (including the `error` meta-line throw just above) passes through unchanged.
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new Error(`Live agent turn timed out after ${TIMEOUT_MS / 1000}s (still self-correcting when the timeout fired).`)
      }
      throw err
    }
    // Append-after-stream, unchanged in law — a thrown turn leaves the transcript untouched — but now
    // written back to THIS context's own slot, so the two histories stay disjoint.
    const withUser = appendUserTurn(
      session,
      req.turn.kind === 'intent' ? req.turn.text : frameClientMessage(req.turn.message as A2uiClientMessage | GenuiActionMessage),
    )
    sessions.set(sessionKey, appendAssistantTurn(withUser, turnLines.join('\n')))
  }
}

