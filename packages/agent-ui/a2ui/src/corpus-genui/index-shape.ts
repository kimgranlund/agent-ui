// index-shape.ts — LLD-C4 §5 (GH #1584, genui-b3-judged-eval.lld.md): the pure, node-free TYPE shape of
// `corpus-genui/index.json` (the `report` leg's own output — the docs page's read contract). Split out
// of `tools/corpus-genui/legs/report.ts` (the Node shell that DERIVES an index) so a browser/site
// consumer can type-import the shape WITHOUT dragging that shell's `node:fs`/`node:path`/`node:crypto`
// imports into its own type program — the `site/tsconfig.json` "deliberately carries no node types"
// constraint `vitest.config.ts`'s own alias comments already name for `@agent-ui/a2ui/agent/*`. Pure
// types only: no runtime code, no imports.

import type { GenuiDimensionScores } from './verdicts.ts'
import type { GenuiHtmlLint } from './lint.ts'

export interface GenuiCorpusIndexRecordRow {
  name: string
  promptId: string
  packId: string | null
  model: string | null
  status: 'pending' | 'judged'
  qualityScore?: number
  passed?: boolean
  failingDimensions?: string[]
  dimensions?: GenuiDimensionScores
  /** From the archived verdict, when present (LLD §7's "shows the verdict rationale beneath it") —
   *  optional, the SAME degrade `dimensions?` already carries: a critic seat may omit it. */
  rationale?: string
  htmlHash: string
  verdictDate?: string
  lint: GenuiHtmlLint
}

export interface GenuiCorpusIndexPerPack {
  judged: number
  passed: number
  meanD2: number
  minScore: number
}

export interface GenuiCorpusIndexM3 {
  judged: number
  passed: number
  passRate: number
  minScore: number
  meanScore: number
  /** Every judged pack-conditioned record has `qualityScore >= 4` — the PRD §8 m3 floor (LLD §5). */
  floorMet: boolean
  perPack: Record<string, GenuiCorpusIndexPerPack>
  control?: { judged: number; meanD2: number }
}

export interface GenuiCorpusIndex {
  generatedAt: string
  rubricVersion: string
  promptSetVersion: number
  records: GenuiCorpusIndexRecordRow[]
  m3: GenuiCorpusIndexM3 | null
}
