// @agent-ui/devtools — the browser-safe core barrel (ADR-0200 clause 2 / devtools-harness SPEC-R1).
//
// Carries: the three-backend transport shelf (replay/script · proxy · a2a peer, S2), the backend
// descriptor rows (`listBackends`), the `DevtoolsEvent` NDJSON timeline vocabulary + `recordTurn` (S3),
// and the `DevtoolsCapture` format. Zero I/O at module scope; zero third-party runtime deps.
//
// This barrel NEVER imports `./server` or `./playwright` (the ADR-0119/0192 pure-core + opt-in-subpath
// geometry) — enforced by `layering.test.ts`'s barrel-reachability walk. No key, provider adapter, or
// `produce()` import anywhere in this package (SPEC-R1 AC2; the ADR-0073 trust boundary stays at
// `/__a2ui/agent`).

export {}
