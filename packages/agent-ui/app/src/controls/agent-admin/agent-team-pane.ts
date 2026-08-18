// agent-team-pane.ts — GH #1197 (ADR-0203 clause 1 / req-agent-teams.md R5): the Team pane's read/write
// surface — list teams, create/edit/delete, validation-closed against a live known-agent roster
// (`validateAgentTeam`, `agent-team.ts`). Bespoke rather than an `entry-list.ts` (`mountEntryList`)
// instantiation: `AgentTeam` is not an `Entry` (ADR-0132 cl.1's generic shape is label+description+content,
// uniform across kinds) — it is a GM pick plus a nested member roster, each member carrying its OWN
// role/routingDescription. Bending the generic primitive's content-field/library-menu machinery around a
// shape it was never designed for would cost more than it saves; the CRUD LAW it still keeps is the same
// one every other agent-admin pane already follows: fail-closed add (`saveAgentTeam` never persists an
// invalid record — `validateAgentTeam`'s own issues surface inline, the form stays open with every typed
// field intact, the `entry-list.ts` `submitAdd` MAJOR-fix precedent), one build-once shell, a wholesale
// list re-render per change (cheap: a handful of teams, never a per-keystroke rebuild).
//
// R5's dangling-reference law, read precisely off `agent-team.ts`'s own header: `loadAgentTeams` never
// re-validates a persisted team against a live roster (that is deliberately this module's job, not the
// storage layer's) — a member or GM `agentId` absent from `getKnownAgents()` at RENDER time is flagged
// VISIBLY on its row (`data-dangling="true"` + inline "(missing agent)" text), never silently dropped —
// the acceptance's exact wording ("deleting a member agent flags, not silently drops, the dangling
// reference").
//
// Persistence lives HERE, not in the caller: this pane calls `agent-team.ts`'s pure module functions
// directly rather than routing every read/write through `agent-admin.ts` (there is no store-subscription
// seam to share — teams persist on their OWN `StorageAdapter` namespace, `agent-team.ts`'s own header). The
// one thing the caller DOES own is `onTeamsChanged`: agent-admin.ts caches the fresh team list itself (its
// own `#teams` field) so the LIVE turn's system-prompt compose path (a synchronous read,
// `composeLiveSystemPrompt`) never has to await this pane's own async storage round-trip.

import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import type { UIFieldElement } from '@agent-ui/components/controls/field'
import type { UISelectElement } from '@agent-ui/components/controls/select'
import {
  deleteAgentTeam,
  loadAgentTeams,
  saveAgentTeam,
  type AgentTeam,
  type AgentTeamMember,
  type AgentTeamValidationIssue,
} from './agent-team.ts'

/** One roster row this pane picks a GM/member from — the same two fields `AgentRosterEntry`
 *  (agent-admin.ts) already carries, narrowed to what this pane actually reads so it depends on no other
 *  module's type (the `deletable` field, e.g., is none of this pane's business). */
export interface KnownAgent {
  id: string
  label: string
}

export interface AgentTeamPaneOptions {
  /** Read the live known-agent roster — called at every render/form-open, never captured once (the
   *  `#pendingRoster` "AT INVOKE TIME" law agent-admin.ts's own consumers already follow), so a roster
   *  change (an agent renamed, minted, or deleted) is reflected the next time this pane draws. */
  getKnownAgents(): readonly KnownAgent[]
  /** Fired after every successful save/delete, with the fresh full team list — the host's one chance to
   *  refresh whatever cache backs its OWN synchronous compose-time read (agent-admin.ts's `#teams` field,
   *  feeding `composeLiveSystemPrompt`'s optional team argument). Omit for a caller with no such cache
   *  (e.g. a standalone test harness that only cares about this pane's own CRUD). */
  onTeamsChanged?(teams: readonly AgentTeam[]): void
}

export interface AgentTeamPane {
  /** The pane's own host element — append this wherever the caller wants the Team pane to render. */
  host: HTMLElement
  /** Load every persisted team and re-render — call once at mount; safe to call again if the caller
   *  knows the known-agent roster changed underneath it (so dangling-reference flags refresh). */
  refresh(): Promise<void>
}

let idSeq = 0
/** A fresh team id — `Date.now()` plus a per-page sequence counter so two teams minted in the same
 *  millisecond (a fast double-click, or two tests in the same tick) never collide. */
function mintTeamId(): string {
  idSeq += 1
  return `team-${Date.now().toString(36)}-${idSeq}`
}

function fieldCell(label: string, control: HTMLElement, description?: string): UIFieldElement {
  const field = document.createElement('ui-field') as UIFieldElement
  field.label = label
  if (description !== undefined) field.description = description
  field.append(control)
  return field
}

function textField(part: string, value = ''): UITextFieldElement {
  const el = document.createElement('ui-text-field') as UITextFieldElement
  el.setAttribute('data-part', part)
  el.value = value
  return el
}

/** One `ui-select` populated from `agents` — the SAME `[role="option"][value]` shape the header's own
 *  agent-select already builds (agent-admin.ts's `#applyAgentRoster`), reproduced here rather than
 *  imported: that method is private to `UIAgentAdminElement` and this pane has no access to it. */
function agentSelect(part: string, agents: readonly KnownAgent[], value?: string): UISelectElement {
  const select = document.createElement('ui-select') as UISelectElement
  select.setAttribute('data-part', part)
  select.setAttribute('placeholder', 'Select agent')
  for (const agent of agents) {
    const option = document.createElement('div')
    option.setAttribute('role', 'option')
    option.setAttribute('value', agent.id)
    option.textContent = agent.label
    select.append(option)
  }
  if (value !== undefined) select.value = value
  return select
}

function button(part: string, text: string, variant?: string): UIButtonElement {
  const el = document.createElement('ui-button') as UIButtonElement
  el.setAttribute('data-part', part)
  if (variant !== undefined) el.setAttribute('variant', variant)
  el.textContent = text
  return el
}

/** One in-progress member row's live field handles — read back at submit time. */
interface MemberRowHandle {
  root: HTMLElement
  agentSelect: UISelectElement
  roleField: UITextFieldElement
  routingField: UITextFieldElement
}

export function buildAgentTeamPane(options: AgentTeamPaneOptions): AgentTeamPane {
  const host = document.createElement('div')
  host.setAttribute('data-part', 'team-pane')

  const list = document.createElement('div')
  list.setAttribute('data-part', 'team-list')
  host.append(list)

  const addToggle = button('team-add-toggle', 'Add team', 'soft')
  host.append(addToggle)

  let currentTeams: readonly AgentTeam[] = []
  let editingId: string | undefined // undefined ⇒ the open form is minting a NEW team, not editing one

  // ── the form (one shell, reused for both add and edit — never two hand-rolled forms, the
  //    `entry-form.ts` precedent this pane's own header cites) ──────────────────────────────────────────
  const form = document.createElement('div')
  form.setAttribute('data-part', 'team-form')
  form.hidden = true

  const labelField = textField('team-form-label')
  const taglineField = textField('team-form-tagline')
  const gmSelect = agentSelect('team-form-gm', [])
  const membersHost = document.createElement('div')
  membersHost.setAttribute('data-part', 'team-form-members')
  const addMemberBtn = button('team-form-add-member', 'Add member', 'soft')
  const saveBtn = button('team-form-save', 'Save')
  const cancelBtn = button('team-form-cancel', 'Cancel', 'soft')
  const errorNote = document.createElement('ul')
  errorNote.setAttribute('data-part', 'team-form-error')
  errorNote.hidden = true

  let memberRows: MemberRowHandle[] = []

  function buildMemberRow(agents: readonly KnownAgent[], member?: AgentTeamMember): MemberRowHandle {
    const root = document.createElement('div')
    root.setAttribute('data-part', 'team-form-member-row')
    const select = agentSelect('team-form-member-agent', agents, member?.agentId)
    const roleField = textField('team-form-member-role', member?.role ?? '')
    const routingField = textField('team-form-member-routing', member?.routingDescription ?? '')
    const removeBtn = button('team-form-member-remove', 'Remove', 'soft')
    removeBtn.addEventListener('click', () => {
      memberRows = memberRows.filter((row) => row.root !== root)
      root.remove()
    })
    root.append(
      fieldCell('Agent', select),
      fieldCell('Role', roleField),
      fieldCell('Routing description', routingField, 'When the GM should hand off to this member'),
      removeBtn,
    )
    return { root, agentSelect: select, roleField, routingField }
  }

  function resetMemberRows(agents: readonly KnownAgent[], members: readonly AgentTeamMember[]): void {
    for (const row of memberRows) row.root.remove()
    memberRows = members.map((member) => buildMemberRow(agents, member))
    for (const row of memberRows) membersHost.append(row.root)
  }

  addMemberBtn.addEventListener('click', () => {
    const row = buildMemberRow(options.getKnownAgents())
    memberRows.push(row)
    membersHost.append(row.root)
  })

  function showFormErrors(issues: readonly AgentTeamValidationIssue[]): void {
    errorNote.replaceChildren()
    for (const issue of issues) {
      const li = document.createElement('li')
      li.setAttribute('data-part', 'team-form-error-item')
      li.textContent = `${issue.path}: ${issue.message}`
      errorNote.append(li)
    }
    errorNote.hidden = issues.length === 0
  }

  function openForm(team?: AgentTeam): void {
    editingId = team?.id
    const agents = options.getKnownAgents()
    labelField.value = team?.label ?? ''
    taglineField.value = team?.tagline ?? ''
    gmSelect.replaceChildren()
    for (const agent of agents) {
      const option = document.createElement('div')
      option.setAttribute('role', 'option')
      option.setAttribute('value', agent.id)
      option.textContent = agent.label
      gmSelect.append(option)
    }
    gmSelect.value = team?.gmAgentId ?? ''
    resetMemberRows(agents, team?.members ?? [])
    showFormErrors([])
    form.hidden = false
  }

  function closeForm(): void {
    form.hidden = true
    editingId = undefined
  }

  function renderList(): void {
    list.replaceChildren()
    const agents = options.getKnownAgents()
    const knownIds = new Set(agents.map((agent) => agent.id))
    const nameFor = (id: string): string => agents.find((agent) => agent.id === id)?.label ?? id

    for (const team of currentTeams) {
      const card = document.createElement('div')
      card.setAttribute('data-part', 'team-card')
      card.setAttribute('data-team-id', team.id)

      const header = document.createElement('div')
      header.setAttribute('data-part', 'team-card-header')
      const title = document.createElement('span')
      title.setAttribute('data-part', 'team-card-title')
      title.textContent = team.label
      header.append(title)
      if (team.tagline !== undefined && team.tagline.length > 0) {
        const tagline = document.createElement('span')
        tagline.setAttribute('data-part', 'team-card-tagline')
        tagline.textContent = team.tagline
        header.append(tagline)
      }
      const gmLine = document.createElement('span')
      gmLine.setAttribute('data-part', 'team-card-gm')
      const gmDangling = !knownIds.has(team.gmAgentId)
      gmLine.textContent = gmDangling ? `GM: ${team.gmAgentId} (missing agent)` : `GM: ${nameFor(team.gmAgentId)}`
      if (gmDangling) gmLine.setAttribute('data-dangling', 'true')
      header.append(gmLine)

      const editBtn = button('team-card-edit', 'Edit', 'soft')
      editBtn.addEventListener('click', () => openForm(team))
      const deleteBtn = button('team-card-delete', 'Delete', 'soft')
      deleteBtn.addEventListener('click', () => {
        void (async () => {
          await deleteAgentTeam(team.id)
          currentTeams = await loadAgentTeams()
          options.onTeamsChanged?.(currentTeams)
          renderList()
        })()
      })
      header.append(editBtn, deleteBtn)
      card.append(header)

      const membersList = document.createElement('div')
      membersList.setAttribute('data-part', 'team-card-members')
      for (const member of team.members) {
        const row = document.createElement('div')
        row.setAttribute('data-part', 'team-card-member-row')
        const dangling = !knownIds.has(member.agentId)
        row.textContent = dangling
          ? `${member.role}: ${member.agentId} (missing agent) — ${member.routingDescription}`
          : `${member.role}: ${nameFor(member.agentId)} — ${member.routingDescription}`
        if (dangling) row.setAttribute('data-dangling', 'true')
        membersList.append(row)
      }
      card.append(membersList)
      list.append(card)
    }
  }

  addToggle.addEventListener('click', () => {
    // A visible add-form already open in ADD mode (never Edit — Edit's own Cancel is the form's own
    // Cancel button, not this toggle) collapses back on a second click, the `entry-list.ts` add-toggle
    // precedent; otherwise open fresh in ADD mode.
    if (!form.hidden && editingId === undefined) {
      closeForm()
      return
    }
    openForm()
  })
  cancelBtn.addEventListener('click', () => closeForm())

  saveBtn.addEventListener('click', () => {
    void (async () => {
      const knownAgents = options.getKnownAgents()
      const team: AgentTeam = {
        id: editingId ?? mintTeamId(),
        label: labelField.value,
        tagline: taglineField.value.trim().length > 0 ? taglineField.value : undefined,
        gmAgentId: gmSelect.value,
        members: memberRows.map((row) => ({
          agentId: row.agentSelect.value,
          role: row.roleField.value,
          routingDescription: row.routingField.value,
        })),
      }
      // VALIDATION CLOSED (`agent-team.ts`'s own law): `saveAgentTeam` never persists an invalid team —
      // a rejection surfaces every issue inline and leaves the form open with every typed field intact,
      // the SAME "reject visibly, never silently discard" law `entry-list.ts`'s `submitAdd` already holds.
      const result = await saveAgentTeam(team, knownAgents.map((agent) => agent.id))
      if (!result.valid) {
        showFormErrors(result.issues)
        return
      }
      currentTeams = await loadAgentTeams()
      options.onTeamsChanged?.(currentTeams)
      closeForm()
      renderList()
    })()
  })

  form.append(
    fieldCell('Team name', labelField),
    fieldCell('Tagline', taglineField, 'Optional'),
    fieldCell('GM (general manager)', gmSelect),
    membersHost,
    addMemberBtn,
    saveBtn,
    cancelBtn,
    errorNote,
  )
  host.append(form)

  return {
    host,
    async refresh(): Promise<void> {
      currentTeams = await loadAgentTeams()
      options.onTeamsChanged?.(currentTeams)
      renderList()
    },
  }
}
