# SPEC — `ui-timeline` family (`ui-timeline` · `ui-timeline-item` · `ui-status-stream`)

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: TKT-0010 (`../tickets/tkt-0010-ui-timeline.md`) + TKT-0013 (`../tickets/tkt-0013-ui-status-stream.md`)
> under the ratified scope + contract directions of
> [ADR-0122](../adr/0122-timeline-family-and-live-status-stream.md) (proposed; forks F1–F6 as recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern**, the same basis the
> `ui-theme-provider` and `ui-toolbar` SPECs recorded: the problem statement and acceptance already live in the
> two TICKETs (carrying Summary/Acceptance/Links per their type contract), and the *why-owner* for the live arm
> is the existing [`feed-family` PRD](../prd/feed-family.prd.md) (activity vocabulary) — which this SPEC LINKS,
> never restates (see SPEC-R8/R11, the live-region + completion arm it governs).
> Authoring a new PRD here would restate that substrate under different frontmatter (the "restated substrate"
> failure `doc-authoring-standards` names). Two known, deliberate deviations, recorded not silently missed:
> (1) the SPEC↔PRD uplink harness check fails on this file by construction (no owning PRD); (2) this SPEC uses
> the fleet's blockquote-header doc style (matching every sibling under `.claude/docs/spec/` incl.
> `toolbar.spec.md`), NOT generic YAML frontmatter, so the generic scribe `doc_lint` abstains — the repo gates
> SPECs with its own checks; a fleet-wide frontmatter switch is a doc-forge/Kim decision, out of scope here.
> Refined by: [`../lld/timeline-family.lld.md`](../lld/timeline-family.lld.md). Build plan:
> [`../decompositions/timeline-family-ship.decomp.json`](../decompositions/timeline-family-ship.decomp.json)
> (coverage-clean, plan mode).
> Altitude: owns **what the three shipped elements do and how they behave at every boundary** — the prop
> contracts, the marker-system geometry law under `[size]`, the state/signifier vocabulary, the durable-vs-live
> divergence (data ingress, scroll, a11y role, motion, completion invariant), the catalog dispositions, the
> site surfaces. Implementation (exact CSS grid mechanics, the marker-system integer rows, the tail-follow
> guard, page content) is the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the family ADR-0122 ratifies: a **three-tag event-rail family** — a shared inert visual atom
(`ui-timeline-item`) hosted by two divergent hosts (`ui-timeline`, the durable authored-children chronology;
`ui-status-stream`, the live imperative-fed "now" strip). One control's rail geometry, marker states, and
signifiers are authored ONCE on the item; the two hosts diverge only where they mechanically must — data
ingress, scroll ownership, ARIA role, motion, and the completion invariant. `ui-timeline`/`ui-timeline-item`
are A2UI-emittable; `ui-status-stream` is allowlisted (a consumer-owned imperative streaming host, not
emittable markup).

## 2. Definitions

- **Item** — a `ui-timeline-item`: one rail row = a marker (dot or slotted icon) + an optional connector + the
  content roles (label · description · timestamp · trailing) + an optional collapsible detail. Inert: it holds
  no transport, emits only `toggle` (its detail), and is `role="listitem"`.
- **Marker system** — the rail's own geometry: `marker-box`, `dot-size`, `icon-size`, `connector-width`,
  `gutter` (the marker-column width), `row-gap`. Sized by `(scale × size)` per F2 — an explicit token table, no
  multiplier.
- **`size`** — a first-class prop (`sm/md/lg`) on all three tags selecting the marker-system row within the
  ambient `[scale]` register (the sized-entry precedent; ADR-0122 F2). Distinct from `[scale]`/`[density]`,
  which ride ambiently.
- **`status`** — the item's lifecycle state: `'' · pending · active · done · error` (ADR-0122 F3), each with a
  non-color marker signifier (ADR-0057).
- **Durable host** (`ui-timeline`) — authored `ui-timeline-item` light-DOM children, DOM-order read-back,
  `role="list"`, static, no tail-follow.
- **Live host** (`ui-status-stream`) — an imperative `appendEntry`/`update`/`finalize` API, `role="log"` (polite
  live region), tail-follow scroll, streaming motion, and the completion invariant.
- **Completion invariant** — a stream that ends without resolving an entry MUST render that entry as
  *truncated* (a visible interrupted affordance), never a silent forever-spinner (the B7 tracked-completion
  doctrine applied to display).
- **Keyed update** — a `ui-status-stream` mutation addressed by a string `key` identity, so an already-rendered
  entry transitions in place (running → done/error) rather than a new entry appending.

*Note on the ADR-0122 F1 five-axis divergence:* four axes each get a first-class requirement — ARIA role
(SPEC-R6/R8), data ingress (SPEC-R6/R9), scroll (SPEC-R10), completion (SPEC-R11). The fifth, **motion**, is
folded by design into SPEC-R4 AC3 (the item's `active`-marker reduced-motion behavior) + SPEC-R10 AC3 (the live
host's tail-scroll reduced-motion) + the SPEC-R6 AC3 grep negative control (the durable host carries no
entry-arrival motion — it is static). The divergence contract is therefore provably 5-of-5.

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 The shared item — `ui-timeline-item`

**SPEC-R1 — Base class, tag, tier, role.** The component MUST be `ui-timeline-item`, a class
`UITimelineItemElement` extending `UIElement`, self-defining on import (idempotent `customElements.define`
guard), at `packages/agent-ui/components/src/controls/timeline-item/`. It MUST classify `tier: pattern` and set
`internals.role = 'listitem'` (never a host `role` attribute). It MUST NOT be form-associated
(`face.formAssociated: false`). *(ADR-0122 F1)*
- **AC1** *Given* the module is imported, *then* `customElements.get('ui-timeline-item')` resolves to a
  subclass of `UIElement`, the descriptor resolves `tier: pattern`, and `el.internals.role === 'listitem'` with
  no host `role` attribute.
- **AC2** *Given* an instance, *then* it is NOT `instanceof UIFormElement`.

**SPEC-R2 — Item props schema.** The component MUST declare exactly these reflected, attribute-synced props,
`values[0]`-default-first where enumerated: `status: enum(['', 'pending', 'active', 'done', 'error'], '')`;
`label: string('')`; `description: string('')`; `timestamp: string('')`; `icon: string('')`;
`size: enum(['sm','md','lg'], 'md')`. It MUST NOT declare a `variant`/`color` prop (state rides `status`; a free
marker rides `''`+`icon` — ADR-0122 F3), nor a numeric/date codec for `timestamp` (it is the consumer's string
— ADR-0122 F6). *(ADR-0122 F2/F3/F6)*
- **AC1** *Given* a fresh instance, *then* every prop reads its default (`status`/`label`/`description`/
  `timestamp`/`icon`=`''`/`''`/`''`/`''`/`''`, `size`=`md`).
- **AC2** *Given* `el.status = 'active'`, *then* `el.getAttribute('status') === 'active'` and the reverse holds;
  same for `size`. *Given* an out-of-vocabulary `status`/`size` via `setAttribute`, *then* the property resolves
  to `values[0]` (`''`/`md`) — fail-open, never a crash.
- **AC3** *Given* the descriptor↔props trip-wire, *then* it is green (the `attributes[]` fence mirrors
  `static props` 1:1), and `compareDescriptorToSource` reports no undocumented styled slot/role/state.

**SPEC-R3 — Anatomy: marker + connector + content roles.** The component MUST render, host-as-grid, a marker
cell (a CSS `::before`/`::after` dot + connector, OR a slotted marker icon replacing the dot when `icon` is set
or a `[slot="marker"]`/`[data-role="marker"]` child is present) and the content roles keyed by `data-role`:
`label`, `description`, `timestamp` (the aside), and `trailing`. Empty roles MUST NOT reserve visual space. A
consumer-slotted marker MUST suppress the default dot. *(ADR-0122 F1/F3)*
- **AC1** *Given* an item with `label`/`timestamp` only, *then* the marker dot + connector render and the empty
  `description`/`trailing` roles occupy no space (no phantom gap).
- **AC2** *Given* `icon="check"` (or a `[data-role="marker"]` child), *then* the default dot is suppressed and
  the slotted marker fills the marker cell.
- **AC3** *Given* several stacked items, *then* their markers align to a single vertical axis (the shared gutter
  column — proven whole-shape in SPEC-R14).

**SPEC-R4 — `status` states + non-color signifiers (ADR-0057).** Each non-empty `status` MUST render a marker
whose shape/glyph is DISTINCT per state — not hue alone — and MUST stay legible under `@media (forced-colors:
active)`, where the fill collapses and the shape is the only channel: `pending` a hollow ring, `active` a
filled dot (a pulse/spinner is a consumer-opt-in presentation hint, reduced-motion-collapsing), `done` a check
glyph, `error` a cross/`!` glyph. The colored fill is the redundant secondary channel only. *(ADR-0122 F3;
ADR-0057)*
- **AC1** *Given* each of `pending`/`active`/`done`/`error`, *then* the rendered marker differs by SHAPE (not
  only color) — asserted by a per-state structural/computed-style probe, not a pixel diff.
- **AC2** *Given* `forced-colors: active`, *then* every `status` marker remains distinguishable (border/shape
  survives; the fill is not the sole cue).
- **AC3** *Given* `prefers-reduced-motion: reduce`, *then* an `active` marker's pulse/spinner is static (no
  continuous animation).

**SPEC-R5 — Collapsible detail (disclosure reuse), `toggle` only.** An item with detail / one-level sub-steps
MUST realize the collapse via the `ui-disclosure` mechanism (its `open` state + `toggle` event), NOT a bespoke
caret+`hidden`. The collapse MUST emit `toggle` (∈ the `change·input·select·open·close·toggle` allowlist) and
MUST NOT introduce any other event name. Nesting is ONE level in v1 (flat + 1). *(ADR-0122 F6)*
- **AC1** *Given* an item with detail content, *then* toggling it emits exactly one `toggle` event and no other
  event; *given* the descriptor `events`, *then* it is `[toggle]` (or `[]` if the detail is a composed
  `ui-disclosure` child owning its own event — the LLD fixes which; either way, no NEW event name).
- **AC2** *Given* two levels of nesting requested, *then* only one level is a v1 guarantee (deeper is a fenced
  non-goal, SPEC §4).

### 3.2 The durable host — `ui-timeline`

**SPEC-R6 — Base class, tag, tier, role; authored-children ingress.** The component MUST be `ui-timeline`, a
class `UITimelineElement` extending `UIContainerElement`, self-defining on import, at
`controls/timeline/`, `tier: pattern`, setting `internals.role = 'list'` (the `ui-list` precedent; never a host
attribute), NOT form-associated. Its items are authored light-DOM `ui-timeline-item` children in DOM order
(no auto-sort). It MUST carry the `size` prop (F2) and MUST NOT carry a `live`/`follow`/`orientation=horizontal`
prop in v1. *(ADR-0122 F1/F2/F6)*
- **AC1** *Given* import, *then* `customElements.get('ui-timeline')` is a `UIContainerElement` subclass,
  `tier: pattern`, `el.internals.role === 'list'`, no host `role` attribute.
- **AC2** *Given* three authored `ui-timeline-item` children, *then* they render in DOM order (no reordering);
  *given* the last item, *then* its connector is suppressed (a `data-last`/`:last-of-type` rule — the terminal
  row has no trailing line).
- **AC3** *Given* a grep of `timeline.ts`, *then* there is no imperative `appendEntry`/`update`/`finalize` API, no
  `MutationObserver` tail-follow, and no live-region role — the durable host is static (the negative control
  separating it from `ui-status-stream`).

**SPEC-R7 — Durable host props + size.** The component MUST declare `size: enum(['sm','md','lg'], 'md')`
(first-class geometry, F2) and MAY declare nothing else value-bearing in v1 (it is a structural container). It
MUST NOT declare a `variant`, a `data`/items array prop (items are authored children — the A2UI list template
covers data-driven at the catalog layer), or an events prop (`events: []`). *(ADR-0122 F2/F5/F6)*
- **AC1** *Given* a fresh instance, *then* `size` reads `md` and reflects on set / fails open on garbage.
- **AC2** *Given* any interaction, *then* the host dispatches no event (`events: []` — display-first).

### 3.3 The live host — `ui-status-stream`

**SPEC-R8 — Base class, tag, tier, role; the live region.** The component MUST be `ui-status-stream`, a class
`UIStatusStreamElement` extending `UIContainerElement`, self-defining on import, at `controls/status-stream/`,
`tier: pattern`, setting `internals.role = 'log'` with a **polite** live-region posture (`aria-live="polite"`
semantics via internals; `aria-relevant` additions), NOT form-associated. It hosts `ui-timeline-item` children
created by its API (SPEC-R9). *(ADR-0122 F1/F4)*
- **AC1** *Given* import, *then* `customElements.get('ui-status-stream')` is a `UIContainerElement` subclass,
  `tier: pattern`, `el.internals.role === 'log'`, no host `role` attribute, and the live-region politeness is
  `polite` (never `assertive` by default — token spam is the failure to avoid).
- **AC2** *Given* the same content authored under `ui-timeline` vs appended under `ui-status-stream`, *then* the
  ARIA role differs (`list` vs `log`) — the mechanical proof the two are distinct controls, not one posture.

**SPEC-R9 — Imperative data contract: `appendEntry` + keyed `update` + `finalize`.** The component MUST expose a
public imperative API — no bound reactive-list data prop:
- `append(entry: StatusEntry): UITimelineItemElement` — creates a `ui-timeline-item`, assigns the entry's
  fields (`key`, `status?`, `label?`, `description?`, `timestamp?`, `icon?`, `text?` — the streamed
  chain-of-thought channel, appended/replaced in place, NEVER parsed), appends it, and tail-follows to it
  (SPEC-R10); returns the element (the `ui-toast-region.show()` return precedent). `update`'s `patch` is
  `Partial<StatusEntry>`, so it carries the same fields including `text` (the LLD freezes the `StatusEntry`
  interface).
- `update(key: string, patch: Partial<StatusEntry>): void` — a **keyed** mutation to the already-rendered entry
  with that `key`: transitions `status`, appends/replaces streamed `text`/`description`, or reveals detail. A
  `key` with no matching entry is a no-op (never a throw — a late update after truncation is tolerated).
- `finalize(): void` — the stream-ended signal: any still-`pending`/`active` entry is marked TRUNCATED and
  rendered as such (SPEC-R11).
*(ADR-0122 F4)*
- **AC1** *Given* `append({key:'a', status:'active', label:'search'})`, *then* a `ui-timeline-item` with that
  content renders and the method returns it; *given* `update('a', {status:'done'})`, *then* the SAME element
  transitions to `done` in place (no second element appended — keyed identity).
- **AC2** *Given* `update('missing', …)` with no such key, *then* it is a silent no-op (no throw, no element).
- **AC3** *Given* streamed text via `update('a', {text:'…'})` repeatedly, *then* the entry's text grows/replaces
  in place; *given* the host, *then* it NEVER parses/tokenizes the text and holds no transport (a grep finds no
  fetch/stream reader in the component — the consumer owns transport, SPEC §4).

**SPEC-R10 — Tail-follow scroll (owns its region).** When an entry is appended (or an update grows content at
the tail), the component MUST animate the newest entry's end into view (`scrollIntoView({block:'end'})`, smooth
by default, instant under `prefers-reduced-motion`), IFF the user is at/near the bottom — a **stick-to-bottom
guard**: if the user has scrolled up to read history, new arrivals MUST NOT yank the viewport (the
one-owned-scroll-region law + the TKT-0004 `revealScroll` discipline as component behavior). *(ADR-0122 F4)*
- **AC1** *Given* the stream is scrolled to the bottom and an entry is appended, *then* the viewport follows to
  the new entry's end.
- **AC2** *Given* the user has scrolled up (not at bottom) and an entry is appended, *then* the viewport does
  NOT move (the stick-to-bottom guard holds); *given* the user scrolls back to the bottom, *then* tail-follow
  resumes.
- **AC3** *Given* `prefers-reduced-motion: reduce`, *then* the follow is an instant jump, not a smooth animate.

**SPEC-R11 — The completion invariant.** `finalize()` (or a consumer-signalled stream end) MUST mark every
still-`pending`/`active` entry TRUNCATED and render a visible interrupted affordance on it — never leave it
silently spinning. A late `update` after `finalize` to a truncated entry MAY resolve it (tolerant), but the
default rendered state of an unresolved-at-end entry is *truncated*, fail-closed. *(ADR-0122 F4)*
- **AC1** *Given* an `active` entry and then `finalize()`, *then* the entry renders as truncated/interrupted
  (a distinct, non-color-only affordance — ADR-0057), not `active`.
- **AC2** *Given* a torn stream (the transport throws mid-entry — the B7 fail-closed path), *then* the affected
  entry shows truncated, and no entry shows "still working."

**SPEC-R12 — Live host props + size + events.** The component MUST declare `size: enum(['sm','md','lg'], 'md')`
(F2). Its collapse of resolved entries MUST emit `toggle` (allowlisted) and it MUST NOT declare any other event
name; streamed text/state announcements ride the `role="log"` live region, not events. *(ADR-0122 F2/F6)*
- **AC1** *Given* collapse of a resolved entry, *then* exactly one `toggle` fires and no other event.
- **AC2** *Given* the descriptor `events`, *then* it is `[toggle]` (or `[]` per the LLD's disclosure-composition
  choice — no new event name either way).

### 3.4 Geometry — the marker system (shared)

**SPEC-R13 — The marker-system geometry under `[size]` × `[scale]` (the F2 novelty leg).** The rail's own
quantities — `marker-box`, `dot-size`, `icon-size`, `connector-width`, `gutter`, `row-gap` — MUST resolve from
a NEW explicit `--ui-timeline-*` token table keyed by `(scale × size) → row`, with **NO multiplier** (the
ADR-0038 law; the ADR-0035/0036 hoisted-per-`[scale]` pattern). `size` (a prop) picks the within-register row;
`[scale]` (ambient) picks the register; `[density]` rides `row-gap` (rhythm) only, never the marker frame. The
content text reads the ambient type scale, not the marker table. The connector is a `connector-width` hairline
(a NEW structural quantity, NOT `= font`); a slotted marker icon reads the content-icon register
(`--ui-icon-{size}`). *(ADR-0122 F2; `geometry.md`)*
- **AC1** *Given* `geometry.sizeClass`, *then* it is `pattern` for all three tags; *given* the descriptors,
  *then* each declares a `size` attribute (sm/md/lg) and NO codec on it.
- **AC2** *Given* the three `size` values at a fixed `[scale]`, *then* `marker-box`/`dot`/`connector-width`/
  `gutter`/`row-gap` each equal the EXPLICIT integers the LLD fixes (a geometry-under-`[size]` probe asserting
  the exact values) — AND the probe MUST NOT assume adjacent tiers are all-distinct (the ADR-0038 stepping
  lesson: adjacent tiers may share a value).
- **AC3** *Given* `[density="spacious"]` vs `[compact"]`, *then* `row-gap` widens/narrows while `marker-box`/
  `dot`/`gutter` are unchanged (density rides the gap only — the centering law); *given* a `[scale]` change,
  *then* the register shifts with no `size` prop change.

### 3.5 Whole-shape, tokens, forced-colors

**SPEC-R14 — Whole-shape proof (per host).** Each host MUST render as a real rail in a realistic container, not
a collapsed sliver: a populated `ui-timeline` shows multiple items with markers aligned to one axis and real
width/height; a bare `ui-timeline-item` is not a zero-size dot (the ui-slider whole-shape lesson — a
`min-inline-size`/`min-block-size` floor keeps the rail hittable and legible). *(ADR-0122; the whole-shape law)*
- **AC1** *Given* a populated timeline in a flex/grid container, *then* its rendered bounding box is a real rail
  (markers vertically aligned, content columns non-collapsed) cross-engine.
- **AC2** *Given* a single bare item, *then* it renders at a sensible minimum (marker + one text line), never a
  0-width row.

**SPEC-R15 — Token surface & forced-colors.** Each component MUST ship a single fleet-scoped stylesheet
(`{name}.css`) declaring only its `--ui-{name}-*` roles (the marker-system chain on the item; container/scroll
roles on the hosts) and consuming only own∪allowlisted tokens, with a `@media (forced-colors: active)` block
keeping the rail boundary, the markers (SPEC-R4), and the connector legible. Intent colors MUST consume role
tokens (`--md-sys-color-{family}-{role}`), never raw values. *(ADR-0122; `geometry.md`; family-coherence)*
- **AC1** *Given* `family-coherence.test.ts`, *then* all three pass the fleet invariants (single `{name}.css`,
  `--ui-{name}-*` chain present, `:where(ui-{name})` declares only own roles + consumes own∪allowlisted tokens,
  forced-colors block present, `extends` ∈ the base ladder, `events ⊆` the six, barrel + component-styles
  registration).

**SPEC-R16 — Descriptors (three).** Each component ships a truthful `{name}.md` descriptor declaring `tag`,
`tier: pattern`, `extends`, `geometry.sizeClass: pattern`, `face.formAssociated: false`, `role` (via internals:
`listitem`/`list`/`log`), `events`, `slots`/`parts` (the marker/content roles), an `attributes[]` fence
mirroring `static props` 1:1, and the item's `keyboard`/interaction map. *(ADR-0122)*
- **AC1** *Given* the descriptor↔props trip-wire per component, *then* each is green (zero drift).
- **AC2** *Given* `compareDescriptorToSource` per component, *then* every CSS-styled slot/role and used
  custom-state is documented.

### 3.6 Catalog dispositions

**SPEC-R17 — `Timeline`+`TimelineItem` emittable; `StatusStream` allowlisted.** `Timeline` and `TimelineItem`
(the descriptor-derived PascalCase types) MUST gain default-catalog rows (mapping the item attrs `status`/
`label`/`description`/`timestamp`/`icon`/`size` + a `children` item list, the `Row`/adia model);
`StatusStream` MUST gain an `EXCLUSION_ALLOWLIST` entry with the ADR-0122 F5 reason (a consumer-owned
imperative streaming host, not one-shot emittable markup — the `Toast`/`ToastRegion` cl.6 precedent). These are
**a2ui-package build slices** (`a2ui-builder` seat); the SPEC fixes the dispositions, the LLD carries them as
build deliverables. *(ADR-0122 F5; ADR-0087 gate; ADR-0112 cl.6)*
- **AC1** *Given* the three descriptors ship, *then* `Timeline`/`TimelineItem`/`StatusStream` enter
  `FLEET_TYPES` and the catalog coverage gate stays green because two real catalog rows + one reasoned
  allowlist entry cover them (the only residue is the one allowlist entry).
- **AC2** *Given* a Gen-UI exemplar composing a `Timeline` with `TimelineItem` children, *then* it validates
  clean and renders through the real types; *given* a payload attempting to emit `StatusStream`, *then* it is
  rejected/absent from the emittable set (the allowlist disposition).

### 3.7 Site surfaces

**SPEC-R18 — Required site pages + representative specimens.** The `tier: pattern` classification REQUIRES a
`{doc, demo}` pair per host under `site-coverage.test.ts`: `timeline-{doc,demo}.ts` and
`status-stream-{doc,demo}.ts`. `*-doc` MUST be the descriptor-derived API page; `timeline-demo` MUST show the
durable chronology (an order-tracking/audit specimen with real items, states, and a collapsible detail);
`status-stream-demo` MUST show the LIVE strip driven by a real streamed source (the arena NDJSON stream is
in-repo — SPEC-R19). A representative `<component-gallery>`/preview specimen per host MUST show the control's
real job (a multi-item populated rail with realistic states, not one lorem item). *(ADR-0122; TKT-0010/0013;
the whole-shape + representative-specimen laws)*
- **AC1** *Given* `site-coverage.test.ts`, *then* the required-page-set check passes for `ui-timeline` and
  `ui-status-stream`.
- **AC2** *Given* the demo pages, *then* the timeline demo renders a populated durable chronology and the
  status-stream demo renders a live tail-following strip fed by a real stream.

**SPEC-R19 — The live browser proof (a REAL stream).** A cross-engine browser test MUST drive
`ui-status-stream` from a REAL NDJSON source (the in-repo arena stream via `readNdjsonLines`, an
INSTRUMENT-BRIDGE where an engine cannot drive a live proxy — feeding recorded NDJSON lines through the same
`appendEntry`/`update`/`finalize` path a live consumer would), proving: append renders a new entry, a keyed update
transitions an entry in place, tail-follow tracks the newest entry (with the stick-to-bottom guard), and the
completion invariant renders a truncated entry when the stream ends mid-flight. *(ADR-0122 F4; the testing bar;
TKT-0013 acceptance)*
- **AC1** *Given* the recorded NDJSON lines fed line-by-line, *then* the strip appends/transitions entries in
  order and tail-follows, cross-engine (Chromium + WebKit).
- **AC2** *Given* the feed truncated mid-entry, *then* `finalize()` renders that entry truncated (SPEC-R11), the
  proof runnable without a live key (the recorded stream is the fixture).

## 4. Non-goals (explicit fences)

- **One control with a `live`/`follow` posture flag** — rejected (ADR-0122 F1); the two hosts diverge on five
  mechanical axes (role, ingress, scroll, completion, motion).
- **Horizontal orientation** — a fenced, additive v2 extension (drops the alignment rail; no tail-follow
  meaning). v1 is vertical only. *(ADR-0122 F6)*
- **Owning the transport / parsing prose** — `ui-status-stream` holds no stream reader and never tokenizes or
  interprets model output; entries are structured records the consumer/protocol provides. *(TKT-0013 non-goal)*
- **A bound reactive-list / `data` array prop** — items are authored children (`ui-timeline`) or imperatively
  appended (`ui-status-stream`); data-driven generation is the A2UI list template's job at the catalog layer.
- **Deep nesting (> 1 level of sub-steps), an interactive "cancel this action" affordance, per-identity hue
  coding** — each a fenced new intake. *(ADR-0122 F6; ADR-0057)*
- **A timestamp value-codec / auto-sort** — `timestamp` is the consumer's string; order is DOM/append order,
  never auto-sorted (the adia rule).
- **Persistence hand-off** (a resolved live strip converting into durable timeline/feed content) — the consumer
  decides; a named follow-up, not v1.
- **A `ui-divider` between rows, a static `StatusStream.show()` singleton** — the former is an unbuilt
  primitive (gap-only v1); the latter inverts the per-instance isolation law (ADR-0082), as `ui-toast-region`
  recorded.

## 5. Examples

Illustrative specimens (normative for shape, not exhaustive).

**Durable timeline — an order-tracking chronology (`ui-timeline`, authored children).**

```html
<ui-timeline label="Order status" size="md">
  <ui-timeline-item status="done"    label="Order placed" timestamp="Apr 15, 2:30 PM"></ui-timeline-item>
  <ui-timeline-item status="done"    label="Processing"   timestamp="Apr 16, 9:00 AM"></ui-timeline-item>
  <ui-timeline-item status="active"  label="Shipped"      timestamp="Apr 17, 11:45 AM"></ui-timeline-item>
  <ui-timeline-item status="pending" label="Delivered"    timestamp="Expected Apr 20"></ui-timeline-item>
</ui-timeline>
<!-- host: internals.role=list; each item internals.role=listitem; markers align to one gutter axis; the last
     item's connector is suppressed; each status renders a DISTINCT marker SHAPE (ADR-0057), not hue alone. -->
```

**Live status stream — an agent narrating its own work (`ui-status-stream`, imperative-fed).**

```ts
const stream = document.querySelector('ui-status-stream')!
const a = stream.append({ key: 't1', status: 'active', label: 'Searching the codebase…' })
// … the consumer's stream yields …
stream.update('t1', { status: 'done', description: '42 files matched' })
stream.append({ key: 't2', status: 'active', label: 'Generating the patch…' })
stream.update('t2', { text: 'Reasoning: the failure is in the reconcile…' }) // streamed text, never parsed
// stream ends mid-flight:
stream.finalize() // t2 (still active) renders TRUNCATED — never a forever-spinner (SPEC-R11)
// host: internals.role=log (polite live region); tail-follows the newest entry unless the user scrolled up.
```

## 6. Trace

| Requirement | ADR-0122 fork | Decomp node(s) |
|---|---|---|
| SPEC-R1 | F1 | n3 |
| SPEC-R2 | F2/F3/F6 | n4, n5 |
| SPEC-R3 | F1/F3 | n6 |
| SPEC-R4 | F3 | n7 |
| SPEC-R5 | F6 | n8 |
| SPEC-R6 | F1/F2/F6 | n10 |
| SPEC-R7 | F2/F5/F6 | n11 |
| SPEC-R8 | F1/F4 | n13 |
| SPEC-R9 | F4 | n14 |
| SPEC-R10 | F4 | n15 |
| SPEC-R11 | F4 | n16 |
| SPEC-R12 | F2/F6 | n17 |
| SPEC-R13 | F2 | n9, n19 |
| SPEC-R14 | — | n20 |
| SPEC-R15 | — | n21 |
| SPEC-R16 | — | n22, n23 |
| SPEC-R17 | F5 | n25, n26 |
| SPEC-R18 | — | n28, n29 |
| SPEC-R19 | F4 | n30 |
