# ADR-0121 — `ui-toolbar`: a Pattern-class action bar, one element across floating & embedded postures

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-10 |
> | **Proposed by** | design intake (TKT-0009, Kim's directive 2026-07-10: *"a `ui-toolbar` that works floating OR embedded in a shell header — one element, two postures"*). The fleet has no toolbar primitive; the a2ui corpus's `document-row-toolbar` seed (in `catalog-coverage.ts`) hand-composes one from `Card+Row+Attachment+overlays` precisely because none exists — recorded evidence of the gap. |
> | **Ratified by** | Kim, 2026-07-11 — hand-flipped in-tree (07:01 PT) + confirmed at the ratification prompt |
> | **Repairs** | NEW [`../spec/toolbar.spec.md`](../spec/toolbar.spec.md) · NEW [`../lld/toolbar.lld.md`](../lld/toolbar.lld.md) · NEW [`../decompositions/toolbar-ship.decomp.json`](../decompositions/toolbar-ship.decomp.json) (coverage-clean, plan mode, exit 0). On ratification+build: NEW `packages/agent-ui/components/src/controls/toolbar/*` · a `Toolbar` catalog row in `packages/agent-ui/a2ui/src/catalog/default/*` (F7, emittable) · the `document-row-toolbar` corpus seed upgraded to the real `Toolbar` type · NEW `site/pages/toolbar-{doc,demo}.ts` · a `<component-gallery>` specimen |
> | **Supersedes / Superseded by** | relates ADR-0015 (the `elevation`/`brightness` surface seam this reuses as the posture lever) · relates the `roving-focus` trait / ADR-0042 family bases (`UIContainerElement`, the tabs precedent) · relates ADR-0039 (the box-alignment dialect `align`/`justify` reuse) · relates ADR-0052 (`[data-box]` z-scope for the raised posture) · relates ADR-0087 (the catalog-or-allowlist gate F7 answers) · relates ADR-0112 cl.6 (the Toast/ToastRegion exclusion test F7 applies; and the record whose `document-row-toolbar` seed F7 re-bases) · relates ADR-0043/0045 (the overlay/dismissal law this deliberately does NOT inherit — §F1) |

## Context

`ui-toolbar` is a **greenfield** control — no toolbar element exists anywhere in `@agent-ui/components`. The
nearest fleet artifacts are prose examples in the `row`/`list` descriptors and, tellingly, the a2ui corpus's
`document-row-toolbar` seed (in `packages/agent-ui/a2ui/src/examples/catalog-coverage.ts`), which
hand-composes an action cluster out of `Card`, `Row`, `Attachment`, `Tooltip`, `Popover`, and `Menu`
because there is no toolbar primitive to emit. That hand-composition is both the proof the gap is real and a
catalog-posture argument (F7): agents already want to emit toolbar-shaped UI.

Two prior arts were studied (per TKT-0009), and **promoted to this fleet's laws, never ported**:

- **The published `ui-kit.exe.xyz` docs page** — fetched twice at intake (`/site/components/toolbar` and its
  trailing-slash form); **both returned only a client-side "Loading changelog…" SPA shell with zero component
  content.** No prop/behavior names could be read from it. Per the repo-absence-vs-spec-absence rule, this
  ADR draws **nothing** from that source and fills no gap from memory; the design is grounded entirely in the
  adia prior art (read in full) and the fleet's own laws.
- **The adia `gen-ui-kit` toolbar family** (`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/
  components/toolbar/`, read in full) — a **two-tag** family: `<toolbar-ui>` (props `gap`/`align`/`overflow`/
  `bordered`; `role="toolbar"`; a `ResizeObserver`+`MutationObserver`-driven **overflow-to-spillover-popover**
  reflow that moves end items into a `popover=manual` menu, keeping `<toolbar-group-ui>` clusters atomic and
  trimming trailing dividers) + `<toolbar-group-ui>` (a `role="group"` cluster with no chrome). Its posture is
  a single flex row (`toolbar.css`) with a `bordered` variant. It is a shadow-DOM-free, capable design — but
  its ~13 KB overflow engine, its `role`/`aria-*` on host attributes, and its two-tag family shape are all
  fleet-law questions this ADR resolves rather than copies.

Seven forks decide the shape of the promotion; each is resolved below with a firm recommendation, none
self-ratified. **No novelty leg is taken:** `geometry.md`'s size-class table already names `toolbar`
explicitly as a **Pattern**-class example, so the geometry classification is a lookup, not an invention.

## Decision

Ship **`ui-toolbar`** — a real `UIContainerElement`-based **Pattern**-class control in
`packages/agent-ui/components`'s `controls/` tier: a light-DOM flex row of the consumer's own interactive
controls, giving them `role="toolbar"` + arrow-key roving focus, with the floating/embedded posture expressed
through the existing surface axis rather than a new positioning machine. **The toolbar is arrangement + focus
semantics, not a command bus** — it emits no events and owns no value (TKT-0009 non-goal).

### F1 — the dual-posture mechanism: **one element; posture is the existing surface axis, not a positioning machine, not the overlay family**

The question TKT-0009 poses is "one element with a posture axis vs posture-by-composition." Decomposed to
first principles, the *only* things that actually differ between a floating formatting bar and a
shell-header-embedded bar are **(a) the surface** (a floating bar sits on a raised, shadowed plane; an
embedded bar is flush/transparent into its header) and **(b) placement/width** (fixed vs static; content-width
vs full-bleed). Both already have fleet answers:

- **Surface = the ADR-0015 `elevation`/`brightness` seam**, reused verbatim (the same `surfaceProps` spread
  `ui-row`/`ui-card`/`ui-tabs` carry). A floating toolbar asks for `elevation="2"` (raised plane + shadow +
  the `[data-box]` z-scope of ADR-0052); an embedded toolbar leaves it at `0` (transparent, flush). This is
  the whole posture difference, captured by a seam the fleet already ships and tests.
- **Placement/width = the layout's job**, exactly the `ui-text-field` `min-inline-size` precedent (ADR-0021)
  and TKT-0009's own lean. The toolbar owns a sensible min-block-size floor (so a bar reads as a bar) and
  nothing else about where it sits; a `position: fixed` shell, an anchored container, or a static header cell
  is the consumer's / layout's concern.

The embedded posture therefore **composes** — a `ui-toolbar` is an ordinary light-DOM child of an app-shell
header region (or any container), no special seam required. The floating posture is the **same element** with
a raised surface, positioned by its consumer.

**Rejected: a discrete `posture="floating|embedded"` enum.** It would be a redundant alias for `elevation`
that *also* bundles width behavior — re-coupling exactly what the fleet deliberately unbundled (surface vs
placement). **Rejected: riding the ADR-0043/0045 overlay+dismissal machinery** on the floating side. That
machinery exists for *dismissable, triggered* content (menu/select/tooltip/popover — Escape, outside-click,
anchor focus-restore). A toolbar is **persistent chrome with no trigger and no open/close** — inheriting
dismissal would be a category error. **Recommendation: one element; posture via `elevation`/`brightness` +
`[data-box]` z-scope when raised; placement is the layout's job; no posture enum, no overlay inheritance.**

### F2 — the family shape: **host-as-flex, light-DOM children ARE the items (the `ui-row` precedent); NO `toolbar-group` sub-tag in v1**

The adia prior art is a two-tag family (`toolbar` + `toolbar-group`). The fleet's anatomy dialect is
**position-slots × `data-role` roles**, and its layout primitives (`ui-row`) are **host-as-flex with no named
slots — the light-DOM children ARE the flex items** (`row.md` `slots: []`). A toolbar's children are the
consumer's arbitrary interactive controls; the toolbar's job is to arrange them and rove focus across them.

**Recommendation: v1 is host-as-flex, no sub-tag.** The toolbar's light-DOM interactive descendants are its
roving items (queried in DOM order, nesting-tolerant, so a `ui-row` cluster inside still roves — F3). Visual
grouping is done the way the corpus seed already does it: ordinary `ui-row` children (or gap). A dedicated
**`ui-toolbar-group` carrying `role="group"`** is named as a **fenced, purely additive v2 extension** (a
second tag whose only job is one ARIA role, landing without any contract change to `ui-toolbar` — the
anatomy law's "additive on one axis" property). This matches the corpus seed's own hand-composition (`Row`
clusters) and avoids porting a two-tag family before there is a demonstrated need for AT-grouped clusters.

**A `ui-divider` (vertical separator between clusters)** — the adia `<divider-ui vertical>` — does not exist
in the fleet (`geometry.md` lists `divider` as an *unbuilt* Display-class primitive). v1 separates clusters
with gap only; hosting a real `ui-divider` once it ships is additive and needs no toolbar change. Named as a
non-goal, not a blocker.

### F3 — `role="toolbar"` + roving focus: **reuse the `roving-focus` trait, decoupled from selection**

The `traits/roving-focus.ts` trait already implements exactly the WAI-ARIA roving tabindex (one item
`tabindex=0`, the rest `-1`, arrow keys move focus along an orientation, Home/End to the ends, live item
re-read). The toolbar reuses it — **do not reinvent** — with these toolbar-specific settings, all justified
against the APG *Toolbar* pattern (which differs from *Tabs*):

- `orientation` keyed to the toolbar's own `orientation` prop (F5): `horizontal` → Left/Right; `vertical` →
  Up/Down; also sets `internals.ariaOrientation="vertical"` on the vertical case (horizontal is the toolbar
  default and is not announced).
- **No selection-follows-focus, no commit event.** Unlike `ui-tabs`, toolbar items are independent actions;
  the trait's `onMove` moves focus only — there is no `selected` state and no `select` event (F6). This is the
  load-bearing difference from the tabs reuse.
- `loop: false` — APG *Toolbar* does not wrap by default (wrapping is optional; focus stops at the ends).
  (Tabs wraps; toolbar does not — a deliberate divergence.)
- `typeAhead: false` — type-ahead is a listbox/menu affordance; a toolbar has none.
- `role="toolbar"` on the host via `ElementInternals` (never a host attribute — fleet law). The **accessible
  name is author-supplied via a typed `label` prop** written to `internals.ariaLabel` when non-empty (the
  ADR-0051 labelling-seam spirit: author text → internals, not a raw host `aria-label`). Optional; a toolbar
  with a contextual name leaves it `''`.
- **Roving items = the toolbar's focusable interactive descendants** matched by a documented selector
  (button-like: `ui-button`, native `button`, `a[href]`, `[role="button"]`, plus an explicit
  `[data-toolbar-item]` escape hatch), in DOM order, excluding disabled. A descendant query (not direct-child)
  keeps `ui-row`-grouped items in the roving set (F2). **Fenced edge:** a child that itself consumes arrow
  keys (a `ui-slider`, a text editor) is out of v1's roving scope — APG treats such sub-widgets specially;
  v1's roving targets button-like items only, and an arrow-consuming child is a named follow-up, not a v1
  guarantee.

### F4 — overflow behavior: **v1 = CSS-owned `wrap` (default) or `scroll`; the overflow-*menu* is a fenced v2**

The adia prior art's overflow engine (ResizeObserver + MutationObserver measuring width and *moving* end
items into a `popover=manual` spillover, atomic groups, trailing-divider trimming, label re-injection) is the
bulk of its ~13 KB and reaches into child reparenting, observer-loop guards, and anchor positioning — it would
also entangle the toolbar with the overlay family F1 deliberately keeps out.

**Recommendation: v1 overflow is a two-value enum `overflow: [wrap, scroll]`, default `wrap`, realized in
pure CSS with zero JS measurement.** `wrap` (flex-wrap) is the default because it **never hides an action** —
every item stays reachable without a scroll gesture (the accessibility-safe choice absent an overflow menu);
`scroll` (`overflow-inline: auto`) preserves a single row for the cases that want it. **The overflow-*menu*
(spillover) is named as a fenced, additive v2 extension** — adding a `menu` member to the enum later is
backward-compatible (the default stays `wrap`), and it is where the adia reflow engine would be re-derived
to fleet standard (riding the *real* `ui-menu`, not a bespoke popover) if a consumer earns it.

### F5 — the axes, in the typed-enum dialect

The toolbar spreads the ADR-0015 `surfaceProps` (`elevation`, `brightness` — the F1 posture lever) and adds
five own props, reusing the ADR-0039 box-alignment vocabulary (`align`/`justify`) verbatim for fleet
consistency, with toolbar-tuned defaults:

| Prop | Type | Default | Role |
|---|---|---|---|
| `elevation` | enum `[0,1,2,3,-1,-2,-3]` | `0` | surface plane (ADR-0015) — the raised floating posture |
| `brightness` | enum `[0,1,2,3,-1,-2,-3]` | `0` | tonal wash (ADR-0015) |
| `orientation` | enum `[horizontal, vertical]` | `horizontal` | flex-direction + roving axis + `aria-orientation` (F3) |
| `align` | enum `[start, center, end, stretch, baseline]` | `center` | cross-axis `align-items` (ADR-0039) — `center` is the natural bar look (differs from `ui-row`'s `start`) |
| `justify` | enum `[start, center, end, between, around, evenly]` | `start` | main-axis distribution (the corpus seed's `between` need) |
| `gap` | enum `[none, xs, sm, md, lg, xl, 2xl]` | `sm` | inter-item spacing off `--ui-space` (density-responsive rhythm); `sm` — toolbars are tight |
| `overflow` | enum `[wrap, scroll]` | `wrap` | F4 |
| `label` | string | `''` | author accessible name → `internals.ariaLabel` when non-empty (F3) |

**No `size` or `density` prop.** Pattern-class geometry: the interactive items take the control height from
their *own* size; the toolbar's own contribution is padding + gap off the `--ui-space` ladder + a
min-block-size floor tied to the control-height register (the whole-shape floor — a bar must read as a bar).
`[scale]` and `[density]` ride **ambiently** (inherited attributes / `ui-theme-provider`), never as toolbar
props — the `ui-tabs` precedent exactly. Deliberately **no `ui-row` `wrap`/`reflow`**: `wrap` is subsumed by
`overflow`, and container-direction auto-switching (`reflow`) is not a toolbar behavior.

### F6 — events: **none**

A toolbar emits **no** events (`events: []`) — trivially inside the `change·input·select·open·close·toggle`
allowlist. The items are the consumer's own buttons, which emit their own events; the toolbar arranges and
roves focus, it does not aggregate or re-emit (TKT-0009 non-goal: "not a command bus").

### F7 — catalog posture: **A2UI-emittable** (a `Toolbar` catalog row lands with the build)

Against the ADR-0087 catalog-or-allowlist gate and its ADR-0112 cl.6 exclusion test — *"is this page/app-owner
chrome an agent must never emit?"* — a toolbar is **content-region arrangement** (an action bar *inside* a
composed surface), not app-chrome. The `document-row-toolbar` corpus seed is direct evidence an agent wants to
emit exactly this. It is unlike `ThemeProvider`/`Toast`/`ToastRegion` (which establish ambient page state).

**Recommendation: emittable.** A `Toolbar` default-catalog row ships with the build, mapping its attrs
(`orientation`/`align`/`justify`/`gap`/`overflow`/`elevation`/`brightness`/`label`) and its `children`
(the item components) the way `Row` is catalogued; and the `document-row-toolbar` seed is **upgraded** to use
the real `Toolbar` type — specifically its **action cluster** (the `doc_actions` child on the *post-ADR-0112*
seed, whose top-level `Row` now pairs an `Attachment` file card with that action `Row`) becomes the `Toolbar`
node, the same "hand-composed shape → real type" upgrade the seed's own comment records for `Row[Icon,Text]` →
`Attachment`. The catalog row itself is an **a2ui-package build slice** (team-led,
`a2ui-builder` seat); this ADR fixes the *posture* (emittable) and the SPEC/LLD carry the row as a build
deliverable, not the mechanism.

## Consequences

- The fleet gains its first **toolbar primitive** — agents stop hand-composing action bars from
  `Card+Row+Icon+Text`, and the `document-row-toolbar` corpus record collapses to a real `Toolbar` node.
- **`ui-toolbar` is the first control to reuse `roving-focus` decoupled from selection** — proving the trait
  is genuinely role-agnostic (its header already claims "any set of items with a moving focus"; tabs coupled
  it to selection, toolbar exercises the pure-focus path). A small hardening: the trait's `onMove` is used for
  focus only, no `syncIndex`/selection effect.
- **Posture-as-surface** keeps the toolbar out of the overlay family entirely — no dismissal, no anchor
  positioning, no trigger. A floating toolbar is `elevation="2"` + a consumer-owned `position`. This is the
  `min-inline-size` "placement is the layout's job" doctrine applied to a Pattern control.
- The `overflow` enum ships two CSS-only values; the spillover-*menu* is a **named, additive** v2 seam (a new
  enum member, default-preserving) — the fleet does not inherit the adia reflow engine's ~13 KB or its
  observer-loop machinery until a consumer earns it.
- **Cost accepted:** two site pages (`toolbar-{doc,demo}.ts`) and a gallery specimen, the standing
  `tier: pattern` site obligation (the `ui-tabs` parity set); the demo shows **both** postures (embedded
  header + floating raised bar) per TKT-0009.
- A `Toolbar` catalog row enters the generative-UI vocabulary (F7) — the coverage gate is satisfied by a real
  row, not an allowlist entry; the a2ui-builder seat owns that slice.
- **Amendment (post-build, pre-ratification) — the roving-marker contract.** Building the control surfaced a
  latent cross-trait conflict: custom-element connection is preorder (a parent's `connectedCallback` fires
  before its children's), so `ui-toolbar`'s `roving-focus` init and a real `ui-button` item's own `tabbable`
  trait (traits/tabbable.ts) raced — the item's later-connecting `connected()` unconditionally re-asserted
  `tabIndex = 0`, silently breaking the "exactly one tabindex=0" contract (SPEC-R4 AC1) the moment more than
  one `ui-button` item was used, exactly the composition this ADR's own Examples section illustrates.
  `ui-radio-group` → `ui-radio` (both built on `UIIndicatorElement`, which also runs `tabbable`) carried the
  identical latent bug — masked until now by jsdom's opposite child-then-parent connection order, which real
  Chromium/WebKit do not share; it was untested in a real engine. Fixed with a two-sided marker contract
  (traits/roving-focus.ts ↔ traits/tabbable.ts, both files' own headers carry the full mechanism): `roving-
  focus.ts` stamps every item it manages with a `data-roving` attribute (on init, on every move, re-applied
  once more via a settle-pass `requestAnimationFrame` tick to close the connect-time race) and strips it on
  release — release now wired to the connection scope's disposal (disconnect), not only a manual call.
  `traits/tabbable.ts` DEFERS its `tabIndex = 0` write whenever the host carries that marker, re-checked on
  EVERY effect run (not just install), so a later re-enable mid-session does not reclaim a second tab stop.
  **ADR-0010's tabbable semantics are EXTENDED, not changed, for a standalone host** — absent the marker
  (the overwhelming majority of `tabbable()` consumers), behavior is byte-identical to the pre-amendment rule
  (pinned by an identity-style test in tabbable.test.ts). No descriptor prose needed correction — none of the
  tabbable-consumer descriptors (`button.md`/`checkbox.md`/`switch.md`/`radio.md`/`slider.md`) claimed
  unconditional tabbability; `radio.md`'s existing "managed by rovingFocus on the group" prose was already the
  intended contract, now genuinely true in every engine rather than only in jsdom.

## Acceptance

The SPEC's requirements hold end to end: `npm run check`(+site) and `npm test` green including
`family-coherence.test.ts` and the new `toolbar` suite; the descriptor↔props trip-wire green; `role="toolbar"`
+ roving focus proven **cross-engine** (Chromium + WebKit) with a real-focus-order keyboard leg (one Tab stop,
arrow navigation along orientation, Home/End, no wrap, no type-ahead, no selection/commit); the **whole-shape**
proof (a populated toolbar renders as a bar with real width/height in a realistic container, both postures);
the `Toolbar` catalog row + the upgraded corpus seed green under the a2ui coverage/judge gates;
`site-coverage.test.ts` green for the new `{doc,demo}` pair; `npm run size` measured and, if material, pinned;
independent `component-reviewer` GO before the build commits.

## Alternatives considered

- **A `posture="floating|embedded"` enum** — rejected (F1): a redundant alias for `elevation` that re-bundles
  surface with width behavior, against the fleet's deliberate surface/placement split.
- **Riding the ADR-0043/0045 overlay + dismissal machinery on the floating side** — rejected (F1): a toolbar
  is persistent chrome with no trigger; dismissal semantics are a category error for it.
- **The toolbar owning anchor/edge positioning** — rejected (F1): placement is the layout's job
  (`min-inline-size` precedent, ADR-0021); the toolbar owns only a min-block-size floor.
- **Porting the two-tag `toolbar` + `toolbar-group` family** — rejected (F2): the fleet's layout dialect is
  host-as-flex with no sub-tag (`ui-row`); a `role="group"` sub-tag is a fenced, additive v2 (`ui-toolbar-group`).
- **Porting the ResizeObserver overflow-to-spillover engine into v1** — rejected (F4): ~13 KB of child-moving
  + observer-loop machinery that entangles the overlay family; the menu overflow is a fenced additive v2 built
  on the real `ui-menu`.
- **Selection-follows-focus + a `select`/`change` event (the `ui-tabs` shape)** — rejected (F3/F6): toolbar
  items are independent actions; there is no selection to track and nothing to commit — the toolbar is not a
  command bus.
- **A raw `aria-label` host attribute for the name** — rejected (F3): fleet law keeps ARIA off host
  attributes; the author name rides a typed `label` prop → `internals.ariaLabel`.
- **Permanent catalog exclusion (the `ThemeProvider`/`Toast` disposition)** — rejected (F7): a toolbar is
  agent-emittable content-region arrangement, not ambient page/app-owner chrome; the corpus seed proves the
  demand.
