// discover.ts — LLD-C4 (SPEC-R26 AC1 / SPEC-R23 AC2 / ADR-0177 cl.3): the fail-soft discovery loop.
// Per allowlisted server: initialize -> listTools -> map each tool -> register through an
// INJECTABLE sink (default `registerIntegration`). NEVER throws outward (LLD §3.4) — every failure
// degrades to a report row, so S5's future boot gate can never wedge the proxy on a bad server or a
// bad tool.
//
// Two failure scopes:
//   · SERVER-scope skip (no `tool` in the report row): a `serverKey` server the host cannot
//     provision (reason `no-key` — the discovery-time twin of `resolveIntegrations`' not-offered
//     degrade, never dialed); an `initialize` outcome the server negotiates OUTSIDE
//     ACCEPTED_PROTOCOL_VERSIONS (reason `unsupported-version:<negotiated>`, `tools/list` never
//     dialed); and a CATCH-ALL over ANY error thrown during the handshake or `listTools` (reason =
//     the thrown message). `McpClientError`'s closed codes are the EXPECTED taxonomy here, but the
//     catch never narrows to them — wedge-proof by construction, not by contract (LLD §3.4).
//   · PER-TOOL skip (`tool` present): the empty-name floor below, or a `mapMcpTool`/sink throw —
//     covering BOTH of `registerIntegration`'s relevant throw paths (unsupported schema, duplicate
//     wire `tool.name`, incl. the disclosed second-server-loses drop, SPEC-R26). One bad tool costs
//     exactly that one tool; the other N−1 on the same server still register.
//
// The empty-name floor (review-inherited hardening, GH #567): an off-spec server can emit a tool
// whose `name` is empty or whitespace-only. Mapping that unchecked would hand `mapMcpTool` a
// degenerate wire name, producing a manifest id like `mcp:docs:` (an empty third segment) — this
// module refuses that INPUT before it ever reaches `mapMcpTool` or the sink: a per-tool skip row,
// never a crash, never a silently-registered garbage id.
//
// Iterates `cfg.servers` in KEY order (committed-file/object-insertion order) — the deterministic
// tiebreak that makes "the FIRST server wins a cross-server `tool.name` collision" reproducible.

import { registerIntegration } from '../registry.ts'
import type { IntegrationManifest } from '../registry.ts'
import { createMcpClient } from './client.ts'
import type { McpToolInfo } from './client.ts'
import { mapMcpTool } from './map-tool.ts'
import type { McpServerEntry, McpServersConfig } from './servers-config.ts'

export interface DiscoveryDeps {
  /** Discovery-time key resolution — the caller passes the loadEnv-merged env (SPEC-R27). */
  env: Record<string, string | undefined>
  /** INJECTABLE registration sink, default registerIntegration — no test touches REGISTRY. MUST NOT
   *  throw for anything this module doesn't already anticipate: the per-tool try/catch below treats
   *  every throw here as one of `registerIntegration`'s two documented policy rejections (SPEC-R26)
   *  and degrades it to a skip row regardless — a real caller passes the real `registerIntegration`,
   *  whose throw surface is exactly those two. */
  register?: (m: IntegrationManifest) => void
  /** Injectable client factory for tests (scripted fake clients, zero transport). MUST NOT throw
   *  SYNCHRONOUSLY when called: only the returned client's async methods (`initialize`/`listTools`)
   *  run inside this module's try/catch (the LLD §3.4 catch-all below) — a factory that throws at
   *  construction time escapes that guard and propagates straight out of `discoverMcpIntegrations`,
   *  the one way this "never throws outward" module could still throw. The real `createMcpClient`
   *  never does this: it only builds an object, no I/O at construction time. */
  createClient?: typeof createMcpClient
  /** Boot log line sink; lines carry ids/reasons, never a key value. Omitted ⇒ split by kind
   *  (console.info for a registration line, console.warn for a skip line); an INJECTED sink
   *  receives every line through this ONE callback instead — the deterministic test seam. MUST NOT
   *  throw: `emit()` below calls it synchronously and uncaught, so a throwing sink would propagate
   *  straight out of `discoverMcpIntegrations`, the same escape hatch `createClient` above names. */
  log?: (line: string) => void
}

export interface DiscoveryReport {
  /** Manifest ids, in registration order. */
  registered: string[]
  /** `tool` absent ⇒ a server-scope skip. `reason` is the thrown/derived message. */
  skipped: { server: string; tool?: string; reason: string }[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function emit(deps: DiscoveryDeps, kind: 'info' | 'warn', line: string): void {
  if (deps.log) {
    deps.log(line)
    return
  }
  if (kind === 'warn') console.warn(line)
  else console.info(line)
}

/** The non-empty floor on a discovered tool NAME (the review-inherited hardening item, GH #567) —
 *  applied to the discovery INPUT, before `mapMcpTool` ever sees the tool. */
function hasUsableName(tool: McpToolInfo): boolean {
  return typeof tool.name === 'string' && tool.name.trim().length > 0
}

/** A `serverKey` server's key, host-resolved from the merged env — `undefined` if unset/empty
 *  (never dials with a blank credential) or if the server declares `auth: 'none'`. */
function resolveServerKey(server: McpServerEntry, env: Record<string, string | undefined>): string | undefined {
  if (server.auth !== 'serverKey') return undefined
  const raw = server.envKey === undefined ? undefined : env[server.envKey]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined
}

/**
 * Discover + register every allowlisted server's tools (LLD §3.4). NEVER throws outward — every
 * failure becomes a report row. An empty roster resolves immediately with an empty report and
 * constructs zero clients (SPEC-R27's zero-cost no-op). `cfg` arrives ALREADY validated — the §5
 * boot sequencing (S5) runs `validateMcpServersConfig` before ever calling this function, so this
 * module trusts its shape and re-checks none of it.
 */
export async function discoverMcpIntegrations(cfg: McpServersConfig, deps: DiscoveryDeps): Promise<DiscoveryReport> {
  const registered: string[] = []
  const skipped: DiscoveryReport['skipped'] = []
  const register = deps.register ?? registerIntegration
  const createClient = deps.createClient ?? createMcpClient

  for (const [serverId, server] of Object.entries(cfg.servers)) {
    // Server-scope skip #1 — a serverKey server the host cannot provision. Never dials (no client
    // is even constructed for it).
    if (server.auth === 'serverKey' && resolveServerKey(server, deps.env) === undefined) {
      skipped.push({ server: serverId, reason: 'no-key' })
      emit(deps, 'warn', `mcp:${serverId} — skipped (no-key)`)
      continue
    }

    const client = createClient({ endpoint: server.endpoint, apiKey: resolveServerKey(server, deps.env) })

    let tools: McpToolInfo[]
    try {
      // The CATCH-ALL (LLD §3.4): ANY error during the handshake OR listTools lands here — never
      // narrowed to McpClientError's closed codes.
      const outcome = await client.initialize()
      if (!outcome.ok) {
        skipped.push({ server: serverId, reason: `unsupported-version:${outcome.negotiated}` })
        emit(deps, 'warn', `mcp:${serverId} — skipped (unsupported-version:${outcome.negotiated})`)
        continue
      }
      tools = await client.listTools()
    } catch (error) {
      const reason = errorMessage(error)
      skipped.push({ server: serverId, reason })
      emit(deps, 'warn', `mcp:${serverId} — skipped (${reason})`)
      continue
    }

    for (const tool of tools) {
      if (!hasUsableName(tool)) {
        skipped.push({ server: serverId, tool: tool.name, reason: 'empty tool name' })
        emit(deps, 'warn', `mcp:${serverId}:${JSON.stringify(tool.name)} — skipped (empty tool name)`)
        continue
      }

      try {
        // Both throw paths land in this ONE catch: mapMcpTool throwing (it does not today, but
        // nothing here assumes it never will), and the sink throwing — registerIntegration's own
        // unsupported-schema / duplicate-tool-name policy (SPEC-R26).
        const manifest = mapMcpTool({ serverId, server, tool, client })
        register(manifest)
        registered.push(manifest.id)
        emit(deps, 'info', `mcp:${serverId}:${tool.name} — registered as ${manifest.id}`)
      } catch (error) {
        const reason = errorMessage(error)
        skipped.push({ server: serverId, tool: tool.name, reason })
        emit(deps, 'warn', `mcp:${serverId}:${tool.name} — skipped (${reason})`)
      }
    }
  }

  return { registered, skipped }
}
