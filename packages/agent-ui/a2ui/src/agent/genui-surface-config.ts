// genui-surface-config.ts — genui-surface.spec.md SPEC-R10: the per-turn "may this turn emit GenUI" signal.
// A NEW, orthogonal on/off axis — deliberately NOT a `GenUiMode` member and never threaded through it
// (genui-surface SPEC §4 N2: `GenUiMode`, ADR-0090, is a DIFFERENT axis — the per-turn prompt-DISPOSITION
// scale for A2UI catalog composition (`default`/`specific`/`blue-sky`); this is "is the free-form GenUI
// surface available on this turn at all", independent of that disposition). Shared by `system-prompt.ts`
// (composes the genui teaching block, SPEC-R10) and `produce.ts` (`ProduceOptions.genuiSurface`) so the two
// carry exactly one type between them, never two hand-duplicated shapes.
//
// Zero-dep, pure (SPEC-N1): no imports.

/** Whether/how the GenUI modality is available for this turn. `enabled: false` (or the option omitted
 *  entirely in `ProduceOptions`) composes ZERO genui-teaching bytes into the system prompt — the
 *  degradation law (SPEC-R10): the modality being off is byte-identical to today's pre-GenUI composition.
 *  `sourceBody`, when present, is the picked pattern-source pack's body (SPEC-R11 D3 — a single pick,
 *  never a pack id the producer looks up itself: the admin's picked library-pack ENTRY already carries the
 *  exemplar body verbatim, `genuiPackLibrary`'s own projection law) — composed into the SAME genui block,
 *  after the fixed wire/sandbox-reality teaching. Absent ⇒ the base block alone (SPEC-R10's degradation
 *  law: no source picked ⇒ the modality still works, just without pattern-source conditioning).
 *
 *  `exclusive`, when `true`, names a per-turn CONSUMER FACT, not a stylistic preference: this turn's caller
 *  has NO A2UI rendering path at all — a GenUI-only surface (e.g. a demo page that only mounts a sandboxed
 *  frame, never an A2UI catalog renderer). The base teaching's own "A2UI stays your default... reach for
 *  genui only when the catalog genuinely cannot express the shape" framing (`prompts/genui-teaching.md`) is
 *  correct ONLY for a consumer that can render BOTH modalities (the PRD §6 coexistence model this SPEC was
 *  written for, e.g. agent-admin's Surface Options). For an `exclusive` consumer that framing actively
 *  misleads the model: any A2UI JSONL it emits validates and ships on the wire, but is STRUCTURALLY
 *  invisible to that consumer (the SAME disjointness check that keeps a genui line out of `validateA2ui`
 *  also keeps a real A2UI line out of `readGenuiLine` — a genui-only client's `readGenuiLine`-then-drop loop
 *  silently discards it, never an error). `genuiBlock` (`system-prompt.ts`) appends an explicit override
 *  paragraph naming this fact when `exclusive` is set. Absent/`false` ⇒ byte-identical to before this field
 *  existed (the `sourceBody`-absent precedent) — every existing coexistence caller (agent-admin) is
 *  unaffected. */
export interface GenuiSurfaceConfig {
  enabled: boolean
  sourceBody?: string
  exclusive?: boolean
}
