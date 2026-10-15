---
id: T-0202
title: "Catalog architecture W0: multi-domain catalog ids, domain notFor edges, widened coverage law, alias table"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0201]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Wave W0 of `.claude/docs/spec/a2ui-catalog-architecture.spec.md` (T-0201), the plumbing every later wave needs. Kim ruled 2026-10-14: all recommended decisions accepted (D1 agentic layer inside `agent-ui`; D3 coverage law widened to "default catalog or a shipped domain fragment"; D4 per-domain moment checks; D5 ambiguous types as recommended; D6 one-wave alias table for old ids; D7 knowledge domain opens empty; D8 domains may add notFor edges to base entries) and D2 multi-domain ids `<base>--<d1>+<d2>`.

## Intent
- Do: exactly the W0 entry in the SPEC section 6 (read it first): the multi-domain id grammar and composition in the catalog records and registry; the preset declaration of a domain list; domain-scoped notFor edges onto base entries (reciprocity check skips them); the widened coverage law (catalog SPEC-N2 and its gate); the alias table for old derived ids and stored selections; semantic checks attach to the domain and self-gate. No type moves (that is W1 onward).
- Done when: W0's gates in the SPEC exit 0 (catalog records, registry, selection tests, agent manifests, prompt-equivalence baseline untouched or recaptured through its flow, `npm run check`, eval:catalog), and a chat:probe smoke per persona with a fragment passes (conductor runs live).

## Context
- Commit off origin/main, never push. Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- No em dashes.

## Outcome

2026-10-14 · lane: full L3 · verdict: closed by reason (merged (queue)) · verifier: none · base: none
- Changed: see commits
- Commits: none
