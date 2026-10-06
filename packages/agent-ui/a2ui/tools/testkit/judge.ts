// judge.ts: the kit's DOM-free judges over one turn's wire lines (T-0011): line order, heal, the validator
// verdict with cross-turn seeds, and `judgeTurnLines`, the one per-turn pipeline every runner shares.
// Browser-safe: it reads meta-lines through the zero-dep meta-line module and the seeds through
// `src/agent/surface-seeds.ts`, never produce.ts (whose import closure reads prompt files from disk).
//
// Rules:
//   - Meta-lines are peeled first; only content lines are healed and validated.
//   - Heal runs per line with the `v1.0` pin, as the producer's own assembly does. `single-object-envelope`
//     is dropped from every repair union: per-line heal reports it for every one-object line.
//   - With no `expect.heal`, an unparseable line is `HEAL_UNPARSEABLE` and the turn's verdict is skipped.
//     With `expect.heal`, `ok` must equal "every line healed" and `repairs` (when given) must equal the
//     union as a set, else `HEAL_MISMATCH`; an expected-unhealable line then reaches the verdict through
//     the validator's own text arm (`validateA2ui(rawLine)`, native `PARSE` at `""`).
//   - With no `expect.verdict`, every native failure passes through with its own path. With it, `valid` and
//     the `(code, path)` set must match, else one `VERDICT_MISMATCH` listing the missing and extra pairs.
//   - Order (SPEC-R5 validate-then-stream, ADR-0206): an `a2uiMeta` line after a content line in one turn is
//     `ORDER_CONTENT_BEFORE_META`, except a lone `error` envelope, which is the terminal line by contract
//     (GH #144). A meta-line `target` that no content line of the turn mutates is `TARGET_NOT_MUTATED`.

import { heal } from '../../src/corpus/heal.ts'
import { validateA2ui } from '../../src/renderer/validate.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import type { A2uiServerMessage, Failure } from '../../src/protocol.ts'
import { readMetaLine } from '../../src/agent/meta-line.ts'
import type { A2uiMetaEnvelope } from '../../src/agent/meta-line.ts'
import type { Session } from '../../src/agent/agent-transport.ts'
import { appendAssistantTurn } from '../../src/agent/session.ts'
import { sessionSurfaceSeeds } from '../../src/agent/surface-seeds.ts'
import { kitFinding, validatorFinding } from './findings.ts'
import type { KitFinding } from './findings.ts'
import { ENVELOPE_REPAIR } from './scenario.ts'
import type { ScenarioTurn, TurnExpect } from './scenario.ts'

export const PROTOCOL_PIN = { protocolVersion: 'v1.0' } as const

/** Heal one line with the kit's pin. The legs under `src/testkit/` reach heal through this: the corpus
 *  root-purity gate (`src/corpus/index.test.ts`) bars every `src/` file outside corpus from importing it. */
export function healLine(line: string): ReturnType<typeof heal> {
  return heal(line, PROTOCOL_PIN)
}

/** One line's repair names, `single-object-envelope` dropped; `[]` when the line does not heal. */
export function lineRepairs(line: string): string[] {
  const h = healLine(line)
  return h.ok ? h.repairs.filter((r) => r !== ENVELOPE_REPAIR) : []
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface SplitLines {
  meta: { index: number; envelope: A2uiMetaEnvelope }[]
  content: { index: number; line: string }[]
}

/** Peel meta-lines from content lines, keeping each line's index in the turn. Blank lines are skipped. */
export function splitLines(lines: readonly string[]): SplitLines {
  const out: SplitLines = { meta: [], content: [] }
  lines.forEach((line, index) => {
    if (line.trim() === '') return
    const envelope = readMetaLine(line)
    if (envelope !== undefined) out.meta.push({ index, envelope })
    else out.content.push({ index, line })
  })
  return out
}

/** The surfaceIds a content line mutates (`updateComponents`, `updateDataModel`, `deleteSurface`). */
function mutatedSurfaceIds(line: string): string[] {
  const healed = heal(line, PROTOCOL_PIN)
  if (!healed.ok) return []
  const out: string[] = []
  for (const m of healed.messages as unknown[]) {
    if (!isObject(m)) continue
    for (const key of ['updateComponents', 'updateDataModel', 'deleteSurface']) {
      const body = m[key]
      if (isObject(body) && typeof body.surfaceId === 'string') out.push(body.surfaceId)
    }
  }
  return out
}

const isTerminalError = (e: A2uiMetaEnvelope): boolean => {
  const keys = Object.keys(e.a2uiMeta).filter((k) => (e.a2uiMeta as Record<string, unknown>)[k] !== undefined)
  return keys.length === 1 && keys[0] === 'error'
}

/** The order defects of one turn's lines (see the module header). */
export function orderDefects(lines: readonly string[], pathPrefix = '$'): KitFinding[] {
  const findings: KitFinding[] = []
  const { meta, content } = splitLines(lines)
  const firstContent = content.length > 0 ? content[0]!.index : Infinity
  for (const m of meta) {
    if (m.index > firstContent && !isTerminalError(m.envelope)) {
      findings.push(kitFinding('ORDER_CONTENT_BEFORE_META', { path: `${pathPrefix}[${m.index}]`, detail: `meta-line at ${m.index} follows content at ${firstContent}` }))
    }
  }
  const mutated = new Set(content.flatMap((c) => mutatedSurfaceIds(c.line)))
  for (const m of meta) {
    const target = m.envelope.a2uiMeta.target
    if (target !== undefined && !mutated.has(target.surfaceId)) {
      findings.push(kitFinding('TARGET_NOT_MUTATED', { path: `${pathPrefix}[${m.index}]`, detail: `target ${target.surfaceId} is not mutated by this turn` }))
    }
  }
  return findings
}

export interface HealJudgment {
  findings: KitFinding[]
  /** The healed messages of every healable content line, in order. */
  messages: A2uiServerMessage[]
  /** Raw content lines that did not heal. */
  unhealable: string[]
  /** The repair union, `single-object-envelope` dropped, sorted. */
  repairs: string[]
  /** True when the verdict must be skipped (an unexpected unhealable line). */
  skipVerdict: boolean
}

/** Heal every content line of one turn and judge it against `expect` (see the module header). */
export function judgeHeal(lines: readonly string[], expect?: TurnExpect['heal'], pathPrefix = '$'): HealJudgment {
  const findings: KitFinding[] = []
  const messages: A2uiServerMessage[] = []
  const unhealable: string[] = []
  const repairs = new Set<string>()
  const unhealableIdx: number[] = []
  for (const { index, line } of splitLines(lines).content) {
    const healed = heal(line, PROTOCOL_PIN)
    if (!healed.ok) {
      unhealable.push(line)
      unhealableIdx.push(index)
      continue
    }
    messages.push(...(healed.messages as A2uiServerMessage[]))
    for (const r of healed.repairs) if (r !== ENVELOPE_REPAIR) repairs.add(r)
  }
  const union = [...repairs].sort()
  if (expect === undefined) {
    for (const index of unhealableIdx) findings.push(kitFinding('HEAL_UNPARSEABLE', { path: `${pathPrefix}[${index}]` }))
    return { findings, messages, unhealable, repairs: union, skipVerdict: unhealable.length > 0 }
  }
  const ok = unhealable.length === 0
  const problems: string[] = []
  if (expect.ok !== ok) problems.push(`ok: expected ${expect.ok}, got ${ok}`)
  if (expect.repairs !== undefined) {
    const want = [...new Set(expect.repairs)].sort()
    if (JSON.stringify(want) !== JSON.stringify(union)) problems.push(`repairs: expected [${want.join(', ')}], got [${union.join(', ')}]`)
  }
  if (problems.length > 0) findings.push(kitFinding('HEAL_MISMATCH', { path: pathPrefix, detail: problems.join('; ') }))
  return { findings, messages, unhealable, repairs: union, skipVerdict: false }
}

export interface VerdictOptions {
  catalogId: string
  atFinalize?: boolean
  expect?: TurnExpect['verdict']
  /** Raw content lines that did not heal but were expected not to; judged through the validator's text arm. */
  unhealable?: readonly string[]
  path?: string
}

const pairKey = (f: { code: string; path: string }): string => `${f.code} @ ${f.path}`

/** The actual verdict of one turn's healed messages, seeded by the session's prior assistant turns. */
export function verdictOf(messages: readonly A2uiServerMessage[], catalog: Catalog, session: Session, opts: Omit<VerdictOptions, 'expect' | 'catalogId'> = {}): { valid: boolean; failures: Failure[] } {
  const verdict = validateA2ui([...messages], catalog, sessionSurfaceSeeds(session), { atFinalize: opts.atFinalize === true })
  const failures = [...verdict.failures]
  for (const raw of opts.unhealable ?? []) failures.push(...validateA2ui(raw, catalog).failures)
  return { valid: failures.length === 0, failures }
}

/** Judge one turn's verdict (see the module header). */
export function judgeVerdict(messages: readonly A2uiServerMessage[], catalog: Catalog, session: Session, opts: VerdictOptions): KitFinding[] {
  const actual = verdictOf(messages, catalog, session, opts)
  if (opts.expect === undefined) {
    return actual.failures.map((f) => validatorFinding(opts.catalogId, f.code, { path: f.path }))
  }
  const want = new Set(opts.expect.failures.map(pairKey))
  const got = new Set(actual.failures.map(pairKey))
  const missing = [...want].filter((k) => !got.has(k))
  const extra = [...got].filter((k) => !want.has(k))
  if (opts.expect.valid === actual.valid && missing.length === 0 && extra.length === 0) return []
  const detail = [
    opts.expect.valid !== actual.valid ? `valid: expected ${opts.expect.valid}, got ${actual.valid}` : '',
    missing.length > 0 ? `missing [${missing.join('; ')}]` : '',
    extra.length > 0 ? `extra [${extra.join('; ')}]` : '',
  ]
    .filter(Boolean)
    .join('; ')
  return [validatorFinding(opts.catalogId, 'VERDICT_MISMATCH', { ...(opts.path !== undefined ? { path: opts.path } : {}), detail })]
}

/** The JSONL an assistant turn stores: one JSON line per healed message (what `appendAssistantTurn` keeps). */
export function jsonlOf(messages: readonly A2uiServerMessage[]): string {
  return messages.map((m) => JSON.stringify(m)).join('\n')
}

export interface TurnJudgment {
  findings: KitFinding[]
  /** The healed content messages, in order: what a mount ingests. */
  messages: A2uiServerMessage[]
  /** The session after this turn: the healed messages appended as one assistant turn. */
  session: Session
}

/**
 * The per-turn pipeline every runner shares: order checks, then heal, then the seeded verdict (skipped after
 * an unexpected unhealable line), then the session append. `respondPath` is the turn's JSON path, for
 * example `$.turns[2].respond.lines`.
 */
export function judgeTurnLines(
  lines: readonly string[],
  ctx: { turn: ScenarioTurn; catalog: Catalog; catalogId: string; session: Session; respondPath: string; turnPath: string },
): TurnJudgment {
  const findings: KitFinding[] = [...orderDefects(lines, ctx.respondPath)]
  const healed = judgeHeal(lines, ctx.turn.expect?.heal, ctx.respondPath)
  findings.push(...healed.findings)
  if (!healed.skipVerdict) {
    findings.push(
      ...judgeVerdict(healed.messages, ctx.catalog, ctx.session, {
        catalogId: ctx.catalogId,
        atFinalize: ctx.turn.atFinalize,
        expect: ctx.turn.expect?.verdict,
        unhealable: healed.unhealable,
        path: `${ctx.turnPath}.expect.verdict`,
      }),
    )
  }
  const session = healed.messages.length > 0 ? appendAssistantTurn(ctx.session, jsonlOf(healed.messages)) : ctx.session
  return { findings, messages: healed.messages, session }
}
