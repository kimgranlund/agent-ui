# Design intake — `ui-drill`, the N-level drill-down panel container (GH #954)

> Status: proposed · v0.1 · 2026-08-16 · Layer: intake record (fork sheet, `component-design`
> procedure)
> Refines: GH #954 (owner rulings 2026-08-15 + 2026-08-16: the container-vs-trait fork is CLOSED —
> mint `ui-drill` in `controls/`, not a `ui-nav-rail` trait; component-design intake still runs at
> mobilize time for the fork sheet/geometry row/catalog posture, per the second ruling's own text).
> Source research: `.claude/docs/briefs/interaction-enhancements.brief.md` §3.
> Refined by: `.claude/docs/adr/0195-ui-drill-drill-down-panel-container.md` (the one
> contract-changing fork this intake finds — the mint itself) → the component build once the ADR
> ratifies (design-only record; no component source is authored here).

## 1 · The job (one sentence)

A **drill** is a one-viewport container that shows exactly ONE level of an N-level selection tree
at a time, sliding the next level in on a forward selection and the previous level back on Back,
tracking the current position as a path array from day one.

## 2 · Two-plane decomposition (coverage-checked before the sheet)

**Outside-in (parts):** vehicle decision (mint vs compose/widen) · anatomy (host-owned header part
+ author-supplied panel siblings) · props+events contract · path resolution (controlled/
uncontrolled duality) · focus/keyboard/ARIA law · geometry/tokens/motion (incl. the greenfield
view-transition-morph check) · catalog posture · site surfaces + gates · build slices.

**Inside-out (actions the control must support — sourced from the brief §3 + the ticket's own
Acceptance):**

| # | Action | Covered by part |
|---|---|---|
| a | Show exactly one level's content at a time, others stay in the DOM | anatomy (panel `hidden` toggle, the `ui-tab-panel` precedent) |
| b | Drill forward into a child level from an in-panel selection | path resolution (`data-role="drill-trigger"` delegation → `#drillTo`) |
| c | Go back one level, keyboard-reachable | anatomy (`[data-part="back"]` real `<button>`) + events (`change`) |
| d | Bindable `path` so a consumer/agent can read or drive position | props (`path`, controlled/uncontrolled duality — the `ui-split.sizes` precedent) |
| e | Focus moves to the incoming panel's heading on a level change | focus law (`[data-part="heading"]` tabindex=-1 target, primed-guard against stealing focus on first paint) |
| f | Animate the swap; no second animation mechanism | geometry/motion (`@starting-style`/`allow-discrete` CSS-transform base + the ADR-0183 `withViewTransition` seam as opt-in enhancement) |
| g | N-level API proven at 2 levels first | path resolution (path is `string[]` unbounded, no level-count constant anywhere) |
| h | Zero-dep | precedent sweep (every mechanism below is either platform-native or an existing fleet seam) |

Coverage holds — every action maps to a part, every part is exercised — the sheet may proceed.

## 3 · Precedent sweep (SOURCE read, nothing redesigned)

| Mechanism needed | Reused precedent (SOURCE read) | Owner |
|---|---|---|
| Show-one-hide-rest panel visibility (`hidden` attribute, panel stays in DOM) | `ui-tab-panel` (`controls/tabs/tab-panel.ts`, read end-to-end) | tabs family |
| Controlled/uncontrolled array-prop duality, prop-as-source-of-truth, `attribute: false` + `prop.json` | `ui-split`'s `sizes: number[] \| undefined` (`controls/split/split.ts:30-38`, `#effectiveRatios`/`#commitRatios`) | ADR-0102 · split family |
| Bindable position two-way, commit-on-user-gesture only (agent SETS, user gesture COMMITS + emits) | `ui-tabs`' `selected` (`controls/tabs/tabs.ts` header comment) | ADR-0019 |
| One opt-in animation seam, byte-identical when off, reduced-motion aware | `withViewTransition`/`viewTransitionAvailable` (`components/src/dom/view-transition.ts`, read end-to-end) | ADR-0183 |
| The named-morph convention — same `view-transition-name` on every element that can occupy ONE visual role, only one ever painted at a time | `viewTransitionName`/`setViewTransitionName` (`view-transition.ts:28-77`); the PAIRING LAW at `view-transition.ts:42` ("every segment in a segmented pane, only one ever visible at a time via CSS") is the exact shape this build applies to panels. The brief itself (not this source file) names "the drill-down panel of §3" as the named-morph convention's natural next consumer (`interaction-enhancements.brief.md:178,185`) | GH #958 |
| CSS-transform-based entry/exit as the base (non-VT) motion, degrading gracefully | `ui-drawer`'s edge-slide (`@starting-style` + `transition-behavior: allow-discrete`, ADR-0188 cl.5) | ADR-0188 |
| A control-owned header PART (created once, real `<button>` inside, control-height row atop a content viewport) | `ui-tabs`' tablist part (`controls/tabs/tabs.ts` header, the reparented-tablist-strip shape); the created-once/idempotent-guard PATTERN itself is `disclosure.ts`'s `#ensureParts` (`controls/disclosure/disclosure.ts:93`) | tabs family + disclosure family |
| One level's existing app-shape precedent (2-pane, CSS-driven collapse, NOT reusable as a mechanism) | `ui-nav-rail collapse="drill-in"` (SPEC-R7, `app/src/controls/nav-rail/nav-rail.ts:43,64-68`) — confirms the brief's "app-level code, not a fleet primitive" read; nothing here is imported | SPEC-R7 |
| Container base + surface axes | `UIContainerElement` (`dom/container.ts`, read end-to-end) | ADR-0015/0016 |

## 4 · Fork sheet

### The mint-vs-compose row — applied explicitly

**Verdict: MINT `ui-drill`** — confirming both owner rulings by mechanics.

- **The aggregate-value bar** (`component-design/references/mint-vs-compose.md`, ADR-0175):
  checked and NOT APPLICABLE — `path` is a navigation-state array, not a form value; `ui-drill` is
  `formAssociated: false` like `ui-split`/`ui-drawer`, nothing round-trips through
  `ui-form-provider.values()`. The operative test is ADR-0102's three-lane chooser instead.
- **Lane 1 — compose shipped controls:** NO. `ui-nav-rail collapse="drill-in"` is a 2-PANE
  master↔detail flip, CSS-keyed to the rail's own collapse machinery, composed exactly once by
  `ui-settings` — it has no path-array state, no N-level stack, and generalizing it into a reusable
  mechanism is a DIFFERENT ruling the owner already declined (both comments on #954 close the
  container-vs-trait fork explicitly in favor of the container). `ui-tabs` gets closest
  mechanically (show-one-hide-rest) but has no notion of a PATH/tree — widening it to carry an
  arbitrary-depth path array is a second, unrelated concern bolted onto a flat selection widget.
- **Lane 2 — widen an existing control:** NO, for the same reason as Lane 1 — no existing control
  carries path-array/tree-position state; there is nothing to widen without changing what that
  control fundamentally IS (the timeline/status-stream one-family-vs-two test: flipping `ui-tabs`
  from a flat index to an arbitrary-depth path changes its data model, its keyboard map, and its
  event payload shape all at once — three axes, not one).
- **Lane 3 — mint:** YES, and it is CHEAP by the same "minting is cheap when it is" check: the
  interior reuses `ui-tab-panel`'s hidden-toggle shape, `ui-split`'s controlled/uncontrolled prop
  duality, and the EXISTING `withViewTransition` seam verbatim — no new base class, no new trait,
  no new event name, one new host-owned part (`[data-part="back"]`, a real `<button>`).

### The standard rows

| Row | Decision | Justification (one line) |
|---|---|---|
| **Tag** | `ui-drill` / `UIDrillElement` (`controls/drill/drill.{ts,css,md}`) + `ui-drill-panel` / `UIDrillPanelElement` (`controls/drill/drill-panel.{ts,css,md}`) | naming law §1/§2/§9 — `drill` is not a reserved word/concept-canon collision (grep clean), derivable from the brief's own §3 heading |
| **Anatomy** | Host creates ONCE a `[data-part="header" data-box]` strip containing `[data-part="back"]` (real `<button type="button">`, hidden/disabled at the root) and `[data-part="heading"]` (`tabindex="-1"`, text mirrors the active panel's `heading` prop). Panels are AUTHOR children (`ui-drill-panel[key][parent][heading]`), left as siblings (NOT moved — the tabs precedent, not the modal child-move precedent) — the host toggles `hidden` on every panel but the active one | matches `ui-tabs`' host-owned-strip + sibling-panels shape exactly; the modal child-move pattern doesn't fit here because panels are peers, not a single wrapped region |
| **Props (host)** | `...UIContainerElement.surfaceProps` + `path: string[] \| undefined` (`prop.json`, `attribute: false`, default `undefined` = UNCONTROLLED) + `viewTransitions` (boolean, reflected, `attribute: 'view-transitions'` — the `ui-super-shell` naming precedent, ADR-0183 S2) | `path` mirrors `ui-split.sizes` exactly (controlled-when-present / uncontrolled-internal-signal-when-absent, ADR-0102 prop-as-source-of-truth) |
| **Props (panel)** | `key: string` (required, unique per instance across ALL panels) · `parent: string` (default `''` = root; exactly one root panel per `ui-drill` instance) · `heading: string` (default `''`, drives the host's `[data-part="heading"]` text + the a11y focus target's accessible name) | flat sibling model with parent-chain, not DOM nesting — avoids recursive custom-element depth while still expressing arbitrary tree depth via the `path` chain |
| **Events** | `change` only, ⊂ the closed seven — fired with `event.detail: string[]` (the proposed/new path) on every Back click AND every drill-forward activation; UNCONTROLLED mode also self-mutates the internal path signal (the `ui-split` precedent verbatim) | no event fork; a position COMMIT (closer to `ui-split`'s ratio-commit than a discrete `select` pick) |
| **Path resolution / drill-forward mechanism** | `path` is the FULL chain from root to the current leaf, INCLUSIVE of the root key — `path[0]` is always the root panel's `key`. `path` is NEVER empty: at connect (uncontrolled) or on first controlled render with `path` unset/`[]`, the effective path seeds to `[rootKey]`, so "the active panel" is always a plain `path.at(-1)` lookup with no root-vs-non-root special case. `#drillTo(key)` APPENDS `key` to the current effective path (it never recomputes a chain from `parent` — a panel's `parent` attribute is consulted ONLY to compute the Back button's label, never to resolve the active panel). A `key` absent from the panel set, or a controlled write whose interior keys don't actually chain via `parent`, resolves by walking `path` from the end and taking the first entry that DOES name a real panel (falling back to the root key if none match) — the `ui-tabs` overflow-set fallback-to-pinned-selected precedent adapted, never a hard throw. Any AUTHOR descendant of the ACTIVE panel carrying `data-role="drill-trigger"` + `data-drill-key="<key>"` triggers `#drillTo(key)` on `click` (native buttons/anchors get Enter/Space free; a delegated `keydown` covers a non-native trigger element) | a declarative, zero-JS-required authoring convention — the `card`/`disclosure` `data-role`/`data-part` grammar applied to a new anatomy need; always-populated `path` removes the empty-array ambiguity the doc review found |
| **Geometry** | **tier: `pattern`** — the header strip is an interactive control-height row (`--md-sys-height-*`) atop a viewport whose content uses the space scale, no control height (geometry.md's Pattern-class row: "container + control-height rows... interactive rows take the control height, the shell uses the space scale" — tabs'/toolbar's own class) | matches `ui-tabs`, not `ui-split`/`ui-drawer` (those are pure `container`/`layout`, no host-owned interactive chrome) |
| **Tokens** | `--ui-drill-ink` / `--ui-drill-outline` (header hairline) / `--ui-drill-header-height` (control-height derived) / `--ui-drill-padding` (space-scale) — each consuming an existing `--md-sys-*` role; the back button's icon/ink reuse the existing icon-button color roles, no new role | zero new system roles |
| **A11y** | Host: `this.internals.role = 'group'` on `ui-drill` (a labelled navigation region, the lightest correct role for a container with no native semantic — `ui-modal`'s `internals.role` precedent, not a host attribute). `[data-part="back"]` is a real `<button>` (native Tab/Enter/Space, `aria-label` = "Back" or "Back to {parent heading}" where resolvable); `[data-part="heading"]` is a real `<h2>` (an actual heading element, not just an ARIA label target — a drill level IS a navigable section), `tabindex="-1"`, focused programmatically on every NON-initial path change (a `#primed` guard set after the first render pass prevents focus theft on mount). `ui-drill-panel` sets `this.internals.role = 'region'` with `aria-labelledby` element-reflected to the header's `[data-part="heading"]` (the `ui-tab-panel`/`aria-labelledby` element-reflection precedent, `tab-panel.ts:26`) whenever it is the active panel; `Escape` wired as a convenience alias for Back (not required by the AC, zero cost, standard drill-down UX expectation) | the `ui-tab-panel` `tabindex=0`-on-focus-target precedent adapted to a `-1` programmatic-only target (a heading is not normally tab-stopped, only focus-jumped-to); a real `<h2>` (not a generic `<div>`) gives screen-reader users level navigation for free |
| **Interaction states** | no deviation — the back button follows the fleet four-state standard; panels are plain content, no interaction-state law of their own | no row-level fork |
| **Form participation** | NONE — `UIContainerElement`, not form-associated, same reasoning as `ui-split`/`ui-drawer`/`ui-tabs` | no codec, no value, no validity |
| **Motion (greenfield-mechanism check, step 5)** | **Exclusivity ruling (doc-review fix, both minors folded in):** the CSS-transform base and the View Transitions layer are MUTUALLY EXCLUSIVE per swap, never stacked, and the exclusion is keyed on WHETHER THE SEAM WILL ACTUALLY RUN THIS SWAP — not on the raw `[view-transitions]` opt-in attribute (an opted-in instance on an unsupported/reduced-motion engine must still get the CSS base, or it gets no animation at all). `#commit` computes `willUseVT = this.viewTransitions && viewTransitionAvailable()` per swap and sets a host marker (`data-vt-active`, present only for that one swap) BEFORE mutating; `drill.css` scopes its `@starting-style`/`allow-discrete` transition rules to light-DOM panel children as `:scope:not([data-vt-active]) > ui-drill-panel` (a light-DOM `@scope` selector — controls carry no shadow root, so no `:host()` form applies here). When `willUseVT` is true, the CSS base is excluded for that swap and the ADR-0183 `withViewTransition` seam wraps the `hidden`-toggle mutation instead — every `ui-drill-panel` carries the SAME `view-transition-name` (`viewTransitionName('drill', instanceToken)`, `instanceToken` = `this.id` if authored, else a per-document `#drillSeq` counter minted once at connect — the `ui-super-shell` multi-instance-collision precedent) — the pairing law's own worked example ("every segment in a segmented pane, only one ever visible at a time"), since exactly one panel is ever painted. When `willUseVT` is false (VT off, or unsupported, or reduced-motion), the CSS base runs: `@starting-style` (entry) + `transition-behavior: allow-discrete` (exit) on the panel's `opacity`/`transform: translateX` pair, degrading to instant hide/show where neither is supported (the `ui-drawer` precedent verbatim) — direction (`forward`/`back`) rides a host-set `data-direction` attribute (set by `#commit` before the mutation, read by `drill.css`'s translateX sign). `prefers-reduced-motion` is folded into `willUseVT`'s computation on the VT side (the seam's own gate) and into the CSS base's own media-query guard on the other (the split/tabs/radio/drawer precedent) — so it is never possible for BOTH layers, or NEITHER layer, to run for the same swap | satisfies the AC's "CSS-transform fallback — no second animation mechanism": exactly one of the two layers ever animates a given swap, decided per-swap by what will actually execute, never both and never neither; VT is a REPLACEMENT enhancement, not a second concurrent animation. No JS timing/easing prop is minted, so the mechanism-honors-every-attribute check passes trivially (same as `ui-drawer`'s) |
| **Site surfaces** | `drill.md` + `drill-panel.md` descriptors (tier `pattern`/`container` resp., `extends: UIContainerElement` both, validate against `component-descriptor.ts` enums) · doc page + demo page · gallery/preview specimen (2-level minimum, per the AC) · the standing descriptor/site gates | the testing map owns the bar; build slices below |
| **Catalog posture** | **TEMPORARY exclusion (the `Toggle`/ADR-0179 precedent shape), shipped ahead of its catalog row.** `a2ui` is team-led (out of this build's authorization) and the ticket's own Acceptance criteria name no catalog/A2UI requirement — whether `ui-drill` earns a `Drill` row (and what its children/path wire-mark should look like) is a separate, later decision, not a chrome/security PERMANENT exclusion like `Toast`/`CommandModal` | keeps this build scoped to what GH #954 actually asks for; named explicitly as a rejected-alternative (see the ADR + PR) so the exclusion reads as deliberate, not a gap |

## 5 · Classification (the three axes, descriptor-enum vocabulary)

- **Base class:** `UIContainerElement` for both `ui-drill` (surface container, not form-associated)
  and `ui-drill-panel` (plain content region, the `ui-split-pane` shape) — none of the `_base`
  families fit (no indicator/range/listbox semantics).
- **Size-class / tier:** `ui-drill` → `pattern` (control-height header row atop space-scale
  content, the tabs/toolbar/accordion class); `ui-drill-panel` → `container` (pure content wrapper,
  no control height of its own).
- **Catalog posture:** TEMPORARY exclusion (see fork sheet's last row) — drains on a later, separate
  a2ui-owned decision.

## 6 · Novelty leg (step 5) — the one genuinely new piece

The path-array-driven "show exactly one node of an N-deep tree, siblings as a flat parent-chain"
resolution has no direct fleet precedent (tabs is flat/1-deep; split is N-pane but all-visible).
Derived from `geometry-sizing-spec.md`'s pattern-tier law + the two nearest mechanics (tabs'
show-one-hide-rest, split's controlled/uncontrolled duality) rather than invented from nothing — no
new geometry ROW, no new base CLASS, no new interaction FAMILY is proposed; only the flat
parent-chain resolution algorithm itself is new, and it is pure data-lookup (no DOM/CSS novelty),
so it does not independently earn ADR-fork treatment beyond the mint decision already covering it.

## 7 · Decomposition + test plan (build slices, one writer per file)

1. `controls/drill/drill-panel.ts` + `.css` + `.md` — the leaf sub-element (props, `hidden` default,
   no behavior beyond what the host drives).
2. `controls/drill/drill.ts` — host: parts, path resolution (controlled/uncontrolled), drill-trigger
   delegation, Back, focus management, view-transition wiring.
3. `controls/drill/drill.css` — `@scope`, `--ui-drill-*` roles, the CSS-transform base motion,
   reduced-motion guard.
4. jsdom unit tests (`drill.test.ts`, `drill-descriptor.test.ts`) — path resolution (controlled/
   uncontrolled), event payloads, ARIA/focus-target wiring, descriptor validity.
5. Browser shard tests (`drill.browser.test.ts`) — real focus-move assertion, `hidden` toggling,
   Back keyboard reachability, reduced-motion CSS gate.
6. Docs site: `drill.md`-derived doc page + a 2-level (root → child) preview specimen with real
   category content (`example-authoring` laws — no lorem stub), gallery entry.
7. Barrel export (`controls/index.ts`) + `family-coherence.test.ts`/`naming-gates.test.ts` residency
   (automatic once the descriptor lands, per the standing gates).

Every leaf's accept-criteria cites the `component-testing` bar; a built-output leg is not required
(no production-CSS-dependent behavior beyond the ordinary `@scope` styling every control already
carries).

## 8 · Independent doc review

Gated per `component-design` step 8 — a fresh-context `docs:doc-checker` pass runs on this intake +
the paired ADR before the build dispatches (recorded in the issue's Findings once returned).
