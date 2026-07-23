# ADR-0136 — `ui-agent-admin`'s chat preview gains an opt-in, DEV-only live-model overlay, reusing the AgentTransport/dev-proxy seam — ADR-0131 cl.4/7 narrows to the production path, it is not reversed

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 |
> | **Proposed by** | design intake (`/scribe:feature`'s Phase 2 clarifying round — one batched `AskUserQuestion`, three concrete readings of "managing all the routing" offered), directed by Kim: Kim picked "wire a real live model call" over (a) deepening the existing stub or (b) adding `@agent-ui/router` page-navigation. Two-plane lens applied inline (surfaces: `agent-admin.ts`'s `#handleSubmit`, `agent-admin-schema.ts`'s model list, `entries.ts`'s capability entries, the existing `AgentTransport` seam, `dev-proxy-plugin.ts`, the provider switcher; actions: select model → commit to store → fresh-read at turn time → build a live turn request → dispatch → render into `ui-conversation` → handle error/loading) — not a full `system-decompose` manifest run (no `coverage_check.py` pass this intake); the LLD-level unknowns (Fork 3 below) are better decomposed with full build context, named here as a build-time follow-up rather than spuriously resolved now. |
> | **Ratified by** | Status flipped to `accepted` in-tree (see `git blame` for provenance) — this field is left unfilled rather than asserting a specific ratifier/date neither witnessed nor confirmed in-conversation |
> | **Repairs** | none yet — an intake ADR; a build phase (separately dispatched) realizes it. Likely earns its own LLD at build time (Fork 3's mapping question is genuine design work), not bundled here. |
> | **Supersedes / Superseded by** | Amends [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md) (narrows cl.4/cl.7's "no external runtime dependency" ruling to the production/default path only — the shipped static docs site still carries zero key path; a local `vite dev` session with a configured provider key may now exercise a real call). Relates [ADR-0073](./0073-a2ui-live-model-provider-seam.md) (the trust-boundary law this reuses verbatim — the browser never holds a key), [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the `liveAgentConfigSchema`/`resolveProduceOptions` mechanism `agent-config-schema.ts` already ships, one candidate the build-time LLD may project `agent-admin`'s own config onto), [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (the entry-list prompt/capability composition a live turn must bridge into whatever request shape the seam expects). Nothing superseded. |

## Context

TKT-0043 (closed `done`, same day) already made `ui-agent-admin`'s `model` field real — a genuine
`SUPPORTED_MODELS` list, cited by display label in the stub reply — and gave its three built-in prompt
sections real default content. All of it stayed inside ADR-0131 cl.4/cl.7's ruling: "no external runtime
dependency" — the demo is, and was meant to stay, a deterministic stub proving the CONFIG WIRING, never a
live call.

A follow-up ask — "complete the chat UI in `agent-admin.html` by wiring up to model selector and managing
all the routing" — was ambiguous enough (three structurally different readings, one of which directly
contradicts an accepted, Kim-only-flippable ADR clause, another of which crosses an enforced layering
trip-wire barring `@agent-ui/router` from this package) that this feature-intake ran ONE batched
clarifying question before minting anything. Kim's answer: wire a real live model call.

Separately, and unrelated to `agent-admin`, a REAL live-model chat surface already exists and is fully
proven: `site/pages/a2ui-live.ts` (LLD-C9/SPEC-R10) drives its chat through exactly ONE seam,
`AgentTransport` (SPEC-R1) — defaulting to a deterministic recorded backbone (works offline, in the built
static site, under CI) and swapping in a LIVE overlay (a real model via `dev-proxy-plugin.ts` + the
provider switcher) ONLY under `import.meta.env.DEV`, via a dynamic import, so `vite build` tree-shakes the
live path out entirely — no key ever reaches the static build (SPEC-N2). `dev-proxy-plugin.ts` itself is
the ADR-0073-ruled trust boundary: it holds each provider's key SERVER-side, validates the client's
`{provider, model}` pair against the committed `providers.json` allowlist, and the browser never holds a
key. ADR-0135 (accepted, already built — `agent-config-schema.ts` ships `liveAgentConfigSchema`/
`resolveProduceOptions`) explicitly named "wiring a `ui-settings` UI to this schema" as an OUT-OF-SCOPE,
separately-dispatchable follow-up for A2UI Chat's OWN config surface — this ADR is effectively Kim naming
that follow-up now, but pointed at `agent-admin`'s surface specifically, not A2UI Chat's.

So the real engineering question is not "may `ui-agent-admin` ever make a live call" in the abstract — a
proven, ADR-0073-ruled, dev-only mechanism for exactly that already exists in this repo — it is "does
`agent-admin` reuse that same mechanism, and does doing so require walking back ADR-0131's original
safety guarantee for the SHIPPED docs site." The answer this ADR ratifies: no walk-back needed. The same
dev-only construction-site swap that already protects `a2ui-live.ts` protects `agent-admin.ts` too.

## Decision

**Reuse the `a2ui-live.ts` DEV-only overlay pattern verbatim — do not invent a second live-call
mechanism, and do not lift ADR-0131 cl.4/7 wholesale.**

1. **Production/static build: unchanged.** `agent-admin.ts`'s `#handleSubmit` still defaults to
   `runStubAgentTurn` — the deterministic stub TKT-0039/ADR-0131 shipped, now enriched by TKT-0043's real
   model citation. The shipped docs site (`vite build`) carries no key path, no live-call code at all
   (tree-shaken), exactly as ADR-0131 cl.4/7 originally guaranteed. This is the narrowing, not the
   reversal: cl.4/7 now reads as "the production/default path makes no external call," not "this
   component may never make one under any circumstance."
2. **`import.meta.env.DEV`-gated overlay.** A dynamically-imported module swaps the turn-submit
   construction site for a real `AgentTransport`-driven call through the ALREADY-MOUNTED
   `dev-proxy-plugin.ts` trust boundary — the same provider allowlist, the same server-side key holding,
   no second proxy stood up. `vite.config.ts` already mounts this plugin for `a2ui-live.ts`'s own use;
   `agent-admin`'s dev session rides the same mount, not a duplicate one.
3. **The live turn's config is projected from `agent-admin`'s OWN already-real pieces** — the selected
   `SUPPORTED_MODELS` id (TKT-0043), `composeSystemPrompt`'s current output (ADR-0132) — into whatever
   request shape the seam expects. The EXACT mapping (and whether the four capability-entry kinds —
   skills/workflows/resources/tools — get real wire representation or stay display-only even once live)
   is explicitly a build-time LLD question (Fork 3), not resolved by this ADR.
4. **No page-navigation routing.** Kim's answer settled this: `@agent-ui/router` is not part of this
   change: the enforced layering trip-wire (`agent-admin.ts` may never import `@agent-ui/router`/
   `@agent-ui/a2a`) stands, unchanged.

## Forks ruled (recommended; none self-ratified)

1. **Dev-only vs. always-on.** RECOMMEND dev-only (matches SPEC-N2 / the `a2ui-live.ts` precedent — no
   key path in the static build). Rejected: always-on live calls from the PUBLICLY DEPLOYED docs site —
   an unmetered, unauthenticated live chat endpoint reachable by any site visitor is exactly the cost/
   abuse exposure ADR-0131 cl.4/7 was originally written to avoid; nothing in Kim's ask requires giving
   that guarantee up.
2. **Reuse `AgentTransport`/`dev-proxy-plugin.ts`/`produce()` vs. a new bespoke mechanism.** RECOMMEND
   reuse — it already carries the ADR-0073 trust boundary + provider allowlist, proven in production use
   by `a2ui-live.ts`. Rejected: a second bespoke live-call path, which would duplicate ADR-0073's
   key-holding law a second time with a second attack surface to keep in sync.
3. **Whether `agent-admin`'s four capability-entry kinds get real wire representation once live, or stay
   display-only/stub-cited labels forever.** NOT ruled here — `AgentTransport`/`produce()`'s existing
   shape has no such concept yet, and inventing one is its own design surface. Named as the build-time
   ticket's own open question (see the paired ticket's Scope/Open), to be resolved by whoever authors the
   earned LLD, with full build context.

## Consequences

- `ui-agent-admin` gains its first real external-runtime code path — DEV-only, tree-shaken out of the
  static build, so the shipped docs site's "no external runtime dependency" guarantee holds unchanged for
  every visitor; only a local `vite dev` session with a configured provider key can exercise it.
- ADR-0131 cl.4/cl.7 is AMENDED (narrowed), not reversed or superseded — the accepted ADR's body stays
  append-only per this repo's own convention; this file is the append.
- `agent-admin.ts` gains a construction-site swap mirroring `a2ui-live.ts`'s own — likely earning its own
  LLD at build dispatch, given Fork 3's mapping question is genuine, unresolved design work.
- No new package-layering exception: `@agent-ui/router`/`@agent-ui/a2a` remain barred from `agent-admin`,
  unchanged.

## Acceptance

This is an **intake** ADR — realized in a separately-dispatched build, the ADR-0131/0132/0135 precedent
shape:

- **Intake (this change):** the clarifying round + inline two-plane lens applied; one fork ratified (live
  call: yes, dev-only, reusing the existing seam); two sub-forks recommended, one left explicitly open;
  paired ticket (TKT-0052) carries the acceptance criteria and the open build-time questions.
- **Build (separate):** an LLD (recommended, given Fork 3) mapping `agent-admin`'s config → the seam's
  request shape; the DEV-only construction-site swap itself; the equivalence/tree-shake gate proving the
  static build carries no live-call code; independently reviewed (generator ≠ critic, the ADR-0131
  precedent); `npm run check && npm test` green.

## Alternatives considered

- **Leave ADR-0131 cl.4/7 as an absolute, permanent law.** Rejected — Kim explicitly directed a real live
  call this session; the ADR records that direction rather than silently overriding or silently refusing
  it.
- **Supersede ADR-0131 wholesale instead of amending narrowly.** Rejected — the production/static-build
  "no external dependency" guarantee is still valuable and nothing in Kim's ask requires giving it up;
  amending preserves it while satisfying the ask.
- **Build a second bespoke live-call mechanism instead of reusing `AgentTransport`/`dev-proxy-plugin.ts`.**
  Rejected — see Fork 2.
