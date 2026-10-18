/** Type surface for scale.mjs, the repo's own resolver: the mathematical-design-system skill's former reference
 *  implementation (ADR-0245 clause 1, Amendment 3, sha 3c319761), frozen here since the skill moved on. It is not the
 *  skill's `lib/legacy-scale.mjs`; the skill's current resolver is vendored under vendor/mathematical-design-system/
 *  (T-0372). The `.mjs` stays untouched; its types live here. */
export type Step = 'sm' | 'md' | 'lg'
export type Tier = 'widget' | 'product' | 'content' | 'brand'
export type Density = 'compact' | 'default' | 'spacious'
export type Role =
  | 'display' | 'heading' | 'subhead' | 'sectionLabel' | 'title' | 'body' | 'control' | 'fieldLabel' | 'groupLabel'
/** The ladder of levels, in order; `tray`, `lane` and `shell` are reserved (no tokens) and sit under `reserved`. */
export type LevelName = 'chip' | 'control' | 'group' | 'widget' | 'card' | 'page'
export type ReservedLevel = 'tray' | 'lane' | 'shell'

export interface Level {
  readonly margin: number
  readonly gutter: number
  readonly radius: number
}

/** The component sizes the skill derives from n alone (section 2); M7 and M14 cover them. */
export interface Parts {
  readonly checkbox: number
  readonly checkboxRadius: number
  readonly check: number
  readonly radio: number
  readonly radioDot: number
  readonly switchTrack: number
  readonly switchThumb: number
  readonly switchWidth: number
  readonly badge: number
  readonly avatar: number
  readonly avatarInline: number
  readonly iconTile: number
  readonly progress: number
  readonly tableRow: number
  readonly fieldGutter: number
}

export interface Resolved extends Readonly<Record<LevelName, Level>> {
  readonly tier: string
  readonly scale: string
  readonly size: string
  readonly density: string
  readonly n: number
  /** The container unit: n moved one tier step `a` by density, floored (widget, card and page read it). */
  readonly m: number
  readonly h: number
  readonly minWidth: number
  readonly labelMargin: number
  readonly icon: number
  readonly c: number
  readonly glyph: number
  readonly type: Readonly<Record<Role, number>>
  readonly parts: Parts
  readonly reserved: Readonly<Record<ReservedLevel, Level>>
}

export const CFG: {
  ladder: [number, number]
  tiers: Record<Tier, [number, number, number, number]>
  density: Record<Density, number>
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupLabel', [number, number]>
  Q: [number, number]
  sectionRatio: number
  titleBump: Record<Step, number>
  floor: number
  /** wrap (`base`, `tight` or `roomy`), the child level it wraps, and `reserved` when it has no tokens. */
  levels: Record<LevelName | ReservedLevel, [string, string?, string?]>
}

export function resolve(tier?: string, scale?: string, size?: string, density?: string): Resolved
export function check(): string[]
