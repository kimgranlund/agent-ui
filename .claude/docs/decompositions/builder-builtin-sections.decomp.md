# Builder builtin-section update — decomposition (GH #696 / ADR-0178 Amendment)

> Status: proposed · v0.1 · 2026-08-11 · planner. The design pass GH #696's own Classification
> routes here ("likely needs an ADR amendment rather than a straight code change — routing/sizing
> left to the design pass"). One manifest, two-plane coverage, per-slice doc-tier right-sizing —
> the [`agent-authoring-flow.decomp.md`](./agent-authoring-flow.decomp.md) pattern at bug-fix
> scale. `break-down-problem` is not installed in this repo's `.claude/`; its two-plane method
> (OUTSIDE-IN structure × INSIDE-OUT action, cross-checked) is applied inline — §3 is the manual
> coverage check.

## 0 · Bound substrate (read, not duplicated — cited by ID below)

- **The gate:** `applyPersonaPatch`'s three-filter chain
  (`packages/agent-ui/app/src/controls/agent-admin/persona-patch.ts`; ADR-0178 cl.2,
  [`agent-authoring-flow.lld.md`](../lld/agent-authoring-flow.lld.md) §3). Its entries branch is
  append-only by construction: `store.set(key, [...current, ...admitted])`, no update/replace path
  anywhere.
- **The placeholders:** `DEFAULT_PROMPT_SECTIONS` (`entries.ts:48-79`) — Foundation ("You are a
  helpful assistant.") / Personality / Critical Items, `builtin: true`, seeded into every persona
  incl. every Generate-path draft. `builtin` means NON-DELETABLE only (ADR-0132 Fork 4; verified:
  `entry-list.ts` withholds the Remove button, but the content editor mounts for every
  prompt-section row — a builtin's content IS hand-editable today).
- **The composition:** `composeSystemPrompt` (`entries.ts:169-175`) — enabled, non-empty sections
  in `order`; Foundation is `order: 0`, so its placeholder text leads every composed prompt.
- **The merge law:** SPEC-R29 ([`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) §3.2d)
  — values per-key whole-value last-writer-wins; entries CONTRIBUTIONS only, "never a replacement
  of that list"; NO deletion semantics. The mechanics teaching (`authoring-teaching.md`, host-owned
  byte-pinned) and the generated key vocabulary (`vocabularySection()`,
  `site/pages/agent-admin-presets.ts`) both teach append-only today.
- **The consumption fence:** Kim's §15 option-(b) ruling (agent-authoring-flow LLD) — a patch is
  consumed iff the driving store IS `authoringStore` AND the gate reads ON, conjunctive; apply
  target is always the draft. Unchanged by this pass; every widening below sits BEHIND it.
- **Adjacent, not solved here:** GH #691/PR #692 (entries teaching concreteness — the same
  `authoring-teaching.md` file; rebase-order note in the LLD) · GH #695 (cross-tab reaction —
  a downstream CONSUMER of the update signal this pass adds to `PatchReport`).

## 1 · Doc-tier right-sizing (never the bundle by default)

| Slice | Earns | Why |
|---|---|---|
| X1 ADR-0178 Amendment | **proposed amendment, authored with this manifest** — Kim ratifies | A real fork: three candidate resolutions in the issue, one chosen, and the choice edits a RATIFIED contract's substance (cl.2's append-only entries law + SPEC-R29's pinned merge law). Exactly the amendment class, not a new ADR — the decision extends ADR-0178, it does not supersede it. |
| S1 Build (gate + teaching + log + proofs) | **compact LLD** ([`builder-builtin-section-update.lld.md`](../lld/builder-builtin-section-update.lld.md)) + build | Real multi-file seam work (gate branch × byte-pinned prompt re-pin × generated vocabulary × turn log × panes proof) with two known traps (fs-shim regen, PR #692 rebase order) — worth a slice-grain LLD; NOT a SPEC of its own (the contract lives in the amendment + the SPEC-R29/R30 row repairs it books). |
| S2 SPEC repair | **rows in `a2ui-live-agent.spec.md`**, landed in S1's own change | A repair to two existing rows' prose, booked by the amendment's Repairs — never a standalone doc. |

No PRD (the why/what is GH #696 + GH #691's repros — established), no new SPEC, no new ADR number.

## 2 · OUTSIDE-IN — structure

```
GH #696 — the apply gate can never replace host-seeded placeholder content
├── X1  ADR-0178 Amendment (proposed, 2026-08-11) — the builtin-update carve-out
│        [authored with this manifest; Kim's ratification GATES S1/S2]
├── S1  Build slice (one PR, post-ratification)
│   ├── S1-a  persona-patch.ts — the update branch (filter 3 gains UPDATE beside APPEND),
│   │         `PatchReport.updated`, `draftStateBlock` carries builtin-section content
│   ├── S1-b  authoring-teaching.md — the generic update-mechanics sentence (+ fs-shim regen,
│   │         the GH #640 trap FIRES here) — after PR #692 lands (same file)
│   ├── S1-c  vocabularySection() — the three builtin ids + roles + a concrete worked example,
│   │         generated from the canonical exports, never hand-listed (the PR #692 lesson)
│   ├── S1-d  agent-admin.ts — turn-log widening (`updated`) + the panes proof (Foundation card
│   │         reflects an update live)
│   └── S1-e  GH sub-issue (ADR-0145 routing)
└── S2  SPEC-R29/R30 row repair (in S1's change) — merge-law carve-out + teaching-bullet exception
```

Pure-structure nodes: X1 (`justify: decision-record`), S1-e (`justify: affordance` — the ADR-0145
tracking container), S2 (`justify: record-repair` — prose repair to an owning doc, no independent
action).

## 3 · INSIDE-OUT — actions (cross-check)

| # | Action | Hosted by |
|---|---|---|
| a1 | Author an agent via the Co-pilot interview and see Foundation/Personality/Critical-Items come to REFLECT the authored persona | S1-a (gate update path) + S1-b/S1-c (the model learns it may/how) |
| a2 | Get a composed system prompt whose identity leads (order 0) with ZERO leftover "helpful assistant" boilerplate | S1-a (update-in-place keeps `order: 0`; `composeSystemPrompt` unchanged — shipped substrate) |
| a3 | Hand-edit a builtin section mid-interview and have the model SEE and respect it | S1-a (`draftStateBlock` now carries builtin content — the mitigation that makes LWW acceptable) + shipped Builder craft ("the user's edit wins") |
| a4 | Have the model REFINE its own earlier Foundation on a later turn | S1-a (updates are repeatable — LWW, the values class) |
| a5 | Keep user-AUTHORED entries safe from replacement/removal | shipped law, untouched — non-builtin members still route append-only through `validateNewEntry`; no deletion path exists anywhere (cited, no node needed) |
| a6 | Observe an admitted/dropped update on the turn log while debugging | S1-a (`PatchReport.updated`) + S1-d (log rendering) |
| a7 | React cross-tab to an update landing | OUT — GH #695's own design pass; `updated` is its input signal, named in the amendment's Consequences |

**Coverage verdict:** a1–a6 each map to a structure leaf or an explicitly-cited shipped host; a7 is
a named out-of-scope edge with an owner (GH #695). Every leaf hosts an action or carries a
`justify`. No `UNHOSTED` action, no `UNJUSTIFIED-LEAF`. Quadrant: **load-bearing.**

## 4 · Open questions

- **OQ1 — which resolution.** **Proposed resolution, not open design:** the amendment rules the
  issue's candidate (a) — a scoped UPDATE path for builtin prompt sections — over (b) empty seeds,
  (c) compose-time shadowing, and a fourth considered variant (replaceable-while-pristine).
  **Owner: Kim** — ratification of the amendment IS this OQ's close. Until then S1/S2 do not
  dispatch.
- **OQ2 — update field scope (`content` only vs `content` + `description`).** Recommendation:
  `content` required, `description` optional; `label`/`order`/`enabled`/`builtin`/`kind` never
  patchable (labels are the panes' stable anchors — GH #695 will navigate by them). Ruled in the
  amendment; called out so a reviewer sees it was a choice.

## 5 · Dependency order

```
X1 ratification (Kim) ──→ S1 (build, one PR: S1-a → {S1-b ∥ S1-c} → S1-d, S2 lands in the same change)
PR #692 (peer, open) ──→ S1-b  [same file — rebase after it merges]
```

## 6 · Recommended first dispatch

Route the amendment to Kim with the standing zero-friction affordance (path + `ratify` one-liner).
S1 is a single builder dispatch once ratified; nothing here is parallelizable enough to earn a
team.
