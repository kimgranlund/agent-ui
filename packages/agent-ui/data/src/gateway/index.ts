// @agent-ui/data/gateway — the consumer-side client contract (SPEC §3.3): middleware onion, token
// flow with single-flight 401 refresh, exponential-backoff-with-jitter retry, and the streaming
// pass-through law (SPEC-R11 — proven by gateway/passthrough.test.ts, a rule + gate, no module).

export type { Middleware, GatewayInit, GatewayOptions, Gateway, FetchLike } from './client.ts'
export { createGateway, IDEMPOTENT_HEADER } from './client.ts'
export type { WithTokenOptions } from './auth.ts'
export { withToken } from './auth.ts'
export type { RetryPolicy } from './retry.ts'
export { withRetry } from './retry.ts'
