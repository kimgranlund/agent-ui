# ADR-0040 — Bump the reactive+dom foundation-barrel consumer budget 6 kB → 7 kB (legitimate ADR-0023 public-API growth)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-30 *(authored + ratified)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's ruling "bump the foundation barrel to 7 kB" (#102) |
> | **Ratified by** | orchestration-lead (on the green gate — `npm run size` within the new 7 kB budget) |
> | **Repairs** | `.claude/docs/plan.md §10` (the budget line: reactive+dom kernel `≤ ~6 kB` → `≤ ~7 kB`) · **shipped-script change**: `scripts/measure-size.mjs` (the `.` barrel budget `6 * KB` → `7 * KB`) — exec-owned · **records a recommendation**: wire `npm run size` into the standard gate so a budget regression FAILS rather than being silent. **Relates ADR-0023** (the `mount`/directive public-API growth that drove the size) + **ADR-0003** (the single-barrel size discipline / the `size` gate). |
> | **Supersedes / Superseded by** | None — a budget RE-BASE (the `≤ ~6 kB` figure in plan §10 / measure-size.mjs was flagged "provisional, confirm with a `size` script"). The shrink-only ratchet ABOVE the new floor stands. |

## Context

The reactive+dom **foundation barrel** (`@agent-ui/components` `.` = `src/index.ts` — the full reactive+dom
surface a foundation consumer pulls) carried a **`≤ ~6 kB` gz** consumer budget (`plan.md §10`,
`measure-size.mjs:22` `6 * KB` = 6144 B). That figure was explicitly **provisional** ("confirm with a `size`
script", plan §10).

The barrel now measures **6180 B gz** (17523 B min) — **36 B over** the 6144 budget. The growth is **legitimate
public-API surface**, not bloat or a leak: **ADR-0023** made the dom layer's imperative-render API public —
`mount(result, container, ctx?)` (the imperative host the a2ui renderer needs) + the **directive-authoring trio**
`Directive` / `directive` / `NO_COMMIT` (+ `RenderContext` / `DirectiveResult` types), alongside the shipped
`repeat` / `watch` directives (`dom/index.ts:13-30`). These are deliberate, consumer-required exports — the
private wiring (`render` / `html` / `ChildPart`) stays internal.

Kim ruled: **bump the foundation barrel to 7 kB.**

## Decision

**Re-base the foundation-barrel consumer budget 6 kB → 7 kB** (6144 → **7168 B gz**) in `measure-size.mjs` and
`plan.md §10`.

1. **The bump is justified, not a leak.** The barrel is **6180 B gz** — within the new 7168 budget with **~988 B
   headroom** for the next legitimate dom additions. The growth traces to **ADR-0023's public API** (mount +
   directive-authoring), which the imperative consumer (the a2ui renderer) requires; it is not removable without
   cutting that contract. The **tree-shake proof stays green** — importing one control drags only it + its real
   deps (`tree-shake.test.ts`); the foundation exports are intentional public surface, not accidental
   re-exports.
2. **The other budgets + the ratchet are UNCHANGED.** The `components` self-defining family barrel stays `≤ 8 kB`
   (`measure-size.mjs:23`); the per-control marginal stays `≤ ~1.5–2 kB` (plan §10); the **keep-all,
   shrink-only ratchet** holds **above the new 7 kB floor** — this re-bases the floor once for a recorded
   public-API reason, it does not loosen the ratchet.
3. **Recommendation (recorded, separate action — NOT done here): wire `npm run size` into the STANDARD gate.**
   Today the gate is `npm run check && npm test`; `npm run size` is a **separate manual run**
   (`measure-size.mjs:3`), so a barrel creeping over budget between manual runs is **invisible** — exactly how
   this 36 B overage went unnoticed until a deliberate check. The durable fix is a `gate`/`verify` npm script =
   **`check && test && size`** so a regression FAILS fast. **This implies updating the CLAUDE.md "Always: run
   `npm run check && npm test` green" doctrine** (→ add `size`) — a **proposed follow-up requiring Kim's explicit
   nod**, which this ADR deliberately does **NOT** apply: it changes **no** CLAUDE.md or gate config (a
   doctrine/config change is the user's call, not an ADR side-effect). The budget bump is the immediate fix; the
   gate-wiring + the doctrine update are the durable follow-up, held for Kim.

## Consequences

- **The foundation barrel has ~1 kB headroom** at a budget that reflects the post-ADR-0023 public surface; the
  next dom addition has room and a true ceiling.
- **The size ratchet stays shrink-only above 7 kB** — the re-base is a one-time, ADR-recorded floor move (the
  provisional figure made real), not a precedent for creep.
- **If the `size` gate is wired in (the recommendation),** budget regressions stop being silent — the class of
  "drifted over budget, nobody noticed" defect is closed at the gate, not by periodic manual runs.
- **Stale → re-verify (on ratify + build):** `measure-size.mjs` (the `7 * KB`) + `npm run size` green · `plan.md
  §10` (the `≤ ~7 kB` line) · (optional) the gate wiring.

## Acceptance criteria

- **AC1 — budget re-based + green.** `measure-size.mjs` declares the `.` barrel budget `7 * KB` (7168 B gz);
  `npm run size` reports the `.` barrel **within** budget (currently **6180 B gz** ≤ 7168). The `components`
  barrel budget (8 kB) is unchanged and still within.
- **AC2 — plan reconciled.** `plan.md §10` reads "reactive+dom kernel `≤ ~7 kB` consumer" (was `≤ ~6 kB`).
- **AC3 — no leak (the bump is real growth, not bloat).** The tree-shake proof is green — importing one control
  drags only it + real deps; the foundation barrel exports are the deliberate ADR-0023 public set, nothing
  accidental.

## Slice plan

- **S1 (exec) — `measure-size.mjs`:** `6 * KB` → `7 * KB` for the `.` barrel; self-gate `npm run size` green.
  *(Unblocks #46 — the Wave-B per-control marginals, already written, gate clean against the re-based budget.)*
- **S2 (planning-lead, this ADR) — docs:** `plan.md §10` budget line (`≤ ~6 kB` → `≤ ~7 kB`, cite this ADR) +
  this ADR.
- **S3 (recommended follow-up, separate — NEEDS KIM'S NOD, not done here):** a `gate`/`verify` npm script =
  `check && test && size` + the matching CLAUDE.md "Always" doctrine update (→ add `size`). Held for Kim's
  explicit go; this ADR/wave changes **no** CLAUDE.md or gate config.
- Gate: `npm run size` green at 7 kB (the host ratifies on it).

## Alternatives considered

- **Keep 6 kB and shrink the barrel to fit** — rejected. The 36 B overage is **legitimate public API** (ADR-0023's
  mount + directive-authoring, required by the a2ui renderer); shrinking it would mean cutting a shipped contract.
  The budget was provisional and is now confirmed against the real surface.
- **A tighter bump (e.g. 6.5 kB)** — rejected. Kim ruled 7 kB; the clean kB boundary leaves ~1 kB headroom for the
  next dom addition without re-litigating the budget per-feature, and keeps the ratchet meaningful (shrink-only
  above a stable floor).
- **Split the foundation barrel** (separate reactive vs dom budgets) — rejected as over-engineering; the `.`
  barrel is the single coherent surface a foundation consumer pulls (measure-size.mjs:8), and splitting it would
  complicate the consumer story for a 36 B overage.
- **Leave `size` a manual run** — rejected as the durable answer (kept only as the *immediate* step). A silent
  ratchet is how the overage hid; the recommendation (S3) wires it into the gate.

## Amendment (2026-08-16, **proposed** — Kim ratifies) — the `components` family-barrel row re-based 55 KB → 58 KB (56320 → 59392 B gz; measured 58485 B gz on main@0a6df860) — GH [#1009](https://github.com/kimgranlund/agent-ui/issues/1009)

> Append-only, and **proposed**: the Status cell reads `accepted` for the record as a whole and stays
> byte-untouched — agents never flip status (`.claude/hooks/adr-status-guard.py`), and this amendment
> carries no ratification of its own until Kim gives one (`ratify ADR-0040 amendment`, executed by
> `scripts/adr_ratify.py`'s amendment mode, GH #664). Every accepted section above — Context, Decision
> cl.1–cl.3, Consequences, AC1–AC3 — is unedited. GH [#1009](https://github.com/kimgranlund/agent-ui/issues/1009)
> is the durable record; Kim's in-chat ruling is recorded in `.claude/ops/rulings.md` ("ADR-0040 +
> ADR-0008 — RULED 2026-08-16"): *re-base the budget line to the measured value via a PROPOSED
> ADR-0040 amendment* — this ONE row, nothing else (the scope note under cl.A1 records what the same run
> also reports and deliberately leaves alone).

**Why this lands on ADR-0040.** cl.2 above named the self-defining `components` family barrel
(`src/controls/index.ts`) at "≤ 8 kB, unchanged" and drew the law every later re-base of that row has
followed: a re-base is a **one-time, recorded floor move for real, reviewed weight — a CHECKPOINT, not a
ratchet** (the shrink-only ratchet holds above the new floor; GH #455 is the standing shrink follow-up).
That row has since been re-based eleven times by Kim rulings recorded only in `scripts/measure-size.mjs`'s
own comment ladder (23 KB → … → 55 KB, the last on 2026-08-12, GH #751). Kim's 2026-08-16 ruling routes
this one through ADR-0040 itself, so the barrel-budget re-base record has a durable home in the ADR log,
not only in a script comment.

**cl.A1 — the ruling (GH #1009): family barrel 55 KB → 58 KB.** `npm run size` on main@0a6df860
(2026-08-16, `npm ci` fresh, Rolldown minify + gzip level 9) reports the row at **58485 B gz (219733 B
min) — OVER budget (56320 B gz)** by **2165 B**. The line is re-based to **58 KB = 59392 B gz** — the
measured 58485 plus **907 B (~1.5 %) stated headroom**, the same clean-KB-boundary + small-margin shape
as the 2026-08-08 (53 → 54 KB) and 2026-08-12 (54 → 55 KB) rungs (57 KB = 58368 would already be under
the measured value, so 58 KB is the lowest clean-KB line that covers it). The ruling was recorded against
"312 B over" (56632 B gz at `f6ef3096`); the first draft of this amendment measured 398 B over (56718 at
`f1c06fd1`) and proposed 56 KB; the 2026-08-16 board-clear then merged two more movers (#1018, #1020)
before this amendment could land, so the "measured value" the ruling names is 58485. Attributed by
checking out each mover and re-measuring this same barrel in place (the GH #354 convention); the ladder
reconciles to the byte (55574 + 2911 = 58485):

| commit | wave | family barrel B gz | Δ |
|---|---|---|---|
| `eb82ca62^` | baseline after the 2026-08-12 re-base (GH #751 measured 55564) | 55574 | — |
| `eb82ca62` | ui-card-header format=structured (ADR-0186, #817) | 55607 | +33 |
| `154505d1` | ui-drawer S1 mint (ADR-0188) + the #822/#838/#861 fixes | 55702 | +95 |
| `4935ef20` | drawer content layout (#919) + the 2026-08-14 fix wave (#874 #910 #911 #915 #916, S2/S3) | 55777 | +75 |
| `6356d4a1` | drawer scroll-fade mask fix + Manage-agents redesign (#922) | 55807 | +30 |
| `076790d3` | `overlay()` CSS anchor-positioning progressive enhancement (#973) — **the mover that crossed the 56320 line** | 56530 | **+723** |
| `282f0d55` | ui-swiper CSS-native candy (#983) | 56632 | +102 |
| `093e78f9` · `d2ba05a2` · `f6ef3096` | view-transition names (#984) · pendingComputed (#988, the "+0 B from #974" the ruling recorded) · rulings commit | 56632 | +0 (the ruling's "312 B over" figure = 56632 − 56320) |
| `ab81d0bc` | ui-select internal parts survive `replaceChildren()` (#994/#1011) | 56718 | +86 |
| `380e74c1` · `f1c06fd1` | list-reorder trait (#952/#1013 — +0 B, as the ruling recorded) · site recipe (#1014) | 56718 | +0 |
| `ab9b360d` · `5706b7e5` | scroll-spy trait (#964/#1015 — not pulled by the barrel) · the ADR-0008 swiper dim revert (#1010/#1016 — CSS/test/doc only) | 56718 | +0 (measured at `5706b7e5`) |
| `decbb4f7` | ui-drill N-level drill-down container mint (#954/#1018, ADR-0195 proposed) — **the mover that crossed the 57344 (56 KB) line** | 58153 | **+1435** |
| `9be3b374` | pendingComputed AbortSignal per generation (#1003/#1019 — a trait, not pulled until consumed) | 58153 | +0 |
| `86e80f9c` | status-stream as the first `pendingComputed` consumer + `:state(pending)` (#999/#1020, ADR-0191 booked repairs) | 58485 | +332 |
| `830ea612` · `1773c7c6` · `0a6df860` | settings listener fix (#1004/#1023) · dialog-polyfill lift (#1006/#1024, test-only) · empty-state row / skill trim / app memory-store adapter (#1025 #1026 #1027 — none touch `components/`) | 58485 | +0 |

Every rung is reviewed, merged weight (two new controls, an overlay-wide progressive enhancement, a
ruled ADR-0191 repair, fixes), not a gzip-dictionary artifact and nothing to shave; the per-control leg
(T5, ADR-0080) stays the real gate and every control's marginal is unchanged by this re-base. Same law as
every rung above: a CHECKPOINT, not a ratchet — GH #455 remains the standing shrink follow-up.

**Scope — observed on the same run, deliberately NOT re-based here (Kim's ruling is this one row).** The
same `npm run size` on main@0a6df860 also reports two sibling rows over: the `status-stream` per-control
marginal override (**2736 B gz vs 2710** — the row #1020 itself set from a pre-merge 2707 measurement;
26 B) and the `@agent-ui/app` marginal (**104175 B gz vs 102400**; the ladder 102459 at `f1c06fd1` →
103617 after #1018 → 103919 after #1020 → 103915 after #1023 → 104175 after #1027 — the app composes
the family, so the same movers land here, plus its own). Both are pre-existing on main, outside this ruling's literal scope, and left red on purpose: each
is its own recorded ruling when it comes (GH #468 stays the standing app-diet follow-up); this amendment
mints nothing for them. cl.A1 alone therefore does NOT make the gate exit 0 — the ONE row it names reads
within budget on the carrying commit; the remaining red is exactly those two rows.

> **Note (2026-08-16, GH [#1031](https://github.com/kimgranlund/agent-ui/issues/1031)) — those two rows
> got their own recorded ruling the same day:** re-base to measured (Kim's standing precedent on the
> family-growth drift class). `scripts/measure-size.mjs` now carries `status-stream` at **2736 B gz**
> (was 2710; measured 2736) and the `@agent-ui/app` marginal at **102 KB = 104448 B gz** (was 100 KB;
> measured 104175, rounded up to the next whole KB per that file's convention — 273 B headroom, a
> checkpoint not a ratchet; GH #468 stays the app-diet follow-up). Combined with cl.A1 above, `npm run
> size` exits 0 again. This note appends; nothing above is rewritten.

**Observed, not re-based (🟡 for the next dom addition).** The `.` foundation barrel — the row this ADR
originally re-based — measures **7659 B gz (21611 B min) against 7680 B gz**: within, with **21 B** of
headroom. The next `dom/`/`reactive/` addition of any size trips it; that re-base is its own recorded
move when it comes (Consequences above: "the next dom addition has room and a true ceiling" no longer
holds — recorded here so it is not a surprise).

**Repairs (shipped WITH this amendment, in the same commit — nothing owed on ratification):**
`scripts/measure-size.mjs` (the family row `55 * KB` → `58 * KB` + a comment citing this amendment;
no other constant touched) · `.claude/docs/plan.md §10` (the "family barrel ≤ 8 kB" line — stale
through eleven re-bases — now points at the live ledger + this amendment). Ratification flips this header
only; the Status cell above stays `accepted`.

**Acceptance (checkable at ratification):** on the commit that carries this amendment, `npm run size`
reports the `@agent-ui/components/components (self-defining ui-* family)` row **within budget** (58485 B
gz against 59392), and any remaining red is ONLY the two out-of-scope rows named under Scope; the header
above reads `**ratified**` only via `adr_ratify.py` amendment mode on Kim's `ratify ADR-0040 amendment`;
`npx vitest run site/lib/adr.test.ts site/lib/docs-grammar.test.ts` green.
