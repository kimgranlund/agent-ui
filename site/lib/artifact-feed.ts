// site/lib/artifact-feed.ts — LLD-C6/C9 (SPEC-R16 AC2, SPEC-R18): the artifact-feed derivation lib. No DOM (the
// `arena-replay.ts` derivation-vs-page split, so the drift gate can assert this module directly, exactly
// like `a2ui-gallery.ts`'s buildSeedGallery/buildSeedCard split). Parses the committed A2A-over-A2UI
// JSONL feed and decodes it into an ordered `FeedEntry[]` (prose / artifact / handshake), computing the
// SAME checks the standing fixture gate (`a2ui/src/bridge/feed-fixture.test.ts`) runs — pin, schema
// (`validateA2a`), the HV-8 mime tag, the HV-8 capabilities key, and `validateA2ui` — IN-PAGE, never a
// hardcoded badge (the SPEC-R13 "same-gate-in-page" discipline, reused not re-owned).
//
// Fail-closed posture (LLD §8 "a2ui-invalid line mid-feed vs whole-feed"): a curated recorded feed is
// either presentable or not — ANY check failure anywhere in the feed flips the WHOLE load to `ok:false`
// with the concrete reasons; the renderer's own per-line fault isolation is for LIVE streams, not curated
// replays. `verdict` is populated only on the clean path, so a viewer can see exactly which checks ran.
import { validateA2ui, defaultCatalog } from '@agent-ui/a2ui'
import { validateA2a } from '@agent-ui/a2a'
import type { A2aMessage } from '@agent-ui/a2a'
import { A2UI_MIME, unwrapTurn } from '../../packages/agent-ui/a2ui/tools/pipeline/transports/a2a.ts'

// Exported (LLD-C11): the live overlay's synthesized feed header pins this SAME literal — one fact, one
// home in this package, never a second hardcoded "0.3.0" in the page drifting out of sync with this one.
export const PROTOCOL_VERSION = '0.3.0'

/** One feed timeline entry — a prose bubble, an artifact bubble (one renderer host per surface), or both. */
export interface FeedEntry {
  readonly index: number
  readonly role: 'user' | 'agent'
  readonly prose: string[]
  /** Unwrapped envelopes, re-serialized one-per-line for `host.ingest()`. */
  readonly artifact?: { surfaceId: string; lines: string[] }
  /** `metadata.a2uiClientCapabilities`, when present (user turns) — the HV-8 teaching surface. */
  readonly handshake?: Record<string, unknown>
  /** The raw wire line — the inspector's source of truth. */
  readonly wire: string
}

export interface FeedVerdict {
  clean: boolean
  checks: { name: string; failures: string[] }[]
}

export type LoadedFeed = { ok: true; entries: FeedEntry[]; verdict: FeedVerdict } | { ok: false; reasons: string[] }

interface FeedHeader {
  a2aFeed: { protocolVersion: string; a2ui: string; provenance: { source: string; date: string } }
}

function nonBlankLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function parseHeader(line: string): FeedHeader | undefined {
  try {
    const parsed = JSON.parse(line) as unknown
    if (parsed !== null && typeof parsed === 'object' && 'a2aFeed' in parsed) return parsed as FeedHeader
    return undefined
  } catch {
    return undefined
  }
}

const A2UI_ENVELOPE_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse', 'callFunction', 'action', 'functionResponse', 'error']

/** A DataPart whose body carries `version` + a recognized A2UI envelope key but is missing the HV-8 mime
 *  tag — a shape that LOOKS like an a2ui envelope that was never tagged (a real defect a live/malformed
 *  feed could carry; the committed fixture has none, so this check is always clean on it today). */
function looksLikeA2uiEnvelope(data: Record<string, unknown>): boolean {
  return typeof data.version === 'string' && A2UI_ENVELOPE_KEYS.some((k) => k in data)
}

/** The surfaceId of an artifact message's envelopes — every A2UI server envelope carries `surfaceId` at
 *  its own body key (createSurface/updateComponents/updateDataModel/deleteSurface/actionResponse). */
function surfaceIdOfEnvelopes(envelopes: readonly unknown[]): string | undefined {
  for (const e of envelopes) {
    const rec = e as Record<string, unknown>
    for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse']) {
      const body = rec[key] as { surfaceId?: unknown } | undefined
      if (body && typeof body.surfaceId === 'string') return body.surfaceId
    }
  }
  return undefined
}

/**
 * LLD-C9: the per-message entry derivation, extracted from `loadFeed`'s own mapping (a behavioral no-op
 * for the recorded path — the existing jsdom leg passes unchanged, entry-for-entry). Stated honestly: this
 * moves ONLY the per-entry shape (prose / artifact / handshake / wire) — `loadFeed` keeps parse +
 * `validateA2a` + the whole-feed verdict accumulation it owns today (including the `validateA2ui` check
 * over an artifact message's envelopes); those checks do NOT move here, so this function never appends to
 * a verdict and never fails — it only DERIVES. The live overlay (LLD-C11) renders every bubble, live or
 * recorded, through this ONE derivation — no second bubble-building fork. */
export function deriveFeedEntry(message: A2aMessage, index: number): FeedEntry {
  const { envelopes, prose } = unwrapTurn(message)
  const surfaceId = surfaceIdOfEnvelopes(envelopes)
  const artifact: FeedEntry['artifact'] = surfaceId !== undefined ? { surfaceId, lines: envelopes.map((e) => JSON.stringify(e)) } : undefined
  const handshake = message.role === 'user' ? (message.metadata?.a2uiClientCapabilities as Record<string, unknown> | undefined) : undefined
  return { index, role: message.role, prose, artifact, handshake, wire: JSON.stringify(message) }
}

/** Parse + validate a raw feed (a Vite `?raw` static import of the committed fixture, or a live proxy's
 *  response text — this module only parses/derives, never fetches). */
export function loadFeed(raw: string): LoadedFeed {
  const lines = nonBlankLines(raw)
  if (lines.length === 0) return { ok: true, entries: [], verdict: { clean: true, checks: [] } }

  const [headerLine, ...messageLines] = lines
  const header = parseHeader(headerLine!)
  if (header === undefined) return { ok: false, reasons: ['first line is not a valid feed header ({"a2aFeed": …})'] }

  const pinFailures: string[] = []
  if (header.a2aFeed.protocolVersion !== PROTOCOL_VERSION) {
    pinFailures.push(`unsupported protocolVersion "${header.a2aFeed.protocolVersion}" (expected "${PROTOCOL_VERSION}")`)
  }
  if (header.a2aFeed.a2ui !== 'v1.0') {
    pinFailures.push(`unsupported a2ui version "${header.a2aFeed.a2ui}" (expected "v1.0")`)
  }
  if (pinFailures.length > 0) return { ok: false, reasons: pinFailures }

  const schemaFailures: string[] = []
  const mimeFailures: string[] = []
  const capsFailures: string[] = []
  const a2uiFailures: string[] = []

  const messages: A2aMessage[] = []
  for (const [i, line] of messageLines.entries()) {
    let msg: A2aMessage
    try {
      msg = JSON.parse(line) as A2aMessage
    } catch (e) {
      return { ok: false, reasons: [`line ${i + 2}: invalid JSON (${String(e)})`] }
    }
    for (const f of validateA2a(msg, { protocolVersion: PROTOCOL_VERSION })) {
      schemaFailures.push(`line ${i + 2} (${msg.messageId}): ${f.code} at ${f.path} — ${f.detail}`)
    }
    // A line that isn't message-shaped at all (e.g. a raw /__a2a/feed frame — `{"turn":…}`/`{"part":…}` —
    // forced into a log) has no `parts` array to walk: validateA2a already refused it above; iterating
    // `msg.parts` here would CRASH instead of refusing (a TypeError is not fail-closed — caught by the
    // SPEC-R18 AC2 offline negative, B7). Skip the per-part/caps walks for it; the schema failure stands.
    if (!Array.isArray(msg.parts)) continue
    for (const part of msg.parts) {
      if (part.kind === 'data' && part.metadata?.mimeType !== A2UI_MIME && looksLikeA2uiEnvelope(part.data)) {
        mimeFailures.push(`line ${i + 2} (${msg.messageId}): an a2ui-shaped DataPart is missing metadata.mimeType === "${A2UI_MIME}"`)
      }
    }
    if (msg.role === 'user') {
      const caps = msg.metadata?.a2uiClientCapabilities as { 'v1.0'?: { supportedCatalogIds?: string[] } } | undefined
      if (caps?.['v1.0']?.supportedCatalogIds === undefined) {
        capsFailures.push(`line ${i + 2} (${msg.messageId}): missing metadata.a2uiClientCapabilities (HV-8)`)
      }
    }
    messages.push(msg)
  }

  // LLD-C9: the per-entry SHAPE comes from `deriveFeedEntry` (the ONE derivation the live overlay reuses
  // too); the a2ui validity CHECK stays here — it is part of the whole-feed verdict accumulation, not the
  // entry's own derivation (the refactor's stated scope: only the per-entry derivation moved).
  const entries: FeedEntry[] = messages.map((msg, i) => {
    const entry = deriveFeedEntry(msg, i)
    if (entry.artifact !== undefined) {
      const envelopes = entry.artifact.lines.map((l) => JSON.parse(l) as unknown)
      const verdict = validateA2ui(envelopes, defaultCatalog)
      if (!verdict.valid) {
        for (const f of verdict.failures) {
          a2uiFailures.push(`message ${i + 1} (${msg.messageId}, surface ${entry.artifact.surfaceId}): ${f.code} at ${f.path}`)
        }
      }
    }
    return entry
  })

  const checks: FeedVerdict['checks'] = [
    { name: 'schema (validateA2a)', failures: schemaFailures },
    { name: 'mime tag (HV-8)', failures: mimeFailures },
    { name: 'capabilities (HV-8)', failures: capsFailures },
    { name: 'a2ui (validateA2ui)', failures: a2uiFailures },
  ]
  const allFailures = checks.flatMap((c) => c.failures)
  if (allFailures.length > 0) return { ok: false, reasons: allFailures }

  return { ok: true, entries, verdict: { clean: true, checks } }
}
