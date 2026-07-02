# ADR-0036 — The single-line Control line-height standard (`--ui-control-line-height: 1`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted — ratified 2026-06-30 on the green geometry gate (tsc · jsdom 1075 · browser 182; computed line-height = font-size verified at sm≠md on button + text-field editor) |
> | **Date** | 2026-06-30 *(authored + ratified)* |
> | **Proposed by** | planning-lead — the design seat, on Kim's directive *"in buttons and single-line controls, the text line-height should always be 1.0"* |
> | **Ratified by** | orchestration-lead (on the browser gate — computed line-height = font-size, centering preserved) |
> | **Repairs** | **NEW** `@agent-ui/shared/src/tokens/dimensions.css` (`--ui-control-line-height: 1`, a `:root` fleet constant) + `dimensions.test.ts` · `references/geometry.md` (the centering-law **vertical companion** + the Control-class row) · `references/geometry-sizing-spec.md §2` (companion line) · `references/dimensional-standard.md` (the Control-class `@scope` recipe) · `controls/button/button.css` + `controls/text-field/text-field.css` (the `:scope` consumer) · the geometry trip-wire (a "Control text line-height = font" leg) |
> | **Supersedes / Superseded by** | **None — additive standard** (no prior mechanism reversed). **Relates ADR-0009** (the analogous shared *token standard* — `--ui-focus-ring-*` in dimensions.css + a law-doc section + the first control consumer; this ADR mirrors that shape) · **ADR-0025** (the `ui-text` **Display** class this rule **EXCLUDES**) · **ADR-0007** (the dimensions layer it extends) · **ADR-0033** (the same Control-vs-Display two-ledger split — control glyphs decouple, display stays on the type scale). |

## Context

Kim's directive: **single-line text controls must render `line-height: 1.0`.** Today neither `button.css` nor
`text-field.css` sets `line-height`, so the label/editor **inherits the ancestor's** (the docs body is `1.5`) —
too tall for a single line sitting in a fixed-height control frame. The control's frame is the lever
(`block-size = --ui-{cmp}-height`, `padding-block: 0`) and the host grid centers its content
(`align-items: center`); an inherited `1.5` line box adds phantom leading above/below the glyph that the frame
was never sized for.

`ui-text` already does the **right** thing for its class — it sets `--ui-text-leading` from
`--ui-type-{level}-leading` (ADR-0025). It is a **Display**-class, **multi-line** document-text primitive and is
**EXCLUDED** from this rule: document text needs real leading between wrapped lines; a single-line control does not.

There is no shared control-base stylesheet and `geometry.md` has no text-line-height law yet — only the *glyph*
centering law (edge-pad `½(h − glyph)`). This rule is that law's **vertical-text companion**: the single line, like
a glyph, centers in the fixed frame with **no extra leading**.

## Decision

Establish a fleet **Control-class standard: single-line control text → `line-height: 1`**, realized as a shared
token consumed on the control host.

1. **The law.** A **single-line Control-class** control (the full-height `block-size` class — `button`,
   `text-field`, and every future single-line control: `select`, `number-field`, the field family, …) sets its
   text **`line-height: 1`**. The fixed frame centers the single line (the host grid's `align-items: center`); no
   extra leading. Recorded as the centering law's vertical companion in `geometry.md`.
2. **EXCLUDES the Display class.** `ui-text` (and any multi-line, document-text Display component) keeps its
   per-level type leading `--ui-type-{level}-leading` / `--ui-text-leading` (ADR-0025) — **untouched**. Two
   ledgers, two correct behaviors: **Control** = single-line, `line-height 1`; **Display** = multi-line,
   type-scale leading. (The same split as ADR-0033: control glyphs decouple; display type stays on its scale.)
3. **Mechanism — a shared token `--ui-control-line-height: 1`** on `dimensions.css` `:root` (beside
   `--ui-radius-base`), consumed by each Control's `@scope (ui-{cmp}) :scope` as
   `line-height: var(--ui-control-line-height)`. **Token over literal:** it is a **fleet Control-class constant** —
   one greppable source, self-documenting as a named law, and theme-overridable — exactly the constant-token canon
   the codebase already uses for fleet rules (`--ui-focus-ring-width`/`-offset` ADR-0009, `--ui-radius-base`,
   `--ui-glyph-ratio: 1`). The name uses **`line-height`, not `leading`**, deliberately: "leading" is the
   pervasive **slot** vocab here (the leading/trailing adornment slots), so `--ui-control-line-height` reads
   unambiguously. (Display keeps the `-leading` suffix — the two vocabularies stay visibly distinct.)
4. **Placement — the host `:scope`, not a per-part rule.** The host already owns `font-size`; one
   `line-height: var(--ui-control-line-height)` there **inherits** to the button label (the default children), the
   text-field editor part (`[data-part=editor]`, which re-declares `font-size`/`color` but **not** line-height), and
   the placeholder `::before`. One rule per control, no duplication.
5. **Centering is preserved (the load-bearing constraint).** `line-height: 1` shrinks the line box to the
   font's em height; the host's `align-items: center` keeps it centered in the **unchanged** fixed
   `block-size` frame (line-height `1` < height, so the line never grows the box). The frame height, padding, and
   the glyph centering law are all untouched — only the phantom inherited leading is removed.

## Consequences

- **Single-line controls render a correctly-centered, tight single line** — no inherited `1.5` adding phantom
  leading; the text now sits in the frame the geometry law sized for it.
- **The exclusion keeps `ui-text` intact** — headings/body keep their type-scale leading (multi-line presence
  unaffected). The rule is Control-class-scoped, never global.
- **One fleet token; the next single-line control reads it** — no per-control re-decision, and a fleet change is
  one edit. Matches the `--ui-focus-ring-*` precedent.
- **No mechanism reversed** — purely additive; no supersession. The geometry trip-wire gains one leg (Control text
  line-height = font), so the rule is enforced, not just documented.
- **Stale → re-verify (on ratify + build gate):** `dimensions.css` (`--ui-control-line-height`) + `dimensions.test.ts`
  · `button.css` + `text-field.css` (`:scope` consumer) · `geometry.md` + `geometry-sizing-spec §2` +
  `dimensional-standard.md` (the recipe) · the browser smoke.

## Acceptance criteria (browser-measurable + source)

- **AC1 — line-height = font.** The button **label** and the text-field **editor** render a computed
  `line-height` **equal to their `font-size`** (e.g. `[size=md]` → font 14 → computed line-height `14px`); sample
  ≥2 sizes.
- **AC2 — centering preserved (the constraint).** The label/editor's box vertical center ≈ the host's vertical
  center within ε, **and** the host `block-size` is still `var(--ui-{cmp}-height)` (the frame did **not** change —
  proving the rule tightened the line box, not the box).
- **AC3 — exclusion negative-control.** A `ui-text` body/h-level renders its computed `line-height` at the
  **type-scale leading** (`--ui-type-{level}-leading`, e.g. body `1.5×`), **NOT** `1×` font — proving the rule is
  Control-scoped, not a global reset.
- **AC4 — source.** `dimensions.css :root` declares `--ui-control-line-height: 1`; `button.css` + `text-field.css`
  `:scope` read `line-height: var(--ui-control-line-height)`.

## Slice plan (tok-mono owns dimensions.css; exec owns the control CSS + probe; docs = planning-lead)

- **S1 — `dimensions.css` (tok-mono).** Add `--ui-control-line-height: 1` to `:root` (beside `--ui-radius-base`),
  with a header note (Control-class single-line leading; cite geometry.md + this ADR). `dimensions.test.ts`: a
  source assertion the token exists `= 1`.
- **S2 — the consumers (exec).** `button.css :scope` + `text-field.css :scope` add
  `line-height: var(--ui-control-line-height)` (beside `font-size`).
- **S3 — the probe (exec).** Browser smoke (AC1–AC3: computed line-height = font, centering + block-size held, the
  `ui-text` exclusion) + the source/string probe (AC4). Add the "Control text line-height = font" leg to the
  geometry trip-wire.
- **S4 — docs (planning-lead).** `geometry.md` (the centering-law vertical companion + the Control-class row),
  `geometry-sizing-spec §2` (companion line), `dimensional-standard.md` (the Control `@scope` recipe) — authored
  with this ADR (Kim-directed law).
- Gate: `npm run check && npm test` + the browser smoke. No app-markup migration.

## Alternatives considered

- **A literal `line-height: 1` per control** — rejected as the fleet mechanism. It scatters the constant across N
  control stylesheets, is not greppable as a named law, and a future fleet change edits every file. Defensible as
  the *lightest* option, but it forfeits the one-source/named-law property the constant-token canon
  (`--ui-focus-ring-*`, `--ui-glyph-ratio`) exists for.
- **`line-height` on the editor / label PART (not the host)** — rejected. The host `:scope` already owns
  `font-size`; one host rule inherits cleanly to the label, the editor, and the placeholder. A per-part rule
  duplicates the constant and risks a part (a future adornment-with-text) missing it.
- **A global `line-height: 1` on the foundation root** — rejected. It would wrongly hit the **Display** class
  (`ui-text`) and any multi-line content; the rule is Control-class-scoped by design (clause 2).
- **Name it `--ui-control-leading` / `--ui-leading-control`** — rejected. "leading" collides with the pervasive
  leading/trailing **slot** vocabulary; `--ui-control-line-height` is unambiguous (and Display keeps `-leading`).
