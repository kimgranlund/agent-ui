# PRD — follow-the-change: the UI follows what the Builder chat changes (GH #695)

> Status: proposed · v1 · 2026-08-11 · Layer: PRD (why/what) · planner (design seat)
>
> Source: [GH #695](https://github.com/kimgranlund/agent-ui/issues/695), Kim's verbatim framing:
> "we need some way for the chat to update UI. Like if I am on the Capabilities tab, and suggest
> making a change to default Model (in Agent tab) then the agent tab should get selected, etc. and
> scroll to that section." Sized `big`; Kim explicitly asked for PRD/SPEC/LLD treatment.
> Downstream: [`follow-the-change.spec.md`](../spec/follow-the-change.spec.md) ·
> [`follow-the-change.lld.md`](../lld/follow-the-change.lld.md) ·
> [ADR-0181](../adr/0181-follow-the-change-attention-navigation.md) ·
> [`follow-the-change.decomp.md`](../decompositions/follow-the-change.decomp.md).
>
> ⚠️ **Stale-premise correction (load-bearing).** GH #695 was filed before GH #686's unified-header
> rework merged. Its Acceptance names "the top-level Chat / Author / Settings `ui-tabs` pane-nav
> (`agent-admin.ts` ~L1180-1207, `#setPane`)" — ALL of that is retired (S7-a→S7-e, confirmed
> 2026-08-11): there is no pane-nav `ui-tabs`, no `#setPane`, and no single-active-tab model. The
> current truth is `admin-three-pane-ia.lld.md` §16.2's shown-SET + primary: a user-chosen set of
> visible panes (Chat · Settings · Co-pilot) plus one primary member; at wide bands every shown
> member paints, below 52.5rem only the primary does. "Switch to the owning tab" therefore becomes
> "ensure the Settings pane is in the shown-set" (wide) and CANNOT honestly mean "steal primary"
> (narrow) — see PRD-G2 and the SPEC. The settings SUB-nav (Agent / Capabilities / Surface,
> GH #574) survives as described and is still the inner navigation this feature drives.

## 1 · Problem

The Builder interview (the guided "New Agent" conversation, ADR-0178 / GH #633 family) applies
`personaPatch` changes to the draft agent's store mid-stream. Every pane with a subscription
hydrates live — but the pane showing the changed field may not be on screen: the user sits on
Capabilities while the chat changes `model`, which renders under Agent › Model. Today that change
lands invisibly. The user either notices nothing (and later distrusts the draft: "when did THAT
change?") or must hunt for what the chat said it did. The feedback loop the authoring flow exists
to give (ADR-0178's live hydration) breaks exactly when the change is off-screen.

## 2 · Users

- **The agent author in the Builder interview** — the primary user: talking to the co-pilot while
  the draft's config panes sit beside (wide) or behind (narrow) the conversation.
- **Downstream: any NL-edit flow** — ADR-0178 cl.6's deferred ordinary-persona NL editing inherits
  the same mechanism when it lands (same patch path, same reaction).

## 3 · Outcomes (goals)

- **PRD-G1 — attention follows the change.** When a consumed patch changes config whose home is
  not currently visible, the UI brings that home into view: owning pane visible, owning section
  selected, changed fold scrolled to and visibly marked. The user never has to notice-and-hunt.
- **PRD-G2 — the user's place is never stolen.** The reaction widens what is visible; it never
  removes a pane the user chose, never moves keyboard focus, never yanks the primary pane out from
  under an active interaction. Where honest navigation is impossible (narrow band, mid-edit), the
  reaction degrades to a visible pointer the user can follow, never a forced jump.
- **PRD-G3 — every consumed change is narrated where the user already looks.** The chat turn that
  carried the patch states, in the conversation itself, what changed and where it lives — so even
  the fully-degraded path leaves no invisible change.
- **PRD-G4 — "where does field X live?" becomes queryable data.** A first-party field→location map
  exists (store key → pane/section/fold), derived from the canonical key set so it cannot drift
  from it, usable by this feature and by anything later (deep links, search, validation jumps).

## 4 · Non-goals

- **Changing how patches land.** The apply path (`persona-patch.ts`'s three-filter gate, the
  consumption fence) is GH #691's territory and stays byte-identical; this feature only reacts to
  a patch having landed.
- **Propose-time preview / confirmation UI.** No "the model wants to change X — allow?" flow; the
  ruled trigger is commit-time (ADR-0181 cl.1, SPEC-R1's rationale).
- **Per-row (field-level) scroll anchors.** v1 anchors at the fold (`settings-item`) grain — the
  finest stable DOM anchor that exists today; per-field anchors are a later wave if fold grain
  proves too coarse.
- **Reacting to hand edits, imports, preset seeding, or test-chat turns.** Only a CONSUMED
  Builder-interview patch triggers (the fence's own boundary).
- **The Context tabs.** Read-only introspection; no patchable field lives there.

## 5 · Shape of success (acceptance, PRD grain)

A user on the Capabilities section, at a wide band, asks the co-pilot for a different default
model: the Settings pane (if hidden) appears, the sub-nav flips to Agent, the Model fold scrolls
into view carrying a brief attention wash, and the turn's reply includes "Updated Model
(Agent › Model)". The same ask at a narrow band changes nothing about which pane paints; the reply
carries the same line, and the Model fold carries its wash the next time the user opens Agent.
Checkable predicates live in the SPEC (§Acceptance); the SPEC owns behavior.
