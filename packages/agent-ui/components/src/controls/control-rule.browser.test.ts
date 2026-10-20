import { describe, it, expect, afterEach } from 'vitest'
import { resolve, type Resolved, type Step, type Tier } from '../../../shared/src/tokens/scale.mjs'
import { glyphBox } from '../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)
import { resolve as model, type Emitted } from '../../../../../scripts/lib/foundations-model.mjs' // the button anatomy (T-0374 step 7)
import '@agent-ui/shared/foundations.css'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'

// ADR-0245 Amendment 4, the skill's control rule, measured per control in a real engine: box margin n, gutter c,
// label inset n - c on the text slot, so the icon edge is n, icon to text is n and the text edge is 2n - c; min
// width 4n; action labels align per the skill's table. ui-button left the rule for the skill's control anatomy
// (T-0374 step 7): margin m, the square 3n adornment wrapper, and the label wrapper's W plus the compensation C on
// each exposed side, so its exposed text edge is m + W + C (8 at the root under balanced). Every control runs outside any region (the root register,
// product at scale md: text edge 10 / 14 / 17 at sm / md / lg) and inside a data-tier region that differs from it
// (product at scale sm), so the region leg still proves the register moves the rule.
// Expected px come from scale.mjs resolve(), never a pinned literal. Edges are measured from the control's padding
// edge: the fleet writes padding = rule and draws its 1px border outside it.

const REGISTERS: ReadonlyArray<readonly [string, Tier, Step, string]> = [
  ['outside any region (the root register)', 'product', 'md', ''],
  ['inside data-tier="product" data-scale="sm"', 'product', 'sm', 'data-tier="product" data-scale="sm"'],
]
const SIZES = ['sm', 'md', 'lg'] as const
const TOLERANCE = 0.5

const ICON = (slot: string): string => `<svg slot="${slot}" data-role="icon" viewBox="0 0 16 16" aria-hidden="true"></svg>`

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Mount `html` in a wrapper carrying the register and the size step. The wrapper is filled while detached, so
 *  every element upgrades before any parent connects (a compound control then finds its upgraded children). */
async function mount(attrs: string, size: string, html: string, inlineSize = ''): Promise<HTMLElement> {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<div ${attrs} data-size="${size}"${inlineSize ? ` style="inline-size: ${inlineSize}"` : ''}>${html}</div>`
  document.body.append(wrap)
  mounted.push(wrap)
  await frame()
  return wrap
}

const q = (root: ParentNode, selector: string): HTMLElement => {
  const el = root.querySelector(selector)
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) throw new Error(`control-rule: ${selector} not found`)
  return el as HTMLElement
}
const px = (el: Element, prop: string, pseudo?: string): number => parseFloat(getComputedStyle(el, pseudo).getPropertyValue(prop))

/** The rect of the first rendered text inside `el`. */
function textRect(el: Element): DOMRect {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const rect = range.getBoundingClientRect()
    if (rect.width > 0) return rect
  }
  throw new Error('control-rule: no rendered text')
}

/** Distances from the padding edge of `box` to `inner` (a rect inside it), start and end. */
function edges(box: Element, inner: DOMRect): { start: number; end: number } {
  const b = box.getBoundingClientRect()
  return { start: inner.left - b.left - px(box, 'border-inline-start-width'), end: b.right - inner.right - px(box, 'border-inline-end-width') }
}
const near = (got: number, want: number, label: string): void => expect(Math.abs(got - want), `${label}: got ${got}, want ${want}`).toBeLessThanOrEqual(TOLERANCE)

const textEdge = (r: Resolved): number => r.control.margin + r.labelMargin // 2n - c
/** ui-button's exposed text edge (T-0374 step 7): m + W + C. */
const buttonEdge = (e: Emitted): number => e.controlMargin + e.controlGutter + e.labelCompensation

for (const [name, tier, scale, attrs] of REGISTERS) {
  describe(`the control rule ${name}`, () => {
    for (const size of SIZES) {
      const r = resolve(tier, scale, size)
      const edge = textEdge(r)
      const at = `size ${size} (n ${r.n}: margin ${r.control.margin}, label inset ${r.labelMargin}, text edge ${edge})`

      const e = model(tier, scale, size)
      const bEdge = buttonEdge(e)
      it(`ui-button at size ${size} (n ${r.n}: margin ${e.controlMargin}, label W + C ${e.controlGutter + e.labelCompensation}, text edge ${bEdge}): label-only, the 3n adornment wrappers, and the min width 4n`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-button inline size="${size}" data-case="label">Label</ui-button>
          <ui-button inline size="${size}" data-case="leading">${ICON('leading')}Label</ui-button>
          <ui-button inline size="${size}" data-case="trailing">Label${ICON('trailing')}</ui-button>`)
        const label = q(wrap, '[data-case="label"]')
        expect(e.labelCompensation, 'C = max(0, R - m - W)').toBe(Math.max(0, e.controlRadius - e.controlMargin - e.controlGutter))
        near(px(label, 'padding-inline-start'), e.controlMargin, 'control margin')
        near(px(q(label, '[data-part="label"]'), 'padding-inline-start'), e.controlGutter + e.labelCompensation, 'W + C on the exposed label side')
        const bare = edges(label, textRect(label))
        near(bare.start, bEdge, 'label-only text edge, start')
        near(bare.end, bEdge, 'label-only text edge, end')
        near(px(label, 'min-inline-size'), r.minWidth, 'min width')

        const leading = q(wrap, '[data-case="leading"]')
        const icon = q(leading, '[slot="leading"]').getBoundingClientRect()
        near(icon.width, e.glyphSlot, 'the square 3n wrapper')
        near(edges(leading, icon).start, e.controlMargin, 'wrapper edge')
        near(textRect(leading).left - icon.right, r.c + e.controlGutter, 'wrapper to text: the gutter c and W, no C')
        near(edges(leading, textRect(leading)).end, bEdge, 'text edge beside a leading icon')

        const trailing = q(wrap, '[data-case="trailing"]')
        const tail = q(trailing, '[slot="trailing"]').getBoundingClientRect()
        near(edges(trailing, tail).end, e.controlMargin, 'trailing wrapper edge')
        near(tail.left - textRect(trailing).right, r.c + e.controlGutter, 'text to trailing wrapper')
        near(edges(trailing, textRect(trailing)).start, bEdge, 'text edge beside a trailing icon')
      })

      it(`ui-toggle at ${at}: label-only and beside its icon`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-toggle inline size="${size}" data-case="label">Label</ui-toggle>
          <ui-toggle inline size="${size}" data-case="icon"><svg slot="icon" viewBox="0 0 16 16" aria-hidden="true"></svg>Label</ui-toggle>`)
        const label = q(wrap, '[data-case="label"]')
        const bare = edges(label, textRect(label))
        near(bare.start, edge, 'label-only text edge, start')
        near(bare.end, edge, 'label-only text edge, end')
        // no explicit floor on a toggle (its anonymous label cannot clip): the rule itself keeps it at 4n or wider
        expect(label.getBoundingClientRect().width, 'a label-only toggle is 4n - 2c plus its text').toBeGreaterThanOrEqual(r.minWidth)
        const withIcon = q(wrap, '[data-case="icon"]')
        const icon = q(withIcon, '[slot="icon"]').getBoundingClientRect()
        near(edges(withIcon, icon).start, r.control.margin, 'icon edge')
        near(textRect(withIcon).left - icon.right, r.control.margin, 'icon to text')
        near(edges(withIcon, textRect(withIcon)).end, edge, 'text edge beside the icon')
      })

      it(`the entry controls at ${at}: text-field, textarea, select trigger`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-text-field size="${size}" data-case="plain" value="Value"></ui-text-field>
          <ui-text-field size="${size}" data-case="leading" value="Value">${ICON('leading')}</ui-text-field>
          <ui-textarea size="${size}" value="Value"></ui-textarea>
          <ui-select size="${size}" value="a"><div role="option" value="a">Value</div></ui-select>`, '240px')
        const field = q(wrap, 'ui-text-field[data-case="plain"]')
        near(px(field, 'padding-inline-start'), r.control.margin, 'text-field box margin')
        near(edges(field, textRect(q(field, '[data-part="editor"]'))).start, edge, 'text-field value edge')
        near(px(field, 'min-inline-size'), r.minWidth, 'text-field min width')

        const leading = q(wrap, 'ui-text-field[data-case="leading"]')
        const icon = q(leading, '[slot="leading"]').getBoundingClientRect()
        near(edges(leading, icon).start, r.control.margin, 'text-field icon edge')
        near(textRect(q(leading, '[data-part="editor"]')).left - icon.right, r.control.margin, 'text-field icon to text')

        const area = q(wrap, 'ui-textarea')
        near(edges(area, textRect(q(area, '[data-part="editor"]'))).start, edge, 'textarea text edge')

        const trigger = q(wrap, 'ui-select [data-part="trigger"]')
        near(edges(trigger, textRect(q(trigger, '[data-part="label"]'))).start, edge, 'select trigger text edge')
        const caret = q(trigger, '[data-part="caret"]').getBoundingClientRect()
        near(edges(trigger, caret).end, r.control.margin, 'select caret cell edge')
        near(caret.left - q(trigger, '[data-part="label"]').getBoundingClientRect().right, r.c, 'select gutter c')
        near(px(q(wrap, 'ui-select'), 'min-inline-size'), r.minWidth, 'select min width')
      })

      it(`the unsized controls at ${at}: combo-box, tab, segment, menu and listbox rows`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-combo-box value="a"><div role="option" value="a">Value</div></ui-combo-box>
          <ui-tabs selected="one"><ui-tab key="one">Label</ui-tab><ui-tab key="two">I</ui-tab><ui-tab-panel>One</ui-tab-panel><ui-tab-panel>Two</ui-tab-panel></ui-tabs>
          <ui-segmented-control name="s" value="a"><ui-segment value="a">Label</ui-segment><ui-segment value="b">Other</ui-segment></ui-segmented-control>
          <ui-menu><button>Open</button><div>Row</div><div role="menuitemcheckbox" aria-checked="true">Checked</div></ui-menu>
          <ui-select value="a"><div role="option" value="a">Value</div></ui-select>
          <ui-multi-select size="${size}" name="m"><div role="option" value="a">Value</div></ui-multi-select>`, '320px')
        const editor = q(wrap, 'ui-combo-box [data-part="editor"]')
        near(edges(editor, textRect(editor)).start, edge, 'combo-box value edge')
        near(px(q(wrap, 'ui-combo-box'), 'min-inline-size'), r.minWidth, 'combo-box min width')

        const tab = q(wrap, 'ui-tab')
        const tabEdges = edges(tab, textRect(tab))
        near(tabEdges.start, edge, 'tab text edge, start')
        near(tabEdges.end, edge, 'tab text edge, end')
        near(px(tab, 'min-inline-size'), r.minWidth, 'tab min width') // a label-only control is 4n - 2c plus its text, so the floor binds only under 2c of text
        expect(getComputedStyle(tab).flexShrink, 'a tab never shrinks under its label: the strip scrolls (GH #221)').toBe('0')
        const [first, second] = [...wrap.querySelectorAll('ui-tab')] as [HTMLElement, HTMLElement]
        near(second.getBoundingClientRect().left - first.getBoundingClientRect().right, r.c, 'tabs touch with the tight gutter c')

        const segment = q(wrap, 'ui-segment')
        near(px(segment, 'padding-inline-start'), edge, 'segment text edge')
        expect(segment.getBoundingClientRect().width, 'a segment is 4n - 2c plus its text, never under 4n').toBeGreaterThanOrEqual(r.minWidth)

        // the menu panel and the select listbox are closed popovers: their rows have computed style, no layout
        near(px(q(wrap, '[role="menuitem"]'), 'padding-inline-start'), edge, 'menu row text edge')
        const checked = q(wrap, '[role="menuitemcheckbox"]')
        near(px(checked, 'inset-inline-start', '::before'), r.control.margin, 'menu check box edge')
        near(px(checked, 'padding-inline-start'), r.control.margin + r.icon + r.control.margin, 'menu check row: box edge n + box 2n + n to the text')
        near(px(checked, 'padding-inline-end'), edge, 'menu check row text edge, end')
        near(px(q(wrap, 'ui-select [role="option"]'), 'padding-inline-start'), edge, 'select option row text edge')
        near(px(q(wrap, 'ui-combo-box [role="option"]'), 'padding-inline-start'), edge, 'combo-box option row text edge')

        const row = q(wrap, 'ui-multi-select [role="option"]')
        // the tick cell is the 2n icon cell, never smaller than the n + 6 glyph box (T-0374: 11 at n 5)
        near(edges(row, textRect(row)).start, r.control.margin + Math.max(r.icon, glyphBox(r)) + r.control.margin, 'listbox row: tick cell at n, max(2n, n + 6) wide, n to the text')
        near(px(row, 'padding-inline-end'), edge, 'listbox row text edge, end')
      })

      it(`an open select and combo-box at ${at}: the panel sits c outside the trigger, so option text and trigger text share one x`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-select size="${size}" value="a"><div role="option" value="a">Value</div><div role="option" value="b">Other</div></ui-select>
          <ui-combo-box value="Value"><div role="option" value="Value">Value</div></ui-combo-box>`, '240px')
        const select = q(wrap, 'ui-select') as HTMLElement & { open: boolean }
        select.open = true
        await frame()
        const trigger = q(select, '[data-part="trigger"]')
        near(textRect(q(select, '[role="option"]')).left, textRect(q(trigger, '[data-part="label"]')).left, 'select: option text x equals trigger text x')
        const panel = q(select, '[data-part="listbox"]').getBoundingClientRect()
        const box = trigger.getBoundingClientRect()
        near(box.left - panel.left, r.c, 'select: the panel starts c outside the trigger')
        near(panel.right - box.right, r.c, 'select: and ends c past it (the floor is the trigger width plus 2c)')
        select.open = false
        await frame()

        const combo = q(wrap, 'ui-combo-box') as HTMLElement & { open: boolean }
        const editor = q(combo, '[data-part="editor"]')
        combo.open = true
        await frame()
        near(textRect(q(combo, '[role="option"]')).left, textRect(editor).left, 'combo-box: option text x equals editor text x')
        near(editor.getBoundingClientRect().left - q(combo, '[data-part="listbox"]').getBoundingClientRect().left, r.c, 'combo-box: the panel starts c outside the editor')
        combo.open = false
      })

      it(`the chip level at ${at}: ui-badge 2n + 2c tall with text edge 2c and the chip pill n + c; ui-checkbox keeps ceil(n/2)`, async () => {
        const wrap = await mount(attrs, size, `
          <ui-badge label="beta"></ui-badge>
          <ui-badge label="ok" intent="success"></ui-badge>
          <ui-checkbox size="${size}">Label</ui-checkbox>`)
        const badge = q(wrap, 'ui-badge')
        near(badge.getBoundingClientRect().height, r.parts.badge, 'badge height')
        expect(r.parts.badge, 'badge height is the icon size plus a c ring').toBe(2 * r.n + 2 * r.c)
        near(px(badge, 'border-start-start-radius'), r.n + r.c, 'badge radius') // the chip pill (Amendment 5)
        const bare = edges(badge, textRect(badge))
        near(bare.start, r.chip.margin + r.c, 'badge text edge 2c, start')
        near(bare.end, r.chip.margin + r.c, 'badge text edge 2c, end')
        const marked = q(wrap, 'ui-badge[intent="success"]')
        const glyph = q(marked, '[data-part="glyph"]').getBoundingClientRect()
        near(glyph.width, glyphBox(r), 'badge glyph')
        near(edges(marked, glyph).start, r.chip.margin + r.c, 'the glyph sits c inside its 2n mark box at the chip margin')
        near(textRect(marked).left - glyph.right, r.c + r.chip.gutter + r.c, 'mark box to text: gutter c + label margin c')
        near(px(q(wrap, 'ui-checkbox'), 'border-start-start-radius', '::before'), r.parts.checkboxRadius, 'checkbox radius')
        expect(r.parts.checkboxRadius).toBe(Math.ceil(r.n / 2))
      })
    }

    it('action labels align per the table: centered alone or between content, start with trailing only, end with leading only', async () => {
      const e = model(tier, scale, 'md')
      const edge = buttonEdge(e)
      const wrap = await mount(attrs, 'md', `
        <ui-button data-case="alone">Label</ui-button>
        <ui-button data-case="leading">${ICON('leading')}Label</ui-button>
        <ui-button data-case="trailing">Label${ICON('trailing')}</ui-button>
        <ui-button data-case="both">${ICON('leading')}Label${ICON('trailing')}</ui-button>`, '320px')
      const alone = q(wrap, '[data-case="alone"]')
      const a = edges(alone, textRect(alone))
      near(a.start, a.end, 'alone: centered')
      expect(a.start, 'the fill button is wider than its content, so the alignment shows').toBeGreaterThan(edge + 20)

      const leading = q(wrap, '[data-case="leading"]')
      near(edges(leading, textRect(leading)).end, edge, 'only leading content: the label sits at the end edge')
      near(edges(leading, q(leading, '[slot="leading"]').getBoundingClientRect()).start, e.controlMargin, 'the leading icon stays pinned at the start')

      const trailing = q(wrap, '[data-case="trailing"]')
      near(edges(trailing, textRect(trailing)).start, edge, 'only trailing content: the label sits at the start edge')
      near(edges(trailing, q(trailing, '[slot="trailing"]').getBoundingClientRect()).end, e.controlMargin, 'the trailing icon stays pinned at the end')

      const both = q(wrap, '[data-case="both"]')
      const text = textRect(both)
      near(text.left - q(both, '[slot="leading"]').getBoundingClientRect().right, q(both, '[slot="trailing"]').getBoundingClientRect().left - text.right, 'between leading and trailing: centered')
    })
  })
}

describe('the control rule under data-foundations="legacy" (ADR-0245 clause 10e)', () => {
  it('every new inset is 0 and the edges read today\'s geometry', async () => {
    const wrap = await mount('data-foundations="legacy"', 'md', `
      <ui-button inline>Label</ui-button>
      <ui-text-field value="Value"></ui-text-field>
      <ui-tabs selected="one"><ui-tab key="one">Label</ui-tab><ui-tab-panel>One</ui-tab-panel></ui-tabs>
      <ui-badge label="beta"></ui-badge>`, '240px')
    const button = q(wrap, 'ui-button')
    near(px(button, 'padding-inline-start'), 14, 'button edge h/2')
    near(px(q(button, '[data-part="label"]'), 'padding-inline-start'), 0, 'button label inset')
    near(edges(button, textRect(button)).start, 14, 'button text edge')
    const field = q(wrap, 'ui-text-field')
    near(edges(field, textRect(q(field, '[data-part="editor"]'))).start, 14, 'text-field value edge h/2')
    const tab = q(wrap, 'ui-tab')
    near(edges(tab, textRect(tab)).start, 0, 'tab padding (GH #536 holds under the opt-out)')
    const badge = q(wrap, 'ui-badge')
    near(badge.getBoundingClientRect().height, 18, 'badge box')
    near(edges(badge, textRect(badge)).start, 8.75, 'badge pad')
  })
})
