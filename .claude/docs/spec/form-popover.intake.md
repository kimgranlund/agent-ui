# Design intake — `ui-form-popover` (GH #294, second leg: the F4 pattern-tier control)

> Status: proposed · v0.1 · 2026-07-27 · Layer: intake record (naming + classification + fork sheet)
> Refines: GH #294 (the frozen first intake + Kim's F1–F4 rulings, comment 2026-07-27) — F4 ruled
> "ALSO mint a pattern-tier control" beyond the composition recipe.
> Refined by: `form-popover.spec.md` (SPEC-R1…) → `form-popover.lld.md` (LLD-C1…) →
> `form-popover.decomp.md` (build sequence + test plan). All four drafts land together; a
> single-writer slice commits them under `.claude/docs/`.

## 1 · The job (one sentence)

A trigger button whose label carries consumer-authored state ("Option items · 3 selected") opens a
floating, anchored, light-dismiss panel in which the user edits arbitrary real form controls
(check group · radio group · text field · …) live-apply, then dismisses it.

Settled by the first intake + rulings (NOT re-litigated here): not a `ui-menu` extension (ARIA
`menu` forbids a textbox child; roving type-ahead steals typing; `#commit` closes per click);
content model is GENERAL form content (F1); live-apply (F2); floating `ui-popover`-style surface
(F3); a minted control IN ADDITION to the recipe (F4).

## 2 · Naming — the §13 derivation

**The one decision: the family is `form-popover`.** What the thing IS, in words the fleet already
owns: *a popover holding a form fragment*. Both words are canon — `form` (the FACE form spine,
`ui-form-provider`) and `popover` (`ui-popover`, ADR-0043). Kim's KISS law: a child asked "what is
it?" says "a button that opens a little form" — form + popover is that sentence in fleet nouns.

Candidates rejected:

- `ui-filter` — a use-case name; F1 explicitly ruled the content GENERAL, not filters.
- `ui-form-menu` / `ui-field-menu` — "menu" names the exact ARIA lane the first intake proved
  forbidden; the name would teach the wrong mechanism.
- `ui-dropdown` — jargon, not derivable to the mechanism, and concept-collides with select/menu.
- `ui-form-panel` — "panel" is a fleet-wide `data-part` noun (§6 namespace); doesn't say floating.
- `ui-popover-form` — reads as a family member of `popover` (`ui-{family}-{part}`), which it is not.

Derived set (no further choices, per naming.md §13): folder `controls/form-popover/` · tag
`ui-form-popover` · class `UIFormPopoverElement` · tokens `--ui-form-popover-*` · parts
`trigger` / `label` / `caret` / `panel` (all existing part nouns) · catalog type `FormPopover` ·
subpath `./controls/form-popover` · descriptor `form-popover.md` · docs pages
`form-popover-{doc,demo}.html` · events from §4 only.

**§10 five-question rubric:**

1. **Namespaces entered** — the ~8 above, all derived from the one family name.
2. **Reserved-word collision** — none. `form` is not a reserved prop word; `open`/`label` are
   used in their reserved senses (overlay visibility · accessible name), never repurposed. No tag
   collision (`ui-form-provider` is a distinct name; grep confirms no `form-popover` anywhere).
3. **Closed-set admission** — none needed: no new event (open/close/toggle + bubbling child
   commits), no new tier (`pattern` exists), no new custom state, no new part noun.
4. **Prefix = ownership** — `--ui-form-popover-*` control-owned per ADR-0140; consumes
   `--md-sys-*` system tokens only.
5. **Derivable** — "form-popover" reconstructs to "a popover holding form content" with zero
   explanation. Yes.

**§12 recorded exceptions** — checked; none touched. The compound-tag hyphen overload (§1) is
resolved by the descriptor, as the law requires — `form-popover.md` names itself family root.

## 3 · Classification (descriptor-enum vocabulary)

- **Base class: `UIElement`.** The host is NOT value-bearing: the panel's children are the FACE
  form controls and each owns its own value/validity; F2's live-apply means there is no aggregate
  draft value for the host to hold, no `formValue()`, no submit semantics. Exactly `ui-popover`'s
  posture ("NOT form-associated — a disclosure surface", popover.md `extends:` line) and
  `ui-menu`'s. None of the `controls/_base/` families (indicator/range/listbox) fits — no
  checked/value/option semantics on the host. Not `UIContainerElement` — it is an interactive
  trigger+overlay pattern, not a layout surface.
- **Tier: `pattern`.** geometry.md's Pattern band ("container + control-height rows — interactive
  rows take the control height; the shell uses the space scale", line 133) is this exactly:
  trigger = Control-class height, panel = Container/surface. Precedents recorded: `ui-select`
  (trigger Control-class · panel Container/surface), `ui-menu`, `ui-combo-box`, `ui-command-modal`
  — all `tier: pattern` on the same by-part reasoning.
- **Catalog posture: A2UI-emittable.** F4's stated rationale is GenUI ergonomics/density — an
  excluded control would defeat the ruling. One `catalog.json` row (`FormPopover`) + factory —
  `open` two-way bindable, `label` ONE-WAY bindable (bindability is what makes the agent's
  summary-state `{path}` binding legal under the shipped conformance rules);
  children = a plain ChildList of panel content (the control-created trigger absorbs no children —
  SIMPLER for agents than `Popover`, whose first child must be the trigger). No
  `EXCLUSION_ALLOWLIST` change. ADR-0087 catalog-or-allowlist gate satisfied on the catalog side.

## 4 · Precedent sweep (patterns-table rows reused — nothing redesigned)

| Mechanism needed | Reused row | Owner |
|---|---|---|
| Floating anchored panel, light-dismiss, focus-in/restore | Overlay controller trait `overlay(host, {popup, anchor, placement, auto, focusOnOpen})` | ADR-0043/0045 · `traits/overlay.ts` (verified in `popover.ts:92-98`, `combo-box.ts`) |
| Two-way `open` | prop-as-source-of-truth + `toggle` bind | ADR-0019 · popover/select pattern |
| Every real close announces | `close` + `toggle` on host | ADR-0101 (erratum: flip the PROP, never `handle.toggle()` — `popover.ts:103-111`) |
| Children into the panel | connect-time child-move | ADR-0017 · `modal`/`popover` (`popover.ts:169-175`) |
| Panel spacing for arbitrary form content | `[data-box]` container box-model on the panel | ADR-0046 · `_surface/container-box.css` (select's listbox precedent, `select.css:114`) |
| Panel z-scope | `isolation: isolate` via `[data-box]` | ADR-0052 |
| Trigger caret glyph | `setIcon(el, name)` sized = font (§4.1 caret law) | `@agent-ui/icons` `resolve.ts:36` · select's caret part |
| Trigger height ramp | (scale × size) → row LOOKUP | ADR-0038/0036 · select's `[size]` repoint |

Deliberate NON-reuse: the control does **not** nest a literal `<ui-popover>` (the patterns table's
own nested-shipped-control footgun row: the inner control's connect-time child-move races the
outer's part composition) and does **not** use `rovingFocus` (the first intake proved roving/
type-ahead hostile to embedded text fields — Tab order stays native inside the panel).

## 5 · Fork sheet (ten rows)

| Row | Decision | Why (one line) |
|---|---|---|
| **Tag** | `ui-form-popover` | §2 derivation; §10 rubric clean. |
| **Anatomy** | Control-CREATED trigger `<button data-part="trigger">` ([label span | caret span], select's shape) + control-created `<div data-part="panel" data-box tabindex="-1">` (`popover="auto"` is TRAIT-owned — the overlay controller sets it, single-ownership ADR-0017); ALL author children move into the panel (one default slot, ADR-0017). Host-as-wrapper, parts created once, `render()` stays VOID (popover precedent — re-creating drops top-layer state). | The minted control's value over raw `ui-popover` IS the standardized trigger + panel surface; one slot = F1's "general form content". |
| **Props** | `open` (boolean, reflect, BINDABLE via `toggle`, ADR-0019) · `placement` (enum = popover's 8 `PLACEMENTS`, default `bottom-start`, reflect, captured per connection) · `label` (string, reflect per fleet law TKT-0069 — the trigger's VISIBLE text; the consumer/agent writes summary state into it, per the F1 "consumer-authored" ruling) · `size` (`sm·md·lg`, default `md`, reflect — trigger ramp, select parity). No `disabled` in v1 (popover/menu carry none; default-no). | Four props, all in reserved/canon senses. |
| **Trigger-label state mechanism** | A PROP (`label`), not a slot and not control-computed. HTML: consumer sets/updates `label` (e.g. an effect counting `change` events, the recipe's wiring). A2UI: `label` is a data-model-bound string — the agent binds `"Options · ${sel} selected"`. The control never counts children itself (F1: content is general; a built-in count would presume checkbox semantics). | Consumer-authored per F1; a prop is the only shape that is both declarative and A2UI-bindable. |
| **Events** | Host: `toggle` + `close` (overlay lifecycle, ADR-0101) — ⊂ the seven. Child `change`/`input`/`select` bubble natively from the FACE controls in the panel (live-apply F2 = no aggregation, no interception). NO new event name. | Vocabulary stays closed. |
| **Geometry** | Pattern band by part: trigger = Control class, height/font/icon/gap from the (scale×size) lookup rows keyed by `[size]` (`--ui-form-popover-height` etc., select's mechanism); caret glyph = font size (§4.1 caret law); panel = Container/surface on `--md-sys-space` via `[data-box]`, with `--ui-form-popover-panel-min-inline-size` floor (the text-field 20ch-floor lesson: an anchored panel of form fields needs an intrinsic floor) + `max-inline-size` clamp. No new geometry row/class. | Every number comes from an existing law. |
| **Tokens** | `--ui-form-popover-{height,gap,radius,panel-min-inline-size,panel-max-inline-size}` (control-owned, ADR-0140); color via existing `--md-sys-color-*` roles (trigger = select-trigger roles; panel = surface/outline roles). No new role; no intent axis (⇒ no non-color-signifier obligation). | LLD enumerates the exact consume map. |
| **A11y** | Disclosure semantics, the popover precedent: host has NO role; trigger gets `aria-expanded` (effect-synced) + `aria-controls` → panel id; NO `aria-haspopup` (the panel is a generic disclosure surface, not a menu/listbox/dialog — matching `ui-popover`, and per the APG disclosure pattern). Panel `tabindex="-1"`; `focusOnOpen: true` moves focus in; overlay controller restores focus to the trigger on close (ADR-0045). Tab order NATIVE inside the panel — no roving focus, no type-ahead (the whole point vs `ui-menu`). Group/label semantics inside the panel belong to the CONSUMER's content (the recipe's `role="group"` idiom); the control adds none. Trigger accessible name = the visible `label` text (content-only — no hidden-span concatenation needed; unlike select there is no separate value text to preserve). | Everything is the shipped overlay contract; zero new ARIA mechanics. |
| **Interaction states** | Standard four-state on the trigger per `interaction-states.md` + `[density]` participation. NO deviation ⇒ no row, no fork. | Law-owned. |
| **Form participation** | None on the host (§3). Children participate individually via their own FACE contracts; `ui-field`/`ui-form-provider` work inside the panel unchanged (the panel is ordinary light-DOM once moved). | F2 live-apply removes any aggregate-value case. |
| **Site surfaces** | `form-popover.md` descriptor (frontmatter validated + contract↔props trip-wire) · doc page + demo page · gallery/preview specimen (a REPRESENTATIVE one: count-summarising trigger + check group + radio group + text field — the reference's own content) · catalog row + conformance · the first-leg recipe page cross-links to the control as its "when the recipe is too verbose" escalation. | Drags the standing descriptor/site/catalog gates; test plan cites each. |

## 6 · What the change earns — ADR decision: **NO ADR** (default-no upheld)

Minting a pattern-tier control is routine when every mechanism is already ratified — and here all
are: overlay (ADR-0043/0045), two-way `open` (ADR-0019), announce-on-close (ADR-0101), child-move
(ADR-0017), `[data-box]` (ADR-0046/0052), catalog row (ADR-0087's normal path — the Wave-A rows
Popover/Menu/Tooltip were added without per-row ADRs). No new event name, no new tier, no new
custom state, no new geometry row, no fleet contract changed, no exclusion. The ADR bar is
"contract-changing fork"; there is none. (The first intake reached the same conclusion for the
recipe; the F4 ruling adds a control, not a contract.)

## 7 · Open questions (for Kim — none blocking)

- None blocking the build. One taste-level note: `ui-form-popover` panels have no built-in close
  affordance (light-dismiss + trigger re-click only, matching F3's popover ruling and
  `ui-popover`). The reference screenshot's in-panel collapse chevron is reproducible by the
  CONSUMER (a `ui-button` writing `open = false`); the SPEC records this as out-of-anatomy. Flag
  if a built-in close button is wanted instead.
