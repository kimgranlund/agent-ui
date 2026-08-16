// site/pages/onboarding-checklist.ts — GH #961: the checklist-onboarding COMPOSITION RECIPE (SaaS UX brief
// §2, "Checklist onboarding — the dominant SaaS pattern"). A persistent, dismissible task list with a
// progress meter, each item deep-linking into the real surface, celebrating completion, collapsing to a
// pill once dismissed — realized entirely over EXISTING fleet controls (ui-card + ui-list + ui-checkbox +
// ui-progress + ui-badge + ui-button) bound to a plain signals store (`@agent-ui/components`'s
// signal/computed/effect — the root barrel export, not a new control). No new interactive control: this
// recipe is the mint-last proof for `ui-stepper` (brief §2 "Recommended first slice") — the SAME three
// first-run steps `onboarding.ts` already renders as a linear wizard (Welcome / Workspace name / Choose a
// theme, matched to `.claude/docs/flows/onboarding-first-run.flow.json`) compose just as well as a
// dismissible checklist, with zero new control needed. `ui-timeline`/`ui-disclosure`/`ui-popover` (also
// named in the brief's ingredient list) are NOT reached for here — a flat `ui-list` + per-item `ui-checkbox`
// already carries the whole pattern; pulling in a timeline or popover for a plain checklist would be
// composing beyond what the pattern needs (composition-patterns' mint-vs-compose posture, applied the other
// direction — reach for the LIGHTEST composition that is faithful, not the richest available).
//
// This page is a STATIC recipe specimen, deliberately NOT wired to identity-mock-transport (unlike
// onboarding.ts) — the pattern being taught is the composition shape, not a second authenticated journey;
// "deep-links into the real surface" is illustrated with a status caption rather than a real navigation,
// same illustrative posture onboarding.ts already takes for its step content (ADR-0176 cl.3, deferred-not-
// foreclosed for real product content).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './onboarding-checklist.css'
import { heading } from '../lib/doc-page.ts'
import { signal, computed, effect } from '@agent-ui/components'
import type {
  UIBadgeElement,
  UIButtonElement,
  UICardElement,
  UICheckboxElement,
  UIProgressElement,
} from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'Onboarding checklist',
  intro:
    'A persistent, dismissible setup checklist — card + list + checkbox + progress, bound to a plain signals ' +
    'store. Composes the SAME onboarding-first-run.flow.json journey the stepped Onboarding guide renders as a ' +
    'linear wizard, proving the checklist shape needs no new control (the ui-stepper mint-last decision).',
})

content.append(
  pageLead(
    'Each row deep-links into the real surface that completes it (illustrated here with a status caption, ' +
      'never a real navigation — the same specimen posture as the stepped Onboarding guide). Checking an item ' +
      'off — directly, or by finishing its linked step — advances the progress meter; finishing all three ' +
      'celebrates completion. "Hide checklist" collapses the card to a small pill that reopens it, so the ' +
      'checklist stays reachable without staying in the way (the SaaS-canon "persistent but dismissible" ' +
      'posture — the brief’s §2 pattern description).',
  ),
)

// ── the plain signals store — no new control, just signal/computed/effect on top of a fixed item list ─────

interface ChecklistItem {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly cta: string
}

const ITEMS: readonly ChecklistItem[] = [
  { id: 'welcome', label: 'Say hello', hint: 'Meet your workspace before configuring anything.', cta: 'Start' },
  { id: 'workspace', label: 'Name your workspace', hint: 'Pick a name your team will recognize.', cta: 'Set up' },
  { id: 'theme', label: 'Choose a theme', hint: 'Light, dark, or auto — change it anytime.', cta: 'Choose' },
]

const done = signal<ReadonlySet<string>>(new Set())
const dismissed = signal(false)
const completedCount = computed(() => done.value.size)
const allDone = computed(() => completedCount.value === ITEMS.length)

function toggle(id: string, next: boolean): void {
  const nextSet = new Set(done.value)
  if (next) nextSet.add(id)
  else nextSet.delete(id)
  done.value = nextSet
}

// ── the card (card + list + progress + per-item checkbox) ──────────────────────────────────────────────────

const checklistCard = document.createElement('ui-card') as UICardElement
const progress = document.createElement('ui-progress') as UIProgressElement
progress.setAttribute('max', String(ITEMS.length))
progress.setAttribute('label', 'Onboarding progress')
const progressRow = document.createElement('div')
progressRow.className = 'onboarding-checklist-progress-row'
const countBadge = document.createElement('ui-badge') as UIBadgeElement
countBadge.setAttribute('intent', 'neutral')
progressRow.append(progress, countBadge)

const celebration = document.createElement('p')
celebration.className = 'onboarding-checklist-celebration'
celebration.setAttribute('aria-live', 'polite')

const list = document.createElement('ui-list')
list.setAttribute('gap', 'sm')

const rowRefs: {
  readonly checkbox: UICheckboxElement
  readonly cta: UIButtonElement
  readonly status: HTMLElement
  readonly item: ChecklistItem
}[] = []

for (const item of ITEMS) {
  const row = document.createElement('ui-row')
  row.className = 'onboarding-checklist-row'

  const checkbox = document.createElement('ui-checkbox') as UICheckboxElement
  checkbox.setAttribute('aria-describedby', `${item.id}-hint`)
  checkbox.textContent = item.label

  const textCol = document.createElement('div')
  textCol.className = 'onboarding-checklist-text'
  const hint = document.createElement('p')
  hint.id = `${item.id}-hint`
  hint.className = 'onboarding-checklist-hint'
  hint.textContent = item.hint
  const status = document.createElement('p')
  status.className = 'onboarding-checklist-status'
  status.setAttribute('aria-live', 'polite')
  textCol.append(hint, status)

  const cta = document.createElement('ui-button') as UIButtonElement
  cta.setAttribute('variant', 'ghost')
  cta.setAttribute('size', 'sm')
  cta.textContent = item.cta

  row.append(checkbox, textCol, cta)
  list.append(row)
  rowRefs.push({ checkbox, cta, status, item })

  checkbox.addEventListener('change', () => toggle(item.id, checkbox.checked))
  // The deep-link stand-in (brief §2: "each item deep-links into the real surface") — a real recipe would
  // navigate to the surface that completes this step; here it simulates arriving back having finished it.
  cta.addEventListener('click', () => {
    status.textContent = `Simulated visiting the "${item.label}" surface — marked done.`
    toggle(item.id, true)
  })
}

const dismissButton = document.createElement('ui-button') as UIButtonElement
dismissButton.setAttribute('variant', 'ghost')
dismissButton.setAttribute('size', 'sm')
dismissButton.textContent = 'Hide checklist'
dismissButton.addEventListener('click', () => {
  dismissed.value = true
})

checklistCard.append(
  heading(3, 'Get set up'),
  progressRow,
  celebration,
  list,
  dismissButton,
)

// ── the collapsed pill (dismissed state — reopens the card) ─────────────────────────────────────────────────

const pill = document.createElement('ui-button') as UIButtonElement
pill.setAttribute('variant', 'ghost')
pill.className = 'onboarding-checklist-pill'
pill.addEventListener('click', () => {
  dismissed.value = false
})

content.append(checklistCard, pill)

// ── render — one effect keeps the card, the pill, and every row's own state in sync with the store ─────────

effect(() => {
  const count = completedCount.value
  const finished = allDone.value
  const isDismissed = dismissed.value

  progress.setAttribute('current', String(count))
  countBadge.textContent = `${count} of ${ITEMS.length} done`
  countBadge.setAttribute('intent', finished ? 'success' : 'neutral')
  celebration.textContent = finished ? "You're all set — nice work!" : ''
  celebration.hidden = !finished

  for (const { checkbox, cta, item } of rowRefs) {
    const itemDone = done.value.has(item.id)
    checkbox.checked = itemDone
    cta.toggleAttribute('disabled', itemDone)
    cta.textContent = itemDone ? 'Done' : item.cta
  }

  checklistCard.hidden = isDismissed
  pill.hidden = !isDismissed
  pill.textContent = `Setup checklist — ${count} of ${ITEMS.length} done`
})

const sources = document.createElement('p')
sources.className = 'onboarding-checklist-sources'
sources.textContent =
  'The composed controls: ui-card, ui-list, ui-checkbox, ui-progress, ui-badge, ui-button — no new ' +
  'control. The store: signal/computed/effect from @agent-ui/components (the reactive kernel’s public ' +
  'barrel), a plain in-memory Set of completed item ids. Matched flow: ' +
  'onboarding-first-run.flow.json (welcome / workspace / theme / done).'
content.append(sources)
