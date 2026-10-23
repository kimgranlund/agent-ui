---
id: T-0433
title: "Catalog page follow-ups: capability-registry picker, missing descriptor descriptions, 400px code panel, OptionDeck allowRandom knob"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The four defects the T-0432 audit found but left are fixed: (1) the capability registry page's catalog picker switches (site/lib or site/pages capability-registry.ts:86 listens for `change` where ui-select fires `select`); (2) every control descriptor has a one-line `description:` (about 30 lack one: Button, Text, Card, Select, Modal and others), so no catalog card falls back to selection intents for a control; (3) at 400px the component preview's code panel fits inside the card, no clipping; (4) OptionDeck's allowRandom knob reflects the sample's value.

## Context
From T-0432 (merged #2236, solo report and verifier notes). Kim 2026-10-23: do these, then deploy.

## Constraints
Descriptor `description:` lines are short, plain, no em dashes, in the style of the existing ones (for example option-deck.md:7); they sit outside the attributes fence, so props generation does not move; regenerate every file descriptors feed with its script, and if the prompt baseline or budget moves, follow skill a2ui-prompt-authoring's deliberate flow. Never hand-edit generated files.

## Done when
A browser test proves the capability-registry picker switches; a test asserts every descriptor has a non-empty description; a 400px screenshot shows the code panel inside the card; the allowRandom knob test passes; npm run check plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/capability-registry.browser.test.ts site/lib/component-preview-narrow.browser.test.ts` exits 0 in both engines: a real trigger and option click switches the capability registry table (PlayingCard appears for agent-ui--croupier and leaves for agent-ui); at a 400px viewport the code view of the OptionDeck, Button and ui-button previews lies inside the card with no sideways overflow; the A2UI OptionDeck allowRandom knob starts on with a Surprise me card and switching it off removes the card.
- `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/descriptor/descriptor-description.test.ts site/lib/a2ui-type-description.test.ts site/pages/capability-registry.test.ts site/lib/component-preview-catalog.test.ts packages/agent-ui/a2ui/tools/registry/generate.test.ts site/lib/sitemap.test.ts` exits 0: every components control descriptor has a non-empty one-line description, every descriptor-backed agent-ui type reads it, and the registry and sitemap projections are fresh.
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/a2ui-catalog.browser.test.ts site/lib/component-preview-code.browser.test.ts` exits 0.
- `npm run check` exits 0.
- Look evidence: the four PNGs under this ticket's `shots/` (OptionDeck and Button cards on the A2UI Catalog page at 400px, Chromium and WebKit) show the code panel inside the card.

## Outcome

2026-10-23 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 21d53c0ade1b
- Changed: Capability registry picker switches, every components descriptor has a description, the 400px code panel stacks, the OptionDeck allowRandom knob matches its sample
- Commits: none
- Check: 1 browser run (capability-registry.browser, component-preview-narrow.browser) green in both engines: pass
- Check: 2 descriptor/registry/sitemap vitest set: pass
- Check: 3 a2ui-catalog.browser + component-preview-code.browser: pass
- Check: 4 npm run check: pass
- Check: 5 four PNGs under shots/: pass
- Follow-up: note: site/lib/component-preview.ts builder Open: component mode... -> notes.md
- Follow-up: note: 17 app, code and router descriptors still lack description: out of... -> notes.md
