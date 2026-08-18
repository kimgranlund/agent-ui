// agent-team-prompt.ts — GH #1194 (ADR-0203 clause 2, req-agent-teams.md R2): the GM's team-roster prompt
// section — a PURE projection from a declared `AgentTeam` (agent-team.ts) onto one composed markdown block,
// riding the SAME `composeSystemPrompt` pipeline every other section already composes through
// (`entries.ts:251`). This is the "declared, composed, and NEVER executed" half of ADR-0203 clause 2: the
// section TELLS the GM who it can consult and when (the handoff-as-instruction framing, Anthropic subagents'
// own routing-description grammar) — nothing here reads `routingDescription` to actually pick a member,
// dispatch a sub-call, or manage a branched conversation thread. That is the fenced-off runtime orchestrator
// IDR-0001 defers, unchanged by this module.
//
// `composeTeamPromptSection` never throws and never depends on live store state — it is a pure function over
// its two arguments, exactly the discipline `composeSystemPrompt` itself already holds. A member whose
// `agentId` has no matching `memberSnapshots` entry (the store's own agent record was deleted, or the caller
// simply hasn't loaded it yet) degrades to using the bare `agentId` as its display name — never a thrown
// error and never a dropped roster row, since dropping a member here would silently understate the GM's own
// team to itself. (Flagging a dangling reference VISIBLY is the Team pane's job, GH #1197/R5 — this module
// only guarantees a byte-stable, always-rendering projection.)

import type { AgentTeam, AgentTeamMember } from './agent-team.ts'

/** One team member's display name, keyed by `agentId` — a caller-supplied snapshot (typically each member's
 *  `AgentConfigSnapshot.name`), never a live store read: this module stays pure, so the caller resolves names
 *  once and hands over the result. */
export interface TeamMemberSnapshot {
  agentId: string
  name: string
}

/** The team-roster prompt section's own heading — the SAME `## {heading}` block shape every other composed
 *  section already uses (`entries.ts`'s `DEFAULT_PROMPT_SECTIONS`/`LiveCapabilityGroup` blocks). */
const TEAM_SECTION_HEADING = '## Your team'

/** The handoff-AS-INSTRUCTION framing sentence (ADR-0203 clause 2) — told once, ahead of the roster, so the
 *  GM reads its members as consultable expertise it references in its OWN reply, never as a callable tool: no
 *  runtime dispatch, no branched thread, no automatic handoff exists for this sentence to promise. */
const TEAM_SECTION_INTRO =
  'You lead the team below. When a request matches a teammate\'s routing rule, you may say you are consulting ' +
  'them, but nothing here dispatches automatically — continue the conversation yourself, drawing on their role ' +
  "and routing rule as guidance for what to say and when."

function displayNameFor(agentId: string, memberSnapshots: readonly TeamMemberSnapshot[]): string {
  return memberSnapshots.find((snapshot) => snapshot.agentId === agentId)?.name ?? agentId
}

/** One roster row: `- **{name}** ({role}): {routingDescription}` — bold name (visually distinct from the
 *  role/routing prose that follows), the role as a short parenthetical job title, then the when-to-use
 *  sentence verbatim. Member order is the team's OWN declared order (`team.members`, `AgentTeam`'s `readonly`
 *  array) — never re-sorted, since a team's roster carries no `order` field of its own to sort by (unlike
 *  `Entry`'s kind, which the rest of this pipeline sorts by `order`/`id`). */
function teamMemberLine(member: AgentTeamMember, memberSnapshots: readonly TeamMemberSnapshot[]): string {
  const line = `- **${displayNameFor(member.agentId, memberSnapshots)}** (${member.role}): ${member.routingDescription}`
  // ADR-0203 Amendment (GH #1277) — the OPTIONAL GM-facing instructions render as an indented sub-line
  // UNDER the member's roster line when present; absent ⇒ the pre-amendment line, byte-identical.
  return member.instructions === undefined ? line : `${line}\n  - Instructions: ${member.instructions}`
}

/**
 * The GM's team-roster prompt section (ADR-0203 clause 2 / req-agent-teams.md R2): given a team and a
 * snapshot of its members' display names, renders one `## Your team` block naming every member, its role, and
 * its routing rule — deterministic and byte-stable for the same `(team, memberSnapshots)` pair. An empty
 * roster (`team.members.length === 0`) composes to the empty string, so a team with no members contributes
 * nothing wherever this section joins (the SAME gated-equivalence law `composeLiveSystemPrompt`'s capability
 * groups already hold: nothing to say ⇒ zero bytes, never a dangling heading).
 */
export function composeTeamPromptSection(team: AgentTeam, memberSnapshots: readonly TeamMemberSnapshot[]): string {
  if (team.members.length === 0) return ''
  const rows = team.members.map((member) => teamMemberLine(member, memberSnapshots))
  return `${TEAM_SECTION_HEADING}\n${TEAM_SECTION_INTRO}\n\n${rows.join('\n')}`
}

/** The gating input `composeSystemPrompt` (entries.ts) takes to decide whether ITS caller's active agent
 *  earns the team section at all (ADR-0203 clause 2: "the team section joins ONLY when the active agent is a
 *  team's `gmAgentId`") — never inferred from the team shape alone, since every member (not only the GM) is a
 *  real agent this same pipeline composes a prompt for. */
export interface TeamPromptContext {
  team: AgentTeam
  /** The agent this prompt is being composed FOR — the section joins iff this equals `team.gmAgentId`. */
  activeAgentId: string
  memberSnapshots: readonly TeamMemberSnapshot[]
}

/** `true` iff `context`'s active agent is its own team's GM — the ONE gate `composeSystemPrompt` applies
 *  before joining `composeTeamPromptSection`'s output; a plain named predicate so that gate is a single,
 *  testable expression rather than an inline comparison duplicated at every call site. */
export function isTeamGm(context: TeamPromptContext): boolean {
  return context.activeAgentId === context.team.gmAgentId
}
