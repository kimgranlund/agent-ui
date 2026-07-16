---
doc-type: ticket
id: tkt-0052
status: done
date: 2026-07-14
owner:
kind: feature
size: big
---
# TKT-0052 — `ui-agent-admin` gets a real, DEV-only live-model overlay (ADR-0136)

## Summary
`agent-admin.html`'s chat canvas currently only ever runs `runStubAgentTurn` — a deterministic stub
(ADR-0131) enriched by TKT-0043's real model list + default instruction content, but never an actual
model call. Per [ADR-0136](../adr/0136-agent-admin-dev-only-live-model-overlay.md) (proposed, this
feature-intake), give it a real live-model path: reuse the ALREADY-BUILT `a2ui-live.ts` pattern — the
`AgentTransport` seam (SPEC-R1) defaulting to the deterministic path, with a `import.meta.env.DEV`-gated
dynamic-import overlay swapping in a genuine call through the already-mounted `dev-proxy-plugin.ts` trust
boundary (ADR-0073) — rather than inventing a second live-call mechanism or lifting ADR-0131 cl.4/7's
production-path guarantee.

This is explicitly NOT: adding `@agent-ui/router` (Kim's clarifying-round answer ruled this out), and NOT
an always-on live call reachable from the publicly deployed static docs site (ADR-0136 Fork 1).

## Acceptance
- The static build (`vite build` / `site/public`) is unchanged: `agent-admin.ts`'s `#handleSubmit`
  defaults to `runStubAgentTurn`, no live-call code reaches the built bundle (a tree-shake/bundle-content
  assertion, the same discipline `a2ui-live.ts`'s own SPEC-N2 gate already proves for its own overlay).
- Under `import.meta.env.DEV`, sending a message from `agent-admin.html`'s chat canvas dispatches a REAL
  turn through `AgentTransport` via the existing `dev-proxy-plugin.ts` mount (no second proxy stood up,
  no duplicated provider-key handling) — the reply is the model's actual output, not the stub string.
- The live turn's request is built from `agent-admin`'s own current, real config: the selected
  `SUPPORTED_MODELS` id (TKT-0043) and `composeSystemPrompt`'s current composed output (ADR-0132) — a
  config change (model switch, prompt-section edit) committed through the existing `SettingsStore` path
  is reflected in the very next live turn, same fresh-read law the stub already follows.
- A network/provider failure (missing key, disallowed `{provider, model}` pair, proxy error) degrades
  visibly in `ui-conversation` — an explicit error state, never a silently-swallowed failure and never a
  crash.
- Switching the model mid-conversation (via the settings pane) is reflected on the NEXT turn only — no
  retroactive rewrite of prior turns' history.
- `npm run check && npm test` stay green; a `component-reviewer` (or equivalent) pass runs before this
  ships, matching the ADR-0131 precedent of an independent review before a build of this shape merges.

## Links
- [ADR-0136](../adr/0136-agent-admin-dev-only-live-model-overlay.md) — the ratified fork (dev-only,
  reuse-not-invent) this ticket builds to; carries the Forks-ruled detail this ticket's Acceptance
  summarizes.
- [ADR-0131](../adr/0131-agent-admin-ui-scope-and-composition.md) — amended (narrowed to the
  production/default path), not reversed.
- [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md) — the composed-prompt +
  capability-entry architecture a live turn must project into whatever request shape the seam expects.
- [ADR-0073](../adr/0073-a2ui-live-model-provider-seam.md) — the trust-boundary law (`dev-proxy-plugin.ts`
  holds the key server-side; the browser never does) this reuses verbatim.
- [ADR-0135](../adr/0135-agent-harness-config-schema-and-prompt-files.md) — `agent-config-schema.ts`'s
  `liveAgentConfigSchema`/`resolveProduceOptions`, a candidate mechanism the earned LLD may project
  `agent-admin`'s config onto (built for A2UI Chat's config shape, not `agent-admin`'s Entry-based one —
  the mapping is this ticket's own open question, not assumed to be a drop-in fit).
- [TKT-0043](tkt-0043-agent-admin-model-selector-and-default-instructions.md) — the real model list +
  default instruction content this ticket's live turn now actually exercises (previously only cited by a
  stub).
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (`#handleSubmit` — the construction
  site that gains the DEV-only swap).
- `site/pages/a2ui-live.ts` (LLD-C9/SPEC-R10) + `packages/agent-ui/a2ui/tools/agent/agent-transport.ts`
  (SPEC-R1, the `AgentTransport` seam) + `dev-proxy-plugin.ts` (ADR-0073) — the mechanism this reuses,
  not reinvents.

## Scope/Open
- **The exact `agent-admin` config → seam request-shape mapping is NOT resolved by this ticket.**
  `AgentTransport`'s `TurnInput`/`produce()`'s `ProduceOptions` were built for A2UI Chat's config shape
  (`mode`/`k`/`maxRounds`/`miniSkillCap`, ADR-0135) — `agent-admin`'s shape is different (a flat
  name/model/temperature/toolsEnabled config plus five Entry-list instantiations, ADR-0132). Whether
  `agent-admin` reuses `liveAgentConfigSchema`/`resolveProduceOptions` directly, adapts them, or needs its
  own resolver is a build-time LLD question (ADR-0136 names this as earning its own LLD) — not decided
  here.
- **Whether the four capability-entry kinds (skills/workflows/resources/tools) get real wire
  representation once live, or stay display-only/stub-cited forever, is explicitly unresolved**
  (ADR-0136 Fork 3) — `AgentTransport`/`produce()` has no existing concept for them. Whoever builds this
  decides, with full context; this ticket only names the gap so it isn't silently dropped or silently
  invented mid-build.
- **Streaming vs. single-shot turn rendering** is not specified — `a2ui-live.ts` streams A2UI JSONL into
  a real surface; `agent-admin`'s reply is prose into `ui-conversation`'s `setNote`/`finalize()`. Whether
  the live reply streams token-by-token or arrives as one `finalize()` call is a build-time choice, not
  pinned here.
- **Session/turn history across `ui-conversation`'s existing turns** — whether prior turns are replayed
  into the live request (multi-turn context) or each turn is stateless (matching the stub's own current
  behavior, which carries no history) is unresolved; the Acceptance criterion above only pins that a
  model SWITCH doesn't retroactively rewrite past turns, not the history question itself.
- **Error/loading UX's exact shape** (a toast, an inline `ui-conversation` note, a retry affordance) is
  left to the build — the Acceptance criterion only requires SOME visible, non-crashing degradation.
- **A real `system-decompose` manifest pass (matching the ADR-0135/`coverage_check.py` precedent) was NOT
  run for this intake** — ADR-0136 applied the two-plane lens inline instead, given the deepest unknowns
  (the mapping question above) are better decomposed with full build context. Recommend the build
  dispatch run it properly before authoring the LLD.

## Findings

### 2026-07-15 — built, independently reviewed (GO), two follow-up findings fixed, ticket closes

**Decompose + LLD.** `tkt0052-planner` ran `system-decompose` (technical-architecture, 13 nodes/20
actions/24 hosts/15 edges, `coverage_check.py` clean at exit 0 and `--strict`) and authored
`.claude/docs/lld/agent-admin-live-model-overlay.lld.md` (components `ALM-C1..C9`). It corrected an
imprecision in ADR-0136's own Fork 2 prose: the reused surface is `AgentTransport.stream()`, not
`produce()` — `produce()` is the A2UI-generation loop with no injection point for a caller system
prompt, and would try to heal/validate agent-admin's prose as invalid A2UI JSONL. The LLD resolved
all four Scope/Open questions: config→request mapping (a new app-local `AdminTurn`/`AdminTurnRequest`
seam, NOT `liveAgentConfigSchema`/`resolveProduceOptions` — wrong knobs, wrong config shape);
capability-kind wire representation (system-prompt projection — `composeLiveSystemPrompt`, byte-identical
to `composeSystemPrompt` when no capability entry is enabled); streaming (single-shot, buffered
server-side); session history (a new private `#history` field on `UIAgentAdminElement`, appended on
both the stub-success and live-success paths).

**Build.** `tkt0052-builder` implemented the LLD across 8 files: `agent-admin-schema.ts` (new seam
types), `entries.ts` (`composeLiveSystemPrompt`), `agent-admin.ts` (`agentTurn` as a third non-reflected
prop, `#history`, the live/stub fork in `#handleSubmit`), `agent-admin.md` (descriptor refresh),
`providers-config.ts` (`providerForModel`), `dev-proxy-plugin.ts` (`resolveChatDispatch` + the `/chat`
POST branch, inserted before the generic POST catch-all), `site/pages/agent-admin.ts`
(`wireLiveOverlay`, DEV-gated dynamic import, mirroring `a2ui-live.ts`'s own ordering verbatim), and new
`site/lib/admin-live-runner.ts` (`createAdminAgentTurn`, re-exports `probeLive`). New/extended tests:
`entries.test.ts`, `chat-route.test.ts`, `agent-admin.test.ts`, `site/pages/agent-admin.test.ts` (the
SPEC-N2 source-level tree-shake gate, mirroring `a2ui-chat.test.ts:218`'s precedent, plus the
`SUPPORTED_MODELS`↔`providers.json` lockstep trip-wire).

I independently re-verified rather than trusted the build: re-ran `npm run check`, the specific
new/extended suites (61 tests), `npm run size`, the full jsdom suite, AND personally reproduced the
builder's own claimed SPEC-N2 mutation-check by injecting a real static import of
`admin-live-runner.ts` at module scope in `site/pages/agent-admin.ts`, confirming the tree-shake test
genuinely fails, then reverting and confirming green again.

**Independent review** (`tkt0052-review-1`, fresh-context `code-reviewer`): **GO**. All 6 Acceptance
criteria confirmed met with file:line citations; all 7 critical properties I flagged for independent
verification held. 0 critical/high, 1 MEDIUM, 4 LOW findings:
- **MEDIUM-1 — fixed.** `dev-proxy-plugin.ts`'s `/chat` route destructured the parsed body via a raw
  type cast with zero runtime validation — a malformed body (missing `messages`, or `system`/`model`
  of the wrong type) would sail into `provider.stream()` and surface as a 500 rather than a
  deterministic 400. Fixed by adding `isChatBody` (a pure, exported guard beside `resolveChatDispatch`)
  and a 400 `bad-request` short-circuit before dispatch. Covered by 4 new cases in `chat-route.test.ts`.
- **LOW-3 — fixed.** `admin-live-runner.ts` returned `''` for a 200 response whose `text` field wasn't
  a string, rendering a malformed reply as a silently-successful empty turn — brushing against the
  ticket's own "never a silently-swallowed failure" criterion. Fixed to throw instead. Covered by new
  `site/lib/admin-live-runner.test.ts` (3 cases: success, non-2xx `{error}` surfacing, malformed-200
  throw), following the `feed-live-transport.test.ts` stub-fetch precedent.
- **LOW-2, LOW-4 — accepted as-is**, per the reviewer's own assessment: unbounded stub-arm `#history`
  growth is negligible-scale and LLD-sanctioned; the `/chat` route-prefix match being technically loose
  matches the pre-existing `/status` route's own idiom, not a new inconsistency.
- **LOW-5 — a staging-hygiene note, not a code fix.** The reviewer flagged that the working tree
  bundles a concurrently-active session's own uncommitted edits (TKT-0045/0048/0049/0050) into the same
  files this ticket touched (`agent-admin.ts`, `entries.ts`, `agent-admin.test.ts`,
  `agent-admin.browser.test.ts`) — informs how this ticket's own commit must be staged (isolated hunks
  only), not a defect in the build itself.

**Post-fix re-verification.** `npm run check` green (tsc + check:site + check:tools). The two new/
extended suites (`chat-route.test.ts`, `admin-live-runner.test.ts`, `site/pages/agent-admin.test.ts`):
14/14 passing. Full `npm test`: 6198/6200 assertions passing; the 2 non-passing files
(`theme-provider-build-fixture.test.ts`, `sitemap.test.ts`) are unrelated committed-fixture drift driven
by the concurrent session's own uncommitted `site/pages/agent-admin.ts` edits (confirmed via
`git diff HEAD --stat` — these two fixture files themselves carry no uncommitted changes; they fail
because a *page* they snapshot changed underneath them), not by anything TKT-0052 built.

**Separately discovered, out of scope, NOT fixed here:** running the full suite surfaced ~660–840
uncaught `TypeError: this.internals.setFormValue is not a function` exceptions during
`agent-admin.test.ts`'s teardown (thrown from `UISwitchElement`/`UITextareaElement`'s
`connectedCallback` via `dom/form.ts:174`) — every individual assertion in the file still passes
(37–45/37–45), but the exceptions make vitest's own process exit non-zero. Verified via an isolated
`git worktree` checkout of committed `HEAD` (no uncommitted changes from this ticket or the concurrent
session applied) that this is a **pre-existing defect already on `main`**, unrelated to this build — a
fleet-wide `dom/form.ts`/`ElementInternals` jsdom-cleanup issue, not something TKT-0052 introduced or
is positioned to fix safely (cross-cutting kernel file, real regression surface, no reviewer available
right now — the TKT-0051 precedent for this exact judgment call). Recommend a follow-up bug ticket.

**Closed `done`.** All 6 Acceptance criteria met and independently verified; both real review findings
fixed and re-verified; the three accepted-as-is findings are sound per the reviewer's own assessment.

