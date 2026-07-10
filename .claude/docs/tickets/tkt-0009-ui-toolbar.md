---
doc-type: ticket
id: tkt-0009
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0009 — `ui-toolbar`: one toolbar, two postures (floating · shell-header)

## Summary
Kim's ask (2026-07-10): a `ui-toolbar` component that works as a **floating toolbar** OR
embedded in a **shell header** — one element, two postures. Learn from two prior arts:
`https://ui-kit.exe.xyz/site/components/toolbar` (the published docs page) and
`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/toolbar/` (exists,
verified — a TWO-tag family: toolbar + toolbar-group, with a2ui json + examples). Dedup:
**greenfield** — no toolbar element anywhere in the fleet; the closest things are prose
examples in row/list descriptors and, tellingly, the a2ui corpus's `document-row-toolbar`
seed (`catalog-coverage.ts:184-235`), which hand-composes Card+Row+Icon+Text precisely
because no toolbar primitive exists — recorded evidence of the gap AND a catalog-posture
argument (agents already want to emit toolbar-shaped UI).

## Research inputs (for the design intake, recorded verbatim)
- The exe.xyz toolbar docs page (fetch at intake — verify capabilities/props there, not from
  memory; the repo-absence-vs-spec-absence rule).
- The adia toolbar family: study `toolbar.class.js` + `toolbar-group.yaml` for the grouping
  contract and `toolbar.css` for the CSS posture; promote to THIS fleet's laws (light-DOM,
  internals-ARIA, typed props, geometry law), never port.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **The dual-posture mechanism** — floating vs shell-embedded: one element with a posture
    axis (surface/elevation/z-scope differ — ADR-0052's isolation law; a floating toolbar may
    ride the overlay machinery ADR-0043 owns, or be position-static chrome the page places)
    vs posture-by-composition (the shell header is `ui-app-shell-region` territory — the
    embedded posture must compose there cleanly, ADR-0082..0084).
  - **The family shape** — is `toolbar-group` (the prior art's second tag) a sub-element, a
    slot/role, or `ui-row` reuse? (The anatomy law's position-slots × roles dialect first.)
  - **ARIA toolbar pattern** — `role=toolbar` + arrow-key roving focus; the fleet's
    `roving-focus` trait already exists (`traits/roving-focus.ts`) — reuse, don't reinvent.
  - **Overflow behavior** — what happens when actions don't fit (wrap · scroll · overflow
    menu); fence what v1 doesn't do with triggers.
  - Orientation/density/size axes in the typed-enum dialect; events ⊂ the allowlist;
    catalog posture under the ADR-0087 gate (the corpus seed argues emittable).
- The shipped component meets the full per-control bar (descriptor(s), jsdom + cross-engine
  browser probes incl. whole-shape + real focus-order proof, independent review,
  barrels/exports/size, doc + demo pages — the demo showing BOTH postures).

## Links
- The two research inputs above.
- `.claude/skills/agent-ui-component-design/` — the intake procedure (TKT-0008's swiper may
  run first as the estate's shakedown; whichever runs first proves it).
- `packages/agent-ui/components/src/traits/roving-focus.ts` — the existing focus mechanism.
- ADR-0043/0052 (overlay/z-scope, the floating posture's law) · ADR-0082..0084 (the shell
  header seam) · ADR-0087 (catalog posture) · the `document-row-toolbar` corpus seed (the
  gap's evidence).

## Scope / Open
- **Open:** whether floating-posture positioning (anchor/edge placement) is the toolbar's own
  or the page's job (the fleet leans "width/placement is the layout's job" — the text-field
  min-inline-size precedent); autohide/collapse behaviors (not asked — propose non-goal);
  the label/tooltip relationship for icon-only actions (ADR-0057 non-color/non-icon-alone
  signifier pressure).
- **Non-goal:** porting either prior art's full API; command/state management (actions are
  the consumer's buttons — the toolbar is arrangement + focus semantics, not a command bus).
- **Sequencing:** design intake first; no build from this ticket directly.

## Findings
