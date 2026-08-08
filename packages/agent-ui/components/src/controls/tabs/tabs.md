---
# tabs.md frontmatter — the attributes-as-API descriptor for the tabs compound (ADR-0004). The
# machine-checkable PRIMARY-element surface lives HERE (frontmatter for ui-tabs); the prose below the fence is
# the /site doc and documents all THREE elements (ui-tabs · ui-tab · ui-tab-panel — one folder, one writer). The
# `attributes[]` block MUST mirror tabs.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness — plus the bindable `selected`, plus the opt-in `fill`, plus `orientation`/`overflow`) —
# the contract↔props trip-wire (tabs-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md
# §10 / ADR-0004; the surface axes per ADR-0015; the two-way `selected` bind per ADR-0019 (renderer LLD-C8);
# `fill` per ADR-0144 Q1; `orientation`/`overflow` per `.claude/docs/lld/tabs-vertical-overflow.lld.md`.
tag: ui-tabs
description: A tab strip and panel container that switches visible content via keyboard-navigable, roving-focus tabs.
tier: pattern          # geometry size-class — geometry.md "Pattern" (container + control-height rows); tabs is the named example: the interactive tab rows take the CONTROL height, the shell uses the --md-sys-space ladder
extends: UIContainerElement  # the FIRST non-form family — surface axes + reused internals (ARIA); NOT form-associated (face below). NOTE: UIContainerElement enters the descriptor BASE_CLASSES at decomp s12 (integration) — until then validateComponentDescriptor flags BAD_EXTENDS, filtered in tabs-descriptor.test.ts
# marginal: ui-tabs measures 1421 B gz (re-measured post the overflow-menu build) at the components-barrel LEAVE-ONE-OUT tier — the delta of `npm run size`'s components barrel WITH vs. WITHOUT this control's export, tree-shaken (the tabs compound: ui-tabs + ui-tab + ui-tab-panel, now also composing the shipped `ui-menu` overflow part). Within the per-control ≤ ~2 kB tier budget (plan §10) at THIS tier.
#
# RULED 2026-08-08 (Kim, in-session; durable record: https://github.com/kimgranlund/agent-ui/issues/586#issuecomment-5223777160): the `@agent-ui/app` curated bundle (super-shell+master-detail+settings+surface-host+conversation+nav-rail, which reaches ui-tabs via its settings screen) grew from 81692 to 82565 B gz on this build — re-based its checkpoint 80 KB → 83 KB (84992 B gz) in scripts/measure-size.mjs (the same "checkpoint, not a ratchet" convention as GH #454/#480): Slice B's composed-ui-menu vehicle + fit engine, an LLD-accepted tradeoff landing at the app tier, twice-reviewed; the standing app-diet follow-up (GH #468) keeps its tripwire. `node scripts/measure-size.mjs` is green for this row as of commit (see the branch's own log for the SHA that carries this ruling).
#
# RULED 2026-08-08 (Kim, in-session — second of the day for this constant; same durable record: https://github.com/kimgranlund/agent-ui/issues/586#issuecomment-5223777160): the `@agent-ui/components/components` (self-defining ui-* family) WHOLE-BARREL absolute-size gate measured 54889 B gz against its then-current 53 KB (54272 B gz) checkpoint (itself re-based only hours earlier for the ui-otp-field S2-a build) — 617 B over. Re-based 53 KB → 54 KB (55296 B gz) in scripts/measure-size.mjs (the same "checkpoint, not a ratchet" convention): the otp-field re-base plus Slice B's overflow engine, both twice-reviewed real machinery. GH #455 remains the standing shrink follow-up.
#
# Both walls are RULED, not open. `node scripts/measure-size.mjs` is fully green (every row, whole output scrolled) and `npm run check` is green as of the commit that carries this note.

attributes:            # attributes-as-API — mirrors tabs.ts `static props` (the surfaceProps spread, then selected, then fill)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-inverting surface plane (ADR-0015); the container.css [elevation=n] selector repoints --ui-container-bg
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-consistent tonal shift (ADR-0015); 0 = the neutral base
  - name: selected
    type: string
    default: ''
    reflect: true      # the active tab's identity (a tab `key`, or its DOM index as a string; '' ⇒ the first tab). BINDABLE — the renderer two-way-binds it via LLD-C8 (value:{prop:'selected',event:'select'}, ADR-0019); reflects so the attribute mirrors the live selection
  - name: fill
    type: boolean
    default: false     # String(false) = 'false'
    reflect: true      # ADR-0144 Q1 cl.1 — an opt-in, CSS-only posture: the shell fills a height-bounded parent with a pinned tablist strip + an internally scrolling active panel (the ui-split-pane `collapsible` shape). Absent ⇒ byte-identical document-flow tabs.
  - name: orientation
    type: enum
    values: [horizontal, vertical]
    default: horizontal
    reflect: true      # GH #581 — the strip axis. Vertical flips the shell to a row (strip beside the panel), moves the divider + selected-tab indicator to the inline-end edge, and swaps the keyboard axis to Up/Down (APG tabs vertical variant). Absent/horizontal ⇒ byte-identical to today.
  - name: overflow
    type: enum
    values: [scroll, menu]
    default: scroll
    reflect: true      # GH #586 — the strip's not-enough-room strategy. 'menu' collects the tabs that don't fit behind a dots-three trigger opening a composed ui-menu of PROXY items (never a reparented ui-tab); the selected tab is ALWAYS pinned visible. Absent/scroll ⇒ byte-identical to today's overflow-x/y auto.

properties:            # IDL beyond attributes-as-API
  - name: selected
    description: The active tab's identity (string) — a tracked, reflected signal. The agent SETS it to switch tabs (programmatic → no event echoed); a user gesture COMMITS it (emits `select`). The renderer two-way-binds it (LLD-C8 / ADR-0019).

events:                # the family event vocabulary (change·input·select·open·close·toggle)
  - name: select
    detail: '{ value: string, index: number }'
    description: The ONE commit event — fired on a USER commit (click or keyboard) that CHANGES the active tab, never on a programmatic `selected` write (binding hygiene). The s11 catalog binds value:{prop:'selected',event:'select'} and the renderer's LLD-C8 controller listens to exactly this event to write `selected` back. NOT `change` (that is value-commit-flavored).

slots: []              # NO named slots — the tabs/panels are component-native ChildList ELEMENTS (ui-tab / ui-tab-panel), not slotted adornments; a tab's label is its own light-DOM children

parts:                 # the control-created tablist strip is a PART (role=tablist rides the part div, not the host)
  - name: tablist
    description: The control-created `<div data-part="tablist" role="tablist">` strip the ui-tab children are reparented into (the panels stay as siblings). role=tablist rides the PART div — the HOST carries no role/aria-* attribute. The strip is the control's own horizontal overflow viewport (GH #221 — `overflow-x auto`; labels never clip mid-word, the strip scrolls); its scrollbar visibility is the consumer-inherited `--ui-tabs-strip-scrollbar-width` seam (var()-fallback `auto`, never declared in the token block).
  - name: overflow
    description: Present ONLY when `overflow="menu"` (the overflow-menu build, created lazily, once, at connect — persists like `tablist`). A composed `<ui-menu data-part="overflow">` wrapping a square, tab-height icon-button trigger (`aria-label="More tabs"`, the `dots-three` glyph) that opens a panel of PROXY rows (`role="menuitem"`, never a reparented `ui-tab`) for exactly the tabs that don't currently fit. Lives as a shell child OUTSIDE `role=tablist` — a non-tab tablist child is an ARIA required-owned-children violation. `hidden` whenever every tab fits.

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (ADR-0008): armed one frame past first paint on ui-tabs so the upgrade/first selection SNAPS and only later changes animate
  - selected           # set on the ACTIVE ui-tab (via its internals) — keys the selected-tab ink + the underline indicator (aria-selected is on internals, so there is no [aria-selected] attribute to match)

face:
  formAssociated: false  # NOT a FACE form control — a container (extends UIContainerElement); no value/validity participation

aria:
  role: tablist          # the tablist role rides the [data-part=tablist] strip; ui-tab → role=tab, ui-tab-panel → role=tabpanel — all via ElementInternals, never a host role/aria-* attribute
  roleSource: internals (tab/tabpanel) + the tablist part
  tabRole: tab           # each ui-tab: internals.role=tab + aria-selected (internals) + aria-controls its panel (internals element-reflection — ariaControlsElements)
  panelRole: tabpanel    # each ui-tab-panel: internals.role=tabpanel + aria-labelledby its tab (internals element-reflection — ariaLabelledByElements)
  selectionSource: internals.ariaSelected  # the selected tab carries aria-selected=true via internals; the rest false
  labelSource: the tab's light-DOM children (the accessible name of the tab)
  ariaOrientation: The [data-part=tablist] strip carries aria-orientation="vertical" (set via setAttribute — never internals — the same PART-div discipline role=tablist already follows) when orientation="vertical"; ABSENT under the horizontal default (the tablist role's implicit default is horizontal, so this is byte-identical default DOM, not an explicit "horizontal" value). Connect-time only — re-resolves on reconnect (the vertical-orientation build, GH issue 581).
  overflowRoles: In overflow="menu" mode, the visible tabs stay role=tab inside role=tablist (roving covers exactly the visible set); the overflow part is role=menu of role=menuitem PROXY rows ("switch to X" commands) that never claim tab semantics.
  connectResolution: BOTH orientation's roving axis AND overflow's mode/part creation are resolved ONCE at connect (the radio-group/toolbar precedent) — a live attribute flip on either prop re-resolves only on the NEXT reconnect, never mid-session.

keyboard:
  - keys: ArrowRight
    action: Under the default `orientation="horizontal"`, move selection + roving focus to the next tab (wraps from last to first); commits (emits `select`). INERT under `orientation="vertical"` (Up/Down own that axis instead — APG tabs vertical variant).
  - keys: ArrowLeft
    action: Under the default `orientation="horizontal"`, move selection + roving focus to the previous tab (wraps from first to last); commits. INERT under `orientation="vertical"`.
  - keys: ArrowDown
    action: Under `orientation="vertical"` only, move selection + roving focus to the next tab (wraps from last to first); commits. INERT under the default horizontal.
  - keys: ArrowUp
    action: Under `orientation="vertical"` only, move selection + roving focus to the previous tab (wraps from first to last); commits. INERT under the default horizontal.
  - keys: Home
    action: Move selection + roving focus to the first tab; commits. Same either axis.
  - keys: End
    action: Move selection + roving focus to the last tab; commits. Same either axis.
  - note: ROVING TABINDEX — exactly the selected tab is tabindex=0; the rest are tabindex=-1 (a single tab-order entry). Selection follows focus (APG automatic activation). Re-armed on reconnect (connected() re-installs the listeners + the selection effect).
  - note: The keyboard AXIS is CONNECT-RESOLVED from `orientation` (the radio-group/toolbar precedent, roving-focus.ts reads its `orientation` option once at invoke, never a live accessor) — a live attribute flip re-resolves only on the next reconnect, never mid-session.
  - note: In overflow="menu" mode, the roving ring covers exactly the VISIBLE tabs (an overflowed tab is skipped by Arrow/Home/End); a menu commit promotes the chosen tab through the same commit path a click uses.
  - note: In overflow="menu" mode the overflow trigger is its OWN Tab stop, AFTER the tablist strip in document order — a deliberate deviation from a "final arrow stop" shape (the roving trait is scoped to the strip container; arrows never reach an element outside it). Enter/Space opens its menu (native button plus ui-menu's own trigger wiring); Escape closes the open menu and returns focus to the trigger (the overlay controller's light-dismiss focus-restore).
  - keys: ArrowDown / ArrowUp / PageDown / PageUp / Home / End
    action: In `[fill]` mode ONLY, scroll the visible panel when it itself is the focused key target (never a focused descendant's own key). MEASURED at build (ADR-0144 Q1 cl.4) — the identical `ui-card-content` shape found the platform default action for these keys unreliable across engines (Chromium moves it once trusted-focused, WebKit does not move it at all), so the panel wires the SAME explicit keydown handler `card-content.ts` ships (40px/arrow line, ~90%-viewport page step) rather than depend on it.

geometry:
  sizeClass: pattern
  tabBlockSize: var(--ui-tabs-tab-height)   # the interactive tab rows take the CONTROL height (--md-sys-height-lg, GH #297)
  stripGap: var(--ui-tabs-strip-gap)        # the inter-tab gap — --md-sys-space (density-responsive); GH #536 — carries the spacing the removed per-tab inline padding used to (xs + md)
  panelPadding: var(--ui-tabs-panel-pad)    # the panel body padding — --md-sys-space
  surface: --ui-container-bg                 # the shell plane (ADR-0015 surface seam); transparent by default (ADR-0104) — a plane is asked-for via `elevation`/`brightness`
  fillPanelScrollbarSeam: --ui-tabs-panel-scrollbar-width  # ADR-0144 Q1 cl.3 — consumer-INHERITED, var()-fallback ONLY (never declared in the :where() token block); a composing surface hides the filled panel's scrollbar by setting this on ITSELF (the ui-split-pane `--ui-split-pane-scrollbar-width` shape)
  overflowTrigger: var(--ui-tabs-tab-height)  # the overflow-menu trigger's square footprint (inline-size = block-size); zero new tokens

forcedColors: A `@media (forced-colors: active)` block keeps the SELECTED-tab indicator + label visible (Highlight) and the strip divider visible (CanvasText); the shell surface drops to Canvas via the container.css role layer.
---

# ui-tabs · ui-tab · ui-tab-panel

`ui-tabs` is the tabs compound — a container (`extends UIContainerElement`, the first non-form family) that
coordinates a set of **`ui-tab`** rows and their **`ui-tab-panel`** content regions. It is **not**
form-associated; it carries a bindable **`selected`** prop (which tab is active) and surface axes
(`elevation` / `brightness`, ADR-0015). All ARIA — `role="tablist"` on the strip, `role="tab"` /
`role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby` — is set through `ElementInternals`,
never as a host attribute.

Not a duplicate of `ui-nav-rail` (`@agent-ui/app`): vertical tabs (below) keep tab/tabpanel semantics —
content switching with owned panels — while a rail is navigation between destinations.

```html
<ui-tabs selected="overview">
  <ui-tab key="overview">Overview</ui-tab>
  <ui-tab key="pricing">Pricing</ui-tab>
  <ui-tab-panel>Overview content…</ui-tab-panel>
  <ui-tab-panel>Pricing content…</ui-tab-panel>
</ui-tabs>
```

## Anatomy

On connect, `ui-tabs` creates a `<div data-part="tablist" role="tablist">` strip and **reparents** its
`ui-tab` children into it (the `ui-tab-panel` children stay as siblings — a tablist must wrap only the tabs).
It then wires each **tab ↔ panel pair by DOM order**: tab *i* controls panel *i* (`aria-controls`), panel *i*
is labelled by tab *i* (`aria-labelledby`), both via the `ElementInternals` element-reflection
(`ariaControlsElements` / `ariaLabelledByElements`) — an IDREF-style ARIA relation with **no host
attribute**. A tab's accessible name is its own light-DOM children.

## Selection

`selected` names the active tab — a tab's **`key`** (its stable id) if it has one, otherwise its **DOM
index** as a string; `''` selects the first tab. A single scope-owned effect applies it: the active tab gets
`aria-selected="true"` + `:state(selected)` (the ink + underline indicator) + the roving `tabindex=0`; every
other tab gets `aria-selected="false"` + `tabindex="-1"`; and only the active **panel** is shown (the rest
carry the `hidden` attribute but stay in the DOM).

`selected` is **bindable** (ADR-0019): the renderer two-way-binds it via LLD-C8
(`value: { prop: 'selected', event: 'select' }`). The agent **sets** `selected` to switch tabs (a programmatic
write applies silently — no event is echoed, so the renderer's own write never loops); a **user gesture**
(click or keyboard) commits and emits the one `select` event carrying `{ value, index }`, so the agent learns
the active tab. The control itself knows nothing of A2UI — it is a plain reflected prop + a `select` event.

## Orientation

`<ui-tabs orientation="vertical">` renders the strip as a column beside the panel instead of a row above it —
a left-nav-plus-content shape. The shell becomes a flex row; the strip becomes a flex column pinned at its
natural (widest-tab) width; the divider and the selected-tab indicator both move to the strip's inline-end
edge (the edge facing the panel — the same pairing the horizontal bottom edge already keeps); tab labels
re-align **start** (a list reads left-aligned; center is a horizontal-strip convention). The `[data-part=tablist]`
strip also carries `aria-orientation="vertical"` (absent under the default horizontal — byte-identical
default DOM). `--ui-tabs-strip-gap` is unchanged — flex `gap` follows whichever axis is main, so the same
16px-at-density-1 token spaces rows instead of columns. `#536`'s zero-`padding-inline` law stands unchanged:
the row's full-width hit area comes from the column's default cross-axis stretch, never per-tab padding.
`orientation` is reflected and default `'horizontal'`, so every existing consumer stays byte-identical.

`[fill]` composes with vertical (§ below): the shell stays a flex row filling its bounded parent, the strip
becomes a pinned, internally-scrolling column, and the visible panel keeps its existing scroll leg unchanged.

## Overflow

`<ui-tabs overflow="menu">` collects the tabs that don't fit the strip's available space behind a square,
tab-height `dots-three` trigger that opens a composed [`ui-menu`](../menu/menu.md) of **proxy** rows — never a
reparented `ui-tab` (`role="tab"` must stay inside `role="tablist"`; a moved tab would also churn DOM identity
under roving/focus). The shell becomes a CSS grid so the trigger stays its own child, outside `role="tablist"`
(a non-tab tablist child is an ARIA required-owned-children violation), without absolute positioning.

The **visible set** is a pure function of the tabs' cached full-set sizes, the strip's observed available
space, and the selected identity — **never** of the currently-rendered subset, so hiding a tab can never feed
back into the fit observer (no oscillation). The **selected tab is always pinned visible** — it is never
overflowed. Because tab order in the DOM never changes (only a `display` swap), a tab promoted out of the menu
renders as the **last visible slot** exactly where the strip already has room. Fit is measured on the
inline axis under the horizontal default and the block axis under `orientation="vertical"` — an unbounded
vertical strip therefore never overflows by construction (its column simply grows); bounding it takes `[fill]`
or an author-bounded host.

Picking a proxy commits through the **exact same path** a tab click does — `selected` updates, focus moves,
and `ui-tabs` emits **one** `select` event with the promoted tab's own `{ value, index }` (never the proxy's
own list position). The inner `ui-menu`'s own event vocabulary (`select`/`toggle`/`close`) is **contained** at
the `[data-part=overflow]` boundary (`stopPropagation`) so `ui-tabs`' own event surface stays exactly
`{ select }` — an uncontained menu commit would otherwise ALSO surface a second, proxy-index-space `select` on
`ui-tabs`, and `toggle`/`close` would leak outside the documented contract.

**Known conservative residual (component-checker MINOR-1):** the fit budget subtracts a token-derived
`reserve` (the trigger's height + one gap) from the strip's OWN measured available size whenever not every
tab fits — but when the trigger is ALREADY visible, the CSS grid's `auto` trigger column has ALSO already
narrowed that same measured strip box (the grid, not JS, does that subtraction first). The two together are
a DOUBLE reserve in that state: safe (it can never show a tab that doesn't actually fit — no visual overflow
is possible) but occasionally one tab more conservative than the true fit allows. Deliberately unfixed: the
alternative (reading whether the trigger is CURRENTLY visible to decide whether to apply the JS reserve) is
exactly the render-dependent feedback input LLD §4's hysteresis ruling forbids (fit must read the CACHED
full-set + the observed size only, never today's own rendered subset) — the conservative slack is the
accepted cost of staying oscillation-immune.

`overflow` is reflected and default `'scroll'` (today's `overflow-x`/`overflow-y: auto`), so every existing
consumer stays byte-identical; both `orientation` and `overflow` are **connect-resolved** — a live flip of
either takes effect on the next reconnect, never mid-session (the same `ui-radio-group`/`ui-toolbar` shape
`orientation`'s roving axis already follows).

## Keyboard & roving focus

The strip uses a **roving tabindex**: exactly the selected tab is in the tab order (`tabindex=0`), the rest
are `-1`, so `Tab` enters/leaves the whole strip as one stop. Within it:

- **ArrowRight / ArrowLeft** (default `orientation="horizontal"`) — move selection **and** focus to the next /
  previous tab (wrapping), committing the selection (selection follows focus — APG automatic activation).
  Inert under `orientation="vertical"`.
- **ArrowDown / ArrowUp** (`orientation="vertical"` only) — the same move, on the vertical axis (APG's tabs
  vertical variant). Inert under the default horizontal.
- **Home / End** — move to the first / last tab, either axis.

The keyboard axis is **connect-resolved** from `orientation` (the `ui-radio-group` / `ui-toolbar` precedent):
a live attribute flip re-resolves only on the next reconnect, never mid-session.

Under `overflow="menu"`, the roving ring covers **exactly the visible tabs** — an overflowed tab is skipped
by Arrow/Home/End entirely. The overflow trigger is **its own Tab stop**, after the tablist strip in document
order (a deliberate deviation from a "final arrow stop" shape: the roving trait is scoped to the strip
container, so arrows never reach an element outside it — extending the ring to the trigger would need either
a half-broken "arrows in, no arrows out" listener or moving the listener up to the shell, which would then
intercept the panel's own arrow keys). Enter/Space opens its menu; Escape closes an open menu and returns
focus to the trigger (the overlay controller's light-dismiss focus-restore, `ui-menu`'s own behavior).

The roving listeners + the selection effect are installed in `connected()`, so they ride the connection
`AbortSignal` (zero residue on disconnect) and **re-arm on reconnect**.

## Filling a bounded parent (`fill`)

`<ui-tabs fill>` is ONE opt-in, reflected boolean — CSS-only (ADR-0144 Q1). It turns the shell into a flex
column that fills a height-bounded parent: the tablist strip stays pinned at its natural content height, and
the **visible** `ui-tab-panel` becomes the one flexible, internally-scrolling item
(`flex: 1 1 auto; min-block-size: 0; overflow-y: auto`). This is the shipped-once form of the
"pinned tablist | scrolling panel" composition `agent-admin.css` (TKT-0085) had to hand-roll for lack of a
fleet variant. Absent `fill`, `ui-tabs` stays byte-identical to today's document-flow layout.

- The panel's scrollbar visibility rides a **consumer-inherited** seam,
  `--ui-tabs-panel-scrollbar-width` (var()-fallback only — never declared in the token block, the same
  `--ui-split-pane-scrollbar-width` shape `split-pane.css` already ships): a composing app-chrome surface
  hides the filled panel's scrollbar by setting the property on *itself*; scrolling stays live regardless.
- **Keyboard-scroll disposition (measured, not assumed):** the identical "focused, tabindex=0,
  overflow-y:auto region" shape was already measured for `ui-card-content` (ADR-0046 Amendment 6) — the
  platform default action for Arrow/Page/Home/End is not reliable across engines (Chromium moves it once
  trusted-focused, WebKit does not move it at all). `ui-tab-panel` re-measured the same gap and wires the
  same explicit keydown handler, active only when an ancestor `ui-tabs` carries `fill` and the panel itself
  is the focused key target.

## Composing content inside a panel or pane (ADR-0144 Q3)

Neither a `ui-tab-panel` nor a [`ui-split-pane`](../split/split-pane.md) ever grows its own
header/body/footer region anatomy — a layout host owns bounds + scroll (`fill`'s scroll leg above; a pane's
`overflow: auto`), never content-region semantics. Three rules, fleet-wide:

1. **Layout hosts own bounds + scroll, never content regions.** `fill`'s panel scroll leg above, and
   `ui-split-pane`'s `overflow: auto` (its own descriptor), are the whole of it — no header/body/footer prop
   is ever added here.
2. **Content regions compose INSIDE the host.** Reach for [`ui-card`](../card/card.md) when the region needs
   chrome (frame, radius, its masked `scrollable` viewport); reach for the `[data-box]` region system
   (`container-box.css`, ADR-0046) — "Card's regions, generalized" — when the need is structural (sticky
   header/footer brackets, the region padding law, the scroll-fade mask) without a card's frame. Both are
   already-shipped, taught idioms; no new region-element family exists or is planned.
3. **Content rhythm belongs to the content wrapper, never the host.** Gap-between-sections is a
   `ui-row`/`ui-column` gap, a `[data-region=content]`'s built-in rhythm, or a Card content gap — composed
   *inside* the panel/pane, never a property this control grows.

**Related — `ui-split-pane`'s spacing policy (Q2):** a pane carries **zero** padding by law and adopts **no**
`--md-sys-space` ladder token; see [`split-pane.md`](../split/split-pane.md) for the ruled statement. `ui-tabs`'
own shell spacing (`--ui-tabs-strip-gap` / `--ui-tabs-panel-pad`) is a DIFFERENT ledger — it is the *chrome*
of the tabs widget itself (the strip gap, the panel's own body inset), not a pane's content-region padding —
so it is unaffected by, and does not contradict, Q2's ruling.

## Accessibility

- `role="tablist"` (the strip part) / `role="tab"` (each `ui-tab`) / `role="tabpanel"` (each `ui-tab-panel`)
  are set via `ElementInternals` — no host `role`/`aria-*` attribute.
- The active tab carries `aria-selected="true"` (via internals); `aria-controls` / `aria-labelledby` link each
  tab and panel via the internals element-reflection.
- A `forced-colors` block keeps the selected-tab indicator and label visible (`Highlight`) and the strip
  divider visible (`CanvasText`).
- Under `overflow="menu"`, the overflow part is `role="menu"` of `role="menuitem"` proxy rows ("switch to X"
  commands) — they never claim tab semantics, and the visible tabs stay `role="tab"` inside `role="tablist"`
  exactly as before.

## Motion

The selected-tab ink and the underline indicator transition over the shared `--md-sys-motion-duration-fast` timing, gated
behind `:state(ready)` (armed one frame past first paint, so the initial selection snaps) and zeroed under
`prefers-reduced-motion`. Geometry never animates.
