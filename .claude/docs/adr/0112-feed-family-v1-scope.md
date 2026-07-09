# ADR-0112 — Feed/agent-activity family v1 scope: `ui-progress` + `ui-avatar` + `ui-attachment` + `ui-toast`(+region) — bar-only progress, no-hue avatar, FilePart-aligned attachment card, region-hosted never-focus-stealing toast; three catalog rows + a reasoned two-entry allowlist

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | planner (design seat — the feed-family intake, coordinator-dispatched from the artifact-feed activity gap; ADR number 0112 pre-assigned by the coordinator, siblings hold 0111 + 0113–0114) |
> | **Ratified by** | Kim (host) · 2026-07-09 — ratified by explicit instruction; the self-flip guard hook (`.claude/hooks/adr-status-guard.py`) was deliberately deregistered by Kim's own edit to `settings.json` to permit this flip. Forks F1–F4 stand as recommended (no objection raised) |
> | **Repairs** | NEW [`../prd/feed-family.prd.md`](../prd/feed-family.prd.md) (authored in this same change — the owning doc whose §3 scope + goals this ADR pins) · intake decomp [`../decompositions/feed-family-intake.decomp.json`](../decompositions/feed-family-intake.decomp.json) (coverage-clean, STRICT+PLAN) · on ratification+build (M1/M2, per PRD §4): catalog `catalog.json`/`factories.ts` rows + the descriptor-derived gate's `EXCLUSION_ALLOWLIST` (two reasoned entries) · `tools/agent/feed-catalog.ts` partition rows (cl.7) · `a2ui-catalog.spec.md` §5.2 rows + Notes guidance · the agent-activity exemplar + the `document-row-toolbar` seed upgrade (`catalog-coverage.ts:184-235`) · `@agent-ui/icons` vendor addition (cl.8) · **flag, not repaired here:** `references/geometry.md:101,106-107` still cites the never-shipped `--ui-ind` in its content-icon taxonomy line (ADR-0041 AC5 claimed this repaired; the Indicator-class row was, the taxonomy line was not) — one-line doc repair owed at ratification housekeeping |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the catalog-or-allowlist gate; this family exercises BOTH arms) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the TOTAL feed partition every new catalog type owes a row) · [ADR-0107](./0107-chart-family-v1-scope.md) (the intake shape + Display-mark precedents this clones) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every default here must survive the CSS-less consumer) · [ADR-0065](./0065-icon-adapter-swappable-pack-architecture.md) cl.4 (the decorative default avatar HOLDS and progress inverts) · [ADR-0043](./0043-overlay-selection-primitives.md)/[ADR-0045](./0045-overlay-dismissal-semantics.md) (the overlay platform toast builds beside, not on) · [ADR-0041](./0041-widget-box-geometry-subsystem.md) (widget geometry; avatar fork F3) · [ADR-0020](./0020-modal-persistent-dismissal-control.md) (the interruption-inversion prior art) · [ADR-0082](./0082-app-shell-per-instance-isolation.md) (the no-global-singleton law fork F2 applies) · the sibling content-family record [ADR-0114](./0114-text-hyperlink-href.md) owns link security (related by reference — deliberately NO Extends/Supersedes edge; the coordination is the cl.4 ordering constraint, and both records are concurrently `proposed`) |

## Context

The fleet renders agent *output* well — text, forms, charts (ADR-0107) — and agent *activity* not at
all. Three recorded gaps force this intake:

1. **A2A TaskState has no visual.** The protocol layer ships a nine-state lifecycle
   (`task-state.ts`: `submitted · working · input-required · auth-required · completed · canceled ·
   rejected · failed · unknown`) and the artifact feed renders every state identically — a `working`
   turn is indistinguishable from a finished one. No progress vocabulary exists in the fleet,
   determinate or indeterminate.
2. **FilePart is hand-composed.** A2A's `A2aFilePart` (`types.ts:55-74` — `{bytes|uri, name?,
   mimeType?}`) has no component; the `document-row-toolbar` seed builds its attachment card by hand
   from `Card`+`Row`+`Icon`+`Text`, and its own comment block (`catalog-coverage.ts:188-194`) records
   the consequence: the icon pack has **no file glyph**, so the card silently rendered no glyph at all —
   a gallery-caught defect. Identity is equally absent: no compact identity mark exists (`ui-icon` is a
   glyph, not an identity).
3. **No transient notification surface exists, fleet-wide.** Async agent completions and the app-shell
   both want one; the shipped overlays are anchored disclosure surfaces (ADR-0043) or the focus-trapping
   modal (ADR-0017) — structurally wrong for a non-interrupting, self-expiring announcement. This is
   the most a11y-sensitive primitive in the family: done naively it steals focus, spams screen readers,
   or expires under a reader's cursor.

Standing laws bound the solution space: the **zero-dependency pillar** (no toast/avatar library, ever);
the **layering law** (`components` imports nothing upward — no `a2a` import, so any TaskState pairing
is *guidance*, not code); the **ADR-0087 gate** (every new descriptor forces a catalog row OR a
reasoned allowlist entry, same wave); the **ADR-0097 TOTAL partition** (every new *catalog* type owes a
feed-ask disposition — Amendment 2 to ADR-0107 proved this is mechanically owed, not optional); the
**ADR-0102 law** (no rendered-correctness concern may live only in page CSS); and the **CVD/AA
posture** (ADR-0057; the open color-audit findings) that penalizes any hue-only signifier.

## Decision

**We will admit a feed/agent-activity family — `ui-progress` + `ui-avatar` + `ui-attachment` +
`ui-toast`/`ui-toast-region` — hand-rolled under the zero-dep pillar, with three types entering the
default catalog same-wave and the toast pair allowlisted OUT with recorded reasons.** One decision —
the v1 scope + contract directions — realized in eight clauses; SPEC/LLD own the mechanisms at build
(PRD-G1..G4 trace).

1. **The v1 set** *(PRD-G1/G3)*: the four components above, one folder each under `controls/`
   (`ui-toast-region` is toast's sibling folder — the radio/radio-group precedent). Ruled out, with the
   fence in PRD §3: progress rings/buffers/steps · avatar groups/presence/hue-identity · attachment
   previews/upload affordances · toast queues/action-arrays/static-singleton APIs · any TaskState code
   coupling. Each fenced item is a new intake or a named foreseen extension, never a rider.

2. **`ui-progress` — bar-only, native-shaped value model, always announced** *(PRD-G1/G2)*:
   - **Value model:** `value` (number) + `max` (number, default **100**). `value` absent ⇒
     **indeterminate** (the native `<progress>` semantic, carried over — no separate boolean to desync).
     `max=100` matches the ARIA progressbar default (`aria-valuemin/max` = 0/100), so the common case
     — a model emitting `{"component":"Progress","value":42}` — is percent-natural with zero extra
     props. (Native `<progress>`'s `max=1` default loses: it optimizes for fractions no agent emits.)
   - **A11y — the chart inversion holds here:** progress is *status data, not decoration*, so it is
     never silent (the ADR-0107 cl.4 posture, not ADR-0065 cl.4's). `role=progressbar` via
     `ElementInternals` with `ariaValueNow/Min/Max` when determinate and `ariaValueNow` omitted when
     indeterminate; `ariaValueText` from an optional `label`/format (e.g. "42%"); the accessible name
     from `label`. Never host attributes (fleet law).
   - **Geometry — Display class, rail not box:** `geometry.md`'s five-class table already enumerates
     `progress` under Display. The bar thickness is a **density-invariant thin fleet token**
     (`--ui-progress-track-size`), the slider-rail precedent verbatim (`slider.css:76-79` explicitly
     refused widget-box derivation for its rail; ADR-0041's density-rides-rhythm law) — NOT a
     `--ui-compact-*` box lookup: a bar is a rail, not a box. Track color =
     `--md-sys-color-neutral-track` (the ADR-0059 solid-track role), fill = the primary role. A
     **`min-inline-size` floor is mandatory** — a bar-shaped control in a flex row is the exact
     slider-dot collapse shape (the test-the-whole-shape law); the floor value is LLD business.
   - **Forced-colors:** a background-drawn fill vanishes under WHCM — the bar-chart lesson
     (`bar-chart.css:101-107`): an explicit `forced-colors` block paints fill `CanvasText` and keeps
     the track distinguishable (`Canvas` + `CanvasText` border). The indeterminate animation respects
     `prefers-reduced-motion` (an acceptance item, not decoration).
   - **TaskState pairing is GUIDANCE, not coupling:** the catalog §5.2 Notes teach the mapping
     (`submitted`/`working` → indeterminate, or determinate when the agent reports a fraction;
     `input-required` → an ask, never a progress bar; terminals → no bar — completion announcements are
     toast/app-chrome territory). **No `a2a` import** (the layering trip-wire), no TaskState prop enum.

3. **`ui-avatar` — image → initials → glyph, decorative by default, no hue identity** *(PRD-G1/G2)*:
   - **Fallback chain:** `src` image (load-error-safe) → **initials** derived from `name` → a generic
     person glyph (`ui-icon` mechanics; requires the cl.8 icons vendor addition). Never a broken-image
     box, never silent-empty (the document-row glyph defect is the cautionary instance).
   - **A11y — the ADR-0065 cl.4 decorative default HOLDS** (unlike charts): a feed avatar sits beside a
     visible name — announcing it duplicates the name ("Ada Lovelace, avatar Ada Lovelace"). Default
     decorative (internals; any internal `<img>` is `aria-hidden` with empty alt semantics); an
     optional `label` opts into `role=img` + accessible name for the standalone case (an avatar that
     IS the only identity signifier). Same contract shape as `ui-icon` — one fleet idiom, argued not
     assumed: the chart family inverted the default because a chart is *data with no adjacent text
     equivalent*; an avatar's text equivalent is the name it sits beside.
   - **No per-identity color coding in v1:** the fallback surface is ONE neutral pair (a neutral tint
     plane + on-surface ink — AA-verifiable once). Hash-picked hues are (a) a hue-only identity
     signifier — the CVD posture (ADR-0057) forbids meaning carried by hue alone — and (b) an unbounded
     contrast matrix (every generated hue × both schemes must clear AA — unverifiable by construction;
     the fleet just spent an audit cycle closing *bounded* AA gaps). Identity is carried by the
     initials/name text. A curated, AA-verified accent-pair palette is the foreseen extension if
     identity-at-a-glance proves needed.
   - **Sizing:** fork **F3** (recommendation: the Indicator-class widget box).

4. **`ui-attachment` — a FilePart-aligned compact file card; link security BY REFERENCE** *(PRD-G1/G2/G4)*:
   - **Props mirror the wire where the wire speaks:** `name` (optional on the wire — the card falls
     back to a mimeType-derived family label, never an empty title), `mimeType` (drives the glyph),
     `size` — **deliberately NOT a wire field** (`A2aFilePart` carries none; `size` is
     embedder-supplied, e.g. computed from decoded bytes — the descriptor says so, so no one "fixes"
     the wire alignment later), `href` (optional; see below). The name cell takes `truncate` — the
     ADR-0106 document-name reference use, now in its home component.
   - **Glyph derivation is a pure module:** mimeType → category (image/audio/video/pdf/text/archive/
     data/default) as a DOM-free map (unit-testable; the ADR-0107 cl.3 pure-module precedent),
     resolved through the icon adapter. Glyph is decorative (`aria-hidden`) — the *name text* is the
     accessible datum (the bar-chart printed-value posture).
   - **Posture:** fork **F4** (recommendation: a compact Display-class card).
   - **`href` — the content family's territory, coordinated by reference:** link/navigation security
     (URI scheme policy, `rel`/`target`, download semantics) is **ADR-0114's** to rule — this record
     deliberately designs none of it. The contract direction: the prop exists; when the ADR-0114 ruling
     is ratified, the card's name renders as a real link under that ruling (a native `<a>` is the
     honest navigation primitive — the fleet bans native *form* elements, an anchor is not one; the
     mechanics are LLD business under 0114's law). **Cross-family ordering constraint:** the `href` leg
     of the M1 build lands only with-or-after ADR-0114's ratification; the metadata card (name + glyph
     + size) has no dependency and lands regardless.

5. **`ui-toast` + `ui-toast-region` — the fleet's first transient overlay: region-hosted top layer,
   never focus-stealing, timed with humane pauses** *(PRD-G3)*:
   - **Surface:** fork **F1** (recommendation: ONE `ui-toast-region` promoted to the top layer via
     `popover=manual`; toasts stack inside in normal flow). The toast is **not** an ADR-0043 overlay
     consumer: that controller's contract is anchored placement + light-dismiss + focus restore
     (ADR-0045) — all three are wrong for a toast (no anchor; light-dismiss would kill every toast on
     any outside click; there is never focus to restore because focus never moves).
   - **A11y contract:** each toast carries **`role=status`** via internals (polite — announced without
     interrupting); an `urgent` presence-boolean opts into `role=alert` for failures that warrant
     assertive announcement. Toasts **never take focus** on show — the ADR-0020 interruption-inversion
     prior art (the fleet already ruled interruptions default humane); the dismiss affordance and the
     optional action are reachable by normal tab order while the toast is present.
   - **Timing:** auto-dismiss on a `duration` (default ~6 s; LLD pins the number) that **pauses under
     hover AND focus-within** (the reader/magnifier case); an **actionable toast does not auto-dismiss**
     (WCAG 2.2.1 timing-adjustable, made structural: if it carries an action, it waits to be dismissed).
     v1 carries at most **one optional action** (the "view result" / "undo" case) + a close affordance.
     Dismissal emits `close` (the fleet event vocabulary; no new event names).
   - **Ownership/API:** fork **F2** (recommendation: declarative region owned by the page/app-shell +
     an instance `show()` convenience; no static singleton).

6. **Catalog + teaching — BOTH ADR-0087 arms, same wave** *(PRD-G1/G4)*: the fleet-derived gate forces
   a disposition per descriptor the moment it lands:
   - **Rows (same wave, seed-and-drain permitted):** `Progress`, `Avatar`, `Attachment` — all
     **display-only** (one-way props, no `value:{prop,event}` mark — none of the three is an input, so
     no ADR-0019 seam slot is consumed). Agent-driven progress updates ride `updateDataModel` on a
     bound `value` path like any one-way prop.
   - **Allowlist (the gate's other arm, exercised deliberately for the first time since the Wave-D
     drain):** `Toast` + `ToastRegion` enter the code `EXCLUSION_ALLOWLIST` — **the RECOMMENDED
     disposition, pending fork F2** (which carries the catalogue-Toast alternative to Kim; cl.7's
     partition arithmetic and the Consequences' "allowlist stops being empty" both ride this fork's
     answer) — with the recorded reason —
     *a toast is app-surface chrome, not agent-emittable content*: (a) a self-expiring message inside
     an append-only feed breaks the history-must-not-lie doctrine (ADR-0097's own law — a record that
     deletes itself); (b) an agent-raised toast mutates page chrome outside the payload↔DOM
     traceability the renderer's charter guarantees; (c) the ADR-0097 partition already bans overlay
     surfaces in asks — cataloguing an overlay whose only legitimate consumer is page code would teach
     models a type they must never use. This re-opens the "allowlist residue: none" end-state of
     ADR-0087 **by design** — the allowlist is the sanctioned form of absent, and these two entries are
     its first permanent, reasoned residents. If a future genuinely-agent-shaped notification need
     appears, that is a new intake against these reasons.
   - **Teaching (M2):** §5.2 Notes guidance (*Avatar for who acted — beside a name, decorative ·
     Progress for how far along — indeterminate unless a real fraction exists · Attachment for what was
     produced — never a hand-built Icon+Text card*) + the **agent-activity exemplar seed** (task-status
     card: Avatar + Progress + Attachment in a Card) + the `document-row-toolbar` seed's attachment
     assembly upgraded to the real type. Corpus + derived prompt re-validate over the widened catalog
     (the ADR-0087 consequence pattern).

7. **Feed-partition dispositions — mechanically owed for every new CATALOG type (the ADR-0097
   Amendment lesson, applied at intake instead of discovered at build):**
   - **`Avatar` → IN** `FEED_SURFACE_TYPES`: light identity structure, the `Icon` parity argument — an
     ask's option cards (the boundary-negotiation archetype) legitimately show *who/which agent* an
     option refers to; no overlay, no pagination, no dashboard.
   - **`Progress` → OUT** (`FEED_EXCLUDED` + reason): an ask is a commit-gated question; a live
     activity indicator inside a frozen-able ask bubble is status theater — and a frozen `inert` ask
     containing a "live" progress bar is a lying record. Progress is canvas/report content.
   - **`Attachment` → OUT** (+ reason): artifact content, the Sparkline/BarChart reasoning — file
     *outputs* belong to the canvas/feed rendering, and a file-pick ask composes today's IN-set
     (`RadioGroup` of names). **Revisit trigger named:** a real file-pick ask that needs the card's
     affordances re-opens this row as a one-line, gate-visible edit.
   - **`Toast`/`ToastRegion` → no disposition owed** — they are not catalog types (cl.6); the partition
     is total over the *catalog*. Stated so no build wave goes looking.
   - The partition moves 23 IN / 13 OUT → **24 IN / 15 OUT** over a 39-type catalog.

8. **Packaging, size, and cross-package dependencies:** **no new package** — four ordinary `controls/`
   folders; pure modules (mime-category map, initials derivation) live in-folder (ADR-0107 cl.7; no
   vendored data mass, so the ADR-0065 leaf-package bar is not met). The **family size budget (26 KB
   gz, ADR-0107 Amendment) will very likely re-base** — four controls + the region; measured at the
   build wave (`npm run size`, the manual ADR-0040 §3 discipline), never guessed here. **Named
   build-wave dependency:** the `@agent-ui/icons` vocabulary (11-name MVP) has **no file-category and
   no person glyph** — the vendor addition (ADR-0066 mechanics; icons-package owner) is an M1
   prerequisite for attachment's glyph and avatar's terminal fallback; the document-row seed's
   silent-empty-glyph defect is what shipping without it looks like.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — toast surface architecture.** *Recommend: one `ui-toast-region` in the top layer
  (`popover=manual`), toasts stacked inside in normal flow.* The region rides the platform's top layer
  (beats every page stacking context — a completion arriving while a modal is open must still show;
  `manual` popovers take no light-dismiss and allow concurrent open, exactly the toast semantics), while
  stacking inside stays CSS-only flex/gap. The live alternatives: **per-toast `popover=manual`
  elements** — N independent top-layer boxes cannot see each other, so stacking becomes a JS
  mutual-positioning loop (the exact geometry churn ADR-0043 built a controller to avoid, minus its
  anchor); **a plain `position:fixed` region** — loses to any top-layer content and to high-z page
  chrome, a deterministic wrong rendering for the CSS-less consumer's host page (ADR-0102's bar).
- **F2 — toast ownership + reachability.** *Recommend: a declarative `ui-toast-region` the page or
  app-shell composes, an instance `region.show(…)` convenience returning the created `ui-toast`, and
  the catalog allowlist-OUT of cl.6.* Declarative-region matches the fleet posture (the modal
  precedent: an element you place, not a service you summon) and keeps multi-shell/multi-page apps
  isolated; the instance method is the sanctioned imperative seam (the `mount()` precedent) for the
  inherently imperative "something finished" moment. Rejected: a **static
  `UIToastElement.show()` singleton** (a hidden global region — precisely the shared-global-state shape
  ADR-0082 removed from the app-shell; two shells would fight over one region); **cataloguing Toast**
  (cl.6's three reasons). App-shell *composing* a default region into its chrome is that package's own
  build decision, by reference — not decided here.
- **F3 — avatar sizing lever.** *Recommend: Indicator-class widget box — `--ui-avatar-size` defaulting
  off the ratified `--ui-compact-{sm,md,lg}` `[size]`×`[scale]` lookup (ADR-0041), circle mask,
  initials font derived from the box.* Mechanics: an avatar is a small fixed painted box — the
  checkbox/switch kin under ADR-0041's box/glyph split (box = compact ramp, glyph = icon ramp) — and
  the ramp is Kim-ratified with no new register minted; `[size]`+`[scale]` give 12–28 px and the
  component token is the page's override for larger chrome (a profile header is page styling, not a
  fleet register). Alternatives: **the control-height ramp** (16–64 — covers big avatars but entangles
  a non-control Display mark with the ADR-0038 control lookup's contract); **a new avatar ramp** (a
  Kim-gated geometry addition — not earned until a real >28 px fleet register is demonstrated; the
  named trigger for re-opening); **`1em` icon-style** (an avatar is not type-anchored — it spans
  multi-line bubbles).
- **F4 — attachment posture.** *Recommend: a compact Display-class card* — its own bordered surface
  (`--ui-radius-base`, the entry/container radius kin), one-row anatomy `glyph | name+meta`, composable
  N-up in a `Row(wrap)` or as `ui-list` children when a list is wanted (the ADR-0087 List guidance
  keeps list semantics in `ui-list`, not baked into this type). The alternative — a **list-item-only
  posture** (no own surface, host-provided row) — forecloses the standalone/inline case (one file in a
  feed bubble, the dominant grounded instance) and re-creates the hand-composition this type exists to
  retire.

## Consequences

- **The fleet owns its first live-region + timed-overlay correctness with no library to blame** —
  announcement politeness, timer pauses, focus neutrality, WHCM, both engines, all hand-gated. jsdom
  cannot see top-layer or timer-vs-hover interplay: **browser legs are mandatory**, and the toast's
  a11y probes read internals directly (the tabs precedent — locators are blind to internals-only ARIA).
- **The catalog surface grows by three display types** (36 → 39): corpus, eval shards, and the derived
  prompt re-validate over the widened catalog; §5.2 guidance is an acceptance item, not decoration
  (models must be *taught* Attachment-over-hand-composition, or the old idiom persists in generation).
- **The ADR-0087 allowlist stops being empty, on purpose.** Two reasoned permanent entries change the
  gate's steady state from "residue none" to "residue = the recorded app-surface set"; every future
  wave inherits that reading (the gate's own reason strings carry it).
- **The v1 fences will be pushed** — a progress ring, avatar presence dots, attachment previews, and a
  toast queue are each a predictable next ask; the PRD §3 fence + the named re-open triggers (F3's
  >28 px register, cl.7's file-pick ask) are the answer, never a build-wave rider.
- **An a11y verbosity judgment is baked in twice**: the avatar's decorative default means a
  label-less avatar beside no name announces nothing (author error by contract — the descriptor must
  say so); the actionable toast's no-auto-dismiss rule means an unattended "undo" toast persists until
  dismissed (deliberate: the alternative — expiring an offered action under the user — is the WCAG
  failure).
- **Stale → re-verify at the build wave:** catalog `catalog.json`/`factories.ts`/allowlist + partition
  gate rows · §5.2 rows + Notes · corpus shelf + derived prompt · `examples` barrels/`allSeeds` + the
  document-row seed · the icons `ICON_NAMES` union + pack payloads · the size ceiling · the
  `geometry.md` `--ui-ind` taxonomy-line repair (Repairs flag) · the ADR-0114 ordering constraint
  (cl.4) against that record's actual ratified content.

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** the sibling PRD exists with its gate green (`harness_checks.py prd` exit
  0); this record passes `adr_check.py` and is indexed; the intake decomp passes
  `coverage_check.py --strict` exit 0; the four forks carry firm recommendations awaiting Kim;
  doc-review is dispatched on the records. No code changes; Status stays `proposed`.
- **Build wave (M1/M2, separately dispatched):** descriptors land WITH their same-wave ADR-0087
  dispositions (3 rows + 2 reasoned allowlist entries; fleet-derived gate green) and ADR-0097 partition
  rows (partition gate green: IN ∪ OUT = the widened catalog exactly). Per-control: `ui-progress`
  announces `role=progressbar` + correct valuenow/valuetext via internals, omits valuenow when
  indeterminate, survives forced-colors (fill visible, track distinguishable — browser leg), respects
  `prefers-reduced-motion`, and paints non-collapsed in a realistic flex row (whole-shape leg, both
  engines). `ui-avatar` walks src → initials → glyph without a broken-image or empty state; decorative
  by default, `role=img` + name with `label`. `ui-attachment` renders name/glyph/size from a
  FilePart-shaped input with no `href`; the `href` leg ships only under ADR-0114's ratified ruling.
  `ui-toast` never moves focus on show (probe asserts `document.activeElement` unchanged), announces as
  status (alert only under `urgent`), auto-dismisses at `duration`, pauses under hover AND focus-within,
  and does not auto-dismiss while carrying an action; region stacking holds above an open page stacking
  context (top-layer browser leg). The agent-activity exemplar validates 0-`CATALOG`-error through
  `validateA2ui`; the document-row seed's hand-composed attachment is retired; §5.2 guidance prose
  lands. `npm run check && npm test` + browser legs green; `npm run size` measured and the re-base (if
  owed) recorded per convention.

## Alternatives considered

- **Do nothing — keep hand-composing.** Rejected: the document-row seed is the evidence (a silently
  glyph-less card shipped through every gate), TaskState stays invisible, and no composition can
  produce a transient announcement — the toast gap is not composable at all.
- **A `ui-task-status` composite bound to A2A TaskState** (one component rendering the nine states).
  Rejected: couples `@agent-ui/components` to a protocol package the layering trip-wire forbids
  upward; the primitives + §5.2 guidance express every state's rendering without the import, and other
  consumers (non-A2A apps) get honest primitives instead of a protocol costume.
- **Toast via the ADR-0043 overlay controller.** Rejected on contract mechanics: anchored placement
  (a toast has no anchor), light-dismiss (any outside click would dismiss every toast — ADR-0045's
  platform-owned dismissal is the wrong gift here), and focus-restore (focus never moved). A region +
  `popover=manual` uses the same platform layer without borrowing the wrong behavior bundle.
- **Notification API / system notifications for completions.** Rejected: permission-gated,
  page-external, unstylable, invisible to the page's own a11y tree — and a demo/app-shell surface
  should not ask OS permission to say "done". Foreseen as an app-layer bridge someday, not a component.
- **A per-identity hash-color avatar default (the common library behavior).** Rejected on two laws:
  hue-only identity signification (ADR-0057) and an unverifiable AA matrix (every generated hue ×
  both schemes). Recorded as the curated-palette foreseen extension instead.
- **Cataloguing Toast for agent use.** Rejected — cl.6's three reasons (history-must-not-lie ·
  payload↔DOM traceability · teaching a forbidden type); the allowlist arm exists for exactly this.
- **A `@agent-ui/activity` leaf package.** Rejected: no vendored data mass (the ADR-0065 bar);
  ordinary controls folders keep the layering trip-wire allowlist at its current width.
- **Progress as an Indicator-class widget box** (thickness off `--ui-compact-*`). Rejected: a bar is a
  rail, not a box — the slider's own rail refused box derivation with recorded reasons
  (`slider.css:76-79`); a 12–28 px-thick bar is a paint roller. The thin-constant token matches the
  shipped rail precedent and geometry.md's Display-class placement of `progress`.

## Out of scope (this ADR)

Everything in PRD §3's fence, plus: the ADR-0114 link-security design (owned by the content-family
sibling; only the ordering constraint is recorded here) · the app-shell's decision to compose a default
toast region into its chrome (that package's own record, by reference) · any SPEC/LLD mechanism
(descriptor prop tables, exact tokens/floors/durations, region placement props — build-wave records).
