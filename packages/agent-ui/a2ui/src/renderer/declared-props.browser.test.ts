// declared-props.browser.test.ts: the real-engine twin of `declared-props.test.ts` (T-0552). The renderer
// applies only catalog-declared props; an undeclared component key is left off the element in Chromium and
// WebKit too, on the static path, the bound path and a structural resend.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/all' // self-defines the ui-* controls (the real default-catalog factories)
import { whenFlushed } from '@agent-ui/components'
import { createRenderer } from './renderer.ts'

await createRenderer().preload('agent-ui')

const surface = (r: ReturnType<typeof createRenderer>) =>
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })

function setup() {
  const mount = document.createElement('div')
  document.body.append(mount)
  const r = createRenderer()
  r.mount(mount)
  surface(r)
  return { mount, r }
}

/** True when neither undeclared key landed on `el` (as a property or a reflected attribute). */
function untouched(el: HTMLElement): void {
  expect(el.title).toBe('')
  expect(el.hasAttribute('title')).toBe(false)
  expect('undeclaredKey' in el).toBe(false)
}

describe('renderer applies only catalog-declared props (T-0552)', () => {
  it('a static undeclared key is never set on the element, while declared props still apply', () => {
    const { mount, r } = setup()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['t'], title: 'stray', undeclaredKey: 'stray' },
          { id: 't', component: 'Text', text: 'hello', title: 'stray' },
        ],
      },
    })
    const col = mount.querySelector('ui-column') as HTMLElement
    const text = mount.querySelector('ui-text') as HTMLElement
    expect(col).not.toBeNull()
    expect(text.textContent).toContain('hello') // the declared prop still applies
    untouched(col)
    untouched(text)
    r.dispose()
    mount.remove()
  })

  it('a bound undeclared key is never set, before or after the data model updates', async () => {
    const { mount, r } = setup()
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', value: { v: 'one' } } })
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'root', component: 'Text', text: { path: '/v' }, title: { path: '/v' }, undeclaredKey: { path: '/v' } }],
      },
    })
    const text = mount.querySelector('ui-text') as HTMLElement
    expect(text.textContent).toContain('one')
    untouched(text)
    r.ingestMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/v', value: 'two' } })
    await whenFlushed()
    expect(text.textContent).toContain('two') // the declared binding still tracks the model
    untouched(text)
    r.dispose()
    mount.remove()
  })

  it('a structural resend that adds an undeclared key leaves the element untouched', () => {
    const { mount, r } = setup()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: 'first' }] },
    })
    const text = mount.querySelector('ui-text') as HTMLElement
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'root', component: 'Text', text: 'second', title: 'stray', undeclaredKey: 'stray' }],
      },
    })
    const after = mount.querySelector('ui-text') as HTMLElement
    expect(after.textContent).toContain('second')
    untouched(after)
    untouched(text)
    r.dispose()
    mount.remove()
  })
})
