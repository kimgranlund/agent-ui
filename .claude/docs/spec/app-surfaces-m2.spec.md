# SPEC — Agent-App Surfaces M2 (the agent-native pair: surface-host + conversation)

> Status: proposed · v0.1 · 2026-07-12 · Layer: SPEC (execution contract)
> Refines: [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) — **PRD-G1** (down-payment via the reference-app re-host), **PRD-G3** (agent content appears with no app-written renderer/transport glue), **PRD-G4** (present a multi-turn conversation without hand-building it), **PRD-G6** (fleet DoD + layering); realizes the ratified **PRD-D2** (host chrome contains untrusted, catalog-bounded content) and **PRD-D3** (`@agent-ui/app` apex; the `@agent-ui/a2ui` dependency declared-but-unexercised at M1 is EXERCISED here).
> Refined by: `../lld/app-surfaces-m2.lld.md` (implementation). Decomposition: [`../decompositions/app-surfaces-m2.decomp.json`](../decompositions/app-surfaces-m2.decomp.json). Genuine forks (composition · transport boundary · narration/disclosure split · reference-app scope) are recorded, not self-ratified, in [`../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md`](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) (proposed) — this SPEC states the recommended requirement pending Kim's ruling, per that ADR.
> Altitude: owns the **M2 behavior contract** — the `ui-surface-host` mount/stream seam, the `ui-conversation` thread/composer/narration behavior, their composition relationship, and the transport boundary. Internal build order + file map are the LLD's. This SPEC scopes **M2 only** (PRD-G3, PRD-G4); the tool-call/result surface (PRD-G5) is M3 and out of this SPEC; `ui-split`/master-detail/settings (PRD-G7/G8) are M4 and already specced (`app-surfaces-m4.spec.md`).
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define the two agent-native app-tier primitives that close PRD-G3 and PRD-G4: **`ui-surface-host`** — a single mount/stream seam wrapping `@agent-ui/a2ui`'s `RendererHost`, so agent-emitted A2UI content appears in a running app with zero app-written renderer wiring — and **`ui-conversation`** — a thread + composer + per-turn narration primitive presenting a multi-turn agent conversation with zero app-written chat chrome. Both compose the M1 shell's region model; `ui-conversation` composes `ui-surface-host` internally (§3.3). Neither primitive calls a model, owns a transport, or holds provider config (§3.4) — that stays app-owned, per PRD §3's non-goal ("a backend / agent runtime / transport implementation").

M2 pays down the two site embryos this SPEC generalizes: `site/lib/canvas-surface.ts` + the ad hoc `createRenderer()`/`host.mount()` wiring in `a2ui-live.ts` (→ `ui-surface-host`), and `site/lib/surface-registry.ts` + `site/lib/ask-registry.ts` + `a2ui-chat.ts`'s hand-built thread/narration/routing (→ `ui-conversation`). Both site pages are re-hosted as the acceptance proof (§3.5).

## 2. Definitions

- **Surface** — an A2UI surface as defined by `a2ui-runtime.spec.md` §2: an isolated UI context keyed by `surfaceId`.
- **`ui-surface-host`** — a structural (non-form-associated) `UIElement` owning ONE `RendererHost` lifecycle: mount, line-by-line `ingest`, `finalize`, `dispose`, and the outbound client-message callback. It owns *only* the mount + stream (§3.2) — never the produce loop that calls a model.
- **`ui-conversation`** — a structural `UIElement` presenting a scrolling thread of turns (user / agent / system), a composer, and, per agent turn, a narration strip + zero-or-more inline `ui-surface-host` instances for the surfaces that turn's lines target. Driven imperatively by an **agent turn handle** (§3.4) the consuming app's own transport loop feeds line-by-line.
- **Agent turn handle (`AgentTurnHandle`)** — the imperative per-turn object `ui-conversation.beginAgentTurn()` returns; the app's turn loop calls its methods as its own transport yields lines. Not a DOM type; a plain object contract (§4).
- **Transport / produce loop** — the model-calling machinery (`packages/agent-ui/a2ui/tools/agent/produce.ts`, `agent-transport.ts`) that turns a user intent into a stream of validated A2UI JSONL lines. Node/site-scoped, never a package export of `@agent-ui/a2ui` (SPEC-N1 of `a2ui-runtime.spec.md`'s sibling harness posture) — **out of scope for both M2 primitives** (§3.4).

---

## 3. Requirements

### 3.1 Package boundary (the a2ui dependency, now exercised)

**SPEC-R1 — `@agent-ui/app`'s declared `@agent-ui/a2ui` dependency is exercised, DAG unchanged.** `ui-surface-host` MUST import `@agent-ui/a2ui` **only** through its public barrel (`createRenderer`, `RendererHost`, `A2uiClientMessage` — the same three names the site embryos already import; no deep `packages/**/src` import). The M1 layering trip-wire (`app/src/layering.test.ts`) MUST continue to pass with `@agent-ui/a2ui` now genuinely imported (not just declared), and its negative control MUST still prove an upward import from `components`/`a2ui` into `app` goes red. No new package, no new DAG node. *(→ PRD-G6, PRD-D3)*
- **AC1** *Given* `app/src/layering.test.ts`, *when* it runs after `ui-surface-host` lands, *then* it stays green with `@agent-ui/a2ui` now a real, resolved import (not merely declared in `package.json`).
- **AC2** *Given* a grep of `packages/agent-ui/components/src` and `packages/agent-ui/a2ui/src`, *when* run, *then* neither imports `@agent-ui/app` (the apex stays un-imported).

### 3.2 `ui-surface-host` — the mount/stream seam

**SPEC-R2 — One `RendererHost` per instance; mount/ingest/finalize/dispose, never the produce loop.** `ui-surface-host` MUST extend `UIElement` (structural, `formAssociated: false`, light-DOM default) and internally construct exactly one `@agent-ui/a2ui` `RendererHost` at connect, generalizing `canvas-surface.ts`'s checkered stage/translate-centered-surface pair as its own light-DOM structure. It MUST expose public imperative methods equivalent to `RendererHost`'s own surface (`ingest(line)`, `finalize()`, `dispose()`) — mirroring the ADR-0023 public-method-seam precedent, since progressive line-by-line streaming has no natural prop/attribute shape — and a callback-registration method `onClientMessage(cb)` (not a DOM `CustomEvent`; §3.4 explains why). It MUST NOT call a transport, hold a model/provider reference, or read an API key. A root `ui-column` MUST be stretched to fill the artboard after every `finalize()` (the `applyRootStretch` behavior, unchanged from the embryo). *(→ PRD-G3)*
- **AC1** *Given* a fresh `ui-surface-host`, *when* a valid A2UI JSONL stream is `ingest()`-ed line by line and `finalize()`-ed, *then* the rendered surface appears inside the host exactly as `a2ui-live.ts`'s current canvas renders it today (parity, browser whole-shape).
- **AC2** *Given* `dispose()`, *when* called, *then* the underlying `RendererHost` is disposed (no retained signals/listeners — the `RendererHost.dispose()` contract, `a2ui-runtime.spec.md` SPEC-N3) and the host's own DOM subtree is torn down.
- **AC3** *Given* a rendered control inside the host emits an action/response/error, *when* it fires, *then* the registered `onClientMessage` callback receives it — proven by a stub callback in a jsdom test.
- **AC4** *Given* the source of `ui-surface-host.ts`, *when* grepped, *then* it imports nothing from `packages/agent-ui/a2ui/tools/**` (the produce loop / `AgentTransport` types) — only the public `@agent-ui/a2ui` barrel.

**SPEC-R3 — Standalone-usable; no assumption of a `ui-conversation` ancestor.** `ui-surface-host` MUST work when composed directly into an app-shell region (a2ui-live's persistent-canvas shape) or nested inside `ui-conversation` (an inline per-turn surface, §3.3) — identical behavior either way; it holds no reference to any ancestor. *(→ PRD-G3, PRD-G6)*
- **AC1** *Given* a `ui-surface-host` mounted directly in a `ui-app-shell-region`, *when* rendered, *then* it behaves identically to one composed inside `ui-conversation`'s internal registry (same class, same public surface, no conditional behavior keyed on ancestry).

### 3.3 `ui-conversation` — thread, composer, narration, per-turn surfaces

**SPEC-R4 — The thread renders opaque turns; the DOM is never author-composed.** `ui-conversation` MUST extend `UIElement` (structural, `formAssociated: false`, light-DOM default) and render its own internal thread (user/agent/system bubbles) — unlike `ui-app-shell-region`, the thread's DOM is **not** a composition surface the developer authors; it is driven entirely through the imperative API (§4). MUST include a composer (text input + submit affordance) and MUST scroll-follow new content only when the user was already near the bottom (the `isNearLogBottom`/`tailFollowLog` heuristic from `a2ui-chat.ts`, generalized unchanged — sampled once per turn, before that turn's own content grows the log, never re-sampled reactively mid-turn). *(→ PRD-G4)*
- **AC1** *Given* `addUserMessage(text)`, *when* called, *then* a user bubble appears with that text, unescaped/unmodified.
- **AC2** *Given* the log scrolled to the bottom, *when* a new turn's content is appended, *then* the log follows to the new bottom; *given* the log scrolled away from the bottom (reading history), *when* a new turn appends, *then* the scroll position is preserved (the guard's own biting negative control — a naive reactive-scroll-listener re-implementation regresses this, per the `a2ui-chat.ts` banner already on record).

**SPEC-R5 — The reply affordance is a callback, not a synthesized event.** `ui-conversation` MUST expose `onSubmit(cb: (text: string) => void)` for the composer's reply affordance. This is a **deliberate divergence from the closed six-event vocabulary** (`change · input · select · open · close · toggle`, `references/naming.md` §4): a chat submission is not a form commit, a selection, or a disclosure toggle, and inventing a seventh event name is an ADR-gated admission this SPEC declines to request. Callback registration follows the shipped `RendererHost.onClientMessage` precedent exactly (a non-standard signal registered imperatively, never a `CustomEvent`). *(→ PRD-G4, `references/naming.md` §4)*
- **AC1** *Given* a registered `onSubmit` callback, *when* the user submits non-empty composer text (click or Enter), *then* the callback fires exactly once with the trimmed text, and the composer clears.
- **AC2** *Given* no `onSubmit` callback registered, *when* the user submits, *then* nothing throws (a no-op consumer is legal — the element does not require a listener to render).

**SPEC-R6 — Per-turn narration, honest by construction.** Each agent turn MUST render a narration strip composing the shipped `ui-status-stream` (never a bespoke live-region), categorizing lines by the same envelope-key inspection technique already proven in `a2ui-chat.ts`'s `categoryOf` (open/restructure/react/close), and MUST render the turn's own `note` (if supplied by the caller) as-is — **never a fabricated sentence** (ADR-0088's honest-narration law; the `summarize()` fallback tally is the only synthesized text, and it states counts, never invented prose). Narration itself ships unconditionally (no opt-out); whether the raw-wire disclosure some consumers also want is opt-in is [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F3 (proposed) — see the `disclosure` prop, §4. *(→ PRD-G4, ADR-0088)*
- **AC1** *Given* an agent turn whose lines include one `createSurface` and one `updateDataModel`, *when* the turn finalizes, *then* the narration strip shows two DISTINCT category entries in emission order, each transitioning pending → active → done.
- **AC2** *Given* a turn handle's `setNote(text)`, *when* the turn finalizes, *then* that exact text renders as the turn's note; *given* no note is set, *then* a factual message-kind tally renders instead (never an invented justification).
- **AC3** *Given* a turn that throws (the handle's `fail(message)` called), *when* it happens, *then* the narration strip truncates cleanly (a `finally`-scoped `finalize()`, never left dangling) and a system bubble surfaces the failure.

**SPEC-R7 — `ui-conversation` composes `ui-surface-host` per open surface (the registry pattern promoted; the recommended answer to [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F2, proposed).** For any agent-turn line carrying a `surfaceId`, `ui-conversation` MUST route it to a `ui-surface-host` instance keyed by that id — generalizing `surface-registry.ts`'s per-surface lifecycle (itself a generalization of `ask-registry.ts`, ADR-0097 §2) as the element's OWN internal mechanism, not a site-land helper. A **fresh** `surfaceId` MUST mount a new `ui-surface-host` inline in that turn's own bubble; a line targeting a **known** `surfaceId` (open or closed) MUST route to that surface's original `ui-surface-host`, at its original bubble — never a new mount for the same id (persistent identity across turns). A `deleteSurface` line MUST `dispose()` that one surface's host and leave a **visible** "Closed." annotation on its bubble — history is never silently removed. This composition is possible edge-to-edge only because [`ADR-0128`](../adr/0128-renderer-structural-resend-reconciliation.md) (accepted) now makes a resent, already-mounted container's record reconcile correctly; M2's contracts assume that fix is in place. *(→ PRD-G3, PRD-G4)*
- **AC1** *Given* two turns, the second resending `updateComponents` against a surface the first turn created, *when* both are ingested, *then* the SAME `ui-surface-host` instance (not a new mount) reflects the resent state, at the first turn's own bubble.
- **AC2** *Given* a `deleteSurface` line, *when* ingested, *then* that surface's host is disposed and its bubble carries a visible, non-removable "Closed." note; a later line re-targeting the same id is recognized as KNOWN (routes to the same, now-closed, record) and is not silently dropped without trace.

### 3.4 The transport boundary (per [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F1 — proposed, Kim's ruling pending; this SPEC states the recommended requirement)

**SPEC-R8 — Neither primitive owns a transport, a produce loop, or provider config.** `ui-surface-host` and `ui-conversation` expose **no** transport/provider-shaped type in their public API — no `AgentTransport`, no `AgentProvider`, no API-key or provider-selection prop. The app's own turn loop (today: `site/lib/agent-runtime.ts`'s re-export shim over `packages/agent-ui/a2ui/tools/agent/*`, per ADR-0069/0073's recorded-default + dev-proxy security posture) calls its own transport, iterates the resulting `AsyncIterable<string>` itself, and feeds each line to the primitives via their imperative surfaces (`ui-surface-host.ingest()` directly, or `ui-conversation`'s `AgentTurnHandle.ingestLine()`, §4). This is the recommended resolution (ADR-0129 F1) to PRD §5's open question ("does the canvas/surface-host fully own the produce loop… or only mount + stream"): **only mount + stream** — the produce loop, healing, and provider selection stay entirely app/site-owned code, never promoted into a package. If ADR-0129 F1 is ratified differently, this requirement is amended to match before build. *(→ PRD-G3, PRD-G4, PRD-D2 — the trusted frame never delegates its transport/security posture to composed content)*
- **AC1** *Given* the public type surface of `@agent-ui/app`'s `ui-surface-host` + `ui-conversation` exports, *when* read, *then* no exported type or prop shape names `AgentTransport`/`AgentProvider`/an API key/a provider-selection field.
- **AC2** *Given* the re-hosted `a2ui-live`/`a2ui-chat` pages (§3.5), *when* their source is read, *then* the transport/produce-loop call sites are UNCHANGED from today (still `site/lib/agent-runtime.ts`) — only the rendering/thread chrome around them is replaced.

### 3.5 The reference-app down-payment

**SPEC-R9 — Both site embryos re-expressed; the generalization source retired (the recommended answer to [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) F4, proposed).** `site/pages/a2ui-live`'s persistent canvas MUST be re-expressed on `ui-surface-host` (replacing `site/lib/canvas-surface.ts` + its bespoke `createRenderer()`/`host.mount()` wiring), and its chat pane + inline "ask" mounting (ADR-0097 §2) MUST be re-expressed on `ui-conversation`. `site/pages/a2ui-chat` MUST be re-expressed on `ui-conversation` in full (it has no separate canvas — every surface mounts inline). Following both migrations, `site/lib/surface-registry.ts` and `site/lib/ask-registry.ts` — now fully subsumed by `ui-conversation`'s internal mechanism (SPEC-R7) — MUST be deleted; carrying two parallel, independently hand-built implementations of the same lifecycle after M2 ships the primitive would itself violate PRD-G6's coherence bar. *(→ PRD-G1, PRD-G4, PRD-G6)*
- **AC1** *Given* the re-hosted pages, *when* `npm run check` (+ `check:site`), `npm run build`, `npm test`, and `npm run test:browser` run, *then* all exit 0/green.
- **AC2** *Given* `git diff --stat`, *when* read after the migration, *then* net bespoke-chrome/registry LOC across `site/pages/a2ui-live.*`, `site/pages/a2ui-chat.*`, `site/lib/canvas-surface.*`, `site/lib/surface-registry.*`, and `site/lib/ask-registry.*` is **negative**, and the latter three files no longer exist.
- **AC3** *Given* the re-hosted pages in the browser, *when* compared to their pre-re-host behavior, *then* every existing acceptance (a2ui-live's `[chat | canvas]` layout and ask-freeze semantics; a2ui-chat's persistent per-surface identity, narration, and wire disclosure if enabled) is preserved.

### 3.6 Catalog invisibility

**SPEC-R10 — Both elements are structurally catalog-invisible, no allowlist entry.** `ui-surface-host` and `ui-conversation` are app-tier chrome living in `@agent-ui/app`, never `@agent-ui/components` — they fall **outside** the a2ui whole-fleet catalog gate's scan scope by construction (the gate enumerates `@agent-ui/components` descriptors only), the same way `ui-app-shell`/`ui-master-detail`/`ui-settings` needed **no** `EXCLUSION_ALLOWLIST` entry at M1/M4. Both are also barred by PRD-D2 from ever being agent-emittable (the trusted frame is never agent-authored). *(→ PRD-D2, PRD-G6)*
- **AC1** *Given* `a2ui/src/catalog/default/index.test.ts`'s `FLEET_TYPES`/`EXCLUSION_ALLOWLIST` residue guard, *when* it runs after M2 ships, *then* it is unaffected (green, unchanged) — no new allowlist row is needed or added.

### 3.7 Fleet definition-of-done

**SPEC-R11 — The M1 bar, extended to two elements.** Both `ui-surface-host` and `ui-conversation` MUST ship a `{name}.md` descriptor (ADR-0004) with the contract↔props trip-wire green, survive `forced-colors: active`, pass an independent `component-reviewer` pass at **COMPOSE ≥4 AND REALIZE ≥4** before commit, and the package's `npm run size` line-item MUST be re-measured and re-based at M2 kickoff (current `@agent-ui/app` marginal: 24829 B gz within a 26624 B gz budget — headroom is insufficient for two new elements; the ceiling is re-set against a measured baseline before the first M2 commit, the ADR-0040/0049 discipline). *(→ PRD-G6)*
- **AC1** *Given* each descriptor, *when* the contract↔props trip-wire runs, *then* it matches `finalize(UISurfaceHostElement)`/`finalize(UIConversationElement)` exactly.
- **AC2** *Given* `forced-colors: active`, *when* either element renders (browser), *then* its own chrome (composer, narration strip, "Closed." annotations) remains legible.
- **AC3** *Given* `npm run size`, *when* run after M2, *then* the `@agent-ui/app` line-item reports within its re-based budget, and a tree-shake probe shows importing `ui-surface-host` alone (without `ui-conversation`) drags only it + `@agent-ui/a2ui`'s real deps.

---

## 4. Typed contracts (behavioral — signatures illustrative; internals are the LLD's)

```ts
// ui-surface-host — structural UIElement (formAssociated: false)
interface UISurfaceHostElement {
  label?: string                                    // optional accessible name for the artboard region
  ingest(line: string): void                        // one validated A2UI JSONL line -> progressive paint
  finalize(): void                                   // end of a batch; stretches a root ui-column (applyRootStretch)
  dispose(): void                                    // tears down the RendererHost; no retained signals/listeners
  onClientMessage(cb: (m: A2uiClientMessage) => void): void   // callback, NOT a CustomEvent (SPEC-R5's rationale applies identically)
}

// ui-conversation — structural UIElement (formAssociated: false)
interface UIConversationElement {
  disclosure: boolean                               // reflected; default false — an opt-in raw-wire <details> dump per turn (dev/debug affordance, SPEC-R7's sibling non-goal: OFF by default in product surfaces)
  addUserMessage(text: string): void
  beginAgentTurn(): AgentTurnHandle
  onSubmit(cb: (text: string) => void): void         // the reply affordance (SPEC-R5)
  onClientMessage(cb: (m: A2uiClientMessage) => void): void   // bubbled from whichever composed ui-surface-host emitted it
  reset(): void                                      // disposes every open surface host, clears the thread
}

// The imperative per-turn driver the APP'S OWN transport loop calls — NOT a DOM type (SPEC-R8)
interface AgentTurnHandle {
  ingestLine(line: string): void                     // routes by surfaceId to a fresh/known ui-surface-host, or narrates a no-surface line
  setNote(text: string): void                        // the turn's own prose note (ADR-0088); rendered at finalize
  finalize(): void                                    // ends narration, settles every surface host this turn touched
  fail(message: string): void                         // SPEC-R6 AC3 — a thrown turn; narration truncates, a system bubble surfaces the message
}
```

- **Events:** none required at M2 for either element — both non-standard signals (submission, client messages) are callback-registered (SPEC-R5), matching the shipped `RendererHost.onClientMessage` precedent rather than requesting a seventh DOM-event vocabulary member.
- **No native form elements; ARIA via `ElementInternals` only** (CLAUDE.md invariants).

## 5. Non-functionals

- **Cross-engine truth (gate):** SPEC-R2/R4/R6/R7/R11 browser assertions pass in **Chromium AND WebKit**.
- **Budget (gate):** the `@agent-ui/app` marginal size line-item within the M2-kickoff re-based budget (SPEC-R11 AC3).
- **Layering (gate):** SPEC-R1's exercised-not-widened DAG invariant holds as a standing trip-wire.
- **Security posture unchanged (gate):** SPEC-R8 AC1/AC2 — no transport/provider shape leaks into either primitive's public surface; the recorded-default + dev-proxy posture (ADR-0069/0073) is untouched by this milestone.

## 6. Traceability (this SPEC → PRD)

| SPEC-R | Requirement | Traces to |
|---|---|---|
| SPEC-R1 | `@agent-ui/a2ui` dependency exercised, DAG unchanged | PRD-G6 · PRD-D3 |
| SPEC-R2 | `ui-surface-host` mount/ingest/finalize/dispose | PRD-G3 |
| SPEC-R3 | standalone-usable, no ancestor assumption | PRD-G3 · PRD-G6 |
| SPEC-R4 | opaque thread, scroll-follow | PRD-G4 |
| SPEC-R5 | reply affordance as callback (event-vocabulary discipline) | PRD-G4 · `naming.md` §4 |
| SPEC-R6 | honest per-turn narration (`ui-status-stream`) | PRD-G4 · ADR-0088 |
| SPEC-R7 | `ui-conversation` composes `ui-surface-host` per surface | PRD-G3 · PRD-G4 |
| SPEC-R8 | no transport/produce-loop/provider ownership | PRD-G3 · PRD-G4 · PRD-D2 |
| SPEC-R9 | both site embryos re-hosted, generalization source deleted | PRD-G1 · PRD-G4 · PRD-G6 |
| SPEC-R10 | catalog-invisible by construction, no allowlist entry | PRD-D2 · PRD-G6 |
| SPEC-R11 | fleet DoD, re-based budget | PRD-G6 |

_All eleven requirements trace to a ratified PRD goal; PRD-G3 and PRD-G4 (M2's charter) are both fully covered. PRD-G5/M3 and PRD-G7/G8/M4 are deliberately out of this SPEC (M4 already specced separately)._
