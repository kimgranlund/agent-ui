// collect.ts — LLD-C4 (GH #1584), the `collect` leg (KEYLESS): materialize pending records from
// ALREADY-CAPTURED genui envelopes — raw proxy transcripts, `DevtoolsEvent`/`recordTurn` captures,
// anything `readGenuiLine`/`isGenuiCandidate` accept — never a model call.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isGenuiCandidate, readGenuiLine } from '../../../src/agent/genui-line.ts'
import { lintGenuiHtml } from '../../../src/corpus-genui/lint.ts'
import { genuiRecordHashes } from '../../../src/corpus-genui/record.ts'
import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import { loadGenuiRecordsByFile, writeGenuiRecordsByFile, shardFileFor, loadPrompts } from '../fs.ts'

export interface CollectOptions {
  /** A file OR a directory of files — every non-empty line is checked for a genui candidate. Absent ⇒
   *  the "validate + report the prompt matrix, write nothing" arm (LLD §4). */
  from?: string
  /** Pins `packId` — requires `--prompt` too (both-or-neither; an ambiguous single flag is a CLI usage
   *  error the entry point maps to exit 2). */
  pack?: string
  /** Pins `promptId` (and, when it resolves in `prompts.json`, the real `promptText`) — see `pack` above. */
  prompt?: string
  /** `packId:null`, `promptId:'captured'` — the un-pinned default. */
  unpinned?: boolean
  dryRun?: boolean
  /** Test-only injection (the LLD's clock-injection precedent, `report.ts`'s `now`) — a unique id minted
   *  per NEWLY-collected record; defaults to a real timestamp+random id. */
  idGen?: () => string
}

export interface CollectWireFailure {
  line: string
  reason: 'E_WIRE'
}

export interface CollectResult {
  /** `false` only on a genuine setup problem (bad flags) — a wire failure or a dup is a REPORTED
   *  outcome, not a leg failure; the CLI entry decides exit 1 vs 0 from `wireFailures.length`. */
  ok: boolean
  written: { file: string; record: GenuiCorpusRecord }[]
  dups: string[]
  wireFailures: CollectWireFailure[]
  setupError?: string
  /** Only set on the no-`--from` arm — the prompt-matrix summary the CLI prints. */
  promptCount?: number
}

function defaultIdGen(): string {
  return `capture-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Every non-empty line under `from` (a single file, or every file directly inside a directory —
 *  non-recursive, matching the "raw proxy transcripts" capture shape). */
function readCaptureLines(from: string): { origin: string; line: string }[] {
  const st = statSync(from)
  const files = st.isDirectory()
    ? (readdirSync(from) as string[]).map((f) => join(from, f)).filter((f) => statSync(f).isFile())
    : [from]
  const out: { origin: string; line: string }[] = []
  for (const file of files.sort()) {
    const text = readFileSync(file, 'utf8') as string
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length > 0) out.push({ origin: file, line: trimmed })
    }
  }
  return out
}

export async function runCollectLeg(repoRoot: string, opts: CollectOptions): Promise<CollectResult> {
  if (opts.from === undefined) {
    // Validate the data dir + report the prompt matrix, write nothing, exit 0 (LLD §4).
    const prompts = loadPrompts(repoRoot)
    return { ok: true, written: [], dups: [], wireFailures: [], promptCount: prompts.prompts.length }
  }

  const bothOrNeither = (opts.pack !== undefined) === (opts.prompt !== undefined)
  if (!opts.unpinned && !bothOrNeither) {
    return { ok: false, written: [], dups: [], wireFailures: [], setupError: '--pack and --prompt must be given together (or pass --unpinned)' }
  }
  const packId = opts.unpinned ? null : (opts.pack ?? null)
  const promptId = opts.unpinned ? 'captured' : (opts.prompt ?? 'captured')
  const resolvedPromptText = opts.prompt !== undefined ? loadPrompts(repoRoot).prompts.find((p) => p.id === opts.prompt)?.promptText : undefined

  const idGen = opts.idGen ?? defaultIdGen
  const byFile = loadGenuiRecordsByFile(repoRoot)
  const knownHashes = new Set<string>()
  for (const records of byFile.values()) for (const r of records) knownHashes.add(r.meta.htmlHash)

  const written: { file: string; record: GenuiCorpusRecord }[] = []
  const dups: string[] = []
  const wireFailures: CollectWireFailure[] = []
  const touched = new Set<string>()

  for (const { origin, line } of readCaptureLines(opts.from)) {
    if (!isGenuiCandidate(line)) continue // not a genui-shaped line at all — plumbing/other event content, skip silently
    const envelope = readGenuiLine(line)
    if (envelope === undefined) {
      wireFailures.push({ line, reason: 'E_WIRE' })
      continue
    }
    const { htmlHash } = await genuiRecordHashes(envelope.genui.html, null)
    if (knownHashes.has(htmlHash)) {
      dups.push(htmlHash)
      continue
    }
    knownHashes.add(htmlHash)

    const record: GenuiCorpusRecord = {
      name: `${packId ?? 'control'}--${promptId}--${idGen()}`,
      promptId,
      promptText: resolvedPromptText ?? `(captured transcript — origin: ${origin})`,
      packId,
      surfaceId: envelope.genui.surfaceId,
      html: envelope.genui.html,
      meta: {
        facet: 'eval',
        status: 'pending',
        promptSetVersion: 0,
        packHash: null,
        htmlHash,
        model: null,
        dogfood: false,
        generatedAt: new Date().toISOString(),
        provenance: { source: 'captured', origin },
        lint: lintGenuiHtml(envelope.genui.html),
      },
    }
    const file = shardFileFor(packId)
    const existing = byFile.get(file) ?? []
    existing.push(record)
    byFile.set(file, existing)
    touched.add(file)
    written.push({ file, record })
  }

  if (!opts.dryRun && touched.size > 0) {
    const changed = new Map<string, GenuiCorpusRecord[]>()
    for (const file of touched) changed.set(file, byFile.get(file) ?? [])
    writeGenuiRecordsByFile(repoRoot, changed)
  }

  return { ok: true, written, dups, wireFailures }
}
