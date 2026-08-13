# SPEC — Per-entry availability mode + composer tagging grammar (GH #850 · GH #849, one joint contract)

> Status: proposed · v0.2 · 2026-08-13 (v0.1 same day) · Layer: SPEC (execution contract)
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
> Refined by: an LLD at build dispatch (not yet authored — exact constants, file layout, chip
> styling, and the framing's byte grammar are its altitude, flagged per requirement below).
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

| Slice | Scope (requirements) | Issue | Gate (exit-code judged, foreground) |
|---|---|---|---|
| **S1 — availability mode** | SPEC-R1 (model+persistence) · SPEC-R2 (row affordance) · SPEC-R3 (ambient gating, all four surfaces) + the §10 stale-record repairs | #850 complete | new units in `entry-data.test.ts`/`entries.test.ts`/`agent-admin.test.ts` (incl. R3's gated-equivalence AC3) · `npm run check && npm test` |
| **S2 — composer grammar core** | SPEC-R5 (triggers/filter/dismiss) · SPEC-R6 (chip/commit/callback) · SPEC-R7 (keyboard/AX/event law) — generic, props-driven, zero agent-admin knowledge + S2's §10 repairs (incl. the pre-existing "six-event" comment drift) | #849 (component half) | `conversation-composer.test.ts` additions · ONE browser-shard case for R7 AC1 (focus/activedescendant need a real engine) · `npm run check && npm test` |
| **S3 — admin wiring + resolution** | SPEC-R8 (roster projection) · SPEC-R4 (turn-time resolution, both arms, history/log) | #849 complete | roster + resolution units in `agent-admin.test.ts`/`entries.test.ts` (R4's four ACs) · `npm run check && npm test` · a live proof on the dev surface before close (the pixel-truth law) |

S2 and S3 are parallelizable after S1 (S2 depends on S1 not at all; S3 depends on S1's field and
S2's callback shape). Every slice's seams are additive-optional, so partial landings never break
`main`.

## 10 · Stale-context bookings + open questions

Records this SPEC falsifies — repaired IN the landing slice's own change, never a follow-up
(the stale-context-is-a-defect law):

| Record | Stale claim | Repair slice |
|---|---|---|
| `.claude/skills/agent-admin-library-kinds/SKILL.md` (Multi-enable row) | "N independent on/offs, all enabled compose" | S1 — gains the availability conjunct |
| `packages/agent-ui/app/src/controls/agent-admin/agent-admin.md` (system-view paragraph) | "every enabled capability entry" composes | S1 |
| `entries.ts`'s ALM-C1 section header | "every ENABLED capability entry projected after it as labeled prose" | S1 |
| `agent-admin.ts`'s `#capabilityGroups` / `#enabledToolIds` doc comments | "does the enabled-filter/sort/master-gate itself" (and the ids projection's own filter description) — no availability conjunct | S1 |
| `conversation-composer.ts`'s editor-`input` suppression comment | pre-existing drift, exposed not caused by this arc: "the fleet's closed six-event vocabulary" — seven since ADR-0153 (the GH #754 copied-set class); S2 touches this file, so the sweep is booked there | S2 |
| `conversation-composer.md` + `conversation-composer.lld.md` (contract: props/callback inventory) | pre-widening seam inventory | S2 |

Open questions (none blocking; all LLD-altitude):
- Chip visual treatment per kind (mention vs invocation vs consumer `contextItems`) and the row
  cohabitation — LLD.
- The framing block's exact byte grammar (SPEC-R4 pins its constraints) — LLD.
- The row's mode control shape (icon toggle vs mini-menu) and marker glyph — LLD.
- Whether GH #848's rename lands as an in-place `label` edit or a separate display field — this
  SPEC is compatible with either (SPEC-R8 names the single repoint site).
