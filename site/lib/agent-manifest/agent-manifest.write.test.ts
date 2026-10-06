// agent-manifest.write.test.ts: the DELIBERATE agent-manifest writer (GH #1812), checked in next to the
// gate it feeds (agent-manifest.test.ts) in the recapture-baseline.test.ts shape.
//
// Armed ONLY via the env flag; a plain `npm test` run skips it (1 skip, writes nothing):
//
//   AGENT_MANIFEST_WRITE=1 npx vitest run --project site site/lib/agent-manifest/agent-manifest.write.test.ts
//
// The rule: run it after a deliberate seed, fragment or sidecar change, never to green a red gate you do
// not understand. It rewrites every existing `*.manifest.json` (always, even when the bytes are unchanged)
// through `refreshManifest`, so only the digests and derived facts move; it never creates a manifest. A
// `seedVersion` bump stays a human edit to the manifest, because the bump drops users' persisted stores
// (`personaStore` in site/pages/agent-admin-presets.ts). On an unchanged tree an armed run is a
// byte-identical no-op.
import { describe, it } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (site/tsconfig.json carries no node types)
import { writeFileSync } from 'node:fs'
import { MANIFEST_DIR, formatManifest, readTreeInput, refreshManifest, type AgentManifest } from './agent-manifest.ts'

declare const process: { env: Record<string, string | undefined> }

const armed = process.env['AGENT_MANIFEST_WRITE'] === '1'

describe('agent manifests: the deliberate writer (armed via AGENT_MANIFEST_WRITE=1)', () => {
  it.skipIf(!armed)('rewrites every agent manifest with fresh digests and derived facts', () => {
    const input = readTreeInput()
    for (const { file, manifest } of input.manifests) {
      writeFileSync(`${MANIFEST_DIR}/${file}`, formatManifest(refreshManifest(manifest as AgentManifest, input)))
    }
  })
})
