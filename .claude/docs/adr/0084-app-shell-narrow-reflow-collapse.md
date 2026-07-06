# ADR-0084 — the app-shell narrow-reflow strategy: per-region `collapse` (hide | stack)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-06 |
> | **Proposed by** | planner — the M1 a2ui-live dogfood (LLD-C9) surfaced the composer-vanish; LLD §7.5 reserved this revisit |
> | **Ratified by** | Kim — 2026-07-06 |
> | **Repairs** | SPEC-R5 (`spec/agent-app-shell.spec.md`) · LLD-C4 / §7.5 (`lld/agent-app-shell.lld.md`) · the isolated `:host` mirror in LLD-C5 (keep-in-sync) — now NORMATIVE (ratified 2026-07-06) |
> | **Supersedes / Superseded by** | Resolves LLD §7.5's reserved narrow-reflow item. Relates ADR-0082 (the isolated `:host` grid variant must mirror this rule). No ADR superseded. |

## Context

The M1 base grid (LLD-C4) reflows narrow via `@container (inline-size < 40rem)`: the side regions (`navigation`, `complementary`) get `display:none`. That was the simplest starting rule (LLD §7.5 reserved it: "revisit if the reference app needs a nav toggle").

The a2ui-live dogfood (LLD-C9) hit the failure mode: the chat **composer** lives in a side region, and `display:none` makes the app's **primary input vanish** on a narrow container — the user cannot type. Hiding is right for a *secondary* rail (a nav strip, a supplementary aside) but wrong for a side region carrying essential, interactive content. The shell needs a way for a region to declare "I must stay reachable when narrow."

## Decision

We will make the narrow behaviour **(b) — the recommended option** — a **per-region opt-in** via a reflected `collapse` prop on `ui-app-shell-region` (options (a) and (c) weighed and rejected under Alternatives):
- **`collapse: 'hide' | 'stack'`**, default **`hide`** (today's behaviour — the region `display:none`s below the narrow threshold; back-compat).
- **`collapse="stack"`** — below the threshold the region **stays visible and stacks** into the single-column flow (full width, in DOM order) instead of hiding. It remains reachable and interactive.
- **`toggle`** is a **reserved** future value (a collapse-behind-an-affordance that emits the allow-listed `toggle` event) — named now, NOT built at M1 (it is a stateful affordance, a feature, not the fix this ADR owns).

The wide-desktop layout is **unchanged** — `collapse` only affects the `@container` narrow branch. The rule lands in **both** grid copies (the base `@scope` sheet AND the injected isolated `:host` mirror, ADR-0082 keep-in-sync).

a2ui-live's composer then authors `collapse="stack"` (with the ADR-0083 landmark) and stays reachable narrow; the nav/secondary regions keep the default `hide`.

**Refinement 2026-07-06 (C9 dogfood — in-intent; status unchanged).** The narrow `stack` rule ALSO sets `inline-size: auto; margin-inline: 0;` so it robustly delivers the full-width span already ratified above. `grid-column: 1 / -1` stretches the track, but an explicit `inline-size` on the region wins over grid-stretch — the common case for stack-worthy rails (a composer/sidebar authored at a fixed wide width) — so the region silently did NOT span. Neutralizing the region's explicit width + inline margins inside the narrow branch **delivers, not changes,** the ratified full-width-span contract, and lets consumers drop their own narrow-width workarounds. **Residual limit:** a stack region capped with `max-inline-size`/`min-inline-size` still needs the consumer's own narrow override — the shell cannot neutralize every sizing property without `!important`, which would be un-fleet-like. **Keep-in-sync:** this rule lives in BOTH `app-shell.css` and the isolated `app-shell-isolation.css` mirror (the standing ADR-0082 obligation).

## Consequences

- **Surgical + back-compatible** — default `hide` preserves today's behaviour for every existing region; only a region that opts into `stack` changes. No migration; the wide layout is byte-equivalent.
- **The author controls the stack order** — a stacked region flows in DOM order into the single column; the author orders the children (e.g. composer last) — documented, the same responsibility as region composition today.
- **Keep-in-sync cost** — the `collapse="stack"` `@container` rule must exist in BOTH the base `app-shell.css` and the isolated `:host` variant (LLD-C5), or the isolated narrow layout drifts. This is the standing ADR-0082 keep-in-sync obligation, now with one more rule; the LLD flags it at both copies and the browser gate (isolated-layout leg) covers it.
- **Descriptor + gate cost** — `collapse` is a reflected attribute, so it adds a row to `app-shell-region.md` `attributes[]` (or the contract↔props trip-wire / family-coherence gate reddens). One descriptor entry + one browser leg; marginal, same class of cost as ADR-0083's `landmark`.
- **Extensible without churn** — `collapse` as an enum reserves `toggle` for a later stateful-affordance enhancement without a second prop or a breaking change.
- **A new browser leg** — SPEC-R5 gains a cross-engine assertion that a `collapse="stack"` region stays visible (non-zero box) when narrow while a `collapse="hide"` region is `display:none`, with a biting negative control (drop the `stack` rule → the region hides).

## Alternatives considered

- **(a) A nav-toggle affordance** (the region collapses behind a toggle button, emits `toggle`) — rejected for M1: it is the richest UX but the heaviest — a new stateful control, focus management, an open/close signal, extra browser legs. It is a *feature*, not the fix; reserved as the future `collapse="toggle"` value, not built now.
- **(c) Stack ALL regions when narrow** (what the old bespoke a2ui-live did) — rejected: it changes the default for every consumer, so a genuinely-secondary rail (meant to collapse away) would always stack and clutter the narrow view. Less controllable than a per-region opt-in.
- **A boolean `persist`/`keep-when-narrow`** — rejected in favour of the `collapse` enum: a boolean captures only hide-vs-stack and cannot grow to `toggle` without a second, overlapping prop; the enum is the same cost today and extensible.
- **Leave `display:none`; tell authors not to put inputs in side regions** — rejected: it forbids a natural, common layout (chat composer in a side column) and ships the a2ui-live composer-vanish defect.
