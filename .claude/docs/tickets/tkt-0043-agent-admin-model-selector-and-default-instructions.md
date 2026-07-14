---
doc-type: ticket
id: tkt-0043
status: done
date: 2026-07-14
owner:
kind: feature
size: small
---
# TKT-0043 — `ui-agent-admin` gets a real model list and real default instruction content

## Summary
Two related stub-to-real upgrades on `ui-agent-admin` (TKT-0039, ADR-0131, ADR-0132), both staying
inside the "deterministic stub, no external runtime dependency" law (ADR-0131 cl.4/cl.7):

1. **Model field.** The `agent` section's `model` field (`agent-admin-schema.ts:35-46`) currently
   offers three generic behavior tiers (`default`/`fast`/`careful`) with no live model dependency.
   Replace the option list with real named models pulled from a shared constant (net-new — no
   `SUPPORTED_MODELS`-shaped list exists anywhere in the repo today; the closest analog,
   `packages/agent-ui/a2ui/tools/agent/providers.json`, lives in a different package and lacks a
   description field), keeping the field `type: 'select'` (no new primitive) and wiring it through
   the same `SettingsStore` commit-on-change path every other field already uses. The stub turn
   loop's citation string (`runStubAgentTurn`, `agent-admin-schema.ts:145`) reports the selected
   model's display label in place of the generic tier name.
2. **Default instruction content.** Of the three built-in `prompt-section` entries
   (`entries.ts:50-81`), only `foundation` currently carries real seed content (`'You are a helpful
   assistant.'` — coincidentally identical to `DEFAULT_SYSTEM_PROMPT_FALLBACK`, `entries.ts:110`);
   `personality` and `critical-items` seed to `content: ''`, so `composeSystemPrompt` silently
   drops them from the composed prompt by default (its `content.trim().length > 0` filter,
   `entries.ts:114`). Give all three built-in sections real, editable (not locked) starting
   content, so a fresh agent's composed prompt genuinely reflects three sections' worth of seed
   text rather than one section that happens to read like the old fallback.

Both increments are UI/data-only: no new `SettingsSchema` field type, no new entry-list
capability, no live model call.

## Acceptance
- `defaultAgentConfigSchema`'s `model` field's `options` list is built from a shared, named
  constant (e.g. `SUPPORTED_MODELS`) of `{ id, label }` entries — real model names, not
  `default`/`fast`/`careful` — and the field's `default` resolves to one of those ids.
- Changing the model selection through `ui-settings` commits via the existing `SettingsStore`
  path (no new propagation channel) and the very next stub turn's reply cites the newly selected
  model's display label, not its raw id.
- `runStubAgentTurn`'s citation string reads `(${modelLabel}, temp …)` — a human display label,
  matching how `name`/other fields already surface user-facing text.
- `DEFAULT_PROMPT_SECTIONS` (`entries.ts`) seeds real, non-empty, fully-editable content for all
  three built-ins — `foundation`, `personality`, `critical-items` — none of it `builtin`-locked
  beyond what's locked today (name/order/deletability only).
- With all three sections left at their seed defaults and enabled, `composeSystemPrompt`'s output
  contains all three sections' labeled blocks (not just Foundation's), and a fresh page load (no
  edits) shows this composed content in the stub reply — `DEFAULT_SYSTEM_PROMPT_FALLBACK` is only
  ever reached when every section is disabled or emptied by the user, same fail-closed contract
  as today.
- A reload after editing either the model selection or any section's content preserves the edit
  (same `SettingsStore`/`entries:*` persistence already in place for every other field) — no
  regression to existing persistence.
- `npm run check && npm test` stay green.

## Links
- [ADR-0131](../adr/0131-agent-admin-ui-scope-and-composition.md) — the "no external runtime
  dependency" ruling this ticket stays inside (cl.4/cl.7); the original flat `model` field.
- [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md) — the entry-list
  primitive `entries.ts` now owns (Fork 3: custom-entry depth is generic; this ticket only changes
  the three built-ins' *seed data*, not the primitive's shape).
- [TKT-0039](tkt-0039-agent-admin-ui.md) — the original build (name/model/temperature/tools +
  the hardcoded `'You are a helpful assistant.'` stub string this ticket replaces the fallback
  role of).
- [TKT-0041](tkt-0041-agent-admin-prompts-pane-native-textarea.md) — unrelated open deviation
  (native `<textarea>` vehicle) on the same control; not touched by this ticket.
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts` (the `model` field +
  `runStubAgentTurn`'s citation string).
- `packages/agent-ui/app/src/controls/agent-admin/entries.ts` (`DEFAULT_PROMPT_SECTIONS`,
  `composeSystemPrompt`, `DEFAULT_SYSTEM_PROMPT_FALLBACK`).
- `packages/agent-ui/app/src/controls/settings/schema.ts` (`SettingsFieldOption` — `{ value,
  label }` only, no per-option description field today) and
  `packages/agent-ui/app/src/controls/settings/generate.ts:135` (how a field-level `description`
  renders as help text — the precedent the request cites).
- `packages/agent-ui/a2ui/tools/agent/providers.json` + `site/lib/provider-switcher.ts` — the
  repo's one other real (dev-only) model-selector precedent; a different package, JSON not a TS
  constant, no `description` field.

## Scope/Open
- **Where `SUPPORTED_MODELS` lives.** Scoped local to `agent-admin` (e.g. a new
  `agent-admin-schema.ts`-adjacent constant), not `@agent-ui/shared` — nothing else in the repo
  consumes it yet, and hoisting it cross-package before a second real consumer exists would be
  premature per the "no contract change" size floor this ticket sizes to. If a future consumer
  wants the same list, that hoist is its own small ticket, not pre-built here.
- **Which models the list names.** Not pinned by this ticket — Kim's call at build time. The
  session's own current-model context (Fable 5 `claude-fable-5` · Opus 4.8 `claude-opus-4-8` ·
  Sonnet 5 `claude-sonnet-5` · Haiku 4.5 `claude-haiku-4-5-20251001`) is one candidate seed set,
  named here only as a starting point, not a ruling.
- **Per-option description/tooltip is NOT in this ticket's acceptance.** The request asks for an
  "optional short description/tooltip" per model option, mirroring `ui-settings`' help-text
  precedent — but that precedent (`generate.ts:135`) renders `description` at the FIELD level via
  `ElementInternals`, not per-`SettingsFieldOption`; `SettingsFieldOption` carries only
  `{ value, label }` today and `ui-select` (`packages/agent-ui/components/src/controls/select/
  select.ts`) has no per-option description/tooltip rendering at all. Adding one would touch
  `schema.ts`/`generate.ts` (consumed by every settings-schema consumer, not just agent-admin) and
  likely `ui-select` itself — a `components`-package change, a different layer than this ticket's
  `app`-only scope, and exactly the kind of "new primitive" the request's own Part 1 says to
  avoid. Left as a named, deferred gap: a field-level `description` (the existing mechanism) can
  carry general model guidance; true per-option tooltips are a separate, larger ticket if wanted.
- **Foundation's current seed content is not actually empty.** The request's framing ("the three
  built-in sections... are currently seeded but empty") holds for `personality`/`critical-items`
  only; `foundation` already seeds `'You are a helpful assistant.'`. This ticket's acceptance
  still asks for real content in all three (Foundation's existing line is a reasonable candidate
  to keep as-is, or sharpen — build-time call), so the discrepancy doesn't block work, only
  corrects the premise for whoever builds this.
- **A live model call is explicitly out of scope**, per the request's own note — true parity with
  a real model backend is a separate, larger change (introduces an external runtime dependency,
  breaks ADR-0131 cl.4/cl.7) and would need its own scoped ticket/ADR, not folded in here.

## Findings

**2026-07-14 — closed.** Both increments shipped in `agent-admin-schema.ts`/`entries.ts`:

1. **Model field.** A new `SUPPORTED_MODELS: readonly { id, label }[]` constant, scoped local to
   `agent-admin-schema.ts` per this ticket's own Scope/Open ruling (not `@agent-ui/shared` — no
   second consumer exists yet). Seeded from the session's own current-model family, named as the
   ticket's own candidate set: Opus 4.8 (`claude-opus-4-8`), Sonnet 5 (`claude-sonnet-5` —
   `DEFAULT_MODEL_ID`), Haiku 4.5 (`claude-haiku-4-5-20251001`), Fable 5 (`claude-fable-5`). The
   `model` field's `options` now derive from it (`SUPPORTED_MODELS.map(...)`); `sanitizeSelect`'s
   fallback literal in `agent-admin.ts` updated from `'default'` to `DEFAULT_MODEL_ID` to match.
   `runStubAgentTurn`'s citation string now reads a display label via a new `modelLabel(id)`
   lookup (falls back to the raw id if unrecognized, matching the file's own fail-closed law) —
   `(${modelLabel(config.model)}, temp …)`, not the raw id.
2. **Default instruction content.** `DEFAULT_PROMPT_SECTIONS`' `personality` and `critical-items`
   entries (`entries.ts`) now seed real, non-empty, fully-editable content (Foundation's existing
   line was kept as-is per the ticket's own note that it was a reasonable candidate). A fresh
   element with every section at its seed default now composes all three labeled blocks, not just
   Foundation's — `DEFAULT_SYSTEM_PROMPT_FALLBACK` stays reachable only when every section is
   disabled/emptied by the user, unchanged.

Both increments stayed UI/data-only as scoped — no new `SettingsSchema` field type, no new
entry-list capability, no live model call. Per-option tooltips and a live model backend remain
explicitly out of scope, as the ticket itself named.

Four new regression tests added to `agent-admin.test.ts` (`UIAgentAdminElement — real models +
real seeded content (TKT-0043)`): the options list is real models (not the old tiers) with the
right default; selecting a non-default model and submitting cites its label, not its id; all
three built-ins seed non-empty content; a fresh element's default composed prompt contains all
three labeled blocks.

Gates: `npm run check` clean · full jsdom suite 331/332 files, 6147/6148 tests green (the one
failure, `theme-provider-build-fixture.test.ts`, is the same pre-existing, unrelated CSS-build
fixture staleness noted in TKT-0041's Findings) · scoped cross-engine browser suite
(`agent-admin`) 16/16 unchanged · `npm run size` — `@agent-ui/app` marginal 63030 B gz, within its
69632 B gz budget.
