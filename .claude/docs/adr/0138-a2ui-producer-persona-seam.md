# ADR-0138 — the A2UI producer gains a PERSONA seam: an optional caller-supplied system-prompt section rides `ProduceOptions.personaSystem` → `buildSystemPrompt`, appended after the catalog law

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-16
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-16 |
> | **Proposed by** | design seat ([TKT-0076](../tickets/tkt-0076-agent-admin-real-a2ui-surfaces.md) intake — Kim's screenshot: the Croupier preset FAKES a ` ```surface ` YAML fence because its persona prompt promises surfaces the admin chat path cannot deliver) |
> | **Ratified by** | Kim, 2026-07-16 (the Status cell flipped to `accepted` by Kim's own edit mid-build) |
> | **Repairs** | on ratification+build: `tools/agent/system-prompt.ts` (`buildSystemPrompt` gains the optional persona parameter) · `tools/agent/produce.ts` (`ProduceOptions.personaSystem`) · `tools/agent/dev-proxy-plugin.ts` (the produce POST accepts a length-capped optional `personaSystem`) · [TKT-0076](../tickets/tkt-0076-agent-admin-real-a2ui-surfaces.md) (the owning ticket) |
> | **Supersedes / Superseded by** | (none) — Extends [ADR-0090](./0090-a2ui-gen-ui-mode-axis.md) / [ADR-0135](./0135-agent-harness-config-schema-and-prompt-files.md) (the per-turn-knob path `mode`/`miniSkillCap` already rode; `personaSystem` is the third knob on the same seam) · Relates [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md) (the toolkit export moves these SAME files `tools/agent/` → `src/agent/`; this seam is built against the current paths and travels with the move — an exported producer without a persona seam would force every consumer to fork the prompt) · [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (the composed persona this seam finally delivers to a producer turn) |

## Context

The A2UI producer's system prompt (`buildSystemPrompt`) is deliberately catalog-derived — catalog
rules, exemplars, mode, mini-skills — and has NO caller-supplied section. That is correct for the
wire contract (the catalog is the law), but it means a consumer with an IDENTITY — agent-admin's
composed persona (Foundation/Personality/Surface style + enabled capabilities, ADR-0132) — cannot
flavor a produce turn. The measured consequence (TKT-0076, Kim's screenshot): a persona prompted to
"play on ONE A2UI surface" through the TEXT chat path invents a fake ` ```surface ` YAML fence —
markdown box-art, the exact failure class ADR-0137's context names.

## Decision

Three clauses, all additive:

1. **`buildSystemPrompt` gains an optional trailing persona parameter.** When present and non-empty,
   the composed prompt appends one final section — `## Persona` — containing the caller's text
   verbatim, AFTER every catalog/exemplar/mode/mini-skill section, prefixed by one fixed sentence:
   the persona governs VOICE and CONTENT choices; the A2UI wire format and catalog rules above remain
   authoritative and are never overridden by it. Absent/empty ⇒ byte-identical output to today (the
   `mode`-absent precedent, ADR-0090 — zero regression for every existing caller).
2. **`ProduceOptions.personaSystem?: string` threads it** — the same knob path `model`/`mode`/
   `miniSkillCap` ride; `produce()` passes it to `buildSystemPrompt` once, outside the round loop.
3. **The dev-proxy produce handler accepts `personaSystem`** in the POST body: optional, string,
   length-capped (16 KB — the composed admin persona is ~1–2 KB; the cap is a runaway guard, not a
   modeled size), forwarded verbatim. Anything else in the body is rejected exactly as today.

## Consequences

- The admin's surface arm (TKT-0076's build) can deliver ADR-0132's composed persona to real produce
  turns; the six TKT-0074 presets' prompts become true instead of aspirational.
- ADR-0137's export inherits the seam — external consumers get persona-flavored producers without
  forking the prompt (the alternative — every consumer re-composing `buildSystemPrompt` — is exactly
  the drift the prompt's own drift-gates exist to prevent).
- The persona can still ASK for off-contract output; the fixed precedence sentence + the existing
  validate/self-correct loop are the guards (an invalid payload heals or fails visibly, never
  silently ships).
