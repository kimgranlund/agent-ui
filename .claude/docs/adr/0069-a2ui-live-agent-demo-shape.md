# ADR-0069 — the live-agent demo is a LAYERED shape isolated behind an `AgentTransport` seam: a deterministic recorded backbone (always-on, gate-covered) + an opt-in dev-server proxy live overlay (plain-fetch key-holder, SDK-free); BYOK-browser-direct deferred behind the same seam

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | planner (design seat — the live-agent intake, NEXT item 3) |
> | **Ratified by** | orchestration-coordinator + Kim ("proceed", 2026-07-04) — green gates: coverage --strict · adr_check 5/5 · harness spec/lld 3/3; all 3 independent doc-reviews GO |
> | **Repairs** | `a2ui-streaming-pipeline.lld.md` LLD-C2 (the `produce()` driver is realized concretely by this wave — the "blocked by the live-agent wave" note resolves; edit on build, gated on ratification) · `.claude/docs/specs/NEXT.md` item 3 (marked realized on ship) · new: `a2ui-live-agent.spec.md`, `a2ui-live-agent.lld.md`, `a2ui-live-agent.decomp.json` |
> | **Supersedes / Superseded by** | Relates ADR-0055 (the seed-shelf home + `examples.test.ts` gate the backbone rides) · ADR-0062 (the pure-core / Node-shell / subpath split the tools harness mirrors) · ADR-0067 (the SPEC-R6 loop's programmatic driver is this wave — streaming LLD-C2 re-pointed here) · ADR-0073 (the model-provider seam the live overlay injects) |

## Context

The live-agent example is the A2UI ladder's last rung (NEXT item 3): a real LLM emitting A2UI over
the wire — prompt → streamed payload → rendered surface → the human interacts → client messages
return → the agent continues. It is the first programmatic realization of the compose→validate loop
the expert harness expresses only procedurally (harness LLD §6 names this wave by name).

Three hard facts shape it, and the demo's whole shape is the reconciliation of them:

1. **`@agent-ui/a2ui` stays zero-dep** (SPEC-N5 / ADR-0062): zero runtime deps except the
   `@agent-ui/components` peer. Any LLM SDK, HTTP server, transport, or API-key handling lives
   ENTIRELY outside the package — in `site/` and/or a `tools/`-style harness. The package exposes only
   pure surfaces (`.`, `./examples`, `./corpus`).
2. **The site is a static Vite MPA.** `dev: vite`, `build: vite build`; ~40 `.html` entries. **A
   browser cannot hold a secret in a DEPLOYED build** — but a gitignored repo-root `.env` (verified
   untracked, `.gitignore:27`) now provisions SIX keys: server-side + browser-exposed (`VITE_`)
   variants for three providers (`ANTHROPIC_API_KEY`/`VITE_ANTHROPIC_API_KEY`, and OpenAI/Gemini). So
   BOTH live paths are provisioned for LOCAL dev: the proxy reads the non-prefixed
   `process.env.ANTHROPIC_API_KEY`; a client-direct path reads `import.meta.env.VITE_ANTHROPIC_API_KEY`.
   Kim provisioning both variants signals the layered combo is the intended shape.
   **The `VITE_` inlining footgun (a hard invariant):** Vite bakes every `VITE_*` var into the client
   bundle at *build* time, so a `VITE_` key referenced by built code is baked into any deployed static
   artifact — a real key exposure. The design must guarantee the backbone is what `build` ships and no
   live overlay ever bakes a key into a deployed bundle.
3. **A live model call cannot be a standing gate.** The repo gates (`check`, `test`, `test:browser`,
   manual `size`) are deterministic and secret-free. A live LLM call is non-deterministic and needs a
   key ⇒ it must not gate CI. So the wiring/round-trip/render path must be provable WITHOUT a live
   call — a deterministic backbone that IS gate-covered, with the live model as an opt-in overlay.

The streaming example (`site/pages/a2ui-stream.ts`) is the precedent one rung down: it uses
`createRenderer()` exactly as a server transport would, streams a committed deterministic seed, and
rides a standing `examples.test.ts` gate. The live-agent demo is that, made real: the stream comes
from a model, not a seed.

The load-bearing risk is coupling the demo to ONE live mechanism. If the page talks directly to a
proxy (or to Anthropic), then changing the mechanism churns the whole page. The design must isolate
the mechanism so the render/round-trip/loop work is shape-independent.

## Decision

**The demo is layered, and the layers meet at one seam — the `AgentTransport` interface.**

1. **`AgentTransport` is the isolation seam.** The page/client consumes ONLY this interface:
   `turn(input) → AsyncIterable<string>` (a stream of A2UI JSONL lines), plus the turn/session input
   types (ADR-0072). Everything about *where the stream comes from* lives behind it. Swapping the
   backbone for the live overlay (or a future BYOK transport) is a one-line construction change with
   **no page edit** — so if Kim later picks a different live mechanism, only that transport + the
   proxy churn, never the SPEC or the page.

2. **The deterministic recorded backbone is the default, and the only thing CI exercises.** A
   `RecordedTransport` replays a committed transcript of real captured turns (prompt → turn-1 A2UI
   stream → the expected client message → turn-2 A2UI stream). Turn-1's payload reuses an existing
   shelf seed (e.g. `generativeFormSeed`), so its validity is already proven by `examples.test.ts`;
   the transcript adds only the turn structure. This is the shape the built static site ships and the
   shape a standing packages-tree test drives through a real `createRenderer()` host — no network, no
   key, fully deterministic (Fork F).

3. **The live overlay is a dev-server proxy — a plain-fetch key-holder, SDK-free.** A Vite
   `configureServer` middleware plugin (added to the site's dev config, NOT the package) reads the key
   from `process.env`, and streams validated A2UI JSONL back to the browser. It calls the Anthropic
   REST API with **plain `fetch`** — **no LLM SDK, no new dependency anywhere** (the SDK would be a
   dependency the constraint forbids in the package and the design avoids entirely). It works only
   under `vite dev`; the built static site ships the backbone alone.

4. **Retrieval + the loop live proxy-side (Fork C).** `retrieve()` needs the corpus records, which
   need the Node `fs-store` shell — so few-shot conditioning and the bounded generate→validate loop
   (ADR-0070) naturally run in the proxy (Node), feeding exemplars into the system prompt (ADR-0071)
   and streaming only a validated payload (ADR-0070) to the browser. The proxy is the key-holder AND
   the corpus-holder AND the loop driver — one server-side concern.

5. **A client-direct transport is provisioned behind the same seam — dev-only, deferred.** A
   `BrowserDirectTransport` (reads `import.meta.env.VITE_ANTHROPIC_API_KEY`; runs the pure loop —
   `retrieve()`/`heal`/`validate` are all pure — plus a provider adapter entirely in the browser;
   `anthropic-dangerous-direct-browser-access`) satisfies the identical `AgentTransport` interface. The
   `.env`'s `VITE_` variant makes it a real provisioned dev path, not a paste-a-key hypothetical.
   Browser-direct CORS is **host-verified (2026-07-04): supported, but Anthropic officially deems it
   dangerous** — it "exposes your secret API credentials in the client-side code." That verdict
   CONFIRMS the proxy as the default and keeps `BrowserDirectTransport` the deferred, dev-only-guarded
   arm (it carries the `VITE_` footgun; it drops in behind the seam with zero page change if Kim wants
   a no-middleware demo).

6. **Every live overlay is dev-only-guarded; the built bundle bakes no key (the `VITE_` footgun,
   closed).** Both the proxy path and the client-direct path are reached ONLY through a dev-only
   dynamic `import()` guarded by `import.meta.env.DEV`, so `vite build` (production) tree-shakes the
   overlay — and with it any `import.meta.env.VITE_*` reference — out of the bundle entirely. The
   default proxy path is doubly safe: it uses the non-prefixed `process.env.ANTHROPIC_API_KEY`, which
   Vite never inlines. A standing build-key-safety gate (SPEC-R3, LLD-C8c) proves the built `dist/`
   carries no key and no `VITE_` key reference.

## Consequences

- **The wave is shape-independent where it matters.** The renderer round-trip, the loop, the prompt
  derivation, the session model, and the page are all written to the seam — one ADR (this one) owns
  the transport/security decision, and if it changes, the rest does not.
- **CI stays deterministic + secret-free.** Only the backbone + the loop's stub-generator unit test +
  the prompt-drift test gate (ADR-0070/0071); the live call never runs in `check`/`test`/`test:browser`
  and has no key to leak.
- **No new dependency, in the package or the repo.** Plain `fetch` to the REST API means even the
  tools/harness side adds no SDK; the zero-dep invariant holds tree-wide.
- **The static built site still demos — and bakes no key.** It ships the recorded backbone — a real
  captured agent→UI→interaction→agent round-trip anyone can replay — so the demo has value without a
  running proxy, and the live overlay is a dev-time upgrade. Because every overlay is dev-only-guarded
  and tree-shaken, `vite build` output carries no `VITE_` key reference; the `VITE_` inlining footgun
  is closed by construction and proven by a standing gate.
- **Both live paths are provisioned, and layered is now the front-runner by Kim's own hand.** The
  `.env` carries both `process.env` and `VITE_` variants for Anthropic — the proxy path and the
  client-direct path are both real for local dev. The proxy stays the safe default (no inlining risk
  at all); client-direct is a provisioned convenience gated on CORS.
- **A host-verify gate stands between design and build** for the upstream API streaming contract and
  the BYOK CORS story (see the decomp `meta.hostVerify`); the design is defensive around both (the
  upstream SSE parsing is isolated in the proxy; the browser sees only clean A2UI JSONL).
- **Stale → re-verify on the build gate:** streaming LLD-C2's `produce()` row (this wave realizes it)
  and NEXT item 3 (mark realized) when the wave ships.

> **Realization note (2026-07-05).** The proxy's key access is `loadEnv(mode, <repoRoot>, '')` merged
> over `process.env`, NOT a bare `process.env[<envKey>]` read as this ADR's Context/Decision prose
> assumed. Vite does not load `.env` into `process.env` (non-`VITE_` vars are kept out of both
> `process.env` and `import.meta.env`), so a `.env`-only key read as unset and the demo degraded to the
> backbone with "no live API key found" even with a valid key present. `loadEnv` runs server-side under
> `apply: 'serve'` only; the decision (server-side key-holder, never the browser, `/status` answers a
> boolean) is UNCHANGED — only the resolution mechanism is refined. End-to-end proven with a real
> Anthropic turn. See LLD §0/§5 + SPEC-R9/N2 (repaired).

> **Realization note (2026-07-04).** `providers.json` is re-read + validated PER REQUEST (the catalog +
> judged shard stay loaded once at server start — they're static). The in-chat switcher is HMR-reloaded
> by Vite from the same file, but the proxy originally read it ONCE at `configureServer`, so a model added
> to the registry (e.g. Claude Haiku 4.5) appeared in the switcher yet the proxy rejected it `400
> unknown-model` — the menu and the PAIR-allowlist drifted. Re-reading per request keeps them in lockstep:
> a registry edit takes effect with no dev-server restart. Dev-only, small file, cheap to reparse; the
> `apply: 'serve'` trust boundary is unchanged.

## Acceptance

- `AgentTransport` exists as a pure zero-dep interface; a grep proves the page imports only it (no
  direct `fetch`/proxy/RecordedTransport-internal import in the page module).
- The `RecordedTransport` + committed transcript drive through a real `createRenderer()` in a standing
  packages-tree test with no network/key; `npm test` green.
- The dev-proxy plugin reads the key from `process.env` only (a grep proves no committed key literal);
  a grep proves no `@anthropic-ai/sdk` import anywhere; with no key set it returns a graceful
  "backbone only" signal; a MANUAL dev run with `ANTHROPIC_API_KEY` set streams a real validated
  payload that renders (never a CI gate).
- **Build-key-safety (the `VITE_` footgun closed):** every `import.meta.env.VITE_*` reference lives
  only inside a live-overlay module reached via a dev-only (`import.meta.env.DEV`) dynamic import (a
  source-level assertion); and a MANUAL `vite build` + grep of `dist/` for the key patterns returns
  zero hits (the `npm run size` manual-gate precedent). `npm run check && npm test && npm run
  test:browser` pass with no key present.
- Swapping `RecordedTransport → LiveProxyTransport` in the page construction requires no other page
  edit (the seam proof).
- The decomp manifest (`a2ui-live-agent.decomp.json`) passes `coverage_check.py --strict` exit 0.

## Alternatives considered

- **(a) Dev-proxy only (no backbone).** Rejected as the whole design: with no deterministic backbone
  the demo can't be gate-covered and the static built site can't demo — it violates constraint 3.
  Adopted as the *overlay* layer.
- **(b) Client-direct (BYOK / `VITE_` key) as the default.** Rejected as default: worse security
  posture (the key is in the page and — the footgun — bakes into any deployed build), and it rests on
  an unverified CORS/browser-direct fact. Now *provisioned* (the `.env`'s `VITE_` variant) and kept
  behind the same seam as a dev-only, CORS-gated alternative, not the primary path.
- **(c) Recorded-transcript replay only ("live-shaped", no live call).** Rejected as the whole design:
  it never proves a *real* model can drive the surface (the rung's entire point). Adopted as the
  *backbone* layer.
- **(d) Layered: backbone always-on + proxy overlay [CHOSEN].** Captures the deterministic,
  gate-covered, static-site-shippable backbone AND a real live call, isolated behind the seam so the
  security/transport decision is one swappable ADR.
- **Couple the page directly to the proxy (no seam).** Rejected: any mechanism change churns the page,
  and the BYOK/other-transport futures become rewrites instead of a new transport impl.
- **Put the live infra (SDK, HTTP) in `@agent-ui/a2ui`.** Rejected: violates the zero-dep invariant
  (SPEC-N5/ADR-0062) — the package exposes only pure surfaces; the live infra is site/tools-scoped.
