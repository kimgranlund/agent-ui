# ADR-0040 — Bump the reactive+dom foundation-barrel consumer budget 6 kB → 7 kB (legitimate ADR-0023 public-API growth)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted — ratified 2026-06-30 on the green size gate (reactive+dom barrel 6180 B ≤ 7168; family 7707 B ≤ 8192; tree-shake proof green — legitimate ADR-0023 public-API growth, not a leak) |
> | **Date** | 2026-06-30 *(authored + ratified)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's ruling "bump the foundation barrel to 7 kB" (#102) |
> | **Ratified by** | orchestration-lead (on the green gate — `npm run size` within the new 7 kB budget) |
> | **Repairs** | `docs/plan.md §10` (the budget line: reactive+dom kernel `≤ ~6 kB` → `≤ ~7 kB`) · **shipped-script change**: `scripts/measure-size.mjs` (the `.` barrel budget `6 * KB` → `7 * KB`) — exec-owned · **records a recommendation**: wire `npm run size` into the standard gate so a budget regression FAILS rather than being silent. **Relates ADR-0023** (the `mount`/directive public-API growth that drove the size) + **ADR-0003** (the single-barrel size discipline / the `size` gate). |
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
