/** Type surface for generate-agent-assets.mjs, shared by the CLI and agent-assets-freshness.test.ts (the
 *  build-dogfood-assets.d.mts / generate-llms-full.d.mts precedent: a `.mjs` runtime file paired with a
 *  sibling `.d.mts` so a `.ts` consumer can import it typed). */
import type { DogfoodControl, DogfoodFolder } from '../packages/agent-ui/a2ui/src/agent/dogfood-descriptor.ts'

export interface AgentTextAsset {
  readonly path: string
  readonly content: string
}

export interface DiscoveredAgentAssets {
  readonly text: readonly AgentTextAsset[]
  readonly fleet: readonly DogfoodControl[]
}

export const OUT_ASSETS: string
export const OUT_FLEET: string

export function readControlFolders(root?: string): DogfoodFolder[]
export function discoverAgentAssets(root?: string): { text: AgentTextAsset[]; fleet: DogfoodControl[] }
export function generateAgentAssetsModules(discovered: DiscoveredAgentAssets): { assets: string; fleet: string }
