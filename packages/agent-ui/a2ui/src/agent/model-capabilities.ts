// model-capabilities.ts: T-0185, the per-model capability table. Each served model id lists the settings
// its API accepts, so the settings pane shows only those and `buildRequestBody` sends only those. PURE data
// plus pure checks (no `node:*`, the NODE-FENCE): the browser settings pane and the server request builder
// read the same rows. `providers-config.test.ts`-style coverage lives in `model-capabilities.test.ts`, which
// holds every implemented `providers.json` model to a row.
//
// Sources (read 2026-10-14):
//   https://platform.claude.com/docs/en/build-with-claude/effort  (levels, defaults, thinking off per effort,
//     per-message effort beta `mid-conversation-output-config-2026-07-01`)
//   https://platform.claude.com/docs/en/models/overview  (max output 128K, adaptive thinking, default effort)
//   https://platform.claude.com/docs/en/build-with-claude/thinking  (display summarized or omitted, omitted
//     the default on the 5.x models)
//   https://platform.claude.com/docs/en/build-with-claude/structured-outputs  (strict tools)
//   https://platform.claude.com/docs/en/build-with-claude/prompt-caching  (cache_control ttl 5m or 1h)
// The 5.5 models take temperature 1.0 only and reject top_p and top_k, so none of them lists a sampling
// param; forced tool_choice returns a 400 on Sonnet 5.5 and Opus 5.5 (T-0172). The `max` effort level
// exists on the 5.5 models but the dial stops at `xhigh` (the `Effort` union).

import type { Effort } from './agent-transport.ts'

/** The thinking modes a request can name. `adaptive` is the model deciding; `disabled` turns up-front
 *  thinking off (Haiku 5.5 only, at `high` or below); `between_tools` is Sonnet 5.5's lowest setting. */
export type ThinkingMode = 'adaptive' | 'disabled' | 'between_tools'
/** Whether thinking text streams back (`summarized`) or arrives empty (`omitted`). Visibility only. */
export type ThinkingDisplay = 'summarized' | 'omitted'
export type CacheTtl = '5m' | '1h'
export type SamplingParam = 'temperature' | 'top_p' | 'top_k'
export type ServerTool = 'web_search' | 'web_fetch'

export interface ModelCapabilities {
  /** The effort levels the dial may send; empty means the model has no effort dial (Haiku 4.5). */
  efforts: readonly Effort[]
  /** The API's own default when no effort is sent; `null` with no dial. */
  defaultEffort: Effort | null
  /** Per thinking mode, the effort levels it is legal at. A mode absent here is rejected by the model. */
  thinking: Readonly<Partial<Record<ThinkingMode, readonly Effort[]>>>
  /** Legacy extended thinking (`{type:'enabled', budget_tokens}`): Haiku 4.5 only. */
  legacyBudget: boolean
  /** Display options and the API default (we default the app to `summarized`, see `DEFAULT_DISPLAY`). */
  displays: readonly ThinkingDisplay[]
  defaultDisplay: ThinkingDisplay | null
  /** The synchronous Messages-API output ceiling. */
  maxOutputTokens: number
  /** Sampling params the model accepts with a non-default value. */
  sampling: readonly SamplingParam[]
  /** Whether a forced `tool_choice` (`tool` or `any`) is accepted. */
  forcedToolChoice: boolean
  /** Prompt-cache TTLs (`cache_control.ttl`). */
  cacheTtls: readonly CacheTtl[]
  /** Server tools the model accepts. */
  serverTools: readonly ServerTool[]
  /** Per-message `output_config` (the mid-conversation effort beta). */
  perMessageEffort: boolean
}

const ALL: readonly Effort[] = ['low', 'medium', 'high', 'xhigh']
const UP_TO_HIGH: readonly Effort[] = ['low', 'medium', 'high']
const BOTH_DISPLAYS: readonly ThinkingDisplay[] = ['summarized', 'omitted']
const BOTH_TTLS: readonly CacheTtl[] = ['5m', '1h']
const WEB: readonly ServerTool[] = ['web_search', 'web_fetch']

/** A current-family row: adaptive at every level, both displays (omitted by default), 128K out. */
function current(over: Partial<ModelCapabilities>): ModelCapabilities {
  return {
    efforts: ALL,
    defaultEffort: 'high',
    thinking: { adaptive: ALL },
    legacyBudget: false,
    displays: BOTH_DISPLAYS,
    defaultDisplay: 'omitted',
    maxOutputTokens: 128_000,
    sampling: [],
    forcedToolChoice: true,
    cacheTtls: BOTH_TTLS,
    serverTools: WEB,
    perMessageEffort: false,
    ...over,
  }
}

export const MODEL_CAPABILITIES: Readonly<Record<string, ModelCapabilities>> = {
  // Thinking off at `high` or below; `medium` default; per-message effort on the Claude API.
  'claude-haiku-5-5': current({ defaultEffort: 'medium', thinking: { adaptive: ALL, disabled: UP_TO_HIGH }, perMessageEffort: true }),
  // `between_tools` at low to high (400 at xhigh); forced tool_choice 400s.
  'claude-sonnet-5-5': current({ thinking: { adaptive: ALL, between_tools: UP_TO_HIGH }, forcedToolChoice: false, perMessageEffort: true }),
  // Adaptive always on (`disabled` 400s at every level); `medium` default; forced tool_choice 400s.
  'claude-opus-5-5': current({ defaultEffort: 'medium', forcedToolChoice: false, perMessageEffort: true }),
  // Earlier current-family rows, filled from the request builder's pre-table behavior.
  'claude-opus-4-8': current({}),
  'claude-fable-5': current({}),
  'claude-haiku-4-5-20251001': {
    efforts: [],
    defaultEffort: null,
    thinking: {},
    legacyBudget: true,
    displays: [],
    defaultDisplay: null,
    maxOutputTokens: 64_000,
    sampling: ['temperature', 'top_p', 'top_k'],
    forcedToolChoice: true,
    cacheTtls: BOTH_TTLS,
    serverTools: WEB,
    perMessageEffort: false,
  },
}

/** The row for a model id. Matches the exact id first, then a known id (or its dateless stem,
 *  `claude-haiku-4-5` for the dated id) the given one ends with, which covers the Bedrock `anthropic.`
 *  prefix. `undefined` for an unknown model, which the request builder treats as "send nothing optional". */
export function capabilitiesFor(model: string): ModelCapabilities | undefined {
  const exact = MODEL_CAPABILITIES[model]
  if (exact) return exact
  for (const [id, row] of Object.entries(MODEL_CAPABILITIES)) {
    const stem = id.replace(/-\d{8}$/, '')
    if (model.endsWith(id) || model.endsWith(stem)) return row
  }
  return undefined
}

/** The app's display default: reasoning shown (T-0172, the 5.x API default `omitted` streamed empty text). */
export const DEFAULT_DISPLAY: ThinkingDisplay = 'summarized'

/** The model settings an agent carries (agent settings plus the composer's per-turn overrides). Every field
 *  is optional: absent means the request builder's default for that model. */
export interface ModelSettings {
  thinking?: ThinkingMode
  display?: ThinkingDisplay
  maxTokens?: number
  cacheTtl?: CacheTtl
}

export interface SettingsIssue {
  key: keyof ModelSettings | 'effort'
  message: string
}

/** Every setting the model's row rejects, as plain-words issues (empty when the combination is legal). An
 *  unknown model accepts nothing optional, so any set field is an issue. */
export function validateModelSettings(model: string, settings: ModelSettings, effort?: Effort): SettingsIssue[] {
  const row = capabilitiesFor(model)
  const issues: SettingsIssue[] = []
  if (!row) {
    for (const key of Object.keys(settings) as (keyof ModelSettings)[]) {
      if (settings[key] !== undefined) issues.push({ key, message: `${model} has no capability row` })
    }
    return issues
  }
  if (effort !== undefined && !row.efforts.includes(effort)) issues.push({ key: 'effort', message: `${model} does not take effort ${effort}` })
  if (settings.thinking !== undefined) {
    const allowed = row.thinking[settings.thinking]
    const at = effort ?? row.defaultEffort
    if (!allowed) issues.push({ key: 'thinking', message: `${model} does not take thinking ${settings.thinking}` })
    else if (at !== null && !allowed.includes(at)) issues.push({ key: 'thinking', message: `${model} does not take thinking ${settings.thinking} at effort ${at}` })
  }
  if (settings.display !== undefined && !row.displays.includes(settings.display)) issues.push({ key: 'display', message: `${model} does not take display ${settings.display}` })
  if (settings.maxTokens !== undefined && !(Number.isInteger(settings.maxTokens) && settings.maxTokens >= 1 && settings.maxTokens <= row.maxOutputTokens)) {
    issues.push({ key: 'maxTokens', message: `${model} takes max tokens from 1 to ${row.maxOutputTokens}` })
  }
  if (settings.cacheTtl !== undefined && !row.cacheTtls.includes(settings.cacheTtl)) issues.push({ key: 'cacheTtl', message: `${model} does not take cache TTL ${settings.cacheTtl}` })
  return issues
}

/** `settings` with every field the model rejects dropped (the request builder's guard before a call). An
 *  untrusted value (a stored field, a request body) passes through here first. */
export function normalizeModelSettings(model: string, raw: unknown, effort?: Effort): ModelSettings {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const typed: ModelSettings = {
    ...(r['thinking'] === 'adaptive' || r['thinking'] === 'disabled' || r['thinking'] === 'between_tools' ? { thinking: r['thinking'] } : {}),
    ...(r['display'] === 'summarized' || r['display'] === 'omitted' ? { display: r['display'] } : {}),
    ...(typeof r['maxTokens'] === 'number' ? { maxTokens: r['maxTokens'] } : {}),
    ...(r['cacheTtl'] === '5m' || r['cacheTtl'] === '1h' ? { cacheTtl: r['cacheTtl'] } : {}),
  }
  const bad = new Set(validateModelSettings(model, typed, effort).map((i) => i.key))
  return Object.fromEntries(Object.entries(typed).filter(([k]) => !bad.has(k as keyof ModelSettings))) as ModelSettings
}

/** T-0310: whether `model` takes a forced tool choice with thinking off at `effort` (absent: the row's default), the
 *  pair a forced `render_surface` round needs. True for Haiku 5.5 up to `high`; false for an unknown model. */
export function acceptsForcedToolWithThinkingOff(model: string, effort: Effort | undefined): boolean {
  const row = capabilitiesFor(model)
  if (!row || !row.forcedToolChoice) return false
  const at = effort ?? row.defaultEffort
  return at !== null && (row.thinking.disabled ?? []).includes(at)
}

/** The effort levels at which `mode` is legal on `model` (the composer's "Thinking off" gate). */
export function effortsAllowing(model: string, mode: ThinkingMode): readonly Effort[] {
  return capabilitiesFor(model)?.thinking[mode] ?? []
}
