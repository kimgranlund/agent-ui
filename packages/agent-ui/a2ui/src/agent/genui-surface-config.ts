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
 *  law: no source picked ⇒ the modality still works, just without pattern-source conditioning). */
export interface GenuiSurfaceConfig {
  enabled: boolean
  sourceBody?: string
}
