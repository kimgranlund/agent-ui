# Core SaaS product UX patterns & flows — research brief

> Status: brief (pre-PRD research) · v0.1 · 2026-08-15
> This is a research brief that seeds future PRDs. It is NOT a PRD/SPEC/LLD and carries no
> requirements — every "recommended first slice" is a proposal awaiting its own intake.

Scope (owner's list, verbatim): Registration · Authentication · Onboarding · Preferences &
Settings · Tables (sorting, filtering, searching, modifying and rearranging columns) · Content
layouts: (a) table-of-contents corpus with sticky nav that becomes a select on mobile;
(b) card-arranged views, some with editable options via drawer flows.

Grounding sources: `packages/agent-ui/components/src/controls/` descriptors, the app layer
(`packages/agent-ui/app/src/controls/`), `.claude/docs/flows/*.flow.json`, ADR index.

---

## 1. Registration & Authentication — verdict: PARTIAL

### Canonical flow (current best practice, pattern-level)
- **Identifier-first sign-in**: one email field → server decides the second factor
  (password / magic link / OTP / passkey / SSO). Avoids the password field for
  passwordless-capable accounts.
- **Passkey-first auth** (WebAuthn, 2025+ canon): conditional-UI autofill on the email field,
  password as fallback, "add a passkey" upsell post-sign-in.
- **Progressive-profiling registration**: minimum viable signup (email + one factor), everything
  else collected later in-product; email verification async, never blocking first value.
- **OTP / magic-link legs**: 6-cell code entry with paste-split + auto-advance; resend with
  cooldown; deep-link continuation.
- **Social/SSO**: provider buttons above the fold, account-linking collision handling.

### Fleet coverage
- Flow cards ALREADY EXIST: `.claude/docs/flows/registration-signin.flow.json`,
  `otp-signin.flow.json`, `magic-link-signin.flow.json`, `social-signin.flow.json` — the journey
  layer is designed and gate-checked.
- Controls: `ui-text-field` (13 typed variants incl. `email`, `password`), `ui-otp-field`
  (identity family S2, GH #490 — paste-split, auto-advance, no-gaps invariant), `ui-field`
  (label/assist/error anatomy), `ui-form-provider` (aggregation, ADR-0050), `ui-button`,
  `ui-toast`, `ui-progress`. A2UI even ships a `login-form` mini-skill
  (`a2ui/src/agent/prompts/mini-skills/login-form.md`).

### Gap
- No composed, shippable auth SURFACE — the flow cards are journey specs, not compositions.
  No sign-in/registration composition recipe or app-layer preset exists.
- No passkey pattern anywhere (WebAuthn is a host-API concern, but the fleet needs the
  conditional-UI field affordance + the "passkey or password" fork documented).
- No password-strength / show-hide affordance on `type=password` (assist-row + trailing action
  are field anatomy, but the recipe isn't written).

### Recommended first slice
A `signin-registration` composition recipe (composition-patterns tier, not a new control):
identifier-first form composed from ui-field + ui-text-field + ui-otp-field + ui-form-provider,
mapped 1:1 onto the existing flow cards, with the passkey fork documented as a host seam.
Second slice: show-hide password trailing action as a text-field capability if the recipe
proves it can't compose from outside.

---

## 2. Onboarding — verdict: PARTIAL

### Canonical flow
- **Checklist onboarding** (the dominant SaaS pattern): a persistent, dismissible task list
  (3–7 items) with progress meter; each item deep-links into the real surface; celebrates
  completion; collapses to a pill after first session.
- **Setup wizard**: 2–4 linear steps ONLY for hard prerequisites (workspace name, invite,
  integration); everything optional moves to the checklist.
- **Empty states as onboarding**: every core surface's empty state carries the first-action CTA.
- **Progressive disclosure tours** over modal tours (spotlight tips, one at a time, skippable).

### Fleet coverage
- Flow card EXISTS: `onboarding-first-run.flow.json`.
- Controls: `ui-progress`, `ui-timeline`/`ui-timeline-item`, `ui-disclosure`, `ui-card`,
  `ui-checkbox`, `ui-badge`, `ui-list`, `ui-popover` (tour tips) — the checklist is composable
  today. `ui-super-shell` + presets give the shell to hang it on.

### Gap
- No **stepper/wizard** control or recipe (linear step indicator + step gating). Nothing in the
  fleet renders "step 2 of 4" semantics.
- No checklist-onboarding composition recipe; no empty-state pattern doc (empty states are
  mentioned nowhere as a standard).

### Recommended first slice
An onboarding-checklist composition recipe (card + list + checkbox + progress, bound to a plain
signals store), matched to `onboarding-first-run.flow.json`. Defer a `ui-stepper` mint until the
recipe proves timeline/progress can't fake it — mint-last posture.

---

## 3. Preferences & Settings — verdict: EXISTS

### Canonical pattern
- **Settings IA archetypes**: (a) sectioned master-detail (rail of sections → panel of fields),
  (b) single scrolling page with anchor nav, (c) modal quick-settings. SaaS canon at scale = (a),
  collapsing to a select/accordion on mobile.
- Field-level **save-on-change** with optimistic write + external-change reflection; explicit
  Save only for grouped/dangerous edits; danger zone segregated with confirm.

### Fleet coverage
- `ui-settings` (app layer, LLD-C12) EXISTS and is the archetype (a) done: typed versioned
  `SettingsSchema` → generated sections/fields, `SettingsStore` adapter with per-field-on-change
  writes AND `subscribe` reflection (external set → field, echo-suppressed), composed over
  `ui-master-detail`. Flow card: `account-settings.flow.json`. Edit-drawer precedent for
  danger-zone "Remove" just shipped in agent-admin (PR #948).

### Gap (minor)
- Mobile posture: whether `ui-settings`' rail collapses to a select below the ADR-0150
  breakpoint is unverified — same responsive spine as content-layout (a) below; solve once.
- No danger-zone / confirm-destructive schema field kind; no explicit-save (dirty-state buffer)
  mode in the store contract.

### Recommended first slice
Verify + (if absent) add the mobile rail→select collapse to `ui-settings`, shared with the
TOC-nav slice (§5). Danger-zone field kind is a later schema extension.

---

## 4. Tables: sort · filter · search · column control — verdict: PARTIAL

### Canonical interaction canon
- Header-click **sort** cycling asc→desc(→none), one active sort (multi-sort is power-tier).
- **Search** = free-text over visible cells ("search what you see"); **filter** = bounded facets
  (chips/menus per column), both reflected in visible, clearable state.
- **Column control**: show/hide (visibility menu), reorder (drag or move-in-menu), resize
  (edge drag), pin/freeze — persisted per user as a "view".
- Selection (single/multi + header tri-state), pagination or virtualization, row density.

### Fleet coverage
- `ui-table` (Display tier, ADR-0163/0173) ALREADY carries: typed columns, per-column `sortable`
  (Intl.Collator, numeric-aware, cycles asc→desc), `search` (NFKD case/diacritic-fold over
  searchable columns — query UI composes from outside by design), bounded facet `filter`,
  `selectable` single/multi with identity held across view transforms, `row-key`, `page-size` +
  `ui-pagination`. All opt-in, all bindable via bespoke codecs (table-model.ts).

### Gap — the whole "modifying and rearranging columns" clause
- No column **visibility** (hide/show), **reorder**, **resize**, or **pin**. The `columns` prop
  is the seam (order = render order; omitting a column hides it), so visibility + reorder are
  achievable TODAY by rewriting `columns` from an outside composition — but no recipe, no
  standard "columns menu" affordance, and no persistence story exists.
- No composed table-toolbar recipe (search field + facet menus + columns menu above a bound
  table) — every consumer reinvents it.

### Recommended first slice
A **table-view composition recipe**: toolbar (ui-text-field search + ui-menu facet filters +
ui-menu columns show/hide + move up/down) bound to one `columns`/`search`/`filter` signal set,
proving column visibility/reorder needs zero table changes. Defer in-header drag-reorder and
edge-drag resize to a later ADR — they're the only parts that would touch ui-table itself.

---

## 5. Content layout (a): TOC corpus + sticky nav → select on mobile — verdict: MISSING

### Canonical pattern
- Long-form/reference corpus: content column + sticky side TOC (scroll-spy highlights the
  active heading; click = smooth anchor scroll); below the mobile breakpoint the TOC becomes a
  `select` (or disclosure) pinned at top. Docs-site canon (MDN/Stripe-docs shape).

### Fleet coverage
- Ingredients exist: `ui-master-detail` (rail+panel), `ui-nav-rail` (+group/item),
  `ui-select`, `ui-text` (real headings, ADR-0025), `ui-markdown` (@agent-ui/code renders
  heading structure), `shell-breakpoint.ts` in the app layer + the ADR-0150 breakpoint law.
- Nothing does scroll-spy, anchor-derived TOC, or a responsive nav→select swap. The docs site
  itself hand-rolls its page nav.

### Gap
The whole pattern: no `ui-toc` (or recipe) deriving entries from headings, no scroll-spy trait
(IntersectionObserver), no sticky posture, no nav→select responsive swap primitive.

### Recommended first slice
Recipe-first: a TOC composition over `ui-nav-rail`/`ui-select` with a small scroll-spy trait
(`traits/` tier — `(host, opts) => cleanup` shape fits IntersectionObserver cleanly), swapped at
the ADR-0150 breakpoint via `shell-breakpoint.ts`. Mint `ui-toc` only if the recipe shows the
heading-derivation + spy wiring is too heavy to ask of consumers.

---

## 6. Content layout (b): card-arranged views + edit-via-drawer — verdict: PARTIAL

### Canonical pattern
- Card grid/board of entities (responsive auto-fill columns; card = summary + actions);
  selecting "edit" opens an **edge-docked drawer** carrying the edit form; save/cancel with
  dirty-state guard; optimistic update back into the card; destructive action segregated.

### Fleet coverage
- All primitives EXIST: `ui-card` (+header/content/footer, ADR-0186 structured header),
  `ui-grid`, `ui-drawer` (edge-docked modal container, ADR-0188, bindable `open`),
  `ui-form-provider` + field fleet, `ui-menu` (card overflow actions), `ui-toast`.
- A LIVE precedent exists: agent-admin's edit-drawer flow (app layer, PR #948 — segmented tier,
  field rhythm, danger Remove) — but it's bespoke to agent-admin, not a documented pattern.

### Gap
No published composition recipe: card-grid → drawer-edit wiring (which signal owns `open` +
the editing entity, dirty-state/discard-confirm, write-back). The knowledge is trapped in
agent-admin.

### Recommended first slice
Extract the agent-admin edit-drawer shape into a card-grid + drawer-edit composition recipe
(composition-patterns / example tier) with a worked example on the docs site; name the
dirty-state-guard convention. Zero new controls expected.

---

## Summary table

| Family | Verdict | Gap in one line | First slice |
|---|---|---|---|
| Registration + Auth | PARTIAL | flows + controls exist, no composed surface; no passkey pattern | signin/registration composition recipe |
| Onboarding | PARTIAL | checklist composable, no recipe; no stepper | onboarding-checklist recipe |
| Settings | EXISTS | mobile rail collapse unverified; no danger-zone kind | verify/add rail→select collapse |
| Tables | PARTIAL | column hide/reorder/resize/pin + toolbar recipe missing | table-view recipe (columns menu proves the seam) |
| TOC corpus layout | MISSING | no scroll-spy, no TOC, no nav→select swap | scroll-spy trait + TOC recipe |
| Card views + drawer edit | PARTIAL | primitives + live precedent, no published recipe | extract agent-admin shape into a recipe |

Cross-cutting observation: five of six gaps are **composition recipes**, not control mints —
consistent with the repo's mint-last posture. The only candidate control-level work: table
column drag-reorder/resize (deferred), a possible `ui-stepper`, a possible `ui-toc` — each
gated behind its recipe proving the need.
