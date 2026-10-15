---
id: T-0172
title: "Correctness: Croupier IDGRAPH and no CardTable, thinking display summarized, BookingConfirmation options key, ui-rating size"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0159, T-0174]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The live agent and its widgets behave correctly in the cases Kim hit while testing. Kim 2026-10-14: correctness batch next.

## Intent
- Do:
  1. Croupier: a live trace (T-0151, `npm run traces -- --full`) showed turn 2 failing IDGRAPH (component "games" references undefined "table"), then a duplicate root; the turn that passed only updated greet-1 with Text and Row, so no CardTable ever rendered. Find why the producer emits a dangling child ref and a second root for this persona (prompt, persona fragment, self-correct loop, or validator message), fix the cause, and add a keyless regression (a2ui test kit scenario or e2e:admin fixture) that reproduces the bad payload and proves the fix path.
     New evidence from Kim's 2026-10-14 19:26-19:28 runs (`npm run traces -- --full 1..3`, prompt "Black jack"):
     - **Sonnet 5, round 1 (ok):** it renders the CardTable, but the bet controls are tripled (+10/+25/+50/+100 chips, a number field, and a separate Slider "Bet amount"). The slider reads 160 while the bet is 50, so the controls are not bound to one path; check this against T-0171's bindProp fix. The empty dealer and player zones are tall during the bet phase.
     - **Sonnet 5, the turn after Deal (halt):** round 1 hit PARSE: the model hand-writes JSON lines escaped inside the `render_surface` tool's `jsonl` string and unbalances a brace (column 779). Round 2 hit IDGRAPH: it resent `root` to the existing surface `table-1`. Round 3 hit PARSE again. Root cause to fix: the tool takes an escaped JSONL string. Make `render_surface` accept structured messages (an array of A2UI message objects validated by the tool's input schema), keeping the string form only if a back-compat path needs it. For the update turn, the retry feedback or the producer contract must say how to update an existing surface (no second root; updateComponents and updateDataModel only), or treat a resent root with the same id as a replace. Pick one, and state the rule in the a2ui producer reference doc.
     - **Haiku 5.5 (outcome "ok"):** it wrote the A2UI JSON lines as plain prose text instead of calling the tool, so the chat shows raw JSON. It also composed a generic Card + Slider instead of CardTable. The prose route must detect A2UI messages in text: either route them as a surface, or retry with feedback. Never show them as prose and record "ok".
     - Thinking shows `1 deltas 0 chars` on every round (item 2).
     - **Concierge, Sonnet 5, about 19:33, the turn after "hello":**
       - **Round 1:** the model sent a correct new `ask-1` surface: a Reserve a table card with restaurant radios, date, time, party size and a Review button. In the same payload it re-sent `root` on the existing `greet-1` (a Column whose text was "Starting a new request below.").
       - **Rejection:** IDGRAPH rejected the whole payload.
       - **Round 2 "passed":** it only updated `greet-1` with Text and Row. The user got "Starting a new request below." and nothing below it, and the activity shows a warning but no error.
       - **Root-cause question:** the A2UI v1.0 spec for `updateComponents` decides it. If components upsert by id, re-sending `root` is legal and our IDGRAPH duplicate-root check is too strict; then fix the validator so a resent same-id root replaces it. If the spec forbids it, the retry feedback must name the exact fix ("drop the root line for greet-1, keep ask-1 unchanged").
       - **Retry loss:** in either case, a self-correct round must not silently drop surfaces the failed round created. Compare the surface ids before and after; if the rewrite loses one, retry again or halt with a clear error. A "passed" turn that lost the user's requested surface is a failure.
       - **Form choice:** the round-1 form used a Calendar for a single date and a Slider for party size. Concierge has BookingForm (date fields are `ui-text-field type=date`, T-0135). Check why the producer hand-built the form (skill teaching after T-0159, or selection guidance) and steer table bookings to BookingForm or a date TextField.
     - Write a keyless regression for each failure mode (replay the trace payloads through the validator and the self-correct path).
  2. Thinking: `anthropic.ts` `buildRequestBody` asks for adaptive thinking but never sets `display`; for the models that need it add `display: 'summarized'` so the chat's "Reasoned" disclosure shows content. Unit test on the request body.
  3. BookingConfirmation prints the raw room value ('twin'): add the optional row-level `options` key in `personas/concierge/catalog.json` so rows print the label (Kim's conductor approved it, no prompt recapture), plus a factory test.
  4. `ui-rating` `[size]` has no effect once `--md-sys-icon-box` is defined (stars about 8px at root): fix in rating.css so size steps the star box per the icon vs glyph ruling (icon 2n inside a control or tier region); browser test both engines, view the rating demo.
- Done when: `npm run check` exit 0; touched a2ui, live-agent, persona catalog, rating tests exit 0 (browser ones in both engines); the Croupier regression red before the fix and green after; `npm run e2e:admin` exit 0; agent manifests refreshed if a fragment digest changed.

## Context
- Source: `.sdlc/notes.md` lines on IDGRAPH, thinking display, BookingConfirmation, ui-rating. Starts after T-0159 (same prompt and manifest files). Commit off origin/main, never push. Keys and `produce()` never enter devtools (ADR-0073). Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- Prompt-equivalence baseline changes only via the `a2ui-prompt-authoring` flow. No em dashes.

## Closed

2026-10-14: merged as PR #1984
