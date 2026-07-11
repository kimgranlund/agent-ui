---
doc-type: ticket
id: tkt-0016
status: doing
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0016 — the A2UI message-type lifecycle: crystal-clear when/how, taught and demoed in dialog

## Summary
Kim's ask (2026-07-10): for the A2UI demo, as a user has a DIALOG with the system, the nuances
of the message types and the corresponding UI-generation process must be crystal clear — when
and how to use each: **createSurface** (signal the client to create + begin rendering a new
surface) · **updateComponents** (add/update component definitions in a surface) ·
**updateDataModel** (insert/replace data in a surface's data model) · **deleteSurface**
(explicitly remove a surface and its contents). Dedup: the MECHANISMS all exist
(`protocol.ts` + the renderer handle all four; `deleteSurface` is dispatch/validate/render
covered; `a2ui-live` carries conversation + ask-lifecycle machinery; `a2ui-compose` documents
the three server→client kinds' shapes) — the GAP is the **decision layer and its dialog
proof**: nothing teaches WHEN a turn should update the data model vs re-emit components vs
open a fresh surface vs delete one, and no demo exercises the full four-type lifecycle
visibly in a conversation.

## Acceptance
Two lanes, one record (the knowledge lane feeds the demo lane):

**Lane 1 — the decision layer (agent-facing teaching):**
- A "message-lifecycle" guidance section with the when/how rules, e.g.: data changes on an
  EXISTING surface → `updateDataModel` (never re-emit components for a value change — the
  per-path waking exists for exactly this); structural changes (new/changed nodes) →
  `updateComponents` (adjacency-list updates, same surfaceId); a NEW task/context in the
  dialog → `createSurface` (when a fresh surface beats mutating the old one — the
  one-surface-per-record SPEC-R2 discipline informs this); a surface whose task is complete/
  superseded in the dialog → `deleteSurface` (the explicit removal, vs abandoning it).
- Where it lands (the intake decides, guided by the owners): the catalog SPEC §5.2-adjacent
  guidance + the DERIVED system prompt (the agent must be TAUGHT it — corpus + prompt
  re-validate per the ADR-0087 consequence pattern), and/or the `a2ui-compose` skill's
  mental-model section widened (it documents shapes today, not lifecycle timing;
  `deleteSurface` is absent from it entirely).
- A corpus exemplar of a multi-turn dialog exercising all four types validator-clean (the
  admission question rides the standing corpus-gap follow-up, recorded, not owed here).

**Lane 2 — the dialog demo:**
- A demo where a user dialog drives the full lifecycle VISIBLY: a turn creates a surface, a
  later turn updates its components, another updates only data (the surface visibly reacts
  without re-render), and a closing turn deletes it — each turn annotated with WHICH message
  type fired and why (the honest-labels site discipline).
- Vehicle (intake decides): extend `a2ui-live`/the artifact-feed dialog arc vs a dedicated
  lifecycle demo page; recorded-first with the live arm optional (the ADR-0073/recorded-
  default posture).
- The demo IS the integration proof (the docs-site cardinal rule) — real renderer, real
  envelopes, the wire visible (the feed page's disclosure precedent).

## Links
- `packages/agent-ui/a2ui/src/protocol.ts` + `renderer/dispatch.ts` — the four types' shipped
  mechanics · `src/live-agent/` (the system-prompt grammar + guidance the teaching extends) ·
  `.claude/docs/specs/specs/a2ui-catalog.spec.md` §5.2 (the guidance home precedent).
- `.claude/skills/a2ui-compose/SKILL.md` — documents the three kinds' shapes; deleteSurface +
  lifecycle timing absent (the skill gets serviced by Lane 1's outcome).
- `site/pages/a2ui-live.ts` (+ its ask-lifecycle tests) and `site/pages/a2a-artifact-feed.ts`
  — the dialog-shaped precedents Lane 2 builds on.
- The corpus-admission follow-up (recorded at the token-surfaces M2 wave) — the exemplar's
  admission rides it.

## Scope / Open
- **Open:** the guidance's exact home (SPEC §5.2 prose vs a dedicated lifecycle section vs
  the prompt grammar — one owner, cited by the others); whether `updateComponents` partial
  semantics (add vs update-in-place) need their own sub-rules taught; surface-count
  discipline in long dialogs (when to delete vs keep — a UX judgment the demo should model);
  whether the demo doubles as the a2ui-chat seed (TKT-0013 named a2ui-chat as a future
  surface — this demo may be its embryo; flag, don't couple).
- **Non-goal:** protocol changes (all four types are shipped mechanics); a chat framework.
- **Sequencing:** design intake first (`agent-ui-component-design` does NOT fit — this is a
  teaching+demo intake, not a component; route to a design seat with the a2ui SPEC/guidance
  owners as contract); no build from this ticket directly.

## Findings

**2026-07-11 — design intake complete, documents-only, no build.** Produced:
- `.claude/docs/adr/0126-a2ui-message-lifecycle-decision-layer.md` (proposed — the wave's ratifying ADR;
  indexed in `adr/README.md`; `adr_check.py` passes).
- `.claude/docs/spec/a2ui-message-lifecycle.spec.md` (SPEC-R1…R5, the decision-layer contract).
- `.claude/docs/lld/a2ui-message-lifecycle.lld.md` (exact insertion points, worked corpus exemplar, recorded-
  transcript script, test plan).
- `.claude/docs/decompositions/a2ui-message-lifecycle.decomp.json` (build slices; `coverage_check.py --strict`
  clean).
- `doc-reviewer` ran independently against the SPEC and LLD (fresh context each); findings applied in place —
  see the reviewer verdicts recorded in this session's handoff to the team lead.

Guidance home: a NEW dedicated SPEC, not §5.2 of the catalog SPEC or the runtime SPEC's lifecycle sections —
neither owns the producer-side "which envelope, when" axis (catalog SPEC owns component-TYPE choice; runtime
SPEC owns renderer-side mechanics). Demo vehicle: extend `a2ui-live`'s recorded transcript (already persistent-
host, already multi-surface, already per-turn-annotated) — no new page. Two genuine forks left for Kim in
ADR-0126: F2 (the exact GRAMMAR insertion mechanism + its permanent prompt-growth consequence) and F5 (the
delete-vs-keep UX heuristic the demo models). No code, no site pages, no skill edits were made — build is a
separate, later dispatch per the ticket's own sequencing note.
