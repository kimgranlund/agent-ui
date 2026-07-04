# ADR-0038 — Control sizing is Kim's explicit (scale × size) → §1-row lookup (no multipliers; `--ui-scale` leaves the control path)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-30 *(authored + ratified)* |
> | **Proposed by** | planning-lead — deriving the per-cell geometry + the supersession from **Kim's authoritative `(scale × size) → height` table** (Kim ruled *"let's not use multipliers"* and provided the mapping directly) |
> | **Ratified by** | orchestration-lead (on the browser gate). **The mapping is Kim's** — the `content-sm≡ui-md` / `content-md≡ui-lg` overlap is **final**, ratified by Kim's *"we proceed"* on the authoritative table (4 distinct registers across 6 tier names, by design). |
> | **Repairs** | **shipped-token change**: `shared/src/tokens/dimensions.css` (`--ui-{height,font,icon}-{sm,md,lg}` become **explicit per-`[scale]`-tier tables** from Kim's rows; `× var(--ui-scale)` leaves the control path; `--ui-scale` retained for `--ui-type-*` display only) + `dimensions.test.ts` · `references/geometry-sizing-spec.md §1/§3` + `references/geometry.md` (the size ramp is the §1 table **selected** by scale×size) · `button.css`/`text-field.css` read the tokens (values change upstream) · **SUPERSEDES the multiplier mechanism of ADR-0007 (control leg) + ADR-0032; FOLDS ADR-0037; re-tables ADR-0035's non-default font/icon values** |
> | **Supersedes / Superseded by** | **Supersedes the CONTROL-RAMP leg of ADR-0007** (`* { … × var(--ui-scale) }` → explicit `:root`+`[scale]` re-tables, the #25 `--ui-compact` / ADR-0035 pattern; ADR-0007's **display** `--ui-type-* × --ui-scale` leg STANDS). **Supersedes ADR-0032's multiplier ladder for CONTROLS** (the `0.875…1.75` multipliers no longer size controls; the `[scale]` tier **names** stay as row-selectors; the `--ui-scale` **values** survive for display). **Folds ADR-0037** (the multiplier-SNAP height table — proposed/unbuilt — replaced by Kim's hand-authored lookup). **Re-tables ADR-0035** (explicit-table MECHANISM stays; non-default **font/icon VALUES** re-derived from Kim's rows — 6 font + 6 icon cells move; default unchanged). **Relates ADR-0025/0033** (`--ui-type-*` display stays linear `× --ui-scale` — the only surviving `--ui-scale` consumer). |

## Context

Control sizing has been a **multiplier**: `[scale]` set a numeric `--ui-scale` (ADR-0032's `0.875…1.75`
ladder, ADR-0007's `*`-declaration), and `--ui-{height,font,icon} = base × var(--ui-scale)` (ADR-0033/0035
then snapped the result to §1 rows; ADR-0037 extended the snap to height).

Kim ruled **"let's not use multipliers"** and **provided the authoritative `(scale × size) → height`
table directly** (below). Every value is a §1 master-row height, so each cell's font/icon/caret/gap/pad
**derive** from that one row — height and glyphs are mutually consistent (the thing the multiplier broke).
This **supersedes ADR-0037** (the snap is overtaken by Kim's hand-authored map) and **removes `--ui-scale`
from the control path**.

## Decision

Control sizing is **Kim's explicit `(scale × size)` → §1-row lookup**. `[scale]` re-tables
`--ui-{height,font,icon}-{sm,md,lg}` to Kim's chosen §1 row values (the ADR-0035 / `--ui-compact`
re-table mechanism, now covering **height** too); `[size]` selects sm/md/lg. Descendants inherit the
re-tabled tokens, so subtree `[scale]` works **without** `--ui-scale` (the `--ui-compact` proof,
ADR-0032/#25).

1. **The mapping — KIM'S TABLE (verbatim).** Each cell is **one** §1 row; height/font/icon/caret/gap/pad
   all derive from it. Default (`ui-md`) byte-identical (python-verified).

   | `[scale]` ↓ / `[size]` → | **sm** | **md** | **lg** |
   |---|---|---|---|
   | **ui-sm** | 20 | 24 | 28 |
   | **ui-md** *(default)* | 24 | 28 | 36 |
   | **ui-lg** | 28 | 36 | 48 |
   | **content-sm** | 24 | 28 | 36 |
   | **content-md** | 28 | 36 | 48 |
   | **content-lg** | 36 | 48 | 64 |

   **Derived (each cell's §1 row — `h → f/i`, `caret=f`, `gap=f/2`, `value-pad=h/2`, `slot-pad=½(h−i)`):**
   `20→f12/i14`, `24→f13/i16`, `28→f14/i18`, `36→f16/i20`, `48→f18/i24`, `64→f20/i28`.
   **FONT** — ui-sm `12·13·14` · ui-md `13·14·16` · ui-lg `14·16·18` · content-sm `13·14·16` ·
   content-md `14·16·18` · content-lg `16·18·20`.
   **ICON** — ui-sm `14·16·18` · ui-md `16·18·20` · ui-lg `18·20·24` · content-sm `16·18·20` ·
   content-md `18·20·24` · content-lg `20·24·28`.

2. **Default preserved.** `ui-md` → 24·28·36 / font 13·14·16 / icon 16·18·20 — byte-identical.
3. **Kim's band structure (the design intent).** The `content-*` band is the `ui-*` band **shifted up one
   §1 row** — each tier is a contiguous 3-row §1 window:
   ui-sm `{20,24,28}` · ui-md `{24,28,36}` · ui-lg `{28,36,48}`; content-sm `{24,28,36}` · content-md
   `{28,36,48}` · content-lg `{36,48,64}`. So **`content-sm ≡ ui-md`** and **`content-md ≡ ui-lg`** — the
   six `[scale]` names render **4 distinct registers**. Each band is internally monotonic per size; the two
   bands overlap by design (selecting `content-sm` renders exactly `ui-md`; `content-md` exactly `ui-lg`)
   and only `content-lg` exceeds the ui band. *(This overlap is the one item Kim is confirming — the
   team-lead is checking; build to this table meanwhile.)*
4. **Font/icon are RE-DERIVED — they MOVE from ADR-0035 (key scope point).** Same-row consistency means
   Kim's rows re-pick font/icon too: **6 font + 6 icon non-default cells change** (python-verified). Notably
   the **content-sm/md glyphs get SMALLER** (content-sm sm font `16→13`, content-md sm `16→14`) — because
   in Kim's design content-sm/md **equal the ui-md/ui-lg defaults**, not the bumped multiplier tiers
   ADR-0035 had; and **ui-lg glyphs get LARGER** (md font `14→16`, lg `16→18`). All remain §1-set integers;
   the default column is unchanged. ADR-0035's *"font/icon tables stay"* can **not** hold — Kim's rows
   define new font/icon. *(Confirm Kim accepts the non-default font/icon shift — it follows from her table.)*
5. **`--ui-scale` leaves the control path; survives for display only.** Controls read the explicit tables —
   no `× --ui-scale`. `--ui-type-*` (display, the ADR-0025/0033 ruled-**linear** fork — no box, wants
   continuous presence) keeps `× var(--ui-scale)`; `[scale]` still sets `--ui-scale` to its tier value for
   that one consumer. So the `0.875…1.75` ladder + ADR-0007's `*`-declaration survive **for display only**.
   Display untouched (Kim's directive is controls). *(A future ADR could make display explicit too — flagged,
   not done.)*

## Consequences

- **Control height/font/icon render Kim's §1 integers** per cell — one consistent row, default
  byte-identical, no multiplier decimals.
- **Kim's deliberate band overlap:** `content-sm ≡ ui-md`, `content-md ≡ ui-lg` — 6 `[scale]` names → 4
  rendered registers. Surfaced for the record (Kim confirming).
- **A real font/icon shift (clause 4):** 6 font + 6 icon non-default cells move — content-sm/md **down**
  (they equal the ui defaults now), ui-lg **up**. Default surfaces unchanged. Broader than ADR-0037.
- **Shared cells by rendered height** (18 cells, 6 used rows — heavy sharing is inherent; rows 16·18 unused,
  forward-ready): 24 = {ui-sm/md, ui-md/sm, content-sm/sm}; **28 = {ui-sm/lg, ui-md/md, ui-lg/sm,
  content-sm/md, content-md/sm}** (5); **36 = {ui-md/lg, ui-lg/md, content-sm/lg, content-md/md,
  content-lg/sm}** (5); 48 = {ui-lg/lg, content-md/lg, content-lg/md}; 20 = {ui-sm/sm}; 64 = {content-lg/lg}.
  Monotone lattice — coincidences are *larger size + smaller scale* equivalences.
- **`--ui-scale` narrows to one consumer** (`--ui-type-*`); the control token layer loses a `var()`
  indirection (explicit, greppable, like `--ui-compact`).
- **Stale → re-verify (ratify + build):** dimensions.css (3 tables + `--ui-scale` scope) + test ·
  geometry-sizing-spec §1/§3 · geometry.md · the browser smoke · the ADR markers.

## Resolved (Kim ratified the mapping 2026-06-30 — "we proceed")

- **The content-band overlap (clause 3) — CONFIRMED INTENDED.** `content-sm ≡ ui-md`, `content-md ≡ ui-lg`
  is the deliberate shift-by-one-row ladder; **no mapping change**. Kim's table is locked/authoritative.
- **The non-default glyph shift (clause 4) — accepted** (follows from Kim's ratified rows; 6 font + 6 icon
  cells move, content-sm/md smaller, ui-lg larger; default unchanged).
- **`--ui-scale` → display only (clause 5) — confirmed** (the team-lead's brief: `--ui-type-*` display
  stays on `--ui-scale`, untouched). A future ADR could make display explicit too — not now.

## Acceptance criteria (browser-measurable)

- **AC1 — Kim's table renders.** Sampled `(scale × size)` cells render the exact clause-1 height/font/icon
  integers (e.g. `content-lg×lg` → 64/20/28; `ui-lg×md` → 36/16/20; `content-sm×sm` → 24/13/16 — i.e.
  identical to `ui-md×sm`).
- **AC2 — byte-identical default.** No `[scale]` / `ui-md`: sm/md/lg → 24·28·36 / font 13·14·16 / icon
  16·18·20.
- **AC3 — consistency (one row).** Each sampled cell's height, font, icon belong to the **same** §1 row.
- **AC4 — overlap holds.** `content-sm` renders identically to `ui-md`; `content-md` identically to `ui-lg`
  (Kim's design — asserts the overlap is real, not drift).
- **AC5 — `--ui-scale` gone from controls.** A control's computed height shows no `--ui-scale` dependence;
  the multiplier decimals (24.5/49/63) are absent.
- **AC6 — display still scales.** `--ui-type-*` (ui-text) still scales `× --ui-scale` linearly under `[scale]`.
- **AC7 — subtree inheritance.** A nested `[scale]` re-tables its subtree without `--ui-scale`.

## Supersession / marker — EXECUTED (Kim ratified the mapping 2026-06-30; append-only "revise history")

All the "revise history" doc work is **done** (the token build is the only remaining step — tok-mono S1):

- **ADR-0037** → **superseded by ADR-0038 before build** (status marked; proposed/unbuilt, overtaken). ✓
- **ADR-0007** → control-ramp `*`×`--ui-scale` leg marker flipped to **ADR-0038** (the whole control ramp →
  explicit `:root`+`[scale]` tables); the display `--ui-type-*` leg STANDS. ✓
- **ADR-0032** → marked: the `0.875…1.75` multiplier ladder no longer sizes controls (ADR-0038); the
  `[scale]` tier NAMES + the `--ui-scale` VALUES survive (display only); `--ui-compact-*` unaffected. ✓
- **ADR-0033/0035** → markers flipped to ADR-0038 (was citing 0037): the explicit-table mechanism + the
  pow→§1 lineage stay; `× --ui-scale` framing removed; font/icon values re-tabled by Kim's rows. ✓
- **geometry-sizing-spec §1.1/§3 + geometry.md** → reconciled: the size ramp is the §1 table **selected** by
  `(scale × size)` (Kim's lookup), no multiplier; the multiplier/pow framing kept only as marked history;
  `--ui-type-*` display stays `× --ui-scale`. ✓
- **README** index rows updated (0007/0032/0033/0035 marker notes + the 0037/0038 rows). ✓

## Slice plan (ONE coordinated geometry wave — folds ADR-0036 + the text-field-icon gap)

- **S1 — `dimensions.css` (tok-mono).** Replace `--ui-{height,font,icon}-*` `× var(--ui-scale)` with the
  three explicit per-`[scale]` tables from Kim's rows (clause 1; `:root` default + each `[scale]` re-table,
  the `--ui-compact` pattern). Keep `--ui-scale` (+ its `[scale]` value ladder) **for `--ui-type-*` only**.
  Add `--ui-control-line-height: 1` (ADR-0036). Header notes + `dimensions.test` (the three tables per
  `[scale]`; assert `--ui-type-*` still `× --ui-scale`; assert controls no longer reference `--ui-scale`).
- **S2 — control CSS (exec).** `button.css`/`text-field.css` read the tokens; **add**
  `line-height: var(--ui-control-line-height)` on `:scope` (ADR-0036); **repoint**
  `--ui-text-field-icon → var(--ui-icon-{sm,md,lg})` (the conformance gap — it then follows Kim's mapping).
- **S3 — browser smoke (exec).** AC1–AC7 + the ADR-0036 line-height ACs + the text-field icon §1-set integers.
- **S4 — docs (planning-lead) — DONE.** geometry-sizing-spec §1.1/§3 + geometry.md reconciled; the
  ADR-0007/0032/0033/0035/0037 markers + README flipped (Kim ratified the mapping). Only the token build
  (S1–S3) remains.
- One commit. Gate: `npm run check && npm test` + the browser smoke. No app-markup migration.

## Alternatives considered

- **Keep the multiplier (snap, ADR-0037)** — rejected (Kim's directive). The multiplier let height drift off
  the glyph row and produced collapses; Kim authored an explicit table instead.
- **Keep ADR-0035's font/icon values** — impossible under Kim's rows (clause 4): her heights re-pick the
  rows, so font/icon follow. (And ADR-0035's content tiers no longer match Kim's content band.)
- **Planning-lead's own (size×scale) mapping** (an earlier draft of this ADR) — **discarded**: Kim provided
  the authoritative table directly; this ADR is grounded on hers verbatim.
- **Remove `--ui-scale` entirely (make display explicit too)** — deferred (F-scale). Display is the
  ruled-linear fork wanting continuous scaling; Kim left it untouched. `--ui-scale` survives solely for it.
