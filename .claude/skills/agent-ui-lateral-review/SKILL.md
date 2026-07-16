---
name: agent-ui-lateral-review
description: >-
  Run a LATERAL review of the ui-* fleet — slicing all components by ONE pattern axis
  (construction · styling · attributes-as-API · traits) instead of one component by all axes —
  to catch the three defect classes vertical per-component review structurally misses:
  cross-component drift, canon gaps (law silent, builders diverged), and missed trait reuse.
  Use for "review all components' X consistency", "sweep the fleet for pattern drift",
  "re-audit axis Y after a law change", or after any multi-component build wave. Produces a
  findings table + routed fixes/tickets/law-amendments, never a blanket patch. NOT for one
  component's definition-of-done (the component-reviewer + rubrics/component.md own that,
  vertically) and NOT for designing a new component (agent-ui-component-design).
user-invocable: true
disable-model-invocation: false
---

# Lateral fleet review — the by-axis sweep

Vertical review (one component vs the law, at its DoD) cannot see BETWEEN components. This workflow
slices the other way: one context holds every component's treatment of ONE concern, so drift becomes
visible. Worked precedent: TKT-0046 (styling axis, manual — findings table, 1 mechanical fix, 3 routed
clusters). Motivating incident: TKT-0062 (four cross-component defects among five same-day,
individually-green components). Design record: TKT-0064.

## The five phases

1. **Census (deterministic — never hand-list).** Derive the work-list from the descriptor corpus:
   `grep -h "^tier:\|^extends:" packages/agent-ui/{components,app}/src/controls/*/*.md`. Per-axis
   exclusions come from the tier — Display/Container/Layout skip interaction-state checks;
   non-`UIFormElement` skip form-participation checks. Record the census IN the run's findings (the
   fleet grows; a re-run must show what it covered).
2. **Canon pack (per axis — pre-arm the reviewer).** Each axis reviewer receives: the axis's LAW docs,
   the gold exemplar(s), and the **ratified-deviations ledger** (below, per axis). A reviewer who
   re-flags a ledgered deviation is producing noise; a reviewer without the canon invents their own
   standard and produces pairwise "A differs from B" findings that never say which side is right.
3. **Sweep (axis-sliced fan-out).** One reviewer context per axis, reading that axis's SLICE of every
   in-scope control (the slices are small — never whole files). Every finding gets `file:line` evidence
   (the TKT-0042/0046 bar) and ONE of the four routes:
   - **DRIFT** — an outlier vs explicit canon → fix the outlier.
   - **GAP** — canon is silent and builders diverged → a ruling or `proposed` ADR fork (the reviewer
     NEVER invents the rule; the gap itself is the finding).
   - **UNRECORDED-DEVIATION** — looks deliberate but no ADR/ticket/comment records it → a ratify-or-fix
     decision (TKT-0062's select `:focus-visible` was exactly this, ratified retroactively).
   - **MISSED-REUSE** — hand-rolled behavior a trait/base already owns (traits axis).
4. **Verify (adversarial, BEFORE routing).** Open every cited law clause and confirm it says what the
   finding claims (verify-cited-authorities). Every BEHAVIORAL claim gets a real-browser probe on the
   element that renders the visible result — never accepted from a structural read (the TKT-0062
   ink-repaint bug passed every structural review and every builder-written test; only an engine probe
   of the EDITOR's computed color caught it). Findings that fail verification are dropped, not softened.
   Any TEXT-level scan feeding a census or a finding count STRIPS COMMENTS first (newline-preserving) —
   a banner comment quoting `@scope`/`var(--token)` matches a naive regex; campaign 1's follow-up
   census read 44 files raw vs 9 comment-stripped (the `stripComments` shape in
   `controls/styling-gates.test.ts`).
5. **Consolidate → route.** Dedup across axes (one root cause can surface on two). Then TKT-0046's
   routing discipline verbatim: mechanical/low-risk fixes inline with dated Findings entries; clusters
   needing design judgment → scoped follow-up tickets; GAPs → law-doc amendments or `proposed` ADRs
   (never self-ratified). One campaign ticket anchors the run; the findings TABLE (control × checks ×
   verdict) is the deliverable shape. **Run every specified probe BEFORE bundling rulings to Kim** — a
   finding routed as "needs a ruling" can dissolve under a cheap mutation probe (TKT-0068 item 3:
   "stale correction, delete or re-document?" resolved by MEASUREMENT — disable the code, run the
   suites, write the missing pin for whatever case fails — and left the bundle; only genuine judgment
   forks should spend a ruling slot). A ruled GAP should also leave a standing gate behind where the
   rule is text-checkable (`styling-gates.test.ts` is the worked shape: fs-walk + comment-strip + a
   synthetic negative control).

**Repeat triggers:** after each control wave · after any law change (the change names the axis it
invalidates — TKT-0062 made the styling axis due for entry controls the day after TKT-0046 swept it) ·
axes run independently. The execution vehicle is per-run (parallel agent fan-out for multi-axis;
TKT-0046 proved single-context works for one axis) — the phases are vehicle-neutral.

## Axis pack — construction

- **Slice:** each control's `.ts` — `connected()`, the parts-creation guard, listeners, effects.
- **Canon:** `dom/element.ts`/`dom/form.ts` contract comments · `interaction-states.md` §3 ·
  [[agent-ui-component-patterns]] rows. **Gold:** `controls/checkbox/checkbox.ts` (leaf) ·
  `conversation-composer.ts` (composed coordinator, reconnect-hardened).
- **Checklist (drift classes):** parts created ONCE behind an idempotent guard (light DOM persists
  across reconnect) vs rebuilt every connect · every listener rides `this.listen()` (the CURRENT
  connection's signal) and re-arms on reconnect — a listener armed inside the build-once branch is the
  known reconnect bug (TKT-0056 HIGH/MEDIUM: armed-flags + reference-equality guards need per-connect
  resets) · effects via `this.effect()` (scope-owned), never bare `effect()` · self-define guard present ·
  `data-part` naming per `naming.md` · JS-created children per the `master-detail.ts` precedent ·
  reconnect leaves zero residue (the C10 pattern).
- **Ledger (seeded by campaign 1, TKT-0065):** display-leaf WHOLE-SWAP is ruled, not drift —
  attachment/avatar/bar-chart/ramp/ladder/stat/sparkline rebuild content inside the RENDER EFFECT per
  their SPECs' whole-array-swap clauses (the parts-once canon governs interactive/stateful parts) ·
  THREE listener-lifetime tiers coexist soundly: (a) connection `this.listen` (default), (b)
  shorter-than-connection dedicated AbortController (text-field's per-type `typeAc`, command-modal's
  per-hotkey), (c) node-lifetime plain `addEventListener` on JS-created children that die with the node
  (settings/entry-list/swiper-paddles/…, reconnect-safe by construction) — tier (c) sites carry an
  in-file rationale · bare `effect()` is sanctioned ONLY in `settings/validate.ts` under its
  disposer-returned, owner-scoped contract.

## Axis pack — styling

- **Slice:** each control's `.css`.
- **Canon:** `interaction-states.md` (§1 action channels · §1b entry-control filled/container law,
  TKT-0062 · §2 ring · §3 disabled · §4 motion) · `tokens.md` · `geometry.md` · ADR-0003 two-block
  structure. **Gold:** `button.css` (action) · `text-field.css` (entry — the TKT-0062 template).
- **Checklist:** two-block structure + `@scope` token hygiene (own chain + the shared ring/motion
  exceptions only) · the RIGHT state table for the control's class (action §1 vs entry §1b) · §1b
  mechanics where entry: mutual-exclusion `:not()` precedence + token-repoint-not-host-property ·
  disabled = role-repoint, never opacity (undocumented opacity = UNRECORDED-DEVIATION) · motion
  `:state(ready)`-gated + reduced-motion zeroed (where the family takes the gate at all) · forced-colors
  block present · no `color-mix`/literals in state ladders.
- **Ledger:** Indicator/Range families take NO `:state(ready)` gate (ADR-0042 cl.2 — ruled, not a bug) ·
  `ui-select` trigger focus is keyboard-only `:focus-visible` (TKT-0062 Findings, ratified) ·
  `calendar.css`/`color-picker.css` disabled-opacity carry documented stacking-context rationales
  (TKT-0046 — judged intentional) · `ui-combo-box` has no motion block (TKT-0062 Findings — recorded,
  deferred) · text-channel rows have no idle fill to step (§1's own table) · `ui-tabs` ring offset is
  deliberately inset (documented in-file) · **(campaign 1, TKT-0065):** `ui-conversation-composer`'s
  focus is editor-only `:has([data-part='editor']:focus)`, never `:focus-within` (LLD CVC-C8) · its
  `[busy]` opacity dim layers ON TOP of the disabled-row role-repoint deliberately (TKT-0034) ·
  `ui-nav-rail`'s item ring is deliberately inset (in-file rationale, the tabs precedent) ·
  `ui-agent-admin` carries no forced-colors block by documented rationale · **dimensional constants
  route through the own chain (TKT-0066 item 5, Kim-ruled 2026-07-15):** `@scope` never reads
  `--ui-font-*`/`--ui-space-*`/`--ui-radius-base` directly — mint a role-named own-chain token
  (tokens.md §Consumption invariants owns the law; the fleet was swept clean, 9 files/22 reads); the
  sanctioned direct-read list stays ring/motion/`--ui-control-line-height` · `ui-command-modal`'s
  search is §1b's DEGENERATE sixth member (TKT-0068 item 4, Kim-ruled): permanently on the focus row
  (always-focused surface), ring suppressed by ratified deviation.
- **Standing due:** entry controls were LAST swept (TKT-0046) under the superseded border-only law —
  §1b conformance for text-field/textarea/select/combo-box/composer was proven by TKT-0062 itself, but
  any OTHER control with an editable/entry surface has never been checked against §1b.

## Axis pack — attributes-as-API

- **Slice:** each control's `static props` + descriptor frontmatter (`attributes`/`events`/`slots`).
- **Canon:** ADR-0004 (attributes-as-API) · `naming.md` (vocab law) · `dom/props.ts` (the schema
  primitives) · the closed event set `change · input · select · open · close · toggle`. **Gold:**
  `checkbox.md` · `text-field.md`.
- **Checklist (the LATERAL questions the per-control bijection gate can't ask):** same-named attributes
  agree on type/semantics/default ACROSS controls (`size` vocab, `disabled`, `value`, `open`,
  `placeholder`) · reflect policy is consistent (geometry/state-selector props reflect; rich data is
  `attribute:false`; a reflected JSON prop is a smell) · enum vocabularies match where concepts match
  (`variant` families) · opt-in props default `undefined` not `[]` (the descriptor round-trip rule) ·
  events ⊂ the closed six, callbacks-not-events at the app layer (SPEC-R5 lineage) · no boolean
  explosion a sibling solved with an enum.
- **Pre-pass (build on first run):** a script over the existing `@agent-ui/components/descriptor`
  parser emitting the cross-control attribute MATRIX (name × control → type/reflect/default) — makes
  half this axis mechanical. Census exclusions minimal: every component has an API.
- **Ledger:** `content-sm≡ui-md`,`content-md≡ui-lg` scale aliasing is deliberate (ADR-0038) ·
  `ui-textarea.rows` reflects by design (attr-based CSS repoint) · app-layer composer props are
  `attribute:false` by design (never author-composed) · **(campaign 1, TKT-0065):** `ui-column.align`'s
  4-member enum (no `center`) is a Kim ruling; `ui-swiper.align` is the 3-member scroll-snap dialect
  (ADR-0039) · `collapse` vocab is per-control (variant-like), both sides documented · `selected`
  grammar: string IDENTITY on containers, boolean STATE on items (native `<option selected>` parity) ·
  typed-text `value` never reflects (text-field/textarea/combo-box/composer — rides the editor surface),
  committed/config `value` reflects · json default grammar: display-data arrays default `[]` (the
  `String([])===''` bijection), controlled/opt-in seams default `undefined` · enum ORDER is API
  (`values[0]` = the `enumType.from` snap target) — an order-only vocab diff with matching defaults is
  benign · `variant` vocab divergence is canon-sanctioned (naming.md §3), never an enum-vocab flag ·
  **(TKT-0069 rulings, Kim 2026-07-16):** `label` reflects FLEET-WIDE (naming.md §3 — the 20
  non-reflecting controls were converted; do not flag reflected labels) · `scheme` sentinel canon =
  `'auto'` (theme-provider's `''` is §12-recorded, ADR-0117 load-bearing) · `duration` canon =
  milliseconds number (swiper's CSS-time string §12-recorded) · the `name`/`value` repurposers are RENAMED
  (executed 2026-07-16: icon.name→glyph · avatar.name→identity · attachment.name→filename ·
  stat.value→figure · swatch.value→color · swiper-item.value→key · progress.value→current ·
  tab.value→key) — flag any NEW repurposing as DRIFT · **the A2UI catalog's WIRE field names
  deliberately DIVERGE from the renamed component props** (`Icon.name` wire → `glyph` prop, etc. —
  `catalog.json` `mapsTo` + `mappedAccessorFactory` translate; corpus stability is the reason;
  naming.md §12 records it) — a catalog-vs-descriptor attribute-name mismatch on these six wire
  props is the ruled design, not drift · **(campaign 2, TKT-0070, Kim-ratified 2026-07-16):**
  per-control enum DEFAULT divergence on a shared/near-identical vocab is benign where each side
  cites its own ADR/ruling in-file (align's row/list/toolbar defaults; reflow's per-tag
  default-first ordering — "order-only diffs with matching defaults" was too narrow) · `min`/`max`
  carry TWO sanctioned senses (naming.md §3: value-domain bound vs CSS-length layout-dimension
  bound) — a cross-cluster type divergence is not drift · navigation-URL `href` reflects (§3);
  `ui-attachment.href`'s reflect:false is TEMPORARY-INERT, flips at its LLD-C6 wave — do not flag
  until then · `scheme` reflect split is principled: a JS-global-effect prop reflects
  (theme-provider), a pure-render input doesn't (ramp/swatch) · `rows` (table data vs textarea
  sizing) and `type` (pagination mode vs input-type) are confirmed different-concept matrix
  artifacts — suppress both in the pre-pass flag list next run.

## Axis pack — traits

- **Slice:** `traits/*.ts` signatures + every control's `connected()` trait call-sites + any
  hand-rolled keyboard/focus/overlay/drag/validity code.
- **Canon:** `traits/index.ts` + each trait's own header contract · `interaction-states.md` §3 (the
  trait-vs-control-effect split: focusability = trait; `ariaDisabled` CANNOT be a trait — protected
  `internals`) · ADR-0042 (`controls/_base/` families). **Gold:** `tabbable.ts` (effect-driven) ·
  `press-activation.ts` (listener-driven) — the pair IS the effect-vs-listener decision rule.
- **Checklist:** signature conformance `(host, opts) => release` · invoked directly from `connected()`
  (no `host.use()`) · `release()` idempotent · options are ACCESSORS (`() => boolean`) not captured
  values where reactivity is needed · **MISSED-REUSE sweep**: Space/Enter activation, tabindex
  management, roving focus, overlay open/dismiss, drag, user-invalid timing, value codecs — any control
  hand-rolling one of the 12 shipped traits' jobs · a `_base/` family fit that a raw-base control missed
  (ADR-0042: check the three families BEFORE a raw base).
- **Ledger:** `selectToEnd`/caret mechanics live per-control (contenteditable-specific, ADR-0134 — not
  a trait candidate yet) · `ui-menu`'s auto-role-assignment covers only first-connect children (its
  consumers set `role`/`tabindex` explicitly on late items — the documented workaround, not drift) ·
  **(campaign 1, TKT-0065):** `ui-toast-region` drives the Popover API manually (unanchored fixed stack —
  no positioning/focus/light-dismiss; in-file rationale) · `ui-combo-box`/`ui-command-modal` hand-roll
  active-descendant nav+commit (rovingFocus transfers REAL focus; selectionCommit commits via
  `document.activeElement` — both structurally wrong for focus-stays-on-editor; recorded in-file/LLD) ·
  connect-captured trait options are a convention, not a bug (overlay `placement`, rovingFocus
  `orientation` — take effect next reconnect, documented at every consumer) · `ui-calendar`'s 2D grid
  roving is bespoke by design (ADR-0048; 1-D rovingFocus can't serve a grid) · `ui-menu` commits via its
  own click+Enter/Space path (ratified — selectionCommit's `aria-selected` is invalid on `role=menuitem`
  and lacks Space; menu.ts carries the record) · **part-level disabled focusability =
  `removeAttribute('tabindex')`, never `'-1'` (TKT-0068 item 2, Kim-ruled 2026-07-15;
  interaction-states.md §3 owns the law)** — slider-multi thumbs + color-picker pad converted ·
  **drag-release belt-and-suspenders is the ruled shape (TKT-0068 item 1, Kim-ruled):** a valueDrag
  consumer explicitly releases its binding(s) in `disconnected()` (slider adopted slider-multi's shape) ·
  radio.ts's grouped() tabindex correction is LOAD-BEARING for late-appended radios (TKT-0068 item 3,
  measured by mutation probe; pinned by `group-tabindex-late-append`) — not stale, do not re-flag.

## Output contract (per run)

```
Campaign: <ticket id> · axes: <list> · census: <N controls, M excluded per axis + why>
Per axis: findings table (control × checks × verdict) · route counts (DRIFT/GAP/UNRECORDED/MISSED-REUSE)
Verified: <behavioral probes run + results> · Dropped in verification: <count>
Routed: <inline fixes w/ Findings entries> · <tickets filed> · <law amendments / proposed ADRs>
Ledger updates: <deviations ratified this run — append them to the axis pack above>
```

A run is **done** when every surviving finding is routed and the ledger is updated; **NOT done** when a
behavioral claim shipped unverified, a ledgered deviation was re-flagged as a finding, or findings were
"fixed" in bulk without the per-control evidence trail.

## Cross-links

Vertical DoD rubric → `rubrics/component.md` (this workflow complements, never replaces it) · design-time
law → [[agent-ui-component-standards]] · prior art → [[agent-ui-component-patterns]] · the test bar
findings cite → [[agent-ui-component-testing]] · new-component intake → [[agent-ui-component-design]].
