// repair-seeds.ts: the first five `repair` corpus seeds (ADR-0231 cl.3, GH #1742). Each seed is one
// correction a producer can learn from: `invalidMessages` is a breakage a producer actually emits,
// `validatorErrors` is the shared validator's finalize-mode verdict on it (authored from a real
// `validateA2ui` run; admission recomputes it and rejects a mismatch), and `messages` fixes exactly what
// those errors name and nothing else.
//
// The five breakages, one reachable code each (corpus LLD §8; PARSE, VERSION_UNSUPPORTED,
// CATALOG_UNKNOWN and FUNCTION are not authorable, and DEPTH_EXCEEDED needs a pathological tree):
// 1. IDGRAPH: a footer Row names a Button the stream never delivers (a truncated emission).
// 2. CATALOG: a Button carries `text`, the HTML habit, where the catalog's prop is `label`.
// 3. CONTAINMENT: a CardFooter nested inside the CardContent column instead of as the Card's own child.
// 4. POINTER: an `updateDataModel.path` written without its leading slash.
// 5. SCHEMA: `updateComponents.components` sent as an id-keyed map instead of an array (the surface then
//    also has no root, so the recomputed set carries IDGRAPH `agenda:root-missing` alongside).
//
// Every seed has its own surface and its own `promptText`: repair identity is the corrected tree plus the
// error set, and a shared prompt over similar trees lands above the near-dup cutoff (ADR-0231 notes).
//
// Corpus seeds only (never `allSeeds`, never a site page): imported by `tools/corpus/import-seeds.ts`
// into `corpus/repair/v1_0/agent-ui.jsonl`.

import type { A2uiComponent, A2uiServerMessage } from '../protocol.ts'
import type { RepairSeed } from './types.ts'

const v = 'v1.0' as const

// ── 1. IDGRAPH: the dangling footer child ────────────────────────────────────────────────────────────
// Same intent as the admitted `frontier-invite-modal` exemplar on purpose: a plain Card + Select surface
// rather than its Modal + MultiSelect composition, so the record teaches the repair, not a new layout.

const INVITE_ID = 'invite'

const inviteHead: A2uiServerMessage[] = [
  { version: v, createSurface: { surfaceId: INVITE_ID, catalogId: 'agent-ui', sendDataModel: true } },
  { version: v, updateDataModel: { surfaceId: INVITE_ID, value: { invite: { email: '', role: 'editor' } } } },
]

const inviteComponents = [
  { id: 'root', component: 'Card', children: ['inv_header', 'inv_content', 'inv_footer'] },
  { id: 'inv_header', component: 'CardHeader', children: ['inv_title'] },
  { id: 'inv_title', component: 'Text', variant: 'h4', text: 'Invite a teammate' },
  { id: 'inv_content', component: 'CardContent', children: ['inv_fields'] },
  { id: 'inv_fields', component: 'Column', gap: 'md', children: ['f_email', 'f_role'] },
  { id: 'f_email', component: 'Field', label: 'Work email', child: 'in_email' },
  { id: 'in_email', component: 'TextField', name: 'email', type: 'email', required: true, value: { path: '/invite/email' } },
  { id: 'f_role', component: 'Field', label: 'Role', child: 'in_role' },
  { id: 'in_role', component: 'Select', name: 'role', value: { path: '/invite/role' }, children: ['role_viewer', 'role_editor', 'role_admin'] },
  { id: 'role_viewer', component: 'Option', value: 'viewer', label: 'Viewer' },
  { id: 'role_editor', component: 'Option', value: 'editor', label: 'Editor' },
  { id: 'role_admin', component: 'Option', value: 'admin', label: 'Admin' },
  { id: 'inv_footer', component: 'CardFooter', children: ['inv_actions'] },
  { id: 'inv_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_cancel', 'btn_send'] },
  { id: 'btn_cancel', component: 'Button', variant: 'ghost', label: 'Cancel', action: { action: 'cancel_invite' } },
]

export const inviteDanglingChildSeed: RepairSeed = {
  name: 'rp-invite-dangling-button',
  description:
    'Repair a truncated invite card: the footer action Row lists btn_send but the stream never delivers ' +
    'it, so the id graph dangles (IDGRAPH inv_actions->btn_send). The fix adds the one missing component, ' +
    'a solid Send invite Button, and changes nothing else.',
  promptText: 'Give me a small card to invite a teammate by work email and pick their role, with Cancel and Send invite buttons.',
  surfaceId: INVITE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  invalidMessages: [...inviteHead, { version: v, updateComponents: { surfaceId: INVITE_ID, components: inviteComponents } }],
  validatorErrors: [{ code: 'IDGRAPH', path: 'inv_actions->btn_send' }],
  messages: [
    ...inviteHead,
    {
      version: v,
      updateComponents: {
        surfaceId: INVITE_ID,
        components: [
          ...inviteComponents,
          { id: 'btn_send', component: 'Button', variant: 'solid', label: 'Send invite', action: { action: 'send_invite' } },
        ],
      },
    },
  ],
}

// ── 2. CATALOG: `text` where the Button's prop is `label` ──────────────────────────────────────────────

const CHECKOUT_ID = 'checkout'

const checkoutHead: A2uiServerMessage[] = [
  { version: v, createSurface: { surfaceId: CHECKOUT_ID, catalogId: 'agent-ui' } },
  {
    version: v,
    updateDataModel: {
      surfaceId: CHECKOUT_ID,
      value: {
        summary: [
          { label: 'Subtotal', value: '€84.00' },
          { label: 'Shipping', value: '€4.95' },
          { label: 'Total', value: '€88.95' },
        ],
      },
    },
  },
]

const checkoutComponents = (continueButton: A2uiComponent): A2uiComponent[] => [
  { id: 'root', component: 'Column', gap: 'md', children: ['co_title', 'co_summary', 'co_actions'] },
  { id: 'co_title', component: 'Text', variant: 'h4', text: 'Order summary' },
  { id: 'co_summary', component: 'DescriptionList', rows: { path: '/summary' } },
  { id: 'co_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_back', 'btn_continue'] },
  { id: 'btn_back', component: 'Button', variant: 'ghost', label: 'Back to cart', action: { action: 'back_to_cart' } },
  continueButton,
]

export const checkoutButtonPropSeed: RepairSeed = {
  name: 'rp-checkout-button-text-prop',
  description:
    'Repair an order summary step whose primary Button names its caption with text, the HTML habit; the ' +
    'catalog Button has no text prop (CATALOG btn_continue.text). The fix renames that one prop to label ' +
    'and keeps the copy, variant and action as they were.',
  promptText: 'Show my order summary with subtotal, shipping and total, and buttons to go back to the cart or continue to payment.',
  surfaceId: CHECKOUT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  invalidMessages: [
    ...checkoutHead,
    {
      version: v,
      updateComponents: {
        surfaceId: CHECKOUT_ID,
        components: checkoutComponents({
          id: 'btn_continue', component: 'Button', variant: 'solid', text: 'Continue to payment', action: { action: 'continue_to_payment' },
        }),
      },
    },
  ],
  validatorErrors: [{ code: 'CATALOG', path: 'btn_continue.text' }],
  messages: [
    ...checkoutHead,
    {
      version: v,
      updateComponents: {
        surfaceId: CHECKOUT_ID,
        components: checkoutComponents({
          id: 'btn_continue', component: 'Button', variant: 'solid', label: 'Continue to payment', action: { action: 'continue_to_payment' },
        }),
      },
    },
  ],
}

// ── 3. CONTAINMENT: the CardFooter nested inside the content column ───────────────────────────────────

const PLAN_ID = 'plan'

const planHead: A2uiServerMessage[] = [{ version: v, createSurface: { surfaceId: PLAN_ID, catalogId: 'agent-ui' } }]

const planLeaves = [
  { id: 'pl_header', component: 'CardHeader', children: ['pl_title'] },
  { id: 'pl_title', component: 'Text', variant: 'h4', text: 'Team plan' },
  { id: 'pl_content', component: 'CardContent', children: ['pl_body'] },
  { id: 'pl_price', component: 'Stat', label: 'Price', value: '€12 per seat / month' },
  { id: 'pl_points', component: 'List', gap: 'xs', children: ['pt_seats', 'pt_storage', 'pt_support'] },
  { id: 'pt_seats', component: 'Text', text: 'Up to 25 seats' },
  { id: 'pt_storage', component: 'Text', text: '100 GB shared storage' },
  { id: 'pt_support', component: 'Text', text: 'Priority email support' },
  { id: 'pl_footer', component: 'CardFooter', children: ['pl_actions'] },
  { id: 'pl_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_compare', 'btn_upgrade'] },
  { id: 'btn_compare', component: 'Button', variant: 'ghost', label: 'Compare plans', action: { action: 'compare_plans' } },
  { id: 'btn_upgrade', component: 'Button', variant: 'solid', label: 'Upgrade to Team', action: { action: 'upgrade_plan', context: { plan: 'team' } } },
]

export const planCardContainmentSeed: RepairSeed = {
  name: 'rp-plan-card-footer-containment',
  description:
    'Repair a pricing plan Card whose CardFooter was nested as the last child of the CardContent column ' +
    'instead of as a direct child of the Card (CONTAINMENT pl_footer). The fix moves that one reference ' +
    'from the column to the Card; every node, prop and line of copy is unchanged.',
  promptText: 'Show the Team plan as a card: the price per seat, what it includes, and buttons to compare plans or upgrade.',
  surfaceId: PLAN_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  invalidMessages: [
    ...planHead,
    {
      version: v,
      updateComponents: {
        surfaceId: PLAN_ID,
        components: [
          { id: 'root', component: 'Card', children: ['pl_header', 'pl_content'] },
          { id: 'pl_body', component: 'Column', gap: 'md', children: ['pl_price', 'pl_points', 'pl_footer'] },
          ...planLeaves,
        ],
      },
    },
  ],
  validatorErrors: [{ code: 'CONTAINMENT', path: 'pl_footer' }],
  messages: [
    ...planHead,
    {
      version: v,
      updateComponents: {
        surfaceId: PLAN_ID,
        components: [
          { id: 'root', component: 'Card', children: ['pl_header', 'pl_content', 'pl_footer'] },
          { id: 'pl_body', component: 'Column', gap: 'md', children: ['pl_price', 'pl_points'] },
          ...planLeaves,
        ],
      },
    },
  ],
}

// ── 4. POINTER: an updateDataModel path with no leading slash ─────────────────────────────────────────

const PREFS_ID = 'prefs'

const prefsComponents: A2uiServerMessage = {
  version: v,
  updateComponents: {
    surfaceId: PREFS_ID,
    components: [
      { id: 'root', component: 'Column', gap: 'md', children: ['pr_title', 'pr_dark', 'f_density'] },
      { id: 'pr_title', component: 'Text', variant: 'h4', text: 'Display preferences' },
      { id: 'pr_dark', component: 'Switch', name: 'darkMode', label: 'Dark mode', checked: { path: '/preferences/darkMode' } },
      { id: 'f_density', component: 'Field', label: 'Density', child: 'in_density' },
      { id: 'in_density', component: 'Select', name: 'density', value: { path: '/preferences/density' }, children: ['dn_compact', 'dn_comfortable'] },
      { id: 'dn_compact', component: 'Option', value: 'compact', label: 'Compact' },
      { id: 'dn_comfortable', component: 'Option', value: 'comfortable', label: 'Comfortable' },
    ],
  },
}

const prefsWrite = (path: string): A2uiServerMessage => ({
  version: v,
  updateDataModel: { surfaceId: PREFS_ID, path, value: { darkMode: true, density: 'compact' } },
})

export const prefsPointerSeed: RepairSeed = {
  name: 'rp-prefs-pointer-slash',
  description:
    'Repair a display preferences panel whose data write targets preferences with no leading slash; an ' +
    'updateDataModel path must be an absolute JSON Pointer (POINTER [1].updateDataModel.path). The fix ' +
    'writes /preferences; the bound Switch and Select and the written values stay as they were.',
  promptText: 'Let me switch dark mode on and pick a compact or comfortable density; dark mode is on and density is compact right now.',
  surfaceId: PREFS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  invalidMessages: [{ version: v, createSurface: { surfaceId: PREFS_ID, catalogId: 'agent-ui', sendDataModel: true } }, prefsWrite('preferences'), prefsComponents],
  validatorErrors: [{ code: 'POINTER', path: '[1].updateDataModel.path' }],
  messages: [{ version: v, createSurface: { surfaceId: PREFS_ID, catalogId: 'agent-ui', sendDataModel: true } }, prefsWrite('/preferences'), prefsComponents],
}

// ── 5. SCHEMA: `components` sent as an id-keyed map ──────────────────────────────────────────────────

const AGENDA_ID = 'agenda'

const agendaNodes = [
  { id: 'root', component: 'Column', gap: 'sm', children: ['ag_title', 'ag_rows'] },
  { id: 'ag_title', component: 'Text', variant: 'h4', text: 'Thursday agenda' },
  { id: 'ag_rows', component: 'DescriptionList', rows: { path: '/agenda' } },
]

const agendaHead: A2uiServerMessage[] = [
  { version: v, createSurface: { surfaceId: AGENDA_ID, catalogId: 'agent-ui' } },
  {
    version: v,
    updateDataModel: {
      surfaceId: AGENDA_ID,
      value: {
        agenda: [
          { label: '09:30', value: 'Design review, room 4B' },
          { label: '12:00', value: 'Lunch with the platform team' },
          { label: '15:00', value: 'Quarterly planning, main hall' },
        ],
      },
    },
  },
]

export const agendaComponentsMapSeed: RepairSeed = {
  name: 'rp-agenda-components-map',
  description:
    'Repair an agenda view (a Column with an h4 title over a DescriptionList of time slots bound to ' +
    '/agenda) whose updateComponents sends components as an object keyed by component id; ' +
    'the envelope requires an array of component records (SCHEMA [2].updateComponents.components), and ' +
    'with no readable component the surface has no root either (IDGRAPH agenda:root-missing). The fix ' +
    'sends the same three records as an array, each keeping its id, which clears both.',
  promptText: "What's on my agenda for Thursday? Show each time slot with what's happening.",
  surfaceId: AGENDA_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  invalidMessages: [
    ...agendaHead,
    {
      version: v,
      updateComponents: { surfaceId: AGENDA_ID, components: Object.fromEntries(agendaNodes.map((n) => [n.id, n])) as never },
    },
  ],
  validatorErrors: [
    { code: 'SCHEMA', path: '[2].updateComponents.components' },
    { code: 'IDGRAPH', path: 'agenda:root-missing' },
  ],
  messages: [...agendaHead, { version: v, updateComponents: { surfaceId: AGENDA_ID, components: agendaNodes } }],
}

/** Every seed this module defines, the family-array precedent (`index.ts` composes `allRepairSeeds` from
 *  it, never a hand-counted literal). */
export const repairSeeds: readonly RepairSeed[] = [
  inviteDanglingChildSeed,
  checkoutButtonPropSeed,
  planCardContainmentSeed,
  prefsPointerSeed,
  agendaComponentsMapSeed,
]
