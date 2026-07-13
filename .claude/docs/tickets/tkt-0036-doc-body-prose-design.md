---
doc-type: ticket
id: tkt-0036
status: doing
date: 2026-07-13
owner:
kind: bug
---
# TKT-0036 — the doc-page markdown body needs a real reading design (measure · chip density · hierarchy)

## Summary
Kim's report (2026-07-13, screenshot of a control doc page's prose body): "the body content styles
need to go through full system-decompose and some ui/designing reasoning." The sibling surface to
TKT-0033 (which redesigned the API tables): the markdown BODY under the tables —
`renderMarkdownBody` in `site/lib/doc-page.ts`, rendering each control's `{name}.md` descriptor body —
ships with no reading design. Grounded defects visible in the capture:
1. **No measure** — the rendered `<article>` has no `max-inline-size` (only `.page-description` /
   `.page-lead` carry one, 62/68ch); paragraphs run the full content width, far past a readable line
   length.
2. **Chip saturation** — the body is the descriptor's agent-facing spec-prose, where nearly every
   other token is backtick code; the global `code` chip rule (border + stepped surface + radius on
   EVERY span, `_page.css` ~L353) turns each line into a wall of boxed fragments — the chips visually
   outweigh the prose they punctuate.
3. **No hierarchy/rhythm** — headings, bold runs, bullets, long parenthetical ADR citations, and
   chip-chains all compete at similar visual weight; nothing guides a reading order.

## Acceptance
- A full system-decompose + UI/typography design pass (the explicit ask) runs BEFORE any CSS is
  written: decompose the intent (who reads this body and for what task), reason on both planes —
  the CONTENT plane (the `{name}.md` body is written as an agent-facing contract; how much of the
  "sad" is content-shape vs display?) and the DISPLAY plane (measure, leading/rhythm, chip
  treatment/density, heading scale, semantic blocks) — and produce named candidate directions with
  trade-offs, recorded on this ticket, forks to Kim (a user-facing docs-design taste call; nothing
  self-ratified).
- Constraint carried into the design: the derive-from-descriptor law holds — the body STAYS the
  descriptor's own markdown, one shared render path (no per-page hand-copy); a content-plane
  recommendation may propose conventions for HOW descriptor bodies are written, but display must
  degrade gracefully on the existing corpus as-is.
- The chosen design lands as ONE shared treatment (doc-page render + its stylesheet), theme-aware +
  AA on `--md-sys-*` roles, responsive, coherent with TKT-0033's Form-B tables on the same pages —
  the tables and the body must read as one designed page, not two systems.
- Typography decisions reason from the fleet's own type scale (`--md-sys-typescale-*`, ADR-0078) —
  no bespoke font sizing.

## Repro
Open any control doc page (e.g. `ui-text-field`) below the API tables. The prose runs full-width
(no measure), each backtick span renders as a bordered chip (dozens per paragraph), and
spec-register sentences ("the field border steps to … a `--md-sys-color-focus-ring` border-color
step would double with the ring …") render as undifferentiated dense body text.

## Expected vs actual
- **Expected:** doc-page prose that reads — a constrained measure, chips that punctuate rather than
  dominate, a heading/rhythm system that carries the eye, spec-detail visually subordinated to the
  main line.
- **Actual:** unmeasured full-width lines of chip-saturated spec-prose with flat hierarchy.

## Classification
Axis: **visual + structural (no reading design; display amplifies a content-register mismatch)** —
subjective in trigger, real in mechanics. Planes: `site/lib/doc-page.ts` (`renderMarkdownBody`) +
the site prose/chip styles (`_page.css` code-chip rule; a dedicated stylesheet is the likely home,
per TKT-0033's precedent) + (content plane, advisory) the descriptor-body authoring conventions.

## Severity
**minor** — truthful content, functioning pages; the cost is the fleet's primary reference surface
reading as an unstyled spec dump.

## Links
- `site/lib/doc-page.ts` (`renderMarkdownBody` ~L263+, `composeDocPage` L244-258) ·
  `site/pages/_page.css` (the global `code` chip rule ~L353; the 62/68ch measures that stop short of
  the article) · `site/lib/doc-page.css` (TKT-0033's new stylesheet — the sibling system this must
  cohere with) · TKT-0033 (the API-table redesign, Form B — same pages, one design) ·
  `--md-sys-typescale-*` / ADR-0078 (the type scale to reason from) · the `{name}.md` descriptor
  corpus (the content being rendered).

## Findings

### 2026-07-13 — design intake

Method: `forge:system-decompose` (CONTENT/DISPLAY two-plane cross-check) run against `ui:layout-decompose`'s
outside-in (space) / inside-out (behavior) axes, treating the rendered `<article>` as the one region under
design (the doc page's frame/regions above it — nav rail, header, Form-B tables — are already settled by
TKT-0033 and out of scope). Grounded against three real bodies of different character:
`controls/text-field/text-field.md` (dense, ADR-citation-heavy spec prose — the screenshot's source),
`controls/button/button.md` (the cleanest case — short paragraphs, tight lists), and `controls/card/card.md`
(the extreme case — a long-form engineering changelog with `>`-prefixed decision-log call-outs the renderer
does not parse at all today; they fall through as plain paragraphs, silently losing their "this is an aside,
not the contract" signal). Grounded against the type ramp in `shared/src/tokens/dimensions.css`
(`--md-sys-typescale-*`, ADR-0078).

**1 — Intent.** Three read tasks share this surface: *skim* for a capability ("does this support type=X"),
*verify* one contract detail (an exact behavior under a scenario, an ADR citation), and *learn* a control end
to end (a new consumer's first read). The body's source register is written for the first two — an
agent-facing CONTRACT, one invariant per sentence, near-every noun backticked (attribute names, token names,
event names, CSS properties), parenthetical ADR/TKT citations inline mid-sentence, hedge clauses stacked
("only after…", "not…, but…"). That register is optimized for grep-precision, not prose flow, and display is
being asked to make it *read* without changing a word. Measure, rhythm, and hierarchy are pure display fixes
that fully close that gap; chip density is NOT — it is majority content-shape (the corpus really does mean
"nearly every noun is a literal token"), so display can de-emphasize the chip's visual weight but cannot make
the sentence itself read as prose. Call it roughly 60% displayable / 40% content-shape, and design display to
degrade gracefully on the 40% rather than pretend it isn't there.

**2 — Two planes.**

*OUTSIDE-IN (space, OK layout-decompose axis A on this one region):* frame = the constrained-measure
`<article>`; regions = heading blocks / paragraph blocks / list blocks / code blocks / (proposed) blockquote
blocks; atoms = the inline spans — the `code` chip and the `**bold**` run. Today the frame carries NO measure
(the #1 grounded defect) and no region carries a scale-derived heading style — `h2`…`h6` inherit UA defaults,
flush against `--md-sys-typescale-*` doing nothing here at all.

*INSIDE-OUT (behavior, axis B):* the actions are *skim headings*, *find/verify one token*, *follow the prose
line*, *absorb an aside without losing the thread*. Binding today: skim has no surface (flat heading weight —
defect #3), token-verify way over-hosts (every token, not just the ones worth hunting, gets the same loud
bordered-chip treatment the API tables use for their scan axis — defect #2, chips outweigh prose), and
aside-absorption has literally no surface (`>` lines are not parsed — the card.md gap). Applying the
cross-check: no unhosted action once headings get scale + blockquote parsing land (see D below); the one
live defect is chip-verify's surface being reused wholesale from the API-table idiom where it doesn't fit —
an over-hosted action, not an unhosted one.

*CONTENT plane (advisory only — no rewrites, corpus stays as-is):* future descriptor-body authoring would
read better with front-loaded one-line behavior statements and trailing (not mid-sentence) ADR/TKT citations,
and the `>` convention card.md already uses for Kim's decision-log asides is worth keeping — display should
grow to host it (see 4·B) rather than the content backing away from a genuinely useful device. None of this
is required for the display design below, which must degrade gracefully on all three corpora exactly as they
stand today.

*DISPLAY plane (buildable):*
- **Measure** — clamp the `<article>` (the prose regions only) to a `max-inline-size`; code blocks stay
  full-width (the content column's existing 64rem, matching `.code-block`'s current full-bleed treatment) —
  the "narrow for reading text, wide for structured/code content" split _page.css already implies elsewhere.
- **Heading scale + rhythm** — stop inheriting UA defaults; the demoted ATX levels (`##`→h3 etc.) read
  `--md-sys-typescale-title-medium` (16px/500/1.5lh) for the top demoted level and `-title-small`
  (14px/500/1.429lh) below it, body copy rides `-body-medium` (14px/1.429/0.018em, already the shell's
  ambient body step) — no bespoke sizes anywhere. Consistent `--ui-space-*` block-margins tie a heading to
  its following paragraph tighter than to the block above it.
- **The chip call (the core fork)** — three real options: **(a) lighter chip** — drop the border, keep only a
  faint tint, smaller radius/pad; **(b) mono-color-only** — no box at all, monospace + a muted ink shift, zero
  boxed weight; **(c) context-split** — the FULL bordered chip stays exactly as TKT-0033 shipped it for the
  API-table rows (the scan axis there, correctly loud), but `article code` (prose only) gets the quieter (a)
  tint-only treatment — same token, different register depending on whether it's the thing being scanned or
  a thing being mentioned in a sentence.
- **Bold** — weight-only (already true), no color shift; the corpus already over-uses `**bold**` for
  emphasis (a content-plane note, not fixed here).
- **Lists** — token-spaced indent inside the same prose measure, not full width.
- **Blockquote** — ADD `>`-line parsing to the tiny markdown parser (small, generic, stays in the one shared
  render path) styled off `--md-sys-typescale-quote-*` (literally named for this) with a muted left rule —
  directly serves card.md's decision-log asides, currently silently degrading to plain paragraphs.
- **Citation subordination** — visually demoting a trailing "(ADR-####…)" parenthetical would need a
  content-blind regex over free prose; flagged as real but fragile (risk of misfiring on an ordinary
  parenthetical that isn't a citation) — see direction C.

**3 — Coherence.** The chip-register split (full chip in `.api-row`/`.api-chipset`, quiet chip in `article
code`) is a scoped CSS addition to `doc-page.css` (TKT-0033's dedicated stylesheet, not `_page.css` — the
concurrent nav wave owns that file), never a rewrite of the existing global `code` rule the Form-B rows
depend on. Spacing rides the same `--ui-space-*` scale already used across both files; the prose measure
narrowing under the full-width tables above it is an ordinary, expected editorial pattern (tables/code stay
wide, reading text narrows), not a break in the page's visual system.

**4 — Candidate directions.**
- **A · Quiet prose** — smallest diff: measure + tint-only prose chips (option a) + typescale headings/body.
  No blockquote support — `>` lines keep degrading to plain paragraphs on card.md. Ships fastest, leaves one
  grounded corpus gap open.
- **B · Documentation-grade (recommended)** — A, plus blockquote parsing (quote typescale + rule), a slightly
  wider prose measure (72ch, tuned to the compound-sentence-and-citation corpus rather than borrowing
  `.page-lead`'s 68ch verbatim), code blocks escaping to full content width, and the tint-only (a) chip split
  scoped to `article code`. Closes all three grounded defects plus the live card.md blockquote gap, touches
  nothing TKT-0033 already shipped.
- **C · Structured contract** — B, plus the regex-detected trailing-citation subordination (a
  `label-small`-styled quiet trailing note for a "(ADR-####…/TKT-####…)" parenthetical) and a
  bold-leading-term-as-definition-row heuristic. Highest payoff on text-field.md's worst-case density, highest
  fragility (a heuristic over free prose, not a parsed construct) and the highest build/test cost — a
  follow-up candidate, not this pass.
- **D · No-chip minimalist** — B's measure/heading/rhythm, but the prose chip goes all the way to (b)
  mono-color-only everywhere. Fully kills the saturation complaint but removes the one affordance a
  token-verification read actually wants — the visual "this is a literal, not prose" cue — the wrong trade
  for what this surface is *for*.

**5 — Recommendation + fork sheet.** **B** is the firm recommendation: it resolves all three grounded defects
(measure, chip saturation via a scoped register split rather than a blanket de-boxing, hierarchy via
typescale reuse), stays byte-coherent with TKT-0033 (the Form-B chip is untouched), needs no prose-parsing
heuristics, and turns card.md's already-attempted `>` convention into a real, supported construct instead of
a silent degrade. C is a real idea but should be its own ticket, gated on whether B alone reads well enough
in practice. D is rejected — it treats "the chips are loud" as the whole complaint when the doc's job is
partly token-verification, which chips exist to serve.

Nothing here is self-ratified — forks for Kim:
1. Prose measure: 68ch (match `.page-lead`) vs. 72ch (my lean, for the citation/compound-sentence corpus) vs. another value.
2. Prose chip treatment: tint-only/no-border (direction B, my lean) vs. full mono-color-only/no-box (direction D) vs. a third idea.
3. Blockquote parsing: build now as part of this ticket (my lean — card.md is using `>` today and silently losing it) vs. defer to its own ticket.
4. Citation subordination (direction C's regex-detected ADR/TKT demotion): pursue now, hold as a named follow-up (my lean), or drop as too fragile for a content-blind heuristic.
5. Code-block width: full content-column width (my lean, matches `.code-block`'s existing full-bleed use) vs. constrained to the same prose measure as paragraphs.

### 2026-07-13 — Kim's ruling: Direction B (documentation-grade), 72ch, tint-only prose chips

Kim ruled at the fork prompt: **Direction B** · prose measure **72ch** (code blocks/tables full
content width) · prose chip = **tint-only, no border** (the register split — `article code` quiet,
the Form-B API-table chip untouched). B's leans settle the remaining forks: **blockquote parsing
builds now** (card.md's `>` asides become a real construct, `--md-sys-typescale-quote-*` + muted
rule); **citation subordination (direction C) holds as a named follow-up** gated on B reading well;
typescale headings/rhythm as specced. Build next: `renderMarkdownBody` (+ blockquote support) in
`site/lib/doc-page.ts`, styles into `site/lib/doc-page.css` (TKT-0033's stylesheet — one page
system), independently reviewed, drift-gates green.
