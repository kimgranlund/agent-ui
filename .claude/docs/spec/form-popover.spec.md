# SPEC — `ui-form-popover`

> Status: proposed · v0.1 · 2026-07-27 · Layer: SPEC (execution contract)
> Refines: GH #294 (the frozen form-fragment-menu intake) under Kim's F1–F4 rulings (issue comment,
> 2026-07-27 — F1 general form content · F2 live-apply · F3 floating `ui-popover` surface · F4 mint
> the control) and the intake record `form-popover.intake.md` (naming derivation, classification,
> fork sheet, the no-ADR decision).
>
> **No owning PRD — a deliberate, acknowledged deviation** (the theme-provider SPEC's precedent
> shape): the problem statement, user, and acceptance discovery already live in GH #294's issue
> body + rulings; a PRD would restate them under different frontmatter. Recorded here as a reviewed
> deviation, not a silent miss.
> Refined by: `form-popover.lld.md`. Build plan: `form-popover.decomp.md`.
> Altitude: owns **what the shipped element does and how it behaves at every boundary** (prop
> contract, event contract, a11y shape, catalog disposition, the recipe relationship).
> Implementation (file layout, CSS mechanics, part-creation code) is the LLD's. Requirement IDs
> file-scoped (`SPEC-R1…`).

---

## 1 · Purpose

Ship `ui-form-popover`, the pattern-tier control the F4 ruling minted: a control-created trigger
button (visible `label` text + caret) that opens a floating, anchored, light-dismiss panel into
which ALL author-provided children are moved — arbitrary real form content editing live-apply.
It packages the first leg's composition recipe (`ui-popover` + form spine) as one tag for
ergonomics and GenUI density; the recipe remains the documented long-form.

## 2 · Definitions

- **Trigger** — the control-created `<button data-part="trigger">`; the only part in document flow.
- **Panel** — the control-created top-layer surface (`popover="auto"`) holding the moved children.
- **Summary state** — the consumer-authored text the `label` prop carries (e.g. "Options · 3
  selected"). The control never computes it (F1: content is general).
- **Live-apply** — F2's commit model: each child control's own commit takes effect immediately;
  the host holds no draft value.

## 3 · Requirements

- **SPEC-R1 — Anatomy.** The host creates exactly two parts, once, idempotent across
  disconnect/reconnect: the trigger (containing `[data-part=label]` + `[data-part=caret]`) and the
  panel. ALL author light-DOM children move into the panel at first connect (ADR-0017); there is
  ONE content model — general form content — with no named rows and no fixed anatomy (F1).
  `render()` stays the inherited void.
- **SPEC-R2 — Props.** `open` (boolean, default false, reflected, two-way bindable via `toggle` —
  ADR-0019, prop-as-source-of-truth per ADR-0101's erratum) · `placement` (closed enum = the eight
  `OverlayPlacement` values, default `bottom-start`, reflected, captured per connection — the
  popover limitation, restated) · `label` (string, default `''`, reflected — the trigger's visible
  text AND accessible name; the summary-state carrier) · `size` (`sm`|`md`|`lg`, default `md`,
  reflected — the trigger's dimensional-ramp step, the select axis). No other props in v1; no
  `disabled`.
- **SPEC-R3 — Overlay behavior.** The panel is a Popover-API `auto` top-layer surface via the
  overlay controller (ADR-0043/0045): trigger click toggles `open`; Escape and outside-click
  light-dismiss; focus moves into the panel on open and restores to the trigger on close. Every
  ACTUAL open-state transition — platform, component, or model-driven — emits `close` (hide only,
  first) + `toggle` on the host with `open` already settled (ADR-0101).
- **SPEC-R4 — Events.** The host emits ONLY `toggle` and `close`. Child form controls' own
  `change`/`input`/`select` events bubble through unmodified and unintercepted — the host never
  aggregates, delays, or re-emits them (F2). No new event name enters the fleet vocabulary.
- **SPEC-R5 — Keyboard/focus.** Tab order inside the panel is NATIVE — no roving focus, no
  type-ahead, no arrow-key interception (the anti-`ui-menu` constraint the first intake proved).
  Enter/Space activate the trigger as a native button. The panel carries `tabindex="-1"` as the
  focus-in fallback.
- **SPEC-R6 — A11y shape.** Host: no explicit role. Trigger: `aria-expanded` synced to `open`,
  `aria-controls` → the panel's stable id, NO `aria-haspopup` (generic disclosure, not
  menu/listbox/dialog — the `ui-popover` + APG disclosure posture). Accessible name = the visible
  `label` text (content-only). The control adds NO group/label semantics inside the panel — those
  belong to consumer content (the recipe's `role="group"` idiom).
- **SPEC-R7 — Not form-associated.** `extends UIElement`; no value, no validity, no form
  participation on the host. `ui-field`/`ui-form-provider` compositions inside the panel work
  unchanged (the moved children are ordinary light DOM).
- **SPEC-R8 — Geometry & tokens.** `tier: pattern`, by part: trigger = Control-class height from
  the (scale × `size`) lookup (`--ui-form-popover-height` + font/icon/gap, the select mechanism);
  caret glyph sized = font (§4.1 caret law); panel = Container/surface — `[data-box]` spacing
  (ADR-0046, its own z-scope per ADR-0052), `--ui-form-popover-panel-min-inline-size` floor and
  `-max-inline-size` clamp. All control tokens `--ui-form-popover-*` (ADR-0140); colors consume
  existing `--md-sys-color-*` roles only — no new role, no intent axis.
- **SPEC-R9 — Catalog disposition.** A2UI-emittable: one `FormPopover` catalog row + factory,
  two-way bound `{prop:'open', event:'toggle'}`; `label` declared `bindable` (ONE-WAY data-model
  binding, no value event — the agent-side summary-state mechanism; a non-bindable prop rejects
  `{path}` bindings under the shipped conformance rules); `placement`/`size` as non-bindable
  literal props;
  `children` = a plain ChildList of PANEL content (the trigger is control-created and absorbs no
  children — deliberately simpler than `Popover`'s trigger-first-child contract). Catalog
  conformance + admission gates updated; NO `EXCLUSION_ALLOWLIST` change (ADR-0087).
- **SPEC-R10 — No built-in close affordance.** The panel ships no close button: light-dismiss,
  Escape, and trigger re-click are the close paths (F3). A consumer wanting the reference
  screenshot's in-panel collapse affordance authors a `ui-button` that sets `open = false` — a
  documented idiom, not anatomy.
- **SPEC-R11 — Site surface.** Descriptor `form-popover.md` (frontmatter-valid, contract↔props
  trip-wire), doc + demo pages, a REPRESENTATIVE gallery/preview specimen (summary trigger +
  check group + radio group + text field — the reference's content), and the first-leg recipe page
  cross-linking the control as its packaged form.

## 4 · Non-goals

No change to `ui-menu` or `ui-popover` · no draft/cancel commit model (F2) · no inline-disclosure
mode (F3; `ui-disclosure` owns that lane) · no host-computed selection counting (F1) · no
`disabled` prop in v1 · no new event/tier/state/geometry row/token role · no ADR (intake §6).

## 5 · Acceptance (gates)

`npm run check && npm test` green by exit codes; the descriptor/site/catalog standing gates pass;
the browser-probe suite in `form-popover.decomp.md`'s test plan (overlay lifecycle, native Tab
order with an embedded text field, ADR-0101 event order) green.
