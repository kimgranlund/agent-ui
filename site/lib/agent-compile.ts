// site/lib/agent-compile.ts: T-0163 (agent-content SPEC ACS-R11 to ACS-R13), the site's side of the one agent
// compiler. The compiler itself is `@agent-ui/app/agent-admin-compile`; this module hands it what only the
// site holds: a persona's seed (`agent-admin-presets.ts`) and its content manifest (the registry's versions).
// Three callers share it, so they agree by construction:
// - the page, which injects `contentManifestFor(active)` into ui-agent-admin's Context view;
// - the live runners (`admin-live-runner.ts`), whose `turnStamp` puts the bundle digest and the resolution on
//   every request body (the dev proxy recomputes the digest from that body and records both per turn);
// - the CLI (`scripts/agent-content.mjs compile`), through `compileAgent` over the seed files.
import { compile, resolution, type CompileContext, type CompileResult, type ContentManifest } from '@agent-ui/app/agent-admin-compile'
import type { AgentOverlay, OverlayPath } from '@agent-ui/app/agent-admin-overlay'
import { bundleDigest, bundleFromWire, type BundleStamp } from '@agent-ui/a2ui/agent/agent-bundle'
import { personaContentManifest } from '../agent-content/registry.ts'
import { AGENT_PRESETS, builderPersona, personaFromPreset, type Persona } from '../pages/agent-admin-presets.ts'

/** A persona's content manifest. A shipped preset (and the Builder) reads the registry; a library record
 *  (an import, a mint or a duplicate, one `imported` flag on the record) is a full record with no seed
 *  versions, so everything in it reads `imported`. */
export function contentManifestFor(persona: Persona): ContentManifest {
  if (persona.imported === true) return { id: persona.id, version: persona.seedVersion ?? null, source: 'imported' }
  return personaContentManifest(persona.id)
}

/** The shipped persona (a roster preset or the Builder) with this id, or `undefined`. */
export function shippedPersona(id: string): Persona | undefined {
  if (id === 'builder') return builderPersona()
  const preset = AGENT_PRESETS.find((p) => p.id === id)
  return preset === undefined ? undefined : personaFromPreset(preset)
}

/** Compile a shipped persona's seed plus an optional overlay: the CLI's path, and the reference the
 *  same-digest test holds Test Chat and the proxy to. Throws on an unknown id. */
export function compileAgent(id: string, overlay?: AgentOverlay, ctx?: CompileContext): Promise<CompileResult> {
  const persona = shippedPersona(id)
  if (persona === undefined) throw new Error(`agent-compile: no shipped persona ${id}`)
  return compile({ ...contentManifestFor(persona), seed: persona.seed }, overlay, ctx)
}

/** What a request body carries that the stamp is taken over (the bundle fields, as sent). */
export interface StampWire {
  system: string
  model: string
  modelSettings?: object
  integrations?: readonly string[]
}

/** The content the driving context of a turn runs with: its manifest and the store it composes from. */
export interface TurnContent {
  manifest: ContentManifest
  store: { get(key: string): unknown; modified?: () => OverlayPath[] }
}

/** A turn's stamp: the digest of the bundle exactly as the body sends it (what the proxy recomputes), and
 *  the resolution of the content behind it. No content known, the resolution is empty and the digest
 *  stands alone. The stamp is trace-only, so it never fails a turn: where the digest cannot be taken (Web
 *  Crypto's `subtle` exists only on secure origins, so a plain-http LAN address has none) it is `undefined`
 *  and the caller sends the turn unstamped. */
export async function turnStamp(wire: StampWire, content: TurnContent | undefined): Promise<BundleStamp | undefined> {
  try {
    const bundle = bundleFromWire(wire)
    const [digest, rows] = await Promise.all([
      bundleDigest(bundle),
      content === undefined ? Promise.resolve([]) : resolution(content.manifest, content.store, bundle, content.store.modified?.() ?? []),
    ])
    return { digest, resolution: rows }
  } catch {
    return undefined
  }
}
