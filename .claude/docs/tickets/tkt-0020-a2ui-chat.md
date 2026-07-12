---
doc-type: ticket
id: tkt-0020
status: doing
date: 2026-07-11
owner:
kind: feature
size: big
---
# TKT-0020 — a2ui-chat: the conversational agent surface

## Summary
Kim's goal directive (2026-07-11): complete work on `a2ui-chat` — the surface TKT-0013 named as
the eventual consumer ("display in real time what the system is working on… chain of
thought/reasoning/action/tool-use… as it is occurring") and the TKT-0016 lifecycle demo was
flagged as the embryo of. Everything it composes has now shipped: `ui-status-stream` (the live
role=log region), the four-type message-lifecycle decision layer + its a2ui-live dialog arc,
`ui-command-modal`, the app-shell/master-detail/settings chrome, and the A2UI renderer with
per-path waking. `a2ui-chat` resolves to nothing in the repo today — genuinely greenfield.

## Acceptance
- A dialog-shaped chat surface where a user converses with an agent and the agent's work is
  visible AS IT OCCURS: reasoning/action/tool-use narration streams through the shipped
  `ui-status-stream`, and the agent's UI turns render through the REAL A2UI renderer using the
  full four-type lifecycle (create/updateComponents/updateDataModel/delete per the
  a2ui-message-lifecycle SPEC's decision rules — the surface IS the lifecycle teaching's
  integration proof at scale).
- Recorded-first with the live arm optional (the ADR-0073/recorded-default posture; a2ui-live's
  transcript machinery is the precedent — reuse, don't fork).
- The wire visible (the feed page's disclosure precedent); honest per-turn labels (ADR-0088).
- Placement decided at intake: a site page composing existing pieces vs a new package surface
  (the intake argues it; the site-page lane is the lighter default — PRD-D2 keeps app chrome
  catalog-invisible either way).
- The full house pipeline: design intake (SPEC/LLD/decomp, doc-reviewed, forks to Kim via a
  proposed ADR if genuine) → build → independent review → commit.

## Links
- `.claude/docs/tickets/tkt-0013-ui-status-stream.md` (names a2ui-chat as the future surface) ·
  `tkt-0016-a2ui-message-lifecycle.md` (the embryo demo; "flag, don't couple" — this ticket is
  the coupling point, deliberately).
- `.claude/docs/spec/a2ui-message-lifecycle.spec.md` — the decision rules the agent side obeys.
- `site/pages/a2ui-live.ts` + `packages/agent-ui/a2ui/tools/agent/transcript.ts` — the recorded
  dialog machinery to build on · `controls/status-stream/` · `src/live-agent/` (the live arm).

## Scope / Open
- Intake decides: page vs package; the chat log's anatomy (user turns, agent narration via
  status-stream, rendered A2UI surfaces inline per turn); how the recorded transcript scales to
  a longer arc; whether the live arm ships in v1 or stays recorded-only.
- **Non-goals:** a chat framework; protocol changes; new controls (compose the shipped fleet —
  a gap surfaces as its own component ticket, the ADR-0102 routing law).

## Findings

**2026-07-11 — design intake complete, documents-only, no build.** Produced:
- [`../spec/a2ui-chat.spec.md`](../spec/a2ui-chat.spec.md) (SPEC-R1…R8, SPEC-N1…N5).
- [`../lld/a2ui-chat.lld.md`](../lld/a2ui-chat.lld.md) (file map LLD-C1…C8, frozen `SurfaceRegistry`/routing/
  narration interfaces, the worked turn script against the shipped transcript, risks, build slices, test
  plan).
- [`../decompositions/a2ui-chat.decomp.json`](../decompositions/a2ui-chat.decomp.json) (`coverage_check.py
  --strict` clean: 19 nodes/13 actions/13 hosts/14 edges).
- **No proposed ADR.** Every design question resolved against the ticket's own explicit acceptance line, an
  already-ratified precedent, or a verified source-code constraint — none was an irreducible Kim-taste fork
  (LLD §9 argues this explicitly; the independent doc review scrutinized the argument and concurred, isolating
  the one genuine fork — `SurfaceRegistry` vs. generalizing the shipped `AskRegistry` — as legitimately
  reversible engineering judgment, not a taste call).

**Rulings, with rationale:**
- **Placement — a new site page, `site/pages/a2ui-chat.ts`, sibling to `a2ui-live.ts`, NOT an extension of it
  and NOT a new `@agent-ui/app` package surface.** `a2ui-live` stays the split chat+Canvas/JSON/HTML-tab wire-
  DEBUG harness (its own header names it that); `a2ui-chat` is a product-shaped single-log surface, a
  different reader's need. A reusable `@agent-ui/app` conversation-surface primitive is `agent-app-surfaces
  .prd.md` PRD-D1's own already-ratified future M2 item — out of this ticket's own non-goals ("no new
  controls"); flagged, not coupled to (the TKT-0016 "flag, don't couple" posture, reapplied toward the very
  ticket that coined it).
- **Anatomy — one scrolling chat log (not a2ui-live's two-pane split).** Per-turn bubbles: user prose, or an
  agent bubble carrying narration → note → (only on the surface's OWN creating turn) an inline mount. The
  hard question — how a surface persists visually across turns when `RendererHost.mount(rootEl)` attaches
  every surface as a sibling under ONE shared mount point (verified against `renderer/renderer.ts`) — resolves
  by generalizing the ALREADY-SHIPPED per-ask host lifecycle (`site/lib/ask-registry.ts`, ADR-0097 §2) from
  "asks only" to every surface: a new `SurfaceRegistry` (`site/lib/surface-registry.ts`), one host+mount per
  `surfaceId`, anchored at that surface's own creating bubble; later turns targeting a known `surfaceId` route
  to that SAME host, never a new one. `deleteSurface` disposes that one mount and annotates its bubble
  "closed" — visible history, never a silent disappearance.
- **Transcript — reuse the shipped `recordedTranscript` (`transcript.ts`) verbatim, no new arc authored.** Its
  existing 5-turn canvas/confirmation script already carries the full four-type lifecycle (TKT-0016/ADR-0126);
  the LLD's §4 maps every turn to its required bubble/mount/annotation behavior as the acceptance evidence.
- **Narration — turn-duration `ui-status-stream` entries, sourced only from verifiable facts**, never
  fabricated reasoning: the mechanical message-type category a turn's own lines carry (derived the same way
  `a2ui-live.ts`'s `summarize()` already inspects an envelope key), enriched with real `TurnTrace` fields
  (`exemplarIds`/`rounds`/`healed`/`model`) only when the live arm supplies one (ADR-0088's confabulation guard,
  applied to `ui-status-stream` content).
- **Live arm — ships in v1, reusing the existing dev-only overlay wiring verbatim** (the identical
  `import.meta.env.DEV`-guarded dynamic-import + switcher pattern `a2ui-live.ts` and `a2a-artifact-feed.ts`
  each already ship once). Not a fork: two sibling pages already prove this pattern at zero marginal
  architectural risk; deferring it here would be inconsistent with standing precedent, not a taste call.

**Doc review (independent, fresh context each, `scribe:doc-reviewer`):** SPEC — **GO-WITH-FIXES**, three
findings (two mis-citations: "ADR-0126" corrected to "TKT-0016" for the flag-don't-couple attribution;
`annotateAskFrozen()` re-attributed to `a2ui-live.ts` not `ask-registry.ts`; the §5 worked example's turn-3 row
completed to include its real second `updateDataModel` line) — all applied. LLD — **GO-WITH-FIXES**, six
findings, two MAJOR (both applied): §4's turn-3 row was missing the transcript's own trailing
`updateDataModel` line and its second narration category; §6 mis-cited `a2ui-live.ts`'s `runTurn` `finally`
block as already thrown-safe for `finalize()` — it is not (the real call sits inside `try`), corrected to
frame the narration `finalize()` placement as a deliberate improvement, not a copy. Four MINOR findings
applied where in-scope (LLD-C8's test-plan trace widened to include SPEC-R1; §5's `SurfaceEntry`/`AskEntry`
parity language corrected to name the retained `mount` field); two flagged as systemic, house-wide convention
items outside this doc's scope (the `proposed` status vocabulary and the lack of YAML frontmatter — both
match the immediate sibling `a2ui-message-lifecycle.spec.md`/`.lld.md` exactly, per this intake's own
instruction to match sibling house style — recorded here, not silently dropped, for a future corpus-convention
pass).

Build is a separate, later dispatch per this ticket's own sequencing; no code, no site pages, no `site/main.ts`
nav edit were made this wave.
