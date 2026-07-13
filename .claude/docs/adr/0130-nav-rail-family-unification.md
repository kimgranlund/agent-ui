# ADR-0130 — the unified nav-rail family: one element, three `collapse` modes (`menu` · `drill-in` · `icon-popover`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-12 |
> | **Proposed by** | planner — TKT-0030 design intake (Kim's reconcile report: the shipped `ui-settings` sections rail and the docs-site `<nav>` rail are one nav-rail concept, drifted into two implementations; TKT-0029's site-nav-v2 design phase is SUBSUMED into this intake) |
> | **Ratified by** | Kim, 2026-07-12 ("Ratify all seven as recommended"; hand-flipped in-tree) |
> | **Repairs** | NEW `spec/nav-rail-family.spec.md` · NEW `lld/nav-rail-family.lld.md` · NEW `decompositions/nav-rail-family.decomp.json` — on ratification+build: `packages/agent-ui/app/src/controls/nav-rail/**`, `site/pages/_page.{ts,css}` (mode-1 consumption), `packages/agent-ui/app/src/controls/settings/{settings.ts,settings.css}` (mode-2 adoption) |
> | **Supersedes / Superseded by** | (none) — extends [ADR-0084](./0084-app-shell-narrow-reflow-collapse.md)'s `collapse` grammar to a new component; relates [ADR-0043](./0043-overlay-selection-primitives.md)/[ADR-0045](./0045-overlay-dismissal-semantics.md) (mode 3 composes the shipped overlay primitives) · [ADR-0120](./0120-app-surfaces-m4-panes-settings.md) (the `ui-master-detail`/`ui-settings` embryo mode 2 unifies onto) · [ADR-0101](./0101-overlay-transitions-always-announce.md) (the overlay announce contract mode 3 inherits) |

## Context

Kim's report (2026-07-12, TKT-0030) names a drift: `ui-settings` (`packages/agent-ui/app/src/controls/
settings/`) ships its own hand-rolled sections rail — a `<nav>` of `[data-part=rail-item]` buttons with a
`border-inline-start` active-indicator bar (`settings.css`) — while the docs site's primary nav
(`site/pages/_page.{ts,css}`) is an independent hand-rolled `<nav data-site-nav>` of grouped links that
collapses to a `<details>` dropdown below 48rem. Same concept — a vertical list of navigable/selectable
items with an active indicator and a narrow-width collapse behavior — built twice, zero shared code or
tokens. TKT-0029 (site-nav v2: sitemap-derived, grouped with context labels, name|tag two-column rows) was
about to mint a THIRD bespoke implementation before Kim's reconcile ruling caught it and folded its design
phase into this intake.

Kim's ruling names the reconciled shape directly: **one nav concept, three collapse modes** —
1. **Site nav → menu**: the rail collapses into a menu/dropdown pattern narrow.
2. **Settings → back**: the rail collapses into the drill-in/back system `ui-settings` already rides via
   `ui-master-detail` — the pattern exists, it just is not a shared, named primitive.
3. **Icon rail → icons + popovers**: an icon-only rail whose group items open anchored popover menus.

This intake classifies the family, resolves the scope/tier/content-model/a11y forks the ticket names, and
freezes a buildable SPEC+LLD. Seven clauses below; each fork carries the intake's firm recommendation per
`agent-ui-component-design`'s discipline — **none self-ratified**.

## Decision

**One family, `ui-nav-rail` + `ui-nav-rail-group` + `ui-nav-rail-item`, ships in `@agent-ui/app`**
(sibling to `ui-app-shell`/`ui-master-detail`/`ui-settings` — the same app-tier chrome posture, PRD-D2),
**with a single closed-enum `collapse` prop on `ui-nav-rail`** — `'menu' | 'drill-in' | 'icon-popover'` —
governing how the rail's own narrow-width presentation changes. Seven clauses:

### Clause 1 — Family scope: ONE element with a `collapse` axis (settled by the ticket's own ruling)

`ui-nav-rail` is ONE component with a `collapse` enum, not three sibling elements. The three modes share
100% of the anatomy (a list of groups/items with an active indicator) and diverge only in narrow-width
behavior — exactly the shape `ui-app-shell-region`'s `collapse: 'hide'|'stack'|'toggle'` (ADR-0084)
already proves for a sibling concept (a region's own narrow-reflow disposition). Three sibling elements
would triple the anatomy/CSS/gate surface for a difference that is purely behavioral. **Recommendation:
ONE element** (the ticket's acceptance criterion already directs this; recorded, not reopened).

**Tier and catalog posture (settled, not a fork):** `@agent-ui/app` — the same posture as
`ui-app-shell`/`ui-master-detail`/`ui-settings`, all app-tier chrome per PRD-D2 (the trusted frame is
never agent-authored). `ui-nav-rail`'s DAG needs (`ui-master-detail`, `ui-menu`, `ui-popover`, `ui-icon` —
all `@agent-ui/components`) are already reachable from `app`; nothing forces `a2ui`. Catalog disposition:
an `EXCLUSION_ALLOWLIST` entry (chrome, never agent-emittable) — the same disposition as its three
app-tier siblings, none of which are catalog rows.

### Clause 2 — `collapse` is the RIGHT prop name to reuse, not a naming collision (fork; recommend YES)

`references/naming.md` principle 1 is "one name, one meaning, everywhere." ADR-0084's `collapse` means
*this component's own narrow-width reflow disposition* — a concept, not a fixed value set. `ui-nav-rail`'s
narrow behavior is the SAME concept (how the rail's own presentation changes below a width threshold),
scoped to what a nav rail — not a generic shell region — can meaningfully do. Minting a second word
(`mode`, `variant`) for the identical concept would violate principle 1 in the other direction: two names
for one meaning. **Recommendation: reuse `collapse`**, with a component-scoped, CLOSED, ADR-ratified value
set distinct from `ui-app-shell-region`'s:

```
collapse: 'menu' | 'drill-in' | 'icon-popover'   // ui-nav-rail — no default; the consumer states its intent
```

No `default` is proposed (unlike ADR-0084's `hide`-leads back-compat need — there is no existing
`ui-nav-rail` consumer to stay byte-compatible with); the descriptor may pick any one of the three as
index-0 for the enum-fallback contract (`props.ts`'s `values[0]` coercion) — the LLD fixes the exact
value, recommending `'menu'` (the simplest, most common disposition) as index-0 so an omitted/garbage
attribute degrades to the least surprising behavior.

`variant` (naming.md §3, "deliberately per-control, visual voice") is rejected — `collapse` is a
*behavioral* narrow-width contract, not a visual voice; conflating the two would blur `variant`'s own
canon meaning everywhere else it is used.

### Clause 3 — Content model: authored `ChildList`, both consumers derive their children programmatically (fork; recommend YES)

`ui-nav-rail`'s own content model is an authored `ChildList` of `ui-nav-rail-group` (optional; carries a
context-label) and/or bare `ui-nav-rail-item` (ungrouped) — the same generic-sub-element shape
`ui-app-shell`/`ui-app-shell-region` already establishes (docking = composition, not a data-prop). This is
**not a new pattern for either consumer**: `ui-settings`' `#build()` (`settings.ts`) already constructs its
rail's `<button data-part="rail-item">` elements imperatively from `schema.sections`, and the site's
`buildNav()` (`_page.ts`) already constructs its `<li><a>` elements imperatively from the `NAV` array (soon
`sitemap.json`, TKT-0029). Both consumers keep doing exactly this — the ONLY change is that the elements
they `document.createElement` are `ui-nav-rail-item`/`ui-nav-rail-group` instead of bespoke DOM. No schema/
store property pair (the `ui-settings` precedent for genuinely reactive form generation) is needed here —
nav items are simpler, static-per-render content, matching the `ui-app-shell-region` precedent rather than
`ui-settings`' own schema-driven generator.

**Recommendation: authored `ChildList`; both consumers derive it themselves** (site from `sitemap.json` per
TKT-0029, settings from `SettingsSchema.sections`) — settled by direct precedent in both embryos, not a
green-field guess.

### Clause 4 — A11y: role model derives from item SHAPE (`href` present vs. absent), not from `collapse` (fork; recommend YES — a correction to `ui-settings`' current internals)

Two of the three modes have structurally different semantics an ARIA role must not blur:

- **`collapse="menu"` (the site nav):** items are real hyperlinks to distinct resources — `ui-nav-rail-item`
  renders an `<a href>`, the group/rail carries `role="navigation"` (a genuine `<nav>` landmark, matching
  `_page.ts`'s existing `aria-label="Site"`), and the active item gets `aria-current="page"` (unchanged from
  today).
- **`collapse="drill-in"` (settings) and `collapse="icon-popover"` when its items are non-navigating:**
  items are NOT links to a different resource — they commit a selection among mutually-exclusive panels
  shown in the SAME view (exactly the tab/tabpanel relationship `ui-tabs` already models fleet-wide). Today's
  `ui-settings` fakes this with `aria-current="page"` on a `<button>` (`settings.ts`
  `#markActiveRailItem`) — a page-navigation ARIA verb misapplied to an in-page selection commit. This
  intake **corrects it**: `ui-nav-rail` sets `role="tablist"` on itself and `role="tab"` +
  `aria-selected` on each button-shaped item when items carry no `href`, mirroring `ui-tabs`' own shipped
  role contract rather than inventing a second one.

**The derivation is item-SHAPE-driven (`href` present/absent), not `collapse`-value-driven** — decoupling
gives `icon-popover` rails the same duality (a VS Code-style activity bar can be real navigation or an
in-app view-selector; the rail should not force one ARIA story on both). **Recommendation: YES**, and this
is flagged as a genuine (small) migration cost when `ui-settings` adopts the shared rail — see Clause 6.

Active indication stays **non-color-alone** (`interaction-states.md`/rubric C8): a real `border-inline-
start` bar (the `ui-settings` precedent, ported verbatim) plus an `internals.states.add('selected')` custom
state (`selected` is already in naming.md §6's closed custom-state vocabulary — no new state is minted).

### Clause 5 — `collapse="drill-in"` mechanics: `ui-nav-rail` owns anatomy only; the drill-in itself stays `ui-master-detail`'s (fork; recommend YES)

The ticket's own wording is the answer: *"its drill-in keeps riding master-detail."* `ui-nav-rail` does
**not** internally wrap `ui-master-detail` — it has no detail-pane content to pair with, and wrapping it
would force every drill-in consumer through nav-rail's own composition instead of composing
`ui-master-detail` directly the way `ui-settings` already does. **Recommendation: `ui-nav-rail` contributes
ONLY the rail's anatomy + active indication for `collapse="drill-in"`; the consumer (currently, only
`ui-settings`) keeps composing it as the `list`-pane content inside its own `ui-master-detail`, unchanged.**
This is "compose, never re-derive" applied literally: `ui-master-detail`'s narrow drill-in/back mechanism
(shipped, `master-detail.ts`) is not re-implemented, extended, or wrapped a second time.

### Clause 6 — `collapse="icon-popover"`: `ui-nav-rail` composes `ui-menu` per group and self-coordinates "one open at a time" (fork; recommend YES)

A group's flyout (icon-only trigger → a list of that group's items) needs commit-and-close +
roving-focus + Escape/outside-click dismissal — exactly `ui-menu`'s shipped contract (ADR-0043/0045),
not the bare `ui-popover` (which has no item/commit semantics of its own and would re-derive
roving-focus + commit inside nav-rail). **Recommendation: each `ui-nav-rail-group` composes one internal
`ui-menu`** (its trigger = the group's icon button, its items = the group's `ui-nav-rail-item` children,
relocated in at connect — the `ui-settings`/`ui-master-detail` child-relocation precedent), inheriting
`ui-menu`'s whole DoD (rovingFocus, dismissal, ADR-0101 announce contract) wholesale.

**One-group-open-at-a-time is new, small behavior `ui-nav-rail` itself must own** (not free from `ui-menu`
alone — each menu instance manages only its own open state): `ui-nav-rail` listens for `toggle`/`open` on
its child group menus and closes siblings when one opens, the same radio-group coordination shape the
fleet's own `ui-radio-group` already applies to its children. This is a mechanical LLD detail, not a
naming/contract fork — recorded here for completeness, ratified as part of this clause.

**Ungrouped items** (ADR-0006 precedent's slot vocabulary) render as a plain icon button with a tooltip-
style `label` (via the `ui-icon` `label` prop precedent) — no popover, since there is nothing to disclose.

### Clause 7 — The reserved `data-role="tag"` realizes here (fork bundle; recommend YES)

TKT-0029's wide name|tag two-column row (`Swiper Label      ui-swiper-label`) is realized as
`ui-nav-rail-item`'s `slot="trailing"` carrying `data-role="tag"` — `anatomy.md`'s §2 role table already
RESERVES `tag` ("additive — one `[data-role]` rule when it lands"); this is the intake that lands it, with
no anatomy.md amendment needed (purely additive, as the law anticipated). Narrow-width degrade:
**truncate the tag (ellipsis), never wrap** — the Pattern size-class law (`geometry.md`) takes rail rows
at control height; a wrap would grow the row and break the single-line rhythm every other rail row holds.
The per-component page-type sub-links (today's Permutations/States/API tabs) are **explicitly NOT folded
into the rail** — `_page.ts`'s existing `buildTabs()`/page-header tab-strip mechanism already gives them a
home, and nothing about the reconciliation changes that disposition (a non-goal, confirmed not reopened).

## Consequences

- **Two independent implementations retire.** `ui-settings`' hand-rolled `<nav data-part=rail">` +
  `[data-part=rail-item]` markup (`settings.ts`/`settings.css`) is replaced by composing `ui-nav-rail
  collapse="drill-in"`; the site's hand-rolled `buildNav()`/`<details>` dropdown (`_page.ts`/`_page.css`)
  is replaced by composing `ui-nav-rail collapse="menu"` fed from `sitemap.json` (TKT-0029's mode-1
  consumer slice). Both migrations are **build-wave follow-ups within this same family's ship**, gated by
  the family's own DoD landing first (Clause 8 below is a sequencing note, not a design fork).
- **A small, named a11y correction ships alongside the migration** — `ui-settings`' rail items move from
  `aria-current="page"` to `role="tab"`/`aria-selected` (Clause 4). This is a behavior change to a shipped
  control's internals; the settings migration slice carries its own browser-truth re-proof (no AX
  regression) rather than a silent swap.
- **`anatomy.md`'s reserved `tag` role stops being reserved** — its first real consumer ships here; no
  anatomy.md text needs to change (the law already named this exact additive path).
- **A new small coordination mechanism** (one-group-open-at-a-time for `collapse="icon-popover"`) is
  `ui-nav-rail`'s own code, not free from `ui-menu` — flagged so the build does not assume it for free.
- **Stale → re-verify at build:** `site/pages/_page.ts`'s SHELL NOTE ("a deliberate placeholder... once an
  app-shell component family ships, this shell should be REBUILT to dogfood those controls") now names
  `ui-nav-rail` as (part of) that trigger; `ui-settings.md`'s descriptor `parts:`/`aria:` blocks change with
  Clause 4's correction; the `@agent-ui/app` family size budget (`scripts/measure-size.mjs`) gets a new
  line-item, measured at build, not guessed here.

## Alternatives considered

- **Three sibling elements** (`ui-nav-rail`, `ui-settings-rail`, `ui-icon-rail`) — rejected: 100% anatomy
  overlap, only behavior differs; the ADR-0084 `collapse`-enum precedent already proves one element with a
  narrow-behavior enum is the fleet's chosen shape for exactly this kind of variation.
- **A schema/store data-prop content model** (the `ui-settings` generator precedent) instead of authored
  `ChildList` — rejected: nav-rail's content is static-per-render (no live validation, no reactive
  regeneration need); the simpler `ui-app-shell-region` generic-sub-element precedent fits both consumers'
  ALREADY-shipped imperative-construction pattern with zero new machinery.
- **A single, mode-independent ARIA role** (always `navigation`, or always `tablist`) — rejected: it would
  either mislabel settings' in-page selection as page navigation (today's actual defect) or mislabel the
  site's real hyperlinks as tabs; the item-shape-driven derivation (Clause 4) is truthful to what each mode
  actually does, at the same implementation cost.
- **`ui-nav-rail` internally composing `ui-master-detail` for `collapse="drill-in"`** — rejected: nav-rail
  owns no detail-pane content to pair with; forcing composition through nav-rail would re-derive, not
  reuse, the shipped drill-in mechanism (violates "compose, never re-derive").
- **A bare `ui-popover` for `collapse="icon-popover"` group flyouts** — rejected: would re-implement roving
  focus + commit-and-close inside nav-rail, machinery `ui-menu` already ships and gates.

## Race note

A concurrent intake (TKT-0028, M2 app surfaces) minted **ADR-0129** the same day; this ADR takes **0130**
as the next free number at write time (`ls .claude/docs/adr/` highest = 0129). If another concurrent wave
also claims 0130 before this lands, the host reconciles the collision at commit (renumber whichever lands
second) — flagged per the dispatch brief's caution, not resolved here.
