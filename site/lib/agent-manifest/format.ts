// site/lib/agent-manifest/format.ts: the agent manifest's shape and its on-disk bytes, split out of
// agent-manifest.ts (T-0160) because it imports nothing: scripts/generate-agent-content.mjs writes the
// manifests' `seedVersion` through `formatManifest` under plain Node, where agent-manifest.ts (which loads
// the DOM-bound preset modules) cannot load.

/** One agent's pin set. Key order here is the on-disk key order (`formatManifest`). */
export interface AgentManifest {
  id: string
  preset: string | null
  seedVersion: number | null
  seedDigest: string | null
  fragment: { personaId: string; types: string[]; targetCatalogs: string[]; digest: string } | null
  selection: { digest: string } | null
  noFragment?: { why: string }
  noPreset?: { why: string }
}

/** The on-disk bytes: interface key order, two-space indent, trailing newline. */
export function formatManifest(m: AgentManifest): string {
  const ordered: AgentManifest = {
    id: m.id,
    preset: m.preset,
    seedVersion: m.seedVersion,
    seedDigest: m.seedDigest,
    fragment: m.fragment === null ? null : { personaId: m.fragment.personaId, types: m.fragment.types, targetCatalogs: m.fragment.targetCatalogs, digest: m.fragment.digest },
    selection: m.selection === null ? null : { digest: m.selection.digest },
    ...(m.noFragment === undefined ? {} : { noFragment: { why: m.noFragment.why } }),
    ...(m.noPreset === undefined ? {} : { noPreset: { why: m.noPreset.why } }),
  }
  return `${JSON.stringify(ordered, null, 2)}\n`
}
