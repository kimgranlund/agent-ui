// servers-config.ts — LLD-C1 (SPEC-R27 AC1 / ADR-0177 cl.4): the committed MCP-server ALLOWLIST's pure
// fail-fast loader. Mirrors `../../providers-config.ts`'s posture exactly — pure typed helpers over an
// ALREADY-PARSED object, zero I/O. The Node reader (the dev proxy, LLD-C5/S5) obtains the parsed object via
// `readFileSync` + `JSON.parse` (the `providers-config.ts` precedent); this module never touches the
// filesystem or the network, so it stays Worker-portable by construction.
//
// The roster is the allowlist FENCE (ADR-0177 cl.4): no browser- or model-supplied endpoint is ever dialed —
// only a server named here, by the host, at boot. The committed `mcp-servers.json` ships EMPTY
// (`{ "servers": {} }`, SPEC-R27) — which real server first enters it is Kim's later call
// (ADR-0177 Non-goals). An example entry (NEVER a committed one — a boot would dial it):
//
//   {
//     "servers": {
//       "example-docs": {
//         "label": "Example Docs Server",
//         "endpoint": "https://mcp.example.com/mcp",
//         "auth": "serverKey",
//         "envKey": "EXAMPLE_MCP_API_KEY"
//       }
//     }
//   }

/** One allowlisted MCP server (LLD §3.1). `label` composes SPEC-R25's `"<label>: <tool>"` manifest labels;
 *  `endpoint` is the ONLY URL this system ever dials for this server (the `resolvePair` allowlist fence,
 *  ADR-0177 cl.4); `envKey` is a NAME, never a value (SPEC-R18), REQUIRED iff `auth === 'serverKey'`. */
export interface McpServerEntry {
  label: string
  endpoint: string
  auth: 'none' | 'serverKey'
  envKey?: string
}

/** The roster shape. Key = the stable server-id — the `mcp:<server-id>:<tool>` namespace segment
 *  (SPEC-R25) — so its charset is constrained below (a colon would make that namespace unparseable). */
export interface McpServersConfig {
  servers: Record<string, McpServerEntry>
}

/** A CONVENTION choice (LLD §8), not a derivation — mirrors `providers.json`'s id style and keeps `mcp:*`
 *  manifest ids shell-quote- and grep-friendly. Only the no-colon exclusion below is DERIVED from the
 *  `mcp:<server-id>:<tool>` namespace grammar; widening this charset later is a loader-local change. */
const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate the roster's own internal invariants (SPEC-R27 AC1) — `providers-config.ts`'s posture: throws
 * with a specific message on the FIRST violation found, this is a load-time assertion, not a lookup. An
 * EMPTY `servers` map is VALID (unlike `validateProvidersConfig`'s no-providers throw) — the empty roster
 * is SPEC-R27's shipped v1 state, a zero-cost no-op, never a defect.
 */
export function validateMcpServersConfig(cfg: unknown): McpServersConfig {
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) {
    throw new Error('mcp-servers.json: root must be an object')
  }

  const servers = (cfg as { servers?: unknown }).servers
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
    throw new Error('mcp-servers.json: "servers" must be an object')
  }
  const serversRecord = servers as Record<string, unknown>

  for (const id of Object.keys(serversRecord)) {
    // The one DERIVED exclusion: a colon would make `mcp:<server-id>:<tool>` unparseable (LLD §3.1/§8).
    if (id.includes(':')) {
      throw new Error(`mcp-servers.json: server id "${id}" must not contain ":" (it is a namespace segment of the manifest id "mcp:<server-id>:<tool>")`)
    }
    // The CONVENTION charset (LLD §8) — a separate, non-derived rejection from the colon check above.
    if (!SERVER_ID_PATTERN.test(id)) {
      throw new Error(`mcp-servers.json: server id "${id}" must match ${SERVER_ID_PATTERN}`)
    }

    const entry = serversRecord[id]
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`mcp-servers.json: server "${id}" must be an object`)
    }
    const e = entry as Record<string, unknown>

    if (typeof e.label !== 'string' || e.label.length === 0) {
      throw new Error(`mcp-servers.json: server "${id}" is missing label`)
    }
    if (typeof e.endpoint !== 'string' || !isAbsoluteHttpUrl(e.endpoint)) {
      throw new Error(`mcp-servers.json: server "${id}" endpoint must be an absolute http(s) URL`)
    }
    if (e.auth !== 'none' && e.auth !== 'serverKey') {
      throw new Error(`mcp-servers.json: server "${id}" auth must be "none" or "serverKey"`)
    }
    if (e.auth === 'serverKey' && (typeof e.envKey !== 'string' || e.envKey.length === 0)) {
      throw new Error(`mcp-servers.json: server "${id}" auth "serverKey" requires a non-empty envKey`)
    }
  }

  return cfg as McpServersConfig
}
