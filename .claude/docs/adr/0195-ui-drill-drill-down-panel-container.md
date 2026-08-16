# ADR-0195 — `ui-drill` (GH #954): a NEW N-level drill-down panel container is minted in `controls/`, path-array state from day one, on the existing tabs/split/view-transition mechanics — not a `ui-nav-rail` trait

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-16
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-16 |
> | **Proposed by** | `build-lead`/`dispatch-ticket` (GH [#954](https://github.com/kimgranlund/agent-ui/issues/954)'s design leg — the owner's 2026-08-15 and 2026-08-16 comments already close the container-vs-trait fork itself; this ADR is the fork sheet's mint decision, not a re-litigation) — the fork sheet is [`../spec/drill.intake.md`](../spec/drill.intake.md) |
> | **Ratified by** | *(pending — never self-ratified; Kim flips this field by explicit naming, `doc-standards` §1b)* |
> | **Repairs** | on ratification+build: `controls/drill/drill.{ts,css,md}` + `controls/drill/drill-panel.ts` (the `ui-tab-panel` compound-file precedent — no separate `drill-panel.md`/`.css`; the leaf shares `drill.md`'s descriptor scope and `drill.css`'s single sheet) + barrel export + jsdom/browser tests · site doc/demo surfaces + the standing descriptor/site gates · a `component-patterns` table row for the show-one-hide-rest + controlled-array-prop-duality combination (novelty leg, §6 of the intake) — per the intake's §7 build slices |
> | **Supersedes / Superseded by** | **Relates** ADR-0102 (the three-lane chooser applied) · ADR-0175/`mint-vs-compose.md` (checked, not applicable) · ADR-0183/GH#958 (the view-transition seam + named-morph convention this build is the first proven consumer of) · ADR-0188 (the CSS-transform base-motion + intake-doc-shape precedent) · ADR-0019 (bindable two-way state) · ADR-0087/0112 (catalog posture — TEMPORARY exclusion here, Toggle/ADR-0179 shape) · **Resolves** GH [#954](https://github.com/kimgranlund/agent-ui/issues/954)'s container-vs-trait fork (mint decision + fork sheet; the two owner comments already named the OUTCOME, this ADR supplies the MECHANICS ruling that outcome requires before build) |

## Context

The interaction-enhancements research brief (`.claude/docs/briefs/interaction-enhancements.brief.md`
§3) found the fleet has only `ui-nav-rail collapse="drill-in"` (SPEC-R7) — a 2-pane master↔detail
flip, CSS-driven, composed exactly once by `ui-settings`, app-layer-only, no path-array state, no
N-level stack. The owner ruled the vehicle TWICE on this issue (2026-08-15: "CONTAINER — mint
`ui-drill`"; 2026-08-16: "Fork resolved: new `ui-drill` container in `controls/` (not a nav-rail
trait)"), each time naming that component-design intake still runs at mobilize time for the fork
sheet/geometry row/catalog posture. The intake ([`drill.intake.md`](../spec/drill.intake.md)) ran
the mint-vs-compose test explicitly rather than deferring to the ruling:

- The **aggregate-value bar** (`mint-vs-compose.md`, ADR-0175) does not apply — `ui-drill` carries
  no form value; `path` is navigation state, not a value round-tripped through
  `ui-form-provider.values()`.
- **Composing/widening `ui-nav-rail` fails both branches.** The rail's `drill-in` collapse mode is
  CSS-keyed to its own `@container` threshold machinery and has no path-array/tree-position concept
  at all — generalizing it into a reusable N-level mechanism is the trait alternative the owner
  already declined on this issue, twice.
- **Widening `ui-tabs`** (the nearest mechanical sibling — show-one-hide-rest panel visibility)
  fails the divergent-axes count: flipping its flat `selected` index into an arbitrary-depth `path`
  array changes the data model, the keyboard map, and the event payload shape at once — three axes,
  not one.
- **The mint is cheap** (the reference's own check): the interior reuses `ui-tab-panel`'s
  hidden-toggle shape, `ui-split`'s controlled/uncontrolled prop duality (ADR-0102), and the
  EXISTING `withViewTransition`/named-morph seam (ADR-0183/GH#958) verbatim — no new base class, no
  new trait, no new event name.

What makes this contract-changing rather than routine: two new tags enter the fleet's closed
control set, a new `--ui-drill-*` token family is minted, and this is the first real consumer of
the GH#958 named-morph convention — a convention the interaction-enhancements brief itself names
this exact ticket as the natural next proof for (`interaction-enhancements.brief.md:178,185`, not
`view-transition.ts`, which carries the pairing law but no drill-specific forward reference).

## Decision

1. **Mint `ui-drill` / `UIDrillElement` (`controls/drill/`), a `pattern`-tier `UIContainerElement`**,
   plus its sibling leaf `ui-drill-panel` / `UIDrillPanelElement` (`container`-tier
   `UIContainerElement`, the `ui-split-pane`/`ui-tab-panel` shape — no behavior of its own beyond
   props). The host creates ONCE a `[data-part="header" data-box]` strip holding
   `[data-part="back"]` (a real `<button type="button">`) and `[data-part="heading"]`
   (`tabindex="-1"`, the focus-move target); author `ui-drill-panel` children stay SIBLINGS (not
   moved — the tabs precedent, not the modal child-move precedent), the host toggling `hidden` on
   every panel but the one resolved active.
2. **Path resolution is a flat parent-chain, not DOM nesting.** Every panel carries `key` (unique
   per instance) and `parent` (default `''` = root; exactly one root panel per instance).
   `path: string[]` is the FULL chain INCLUSIVE of the root key — `path[0]` is always the root
   panel's `key`, and `path` is NEVER empty (an uncontrolled instance seeds it to `[rootKey]` at
   connect; a controlled instance whose `path` renders `undefined`/`[]` resolves the same way) — so
   "the active panel" is always a plain `path.at(-1)` lookup with no root-vs-non-root special case.
   `#drillTo(key)` APPENDS `key` to the current effective path (it never recomputes a chain from
   `parent` — `parent` is consulted only for the Back button's label, never for active-panel
   resolution). An unresolvable `key`, or a controlled `path` whose interior entries don't actually
   chain via `parent`, resolves by walking from the end of `path` for the first entry that names a
   real panel, falling back to the root key — the `ui-tabs` overflow-set fallback-to-pinned-selected
   precedent adapted, never a hard throw. Forward navigation is a declarative authoring convention:
   any descendant of the ACTIVE panel carrying `data-role="drill-trigger"` + `data-drill-key="<key>"`
   triggers `#drillTo(key)` on click (native buttons/anchors get Enter/Space free; a delegated
   keydown covers non-native triggers) — the `card`/`disclosure` `data-role`/`data-part` grammar
   applied to a new anatomy need, not a new grammar.
3. **`path` is controlled/uncontrolled exactly like `ui-split.sizes` (ADR-0102 prop-as-source-of-
   truth):** `path: string[] | undefined` (`prop.json`, `attribute: false`, default `undefined`).
   UNCONTROLLED (`path` absent): an internal signal drives the render AND self-mutates on Back/
   drill-forward — it "just works" with no consumer wiring. CONTROLLED (`path` present): the host
   renders `path` and only EMITS the proposed value on `change`, never self-mutating — the consumer
   (or an agent) owns the write-back, exactly `ui-split`'s established contract.
4. **Events: NO new names.** Emits `change` only (⊂ the closed seven), `event.detail: string[]` —
   the proposed/new path, on every Back click and every drill-forward activation. A position
   COMMIT, closer to `ui-split`'s ratio-commit than a discrete `ui-tabs`-style `select` pick.
5. **Focus + a11y:** `this.internals.role = 'group'` on the host, `role = 'region'` +
   element-reflected `aria-labelledby` (the `ui-tab-panel` precedent, `tab-panel.ts:26`) on the
   active panel. `[data-part="heading"]` is a real `<h2>` (not a generic div — a drill level is a
   navigable section), `tabindex="-1"`, receiving programmatic focus on every render whose
   RESOLVED ACTIVE KEY actually differs from the previous render's (a `#primed` guard prevents
   focus theft on mount; a narrower `#lastActiveKey` comparison — component-checker MAJOR fix —
   prevents an UNRELATED re-render, e.g. a panel appended/removed elsewhere, from replaying the
   focus move or the VT swap below).
   `[data-part="back"]`'s `aria-label` reads "Back" or "Back to {parent heading}" where resolvable.
   `Escape` is wired as a Back alias (a convenience beyond the AC's literal ask, zero cost, the
   standard drill-down UX expectation).
6. **Motion: the CSS-transform base and the View Transitions layer are MUTUALLY EXCLUSIVE per
   swap, keyed on whether the seam will ACTUALLY run — never on the raw opt-in attribute, and
   never stacked or both-absent.** `#render` computes `willUseVT = this.viewTransitions &&
   viewTransitionAvailable()` per swap (folding in `prefers-reduced-motion` via the seam's own
   gate) and sets a `data-vt-active` host marker for exactly that swap before mutating. `drill.css`
   scopes its CSS-transform base to light-DOM panel children (controls carry no shadow root, so no
   `:host()` selector applies) as `:scope:not([data-vt-active]) > ui-drill-panel`: `@starting-style`
   (entry) + `transition-behavior: allow-discrete` (exit) on `opacity`/`transform: translateX` — the
   `ui-drawer` precedent (ADR-0188 cl.5) verbatim, direction riding a host-set `data-direction`
   attribute, degrading to instant hide/show where unsupported. When `willUseVT` is true, this base
   is excluded for that swap (the reason: `allow-discrete` keeps the outgoing panel painted through
   its exit duration, so running both would leave two panels carrying the identical
   `view-transition-name` at snapshot-capture time and the platform would SKIP the transition
   entirely — a real defect the design review caught) and the ADR-0183 `withViewTransition` seam
   wraps the `hidden`-toggle mutation instead: every `ui-drill-panel` gets the SAME
   `view-transition-name` (`viewTransitionName('drill', instanceToken)`, `instanceToken` = `this.id`
   if authored else a per-document counter minted once at connect, the `ui-super-shell`
   multi-instance-collision precedent) — GH#958's pairing law worked example applied verbatim
   ("every element that can occupy one visual role, only one ever visible at a time"), since exactly
   one panel is ever painted. Keying the exclusion on `willUseVT` (not the bare attribute) is what
   guarantees exactly one layer runs for every swap, including an opted-in instance on an
   unsupported or reduced-motion engine (which still gets the CSS base, never neither). No JS
   timing/easing prop is minted, so the mechanism-honors-every-attribute check (the swiper lesson)
   passes by construction, same as `ui-drawer`'s.
7. **Geometry + tokens.** `ui-drill` classifies `tier: pattern` (control-height header row atop a
   space-scale content viewport — the tabs/toolbar/accordion class, `geometry.md`'s existing Pattern
   row, NOT a new row); `ui-drill-panel` classifies `tier: container` (no control height of its
   own). Minted roles — `--ui-drill-{ink,ink-muted,outline,header-height,header-pad-inline,header-gap,padding,back-radius,motion-duration,motion-easing,slide-distance}` — each consume an existing
   `--md-sys-*` role; zero new system roles, zero new motion tokens (the header-height token derives
   from the existing `--md-sys-height-*` control-height ladder).
8. **Catalog posture: TEMPORARY exclusion**, the `Toggle`/ADR-0179 precedent shape — shipped ahead
   of its catalog row. `a2ui` is team-led (out of this build's authorization) and GH #954's own
   Acceptance criteria name no catalog/A2UI requirement. Whether `ui-drill` earns a `Drill` row
   (and its wire-mark shape for `path`/children) is a separate, later decision — not a chrome/
   security PERMANENT exclusion like `Toast`/`CommandModal` (ADR-0112 cl.6). Named here explicitly
   as the build's one deliberate scope cut.
9. **Not form-associated** — `UIContainerElement`, same reasoning as `ui-split`/`ui-drawer`/
   `ui-tabs`: a navigation container contributes nothing to a form.

## Consequences

- **Two new tags join the fleet's closed control set** (`ui-drill`, `ui-drill-panel`), each with
  its own descriptor/`.md`/CSS/tests per the standing per-component build bar — this is the ordinary
  cost of any mint, named because it is the thing a fork-vs-trait choice against `ui-nav-rail` would
  have avoided (and this ADR rules that avoidance not worth the coupling it would buy).
- **A new `--ui-drill-{ink,ink-muted,outline,header-height,header-pad-inline,header-gap,padding,back-radius,motion-duration,motion-easing,slide-distance}` token family** is minted, each consuming
  an existing `--md-sys-*` role — zero new system roles, zero new motion tokens, so no downstream
  token-audit or theme-file update is owed beyond the ordinary per-component token wiring.
- **A `component-patterns` table row is owed** (Repairs, above) documenting the show-one-hide-rest +
  controlled/uncontrolled-array-prop combination as a reusable pattern description — the novelty leg
  the intake's §6 identifies — so a future container with similar N-level-position semantics does
  not re-derive it from first principles.
- **The catalog decision is deliberately deferred, not closed.** `ui-drill` ships with NO `Drill`
  A2UI catalog row (Decision cl.8); until a2ui's own team rules on it, an agent cannot emit a drill
  container through A2UI at all. This is a real, named capability gap, not silence — tracked the
  same way `Toggle`'s (ADR-0179) deferred catalog decision is tracked in
  `EXCLUSION_ALLOWLIST` as TEMPORARY.
- **The GH#958 named-morph convention gains its first real, shipped consumer beyond its own seam
  file** — a future second consumer (a router-outlet page swap, per the brief §4) has a worked
  precedent to follow rather than re-deriving the pairing law's instance-discriminator handling.
- **Path resolution's always-populated-`path`/append-only-`drillTo` contract is a real behavioral
  commitment**, not just an implementation detail: a consumer reading `path` never sees an empty
  array, and a consumer setting `path` directly (controlled mode) to a non-chaining sequence gets a
  DEFINED (not undefined) fallback resolution rather than a thrown error — both are now part of the
  component's public contract the SPEC-equivalent (this ADR + the intake) freezes, and a builder
  deviating from either without a design reopen is the process breach `component-design` step 8
  names.

## Rejected alternatives

- **Generalize `ui-nav-rail collapse="drill-in"` into a shared trait** both `ui-nav-rail` and a new
  consumer could use — the owner's OWN first-choice framing in the ticket body, explicitly declined
  by both ruling comments on this issue. Rejected because the rail's drill-in is 2-pane/CSS-keyed
  machinery with no path-array concept; extracting a trait from it would still need to invent the
  N-level path resolution from scratch, buying none of the "reuse" a trait extraction is supposed to
  offer.
- **Widen `ui-tabs` with a tree-aware `selected`** — rejected on the divergent-axes count (data
  model, keyboard map, event payload shape all flip at once; §Context).
- **Ship a `Drill` A2UI catalog row in this same build** — rejected as scope creep past what GH
  #954's Acceptance criteria actually ask for; `a2ui` catalog authorship is team-led. Named as a
  TEMPORARY exclusion (Decision cl.8), not silently dropped.
- **DOM-nested `ui-drill-panel` children (a panel containing its own next-level panel as a literal
  DOM child)** instead of the flat parent-chain — rejected for recursive custom-element depth with
  no corresponding benefit: the flat model expresses the same arbitrary tree depth via `path` alone,
  with simpler single-level DOM queries at render time.
