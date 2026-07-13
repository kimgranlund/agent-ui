# LLD — Agent-App Surfaces M2 (surface-host + conversation)

> Status: proposed · v0.1 · 2026-07-12 · Layer: LLD (implementation plan)
> Implements: [`../spec/app-surfaces-m2.spec.md`](../spec/app-surfaces-m2.spec.md) (`SPEC-R1…R11`). Refines PRD-G3/G4 (ratified), PRD-D2/D3.
> Decomposition: [`../decompositions/app-surfaces-m2.decomp.json`](../decompositions/app-surfaces-m2.decomp.json) — nodes n1…n5 ≈ the components below. Build-order edges are the decomposition's.
> Altitude: owns **how M2 is built** — file map, concrete interfaces, per-component failure/edge handling, and the build sequence. Behavior is the SPEC's; this doc never re-derives it. **Open forks that need Kim's ruling are called out in §8 and carried into [`ADR-0129`](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) (proposed) — this LLD recommends but does not self-ratify them.**

## 1. Component map (LLD-C# → SPEC-R#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | `ui-surface-host` element | `app/src/controls/surface-host/surface-host.ts` | SPEC-R2, R3, R8 (deep-import guard, AC4) | n1a |
| **LLD-C2** | surface-host CSS (artboard, promoted from `canvas-surface.css`) | `.../surface-host/surface-host.css` | SPEC-R2, R11 | n1b |
| **LLD-C3** | surface-host descriptor + gates | `.../surface-host/surface-host.md`, `.test.ts`, `.browser.test.ts` | SPEC-R11 | n1c |
| **LLD-C4** | `ui-conversation` element (thread, composer, per-turn registry) | `app/src/controls/conversation/conversation.ts` | SPEC-R4, R5, R7, R8 (callback-only API, no transport prop) | n2a |
| **LLD-C5** | narration integration (`ui-status-stream` composition + `categoryOf`) | `.../conversation/conversation.ts` (narration slice) | SPEC-R6 | n2b |
| **LLD-C6** | conversation CSS (thread/bubble/composer layout) | `.../conversation/conversation.css` | SPEC-R4 | n2c |
| **LLD-C7** | conversation descriptor + gates | `.../conversation/conversation.md`, `.test.ts`, `.browser.test.ts` | SPEC-R11 | n2c |
| **LLD-C8** | layering trip-wire extension (`@agent-ui/a2ui` now exercised) | `app/src/layering.test.ts` | SPEC-R1 | n3a |
| **LLD-C9** | public barrel + size re-base | `app/src/index.ts`, `package.json` exports, `scripts/measure-size.mjs` | SPEC-R1, R11 | n3c |
| **LLD-C10** | catalog residue-guard re-check (no allowlist entry needed) | `a2ui/src/catalog/default/index.test.ts` (read-only re-run) | SPEC-R10 | n3b |
| **LLD-C11** | `a2ui-live` re-host (canvas → surface-host; chat + asks → conversation) | `site/pages/a2ui-live.{ts,css}` | SPEC-R9 | n4a |
| **LLD-C12** | `a2ui-chat` re-host (full page → conversation) | `site/pages/a2ui-chat.{ts,css}` | SPEC-R9 | n4b |
| **LLD-C13** | generalization-source deletion | `site/lib/{canvas-surface,surface-registry,ask-registry}.{ts,test.ts,css}` removed | SPEC-R9 | n4c |

No orphan components (each traces to a SPEC-R); no SPEC-R without a component.

## 2. LLD-C1 — `ui-surface-host` (→ SPEC-R2, R3)

`app/src/controls/surface-host/surface-host.ts`. Extends `UIElement`, `formAssociated: false`, light-DOM default (mirrors `ui-app-shell`'s structural-element shape). At connect, builds the artboard pair `canvas-surface.ts` already proved — a checkered `stage` div and a translate-centered `surface` div nested inside it — as the element's OWN light-DOM children (not slotted; the element owns this subtree, nothing is author-composed here, unlike `ui-app-shell-region`). Constructs exactly one `createRenderer()` `RendererHost` at connect and mounts it into the `surface` element.

```ts
const props = { label: prop.string('') } satisfies PropsSchema   // optional accessible name only

class UISurfaceHostElement extends UIElement {
  static props = props
  #host: RendererHost | undefined
  #surface!: HTMLElement

  connectedCallback(): void {
    super.connectedCallback()
    // build stage/surface (canvas-surface.ts's pair, promoted verbatim as this element's own subtree)
    this.#host = createRenderer()
    this.#host.mount(this.#surface)
  }
  ingest(line: string): void { this.#host?.ingest(line) }
  finalize(): void {
    this.#host?.finalize()
    applyRootStretch(this.#surface)   // unchanged behavior from canvas-surface.ts
  }
  dispose(): void { this.#host?.dispose() }
  onClientMessage(cb: ClientMessageListener): void { this.#host?.onClientMessage(cb) }
}
```

**Failure/edge handling.**
- *`ingest()`/`finalize()` called before connect* — `#host` is `undefined`; each method is a documented no-op pre-connect (mirrors `ui-app-shell`'s connect-time-only `isolated` precedent) rather than throwing; a dev-time console warning fires once.
- *Malformed line* — `RendererHost.ingest()` already emits an `error` (`PARSE`) and continues (`a2ui-runtime.spec.md` SPEC-R1 AC2); this element does not re-implement that handling, it only forwards.
- *Repeated `dispose()`* — idempotent-safe, mirroring `RendererHost.dispose()`'s own contract; a second call is a no-op.
- *`label` prop* — purely cosmetic (an accessible name for the artboard region when composed standalone, e.g. a2ui-live's Canvas tab panel); `ui-conversation`'s inline usage (LLD-C4) does not set it — the surrounding turn bubble already carries the accessible structure.
- *Deep-import guard* — `surface-host.ts` imports only `createRenderer`/`RendererHost`/`A2uiClientMessage`/`ClientMessageListener` from the `@agent-ui/a2ui` public barrel; a grep in the C3 accept guards this (SPEC-R2 AC4).

**Checkpoint:** `npm run check` 0; the contract↔props trip-wire (C3) green; a jsdom test proves `ingest`→`finalize` renders a stub A2UI stream's root inside the surface element.

## 3. LLD-C2 — surface-host CSS (→ SPEC-R2, R11)

`surface-host.css`, single-file (ADR-0003): a `:where(ui-surface-host)` token block declaring only `--ui-surface-host-*` (promoted 1:1 from `canvas-surface.css`'s checkered-stage rules — same visual contract, renamed prefix), then `@scope (ui-surface-host)`. No new visual design — this is a straight promotion of already-shipped, already-proven CSS from site-land into the fleet.

**Failure/edge handling.**
- *Forced-colors* — the checkered stage background is decorative (a positioning/measurement aid, not information-bearing); it MAY simplify or disappear under `forced-colors: active` as long as the mounted surface's own controls stay legible (they carry their own forced-colors handling already).
- *Watch the `*/`-in-comment CSS pitfall* (recorded fleet lesson) when porting the promoted comment banners.

**Checkpoint:** browser whole-shape parity with today's `a2ui-live` Canvas tab.

## 4. LLD-C3 — surface-host descriptor + gates (→ SPEC-R11)

`surface-host.md` per ADR-0004 frontmatter; `tier: structural`; `extends: UIElement`; no `parts`/`customStates` beyond the stage/surface anatomy (declared truthfully). `surface-host.test.ts` (jsdom): pre-connect no-op behavior; ingest→finalize renders; dispose tears down; onClientMessage delivers a stubbed client message. `surface-host.browser.test.ts` (Chromium AND WebKit): whole-shape (non-zero stage/surface boxes); a real A2UI stream renders a real control; forced-colors legibility of the mounted control.

**Checkpoint:** contract↔props trip-wire equals `finalize(UISurfaceHostElement)`; both gates green both engines.

## 5. LLD-C4 — `ui-conversation` (→ SPEC-R4, R5, R7)

`app/src/controls/conversation/conversation.ts`. Extends `UIElement`, `formAssociated: false`, light-DOM default. Owns its own thread/composer DOM (built once at connect, never author-slotted) and an internal **surface registry** — `surface-registry.ts`'s `SurfaceRegistry` class, generalized as a private field of the element rather than a site-land helper, with its `mount: HTMLElement` entries replaced by full `UISurfaceHostElement` instances (so `create()` now does `document.createElement('ui-surface-host')` + appends it into the turn's bubble, instead of a bare `<div>` + a raw `createRenderer()`).

```ts
const props = { disclosure: prop.boolean(false) } satisfies PropsSchema

interface AgentTurnHandle {
  ingestLine(line: string): void
  setNote(text: string): void
  finalize(): void
  fail(message: string): void
}

class UIConversationElement extends UIElement {
  static props = props
  #registry = new SurfaceRegistry()   // now composes ui-surface-host, not a bare mount (§7 fork 2)
  #onSubmit: ((text: string) => void) | undefined
  #onClientMessage: ClientMessageListener | undefined

  addUserMessage(text: string): void { /* append a user bubble; sample scroll guard first (LLD-C6) */ }

  beginAgentTurn(): AgentTurnHandle {
    const bubble = /* build an agent bubble: narration strip + note + mounts container, SPEC-R2's literal order */
    const narration = /* a fresh ui-status-stream instance inside the bubble */
    const categoriesSeen: Category[] = []
    return {
      ingestLine: (line) => { /* routeLine: fresh id -> create() a ui-surface-host child; known id -> route to its host; no-id -> narration-only (categoryOf) */ },
      setNote: (text) => { /* stash for finalize */ },
      finalize: () => { /* narrateCategories, render note/summarize fallback, settle every touched surface host */ },
      fail: (message) => { /* truncate narration with an error entry; add a system bubble; still finalize cleanly */ },
    }
  }

  onSubmit(cb: (text: string) => void): void { this.#onSubmit = cb }
  onClientMessage(cb: ClientMessageListener): void { this.#onClientMessage = cb }
  reset(): void { this.#registry.disposeAll(); /* clear thread DOM */ }
}
```

Every `ui-surface-host` the registry creates is wired with `onClientMessage(m => this.#onClientMessage?.(m))` at creation — the bubbling-up in SPEC-R4's typed contract.

**Failure/edge handling.**
- *`ingestLine` called with no open turn* (`beginAgentTurn()` never called) — impossible by construction: `ingestLine` only exists on the handle `beginAgentTurn()` returns; there is no free-standing `ingestLine` on the element itself.
- *A `deleteSurface` line targeting a KNOWN, already-closed surface* — `SurfaceRegistry.close()` is idempotent (returns `false`, no-op) per the embryo's own contract; the routing layer never double-annotates.
- *A held no-surface-id line arrives before any surface opens this turn* — buffered exactly as `a2ui-chat.ts`'s `RouteCtx.heldNoIdLines` does today, flushed into the first surface this turn creates (unchanged mechanism).
- *`onSubmit`/`onClientMessage` never registered* — every call site is optional-chained; a consumer that only wants to display a canned transcript (no reply wiring) does not need to register anything (SPEC-R5 AC2).
- *`disclosure` prop* — when `true`, `beginAgentTurn().finalize()` additionally appends the `a2ui-chat.ts` `disclosure()` `<details>` wire dump (unchanged mechanism, promoted verbatim); default `false` (§7 fork 3).

**Checkpoint:** `npm run check` 0; the contract↔props trip-wire (C7) green.

## 6. LLD-C5 — narration integration (→ SPEC-R6)

The `Category`/`LABEL`/`categoryOf`/`narrateCategories`/`narrateTrace` functions from `a2ui-chat.ts` move into `conversation.ts` unchanged (they are already pure, presentation-only, zero-dep helpers over raw JSONL strings — a straight promotion, not a rewrite). `narrateTrace`'s `TurnTrace` parameter stays **optional** (present only on a live transport arm; absent on the shipped recorded transcript) — the element never assumes a trace exists.

**Failure/edge handling.**
- *A category the label table doesn't cover* (e.g. an envelope kind with no lifecycle category, `actionResponse`/`callFunction`) — `categoryOf` already returns `undefined` for these; `ingestLine` skips narration for that line without error (unchanged from the embryo).

**Checkpoint:** a jsdom test proves narration entries appear in emission order, deduplicated by category, pending→active→done.

## 7. LLD-C6 — conversation CSS (→ SPEC-R4)

`conversation.css`, single-file (ADR-0003): thread/bubble/composer layout, promoted from `a2ui-chat.css`'s equivalents (renamed to `--ui-conversation-*`). The scroll-follow **mechanism** (`isNearLogBottom`/`tailFollowLog`) is behavior (TypeScript), not CSS — it moves alongside the element in LLD-C4, unchanged from the embryo's own carefully-reasoned implementation (its banner comments on why a reactive scroll listener is wrong stay attached verbatim; this is proven, hard-won behavior, not a candidate for rewrite).

**Checkpoint:** browser whole-shape parity with today's `a2ui-chat` page.

**LLD-C7 — conversation descriptor + gates (→ SPEC-R11).** `conversation.md` per ADR-0004; `tier: structural`; `extends: UIElement`; declares the `disclosure` prop and the anatomy the thread/composer/narration slices actually render (bubble, composer, narration-strip, mounts-container, wire-disclosure — truthful-to-the-DOM, the same discipline as C3's descriptor). `conversation.test.ts` (jsdom): `addUserMessage`/`beginAgentTurn` routing, persistent surface identity across two turns, `deleteSurface`'s visible annotation, `onSubmit` firing once with trimmed text, no-listener-no-throw. `conversation.browser.test.ts` (Chromium AND WebKit): whole-shape thread+composer, the scroll-follow guard (near-bottom vs. scrolled-away, the biting negative control being a naive reactive-listener regression), forced-colors legibility.

**Checkpoint:** contract↔props trip-wire equals `finalize(UIConversationElement)`; both gates green both engines.

## 8. Forks — RECOMMENDED, not self-ratified (carried to [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md))

1. **Transport/produce-loop boundary.** *Recommend (SPEC-R8, already written as a requirement above): NEITHER primitive owns any transport-shaped type; the app's own loop drives both via imperative per-line/per-turn methods.* Rejected alternative: a shared `TransportSeam` interface (e.g. re-exporting a narrowed `AgentTransport` shape) the conversation primitive accepts as a prop — this would still couple the primitive's public API to a transport *shape*, and PRD-D2's trusted-frame law argues the shell/conversation should never need to agree on a transport contract at all, only on the wire's own line format (which is already a public, spec-owned type, `A2uiServerMessage`/`A2uiClientMessage`). The imperative-handle design has zero transport-shaped surface.
2. **Composition — does `ui-conversation` own `ui-surface-host` internally?** *Recommend: yes* (SPEC-R7) — generalizing `SurfaceRegistry` as the element's own mechanism is what makes PRD-G4's "0 hand-built thread" claim true; if the app still had to wire per-surface hosts itself, the primitive would not have closed the gap PRD-G4 names. Rejected alternative: `ui-conversation` renders only text bubbles and leaves ALL surface mounting to the app (composing raw `ui-surface-host` externally, keyed by the app's own bookkeeping) — this re-creates exactly the per-app registry/routing code (`surface-registry.ts`) this milestone exists to delete.
3. **Narration vs. wire disclosure — product feature or dev tool?** *Recommend: narration ships unconditionally (SPEC-R6, no opt-out prop) — it is ADR-0088's honest-narration law, not a debugging affordance, and a consumer hiding "what the agent is doing" would be working against the fleet's own transparency posture. Wire disclosure (the raw JSONL `<details>` dump) ships as an OPT-IN `disclosure` prop, default `false`* — a raw wire dump is a debugging/inspection affordance most product surfaces should not show by default, but the mechanism stays available (never deleted) for anyone building agent-facing tooling on the primitive.
4. **Reference-app scope — does `a2ui-chat.ts` migrate too, or only `a2ui-live` (the PRD's literal wording)?** *Recommend: both* (SPEC-R9) — PRD-G4's metric names `a2ui-live` because that was the only shipped chat surface when the PRD was ratified (2026-07-05); `a2ui-chat.ts` shipped later (TKT-0020, 2026-07-11) and is a NEWER, MORE COMPLETE hand-built implementation of the exact same lifecycle `ui-conversation` now owns. Leaving it unmigrated after M2 means the fleet carries two independent, divergent, hand-rolled "per-surface persistent lifecycle" implementations post-primitive — a direct violation of PRD-G6's coherence bar, and the stronger, more honest reading of PRD-G1's flagship metric ("~0 bespoke shell/layout/canvas-wiring LOC... across the reference app").

## 9. Build sequence (center-out, dependency-ordered)

1. **LLD-C1 + LLD-C2 + LLD-C3** `ui-surface-host` (behavior + CSS + descriptor + gates) as one owning slice *(checkpoint: `check` 0, both gates green both engines)*.
2. **LLD-C4 + LLD-C5 + LLD-C6 + LLD-C7** `ui-conversation` (behavior incl. the internal registry composing `ui-surface-host` + narration + CSS + descriptor + gates) *(after step 1; checkpoint: `check` 0, both gates green both engines)*.
3. **LLD-C8** layering trip-wire extension *(parallel-safe with steps 1–2; checkpoint: `test` green with `@agent-ui/a2ui` now genuinely exercised, NC still bites)*.
4. **LLD-C10** catalog residue-guard re-check *(after step 2; checkpoint: `a2ui/src/catalog/default/index.test.ts` unchanged, green — a read-only verification, no edit expected)*.
5. **LLD-C11** `a2ui-live` re-host *(after steps 1–2; checkpoint: site build + browser unchanged vs. pre-re-host, diff net-negative)*.
6. **LLD-C12** `a2ui-chat` re-host *(after steps 1–2, parallel-safe with step 5; checkpoint: same)*.
7. **LLD-C13** delete `canvas-surface.*`/`surface-registry.*`/`ask-registry.*` *(serial, after steps 5–6 both land — nothing may still import the files being deleted; checkpoint: `npm run check` + `npm test` green with the three files gone, a grep confirms no remaining import)*.
8. **LLD-C9** barrel + size re-base *(serial INTEGRATION, after step 7 so size measures the final tree; checkpoint: `size` line-item within the re-based budget)*.
9. **Reviewer gate** (decomp n5): `component-reviewer` GO ≥4 both axes on `ui-surface-host` AND `ui-conversation` BEFORE the M2 commit.

## 10. Failure/edge summary (cross-cutting)

- **Cross-engine divergence** — every browser assertion runs Chromium AND WebKit; a one-engine pass is a fail (the fleet discipline).
- **Deletion ordering** — LLD-C13 MUST follow both re-hosts (C11/C12), never precede or interleave with them; a grep for any remaining `canvas-surface`/`surface-registry`/`ask-registry` import gates the deletion commit.
- **Shared-file races** — only C9 writes `measure-size.mjs`/`package.json` exports; C11/C12 are file-disjoint (different site pages) and parallel-safe.
- **Negative-control discipline** — LLD-C8's layering NC (an upward/self `@agent-ui/app` import planted in `a2ui/src`) must still bite after `@agent-ui/a2ui` becomes a genuinely-exercised import, not just a declared one.
- **Budget re-base is measured, not guessed** — SPEC-R11's re-based ceiling is set against the ACTUAL post-M2 tree at LLD-C9, mirroring the M1/M4 kickoff discipline; no number is picked in advance of a real build.
