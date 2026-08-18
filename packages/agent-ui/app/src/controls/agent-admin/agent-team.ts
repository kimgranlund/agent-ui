// agent-team.ts — ADR-0203 clause 1 (GH #1191, req-agent-teams.md R1): the `AgentTeam` declaration-first
// record — a GM agent id plus a roster of `{agentId, role, routingDescription}` members — its validator,
// and its persistence, riding the SAME ADR-0193 `StorageAdapter` seam `resource-idb-store.ts` already uses
// in this folder (no new storage tier, ADR-0185's "no parallel wires" precedent). `role` is the short job
// title (CrewAI grammar); `routingDescription` is the when-to-use sentence (Anthropic subagents grammar) —
// both are declared prose only: NOTHING in this module reads `routingDescription` to actually pick a
// member or dispatch a turn (IDR-0001's fence, ADR-0203 clause 2 — that is `composeTeamPromptSection`'s
// job, GH #1194, out of THIS ticket's scope).
//
// Validation is CLOSED (ADR-0203 clause 1 / R1's acceptance): a team whose `gmAgentId` or any member's
// `agentId` does not resolve against a supplied live agent-id roster is rejected outright — `saveAgentTeam`
// never persists an invalid team. `loadAgentTeams` does NOT re-validate against a roster on read: an
// already-persisted team whose member agent was since deleted must degrade to a FLAGGED dangling reference
// (R5) rather than a silent drop — that flagging is the Team pane's own job (GH #1197), not this module's;
// this module only guarantees the record it returns is STRUCTURALLY well-formed.

import { createLocalStorageAdapter, type StorageAdapter } from '@agent-ui/shared'

/** One roster member — a short job title (CrewAI grammar) plus the when-to-use sentence (Anthropic
 *  subagents grammar). Declared prose only; see this module's own header for the IDR-0001 fence. */
export interface AgentTeamMember {
  agentId: string
  role: string
  routingDescription: string
}

/** The declaration-first team record (ADR-0203 clause 1). `members` is `readonly` — a caller mutates by
 *  replacing the array, never by mutating in place, the same discipline `AgentConfigSnapshot`'s own
 *  array-typed fields already carry in `agent-admin-schema.ts`. */
export interface AgentTeam {
  id: string
  label: string
  tagline?: string
  gmAgentId: string
  members: readonly AgentTeamMember[]
}

/** One validation failure, naming the exact field path so a caller (a form, a test) can point at it
 *  directly rather than re-deriving which part of the record was wrong. */
export interface AgentTeamValidationIssue {
  path: string
  message: string
}

/** `validateAgentTeam`'s verdict — `issues` is always the full set found, never short-circuited on the
 *  first failure, so a caller can surface every problem at once instead of a fix-one-see-the-next loop. */
export interface AgentTeamValidationResult {
  valid: boolean
  issues: readonly AgentTeamValidationIssue[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validate one `AgentTeam` against `knownAgentIds` — the live agent roster this team's `gmAgentId` and
 * every member's `agentId` must resolve against (ADR-0203 clause 1 / R1's acceptance: "member `agentId`s
 * referencing missing agents fail validation closed"). Structural checks (non-empty `id`/`label`/`role`/
 * `routingDescription`) ride alongside the same fail-closed law — an empty-string field is exactly as
 * invalid as a dangling reference, never silently accepted.
 */
export function validateAgentTeam(team: AgentTeam, knownAgentIds: readonly string[]): AgentTeamValidationResult {
  const issues: AgentTeamValidationIssue[] = []
  const known = new Set(knownAgentIds)

  if (!isNonEmptyString(team.id)) issues.push({ path: 'id', message: 'A team id is required.' })
  if (!isNonEmptyString(team.label)) issues.push({ path: 'label', message: 'A team label is required.' })
  if (team.tagline !== undefined && typeof team.tagline !== 'string') {
    issues.push({ path: 'tagline', message: 'tagline must be a string when present.' })
  }

  if (!isNonEmptyString(team.gmAgentId)) {
    issues.push({ path: 'gmAgentId', message: 'A GM agent id is required.' })
  } else if (!known.has(team.gmAgentId)) {
    issues.push({ path: 'gmAgentId', message: `No agent "${team.gmAgentId}" exists for this team's GM.` })
  }

  if (!Array.isArray(team.members)) {
    issues.push({ path: 'members', message: 'members must be an array.' })
  } else {
    team.members.forEach((member, index) => {
      const base = `members[${index}]`
      if (!isNonEmptyString(member.agentId)) {
        issues.push({ path: `${base}.agentId`, message: 'A member agent id is required.' })
      } else if (!known.has(member.agentId)) {
        issues.push({ path: `${base}.agentId`, message: `No agent "${member.agentId}" exists for this team member.` })
      }
      if (!isNonEmptyString(member.role)) issues.push({ path: `${base}.role`, message: 'A member role is required.' })
      if (!isNonEmptyString(member.routingDescription)) {
        issues.push({ path: `${base}.routingDescription`, message: 'A member routing description is required.' })
      }
    })
  }

  return { valid: issues.length === 0, issues }
}

// ── persistence (ADR-0193 StorageAdapter seam — no new storage tier) ────────────────────────────────────
// Mirrors `resource-idb-store.ts`'s own lazy-adapter + test-override shape in this same folder: a real
// adapter is constructed lazily (never at module load, so an SSR/test import never touches localStorage),
// and a test may swap it for an in-memory fake via `__testSetAdapter` (the `document-extraction.ts`
// `__testResetRegistry` naming precedent this folder already follows).

const AGENT_TEAMS_NAMESPACE = 'agent-ui-agent-teams'

let realAdapter: StorageAdapter | undefined
let adapterOverride: StorageAdapter | undefined

function getAdapter(): StorageAdapter {
  if (adapterOverride) return adapterOverride
  realAdapter ??= createLocalStorageAdapter({ namespace: AGENT_TEAMS_NAMESPACE })
  return realAdapter
}

/** Test-only escape hatch — swap the backing `StorageAdapter` for an in-memory fake (the SAME
 *  `resource-idb-store.ts` precedent), so a jsdom-run vitest suite can prove this module's own read/write
 *  logic without a real browser. `undefined` restores the real (lazily-constructed) localStorage adapter. */
export function __testSetAdapter(adapter: StorageAdapter | undefined): void {
  adapterOverride = adapter
}

function isAgentTeamMember(value: unknown): value is AgentTeamMember {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AgentTeamMember).agentId === 'string' &&
    typeof (value as AgentTeamMember).role === 'string' &&
    typeof (value as AgentTeamMember).routingDescription === 'string'
  )
}

/** A fail-closed structural type-guard — the SAME "a corrupt/foreign record reads as absent, never a
 *  throw" law `loadImportedPersonas` (site/pages/agent-admin-presets.ts) already applies to its own
 *  roster record; this module's persistence never trusts a raw adapter read without re-checking its shape. */
function isAgentTeam(value: unknown): value is AgentTeam {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as AgentTeam
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    (candidate.tagline === undefined || typeof candidate.tagline === 'string') &&
    typeof candidate.gmAgentId === 'string' &&
    Array.isArray(candidate.members) &&
    candidate.members.every(isAgentTeamMember)
  )
}

/** Every persisted team, fail-closed: a foreign/corrupt key under this namespace is skipped rather than
 *  thrown on (never takes the whole read down with it) — read-time only, no re-validation against a live
 *  agent roster (this module's own header explains why: that is R5's flagged-dangling-reference job, not
 *  a silent drop here). */
export async function loadAgentTeams(): Promise<AgentTeam[]> {
  const adapter = getAdapter()
  const keys = await adapter.keys()
  const teams: AgentTeam[] = []
  for (const key of keys) {
    const value = await adapter.get(key)
    if (isAgentTeam(value)) teams.push(value)
  }
  return teams
}

/** One persisted team by id, or `undefined` when absent/corrupt. */
export async function loadAgentTeam(id: string): Promise<AgentTeam | undefined> {
  const value = await getAdapter().get(id)
  return isAgentTeam(value) ? value : undefined
}

/**
 * Validate, then persist ONE team keyed by its own `id` (last-write-wins on a same-id record, the SAME
 * `saveImportedPersona` dedupe-not-merge law). VALIDATION CLOSED: an invalid team (per `validateAgentTeam`
 * against `knownAgentIds`) is never written — the caller gets back the same issues `validateAgentTeam`
 * would report, with nothing landed in the store.
 */
export async function saveAgentTeam(team: AgentTeam, knownAgentIds: readonly string[]): Promise<AgentTeamValidationResult> {
  const result = validateAgentTeam(team, knownAgentIds)
  if (!result.valid) return result
  await getAdapter().set(team.id, team)
  return result
}

/** Remove one persisted team by id — a no-op (never a throw) when it was never persisted, matching
 *  `StorageAdapter.delete`'s own contract. */
export async function deleteAgentTeam(id: string): Promise<void> {
  await getAdapter().delete(id)
}
