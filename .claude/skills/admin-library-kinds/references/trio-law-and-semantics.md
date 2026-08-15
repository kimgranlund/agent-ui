# The trio law + the semantics spectrum

Moved verbatim from `admin-library-kinds/SKILL.md` §4 (GH #927) — the id/label/name trio law and
the three shapes a new kind's selection semantics can pick from.

## 4 · The trio law + the semantics spectrum

**id ≠ tool.name ≠ label — three facts, three fields** (ADR-0168 cl.2).
A pack whose entries key an EXTERNAL vocabulary supplies `NewEntryInput.id` (`entries.ts`) so the
stable key survives a label edit; packs without explicit ids keep slugify-from-label. The same
law binds BOTH projections from pack to store: the library-add path (`validateNewEntry`) and the
preset seed path (`seedId`, `site/pages/agent-admin-presets.ts` — seeding by label where an
id exists mints an armed-but-silently-inert entry). A pack keying a live registry derives from an
IMPORT of it, never a hand-copied table (ADR-0170 cl.7; `agent-admin-libraries.ts`'s registry-import).

When a new kind picks its semantics, three shapes exist — pick by the kind's own truth table:

| Shape | Exemplar | When it fits |
|---|---|---|
| Multi-enable | skill/workflow/resource/tool | N independent on/offs; every enabled entry that is also **in-context** composes ambiently — as ONE INDEX LINE (label + description, NEVER its `content`) since GH #891/SPEC-R14 ruled the ambient shape, the full body arriving only on the user's own `@`/`/` invocation (`entries.ts`'s `composeLiveSystemPrompt` + its pinned teaching block; `resolveTurnReferences` is the whole-content load path). Since GH #850 these four kinds also carry a second, ORTHOGONAL per-entry axis (`Entry.availability`: `context` \| `invocable`, absent ⇒ `context` read-side), and an `invocable` entry is reachable only by an explicit per-turn invocation (`entry-data.ts`'s `isAmbient` is the one conjunct every ambient projection filters on). The composer's capabilities menu (GH #891/SPEC-R13) is a GLOBAL enable/disable over the same `enabled` axis, never a per-turn dial |
| Pattern-source (first-by-order) | `entries.ts` `pickedPatternSource` (SPEC-R11/D3) | single PICK with a legitimate none state; extra enabled entries a tolerated data-level no-op |
| Single-select (derived) | catalog, §3 | the wire carries exactly ONE id, no none state, fail-closed default — the D3 shape would make the UI lie (ADR-0170 Context) |

Illustrative, not a menu to extend casually: a fourth shape is an ADR, not a code choice —
ADR-0170's Consequences already cap the roster's annotated deviants at single-line filters. An
ASSOCIATION shape (a kind bound to another kind's roster as one array value) already has its
field-level building block minted (`ui-multi-select`, ADR-0175 — see "Association/multi-select
kinds" above) — but the KIND-level shape itself is not ruled; adding one is its own ADR, same as
any other fourth shape, not a local table addition.
