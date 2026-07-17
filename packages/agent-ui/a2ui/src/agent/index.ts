// @agent-ui/a2ui/agent — the A2UI PRODUCER toolkit's public surface (ADR-0137, TKT-0072). The portable
// half of the live-agent harness: the machinery that reliably drives a model to EMIT real A2UI wire
// messages instead of describing a UI in prose — `buildSystemPrompt` (the drift-gated, catalog-grounded
// prompt), `produce()` (the bounded generate → heal+validate → self-correct driver), the
// `AgentTransport`/`Session` seam types, the `GenUiMode` axis, the mini-skill registry, the feed-catalog
// partition, and the hand-rolled, SDK-free Anthropic `AgentProvider` adapter.
//
// Exposed ONLY via the package.json "./agent" subpath export — the ROOT barrel (`../index.ts`) does NOT
// re-export this module (ADR-0137 clause 1 identity gate: a renderer-only consumer bundles ZERO producer
// bytes, the `./examples`/`./corpus` precedent — ADR-0055 clause 3 / ADR-0062 clause 4). The pack is
// NODE-FIRST by construction (ADR-0137 clause 4): `system-prompt.ts` and `mini-skills.ts` `readFileSync`
// their `prompts/*.md` at module load; every other module is platform-neutral (plain `fetch`, a global).
// SDK-free by law (ADR-0069/0073): no `@anthropic-ai/sdk`, no third-party dependency anywhere under
// `src/agent/`. The dev-proxy/key-holder + provider registry stay site-internal in `tools/agent/`
// (ADR-0137 clause 3), never exported.

export * from './agent-transport.ts'
export * from './session.ts'
export * from './meta-line.ts'
export * from './gen-ui-mode.ts'
export * from './feed-catalog.ts'
export * from './produce.ts'
export * from './system-prompt.ts'
export * from './mini-skills.ts'
export * from './recorded-transport.ts'
export * from './providers/anthropic.ts'
