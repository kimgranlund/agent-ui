// run-id.ts (T-0259): the probe-run identity a trace line carries. `chat:probe` and `run-capped.ts` send one
// id per probe run as the `x-a2ui-run-id` request header; the dev proxy reads it (`readRunId`) and
// `trace-log.ts` writes it on that run's trace lines as `runId`, so a round imports into context-fog-of-war
// with one conversation per run. Absent outside probe runs (a turn from the dev UI has no header, so no field).
//
// Zero-dep and pure on purpose: the probe (plain Node scripts) and the proxy plugin both import it.

/** The request header a probe sets on every produce/chat call of one run. */
export const RUN_ID_HEADER = 'x-a2ui-run-id'

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/

/** The run id inside a header value (a string, or a Node header list), else `undefined`. A value that does not
 *  match the id grammar is dropped, never trimmed into a different id, so a trace line never carries free text. */
export function readRunId(header: unknown): string | undefined {
  const value = Array.isArray(header) ? header[0] : header
  return typeof value === 'string' && RUN_ID.test(value) ? value : undefined
}

/** A fresh run id: the probe's name (sanitized to the id grammar) plus a per-run suffix. */
export function newRunId(name: string, suffix: string): string {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, 60)
  return `${base === '' ? 'run' : base}-${suffix}`.slice(0, 80)
}

/** The request headers a probe forwards to the dev proxy: the page's own headers plus the run id. Playwright's
 *  `route.fetch({ headers })` replaces the set, so the originals ride along; any casing of the header the
 *  page sent is replaced, never doubled. */
export function withRunId(headers: Record<string, string>, runId: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) if (name.toLowerCase() !== RUN_ID_HEADER) out[name] = value
  out[RUN_ID_HEADER] = runId
  return out
}
