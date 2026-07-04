# ADR-0009 — The shared focus-ring standard (`--md-sys-color-focus-ring` + `:focus-visible` outline)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, establishing the fleet focus-indicator standard |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | **NEW** `@agent-ui/shared/src/tokens/tokens.css` (the `--md-sys-color-focus-ring` role + its forced-colors mapping) · **NEW** `@agent-ui/shared/src/tokens/dimensions.css` (`--ui-focus-ring-width` / `--ui-focus-ring-offset`) · `references/interaction-states.md` (the focus-ring section) · `controls/button/button.css` (the first `:focus-visible` consumer) · `goals §G5` (the booked G4 focus deferral) |
> | **Supersedes / Superseded by** | Relates: **ADR-0008** (focus is the fourth interaction state) · **ADR-0010** (the `tabbable` trait makes the host focusable so the ring can show) · **ADR-0007** (the dimensions layer this extends) · **Amended by ADR-0014** (the `:focus-within` text-entry-control variant — see the `## Amendment` below) |

## Context

The G5 `ui-button` draws no focus indicator — `button.css` has no `:focus-visible` rule, so a keyboard user
gets only the UA default ring (and only once ADR-0010 makes the host focusable at all). A focus indicator is a
**fleet** concern: it must look identical on every control, show **only** for keyboard focus (no ring on a
mouse click — the `:focus-visible` contract), survive `forced-colors`, and not perturb layout. Per
`references/tokens.md`, colour opinions live in the token layer; per `references/geometry.md`, the box geometry
is sacrosocact — a focus treatment must be **layout-neutral**.

`@agent-ui/shared` already owns the two homes: `tokens.css` (the `--md-sys-color-{family}-{role}` colour roles, with the
WHCM/forced-colors mapping baked in) and `dimensions.css` (the dimensional tokens). The only allowed
cross-package import is `components → @agent-ui/shared`, so a shared focus token is read by every control
without a layering violation.

## Decision

We establish a **single shared focus-ring standard** that every `ui-*` control applies identically:

1. **Ring colour — a dedicated role** `--md-sys-color-focus-ring` in `@agent-ui/shared/src/tokens/tokens.css`, resolved
   via `light-dark()` and carrying the forced-colors mapping `→ Highlight` (the system focus colour). A
   *dedicated* role, **not** `--md-sys-color-primary` reused — so a `ghost`/secondary/neutral control gets the same ring,
   not one tinted by the primary family.
2. **Ring geometry — two dimensional tokens** in `@agent-ui/shared/src/tokens/dimensions.css`:
   `--ui-focus-ring-width` (`2px`) and `--ui-focus-ring-offset` (`2px`). These are **constants** (no `var()`
   over a subtree-repointable multiplier), so they stay on `:root`, **not** on `*` — ADR-0007's universal-
   selector rule applies only to *derived* tokens; a constant on `*` would be needless churn.
3. **The recipe — `:focus-visible` + `outline`.** Each control's `@scope` block applies:

   ```css
   :scope:focus-visible {
     outline: var(--ui-focus-ring-width) solid var(--md-sys-color-focus-ring);
     outline-offset: var(--ui-focus-ring-offset);
   }
   ```

   `outline` (not `box-shadow`) because it is **painted outside the box without affecting layout** (geometry
   law intact), the UA preserves it under `forced-colors`, and `--md-sys-color-focus-ring`'s `→ Highlight` mapping makes
   the WHCM ring **free**. `:focus-visible` (not `:focus`) gives the keyboard-only contract: no ring on a mouse
   click.

The ring shows only when the host is keyboard-focused; ADR-0010's `tabbable` trait supplies the `tabindex=0`
that makes a light-DOM custom element focusable, and removes it when disabled — so a disabled control never
draws the ring.

## Consequences

- **One indicator, fleet-wide.** Every current and future control reads the same three tokens and applies the
  same recipe — the focus indicator cannot drift between controls (C5/C8). `references/interaction-states.md`
  documents it as the standard.
- **Forced-colors survival is automatic** because the ring colour is a role with the `→ Highlight` WHCM
  mapping; the wave-2 cross-engine smoke proves the ring does not vanish (C8/C9).
- **Layout untouched.** `outline`/`outline-offset` do not participate in box geometry, so `geometry.md`'s law
  and the existing geometry smoke assertions are unaffected (the smoke only *gains* a ring assertion).
- **A cross-engine caveat to verify:** `outline` rounding-follows-`border-radius` is engine-versioned —
  modern WebKit (≈16.4+) rounds the outline to the pill, older WebKit squares it. The requirement is a
  *visible, keyboard-only, forced-colors-safe* ring; perfect rounding on the pill is nice-to-have. The wave-2
  smoke checks both engines; if a target WebKit squares it, that is acceptable (and the `box-shadow` fallback
  in Alternatives remains available behind a later ADR).
- **A shared-package values change.** Adding `--md-sys-color-focus-ring` (with its OKLCH value + forced-colors mapping)
  and the two dimension tokens edits `@agent-ui/shared` — owned by the token layer / tokens-specialist. This
  ADR pins the **names + contract**; the exact hue is the token-layer's call (see Open question).

## Resolved on ratification (2026-06-27 — orchestration-lead)

CONFIRMED: a **dedicated `--md-sys-color-focus-ring`** role (not `--md-sys-color-primary`), via **`outline` at `2px` width / `2px`
offset**, **`:focus-visible` only**, and it **MUST** carry the forced-colors `→ Highlight` mapping (Risk 3).
The **exact hue is delegated to the `tok-focus` token slice** (default to a distinct, high-contrast focus
accent). The names are pinned, so this blocks nothing structural — `css-button` builds the `:focus-visible`
recipe against them concurrently.

## Amendment — `:focus-within` for text-entry controls (2026-06-27, introduced by ADR-0014)

> Status: ratified 2026-06-27 (orchestration-lead, on accept of **ADR-0014**). Append-only; this **adds** a
> variant and does **not** edit the Context / Decision / Consequences above.

The original Decision **stands**: keyboard-operated controls (`ui-button` and its siblings) draw the shared ring on
`:focus-visible` — keyboard-only, no ring on a mouse click. **ADR-0014 (`ui-text-field`) introduces the first
*text-entry* control**, where native parity requires the field to show focus on **all** focus — including a mouse
click — because a text input must visibly signal where typing will land.

We add a **text-entry-control variant of the SAME ring**: the field's `@scope` block uses **`:focus-within`** (not
`:focus-visible`), reading the **identical** shared tokens (`--md-sys-color-focus-ring`, `--ui-focus-ring-width` /
`--ui-focus-ring-offset`) and the same layout-neutral `outline` recipe — **only the trigger pseudo-class differs**:

```css
:scope:focus-within {   /* text-entry control — ring on ALL focus, incl. pointer (native input parity) */
  outline: var(--ui-focus-ring-width) solid var(--md-sys-color-focus-ring);
  outline-offset: var(--ui-focus-ring-offset);
}
```

`:focus-within` (not `:focus-visible` on the editor) is used because the focusable element is the editor **child**,
not the host; the ring is drawn on the host frame off the focused editor. The selection rule for future controls:

- **keyboard-operated control** (button, checkbox, switch, radio) → **`:focus-visible`** (the original Decision).
- **text-entry control** (a focusable editable surface: text-field, number-field, …) → **`:focus-within`**.

Both are the one fleet ring on the one set of tokens; only the trigger reflects the control kind. This is a foreseen
follow-through (a second consumer needing the same ring on a different trigger), not a reversal — the keyboard-control
default and the shared tokens/recipe are unchanged.

## Alternatives considered

- **`box-shadow` ring** (`0 0 0 Npx var(--md-sys-color-focus-ring)`) — rejected as the *primary*: it always follows
  `border-radius` (nice on the pill), but `box-shadow` is **suppressed under `forced-colors`**, so the ring
  vanishes in WHCM unless a fallback `outline` is added — more rules, and it loses the forced-colors-free win.
  Kept on the shelf as a fallback if a target WebKit's squared outline proves unacceptable.
- **Reuse `--md-sys-color-primary` as the ring colour** — rejected: couples the ring to the primary family, so a control
  on another family/variant would get a mismatched ring. A focus indicator should be one consistent colour.
- **Per-control focus tokens** (`--ui-button-focus-*`) — rejected: a focus ring is a fleet constant, not a
  per-control opinion; centralising it in `@agent-ui/shared` is what prevents drift.
- **`:focus` instead of `:focus-visible`** — rejected: `:focus` draws a ring on mouse click too, which the
  showcase's honesty note and the platform convention both reject. `:focus-visible` is the keyboard-only
  contract.
- **JS-driven focus ring** (a `focus`/`blur` listener toggling a class) — rejected: `:focus-visible` is the
  platform primitive; JS would reintroduce listener residue the kernel discipline exists to avoid.
