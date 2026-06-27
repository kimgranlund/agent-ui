# ADR-0009 — The shared focus-ring standard (`--c-focus-ring` + `:focus-visible` outline)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead; dedicated --c-focus-ring, outline 2px width / 2px offset, :focus-visible only, forced-colors→Highlight; exact hue delegated to the token slice)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, establishing the fleet focus-indicator standard |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | **NEW** `@agent-ui/shared/src/tokens/tokens.css` (the `--c-focus-ring` role + its forced-colors mapping) · **NEW** `@agent-ui/shared/src/tokens/dimensions.css` (`--ui-focus-ring-width` / `--ui-focus-ring-offset`) · `references/interaction-states.md` (the focus-ring section) · `controls/button/button.css` (the first `:focus-visible` consumer) · `goals §G5` (the booked G4 focus deferral) |
> | **Supersedes / Superseded by** | Relates: **ADR-0008** (focus is the fourth interaction state) · **ADR-0010** (the `tabbable` trait makes the host focusable so the ring can show) · **ADR-0007** (the dimensions layer this extends) |

## Context

The G5 `ui-button` draws no focus indicator — `button.css` has no `:focus-visible` rule, so a keyboard user
gets only the UA default ring (and only once ADR-0010 makes the host focusable at all). A focus indicator is a
**fleet** concern: it must look identical on every control, show **only** for keyboard focus (no ring on a
mouse click — the `:focus-visible` contract), survive `forced-colors`, and not perturb layout. Per
`references/tokens.md`, colour opinions live in the token layer; per `references/geometry.md`, the box geometry
is sacrosocact — a focus treatment must be **layout-neutral**.

`@agent-ui/shared` already owns the two homes: `tokens.css` (the `--c-{family}-{role}` colour roles, with the
WHCM/forced-colors mapping baked in) and `dimensions.css` (the dimensional tokens). The only allowed
cross-package import is `components → @agent-ui/shared`, so a shared focus token is read by every control
without a layering violation.

## Decision

We establish a **single shared focus-ring standard** that every `ui-*` control applies identically:

1. **Ring colour — a dedicated role** `--c-focus-ring` in `@agent-ui/shared/src/tokens/tokens.css`, resolved
   via `light-dark()` and carrying the forced-colors mapping `→ Highlight` (the system focus colour). A
   *dedicated* role, **not** `--c-primary` reused — so a `ghost`/secondary/neutral control gets the same ring,
   not one tinted by the primary family.
2. **Ring geometry — two dimensional tokens** in `@agent-ui/shared/src/tokens/dimensions.css`:
   `--ui-focus-ring-width` (`2px`) and `--ui-focus-ring-offset` (`2px`). These are **constants** (no `var()`
   over a subtree-repointable multiplier), so they stay on `:root`, **not** on `*` — ADR-0007's universal-
   selector rule applies only to *derived* tokens; a constant on `*` would be needless churn.
3. **The recipe — `:focus-visible` + `outline`.** Each control's `@scope` block applies:

   ```css
   :scope:focus-visible {
     outline: var(--ui-focus-ring-width) solid var(--c-focus-ring);
     outline-offset: var(--ui-focus-ring-offset);
   }
   ```

   `outline` (not `box-shadow`) because it is **painted outside the box without affecting layout** (geometry
   law intact), the UA preserves it under `forced-colors`, and `--c-focus-ring`'s `→ Highlight` mapping makes
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
- **A shared-package values change.** Adding `--c-focus-ring` (with its OKLCH value + forced-colors mapping)
  and the two dimension tokens edits `@agent-ui/shared` — owned by the token layer / tokens-specialist. This
  ADR pins the **names + contract**; the exact hue is the token-layer's call (see Open question).

## Open question (needs host/user ratification — an aesthetic call)

The **exact ring hue** and the **width/offset** (recommended `2px`/`2px`) are a token-layer aesthetic call:
should `--c-focus-ring` be an accent-tinted colour or a neutral high-contrast one? Recommendation: a dedicated
accent-leaning role (distinct from `--c-primary`) at `2px`/`2px`, via `outline`. Confirm (or delegate to the
tokens-specialist) before the `tok-focus` slice writes the value. This blocks nothing structural — the
NAMES are pinned, so `css-button` builds against them concurrently.

## Alternatives considered

- **`box-shadow` ring** (`0 0 0 Npx var(--c-focus-ring)`) — rejected as the *primary*: it always follows
  `border-radius` (nice on the pill), but `box-shadow` is **suppressed under `forced-colors`**, so the ring
  vanishes in WHCM unless a fallback `outline` is added — more rules, and it loses the forced-colors-free win.
  Kept on the shelf as a fallback if a target WebKit's squared outline proves unacceptable.
- **Reuse `--c-primary` as the ring colour** — rejected: couples the ring to the primary family, so a control
  on another family/variant would get a mismatched ring. A focus indicator should be one consistent colour.
- **Per-control focus tokens** (`--ui-button-focus-*`) — rejected: a focus ring is a fleet constant, not a
  per-control opinion; centralising it in `@agent-ui/shared` is what prevents drift.
- **`:focus` instead of `:focus-visible`** — rejected: `:focus` draws a ring on mouse click too, which the
  showcase's honesty note and the platform convention both reject. `:focus-visible` is the keyboard-only
  contract.
- **JS-driven focus ring** (a `focus`/`blur` listener toggling a class) — rejected: `:focus-visible` is the
  platform primitive; JS would reintroduce listener residue the kernel discipline exists to avoid.
