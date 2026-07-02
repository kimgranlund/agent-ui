import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import type { UIFormProviderElement, FormSubmitDetail } from '@agent-ui/components/components'

// s11 — the CROSS-ENGINE browser smoke for ui-form-provider (decomp g7-field-form-provider slice s11,
// field-form-provider.lld.md §4). The jsdom form-provider.test.ts drives the WHOLE registry/aggregate
// surface against a throwaway `UIFormElement` leaf whose value is a plain reactive prop write — real
// enough for the signal wiring, but it never proves a REAL contenteditable surface's typed input actually
// reaches the aggregate. That is the one thing only a real engine can answer, and the sole probe this file
// owns (the rest of LLD-C7's mechanics — discovery, nesting, disabled/duplicate rules, reset partitioning —
// are already exhaustively covered jsdom-side and need no engine to be true). Runs in BOTH Chromium and
// WebKit (vitest.browser.config.ts → the two playwright instances).
//
// The vehicle is a REALISTIC composition — `ui-form-provider > ui-field > ui-text-field` — because that is
// how the provider is actually used (a bare, unfielded control under a provider is the atypical case); the
// subject under test here is the PROVIDER's aggregate, not the field (which field.browser.test.ts owns).
//
// Demo/doc page-loads (the LLD's folded-in s15 flag) are SKIPPED here: the one existing site-page browser
// pattern (site-nav.browser.test.ts) mounts the shared `_page.ts` shell, not an individual page module —
// there is no harness precedent for "import form-provider-doc.ts/form-provider-demo.ts and assert it doesn't
// throw" to extend without inventing new harness machinery; s13's e2e drives the live pages instead.
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the component sheet (form-provider.css + field.css + text-field.css all @import through the barrel,
// s12), then the self-defining family barrel. Vite injects them.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

// A realistic sized text-field — no intrinsic width (the ADR-0021 20ch floor still applies without this),
// but an explicit author width is the common real case and gives userEvent a stable hit-test target.
const SIZED = 'style="inline-size: 220px"'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}
afterEach(async () => {
  await userEvent.unhover(document.body) // drop any held hover so it cannot bleed into the next test
  while (mounted.length) mounted.pop()?.remove()
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  The aggregate tracks a REAL typed input (both engines, jsdom-blind)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-form-provider — the aggregate tracks a REAL typed input (both engines, jsdom-blind)', () => {
  it('typing into a fielded text-field updates values()/entries(); submit() emits the real aggregate change', async () => {
    const wrap = mount(
      `<ui-form-provider>
        <ui-field label="First name">
          <ui-text-field name="fname" ${SIZED}></ui-text-field>
        </ui-field>
      </ui-form-provider>`,
    )
    const provider = wrap.querySelector('ui-form-provider') as UIFormProviderElement
    const editor = provider.querySelector('[data-part="editor"]') as HTMLElement
    await provider.updateComplete

    expect(provider.values(), 'a fresh control should not already carry a value').toEqual({ fname: '' })

    await userEvent.click(editor) // real mouse-focus on the contenteditable region
    await userEvent.keyboard('Ada')
    await provider.updateComplete

    expect(provider.values(), "the typed value did not reach the provider's reactive aggregate").toEqual({ fname: 'Ada' })
    expect(provider.entries()).toEqual([['fname', 'Ada']])

    const seen: CustomEvent<FormSubmitDetail>[] = []
    provider.addEventListener('change', (e) => seen.push(e as CustomEvent<FormSubmitDetail>))
    expect(provider.submit()).toBe(true)
    expect(seen).toHaveLength(1)
    // the LLD-C7 disambiguation: the aggregate change targets the PROVIDER, distinct from a bubbled member
    // `change` (which would carry `detail: null` and `event.target` = the control).
    expect(seen[0]?.target).toBe(provider)
    expect(seen[0]?.detail).toEqual({ entries: [['fname', 'Ada']], values: { fname: 'Ada' } })
  })
})
