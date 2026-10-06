// select.ts: selectCapabilities, the intent ranker over a composed view. The `selectMiniSkills` shape
// (`agent/mini-skills.ts`) over the one shared TF-IDF cosine ranker: score 0 is never padded in, ties break
// on the row id, and only a type that carries selection intents can rank. Pure; the sole import is the
// corpus ranker (`src/corpus/index.test.ts` exempts this folder for it, as it exempts `src/agent/`).

import { topKByCosine } from '../corpus/text-similarity.ts'
import type { CapabilityRow, CapabilityView } from './types.ts'

/**
 * Rank the view's types by how well their selection `intents` match `intent`, best first, at most `cap`.
 * Degrades to `[]` when `intent` shares no vocabulary with any ranked type, or `cap <= 0`. Never returns a
 * row outside `view.types`.
 */
export function selectCapabilities(intent: string, view: CapabilityView, cap: number): CapabilityRow[] {
  const ranked = view.types.filter((r) => r.intents !== undefined && r.intents.length > 0)
  return topKByCosine(ranked, (r) => (r.intents ?? []).join(' '), intent, cap, (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0), 0)
}
