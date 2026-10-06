// matrix.browser.test.ts: the generated per-type matrix in a real engine for the two base catalogs (T-0011,
// the packages-rest shard). It proves the default control loader defines every base type's control in
// Chromium and WebKit. Persona cells are not repeated: a derived catalog reuses its base's controls (the
// jsdom matrix covers every derived catalog). Imports only browser-safe kit modules.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { BASE_CATALOGS } from '../../tools/testkit/catalogs.ts'
import { cellDefects } from '../../tools/testkit/matrix.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const cells = [...BASE_CATALOGS.values()].flatMap((c) => Object.keys(c.components).map((type) => ({ catalog: c, type })))

describe('the base-catalog matrix in a real engine', () => {
  it('a fleet tag is undefined before the first mount: the loader, not the page, defines the controls', () => {
    expect(customElements.get('ui-button')).toBeUndefined()
    expect(cells.length).toBe([...BASE_CATALOGS.values()].reduce((n, c) => n + Object.keys(c.components).length, 0))
  })

  for (const { catalog, type } of cells) {
    it(`${catalog.catalogId} ${type}`, async () => {
      expect(await cellDefects(catalog, type)).toEqual([])
    })
  }
})
