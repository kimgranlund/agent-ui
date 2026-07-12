# ADR-0020 — `ui-modal` dismissal control: `persistent` (presence-boolean, default false) replaces `dismissable`

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the `review-g9-modal` (s16) escalation |
> | **Ratified by** | Kim, 2026-07-12 — the repo-alignment Phase-0 checkpoint (all five June foundation ADRs ratified together; shipped law since late June) |
> | **Repairs** | `a2ui-catalog SPEC §5.2` (the `Modal` row: `dismissable` → `persistent`) · `a2ui-catalog LLD` (the `mapsTo` 1:1 list) · **controls/modal/\*** (the control + descriptor + probes) · `a2ui catalog/default/catalog.json` (the `Modal` property descriptor) |
> | **Supersedes / Superseded by** | **Supersedes ADR-0017 cl.3 in part** (the `[dismissable]` dismissal-gate prop → `persistent`); ADR-0017's native-`<dialog>` decision and clauses 1 / 2 / 4 / 5 **stand** |

## Context

ADR-0017 ships `ui-modal` over a native `<dialog>` and (clause 3) gates user dismissal — Escape and a backdrop
click — behind a **`dismissable` presence-boolean prop, default `true`**. The control reads `!this.dismissable` to
block the platform `cancel` event and to ignore a backdrop click.

A presence-boolean is **un-falsifiable by attribute.** Across the fleet (`open`, `reflect`, every `prop.boolean`)
the convention is the HTML one: **attribute presence ⇒ `true`, absence ⇒ `false`**, and `="false"` is still
*present*, so it **coerces back to `true`**. A prop that is `true` by default therefore cannot be turned **off**
declaratively — there is no attribute that means "not dismissable." The only way to reach `false` is the JS
property (the A2UI renderer path), which leaves the declarative HTML surface unable to express the override at all.

This is not theoretical: `modal.md` shipped the example `<ui-modal dismissable="false">` as "a blocking,
non-dismissable modal" — and it renders **dismissable** (the attribute is present → `true`). The documented public
API is actively **misleading**. The `review-g9-modal` reviewer (decomp `s16`) escalated this from a deferred polish
item to **must-fix-before the public API freezes**: once authors depend on a prop name, inverting it is a breaking
change, so the inversion must land before the freeze, not after.

The right shape is the platform's own: HTML names boolean attributes for the **non-default** state and turns them
on by **presence** — `disabled`, `hidden`, `required`, `inert`. None of them is `enabled`/`shown`/`optional` with a
default-`true` that authors must somehow switch off. The common case is the *unmarked* default; the rare case is
the named, presence-set attribute.

## Decision

We **invert the dismissal control to `persistent`** — a presence-boolean, **default `false`**, reflected. The
common case (a dismissable modal) is the **unmarked default**; the override (a blocking modal) is the **named,
presence-set** attribute:

- `<ui-modal>` — **dismissable** (Escape + backdrop-click close it). The default, no attribute needed.
- `<ui-modal persistent>` — **non-dismissable** (the agent owns the close; set `open = false`). Expressed by
  attribute presence — the case the old `dismissable` could not declare.

The dismiss semantics **invert at the gate, not in mechanism**. Every behaviour ADR-0017 cl.3 wired off
`!dismissable` now keys off `persistent` (a single boolean negation flips):

| dismiss path (ADR-0017 cl.3 mechanism — unchanged) | old gate (`dismissable` default `true`) | new gate (`persistent` default `false`) |
|---|---|---|
| **Escape** — the platform `cancel` event | `if (!this.dismissable) event.preventDefault()` | `if (this.persistent) event.preventDefault()` |
| **Backdrop click** — a click on the dialog box outside its content rect | `if (!this.dismissable) return` | `if (this.persistent) return` |
| **Close-affordance enablement** — whether user-initiated close is allowed at all | enabled while `dismissable` (default on) | enabled unless `persistent` (default off) |

The platform `close`/`toggle` sync, the focus restore, the ARIA forwarding, the create-once dialog part, and the
`open`-driven `showModal()`/`close()` (ADR-0017 cl.1 / 2 / 4 / 5) are **untouched** — only the dismissal **gate
condition** and the prop it reads invert. `a2ui-catalog SPEC §5.2`'s `Modal` row and the default catalog's `Modal`
property descriptor rename `dismissable` → `persistent` (the catalog's `mapsTo` stays 1:1 with the control prop).

## Build brief — for execution-lead (build without re-deciding)

### Prop shape + reflection (modal.ts)

Replace the `dismissable` prop with `persistent`, mirroring the existing `open` reflection:

```ts
// `persistent` (default OFF) — when present, the modal is NON-dismissable: the dialog's `cancel` event (Escape)
// is preventDefault-ed and a backdrop click is ignored, so the agent owns the close (set open=false). Reflected
// (presence-boolean: <ui-modal persistent> ⇒ true, absent ⇒ false) — the declarative override the old default-on
// `dismissable` could not express (attribute presence always coerced true). See ADR-0020.
persistent: { ...prop.boolean(false), reflect: true },
```

`persistent` does **not** collide with any `HTMLElement`/`Element` member (unlike `scroll`, which forced
`scrollable` on `ui-card-content`) — the property name is safe.

### Dismiss wiring (modal.ts `connected()`)

Two gate flips (the mechanism is identical — only the boolean inverts):

- The `cancel` listener: `if (!this.dismissable) event.preventDefault()` → `if (this.persistent) event.preventDefault()`.
- The `click` (backdrop) listener: `if (!this.dismissable) return` → `if (this.persistent) return`.
- Update the three source comments that describe the gate (the header "dismissal gate" bullet, the `persistent`
  prop comment, and the inline `cancel`-listener comment) to read `persistent` (default off) semantics.

### Exhaustive file / change list

Verified by reading each file (16 files reference `dismissable`). Grouped by owner.

**A. Control + probes** — `packages/agent-ui/components/src/controls/modal/`

1. **`modal.ts`** — the prop (`dismissable: prop.boolean(true)` → `persistent: prop.boolean(false)`, reflect kept);
   the two dismiss-gate flips above; the header/prop/inline comments.
2. **`modal.md`** —
   - frontmatter `attributes:` — rename the `dismissable` entry to **`persistent`**, `default: false`, reword its
     comment (presence-set override). Declaration order stays last: `[elevation, brightness, open, persistent]`.
   - frontmatter `properties:` — rename `dismissable` → `persistent`, reword the description.
   - frontmatter `keyboard:` — the Escape row: reword to "dismisses when **not** `persistent`; when `persistent`
     the `cancel` is preventDefault-ed and Escape does nothing."
   - the frontmatter header comments (the `open/dismissable` mentions).
   - **the prose example, line 98** — `<ui-modal dismissable="false" elevation="2">` →
     **`<ui-modal persistent elevation="2">`** (the fix for the misleading example).
   - the **Dismissal** prose section — `dismissable` (default on) → `persistent` (default off), inverted wording.
3. **`modal.test.ts`** —
   - the default assertion: `expect(el.dismissable).toBe(true)` → `expect(el.persistent).toBe(false)`.
   - the `dismissable gates the cancel` describe/it → **`persistent`** gate, logic inverted: **default (not
     persistent)** → `fireCancel(...).defaultPrevented === false`; after `el.persistent = true` →
     `defaultPrevented === true`.
   - the typed negative-control + comment mentions (`el.persistent` is boolean).
4. **`modal-descriptor.test.ts`** —
   - `ATTR_NAMES` → `['elevation', 'brightness', 'open', 'persistent']`.
   - the part-b descriptor test: `const persistent = parsed.attributes.find(a => a.name === 'persistent')`,
     `expect(persistent?.default).toBe('false')`, `reflect === true`.
   - the **DRIFT_DEFAULT negative control**: the real default is now `'false'`, so flip a copy to **`'true'`** to
     trip it; path becomes `attributes.persistent.default`.
5. **`modal.browser.test.ts`** — the `dismissable=false: Escape does NOT close` test: rename to
   `persistent: Escape does NOT close`; `modal.dismissable = false` → `modal.persistent = true`. The comment
   inverts: `persistent` **can** be set by attribute presence (`<ui-modal persistent>`) — note that as the fix,
   rather than the old "never the attribute" caveat.
6. **`modal-css.test.ts`** — **verified: no `dismissable` reference; no change.**

**B. A2UI default catalog** — `packages/agent-ui/a2ui/src/catalog/default/` *(CLAUDE.md: the a2ui layer is team-led; route per orchestration)*

7. **`catalog.json`** (the **s11 Modal property descriptor** — the team-lead's known ripple #4): line ~113
   `"dismissable": { "type": { "type": "boolean" }, "mapsTo": "dismissable" }` →
   `"persistent": { "type": { "type": "boolean" }, "mapsTo": "persistent" }`.
8. **`index.test.ts`** — `expect(modal.properties.dismissable?.mapsTo).toBe('dismissable')` →
   `persistent` / `'persistent'`; the conformance node `{ id: 'modal', component: 'Modal', open: false,
   dismissable: true }` → `persistent: false`.
9. **`factories.ts`** — the comment listing `dismissable`/`scrollable` → `persistent`/`scrollable`.
10. **`factories.test.ts`** — `modalFactory.applyProp(el, 'dismissable', false)` →
    `applyProp(el, 'persistent', true)`; the assertion `...dismissable).toBe(false)` → `...persistent).toBe(true)`.

**C. /site docs** — `site/` *(execution-lead / docs-site-steward)*

11. **`site/pages/modal-demo.ts`** — **contains the same live bug**: the blocking specimen passes
    `{ dismissable: 'false', 'aria-label': 'Blocking modal' }` (line ~59), which renders **dismissable**. Change to
    a presence attribute `{ persistent: '', 'aria-label': 'Blocking modal' }` (or set the property). Reword the
    section blurbs (the `dismissable="false"` explanation, the "Dismissable / Non-dismissable" labels).
12. **`site/pages/modal-doc.ts`** — the two comments (the attribute table is `surface + open/persistent`; the live
    specimen is dismissable by default).
13. **`site/main.ts`** — the two card blurbs: "dismissable vs blocking" → "dismissable (default) vs `persistent`";
    "(surface + open/dismissable)" → "(surface + open/persistent)".

**D. Spec-family owning docs** — the by-ID repairs (this ADR's `Repairs`) *(the a2ui specs are team-led — route per orchestration)*

14. **`.claude/docs/specs/specs/a2ui-catalog.spec.md`** — the `Modal` row (line ~136): `dismissable` → `persistent`.
15. **`.claude/docs/specs/llds/a2ui-catalog.lld.md`** — the `mapsTo` 1:1 list (line ~80): `selected`/`open`/**`dismissable`**/`scroll`
    → …/**`persistent`**/`scroll`.
16. **`.claude/docs/decompositions/g9-containers.decomp.json`** — the `s9` acceptance text (line ~54):
    `dismissable: boolean(reflect, default true)` → `persistent: boolean(reflect, default false)`, and the
    dismissal-gate sentence. **Load-bearing:** a rebuild reads this acceptance — leaving it stale re-introduces the
    bug.

**E. ADR cross-references** — `.claude/docs/adr/` *(authored in this wave by planning-lead)*

17. **`0020-…md`** (this file) — NEW.
18. **`0017-native-dialog-modal.md`** — forward link added to its *Supersedes / Superseded by* metadata row
    (`Superseded in part by ADR-0020`); its Decision/clause text is **left intact as history** (append-only).
19. **`README.md`** — the index: new `0020` row + annotate the `0017` row.

## Consequences

- **The declarative API becomes truthful.** `<ui-modal persistent>` expresses the blocking case the old
  `dismissable` could not, and the misleading `modal.md:98` example is corrected. The default (`<ui-modal>` =
  dismissable) needs no attribute — the common case is the unmarked state, matching `disabled`/`hidden`/`required`.
- **This is a breaking rename — hence the pre-freeze timing.** Anyone (agent payload, HTML author, test) referring
  to `dismissable` must move to `persistent` **with the inverted default**: `dismissable: true` (the old default) ⇒
  the **absence** of `persistent`; `dismissable: false` ⇒ `persistent` (or `persistent: true`). Because this is a
  reversal of meaning, not just a rename, the catalog/spec/test/site updates above are not optional — a half-renamed
  surface would silently invert behaviour. Net-new: nothing outside the listed 16 files depends on the prop.
- **The platform mechanism is unchanged.** The native `<dialog>` `cancel`/`close`/backdrop wiring, the focus
  restore, and the two-way `open` bind (ADR-0019) are byte-for-byte the same — only the gate's boolean inverts.
  ADR-0017 stays in force; only its cl.3 prop is superseded.
- **Stale → re-verify:** `a2ui-catalog SPEC §5.2` (the `Modal` row), the catalog LLD `mapsTo` list, the
  `g9-containers` decomp `s9` acceptance, `modal.md`, the modal probes, the catalog probes, and the `/site` modal
  pages all regenerate against `persistent`. The descriptor↔props trip-wire (`modal-descriptor.test.ts`) and the
  catalog conformance test are the gates that catch a half-done rename.

## Alternatives considered

- **Keep `dismissable` (default `true`)** — rejected: this *is* the bug. The override (non-dismissable) is
  inexpressible by attribute (presence coerces `true`), and the shipped doc example proves the surface lies. No
  amount of documentation fixes an un-falsifiable boolean.
- **A value-coercing `dismissable` that parses `="false"`** — rejected: it would make **one** prop in the fleet
  read `="false"` as `false` while every other boolean prop (`open`, `reflect`, the form controls) stays
  presence-coerced. A bespoke per-prop coercion is inconsistent and surprising, and it still leaves the *bare*
  `<ui-modal dismissable>` meaning `true` — the same trap one attribute over. The fleet convention is presence;
  the fix is to name the prop for its non-default state, not to special-case its parsing.
- **A string/enum `dismiss` prop** (`dismiss="none | escape | backdrop | all"`) — rejected: over-engineered for a
  control whose Escape and backdrop gates move **together** (ADR-0017 cl.3 gates both off one boolean). A
  binary needs a boolean, not a four-value enum; splitting the two dismiss paths is a *future* decision (a new ADR)
  if a real product ever needs Escape-without-backdrop, not a reason to ship an enum now.
- **Two booleans (`escape-dismiss` + `backdrop-dismiss`)** — rejected for the same reason: there is no current
  requirement to decouple the two dismiss paths, and two props double the surface for a case that does not exist.
  `persistent` collapses the binary into one platform-idiomatic presence-boolean; the split stays available behind
  a later ADR.
