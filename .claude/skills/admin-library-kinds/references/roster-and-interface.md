# Roster law + the frozen interface

Moved verbatim from `admin-library-kinds/SKILL.md` §1–§2 (GH #927) — the mechanics behind how a
new entry kind joins the family, and the frozen `mountEntryList` contract it mounts through.

## 1 · The roster law — how a kind joins

No kind gets bespoke list/toggle/author code (ADR-0132 cl.1); `Entry.kind`
is a plain `string`, never a closed enum (Fork 2, `entries.ts` `Entry`). A new kind is FIVE data join
points — a kind missing any of them ships a silent gap, not a build error:

| Join point | Where | What it buys |
|---|---|---|
| `ENTRY_KINDS.<kind>` | `entries.ts` `ENTRY_KINDS` | the named constant every other point keys on |
| `initialEntryValues()` | `entries.ts` `initialEntryValues()` | the store seed (`entries:<kind>`, usually `[]`) |
| `CAPABILITY_KINDS` row | `agent-admin.ts` `CAPABILITY_KINDS` | the section itself — label, addLabel, liveHeading; array order IS DOM order |
| preset seed map | `site/pages/agent-admin-presets.ts` `presetSeed` | seed-completeness: `presetSeed` enumerates EVERY kind's `entries:` key — a new kind owes a row here even when seeded `[]` (its own precedent comment says so) |
| library pack (optional) | `site/pages/agent-admin-libraries.ts` (`ADMIN_LIBRARIES`) | ready-to-add entries; pure data through the same `entries.ts` `validateNewEntry` path |

A pack need not be a fixed authored array. Two shipped patterns, both on the `tool` kind:

- **Live-derived pack** — reads a runtime source through a setter, and is ABSENT (not empty, not
  errored) when that source degrades. The Integrations pack reads `setLiveIntegrations` (falling back to a
  static trio); the **MCP-services pack** (`MCP_SERVICES_PACK`, GH #783/ADR-0185) reads `setLiveServices`,
  fed by the dev proxy's `services` GET array (`fetchLiveServices`, `site/lib/admin-live-runner.ts`), and
  has NO static fallback — so `ADMIN_LIBRARIES`'s `tool` key is a GETTER that omits the pack entirely while
  `liveServiceEntries` is `undefined`. Each pack entry keys the external registry by an EXPLICIT
  `NewEntryInput.id` (the service ref `mcp:<server-id>:*`), never a slugged label (§4's trio law).
- **Per-pack collision rejection** — a pack keying an external registry sets its OWN
  `EntryLibraryPack.rejectOnCollision` (`entry-data.ts`, GH #783 S3/LLD-C5): re-adding an id already in the
  list is a DUPLICATE `validateNewEntry` rejects (`Already in the list.`), never a suffixed phantom row, and
  `entry-list.ts`'s picker-disable + render-refresh gate honor the KIND flag OR the PACK flag. This is what
  lets a foreign-key pack ride under an ORDINARY kind (`MCP_SERVICES_PACK`, `rejectOnCollision: true`, on the
  `tool` kind) — the same reject-on-commit + picker-disable the catalog KIND flag buys (§3), without the kind
  itself becoming registry-keyed.

Built-ins are toggle-off-only, never deletable (ADR-0132 Fork 4, enforced by the UI: `entry-list.ts` renders
no delete affordance for `builtin: true`). Kind-specific field schemas stay Fork 3's explicitly
deferred extension — a kind that needs one owes its own intake, not a quiet widening.

## 2 · The frozen interface + the additive options bag

`mountEntryList(kind, addLabel, handlers, options?)` is FROZEN verbatim (ADR-0164 cl.3; the shipped `mountEntryList` signature in `entry-list.ts`). Capability grows ONLY through the options
bag, additively: new members of `EntryListOptions` are optional with a default that renders
byte-identical for every existing call site. The precedent is ADR-0170 cl.8: `EntryListOptions`' `customAdd` and `contentField` (`entry-list.ts`), both default `true`;
the catalog kind passes both `false` (`agent-admin.ts`'s catalog `mountEntryList` call) because its entries key an external registry —
nothing to author or edit; adds come from the library menu alone. A suppressed `customAdd` is
also a named future seam (the deferred catalog-CREATE affordance lands there). A new parameter
in the signature, or a non-defaulting option, reopens ADR-0164 — it is not a local edit.
