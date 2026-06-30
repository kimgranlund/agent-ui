# ADR-0007 — Universal-selector ramp tokens: derived dimensions on `*` for subtree scale/density

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — delivers ADR-0006 subtree [density]; unblocks s13)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — encoding the host-ratified fix for a geometry bug the gold cross-engine smoke (s13) caught and execution-lead diagnosed |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | `packages/agent-ui/shared/src/tokens/dimensions.css` (s6 — the derived ramp-token declarations: `--ui-{height,font,gap}-{sm,md,lg}`). *(No edit: `references/geometry.md` is the law and is correct — it always intended subtree scale/density; this is a CSS-mechanics repair.)* |
> | **Supersedes / Superseded by** | Relates: **ADR-0006** (its subtree `[density]` smoke is now actually *delivered*, not merely assumed). · **Extended by ADR-0032** (the numeric `--ui-scale` mechanism here is kept; the `[scale]` attribute vocabulary widens from the 3-step placeholder to the 6-tier `ui-sm…content-lg` two-band system). |

## Context

The s6 dimensional ramp declared its **derived** tokens as `--ui-height-md: calc(28px * var(--ui-scale))`
on `:root`. The gold cross-engine smoke (s13) caught that a **subtree** `[scale]`/`[density]` (on a wrapper,
not on `<html>`) silently did nothing — only a root-level repoint worked. Validated in **both Chromium and
WebKit**.

The cause is a CSS custom-property substitution rule that is easy to miss: **a `var()` inside a
custom-property value is substituted where the property is *declared*, not where it is later read.** Declared
on `:root`, `--ui-height-md` resolves `var(--ui-scale)` against `:root`'s `--ui-scale` (= 1) and **freezes the
literal** `calc(28px * 1)`; that already-resolved value then *inherits* down the tree. A descendant with
`[scale="compact"]` repoints `--ui-scale` to `0.875` for its subtree, but `--ui-height-md` is not re-declared
on the descendant, so it never re-multiplies — the inherited frozen literal wins. Subtree scale/density was
dead.

This silently broke the **subtree contract** that `dimensions.css`'s own comments promised, and that
**ADR-0006 assumes** — ADR-0006's `[density]` smoke asserts a *subtree* gap-change. Root-only scaling would
contradict an already-ratified decision.

## Decision

We declare the **derived ramp tokens** (`--ui-{height,font,gap}-{sm,md,lg}`) on the **universal `*`
selector**, not `:root`. Each element then re-declares — and so **re-substitutes** — `var(--ui-scale)` /
`var(--ui-density)` against the value **it inherits**, so a subtree `[scale]`/`[density]` repoint recomputes
the whole ramp within that subtree. The two **multipliers** `--ui-scale` / `--ui-density` stay on `:root`
(base = 1), repointed by the `[scale]` / `[density]` ancestor blocks. Resolution A, host-ratified;
execution-lead applies the `dimensions.css` change in parallel.

execution-lead validated in a real engine (Chromium + WebKit): subtree `scale=compact` → height/font
**24.5 / 12.25**; subtree `density` gap → **3.5 / 10.5**; bare frame **invariant 28 / 14**.

## Consequences

- **Every control's scale/density is now subtree-correct** — a `[scale]`/`[density]` wrapper (a themed card,
  a dense table region) recomputes the ramp for its subtree, which is what the demo/`/site` theming story and
  ADR-0006's `[density]` smoke both require. **ADR-0006's subtree `[density]` is now actually delivered.**
- **Specificity / perf — negligible.** `*` is specificity `(0,0,0)`, *lower* than the `[scale]` blocks'
  `(0,1,0)`, so the multiplier repoint still wins; the `*` rule only **declares inheritable custom
  properties** (≈9 per element) — declarations trigger no layout/paint, so the cost is immaterial. This is
  the correct, idiomatic use of `*` (cheap custom-prop declarations), not a styling `*` (which would be).
- **A guard against regression:** the `*` placement is deliberate and is commented in `dimensions.css` as
  "do NOT simplify back to `:root` — that re-breaks subtree scale/density." This ADR is the durable record of
  *why*, so the next editor doesn't re-introduce the bug.
- **The pattern generalizes:** any future *derived* token (a value computed via `var()` from a
  subtree-repointable multiplier) must be declared on `*`, not `:root`, or it freezes the root multiplier.
  Base multipliers/constants (no `var()` over a repointable input) stay on `:root`.
- **Testing lesson (no new gate, a sharper one):** s6's static probe asserted the literal token *stream*
  (`calc(28px * var(--ui-scale))`) and passed while the *behaviour* was broken — a static CSS-text check
  cannot see subtree substitution. The **cross-engine smoke caught what the static probe could not** (the
  generator/critic split earning its cost). The dimensions test should now also assert the `*` placement /
  subtree recompute, not only the token text.

## Alternatives considered

- **Keep the ramp on `:root`; have each control re-derive** (e.g. `button.css` computes
  `--ui-button-height: calc(28px * var(--ui-scale))` itself instead of reading `--ui-height-md`) — rejected:
  pushes the multiply into *every* control (duplication → drift), and a control author who forgets silently
  breaks subtree scale for that control. The ramp exists to centralise the derivation.
- **JS-driven recompute** (observe `[scale]`/`[density]`, recompute tokens) — rejected: violates the pure-CSS,
  no-JS, no-`observedAttributes` sizing discipline (`geometry.md` / `plan.md` §8) and reintroduces the runtime
  style work the token system exists to avoid.
- **Keep `:root` and accept root-only scale/density** (no subtree theming) — rejected: directly contradicts
  ADR-0006's ratified subtree `[density]` smoke and `dimensions.css`'s own subtree promise; subtree theming is
  a required capability.
- **`html *` or `:where(*)`** — rejected: plain `*` is the simplest correct selector; `:where()` changes
  nothing (already `(0,0,0)`), and `html *` needlessly excludes the root element's own ramp.
