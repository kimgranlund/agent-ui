# LLD — the guided agent-authoring flow (S3-a, the agent-authoring family's one full-LLD slice)

> Status: proposed · v0.1 · 2026-08-09 · Layer: LLD (implementation plan)
>
> Refines: [ADR-0178](../adr/0178-agent-authoring-conversational-persona-hydration.md) (ACCEPTED —
> cl.2 the three-filter apply gate, cl.3 the gate seam + admin row, cl.4 model-authored questions,
> cl.5 the no-store-swap try-it contract, cl.6 mechanism-generalizes) ·
> [`agent-authoring-flow.decomp.md`](../decompositions/agent-authoring-flow.decomp.md) §S3 (the S3-a
> leaf this LLD fills; §1 grants S3 "full LLD" — acceptance lives inline here, §13, per doc-tier law) ·
> [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) **§3.2d SPEC-R29/R30** (v0.14,
> MERGED to main @ `8bdb1ef3`, spec Status accepted 2026-08-09 — S3's wire contract; this LLD
> builds against those rows and never re-litigates them) · Kim's rulings on GH
> [#633](https://github.com/kimgranlund/agent-ui/issues/633) (try-it is **DUAL-CONTEXT** — authoring
> pane + test chat coexist over ONE draft persona, no store swap per GH #145) and GH
> [#640](https://github.com/kimgranlund/agent-ui/issues/640) (**`SURFACE_PLANNER_KEY` joins
> `PERSONA_STATE_KEYS` in this slice** — the omission is a GAP, pre-persona-file drift; one-line fix +
> an export/import round-trip test matching the authoring key's).
> Author: planner (design seat). No new ADR: every ruling below lands inside ADR-0178's grant; a
> contradiction found at build is an ESCALATION (a coordinated LLD/ADR repair), never a silent edit.
>
> **Composes on (every API verified against shipped source, not summaries):**
> `agent-admin.ts` (`#handleSubmit`/`#runSurfaceTurn`'s fresh-read request builds; the GH #145
> store-reassignment reset + `#conversationEpoch`; `#rewireAllSections`' per-kind store subscriptions;
> `#rewireContext`'s subscription; the GH #63 deferred-client-turn + error budget) ·
> `agent-admin-schema.ts` @ S2 (`SURFACE_AUTHORING_KEY`/`isAuthoringSurfaceEnabled`,
> `AdminSurfaceTurnEvent` 4 kinds, `AdminSurfaceTurnRequest`, the sanitizer family) ·
> `admin-live-runner.ts` (the ONE `readMetaLine` peel, `createAdminSurfaceTurn`'s closure `Session`,
> the absent-⇒-omit-key POST-body precedent) · `meta-line.ts`/`produce.ts`/`system-prompt.ts` @ S2
> (`PersonaPatch`, gate-blind passthrough, `ProduceOptions.authoringSurface` → `authoringBlock`) ·
> `chat-validation.ts` (`validateA2uiEnabled`, the server-side fail-closed validator shape) ·
> `dev-proxy-plugin.ts` + `worker/index.ts` (the `...(x !== undefined ? { x } : {})` ProduceOptions
> threading) · `agent-admin-persona-file.ts` (`PERSONA_STATE_KEYS`, `readPersonaState`,
> `mintBlankPersona`) · `agent-admin-presets.ts` (`AgentPreset`/`presetSeed`/`personaStore`) ·
> `agent-admin-app.ts` (S1's `NEW_AGENT_ACTIONS` extensible entry + `createBlankAgent`, PR #639) ·
> `entry-list/entry-data.ts` (`validateNewEntry`, `NewEntryInput`) · `settings.ts` (TKT-0021 —
> every generated field holds its own `store.subscribe`; external writes reflect live).
>
> **Freeze discipline.** §9 is the fan-out contract for the builder seat — a builder who finds a seam
> unworkable STOPS and escalates, never improvises past this document. If SPEC-R29/R30 are later
> amended out from under this LLD, that is the same escalation. S3-b builds on a main-rebased
> branch (this LLD was authored on a pre-S2 worktree; the merged rows verified zero-drift).

## 1 · Intent

The admin half of GH #633's generate path: a user picks **"New agent → Generate"**, describes the
agent to a host-authored **Builder** persona over multi-turn chat, and watches the draft persona's
schema hydrate live in the settings panes as the model's `personaPatch` declarations (SPEC-R29) are
applied HOST-side through ADR-0178 cl.2's three-filter gate — while remaining free to hand-edit the
same draft concurrently. A **try-it** flip (anatomy designed here, built in S4) switches the chat
between the Builder interview and a live test chat of the draft itself — two transcripts, ONE draft
store, zero store-identity swaps. Also landed here: the runner's peel of the new arm into a typed
event, the gate's Surface Options row (dimmed-while-off law), the `SURFACE_PLANNER_KEY`
persona-file gap fix (Kim's #640 ruling), and the server-side threading of the per-turn authoring
flag that S2 deliberately left to this slice.

## 2 · Fork sheet (every row decided; WHY one line each)

| Row | Ruling | Why |
|---|---|---|
| **Apply-gate home** | New app-package module `packages/agent-ui/app/src/controls/agent-admin/persona-patch.ts`; the COMPONENT invokes it (cl.2: "the component, never the model, never the runner"). | The gate needs the enumerated key set + every per-key sanitizer + `validateNewEntry` — all app-package residents — and the DAG forbids the component importing site code. Pure module (store-in, writes, report-out) ⇒ directly unit-probeable. |
| **Canonical key set** | `PERSONA_STATE_KEYS` HOISTS into `persona-patch.ts` (plus derived `PERSONA_VALUE_KEYS` / `PERSONA_ENTRY_LIST_KEYS` views); `site/pages/agent-admin-persona-file.ts` deletes its local construction and re-exports the hoisted set (import via a new `@agent-ui/app/agent-admin-persona-patch` subpath, the `agent-admin-schema` precedent). **`SURFACE_PLANNER_KEY` joins the set here** (the #640 ruled fix). | One source of truth or the file format and the apply gate drift apart — the exact silent-divergence class GH #406 closed. The set describes COMPONENT state (`composeLiveSystemPrompt`'s input); the site file format is its consumer, and site→app imports are the DAG's normal direction. Existing site importers keep their symbol via re-export. |
| **Value admission rule** | Per-key ADMISSION predicates (a table in `persona-patch.ts`), built as **fixpoint checks over the shipped fail-closed readers**: a proposed value is admitted iff that key's own sanitizer/reader returns it UNCHANGED (`sanitizeModel(v, roster) === v`, `sanitizeCatalog(v) === v`, `typeof v === 'boolean'` for every switch, …). Rejected ⇒ dropped, never coerced. | The shipped sanitizers COERCE to defaults (read-time law); an apply gate that coerced would write model garbage as a silent default — a wrong-but-valid-looking store. Fixpoint admission reuses each sanitizer's judgment without inventing a second validation vocabulary. A drop is a degrade (cl.2), recorded on the turn log, never an error surface. |
| **Dual-context anatomy** ⚠️ **"mounts lazily" SUPERSEDED 2026-08-10 (GH #666, Kim's pixel ruling) — the authoring conversation mounts at `#compose()` time and IS the unarmed Author column; the two-instance mechanism this row exists to state is unchanged (see §5's override note)** | **Two mounted `UIConversationElement` instances** (OQ3's recommendation, Kim-pre-ruled dual-context): the shipped `#conversation` stays the TEST context byte-unchanged; an AUTHORING conversation mounts lazily beside it inside a `data-part="chat-stack"` wrapper composed at `#compose()` time. Mode picks visibility (`hidden`); both keep their DOM transcripts. | No transcript serialization/restore machinery to invent (the snapshot alternative ADR-0178 OF2 named); GH #145 honored by construction — `admin.store` is never reassigned by a flip, only WHICH conversation drives the next turn changes (cl.5 verbatim). |
| **The second-store seam** | New component prop `authoringStore` (`prop.json<SettingsStore \| undefined>`, `attribute: false` — `store`'s own shape). Set ⇒ the authoring flow is ACTIVE: authoring turns compose from THIS store; patches apply to `this.store` (the draft). Cleared ⇒ authoring context tears down. | "Authoring runs the Builder persona … patches applied to the draft" (cl.5) needs a second composition source; a prop is the component's one configuration idiom. The prop seam still serves cl.6 (S5 can arm `authoringStore` however its intake rules), but per Kim's §15 ruling the apply loop no longer generalizes silently — consumption is fenced to the authoring context, and S5's intake owns its own consumption-path ruling (§14). |
| **Session isolation** | `AdminSurfaceTurnRequest` gains `session?: 'authoring' \| 'test'` (absent = `'test'`, byte-compat); `createAdminSurfaceTurn` keeps a `Map<string, Session>` keyed by it instead of one closure `Session`. | The Builder interview and the draft's test chat are different agents' histories — one shared producer session would feed the interview to the draft as its own memory (identity confusion). Per-persona re-arming (`armSurfaceTurn`) still resets both at once, unchanged. |
| **Gate threading (the S2 leftover)** | `AdminSurfaceTurnRequest` gains `authoring?: boolean` (fresh gate read from the DRIVING store at request build); runner POST body `...(req.authoring !== undefined ? { authoring: req.authoring } : {})`; `chat-validation.ts` gains `validateAuthoringSurface` (the `validateA2uiEnabled` shape); `dev-proxy-plugin.ts` + `worker/index.ts` thread it into `ProduceOptions.authoringSurface`. | SPEC-R30: the gate reaches the producer PER CALL on the same seam `genui`/`a2ui` ride. S2 built the produce/prompt half; nothing yet carries the flag across the wire — without this, gate-ON teaching never composes. Absent ⇒ key omitted ⇒ POST body byte-identical (the standing precedent). |
| **Patch event** | `AdminSurfaceTurnEvent` gains `\| { kind: 'patch'; patch: PersonaPatch }` (type-only import from `@agent-ui/a2ui/agent/meta-line` — the `TurnProgress` precedent, SPEC-N1-safe); the runner peels `meta.a2uiMeta.personaPatch` into it, GATE-BLIND (consumption is the component's). | The runner owns the peel, the component consumes typed events — the shipped division (ADR-0178 cl.3). The runner checking the gate would be a second enforcement point that can drift from the component's (#640 handoff: "the apply loop must check the gate itself"). |
| **Consumption condition** | **RULED (Kim, 2026-08-09, host AskUserQuestion round — §15 option (b)):** the apply loop consumes a patch iff the turn's driving store IS `authoringStore` (the store-identity fence) AND `isAuthoringSurfaceEnabled(drivingStore.get(SURFACE_AUTHORING_KEY))` reads ON at receipt (fresh read — CONJUNCTIVE; the fence never replaces the gate). Apply target is ALWAYS `this.store`. | SPEC-R30's degrade law host-side, narrowed by Kim's ruling: a volunteered patch on ANY turn outside the dedicated authoring context — test chats included, even gate-ON — is never consumed. Capability 4's consumption path is therefore deliberately blocked until S5's own ruling (§14/§15). |
| **Builder persona home + visibility** | A module-local preset in `agent-admin-presets.ts`, exported as `builderPersona()`/`builderStore()` — **NOT in `AGENT_PRESETS`/`personaRoster()`** (hidden-until-invoked, ADR-0178 OF4's recommendation adopted as default; §15 open item). Its store is a FRESH `createMemoryStore({ initial: seed })` per flow entry, **no `persistKey`**. | The showcase roster stays a showcase; nothing user-editable reaches the Builder, so persisting it could only accumulate drift against host-authored config. Reversal (roster-visible) is a one-line array membership change — cheap either way, so the default takes the conservative arm. |
| **Interview craft = CONFIG; key vocabulary = generated CONFIG** | The Builder's interview craft ships as seed prompt-section entries (persona content). The PATCHABLE-KEY VOCABULARY section is **composed at `builderStore()` mint time from `persona-patch.ts`'s canonical exports** (keys + expected value shapes + entry kinds), never hand-listed. The ARM MECHANICS stay exactly where S2 put them (`authoring-teaching.md`, host-owned, byte-pinned — cl.1 rule 5); Builder copy never restates wire mechanics. | SPEC-R29 makes the producer persona-key-AGNOSTIC, so the key vocabulary can only reach the model from the host side — and a generated section cannot drift from the apply gate's own allowlist. The rule-5 boundary holds because garbled vocabulary degrades to dropped keys (filter i, fail-closed, recoverable), whereas garbled MECHANICS would be unrecoverable — which is why mechanics stay in the byte-pinned prompt file and vocabulary may be config. |
| **Draft-state feedback** | Each authoring turn's `personaSystem` = the Builder's `composeLiveSystemPrompt(...)` + a host-composed **draft-state block**: `readPersonaState(this.store)` (the hoisted canonical projection) serialized fresh per turn. | "Steering toward completion" (decomp a4/a5) requires the interviewer to see what is established vs missing — including the user's CONCURRENT hand-edits, which is the whole reason SPEC-R29's merge law is incremental. Fresh-read per turn is the standing live-apply law. |
| **IA entry** | `NEW_AGENT_ACTIONS` (agent-admin-app.ts, S1's extensible array) gains `{ value: 'new-agent-generate', label: 'New agent → Generate', … }` → `createGeneratedAgent()`: mint the blank draft (S1's `createBlankAgent` seed + `mintBlankPersona`, verbatim reuse) → register + `applyPersona(draft)` → `admin.authoringStore = builderStore()`. `applyPersona()` CLEARS `authoringStore` first-thing on every call (one choke point), so switching personas always exits the flow. | The decomp's S1→S3 edge by design: one mint path, one menu, blank-first. Order matters: the store reassignment fires the GH #145 reset BEFORE the authoring context arms, so the flow always opens clean. |
| **Gate's admin row** | Surface Options gains an **Authoring** row (writes `SURFACE_AUTHORING_KEY`), appended after the Planner row, its exact `surfaceRow` shape + dimmed-while-off law (ADR-0170 cl.5). | ADR-0178 cl.3 books it; it is also cl.6's future entry point. Zero new row machinery — the Planner row is the template. |
| **Try-it toggle anatomy** (S4 builds) | **PIXEL-TRUTH OVERRIDE (Kim, 2026-08-09, GH #646 reopen comment: https://github.com/kimgranlund/agent-ui/issues/646):** a `data-part="try-it"` bar atop the chat stack, visible only while `authoringStore` is set — the fleet `ui-tabs` control (Authoring/Try it as `ui-tab`s, panel-less, the SAME composition shape `#applySegments`/`#buildNarrowTabs`'s own section-tab strips use, GH #221), `.selected` synced by `#applyMode`, calling `#setMode(...)` on the control's `select` commit. Originally built (S4-a, still the row below) as two `ui-button`s with managed `aria-pressed` — Kim's live-surface pass ruled that anatomy wrong: the flip reads as the SAME underline-tab idiom the admin's own section strip already uses, not a pill-button pair. No new host events either way (`#setMode` is internal; the closed event set is untouched). Two live-surface follow-ups landed in the same change: (a) the strip's own `border-block-end` was retracted (doubled a hairline `ui-tabs`' own tablist part already paints); (b) the strip's inline inset was matched to the admin's section-tab strip — which surfaced a THIRD, cross-cutting fact: at narrow width the visible strip is `narrow-tabs` (`chat-shell.css`, GH #575/#626), whose `--ui-bar-inline-inset` role presumed a header to track that `ui-agent-admin` has never composed (super-shell.css's own GH #380 note already recorded this). `chat-shell.css` gained a header-presence split (`:has(> [data-bar='header'])`) so a header-bearing shell still tracks the header (byte-identical, GH #575/#626's law unchanged) while a headerless one — today, only `ui-agent-admin` — falls back to the shell's own generic module-scaled rhythm instead, matching the try-it strip below it. | Smallest fleet-native affordance for a two-state visibility flip; S4 refines visuals against the geometry law without re-opening this contract. The override corrects which SHIPPED idiom "smallest fleet-native affordance" resolves to — a `ui-tabs` composition was already this file's own precedent one paragraph up. |
| **Events / catalog / naming** | No new host events, no new `ui-*` element, no catalog change, no new tokens beyond the try-it bar's page… component-local CSS. | The slice composes shipped primitives (ADR-0178 Consequences: "almost entirely reuse"). |

> **Repair — 2026-08-10 (GH #653 item 1, S4-a):** [ADR-0179](../adr/0179-agent-admin-three-pane-ia.md)
> retired the **dual-context/try-it row's own VEHICLE** — the try-it toggle bar row above (and the
> "dual-context anatomy" row's `chat-stack` wrapper) — replacing the `Authoring ⇄ Try it` bar with
> place-based navigation (`[ Chat | Author | Settings ]`) over the same dual-conversation mechanism.
> The mechanism these rows describe (two mounted `UIConversationElement` instances, no store swap, GH
> #145 honored by construction) stands byte-untouched; only the toggle's PLACEMENT and control shape
> are superseded. See [`admin-three-pane-ia.lld.md`](./admin-three-pane-ia.lld.md) §2/§4/§7 for the
> realized replacement (`#pane`/`#setPane`/`setPaneSeam`, the pane-nav `ui-tabs`) and its retirement
> map for exactly which symbols these rows named (`#mode`/`#setMode`/`#applyMode`/`setModeSeam`/
> `#tryItBar`) are gone.

## 3 · The three-filter apply chain (ADR-0178 cl.2, realized)

`persona-patch.ts` exports:

- `PERSONA_STATE_KEYS` — the canonical ordered set (hoisted; now including `SURFACE_PLANNER_KEY`
  and S2's `SURFACE_AUTHORING_KEY`). `PERSONA_ENTRY_LIST_KEYS` = the six `entriesStoreKey(kind)`
  members; `PERSONA_VALUE_KEYS` = the rest.
- `applyPersonaPatch(store, patch, deps): PatchReport` where `deps = { models: readonly
  SupportedModel[], schema: SettingsSchema }` (the component passes `modelRoster()` +
  `this.schema ?? defaultAgentConfigSchema` — the same inputs its own reads use) and
  `PatchReport = { applied: string[]; added: Record<string, number>; dropped: string[] }`.

The chain, in order, fail-closed at every step (a drop removes the item, never the patch, never the
turn):

1. **Enumerated-key filter.** `patch.values` keys must be ∈ `PERSONA_VALUE_KEYS`; `patch.entries`
   keys must be ∈ `PERSONA_ENTRY_LIST_KEYS`. A `values` key naming an entry list (or vice versa) is
   wrong INTENT (SPEC-R29's two-member rationale) and drops. Unknown keys drop silently — the
   `readPersonaState` filters-both-ways law.
2. **Per-key admission (values).** The fixpoint table (§2): `name` → any string; every switch key
   (`AGENT_ENABLED_KEY`, the six `kindEnabledKey(...)`, `SURFACE_MARKDOWN_KEY`, `SURFACE_A2UI_KEY`,
   `SURFACE_GENUI_KEY`, `SURFACE_GENUI_DOGFOOD_KEY`, `SURFACE_PLANNER_KEY`,
   `SURFACE_AUTHORING_KEY`, `BANKROLL_CAPABLE_KEY`) → literal boolean; `model` →
   `sanitizeModel(v, deps.models) === v`; `temperature` → number ∧
   `sanitizeNumber(deps.schema, 'temperature', v, NaN) === v`; `A2UI_CATALOG_KEY` →
   `sanitizeCatalog(v) === v`; `A2UI_LOCAL_PATTERNS_KEY` → `sanitizeLocalPatterns(v) === v`;
   `BANKROLL_KEY` → `sanitizeBankroll(v) === v`; `MODELS_INCLUDED_KEY` → plain object, all values
   boolean. Admitted ⇒ `store.set(key, v)` — whole-value, last-writer-wins (SPEC-R29's pinned merge
   law; the store write IS that semantics).
3. **`validateNewEntry` (entries).** Per list: reverse-map the store key to its kind; each member
   must be a plain object with string `label` (`description`/`content`/`id` admitted as strings,
   defaulting `''`/absent) → projected to `NewEntryInput` → through
   `validateNewEntry(current, kind, input, { rejectOnCollision: kind === ENTRY_KINDS.catalog })` —
   the IDENTICAL options the pane's own add path passes (agent-admin.ts:967). Admitted entries
   APPEND; one `store.set(entriesStoreKey(kind), [...current, ...admitted])` per kind (one write =
   one pane re-render). Never a replacement, never a removal — SPEC-R29's no-deletion law is
   satisfied structurally (this code path has no delete branch to misuse).

The report rides the turn log (`#logTurn`'s surface record gains `patch: PatchReport` when a patch
was consumed, and `patchIgnored: true` when one arrived gate-off) — observability without an error
surface, cl.2's degrade posture.

**Invocation** (agent-admin.ts, `#runSurfaceTurn`'s event loop): `else if (event.kind === 'patch')`
→ consumed iff the turn's driving store IS `authoringStore` AND the fresh gate read is ON (Kim's
§15 option-(b) ruling — conjunctive) ⇒ `applyPersonaPatch(this.store, event.patch, …)`; any other
turn ⇒ log-only (`patchIgnored`). Applied mid-stream, so hydration is visible while the turn is
still streaming. The `store` reference is the one captured at turn start — the bankroll mirror's exact
posture (§10).

## 4 · Wire + runner widening (the S3 half of the SPEC-R29/R30 realization)

- `agent-admin-schema.ts`: `AdminSurfaceTurnEvent` += `{ kind: 'patch'; patch: PersonaPatch }`
  (type-only import, SPEC-N1-safe); `AdminSurfaceTurnRequest` += `authoring?: boolean` +
  `session?: 'authoring' | 'test'` (both optional, absent = today's behavior byte-for-byte).
- `admin-live-runner.ts`: the ONE peel gains one arm —
  `if (meta.a2uiMeta.personaPatch) yield { kind: 'patch', patch: meta.a2uiMeta.personaPatch }` —
  beside the `note`/`progress` arms; POST body gains the conditional `authoring` key;
  `createAdminSurfaceTurn` swaps its closure `Session` for a `Map` keyed by `req.session ?? 'test'`
  (append-after-stream unchanged, per session).
- `chat-validation.ts`: `validateAuthoringSurface(value: unknown): boolean | undefined` — the
  `validateA2uiEnabled` shape (fail-closed; non-boolean ⇒ `undefined` ⇒ `produce()` composes zero
  teaching bytes, since `authoringBlock` requires literal `true`).
- `dev-proxy-plugin.ts` + `worker/index.ts`: parse `authoring` from the body →
  `...(authoringSurface !== undefined ? { authoringSurface } : {})` in the `produce()` opts — the
  `a2uiEnabled` line's twin, both hosts. **No new prompt `.md` in this slice** ⇒ no
  `fs-shim-content.ts` edit (the #640 trap does not fire here; stated so its absence is not read as
  an omission).

## 5 · Dual-context anatomy (ADR-0178 cl.5 + Kim's #633 pre-ruling, realized)

- **DOM.** `#compose()` wraps the content slot: `div[data-part="chat-stack"][data-slot="content"]`
  hosting `[ try-it bar (hidden) | authoring conversation (lazy) | #conversation (test — today's
  instance, untouched) ]`. The authoring `UIConversationElement` is created on the first
  `authoringStore` assignment: `receipt`/`sources` like the test one, its `onSubmit`/
  `onClientMessage`/`onModelChange` wired to the authoring context (below).
  **PIXEL-TRUTH OVERRIDE (Kim, 2026-08-10, GH #666 reopen — "the center pane should be a CHAT, just
  like Test chat"):** the LAZY half of that sentence is retired. The authoring conversation is now
  created at `#compose()` time and IS the unarmed Author column (its log carries the empty-state
  copy via `ui-conversation.setEmptyState`, its own composer is the flow's entry, and arming fills
  the same element). Everything else in this section — the wiring, the dual-context mechanism, the
  reset law, the fence — is unchanged; laziness was a cost argument, and the ruling is a shape one.
- **Mode.** `#mode: 'authoring' | 'test'` — component state, meaningful only while
  `authoringStore` is set; entry default `'authoring'`. `#setMode()` flips `hidden` + the bar's
  selection — nothing else: no store touch, no reset, no serialization. Both transcripts
  survive by never unmounting (the round-trip acceptance). **PIXEL-TRUTH OVERRIDE (Kim, 2026-08-09,
  GH #646 reopen: https://github.com/kimgranlund/agent-ui/issues/646):** the bar's own affordance
  is the fleet `ui-tabs` control (`.selected` synced, not `aria-pressed`) — see the row-74 table
  entry for the full anatomy record; this bullet's "the bar's" language now names that control.
- **Context routing.** One helper, `#contextFor(): { store, conversation, session }` — authoring ⇒
  `{ authoringStore, authoring conversation, 'authoring' }`, else `{ this.store, #conversation,
  'test' }`. `#handleSubmit` and `#runSurfaceTurn` parameterize their store reads (master switch,
  modality gates, model, catalogId, integrations, persona composition) and their `beginAgentTurn`
  target on it. The TEST context resolves to exactly today's values — the zero-regression
  invariant, asserted (§12). The authoring request additionally carries
  `authoring: isAuthoringSurfaceEnabled(drivingStore.get(SURFACE_AUTHORING_KEY))` (fresh read) and
  the §2 draft-state block appended to `personaSystem`.
- **Reset law (GH #145, extended).** A real `store` reassignment resets BOTH transcripts (the
  authoring conversation joins `#resetConversationState()`'s clears) — both belong to the draft.
  An `authoringStore` identity change tears down/rebuilds only the authoring context. The page's
  `applyPersona` clears `authoringStore` before swapping `store`, so the ordering is
  deterministic: exit flow → reset → (optionally) re-enter.
- **Degrade.** `agentSurfaceTurn` unarmed (static build/stub): the authoring context still mounts;
  submits run the prose/stub arm against the Builder's config; no patch ever arrives; panes simply
  don't hydrate. No special-casing — the same degrade every persona has.

> **Repair — 2026-08-10 (GH #653 item 1, S4-a):** placement superseded by
> [ADR-0179](../adr/0179-agent-admin-three-pane-ia.md) cl.1/cl.2 and realized in
> [`admin-three-pane-ia.lld.md`](./admin-three-pane-ia.lld.md) §3/§4 — read this section's
> **mechanism** as still true (two mounted conversations, the reset law, the degrade posture) and its
> **DOM/Mode bullets** as historical: `chat-stack` is `pane-holder` now, `#mode`/`#setMode` is
> `#pane`/`#setPane` (a one-token `#contextFor` selector diff, everything below it byte-identical),
> and the try-it bar is the pane-nav `ui-tabs` in the shell's `header` slot. The Context-routing
> bullet's `#contextFor` shape is what the new LLD's §4 freezes and re-keys; nothing about the
> apply-chain (§3/§4 above) or the Builder persona (§6 below) changed.

## 6 · The Builder persona (ADR-0178 cl.4)

Seed (config, in `agent-admin-presets.ts`'s module-local preset): `name: 'Builder'`;
`model`: a SONNET-class `SUPPORTED_MODELS` id (recommendation — interview quality over cost; exact
id picked at build against the shipped roster; §15); `temperature` moderate (0.5);
`SURFACE_AUTHORING_KEY: true` (the point); `SURFACE_A2UI_KEY: true` (ask surfaces render as
ordinary A2UI content via `ingestLine` — ADR-0097's shipped machinery, ZERO new question
mechanics); GenUI/dogfood/planner unseeded (inverse-default OFF); prompt sections = the interview
craft (what a complete persona needs: name, model, temperament, capabilities, surface modalities;
ask before assuming; one topic per turn; send only what THIS turn established) + the GENERATED
key-vocabulary section (§2 fork row). Boundary, restated from the fork sheet because it is the
clause most at risk of drift: Builder copy teaches INTERVIEW BEHAVIOR and the key VOCABULARY, never
the `personaPatch` wire mechanics — those compose from S2's byte-pinned `authoring-teaching.md`
under the gate, and `prompt-lint.ts`'s existing discipline applies to the seeded sections.

## 7 · Live-hydrating panes — cited, not redesigned

Every `applyPersonaPatch` write lands on a key class with a SHIPPED live listener:
config fields (`name`/`model`/`temperature`) → `ui-settings`' per-field `store.subscribe`
(settings.ts, TKT-0021) + the model grid's `#modelGridUnsub`; master switches + Surface Options +
Context System → `#rewireContext`'s subscription (`#applyMasterStates` + `#renderContextSystem`);
entry lists → `#rewireAllSections`' per-kind subscriptions. This LLD adds NO re-render machinery —
the store-write re-render law is the shipped substrate (ADR-0178 cl.2: "live hydration falls out
for free"); §12's panes-proof test EXERCISES it end-to-end rather than trusting the citation.

## 8 · Error / edge handling

- **Malformed patch:** never reaches the component — `readMetaLine` drops the arm whole
  (SPEC-R29); the event simply doesn't exist.
- **Patch outside the authoring context or while the gate is off** (any ordinary chat, test mode
  included — even a gate-ON persona's volunteered patch): logged `patchIgnored`, zero writes —
  SPEC-R30's degrade law plus Kim's §15 store-identity fence, host-enforced (§3).
- **Every-key-dropped patch:** an empty report, logged; no error surface (cl.2's degrade posture).
- **Mid-turn persona switch:** the epoch guard already abandons pre-stream; mid-stream, writes go
  to the captured draft store — persisted per persona, harmless to the new active persona (the
  bankroll mirror's shipped posture, cited not re-derived).
- **PROSE-arm dual context (GH #644, S3-b review MINOR 3):** the plain-chat arm's live request
  (`AdminTurnRequest.history`, LLD-C6's `#handleSubmit`) is per-context too, exactly like §4's
  `session`-keyed `Session` map the SURFACE arm's runner already keeps — the component holds
  `#history` (test) and `#authoringHistory` (authoring) as two separate arrays, and `#contextFor()`
  picks between them the same way it already picks `store`/`conversation`/`session`. This closes the
  gap the degrade config (`agentTurn` live, `agentSurfaceTurn` unarmed or its structured modalities
  off) exposed: without it, both contexts appended onto one shared array, so the Builder interview
  and the draft's own test chat fed each other's transcript into the model as prior turns — the
  identity confusion §4's per-context `Session` map exists to prevent, reopened on the arm that
  forwards `history` as a plain array rather than a `session` key. Reset law: a real persona switch
  (`#resetConversationState`, GH #145) clears both arrays; a real `authoringStore` identity change
  (`#rewireAuthoringContext`) clears `#authoringHistory` alone — the draft's own test-chat memory is
  untouched, matching the transcript reset it already sits beside.
- **`name` patched ≠ roster label:** the roster row keeps its minted label — the SAME divergence a
  hand-edited `name` field already has today (shipped behavior, not a new gap; §15).
- **Draft deleted/never completed:** nothing to clean — the draft is an ordinary imported-class
  persona (S1), and abandoning it leaves an ordinary roster row, exportable or ignorable.

## 9 · Components (build slices — one writer per file; [S3-b] unless tagged [S4-a])

| ID | Component | File(s) |
|---|---|---|
| **LLD-C1** | `persona-patch.ts` — canonical `PERSONA_STATE_KEYS` (hoist + `SURFACE_PLANNER_KEY` fix) + derived key views + the admission table + `applyPersonaPatch` + `readPersonaState`/draft-state-block projection (hoisted alongside the keys); package.json `@agent-ui/app/agent-admin-persona-patch` subpath. | `app/src/controls/agent-admin/persona-patch.ts` + `app/package.json` |
| **LLD-C2** | Site persona-file re-point: local key-set construction deleted, hoisted set imported/re-exported; header comment repaired (the stale-context law). | `site/pages/agent-admin-persona-file.ts` |
| **LLD-C3** | Schema widening — the `patch` event kind + `authoring`/`session` request fields (§4). | `app/src/controls/agent-admin/agent-admin-schema.ts` |
| **LLD-C4** | Runner widening — patch peel arm, conditional `authoring` POST key, session map (§4). | `site/lib/admin-live-runner.ts` |
| **LLD-C5** | Server threading — `validateAuthoringSurface` + both hosts' ProduceOptions line (§4). | `a2ui/tools/agent/chat-validation.ts` · `dev-proxy-plugin.ts` · `worker/index.ts` |
| **LLD-C6** | Component: `authoringStore` prop + chat-stack wrapper + the authoring conversation *(shipped lazy; mounted at compose since GH #666, 2026-08-10 — §5)* + `#mode`/`#contextFor` parameterization of both turn arms + the apply loop (§3 invocation) + reset-law extension + turn-log widening + the Surface Options Authoring row (Planner-row template, ADR-0170 cl.5). | `app/src/controls/agent-admin/agent-admin.ts` (+ `agent-admin.css`, `agent-admin.md` prop/anatomy doc rows) |
| **LLD-C7** | Builder persona — module-local preset + `builderPersona()`/`builderStore()` (fresh memory store, no persistKey) + the generated vocabulary section. | `site/pages/agent-admin-presets.ts` |
| **LLD-C8** | IA entry — `NEW_AGENT_ACTIONS` row + `createGeneratedAgent()` + `applyPersona` clearing `authoringStore` (§2 fork row). | `site/pages/agent-admin-app.ts` |
| **LLD-C9** [S4-a] | The try-it bar + `#setMode` flip, built to §5's frozen anatomy; the round-trip proof. | `agent-admin.ts`/`agent-admin.css` (S4's own sub-issue) |

## 10 · Non-goals

- **NL-edit entry affordance + destructive-edit safety** — S5, deferred (ADR-0178 cl.6); the seam
  ships (gate row + the apply machinery), the capability's UX does not — and consumption stays
  FENCED to the authoring context per Kim's §15 option-(b) ruling, so S5's intake also owns its
  own consumption-path ruling (§14).
- **A `RecordedTurn` patch analogue** — SPEC-R29 Scope fences it out (no consumer).
- **Ask-arm peel/event** — asks ride A2UI surfaces via `ingestLine` already; the `ask` declaration
  field stays unconsumed in admin (as today).
- **Roster-label sync with a patched `name`** — shipped divergence, untouched (§8/§15).
- **Any deletion semantics in a patch** — SPEC-R29's law; structurally absent (§3.3).
- **New host events, elements, catalog rows, or a2ui-package persona knowledge.**

## 11 · Test plan (per step; all gates judged by EXIT CODE)

- **LLD-C1 (jsdom):** admission table row-by-row (each key family: admit/coerce-reject/garbage);
  wrong-intent member drop; unknown-key drop; entries via `validateNewEntry` incl. catalog
  `rejectOnCollision` + dedup-suffix parity with the pane; merge law (second patch overwrites value
  keys, appends entries, absent keys untouched); report correctness. **Planner-key round-trip:**
  export/import carries `SURFACE_PLANNER_KEY` both ways — the exact shape of S2's
  `SURFACE_AUTHORING_KEY` test (`agent-admin-persona-file.test.ts`), per Kim's #640 ruling.
- **LLD-C2:** existing persona-file suite stays green untouched (the hoist is behavior-neutral by
  construction — same ordered set).
- **LLD-C4 (site vitest project):** peel test — a meta-line carrying `{note, personaPatch}` yields
  both events; gate-blind (no `authoring` in the request still yields the patch event); session
  isolation — two turns with different `session` values build disjoint histories; POST body omits
  `authoring` when absent (byte-compat assert).
- **LLD-C5:** `validateAuthoringSurface` unit (the `validateA2uiEnabled` matrix); threading assert
  in each host's existing request-shaping tests.
- **LLD-C6 (jsdom, `agent-admin.test.ts`):** apply loop consumes only in the authoring context
  with the gate ON — BOTH exclusion polarities probed (gate-OFF inside the authoring context, and
  gate-ON OUTSIDE it), each logging `patchIgnored` with zero writes; **panes proof** — after a scripted patch turn, the settings field
  /entry section DOM reflects the written values (exercising §7's cited law end-to-end);
  dual-context — `admin.store` reference IDENTICAL across mode flips + both transcripts' DOM
  intact (GH #145's probe inverted); reset law — store reassignment clears both; test-context
  requests byte-match today's shape (zero-regression assert); Authoring row present + dimmed law.
- **LLD-C7/C8:** Builder store seeds gate ON + A2UI ON; vocabulary section contains EVERY
  `PERSONA_VALUE_KEYS`/entry-kind member (the drift trip-wire); `createGeneratedAgent` mints +
  activates + arms `authoringStore`; `applyPersona` clears it.
- **Browser (`agent-admin.browser.test.ts` — existing shards, never a new one):** the flow smoke —
  a scripted surface runner emits a patch turn; panes hydrate live; [S4-a] the flip round-trips
  both transcripts.
- **Gates:** `npm run check && npm test` FOREGROUND, then the affected `test:browser` shards —
  exit codes only.

## 12 · Acceptance (inline — the decomp granted no separate SPEC for S3)

1. §3's chain holds under unit probes: only enumerated keys, only admission-passing values, only
   `validateNewEntry`-admitted entries reach the store; drops degrade (report + log), never error.
2. A volunteered patch is consumed ONLY on an authoring-context turn (driving store ===
   `authoringStore`) whose gate reads ON at receipt — fence and gate polarities each asserted
   (SPEC-R30's degrade law + Kim's §15 option-(b) ruling, host-side).
3. `SURFACE_PLANNER_KEY` round-trips the persona file both directions (the #640 fix, tested).
4. Authoring flips never reassign `admin.store` (reference-equality asserted) and both transcripts
   survive a flip cycle; a REAL persona switch still resets (GH #145 both ways).
5. The test context's request build is byte-identical to pre-slice behavior when the flow is
   inactive (`authoringStore` unset) — the zero-regression assert.
6. A live/mock multi-turn conversation demonstrably hydrates the draft's panes while the user can
   hand-edit concurrently (the browser smoke; GH #633's own acceptance line).
7. `npm run check && npm test` + affected browser shards green by exit code; the doc-checker seat
   ratifies this LLD before S3-b dispatches.

## 13 · Build sequence (ordered; a builder follows it top-down)

1. **LLD-C1 + LLD-C2** — the hoist + planner-key fix + apply gate + their unit tests (incl. the
   round-trip test). Pure, dependency-free of everything below; unblocks the site re-point
   immediately.
2. **LLD-C3 + LLD-C5** — schema widening + server threading + tests (types first so every
   consumer below compiles against them).
3. **LLD-C4** — runner peel/POST/session map + site tests.
4. **LLD-C6** — the component: prop, dual-context scaffold, context parameterization, apply loop,
   reset extension, Authoring row, log widening + the jsdom suite (§11's C6 block).
5. **LLD-C7 + LLD-C8** — Builder preset + vocabulary generation + IA entry + page tests.
6. **Panes proof + browser smoke**; full gates (§11 last bullet); `agent-admin.md` doc rows;
   tick the matching ADR-0178 Repairs boxes on #638.
7. Independent review hand-off (generator ≠ critic); only then may **S4-a (LLD-C9)** dispatch
   against the frozen §5 anatomy.

## 14 · What S4/S5 inherit

S4-a builds ONLY LLD-C9 (the bar + flip + round-trip proof) — every seam it needs (both
conversations, `#mode`, `#setMode`, `#contextFor`) exists after step 4. S5's future intake
inherits the apply machinery + gate row, but **NOT a consumption path**: Kim's §15 option-(b)
ruling fences consumption to `drivingStore === authoringStore`, which deliberately blocks patching
a persona from an arbitrary chat — so S5's intake (capability 4, Kim's earlier IN pre-signal) must
make its OWN consumption-path ruling (how NL-edit arms the authoring context for an existing
persona) alongside the entry affordance + destructive-edit safety (OQ4/OF3). Recorded here so the
intake inherits the question, not an assumption.

> **Repair — 2026-08-10 (GH #653 item 1, S4-a):** the inherited-anatomy list re-states to the pane
> vehicle per [ADR-0179](../adr/0179-agent-admin-three-pane-ia.md): `#mode`/`#setMode` are retired
> (deleted, `admin-three-pane-ia.lld.md` §7) and `#contextFor` now keys off `#pane`
> (`this.#pane === 'author'`, a one-token diff over this section's original selector, everything
> below it byte-identical). **S5's future entry point now has a named home:** the Author place's
> always-present empty state (`admin-three-pane-ia.lld.md` §2 OQ4, `author-empty` +
> `onGenerateRequest`) is exactly the "New agent → Generate" shape S5 would arm an EXISTING persona's
> draft through — named, not built (zero consumption-path widening; this section's fence stands
> unchanged, S5 still owns its own ruling).

## 15 · Risks / open items (named; recommendation each; none blocks dispatch)

- **OF4 — Builder roster visibility.** Designed hidden-until-invoked (the ADR's recommendation);
  Kim may overrule — reversal is one array membership line. **Recommendation: keep hidden.**
- **Builder model choice.** Config, not contract: recommend the roster's sonnet-class id
  (interview quality; haiku acceptable fallback if cost rules). Picked at build; recorded in the
  preset comment.
- **Self-patching reachable pre-S5 — RULED: OPTION (b) (Kim, 2026-08-09, host AskUserQuestion
  round).** The exposure that forced the fork, kept for the record: ENTRIES are additive-only
  (SPEC-R29's no-deletion law — a patch can never remove authored entries), but VALUES merge
  per-key whole-value LAST-WRITER-WINS (the same pinned law), so a consumed patch CAN overwrite
  `name`/`model`/`temperature`, flip OTHER modality gates, or replace the catalog selection — and
  §3 step 2's admission table includes `SURFACE_AUTHORING_KEY` itself, so a consumed self-patch
  could arm a persona's own gate: model-authored writes widening the model's future write
  authority. Options considered: (a) accept as designed (this LLD's original recommendation);
  (b) the store-identity fence — consume only when `drivingStore === authoringStore`;
  (c) exclude `SURFACE_AUTHORING_KEY` from the patchable value set.
  **Ruling: (b)** — consumption requires the fence AND the gate, conjunctive (gate ON is still
  required; the fence never replaces it). Folded into §2 (consumption-condition + prop-seam rows),
  §3, §8, §11, §12.2. This knowingly narrows cl.3's gate-on-⇒-consume reading — ruled by the
  ADR's own ratifier and recorded here with provenance; if a future reader needs it ON the ADR,
  that is a one-line amendment at S5 intake, not a silent drift. Named family consequence: the
  fence deliberately blocks patching a persona from an arbitrary chat, so capability 4 (S5, Kim's
  earlier IN pre-signal) requires its OWN consumption-path ruling at S5 intake — inherited via
  §14, not resolved here.
- **Roster label vs patched `name`.** Shipped divergence (hand-edits have it today). If the
  interview's minted "New agent" row grates in practice, file a small follow-up (page subscribes
  to the draft's `name` key); not this slice.
- **Captured-store writes after a mid-turn switch** — the bankroll mirror's shipped posture,
  inherited knowingly (§8); no new exposure class.
- **PR #642 merge timing — CLOSED.** SPEC-R29/R30 merged to main (`8bdb1ef3`, v0.14, spec Status
  accepted 2026-08-09) with zero byte drift from the rows this LLD bound to (reviewer-confirmed);
  the risk did not realize. Any FUTURE amendment of those rows remains the header's escalation.
