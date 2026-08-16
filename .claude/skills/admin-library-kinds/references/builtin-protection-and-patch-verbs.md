# Built-in protection + the model-patch verbs — what `builtin: true` protects, and the authorship-scoped re-ruling

Harvested 2026-08-16 from ADR-0178's Amendment (`.claude/docs/adr/0178-agent-authoring-conversational-persona-hydration.md`
§Amendment, ratified 2026-08-13 via GH #696 utterance comment 5275019730; built as PR #826, tracker
GH #821 closed). Source facts re-read 2026-08-16 against
`packages/agent-ui/app/src/controls/agent-admin/persona-patch.ts` (`updateTargetIndex`, `PatchReport`).
Owners: ADR-0132 Fork 4 (what built-in means) · ADR-0178 cl.2 + Amendment (what a consumed persona
patch may express) — cite, never copy.

## The question this file answers

"The Builder/model wants to change an entry the host seeded — may it? What does `builtin: true`
actually protect, which verbs does the persona-patch gate admit per entry class, and why is the
line drawn along AUTHORSHIP rather than per-kind or per-field?"

## The load-bearing fact: `builtin: true` = NON-DELETABLE only [verified 2026-08-16]

ADR-0132 Fork 4 rules built-ins toggle-off-only, never deletable — `entry-list.ts` withholds the Remove
affordance for `builtin: true` (`roster-and-interface.md` §1). It does NOT mean immutable: the content
editor mounts for every prompt-section row, so a built-in's `content` is already hand-editable by the
user today. The three host-seeded placeholder prompt sections (`DEFAULT_PROMPT_SECTIONS` in
`entries.ts` — Foundation "You are a helpful assistant." / Personality / Critical Items, `order` 0–2)
are therefore not a protected-content class anywhere in the substrate — only the patch gate ever
treated them as one, and only by accident of uniform application.

## The pattern — AUTHORSHIP-SCOPED RE-RULING [verified 2026-08-16 — ADR-0178 Amendment]

A uniform protection ("entries are append-only, by construction") was derived for ONE authorship class
(the user's own authored entries are safe from the model) and applied to ALL entries. Applied uniformly
it protected content nobody authored: an authored agent's real identity could only ever land as a
FOURTH section appended below three unchanged generic placeholders, and `composeSystemPrompt` shipped
boilerplate ahead of the persona in every Builder-authored agent's live prompt, forever (GH #696).

The amendment does not remove the protection — it re-scopes it along the axis its rationale actually
runs on, and adds ONE narrow verb for the class the rationale never covered:

| Entry class | APPEND (add a new member) | UPDATE in place | DELETE / empty |
|---|---|---|---|
| Host-seeded built-in **prompt section** (`builtin: true`, list kind `prompt-section`) | via `validateNewEntry`, unchanged | ADMITTED — replaces `content` (required, non-empty after trim; an emptying update DROPS) and MAY replace `description`; `label` · `order` · `enabled` · `builtin` · `kind` · `id` are never patchable | impossible, structurally |
| User-authored entry (any kind), or a built-in of any OTHER kind | via `validateNewEntry`, unchanged | NOT admitted — today's append path verbatim, dedup-suffix and all | impossible, structurally |

- **The fence is ONE predicate**: `updateTargetIndex(existing, key, member)` in `persona-patch.ts` —
  `key === PROMPT_SECTION_KEY` AND the member's trimmed `id` names an existing entry with
  `builtin === true`, else `-1` ("not an update", take the append path). Kind-DERIVED from the
  canonical export, never a literal; the two-field replace scope (`EntryUpdateInput`) is pinned.
- **Merge law**: updates are whole-field last-writer-wins, repeatable across turns — the VALUES class
  law (ADR-0178 cl.1) extended to exactly this entry class. ADR-0132 cl.4's single-validated-ADD-path
  law is untouched: an update mints no id, no slug, no order.
- **The consumption fence and the gate are unchanged**: authoring-context store-identity fence AND a
  fresh gate-ON read, conjunctive. The amendment widens WHAT a consumed patch may express, never WHEN
  one is consumed.
- **The concurrency mitigation is part of the ruling**: LWW over a hand-editable field is acceptable
  only because the draft-state block (`draftStateBlock`) carries the built-in sections' current
  `content` — bounded to exactly those bodies, never full entry lists.
- **Report shape**: `PatchReport` gains `updated: Record<string, string[]>` beside `applied`/`added`/
  `dropped` — an update-only patch leaves `applied` AND `added` empty, so any reaction keyed on those
  two alone misses the flow's primary write class (GH #695's cross-tab reaction NEEDS `updated`).

## When to reach for this pattern [inferred]

Reach for an authorship-scoped re-ruling when a blanket protection is protecting content the protected
party never authored, AND the "protected" class is already mutable through some other door (here: the
hand editor). The tell is two sound intents colliding under one uniform rule. The rejected
alternatives (seed-without-placeholder, compose-time shadowing, replaceable-while-pristine) and why each
fails: ADR-0178 Amendment §"Alternatives considered" — cite, never re-summarize.

## Provenance

ADR-0178 Amendment (2026-08-11, ratified 2026-08-13 — kimgranlund, GH #696 comment 5275019730,
`scripts/adr_ratify.py` amendment mode) · manifest `.claude/docs/decompositions/builder-builtin-sections.decomp.md`
· build plan `.claude/docs/lld/builder-builtin-section-update.lld.md` · PR #826 (built), GH #821 (tracker,
closed). Harvested here 2026-08-16 (adr-queue row `adr-0178-amendment`, queued 2026-08-13 by the
decision-watcher sweep). [drift-prone]: the symbol names `updateTargetIndex` / `EntryUpdateInput` /
`PatchReport.updated` — re-verify against `persona-patch.ts` if the gate is refactored.
