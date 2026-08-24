---
doc-type: research
id: req-a2ui-patterns
status: approved
owner: Kim
date: 2026-08-17
---

# req-a2ui-patterns — Refined A2UI patterns (Lane 2)

Status: research requirements draft · 2026-08-17 · Lane 2 of the exploration campaign
(`2026-08-17-exploration-campaign-plan.md`). PRD-shaped; mints issues on Kim's approval.

## Goal

Refine three interaction patterns into grammar-level law + playbook material so produced agents
emit them by default: (1) **card anatomy** (header/content/footer role discipline),
(2) **backable multi-step** (BACK before commit on ONE surface, local state until the final
confirm), (3) **conversation bookending** (a greet card opening the session, the ratified
courtesy-close concluding it). Every pattern must COMPOSE with the shipped grammar laws —
ask archetypes, the completion protocol (flowEnd + confirm-before-conclude + courtesy close,
ADR-0198/#1101), the receipt clause, and the surface-reuse mandate (#1164/grammar.md
"A continuing flow REUSES its surface") — never contradict them.

## Findings digest (lane schema: pattern · source · wireShape · grammarClauseDraft · conflictsWithExistingLaw)

| # | Pattern | Source (dated) | Wire shape (sketch §) | Conflicts |
|---|---------|----------------|------------------------|-----------|
| F1 | Card = container + three optional slots; footer is THE action area, header the identity cue, body the content — "all slots optional", composable not mandatory | Fluent 2 card usage (fluent2.microsoft.design, current); Nathan Curtis, "Cards and Composability in Design Systems" (EightShapes/Medium); LogRocket card-UI tutorial 2024 | §R1 | none — catalog already ships Card/CardHeader/CardContent/CardFooter; corpus (`generative-form.ts`) and playbooks (`agent-admin-libraries.ts` hotel pack) already use Content/Footer split |
| F2 | Guided-conversation wizards: one question per step, validate only the visible step, preserve answers across BACK ("going back can unmount step-local state — a common pitfall"), full validation only at final submit; draft vs submitted are distinct states | Reform "Multi-Step Form State Persistence" (2025); AppMaster save-and-resume wizard (2025); OpenAI Apps SDK community thread on mixed UI+chat multi-step forms (2025) | §R2 | ONE, real (review-caught): grammar.md's answered-ask law collides with mid-flow scene transitions — see R2's conflicts statement (law amendment required) |
| F3 | Hybrid chat+UI: high-risk/conclusive operations ride deterministic buttons and explicit confirm steps, not free prose | aiuxdesign.guide conversational-UI patterns (2026); onething.design best practices | §R2 step-5 | none — restates the shipped confirm-before-conclude law |
| F4 | Opening message: short intro + a few clickable quick-start options beats a generic greeting; context-tailored; guide without overwhelming | getstream.io "Chat UX Best Practices" (2025); Jotform chatbot best practices + welcome-message gallery (2025/26); FlowHunt welcome-message survey | §R3 | ONE tension, resolved: grammar's ask discipline says an ask needs a question. The greet card is NOT an ask — it is an ordinary surface whose Buttons carry `action.context` naming a starter intent; no `ask-<n>` id, no commit-button law. Clause must say so explicitly or producers will mint it as ask-1 and burn the counter |
| F5 | Closing: courtesy close = recap + user's act + confirmation + appreciation + offer; already RATIFIED in this repo (Kim's live UX ruling, #1101 Findings 2026-08-17; ADR-0198 flowEnd on ALL terminal paths incl. escalation/abandon) | GH #1101 arc (primary, in-repo); ADR-0198 + amendment branch `1101-completion-amendment` | §R4 | none — the conclude half of bookending is shipped law; this lane only adds the OPTIONAL conclude-card variant, which must not violate "the closing turn emits NO A2UI" without an explicit carve-out (see R4 fork) |
| F6 | Surface-reuse + retire-stale-affordances: at most ONE surface invites action; superseded surfaces drop buttons/live badges same turn | GH #1164 (closed; grammar.md lines "A continuing flow REUSES its surface…") | §R2 | none — R2 is the positive worked example of this law |

## Requirements

### R1 — Card-anatomy clause (grammar + playbook)

Canonical roles, derived from F1 and the fleet's own Card family:

- **CardHeader**: identity only — title Text (+ optional Badge for one standout fact). Never
  interactive controls.
- **CardContent**: the substance — form fields, lists, receipt rows. A Card with only a
  sentence of content may omit the header (all slots optional).
- **CardFooter**: THE action row — commit/next/back Buttons live here, never loose in content.
  One solid primary, at most one ghost secondary (matches the confirm/decline archetype).

**Worked payload sketch** (one ask card, anatomy-correct):

```jsonl
{"a2uiMeta":{"note":"Which room would you like? Standard (€180) or the Deluxe King (€240)?","ask":{"surfaceId":"ask-1"}}}
{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}
{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[
  {"id":"root","component":"Card","children":["hd","ct","ft"]},
  {"id":"hd","component":"CardHeader","children":["title"]},
  {"id":"title","component":"Text","variant":"label","text":"Pick a room"},
  {"id":"ct","component":"CardContent","children":["rooms"]},
  {"id":"rooms","component":"RadioGroup","value":{"path":"/room"},"children":["r1","r2"]},
  {"id":"r1","component":"Radio","value":"standard","label":"Standard · €180"},
  {"id":"r2","component":"Radio","value":"deluxe","label":"Deluxe King · €240"},
  {"id":"ft","component":"CardFooter","children":["go"]},
  {"id":"go","component":"Button","label":"Continue","action":{"action":"pick-room"}}]}}
{"version":"v1.0","updateDataModel":{"surfaceId":"ask-1","value":{"room":"deluxe"}}}
```

**Grammar clause draft** (appends to the feed-ask archetypes paragraph):
> Card anatomy, when a Card frames the ask: the title rides CardHeader (a label Text — never a
> control), the fields ride CardContent, and every action Button rides CardFooter — the footer
> is the ONE action row; never scatter buttons inside content, and never put controls in the
> header. A single-fact card may omit the header entirely.

**Acceptance criteria**: (a) clause lands in grammar.md with prompt-pin tests moved;
(b) a corpus exemplar demonstrating the three-slot ask card passes `a2ui-payload.md` rubric;
(c) negative eval: a payload with a Button inside CardContent alongside a populated CardFooter
is flagged by the a2ui-review rubric row this adds.
**Conflicts with existing law**: none (F1).

### R2 — Backable multi-step: ONE surface, local state until commit

**Wire reality, worked out.** One surface = one data model. The draft lives at `/draft/*`
(two-way bound inputs write it client-side; every action round-trip carries it via
`sendDataModel:true`). BACK and NEXT are ordinary actions; each producer turn answers with an
`updateComponents` scene transition on the SAME surface — never a fresh surface (F6/#1164),
never a root redelivery (root delivered ONCE; the growing scene sits under a stable wrapper
child, the grammar's own root-once escape hatch). Nothing is committed anywhere until the
flow-final confirm; BACK is therefore free — the draft paths persist untouched across scene
swaps because scene transitions replace COMPONENTS, not the data model (bound values re-render
from the still-present `/draft/*` paths — exactly the F2 "don't wipe step-local state" pitfall,
solved structurally).

**3-step backable selection, full payload sketch** (dates → room → confirm):

```jsonl
// turn 1 — create + skeleton: root once, scene container under its own id
{"a2uiMeta":{"note":"Let's book your stay — first, the dates.","ask":{"surfaceId":"ask-1"}}}
{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}
{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[
  {"id":"root","component":"Card","children":["shell"]},
  {"id":"shell","component":"Column","gap":"md","children":["scene"]},
  {"id":"scene","component":"Column","gap":"md","children":["cal","nav1"]},
  {"id":"cal","component":"Calendar","mode":"range","valueStart":{"path":"/draft/from"},"valueEnd":{"path":"/draft/to"}},
  {"id":"nav1","component":"Row","gap":"sm","children":["next1"]},
  {"id":"next1","component":"Button","label":"Continue","action":{"action":"step","context":{"to":"room"}}}]}}
{"version":"v1.0","updateDataModel":{"surfaceId":"ask-1","value":{"draft":{"from":"","to":"","room":"deluxe"}}}}

// turn 2 — user hit Continue (action carried the whole draft) → scene 2 on the SAME surface:
// resend ONLY "scene" + its new children; /draft/from,/draft/to remain in the model untouched
{"a2uiMeta":{"note":"Got the dates — now the room. You can go back to change the dates any time."}}
{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[
  {"id":"scene","component":"Column","gap":"md","children":["rooms","nav2"]},
  {"id":"rooms","component":"RadioGroup","value":{"path":"/draft/room"},"children":["r1","r2"]},
  {"id":"r1","component":"Radio","value":"standard","label":"Standard · €180"},
  {"id":"r2","component":"Radio","value":"deluxe","label":"Deluxe King · €240"},
  {"id":"nav2","component":"Row","gap":"sm","children":["back2","next2"]},
  {"id":"back2","component":"Button","label":"Back","variant":"ghost","action":{"action":"step","context":{"to":"dates"}}},
  {"id":"next2","component":"Button","label":"Continue","action":{"action":"step","context":{"to":"confirm"}}}]}}

// (a BACK here: identical mechanics — updateComponents swaps "scene" back to the dates shape;
//  the Calendar re-binds /draft/from,/draft/to and shows the values already chosen)

// turn 3 — confirm scene: the RECEIPT (grammar's receipt clause verbatim: Column gap xs of
// per-field Rows, label+value adjacent, humanized, empty fields omitted) + ONE commit Button
{"a2uiMeta":{"note":"Here's the booking — confirm and I'll send it, or go back to amend."}}
{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[
  {"id":"scene","component":"Column","gap":"md","children":["rcpt","nav3"]},
  {"id":"rcpt","component":"Column","gap":"xs","children":["f1","f2"]},
  {"id":"f1","component":"Row","gap":"sm","align":"baseline","children":["f1l","f1v"]},
  {"id":"f1l","component":"Text","variant":"label","text":"Dates"},
  {"id":"f1v","component":"Text","variant":"body","text":"12–15 Jun · 3 nights"},
  {"id":"f2","component":"Row","gap":"sm","align":"baseline","children":["f2l","f2v"]},
  {"id":"f2l","component":"Text","variant":"label","text":"Room"},
  {"id":"f2v","component":"Text","variant":"body","text":"Deluxe King · €240/night"},
  {"id":"nav3","component":"Row","gap":"sm","children":["back3","commit"]},
  {"id":"back3","component":"Button","label":"Back","variant":"ghost","action":{"action":"step","context":{"to":"room"}}},
  {"id":"commit","component":"Button","label":"Confirm booking","action":{"action":"commit"}}]}}

// turn 4 — user confirmed → the COMMIT happens now; closing turn, no A2UI (ADR-0198)
{"a2uiMeta":{"note":"We put the booking together and you confirmed it — the Deluxe King for 12–15 Jun is booked and the hotel has received it. Thanks! Anything else, or are we all set?","flowEnd":true}}
```

**Grammar clause draft** (extends the surface-reuse paragraph):
> A multi-step ask with a Back affordance stays on ONE surface: hold every answer under a
> shared draft prefix in the data model (e.g. `/draft/*`), transition scenes with
> updateComponents on a stable scene container (root delivered once; the scene swaps under its
> own id), and let Back be an ordinary action whose response re-renders the earlier scene —
> the draft paths survive scene swaps, so returning to a step shows what the user already
> chose. Nothing is dispatched until the flow-final confirm; every Next/Back turn is
> draft-only. From scene 2 onward the nav row carries a ghost Back before the solid Continue.

**Acceptance criteria**: (a) clause in grammar.md + pin tests; (b) a `backable-wizard` corpus
seed replaying the sketch above validates green and demonstrates a BACK round-trip preserving
draft values; (c) live eval on the test chat: a 3-step flow where the user goes back at step 3,
amends step 1, returns forward — values persist, exactly ONE surface ever on screen, no stale
buttons; (d) the receipt scene passes the receipt-clause shape checks.
**Conflicts with existing law**: ONE, and it requires a LAW AMENDMENT — the earlier "none"
claim was false (review-caught). grammar.md's answered-ask law ("After the user answers an
ask… do NOT delete it, update it, or rebuild it, ever; if the next step needs another ask,
declare a NEW ask with a FRESH `ask-<n>` id") collides head-on with this pattern: every
mid-flow Next/Back is a user commit on the ask surface, and the producer's response UPDATES
that same surface. The two shipped clauses are themselves in tension — the surface-reuse
paragraph explicitly names "a wizard's next step" as a same-surface scene transition, while
the answered-ask law forbids updating a surface the user has answered. The clause draft above
therefore lands only WITH this amendment: **mid-flow Next/Back commits are scene transitions,
not answered asks; the answered-ask freeze applies only at flow end** (the flow-final confirm
settles the surface; from that point the freeze — and ADR-0196's settle law — governs).

**Meta-line posture for the mid-flow turns (2–3), decided explicitly.** Two honest postures:
- **(i) One ask for the whole flow** — the ask is declared ONCE (turn 1, `ask-1`); turns 2–3
  carry note-only meta-lines (as the sketch shows) because the interaction is still the SAME
  ask, mid-scene. Consequence: "at most one ask per turn" is trivially satisfied; no counter
  burn; but the client's ask-registry sees one long-lived ask rather than per-step asks.
- **(ii) Fresh `ask-<n>` per scene** — each scene transition re-declares an ask with a fresh
  id. Consequence: literal conformance with the fresh-id rule, but it burns the counter per
  step, fragments one task into N asks, and contradicts the surface-reuse law's whole point
  (the fresh id would demand a fresh surface, which #1164 forbids for a continuing flow).

**Recommendation: posture (i)** — the whole backable flow is ONE ask on ONE surface; the
amendment above is exactly what makes (i) lawful. The sketch's turns 2–3 are already written
in posture (i). Kim's call at approval.

### R3 — Greet card (the open bookend)

First turn of a session (when the persona/playbook declares a greeting): a short warm note PLUS
one compact orientation card — agent identity line, 2–4 starter Buttons whose `action.context`
names a concrete starter intent (F4: options beat generic greetings). It is NOT an ask: no
`ask-<n>` surface id (use e.g. `"welcome"`), no commit-button law, no data model needed
(`sendDataModel` may be omitted). When the user's first real task begins, the greet card's
buttons are retired per the stale-affordance rule.

**Payload sketch**:

```jsonl
{"a2uiMeta":{"note":"Hi — I'm the concierge for Hotel Aurora. I can book rooms, tables, and spa slots, or answer questions about the hotel."}}
{"version":"v1.0","createSurface":{"surfaceId":"welcome","catalogId":"agent-ui"}}
{"version":"v1.0","updateComponents":{"surfaceId":"welcome","components":[
  {"id":"root","component":"Card","children":["ct","ft"]},
  {"id":"ct","component":"CardContent","children":["t"]},
  {"id":"t","component":"Text","variant":"body","text":"What would you like to do?"},
  {"id":"ft","component":"CardFooter","children":["b1","b2","b3"]},
  {"id":"b1","component":"Button","label":"Book a room","action":{"action":"start","context":{"intent":"room"}}},
  {"id":"b2","component":"Button","label":"Reserve a table","action":{"action":"start","context":{"intent":"table"}}},
  {"id":"b3","component":"Button","variant":"ghost","label":"Just a question","action":{"action":"start","context":{"intent":"faq"}}}]}}
```

**Grammar clause draft**:
> Greeting, when your persona opens the session: your first turn's note introduces who you are
> and what you can do in one or two sentences, and MAY add ONE small starter card — 2–4 Buttons
> naming concrete starting intents in their action context. A greet card is not an ask: give it
> a plain surface id (never `ask-<n>`), no commit-button requirement. The moment a real task
> starts, retire its buttons per the stale-affordance rule so at most one surface stays live.

**Acceptance criteria**: (a) clause (or a mini-skill `greeting-card.md`, if Kim rules it
optional-per-persona rather than default — OPEN fork, mirrors the #1101 grammar-vs-mini-skill
call which went grammar-side for completion because acceptance demanded unconditional; greeting
is persona-conditional, so mini-skill is the recommended home); (b) eval: fresh session emits
note + greet card, no ask id consumed; (c) starting a task retires the greet buttons same turn.
**Conflicts with existing law**: F4's ask-exemption tension PLUS a harder gap the review
caught — the greet card has NO lawful feed placement as sketched. The only shipped mechanism
that embeds a surface in the chat feed is the meta-line `ask` field (grammar.md's
feed-embedded-asks paragraph, ADR-0097): a non-ask surface never lands in the feed at all, so
the sketch above, taken literally, renders nowhere the user greets from. This is a third
owner fork / hard prerequisite:
- **(i) Greet rides the ask mechanism with an exempt id class** — the meta-line declares
  `ask:{surfaceId:"welcome"}` (or a reserved non-`ask-<n>` id class), with the ask-protocol
  obligations (commit-button law, counter) explicitly waived for that id class.
- **(ii) The meta-line grows a non-ask placement field** — an ADR-0097-lineage amendment
  minting a fifth placement vocabulary member for feed-embedded non-ask surfaces.
The clause draft above CANNOT land without one of these; the fork rides mobilization item 4.

### R4 — Conclude bookend (courtesy close, optionally with a receipt already on screen)

The conclude half is shipped law (ADR-0198 + the #1101 amendment: flowEnd on ALL terminal
paths; courtesy-close 5 parts; closing turn emits NO A2UI). This lane adds only:
(a) the final receipt REMAINS on screen as the durable record — the closing turn never deletes
the confirm-scene surface (it is the conversation's own history, the answered-ask precedent);
(b) a "settled" transition of the receipt scene — buttons retired, one status Badge added
("Booked · #AB123"). The review falsified this lane's earlier "zero law change" claim: EVERY
producer-turn variant amends shipped law. **Three-way fork for Kim**:
- **(i) Settle-update shares the closing turn** — amends ADR-0198 cl.2/A3's "emits NO A2UI at
  all" on the closing turn.
- **(ii) An extra producer "settle" turn between confirm and close** — amends TWO laws:
  ADR-0198 cl.2 mandates the closing turn come IMMEDIATELY next after the flow-final confirm
  (and there is no user message for the extra turn to answer — the turn has nothing to hang
  on); AND the settle-update edits an answered ask, the same answered-ask freeze R2's
  amendment carves (but R2's carve-out is mid-flow only — this edit is AT flow end, exactly
  where the freeze applies).
- **(iii) Client-side settle per ADR-0196, NO producer turn** — ADR-0196's ratified territory
  IS card-level settle: cl.5's questionnaire-template contract already collapses the answered
  card client-side (`:state(answered)`, summary row, durable Edit anchor) with zero wire
  traffic. The receipt's Back/Confirm buttons retire and the settled treatment paints as a
  CLIENT consequence of the answered confirm ask; the producer's next turn is the ADR-0198
  closing turn, untouched. **Recommended** — this lane agrees with the review: it is the
  cleanest branch (zero amendment, and it composes with rather than duplicates ADR-0196);
  the only delta left for this lane is then the reference Badge, which may not be worth a
  producer turn at all.

**Grammar clause draft** (one sentence appended to the flow-completion paragraph):
> Before the closing turn, settle the receipt: in the turn that processes the user's confirm,
> retire the receipt scene's Back/Confirm buttons and add the settled status (a Badge with the
> reference), so the receipt stays on screen as the durable record; the closing turn itself
> still emits no A2UI. Never deleteSurface a confirmed receipt.

**Acceptance criteria**: (a) clause + pin tests; (b) live eval: post-confirm the receipt shows
settled state, then the courtesy close arrives with flowEnd, done/start-over chrome fires;
(c) escalation path still closes prose-only (no receipt to settle) per the amendment.
**Conflicts with existing law**: amends law under every branch EXCEPT the client-side option —
fork (i) amends ADR-0198's no-A2UI closing turn, fork (ii) amends both ADR-0198's
immediately-next mandate and the answered-ask freeze; only fork (iii) (ADR-0196 client-side
settle) ships with zero amendment. The grammar clause draft above is written for a producer
settle turn and stands ONLY if Kim picks (i) or (ii); under (iii) it is replaced by a
one-sentence pointer to ADR-0196's template contract.

## Non-goals

- No renderer/app code changes (the #1164 lane-2 disabledSurfaceId machinery is its own arc).
- No new catalog components; every pattern composes existing types.
- No persistence of drafts across sessions (F2's save-and-resume) — out of scope; drafts live
  in the surface data model only.
- No payment/credential collection in any worked example (standing playbook law).
- Not re-litigating ADR-0198's meta-line design — this lane builds on it.

## Mobilization list (sized issues, minted on Kim's approval)

1. **Card-anatomy grammar clause + corpus exemplar + rubric row** (R1) — size:small.
2. **Backable-wizard: grammar clause + `backable-wizard` corpus seed + validation tests** (R2)
   — size:small (docs + seed + pin tests; no package code — the estate size enum is small|big).
3. **Backable-wizard live eval on the test chat** (R2c, #1081 pixel-truth pattern) —
   size:small, depends on 2.
4. **Greeting: Kim's fork (grammar default vs `greeting-card` mini-skill), then build the
   chosen home + eval** (R3) — size:small.
5. **Settled-receipt clause + the settle-turn fork ruling; live eval extends the existing
   #1101 pixel run** (R4) — size:small.
6. **Playbook refresh**: `booking-flow` in `agent-admin-libraries.ts` updated to name the
   Back affordance + settled receipt (it already carries scenes/confirm/flowEnd) — size:small,
   depends on 2+5.

## Self-check — Lane-2 rubric

| Rubric row | Verdict |
|---|---|
| Each pattern has a worked A2UI payload sketch | 🟢 R1/R2/R3 full JSONL sketches; R4 delta specified against R2 turn 4 |
| Composes with (never contradicts) shipped grammar laws | 🟡 the independent review caught TWO conflicts this draft had silently resolved as "none" (R2 vs the answered-ask freeze; R4's "zero law change" false under every producer-turn branch) — both now repaired as explicit law-amendment forks; a third gap (R3 has no lawful feed placement) recorded as a hard prerequisite |
| Back-step semantics defined against the ONE-data-model reality | 🟢 R2: `/draft/*` survives scene swaps; scene container under stable id; root-once respected; commit only at flow-final confirm |
| Bookend patterns cover greet AND conclude | 🟢 R3 + R4 (conclude builds on ratified ADR-0198 rather than duplicating it) |
| Per-pattern acceptance criteria | 🟢 each R has (a)–(c/d) criteria incl. negative/live evals |

**PASS after corrective pass** — the original PASS overstated row 2; the review-caught
conflicts are now recorded honestly. Owner forks: R2 mid-flow-ask posture (recommend one-ask),
R3 home AND R3 feed-placement mechanism (hard prerequisite), R4 settle branch (recommend
client-side per ADR-0196).

## Sources

- Fluent 2 Card usage — https://fluent2.microsoft.design/components/web/react/core/card/usage
- Nathan Curtis, Cards and Composability — https://medium.com/eightshapes-llc/cards-and-composability-in-design-systems-8845ecbee50e
- LogRocket, Card interface design — https://blog.logrocket.com/ux-design/ui-card-design/
- Reform, Multi-Step Form State Persistence — https://www.reform.app/blog/multi-step-form-state-persistence-guide
- AppMaster, Save-and-resume wizards — https://appmaster.io/blog/save-and-resume-multi-step-wizard
- OpenAI Apps SDK community, mixed UI+chat multi-step forms — https://community.openai.com/t/best-practice-for-multi-step-forms-with-mixed-ui-chat-input-widgetstate-not-always-picked-up-by-model/1369487
- aiuxdesign.guide, Conversational UI patterns (2026) — https://www.aiuxdesign.guide/patterns/conversational-ui
- getstream.io, Chat UX Best Practices — https://getstream.io/blog/chat-ux/
- Jotform, chatbot best practices + welcome examples — https://www.jotform.com/ai/agents/chatbot-best-practices/ · https://www.jotform.com/ai/agents/ai-chatbot-welcome-examples/
- FlowHunt, 30+ chatbot welcome messages — https://www.flowhunt.io/blog/30-chatbot-welcome-messages-to-make-a-great-first-impression/
- In-repo primaries: `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` (full read) · GH #1101 (+ADR-0198 arc, Kim's live UX ruling 2026-08-17) · GH #1164 (closed) · `site/pages/agent-admin-libraries.ts` (booking-flow playbook) · `packages/agent-ui/a2ui/src/examples/generative-form.ts` (SPEC-R4 progressive delivery, root-once wrapper idiom)

## Kim rulings (2026-08-17, find-open-questions round — the three forks are CLOSED)

- **R3 greet home → mini-skill** (as recommended): a persona-conditional `greeting-card` mini-skill; grammar stays greeting-silent.
- **R3 greet feed-placement → ask mechanism + exempt id class**: the greet card rides the existing meta-line `ask` field with a distinguished id class (e.g. `greet-1`) exempt from the answered-ask freeze — no new wire field.
- **R4 settle placement → SHARE THE CLOSING TURN** (Kim overrode the client-side recommendation): the flow's closing turn carries exactly ONE settle updateComponents (strip the confirmed receipt's buttons + settled badge) alongside the courtesy-close note + flowEnd. This is a deliberate ADR-0198 amendment: cl.2's "closing turn emits NO A2UI" gains the one-settle-update carve-out. The mobilization's grammar-amendment item must bundle this carve-out with the R2 mid-flow carve-out so ADR-0198 is amended once, not twice.
