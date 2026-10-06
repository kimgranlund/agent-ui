// findings.ts: the A2UI test kit's one finding shape, its seven layers, and the one code table that gives
// every kit-minted code its layer (T-0011). Zero imports, browser-safe.
//
// A layer names WHERE a defect was caught, so a seeded fixture can pin "this layer, this code" and red if a
// different layer catches it first. Native validator codes (`PARSE`, `SCHEMA`, ...) are not in the table:
// they pass through with their own path and take `validatorLayer(catalogId)`, which is `interop` for the
// upstream a2ui-basic family (ADR-0169) and `validator` otherwise. The catalog, not the code, is the
// discriminator: a wrong-dialect plant fails with whatever native code the gap hits.

export const LAYERS = ['validator', 'heal', 'renderer', 'catalog', 'producer', 'integration', 'interop'] as const
export type Layer = (typeof LAYERS)[number]

/** One red the kit reports. `path` is a JSON path, a validator path, or a JSON pointer; `detail` is free text. */
export interface KitFinding {
  layer: Layer
  code: string
  path?: string
  detail?: string
}

/** One scenario's run: `ok` exactly when there are no findings. */
export interface ScenarioResult {
  name: string
  ok: boolean
  findings: KitFinding[]
}

/** Every code the kit itself mints, with its layer. The `SEEDED_*` codes are outside: they take the
 *  fixture's own layer (seeded.ts). */
export const KIT_CODE_LAYER = {
  HEAL_UNPARSEABLE: 'heal',
  HEAL_MISMATCH: 'heal',
  ORDER_CONTENT_BEFORE_META: 'producer',
  TARGET_NOT_MUTATED: 'producer',
  PRODUCE_HALT: 'producer',
  PRODUCE_MISMATCH: 'producer',
  TREE_MISMATCH: 'renderer',
  BINDING_UNRESOLVED: 'renderer',
  RENDER_ERROR: 'renderer',
  CLIENT_MESSAGE_MISMATCH: 'renderer',
  DATA_MODEL_MISMATCH: 'renderer',
  MINIMAL_UNDERIVABLE: 'catalog',
  SELECTION_BIJECTION: 'catalog',
  SCRIPT_UNMATCHED: 'integration',
  SCRIPT_EXHAUSTED: 'integration',
  SCRIPT_UNCONSUMED: 'integration',
  TOOLS_MISMATCH: 'integration',
  MCP_HTTP: 'integration',
  MCP_TIMEOUT: 'integration',
  MCP_TOO_LARGE: 'integration',
  MCP_PARSE: 'integration',
  MCP_JSONRPC: 'integration',
  MCP_TOO_MANY_PAGES: 'integration',
  MCP_TOOL_ERROR: 'integration',
} as const satisfies Readonly<Record<string, Layer>>

export type KitCode = keyof typeof KIT_CODE_LAYER

/** The native validator codes (the runtime SPEC's stage-to-code table, `src/protocol.ts` `ErrorCode`). */
export const VALIDATOR_CODES = ['PARSE', 'SCHEMA', 'VERSION_UNSUPPORTED', 'CATALOG', 'IDGRAPH', 'CONTAINMENT', 'POINTER'] as const

export function isLayer(value: unknown): value is Layer {
  return typeof value === 'string' && (LAYERS as readonly string[]).includes(value)
}

export function isKitCode(value: string): value is KitCode {
  return Object.hasOwn(KIT_CODE_LAYER, value)
}

/** A kit-minted finding; the layer comes from `KIT_CODE_LAYER`, never from the caller. */
export function kitFinding(code: KitCode, extra: { path?: string; detail?: string } = {}): KitFinding {
  return { layer: KIT_CODE_LAYER[code], code, ...extra }
}

/** The layer native validator findings (and `VERDICT_MISMATCH`) take for a scenario's catalog. */
export function validatorLayer(catalogId: string): 'validator' | 'interop' {
  return catalogId === 'a2ui-basic' || catalogId.startsWith('a2ui-basic--') || catalogId.startsWith('https://a2ui.org/')
    ? 'interop'
    : 'validator'
}

/** A native validator code or `VERDICT_MISMATCH`, layered by the scenario's catalog. */
export function validatorFinding(catalogId: string, code: string, extra: { path?: string; detail?: string } = {}): KitFinding {
  return { layer: validatorLayer(catalogId), code, ...extra }
}

export function resultOf(name: string, findings: readonly KitFinding[]): ScenarioResult {
  return { name, ok: findings.length === 0, findings: [...findings] }
}

/** One line per finding, the CLI's print shape: `red layer=<layer> code=<code>[ path=<path>][ (<detail>)]`. */
export function formatFinding(f: KitFinding): string {
  return `red layer=${f.layer} code=${f.code}${f.path !== undefined ? ` path=${f.path}` : ''}${f.detail !== undefined ? ` (${f.detail})` : ''}`
}
