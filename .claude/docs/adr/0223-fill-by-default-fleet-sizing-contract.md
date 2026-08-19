# ADR-0223 — Fill by Default: adopt the fleet component-sizing contract WITH TWO AMENDMENTS — block-level fill hosts, ONE boolean `inline` opt-out, three-plus-one min-width roles, a ratified exemption table, a mechanical sizing lint gate, and a five-slice migration wave (supersedes ADR-0021's default-state floor; GH #1422)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 *(authored)* |
> | **Proposed by** | planning seat (design charter GH [#1422](https://github.com/kimgranlund/agent-ui/issues/1422) — gap analysis of the fleet against Kim's **"Fill by Default"** component-sizing contract, Kim's own artifact abstracted from AdiaUI; full width-opinion inventory in the Appendix, every row file:line-cited) |
> | **Ratified by** | *(pending — Kim, via a `ratify ADR-0223` utterance on GH #1422, executed by `scripts/adr_ratify.py` — ADR-0149)* |
> | **Repairs** | on ratification (booked per the GH #544 tracking-issue law): [ADR-0021](./0021-text-field-min-inline-size-floor.md) header gains **Superseded by ADR-0223** + Status → `superseded` (owner-side flip — the Status cell is owner-only) · the R5 wave tracking issue is filed with the five slices below verbatim · slice 0 lands (`sizing-gates.test.ts` report-shape + the `ui-text-field` `inline` pilot) · `references/geometry.md`'s frame-law `min-inline-size` class-split gains the fill/hug state-split note |
> | **Supersedes / Superseded by** | **Supersedes [ADR-0021](./0021-text-field-min-inline-size-floor.md)** (its ~20ch entry floor is PRESERVED but moves to the `[inline]` hug state — clause 3; the bare-control-hittability lesson survives, restated under the new default). Relates [ADR-0016](./0016-a2ui-faithful-flex-layout-container-queries.md) · [ADR-0030](./0030-column-default-cross-axis-stretch.md) · [ADR-0075](./0075-ui-column-canvas-root-stretch-no-center.md) (the A2UI stretch law this contract finally matches, clause 6) · [ADR-0100](./0100-query-container-boundary-establishment.md) (cl.3's measured host-unclamp disposition — amendment A2's evidence) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (bare-markup honesty) · [ADR-0110](./0110-visual-regression-pixel-diff-harness.md) (the golden-regen leg of slice 4) · [ADR-0107](./0107-chart-family-v1-scope.md) (the display-class leaves whose whole-shape floors amendment A1 ratifies) |

## Context

**The contract under evaluation.** Kim's **"Fill by Default"** artifact (abstracted from AdiaUI)
states five rules:

- **R1 — FILL BY DEFAULT.** Every composite/control/container renders block-level and stretches to
  the parent's inline space; NO intrinsic width in the default state — no fit-content hosts, no
  character-based minimums.
- **R2 — ONE OPT-OUT.** A single boolean `inline` attribute flips BOTH display level (inline) and
  sizing posture (hug). No separate hug attribute; no block-but-hugging state (a consumer wanting
  that sets an explicit width).
- **R3 — EXACTLY THREE legitimate min-width roles.** (a) squareness floors —
  `min-width: var(--component-height)` on interactive controls, surviving all states; (b)
  hug-state content floors ONLY (the 20ch class, token-overridable; the fill state needs no floor —
  the container is the floor); (c) inner `min-width: 0` unclampers on flex ITEMS only, never
  hosts. Any other min-width = lint defect.
- **R4 — NAMED EXEMPTIONS, ratified once.** Floating surfaces (menus/popovers/command palettes —
  small token-overridable rem floors) and text-flow atoms (badges, chips, icons, inline text/links).
- **R5 — GATED + WAVED.** A mechanical lint gate scans component styles for inline-level host
  displays and out-of-role width floors; flipping a shipped default is a BREAKING change shipped as
  one ratified wave — decision record, migration guide, deliberately regenerated visual goldens,
  reference-consumer sign-off before the release.

**What the fleet actually ships (the Appendix inventory, 87 host rows swept).** The verdict
distribution: **42 CONFORM** (already block-level fill — every container, media element, shell,
and list-shaped leaf) · **15 R1-VIOLATE** (13 inline-posture hosts + 2 block hosts carrying a
default-state content floor) · **11 CONTESTED whole-shape floors** (block-level fill hosts whose
default-state `min-inline-size` fits none of R3's three roles) · **14 R4-EXEMPT** · **5 GENUINELY
AMBIGUOUS**. The worst offenders are exactly the fleet's oldest and most-used controls: the entry
family (`ui-text-field` inline-grid + 20ch, `ui-select` inline-block + 10ch, `ui-combo-box`
inline-grid + 20ch, `ui-multi-select` inline-block + 12ch — the ADR-0021 class) and `ui-button`
(inline-grid hug — the single highest-blast-radius flip in the wave).

**The three honest tensions this record must resolve rather than paper over:**

1. **ADR-0021 is contradicted in its default-state placement, vindicated in its lesson.** Its ~20ch
   floor sits on the HOST in the DEFAULT state (`text-field.css:96,152`) — under R1+R3(b) that is a
   violation (the fill state needs no floor). But the defect it fixed — a bare, unsized field
   collapsing to a ~0-width unhittable sliver — was real and measured (the `s11` browser smoke).
   Under fill-by-default the bare-field case is covered by the DEFAULT itself: a block-level field
   in any normal container fills it. The degenerate hug context (where the collapse lived) becomes
   exactly the `[inline]` state — where R3(b) says the floor legitimately lives. So ADR-0021 is
   SUPERSEDED, not repudiated: the token and the floor survive verbatim, scoped to `[inline]`.
   The recent dogfood scrub (GH #1407) leaned on `--ui-select-min-inline-size` /
   `--ui-text-field-min-inline-size` — those tokens keep working; only the state they bind to moves.
2. **The fleet has an ESTABLISHED fourth min-width role the contract doesn't name.** Eleven
   block-level display leaves carry a "whole-shape floor" (`bar-chart` 16em, `line-chart` 16em,
   `pie-chart` 16em, `ladder` 16em, `table` 16em, `progress` 8em, `ramp` 8em, `slider` 12rem,
   `slider-multi` 12rem, `timeline` 12rem, `status-stream` 16rem — Appendix §C). The ROLE is
   SPEC-ratified across five families — `chart-family.spec.md` SPEC-R9, `feed-family.spec.md`
   SPEC-R18, `report-family.spec.md` SPEC-R14/R17 (plus `ui-stat`'s own SPEC-R10),
   `token-surfaces.spec.md` SPEC-R13, `timeline-family.spec.md` SPEC-R14 — but honestly, only ~6
   of the 11 rows carry a citable per-row AC (Appendix §C names each); the remainder (`ladder`,
   `slider`, `slider-multi`, and `line`/`pie`'s mirror comments) carry the same measured defect
   class without one: the slider-dot lesson — a track-shaped leaf crushed by a flex row renders
   as a meaningless sliver.
   These floors are not hug floors (the hosts are already block-fill) and not squareness floors.
   Strict R3 calls all eleven lint defects; deleting them re-opens eleven measured regressions.
3. **Host-level `min-inline-size: 0` unclampers exist and are measured-correct.** `card.css:168`
   (ADR-0100 cl.3's audited disposition — the host IS a flex/grid item of its parent; the unclamp
   is what lets a card row compose), plus `drill`, `field`, `toolbar`, `super-shell`,
   `agent-admin`, `conversation`. R3(c)'s letter says "never hosts" — but a `0` unclamp is the
   OPPOSITE of a width opinion (it removes an intrinsic floor; it is fill-posture-consistent).

**Why the fleet drifted inline in the first place — and why it rarely showed.** Inside any flex or
grid container, CSS blockifies an inline-level child (`display: inline-grid` computes to `grid`),
and A2UI's own layout law stretches it (ADR-0030's Column cross-axis stretch default, ADR-0075's
canvas-root stretch, ADR-0016's faithful flex). So on catalog surfaces the inline posture is
ALREADY ignored — the mismatch only manifests in plain block flow (docs prose, `card`'s flow-root
interior, any CSS-less consumer page — the ADR-0102 honesty surface), where today's controls hug.
Fill-by-default doesn't fight the A2UI layout law; it extends to block flow the exact behavior
A2UI containers already impose. That is the whole catalog implication, and it cuts FOR adoption.

**One naming fact confronted:** `ui-slider` already ships `layout="inline"` (GH #1141,
`slider.css:165`) — an INTERNAL part-placement axis (label/value beside the rail), not a sizing
posture. The two attributes are distinct axes and coexist (`<ui-slider inline layout="inline">` is
coherent: hug the host, inline the label). R2 mandates the bare `inline` name; no rename is taken.

## Decision

**We ADOPT the Fill by Default contract fleet-wide — R1, R2, R4, and R5 as written, R3 with two
amendments (A1: a fourth ratified floor role for whole-shape display leaves; A2: host-level `0`
unclampers are legal) — and ship the flip as one ratified breaking wave in five slices.** Seven
clauses.

1. **R1 adopted.** Every non-exempt control/composite/container host renders block-level
   (`block` / `flex` / `grid` / `flow-root`) and stretches to the parent's inline space. The 13
   inline-posture hosts and 2 default-state content floors in Appendix §B migrate on the wave.
2. **R2 adopted — `inline` minted FLEET-WIDE as one shared boolean attribute,** not per-tier: a
   reflected boolean prop (`static props`, ADR-0005 shape) + a `:scope[inline]` CSS leg flipping
   BOTH display level (the control's inline-level counterpart) and sizing posture (hug, with the
   R3(b) content floor active). It ships on every control the wave flips (the §B set); already-
   conforming fill hosts (§A) add it lazily on first real demand, never speculatively. No `hug`
   attribute, no block-but-hugging state — a consumer sets explicit `inline-size` for that.
   **Catalog-invisible at v1:** no A2UI catalog row gains an `inline` property — catalog surfaces
   render in Column/Card containers where the fill default is the law (ADR-0030/0075); `inline`
   is a page-author affordance.
3. **R3 adopted with amendment A1 (the plus-one role).** The legitimate min-width roles are:
   **(a)** squareness floors — `min-inline-size: var(--ui-{name}-height)` on interactive controls,
   surviving all states (`button.css:95`; `badge.css:89`'s empty-label box floor is the same role
   on a display atom); **(b)** hug-state content floors ONLY — every entry-class ch floor
   (`text-field` 20ch, `textarea` 20ch, `combo-box` 20ch, `select` 10ch, `multi-select` 12ch,
   `conversation-composer` 20ch) moves from the default block into the `:scope[inline]` leg, token
   names and defaults unchanged — **this is ADR-0021's supersession**; **(c)** inner
   `min-inline-size: 0` unclampers on flex/grid ITEMS — including, per **amendment A2**, the HOST
   when the host is itself the flex/grid item (the ADR-0100 cl.3 measured card disposition;
   `card.css:168` and kin stay); **(d) — amendment A1** — whole-shape floors on track/data-shaped
   display leaves (Appendix §C's eleven, plus `stat` 8em and `attachment` 12em once their posture
   flips), token-overridable, SURVIVING the fill state, each traceable to its family's SPEC floor
   law or, where no per-row AC exists, to the measured defect class (§C's per-row anchors). Role (d)
   is a closed, ratified list — this table, extended only by ADR. Any min-width outside (a)–(d)
   and the R4 table is a lint defect from slice 3 on.
4. **R4 adopted — the exemption table, ratified once, here.** **Floating surfaces** (small rem
   floors legal, token-overridable): `ui-menu` (10rem), `ui-popover` (8rem), `ui-tooltip` (4rem),
   `ui-modal`, `ui-drawer`, `ui-command-modal`, `ui-form-popover` PANEL (20ch), `ui-toast`
   (fixed-width token + `max-inline-size: 100%`), plus the four owned panels — select listbox
   (12ch), combo-box panel (12rem), nav-rail flyout (12rem), composer menu (12rem). **Text-flow /
   display atoms** (inline-level posture IS their nature): `ui-badge`, `ui-icon`, `ui-avatar`,
   `ui-swatch`, `ui-sparkline` (fixed inline-size token — an inline data glyph), swiper's label
   leaf. **Interaction-geometry leaves** (fleet-tier mapping of R4's spirit): `ui-otp-field` (the
   N-cell grid's intrinsic size IS its shape — its header already rules the no-floor deviation,
   `otp-field.css:13`; it keeps inline-grid), `ui-segment` (a full-cell PART of segmented-control's
   track, not a standalone host), split-pane's drag floor (`split-pane.css:51` — a resizable-pane
   interaction floor, released in vertical orientation), surface-host's `[bare]` `fit-content`
   variant (an explicit non-default state — effectively the fleet's first hug-state precedent).
5. **R5 adopted — the lint gate.** ONE fleet-wide scan test,
   `packages/agent-ui/components/src/controls/sizing-gates.test.ts`, sited beside
   `styling-gates.test.ts` / `naming-gates.test.ts` and in their exact shape: raw-text fs-read of
   every control stylesheet (components + app), comments blanked, the FIRST `:scope` block of each
   `@scope` body extracted brace-matched, then two closed rules — (i) no inline-level `display`
   value on a non-exempt host; (ii) no host `min-inline-size`/`min-width` other than `0`, the
   squareness form, or a ratified allowlist entry (the clause 3(d) + clause 4 tables, mirrored as
   a `const` in the test with a comment pointing here) — plus a synthetic negative control proving
   the scan bites. It lands in slice 0 REPORT-shape (allowlist = today's full §B/§C state, so the
   gate is green while enumerating the debt) and flips enforcing in slice 3.
6. **The A2UI statement (chartered, stated plainly):** fill-by-default FITS the A2UI layout law.
   Catalog surfaces render inside Card/Column containers whose children are blockified and
   stretched already (ADR-0016/0030/0075); adopting R1 makes block-flow surfaces (docs prose,
   card interiors, ADR-0102's CSS-less consumer) behave identically to catalog surfaces instead of
   diverging from them. No catalog schema, renderer, or corpus change is needed — zero A2UI bytes
   move in this wave.
7. **The wave (R5's breaking-change law) — five slices, one ratified release train:**
   - **Slice 0 (on ratification, size:small):** `sizing-gates.test.ts` report-shape + the pilot —
     `ui-text-field` flips (block fill default; `[inline]` hug leg carrying the 20ch floor), its
     visual goldens deliberately regenerated (ADR-0110 harness, the `RECAPTURE_BASELINE=1` path),
     the migration-guide stub opened.
   - **Slice 1 (size:big):** the entry family — `textarea`, `select`, `combo-box`, `multi-select`,
     `conversation-composer` (+ the form-popover TRIGGER ruling, Appendix §E). The ADR-0021
     supersession leg completes.
   - **Slice 2 (size:big, highest visual blast radius):** action/selection — `button`, `toggle`,
     `checkbox`, `radio`, `switch`, `pagination`, `calendar`. Buttons full-width in block flow is
     the single most visible delta of the whole wave; slice 2's goldens are reviewed by eye, not
     just by diff count.
   - **Slice 3 (size:big):** display composites — `stat`, `attachment` flip posture (floors
     reclassify to role (d)); the five §E ambiguous rows get their rulings executed; the gate
     allowlist shrinks to the clauses 3(d)+4 tables and flips ENFORCING.
   - **Slice 4 (release):** fleet-wide golden regen + `eval:catalog` + reference-consumer
     sign-off — the docs site and agent-admin, both swept at real breakpoints; **the sign-off is
     KIM'S**, recorded as his comment on the wave tracking issue before the release cut (the
     slices only prepare the evidence) — migration guide finalized, ONE breaking release cut. No
     slice ships its flip to a release before slice 4;
     `main` carries the wave behind the gate's report-mode until the train departs.

## Non-goals

- **A `hug` attribute, a `block`+hug state, or a width prop** — R2 forbids all three; explicit
  `inline-size` is the consumer's tool (ADR-0021's own "width is the layout's job" stance, kept).
- **Touching part-level interior floors** — source-list's 1.5em index column, entry-list's 8ch
  label, description-list's opt-in label dial: interior content-box geometry, not host width
  opinions; the gate scans hosts only.
- **An A2UI catalog `inline` property or any catalog/renderer change** — clause 2/6.
- **Renaming `ui-slider`'s `layout="inline"`** — a different axis, confronted in Context.
- **Retro-flipping the R4 atoms** (badge/icon/avatar/swatch/sparkline) to fill — their inline
  posture is the exemption, permanently.

## Consequences

- **The fleet gains one sizing dialect instead of two.** Today a consumer must know which controls
  hug (entry family, buttons, toggles) and which fill (containers, media, charts); after the wave
  the answer is "everything fills; `inline` hugs" — the AdiaUI contract's whole point.
- **BREAKING, visibly.** Bare controls in block flow widen — most visibly buttons. That is the
  deliberate, ratified trade (R5); the wave's golden-regen + reference-consumer legs exist to make
  it a reviewed change, not a discovered one. Downstream consumers get the migration guide's
  one-liner: "add `inline` where you relied on hug."
- **ADR-0021 superseded, its lesson intact** — the floor tokens survive in the `[inline]` state;
  `geometry.md`'s frame-law class-split gains the state-split note (Repairs).
- **Eleven measured floors survive** as ratified role (d) instead of dying to the letter of R3 —
  the amendment is the difference between adopting a contract and re-fighting eleven closed
  defects.
- **A standing mechanical gate** makes the next inline-posture host a build defect from day one,
  same as styling-gates did for token reads.
- **Stale → re-verify on ratification:** ADR-0021 header, `geometry.md`, the per-control `.md`
  descriptor `geometry:` lines of every flipped control, and the ADR-0110 golden baselines — all
  booked on the wave slices, none silently.

## Acceptance

This is a **contract-adoption** ADR — the record itself ships no control-CSS change:

- **This change:** this record passes the ADR gates (`site/lib/adr.test.ts` grammar,
  `site/lib/docs-grammar.test.ts` link sweep — 0222→0223 is contiguous, so `KNOWN_GAPS` is
  untouched) and `npm run check:scripts` stays green. No file under `packages/` moves.
- **On ratification:** `adr_ratify.py` flips Status + Ratified-by; the Repairs items book per the
  GH #544 law; slice 0 lands with its own gates (`npm run check && npm test`, pilot goldens
  regenerated deliberately); slices 1–4 each run the full gate ladder incl. `test:browser` and the
  ADR-0110 visual harness before merge.
- **The wave's own acceptance** (per slice): the sizing gate's allowlist shrinks monotonically;
  a flipped control's browser test gains the two-posture leg (bare host `offsetWidth` ≈ container
  inline size; `[inline]` host `offsetWidth` ≥ its content floor and < container) — the ADR-0021
  smoke leg, generalized.

## Alternatives considered

- **Adopt verbatim (no amendments).** Rejected: strict R3 deletes eleven SPEC-ratified whole-shape
  floors (re-opening the slider-dot defect class measured per control) and outlaws the ADR-0100
  cl.3 host unclamp that a real audit already dispositioned as correct. A contract adopted against
  the fleet's own measured evidence would be reverted piecemeal within a quarter — adapt once,
  ratified, instead.
- **Status quo (decline).** Rejected: the two-dialect state is real debt — the inventory shows 15
  violations concentrated in the fleet's MOST-used controls, every A2UI surface already imposes
  fill (Context's blockification finding), and each new control re-litigates its posture ad hoc
  (`otp-field`'s header literally argues its deviation from a rule that was never written down).
  The contract exists; the fleet is 42/87 conformant by accident; ratifying makes it law.
- **Partial adoption — new components only.** Rejected: perpetuates both dialects FOREVER (the
  worst offenders are the oldest controls, which would never flip), the lint gate would need a
  grandfather list that never shrinks, and the docs site would teach two postures indefinitely.
  R5 exists precisely because a default flip must be waved, not dodged.
- **Fill-by-default via a fleet-wide stylesheet override** (one `:where(ui-*) { display: block }`
  layer instead of per-control edits). Rejected: `:where()`-level overrides lose to each control's
  own `@scope` rules, the per-control `[inline]` legs still need authoring control-by-control, and
  the single-file-component CSS law (ADR-0003 discipline) keeps posture where the control lives.
- **A `hug` attribute alongside `inline`** (decouple display level from sizing posture). Rejected
  by R2's own reasoning: the block-but-hugging middle state is expressible with explicit width,
  and a second boolean doubles the state matrix on every control for a posture nobody has asked
  for. (Kept available to a future ADR if a real consumer surfaces.)

## Appendix — the fleet width-opinion inventory (2026-08-19, branch `fill-by-default-design`)

Paths abbreviated: `C/` = `packages/agent-ui/components/src/controls/` · `A/` =
`packages/agent-ui/app/src/controls/`. Verdicts: **CONF** = conforms · **V-P** = R1 violation
(inline posture) · **V-F** = R1 violation (default-state content floor, posture already block) ·
**R3d** = contested whole-shape floor (legit under amendment A1) · **R4** = exempt · **AMB** =
genuinely ambiguous. "Slice" = migration wave slice (— = no change).

### §A — CONFORMS (42)

| Host | Posture (file:line) | Notes | Verdict |
|---|---|---|---|
| ui-audio | `block` + `inline-size:100%` `C/audio/audio.css:14-15` | | CONF |
| ui-code | `block`, `max-inline-size:100%` `C/code/code.css:49,59` | | CONF |
| ui-card | `flow-root` + host `min-inline-size:0` `C/card/card.css:150,168` | A2 host-unclamp (ADR-0100 cl.3, measured) | CONF |
| ui-color-picker | `flex` `C/color-picker/color-picker.css:56` | inner `0` unclampers `:141,163` — R3(c) | CONF |
| ui-column | `flex` `C/column/column.css:106` | the A2UI stretch container itself | CONF |
| ui-description-list | `flex` `C/description-list/description-list.css:39` | label floor token DEFAULTS to 0 (`:32,56` — opt-in dial); value `0` unclamp `:63` | CONF |
| ui-disclosure | `block` `C/disclosure/disclosure.css:72` | inner `0` `:137` — R3(c) | CONF |
| ui-drill | `flex` + host `0` `C/drill/drill.css:48,50` | A2 host-unclamp | CONF |
| ui-field | `flex` + host `0` `C/field/field.css:76,79` | "the slotted control brings its own floor; the field adds none" | CONF |
| ui-form-provider | `block` `C/form-provider/form-provider.css:36` | | CONF |
| ui-grid | `grid` `C/grid/grid.css:64` | | CONF |
| ui-image | `flex` + `100%` `C/image/image.css:52,57` | | CONF |
| ui-list | `flex` `C/list/list.css:105` | | CONF |
| ui-radio-group | `flex` `C/radio/radio-group.css:56` | | CONF |
| ui-row | `flex` `C/row/row.css:112` | | CONF |
| ui-sandbox-frame | `block` + `100%` `C/sandbox-frame/sandbox-frame.css:39,41` | | CONF |
| ui-segmented-control | `grid` `C/segmented-control/segmented-control.css:87` | | CONF |
| ui-source-list | `flex` `C/source-list/source-list.css:42` | index part floor 1.5em `:58` is interior alignment geometry (Non-goals) | CONF |
| ui-split | `flex` `C/split/split.css:53` | pane floor → §E | CONF |
| ui-suggestions | `flex` `C/suggestions/suggestions.css:61` | chip children inline-flex `:83` — parts | CONF |
| ui-swiper | `block` `C/swiper/swiper.css:73` | item `0` unclamp `swiper-item.css:12` — R3(c); charter's "swiper display posture" tension: RESOLVED conforming | CONF |
| swiper paddles/pagination | `flex` `C/swiper/swiper-paddles.css:9`, `swiper-pagination.css:9` | parts | CONF |
| ui-tabs | `block` `C/tabs/tabs.css:81` | vertical strip `max-content` `:200` is a PART in an explicit orientation state; panel `0` unclampers `:231,280` | CONF |
| ui-text | `block` `C/text/text.css:246` | Display class has no frame law (ADR-0025 cl.1, stated at `:254`) | CONF |
| ui-theme-provider | `block` `C/theme-provider/theme-provider.css:44` | | CONF |
| ui-timeline-item | `grid` `C/timeline-item/timeline-item.css:227` | inner `0` `:397` | CONF |
| ui-toast-region | (positioning container) `C/toast/toast-region.css` | | CONF |
| ui-toolbar | `flex` + host `0` `C/toolbar/toolbar.css:89,97` | A2 host-unclamp | CONF |
| ui-video | `block` + `100%` `C/video/video.css:28,31` | charter's "media posture": RESOLVED conforming | CONF |
| ui-agent-admin | `flex` + host `0` `A/agent-admin/agent-admin.css:135,138` | | CONF |
| ui-chat-shell | `flex` `A/chat-shell/chat-shell.css:11` | | CONF |
| ui-conversation | `flex` + `0` + `100%` `A/conversation/conversation.css:79,82,84` | | CONF |
| conversation-dialog / -header | `flex` `A/conversation/conversation-dialog.css:39`, `conversation-header.css:28` | | CONF |
| ui-entry-list | `flex` `A/entry-list/entry-list.css:65` | interior label floor 8ch `:160` — part (Non-goals) | CONF |
| ui-master-detail (+pane) | `flex`/`block` `A/master-detail/master-detail.css:40`, `master-detail-pane.css:15` | | CONF |
| ui-nav-rail | `flex` `A/nav-rail/nav-rail.css:100` | flyout floor → R4 table | CONF |
| ui-settings | `flex` `A/settings/settings.css:34` | | CONF |
| ui-super-shell | `flex` + host `0` `A/super-shell/super-shell.css:124,126` | canvas floor token `:484` is a shell-layout dial | CONF |
| ui-surface-host | `block` + `100%` `A/surface-host/surface-host.css:74,78` | `[bare]` variant → §E | CONF |
| ui-workspace-shell | `flex` `A/workspace-shell/workspace-shell.css:10` | | CONF |

### §B — R1 VIOLATIONS (15 — the wave's migration set)

| Host | Posture (file:line) | Width opinion (file:line) | Verdict | Slice |
|---|---|---|---|---|
| ui-text-field | `inline-grid` `C/text-field/text-field.css:140` | 20ch host floor `:96,152` (ADR-0021) | V-P + misplaced (b) | 0 (pilot) |
| ui-textarea | `block` `C/textarea/textarea.css:119` | 20ch default-state floor `:82,124` | V-F | 1 |
| ui-select | `inline-block` `C/select/select.css:186` | 10ch floor `:79,187` (leaned on in GH #1407) | V-P + misplaced (b) | 1 |
| ui-combo-box | `inline-grid` `C/combo-box/combo-box.css:172` | 20ch floor `:104,173` | V-P + misplaced (b) | 1 |
| ui-multi-select | `inline-block` `C/multi-select/multi-select.css:116` | 12ch floor `:40,119` | V-P + misplaced (b) | 1 |
| conversation-composer | `flex` `A/conversation/conversation-composer.css:135` | 20ch default-state floor `:67,140` | V-F | 1 |
| ui-button | `inline-grid` `C/button/button.css:87` | squareness floor `:95` is R3(a)-LEGIT, stays | V-P | 2 |
| ui-toggle | `inline-grid` `C/toggle/toggle.css:98` | | V-P | 2 |
| ui-checkbox | `inline-flex` `C/checkbox/checkbox.css:74` | | V-P | 2 |
| ui-radio | `inline-flex` `C/radio/radio.css:82` | | V-P | 2 |
| ui-switch | `inline-flex` `C/switch/switch.css:93` | | V-P | 2 |
| ui-pagination | `inline-flex` `C/pagination/pagination.css:28` | | V-P | 2 |
| ui-calendar | `inline-block` `C/calendar/calendar.css:145` | fluid tracks (ADR-0105) make fill natural | V-P | 2 |
| ui-stat | `inline-grid` `C/stat/stat.css:63` | 8em floor `:47,65` → role (d) on flip (`report-family.spec.md` SPEC-R10 `:249` — its own whole-shape AC) | V-P | 3 |
| ui-attachment | `inline-grid` `C/attachment/attachment.css:48` | 12em floor `:32,57` → role (d) (`feed-family.spec.md` SPEC-R18 `:153`); `max-inline-size:100%` `:58` drops on flip | V-P | 3 |

### §C — CONTESTED whole-shape floors → ratified role (d) under amendment A1 (11)

SPEC anchors verified against the owning file (the corpus holds ≥4 distinct SPEC-R9s — every
anchor below is file-qualified; "no per-row AC" rows carry the measured defect class only):

| Host | Posture | Floor (file:line) | SPEC anchor (owning file, verified) |
|---|---|---|---|
| ui-bar-chart | `grid` `C/bar-chart/bar-chart.css:54` | 16em `:40,59` | `chart-family.spec.md` SPEC-R9 AC1 (`:111` — box ≥ token floor, both engines) |
| ui-line-chart | `grid` `C/line-chart/line-chart.css:45` | 16em `:32,48` | no per-row AC — mirrors `chart-family.spec.md` SPEC-R9 (the CSS comment's own lineage, `:32`) |
| ui-pie-chart | `grid` `C/pie-chart/pie-chart.css:68` | 16em `:35,73` | no per-row AC — `chart-family.spec.md` SPEC-R9 precedent (CSS comment, `:35`) |
| ui-ladder | `grid` `C/ladder/ladder.css:44` | 16em `:32,49` | no per-row AC — measured whole-shape class only |
| ui-table | `block` `C/table/table.css:68` | 16em `:44,69` | `report-family.spec.md` SPEC-R14 (floors, `:312,316`) + SPEC-R17 (Display-class posture, `:352`) |
| ui-progress | `block` `C/progress/progress.css:58` | 8em `:45,59` | `feed-family.spec.md` SPEC-R18 (`:153` — floors MANDATORY, the slider-dot shape named) |
| ui-ramp | `flex` `C/ramp/ramp.css:37` | 8em `:30,45` | `token-surfaces.spec.md` SPEC-R13 AC1 (`:213,223` — NOT report-family's R13, which is the badge box law) |
| ui-slider | `grid` `C/slider/slider.css:145` | 12rem `:148` | no per-row AC — the slider-dot lesson itself (the class's origin) |
| ui-slider-multi | `grid` `C/slider-multi/slider-multi.css:91` | 12rem `:96` | no per-row AC — slider's sibling |
| ui-timeline | `flex` `C/timeline/timeline.css:27` | 12rem `:20,31` | `timeline-family.spec.md` SPEC-R14 AC1/AC2 (`:282-289`) |
| ui-status-stream | `flex` `C/status-stream/status-stream.css:147` | 16rem `:18,149` | `timeline-family.spec.md` SPEC-R14 (per-host family law — status-stream is a named family host, `:1`; the ACs exemplify timeline/item only) |

### §D — R4 EXEMPT (14)

| Host | Evidence (file:line) | Category |
|---|---|---|
| ui-badge | `inline-flex` + box floor `C/badge/badge.css:84,89` | text-flow atom (contract-named) |
| ui-icon | `inline-flex`, fixed size `C/icon/icon.css:28-29` | text-flow atom (contract-named) |
| ui-avatar | `inline-grid`, fixed size `C/avatar/avatar.css:50,54` | icon-class atom |
| ui-swatch | `inline-grid` `C/swatch/swatch.css:38` | icon-class atom |
| ui-sparkline | `inline-block`, fixed-width token `C/sparkline/sparkline.css:40-41` | inline data glyph |
| swiper label | `inline` `C/swiper/swiper-label.css:8` | text-flow leaf |
| ui-menu | `contents`; panel 10rem `C/menu/menu.css:42,156,167` | floating surface |
| ui-popover | `contents`; panel 8rem `C/popover/popover.css:43,52,64` | floating surface |
| ui-tooltip | `contents`; panel 4rem `C/tooltip/tooltip.css:41,50,62` | floating surface |
| ui-modal / ui-drawer | `contents` `C/modal/modal.css:61`, `C/drawer/drawer.css:82` | floating surface |
| ui-command-modal | `contents` `C/command-modal/command-modal.css:77` | floating surface |
| ui-form-popover | `contents`; panel 20ch `C/form-popover/form-popover.css:63,89,171` | floating surface (trigger → §E) |
| ui-toast | `grid`, width token + `max:100%` `C/toast/toast.css:50,56-57` | floating surface |
| owned panels | select listbox 12ch `C/select/select.css:356` · combo-box panel 12rem `C/combo-box/combo-box.css:335` · nav-rail flyout 12rem `A/nav-rail/nav-rail.css:308` · composer menu 12rem `A/conversation/conversation-composer.css:297,365` | floating surface floors |

### §E — GENUINELY AMBIGUOUS (5 — each gets its ruling executed in slice 3)

| Host | Evidence (file:line) | The ambiguity | Proposed ruling |
|---|---|---|---|
| ui-otp-field | `inline-grid` `C/otp-field/otp-field.css:95`; deliberate no-floor doctrine `:13` | its N-cell grid's intrinsic size IS its shape — "fill" would stretch cells absurdly | R4 interaction-geometry exempt (clause 4) |
| ui-segment | `inline-flex` `C/segment/segment.css:37` | a full-cell PART of segmented-control's track, yet its own element | R4 part-exempt; never used standalone |
| split-pane floor | `min-width` drag floor `C/split/split-pane.css:51` (released `:58`) | none of roles (a)–(d): an interaction floor for resizable panes | R4 interaction-geometry exempt |
| surface-host `[bare]` | `fit-content` `A/surface-host/surface-host.css:156,181` | an intrinsic width, but in an EXPLICIT variant state, not the default | keep — it is a hug STATE (the contract's own shape); rename to `[inline]` alignment considered in slice 3 |
| form-popover trigger | 10ch `C/form-popover/form-popover.css:54,101` | a trigger is control-like (squareness-adjacent) but 10ch is a content floor | slice 1 with the entry family: floor → `[inline]`/hug context, squareness floor retained |

**Counts: 42 CONF · 15 V (13 V-P + 2 V-F) · 11 R3d · 14 R4 · 5 AMB = 87 rows.**
