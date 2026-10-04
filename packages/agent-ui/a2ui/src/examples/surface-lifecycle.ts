// surface-lifecycle.ts: the surface-lifecycle exemplars (GH #1731). The shard had one `deleteSurface`
// (kpi-panel-lifecycle) and no record that walks a surface past its first task. These three seeds each
// keep ONE surfaceId live at a time (ADR-0064 single-surface v1, and its 2026-10-03 amendment: the
// validator frees the id graph at `deleteSurface`, so a later `createSurface` on the same id opens a
// fresh epoch) and teach the two ways one surface moves on:
//
// - DELETE-THEN-RECREATE (support-ticket-close-then-new, invite-decline-then-focus-block): the first
//   task is finished, so the surface is closed with `deleteSurface` and the same surfaceId is created
//   again for an unrelated second task. The new epoch delivers its own `root` and seeds its own data
//   model; nothing from the closed epoch is bound or resent (the renderer disposed that store, and
//   admission resolves epoch 2's pointers against epoch 2's writes only, the GH #1765 erratum). Nothing
//   addresses the surface between the delete and the re-create (`sid:update-after-delete`).
// - SUPERSEDING (contact-import-progress-to-summary): the task keeps going, so the live surface steps
//   to its next scene through `updateComponents` (the a2ui-payload-authoring trap, GH #1164: at most one
//   surface reads live). `root` is delivered once and never resent; the stable `scene` container one
//   level down is what swaps. One-way: the progress scene is retired, not navigable back to (the
//   backable-wizard seed owns the round-trip case).
//
// Every stream ends with live content on its one surface, so none is a net no-op.

import type { ExampleSeed } from './types.ts'

// ── (1) Delete-then-recreate: resolved ticket closed, a new billing ticket opened ─────────────────────

const SUPPORT_ID = 'support-desk'

export const supportTicketCloseThenNewSeed: ExampleSeed = {
  name: 'support-ticket-close-then-new',
  description:
    'Delete-then-recreate on one surface: a resolved support ticket summary (CardHeader title and success Badge, a DescriptionList of the resolution, one "Close ticket" Button in the CardFooter) is closed with deleteSurface once the user confirms, then the same surfaceId is created again for an unrelated task: a FormProvider-gated new billing ticket (Field-wrapped Select category, invoice TextField, required Textarea, submit Button in the CardFooter). The second epoch delivers its own root and seeds its own /draft data; nothing from the closed ticket is resent or bound.',
  promptText:
    'Show me how ticket #4821 was resolved so I can close it, and once it is closed give me a fresh form to report a separate problem with my March invoice.',
  surfaceId: SUPPORT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // Epoch 1: the resolved ticket, read-only apart from the one close action.
    { version: 'v1.0', createSurface: { surfaceId: SUPPORT_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SUPPORT_ID,
        value: {
          ticket: {
            title: 'Ticket #4821: Sync stuck on "Uploading"',
            rows: [
              { label: 'Opened', value: '2 Mar, 09:14' },
              { label: 'Cause', value: 'An expired device token blocked uploads' },
              { label: 'Fix', value: 'Token refreshed, 38 queued files uploaded' },
              { label: 'Resolved by', value: 'Priya (Tier 2)' },
            ],
          },
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SUPPORT_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title', 'state'] },
          { id: 'title', component: 'Text', variant: 'h4', text: { path: '/ticket/title' } },
          { id: 'state', component: 'Badge', label: 'Resolved', intent: 'success' },
          { id: 'ct', component: 'CardContent', children: ['summary'] },
          { id: 'summary', component: 'DescriptionList', rows: { path: '/ticket/rows' } },
          { id: 'ft', component: 'CardFooter', children: ['close'] },
          {
            id: 'close',
            component: 'Button',
            variant: 'solid',
            label: 'Close ticket',
            action: { action: 'close_ticket', context: { ticket: '4821' } },
          },
        ],
      },
    },

    // The user pressed "Close ticket": that task is over, so the surface closes.
    { version: 'v1.0', deleteSurface: { surfaceId: SUPPORT_ID } },

    // Epoch 2: the same surfaceId re-created for the new ticket. A fresh root and a fresh data model.
    { version: 'v1.0', createSurface: { surfaceId: SUPPORT_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: SUPPORT_ID, value: { draft: { category: 'billing', invoice: '', details: '' } } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SUPPORT_ID,
        components: [
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'New ticket' },
          { id: 'ct', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'Column', gap: 'md', children: ['f_category', 'f_invoice', 'f_details'] },
          { id: 'f_category', component: 'Field', label: 'Category', child: 'category' },
          {
            id: 'category',
            component: 'Select',
            name: 'category',
            required: true,
            value: { path: '/draft/category' },
            children: ['opt_billing', 'opt_account', 'opt_technical'],
          },
          { id: 'opt_billing', component: 'Option', value: 'billing', label: 'Billing' },
          { id: 'opt_account', component: 'Option', value: 'account', label: 'Account access' },
          { id: 'opt_technical', component: 'Option', value: 'technical', label: 'Technical problem' },
          { id: 'f_invoice', component: 'Field', label: 'Invoice number', description: 'Printed at the top of the invoice', child: 'invoice' },
          { id: 'invoice', component: 'TextField', name: 'invoice', placeholder: 'INV-2026-0312', value: { path: '/draft/invoice' } },
          { id: 'f_details', component: 'Field', label: 'What went wrong', child: 'details' },
          {
            id: 'details',
            component: 'Textarea',
            name: 'details',
            required: true,
            rows: 4,
            placeholder: 'For example: I was charged twice on 1 March.',
            value: { path: '/draft/details' },
            checks: [{ call: 'required', args: { value: { path: '/draft/details' } }, message: 'Describe the problem' }],
          },
          { id: 'ft', component: 'CardFooter', children: ['submit'] },
          { id: 'submit', component: 'Button', variant: 'solid', label: 'Open ticket', action: { action: 'open_ticket', submit: true } },
        ],
      },
    },
  ],
}

// ── (2) Superseding: an import's progress scene steps to its summary on the live surface ──────────────

const IMPORT_ID = 'contact-import'

export const contactImportProgressToSummarySeed: ExampleSeed = {
  name: 'contact-import-progress-to-summary',
  description:
    'Superseding on the live surface: a contacts CSV import shows a progress scene (Progress bound to /import/processed of /import/total, a bound status Text) that advances through updateDataModel, then steps one way to its summary scene through updateComponents. root is delivered once and never resent. The stable "scene" Column is resent with new children (a Grid of three Stat tiles for added, merged and skipped rows, a Disclosure whose summary interpolates /result/skipped and lists the skipped rows), the title Text is resent with its finished wording, and "card" is resent once to gain a new CardFooter whose Row carries "Download skipped rows" and "Open contacts" Buttons. No surface is deleted or re-created.',
  promptText:
    'Import contacts.csv into my address book, keep me posted while it runs, and when it is done tell me how many were added, merged with existing contacts, or skipped and why.',
  surfaceId: IMPORT_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // Scene 1: progress. root is the stable wrapper; "scene" is the container that swaps later.
    { version: 'v1.0', createSurface: { surfaceId: IMPORT_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: IMPORT_ID, value: { import: { processed: 0, total: 1240, status: 'Reading contacts.csv' } } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: IMPORT_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Importing contacts.csv' },
          { id: 'ct', component: 'CardContent', children: ['scene'] },
          { id: 'scene', component: 'Column', gap: 'sm', children: ['bar', 'status'] },
          { id: 'bar', component: 'Progress', label: 'Rows processed', value: { path: '/import/processed' }, max: { path: '/import/total' } },
          { id: 'status', component: 'Text', variant: 'caption', text: { path: '/import/status' } },
        ],
      },
    },

    // Progress advances as data only: no component is resent while the scene is unchanged.
    { version: 'v1.0', updateDataModel: { surfaceId: IMPORT_ID, path: '/import/processed', value: 610 } },
    { version: 'v1.0', updateDataModel: { surfaceId: IMPORT_ID, path: '/import/status', value: 'Matching against existing contacts' } },
    { version: 'v1.0', updateDataModel: { surfaceId: IMPORT_ID, path: '/import/processed', value: 1240 } },

    // Scene 2: the summary supersedes the progress scene. The results land first, then "scene" is resent
    // with its new children; "card" is resent once to gain its new CardFooter, and "title" takes its finished
    // wording. root is untouched.
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: IMPORT_ID,
        path: '/result',
        value: {
          added: 1187,
          merged: 50,
          skipped: 3,
          skippedRows: [
            { label: 'Row 112', value: 'No name or email' },
            { label: 'Row 640', value: 'Email "jo@" is not valid' },
            { label: 'Row 1033', value: 'Duplicate of row 1032' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: IMPORT_ID,
        components: [
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'contacts.csv imported' },
          { id: 'scene', component: 'Column', gap: 'md', children: ['tiles', 'skipped'] },
          { id: 'tiles', component: 'Grid', min: '8rem', gap: 'md', children: ['s_added', 's_merged', 's_skipped'] },
          { id: 's_added', component: 'Stat', label: 'Added', value: { path: '/result/added' } },
          { id: 's_merged', component: 'Stat', label: 'Merged', value: { path: '/result/merged' }, caption: 'Matched an existing contact' },
          { id: 's_skipped', component: 'Stat', label: 'Skipped', value: { path: '/result/skipped' } },
          { id: 'skipped', component: 'Disclosure', summary: 'Why ${/result/skipped} rows were skipped', children: ['skipped_rows'] },
          { id: 'skipped_rows', component: 'DescriptionList', rows: { path: '/result/skippedRows' } },
          { id: 'ft', component: 'CardFooter', children: ['ft_actions'] },
          { id: 'ft_actions', component: 'Row', gap: 'md', justify: 'end', children: ['download', 'open'] },
          { id: 'download', component: 'Button', variant: 'ghost', label: 'Download skipped rows', action: { action: 'download_skipped' } },
          { id: 'open', component: 'Button', variant: 'solid', label: 'Open contacts', action: { action: 'open_contacts' } },
        ],
      },
    },
  ],
}

// ── (3) Delete-then-recreate: an answered invite closed, a focus-block planner opened ─────────────────

const CALENDAR_ID = 'calendar-assist'

export const inviteDeclineThenFocusBlockSeed: ExampleSeed = {
  name: 'invite-decline-then-focus-block',
  description:
    'Delete-then-recreate in a calendar assistant: a meeting invite (organizer Avatar and time in the CardContent, "Decline" and "Accept" Buttons in the CardFooter) is closed with deleteSurface once the user declines it, then the same surfaceId is created again for a different task, planning a focus block in the freed hour: a Field-wrapped single-date Calendar, a start-time TextField, a Field-wrapped SegmentedControl for a length that fits the freed hour, a Switch for showing as busy, and a "Block time" submit Button in a CardFooter Row. The new epoch seeds its own /block data and resends nothing from the invite.',
  promptText:
    'Show me the 3pm design review invite from Marco so I can decline it, then help me turn that freed afternoon into a focus block.',
  surfaceId: CALENDAR_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    // Epoch 1: the invite, answered by one of two footer actions.
    { version: 'v1.0', createSurface: { surfaceId: CALENDAR_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CALENDAR_ID,
        value: { invite: { title: 'Design review: onboarding v2', when: 'Thu 9 Apr, 15:00 to 16:00', organizer: 'Marco Bellini' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CALENDAR_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: { path: '/invite/title' } },
          { id: 'ct', component: 'CardContent', children: ['details'] },
          { id: 'details', component: 'Column', gap: 'sm', children: ['organizer', 'when'] },
          { id: 'organizer', component: 'Row', gap: 'sm', align: 'center', children: ['avatar', 'organizer_name'] },
          { id: 'avatar', component: 'Avatar', name: { path: '/invite/organizer' } },
          { id: 'organizer_name', component: 'Text', variant: 'body', text: { path: '/invite/organizer' } },
          { id: 'when', component: 'Text', variant: 'caption', text: { path: '/invite/when' } },
          { id: 'ft', component: 'CardFooter', children: ['ft_actions'] },
          { id: 'ft_actions', component: 'Row', gap: 'md', justify: 'end', children: ['decline', 'accept'] },
          { id: 'decline', component: 'Button', variant: 'ghost', label: 'Decline', action: { action: 'rsvp', context: { response: 'decline' } } },
          { id: 'accept', component: 'Button', variant: 'solid', label: 'Accept', action: { action: 'rsvp', context: { response: 'accept' } } },
        ],
      },
    },

    // The user declined: the invite is answered, so its surface closes.
    { version: 'v1.0', deleteSurface: { surfaceId: CALENDAR_ID } },

    // Epoch 2: the same surfaceId re-created for the focus-block task, with its own root and data.
    { version: 'v1.0', createSurface: { surfaceId: CALENDAR_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: { surfaceId: CALENDAR_ID, value: { block: { date: '2026-04-09', start: '15:00', minutes: '60', busy: true } } },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CALENDAR_ID,
        components: [
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Plan a focus block' },
          { id: 'ct', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'Column', gap: 'md', children: ['f_day', 'f_start', 'f_length', 'busy'] },
          { id: 'f_day', component: 'Field', label: 'Day', child: 'day' },
          { id: 'day', component: 'Calendar', mode: 'single', name: 'date', required: true, value: { path: '/block/date' } },
          { id: 'f_start', component: 'Field', label: 'Start time', description: 'The declined review freed 15:00 to 16:00', child: 'start' },
          { id: 'start', component: 'TextField', name: 'start', type: 'time', required: true, value: { path: '/block/start' } },
          { id: 'f_length', component: 'Field', label: 'Length', child: 'length' },
          { id: 'length', component: 'SegmentedControl', name: 'minutes', value: { path: '/block/minutes' }, children: ['len_30', 'len_45', 'len_60'] },
          { id: 'len_30', component: 'Segment', value: '30', label: '30 min' },
          { id: 'len_45', component: 'Segment', value: '45', label: '45 min' },
          { id: 'len_60', component: 'Segment', value: '60', label: '1 hour' },
          { id: 'busy', component: 'Switch', name: 'busy', label: 'Show me as busy', checked: { path: '/block/busy' } },
          { id: 'ft', component: 'CardFooter', children: ['ft_actions'] },
          { id: 'ft_actions', component: 'Row', gap: 'md', justify: 'end', children: ['block'] },
          { id: 'block', component: 'Button', variant: 'solid', label: 'Block time', action: { action: 'create_focus_block', submit: true } },
        ],
      },
    },
  ],
}

/** Every seed this module defines (index.ts derives `allSeeds` from family arrays, never a literal). */
export const surfaceLifecycleSeeds: readonly ExampleSeed[] = [
  supportTicketCloseThenNewSeed,
  contactImportProgressToSummarySeed,
  inviteDeclineThenFocusBlockSeed,
]
