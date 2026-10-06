// control-record.ts: the shape of one entry in the generated control registry (ADR-0233).
//
// `registry.gen.ts` (written by `scripts/generate-controls.mjs`) maps every fleet tag to one record. A host
// that wants lazy loading reads the record instead of importing a whole-family barrel: `load()` imports the
// control's entry module (which self-defines its tag), `css` names its single sheet, and `uses` lists the
// other fleet tags its entry module imports (the descriptor's `uses:` block). A family entry that also
// self-defines sub-element tags (`ui-card` and its three regions) lists them in `defines`.

/** One fleet control in the generated registry. */
export interface ControlRecord {
  /** The custom-element tag, `ui-{name}`. */
  readonly tag: string
  /** Import the control's entry module, which self-defines `tag` on first import. */
  load(): Promise<unknown>
  /** The control's single sheet, relative to `src/controls/` (`./{folder}/{name}.css`). */
  readonly css?: string
  /** The other fleet tags the entry module imports, sorted (the descriptor's `uses:` block). */
  readonly uses?: readonly string[]
  /**
   * The sub-element tags the entry module also self-defines on import, sorted (the descriptor's `defines:`
   * block). Absent when there are none. Each is a tag with no record of its own, so a host that serves a
   * sub-tag loads this record's module.
   */
  readonly defines?: readonly string[]
}
