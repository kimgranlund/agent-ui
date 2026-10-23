---
id: T-0413
title: "A new agent gets a Haiku-suggested name and tagline from the person's first Builder message"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
A freshly created agent stops being "New agent": on the person's first Builder interview message (for example "make a toothbrushing coach agent"), one quick Haiku call runs alongside the Builder turn and sets a short name and a one-line tagline, unless the person already edited either field. The Builder no longer needs to ask "Name the agent" as an open item.

## Intent
- Do: design and build the side call. It goes through the existing server-side agent route (the dev proxy `/__a2ui/agent` and the Worker; keys and providers never enter devtools or the page, ADR-0073), uses the Haiku model row from the model capability table, a tiny fixed prompt that returns JSON {name, tagline} (name 1 to 3 words, tagline one sentence, no em dashes), and a short timeout; on any failure the agent keeps its current values silently. Fire it only once per agent, on the first Builder message of an agent whose name and tagline are still the creation defaults ("New agent", "A freshly minted agent, ready to configure."), and never overwrite a field the person touched. Apply through the same store write the Builder's personaPatch uses, so undo and dirty state behave. Update the creation toast copy if it promises the Builder fills the name. Tests: unit tests for the trigger rule (fires once, skips edited fields, skips non-default agents), the response parser (malformed JSON, overlong name), and a keyless e2e-admin flow that answers the naming call from a fixture and asserts the Name and Tagline fields update.
- Non-goals: renaming existing agents; the Builder persona's own naming behaviour beyond dropping the open item if it is hard-coded; live spend in tests.
- Done when: the trigger and parser tests are red on main and pass after; the keyless flow passes; `npm run check`, the touched folders' tests and the a2ui agent tests exit 0; no key or provider import reaches devtools or the page bundle (existing trust-boundary gates green); a screenshot of the renamed agent after the flow is in the ticket folder.

## Context
Kim 2026-10-22: "we should do a quick Haiku run to generate a better name when new agents get created"; chosen: trigger on the first Builder message, set name and tagline. Screenshot before-toast.png shows the creation toast: 'Created "New agent" — describe what you want and the Builder will fill it in.' Builder files: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts, site/pages/agent-admin-app.ts, site/pages/agent-admin-presets.ts, site/lib/admin-live-runner.ts, packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts, packages/agent-ui/a2ui/tools/agent/worker/index.ts, packages/agent-ui/a2ui/src/agent/model-capabilities.ts. Trust boundary: root AGENTS.md and packages/agent-ui/a2ui/AGENTS.md (Boundaries).

## Acceptance criteria
- (red) The trigger rule (fires once, skips edited fields, skips a non-default agent), the reply parser (malformed JSON, overlong name, em dash) and the side call's request shape hold: `env -u NODE_OPTIONS npx vitest run --project site site/lib/agent-auto-name.test.ts` exits 0.
- A naming call labelled `?purpose=name` reaches the dev proxy's chat arm with the Haiku row: `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/live-agent/chat-route.test.ts` exits 0.
- The e2e-admin harness classifies the naming call and default-answers an unscripted one: `env -u NODE_OPTIONS node scripts/e2e-admin.mjs selftest` exits 0.
- The keyless Builder flows pass, the new builder-auto-name flow among them (Name field, Tagline field and roster label take the scripted suggestion): `env -u NODE_OPTIONS node scripts/e2e-admin.mjs --only 'builder-*'` exits 0.
- The touched folders' tests, the a2ui agent tests and the trust-boundary gates pass: `env -u NODE_OPTIONS npx vitest run site/lib/agent-auto-name.test.ts site/pages/agent-admin-app.test.ts site/pages/agent-admin-persona-file.test.ts packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent packages/agent-ui/devtools/src packages/agent-ui/app/src/layering.test.ts` exits 0.
- The standing gate passes: `env -u NODE_OPTIONS npm run check` exits 0.
- The screenshot of the renamed agent is in the ticket folder: `test -s .sdlc/tickets/0413-builder-auto-name/after-auto-name.png` exits 0.

## Constraints
No em dashes (including the toast copy, which currently has one). ADRs frozen. The prompt stack and grammar.md do not move. No live spend in tests.
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: 6762132bd16c
- Changed: A new agent's first Builder message fires one Haiku call (server route, 8 s timeout) that sets a short name and tagline unless edited; the creation toast drops its em dash
- Commits: none
- Check: 1 (red) trigger rule, reply parser and request shape, `env -u NODE_OPTIONS npx vitest run --project...: pass
- Check: 2 naming call `?purpose=name` reaches the dev proxy's chat arm with the Haiku row, `env -u NODE_OPT...: pass
- Check: 3 e2e-admin harness classifies the naming call and default-answers an unscripted one, `env -u NODE_...: pass
- Check: 4 keyless Builder flows with builder-auto-name, `env -u NODE_OPTIONS node scripts/e2e-admin.mjs --o...: pass
- Check: 5 touched folders, a2ui agent tests and trust-boundary gates, `env -u NODE_OPTIONS npx vitest run s...: pass
- Check: 6 standing gate, `env -u NODE_OPTIONS npm run check` exits 0: pass
- Check: 7 screenshot in the ticket folder, `test -s .sdlc/tickets/0413-builder-auto-name/after-auto-name.pn...: pass
