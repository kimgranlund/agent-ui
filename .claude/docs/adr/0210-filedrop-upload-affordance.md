# ADR-0210 — `FileDrop` enters the A2UI catalog as the fleet's file-input affordance (opens the ADR-0112 cl.1 named fence): a host-mediated HANDLE model — bytes never ride A2UI in either direction; the data model carries `{id,name,mimeType,sizeBytes}` descriptors minted by a host intake seam; constraint props `accept`/`multiple`/`maxSizeBytes`/`maxFiles`; one two-way `value:{prop:'files',event:'change'}` mark; no endpoint/URL prop by construction (the exfiltration class is unrepresentable, not validated away); content input, NOT the ADR-0176 credential-chrome class — the control mint + row land as their own build, never here

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each
> ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planning-leader seat (design leg of GH [#1354](https://github.com/kimgranlund/agent-ui/issues/1354), size:big — "A2UI catalog intake: FileDrop / upload affordance (the ADR-0112 cl.1 named fence)"; ADR number 0210 host-assigned — 0209 is held by open PR #1357) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-19, via the [`ratify ADR-0210` utterance](https://github.com/kimgranlund/agent-ui/issues/1354#issuecomment-5343984924) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification+build (its own build per #1354's Done — none of it authored here):** NEW `packages/agent-ui/components/src/controls/file-drop/` (`ui-file-drop`, the control mint — its own SPEC/LLD leg) · `a2ui/src/catalog/default/{catalog.json,factories.ts}` `FileDrop` row + factory (same wave as the mint per ADR-0087; the ADR-0134 TEMPORARY allowlist-seed pattern applies only if the control ships ahead of its row) · the renderer's host file-intake seam (cl.4 — LLD owns shape + home) · `.claude/docs/spec/a2ui-catalog.spec.md` §5.2 (the row delta drafted VERBATIM in §SPEC-delta below, deliberately UNAPPLIED by this record) · `agent/feed-catalog.ts` `FEED_SURFACE_TYPES` + the ADR-0097 partition table (cl.6 disposition: INCLUDE) · `agent/prompts/grammar.md` when-to-use clause + `live-agent/prompt-equivalence.baseline.json` recapture (`RECAPTURE_BASELINE=1`, the sanctioned writer) · [`../prd/feed-family.prd.md`](../prd/feed-family.prd.md) §3's "upload affordances" fence bullet (`:146-148`) gains a resolved-pointer to this ADR (the fence OPENS; the display-family reasoning it recorded stands — see Context) · [`0112-feed-family-v1-scope.md`](./0112-feed-family-v1-scope.md) cl.1 needs NO edit (its fence text already says "a new intake, never a rider" — this is that intake; a courtesy header pointer is optional housekeeping) |
(The row's `shipped` status cell presumes the ADR-0087 same-wave build — apply it with the mint, never ahead of it.)
> | **Supersedes / Superseded by** | (none). **Answers the ADR-0112 cl.1 named fence** ("attachment previews / upload affordances" — ruled out of the feed family's v1 as a foreseen extension, never a permanent exclusion; this record is the named new intake, and it confirms rather than contradicts ADR-0112's reasoning: upload is an *input* posture, so it enters as a NEW input-family type, not an `Attachment` widening). **Relates** [ADR-0176](./0176-identity-account-flow-family-design-intake.md)/PRD-D2 (the credential-chrome host-page-only ruling — cl.5 states why FileDrop is OUTSIDE that exclusion class: it collects conversation content, not authentication secrets) · [ADR-0019](./0019-pull-renderer-lld-c8-two-way-binding.md)/[ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md)/[ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) cl.7 (the `ValueSlot` contract cl.3's mark rides UNCHANGED — one slot, no `readProp`/`marshal` needed: the committed prop is already wire-named and JSON-safe by construction) · [ADR-0112](./0112-feed-family-v1-scope.md) Amendment 1 (the `sizeBytes` naming law — `size` is the reserved widget-tier geometry enum; cl.2/cl.3 reuse `name`/`mimeType`/`sizeBytes` verbatim so a committed `FileDrop` descriptor is renderable by the shipped `Attachment` row with zero mapping) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (row-or-recorded-exclusion, same wave — cl.6) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the TOTAL feed partition every new catalog type owes a disposition — cl.6: INCLUDE, `Textarea` parity) · [ADR-0137](./0137-a2ui-agent-producer-toolkit-export.md)/[ADR-0073](./0073-a2ui-live-model-provider-seam.md) trust boundary (byte materialization is transport/host business — cl.4) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (every default here must survive the CSS-less consumer — the unwired-host disabled state is component-owned, cl.4) · GH [#1211](https://github.com/kimgranlund/agent-ui/issues/1211) (the composer attach — the host-side prior art cl.4's seam shape mirrors) · GH [#1210](https://github.com/kimgranlund/agent-ui/issues/1210)/[#1214](https://github.com/kimgranlund/agent-ui/issues/1214)/[#1215](https://github.com/kimgranlund/agent-ui/issues/1215) (`document-ingest.ts` — the host-side extraction/budget prior art cl.4 cites as what a host DOES with intaken files) · **Resolves the design leg of GH #1354** (the build leg stays open, its own issue per #1354's Done). |

## Context

**The gap (GH #1354's own demand evidence, verified in-tree).** The catalog can render agent
*output* about files — `Attachment` (ADR-0112, `name`/`mimeType`/`sizeBytes`/`href`, a Display-only
leaf: "no `value` mark, no children", §5.2 row verbatim) — but has **no file INPUT vocabulary at
all**: an agent-emitted form that needs "hand me the CSV / the contract PDF / the screenshot"
cannot express it. The app meanwhile realizes exactly this affordance host-side, twice:

1. **The conversation composer's attach** (GH #1211, `app/src/controls/conversation/
   conversation-composer.ts:193-200,506-540,506-540`): three entry gestures (picker button over a hidden
   `<input type="file" multiple>`, drop-onto-composer, paste) all converging on ONE
   `onAttach(files: readonly File[])` callback — one call per gesture, the component deliberately
   **store-blind and kind-blind** ("it only hands the platform's own `File`s up"), opt-in (callback
   undefined ⇒ affordance hidden, platform default drop behavior untouched).
2. **agent-admin's document ingest** (GH #1210/#1211/#1214/#1215, `app/src/controls/agent-admin/
   document-ingest.ts`): the HOST side of the same flow — attach → extract text via a registered
   extractor seam (pdf lazy-loaded per ADR-0202) → budget-check (`MAX_RAW_FILE_BYTES`,
   `MAX_DOCUMENT_CHARS`, the aggregate `exceedsAgentKnowledgeBudget`) → render a chip with a
   human-readable size. The bytes themselves never leave the host uninspected.

**The fence being opened.** ADR-0112 cl.1 ruled "attachment previews / upload affordances" OUT of
the feed family's v1 with the fence recorded in `feed-family.prd.md` §3 (`:146-148`): *"upload is
an* input *posture (this type is display)"* — and cl.1's own closing law: *"Each fenced item is a
new intake or a named foreseen extension, never a rider."* This record is that intake. Note the
fence's reasoning is AGREED WITH, not overturned: precisely because upload is an input posture,
the answer is a new input-family type, not an `Attachment` widening — `Attachment` stays a
Display-only leaf, byte-untouched.

**Wire facts that bound the solution space (all verified against `a2ui/src/protocol.ts` and the
catalog SPEC):**

- The client→server channel is CLOSED and small: `action` (`A2uiAction` — `context` +
  optional `dataModel` snapshot), `functionResponse`, `error`. There is no byte/blob channel, no
  multipart arm, and the data model is JSON (per-path structural-sharing `setPointer`, `Object.is`
  cutoff waking — a megabyte base64 string at a path is a per-keystroke re-diff hazard the binding
  economics were never designed for).
- Actions already model the exact trust shape needed: a user gesture produces a small, structured,
  host-forwarded record; the HOST (proxy/transport, ADR-0073/ADR-0137) decides what reaches the
  backend. Files want the same ride.
- The two-way write direction is the `value` mark alone (`ValueSlot = {prop, event, readProp?,
  marshal?}`, ADR-0019/0161/0169 cl.7); `bindable` is read-direction only.
- The pinned upstream Basic catalog (ADR-0169 cl.9, the 18-type table) carries **no file-input
  type** — Video/AudioPlayer are its only file-shaped members and both are display, both EXCLUDED.
  There is no upstream name to align with; the type name is ours to mint.
- The ADR-0176/PRD-D2 exclusion class exists and must be distinguished from, not hand-waved past:
  identity/auth chrome is host-page-only *"not merely 'not yet'"* — cl.5 below does the
  distinguishing.

**Naming law in force:** `size` is the reserved widget-tier geometry enum (`sm|md|lg`) — ADR-0112
Amendment 1 renamed `Attachment.size` → `sizeBytes` fleet-wide for exactly this collision. Any
byte-count prop here follows suit.

## Decision

**`FileDrop` enters the default A2UI catalog as a new input-family type, backed by a new
`ui-file-drop` control, under a host-mediated handle model: the wire and the data model carry
host-minted file DESCRIPTORS only — bytes never ride A2UI in either direction.** Ruled in, not
out: the "keep it host-only forever" alternative is genuinely argued (and partially adopted — the
BYTE PATH stays host-only forever) in §Alternatives A. Seven clauses; the control mint's SPEC/LLD
own every mechanism this record only directions.

### 1 · In — and what "in" means

The catalog gains ONE type, `FileDrop`, rendering to ONE new control, `ui-file-drop`
(`components/src/controls/file-drop/` — dropzone + picker button + committed-file chips + a paste
target, the composer's three-gesture convergence as a standalone FACE control). The mint is its
own build (GH #1354's Done: "the shape-(iii) mint follows as its own build"), sequenced AFTER this
ADR ratifies. `Attachment` is untouched — display stays display; the input/display split ADR-0112
drew is preserved, now with both halves populated.

### 2 · The type's props — constraints are structural literals, not live bindings

| Prop | Type | Bindable | Notes |
|---|---|---|---|
| `files` | array of descriptors (cl.3) | **yes** — the value surface | read direction cl.3; write direction via the `value` mark |
| `label` | string | yes | the accessible name / instruction line ("Drop your CSV here") — never silent-empty |
| `accept` | string | **no** | the native `<input accept>` grammar verbatim (comma-separated MIME types / `.ext` — LLM-familiar, zero new grammar); absent ⇒ any |
| `multiple` | boolean | **no** | default `false` — the native default, and the conservative one |
| `maxSizeBytes` | number | **no** | per-file cap, bytes; the ADR-0112 Amendment 1 naming law (never `size`) |
| `maxFiles` | number | **no** | meaningful only with `multiple`; absent ⇒ host-policy cap only |
| `disabled` / `required` / `name` | boolean / boolean / string | no | the `TextField` form-participation trio, verbatim |

Constraints are **NOT bindable** — the `Swiper` structural-axis precedent: a live-retargeted
`accept` mid-selection is a desync generator, not a feature; an agent that wants different
constraints emits a new component. Constraint enforcement is layered: the component rejects a
non-conforming selection at the gesture **with a visible reason** (never a silent truncation —
the ADR-0112 no-glyph lesson class), and the host seam (cl.4) re-checks as the actual authority —
component-side checks are UX, never security (`document-ingest`'s budget posture). `checks`
(ADR-0029) is deliberately deferred: no predicate grammar over a descriptor array exists yet;
`required` + the constraint props are v1's validation surface — a foreseen extension, not a rider.

### 3 · The value model — descriptors, and one ordinary two-way mark

The bound value is an array of **host-minted file descriptors**:

```ts
interface FileHandleDescriptor {
  id: string        // host-minted opaque handle — unguessable, session/surface-scoped (cl.4)
  name: string      // ┐
  mimeType: string  // ├ the Attachment prop names VERBATIM (ADR-0112 + Amendment 1) — a committed
  sizeBytes: number // ┘ FileDrop descriptor is renderable by the shipped Attachment row, zero mapping
}
```

JSON-safe by construction — no `File`, no `Blob`, no bytes, ever. The `value` mark is ONE ordinary
slot: **`value: { prop: 'files', event: 'change' }`** — no ADR-0161 multi-slot array, no ADR-0169
`readProp`/`marshal` (the committed prop is already wire-named and JSON-shaped; the seam widening
exists and is simply not needed). `change` fires per committed MUTATION of the selection (a mint
completing, a chip removed) — never per progress tick; upload/extraction progress is
component-local UX, never data-model content (the data model is what the agent sees; a progress
stream through per-path bindings is the byte-hazard in miniature).

**Two-way semantics, both directions ruled:**
- **Write (control → data model):** the mark above — the committed descriptor array lands at the
  bound path; a subsequent submit action's `dataModel` snapshot carries it alongside every sibling
  field (SPEC-R7 / renderer LLD-C8, unchanged machinery).
- **Read (data model → control):** bound descriptors render as chips. An `id` the host's registry
  recognizes renders live (the round-trip case — e.g. the agent's `updateDataModel` removing one
  rejected file from the array, or re-presenting previously-attached files in a follow-up form);
  an `id` the host does NOT recognize renders as an **inert "unavailable" chip** — rendered, not
  dropped, because silently dropping data-model content makes the surface lie about its own state.
  Either way the agent gained nothing: a descriptor is a claim only the host's registry can honor.

### 4 · The trust boundary — the handle model, and what is unrepresentable by construction

1. **Bytes never ride A2UI, either direction.** Not in `updateDataModel`, not in a component
   node, not in an `action.dataModel` snapshot. The descriptor is metadata + an opaque `id`.
2. **The host mints ids** through a **host file-intake seam** the renderer exposes at
   construction (shape ≈ the composer's `onAttach`, made asynchronous:
   `(files: File[], ctx) => Promise<FileHandleDescriptor[]>` — one call per gesture, the control
   store-blind/kind-blind exactly as GH #1211 built it; the exact signature, registry home, and
   `ctx` contents are the LLD's). The host keeps the `id → content` association; ids are
   unguessable and scoped no wider than the session/surface. An agent echoing an id back grants
   nothing it didn't already have; a fabricated id resolves to nothing.
3. **No endpoint prop exists, by construction.** `FileDrop` carries no URL, no upload target, no
   `action`-on-drop — the control performs **zero network I/O**. An agent-suppliable upload
   endpoint is an exfiltration primitive no `safe-href`-style gate can fix (a perfectly "valid"
   https URL is exactly the attack); the class is made unrepresentable rather than validated.
4. **Byte materialization is the transport's, under host policy** — the same ride actions take
   (ADR-0137 `AgentTransport`/`Session`; the ADR-0073 boundary: the credentialed side stays
   server/host-side). When a turn's snapshot carries descriptors, the HOST decides what the
   backend receives: extracted text under budget (`document-ingest`'s exact posture), an
   `A2aFilePart` (`bytes|uri`) assembled host-side where the backend is A2A, a multipart upload,
   or nothing at all pending a host-chrome confirm. The catalog contract ends at the descriptor.
5. **The unwired host degrades visibly.** No intake seam registered ⇒ `ui-file-drop` renders
   disabled with a stated component-owned reason — never a silently dead dropzone (ADR-0102: the
   correctness of "this control cannot work here" may not live in page CSS).

### 5 · Why this is NOT the ADR-0176 credential-chrome class — stated, as the fence requires

ADR-0176/PRD-D2 rule identity/auth **host-page-only, "not merely 'not yet'"**: letting the agent
author the trusted frame that collects an authentication secret is a security inversion — a
phished credential is account takeover, and the secret's entire value is that it never reaches
the wrong party. The classifier is **what the input's content DOES, not what the widget looks
like**: a credential *authenticates the user to a system*; a file dropped into an agent's form
*is conversation content the user is knowingly handing the agent* — the same trust class as text
typed into the already-catalogued `Textarea`, whose keystrokes ride the snapshot with no
mediation at all. FileDrop under the handle model is in fact the STRONGER position: the host
stands between selection and disclosure (cl.4.4 — it can gate, confirm, budget, or redact before
any byte moves), a mediation `Textarea` text never gets. Residual risk — a user drops a
credential-bearing file — is host-policy territory the handle model was built to serve, not a
catalog-shape question. FileDrop therefore lands in the ADR-0172 "domain content pattern" class,
outside the PRD-D2 exclusion.

### 6 · The mandatory riders every new catalog type owes

- **ADR-0087 gate:** `FileDrop` row + `ui-file-drop` descriptor land the SAME wave (the build);
  if the control mint ships ahead of its row, it takes an ADR-0134-style TEMPORARY allowlist seed
  naming this ADR — never a silent uncatalogued control.
- **ADR-0097 feed disposition: INCLUDE** in the feed sub-catalog (`FEED_SURFACE_TYPES`) — the
  `Textarea` parity argument verbatim: commit-gated, inline, fully visible and operable, no
  overlay/paging; and the feed ask is where "attach the file to continue" naturally occurs.
- **SPEC §5.2 row:** drafted verbatim in §SPEC-delta below, applied only at ratification+build.
- **Teaching:** one `grammar.md` when-to-use clause at build (constraints-as-literals; "never ask
  for credentials/secrets via FileDrop" as the cl.5 boundary's prompt-facing restatement) +
  baseline recapture.

### 7 · Sequencing

This record ratifies the SHAPE. The build (control mint + row + seam + riders) is its own issue
per #1354's Done, with its own SPEC/LLD leg — nothing in this ADR is built on proposal. GH #1354's
design leg closes on ratification; its build leg is filed then.

## Alternatives — genuinely argued

**A. Keep it host-only forever (the status quo; the strongest rival).** The composer attach +
`document-ingest` already cover chat-shaped intake, and any app can wire its own dropzone.
*Adopted in part:* the BYTE PATH stays host-only forever — that half of this alternative is this
ADR's cl.4. *Rejected as a whole* because host chrome cannot be POSITIONED: an agent-authored form
("fill these three fields and attach the signed PDF") needs the file input inline, between
siblings, participating in the one submit snapshot — the composer is turn-scoped chrome outside
the surface, structurally unable to sit inside a generated form. The demand evidence is two
independent host-side reimplementations of the same affordance in one repo; the fence itself said
"foreseen extension," not "never."

**B. Bytes on the wire** (base64 into the data model, or inline `A2aFilePart.bytes`). Rejected:
(i) the per-path binding economics — megabyte strings under `Object.is`-cutoff waking and
structural-sharing snapshots is the exact hazard class the data model was designed against;
(ii) prompt/corpus blowup — snapshots and derived prompts would carry payloads; (iii) it hands
content to the model with zero host mediation, forfeiting the confirm/budget/redact position
`document-ingest` proves the host wants; (iv) no upstream alignment pressure exists (the Basic set
has no file type). Base64 also inflates 4/3× before any of that.

**C. Component-owned upload** (an endpoint prop; the control POSTs bytes). Rejected on cl.4.3's
argument: an agent-suppliable URL receiving user file bytes is an exfiltration primitive, and no
allowlist/`safe-href` analogue helps because a well-formed attacker URL is the attack itself. Also
network I/O inside a zero-dep catalog control, and an unanswerable CSS-less-consumer story for
upload state. Unrepresentable beats validated.

**D. Action-only** (no `value` mark; each selection fires an `action` carrying descriptors in
`context`). Genuinely attractive — actions already ride the transport host-mediated, and this
needed no schema at all. Rejected because the demand shape is FORM COMPOSITION: the selection must
sit in the data model so the ONE submit snapshot carries it with its sibling fields, `required`
can gate it, and the agent can correct it (`updateDataModel` removing a rejected file — cl.3's
read direction) — an action-per-gesture splits the turn and leaves no removal channel. The
action machinery still carries the eventual submit, unchanged.

**E. Permanent allowlist exclusion (the `Toast` class).** Rejected on the cl.6 criteria the Toast
class actually states: `FileDrop` is agent-emittable, one-shot-serializable content with no
imperative consumer-owned API — it fails every ADR-0112 cl.6 test for permanent exclusion. Writing
it onto the allowlist would be a category error the gate exists to catch.

## Consequences

- The catalog gains its first input type whose committed value the agent can never fully read —
  by design. The descriptor IS the agent-visible truth; content visibility is a host grant.
- `Attachment` symmetry pays off immediately: a form's committed files are re-renderable in the
  agent's next turn via the existing `Attachment` row with zero mapping (same `name`/`mimeType`/
  `sizeBytes` keys).
- A new host obligation exists: a surface embedding forms that may carry `FileDrop` SHOULD wire
  the intake seam; the unwired state is visible-disabled, not broken (cl.4.5).
- The renderer grows one construction-time seam (LLD-owned) — no change to the input controller,
  validator, or `ValueSlot` schema (cl.3 uses them as-is).
- Open questions parked for the ratifier / the build's SPEC-LLD leg (none block the shape):
  descriptor `id` lifetime (surface-scoped vs session-scoped — cl.4.2 says "no wider than
  session"; the build picks the point), the `ctx` contents of the intake seam call, whether
  paste-to-attach is in the v1 control or a follow-up gesture, and `maxFiles`'s absent-default
  interaction with host policy.

## SPEC-delta — the §5.2 row, drafted UNAPPLIED (applied verbatim at ratification+build)

> To be appended to `a2ui-catalog.spec.md` §5.2's table (and the §5.2 preamble's landed-wave
> enumeration gains "PLUS the 1 type landed by the FileDrop wave (ADR-0210)"):

```markdown
| `FileDrop` | `ui-file-drop` | **shipped** (ADR-0210, the ADR-0112 cl.1 fence opened). The fleet's file-INPUT affordance — a dropzone/picker/chips control under the host-mediated handle model: bindable `files` (array of host-minted `{id, name, mimeType, sizeBytes}` descriptors — the `Attachment` prop names verbatim, ADR-0112 Amendment 1; **bytes never ride A2UI in either direction** — `id` is an opaque host-scoped handle, byte materialization is transport/host policy, ADR-0210 cl.4) and `label` (the accessible name / instruction line); structural NOT-bindable constraint props `accept` (native `<input accept>` grammar), `multiple` (default false), `maxSizeBytes` (per-file bytes cap — never `size`, the reserved geometry enum), `maxFiles`; the `TextField` form-participation trio `disabled`/`required`/`name`. `value:{prop:'files',event:'change'}` — `change` fires per committed selection mutation, never per progress tick. Read-direction descriptors the host registry doesn't recognize render as inert "unavailable" chips (rendered, never dropped). The control performs no network I/O and carries no endpoint prop by construction (ADR-0210 cl.4.3); an unwired host intake seam renders the control visibly disabled with a component-owned reason (ADR-0102). No children. **Included in the feed sub-catalog** (`FEED_SURFACE_TYPES`, ADR-0097 §3 — the `Textarea` parity argument: commit-gated, inline, fully visible, no overlay) |
```
