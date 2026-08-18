# IDR-0003 — Generative UI is the primary conversation medium, and its conduct is law

> | | |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-17 |
> | **Author** | product seat (fleet-bootstrap Phase 2), from Kim's live-session rulings 2026-08-17 |
> | **Ratified by** | Kim — 2026-08-17, fleet-bootstrap Phase-3 hard gate (AskUserQuestion ratify round) (Kim only; vocabulary `proposed · accepted · superseded`; an accepted IDR body is append-only) |
> | **Tier** | IDR — intent decision (WHY/WHAT); realized by grammar law, ADRs, mini-skills, corpus seeds |
> | **Realized by** | GH #1182 (gen-UI-first ask law, shipped) · [ADR-0198](../adr/0198-ask-flow-completion-flowend-meta-signal.md) + its pending bundled amendment · [ADR-0196](../adr/0196-answered-state-law-questionnaire-settle-edit-amend.md) · [req-a2ui-patterns](../research/req-a2ui-patterns.md) R1–R4 (forks ruled 2026-08-17) · GH #1101/#1104/#1164 arcs |

## Intent

In this product, an agent conversation *is* a generative-UI experience. Surfaces are the default
way an agent asks, shows, and concludes; prose asks are the exception. And because the medium is
the product, **conduct is codified law** — testable grammar clauses and rulings — not per-persona
prompt craft that happens to behave.

## Decision

1. **Gen-UI-first asks.** The producer leans to A2UI surfaces for ANY input; prose asks are the
   ruled exception (GH #1182, already shipped law — this IDR records the WHY above it).
2. **Surface lifecycle honesty.** At most one surface reads live; a continuing flow REUSES its
   surface scene-to-scene; superseded cards visibly settle; a flow ENDS formally (confirm →
   courtesy close → flowEnd → done/start-over chrome). Violations are product bugs, filed from
   live pixels.
3. **Conversations are bookended.** Sessions may open with a greet card (persona-conditional
   mini-skill; embedded via the exempt ask-id class — Kim's 2026-08-17 fork rulings) and close
   with the courtesy close; the settled receipt stays on screen as the durable record, its
   settle-update SHARING the closing turn (Kim's ruled ADR-0198 carve-out).
4. **Domain realism over demos.** Playbooks model real arcs — realistic bookings, humanized
   receipt values (GH #1171, GH #1174/ADR-0201). "Feels like a demo" is a defect class, not a
   style note.

## Falsifiers

- If live evals show gen-UI-first asks measurably worsening task completion for some ask class,
  the exception boundary in clause 1 is re-drawn here.
- If the one-ask/one-surface wizard posture (the ruled ADR-0198 amendment) keeps fighting the
  producer in live runs, the lifecycle law itself — clause 2 — is what gets revisited, not
  patched per-persona.

## Ratification question

Accept "gen-UI-first, conduct-as-law, realism-over-demos" as standing product intent? (Clauses
1–3 largely record already-ruled law; the flip makes the WHY durable and names where future
falsifications land.)
