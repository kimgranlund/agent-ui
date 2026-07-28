# Decision sheet — Kim's rulings (2026-07-28)

Companion to `synthesis-spine.md` + `synthesis-milestones.md`. Recommended option listed first.

## Q1 — Which milestone(s), what order?
- **(a) RECOMMENDED: M-B → M-C, with M-A's two contract forks (Q2, Q3-home) design-intaken in
  parallel** — repair the flagship live loop first, ship the already-decomposed dogfood arc
  second, and have M-A's ADRs ready when the build lane frees.
- (b) M-B → M-A — prioritize the SaaS/data bet over GenUI; M-C waits ratified-but-unbuilt.
- (c) M-C → M-B — dogfood first (most visible demo), personas stay broken meanwhile.
- (d) M-A alone — all-in on the data workbench; #314/#307 stay open user-facing defects.

## Q2 — The ui-table contract fork (blocks M-A P1; a ruled change either way)
- **(a) RECOMMENDED: mint an interactive tier** — new `ui-data-table` (or wrapper) carrying
  selection/sort; `ui-table`'s ADR-0004/LLD-C9 display-only contract stands untouched.
- (b) Widen `ui-table` itself — one control, but overturns its ratified display-only contract
  (`table.md`'s own SPEC-R1 comment) and touches every existing consumer's assumptions.
- (c) Pattern-tier only — toolbar+filter recipes over the static table, no selection/sort ever;
  cheapest, but leaves inv-6's #1 need (row selection) permanently homeless.
- (d) Defer the whole fork (drops M-A P1's core).

## Q3 — The 5 uncataloged newer components (command-modal, status-stream, toast, textarea,
theme-provider — no recorded decision either way; inv-2 §3.6)
- **(a) RECOMMENDED: one per-control decide-or-defer pass** — a single small slice recording
  catalog/defer per control with reasons (textarea is likely "yes", theme-provider likely
  "no — provider/context shape"), closing the silent gap.
- (b) Catalog all five now.
- (c) Defer all five, one dated roadmap line.

## Q4 — Chart-family scope (only load-bearing if M-A is picked)
- **(a) RECOMMENDED: defer, documented** — a stated "no line chart yet" stance (inv-6 §4 asks
  for exactly this OR expansion); M-A's dashboard demo composes bar+sparkline+stat.
- (b) Re-rule ADR-0107 now: add `ui-line-chart` to M-A's P1.

## Q5 — The ratification batch (unblocks work, not a strategy call — listed for one-pass flipping)
- **(a) RECOMMENDED: flip all three** — ADR-0161 (unblocks M-B P1), ADR-0162 (unblocks M-C S1+),
  ADR-0160 (record hygiene: the chat redesign is already merged; `proposed` misstates reality).
- (b) 0161 + 0162 only, hold 0160 for review.
- (c) Ratify only the picked milestone's ADR.

## Recommendation (one paragraph)
M-B first: it is the smallest bet, it repairs two open user-facing defects in the flagship
personas (#314/#307) that make every live demo of this project untrustworthy today, and its
core contract (ADR-0161) is already written to build-ready precision — ratification is the
only blocker. M-C second: ADR-0162's S0-S5 decomp is equally build-ready, it is the most
visibly differentiating demo the project can produce, and it shares no files with M-B so its
ratification can happen in the same batch. M-A is the largest and most strategic bet but is
gated on two genuine design forks (Q2, the extraction home) that deserve their own intake
rather than being rushed — run those intakes during M-B so M-A starts contract-frozen. The
DEV-only live-path ceiling (spine #5) is the one structural limit all three inherit; worth a
deliberate yes/no on scheduling it as its own arc at the next intake.
