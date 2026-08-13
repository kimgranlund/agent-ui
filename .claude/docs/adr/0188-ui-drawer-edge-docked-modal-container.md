# ADR-0188 — `ui-drawer` (GH #845, component arm): a NEW edge-docked MODAL container is minted on the native `<dialog>`/`showModal()` machinery (the ADR-0017 pattern re-applied, not a nested `ui-modal`, not a `dock` widening of it), completing the overlay/docking vocabulary as a four-cell map — centered modal · edge-docked modal · anchored non-modal · shell-docked non-overlay

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-13
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-13 |
> | **Proposed by** | planner seat (GH [#845](https://github.com/kimgranlund/agent-ui/issues/845)'s design leg — the owner's 2026-08-13 intake-round ruling routed the Edit-Agents drawer vehicle to a new fleet control, starting at the `agent-ui-component-design` intake; the fork sheet is [`../spec/drawer.intake.md`](../spec/drawer.intake.md)) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-13, via the [`ratify ADR-0188` utterance](https://github.com/kimgranlund/agent-ui/issues/845#issuecomment-5287478165) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (not authored here): `controls/drawer/drawer.{ts,css,md}` + barrel export + jsdom/browser tests · site doc/demo/gallery surfaces + the standing descriptor/site gates · the `Drawer` catalog row + factory (ADR-0087's catalog arm) · an `agent-ui-component-patterns` table row for the four-cell overlay/docking map (cl.2) — per the intake's S1–S4 |
> | **Supersedes / Superseded by** | **Relates** ADR-0017/0019/0020/0101 (the modal machinery + announce law this re-applies) · ADR-0043/0045 (the non-modal branch this is NOT) · ADR-0102 (the three-lane chooser applied) · ADR-0125 (the re-derive-private-machinery precedent) · ADR-0087/0112 (catalog posture) · **Resolves** GH [#845](https://github.com/kimgranlund/agent-ui/issues/845)'s drawer-vehicle design fork (component arm only; the page-side lane composes the result — build BLOCKED on ratification) |

## Context

GH #845's Edit-Agents surface (roster management: delete/rename/reorder/duplicate) needs a modal
panel too tall and too list-shaped for a centered dialog. The owner ruled the vehicle a NEW fleet
`ui-drawer` control (intake round, 2026-08-13). The intake
([`drawer.intake.md`](../spec/drawer.intake.md)) ran the mint-vs-compose test explicitly rather than
deferring to the ruling:

- The **aggregate-value bar** (ADR-0175's reference) does not apply — a drawer carries no value.
- **Composing shipped controls fails both branches.** The popover family is the deliberately
  NON-modal branch (`overlay.ts:9` states the boundary in its own banner); `ui-modal` composed
  page-side would need raw CSS overriding its centered identity (margin/max-width/radius/shrink-fit
  height → docked, full-height, slid) from outside its token seam — and ADR-0102's CSS-less-consumer
  law makes that inexpressible for a catalog consumer at all.
- **Widening `ui-modal` with a `dock`/`edge` prop fails the divergent-axes count** (the
  timeline/status-stream one-family-vs-two rule): one enum would flip the geometry mode, the motion
  family, the sizing law, and the future gesture family at once — that is two controls.
- **The mint is cheap** (the reference's own check): the interior is the ADR-0017 `<dialog>`
  machinery re-applied — `ui-modal`'s `#ensureDialog`/`#openDialog`/`#restoreFocus` are `#`-private,
  so the mechanics are re-derived the way `ui-command-modal` re-derived combo-box's filter
  (ADR-0125), not shared or nested.

What makes this contract-changing rather than routine: a new tag enters the fleet's closed control
set, a new `--ui-drawer-*` token family and catalog row are minted, and the shell/overlay vocabulary
gains a boundary that future intakes will route by.

## Decision

1. **Mint `ui-drawer` / `UIDrawerElement` (`controls/drawer/`), a `container`-tier
   `UIContainerElement`** — a region-less host (`display: contents`, the `ui-modal` precedent — NO
   `ui-drawer-header`/`-footer` sub-controls; `[data-box]` region conventions already supply sticky
   header/footer + scroll body) owning ONE `<dialog data-part="dialog" data-box>` part: created once,
   author children moved in at connect (ADR-0017 child-move), `render()` stays the inherited void,
   `showModal()` supplying top layer + scrim + focus containment + Escape, focus restored to the
   opener on every close (cl.4 pattern), author `aria-label`/`aria-labelledby` forwarded onto the
   part (cl.5), `scrollFade` unconditionally wired over the dialog viewport. NOT form-associated (a
   `<dialog>` submits nothing — the ADR-0014 reading, as `ui-modal` argued it).
2. **The overlay/docking vocabulary is a four-cell map, and `ui-drawer` is exactly one cell:**
   `ui-modal` = centered modal `<dialog>` · `ui-drawer` = EDGE-DOCKED modal `<dialog>` ·
   the popover/menu/select/tooltip family = anchored NON-modal top-layer (overlay trait, ADR-0043) ·
   super-shell side/pane = docked NON-overlay layout. `ui-drawer` is ALWAYS top-layer + scrim +
   focus-contained; a persistent, non-scrimmed side panel is NEVER a drawer — it routes to the shell
   family. This boundary lands as a patterns-table row (Repairs).
3. **Props:** `...UIContainerElement.surfaceProps` + `open` (boolean, reflected, two-way) +
   `persistent` (boolean, reflected — ADR-0020's shape verbatim: `cancel` preventDefault + rect-wise
   backdrop-click ignore) + `edge: 'end' | 'start' | 'bottom'` (reflected enum, default `'end'`) —
   logical inline names per super-shell LLD-C4; `bottom` stays physical because the block axis never
   bidi-mirrors; `top` is deliberately absent (additive enum growth later, no fork now).
4. **Events: NO new names.** Emits `close` + `toggle` (⊂ the closed seven), announcing every REAL
   open-state transition with platform-dismiss discrimination via `this.open` — the ADR-0101 law by
   way of `ui-modal`'s exact wiring; the catalog two-way mark is `value: {prop: 'open', event:
   'toggle'}` (ADR-0019).
5. **Geometry + tokens: zero new system roles, zero new geometry rows, zero new motion tokens.**
   Container-class sizing (space-scale via `[data-box]`; no control height). Inline edges:
   `inline-size: var(--ui-drawer-inline-size)` (default `min(92vw, 26rem)`) × full viewport height;
   bottom edge: content-height × `max-block-size: var(--ui-drawer-max-block-size)` (default `85svh`).
   Radius = the fleet base on non-docked corners, 0 on the docked edge (a within-chain CSS detail).
   Minted roles — `--ui-drawer-{ink,outline,radius,scrim,padding,inline-size,max-block-size}` — each
   consume an existing `--md-sys-*` role (`scrim` → `--md-sys-color-dialog-backdrop`, the TKT-0019
   wash). Motion: an edge-keyed translate over the EXISTING `--md-sys-motion-duration-fast` +
   `--md-sys-motion-easing-standard`, entry via `@starting-style`, exit via `transition-behavior:
   allow-discrete` where supported (degrading to instant-hide — progressive enhancement),
   `prefers-reduced-motion` suppressed. No JS timing/easing props exist, so the step-5
   mechanism-honor check passes by construction.
6. **NO breakpoint behavior is minted.** The `min(92vw, …)` ceiling is already near-full-bleed at
   the fleet-default 414px viewport; `components/` cannot import `@agent-ui/app`'s
   `SHELL_COMPACT_BREAKPOINT` (upward import — the layering trip-wires); any app-level "full-screen
   at compact" wish is a shell-layer token override (`--ui-drawer-inline-size: 100vw;
   --ui-drawer-radius: 0`), consumer-tunable without law. Firm recommendation: the dispatch's
   "full-screen at compact?" question is answered **no**.
7. **Catalog posture: emittable — a `Drawer` row lands with the build** (children container +
   two-way `open` + one-way `edge`/`persistent`), following `Modal`/`Popover`/`FormPopover`;
   `EXCLUSION_ALLOWLIST` (ADR-0112 cl.6) is for page-owner chrome, which this is not.
8. **Fenced out, named:** swipe-dismiss (future intake; candidate mechanism = the `area-drag` trait
   driving translate + threshold-close) · a `top` edge · any non-modal mode (cl.2 rejects it
   permanently — that cell is the shell family's).

## Consequences

- The #845 page-side lane (picker items + roster management + delete affordances) gets its vehicle
  with dismissal/focus/ARIA law inherited from the platform + shipped patterns; nothing page-shaped
  (preset protection, rename, reorder, duplicate) enters the control — verified per-verb in the
  intake's §6.
- The build is dispatchable as the intake's S1–S4 (control triple · real-engine + built-output leg ·
  site surfaces · catalog row), one writer per file, all blocked on this ADR's ratification.
- Re-deriving the `<dialog>` wiring (rather than extracting a shared trait from `ui-modal`) accepts
  ~100 lines of parallel machinery in exchange for zero churn on a shipped control; if a THIRD
  `<dialog>`-based control ever appears, extraction becomes its own fork (named here so the
  repetition is a cited decision, not drift).
- The gen-ui-kit visual reference was unreachable at intake time; if it later surfaces a direction
  this design contradicts, that is a reopen-via-escalation, not a silent deviation (the intake
  records the probe).
