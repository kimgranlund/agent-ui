# LLD — Shell grammar v0.3 build + the `ui-agent-admin` re-host (GH #52)

> Status: proposed · v0.1 · 2026-07-20 · Layer: LLD (implementation plan)
> Implements: [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) §8
> (SPEC-R6/R7, AC9–AC12). Refines
> [ADR-0154](../adr/0154-shell-grammar-resizable-pane-tab-collapse.md) (proposed — **the build this
> LLD plans is gated on Kim ratifying it; nothing here is dispatched before that flip**).
> Composes on: [`shell-archetypes-m5.lld.md`](./shell-archetypes-m5.lld.md) (LLD-C1 landmark map ·
> LLD-C4 logical direction · LLD-C6's children-before-connect hazard · LLD-C7 shared breakpoint).
> Altitude: owns HOW the two grammar primitives are built and HOW `ui-agent-admin` migrates;
> behavior is the SPEC's.

## 1. Component map

| LLD-C | Component | Files | Depends on |
|---|---|---|---|
| **LLD-C1** | SPEC-R6 resizable inner pane | `super-shell/super-shell.{ts,css,md}` (+ tests) | C6 fork |
| **LLD-C2** | SPEC-R7 segments + `tabs` narrow arm | same | — |
| **LLD-C3** | `ui-chat-shell` knob forwarding | `chat-shell/chat-shell.{ts,md,test.ts}` | C1, C2 |
| **LLD-C4** | `ui-agent-admin` migration (the re-host itself) | `agent-admin/agent-admin.{ts,css}` | C1–C3 shipped + gated |
| **LLD-C5** | Test analogs — the pin map (§6) | `super-shell.browser.test.ts` · `agent-admin.browser.test.ts` | C1–C4 |
| **LLD-C6** | The drag-mechanism fork (§7 — needs a ruling with, or after, ADR-0154) | `components/src/index.ts` OR super-shell-local | — |

## 2. LLD-C1 — resizable inner pane (SPEC-R6)

- **Props** (extends the existing schema): `resizableStart`/`resizableEnd`
  (`prop.boolean(false)`, reflected `resizable-start`/`-end`) · `sizeStart`/`sizeEnd`
  (`prop.number(undefined)`-shaped, reflected `size-start`/`-end`; `undefined` ⇒ token default).
- **Compose:** when a side qualifies (flag set AND ≥1 pane), `#compose()` inserts
  `[data-part='pane-resizer'][data-side=…]` between the innermost pane box and the canvas —
  `role="separator"`, `aria-orientation="vertical"`, `tabindex="0"`, `aria-controls` = the pane
  box's generated id. Build-once, like every other part.
- **Drive:** drag/keyboard mutate ONLY `--ui-super-shell-pane-size-{side}` inline on the pane box
  (split.ts's geometry-seam law); `super-shell.css` gains
  `[data-part='pane'][data-slot-name='nav-pane'|'options-pane'] { inline-size:
  var(--ui-super-shell-pane-size-…, var(--ui-super-shell-pane-size)) }` for the innermost pane
  only. Clamp in JS against the two new tokens read via `getComputedStyle` at drag start (the
  split.ts measure-then-pure-math shape). Commit (pointerup / key step) writes the `size*` prop
  and dispatches `change`.
- **Interplay:** the resizer carries `data-side`, so the existing whole-side collapse selectors
  and the narrow container query hide it with zero new CSS arms (the R5d trick, reused).
- **Not building:** resizing outer stacked panes or rails (SPEC-R6a caps scope); a controlled
  `sizes`-array mode (R6d's named divergence — revisit only if a consumer actually needs
  controlled mode).

## 3. LLD-C2 — segments + `tabs` narrow arm (SPEC-R7)

- **Segments (wide):** `#compose()` detects `data-segment` on a pane slot's authored children; if
  present, the pane box gets `data-segmented`, a `[data-part='pane-tabs']` strip (one
  `ui-button`-based `role="tab"` per segment — the side-toggle construction idiom, not a nested
  `ui-tabs`: the strip must drive VISIBILITY of in-place siblings, which `ui-tabs`' own
  tab/panel-children contract cannot do without reparenting), and `data-active-segment="0"`.
  CSS: `[data-segmented] > [data-segment] { display:none }` + an active-index arm (JS sets
  `data-active` on the visible segment — attribute-driven, no per-index CSS).
- **Narrow strip:** composed once when any side declares `narrow-*="tabs"` —
  `[data-part='narrow-tabs']` as the frame's first middle-adjacent row, `display:none` outside the
  `<40rem` container query. Tabs derive at compose time: content first (`data-tab-label` of the
  first content child, default "Content"), then per pane in DOM order, segmented panes flattening
  to one tab per segment. Click ⇒ host `data-narrow-tab="content"|"{slot}"|"{slot}:{i}"`; CSS
  under the narrow query shows exactly the addressed participant (for a `{slot}:{i}` selection the
  pane box is shown AND JS moves `data-active` to segment `i` — the same attribute the wide strip
  drives, so wide⇄narrow crossings agree on which segment is current).
- **ARIA:** per SPEC-R7d's default — strips `role="tablist"`, buttons `role="tab"` +
  `aria-selected`, participants keep their landmark roles, `aria-controls` wires tab→box. No
  ResizeObserver is introduced for role-swapping; if the doc-reviewer or an a11y pass demands real
  `tabpanel` semantics, that becomes a narrow-band JS signal — a named hardening, not v1.
- **Survival law enforcement (R7c):** the ONLY DOM the strips ever mutate is their own
  `aria-selected`/`data-*` attributes — a trip-wire test asserts authored-content `isConnected`
  identity across a full band round-trip and every tab/segment switch.

## 4. LLD-C3 — `ui-chat-shell` forwarding

`chat-shell.ts` grows a static forward list — `['resizable-end', 'size-end', 'narrow-end',
'narrow-start', 'resizable-start', 'size-start']` — copied onto the inner `ui-super-shell` at
compose plus a `attributeChangedCallback`-equivalent relay for `size-*` (the one that changes
post-connect via persistence restore). `data-segment`/`data-tab-label` ride the relocated children
untouched — zero chat-shell code. Descriptor + contract↔props trip-wire update in the same change.

## 5. LLD-C4 — the `ui-agent-admin` migration

**Target composition** (inside `#compose()`, replacing the `ui-split` + narrow `ui-tabs` dual-shell
build — children authored FIRST, the shell appended to `this` LAST, per the LLD-C6
children-before-connect hazard):

```
<ui-chat-shell resizable-end narrow-end="tabs">
  <ui-conversation data-slot="content" data-tab-label="Chat">
  <div data-slot="options-pane">
    <div data-segment="Settings">  ← #settingsContent, unchanged internals
    <div data-segment="Context">   ← #contextContent, unchanged internals
```

- **Floors:** agent-admin.css sets `--ui-super-shell-pane-min-size: 20rem` and
  `--ui-super-shell-canvas-min-size: 16rem` (today's `ui-split` `min` values, verbatim).
- **Deleted:** `#applyLayout` + `#currentLayout` + the six narrow-shell fields + the
  `ResizeObserver` install/teardown + `NARROW_MAX_PX`/`layoutFor` + the `ui-split`/`ui-tabs`
  shell construction (~150 LOC of agent-admin.ts) and agent-admin.css's split/tabs docking rules —
  the GH #52 net-negative bar is asserted in the PR, not assumed.
- **Kept untouched:** the GH #145 store-swap reset (`#storeSeen`/`#resetConversationState`), all
  turn arms, entry sections, master switches, Context render slots. Chrome-only surgery.
- **Size persistence:** out of v1 scope — `size-end` stays session-ephemeral (parity: today's
  `ui-split` ratios don't persist either). The reflected prop makes it a one-liner later.

## 6. LLD-C5 — the pin map (the part a shallow design misses)

| Existing pin (`agent-admin.browser.test.ts`) | Fate | Analog |
|---|---|---|
| split ≥640: `:scope > ui-split` visible, narrow `ui-tabs` `display:none` | REPLACED | shell frame visible; `[data-part='narrow-tabs']` computes `display:none` at wide |
| narrow <640: 3 tabs Chat/Settings/Context, split `display:none` | REPLACED | `narrow-tabs` strip shows exactly `[Chat, Settings, Context]`; canvas/pane visibility per `data-narrow-tab` |
| **live surface SURVIVES 1200→800 (same band)** | KEPT verbatim | same assertion — now trivially true (no JS layout moves exist) |
| **crossing INTO narrow shows "Closed."** | **SWAPPED (ADR-0154 cl.4)** | live surface SURVIVES the 1200→500 crossing AND a Chat→Settings→Chat tab round-trip un-cycled; the "Closed." treatment stays `ui-conversation`'s own contract for GENUINE disconnects, no longer exercised by layout |
| Settings/Context tab switch + Agent-heading visibility probes | REPLACED | same probes against pane segments |
| no-horizontal-overflow probe | KEPT | plus SPEC AC12's resize-position sweep |

Plus new super-shell-level tests for AC9/AC10/AC11 that do NOT involve agent-admin — the grammar
proves itself on its own demo composition first (the ADR-0151 F3 discipline).

## 7. Open fork — the drag mechanism (recommend, not self-ratify)

`traits/pane-resize.ts` (the drag/keyboard/abort machinery `ui-split` uses) is NOT on
`@agent-ui/components`' export surface (`.` barrel and `./controls/*` subpaths only — verified
against `components/package.json`), and app code may not deep-import `src/**`.

- **Option A (recommended): export the trait** from the root barrel (the ADR-0023 `mount()`
  public-API-widening precedent) — one drag mechanism fleet-wide, `ui-split`'s hardened
  press-relative-delta/abort semantics for free.
- **Option B: re-derive** a minimal drag loop inside super-shell — no API widening, but a second
  drag implementation to keep correct (the exact parallel-mechanism drift LLD §7 of the M5 LLD
  already flags for landmarks).

Recommendation: A, decided alongside ADR-0154's ratification (it widens a ratified package
surface, so it rides the same ruling, not a silent build choice).

## 8. Build sequence

1. LLD-C6 ruling lands with ADR-0154's ratification → 2. C1+C2 in `ui-super-shell` (own tests,
AC9–AC12 green cross-engine) → 3. C3 chat-shell forwarding → 4. C4 migration + C5 pin swap, filed
as its own GH issue (the "scoped build ticket" GH #52's investigation named), closing #52.
