---
name: component-patterns
description: >-
  Route to the fleet's PRIOR-ART map: the settled mechanisms a new or novel ui-* component
  should reuse instead of reinventing — overlay/dismissal, container box-model, value codecs,
  provider/context, field labelling, focus-preserving reorder, swappable packs, z-scoping,
  catalog exclusion, adopt-or-create declarative children, derived-never-hand-listed maps,
  opt-in progressive-enhancement seams, first-paint-vs-re-render detection. Use when
  designing anything and asking "has the fleet solved this before" — a floating panel, a
  formatted value, cross-component context, a lazy-loaded heavy subtree, an imperative +
  declarative dual contract. One routing sentence + the owning ADR per pattern; the mechanism lives in
  the ADR and its realized source (cite, never copy). NOT for the normative law layer
  (component-standards) or the build procedure (component-build).
user-invocable: false
disable-model-invocation: false
---

# Component patterns — the prior-art map

Before designing a mechanism, sweep this index — has the fleet solved this problem shape
before? The full table (the fleet's mechanism per row, worked in prose, plus every ADR/home
citation) lives in `references/patterns-table.md` — **read it before designing**, this index
only orients which row applies. Reusing a row is the default; deviating from one is an
ADR-worthy fork, not a local choice.

## Problem-shape index (read references/patterns-table.md for the mechanism)

| Problem shape | Pattern | ADR |
|---|---|---|
| Reusable behaviour shared across controls | trait `(host, opts) => cleanup` | ADR-0010 |
| Shared value-control base plumbing across a family | `controls/_base/` widget bases | ADR-0042 |
| A floating panel anchored to a trigger | Overlay controller + platform dismissal | ADR-0043/0045 |
| Which control owns modal/docked/anchored surface | modal/drawer/popover/shell vocabulary | ADR-0188 |
| Consistent padding/gaps/sticky regions in a container | `[data-box]` container box-model | ADR-0046 |
| A container stacking children sanely under overlays | container = own z-depth scope | ADR-0052 |
| A typed value with a formatted editing surface | value codec per `type` | ADR-0047/0048 |
| A heavy sub-component only some usages need | lazy `import()` at the interaction point | ADR-0048 |
| One component needs to know about many descendants | connect-time registration + reactive registry | ADR-0050 |
| A wrapper labels/describes a control it doesn't own | field-labelling seam | ADR-0051 |
| Reordering children without losing focus | `ChildPart.moveBefore` | ADR-0022 |
| Imperative composition into a template-rendered tree | `mount()` directive-host seam | ADR-0023 |
| A swappable asset/provider family (icon packs) | pure core + subpath adapters | ADR-0065/0066 |
| A component that must NEVER be agent-emittable | `EXCLUSION_ALLOWLIST` | ADR-0112 cl.6 |
| Nesting a shipped control that moves light-DOM children at connect | ordering constraint — compose around the move | ADR-0017 + ADR-0048 |
| A grid whose columns populate conditionally by props | explicit `grid-column` on every fixed-role part | TKT-0014 |
| Ambient theming context over a subtree | `ui-theme-provider` | ADR-0117 |
| A component-owned scroll region across disconnect/reconnect | live scroll-listener shadow, restored in `connected()` | TKT-0067 |
| Imperative API + declarative light-DOM children, both | adopt-if-authored-else-create | ADR-0180 |
| A second lookup/map over an already-canonical key set | derive from canonical constants, never hand-list | ADR-0181 cl.4 |
| An optional progressive-enhancement browser API (View Transitions) | one shared seam, default-`false` boolean prop | ADR-0183 |
| A streaming host telling first paint from re-render | host's own settled-once boundary | ADR-0183 Amendment |
| Cross-DOM morphs on an opted-in View Transitions surface | opt-in named-morph convention, `ui-vt-{surface}-{token}` | ADR-0183 Amendment (GH #958) |
| Async-stale content dimmed while a new answer is in flight | `:state(pending)` + `--ui-pending-*`, composes under settled | ADR-0191 |
| A settled choice must read answered-not-disabled, correction via Edit | `:state(answered)` + `--ui-answered-*` aliases; `disabled > pending > answered > focus > hover > filled > default`; append-amendment template | ADR-0196 |
| General-purpose functionality outside components' layers | mint a zero-dep sibling package off `components` | ADR-0115/0119/0192 |
| A layer below `app` needs to persist something | `StorageAdapter` seam in `@agent-ui/shared`, localStorage + IndexedDB tiers; sync reads = tier-scoped `SyncReadableStorageAdapter` via narrowing factory | ADR-0193 (+ Amendment) |
| An N-level show-one-hide-rest container whose position is an array (drill/stack path) | show-one-hide-rest + controlled-array-prop-duality — never-empty path, append-only forward, defined repair | ADR-0195 |
| [incident] A content-sized flex item collapses to a fixed-floor child's min-width | `align-self: stretch; max-inline-size: none`, never re-tune the cap | ADR-0160 Amendment (GH #1032) |
| A load-on-demand stopgap before a real model-side tool-call loop | exact-match auto-attach via the existing reference path, one per turn, no fuzzy | ADR-0190 Amendment (GH #1030) |
| A public barrel's static re-export drags a heavy arm into every entry chunk | barrel-lazy-split: subpaths + memoized `loadX()` accessor, bundle-shape gated | ADR-0197 |

## How to use a row

1. Read the ADR (the rationale + the forks it settled) — `.claude/docs/adr/` IS the index: the
   numbered filenames carry order + title, and each file's own header carries status and its
   consequence trail. (No index file lives there — `doc-standards` §1b.)
2. Read the realized home end-to-end — the code is the resolved shape, the ADR is why.
3. If your case doesn't fit the row's stated scope, that's a **fork**: name it in the intake
   ([[component-design]]), don't quietly stretch the mechanism.

## Cross-links

The law layer (anatomy/geometry/states/tokens) → [[component-standards]] · packaging
→ [[component-packaging]] · the test bar → [[component-testing]] · the
intake procedure that runs this sweep → [[component-design]].
