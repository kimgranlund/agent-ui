---
doc-type: ticket
id: tkt-0039
status: done
date: 2026-07-13
owner:
kind: feature
size: big
---
# TKT-0039 — Agent Admin UI: live-editable agent instructions with a working preview

## Summary
Kim's ask (2026-07-13, `/feature`): "thoroughly plan out an Agent Admin UI where I can edit all
associated instructions for an agent and use it in real time as I make changes." A side-by-side
layout: `[ settings pane | chat canvas | prompts pane | options pane ]` — editing an agent's
configuration and instructions with a live chat surface that reflects each change immediately, not
a save-then-reload loop.

**Recovery note:** this ticket did not exist when asked for by name — a prior `/feature` invocation
with this exact ask (verbatim, per Kim) produced no persisted trace anywhere in the repo (checked:
`.claude/docs/tickets/`, full git log, git reflog, git stash, all 12 `worktree-agent-*` branches,
the one still-materialized worktree). Whatever ran, Phase 5 (the record write) never landed on
disk. This ticket re-runs the intake from Kim's original ask, captured now.

## Acceptance
- A design intake (system-decompose, both planes) exists before any build starts — this is `size:
  big`, contract-changing (a new `@agent-ui/app` surface), and composes several primitives that
  have never been assembled together before.
- The four-pane layout is realized on the shipped `ui-split` primitive (multi-pane, user-resizable,
  ADR-0120/M4) — not a bespoke layout. Whether all four panes are peers of one `ui-split` or nest
  (e.g. prompts+options grouped) is a design-intake decision, not pinned here.
- Editing any instruction/setting updates the chat canvas's live behavor without a manual
  save/reload step — the specific mechanism (debounced live-apply vs. an explicit "apply" affordance
  within the pane) is a design-intake fork, not pinned here.
- The chat canvas composes the shipped M2 primitives (`ui-conversation` + `ui-surface-host`, ADR-0129)
  rather than re-implementing a chat thread.
- Settings/options composes the shipped `ui-settings` schema-driven framework (M4, TKT-0021) rather
  than hand-rolled form fields, unless the intake finds a concrete gap it can't cover.
- Derive-from-source discipline holds where applicable: nothing here should require a new
  hand-maintained data shape when a shipped descriptor/schema already covers it.

## Links
- [ADR-0120](../adr/0120-app-surfaces-m4-panes-settings.md) — `ui-split`, master-detail, `ui-settings`
  (the panes + settings primitives this composes)
- [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md) — `ui-conversation` +
  `ui-surface-host` (the chat-canvas primitives this composes)
- [ADR-0131](../adr/0131-agent-admin-ui-scope-and-composition.md) *(proposed)* — the three forks
  below, ruled
- `packages/agent-ui/components/src/controls/split/` · `packages/agent-ui/app/src/controls/{settings,master-detail,conversation,surface-host}/`
  (the shipped code this ticket assembles, does not re-invent)
- [TKT-0007](tkt-0007-design-system-surfaces.md) (the M4 intake that shipped panes+settings) ·
  [TKT-0028](tkt-0028-m2-app-surfaces.md) (the M2 intake that shipped the chat-canvas pair)
- `decompositions/agent-admin-ui.decomp-v2.json` (`system-decompose`, coverage clean: 17
  nodes/10 actions/10 hosts/12 edges)

## Scope/Open

### 2026-07-14 — Kim's rulings (ADR-0131 proposed)
- **"An agent" — RULED: (a) a generic, self-contained config** (name, model/provider, system
  prompt/instructions, generation params, tools). The first ruling picked (c) an A2A protocol
  agent; verifying `@agent-ui/a2a`'s consumer barrel found no browser-reachable live channel to a
  real external agent exists today (only an in-process loopback pair; real transports are
  Node-only tooling, walled off by SPEC-N1/N2) — reconsidered back to (a) once that cost was
  visible. (b) Claude Code subagent was never chosen.
- **"Settings pane" vs. "options pane" — RULED: three panes**, `[ chat canvas | prompts pane |
  settings pane ]`. Options folds into settings; no fourth pane.
- **Persistence — RULED: real persistence is in scope**, overruling the seam-only recommendation.
  A concrete store-adapter implementation (e.g. localStorage-backed) is now a named build
  deliverable, not absorbed silently into "wire up the settings pane."
- **Where this lives**: a new `@agent-ui/app` composition (ADR-0131) — chrome tier, same ownership
  ruling as ADR-0120, not a new primitive family.

## Findings

### 2026-07-14 — Built, independently reviewed twice, all real defects fixed
Shipped `ui-agent-admin` (`packages/agent-ui/app/src/controls/agent-admin/`) composing `ui-split`
(M4) + `ui-settings` (M4) + `ui-conversation` (M2) into the three-pane, one-shared-store surface
ADR-0131 ruled. A first `component-reviewer` pass (generator≠critic, fresh context) found real,
non-vacuously-proven defects before this was treated as done:

- **CRITICAL** — persistence didn't survive a reload (the default `createMemoryStore` was
  constructed with no `initial`; the adapter's own localStorage seed loop only checks keys already
  present in `initial`, so `cl.3`'s ruled scope silently never worked). Fixed: a new
  `initialValuesFor(schema)` helper seeds every field's own schema default + the prompt key.
- **MAJOR** — the prompts field→store commit listener was armed once inside the idempotent
  `#compose()` and never re-armed on reconnect (the exact bug class already fixed once for the
  OTHER direction in the same build). Fixed: armed in `connected()` instead.
- **MAJOR** — a native `<textarea>` with no ratified exception to the fleet's law. NOT fixed here —
  recorded as a flagged, unratified build-time deviation (ADR-0131's "Build-time note") and tracked
  as its own follow-up, [TKT-0041](tkt-0041-agent-admin-prompts-pane-native-textarea.md), rather
  than silently absorbed into this ticket's "done."
- **MEDIUM** — the turn loop accepted an out-of-range/unrecognized stored value verbatim from a
  bring-your-own store. Fixed: `sanitizeNumber`/`sanitizeSelect` clamp against the schema's own
  declared bounds, falling back to the field's own schema default.
- **MEDIUM** — ADR-0131's `Status: accepted` contradicted its own `Ratified by` field. Fixed with
  neutral wording that resolves the contradiction without asserting an unconfirmed ratifier/date.
- **MINOR** — an event-boundary leak (the composed `ui-settings`' own `select`/`change` could reach
  a host listener). Fixed with the same `stopPropagation()` guard `settings.ts` already uses for its
  own composed children.

A second, adversarial re-review confirmed every fix against real repros (not just that the new
tests pass) and caught that two of the shipped regression tests were partially vacuous — they'd
have passed against the unfixed code too, since they hand-built the "reloaded" store instead of
letting a genuine second element instance exercise its own lazy-default wiring. Closed with one more
test mounting a real second `<ui-agent-admin>` and reading the reload back through it, plus one
event-boundary regression test. Final verdict: **GO**.

**Gates, all re-verified after every fix round:** `agent-admin.test.ts` 28/28 · cross-engine browser
6/6 (Chromium + WebKit) · `npm run check` clean · full suite 329 files/6059 tests green · `npm run
size`: `@agent-ui/app` marginal 60356 B gz / 69632 B budget (~9.3 KB headroom) · naming-gates +
sitemap + llms.txt + theme-provider-build-fixture + docs-grammar all green (each needed a real
regeneration/registration pass, not just a re-run: `data-role` values `canvas`/`prompts`/`settings`
registered in both `naming.md` §6 and `naming-gates.test.ts`'s `ALLOWED_ROLES`; `adr-index.json`
regenerated via `generate-sitemap.mjs`; `llms-full.txt` regenerated via `generate-llms-full.mjs`;
`llms.txt` gained a row for the new site page; `theme-provider-built.css` fixture regenerated via a
real `vite build`).

**Incidentally discovered, filed separately, deliberately not fixed here:**
[TKT-0040](tkt-0040-form-control-reconnect-setformvalue-crash.md) — a pre-existing latent crash in
the shared `ui-select`/`ui-slider`/`ui-switch` reconnect path (`form.ts:174`), reproduced with 100%
pre-existing shipped code, zero involvement from this build. `defaultAgentConfigSchema` happens to
combine exactly the crashing field-type trio, so shipping this build is what makes TKT-0040 a live
risk (any future reconnect of the settings pane) rather than a latent one — sequencing note added to
that ticket.
