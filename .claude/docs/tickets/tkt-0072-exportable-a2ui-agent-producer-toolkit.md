---
doc-type: ticket
id: tkt-0072
status: open
date: 2026-07-16
owner:
kind: feature
size: big
---
# TKT-0072 — no reusable path exists for a consumer's own agent to reliably EMIT real A2UI (the render side already ships; the producer side is fenced site-internal)

## Summary
Kim's seed (2026-07-16, `/feature` intake, "render A2UI in chat", 3 screenshots): a chat surface
whose agent identifies itself as "an AI Assistant (A2UI)" is asked to "use A2UI" and, instead of
emitting a real interactive surface, fabricates a fake UI out of markdown box-drawing text
(`**BLACK JACK - A2UI**`, `○ **[1] HIT**`) — the same failure class TKT-0071 named for plain prose,
now visible in a UI the agent is explicitly *trying* to produce and can't.

**Dedup finding — the render side is already shipped, unaffected by this ticket.** `ui-surface-host`
composed inside `ui-conversation` (SPEC-R7, [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md))
mounts a real, interactive A2UI surface inline in an agent turn today — proven by this repo's own
`a2ui-chat` page. [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F1
deliberately keeps `ui-conversation` transport-agnostic: the app supplies its own `AgentTransport`
and turn loop, by design, not a gap.

**What's actually missing, grep-confirmed:** the machinery that reliably drives a *model* to emit
real A2UI wire messages instead of describing a UI in prose — `buildSystemPrompt`
(`tools/agent/system-prompt.ts`, the drift-gated, catalog-grounded prompt), `produce()`
(`tools/agent/produce.ts`, the streaming producer loop), the `AgentTransport`/session model
(`agent-transport.ts`/`session.ts`), the gen-ui `mode` axis, the mini-skill registry, the
feed-catalog partition — is "accepted + REALIZED" per
[`a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) v0.4, but lives entirely under
`packages/agent-ui/a2ui/tools/agent/`, which is **not** in `@agent-ui/a2ui`'s `package.json`
`exports` map (`.` / `./examples` / `./corpus` only — verified). This is not an oversight: **SPEC-N1**
in [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) ratifies it explicitly — *"the live
infra is site/tools-scoped only (Constraint C2 / ADR-0062/[ADR-0069](../adr/0069-a2ui-live-agent-demo-shape.md))"*
— protecting the package's zero-dep guarantee. A consumer app has no first-party way to replicate
this repo's own "reliably emit A2UI, not prose" behavior; hand-rolling it from scratch is the only
option today, and the screenshots are the predictable failure mode of that gap.

**A caveat this ticket does NOT paper over:** not everything under `tools/agent/` is portable as-is
even if exported. `dev-proxy-plugin.ts` (Vite dev-server middleware) and `providers.json`/
`providers-config.ts` (the docs site's own dev-only provider-switcher UI) solve a
browser-dev-server key-holding problem specific to *this repo's* local dev loop
([ADR-0069](../adr/0069-a2ui-live-agent-demo-shape.md): "opt-in dev-server proxy live overlay,
plain-fetch key-holder, SDK-free" — deliberately not a production pattern). A production consumer
needs its own server-side key boundary. Exporting means separating the genuinely portable core
(prompt-building, the producer driver shape, the transport/session types) from this site-specific
shell — not just widening the `exports` map.

## Acceptance
- A documented, versioned entry point lets a consumer app obtain: (a) the drift-gated,
  catalog-grounded system prompt (today's `buildSystemPrompt` capability), (b) a producer driver
  that turns a model's streamed output into a validated A2UI JSONL stream feedable to
  `ui-surface-host`/`ui-conversation`'s `ingestLine()` API (today's `produce()` shape), and (c) the
  `AgentTransport`/session types as public, documented types.
- The exported surface stays **SDK-free** (plain `fetch`, provider-agnostic — ADR-0069's law
  preserved) and **zero-dep-core / opt-in-pack shaped**, following the exact precedent
  [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) already set for `@agent-ui/code`
  (`./highlight`/`./markdown`): a pure core + a hand-rolled, tree-shake-gated opt-in pack — never a
  vendored LLM SDK "in costume" (ADR-0107's law). `@agent-ui/a2ui`'s core stays byte-identical for
  non-adopters.
- `dev-proxy-plugin.ts` and the provider-switcher dev-UI stay site-internal — they are not part of
  what's exported; a consumer's own key-holding boundary is out of this ticket's scope, not solved
  by it.
- A minimal, documented example (a small server-side handler, not a browser dev-proxy) demonstrates
  a consumer wiring its own LLM call through the exported producer into a real `ui-conversation` —
  closing the exact loop the screenshots show broken.
- **SPEC-N1 is either amended by a proposed ADR** (explaining why the export doesn't compromise the
  zero-dep core, citing the ADR-0119 opt-in-pack precedent directly) **or this ticket is declined at
  ratification** — either way the SPEC text must not go silently stale once a decision lands.

## Links
- [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) — SPEC-N1, the ratified constraint
  this ticket proposes to amend.
- [`a2ui-live-agent.lld.md`](../lld/a2ui-live-agent.lld.md) — the "accepted + REALIZED" producer/
  system-prompt machinery this ticket wants made reusable; per-module file map (LLD-C1/C4/C5/C14 etc).
- [ADR-0069](../adr/0069-a2ui-live-agent-demo-shape.md) — the live-agent demo's SDK-free,
  site-scoped seam ruling this ticket must not regress.
- [ADR-0062](../adr/0062-corpus-packaging-pure-core-subpath-data-home.md) — the pure-core / Node-shell
  / subpath split `tools/corpus/` already follows; a candidate shape for `tools/agent/` too.
- [ADR-0119](../adr/0119-code-prose-family-v1-scope.md) — the direct precedent: zero-dep core + opt-in
  hand-rolled runtime pack, tree-shake + identity gated. Same law applies to a live-agent producer
  (unambiguously "runtime code," ADR-0107).
- [`app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) SPEC-R7 — the render side, already
  shipped, unaffected by this ticket.
- [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F1 — `ui-conversation`
  stays transport-agnostic by design; not reopened here.
- [TKT-0071](tkt-0071-conversation-bubble-markdown-rendering.md) — sibling ticket from the same
  intake session (the prose/markdown-rendering half of the same screenshots).

## Scope/Open
- **Package shape undecided.** A new subpath on `@agent-ui/a2ui` (e.g. `./agent`) vs. a wholly
  separate sibling package (`@agent-ui/agent-toolkit`, mirroring `@agent-ui/code`'s own naming
  tension noted at its intake) — left to `system-planner`'s fork at design time, not decided here.
- **Provider surface undecided.** Today's `providers.json`/`providers-config.ts` hardcode a small
  dev-tested set for the site's own switcher UI; what a consumer-facing export's provider
  configuration contract looks like (which providers ship built-in vs. bring-your-own-fetch) is
  unresolved.
- **Key-holding boundary named, not designed.** ADR-0069's dev-server-proxy pattern is explicitly
  local-dev-only; a production consumer's server-side key boundary is a real design surface this
  ticket flags but does not spec.
- **Unverified: whether the screenshotted product is actually built on `@agent-ui/a2ui` at all.**
  No direct evidence was found in this repo tying those screenshots to this package. This ticket
  proceeds on the reasonable inference that "render A2UI in chat" targets this repo's own capability
  gap (confirmed real and grep-verified independent of the screenshots' origin), not a diagnosis of
  that specific external product.

## Findings

- **2026-07-16 — design intake done; ADR-0137 proposed.**
  [ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md) rules the shape: a `./agent` subpath
  on `@agent-ui/a2ui` (the ADR-0062 fourth-subpath shape, DAG untouched — NOT a sibling package), the
  audited portable core moving `tools/agent/` → `src/agent/`, the dev-proxy/key/registry shell staying
  site-internal, SPEC-N1 amended by a v0.5 versioned changelog at build (gated on ratification). Two
  intake discoveries beyond this ticket's own text: (a) ADR-0135 (built 2026-07-14) moved the prompt
  text into fs-loaded `prompts/*.md`, so `buildSystemPrompt`/`mini-skills` are now Node-BOUND — ruled
  as fork F3 (Node-first pack, matching the server-side key posture; platform-neutral injection seam
  deferred); (b) `createRecordedTransport`'s default-param coupling to the demo transcript must break
  (required param) to keep demo bytes out of consumer graphs. Four forks (F1 shape · F2 cut · F3
  Node-first · F4 provider surface) carry firm recommendations, awaiting Kim's ratification — no code
  changed.
