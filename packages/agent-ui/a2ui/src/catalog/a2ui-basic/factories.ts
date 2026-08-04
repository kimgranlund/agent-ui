// factories.ts — a2ui-basic widget factories (ADR-0169 cl.9/cl.9a/cl.9b): the upstream A2UI v0.9.1
// Basic Catalog's 14 INCLUDEd types (+ ChoicePicker's partial-include, cl.9b row 16) bound DIRECTLY to
// live `ui-*` (or sanctioned non-`ui-*` primitive) controls — no adapter layer (SPEC-R8; the default
// catalog still binds directly too — Basic is a SECOND catalog, never an adapter over the default,
// ADR-0169 cl.1/`default/factories.ts:4`).
//
// Every factory is wrapped in `withBasicCommon` (cl.9a) — the schema-wide `weight`/`accessibility`
// common props every upstream component carries. Three rows REUSE a default-catalog factory (Text,
// Card, Slider — cl.9b's own note: "import the default factory and wrap it — don't reimplement
// them"); every other row is bespoke, matching its cl.9b "Factory shape" cell.

import '@agent-ui/components/components' // self-defines ui-* controls on import (the default/factories.ts precedent)
import type { WidgetFactory } from '../types.ts'
import { textFactory, cardFactory, sliderFactory } from '../default/factories.ts'

// ── cl.9a — the schema-wide common-prop decorator, shown verbatim in ADR-0169 §9a ──────────────────

/**
 * Wrap a factory so it ALSO honors the two schema-wide common props every upstream component carries
 * (`CatalogComponentCommon.weight` — flex-grow, meaningful only under Row/Column; `ComponentCommon.
 * accessibility` — `{label?, description?}`, honored as LITERAL strings only v1, ADR-0169 §9a R7).
 * `aria-label`/`aria-description` are CONSUMER-side host attributes (the AOM precedence for an
 * agent-authored explicit label), distinct from the fleet's "ARIA via ElementInternals, never host
 * attributes" law, which governs what a COMPONENT sets on ITSELF.
 */
function withBasicCommon(base: WidgetFactory): WidgetFactory {
  return {
    ...base,
    applyProp: (el, prop, value) => {
      if (prop === 'weight') {
        el.style.flexGrow = value == null ? '' : String(value)
        return
      }
      if (prop === 'accessibility') {
        const a = (value ?? {}) as { label?: unknown; description?: unknown }
        if (typeof a.label === 'string') el.setAttribute('aria-label', a.label)
        if (typeof a.description === 'string') el.setAttribute('aria-description', a.description)
        return
      }
      base.applyProp(el, prop, value)
    },
  }
}

// Generic attribute fallback (the default catalog's `setAttr` precedent) — `null`/`undefined`/`false`
// clear the attribute; `true` sets the boolean-attribute form; everything else is string-coerced.
function setAttr(el: HTMLElement, name: string, value: unknown): void {
  if (value == null || value === false) el.removeAttribute(name)
  else if (value === true) el.setAttribute(name, '')
  else el.setAttribute(name, String(value))
}

function setProp(el: HTMLElement, prop: string, value: unknown): void {
  ;(el as unknown as Record<string, unknown>)[prop] = value
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ── cl.9b row 1 — Text → ui-text (REUSE) ────────────────────────────────────────────────────────────

export const basicTextFactory: WidgetFactory = withBasicCommon(textFactory)

// ── cl.9b row 2 — Image → <img> (bespoke, sanctioned non-`ui-*` primitive — the Option precedent) ─────

// The guide's §1 suggested dims per `variant` (an inline-style literal table — R1, no `ui-image`
// control to lean on yet). `mediumFeature` is the schema default.
const IMAGE_VARIANT_DIMS: Record<string, Partial<CSSStyleDeclaration>> = {
  icon: { inlineSize: '24px', blockSize: '24px' },
  avatar: { inlineSize: '40px', blockSize: '40px', borderRadius: '50%', objectFit: 'cover' },
  smallFeature: { inlineSize: '100px', blockSize: '100px' },
  mediumFeature: { inlineSize: '100%', maxInlineSize: '300px' },
  largeFeature: { inlineSize: '100%', maxBlockSize: '400px' },
  header: { inlineSize: '100%', blockSize: '200px', objectFit: 'cover' },
}
const IMAGE_STYLE_KEYS = ['inlineSize', 'blockSize', 'maxInlineSize', 'maxBlockSize', 'borderRadius', 'objectFit'] as const

/**
 * `Image` → `<img>` (cl.9b row 2). `url`→`src` (`safe-href`-validated, `Text.href`'s ADR-0114
 * arm); `description`→`alt`; `fit`→`el.style.objectFit` through the literal map (`scaleDown`→
 * `'scale-down'`, else pass-through); `variant`→the dims table above. Apply-order-independent: an
 * explicit `fit` re-asserts `objectFit` on every apply, so it always wins over whatever the variant's
 * OWN `objectFit` set, regardless of which prop applies second (the `Text.href`/`variant` precedent).
 */
export const imageFactory: WidgetFactory = withBasicCommon({
  tag: 'img',
  create: () => document.createElement('img'),
  applyProp: (el, prop, value) => {
    const img = el as HTMLImageElement
    switch (prop) {
      case 'url':
        img.src = value == null ? '' : String(value)
        break
      case 'description':
        img.alt = value == null ? '' : String(value)
        break
      case 'fit': {
        const map: Record<string, string> = { scaleDown: 'scale-down' }
        img.style.objectFit = value == null ? '' : (map[value as string] ?? String(value))
        break
      }
      case 'variant': {
        const dims = IMAGE_VARIANT_DIMS[value as string] ?? IMAGE_VARIANT_DIMS.mediumFeature!
        for (const key of IMAGE_STYLE_KEYS) img.style[key] = ''
        Object.assign(img.style, dims)
        break
      }
      default:
        setAttr(img, prop, value)
    }
  },
})

// ── cl.9b row 3 — Icon → ui-icon (bespoke; the closed 59-identifier enum → Phosphor glyph table) ──────

/** Upstream `Icon.name` (59 closed identifiers) → the canonical `@agent-ui/icons` glyph name (ADR-0066
 *  vendored subset, regenerated this wave to carry every value below — `icons.gen.ts`). An unmapped
 *  value (should not occur — the catalog enum already rejects it) degrades to `ui-icon`'s own
 *  missing-glyph behavior. */
export const ICON_NAME_TABLE: Record<string, string> = {
  accountCircle: 'user-circle',
  add: 'plus',
  arrowBack: 'arrow-left',
  arrowForward: 'arrow-right',
  attachFile: 'paperclip',
  calendarToday: 'calendar-blank',
  call: 'phone',
  camera: 'camera',
  check: 'check',
  close: 'x',
  delete: 'trash',
  download: 'download-simple',
  edit: 'pencil-simple',
  event: 'calendar-check',
  error: 'x-circle',
  fastForward: 'fast-forward',
  favorite: 'heart',
  favoriteOff: 'heart-break',
  folder: 'folder',
  help: 'question',
  home: 'house',
  info: 'info',
  locationOn: 'map-pin',
  lock: 'lock-simple',
  lockOpen: 'lock-simple-open',
  mail: 'envelope-simple',
  menu: 'list',
  moreVert: 'dots-three-vertical',
  moreHoriz: 'dots-three',
  notificationsOff: 'bell-slash',
  notifications: 'bell',
  pause: 'pause',
  payment: 'credit-card',
  person: 'user',
  phone: 'phone',
  photo: 'image',
  play: 'play',
  print: 'printer',
  refresh: 'arrow-clockwise',
  rewind: 'rewind',
  search: 'magnifying-glass',
  send: 'paper-plane-right',
  settings: 'gear',
  share: 'share-network',
  shoppingCart: 'shopping-cart',
  skipNext: 'skip-forward',
  skipPrevious: 'skip-back',
  star: 'star',
  starHalf: 'star-half',
  starOff: 'star', // approximation — no slashed star in Phosphor core (recorded, ADR-0169 §9b Icon table)
  stop: 'stop',
  upload: 'upload-simple',
  visibility: 'eye',
  visibilityOff: 'eye-slash',
  volumeDown: 'speaker-low',
  volumeMute: 'speaker-slash',
  volumeOff: 'speaker-none',
  volumeUp: 'speaker-high',
  warning: 'warning',
}

export const iconFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-icon',
  create: () => document.createElement('ui-icon'),
  applyProp: (el, prop, value) => {
    if (prop === 'name') setProp(el, 'glyph', ICON_NAME_TABLE[value as string] ?? value)
    else setAttr(el, prop, value)
  },
})

// ── cl.9b rows 6/7 — Row / Column → ui-row / ui-column (bespoke — the upstream justify/align enums) ───

const ROW_JUSTIFY_MAP: Record<string, string> = {
  spaceBetween: 'between',
  spaceAround: 'around',
  spaceEvenly: 'evenly',
  stretch: 'start', // `justify-content: stretch` behaves as `flex-start` in flexbox — behavior-identical
}

function rowColumnFactory(tag: string): WidgetFactory {
  return withBasicCommon({
    tag,
    create: () => document.createElement(tag),
    applyProp: (el, prop, value) => {
      if (prop === 'justify') setProp(el, 'justify', value == null ? value : (ROW_JUSTIFY_MAP[value as string] ?? value))
      else setProp(el, prop, value)
    },
  })
}
export const basicRowFactory: WidgetFactory = rowColumnFactory('ui-row')
export const basicColumnFactory: WidgetFactory = rowColumnFactory('ui-column')

// ── cl.9b row 8 — List → ui-list (bespoke — the horizontal-mode inline-flex override, R3) ─────────────

export const listFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-list',
  create: () => document.createElement('ui-list'),
  applyProp: (el, prop, value) => {
    if (prop === 'direction') {
      if (value === 'horizontal') {
        el.style.flexDirection = 'row'
        el.style.overflowX = 'auto'
      } else {
        el.style.flexDirection = ''
        el.style.overflowX = ''
      }
    } else {
      setProp(el, prop, value)
    }
  },
})

// ── cl.9b row 9 — Card → ui-card (REUSE) ────────────────────────────────────────────────────────────

export const basicCardFactory: WidgetFactory = withBasicCommon(cardFactory)

// ── cl.9b row 11 — Divider → div[role=separator] (bespoke, sanctioned non-`ui-*` primitive) ────────────

export const dividerFactory: WidgetFactory = withBasicCommon({
  tag: 'div[role=separator]',
  create: () => {
    const el = document.createElement('div')
    el.setAttribute('role', 'separator')
    return el
  },
  applyProp: (el, prop, value) => {
    if (prop !== 'axis') {
      setAttr(el, prop, value)
      return
    }
    const vertical = value === 'vertical'
    el.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal')
    el.style.backgroundColor = 'var(--md-sys-color-outline-variant)'
    if (vertical) {
      el.style.inlineSize = '1px'
      el.style.blockSize = ''
      el.style.alignSelf = 'stretch'
    } else {
      el.style.blockSize = '1px'
      el.style.inlineSize = '100%'
      el.style.alignSelf = ''
    }
  },
})

// ── cl.9b row 13 — Button → ui-button (bespoke — the upstream default|primary|borderless enum) ────────

const BUTTON_VARIANT_MAP: Record<string, string> = { primary: 'solid', default: 'soft', borderless: 'ghost' }

export const basicButtonFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-button',
  create: () => document.createElement('ui-button'),
  applyProp: (el, prop, value) => {
    // `action` never routes through applyProp — the renderer's action controller strips it before
    // widget resolution runs (renderer.ts `#actionPropsOf`, gated on `PropDef.mapsTo === 'action'`).
    if (prop === 'variant') setProp(el, 'variant', value == null ? value : (BUTTON_VARIANT_MAP[value as string] ?? value))
    else setProp(el, prop, value)
  },
})

// ── cl.9b row 14 — TextField → ui-text-field (bespoke — the shortText|longText|number|obscured enum) ──

const TEXTFIELD_TYPE_MAP: Record<string, string> = { shortText: 'text', number: 'number', obscured: 'password', longText: 'text' }

export const textFieldFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-text-field',
  create: () => document.createElement('ui-text-field'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'validationRegexp':
        break // DECLARED but v1-inert (ADR-0169 §9b row 14 — no fleet pattern-validation prop)
      case 'variant':
        setProp(el, 'type', value == null ? 'text' : (TEXTFIELD_TYPE_MAP[value as string] ?? 'text'))
        break
      default:
        setProp(el, prop, value)
    }
  },
})

// ── cl.9b row 15 — CheckBox → ui-checkbox (bespoke — the readProp:'checked' consumer, cl.7) ────────────

export const checkBoxFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-checkbox',
  create: () => document.createElement('ui-checkbox'),
  applyProp: (el, prop, value) => {
    if (prop === 'label') el.textContent = value == null ? '' : String(value)
    else if (prop === 'value') setProp(el, 'checked', value)
    else setProp(el, prop, value)
  },
  value: { prop: 'value', event: 'change', readProp: 'checked' },
})

// ── cl.9b row 16 — ChoicePicker → ui-select (PARTIAL INCLUDE — the marshal:'singletonStringList' consumer) ─

/** Reconcile `ui-select`'s control-owned `div[role=option]` children from the `options` array prop
 *  (cl.9b row 16 — options are a PROP, not a catalog `children` key; `ui-select` adopts direct
 *  light-DOM `[role=option]` children via its own TKT-0026 MutationObserver). A full rebuild on every
 *  apply — options is a whole-array bindable prop, the `Table.columns`/`Sparkline.values` precedent,
 *  never a per-item bind. */
function applyChoicePickerOptions(el: HTMLElement, value: unknown): void {
  const items = Array.isArray(value) ? value : []
  const fresh = items.map((item) => {
    const opt = document.createElement('div')
    opt.setAttribute('role', 'option')
    const label = isObject(item) && typeof item.label === 'string' ? item.label : ''
    const optionValue = isObject(item) && typeof item.value === 'string' ? item.value : ''
    opt.setAttribute('value', optionValue)
    opt.textContent = label
    return opt
  })
  el.replaceChildren(...fresh)
}

export const choicePickerFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-select',
  create: () => document.createElement('ui-select'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'label':
        setAttr(el, 'aria-label', value)
        break
      case 'variant': // declared (the E6 gate-encoded narrowed enum), never applied — no real target
      case 'displayStyle': // v1-inert (both arms render as the dropdown, the guide's own preference)
      case 'filterable': // v1-inert (declared, no filtering UI yet)
        break
      case 'options':
        applyChoicePickerOptions(el, value)
        break
      case 'value': {
        const list = Array.isArray(value) ? value : []
        setProp(el, 'value', typeof list[0] === 'string' ? list[0] : '')
        break
      }
      default:
        setAttr(el, prop, value)
    }
  },
  value: { prop: 'value', event: 'select', marshal: 'singletonStringList' },
})

// ── cl.9b row 17 — Slider → ui-slider (REUSE, thin `label`→`aria-label` wrapper) ────────────────────────

export const basicSliderFactory: WidgetFactory = withBasicCommon({
  ...sliderFactory,
  applyProp: (el, prop, value) => {
    if (prop === 'label') setAttr(el, 'aria-label', value)
    else sliderFactory.applyProp(el, prop, value)
  },
})

// ── cl.9b row 18 — DateTimeInput → ui-text-field (bespoke — the enableDate/enableTime → type table) ────

function dateTimeType(el: HTMLElement, prop: 'enableDate' | 'enableTime', value: unknown): void {
  const attr = prop === 'enableDate' ? 'data-enable-date' : 'data-enable-time'
  setAttr(el, attr, value === true ? true : undefined)
  const enableDate = el.hasAttribute('data-enable-date')
  const enableTime = el.hasAttribute('data-enable-time')
  // (T,F)→date · (F,T)→time · (T,T)→date (degrades to date-only, R5) · (F,F)→date
  setProp(el, 'type', enableTime && !enableDate ? 'time' : 'date')
}

export const dateTimeInputFactory: WidgetFactory = withBasicCommon({
  tag: 'ui-text-field',
  create: () => document.createElement('ui-text-field'),
  applyProp: (el, prop, value) => {
    if (prop === 'enableDate' || prop === 'enableTime') dateTimeType(el, prop, value)
    else setProp(el, prop, value)
  },
  value: { prop: 'value', event: 'change' },
})

/** The a2ui-basic catalog's factory table — keyed by upstream A2UI type (ADR-0169 cl.9b). Every type
 *  declared in `catalog.json` MUST appear here — a gap is `CATALOG_FACTORY_MISSING` at `register`
 *  (SPEC-R7 AC1, the same registry-enforced coverage `default/factories.ts` relies on). */
export const a2uiBasicFactories: Record<string, WidgetFactory> = {
  Text: basicTextFactory,
  Image: imageFactory,
  Icon: iconFactory,
  Row: basicRowFactory,
  Column: basicColumnFactory,
  List: listFactory,
  Card: basicCardFactory,
  Divider: dividerFactory,
  Button: basicButtonFactory,
  TextField: textFieldFactory,
  CheckBox: checkBoxFactory,
  ChoicePicker: choicePickerFactory,
  Slider: basicSliderFactory,
  DateTimeInput: dateTimeInputFactory,
}
