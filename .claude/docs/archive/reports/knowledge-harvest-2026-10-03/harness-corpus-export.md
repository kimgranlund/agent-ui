# Harness and corpus knowledge export (2026-10-03)

Date 2026-10-03 · branch `docs/a2ui-skill-refresh` · precedent `.claude/docs/reports/knowledge-harvest-2026-08-17/llm-pack-export.md`.

Scope: (1) the product-side chat harness (live agent loop, sessions, transport seam, meta-line, devtools capture and replay); (2) the corpus and judge harness (record schema, admission, verdicts, rubrics, corpus-genui, coverage gaps).

Method: scratchpad findings first (claim-audit, decisions, code-history, issues-prs), then ADRs/specs/LLDs, then current code. Every [verified] line was re-read in code on 2026-10-03 and revised after an independent check. Pack status (NEW / UPDATE-stale / ALREADY) comes from reading the SKILL.md heads and the references named below plus a term grep across `a2ui-chat-agent-facts`, `a2ui-training-facts` and `chat-harness-*-facts` at `/Users/kimba/Projects/nonoun/plugins` (last refreshed 2026-08-23). A term with zero grep hits is marked NEW; a pack reference not read in full is flagged "head-read only". Evidence cites symbols, not line numbers, except where a pack quote itself carries a line.

Confidence tags: [verified] re-read in code today · [inferred] derived from code plus ADR, not executed · [incident] drawn from a filed issue or ADR postmortem. [split] marks a straddler whose product half is exported.

Overlap rule: each lesson lives in one file. Overlaps with `a2ui-protocol-jsonl-export.md` are one-line cross-refs (section 7); lessons that repeat or update the 2026-08-17 harvest say so.

Counts: 20 lessons. By pack: chat-agent 9, training 8, chat-harness-logging 1, chat-harness-runtime-resilience 1, chat-harness-routing 1. By status: NEW 12, UPDATE-stale 6, ALREADY 2 (L13 is partial, counted NEW).

## 0. Contradictions with the packs (read first)

C1. Max-turns cap does not exist. Pack `a2ui-chat-agent-facts/references/turn-session-and-input-intent.md:39`: "A demo-level max-turns cap guards runaway (SPEC-R8)." ADR-0072 clause 5 (cross-turn cap plus named session state machine) was never built; ruled DROP 2026-08-30 (amendment proposed, GH #1713); the ops revalidation queue carries the falsified verdict. Only per-generation caps exist (`maxRounds`). Lesson L1.

C2. The producer toolkit is a package subpath export, node-first, not a Node-scoped tools module. Pack `a2ui-chat-agent-facts/references/sources.md:12` calls `tools/agent/` "the Node-scoped live-agent harness" and `references/agent-transport-seam.md:60-63` has a section titled "Node-scoped, no package export (SPEC-N1)" claiming the package surface stays `.`/`./examples`/`./corpus`. Current home: `packages/agent-ui/a2ui/src/agent/*`, exported as `./agent`, `./agent/meta-line`, `./agent/genui-line`, `./agent/agent-transport`. `sources.md:88` and the click-routing reference already note the relocation; other references still cite old paths. Lesson L2.

C3. Hard-coded module count. Pack `conversational-reasoning-and-click-routing-gap.md:97-99`: "SIX modules" of mini-skills. Current: 20 prompt files under `src/agent/prompts/mini-skills/`. Lesson L3.

C4. Dropped `ask` is now a whole-turn degrade. 08-17 export lesson 17 and the chat pack treat a dropped ask as "the arm is dropped, note stands". Current: the ask's surface payload is suppressed with it (GH #1064, #1142). Lesson L4.

C5. Corpus rubric straddle. Payload rubric is v1.3 while `a2ui-corpus.md` stays v1.2 and its D1 is the MIN over payload P1-P9 (versions re-read 2026-10-03). Whether verdicts stamped corpus 1.2 mix pre- and post-1.3 payload semantics is an open question [inferred]. `judge-and-verdict-adapter.md` says `rubricVersion` equals the rubric marker; it does not say a child rubric bump can leave the parent's number unchanged. Lesson L20.

## 1. Pack: a2ui-chat-agent-facts

L1. UPDATE-stale (C1). Claim: an A2UI chat product has no cross-turn turn cap; the only runaway guards are the per-generation `maxRounds` loop and the page owning the session. A cross-turn cap was specified, never built, then dropped. Evidence: ADR-0072 amendment 2026-08-30 (GH #1713); `ProduceOptions.maxRounds` and `ProduceHalt` in `produce.ts`. 2026-08-30 [verified]. Target: `references/turn-session-and-input-intent.md` §3. Stale quote: "A demo-level max-turns cap guards runaway (SPEC-R8)."

L2. UPDATE-stale (C2). Claim: the producer toolkit ships as a package subpath export (`./agent`), NOT from the root barrel, and it is node-first: `system-prompt.ts` and `mini-skills.ts` `readFileSync` their prompt files at module load. The transport seam types and the session reducer are platform-neutral, and the key-holding dev proxy plus provider registry stay site-internal. Evidence: the header of `a2ui/src/agent/index.ts` (ADR-0137 cl.1 and cl.4); `a2ui/package.json` exports. 2026-08 [verified]. Target: `references/sources.md` (the "Node-scoped live-agent harness" line), `references/agent-transport-seam.md` (the "Node-scoped, no package export (SPEC-N1)" section), and the old-path cites in four references.

L3. UPDATE-stale (C3). Claim: a prompt-module shelf selected per turn by retrieval (TF-IDF, capped at 3, degrading to empty) must not have its module count hard-coded in docs; pin the count in a test, not in prose. Evidence: 20 files under `src/agent/prompts/mini-skills/`; the registry's gate test lists the module file. 2026-10-03 [verified]. Target: `references/conversational-reasoning-and-click-routing-gap.md` §4, stale quote "SIX MiniSkill modules".

L4. UPDATE-stale (C4; UPDATE-of 08-17 #17, merges the protocol export's old ask lesson). Claim: ask integrity is a silent degrade, never a retry, and the degrade is WHOLE: an ask with no matching payload or colliding with a session-known surface is dropped, and every message naming its surface is suppressed so the turn reads as a prose-only ask; messages for other surfaces ship untouched; a net-no-op surface drags its ask down with it. Reason: shipping the payload of a dropped ask repaints the answered card in place. Evidence: the ask-integrity block of `produce()` (`askIntegrityHolds`, the whole-degrade suppression filter; GH #1064, #1142). 2026-09 [verified]. Target: `references/conversational-reasoning-and-click-routing-gap.md` ask section.

L5. NEW. Claim: the self-correct loop has two correction rounds beyond the root-missing one (ADR-0187), both through the atFinalize seam and both degrade-never-halt. NET_NOOP: a turn whose createSurface is cancelled by a deleteSurface dodge is corrected once, then the dodge is stripped and the turn degrades to prose (tally NET_NOOP_STRIPPED). FLOW_END_MISSING: fires only when the turn is closing-shaped (a note with no ask, no plan, no genui line, zero A2UI lines, no `flowEnd`) AND the user's own message is an explicit close (`isExplicitClose`); one round only if a round remains, else the turn ships unchanged with a FLOW_END_UNCORRECTED tally. These codes, with FEED_SCOPE, GENUI_ENVELOPE, GENUI_SIZE and GENUI_MULTIPLICITY, are produce-layer-only and never join the protocol ErrorCode union. A matcher miss degrades to no round, never to a wrong rewrite. Evidence: `NET_NOOP_HINT`, `FLOW_END_HINT` and the closing-shape branch in `produce.ts`. 2026-08 [verified]. Target: `references/produce-loop.md` (head-read only; term absent from pack).

L7. NEW (narrowed; validate-then-stream itself is 08-17 #1, ALREADY-in-08-17). Claim: a genui structural failure on the shipping round is dropped from the wire, not corrected; at most one genui line ships per turn, extras are dropped and counted (`multiplicity`), never fed back. Evidence: genui handling in `produce.ts`. 2026-07 [verified]. Target: `references/produce-loop.md`.

L8. UPDATE-stale (UPDATE-of 08-17 #13; merges the protocol export's meta-line lesson). Claim: the meta-line carries model-authored arms (note, ask, plan, personaPatch, flowEnd, team, target) plus runtime-only trace and progress. Each arm validates as a WHOLE and drops only itself when malformed (a half-parsed roster or patch is the shape a host must never see); `target` with an empty surfaceId drops entirely; a note-only turn counts as success; `readMetaLine` rejects any line carrying `version`. Evidence: `meta-line.ts` header and arm validators; ADR-0088, 0178, 0198, 0204, 0206. 2026-09 [verified]. Target: `conversational-reasoning-and-click-routing-gap.md`; stale quote: "envelope is `{ note?, ask?, trace? }` (`meta-line.ts:62-68`)" (the pack carries a dated note; fold the arms into the body).

L11. NEW [split]. Claim: the typed-value rule lives in the grammar prompt, not in code: for one typed value the model is told to use a typed Field+TextField (number, currency, date, time), a Calendar for a date or range, or a Slider for a bounded numeric, with a label naming the value. Evidence: `src/agent/prompts/grammar.md` (the typed-value sentence). 2026-09 [verified]. Target: `references/conversational-reasoning-and-click-routing-gap.md`.

L13. NEW (partial; clause 4 is ALREADY in the pack). Claim: ADR-0072 clauses 1-4 hold (browser holds the session; proxy stateless; client-held reducer; action framing via `frameClientMessage`); the session reducer is the only cross-turn state. Evidence: ADR-0072 revalidation; `session.ts`. 2026-08-30 [verified]. Target: `references/turn-session-and-input-intent.md` (add the confirmed-by-revalidation line).

## 2. Pack: a2ui-training-facts

L15. ALREADY (line refresh only). Claim: the eval facet fails closed (`E_LEAK` machinery exists, the contamination mechanism is unbuilt), so the leak gate is vacuously satisfied today and only fires if a caller seeds the store with an eval record directly. The pack already says this ("the leak gate is vacuously satisfied today", `exemplar-eval-split-and-no-leak.md:26`). Refresh the cites it carries (`admit.ts:250-251`, note `:246-248`): the eval-facet fail-closed branch is now near `admit.ts:111-113` and `checkLeakGate` near `:254-262`; cite by symbol. 2026-10-03 [verified]. Target: `references/exemplar-eval-split-and-no-leak.md`.

L17. NEW. Claim: the unjudged-run guard: with no `--verdicts`, the stage-10 judge seam must not silently admit into a judged-era corpus; an unjudged run cannot re-admit a dispositioned (archived) candidate; the importer fails closed and reports `unjudgedCandidates`. Evidence: `packages/agent-ui/a2ui/tools/corpus/import-seeds.ts` (the unjudged guard and archive check); fixture `SHARD_LOADED_VERDICTS` in `import-seeds.test.ts`. 2026-08 [verified]. Target: `references/judge-and-verdict-adapter.md` (GH #1346 ALREADY present; the `unjudgedCandidates` report field and the archive-blocks-re-admit rule are NEW).

L18. NEW. Claim: dropping a seed is a first-class admission outcome via the drop path (ADR-0165), not a delete: the verdict archive records the disposition so a rerun cannot resurrect it. Evidence: drop handling in `tools/corpus/import-seeds.ts` and its test. 2026-08-18 [verified via scratchpad]. Target: `references/judge-and-verdict-adapter.md`.

L19. NEW. Claim: a verdicts file stamps `rubricVersion` equal to the rubric's `version:` marker; any rubric text change that moves an anchor must bump the number and re-judge, because older verdicts then describe a different test. Evidence: ADR-0068; the payload v1.3 change (P2/P5 anchors). 2026-09 [verified]. Target: `references/judge-and-verdict-adapter.md` (the equality is ALREADY; the bump-on-anchor-move consequence is NEW).

L20. UPDATE-stale (C5). Claim: a parent rubric whose dimension folds a child rubric (corpus D1 = MIN over payload P1-P9) must bump when the child's anchors move, even if its own dimension list is unchanged; today corpus is 1.2 while payload is 1.3 [verified: `a2ui-payload.md` frontmatter 1.3, `a2ui-corpus.md` frontmatter 1.2]. Open question, not a ruling: whether corpus-1.2 verdicts mix pre- and post-1.3 semantics [inferred]. Target: `references/judge-and-verdict-adapter.md`. 2026-10-03.

L21. NEW. Claim: the judged pack-idiom eval is a separate harness from the exemplar shard: `corpus-genui` B3, rubric `genui-pack-idiom.md` v1.0, verdicts file type `GenuiVerdictsFile`, five-leg `eval:genui-corpus`; the pass criterion is `floorMet`: every (prompt, pack) cell (12 = 4 prompts x 3 packs) has at least 2 of at most 3 records at `qualityScore >= 4`. A generation miss (`E_NO_GENUI`) counts against the cell, because the v0.1 "every judged record >= 4" reading was blind to misses and got harder as `--runs` grew. Separately, `E_CELL_OVERFLOW` is NOT a miss: it is a report-leg rejection when a cell holds more than 3 records (a prior run was never cleared), refusing to compute a floor over inflated cells. Evidence: `floorMet` and its comment in `corpus-genui/index-shape.ts`; `runReportLeg` in `tools/corpus-genui/legs/report.ts`; `promptSetVersion` 2 pinned in `corpus-genui-data.test.ts`. 2026-08-24 [verified]. Target: new reference `genui-pack-eval.md` (all terms absent from pack).

L24. NEW [inferred]. Claim: single-surface, valid-only exemplars teach single-surface turns only; a retrieval-augmented producer shown only those has nothing to imitate for correction or surface lifecycle, so a trainer should assume gaps (no broken-then-repaired pairs, no multi-turn or multi-surface records, `deleteSurface` rare) until a corpus profile shows otherwise. Evidence: profile of `corpus/exemplar/v1_0/agent-ui.jsonl` on 2026-10-03: 74 records, `deleteSurface` in 1 record [verified]; the generalization is [inferred]. Target: `references/retrieval-and-repair-loop.md` (head-read only; no gap list present).

L25. ALREADY. Claim: canonical hash plus MinHash dedup; closed form-only healer; single `admit()` write path; `--replace` and `rescore` flows. Evidence: ADR-0061/0064, `admit.ts`. Pack `canonicalization-and-dedup.md`, `admission-gate-and-healing.md` (term-level check only; not re-verified claim-by-claim). 2026-08-19.

## 3. Pack: chat-harness-logging-facts

L26. NEW. Claim: capture a turn once, replay it deterministically. One recorder wraps any transport and is the single producer of an NDJSON event timeline; every event round-trips through plain `JSON.parse` structurally equal and replay order is a sequence number, never wall-clock. The replay transport implements the unchanged transport seam with zero I/O, zero timers and zero randomness (lines yield on the microtask queue only), so it is a CI backbone and swapping replay for a live transport is a one-construction-site edit. The capture file is a versioned, parse-checked artifact with a typed parse error. Evidence: `recordTurn` and `DevtoolsEvent` in `devtools/src/timeline/events.ts`; `devtools/src/transports/replay.ts` header; capture format in `devtools/src/capture/format.ts`. 2026-09 [verified]. Target: `references/live-turn-acceptance-and-replay-ci.md` (devtools mentioned; recorder absent).

## 5. Pack: chat-harness-runtime-resilience-facts

L30. NEW [inferred]. Claim: persist through one storage seam that sits at the bottom of the dependency graph so every layer can reach it, and keep shared state under one signal-backed owner with explicit injection; a headless resource/mutation layer with opt-in gateway and stream subpaths keeps transport out of the core. Evidence: the repo's package layering and ADR set (not code-traced). 2026-09 [inferred]. Target: resilience pack state-seeding reference.

## 6. Pack: chat-harness-routing-facts

L31. NEW [split, inferred]. Claim: the A2A layer is pinned at spec v0.3.0 with wire types and validation as a zero-dependency package; the transport shelf includes an A2A-peer backend behind the same seam. Evidence: `packages/agent-ui/a2a`; `devtools/src/transports/a2a-peer.ts`. 2026-09 [verified for the shelf, inferred for the pin]. Target: routing pack seam reference.

## 7. Cross-refs (lesson owned by the sibling export)

- Stamping the catalog id on the producer side (was L6): `a2ui-protocol-jsonl-export.md` lesson 13.
- Enum membership and `rejectFunctionCall` (was L16 and contradiction C6): protocol export lessons 9 and 10. The catalog pack already marks its enum-not-enforced bullet FALSIFIED by ADR-0098; only the line refresh in lesson 9 remains.
- Validate-then-stream and peel-before-validate (08-17 #1, #14): protocol export lesson 14.

## 8. Exclusions (agent-ui development process or not portable, OUT by litmus)

- Skill-doc drift rows from the claim audit, rubric-reviewer routing gaps, canonical-source lists, uncited-ADR rows: repo skill maintenance. The renamed agent and skill names (a2ui-builder and similar) are fixed locally in the packs, not exported.
- Worktree, scratch-clone, reap and dispatch laws; browser test shard rules; gate carve-outs; the eval-catalog gate script.
- Catalog row additions: belong to `a2ui-catalog-facts`.
- Renderer-only items (`revealOrder`, `mutate` helper): renderer, not chat or training harness.
- Vocabulary-drift rows and the agent-model glossary; the time-bound coverage-gap issue list (only the generalized L24 survives); the devtools dependency-graph and layering item.
- Cut after the independent check: provider-key /status detail, superseded-surface lane (agent-admin UI), healer-adjacent inferred items, and the wrong "enum not enforced" contradiction.

## 9. Unverified or head-read-only

- Full contents of `produce-loop.md` (30KB) and the logging/resilience references were not read end to end; L5 and L26 NEW calls rest on term-absence greps.
- L13, L30, L31 [verified] covers existence of the artifacts, not every clause; L30 and L31 are tagged [inferred].

Tally: 20 lessons · NEW 12 (5, 7, 11, 13, 17, 18, 19, 21, 24, 26, 30, 31) · UPDATE-stale 6 (1, 2, 3, 4, 8, 20) · ALREADY 2 (15, 25).
