// patterns.ts — the five A2UI pattern seeds (ADR-0055 §3, a2ui-form-catalog-examples.decomp §4 fork F5):
// real-world agent UIs an agent actually emits. (1) SETTINGS FORM — Field-wrapped controls + Switch
// toggles under a FormProvider, submit gated by the provider's validity (ADR-0054); (2) CONFIRMATION
// CARD — a destructive action expressed by action NAMES (no danger Button tone exists in the fleet — the
// pattern is carried by wording + variant contrast); (3) WIZARD — staged data entry via a bindable Tabs
// whose `selected` is client state that rides the data model; (4) DASHBOARD TILES — a display-only list
// template over `/metrics` with `${…}` label composition; (5) SCHEDULE PICKER — the Wave-5 date/time
// reach through the catalog (ISO canonical values in the model).

import type { ExampleSeed } from './types.ts'

const SETTINGS_ID = 'pattern-settings'
export const patternSettingsSeed: ExampleSeed = {
  name: 'pattern-settings-form',
  description: 'A workspace settings form — name, three toggles, a plan Select — gated by a FormProvider.',
  promptText: 'Show workspace settings: workspace name, three notification toggles, and a plan picker, with a Save button.',
  surfaceId: SETTINGS_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SETTINGS_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SETTINGS_ID,
        value: { settings: { workspace: 'Acme Inc', plan: 'pro', notify: true, weekly: false, twofa: true } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SETTINGS_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'FormProvider', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_workspace', 'toggles', 'f_plan', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Workspace settings' },
          { id: 'f_workspace', component: 'Field', label: 'Workspace name', child: 'in_workspace' },
          { id: 'in_workspace', component: 'TextField', name: 'workspace', required: true, value: { path: '/settings/workspace' } },
          { id: 'toggles', component: 'Column', gap: 'sm', children: ['sw_notify', 'sw_weekly', 'sw_twofa'] },
          { id: 'sw_notify', component: 'Switch', name: 'notify', label: 'Product announcements', checked: { path: '/settings/notify' } },
          { id: 'sw_weekly', component: 'Switch', name: 'weekly', label: 'Weekly digest email', checked: { path: '/settings/weekly' } },
          { id: 'sw_twofa', component: 'Switch', name: 'twofa', label: 'Require two-factor sign-in', checked: { path: '/settings/twofa' } },
          { id: 'f_plan', component: 'Field', label: 'Plan', child: 'in_plan' },
          {
            id: 'in_plan', component: 'Select', name: 'plan', value: { path: '/settings/plan' },
            children: ['opt_free', 'opt_pro', 'opt_scale'],
          },
          { id: 'opt_free', component: 'Option', value: 'free', label: 'Free' },
          { id: 'opt_pro', component: 'Option', value: 'pro', label: 'Pro' },
          { id: 'opt_scale', component: 'Option', value: 'scale', label: 'Scale' },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_save'] },
          { id: 'btn_save', component: 'Button', variant: 'solid', label: 'Save settings', action: { action: 'save_settings', submit: true } },
        ],
      },
    },
  ],
}

const CONFIRM_ID = 'pattern-confirm'
export const patternConfirmSeed: ExampleSeed = {
  name: 'pattern-confirmation-card',
  description: 'A destructive-action confirmation card — two Buttons whose action NAMES carry the intent.',
  promptText: 'Ask the user to confirm deleting their workspace, with Cancel and Delete buttons.',
  surfaceId: CONFIRM_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CONFIRM_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CONFIRM_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'body', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Delete workspace?' },
          {
            id: 'body', component: 'Text', variant: 'body',
            text: 'This permanently deletes “Reactive Labs” and all 42 projects, boards, and files. This cannot be undone.',
          },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_cancel', 'btn_delete'] },
          { id: 'btn_cancel', component: 'Button', variant: 'soft', label: 'Cancel', action: { action: 'cancel' } },
          { id: 'btn_delete', component: 'Button', variant: 'solid', label: 'Delete workspace', action: { action: 'confirm_delete', wantResponse: true } },
        ],
      },
    },
  ],
}

const WIZARD_ID = 'pattern-wizard'
export const patternWizardSeed: ExampleSeed = {
  name: 'pattern-wizard',
  description: 'A three-step account-setup wizard via a bindable Tabs.selected, gated by a FormProvider.',
  promptText: 'Build a three-step signup wizard: account email, workspace name, then a review step with a team size picker.',
  surfaceId: WIZARD_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: WIZARD_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: WIZARD_ID,
        value: { wizard: { step: '0', email: 'ada@example.com', workspace: 'Reactive Labs', size: '11-50' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: WIZARD_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['form'] },
          { id: 'form', component: 'FormProvider', children: ['tabs'] },
          {
            id: 'tabs', component: 'Tabs', selected: { path: '/wizard/step' },
            children: ['tab0', 'tab1', 'tab2', 'panel0', 'panel1', 'panel2'],
          },
          { id: 'tab0', component: 'Tab', children: ['tl0'] },
          { id: 'tl0', component: 'Text', variant: 'body', text: 'Account' },
          { id: 'tab1', component: 'Tab', children: ['tl1'] },
          { id: 'tl1', component: 'Text', variant: 'body', text: 'Workspace' },
          { id: 'tab2', component: 'Tab', children: ['tl2'] },
          { id: 'tl2', component: 'Text', variant: 'body', text: 'Review' },
          { id: 'panel0', component: 'TabPanel', children: ['f_email'] },
          { id: 'f_email', component: 'Field', label: 'Work email', child: 'in_email' },
          { id: 'in_email', component: 'TextField', name: 'email', type: 'email', value: { path: '/wizard/email' } },
          { id: 'panel1', component: 'TabPanel', children: ['f_ws'] },
          { id: 'f_ws', component: 'Field', label: 'Workspace name', child: 'in_ws' },
          { id: 'in_ws', component: 'TextField', name: 'workspace', required: true, value: { path: '/wizard/workspace' } },
          { id: 'panel2', component: 'TabPanel', children: ['review_col'] },
          { id: 'review_col', component: 'Column', gap: 'md', children: ['f_size', 'actions'] },
          { id: 'f_size', component: 'Field', label: 'Team size', child: 'in_size' },
          {
            id: 'in_size', component: 'Select', name: 'size', value: { path: '/wizard/size' },
            children: ['sz1', 'sz2', 'sz3'],
          },
          { id: 'sz1', component: 'Option', value: '1-10', label: '1–10 people' },
          { id: 'sz2', component: 'Option', value: '11-50', label: '11–50 people' },
          { id: 'sz3', component: 'Option', value: '51+', label: '51+ people' },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_finish'] },
          { id: 'btn_finish', component: 'Button', variant: 'solid', label: 'Create workspace', action: { action: 'create_workspace', submit: true } },
        ],
      },
    },
  ],
}

const DASH_ID = 'pattern-dashboard'
export const patternDashboardSeed: ExampleSeed = {
  name: 'pattern-dashboard-tiles',
  description: 'A display-only dashboard — one metric tile per array element, labels composed with ${…}.',
  promptText: 'Show a dashboard of three metric tiles: revenue, active users, and churn, each with a trend delta.',
  surfaceId: DASH_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: DASH_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: DASH_ID,
        value: {
          metrics: [
            { label: 'Revenue', value: '128.4', unit: 'k€', delta: '+12%' },
            { label: 'Active users', value: '8,204', unit: '', delta: '+3.1%' },
            { label: 'Churn', value: '1.8', unit: '%', delta: '−0.4%' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: DASH_ID,
        components: [
          { id: 'root', component: 'Row', gap: 'md', wrap: true, children: { path: '/metrics', componentId: 'tile' } },
          { id: 'tile', component: 'Card', elevation: '1', children: ['tile_content'] },
          { id: 'tile_content', component: 'CardContent', children: ['tile_col'] },
          { id: 'tile_col', component: 'Column', gap: 'xs', children: ['tile_label', 'tile_value', 'tile_delta'] },
          { id: 'tile_label', component: 'Text', variant: 'caption', text: { path: 'label' } },
          // Two ${…} TEMPLATES over relative item paths — the agent composes each label from data.
          { id: 'tile_value', component: 'Text', variant: 'h3', text: '${value}${unit}' },
          { id: 'tile_delta', component: 'Text', variant: 'caption', text: '${delta} vs last month' },
        ],
      },
    },
  ],
}

const SCHEDULE_ID = 'pattern-schedule'
export const patternScheduleSeed: ExampleSeed = {
  name: 'pattern-schedule-picker',
  description: 'A schedule-a-call card — date/time TextFields + a time-zone Select, ISO-canonical values.',
  promptText: 'Show a "schedule a call" card with a date picker, a time picker, and a time zone selector.',
  surfaceId: SCHEDULE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: SCHEDULE_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SCHEDULE_ID,
        value: { schedule: { date: '2026-07-15', time: '09:30', tz: 'Europe/Helsinki' } },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SCHEDULE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['col'] },
          { id: 'col', component: 'Column', gap: 'md', children: ['title', 'f_date', 'f_time', 'f_tz', 'actions'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Schedule a call' },
          { id: 'f_date', component: 'Field', label: 'Date', child: 'in_date' },
          { id: 'in_date', component: 'TextField', name: 'date', type: 'date', value: { path: '/schedule/date' } },
          { id: 'f_time', component: 'Field', label: 'Time', child: 'in_time' },
          { id: 'in_time', component: 'TextField', name: 'time', type: 'time', value: { path: '/schedule/time' } },
          { id: 'f_tz', component: 'Field', label: 'Time zone', child: 'in_tz' },
          {
            id: 'in_tz', component: 'Select', name: 'tz', value: { path: '/schedule/tz' },
            children: ['tz_hel', 'tz_lon', 'tz_nyc'],
          },
          { id: 'tz_hel', component: 'Option', value: 'Europe/Helsinki', label: 'Helsinki (EET)' },
          { id: 'tz_lon', component: 'Option', value: 'Europe/London', label: 'London (GMT)' },
          { id: 'tz_nyc', component: 'Option', value: 'America/New_York', label: 'New York (EST)' },
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_schedule'] },
          { id: 'btn_schedule', component: 'Button', variant: 'solid', label: 'Schedule', action: { action: 'schedule_call' } },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const patternSeeds: readonly ExampleSeed[] = [
  patternSettingsSeed,
  patternConfirmSeed,
  patternWizardSeed,
  patternDashboardSeed,
  patternScheduleSeed,
]
