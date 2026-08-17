// @agent-ui/devtools — the browser-safe core barrel (ADR-0200 clause 2 / devtools-harness SPEC-R1).
//
// Carries: the three-backend transport shelf behind the unchanged ADR-0137 `AgentTransport` seam
// (replay/script · proxy · a2a peer), the backend descriptor rows (`listBackends`), the
// `DevtoolsEvent` NDJSON timeline vocabulary + `recordTurn` (S3), and the `DevtoolsCapture` format.
// Zero I/O at module scope; zero third-party runtime deps.
//
// This barrel NEVER imports `./server` or `./playwright` (the ADR-0119/0192 pure-core + opt-in-subpath
// geometry) — enforced by `layering.test.ts`'s barrel-reachability walk. No key, provider adapter, or
// `produce()` import anywhere in this package (SPEC-R1 AC2; the ADR-0073 trust boundary stays at
// `/__a2ui/agent`).

export * from './transports/replay.ts'
export * from './transports/proxy.ts'
export * from './transports/a2a-peer.ts'
export * from './transports/backends.ts'
export * from './timeline/events.ts'
export * from './capture/format.ts'
