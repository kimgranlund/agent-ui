# ADR-0196 — a fleet-wide answered/settled state law for choice controls (GH #1065): ONE `:state(answered)` host custom state + ONE `--ui-answered-*` token pair, precedence-composed under disabled/pending and over the TKT-0062 states, consumed by the A2UI questionnaire card's settle/edit-amend flow (append-amendment semantics, ratified)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-17
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Proposed by** | dispatched design lane for GH [#1065](https://github.com/kimgranlund/agent-ui/issues/1065) — the issue's own Acceptance requires this ADR before any control or template ships; Kim's find-intent round (2026-08-17) RATIFIED the two framing decisions this ADR builds on (append-amendment edit semantics; fleet-law + template scope), and delegated exactly one open question to this record: the exact precedence ordering |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-17, via the [`ratify ADR-0196` utterance](https://github.com/kimgranlund/agent-ui/issues/1065#issuecomment-5315818507) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build (not authored here): `shared/src/tokens/tokens.css`-adjacent role aliases (mints `--ui-answered-bg`/`--ui-answered-ink` as ALIASES, no new literals) · `.claude/docs/references/interaction-states.md` (a new `§6 · Answered / settled choice` section alongside §1b TKT-0062 and §5 pending/ADR-0191) · each choice control's `{name}.css` answered block + CSS pin-test (`radio-group` · `checkbox` · `switch` · `segmented-control` · `select` · `multi-select` · `combo-box`) · the A2UI questionnaire/multiple-choice card template's settle/edit-amend wiring (AFTER GH #1064's fix lands — Sequencing, Consequences below) |
> | **Supersedes / Superseded by** | **Relates** ADR-0191 (the pending-state convention whose SHAPE this ADR re-applies to a third state axis — one host state + one token pair + a fixed precedence, never per-component hacks) · **Relates** [TKT-0062](../tickets/tkt-0062-entry-control-filled-state-law.md) (the filled-state law this state composes OVER, and the mutual-exclusion selector lesson its build recorded) · **Relates** [TKT-0047](../tickets/tkt-0047-interaction-state-design-gaps-from-fleet-audit.md) (role-repoint-not-opacity disabled canon, preserved) · **Relates** ADR-0153 (the seven-member event vocabulary this ADR deliberately does NOT extend) · **Relates** ADR-0183 (row-30 state-law precedents) · **Resolves** GH #1065's ADR half (the fleet-state + token contract AND the template consumption contract; the builds are follow-up slices) · **Relates** GH #805 (closed precursor — disable-on-submit; this ADR replaces that posture with answered-not-disabled) |

## Context

A2UI multi-step questionnaire cards (the agent-admin test-chat intake flows) leave an answered
multiple-choice card fully expanded and uneditable: every option stays painted at full interactive
weight after submit, so an answered question reads exactly like an unanswered one, and the only prior
treatment (GH #805, closed) was to hard-DISABLE the card's inputs — which reads as "broken/forbidden",
not "settled", and forecloses correction entirely.

Kim's find-intent round on GH #1065 (2026-08-17) ratified two decisions this ADR does not re-litigate:

- **(a) Edit semantics = APPEND AMENDMENT.** A settled card gains an Edit affordance; a change appends
  a new user turn ("Changed: X → Y") that the agent reconciles forward. Jump-back/rewind is an explicit
  v1 NON-GOAL (revisit trigger: amendments prove insufficient in live use).
- **(b) Scope = FLEET STATE LAW + TEMPLATE.** An ADR-backed answered/settled host state + token pair on
  the choice controls (the TKT-0062/ADR-0191 shape), precedence-composed under the existing state laws,
  consumed by the A2UI questionnaire/multiple-choice card template, which on submit collapses to the
  selected answer(s) + a compact summary row — never full removal.

One question was explicitly left to this ADR: the EXACT precedence ordering among
`disabled / pending / answered / the TKT-0062 states`. Decision cl.3 fixes it.

**Fleet precedent check, done explicitly (ADR-0191's own discipline re-run):** the live host
custom-state vocabulary is `:state(ready)` / `:state(dragging)` / `:state(truncated)` /
`:state(revealed)` / `:state(settled)` (ui-status-stream, GH #722) / `:state(pending)` (ADR-0191) —
all `ElementInternals`-backed, none AX-reflected, none expressed as host `data-*` attributes. The
choice-control family this law covers is the set of fleet controls a questionnaire answer renders
through: **`ui-radio-group` (with its `ui-radio` children painted via the group's state),
`ui-checkbox`, `ui-switch`, `ui-segmented-control`, `ui-select`, `ui-multi-select`, `ui-combo-box`**
(enumerated from `packages/agent-ui/components/src/controls/`; `ui-segmented-control` inherits from
`UIRadioGroupElement`, so the radio-group wiring covers it structurally). Free-text entry controls
(`ui-text-field`/`ui-textarea`) are NOT in scope — a questionnaire's free-text answers settle at the
CARD level (the summary row) without needing a per-control visual state, and extending the law there
is a cheap future slice if a real consumer earns it.

## Decision

1. **One host custom state: `:state(answered)`.** The name is `answered`, not `settled`, deliberately:
   `:state(settled)` is ALREADY TAKEN in the fleet vocabulary by `ui-status-stream` (GH #722, "the
   stream has finished") on a different axis, and ADR-0191 cl.3 already rules how `settled` composes
   with `pending` there — reusing the word for a second, unrelated axis (a choice control holding a
   confirmed answer) would make one selector token mean two things and poison every future
   `:state(settled)` audit. `answered` is also the issue's own domain word. Mechanically this is the
   exact ADR-0191/`trackUserInvalid` pattern: the CONSUMING SURFACE (the questionnaire template, or any
   host app) sets a public prop/attribute (`answered`, a boolean prop in each control's `static props`),
   and the control's own effect mirrors it into `this.internals.states.add('answered')` /
   `.delete('answered')` — presentation-only, never AX-reflected (the control is NOT disabled and NOT
   readonly at the platform level; Decision cl.4 keeps correction live).
2. **One token pair: `--ui-answered-bg` + `--ui-answered-ink`, both ALIASES — zero new literals.**
   `--ui-answered-bg: var(--md-sys-color-neutral-container-low)` and
   `--ui-answered-ink: var(--md-sys-color-neutral-on-surface-variant)` — the answered treatment is a
   ROLE-REPOINT (the TKT-0047/TKT-0062 canon for persistent, known-depth control chrome), not an
   opacity dim: unlike ADR-0191's pending (arbitrary unknown-depth stale content), an answered choice
   control's parts are the control's OWN chrome, exactly the case the role-repoint canon covers, and
   the selected option must stay legible at full contrast — only the UNSELECTED options and the frame
   step back to the quieter bg/ink pair, while the selected indicator keeps its existing selected
   tokens untouched. Each control repoints its own `--ui-{name}-{bg,ink}` chain to the `--ui-answered-*`
   pair inside its `:state(answered)` rule (the TKT-0062 HIGH-finding mechanism: repoint the custom
   property, never a direct `color:` declaration). If a control's answered treatment layers any tinted
   surface, it obeys the G9 14%-alpha ceiling law — but the default treatment needs no new tint at all.
3. **Precedence, fixed: `disabled > pending > answered > focus > hover > filled > default`**
   (i.e. `disabled > pending > answered >` the entire TKT-0062 table, whose internal
   `focus > hover > filled > default` ordering is untouched), with `user-invalid` remaining orthogonal
   exactly as TKT-0062 left it. Rationale for each edge, since the issue delegates this call here:
   - **`disabled` over everything** — fleet canon (TKT-0062's table, ADR-0191 cl.3): disabled is the
     terminal "no interaction possible" statement; an answered-but-disabled control must read disabled,
     never "quietly settled but maybe editable".
   - **`pending` over `answered`** — pending is a TRANSIENT overlay reporting "an amendment/refresh is
     in flight right now" (ADR-0191); when an Edit-triggered amendment is being reconciled, the user
     must see the in-flight dim over the settled treatment, or a slow reconcile is indistinguishable
     from a completed one. The two compose mechanically for free (pending is an opacity step, answered
     is a role-repoint — different channels), but where a consumer's CSS must pick a message, pending
     wins.
   - **`answered` over `focus`/`hover`/`filled`** — this is the one genuinely new edge, and the reason
     it lands this way: TKT-0062's hover/focus repaints are AFFORDANCE signals ("this control is ready
     for input"). A settled control's whole message is the opposite — "input is done here; correction
     goes through Edit". Letting hover/focus repaint an answered control to its live-entry colors would
     re-advertise direct interactivity the settle flow just took away, and (per TKT-0062's recorded
     mutual-exclusion lesson) would force every control's CSS into specificity fights. The Edit
     affordance, not the control chrome, carries the "you can still change this" signal. Implementation
     follows TKT-0062's own law: MUTUAL EXCLUSION via `:not()` guards on every state selector, never
     source-order/specificity.
4. **Answered is NOT disabled.** `:state(answered)` never sets the platform `disabled` state, never
   blocks focus, and never removes the control from the form-associated lifecycle — replacing GH #805's
   disable-on-submit posture. Whether an answered control additionally ignores direct value changes
   (routing all changes through Edit) is the CONSUMING template's call (the questionnaire template
   does route through Edit — cl.5); the fleet law fixes only the state name, tokens, and precedence,
   mirroring ADR-0191 cl.4's "no opinion on the composition logic" restraint.
5. **The A2UI questionnaire/multiple-choice card template's consumption contract** (built AFTER
   GH #1064's advance-fix lands — same template, sequenced to avoid double-editing):
   - **On submit the card SETTLES, never disappears**: options collapse to the selected answer(s) plus
     one compact summary row; the card element stays present in the surface — full removal is banned
     because the Edit affordance needs a durable anchor (the Edit-anchor law). The still-rendered choice
     controls carry `answered` (→ `:state(answered)`).
   - **Edit re-opens**: activating the Edit affordance expands the card's options again and clears
     `answered` on its controls for the duration of the edit. The Edit affordance is a plain fleet
     button emitting within the existing seven-member event vocabulary (`change · input · select ·
     open · close · toggle · action`, ADR-0153) — no eighth event name is minted; the template wires
     the affordance's activation internally.
   - **A change APPENDS an amendment turn**: confirming a changed answer appends a new user turn of the
     shape "Changed: X → Y" to the conversation, which the agent reconciles FORWARD; prior turns are
     never rewritten, removed, or rewound (Kim-ratified decision (a)). Re-confirming the SAME answer
     appends nothing — the card simply re-settles.
   - After the amendment is sent, the card re-settles to the updated answer(s) + summary row; while the
     reconcile is in flight the controls may additionally carry `pending` (ADR-0191), composing per
     cl.3.
6. **Nothing ships wired to this ADR in the same PR.** This is a docs-only proposal (GH #1065's own
   Acceptance sequence: ADR proposed and ratified FIRST). No `.css` in this change references
   `:state(answered)` or `--ui-answered-*`; the control slices and the template slice are follow-ups,
   the template slice gated behind #1064.

## Non-goals

- **Jump-back / rewind** — explicitly out for v1 (Kim-ratified). Revisit trigger, recorded verbatim
  from the ruling: amendments prove insufficient in live use.
- **Any new event name** — the seven-member vocabulary (ADR-0153) is closed; this ADR adds no member.
- **Free-text entry controls** (`ui-text-field`/`ui-textarea`) — settling is card-level for them;
  extending `:state(answered)` there is a future slice needing its own consumer, not pre-ratified here.
- **AX reflection** — `answered` stays presentation-only, matching every existing member of the host
  custom-state vocabulary; if a future accessibility audit wants an announced "answered" semantic, that
  is a separate decision on a separate channel (ARIA via `ElementInternals`), not a silent extension of
  this one.

## Consequences

- The fleet's host custom-state vocabulary gains one member: `ready / dragging / truncated / revealed /
  settled / pending / answered` — named here so the next vocabulary audit finds a cited decision, not
  drift (the ADR-0191 discipline).
- Every future "this question/step/form is done" surface has one convention to reach for — the third
  state axis run through the TKT-0062 shape (fill → TKT-0062, async freshness → ADR-0191, answer
  settlement → this ADR), each axis composing rather than reopening the others' closed tables.
- **Sequencing**: the questionnaire-template slice lands AFTER GH #1064's card-advance fix (sibling,
  same template file) — building both concurrently would double-edit one template; the fleet-control
  slices have no such gate and may proceed on ratification in any order.
- GH #805's disable-on-submit posture is retired by cl.4; any surface still hard-disabling answered
  A2UI inputs migrates to `answered` when the template slice lands.
- The `answered > focus/hover` edge (cl.3) and the exact alias choices (cl.2) are this proposal's own
  judgment calls — genuinely open to revision at ratification, which is why this lands `proposed`
  rather than pre-wired.
- Until ratified, no control or template may key off `:state(answered)` or `--ui-answered-*`; a surface
  needing settle styling sooner must wait (this ADR recommends waiting, per ADR-0191's own consequence
  clause, rather than pre-empting the convention it proposes).

## Alternatives considered

- **Reuse `:state(settled)`** — rejected: already a live vocabulary member on `ui-status-stream` for a
  DIFFERENT axis (stream completion), with its own ADR-0191 cl.3 composition ruling; one token, two
  meanings is exactly the drift this vocabulary's audits exist to prevent.
- **`disabled`-on-submit (the GH #805 posture)** — rejected: disabled is the fleet's "interaction
  forbidden" terminal state (role-repoint to the muted disabled row, focus removed); a settled answer
  is confirmed-but-correctable, and the append-amendment flow REQUIRES the card to stay a live,
  focusable anchor for Edit. Semantically wrong and mechanically obstructive.
- **A `data-answered` host attribute** — rejected on ADR-0191's own grounds, unchanged: the fleet's
  `data-*` vocabulary lives on inner PARTS; the host-level boolean-state vocabulary is `:state()`, and
  a host attribute forfeits free composition with `:state(pending)`/`:state(disabled)` selectors.
- **An opacity dim (the ADR-0191 pending mechanism) instead of a role-repoint** — rejected: pending's
  opacity exception exists for arbitrary unknown-depth stale content (TKT-0047's carved case); an
  answered choice control's parts are its own known chrome, the role-repoint canon's home case, and a
  whole-control dim would ALSO dim the selected answer — the one thing that must stay fully legible.
- **`answered` UNDER hover/focus (letting live affordance repaints win)** — rejected: re-advertises
  direct interactivity on a control whose interaction contract has moved to the Edit affordance, and
  re-creates the TKT-0062 specificity fights its mutual-exclusion law closed. The Edit affordance is
  the settle flow's single "change this" signal.
- **Card removal or history rewrite on edit (jump-back)** — rejected for v1 by Kim's ratified decision
  (a): removal orphans the Edit anchor; rewind falsifies the conversation record the agent reasons
  over. Amendment turns keep the transcript append-only and the agent's reconciliation forward-only.
- **A per-template, template-local settle style (no fleet law)** — rejected: the exact per-component-
  hack failure TKT-0062 and ADR-0191 were minted to prevent; the second questionnaire-like surface
  would immediately re-derive a divergent treatment.
