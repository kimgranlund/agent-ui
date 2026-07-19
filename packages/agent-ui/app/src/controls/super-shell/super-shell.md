---
# super-shell.md — the attributes-as-API descriptor for ui-super-shell (M5, GH #83;
# shell-archetypes-m5.spec.md — SPEC-R1 grammar · SPEC-R2 collapse · SPEC-R4 narrow).

name: ui-super-shell

attributes:
  - name: collapsed-left
    type: boolean
    default: false
    reflect: true          # SPEC-R2d — observable + settable; a consumer persists it
  - name: collapsed-right
    type: boolean
    default: false
    reflect: true

properties:
  - name: collapsedLeft
    description: The LEFT side's paired collapse state (fork F1 — the rail+pane pair rides one state). Flipped by the header's leading side-toggle at wide; at narrow the toggle drives the one-at-a-time overlay (`data-narrow-open`) instead, so a narrow visit never rewrites the persisted wide choice (SPEC-R4's no-clobber law).
  - name: collapsedRight
    description: The RIGHT side's paired collapse state — the mirror (SPEC-R1a symmetry).

events: []                 # behavior-only composition — no event vocabulary of its own (ADR-0151 rule 2)

parts:
  - name: frame
    description: The one control-created wrapper (column flex — bars + middle).
  - name: bar
    description: Header/footer chrome rows (`data-bar="header|footer"`) — 3-module (54px) min-height, PERMANENT chrome (SPEC-R2c); rendered only when authored (the absence law). The header bar hosts the two side-toggles around the authored header children.
  - name: side-toggle
    description: One header-hosted collapse toggle (`data-side="left|right"`, SPEC-R2b) — a ui-button whose aria-expanded mirrors the side's state.
  - name: middle
    description: The `[ rail | pane | canvas | pane | rail ]` flex row; the narrow overlay's containing block.
  - name: rail
    description: A 3-module (54px) global bar (`data-slot-name="global-nav|global-options"`, `data-side`) — the OUTER level's ring; an inner nested shell simply authors no rails (SPEC-R1b ring-dropping recursion).
  - name: pane
    description: A 14-module (252px) side pane (`data-slot-name="nav-pane|options-pane"`, `data-side`), its own scroll container.
  - name: canvas
    description: The mandatory content region — `flex:1 1 auto; min-inline-size:0` (console.warn when unauthored). Hosts anything, including another ui-super-shell (depth 2 is the normative test ceiling, fork F3).

customStates: []

face:
  formAssociated: false

aria:
  role: none               # the authored content carries its own landmarks (region-role decoupling stays the consumer's ADR-0083 concern)
  roleSource: none

keyboard: []               # the toggles are real ui-buttons (native activation); panes scroll natively

geometry:
  sizeClass: layout
  blockSize: consumer-supplied
  paddingBlock: 0

forcedColors: Bars/rails/panes are token-surfaced boxes; the toggles are real ui-buttons with their own forced-colors handling. The narrow overlay's shadow degrades to the pane's own box.
---

# ui-super-shell

The shell-archetype family's grammar ceiling (M5): `[ header? | (rail?+pane?) | content | (pane?+rail?) | footer? ]`,
every slot optional-and-absent-when-unfilled, recursively nestable through `content` with the rail
ring dropped per level. Consumers mark light-DOM children `data-slot="header|global-nav|nav-pane|content|options-pane|global-options|footer"`.
Everything sits on the 18px module (`--ui-super-shell-module`): bars/rails 3 modules, panes 14.
Collapse is per-side and header-hosted; narrow auto-collapses via the container query alone and
re-opens sides as overlays. Normative frames: Figma 34-1486 / 34-1506 (GH #44).
