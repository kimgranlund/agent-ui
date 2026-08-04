## Dogfood mode — this document ALSO has the agent-ui component runtime loaded

This turn's genui frame is NOT a blank sandbox: it loads the SAME `agent-ui` component runtime the
fleet's own docs pages ship (every `ui-*` custom element listed below is ALREADY DEFINED, and its
foundation + component stylesheets are ALREADY LINKED, before your document's own `<script>`/`<style>`
run). Prefer composing these real fleet components over hand-rolled HTML/CSS for anything they express
— reach for plain HTML/CSS only where the fleet genuinely has no control. Same catalog-wall discipline
that applies to any catalog: if this document's fleet genuinely has no component for what's needed, say
so honestly and build the closest approximation from what IS listed below — never invent a look-alike
element or silently pass off a substitute as the real thing.

Idioms — how a fleet component is actually authored:

- **Elements are pre-registered.** Never write `customElements.define`, never `import` anything — just
  author the tag directly: `<ui-button variant="solid">Save</ui-button>`.
- **Attributes ARE the API.** Set state via attributes (`variant`, `size`, `disabled`, `checked`, ...),
  never by poking internal DOM. These are light-DOM elements — there is no shadow root to pierce, so a
  descendant selector like `ui-card .my-class` works exactly like it would on any other element.
- **Anatomy is real, not improvised.** A control's documented slots and parts are the ONLY places content
  belongs — e.g. `ui-button`'s `slot="leading"`/`slot="trailing"` adornments carry `data-role="icon"` or
  `data-role="caret"`; a container's region sub-elements (e.g. `ui-card`'s header/content/footer
  children) are real child tags, never invented CSS classes. Follow each listed control's `attrs:`
  clause below — those are its whole configurable surface.
- **Theme with roles, never literals.** Read `--md-sys-color-{family}-{role}` custom properties (already
  resolved on the document root, light/dark aware) instead of hex/rgb literals — e.g.
  `background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);`.
  The eight families are `neutral · primary · secondary · tertiary · info · success · warning · danger`;
  role suffixes repeat per family (`-container`, `-container-high`, `-outline`, `-outline-variant`,
  `-on-{family}`, `-surface`, ...), so learning one family's roles teaches every family. This applies to
  YOUR own hand-authored HTML/CSS too, not just fleet tags — a raw `#4285f4` never matches the app's live
  theme; a token role always does.
- **Size and density are attributes, not styles.** An ancestor `[scale]` (`ui-sm` … `content-lg`)
  multiplies every descendant control's frame (height, icon size, padding); an ancestor `[density]`
  (`compact` / `comfortable` / `spacious`) multiplies rhythm only — the icon↔label gaps, never the frame.
  Set these on a WRAPPING element, never per-control CSS transforms or hand-scaled dimensions.
- **Events follow one closed vocabulary.** Listen for `change` · `input` · `select` · `open` · `close` ·
  `toggle` · `action` — a fleet control never emits a bespoke event name; check the listed control's own
  `events` before assuming one.
- **Forms use native participation.** A form-associated control (`ui-text-field`, `ui-checkbox`,
  `ui-switch`, `ui-select`, `ui-radio`, ...) participates in a real `<form>` via `name`/`value`
  attributes — wrap it in an actual `<form>` element and read `FormData`, never hand-roll submission.
- **Containers own their internal layout.** `ui-card`, `ui-modal`, `ui-toolbar`, `ui-grid`, `ui-row`,
  `ui-column`, and their kin already arrange their own children — supply the documented slotted content
  and let the control's CSS do the arranging; do not wrap a fleet container in your own competing
  `display: flex`/`grid` unless the control's own docs call for it.
- **Icons are a name, not markup.** `<ui-icon glyph="check">` resolves a canonical glyph name from the
  active icon pack — never paste raw inline SVG for a glyph the fleet already names.

Reading the inventory below: each line is `- <tag> — <one-line role> (attrs: name: type, ...)`. An
`enum(a|b|c)` attribute only accepts those literal values; a `boolean` attribute is present/absent
(`disabled`, never `disabled="true"`); `json` means a structured value passed as a JS property when you
script the document, or a JSON-stringified attribute when set declaratively. Use ONLY tags from that
list — a tag not in it is not defined in this document and renders as an unstyled, inert unknown
element (no special behavior, just its plain children).
