# Decomposition — follow-the-change: chat-driven attention navigation (GH #695)

> Status: proposed · v1 · 2026-08-11 · Layer: decomposition (two-plane manifest, coverage-checked
> inline) · Companion to [ADR-0181](../adr/0181-follow-the-change-attention-navigation.md)
> (proposed) + [`follow-the-change.prd.md`](../prd/follow-the-change.prd.md) +
> [`follow-the-change.spec.md`](../spec/follow-the-change.spec.md) +
> [`follow-the-change.lld.md`](../lld/follow-the-change.lld.md).
> Whole build DOUBLE-BLOCKED: Kim's ADR-0181 ratification AND GH #691 landing (the trigger signal —
> a `personaPatch` actually reaching the draft — is exactly what #691 reports broken; PR #692 is in
> flight, unmerged). This manifest sequences the build, it does not authorize it.

## Plane 1 — outside-in (parts)

| Part | What it is | Inputs (executable from these alone) |
|---|---|---|
| P1 | ADR-0181 — the attention-navigation ruling (proposed; Kim-gated): commit-time trigger · the co-pilot as an ADDITIVE-ONLY pane-visibility writer · the degrade ladder · the field→location map minted as queryable data | GH #695 · ADR-0179 + its GH #686 Amendment (`admin-three-pane-ia.lld.md` §16.2) · ADR-0178 cl.2 |
| P2 | `field-location.ts` — the map: store key → `{pane, section, item}` + human labels, DERIVED from the canonical constants (`PERSONA_STATE_KEYS`, `ENTRY_KINDS`, `kindEnabledKey`, `entriesStoreKey`), never hand-listed per key; total-coverage parity test | `persona-patch.ts:61–96` · `entries.ts:24–43` · `agent-admin.ts` §compose (`data-role`/`data-item` ground truth, LLD §3 table) |
| P3 | The reaction engine — `#followChange(report)` in `agent-admin.ts`, called at the ONE patch-consumption site (agent-admin.ts:2569–2576): coalesce applied keys → locations, ensure `settings ∈ #panesShown` (additive), select the owning settings section, scroll the owning fold | LLD §4 · `#setPanesShown` (agent-admin.ts:1857) · `#applySettingsSection` (:1515) · `PatchReport` (persona-patch.ts:255) |
| P4 | Highlight + pending mechanics — the `data-attention` wash on `settings-item` folds (`agent-admin.css`), reduced-motion honored; `#pendingAttention` fires on next section reveal when navigation was suppressed | LLD §5 · GH #225 fold anatomy · `--md-sys-color-primary` token family |
| P5 | The receipt line — a consumed patch's turn note gains one human-readable "Updated <section> › <fold>" line per changed location (collapsed when the labels are equal, SPEC-R7; the narrow/suppressed band's only affordance, also the wide band's narration) | LLD §6 · the note-composition join (agent-admin.ts:2604) · P2's labels |
| P6 | Docs + gates — `agent-admin.md` restate, jsdom truth-table + browser scroll/paint probes, grammar gates green | LLD §7 · SPEC §Acceptance |

Dependency edges: P1 → everything — BOTH gates (ADR-0181 ratification AND GH #691 landed) block
every slice, S1 included; the conservative reading is the ruled one (doc-checker minor 5): no
build dispatches, even the pure-data map, before both clear. P2 independent of P3–P6 (pure data +
test). P3 depends on P2 (consumes the map). P4 depends on P3 (the reaction sets/queues attention).
P5 depends on P2 (labels) — parallel to P3/P4. P6 last.

## Plane 2 — inside-out (actions the change must support)

| Action | Covered by |
|---|---|
| a1 Consumed patch touches an off-screen field → owning pane visible + owning section selected + fold scrolled/highlighted (wide band) | P3, P4 (+P2) |
| a2 User mid-edit inside the settings pane → no section yank; highlight-or-pending + receipt only | P3, P4, P5 |
| a3 Narrow band (settings has no box) → primary NEVER stolen; receipt line + pending highlight on next visit | P3, P4, P5 |
| a4 Dropped-only patch (empty `applied`+`added`) → zero reaction | P3 |
| a5 Every patchable key resolves to a location (parity gate); an unmapped key → no reaction, never a throw | P2 |
| a6 Multiple keys in one patch → ONE coalesced navigation, every changed fold washed | P3, P4 |
| a7 The user's shown-set only ever widens; primary and keyboard focus untouched at wide; min-one invariant untouched | P1, P3 |
| a8 Test-chat / hand-edit / import / preset writes never trigger (the consumption fence inherited — only a CONSUMED patch reacts) | P1, P3 |
| a9 Reduced motion honored (no smooth scroll, no animation wash) | P4 |
| a10 No build before ADR-0181 ratification + GH #691 landing | P1 |
| a11 The record stays honest: `#logTurn`'s patch keys unchanged; the receipt is additive narration | P5, P6 |

## Coverage check (inline)

Every action a1–a11 names ≥1 owning part; every part P1–P6 carries ≥1 action (P1←a7/a8/a10 ·
P2←a5 · P3←a1/a2/a3/a4/a6/a7 · P4←a1/a2/a3/a9 · P5←a2/a3/a11 · P6←a10/a11). No orphan parts, no
uncovered actions. Clean.

## Build slices (one writer per file; sequenced, post-ratification + post-#691 only)

1. **S1** — P2 (`field-location.ts` + `field-location.test.ts`: parity over `PERSONA_STATE_KEYS`,
   DOM-anchor parity against the composed folds).
2. **S2** — P3+P4 (`agent-admin.ts` reaction + pending machinery, `agent-admin.css` wash) — one
   slice: the engine and its paint move together or the wash has no writer mid-wave.
3. **S3** — P5 (the receipt line + its note-join tests). May run parallel to S2 after S1.
4. **S4** — P6 (`agent-admin.md` restate · browser probes: real-engine scroll position + paint
   truth at both bands · full gates by exit code).
