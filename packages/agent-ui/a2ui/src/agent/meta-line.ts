// meta-line.ts — ADR-0088 §1: the reserved leading meta-line envelope + its guard.
//
// The demo-transport's natural-language `note` (+ the ADR-0088 §2 `TurnTrace`) rides the SAME
// `AsyncIterable<string>` stream `AgentTransport.turn()` already returns (`agent-transport.ts:67-69`) —
// as a single reserved JSON line, emitted FIRST, ahead of any A2UI JSONL. This is a demo-transport
// FRAMING convention, not part of the A2UI protocol: it carries no `version` key, so it is provably
// **not** an `A2uiServerMessage` — every server message carries `version` plus one of the fixed
// envelope keys that `dispatch()` routes on (`../../src/renderer/dispatch.ts:72-78`: the version gate at
// line 76, the envelope-key `if`-chain after). `produce()` (LLD-C3) peels this line off `raw` BEFORE
// heal/validateA2ui — the note never reaches the shared validator and never enters the corpus path
// (SPEC-N3 wire purity, ADR-0070 clause 3).
//
// ADR-0097 §1 adds ONE additive field, `ask`: the model declares a feed-embedded ask by carrying
// `{surfaceId}` on the SAME leading meta-line as `note`. The `ask` payload itself is ORDINARY A2UI — it
// rides the shared validated stream exactly like every other surface (SPEC-R5 untouched); this envelope
// only carries the ROUTING fact ("that surfaceId is an ask"), never the payload. The `version` guard, the
// note/trace fields, and the disjointness-from-`A2uiServerMessage` proof are all UNCHANGED — `ask` is
// shallow-validated the SAME way `note`/`trace` are: a malformed `ask` (non-object, or missing/non-string
// `surfaceId`) yields the envelope WITHOUT `ask` (never the whole envelope dropped) — the note/trace
// still parse normally, so a broken `ask` never breaks the conversational channel it rides on.
//
// ADR-0174 cl.2 / SPEC-R20 adds a second additive field, `plan`: the model declares a step list by
// carrying `{steps: [{id, description}]}` on the SAME leading meta-line as `note`/`ask`, following the
// `ask`-arm precedent EXACTLY — MODEL-authored, shallow-validated the same per-field-independent way (a
// malformed `plan` drops only itself, never the whole envelope). The host-side plan→execute→synthesize
// loop that reads a declared `plan`, and any `plan`-analogue of `ask`'s surfaceId-correlation integrity
// check, are a future SPEC/LLD's job — this file carries the wire representation ONLY.
//
// ADR-0178 cl.1 / SPEC-R29 adds a third additive MODEL-authored field, `personaPatch`: an authoring turn
// declares persona-state deltas by carrying `{values?, entries?}` on the SAME leading meta-line, following
// the `ask`/`plan`-arm precedent EXACTLY (a malformed `personaPatch` drops only itself). The values stay
// `unknown` here on purpose: this package is persona-key-AGNOSTIC by construction (the package DAG runs
// `a2ui` ← `app`, and the persona schema lives in `app`), and every semantic filter — the enumerated-key
// filter, the per-key fail-closed sanitizer, `validateNewEntry` — is HOST-side (ADR-0178 cl.2, a future
// slice). The merge law those filters apply (incremental per turn; `values` last-writer-wins at whole-value
// granularity; `entries` appended, never replacing; no deletion semantics) is SPEC-R29's, stated there and
// enforced there — this file carries the wire representation ONLY.
//
// ADR-0198 cl.1 adds a FOURTH additive MODEL-authored field, `flowEnd`: the closing turn of an
// ask-flow (the turn AFTER the user commits the flow-final confirm) declares completion by carrying
// `flowEnd: true` on the SAME leading meta-line as `note`, following the `ask`/`plan`/`personaPatch`
// arm precedent EXACTLY — shallow-validated per-field-independently (anything other than literal
// `true` yields the envelope WITHOUT `flowEnd`, never the whole envelope dropped). A bare boolean,
// not an object, deliberately: v1 carries no payload; if a future consumer earns structure the field
// widens additively to `true | {...}`. A model that omits it degrades safely to today's behavior —
// chrome only ever acts on the explicit field, never a heuristic (ADR-0198 Non-goals).
//
// GH #1196 (ADR-0203 clause 4, realizing IDR-0001) adds a FIFTH additive MODEL-authored field,
// `team`: the Builder interview's team-shaped generation path declares a proposed roster — a label
// plus N member seeds (`name`/`role`/`routingDescription`) — on the SAME leading meta-line as
// `note`/`personaPatch`, following the `plan`-arm precedent EXACTLY for its array-of-typed-members
// shape: the arm validates as a WHOLE (any malformed member drops the entire `team` arm, never a
// partial roster — the same law `personaPatch`/`plan` already apply, chosen for the identical
// reason: a half-parsed roster is the one shape a host mint loop must never be handed). Deliberately
// NOT routed through `personaPatch`'s `values`/`entries` members: those propose deltas onto ONE
// already-existing store, whereas `team` names N-to-be-MINTED personas plus a team record — a
// structurally different kind of proposal, so it rides its own field rather than overloading an
// existing one. This package stays consumer-agnostic exactly as it does for `personaPatch`: what a
// `team` declaration is CONSUMED into (minting personas, building an `AgentTeam` record, persisting
// it) is entirely the host's call (`packages/agent-ui/app`'s agent-admin control + the site's mint
// path) — this file carries the wire representation ONLY.
//
// Zero-dep, pure (SPEC-N5): no imports.

/**
 * The per-turn decision trace (ADR-0088 §2) — assembled by `produce()` from data already flowing
 * through its loop (the retrieval query, which exemplars matched, self-correct rounds, healer
 * corrections, the authoritative model). Lives browser-side, parallel to `Session.turns`
 * (`agent-transport.ts`), never inside `session.turns` and never on the validated A2UI wire — only
 * carried, transiently, on this same meta-line.
 */
export interface TurnTrace {
  turnIndex: number
  query: { intent: string; k: number }
  /** WHICH judged-shard records (`CorpusRecord.name`, unique per record) conditioned this turn. */
  exemplarIds: string[]
  /** Self-correct rounds taken (1 = first-try valid). */
  rounds: number
  /** Lines the shared healer (`../../src/corpus/heal.ts`) corrected on the round that succeeded. */
  healed: number
  /** The validator failure codes fed back into the successful round's prompt, if any. */
  failureCodes: string[]
  model: string
}

/**
 * A feed-embedded ask declaration (ADR-0097 §1): `surfaceId` names the FRESH A2UI surface, created on the
 * SAME validated stream, that hosts the ask's structured UI. This is a routing fact only — no payload, no
 * mechanics — the surface it names is ordinary `createSurface`/`updateComponents`/`updateDataModel`.
 */
export interface AskDeclaration {
  surfaceId: string
}

/**
 * One step of a model-declared plan (ADR-0174 cl.2 / SPEC-R20) — `id` names the step, `description` is
 * the model's own prose for what that step does. Wire representation ONLY: the host-side executor loop
 * that reads a declared plan and drives it is a future SPEC/LLD's job, not this envelope's.
 */
export interface PlanStep {
  id: string
  description: string
}

/**
 * A plan declaration (ADR-0174 cl.2 / SPEC-R20): the model's own step list, following the `ask`-arm
 * precedent EXACTLY — MODEL-authored (never runtime-composed), shallow-validated the same
 * per-field-independent way (`readMetaLine` below), and carrying NO integrity check here (ADR-0174 Open
 * fork OF1 — a `plan` is displayed/passed-through as declared, host-trusted, until a future requirement
 * rules otherwise).
 */
export interface PlanDeclaration {
  steps: PlanStep[]
}

/**
 * A persona-state patch (ADR-0178 cl.1 / SPEC-R29): a MODEL-authored PARTIAL record of persona-scoped
 * store state, declared by an authoring turn on the SAME leading meta-line as `note`. `values` proposes
 * scalar state (config values, switch states); `entries` proposes CONTRIBUTIONS to the entry-list keys.
 * The two members are the two KINDS of proposal ADR-0178 cl.1 enumerates, declared distinctly so the model
 * states its INTENT (set vs. contribute) rather than the host inferring it from a key table.
 *
 * Both members' values are `unknown` here — see the file header: no persona key set, sanitizer, or entry
 * shape is known to this package. The host's three-filter apply gate (ADR-0178 cl.2) is what admits any of
 * it, under SPEC-R29's merge law: incremental per turn, `values` last-writer-wins at WHOLE-VALUE
 * granularity per key (absent key untouched, no deep merge), `entries` appended through the shipped
 * `validateNewEntry` add path (never a list replace), and NO deletion semantics in this version — which is
 * what keeps a hallucinated patch non-destructive by construction.
 */
export interface PersonaPatch {
  values?: Record<string, unknown>
  entries?: Record<string, unknown[]>
}

/**
 * One proposed team-member seed (GH #1196 / ADR-0203 clause 4): a short display `name`, a short job
 * title (`role`, CrewAI grammar), and the when-to-use sentence (`routingDescription`, Anthropic
 * subagents grammar) — the SAME two-field shape `AgentTeamMember` (`agent-team.ts`, PR #1231) already
 * persists, so a minted member and its declaration agree byte-for-byte on field names. Deliberately
 * NOT a full persona seed: richly authoring a member's own prompt/skills/etc. is the EXISTING
 * single-agent Builder flow's job, reachable after the team is minted — this declaration only carries
 * what R4's acceptance actually requires (a non-empty `routingDescription` per member).
 */
export interface TeamMemberSeed {
  name: string
  role: string
  routingDescription: string
}

/**
 * A team declaration (GH #1196 / ADR-0203 clause 4): the Builder's team-shaped generation path names
 * a proposed roster — following the `ask`/`plan`/`personaPatch`-arm precedent EXACTLY (MODEL-authored,
 * shallow-validated the same per-field-independent way, this file's own file-header explains why it is
 * a SEPARATE field rather than a `personaPatch` member). `label`/`tagline` seed the `AgentTeam` record's
 * own fields 1:1; `members` seeds `AgentTeamMember[]` 1:1 (`agentId` is filled in by the host at mint
 * time — the wire never carries an id that does not exist yet). Wire representation ONLY: which
 * persona is the GM, how members are minted, and whether/how the resulting `AgentTeam` is validated
 * and saved are entirely the host's call (ADR-0203 clause 1's validation-closed law, enforced host-side).
 */
export interface TeamDeclaration {
  label: string
  tagline?: string
  members: TeamMemberSeed[]
}

/**
 * The closed live-turn lifecycle stage vocabulary (ADR-0146 F1) — produce-layer-owned, provider-agnostic.
 * Each adapter maps its OWN upstream events onto these (F4); `produce()` composes them with its own loop
 * stages. A CLOSED union: an out-of-vocabulary stage is dropped at the guard (`readMetaLine`), never
 * rendered — the honesty-law guard (F2) that a stage never observed is never shown.
 */
// 'tool' joined with GH #49 (the integrations loop): a factual process claim — "executing <registry
// tool name>" — from the closed integration registry, never model-composed prose; the F2 honesty law's
// closed-table growth is recorded in the a2ui-live-agent SPEC's versioned amendment.
export const TURN_PROGRESS_STAGES = ['sent', 'started', 'reasoning', 'content', 'validating', 'retry', 'tool', 'done'] as const
export type TurnProgressStage = (typeof TURN_PROGRESS_STAGES)[number]
const TURN_PROGRESS_STAGE_SET: ReadonlySet<string> = new Set(TURN_PROGRESS_STAGES)

/**
 * A live-turn progress event (ADR-0146 F1) — a runtime-composed, closed-vocabulary lifecycle signal that
 * rides the SAME `AsyncIterable<string>` as `{"a2uiMeta":{"progress":…}}` meta-lines, INTERLEAVED during
 * the turn (never content — it never enters heal/validate/corpus; SPEC-R5 validate-then-stream untouched).
 * `round` carries the self-correct round ordinal on `'retry'`; `detail` carries OPTIONAL factual text
 * (F3-gated: absent by default, forwarded only under `progressDetail:'full'` — never required for any stage).
 * `source` (GH #240/ADR-0159 wave B — the per-step source reveal) carries the raw A2UI JSONL line(s) behind
 * the stage — the actual createSurface/updateDataModel/updateComponents text a step stands for, newline-
 * joined and producer-capped. Attached ONLY under the explicit `progressDetail:'source'` opt-in (produce.ts
 * owns the gate + the cap); absent on every default stream — the privacy gate stays fail-closed.
 */
export interface TurnProgress {
  stage: TurnProgressStage
  round?: number
  detail?: string
  source?: string
}

/**
 * The reserved wrapper (ADR-0088 §1/§2, ADR-0097 §1). `note` is the model's contemporaneous natural-
 * language rationale/reply; `ask` is the model-authored feed-ask routing declaration (produce() peels it,
 * verifies its integrity, and re-composes it on the outgoing meta-line only when it holds); `trace` is the
 * runtime-assembled `TurnTrace` (the model never authors `trace` itself — only `produce()` attaches it
 * before yielding); `progress` is a runtime-composed live-turn lifecycle event (ADR-0146 F1), the one kind
 * that may INTERLEAVE during the turn rather than ride only the single leading line. `error` is a
 * runtime-composed, TERMINAL failure signal (GH #144) — a transport (the dev proxy / the Cloudflare
 * Worker) writes it as the LAST line on a stream whose headers already committed 200 before `produce()`
 * halted (`ProduceHalt`, the round bound exhausted) or otherwise threw mid-loop (an upstream fault): the
 * ONLY way such a transport can turn an already-200 stream into a VISIBLE client-side failure instead of a
 * silently-empty "success" (SPEC-R5's "halt-and-report" was always produce()-internal; nothing carried
 * that report across the wire until this field). The model never authors `error` — only a transport does,
 * exactly like `trace`. All five fields are optional: a note-only line omits `ask`/`trace`/`progress`/
 * `error`; a progress line carries only `progress`; an error line carries only `error`; a malformed/leaked
 * line may omit any of them.
 */
export interface A2uiMetaEnvelope {
  a2uiMeta: {
    note?: string
    ask?: AskDeclaration
    /** ADR-0174 cl.2 / SPEC-R20: the model's own declared step list, additive alongside `note`/`ask` on
     *  the SAME leading meta-line. MODEL-authored, shallow-validated the same per-field-independent way
     *  `ask` is — a malformed `plan` drops only itself, never the whole envelope. */
    plan?: PlanDeclaration
    /** ADR-0178 cl.1 / SPEC-R29: the model's own persona-state delta, additive alongside `note`/`ask`/
     *  `plan` on the SAME leading meta-line. MODEL-authored, shallow-validated the same per-field-
     *  independent way — a malformed `personaPatch` drops only itself, never the whole envelope. Whether
     *  a declared patch is ever CONSUMED is the host's call, gated per persona (SPEC-R30); the wire layer
     *  is gate-blind. */
    personaPatch?: PersonaPatch
    /** ADR-0198 cl.1: the model's own flow-completion declaration — the closing turn of an ask-flow
     *  carries literal `true`, additive alongside `note`/`ask`/`plan`/`personaPatch` on the SAME
     *  leading meta-line. MODEL-authored, shallow-validated the same per-field-independent way — a
     *  malformed `flowEnd` (anything but literal `true`) drops only itself, never the whole envelope. */
    flowEnd?: true
    /** GH #1196 / ADR-0203 clause 4: the Builder's team-shaped generation path's own declared roster,
     *  additive alongside `note`/`ask`/`plan`/`personaPatch`/`flowEnd` on the SAME leading meta-line.
     *  MODEL-authored, shallow-validated the same per-field-independent way, validating as a WHOLE the
     *  same way `plan`/`personaPatch` do — a malformed `team` (or any malformed member) drops the
     *  entire arm, never a partial roster. Whether a declared team is ever CONSUMED (minted, validated,
     *  saved) is entirely the host's call — the wire layer is gate-blind, exactly like `personaPatch`. */
    team?: TeamDeclaration
    trace?: TurnTrace
    /** ADR-0146 F1: a runtime-composed live-turn lifecycle event, INTERLEAVED during the turn (not just a
     *  single leading line). Shallow-validated the same way `ask` is — a malformed `progress` drops only
     *  itself, never the whole envelope. */
    progress?: TurnProgress
    /** GH #144: a transport-composed terminal failure message — see the interface doc above. Shallow-
     *  validated the same way `note` is (a plain string); a malformed `error` drops only itself. */
    error?: string
  }
}

/**
 * Parse `line` as a meta-line, or `undefined` if it is not one — never throws. A meta-line is a JSON
 * object carrying the reserved `a2uiMeta` wrapper key and, provably, NO `version` key — the
 * `A2uiServerMessage` discriminator (`dispatch.ts`'s version gate) — which is what keeps this
 * convention disjoint from the protocol it rides beside (ADR-0088 §1). Shallow-validates `note`/`trace`/
 * `ask`/`progress` field TYPES (not `trace`'s inner shape — it is runtime-assembled, never wire-validated);
 * a malformed `ask`/`progress` drops only itself, never the whole envelope.
 */
/** A non-null, non-array object — the shape every shallow field guard below already tests inline. Named
 *  once for the `personaPatch` arm (SPEC-R29), which tests it three times; the older guards keep their
 *  inline form so their diffs stay byte-quiet. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readMetaLine(line: string): A2uiMetaEnvelope | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  if ('version' in parsed) return undefined // provably an A2uiServerMessage shape, never a meta-line
  if (!('a2uiMeta' in parsed)) return undefined

  const meta = (parsed as { a2uiMeta: unknown }).a2uiMeta
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const m = meta as Record<string, unknown>
  if (m.note !== undefined && typeof m.note !== 'string') return undefined
  if (m.trace !== undefined && (typeof m.trace !== 'object' || m.trace === null)) return undefined
  // GH #144: `error` is shallow-validated the SAME way as `note` — a non-string value drops only itself
  // (the field goes `undefined` below), never the whole envelope.
  const error = typeof m.error === 'string' ? m.error : undefined

  // ADR-0097 §1: `ask` is shallow-validated the same way as note/trace, but a MALFORMED `ask` drops only
  // itself — never the whole envelope (note/trace still parse normally). Never throws, never invents a
  // surfaceId.
  let ask: AskDeclaration | undefined
  if (m.ask !== undefined && typeof m.ask === 'object' && m.ask !== null && !Array.isArray(m.ask)) {
    const surfaceId = (m.ask as Record<string, unknown>).surfaceId
    if (typeof surfaceId === 'string') ask = { surfaceId }
  }

  // ADR-0174 cl.2 / SPEC-R20: `plan` is shallow-validated the SAME per-field-independent way as `ask` — a
  // malformed `plan` (non-object, a missing/non-array `steps`, or any step missing a string `id` or a
  // string `description`) drops ONLY `plan`, never the whole envelope (note/ask/trace/progress/error on
  // the same line still parse normally). MODEL-authored, never runtime-composed — never throws, never
  // invents a step.
  let plan: PlanDeclaration | undefined
  if (m.plan !== undefined && typeof m.plan === 'object' && m.plan !== null && !Array.isArray(m.plan)) {
    const steps = (m.plan as Record<string, unknown>).steps
    if (
      Array.isArray(steps) &&
      steps.every(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          !Array.isArray(s) &&
          typeof (s as Record<string, unknown>).id === 'string' &&
          typeof (s as Record<string, unknown>).description === 'string',
      )
    ) {
      plan = { steps: steps as PlanStep[] }
    }
  }

  // ADR-0178 cl.1 / SPEC-R29: `personaPatch` is shallow-validated the SAME per-field-independent way as
  // `ask`/`plan` — a malformed patch drops ONLY `personaPatch`, never the whole envelope. The arm
  // validates as a WHOLE (a malformed member drops the entire arm, not just that member): a half-parsed
  // patch is the one shape a host apply loop must never be handed. Malformed = a non-object/array arm; a
  // present-but-non-object `values`; a present-but-non-object `entries`, or one whose any member is not an
  // array; or NEITHER member present. Member VALUES stay `unknown` — this package knows no persona key.
  let personaPatch: PersonaPatch | undefined
  if (m.personaPatch !== undefined && isPlainObject(m.personaPatch)) {
    const p = m.personaPatch
    const values = p.values
    const entries = p.entries
    const valuesOk = values === undefined || isPlainObject(values)
    const entriesOk = entries === undefined || (isPlainObject(entries) && Object.values(entries).every((v) => Array.isArray(v)))
    if (valuesOk && entriesOk && (values !== undefined || entries !== undefined)) {
      personaPatch = {
        ...(values !== undefined ? { values: values as Record<string, unknown> } : {}),
        ...(entries !== undefined ? { entries: entries as Record<string, unknown[]> } : {}),
      }
    }
  }

  // ADR-0198 cl.1: `flowEnd` is shallow-validated the SAME per-field-independent way as
  // `ask`/`plan`/`personaPatch` — anything other than literal `true` (a string "true", 1, an object,
  // `false`) drops ONLY `flowEnd`, never the whole envelope (note/ask/plan/personaPatch/trace/
  // progress/error on the same line still parse normally). MODEL-authored; omitted = not a closing
  // turn — the safe-degrade law.
  const flowEnd: true | undefined = m.flowEnd === true ? true : undefined

  // GH #1196 / ADR-0203 clause 4: `team` is shallow-validated the SAME per-field-independent way as
  // `ask`/`plan`/`personaPatch` — a malformed `team` drops ONLY `team`, never the whole envelope. The
  // arm validates as a WHOLE, the SAME `plan`/`personaPatch` law: a non-object arm, a missing/non-
  // string `label`, a present-but-non-string `tagline`, a missing/non-array `members`, or any member
  // missing a string `name`/`role`/`routingDescription` drops the ENTIRE arm — a half-parsed roster is
  // the one shape a host mint loop must never be handed.
  let team: TeamDeclaration | undefined
  if (m.team !== undefined && isPlainObject(m.team)) {
    const t = m.team
    const label = t.label
    const tagline = t.tagline
    const members = t.members
    const labelOk = typeof label === 'string'
    const taglineOk = tagline === undefined || typeof tagline === 'string'
    const membersOk =
      Array.isArray(members) &&
      members.every(
        (member) =>
          isPlainObject(member) &&
          typeof member.name === 'string' &&
          typeof member.role === 'string' &&
          typeof member.routingDescription === 'string',
      )
    if (labelOk && taglineOk && membersOk) {
      team = {
        label: label as string,
        ...(tagline !== undefined ? { tagline: tagline as string } : {}),
        members: members as TeamMemberSeed[],
      }
    }
  }

  // ADR-0146 F1: `progress` is shallow-validated the SAME way — a malformed `progress` (non-object, or a
  // `stage` outside the closed vocabulary, or a non-number `round` / non-string `detail`/`source`) drops
  // only itself, never the whole envelope. The closed `stage` union is the honesty-law guard (F2): an
  // out-of-vocabulary stage never survives the parse, so it can never be rendered.
  let progress: TurnProgress | undefined
  if (m.progress !== undefined && typeof m.progress === 'object' && m.progress !== null && !Array.isArray(m.progress)) {
    const p = m.progress as Record<string, unknown>
    const stageOk = typeof p.stage === 'string' && TURN_PROGRESS_STAGE_SET.has(p.stage)
    const roundOk = p.round === undefined || typeof p.round === 'number'
    const detailOk = p.detail === undefined || typeof p.detail === 'string'
    const sourceOk = p.source === undefined || typeof p.source === 'string' // GH #240 — same posture as detail
    if (stageOk && roundOk && detailOk && sourceOk) {
      progress = {
        stage: p.stage as TurnProgressStage,
        ...(p.round !== undefined ? { round: p.round as number } : {}),
        ...(p.detail !== undefined ? { detail: p.detail as string } : {}),
        ...(p.source !== undefined ? { source: p.source as string } : {}),
      }
    }
  }

  return {
    a2uiMeta: {
      note: m.note as string | undefined,
      ask,
      plan,
      personaPatch,
      flowEnd,
      team,
      trace: m.trace as TurnTrace | undefined,
      progress,
      error,
    },
  }
}

/**
 * Format a transport-composed terminal error line (GH #144) — the wire counterpart `readMetaLine` parses
 * back into `a2uiMeta.error`. A transport (the dev proxy / the Cloudflare Worker) writes this as the LAST
 * line on a stream whose headers already committed 200 before `produce()` halted or otherwise threw
 * mid-loop, so the failure is VISIBLE client-side instead of reading as an empty "success" (a stream that
 * just ends with zero content lines and zero explanation). No `version` key ⇒ provably not an
 * `A2uiServerMessage`, same disjointness proof `readMetaLine`'s header documents for every meta-line kind.
 */
export function formatErrorLine(message: string): string {
  return JSON.stringify({ a2uiMeta: { error: message } })
}

/**
 * `true` iff `line` is a well-formed meta-line (per `readMetaLine`'s guard) — the cheap boolean form for
 * callers that only need to route/filter (e.g. the page's ingest filter, later slices), not read the
 * payload.
 */
export function isMetaLine(line: string): boolean {
  return readMetaLine(line) !== undefined
}
