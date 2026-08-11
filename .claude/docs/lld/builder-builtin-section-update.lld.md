# LLD — Builder builtin-section update (GH #696): the apply gate's scoped UPDATE verb

> Status: proposed · v0.1 · 2026-08-11 · Layer: LLD (implementation plan)
>
> Refines: [ADR-0178](../adr/0178-agent-authoring-conversational-persona-hydration.md)
> **Amendment (2026-08-11, proposed — Kim ratifies; nothing below dispatches until then)** ·
> [`builder-builtin-sections.decomp.md`](../decompositions/builder-builtin-sections.decomp.md) §S1
> (this LLD is that slice's build plan, at slice grain — per-leaf acceptance detail is deliberately
> thin; the amendment carries the contract).
>
> Composes on: [`agent-authoring-flow.lld.md`](./agent-authoring-flow.lld.md) §3 (the three-filter
> chain this extends — its consumption fence, report posture, and merge law are inherited, never
> re-ruled) · `persona-patch.ts` (the fixpoint-admission discipline, the `Map`-not-object ADMISSION
> lesson) · `entries.ts` (`DEFAULT_PROMPT_SECTIONS`, `composeSystemPrompt`) ·
> `system-prompt.ts`/`authoring-teaching.md` (the byte-pinned mechanics home + `loadPrompt`) ·
> `agent-admin-presets.ts` (`vocabularySection` — generated, never hand-listed) ·
> [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R29/R30 (the rows the
> amendment's Repairs book for prose repair in this same change).

## 1 · Intent

One build slice, one PR: after ratification, a consumed `personaPatch` may UPDATE the three
host-seeded builtin prompt sections (Foundation / Personality / Critical Items) in place —
`content` required, `description` optional, nothing else patchable — so a Builder-authored agent's
identity lands AT `order: 0` instead of below unchanged boilerplate. Everything rides behind the
shipped consumption fence + gate (conjunctive, unchanged).

## 2 · Components (slice grain; one writer per file)

| ID | Component | File(s) |
|---|---|---|
| **LLD-C1** | **Gate update branch.** In `applyPersonaPatch`'s entries loop: a member whose `id` matches an existing entry with `builtin === true` in a `prompt-section` list routes to UPDATE — `updateInputFrom(member)` admits `{ id, content, description? }` (content non-empty after trim, both strings; a malformed/emptying update DROPS the member, named `key[i]` in the report). Updates and appends accumulate into the SAME single `store.set(key, next)` per kind (one write = one pane re-render, the shipped law). Replaced fields only: `content` (+ `description` when present); `label`/`order`/`enabled`/`builtin`/`kind`/`id` copied from the existing entry verbatim. `PatchReport` gains `updated: Record<string, string[]>` (store key → updated entry ids — GH #695's future trigger signal wants ids, not counts). A member with a non-matching or absent `id`, or targeting a non-builtin/non-prompt-section entry, takes TODAY's append path byte-unchanged (`validateNewEntry`, dedup-suffix; a persona whose imported store lacks the builtins degrades to an append with that id — acceptable, tested). | `app/src/controls/agent-admin/persona-patch.ts` |
| **LLD-C2** | **Draft-state feedback widening.** `draftStateBlock` renders builtin prompt-section members as `{ id, label, content }` objects (the concurrency mitigation the amendment makes part of the ruling); every other entry-list member stays a bare label. | `persona-patch.ts` (same module, same writer as C1) |
| **LLD-C3** | **Mechanics teaching.** `authoring-teaching.md` gains the generic update sentence beside the existing append/no-deletion paragraph (persona-key-agnostic: no ids, no key names). **Traps, both known:** (i) the GH #640 fs-shim trap FIRES — a prompt `.md` edit needs the fs-shim content regen; (ii) rebase AFTER PR #692 merges (same file, GH #691's entries-example fix). Byte-pin gates (`system-prompt-grammar.test.ts` + prompt-drift/equivalence baselines) re-pin in the same commit. | `a2ui/src/agent/prompts/authoring-teaching.md` (+ fs-shim regen artifact) |
| **LLD-C4** | **Vocabulary teaching.** `vocabularySection()` gains a "Built-in sections you may REPLACE" block: the three `{ id, label, description }` rows generated from `DEFAULT_PROMPT_SECTIONS` (imported — never hand-listed) + ONE concrete worked example using the real key `entries:prompt-section` and `id: "foundation"` (PR #692's live-proven concreteness lesson). The closing protection sentence re-words per the amendment's Consequences. | `site/pages/agent-admin-presets.ts` |
| **LLD-C5** | **Turn-log widening.** The surface turn record's `patch: PatchReport` carries `updated` through; whatever renders `added`/`dropped` renders `updated` beside them. No new consumption logic — the apply loop's fence/gate check is untouched. | `app/src/controls/agent-admin/agent-admin.ts` |
| **LLD-C6** | **SPEC row repair** (the amendment's Repairs, verbatim scope): SPEC-R29's merge-law bullet scope-narrows "never a replacement" to non-builtin members + pins the update verb/field scope; SPEC-R30's teaching bullet gains the exception. Plus the record repair: `agent-authoring-flow.lld.md` §3's "Never a replacement, never a removal" sentence gains the carve-out pointer. | `.claude/docs/spec/a2ui-live-agent.spec.md` · `.claude/docs/lld/agent-authoring-flow.lld.md` |

## 3 · Test plan (per component; gates by EXIT CODE)

- **C1/C2 (jsdom, `persona-patch.test.ts`):** update admitted for each of the three ids
  (content replaced, label/order/enabled/builtin untouched — asserted field-by-field);
  `description` optional both ways; emptying/whitespace content drops; non-builtin id with
  collision still dedup-suffixes (today's behavior pinned); update + append in ONE patch for the
  same kind = one `store.set`; repeatable updates LWW across two patches; report `updated` ids
  exact; `draftStateBlock` carries builtin content + still collapses everything else to labels.
- **C3:** byte-pin/drift gates re-pinned green; teaching mentions no persona key or id (a grep
  assertion, keeping the persona-key-agnostic law honest).
- **C4 (site project):** the generated block contains ALL and ONLY `DEFAULT_PROMPT_SECTIONS` ids
  (the drift trip-wire, same shape as the existing vocabulary test).
- **C5 + panes proof (jsdom + existing browser shard):** a scripted authoring-context patch turn
  updating `foundation` → the Foundation card's editor value AND the composed prompt reflect it,
  boilerplate absent; the same patch outside the fence or gate-off ⇒ `patchIgnored`, zero writes
  (both polarities, inherited from the parent LLD's suite).
- **Gates:** `npm run check && npm test` FOREGROUND, then the affected browser shards.

## 4 · Non-goals

- Any deletion semantics (the law stands whole) · updating non-builtin entries, including the
  model's own appended sections (user hand-edit covers it; named, not built) · catalog/
  pattern-source builtins (excluded by the kind fence — registry-derived rows must not drift) ·
  GH #695's cross-tab reaction (consumes `updated`, designed there) · any wire/producer shape
  change (the member shape already expresses an id — zero `meta-line.ts`/`produce.ts` bytes).

## 5 · Build sequence

1. **LLD-C1 + C2** (pure module + tests — dependency-free).
2. **LLD-C3** (after PR #692 merges) **∥ LLD-C4**.
3. **LLD-C5** + the panes proof.
4. **LLD-C6** (doc/spec repairs) + full gates + Findings comment on GH #696.
