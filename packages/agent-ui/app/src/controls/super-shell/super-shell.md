---
# super-shell.md — the attributes-as-API descriptor for ui-super-shell (M5, GH #83;
# shell-archetypes-m5.spec.md — SPEC-R1 grammar · SPEC-R2 collapse · SPEC-R4 narrow · SPEC-R6
# resizable inner pane · SPEC-R7 pane segments + tabs narrow arm · SPEC-R8 band ladder · SPEC-R9
# toggle affordance law · SPEC-R10 scrollbar seam, LLD-C1/C2, ADR-0154/ADR-0155).

name: ui-super-shell

attributes:
  - name: collapsed-start
    type: boolean
    default: false
    reflect: true          # SPEC-R2d — observable + settable; a consumer persists it
  - name: collapsed-end
    type: boolean
    default: false
    reflect: true
  - name: narrow-start
    type: enum(collapse|stack|tabs)
    default: collapse      # SPEC-R7b widened the R4/F2 vocabulary with the tabs arm (ADR-0154)
    reflect: true
  - name: narrow-end
    type: enum(collapse|stack|tabs)
    default: collapse
    reflect: true
  - name: resizable-start
    type: boolean
    default: false          # SPEC-R6a — opt-in; applies only to the side's INNERMOST pane
    reflect: true
  - name: resizable-end
    type: boolean
    default: false
    reflect: true
  - name: size-start
    type: number
    default: null           # SPEC-R6d — the committed px size; null ⇒ --ui-super-shell-pane-size
    reflect: true
  - name: size-end
    type: number
    default: null
    reflect: true
  - name: collapse-band
    type: enum(narrow|compact)
    default: narrow         # SPEC-R8b (ADR-0155) — which line auto-collapses the collapse-mode sides
    reflect: true

properties:
  - name: collapsedStart
    description: The START side's paired collapse state (fork F1 — the rail+pane pair rides one state), LOGICAL not physical (LLD-C4, GH #95) — "start" means the DOM-first side (global-nav/nav-pane), whichever physical edge that renders on under the current `dir`. Flipped by the header's leading side-toggle at wide; at narrow the toggle drives the one-at-a-time overlay (`data-narrow-open`) instead, so a narrow visit never rewrites the persisted wide choice (SPEC-R4's no-clobber law).
  - name: collapsedEnd
    description: The END side's paired collapse state — the mirror (SPEC-R1a symmetry), LOGICAL (options-pane/global-options, DOM-second).
  - name: narrowStart
    description: What the START side does at narrow — `collapse` (default, overlay on toggle-restore) · `stack` (stays in flow) · `tabs` (SPEC-R7b — its panes join the shell-owned narrow-tabs strip instead; a segmented pane flattens to one tab per segment).
  - name: narrowEnd
    description: The mirror of `narrowStart` for the END side. Both sides may independently declare `tabs` — their panes join ONE shared strip, content always first.
  - name: resizableStart
    description: SPEC-R6a — opts the START side's INNERMOST pane (the one adjacent to content) into user resizing via a drag/keyboard separator. Rails and outer stacked panes stay token-fixed regardless.
  - name: resizableEnd
    description: The mirror of `resizableStart` for the END side.
  - name: sizeStart
    description: SPEC-R6d — the START pane's committed size in px, observable AND settable (a consumer persists/restores it the same way `collapsedStart` works). `null` until a first commit; the shell never persists it on its own (out of v1 scope per the LLD).
  - name: sizeEnd
    description: The mirror of `sizeStart` for the END side.
  - name: collapseBand
    description: SPEC-R8b (ADR-0155) — which band line auto-collapses this shell's COLLAPSE-mode sides — `narrow` (default, 40rem; every shipped shell byte-compatible) or `compact` (52.5rem, ADR-0150's compact-window line). `stack`/`tabs` sides are NOT governed by it — their reflow answers row-cramp, always the 40rem line. A depth-2 composition sets `compact` on the OUTER ring + leaves the inner shell default to get Kim's GH #44 outer-in cascade (app rails collapse first, canvas panes next).

events:
  - name: change
    description: SPEC-R6d — fires on a resize COMMIT (pointer release or a keyboard step), never on a live drag move. The fleet's existing vocabulary member, the ui-split precedent — no new event kind.

parts:
  - name: frame
    description: The one control-created wrapper (column flex — bars + middle).
  - name: bar
    description: Header/footer chrome rows (`data-bar="header|footer"`) — 3-module (54px) min-height, PERMANENT chrome (SPEC-R2c); rendered only when authored (the absence law). The header bar hosts the two side-toggles around the authored header children. Carries `role="banner"`/`role="contentinfo"` respectively (LLD-C1), overridable via `data-landmark` on the first authored child.
  - name: side-toggle
    description: One header-hosted collapse toggle (`data-side="start|end"`, SPEC-R2b/R9, LOGICAL per LLD-C4) — a ui-button that composes ONLY for a side with authored content (SPEC-R9a — no dead toggle on a one-sided shell), and hides below the 40rem line for `stack`/`tabs` sides (their narrow anatomy is owned elsewhere). Carries BOTH glyphs (`list` menu + `x` close, `data-glyph`); CSS swaps them off the host's `data-narrow-open` INSIDE the band query — or, for an AUTO-collapsed side in the band-line→natural-fit window (GH #229/SPEC-R14, Kim's ruling), off `data-auto-collapsed-* + data-narrow-open` together — so the X is state-correct by construction (SPEC-R9b — no stale wide X). An auto-collapsed side's toggle stays VISIBLE and opens that side as the floating overlay (never an inline re-expansion, which cannot fit). `aria-expanded` is truthful at every band (`!collapsed` at wide, `data-narrow-open===side` below the line or while auto-collapsed — SPEC-R9c/R14a). Labeled "Toggle start panes"/"Toggle end panes" — direction-agnostic text.
  - name: scrim
    description: SPEC-R9d — the shell-owned overlay scrim, composed once as the middle row's first child. Inert (display:none) at wide; shown at narrow/compact while a collapse side is overlay-open, and in the band-line→natural-fit window while an AUTO-collapsed side's overlay is open (GH #229/SPEC-R14) — always z-index below the overlay. A tap dismisses the overlay (alongside Escape and a toggle re-tap); focus returns to the opener toggle on close (non-modal — no focus trap).
  - name: middle
    description: The `[ rail | pane* | canvas | pane* | rail ]` flex row (SPEC-R5, LLD-C3 — a side stacks ZERO OR MORE panes, not a single fixed pane); the narrow overlay's containing block.
  - name: rail
    description: A 3-module (54px) global bar (`data-slot-name="global-nav|global-options"`, `data-side`) — the OUTER level's ring; an inner nested shell simply authors no rails (SPEC-R1b ring-dropping recursion). Carries `role="navigation"` (global-nav) or `role="complementary"` (global-options) — LLD-C1.
  - name: pane
    description: A 14-module (252px) side pane (`data-slot-name="nav-pane|section-nav|options-pane|options-section"`, `data-side`), its own scroll container. A side may stack MULTIPLE panes (SPEC-R5/GH #96) — DOM order is rail first, then panes outer-to-content (`nav-pane` before `section-nav`; `options-section` before `options-pane`, its mirror). Collapse is still WHOLE-SIDE: every part sharing a `data-side` value hides/restores together, never per-pane. Carries `role="navigation"` (nav-pane/section-nav) or `role="complementary"` (options-pane/options-section) — LLD-C1. The INNERMOST pane on an opted-in side additionally carries a `pane-resizer` sibling (SPEC-R6) and, when its authored children carry `data-segment`, `data-segmented` + a `pane-tabs` strip of its own (SPEC-R7a).
  - name: canvas
    description: The mandatory content region — `flex:1 1 auto; min-inline-size:0` (console.warn when unauthored). Hosts anything, including another ui-super-shell (depth 2 is the normative test ceiling, fork F3). Carries `role="main"` (LLD-C1) — an author must ensure only one `main` per document, the same cross-instance responsibility ui-app-shell's own `main` region carries.
  - name: pane-resizer
    description: SPEC-R6b — the drag/keyboard separator between `content` and an opted-in side's innermost pane (`data-side`, `role="separator"`, `aria-orientation="vertical"`, `aria-controls` referencing the pane's id). Reuses `@agent-ui/components`' `paneResize` trait (ADR-0154 LLD-C6) for the drag gesture; arrow keys step one module, Home/End jump to the SPEC-R6c bounds. Carries the side's OWN `data-side`, so the existing whole-side collapse/narrow selectors already hide/restore it with the rest of its side — zero part-specific CSS for that half of the contract.
  - name: pane-tabs
    description: SPEC-R7a — a segmented pane's OWN top-of-pane tab strip. Since GH #221 it IS the fleet `ui-tabs` control (one `ui-tab` per `data-segment` child, `data-part="pane-tab"`), composed PANEL-LESS — the segments stay the shell's `data-active` participants, switched in place (never a reparent — SPEC-R7c's survival law). role=tablist rides the control's own tablist part; role=tab + aria-selected + aria-controls (→ the segment, element-reflection) ride each ui-tab's internals; the tablist part scrolls when labels overflow the pane width. Wired via the control's `select` commit event; programmatic sync SETS its `selected` (no echo, ADR-0019).
  - name: narrow-tabs
    description: SPEC-R7b — the shell-owned, top-level narrow strip composed once when at least one side declares `narrow-*="tabs"`. Since GH #221 it IS the fleet `ui-tabs` control (each `ui-tab` carries `data-part="narrow-tab"` + its narrow-tab value as `key`), panel-less like pane-tabs. Content is always the first tab; each `tabs`-side's panes follow in DOM order, a segmented pane flattening to one tab per segment. Hidden outside the narrow container query; a no-op part when no side opts in.

customStates: []

face:
  formAssociated: false

aria:
  role: none               # the HOST carries no role of its own — LLD-C1's landmarks live on the control-created PARTS (bar/rail/pane/canvas above), not the host element
  roleSource: none

keyboard:
  - key: ArrowLeft / ArrowRight
    description: On a focused `pane-resizer`, steps the pane's size by one module (`--ui-super-shell-module`) — RTL-aware (SPEC-R6b, the ui-split precedent); the toggles remain native ui-button activation, and panes scroll natively.
  - key: Home / End
    description: On a focused `pane-resizer`, jumps straight to the SPEC-R6c bound (pane minimum / the canvas-derived maximum).

geometry:
  sizeClass: layout
  blockSize: consumer-supplied
  paddingBlock: 0

forcedColors: Bars/rails/panes are token-surfaced boxes; the toggles are real ui-buttons with their own forced-colors handling. The narrow overlay's shadow degrades to the pane's own box.
---

# ui-super-shell

The shell-archetype family's grammar ceiling (M5): `[ header? | (rail?+pane*) | content | (pane*+rail?) | footer? ]`,
every slot optional-and-absent-when-unfilled, recursively nestable through `content` with the rail
ring dropped per level. A side stacks zero or more panes (SPEC-R5/GH #96 — was a single pane max) and
the two sides need not match in pane count. Consumers mark light-DOM children
`data-slot="header|global-nav|nav-pane|section-nav|content|options-section|options-pane|global-options|footer"`.
Everything sits on the 18px module (`--ui-super-shell-module`): bars/rails 3 modules, panes 14.
Collapse is per-side (LOGICAL start/end, LLD-C4/GH #95 — DOM order + ordinary CSS bidi place the
correct physical side under `dir="rtl"`, no `:dir()` selector or runtime direction read anywhere)
and header-hosted; narrow auto-collapses via the container query alone and re-opens sides as
overlays. Every part carries a real ARIA landmark by default (header→banner, footer→contentinfo,
content→main, nav slots→navigation, options slots→complementary), overridable per slot via
`data-landmark="…"` on the first authored child (LLD-C1). Normative frames: Figma 34-1486 / 34-1506
(GH #44).

## SPEC-R6 — the resizable inner pane (ADR-0154)

Opt in per side (`resizable-start`/`resizable-end`) and only the side's INNERMOST pane — the one
adjacent to `content` — gains a drag/keyboard separator. The committed size is the reflected
`size-start`/`size-end` px prop; `change` fires on commit (release or a key step), never on a live
drag move. Bounds: the pane never shrinks below `--ui-super-shell-pane-min-size`, and never grows
past what `--ui-super-shell-canvas-min-size` leaves available (both default 9 modules = 162px,
override per consumer). A collapsed side's committed size SURVIVES the round-trip.

## SPEC-R7 — pane segments + the `tabs` narrow arm (ADR-0154)

Authored children of a pane slot sharing the SAME `data-slot` value may each carry
`data-segment="<Label>"` — the pane renders its own tab strip and shows exactly one segment at a
time (visibility-only, never a reparent). Widen `narrow-start`/`narrow-end` to `'tabs'` and that
side's panes join a SHELL-OWNED top-level strip instead of collapsing: content is always first,
then each pane in DOM order, a segmented pane flattening to one tab per segment. Every state
change here — resize, tab switch, segment switch, a band crossing — is visibility-only (SPEC-R7c):
a live embedded surface in `content` or a pane survives every one of them un-cycled.

## SPEC-R8/R9/R10 — the responsive band ladder, toggle affordance law, scrollbar seam (ADR-0155)

The band vocabulary is `wide · compact · narrow`, cut by two container lines: the narrow line (40rem)
and a new compact line (52.5rem, `collapse-band="compact"` shells only — ADR-0150's number, swept in
`shell-breakpoint.ts`). A collapse-mode side hides below THIS shell's `collapse-band` line and
toggle-restores as an overlay; `stack`/`tabs` sides keep the 40rem line regardless (SPEC-R8b). The
toggle law (SPEC-R9): a toggle composes only for an authored side, hides below 40rem for `stack`/`tabs`
sides, carries both `list`/`x` glyphs CSS-swapped inside the band query, keeps `aria-expanded` truthful
per band via ONE visibility-only `ResizeObserver`, and dismisses via scrim tap / Escape / re-tap with
focus returned to the toggle (non-modal). Note: the focus round-trip belongs to the USER dismissal
paths only (scrim tap / Escape / toggle re-tap). A PASSIVE release — the fit recompute clearing an
open overlay on a band-exit or grow-past-fit resize (GH #229 review MINOR-1) — closes WITHOUT moving
focus: the released side is visible inline at the new width and never passes display:none, so focus
inside it simply survives; moving it to the toggle there would be a focus steal on a mere resize. The mid-window overlay (GH #229/SPEC-R14, Kim's ruling): between a side's band line
and the configuration's natural-fit width, a side hidden by the SPEC-R13b measurement-based
auto-collapse keeps a visible toggle that opens it as the SAME floating overlay (scrim, X, Escape/scrim
dismissal, focus round-trip) — never an inline re-expansion, which cannot fit; once a recompute clears
the auto-collapse (the host grew past fit), an open overlay releases and the side returns inline. The
scrollbar seam (SPEC-R10): `--ui-super-shell-scrollbar-width`
(default `none`, consumer-overridable) hides the native bar on pane boxes, active segments, and the
narrow-tabs strip, with the exported `scrollFade` trait as the replacement edge affordance.
