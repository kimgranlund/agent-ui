# LLD — follow-the-change: chat-driven attention navigation (GH #695)

> Status: proposed · v1 · 2026-08-11 · Layer: app (`app/src/controls/agent-admin/`) · planner
> (design seat)
>
> Refines: [ADR-0181](../adr/0181-follow-the-change-attention-navigation.md) (proposed — **the
> whole build is DOUBLE-BLOCKED: Kim's ratification AND GH #691 landing**; this LLD exists so the
> builder starts the moment both gates clear, not sooner) ·
> [`follow-the-change.spec.md`](../spec/follow-the-change.spec.md) (SPEC-R1…R8 — behavior lives
> there; this doc is the how). Composes on: `persona-patch.ts` (`PERSONA_STATE_KEYS`,
> `PatchReport`, the apply site's contract) · `entries.ts` (`ENTRY_KINDS`) ·
> `agent-admin.ts` @ `7da1b9c6` (`#setPanesShown` :1857 · `#applySettingsSection` :1515 · the
> patch-consumption site :2549–2576 · the note join :2604 · `settingsItem`/`foldItem` :3096–3133) ·
> [`admin-three-pane-ia.lld.md`](admin-three-pane-ia.lld.md) §16.2 (the visibility model — gains
> the clause-2 writer row on ratification, per ADR-0181's Repairs cell; that doc stays the owning
> record). Build plan:
> [`../decompositions/follow-the-change.decomp.md`](../decompositions/follow-the-change.decomp.md)
> (two-plane, coverage clean, slices S1–S4).
>
> Every anchor below was verified against shipped source this intake (file:line cited), NOT against
> GH #695's own stale `#setPane`/pane-nav description (the discrepancy is flagged in the PRD banner
> and ADR-0181's Context — this LLD designs against the post-#686 shown-set model only).

## 1 · Scope

One new pure module + one reaction seam + one CSS block, all inside the existing
`agent-admin` folder. No new `ui-*` element, no new host event (the closed seven-member set
untouched), no catalog change, no transport change, no change to `applyPersonaPatch` or the
consumption fence.

## 2 · Components

| Component | File | Role |
|---|---|---|
| LLD-C1 | `field-location.ts` (new) | the field→location map: `locationFor(storeKey)` + `FieldLocation`, derived from canonical constants |
| LLD-C2 | `field-location.test.ts` (new) | SPEC-R2's two parity gates: totality over `PERSONA_STATE_KEYS`; anchor parity against the composed DOM |
| LLD-C3 | `agent-admin.ts` — `#followChange(report: PatchReport)` + `#pendingAttention` + the `#applySettingsSection` pending hook | the reaction engine (SPEC-R1/R3/R4/R6) |
| LLD-C4 | `agent-admin.css` — the `[data-part="settings-item"][data-attention]` wash | highlight mechanics (SPEC-R5) |
| LLD-C5 | `agent-admin.ts` — the receipt-line composition into the existing note join | SPEC-R7 |
| LLD-C6 | `agent-admin.md` restate + jsdom/browser probes | SPEC §4's gate list |

## 3 · Data — the map's ground truth (LLD-C1)

Verified against the compose (`agent-admin.ts` :885–:892 section `data-role`s; :1082/:1092/:1121–
:1135/:1154–:1177 fold `data-item` keys; nesting: the catalog kind's section mounts inside the
Surface Options A2UI detail zone :1147–:1152, so its anchor is the `surface` fold):

| Store keys | section (`data-role`) | item (`data-item`) | itemLabel |
|---|---|---|---|
| `name` · `temperature` · `agentEnabled` | `agent-content` | `agent` | Agent |
| `model` · `modelsIncluded` | `agent-content` | `model` | Model |
| `bankrollCapable` · `bankroll` | `agent-content` | `bankroll` | Bankroll |
| `entries:prompt-section` · `kindEnabledKey('prompt-section')` | `capabilities-content` | `prompt-section` | Instructions |
| `entries:<k>` · `kindEnabledKey(<k>)` for k ∈ skill/workflow/resource/tool | `capabilities-content` | `<k>` | the kind's label |
| `surfaceMarkdown` · `surfaceA2ui` · `surfaceGenui` · `surfaceGenuiDogfood` · `surfacePlanner` · `surfaceAuthoring` · `a2uiCatalog` · `a2uiLocalPatterns` · `entries:catalog` | `surface-content` | `surface` | Surface Options |
| `entries:pattern-source` · `kindEnabledKey('pattern-source')` | `surface-content` | `pattern-source` | Pattern sources |

```ts
// field-location.ts — beside persona-patch.ts; imports ONLY schema/entries constants (pure data).
export interface FieldLocation {
  pane: 'settings'
  section: 'agent-content' | 'capabilities-content' | 'surface-content'
  sectionLabel: string
  item: string
  itemLabel: string
}
export function locationFor(storeKey: string): FieldLocation | undefined
```

Construction: a `ReadonlyMap` built by spreading key GROUPS from the same constants the apply gate
uses (`ENTRY_KINDS` mapped through `entriesStoreKey`/`kindEnabledKey`, the named `SURFACE_*`/
`BANKROLL_*`/`A2UI_*` keys) — a `Map`, not an object literal, for the same wire-facing
prototype-chain reason `ADMISSION` states (persona-patch.ts:155–172): `report.applied` echoes
wire-origin key strings. Kind labels: one small `KIND_LABELS` record here is acceptable ONLY
because LLD-C2's anchor-parity gate pins each `itemLabel` against the composed fold's real
`summary` attribute — the gate, not the listing, is what prevents drift.

## 4 · The reaction engine (LLD-C3)

Call site: immediately after `patchReports.push(applyPersonaPatch(...))` (agent-admin.ts:2573) —
`this.#followChange(report)` with the just-returned report. Everything below is a private method
family; no public API.

```
#followChange(report):
  keys   = [...report.applied, ...Object.keys(report.added)]        // patch order preserved
  locs   = keys.map(locationFor).filter(defined)                    // SPEC-R2 AC3: silent skip
  if locs empty → return                                            // SPEC-R1 AC1
  target = locs[0]                                                  // SPEC-R6: first applied key
  if settings ∉ #panesShown → #setPanesShown([...shown, 'settings'], #panePrimary)   // additive, cl.2
  if !paints(#settingsPane) → #queuePending(locs); return           // narrow degrade, SPEC-R4
  if activeElement within #settingsPane → #queuePending(locs); #washVisible(locs); return  // suppression
  if settingsNav.selected ≠ target.section → settingsNav.selected = …; #applySettingsSection(…)
  scroll fold(target) — scrollIntoView({ block:'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  #washVisible(locs); #queuePending(locs not in target.section)     // cross-section keys wait
```

- `paints(el)` = `el.getClientRects().length > 0` — pixel truth, never a JS re-derivation of the
  52.5rem band (§16.2's no-JS-layout law stays intact; we READ paint state, write none).
- `#pendingAttention: Map<section, Set<item>>`, cleared on persona switch (piggyback the
  `#conversationEpoch` reset family) and per-section on fire. The fire hook lives at the END of
  `#applySettingsSection(key)`: if the pane paints and `#pendingAttention.has(key)`, wash all +
  scroll first, then delete the section's entry.
- The `settingsNav.selected` write is programmatic — `ui-tabs` emits no `select` for property
  writes (ADR-0019's no-event-echo law), so `#applySettingsSection` is called explicitly, exactly
  as the compose entry does (:1302).
- Focus is never touched on any path (SPEC-R3 AC3) — no `.focus()` call exists in this feature.

## 5 · Highlight (LLD-C4)

`#wash(fold)`: set `data-attention`, remove on `animationend` for the named keyframe + a 2.5s
`setTimeout` fallback (jsdom fires no animation events); re-setting on an already-washed fold
restarts (remove → reflow → add). CSS in `agent-admin.css`:

```css
[data-part='settings-item'][data-attention] {
  animation: ui-admin-attention 1.6s ease-out;
}
@keyframes ui-admin-attention { from { box-shadow: 0 0 0 2px var(--md-sys-color-primary); } to { box-shadow: 0 0 0 2px transparent; } }
@media (prefers-reduced-motion: reduce) {
  [data-part='settings-item'][data-attention] { animation: none; outline: 2px solid var(--md-sys-color-primary); }
}
```

Existing role tokens only (the token-repoint discipline); exact easing/inset tuned at build against
the fold's real border-radius — the CONTRACT is SPEC-R5's ACs, not these literal pixels.

## 6 · The receipt line (LLD-C5)

Compose once per consumed patch, from the SAME `locs` list (deduped by `(section,item)`):
`Updated <itemLabel> (<sectionLabel> › <itemLabel>)`, one line each, joined under the existing
`outgoing` note join (agent-admin.ts:2604) — append-never-replace, after the agent's own note and
before/beside the warning notices (exact order at build; the law is "never displaces the agent's
prose"). `#logTurn`'s patch record: byte-unchanged (SPEC-R7 AC2).

## 7 · Tests + gates (LLD-C2/C6)

- `field-location.test.ts`: totality over `PERSONA_STATE_KEYS` (SPEC-R2 AC1) · anchor+label parity
  against a composed `ui-agent-admin` (AC2) · unknown-key `undefined` (AC3).
- `agent-admin.test.ts` additions (jsdom): the SPEC-R1 zero-reaction table · SPEC-R3 AC2/AC4 ·
  SPEC-R4 suppression/pending/epoch-clear · SPEC-R6 coalescing · SPEC-R8 per-fold truth-table ·
  SPEC-R7 note content.
- `agent-admin.browser.test.ts` additions (real engine): SPEC-R3 AC1 real scroll position ·
  AC3 focus identity · SPEC-R4 AC2 narrow band paint truth · SPEC-R5 animationend/reduced-motion.
  Respect the shard split; no re-monolith, no heap bump (`agent-ui-component-testing`).
- `agent-admin.md`: one new Behavior row (the reaction + its degrade ladder), cites ADR-0181.
- Grammar gates (`site/lib/adr.test.ts` + `site/lib/docs-grammar.test.ts`) green at every doc
  commit, including this wave's.

## 8 · Risks / open edges

- **GH #691 upstream.** The trigger substrate is the very thing #691 reports broken; if PR #692's
  fix changes the apply site's shape, LLD §4's call site moves with it — a mechanical re-anchor,
  escalate only if the `PatchReport` contract itself changes.
- **Fold-grain anchors.** The `surface` fold carries nine keys; a wash at fold grain is honest but
  coarse there. Per-field anchors are the named later wave (PRD §4) — if Kim wants row-level
  precision in v1, that is a scope change through the coordinator, not an improvisation.
- **Scroll container identity.** `scrollIntoView` on the fold scrolls the nearest scrollable
  ancestor — verify at build whether that is `settings-pane` or the pane holder at each band;
  the browser probe (SPEC-R3 AC1) is the arbiter, not an assumption.
- **Non-decisions (no ADR clauses spent):** wash duration/easing exactness; whether the receipt
  line lists dropped keys (ruled no — log-only, ADR-0178's posture); `block:'nearest'` vs
  `'start'` (build may flip to `'start'` if `nearest` under-scrolls tall folds — SPEC AC is
  "scrolled into the pane's viewport", either satisfies it).
