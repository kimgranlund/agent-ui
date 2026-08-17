// conversation.ts — UIConversationElement, the M2 thread/composer/narration primitive (LLD-C4/C5 ·
// SPEC-R4/R5/R6/R7/R13; ADR-0129 clauses 2/3; ADR-0180). BEHAVIOUR + props + the internal per-surface
// registry + narration + self-define ONLY; the thread/bubble layout lives in conversation.css, the public
// contract in conversation.md. The message-COMPOSITION UI itself (TKT-0056) is a separate composed/adopted
// child, `ui-conversation-composer` (own `.ts`/`.css`/`.md`) — this file forwards props down and callbacks
// up to it (the master-detail.ts → ui-split precedent), it does not build the composer's own DOM.
//
// ADR-0180 (GH #688) — an explicit OPT-IN declarative-composition adoption mode rides alongside the
// original imperative-only default: `connected()` looks up an author-supplied `:scope > ui-conversation-
// header` / `:scope > ui-conversation-dialog` / `:scope > ui-conversation-composer` and ADOPTS whichever
// exists instead of creating it — never a parallel imperative surface (clause 2); the whole turn/registry/
// narration/busy engine stays SOLELY on this element regardless of which path seated its parts. A consumer
// that authors NO children (a2ui-chat, a2ui-live, agent-admin — every consumer today) gets the
// byte-identical original shape; only an author of the new tags opts in. See conversation-dialog.md /
// conversation-header.md for the two new elements' own contracts.
//
// Renders its OWN internal thread (user/agent/system bubbles) + composer BY DEFAULT — the DOM is never
// author-composed UNLESS the ADR-0180 opt-in path above is used, driven otherwise entirely through the
// imperative API (SPEC-R4/SPEC-R13). Composes `ui-surface-host` INTERNALLY, one instance per OPEN A2UI
// surface (ADR-0129 clause 2) — generalizing `site/lib/surface-registry.ts`'s per-surface lifecycle
// (itself a generalization of `site/lib/ask-registry.ts`, ADR-0097 §2) as this element's OWN mechanism: a
// fresh `surfaceId` mounts a NEW `ui-surface-host` inline in that turn's own bubble; a KNOWN `surfaceId`
// (open or closed) routes to that surface's ORIGINAL host, at its original bubble — never a new mount for
// the same id (persistent identity across turns); a `deleteSurface` line disposes that ONE surface's host
// and leaves a VISIBLE, non-removable "Closed." annotation — history is never silently removed (SPEC-R7).
// This composition is edge-to-edge sound only because the accepted ADR-0128 makes a resent, already-
// mounted container's record reconcile correctly — a precondition this file assumes.
//
// `onSubmit`/`onClientMessage` are callback registrations, NEVER `CustomEvent`s (SPEC-R5) — the closed
// six-event vocabulary (`change · input · select · open · close · toggle`, references/naming.md §4) has no
// submission/client-message kind, and inventing a seventh is an ADR-gated admission this SPEC declines to
// request; callback registration follows the shipped `RendererHost.onClientMessage` precedent exactly.
//
// Narration (SPEC-R6, ADR-0088, ADR-0146): each agent turn composes a fresh `ui-status-stream` (with its
// opt-in streaming header set — ADR-0146 F8, so the strip reads "working" from t=0, closing the blank-
// bubble symptom at its root), categorizing lines via the SAME envelope-key inspection technique
// `a2ui-live.ts`'s `summarize()`/`a2ui-chat.ts`'s `categoryOf` already use — promoted UNCHANGED, never
// re-invented. Categories narrate LIVE-AT-INGEST now (ADR-0146 SPEC-R6 amendment): a category's entry
// appears the moment its FIRST line is ingested (`active` during the turn, `done` at finalize) — never the
// old post-hoc replay at finalize() (the `NARRATION_STEP_MS` pacing + `narrateCategories` replay are DELETED,
// not stranded). The turn's live lifecycle progress (ADR-0146 F1) routes through `AgentTurnHandle.progress`
// into the SAME strip via a CLOSED code-owned stage-label table (never model text — the F2 honesty guard).
// Narration ships unconditionally (no opt-out); the raw-wire `<details>` disclosure is gated behind the
// OPT-IN `disclosure` prop (default false, ADR-0129 clause 3) — the mechanism is rebuilt dependency-free
// here (no `@agent-ui/code` import; `site/lib/code-block.ts`'s syntax highlighting was page-local chrome,
// not part of this SPEC's contract) as a plain `<pre>` dump of the pretty-printed JSONL — same functional
// disclosure, no new dependency.
//
// SPEC-R12 (TKT-0071, added 2026-07-16): agent-turn `note` text and system-bubble text render through an
// OPTIONAL `setContentRenderer` hook instead of bare `textContent` when a consumer registers one — this
// file still imports NOTHING from `@agent-ui/code`; the renderer function itself (e.g. one backed by
// `ui-markdown`) is entirely consumer-supplied at the app/site layer, which already has permission to
// import that package. `addUserMessage` never routes through it (SPEC-R4 AC1 unchanged).
//
// RESOLVED LLD GAP (ADR-0146): the shipped build's own NAMED GAP flagged that SPEC §4's `AgentTurnHandle`
// exposed exactly four methods with no reachable call site to SUPPLY a fifth narration input — declining to
// widen the contract unilaterally, it surfaced the "widen `AgentTurnHandle` or drop the promotion note"
// fork to the design seat. ADR-0146 F1/F8 rules WIDEN: the handle gains `progress(ev: TurnProgress)` (the
// §4 contract change the app-surfaces-m2 amendment records), routing the live-turn lifecycle channel into
// the strip. (The LLD's `narrateTrace`/`TurnTrace` is a separate browser-side DIAGNOSTIC, not a narration
// entry — it stays out of this narration surface, unchanged by this widening.)

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { UIStatusStreamElement } from '@agent-ui/components/components'
// GH #291/ADR-0160 clause 3 — the settled-turn action-chip row reuses `ui-button` (the
// ui-status-stream inline-retry-action precedent, GH #147/ADR-0153 Fork 2) rather than hand-rolling a
// chip control; registered here exactly like that precedent's own import.
import '@agent-ui/components/controls/button'
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import '../surface-host/surface-host.ts' // registers <ui-surface-host> — composed internally (ADR-0129 clause 2)
import type { UISurfaceHostElement } from '../surface-host/surface-host.ts'
// genui-surface.spec.md SPEC-R8/PRD-G8 — registers <ui-sandbox-frame> (PRD-D9, `@agent-ui/components`,
// catalog-invisible by construction); composed internally exactly like `ui-surface-host` above, but via a
// PARALLEL mount path (`#genuiRegistry`/`mountGenui`, not `ingestLine`'s A2UI-shaped registry) — a genui
// line carries no `createSurface`/`updateComponents`/etc envelope key `surfaceIdOf` could ever parse.
import '@agent-ui/components/controls/sandbox-frame'
import type { UISandboxFrameElement, GenuiActionDetail, SandboxFrameAssets } from '@agent-ui/components/components'
import type { ClientMessageListener, A2uiClientMessage } from '@agent-ui/a2ui'
// ADR-0146 F1: the live-turn progress vocabulary is produce-layer-owned (a2ui) — imported TYPE-ONLY (it
// erases at build, so zero producer bytes cross the ADR-0137 identity gate) as the shared spine both the
// pipeline (produce()) and this narration surface consume, so the two never drift. Imported from the PURE
// `meta-line` module (not the `./agent` barrel) so the app/site type-check never drags in the barrel's
// NODE-FIRST modules (system-prompt/mini-skills `readFileSync` at load — no node types under those tsconfigs).
import type { TurnProgress, TurnProgressStage } from '@agent-ui/a2ui/agent/meta-line' // cross-package specifier stays extensionless (the repo's own local-.ts-only convention) — a2ui/package.json exports this as its own subpath
import './conversation-composer.ts' // registers <ui-conversation-composer> (TKT-0056) — adopted-or-composed, the master-detail.ts → ui-split precedent
import type { UIConversationComposerElement } from './conversation-composer.ts'
// ADR-0180 (GH #688) — registers the two NEW declarative-composition tags this element's connected() may
// ADOPT (an author-supplied direct child) instead of creating. `UIConversationDialogElement` also narrows
// `#log`'s own field type below (it now owns the scroll-follow public-method seam, ADR-0023).
import './conversation-dialog.ts'
import type { UIConversationDialogElement } from './conversation-dialog.ts'
import './conversation-header.ts'
import type { UIConversationHeaderElement } from './conversation-header.ts'
import type { PickerOption, ProviderOption, ContextItem, ReferenceOption, TurnReference, CapabilityRow } from './composer-options.ts'

// GH #1030 (client-side auto-attach, HYBRID design (b) — ADR-0190 amendment, `capability-availability-
// tagging.spec.md` §13/SPEC-R16) — case/punctuation/whitespace-normalized SQUASH: lowercased, every
// non-alphanumeric character (space, hyphen, apostrophe, any other punctuation) deleted outright rather
// than treated as a token boundary. Applied to a whole LABEL this collapses it to one target string —
// "texas-holdem" and "Texas Hold'em" both squash to `'texasholdem'` — and applied per WHITESPACE-delimited
// WORD of the typed text, consecutive words' squashed forms concatenate the same way, so a text word split
// differently from the label's own internal punctuation ("hold'em" as one text word vs the label's own
// word count) still lines up: EXACT match, never fuzzy — a candidate whose squashed label never equals a
// squashed run of consecutive text words simply never matches.
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The EARLIEST word index in `words` (already `squash`-ed, one per whitespace-delimited word of the typed
 * text) where the CONCATENATION of one or more consecutive words equals `target` exactly, or `-1`. Growing
 * the run word-by-word and bailing the moment it's longer than `target` keeps this linear per start index
 * — no candidate ever gets an unbounded scan. */
function indexOfSquashedRun(words: readonly string[], target: string): number {
  for (let i = 0; i < words.length; i++) {
    let acc = ''
    for (let j = i; j < words.length; j++) {
      acc += words[j]
      if (acc.length > target.length) break
      if (acc === target) return i
    }
  }
  return -1
}

/**
 * GH #1030 — the ONE auto-attach candidate, or `undefined`: among `options` (the caller's already-
 * REACHABLE roster — `entries.ts`'s `buildComposerRosters` output, enabled entries of a master-on kind
 * only, so "ENABLED" holds by construction and never needs a second filter here), the entry whose FULL
 * `label`, squashed, equals the squashed concatenation of one or more consecutive words of `text`,
 * EARLIEST in the text. `exclude` drops a candidate already explicitly referenced (same `kind`+`id`) — an
 * exact mention of something the user ALSO tagged by hand is not a second attachment. Ties (two candidates'
 * matches start at the same word index — only possible for two entries sharing a squashed label) resolve to
 * whichever comes first in `options`, deterministically. No description match, no fuzzy scoring (the
 * ruled-out false-positive-risk alternative) — an entry not literally named in full is never auto-attached. */
function findAutoAttachOption(
  text: string,
  options: readonly ReferenceOption[],
  exclude: readonly { kind: string; id: string }[],
): ReferenceOption | undefined {
  const words = text.split(/\s+/).filter((w) => w.length > 0).map(squash)
  let best: { option: ReferenceOption; start: number } | undefined
  for (const option of options) {
    if (exclude.some((e) => e.kind === option.kind && e.id === option.id)) continue
    const target = squash(option.label)
    if (target === '') continue
    const start = indexOfSquashedRun(words, target)
    if (start === -1 || (best !== undefined && start >= best.start)) continue
    best = { option, start }
  }
  return best?.option
}

/** `ReferenceOption` → `TurnReference`, the SAME icon-omission convention the composer's own explicit-
 *  commit path uses (`conversation-composer.ts`'s `#commitReference`) — never an explicit `icon: undefined`
 *  key, so a no-icon roster entry's auto-attached reference is byte-identical to one a user committed by
 *  hand. */
function turnReferenceOf(option: ReferenceOption): TurnReference {
  return {
    id: option.id,
    label: option.label,
    kind: option.kind,
    ...(option.icon === undefined || option.icon === '' ? {} : { icon: option.icon }),
  }
}

const props = {
  // OPT-IN raw-wire disclosure (ADR-0129 clause 3) — reflected, default false. Narration itself (below)
  // ships unconditionally; this gates only the per-turn `<details>` wire dump, a debugging/inspection
  // affordance most product surfaces should not show by default.
  disclosure: { ...prop.boolean(false), reflect: true },

  // Vision rev.5 (agent-admin's Agent master switch) — the whole-conversation availability gate: while
  // true the composer renders busy-disabled (same visual/behavioral state as a turn in flight, ONE
  // mechanism) and `#send` no-ops. Orthogonal to the TKT-0034 in-flight COUNT — the two OR together at
  // every reflect site, so flipping this mid-turn can never unstick or double-free the busy counter.
  disabled: { ...prop.boolean(false), reflect: true },

  // GH #239/ADR-0159 — the OPT-IN receipt pattern for the per-turn narration strip (Kim's 2026-07-23
  // ruling): when true, every turn's `ui-status-stream` gets BOTH stream-level opt-ins (`oneline` — the
  // live one-morphing-line mode — and `receipt` — the terminal one-line receipt). Reflected, default
  // false: every existing consumer keeps the always-expanded narration byte-identically.
  receipt: { ...prop.boolean(false), reflect: true },

  // GH #240/ADR-0159 wave B — the OPT-IN per-step SOURCE reveal (Kim's ruling, part 3): when true, each
  // narrated step carries the raw wire line(s) it stands for as `StatusEntry.source`, and ui-status-stream
  // renders the collapsed mono reveal — a category entry ("Opened a new surface") carries its own ingested
  // A2UI JSONL (accumulated per category as the turn streams), and a progress entry carries whatever
  // `TurnProgress.source` the producer attached under ITS `progressDetail:'source'` opt-in. Reflected,
  // default false — AND fail-closed both ways: when false, category lines are never attached and a
  // producer-attached progress `source` is DROPPED (belt to the producer's own gate), so the default
  // narration stays byte-identical even against a source-carrying stream.
  sources: { ...prop.boolean(false), reflect: true },

  // ── The opt-in composer capabilities (the Figma chat-input refactor) ────────────────────────────────
  // Every one below defaults to undefined/empty, so an existing consumer that never sets them (a2ui-chat,
  // a2ui-live) gets the ORIGINAL field+Send composer, unchanged. A consumer (e.g. ui-agent-admin) opts in
  // by supplying its own option list + selected value; ui-conversation stays generic — it never names a
  // model or hardcodes "Effort"'s levels beyond the shared `EFFORT_LEVELS` constant a consumer may reuse.
  models: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  model: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  efforts: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  effort: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // GH #257 — the Provider/Mode axes, forwarded to the composed child exactly like models/model/efforts/
  // effort above: `undefined` (default) ⇒ neither picker renders, byte-identical for every existing
  // consumer (a2ui-chat) that never sets them.
  providers: { ...prop.json<readonly ProviderOption[] | undefined>(undefined), attribute: false as const },
  provider: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  modes: { ...prop.json<readonly PickerOption[] | undefined>(undefined), attribute: false as const },
  mode: { ...prop.json<string | undefined>(undefined), attribute: false as const },
  // `undefined`, not `[]` (the schema/store/models/efforts precedent) — an array literal default cannot
  // round-trip through the descriptor's `default:` token (ADR-0004); forwarded straight through to the
  // composed `ui-conversation-composer` child (TKT-0056), which coalesces to `[]` at its own read site.
  contextItems: { ...prop.json<readonly ContextItem[] | undefined>(undefined), attribute: false as const },
  // GH #849 — the composer's `@`/`/` reference rosters, forwarded straight through to the composed child
  // exactly like every picker list above (this element adds NO semantics of its own: `ReferenceOption.kind`
  // stays an opaque consumer string all the way down). `undefined` (default) ⇒ no typeahead at all, so
  // every existing consumer is byte-identical. A committed reference comes back up through `onSubmit`'s
  // widened second argument.
  mentionables: { ...prop.json<readonly ReferenceOption[] | undefined>(undefined), attribute: false as const },
  invocables: { ...prop.json<readonly ReferenceOption[] | undefined>(undefined), attribute: false as const },
  // GH #891/SPEC-R11 — the composer's capabilities panel rows, forwarded pass-through exactly like the two
  // rosters above: `CapabilityRow.kind`/`icon` stay opaque consumer strings all the way down, and what a
  // flip MEANS is the consumer's (ADR-0190 rev.2 ruled it a global `enabled` write, wired in
  // `ui-agent-admin`) — this element only carries rows down and `onCapabilityToggle` up. `undefined`
  // (default) ⇒ no trigger, no panel, byte-identical for every existing consumer.
  capabilities: { ...prop.json<readonly CapabilityRow[] | undefined>(undefined), attribute: false as const },
} satisfies PropsSchema

/** GH #291/ADR-0160 clause 3 (Kim's 2026-07-27 ruling) — a CONSUMER-DEFINED pre-hydrated inline-action
 *  chip on a settled agent turn: "was this any good?" → a Helpful/Not-Helpful pair, or a question's
 *  quick replies → "Yes"/"No" — a GENERAL mechanism, never a hardcoded pair. `id` is the value the
 *  fired `action` event names (the consumer's own vocabulary — never interpreted by this primitive);
 *  `label` is the chip's visible text. */
export interface TurnAction {
  readonly id: string
  readonly label: string
}

/** The imperative per-turn driver the APP'S OWN transport loop calls — NOT a DOM type (SPEC-R8). */
export interface AgentTurnHandle {
  /** Routes one raw A2UI JSONL line by `surfaceId` to a fresh/known `ui-surface-host`, or narrates a
   *  no-surface line under this turn's own category tracking. */
  ingestLine(line: string): void
  /** genui-surface.spec.md SPEC-R5/R8 (PRD-G8) — mounts one genui envelope by `surfaceId`: a FRESH id
   *  mounts a NEW `ui-sandbox-frame` inline in THIS turn's own bubble (the `ingestLine` fresh-host
   *  precedent, applied to a structurally different host); a KNOWN id rebuilds the EXISTING frame's
   *  `.html` in place (SPEC-R5's atomic "replace" lifecycle — the control's own effect rebuilds the whole
   *  srcdoc, frame-internal state lost BY DESIGN). A PARALLEL mechanism from `ingestLine`'s A2UI-shaped
   *  registry, never a fork of it — a genui envelope carries no `createSurface`/`updateComponents`/etc
   *  key `surfaceIdOf` could route on.
   *
   *  genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — `assets`, when given, sets the frame's
   *  own `assets` prop (the docs-like CSS+JS pair) BEFORE `.html`, so the model document's first paint
   *  already has the fleet runtime loaded (`buildSrcdoc`'s host-prelude-before-model-bytes ordering).
   *  Omitted/`undefined` ⇒ the frame's own default (mode-off, byte-identical to today) — the SAME
   *  degradation law every other genui field carries. LIVE-APPLY: a KNOWN id's rebuild ALSO re-applies
   *  `assets` on every call (never sticky from a prior envelope) — the toggle's "next mounted/replaced
   *  surface reflects it" law (LLD-C4), not a one-shot mount-time-only setting. */
  mountGenui(surfaceId: string, html: string, assets?: SandboxFrameAssets): void
  /** Stashes this turn's own prose note (ADR-0088) and paints it into the bubble immediately (never a
   *  fabricated sentence) — a non-empty call reveals the bubble on its FIRST token (GH #313: "no bubble
   *  unless there is content for it"), so a streaming caller may call this repeatedly as text accretes.
   *  `finalize()` re-renders the same (or, if never called, a factual fallback tally) text unconditionally. */
  setNote(text: string): void
  /** ADR-0146 F1/F8 — routes one live-turn lifecycle event into the narration strip through a CLOSED,
   *  code-owned stage-label table (never model text, never a fabricated/speculative claim — the F2 honesty
   *  guard; an unobserved/unknown stage renders NOTHING). The fifth handle method the app-surfaces-m2 §4
   *  amendment records. A consumer that never calls it is byte-behavior-unchanged. GH #240/ADR-0159 wave
   *  B: a producer-attached `ev.source` (the `progressDetail:'source'` opt-in) feeds the entry's per-step
   *  reveal — only when this element's own `sources` prop is set; dropped otherwise (fail-closed). */
  progress(ev: TurnProgress): void
  /** Ends narration, renders the note (or a factual fallback tally), and settles every surface host this
   *  turn touched. GH #291/ADR-0160 clause 3 — an optional, non-empty `actions` row renders as a
   *  pre-hydrated chip row on THIS settled turn's bubble, appended after the wire disclosure (when
   *  both are present); clicking any chip removes the whole row (one-shot commit) and fires this
   *  host's `action` event with `{ id }` naming the chosen action — the SAME closed-vocabulary member
   *  ui-status-stream's inline retry button already uses (ADR-0153), never an eighth. Omitted/empty
   *  ⇒ byte-identical to every existing caller. */
  finalize(actions?: readonly TurnAction[]): void
  /** A thrown turn (SPEC-R6 AC3): narration truncates with an error entry, a system bubble surfaces
   *  `message`, still finalizes cleanly. Never touches this turn's OWN agent bubble — GH #313: if it
   *  never received real content (no note/mount/chip), it stays hidden rather than lingering as an
   *  empty pill beside the system bubble's error text. */
  fail(message: string): void
}

type Role = 'user' | 'agent' | 'system'
type SurfaceState = 'open' | 'closed'

interface SurfaceRecord {
  readonly host: UISurfaceHostElement
  readonly bubble: HTMLElement
  state: SurfaceState
}

/** genui-surface.spec.md SPEC-R5/R8 — the PARALLEL per-surface record for a mounted `ui-sandbox-frame`
 *  (the `SurfaceRecord` shape, minus `state`: a genui surface has no `deleteSurface`-driven closed state —
 *  SPEC-R5's lifecycle is build/replace/teardown only, no "Closed." annotation concept). */
interface GenuiSurfaceRecord {
  readonly host: UISandboxFrameElement
  readonly bubble: HTMLElement
}

// ── narration categories (LLD-C5, SPEC-R6) — promoted UNCHANGED from a2ui-chat.ts ─────────────────────────

type Category = 'open' | 'restructure' | 'react' | 'close'

/** A stage/category label PAIR (GH #238/ADR-0159): the progressive `live` form while the step runs, the
 *  quiet past-tense `done` form stamped ON the transition to done — a done checkmark never wears an
 *  "-ing…" label again (Kim's 2026-07-23 receipt-pattern ruling, part 1). A step that never finishes
 *  (truncated/failed) keeps its `live` form — the done form is never claimed for work not completed. */
interface LabelPair {
  live: string
  done: string
}

const LABEL: Record<Category, LabelPair> = {
  open: { live: 'Opening a new surface…', done: 'Opened a new surface' },
  restructure: { live: 'Updating the surface…', done: 'Updated the surface' },
  react: { live: 'Updating data…', done: 'Updated data' },
  close: { live: 'Closing the surface…', done: 'Closed the surface' },
}

/** The SAME envelope-key inspection technique a2ui-live.ts's summarize()/a2ui-chat.ts's categoryOf already
 *  use — never a re-invented parser. `undefined` for an envelope kind narration has no category for. */
function categoryOf(line: string): Category | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, unknown>
  if ('createSurface' in m) return 'open'
  if ('updateComponents' in m) return 'restructure'
  if ('updateDataModel' in m) return 'react'
  if ('deleteSurface' in m) return 'close'
  return undefined
}

/** `surfaceId` targeted by one raw A2UI JSONL line — `undefined` for an envelope kind with no surface
 *  context (e.g. `callFunction`) or an unparseable line. Never throws. Promoted from ask-registry.ts. */
function surfaceIdOf(line: string): string | undefined {
  let msg: unknown
  try {
    msg = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof msg !== 'object' || msg === null) return undefined
  const m = msg as Record<string, { surfaceId?: unknown } | undefined>
  for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const) {
    const body = m[key]
    if (body && typeof body.surfaceId === 'string') return body.surfaceId
  }
  return undefined
}

function isDeleteSurfaceFor(line: string, id: string): boolean {
  try {
    const msg = JSON.parse(line) as { deleteSurface?: { surfaceId?: string } }
    return msg.deleteSurface?.surfaceId === id
  } catch {
    return false
  }
}

// The closed, code-owned progress stage → label table (ADR-0146 F2/F8) — factual PROCESS labels keyed 1:1
// to a REAL observed lifecycle signal, NEVER model text, never a speculative/decorative claim (no invented
// percentages, no "almost done…"). A stage ABSENT from this table renders NOTHING — an unobserved/unknown
// stage is never shown (the honesty-law guard, asserted as a negative control). The `retry` label composes
// the real self-correct round ordinal in at call time (a factual number, not fabricated prose).
// GH #238/ADR-0159: each stage is a live/done PAIR (see LabelPair) — the done form stamps on the entry's
// transition to done, quiet past-tense, claude.ai's register. `sent` is already a completed fact (its two
// forms coincide); `done` is the settle signal itself, never rendered as its own row (routeProgress).
// This table remains THE single owning site of the stage vocabulary's rendering — the F2 closed-table
// guard (meta-line.ts's closed `TurnProgressStage` union at the wire, this closed Record here) still gates
// every label: an out-of-vocabulary stage can neither parse nor render.
const PROGRESS_LABEL: Record<TurnProgressStage, LabelPair> = {
  sent: { live: 'Request sent', done: 'Request sent' },
  started: { live: 'Generating…', done: 'Generated' },
  reasoning: { live: 'Reasoning…', done: 'Reasoned' },
  content: { live: 'Writing the response…', done: 'Wrote the response' },
  validating: { live: 'Validating…', done: 'Validated' },
  retry: { live: 'Self-correcting…', done: 'Self-corrected' },
  tool: { live: 'Running an integration…', done: 'Ran an integration' }, // GH #49 — detail carries the registry tool NAME, composed at call time
  done: { live: 'Done', done: 'Done' },
}

/** Backward-compat fallback for a turn with no `note` (ADR-0088: a factual message-kind tally, never a
 *  fabricated sentence) — the a2ui-live.ts summarize() precedent. */
function summarize(lines: readonly string[]): string {
  if (lines.length === 0) return ''
  const kinds = lines.map((l) => {
    const msg = JSON.parse(l) as Record<string, unknown>
    return Object.keys(msg).find((k) => k !== 'version') ?? '?'
  })
  return `Emitted ${lines.length} A2UI message(s): ${kinds.join(', ')}.`
}

// ADR-0180 (GH #688, ADR-0023 public-method seam) — the outer log's OWN stick-to-bottom guard (SPEC-R4
// AC2) MOVED verbatim to `ui-conversation-dialog`'s own `isNearBottom()`/`followTail()` (conversation-
// dialog.ts) — this file now calls THROUGH `#log` rather than owning the mechanism itself. Sampled ONCE
// per turn, before that turn's own content starts growing, never re-sampled reactively mid-turn (a naive
// reactive-scroll-listener regresses this — the a2ui-chat.ts banner's own documented failure mode).

export interface UIConversationElement extends ReactiveProps<typeof props> {}
export class UIConversationElement extends UIElement {
  static props = props

  // ADR-0180 — narrowed off `HTMLElement` to `UIConversationDialogElement`: adopted (an author-supplied
  // `:scope > ui-conversation-dialog`) or created, either way it owns the scroll-follow public-method
  // seam (`isNearBottom()`/`followTail()`, ADR-0023) this file used to own directly as private methods.
  #log: UIConversationDialogElement | undefined
  // The adopted-or-composed message-composition child (TKT-0056, ADR-0180 cl.2/4) — JS-created ONCE
  // UNLESS an author-supplied `:scope > ui-conversation-composer` exists (adopted instead), forwarded
  // props down via an effect, forwarded callbacks via the closures registered in connected() below.
  #composer: UIConversationComposerElement | undefined
  #warnedPreConnect = false

  readonly #registry = new Map<string, SurfaceRecord>()
  // genui-surface.spec.md SPEC-R5/R8 — the PARALLEL per-surface registry for mounted `ui-sandbox-frame`s
  // (never merged with `#registry` above — a genui surfaceId and an A2UI surfaceId live in disjoint id
  // spaces by construction; the two mechanisms never route the same surfaceId to different host types).
  readonly #genuiRegistry = new Map<string, GenuiSurfaceRecord>()
  #onSubmitCb: ((text: string, references?: readonly TurnReference[]) => void) | undefined
  #onClientMessageCb: ClientMessageListener | undefined
  #onModelChangeCb: ((id: string) => void) | undefined
  #onEffortChangeCb: ((id: string) => void) | undefined
  #onProviderChangeCb: ((id: string) => void) | undefined
  #onModeChangeCb: ((id: string) => void) | undefined
  #onContextDismissCb: ((id: string) => void) | undefined
  // GH #891/SPEC-R11 — the capabilities panel's ONE callback up, forwarded verbatim (id, new state).
  #onCapabilityToggleCb: ((id: string, included: boolean) => void) | undefined
  #onMicClickCb: (() => void) | undefined
  // SPEC-R12 (TKT-0071) — a consumer-supplied render hook for agent-turn note / system-bubble text.
  // `undefined` (default) ⇒ byte-identical plain `textContent`, no dependency. NEVER applied to
  // `addUserMessage` (SPEC-R4 AC1 — user text stays unescaped/unmodified, deliberately unaffected).
  #contentRenderer: ((text: string) => Node) | undefined
  // GH #666 — the consumer-owned empty-log node (`setEmptyState`), seated first in the log and preserved
  // across `reset()`. `undefined` (default) ⇒ byte-identical to every pre-#666 consumer.
  #emptyState: HTMLElement | undefined
  #turnSeq = 0
  // TKT-0034 — the busy/re-entrancy guard: a COUNT (not a bool) of `beginAgentTurn()` handles that exist
  // but have not yet `finalize()`d/`fail()`d. `#send` no-ops while this is > 0 (auto-tracked, zero consumer
  // wiring — the primitive already owns the AgentTurnHandle lifecycle); the composer reflects it visually.
  #turnsInFlight = 0
  // GH #805 repair (independent component-checker, PR #809) — surfaceIds whose OWN action just disabled
  // them (self-wired inside `ui-surface-host`, above `routeLine`'s per-host wiring below), not yet
  // resolved. A membership `Set`, deliberately NOT a FIFO queue (the first cut's own defect): a bare FIFO
  // dequeues whatever is OLDEST regardless of whether it has anything to do with the beginAgentTurn()
  // call claiming it — a genui action's own turn ALSO calls beginAgentTurn() (agent-admin.ts's
  // `#runSurfaceTurn` runs uniformly for every client message) but never pushes here (genui surfaces
  // never route through ui-surface-host at all), so it would silently steal an unrelated A2UI surface's
  // entry; a composer Enter landing inside the click→`setTimeout(0)` window (agent-admin.ts) would do the
  // same. `beginAgentTurn()` instead reads a SPECIFIC key (`opts.disabledSurfaceId`, defaulting to
  // `opts.intoSurface`) and only `fail()` (Set.delete's own has-and-remove) ever claims it — a turn with
  // no such key (a typed intent, a genui action — `intoSurface` there names a genui surfaceId, a
  // disjoint id space from this Set's own A2UI-only membership, ADR-0129 clause 2) claims nothing, ever.
  // `routeLine`'s known-surface branch also deletes an entry the moment a REAL update re-enables that
  // surface itself (surface-host.ts's own ingest()-entry re-enable) — keeping this Set's membership from
  // drifting stale against the thing it exists to track.
  //
  // Residual, DOCUMENTED gap (Kim's "your judgment" call, GH #805 repair item 4): a consumer that calls
  // `beginAgentTurn()` with NEITHER `disabledSurfaceId` NOR `intoSurface` for a client-action turn
  // (a2ui-chat.ts's `runTurn` — it implements no TKT-0079 resume at all, so it never sets either) gets NO
  // automatic fail-reenable for the narrow case where that turn fails before ever calling `ingestLine`
  // for its own surface again; `ui-surface-host`'s own re-enable-on-update arm still covers the ordinary
  // case (any real reply resending that surfaceId, TKT-0079's game loop) for every consumer, unchanged.
  readonly #pendingDisabledSurfaceIds = new Set<string>()

  protected connected(): void {
    if (this.#log === undefined) {
      // ADR-0180 (GH #688) — adopt-or-create seating: ALL three lookups are :scope > direct-child,
      // connect-time only. An author-supplied element is ADOPTED — never a second imperative surface
      // (clause 2); absent, this element creates one exactly as before ADR-0180, the byte-identical
      // default every existing consumer (a2ui-chat, a2ui-live, agent-admin — none of which authors
      // children today) keeps getting.
      const authoredHeader = this.querySelector<UIConversationHeaderElement>(':scope > ui-conversation-header')
      const authoredDialog = this.querySelector<UIConversationDialogElement>(':scope > ui-conversation-dialog')
      const authoredComposer = this.querySelector<UIConversationComposerElement>(':scope > ui-conversation-composer')

      // The internal log vehicle is PROMOTED from a bare `div[data-part='log']` to a JS-created-or-adopted
      // `<ui-conversation-dialog>` (ADR-0180 clause 1a) — the exact TKT-0056 composer-extraction precedent,
      // so ONE engine drives one structural shape on both the adopted and the created path. The
      // `[data-part='log']` compat spine stays: every shipped selector keys on it, tag-agnostic (ADR-0180
      // clause 1's own grep claim). The dialog's own `internals.role='log'`/`ariaLive='polite'` now carry
      // the live-region semantics (conversation-dialog.ts) — the bare `aria-live` HOST-ATTRIBUTE write this
      // line used to make is GONE (ARIA via internals, never host attributes).
      const dialog = authoredDialog ?? (document.createElement('ui-conversation-dialog') as UIConversationDialogElement)
      dialog.dataset.part = 'log'
      this.#log = dialog

      // Adopted-or-composed internal child (TKT-0056, NOW ALSO adopt-or-create — ADR-0180 clauses 2/4) —
      // the message-composition UI (context chips, field, Models/Effort pickers, mic/send) lives entirely
      // inside ui-conversation-composer; this element only forwards props down and callbacks up (below).
      const composer = authoredComposer ?? (document.createElement('ui-conversation-composer') as UIConversationComposerElement)
      // The four side-effect-free forwarders — safe to register ONCE, unconditionally: none of them has a
      // visible effect on registration, and each reads its own `#onXCb` field FRESH on every invocation, so
      // it works regardless of whether the consumer's own `onXChange(cb)` call happens before or after
      // THIS element connects (LLD CVC-C5, code-reviewer finding F1) — identical for an adopted composer,
      // the registration mechanism is path-blind by construction (ADR-0180 clause 4).
      // GH #849 — `references` rides through ADDITIVELY: the consumer's own callback receives the structured
      // references it must resolve at send time.
      // GH #891 (SPEC-R10) — and they now ride into the BUBBLE too, as display-only tags: the composer's
      // pre-send chips clear on send (SPEC-R6), so without this the record of "what rode this turn" would
      // vanish the instant it was sent. A PASS-THROUGH still: this element adds no semantics (it never reads
      // `kind`/`icon`), and the bubble's BODY stays the typed text — the framed text R4 puts on the wire and
      // in history never renders here.
      //
      // GH #1030 (HYBRID design (b) — the client-side auto-attach ADR-0190 amendment) — ONE more reference
      // MAY join the committed set here, before either downstream call: an EXACT-label hit for a
      // `mentionables`/`invocables` roster entry the typed text names in full (`findAutoAttachOption`),
      // never more than one. Doing it HERE (not in the composer, not in agent-admin's own callback) is what
      // makes it ride through BOTH downstream consumers of the SAME array identically to an explicit chip:
      // `addUserMessage` paints it as the SAME dismiss-less bubble tag SPEC-R10 already renders (never a
      // new chip visual), and the consumer's `#onSubmitCb` (agent-admin's `resolveTurnReferences`) resolves
      // it exactly as it resolves a user-committed one — there is no second resolution path to drift. An
      // undefined/empty roster (every consumer but ui-agent-admin, today) matches nothing, ever — the same
      // gated-equivalence law `mentionables`/`invocables` already stand on.
      composer.onSubmit((text, references) => {
        if (this.disabled) return // belt to the composer's own busy-disable — no bubble, no callback
        const autoAttach = findAutoAttachOption(text, [...(this.mentionables ?? []), ...(this.invocables ?? [])], references ?? [])
        const resolved = autoAttach === undefined ? references : [...(references ?? []), turnReferenceOf(autoAttach)]
        this.addUserMessage(text, resolved)
        this.#onSubmitCb?.(text, resolved)
      })
      composer.onModelChange((id) => this.#onModelChangeCb?.(id))
      composer.onEffortChange((id) => this.#onEffortChangeCb?.(id))
      composer.onProviderChange((id) => this.#onProviderChangeCb?.(id))
      composer.onModeChange((id) => this.#onModeChangeCb?.(id))
      composer.onContextDismiss((id) => this.#onContextDismissCb?.(id))
      composer.onCapabilityToggle((id, included) => this.#onCapabilityToggleCb?.(id, included))
      // `onMicClick` is DIFFERENT: the composer's own onMicClick has a visible side effect (revealing the
      // mic button) — forwarding it unconditionally here would un-hide the mic for every consumer
      // regardless of whether they ever asked for voice input. Only forward if a real callback is ALREADY
      // registered (the pre-connect registration case) — `onMicClick` below handles the post-connect case.
      if (this.#onMicClickCb !== undefined) composer.onMicClick(() => this.#onMicClickCb?.())

      this.#composer = composer
      // Canonical band order, normalized by re-append (ADR-0180 clause 4) — `append` MOVES an existing
      // child; connect-time only, before any turn state/focus/CodeMirror-class stateful child exists, so
      // moving an author-authored element (header, or a dialog/composer carrying its own initial content)
      // never disturbs anything live. The header is NEVER created, only recognized — absent means today's
      // shape minus nothing (clause 3); the imperative API never touches it.
      if (authoredHeader) this.append(authoredHeader)
      this.append(dialog, composer)
      // GH #666 — a `setEmptyState` call that arrived before this element connected (the consumer builds
      // its card, then appends it) seats its node now.
      if (this.#emptyState !== undefined) dialog.prepend(this.#emptyState)
    }

    // Forward models/model/efforts/effort/contextItems straight through — the composed child's OWN
    // reference-equality guards (rebuild only when the option-list REFERENCE changes) handle avoiding
    // unnecessary DOM churn; this element just re-assigns the current values on every relevant change.
    this.effect(() => {
      if (!this.#composer) return
      this.#composer.models = this.models
      this.#composer.model = this.model
      this.#composer.efforts = this.efforts
      this.#composer.effort = this.effort
      this.#composer.providers = this.providers
      this.#composer.provider = this.provider
      this.#composer.modes = this.modes
      this.#composer.mode = this.mode
      this.#composer.contextItems = this.contextItems
      this.#composer.mentionables = this.mentionables // GH #849 — the `@`/`/` rosters, pass-through only
      this.#composer.invocables = this.invocables
      this.#composer.capabilities = this.capabilities // GH #891 — the capabilities rows, pass-through only
      this.#reflectBusy() // `disabled` reads here too — the effect re-runs on its change
    })
  }

  /** A user bubble with `text`, unescaped/unmodified (SPEC-R4 AC1). A documented no-op pre-connect.
   *
   *  GH #891 (SPEC-R10) — WIDENED ADDITIVELY with the turn's committed `references`: the bubble gains one
   *  DISPLAY-ONLY tag per reference (label + the R9 kind glyph when the roster supplied one), the record of
   *  "what the user attached" now that the composer's pre-send chips clear on send. Absent/empty ⇒ the
   *  bubble DOM is byte-identical to before (an existing single-argument caller is unaffected).
   *
   *  The division of truth is R4's, unchanged: the BODY is the TYPED text verbatim — the FRAMED text (the
   *  labeled attachment block `ui-agent-admin` builds at send) is the wire/history truth and never renders
   *  in any bubble; these tags are the visual record of the same attachment, never its bytes. */
  addUserMessage(text: string, references?: readonly TurnReference[]): void {
    if (!this.#guard('addUserMessage')) return
    const wasNear = this.#log!.isNearBottom()
    const { outer, bubble } = this.#makeBubble('user')
    const body = document.createElement('p')
    body.dataset.part = 'body'
    body.textContent = text
    bubble.append(body)
    // Only when there is something to show — an absent/empty list appends NOTHING, so the byte-identity
    // default is enforced by construction rather than by a hidden empty row (the composer chip-row law).
    if (references !== undefined && references.length > 0) bubble.append(this.#buildReferenceTags(references))
    this.#log!.append(outer)
    void this.#log!.followTail(wasNear)
  }

  /** GH #891 (SPEC-R10) — the sent turn's attachment record: one small, DISMISS-LESS tag per reference
   *  (the turn is sent; there is nothing left to remove — the pre-send dismiss affordance is the composer
   *  chip's, and it cleared with the text). Label plus the R9 glyph when the reference carries one; `kind`
   *  rides as a `data-kind` CSS hook exactly as it does on the composer chip, and this element interprets
   *  neither (the same opaque-string law — `ui-agent-admin` owns the mapping, conversation.md). */
  #buildReferenceTags(references: readonly TurnReference[]): HTMLElement {
    const row = document.createElement('div')
    row.dataset.part = 'reference-tags'
    for (const reference of references) {
      const tag = document.createElement('span')
      tag.dataset.part = 'reference-tag'
      tag.dataset.kind = reference.kind
      if (reference.icon !== undefined && reference.icon !== '') {
        const icon = document.createElement('ui-icon')
        icon.dataset.part = 'reference-tag-icon'
        icon.setAttribute('data-role', 'icon')
        icon.setAttribute('glyph', reference.icon)
        tag.append(icon)
      }
      const label = document.createElement('span')
      label.dataset.part = 'reference-tag-label'
      label.textContent = reference.label
      tag.append(label)
      row.append(tag)
    }
    return row
  }

  /** Opens one agent turn: a fresh `[data-part='turn']` wrapper (who → narration → bubble, GH #306/
   *  ADR-0160 — the sender label and the narration strip render OUTSIDE the bubble) whose bubble reserves
   *  a note + mounts container, in that literal order (SPEC-R2), and the routing state the returned
   *  handle closes over (SPEC-R6/R7). A no-op-stub handle pre-connect (never throws — the same
   *  documented-no-op discipline as ui-surface-host).
   *
   *  TKT-0079 — `opts.intoSurface`: when it names an OPEN registry record whose bubble is still connected,
   *  the turn RESUMES that bubble instead of opening a new card (Kim: "stay in the same card unless it has
   *  to become a new card" — ADR-0129's same-surface routing extended to the bubble plane, for the
   *  action-click game loop). A FRESH narration strip swaps in place of the finalized old one (finalize()
   *  truncate-marks its entries — ui-status-stream's completion invariant is per-strip, so a resumed turn
   *  gets its own strip rather than un-finalizing the last one); the note div is reused (overwritten at
   *  finalize); a fresh surfaceId in a resumed turn mounts into the SAME bubble's mounts. Anything else —
   *  unknown id, closed record, disconnected bubble — falls through to the fresh-bubble path unchanged.
   *
   *  GH #805 repair — `opts.disabledSurfaceId`: the surfaceId whose OWN action started this turn, for
   *  `fail()` to re-enable if the turn never sends it another line. Defaults to `opts.intoSurface`
   *  (the common, non-ask case — TKT-0079's resumed surface IS the answered one) — pass it EXPLICITLY
   *  only when it diverges (GH #802/#803's ask-arm: the answered surface routes to a FRESH bubble,
   *  `intoSurface` undefined by that routing's own design, but the answered surfaceId is still real and
   *  still owed a re-enable on failure). Omit BOTH for a turn with no client-action origin at all (a
   *  typed intent) — see `#pendingDisabledSurfaceIds`'s own doc comment for why this is a specific key
   *  lookup, never a blind "claim whatever's pending" dequeue. */
  beginAgentTurn(opts?: { intoSurface?: string; disabledSurfaceId?: string }): AgentTurnHandle {
    if (!this.#guard('beginAgentTurn')) {
      return { ingestLine: () => {}, mountGenui: () => {}, setNote: () => {}, progress: () => {}, finalize: () => {}, fail: () => {} }
    }

    const wasNear = this.#log!.isNearBottom()
    // GH #805 repair — the SPECIFIC key this handle's own fail()/finalize() will check against the
    // pending Set; never a blind dequeue (see the Set's own doc comment for the two collision vectors
    // that ruled that out).
    const disabledSurfaceId = opts?.disabledSurfaceId ?? opts?.intoSurface
    const resumed = opts?.intoSurface !== undefined ? this.#resumableBubble(opts.intoSurface) : undefined
    let bubble: HTMLElement
    let narration: UIStatusStreamElement
    let note: HTMLElement
    let mounts: HTMLElement
    if (resumed !== undefined) {
      ;({ bubble, note, mounts } = resumed)
      narration = this.#makeNarration()
      resumed.narration.replaceWith(narration)
    } else {
      const built = this.#makeBubble('agent')
      bubble = built.bubble
      narration = this.#makeNarration()
      note = document.createElement('div')
      note.dataset.part = 'body'
      mounts = document.createElement('div')
      mounts.dataset.part = 'mounts'
      // GH #306/ADR-0160 amendment — the sender label + narration strip render OUTSIDE the bubble now
      // (free-standing turn chrome, `#makeBubble`'s own `[data-part='turn']` wrapper); only the content
      // (note + mounts) lives inside the bubble. `bubble.before(narration)` plants the strip as the
      // wrapper's own child, immediately before the bubble — after the `[data-part='who']` label
      // `#makeBubble` already appended, giving the who → narration → bubble reading order.
      bubble.append(note, mounts)
      bubble.before(narration)
      this.#log!.append(built.outer)
      // GH #313/ADR-0160 amendment (Kim's 2026-07-28 ruling — "no bubble unless there is content for
      // it") — a fresh agent bubble starts CONTENT-EMPTY (the note/mounts skeleton just appended holds
      // no text/children yet) and the narration strip now lives OUTSIDE it (GH #306), so an all-empty
      // bubble is a real, knowable pre-content state. `data-empty` marks it hidden (conversation.css);
      // `#revealBubble` below clears it exactly once, on the FIRST real content of any kind. `:has()`
      // can't reach this — `#renderBody`'s default path writes a bare `textContent` string into `note`,
      // a text node CSS attribute-selectors cannot see — hence the small state-attribute route rather
      // than a CSS-only one.
      bubble.dataset.empty = ''
    }
    void this.#log!.followTail(wasNear)

    this.#turnSeq += 1
    const seq = this.#turnSeq
    // TKT-0034 — this handle is now genuinely in flight: bump the count + reflect busy onto the composer.
    // ONE #endTurn() per handle guards against a caller invoking BOTH finalize() and fail() (never legal
    // per the SPEC, but a stray double-call must not under-flow the count into a stuck-busy negative).
    this.#turnsInFlight += 1
    this.#reflectBusy()
    let ended = false
    const endTurn = (): void => {
      if (ended) return
      ended = true
      this.#turnsInFlight = Math.max(0, this.#turnsInFlight - 1)
      this.#reflectBusy()
    }
    let noteText: string | undefined
    const turnLines: string[] = []
    const touchedIds = new Set<string>()
    const categoriesSeen: Category[] = []
    const seenCats = new Set<Category>()
    let freshHostThisTurn: UISurfaceHostElement | undefined
    const heldNoIdLines: string[] = []
    // ADR-0146 F1/F8 progress state — the keys this turn has already narrated, and the current active
    // progress entry (settled to `done` as the next stage begins, so lifecycle stages check off in order).
    // GH #238/ADR-0159: each narrated key remembers its composed DONE-form label (the pair table, with the
    // same factual round/tool suffix its live form carried) so every settle site stamps the past-tense
    // form on the transition — a truncated/failed entry is never settled, so it keeps its live form.
    const progressKeysSeen = new Set<string>()
    const doneLabelByKey = new Map<string, string>()
    let lastProgressKey: string | undefined
    // GH #240/ADR-0159 wave B — the per-step source reveal's consumer gate + the per-category line
    // accumulator. Sampled ONCE per turn (the `wasNear` discipline — a mid-turn prop flip never mixes
    // postures within one turn's strip). When off, `catLines` stays untouched and every producer-attached
    // progress `source` is dropped — the byte-identical default.
    const withSources = this.sources
    const catLines = new Map<Category, string[]>()
    // GH #313 — reveals the bubble exactly once, on the first real content of any kind: a streamed note
    // token, a fresh mount, the chip row, or finalize()'s own note/fallback text. A RESUMED bubble never
    // carries `data-empty` in the first place (TKT-0079: it can only resume because it already mounted a
    // surface on a prior turn, so it's already revealed) — `revealed` starts `true` for it, making every
    // call below a no-op, matching state 1 (resumed turns stay visible throughout).
    let revealed = bubble.dataset.empty === undefined
    const revealBubble = (): void => {
      if (revealed) return
      revealed = true
      delete bubble.dataset.empty
    }
    /** Settle one narrated progress entry to done, stamping its done-form label (GH #238). */
    const settleProgress = (key: string): void => {
      const doneLabel = doneLabelByKey.get(key)
      narration.update(key, doneLabel === undefined ? { status: 'done' } : { status: 'done', label: doneLabel })
    }

    /** Route ONE live-turn progress event into the strip (ADR-0146 F1/F8) through the CLOSED code-owned
     *  label table — never model text. An unknown/unobserved stage renders NOTHING (the F2 honesty guard).
     *  Each stage's entry goes `active` when it begins and settles `done` — with its done-form label
     *  (GH #238) — as the NEXT stage begins; `done` simply settles the last stage (no redundant "Done"
     *  row). `retry` composes the real round ordinal in. */
    const routeProgress = (ev: TurnProgress): void => {
      const pair = PROGRESS_LABEL[ev.stage] as LabelPair | undefined
      if (pair === undefined) return // unknown/unobserved stage — nothing is shown
      if (ev.stage === 'done') {
        if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
        lastProgressKey = undefined
        return
      }
      // `retry` composes the real round ordinal; `tool` composes the registry tool NAME from detail —
      // both factual values from the closed vocabularies, never model prose (GH #49 / ADR-0146 F2). The
      // SAME factual suffix rides both forms of the pair (live "Self-correcting… (round 2)" settles to
      // "Self-corrected (round 2)").
      const suffix =
        ev.stage === 'retry'
          ? (ev.round === undefined ? '' : ` (round ${ev.round})`)
          : ev.stage === 'tool' && ev.detail
            ? ` (${ev.detail})`
            : ''
      const label = `${pair.live}${suffix}`
      const key =
        ev.stage === 'retry'
          ? `t${seq}-progress-retry-${ev.round ?? 1}`
          : ev.stage === 'tool'
            ? `t${seq}-progress-tool-${ev.detail ?? 'unknown'}`
            : `t${seq}-progress-${ev.stage}`
      doneLabelByKey.set(key, `${pair.done}${suffix}`)
      if (lastProgressKey !== undefined && lastProgressKey !== key) settleProgress(lastProgressKey)
      // GH #240/ADR-0159 wave B — the producer-attached raw source (present only under the server-side
      // `progressDetail:'source'` opt-in) passes through to the entry's reveal ONLY when this consumer
      // opted in too (`sources`) — dropped otherwise, the fail-closed belt to the producer's own gate.
      const source = withSources && ev.source !== undefined && ev.source !== '' ? { source: ev.source } : {}
      if (progressKeysSeen.has(key)) narration.update(key, { status: 'active', label, ...source })
      else {
        progressKeysSeen.add(key)
        narration.appendEntry({ key, status: 'active', label, ...source })
      }
      lastProgressKey = key
    }

    const routeLine = (line: string): void => {
      const id = surfaceIdOf(line)
      if (id === undefined) {
        if (freshHostThisTurn !== undefined) freshHostThisTurn.ingest(line)
        else heldNoIdLines.push(line)
        return
      }
      touchedIds.add(id)
      const known = this.#registry.get(id)
      if (known !== undefined) {
        known.host.ingest(line) // SPEC-R7: routes to the surface's ORIGINAL host, never this turn's own
        // GH #805 repair — the host's own ingest() just re-enabled this surface for real (surface-host.ts's
        // entry re-enable); drop any stale pending-disable bookkeeping for it so a LATER-unrelated fail()
        // never finds a stale key here to (harmlessly, but incorrectly) "claim".
        this.#pendingDisabledSurfaceIds.delete(id)
        if (known.state === 'open' && isDeleteSurfaceFor(line, id)) this.#closeSurface(id)
        return
      }
      // A FRESH surfaceId — this turn's own createSurface line. A new ui-surface-host, inline HERE.
      const host = document.createElement('ui-surface-host') as UISurfaceHostElement
      host.wrap = true // TKT-0084: a chat bubble hugs its rendered surface's content, never clips it to an arbitrary fixed height
      host.bare = true // GH #241 (Kim's ruling): on the chat path the render surface carries NO background, NO padding, and FULL message-column width — the payload's own components carry their chrome
      mounts.append(host)
      revealBubble() // GH #313 — a fresh mount is real content
      host.onClientMessage((m) => {
        // GH #805 — bookkeeping ONLY: `host` (ui-surface-host) already disabled its own interactive
        // descendants (self-wired, surface-host.ts) before this callback ever runs — including its OWN
        // `wantResponse:false` skip (ADR-0088 §3), which this mirrors so the bookkeeping never disagrees
        // with what the host actually did. This just remembers WHICH surfaceId a later `fail()` may need
        // to re-enable, keyed (never FIFO-ordered) — see `#pendingDisabledSurfaceIds`'s own doc comment.
        if ('action' in m && m.action.wantResponse !== false) this.#pendingDisabledSurfaceIds.add(id)
        this.#onClientMessageCb?.(m) // bubble up (LLD-C4)
      })
      this.#registry.set(id, { host, bubble, state: 'open' })
      host.ingest(line)
      freshHostThisTurn = host
      for (const held of heldNoIdLines) host.ingest(held)
      heldNoIdLines.length = 0
    }

    // genui-surface.spec.md SPEC-R5/R8 (PRD-G8) — the PARALLEL mount routine `mountGenui` calls: a KNOWN
    // surfaceId rebuilds the EXISTING frame's `.html` in place (a plain prop write — `ui-sandbox-frame`'s
    // OWN effect owns the atomic srcdoc rebuild, SPEC-R5); a FRESH surfaceId mounts a NEW frame inline in
    // THIS turn's `mounts` (the `routeLine` fresh-host precedent, applied to a structurally different host
    // — never `ui-surface-host`, never routed through `surfaceIdOf`/`#registry`).
    const routeGenui = (surfaceId: string, html: string, assets?: SandboxFrameAssets): void => {
      touchedIds.add(surfaceId) // #settleTouchedHosts only settles A2UI hosts (`state==='open'`) — a no-op for a genui id, harmless
      const known = this.#genuiRegistry.get(surfaceId)
      if (known !== undefined) {
        known.host.assets = assets ?? {} // live-apply: re-applied on every rebuild, never sticky (LLD-C4)
        known.host.html = html // SPEC-R5 replace — the control's own effect rebuilds the whole srcdoc atomically
        return
      }
      const host = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
      host.surfaceId = surfaceId
      if (assets !== undefined) host.assets = assets
      host.addEventListener('action', (e) => {
        // SPEC-R8's routing law: the ONE outward semantic channel. Framed as a genui-shaped client message
        // (structurally distinct from an `A2uiClientMessage` — a genui action is NOT one, SPEC-R8's own
        // reasoning) and re-routed through the SAME `onClientMessage` callback `ui-surface-host` uses
        // (LLD-C4) — the runner/consumer distinguishes the two shapes at its own boundary
        // (`clientMessageSurfaceId`'s own `'genuiAction'` arm, agent-admin.ts).
        // GH #291 review — `ui-sandbox-frame` emits this `action` CustomEvent bubbling+composed
        // (`emit()`'s fleet default); once re-routed above there is no reason for the SAME event to also
        // continue bubbling out through `ui-conversation` itself, where it collides with the chip row's OWN
        // `action` event (ADR-0160 clause 3, `#buildActions`) — a consumer listening on `ui-conversation`
        // for the chip commit would otherwise also catch every genui action click. Stopped here, at the
        // frame that owns it, before it reaches `ui-conversation`'s host boundary.
        e.stopPropagation()
        const detail = (e as CustomEvent<GenuiActionDetail>).detail
        // A genui action is NOT an `A2uiClientMessage` (SPEC-R8) — `ClientMessageListener`'s parameter
        // type is nonetheless pinned to that closed union (the renderer's own real client-message shape).
        // The cast is the documented impedance mismatch this bubble intentionally carries; the consumer
        // (agent-admin.ts's `clientMessageSurfaceId`/`#runSurfaceTurn`) narrows on the `genuiAction` key
        // before ever treating the value as a real A2UI client message.
        this.#onClientMessageCb?.({ genuiAction: detail } as unknown as A2uiClientMessage)
      })
      mounts.append(host)
      revealBubble() // GH #313 — a fresh mount is real content
      this.#genuiRegistry.set(surfaceId, { host, bubble })
      host.html = html
    }

    return {
      ingestLine: (line: string) => {
        turnLines.push(line)
        const cat = categoryOf(line)
        if (cat !== undefined && withSources) {
          // GH #240/ADR-0159 wave B — each category step reveals the ACTUAL wire line(s) it stands for:
          // "Opened a new surface" carries its createSurface JSONL, "Updated data" every updateDataModel
          // line of the turn, accumulated newline-joined (ui-status-stream's cumulative-restamp contract —
          // the #growText precedent: the consumer sends the whole text each time; a re-stamp is a
          // same-node mutation on the collapsed reveal, never an insertion).
          const lines = catLines.get(cat) ?? []
          lines.push(line)
          catLines.set(cat, lines)
        }
        if (cat !== undefined && !seenCats.has(cat)) {
          seenCats.add(cat)
          categoriesSeen.push(cat)
          // LIVE-AT-INGEST (SPEC-R6 amendment, ADR-0146): a category narrates the moment its FIRST line is
          // ingested — `active` during the turn, settled at finalize() — never the old post-hoc replay of
          // stages that already finished. The label table's own text is the entire vocabulary (ADR-0088
          // honesty law — never a fabricated sentence). GH #238: the live form here; finalize() stamps the
          // done form on the settle transition. GH #240: under `sources`, the entry is BORN with its first
          // wire line attached (the reveal is a creation-time affordance on the strip).
          narration.appendEntry({
            key: `t${seq}-${cat}`,
            status: 'active',
            label: LABEL[cat].live,
            ...(withSources ? { source: line } : {}),
          })
        } else if (cat !== undefined && withSources) {
          // A later line of an already-narrated category — re-stamp the reveal with the cumulative text.
          narration.update(`t${seq}-${cat}`, { source: catLines.get(cat)!.join('\n') })
        }
        routeLine(line)
      },
      mountGenui: (surfaceId: string, html: string, assets?: SandboxFrameAssets) => {
        routeGenui(surfaceId, html, assets)
      },
      setNote: (text: string) => {
        noteText = text
        // GH #313 — writes the note into the DOM IMMEDIATELY (never buffered for finalize() alone): a
        // streaming caller's first non-empty token both reveals the bubble and paints its own text right
        // away, rather than the bubble popping up empty and waiting for finalize() to fill it in (that
        // would just relocate the empty-pill symptom, not fix it). finalize() still re-renders the final
        // text unconditionally below — a byte-identical result for the ordinary one-shot caller (a single
        // setNote() right before finalize()).
        if (text !== '') {
          revealBubble()
          this.#renderBody(note, text)
        }
      },
      progress: (ev: TurnProgress) => routeProgress(ev),
      finalize: (actions?: readonly TurnAction[]) => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT finalize() runs, not after narration settles
        // Settle the LIVE entries this turn narrated (categories + the current progress stage) to `done`
        // — stamping each entry's done-form label on the transition (GH #238/ADR-0159: a done checkmark
        // never wears an "-ing…" label) — then run the completion invariant (which truncates anything
        // still un-settled, fail-closed, keeping its live form: the done form is never claimed for work
        // not completed).
        for (const cat of categoriesSeen) narration.update(`t${seq}-${cat}`, { status: 'done', label: LABEL[cat].done })
        if (lastProgressKey !== undefined) settleProgress(lastProgressKey)
        narration.finalize()
        const finalNote = noteText ?? summarize(turnLines)
        if (finalNote !== '') revealBubble() // GH #313 — the fallback tally is real content too
        this.#renderBody(note, finalNote)
        if (this.disclosure && turnLines.length > 0) {
          revealBubble() // GH #313 — the wire dump is real content even with no note/mounts
          bubble.append(this.#buildDisclosure(turnLines))
        }
        // GH #291/ADR-0160 clause 3 — the pre-hydrated action-chip row, LAST (after the wire disclosure,
        // when both are present): a settled turn's feedback/reply row reads as the final word on that turn.
        if (actions && actions.length > 0) {
          revealBubble() // GH #313 — the chip row is real content
          bubble.append(this.#buildActions(actions))
        }
        this.#settleTouchedHosts(touchedIds)
        // GH #805 — a SUCCESSFUL turn that never touched `disabledSurfaceId` again leaves it disabled,
        // deliberately (the ask-arm's "stays disabled as answered history" law) — but this handle's own
        // claim on the pending Set is spent either way, so drop it (never re-enable, just stop tracking
        // it as "pending" — a card can't be re-clicked to re-push it while it's still disabled).
        if (disabledSurfaceId !== undefined) this.#pendingDisabledSurfaceIds.delete(disabledSurfaceId)
        void this.#log!.followTail(wasNear)
      },
      fail: (message: string) => {
        endTurn() // TKT-0034 — re-enable the composer THE MOMENT fail() runs
        // A genuine finally-scoped truncation (SPEC-R6 AC3) — never a2ui-live's try-scoped mistake. The
        // live-narrated category/progress entries stay as they were (whatever completed shows done, the
        // rest truncate under fail()); `narration.fail()` forces the streaming header to `error` (ADR-0146
        // F8's header-level face) and truncates the in-flight entries. Still settles whatever surfaces the
        // partial turn touched (the a2ui-chat.ts `finally` block precedent, unconditional on success/failure).
        narration.appendEntry({ key: `t${seq}-error`, status: 'error', label: `Turn failed — ${message}` })
        narration.fail()
        this.#settleTouchedHosts(touchedIds)
        // GH #805 — don't strand a dead card: re-enable the surface whose OWN action started this now-
        // failed turn, even when the turn never sent it another line (an ask-declared surface's real
        // turn opens a FRESH bubble and never resends the answered surfaceId, GH #802/#803; a client-only
        // refusal never ingests anything at all). `Set.delete` is the has-and-remove in one step — a
        // surface already re-enabled by its own update (routeLine's known-surface branch already deleted
        // it there) is simply absent, so this is a harmless no-op for it, never a double-fire. Re-enabling
        // only reverts elements THIS surface's own sweep disabled (surface-host.ts's `#sweepDisabled`) —
        // a payload/checks-declared disabled control is untouched.
        if (disabledSurfaceId !== undefined && this.#pendingDisabledSurfaceIds.delete(disabledSurfaceId)) {
          const record = this.#registry.get(disabledSurfaceId)
          if (record !== undefined && record.state === 'open') record.host.setInteractiveDisabled(false)
        }
        this.#addSystemBubble(`⚠ ${message}`)
      },
    }
  }

  /** The per-turn narration strip, ONE creation site for both the fresh-bubble and resumed-turn paths
   *  (they had drifted into a hand-duplicated block each). ADR-0146 F8: `header` is always set — the strip
   *  reads "working" from t=0, closing the blank-bubble symptom at its ROOT (even a zero-line,
   *  zero-progress turn shows a visible working header). GH #239/ADR-0159: the opt-in `receipt` prop adds
   *  the receipt pattern's two stream-level opt-ins; default false leaves the strip byte-identical. */
  #makeNarration(): UIStatusStreamElement {
    const narration = document.createElement('ui-status-stream') as UIStatusStreamElement
    narration.setAttribute('size', 'sm')
    narration.setAttribute('label', 'Agent activity')
    narration.setAttribute('header', '')
    if (this.receipt) {
      narration.setAttribute('oneline', '') // the live one-morphing-line mode (GH #239)
      narration.setAttribute('receipt', '') // the terminal one-line receipt (GH #239)
    }
    narration.dataset.part = 'narration'
    return narration
  }

  /** TKT-0079 — the resume probe: `id`'s OPEN record whose bubble is still in this log, plus the three
   *  turn parts a resumed turn writes into. `undefined` on ANY miss (unknown id, closed record,
   *  disconnected bubble, missing part) ⇒ the caller takes the fresh-bubble path unchanged.
   *  genui-surface.spec.md SPEC-R8 — checks the A2UI `#registry` FIRST, then the PARALLEL `#genuiRegistry`
   *  (a genui surfaceId is never in `#registry` and vice versa, the disjoint-id-space law): a genui
   *  action click's follow-up turn (TKT-0079's own "stay in the same card" rule) resumes the bubble that
   *  owns its genui surface exactly the way an A2UI action click already resumes its own.
   *
   *  GH #306/ADR-0160 amendment — the narration strip is no longer the bubble's own child (it sits
   *  outside, in the owning `[data-part='turn']` wrapper `#makeBubble` creates), so it's found via the
   *  bubble's PARENT rather than the bubble itself; every other part (note/mounts) is still the bubble's
   *  own direct child, unchanged. */
  #resumableBubble(
    id: string,
  ): { bubble: HTMLElement; narration: UIStatusStreamElement; note: HTMLElement; mounts: HTMLElement } | undefined {
    const record = this.#registry.get(id)
    const bubble = record?.state === 'open' && record.bubble.isConnected ? record.bubble : undefined
    const genuiRecord = bubble === undefined ? this.#genuiRegistry.get(id) : undefined
    const resolvedBubble = bubble ?? (genuiRecord?.bubble.isConnected ? genuiRecord.bubble : undefined)
    if (resolvedBubble === undefined) return undefined
    const turn = resolvedBubble.parentElement
    const narration =
      turn?.dataset.part === 'turn' ? turn.querySelector<UIStatusStreamElement>(':scope > [data-part="narration"]') : null
    const note = resolvedBubble.querySelector<HTMLElement>(':scope > [data-part="body"]')
    const mounts = resolvedBubble.querySelector<HTMLElement>(':scope > [data-part="mounts"]')
    if (narration === null || note === null || mounts === null) return undefined
    return { bubble: resolvedBubble, narration, note, mounts }
  }

  /** The reply affordance — a callback, NEVER a CustomEvent (SPEC-R5). Safe to call before OR after connect.
   *
   *  GH #849 — WIDENED ADDITIVELY (the composed composer's own `onSubmit`, forwarded): the callback also
   *  receives the turn's committed `@`/`/` references (`TurnReference[]`, a stable empty array when there
   *  are none). A single-parameter consumer is byte-unaffected — the extra argument is simply ignored. */
  onSubmit(cb: (text: string, references?: readonly TurnReference[]) => void): void {
    this.#onSubmitCb = cb
  }

  /** Outbound client messages bubbled from whichever composed `ui-surface-host` emitted them (SPEC-R7). Safe
   *  to call before OR after connect. */
  onClientMessage(cb: ClientMessageListener): void {
    this.#onClientMessageCb = cb
  }

  /** Fires with a `models` entry's `id` when the Models picker commits a choice — a callback, matching
   *  `onSubmit`'s own precedent (SPEC-R5's closed event vocabulary has no picker-commit kind). The picker
   *  itself never writes `this.model` — the consumer owns that (its own store), then hands the new value
   *  back down through the `model` prop, same "props down, callbacks up" shape as everywhere else in this
   *  fleet. Safe to call before or after connect. */
  onModelChange(cb: (id: string) => void): void {
    this.#onModelChangeCb = cb
  }

  /** Fires with an `efforts` entry's `id` when the Effort picker commits a choice. See `onModelChange`. */
  onEffortChange(cb: (id: string) => void): void {
    this.#onEffortChangeCb = cb
  }

  /** Fires with a `providers` entry's `id` when the Provider picker commits a choice (GH #257). See
   *  `onModelChange` — the composed child's own reset-on-provider-change (see conversation-composer.md)
   *  fires `onModelChange` alongside this one when the current model doesn't belong to the new provider. */
  onProviderChange(cb: (id: string) => void): void {
    this.#onProviderChangeCb = cb
  }

  /** Fires with a `modes` entry's `id` when the Mode picker commits a choice (GH #257). See `onModelChange`. */
  onModeChange(cb: (id: string) => void): void {
    this.#onModeChangeCb = cb
  }

  /** Fires with a `contextItems` entry's `id` when its dismiss affordance is clicked — the consumer owns
   *  actually removing it from `contextItems` (props down, callbacks up, the `onModelChange` precedent). */
  onContextDismiss(cb: (id: string) => void): void {
    this.#onContextDismissCb = cb
  }

  /** GH #891/SPEC-R11 — fires with a `capabilities` row's `id` and the NEW `included` state when its switch
   *  is flipped. Pass-through of the composed child's own callback (`conversation-composer.md`): the panel
   *  stays open, this element mutates nothing, and the consumer owns the meaning — under ADR-0190 rev.2's
   *  ruling `ui-agent-admin` writes the named entry's persisted `enabled` and hands a fresh `capabilities`
   *  array back down. Same props-down/callbacks-up law as `onModelChange`; safe to call before or after
   *  connect. */
  onCapabilityToggle(cb: (id: string, included: boolean) => void): void {
    this.#onCapabilityToggleCb = cb
  }

  /** Fires when the mic button is clicked. OPT-IN: the button stays hidden until this is actually called —
   *  reveals it immediately if already connected, or on the next connect otherwise (matching `onSubmit`'s
   *  "safe to call before or after connect" law). Deliberately inert beyond this callback — `ui-conversation`
   *  has no speech-to-text mechanism of its own; a consumer that wants real voice input wires it here. */
  onMicClick(cb: () => void): void {
    this.#onMicClickCb = cb
    // Forward immediately if the composer already exists (post-connect case); the pre-connect case is
    // handled at compose time in connected() (LLD CVC-C5, code-reviewer finding F1).
    this.#composer?.onMicClick(() => this.#onMicClickCb?.())
  }

  /** SPEC-R12 (TKT-0071) — registers a render hook applied to agent-turn `note` text and system-bubble
   *  text in place of plain `textContent`. `undefined` restores the default (byte-identical plain text).
   *  `ui-conversation` never imports a markdown/highlight package itself (the `app` DAG stays untouched,
   *  CLAUDE.md's layering law) — the renderer is entirely consumer-supplied code the APP layer already
   *  has permission to import (e.g. `ui-markdown` from `@agent-ui/code`). NEVER applied to
   *  `addUserMessage` — user-authored text stays unescaped/unmodified (SPEC-R4 AC1, unchanged). Safe to
   *  call before or after connect; applies to bubbles rendered after the call, not retroactively. */
  setContentRenderer(fn: ((text: string) => Node) | undefined): void {
    this.#contentRenderer = fn
  }

  /** GH #666 — the EMPTY-LOG state: a consumer-owned node placed in the log area, so a conversation with
   *  nothing in it yet is still THIS element's own card (border, kicker, log, composer pinned at the
   *  bottom) rather than a different-looking box the consumer has to build beside it. `null` removes it.
   *
   *  Placement only, deliberately: this element never decides WHEN the state applies — a conversation can
   *  be legitimately empty and armed (the agent speaks first) or full and idle, and only the consumer knows
   *  which. `reset()` keeps it, because a reset conversation IS empty again; the consumer drops it with
   *  `setEmptyState(null)` at whatever moment its own flow calls "no longer empty".
   *
   *  The node sits FIRST in the log, so real turns append below it in reading order. Safe before or after
   *  connect (the `setContentRenderer` opt-in's own two-sided shape): pre-connect it is stored and
   *  `connected()` seats it; post-connect it lands immediately. */
  setEmptyState(node: HTMLElement | null): void {
    const next = node ?? undefined
    if (this.#emptyState === next) return
    this.#emptyState?.remove()
    this.#emptyState = next
    if (next !== undefined) this.#log?.prepend(next)
  }

  /** Disposes every open surface host and clears the thread. A documented no-op pre-connect. A consumer that
   *  resets mid-turn (abandoning an un-finalized `AgentTurnHandle` rather than calling `finalize()`/`fail()`
   *  on it) must not leave the composer permanently disabled — TKT-0034's counter/busy-state zero here too
   *  (component-reviewer note, 2026-07-13; the shipped consumer always finalizes, so this is a robustness
   *  floor for a future one, not a fix to an observed bug). */
  reset(): void {
    if (!this.#guard('reset')) return
    for (const record of this.#registry.values()) record.host.dispose()
    this.#registry.clear()
    // genui-surface.spec.md — `ui-sandbox-frame` has no `dispose()` method (unlike `ui-surface-host`): its
    // OWN `disconnected()` tears down the bridge listener/iframe automatically the moment `replaceChildren()`
    // below removes it from the DOM (the SAME platform-fires-disconnectedCallback mechanism the leak-safety
    // net doc comment on `disconnected()` names) — only the Map bookkeeping needs clearing here.
    this.#genuiRegistry.clear()
    // GH #666 — the empty-log state survives a reset by construction: a reset conversation is empty again,
    // so re-seating the consumer's node here is the same statement `replaceChildren()` makes about turns.
    this.#log!.replaceChildren(...(this.#emptyState ? [this.#emptyState] : []))
    this.#turnsInFlight = 0
    // GH #805 repair — a persona switch (or any other reset()) with a click's action still pending must
    // not leave a stale surfaceId in the Set: `#registry` above just cleared, so a LATER beginAgentTurn()
    // in this fresh session could otherwise compute (by pure string coincidence, a fresh surfaceId reused
    // across sessions) a `disabledSurfaceId` that spuriously matches a leftover entry from the session
    // just torn down.
    this.#pendingDisabledSurfaceIds.clear()
    this.#reflectBusy()
  }

  /** The ONE composer-busy write site: in-flight turns OR the `disabled` availability gate. */
  #reflectBusy(): void {
    if (this.#composer) this.#composer.busy = this.disabled || this.#turnsInFlight > 0
  }

  /** Leak-safety net (the select.ts/text-field.ts "heavyweight per-connection resource" precedent) — a
   *  consumer that removes this element WITHOUT calling `reset()`/disposing its surfaces itself must not
   *  leak every composed `ui-surface-host`'s `RendererHost`. Disposing each host here is DEFENSE IN DEPTH:
   *  the platform ALSO fires each host's own `disconnected()` (surface-host.ts) automatically as this
   *  element's connected subtree is removed — this loop is a no-op in that ordinary case (`dispose()` is
   *  idempotent-safe) and is what actually matters if a surface host were ever detached independently.
   *
   *  MUST mark each record `closed` via `#closeSurface`, NEVER `this.#registry.clear()` (a regression this
   *  fix corrects): `connected()` does not rebuild the thread DOM on reconnect, so a plain `remove()` +
   *  re-`append()` (an ordinary router detach/reattach, not a `moveBefore`) leaves the OLD bubbles/hosts
   *  physically in the log — if the registry were wiped instead of marked, a later line re-targeting an
   *  already-seen `surfaceId` would read as "unknown" and `routeLine`'s fresh-id branch would mint a SECOND
   *  host in a SECOND bubble (SPEC-R7 AC1's persistent-identity guarantee broken, the original bubble now a
   *  dead husk). Marking `closed` (the SAME transition `deleteSurface` already drives, "Closed." annotation
   *  included) keeps the id KNOWN, so the already-tested known-but-closed routing path — never a fresh
   *  mint — is what a post-disconnect line hits instead. The thread DOM itself is left untouched (this is
   *  teardown, not a user-facing "start over" action, unlike `reset()`). */
  protected override disconnected(): void {
    for (const id of this.#registry.keys()) this.#closeSurface(id)
  }

  // ── internals ────────────────────────────────────────────────────────────────────────────────────────

  /** `finalize()` every OPEN surface host this turn touched (LLD-C4) — shared by the success and the
   *  fail() path alike (the a2ui-chat.ts `finally` block precedent: settling is unconditional). */
  #settleTouchedHosts(touchedIds: ReadonlySet<string>): void {
    for (const id of touchedIds) {
      const record = this.#registry.get(id)
      if (record !== undefined && record.state === 'open') record.host.finalize()
    }
  }

  #closeSurface(id: string): void {
    const record = this.#registry.get(id)
    if (record === undefined || record.state === 'closed') return
    record.host.dispose()
    record.state = 'closed'
    record.bubble.dataset.state = 'closed'
    const note = document.createElement('p')
    note.dataset.part = 'annotation'
    note.textContent = 'Closed.'
    record.bubble.append(note)
  }

  #addSystemBubble(text: string): void {
    const wasNear = this.#log!.isNearBottom()
    // A system bubble has no `[data-part='who']` label and no narration strip — it never gets a
    // `[data-part='turn']` wrapper (`#makeBubble` returns `outer === bubble` for this role, the smaller
    // diff than inventing an empty, chrome-less wrapper for a role that never carries any).
    const { outer, bubble } = this.#makeBubble('system')
    const body = document.createElement('div')
    body.dataset.part = 'body'
    this.#renderBody(body, text)
    bubble.append(body)
    this.#log!.append(outer)
    void this.#log!.followTail(wasNear)
  }

  /** SPEC-R12 — writes `text` into `el` via the registered content renderer, or plain `textContent`
   *  (default, byte-identical to pre-TKT-0071 behavior) when none is registered. Never called for
   *  `addUserMessage`'s body (SPEC-R4 AC1 — that call site keeps its own direct `textContent` write). */
  #renderBody(el: HTMLElement, text: string): void {
    if (this.#contentRenderer === undefined) {
      el.textContent = text
      return
    }
    el.replaceChildren(this.#contentRenderer(text))
  }

  /** GH #306/ADR-0160 amendment (Kim's 2026-07-27 revision) — the sender label (`[data-part='who']`) and,
   *  for an agent turn, the narration strip both move OUTSIDE the message bubble: free-standing turn
   *  chrome on the page background, above the chromed bubble. `outer` is what the caller appends to the
   *  log; `bubble` is where content (user text / agent note + mounts) goes. For `user`/`agent`, `outer`
   *  is a NEW `[data-part='turn']` wrapper — the log's own alignment role (`align-self`, the base
   *  bubble's 92% width cap) moves onto IT, so the label/strip line up with their own bubble's edge; the
   *  wrapper owns the `[data-role]` a live turn carries (mirroring the bubble's own, the naming-gates.
   *  test.ts Gate-3 dynamic-role matcher already allowlists this `role` identifier for BOTH call sites,
   *  same file/variable). `system` has neither a label nor a strip — no wrapper is minted for it (the
   *  smaller diff): `outer === bubble`, appended to the log exactly as before this change. */
  #makeBubble(role: Role): { outer: HTMLElement; bubble: HTMLElement } {
    const bubble = document.createElement('div')
    bubble.dataset.part = 'bubble'
    // setAttribute, NOT `dataset.role =` — naming-gates.test.ts's Gate-3 dynamic-role matcher recognizes
    // `setAttribute('data-role', ident)` but not a `dataset.X =` write, so this is what makes the closed
    // §6 registry actually govern THIS call site (not just the CSS attribute selectors that consume it).
    bubble.setAttribute('data-role', role)
    if (role === 'system') return { outer: bubble, bubble }

    const turn = document.createElement('div')
    turn.dataset.part = 'turn'
    turn.setAttribute('data-role', role)
    const who = document.createElement('span')
    who.dataset.part = 'who'
    who.textContent = role === 'user' ? 'You' : 'Agent'
    turn.append(who, bubble)
    return { outer: turn, bubble }
  }

  /** A collapsed raw-wire disclosure of this turn's own JSONL lines (ADR-0129 clause 3, opt-in via
   *  `disclosure`) — dependency-free (no `@agent-ui/code`): a plain pretty-printed `<pre>` dump, not
   *  syntax-highlighted (the LLD's `code-block.ts` reuse was page-local chrome, not this SPEC's contract). */
  #buildDisclosure(turnLines: readonly string[]): HTMLElement {
    const pretty = turnLines.map((l) => JSON.stringify(JSON.parse(l), null, 2)).join('\n')
    const details = document.createElement('details')
    details.dataset.part = 'disclosure'
    const summary = document.createElement('summary')
    summary.textContent = 'wire ▸'
    const pre = document.createElement('pre')
    pre.dataset.part = 'wire'
    pre.textContent = pretty || '(no payload this turn)'
    details.append(summary, pre)
    return details
  }

  /** GH #291/ADR-0160 clause 3 — one `ui-button` chip per consumer-supplied `TurnAction` (the
   *  ui-status-stream inline-retry-action precedent, GH #147/ADR-0153 Fork 2 — same variant/size).
   *  Clicking ANY chip removes the WHOLE row (a one-shot commit — a settled turn's feedback/reply
   *  choice can never double-fire) and fires the `action` event on THIS host (never on the button,
   *  never on the bubble — one owning emitter, the ui-conversation public surface) naming the chosen
   *  action's `id`. */
  #buildActions(actions: readonly TurnAction[]): HTMLElement {
    const row = document.createElement('div')
    row.dataset.part = 'actions'
    for (const action of actions) {
      const button = document.createElement('ui-button') as UIButtonElement
      button.setAttribute('variant', 'soft')
      button.setAttribute('size', 'sm')
      button.textContent = action.label
      this.listen(button, 'click', () => {
        row.remove()
        this.emit<{ id: string }>('action', { id: action.id })
      })
      row.append(button)
    }
    return row
  }

  /** `true` once connected (the log/composer exist); else warns ONCE (across every guarded method) and
   *  returns `false` — a documented no-op, never a throw (the ui-surface-host precedent, this same wave). */
  #guard(method: string): boolean {
    if (this.#log !== undefined) return true
    if (!this.#warnedPreConnect) {
      this.#warnedPreConnect = true
      console.warn(`<ui-conversation>: .${method}() called before connect — no thread exists yet; this call is a no-op.`)
    }
    return false
  }
}

if (!customElements.get('ui-conversation')) customElements.define('ui-conversation', UIConversationElement)
