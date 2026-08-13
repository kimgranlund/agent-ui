# Design intake — `ui-drawer`, the edge-docked modal container (GH #845, component arm)

> Status: proposed · v0.1 · 2026-08-13 · Layer: intake record (fork sheet, `agent-ui-component-design`
> procedure)
> Refines: GH #845 (owner ruling, intake round 2026-08-13: the Edit-Agents drawer vehicle is a NEW
> fleet `ui-drawer` control; the build starts at this intake). The gen-ui-kit drawer page named as
> visual REFERENCE was unreachable at intake time (probe: `http://localhost:5174/site/components/drawer`
> → no response, 2026-08-13) — per the dispatch's own rule ("the reference is direction, not spec"),
> this record derives from the fleet's own laws alone.
> Consumed by: the #845 page-side lane (Edit-Agents roster management, picker items, delete affordances)
> — that lane COMPOSES `ui-drawer`; nothing page-shaped is baked into the control here (§6).
> Refined by: `.claude/docs/adr/0188-ui-drawer-edge-docked-modal-container.md` (the one
> contract-changing fork this intake finds — the mint itself) → the component build once the ADR
> ratifies (design-only record; no component source is authored here).

## 1 · The job (one sentence)

A **drawer** is a modal surface that slides in DOCKED TO A VIEWPORT EDGE — full-height (or, on the
bottom edge, content-height) — over a scrim, holding arbitrary author content, dismissing and
restoring focus exactly like the fleet's modal, for management/detail tasks too tall or too
list-shaped for a centered dialog.

## 2 · Two-plane decomposition (coverage-checked before the sheet)

**Outside-in (parts):** vehicle decision (mint vs compose) · anatomy (host/part/regions) ·
props+events contract · dismissal/focus/ARIA law · geometry/tokens/motion · breakpoint posture ·
catalog posture · site surfaces + gates · build slices.

**Inside-out (actions the control must support — sourced from #845's page needs + the overlay
family's laws):**

| # | Action | Covered by part |
|---|---|---|
| a | Open from a menu `action` item; two-way `open` so the page/agent observes dismissal | props+events (§4 Events row) |
| b | Hold a long interactive roster list that scrolls | anatomy (dialog part = scroll viewport, scroll-fade) |
| c | Inline rename → a real `ui-text-field` INSIDE the drawer must type freely | dismissal/focus law (no roving focus, native Tab — the form-popover SPEC-R5 lesson) |
| d | Sticky title bar + close affordance; optional footer | anatomy (`[data-box]` region conventions, region-less host) |
| e | Danger delete rows / preset-protected rows | NOT the control's concern — author children (§6) |
| f | Dismiss: Escape · scrim click · page-driven `open=false`; a `persistent` gate | dismissal law (native `<dialog>` + modal's cancel/backdrop wiring) |
| g | Focus restores to the picker trigger on close | focus law (ADR-0017 cl.4 pattern) |
| h | Near-full-bleed on the fleet-default 414px viewport | geometry (the `min(92vw, …)` ceiling; §4 Geometry row) |
| i | Reorder / duplicate semantics | NOT the control's concern — page-side (§6) |
| j | Announce every real open-state transition for the two-way bind | events law (ADR-0101/ADR-0019 pattern) |

Every action maps to a part; every part is exercised by at least one action (catalog posture ↔ a;
site surfaces ↔ the standing gates; build slices ↔ all). Coverage holds — the sheet may proceed.

## 3 · Precedent sweep (patterns-table rows + sources read, nothing redesigned)

| Mechanism needed | Reused precedent (SOURCE read, not summary) | Owner |
|---|---|---|
| Top layer · scrim · focus containment · Escape | native `<dialog>`.`showModal()` — all four free | ADR-0017 · `controls/modal/modal.ts` (read end-to-end) |
| Focus RESTORE on close (the one platform gap) | `#opener` capture + restore on every close | ADR-0017 cl.4 · `modal.ts#restoreFocus` |
| `open`↔platform sync + announce (`close`+`toggle` on a real platform dismiss, `this.open` as discriminator) | modal's platform→model `close` listener + model→platform effect | ADR-0019/ADR-0101 · `modal.ts:64-107` |
| `persistent` dismissal gate (cancel `preventDefault` + rect-wise backdrop-click detection) | modal's `persistent` prop, verbatim shape | ADR-0020 · `modal.ts:79-92` |
| Author children moved into the control-owned part at connect, parts created ONCE, `render()` stays void | the ADR-0017 child-move pattern | `modal.ts#ensureDialog` · patterns-table nested-child-move row |
| aria-label/labelledby forwarded onto the dialog part; host stays aria-clean | ADR-0017 cl.5 | `modal.ts:143-153` |
| Container box-model (region padding, sticky header/footer regions, adjacent-sibling gap) | `[data-box]` | ADR-0046 · `controls/_surface/container-box.css` |
| Edge-aware scroll fade on the scroll viewport, default-on | modal's unconditional `scrollFade(this, { viewport: dialog })` | `modal.ts:100-106` |
| Own z-depth scope | `isolation: isolate` on `[data-box]` | ADR-0052 |
| Logical direction naming (`start`/`end`, never left/right) | super-shell LLD-C4 (GH #95) | `app/src/controls/super-shell/super-shell.ts` header |
| Motion constants + reduced-motion suppression | `--md-sys-motion-duration-fast` / `--md-sys-motion-easing-standard`; `prefers-reduced-motion` precedent in split/tabs/radio | `shared/src/tokens/dimensions.css:82-83` |
| Re-deriving a shipped control's private machinery instead of nesting/fighting it | `ui-command-modal` re-derived combo-box's filter (~60 lines) when the methods were private | ADR-0125 · `controls/command-modal/command-modal.ts` header |

## 4 · Fork sheet

### The mint-vs-compose row — applied explicitly (the vehicle decision)

**Verdict: MINT `ui-drawer`** — confirming GH #845's owner ruling by mechanics, not by deference.

- **The aggregate-value bar** (`agent-ui-component-design/references/mint-vs-compose.md`, ADR-0175):
  checked and NOT APPLICABLE — a drawer carries no value at all (not form-associated, nothing
  round-trips through `ui-form-provider.values()` or an A2UI value mark). Per that reference's own
  scope note, the operative test is ADR-0102's three-lane chooser:
- **Lane 1 — compose shipped controls:** NO. `ui-popover`/`ui-form-popover` are the NON-modal branch
  (`overlay.ts:9` states the boundary itself: "a true MODAL (focus-trapped) stays on `ui-modal`'s
  `<dialog>` `showModal()`") — no scrim, no focus containment; wrong branch entirely. `ui-modal`
  composed page-side would need raw CSS overriding its centered identity from outside
  (`--ui-modal-margin-block-start`, `max-inline-size: min(92vw, 32rem)`, the base radius, shrink-fit
  height → docked edge, `100svh`, zeroed docked-edge radius, axis slide) — restyling a control's
  identity through its token seam is exactly what the chain fences, and ADR-0102's CSS-less-consumer
  law means a catalog consumer could not express it at all.
- **Lane 2 — widen `ui-modal`** (a `dock`/`edge` prop): NO. Count the divergent axes (the
  timeline/status-stream one-family-vs-two rule): a single enum would have to flip (1) the whole
  geometry mode — centered shrink-fit ↔ edge-docked full-height, (2) the motion family — settle-in-place
  ↔ an axis slide keyed to the docked edge, (3) the sizing law — `32rem` max-width dialog ↔ full-height
  panel with its own inline-size token, and (4) the future gesture family (swipe-dismiss only makes
  sense edge-docked). One prop flipping ≥3 identity axes at once is two controls.
- **Lane 3 — mint:** YES, and the mint is CHEAP (the reference's own "minting is cheap when it is"
  check): the interior is not new interaction design — it is the ADR-0017 `<dialog>` machinery
  RE-APPLIED (the command-modal precedent for re-deriving what lives in another control's private
  methods; `ui-modal`'s `#ensureDialog`/`#openDialog`/`#restoreFocus` are all `#`-private), plus one
  edge enum and a docked CSS layout. No new base class, no new trait, no new event, no new geometry
  row, no new color role.

**The vocabulary boundary this mint settles** (the "new container archetype" the issue names): the
overlay/docking family becomes a four-cell map, each cell owned —
`ui-modal` = centered modal `<dialog>` · **`ui-drawer` = edge-docked modal `<dialog>`** ·
`ui-popover`/`ui-form-popover`/menu-select-tooltip = anchored NON-modal top-layer (overlay trait) ·
super-shell side/pane = docked NON-overlay layout (in normal flow; its narrow-band overlay arm is
shell-internal collapse behavior, not a reusable surface). A persistent, non-scrimmed side panel is
therefore NEVER a `ui-drawer` — it routes to the shell family. `ui-drawer` is ALWAYS top-layer +
scrim + focus-contained.

### The standard rows

| Row | Decision | Justification (one line) |
|---|---|---|
| **Tag** | `ui-drawer` · `UIDrawerElement` · `controls/drawer/drawer.{ts,css,md}` | naming law §1/§2/§9; §10 rubric run in §7 below |
| **Anatomy** | REGION-LESS host (the modal precedent, NOT the card's sub-controls): host `display: contents`; ONE control-owned `<dialog data-part="dialog" data-box>` part, created once, author children MOVED in at connect (ADR-0017 child-move); `render()` stays void | the dialog part IS the anatomy; sticky header/footer come free from `[data-box]` region conventions — minting `ui-drawer-header` would duplicate what ADR-0046 already gives every container (the same reasoning that kept `ui-modal` region-less) |
| **Props** | `...UIContainerElement.surfaceProps` + `open` (boolean, reflected, two-way) + `persistent` (boolean, reflected — modal's ADR-0020 shape verbatim) + `edge: 'end' \| 'start' \| 'bottom'` (reflected enum, default `'end'`) | `edge` uses LOGICAL inline names per super-shell LLD-C4; `bottom` stays physical because the block axis never bidi-mirrors; `'end'` default = the options side, #845's own case; `'top'` omitted (YAGNI — additive enum growth later needs no fork) |
| **Events** | emits `close` + `toggle` only; catalog mark `value: {prop: 'open', event: 'toggle'}` (ADR-0019); ADR-0101 announce law: every REAL transition announces, platform dismiss discriminated via `this.open` (the modal wiring verbatim) | both names ∈ the closed seven (`naming.md` §4) — **no event fork** |
| **Geometry** | container size-class: NO §1 ramp row, no control height; padding/gaps off the space scale via `[data-box]`; inline edges → `inline-size: var(--ui-drawer-inline-size)` × `block-size: 100svh`; bottom edge → content-height × `max-block-size: var(--ui-drawer-max-block-size)`; radius `--md-sys-shape-corner-base` on the NON-docked corners only, docked edge 0 (a CSS detail inside the control's own chain, not a radius-law change) | geometry.md's container class covers it whole; the docked-edge-0 refinement mirrors how the shape law already lets a control zero a joined edge |
| **Tokens** | `--ui-drawer-ink` / `--ui-drawer-outline` (the exposed-edge hairline) / `--ui-drawer-radius` / `--ui-drawer-scrim` (→ `--md-sys-color-dialog-backdrop`, modal's TKT-0019 wash) / `--ui-drawer-padding` / `--ui-drawer-inline-size` (default `min(92vw, 26rem)`) / `--ui-drawer-max-block-size` (default `85svh`, bottom edge) — each consuming an existing `--md-sys-*` role; motion rides the EXISTING `--md-sys-motion-duration-fast` + `--md-sys-motion-easing-standard` constants | mirrors `--ui-modal-*` role-for-role; **zero new system roles, zero new motion tokens** |
| **Breakpoint** | **NO minted breakpoint behavior.** The `min(92vw, 26rem)` ceiling already renders near-full-bleed at the fleet-default 414px viewport (92vw ≈ 381px); `components/` CANNOT import `SHELL_COMPACT_BREAKPOINT` (it lives in `@agent-ui/app` — upward import, layering trip-wire); an app-level "full-screen at compact" ruling, if ever wanted, is a shell-layer token override (`--ui-drawer-inline-size: 100vw; --ui-drawer-radius: 0`) — consumer-tunable, no law | the honest layering answer to the dispatch's "full-screen at compact?" question — firm recommendation: no |
| **A11y** | `showModal()` supplies `aria-modal` + focus containment; focus restore = ADR-0017 cl.4 pattern; author `aria-label`/`aria-labelledby` FORWARDED onto the dialog part, host stays aria-clean (cl.5); NO roving focus / type-ahead inside — native Tab order (the form-popover SPEC-R5 lesson: roving is hostile to embedded text fields, and #845's inline-rename puts one there); Escape = platform `cancel`, gated by `persistent` | all platform-supplied or shipped-pattern; nothing minted |
| **Interaction states** | no deviation from the four-state standard — the drawer surface itself is not hover/active-bearing (its CHILDREN are); `[density]` participation via the space-scale tokens `[data-box]` already consumes | no row-level fork |
| **Form participation** | NONE — `UIContainerElement`, not form-associated (a `<dialog>` submits nothing; the ADR-0014 widgets-not-elements reading, exactly as `ui-modal` argued it) | no codec, no value, no validity |
| **Motion (the greenfield-mechanism check, step 5)** | slide from the docked edge: `transform: translate…` transitioned over the existing motion constants; ENTRY via `@starting-style`; EXIT via `transition-behavior: allow-discrete` on `display`/`overlay` where the engine supports it, degrading to instant-hide (progressive enhancement — the overlay trait's own anchor-positioning posture); `prefers-reduced-motion: reduce` suppresses the transition (fleet precedent: split/tabs/radio) | the mechanism-honors-every-configured-attribute check passes trivially: NO JS timing/easing props are minted, so nothing can silently no-op (the swiper lesson pre-empted by not exposing what CSS owns) |
| **Site surfaces** | `drawer.md` descriptor (tag/tier/extends validate against `component-descriptor.ts` enums: tier `container`, extends `UIContainerElement`) · doc page + demo page · gallery/preview specimen · the standing descriptor/site gates those drag | the testing map owns the bar; build slices in §8 |
| **Catalog posture** | **A2UI-emittable — a `Drawer` catalog row lands with the build**, following `Modal`/`Popover`/`FormPopover` (all catalog rows today; only page-owner chrome like Toast/StatusStream/CommandModal sits in `EXCLUSION_ALLOWLIST`, ADR-0112 cl.6 — a drawer is agent-composable content surface, same as Modal); children container + bindable two-way `open` + one-way `edge`/`persistent` marks | ADR-0087's catalog-or-allowlist gate answered on the catalog arm |

## 5 · Classification (the three axes, descriptor-enum vocabulary)

- **Base class:** `UIContainerElement` (surface container, not form-associated — the `ui-modal`
  argument verbatim; none of the `_base` families fit: no indicator/range/listbox semantics).
- **Size-class / tier:** `container`.
- **Catalog posture:** emittable — `Drawer` row (see the fork sheet's last row).

## 6 · #845's page-side needs — carried, not baked in

The Edit-Agents lane composes ALL of its semantics as author children; the drawer contributes only
surface mechanics. Verified against each ruled verb:

| Page need (#845 ruling) | What the drawer provides | What stays page-side |
|---|---|---|
| Roster list | scrollable `[data-box]` body (dialog = scroll viewport, scroll-fade default-on) | the list itself (`ui-list`/rows), preset-vs-custom row shapes |
| Rename inline | native Tab order, NO roving/type-ahead (a `ui-text-field` types freely) | the field, commit wiring, store writes |
| Reorder | nothing needed from the surface | drag/up-down affordances, persisted order |
| Duplicate | nothing | the copy action + store |
| Delete + preset protection | nothing (danger styling is the token roles on the page's own buttons) | the affordance, the protection rule, `PERSIST_PREFIX` cleanup, active-agent fallback |
| Open from the picker's "Edit Agents" item | two-way `open` (`toggle` announce) + focus restore to the trigger | the menu item + `action` event wiring |

No row required a drawer-side accommodation beyond what §4 already rules — the anatomy carries the
lane without page semantics entering the control.

## 7 · Naming (§10 five-question rubric, run before freeze)

1. **Namespaces entered:** element tag (`ui-drawer`), class (`UIDrawerElement`), token prefix
   (`--ui-drawer-*`), file folder (`controls/drawer/`), catalog type (`Drawer`) — all derived from
   the ONE family name per §13's worked derivation.
2. **Reserved-word / concept-canon collision:** none — no existing `drawer` anywhere in
   `controls/`, tokens, or the catalog; distinct from the shell family's `pane`/`rail` vocabulary
   (the §4 boundary map makes the distinction load-bearing, not accidental).
3. **Closed-set admission:** the tag admission + catalog row ride ADR-0188 (this wave's ADR); the
   event set is NOT touched.
4. **Prefix = ownership:** every minted custom property is `--ui-drawer-*`; system roles are only
   consumed, never minted.
5. **Derivability:** `drawer` → `ui-drawer` / `UIDrawerElement` / `drawer.{ts,css,md}` /
   `--ui-drawer-*` / `Drawer` — fully mechanical; no §12 exception is extended.

## 8 · What the change earns + build-slice sketch

**ONE contract-changing fork → ADR-0188 (proposed, never self-ratified):** the mint itself — a new
tag admitted to the fleet, a new `--ui-drawer-*` token family, a new catalog row, and the
overlay-vocabulary boundary (§4) that places it. Everything else is shipped-pattern re-application.
No SPEC is authored (requirements are not ambiguous — the fork sheet + ADR state the acceptance
surface; a SPEC nobody is unsure about is manufactured process); the LLD-grade interface detail a
builder needs is the fork sheet itself plus the cited modal source — the build brief names this
record + ADR-0188 as the contract.

Build slices (the component build; dispatchable one-writer-per-file; **all blocked on ADR-0188's
ratification**):

- **S1 — the control triple.** `controls/drawer/drawer.ts` (ADR-0017 machinery re-applied: part-once
  dialog, child-move, open effect, platform-close listener, persistent gate, focus restore, aria
  forwarding, `scrollFade`) + `drawer.css` (token block + docked layout per `edge` + motion leg) +
  `drawer.md` descriptor + barrel export. Accept: jsdom tests cover open/close/toggle announce
  ordering, persistent gate, child-move idempotence across reconnect, aria forwarding; descriptor
  validates; naming/styling/family-coherence standing gates green.
- **S2 — the real-engine leg.** `drawer.browser.test.ts`: top-layer entry (`:modal`), focus
  containment + restore-to-trigger, scrim click vs content click (rect-wise), Escape vs `persistent`,
  reduced-motion suppression, and a BUILT-OUTPUT probe that the docked geometry (full-height, edge
  translate, zeroed docked-edge radius) computes from production CSS (the TKT-0002 class — the motion
  and `@starting-style` legs are cascade-dependent claims, never source-grep claims).
- **S3 — site surfaces.** Doc page + demo page + gallery/preview specimen (all three edges, a
  long-list scroll specimen); the standing site/descriptor coverage gates those drag.
- **S4 — the catalog arm.** `Drawer` row in `catalog.json` + factory + the ADR-0087 gate
  (catalog-or-allowlist) satisfied on the row side; two-way `open` mark.
- **Fenced out of this lane entirely:** the #845 page-side composition (picker items, roster
  management, delete affordances) — a separate later lane that CONSUMES S1–S4.

**Named future forks (fenced, not designed):** swipe-dismiss gesture (candidate mechanism: the
`area-drag` trait driving a translate + threshold-close; needs its own intake — gesture thresholds
are a real design space) · a `top` edge (additive enum growth) · any non-modal drawer mode (rejected
here — that is the shell family's cell, §4).

## 9 · Open questions (for Kim — none blocking this record's freeze)

- `edge` value taste: `'bottom'` (physical, honest — the block axis never mirrors) vs `'block-end'`
  (logically pure, clumsy). Recommended: `'bottom'`.
- The inline default `26rem` (416px — one module under the modal's 32rem, sized for a list-management
  panel): flag if a different default is preferred before ratification.
- Whether S4 (the catalog row) lands with the v1 build or defers one wave — recommended: with the
  build (the ADR-0087 gate makes deferral a standing exception to carry).
