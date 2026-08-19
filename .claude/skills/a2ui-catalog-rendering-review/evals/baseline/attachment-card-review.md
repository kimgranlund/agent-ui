**Card renders; both panes are technically correct but the specimen is empty.** Evidence: `/tmp/att-shot/dark/WIDGET/Attachment.png` (repo script `scripts/screenshot-a2ui-catalog.mjs --only Attachment`).

🟡 **Props panel — right shape, no seed.** All four knobs match the catalog row (`catalog/default/catalog.json`: `name`/`mimeType`/`href` string, `sizeBytes` number → correctly a number spinner). But every field is blank: `Attachment` has no entry in `A2UI_INITIAL` (`site/lib/component-preview.ts:223-289`). That table exists precisely because "a2ui mode carries NO defaults in the catalog… a bare specimen would render empty" — Attachment was never added.

🟡 **Rendered surface — legible but degenerate.** With no props, `ui-attachment` falls through its own documented fallbacks (`attachment.ts:51-53`): generic file glyph, `filename || categoryLabel(category)` → the literal word "File", and no meta cell (`sizeBytes` null ⇒ cell absent, by design). So the canvas is honest output of an empty payload — it just teaches nothing about what the component does. A seed like `{ name: 'quarterly-report.pdf', mimeType: 'application/pdf', sizeBytes: '284913' }` would show glyph + name + formatted size, i.e. the control's real job.

🟡 **`href` knob is inert.** The catalog wires `href` (`format: 'safe-href'`), but the component deliberately does not render it — LLD-C6 (name-cell → `<a>`) is deferred (`attachment.ts:16-20`, `factories.ts:788-791`). Editing that knob changes nothing on the right, with no indication why.

🟡 **No "See it in real use" line** — no example seed renders `Attachment`, unlike its siblings.

🟢 Not Attachment-specific: `Avatar` (and the rest of the ADR-0112 feed family) has the same empty-seed problem — Avatar renders a bare 16px person glyph. This is one class defect, worth one issue covering the family.
