# ADR-0132 — Agent Admin's Instructions/Settings become a generic ordered-entry-list foundation: structured prompt sections + four toggleable capability kinds, one shared primitive

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 |
> | **Proposed by** | design intake (`system-decompose` both planes — `decompositions/agent-admin-instructions-capabilities.decomp.json`, `coverage_check.py` clean: 19 nodes/12 actions/15 hosts/15 edges), directed by Kim: "we cannot just have a simple 'Instructions' text field... it should be something like: [Instructions pane: System Prompts (Foundation/Personality/Critical Items); Settings pane: Skills/Workflows/Resources/Tools, each a toggleable list with custom-entry authoring]" |
> | **Ratified by** | — (proposed; awaiting Kim's ratification, the ADR-0131/ADR-0120/ADR-0129 intake-then-ratify shape) |
> | **Repairs** | none yet — an intake ADR; SPEC/LLD (if this earns its own document set) is build-time business, per precedent |
> | **Supersedes / Superseded by** | **Amends [ADR-0131](./0131-agent-admin-ui-scope-and-composition.md)'s Fork 1 framing** ("a generic self-contained config" — still true, but now structured, not flat) and its prompts-pane vehicle question — without reopening Fork 2 (three panes) or Fork 3 (real persistence, unchanged, extended). Relates [TKT-0041](../tickets/tkt-0041-agent-admin-prompts-pane-native-textarea.md) (the multiline-editing-vehicle question this ADR's `n1b`/`n1c` inherit, still open, now applying to N sections instead of one field). |

## Context

`ui-agent-admin` shipped (TKT-0039, ADR-0131) with a flat config schema (name/model/temperature/
toolsEnabled) and a single native `<textarea>` bound to one `systemPrompt` store key. Kim's
directive: this is not the right shape for a real agent-authoring surface. Instructions need to be
composed from distinct, independently-editable sections (Foundation, Personality, Critical Items);
Settings need to expose toggleable Skills/Workflows/Resources/Tools lists, each with the ability to
author a custom entry — "so we have a general purpose foundation," not a one-off demo shape.

The `system-decompose` intake found ONE unifying structure underneath both asks: a named, ordered,
toggleable **entry** in a typed **list**, with a shared custom-entry authoring form — Foundation/
Personality/Critical Items and Skills/Workflows/Resources/Tools are seven instances of the SAME
primitive, not seven bespoke UIs. That primitive, not the two panes' surface content, is the actual
"general purpose foundation."

Four forks, each ruled by Kim (all as recommended):

1. **The existing flat agent config (name/model/temperature/toolsEnabled)** — kept, not discarded:
   folds into its own "Agent" section within the settings pane, alongside the four new capability
   lists.
2. **Section taxonomy** — extensible: Foundation/Personality/Critical Items are seeded DEFAULT
   entries in the generic list, not a hardcoded 3-member enum. A future section type is a data
   change, not a code change.
3. **Custom-entry depth** — generic: every kind (a prompt section or any of the four capability
   kinds) shares ONE shape — name + description + free-text content. Kind-specific fields (e.g. a
   Tool's parameter schema) are explicitly deferred, a separately-scoped future extension, not
   built now.
4. **Built-in deletability** — toggle off only, never deleted. Matches the fail-closed,
   never-silently-discard discipline already established in this build (`DEFAULT_SYSTEM_PROMPT`'s
   own fallback law, ADR-0131).

## Decision

**Replace the flat schema + single textarea with ONE generic ordered-entry-list primitive,
instantiated five times: once for prompt sections, once each for Skills/Workflows/Resources/Tools.**

1. **The generic primitive (`decomp.json` `n1`).** An entry model — id, label, content-or-config,
   order, enabled, builtin-vs-custom, parameterized by a `kind` string — plus ONE list-rendering UI
   (per-entry edit/enable-disable) and ONE custom-entry authoring form, reused by every
   instantiation. No kind gets its own bespoke list/toggle/author code.
2. **Instructions pane (`n2`).** Becomes an instance of the primitive, `kind: "prompt-section"`,
   seeded with three built-in, non-deletable, toggle-off-only entries (Foundation, Personality,
   Critical Items — Fork 4). A composer concatenates the ENABLED sections, in their defined order,
   into the one final system-prompt string the turn loop reads (`n2b`) — replacing the old
   single-key read.
3. **Settings pane (`n3`).** Becomes: the existing "Agent" config (Fork 1, unchanged fields, now
   its own section rather than the whole pane) + four new instances of the primitive —
   `kind: "skill" | "workflow" | "resource" | "tool"` — each independently toggleable, each with the
   shared custom-entry form.
4. **Custom entries stay generic (Fork 3).** name + description + content, uniformly, for every
   kind including custom prompt sections. Fail-closed validated (name required, no duplicate id)
   before admission — the same discipline `sanitizeNumber`/`sanitizeSelect` already apply
   elsewhere in this build.
5. **Persistence extends, does not replace, the real-persistence work (ADR-0131 cl.3).** The store
   schema grows to carry section content + all four capability lists' toggle states + custom
   entries — still one shared `SettingsStore`, still `localStorage`-backed, still surviving a
   reload.
6. **The turn loop reads the COMPOSED state, not a flat key.** The stub reply (still no external
   model dependency, ADR-0131 unchanged) cites the composed prompt + the enabled-capabilities
   snapshot, proving the richer live-apply wiring the same way the shipped v1 already proves the
   simpler one.

**Inherited, not resolved here:** the per-entry multiline EDITING VEHICLE (`n1b`'s "edit"
affordance) is the exact same open question [TKT-0041](../tickets/tkt-0041-agent-admin-prompts-pane-native-textarea.md)
already tracks — this ADR does not re-litigate or resolve it; it now applies to N section/entry
editors instead of one field.

## Consequences

- **A real primitive, not a demo shape.** `n1`'s generic list becomes reusable foundation — a
  future capability kind (or a future consumer entirely) is a seed-data change, not new list/
  toggle/author code (Fork 2's extensibility ruling, generalized).
- **Build scope grows substantially** from the shipped v1: a new data model, a new list UI, a new
  authoring form, a prompt composer, an extended store schema, and updated turn-loop wiring — this
  is not a small follow-on patch to TKT-0039, it is the ticket's own architecture maturing under
  direct Kim's guidance.
- **The generic-custom-entry ruling (Fork 3) is a stated, correctable simplification** — a Tool
  that genuinely needs a parameter schema, or a Resource that needs a URI/type, is NOT representable
  yet. Named explicitly so a future intake doesn't rediscover this as a surprise gap.
- **TKT-0041 stays open, unchanged in substance** — the vehicle question moves with the architecture,
  it is not closed by this ADR.

## Acceptance

This is an **intake** ADR — realized in stages, same shape as ADR-0131/ADR-0120/ADR-0129:

- **Intake (this change):** `system-decompose` both planes done (coverage clean); four forks ruled;
  no code changes.
- **Build (separately dispatched):** the generic entry-list primitive + its five instantiations +
  the prompt composer + the extended store schema + turn-loop integration, each to the fleet's
  per-module DoD; independently reviewed (generator≠critic, the ADR-0131 precedent); TKT-0041's
  vehicle question resolved as part of, or explicitly still deferred within, the same build.

## Alternatives considered

- **Kind-specific custom-entry forms now** (Fork 3's alternative). Rejected: four separate forms
  (a Tool's parameter schema, a Resource's URI/type, etc.) substantially expand build scope for a
  demo surface with no real execution backing any kind yet — deferred until a real consumer needs
  it, not built speculatively.
- **A fixed, closed 3-section taxonomy** (Fork 2's alternative). Rejected: contradicts "general
  purpose foundation" directly — a hardcoded enum is exactly what this ADR exists to replace.
- **Discarding the existing flat agent config** (Fork 1's alternative). Rejected: no stated reason
  to throw away already-shipped, already-reviewed work; folding it into its own section costs
  nothing structurally, since it already conforms to the "one more section in the pane" shape.
