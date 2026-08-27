# ADR-0049 — Family barrel budget re-based 16 → 22 KB gz (the ui-calendar + date/time picker growth) · → 23 KB (Amendment 1, the scroll-fade wave)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-01
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

## Amendment 2 — 2026-08-27 (restated at the current live figure, 23 KB → 70.5 KB; 23552 → 72192 B gz) — GH #1687

**This restates already-shipped reality; it rules nothing new** — the same shape as the
ADR-0030/0032/0033/0035 restatement amendments (`doc-standards` `adr-log-mechanics.md`'s "partial
supersession left unrestated" class): documentation catching up to a figure already merged and
reviewed elsewhere, not a fresh ruling. No `**proposed** — Kim ratifies` marker accompanies this
section — nothing here awaits ratification.

**The gap.** Amendment 1 above recorded the family barrel at 23 KB (23552 B gz, 2026-07-05).
ADR-0040 independently tracks the SAME row from its own vantage and has been re-based well past
that figure since, via `scripts/measure-size.mjs`'s own comment ladder alone (GH #1009 through
#1567) — none of those rungs ever reached this ADR. ADR-0049 is the more stale of the two: a drift
of roughly 47 KB (48640 B) against the live figure, only ONE rung of which (55 → 58 KB) was ever
caught anywhere outside the script comments, by ADR-0040's own 2026-08-16 amendment. Found via
`harness:decision-watcher`'s revalidation mode, firing 2026-08-27T18:00:00Z (this ADR's own claim
falsified against the live script value) — the second of two firings that also falsified ADR-0040
the day before (2026-08-26T22:05:00Z) via the identical root cause; that firing recommended filing
ONE ticket covering both, GH #1687.

**The current figure (verified at this amendment's writing).** `scripts/measure-size.mjs` has
carried the row at **70.5 KB = 72192 B gz** since GH #1567 (2026-08-21). Re-run live on `main` for
this amendment (2026-08-27): `npm run size` reports `@agent-ui/components/components (self-defining
ui-* family): 72063 B gz — within budget (72192 B gz)` — the script's figure has not drifted
further since #1567; GH #1687's cited value is still current.

**Filed alongside a matching restatement on ADR-0040** — GH #1687 covers both ADRs' identical root
cause in one ticket.

**Left open, not this amendment's scope.** The recurring-drift root cause itself —
`measure-size.mjs`'s ladder re-basing with no automatic feedback into the owning ADR(s) — is
unfixed by this restatement; GH #1687's Findings name it as a standing process follow-up.

No code changes accompany this amendment; the Status cell above stays `accepted`.
