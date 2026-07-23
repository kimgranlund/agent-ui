---
# tabs.md frontmatter — the attributes-as-API descriptor for the tabs compound (ADR-0004). The
# machine-checkable PRIMARY-element surface lives HERE (frontmatter for ui-tabs); the prose below the fence is
# the /site doc and documents all THREE elements (ui-tabs · ui-tab · ui-tab-panel — one folder, one writer). The
# `attributes[]` block MUST mirror tabs.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness — plus the bindable `selected`, plus the opt-in `fill`) — the contract↔props trip-wire
# (tabs-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; the surface
# axes per ADR-0015; the two-way `selected` bind per ADR-0019 (renderer LLD-C8); `fill` per ADR-0144 Q1.
tag: ui-tabs
description: A tab strip and panel container that switches visible content via keyboard-navigable, roving-focus tabs.
tier: pattern          # geometry size-class — geometry.md "Pattern" (container + control-height rows); tabs is the named example: the interactive tab rows take the CONTROL height, the shell uses the --md-sys-space ladder
extends: UIContainerElement  # the FIRST non-form family — surface axes + reused internals (ARIA); NOT form-associated (face below). NOTE: UIContainerElement enters the descriptor BASE_CLASSES at decomp s12 (integration) — until then validateComponentDescriptor flags BAD_EXTENDS, filtered in tabs-descriptor.test.ts
# marginal: ui-tabs adds 727 B gz (2617 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — the tabs compound: ui-tabs + ui-tab + ui-tab-panel) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

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

keyboard:
  - keys: ArrowRight
    action: Move selection + roving focus to the next tab (wraps from last to first); commits (emits `select`).
  - keys: ArrowLeft
    action: Move selection + roving focus to the previous tab (wraps from first to last); commits.
  - keys: Home
    action: Move selection + roving focus to the first tab; commits.
  - keys: End
    action: Move selection + roving focus to the last tab; commits.
  - note: ROVING TABINDEX — exactly the selected tab is tabindex=0; the rest are tabindex=-1 (a single tab-order entry). Selection follows focus (APG automatic activation). Re-armed on reconnect (connected() re-installs the listeners + the selection effect).
  - keys: ArrowDown / ArrowUp / PageDown / PageUp / Home / End
    action: In `[fill]` mode ONLY, scroll the visible panel when it itself is the focused key target (never a focused descendant's own key). MEASURED at build (ADR-0144 Q1 cl.4) — the identical `ui-card-content` shape found the platform default action for these keys unreliable across engines (Chromium moves it once trusted-focused, WebKit does not move it at all), so the panel wires the SAME explicit keydown handler `card-content.ts` ships (40px/arrow line, ~90%-viewport page step) rather than depend on it.

geometry:
  sizeClass: pattern
  tabBlockSize: var(--ui-tabs-tab-height)   # the interactive tab rows take the CONTROL height (--md-sys-height-md)
  tabPaddingInline: var(--ui-tabs-tab-pad-inline)  # off the --md-sys-space layout ladder
  stripGap: var(--ui-tabs-strip-gap)        # the inter-tab gap — --md-sys-space (density-responsive)
  panelPadding: var(--ui-tabs-panel-pad)    # the panel body padding — --md-sys-space
  surface: --ui-container-bg                 # the shell plane (ADR-0015 surface seam); transparent by default (ADR-0104) — a plane is asked-for via `elevation`/`brightness`
  fillPanelScrollbarSeam: --ui-tabs-panel-scrollbar-width  # ADR-0144 Q1 cl.3 — consumer-INHERITED, var()-fallback ONLY (never declared in the :where() token block); a composing surface hides the filled panel's scrollbar by setting this on ITSELF (the ui-split-pane `--ui-split-pane-scrollbar-width` shape)

forcedColors: A `@media (forced-colors: active)` block keeps the SELECTED-tab indicator + label visible (Highlight) and the strip divider visible (CanvasText); the shell surface drops to Canvas via the container.css role layer.
---

# ui-tabs · ui-tab · ui-tab-panel

`ui-tabs` is the tabs compound — a container (`extends UIContainerElement`, the first non-form family) that
coordinates a set of **`ui-tab`** rows and their **`ui-tab-panel`** content regions. It is **not**
form-associated; it carries a bindable **`selected`** prop (which tab is active) and surface axes
(`elevation` / `brightness`, ADR-0015). All ARIA — `role="tablist"` on the strip, `role="tab"` /
`role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby` — is set through `ElementInternals`,
never as a host attribute.

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

## Keyboard & roving focus

The strip uses a **roving tabindex**: exactly the selected tab is in the tab order (`tabindex=0`), the rest
are `-1`, so `Tab` enters/leaves the whole strip as one stop. Within it:

- **ArrowRight / ArrowLeft** — move selection **and** focus to the next / previous tab (wrapping), committing
  the selection (selection follows focus — APG automatic activation).
- **Home / End** — move to the first / last tab.

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

## Motion

The selected-tab ink and the underline indicator transition over the shared `--md-sys-motion-duration-fast` timing, gated
behind `:state(ready)` (armed one frame past first paint, so the initial selection snaps) and zeroed under
`prefers-reduced-motion`. Geometry never animates.
