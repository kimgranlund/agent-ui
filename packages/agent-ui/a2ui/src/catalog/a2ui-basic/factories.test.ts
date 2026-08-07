// factories.test.ts — a2ui-basic per-factory mapping tests (the default/factories.test.ts pattern),
// incl. the Icon-table resolution gate (ADR-0169 cl.9 Icon row): every `ICON_NAME_TABLE` value must
// resolve against the registered phosphor pack.

import { describe, it, expect } from 'vitest'
import {
  a2uiBasicFactories,
  basicTextFactory,
  imageFactory,
  iconFactory,
  ICON_NAME_TABLE,
  basicRowFactory,
  basicColumnFactory,
  listFactory,
  basicCardFactory,
  dividerFactory,
  basicButtonFactory,
  textFieldFactory,
  checkBoxFactory,
  choicePickerFactory,
  choicePickerMultiFactory,
  choicePickerVariants,
  basicSliderFactory,
  dateTimeInputFactory,
} from './factories.ts'
import { a2uiBasicCatalog } from './index.ts'
import { Registry, RegistryError, RegistryErrorCode } from '../registry.ts'
import { resolveFactory, factoriesOf } from '../variant.ts'
import type { A2uiComponent } from '../../protocol.ts'
import { phosphorPack } from '@agent-ui/icons/phosphor'

describe('a2ui-basic factories — table parity (ADR-0169 cl.9)', () => {
  it('declares exactly one factory per catalog component type — no gap, no extra', () => {
    expect(Object.keys(a2uiBasicFactories).sort()).toEqual(Object.keys(a2uiBasicCatalog.components).sort())
  })

  it('registers cleanly against the real Registry (0 CATALOG_FACTORY_MISSING)', () => {
    const reg = new Registry()
    expect(() => reg.register(a2uiBasicCatalog, a2uiBasicFactories)).not.toThrow()
    expect(reg.supportedCatalogIds()).toContain('a2ui-basic')
  })

  it('NEGATIVE: a catalog type with no factory throws CATALOG_FACTORY_MISSING', () => {
    const reg = new Registry()
    const { Button: _omitted, ...factoriesMissingButton } = a2uiBasicFactories
    let thrown: unknown
    try {
      reg.register(a2uiBasicCatalog, factoriesMissingButton)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RegistryError)
    expect((thrown as RegistryError).code).toBe(RegistryErrorCode.FACTORY_MISSING)
  })
})

describe('a2ui-basic factories — cl.9a common props apply on every factory', () => {
  it('weight → el.style.flexGrow; accessibility → aria-label/aria-description', () => {
    // `factoriesOf` (GH #545) flattens `ChoicePicker`'s `VariantDispatch` slot to its two concrete arms
    // (`choicePickerFactory` + `choicePickerMultiFactory`) — every other slot is already a plain
    // `WidgetFactory`, a one-element loop, byte-identical to the pre-#545 direct iteration.
    for (const [name, slot] of Object.entries(a2uiBasicFactories)) {
      for (const factory of factoriesOf(slot)) {
        const el = factory.create()
        factory.applyProp(el, 'weight', 2)
        expect(el.style.flexGrow, `${name}.weight`).toBe('2')
        factory.applyProp(el, 'weight', null)
        expect(el.style.flexGrow, `${name}.weight reset`).toBe('')

        factory.applyProp(el, 'accessibility', { label: 'A label', description: 'A description' })
        expect(el.getAttribute('aria-label'), `${name}.accessibility.label`).toBe('A label')
        expect(el.getAttribute('aria-description'), `${name}.accessibility.description`).toBe('A description')
      }
    }
  })
})

describe('a2ui-basic factories — Text (REUSE)', () => {
  it('Text → ui-text, text maps to textContent (the reused default textFactory, wrapped)', () => {
    expect(basicTextFactory.tag).toBe('ui-text')
    const el = basicTextFactory.create()
    basicTextFactory.applyProp(el, 'text', 'Hello upstream')
    expect(el.textContent).toBe('Hello upstream')
  })
})

describe('a2ui-basic factories — Image (bespoke, <img> primitive)', () => {
  it('Image → <img>; url→src, description→alt, fit→objectFit, variant→dims table', () => {
    expect(imageFactory.tag).toBe('img')
    const el = imageFactory.create() as HTMLImageElement
    imageFactory.applyProp(el, 'url', 'https://example.com/pic.png')
    expect(el.src).toBe('https://example.com/pic.png')
    imageFactory.applyProp(el, 'description', 'A picture')
    expect(el.alt).toBe('A picture')
    imageFactory.applyProp(el, 'fit', 'scaleDown')
    expect(el.style.objectFit).toBe('scale-down')
    imageFactory.applyProp(el, 'variant', 'avatar')
    expect(el.style.borderRadius).toBe('50%')
  })
})

describe('a2ui-basic factories — Icon (bespoke, ICON_NAME_TABLE resolution gate)', () => {
  it('every ICON_NAME_TABLE value resolves against the registered phosphor pack (the fleet ADR-0066 vendored subset)', () => {
    for (const [upstream, glyph] of Object.entries(ICON_NAME_TABLE)) {
      expect(Object.hasOwn(phosphorPack.icons, glyph), `${upstream} → ${glyph}`).toBe(true)
    }
  })

  it('the table carries all 59 upstream identifiers', () => {
    expect(Object.keys(ICON_NAME_TABLE).length).toBe(59)
  })

  it('name → glyph (through the table)', () => {
    const el = iconFactory.create()
    iconFactory.applyProp(el, 'name', 'accountCircle')
    expect((el as unknown as { glyph?: unknown }).glyph).toBe('user-circle')
  })
})

describe('a2ui-basic factories — Row/Column (bespoke justify/align enums)', () => {
  it('the spaceBetween/spaceAround/spaceEvenly/stretch justify renames apply; other values pass through', () => {
    for (const factory of [basicRowFactory, basicColumnFactory]) {
      const el = factory.create()
      factory.applyProp(el, 'justify', 'spaceBetween')
      expect((el as unknown as { justify?: unknown }).justify).toBe('between')
      factory.applyProp(el, 'justify', 'stretch')
      expect((el as unknown as { justify?: unknown }).justify).toBe('start')
      factory.applyProp(el, 'justify', 'center')
      expect((el as unknown as { justify?: unknown }).justify).toBe('center')
    }
  })
})

describe('a2ui-basic factories — List (bespoke horizontal-mode inline-flex override)', () => {
  it('direction:"horizontal" sets row + overflow-x:auto; absent/vertical clears both', () => {
    const el = listFactory.create()
    listFactory.applyProp(el, 'direction', 'horizontal')
    expect(el.style.flexDirection).toBe('row')
    expect(el.style.overflowX).toBe('auto')
    listFactory.applyProp(el, 'direction', 'vertical')
    expect(el.style.flexDirection).toBe('')
    expect(el.style.overflowX).toBe('')
  })
})

describe('a2ui-basic factories — Card (REUSE)', () => {
  it('Card → ui-card', () => {
    expect(basicCardFactory.tag).toBe('ui-card')
  })
})

describe('a2ui-basic factories — Divider (bespoke, sanctioned div[role=separator] primitive)', () => {
  it('axis:"vertical" sets aria-orientation + inline dims; default is horizontal', () => {
    expect(dividerFactory.tag).toBe('div[role=separator]')
    const el = dividerFactory.create()
    expect(el.getAttribute('role')).toBe('separator')
    dividerFactory.applyProp(el, 'axis', 'vertical')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
    expect(el.style.inlineSize).toBe('1px')
    dividerFactory.applyProp(el, 'axis', 'horizontal')
    expect(el.getAttribute('aria-orientation')).toBe('horizontal')
    expect(el.style.blockSize).toBe('1px')
  })
})

describe('a2ui-basic factories — Button (bespoke default|primary|borderless enum)', () => {
  it('the upstream variant enum maps to the fleet variant tokens', () => {
    const el = basicButtonFactory.create()
    basicButtonFactory.applyProp(el, 'variant', 'primary')
    expect((el as unknown as { variant?: unknown }).variant).toBe('solid')
    basicButtonFactory.applyProp(el, 'variant', 'default')
    expect((el as unknown as { variant?: unknown }).variant).toBe('soft')
    basicButtonFactory.applyProp(el, 'variant', 'borderless')
    expect((el as unknown as { variant?: unknown }).variant).toBe('ghost')
  })
})

describe('a2ui-basic factories — TextField (bespoke shortText|longText|number|obscured enum, validationRegexp v1-inert)', () => {
  it('the upstream variant enum maps to ui-text-field.type', () => {
    const el = textFieldFactory.create()
    textFieldFactory.applyProp(el, 'variant', 'obscured')
    expect((el as unknown as { type?: unknown }).type).toBe('password')
    textFieldFactory.applyProp(el, 'variant', 'number')
    expect((el as unknown as { type?: unknown }).type).toBe('number')
    textFieldFactory.applyProp(el, 'variant', 'longText')
    expect((el as unknown as { type?: unknown }).type).toBe('text') // DEGRADES to single-line (R4)
  })

  it('validationRegexp is declared but v1-inert — applying it has NO DOM effect', () => {
    const el = textFieldFactory.create()
    textFieldFactory.applyProp(el, 'validationRegexp', '^[a-z]+$')
    expect(el.getAttribute('validationregexp')).toBeNull()
  })
})

describe('a2ui-basic factories — CheckBox (bespoke, the readProp:"checked" consumer)', () => {
  it('declares value:{prop,event,readProp} — the boolean round-trip', () => {
    expect(checkBoxFactory.value).toEqual({ prop: 'value', event: 'change', readProp: 'checked' })
    const el = checkBoxFactory.create()
    checkBoxFactory.applyProp(el, 'label', 'I agree')
    expect(el.textContent).toBe('I agree')
    checkBoxFactory.applyProp(el, 'value', true)
    expect((el as unknown as { checked?: unknown }).checked).toBe(true)
  })
})

describe('a2ui-basic factories — ChoicePicker (PARTIAL INCLUDE → ui-select, marshal:"singletonStringList")', () => {
  it('declares the narrowed value mark', () => {
    expect(choicePickerFactory.value).toEqual({ prop: 'value', event: 'select', marshal: 'singletonStringList' })
  })

  it('options synthesizes div[role=option] children; a full rebuild on each apply', () => {
    const el = choicePickerFactory.create()
    choicePickerFactory.applyProp(el, 'options', [
      { label: 'Small', value: 'sm' },
      { label: 'Large', value: 'lg' },
    ])
    const options = [...el.querySelectorAll('[role=option]')]
    expect(options.length).toBe(2)
    expect(options[0]!.textContent).toBe('Small')
    expect(options[0]!.getAttribute('value')).toBe('sm')

    choicePickerFactory.applyProp(el, 'options', [{ label: 'Only', value: 'only' }])
    expect(el.querySelectorAll('[role=option]').length).toBe(1)
  })

  it('value marshals array→string (el.value = arr[0] ?? "")', () => {
    const el = choicePickerFactory.create()
    choicePickerFactory.applyProp(el, 'value', ['sm'])
    expect((el as unknown as { value?: unknown }).value).toBe('sm')
    choicePickerFactory.applyProp(el, 'value', [])
    expect((el as unknown as { value?: unknown }).value).toBe('')
  })

  it('variant/displayStyle/filterable are declared but v1-inert — no DOM effect', () => {
    const el = choicePickerFactory.create()
    choicePickerFactory.applyProp(el, 'variant', 'mutuallyExclusive')
    choicePickerFactory.applyProp(el, 'displayStyle', 'chips')
    choicePickerFactory.applyProp(el, 'filterable', true)
    expect(el.attributes.length).toBe(0)
  })

  it('label maps to aria-label', () => {
    const el = choicePickerFactory.create()
    choicePickerFactory.applyProp(el, 'label', 'Choose a size')
    expect(el.getAttribute('aria-label')).toBe('Choose a size')
  })
})

describe('a2ui-basic factories — ChoicePicker.variant:"multipleSelection" → ui-multi-select (GH #545, SPEC-R10 E6 drain)', () => {
  it('declares the ui-multi-select tag + a marshal-free value mark (SPEC-R10: "the DOM value already IS the array")', () => {
    expect(choicePickerMultiFactory.tag).toBe('ui-multi-select')
    expect(choicePickerMultiFactory.value).toEqual({ prop: 'value', event: 'select' })
  })

  it('options synthesizes div[role=option] children — the SAME rebuild shape as the mutuallyExclusive arm', () => {
    const el = choicePickerMultiFactory.create()
    choicePickerMultiFactory.applyProp(el, 'options', [
      { label: 'Small', value: 'sm' },
      { label: 'Large', value: 'lg' },
    ])
    const options = [...el.querySelectorAll('[role=option]')]
    expect(options.length).toBe(2)
    expect(options[0]!.textContent).toBe('Small')
    expect(options[0]!.getAttribute('value')).toBe('sm')
  })

  it('value passes the array straight through — no marshal step', () => {
    const el = choicePickerMultiFactory.create()
    choicePickerMultiFactory.applyProp(el, 'value', ['sm', 'lg'])
    expect((el as unknown as { value?: unknown }).value).toEqual(['sm', 'lg'])
  })

  it('variant/displayStyle/filterable are declared but v1-inert — no DOM effect (byte-identical to the mutuallyExclusive arm)', () => {
    const el = choicePickerMultiFactory.create()
    choicePickerMultiFactory.applyProp(el, 'variant', 'multipleSelection')
    choicePickerMultiFactory.applyProp(el, 'displayStyle', 'chips')
    choicePickerMultiFactory.applyProp(el, 'filterable', true)
    expect(el.attributes.length).toBe(0)
  })

  it('label maps to aria-label', () => {
    const el = choicePickerMultiFactory.create()
    choicePickerMultiFactory.applyProp(el, 'label', 'Choose sizes')
    expect(el.getAttribute('aria-label')).toBe('Choose sizes')
  })
})

describe('a2ui-basic factories — ChoicePicker is a VariantDispatch table (GH #545)', () => {
  const node = (variant: unknown): A2uiComponent => ({ id: 'n1', component: 'ChoicePicker', variant }) as A2uiComponent

  it('dispatches "mutuallyExclusive" to choicePickerFactory (ui-select)', () => {
    expect(resolveFactory(choicePickerVariants, node('mutuallyExclusive'))).toBe(choicePickerFactory)
  })

  it('dispatches "multipleSelection" to choicePickerMultiFactory (ui-multi-select) — the E6 drain proof', () => {
    expect(resolveFactory(choicePickerVariants, node('multipleSelection'))).toBe(choicePickerMultiFactory)
  })

  it('falls back to choicePickerFactory (the schema default) on an absent/unbound/unknown variant', () => {
    expect(resolveFactory(choicePickerVariants, node(undefined))).toBe(choicePickerFactory)
    expect(resolveFactory(choicePickerVariants, node({ path: '/v' }))).toBe(choicePickerFactory) // a dynamic binding, never a plain string at create time
    expect(resolveFactory(choicePickerVariants, node('bogus'))).toBe(choicePickerFactory)
  })

  it('REGRESSION (SPEC-R10 AC2): the table\'s own arms are byte-identical to the standalone factories — no shape drift from being wrapped in a dispatch table', () => {
    expect(choicePickerVariants.variants.mutuallyExclusive).toBe(choicePickerFactory)
    expect(choicePickerVariants.variants.multipleSelection).toBe(choicePickerMultiFactory)
    expect(choicePickerVariants.fallback).toBe(choicePickerFactory)
  })
})

describe('a2ui-basic factories — Slider (REUSE, thin label→aria-label wrapper)', () => {
  it('label maps to aria-label; value/min/max stay 1:1 reflecting accessors', () => {
    expect(basicSliderFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = basicSliderFactory.create()
    basicSliderFactory.applyProp(el, 'label', 'Volume')
    expect(el.getAttribute('aria-label')).toBe('Volume')
    basicSliderFactory.applyProp(el, 'value', 42)
    expect((el as unknown as { value?: unknown }).value).toBe(42)
  })
})

describe('a2ui-basic factories — DateTimeInput (bespoke, the enableDate/enableTime → type table)', () => {
  it.each([
    [true, false, 'date'],
    [false, true, 'time'],
    [true, true, 'date'], // degrades to date-only (R5)
    [false, false, 'date'],
  ])('enableDate=%s enableTime=%s → type=%s', (enableDate, enableTime, expected) => {
    const el = dateTimeInputFactory.create()
    dateTimeInputFactory.applyProp(el, 'enableDate', enableDate)
    dateTimeInputFactory.applyProp(el, 'enableTime', enableTime)
    expect((el as unknown as { type?: unknown }).type).toBe(expected)
  })

  it('the flags are order-independent — applying enableTime first still converges', () => {
    const el = dateTimeInputFactory.create()
    dateTimeInputFactory.applyProp(el, 'enableTime', true)
    dateTimeInputFactory.applyProp(el, 'enableDate', false)
    expect((el as unknown as { type?: unknown }).type).toBe('time')
  })

  it('value/min/max/label stay 1:1 reflecting accessors', () => {
    expect(dateTimeInputFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = dateTimeInputFactory.create()
    dateTimeInputFactory.applyProp(el, 'value', '2026-08-04')
    expect((el as unknown as { value?: unknown }).value).toBe('2026-08-04')
  })
})
