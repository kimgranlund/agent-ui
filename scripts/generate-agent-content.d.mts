/** Type surface for generate-agent-content.mjs, shared by the CLI and
 *  site/agent-content/registry-freshness.test.ts (the generate-agent-assets.d.mts precedent). */
import type { ContentRecord } from '../site/agent-content/schema.ts'

export const OUT_REGISTRY: string

export function discoverAgentContent(root?: string): { records: ContentRecord[]; problems: string[] }
export function generateRegistryModule(records: readonly ContentRecord[]): string
