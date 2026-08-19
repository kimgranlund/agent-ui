// generative-form.ts — the flagship Generative Form seed (ADR-0055 clause 5, fork F1 — the re-slice).
//
// ONE canonical seed serves BOTH the form page (a coordinated, accessibly-labelled, validated form built
// from a single payload) and the streaming page's line-by-line feed — a single owner, no drift seam.
// Re-sliced into a FINE-GRAINED message sequence (9 lines, `createSurface` first) rather than the
// original 3-message shape: root arrives EARLY (line 2 of 9 — the surface paints and grows field by
// field), and each subsequent `updateComponents` adds one Field-and-control unit at a time — exactly what
// makes the stream *feel* progressive (the out-of-order-tolerant `children` refs on `form_col`/`card_footer`
// resolve as each field's components land, SPEC-R4).
//
// `f_plan`/`in_plan`/its three Options land in ONE message (line 7): the ship-together default
// (ADR-0053 + its 2026-07-13 Amendment). Late APPENDED Options adopt (TKT-0026), and a mid-position
// insert no longer crashes the generic reconciler either (TKT-0031, FIXED) — but a mid-list splice
// still lands at the listbox's current tail, not its wire-requested position, so ship-together
// remains the recommended composing shape for exact panel order.
//
// Every property is a declared default-catalog row (Field/FormProvider/Checkbox/Switch/Select/Option +
// the TextField `type`/`currency`/`step`/`min` reach) — a payload only a coordinated form catalog can
// render. The submit Button's action carries `submit:true` (ADR-0054) — the FormProvider gate.
//
// P9 card-anatomy repair (2026-08-18, GH #1262 back-score wave): `btn_submit` used to ride a `Row` inside
// `CardContent` with no `CardFooter` (the scattered-actions anti-pattern). `CardHeader`/`CardContent`/
// `CardFooter` must be `Card`'s DIRECT children (`card.css`'s `:scope > :where(...)` region selector), so
// a `CardFooter` sibling of `CardContent` can no longer sit inside a `FormProvider` nested inside
// `CardContent` (the old shape) without losing real submit-gating (`el.closest('ui-form-provider')`,
// `renderer.ts`, needs the gate to be an actual DOM ancestor of the submit Button). The fix: `root` IS the
// `FormProvider` itself now (no separate `form` id needed), `Card` sits one level down (non-root),
// `CardContent`/`CardFooter` are `Card`'s direct children — `FormProvider`'s registry still sees every
// descendant through the extra `Card` level (event-bubbling registration + `closest()` gating), so P7's
// real-gating law and P9's anatomy law both hold at once.
//
// CardHeader-title convergence (2026-08-18, Kim's ruling): this seed carries no separate identity title
// (only the fields), so there is no Text to move — `root_content`/`root_footer` are renamed to
// `card_content`/`card_footer` purely for the GH #760 naming nit (FormProvider-as-root, ids wire-opaque).

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

    // Root arrives EARLY (line 2 of 9): root IS the FormProvider (P9 repair note above) > Card >
    // CardContent + CardFooter. `form_col`/`actions` already name every field/action id — none have
    // arrived yet, so each mounts as a position-preserving pending anchor (SPEC-R4) until its own line
    // lands below.
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'FormProvider', children: ['card'] },
          { id: 'card', component: 'Card', children: ['card_content', 'card_footer'] },
          { id: 'card_content', component: 'CardContent', children: ['form_col'] },
          // FormProvider declares zero layout props (the fleet's "page author owns layout" contract) —
          // the vertical rhythm rides an explicit Column gap, the pattern-settings-form idiom
          // (patterns.ts). Without it the fields render crashed together (gallery bug, 2026-07-08).
          { id: 'form_col', component: 'Column', gap: 'md', children: ['f_name', 'f_email', 'f_budget', 'f_plan', 'row_toggles'] },
          { id: 'card_footer', component: 'CardFooter', children: ['actions'] },
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
    // `actions` lands here, resolving the pending anchor `card_footer` already named above (SPEC-R4).
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
