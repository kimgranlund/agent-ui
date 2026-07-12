# LLD — `<component-gallery>` (the G8 kernel-dogfooding gallery)

> Component LLD for the G8 intake (decomp `g8-gallery-release-readiness.decomp.json`, node n1a/n1b).
> **Trace note.** Component LLDs trace to the **ADR log + `goals.md` milestones** (the components' design
> authority); they do **not** use the A2UI `SPEC-R#` family (the components have none — there is no
> `SPEC-R1` here to trace), so the A2UI LLD harness's `SPEC-R#` check is N/A here (the house convention,
> per `icon-adapter.lld.md` / `indicator-element.lld.md:13`). Trace targets: **goals.md §G8 DoD item 1**
> (both clauses — the gallery + forced-colors; item 2, the coherence audit, is ADR-0081's, not this LLD's)
> · **ADR-0079** (the gallery architecture, proposed) · **ADR-0077** (the `<component-preview>` it
> composes) · **ADR-0023** (the public directive-host seam it dogfoods).
> · proposed · 2026-07-05 · planner · **rev 1** 2026-07-05 (doc-review minors + Kim's theming reframe:
> "tone" DROPPED → `scheme`; a reserved `theme` package seam joins — LLD-C4) · **rev 2** 2026-07-05
> (as-built corrections from the G8 build: §5 + §6 E3 — the overlay failure mode was CONSTRUCTION-time,
> not closed-state; fixed inside the preview, ADR-0077 Amendment 1)
>
> **Composes on:** `site/lib/component-preview.ts` (ADR-0077 — the specimen renderer; NOT re-built) ·
> `site/lib/frontmatter.ts` `ALL_DESCRIPTORS`/`parseDoc` (the derived member list) · the PUBLIC
> `@agent-ui/components` barrel (`signal`, `computed`, `UIElement`, `mount`, `repeat`, `watch`,
> `Directive`/`directive`/`NO_COMMIT`) · `site/pages/_page.ts` (`mountPage`, NAV). **No `html``` anywhere**
> — it is private (ADR-0023).
>
> **Freeze discipline.** §3 (Interfaces) is the contract the builder codes against. A builder who cannot
> satisfy a frozen interface STOPS and escalates — the fix is a coordinated LLD repair, never a local
> deviation.

## 1 · Intent (what G8's DoD demands, reconciled with what exists)

Outside-in, the DoD: *"the gallery renders every control, themed through one provider
(scale/density/tone), and survives forced-colors"* — built **with** the foundation (a `filter` signal, a
`repeat`-reconciled grid, `watch` readouts). Kim's ratified theming reframe (2026-07-05) redefines the
provider vocabulary: **"tone" is dropped** — the provider is `<theme-provider>` carrying **`scheme`**
(light/dark) + `scale` + `density`, plus a **reserved `theme` package seam** (goals.md's DoD line 1
wording repairs on ADR-0079's ratification). Inside-out, the estate: `<component-preview>` already turns a
`ui-*` tag + its descriptor into a live, knobbed, interactive specimen, and `ALL_DESCRIPTORS` already
enumerates the fleet. The gallery is therefore a thin **reactive shell**: a derived member list, one
kernel-driven filter/reconcile/readout loop, one theme-provider subtree — and one `<component-preview
mode="component">` per member as the specimen. It renders nothing per-control itself.

Deliberately NOT a `ui-*` control (ADR-0077 precedent: docs meta-infra carries no descriptor/coverage/
budget obligation) — but its **class extends the public `UIElement`**, so the FACE host (connection scope,
`this.effect`, zero-residue disconnect) is dogfooded too, not just the kernel functions.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | member derivation (`galleryMembers()`) | `site/lib/component-gallery.ts` | G8-DoD-1 "every control" |
| LLD-C2 | `node()` element directive | `site/lib/component-gallery.ts` | ADR-0023 directive trio |
| LLD-C3 | `ComponentGallery` element (filter · grid · readout) | `site/lib/component-gallery.ts` + `.css` | G8-DoD-1 dogfood clause |
| LLD-C4 | `<theme-provider>` (scheme · scale · density + reserved `theme` seam) | `site/lib/theme-provider.ts` (site-local; composed by LLD-C3) | G8-DoD-1 "one provider"; ADR-0079 cl. 3 |
| LLD-C5 | gallery page + nav | `site/pages/gallery.ts` · `site/gallery.html` · `_page.ts` NAV | site TOC/coverage gates |
| LLD-C6 | gates (jsdom + browser incl. forced-colors) | `site/gallery.test.ts` · `site/gallery.browser.test.ts` | G8-DoD-1 forced-colors; decomp n1b |

## 3 · Interfaces (frozen)

```ts
// LLD-C1 — the derived member list. Source: the SAME build-time glob the preview reads (frontmatter.ts).
// Every descriptor whose `tag` scalar starts 'ui-', sorted by tag — FIXED alphabetical order (see §6 E1).
export interface GalleryMember {
  readonly tag: string          // 'ui-button'
  readonly tier: string         // descriptor `tier` scalar ('' when absent) — the group chip
  readonly hasOpen: boolean     // descriptor declares an `open` attribute (the overlay-class marker, §6 E3)
}
export function galleryMembers(): readonly GalleryMember[]

// LLD-C2 — the element directive: commits ONE real element into a child hole (the public-trio idiom).
// Needed because a child hole commits text/TemplateResult/array/directive ONLY — a raw Element would
// stringify (template.ts #commitChild → #commitText). ~15 lines: insert before endNode on first update,
// replace when the element identity changes, remove on dispose.
export function node(el: HTMLElement): DirectiveResult

// LLD-C4 — <theme-provider>: the ONE theming subtree (site-local plain custom element, ~15 lines).
// Attributes: scheme ('light'|'dark') · scale (Scale) · density (Density) · theme (the RESERVED package
// seam — a named token package, e.g. theme="mad-max"; G8 ships ONLY 'default'). It owns exactly one
// mapping: scheme → its own style.colorScheme (observedAttributes ['scheme']); scale/density/theme are
// pure attribute carriers — the token system's [scale]/[density] selectors (and a future package's
// [theme='<name>'] layer) key off them in CSS, no JS.
class ThemeProvider extends HTMLElement { /* attributeChangedCallback('scheme') → style.colorScheme */ }
customElements.define('theme-provider', ThemeProvider)

// LLD-C3 — the gallery element. Plain tag (site-local), UIElement class (public barrel).
// Theme state + filter are kernel signals; the element itself satisfies RenderContext ({ effect }).
class ComponentGallery extends UIElement {
  // signals (all #private): #filter: Signal<string> · #scale: Signal<Scale> · #density: Signal<Density>
  //                         #scheme: Signal<'light' | 'dark'> · #theme: Signal<string> ('default' only, G8)
  // computed: #visible: ReadonlySignal<readonly GalleryMember[]>  — order-preserving subsequence of members
}
customElements.define('component-gallery', ComponentGallery)
```

Vocabularies (from the token system, not invented): `Scale = 'ui-sm'|'ui-md'|'ui-lg'|'content-sm'|
'content-md'|'content-lg'` (ADR-0032) · `Density = 'compact'|'comfortable'|'spacious'` · **`scheme` =
`'light'|'dark'`** — the axis `light-dark()` tokens resolve per-element via the inherited `color-scheme`
(tokens.css:2); Kim's reframe names it `scheme` (the old DoD word "tone" is retired). **`theme` is a
reserved, wired seam**: the attribute + selector ship in G8 with exactly one package (`default`); the
multi-theme PACKAGE-swapping system (alternate branded token packages keyed off `[theme='<name>']`) is
**explicitly deferred to the next tier**, tied to the pending scope-dial decision (decomp F2b). Do not
build package swapping in G8.

## 4 · Structure + data flow (the dogfood loop)

```
<component-gallery>                          (UIElement; light DOM; connected() builds once)
 ├─ .gallery-toolbar
 │   ├─ filter <input type=search>  ── input → #filter.value = q        (signal write)
 │   ├─ theme selects: scheme · scale · density · theme (one option, G8)  (signal writes)
 │   └─ readout hole  ◄── mount(watch(() => `${#visible.value.length} of ${members.length}`), hole, this)
 └─ <theme-provider scheme scale density theme>   (LLD-C4 — the ONE theme subtree)
     └─ .gallery-grid
         └─ hole ◄── mount(watch(() => #visible.value,
                          (ms) => repeat(ms, m => m.tag, m => node(this.#card(m)))), grid, this)
```

- **Filter:** `#visible = computed(() => members.filter(m => m.tag.includes(normalize(#filter.value))))` —
  a pure order-preserving subsequence. The `watch` mapper re-commits a `repeat` result on each change;
  same-ctor re-commit threads the directive state, so reconciliation is keyed enter/exit with **zero DOM
  rebuilds** of surviving cards (the G3 stable-prefix guarantee). This nesting is sanctioned by
  `watch`'s own contract (mapper value "can be … even a nested directive", `dom/watch.ts:5-8`).
- **Cards are created once per tag and cached** (`#cards: Map<string, HTMLElement>`): a card = heading +
  tier chip + `<component-preview mode="component" target="{tag}">`. Cache-before-repeat means a card that
  filters out and back in returns the **same element object** — preview knob state survives filtering (and
  the `node()` directive's identity check makes the re-entry cheap).
- **Theme provider (LLD-C4):** exactly ONE `<theme-provider>` wrapper carries the theming:
  `this.effect(() => { tp.setAttribute('scheme', #scheme.value); tp.setAttribute('scale', #scale.value);
  tp.setAttribute('density', #density.value); tp.setAttribute('theme', #theme.value) })`. The provider
  maps `scheme` → its own `color-scheme`; `[scale]`/`[density]` resolve via the token system's §1-row
  lookup (ADR-0038) and `light-dark()` per-subtree by construction; `theme` is carried for a package's
  `[theme='<name>']` CSS layer — **seam wired, one package (`default`) in G8** (the swapping system is
  next-tier scope, decomp F2b). Nothing per-card; that is what "one provider" means.
- **RenderContext:** every `mount(…, …, this)` passes the element itself — `UIElement.effect` structurally
  satisfies `RenderContext` (`template.ts:297`), so watch effects are **connection-scope-owned**: they die
  on disconnect (zero subscribers) and respawn on reconnect. This is the lifecycle half of the dogfood.

## 5 · Composition over `<component-preview>` (what is reused vs added)

Reused as-is (ADR-0077): descriptor→knob derivation, the live specimen, read-back, the canvas surface,
the empty-specimen hint, the error row for an unknown tag. The gallery sets only `mode="component"` +
`target`. **As built (rev 2):** preview gaps DID surface when the gallery first drove the whole fleet
through component mode — and were fixed **inside the preview**, exactly where this section routed them
(as gate-pinned per-tag sets, not a gallery workaround): the `NO_SLOT_TEXT`/`SLOT_TEXT_OK` partition
(12/13), `COMPONENT_SAMPLE_CHILDREN` (anchor triggers), and `COMPONENT_INITIAL` (demo seeds) —
**ADR-0077 Amendment 1** records them + the mandatory new-control classification rule. The gallery still
forks no specimen rendering.

## 6 · Failure modes, edges, empties (per case)

| # | Case | Handling |
|---|---|---|
| E1 | **Reorder is out of contract.** `ChildPart.moveBefore` (template.ts:442) relocates a part's directly-owned nodes; content owned by a *nested directive's* sub-anchors is not tracked (`template.ts:435`). A sort knob would corrupt card placement. | Member order is FIXED alphabetical; filtering is an order-preserving subsequence ⇒ `repeat` never reorders (enter/exit only). A jsdom probe pins node identity across a filter toggle. If a sort feature is ever wanted, the `repeat`/`moveBefore` directive-content seam must be built first (relates the open #69/ADR-0022 item) — named trigger, not silent scope. |
| E2 | **`mount` without ctx.** `watch` stays un-installed with no scope owner — a silently empty grid/readout. | Every `mount` passes `this`; a jsdom negative probe asserts the ctx-less form yields an empty hole (proves the gate bites, documents the trap). |
| E3 | **Bare construction fails BEFORE `open` is ever touched** *(rev 2 — the as-built correction; the planned "exists-but-closed" model was wrong)*: anchor-dependent overlays (`ui-tooltip`/`ui-menu`/`ui-popover`) cannot even construct without a trigger child, and the preview's blind SLOT_TEXT `textContent=` write silently DESTROYED self-built control DOM (editor · listbox · dialog · panel · grid · tablist · rail/thumbs · field chrome) — a **construction-time** failure mode, not a closed-state rendering issue. | Fixed in the **preview** (ADR-0077 Amendment 1): `COMPONENT_SAMPLE_CHILDREN` supplies the anchor trigger for the three anchor-dependent overlays; the `NO_SLOT_TEXT`(12)/`SLOT_TEXT_OK`(13) partition — pinned by the bite-tested partition gate (`component-preview-slot-text.test.ts`) — suppresses the SLOT_TEXT knob wherever the write would clobber. Closed-by-default remains the honest resting state; the browser smoke still derives the overlay set from `hasOpen`, opens each via the attribute, and asserts the panel paints. |
| E4 | **Empty filter result.** | The grid shows a styled empty-state row (`role="status"`, the adr-index precedent); the readout still reads "0 of N". Probe: filter `zzz` ⇒ empty-state visible, zero cards. |
| E5 | **A descriptor without a `tag` scalar** (malformed) | Excluded by the `startsWith('ui-')` guard; the jsdom list gate compares against the same rule, so a malformed descriptor fails THAT gate (the fleet's own trip-wires own descriptor validity — not re-checked here). |
| E6 | **Duplicate tags across descriptors** | `galleryMembers()` throws at build (a duplicate key would also throw inside `repeat`) — loud, matching the ADR-0077 "silently-empty is a defect" stance. |
| E7 | **forced-colors** | Gallery chrome uses system-color-safe styling (no ink-by-background-only); the Chromium smoke asserts chrome + a specimen sample keep visible ink; WebKit has no forced-colors emulation (the documented engine split, tabs precedent) — asserted genuinely-Chromium-only. |
| E8 | **Disconnect/reconnect** (page teardown, DOM moves) | All effects/listeners ride the connection scope (`this.effect`/`this.listen`); `mount` disposers are stored and called in `disconnected()`; a probe asserts zero live subscribers after removal (the G2 law, applied to site code). |
| E9 | **Preview double-registration** | `component-preview.ts` self-guards (`customElements.get` check); the gallery imports it side-effect-style like a2ui-catalog does. |
| E10 | **An unknown `theme` name** (a future consumer sets `theme="mad-max"` with no such package loaded) | The attribute carries through unchanged and no `[theme='mad-max']` CSS layer matches ⇒ the default look renders — degradation is silent-but-correct by construction. The gallery's own selector offers only registered packages (exactly one, `default`, in G8), so the gallery cannot reach this state itself; the seam contract is documented for the next-tier package system (F2b). |

## 7 · Page + nav (LLD-C5)

`site/gallery.html` + `site/pages/gallery.ts` follow the page convention exactly: `import { mountPage }
from './_page.ts'` FIRST (the load-bearing CSS cascade), then `../lib/component-gallery.ts`
(side-effect define), then append `<component-gallery>` to `content`. NAV: one **ungrouped** link
(`{ links: [{ href: './gallery.html', label: 'Gallery' }] }`) — the labeled-group TOC must stay ≡ the
fleet (`site-toc` gate; ADR-0077 precedent for site-level pages).

## 8 · Acceptance criteria (the checkable predicates — decomp n1a/n1b `accept`)

1. `npm run check` (incl. `check:site`) exit 0 · `npm run build` exit 0.
2. Public-surface discipline: `component-gallery.ts` imports `@agent-ui/components` (the barrel) + site
   libs only — a grep gate proves no deep `packages/**/src` import.
3. jsdom (`site/gallery.test.ts`): derived member list ≡ the `ALL_DESCRIPTORS` ui-* tag set (negative
   control: planted phantom fails) · filter = order-preserving subsequence · card node identity survives a
   filter toggle · the readout watch updates without re-running the host render effect · E2's ctx-less
   negative probe · E4 empty state · E8 zero-residue disconnect.
4. Browser (`site/gallery.browser.test.ts`, Chromium + WebKit): every non-overlay member's card specimen
   bounding box > 0 (the whole-shape law — asserted per member, derived, not sampled) · each `hasOpen`
   member opened-then-painted (E3) · the ONE `<theme-provider>`'s scale/density change a specimen's
   computed px and `scheme` flips used colors (anti-vacuous: assert both the change AND the default) ·
   the `theme` select renders exactly one option (`default`) and the attribute lands on the provider
   subtree (the wired-seam assertion) · forced-colors leg (E7, Chromium).
5. The site gates (`site-toc`/`site-coverage`/`site-nav`) stay green **unchanged** — the gallery joins as
   ungrouped, so their expected sets do not move.
6. `component-reviewer` GO (both applicable axes ≥ 4, zero blockers) recorded before the commit.

## 9 · Build sequence (checkpointed)

1. **s1** `galleryMembers()` + `node()` + their jsdom probes (no element yet) — checkpoint: list ≡ fleet.
2. **s2** `theme-provider.ts` (LLD-C4) + `ComponentGallery` (toolbar + provider + grid loop) +
   `gallery.css` — checkpoint: `check` green, manual render in `npm run dev`.
3. **s3** page + nav + the site-gate re-run — checkpoint: TOC/coverage/nav green unchanged.
4. **s4** jsdom gate file complete (incl. negative controls) — checkpoint: `npm test` green.
5. **s5** browser smoke (whole-shape · overlays-open · theme axes · forced-colors) — checkpoint:
   `npm run test:browser` green both engines.
6. **s6** `component-reviewer` dispatch; findings closed; commit.
