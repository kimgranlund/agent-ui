// scripted-tools.ts: keyless integration manifests for the kit's tool rounds (T-0011). Each spec becomes an
// ordinary `IntegrationManifest` whose `execute` records `{ tool, input }`, then resolves the scripted
// `reply` string or rejects with `new Error(reply.throw)`.
//
// It never calls `registerIntegration`, so the process-wide registry stays untouched; feed `manifests` to
// `buildToolDispatch` directly. It does not re-run `assertSupportedSchema` either (its one call site is
// `registerIntegration`), so a kit `input_schema` must stay inside the subset `validate-input.ts` supports.

import type { IntegrationManifest } from '../agent/integrations/registry.ts'
import type { ScriptedToolSpec } from './scenario.ts'

export interface ScriptedToolCall {
  tool: string
  input: Record<string, unknown>
}

export function scriptedTools(specs: readonly ScriptedToolSpec[]): { manifests: IntegrationManifest[]; calls: ScriptedToolCall[] } {
  const calls: ScriptedToolCall[] = []
  const manifests = specs.map((spec): IntegrationManifest => {
    const description = spec.description ?? `scripted tool ${spec.name}`
    return {
      id: spec.name,
      version: '0.0.0',
      label: spec.name,
      description,
      tool: { name: spec.name, description, input_schema: spec.input_schema },
      auth: 'none',
      async execute(input) {
        calls.push({ tool: spec.name, input })
        if (typeof spec.reply === 'string') return spec.reply
        throw new Error(spec.reply.throw)
      },
    }
  })
  return { manifests, calls }
}
