/** Type surface for generate-agent-content.mjs, shared by the CLI and
 *  site/agent-content/registry-freshness.test.ts (the generate-agent-assets.d.mts precedent). */
import type { ContentRecord } from '../site/agent-content/schema.ts'

export const OUT_REGISTRY: string
export const MANIFEST_DIR: string

export function discoverAgentContent(root?: string): { records: ContentRecord[]; problems: string[] }
export function generateRegistryModule(records: readonly ContentRecord[]): string
export function manifestUpdates(records: readonly ContentRecord[], root?: string): { updates: { path: string; text: string }[]; problems: string[] }
