# ADR-0213 — A2UI `Suggestions` — one-shot follow-up chips as ONE data-prop leaf (mint a new type + control; NOT a Row-of-Buttons composition, NOT a Button widening, and NO public chip primitive rides along)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19

> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning seat (planning-leader dispatch on Kim's three-widget charter), on [GH #1369](https://github.com/kimgranlund/agent-ui/issues/1369) — tappable next-prompt follow-up chips, the most universal chat-widget pattern (OpenAI Apps / CopilotKit / C1) |
> | **Ratified by** | *pending — the Status flip is Kim's (`scripts/adr_ratify.py`, ADR-0149)* |
> | **Repairs** | on ratification+build (design-only NOW — nothing below is applied by this ADR): `a2ui/src/catalog/default/catalog.json` (the new `Suggestions` row per the Decision) · [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.2 (the row delta drafted in "SPEC §5.2 row delta" below) + §5.2's shipped-set preamble (one more "PLUS" clause) · NEW control `packages/agent-ui/components/src/controls/suggestions/` (`ui-suggestions`: `.md` descriptor + generated props + control + CSS + tests — the ADR-0087/SPEC-N2 coverage gate forces descriptor↔row agreement) · `a2ui/src/agent/feed-catalog.ts` (`FEED_SURFACE_TYPES` gains `Suggestions` — the partition gate turns CI red until the disposition is written; this ADR rules IN) · `live-agent/prompt-equivalence.baseline.json` (a new row shifts the derived prompt — recapture via the checked-in writer, `RECAPTURE_BASELINE=1`, the ADR-0207/0209 precedent) · a corpus seed demonstrating a spent + a live suggestion set (row graded ≥4 vs `rubrics/a2ui-catalog.md` + `rubrics/a2ui-catalog-example.md`) · renderer/validator tests: the generic action-wiring path on a non-Button type, the spent-set inertness (the GH #1164 disabled-guard), probe discipline for the interactive chips (`component-testing`) |
> | **Supersedes / Superseded by** | **Relates [ADR-0011](./0011-canonical-action-prop-shape.md)** (the `{action, context?, wantResponse?}` object this type's `action` prop carries unchanged — and the generic `mapsTo:'action'` wiring it rides, `renderer.ts` `#actionPropsOf`/`#wireAction`) · **[ADR-0097](./0097-a2ui-feed-embedded-asks.md)** (the feed partition this type must take a disposition in; the frozen-history law — "an ask answered three turns ago must not still be clickable" — is the law clause 3 builds into the type itself; the `sendDataModel` answer round-trip is the shipped machinery clause 2 composes) · **[ADR-0201](./0201-ui-description-list-key-value-receipt-primitive.md)** (the mint-vs-compose enforcement-locus + payload-weight/bindability tests this decision runs, and the hardened-data-prop idiom it reuses) · **[ADR-0175](./0175-association-multiselect-field-design-intake.md)/`component-design` `references/mint-vs-compose.md`** (the smallest-floor fences, ADR-0107→0205) · **[ADR-0163](./0163-ui-table-interactive-widening.md)** (the sequencing precedent: this intake ADR freezes ARCHITECTURE; descriptor/geometry/LLD land in the build wave) · Coheres with the GH #1371 Findings (same charter, 2026-08-19): NO public `ui-chip` primitive is minted anywhere — this type's chip anatomy is internal (clause 4) · GH #1369 |

## Context

**The gap (TYPE).** One-shot tappable follow-up suggestions under an agent response are the most
universal chat-widget pattern in the 2026 ecosystem (OpenAI Apps, CopilotKit, C1), and the
catalog (66 types, verified against `src/catalog/default/catalog.json` 2026-08-19) has no
suggestion territory at all. Today's approximation is a `Row` of `Button`s — expressible, but it
loses every semantic the pattern is FOR:

1. **One-tap-dismisses-the-set.** After one suggestion is taken, the whole set is spent — the
   untaken siblings must go inert and the record must show which one was taken. Composed Buttons
   have NO vehicle for this law at all: nothing in the render path relates one Button's click to
   its siblings' liveness, and no producer prose can add one. Worse, the append-only history law
   (ADR-0097's own fourth Context fact: "an ask answered three turns ago must not still be
   clickable") is violated by construction — a composed suggestion row re-rendered from history is
   fully live forever.
2. **Suggestion ≠ command.** A `Button` is a command affordance (it carries `checks`
   auto-disable, `submit` gating, primary/secondary weight); a suggestion is a conversational
   offer whose visual is deliberately lighter (the compact chip) and whose a11y gestalt is a
   listed SET of offers, not N independent commands.
3. **Payload weight + bindability** (ADR-0201's supporting signals): N suggestions cost ~2N+1
   nodes composed; one leaf carries them as one bindable array prop — and a bindable prop means
   the producer can replace the offered set in place via `updateDataModel`, which N literal
   Buttons cannot do.

**Verified mechanics this decision stands on** (inspected 2026-08-19, not recalled):

1. **Action wiring is generic, not Button-specific.** `renderer.ts` `#actionPropsOf` collects ANY
   prop whose catalog PropDef declares `mapsTo:'action'` on ANY type, and `#wireAction` wires the
   HOST element's `click` to `emitAction` with the ADR-0011 shape read by `readActionSpec`
   (`renderer.ts:447-479`). A new leaf declaring an `action` PropDef gets the click→action
   round-trip with zero renderer change.
2. **A disabled host never emits.** `#wireAction`'s click listener checks `el.disabled === true`
   synchronously at click time (GH #1164, `renderer.ts:471-476`) — so a control that reflects a
   spent state as `disabled` gets renderer-side action suppression for free, on top of its own
   internal inertness.
3. **The tapped-choice payload has a shipped home.** The action context read by `readActionSpec`
   is STATIC (a literal from the payload) — "which chip was tapped" cannot ride it without new
   machinery. But the value-mark machinery (`{prop, event}` input controller) commits a control's
   own state to a data-model path, and a surface created with `sendDataModel: true` folds the
   whole model into the action turn (`emitAction`'s `sendDataModel` fold (`action.ts:107`) feeding `frameClientMessage` (`agent/session.ts`) — the exact machinery
   ADR-0097 verified as "entirely shipped"). Bubble order makes the composition sound: the chip's
   own (deeper) listener updates `selected` and dispatches the commit event in the target phase,
   THEN the click bubbles to the host where the action listener reads a model already updated.
4. **The hardened-data-prop idiom is established.** `DescriptionList.rows` (ADR-0201) is the
   shipped precedent for an array-of-objects bindable prop whose control-side cleaner drops
   malformed entries BEFORE they exist as property state — the enforcement-locus pattern this
   type reuses for `suggestions`.
5. **The event vocabulary has the right member.** The seven-member law (CLAUDE.md) includes
   `select` — selection from a set (the `Select`/`Option`/`MultiSelect` precedent). No eighth
   member is needed.

## Decision

Five clauses; one decision — the wire shape (1/2) is what the one-shot law (3) freezes and the
anatomy rule (4) and disposition (5) bound.

1. **Mint catalog type `Suggestions` → new control `ui-suggestions`.** A leaf (no `ChildList`).
   Not a `Row`-of-`Button`s composition (Context 1-3: the set law has no composed vehicle); not a
   `Button` variant widening (a suggestion SET's laws live above any single button — and Button's
   own command semantics, `checks`/`submit`, are exactly what a suggestion must not carry).
   Naming: `Suggestions` names the SEMANTIC (what it is), not the visual ("chips" is the
   control's own rendering concern) — the `Attachment`/`DescriptionList` naming discipline.
2. **Wire shape — one data prop, one value mark, one optional action prop:**
   - `suggestions` (bindable, `mapsTo:'suggestions'`): array of `{ label: string, value?: string }`
     — `value` defaults to `label`; the control's cleaner (`cleanSuggestions`, the ADR-0201
     idiom) drops empty-label entries by construction. Each `value` SHOULD be a self-describing
     next prompt (producer guidance, build-wave grammar).
   - `value: { prop: 'selected', event: 'select' }` — the ordinary single two-way slot
     (mint-vs-compose's own ruling: never ADR-0161 multi-slot for one value). `selected` is the
     taken suggestion's `value` string; `''` means live/untaken. Committing it through the data
     model is what makes spent-ness DURABLE: a set re-rendered from history renders spent from
     the model alone.
   - `action` (optional, `mapsTo:'action'`): the ADR-0011 object, one per SET — the tap's turn
     trigger, riding the generic host-click wiring (Context fact 1) with `sendDataModel: true`
     carrying the committed `selected` (Context fact 3). Static `context` stays whatever literal
     the producer authored, per ADR-0011 — unchanged, untouched.
3. **The one-shot law is built into the type.** Non-empty `selected` ⇒ the control renders SPENT:
   the taken chip stays visible and marked, the untaken siblings render muted and inert, the host
   reflects `disabled` (so the renderer's GH #1164 guard suppresses any further action emit —
   double enforcement, control-internal + renderer-side). Chips never vanish on selection — the
   history record stays honest (shows what was offered AND what was taken), it just stops being
   an input. This is ADR-0097's frozen-history law relocated INTO the component, enforceable with
   zero page-side lifecycle code on any surface, feed or canvas.
4. **The chip anatomy is INTERNAL.** No public `ui-chip` control is minted by this ADR or
   alongside it — the GH #1371 lane (same charter) resolved Chip/Tag as no-doc: Badge widening
   rejected on the base-class fault line, a standalone chip primitive uncrossed on both
   mint-vs-compose bars. If a SECOND catalog type ever needs this same chip anatomy, extraction
   into a shared primitive is that intake's own decision — named LATER, never preemptive.
5. **Feed disposition: IN.** `FEED_SURFACE_TYPES` gains `Suggestions` — it is a choice control
   that IS its own single commit affordance, with no overlay/pagination/dashboard shape (the
   `Select`/`SegmentedControl` parity argument, strengthened: unlike `Select` it opens no top
   layer at all), and its clause-3 spent law is the ask lifecycle's own freeze discipline in
   miniature. The partition gate (`feed-catalog.test.ts`, LLD-C14) forces this disposition at
   build time regardless; this clause records the ruling and its reasoning.

## SPEC §5.2 row delta (drafted here, UNAPPLIED — the build wave lands it)

| Type | Control | Notes |
|---|---|---|
| `Suggestions` | `ui-suggestions` | **shipped** (ADR-0213). One-shot follow-up suggestion chips — a leaf carrying `suggestions` (bindable array of `{label, value?}`, `value` defaults to `label`; control-side `cleanSuggestions` drops empty-label entries — the ADR-0201 hardening idiom), a `value:{prop:'selected',event:'select'}` mark (the taken suggestion's `value` string, `''` = live; spent-ness round-trips through the data model, so history re-renders honestly), and an optional `action` (ADR-0011 object, one per SET — the tap's turn trigger via the generic `mapsTo:'action'` host wiring; pair with `sendDataModel:true` so the committed `selected` rides the turn). **One-shot by construction:** non-empty `selected` renders the set spent — taken chip marked, siblings inert, host `disabled` (the renderer's GH #1164 guard then suppresses further emits). No `ChildList` — suggestions are data, never child nodes. Feed sub-catalog: **IN** (ADR-0213 cl.5) |

Plus the §5.2 preamble's shipped-set enumeration gains "PLUS the 1 type landed by the
suggestions wave (ADR-0213) — `Suggestions`", per the standing pattern.

## Alternatives considered

- **Compose `Row` + `Button`s (status quo)** — rejected: the one-tap-dismisses-the-set law has no
  composed vehicle (Context 1); violates ADR-0097's frozen-history law on every history
  re-render; ~2N+1 nodes vs one bindable prop.
- **Widen `Button` (a `variant:'suggestion'`)** — rejected: the load-bearing semantics are SET
  semantics (spent-ness across siblings), which no per-button prop can carry; and Button's
  command machinery (`checks`, `submit`) is what a suggestion must not inherit.
- **Mint a public `ui-chip` and compose `Suggestions` from it** — rejected with the GH #1371
  lane's own reasoning: no second consumer exists (extraction is premature generalization), and
  a public interactive chip primitive crossed neither mint bar. Internal anatomy now, extraction
  as a later intake if a second consumer materializes.
- **Dynamic action context (per-chip `context.suggestion`)** — rejected: the shipped action
  context is static by design (`readActionSpec` reads a payload literal); carrying the tapped
  choice would need a new renderer seam, while the value mark + `sendDataModel` already carry it
  through machinery ADR-0097 verified end-to-end. No new seam for a solved round-trip.
- **Chips VANISH on selection** — rejected: the append-only history record must show what was
  offered and taken (the ADR-0097 history-must-not-lie discipline); spent-and-visible, not gone.

## Out of scope (the smallest-floor fences — each a named LATER intake, never a rider)

- **Per-chip icons/avatars** — the chip visual stays text-only at v1.
- **Multi-take suggestion sets** (take several before the set spends) — a different commit model;
  its own intake if a real consumer demands it.
- **A "regenerate suggestions" affordance** — producer-side (re-bind `suggestions`), never a
  control affordance.
- **Producer grammar/prompt teaching and corpus seeds** — the build wave's, alongside the
  baseline recapture (Repairs).
- **A public chip primitive** — see clause 4 and the GH #1371 Findings.
