# ADR-0226 — catalog Button icon mechanism: `icon`/`iconOnly` wire props (no Icon-child contract), ICON_NAMES vocabulary verbatim, the label IS the accessible name, structural-children leniency closed

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 *(authored)* |
> | **Proposed by** | planning-leader seat (design lane, GH [#1504](https://github.com/kimgranlund/agent-ui/issues/1504) — Kim's in-session ruling on the issue: "a planning lane runs first … drafts the ADR resolving the four named forks (icon-prop vs Icon-child contract, icon vocabulary source, accessible-label mechanism, pre-fork grill) BEFORE any build dispatch") |
> | **Ratified by** | *pending — Kim (repo owner), via a `ratify ADR-0226` utterance verified + flipped by `scripts/adr_ratify.py` (ADR-0149). This record never self-flips: `proposed` IS "return it to me".* |
> | **Repairs** | **on ratification, one build wave** — GH [#1504](https://github.com/kimgranlund/agent-ui/issues/1504) IS the `status-dialects.md` §1 open tracking issue holding these items (this cell gets commented onto it verbatim at flip time; no separate tracker is filed); it stays open until the wave lands — this record's PR carries `Refs #1504`, never `Closes`: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` (`components.Button` gains `icon`/`iconOnly`; every existing key byte-untouched) · `catalog/default/factories.ts` (`buttonFactory` grows the two bespoke arms, cl.1) · `catalog/conformance.ts` + `conformance.test.ts` (the `requires` extension, cl.3, and the children-model check, cl.4) · `.claude/docs/spec/a2ui-catalog.spec.md` §5.2 `Button` row (line 184) · prompt-baseline recapture (the catalog.json-edit-pairs-with-recapture convention, a2ui-catalog-card-review-pipeline) · one corpus/example seed exercising both forms · `src/examples/high-frequency-patterns.ts:306-316` (the wallet-summary-card jsdoc's "not literally expressible in this catalog" claim goes stale the moment this ships — repaired in the same change, stale-context law) · `catalog/default/index.test.ts` + `factories.test.ts` coverage |
> | **Supersedes / Superseded by** | None superseded. Relates [ADR-0171](./0171-button-label-alignment-single-adornment-start.md) + [ADR-0006](./0006-button-anatomy-optional-icon-slot-density-acceptance.md)/[ADR-0012](./0012-button-anatomy-trailing-adornment-slot.md)/[ADR-0133](./0133-button-label-ellipsis-anatomy.md) (the host anatomy + alignment law the factory drives — untouched, engaged by construction) · [ADR-0153](./0153-status-stream-elapsed-timer-retry-action-planned-glyph.md) (the closed seven-member event vocabulary — untouched; `action` stays Button's only trigger) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) Wave A (the `Icon` row) · [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) cl.9b (the upstream 59-identifier `Icon.name` enum mapped onto ICON_NAMES) · [ADR-0209](./0209-disclosure-summary-slot-children.md) (the Icon `slot` enum's `summary` widening) · GH [#1489](https://github.com/kimgranlund/agent-ui/issues/1489) (the wallet-summary-card evidence seed) · GH #1189 (the opt-in `PropDef.required` extension this record's cl.3 mechanism is shaped on) · TKT-0069 item 1 (the `name`→`glyph` wire/prop rename `iconFactory` already carries) |

## Context

The default-catalog `Button` (`packages/agent-ui/a2ui/src/catalog/default/catalog.json`,
`components.Button`) is a pure action leaf: `label` (bindable, `mapsTo: textContent`) ·
`variant` (`solid | soft | ghost`) · `disabled` (bindable) · `action` — no `icon` prop, no
`children` key. The host control underneath has carried a full adornment surface for months:
`ui-button`'s light-DOM `leading`/`trailing` slots (position, ADR-0006/0012), `data-role="icon"`
sizing (role-driven, button.md "Slots & roles"), the reflected `icon-only` attribute (square
anatomy + caller-supplied `aria-label`, button.md `labelSource`), and ADR-0171's
structure-conditional label alignment (a single leading adornment start-aligns the label, rows
1/3; icon-only is rows 8/9). None of it is wire-reachable — `factories.ts:1201` records the gap
verbatim: "slots are NOT catalogued this pass — the same limitation `Button`'s own
leading/trailing icon slots" carry.

GH #1489 paid the price of that gap in the open. The wallet-summary-card seed
(`src/examples/high-frequency-patterns.ts:287-329`) needed four icon actions and had to compose
each as `Column(Icon, ghost Button)` — three nodes per action, twelve for the bar, with the tap
target excluding the very glyph that identifies it. Its jsdoc (lines 306-316) states the two
facts this record resolves:

1. **The mechanism is missing**: "`Button` … declares no `children` key and no `icon` prop — it
   is a pure action leaf."
2. **The validator is lenient but the leniency is refused**: "The validator's structural
   `RESERVED` set happens to skip `child`/`children` for ANY component, so a Button node could
   mechanically carry an Icon child without failing `validate-payload` — but that is
   undocumented validator leniency, not a sanctioned composition."

The leniency is real and cited: `renderer/validate.ts:59` (`RESERVED = new Set(['id',
'component', 'child', 'children'])`, skipped at :270 in pointer scanning) and
`catalog/conformance.ts:34/50` (the same set plus `checks`, skipped before the
unknown-property check) — so `child`/`children` on ANY node bypass CATALOG conformance
entirely. `ComponentDef.children` (`catalog/catalog.ts:25`, `'child' | 'children' |
'ChildList'`) is today documentation for the factory/renderer, never validated. And the
renderer would MOUNT the exploit: `renderer/tree.ts` reconstructs parent→child generically from
adjacency references, so an Icon child of Button lands in `ui-button`'s light DOM — slotless,
it is adopted INTO the label wrapper by ADR-0133's `childList` heal observer (button.md
"Parts"), a silently wrong render, not an error.

GH #1504 names the four forks this record must resolve before any build (Kim's ruling on the
issue): **(1)** `icon` prop vs a sanctioned Icon-child contract; **(2)** the icon vocabulary
source — the `@agent-ui/icons` `ICON_NAMES` set verbatim vs a catalog-pinned subset; **(3)** the
accessible-label mechanism for the icon-only form (required `label` rendered visually hidden vs
a distinct `accessibilityLabel`-style field); **(4)** the pre-fork grill both #1489 and #1504
name as skipped in their own Scope/Open sections.

Fixed inputs, not up for redesign here: ADR-0171's alignment law; ADR-0006/0012's geometry;
the closed event vocabulary (ADR-0153 — `action` is Button's trigger, nothing new fires here);
`ui-icon`'s deliberate non-enum `glyph` (`icon.ts:16` — "typed `prop.string('')`, not
`prop.enum(ICON_NAMES, …)`, deliberately: the swappable-pack" contract, ADR-0065/0066); and the
unknown-name failure mode (a blank `<svg data-icon-missing>`, `icons` `resolve.ts` — dead
pixels, never a fallback glyph).

## Decision

**Button's icon mechanism is two wire PROPS — `icon` (bindable string, the ICON_NAMES
vocabulary verbatim, factory-realized as a control-slotted decorative `ui-icon`) and `iconOnly`
(static boolean; the `label` becomes the accessible name via `aria-label`) — with the
accessible-label contract validator-enforced by a new opt-in cross-prop `requires` check
(`icon` requires `label`; `iconOnly` requires `icon`), and the structural-children leniency
closed for every childless catalog row in the same wave. No Icon-child contract is sanctioned.**

Five clauses, one per fork plus the enforcement floor they share:

1. **Fork 1 — props, not children.** `components.Button` gains:
   - `icon` — `{ "type": { "type": "string" }, "bindable": true }`. Realized bespoke in
     `buttonFactory` (the existing non-identity `label`→`textContent` precedent): a non-empty
     value ensures ONE factory-owned child — `<ui-icon slot="leading" data-role="icon">` with
     `glyph` set to the value and `label` left empty, so `icon.ts`'s own label effect keeps it
     decorative (`aria-hidden`, no role) by construction — re-applies (bound updates) retarget
     `glyph` on the existing child; an empty/null value removes it. `slot="leading"` +
     `data-role="icon"` engage the shipped anatomy untouched: the icon-sized start cell
     (ADR-0006/0012), start-aligned label (ADR-0171 rows 1/3).
   - `iconOnly` — `{ "type": { "type": "boolean" } }`, deliberately NOT bindable: like
     `variant`, it is per-node structure, not state — a control that flips between labeled and
     icon-only at runtime is a layout defect, not a binding use case.
   - The factory's label routing forks on icon-only state, order-independent under per-prop
     `applyProp`: with `iconOnly` false/absent, `label` → `textContent` (today's arm,
     byte-identical); with `iconOnly` true, the factory sets the host's `icon-only` attribute
     and writes `label` to `aria-label` instead of text (converges whichever prop applies
     first: `iconOnly` arriving second migrates the already-written text into `aria-label`;
     `label` arriving second reads the attribute and routes itself). A host `aria-label` from
     the renderer is legal — the FACE `ElementInternals`-only rule binds the CONTROL's own ARIA,
     never a consumer's, and button.md's `labelSource` note requires exactly this of icon-only
     callers.
   - `trailing` is deliberately NOT taken this pass (see Consequences).

2. **Fork 2 — vocabulary: `ICON_NAMES` verbatim, open string on the wire; no catalog-pinned
   enum.** `Button.icon`'s value space IS `@agent-ui/icons`' `ICON_NAMES`
   (`packages/agent-ui/icons/src/types.ts` — ~110 names incl. the ADR-0169 cl.9b upstream
   mapping), carried as an open `string` — the exact posture `Icon.name` already has, for the
   exact reason `icon.ts:16` states (the swappable-pack contract). One vocabulary, two
   carriers; a stricter `Button.icon` than `Icon.name` would split it. A catalog.json enum copy
   is rejected on three grounds: (a) it is a hand-maintained duplicate of ~110 identifiers —
   the drift class `conformance.ts`'s own `SAFE_HREF_SCHEMES` local copy needed a parity test
   to hold at THREE entries; (b) `matchesType` accepts a `{path}` binding for any bindable prop
   before the enum check, so an enum would gate literals only — enforcement asymmetry, not
   enforcement; (c) the failure mode is already defined and honest: an unknown name renders a
   blank `<svg data-icon-missing>` (`resolve.ts`), caught by the same prompt-guidance +
   rendering-review discipline the wallet seed's verify-against-`ICON_NAMES` practice already
   runs. If enumeration is ever wanted, it is ONE future ADR covering `Icon.name` AND
   `Button.icon` together, generated from `ICON_NAMES`, never copied.

3. **Fork 3 — the `label` IS the accessible name; presence validator-enforced, rendering
   forked.** No second `accessibilityLabel`-style field: one concept, one prop — the label text
   is the accessible name in BOTH forms (visible text when labeled, `aria-label` when
   `iconOnly`, cl.1's routing), and stays the single string a future tooltip/overflow
   affordance would read. Enforcement is a new opt-in `PropDef` key in `conformance.ts` —
   **`requires: string[]`** ("this key's presence requires those keys' presence"; one CATALOG
   failure per missing key), the same shape as GH #1189's opt-in `required` (every
   non-declaring prop behaves byte-identically). Declared: `icon.requires = ["label"]` and
   `iconOnly.requires = ["icon"]`. Net contract, validator-enforced not advisory: an icon
   Button ALWAYS carries a label (so the icon-only form's accessible name exists by
   construction), and `iconOnly` without an icon is nonsense and fails. Owned limit: `requires`
   is PRESENCE-based — `iconOnly: true` with `icon: ""` (or a binding that resolves empty)
   validates yet renders a blank square button; that is the same literal-vs-binding asymmetry
   cl.2(b) already owns, caught by the same rendering-review discipline, and the build wave
   must not invent a value-level check here.

4. **The leniency closes.** `validateCatalogConformance` gains the children-model check: a node
   carrying `child`/`children` whose catalog def declares NO `children` model
   (`catalog.ts:25`) fails CATALOG. This is #1504's own acceptance bullet ("continues to
   reject undocumented Icon-child leniency") turned from seed-author discipline (the wallet
   jsdoc's refusal) into enforcement — for Button and every other leaf row (the `ServiceCard`
   §5.2 row's "no `children` key" note, among others, becomes checked instead of documentary).
   Deliberately minimal floor: presence-vs-none only; `child`-vs-`children`-vs-`ChildList` KIND
   mismatch on a declaring def is refused this pass (no evidence of the defect class; a wrong
   kind still renders or IDGRAPH-fails visibly, unlike the silent leniency).

5. **Fork 4 — the skipped pre-fork grill is discharged BY this record; no new repo-side gate.**
   Both #1489 and #1504 name "pre-fork grill skipped" in Scope/Open — which is the
   `docs:file-feature` convention's own fallback clause (v1.19.7, Kim's 2026-08-18 ruling)
   working as designed: an ungrilled big/open seed is captured anyway, the gap named, never a
   mint-blocker. Kim's #1504 ruling — a planning lane drafts the ADR resolving the named forks
   BEFORE any build dispatch — IS the sharpening round, run at planning altitude; the four fork
   resolutions above are the grill's output. Recorded here so the discharge is deliberate;
   this repo mints no additional grill gate (the convention lives in the docs plugin, owns its
   own fallback, and held).

## Acceptance

Checkable predicates, all gated on the ratification build wave (none run for this proposed
record itself):

- **AC1 (catalog)** — `components.Button` declares `icon` (string, bindable,
  `requires: ["label"]`) and `iconOnly` (boolean, not bindable, `requires: ["icon"]`);
  `label`/`variant`/`disabled`/`action` byte-untouched. `catalog/default/index.test.ts`
  asserts both keys and the untouched four.
- **AC2 (conformance)** — `conformance.test.ts` proves: `icon` without `label` → one CATALOG
  failure; `iconOnly` without `icon` → one CATALOG failure; `icon`+`label` literal and
  `icon`-as-`{path}`-binding both pass; a `Button` node carrying `children` → CATALOG failure
  and a `Button` node carrying `child` → CATALOG failure (cl.4 covers both structural keys); a
  `Column` carrying `children` still passes (negative control — the wallet card's own shape)
  and a `Field` carrying `child` still passes (the singular-key declaring-def negative control
  — `Field` is the catalog's one `children: 'child'` row, `catalog.ts:25`).
- **AC3 (factory)** — `factories.test.ts` proves: `icon`+`label` yields exactly one
  `ui-icon[slot="leading"][data-role="icon"]` child with `glyph` = the value and decorative
  ARIA (icon `label` empty), label as textContent; `iconOnly: true` yields the host
  `icon-only` attribute, `aria-label` = label, empty textContent, in BOTH applyProp orders; a
  bound `icon` re-apply retargets `glyph` without duplicating the child; clearing `icon`
  removes the child.
- **AC4 (corpus)** — one corpus/example seed exercises both forms and validates clean; the
  WHOLE existing examples+corpus set revalidates clean under cl.4's children-model check (the
  no-regression gate for closing the leniency).
- **AC5 (docs pairing)** — `a2ui-catalog.spec.md` §5.2's `Button` row (line 184) updated in the
  same change; prompt baseline recaptured (catalog.json edit pairs with recapture);
  `high-frequency-patterns.ts:306-316` jsdoc repaired.
- **AC6 (gates)** — `npm run check` and the a2ui vitest shard green by exit code.

## Consequences

- The wallet-summary-card's `Column(Icon, ghost Button)` composition stops being "the
  catalog-real answer to a Button with no icon mechanism" (its jsdoc's phrase) and becomes an
  ordinary layout choice: still VALID (Column declares children), no longer forced. A 4-action
  bar drops from 12 nodes to 4, and the tap target finally contains its own glyph. Re-seeding
  the wallet card on the new mechanism is the build wave's call, not mandated here.
- No event-vocabulary change: `action` remains Button's only trigger (ADR-0153's closed set
  untouched); `icon`/`iconOnly` are render-only props, nothing round-trips.
- The trailing adornment stays wire-unreachable — `factories.ts:1201`'s recorded limitation
  narrows to trailing-only. Taking it later is one additive prop (`iconTrailing`, or a
  placement enum) under its own record; nothing here forecloses it.
- Cl.3's `requires` and cl.4's children-model check are catalog-WIDE validator floor, not
  Button-scoped: every future leaf row gets "no children" enforced free, and every future
  cross-prop contract has a declared mechanism instead of prose.
- Risk owned: cl.4 is the one clause with fleet blast radius — a third-party catalog or
  out-of-tree payload relying on the leniency breaks. Judged acceptable: the leniency was
  undocumented, refused in-repo, and renders silently wrong when exploited (the label-wrapper
  adoption, Context); AC4's whole-corpus revalidation is the in-repo no-regression gate.
- On ratification, `adr_ratify.py` flips this header; the build wave dispatches only after the
  flip (GH #1504 closes with the build, not with this record).

## Alternatives considered

- **A sanctioned Icon-child contract** (fork 1's other arm) — rejected. (a) The validator has
  no child-TYPE constraint mechanism at all (`RESERVED` skips structural keys globally);
  sanctioning exactly Icon-under-Button means minting a per-component child-type validation
  layer for one case. (b) The mount is a trap: a slotless Icon child is adopted INTO the label
  wrapper (ADR-0133's heal observer) — every author must know to send `slot: "leading"`, and
  the Icon `slot` enum carries no per-parent legality the validator could check. (c) Flat
  adjacency authoring cost: two nodes + id plumbing per icon button vs one prop. (d) It
  contradicts the settled leaf idiom — `.claude/skills/a2ui-payload-authoring/references/node-idioms.md`'s "Button — action leaf", and the
  `ServiceCard`/`Toggle` precedent that interior visuals ride props at the wire while slots
  stay a control-layer affordance.
- **A catalog-pinned icon enum** (fork 2's other arm) — rejected for cl.2's three grounds
  (drift-copy of ~110 names; binding-vs-literal enforcement asymmetry; splitting one vocabulary
  across two carriers when `Icon.name` stays open).
- **A distinct `accessibilityLabel` field** (fork 3's other arm) — rejected: two label
  vocabularies for one concept, a second string to drift from the first, and nothing the
  existing `label` + `iconOnly` routing doesn't already deliver with fewer moving parts.
- **The "required `label` rendered visually hidden" realization of fork 3's first arm** (a
  hidden text span instead of cl.1's `aria-label` routing) — the ARM is taken (the required
  `label` IS the accessible name), but the hidden-TEXT realization is rejected: visually
  hidden text still participates in find-in-page and auto-translation (surprising hits on an
  icon-only control), it needs a clip-pattern utility class the control never shipped, and
  `ui-button`'s own icon-only contract (button.md `labelSource`) already specifies
  `aria-label` as the icon-only accessible-name channel — the factory routes onto the shipped
  mechanism instead of minting a parallel one.
- **`label` unconditionally `required: true` on Button** (GH #1189's existing mechanism, no new
  validator code) — rejected: it retro-tightens the wire for EVERY existing Button payload,
  in-repo and out, to serve a contract only icon-carrying buttons need; cl.3's `requires`
  scopes the tightening to exactly the new props.
- **Keep the Column(Icon, Button) workaround as the sanctioned pattern** — rejected: the
  glyph sits outside its own tap target (a real a11y/UX defect, not a style choice), the node
  cost is 3× per action, and #1489's own jsdoc already names it a workaround, not an answer.
