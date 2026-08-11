# Amendment sheet — `a2ui-live-agent.spec.md` v0.14 → v0.15 (the builder-mission nudge)

> Status: proposed (a DRAFT sheet — applied to the SPEC only AFTER
> [ADR-0182](../adr/0182-builder-mission-nudge-and-plan-visibility.md) ratifies; the
> ADR-0168/tool-enablement amendment-sheet precedent) · v0.1 · 2026-08-11 ·
> Target: [`../spec/a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) (accepted, v0.14).
> Apply verbatim at build time; the SPEC's own update-in-place changelog pattern (v0.1–v0.14)
> governs. SPEC-R20/R21/R29/R30 are UNTOUCHED by every clause below — this sheet adds one new
> section (§3.2e) and one new traceability row; it amends nothing existing.

## §A — header changelog line (prepend to the version list)

> v0.15 changelog (ADR-0182 — the builder-mission drive-to-completion nudge, GH #716): NEW §3.2e —
> a second opt-in modality gate, `builderMission`, the SPEC-R30 shape applied a second time but
> DERIVED from structural turn-origin (`session === 'authoring'`, computed host-side in the runner)
> rather than a persona-configurable store key (NEW **SPEC-R31**). With the gate ON, the composed
> prompt teaches the model to actively drive the Builder interview toward a completed agent
> definition and to declare its own remaining-work view via the ALREADY-SHIPPED `plan` arm
> (SPEC-R20), framed as open sections of the definition rather than sequential task steps — no new
> meta-line field, no wire change to `plan` itself. Gate OFF or absent is byte-identical to today's
> composition, mode-invariant, across every `mode` value (the SPEC-R30 degrade law, verbatim). The
> runner-side event kind that surfaces a received `plan` to the admin UI, and its rendering, are
> OUT OF SCOPE for this SPEC (the SPEC-R29 traceability carve-out, applied identically) — they land
> in `agent-admin-schema.ts`/`agent-admin.ts` per ADR-0182 cl.4/cl.5, no LLD (the family's own S1/S4
> "plain reuse" tier — the change is mechanical, not a new component/interface decomposition).

## §B — new §3.2e (insert immediately before "### 3.3 The round-trip")

```markdown
### 3.2e The `builderMission` teaching gate (ADR-0182 — the drive-to-completion nudge)

**SPEC-R31 — A second opt-in modality gate, the SPEC-R30 shape applied a second time, teaching the
model to actively nudge completion and declare its own progress via the ALREADY-SHIPPED `plan` arm
(SPEC-R20) — no new meta-line field.** *(→ PRD-G1/G6; ADR-0182 cl.2/cl.3)*
- **The gate signal is derived, never persona-configurable.** Unlike SPEC-R30's `authoringSurface`
  (a persona-scoped store key any persona may enable for its own turn), `builderMission`'s TRUE
  source is structural turn-origin — `session === 'authoring'` (ADR-0182 cl.1) — computed HOST-SIDE
  in the runner, never a field a persona document carries. Once derived, it crosses the wire as an
  ordinary boolean and is validated the SAME fail-closed way (`validateBuilderMission`, the
  `validateAuthoringSurface` shape verbatim): non-boolean ⇒ `undefined`, never a 400.
- **Threading.** Reaches `buildSystemPrompt` as a 9th positional parameter, on the SAME per-call
  seam `authoringSurface` rides. `produce()` uses it for exactly one thing — conditioning prompt
  composition — and never consumes the resulting `plan` itself (consumption stays host-side, the
  SPEC-R21 runner/UI boundary, OUT OF SCOPE for this document, same carve-out SPEC-R29's traceability
  row already takes for `personaPatch`'s runner event kind).
- **The teaching.** With the gate ON, the composed prompt MUST instruct the model to (a) treat the
  interview as driving toward a completed agent definition, not an open-ended chat, and (b) declare
  its own remaining-work view via the shipped `plan` arm, framed as OPEN SECTIONS of the definition
  still to fill — NOT as sequential task steps (ADR-0182 OF1's framing note: SPEC-R20/R21's existing
  plan-runner prose reads steps as work to execute in order; this usage is a checklist snapshot, and
  the teaching text MUST disambiguate the two so a model does not conflate them). HOST-OWNED,
  byte-pinned (`prompts/builder-mission.md`), never a persona-editable entry — the SPEC-R30 rule 5
  precedent, unchanged.
- **Conditional composition — the SPEC-R30 `genuiBlock`-shaped seam, not `GRAMMAR`.** Gate OFF or
  ABSENT composes zero bytes, mode-invariant, via a `missionBlock(gate)` function mirroring
  `authoringBlock` exactly; the reasoning for keeping this OUT of the mode-invariant `GRAMMAR`
  constant is SPEC-R30's own (admin-specific teaching must not ride every A2UI consumer's prompt or
  move SPEC-R6's byte-identity baselines).
- **The degrade law (verbatim, SPEC-R30's).** Gate OFF ⇒ byte-identical turn path to today,
  including when a model volunteers a `plan` anyway — SPEC-R20/R21's own consumption law already
  governs whether/how a `plan` is read; this gate only withholds the NEW teaching that would prompt
  one, never the wire's existing gate-blind `plan` passthrough.
- **AC1** *Given* the gate's fail-closed read, *when* fed `undefined`, `false`, `0`, `'true'`, `{}`,
  and `true`, *then* only boolean `true` reads ON — deterministic unit test, `npm test` green.
- **AC2** *Given* `buildSystemPrompt` with the gate ABSENT and explicitly OFF, *when* compared
  against the composition from before this parameter existed, *then* both are BYTE-IDENTICAL across
  all four `mode` values; *given* the gate ON, *then* the teaching segment is present, byte-identical
  across modes, names the open-sections framing (OF1) explicitly, and leaks into no other section —
  `system-prompt-grammar.test.ts` (+ the standing `prompt-drift`/`prompt-equivalence` gates staying
  green untouched), `npm test` green, no live model.
- **AC3** *Given* a stub `produce()` run with the gate OFF whose model volunteers a well-formed
  `plan`, *when* it completes, *then* the run composes ZERO new teaching bytes and the stream is
  byte-identical to the gate-ON run's at the wire layer (the `plan` arm itself stays SPEC-R20's
  gate-blind passthrough) — `produce-loop.test.ts`, `npm test` green, no live model.
```

## §C — new traceability row (append immediately after the SPEC-R30 row, §7)

```markdown
| SPEC-R31 | PRD-G1/G6 (the `builderMission` drive-to-completion gate — the SPEC-R30 shape applied a second time, but DERIVED from structural turn-origin (`session === 'authoring'`, host-side) rather than a persona-configurable key; teaches the model to nudge completion and declare progress via the ALREADY-SHIPPED `plan` arm, framed as open sections rather than sequential steps (OF1); no new meta-line field; the runner event kind and note-composition rendering are OUT OF SCOPE — ADR-0182 cl.1/cl.4/cl.5) |
```
