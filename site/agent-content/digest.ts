// site/agent-content/digest.ts: the one sha256 helper for the agent-content registry and the agent
// manifests (T-0160). Node-side only (the generator, site/lib/agent-manifest/, tests): the browser
// registry carries no digests. The canonical JSON rule lives in schema.ts so both runtimes share it.
// @ts-expect-error - node:crypto is typed via @types/node; Node and vitest resolve it at runtime (site/tsconfig.json carries no node types)
import { createHash } from 'node:crypto'
import { canonicalJson } from './schema.ts'

/** `sha256:` plus the hex sha256 of `text` as UTF-8. */
export function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex') as string}`
}

/** `sha256(canonicalJson(value))`: the digest every agent manifest pin is taken with. */
export function canonicalDigest(value: unknown): string {
  return sha256(canonicalJson(value))
}
