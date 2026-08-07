// map-tool.ts — LLD-C3 (SPEC-R25 AC1/AC2 / ADR-0177 cl.3): the pure three-fact mapping from one
// discovered MCP tool onto one ordinary IntegrationManifest, plus the execute bridge closing over
// the S2 client. Pure and synchronous except for the returned `execute` closure — this module NEVER
// calls `registerIntegration` (S4's discovery-loop job, not this one's) and never loops over
// servers (also S4's).
//
// The three facts held independent (SPEC-R25 / LLD §3.3): `id` is the NAMESPACED
// `mcp:<server-id>:<tool-name>`, `tool.name` is the MCP wire name VERBATIM (unnamespaced — the
// disclosed cross-server-collision trade SPEC-R26 governs), and `label` is independently composed
// from the server's label + the tool's title/name. None is re-derived from either of the other two
// — relabeling a server never touches `id` or `tool.name`.
//
// `input_schema` passes through UNTOUCHED (same object reference as the discovered `inputSchema`,
// not a copy) — the same `assertSupportedSchema` gate every hand-authored manifest faces runs
// INSIDE `registerIntegration` itself; this module never pre-checks (a pre-check here would be a
// second validator to drift out of sync with the shipped one, LLD §3.3).
//
// `description` = `tool.description ?? label` — the manifest field (and the model-facing
// `tool.description`) is required; MCP's is optional, so the independently-composed `label` is the
// fallback rather than inventing new prose. `version` = `'1.0.0'`, a constant (§8 non-decision: MCP
// carries no per-tool semver). `auth`/`envKey` are copied ONCE from the server entry — SPEC-R18's
// law, unchanged.
//
// `execute` = `client.callTool(tool.name, input, {signal, apiKey})` + a TEXT-only result mapping:
// each `type:'text'` part contributes its own text, each non-text part degrades to the literal
// placeholder `[<type> content omitted]` (stated, never silently dropped), and the parts join with
// `\n\n` in original order. `isError: true` THROWS with the flattened text so the adapter's existing
// `is_error` tool_result conversion applies (GH #49's degrade-the-answer-never-the-turn contract,
// unchanged) — a transport `McpClientError` from `callTool` propagates the exact same way, since
// this closure never catches it.

import type { ExecuteContext, IntegrationManifest } from '../registry.ts'
import type { McpClient, McpContentPart, McpToolInfo } from './client.ts'
import type { McpServerEntry } from './servers-config.ts'

export interface MapToolInput {
  serverId: string
  server: McpServerEntry
  tool: McpToolInfo
  client: McpClient
}

const TEXT_JOIN = '\n\n'

/** Flatten one `tools/call` content array into model-facing TEXT (SPEC-R25 AC2): a `type:'text'`
 *  part contributes its own text; anything else degrades to a stated placeholder, never silently. */
function flattenContent(parts: readonly McpContentPart[]): string {
  return parts.map((part) => (part.type === 'text' ? part.text : `[${part.type} content omitted]`)).join(TEXT_JOIN)
}

/**
 * Map one discovered MCP tool + its server's roster entry onto exactly ONE `IntegrationManifest`
 * (LLD §3.3). Pure: no registration, no server iteration, no I/O of its own — the returned
 * `execute` is the only part that does anything, and only when the host later calls it.
 */
export function mapMcpTool(input: MapToolInput): IntegrationManifest {
  const { serverId, server, tool, client } = input

  // The three independent facts (SPEC-R25) — none derived from either of the other two.
  const id = `mcp:${serverId}:${tool.name}`
  const label = `${server.label}: ${tool.title ?? tool.name}`

  const description = tool.description ?? label

  return {
    id,
    version: '1.0.0',
    label,
    description,
    tool: {
      name: tool.name,
      description,
      input_schema: tool.inputSchema, // passthrough — SAME reference, untouched (no pre-check here)
    },
    auth: server.auth,
    envKey: server.envKey,
    async execute(toolInput: Record<string, unknown>, ctx: ExecuteContext): Promise<string> {
      const result = await client.callTool(tool.name, toolInput, { signal: ctx.signal, apiKey: ctx.apiKey })
      const text = flattenContent(result.content)
      if (result.isError === true) {
        throw new Error(text.length > 0 ? text : `${tool.name}: the MCP server reported an error`)
      }
      return text
    },
  }
}
