---
# workspace-shell.md frontmatter — the attributes-as-API descriptor for ui-workspace-shell (ADR-0004;
# shell-archetypes-m5.lld.md LLD-C5). No attributes of its own — see workspace-shell.ts's own header
# comment for why (a thin `ui-super-shell` preset, zero new API surface beyond the composed element's).
tag: ui-workspace-shell
tier: layout            # geometry size-class (Container/layout band — a composition over the shipped layout family, no control height of its own; the ui-master-detail precedent)
extends: UIElement      # a plain structural base — composes ui-super-shell rather than extending it (LLD-C5)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), same slice as ui-master-detail/ui-app-shell

attributes: []           # no API surface of its own — every attribute a consumer sets belongs to the composed ui-super-shell (data-slot children + the inner element's own collapsed-*/narrow-* props, unaffected by this wrapper)

properties: []

events: []                # behavior-only composition — no event vocabulary of its own (ADR-0151 rule 2)

slots: []                 # docking is data-slot children on the SAME vocabulary ui-super-shell itself defines — no named slots of this element's own

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md precedent)
  - name: (none)
    description: This element creates exactly one part — the composed `<ui-super-shell>` child itself — and adds no parts of its own; every part a consumer sees (bar/rail/pane/canvas/side-toggle) is the inner shell's own (super-shell.md).

customStates: []          # no :state() hooks of its own

face:
  formAssociated: false    # NOT a FACE form control — a layout composition contributes nothing to a form

aria:
  role: none               # this element carries no ARIA of its own — every landmark lives on the composed ui-super-shell's own parts (LLD-C1), inherited unchanged
  roleSource: none

keyboard: []                # no keyboard interaction of this element's own — the composed ui-super-shell's side-toggles carry their OWN keyboard contract (real ui-buttons), inherited unchanged

geometry:
  sizeClass: layout          # Container/layout — NO control height
  blockSize: auto             # fills its flex parent (flex:1 1 auto on the host is the CONSUMER's job, the ui-master-detail precedent — a bare instance is content-driven)
  paddingBlock: 0             # no padding of its own — the composed ui-super-shell owns any inset

forcedColors: Composes wholesale over ui-super-shell's own forced-colors handling (super-shell.md) — this element paints nothing of its own.
---

# ui-workspace-shell

`ui-workspace-shell` is a **thin `ui-super-shell` preset** (`@agent-ui/app`, LLD-C5) for the full outer-level
grammar shape Kim's `app-shell-layout-single-nav` / `app-shell-layout-dual-sidebar` Figma frames specify:
header, global-nav rail, nav-pane, section-nav, content, options-section, options-pane, global-options rail,
footer. It composes rather than reimplements: **0 bespoke layout code** (the `ui-master-detail`/`ui-split`
precedent) — every geometry, collapse, and landmark behavior is `ui-super-shell`'s own, inherited wholesale.
The one thing this element adds is a sensible default: `narrow-start="collapse"` + `collapse-band="compact"`
(ADR-0155 F3), so the nav side hides below the 52.5rem compact-window line and toggle-restores as an
overlay (X in the header, scrim/Escape dismiss) — flipping WITH the docs site, whose own narrow story
moved from `stack` to overlay in the same wave (`site/pages/_page.ts`).

**`app-shell-layout-single-nav` (Figma node 39:1629)** — one rail, one nav pane, no options side:

```html
<ui-workspace-shell>
  <div data-slot="header">…</div>
  <ui-nav-rail data-slot="global-nav">…</ui-nav-rail>
  <nav data-slot="nav-pane">…</nav>
  <main data-slot="content">…</main>
</ui-workspace-shell>
```

**`app-shell-layout-dual-sidebar` (Figma node 39:1596)** — the SPEC-R5 asymmetric shape: the start side
stacks a rail plus TWO panes (`nav-pane` + `section-nav`), the end side stacks one pane plus a rail:

```html
<ui-workspace-shell>
  <div data-slot="header">…</div>
  <ui-nav-rail data-slot="global-nav">…</ui-nav-rail>
  <nav data-slot="nav-pane">…</nav>
  <nav data-slot="section-nav">…</nav>          <!-- the extra stacked register, SPEC-R5/GH #96 -->
  <main data-slot="content">…</main>
  <aside data-slot="options-pane">…</aside>
  <aside data-slot="global-options">…</aside>
  <div data-slot="footer">…</div>
</ui-workspace-shell>
```

Consumers use the **exact same `data-slot` vocabulary** `ui-super-shell` itself defines (SPEC-R1/R5) — this
element adds no new slot names, only the reduced ceremony of not hand-composing the inner shell. Unfilled
slots are absent, exactly as `ui-super-shell` itself specifies (the absence law) — the two examples above
differ ONLY in which slots are authored, not in any workspace-shell-specific configuration.
