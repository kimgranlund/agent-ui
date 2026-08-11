# SPEC — follow-the-change: chat-driven attention navigation (GH #695)

> Status: proposed · v1 · 2026-08-11 · Layer: SPEC (execution contract) · planner (design seat)
>
> Refines: [`follow-the-change.prd.md`](../prd/follow-the-change.prd.md) (PRD-G1…G4) ·
> [ADR-0181](../adr/0181-follow-the-change-attention-navigation.md) (proposed — the five forks
> GH #695 names open are RULED there; this SPEC states the resulting behavior). Composes on:
> ADR-0178 cl.2 (the patch consumption condition + `PatchReport`) · ADR-0179 + its GH #686
> Amendment (`admin-three-pane-ia.lld.md` §16.2 — the shown-set/primary visibility model this
> feature writes into, additively) · GH #574 (the Agent/Capabilities/Surface settings sub-nav) ·
> GH #225 (the `settings-item` fold anatomy the anchors ride).
> Build plan: [`follow-the-change.decomp.md`](../decompositions/follow-the-change.decomp.md).
> Build DOUBLE-BLOCKED: ADR-0181 ratification + GH #691 (the trigger signal is what #691 reports
> broken — nothing reliable exists to react to until hydration is proven live).
>
> Every DOM/API fact below was verified against shipped source this intake (`agent-admin.ts` @
> `7da1b9c6` — the post-#686 tree, NOT the ticket's stale `#setPane` references; the discrepancy is
> flagged in the PRD banner and ADR-0181's Context).

## 1 · Vocabulary

- **Location** — `{ pane, section, item }`: the pane (`'settings'` for every patchable key today),
  the settings section's `data-role` (`agent-content · capabilities-content · surface-content`),
  and the owning fold's `data-item` key (`[data-part="settings-item"][data-item=…]`).
- **Consumed patch** — a `personaPatch` that passed the component's consumption condition
  (store-identity fence AND fresh gate read, ADR-0178 cl.2 / agent-admin.ts:2549–2576) and was
  applied through `applyPersonaPatch`, yielding a `PatchReport`.
- **Visible** — the element actually paints: `getClientRects().length > 0` (pixel truth, never a
  re-derivation of the 52.5rem band in JS).

## 2 · Requirements

**SPEC-R1 — Commit-time trigger, never propose-time (GH #695 open Q1, ruled ADR-0181 cl.1).**
The reaction fires when, and only when, a consumed patch's `PatchReport` has non-empty
`applied` or `added`. A patch that was refused by the fence/gate, or whose every item dropped,
fires nothing. Rationale (stated once, here): (a) the apply gate DROPS items — a propose-time
reaction could navigate to a field that never changed, which is a lie in navigation form; (b) the
shipped flow has no confirmation step — patches apply mid-stream (agent-admin.ts:2570), so
"proposed" and "committed" are the same moment minus the gate; reacting after the gate is the only
honest trigger and needs zero new wire semantics.

- AC1: a turn whose patch is fully dropped (`applied: [] · added: {}`) produces zero visibility
  writes, zero scrolls, zero washes, zero receipt lines (jsdom: spy on `#setPanesShown` /
  DOM-assert no `data-attention`).
- AC2: a turn refused by the fence (test-chat volunteer) or the gate produces the same zero
  (existing `patchIgnored` path untouched).
- AC3: a consumed patch with ≥1 applied key fires exactly one reaction per patch event.

**SPEC-R2 — The field→location map (GH #695 open Q5, ruled ADR-0181 cl.4).**
A new pure module `field-location.ts` (beside `persona-patch.ts`) exports
`locationFor(storeKey: string): FieldLocation | undefined` with

```ts
interface FieldLocation {
  pane: 'settings'
  section: 'agent-content' | 'capabilities-content' | 'surface-content'
  sectionLabel: string   // 'Agent' | 'Capabilities' | 'Surface' — the data-segment copy
  item: string           // the settings-item fold's data-item key
  itemLabel: string      // the fold's summary copy ('Model', 'Instructions', …)
}
```

The map is DERIVED from the canonical constants (`ENTRY_KINDS`, `kindEnabledKey`,
`entriesStoreKey`, the named `SURFACE_*`/`BANKROLL_*`/catalog keys) — never a hand-listed
per-key table that can drift (the `persona-patch.ts` hoisting rationale, applied again).

- AC1 (totality parity gate): every `PERSONA_STATE_KEYS` member resolves to a defined location —
  a key added to the canonical set without a location fails the suite, by construction.
- AC2 (anchor parity gate): every distinct `(section, item)` the map emits matches a real composed
  DOM anchor — a `div[data-role=<section>]` containing `[data-part="settings-item"][data-item=<item>]`
  (jsdom over the composed element).
- AC3 (fail-closed): an unmapped key returns `undefined` and the reaction skips it silently —
  never a throw (the §3-filter drop discipline; a throw would fail the turn).

**SPEC-R3 — The wide-band reaction (GH #695's headline behavior, post-#686 model).**
On trigger, coalesced per patch event (SPEC-R6):

1. **Ensure the pane**: if `settings ∉ #panesShown`, add it via the existing `#setPanesShown`
   mutator with the CURRENT primary unchanged — an ADDITIVE-ONLY write (ADR-0181 cl.2): the
   reaction never removes a set member, never repoints primary, never writes at narrow bands
   (step 2's paint check is what makes that true without re-deriving the band).
2. **Paint check**: if the settings pane is still not visible (narrow band — only primary paints),
   stop here and take SPEC-R4's degrade path.
3. **Ensure the section**: if the target section is not the selected settings sub-nav tab, select
   it (`settingsNav.selected` + `#applySettingsSection`) — UNLESS suppressed (SPEC-R4).
4. **Scroll**: `scrollIntoView({ block: 'nearest' })` on the owning fold, `behavior: 'smooth'`
   except under `prefers-reduced-motion: reduce` (then `'auto'`).
5. **Mark**: the attention wash (SPEC-R5) on every changed fold in this patch event.

- AC1 (the ticket's own scenario): user on Capabilities, consumed patch writes `model` → the
  settings pane is shown, sub-nav lands on Agent, the `data-item="model"` fold is scrolled into
  the pane's viewport (browser test: real scroll position) and carries `data-attention`.
- AC2: with settings already visible and the right section selected, only steps 4–5 run (no
  visibility writes — assert `data-show`/`data-primary` byte-unchanged).
- AC3: keyboard focus (`document.activeElement`) is identical before and after the reaction, on
  every path (browser assert).
- AC4: the min-one invariant and every existing §16.2 write path are untouched (existing S7-b
  truth-table stays green byte-identical).

**SPEC-R4 — Focus-stealing guards: suppression + the narrow degrade (GH #695 open Q2, ruled
ADR-0181 cl.3).** The reaction is suppressed — steps 3–4 skipped, never queued as a later yank —
when the user is mid-interaction in the settings pane: `document.activeElement` is, or is
contained by, the settings pane at trigger time. At narrow bands (paint check fails) the primary
is NEVER repointed. Both degrade identically:

1. The receipt line (SPEC-R7) still rides the turn — the user is told in the conversation they are
   already looking at.
2. The changed folds' attention is queued in `#pendingAttention` (a `Set` of `(section, item)`);
   when the user next reveals the owning section themselves (a `#applySettingsSection` to it while
   the pane paints), the queued folds wash + the first scrolls, then the queue clears for that
   section. Pending attention survives section flips, is per-draft (cleared on persona switch —
   the `#conversationEpoch` reset family), and never persists to storage.

- AC1: focus inside a settings field at trigger → sub-nav selection and scroll position unchanged;
  the fold still washes if visible; receipt line present.
- AC2 (narrow): at a band where only primary paints, a consumed patch leaves `data-primary` and
  `data-show` byte-unchanged; opening Settings › Agent afterwards washes + scrolls the Model fold
  exactly once (repeat visits: no wash).
- AC3: persona switch clears pending attention (no ghost wash on the next draft).

**SPEC-R5 — Highlight mechanics (GH #695 open Q4, ruled ADR-0181 cl.3).** Reuse fleet vocabulary,
mint no new system: the wash is a `data-attention` attribute on the owning `settings-item` fold,
styled in `agent-admin.css` as a ~1.6s ease-out box-shadow/outline wash on the existing
`--md-sys-color-primary` role tokens (the token-repoint discipline — no new color), removed on
`animationend` (+ a timeout fallback). Under `prefers-reduced-motion: reduce` the wash is a static
outline held ~1.6s, no animation. It is NOT ADR-0159's receipt pattern (that is a status-stream
turn-lifecycle collapse — different job); the conversational half of this feature is SPEC-R7's
plain note line. No persistent badge/count in v1.

- AC1: `data-attention` present immediately after a visible-path reaction; absent after the wash
  completes (browser, animationend observed).
- AC2: reduced-motion media → no CSS animation runs (computed `animation-name: none`), outline
  still appears and clears.

**SPEC-R6 — Coalescing (one patch, one navigation).** A patch event touching N keys produces ONE
navigation: the scroll target is the FIRST applied key's location in patch order (the model's own
emphasis order); every other changed fold gets the wash (and, if in another section, pending
attention per SPEC-R4.2). Multiple patch events in one turn each react independently (they are
already applied independently, agent-admin.ts:2573).

- AC1: a patch writing `model` + `entries:skill` scrolls Model (first in patch order), washes the
  Model fold now, and queues the Skills fold's attention for Capabilities.

**SPEC-R7 — The receipt line (PRD-G3).** Every consumed patch with a non-empty report appends one
block to the turn's outgoing note (the existing append-never-replace note join,
agent-admin.ts:2604): one line per changed location, `Updated <itemLabel> (<sectionLabel> ›
<itemLabel>)` — labels from the map, values deliberately not echoed (the panes already show them;
`#logTurn` keeps the key-grain record). Dropped keys stay log-only (ADR-0178 cl.2's no-error-
surface posture, unchanged).

- AC1: the note contains the line(s) on every consumed-patch turn, both bands, suppressed or not.
- AC2: `#logTurn`'s existing patch record is byte-unchanged.

**SPEC-R8 — Generalization scope (GH #695 open Q3, ruled ADR-0181 cl.5).** ALL patchable keys —
the map is total over `PERSONA_STATE_KEYS` (SPEC-R2 AC1), not the ticket's example trio. Trigger
scope stays exactly the consumption fence: Builder-interview consumed patches only. Hand edits,
imports, preset seeding, and test-chat turns never react (they are either the user's own act or
carry no consumed patch). The Context sections are out of scope (no patchable field renders
there).

- AC1: for a sampled key from EVERY fold (`agent · model · bankroll · prompt-section · skill ·
  workflow · resource · tool · surface · pattern-source`), the reaction resolves and navigates to
  the right `(section, item)` (jsdom parameterized truth-table).
- AC2: a hand `store.set('model', …)` (no patch event) fires nothing.

## 3 · Non-goals (SPEC grain)

Per-field anchors inside a fold · propose-time preview UI · any change to `applyPersonaPatch`/the
fence/the gate · new host events (the closed seven-member set untouched — the reaction is writes +
attributes, no `CustomEvent`) · URL/router integration (the admin composes no router by law).

## 4 · Acceptance (the gate list)

All ACs above are jsdom/browser predicates; the build is done when: `npm run check && npm test`
green by exit code · the browser shard covering `agent-admin` green with the new scroll/paint
probes · SPEC-R2's two parity gates in the default suite · the existing S7-b visibility
truth-table and the ADR-0178 patch suite green byte-unchanged.
