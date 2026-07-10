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

**Design intake complete (2026-07-10, `agent-ui-component-design` first live-fire run).** Record set:
[ADR-0121](../adr/0121-ui-toolbar-pattern-control.md) (proposed, forks F1–F7 recommended, never
self-ratified) · [SPEC](../spec/toolbar.spec.md) (SPEC-R1…R12) · [LLD](../lld/toolbar.lld.md) (LLD-C1…C13) ·
[decomp](../decompositions/toolbar-ship.decomp.json) (coverage-clean, `--strict` exit 0). ADR gate green
(`site/lib/adr.test.ts` 33/33).

**Fork resolutions (all firm):** F1 dual-posture = the existing `elevation`/`brightness` surface axis +
`[data-box]` z-scope, NOT a posture enum, NOT the overlay/dismissal machinery, NOT a positioning machine
(placement is the layout's job) · F2 host-as-flex, light-DOM children ARE the items (the `ui-row` precedent);
`ui-toolbar-group` is a fenced additive v2 · F3 REUSE `roving-focus` decoupled from selection (`loop:false`,
`typeAhead:false`, focus-only, no `select` event; name via `label`→`internals.ariaLabel`) · F4 CSS-only
`overflow: wrap`(default)/`scroll`; the overflow-menu is a fenced additive v2 · F5 `tier: pattern`
(geometry.md already names toolbar this — no novelty leg), no `size`/`density`/`posture` prop · F6 no events
· F7 catalog EMITTABLE (a `Toolbar` row + the `document-row-toolbar` corpus seed upgraded).

**exe.xyz research input FAILED** — `https://ui-kit.exe.xyz/site/components/toolbar` returned only a
client-side "Loading changelog…" SPA shell (both the bare and trailing-slash forms); zero component content.
The design draws nothing from it; grounded entirely in the adia prior art (read in full) + fleet law.

**Independent doc-review PASSED (fix-then-ship), fixes applied.** Three fresh-context `scribe:doc-reviewer`
passes (ADR/SPEC/LLD). The LLD review caught two real BLOCKERS in the frozen §3 interface — `this.use()`
doesn't exist (traits are bare `rovingFocus(this, {…})` calls; the CLAUDE.md "host.use()" phrasing is stale)
and the roving `orientation` accessor was a type error (the trait reads it once as a value; fixed to the
`radio-group.ts:120-144` connect-resolve-once precedent). Both fixed, plus the MAJOR (added a `## Examples`
section), a vacuous non-color-signifier MUST demoted, stale `catalog-coverage.ts:184-235` line-ranges made
symbolic, an `ADR-0112 cl.6` relates-edge + F7 post-0112 seed-structure clause added, and the SPEC-R1 trace
hole closed. **Remaining routed item (NOT a per-doc fix):** the fleet's ADR/SPEC/LLD use a blockquote status
line, not YAML frontmatter, so `doc_lint.py` returns "not a functional document" on all of them (identical to
the `theme-provider` precedent) — a corpus-wide convention question for the doc-standard owner, deliberately
not patched on this file alone.

**Build gate:** the design is frozen; no build dispatches from this ticket (sequencing: intake first). The
build wave, when authorized, dispatches `component-builder` on LLD-C1…C9, then `a2ui-builder` on LLD-C10/C11
(the `Toolbar` catalog row + corpus upgrade) once the component is green.
