// exemplar-shards.ts: the ONE Node-side reader of the agent-ui exemplar shards the live retrievers draw from
// (T-0240). Since persona shards exist (`corpus/exemplar/v1_0/agent-ui--<persona>.jsonl`, a CardTable round or a
// BookingForm admitted against its composed persona catalog), "the shard" is a family: `agent-ui.jsonl` plus every
// `agent-ui--*.jsonl`. `retrieve()` owns the scope rule (a persona shard only on its own turn), so every loader
// hands it the whole family. The `/__a2ui/agent` and `/__a2a` dev proxies and the corpus-genui fs shell read through
// here; the Worker (`tools/agent/worker/index.ts`) cannot read a directory and imports each file statically instead.
//
// The Basic shard (`a2ui-basic.jsonl`) stays out, as it always was for these loaders: loading it would change what a
// Basic turn retrieves, a separate decision.
//
// Zero new deps (SPEC-N5). Plain `.ts`, run via Node type-stripping (`erasableSyntaxOnly`, ADR-0062).

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CorpusRecord } from '../../src/corpus/record.ts'

/** Repo-root-relative home of the exemplar shards. */
export const EXEMPLAR_SHARD_DIR = 'packages/agent-ui/a2ui/corpus/exemplar/v1_0'

/** True for a shard file in the agent-ui family: `agent-ui.jsonl` or `agent-ui--<persona>.jsonl`. */
export function isAgentUiShardFile(file: string): boolean {
  return file === 'agent-ui.jsonl' || (file.startsWith('agent-ui--') && file.endsWith('.jsonl'))
}

/** Parse one shard's JSONL text, skipping blank lines. */
export function parseShard(text: string): CorpusRecord[] {
  return text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CorpusRecord)
}

/** Every record of every agent-ui family shard under `repoRoot`, base shard first, then the persona shards in name
 *  order. A missing directory yields `[]` (retrieval degrades to zero exemplars, never a hard failure). */
export function loadAgentUiExemplarShards(repoRoot: string): CorpusRecord[] {
  let files: string[]
  try {
    const family = (readdirSync(join(repoRoot, EXEMPLAR_SHARD_DIR)) as string[]).filter(isAgentUiShardFile)
    files = [...family.filter((f) => f === 'agent-ui.jsonl'), ...family.filter((f) => f !== 'agent-ui.jsonl').sort()]
  } catch {
    return []
  }
  return files.flatMap((f) => parseShard(readFileSync(join(repoRoot, EXEMPLAR_SHARD_DIR, f), 'utf8') as string))
}
