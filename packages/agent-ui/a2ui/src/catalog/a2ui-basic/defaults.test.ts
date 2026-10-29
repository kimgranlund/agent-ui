// defaults.test.ts: T-0555, the ADR-0169 upstream defaults on omitted props. Each Basic type mounts through
// a real renderer with NO optional props and pins the default render (Divider axis horizontal, Button
// variant default, Image variant mediumFeature, DateTimeInput (F,F) date); TextField longText mounts the
// multi-line ui-textarea; a Button whose later update drops `variant` falls back to the default look.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import '@agent-ui/components/all' // ADR-0233: the catalog factories import no control; the test defines the fleet
import { createRenderer } from '../../renderer/renderer.ts'
import type { A2uiComponent, A2uiServerMessage } from '../../protocol.ts'

// jsdom has no ElementInternals.setFormValue/setValidity (the upstream-fixtures.test.ts precedent).
let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') ElementInternals.prototype.setFormValue = function (): void {}
  if (typeof ElementInternals.prototype.setValidity !== 'function') ElementInternals.prototype.setValidity = function (): void {}
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

const surfaceId = 's'
const update = (components: A2uiComponent[]): A2uiServerMessage =>
  ({
    version: 'v1.0',
    updateComponents: { surfaceId, components },
  }) as unknown as A2uiServerMessage

async function mount(root: A2uiComponent): Promise<{
  host: HTMLElement
  ingest: (m: A2uiServerMessage) => void
  dispose: () => void
}> {
  const r = createRenderer({
    newId: () => 'act-1',
    now: () => '2026-10-28T00:00:00.000Z',
  })
  await r.preload('a2ui-basic')
  const host = document.createElement('div')
  document.body.appendChild(host)
  r.mount(host)
  r.ingestMessage({
    version: 'v1.0',
    createSurface: { surfaceId, catalogId: 'a2ui-basic' },
  } as unknown as A2uiServerMessage)
  r.ingestMessage(update([root]))
  return {
    host,
    ingest: (m) => r.ingestMessage(m),
    dispose: () => {
      r.dispose()
      host.remove()
    },
  }
}

describe('T-0555: every Basic type mounts with no optional props', () => {
  it.each([
    ['Text', 'ui-text'],
    ['Image', 'img'],
    ['Icon', 'ui-icon'],
    ['Row', 'ui-row'],
    ['Column', 'ui-column'],
    ['List', 'ui-list'],
    ['Card', 'ui-card'],
    ['Divider', 'div[role=separator]'],
    ['Button', 'ui-button'],
    ['TextField', 'ui-text-field'],
    ['CheckBox', 'ui-checkbox'],
    ['ChoicePicker', 'ui-select'],
    ['Slider', 'ui-slider'],
    ['DateTimeInput', 'ui-text-field'],
  ])('%s mounts as %s', async (component, selector) => {
    const { host, dispose } = await mount({
      id: 'root',
      component,
    } as A2uiComponent)
    expect(host.querySelector(selector), `${component} mounted`).toBeTruthy()
    dispose()
  })
})

describe('T-0555: the ADR-0169 defaults apply when the prop is omitted', () => {
  it('Divider with no axis renders the horizontal rule (row 11)', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'Divider',
    } as A2uiComponent)
    const el = host.querySelector('div[role=separator]') as HTMLElement
    expect(el.getAttribute('aria-orientation')).toBe('horizontal')
    expect(el.style.blockSize).toBe('1px')
    expect(el.style.inlineSize).toBe('100%')
    expect(el.style.backgroundColor).not.toBe('')
    dispose()
  })

  it('Button with no variant renders the upstream default (soft), not solid (row 13)', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'Button',
    } as A2uiComponent)
    expect((host.querySelector('ui-button') as unknown as { variant: unknown }).variant).toBe('soft')
    dispose()
  })

  it('Button whose update drops variant falls back to soft, not the control default solid', async () => {
    const { host, ingest, dispose } = await mount({
      id: 'root',
      component: 'Button',
      variant: 'borderless',
    } as A2uiComponent)
    expect((host.querySelector('ui-button') as unknown as { variant: unknown }).variant).toBe('ghost')
    ingest(update([{ id: 'root', component: 'Button' } as A2uiComponent]))
    expect((host.querySelector('ui-button') as unknown as { variant: unknown }).variant).toBe('soft')
    dispose()
  })

  it('Image with no variant gets the mediumFeature dims (the schema default)', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'Image',
      url: 'https://example.com/a.png',
    } as A2uiComponent)
    const img = host.querySelector('img') as HTMLImageElement
    expect(img.style.inlineSize).toBe('100%')
    expect(img.style.maxInlineSize).toBe('300px')
    dispose()
  })

  it('DateTimeInput with neither flag renders a date field, (F,F) gives date (row 18)', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'DateTimeInput',
    } as A2uiComponent)
    expect((host.querySelector('ui-text-field') as unknown as { type: unknown }).type).toBe('date')
    dispose()
  })
})

describe('T-0555: TextField longText is multi-line', () => {
  it('variant:"longText" mounts ui-textarea, carrying label and value', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'TextField',
      variant: 'longText',
      label: 'Notes',
      value: 'a',
    } as A2uiComponent)
    const el = host.querySelector('ui-textarea') as (HTMLElement & { label: unknown; value: unknown }) | null
    expect(el, 'longText mounted ui-textarea').toBeTruthy()
    expect(host.querySelector('ui-text-field')).toBeNull()
    expect(el!.label).toBe('Notes')
    expect(el!.value).toBe('a')
    dispose()
  })

  it('the other variants keep ui-text-field', async () => {
    const { host, dispose } = await mount({
      id: 'root',
      component: 'TextField',
      variant: 'shortText',
    } as A2uiComponent)
    expect(host.querySelector('ui-text-field')).toBeTruthy()
    dispose()
  })
})
