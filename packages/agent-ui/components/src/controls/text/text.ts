// text.ts — UITextElement, the Display-class text primitive (ADR-0078, supersedes ADR-0025's prop schema
// + heading path). BEHAVIOUR + props + stamping + self-define ONLY.
//
// Three orthogonal axes (ADR-0078 cl.1): `variant` (the visual type ROLE — which --md-sys-typescale-*
// block text.css repoints to), `size` (sm/md/lg — the row within the role), and `as` (document SEMANTICS —
// the real element STAMPED around the light-DOM children). `variant`/`size` carry zero semantics now;
// `as` alone does — the honest split ADR-0025's conflated `variant="h4"` (visual ROLE + heading level in
// one knob) could not make.
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
} satisfies PropsSchema

export interface UITextElement extends ReactiveProps<typeof props> {}
export class UITextElement extends UIElement {
  static props = props

  // The stamp — the one real element wrapping the light-DOM content while `as ≠ none`; null otherwise
  // (cl.4's invariant). `#`-private: nothing outside the host can observe or hold it.
  #stamp: HTMLElement | null = null
  // The childList observer that heals the invariant (parser streaming / textContent clobber — #heal).
  // Disconnected in `disconnected()` — the same "zero residue after removal" discipline `this.effect` /
  // `this.listen` give for free, applied by hand since a raw platform observer isn't scope-owned.
  #observer: MutationObserver | null = null

  protected connected(): void {
    // (1) The restamp effect — runs now (the initial `as`) and again on every `as` change (scope-owned,
    // so it dies with the connection — the button.ts ariaDisabled-effect precedent).
    this.effect(() => this.#restamp(this.as))
    // (2) The heal observer — installed AFTER the initial restamp above, so it never observes its own
    // synchronous setup; it only fires for LATER host mutations (parser streaming, an external write).
    this.#observer = new MutationObserver(() => this.#heal())
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
}

if (!customElements.get('ui-text')) customElements.define('ui-text', UITextElement)
