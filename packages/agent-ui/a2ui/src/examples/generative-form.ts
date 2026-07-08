// generative-form.ts — the flagship Generative Form seed (ADR-0055 clause 5, fork F1 — the re-slice).
//
// ONE canonical seed serves BOTH the form page (a coordinated, accessibly-labelled, validated form built
// from a single payload) and the streaming page's line-by-line feed — a single owner, no drift seam.
// Re-sliced into a FINE-GRAINED message sequence (9 lines, `createSurface` first) rather than the
// original 3-message shape: root arrives EARLY (line 2 of 9 — the surface paints and grows field by
// field), and each subsequent `updateComponents` adds one Field-and-control unit at a time — exactly what
// makes the stream *feel* progressive (the out-of-order-tolerant `children` refs on `form` resolve as
// each field's components land, SPEC-R4).
//
// `f_plan`/`in_plan`/its three Options land in ONE message (line 7): `ui-select` moves `[role=option]`
// children into its listbox panel only at FIRST connect (ADR-0053's known limitation) — Options added to
// an already-connected Select never reach the panel, so the Select and its Options must arrive together.
//
// Every property is a declared default-catalog row (Field/FormProvider/Checkbox/Switch/Select/Option +
// the TextField `type`/`currency`/`step`/`min` reach) — a payload only a coordinated form catalog can
// render. The submit Button's action carries `submit:true` (ADR-0054) — the FormProvider gate.

import type { ExampleSeed } from './types.ts'

const SURFACE_ID = 'form'

export const generativeFormSeed: ExampleSeed = {
  name: 'generative-form',
  description: 'A coordinated, validated form — name/email/budget/plan + two toggles — under one FormProvider gate.',
  promptText:
    'Build a signup form: full name, email, a monthly budget in euros, a plan picker, an email-updates toggle, ' +
    'and a required terms checkbox. Block submit until it is valid.',
  surfaceId: SURFACE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    {
      version: 'v1.0',
      // sendDataModel:true ⇒ a triggered action carries the live data model (SPEC-R8 AC2) — the typed aggregate.
      createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui', sendDataModel: true },
    },

    // Root arrives EARLY (line 2 of 9): Card > CardContent > FormProvider, whose `children` already names
    // every field id — none have arrived yet, so each mounts as a position-preserving pending anchor
    // (SPEC-R4) until its own line lands below.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', children: ['root_content'] },
          { id: 'root_content', component: 'CardContent', children: ['form'] },
          // FormProvider declares zero layout props (the fleet's "page author owns layout" contract) —
          // the vertical rhythm rides an explicit Column gap, the pattern-settings-form idiom
          // (patterns.ts:36-37). Without it the fields render crashed together (gallery bug, 2026-07-08).
          { id: 'form', component: 'FormProvider', children: ['form_col'] },
          { id: 'form_col', component: 'Column', gap: 'md', children: ['f_name', 'f_email', 'f_budget', 'f_plan', 'row_toggles', 'actions'] },
        ],
      },
    },

    // The initial model the inputs two-way-bind against under `/form/*`. name/email/plan empty + terms:false
    // ⇒ the form loads INVALID (name/plan/terms are required) — what makes the blocked-submit demo live.
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: SURFACE_ID,
        value: { form: { name: '', email: '', budget: '450', plan: '', notify: true, terms: false } },
      },
    },

    // Field wraps ONE control; its `label` becomes the editor's accessible name (ADR-0051 seam).
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'f_name', component: 'Field', label: 'Full name', child: 'in_name' },
          {
            id: 'in_name', component: 'TextField', name: 'name', required: true, value: { path: '/form/name' },
            checks: [{ call: 'required', args: { value: { path: '/form/name' } }, message: 'Name is required' }],
          },
        ],
      },
    },

    // email: format-only (no `required`) — `email('')` is VALID (empty is not a format error).
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'f_email', component: 'Field', label: 'Email', description: 'We reply within a day', child: 'in_email' },
          {
            id: 'in_email', component: 'TextField', name: 'email', type: 'email', value: { path: '/form/email' },
            checks: [{ call: 'email', args: { value: { path: '/form/email' } }, message: 'Enter a valid email' }],
          },
        ],
      },
    },

    // The Wave-5 TextField reach through the catalog, zero factory code (all 1:1 accessor props): an
    // ISO-4217 currency field with a 50-step and a floor. Seeded 450 in the model.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'f_budget', component: 'Field', label: 'Budget', child: 'in_budget' },
          { id: 'in_budget', component: 'TextField', name: 'budget', type: 'currency', currency: 'EUR', step: 50, min: '0', value: { path: '/form/budget' } },
        ],
      },
    },

    // Select + its three Options land TOGETHER (the ADR-0053 first-connect limitation). `required` + empty
    // ⇒ a submit blocker.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'f_plan', component: 'Field', label: 'Plan', child: 'in_plan' },
          {
            id: 'in_plan', component: 'Select', name: 'plan', required: true, placeholder: 'Choose a plan…',
            value: { path: '/form/plan' }, children: ['opt_s', 'opt_m', 'opt_l'],
          },
          { id: 'opt_s', component: 'Option', value: 'starter', label: 'Starter' },
          { id: 'opt_m', component: 'Option', value: 'pro', label: 'Pro' },
          { id: 'opt_l', component: 'Option', value: 'scale', label: 'Scale' },
        ],
      },
    },

    // A wrapping Row of the two boolean controls. Both two-way-bind their `checked` (the bindable prop is
    // named by the CONTROL's own prop — the ADR-0053 naming law). terms is required.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'row_toggles', component: 'Row', gap: 'lg', wrap: true, children: ['sw_notify', 'cb_terms'] },
          { id: 'sw_notify', component: 'Switch', name: 'notify', label: 'Email me updates', checked: { path: '/form/notify' } },
          { id: 'cb_terms', component: 'Checkbox', name: 'terms', label: 'I accept the terms', required: true, checked: { path: '/form/terms' } },
        ],
      },
    },

    // The submit-flagged action (ADR-0054): `submit:true` is a CLIENT-consumed flag `#wireAction` reads to
    // gate the click — it never leaves the client (the emitted `action` wire shape is byte-identical to a plain one).
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_submit'] },
          { id: 'btn_submit', component: 'Button', variant: 'solid', label: 'Submit', action: { action: 'submit_profile', submit: true } },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const generativeFormSeeds: readonly ExampleSeed[] = [generativeFormSeed]
