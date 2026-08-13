# ADR-0166 — `ui-super-shell` bars OWN their seam: the frame's block-axis `gap` is deleted, each bar draws a hairline inside its own border box, and a card's bar-facing corners square per side (Kim's 2026-07-30 ruling, GH #371)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-30 *(authored)* |
> | **Proposed by** | design seat (the GH #371 bar-seam intake; 0166 claimed against a verified directory ceiling of 0165 — the README index lags by construction, so the claim was checked against files, not the index) |
> | **Ratified by** | kimgranlund (repo owner), 2026-07-30, via the [`ratify ADR-0166` utterance](https://github.com/kimgranlund/agent-ui/issues/371#issuecomment-5130233093) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: [`../spec/shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) §10 SPEC-R11a (the frame-geometry enumeration + the floating-cards reading, per §Amendment sheet below) · `app/src/controls/super-shell/super-shell.css` (the `[data-part='frame']` · `[data-part='bar']` · `rail`/`pane`/`pane-resizer` · six overlay arms · narrow-stack · narrow-tabs rules) · `app/src/controls/super-shell/super-shell.browser.test.ts` (the GH #253 regression `it` at `:125`, rewritten) · `site/pages/_page.css` (`:110-113` header, `:158-163` footer — the duplicate hairlines) · `site/pages/_page.visual.browser.test.ts` baseline · [`../decompositions/bar-seam-371.decomp.json`](../decompositions/bar-seam-371.decomp.json) |
> | **Supersedes / Superseded by** | **Amends** [ADR-0151](./0151-named-shell-archetypes-m5.md) (the shell frame's composed geometry) · **narrows** GH #253's edge-to-edge bar ruling on the BLOCK axis only (its no-radius-on-a-bar clause is untouched and re-affirmed at cl.2) · Relates [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) (the resizer/pane grammar whose GH #214 seam arithmetic this record proves unaffected) · [ADR-0155](./0155-shell-responsive-band-ladder-toggle-law-scrollbar-seam.md) (the band ladder + overlay anatomy the posture exceptions at cl.6/cl.7 key off) · Relates [ADR-0102](./0102-css-less-consumer-contract-law.md) (a consumer with no CSS must still get a correct seam — the argument that kills the consumer-owned-hairline option) · Resolves GH #371 |

## Context

GH #371 filed `[data-part='frame']`'s `gap: var(--ui-super-shell-gap)` (`super-shell.css:88`) as a
declaration the frame should not have: the frame's children are bars and the body, and GH #253 had
already ruled that a bar sits **edge-to-edge**, "unlike rail/pane/pane-resizer, which are separate
floating cards with gaps between them". A column gap on the frame inserts one 18px module between an
edge-to-edge header and the content below it, which contradicts what edge-to-edge means.

**The measurement settled the issue's own open discrepancy** (batch seat, real pages, 2026-07-30,
recorded on the issue). The declaration is **live**: `rowGap: 18px`, 18px seams bar→middle and
middle→bar, on the docs shell, all three `super-shell.html` shells, and both `chat-shell` instances.
Three shipped instances render it **inert** because their frame has exactly one visible child — no
bar authored (`ui-agent-admin` composes `content` + `options-pane` only, `agent-admin.ts:405/515/669`;
`gen-ui-live.ts:186/190` composes `nav-pane` + `content`). Both readings on the issue were true
simultaneously, on different instances.

**The naive fix inverted.** Deleting the gap as filed was run as a captured experiment: the seams go
to 0 and the pane's 18px-radiused top corner butts flush against the header bar, leaving a wedge of
page background at the corner — the exact defect class GH #253 was opened to fix. Experiment
reverted.

**Kim ruled a redesign on 2026-07-30**, three parts: the frame's `gap` goes; bars carry their own
seam inside their own box; panes' bar-facing corners square off against bars. The mechanism was left
to this intake, with a named precedent — GH #214 already established *"the resizer OWNS the gap it
sits in"* as the house shape for an element owning the seam it occupies.

Three facts from the tree bound the design, and each one kills an option that reads plausible:

1. **A bar's surface is the SAME token as a card's.** `--ui-super-shell-surface` is
   `--md-sys-color-neutral-surface`, and `[data-part='rail']`/`[data-part='pane']` paint the same
   value (`super-shell.css:105/131/140`) — a fact `_page.css:107-109` already restates deliberately
   ("restated here so the one declaration reads as the band's true source, not a same-color
   coincidence"). `[data-part='canvas']` paints **nothing**. So a bar flush against the cards with no
   separator does not read as "flush" — it reads as one continuous surface blob wrapping the
   transparent canvas: **L-shaped** with one side authored, **Π-shaped** with both (bar across the
   top, a card column down each edge).
2. **A hairline for this exact seam already ships — in the wrong layer.** `_page.css:110-113`
   (GH #183-S1 / GH #210) draws `border-block-end: 1px solid var(--md-sys-color-neutral-outline-variant)`
   on the docs shell's own header bar box, and `_page.css:161-163` draws the mirror
   `border-block-start` on `.app-context-footer`. The site independently derived the separator this
   ruling needs; every other consumer, and the CSS-less consumer ADR-0102 protects, gets nothing.
3. **The frame's gap spaces FOUR seams, not two.** `#buildNarrowTabs` appends
   `ui-tabs[data-part='narrow-tabs']` as a frame child **between `middle` and the footer**
   (`super-shell.ts:365`). The issue enumerated header↔middle and middle↔footer; the real set is
   header↔middle, middle↔narrow-tabs, narrow-tabs↔footer, middle↔footer.

## Decision

**The frame's block-axis `gap` is deleted. Each bar draws a 1px hairline on its bar-facing edge,
inside its own border box, off a consumer-repointable `--ui-super-shell-bar-seam` token — the bar's
outer height does not change. A card's bar-facing corners square PER SIDE, driven by a pair of
block-axis radius tokens that frame-level `:has()` rules zero when the corresponding bar exists;
three postures where a card's block edge faces something other than a bar restore them. The
inline axis is untouched — middle's inter-card gaps and GH #214's resizer arithmetic stand
verbatim.** Eight clauses.

*(Wording precision, and it is load-bearing: there is no such thing as a card's "inline radii". A
corner belongs to BOTH axes at once — squaring the block-start pair removes the top-left and
top-right corners outright, which are also the inline-start and inline-end corners of that edge. The
inline-axis invariant this record preserves is **gaps and the resizer's footprint**, not corners. An
earlier draft's "its cards' inline radii stand verbatim" was false, and it produced an unsatisfiable
negative control downstream — see cl.8.)*

### 1 — The frame's `gap` is deleted, and the deletion is confined to the block axis

`[data-part='frame']`'s `gap` declaration (`super-shell.css:88`) is removed. The frame is
`flex-direction: column`, so its only gap axis is block — this declaration IS the bar↔body seam, with
no second job. The other three `gap`s in the file are untouched and each is a distinct axis and owner:

| # | site | declaration | verdict |
|---|---|---|---|
| 1 | `:21` | `--ui-super-shell-gap: var(--ui-super-shell-module)` | **stays** — still the inline-axis seam token; a rename would fork every consumer override for zero gain |
| 2 | `:88` | `[data-part='frame'] { gap: … }` | **deleted** — the defect |
| 3 | `:102` | `[data-part='bar'] { gap: … }` | **stays** — spacing BETWEEN items inside a bar (toggle ↔ bar-content ↔ toggle); the issue excluded it and this record re-affirms the exclusion |
| 4 | `:121` | `[data-part='middle'] { gap: … }` | **stays** — Kim's constraint: SPEC-R11a's "separate floating cards with gaps between them" reading stands *within* middle |
| 5 | `:169-171` | resizer `inline-size` / `margin-inline: calc(-1 * gap)` / `padding-inline: calc((gap - 0.25rem)/2)` | **survives unchanged** |

**GH #214's negative-margin arithmetic survives because it never depended on the frame's gap.** A
column flex container's `gap` is a ROW gap; the resizer's neighbours are inline siblings inside
`middle`, and the arithmetic reads `middle`'s gap (`:121`), not the frame's. The 846px natural-fit
number (`super-shell-resize-tabs.browser.test.ts:528-532`) is inline arithmetic and does not move.
The one number that DOES move is the block-axis budget: at a fixed outer height, `middle` gains
`18px × (number of bars authored)` — reclaimed rows, not new space.

### 2 — Each bar draws its own hairline, inside its own border box, and does not grow

```
[data-part='bar'][data-bar='header'] { border-block-end:   var(--ui-super-shell-bar-seam) }
[data-part='bar'][data-bar='footer'] { border-block-start: var(--ui-super-shell-bar-seam) }
--ui-super-shell-bar-seam: 1px solid var(--md-sys-color-neutral-outline-variant);
```

Per-side selectors, not a blanket `[data-part='bar']` rule: `header` and `footer` are the only two
consumers of the part (`super-shell.ts:280/385`), they face opposite directions, and the
discriminator they already carry (`data-bar`) makes the intent readable without a new attribute.

The bar already declares `box-sizing: border-box` (`:104`) and `min-block-size:
var(--ui-super-shell-bar-size)` (`:103`), so the 1px is **absorbed inside the 54px**, not added to
it — the bar's outer height is unchanged and its content box becomes 53px. This is a load-bearing
consequence, not an incidental one, and it carries its own negative control (flip to `content-box`,
the height must read 55).

The token is one composite value rather than a width/style/color trio: the TKT-0062 law is *repoint
the token, not the host property*, and one token means one repoint site for a consumer that wants a
2px seam, a dashed seam, or no seam at all (`0 solid transparent`). **GH #253's no-radius-on-a-bar
clause is untouched and re-affirmed** — a bar still declares no `border-radius`, and the existing
assertion at `super-shell.browser.test.ts:112` stays green unedited.

### 3 — Adjacency is CSS-only, via frame-level `:has()`, never a host-managed attribute

A bar exists in the DOM if and only if a consumer authored children for that slot
(`super-shell.ts:278`, `:382` — `if (children.length > 0)`), and bars are never hidden at any band.
Bar presence is therefore a **static structural fact decided once in `#compose`** — not reactive
state. A host attribute would mint a second source of truth for something the DOM already states,
re-derived on every compose, and would owe SPEC-R2d's no-clobber law a story it does not need. The
repo's own precedent for exactly this class is presence-driven `:has()` — `goals.md:420`'s
"presence-driven region grid (`:has()` — header?/content/footer?)", `goals.md:204`'s optional-leading-icon
grid, and `super-shell.css:476-503`'s own `:scope:has([data-part='narrow-tabs'])` guard.

**A sibling combinator is rejected as half a mechanism.** `[data-bar='header'] ~ [data-part='middle']`
expresses the header cleanly (the bar precedes middle), but CSS has no previous-sibling combinator,
so the footer has no symmetric spelling. `:has()` on the frame is symmetric.

**The `> ` child combinator is MANDATORY in both rules, and the reason is a mechanism fact, not an
analogy.** `@scope (ui-super-shell) to (ui-super-shell)`'s lower limit (SPEC-R1b's depth-2 recursion)
constrains which elements a selector may MATCH — it does **not** constrain what a `:has()` argument
can SEE. A descendant-form `[data-part='frame']:has([data-bar='header'])` therefore matches an OUTER
frame that authored no bar at all, purely because a nested shell several levels down authored one, and
the outer shell's cards then square against nothing. This is not the same claim as `_page.css:84-93`'s
consumer-side trap (a descendant selector PAINTING onto a nested bar, measured there as
`borderBottomWidth: 1px` cross-engine) — that is the analogous shape one layer out; this is the
`:has()`-argument leak in the component's own sheet. **Confirmed cross-engine at review: the child
form leaves the outer cards ROUND and the descendant form squares them, in both engines.** Recorded
because a future edit "simplifying" the combinator away compiles clean and reds nothing without cl.8's
own probe (the decomposition's `n20` negative control mutates exactly this combinator).

Note that `super-shell.css:476-503`'s existing `:scope:has([data-part='narrow-tabs'])` guard uses the
**descendant** form. It is harmless today — an outer shell matching on a nested strip has no
`narrow-tabs` element of its own to reveal and no `[data-narrow-tab-target]` of its own to hide, so
every consequent rule no-ops — but it is a shape not to copy, and this clause is the reason why.

### 4 — The corner contract is a token pair, not `border-radius: 0` declarations

```
--ui-super-shell-radius-block-start: var(--ui-super-shell-radius);
--ui-super-shell-radius-block-end:   var(--ui-super-shell-radius);

[data-part='frame']:has(> [data-bar='header']) { --ui-super-shell-radius-block-start: 0 }
[data-part='frame']:has(> [data-bar='footer']) { --ui-super-shell-radius-block-end:   0 }
```

`rail`, `pane`, and `pane-resizer` drop their `border-radius` shorthand and consume the pair as the
four **logical** longhands (`border-start-start-radius`/`border-start-end-radius` = the block-start
pair; `border-end-start-radius`/`border-end-end-radius` = the block-end pair). Logical, per LLD-C4's
standing discipline in this file; the RTL mirror is inline-axis only, so the block pair is
`dir`-invariant.

**Why a token pair and not four `border-*-radius: 0` declarations on descendant selectors:** two of
the three carded parts are re-positioned as **floating overlays** by three rule blocks carrying six
selector arms — one start arm and one end arm each — (`:333-343` mid-window, `:424-438` narrow,
`:531-541` compact), where the card is `position:absolute`
with `inset-block: var(--ui-super-shell-overlay-inset)` and must keep all four corners round
(cl.6). With the tokens set on the frame, each overlay arm restores them by declaring the custom
property **on the card itself** — an own-element custom-property declaration beats an inherited value
regardless of selector specificity, so the restore needs no specificity arms-race against three
container-query blocks. The `border-radius: 0` shape would need matching specificity in all six arms
and would re-open exactly the cascade fight SPEC-R12a exists to warn about.

### 5 — The per-side corner matrix, row posture (wide · compact · narrow without `stack`)

`middle` is a row: every in-flow card's block-start edge faces the frame's top seam and its block-end
edge faces the bottom seam, so the outcome is uniform across `rail`/`pane`/`pane-resizer`.
`canvas` and `scrim` carry no radius and are untouched by every rule in this record.

| bars authored | block-start pair | block-end pair | shipped instances |
|---|---|---|---|
| **none** | 18px (round) | 18px (round) | `ui-agent-admin` · `gen-ui-live`'s shells — **the inert arm** |
| **header only** | **0** | 18px | `workspace-shell`'s header-only arm |
| **footer only** | 18px | **0** | (reachable from public API; no shipped instance today) |
| **header + footer** | **0** | **0** | the docs shell · `super-shell.html`'s full-chrome shell · both `chat-shell` instances · `mountFullChrome()` |

**The inert arm is byte-stable by construction, not by carve-out** (Kim's constraint 1): neither
`:has()` rule matches, both tokens hold their default, and the deleted `gap` was already rendering
inert on a single-visible-child frame. No conditional, no exception — the mechanism simply does not
fire. cl.8's probe proves it rather than asserting it.

### 6 — Posture exception A: a floating overlay is inset, not flush, and stays fully round

All six overlay arms re-declare both tokens at `var(--ui-super-shell-radius)` on the overlaid card.
An overlaid drawer sits 0.75rem inside `middle`'s own edges — it touches no bar — so squaring its
corners would render a floating card with two square corners, a defect of the same family as the one
GH #253 fixed. **This exception is not in the ruling; the ruling did not reach it.** Its negative
control (delete the restore from the narrow arm; the assertion must red naming
`border-start-start-radius`) is what keeps it honest.

### 7 — Posture exception B: in a COLUMN, a card's block edge faces a sibling — fork F2, ruled

At `<40rem` with `narrow-start='stack'`/`narrow-end='stack'` (`:396-407`), `middle` becomes
`flex-direction: column`. Only the first in-flow card then faces the header and only the last faces
the footer; every other block edge faces a **sibling**. Under a blanket row-posture rule the stacked
side's bottom corners would square against `canvas` — a visible defect.

`:first-child`/`:last-child` cannot express this: `scrim` is unconditionally `middle`'s first child
(`super-shell.ts:306-309`), and a collapsed sibling keeps its position in the child index while
`display: none`. **Ruled:** key off the side, using the restore selector the stack arm already owns
(`:scope[narrow-*='stack'] … > [data-side]:not([data-part='pane-resizer'])`) — `narrow-start='stack'`
puts the stacked card at the column TOP (DOM order places `start` before `canvas`), so it keeps its
block-start squaring and **restores block-end**; `narrow-end='stack'` puts it at the column BOTTOM,
so the pairing inverts. Rejected alternative: restore both pairs in column posture (simpler, but
re-creates the original page-background wedge at the header on every narrow-stack shell).

**The shipped witnesses are both `ui-chat-shell` instances, and only those.** `chat-shell.ts:58` sets
`narrow-start="stack"` as its default and both instances author a header AND a footer
(`site/pages/chat-shell.css:59`/`:141`) — cl.5's bottom row, in column posture. Nothing else shipped
can exhibit this: the docs shell sets `narrow-start="collapse"` (`_page.ts:1110`) and
`ui-workspace-shell` sets the same (`workspace-shell.ts:43`, ADR-0155 F3), so **neither can stack at
all**. Named precisely because this clause is the one Kim ratifies a judgement call on, and a wrong
witness would send the check to a shell that cannot reproduce it. *(An earlier draft cited "the docs
shell's own default at 360px" here — factually wrong, and the correction narrows the blast radius of
this clause rather than widening it.)*

**Mixed postures are OUT OF SCOPE for this record, explicitly.** `narrow-start='stack'` combined with
`narrow-end='tabs'` is reachable from shipped API alone (`chat-shell.ts:35`'s `FORWARD_ATTRS` carries
both `narrow-start` and `narrow-end`), and it puts `middle` in column posture WHILE the narrow-tabs
strip is live — so a card can end up squared against a bar it is no longer flush to, or floating with
two square corners. No shipped instance authors it, the two arms' interaction is already the
duplication hazard ADR-0155's own compact-block comment flags, and guessing the right answer for a
configuration nobody has rendered would be designing against an imagined case. **Ruled: the first
consumer to author a mixed posture files an issue and this clause gains a row.** Declared rather than
left silent, so the gap is a known fence and not an unnoticed hole.

**Posture exception C — the narrow-tabs strip.** `narrow-tabs` is a frame child between `middle` and
the footer (Context fact 3). When it is visible, `middle`'s block-end faces the STRIP, not the
footer: the active narrow-tab pane restores its block-end pair under
`:scope:has([data-part='narrow-tabs'])` inside the narrow query. And the strip itself lost the frame
gap that used to space it, so **the strip owns its own block-start seam** —
`margin-block-start: calc(var(--ui-super-shell-module) / 3)`.

The value earns its place on R11a's ladder **directly, on its own merit** — `/3` is one of R11a's
named shipped fractions, and it is the fraction this file already uses for shell-tier breathing room
that is not a full inter-card gap: the bar's `padding-inline` (`:106`) and `pane-tabs`'s
`padding-block-end` (`:233`). A full `--ui-super-shell-gap` would read as an inter-card gap the strip
is not (it is chrome spanning the frame, like a bar); `0` would butt the strip's first tab against the
pane above it.

*(Correction to an earlier draft of this clause, recorded because the false version read as the more
rigorous one: that draft justified the value as "the same module fraction its existing
`padding-block-end` already uses (`:233`)". **`:233` is `ui-tabs[data-part='pane-tabs']`** — the WIDE
pane-local strip, a different part. `ui-tabs[data-part='narrow-tabs']` (`:267-271`) declares **no
padding at all**, verified by grep over every `padding` in the file. So the strip had no existing seam
to be symmetric with, and a symmetry argument resting on a declaration that does not exist is worse
than no argument. If symmetry is genuinely wanted, the honest form is to ADD the strip's own
`padding-block-end: calc(var(--ui-super-shell-module) / 3)` in the same change — offered as a
build-time option, deliberately **not ruled here**, since nothing in Kim's ruling asks for it and the
seam this record actually owes is the block-START one.)*

### 8 — GH #253's regression test is REWRITTEN, never loosened, and AC19 gains nothing

`super-shell.browser.test.ts:125` — `it('rail/pane/pane-resizer (floating cards) KEEP their radius —
regression-proof against the bar fix')` — asserts `getComputedStyle(part).borderRadius !== '0px'` on
a `mountFullChrome()` fixture that authors **both** bars. Under cl.5's bottom row both pairs square,
the shorthand computes `'0px'`, and **this test goes red by name**. It is rewritten to assert the
four longhands per side with a citation to this record; it is not deleted, and it is not loosened to
pass on a fixture that no longer squares. The whole corner suite is barred from reading the
`borderRadius` shorthand at all: `0px 0px 18px 18px` collapses to a string that satisfies
`not.toBe('0px')` **vacuously**, which would let the header-only and footer-only rows of cl.5's
matrix pass while testing nothing.

**The replacement's negative control must move to a HEADER-ONLY fixture.** On `mountFullChrome()` the
NC "must still red if the inline-axis radii are lost" cannot fire, and the reason is cl.1's wording
correction: both bars are authored, so both pairs zero, all four longhands compute `0`, and there is
nothing left un-squared for a mutation to take away — the control is unsatisfiable by construction, not
merely weak. A **header-only** fixture is the vehicle that bites: its block-END pair stays `18px`, so
dropping the longhand consumption (or mis-spelling a token) genuinely reds. Stated here rather than
left to the build because an unsatisfiable NC reads green and certifies nothing — the same failure
mode as the `borderRadius`-shorthand trap one paragraph up, arriving through the fixture instead of
the assertion.

**AC19's allowlist stays at exactly TWO and `shell-spacing-gate.test.ts` is not edited.** Mechanically,
not by tuning: the deleted `gap` carried no literal; the radius pair mints `var(...)` arms, which
`mintedArmLiterals` skips by rule; `border-block-end`/`border-block-start` are **not in
`SPACING_PROPERTIES`** (`:64-78` — padding/margin/gap/inset/box-size only); and
`--ui-super-shell-bar-seam`'s value carries a **non-dimension-shaped arm** (`solid`), so
`isMintedDimensionValue` returns false and the declaration is out of scope **by construction, not by
carve-out** — the same path AC19's own comment (`:228-230`) names for a box-shadow token's `rgb()`
arm. The `1px` matches no rung either way (`LADDER_PX` = {6, 12, 18, 54, 162, 252} ∪ {4, 8, 12, 16,
24, 32}). The strip's `calc(var(--ui-super-shell-module) / 3)` has no literal arm.

One step in that chain is worth spelling out rather than assuming, because it is the one place the
argument nearly goes the other way: cl.4's presence rules declare `--ui-super-shell-radius-block-start: 0`,
and a bare `0` **is** dimension-shaped under `DIMENSION_ARM_RE` (`0` is an explicit alternative in that
pattern), so those declarations DO enter AC19's minting scope — they are not skipped the way a `var()`
arm is. They pass only because `LITERAL_RE` requires a `px`/`rem` unit, so an unitless `0` yields no
literal to compare, and `0` hits no rung regardless. In scope and clean, not out of scope — a
distinction that matters the moment someone writes `0px` there instead.

**Therefore the AC19 leg's negative control must NOT be anchored on `1px`** — that literal also occurs in
`_page.css` comments and in R11c's sanctioned `-1px` outlier, so a mutation there proves nothing.
Anchor it on a fresh token that occurs nowhere else (`--ui-super-shell-bar-seam-probe: 1.125rem`),
confirm the mutation applied, confirm the red names `1.125rem`, revert.

### Rejected

- **M1 — the literal GH #214 transplant.** `padding-block-end: var(--ui-super-shell-gap)` +
  `background-clip: content-box` on the bar: the 18px void survives inside the bar's own box, net
  footprint byte-identical to today on every shell, the frame's gap removable with zero pixel change
  anywhere. Genuinely attractive, and it satisfies "bars own their seam" to the letter. **Rejected
  because it satisfies nothing else in the ruling:** the bar does not sit flush, and the pane's
  corners still face a void, which makes clause 3 of the ruling ("corners square off against bars")
  meaningless. It is the ruling's words without the ruling's intent.
  **And the precedent transfers less well than its name suggests.** GH #214's mechanism exists for a
  reason a bar does not have: the resizer is an *interactive target*, and `:156-165`'s whole rationale
  is hit-box — the box was grown to a full gap because "a BETTER drag target than the old 4px sliver"
  was the point, with `background-clip: content-box` there to keep the visible ink thin while the
  *clickable* area stayed wide. A bar has no drag gesture, no pointer affordance, and nothing to
  enlarge; transplanting the mechanism would import the negative-margin/clip complexity while leaving
  behind the only thing it was built to buy. Citing #214 as "the house shape for an element owning its
  seam" is right in spirit and wrong in mechanism — cl.2 keeps the spirit (the seam lives in the bar's
  own box) and drops the machinery.
- **M3 — flush with no separator at all.** The minimal reading of "edge-to-edge bars sit flush".
  Rejected on Context fact 1: bar surface == card surface, canvas paints nothing, so the bar merges
  into the rail/pane columns as one L- or Π-shaped blob. Note that `super-shell.html`'s demo bars are
  TINTED (`site/pages/super-shell.css:125-126`, `primary-container`), which **PARTIALLY masks** this
  defect on the one page a reviewer is most likely to open. Partially, precisely: the tint sits on the
  authored `[data-slot='header']` element, which the shell nests inside `[data-part='bar-content']`
  (`super-shell.ts:283-292`) — so the bar's own `padding-inline: calc(module / 3)` (`:106`) still
  paints `--ui-super-shell-surface` in a ~6px sliver at each inline extreme, where the merge is
  visible if looked for. A reason to disbelieve that page as primary evidence, not a reason to ship
  M3 — and the same 6px mechanism is why the docs footer's `surface-low` content sits in a
  `neutral-surface` frame today (Consequences, below).
- **Leaving the hairline consumer-owned.** The docs site already draws it; the shell could simply not
  care. Rejected on ADR-0102: the CSS-less consumer gets no seam, and every non-site composer
  (`chat-shell`, `workspace-shell`, the demo shells) would need to re-derive the same rule — which is
  how `_page.css:110-113` and `_page.css:161-163` came to exist as two independent, inconsistent
  derivations in the first place (one on the bar box, one on the bar's CONTENT, 6px inset by the
  bar's `padding-inline`).
- **A host-managed `data-has-header`/`data-has-footer` attribute pair.** Rejected at cl.3 — a second
  source of truth for a static structural fact.
- **Renaming `--ui-super-shell-gap`** now that it is inline-only. Rejected: it forks every consumer
  override for a naming improvement.
- **Squaring `canvas`.** No radius to square; it paints no background.

## Consequences

- **Every bar-bearing shell changes visibly.** The 18px page-background band between bar and body is
  replaced by a 1px hairline, and `middle` grows by 18px per bar. The docs shell, all three
  `super-shell.html` shells, both `chat-shell` instances and `workspace-shell` are all affected;
  `_page.visual.browser.test.ts`'s baseline must be re-based with the moved seam named in the commit
  body, and only **after** the duplicate-hairline repair, or the baseline bakes in a two-hairline
  frame.
- **The docs site owes a repair in the same change** (the stale-context rule): `_page.css:110-113`
  drops its now-duplicate `border-block-end`, and `.app-context-footer` (`:158-163`) drops its
  `border-block-start`, which today sits INSIDE `bar-content` and is therefore inset 6px from the
  bar's own edge — after cl.2 those become two nearly-coincident hairlines at different insets.
- **The docs footer additionally paints two surfaces, and cl.2 makes that visible.** `.app-context-footer`
  sets `background: var(--md-sys-color-neutral-surface-low)` (`_page.css:161`) while the footer BAR box
  it sits in paints `--ui-super-shell-surface` (= `neutral-surface`), and the bar's own
  `padding-inline: calc(module / 3)` leaves that lighter surface showing as a ~6px sliver at each
  inline extreme. Today an 18px page-background band above the footer hides how the two surfaces meet;
  flush against the content, the sliver reads as a seam artifact rather than a design. **Not ruled
  here** — it is pre-existing, it is the consumer's own box, and this record does not own
  `_page.css`'s palette. Flagged so the build sees it deliberately instead of discovering it in a
  baseline diff and "fixing" the component.
- **A consumer that wants the old look has a one-line escape:** repoint
  `--ui-super-shell-bar-seam` to `0 solid transparent` and add its own block margin. No consumer is
  known to want this; the escape exists so the ruling is not a trap.
- **Three postures now carry per-side corner rules** (overlay, narrow-stack, narrow-tabs), and each
  is a place a future band or posture must remember to consider. This is the real cost of the
  ruling, and it is the reason cl.6/cl.7 are written as clauses rather than left to the build: a
  fourth posture added without reading them ships a wedge or a square-cornered floating card.
- **SPEC-R11a is contradicted until amended** — see the sheet below. Until ratification the tree and
  the SPEC disagree, and per the repo's status philosophy the tree wins; the amendment is the record
  catching up, and it is deliberately NOT applied to the accepted SPEC body on this branch.
- **GH #371's filed fix (delete the declaration) is closed as inverted**, with the measurement and
  this record as the reason. The issue's own instruction to measure before editing is what produced
  the inversion — worth keeping as the pattern, not just the outcome.

## Amendment sheet (applies to the accepted SPEC on ratification — NOT applied on this branch)

- **SPEC-R11a, the frame-geometry enumeration.** "Shell-FRAME geometry — bars, rails, panes, **gaps**,
  overlay insets — derives from `--ui-super-shell-module`" gains the block-axis carve-out: the frame
  declares no gap; `gap` names the INLINE seam inside `middle` (and inside a bar) only, and the
  bar↔body seam is a bar-owned 1px hairline off `--ui-super-shell-bar-seam` — the **second** frame
  dimension not on the module ladder, alongside the corner radius R11a already excepts. R11a's
  one-junction rule and its two-ladder boundary are otherwise untouched.
- **SPEC-R11a, the floating-cards reading.** "rail/pane/pane-resizer … are separate floating cards
  with gaps between them" becomes **axis-qualified**: the reading holds on the INLINE axis within
  `middle`, verbatim; on the BLOCK axis a card is flush against an adjacent bar with its bar-facing
  corners squared, and stays fully round in the three postures of cl.6/cl.7.
- **AC19 note (no predicate change, no allowlist change).** A clause note recording cl.8's reasoning:
  the bar seam is out of AC19's scope by construction (border properties are not in the property
  families; the composite token value has a non-dimension arm), so the gate's born-zero baseline and
  its two-entry allowlist are unchanged by this wave. Written down because "the gate stayed green" is
  otherwise indistinguishable from "the gate was never in scope".
- **SPEC-R11c — a THIRD disposition: border WIDTHS are outside the literal law's scope.** R11c today
  sorts every raw length literal in shell-family CSS into two bins — **drift** (equals a ladder value ⇒
  convert it) or a **named OUTLIER** (no ladder rung, "sanctioned as-is because there is nothing lawful
  to convert them to", a **closed** five-entry list whose growth "is a reviewed act, never a
  drive-by"). The `1px` in `--ui-super-shell-bar-seam` is neither: it equals no rung, so it is not
  drift, and it is not on the closed list. It also escapes AC19 twice over (cl.8) — border properties
  are absent from `SPACING_PROPERTIES`, and the composite value's `solid` arm disqualifies the minting
  check. **So today it lands governed by nothing at all**, which is precisely the state cl.8 spends a
  paragraph forbidding for everyone else. R11c gains a clause: **a border WIDTH is outside the literal
  law's scope, categorically** — R11c's ladders measure space *between and inside* boxes, whereas a
  border width is a paint dimension with no ladder to sit on (a hairline's only sensible value is a
  device-pixel hairline, which is why `1px` recurs unremarked at `_page.css:73` `[data-site-nav]`,
  `:112`, and `:162`). Two narrowings keep this from becoming a laundering route: it covers border
  **width** only, and a border used as *spacing* (a transparent border standing in for padding) stays
  fully in scope as drift. Chosen over adding a sixth OUTLIER entry deliberately — the outlier list is
  a list of individual sanctioned pixels, and putting hairlines on it would oblige every future 1px
  border in the family to earn its own reviewed row, growing a closed list without bound for a class
  question that one clause answers once.
- **Corner matrix.** cl.5's table + cl.6/cl.7's exceptions land as a new normative sub-clause under
  R11a rather than as prose, so a future posture has a table to extend.

## Amendment — REV 2026-07-30: the build MEASURED cl.7's DOM order and cl.5's inert arm, and both were wrong (GH #371)

> Append-only. The Status and `Ratified by` cells are untouched, and every clause above stands unedited —
> this REV records what the build's measurements falsified, what was therefore NOT built, and what shipped
> as an observed consequence the ratified text said would not happen. Written at the build gate
> (`build-371-bar-seam`), from real-engine measurement on the real pages, not from re-reading the source.
>
> **The lesson line, because it generalizes past this record: a ratified clause is still a CLAIM about the
> tree.** cl.7 and cl.5 were reasoned from the intake's *reading* of `super-shell.ts`, and both read
> plausibly — one of them even cites the call site by line number. Measurement is what falsified them. This
> is the same class as the two other confidently-wrong citations this wave found (below), and the
> difference here is that these ones had already been ratified: the plausibility of the prose is not
> evidence, and a clause that names a mechanism owes a measurement, not a reading.

**1 — cl.7's posture exception C names the wrong pair, because the strip is composed ABOVE `middle`.**
Context fact 3 and cl.7 both state that `#buildNarrowTabs` appends the strip "as a frame child **between
`middle` and the footer**" (citing `super-shell.ts:365`, which is the CALL site). The method itself calls
`frame.querySelector('[data-part="middle"]')!.before(strip)` (`super-shell.ts:870`), so the strip is
`middle`'s PREVIOUS sibling. Measured frame order on a header+footer+tabs shell:
`bar/header | narrow-tabs | middle | bar/footer`. The real four-seam set is therefore header↔strip,
strip↔middle, middle↔footer, header↔middle — not the set Context fact 3 enumerates.

The consequence is that cl.7's ruled restore is inverted: it is a pane's **block-START** that faces the
strip, and its block-END still faces the footer. **The ruled block-end restore was therefore NOT built.**
Building it as written would round a corner that IS flush against the footer bar while leaving the
strip-facing pair squared — two defects instead of one, and the round-corner-against-a-flush-bar defect is
the exact family GH #253 was opened to fix. The mirrored (correct-under-the-true-order) form was ALSO not
built: a deviation may be right and is still a breach, so this returns to the design seat rather than being
silently repaired at the build. **What WAS built is the other half of exception C** — the strip's own
`margin-block-start: calc(var(--ui-super-shell-module) / 3)` — which is the ruled declaration verbatim and
is correct under the true order too (the strip did lose a block-start seam; it lost it to the header rather
than to `middle`).

**Live blast radius today: ZERO.** The only shipped `narrow-*='tabs'` author is `ui-agent-admin`
(`agent-admin.ts:402`), which composes no bar at all (`content` + `options-pane`,
`agent-admin.ts:405/515/669`), so neither frame `:has()` rule ever fires on the one instance the strip
ships in, and nothing is squared for the missing restore to correct. The measured order is pinned in
`super-shell.test.ts` (a frame-child-order assertion plus a source pin on `.before(strip)`) so the
discrepancy cannot drift out of view before this clause is repaired, and the reason for the omission is
recorded in `super-shell.css` at the declaration itself.

**2 — cl.5's inert arm does not include `ui-agent-admin`, and cl.5 contradicts this record's own Context
fact 3.** cl.5's table lists `ui-agent-admin` under "bars authored: **none** — the inert arm", and calls
that arm "byte-stable **by construction**, not by carve-out", satisfying Kim's constraint 1. Context fact 3
already contains the refutation: the narrow-tabs strip is a FRAME CHILD. Because agent-admin sets
`narrow-end='tabs'`, below the 40rem line its frame has **two visible children** — the strip and `middle` —
and the deleted `gap` was **live between them, with no bar anywhere in the shell**. The gap's inertness
argument holds for a frame with ONE visible child; it was never a property of having no bars.

Measured on the real `agent-admin-app.html` at the fleet-default 414×896 viewport, same harness both sides:

| | frame | rowGap | children |
|---|---|---|---|
| main | h=**241** | 18px | `narrow-tabs h=37 top=41 mbs=0px` · `middle h=186 top=96` |
| this wave | h=**229** | normal | `narrow-tabs h=37 top=47 mbs=6px` · `middle h=186 top=84` |

**−12px** = −18 (the deleted gap) + 6 (cl.7's new strip seam), deterministic in both engines and confirmed
against a capture-harness noise floor (the same harness run twice at identical CSS was pixel-identical on
15 of 17 fixtures). **This is a visible UI change on a shipped surface that the ratified text said would not
move**, and it is recorded here as an observed consequence rather than smoothed over. Kim's byte-stability
constraint DOES hold, unchanged, for the two genuinely single-visible-child cases: `gen-ui-live`'s
bars-free shell (frame == middle before and after: 752==752, then 788==788) and `a2ui-live` (see 5). It also
holds for agent-admin at WIDE, where the strip is `display: none`.
**If the old spacing is wanted on agent-admin, the remedy is a consumer override and no component code** —
but note it is NOT a repoint of `--ui-super-shell-bar-seam`: that token is the bar seam, and this surface
has no bar. The old geometry put its 18px BELOW the strip (measured: strip bottom 78, `middle` top 96); the
new 6px sits ABOVE it. So the faithful restore is
`ui-tabs[data-part='narrow-tabs'] { margin-block-start: 0; margin-block-end: var(--ui-super-shell-gap) }`
on the consumer's own sheet — setting `margin-block-start` to a full gap would put the space on the wrong
side and push the content DOWN 18px instead of restoring it. Alternatively this clause gains a strip-seam
token of its own, which is the shape the rest of this record uses for every consumer-adjustable dimension.
**Not ruled here** — Kim's ruling did not reach the strip, and cl.7's own text offers the strip's
`padding-block-end` as an explicitly un-ruled build-time option for the same reason.
The measured numbers are pinned as a contract in `super-shell-bar-seam.browser.test.ts`.

**3 — the Amendment sheet's floating-cards item targets a sentence that is not in the SPEC.** The sheet's
second bullet amends *"SPEC-R11a, the floating-cards reading"*, quoting "rail/pane/pane-resizer … are
separate floating cards with gaps between them". `grep` over the whole of
`shell-archetypes-m5.spec.md` finds **no "floating card" language at all** — the sentence lives in
`super-shell.css`'s own GH #253 rationale comment, which cl.1's table row 4 also mis-attributes to
SPEC-R11a. Applied where it actually lives: the CSS comment is axis-qualified in place, and the normative
reading lands in the new **SPEC-R11d** with its true source named, instead of editing a SPEC sentence that
does not exist. R11d also carries cl.5's matrix and cl.6/cl.7's exceptions as the sheet's last bullet asks.

**4 — two census nits, and a second red-by-design test this record does not name.** cl.5's table lists
"`workspace-shell`'s header-only arm" under *shipped instances*: no live `ui-workspace-shell` exists
anywhere outside tests (`grep` for `createElement('ui-workspace-shell')`/`<ui-workspace-shell` outside
`*.test.*`: zero hits), so the header-only row is reachable from the public API but has no shipped witness
— R11d's table therefore omits the "shipped instances" column rather than repeat the claim. cl.7's "both
`ui-chat-shell` instances" are one each on `chat-shell.html` and `a2ui-chat.html`, not two on one page:
`chat-shell.ts`'s other `createElement('ui-chat-shell')` sits inside a CODE-SAMPLE string. Both witnesses
do author a header and a footer and do default to `narrow-start='stack'`, so cl.7's substance is unaffected.
Separately, cl.8 names `super-shell.browser.test.ts:125` as the one test that reds by design; there is a
**second**. `_page-responsive.browser.test.ts`'s S1 leak regression asserted `borderBottomWidth === 0` on a
nested demo shell's bar — sound only while a bar had no border of its own. Under cl.2 every bar draws 1px,
so `0` is the wrong expectation AND `1px` proves nothing, because the site-CSS leak and the legitimate
component seam are now the SAME VALUE. Re-pointed to the seam token (repoint the nested shell to `3px`,
assert `3px`), which preserves the original guarantee with a probe that still bites.

**5 — a third bars-free instance the census misses, and this one really is inert.** `a2ui-live` composes a
`ui-super-shell` with `nav-pane` + `content` only (`a2ui-live.ts:96/100`) — no bar — plus
`narrow-start='stack'`. Its frame has one visible child at every width, so the gap deletion is inert; and
because no bar exists, cl.7's F2 restore re-declares a value the frame never zeroed, so the column-posture
arm is inert too. It belongs in cl.5's inert row alongside `gen-ui-live`'s bars-free shell.

**Consequences of this REV, recorded.** cl.7's exception C ships HALF-BUILT by design, and that is a known
open fence, not an oversight: the strip owns its seam, the active narrow-tab pane's radius restore awaits a
coordinated repair of this clause (correct form: restore the **block-START** pair under
`:scope:has([data-part='narrow-tabs'])`, leaving the block-END squaring against the footer intact). cl.5's
inert row should read "a frame with ONE visible child", not "no bars authored" — the two are not the same
predicate once the narrow-tabs strip exists. Everything else in this record built as ruled and is proven
cross-engine: the frame's `gap` is gone (row-gap `normal`), each bar draws a 1px hairline absorbed inside
its unchanged 54px (the `content-box` control reads 55), the corner pair squares per side across all four
rows of cl.5's matrix on all three carded parts, the six overlay arms and both narrow-stack sides restore
as ruled, `middle` gains exactly 18px per authored bar (measured 752 → 788 on a two-bar shell), the
mandatory `> ` child combinator is proven load-bearing in both engines, GH #214's inline arithmetic and the
846px natural-fit number are untouched, and **AC19 held at its born-zero baseline with the allowlist at
exactly 2 and `shell-spacing-gate.test.ts` unedited** — verified with a biting control
(`--ui-super-shell-bar-seam-probe: 1.125rem` reds naming the literal) and with cl.8's own warning
confirmed: the same probe valued `1px` leaves the gate GREEN.

**Addendum 2026-07-31 (GH #380, cl.5's predicate correction).** This REV's own "Consequences" paragraph
above already states the corrected reading in passing; this addendum makes it the normative one. **cl.5's
inertness predicate is "a frame with ONE visible child," not "no bars authored."** The two coincide for
`gen-ui-live`'s bars-free shell and hold apart for `ui-agent-admin`: no bars, but the narrow-tabs strip is a
second frame child below 40rem (Context fact 3), so agent-admin was never inert — the −12px this record
already measures (item 2 above) is the proof. Every inert-arm claim elsewhere in this record — `gen-ui-live`
at every width, `a2ui-live` (item 5 above), and `ui-agent-admin` at WIDE only (the strip is `display: none`
there) — is a frame-with-one-visible-child instance, so no other row of cl.5's matrix changes; only the
STATED predicate does.

**Addendum 2026-07-31 (GH #380, exception C's coordinated repair landed).** Two statements above are now
false and this record's word on them is corrected here, in place, rather than left for a reader to trip
over. Item 1's line 534-536 called exception C "HALF-BUILT by design" and said the active narrow-tab
pane's radius restore "awaits a coordinated repair of this clause" — **that repair landed**: the pane
restores its block-START pair under `:scope:has([data-part='narrow-tabs'])`, leaving block-END squared
against the footer, exactly the form this REV already specified as correct. Item 1's line 457-460 also
called the strip's `margin-block-start` "the ruled declaration verbatim" — it no longer is. **The seam
moved INSIDE the strip's own border box**, consumed as `padding-block-start` off a new
`--ui-super-shell-narrow-tabs-seam` token, per this REV's own "Not ruled here" alternative (line 498-499):
composition-check.py's law is "a piece must not set its own outer margin," and the strip's old
`margin-block-start` was the one seam in this whole record living outside its owner's border box. Kim
accepted the −12px this REV measures (item 2 above) in the GH #380 Findings comment, 2026-07-31 — this
repair holds that acceptance exactly: the strip's box footprint (`padding(6) + box-height` vs. the old
`margin(6) + box-height`) is unchanged, so agent-admin's rendered geometry does not move a second time.
