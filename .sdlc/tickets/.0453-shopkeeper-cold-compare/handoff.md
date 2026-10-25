---
id: T-0453
title: "The shopkeeper answers a cold compare ask with an OptionCompare"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-25
from: T-0445
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
verifier: L3
---

## Goal
A shopkeeper compare ask with no products on screen gets an OptionCompare of illustrative products, consistent with how the persona invents prices on browse turns, and the probe scenario reflects a realistic opening.

## Context
Round 13 cluster V in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445): 3 of 3 refuse for lack of prices (:122, :137, :151) while the same persona invents prices on every browse turn (:5, :123).

## Constraints
Model-read text follows the debate rule (Opus author, fable review).

## Done when
- A live check of `reach-shopkeeper-compare-haiku`, 3 samples, under $1, ships an OptionCompare.
- The shopkeeper smoke oracle (`shopkeeper.ts`) expects the ConfirmReceipt that T-0452 made the first-add surface, not ProductCard (folded in from notes).
- `npm run check` passes.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- The persona makes the catalog its own and names the cold compare: `grep -q "your two cheapest lamps" site/agent-content/personas/shopkeeper/agent.md`
- Generated registries and manifests are fresh: `node scripts/generate-agent-content.mjs --check`
- Seed digests re-pinned, registry and T-0452 cart tests green: `npx vitest run site/pages/agent-admin-seed-digests.test.ts site/agent-content/registry-freshness.test.ts site/pages/agent-admin-shopkeeper-cart.test.ts`
- The shopkeeper manifest seedDigest matches seedVersion 6 and the digest pin: `npx vitest run --project site site/lib/agent-manifest/agent-manifest.test.ts`
- The smoke oracle expects ConfirmReceipt on the add step, and the scenario tests pass: `npx vitest run --project scripts scripts/e2e-admin/probe/scenarios/`
- The live 3-sample check (already run, about $0.10 on Haiku; no paid rerun) passed 3 of 3: `python3 -c "import json,sys; sys.exit(any(json.load(open(f'.sdlc/runtime/tasks/0453-shopkeeper-cold-compare/runs/reach-shopkeeper-compare-haiku-{i}/report.json'))['verdict']!='pass' for i in (1,2,3)))"`
- `npm run check`

## Outcome

2026-10-25 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 71b85c74deac
- Changed: The shopkeeper answers a cold compare ask with an OptionCompare of illustrative products, and its smoke oracle expects ConfirmReceipt
- Commits: none
- Check: 1 The persona makes the catalog its own and names the cold compare: `grep -q "your two cheapest lam...: pass
- Check: 2 Generated registries and manifests are fresh: `node scripts/generate-agent-content.mjs --check`: pass
- Check: 3 Seed digests re-pinned, registry and T-0452 cart tests green: `npx vitest run site/pages/agent-ad...: pass
- Check: 4 The shopkeeper manifest seedDigest matches seedVersion 6 and the digest pin: `npx vitest run --pr...: pass
- Check: 5 The smoke oracle expects ConfirmReceipt on the add step, and the scenario tests pass: `npx vitest...: pass
- Check: 6 The live 3-sample check (already run, about $0.10 on Haiku; no paid rerun) passed 3 of 3: `python...: pass
- Check: 7 `npm run check`: pass
- Follow-up: decide: .agent-traces/2026-10-25.jsonl:2-3 decide: samples 2 and 3 sent the... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/scenarios/shopkeeper.ts:11 decide: the cold... -> notes.md
