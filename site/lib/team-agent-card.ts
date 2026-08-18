// site/lib/team-agent-card.ts — ADR-0203 clause 3 (GH #1195, req-agent-teams.md R3): the SITE-SIDE
// `teamMemberToAgentCard` mapper. `@agent-ui/app` never imports `@agent-ui/a2a` (CLAUDE.md's DAG
// law), so this mapping — which needs `AgentConfigSnapshot`'s shape from `@agent-ui/app` on one side
// and `A2aAgentCard`'s type from `@agent-ui/a2a` on the other — lives here instead: `site/` already
// sits above every package in the tree by construction, the same locus `flow-chrome.ts` and
// `ndjson-lines.ts` already occupy (ADR-0203's Consequences names both as precedent). The rejected
// alternative (ADR-0203 clause 3, "Alternatives considered") was structural/duck-typed re-declaration
// of `A2aAgentCard` INSIDE `@agent-ui/app` — silently drifting the moment the a2a package's type
// changes, with nothing catching it; importing the real type here instead gets real compiler checking
// at zero DAG cost.
//
// Mapping law (R3, verbatim): "name/description from the agent record, skills[] from enabled
// skill/workflow entry labels (A2aAgentSkill.tags from kind), pin protocolVersion: '0.3.0' as
// shipped." `resources`/`tools` are turn-time capabilities the snapshot also carries but are
// deliberately NOT mapped into `skills[]` — they aren't A2A-discoverable skills, just runtime inputs.
// Cards are derived for LOCAL inspection/export only (ADR-0203 Non-goals: "no network A2A serving or
// discovery") — `url` is a synthetic local identifier, never a real served endpoint, and `version` (the
// agent's OWN version, distinct from the `protocolVersion` pin per SPEC-R2's reconcile note) has no
// tracked source yet, so it is a fixed placeholder until the agent record grows one.

import type { AgentConfigSnapshot } from '@agent-ui/app/agent-admin-schema'
import { PROTOCOL_VERSION, type A2aAgentCard, type A2aAgentSkill } from '@agent-ui/a2a'

/** Same slug law as `@agent-ui/app/entry-data`'s `slugify` (lowercase, non-alnum runs collapsed to one
 * `-`, trimmed) — reproduced locally rather than imported: this module's only real dependency on
 * `@agent-ui/app` is the type-only `AgentConfigSnapshot` import above, and importing an unrelated
 * control's module for one eight-line helper would be a heavier runtime coupling than writing it once
 * here. Never returns an empty string (an empty slug reads as `"entry"`), so a generated `id` is
 * always non-empty per the a2a validator's `A2aAgentSkill.id` requirement. */
function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'entry'
}

function toSkill(label: string, kind: 'skill' | 'workflow'): A2aAgentSkill {
  return {
    id: `${kind}-${slugify(label)}`,
    name: label,
    description: `${kind === 'skill' ? 'Skill' : 'Workflow'} enabled on this agent: ${label}.`,
    tags: [kind],
  }
}

/**
 * Map one team member's turn-time `AgentConfigSnapshot` to an `@agent-ui/a2a` `A2aAgentCard` — the
 * declared team's "direct configuration" A2A discovery mode (req-agent-teams.md F1). Pure: no store
 * read, no network call, every field derives from `snapshot` alone. The returned card passes
 * `@agent-ui/a2a`'s own `validateA2a(card, { protocolVersion: PROTOCOL_VERSION, expect: 'card' })`
 * (R3's acceptance) for any structurally valid `AgentConfigSnapshot`.
 */
export function teamMemberToAgentCard(snapshot: AgentConfigSnapshot): A2aAgentCard {
  const skills: A2aAgentSkill[] = [
    ...snapshot.skills.map((label) => toSkill(label, 'skill')),
    ...snapshot.workflows.map((label) => toSkill(label, 'workflow')),
  ]
  return {
    protocolVersion: PROTOCOL_VERSION,
    name: snapshot.name,
    description: snapshot.systemPrompt,
    url: `agent-ui://agent-admin/${slugify(snapshot.name)}`,
    version: '0.0.0',
    capabilities: {},
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills,
  }
}
