# ADR-0039 — The layout family standardizes on the box-alignment `align`/`justify` dialect (`start`/`end`, not `flex-start`/`flex-end`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted — ratified 2026-06-30 on the green gate (tsc · jsdom 1075 · browser 188; column/list normalized, the change verified a PROVABLE RENDER NO-OP in both Chromium + WebKit — no `*-reverse` mode is reachable so `start`≡`flex-start`/`end`≡`flex-end` in every reachable state; row/grid untouched) |
> | **Date** | 2026-06-30 *(authored + ratified)* |
> | **Proposed by** | planning-lead — the design seat, on the team-lead's #102 ruling (item 3: normalize the layout `align`/`justify` keyword dialect; direction = box-alignment) |
> | **Ratified by** | orchestration-lead (on the green gate; DoD right-sized to the anti-vacuous browser gate — a test-only + provable-no-op change needs no per-element reviewer council, the engines' computed box-alignment values + the no-op proof suffice) |
> | **Repairs** | `controls/column/column.css` + `controls/list/list.css` (`align`/`justify` repoints `flex-start`/`flex-end` → `start`/`end`) + their `*.browser.test.ts` (rendered alignment unchanged); `controls/row/row.css` is the **reference — unchanged**; `grid` is gap-only — unaffected. **Relates ADR-0030** (owns the `align` default VALUE `start`→`stretch` — UNTOUCHED; this owns the keyword DIALECT) + **ADR-0016** (direction is the tag, not a prop — bears on the reversal analysis below). |
> | **Supersedes / Superseded by** | None — a new fleet **convention** (no prior decision reversed; ADR-0030's default value stands). Distinct from ADR-0030 (default VALUE) — this is the keyword DIALECT, hence a new ADR not a 0030 amendment. |

## Context

The flex layout family (`ui-row` · `ui-column` · `ui-list`) maps the same author attributes `align` / `justify`
to CSS `align-items` / `justify-content` — but in **two different keyword dialects**:

- **`ui-row`** uses the **box-alignment** keywords: `align="start"` → `start`, `align="end"` → `end`
  (`row.css`; `justify` likewise → `start`/`end`).
- **`ui-column`** and **`ui-list`** use the **flexbox** keywords: `start` → `flex-start`, `end` → `flex-end`
  (`column.css:41,47`, `list.css:41,47`).

`ui-grid` is gap-only (no `align`/`justify` grammar) — outside this decision. Same author input, divergent CSS
output across the family — the "dialect drift" the #102 ledger flagged.

**Why this merits an ADR, not a silent edit:** `start`/`end` and `flex-start`/`flex-end` are **not synonyms** —
`start`/`end` are **writing-mode-relative** (box-alignment), `flex-start`/`flex-end` are **flex-flow-relative**.
They resolve identically in the default orientation but **diverge under a reversal** (`flex-direction: *-reverse`
or `flex-wrap: wrap-reverse`). So normalizing the keyword is a real semantic choice about reversed-layout
behavior, worth recording.

**Reachability (verified — the divergence is currently a no-op):** the family exposes **no reversal mode** today —
`wrap` is a **boolean** (`nowrap | wrap`; there is no `wrap-reverse` value — `column.css:35,91`), and
`flex-direction` is the **tag identity, not a prop** (no `row-reverse`/`column-reverse` — ADR-0016 cl.2). `ui-row`'s
only direction change is a responsive **row→column** flip (a container-query, not a *reversal*). So in **every
state the family can currently reach**, `start ≡ flex-start` and `end ≡ flex-end` — the normalization is a
**provable no-op** at render time. The dialect choice is therefore (a) **consistency/hygiene** now and (b)
**forward-insurance** if a reversal mode is ever added.

## Decision

The layout family **standardizes on the box-alignment dialect** (`start` / `end`).

1. **Normalize `ui-column` + `ui-list`:** `align`/`justify` repoint `flex-start` → `start`, `flex-end` → `end`.
   `ui-row` is the **reference — unchanged**. `ui-grid` (gap-only) is unaffected.
2. **Scope — only `start`/`end` change.** The other keywords are **dialect-identical** and stay verbatim:
   `center`, `stretch`, `baseline`, and the `justify` distribution forms `space-between` / `space-around` /
   `space-evenly` (verified: `row.css` and `column.css` already share these spellings). The mapping of the author
   tokens `between`/`around`/`evenly` → `space-*` is unchanged.
3. **Rationale for box-alignment over flexbox keywords:**
   - **Logical / writing-mode-relative** — aligns to the writing-mode start/end, the predictable, direction-
     stable behavior; the modern box-alignment model.
   - **Grid-`align`-compatible** — `start`/`end` are the shared CSS Box Alignment keywords for **both** flex and
     grid; if `ui-grid` ever gains `align`/`justify`, it uses the same dialect with no per-container translation.
   - **`ui-row` already uses it** — making row the reference minimizes churn (2 files: column, list; row: 0).
4. **`flex-direction` and the default VALUE are untouched.** `flex-direction` stays the tag identity (ADR-0016);
   the `align` default `stretch` for column/list (ADR-0030) is unchanged — this ADR moves only the *non-default*
   `start`/`end` repoint keywords.

## Consequences

- **`ui-column`/`ui-list` source reads in the box-alignment dialect**, identical to `ui-row` — one fleet dialect,
  greppable, no per-control translation. The family's `align`/`justify` grammar is now uniform.
- **Zero rendered change** — the `start`↔`flex-start` / `end`↔`flex-end` divergence is unreachable in the current
  API (no reversal mode), so the normalization is a behavioral no-op (the browser DoD must *prove* this — AC2).
- **Forward-ready** — if a reversal mode (`wrap-reverse`, a directional variant) is ever added, the family already
  has the layout-direction-stable box-alignment behavior; the dialect was pre-decided, not retrofitted mid-feature.
- **No supersession** — ADR-0030's default `stretch` and ADR-0016's tag-fixed direction both stand untouched.
- **Stale → re-verify (on ratify + build):** column.css / list.css (the repoints) + their browser tests; the
  component-reviewer C2/C6 re-pass for column/list; row/grid unaffected.

## Acceptance criteria

- **AC1 — source dialect.** `column.css` + `list.css` resolve `align="start"`/`"end"` and `justify="start"`/`"end"`
  to `start`/`end` (no `flex-start`/`flex-end` remains in either file); `center`/`stretch`/`baseline`/`space-*`
  unchanged; `ui-row` byte-unchanged.
- **AC2 — rendered no-op (the load-bearing proof).** Browser smoke (Chromium+WebKit): for column + list, each
  `align`/`justify` value renders the **same** geometry before and after the change across **every reachable
  state** — default orientation, `[wrap]` (boolean), and `ui-row`'s responsive row→column flip. (There is no
  `wrap-reverse`/`*-reverse` to exercise — its absence is itself asserted: `wrap` accepts only nowrap|wrap.)
- **AC3 — default preserved.** column/list `align` default stays `stretch` (ADR-0030); `justify` default stays the
  main-axis start.

## Slice plan (exec owns the control CSS; docs = this ADR)

- **S1 (exec) — normalize + lock.** `column.css` + `list.css`: `flex-start`→`start`, `flex-end`→`end` on the
  `align`/`justify` repoints; update `column.browser.test` + `list.browser.test` to assert the rendered no-op
  (AC2) + the source dialect (AC1). One file-disjoint slice (column/list + their tests; disjoint from the #102
  density legs on card/modal/tabs and the gz `.md` records).
- **S2 (docs, this ADR) — ratify-time:** if a layout reference doc enumerates the align dialect, note the
  box-alignment convention there; otherwise this ADR is the record.
- Gate: `npm run check && npm test` + the browser smoke (AC2). No app-markup migration (author-facing `align`/
  `justify` attribute values are unchanged — `start`/`end`/`center`/… stay the author vocabulary).

## Alternatives considered

- **Normalize to the flexbox dialect** (`ui-row` → `flex-start`/`flex-end`, 1 file) — rejected. Flex keywords are
  flex-specific (no grid-`align` reuse) and flex-flow-relative (the *less* predictable behavior under a future
  reversal); and it would change the reference primitive. Box-alignment is the forward-compatible target.
- **Leave the drift** — rejected. Same author attribute resolving to different CSS across the family is exactly the
  consistency debt #102 exists to clear; and it silently pre-commits column/list to flex-flow-relative reversal
  behavior with no record.
- **An ADR-0030 amendment** — rejected. ADR-0030 owns the default *value* (`start`→`stretch`); this is the keyword
  *dialect* — a distinct axis. A new ADR keeps the two concerns separately citable.
- **Introduce a reversal mode now to make the divergence observable** — out of scope (a feature, not a cleanup);
  the box-alignment choice future-proofs it without building it.
