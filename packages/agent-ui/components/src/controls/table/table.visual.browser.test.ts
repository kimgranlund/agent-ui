import { describe, it, expect } from 'vitest'
import { page, server } from 'vitest/browser'

// GH #1445 / ADR-0163 Amendment (2026-08-19) — the DELIBERATELY minted visual golden for ui-table's
// composed selection + sort anatomy (ui-checkbox select-all/per-row, ui-button sortable headers): the
// amendment's "REAL pixel change, not a refactor" claim, pinned as pixels (the checker's B5 corrective).
// Chromium-only. Baselines commit under `__baselines__/table.visual.browser.test.ts/
// <name>-chromium-darwin.png`; re-baseline only via `npm run test:visual:update` (a deliberate act,
// per ADR-0223's R5 golden-regen law).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '../button/button.ts'
import '../checkbox/checkbox.ts'
import '../radio/radio.ts'
import './table.ts'
import type { UITableElement } from './table.ts'

const COLUMNS = JSON.stringify([
  { key: 'region', label: 'Region', sortable: true },
  { key: 'revenue', label: 'Revenue', type: 'number', sortable: true },
])
const ROWS = JSON.stringify([
  { region: 'EMEA', revenue: 42000 },
  { region: 'APAC', revenue: 90000 },
  { region: 'AMER', revenue: 31000 },
])

const settle = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('ui-table — visual regression (ADR-0163 amendment: composed selection/sort anatomy)', () => {
  it.skipIf(server.browser !== 'chromium')('selectable=multi + sortable headers: ui-checkbox cells and ui-button headers, one row selected', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '480px'
    wrap.style.padding = '8px'
    wrap.innerHTML = `<ui-table label="Regions" selectable="multi" row-key="region" columns='${COLUMNS}' rows='${ROWS}'></ui-table>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-table') as UITableElement
    await settle()
    // One selected row so the golden pins the checked paint, not only the idle anatomy.
    host.selected = ['APAC']
    await settle()
    await expect.element(page.elementLocator(wrap)).toMatchScreenshot('table-composed-selection-sort')
    wrap.remove()
  })
})
