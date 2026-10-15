// @vitest-environment jsdom
// T-0222: the surface button reader lists only visible buttons. A finished blackjack round stays in the log
// with its bet strip hidden, and the probe's click-target report read that strip as live choices. jsdom has
// no layout, so `checkVisibility` is stubbed to the `hidden` attribute; the test pins that the reader asks it.
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminPage } from './admin-page.ts'

const page = { evaluate: async (fn, arg) => fn(arg) }

describe('AdminPage surface buttons', () => {
  beforeEach(() => {
    HTMLElement.prototype.checkVisibility = function () {
      return this.closest('[hidden]') === null
    }
    document.body.innerHTML = `
      <div data-part="chat-pane"><div data-part="mounts">
        <ui-surface-host><div hidden><ui-button>25</ui-button><ui-button>50</ui-button></div><ui-button>Deal again</ui-button></ui-surface-host>
        <ui-surface-host><ui-button>Hit</ui-button><ui-button>Stand</ui-button></ui-surface-host>
      </div></div>`
  })

  it('lists only the visible buttons', async () => {
    expect(await new AdminPage(page).surfaceButtonLabels('chat')).toEqual(['Deal again', 'Hit', 'Stand'])
  })

  it('clicks the newest visible match, never a hidden one', async () => {
    const clicked = []
    for (const b of document.querySelectorAll('ui-button')) b.addEventListener('click', () => clicked.push(b.textContent))
    document.querySelector('ui-surface-host:last-child').insertAdjacentHTML('beforeend', '<div hidden><ui-button>Hit</ui-button></div>')
    document.querySelector('ui-surface-host:last-child div[hidden] ui-button').addEventListener('click', () => clicked.push('hidden Hit'))
    expect(await new AdminPage(page).clickSurfaceButton('Hit')).toEqual({ inNewestSurface: true })
    expect(clicked).toEqual(['Hit'])
  })

  it('says when the clicked button sits on an older surface (T-0271)', async () => {
    expect(await new AdminPage(page).clickSurfaceButton('Deal again')).toEqual({ inNewestSurface: false })
  })
})
