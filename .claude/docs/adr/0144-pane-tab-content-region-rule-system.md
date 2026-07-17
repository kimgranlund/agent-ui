# ADR-0144 — the pane/tab content-region rule system: layout hosts own bounds+scroll, regions compose INSIDE; `ui-tabs` gains an opt-in `fill` posture; `ui-split-pane` stays zero-padding by law

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat ([TKT-0093](../tickets/tkt-0093-composable-content-region-rule-system.md) intake — Kim's ask, off the `ui-agent-admin` screenshots: decompose `ui-tabs`'/`ui-split-pane`'s composition anatomy properly and settle whether panes/tab-panels manage header/body/footer content directly or delegate to a shared container pattern placed inside them) |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build: `controls/tabs/tabs.css` (the `:scope[fill]` variant + the panel scrollbar seam) · `controls/tabs/tabs.ts` (+`tabs.md`) — the ONE reflected `fill` boolean · the A2UI `Tabs` row disposition (Q1 cl.4) · `controls/split/split-pane.md` + `controls/tabs/tabs.md` gain the Q2/Q3 policy statements · the docs-site composing-containers teaching block (the ADR-0056 cl.2 home) gains the three-rule statement · a NAMED follow-up ticket for the `agent-admin.css` retrofit (Q3, Consequences — out of this build per TKT-0093's own scope) · [TKT-0093](../tickets/tkt-0093-composable-content-region-rule-system.md). Decomp: [`pane-tab-content-region-rules.decomp.json`](../decompositions/pane-tab-content-region-rules.decomp.json) (coverage-clean, `--strict`) |
> | **Supersedes / Superseded by** | Extends [ADR-0120](./0120-app-surfaces-m4-panes-settings.md) (the primitive-vs-chrome tier split, generalized here from "where code lives" to "who owns content regions") · Extends [ADR-0104](./0104-tabs-transparent-surface-default.md) (tabs' no-surface identity — this ADR keeps the panel content-opinion-free the same way) · Extends [ADR-0056](./0056-region-less-card-humane-default.md) cl.2 (the composing-containers pedagogy gains the pane/panel rule) · Relates [ADR-0046](./0046-container-box-model.md) (the `[data-box]` region system this ADR ratifies as the taught generalization; its rem-fixed-padding ruling decides Q2) · [ADR-0015](./0015-container-surface-space-token-model.md) (the space ladder Q2 declines to attach) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (the Lane-B catalog disposition for `fill`) |

## Context

TKT-0093's three forks, run through the two-plane method (outside-in structure × inside-out actions,
crossed — the manifest above) against the **real shipped source, read in full before any fork was
decided**: `tabs.ts`/`tab.ts`/`tab-panel.ts`/`tabs.css`, `split.ts`/`split-pane.ts`/`split.css`/
`split-pane.css`, the card region triple + `card.css`, `_surface/container-box.css`, and
`agent-admin.css:83-152`.

**The tabs anatomy as shipped.** `ui-tabs` is the coordinator (a `UIContainerElement` with the
surface axes, transparent by default per ADR-0104); it creates the `[data-part=tablist]` strip and
reparents the `ui-tab` rows into it; `ui-tab-panel` siblings are bare `UIElement`s — `role=tabpanel`
via internals, self-set `tabindex=0` (`tab-panel.ts:27-28`, the APG rationale: *"the panel takes
tabindex=0 so a keyboard user can reach its content/scroll it"*), body = light-DOM children. In CSS
the shell is `display: block`; the panel gets `padding: var(--ui-tabs-panel-pad)` (=
`--md-sys-space-md`) and the author-origin `[hidden]{display:none}` guard — and **no `overflow`
rule anywhere**. So the panel's own contract already *anticipates* being a scroll container (that is
the only reason it is focusable) while the sheet ships no scroll posture: in a height-bounded parent
a long panel just grows, and the ancestor scrolls the strip away.

**The verified consumer evidence.** `agent-admin.css:117-137` (TKT-0085) hand-rolls exactly that
missing posture for BOTH of its `ui-tabs` instances — shell `display:flex; flex-direction:column;
block-size:100%; min-block-size:0`, visible panel `flex:1 1 auto; min-block-size:0; overflow-y:auto`
— under its own admission (`:118-120`): *"the fleet has no shipped 'scrolling tab body' variant yet;
this is this consumer's own composition, not a tabs.css change."*

**The split-pane spacing facts (Q2's "unverified" — now verified).** `split-pane.css` declares
**zero** padding or gap and references **no** space token — neither `--md-sys-space-*` nor the
pre-ADR-0140 `--ui-space-*` spelling appears in the file (grepped, then read in full). Its only
dimensional facts are the `--ui-split-pane-min: 4rem` floor (geometry, not spacing), `overflow: auto`,
and the consumer-inherited `--ui-split-pane-scrollbar-width` seam. Its banner states the posture as
law: *"a pane has no frame of its own — `overflow: auto` lets whatever CONTENT the author places (a
`ui-card`, a nav tree, prose) manage its own scrolling; the pane itself is a pure flex-distribution
box."* `split.css` owns only divider/hit-slop/key-step — no inter-pane gap (the divider IS the gap).

**The region-system facts.** The generalization TKT-0093 asks about **already shipped**:
`_surface/container-box.css` is a tag-agnostic, opt-in (`[data-box]`) content-region system —
flow-root BFC + inset margins, sticky `header`/`footer`/`[data-region]` brackets, the 12/6/8 region
padding law, the scroll-fade mask — consumed by modal/select/menu/combo-box/calendar; `ui-card`'s
region sub-elements are its chrome-grade sibling realization (frame, radius chain, `scrollable`
content-is-viewport, keyboard/focus machinery, ADR-0046 Amendments 2–6). And ADR-0046 §Alternatives
explicitly **rejected** `--ui-space`-driven region padding — Kim's ruling made region padding
density-INVARIANT rem, with density riding only the adornment/layout gaps.

## Decision

Three forks, each decided with a firm recommendation; Q3 is the contract-shaping one — the other two
are its instances.

### Q1 — `ui-tabs` decomposition: the shell gains an opt-in `fill` posture; the panel stays a bare region

The proper breakdown against composed content is **coordinator shell (surface + selection) · tablist
strip (chrome: control-height rows, indicator, divider) · panels (bare content regions that are also
the widget's scroll boundaries)**. Crossing that against real composed content finds exactly ONE
unhosted action — *fill a bounded parent with a pinned strip and a scrolling active panel* — and it
belongs to the **shell**, not the panel: the panel cannot pin a strip it is a sibling of. Four clauses:

1. **`<ui-tabs fill>` — one reflected boolean prop** (the `split-pane` `collapsible` shape), realized
   **CSS-only** in `tabs.css`: `:scope[fill]` → `display:flex; flex-direction:column;
   block-size:100%; min-block-size:0`; the visible panel → `flex:1 1 auto; min-block-size:0;
   overflow-y:auto`. This is the shipped-once form of the exact composition `agent-admin.css`
   hand-rolled (whose `[hidden]` author-beats-UA guard and `min-block-size:0` chain are precisely the
   non-obvious legs worth not re-teaching per consumer). Default (`fill` absent) stays byte-identical
   to today's document-flow tabs.
2. **The panel gains NO content-region semantics** — in fill mode it becomes exactly what its
   shipped `tabindex=0` already promises: a scroll container. Header/body/footer inside a panel is
   Q3's business, not the panel's.
3. **The scrollbar seam mirrors split-pane's**: the fill panel reads
   `scrollbar-width: var(--ui-tabs-panel-scrollbar-width, auto)` — consumer-INHERITED, var()-fallback
   only, never declared in the token block (an own declaration would beat the composing surface's
   inherited value — the TKT-0065 lesson `split-pane.css:40-47` already records).
4. **Keyboard-scroll disposition is measured at build, not assumed.** `ui-card-content`'s identical
   shape measured Chromium scrolling a focused overflow region while WebKit no-opped entirely
   (ADR-0046 Amendment 6); unlike card, the filled panel's scrollbar stays VISIBLE by default, so
   the platform default may suffice — the browser leg measures both engines and, only if WebKit
   still no-ops, the panel adopts `card-content.ts`'s explicit keydown handler. Catalog disposition
   for `fill` is Lane B (ADR-0102): a structural boolean on the shipped `Tabs` row (the `SplitPane`
   `collapsible` precedent) or a reasoned exclusion, decided at build.

### Q2 — `ui-split-pane` spacing policy: it does NOT ride the space ladder today, and it SHOULD NOT

**Verified answer to the ticket's open question: no** — nothing governs padding/gap inside a split
pane today (Context), and this ADR rules that **zero-padding stays the pane's law; no
`--md-sys-space-*` adoption, no new pad token**. Three grounds:

1. **Tier mechanics (ADR-0120):** the pane is a layout primitive sibling to `ui-row`/`ui-column`
   — and even those expose gap only as opt-in enum props defaulting to `none`
   (`row.css:41`). A primitive that *defaults* to padding stops composing: every region-bearing
   child (a Card's 12/6 region pads, a `[data-box]`'s 6px insets, a filled tabs' panel pad) would
   double-inset against it.
2. **The reconciliation TKT-0093 asked for cuts the other way:** Card's box-model is deliberately
   NOT on the space ladder — ADR-0046 rejected `--ui-space`-driven region padding for
   density-invariant rem, by Kim's explicit ruling. "Adopt `--ui-space` for the pane" would
   *contradict* the ruled container box-model, not align with it.
3. **The pane already owns its only legitimate dimensional facts:** the `--ui-split-pane-min` floor
   (geometry-class, the entry-control floor's spirit) and the scroll boundary. Spacing inside it is
   the hosted content's job — rule 3 below.

`split.css`/`split-pane.css` are therefore **confirmed no-ops** in this build; the policy lands as
descriptor prose (`split-pane.md`), not CSS.

### Q3 — the rule system: regions compose INSIDE; no host grows its own header/body/footer anatomy

**Panes and tab-panels do not grow region anatomy — ever.** The generalized container pattern the
ticket asks about already exists, shipped twice; the decision is to state the rule once and ratify
the existing generalization as the taught idiom, not to mint anything new. Three rules, fleet-wide:

1. **Layout hosts own BOUNDS + SCROLL, never content regions.** `ui-split-pane` (shipped:
   `overflow:auto` + the min floor) and `ui-tab-panel` (gaining the scroll leg via Q1's `fill`) —
   and any future pane-like primitive — expose zero header/body/footer semantics. This generalizes
   ADR-0120's primitive-vs-chrome split from package placement to content-region ownership, and
   matches ADR-0104's identity test: a panel's identity is *the place content goes*, not a surface
   or a chrome pattern.
2. **Content regions come from a region-bearing container composed INSIDE the host.** Two shipped
   grades, chosen by what the content needs: **`ui-card`** where the region needs chrome (frame,
   radius, the `scrollable` masked viewport, its keyboard/focus machinery); **the `[data-box]`
   region system** (`container-box.css`) where the need is structural — sticky brackets, the region
   padding law, scroll-fade — without a card's frame. `[data-box]` IS "Card's regions, generalized"
   (tag-agnostic, five consumers) and is hereby ratified as a **public, taught composition idiom**
   rather than an internal implementation detail: the composing-containers teaching block (ADR-0056
   cl.2's home) gains the rule. No new `ui-region-*`/generic-container element family is minted.
3. **Content rhythm belongs to content wrappers, never to the host.** Gap-between-sections is
   `ui-row`/`ui-column`'s enum gap (the `--md-sys-space` ladder), a `[data-region=content]`'s 8px
   rhythm, or a Card content gap — composed inside the pane/panel. (This is why `agent-admin.css`'s
   `gap: 1rem` panel rule stays consumer-owned after the retrofit — it is content layout, not host
   law.)

**What this earns, honestly:** TKT-0093's Acceptance anticipated "the SPEC/LLD the resolved forks
earn." The forks resolved to *no new pattern family* — the multi-component contract a SPEC would
govern does not exist; the one build is a single-component opt-in variant whose acceptance criteria
fit inline (below). Minting a SPEC for it would be process nobody was unsure about — this ADR + the
coverage-clean decomposition are the record the resolution earns.

## Acceptance

- **Q1, browser, both engines:** a `<ui-tabs fill>` inside a height-bounded parent — strip rect
  identical before vs after panel scroll (pinned); active panel `scrollHeight > clientHeight` with
  live internal scroll; non-selected panels compute `display:none`; the whole-shape leg mounts the
  agent-admin shell shape (fixed-height flex column) and asserts the widget partitions it with no
  overflow leak. Negative control: a `fill`-less `ui-tabs` is byte-identical to today.
- **Q1, jsdom:** `fill` reflects; `tabs-descriptor.test.ts` green with the new `tabs.md` row; the
  fill panel rule's `scrollbar-width` reads the var()-fallback seam and the token block does NOT
  declare it (`tabs-css.test.ts`).
- **Q2:** the build commit shows **zero hunks** in `controls/split/*.css`, `controls/card/*`, and
  `controls/_surface/container-box.css`; `split-pane.md` states the zero-padding/no-ladder policy.
- **Q3:** the composing-containers teaching block carries the three rules with `[data-box]` cited;
  the follow-up retrofit ticket exists naming the `agent-admin.css:121-137` collapse.
- `npm run check && npm test` green; the docs-grammar link sweep green.

## Consequences

- **The retirement path TKT-0093 requires (a FOLLOW-UP build, out of this ADR's own scope):**
  `agent-admin.css:121-137`'s two hand-rolled rule pairs collapse to `fill` on both `ui-tabs`
  instances; the hidden-scrollbar look keeps riding the app's existing inherited seam (now the
  fleet's `--ui-tabs-panel-scrollbar-width`); the `display:flex; flex-direction:column; gap:1rem`
  content-rhythm leg stays consumer-owned per rule 3 (or migrates into a `ui-column` inside the
  panel). Filed as its own ticket at build dispatch.
- **`[data-box]` becomes a public contract.** Ratifying it as taught (rule 2) means a future
  `container-box.css` change is a public-idiom change, not an internal refactor — named cost,
  accepted: five families already depend on it identically, so its de-facto stability is priced in.
- **The `Tabs` catalog row may grow a structural boolean** (Q1 cl.4, Lane B) — an agent can then ask
  for a bounded, self-scrolling tabs without any consumer CSS, closing the composed-surface gap for
  CSS-less consumers too.
- **Out of scope, unchanged:** the tab selection/roving machinery, ADR-0104's transparent-surface
  posture, `ui-split`'s constraint/drag system, Card's region mechanics, the `[data-box]` rules
  themselves (rule 2 ratifies, it does not modify).

## Alternatives considered

- **Panel/pane-owned region anatomy (`ui-tab-panel-header`, per-host header/body/footer).**
  Rejected: duplicates two shipped region systems and multiplies per future host (pane, panel,
  modal, drawer, …) — the one-fact-one-home failure; ADR-0120's tier split already answers where
  composed chrome lives.
- **A new generic region element family ("Card's regions, generalized" as `ui-region-*` elements).**
  Rejected: `[data-box]` already IS the tag-agnostic generalization, shipped and proven by five
  consumers; a parallel element vocabulary beside it is the second-vocabulary failure ADR-0104's own
  Alternatives (a second surface vocabulary) rejected in miniature.
- **`fill` as `ui-tabs`' DEFAULT posture.** Rejected: breaking for every document-flow tabs (the
  common bare case), and `block-size:100%` against an auto-height parent is inert-to-harmful — the
  posture only means something in a bounded parent, which is exactly what an opt-in attribute
  declares (the `<ui-card scrollable>` shape).
- **Teaching-only (document the hand-rolled CSS as an idiom; no component change).** Rejected: the
  composition has three non-obvious load-bearing legs (the `min-block-size:0` chain, the
  `:not([hidden])` targeting, the author-beats-UA hidden guard) — the class of thing the fleet ships
  once rather than re-teaches (ADR-0056's fallback-vs-teaching reasoning); and a CSS-less catalog
  consumer can never reach a taught idiom at all (ADR-0102 Lane B needs a prop).
- **Adopting `--md-sys-space-*` for default pane padding.** Rejected per Q2: it double-pads every
  region-bearing child and contradicts ADR-0046's ruled density-invariant region padding; the ladder
  stays the CONTENT layer's spacing vocabulary (row/column gap, the tabs strip/panel tokens that
  already ride it).
