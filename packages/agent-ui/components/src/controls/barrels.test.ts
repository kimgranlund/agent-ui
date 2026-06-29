import { describe, it, expect } from 'vitest'
import * as componentsBarrel from './index.ts'
import { UIButtonElement } from './button/button.ts'
import { UITextFieldElement } from './text-field/text-field.ts'
import { UITextElement } from './text/text.ts'
import { UIRowElement } from './row/row.ts'
import { UIColumnElement } from './column/column.ts'
import { UIListElement } from './list/list.ts'
import { UIGridElement } from './grid/grid.ts'
import { UICardElement } from './card/card.ts'
import { UITabsElement } from './tabs/tabs.ts'
import { UIModalElement } from './modal/modal.ts'
// Read package.json + the CSS barrels as text (vite strips `.css?raw`; no `@types/node` devDep — same
// approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, existsSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s17 — the three barrels (ADR-0003) exist and are wired into the package exports:
//   • components        — the self-defining JS module barrel (controls/index.ts → `./components`)
//   • component-styles  — the per-component CSS barrel (component-styles.css → `./component-styles.css`)
//   • foundation-styles — the foundation CSS barrel (foundation-styles.css → `./foundation-styles.css`)
// The host page itself is Phase 2; here we prove the barrels + their wiring + the load-bearing CSS order.

const PKG = `${process.cwd()}/packages/agent-ui/components`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const read = (rel: string) => readFileSync(`${PKG}/${rel}`, 'utf8') as string

describe('components barrel — self-defines the ui-* family (s17)', () => {
  it('importing the barrel registers ui-button and re-exports its element class', () => {
    expect(customElements.get('ui-button')).toBe(UIButtonElement) // the self-define side effect ran on import
    expect(componentsBarrel.UIButtonElement).toBe(UIButtonElement) // the class is surfaced for typed references
  })

  it('importing the barrel ALSO registers ui-text-field and re-exports its element class (s12)', () => {
    expect(customElements.get('ui-text-field')).toBe(UITextFieldElement) // `export * from './text-field/text-field.ts'` ran the self-define
    expect(componentsBarrel.UITextFieldElement).toBe(UITextFieldElement) // the class is surfaced for typed references
  })

  it('importing the barrel registers ui-text (ADR-0025) and re-exports its element class', () => {
    expect(customElements.get('ui-text')).toBe(UITextElement) // `export * from './text/text.ts'` ran the self-define
    expect(componentsBarrel.UITextElement).toBe(UITextElement) // the class is surfaced for typed references
  })

  it('importing the barrel self-defines the WHOLE G9 container family — all ~14 tags (s12)', () => {
    // The seven family entries each self-define on import; the two compounds (card, tabs) transitively
    // self-define their sub-elements, so `export * from './card/card.ts'` / `'./tabs/tabs.ts'` registers all
    // of them — importing the one barrel registers every container tag with no per-sub-element barrel line.
    const CONTAINER_TAGS = [
      'ui-row',
      'ui-column',
      'ui-list',
      'ui-grid',
      'ui-card',
      'ui-card-header', // a card region sub-element — registered via card.ts's transitive self-define
      'ui-card-content',
      'ui-card-footer',
      'ui-tabs',
      'ui-tab', // a tabs sub-element — registered via tabs.ts's transitive self-define
      'ui-tab-panel',
      'ui-modal',
    ]
    for (const tag of CONTAINER_TAGS) {
      expect(customElements.get(tag), `barrel did not self-define ${tag}`).toBeDefined()
    }
  })

  it('the barrel surfaces each container FAMILY ENTRY class for typed references (s12)', () => {
    // The seven family entries' classes are surfaced (the `export *` re-export). Sub-element classes
    // (UICardHeaderElement / UITabElement / …) are registered-only, NOT surfaced — the ui-tabs precedent.
    expect(componentsBarrel.UIRowElement).toBe(UIRowElement)
    expect(componentsBarrel.UIColumnElement).toBe(UIColumnElement)
    expect(componentsBarrel.UIListElement).toBe(UIListElement)
    expect(componentsBarrel.UIGridElement).toBe(UIGridElement)
    expect(componentsBarrel.UICardElement).toBe(UICardElement)
    expect(componentsBarrel.UITabsElement).toBe(UITabsElement)
    expect(componentsBarrel.UIModalElement).toBe(UIModalElement)
  })

  it('is exported as `./components` and points at controls/index.ts', () => {
    expect(pkg.exports['./components']).toBe('./src/controls/index.ts')
    expect(existsSync(`${PKG}/${pkg.exports['./components']}`)).toBe(true)
  })
})

describe('CSS barrels — wired into exports + the load-bearing order (s17)', () => {
  it('`./component-styles.css` aggregates each control stylesheet (button.css, text-field.css, text.css) in addition order', () => {
    expect(pkg.exports['./component-styles.css']).toBe('./src/component-styles.css')
    const css = read('src/component-styles.css')
    const buttonAt = css.indexOf("@import './controls/button/button.css'")
    const textFieldAt = css.indexOf("@import './controls/text-field/text-field.css'")
    const textAt = css.indexOf("@import './controls/text/text.css'")
    expect(buttonAt).toBeGreaterThanOrEqual(0)
    expect(textFieldAt).toBeGreaterThan(buttonAt) // append-only in control-addition order (do-not-reorder, s12)
    expect(textAt).toBeGreaterThan(textFieldAt) // text display control appended after text-field (ADR-0025)
  })

  it('`./component-styles.css` imports the shared `_surface/container.css` seam FIRST, before any element sheet (s12)', () => {
    const css = read('src/component-styles.css')
    const containerAt = css.indexOf("@import './controls/_surface/container.css'")
    const buttonAt = css.indexOf("@import './controls/button/button.css'")
    expect(containerAt).toBeGreaterThanOrEqual(0)
    // the shared surface seam is the FIRST @import (before even the existing control sheets) so a container's
    // `@scope` block resolves the `--ui-container-*` tokens it declares (ADR-0015/0016).
    expect(containerAt).toBeLessThan(buttonAt)
    // and it precedes EVERY G9 container element sheet that consumes it.
    for (const name of ['row', 'column', 'list', 'grid', 'card', 'tabs', 'modal']) {
      const at = css.indexOf(`@import './controls/${name}/${name}.css'`)
      expect(at, `missing container sheet: ${name}.css`).toBeGreaterThan(containerAt)
    }
  })

  it('`./foundation-styles.css` aggregates @agent-ui/shared tokens FIRST, then dimensions', () => {
    expect(pkg.exports['./foundation-styles.css']).toBe('./src/foundation-styles.css')
    const css = read('src/foundation-styles.css')
    const tokensAt = css.indexOf("@import '@agent-ui/shared/tokens.css'")
    const dimsAt = css.indexOf("@import '@agent-ui/shared/dimensions.css'")
    expect(tokensAt).toBeGreaterThanOrEqual(0)
    expect(dimsAt).toBeGreaterThan(tokensAt) // tokens (colour) load before the dimensional ramp — ADR-0003
  })

  it('every export target resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })
})
