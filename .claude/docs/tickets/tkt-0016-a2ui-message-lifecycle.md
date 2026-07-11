---
doc-type: ticket
id: tkt-0016
status: done
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

**2026-07-11 — build complete.** ADR-0126 accepted (Kim); built to the LLD with one flagged deviation (below).
Files: `packages/agent-ui/a2ui/tools/agent/system-prompt.ts` (LLD-C1, GRAMMAR insertion) ·
`packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts` (LLD-C2, 4 new cases) ·
`.claude/skills/a2ui-compose/SKILL.md` (LLD-C3: mental model 3→4 kinds, front-matter description, Common-trap
entry, References row) · `packages/agent-ui/a2ui/src/examples/message-lifecycle.ts` (NEW, LLD-C4 corpus
exemplar seed) + `index.ts`/`examples.test.ts` wiring (5 new SPEC-R4 fixture tests) ·
`packages/agent-ui/a2ui/tools/agent/transcript.ts` (LLD-C5, turns 3-5) ·
`packages/agent-ui/a2ui/src/live-agent/round-trip.test.ts` (LLD-C6, 4 new cases) · `site/pages/a2ui-live.ts`
verified (LLD-C7) — no code change needed, confirmed both by reading `refreshJson`/`refreshHtml`/`addMessage`
and by the existing browser suite (34/34 green) exercising the real transcript end to end.

**Flagged deviation (needs a coordinated LLD repair — recorded here per the ticket's own "open item" precedent,
not silently fixed):** the LLD's literal worked JSONL for LLD-C4 (kpi-panel) and LLD-C5 (transcript turn 3)
both resend `id:"root"` via `updateComponents` to add a child. That is not legal: runtime SPEC-R3 AC2
(`renderer/tree.ts`'s `#rootDelivered` guard) treats ANY second delivery of `id:"root"` as an id-graph error
and drops it, unconditionally — no exception for a same-shape whole-record resend. Proven empirically by
running the LLD's exact kpi-panel JSONL through `validate-payload`: `IDGRAPH kpi-panel:root`. Root cause: the
new SPEC-R1 AC2/SPEC-R2 ("resend the parent's own record to add a child") did not anticipate the parent being
the surface's own root, where the ALREADY-SHIPPED, ALREADY-RATIFIED SPEC-R3 AC2 forbids any resend at all.
Fixed (both the corpus exemplar and the transcript) by inserting one stable level: `root` is delivered once and
never resent; the mutable container one level down (a plain non-root id — `grid` in the exemplar, `group` in
the transcript) is what actually gets its full record resent to add a child — the identical SPEC-R2
whole-record-upsert teaching, just never touching the one id the renderer refuses to re-deliver. For the
transcript specifically, this also meant retargeting the restructure/react/close arc onto `confirmation`
instead of `canvas` (canvas's root is the shared, out-of-scope `canvasButtonSeed`'s childless Button — it
cannot host a child without a root-type change either). Flagged to the team lead during build; team lead
approved the redesign and authorized a design-repair rider: ONE more GRAMMAR bullet teaching the trap directly
(added, see below), with the team lead folding the matching SPEC/LLD text repair into the same commit. A
"never resend `id:"root"`" caveat was also added to the `a2ui-compose` skill's whole-record-upsert trap entry,
since a human composer following SPEC-R2's naive advice would hit the identical bug.

**Exact doc corrections owed (for the team lead's repair commit, not made by this build seat):**
1. `a2ui-message-lifecycle.spec.md` SPEC-R1 rule 2 / SPEC-R2 — add an explicit carve-out: "if the container
   whose children must grow is the surface's own `root`, wrap it one level down instead of resending root —
   runtime SPEC-R3 AC2 forbids any second delivery of `id:"root"`, with no exception for a same-shape resend."
   SPEC-R2 AC2's "adding a child requires resending the parent's own record" needs this caveat too, since the
   parent named there could literally be root.
2. `a2ui-message-lifecycle.lld.md` LLD-C4 (§3, the kpi-panel worked JSONL) — replace the literal payload with
   the shipped, root-safe shape: `root` (Column, `children:["grid"]`, delivered once) wrapping `grid` (the
   Grid, the container actually resent to add `churn`). See `packages/agent-ui/a2ui/src/examples/message-lifecycle.ts`
   for the exact shipped shape.
3. `a2ui-message-lifecycle.lld.md` LLD-C5 (§3, transcript turns 3-5) — the worked script needs two corrections:
   (a) turn 3 must resend a non-root container (`group`), never `root` itself; (b) the restructure/react/close
   arc targets `confirmation`, not `canvas` (canvas's root — the shared `canvasButtonSeed`'s Button — has no
   children model and can't be wrapped without a root-type change, which the renderer also forbids). See
   `packages/agent-ui/a2ui/tools/agent/transcript.ts` for the exact shipped script + its inline deviation note.
4. `a2ui-message-lifecycle.lld.md` §3 LLD-C1 — the "Content to add" GRAMMAR block should gain the shipped 4th
   bullet (the root-immutability exception, verbatim in `system-prompt.ts`) so the LLD's own teaching-content
   spec matches what's now taught.

Gates (re-run after the root-immutability bullet addition): `npm run check` clean ·
`npx vitest run packages/agent-ui/a2ui` — `system-prompt-grammar.test.ts` 52/52 (the changeset adds 5 new
`it()` cases, a whole lifecycle-teaching describe block — the review corrected an earlier "56/56, +1" misreport
here, the honest-labels discipline),
full package suite green · site a2ui-live jsdom (`a2ui-live.ask-lifecycle.test.ts`) 7/7 · site a2ui-live browser
(`a2ui-live.browser.test.ts` + `a2ui-live-conversation.browser.test.ts`, Chromium+WebKit) 34/34 · full repo
`npm test` 5510/5513 (3 failures isolated to `site/lib/theme-provider-build-fixture.test.ts`, a token/theme
build-fixture drift caused by the concurrent color-picker/token build seat explicitly out of this ticket's
scope — confirmed via `git status` that no file I touched is anywhere near it). Prompt byte-growth (ADR-0126
F2, Kim's sign-off item, INCLUDING the root-immutability bullet the team lead authorized as a rider): the new
GRAMMAR bullets add exactly 1248 bytes / 1242 chars (~311 tokens at a 4-chars/token estimate) to EVERY mode's
composed prompt (default/specific/blue-sky, since the insertion lives in the mode-invariant `OUTPUT_RULES`
zone) — a permanent, standing per-call cost, as ADR-0126 named it. Full composed default-mode prompt is now
11115 bytes total. For the record (review LOW): ~311 tokens is ~1.5× the informal ~200-token
`PER_MODULE_TOKEN_BUDGET` reference the LLD §5 names — within intent (the LLD says this is NOT a mini-skill and
Kim signed off on permanent growth), but the overage is noted, not hidden.

Review (independent, 2026-07-11): **GO** — the root-immutability teaching verified precise against
`renderer/tree.ts:79-84`/`validate.ts:189`; the zone-guard tests anti-vacuous; the REV-repaired SPEC/LLD trace
byte-identical to the shipped shapes; transcript notes honest. Optional hardening noted, not blocking:
`round-trip.test.ts`'s turns-3-5 DOM test could assert confirmation's text PRESENT after turn 2 before
asserting absence after turn 5 (distinguishing "rendered then torn down" from "never rendered") — mitigated
today by the prefix-validation test + existing confirmation-render coverage.
