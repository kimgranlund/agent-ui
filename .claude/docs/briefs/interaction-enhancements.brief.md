# Interaction Enhancements — research brief

> Status: brief (pre-PRD research) · v0.1
> Source: research seat, 2026-08-15 · Category owner list (verbatim scope): re-order drag & drop mode ·
> CSS-native swiper · drill-down panels · View Transitions API · persistence/local-db.
> Zero-dependency law applies fleet-wide (one ruled exception: `@agent-ui/code/editor`, ADR-0139) —
> every pattern below is grounded in NATIVE mechanics; no library adoption is proposed anywhere.

Per enhancement: the canonical pattern → fleet coverage (EXISTS / PARTIAL / MISSING) → the gap →
recommended first slice → zero-dep implications.

---

## 1. Re-order via drag & drop (explicit drag-mode)

### Pattern

Two canonical mechanics exist on the platform:

- **HTML5 Drag and Drop API** (`draggable`, `dragstart`/`dragover`/`drop`, `dataTransfer`) — broad but
  notoriously quirky: inconsistent drag-image rendering, no touch support without polyfills, poor
  styling control. Modern component libraries have largely abandoned it for list reorder.
- **Pointer Events + `setPointerCapture`** — the modern canon: `pointerdown` on a handle, capture,
  `pointermove` hit-tests siblings, commit on `pointerup`/`pointercancel`. Unifies mouse/touch/pen,
  full styling control, works with `moveBefore()` for state-preserving DOM moves.

A11y canon (WAI-ARIA + WCAG 2.2 §2.5.7 "Dragging Movements"): every drag interaction MUST have a
single-pointer/keyboard alternative — arrow-key reorder while an item holds focus, `aria-grabbed`'s
successor pattern (live-region announcements of "moved to position N of M"). The **explicit
drag-MODE** pattern (a toggle that arms dragging, iOS "Edit" convention) is itself an a11y asset:
the mode boundary announces intent, disarms accidental drags, and scopes the keyboard fallback.

### Fleet coverage — PARTIAL

- **EXISTS (app-shell precedent, not a fleet primitive)**: GH #921 / PR #922 shipped exactly this
  shape in the Manage-agents drawer (`site/pages/agent-admin-app.ts` ~L387–L741): a `ui-toggle`
  ("Reorganize") arms the mode; `data-reorder-mode` on the list keys the CSS affordance; per-row
  drag handles use `pointerdown → setPointerCapture → pointermove` sibling hit-testing (explicitly
  NOT the HTML5 DnD API — the comment at L584 names its cross-browser quirks as the reason); a
  keyboard fallback shares the same commit path (~L741). This is page-level code, not reusable.
- **EXISTS (adjacent traits)**: `traits/value-drag.ts` (1-axis) and `traits/area-drag.ts` (2-axis,
  LLD-C4) carry the exact pointer-capture lifetime discipline (per-drag `AbortController`,
  `host.listen` scoping) — but map pointer→ratio, not pointer→list-position.
- **EXISTS (move primitive)**: ADR-0022's native-`moveBefore` + identity-fallback reorder in the
  template layer preserves focus/state across DOM moves.
- **MISSING**: a reusable `(host, opts) => cleanup` trait (`list-reorder`?) and/or a `reorderable`
  affordance on `ui-list` — the #921 code cannot be imported by any other surface.

### Gap & first slice

Extract the #921 mechanics into a `traits/list-reorder.ts` trait: options = items accessor, handle
selector, `onCommit(fromIndex, toIndex)`; carries pointer capture, sibling hit-test, keyboard
fallback (arrow keys while armed), and the `data-dragging`/`data-reorder-mode` CSS hooks as a
documented contract. Slice 2 (separate): a `reorderable` opt-in on `ui-list` consuming the trait +
a `change`-family event. The agent-admin page then migrates onto the trait (dogfood proof).

### Zero-dep implications

None violated — pointer events, `setPointerCapture`, `Element.moveBefore` are all platform-native.
The HTML5 DnD API is deliberately NOT the mechanism (per #921's own in-code ruling).

---

## 2. CSS-native swiper

### Pattern

The canonical zero-JS swiper stack: **CSS scroll-snap** (`scroll-snap-type: x mandatory` +
per-slide `scroll-snap-align`), `overscroll-behavior`, and `scrollTo({behavior: 'smooth'})` /
`scrollIntoView` for programmatic paddle advance. Active-slide detection via `IntersectionObserver`
(or the newer `scrollsnapchange`/`scrollsnapchanging` events, Chromium 129+, not cross-engine yet).
CSS transitions animate non-scroll properties (pagination dots, labels, opacity/scale of slides via
scroll-driven animations where available — `animation-timeline: view()` is Chromium-shipped,
Safari 26+, progressive-enhancement territory).

### Fleet coverage — EXISTS

`ui-swiper` (five-element family: `ui-swiper` · `-item` · `-pagination` · `-paddles` · `-label`;
`packages/agent-ui/components/src/controls/swiper/`, ADR-0124, swiper-family.lld.md) already IS the
CSS-native shape — the descriptor names it "the fleet's FIRST scroll-snap surface":

- scroll-snap axis via `orientation`, per-slide `align` (`scroll-snap-align`), responsive
  `slides-in-view` via container queries;
- `loop` (clone-teleport), `pagination`/`paddles` opt-in anchors, bindable `active` (ADR-0019);
- `duration`/`easing` override the PROGRAMMATIC-advance motion only — native gesture snaps are
  browser-driven by design (ADR-0124 F1), which is the correct CSS-native posture.

### Gap & first slice

The ask is essentially satisfied; residual candy, each optional:

1. **Scroll-driven slide styling** — a progressive-enhancement `animation-timeline: view()` hook
   (e.g. inactive-slide dim/scale) as documented consumer CSS or an opt-in attribute.
2. **`scrollsnapchange` adoption** — replace/augment the current active-detection with the native
   event where present (keep the existing mechanism as fallback).
3. **Verification-only slice**: a doc-page example proving the pure-CSS consumer story (swiper with
   zero JS calls) if the site doesn't already carry one.

First slice = (3) then (1); both are additive, no API change.

### Zero-dep implications

Already zero-dep. Scroll-driven animations are pure CSS; feature-detect nothing (unsupported
engines simply skip the `@supports (animation-timeline: view())` block).

---

## 3. Drill-down panels (single panel, 2–3+ level tree)

### Pattern

One panel viewport; selecting a branch node slides the next level in (forward), a Back affordance
slides the previous level back (reverse). Canon: a panel STACK modeled as a path array
(`['root','settings','appearance']`), horizontal translate or View Transition between levels,
focus moved to the incoming panel's heading, `aria-level`/breadcrumb context, Back must be
keyboard-reachable and `Escape`-adjacent. iOS `UINavigationController` / Android fragment
back-stack are the native archetypes. Distinct from `ui-tree` (all levels visible, disclosure) —
drill-down shows exactly ONE level at a time, which is why it wins on narrow surfaces.

### Fleet coverage — PARTIAL

- **EXISTS (one level, one host)**: `ui-nav-rail collapse="drill-in"` (SPEC-R7;
  `packages/agent-ui/app/src/controls/nav-rail/`) — a master-detail drill at narrow widths with a
  Back affordance; `ui-settings` composes it (`app/src/controls/settings/settings.ts` builds the
  drill-in ONCE there). It is a 2-pane master↔detail flip, not an N-level panel stack.
- **EXISTS (adjacent)**: `ui-menu` (flat, no submenus found), `ui-disclosure` (in-place expand),
  `@agent-ui/router` (route-driven view swap — could back a drill but is catalog-invisible and
  must stay un-imported by `a2ui`).
- **MISSING**: a generic N-level drill container (`ui-drill`?) — path-array state, per-level slot
  or template, animated forward/back, focus management.

### Gap & first slice

First slice = design intake (this needs a fork ruling before build): (a) new `ui-drill` container
in `controls/` (slot-per-level or lazy template children; bindable `path`), vs (b) generalizing
nav-rail's drill-in into a shared trait both consume. The animation seam should be
`withViewTransition` (§4) with a CSS-transform fallback — do not build a second animation
mechanism. Recommend (a) with the nav-rail mechanics as the reference implementation, 2-level
first, N-level in the same API (path array from day one).

### Zero-dep implications

Pure DOM + CSS transforms; View Transitions as progressive enhancement via the existing ADR-0183
seam.

---

## 4. View Transitions API

### Pattern (current platform scope)

- **Level 1, same-document**: `document.startViewTransition(mutate)` — Chromium 111+, Safari 18+,
  Firefox 139+ (2025) — now effectively cross-engine.
- **Level 2, cross-document**: `@view-transition { navigation: auto }` for MPA navigation —
  Chromium 126+, Safari 18.2+; Firefox in progress.
- **Named morphs**: `view-transition-name` (incl. `view-transition-name: auto`/`match-element` in
  newer Chromium) pairs elements across the snapshot for shared-element transitions;
  `view-transition-class` groups animation styling; `::view-transition-group()` pseudo-elements
  style the animation.
- **Adjacent**: `document.activeViewTransition`, `pagereveal`/`pageswap` events (cross-document
  customization), and scroll-driven animations as the sibling "native motion" track.

### Fleet coverage — EXISTS (foundation) / PARTIAL (surfaces)

ADR-0183 (accepted 2026-08-12, GH #740) shipped the arc — note ADR-0184 is the status-stream
reasoning-trace decision, unrelated to VT:

- **EXISTS**: the ONE shared seam `withViewTransition(mutate, enabled)` + `viewTransitionAvailable()`
  in `components/dom/view-transition.ts` (opt-in AND API-present AND not reduced-motion; sync
  otherwise). S1: `ui-router-outlet view-transitions`. S2: `ui-super-shell viewTransitions`
  (segment swaps only). S3: docs-site MPA `@view-transition` CSS (Level 2, zero JS).
- **DEFERRED by its own ADR (cl.6)**: S4, A2UI streamed re-renders — booked follow-up; the design
  question is the transition GRAIN for a streamed surface (candidate: `finalize(surfaceId)`),
  complicated by ADR-0022 `moveBefore` identity interplay.
- **UNEXPLORED**: named-element morphs — ADR-0183 cl.4 explicitly leaves `view-transition-name` as
  CONSUMER vocabulary, shipping no names; a fleet naming convention is "a separate intake". Also
  unexplored: `pagereveal`/`pageswap` customization on the docs site, and wiring the seam into
  new surfaces (the drill-down panel of §3 is the natural next consumer).

### Gap & first slice

Two independent slices, either first: (a) execute the booked S4 A2UI design slice (grain ruling →
ADR amendment → build); (b) a named-morph CONVENTION intake — a documented `view-transition-name`
scheme (e.g. keyed off `ui-*` item keys) that consumers opt into, proven on one surface
(router-outlet page swap or the §3 drill). Both ride the existing seam; no new mechanism.

### Zero-dep implications

Entirely native; the seam already encodes the progressive-enhancement + reduced-motion law.

---

## 5. Persistence and local-db

### Pattern

Local-first canon (patterns, not libraries):

- **`localStorage`** — sync, string-only, ~5MB, blocks main thread; fine for small settings.
- **IndexedDB** — async, structured-clone values, large quota, indexes/cursors, transactions;
  the canonical local-db. Raw API is verbose; the PATTERN libraries like idb/Dexie encode is a
  thin promise-wrapper + typed object-store schema + versioned migrations (`onupgradeneeded`).
- **OPFS** (Origin Private File System) — `navigator.storage.getDirectory()`, sync access handles
  in workers; the high-performance file tier (what SQLite-WASM builds on). Overkill until blob/
  file-scale data appears.
- **Cross-tab coherence** — `storage` event (localStorage only), `BroadcastChannel` (general),
  `navigator.locks` for write serialization.
- Local-first sync engines (CRDTs etc.) are out of scope — no remote exists in this app layer.

### Fleet coverage — PARTIAL (localStorage-only, one seam already exists)

- **EXISTS**: `app/src/controls/settings/memory-store.ts` — `createMemoryStore({ persistKey })`, a
  signals-backed key-value store with an optional localStorage round-trip
  (`${persistKey}.${key}`), persisted-wins-over-seed semantics. Consumed by `ui-settings`,
  `entry-list` (`entry-data.ts`), and agent-admin personas (`agent-admin/entries.ts`;
  `site/pages/agent-admin-presets.ts` adds per-persona `modifiedAt`/seed-version keys;
  `agent-admin-app.ts` persists the active-preset id directly).
- **MISSING**: any IndexedDB/OPFS tier; a typed schema/migration story (the seed-version key in
  presets is a hand-rolled one-off); cross-tab coherence (no `storage`-event or BroadcastChannel
  wiring found); a shared persistence SEAM below `app` (memory-store lives in `app`, so
  `components`/`a2ui` surfaces cannot persist without reaching upward — which the layering law
  forbids them from doing).

### Gap & first slice

Where the seam lives is the load-bearing ruling: recommend `@agent-ui/shared` (bottom of the
cross-package DAG — everything may import it) gaining a storage-adapter interface
(`get/set/delete/keys`, async by contract) with two zero-dep implementations: localStorage
(migrating memory-store's round-trip onto it) and IndexedDB (single object store, versioned
`onupgradeneeded`, promise-wrapped — the idb PATTERN hand-rolled, ~100 lines). First slice = the
interface + localStorage adapter + memory-store migrating onto it (behavior-identical, tests
pinning parity); IndexedDB adapter is slice 2; BroadcastChannel invalidation slice 3; OPFS
deferred until a real blob-scale consumer exists.

### Zero-dep implications

IndexedDB/OPFS/BroadcastChannel are platform APIs; the rule is hand-roll the thin wrapper pattern,
never adopt idb/Dexie/localForage. jsdom lacks IndexedDB — the adapter's unit tests need the
browser shards or a seam-level fake (a known cost to state in the slice).

---

## Summary table

| # | Enhancement | Verdict | First slice |
|---|---|---|---|
| 1 | Drag & drop reorder mode | PARTIAL (page-level precedent #921; traits adjacent) | Extract `traits/list-reorder.ts` from the #921 mechanics |
| 2 | CSS-native swiper | EXISTS (`ui-swiper`, scroll-snap, ADR-0124) | Doc proof + optional scroll-driven-animation candy |
| 3 | Drill-down panels | PARTIAL (nav-rail `drill-in`, 1 level, app-only) | Design intake: `ui-drill` N-level container vs shared trait |
| 4 | View Transitions | EXISTS foundation (ADR-0183 S1–S3) / S4 + morphs open | Execute booked S4 A2UI grain design; named-morph convention intake |
| 5 | Persistence / local-db | PARTIAL (localStorage memory-store in `app` only) | Storage-adapter seam in `shared` + localStorage adapter migration |
