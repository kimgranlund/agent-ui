# ADR-0224 — `ui-service-card`: the availability-stated service/agent launch card (status-tinted accent edge, ONE bindable `available` boolean driving the whole availability posture; Figma: Claude Code Gateway 112-1456 — GH #1429)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 |
> | **Proposed by** | design-lane seat (component-design intake GH [#1429](https://github.com/kimgranlund/agent-ui/issues/1429), Kim's Figma intake — Claude Code Gateway node 112-1456) — ruled mint-earned on BOTH arms of the mint-vs-compose test (`.claude/skills/component-design/references/mint-vs-compose.md`): the TYPE arm (the status-tinted LEFT ACCENT EDGE is inexpressible — `ui-card` carries no edge-tint axis at all, only `elevation`/`brightness` surface planes) AND the ADR-0201 reverse-direction enforcement-locus arm (the availability law — one boolean flipping accent+dot+title-mute+action-swap while the overflow affordance stays live — is only prompt-enforceable in composition; the primitive enforces it by construction) |
> | **Ratified by** | *pending — Kim flips the Status cell by explicit `ratify ADR-0224` utterance, verified by `scripts/adr_ratify.py` (ADR-0149); never self-ratified* |
> | **Repairs** | on ratification+build (not authored here): **NEW** `controls/service-card/*` (`ui-service-card` + `service-card.css` + `service-card.md` descriptor + jsdom/browser probes incl. the forced-colors leg) · site surfaces (doc page, representative preview specimen, gallery row, `sizing-gates.test.ts` fill-posture row) · IF the wire arm is ratified (clause 8's recommendation — Kim rules): `catalog/default/catalog.json` + `factories.ts` (**NEW** `ServiceCard` row — the §5.2 delta drafted below), the full new-catalog-type coverage-machinery lanes (`.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md` §"(iii)" steps 1–8), one corpus seed + prompt-inventory teaching; IF the wire arm is declined: `EXCLUSION_ALLOWLIST` entry (the ADR-0087 catalog-or-allowlist gate — one of the two lands either way, never neither) · `site/public/adr-index.json` regenerated (rider, this change) |
> | **Supersedes / Superseded by** | None. Relates [ADR-0220](./0220-choice-group-rich-card-selection-container.md) (nearest structural kin, DIFFERENT semantics — `ui-choice-card` is a committed-selection option unit under a group; this card is a standalone LAUNCH surface with no selection, no group, no form value; also the "widen `Card`" rejection precedent adopted verbatim in Alternatives) · [ADR-0201](./0201-ui-description-list-key-value-receipt-primitive.md) (the reverse-direction enforcement-locus test this mint passes) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) (the sizing posture: block-level fill, no intrinsic width, the R2 `inline` boolean — adopted at birth, clause 5) · [ADR-0057](./0057-intent-non-color-signifier-rule.md) (status never travels by color alone — the dot + the literal "Unavailable" chip text are the non-color signifiers) · [ADR-0153](./0153-status-stream-elapsed-timer-retry-action-planned-glyph.md) (`action` is the closed-set event this card's Open affordance emits — no new event name) · [ADR-0015](./0015-container-surface-space-token-model.md)/[ADR-0056](./0056-region-less-card-humane-default.md) (the `ui-card` surface prior art the interior rides) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (clause 8's obligation) · [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) (NOT used — this card carries no two-way value; `available` is one-way bound data, the `Badge.intent` precedent) |

## Context

**The intake (GH #1429, Figma 112-1456).** The Claude Code Gateway surface lists agent services as
dark rounded cards. Verified anatomy from the design: a status dot + a status-tinted **left accent
edge** (available = green, unavailable = grey/muted) · a title (muted when unavailable) · a
monospace service path line (`/claims-agent-service`) · a one-line description · an overflow (⋮)
menu affordance top-right · a trailing action — a solid `→ Open` button when available, a disabled
`Unavailable` chip when not.

**Mint-vs-compose, run honestly in both directions:**

*The compose case (steelmanned).* The interior is almost entirely composable today: `ui-card` (+
header/content/footer regions, incl. the header's trailing ⋯ idiom already documented in
`card.md`), `ui-badge` (status tag), `ui-text` (title/description), the fleet mono treatment
(`ui-card-header format="structured"` precedent / `Code` on the wire), `ui-button` (Open). A
composition recipe page could teach this tomorrow at zero mint cost, and this is (so far) a
single-consumer shape (the gateway).

*Why compose still loses — two independent findings:*

1. **The TYPE arm: the accent edge is inexpressible.** `ui-card`'s public surface is
   `elevation`/`brightness`/`scrollable` (`card.md`, verified) — there is NO edge/intent-tint axis
   anywhere in the container family. A producer cannot fake a status-tinted left border with any
   shipped prop; the anatomy's most identity-carrying element has no composition vehicle at all.
   (Widening `ui-card` with an intent edge is rejected in Alternatives — the ADR-0220 precedent:
   it blurs the structural container's identity for every card everywhere.)
2. **The ADR-0201 reverse-direction arm: the availability law has no structural enforcement in
   composition.** `available=false` must SIMULTANEOUSLY (a) grey the accent edge AND the dot,
   (b) mute the title, (c) swap the trailing action from an enabled `→ Open` button to a disabled
   `Unavailable` chip, while (d) the overflow affordance stays LIVE (unavailable is a *service*
   state, not a *control* disablement — you can still inspect/configure a down service). Composed,
   that is four coordinated edits per state change per producer, coupled only by prompt
   discipline; a status flap (services go up and down — the gateway's core dynamic) requires a
   producer to re-derive all four every time, and any missed edit is a defect no validator can
   see. The primitive collapses the whole posture into **one bindable boolean** — the defect class
   becomes unrepresentable, not just prohibited. Re-derived rhythm + bindability, ADR-0201's two
   supporting signals, both present.

*Nearest kin, distinguished.* `ui-choice-card` (ADR-0220) is structurally the closest — a rich
card unit — but semantically disjoint: it is a selection OPTION under an owning group
(`role=option`, no interactive descendants allowed, group owns the commit). This card is the
opposite: a standalone launch surface whose action button and overflow menu are interactive
descendants by design. Forcing one primitive over both would violate the option contract outright.

*The "minting is cheap" check (mint-vs-compose reference) applies verbatim:* `UIElement` + typed
props + one CSS sheet + one `action` re-emit — no new base class, no new event name (ADR-0153's
`action` fits exactly), no new geometry mechanism (container band), no form participation.

## Decision

**We mint `ui-service-card` — an availability-stated launch card — in `controls/service-card/`.**
Eight clauses:

1. **Identity & class.** `UIServiceCardElement extends UIElement` — a display primitive with
   data-props, NOT form-associated (it carries no value), NOT a `UIContainerElement` (its content
   is component-rendered from hardened props, the ADR-0201 `ui-description-list` shape, not an
   agent-composed ChildList). Tier: `pattern` (container spacing + one control-height action row).
   Names derive from the family name `service-card` per `naming.md` §13.
2. **Props (the whole v1 surface).** `name` (string — the title) · `path` (string — the monospace
   service path line; rendered verbatim, no parsing) · `description` (string — one-line;
   single-clamp with ellipsis) · `available` (boolean, default `true`, reflected, **bindable** —
   the one law-carrying axis) · `actionLabel` (string, default `'Open'`) · `inline` (boolean —
   clause 5). Empty `path`/`description` render NO box (the ADR-0201 valueless-row law, applied
   per part).
3. **Anatomy (component-created parts × one slot).** Left accent edge (a component-owned
   `border-inline-start` band, status-tinted) · `data-part="status"` dot (aria-hidden; status is
   ALSO conveyed textually, clause 6) · `data-part="title"` · `data-part="path"` (fleet mono
   typeface, the `format="structured"` kicker-mono precedent) · `data-part="description"` ·
   `data-part="action"` — a REAL `<button type="button">` when `available` (label =
   `actionLabel`, leading `→` glyph), swapped by the SAME render pass to a disabled
   `Unavailable` chip when not (a non-interactive `data-part="action"` box; `disabled` real
   attribute — removed from tab order, `interaction-states.md` §3) · ONE optional **`menu` slot**
   top-right for the consumer-composed overflow affordance (`ui-button` + `ui-menu`; app chrome —
   the card never fabricates a menu it cannot populate). The whole card is **NOT** a hit target:
   with two interactive descendants (action + menu) a clickable host would nest interactives —
   activation is button-only, the drill Back-button precedent.
4. **The availability law — by construction.** `available=false` ⇒ accent edge + dot repoint to
   the muted/neutral roles, title repoints to the muted on-surface role, the action renders as the
   disabled `Unavailable` chip — all from the ONE reflected attribute in ONE sheet; the `menu`
   slot and the host remain fully live (never `aria-disabled` on the host — unavailable is data,
   not disablement). No producer ever coordinates these independently; the split-state defect
   class is unrepresentable.
5. **Geometry & sizing — ADR-0223 posture at birth.** Block-level FILL, NO intrinsic width, no
   default-state min-width (the card's width belongs to the grid that lays these out); the R2
   `inline` boolean flips display level + hug in one move; interior spacing off the
   `--md-sys-space` ladder × density; radius `var(--ui-service-card-radius,
   var(--md-sys-shape-corner-base))`; the action row takes the control height (pattern tier). The
   `sizing-gates.test.ts` row lands CONFORM on day one.
6. **States & a11y.** Interaction states live on the PARTS (button hover/active/focus per
   `interaction-states.md`; the host has no hover state — it is not interactive). Host ARIA: role
   `group` via `internals` with `internals.ariaLabel` mirroring `name` (never host attributes).
   Status is never color-alone (ADR-0057): available ⇒ the enabled `→ Open` button IS the
   signifier + a visually-hidden status text; unavailable ⇒ the literal `Unavailable` chip text.
   The action button's accessible name is `"{actionLabel} {name}"` (list context: N cards, N
   "Open" buttons must be distinguishable). Forced-colors leg: accent edge survives as a border,
   dot gets a border, chip disablement conveyed by `GrayText`.
7. **Events.** The action button's activation re-emits as **`action`** on the host (ADR-0153's
   seventh member — the `ui-status-stream` retry precedent; no detail payload needed at v1, the
   card's identity is the target). No event fires when unavailable (the chip is inert). No new
   event name enters the closed set.
8. **The A2UI wire question — RECOMMENDED, not decided (Kim rules at ratification).** Run on the
   wire side, the same test lands the same way: `Card`+`Badge`+`Code`+`Text`+`Button` rows exist,
   so a lookalike is wire-composable — but the accent edge is still inexpressible and the
   availability law still splits across four uncoordinated payload nodes, un-bindable as one
   boolean (a status flap needs four `updateDataModel` targets instead of one). **Firm
   recommendation: mint the `ServiceCard` catalog row AT v1** — the gateway list is precisely an
   agent-emitted surface, and one bound `available` per card is the row's whole payoff. The §5.2
   delta below is drafted for that arm. If Kim declines, the fallback is the ADR-0087 allowlist
   entry + a documented wire composition (named honestly as prompt-enforced, with the ADR-0201
   escalation falsifier: recurring split-state payloads in review re-open this clause). Fenced
   OUT either way, as named later intakes, never riders: a wire `menu`/actions ChildList (app
   chrome) · multi-action cards · status enums beyond the boolean (degraded/starting — a future
   `status` enum intake supersedes `available` additively if earned) · metrics/sparkline rows in
   the card body.

### The §5.2 delta (drafted here; lands verbatim ONLY if the clause-8 wire arm is ratified)

> | `ServiceCard` | `ui-service-card` | **NEW** (ADR-0224, GH #1429). The availability-stated service/agent launch card. Data props: `name` (string, the title) · `path` (string, the monospace service path) · `description` (string, one line) · bindable `available` (boolean — ONE flag drives accent edge, status dot, title muting, and the Open-vs-Unavailable action swap by construction) · `actionLabel` (string, default `'Open'`). Emits `action` on Open activation (one-way; no value mark — nothing round-trips). No children at v1 (component-rendered interior; the overflow `menu` slot is app chrome, not wire surface) |

## Acceptance

- **This pass (docs only):** this file `proposed`, never self-flipped; `site/public/adr-index.json`
  regenerated (rider); docs-grammar + sitemap suites green on the branch, judged by exit codes; no
  source file touched.
- **On ratification+build (exit gates; per-slice gates in the slices below):** jsdom — the four
  availability consequences flip together off the one attribute, `available` bindable write
  re-renders without event self-emission, empty `path`/`description` render no box, `action`
  re-emit fires available-only, menu slot stays live when unavailable; browser — accent
  edge/dot/title-mute pixels both states, forced-colors leg, fill-posture (no intrinsic width;
  `inline` hugs), descriptor↔props trip-wire; IF wire arm: catalog/conformance/factory legs
  (rubric `a2ui-catalog` D1–D3 ≥ 4 hard) + the full new-catalog-type checklist lanes; ELSE:
  `EXCLUSION_ALLOWLIST` entry present (never neither). `npm run check && npm test` + the relevant
  browser shard green by exit codes.

## Realization slices (each independently gated; S3/S4 fire only on the clause-8 arm Kim picks)

- **S1 — the control.** `controls/service-card/` (ts + css + `service-card.md` descriptor + jsdom
  probes + browser probes incl. forced-colors + the sizing-gates CONFORM row). One writer.
- **S2 — site surfaces.** Doc page, representative preview specimen (a 2–3 card grid, one
  unavailable — the example-authoring representativeness law), gallery row, knobs (one per prop).
- **S3 (wire arm only) — catalog integration.** `catalog.json` + `factories.ts` `ServiceCard` row
  (the §5.2 delta verbatim), conformance legs, the new-catalog-type coverage-machinery checklist
  steps 1–8. *(Declined arm: the `EXCLUSION_ALLOWLIST` entry lands in S1 instead.)*
- **S4 (wire arm only) — teaching.** One frontier corpus seed (a gateway service list, mixed
  availability, a bound `available` flip) + prompt-inventory teaching.

## Consequences

- The gateway's core surface becomes ONE bindable node per service; availability flaps are a
  single boolean write, and the split-state defect class (green edge + disabled chip, muted title
  + live Open) is unrepresentable.
- A new display primitive enters the fleet for what is (today) one consumer — accepted: the TYPE
  arm (no accent-edge vehicle exists) makes composition not merely worse but impossible, and the
  primitive is thin (the "minting is cheap" check held: no new base, event, or geometry).
- `actionLabel` is a prop, not a slot — the deliberate v1 floor; a rich trailing-action slot is a
  fence-listed later intake, not a rider.
- **Stale → re-verify on build:** the §5.2 draft row · `EXCLUSION_ALLOWLIST` vs catalog-row
  disposition (clause 8, Kim's ruling) · this ADR's Repairs cell.

## Alternatives considered

- **Documented composition only (no mint).** Rejected on both arms: the accent edge has no
  composition vehicle (TYPE arm), and the availability law would be prompt-enforced across four
  coordinated edits (the exact ADR-0201 fault line, with the gateway's status-flap dynamic making
  the defect recurring rather than theoretical).
- **Widen `ui-card` (`intent`/`accent` + `available` axes).** Rejected — the ADR-0220 precedent
  verbatim: `Card` is a structural container; availability semantics + an action contract blur its
  identity for every card everywhere, and the widening still needs the action-swap machinery a
  primitive owns anyway.
- **Reuse `ui-choice-card`.** Rejected: `role=option` permits no interactive descendants; this
  card's action button and overflow menu are its point. Selection vs launch are different
  contracts, not variants of one.
- **Whole-card-clickable (card = the Open hit target).** Rejected: nests interactive descendants
  (menu, future body links) inside a clickable surface — the a11y hazard class; button-only
  activation keeps one obvious, nameable target per card.
- **A `status` enum instead of the `available` boolean.** Deferred, not rejected: the Figma design
  states exactly two postures; an enum invents states the design doesn't have (the ADR-0107→0205
  smallest-floor test). The fence names the future intake; an additive `status` axis can supersede
  `available` without breaking it.
- **A ChildList interior (agent-composed body like `ChoiceCard`).** Rejected for v1: the interior
  is a fixed, law-bearing anatomy (title/path/description/action) — hardened data props are what
  make the availability law enforceable by construction; arbitrary children would reopen it.
