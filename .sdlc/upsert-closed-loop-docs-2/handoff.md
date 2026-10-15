---
id: T-0243
title: "Upsert docs, specs, skills and the closed-loop testing spec for T-0208 to T-0242"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0208, T-0239, T-0241]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
After T-0208, T-0239 and T-0241 merge, every record they and the work since T-0237 (#1999) touched reads true: docs, specs, skills, and above all the closed-loop testing spec. Docs and skills only; no code.

## Sweep (verify each against main; repair or add, one home per fact, cross-link the rest; cite ticket ids)
1. Closed-loop testing SPEC `.claude/docs/spec/agent-closed-loop.spec.md`, the primary target. Bring its requirements and acceptance summary up to date with:
   - the generated composite moment checks (T-0208), hidden-state checks (T-0230) and the text-shape leak repair (T-0229) as named check families;
   - the round lifecycle: scenarios (`scripts/e2e-admin/probe/scenarios/`), the capped runner, prices from the claude-api skill, the round home `.sdlc/evals/rounds/<date>-<slug>/` with README, round.json, ledger.jsonl and traces/ (T-0241), the index `.sdlc/evals/README.md`, and phase 2 (report, one ticket per root cause, replays, re-pin on fix);
   - Kim's ruling that every round keeps all traces, payloads and ledgers;
   - observability: the trace `routing` block and `scripts/agent-traces-to-fog.py` feeding context-fog-of-war (T-0239), and the round 2 atlas as the first example;
   - reconcile CL-R7 AC1 and the section 4 Acceptance summary (the T-0237 verifier note: the cap shipped in part with T-0225);
   - the model notes section (section 5) with round 2 plus the T-0208 probe result (Lexicographer and Admiral repaired into BoardGrid and GameHud; Concierge still prose-only).
2. Catalog architecture SPEC (CA-R9 and anything T-0208 or T-0238 made stale): composite-moments.ts as the generator, exemplar retrieval filtered by selected domains (T-0238), domain exemplars pending (T-0240).
3. Agent content SPEC section 8 and the agent-model reference: hidden state under `/secret`, the index-only gap (T-0231) with the routing block that now shows it.
4. Skills: a2ui-prompt-authoring (exemplar routing, composite checks over prose), a2ui-payload-authoring (`/secret`), a2ui-corpus-curation if T-0240's blockers belong there (persona composites cannot enter the agent-ui shard; BoardGrid needs a review verdict), seat-map (merge-queue traps, stray `__screenshots__`, rebases between lanes that touch the same check lists).
5. `scripts/e2e-admin/README.md` and CLAUDE.md Commands: one coherent Live rounds section, with no duplicate lines between the two.
6. Note T-0242 (topics layout) as planned in `.sdlc/AGENTS.md` and wherever ticket paths are documented; do not move anything.

## Done when
- doc_lint plus `npm run check` exit 0; the sitemap carve-out runs if an ADR title, L1 descriptor or changelog is touched.
- `git grep` finds no stale path to `.sdlc/croupier-closed-loop/runs`, `.sdlc/live-round-2/runs` or `live-probe.md` in live docs.
- No em dashes added; ADRs untouched.

## Conductor additions (2026-10-15)
- Also land `.sdlc/evals/context-fog-of-war-claude-parity.md` (the report for the context-fog-of-war author) and list it in `.sdlc/evals/README.md` if the index has a non-round section; do not reword it beyond fixing stale paths.
- Also land the new ticket folder `.sdlc/drill-400px-overflow-flake/` (T-0244) as is.
- T-0239 and T-0241 merged (#2004, #2003, #2005): cite `scripts/agent-traces-to-fog.py`, the `routing` trace block and `.sdlc/evals/rounds/<date>-<slug>/` as the round home.
