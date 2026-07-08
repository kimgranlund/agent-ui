// text.ts — UITextElement, the Display-class text primitive (ADR-0078, supersedes ADR-0025's prop schema
// + heading path). BEHAVIOUR + props + stamping + self-define ONLY.
//
// Five orthogonal axes (ADR-0078 cl.1 + ADR-0106 + ADR-0109): `variant` (the visual type ROLE — which
// --md-sys-typescale-* block text.css repoints to), `size` (sm/md/lg — the row within the role), `as`
// (document SEMANTICS — the real element STAMPED around the light-DOM children), `truncate` (ADR-0106 —
// overflow INTENT: single-line + ellipsis, CSS-only), and `emphasis` (ADR-0109 — weight INTENT: the
// platform bold register, CSS-only). `variant`/`size` carry zero semantics now; `as` alone does — the
// honest split ADR-0025's conflated `variant="h4"` (visual ROLE + heading level in one knob) could not
// make.
//
// `truncate` (ADR-0106) is CSS-only by Kim's explicit ratification ruling — no box-size measurement, no
// dimension-watching observer of any kind installed anywhere in this file (a grep-able absence is the
// ADR's own Acceptance leg — this file must never name the platform API that watches element box size).
// While `truncate` is set, the element mirrors its own trimmed `textContent` onto `title` UNCONDITIONALLY
// (present even when the text isn't actually clipped — the accepted CSS-only cost), riding the EXISTING
// render/childList observer below rather than a bespoke measurement path; an author-set `title` is never
// overwritten (presence-checked before the mirror's first write — the mirror only ever owns a title it
// minted itself).
//
// `emphasis` (ADR-0109) is schema-only — a reflected boolean, zero behavior code in this file. The
// `[emphasis]` CSS hook (text.css) repoints `--ui-text-weight` to 700 (the platform bold register);
// `font-weight` inherits, so the ADR-0078 cl.4 stamp-transparency reset already carries it into any
// stamped element for free — no second stamp leg, no observer, no effect (contrast `truncate`, whose
// non-inheriting overflow properties needed one).
//
// Content model — host-as-content STANDS (ADR-0006 + ADR-0025 cl.2): the user's light-DOM children remain
// the displayed text and the accessible name; there is still no `text` prop and no `html``` template, so
// `render()` stays the inherited void. The DEPARTURE (ADR-0078 cl.4): when `as ≠ none`, those children are
// wrapped in one real semantic element (the "stamp") — a scope-owned DOM-adoption effect, NOT the template
// system (a template would clobber the user-owned content ADR-0025 cl.2 chose void `render()` to protect).
//
// Stamping mechanism (cl.4 / B3): a connected() effect off `as` creates/replaces/unwraps the stamp, moving
// nodes — never cloning them (node identity, ADR-0022). A childList MutationObserver on the host heals the
// invariant whenever nodes land directly on the host: (a) a parser-streamed `<ui-text as="h4">…` connects
// BEFORE its children exist, so they arrive as host children; (b) the A2UI `textFactory` / any bound
// `text:{path}` write sets `host.textContent`, which destroys every child (stamp included) — the observer
// detects the detached stamp and re-stamps fresh around the new content. Both converge within a microtask;
// `as="none"` never installs a stamp at all (byte-identical DOM to today).
//
// Semantics move to the platform (cl.4): a stamped `<h4>` IS the heading (name = its content, free); the
// ADR-0025 cl.4 ElementInternals path (role=heading + ariaLevel driven by `variant`) is deleted outright —
// keeping an internals role beside a real heading child would double-announce.
//
// Display size-class (ADR-0025 cl.1): no control height, no padding-block law, no frame. `user-select` is
// ENABLED (display text is selectable — the deliberate inverse of ui-button, which disables it).
//
// Imports inward only (controls → dom): UIElement + prop + the typed-schema helpers from the dom barrel.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  // The visual type ROLE (which --md-sys-typescale-* block text.css repoints to) — the five M3 roles +
  // four editorial extras (ADR-0078 cl.1/cl.2b). Zero semantic effect; REFLECTS so the [variant] repoint
  // in text.css applies to JS-set values too (the ui-button `variant`/`size` precedent).
  variant: {
    ...prop.enum(
      ['display', 'headline', 'title', 'body', 'label', 'kicker', 'overline', 'quote', 'lead'] as const,
      'body',
    ),
    reflect: true,
  },
  // The size WITHIN the role (which row of the block) — orthogonal to variant; every 9×3 cell is defined
  // (cl.1). `md` is the universal default for every role.
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // Document SEMANTICS — the real element STAMPED around the light-DOM children (cl.4). `none` = no
  // wrapper: the host itself is the styled node, the 80% display case, byte-identical to today's DOM.
  as: {
    ...prop.enum(['none', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'blockquote'] as const, 'none'),
    reflect: true,
  },
  // Overflow INTENT (ADR-0106) — the fourth orthogonal axis: single-line + ellipsis, CSS-only (text.css's
  // `[truncate]` legs do the clipping). Reflects so the `[truncate]` CSS hook applies to JS-set values too
  // (the variant/size/as precedent). Default `false` keeps today's wrapping — no shipped rendering change.
  truncate: { ...prop.boolean(false), reflect: true },
  // Weight INTENT (ADR-0109) — the fifth orthogonal axis: bold, CSS-only (text.css's `[emphasis]`
  // token-block repoint does the work; no styles-block change, no stamp leg — weight inherits). Reflects
  // so the `[emphasis]` CSS hook applies to JS-set values too (the variant/size/as/truncate precedent).
  // Default `false` keeps today's rendering — no shipped visual change.
  emphasis: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UITextElement extends ReactiveProps<typeof props> {}
export class UITextElement extends UIElement {
  static props = props

  // The stamp — the one real element wrapping the light-DOM content while `as ≠ none`; null otherwise
  // (cl.4's invariant). `#`-private: nothing outside the host can observe or hold it.
  #stamp: HTMLElement | null = null
  // The childList observer that heals the invariant (parser streaming / textContent clobber — #heal), and
  // — the SAME observer, no second one (ADR-0106) — the content-change trigger for the `title` mirror.
  // Disconnected in `disconnected()` — the same "zero residue after removal" discipline `this.effect` /
  // `this.listen` give for free, applied by hand since a raw platform observer isn't scope-owned.
  #observer: MutationObserver | null = null
  // Whether the CURRENT `title` attribute is one this instance minted (ADR-0106 cl.3). Gates both halves
  // of the "never overwrite an author-set title" rule: unset while `false` (nothing to remove on
  // `truncate` unset, nothing owned to overwrite on the next mint check).
  #titleMinted = false
  /** The exact string the mirror last minted — ownership is checked by VALUE, not just a flag, so an
   *  author who sets `title` AFTER a mint is never clobbered on the next sync (review-hardened: the
   *  ADR's "the mirror owns only titles it minted" implemented literally). */
  #mintedValue: string | null = null

  protected connected(): void {
    // (1) The restamp effect — runs now (the initial `as`) and again on every `as` change (scope-owned,
    // so it dies with the connection — the button.ts ariaDisabled-effect precedent).
    this.effect(() => this.#restamp(this.as))
    // (2) The title-mirror effect (ADR-0106) — runs now (the initial `truncate`) and again on every
    // `truncate` change: mints/removes the mirror. Content-change updates (the text itself changing while
    // `truncate` stays set) ride the heal observer below, not this effect.
    this.effect(() => this.#syncTitle(this.truncate))
    // (3) The heal observer — installed AFTER the initial restamp/title-sync above, so it never observes
    // its own synchronous setup; it only fires for LATER host mutations (parser streaming, an external
    // write, or a bound-text `textContent` clobber) — the ONE existing render/childList path both #heal
    // and the title mirror ride (ADR-0106 cl.3 — no second observer).
    this.#observer = new MutationObserver(() => {
      this.#heal()
      this.#syncTitle(this.truncate)
    })
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /**
   * Create/replace/unwrap the stamp for `tag`. Moves nodes — never clones them (node identity, ADR-0022):
   * `none` unwraps (`replaceWith(...childNodes)` drops the stamp's content back into the host at the
   * stamp's own position, in one call — no reflow of order); a same-tag call is a no-op; otherwise a fresh
   * element is created, the current content nodes are moved into it, and it takes the old stamp's place
   * (or is appended, when there was no prior stamp).
   */
  #restamp(tag: UITextElement['as']): void {
    const prev = this.#stamp
    if (tag === 'none') {
      if (prev) {
        prev.replaceWith(...prev.childNodes)
        this.#stamp = null
      }
      return
    }
    if (prev?.localName === tag) return // already the right element — no-op
    const next = document.createElement(tag)
    const source = prev ?? this
    while (source.firstChild) next.appendChild(source.firstChild) // move, never clone (the modal.ts precedent)
    if (prev) prev.replaceWith(next)
    else this.appendChild(next)
    this.#stamp = next
  }

  /**
   * Restore the invariant after a childList mutation lands directly on the host. A DETACHED stamp (the
   * `host.textContent` clobber — every child, stamp included, replaced by one fresh text node) is nulled
   * and re-stamped fresh — never reused, it holds stale content. Otherwise every stray host child (parser-
   * streamed content arriving after connect) is adopted into the stamp, append order. Both branches mutate
   * the host and so re-fire this very observer, but the next delivery finds the invariant satisfied — a
   * no-op — so this self-converges within ≤2 passes; it can never loop forever.
   */
  #heal(): void {
    const stamp = this.#stamp
    if (!stamp) return
    if (stamp.parentNode !== this) {
      this.#stamp = null
      this.#restamp(this.as)
      return
    }
    for (const node of Array.from(this.childNodes)) {
      if (node !== stamp) stamp.appendChild(node)
    }
  }

  /**
   * The unconditional `title` mirror (ADR-0106 cl.3, Kim's CSS-only ratification ruling — "truncate should
   * be CSS-only solution. no resize-observer overkill"). While `truncate` is set, `title` tracks this
   * element's own trimmed `textContent` — UNCONDITIONALLY, whether or not the text is actually clipped
   * (no measurement, no dimension-watching observer: the accepted cost of staying measurement-free on a
   * Display leaf).
   * An author-set `title` is never overwritten: presence-checked before the mirror's first write, so once
   * a real author title is found the mirror steps back permanently (until that attribute is removed,
   * freeing the mirror to mint one). The mirror only ever REMOVES a title IT minted (`#titleMinted`).
   */
  #syncTitle(truncate: boolean): void {
    const current = this.getAttribute('title')
    // Ownership by VALUE: the mirror owns the title only while it still holds the exact string it
    // minted. An author write at ANY time (before the first mint or after one) diverges the value and
    // the mirror steps back permanently (until the author removes the attribute).
    const mirrorOwns = this.#titleMinted && current === this.#mintedValue
    if (!truncate) {
      if (mirrorOwns) this.removeAttribute('title')
      this.#titleMinted = false
      this.#mintedValue = null
      return
    }
    if (current !== null && !mirrorOwns) return // author-owned — never overwritten
    const next = (this.textContent ?? '').trim()
    this.setAttribute('title', next)
    this.#titleMinted = true
    this.#mintedValue = next
  }
}

if (!customElements.get('ui-text')) customElements.define('ui-text', UITextElement)
