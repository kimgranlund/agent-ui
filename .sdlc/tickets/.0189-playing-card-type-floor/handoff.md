---
id: T-0189
title: "playing-card corner index: a type floor or a ruled pictorial exemption"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Decide the playing card corner index under the 9px type floor (ADR-0245 M5): a floor on the index or a ruled pictorial exemption, so `demo/playing-card-demo#type-floor` leaves the render allowlist or cites the ruling.

## Intent
- Do: Pick one with Kim; implement it; update or delete the allowlist line.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/playing-card-demo` green in both engines; screenshot viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: ecad202386a5
- Changed: Corner index ruled card art, exempt from the type floor (#2126)
- Commits: 1bba3e3 T-0189: playing-card corner index is a ruled pictorial exemption (#2126)
- Check: 1 Allowlist reason states Kim's ruling and passes the owner-format check: pass
- Check: 2 Nothing else changed: pass
- Check: 3 `npm run check` exit 0: pass
- Check: 4 site/pages/dogfood-render.browser.test.ts exit 0 (render lint green in both engines): pass
- Follow-up: note: .sdlc/notes/notes.md does not record the playing-card ruling the... -> notes.md
