# LLD — a2ui-chat: the conversational agent surface

> Refines: [`../spec/a2ui-chat.spec.md`](../spec/a2ui-chat.spec.md) (SPEC-R1…R8). Build plan:
> [`../decompositions/a2ui-chat.decomp.json`](../decompositions/a2ui-chat.decomp.json) (coverage-clean, plan
> mode). · proposed · 2026-07-11 · designer (design intake, no component-design skill — a site-page teaching+
> demo composition, the `a2ui-message-lifecycle` intake's own precedent)
>
> **Composes on:** `site/lib/agent-runtime.ts` (transport/session/transcript/meta-line, unchanged),
> `site/lib/ask-registry.ts`'s `surfaceIdOf`/`componentTypesOf` helpers (reused, not forked), `@agent-ui/a2ui`'s
> `createRenderer()` (unchanged), `ui-status-stream` (unchanged), `ui-app-shell`/plain page chrome (no new
> region). **No new package, no new wire type, no new `ui-*` control, no new transcript.**
>
> **Freeze discipline.** §3's interfaces are the fan-out contract. A builder who cannot satisfy them stops and
> escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

Build to SPEC-R1…R8: the file map (§2), the frozen `SurfaceRegistry`/routing/narration interfaces (§3), the
worked turn script against the SHIPPED transcript (§4), the risks (§6), the build slices (§7), and the test
plan (§8).

## 2 · Components (file map)

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | Page shell + chat-log anatomy — single scrolling log, user/agent bubbles, composer, reset | `site/pages/a2ui-chat.ts` (new) + `site/a2ui-chat.html` (new) + `site/pages/a2ui-chat.css` (new) | SPEC-R1, R2 |
| LLD-C2 | `SurfaceRegistry` — per-surface host/mount/bubble lifecycle, generalizing `ask-registry.ts`'s `AskRegistry` from "asks only" to every surface | `site/lib/surface-registry.ts` (new) | SPEC-R3, R4 |
| LLD-C3 | Line router — routes each ingested line to the correct surface's host (fresh surface vs known surface vs delete), reusing `surfaceIdOf`/`componentTypesOf` from `ask-registry.ts` | `site/pages/a2ui-chat.ts` (LLD-C1's file, the `routeLine` function) | SPEC-R3, R4 |
| LLD-C4 | Narration driver — turn-duration `ui-status-stream` entries, mechanical-category + (when present) `TurnTrace` enrichment | `site/pages/a2ui-chat.ts` (the `narrate` function) | SPEC-R5 |
| LLD-C5 | Wire disclosure per bubble | `site/pages/a2ui-chat.ts` (the `a2a-artifact-feed.ts` `disclosure()` idiom, copied as page-chrome — not promoted to a shared lib export; a second copy is the deliberate cost, §6) | SPEC-R7 |
| LLD-C6 | Live overlay wiring | `site/pages/a2ui-chat.ts` (the `wireLiveOverlay()` pattern, copied from `a2ui-live.ts`, mirroring `a2a-artifact-feed.ts`'s own second copy) | SPEC-R8 |
| LLD-C7 | Nav + MPA entry | `site/main.ts` (one new nav row, the `a2ui-live` row's neighbor) | — |
| LLD-C8 | Test plan | `site/lib/surface-registry.test.ts` + `site/pages/a2ui-chat.test.ts` (jsdom) + `site/pages/a2ui-chat.browser.test.ts` (Chromium+WebKit) | SPEC-R1…R8 |

## 3 · Interfaces (frozen)

### LLD-C2 — `SurfaceRegistry`

```ts
export interface SurfaceEntry {
  readonly surfaceId: string
  readonly host: RendererHost
  readonly bubble: HTMLElement
  readonly mount: HTMLElement
  state: 'open' | 'closed'
}

export class SurfaceRegistry {
  /** Mount a FRESH host into `mount` (inside `bubble`) and register it 'open'. Throws if `surfaceId` is
   *  already known — the caller (the router, LLD-C3) MUST check `has()` first; this class never silently
   *  replaces an existing entry (the `AskRegistry.create` precedent, verbatim). */
  create(surfaceId: string, bubble: HTMLElement, mount: HTMLElement, onClientMessage: ClientMessageListener): SurfaceEntry
  get(surfaceId: string): SurfaceEntry | undefined
  has(surfaceId: string): boolean
  /** Dispose that ONE surface's host (tears down its mount's DOM) and annotate its bubble 'closed'.
   *  No-op (`false`) on an unknown or already-closed id — idempotent, like `AskRegistry.freeze`. */
  close(surfaceId: string): boolean
  /** Dispose every host and drop every entry (Reset). */
  disposeAll(): void
  readonly size: number
}
```

Deliberately narrower than `AskRegistry`: no `pending()`/at-most-one invariant (every surface is tracked
independently, not one at a time) and one state literal (`'open' | 'closed'`, not `'pending' | 'answered' |
'bypassed'` — a delivered surface stays interactive the whole time it is open; there is no "answered vs
bypassed" distinction here, only "open vs deleted"). `close()` is called from `deleteSurface` handling
(LLD-C3): it calls `entry.host.dispose()` (tears down that ONE surface's mounted subtree — never the whole
page, never another surface's host) and appends a visible annotation to `entry.bubble` (the
`annotateAskFrozen` precedent, one state instead of two: `"Closed."`).

### LLD-C3 — line routing (per turn, per line)

Applied after the existing `readMetaLine` peel (`a2ui-live.ts`'s gate, unchanged) — i.e. this router only
ever sees real A2UI JSONL lines, never a meta-line:

```
for each line the turn's transport stream yields:
  id = surfaceIdOf(line)                              // site/lib/ask-registry.ts, reused unchanged
  if id is undefined:
    // a callFunction/functionResponse-shaped line carries no surface context — ingest into the CURRENT
    // turn's own bubble host if one is already open this turn (the a2ui-live edge case, unchanged);
    // otherwise hold until a surface-bearing line in the same turn opens one.
  else if registry.has(id):
    registry.get(id).host.ingest(line)                // SPEC-R3: routes to the surface's ORIGINAL bubble
    if line is a deleteSurface envelope for id: registry.close(id)
  else:
    // a FRESH surfaceId — this turn's own createSurface line
    mount = a fresh inline mount element appended inside the CURRENT turn's own bubble
    host = createRenderer(); host.onClientMessage(handleClientMessage); host.mount(mount)
    registry.create(id, currentBubble, mount, handleClientMessage)
    registry.get(id).host.ingest(line)
```

This is the ENTIRE routing rule — no ask-specific carve-out, no `wantResponse`-adjacent special case (the
SPEC's non-goals: the `ask`/`AskDeclaration` field stays unused). At end of turn, call `finalize(surfaceId)`
only for the surface(s) THIS turn's lines actually touched (the already-shipped per-surface overload,
`renderer/renderer.ts`'s `finalize(surfaceId?: string)` — no new renderer API needed).

### LLD-C4 — narration

```ts
type Category = 'open' | 'restructure' | 'react' | 'close'

function categoryOf(line: string): Category | undefined {
  const msg = JSON.parse(line) as A2uiServerMessage
  if ('createSurface' in msg) return 'open'
  if ('updateComponents' in msg) return 'restructure'
  if ('updateDataModel' in msg) return 'react'
  if ('deleteSurface' in msg) return 'close'
  return undefined
}

const LABEL: Record<Category, string> = {
  open: 'Opening a new surface…',
  restructure: 'Updating the surface…',
  react: 'Updating data…',
  close: 'Closing the surface…',
}
```

Driven the same way `summarize()` already inspects a line's own envelope key (`a2ui-live.ts`'s
`Object.keys(msg).find(k => k !== 'version')`) — an EXISTING technique reused for a new purpose, no new
parsing primitive. One `ui-status-stream` entry per DISTINCT category the turn's lines touch (deduplicated
in emission order — a turn carrying two `updateDataModel` lines narrates "Updating data…" once), each
transitioning `pending → active → done` with a short pacing delay (`status-stream-demo.ts`'s `delay(60)`
precedent, reused) so the tail-follow/keyed-transition behavior is visibly live even against the near-instant
recorded transport. When a `TurnTrace` accompanies the turn (`meta.trace` — present only on the live arm,
absent on the shipped recorded transcript per `transcript.ts`'s own comment), append ONE further entry
stating `exemplars: […]`, `rounds`/`healed`, `model` verbatim — no re-derivation, no invented gloss
(SPEC-R5 AC2).

## 4 · Turn script — the shipped transcript, mapped

The demo plays `recordedTranscript` (`transcript.ts`) **unmodified** (SPEC-N4) — the table below is the
worked proof of SPEC-R2/R3/R4/R5 against the REAL, already-shipped five-turn arc, not a new script:

| Turn | Transcript content (verbatim) | Bubble / mount / annotation behavior |
|---|---|---|
| 1 | `createSurface:"canvas"` + Button (`canvasButtonSeed`) | A NEW bubble; a NEW mount; `registry.create('canvas', …)`; narration: "Opening a new surface…" |
| 2 | `createSurface:"confirmation"` + Column/Text | A NEW bubble (turn 2's own); a NEW mount; `registry.create('confirmation', …)`; narration: "Opening a new surface…" |
| 3 | `updateComponents:"confirmation"` (the `group` container resent, `+status`) **plus a trailing `updateDataModel:"/status"="Ready"` in the SAME turn** (`transcript.ts` `TURN3`, two lines) | NO new bubble — routes into turn 2's EXISTING mount via `registry.get('confirmation')`; narration: BOTH "Updating the surface…" AND "Updating data…" — the turn's lines touch two DISTINCT categories, so LLD-C4 emits two entries, not one |
| 4 | `updateDataModel:"confirmation"` (status value only, NO `updateComponents` this turn) | Same as turn 3 — turn 2's mount updates in place; narration shows ONLY "Updating data…" (SPEC-R5 AC1's literal, single-category check — this is the turn that proves it, not turn 3) |
| 5 | `deleteSurface:"confirmation"` | `registry.close('confirmation')` disposes turn 2's mount + annotates turn 2's bubble "Closed."; `canvas` (turn 1) untouched throughout |

Zero new transcript authoring is required — this table IS the acceptance evidence for SPEC-R3 AC1/AC2 and
SPEC-R4 AC1, played against the real shipped arc.

## 5 · Data shapes

No new wire/protocol type. `SurfaceEntry`/`SurfaceRegistry` (LLD-C2) are page-support TS, mirroring
`AskEntry`/`AskRegistry`'s existing shape — dropping the single-slot `pending()` invariant, collapsing the
state enum from `pending|answered|bypassed` to `open|closed`, and RETAINING a `mount: HTMLElement` field
`AskEntry` itself does not carry (there, `mountEl` is a `create()` parameter, not stored on the entry — here
it must persist on `SurfaceEntry` so `close()` can tear down that surface's own subtree without the caller
re-supplying it) (§3, §6). Every
A2UI envelope this LLD's router/narration functions inspect is the existing `A2uiServerMessage`
(`protocol.ts`) — no field added, no new discriminator invented (`categoryOf` reuses the same envelope-key
technique `a2ui-live.ts`'s `summarize()` already relies on).

## 6 · Risks

- **`SurfaceRegistry` vs `AskRegistry` duplication (deliberate, flagged, not an oversight).** Two near-
  identical per-surface-host lifecycle classes exist after this build. Unifying them now would touch
  `a2ui-live.ts`'s already-shipped, gate-covered ask machinery for a benefit this ticket doesn't need — asks
  there stay a one-pending-at-a-time flagged SUBSET (with an `answered`/`bypassed` distinction this SPEC has
  no use for); every `a2ui-chat` surface is symmetric, no flagged subset. Flagged as a FUTURE consolidation
  candidate if a third consumer appears; not built here (mirrors this SPEC's own Open Items §7).
- **Narration/render race.** A turn's category-narration entries and its surface mount both derive from the
  SAME line stream. `a2ui-live.ts`'s `runTurn` calls `host.finalize()` INSIDE its `try` block (right after the
  transport generator closes) — its `finally` block only resets the busy indicator, so a thrown turn there
  never reaches that `finalize()` call. This build must NOT copy that placement: narration `finalize()` MUST
  sit in a genuine `finally` (or an equivalent try/catch/finally that runs on every exit path) so a thrown
  turn still truncates narration cleanly (SPEC-R5 AC3) — an intentional improvement over `runTurn`'s
  try-scoped call, not a reuse of it. Verified by an intentionally-broken transport in a jsdom test (the
  `a2ui-live.ts` precedent test shape, `__setTransportForTest`).
- **Recorded pacing is cosmetic, never deceptive.** The `delay(60)`-style pacing exists ONLY to make tail-
  follow/keyed-transition legible against a near-instant recorded transport — it MUST NOT be framed as
  "thinking time" in any label (SPEC-N5); the page's own intro copy states the transcript is recorded, the
  honest-labels discipline every sibling demo page already carries.
- **A second `disclosure()` copy.** LLD-C5 copies `a2a-artifact-feed.ts`'s `disclosure()` helper rather than
  extracting a shared one — promoting it to `site/lib/` is a legitimate future cleanup, not blocking (the
  same "flag, don't force a premature shared abstraction" posture as the registry duplication above).

## 7 · Build slices (→ decomp.json)

1. `SurfaceRegistry` (LLD-C2) + its unit tests — pure, no page/DOM yet.
2. Page shell + chat-log anatomy (LLD-C1) — user/agent bubbles, composer, reset; wired to the RECORDED
   transport only.
3. Line router (LLD-C3) wired into the page — the shipped transcript plays end-to-end; surfaces land/update/
   close in the correct bubbles (§4's table, proven).
4. Narration driver (LLD-C4) — `ui-status-stream` entries per turn, category-derived + trace-enriched.
5. Wire disclosure (LLD-C5) + nav/MPA entry (LLD-C7).
6. Live overlay (LLD-C6) — dev-only, tree-shaken, mirrors `wireLiveOverlay()`.
7. Cross-engine browser proof (LLD-C8) — the open→narrate→render→update→delete arc, both scroll regions'
   tail-follow, wire disclosure, the live-arm tree-shake assertion.

## 8 · Test plan

| Test | Proves |
|---|---|
| `surface-registry.test.ts` | LLD-C2's create/get/has/close/disposeAll contract, incl. `close()` disposing exactly one host and annotating exactly one bubble, and `create()` throwing on a known id |
| `a2ui-chat.test.ts` (jsdom) | LLD-C3's routing rule against the shipped 5-turn transcript: turns 3/4 route into turn 2's mount (never a new one); turn 5 closes turn 2's mount and leaves turn 1's untouched (SPEC-R3 AC1/AC2, SPEC-R4 AC1) |
| `a2ui-chat.test.ts` (jsdom, cont.) | SPEC-R5 AC1 — recorded narration entries name only message-type categories via the `LABEL` table, never invented prose; SPEC-R5 AC3 — `finalize()` fires exactly once per turn, including a thrown-transport case |
| `a2ui-chat.browser.test.ts` (Chromium+WebKit) | The whole-shape arc live in a real engine: open→narrate→render→update→delete, both scroll regions' independent tail-follow (SPEC-R6 AC1), the wire disclosure opens to real JSON (SPEC-R7 AC1) |
| A tree-shake assertion (the `a2ui-live`/`a2a-artifact-feed` sibling precedent) | SPEC-R8 AC1 — the built static bundle contains no live-proxy-transport reference |
| The existing `layering.test.ts` import trip-wire (re-run, unmodified) | SPEC-R1 AC1/AC2 — no new protocol/wire type imported, no edit under `protocol.ts`/`renderer/*.ts`/`components/**` (a diff-review-backed, not newly-authored, check) |
| Manual `npm run dev` walk | SPEC-R5 AC2 — a live turn's narration surfaces real `TurnTrace` fields (human-observed; every gate above needs no live key) |

## 9 · Why this LLD carries no proposed ADR

Per the operating discipline (an ADR is earned only by a genuine, irreducible Kim-taste fork), every design
question this LLD resolves traces to one of three non-taste sources:

1. **The ticket's own explicit acceptance line** — the single-log, inline-rendering anatomy (SPEC-R2) is
   what TKT-0020 states directly ("the agent's work is visible AS IT OCCURS… rendered through the REAL A2UI
   renderer"), not a choice among equally-valid alternatives.
2. **An already-ratified precedent, reused, not re-litigated** — placement (SPEC-R1, the ticket's own named
   "lighter default" + PRD-D1's already-ratified M2 deferral), the live arm (SPEC-R8, the identical wiring
   pattern two sibling pages already ship), transcript reuse (SPEC-N4, the ADR-0073/ADR-0126 recorded-default
   + reuse-don't-fork discipline).
3. **A verified, forced consequence of shipped source** — the per-surface registry (SPEC-R3) follows directly
   from `RendererHost.mount(rootEl)`'s one-mount-per-host construction (`renderer/renderer.ts`), not from
   taste; narration honesty (SPEC-N5) follows directly from ADR-0088's already-ratified confabulation guard.

No fork surfaced here has two genuinely defensible directions where the difference is Kim's taste rather than
one of the above. If the build seat discovers one mid-build, it escalates per the standing "coordinated LLD
repair, never a silent deviation" rule (§ header) — the same discipline `a2ui-message-lifecycle.lld.md`
applied when it hit the root-immutability constraint empirically.

## 10 · Open items carried to build

- Exact narration label copy (LLD-C4 gives intent, not frozen final strings).
- Whether `SurfaceRegistry`/`AskRegistry` should later merge (flagged, §6 — not this build's job).
- Whether a future `@agent-ui/app` conversation-surface primitive should crystallize this page's per-surface
  registry pattern (flagged, SPEC §7 — not decided here).
