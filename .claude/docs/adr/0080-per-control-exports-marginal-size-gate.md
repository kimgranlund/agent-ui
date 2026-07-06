# ADR-0080 — per-control `exports` + the leave-one-out marginal size gate

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-05 |
> | **Proposed by** | planner — the G8 planning intake, realizing the ADR-0049 Amendment 1 booking |
> | **Ratified by** | Kim — 2026-07-05 |
> | **Repairs** | `packages/agent-ui/components/package.json` `exports` (build-time, gated on ratification) · `scripts/measure-size.mjs` (the marginal leg) · `controls/barrels.test.ts` (the drift gate) · `plan.md` §10 budgets paragraph (the marginal cap becomes a measured gate, not a descriptor note) · goals.md §G8 DoD line 3 |
> | **Supersedes / Superseded by** | Realizes the booking in ADR-0049 Amendment 1 · follows ADR-0040 (§3 manual-gate policy, unchanged) · relates ADR-0003 (packaging) |

## Context

ADR-0049 Amendment 1's measurement found the real consumer story (a single control ≈ 5 KB gz
foundation-inclusive, each additional control ~0.5–2 KB marginal, a realistic app 5–14 KB) — and the gap:
the package `exports` expose only `./components` (the whole self-defining family), so **no consumer can
reach those subsets through the public API**, and `npm run size` gates only the pathological all-controls
worst case (23 KB) plus the foundation barrel. The per-control ≤ ~2 KB "real cap" (plan §10) lives in
hand-written descriptor `# marginal:` notes, unmeasured by any gate. G8's DoD books exactly this: per-
control `exports` + a marginal measure of the eventual DISTRIBUTED footprint.

## Decision

1. **Explicit per-control public entries:** `"./controls/{name}": "./src/controls/{name}/{name}.ts"` —
   one entry per shipped control module, including `./controls/radio-group` → `radio/radio-group.ts`;
   compounds map to their family main module (importing `./controls/card` drags the region sub-elements
   because that is a real dependency — the honest tree-shake truth). `./components` (the family barrel)
   and all existing entries stay. Targets point at TS source today (the package is private); the map's
   shape is emit-ready — first publish flips targets to `dist/` + `.d.ts` (the §12 library-emit deferral).
2. **A three-way drift gate** (`barrels.test.ts` extension): exports map ↔ `controls/` folders ↔ the
   family barrel's `export *` lines must stay in bijection — a control added or removed unpaired fails,
   with a committed negative control proving the gate bites.
3. **The marginal measure is leave-one-out through the public entries:**
   `marginal(c) = gz(bundle(ALL entries)) − gz(bundle(ALL ∖ {c}))`. Deterministic, and it attributes
   shared infrastructure (bases, traits, kernel) to **no single control** — exactly the "what does adding
   this control cost an app already using others" semantics the ≤ ~2 KB cap means. `measure-size.mjs`
   additionally reports each entry's **solo absolute** (foundation-inclusive, the ~5 KB figure) as
   information, and keeps the existing foundation + family-ceiling legs unchanged.
4. **Budgets: default 2048 B gz per control**, with a pinned per-control override table in
   `measure-size.mjs` — overrides only with a cited reason (expect `text-field` — the 12-type family —
   and possibly `calendar` to need one; the builder measures actuals FIRST, then pins the table; breach
   exits 1).
5. **The gate stays MANUAL** (`npm run size`), per Kim's standing ADR-0040 §3 ruling — this ADR does not
   re-open that; the per-wave-checkpoint pattern (ADR-0040/0049) now checkpoints marginals too.

## Consequences

- The public API finally delivers the 5–14 KB consumer story the Amendment measured; the size gate
  measures what ships, not only the worst case. Descriptor `# marginal:` notes gain a reproducible source
  of truth (refresh on touch; no mass rewrite scoped).
- **Costs accepted:** ~N+1 Rolldown passes (≈26 bundles) make `npm run size` noticeably slower — tolerable
  for a manual gate; leave-one-out marginals shift when SHARED code moves between controls (a shared-trait
  extraction lowers several marginals at once) — the override table must be re-pinned on such waves, which
  is the per-wave checkpoint working as intended, not noise; 24+ explicit export entries are boilerplate —
  accepted over a pattern (see Alternatives) because explicitness is what the drift gate checks.
- Deep-importing `@agent-ui/components/src/...` remains possible for in-repo consumers; the exports map is
  the contract for external ones. **Stale → re-verify:** the descriptor `# marginal:` figures · plan §10's
  budget paragraph · ADR-0049's "no per-control public entry yet" clause (realized by this ADR).

## Acceptance

`npm run size` exit 0 printing per-entry marginal + solo columns against the pinned table; a planted
`budget: 1` proves exit 1; the drift gate bites on an unpaired entry; `npm run check && npm test` green;
tree-shake proof re-run through a public entry (importing `./controls/button` drags no calendar).

## Alternatives considered

- **Subpath pattern (`"./controls/*": "./src/controls/*/*.ts"`)** — rejected: Node's pattern expansion
  cannot map `{name}` → `{name}/{name}.ts` in one wildcard cleanly across tools, and a pattern silently
  admits any folder — the explicit map is itself the allowlist the drift gate verifies.
- **Pairwise-delta marginal (`gz(button + c) − gz(button)`)** — rejected: attributes shared traits/bases
  to whichever control is measured against the baseline; the figure changes with the baseline choice.
- **Solo-absolute as the gated number** — rejected: the ~5 KB foundation dominates every control's solo
  figure; regressions in a control's own code would hide inside it. Solo stays informational.
- **Wiring the marginal gate into `check && test`** — rejected without re-litigating: Kim ruled `size`
  manual (ADR-0040 §3); the recommendation to wire it remains recorded there, not here.
- **`./components/{name}` naming** — rejected: `@agent-ui/components/components/button` doubles the word;
  `./controls/{name}` matches the source layout and reads clean.
