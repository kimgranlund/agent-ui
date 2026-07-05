# ADR-0049 — Family barrel budget re-based 16 → 22 KB gz (the ui-calendar + date/time picker growth) · → 23 KB (Amendment 1, the scroll-fade wave)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | orchestration-lead — on the Wave-5B size gate (the family barrel exceeded 16 KB after adding a whole new control). |
> | **Ratified by** | orchestration-lead — on the green functional gates (check + jsdom 1931 + cross-engine browser 514) + the re-based `npm run size` (family 19889 B gz within 22528). |
> | **Repairs** | `scripts/measure-size.mjs:25` (the family-barrel budget `16 → 22 * KB`). **Relates ADR-0040** (the foundation-barrel budget re-base — same precedent, same manual-gate policy) + ADR-0048 (the growth's cause: `ui-calendar` + date/time). |
> | **Supersedes / Superseded by** | None. **Follows ADR-0040** (the barrel-budget re-base pattern). |

## Context

Wave 5 completed the `ui-text-field` input family: multi-currency/unit/percent (ADR-0047) + the date/time
pickers with a **new `ui-calendar` control** (ADR-0048). Adding a whole control to the self-defining family
barrel legitimately grew it past the 16 KB gz ceiling (Wave-5A already nudged it to 16737; `ui-calendar` +
the date/time codec paths bring the total to **19889 B gz**). The family-barrel budget is the BUNDLE leg of
the tree-shake proof, not a per-consumer cap — real consumers tree-shake to only the controls they import.

## Decision

Re-base the family-barrel budget **16 → 22 KB gz** (`22528 B`), giving ~13% headroom over the 19889 B actual.

- **The per-control marginal (~2 KB gz, tracked in each `{name}.md` `# marginal:`) remains the real cap** —
  the family total is a soft sanity ceiling that the barrel "lands in the same ballpark as the foundation
  surface." This is unchanged from the ADR-0040 philosophy.
- **`size` stays a MANUAL gate** (not wired into `check && test` — Kim's ADR-0040 §3 ruling). Run `npm run size`
  by hand when touching `dom`/`reactive` or the bundle surface.
- **The `INEFFECTIVE_DYNAMIC_IMPORT` warning is expected + benign.** `calendar.ts` is dynamically imported by
  `text-field.ts` (the ADR-0048 lazy first-open convenience) AND statically by the family barrel
  (`controls/index.ts`, which self-defines every control). Rolldown correctly reports that in the WHOLE-FAMILY
  bundle the dynamic import creates no separate chunk — because the family barrel already contains calendar.
  This does NOT weaken the tree-shake proof for the GRANULAR case: importing `text-field.ts` alone does not
  pull calendar (its static graph excludes it — `tree-shake.test.ts` asserts this, and its negative control
  confirms the `import()` expression is invisible to the static crawler). The lazy import benefits the
  granular consumer; the warning only reflects the full-family measurement.

## Consequences

- One config line moves; no code change. The family barrel is green again at 19889 / 22528.
- The next control-adding wave re-bases again if it crosses 22 KB (the ADR-0040/0049 pattern) — a deliberate
  per-wave checkpoint, since a silent budget would let the family bloat unnoticed.
- **Stale → re-verify:** `measure-size.mjs` · the per-control `# marginal:` figures (each control's own gz).

## Alternatives considered

- **Leave the budget at 16 KB and treat `size` red as accepted** — rejected: a red gate that is "known and
  ignored" rots (the next real regression hides behind it). Re-base to a true, headroomed number instead.
- **Set a much looser budget (e.g. 32 KB)** — rejected: too loose stops catching regressions (2+ controls of
  bloat would pass). 22 KB tracks reality + one control of headroom; re-base again when genuinely needed.
- **Remove the lazy calendar import to silence `INEFFECTIVE_DYNAMIC_IMPORT`** — rejected: the dynamic import
  is load-bearing for the GRANULAR tree-shake case (import `text-field` alone → no calendar); the warning is
  only about the full-family bundle where calendar is a member anyway. Keeping it is correct.

## Amendment 1 — 2026-07-05 (re-base 22 → 23 KB; the container box-model + scroll-fade wave)

The container box-model + scroll affordance wave (ADR-0046 Amendments 2 & 3) added the cross-family
`traits/scroll-fade.ts` trait, pushing the all-controls family barrel to **22770 B gz** — 242 B over the 22 KB
ceiling. Re-base **22 → 23 KB** (`23552 B`), per the same per-wave-checkpoint pattern (ADR-0040/0049). **Kim
approved** after asking to "review the eventual distributed gzipped version" first.

That review (same Rolldown+gzip, measured per realistic consumer import, 2026-07-05): a **single control ships
~5 KB gz** (the shared dom+reactive+traits+base foundation, dragged in once); each **additional control ~0.5–2 KB
marginal** — a realistic app ships **5–14 KB** (a 4-control dashboard = 7.2 KB; a full form stack = 14.1 KB). The
22.6 KB family total is ONLY the pathological "define every control at once" case — which is exactly what this
ceiling measures. The scroll-fade trait's real contribution is ~155 B of shared infra, pulled in only when a
scrolling container is used.

**The finding that reframes the gate:** the package `exports` currently expose only `./components` (the whole
self-defining family), so a consumer cannot reach those 5–14 KB subsets through the public API — the bundler
tree-shakes individual control modules fine, but there is no per-control public entry yet. **Booked for
G8/publish** (goals.md G8 DoD): add per-control `exports` + gate the per-control MARGINAL (the ≤~2 KB "real cap"),
so `size` measures the eventual DISTRIBUTED footprint, not the all-controls worst case. Until then the
family-barrel ceiling stays the soft sanity check, re-based to 23 KB. `measure-size.mjs:26` (`22 → 23 * KB`).
