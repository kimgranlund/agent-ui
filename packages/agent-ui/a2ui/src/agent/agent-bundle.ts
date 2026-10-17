// agent-bundle.ts: T-0163 (agent-content SPEC ACS-R11 to ACS-R13), the environment-neutral half of the one
// agent compiler. `compile()` itself lives beside the composition laws in `@agent-ui/app` (entries.ts), which
// the dev proxy and the Worker may never import; what every place that runs an agent must agree on lives
// here instead: the bundle's fields, its canonical form, its digest, and the resolution entry shape. The
// browser (Test Chat) digests the bundle it sends; the proxy recomputes the digest from the wire body it
// received; the CLI digests the bundle it compiled from files. The three agree because they hash the same
// canonical form with the same function.
//
// Zero dependencies and no `node:*`: the digest is Web Crypto `SubtleCrypto.digest('SHA-256')`, present in
// browsers, Node, Workers and jsdom (ACS-R12, ACS-R14). It is async, so `compile()` stays synchronous and the
// digest is this module's one async step over its output (the SPEC's open item 3, decided).

/** What one turn sends about the agent, as the compiler builds it. Exactly the fields both the browser and
 *  the host hold, so the host can recompute the digest from the request body: the composed system prompt
 *  (the enabled capability labels ride inside it as index lines), the model, the model settings and the
 *  enabled integration ids. The composer's per-conversation effort dial is not agent content and stays out. */
export interface AgentBundle {
  system: string
  model: string
  modelSettings?: object
  integrations: readonly string[]
}

/** Where a resolved item came from (ACS-R8): the seed, an overlay op's source (`user`, `builder`, `pack`,
 *  recorded per op since T-0162), or a whole imported or duplicated record. */
export type ContentSource = 'seed' | 'pack' | 'imported' | 'duplicate' | 'builder' | 'user'

export const CONTENT_SOURCES: readonly ContentSource[] = ['seed', 'pack', 'imported', 'duplicate', 'builder', 'user']

/** One item that went into a bundle. `version` is the seed version of the item (`null` for an item with no
 *  seed counterpart, a user-added entry); `digest` is the sha256 of the item as composed, so a user edit
 *  shows as a new digest at the same version. */
export interface ResolutionEntry {
  id: string
  kind: string
  version: number | null
  digest: string
  source: ContentSource
}

/** A turn's content stamp: the bundle digest plus the resolution, as a request body carries it to the host
 *  and a trace line records it. */
export interface BundleStamp {
  digest: string
  resolution: ResolutionEntry[]
}

/** `sha256:` plus 64 lowercase hex digits. */
export const BUNDLE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

/** The response header the Worker answers a turn with: the bundle digest it recomputed from the request body
 *  (it keeps no trace log), so a client can compare it with its own stamp. */
export const BUNDLE_DIGEST_HEADER = 'x-agent-bundle-digest'

/** A request may carry at most this many resolution entries; more is dropped, never a 400. */
export const MAX_RESOLUTION_ENTRIES = 512

// The one canonical JSON (sorted keys, `undefined` members dropped), the corpus canonicalizer's writer:
// every digest here is taken over it, and it is re-exported so `@agent-ui/app` reaches it without the corpus
// barrel.
import { canonicalJson } from '../corpus/canonical.ts'
export { canonicalJson }

/** The bundle's canonical form. An absent or empty `modelSettings` reads the same (the runner omits an
 *  empty one from the wire), and the integration list keeps its order (it is the order the turn sends). */
export function canonicalBundle(bundle: AgentBundle): string {
  const settings = bundle.modelSettings !== undefined && Object.keys(bundle.modelSettings).length > 0 ? bundle.modelSettings : undefined
  return canonicalJson({ system: bundle.system, model: bundle.model, modelSettings: settings, integrations: [...bundle.integrations] })
}

/** `sha256:` plus the hex sha256 of `text` as UTF-8, through Web Crypto. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  let hex = ''
  for (const b of new Uint8Array(bytes)) hex += b.toString(16).padStart(2, '0')
  return `sha256:${hex}`
}

/** The bundle digest (ACS-R12). */
export function bundleDigest(bundle: AgentBundle): Promise<string> {
  return sha256Hex(canonicalBundle(bundle))
}

/** The bundle a host can rebuild from a request body: the fields it received, read the way the browser
 *  built them. A malformed field reads as absent, so a bad body still digests (and mismatches) rather than
 *  throwing. */
export function bundleFromWire(body: { system?: unknown; model?: unknown; modelSettings?: unknown; integrations?: unknown }): AgentBundle {
  const settings = body.modelSettings
  return {
    system: typeof body.system === 'string' ? body.system : '',
    model: typeof body.model === 'string' ? body.model : '',
    ...(settings !== null && typeof settings === 'object' && !Array.isArray(settings) ? { modelSettings: settings as Record<string, unknown> } : {}),
    integrations: Array.isArray(body.integrations) ? body.integrations.filter((i): i is string => typeof i === 'string') : [],
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** A request's claimed stamp, validated fail-closed: a malformed digest reads as absent, and a resolution
 *  keeps only well-formed entries (capped). Never throws; a bad stamp degrades the trace, never the turn. */
export function readBundleStamp(digest: unknown, resolution: unknown): Partial<BundleStamp> {
  const out: Partial<BundleStamp> = {}
  if (typeof digest === 'string' && BUNDLE_DIGEST_PATTERN.test(digest)) out.digest = digest
  if (Array.isArray(resolution)) {
    out.resolution = resolution
      .slice(0, MAX_RESOLUTION_ENTRIES)
      .filter(
        (e): e is ResolutionEntry =>
          isRecord(e) &&
          typeof e['id'] === 'string' &&
          typeof e['kind'] === 'string' &&
          (e['version'] === null || typeof e['version'] === 'number') &&
          typeof e['digest'] === 'string' &&
          BUNDLE_DIGEST_PATTERN.test(e['digest']) &&
          CONTENT_SOURCES.includes(e['source'] as ContentSource),
      )
      .map((e) => ({ id: e.id, kind: e.kind, version: e.version, digest: e.digest, source: e.source }))
  }
  return out
}
