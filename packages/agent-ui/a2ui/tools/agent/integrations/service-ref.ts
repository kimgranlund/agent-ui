// service-ref.ts — LLD-C1 (SPEC-R2 AC1, ADR-0185): the enablement-wire SERVICE-REFERENCE grammar,
// anchored whole-string. `<server-id>` restates `mcp/servers-config.ts`'s frozen SERVER_ID_PATTERN
// charset (`^[a-z0-9][a-z0-9_-]*$`, colon-free by that module's own derivation) — a PINNED
// restatement, never an import: that file is frozen for the whole mcp-agent-config arc, and this
// module owes it behavioral lockstep, not a re-export. `service-ref.test.ts`'s charset-parity case
// is the drift trip-wire: it feeds the SAME boundary ids through `validateMcpServersConfig` (the
// real, frozen loader) and through `parseServiceRef(serviceRef(id)) === id` (this module's own
// round-trip), and asserts the two verdicts agree for every probe — a charset edit on EITHER side
// reds that test, with no export needed to catch it.
//
// Pure module, zero I/O, zero imports beyond types — lives in `integrations/` (not `mcp/`) because
// its consumers are the resolution seam (`registry.ts`, LLD-C2) and the dev proxy's admin GET
// (`dev-proxy-plugin.ts`, S2), never the connector; the frozen `mcp/` files never import it.

/** `mcp:<server-id>:*`, anchored whole-string — ADR-0185's one grammar member. Any other string
 *  (including `mcp:calc:add:*`, whose middle segment fails the server-id charset by containing a
 *  colon) is NOT a service reference and stays an exact registry id — the SPEC-R2 discriminator. */
export const SERVICE_REF_PATTERN = /^mcp:([a-z0-9][a-z0-9_-]*):\*$/

/**
 * `mcp:<server-id>:*` → the server-id; any other string → `null` (SPEC-R2's parse law — the
 * caller treats `null` as "this member is an exact registry id, not a reference").
 */
export function parseServiceRef(member: string): string | null {
  const match = SERVICE_REF_PATTERN.exec(member)
  return match ? match[1]! : null
}

/** The composer — one home for the `mcp:<server-id>:*` string shape. `registry.ts`'s expansion
 *  and S2's `projectServiceRows` both reuse it rather than hand-formatting the template twice. */
export function serviceRef(serverId: string): string {
  return `mcp:${serverId}:*`
}

/** The expansion key: what a registered manifest `id` must START WITH to belong to `serverId`'s
 *  service (`registry.ts`'s `resolveAgainst`, LLD-C2). */
export function serviceRefPrefix(serverId: string): string {
  return `mcp:${serverId}:`
}
