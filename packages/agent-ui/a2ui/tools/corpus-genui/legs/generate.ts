// generate.ts — LLD-C4 §4.1 (GH #1584), the `generate` leg (NEEDS KEY): fresh pack-conditioned GenUI
// turns through the REAL producer path — the exact `produce()` loop the dev proxy runs, never a
// shortcut (LLD §4.1). This module's CODE ships and is stub-tested (`deps.provider` is the injection
// point); its EXECUTION against `deps.provider = anthropicProvider(...)` is the CLI entry's key-bearing
// arm ONLY — this file never reads `process.env` or a `.env` file itself.

import { produce, ProduceHalt } from '../../../src/agent/produce.ts'
import type { ProduceDeps } from '../../../src/agent/produce.ts'
import type { AgentProvider } from '../../../src/agent/agent-transport.ts'
import type { GenuiSurfaceConfig } from '../../../src/agent/genui-surface-config.ts'
import { readGenuiLine } from '../../../src/agent/genui-line.ts'
import { retrieve } from '../../../src/corpus/retrieve.ts'
import { GENUI_PACKS } from '../../../src/agent/prompts/genui-packs.ts'
import { lintGenuiHtml } from '../../../src/corpus-genui/lint.ts'
import { genuiRecordHashes } from '../../../src/corpus-genui/record.ts'
import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import { loadPrompts, loadGenuiRecordsByFile, writeGenuiRecordsByFile, writeRunReport, shardFileFor, loadA2uiShard, loadDefaultCatalog } from '../fs.ts'

export interface GenerateOptions {
  onlyPack?: string
  onlyPrompt?: string
  /** Produce ONE pack-less record per prompt (`packId:null`) instead of the normal per-(prompt, its own
   *  pack) turn (LLD §4.3 — the control arm). */
  control?: boolean
  dogfood?: boolean
  /** Repeats per prompt (default 1). */
  runs?: number
  dryRun?: boolean
  /** Test-only injection (the report.ts `now` precedent) — a run-id source; defaults to a real one. */
  runId?: () => string
  now?: () => string
}

export interface GenerateMiss {
  promptId: string
  packId: string | null
  runIndex: number
  reason: 'E_NO_GENUI' | string
}

export interface GenerateResult {
  ok: boolean
  written: { file: string; record: GenuiCorpusRecord }[]
  misses: GenerateMiss[]
  reportPath?: string
}

function defaultRunId(): string {
  return `run:${new Date().toISOString()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Run the `generate` leg. `model` is ALREADY validated by the caller (the CLI's `resolvePair` check —
 * this leg never validates it itself); `deps.provider` is the ONLY seam through which a live call can
 * happen — a test drives this with a stub, the real adapter is constructed only by the CLI's key arm.
 */
export async function runGenerateLeg(
  repoRoot: string,
  model: string,
  opts: GenerateOptions,
  deps: { provider: AgentProvider },
): Promise<GenerateResult> {
  const promptSet = loadPrompts(repoRoot)
  const a2uiShard = loadA2uiShard(repoRoot)
  const catalog = loadDefaultCatalog(repoRoot)
  const runs = opts.runs ?? 1
  const runId = opts.runId ?? defaultRunId
  const now = opts.now ?? (() => new Date().toISOString())

  const candidates = promptSet.prompts.filter(
    (p) => (opts.onlyPack === undefined || p.packId === opts.onlyPack) && (opts.onlyPrompt === undefined || p.id === opts.onlyPrompt),
  )

  const byFile = loadGenuiRecordsByFile(repoRoot)
  const touched = new Set<string>()
  const written: { file: string; record: GenuiCorpusRecord }[] = []
  const misses: GenerateMiss[] = []

  for (const prompt of candidates) {
    const pack = opts.control ? undefined : GENUI_PACKS.find((p) => p.id === prompt.packId)
    const packId = opts.control ? null : (pack?.id ?? null)
    const genuiSurface: GenuiSurfaceConfig = {
      enabled: true,
      ...(pack !== undefined ? { sourceBody: pack.body } : {}),
      exclusive: true,
      dogfood: opts.dogfood ?? false,
    }

    for (let runIndex = 0; runIndex < runs; runIndex++) {
      const deps2: ProduceDeps = {
        provider: deps.provider,
        retrieve: (q) => retrieve(a2uiShard, q),
        catalog,
      }
      const captured: { surfaceId: string; html: string }[] = []
      let miss: GenerateMiss | undefined
      try {
        for await (const line of produce({ kind: 'intent', text: prompt.promptText, session: { turns: [] } }, deps2, { maxRounds: 3, model, genuiSurface })) {
          const env = readGenuiLine(line)
          if (env) captured.push(env.genui)
        }
      } catch (e) {
        miss = { promptId: prompt.id, packId, runIndex, reason: e instanceof ProduceHalt ? e.message : String(e) }
      }
      if (miss === undefined && captured.length === 0) {
        miss = { promptId: prompt.id, packId, runIndex, reason: 'E_NO_GENUI' }
      }
      if (miss !== undefined) {
        misses.push(miss)
        continue
      }

      const env = captured[0]! // at-most-one law (SPEC-R2) — produce() already enforces this
      const { htmlHash, packHash } = await genuiRecordHashes(env.html, pack?.body ?? null)
      const thisRunId = runId() // called ONCE — `name` and `provenance.origin` must cite the SAME id
      const record: GenuiCorpusRecord = {
        name: `${packId ?? 'control'}--${prompt.id}--${thisRunId}`,
        promptId: prompt.id,
        promptText: prompt.promptText,
        packId,
        surfaceId: env.surfaceId,
        html: env.html,
        meta: {
          facet: 'eval',
          status: 'pending',
          promptSetVersion: promptSet.promptSetVersion,
          packHash,
          htmlHash,
          model,
          dogfood: opts.dogfood ?? false,
          generatedAt: now(),
          provenance: { source: 'generated', origin: `run:${thisRunId}` },
          lint: lintGenuiHtml(env.html),
        },
      }
      const file = shardFileFor(packId)
      const existing = byFile.get(file) ?? []
      existing.push(record)
      byFile.set(file, existing)
      touched.add(file)
      written.push({ file, record })
    }
  }

  if (!opts.dryRun) {
    if (touched.size > 0) {
      const changed = new Map<string, GenuiCorpusRecord[]>()
      for (const file of touched) changed.set(file, byFile.get(file) ?? [])
      writeGenuiRecordsByFile(repoRoot, changed)
    }
    const reportPath = writeRunReport(repoRoot, `generate-${runId()}`, { model, control: opts.control ?? false, written: written.length, misses })
    return { ok: misses.length === 0, written, misses, reportPath }
  }

  return { ok: misses.length === 0, written, misses }
}
