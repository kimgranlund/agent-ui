# PRD — Agent-App Surfaces

> Status: **accepted · v1.2 · Owner: agent-ui** — direction RATIFIED by Kim 2026-07-05 (all six forks PRD-D1–D6 accepted as recommended; §5). *(Marker corrected 2026-07-10: was `v1.1`; the changelog below already recorded the v1.2 fork-pass widening — a factual version-marker fix, no decision changed.)* Began life as a scope INTAKE (v0.1 proposed, 2026-07-05). (v1.1, 2026-07-10: **§2 gains PRD-G7 (panes) + PRD-G8 (settings surface), §7 gains milestone M4** at the design-system-surfaces intake ([TKT-0007](../tickets/tkt-0007-design-system-surfaces.md)) — Kim's intake ruling *"panes and a settings shell are chrome — extend agent-app-surfaces (M4)"*; scope + tier split in [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md); the amendment is additive — PRD-D1–D6 and the M1–M3 targets are untouched — and doc-reviewed 2026-07-10. v1.2, 2026-07-10: Kim's ratification fork pass amended M4's scope — `ui-split` is MULTI-PANE in v1 (ADR-0120 F1, recommendation overruled) and the settings surface gains the schema-driven preferences FRAMEWORK (ADR-0120 F3, shell-only fence rejected); PRD-G7/G8 + §3 updated to match, D1–D6/M1–M3 still untouched.)
> Altitude: this document owns **why + what-should-exist** for the next tier. Behaviour contracts (SPEC) and implementation (LLD) are downstream. This is the ceiling-setting Plan artifact — no ADRs live here.
> Grounding: [`../plan.md`](../plan.md) §5 (`static shadow` seam) · §12 (isolation boundary resolved light-DOM-for-now, with an app-shell family named as the revisit trigger) · [`../goals.md`](../goals.md) (foundation COMPLETE, G0–G9 + Control Suite + icon adapter + G8) · [`../archive/a2ui-expert-system/NEXT.md`](../archive/a2ui-expert-system/NEXT.md) (the A2UI layer + the `a2ui-live` demo) · [`../spec/a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) §5.3 (the renderer `mount` seam) · [`../../../CLAUDE.md`](../../../CLAUDE.md) (import-layering law, package structure).
> Location note: filed under `.claude/docs/prd/` per the current authoring charter (ratified, PRD-D6); the A2UI family was unified onto this same singular `spec/`·`lld/` map (repo-alignment, 2026-07-12).
> Downstream (M1, drafted 2026-07-05): decomposition [`../decompositions/m1-app-shell.decomp.json`](../decompositions/m1-app-shell.decomp.json) (coverage-clean) → SPEC [`../spec/agent-app-shell.spec.md`](../spec/agent-app-shell.spec.md) (`SPEC-R1…R8`) → LLD [`../lld/agent-app-shell.lld.md`](../lld/agent-app-shell.lld.md) (`LLD-C1…C9`). M2/M3 (PRD-G3/G4/G5) not yet specced.

## 1. Problem

Two things are shipped and proven, and there is a gap between them that every builder of an agent app will fall into.

1. **The control fleet is complete.** `@agent-ui/components` ships the full `ui-*` family — form controls, the container/layout primitives (`ui-row`/`-column`/`-grid`/`-list`/`-card`/`-tabs`/`-modal`), `ui-icon`, plus `<component-gallery>` and `<theme-provider>` (goals §G0–G9 DONE).
2. **The generative-UI layer is complete.** `@agent-ui/a2ui` renders an agent-EMITTED, streamed A2UI payload into those `ui-*` controls against a catalog — zero-dep renderer, default catalog, corpus store, expert harness, and a working live-agent demo (`NEXT.md`).

But **there is no layer that composes them into an application.** An agent app is not a widget and it is not a rendered payload — it is *chrome*: a shell (regions, rails, header, panels), a conversation surface (message thread + composer + streaming), a canvas/artboard where the agent's generative UI lands, and tool-call/result presentation. Today that chrome does not exist as reusable primitives — it exists **once, hand-built, as demo code in the site**:

- `site/pages/a2ui-live.{ts,css}` — the hand-assembled `[ chat | a2ui-canvas ]` app shell.
- `site/lib/canvas-surface.{ts,css}` — the hand-built artboard host the A2UI renderer mounts into.
- `site/pages/_page.{ts,css}` — a bespoke CSS-only light-DOM page shell.
- `site/lib/agent-runtime.ts` · `live-proxy-transport.ts` · `provider-switcher.ts` — the hand-wired transport/runtime seam.

**Why the gap matters.** The next person to build an agent app on agent-ui re-hand-builds all of the above. The demo proves the composition is *possible*; it does not make it *reusable*. Nobody can stand up an agent app without re-deriving the shell, re-wiring the canvas-to-renderer seam, and re-implementing the conversation thread — the precise per-app glue the `@agent-ui/a2ui` layer eliminated for *content* but nobody has eliminated for *chrome*. The fleet + renderer are the parts; agent-app surfaces are the assembly.

**Who has the problem.** The *verified, evidenced* instance today is **internal**: (1) *The repo itself* — its only agent-app composition (`a2ui-live`) is untested-as-a-primitive site code that will rot or be copy-pasted, and (2) *the A2UI layer*, whose rendered output has no defined, reusable home (a canvas/surface-host seam) — only a one-off `<div>` per app. *Forward-looking* (anticipated, not yet observed): (3) *external developers building agent-facing applications* on this stack — chat apps, agent consoles, copilots, generative-UI canvases — who will want to compose an app, not hand-build chrome per app. The tier is justified by the one grounded internal instance; the external audience is the growth case it also serves, not the evidence for it.

**Evidence it matters.** The `a2ui-live` demo is a complete, working agent app — and *every line of its chrome is bespoke*. That is the strongest available signal that a primitive tier is needed: the composition is real, valuable, and currently un-reusable — a single but concrete, in-repo instance. `plan.md` already anticipated this tier — §5 reserves `static shadow` "only the app shell needs it", and §12 **resolved** the app-shell/isolation boundary as *light-DOM-for-now*, explicitly naming a scheduled **app-shell control family** (this tier) as the revisit trigger. This PRD is that trigger firing.

## 2. Goals & success metrics

Stable IDs; priority tiers; metrics baselined at **0 / not-possible-today** (nothing exists as a primitive). Targets are stated against milestones **M1–M5** (§7). *(Marker corrected 2026-07-20: was "M1–M3 (§6)" — stale since v1.1 added M4 (and later M5); milestones live in §7, not §6; a factual reference fix, no decision changed — the same precedent as this doc's own v1.2 marker correction above.)* **Goals are stated as OUTCOMES** — the mechanism that realizes them (the region set, the docking model, container-query reflow, the `static shadow` isolation mode) is the *ratified-decision* layer in §4/§5 and is owned in detail by the downstream SPEC/LLD; the PRD does not pre-bake it. Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must (flagship) | Stand up a working agent app by composing primitives — no bespoke chrome |
| **PRD-G2** | must | A developer assembles the persistent application layout without hand-authoring shell/layout CSS |
| **PRD-G3** | must | Agent-emitted content appears in the running app with no app-written renderer/transport glue |
| **PRD-G4** | should | A developer presents a multi-turn agent conversation without hand-building the thread + composer |
| **PRD-G5** | could | A developer presents agent tool-calls and their results without hand-building the presentation |
| **PRD-G6** | must (cross-cutting) | Every surface meets the fleet DoD and preserves the layering law (no cycles) |
| **PRD-G7** | should (M4, v1.1) | A developer arranges resizable/collapsible panes — master-detail, user-collapsed regions — without hand-building split mechanics |
| **PRD-G8** | should (M4, v1.1) | A developer stands up a settings surface (sections nav + panels + narrow drill-in) without hand-building the shell |

**PRD-G1 — Compose an agent app, don't hand-build it (flagship).** A developer stands up a working agent app — the persistent chrome plus a place where the agent's generated content and conversation live — by composing tier primitives, with no one-off chrome.
- *Metric*: (a) bespoke-chrome LOC in a reference agent app; (b) count of reusable app surfaces shipped as primitives.
- *Baseline*: today every agent app is all-bespoke chrome (`a2ui-live` ≈ 100 % hand-built).
- *Target*: the reference app (the re-hosted `a2ui-live`, per **PRD-D5**) carries ~0 bespoke shell/layout/canvas-wiring LOC; ≥ 3 reusable app surfaces shipped.
- *Timeframe*: by **M3** (tier complete).

**PRD-G2 — Assemble the application layout without hand-built CSS (the anchor).** A developer lays out the persistent chrome around the agent's content — the outer application frame and its regions — by composing primitives, so the frame adapts to its available width and can be isolated from a host page, without authoring bespoke shell/layout CSS. *(How — the region set, the docking model, intrinsic reflow, the isolation mode — is the ratified direction in §4 Fork 1/Fork 3 and PRD-D1/D3; the SPEC/LLD own the mechanism.)*
- *Metric*: an app layout is assembled with **0 bespoke shell/layout CSS**; it adapts responsively (proven cross-engine); the isolation-boundary decision (**PRD-D3**) is resolved with browser-truth evidence.
- *Baseline*: no shell primitive (the frame is the bespoke `_page`/`a2ui-live` CSS).
- *Target*: the layout primitive is shipped, browser-proven in **Chromium AND WebKit** (whole-shape, per the fleet discipline); the isolation question is resolved-or-escalated with evidence.
- *Timeframe*: **M1** (anchor).

**PRD-G3 — Agent content appears with no app-written glue.** Agent-emitted A2UI content appears inside the running app, streaming and interactive, without the app authoring any renderer or transport wiring. *(How — a canvas/surface-host primitive owning the `renderer.mount` seam + the `produce` loop — is §4 Fork 2 / PRD-D2; the SPEC/LLD own the mechanism.)*
- *Metric*: agent-emitted content appears (streaming, fault-isolated) with **0** app-specific renderer/transport code.
- *Baseline*: `a2ui-live` hand-wires `canvas-surface.ts` to the renderer per-app.
- *Target*: a surface-host primitive encapsulates the mount + stream; `a2ui-live`'s bespoke canvas wiring is deleted in favour of it.
- *Timeframe*: **M2**.

**PRD-G4 — Present a conversation without hand-building it.** A developer presents a multi-turn agent conversation — messages appearing over time and a way to reply — without hand-building the thread or the composer.
- *Metric*: a multi-turn conversation (streamed messages + a reply affordance) is presented from a primitive; `a2ui-live`'s chat is re-expressed on it.
- *Baseline*: `a2ui-live` hand-builds the thread + composer.
- *Target*: a conversation primitive is shipped, browser-proven cross-engine; the demo's bespoke chat is removed.
- *Timeframe*: **M2**.

**PRD-G5 — Present tool-calls and results without hand-building it.** A developer surfaces what the agent invoked and what came back — in-progress, succeeded, failed — without hand-building the presentation.
- *Metric*: a tool-call/result presentation is produced from a primitive across its lifecycle states (pending · success · error) with an inspectable payload.
- *Baseline*: none.
- *Target*: primitive shipped, cross-engine.
- *Timeframe*: **M3**.

**PRD-G6 — Fleet DoD + layering coherence (cross-cutting).** Every app surface meets the standing component bar and the tier preserves the import-layering law.
- *Metric*: per surface — `{name}.md` descriptor + contract↔props trip-wire + `component-reviewer` ≥ 4 both axes + cross-engine browser-truth + a stated `size` budget line-item; the import-layering trip-wire is extended to the new package and stays green (no dependency cycle; nothing imports the apex).
- *Baseline*: n/a (the discipline exists; the tier must not regress it).
- *Target*: all gates green from **M1**; the layering trip-wire proves the apex boundary.
- *Timeframe*: continuous from **M1**.

**PRD-G7 — Arrange panes without hand-building split mechanics (M4, v1.1).** A developer arranges
the master-detail agent-app layout (sessions list | conversation) and user-collapsible regions by
composing primitives — no bespoke drag/resize/collapse code. *(How — the components-tier `ui-split`
primitive (**multi-pane/N-slot in v1** — Kim's F1 fork answer, 2026-07-10), the master-detail
composition, the realized ADR-0084 `collapse: "toggle"` — is
[ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md)'s direction layer, fork-answered
2026-07-10; the M4 SPEC/LLD own the mechanism.)*
- *Metric*: a master-detail arrangement + a user-collapsible region are assembled from primitives with
  0 bespoke split/collapse code; keyboard resize + announcement proven cross-engine.
- *Baseline*: no split/resize primitive exists anywhere in the fleet (intake grep, 2026-07-10);
  `collapse: "toggle"` is reserved-unbuilt (SPEC-R5).
- *Target*: `ui-split` shipped (components tier, full fleet DoD); master-detail shipped (app tier);
  `toggle` realized with ADR-0084's wide-layout invariant held.
- *Timeframe*: **M4**.

**PRD-G8 — Stand up a settings surface (M4, v1.1; widened v1.2).** A developer presents app
preferences — a sections rail, per-section panels, drill-in when narrow — AND (v1.2, Kim's F3 fork
answer 2026-07-10: the shell-only fence rejected) generates the panels from a **schema-driven
preferences framework**: config-in → form-out over the fleet's own `ui-field`/`ui-form-provider`,
validation wiring from the schema, persistence via a store-adapter SEAM (the app may still bring its
own store; contracts are M4-SPEC business). Navigation binding stays consumer wiring — `app` never
imports `router`.
- *Metric*: a settings surface is assembled with 0 bespoke shell CSS; narrow drill-in proven
  cross-engine.
- *Baseline*: none exists (the site theming page is a guide, not a shell).
- *Target*: the surface shipped in `@agent-ui/app`, composing the M1 shell + `ui-split` where apt.
- *Timeframe*: **M4**.

## 3. Scope

### In scope
- **The `agent-app surfaces` primitive family** — reusable app-chrome components composing `@agent-ui/components` (+ `@agent-ui/a2ui` where a surface hosts agent content): the **app-shell** (regions/docking), a **conversation surface**, a **canvas/surface-host** (the A2UI mount seam), and a **tool-call/result surface**. *(PRD-G1–G5)*
- **The package + layering boundary** — a new home for the tier and its place in the dependency DAG (the **PRD-D3** fork). *(PRD-G6)*
- **The A2UI relationship boundary** — the rule for how agent-emitted content meets host-authored chrome (the **PRD-D2** fork). *(PRD-G3)*
- **One reference agent app** — the existing `a2ui-live` demo re-expressed on the primitives, as the flagship proof (**PRD-D5**). *(PRD-G1)*
- **(v1.1) The M4 pane + settings chrome** — master-detail, user-collapsible regions (the realized
  `collapse: "toggle"`), and the settings surface, composing a NEW components-tier `ui-split`
  primitive (the tier split is [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md) clause 2 —
  the primitive is a layout control, not apex code). *(PRD-G7, PRD-G8)*

### Out of scope (with rationale)
- **Specific production agent apps.** We ship primitives + one reference app; building real apps is unbounded downstream consumer work. — *primitives, not products.*
- **A backend / agent runtime / transport implementation.** The `a2ui-live` transport + provider seam already exists (`AgentTransport`, the proxy, `providers.json`); app surfaces **consume** it, they do not reimplement it. — *one fact, one home (the A2UI live-agent spec owns it).*
- **A routing / SPA / data-fetching / state-management framework.** App surfaces are UI chrome; the app brings its own router/store. — *this is a component tier, not an application framework.*
- **Agent-EMITTABLE shell surfaces.** The trusted frame is never agent-authored (see **PRD-D2**). — *letting the agent emit its own container is a security inversion.*
- **Re-specifying the control fleet or the A2UI renderer.** Owned by `plan.md`/`goals.md` and the A2UI spec family; this tier composes them. — *one fact, one home.*
- **The multi-theme package-swapping system.** A separately-parked next-tier item (`theme-provider` seam exists); not this tier. — *distinct scope dial.*
- **(v1.2 — the v1.1 row MOVED IN-SCOPE by Kim's F3 fork answer, 2026-07-10.)** The schema-driven
  preferences framework now belongs to M4 ([ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md)
  F3/clause 4). What STAYS out: remote sync, account/identity, and policy/permission layers — those
  route to new intakes, never riders. — *the fence moved, it did not vanish.*
- **Non-web / mobile-native targets.** — *out of the library's remit.*

## 4. Direction forks — the ratified architecture

> The three load-bearing forks, **RATIFIED by Kim 2026-07-05** (PRD-D1–D3 in §5). Each carries its first-principles analysis and the recommendation Kim accepted; this section is the ratified-decision layer the §2 outcome-goals defer their mechanism to. The downstream SPEC/LLD own the precise mechanism; they do not re-litigate these decisions.

### Fork 1 — The anchor surface *(→ PRD-D1)*
**Candidates.** (a) app-shell primitive (regions/rails/panels) · (b) conversation/chat surface · (c) canvas/artboard host · (d) tool-call/result surface.

**Analysis.** An anchor should set the *architectural ceiling* every later surface inherits, and de-risk the tier's biggest unknown. The app-shell is the **composition root**: every other surface docks *into* it, so building it first gives chat/canvas/tool-calls a home and a contract from day one (no rework of a floating primitive). It is the one component the reserved `static shadow` seam was explicitly held for — so building it first **forces and resolves** the tier's biggest open architectural question (isolation boundary, **PRD-D3**) at minimum blast radius. It is mostly composition over the *already-shipped* layout family + container box-model — low build risk — and it **generalizes proven code** (`site/pages/a2ui-live` + `_page`), so the anchor extracts a primitive from a working reference rather than guessing greenfield.

**Recommendation: (a) the app-shell primitive**, scoped tightly to the **regions + docking skeleton**, with its proof-of-life = re-hosting the existing `a2ui-live` chat+canvas inside it (§6). The conversation surface is the flagship *value* deliverable but belongs in **M2**, built into the shell's proven frame — building it first risks locking a composition/isolation model the shell later contradicts.
*Runner-up (honest):* the **conversation surface** — the most distinctive, most-reused agent surface, self-contained (needs no shell to prove value), and genuinely hard (streaming/turns/tool-calls). Chosen if Kim weights *proving the distinctive value* over *setting the architecture* first. Its cost: it defers the isolation/composition-root decision that everything else inherits.

### Fork 2 — Relationship to A2UI *(→ PRD-D2)*
**Candidates.** (a) HOST CHROME that A2UI renders into · (b) agent-EMITTABLE surfaces extending the A2UI catalog · (c) both planes with a boundary.

**Analysis.** A2UI's security model is the catalog: the agent may only name pre-approved components, and the renderer mounts that content into a mount point. The app **shell** is the *trusted frame* — it holds the transport, the keys context, the session state, the navigation. It must never be agent-authored (that would let the agent emit its own container — a security inversion). So the shell/chat/tool-call surfaces are **host chrome**: the developer assembles them. The agent's emitted content lands *inside* one region — the canvas/surface-host — which is exactly the seam where trusted frame meets untrusted, catalog-bounded content. This seam already exists in embryo: the a2ui **`RendererHost.mount(rootEl)`** entry (renderer SPEC §5.3 / SPEC-R9, realized at `packages/agent-ui/a2ui/src/renderer/renderer.ts:100`), which the `a2ui-live` canvas already calls. *(This is the a2ui-side renderer mount — distinct from the components-side public `mount()` directive-host seam of ADR-0023, a different mechanism.)* Content-level surfaces the agent *might* emit (a card, tabs) are already covered — the A2UI default catalog binds them (G9). Nothing in this tier needs to be agent-emittable.

**Recommendation: (a) HOST CHROME is the primary plane**, with the boundary rule **"trusted frame (host-authored) contains untrusted content (agent-emitted, catalog-bounded, rendered into a mount)."** The canvas/surface-host is that seam — generalizing the a2ui `RendererHost.mount(rootEl)` (renderer SPEC §5.3) / the `a2ui-live` canvas, not inventing a new mechanism. Plane (b) is **out** (security inversion for the shell; already-covered for content). Plane (c) is a **named, need-gated future hook** — if a real need appears to let the agent emit a whole composite layout, it extends the *existing* catalog mechanism; it is not this tier's charter.

### Fork 3 — Layer & boundary *(→ PRD-D3)*
**Candidates.** New `ui-*` fleet controls in `@agent-ui/components` (and does `static shadow` finally get used?) · a distinct higher-level package (e.g. `@agent-ui/app`).

**Analysis — the cycle is decisive.** The canvas/surface-host must import `@agent-ui/a2ui` to own the renderer wiring (PRD-G3). But `@agent-ui/a2ui` → `@agent-ui/components` (confirmed in its `package.json`). If app surfaces lived *in* `@agent-ui/components`, then `components → a2ui → components` — a **cycle**, forbidden by the inward-only layering law. Dependency-inverting it (the host-control exposes a bare mount and the app wires a2ui externally) *avoids* the import but recreates the exact per-app glue this tier exists to eliminate, and reduces the surface-host to a hollow `<div>` that owns none of the streaming/fault-isolation/`produce` loop that lives in a2ui. So the composed value *requires* importing a2ui, which requires living *above* it. Additionally: `@agent-ui/components` is DONE with a tight family budget (~617 B gz headroom) and a leaf-widget identity — app chrome is a higher-altitude concern that should not be crammed into the leaf. A distinct package extends the DAG cleanly: `shared ← components ← a2ui ← app` (and `app → components` directly); no cycle; nothing imports the apex.

**The isolation sub-fork.** The shell is precisely the case §5/§12 reserved for isolation: it is the app's *outer boundary*, where style isolation from a host page is a feature, not a cost (the per-control `@scope`/slotting reasons that kept the fleet light-DOM apply to *leaves*, not the outer shell). Crucially, the fleet's `--md-sys-color-*`/`--ui-*` tokens are inherited custom properties that **pierce** shadow boundaries, so a shadow shell still themes from a `theme-provider` above it — but this needs browser-truth validation. **[Superseded on mechanism by [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md), 2026-07-05]:** the mechanism is **NOT** the reserved class-level `static shadow` seam (all-or-nothing per class) — it is a **per-instance** `isolated` opt-in that `attachShadow`s at connect and **injects the fleet CSS inside the boundary** (incl. the `foundation-styles` `*` ramp; `adoptedStyleSheets(barrelText)` fails — constructable sheets ignore `@import`). The real cross-engine risk is `@scope`-in-shadow + `*`-ramp re-derivation, not token piercing.

**Recommendation:** a **distinct `@agent-ui/app` package** (depends on `components` + `a2ui` + `shared`; the apex of the DAG; the import-layering trip-wire extends with one node) — **not** new controls in `components`. The app-shell primitive within it carries an **opt-in isolation mode** (default light-DOM, matching today's shell) — **validated by browser-truth at M1** (tokens reach in-shadow controls · controls style · host CSS does not leak) before it is committed. This resolves `plan.md` §12's long-parked decision by giving it a concrete consumer and a validation gate. *(The mechanism is [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) — per-instance `attachShadow`, NOT the class-level `static shadow` seam, which stays unused.)*

## 5. Decisions — RATIFIED (Kim, 2026-07-05)

All six decisions are **ratified as recommended**. This table is now the decision record; a change edits the row and re-propagates down.

| ID | Decision | Ratified resolution |
|---|---|---|
| **PRD-D1** | The anchor surface | ✅ **App-shell (regions/docking), M1** — sets the architecture; conversation is the M2 flagship. *(Fork 1)* |
| **PRD-D2** | Relationship to A2UI | ✅ **Host chrome primary**; trusted frame contains untrusted mount; (b) out, (c) future-gated. *(Fork 2)* |
| **PRD-D3** | Layer & boundary | ✅ **New `@agent-ui/app` apex package**; shell = opt-in isolation, validated at M1. *(Fork 3; isolation MECHANISM = per-instance `attachShadow`, [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) — NOT the class-level `static shadow` seam.)* |
| **PRD-D4** | Package name | ✅ **`@agent-ui/app`** — reads as the apex the app-dev consumes. |
| **PRD-D5** | The reference app | ✅ **Re-host `a2ui-live`** — proves the primitives replace bespoke chrome against a known-good baseline. |
| **PRD-D6** | Doc-family location | ✅ **`.claude/docs/prd/` per current charter** — spawns a parallel `agent-app` SPEC/LLD family under `.claude/docs/`. |

**Still open (sub-questions surfaced for M1/M2 design, not blocking the ratified direction):** does the canvas/surface-host fully own the A2UI `produce` loop (generalizing `a2ui-live`'s `produce.ts`) or only the `mount` + stream? Is `conversation + canvas-host` the right **M2** pair? Should the tool-call surface (PRD-G5) stay `could`, or promote if the reference app needs it? These are carried into the M1 decomposition/LLD as design forks, not re-opened PRD decisions.

## 6. First milestone — M1, the anchor (the app-shell layout primitive)

**Shape (outcomes).** Bootstrap `@agent-ui/app` (PRD-D3/D4); ship an **app-shell layout primitive** a developer composes to assemble the persistent chrome (PRD-G2); resolve the opt-in isolation boundary (PRD-D3); re-host the existing `a2ui-live` chrome on the primitive as the acceptance proof (PRD-D5/G1). *The precise region set, the docking model, and the reflow mechanism are the M1 SPEC's to fix (behavior) and the LLD's to build (implementation) — this milestone states the outcomes and the gates, not the mechanism.*

**Acceptance criteria (outcome-level checkable predicates — written before any build is dispatched).**
- [ ] **Package boundary (PRD-D3).** `@agent-ui/app` exists and depends only on `{@agent-ui/components, @agent-ui/a2ui, @agent-ui/shared}`; the import-layering trip-wire is **extended to the new node and green** — no `components → a2ui` cycle, nothing imports `app`.
- [ ] **Assembles without bespoke CSS (PRD-G2).** An app layout is assembled from the primitive with **0 bespoke shell/layout CSS**, and it **adapts responsively to its own container width** (not the viewport); proven **whole-shape** in **Chromium AND WebKit** (`npm run test:browser`).
- [ ] **Isolation resolved (PRD-D3).** Browser-truth resolves the opt-in isolation mode: with isolation on, (a) theme tokens still reach controls composed inside the shell (correct geometry + colour), (b) those controls style correctly, and (c) host-page CSS does not leak in. **If any leg fails, the light-only-vs-opt-in-isolation decision is escalated to Kim with the evidence** — not silently worked around.
- [ ] **Replaces bespoke chrome (PRD-G1 down-payment).** The `a2ui-live` chrome is re-expressed on the primitive with its bespoke shell/layout CSS **removed**; the diff is net-negative bespoke-chrome LOC.
- [ ] **Fleet DoD (PRD-G6).** Each new element ships its `{name}.md` descriptor + passes the contract↔props trip-wire + `component-reviewer` **≥ 4 both axes**; survives `forced-colors: active`.
- [ ] **Gates green.** `npm run check` (+ `check:site`) · `npm test` + `test:browser` · `npm run size` — the last carrying a new `@agent-ui/app` line-item within budget. **Budget (PRD-G6, finding B):** provisional ceiling **≤ ~3 KB gz** for the package's own marginal (the shell element + the `app` barrel; composition-heavy, but the composed controls are already counted in the `components` bundle) — the definitive number is **set at M1 kickoff against a measured baseline** and recorded in the size gate before the first shell commit.

## 7. Milestones (sequencing — the SPEC will own behaviour, the LLD the build order)

- **M1 — App-shell anchor.** The `@agent-ui/app` package + the app-shell layout primitive + the resolved isolation boundary (PRD-D3), proven by re-hosting `a2ui-live`. Sets the architecture. *(PRD-G2, PRD-G6; establishes the PRD-G1 baseline.)*
- **M2 — The agent-native pair.** The conversation surface + the canvas/surface-host (the A2UI mount seam), docked into the M1 shell; the demo's bespoke chat + canvas wiring deleted in favour of them. *(PRD-G3, PRD-G4.)*
- **M3 — Completion.** The tool-call/result surface; the reference agent app carries ~0 bespoke chrome; the tier's coherence + budgets hold. *(PRD-G5, PRD-G1 flagship met.)*
- **M4 — Panes + settings (v1.1 + the v1.2 fork-pass widenings, [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md)).** The
  `ui-split` primitive (components tier, **multi-pane in v1**) · master-detail · the realized
  `collapse: "toggle"` · the settings surface **incl. the schema-driven preferences framework**
  (the SPEC may phase shell → framework within the wave). Additive: the PRD-G1 flagship metric stays
  measured at M3; M4 extends the tier, it does not move v1.0's goalposts. *(PRD-G7, PRD-G8.)*

## 8. Constraints & assumptions (as of 2026-07-05)

**Constraints.**
- **C1 — The import-layering law holds.** Inward-only: `reactive ← dom ← traits ← controls`; cross-package only `components → shared`, `a2ui → components`. The new tier must extend the DAG without a cycle (per [`../../../CLAUDE.md`](../../../CLAUDE.md)); this is what forces PRD-D3.
- **C2 — Zero runtime dependencies; strict decorator-free TS.** `@agent-ui/app` may depend only on the in-repo packages; `erasableSyntaxOnly`/`verbatimModuleSyntax`/`.ts`-extension rules apply.
- **C3 — The fleet DoD is non-negotiable.** Every surface clears the standing bar: `{name}.md` descriptor + contract↔props trip-wire + `component-reviewer` ≥ 4 both axes + cross-engine browser-truth + a `size` budget line-item (per [`../process.md`](../process.md)).
- **C4 — A2UI is consumed, not re-specified.** The renderer, catalog, transport/provider seam, and `produce` loop are owned by the A2UI spec family; this tier mounts and composes them.

**Assumptions.**
- **A-1** — The components fleet + A2UI renderer are stable enough to compose against (both marked DONE in `goals.md`/`NEXT.md`); this tier does not need new fleet controls beyond composition. *Re-verify against the layout family + `renderer.mount()` before M1.*
- **A-2** — The `a2ui-live` demo is a faithful reference for the primitives to generalize (its chrome is representative of a real agent app). *Grounded in `site/pages/a2ui-live.*` + `site/lib/canvas-surface.*`.*
- **A-3** — Custom-property tokens pierce shadow boundaries, so an opt-in per-instance isolated shell (`isolated` → `attachShadow` at connect, [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md); NOT the class-level `static shadow` seam) still themes from an ancestor `theme-provider`. *This is the load-bearing bet behind PRD-D3's isolation sub-fork — it must be validated by browser-truth at M1 (SPEC-R6), not assumed.*
