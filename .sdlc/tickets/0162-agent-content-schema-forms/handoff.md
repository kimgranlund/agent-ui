---
id: T-0162
title: "Settings pane forms generated from each content kind's schema, with provenance, diff and reset"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0160, T-0161]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The admin settings pane, the Builder (Co-pilot) and the CLI share one definition of every field: forms render from the T-0160 kind schemas, and each row shows where its value came from with diff and reset.

## Intent
- Do:
  - Derive `ui-settings` `SettingsSchema` sections from the content kind schemas (agent config, entry kinds, surfaces, catalog, fragments) instead of hand-written `agentConfigSchema` and friends; hand-tuned layout stays as optional hints in the schema, not a second list.
  - Provenance per row and entry: seed, pack, imported, Builder, edited; "modified" marker, diff from seed, reset field (uses T-0161).
  - Builder `personaPatch`: emit patch ops validated by the same schema validator; the three-filter apply gate stays, now schema-backed.
  - CLI: `scripts/agent-content.mjs validate | new | add-skill | compile-check` over the content files using the same validator (no new dependency); Builder export writes the same file format so a Builder-made agent can be committed as a seed.
- Non-goals: compiler and traces (T-0163), new settings, visual redesign of the pane.
- Done when: `npm run check` exit 0; a test that every schema field appears in the generated form and no form field lacks a schema field; provenance and reset browser tests both engines; Builder patch rejection test for an invalid op; CLI `validate` exit 0 on the repo and nonzero on a seeded bad file; screenshots of the pane next to today's, viewed; `packages/agent-ui/app/src/controls/agent-admin`, `site/pages/agent-admin-*` tests exit 0; `npm run e2e:admin` exit 0.

## Context
- `ui-settings` already renders from `SettingsSchema` (`agent-admin-schema.ts`). `persona-patch.ts` holds `PERSONA_STATE_KEYS` and the apply gate. Persona file format `agent-ui-persona` v1 in `site/pages/agent-admin-persona-file.ts`.

## Constraints
- Controls take the library ramp (ADR-0245); dogfood lint applies. No em dashes.

## Acceptance criteria
verifier: L3
- [ ] `npm run check` exits 0.
- [ ] `npx vitest run packages/agent-ui/app/src/controls/agent-admin/content-fields.test.ts` exits 0: `PERSONA_STATE_KEYS` equals the pre-T-0162 hand list in order; for every supported model the Agent and Model form fields equal the schema rows the model accepts and every form field has a row; every value key's wrong-typed value is dropped by the Builder gate with no op recorded; an invalid op (unknown key, entry list named in values, malformed entry) drops while a valid one lands with source `builder`.
- [ ] `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/agent-admin/provenance.browser.test.ts` exits 0 in chromium and webkit: the pane's `[data-field]` set equals the pane-homed schema rows; a user edit shows `Edited`, `Modified` and `Seed: "Seed Name"` and Reset returns the seed; a Builder patch reads `Builder`; a library-pack entry reads `Pack` and its Reset removes it; a seed-changed field shows `Seed changed`, `Seed now: "New seed"` and `Take seed`; an import stamps `imported` with no strip.
- [ ] `npx vitest run packages/agent-ui/app/src/controls/agent-admin/agent-overlay.test.ts` exits 0: per-op source recorded (user as no member, builder, pack), kept across a later write and a seed update, an unknown source refused by `parseOverlay`, order-only reset, Take seed reads the new seed.
- [ ] `node scripts/agent-content.mjs validate` exits 0 on the repo.
- [ ] `npx vitest run scripts/agent-content.test.mjs` exits 0: `validate` exits 1 on a seeded bad file naming it; `new`, `new --from` (an exported persona file as a seed folder), `add-skill` and `compile-check` behave as their usage states.
- [ ] `npx vitest run packages/agent-ui/app/src/controls/agent-admin packages/agent-ui/app/src/controls/settings packages/agent-ui/app/src/controls/entry-list site/pages/agent-admin- site/agent-content` exits 0.
- [ ] `npx vitest run --config vitest.browser.config.ts --project site site/pages/agent-admin` exits 0.
- [ ] `npm run e2e:admin` exits 0.
- [ ] Screenshots of the pane before and after, viewed: .sdlc/runtime/tasks/0162-agent-content-schema-forms/screens/ (an unedited pane is byte-identical to today's; an edited one shows the strips).
