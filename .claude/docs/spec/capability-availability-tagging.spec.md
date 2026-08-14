# SPEC — Per-entry availability mode + composer tagging grammar (GH #850 · GH #849, one joint contract)

> Status: proposed · v0.5 · 2026-08-14 (v0.4, v0.3 2026-08-14 · v0.2, v0.1 2026-08-13) · Layer: SPEC (execution contract)
> v0.5 changelog (the ADR-0190 fork RULED — the owner's 2026-08-14 utterance, quoted in the ADR's
> rev.2 Context and in §12): the capabilities-menu switch is a GLOBAL enable/disable over the
> roster's `enabled` axis, not per-turn steering — §12 added, three new requirements. SPEC-R13 —
> the ruled consumer wiring (the three-tier reach model: ever-present · invoke-only · off), minting
> the ACs §11.4 deferred; §11.4's arm-A/arm-B fork text stays as the ship record, annotated ruled.
> SPEC-R14 — poor-man's progressive disclosure: an ever-present capability entry contributes ONE
> ambient index line (label + description), NEVER its content; full content rides only the express
> invocation framing path (SPEC-R4, shipped). This deliberately supersedes-in-part SPEC-R3's
> AC1/AC3 ambient-shape assertions (annotated in place; R3's gating LAWS — invocable = zero
> ambient bytes, master/enabled precedence — stand unchanged). §7's worked example annotated the
> same way. SPEC-R15 — the teaching block: the model is TOLD the index is an index and that only
> the user can load an entry (tag it in the composer); host-owned, byte-pinned, gated on ≥1 index
> line. New slice S8; S7's scope repointed at SPEC-R13. Both S7 and S8 gate on Kim ratifying the
> REVISED ADR-0190 text.
> v0.4 changelog (the GH #891 extension — the owner's UX delta on the shipped arc, same day): §11
> added, four new requirements. SPEC-R9 — reference chips DROP the sigil prefix (the owner's
> screenshot: a chip reading "/ itinerary-timeline ×"); kind identity moves to an optional
> consumer-supplied icon, so §10's v0.3 chip-treatment bullet ("the trigger character itself is the
> per-kind mark") is SUPERSEDED by R9 and annotated in place — it stays as the ship record.
> SPEC-R10 — the sent user bubble gains display-only reference tags: the visual layer reconciled
> with R4's framed-wire law, which is byte-unchanged (framed text stays the wire/history truth and
> never renders in the bubble). SPEC-R11 — the third composer menu (capabilities rows + switches),
> specified composer-GENERIC and fork-independent. SPEC-R12 — the consumer wiring, GATED on
> [ADR-0190](../adr/0190-capabilities-menu-toggle-semantics.md): the switch's semantics (per-turn
> inclusion vs a persistent roster write) is a GENUINE contract fork — real alternatives, binding on
> later work, not derivable from existing law — so it is filed `proposed` for Kim rather than ruled
> silently (the §3 table's own default-no doctrine cuts the other way here, deliberately). New
> slices S4–S7 (§11.5); S4/S5/S6 are parallel and fork-independent, S7 alone waits on the ADR.
> v0.3 changelog (the BUILD-STATE pass, filed with the arc's last slice): all three slices have
> landed — §9's table carries each one's PR, and §10's bookings are marked repaired in the slice
> that repaired them. §10's four open questions are CLOSED with pointers to where each was
> actually ruled: no LLD was ever authored for this arc, so the three LLD-altitude questions were
> ruled IN BUILD, in code, inside the constraints their requirements already stated (the framing
> grammar in `entries.ts`'s `resolveTurnReferences` doc comment, the chip treatment in
> `conversation-composer.ts`, the row control in `entry-list.ts`), and the fourth was answered by
> GH #848 shipping the rename as an in-place `label` write. Status stays `proposed` by convention —
> the tree is the ship record, statuses lag by design (`agent-ui-doc-standards` §2).
> v0.2 changelog (the doc-checker fix-then-ship pass, same day): SPEC-R4 owns the history
> byte-growth trade + §8 gains the no-cap non-goal · R4 AC4's fence-precedent anchor repaired
> (the transcribed SPEC-R22 referent was plan-failure semantics — the §3-of-doc-standards
> transcribed-citation law caught in the wild) · §10's agent-admin.ts row reworded to the actual
> comment wording · R7's event list de-enumerated to the owning constants (the GH #754 drift
> class) + the composer's own pre-existing "six-event" comment drift booked into S2 · R3 AC3
> given its operational form.
> Refines: GH #850 (per-entry availability mode) + GH #849 (composer tagging grammar) — the intake
> records; their Summary/Acceptance own the why/what. **No owning PRD — a deliberate, acknowledged
> deviation** (the [`mcp-agent-config.spec.md`](./mcp-agent-config.spec.md) precedent): both issue
> bodies already carry problem, user, and done-when; a PRD would restate them under different
> frontmatter. ONE SPEC covers the pair because the owner's framing makes them halves of one
> contract: #849's `@`/`/` menus ARE #850's user-invocable reach path — neither is complete, or even
> fully testable, specified alone.
> Refined by: NO LLD — one was anticipated at build dispatch and never authored; all three slices
> shipped straight off this contract, and each LLD-altitude detail (exact constants, file layout,
> chip styling, the framing's byte grammar) was ruled in its own build, in code, inside the
> constraints the owning requirement already stated. §10 names where each ruling lives.
> **No ADR** — the one genuine-looking fork (third enablement state vs orthogonal flag) is resolved
> by existing law rather than a new hard-to-reverse commitment; §3 records the analysis so the
> non-decision is auditable (the default-no doctrine: an ADR nobody was unsure about is process,
> not rigor). If Kim wants the fork ratified anyway, §3's table is the Context section ready-made.
> Altitude: owns **behavior + acceptance** — the availability model and its gating semantics, the
> tagging grammar, the structured turn shape, the resolution path, and the slice seam between the
> two issues. Requirement IDs file-scoped (`SPEC-R1…`, `SPEC-N1…`).

---

## 1 · Purpose

Every capability entry (Skills · Workflows · Resources · Tools — the four capability kinds of
ADR-0132's entry model) gains an **availability mode**: *in-context* (the model sees it ambiently —
today's only behavior) or *user-invocable* (inert until the user tags/invokes it from the
conversation composer). The composer gains the reach path: `@` mentions Resources, `/` invokes
Skills/Workflows/Tools, keyboard-first typeahead over display names, committing a **structured
reference** — never bare text — that the host resolves at turn time.

This mirrors the harness's own skill-flag pair (`disable-model-invocation` / `user-invocable` —
two orthogonal booleans, deliberately not a tri-state), applied to the agent-admin capability
model. The owner cites that pair as the model; this SPEC adopts its shape.

What exists today, verified at HEAD:

1. The generic entry core (`entry-data.ts`): `Entry {id, kind, label, description, content, order,
   enabled, builtin}` — `enabled` is the one reach dial, and it means "composes ambiently".
2. The ambient projections: `composeLiveSystemPrompt` (`entries.ts`) projects every enabled entry
   of a master-on kind as prompt prose; `#enabledToolIds` (`agent-admin.ts`) forwards every enabled
   tool entry's `id` on the `integrations` wire (ADR-0168 cl.2 / GH #402 — ids, never labels);
   `AgentConfigSnapshot`'s per-kind label lists feed the stub arm and the turn logger.
3. The composer (`ui-conversation-composer`, TKT-0056/0058): the host IS the field — one
   `contenteditable="plaintext-only"` editor (the ADR-0014/ADR-0134 pattern), an opt-in
   context-chip row above it, picker menus below, `events: []` with registration callbacks.
4. The typeahead kin: `ui-combo-box`'s active-descendant discipline (focus stays in the editor;
   Arrow moves `aria-activedescendant`, never DOM focus) vs `ui-menu`'s roving focus.
5. The wire: `AdminTurnRequest {text, system, integrations, …}` (prose arm) and
   `TurnInput {kind:'intent', text, session}` (surface arm, `agent-transport.ts`) — both carry the
   user turn as text; `integrations: string[]` is per-request, registry-id vocabulary widened by
   ADR-0185's `mcp:<server-id>:*` service refs, resolved fail-closed server-side.

## 2 · Definitions

- **Availability** — HOW an *enabled* entry is reachable: `context` (ambient, today's behavior) or
  `invocable` (only via an explicit per-turn reference). Orthogonal to `enabled`, which stays "is
  this entry active at all".
- **Ambient bytes** — any contribution an entry makes without a per-turn reference: system-prompt
  prose, an `integrations` wire member, a stub-snapshot label, a Context-tab System line.
- **Reference** — the structured `{kind, id, label}` a committed mention/invocation attaches to a
  turn. A **mention** is an `@` reference (Resources); an **invocation** is a `/` reference
  (Skills/Workflows/Tools). Resolution is always by `id` (GH #402's law); `label` rides only for
  display and the turn log.
- **The four capability kinds** — `ENTRY_KINDS.skill/workflow/resource/tool`. `prompt-section`,
  `pattern-source`, and `catalog` have their own selection semantics and are OUT of scope
  (SPEC-N1).

## 3 · The design in one paragraph (and the rejected shapes)

`Entry` gains ONE optional field, `availability?: 'context' | 'invocable'`, absent ⇒ `'context'`
read-side (never a migration write — the `readCatalogEntries` read-time-guarantee precedent), so
every stored config, export, and pack migrates unchanged by construction. Every ambient projection
adds the same one conjunct (`enabled && availability !== 'invocable'`); the composer grows two
default-off props (`mentionables`/`invocables`) driving an active-descendant typeahead whose commit
mints a chip + a structured reference; at send, `ui-agent-admin` resolves references against a
fresh store read — prose kinds frame into the user turn's text, tool kind unions into that turn's
`integrations` — so the transport, proxy, and Worker schemas carry **zero changes**.

Rejected shapes (each graded — this table is why no ADR is filed):

| Shape | Why rejected | Reversal weight |
|---|---|---|
| **Third enablement state** (`enabled: true \| false \| 'invocable'`) | Conflates two axes the harness model keeps separate: a disabled-but-invocable entry becomes inexpressible; `readCatalogEntries` derives `enabled` at read time and a tri-state breaks that derivation; every `e.enabled` boolean read site (and every stored config) takes a breaking migration. The orthogonal field is the additive precedent (`rejectOnCollision`, `NewEntryInput.id?`) applied again. | Would strand stored booleans — HIGH. The chosen flag degrades by read (ignore the field) — LOW. This asymmetry is why the choice needs no ADR: it is derivable from constraints, and cheap to walk back. |
| **Pack/kind-level availability** | The kind master switch already IS the kind-level gate; a kind-level availability *default* is a second writer over per-entry truth (the ADR-0170 cl.2 defect class). Per-entry only; a kind-level default can land additively later if real use demands it. | None — deferral, not doctrine. |
| **New wire vocabulary for invocations** (a `references` member on `TurnInput`/`AdminTurnRequest` reaching the proxy) | Adds proxy+Worker schema for zero server-side consumer: prose kinds resolve to prompt bytes and the tool kind already has a wire (`integrations`). Resolution is host-side where the stores live; the structured shape lives on the composer↔consumer seam instead. | Additive later if a server-side consumer appears. |
| **Two-stage `/tool <name>` grammar** | Entries are flat, user-named, parameterless items (ADR-0132 Fork 3 — no arg schemas); a kind prefix is a grouping concern the menu's group headers already carry. Direct-by-name costs fewer keystrokes and matches the harness's own `/name` idiom. | None — grammar detail. |
| **Inline pills in the editor** | The editor is `contenteditable="plaintext-only"` by architecture (ADR-0014/ADR-0134): value sync is `textContent`, the caret guard assumes text-only content. Embedded non-editable elements break both and would be a new editor architecture, not a feature. Chips land in the existing chip row instead; residual token text is never load-bearing. | A future editor-architecture design may revisit — its own doc, not this one. |
| **`@` covering all four kinds** | Collapses the reference/invoke distinction the harness idiom keys on (`@` = attach material, `/` = do a thing). Resources-only `@` is the issue's own default. | Additive later (widen the `mentionables` roster) with zero grammar change. |

## 4 · Requirements

**SPEC-R1 — The availability field: one optional member on the generic core.** `Entry`
(`entry-data.ts`) MUST gain `availability?: 'context' | 'invocable'`; ABSENT MUST read as
`'context'` at every read site — a read-time default, never a migration write, so every existing
stored config, export/import payload, and library pack is unchanged byte-for-byte (GH #850's
migration clause). The field is orthogonal to `enabled` (§3's ruling): `enabled` stays "active at
all", availability stays "how reachable", and no read site may collapse them. `validateNewEntry`
MUST keep returning entries WITHOUT the member (new entries — hand-authored and pack alike —
default in-context); `NewEntryInput` gains nothing. Semantics are defined for the four capability
kinds only; on any other kind the field is inert (readable, meaningless — no code may branch on it
outside the four).
*(→ GH #850; ADR-0132 cl.1/Fork 4; the `rejectOnCollision`/`NewEntryInput.id?` additive-options law)*
- **AC1** *Given* `entry-data.test.ts`'s new cases, *when* an entry without the field round-trips a
  store write/read and an export/import cycle, *then* it reads as in-context and the stored JSON
  carries no `availability` key; *when* an entry stores `'invocable'`, *then* the value survives
  both cycles verbatim.
- **AC2** *Given* the built diff, *then* `validateNewEntry`'s returned shape for existing inputs is
  byte-identical to HEAD (the shipped suite passes unmodified) — `npm run check && npm test`, exit
  codes.

**SPEC-R2 — The admin affordance: per-entry mode control, at a glance, four kinds only.** The
entry row (`entry-list.ts`) MUST offer a per-entry availability control for the four capability
kinds, opted in through an additive-optional `EntryListOptions` member (the `customAdd`/
`contentField` law: absent ⇒ byte-identical render for every existing caller — `prompt-section`,
`pattern-source`, and `catalog` sections never show it). A row whose entry is user-invocable MUST
carry a visible at-a-glance marker (GH #850's row-visibility clause — visible without opening
anything; exact affordance and marker treatment are the LLD's). Toggling the mode MUST persist
through the section's existing handler seam (an optional `EntryListHandlers` member, same law) and
survive reload; a `builtin` entry's mode is as editable as its `enabled` toggle (ADR-0132 Fork 4
protects deletion, not configuration).
*(→ GH #850; ADR-0170 cl.8's `EntryListOptions` precedent)*
- **AC1** *Given* a section mounted WITHOUT the new option, *then* its rendered DOM is
  byte-identical to HEAD (the existing entry-list suite passes unmodified).
- **AC2** *Given* a capability section with the option, *when* an entry's mode is flipped to
  user-invocable, *then* the row shows the marker, the store persists the value, and a re-mount
  from the same store renders the same state.

**SPEC-R3 — Ambient gating: zero ambient bytes from a user-invocable entry, on EVERY arm.** An
enabled entry whose availability is `invocable` MUST contribute nothing ambiently: (a)
`composeLiveSystemPrompt`'s per-entry filter widens from `e.enabled` to enabled-AND-in-context;
(b) `#enabledToolIds` forwards only enabled in-context tool ids — on BOTH live arms (the shared
projection stays shared, so the arms cannot drift); (c) `AgentConfigSnapshot`'s per-kind label
lists (the stub arm + the turn logger's config view) apply the same filter; (d) the Context tab's
System snapshot, which renders `composeLiveSystemPrompt`'s output, inherits (a). GATED
EQUIVALENCE: a store in which no entry is `invocable` MUST produce byte-identical output to HEAD
on all four surfaces (the ADR-0136 Fork 3 equivalence law, extended). The kind master switch and
per-entry `enabled` keep today's semantics exactly — availability is a third conjunct, never a
replacement.
*(→ GH #850; ADR-0136 Fork 3; ADR-0168 cl.2/cl.5, GH #402; vision rev.5's master-switch law)*
- **AC1** *Given* a store with one enabled in-context skill and one enabled invocable skill, *when*
  the live prompt composes, *then* the first entry's label+content appear and the second's appear
  NOWHERE in the string (a `not.toContain` byte assertion).
- **AC2** *Given* one enabled in-context tool and one enabled invocable tool, *then*
  `integrations` on BOTH arms' requests carries exactly the first id.
- **AC3** *Given* a store whose entries all lack the field, *then* the composed prompt, the
  `integrations` list, and the snapshot label lists are byte-identical to HEAD's outputs for the
  same store — operationally: the existing `entries.test.ts`/`agent-admin.test.ts` suites pass
  UNMODIFIED, plus one new explicit field-less-store equivalence assertion (gated equivalence,
  asserted, not assumed).

*(v0.5 annotation — SUPERSEDED IN PART by SPEC-R14, §12: the ambient SHAPE this requirement's AC1
("label+content appear") and AC3 (byte-identity to the pre-#850 composition) assert changes
deliberately — an ambient capability entry contributes an index line, never content, once S8 (S8 updates R3 AC1/AC3's assertions to the index shape; NEVER restore the content assertions.)
lands. What stands unchanged, and is restated as R14's own gating clauses: an invocable entry
contributes ZERO ambient bytes on every arm, the master-switch → `enabled` → availability
precedence, and the `integrations` wire projection (b) byte-for-byte. The v0.3 text above stays
verbatim as the S1 ship record.)*

**SPEC-R4 — Turn-time resolution: host-side, fresh-read, fail-closed, both arms, zero transport
change.** A submitted turn MAY carry references (`{kind, id, label}[]`, SPEC-R6). At send,
`ui-agent-admin` MUST resolve each against a FRESH store read by `id` (the live-apply law):
- **skill / workflow / resource** — the entry's label + description + content frame into the
  outgoing user turn's TEXT as a deterministic, host-built labeled block ahead of the typed text
  (byte grammar is the LLD's; the SPEC's constraints: labeled per entry, content verbatim, typed
  text last, and a turn with zero resolved references frames to the bare typed text
  byte-identically). The FRAMED text is what both arms send and what `#recordTurn` records — the
  model-saw-it truth rides history, so follow-up turns keep the attachment without re-mention;
  the conversation UI keeps showing the typed text + chips (the log/Context views show the wire
  truth, their existing job). The COST is owned, not hidden: a framed attachment's full content
  rides every subsequent request of that session (history is replayed whole), so a large resource
  mentioned once grows every later turn's payload — accepted deliberately for follow-up
  continuity, with no size cap or truncation this arc (§8; an LLD MAY add a stated per-block
  ceiling later without changing this requirement's semantics).
- **tool** — the entry's `id` unions into THAT turn's `integrations` list (both arms), deduped,
  riding the existing wire vocabulary unchanged — including an ADR-0185 service ref
  (`mcp:<server-id>:*`) stored as an entry id, which expands server-side exactly as an ambient one
  would. No per-turn state persists: the next turn's `integrations` is the ambient projection
  again.
- **fail-closed** — a reference whose id no longer resolves (deleted entry), resolves to a
  disabled entry, or belongs to a kind whose MASTER switch is off contributes nothing (the
  `resolveIntegrations` drop law, applied host-side); the turn still sends. The master switch wins
  over invocation exactly as it wins over ambient composition.
`TurnInput`, `AdminTurnRequest`, the proxy routes, and the Worker MUST carry zero schema changes
(§3's rejected wire shape; the transport never learns entry semantics).
*(→ GH #849/#850; ADR-0168 cl.2/cl.5; ADR-0185; GH #402; SPEC-N1 of
[a2ui-live-agent.spec.md](./a2ui-live-agent.spec.md))*
- **AC1** *Given* a turn referencing one resource, *then* the framed text contains the resource's
  label and content ahead of the typed text, and the recorded history turn equals the framed text.
- **AC2** *Given* a turn invoking one invocable tool alongside one ambient in-context tool, *then*
  that request's `integrations` carries both ids exactly once each, and the NEXT turn's carries
  only the ambient id.
- **AC3** *Given* a reference to a deleted id, a disabled entry, and an entry of a master-off kind
  (three cases), *then* each contributes nothing and the turn sends with the remaining
  resolutions intact.
- **AC4** *Given* the arc's diffs, *then* `agent-transport.ts` and the dev-proxy/Worker route
  schemas show empty diffs (the empty-diff fence precedent:
  [mcp-agent-config.spec.md](./mcp-agent-config.spec.md) SPEC-R3 AC3, re-scoped to this arc).

**SPEC-R5 — The grammar: `@` mentions Resources, `/` invokes, direct-by-name, never captured
text.** Typing `@` at a TOKEN START (start of text, or after whitespace/newline) MUST open the
mention typeahead over the `mentionables` roster (Resources); typing `/` at a token start MUST
open the invocation typeahead over the `invocables` roster (Skills/Workflows/Tools) as ONE menu,
grouped by kind, filtered directly by name — never a two-stage `/tool <name>` (§3). Subsequent
non-whitespace characters filter case-insensitively over DISPLAY names. Dismissal — Escape, blur,
or typing whitespace without a commit — MUST close the menu and leave the typed characters as
plain inert text (never captured, never load-bearing: send-time resolution reads ONLY structured
references, SPEC-R6). A roster that is `undefined`/empty MUST make its trigger character a plain
character (no menu, no interception).
*(→ GH #849; the harness `@`/`/` idiom)*
- **AC1** *Given* `@` typed mid-word (after a non-whitespace char), *then* no menu opens; *given*
  `@` at text start and after a space (two cases), *then* the mention menu opens.
- **AC2** *Given* an open menu and the typed token `@men`, *then* only display names containing
  `men` (case-insensitive) remain.
- **AC3** *Given* Escape on an open menu, *then* the menu closes, the editor keeps `@men` as plain
  text, and sending yields zero references.

**SPEC-R6 — The commit shape: chip + structured reference, additive callback, default-off props.**
Committing a menu item MUST remove the in-progress token text from the editor and add a
dismissable chip to the composer's chip area (the context-chip row's home; the reference chips are
composer-OWNED state, distinct from the consumer-owned `contextItems` — the LLD rules the visual
cohabitation), carrying `{kind, id, label}`. Chips MUST be dismissable before send (removing the
reference) and MUST clear on successful send alongside the text. `onSubmit`'s callback signature
widens ADDITIVELY to `(text, references?)` — an existing single-parameter consumer is
byte-unaffected (extra argument ignored). The two roster props (`mentionables`, `invocables`,
each `readonly {id, label, kind, description?}[]`) default `undefined` ⇒ the whole feature is off
and the composer renders byte-identically to HEAD (the `models`/`providers` default-off law). The
structured reference list is the ONLY load-bearing representation of a mention/invocation
(GH #849's "not bare text" clause).
*(→ GH #849; TKT-0058's composer contract; the `providers?`/`modes?` additive-prop precedent)*
- **AC1** *Given* a commit, *then* the token text is gone from `value`, a chip with the entry's
  label renders, and `onSubmit` on send delivers the reference `{kind, id, label}`.
- **AC2** *Given* a chip dismissed pre-send, *then* send delivers zero references.
- **AC3** *Given* a composer with neither roster prop set, *then* its DOM and behavior are
  byte-identical to HEAD (existing composer suite unmodified), and a single-arg `onSubmit`
  consumer compiles and runs unchanged.

**SPEC-R7 — Keyboard, AX, and the event law.** The typeahead MUST follow the active-descendant
discipline (`ui-combo-box`'s pattern, restated — NOT an embedded `ui-combo-box`): focus never
leaves the editor; the menu is a control-created `[role="listbox"]` popover with `[role="option"]`
items; ArrowUp/ArrowDown move the highlight via `aria-activedescendant` on the editor; Enter
commits the highlighted item; Escape closes. Enter with an open menu MUST commit and MUST NOT
send (the guard runs ahead of the composer's Enter-sends law; Shift+Enter's newline law is
untouched). NO new event name — the fleet's closed event vocabulary (ADR-0153; the owning home is
the `ALLOWED_EVENTS` constants in `family-coherence.test.ts` + `naming-gates.test.ts`, extended
together, never copied) gains nothing; the composer's `events: []` + registration-callback
contract stands, and no internal menu event may escape the host (the existing editor-`input`
suppression discipline — whose own comment carries a pre-existing "six-event" count drift, booked
into S2, §10).
*(→ GH #849; ADR-0043/`combo-box.ts`'s active-descendant architecture; ADR-0153's closed event
vocabulary; the fleet ARIA-via-parts law)*
- **AC1** *Given* an open menu, a browser-engine test walks Arrow→Arrow→Enter and asserts focus
  stayed on the editor throughout, `aria-activedescendant` tracked the highlight, and the commit
  landed — with NO submit fired.
- **AC2** *Given* the built diff, *then* no `dispatchEvent` with a new event name appears in the
  composer (grep-the-diff plus the layering/contract suites green by exit code).

**SPEC-R8 — The menu roster: both modes listed, invocable-only reachable ONLY here,
rename-following.** The rosters `ui-agent-admin` hands the composer MUST derive as: entries of
the mapped kinds (`resource` → `mentionables`; `skill`+`workflow`+`tool` → `invocables`) that are
`enabled`, of kinds whose MASTER switch is on — BOTH availability modes included (GH #849: an
in-context entry may appear in the menu AND ambiently; an invocable entry appears ONLY here).
Disabled entries and master-off kinds are absent. Labels MUST be read fresh from the store on
roster build (the live-apply law), so a rename (GH #848, sibling) shows on the next menu open with
zero further wiring — display truth is `Entry.label` today; if #848 mints a separate display
field, this roster projection is the single repoint site. Resolution stays by `id` everywhere
(SPEC-R4).
*(→ GH #849/#848/#850; GH #402's id-not-label law)*
- **AC1** *Given* a store with entries in all four kinds across both modes plus one disabled entry
  and one master-off kind, *then* the derived rosters contain exactly the enabled entries of
  master-on mapped kinds, both modes, and nothing else (a pure-function unit).
- **AC2** *Given* an entry relabeled in the store, *then* the next roster build carries the new
  label while the reference id is unchanged.

## 5 · Non-functional requirements

- **Zero dependencies**; no new packages. The composer work stays in `@agent-ui/app`'s
  `controls/conversation/`; the typeahead is control-created DOM per the fleet's light-DOM law.
- **Layering** — the composer stays GENERIC: it knows `ReferenceOption`/`TurnReference`
  (composer-options.ts vocabulary), never `Entry`, stores, or kinds' semantics; `ui-agent-admin`
  owns the domain projection (the `PickerOption` division of labor, unchanged).
- **Byte-identical defaults everywhere** — every widened seam (Entry field, EntryListOptions,
  EntryListHandlers, composer props, onSubmit arity) is additive-optional with an
  absent-equals-today default; SPEC-R3 AC3 / SPEC-R6 AC3 are the enforcement.

## 6 · Typed contracts (indicative — exact homes are the LLD's)

```ts
// entry-data.ts — the ONE model change
interface Entry { /* …existing… */ availability?: 'context' | 'invocable' }

// composer-options.ts — the composer's generic vocabulary
interface ReferenceOption { id: string; label: string; kind: string; description?: string }
interface TurnReference  { id: string; label: string; kind: string }

// ui-conversation-composer — additive props + widened callback
mentionables?: readonly ReferenceOption[]   // '@' roster; undefined ⇒ '@' is a plain character
invocables?:   readonly ReferenceOption[]   // '/' roster; undefined ⇒ '/' is a plain character
onSubmit(cb: (text: string, references?: readonly TurnReference[]) => void): void
```

## 7 · Worked example (normative illustration for SPEC-R3/R4)

A persona holds: skill "House style" (enabled, in-context) · resource "Menu PDF" (enabled,
user-invocable) · tool `mcp:calc:*` (enabled, user-invocable). Ambient truth every turn: the
system prompt carries "House style" only; `integrations` is `[]`. The user types
"Total the dinner order — `@Menu` ⏎(commit)⏎ `/calc` ⏎(commit)": two chips appear; the editor
holds the bare question. On send: the user turn's text is the framed block for "Menu PDF" (label +
content, verbatim) followed by the typed question; that request's `integrations` is
`['mcp:calc:*']`, expanded server-side per ADR-0185 exactly as an ambient member would be. History
records the framed text; the next turn's `integrations` is `[]` again.

*(v0.5 annotation — under SPEC-R14 the ambient truth's first clause reads: the system prompt
carries "House style" as ONE index line (label + description), its full content arriving only if
the user tags `/House style`. Everything else in this example is unchanged — the framing path IS
the full-content path.)*

## 8 · Non-goals (SPEC-N1)

- **Inline pills inside the editor** — the plaintext-only editor architecture stands (§3); chips
  live in the chip row. An inline-pill editor is a future design of its own.
- **Pack/kind-level availability defaults** — per-entry only (§3); additive later.
- **Parameterized invocations** — no argument schemas; ADR-0132 Fork 3's deferral stands
  unchanged. `/name` invokes the entry as authored, nothing more.
- **New wire vocabulary** — `TurnInput`, `AdminTurnRequest`, proxy, and Worker schemas unchanged
  (SPEC-R4 AC4 is the fence).
- **`prompt-section` / `pattern-source` / `catalog` kinds** — their own selection semantics
  (composition order, single-pick, derived-enabled) are untouched; the availability field is inert
  on them (SPEC-R1).
- **Composers beyond the chat context** — the authoring/copilot composer keeps the props
  default-off this arc; wiring it later is a props-only change (SPEC-R6's default-off law is what
  makes that true).
- **Attachment size caps / truncation** — none this arc: a framed attachment rides history whole
  (SPEC-R4's owned trade). An LLD MAY introduce a stated per-block ceiling later without changing
  SPEC-R4's semantics; until one exists, big-resource byte growth is the user's visible,
  dismissable choice (the chip), not a silent mechanism.
- **Voice/mic, autocompletion of plain text, and `@` beyond Resources** — out; §3 grades the last.

## 9 · Build slices (each independently green; the #850 → #849 seam ruled here)

**Ruling (GH #850 Q5): #850 ships FIRST and standalone — S1 alone is a complete, honest #850.**
The mode is editable, persisted, round-trip safe, and prompt/wire gating is live; an entry marked
user-invocable goes genuinely dark until S3 lands, which is exactly the mode's contract ("inert
until invoked") — the row marker (SPEC-R2) keeps the state visible, and the `/`-menu lights up
when #849's slices land. No dark-launch flag needed; no S1 byte depends on S2/S3.

| Slice | Scope (requirements) | Issue | Gate (exit-code judged, foreground) | Landed |
|---|---|---|---|---|
| **S1 — availability mode** | SPEC-R1 (model+persistence) · SPEC-R2 (row affordance) · SPEC-R3 (ambient gating, all four surfaces) + the §10 stale-record repairs | #850 complete | new units in `entry-data.test.ts`/`entries.test.ts`/`agent-admin.test.ts` (incl. R3's gated-equivalence AC3) · `npm run check && npm test` | PR #855 |
| **S2 — composer grammar core** | SPEC-R5 (triggers/filter/dismiss) · SPEC-R6 (chip/commit/callback) · SPEC-R7 (keyboard/AX/event law) — generic, props-driven, zero agent-admin knowledge + S2's §10 repairs (incl. the pre-existing "six-event" comment drift) | #849 (component half) | `conversation-composer.test.ts` additions · ONE browser-shard case for R7 AC1 (focus/activedescendant need a real engine) · `npm run check && npm test` | PR #857 |
| **S3 — admin wiring + resolution** | SPEC-R8 (roster projection) · SPEC-R4 (turn-time resolution, both arms, history/log) | #849 complete | roster + resolution units in `agent-admin.test.ts`/`entries.test.ts` (R4's four ACs) · `npm run check && npm test` · a live proof on the dev surface before close (the pixel-truth law) | PR #859 — the SPEC's own dev-surface pixel proof is the operator's step; the build's real-engine stand-in is `agent-admin.browser.test.ts`'s whole-path case (both engines) |

S2 and S3 are parallelizable after S1 (S2 depends on S1 not at all; S3 depends on S1's field and
S2's callback shape). Every slice's seams are additive-optional, so partial landings never break
`main`.

## 10 · Stale-context bookings + open questions

Records this SPEC falsifies — repaired IN the landing slice's own change, never a follow-up
(the stale-context-is-a-defect law). All six are repaired; the slice column now reads as the record
of which change carried each repair:

| Record | Stale claim | Repair slice |
|---|---|---|
| `.claude/skills/agent-admin-library-kinds/SKILL.md` (Multi-enable row) | "N independent on/offs, all enabled compose" | S1 — gained the availability conjunct (PR #855) ✔ |
| `packages/agent-ui/app/src/controls/agent-admin/agent-admin.md` (system-view paragraph) | "every enabled capability entry" composes | S1 (PR #855) ✔ — S3 extended the same section with the reach path it promised (PR #859) |
| `entries.ts`'s ALM-C1 section header | "every ENABLED capability entry projected after it as labeled prose" | S1 (PR #855) ✔ |
| `agent-admin.ts`'s `#capabilityGroups` / `#enabledToolIds` doc comments | "does the enabled-filter/sort/master-gate itself" (and the ids projection's own filter description) — no availability conjunct | S1 (PR #855) ✔ |
| `conversation-composer.ts`'s editor-`input` suppression comment | pre-existing drift, exposed not caused by this arc: "the fleet's closed six-event vocabulary" — seven since ADR-0153 (the GH #754 copied-set class); S2 touches this file, so the sweep is booked there | S2 (PR #857) ✔ |
| `conversation-composer.md` + `conversation-composer.lld.md` (contract: props/callback inventory) | pre-widening seam inventory | S2 (PR #857) ✔ |

S3 booked no new record of its own: the one document its change falsifies is `agent-admin.md`, already
on this table, and it is repaired in the same change (the reach-path section).

Open questions — all four CLOSED, each where it was actually ruled. No LLD was authored for this arc,
so the three LLD-altitude questions were ruled IN BUILD, in code, inside the constraints their own
requirements already stated (the SPEC's altitude is unchanged by any of them):
- Chip visual treatment per kind and the row cohabitation — S2: the trigger character itself is the
  per-kind mark (no icon-set dependency), consumer `contextItems` chips keep the row's leading
  positions and composer-owned reference chips follow, each family rebuilding only its own
  (`conversation-composer.ts`'s `#syncReferenceChips`). *(Sigil clause SUPERSEDED v0.4 by SPEC-R9 —
  GH #891 drops the sigil from the chip; the cohabitation/rebuild clauses stand. This bullet stays
  verbatim as the v0.3 ship record.)*
- The framing block's exact byte grammar — S3: one `## Referenced for this message` header, a
  `### {label} ({kind})` block per resolved prose entry (description then content, verbatim), typed
  text last — the ambient projection's own block shape reused; `entries.ts`'s `resolveTurnReferences`
  doc comment is the home, and it states SPEC-R4's four constraints it was ruled inside.
- The row's mode control shape and marker glyph — S1: an "Invocable" toggle pill on the row plus a
  `data-availability` row marker (`entry-list.ts`).
- Whether GH #848's rename lands as an in-place `label` edit or a separate display field — ANSWERED
  by #848 itself (PR #856): an in-place `label` write, no second display field, so SPEC-R8's roster
  projection reads display truth straight off the entry and the "single repoint site" it named stayed
  a repoint site nobody had to use.

---

## 11 · GH #891 extension — chip rendering · sent-bubble reference tags · the capabilities menu

The owner's UX delta (GH #891, 2026-08-14) on the shipped R1–R8 contract. Three asks, four
requirements. Everything here is ADDITIVE to the shipped arc: no R1–R8 semantics change, and every
widened seam keeps the byte-identical-default law (§5). The one genuine contract fork — what the
capabilities switch MEANS — is [ADR-0190](../adr/0190-capabilities-menu-toggle-semantics.md)
(`proposed`, Kim ratifies); SPEC-R12 and slice S7 are gated on it, nothing else is.

### 11.1 · SPEC-R9 — Reference chips: no sigil; kind identity is an optional consumer icon

The committed chip MUST NOT render the trigger character (`/` or `@`) as a visible label part —
the owner's screenshot reads "/ itinerary-timeline ×", and the sigil prefix is the defect named
(GH #891 ask 1). The `[data-part="reference-chip-sigil"]` node is REMOVED, not restyled. What
identifies the chip instead:

- **Family** (rides-this-turn vs consumer context tag) — the shipped accent ink
  (`--ui-conversation-composer-reference-chip-*`, conversation-composer.css) already carries it;
  unchanged.
- **Kind** (skill vs workflow vs resource vs tool) — an OPTIONAL leading icon: `ReferenceOption`
  gains `icon?: string` (a `ui-icon` glyph name, opaque to the composer — the §5 layering law:
  the composer never maps `kind` to anything, the CONSUMER supplies the glyph), round-tripped
  onto `TurnReference` exactly as `kind` is. `ui-agent-admin` maps the four capability kinds to
  glyphs from the curated set (`icons.gen.ts`; extend the set via the GH #868 process only if
  none fits — exact glyph choice is build-altitude, ruled inside this constraint). `icon` absent
  ⇒ a label-only chip (the generic-consumer default), never a placeholder box.
- **CSS hook** — the shipped `data-kind` attribute on the chip stays; a themed consumer may
  restyle per kind without any icon.

AX is unchanged by construction: the sigil was `aria-hidden` (the dismiss button carries the full
accessible name, "Remove {label} from this turn"); the icon rides `data-role="icon"` the same way
every fleet adornment does.
*(→ GH #891 ask 1; §5's layering clause; GH #868's curated-glyph process)*
- **AC1** *Given* a commit, *then* the chip renders NO text node equal to the trigger character and
  no `[data-part="reference-chip-sigil"]` exists in the DOM; the chip's visible text is exactly the
  entry's label.
- **AC2** *Given* a `ReferenceOption` carrying `icon`, *then* the chip renders a leading `ui-icon`
  with that glyph and the reference delivered to `onSubmit` carries the same `icon` value; *given*
  no `icon`, *then* the chip is label + dismiss only.
- **AC3** *Given* the existing composer suite, *then* every non-sigil assertion passes unmodified
  (dismiss/dedupe/clear-on-send byte-identical); `npm run check && npm test` exit-code green.

### 11.2 · SPEC-R10 — The sent bubble: typed text + display-only reference tags (R4 unchanged)

GH #891 ask 2, ruled: **nothing remains inline in the typed text** (the shipped commit behavior —
token text leaves the editor, §3's inline-pill rejection stands, not reopened), and the record of
"what rode this turn" moves from the pre-send chips (which clear on send) to the SENT user bubble.

- `UIConversationElement.addUserMessage` widens ADDITIVELY to `(text, references?)`; the internal
  composer→bubble forwarder (conversation.ts's `onSubmit` registration) passes the turn's
  references through. Absent/empty ⇒ the bubble is byte-identical to HEAD (the existing suite
  passes unmodified).
- With references, the user bubble gains a `[data-part="reference-tags"]` row: one small tag per
  reference — label plus the R9 icon when present — visually attached to the bubble, distinct from
  the body text, dismiss-less (the turn is sent; there is nothing to remove).
- The tags are DISPLAY-ONLY truth of *what the user attached*: the bubble body stays the TYPED
  text verbatim (SPEC-R4's "the conversation UI keeps showing the typed text" clause, now with the
  tags carrying the attachment record), and the FRAMED text never renders in any bubble — wire
  truth stays where R4 put it (history, the turn log, the Context views). R4's semantics, ACs, and
  byte grammar are untouched.
*(→ GH #891 ask 2; SPEC-R4; SPEC-R6's clear-on-send law)*
- **AC1** *Given* a send with one committed reference, *then* the sent user bubble's body is the
  typed text (never the framed text — a `not.toContain` on the framing header) and the bubble
  carries one reference tag with the entry's label.
- **AC2** *Given* a send with zero references (or a consumer calling single-arg `addUserMessage`),
  *then* the bubble DOM is byte-identical to HEAD.
- **AC3** *Given* the R4 suite, *then* it passes unmodified — the recorded history turn is still
  the framed text.

### 11.3 · SPEC-R11 — The capabilities menu: a third trigger, composer-generic, fork-independent

The composer gains a third options-row affordance (GH #891 ask 3's surface), sibling of the
Models/Effort pickers, specified so that BOTH ADR-0190 arms wire onto it unchanged — the composer
never learns which arm won:

- **Prop** — `capabilities?: readonly CapabilityRow[]` (composer-options.ts vocabulary;
  `CapabilityRow {id, label, kind, description?, icon?, included: boolean}`), default `undefined`
  ⇒ NO trigger, NO DOM, byte-identical render (the `models`/`mentionables` default-off law).
  `kind`/`icon` are opaque strings (§5's layering clause); rows group by `kind` in
  first-appearance order (the `#buildReferenceOptions` grouping law, reused).
- **Trigger** — a picker-pill `ui-button` in the options-leading cell, built the `#buildPicker`
  way (leading glyph + caret, the GH #868 trigger convention; exact glyph build-altitude from the
  curated set), busy-disabled with the other triggers.
- **Panel** — opens on trigger, lists every row: label (+icon, +description) and a real
  `ui-switch` reflecting `included`. The panel STAYS OPEN across toggles (multi-toggle in one
  visit — this is a steering surface, not a commit-and-close picker, which is why it is NOT a
  `ui-menu` menuitem panel: menuitem action semantics close on activate). Escape, outside
  interaction, send, and `busy` close it; disconnect never orphans it (the reference-menu
  top-layer discipline).
- **Callback up, never state down** — flipping a switch fires `onCapabilityToggle(id: string,
  included: boolean)` and mutates NOTHING locally: the consumer owns the state and hands a new
  `capabilities` array down (the `onModelChange` props-down/callbacks-up law, verbatim). The
  composer stays store-blind under EITHER ADR arm — the fork is entirely consumer-side.
- **Event law** — NO new event name (ADR-0153's closed vocabulary, owned by the `ALLOWED_EVENTS`
  constants); the embedded switches' own `change`/`toggle` MUST NOT escape the host (`events: []`
  — the editor-`input` suppression discipline, applied at the panel boundary).
- **Relation to `@`/`/`** — the menu is the BROWSE/STEER surface (see every capability's state at
  a glance, flip several); the typeahead stays the keyboard-first quick path. They are siblings
  over the same consumer-owned truth, not alternatives: whether a menu-ON converges with the
  reference/chip mechanism is ARM SEMANTICS (SPEC-R12), not composer behavior.
*(→ GH #891 ask 3; SPEC-R6's default-off law; SPEC-R7's event law; ADR-0153)*
- **AC1** *Given* no `capabilities` prop, *then* the composer's DOM is byte-identical to HEAD
  (existing suite unmodified).
- **AC2** *Given* rows in two kinds, *then* the panel groups them, each row's switch reflects its
  `included`, and flipping one fires `onCapabilityToggle` with that row's id and the NEW state —
  while the panel stays open and the row's own DOM state changes only when the consumer hands a
  new array down.
- **AC3** *Given* the built diff, *then* no new event name appears and no switch event crosses the
  host boundary (the R7 AC2 grep + suites, exit-code green); a browser-shard case walks
  open → toggle → Escape with focus discipline asserted.

### 11.4 · SPEC-R12 — The switch's semantics: GATED on ADR-0190 (the roster-vs-turn fork)

What `included` MEANS — and therefore what `ui-agent-admin` wires `onCapabilityToggle` to — is
the fork [ADR-0190](../adr/0190-capabilities-menu-toggle-semantics.md) puts to Kim, `proposed`
with a recommendation, never ruled silently (GH #891's own open question):

- **Arm A — per-turn/ephemeral (the ADR's recommendation):** the switch steers THIS conversation's
  outgoing composition only. Rows derive fresh per open: ambient entries (`isAmbient`) show
  `included: true`, invocable entries `included: false` unless invoked; toggling never writes the
  entry store — an OFF on an ambient entry excludes it from the outgoing turn's projections
  host-side (zero transport change: prompt + `integrations` are computed per request), an ON on an
  invocable entry includes it exactly as a `/` commit does. Whether that ON mints the same
  reference/chip or rides a parallel ephemeral include list is the arm's own build ruling, inside
  R4's fail-closed constraints.
- **Arm B — persistent roster write:** the switch mirrors the entry's persisted state
  (`enabled`/availability) and a flip writes the store through the consumer — the composer menu
  becomes a remote control of the entry rows (SPEC-R2's surface). The composer contract is
  identical; only the agent-admin wiring differs.

Under EITHER arm: the composer never writes a store (R11), resolution stays by id and fail-closed
(R4), and the master switches win (R3/R4's precedence, unchanged). This requirement has no ACs of
its own until the ADR rules — S7 builds the ratified arm and mints the ACs from that arm's text.
*(→ GH #891 ask 3; ADR-0190; SPEC-N1's seam; SPEC-R2/R3/R4)*

*(v0.5 annotation — RULED: the owner's 2026-08-14 utterance (ADR-0190 rev.2, Context, verbatim)
picked arm B, refined into the three-tier reach model. The ruled contract with its ACs is
SPEC-R13, §12; S7 builds that. This section's two-arm text stays verbatim as the fork's ship
record. The ADR remains `proposed` — the pending flip is Kim's ratification of its REVISED text.)*

### 11.5 · Non-goals (SPEC-N2) + slices + bookings

Non-goals, this extension:
- **A composer-side store write** — off the table under BOTH ADR arms (R11); the fork is about
  consumer semantics only.
- **Transport/schema changes** — R4 AC4's empty-diff fence extends to every S4–S7 diff.
- **Replacing the typeahead** — the `@`/`/` quick path stands (R5–R7 untouched); the menu is a
  sibling surface.
- **The non-capability kinds** — `prompt-section`/`pattern-source`/`catalog` never appear in the
  menu (SPEC-R1's four-kind scope).
- **Framed text in any bubble** — the wire truth renders only where R4 already put it.

| Slice | Scope | Gate (exit-code judged, foreground) | Depends on |
|---|---|---|---|
| **S4 — chip de-sigil + kind icon** | SPEC-R9 + its bookings | composer suite additions · `npm run check && npm test` | nothing (shipped arc) |
| **S5 — sent-bubble reference tags** | SPEC-R10 + its bookings | conversation suite additions incl. R10 AC1's not-the-framed-text assertion · `npm run check && npm test` | nothing |
| **S6 — capabilities menu, composer contract** | SPEC-R11 + its bookings | composer suite + ONE browser-shard case (R11 AC3) · `npm run check && npm test` | nothing |
| **S7 — capabilities wiring** | SPEC-R12 (the ratified arm) *(v0.5: → SPEC-R13, §12 — the RULED global-switch semantics)* | agent-admin suites + a dev-surface pixel proof (the S3 precedent) · `npm run check && npm test` | S6 + **ADR-0190 (rev.2) ratified** |

S4/S5/S6 are mutually independent and fork-independent. S7 is the ONLY fork-gated work *(v0.5:
S8, §12, joins it behind the same ratification — one ruling, one gate)*.

Stale records this extension falsifies — repaired IN the landing slice, never a follow-up:

| Record | Stale claim | Repair slice |
|---|---|---|
| `conversation-composer.ts` — `CommittedReference`'s doc ("the chip's sigil") + `#syncReferenceChips`'s sigil comment | the trigger character renders as the chip's per-kind mark | S4 |
| `conversation-composer.css` — the reference-chip comment block's sigil prose | same claim, style-side | S4 |
| `conversation-composer.md` + `conversation-composer.lld.md` | pre-R9/R11 chip anatomy + prop/callback inventory | S4 (chip) · S6 (menu) |
| `conversation.md` + `conversation.lld.md` | single-arg `addUserMessage`, bubble anatomy | S5 |
| `agent-admin.md` — the reach-path section | no capabilities-menu projection | S7 |
| this SPEC's §10 chip-treatment bullet | annotated in place (v0.4) | done in this change ✔ |

---

## 12 · The ruled semantics + poor-man's progressive disclosure (v0.5 — the owner's 2026-08-14 ruling)

The ADR-0190 fork is RULED (the utterance, verbatim, lives in that ADR's rev.2 Context): the
capabilities switch is **a global enable/disable**, and — because the composed prompt has no
dynamic frontmatter-style loading — "ever present" must be cheap. Two requirements carry the two
halves; one carries the teaching. Everything here builds only after Kim ratifies the revised
ADR-0190 text (the §11.5 gate, extended to S8).

**The no-dynamic-loading fact, verified at HEAD (the ruling's stated assumption, confirmed):**
`composeLiveSystemPrompt` (entries.ts) composes the ENTIRE live system prompt client-side at every
turn — base sections + one `### {label}` + description + content block per ambient entry — and
both arms consume that one string per request: the prose arm sends it as `AdminTurnRequest.system`,
the surface arm threads it through the producer's ADR-0138 persona seam, where `buildSystemPrompt`
(a2ui `system-prompt.ts`) appends it VERBATIM as the trailing `personaBlock`. Nothing model-side
can pull text in later; the only paths that add capability bytes mid-conversation are the user's
own invocation (SPEC-R4's framing, which then rides replayed history) — so ambient cost is paid on
EVERY request, forever, and the ceiling has to be structural.

**The byte survey (2026-08-14, the shipped library packs at this commit (pinned to a9fc6f1e) — the realistic corpus:
`site/pages/agent-admin-libraries.ts` + the mini-skills registry; composition mirrors
`composeLiveSystemPrompt`'s exact block grammar):**

| Realistic agent | Entries | Ambient capability bytes, FULL content (today) | As index lines | Reduction |
|---|---|---|---|---|
| Hospitality concierge (idioms + hospitality packs, 3 live tools) | 24 | 10,167 B | 2,349 B | −76.9% |
| Games croupier (idioms + games packs incl. 7 rules resources) | 29 | 12,685 B | 2,550 B | −79.9% |
| Everything-added stress case (all packs) | 40 | 16,192 B | 3,499 B | −78.4% |

Per-entry averages: a full block weighs ~470–504 B (skills), ~305–326 B (workflows), ~362 B
(resources), ~218 B (tools); an index line weighs 65–102 B. The base persona (three default
sections) is 361 B — ambient capability prose is ~28–45× the persona it rides behind, and it is
unbounded in both entry count and per-entry content size, while the index composition is bounded
by count × one line. That asymmetry is the whole case for R14.

### 12.1 · SPEC-R13 — The switch, ruled: the global `enabled` write, three explicit tiers

`ui-agent-admin` MUST wire the capabilities menu (SPEC-R11's composer-generic contract, unchanged)
as a GLOBAL availability surface over the store's `enabled` truth:

- **Rows** derive fresh per menu open (the live-apply law): entries of the four capability kinds
  whose MASTER switch is on — BOTH availability modes AND both enabled states (a global off-switch
  that hides what it switched off cannot be flipped back on), `included` mirroring the entry's
  persisted `enabled`. Master-off kinds are absent (the admin surface owns the master switch).
  Deliberately NOT `buildComposerRosters` (which is enabled-only by contract, SPEC-R8) — its own
  projection beside it, same `ReferenceGroup` inputs.
- **A flip is a persistent store write** by the consumer in `onCapabilityToggle`: the entry's
  `enabled` set to the new state through the SAME store truth SPEC-R2's row toggle writes, visible
  on the entry row after re-render and surviving reload. The composer stays store-blind (R11 —
  the write lives entirely in `ui-agent-admin`).
- **The three tiers, taught by construction** (the two axes stay orthogonal, SPEC-R1 — the switch
  never touches `availability`): enabled + `context` = ever-present (ambient per R14, and still
  invocable from the typeahead for a full-content load) · enabled + `invocable` = included ONLY on
  express user invocation (the shipped R3/R4 semantics, byte-unchanged) · disabled = off
  everywhere (zero ambient bytes, absent from the `@`/`/` rosters, fail-closed at resolution).
- **A flip never invokes.** Toggling an invocable entry ON enables it — it mints no reference, no
  chip, no framing; per-turn inclusion remains the typeahead's job (R5–R8, untouched).
*(→ ADR-0190 rev.2 Decision; GH #891 ask 3; SPEC-R1/R2/R11; the `onModelChange`
props-down/callbacks-up law)*
- **AC1** *Given* an enabled in-context skill toggled OFF in the menu, *then* the store persists
  `enabled: false`, the entry row renders OFF on re-mount, and the NEXT turn's composed prompt
  carries nothing from it (index line included — a `not.toContain` on its label line).
- **AC2** *Given* a disabled tool entry, *then* the menu lists it with `included: false`; toggled
  ON, the store persists `enabled: true` and the next turn's `integrations` carries its id
  (in-context) — while the typeahead rosters, rebuilt, now include it.
- **AC3** *Given* an enabled invocable workflow toggled OFF then ON, *then* no reference or chip
  is ever minted, `availability` is byte-unchanged in the store, and its ambient contribution is
  zero throughout (the R3 invocable law).
- **AC4** *Given* the composer suite, *then* it passes unmodified (R11's store-blind seam — the
  diff touches `ui-agent-admin`, never the composer's own write paths).

### 12.2 · SPEC-R14 — Index-line ambient disclosure: label + description ambient, content on invocation only

An ambient (enabled + in-context) capability entry MUST contribute to `composeLiveSystemPrompt`'s
output exactly ONE index line — its label and its description, on the order of one line — and
NEVER its `content`, for all four capability kinds (a tool's real enablement is the
`integrations` wire, R3(b), byte-unchanged; its prose block indexes like the rest). The exact
line bytes are build-altitude inside these constraints: one line per entry, label then
description, content bytes appearing NOWHERE ambiently, groups keeping their `## {heading}`
homes and the R3 ordering/gating laws (master → `enabled` → availability, sort by
`order`/`id`). Full content reaches the model ONLY on the user's express invocation — SPEC-R4's
shipped framing path, which both availability modes already reach through the typeahead
(SPEC-R8 lists both modes) — and thereafter rides replayed history (R4's owned trade), which is
exactly the owner's "included once user expressly invoces/tags/triggers it".

What stays FULL, always:
- **`prompt-section` entries** — they ARE the agent (`composeSystemPrompt`, untouched). This is
  also the ruled escape hatch: text that must be verbatim-ambient belongs in a prompt section,
  not a capability entry. A per-entry "pin full" flag on capability entries is the named fork,
  ruled DEFAULT-NO this arc (a second full-content path would re-open the unbounded ambient
  growth the ruling closes; it returns to Kim only on real evidence, as its own fork).
- **The invocation framing** (R4's byte grammar) — the load path stays whole-content, unchanged.
- **`pattern-source` / `catalog`** — already excluded from this projection (their own semantics).

GATED EQUIVALENCE, restated for the new shape: a store with zero ambient capability entries
composes byte-identically to `composeSystemPrompt(sections)` (+ the R15 block never appears) —
the ADR-0136 Fork 3 law, carried forward.
*(→ ADR-0190 rev.2 Consequences; the §12 survey; SPEC-R3's surviving laws; SPEC-R4/R8;
GH #525's `BANKROLL_PATH_LINE` pinned-prose precedent)*
- **AC1** *Given* a store with one enabled in-context resource whose `content` is ≥ 2 KB, *then*
  the composed live prompt contains its label and description and NOT its content (a
  `not.toContain` byte assertion on a sentinel content substring), and a turn invoking it frames
  the full content per R4's unmodified suite.
- **AC2 (the byte budget, measured then asserted)** *Given* a fixture store seeded from the
  shipped library packs (≥ 20 entries, ≥ 10 KB total ambient content — the survey's own corpus),
  *then* the composed ambient capability weight is ≤ 30% of the same store's full-content
  composition (the survey measured 77–80% reduction; the assertion computes both shapes in the
  test and compares — a budget predicate, not a byte pin) AND every ambient entry's contribution
  is ≤ 200 B.
- **AC3** *Given* a store with zero ambient capability entries (all invocable, or none), *then*
  the output is byte-identical to `composeSystemPrompt(sections)` — and *given* the invocable
  half of R3's own suite, *then* it passes unmodified (invocable entries appear in no index).
- **AC4** *Given* the Context tab's System snapshot, *then* it renders the SAME index-shaped
  output (it renders `composeLiveSystemPrompt`'s string — inheritance by construction, asserted
  once).

### 12.3 · SPEC-R15 — The teaching block: the model is told the index is an index

When ≥ 1 capability index line composes, `composeLiveSystemPrompt` MUST compose ONE host-owned,
byte-pinned teaching block (the `BANKROLL_PATH_LINE` precedent: a module constant beside the
projection it teaches — entries.ts, NOT the a2ui mini-skill registry, which is producer/A2UI-side
and modality-wrong for the prose arm), ahead of the capability groups, stating three facts: the
capability lists below are an INDEX (names and descriptions only — full text not loaded); the
model CANNOT load an entry itself — only the USER can, by tagging it in the composer (`@name` for
resources, `/name` for skills/workflows/tools); when a task needs an indexed capability's full
text, ASK the user to tag it by name. Exact prose is build-altitude inside those three facts and
a ≤ 500 B ceiling; zero index lines ⇒ zero teaching bytes (the gated equivalence R14 AC3
asserts). Invocable entries stay OUT of the index and out of the teaching (R3's
zero-ambient-bytes law: they are genuinely dark until invoked — the typeahead, not the model, is
their discovery surface).
*(→ the ruling's "poor-mans solution" clause; GH #525's bootstrap lesson — an affordance nobody
is taught is an affordance that never fires; SPEC-R14)*
- **AC1** *Given* one ambient capability entry, *then* the composed prompt contains the pinned
  block exactly once, before the first capability `##` heading; *given* zero, *then* the block's
  sentinel substring appears nowhere.
- **AC2** *Given* the pinned constant, *then* a unit asserts it names the user-tagging mechanic
  (both trigger characters) and weighs ≤ 500 B.

### 12.4 · Non-goals (SPEC-N3)

- **Dynamic / model-triggered loading** — no frontmatter-style lazy context, no "load skill X"
  tool loop (that is the real fix, and it waits on the tool-execution loop ADR-0132 explicitly
  defers — parameter schemas first). This section is the poor-man's bridge, named as such.
- **A per-entry "pin full" flag** — default-no (R14's ruled escape hatch is the prompt-section
  route); returns to Kim as its own fork only on real evidence.
- **Index-line truncation / description caps** — none this arc: the description is user-authored,
  short by observed practice (65–102 B lines in the survey), and a silent cap is a hidden
  mechanism. R14 AC2's per-entry ceiling makes runaway descriptions VISIBLE in a red gate instead.
- **Changing the invocation framing** — R4's byte grammar and history-replay trade stand verbatim.
- **Per-turn ambient exclusion / session-sticky muting** — dead with the ruling (ADR-0190 rev.2
  Consequences); the R4 AC4 empty-diff transport fence extends over every S7/S8 diff.

### 12.5 · Slices + bookings

| Slice | Scope | Gate (exit-code judged, foreground) | Depends on |
|---|---|---|---|
| **S7 — capabilities wiring** (repointed, §11.5) | SPEC-R13 | agent-admin suites (R13 AC1–AC4) + a dev-surface pixel proof (the S3 precedent) · `npm run check && npm test` | S6 + **ADR-0190 rev.2 ratified** |
| **S8 — index-line disclosure + teaching** | SPEC-R14 · SPEC-R15 + the bookings below | `entries.test.ts`/`agent-admin.test.ts` additions incl. R14 AC2's budget assertion · `npm run check && npm test` | **ADR-0190 rev.2 ratified** (code-independent of S6/S7) |

S7 and S8 are mutually independent; one ratification gates both (one ruling, one gate).

Stale records S8 falsifies — repaired IN that slice, never a follow-up:

| Record | Stale claim | Repair slice |
|---|---|---|
| `entries.ts` — the ALM-C1 section header + `composeLiveSystemPrompt`'s doc comment | "each such entry rendered as `### {label}` + description + content" / "the model genuinely receives every ambient entry" (whole-content phrasing) | S8 |
| `entries.ts` — `resolveTurnReferences`' framing-grammar comment | "reuses the ambient projection's own `### {label}` block shape … the model meets an attachment in the same shape it already meets a capability" — the ambient shape becomes the index line; the framing keeps the block shape | S8 |
| `agent-admin.md` — the system-view paragraph | ambient entries compose as full labeled prose | S8 |
| `.claude/skills/agent-admin-library-kinds/SKILL.md` — the composition row | same whole-content claim (S1 added the availability conjunct; the SHAPE claim now drifts) | S8 |
